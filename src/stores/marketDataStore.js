import { writable, derived, get } from 'svelte/store';
import { ConnectionManager } from '../lib/connectionManager.js';
import { getWebSocketUrl } from '../lib/displayDataProcessor.js';
import { validateWebSocketMessage, logValidationResult } from '../lib/dataContracts.js';
import { calculateBasketValue, normalizeToBaseline, validateCalculationResult, BASKET_DEFINITIONS, getPairPrice } from '../lib/fxBasket/fxBasketCalculations.js';

const SCHEMA_VERSION = '1.0.0';

const marketDataStores = new Map();
const activeSubscriptions = new Map();
const latencySamples = new Map();

// FX Basket state management
const basketStateMachines = new Map();
const basketStores = new Map();

const BasketState = {
  FAILED: 'failed',
  WAITING: 'waiting',
  READY: 'ready',
  ERROR: 'error'
};

const CURRENCIES = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'CHF', 'JPY', 'NZD'];

function createBasketStateMachine(expectedPairs, timeoutMs = 60000) {
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

  if (sm.state === BasketState.FAILED) {
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
  if (sm.state === BasketState.FAILED) {
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

function updateBasketsLocal(store, stateMachine) {
  if (stateMachine.state !== BasketState.READY) {
    return null;
  }

  const baselineMap = store.baseline;
  const currentMap = store.current;
  const baskets = {};

  for (const currency of CURRENCIES) {
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
    schemaVersion: SCHEMA_VERSION
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
      marketProfile: data.initialMarketProfile ?? null,
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
      high: Math.max(currentState.high ?? 0, data.high ?? data.ask ?? data.bid ?? 0),
      low: currentState.low !== null
        ? Math.min(currentState.low, data.low ?? data.bid ?? data.ask ?? Infinity)
        : (data.low ?? data.bid ?? data.ask ?? null),
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

  // Record latency sample for statistics
  if (latency.e2e !== null) {
    recordLatency(symbol, latency.e2e);
  }

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
    store.getState = () => {
      let value;
      store.subscribe(v => value = v)();
      return value;
    };
    marketDataStores.set(symbol, store);
  }
  return marketDataStores.get(symbol);
}

export function createCurrentPriceStore(symbol) {
  const parent = getMarketDataStore(symbol);
  return derived(parent, $data => $data.current);
}

export function createRangePercentStore(symbol) {
  const parent = getMarketDataStore(symbol);
  return derived(parent, $data => {
    if ($data.current === null || $data.high === null || $data.low === null) {
      return null;
    }
    const range = $data.high - $data.low;
    if (range === 0) return 0;
    return (($data.current - $data.low) / range) * 100;
  });
}

export function createDailyChangeStore(symbol) {
  const parent = getMarketDataStore(symbol);
  return derived(parent, $data => {
    if ($data.current === null || $data.open === null) {
      return null;
    }
    if ($data.open === 0) return 0;
    return (($data.current - $data.open) / $data.open) * 100;
  });
}

export function createLatencyStore(symbol) {
  const parent = getMarketDataStore(symbol);
  return derived(parent, $data => $data.latency);
}

export function subscribeToSymbol(symbol, source = 'ctrader', options = {}) {
  const { adr = 14 } = options;

  if (activeSubscriptions.has(symbol)) {
    const sub = activeSubscriptions.get(symbol);
    sub.count++;
    return () => unsubscribeFromSymbol(symbol);
  }

  const connectionManager = ConnectionManager.getInstance(getWebSocketUrl());

  const callback = (data) => {
    if (data.type === 'symbolDataPackage' || data.type === 'tick') {
      handleStoreUpdate(symbol, data);
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

  activeSubscriptions.set(symbol, {
    count: 1,
    unsubscribe: unsubscribeConnection,
    source
  });

  return () => unsubscribeFromSymbol(symbol);
}

export function unsubscribeFromSymbol(symbol) {
  if (!activeSubscriptions.has(symbol)) return;

  const sub = activeSubscriptions.get(symbol);
  sub.count--;

  if (sub.count <= 0) {
    sub.unsubscribe();
    activeSubscriptions.delete(symbol);

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

// Connection status as a reactive writable store
let _connectionStatusStore = null;

export function getConnectionStatus() {
  if (!_connectionStatusStore) {
    const connectionManager = ConnectionManager.getInstance(getWebSocketUrl());
    _connectionStatusStore = writable({
      status: connectionManager.status,
      displayStatus: connectionManager.displayStatus
    });

    // Subscribe to status callbacks so the store updates reactively
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

export function recordLatency(symbol, latencyMs) {
  if (!latencySamples.has(symbol)) {
    latencySamples.set(symbol, []);
  }
  const samples = latencySamples.get(symbol);
  samples.push(latencyMs);

  if (samples.length > 100) {
    samples.shift();
  }
}

export function getLatencyStats(symbol) {
  const samples = latencySamples.get(symbol);
  if (!samples || samples.length === 0) {
    return { p50: null, p95: null, p99: null, avg: null };
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const len = sorted.length;

  const p50Index = Math.floor(len * 0.5);
  const p95Index = Math.floor(len * 0.95);
  const p99Index = Math.floor(len * 0.99);

  const avg = sorted.reduce((sum, v) => sum + v, 0) / len;

  return {
    p50: sorted[p50Index],
    p95: sorted[p95Index],
    p99: sorted[p99Index],
    avg
  };
}

export function clearStore(symbol) {
  if (activeSubscriptions.has(symbol)) {
    unsubscribeFromSymbol(symbol);
  }
  if (marketDataStores.has(symbol)) {
    marketDataStores.delete(symbol);
  }
  if (latencySamples.has(symbol)) {
    latencySamples.delete(symbol);
  }
}

export function clearAllStores() {
  for (const symbol of activeSubscriptions.keys()) {
    const sub = activeSubscriptions.get(symbol);
    sub.unsubscribe();
  }
  activeSubscriptions.clear();
  marketDataStores.clear();
  latencySamples.clear();
}

export function subscribeBasket(pairs, onUpdate, timeoutMs = 60000) {
  const key = 'fx-basket-main';
  console.log(`[FX BASKET] Starting subscription to ${pairs.length} FX pairs...`);
  const connectionManager = ConnectionManager.getInstance(getWebSocketUrl());

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

    if (data.type === 'symbolDataPackage' && data.todaysOpen) {
      store.baseline.set(pair, data.todaysOpen);
      store.pairs.add(pair);

      const currentPrice = data.current || data.bid || data.ask || data.todaysOpen;
      store.current.set(pair, currentPrice);

      const wasReady = trackPair(stateMachine, pair, data.todaysOpen, currentPrice);

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
        const baskets = updateBasketsLocal(store, stateMachine);
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
    basketStores.delete(key);
    basketStateMachines.delete(key);
  };
}

export function getBasketState() {
  const key = 'fx-basket-main';
  const sm = basketStateMachines.get(key);
  if (!sm) return null;
  return {
    state: sm.state,
    progress: sm.getProgress(),
    missingPairs: sm.missingPairs,
    failedPairs: Array.from(sm.failedPairs)
  };
}

export { BasketState };

if (typeof window !== 'undefined') {
  window.marketDataStore = {
    getMarketDataStore,
    createCurrentPriceStore,
    createRangePercentStore,
    createDailyChangeStore,
    createLatencyStore,
    subscribeToSymbol,
    unsubscribeFromSymbol,
    getConnectionStatus,
    recordLatency,
    getLatencyStats,
    clearStore,
    clearAllStores,
    subscribeBasket,
    getBasketState,
    BasketState,
    _internal: {
      marketDataStores,
      activeSubscriptions,
      latencySamples,
      basketStateMachines,
      basketStores
    }
  };
}
