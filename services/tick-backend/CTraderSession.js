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
                    // Determine subscribed periods for this symbol to route correctly
                    const subscribedPeriods = this.getSubscribedBarPeriods(symbolName);
                    const hasM1 = subscribedPeriods.has('M1');
                    const hasOther = subscribedPeriods.size > 0 && !hasM1 || subscribedPeriods.size > 1;

                    // Always process as M1 bar for existing market profile flow
                    if (hasM1 || subscribedPeriods.size === 0) {
                        const result = this.eventHandler.processTrendbarEvent(event, symbolName, symbolInfo);
                        m1Bar = result.m1Bar;
                        tickData = result.tick;
                    }

                    // Emit barUpdate for non-M1 bar subscriptions.
                    // At most ONE non-M1 period is active per symbol (enforced by
                    // subscribeToBars), so we can safely emit for the first non-M1
                    // period found. The cTrader event doesn't carry a period field,
                    // but the single-subscription constraint means the trendbar data
                    // unambiguously belongs to that one period.
                    if (hasOther) {
                        for (const period of subscribedPeriods) {
                            if (period === 'M1') continue;
                            const barData = this.eventHandler.processMultiTimeframeTrendbarEvent(event, symbolName, symbolInfo, period);
                            if (barData) {
                                this.emit('barUpdate', barData);
                            }
                            break; // Only one non-M1 period per symbol
                        }
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
        const symbolId = this.symbolLoader.getSymbolId(symbolName);
        if (symbolId) {
            await this.connection.sendCommand('ProtoOASubscribeLiveTrendbarReq', {
                ctidTraderAccountId: this.ctidTraderAccountId,
                symbolId: symbolId,
                period: 'M1'
            });
        } else {
            const error = new Error(`Symbol ID not found for ${symbolName}`);
            error.code = 'SYMBOL_NOT_FOUND';
            error.symbol = symbolName;
            throw error;
        }
    }

    /**
     * Subscribe to live trendbars for any cTrader-supported period.
     * Only ONE non-M1 bar subscription per symbol is supported at a time.
     * When subscribing to a new period for the same symbol, the previous
     * non-M1 subscription is automatically unsubscribed first.
     *
     * Rationale: cTrader sends separate spot events per period subscription,
     * but the event does not carry a period field to identify which period
     * the trendbar data belongs to. Supporting only one non-M1 period per
     * symbol avoids ambiguous routing in the spot event handler.
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

        // Enforce single non-M1 bar subscription per symbol.
        // cTrader spot events don't carry a period field, so multiple non-M1
        // subscriptions for the same symbol would make it impossible to route
        // trendbar data to the correct period.
        if (period !== 'M1') {
            for (const [existingKey] of this.activeBarSubscriptions) {
                const [existingSymbol, existingPeriod] = existingKey.split(':');
                if (existingSymbol === symbolName && existingPeriod !== 'M1') {
                    console.log(`[CTraderSession] Replacing ${existingKey} with ${key} (single non-M1 per symbol)`);
                    await this.unsubscribeFromBars(symbolName, existingPeriod);
                    break;
                }
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

module.exports = { CTraderSession };
