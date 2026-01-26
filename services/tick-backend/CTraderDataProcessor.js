/**
 * CTrader Data Processor - Data processing and calculations.
 * Extracted from CTraderSession for single responsibility.
 */

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
