/**
 * Chart Configuration Constants
 *
 * Resolution, window, and display constants for the charting system.
 * Resolution maps to cTrader native periods.
 *
 * @module chartConfig
 */

export const RESOLUTION_LABELS = {
  '1m': '1M', '5m': '5M', '10m': '10M', '15m': '15M', '30m': '30M',
  '1h': '1H', '4h': '4H', '12h': '12H',
  'D': 'Daily', 'W': 'Weekly', 'M': 'Monthly'
};

export const RESOLUTION_GROUPS = [
  ['1m', '5m', '10m', '15m', '30m'],
  ['1h', '4h', '12h'],
  ['D', 'W', 'M']
];

export const TIME_WINDOW_GROUPS = [
  ['1d', '2d'],
  ['1W', '2W'],
  ['1M', '3M', '6M'],
  ['1Y', '2Y', '5Y', '10Y']
];

export const DEFAULT_RESOLUTION_WINDOW = {
  '1m': '1d', '5m': '2d', '10m': '2d', '15m': '2d', '30m': '1W',
  '1h': '2W', '4h': '3M', '12h': '6M', 'D': '1Y', 'W': '5Y', 'M': '10Y'
};

const RESOLUTION_TO_PERIOD = {
  '1m': 'M1', '5m': 'M5', '10m': 'M10', '15m': 'M15', '30m': 'M30',
  '1h': 'H1', '4h': 'H4', '12h': 'H12',
  'D': 'D1', 'W': 'W1', 'M': 'MN1'
};

export const TIMEFRAME_BAR_SPACE = {
  '1m': 4, '5m': 4, '10m': 6, '15m': 8, '30m': 10,
  '1h': 12, '4h': 20, '12h': 32,
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
  'H12': 31622400000,    // 1 year
  'D1': 31622400000,     // 1 year
  'W1': 158112000000,    // 5 years
  'MN1': 158112000000    // 5 years
};

export const CACHE_MAX_BARS = {
  '1m': 260000, '5m': 260000, '10m': 260000, '15m': 260000, '30m': 260000,
  '1h': 50000, '4h': 50000, '12h': 10000,
  'D': 10000, 'W': 10000, 'M': 10000
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

// ---------------------------------------------------------------------------
// Calendar-aligned window ranges (trader view)
// ---------------------------------------------------------------------------

function parseWindowString(windowStr) {
  const match = windowStr.match(/^(\d+)(d|W|M|Y)$/);
  if (!match) return { count: 3, unit: 'M' };
  return { count: parseInt(match[1], 10), unit: match[2] };
}

function alignWeekRange(now, count) {
  const dayOfWeek = now.getUTCDay(); // 0=Sun
  const daysSinceMonday = (dayOfWeek + 6) % 7; // Mon=0 .. Sun=6
  return Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - daysSinceMonday - (count * 7),
    0, 0, 0, 0
  );
}

function alignMonthRange(now, count) {
  let targetMonth = now.getUTCMonth() - count;
  let targetYear = now.getUTCFullYear();
  while (targetMonth < 0) {
    targetMonth += 12;
    targetYear--;
  }
  return Date.UTC(targetYear, targetMonth, 1, 0, 0, 0, 0);
}

function alignYearRange(now, count) {
  if (count === 1) {
    // Quarter alignment: snap to current quarter start, go back 4 quarters
    const currentMonth = now.getUTCMonth();
    const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
    let targetMonth = quarterStartMonth - 12;
    let targetYear = now.getUTCFullYear();
    while (targetMonth < 0) {
      targetMonth += 12;
      targetYear--;
    }
    return Date.UTC(targetYear, targetMonth, 1, 0, 0, 0, 0);
  }
  return Date.UTC(now.getUTCFullYear() - count, 0, 1, 0, 0, 0, 0);
}

/**
 * Compute a calendar-aligned time range for the given window.
 *
 * Returns { from, to } where:
 *   to   = Date.now()
 *   from = start of the (count + extraPeriods)th historical period
 *         before the current period's snap boundary
 *
 * Day windows ('1d', '2d') remain rolling.
 * Week windows snap to Monday UTC.
 * Month windows snap to 1st of month UTC.
 * Year windows: 1Y snaps to quarter starts, multi-year to Jan 1 UTC.
 */
