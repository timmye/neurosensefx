/**
 * MessageBuilder - Utility for consistent message construction
 * Centralizes conditional field inclusion pattern
 */

/**
 * Conditionally include a field in message object
 * @param {Object} message - Message object to modify
 * @param {string} field - Field name
 * @param {*} value - Field value
 * @returns {Object} Message with field added if value is defined
 */
function includeField(message, field, value) {
    if (value !== undefined) {
        message[field] = value;
    }
    return message;
}

/**
 * Build cTrader tick message
 * @param {Object} tick - cTrader tick data
 * @returns {Object} Formatted message for clients
 */
function buildCTraderMessage(tick) {
    const message = {
        type: 'tick',
        source: 'ctrader',
        ...tick
    };

    includeField(message, 'prevDayOpen', tick.prevDayOpen);
    includeField(message, 'prevDayHigh', tick.prevDayHigh);
    includeField(message, 'prevDayLow', tick.prevDayLow);
    includeField(message, 'prevDayClose', tick.prevDayClose);

    return message;
}

/**
 * Build TradingView candle message
 * @param {Object} candle - TradingView candle data
 * @returns {Object} Formatted message for clients
 */
function buildTradingViewMessage(candle) {
    const price = candle.price || candle.current;

    const message = {
        type: candle.type || 'tick',
        source: 'tradingview',
        symbol: candle.symbol,
        price: price,
        timestamp: candle.timestamp
    };

    includeField(message, 'open', candle.open);
    includeField(message, 'high', candle.high);
    includeField(message, 'low', candle.low);
    includeField(message, 'projectedAdrHigh', candle.projectedAdrHigh);
    includeField(message, 'projectedAdrLow', candle.projectedAdrLow);
    includeField(message, 'pipPosition', candle.pipPosition);
    includeField(message, 'pipSize', candle.pipSize);
    includeField(message, 'current', candle.current);
    includeField(message, 'initialMarketProfile', candle.initialMarketProfile);
    includeField(message, 'prevDayOpen', candle.prevDayOpen);
    includeField(message, 'prevDayHigh', candle.prevDayHigh);
    includeField(message, 'prevDayLow', candle.prevDayLow);
    includeField(message, 'prevDayClose', candle.prevDayClose);
    includeField(message, 'bucketSize', candle.bucketSize);

    return message;
}

module.exports = {
    buildCTraderMessage,
    buildTradingViewMessage,
    includeField
};
