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

        // 5min staleness threshold - TradingView has no heartbeat mechanism,
        // only actual candle data resets the timer. Quiet periods between
        // subscriptions or during low-activity can be very long.
        this.healthMonitor = new HealthMonitor('tradingview', 300000, 30000);
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

        // Pending historical candle requests (for chart data)
        this._pendingHistorical = new Map(); // chartSession -> { symbol, resolution, bars, resolve, reject }
    }

    // TradingView resolution format mapping
    static RESOLUTION_TO_TV = {
        '1m': '1', '5m': '5', '15m': '15', '30m': '30',
        '1h': '60', '4h': '240', 'D': '1D',
        'W': '1W', 'M': '1M'
    };

    static RESOLUTION_MS = {
        '1m': 60000, '5m': 300000, '15m': 900000, '30m': 1800000,
        '1h': 3600000, '4h': 14400000, 'D': 86400000,
        'W': 604800000, 'M': 2592000000
    };

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

            // Initialize health monitor - start first (resets lastTick),
            // then record tick immediately to prevent immediate staleness
            this.connectedAt = Date.now();
            this.healthMonitor.start();
            this.healthMonitor.recordTick();
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

        // Check if this is a historical candle request
        const pendingHist = this._pendingHistorical.get(chartSession);
        if (pendingHist) {
            const series = seriesData[pendingHist.seriesId]?.['s'];
            if (series) {
                pendingHist.bars = series.map(c => ({
                    timestamp: c.v[0] * 1000,
                    open: c.v[1],
                    high: c.v[2],
                    low: c.v[3],
                    close: c.v[4],
                    volume: c.v[5]
                }));
            }
            return;
        }

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

        // Check pending historical requests first
        const pendingHist = this._pendingHistorical.get(chartSession);
        if (pendingHist) {
            if (pendingHist.bars.length === 0) {
                pendingHist.reject(new Error(`TradingView returned no historical bars for ${pendingHist.symbol} ${pendingHist.resolution}`));
            } else {
                pendingHist.resolve(pendingHist.bars);
            }
            return;
        }

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

    /**
     * Fetch historical candles for a symbol at a given resolution.
     * Creates a temporary chart session, waits for series_completed, returns bars.
     * @param {string} symbol - Symbol identifier
     * @param {string} resolution - Chart resolution ('1m', '5m', '15m', '30m', '1h', '4h', 'D', 'W', 'M')
     * @param {number} from - Start timestamp (ms)
     * @param {number} to - End timestamp (ms)
     * @returns {Promise<Array>} Array of { timestamp, open, high, low, close, volume }
     */
    async fetchHistoricalCandles(symbol, resolution, from, to) {
        if (!this.client) throw new Error('Not connected');

        const tvResolution = TradingViewSession.RESOLUTION_TO_TV[resolution];
        if (!tvResolution) throw new Error(`Unsupported TradingView resolution: ${resolution}`);

        const resMs = TradingViewSession.RESOLUTION_MS[resolution];
        const amount = Math.min(5000, Math.ceil((to - from) / resMs) + 100);

        const chartSession = `cs_hist_${randomstring.generate(12)}`;
        const seriesId = `sds_hist_${Date.now()}`;

        console.log(`[TV-CHART] Fetching historical candles: ${symbol} ${resolution} (${tvResolution}), ${amount} bars`);

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this._pendingHistorical.delete(chartSession);
                try { this.client.send('delete_session', [chartSession]); } catch (e) { /* ignore */ }
                reject(new Error(`TradingView historical candle timeout for ${symbol} ${resolution}`));
            }, 30000);

            this._pendingHistorical.set(chartSession, {
                chartSession,
                seriesId,
                symbol,
                resolution,
                bars: [],
                resolve: (bars) => {
                    clearTimeout(timeout);
                    this._pendingHistorical.delete(chartSession);
                    try { this.client.send('delete_session', [chartSession]); } catch (e) { /* ignore */ }
                    console.log(`[TV-CHART] Historical candles fetched: ${symbol} ${resolution}, ${bars.length} bars`);
                    resolve(bars);
                },
                reject: (err) => {
                    clearTimeout(timeout);
                    this._pendingHistorical.delete(chartSession);
                    try { this.client.send('delete_session', [chartSession]); } catch (e) { /* ignore */ }
                    reject(err);
                }
            });

            this.client.send('chart_create_session', [chartSession, '']);
            this.client.send('resolve_symbol', [
                chartSession,
                `sds_sym_${symbol}`,
                '=' + JSON.stringify({ symbol, adjustment: 'splits' })
            ]);
            this.client.send('create_series', [
                chartSession,
                seriesId,
                's0',
                `sds_sym_${symbol}`,
                tvResolution,
                amount,
                ''
            ]);
        });
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
        this._pendingHistorical.clear();

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
