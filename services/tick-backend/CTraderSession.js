const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');
const { CTraderTransportAdapter } = require('./supervision/CTraderTransportAdapter');
const { HealthMonitor } = require('./HealthMonitor');
const { ReconnectionManager } = require('./utils/ReconnectionManager');
const { CTraderSymbolLoader } = require('./CTraderSymbolLoader');
const { CTraderDataProcessor } = require('./CTraderDataProcessor');
const { CTraderEventHandler } = require('./CTraderEventHandler');
const { VALID_PERIODS } = require('./utils/constants');
const config = require('./config');
const { createLogger } = require('./utils/Logger');
const log = createLogger('CTraderSession');

/**
 * CTrader Session - Main orchestration for cTrader connection.
 * Delegates symbol loading, data processing, and event handling to focused modules.
 */
class CTraderSession extends EventEmitter {
    constructor() {
        super();
        this.connection = null;
        this.heartbeatInterval = null;
        this.ctidTraderAccountId = Number(config.ctraderAccountId);
        this.accessToken = config.ctraderAccessToken;
        this.refreshToken = config.ctraderRefreshToken;
        this.clientId = config.ctraderClientId;
        this.clientSecret = config.ctraderClientSecret;

        this.symbolLoader = null;
        this.dataProcessor = null;
        this.eventHandler = null;

        // 60s staleness threshold - FX pairs can go tens of seconds without ticks
        // during low-activity periods; only ticks reset the timer, so this must be generous
        this.healthMonitor = new HealthMonitor('ctrader', 60000, 10000);
        this.reconnection = new ReconnectionManager(15000, 500, config.maxReconnectAttempts);

        // Store listener references to prevent duplicates
        this.spotEventHandler = null;
        this.closeEventHandler = null;
        this.errorEventHandler = null;
        this.staleEventHandler = null;

        // Connection state guards
        this.isConnecting = false;
        this.isDisconnecting = false;
        this.eventListenersAttached = false;
        this.connectedAt = null;

        // Supervised mode: when a FeedSupervisor owns this session's lifecycle,
        // the session does NOT self-reconnect or self-track staleness — it becomes
        // a dumb I/O worker that emits connected/disconnected/tick, and the
        // supervisor (monitoring the transport + its own HealthSensor) recovers.
        this.supervised = false;

        // Track active subscriptions for restoration after reconnection
        this.activeSubscriptions = new Set();

        // Track active bar subscriptions (multi-timeframe): 'symbolName:period' -> true
        this.activeBarSubscriptions = new Map();

        // Track last bar timestamp per symbol:period for bar-close detection
        this.lastBarTimestamps = new Map();
    }

    async connect(transport) {
        if (this.isConnecting) {
            return;
        }

        this.isConnecting = true;

        if (this.connection) this.connection.close();

        // Accept an injected transport (CTraderTransportAdapter in production, a
        // FakeTransport in tests) so connection lifecycle is supervisor-driven
        // and recovery is unit-testable offline. Default to the adapter, which
        // resolves DNS→IP itself (bypassing the library's WSL2 TLS-hang fallback)
        // and bounds every sendCommand with a per-RPC TTL (defect #4).
        this.connection = transport || new CTraderTransportAdapter({
            host: config.ctraderHost,
            port: Number(config.ctraderPort),
        });

        this.symbolLoader = new CTraderSymbolLoader(this.connection, this.ctidTraderAccountId);
        this.dataProcessor = new CTraderDataProcessor(this.connection, this.ctidTraderAccountId, this.symbolLoader);
        this.eventHandler = new CTraderEventHandler(this.dataProcessor, this.healthMonitor);

        this.removeEventListeners();
        this.setupEventListeners();

        // Add timeout to detect hanging connection
        let timeoutHandle;
        const timeout = new Promise((_, reject) => {
            timeoutHandle = setTimeout(() => reject(new Error('cTrader connection timeout after 10 seconds')), 10000);
        });

        try {
            await Promise.race([this.connection.open(), timeout]);
            clearTimeout(timeoutHandle);
            this.isConnecting = false;
        } catch (error) {
            clearTimeout(timeoutHandle);
            this.isConnecting = false;
            log.error('Connection failed:', error.message);
            this.handleDisconnect(error, true);
            throw error;
        }

        await this.authenticate();
        await this.symbolLoader.loadAllSymbols();

        // Restore subscriptions after reconnection
        await this.restoreSubscriptions();

        this.startHeartbeat();

        // Initialize health monitor with grace period - start first (resets lastTick),
        // then record tick immediately to prevent immediate staleness
        this.connectedAt = Date.now();
        this.healthMonitor.start();
        this.healthMonitor.recordTick();

        this.reconnection.reset();
        this.emit('connected', this.symbolLoader.getAllSymbolNames());
    }

