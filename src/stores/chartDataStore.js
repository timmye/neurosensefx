/**
 * Chart Data Store — OHLC bar management per symbol:resolution.
 * State machine: IDLE -> LOADING -> READY -> FETCHING_MORE
 * @module chartDataStore
 */

import { writable } from 'svelte/store';
import { getMarketDataStore } from './marketDataStore.js';
import { resolutionToPeriod, PERIOD_RANGE_LIMITS } from '../lib/chart/chartConfig.js';
import { getCachedBars, putCachedBars, evictStaleCache } from '../lib/chart/barCache.js';
import { checkCacheFreshness } from '../lib/chart/cacheFreshness.js';
import { registerCandleHandlers } from '../lib/chart/candleMessages.js';
import { ensureConnectionManager, sendGetHistoricalCandles, sendSubscribeCandles, sendUnsubscribeCandles } from '../lib/chart/chartRequests.js';

const chartBarStores = new Map();
const candleSubscriptions = new Map();
let _candleHandlerSetup = false;

const STATE = { IDLE: 'idle', LOADING: 'loading', READY: 'ready', FETCHING_MORE: 'fetching_more' };
const LOADING_TIMEOUT_MS = 30_000;
const loadingTimers = new Map();

const storeKey = (symbol, resolution) => `${symbol}:${resolution}`;

function buildCandleDeps() {
  return { getChartBarStore, getMarketDataStore, storeKey, subscribeToCandles, putCachedBars, evictStaleCache, sendSubscribeCandles, sendGetHistoricalCandles, loadHistoricalBars, loadingTimers, candleSubscriptions, STATE, getConnectionManager: ensureConnectionManager };
}

function setupCandleMessageHandler() {
  if (_candleHandlerSetup) return;
  _candleHandlerSetup = true;
  registerCandleHandlers(ensureConnectionManager(), buildCandleDeps());
}

export function getChartBarStore(symbol, resolution) {
  const key = storeKey(symbol, resolution);
  if (!chartBarStores.has(key)) {
    chartBarStores.set(key, writable({ bars: [], state: STATE.IDLE, error: null }));
  }
  return chartBarStores.get(key);
}

function subscribeToCandles(symbol, resolution, source = 'ctrader') {
  const key = storeKey(symbol, resolution);
  if (candleSubscriptions.has(key)) return;
  setupCandleMessageHandler();
  candleSubscriptions.set(key, source);
  sendSubscribeCandles(symbol, resolution, source);
}

export function unsubscribeFromCandles(symbol, resolution, source = 'ctrader') {
  const key = storeKey(symbol, resolution);
  if (!candleSubscriptions.has(key)) return;
  candleSubscriptions.delete(key);
  sendUnsubscribeCandles(symbol, resolution, source);
}

function startLoadingTimeout(store, key) {
  clearTimeout(loadingTimers.get(key));
  loadingTimers.set(key, setTimeout(() => {
    store.update(c => c.state === STATE.LOADING
      ? { ...c, state: STATE.READY, error: 'Loading timed out' } : c);
    loadingTimers.delete(key);
  }, LOADING_TIMEOUT_MS));
}

export async function loadHistoricalBars(symbol, resolution, fromTimestamp, toTimestamp, source = 'ctrader') {
  const store = getChartBarStore(symbol, resolution);
  const fetchPeriod = resolutionToPeriod(resolution);
  const key = storeKey(symbol, resolution);

  store.set({ bars: [], state: STATE.LOADING, error: null });
  startLoadingTimeout(store, key);

  try {
    const cachedBars = await getCachedBars(symbol, resolution, fromTimestamp, toTimestamp, source);
    if (cachedBars.length > 0 && checkCacheFreshness(cachedBars, resolution).fresh) {
      clearTimeout(loadingTimers.get(key));
      loadingTimers.delete(key);
      store.set({ bars: cachedBars, state: STATE.READY, error: null, updateType: 'full' });
      subscribeToCandles(symbol, resolution, source);
      return;
    }
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[chartDataStore] Cache read failed, fetching from backend:', err);
  }

  subscribeToCandles(symbol, resolution, source);
  if (!fetchPeriod) {
    store.set({ bars: [], state: STATE.READY, error: `Unknown resolution: ${resolution}` });
    return;
  }
  sendGetHistoricalCandles(symbol, resolution, fromTimestamp, toTimestamp, source);
}

export async function loadMoreHistory(symbol, resolution, source = 'ctrader') {
  const store = getChartBarStore(symbol, resolution);
  const current = await new Promise(resolve => store.subscribe(resolve)());
  if (current.state === STATE.FETCHING_MORE || current.bars.length === 0) return;

  store.set({ ...current, state: STATE.FETCHING_MORE });
  const fetchPeriod = resolutionToPeriod(resolution);
  if (!fetchPeriod) return;

  const timerKey = storeKey(symbol, resolution);
  clearTimeout(loadingTimers.get(timerKey));
  loadingTimers.set(timerKey, setTimeout(() => {
    store.update(c => c.state === STATE.FETCHING_MORE ? { ...c, state: STATE.READY } : c);
    loadingTimers.delete(timerKey);
  }, LOADING_TIMEOUT_MS));

  const rangeLimit = PERIOD_RANGE_LIMITS[fetchPeriod];
  const oldest = current.bars[0].timestamp;
  sendGetHistoricalCandles(symbol, resolution, Math.max(oldest - rangeLimit, 0), oldest, source);
}
