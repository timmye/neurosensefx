/**
 * CTrader Event Handler - Event processing for cTrader spot events.
 * Extracted from CTraderSession for single responsibility.
 */

const { barToOHLC } = require('./CTraderDataProcessor');

class CTraderEventHandler {
    constructor(dataProcessor, healthMonitor) {
        this.dataProcessor = dataProcessor;
        this.healthMonitor = healthMonitor;
    }

    /**
     * Process a single trendbar (M1 bar) entry directly.
     * @param {Object} tb - Single trendbar entry
     * @param {string} symbolName - Symbol name
     * @param {Object} symbolInfo - Symbol info with digits, pip info
     * @returns {Object} Object with m1Bar and tick data
     */
    processTrendbarEntry(tb, symbolName, symbolInfo) {
        const closePriceRaw = Number(tb.low) + Number(tb.deltaClose);
        const price = this.dataProcessor.calculatePrice(closePriceRaw, symbolInfo.digits);
        const timestamp = tb.utcTimestampInMinutes ? Number(tb.utcTimestampInMinutes) * 60 * 1000 : Date.now();

        const ohlc = barToOHLC(tb, symbolInfo.digits, this.dataProcessor.calculatePrice.bind(this.dataProcessor));
        return {
            m1Bar: {
                symbol: symbolName,
                ...ohlc,
                timestamp: ohlc.timestamp || timestamp,
            },
            tick: {
                symbol: symbolName,
                price: price,
                timestamp: timestamp,
                pipPosition: symbolInfo.pipPosition,
                pipSize: symbolInfo.pipSize,
                pipetteSize: symbolInfo.pipetteSize,
            }
        };
    }

    /**
     * Process a single trendbar entry for multi-timeframe subscriptions.
     * @param {Object} tb - Single trendbar entry
     * @param {string} symbolName - Symbol name
     * @param {Object} symbolInfo - Symbol info with digits, pip info
     * @param {string} period - The subscribed cTrader period (e.g., 'H4', 'D1')
     * @returns {Object|null} Bar data with symbol, period, OHLC, timestamp, or null
     */
    processMultiTimeframeTrendbarEntry(tb, symbolName, symbolInfo, period) {
        if (!tb) return null;
        const timestamp = tb.utcTimestampInMinutes ? Number(tb.utcTimestampInMinutes) * 60 * 1000 : Date.now();
        const ohlc = barToOHLC(tb, symbolInfo.digits, this.dataProcessor.calculatePrice.bind(this.dataProcessor));

        return {
            symbol: symbolName,
            timeframe: period,
            bar: {
                ...ohlc,
                timestamp: ohlc.timestamp || timestamp,
            }
        };
    }

    /**
     * Process spot (bid/ask) event.
     */
    processSpotEvent(event, symbolName, symbolInfo) {
        const bidRaw = Number(event.bid);
        const askRaw = Number(event.ask);
        const timestamp = event.timestamp ? Number(event.timestamp) : Date.now();

        if (!isFinite(bidRaw) || !isFinite(askRaw) || bidRaw <= 0 || askRaw <= 0) {
            return null;
        }

        const bidPrice = this.dataProcessor.calculatePrice(bidRaw, symbolInfo.digits);
        const askPrice = this.dataProcessor.calculatePrice(askRaw, symbolInfo.digits);

        if (askPrice <= bidPrice) {
            return null;
        }

        return {
            symbol: symbolName,
            bid: bidPrice,
            ask: askPrice,
            price: (bidPrice + askPrice) / 2,
            timestamp: timestamp,
            pipPosition: symbolInfo.pipPosition,
            pipSize: symbolInfo.pipSize,
            pipetteSize: symbolInfo.pipetteSize,
        };
    }
}

module.exports = { CTraderEventHandler };
