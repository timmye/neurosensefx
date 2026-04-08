const EventEmitter = require('events');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { CTraderConnection } = require('../../libs/cTrader-Layer/build/entry/node/main');
const { HealthMonitor } = require('./HealthMonitor');
const { ReconnectionManager } = require('./utils/ReconnectionManager');
const { CTraderSymbolLoader } = require('./CTraderSymbolLoader');
const { CTraderDataProcessor } = require('./CTraderDataProcessor');
const { CTraderEventHandler } = require('./CTraderEventHandler');

/**
 * CTrader Session - Main orchestration for cTrader connection.
 * Delegates symbol loading, data processing, and event handling to focused modules.
 */
class CTraderSession extends EventEmitter {
    constructor() {
        super();
        this.connection = null;
        this.heartbeatInterval = null;
        this.ctidTraderAccountId = Number(process.env.CTRADER_ACCOUNT_ID);
        this.accessToken = process.env.CTRADER_ACCESS_TOKEN;
        this.clientId = process.env.CTRADER_CLIENT_ID;
        this.clientSecret = process.env.CTRADER_CLIENT_SECRET;

        this.symbolLoader = null;
        this.dataProcessor = null;
        this.eventHandler = null;

        // 60s staleness threshold - FX pairs can go tens of seconds without ticks
        // during low-activity periods; only ticks reset the timer, so this must be generous
        this.healthMonitor = new HealthMonitor('ctrader', 60000, 10000);
        this.reconnection = new ReconnectionManager(15000, 500, Number(process.env.MAX_RECONNECT_ATTEMPTS) || 20);

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

        // Track active subscriptions for restoration after reconnection
        this.activeSubscriptions = new Set();

        // Track active bar subscriptions (multi-timeframe): 'symbolName:period' -> true
        this.activeBarSubscriptions = new Map();

        // Track last bar timestamp per symbol:period for bar-close detection
        this.lastBarTimestamps = new Map();
    }

    async connect() {
        if (this.isConnecting) {
            console.log('[CTraderSession] Connection already in progress, skipping');
            return;
        }

        this.isConnecting = true;

        if (this.connection) this.connection.close();

        this.connection = new CTraderConnection({
            host: process.env.HOST,
            port: Number(process.env.PORT),
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
            console.error('[CTraderSession] Connection failed:', error.message);
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
            console.log('[CTraderSession] Event listeners already attached, skipping');
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
                } else if (event.bid != null && event.ask != null) {
                    tickData = this.eventHandler.processSpotEvent(event, symbolName, symbolInfo);
                }

                if (tickData) {
                    this.healthMonitor.recordTick();
                    this.emit('tick', tickData);
                }

                if (m1Bar) {
                    this.emit('m1Bar', m1Bar);
                }
            } catch (error) {
                console.error('[ERROR] Unhandled error in PROTO_OA_SPOT_EVENT handler:', error);
            }
        };

        this.closeEventHandler = () => {
            console.log('[DEBUG] CTraderConnection closed');
            this.handleDisconnect(null, true);
        };

        this.errorEventHandler = (err) => {
            console.error('[ERROR] CTraderConnection error:', err);
            this.handleDisconnect(err, true);
        };

        // Handle staleness detection from HealthMonitor
        this.staleEventHandler = () => {
            console.log('[CTraderSession] Connection detected as stale, triggering reconnection');
            this.handleDisconnect(new Error('Connection stale - no data received'), true);
        };

        this.connection.on('PROTO_OA_SPOT_EVENT', this.spotEventHandler);
        this.connection.on('close', this.closeEventHandler);
        this.connection.on('error', this.errorEventHandler);

