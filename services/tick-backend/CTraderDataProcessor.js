/**
 * CTrader Data Processor - Data processing and calculations.
 * Extracted from CTraderSession for single responsibility.
 */

// Per-request range limits for cTrader trendbar requests (in milliseconds)
const PERIOD_RANGE_LIMITS = {
    M1:  302400000,      // 5 weeks
    M2:  302400000,
    M3:  302400000,
    M4:  302400000,
    M5:  302400000,
    M10: 21168000000,     // 35 weeks
    M15: 21168000000,
    M30: 21168000000,
    H1:  21168000000,
    H4:  31622400000,     // 1 year
    H12: 31622400000,
    D1:  31622400000,
    W1:  158112000000,    // 5 years
    MN1: 158112000000,
};

class CTraderDataProcessor {
    constructor(connection, ctidTraderAccountId, symbolLoader) {
        this.connection = connection;
        this.ctidTraderAccountId = ctidTraderAccountId;
        this.symbolLoader = symbolLoader;
    }

    /**
     * Calculate actual price from raw cTrader integer value.
     * cTrader stores prices as integers; divide by 100000 and apply digits.
     */
    calculatePrice(rawValue, digits) {
        if (typeof rawValue !== 'number') return 0;
        const price = rawValue / 100000.0;
        return Number(price.toFixed(digits));
    }

    /**
     * Fetch historical bars for daily and intraday timeframes.
     */
    async fetchHistoricalBars(symbolId, fromDaily, fromIntraday, to) {
        const [dailyBarsData, intradayBarsData] = await Promise.all([
            this.connection.sendCommand('ProtoOAGetTrendbarsReq', {
                ctidTraderAccountId: this.ctidTraderAccountId,
                symbolId,
                period: 'D1',
                fromTimestamp: fromDaily,
                toTimestamp: to
            }),
            this.connection.sendCommand('ProtoOAGetTrendbarsReq', {
                ctidTraderAccountId: this.ctidTraderAccountId,
                symbolId,
                period: 'M1',
                fromTimestamp: fromIntraday,
                toTimestamp: to
            })
        ]);
        return { dailyBars: dailyBarsData.trendbar, intradayBars: intradayBarsData.trendbar };
    }

    /**
     * Fetch historical candles for any cTrader-supported period.
     * Automatically chains multiple requests if the requested range exceeds the per-period limit.
     * @param {string} symbolName - Symbol name (e.g., 'EURUSD')
     * @param {string} period - cTrader period string (M1, M5, M10, M15, M30, H1, H4, H12, D1, W1, MN1)
     * @param {number} fromTimestamp - Start timestamp in ms
     * @param {number} toTimestamp - End timestamp in ms
     * @returns {Array} Array of OHLC bar objects sorted by timestamp
     */
    async fetchHistoricalCandles(symbolName, period, fromTimestamp, toTimestamp) {
        const VALID_PERIODS = ['M1', 'M5', 'M10', 'M15', 'M30', 'H1', 'H4', 'H12', 'D1', 'W1', 'MN1'];
        if (!VALID_PERIODS.includes(period)) {
            throw new Error(`Invalid period: ${period}. Must be one of: ${VALID_PERIODS.join(', ')}`);
        }

        const symbolId = this.symbolLoader.getSymbolId(symbolName);
        if (!symbolId) {
            throw new Error(`Symbol not found: ${symbolName}`);
        }

        const rangeLimit = PERIOD_RANGE_LIMITS[period];
        if (!rangeLimit) {
            throw new Error(`No range limit defined for period: ${period}`);
        }

        const symbolInfo = await this.symbolLoader.getFullSymbolInfo(symbolId);
        const digits = symbolInfo.digits;

        // Collect all chunks
        const allBars = [];
        let currentFrom = fromTimestamp;

        while (currentFrom < toTimestamp) {
            // Determine the end of this chunk, respecting the range limit
            const chunkEnd = Math.min(currentFrom + rangeLimit, toTimestamp);

            try {
                const response = await this.connection.sendCommand('ProtoOAGetTrendbarsReq', {
                    ctidTraderAccountId: this.ctidTraderAccountId,
                    symbolId,
                    period,
                    fromTimestamp: currentFrom,
                    toTimestamp: chunkEnd
                });

                if (response && response.trendbar && response.trendbar.length > 0) {
                    const processedBars = response.trendbar.map(bar => {
                        const low = Number(bar.low);
                        return {
                            open: this.calculatePrice(low + Number(bar.deltaOpen), digits),
                            high: this.calculatePrice(low + Number(bar.deltaHigh), digits),
                            low: this.calculatePrice(low, digits),
                            close: this.calculatePrice(low + Number(bar.deltaClose), digits),
                            volume: bar.volume || 0,
                            timestamp: bar.utcTimestampInMinutes ? Number(bar.utcTimestampInMinutes) * 60 * 1000 : null
                        };
                    }).filter(bar => bar.timestamp !== null);

                    allBars.push(...processedBars);
                }

                // If cTrader returned 0 bars for this chunk, we've reached the available history
                if (!response || !response.trendbar || response.trendbar.length === 0) {
                    break;
                }

                // Move to next chunk: start from the last bar's timestamp + 1ms to avoid overlap
                const lastBarTimestamp = allBars[allBars.length - 1].timestamp;
                currentFrom = lastBarTimestamp + 1;
            } catch (error) {
                console.error(`[CTraderDataProcessor] Failed to fetch ${period} bars for ${symbolName} [${currentFrom} - ${chunkEnd}]:`, error.message);
                // Continue to next chunk rather than failing the entire request
                currentFrom = chunkEnd + 1;
            }
        }

        // Sort by timestamp and deduplicate (in case of any overlap)
        allBars.sort((a, b) => a.timestamp - b.timestamp);
        const dedupedBars = [];
        for (let i = 0; i < allBars.length; i++) {
            if (i === 0 || allBars[i].timestamp !== allBars[i - 1].timestamp) {
                dedupedBars.push(allBars[i]);
            }
        }

        console.log(`[CTraderDataProcessor] Fetched ${dedupedBars.length} ${period} bars for ${symbolName}`);
        return dedupedBars;
    }

