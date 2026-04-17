/**
 * Pure subscription helpers for chart data loading.
 * These are stateless functions that create store subscriptions.
 */

import {
  getCalendarAlignedRange,
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

/** Compute calendar-aligned fetch range and return { exact, buffered }. */
export function computeFetchRange(window) {
  return {
    exact: getCalendarAlignedRange(window, 0),
    buffered: getCalendarAlignedRange(window, 1),
  };
}

/** Subscribe to bar store: full replaces + incremental new-bar updates. */
export function subscribeToBarStore(store, chart, deps) {
  const { applyBarSpace, chartContainer, setPending, onDataReady, chartSubs } = deps;
  let initialFullReceived = false;
  let dataReadyCb = onDataReady;

  return store.subscribe(data => {
    if (data.state !== 'ready' || data.bars.length === 0) return;

    if (data.updateType === 'full') {
      initialFullReceived = true;
      const klineData = data.bars.map(mapBarToKline);
      tryApplyData(chart, chartContainer, klineData, applyBarSpace, setPending);
      if (dataReadyCb) {
        const cb = dataReadyCb;
        dataReadyCb = null;
        chartSubs.subscribeOnDataReady(() => cb());
      }
      return;
    }

    if (!initialFullReceived) return;

    const dataList = chart.getDataList();
    const chartLastTs = dataList?.length > 0
      ? dataList[dataList.length - 1].timestamp : null;
    const bar = data.bars[data.bars.length - 1];
    if (bar.timestamp !== chartLastTs) {
      chart.updateData(mapBarToKline(bar));
    }
  });
}

/** Subscribe to live tick store for rAF-batched last-bar close updates. */
export function subscribeToLiveTicks(marketStore, chart) {
  let pendingTick = false;
  let pendingPrice = null;

  return marketStore.subscribe(mdata => {
    if (!chart || mdata.current == null) return;
    pendingPrice = mdata.current;
    if (!pendingTick) {
      pendingTick = true;
      requestAnimationFrame(() => {
        pendingTick = false;
        if (!chart || pendingPrice == null) return;
        const dataList = chart.getDataList();
        if (!dataList || dataList.length === 0) return;
        const last = dataList[dataList.length - 1];
        chart.updateData({
          timestamp: last.timestamp,
          open: last.open,
          high: Math.max(last.high, pendingPrice),
          low: Math.min(last.low, pendingPrice),
          close: pendingPrice,
          volume: last.volume || 0,
        });
        pendingPrice = null;
      });
    }
  });
}
