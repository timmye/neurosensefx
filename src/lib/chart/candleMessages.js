/**
 * Candle message handlers — processes candleUpdate/candleHistory WebSocket
 * messages. All dependencies injected via parameters.
 */

import { get } from 'svelte/store';
import { mergeTickBar, mergeHistoryBars } from './barMerge.js';
import { periodToResolution } from './resolutionMapping.js';

/** Handle a live candle update message. */
export function handleCandleUpdate(message, deps) {
  if (!message.bar || !message.symbol || !message.timeframe) return;

  const { symbol, timeframe, bar, isBarClose, source: msgSource } = message;
  const resolution = periodToResolution(timeframe);
  if (!resolution) return;

  const store = deps.getChartBarStore(symbol, resolution);
  store.update(current => {
    if (current.state === deps.STATE.IDLE) return current;

    const newBars = mergeTickBar(current.bars, bar, isBarClose);

    return {
      ...current,
      bars: newBars,
      state: current.state === deps.STATE.FETCHING_MORE
        ? deps.STATE.FETCHING_MORE : deps.STATE.READY,
      error: null,
      updateType: 'incremental'
    };
  });

  deps.putCachedBars(symbol, resolution, [bar], msgSource || 'ctrader').catch(err => {
    if (import.meta.env.DEV) {
      console.warn('[chartDataStore] Live bar cache write failed:', err);
    }
  });
}

/** Inject currentPrice into market data store for immediate live close rendering. */
export function injectCurrentPrice(currentPrice, symbol, deps) {
  if (currentPrice == null) return;

  const marketStore = deps.getMarketDataStore(symbol);
  marketStore.update(state => {
    if (state.current == null) {
      return { ...state, current: currentPrice };
    }
    return state;
  });
}

/** Handle a candle history response message. */
export function handleCandleHistory(message, deps) {
  if (!message.bars || !message.symbol || !message.resolution) return;

  const { symbol, resolution, bars, currentPrice, source: msgSource } = message;

  injectCurrentPrice(currentPrice, symbol, deps);

  const store = deps.getChartBarStore(symbol, resolution);

  const timerKey = deps.storeKey(symbol, resolution);
  clearTimeout(deps.loadingTimers.get(timerKey));
  deps.loadingTimers.delete(timerKey);

  store.update(current => {
    const resultBars = mergeHistoryBars(current.bars, bars);
    return { bars: resultBars, state: deps.STATE.READY, error: null, updateType: 'full' };
  });

  deps.subscribeToCandles(symbol, resolution);

  const cacheSource = msgSource || 'ctrader';
  deps.putCachedBars(symbol, resolution, bars, cacheSource)
    .then(() => deps.evictStaleCache(symbol, resolution, cacheSource))
    .catch(() => {});
}

/**
 * Register candle message handlers on the connection manager.
 * Caller must ensure idempotency (call only once).
 */
export function registerCandleHandlers(connectionManager, deps) {
  connectionManager.addSystemSubscription((data) => {
    if (data.type === 'candleUpdate') {
      handleCandleUpdate(data, deps);
    }
    if (data.type === 'candleHistory') {
      handleCandleHistory(data, deps);
    }
  });

  connectionManager.addSystemSubscription((data) => {
    if (data.type === 'ready') {
      const previousSubs = new Map(deps.candleSubscriptions);
      deps.candleSubscriptions.clear();

      for (const [key, storedSource] of previousSubs) {
        const [symbol, resolution] = key.split(':');
        const sent = deps.sendSubscribeCandles(symbol, resolution, storedSource);
        if (sent) {
          deps.candleSubscriptions.set(key, storedSource);
        }

        const barStore = deps.getChartBarStore(symbol, resolution);
        const current = get(barStore);

        if (current.bars.length > 0) {
          barStore.set({ ...current, state: deps.STATE.FETCHING_MORE });
          const to = Date.now();
          const from = current.bars[current.bars.length - 1].timestamp;
          deps.sendGetHistoricalCandles(symbol, resolution, from, to, storedSource);
        } else if (deps.loadHistoricalBars) {
          // Initial load failed (WS wasn't open) — retry full load
          deps.loadHistoricalBars(symbol, resolution, 0, Date.now(), storedSource);
        }
      }
    }
  });
}
