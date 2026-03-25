/**
 * TradingView WebSocket API client with dual-session candle subscriptions.
 *
 * Manages separate chart sessions for two time series:
 *   - D1 session (daily candles): ADR calculation and current price
 *   - M1 session (1-minute candles): Market Profile TPO calculation
 *
 * Emits symbolDataPackage when both sessions complete historical load,
 * ensuring ADR and Market Profile data arrive together.
 */
const EventEmitter = require('events');
const { connect } = require('tradingview-ws');
const randomstring = require('randomstring');
const { HealthMonitor } = require('./HealthMonitor');
const { ReconnectionManager } = require('./utils/ReconnectionManager');
const { TradingViewCandleHandler, estimatePipData } = require('./TradingViewCandleHandler');
const { TradingViewSubscriptionManager } = require('./TradingViewSubscriptionManager');

class TradingViewSession extends EventEmitter {
    constructor(twapService = null, marketProfileService = null) {
        super();
        this.client = null;
        this.sessionId = null;
        this.subscriptions = new Map();
        this.unsubscribe = null;

        // 6s staleness threshold to avoid false positives during normal market low-activity periods
        this.healthMonitor = new HealthMonitor('tradingview', 6000, 1000);
        this.reconnection = new ReconnectionManager(15000, 500, Number(process.env.MAX_RECONNECT_ATTEMPTS) || 20);

        // Track current M1 bars being built from tick data
        // TradingView doesn't send real-time M1 updates after series_completed
        this.currentM1Bars = new Map(); // symbol -> { open, high, low, close, minuteTimestamp }

        const { calculateBucketSizeForSymbol } = require('./MarketProfileService');
        this.candleHandler = new TradingViewCandleHandler(this.healthMonitor, calculateBucketSizeForSymbol, twapService, marketProfileService);
        this.candleHandler.setEmitter(this.emit.bind(this));
        this.subscriptionManager = null;

        // Store listener references to prevent duplicates
        this.closeEventHandler = null;
        this.errorEventHandler = null;
        this.staleEventHandler = null;

        // Connection state guard
        this.eventListenersAttached = false;
        this.isDisconnecting = false;
        this.connectedAt = null;
    }

    async connect(sessionId) {
        this.sessionId = sessionId;

        try {
            const options = sessionId ? { sessionId } : {};
            this.client = await connect(options);
            this.subscriptionManager = new TradingViewSubscriptionManager(this.client);

            this.removeEventListeners();
            this.setupEventListeners();

            this.unsubscribe = this.client.subscribe((event) => {
                this.handleEvent(event);
            });

            // Initialize health monitor and start tracking
            this.connectedAt = Date.now();
            this.healthMonitor.recordTick(); // Prevent immediate staleness on connect
            this.healthMonitor.start();
            this.reconnection.reset();

            console.log('[TradingView] Connected');
            this.emit('connected');

        } catch (error) {
            console.error('[TradingView] Connection failed:', error.message);
            this.handleDisconnect(error);
            throw error;
        }
    }

    handleEvent(event) {
        try {
            // DIAGNOSTIC: Log ALL events to understand TradingView behavior
            console.log(`[TradingView] EVENT: ${event.name}`, event.params ? `params: ${JSON.stringify(event.params).substring(0, 200)}` : '');

            switch (event.name) {
                case 'timescale_update':
                case 'du':
                    this.handleCandleUpdate(event.params);
                    break;
                case 'series_completed':
                    this.handleSeriesCompleted(event.params);
                    break;
                case 'symbol_error':
                    console.error('[TradingView] Symbol error:', event.params);
                    this.emit('error', new Error(event.params?.toString() || 'Unknown symbol error'));
                    break;
            }
        } catch (error) {
            console.error('[TradingView] Error handling event:', error.message);
            console.error('Event data:', JSON.stringify(event).substring(0, 200));
            // Emit error but don't crash - continue processing other events
            this.emit('error', error);
        }
    }

    handleCandleUpdate(params) {
        if (!params || !params[1]) return;

        const chartSession = params[0];
        const seriesData = params[1];

        for (const [symbol, data] of this.subscriptions.entries()) {
            if (data.d1ChartSession === chartSession) {
                this.candleHandler.handleD1Candles(chartSession, seriesData['sds_1']?.['s'], symbol, data);
                break;
            }
            if (data.m1ChartSession === chartSession) {
                this.candleHandler.handleM1Candles(chartSession, seriesData['sds_2']?.['s'], symbol, data);
                break;
            }
        }
    }

