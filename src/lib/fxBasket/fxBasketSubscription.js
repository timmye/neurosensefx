// FX Basket Subscription
// Manages basket WebSocket subscriptions and state machine lifecycle

import { ConnectionManager } from '../connectionManager.js';
import { getWebSocketUrl } from '../displayDataProcessor.js';
import { BasketState, createStateMachine, trackPair, trackFailedPair } from './fxBasketStateMachine.js';
import { updateBaskets } from './fxBasketCalculations.js';
import { initVolatility, computeVolatility, resetVolatility } from './fxBasketVolatility.js';
import { volatilityStore } from '../../stores/volatilityStore.js';

const basketStateMachines = new Map();
const basketStores = new Map();

export function subscribeBasket(pairs, onUpdate, timeoutMs = 60000) {
  const key = 'fx-basket-' + pairs.sort().join('-');
  console.log(`[FX BASKET] Starting subscription to ${pairs.length} FX pairs...`);
  const connectionManager = ConnectionManager.getInstance(getWebSocketUrl());

  // Clean up existing state machine if present
  const existingSm = basketStateMachines.get(key);
  if (existingSm && existingSm.timeoutId) {
    clearTimeout(existingSm.timeoutId);
  }

  const store = { baseline: new Map(), current: new Map(), pairs: new Set() };
  const stateMachine = createStateMachine(pairs, timeoutMs);
  let lastBaskets = null;
  let volInitialized = false;

  basketStores.set(key, store);
  basketStateMachines.set(key, stateMachine);

  const subscriptions = [];

  const processorCallback = (data) => {
    const pair = data.symbol;

    if (data.type === 'error') {
      trackFailedPair(stateMachine, pair, data.message);
      if (stateMachine.state === BasketState.ERROR) {
        onUpdate({ _state: BasketState.ERROR, _missingPairs: stateMachine.missingPairs, _failedPairs: Array.from(stateMachine.failedPairs), _totalPairs: stateMachine.expectedPairs.length });
      }
      return;
    }

    if (data.type === 'symbolDataPackage' && (data.open || data.todaysOpen)) {
      if (!data.open && data.todaysOpen) {
        if (import.meta.env.DEV) console.warn('[marketDataStore] Legacy field "todaysOpen" used — backend should send "open"');
      }
      const dailyOpen = data.open || data.todaysOpen;
      store.baseline.set(pair, dailyOpen);
      store.pairs.add(pair);

      const currentPrice = data.current || data.bid || data.ask || dailyOpen;
      store.current.set(pair, currentPrice);

      const wasReady = trackPair(stateMachine, pair, dailyOpen, currentPrice);

      if (stateMachine.state === BasketState.WAITING) {
        onUpdate({ _state: BasketState.WAITING, _progress: stateMachine.getProgress() });
      } else if (wasReady && stateMachine.state === BasketState.READY) {
        // Initial READY transition - calculate all baskets
        const baskets = updateBaskets(store, stateMachine);
        if (baskets) {
          lastBaskets = { ...baskets };
          onUpdate({ ...lastBaskets, _state: BasketState.READY });
          if (!volInitialized) {
            initVolatility(baskets);
            volInitialized = true;
          }
          volatilityStore.set(computeVolatility(baskets));
        }
      } else if (stateMachine.state === BasketState.READY && lastBaskets) {
        // Reconnect: baseline updated, recalculate all baskets
        const baskets = updateBaskets(store, stateMachine);
        if (baskets) {
          lastBaskets = { ...baskets };
          onUpdate({ ...lastBaskets, _state: BasketState.READY });
          volatilityStore.set(computeVolatility(baskets));
        }
      }
    } else if (data.type === 'tick' && (data.bid || data.ask)) {
      const currentPrice = (data.bid != null && data.ask != null && data.bid !== data.ask)
        ? (data.bid + data.ask) / 2
        : (data.bid || data.ask);
      store.current.set(pair, currentPrice);

      const dailyOpen = store.baseline.get(pair);
      if (dailyOpen && stateMachine.state === BasketState.READY) {
        const currencies = pair.length >= 6 ? [pair.slice(0, 3), pair.slice(3, 6)] : [];
        const partial = updateBaskets(store, stateMachine, currencies.length > 0 ? currencies : undefined);
        if (partial) {
          lastBaskets = { ...lastBaskets, ...partial };
          onUpdate({ ...lastBaskets, _state: BasketState.READY });
          volatilityStore.set(computeVolatility(lastBaskets));
        }
      }
    }
  };

  for (const pair of pairs) {
    console.log(`[FX BASKET] Subscribing to ${pair}`);
    const unsub = connectionManager.subscribeAndRequest(pair, processorCallback, 14, 'ctrader');
    subscriptions.push(unsub);
  }

  console.log(`[FX BASKET] All ${pairs.length} subscriptions complete`);

  return () => {
    resetVolatility();
    volInitialized = false;
    volatilityStore.set({ sigma: 0, maxZone: 0, ewmaVelocity: 0, range: 0, smoothedSigma: 0, smoothedMaxZone: 0, smoothedVelocity: 0, smoothedRange: 0, perBasket: {}, ready: false });
    subscriptions.forEach(unsub => unsub());
    const sm = basketStateMachines.get(key);
    if (sm && sm.timeoutId) {
      clearTimeout(sm.timeoutId);
    }
    basketStores.delete(key);
    basketStateMachines.delete(key);
  };
}

export function getBasketState() {
  for (const [key, sm] of basketStateMachines) {
    return {
      state: sm.state,
      progress: sm.getProgress(),
      missingPairs: sm.missingPairs,
      failedPairs: Array.from(sm.failedPairs)
    };
  }
  return null;
}

export { BasketState };
