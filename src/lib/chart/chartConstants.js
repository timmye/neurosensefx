/**
 * Chart Configuration Constants
 *
 * Resolution, window, and display constants for the charting system.
 * Resolution maps to cTrader native periods.
 *
 * @module chartConstants
 */

export const RESOLUTION_LABELS = {
  '1m': '1M', '5m': '5M', '10m': '10M', '15m': '15M', '30m': '30M',
  '1h': '1H', '4h': '4H',
  'D': 'Daily', 'W': 'Weekly', 'M': 'Monthly'
};

export const RESOLUTION_GROUPS = [
  ['1m', '5m', '10m', '15m', '30m'],
  ['1h', '4h'],
  ['D', 'W', 'M']
];

export const TIME_WINDOW_GROUPS = [
  ['1d', '2d'],
  ['1W', '2W'],
  ['1M', '3M', '6M'],
  ['1Y', '2Y', '5Y', '10Y']
];

export const DEFAULT_RESOLUTION_WINDOW = {
  // --- INTRADAY (Floored at 1d Session View) ---
  '1m': '1d',
  '5m': '2d',
  '10m': '2d',
  '15m': '1W',
  '30m': '2W',

  // --- SWING / POSITION (Your Anchors) ---
  '1h': '1M',
  '4h': '3M',

  // --- MACRO (Smooth zoom out) ---
  'D': '1Y',
  'W': '5Y',
  'M': '10Y'
};

export const RESOLUTION_TO_PERIOD = {
  '1m': 'M1', '5m': 'M5', '10m': 'M10', '15m': 'M15', '30m': 'M30',
  '1h': 'H1', '4h': 'H4',
  'D': 'D1', 'W': 'W1', 'M': 'MN1'
};

export const TIMEFRAME_BAR_SPACE = {
  '1m': 4, '5m': 4, '10m': 6, '15m': 8, '30m': 10,
  '1h': 12, '4h': 20,
  'D': 40, 'W': 48, 'M': 50
};

export const PERIOD_RANGE_LIMITS = {
  'M1': 302400000,       // 5 weeks
  'M5': 302400000,       // 5 weeks
  'M10': 21168000000,    // 35 weeks
  'M15': 21168000000,    // 35 weeks
  'M30': 21168000000,    // 35 weeks
  'H1': 21168000000,     // 35 weeks
  'H4': 31622400000,     // 1 year
  'D1': 31622400000,     // 1 year
  'W1': 158112000000,    // 5 years
  'MN1': 158112000000    // 5 years
};

export const CACHE_MAX_BARS = {
  '1m': 260000, '5m': 260000, '10m': 260000, '15m': 260000, '30m': 260000,
  '1h': 50000, '4h': 50000,
  'D': 10000, 'W': 10000, 'M': 10000
};

export const RESOLUTION_MS = {
  '1m': 60000, '5m': 300000, '10m': 600000, '15m': 900000, '30m': 1800000,
  '1h': 3600000, '4h': 14400000,
  'D': 86400000, 'W': 604800000, 'M': 2592000000
};

export const WINDOW_TIER = {
  '1d': 'INTRADAY', '2d': 'INTRADAY',
  '1W': 'DAILY', '2W': 'DAILY',
  '1M': 'WEEKLY',
  '3M': 'MONTHLY', '6M': 'MONTHLY',
  '1Y': 'QUARTERLY',
  '2Y': 'YEARLY', '5Y': 'YEARLY', '10Y': 'YEARLY'
};

export const TRANSITION_MATRIX = {
  '1d':  ['YEAR', 'QUARTER', 'MONTH', 'DAY', 'HOUR'],
  '2d':  ['YEAR', 'QUARTER', 'MONTH', 'DAY', 'HOUR'],
  '1W':  ['YEAR', 'QUARTER', 'MONTH', 'WEEK', 'DAY'],
  '2W':  ['YEAR', 'QUARTER', 'MONTH', 'WEEK', 'DAY'],
  '1M':  ['YEAR', 'QUARTER', 'MONTH', 'WEEK', 'DAY'],
  '3M':  ['YEAR', 'QUARTER', 'MONTH', 'WEEK'],
  '6M':  ['YEAR', 'QUARTER', 'MONTH', 'WEEK'],
  '1Y':  ['YEAR', 'QUARTER', 'MONTH'],
  '2Y':  ['YEAR', 'QUARTER', 'MONTH'],
  '5Y':  ['YEAR', 'QUARTER'],
  '10Y': ['YEAR', 'QUARTER'],
};

export function resolutionToPeriod(resolution) {
  return RESOLUTION_TO_PERIOD[resolution] ?? null;
}

export function getWindowTier(windowStr) {
  return WINDOW_TIER[windowStr] ?? 'MONTHLY';
}