    /**
     * Calculate Average Daily Range from daily bars.
     */
    calculateADR(dailyBars, lookbackDays, digits) {
        const adrBars = dailyBars.slice(
            Math.max(0, dailyBars.length - 1 - lookbackDays),
            dailyBars.length - 1
        );
        const adrRanges = adrBars.map(bar => this.calculatePrice(Number(bar.deltaHigh) || 0, digits));
        return adrRanges.length > 0 ? adrRanges.reduce((sum, range) => sum + range, 0) / adrRanges.length : 0;
    }

    /**
     * Extract today's OHLC from intraday and daily bars.
     */
    extractTodaysOHLC(intradayBars, dailyBars, digits) {
        let todaysOpen, todaysHigh, todaysLow, initialPrice, initialMarketProfile;

        if (!intradayBars || intradayBars.length === 0) {
            const lastDailyBar = dailyBars[dailyBars.length - 1];
            todaysOpen = this.calculatePrice(Number(lastDailyBar.low) + Number(lastDailyBar.deltaOpen), digits);
            todaysHigh = this.calculatePrice(Number(lastDailyBar.low) + Number(lastDailyBar.deltaHigh), digits);
            todaysLow = this.calculatePrice(Number(lastDailyBar.low), digits);
            initialPrice = this.calculatePrice(Number(lastDailyBar.low) + Number(lastDailyBar.deltaClose), digits);
            initialMarketProfile = [];
        } else {
            const processedM1Bars = intradayBars.map(bar => ({
                open: this.calculatePrice(Number(bar.low) + Number(bar.deltaOpen), digits),
                high: this.calculatePrice(Number(bar.low) + Number(bar.deltaHigh), digits),
                low: this.calculatePrice(Number(bar.low), digits),
                close: this.calculatePrice(Number(bar.low) + Number(bar.deltaClose), digits),
                timestamp: Number(bar.utcTimestampInMinutes) * 60 * 1000
            }));

            todaysOpen = processedM1Bars[0].open;
            todaysHigh = Math.max(...processedM1Bars.map(b => b.high));
            todaysLow = Math.min(...processedM1Bars.map(b => b.low));
            initialPrice = processedM1Bars[processedM1Bars.length - 1].close;
            initialMarketProfile = processedM1Bars;
        }

        return { todaysOpen, todaysHigh, todaysLow, initialPrice, initialMarketProfile };
    }

    /**
     * Get complete symbol data package for initialization.
     * Includes ADR, OHLC, and Market Profile data.
     */
    async getSymbolDataPackage(symbolName, adrLookbackDays = 14) {
        const symbolId = this.symbolLoader.getSymbolId(symbolName);
        if (!symbolId) throw new Error(`Symbol not found in map: ${symbolName}`);

        const symbolInfo = await this.symbolLoader.getFullSymbolInfo(symbolId);
        const { digits } = symbolInfo;

        const moment = require('moment');
        const to = moment.utc().valueOf();
        const fromDaily = moment.utc().subtract(adrLookbackDays + 5, 'days').valueOf();
        const fromIntraday = moment.utc().startOf('day').valueOf();

        const { dailyBars, intradayBars } = await this.fetchHistoricalBars(symbolId, fromDaily, fromIntraday, to);

        if (!dailyBars || dailyBars.length < 2) {
            throw new Error(`Not enough daily bars for ADR calculation on ${symbolName}`);
        }

        const adr = this.calculateADR(dailyBars, adrLookbackDays, digits);

        const previousDay = dailyBars.length >= 2 ? dailyBars[dailyBars.length - 2] : null;
        const prevDayOHLC = previousDay ? {
            open: this.calculatePrice(Number(previousDay.low) + Number(previousDay.deltaOpen), digits),
            high: this.calculatePrice(Number(previousDay.low) + Number(previousDay.deltaHigh), digits),
            low: this.calculatePrice(Number(previousDay.low), digits),
            close: this.calculatePrice(Number(previousDay.low) + Number(previousDay.deltaClose), digits)
        } : null;

        const { todaysOpen, todaysHigh, todaysLow, initialPrice, initialMarketProfile } =
            this.extractTodaysOHLC(intradayBars, dailyBars, digits);

        return {
            symbol: symbolName,
            digits,
            adr,
            todaysOpen,
            todaysHigh,
            todaysLow,
            projectedAdrHigh: todaysOpen + (adr / 2),
            projectedAdrLow: todaysOpen - (adr / 2),
            initialPrice,
            initialMarketProfile,
            pipPosition: symbolInfo.pipPosition,
            pipSize: symbolInfo.pipSize,
            pipetteSize: symbolInfo.pipetteSize,
            ...(prevDayOHLC && { prevDayOpen: prevDayOHLC.open }),
            ...(prevDayOHLC && { prevDayHigh: prevDayOHLC.high }),
            ...(prevDayOHLC && { prevDayLow: prevDayOHLC.low }),
            ...(prevDayOHLC && { prevDayClose: prevDayOHLC.close })
        };
    }
}

module.exports = { CTraderDataProcessor };
