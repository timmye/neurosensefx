/**
 * TradingView Data Package Builder - Builds symbol data packages
 * Extracted from TradingViewCandleHandler for single responsibility
 */

class TradingViewDataPackageBuilder {
    constructor(calculateBucketSizeForSymbol) {
        this.calculateBucketSizeForSymbol = calculateBucketSizeForSymbol;
    }

    /**
     * Filter M1 candles to only include today's candles
     * @param {Array} m1Candles - All M1 candles
     * @returns {Array} Today's M1 candles
     */
    filterTodaysM1Candles(m1Candles) {
        const moment = require('moment');
        const startOfTodayUtc = moment.utc().startOf('day').valueOf();
        return m1Candles.filter(bar => {
            const barTimeMs = bar.time * 1000;
            return barTimeMs >= startOfTodayUtc;
        });
    }

    /**
     * Calculate today's open price from M1 candles or last close
     * @param {Array} todaysM1Candles - Today's M1 candles
     * @param {number} lastClose - Last D1 candle close price
     * @returns {number} Today's open price
     */
    calculateTodaysOpen(todaysM1Candles, lastClose) {
        return todaysM1Candles.length > 0 ? todaysM1Candles[0].open : lastClose;
    }

    /**
     * Extract previous day's candle from historical data
     * @param {Array} historicalCandles - Historical D1 candles
     * @returns {Object|null} Previous day's candle or null
     */
    extractPreviousDay(historicalCandles) {
        return historicalCandles.length >= 2
            ? historicalCandles[historicalCandles.length - 2]
            : null;
    }

    /**
     * Build complete symbol data package for frontend
     * @param {string} symbol - Symbol identifier
     * @param {number} todaysOpen - Today's open price
     * @param {number} adr - Average Daily Range
     * @param {Array} todaysM1Candles - Today's M1 candles
     * @param {Object} previousDay - Previous day's candle
     * @param {Object} lastCandle - Latest D1 candle
     * @param {Function} estimatePipDataFn - Pip estimation function
     * @returns {Object} Complete data package
     */
    buildDataPackage(symbol, todaysOpen, adr, todaysM1Candles, previousDay, lastCandle, estimatePipDataFn) {
        const pipData = estimatePipDataFn(lastCandle.close);
        const bucketSize = this.calculateBucketSizeForSymbol(symbol);

        return {
            type: 'symbolDataPackage',
            source: 'tradingview',
            symbol,
            open: todaysOpen,
            high: lastCandle.high,
            low: lastCandle.low,
            current: lastCandle.close,
            pipPosition: pipData.pipPosition,
            pipSize: pipData.pipSize,
            pipetteSize: pipData.pipetteSize,
            projectedAdrHigh: todaysOpen + (adr / 2),
            projectedAdrLow: todaysOpen - (adr / 2),
            initialMarketProfile: todaysM1Candles,
            bucketSize,
            ...(previousDay?.open !== undefined && { prevDayOpen: previousDay.open }),
            ...(previousDay?.high !== undefined && { prevDayHigh: previousDay.high }),
            ...(previousDay?.low !== undefined && { prevDayLow: previousDay.low }),
            ...(previousDay?.close !== undefined && { prevDayClose: previousDay.close })
        };
    }

    /**
     * Mark data package as sent and clear completion timeout
     * @param {Object} data - Subscription data object
     */
    markDataPackageSent(data) {
        data.initialSent = true;
        if (data.completionTimeout) {
            clearTimeout(data.completionTimeout);
            data.completionTimeout = null;
        }
    }
}

module.exports = { TradingViewDataPackageBuilder };
