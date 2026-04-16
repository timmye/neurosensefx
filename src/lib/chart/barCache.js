/**
 * IndexedDB bar cache — Dexie.js CRUD for OHLC bars with eviction.
 */

import Dexie from 'dexie';
import { CACHE_MAX_BARS } from './chartConfig.js';

const CACHE_VERSION = 4;
const db = new Dexie('NeuroSenseChart');
db.version(CACHE_VERSION).stores({
  bars: '[symbol+resolution+source+timestamp], symbol, resolution, source, timestamp'
});

/**
 * Retrieve cached bars within a timestamp range.
 */
export async function getCachedBars(symbol, resolution, fromTimestamp, toTimestamp, source = 'ctrader') {
  return db.bars
    .where('[symbol+resolution+source+timestamp]')
    .between(
      [symbol, resolution, source, fromTimestamp],
      [symbol, resolution, source, toTimestamp],
      true, true
    )
    .sortBy('timestamp');
}

/**
 * Persist bars to IndexedDB.
 */
export async function putCachedBars(symbol, resolution, bars, source = 'ctrader') {
  if (!bars || bars.length === 0) return;

  const now = Date.now();
  const records = bars.map(bar => ({
    symbol,
    resolution,
    source,
    timestamp: bar.timestamp,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume ?? 0,
    updatedAt: now
  }));

  await db.bars.bulkPut(records);
}

/**
 * Evict oldest bars beyond the per-resolution cache cap.
 */
export async function evictStaleCache(symbol, resolution, source) {
  const maxBars = CACHE_MAX_BARS[resolution];
  if (!maxBars) return;

  const oldest = await db.bars
    .where('[symbol+resolution+source+timestamp]')
    .between(
      [symbol, resolution, source, 0],
      [symbol, resolution, source, 99999999999999],
      true, true
    )
    .offset(maxBars)
    .sortBy('timestamp');

  if (oldest.length === 0) return;

  const keysToDelete = oldest.map(bar => [bar.symbol, bar.resolution, bar.source, bar.timestamp]);
  await db.bars.bulkDelete(keysToDelete);
}
