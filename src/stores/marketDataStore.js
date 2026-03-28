import { writable, get } from 'svelte/store';
import { ConnectionManager } from '../lib/connectionManager.js';
import { getWebSocketUrl } from '../lib/displayDataProcessor.js';
import { validateWebSocketMessage, logValidationResult } from '../lib/dataContracts.js';
import { calculateBasketValue, normalizeToBaseline, validateCalculationResult } from '../lib/fxBasket/fxBasketCalculations.js';

const marketDataStores = new Map();
const activeSubscriptions = new Map();

const basketStateMachines = new Map();
const basketStores = new Map();

const BasketState = {
  IDLE: 'idle',
  FAILED: 'failed',
  WAITING: 'waiting',
  READY: 'ready',
  ERROR: 'error'
};

const CURRENCIES = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'CHF', 'JPY', 'NZD'];

function createBasketStateMachine(expectedPairs, timeoutMs = 60000) {
  return {
    state: BasketState.IDLE,
    expectedPairs,
    receivedPairs: new Set(),
    failedPairs: new Set(),
    startTime: null,
    timeoutId: null,
    timeoutMs,
    missingPairs: [],
    partialData: false,
    getProgress() {
      return {
        received: this.receivedPairs.size,
        failed: this.failedPairs.size,
        total: this.expectedPairs.length
      };
    }
  };
}

function trackPair(sm, pair, dailyOpen, currentPrice) {
  if (!dailyOpen || !currentPrice) return false;

  if (sm.state === BasketState.IDLE || sm.state === BasketState.FAILED) {
    sm.state = BasketState.WAITING;
    sm.startTime = Date.now();
    sm.timeoutId = setTimeout(() => finalizeBasketState(sm), sm.timeoutMs);
  }

  sm.receivedPairs.add(pair);
  sm.failedPairs.delete(pair);

  if (sm.receivedPairs.size === sm.expectedPairs.length) {
    clearTimeout(sm.timeoutId);
    sm.state = BasketState.READY;
    return true;
  }

  return false;
}

function trackFailedPair(sm, pair, reason) {
  if (sm.state === BasketState.IDLE || sm.state === BasketState.FAILED) {
    sm.state = BasketState.WAITING;
    sm.startTime = Date.now();
    sm.timeoutId = setTimeout(() => finalizeBasketState(sm), sm.timeoutMs);
  }

  sm.failedPairs.add(pair);
  console.warn(`[FX BASKET] Pair ${pair} marked as failed: ${reason}`);

  const accountedFor = sm.receivedPairs.size + sm.failedPairs.size;
  if (accountedFor >= sm.expectedPairs.length) {
    clearTimeout(sm.timeoutId);
    finalizeBasketState(sm);
    return true;
  }

  return false;
}

function finalizeBasketState(sm) {
  if (sm.state === BasketState.READY) return;

  const coverage = sm.receivedPairs.size / sm.expectedPairs.length;
  sm.missingPairs = sm.expectedPairs.filter(p => !sm.receivedPairs.has(p) && !sm.failedPairs.has(p));

  if (coverage >= 1.0) {
    sm.state = BasketState.READY;
  } else {
    console.error(`[FX BASKET] Insufficient data: ${sm.receivedPairs.size}/${sm.expectedPairs.length} pairs`);
    sm.state = BasketState.ERROR;
  }
}

function updateBasketsLocal(store, stateMachine, affectedCurrency) {
  if (stateMachine.state !== BasketState.READY) {
    return null;
  }

  const baselineMap = store.baseline;
  const currentMap = store.current;
  const baskets = {};

  const currencies = Array.isArray(affectedCurrency) ? affectedCurrency : affectedCurrency ? [affectedCurrency] : CURRENCIES;

  for (const currency of currencies) {
    const baselineResult = calculateBasketValue(currency, baselineMap);
    const currentResult = calculateBasketValue(currency, currentMap);

    const baselineValidation = validateCalculationResult(baselineResult);
    const currentValidation = validateCalculationResult(currentResult);

    if (!baselineValidation.valid || !currentValidation.valid) {
      baskets[currency] = null;
      continue;
    }

    const normalized = normalizeToBaseline(currentResult.value, baselineResult.value);

    baskets[currency] = {
      currency,
      baselineLog: baselineResult.value,
      currentLog: currentResult.value,
      normalized: normalized ?? 100,
      changePercent: (normalized ?? 100) - 100,
      initialized: true
    };
  }

  return baskets;
}

function createInitialData(symbol) {
  return {
    symbol,
    source: null,
    current: null,
    high: null,
    low: null,
    open: null,
    adrHigh: null,
    adrLow: null,
    pipPosition: 4,
    pipSize: 0.0001,
    pipetteSize: 0.00001,
    previousPrice: null,
    direction: 'neutral',
    marketProfile: null,
    receivedAt: null,
    sentAt: null,
    clientReceivedAt: null,
    latency: { backend: null, network: null, e2e: null },
    error: null,
    status: 'pending',
    lastUpdate: null,
  };
}

