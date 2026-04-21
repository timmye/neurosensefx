import { writable, get } from 'svelte/store';
import { ConnectionManager } from '../lib/connectionManager.js';
import { getWebSocketUrl } from '../lib/displayDataProcessor.js';
import { validateWebSocketMessage, logValidationResult } from '../lib/dataContracts.js';

const marketDataStores = new Map();
const activeSubscriptions = new Map();
// Guard lives on ConnectionManager (not activeSubscriptions), so clearAllStores() must not reset this.
let _dailyResetSetup = false;

function resetSymbolForNewDay(symbol) {
  if (!marketDataStores.has(symbol)) return;
  const store = marketDataStores.get(symbol);
  store.update(current => ({
    ...current,
    marketProfile: null,
    high: null,
    low: null,
    open: null,
    adrHigh: null,
    adrLow: null,
    prevDayOHLC: null,
    previousPrice: current.current,
    direction: 'neutral',
    receivedAt: null,
    sentAt: null,
    clientReceivedAt: null,
    latency: { backend: null, network: null, e2e: null },
    lastUpdate: Date.now()
  }));
}

function setupDailyResetHandler(connectionManager) {
  if (_dailyResetSetup) return;
  _dailyResetSetup = true;
  connectionManager.addSystemSubscription((msg) => {
    if (msg.type === 'dailyReset' && msg.symbols) {
      console.log('[marketDataStore] Daily reset — clearing session data for:', msg.symbols);
      for (const symbol of msg.symbols) {
        resetSymbolForNewDay(symbol);
      }
    }
  });
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
    prevDayOHLC: null,
    pipPosition: 4,
    pipSize: 0.0001,
    pipetteSize: 0.00001,
    digits: null,
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
    // Backend field name fallback chain is the data contract.
    // projectedAdrHigh/projectedAdrLow and todaysHigh/todaysLow are the expected field names from both pipelines.
    if (!data.high && data.todaysHigh) {
      if (import.meta.env.DEV) console.warn('[marketDataStore] Legacy field "todaysHigh" used — backend should send "high"');
    }
    if (!data.low && data.todaysLow) {
      if (import.meta.env.DEV) console.warn('[marketDataStore] Legacy field "todaysLow" used — backend should send "low"');
    }
    if (!data.open && data.todaysOpen) {
      if (import.meta.env.DEV) console.warn('[marketDataStore] Legacy field "todaysOpen" used — backend should send "open"');
    }

    const midPrice = (data.bid != null && data.ask != null && data.bid !== data.ask)
      ? (data.bid + data.ask) / 2
      : null;

    return {
      current: data.current ?? data.price ?? data.initialPrice ?? midPrice ?? data.bid ?? data.ask ?? null,
      high: data.high ?? data.todaysHigh ?? null,
      low: data.low ?? data.todaysLow ?? null,
      open: data.open ?? data.todaysOpen ?? null,
      adrHigh: data.adrHigh ?? data.projectedAdrHigh ?? null,
      adrLow: data.adrLow ?? data.projectedAdrLow ?? null,
      prevDayOHLC: (data.prevDayOpen != null && data.prevDayHigh != null &&
                    data.prevDayLow != null && data.prevDayClose != null)
        ? { open: data.prevDayOpen, high: data.prevDayHigh, low: data.prevDayLow, close: data.prevDayClose }
        : null,
      pipPosition: data.pipPosition ?? currentState.pipPosition,
      pipSize: data.pipSize ?? currentState.pipSize,
      pipetteSize: data.pipetteSize ?? currentState.pipetteSize,
      digits: data.digits ?? currentState.digits,
      source: data.source ?? currentState.source,
      marketProfile: currentState.marketProfile,
      previousPrice: data.current ?? data.price ?? midPrice ?? data.bid ?? data.ask ?? currentState.current ?? null,
      direction: 'neutral',
      receivedAt: data.receivedAt ?? null,
      sentAt: data.sentAt ?? null
    };
  }
  if (data.type === 'tick') {
    const midPrice = (data.bid != null && data.ask != null && data.bid !== data.ask)
      ? (data.bid + data.ask) / 2
      : null;
    const newPrice = data.price ?? midPrice ?? data.bid ?? data.ask ?? currentState.current;
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
      digits: data.digits ?? currentState.digits,
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
  setupDailyResetHandler(connectionManager);

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
    if (data.type === 'twapUpdate') {
      const store = getMarketDataStore(symbol);
      store.update(current => ({
        ...current,
        twap: data.data?.twapValue ?? current.twap,
        twapContributions: data.data?.contributions ?? current.twapContributions,
        twapUpdatedAt: data.data?.timestamp ?? current.twapUpdatedAt,
        lastUpdate: Date.now()
      }));
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
