/**
 * TradingView Candle Handler - Candle processing logic.
 * Extracted from TradingViewSession for single responsibility.
 */
const { TradingViewDataPackageBuilder } = require('./TradingViewDataPackageBuilder');

class TradingViewCandleHandler {
    constructor(healthMonitor, calculateBucketSizeForSymbol) {
        this.healthMonitor = healthMonitor;
        this.packageBuilder = new TradingViewDataPackageBuilder(calculateBucketSizeForSymbol);
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

        this.emitTickFromCandle(data.lastCandle, symbol);
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

        if (!data.initialSent) {
            data.m1Candles.push(...parsedM1);
        }

        const latest = parsedM1[parsedM1.length - 1];
        this.emit('m1Bar', {
            symbol,
            open: latest.open,
            high: latest.high,
            low: latest.low,
            close: latest.close,
            timestamp: latest.time * 1000
        });

        console.log(`[TradingView] Accumulated ${data.m1Candles.length} M1 candles for ${symbol}`);
    }

    /**
     * Emit tick event from latest candle close price.
     */
    emitTickFromCandle(latest, symbol) {
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

        emitFn('candle', dataPackage);
        this.packageBuilder.markDataPackageSent(data);
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
