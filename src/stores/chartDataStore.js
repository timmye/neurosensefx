/**
 * Chart Data Store
 *
 * Manages OHLC bar arrays per symbol:resolution. Handles historical candle
 * loading, real-time candle subscriptions, IndexedDB caching via Dexie.js,
 * and progressive (scroll-driven) loading.
 *
 * State machine: IDLE -> LOADING -> READY -> FETCHING_MORE
 *
 * @module chartDataStore
 */

import { writable } from 'svelte/store';
import Dexie from 'dexie';
import { ConnectionManager } from '../lib/connectionManager.js';
import { getWebSocketUrl } from '../lib/displayDataProcessor.js';
import { getMarketDataStore } from './marketDataStore.js';
import {
  resolutionToPeriod,
  PERIOD_RANGE_LIMITS,
  CACHE_MAX_BARS,
  RESOLUTION_MS
} from '../lib/chart/chartConfig.js';

const CACHE_VERSION = 4;

// ============================================================================
// IndexedDB via Dexie.js
// ============================================================================

const db = new Dexie('NeuroSenseChart');
db.version(CACHE_VERSION).stores({
  bars: '[symbol+resolution+source+timestamp], symbol, resolution, source, timestamp'
});

// ============================================================================
// Internal State
// ============================================================================

const chartBarStores = new Map();
const candleSubscriptions = new Map();
let connectionManager = null;
let _candleHandlerSetup = false;

// State machine constants
const STATE = {
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  FETCHING_MORE: 'fetching_more'
};

// Loading timeout — reset to READY with error after 30s
const LOADING_TIMEOUT_MS = 30_000;
const loadingTimers = new Map();

// ============================================================================
// Store Key Helper
// ============================================================================

function storeKey(symbol, resolution) {
  return `${symbol}:${resolution}`;
}

// ============================================================================
// IndexedDB Cache Operations
// ============================================================================

async function getCachedBars(symbol, resolution, fromTimestamp, toTimestamp, source = 'ctrader') {
  return db.bars
    .where('[symbol+resolution+source+timestamp]')
    .between(
      [symbol, resolution, source, fromTimestamp],
      [symbol, resolution, source, toTimestamp],
      true, true
    )
    .sortBy('timestamp');
}

async function putCachedBars(symbol, resolution, bars, source = 'ctrader') {
  if (!bars || bars.length === 0) return;

  const now = Date.now();
  const records = bars.map(bar => ({
    symbol,
    resolution,
    source,
    timestamp: bar.timestamp,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume ?? 0,
    updatedAt: now
  }));

  await db.bars.bulkPut(records);
}

async function evictStaleCache(symbol, resolution, source) {
  const maxBars = CACHE_MAX_BARS[resolution];
  if (!maxBars) return;

  const count = await db.bars
    .where('[symbol+resolution+source+timestamp]')
    .between(
      [symbol, resolution, source, 0],
      [symbol, resolution, source, 99999999999999],
      true, true
    )
    .count();

  if (count <= maxBars) return;

  const oldest = await db.bars
    .where('[symbol+resolution+source+timestamp]')
    .between(
      [symbol, resolution, source, 0],
      [symbol, resolution, source, 99999999999999],
      true, true
    )
    .offset(maxBars)
    .sortBy('timestamp');

  if (oldest.length === 0) return;

  const keysToDelete = oldest.map(bar => [bar.symbol, bar.resolution, bar.source, bar.timestamp]);
  await db.bars.bulkDelete(keysToDelete);
}

// ============================================================================
// Candle Message Handler Setup
// ============================================================================

function setupCandleMessageHandler() {
  if (_candleHandlerSetup) return;
  _candleHandlerSetup = true;

  connectionManager.addSystemSubscription((data) => {
    if (data.type === 'candleUpdate') {
      handleCandleUpdate(data);
    }
    if (data.type === 'candleHistory') {
      handleCandleHistory(data);
    }
  });

  // Resend candle subscriptions and reload history on reconnect
  connectionManager.addSystemSubscription((data) => {
    if (data.type === 'ready') {
      // Clear subscriptions before re-subscribing to avoid duplicate keys
      const previousSubs = new Map(candleSubscriptions);
      candleSubscriptions.clear();

      for (const [key, storedSource] of previousSubs) {
        const [symbol, resolution] = key.split(':');
        const sent = sendSubscribeCandles(symbol, resolution, storedSource);
        if (sent) {
          candleSubscriptions.set(key, storedSource);
        }

        // Reload history to fill any gap from disconnection
        // FETCHING_MORE allows live candle updates to continue during gap-fill
        const barStore = getChartBarStore(symbol, resolution);
        let current;
        const u = barStore.subscribe(v => { current = v; });
        u();

        if (current.bars.length > 0) {
          barStore.set({ ...current, state: STATE.FETCHING_MORE });
          const to = Date.now();
          const from = current.bars[current.bars.length - 1].timestamp;
          sendGetHistoricalCandles(symbol, resolution, from, to);
        }
      }
    }
  });
}

// ============================================================================
// Public API
// ============================================================================

