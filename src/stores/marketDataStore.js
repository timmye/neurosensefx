import { writable, get } from 'svelte/store';
import { ConnectionManager } from '../lib/connectionManager.js';
import { getWebSocketUrl } from '../lib/displayDataProcessor.js';
import { validateWebSocketMessage, logValidationResult } from '../lib/dataContracts.js';

const marketDataStores = new Map();
const activeSubscriptions = new Map();

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
      high: newPrice !== null
        ? Math.max(currentState.high ?? newPrice, newPrice)
        : currentState.high,
      low: newPrice !== null
        ? Math.min(currentState.low ?? newPrice, newPrice)
        : currentState.low,
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
        let levels;
        if (data.profile?.levels) {
          levels = data.profile.levels;
        } else if (data.delta) {
          const profile = current.marketProfile ? [...current.marketProfile] : [];
          const levelMap = new Map(profile.map(l => [l.price, l]));

          for (const level of data.delta.added || []) {
            levelMap.set(level.price, level);
          }
          for (const level of data.delta.updated || []) {
            levelMap.set(level.price, level);
          }

          levels = Array.from(levelMap.values()).sort((a, b) => a.price - b.price);
        } else {
          return current;
        }

        const profileHigh = levels[levels.length - 1]?.price ?? null;
        const profileLow = levels[0]?.price ?? null;

        return {
          ...current,
          marketProfile: levels,
          high: profileHigh !== null
            ? Math.max(current.high ?? profileHigh, profileHigh)
            : current.high,
          low: profileLow !== null
            ? Math.min(current.low ?? profileLow, profileLow)
            : current.low,
          lastUpdate: Date.now()
        };
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

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.marketDataStore = {
    getMarketDataStore,
    subscribeToSymbol,
    unsubscribeFromSymbol,
    getConnectionStatus,
    clearStore,
    clearAllStores,
    _internal: {
      marketDataStores,
      activeSubscriptions
    }
  };
}
