/**
 * Chart lifecycle: initialization, resize observer, indicators, actions,
 * interact.js, and wheel handler setup. Used by ChartDisplay.svelte onMount.
 */

import { scheduleResize } from './chartResize.js';
import { loadMoreHistory } from '../../stores/chartDataStore.js';

/**
 * Create a resize observer on chartContainer that coalesces resizes.
 * Returns the ResizeObserver instance.
 */
export function setupResizeObserver(chartContainer, chart, applyBarSpace, pendingDataApplyRef, resizeState) {
  const observer = new ResizeObserver(() => {
    scheduleResize(chart, applyBarSpace, pendingDataApplyRef, resizeState);
  });
  observer.observe(chartContainer);
  return observer;
}

/**
 * Set up chart indicators: Bollinger Bands on candle pane, AD in bottom pane.
 */
export function setupIndicators(chart, createWatermarkIndicator) {
  chart.createIndicator('BOLL', false, { id: 'candle_pane' });
  chart.createIndicator('AD', false, { position: 'bottom', height: 120 });
  createWatermarkIndicator();
}

/**
 * Set up KLineChart action subscriptions: zoom re-lock, progressive loading.
 * @param {object} chartSubs - per-instance subscription manager from createChartSubscriptions()
 */
export function setupChartActions(chart, chartSubs, deps) {
  const { applyBarSpace, currentSymbol, currentResolution, currentSource } = deps;

  chartSubs.subscribeZoom(() => {
    applyBarSpace();
    chart.scrollToRealTime();
  });

  chartSubs.subscribeVisibleRangeChange(() => {
    if (deps.isLoadingMore) return;
    const dataList = chart.getDataList();
    if (!dataList || dataList.length === 0) return;

    const range = chart.getVisibleRange();
    const edgeThreshold = Math.max(10, Math.floor(dataList.length * 0.15));

    if (range.from <= edgeThreshold) {
      deps.isLoadingMore = true;
      loadMoreHistory(currentSymbol, currentResolution, currentSource)
        .finally(() => { deps.isLoadingMore = false; });
    }
  });
}

/**
 * Set up interact.js drag/resize on the display element.
 * Returns the interactable instance.
 */
export function setupInteract(element, display, workspaceActions, createInteractConfig) {
  return createInteractConfig(element, {
    ignoreFrom: '.chart-canvas-container, .chart-toolbar button, .chart-toolbar span',
    onDragMove: (e) => workspaceActions.updatePosition(display.id, { x: e.rect.left, y: e.rect.top }),
    onResizeMove: (event) => {
      workspaceActions.updateSize(display.id, { width: event.rect.width, height: event.rect.height });
    },
    onTap: () => workspaceActions.bringToFront(display.id),
  });
}

/**
 * Set up vertical-wheel -> horizontal-scroll handler.
 * Returns the wheel handler function (for removal in onDestroy).
 */
export function setupWheelHandler(chartContainer, chart) {
  const handler = (e) => {
    if (!chart) return;
    e.preventDefault();
    const distance = e.deltaX || e.deltaY;
    if (distance !== 0) chart.scrollByDistance(distance);
  };
  chartContainer?.addEventListener('wheel', handler, { passive: false });
  return handler;
}

/**
 * Initialize KLineChart: create instance, wire subscriptions, set axis,
 * and apply theme. Returns the chart instance.
 */
export function initChart(chartContainer, deps) {
  const { LIGHT_THEME, formatAxisLabel, setAxisChart, setAxisWindow, currentWindow } = deps;
  const chart = deps.init(chartContainer, { styles: LIGHT_THEME });

  chart.setCustomApi({ formatDate: formatAxisLabel });
  chart.setTimezone('UTC');

  setAxisChart(chart);
  setAxisWindow(currentWindow, chart);
  chart.setPaneOptions({ id: 'x_axis_pane', axisOptions: { name: 'calendar' } });

  return chart;
}
