/**
 * Chart Configuration Constants
 *
 * Resolution, window, and display constants for the charting system.
 * Resolution maps to cTrader native periods. Q (quarterly) is aggregated
 * from MN1 on the frontend.
 *
 * @module chartConfig
 */

export const RESOLUTIONS = [
  '1m', '5m', '10m', '15m', '30m',
  '1h', '4h', '12h',
  'D', 'W', 'M', 'Q'
];

export const RESOLUTION_LABELS = {
  '1m': '1M', '5m': '5M', '10m': '10M', '15m': '15M', '30m': '30M',
  '1h': '1H', '4h': '4H', '12h': '12H',
  'D': 'Daily', 'W': 'Weekly', 'M': 'Monthly', 'Q': 'Quarterly'
};

export const RESOLUTION_GROUPS = [
  ['1m', '5m', '10m', '15m', '30m'],
  ['1h', '4h', '12h'],
  ['D', 'W', 'M', 'Q']
];

export const TIME_WINDOWS = [
  '1d', '2d', '1W', '2W', '1M', '3M', '6M', '1Y', '2Y', '5Y', '10Y'
];

export const TIME_WINDOW_GROUPS = [
  ['1d', '2d'],
  ['1W', '2W'],
  ['1M', '3M', '6M'],
  ['1Y', '2Y', '5Y', '10Y']
];

export const DEFAULT_RESOLUTION_WINDOW = {
  '1m': '1d', '5m': '2d', '10m': '2d', '15m': '2d', '30m': '1W',
  '1h': '2W', '4h': '3M', '12h': '1Y', 'D': '1Y', 'W': '5Y', 'M': '5Y', 'Q': '10Y'
};

export const RESOLUTION_TO_PERIOD = {
  '1m': 'M1', '5m': 'M5', '10m': 'M10', '15m': 'M15', '30m': 'M30',
  '1h': 'H1', '4h': 'H4', '12h': 'H12',
  'D': 'D1', 'W': 'W1', 'M': 'MN1', 'Q': 'MN1'
};

export const TIMEFRAME_BAR_SPACE = {
  '1m': 2, '5m': 4, '10m': 6, '15m': 8, '30m': 10,
  '1h': 12, '4h': 20, '12h': 32,
  'D': 40, 'W': 48, 'M': 50, 'Q': 50
};

export const PERIOD_RANGE_LIMITS = {
  'M1': 302400000,       // 5 weeks
  'M5': 302400000,       // 5 weeks
  'M10': 21168000000,    // 35 weeks
  'M15': 21168000000,    // 35 weeks
  'M30': 21168000000,    // 35 weeks
  'H1': 21168000000,     // 35 weeks
  'H4': 31622400000,     // 1 year
  'H12': 31622400000,    // 1 year
  'D1': 31622400000,     // 1 year
  'W1': 158112000000,    // 5 years
  'MN1': 158112000000    // 5 years
};

export const CACHE_MAX_BARS = {
  '1m': 260000, '5m': 260000, '10m': 260000, '15m': 260000, '30m': 260000,
  '1h': 50000, '4h': 50000, '12h': 10000,
  'D': 10000, 'W': 10000, 'M': 10000, 'Q': 4000
};

const WINDOW_MS = {
  '1d': 86400000,
  '2d': 172800000,
  '1W': 604800000,
  '2W': 1209600000,
  '1M': 2592000000,
  '3M': 7776000000,
  '6M': 15552000000,
  '1Y': 31536000000,
  '2Y': 63072000000,
  '5Y': 157680000000,
  '10Y': 315360000000
};

export function windowToMs(windowStr) {
  return WINDOW_MS[windowStr] ?? WINDOW_MS['3M'];
}

export function resolutionToPeriod(resolution) {
  return RESOLUTION_TO_PERIOD[resolution] ?? null;
}

export const RESOLUTION_MS = {
  '1m': 60000, '5m': 300000, '10m': 600000, '15m': 900000, '30m': 1800000,
  '1h': 3600000, '4h': 14400000, '12h': 43200000,
  'D': 86400000, 'W': 604800000, 'M': 2592000000, 'Q': 7776000000
};

/**
 * Calculate barSpace so the window's candles fit the container width.
 * Clamped to KLineChart limits (1–50). Returns fallback if container too small.
 */
export function calcBarSpace(resolution, window, containerWidth) {
  const numCandles = windowToMs(window) / RESOLUTION_MS[resolution];
  if (!numCandles || !containerWidth || containerWidth <= 0) return TIMEFRAME_BAR_SPACE[resolution] || 10;
  return Math.max(1, Math.min(50, Math.floor(containerWidth / numCandles)));
}
