/**
 * FX Basket State Machine
 * Manages basket lifecycle with fail-closed semantics
 * All functions <15 lines (Crystal Clarity)
 */

export const BasketState = {
  FAILED: 'failed',
  WAITING: 'waiting',
  READY: 'ready',
  ERROR: 'error'
};

export function createStateMachine(expectedPairs, timeoutMs = 10000) {
  return {
    state: BasketState.FAILED,
    expectedPairs,
    receivedPairs: new Set(),
    failedPairs: new Set(),
    startTime: null,
    timeoutId: null,
    timeoutMs,
    missingPairs: [],
    partialData: false,
    getProgress() { return { received: this.receivedPairs.size, failed: this.failedPairs.size, total: this.expectedPairs.length }; }
  };
}

export function trackPair(sm, pair, dailyOpen, currentPrice) {
  if (!dailyOpen || !currentPrice) return false;

  if (sm.state === BasketState.FAILED) {
    sm.state = BasketState.WAITING;
    sm.startTime = Date.now();
    sm.timeoutId = setTimeout(() => finalizeState(sm), sm.timeoutMs);
  }

  sm.receivedPairs.add(pair);
  sm.failedPairs.delete(pair); // Remove from failed if we now have data

  if (sm.receivedPairs.size === sm.expectedPairs.length) {
    clearTimeout(sm.timeoutId);
    sm.state = BasketState.READY;
    return true;
  }

  return false;
}

/**
 * Track a failed pair (e.g., subscription error from backend)
 * Returns true if all pairs have been accounted for (received or failed)
 */
export function trackFailedPair(sm, pair, reason) {
  if (sm.state === BasketState.FAILED) {
    sm.state = BasketState.WAITING;
    sm.startTime = Date.now();
    sm.timeoutId = setTimeout(() => finalizeState(sm), sm.timeoutMs);
  }

  sm.failedPairs.add(pair);
  console.warn(`[FX BASKET] Pair ${pair} marked as failed: ${reason}`);

  // Check if we've accounted for all pairs (received + failed)
  const accountedFor = sm.receivedPairs.size + sm.failedPairs.size;
  if (accountedFor >= sm.expectedPairs.length) {
    clearTimeout(sm.timeoutId);
    finalizeState(sm);
    return true;
  }

  return false;
}

/**
 * Finalize state machine state based on current coverage.
 * Called both as timeout handler and when all pairs are accounted for.
 */
function finalizeState(sm) {
  if (sm.state === BasketState.READY) return;

  const coverage = sm.receivedPairs.size / sm.expectedPairs.length;
  sm.missingPairs = sm.expectedPairs.filter(p => !sm.receivedPairs.has(p) && !sm.failedPairs.has(p));

  // Require 100% coverage to align with fxBasketCalculations.js requirement
  if (coverage >= 1.0) {
    console.log(`[FX BASKET] All pairs received: ${sm.receivedPairs.size}/${sm.expectedPairs.length}`);
    sm.state = BasketState.READY;
  } else {
    console.error(`[FX BASKET] Insufficient data: ${sm.receivedPairs.size}/${sm.expectedPairs.length} pairs (${(coverage * 100).toFixed(0)}%)`);
    console.error(`[FX BASKET] Missing pairs: ${sm.missingPairs.join(', ')}`);
    console.error(`[FX BASKET] Failed pairs: ${Array.from(sm.failedPairs).join(', ')}`);
    sm.state = BasketState.ERROR;
  }
}

export function getState(sm) {
  return sm.state;
}

export function canCalculate(sm) {
  return sm.state === BasketState.READY;
}

export function getMissingPairs(sm) {
  return sm.missingPairs;
}

export function getFailedPairs(sm) {
  return Array.from(sm.failedPairs);
}

export function reset(sm) {
  if (sm.timeoutId) clearTimeout(sm.timeoutId);
  sm.state = BasketState.FAILED;
  sm.receivedPairs.clear();
  sm.failedPairs.clear();
  sm.startTime = null;
  sm.timeoutId = null;
  sm.missingPairs = [];
  sm.partialData = false;
}

export function retry(sm) {
  reset(sm);
  sm.state = BasketState.WAITING;
  sm.startTime = Date.now();
}
