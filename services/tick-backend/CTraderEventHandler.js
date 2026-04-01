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
     * Process trendbar (M1 bar) event.
     */
    processTrendbarEvent(event, symbolName, symbolInfo) {
        const latestBar = event.trendbar[event.trendbar.length - 1];
        const closePriceRaw = Number(latestBar.low) + Number(latestBar.deltaClose);
        const price = this.dataProcessor.calculatePrice(closePriceRaw, symbolInfo.digits);
        const timestamp = latestBar.utcTimestampInMinutes ? Number(latestBar.utcTimestampInMinutes) * 60 * 1000 : Date.now();

        console.log(`[CTraderSession] M1 bar received for ${symbolName}:`, {
            open: this.dataProcessor.calculatePrice(Number(latestBar.low) + Number(latestBar.deltaOpen), symbolInfo.digits),
            high: this.dataProcessor.calculatePrice(Number(latestBar.low) + Number(latestBar.deltaHigh), symbolInfo.digits),
            low: this.dataProcessor.calculatePrice(Number(latestBar.low), symbolInfo.digits),
            close: price,
            timestamp: timestamp
        });

        return {
            m1Bar: {
                symbol: symbolName,
                open: this.dataProcessor.calculatePrice(Number(latestBar.low) + Number(latestBar.deltaOpen), symbolInfo.digits),
                high: this.dataProcessor.calculatePrice(Number(latestBar.low) + Number(latestBar.deltaHigh), symbolInfo.digits),
                low: this.dataProcessor.calculatePrice(Number(latestBar.low), symbolInfo.digits),
                close: price,
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
     * Process trendbar event for multi-timeframe subscriptions.
     * Returns bar data including period/timeframe information.
     * @param {Object} event - cTrader spot event with trendbar data
     * @param {string} symbolName - Symbol name
     * @param {Object} symbolInfo - Symbol info with digits, pip info
     * @param {string} period - The subscribed cTrader period (e.g., 'H4', 'D1')
     * @returns {Object|null} Bar data with symbol, period, OHLC, timestamp, or null
     */
    processMultiTimeframeTrendbarEvent(event, symbolName, symbolInfo, period) {
        if (!event.trendbar || event.trendbar.length === 0) return null;

        const latestBar = event.trendbar[event.trendbar.length - 1];
        const low = Number(latestBar.low);
        const deltaOpen = Number(latestBar.deltaOpen);
        const deltaHigh = Number(latestBar.deltaHigh);
        const deltaClose = Number(latestBar.deltaClose);
        const timestamp = latestBar.utcTimestampInMinutes ? Number(latestBar.utcTimestampInMinutes) * 60 * 1000 : Date.now();

        return {
            symbol: symbolName,
            timeframe: period,
            bar: {
                open: this.dataProcessor.calculatePrice(low + deltaOpen, symbolInfo.digits),
                high: this.dataProcessor.calculatePrice(low + deltaHigh, symbolInfo.digits),
                low: this.dataProcessor.calculatePrice(low, symbolInfo.digits),
                close: this.dataProcessor.calculatePrice(low + deltaClose, symbolInfo.digits),
                volume: latestBar.volume || 0,
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
