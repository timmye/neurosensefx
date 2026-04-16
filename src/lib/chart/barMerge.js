/**
 * Bar merge utilities — optimized append, update, and dedup for OHLC bar arrays.
 */

/**
 * Update or append a single bar into an existing bar array.
 * Returns a new array only if mutation is needed (avoids unnecessary copies).
 * Optimizations: fast-path last-element check, conditional sort.
 */
export function mergeTickBar(bars, bar, isBarClose) {
  let existingIndex = -1;
  if (bars.length > 0 && bars[bars.length - 1].timestamp === bar.timestamp) {
    existingIndex = bars.length - 1;
  } else {
    existingIndex = bars.findIndex(b => b.timestamp === bar.timestamp);
  }

  if (existingIndex >= 0) {
    const newBars = bars.slice();
    newBars[existingIndex] = bar;
    return newBars;
  }

  if (isBarClose || bars.length === 0 || bar.timestamp > bars[bars.length - 1].timestamp) {
    const newBars = bars.slice();
    newBars.push(bar);
    if (newBars.length > 1 && newBars[newBars.length - 2].timestamp > bar.timestamp) {
      newBars.sort((a, b) => a.timestamp - b.timestamp);
    }
    return newBars;
  }

  return bars;
}

/**
 * Merge incoming history bars with existing bars using Map-based O(1) dedup.
 * Last write wins per timestamp (live data is fresher than history).
 */
export function mergeHistoryBars(existingBars, incomingBars) {
  if (existingBars.length === 0) return incomingBars;

  const merged = new Map();
  for (const b of incomingBars) merged.set(b.timestamp, b);
  for (const b of existingBars) merged.set(b.timestamp, b);
  return [...merged.values()].sort((a, b) => a.timestamp - b.timestamp);
}
