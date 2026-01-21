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
const moment = require('moment');
const { HealthMonitor } = require('./HealthMonitor');

// FIRST PRINCIPLES: Estimate pip data from price for TradingView (no API access)
// TradingView doesn't provide pipPosition, so we estimate from price magnitude
function estimatePipData(price) {
    if (price > 10000) return { pipPosition: 0, pipSize: 1, pipetteSize: 0.1 };       // Crypto/stocks
    if (price > 1000) return { pipPosition: 1, pipSize: 0.1, pipetteSize: 0.01 };     // Gold (XAUUSD)
    if (price > 10) return { pipPosition: 2, pipSize: 0.01, pipetteSize: 0.001 };     // JPY pairs
    return { pipPosition: 4, pipSize: 0.0001, pipetteSize: 0.00001 };                 // Most forex pairs
}

class TradingViewSession extends EventEmitter {
    constructor() {
        super();
        this.client = null;
        this.sessionId = null;
        this.subscriptions = new Map();
        this.unsubscribe = null;

        this.healthMonitor = new HealthMonitor('tradingview');

        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.maxReconnectDelay = 60000;
        this.shouldReconnect = true;
        this.reconnectTimeout = null;
    }

    async connect(sessionId) {
        this.sessionId = sessionId;

        try {
            const options = sessionId ? { sessionId } : {};
            this.client = await connect(options);

            this.unsubscribe = this.client.subscribe((event) => {
                this.handleEvent(event);
            });

            this.healthMonitor.start();

            this.reconnectAttempts = 0;
            this.reconnectDelay = 1000;

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
                // Both events provide candle updates
                this.handleCandleUpdate(event.params);
                break;
            case 'series_completed':
                // Initial historical data loaded
                this.handleSeriesCompleted(event.params);
                break;
            case 'symbol_error':
                console.error('[TradingView] Symbol error:', event.params);
                this.emit('error', new Error(event.params.toString()));
                break;
        }
    }

    handleCandleUpdate(params) {
        // params: [chartSession, { sds_1: { s: [D1 candles] } }] or [chartSession, { sds_2: { s: [M1 candles] } }]
        if (!params || !params[1]) return;

        const chartSession = params[0];
        const seriesData = params[1];

        // Find which symbol this is for
        for (const [symbol, data] of this.subscriptions.entries()) {
            // Match against EITHER d1ChartSession or m1ChartSession
            if (data.d1ChartSession === chartSession) {
                // Handle D1 candles (sds_1) for ADR calculation
                if (seriesData['sds_1'] && seriesData['sds_1']['s']) {
                    const d1Candles = seriesData['sds_1']['s'];
                    if (d1Candles.length > 0) {
                        const parsedD1 = d1Candles.map(c => ({
                            time: c.v[0],
                            open: c.v[1],
                            high: c.v[2],
                            low: c.v[3],
                            close: c.v[4],
                            volume: c.v[5]
                        }));

                        // Accumulate D1 historical candles before initial package sent
                        if (!data.initialSent) {
                            data.historicalCandles.push(...parsedD1);
                        }

                        // Always update last candle and emit tick for live price
                        const latest = parsedD1[parsedD1.length - 1];
                        data.lastCandle = latest;

                        this.healthMonitor.recordTick();

                        this.emit('tick', {
                            type: 'tick',
                            source: 'tradingview',
                            symbol,
                            price: latest.close,
                            current: latest.close,
                            timestamp: Date.now()
                        });
                    }
                }
                break;
            }

            if (data.m1ChartSession === chartSession) {
                // Handle M1 candles (sds_2) for Market Profile TPO calculation
                if (seriesData['sds_2'] && seriesData['sds_2']['s']) {
                    const m1Candles = seriesData['sds_2']['s'];
                    if (m1Candles.length > 0) {
                        const parsedM1 = m1Candles.map(c => ({
                            time: c.v[0],
                            open: c.v[1],
                            high: c.v[2],
                            low: c.v[3],
                            close: c.v[4],
                            volume: c.v[5]
                        }));

                        // Enforce hard cap of 1500 M1 candles
                        const M1_HARD_CAP = 1500;
                        if (parsedM1.length > M1_HARD_CAP) {
                            console.warn(`[TradingView] M1 candle count ${parsedM1.length} exceeds hard cap ${M1_HARD_CAP} for ${symbol} - truncating`);
                            parsedM1.length = M1_HARD_CAP;
                        }

                        // Accumulate M1 candles before initial package sent
                        if (!data.initialSent) {
                            data.m1Candles.push(...parsedM1);
                        }

                        console.log(`[TradingView] Accumulated ${data.m1Candles.length} M1 candles for ${symbol}`);
                    }
                }
                break;
            }
        }
    }

