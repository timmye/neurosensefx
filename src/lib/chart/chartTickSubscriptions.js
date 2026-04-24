/**
 * Chart data subscription helpers.
 *
 * Architecture: single-writer reconciliation.
 * Both the bar store (candle data) and the market store (tick data) feed into
 * one reconcile() function that is the ONLY caller of chart.updateData() /
 * chart.applyNewData(). This prevents dual-writer race conditions that cause
 * the developing bar to flicker.
 */

import {
  getCalendarAlignedRange,
  getRollingRange,
} from './chartConfig.js';

/** Map a bar object to KLineChart data shape. */
export function mapBarToKline(bar) {
  return {
    timestamp: bar.timestamp,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume || 0,
  };
}

/** Apply new data to chart, then barSpace + scroll in next rAF. */
export function applyDataToChart(chart, klineData, applyBarSpace) {
  if (!chart) return;
  chart.applyNewData(klineData);
  requestAnimationFrame(() => {
    if (chart) {
      applyBarSpace();
      chart.scrollToRealTime();
    }
  });
}

/** Apply data immediately if container has size, otherwise defer. */
export function tryApplyData(chart, chartContainer, klineData, applyBarSpace, setPending) {
  if (chartContainer.clientWidth > 0 && chartContainer.clientHeight > 0) {
    applyDataToChart(chart, klineData, applyBarSpace);
  } else {
    setPending(klineData);
  }
}

/** Compute fetch range and return { exact, buffered }. Mode: 'developing' (calendar-aligned) or 'rolling'. */
export function computeFetchRange(window, mode = 'developing') {
  const rangeFn = mode === 'rolling' ? getRollingRange : getCalendarAlignedRange;
  return {
    exact: rangeFn(window, 0),
    buffered: rangeFn(window, 1),
  };
}

/**
 * Single-writer reconciliation: subscribe to both bar store and market store,
 * merge their state, and write to the chart exactly once per animation frame.
 *
 * - Bar store drives full replaces and new-bar appends.
 * - Market store drives developing-bar close/high/low updates.
 * - A single rAF guard ensures at most one chart.write per frame.
 *
 * @param {object} chart - KLineChart instance (may be null if minimized)
 * @param {import('svelte/store').Writable} barStore - chart bar store
 * @param {import('svelte/store').Writable} marketStore - market data store
 * @param {object} deps
 * @param {function} deps.applyBarSpace
 * @param {HTMLElement} deps.chartContainer
 * @param {function} deps.setPending
 * @param {function} [deps.onDataReady]
 * @param {object} deps.chartSubs
 * @returns {{ unsubscribe: () => void }} unsubscribe handle
 */
export function createReconcile(chart, barStore, marketStore, deps) {
  const { applyBarSpace, chartContainer, setPending, onDataReady, chartSubs } = deps;
  let initialFullReceived = false;
  let dataReadyCb = onDataReady;
  let rAFScheduled = false;
  let pendingTickPrice = null;
  let pendingNewBar = null;
  let pendingFullData = null;

  function scheduleFrame() {
    if (rAFScheduled) return;
    rAFScheduled = true;
    requestAnimationFrame(() => {
      rAFScheduled = false;
      flush();
    });
  }

  function flush() {
    // Priority 1: full data replace (initial load or history refresh)
    if (pendingFullData) {
      const klineData = pendingFullData;
      pendingFullData = null;
      // Drain any pending new-bar or tick — they'll be stale after full replace
      pendingNewBar = null;
      pendingTickPrice = null;
      tryApplyData(chart, chartContainer, klineData, applyBarSpace, setPending);
      return;
    }

    // Priority 2: new bar from candle store (different timestamp)
    if (pendingNewBar) {
      const bar = pendingNewBar;
      pendingNewBar = null;
      chart.updateData(bar);
    }

    // Priority 3: tick price update on developing bar
    if (pendingTickPrice != null && chart) {
      const price = pendingTickPrice;
      pendingTickPrice = null;
      const dataList = chart.getDataList();
      if (!dataList || dataList.length === 0) return;
      const last = dataList[dataList.length - 1];
      chart.updateData({
        timestamp: last.timestamp,
        open: last.open,
        high: Math.max(last.high, price),
        low: Math.min(last.low, price),
        close: price,
        volume: last.volume || 0,
      });
    }
  }

  // --- Bar store subscription ---
  const barUnsub = barStore.subscribe(data => {
    if (data.state !== 'ready' || data.bars.length === 0) return;

    if (data.updateType === 'full') {
      initialFullReceived = true;
      pendingFullData = data.bars.map(mapBarToKline);
      if (dataReadyCb) {
        const cb = dataReadyCb;
        dataReadyCb = null;
        chartSubs.subscribeOnDataReady(() => cb());
      }
      scheduleFrame();
      return;
    }

    if (!initialFullReceived) return;

    // Only push a new bar when the timestamp differs from the chart's last bar.
    // Same-timestamp updates (developing bar OHLC from candle store) are skipped —
    // the tick path handles the developing bar's close/high/low.
    const dataList = chart?.getDataList();
    const chartLastTs = dataList?.length > 0
      ? dataList[dataList.length - 1].timestamp : null;
    const bar = data.bars[data.bars.length - 1];
    if (bar.timestamp !== chartLastTs) {
      pendingNewBar = mapBarToKline(bar);
      scheduleFrame();
    }
  });

  // --- Market store subscription ---
  const tickUnsub = marketStore.subscribe(mdata => {
    if (!chart || mdata.current == null) return;
    pendingTickPrice = mdata.current;
    scheduleFrame();
  });

  return {
    unsubscribe() {
      barUnsub();
      tickUnsub();
    },
  };
}
