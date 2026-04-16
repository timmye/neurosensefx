/**
 * Chart Configuration — re-export barrel.
 *
 * Constants are in chartConstants.js, time-window functions in chartTimeWindows.js.
 * This file re-exports everything for backward compatibility.
 *
 * @module chartConfig
 */

export {
  RESOLUTION_LABELS,
  RESOLUTION_GROUPS,
  TIME_WINDOW_GROUPS,
  DEFAULT_RESOLUTION_WINDOW,
  RESOLUTION_TO_PERIOD,
  TIMEFRAME_BAR_SPACE,
  PERIOD_RANGE_LIMITS,
  CACHE_MAX_BARS,
  RESOLUTION_MS,
  WINDOW_TIER,
  TRANSITION_MATRIX,
  resolutionToPeriod,
  getWindowTier,
} from './chartConstants.js';

export {
  windowToMs,
  getCalendarAlignedRange,
  calcBarSpace,
} from './chartTimeWindows.js';
