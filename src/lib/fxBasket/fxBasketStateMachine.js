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
    startTime: null,
    timeoutId: null,
    timeoutMs,
    missingPairs: [],
    partialData: false,
    getProgress() { return { received: this.receivedPairs.size, total: this.expectedPairs.length }; }
  };
}

export function trackPair(sm, pair, dailyOpen, currentPrice) {
  if (!dailyOpen || !currentPrice) return false;

  if (sm.state === BasketState.FAILED) {
    sm.state = BasketState.WAITING;
    sm.startTime = Date.now();
    sm.timeoutId = setTimeout(() => handleTimeout(sm), sm.timeoutMs);
  }

  sm.receivedPairs.add(pair);

  if (sm.receivedPairs.size === sm.expectedPairs.length) {
    clearTimeout(sm.timeoutId);
    sm.state = BasketState.READY;
    return true;
  }

  return false;
}

function handleTimeout(sm) {
  if (sm.state === BasketState.READY) return;

  const coverage = sm.receivedPairs.size / sm.expectedPairs.length;
  sm.missingPairs = sm.expectedPairs.filter(p => !sm.receivedPairs.has(p));

  if (coverage >= 0.6) {
    console.warn(`[FX BASKET] Timeout with partial data: ${sm.receivedPairs.size}/${sm.expectedPairs.length} pairs (${(coverage * 100).toFixed(0)}%)`);
    console.warn(`[FX BASKET] Missing pairs: ${sm.missingPairs.join(', ')}`);
    sm.state = BasketState.READY;
    sm.partialData = true;
  } else {
    console.error(`[FX BASKET] Insufficient data: ${sm.receivedPairs.size}/${sm.expectedPairs.length} pairs (${(coverage * 100).toFixed(0)}%)`);
    console.error(`[FX BASKET] Missing pairs: ${sm.missingPairs.join(', ')}`);
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

export function reset(sm) {
  if (sm.timeoutId) clearTimeout(sm.timeoutId);
  sm.state = BasketState.FAILED;
  sm.receivedPairs.clear();
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