    handleSeriesCompleted(params) {
        const chartSession = params[0];

        for (const [symbol, data] of this.subscriptions.entries()) {
            if (data.d1ChartSession === chartSession && !data.initialSent) {
                if (data.historicalCandles.length > 0 && !data.d1Complete) {
                    data.d1Complete = true;
                    console.log(`[TradingView] D1 series complete for ${symbol}`);
                } else if (data.historicalCandles.length === 0 && !data.d1Complete) {
                    console.error(`[TradingView] D1 series completed with zero candles for ${symbol}`);
                    this.emit('error', new Error(`D1 series empty for ${symbol}`));
                    return;
                }

                if (data.d1Complete && data.m1Complete) {
                    this.candleHandler.emitDataPackage(symbol, data, this.emit.bind(this), estimatePipData);
                }
                break;
            }

            if (data.m1ChartSession === chartSession && !data.initialSent) {
                if (data.m1Candles.length > 0 && !data.m1Complete) {
                    data.m1Complete = true;
                    console.log(`[TradingView] M1 series complete for ${symbol} (${data.m1Candles.length} candles)`);
                } else if (data.m1Candles.length === 0 && !data.m1Complete) {
                    console.error(`[TradingView] M1 series completed with zero candles for ${symbol}`);
                    this.emit('error', new Error(`M1 series empty for ${symbol}`));
                    return;
                }

                if (data.d1Complete && data.m1Complete) {
                    this.candleHandler.emitDataPackage(symbol, data, this.emit.bind(this), estimatePipData);
                }
                break;
            }
        }
    }

    async subscribeToSymbol(symbol, lookbackDays = 14) {
        if (!this.client) throw new Error('Not connected');

        const d1ChartSession = `cs_d1_${randomstring.generate(12)}`;
        const m1ChartSession = `cs_m1_${randomstring.generate(12)}`;

        this.subscriptionManager.createD1Session(symbol, d1ChartSession, lookbackDays);
        this.subscriptionManager.createM1Session(symbol, m1ChartSession);

        const subscription = this.subscriptionManager.createSubscriptionData(symbol, d1ChartSession, m1ChartSession, lookbackDays);
        this.subscriptions.set(symbol, subscription);

        this.subscriptionManager.setCompletionTimeout(subscription, symbol, (error) => this.emit('error', error));

        console.log(`[TradingView] M1 subscription active for ${symbol}`);
    }

    setupEventListeners() {
        if (this.eventListenersAttached) {
            console.log('[TradingView] Event listeners already attached, skipping');
            return;
        }

        // tradingview-ws library doesn't emit standard 'close'/'error' events
        // Instead, we use the health monitor to detect stale connections
        this.staleEventHandler = () => {
            console.log('[TradingView] Connection detected as stale, triggering reconnection');
            this.handleDisconnect(new Error('Connection stale - no data received'), true);
        };

        // Try to bind to library events if they exist (won't work with current library version)
        this.closeEventHandler = () => {
            console.log('[TradingView] Connection closed');
            this.handleDisconnect();
        };

        this.errorEventHandler = (err) => {
            console.error('[TradingView] Connection error:', err);
            this.handleDisconnect(err);
        };

        // Use health monitor for connection health tracking
        this.healthMonitor.on('stale', this.staleEventHandler);

        // These won't work with current tradingview-ws but kept for compatibility
        try {
            this.client.on('close', this.closeEventHandler);
            this.client.on('error', this.errorEventHandler);
        } catch (e) {
            // Library doesn't support these events
        }

        this.eventListenersAttached = true;
    }

    removeEventListeners() {
        if (!this.client) return;

        // Remove health monitor listener
        if (this.staleEventHandler) {
            this.healthMonitor.removeListener('stale', this.staleEventHandler);
            this.staleEventHandler = null;
        }

        // Remove client event listeners if they exist
        try {
            if (this.closeEventHandler) {
                this.client.removeListener('close', this.closeEventHandler);
                this.closeEventHandler = null;
            }

            if (this.errorEventHandler) {
                this.client.removeListener('error', this.errorEventHandler);
                this.errorEventHandler = null;
            }
        } catch (e) {
            // Library doesn't support these events
        }

        this.eventListenersAttached = false;
    }

    disconnect() {
        // Use handleDisconnect with shouldScheduleReconnect=false to prevent auto-reconnect
        this.handleDisconnect(null, false);
    }

    async reconnect() {
        console.log('[TradingViewSession] Manual reinit requested');
        this.healthMonitor.stop();
        this.reconnection.cancelReconnect();
        this.disconnect();
        await this.connect(this.sessionId);
    }

    handleDisconnect(error = null, shouldScheduleReconnect = true) {
        // Prevent concurrent disconnect handling
        if (this.isDisconnecting) {
            console.log('[TradingView] Already disconnecting, skipping duplicate call');
            return;
        }

        this.isDisconnecting = true;
        console.log('[TradingView] handleDisconnect() called');
        if (error) console.error('[TradingView] connection failed:', error);

        this.reconnection.cancelReconnect();
        this.healthMonitor.stop();
        this.emit('disconnected');

        if (this.client) {
            console.log('[TradingView] Closing client in handleDisconnect');
            this.removeEventListeners();
            if (this.unsubscribe) this.unsubscribe();
            this.client.close();
            this.client = null;
        }
        this.subscriptions.clear();

        // Reset flag after cleanup
        this.isDisconnecting = false;

        if (shouldScheduleReconnect) {
            this.scheduleReconnect();
        }
    }

    scheduleReconnect() {
        this.reconnection.scheduleReconnect(() => this.connect(this.sessionId));
    }
}

module.exports = { TradingViewSession };
