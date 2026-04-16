/**
 * Unified resolution <-> period mapping.
 * Generates inverse mapping programmatically from RESOLUTION_TO_PERIOD.
 */

import { RESOLUTION_TO_PERIOD } from './chartConfig.js';

/**
 * Convert cTrader period (e.g., 'H4', 'M1') to resolution key (e.g., '4h', '1m').
 */
const PERIOD_TO_RESOLUTION = Object.fromEntries(
  Object.entries(RESOLUTION_TO_PERIOD).map(([res, period]) => [period, res])
);

export function periodToResolution(period) {
  return PERIOD_TO_RESOLUTION[period] ?? null;
}
