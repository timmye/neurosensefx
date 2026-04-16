/**
 * Cache freshness checks — determines whether cached IndexedDB bars
 * are recent enough to serve directly or too stale to trust.
 */

import { RESOLUTION_MS } from './chartConfig.js';

/**
 * Check whether cached bars are fresh enough to use without a backend fetch.
 *
 * A cache entry is considered stale when the newest bar's updatedAt timestamp
 * is older than 2 bar-periods (or 1 hour default for unknown resolutions).
 *
 * @param {Array} cachedBars - bars retrieved from IndexedDB
 * @param {string} resolution - chart resolution key (e.g., '1m', '4h')
 * @returns {{ fresh: boolean, maxAgeMs: number }}
 */
export function checkCacheFreshness(cachedBars, resolution) {
  if (cachedBars.length === 0) {
    return { fresh: false, maxAgeMs: 0 };
  }

  const barPeriodMs = RESOLUTION_MS[resolution];
  const maxAgeMs = barPeriodMs ? barPeriodMs * 2 : 3_600_000;

  const newestBar = cachedBars[cachedBars.length - 1];
  const isStale = newestBar.updatedAt && (Date.now() - newestBar.updatedAt) > maxAgeMs;

  return { fresh: !isStale, maxAgeMs };
}