export function getChartBarStore(symbol, resolution) {
  const key = storeKey(symbol, resolution);
  if (!chartBarStores.has(key)) {
    chartBarStores.set(key, writable({
      bars: [],
      state: STATE.IDLE,
      error: null
    }));
  }
  return chartBarStores.get(key);
}

export async function loadHistoricalBars(symbol, resolution, fromTimestamp, toTimestamp, source = 'ctrader') {
  const store = getChartBarStore(symbol, resolution);
  const fetchPeriod = resolutionToPeriod(resolution);

  store.set({ bars: [], state: STATE.LOADING, error: null });

  // Start loading timeout
  const key = storeKey(symbol, resolution);
  clearTimeout(loadingTimers.get(key));
  loadingTimers.set(key, setTimeout(() => {
    store.update(current => {
      if (current.state === STATE.LOADING) {
        return { ...current, state: STATE.READY, error: 'Loading timed out' };
      }
      return current;
    });
    loadingTimers.delete(key);
  }, LOADING_TIMEOUT_MS));

  // Check IndexedDB cache first
  try {
    const cachedBars = await getCachedBars(symbol, resolution, fromTimestamp, toTimestamp, source);

    if (cachedBars.length > 0) {
      // Reject stale cache: bars last written more than 2 bar-periods ago are too old to trust
      const barPeriodMs = RESOLUTION_MS[resolution];
      const maxAgeMs = barPeriodMs ? barPeriodMs * 2 : 3_600_000;
      const newestBar = cachedBars[cachedBars.length - 1];
      const isStale = newestBar.updatedAt && (Date.now() - newestBar.updatedAt) > maxAgeMs;

      if (!isStale) {
        // Clear loading timeout on cache hit
        clearTimeout(loadingTimers.get(storeKey(symbol, resolution)));
        loadingTimers.delete(storeKey(symbol, resolution));

        store.set({ bars: cachedBars, state: STATE.READY, error: null, updateType: 'full' });

        // Track subscription and send for real-time updates
        subscribeToCandles(symbol, resolution, source);
        return;
      }
      // Stale cache — fall through to backend fetch below
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[chartDataStore] Cache read failed, fetching from backend:', err);
    }
  }

  // Subscribe immediately for live updates — don't wait for history
  subscribeToCandles(symbol, resolution, source);

  // Cache miss — fetch from backend
  if (!fetchPeriod) {
    store.set({ bars: [], state: STATE.READY, error: `Unknown resolution: ${resolution}` });
    return;
  }

  // Send full range to backend — it chains requests internally per period limits
  const sent = sendGetHistoricalCandles(symbol, resolution, fromTimestamp, toTimestamp, source);
  if (!sent) {
    store.set({ bars: [], state: STATE.READY, error: 'WebSocket not connected' });
  }
}

function subscribeToCandles(symbol, resolution, source = 'ctrader') {
  const key = storeKey(symbol, resolution);
  const existing = candleSubscriptions.get(key);
  if (existing) {
    return;
  }
  const sent = sendSubscribeCandles(symbol, resolution, source);
  if (sent) {
    candleSubscriptions.set(key, source);
  }
}

export function unsubscribeFromCandles(symbol, resolution, source = 'ctrader') {
  const key = storeKey(symbol, resolution);
  if (!candleSubscriptions.has(key)) return;
  candleSubscriptions.delete(key);
  sendUnsubscribeCandles(symbol, resolution, source);
}

export async function loadMoreHistory(symbol, resolution, source = 'ctrader') {
  const store = getChartBarStore(symbol, resolution);
  const current = await new Promise(resolve => store.subscribe(resolve)());

  if (current.state === STATE.FETCHING_MORE || current.bars.length === 0) return;

  store.set({ ...current, state: STATE.FETCHING_MORE });

  const fetchPeriod = resolutionToPeriod(resolution);

  if (!fetchPeriod) return;

  // Timeout to prevent permanent stuck FETCHING_MORE state
  const timerKey = storeKey(symbol, resolution);
  clearTimeout(loadingTimers.get(timerKey));
  loadingTimers.set(timerKey, setTimeout(() => {
    store.update(c => {
      if (c.state === STATE.FETCHING_MORE) {
        return { ...c, state: STATE.READY };
      }
      return c;
    });
    loadingTimers.delete(timerKey);
  }, LOADING_TIMEOUT_MS));

  const rangeLimit = PERIOD_RANGE_LIMITS[fetchPeriod];
  const oldestTimestamp = current.bars[0].timestamp;
  const chunkTo = oldestTimestamp;
  const chunkFrom = Math.max(oldestTimestamp - rangeLimit, 0);

  const sent = sendGetHistoricalCandles(symbol, resolution, chunkFrom, chunkTo, source);
  if (!sent) {
    store.set({ ...current, state: STATE.READY });
    clearTimeout(loadingTimers.get(timerKey));
    loadingTimers.delete(timerKey);
  }
}

/**
 * Clear all cached bars for a given symbol, resolution, and source.
 * Used when switching data sources to prevent stale cross-source data.
 */
export async function clearCachedBars(symbol, resolution, source) {
  await db.bars
    .where('[symbol+resolution+source+timestamp]')
    .between(
      [symbol, resolution, source, Dexie.minKey],
      [symbol, resolution, source, Dexie.maxKey],
      true, true
    )
    .delete();
}

