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

export function createStateMachine(expectedPairs, timeoutMs = 30000) {
  return {
    state: BasketState.FAILED,
    expectedPairs,
    receivedPairs: new Set(),
    startTime: null,
    timeoutId: null,
    timeoutMs,
    missingPairs: [],
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
  if (sm.state === BasketState.READY) {
    return;
  }
  sm.missingPairs = sm.expectedPairs.filter(p => !sm.receivedPairs.has(p));
  sm.state = BasketState.ERROR;
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
}

export function retry(sm) {
  reset(sm);
  sm.state = BasketState.WAITING;
  sm.startTime = Date.now();
}
