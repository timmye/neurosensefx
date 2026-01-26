/**
 * TradingView Subscription Manager - Manages TradingView chart session subscriptions
 * Handles D1 and M1 chart session creation and lifecycle
 */

class TradingViewSubscriptionManager {
    constructor(client) {
        this.client = client;
    }

    /**
     * Create D1 (daily) chart session for symbol
     * @param {string} symbol - Symbol identifier
     * @param {string} d1ChartSession - Chart session ID
     * @param {number} lookbackDays - Number of days to fetch
     */
    createD1Session(symbol, d1ChartSession, lookbackDays) {
        const amount = lookbackDays + 5;
        console.log(`[TradingView] Subscribing to ${symbol} D1 candles (${amount} days)...`);

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
            '1D',
            amount,
            ''
        ]);
    }

    /**
     * Create M1 (1-minute) chart session for symbol
     * @param {string} symbol - Symbol identifier
     * @param {string} m1ChartSession - Chart session ID
     */
    createM1Session(symbol, m1ChartSession) {
        console.log(`[TradingView] Subscribing to ${symbol} M1 candles (1500 bars)...`);

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
            '1',
            1500,
            ''
        ]);
    }

    /**
     * Initialize subscription data object
     * @param {string} symbol - Symbol identifier
     * @param {string} d1ChartSession - D1 chart session ID
     * @param {string} m1ChartSession - M1 chart session ID
     * @param {number} lookbackDays - ADR lookback period
     * @returns {Object} Subscription data object
     */
    createSubscriptionData(symbol, d1ChartSession, m1ChartSession, lookbackDays) {
        return {
            d1ChartSession,
            m1ChartSession,
            lookbackDays,
            lastCandle: null,
            historicalCandles: [],
            initialSent: false,
            m1Candles: [],
            d1Complete: false,
            m1Complete: false,
            completionTimeout: null
        };
    }

    /**
     * Set completion timeout for subscription
     * @param {Object} subscription - Subscription data object
     * @param {string} symbol - Symbol identifier
     * @param {Function} onError - Error callback function
     */
    setCompletionTimeout(subscription, symbol, onError) {
        const TIMEOUT_MS = 30000;
        subscription.completionTimeout = setTimeout(() => {
            if (!subscription.initialSent) {
                console.error(`[TradingView] Series completion timeout for ${symbol}`);
                onError(new Error(`Series completion timeout for ${symbol}`));
            }
        }, TIMEOUT_MS);
    }
}

module.exports = { TradingViewSubscriptionManager };