        // Use health monitor for staleness detection
        this.healthMonitor.on('stale', this.staleEventHandler);

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
        await this.connection.sendCommand('ProtoOAAccountAuthReq', {
            ctidTraderAccountId: this.ctidTraderAccountId,
            accessToken: this.accessToken
        });
    }

    handleDisconnect(error = null, shouldScheduleReconnect = true) {
        // Prevent concurrent disconnect handling
        if (this.isDisconnecting) {
            console.log('[CTraderSession] Already disconnecting, skipping duplicate call');
            return;
        }

        this.isDisconnecting = true;
        console.log('[CTraderSession] handleDisconnect() called');
        if (error) console.error('[CTraderSession] connection failed:', error);
        this.reconnection.cancelReconnect();
        this.isConnecting = false;
        this.healthMonitor.stop();
        this.stopHeartbeat();
        this.emit('disconnected');

        if (this.connection) {
            console.log('[CTraderSession] Closing connection in handleDisconnect');
            this.connection.close();
        }

        // Reset flag after cleanup
        this.isDisconnecting = false;

        if (shouldScheduleReconnect) {
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
        };
        this.connection.on('ProtoHeartbeatEvent', this.heartbeatEventHandler);

        this.heartbeatInterval = setInterval(() => {
            try {
                if (this.connection) this.connection.sendHeartbeat();
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
     * Called during connect() to resubscribe to all symbols that were active before disconnect.
     */
    async restoreSubscriptions() {
        if (!this.connection || this.activeSubscriptions.size === 0) {
            return;
        }

        console.log(`[CTraderSession] Restoring ${this.activeSubscriptions.size} subscriptions`);

        // Restore subscriptions in order: ticks first, then M1 bars, then other bar subscriptions
        for (const symbolName of this.activeSubscriptions) {
            try {
                // cTrader requires tick subscription before M1 bars
                await this.subscribeToTicks(symbolName);
                await new Promise(resolve => setTimeout(resolve, 50)); // Small delay to avoid overwhelming API
            } catch (error) {
                console.error(`[CTraderSession] Failed to restore tick subscription for ${symbolName}:`, error.message);
            }
        }

        for (const symbolName of this.activeSubscriptions) {
            try {
                await this.subscribeToM1Bars(symbolName);
                await new Promise(resolve => setTimeout(resolve, 50)); // Small delay to avoid overwhelming API
            } catch (error) {
                console.error(`[CTraderSession] Failed to restore M1 bar subscription for ${symbolName}:`, error.message);
            }
        }

        // Restore non-M1 bar subscriptions
        if (this.activeBarSubscriptions.size > 0) {
            console.log(`[CTraderSession] Restoring ${this.activeBarSubscriptions.size} bar subscriptions`);
            for (const [key] of this.activeBarSubscriptions) {
                const [symbolName, period] = key.split(':');
                try {
                    await this.subscribeToBars(symbolName, period);
                    await new Promise(resolve => setTimeout(resolve, 50));
                } catch (error) {
                    console.error(`[CTraderSession] Failed to restore bar subscription for ${key}:`, error.message);
                }
            }
        }

        console.log(`[CTraderSession] Subscription restoration complete`);
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
        const VALID_PERIODS = ['M1', 'M5', 'M10', 'M15', 'M30', 'H1', 'H4', 'H12', 'D1', 'W1', 'MN1'];
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
            console.log(`[CTraderSession] Already subscribed to ${key}, skipping`);
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
                console.log(`[CTraderSession] Max non-M1 subscriptions for ${symbolName}, evicting ${evictKey}`);
                await this.unsubscribeFromBars(symbolName, evictPeriod);
            }
        }

        await this.connection.sendCommand('ProtoOASubscribeLiveTrendbarReq', {
            ctidTraderAccountId: this.ctidTraderAccountId,
            symbolId: symbolId,
            period: period
        });

        this.activeBarSubscriptions.set(key, true);
        console.log(`[CTraderSession] Subscribed to ${key}`);
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
            console.log(`[CTraderSession] Not subscribed to ${key}, skipping unsubscribe`);
            return;
        }

        await this.connection.sendCommand('ProtoOAUnsubscribeLiveTrendbarReq', {
            ctidTraderAccountId: this.ctidTraderAccountId,
            symbolId: symbolId,
            period: period
        });

        this.activeBarSubscriptions.delete(key);
        console.log(`[CTraderSession] Unsubscribed from ${key}`);
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

    disconnect() {
        // Clear subscription tracking on explicit disconnect
        this.activeSubscriptions.clear();
        this.activeBarSubscriptions.clear();
        // Use handleDisconnect with shouldScheduleReconnect=false to prevent auto-reconnect
        this.handleDisconnect(null, false);
    }

    async reconnect() {
        console.log('[CTraderSession] Manual reinit requested');
        this.healthMonitor.stop();
        this.reconnection.cancelReconnect();
        this.isConnecting = false;
        await this.disconnect();
        await this.connect();
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
