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
  '1h': '2W', '4h': '3M', '12h': '1Y', 'D': '1Y', 'W': '5Y', 'M': '5Y'
};

const RESOLUTION_TO_PERIOD = {
  '1m': 'M1', '5m': 'M5', '10m': 'M10', '15m': 'M15', '30m': 'M30',
  '1h': 'H1', '4h': 'H4', '12h': 'H12',
  'D': 'D1', 'W': 'W1', 'M': 'MN1'
};

export const TIMEFRAME_BAR_SPACE = {
  '1m': 2, '5m': 4, '10m': 6, '15m': 8, '30m': 10,
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
  return Math.max(1, Math.min(50, containerWidth / numCandles));
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

function generateDayStarts(from, to, set) {
  let d = new Date(from);
  d.setUTCHours(0, 0, 0, 0);
  while (d.getTime() <= to) {
    if (d.getTime() >= from) set.add(d.getTime());
    d = new Date(d.getTime() + 86400000);
  }
}

function generateMondays(from, to, set) {
  let d = new Date(from);
  d.setUTCHours(0, 0, 0, 0);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + ((1 - dow + 7) % 7));
  while (d.getTime() <= to) {
    if (d.getTime() >= from) set.add(d.getTime());
    d = new Date(d.getTime() + 7 * 86400000);
  }
}

function generateMonthStarts(from, to, set) {
  let d = new Date(from);
  d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  if (d.getTime() < from) d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  while (d.getTime() <= to) {
    if (d.getTime() >= from) set.add(d.getTime());
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  }
}

function generateQuarterStarts(from, to, set) {
  let d = new Date(from);
  const qMonth = Math.floor(d.getUTCMonth() / 3) * 3;
  d = new Date(Date.UTC(d.getUTCFullYear(), qMonth, 1));
  if (d.getTime() < from) d = new Date(Date.UTC(d.getUTCFullYear(), qMonth + 3, 1));
  while (d.getTime() <= to) {
    if (d.getTime() >= from) set.add(d.getTime());
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 3, 1));
  }
}

function generateYearStarts(from, to, set) {
  let year = new Date(from).getUTCFullYear();
  let d = new Date(Date.UTC(year, 0, 1));
  if (d.getTime() < from) d = new Date(Date.UTC(year + 1, 0, 1));
  while (d.getTime() <= to) {
    if (d.getTime() >= from) set.add(d.getTime());
    d = new Date(Date.UTC(d.getUTCFullYear() + 1, 0, 1));
  }
}

/**
 * Generate calendar boundary timestamps within [from, to] for the given window.
 *
 * Boundary types depend on the window tier:
 *   INTRADAY (1d/2d): day starts + month starts + year starts
 *   DAILY    (1W/2W): Mondays + month starts + year starts
 *   WEEKLY   (1M):    Mondays + month starts + year starts
 *   MONTHLY  (3M/6M): month starts + year starts
 *   QUARTERLY (1Y):   quarter starts + year starts
 *   YEARLY   (2Y+):   year starts
 */
export function getCalendarBoundaryTimestamps(from, to, windowStr) {
  const boundaries = new Set();
  const { unit, count } = parseWindowString(windowStr);

  if (windowStr === '1d' || windowStr === '2d') {
    generateDayStarts(from, to, boundaries);
    generateMonthStarts(from, to, boundaries);
    generateYearStarts(from, to, boundaries);
  } else if (unit === 'W') {
    generateMondays(from, to, boundaries);
    generateMonthStarts(from, to, boundaries);
    generateYearStarts(from, to, boundaries);
  } else if (unit === 'M' && count < 6) {
    generateMonthStarts(from, to, boundaries);
    generateYearStarts(from, to, boundaries);
  } else if ((unit === 'M' && count >= 6) || (unit === 'Y' && count === 1)) {
    generateQuarterStarts(from, to, boundaries);
    generateYearStarts(from, to, boundaries);
  } else if (unit === 'Y' && count >= 2) {
    generateYearStarts(from, to, boundaries);
  }

  return Array.from(boundaries).sort((a, b) => a - b);
}