export function getCalendarAlignedRange(windowStr, extraPeriods = 1) {
  const to = Date.now();

  // Day windows stay rolling
  if (windowStr === '1d' || windowStr === '2d') {
    const windowMs = WINDOW_MS[windowStr] ?? WINDOW_MS['1d'];
    return { from: to - windowMs * 2, to };
  }

  const now = new Date(to);
  const { count, unit } = parseWindowString(windowStr);

  let from;
  if (unit === 'W') {
    from = alignWeekRange(now, count + extraPeriods);
  } else if (unit === 'M') {
    from = alignMonthRange(now, count + extraPeriods);
  } else if (unit === 'Y') {
    // For years, compute the aligned start for the window count first,
    // then extend back by one additional unit for scroll buffer
    from = alignYearRange(now, count);
    if (extraPeriods > 0) {
      // Go back one more year for buffer
      const fromExtra = alignYearRange(new Date(from), 1);
      from = fromExtra;
    }
  } else {
    // Fallback to rolling
    const windowMs = WINDOW_MS[windowStr] ?? WINDOW_MS['3M'];
    from = to - windowMs * 2;
  }

  return { from, to };
}

export function resolutionToPeriod(resolution) {
  return RESOLUTION_TO_PERIOD[resolution] ?? null;
}

export const RESOLUTION_MS = {
  '1m': 60000, '5m': 300000, '10m': 600000, '15m': 900000, '30m': 1800000,
  '1h': 3600000, '4h': 14400000, '12h': 43200000,
  'D': 86400000, 'W': 604800000, 'M': 2592000000
};

/**
 * Calculate barSpace so the window's candles fit the container width.
 * Clamped to KLineChart limits (1–50). Returns fallback if container too small.
 */
export function calcBarSpace(resolution, window, containerWidth) {
  const numCandles = windowToMs(window) / RESOLUTION_MS[resolution];
  if (!numCandles || !containerWidth || containerWidth <= 0) return TIMEFRAME_BAR_SPACE[resolution] || 10;
  return Math.max(3, Math.min(50, containerWidth / numCandles));
}

// ---------------------------------------------------------------------------
// Time axis label tiers and calendar boundary timestamps
// ---------------------------------------------------------------------------

export const WINDOW_TIER = {
  '1d': 'INTRADAY', '2d': 'INTRADAY',
  '1W': 'DAILY', '2W': 'DAILY',
  '1M': 'WEEKLY',
  '3M': 'MONTHLY', '6M': 'MONTHLY',
  '1Y': 'QUARTERLY',
  '2Y': 'YEARLY', '5Y': 'YEARLY', '10Y': 'YEARLY'
};

export function getWindowTier(windowStr) {
  return WINDOW_TIER[windowStr] ?? 'MONTHLY';
}

// ---------------------------------------------------------------------------
// Calendar-aware X-axis tick configuration
// ---------------------------------------------------------------------------

// TICK_INTERVALS — 14 entries from 1MIN to YEAR
export const TICK_INTERVALS = [
  { name: '1MIN',    durationMs: 60_000,      rule: 'roundMinute' },
  { name: '5MIN',    durationMs: 300_000,     rule: 'roundMinute5' },
  { name: '15MIN',   durationMs: 900_000,     rule: 'roundMinute15' },
  { name: '30MIN',   durationMs: 1_800_000,   rule: 'roundMinute30' },
  { name: '1HOUR',   durationMs: 3_600_000,   rule: 'roundHour' },
  { name: '2HOUR',   durationMs: 7_200_000,   rule: 'roundHour2' },
  { name: '4HOUR',   durationMs: 14_400_000,  rule: 'roundHour4' },
  { name: '8HOUR',   durationMs: 28_800_000,  rule: 'roundHour8' },
  { name: '12HOUR',  durationMs: 43_200_000,  rule: 'roundHour12' },
  { name: 'DAY',     durationMs: 86_400_000,  rule: 'midnight' },
  { name: 'WEEK',    durationMs: 604_800_000, rule: 'weekStart' },
  { name: 'MONTH',   durationMs: null,        rule: 'monthStart', calendar: true },
  { name: 'QUARTER', durationMs: null,        rule: 'quarterStart', calendar: true },
  { name: 'YEAR',    durationMs: null,        rule: 'yearStart', calendar: true }
];

// RESOLUTION_FLOOR — map of 11 resolutions to minimum interval names (legacy)
export const RESOLUTION_FLOOR = {
  '1m': '1MIN', '5m': '5MIN', '10m': '5MIN', '15m': '15MIN',
  '30m': '30MIN', '1h': '1HOUR', '4h': '1HOUR',
  '12h': '4HOUR', 'D': 'DAY', 'W': 'WEEK', 'M': 'MONTH'
};

// ---------------------------------------------------------------------------
// Transition matrix — hardcoded per-window x-axis hierarchy
//
// Each window maps to an ordered list of calendar levels (coarse → fine).
// Last entry = finest level (most ticks, acts as fill).
// Higher-order transitions always fire when their boundary falls in range.
// ---------------------------------------------------------------------------

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
