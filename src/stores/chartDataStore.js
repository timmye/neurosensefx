/**
 * Chart Data Store
 *
 * Manages OHLC bar arrays per symbol:resolution. Handles historical candle
 * loading, real-time candle subscriptions, IndexedDB caching via Dexie.js,
 * progressive (scroll-driven) loading, and quarterly aggregation from MN1 bars.
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
  windowToMs,
  PERIOD_RANGE_LIMITS,
  DEFAULT_RESOLUTION_WINDOW,
  CACHE_MAX_BARS
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
let connectionManager = null;
let _candleHandlerSetup = false;

// State machine constants
const STATE = {
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  FETCHING_MORE: 'fetching_more'
};

// ============================================================================
// Store Key Helper
// ============================================================================

function storeKey(symbol, resolution) {
  return `${symbol}:${resolution}`;
}

// ============================================================================
// Quarterly Aggregation
// ============================================================================

function aggregateMN1toQuarterly(bars) {
  if (!bars || bars.length === 0) return [];

  const quarters = [];
  let current = null;

  for (const bar of bars) {
    const date = new Date(bar.timestamp);
    const quarterMonth = Math.floor(date.getUTCMonth() / 3) * 3;
    const quarterLabel = `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;

    if (!current || current._quarterLabel !== quarterLabel) {
      if (current) {
        quarters.push({
          open: current.open,
          high: current.high,
          low: current.low,
          close: current.close,
          volume: current.volume,
          timestamp: current.timestamp
        });
      }
      current = {
        _quarterLabel: quarterLabel,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume || 0,
        timestamp: bar.timestamp
      };
    } else {
      current.high = Math.max(current.high, bar.high);
      current.low = Math.min(current.low, bar.low);
      current.close = bar.close;
      current.volume = (current.volume || 0) + (bar.volume || 0);
    }
  }

  if (current) {
    quarters.push({
      open: current.open,
      high: current.high,
      low: current.low,
      close: current.close,
      volume: current.volume,
      timestamp: current.timestamp
    });
  }

  return quarters;
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
  const isQuarterly = resolution === 'Q';
  const fetchResolution = isQuarterly ? 'M' : resolution;
  const fetchPeriod = resolutionToPeriod(fetchResolution);

  store.set({ bars: [], state: STATE.LOADING, error: null });

  // Check IndexedDB cache first
  try {
    const cachedBars = await getCachedBars(symbol, fetchResolution, fromTimestamp, toTimestamp);

    if (cachedBars.length > 0) {
      const bars = isQuarterly ? aggregateMN1toQuarterly(cachedBars) : cachedBars;
      store.set({ bars, state: STATE.READY, error: null });

      // Send subscription for real-time updates
      sendSubscribeCandles(symbol, fetchResolution);
      return;
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[chartDataStore] Cache read failed, fetching from backend:', err);
    }
  }

  // Cache miss — fetch from backend
  if (!fetchPeriod) {
    store.set({ bars: [], state: STATE.READY, error: `Unknown resolution: ${resolution}` });
    return;
  }

  const rangeLimit = PERIOD_RANGE_LIMITS[fetchPeriod];
  const totalRange = toTimestamp - fromTimestamp;
  let effectiveFrom = fromTimestamp;

  // If request range exceeds per-request limit, start from what we can get
  if (totalRange > rangeLimit) {
    effectiveFrom = toTimestamp - rangeLimit;
  }

  const sent = sendGetHistoricalCandles(symbol, fetchResolution, effectiveFrom, toTimestamp);
  if (!sent) {
    store.set({ bars: [], state: STATE.READY, error: 'WebSocket not connected' });
  }
}

export function subscribeToCandles(symbol, resolution) {
  const fetchResolution = resolution === 'Q' ? 'M' : resolution;
  const key = storeKey(symbol, fetchResolution);

  if (candleSubscriptions.has(key)) return;

  candleSubscriptions.set(key, true);
  sendSubscribeCandles(symbol, fetchResolution);
}

export function unsubscribeFromCandles(symbol, resolution) {
  const fetchResolution = resolution === 'Q' ? 'M' : resolution;
  const key = storeKey(symbol, fetchResolution);

  if (!candleSubscriptions.has(key)) return;

  candleSubscriptions.delete(key);
  sendUnsubscribeCandles(symbol, fetchResolution);
}

export async function changeResolution(oldResolution, newResolution, symbol) {
  unsubscribeFromCandles(symbol, oldResolution);

  const defaultWindow = DEFAULT_RESOLUTION_WINDOW[newResolution] || '3M';
  const windowMs = windowToMs(defaultWindow);
  const to = Date.now();
  const from = to - windowMs * 2;

  await loadHistoricalBars(symbol, newResolution, from, to);
}

export async function changeSymbol(oldSymbol, newSymbol, resolution) {
  unsubscribeFromCandles(oldSymbol, resolution);

  const defaultWindow = DEFAULT_RESOLUTION_WINDOW[resolution] || '3M';
  const windowMs = windowToMs(defaultWindow);
  const to = Date.now();
  const from = to - windowMs * 2;

  await loadHistoricalBars(newSymbol, resolution, from, to);
}

export async function loadMoreHistory(symbol, resolution) {
  const store = getChartBarStore(symbol, resolution);
  const current = await new Promise(resolve => store.subscribe(resolve)());

  if (current.state === STATE.FETCHING_MORE || current.bars.length === 0) return;

  store.set({ ...current, state: STATE.FETCHING_MORE });

  const isQuarterly = resolution === 'Q';
  const fetchResolution = isQuarterly ? 'M' : resolution;
  const fetchPeriod = resolutionToPeriod(fetchResolution);

  if (!fetchPeriod) return;

  const rangeLimit = PERIOD_RANGE_LIMITS[fetchPeriod];
  const oldestTimestamp = current.bars[0].timestamp;
  const chunkTo = oldestTimestamp;
  const chunkFrom = Math.max(oldestTimestamp - rangeLimit, 0);

  const sent = sendGetHistoricalCandles(symbol, fetchResolution, chunkFrom, chunkTo);
  if (!sent) {
    store.set({ ...current, state: STATE.READY });
  }
}

// ============================================================================
// Message Handlers (called from system subscription)
// ============================================================================

export function handleCandleUpdate(message) {
  if (!message.bar || !message.symbol || !message.timeframe) return;

  const { symbol, timeframe, bar, isBarClose } = message;

  // Map incoming timeframe to the resolution key format
  // Backend sends cTrader period (e.g., 'H4', 'M1'), we store using resolution key (e.g., '4h', '1m')
  const resolution = periodToResolution(timeframe);
  if (!resolution) return;

  // Update the store for this resolution
  const store = getChartBarStore(symbol, resolution);
  store.update(current => {
    if (current.state === STATE.IDLE) return current;

    const bars = [...current.bars];
    const existingIndex = bars.findIndex(b => b.timestamp === bar.timestamp);

    if (existingIndex >= 0) {
      bars[existingIndex] = bar;
    } else if (isBarClose || bars.length === 0 || bar.timestamp > bars[bars.length - 1].timestamp) {
      bars.push(bar);
      bars.sort((a, b) => a.timestamp - b.timestamp);
    }

    return { ...current, bars, state: STATE.READY, error: null };
  });

  // If this is an MN1 bar, also update the Q (quarterly) store
  if (timeframe === 'MN1') {
    updateQuarterlyStore(symbol, resolution, bar);
  }
}

export async function handleCandleHistory(message) {
  if (!message.bars || !message.symbol || !message.resolution) return;

  const { symbol, resolution, bars } = message;
  const store = getChartBarStore(symbol, resolution);
  const current = await new Promise(resolve => store.subscribe(resolve)());

  // Cache bars in IndexedDB
  try {
    await putCachedBars(symbol, resolution, bars);
    await evictStaleCache(resolution);
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[chartDataStore] Cache write failed:', err);
    }
  }

  if (current.state === STATE.FETCHING_MORE) {
    // Prepend older bars for progressive loading
    const mergedBars = [...bars, ...current.bars];
    mergedBars.sort((a, b) => a.timestamp - b.timestamp);

    store.set({ bars: mergedBars, state: STATE.READY, error: null });
  } else {
    // Initial load
    store.set({ bars, state: STATE.READY, error: null });
  }
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
  connectionManager.sendRaw({
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

async function updateQuarterlyStore(symbol, _resolution, newBar) {
  const store = getChartBarStore(symbol, 'Q');
  store.update(current => {
    if (current.state === STATE.IDLE) return current;

    const date = new Date(newBar.timestamp);
    const quarterMonth = Math.floor(date.getUTCMonth() / 3) * 3;
    const quarterLabel = `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;

    const bars = [...current.bars];
    const qIndex = bars.findIndex(b => {
      const bd = new Date(b.timestamp);
      const bQ = `${bd.getUTCFullYear()}-Q${Math.floor(bd.getUTCMonth() / 3) + 1}`;
      return bQ === quarterLabel;
    });

    if (qIndex >= 0) {
      const existing = bars[qIndex];
      bars[qIndex] = {
        ...existing,
        high: Math.max(existing.high, newBar.high),
        low: Math.min(existing.low, newBar.low),
        close: newBar.close,
        volume: (existing.volume || 0) + (newBar.volume || 0)
      };
    }

    return { ...current, bars };
  });
}

export function clearChartStore(symbol, resolution) {
  const key = storeKey(symbol, resolution);
  chartBarStores.delete(key);
  candleSubscriptions.delete(key);
}

export function clearAllChartStores() {
  chartBarStores.clear();
  candleSubscriptions.clear();
}
