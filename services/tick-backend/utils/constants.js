'use strict';

/**
 * Resolution string (used by frontend) to cTrader period string mapping.
 * Shared across WebSocketServer, httpServer, and any module that needs resolution lookup.
 */
const RESOLUTION_TO_PERIOD = Object.freeze({
    '1m': 'M1', '5m': 'M5', '10m': 'M10', '15m': 'M15', '30m': 'M30',
    '1h': 'H1', '4h': 'H4', '12h': 'H12',
    'D': 'D1', 'W': 'W1', 'M': 'MN1'
});

/**
 * Valid cTrader trendbar period strings.
 * Used for input validation in CTraderSession and CTraderDataProcessor.
 */
const VALID_PERIODS = Object.freeze(['M1', 'M5', 'M10', 'M15', 'M30', 'H1', 'H4', 'H12', 'D1', 'W1', 'MN1']);

/**
 * Symbol validation regex — alphanumeric, dots, slashes, underscores, hyphens.
 * Shared across WebSocketServer and persistenceRoutes.
 */
const SYMBOL_RE = /^[A-Za-z0-9./_-]+$/;

module.exports = { RESOLUTION_TO_PERIOD, VALID_PERIODS, SYMBOL_RE };