    setupEventListeners() {
        if (this.eventListenersAttached) {
            return;
        }

        this.spotEventHandler = async (event) => {
            try {
                const symbolId = Number(event.symbolId);
                if (!symbolId) return;

                const symbolName = this.symbolLoader.getSymbolName(symbolId);
                if (!symbolName) return;

                const symbolInfo = await this.symbolLoader.getFullSymbolInfo(symbolId);
                if (!symbolInfo) return;

                let tickData = null;
                let m1Bar = null;

                if (event.trendbar && event.trendbar.length > 0) {
                    const subscribedPeriods = this.getSubscribedBarPeriods(symbolName);
                    const hasM1 = subscribedPeriods.has('M1');

                    // Try period-field routing first.
                    // Each trendbar entry MAY carry a period field (ProtoOATrendbarPeriod numeric enum).
                    // When populated, we can route each entry to the correct handler.
                    for (const tb of event.trendbar) {
                        const periodStr = tb.period != null ? (PERIOD_ENUM_TO_STRING[tb.period] || null) : null;

                        if (periodStr === 'M1') {
                            if (hasM1 || subscribedPeriods.size === 0) {
                                const result = this.eventHandler.processTrendbarEntry(tb, symbolName, symbolInfo);
                                m1Bar = result.m1Bar;
                                tickData = result.tick;
                            }
                        } else if (periodStr && periodStr !== 'M1' && subscribedPeriods.has(periodStr)) {
                            const barData = this.eventHandler.processMultiTimeframeTrendbarEntry(tb, symbolName, symbolInfo, periodStr);
                            if (barData) {
                                const tsKey = `${symbolName}:${periodStr}`;
                                const prevTimestamp = this.lastBarTimestamps.get(tsKey);
                                barData.isBarClose = prevTimestamp !== undefined && prevTimestamp !== barData.bar.timestamp;
                                this.lastBarTimestamps.set(tsKey, barData.bar.timestamp);
                                this.emit('barUpdate', barData);
                            }
                        }
                        // periodStr === null → period field absent; per-tick path handles live close for non-M1 TFs
                    }

                    // Non-M1 routing: cTrader spot events only carry M1 trendbar entries
                    // (RC6 in plans/chart-data-fix.md). The period-field loop above handles
                    // genuine non-M1 entries if they ever arrive. No fallback needed — the
                    // per-tick spot price path in ChartDisplay handles live close updates
                    // for non-M1 timeframes.

                    // Ensure M1 processing happened even if period field was absent
                    if (!m1Bar && !tickData && (hasM1 || subscribedPeriods.size === 0)) {
                        const lastTb = event.trendbar[event.trendbar.length - 1];
                        const result = this.eventHandler.processTrendbarEntry(lastTb, symbolName, symbolInfo);
                        m1Bar = result.m1Bar;
                        tickData = result.tick;
                    }
                }

                // Always derive live tick price from bid/ask when available.
                // Trendbar close prices are from the last *closed* bar (stale),
                // whereas bid/ask are live market quotes. Both can arrive in the
                // same spot event, so process them independently.
                if (event.bid != null && event.ask != null) {
                    // Defect #3 fix: processSpotEvent can return null during quiet /
                    // rollover windows (non-finite or inverted bid/ask). Only adopt the
                    // spot-derived tick when it is valid, so a null does NOT clobber a
                    // valid trendbar-derived tick, drop the emit, or skip recordTick().
                    const spotTick = this.eventHandler.processSpotEvent(event, symbolName, symbolInfo);
                    if (spotTick) tickData = spotTick;
                }

                if (tickData) {
                    this.healthMonitor.recordTick();
                    this.emit('tick', tickData);
                }

                if (m1Bar) {
                    this.emit('m1Bar', m1Bar);
                }
            } catch (error) {
                log.error('[ERROR] Unhandled error in PROTO_OA_SPOT_EVENT handler:', error);
            }
        };

        this.closeEventHandler = () => {
            this.handleDisconnect(null, true);
        };

        this.errorEventHandler = (err) => {
            log.error('[ERROR] CTraderConnection error:', err);
            this.handleDisconnect(err, true);
        };

        // Handle staleness detection from HealthMonitor
        this.staleEventHandler = () => {
            this.handleDisconnect(new Error('Connection stale - no data received'), true);
        };

        this.connection.on('PROTO_OA_SPOT_EVENT', this.spotEventHandler);
        this.connection.on('close', this.closeEventHandler);
        this.connection.on('error', this.errorEventHandler);

        // In supervised mode the supervisor's HealthSensor owns staleness; skip
        // the session's own stale→disconnect trigger to avoid dual detection.
        if (!this.supervised) {
            this.healthMonitor.on('stale', this.staleEventHandler);
        }

        this.eventListenersAttached = true;
    }