// ============================================================================
// Message Handlers (called from system subscription)
// ============================================================================

function handleCandleUpdate(message) {
  if (!message.bar || !message.symbol || !message.timeframe) return;

  const { symbol, timeframe, bar, isBarClose, source: msgSource } = message;

  // Map incoming timeframe to the resolution key format
  // Backend sends cTrader period (e.g., 'H4', 'M1'), we store using resolution key (e.g., '4h', '1m')
  const resolution = periodToResolution(timeframe);
  if (!resolution) return;

  // Update the store for this resolution
  const store = getChartBarStore(symbol, resolution);
  store.update(current => {
    // Allow live updates during LOADING — they modify existing bars or append new ones.
    // The historical fetch does a full replace when it arrives, so live data won't conflict.
    // IDLE means no load was ever requested — skip those.
    if (current.state === STATE.IDLE) return current;

    const bars = [...current.bars];
    const existingIndex = bars.findIndex(b => b.timestamp === bar.timestamp);

    if (existingIndex >= 0) {
      bars[existingIndex] = bar;
    } else if (isBarClose || bars.length === 0 || bar.timestamp > bars[bars.length - 1].timestamp) {
      bars.push(bar);
      bars.sort((a, b) => a.timestamp - b.timestamp);
    }

    return { ...current, bars, state: current.state === STATE.FETCHING_MORE ? STATE.FETCHING_MORE : STATE.READY, error: null, updateType: 'incremental' };
  });

  // Persist live bar to IndexedDB
  putCachedBars(symbol, resolution, [bar], msgSource || 'ctrader').catch(err => {
    if (import.meta.env.DEV) {
      console.warn('[chartDataStore] Live bar cache write failed:', err);
    }
  });
}

function handleCandleHistory(message) {
  if (!message.bars || !message.symbol || !message.resolution) return;

  const { symbol, resolution, bars, currentPrice, source: msgSource } = message;

  // Inject currentPrice into marketDataStore so the per-tick live close
  // mechanism can render the correct close on the current bar immediately,
  // instead of waiting for the separate symbolDataPackage to arrive.
  if (currentPrice != null) {
    const marketStore = getMarketDataStore(symbol);
    marketStore.update(state => {
      if (state.current == null) {
        return { ...state, current: currentPrice };
      }
      return state;
    });
  }

  const store = getChartBarStore(symbol, resolution);

  // Clear loading timeout
  const timerKey = storeKey(symbol, resolution);
  clearTimeout(loadingTimers.get(timerKey));
  loadingTimers.delete(timerKey);

  // Use synchronous store.update to avoid race conditions
  store.update(current => {
    let resultBars;

    if (current.bars.length > 0) {
      // Merge incoming bars with existing bars (handles both progressive
      // loading and the race where live updates arrived before history)
      resultBars = [...bars, ...current.bars];
      resultBars.sort((a, b) => a.timestamp - b.timestamp);
      // Deduplicate: keep LAST occurrence (live data is fresher than history)
      resultBars = resultBars.filter((bar, i) =>
        i === resultBars.length - 1 || bar.timestamp !== resultBars[i + 1].timestamp
      );
    } else {
      // Initial load with no existing bars
      resultBars = bars;
    }

    return { bars: resultBars, state: STATE.READY, error: null, updateType: 'full' };
  });

  // Subscribe to real-time candle updates after initial load
  subscribeToCandles(symbol, resolution);

  // Cache bars in IndexedDB (fire-and-forget)
  const cacheSource = msgSource || 'ctrader';
  putCachedBars(symbol, resolution, bars, cacheSource)
    .then(() => evictStaleCache(symbol, resolution, cacheSource))
    .catch(() => {});
}

// ============================================================================
// Internal Helpers
// ============================================================================

function ensureConnectionManager() {
  if (!connectionManager) {
    connectionManager = ConnectionManager.getInstance(getWebSocketUrl());
    setupCandleMessageHandler();
  }
}

function sendGetHistoricalCandles(symbol, resolution, from, to, source = 'ctrader') {
  ensureConnectionManager();
  return connectionManager.sendRaw({
    type: 'getHistoricalCandles',
    symbol,
    resolution,
    from,
    to,
    source
  });
}

function sendSubscribeCandles(symbol, resolution, source = 'ctrader') {
  ensureConnectionManager();
  return connectionManager.sendRaw({
    type: 'subscribeCandles',
    symbol,
    resolution,
    source
  });
}

function sendUnsubscribeCandles(symbol, resolution, source = 'ctrader') {
  ensureConnectionManager();
  connectionManager.sendRaw({
    type: 'unsubscribeCandles',
    symbol,
    resolution,
    source
  });
}

function periodToResolution(period) {
  const map = {
    'M1': '1m', 'M5': '5m', 'M10': '10m', 'M15': '15m', 'M30': '30m',
    'H1': '1h', 'H4': '4h', 'H12': '12h',
    'D1': 'D', 'W1': 'W', 'MN1': 'M'
  };
  return map[period] ?? null;
}

