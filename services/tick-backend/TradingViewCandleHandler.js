/**
 * TradingView Candle Handler - Candle processing logic.
 * Extracted from TradingViewSession for single responsibility.
 */
const { TradingViewDataPackageBuilder } = require('./TradingViewDataPackageBuilder');

class TradingViewCandleHandler {
    constructor(healthMonitor, calculateBucketSizeForSymbol, twapService = null, marketProfileService = null) {
        this.healthMonitor = healthMonitor;
        this.packageBuilder = new TradingViewDataPackageBuilder(calculateBucketSizeForSymbol);
        this.twapService = twapService;
        this.marketProfileService = marketProfileService;

        // Track current M1 bars being built from tick data
        // TradingView doesn't send real-time M1 updates after series_completed
        this.currentM1Bars = new Map(); // symbol -> { open, high, low, close, minuteTimestamp }
    }

    /**
     * Handle D1 (daily) candle updates.
     */
    handleD1Candles(chartSession, d1Candles, symbol, data) {
        if (!d1Candles || d1Candles.length === 0) return;

        const parsedD1 = d1Candles.map(c => ({
            time: c.v[0],
            open: c.v[1],
            high: c.v[2],
            low: c.v[3],
            close: c.v[4],
            volume: c.v[5]
        }));

        if (!data.initialSent) {
            data.historicalCandles.push(...parsedD1);
        }

        data.lastCandle = parsedD1[parsedD1.length - 1];

        this.emitTickFromCandle(data.lastCandle, symbol, data);
    }

    /**
     * Handle M1 (1-minute) candle updates.
     */
    handleM1Candles(chartSession, m1Candles, symbol, data) {
        if (!m1Candles || m1Candles.length === 0) return;

        const parsedM1 = m1Candles.map(c => ({
            time: c.v[0],
            open: c.v[1],
            high: c.v[2],
            low: c.v[3],
            close: c.v[4],
            volume: c.v[5]
        }));

        const M1_HARD_CAP = 1500;
        if (parsedM1.length > M1_HARD_CAP) {
            console.warn(`[TradingView] M1 candle count ${parsedM1.length} exceeds hard cap ${M1_HARD_CAP} for ${symbol} - truncating`);
            parsedM1.length = M1_HARD_CAP;
        }

        // ALWAYS log when handleM1Candles is called
        console.log(`[TradingView] handleM1Candles called for ${symbol}: ${parsedM1.length} candles, initialSent=${data.initialSent}`);

        if (!data.initialSent) {
            data.m1Candles.push(...parsedM1);
            console.log(`[TradingView] Accumulated ${data.m1Candles.length} M1 candles for ${symbol} (historical)`);
        } else {
            // Real-time update - log diagnostic info
            console.log(`[TradingView] M1 REALTIME UPDATE for ${symbol}: ${parsedM1.length} candles`);
        }

        const latest = parsedM1[parsedM1.length - 1];
        const m1Bar = {
            symbol,
            open: latest.open,
            high: latest.high,
            low: latest.low,
            close: latest.close,
            timestamp: latest.time * 1000
        };

        // Only emit if this looks like new data (not historical)
        if (data.initialSent) {
            console.log(`[TradingView] EMITTING m1Bar for ${symbol}:`, JSON.stringify(m1Bar));
            this.emit('m1Bar', m1Bar);
            // Also emit tick for live ticker stats updates (every minute is better than never)
            this.emitTickFromCandle(latest, symbol, data);
        } else {
            // During historical load, don't emit individual bars
            // They'll be processed in batch via initializeFromHistory
            console.log(`[TradingView] NOT emitting m1Bar (historical load in progress)`);
        }
    }

    /**
     * Emit tick event from latest candle close price.
     */
    emitTickFromCandle(latest, symbol, data = null) {
        this.healthMonitor.recordTick();

        const tick = {
            type: 'tick',
            source: 'tradingview',
            symbol,
            price: latest.close,
            current: latest.close,
            timestamp: Date.now()
        };

        this.emit('tick', tick);

        // Build M1 bars from tick data (TradingView doesn't send real-time M1 updates)
        // Only start building after initial data is sent
        if (data && data.initialSent) {
            this.updateM1BarFromTick(symbol, latest.close);
        }
    }

    /**
     * Calculate Average Daily Range from candles.
     */
    calculateAdr(candles, lookbackDays = 14) {
        if (candles.length < lookbackDays + 1) return 0;

        const startIndex = Math.max(0, candles.length - 1 - lookbackDays);
        const adrCandles = candles.slice(startIndex, candles.length - 1);

        if (adrCandles.length === 0) return 0;

        const ranges = adrCandles.map(c => c.high - c.low);
        return ranges.reduce((a, b) => a + b, 0) / ranges.length;
    }