    removeEventListeners() {
        if (!this.connection) return;

        if (this.spotEventHandler) {
            // Must use numeric payload type '2131' because removeListener is not overridden
            this.connection.removeAllListeners('2131');
            this.spotEventHandler = null;
        }

        if (this.closeEventHandler) {
            this.connection.removeListener('close', this.closeEventHandler);
            this.closeEventHandler = null;
        }

        if (this.errorEventHandler) {
            this.connection.removeListener('error', this.errorEventHandler);
            this.errorEventHandler = null;
        }

        // Remove health monitor listener
        if (this.staleEventHandler) {
            this.healthMonitor.removeListener('stale', this.staleEventHandler);
            this.staleEventHandler = null;
        }

        this.eventListenersAttached = false;
    }

    async authenticate() {
        await this.connection.sendCommand('ProtoOAApplicationAuthReq', {
            clientId: this.clientId,
            clientSecret: this.clientSecret
        });

        try {
            await this.connection.sendCommand('ProtoOAAccountAuthReq', {
                ctidTraderAccountId: this.ctidTraderAccountId,
                accessToken: this.accessToken
            });
        } catch (authError) {
            if (authError.errorCode === 'CH_ACCESS_TOKEN_INVALID' && this.refreshToken) {
                const refreshRes = await this.connection.sendCommand('ProtoOARefreshTokenReq', {
                    refreshToken: this.refreshToken
                });
                this.accessToken = refreshRes.accessToken;
                this.refreshToken = refreshRes.refreshToken;
                this.persistTokens(this.accessToken, this.refreshToken);

                await this.connection.sendCommand('ProtoOAAccountAuthReq', {
                    ctidTraderAccountId: this.ctidTraderAccountId,
                    accessToken: this.accessToken
                });
            } else {
                throw authError;
            }
        }
    }

    persistTokens(accessToken, refreshToken) {
        const envPath = path.resolve(__dirname, '../../.env');
        const tmpPath = envPath + '.tmp';
        try {
            let envContent = fs.readFileSync(envPath, 'utf8');
            envContent = envContent.replace(
                /^CTRADER_ACCESS_TOKEN=.*$/m,
                `CTRADER_ACCESS_TOKEN=${accessToken}`
            );
            envContent = envContent.replace(
                /^CTRADER_REFRESH_TOKEN=.*$/m,
                `CTRADER_REFRESH_TOKEN=${refreshToken}`
            );
            // Atomic write: write to temp file, then rename (atomic on POSIX)
            fs.writeFileSync(tmpPath, envContent);
            fs.renameSync(tmpPath, envPath);
        } catch (err) {
            log.warn('Failed to persist tokens to .env:', err.message);
            // Clean up temp file if it exists
            try { fs.unlinkSync(tmpPath); } catch (e) { /* ignore */ }
        }
    }