    handleSeriesCompleted(params) {
        // params: [chartSession, 's0', symbolToken]
        // TradingView API fires this event ONCE per series when historical load completes
        // Sessions complete independently; must track both before emitting data package
        const chartSession = params[0];
        const seriesToken = params[1];  // 's0' is the series identifier

        for (const [symbol, data] of this.subscriptions.entries()) {
            // Match against EITHER d1ChartSession or m1ChartSession
            if (data.d1ChartSession === chartSession && !data.initialSent) {
                // D1 session completed
                // Validate candle count > 0; empty series indicates API error
                if (data.historicalCandles.length > 0 && !data.d1Complete) {
                    data.d1Complete = true;
                    console.log(`[TradingView] D1 series complete for ${symbol}`);
                } else if (data.historicalCandles.length === 0 && !data.d1Complete) {
                    console.error(`[TradingView] D1 series completed with zero candles for ${symbol}`);
                    this.emit('error', new Error(`D1 series empty for ${symbol}`));
                    return;
                }

                // Both D1 and M1 required before emission
                if (data.d1Complete && data.m1Complete) {
                    this.emitDataPackage(symbol, data);
                }
                break;
            }

            if (data.m1ChartSession === chartSession && !data.initialSent) {
                // M1 session completed
                if (data.m1Candles.length > 0 && !data.m1Complete) {
                    data.m1Complete = true;
                    console.log(`[TradingView] M1 series complete for ${symbol} (${data.m1Candles.length} candles)`);
                } else if (data.m1Candles.length === 0 && !data.m1Complete) {
                    console.error(`[TradingView] M1 series completed with zero candles for ${symbol}`);
                    this.emit('error', new Error(`M1 series empty for ${symbol}`));
                    return;
                }

                // Both D1 and M1 required before emission
                if (data.d1Complete && data.m1Complete) {
                    this.emitDataPackage(symbol, data);
                }
                break;
            }
        }
    }

    emitDataPackage(symbol, data) {
        // Both D1 and M1 required before emission
        // D1 provides ADR calculation; M1 provides Market Profile data
        // Emitting with only one source would produce incomplete visualization
        // Calculate ADR from historical candles (exactly 14 days, matching cTrader)
        const adr = this.calculateAdr(data.historicalCandles, data.lookbackDays || 14);

        // Filter M1 candles to TODAY only (matching cTrader behavior)
        // cTrader uses moment.utc().startOf('day') - session boundary is 00:00 UTC
        const startOfTodayUtc = moment.utc().startOf('day').valueOf();
        const todaysM1Candles = data.m1Candles.filter(bar => {
            const barTimeMs = bar.time * 1000;  // TradingView time is in seconds
            return barTimeMs >= startOfTodayUtc;
        });

        // Use today's actual open from M1 bars (matching cTrader behavior)
        // Falls back to last D1 close if no M1 bars today yet
        const todaysOpen = todaysM1Candles.length > 0 ? todaysM1Candles[0].open : data.lastCandle.close;

        // FIRST PRINCIPLES: Estimate pip data from price for proper bucket alignment
        const pipData = estimatePipData(data.lastCandle.close);

        this.emit('candle', {
            type: 'symbolDataPackage',
            source: 'tradingview',
            symbol,
            open: todaysOpen,  // Today's actual open (matching cTrader)
            high: data.lastCandle.high,
            low: data.lastCandle.low,
            current: data.lastCandle.close,
            pipPosition: pipData.pipPosition,
            pipSize: pipData.pipSize,
            pipetteSize: pipData.pipetteSize,
            projectedAdrHigh: todaysOpen + (adr / 2),  // Centered on today's open
            projectedAdrLow: todaysOpen - (adr / 2),
            initialMarketProfile: todaysM1Candles  // Only today's M1 bars for TPO calculation
        });

        data.initialSent = true;

        // Clear timeout guard; series completed successfully
        if (data.completionTimeout) {
            clearTimeout(data.completionTimeout);
            data.completionTimeout = null;
        }
    }

