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
import {
  resolutionToPeriod,
  PERIOD_RANGE_LIMITS,
  CACHE_MAX_BARS,
  RESOLUTION_MS
} from '../lib/chart/chartConfig.js';

// ============================================================================
// IndexedDB via Dexie.js
// ============================================================================

const db = new Dexie('NeuroSenseChart');
db.version(1).stores({
  bars: '[symbol+resolution+timestamp], symbol, resolution, timestamp'
});

// ============================================================================
// Internal State
// ============================================================================

const chartBarStores = new Map();
const candleSubscriptions = new Map();
const aggregationTargets = new Map(); // 'symbol:1m' -> Set<targetResolution>
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

async function getCachedBars(symbol, resolution, fromTimestamp, toTimestamp) {
  return db.bars
    .where('[symbol+resolution+timestamp]')
    .between(
      [symbol, resolution, fromTimestamp],
      [symbol, resolution, toTimestamp],
      true, true
    )
    .sortBy('timestamp');
}

async function putCachedBars(symbol, resolution, bars) {
  if (!bars || bars.length === 0) return;

  const now = Date.now();
  const records = bars.map(bar => ({
    symbol,
    resolution,
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

async function evictStaleCache(resolution) {
  const maxBars = CACHE_MAX_BARS[resolution];
  if (!maxBars) return;

  const count = await db.bars
    .where('resolution')
    .equals(resolution)
    .count();

  if (count <= maxBars) return;

  const oldest = await db.bars
    .where('resolution')
    .equals(resolution)
    .offset(maxBars)
    .sortBy('timestamp');

  if (oldest.length === 0) return;

  const keysToDelete = oldest.map(bar => [bar.symbol, bar.resolution, bar.timestamp]);
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

      for (const [key] of previousSubs) {
        const [symbol, resolution] = key.split(':');
        // The subscription key is the backend resolution (e.g., '1m' for aggregated)
        const sent = sendSubscribeCandles(symbol, resolution);
        if (sent) {
          candleSubscriptions.set(key, true);
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

export async function loadHistoricalBars(symbol, resolution, fromTimestamp, toTimestamp) {
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
    const cachedBars = await getCachedBars(symbol, resolution, fromTimestamp, toTimestamp);

    if (cachedBars.length > 0) {
      // Reject stale cache: bars last written more than 2 bar-periods ago are too old to trust
      const barPeriodMs = RESOLUTION_MS[resolution];
      const maxAgeMs = barPeriodMs ? Math.min(barPeriodMs * 2, 3_600_000) : 3_600_000;
      const newestBar = cachedBars[cachedBars.length - 1];
      const isStale = newestBar.updatedAt && (Date.now() - newestBar.updatedAt) > maxAgeMs;

      if (!isStale) {
        // Clear loading timeout on cache hit
        clearTimeout(loadingTimers.get(storeKey(symbol, resolution)));
        loadingTimers.delete(storeKey(symbol, resolution));

        store.set({ bars: cachedBars, state: STATE.READY, error: null, updateType: 'full' });

        // Track subscription and send for real-time updates
        subscribeToCandles(symbol, resolution);
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
  subscribeToCandles(symbol, resolution);

  // Cache miss — fetch from backend
  if (!fetchPeriod) {
    store.set({ bars: [], state: STATE.READY, error: `Unknown resolution: ${resolution}` });
    return;
  }

  // Send full range to backend — it chains requests internally per period limits
  const sent = sendGetHistoricalCandles(symbol, resolution, fromTimestamp, toTimestamp);
  if (!sent) {
    store.set({ bars: [], state: STATE.READY, error: 'WebSocket not connected' });
  }
}

function registerAggregationTarget(symbol, resolution) {
  const m1Key = storeKey(symbol, '1m');
  if (!aggregationTargets.has(m1Key)) aggregationTargets.set(m1Key, new Set());
  aggregationTargets.get(m1Key).add(resolution);
  // Do NOT subscribe to the target period directly. cTrader only sends M1
  // trendbar data in spot events; the backend fallback path relabels that M1
  // data as the target period, creating fake bars with M1 timestamps on H4/H1
  // charts. M1 aggregation (in handleCandleUpdate) is the correct live-data
  // path for non-M1 timeframes.
}

function subscribeToCandles(symbol, resolution) {
  const needsAggregation = resolution !== '1m';
  const key = storeKey(symbol, needsAggregation ? '1m' : resolution);

  if (candleSubscriptions.has(key)) {
    // Already subscribed to the base period — just register aggregation target
    if (needsAggregation) {
      registerAggregationTarget(symbol, resolution);
    }
    return;
  }

  const sent = sendSubscribeCandles(symbol, needsAggregation ? '1m' : resolution);
  if (sent) {
    candleSubscriptions.set(key, true);
    if (needsAggregation) {
      registerAggregationTarget(symbol, resolution);
    }
  }
}

export function unsubscribeFromCandles(symbol, resolution) {
  const needsAggregation = resolution !== '1m';
  const m1Key = storeKey(symbol, '1m');

  if (needsAggregation) {
    const targets = aggregationTargets.get(m1Key);
    if (targets) {
      targets.delete(resolution);
      if (targets.size === 0) {
        aggregationTargets.delete(m1Key);
        // No more aggregation targets — clean up M1 subscription too
        const m1SubKey = storeKey(symbol, '1m');
        if (candleSubscriptions.has(m1SubKey)) {
          candleSubscriptions.delete(m1SubKey);
          sendUnsubscribeCandles(symbol, '1m');
        }
      }
    }
  } else {
    const key = storeKey(symbol, resolution);
    if (!candleSubscriptions.has(key)) return;
    candleSubscriptions.delete(key);
    sendUnsubscribeCandles(symbol, resolution);
  }
}

export async function loadMoreHistory(symbol, resolution) {
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

  const sent = sendGetHistoricalCandles(symbol, resolution, chunkFrom, chunkTo);
  if (!sent) {
    store.set({ ...current, state: STATE.READY });
    clearTimeout(loadingTimers.get(timerKey));
    loadingTimers.delete(timerKey);
  }
}

// ============================================================================
// Message Handlers (called from system subscription)
// ============================================================================

function handleCandleUpdate(message) {
  if (!message.bar || !message.symbol || !message.timeframe) return;

  const { symbol, timeframe, bar, isBarClose } = message;

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
  putCachedBars(symbol, resolution, [bar]).catch(err => {
    if (import.meta.env.DEV) {
      console.warn('[chartDataStore] Live bar cache write failed:', err);
    }
  });

  if (timeframe === 'M1') {
    const m1Key = storeKey(symbol, '1m');
    const targets = aggregationTargets.get(m1Key);
    if (targets && targets.size > 0) {
      for (const targetResolution of targets) {
        const targetStore = getChartBarStore(symbol, targetResolution);
        targetStore.update(current => {
          if (current.state === STATE.IDLE || !current.bars.length) return current;
          const bars = [...current.bars];
          const last = bars[bars.length - 1];
          bars[bars.length - 1] = {
            ...last,
            close: bar.close,
            high: Math.max(last.high, bar.high),
            low: Math.min(last.low, bar.low),
          };
          return { ...current, bars, state: current.state === STATE.FETCHING_MORE ? STATE.FETCHING_MORE : STATE.READY, error: null, updateType: 'incremental' };
        });
      }
    }
  }
}

function handleCandleHistory(message) {
  if (!message.bars || !message.symbol || !message.resolution) return;

  const { symbol, resolution, bars } = message;

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

  // Cache bars in IndexedDB (fire-and-forget) — use original resolution for cache key
  putCachedBars(symbol, resolution, bars)
    .then(() => evictStaleCache(resolution))
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

function sendGetHistoricalCandles(symbol, resolution, from, to) {
  ensureConnectionManager();
  return connectionManager.sendRaw({
    type: 'getHistoricalCandles',
    symbol,
    resolution,
    from,
    to
  });
}

function sendSubscribeCandles(symbol, resolution) {
  ensureConnectionManager();
  return connectionManager.sendRaw({
    type: 'subscribeCandles',
    symbol,
    resolution
  });
}

function sendUnsubscribeCandles(symbol, resolution) {
  ensureConnectionManager();
  connectionManager.sendRaw({
    type: 'unsubscribeCandles',
    symbol,
    resolution
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