function calculateLatency(data, clientReceivedAt) {
  return {
    backend: data.sentAt && data.receivedAt ? data.sentAt - data.receivedAt : null,
    network: data.sentAt ? clientReceivedAt - data.sentAt : null,
    e2e: data.receivedAt ? clientReceivedAt - data.receivedAt : null
  };
}

function normalizeData(data, currentState) {
  if (data.type === 'symbolDataPackage') {
    if (!data.high && data.todaysHigh) {
      if (import.meta.env.DEV) console.warn('[marketDataStore] Legacy field "todaysHigh" used — backend should send "high"');
    }
    if (!data.low && data.todaysLow) {
      if (import.meta.env.DEV) console.warn('[marketDataStore] Legacy field "todaysLow" used — backend should send "low"');
    }
    if (!data.open && data.todaysOpen) {
      if (import.meta.env.DEV) console.warn('[marketDataStore] Legacy field "todaysOpen" used — backend should send "open"');
    }
    if (!data.adrHigh && data.projectedAdrHigh) {
      if (import.meta.env.DEV) console.warn('[marketDataStore] Legacy field "projectedAdrHigh" used — backend should send "adrHigh"');
    }
    if (!data.adrLow && data.projectedAdrLow) {
      if (import.meta.env.DEV) console.warn('[marketDataStore] Legacy field "projectedAdrLow" used — backend should send "adrLow"');
    }

    return {
      current: data.current ?? data.price ?? data.bid ?? data.ask ?? null,
      high: data.high ?? data.todaysHigh ?? null,
      low: data.low ?? data.todaysLow ?? null,
      open: data.open ?? data.todaysOpen ?? null,
      adrHigh: data.adrHigh ?? data.projectedAdrHigh ?? null,
      adrLow: data.adrLow ?? data.projectedAdrLow ?? null,
      pipPosition: data.pipPosition ?? currentState.pipPosition,
      pipSize: data.pipSize ?? currentState.pipSize,
      pipetteSize: data.pipetteSize ?? currentState.pipetteSize,
      source: data.source ?? currentState.source,
      marketProfile: currentState.marketProfile,
      previousPrice: data.current ?? data.price ?? data.bid ?? data.ask ?? currentState.current ?? null,
      direction: 'neutral',
      receivedAt: data.receivedAt ?? null,
      sentAt: data.sentAt ?? null
    };
  }
  if (data.type === 'tick') {
    const newPrice = data.price ?? data.bid ?? data.ask ?? currentState.current;
    const prevPrice = currentState.current ?? currentState.previousPrice;
    let direction = 'neutral';
    if (newPrice !== null && prevPrice !== null) {
      direction = newPrice > prevPrice ? 'up' : newPrice < prevPrice ? 'down' : 'neutral';
    }
    return {
      current: newPrice,
      high: Math.max(currentState.high ?? 0, data.high ?? 0),
      low: currentState.low !== null
        ? Math.min(currentState.low, data.low ?? Infinity)
        : (data.low ?? null),
      previousPrice: prevPrice,
      direction,
      source: data.source ?? currentState.source,
      pipPosition: data.pipPosition ?? currentState.pipPosition,
      pipSize: data.pipSize ?? currentState.pipSize,
      pipetteSize: data.pipetteSize ?? currentState.pipetteSize,
      receivedAt: data.receivedAt ?? null,
      sentAt: data.sentAt ?? null
    };
  }
  return {};
}

function handleStoreUpdate(symbol, data) {
  const store = getMarketDataStore(symbol);
  const clientReceivedAt = Date.now();

  if (import.meta.env.DEV) {
    const validation = validateWebSocketMessage(data, 'marketDataStore');
    logValidationResult('marketDataStore', validation, data);
  }

  const latency = calculateLatency(data, clientReceivedAt);

  store.update(current => {
    const normalized = normalizeData(data, current);
    return {
      ...current,
      ...normalized,
      clientReceivedAt,
      latency,
      status: 'connected',
      error: null,
      lastUpdate: clientReceivedAt
    };
  });
}

export function getMarketDataStore(symbol) {
  if (!marketDataStores.has(symbol)) {
    const store = writable(createInitialData(symbol));
    marketDataStores.set(symbol, store);
  }
  return marketDataStores.get(symbol);
}