    handleDisconnect(error = null, shouldScheduleReconnect = true) {
        // Prevent concurrent disconnect handling
        if (this.isDisconnecting) {
            return;
        }

        this.isDisconnecting = true;
        if (error) log.error('connection failed:', error);
        this.reconnection.cancelReconnect();
        this.isConnecting = false;
        this.healthMonitor.stop();
        this.stopHeartbeat();
        this.emit('disconnected');

        if (this.connection) {
            this.connection.close();
        }

        // Reset flag after cleanup
        this.isDisconnecting = false;

        // In supervised mode the supervisor owns recovery (it observes the
        // transport close / its HealthSensor and re-arms). Do not self-reconnect.
        if (shouldScheduleReconnect && !this.supervised) {
            this.scheduleReconnect();
        }
    }

    scheduleReconnect() {
        this.reconnection.scheduleReconnect(() => this.connect());
    }

    startHeartbeat() {
        this.stopHeartbeat();

        // The server echoes ProtoHeartbeatEvent back as a push event (payloadType 51),
        // NOT as a command response with clientMsgId. sendCommand().then() never fires.
        // CTraderConnection.on() normalizes 'ProtoHeartbeatEvent' to numeric '51',
        // but removeListener is NOT overridden - so we must use '51' for cleanup.
        this.heartbeatEventHandler = () => {
            this.healthMonitor.recordTick();
            // Emit 'heartbeat' so a supervising FeedSupervisor's HealthSensor can
            // track liveness distinctly from data ticks (DEGRADED vs STALE).
            this.emit('heartbeat');
        };
        this.connection.on('ProtoHeartbeatEvent', this.heartbeatEventHandler);

        this.heartbeatInterval = setInterval(() => {
            try {
                // sendRaw = fire-and-forget heartbeat (not routed through our
                // tracked command map), per the defect-#4 fix in the transport tier.
                if (this.connection) this.connection.sendRaw();
            } catch (e) { /* connection closing */ }
        }, 10000);
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        if (this.connection && this.heartbeatEventHandler) {
            // Must use numeric payload type '51' because removeListener is not overridden
            this.connection.removeAllListeners('51');
            this.heartbeatEventHandler = null;
        }
    }

    /**
     * Restore all active subscriptions after reconnection.
     * Called during connect() to resubscribe to every symbol/period that was
     * active before the disconnect — on a possibly NEW transport.
     */
    async restoreSubscriptions() {
        if (!this.connection) {
            return;
        }
        if (this.activeSubscriptions.size === 0 && this.activeBarSubscriptions.size === 0) {
            return;
        }

        // Snapshot what to restore, then CLEAR the in-memory tracking. This may
        // be a brand-new connection, so every subscription must be re-sent — but
        // subscribeToTicks/M1Bars/Bars carry idempotency guards that short-
        // circuit when the set already holds the key. Because the sets persist
        // across reconnects (to remember what to restore), NOT clearing would
        // leave the restored feed silent (the B0 baseline defect). Clearing first
        // makes the guards pass and the sets repopulate exactly as on a fresh
        // connect, so the restored set is symbol-for-symbol equal to the
        // pre-disconnect set.
        const tickNames = [...this.activeSubscriptions];
        const barKeys = [...this.activeBarSubscriptions.keys()];
        this.activeSubscriptions.clear();
        this.activeBarSubscriptions.clear();

        // Restore in order: ticks first (cTrader requires ticks before bars),
        // then M1 bars, then any other bar subscriptions.
        for (const symbolName of tickNames) {
            try {
                await this.subscribeToTicks(symbolName);
                await new Promise(resolve => setTimeout(resolve, 50)); // Small delay to avoid overwhelming API
            } catch (error) {
                log.error(`Failed to restore tick subscription for ${symbolName}:`, error.message);
            }
        }

        for (const symbolName of tickNames) {
            try {
                await this.subscribeToM1Bars(symbolName);
                await new Promise(resolve => setTimeout(resolve, 50)); // Small delay to avoid overwhelming API
            } catch (error) {
                log.error(`Failed to restore M1 bar subscription for ${symbolName}:`, error.message);
            }
        }

        for (const key of barKeys) {
            const [symbolName, period] = key.split(':');
            try {
                await this.subscribeToBars(symbolName, period);
                await new Promise(resolve => setTimeout(resolve, 50));
            } catch (error) {
                log.error(`Failed to restore bar subscription for ${key}:`, error.message);
            }
        }
    }

