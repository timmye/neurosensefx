/**
 * Chart data loader factory: resets bar store, subscribes to bars + ticks
 * via single-writer reconciliation, triggers historical load.
 * Returns unsubscribe handle.
 */

import { getChartBarStore, loadHistoricalBars } from '../../stores/chartDataStore.js';
import { getMarketDataStore } from '../../stores/marketDataStore.js';
import {
  createReconcile,
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
  function loadChartData(symbol, resolution, window, source, onDataReady, windowMode = 'developing') {
    const store = getChartBarStore(symbol, resolution);
    store.set({ bars: [], state: 'loading', error: null });

    const marketStore = getMarketDataStore(symbol);

    const { unsubscribe: reconcileUnsub } = createReconcile(
      deps.chart, store, marketStore,
      {
        applyBarSpace: deps.applyBarSpace,
        chartContainer: deps.chartContainer,
        setPending: deps.setPending,
        onDataReady,
        chartSubs: deps.chartSubs,
      },
    );

    const { exact, buffered } = computeFetchRange(window, windowMode);
    loadHistoricalBars(symbol, resolution, buffered.from, buffered.to, source);

    return { barUnsub: reconcileUnsub, rangeFrom: exact.from, fetchFrom: buffered.from };
  }

  return { loadChartData };
}