export function subscribeToSymbol(symbol, source = 'ctrader', options = {}) {
  const { adr = 14 } = options;
  const key = `${symbol}:${source}`;

  if (activeSubscriptions.has(key)) {
    const sub = activeSubscriptions.get(key);
    sub.count++;
    return () => unsubscribeFromSymbol(symbol, source);
  }

  const connectionManager = ConnectionManager.getInstance(getWebSocketUrl());

  const callback = (data) => {
    if (data.type === 'symbolDataPackage' || data.type === 'tick') {
      handleStoreUpdate(symbol, data);
    }
    if (data.type === 'profileUpdate') {
      const store = getMarketDataStore(symbol);
      store.update(current => {
        if (data.profile?.levels) {
          return { ...current, marketProfile: data.profile.levels, lastUpdate: Date.now() };
        }
        if (data.delta) {
          const profile = current.marketProfile ? [...current.marketProfile] : [];
          const levelMap = new Map(profile.map(l => [l.price, l]));

          for (const level of data.delta.added || []) {
            levelMap.set(level.price, level);
          }
          for (const level of data.delta.updated || []) {
            levelMap.set(level.price, level);
          }

          const merged = Array.from(levelMap.values()).sort((a, b) => a.price - b.price);
          return { ...current, marketProfile: merged, lastUpdate: Date.now() };
        }
        return current;
      });
    }
    if (data.type === 'error') {
      const store = getMarketDataStore(symbol);
      store.update(current => ({
        ...current,
        status: 'error',
        error: data.message || 'Unknown error',
        lastUpdate: Date.now()
      }));
    }
  };

  const unsubscribeConnection = connectionManager.subscribeAndRequest(symbol, callback, adr, source);

  activeSubscriptions.set(key, {
    count: 1,
    unsubscribe: unsubscribeConnection,
    source
  });

  return () => unsubscribeFromSymbol(symbol, source);
}

export function unsubscribeFromSymbol(symbol, source = 'ctrader') {
  const key = `${symbol}:${source}`;
  if (!activeSubscriptions.has(key)) return;

  const sub = activeSubscriptions.get(key);
  sub.count--;

  if (sub.count <= 0) {
    sub.unsubscribe();
    activeSubscriptions.delete(key);

    if (marketDataStores.has(symbol)) {
      const store = marketDataStores.get(symbol);
      store.update(current => ({
        ...current,
        status: 'stale',
        lastUpdate: Date.now()
      }));
    }
  }
}

let _connectionStatusStore = null;

export function getConnectionStatus() {
  if (!_connectionStatusStore) {
    const connectionManager = ConnectionManager.getInstance(getWebSocketUrl());
    _connectionStatusStore = writable({
      status: connectionManager.status,
      displayStatus: connectionManager.displayStatus
    });

    connectionManager.addStatusCallback(() => {
      if (_connectionStatusStore) {
        _connectionStatusStore.set({
          status: connectionManager.status,
          displayStatus: connectionManager.displayStatus
        });
      }
    });
  }
  return _connectionStatusStore;
}

export function clearStore(symbol) {
  for (const key of [...activeSubscriptions.keys()]) {
    if (key.startsWith(`${symbol}:`)) {
      const sub = activeSubscriptions.get(key);
      sub.unsubscribe();
      activeSubscriptions.delete(key);
    }
  }
  if (marketDataStores.has(symbol)) {
    marketDataStores.delete(symbol);
  }
}

export function clearAllStores() {
  for (const key of activeSubscriptions.keys()) {
    const sub = activeSubscriptions.get(key);
    sub.unsubscribe();
  }
  activeSubscriptions.clear();
  marketDataStores.clear();
}

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
  const stateMachine = createBasketStateMachine(pairs, timeoutMs);

  basketStores.set(key, store);
  basketStateMachines.set(key, stateMachine);

  const subscriptions = [];

  const processorCallback = (data) => {
    const pair = data.symbol;

    if (data.type === 'error') {
      trackFailedPair(stateMachine, pair, data.message);
      if (stateMachine.state === BasketState.ERROR) {
        onUpdate({ _state: BasketState.ERROR, _missingPairs: stateMachine.missingPairs });
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
        const baskets = updateBasketsLocal(store, stateMachine);
        if (baskets) onUpdate({ ...baskets, _state: BasketState.READY });
      }
    } else if (data.type === 'tick' && (data.bid || data.ask)) {
      const currentPrice = data.bid || data.ask;
      store.current.set(pair, currentPrice);

      const dailyOpen = store.baseline.get(pair);
      if (dailyOpen && stateMachine.state === BasketState.READY) {
        const currencies = pair.length >= 6 ? [pair.slice(0, 3), pair.slice(3, 6)] : [];
        const baskets = updateBasketsLocal(store, stateMachine, currencies.length > 0 ? currencies : undefined);
        if (baskets) onUpdate({ ...baskets, _state: BasketState.READY });
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

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.marketDataStore = {
    getMarketDataStore,
    subscribeToSymbol,
    unsubscribeFromSymbol,
    getConnectionStatus,
    clearStore,
    clearAllStores,
    subscribeBasket,
    getBasketState,
    BasketState,
    _internal: {
      marketDataStores,
      activeSubscriptions,
      basketStateMachines,
      basketStores
    }
  };
}
