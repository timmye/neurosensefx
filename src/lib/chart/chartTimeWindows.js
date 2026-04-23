/**
 * Time-window computation functions for charting.
 *
 * Pure functions for calendar-aligned ranges, window-to-ms conversion,
 * and bar-space calculation. No external dependencies.
 *
 * @module chartTimeWindows
 */

import { RESOLUTION_MS, TIMEFRAME_BAR_SPACE } from './chartConstants.js';

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

function parseWindowString(windowStr) {
  const match = windowStr.match(/^(\d+)(d|W|M|Y)$/);
  if (!match) return { count: 3, unit: 'M' };
  return { count: parseInt(match[1], 10), unit: match[2] };
}

function alignWeekRange(now, count) {
  const dayOfWeek = now.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  return Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(),
    now.getUTCDate() - daysSinceMonday - (count * 7),
    0, 0, 0, 0
  );
}

function alignMonthRange(now, count) {
  let targetMonth = now.getUTCMonth() - count;
  let targetYear = now.getUTCFullYear();
  while (targetMonth < 0) { targetMonth += 12; targetYear--; }
  return Date.UTC(targetYear, targetMonth, 1, 0, 0, 0, 0);
}

function alignYearRange(now, count) {
  if (count === 1) {
    const currentMonth = now.getUTCMonth();
    const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
    let targetMonth = quarterStartMonth - 12;
    let targetYear = now.getUTCFullYear();
    while (targetMonth < 0) { targetMonth += 12; targetYear--; }
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
 * Week windows snap to Monday UTC.
 * Month windows snap to 1st of month UTC.
 * Year windows: 1Y snaps to quarter starts, multi-year to Jan 1 UTC.
 * Day windows (e.g., '1d', '2d') use simple millisecond lookback
 * without calendar alignment; extraPeriods extends the range for
 * pre-fetch buffering.
 */
export function getCalendarAlignedRange(windowStr, extraPeriods = 1) {
  const to = Date.now();
  const now = new Date(to);
  const { count, unit } = parseWindowString(windowStr);

  let from;
  if (unit === 'W') {
    from = alignWeekRange(now, count + extraPeriods);
  } else if (unit === 'M') {
    from = alignMonthRange(now, count + extraPeriods);
  } else if (unit === 'Y') {
    from = alignYearRange(now, count);
    if (extraPeriods > 0) from = alignYearRange(new Date(from), 1);
  } else {
    const windowMs = WINDOW_MS[windowStr] ?? WINDOW_MS['3M'];
    from = to - windowMs * (2 + extraPeriods);
  }

  return { from, to };
}

/**
 * Compute a rolling (non-calendar-aligned) time range.
 *
 * Returns { from, to } where:
 *   to   = Date.now()
 *   from = to - windowMs * (1 + extraPeriods)
 *
 * Used when the user selects "Rolling" mode — a fixed lookback
 * from today with no calendar boundary snapping.
 */
export function getRollingRange(windowStr, extraPeriods = 1) {
  const to = Date.now();
  const windowMs = WINDOW_MS[windowStr] ?? WINDOW_MS['3M'];
  return { from: to - windowMs * (1 + extraPeriods), to };
}

/**
 * Calculate barSpace so the window's candles fit the container width.
 * Clamped to KLineChart limits (3–50). Returns fallback if container too small.
 */
export function calcBarSpace(resolution, window, containerWidth) {
  const numCandles = windowToMs(window) / RESOLUTION_MS[resolution];
  if (!numCandles || !containerWidth || containerWidth <= 0) {
    return TIMEFRAME_BAR_SPACE[resolution] || 10;
  }
  return Math.max(3, Math.min(50, containerWidth / numCandles));
}