    async subscribeToTicks(symbolName) {
        if (this.activeSubscriptions.has(symbolName)) {
            return;
        }

        const symbolId = this.symbolLoader.getSymbolId(symbolName);
        if (symbolId) {
            await this.connection.sendCommand('ProtoOASubscribeSpotsReq', {
                ctidTraderAccountId: this.ctidTraderAccountId,
                symbolId: [symbolId]
            });
            // Track subscription for restoration after reconnect
            this.activeSubscriptions.add(symbolName);
        } else {
            const error = new Error(`Symbol ID not found for ${symbolName}`);
            error.code = 'SYMBOL_NOT_FOUND';
            error.symbol = symbolName;
            throw error;
        }
    }

    async unsubscribeFromTicks(symbolName) {
        const symbolId = this.symbolLoader.getSymbolId(symbolName);
        if (symbolId) {
            await this.connection.sendCommand('ProtoOAUnsubscribeSpotsReq', {
                ctidTraderAccountId: this.ctidTraderAccountId,
                symbolId: [symbolId]
            });
            // Stop tracking this subscription
            this.activeSubscriptions.delete(symbolName);
        }
    }

    async subscribeToM1Bars(symbolName) {
        const key = `${symbolName}:M1`;
        if (this.activeBarSubscriptions.has(key)) {
            return;
        }

        const symbolId = this.symbolLoader.getSymbolId(symbolName);
        if (symbolId) {
            await this.connection.sendCommand('ProtoOASubscribeLiveTrendbarReq', {
                ctidTraderAccountId: this.ctidTraderAccountId,
                symbolId: symbolId,
                period: 'M1'
            });
            this.activeBarSubscriptions.set(key, true);
        } else {
            const error = new Error(`Symbol ID not found for ${symbolName}`);
            error.code = 'SYMBOL_NOT_FOUND';
            error.symbol = symbolName;
            throw error;
        }
    }

    /**
     * Subscribe to live trendbars for any cTrader-supported period.
     * Up to 3 non-M1 bar subscriptions per symbol are supported.
     * When the limit is reached, the oldest non-M1 subscription is evicted.
     *
     * Each trendbar entry in the spot event carries a numeric period field
     * (ProtoOATrendbarPeriod enum) that is mapped to the string identifier
     * used internally, enabling unambiguous routing per entry.
     *
     * @param {string} symbolName - Symbol name (e.g., 'EURUSD')
     * @param {string} period - cTrader period string (M1, M5, M10, M15, M30, H1, H4, H12, D1, W1, MN1)
     */
    async subscribeToBars(symbolName, period) {
        if (!VALID_PERIODS.includes(period)) {
            throw new Error(`Invalid period: ${period}. Must be one of: ${VALID_PERIODS.join(', ')}`);
        }

        const symbolId = this.symbolLoader.getSymbolId(symbolName);
        if (!symbolId) {
            const error = new Error(`Symbol ID not found for ${symbolName}`);
            error.code = 'SYMBOL_NOT_FOUND';
            error.symbol = symbolName;
            throw error;
        }

        const key = `${symbolName}:${period}`;
        if (this.activeBarSubscriptions.has(key)) {
            return;
        }

        if (period !== 'M1') {
            // Allow up to 3 non-M1 subscriptions per symbol.
            // Evict the oldest if limit reached.
            const MAX_NON_M1_PER_SYMBOL = 3;
            const nonM1Keys = [];
            for (const [existingKey] of this.activeBarSubscriptions) {
                const [existingSymbol, existingPeriod] = existingKey.split(':');
                if (existingSymbol === symbolName && existingPeriod !== 'M1') {
                    nonM1Keys.push(existingKey);
                }
            }
            if (nonM1Keys.length >= MAX_NON_M1_PER_SYMBOL) {
                const evictKey = nonM1Keys[0];
                const [, evictPeriod] = evictKey.split(':');
                await this.unsubscribeFromBars(symbolName, evictPeriod);
            }
        }

        await this.connection.sendCommand('ProtoOASubscribeLiveTrendbarReq', {
            ctidTraderAccountId: this.ctidTraderAccountId,
            symbolId: symbolId,
            period: period
        });

        this.activeBarSubscriptions.set(key, true);
    }