    async subscribeToSymbol(symbol, lookbackDays = 14) {
        if (!this.client) throw new Error('Not connected');

        // Create SEPARATE chart sessions for D1 and M1
        // TradingView API does NOT support multiple series in a single chart session
        const d1ChartSession = `cs_d1_${randomstring.generate(12)}`;
        const m1ChartSession = `cs_m1_${randomstring.generate(12)}`;
        const amount = lookbackDays + 5; // Extra buffer for partial candles

        console.log(`[TradingView] Subscribing to ${symbol} D1 candles (${amount} days)...`);

        // D1 session for historical ADR and live price
        this.client.send('chart_create_session', [d1ChartSession, '']);
        this.client.send('resolve_symbol', [
            d1ChartSession,
            `sds_sym_${symbol}`,
            '=' + JSON.stringify({ symbol, adjustment: 'splits' })
        ]);
        this.client.send('create_series', [
            d1ChartSession,
            'sds_1',
            's0',
            `sds_sym_${symbol}`,
            '1D',    // Daily timeframe
            amount,  // Number of historical candles
            ''
        ]);

        console.log(`[TradingView] Subscribing to ${symbol} M1 candles (1500 bars)...`);

        // M1 session for Market Profile TPO calculation
        this.client.send('chart_create_session', [m1ChartSession, '']);
        this.client.send('resolve_symbol', [
            m1ChartSession,
            `sds_sym_${symbol}`,
            '=' + JSON.stringify({ symbol, adjustment: 'splits' })
        ]);
        this.client.send('create_series', [
            m1ChartSession,
            'sds_2',
            's0',
            `sds_sym_${symbol}`,
            '1',     // 1-minute timeframe
            1500,   // Buffer for one trading day (~1440 minutes)
            ''
        ]);

        // Store subscription (will populate when series completes)
        this.subscriptions.set(symbol, {
            d1ChartSession,
            m1ChartSession,
            lookbackDays,
            lastCandle: null,
            historicalCandles: [],
            initialSent: false,
            m1Candles: [],           // M1 candles accumulate for TPO calculation
            d1Complete: false,       // Track independently: API fires completion per series
            m1Complete: false,       // Both must be true before emitting data package
            completionTimeout: null  // Timeout guard for incomplete series loading
        });

        // Set timeout guard: emit error if series don't complete within 30 seconds
        const subscription = this.subscriptions.get(symbol);
        const TIMEOUT_MS = 30000;
        subscription.completionTimeout = setTimeout(() => {
            if (!subscription.initialSent) {
                console.error(`[TradingView] Series completion timeout for ${symbol}`);
                this.emit('error', new Error(`Series completion timeout for ${symbol}`));
            }
        }, TIMEOUT_MS);

        console.log(`[TradingView] M1 subscription active for ${symbol}`);
    }

    calculateAdr(candles, lookbackDays = 14) {
        if (candles.length < lookbackDays + 1) return 0;

        // Exclude only the last candle (today's partial), take exactly lookbackDays
        // Matches cTrader: slice(Math.max(0, dailyBars.length - 1 - adrLookbackDays), dailyBars.length - 1)
        const startIndex = Math.max(0, candles.length - 1 - lookbackDays);
        const adrCandles = candles.slice(startIndex, candles.length - 1);

        if (adrCandles.length === 0) return 0;

        const ranges = adrCandles.map(c => c.high - c.low);
        return ranges.reduce((a, b) => a + b, 0) / ranges.length;
    }

    async disconnect() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
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
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
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
        const delay = Math.min(
            this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
            this.maxReconnectDelay
        );
        console.log(`[TradingView] Scheduling reconnect attempt ${this.reconnectAttempts + 1} in ${delay}ms`);
        this.reconnectTimeout = setTimeout(async () => {
            this.reconnectAttempts++;
            try {
                await this.connect(this.sessionId);
            } catch (error) {
                console.error('[TradingView] Reconnect attempt failed:', error);
            }
        }, delay);
    }
}

module.exports = { TradingViewSession };
