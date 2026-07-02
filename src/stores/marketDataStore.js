import { writable, get } from 'svelte/store';
import { ConnectionManager } from '../lib/connectionManager.js';
import { getWebSocketUrl } from '../lib/displayDataProcessor.js';
import { validateWebSocketMessage, logValidationResult } from '../lib/dataContracts.js';
import { normalizeSymbolDataPackage, normalizeTick } from './marketDataNormalizer.js';
import { mergeProfileUpdate } from './marketProfileMerger.js';
import { createResetFields, setupDailyResetHandler } from './dailyResetHandler.js';

const marketDataStores = new Map();
const activeSubscriptions = new Map();

// --- Pure helper (kept inline — only 7 LOC, called once) ---
function calculateLatency(data, clientReceivedAt) {
  return {
    backend: data.sentAt && data.receivedAt ? data.sentAt - data.receivedAt : null,
    network: data.sentAt ? clientReceivedAt - data.sentAt : null,
    e2e: data.receivedAt ? clientReceivedAt - data.receivedAt : null
  };
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
    code: null,
    status: 'pending',
    lastUpdate: null,
  };
}

// Fields whose change is the ONLY reason to notify subscribers. Pure-metadata
// fields (timestamps, latency, status, error) are excluded — verified 2026-06-29:
// no .svelte component reads them reactively. If a latency/status indicator is
// ever added, revisit this set (or split the store).
const METADATA_KEYS = new Set([
  'receivedAt', 'sentAt', 'clientReceivedAt', 'latency', 'lastUpdate', 'status', 'error'
]);

// Returns true if `normalized` changes a field subscribers render. Reference
// equality is safe here: normalizeSymbolDataPackage reuses currentState.marketProfile
// (same ref) and prevDayOHLC is either null or a fresh object; all other gated
// fields are primitives.
function priceRelevantChanged(current, normalized) {
  for (const k in normalized) {
    if (METADATA_KEYS.has(k)) continue;
    if (normalized[k] !== current[k]) return true;
  }
  return false;
}

function handleStoreUpdate(symbol, data) {
  const store = getMarketDataStore(symbol);
  const clientReceivedAt = Date.now();

  if (import.meta.env.DEV) {
    const validation = validateWebSocketMessage(data, 'marketDataStore');
    logValidationResult('marketDataStore', validation, data);
  }

  const current = get(store);

  let normalized;
  try {
    normalized = data.type === 'symbolDataPackage'
      ? normalizeSymbolDataPackage(data, current)
      : data.type === 'tick'
        ? normalizeTick(data, current)
        : {};
  } catch (e) {
    // Surface the error state; PRESERVE current price (no UI flicker on a
    // transient bad frame). console.warn — console-check.spec asserts zero
    // console.error on expected paths. Dispatch-layer catch stays as backstop.
    console.warn('[marketDataStore] normalize failed — surfacing error, preserving price:', e);
    store.update(cur => ({
      ...cur,
      status: 'error',
      error: e?.message || 'Normalize failed',
      lastUpdate: clientReceivedAt
    }));
    return;
  }

  // Skip the notification when no price-relevant field changed — UNLESS we are
  // currently in an error state, so the next good tick can recover status to
  // 'connected' even if the price itself did not move (see test #4).
  if (!priceRelevantChanged(current, normalized) && current.status !== 'error') return;

  const latency = calculateLatency(data, clientReceivedAt);
  store.update(cur => ({
    ...cur,
    ...normalized,
    clientReceivedAt,
    latency,
    status: 'connected',
    error: null,
    lastUpdate: clientReceivedAt
  }));
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
  setupDailyResetHandler(connectionManager, (sym) => {
    if (!marketDataStores.has(sym)) return;
    marketDataStores.get(sym).update(current => ({
      ...current,
      ...createResetFields(current)
    }));
  });

  const callback = (data) => {
    if (data.type === 'symbolDataPackage' || data.type === 'tick') {
      handleStoreUpdate(symbol, data);
    }
    if (data.type === 'profileUpdate') {
      const store = getMarketDataStore(symbol);
      store.update(current => {
        try {
          const updated = mergeProfileUpdate(current, data);
          return updated ?? current;
        } catch (e) {
          console.warn('[marketDataStore] profile merge failed:', e);
          return { ...current, status: 'error', error: e?.message || 'Profile merge failed', lastUpdate: Date.now() };
        }
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
        code: data.code || null,
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

function clearStore(symbol) {
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

function clearAllStores() {
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
