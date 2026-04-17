/**
 * Chart data loader factory: resets bar store, subscribes to bars + ticks,
 * triggers historical load. Returns unsubscribe handles.
 */

import { getChartBarStore, loadHistoricalBars } from '../../stores/chartDataStore.js';
import { getMarketDataStore } from '../../stores/marketDataStore.js';
import {
  subscribeToBarStore,
  subscribeToLiveTicks,
  computeFetchRange,
} from './chartTickSubscriptions.js';

/**
 * Create a chart data loader.
 *
 * @param {object} deps
 * @param {object|null} deps.chart - KLineChart instance
 * @param {HTMLElement} deps.chartContainer - chart container DOM element
 * @param {function} deps.applyBarSpace - bar space applier
 * @param {function} deps.setPending - set pendingDataApply ref
 * @param {object} deps.chartSubs - per-instance subscription manager
 */
export function createChartDataLoader(deps) {
  function loadChartData(symbol, resolution, window, source, onDataReady) {
    const store = getChartBarStore(symbol, resolution);
    store.set({ bars: [], state: 'loading', error: null });

    const barUnsub = subscribeToBarStore(store, deps.chart, {
      applyBarSpace: deps.applyBarSpace,
      chartContainer: deps.chartContainer,
      setPending: deps.setPending,
      onDataReady,
      chartSubs: deps.chartSubs,
    });

    const marketStore = getMarketDataStore(symbol);
    const tickUnsub = subscribeToLiveTicks(marketStore, deps.chart);

    const { exact, buffered } = computeFetchRange(window);
    loadHistoricalBars(symbol, resolution, buffered.from, buffered.to, source);

    return { barUnsub, tickUnsub, rangeFrom: exact.from, fetchFrom: buffered.from };
  }

  return { loadChartData };
}