    /**
     * Emit complete data package when both D1 and M1 series complete.
     */
    emitDataPackage(symbol, data, emitFn, estimatePipDataFn) {
        const adr = this.calculateAdr(data.historicalCandles, data.lookbackDays || 14);
        const todaysM1Candles = this.packageBuilder.filterTodaysM1Candles(data.m1Candles);
        const todaysOpen = this.packageBuilder.calculateTodaysOpen(todaysM1Candles, data.lastCandle.close);
        const previousDay = this.packageBuilder.extractPreviousDay(data.historicalCandles);

        const dataPackage = this.packageBuilder.buildDataPackage(
            symbol, todaysOpen, adr, todaysM1Candles, previousDay, data.lastCandle, estimatePipDataFn
        );

        // Initialize TWAP from historical M1 candles before sending to client
        if (this.twapService && todaysM1Candles.length > 0) {
            try {
                this.twapService.initializeFromHistory(symbol, data.m1Candles, 'tradingview');
            } catch (error) {
                console.error(`[TradingViewCandleHandler] TWAP initialization failed for ${symbol}:`, error);
            }
        }

        // Initialize Market Profile from today's M1 candles before sending to client
        if (this.marketProfileService && todaysM1Candles.length > 0) {
            try {
                const currentPrice = data.lastCandle?.close || todaysM1Candles[todaysM1Candles.length - 1]?.close;
                const bucketSize = this.packageBuilder.calculateBucketSizeForSymbol(symbol, currentPrice);
                this.marketProfileService.initializeFromHistory(symbol, todaysM1Candles, bucketSize, 'tradingview');
            } catch (error) {
                console.error(`[TradingViewCandleHandler] Market Profile initialization failed for ${symbol}:`, error);
            }
        }

        emitFn('candle', dataPackage);
        this.packageBuilder.markDataPackageSent(data);
    }

    /**
     * Update M1 bar from tick data and emit when minute changes.
     * TradingView doesn't send real-time M1 updates after series_completed,
     * so we build M1 bars from tick data.
     * @param {string} symbol - Symbol identifier
     * @param {number} price - Current tick price
     */
    updateM1BarFromTick(symbol, price) {
        console.log(`[TradingView] updateM1BarFromTick called for ${symbol} price=${price}`);
        const now = Date.now();
        const currentMinute = Math.floor(now / 60000) * 60000; // Round down to minute

        const existing = this.currentM1Bars.get(symbol);

        if (existing) {
            if (existing.minuteTimestamp !== currentMinute) {
                // Minute changed - emit the completed bar
                const completedBar = {
                    symbol,
                    open: existing.open,
                    high: existing.high,
                    low: existing.low,
                    close: existing.close,
                    timestamp: existing.minuteTimestamp
                };
                console.log(`[TradingView] M1 bar completed for ${symbol}:`, JSON.stringify(completedBar));
                this.emit('m1Bar', completedBar);

                // Start new bar
                this.currentM1Bars.set(symbol, {
                    open: price,
                    high: price,
                    low: price,
                    close: price,
                    minuteTimestamp: currentMinute
                });
            } else {
                // Same minute - update OHLC
                existing.high = Math.max(existing.high, price);
                existing.low = Math.min(existing.low, price);
                existing.close = price;
            }
        } else {
            // First tick for this symbol
            console.log(`[TradingView] First tick for ${symbol}, starting M1 bar at ${currentMinute}`);
            this.currentM1Bars.set(symbol, {
                open: price,
                high: price,
                low: price,
                close: price,
                minuteTimestamp: currentMinute
            });
        }
    }

    /**
     * Set emitter function for event emission.
     */
    setEmitter(emitFn) {
        this.emit = emitFn;
    }
}

/**
 * Estimate pip data from price magnitude.
 * TradingView doesn't provide pipPosition, so estimate from price.
 */
function estimatePipData(price) {
    if (price > 10000) return { pipPosition: 0, pipSize: 1, pipetteSize: 0.1 };
    if (price > 1000) return { pipPosition: 1, pipSize: 0.1, pipetteSize: 0.01 };
    if (price > 10) return { pipPosition: 2, pipSize: 0.01, pipetteSize: 0.001 };
    return { pipPosition: 4, pipSize: 0.0001, pipetteSize: 0.00001 };
}

module.exports = { TradingViewCandleHandler, estimatePipData };
