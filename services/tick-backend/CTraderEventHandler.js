/**
 * CTrader Event Handler - Event processing for cTrader spot events.
 * Extracted from CTraderSession for single responsibility.
 */

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

        return {
            m1Bar: {
                symbol: symbolName,
                open: this.dataProcessor.calculatePrice(Number(tb.low) + Number(tb.deltaOpen), symbolInfo.digits),
                high: this.dataProcessor.calculatePrice(Number(tb.low) + Number(tb.deltaHigh), symbolInfo.digits),
                low: this.dataProcessor.calculatePrice(Number(tb.low), symbolInfo.digits),
                close: price,
                volume: tb.volume ? Number(tb.volume) : 0,
                timestamp: timestamp
            },
            tick: {
                symbol: symbolName,
                bid: price,
                ask: price,
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
        const low = Number(tb.low);
        const deltaOpen = Number(tb.deltaOpen);
        const deltaHigh = Number(tb.deltaHigh);
        const deltaClose = Number(tb.deltaClose);
        const timestamp = tb.utcTimestampInMinutes ? Number(tb.utcTimestampInMinutes) * 60 * 1000 : Date.now();

        return {
            symbol: symbolName,
            timeframe: period,
            bar: {
                open: this.dataProcessor.calculatePrice(low + deltaOpen, symbolInfo.digits),
                high: this.dataProcessor.calculatePrice(low + deltaHigh, symbolInfo.digits),
                low: this.dataProcessor.calculatePrice(low, symbolInfo.digits),
                close: this.dataProcessor.calculatePrice(low + deltaClose, symbolInfo.digits),
                volume: tb.volume ? Number(tb.volume) : 0,
                timestamp: timestamp
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
            console.log(`[DEBUG_TRACE | CTraderSession] Skipping tick - invalid numeric values: bid=${bidRaw}, ask=${askRaw}`);
            return null;
        }

        const bidPrice = this.dataProcessor.calculatePrice(bidRaw, symbolInfo.digits);
        const askPrice = this.dataProcessor.calculatePrice(askRaw, symbolInfo.digits);

        if (askPrice <= bidPrice) {
            console.log(`[DEBUG_TRACE | CTraderSession] Skipping tick - ask (${askPrice}) <= bid (${bidPrice})`);
            return null;
        }

        return {
            symbol: symbolName,
            bid: bidPrice,
            ask: askPrice,
            timestamp: timestamp,
            pipPosition: symbolInfo.pipPosition,
            pipSize: symbolInfo.pipSize,
            pipetteSize: symbolInfo.pipetteSize,
        };
    }
}

module.exports = { CTraderEventHandler };