    /**
     * Unsubscribe from live trendbars for a specific period.
     * @param {string} symbolName - Symbol name
     * @param {string} period - cTrader period string
     */
    async unsubscribeFromBars(symbolName, period) {
        const symbolId = this.symbolLoader.getSymbolId(symbolName);
        if (!symbolId) return;

        const key = `${symbolName}:${period}`;
        if (!this.activeBarSubscriptions.has(key)) {
            return;
        }

        await this.connection.sendCommand('ProtoOAUnsubscribeLiveTrendbarReq', {
            ctidTraderAccountId: this.ctidTraderAccountId,
            symbolId: symbolId,
            period: period
        });

        this.activeBarSubscriptions.delete(key);
    }

    /**
     * Get set of subscribed bar periods for a symbol.
     * @param {string} symbolName
     * @returns {Set<string>} Set of period strings
     */
    getSubscribedBarPeriods(symbolName) {
        const periods = new Set();
        for (const [key] of this.activeBarSubscriptions) {
            const [symbol, period] = key.split(':');
            if (symbol === symbolName) {
                periods.add(period);
            }
        }
        return periods;
    }

    /**
     * Fetch historical candles for any period with automatic request chaining.
     * Delegates to CTraderDataProcessor.
     * @param {string} symbolName - Symbol name
     * @param {string} period - cTrader period string
     * @param {number} fromTimestamp - Start timestamp in ms
     * @param {number} toTimestamp - End timestamp in ms
     * @returns {Array} Array of OHLC bar objects sorted by timestamp
     */
    async fetchHistoricalCandles(symbolName, period, fromTimestamp, toTimestamp) {
        return this.dataProcessor.fetchHistoricalCandles(symbolName, period, fromTimestamp, toTimestamp);
    }

    async getSymbolDataPackage(symbolName, adrLookbackDays = 14) {
        return this.dataProcessor.getSymbolDataPackage(symbolName, adrLookbackDays);
    }

    disconnect(clearSubscriptions = true) {
        if (clearSubscriptions) {
            // Clear subscription tracking on explicit disconnect
            this.activeSubscriptions.clear();
            this.activeBarSubscriptions.clear();
        }
        // Use handleDisconnect with shouldScheduleReconnect=false to prevent auto-reconnect
        this.handleDisconnect(null, false);
    }

    async reconnect(transport) {
        this.healthMonitor.stop();
        this.reconnection.reset();
        this.isConnecting = false;
        // Preserve subscriptions across reconnect — connect() → restoreSubscriptions()
        // repopulates the backend from the saved maps.
        await this.disconnect(false);
        await this.connect(transport);
    }
}

// ProtoOATrendbarPeriod numeric enum → string identifier
// protobufjs deserializes the period field as a number, not a string
const PERIOD_ENUM_TO_STRING = {
    1: 'M1', 2: 'M2', 3: 'M3', 4: 'M4', 5: 'M5',
    6: 'M10', 7: 'M15', 8: 'M30', 9: 'H1', 10: 'H4',
    11: 'H12', 12: 'D1', 13: 'W1', 14: 'MN1'
};

module.exports = { CTraderSession };
