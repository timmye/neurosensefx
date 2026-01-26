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
    constructor() {
        super();
        this.client = null;
        this.sessionId = null;
        this.subscriptions = new Map();
        this.unsubscribe = null;

        this.healthMonitor = new HealthMonitor('tradingview');
        this.reconnection = new ReconnectionManager(60000, 1000);
        this.shouldReconnect = true;

        const { calculateBucketSizeForSymbol } = require('./MarketProfileService');
        this.candleHandler = new TradingViewCandleHandler(this.healthMonitor, calculateBucketSizeForSymbol);
        this.candleHandler.setEmitter(this.emit.bind(this));
        this.subscriptionManager = null;
    }

    async connect(sessionId) {
        this.sessionId = sessionId;

        try {
            const options = sessionId ? { sessionId } : {};
            this.client = await connect(options);
            this.subscriptionManager = new TradingViewSubscriptionManager(this.client);

            this.unsubscribe = this.client.subscribe((event) => {
                this.handleEvent(event);
            });

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
                this.emit('error', new Error(event.params.toString()));
                break;
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

    async disconnect() {
        this.reconnection.cancelReconnect();
        this.shouldReconnect = false;

        if (this.client) {
            if (this.unsubscribe) this.unsubscribe();
            await this.client.close();
            this.client = null;
        }
        this.subscriptions.clear();
    }

    async reconnect() {
        console.log('[TradingViewSession] Manual reinit requested');
        this.shouldReconnect = true;
        this.healthMonitor.stop();
        this.reconnection.cancelReconnect();
        await this.disconnect();
        await this.connect(this.sessionId);
    }

    handleDisconnect(error = null) {
        console.log('[TradingView] handleDisconnect() called');
        if (error) console.error('[TradingView] connection failed:', error);
        this.healthMonitor.stop();
        this.emit('disconnected');

        if (this.shouldReconnect) {
            this.scheduleReconnect();
        }
    }

    scheduleReconnect() {
        this.reconnection.scheduleReconnect(() => this.connect(this.sessionId));
    }
}

module.exports = { TradingViewSession };
