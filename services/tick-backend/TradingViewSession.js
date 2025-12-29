const EventEmitter = require('events');
const { connect } = require('tradingview-ws');
const randomstring = require('randomstring');

class TradingViewSession extends EventEmitter {
    constructor() {
        super();
        this.client = null;
        this.sessionId = null;
        this.subscriptions = new Map(); // symbol -> { chartSession, adr, lastCandle }
        this.unsubscribe = null;
    }

    async connect(sessionId) {
        this.sessionId = sessionId;

        try {
            const options = sessionId ? { sessionId } : {};
            this.client = await connect(options);

            this.unsubscribe = this.client.subscribe((event) => {
                this.handleEvent(event);
            });

            console.log('[TradingView] Connected');
            this.emit('connected');

        } catch (error) {
            console.error('[TradingView] Connection failed:', error.message);
            this.emit('error', error);
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
        // params: [chartSession, { sds_1: { s: [candles] } }]
        if (!params || !params[1] || !params[1]['sds_1'] || !params[1]['sds_1']['s']) return;

        const chartSession = params[0];
        const candles = params[1]['sds_1']['s'];
        if (candles.length === 0) return;

        // Find which symbol this is for
        for (const [symbol, data] of this.subscriptions.entries()) {
            if (data.chartSession === chartSession) {
                // Parse all candles in this batch
                const parsedCandles = candles.map(c => ({
                    time: c.v[0],
                    open: c.v[1],
                    high: c.v[2],
                    low: c.v[3],
                    close: c.v[4],
                    volume: c.v[5]
                }));

                // If initial package not sent yet, accumulate historical candles
                if (!data.initialSent) {
                    data.historicalCandles.push(...parsedCandles);
                }

                // Always update last candle and emit tick for live price
                const latest = parsedCandles[parsedCandles.length - 1];
                data.lastCandle = latest;

                this.emit('tick', {
                    type: 'tick',
                    source: 'tradingview',
                    symbol,
                    price: latest.close,
                    current: latest.close,
                    timestamp: Date.now()
                });
                break;
            }
        }
    }

    handleSeriesCompleted(params) {
        // params: [chartSession, 's0', symbolToken]
        const chartSession = params[0];

        for (const [symbol, data] of this.subscriptions.entries()) {
            if (data.chartSession === chartSession && !data.initialSent) {
                // Calculate ADR from historical candles and send initial package
                const adr = this.calculateAdr(data.historicalCandles);

                this.emit('candle', {
                    type: 'symbolDataPackage',
                    source: 'tradingview',
                    symbol,
                    open: data.lastCandle.open,
                    high: data.lastCandle.high,
                    low: data.lastCandle.low,
                    current: data.lastCandle.close,
                    adrHigh: data.lastCandle.open + (adr / 2),
                    adrLow: data.lastCandle.open - (adr / 2)
                });

                data.initialSent = true;
                console.log(`[TradingView] Initial data package sent for ${symbol}`);
                break;
            }
        }
    }

    async subscribeToSymbol(symbol, lookbackDays = 14) {
        if (!this.client) throw new Error('Not connected');

        const chartSession = `cs_${randomstring.generate(12)}`;
        const amount = lookbackDays + 5; // Extra buffer for partial candles

        console.log(`[TradingView] Subscribing to ${symbol} D1 candles (${amount} days)...`);

        // Create D1 chart session for both historical ADR and live price
        this.client.send('chart_create_session', [chartSession, '']);
        this.client.send('resolve_symbol', [
            chartSession,
            `sds_sym_${symbol}`,
            '=' + JSON.stringify({ symbol, adjustment: 'splits' })
        ]);
        this.client.send('create_series', [
            chartSession,
            'sds_1',
            's0',
            `sds_sym_${symbol}`,
            '1D',    // Daily timeframe
            amount,  // Number of historical candles
            ''
        ]);

        // Store subscription (will populate when series completes)
        this.subscriptions.set(symbol, {
            chartSession,
            adr: null,
            lastCandle: null,
            historicalCandles: [],
            initialSent: false
        });

        console.log(`[TradingView] D1 subscription active for ${symbol}`);
    }

    calculateAdr(candles) {
        if (candles.length < 3) return 0;

        // Exclude first and last (partial candles) for ADR
        const completeCandles = candles.slice(1, -1);
        if (completeCandles.length === 0) return 0;

        const ranges = completeCandles.map(c => c.high - c.low);
        return ranges.reduce((a, b) => a + b, 0) / ranges.length;
    }

    async disconnect() {
        if (this.client) {
            if (this.unsubscribe) this.unsubscribe();
            await this.client.close();
            this.client = null;
        }
        this.subscriptions.clear();
    }
}

module.exports = { TradingViewSession };
