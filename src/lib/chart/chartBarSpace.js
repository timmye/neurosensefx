/**
 * Bar space calculation: compute candle width to fit the time window in the
 * container, with data-aware fallback using actual candle count.
 */

import {
  TIMEFRAME_BAR_SPACE,
  calcBarSpace,
  windowToMs,
} from './chartConfig.js';

/**
 * Binary-search the dataList for the first candle at or after fromTs.
 * Returns the index; if none found, returns dataList.length.
 */
function findCandleIndex(dataList, fromTs) {
  let lo = 0, hi = dataList.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (dataList[mid].timestamp < fromTs) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Count visible candles in the window [currentRangeFrom, lastTimestamp].
 * Returns 0 if chart data is insufficient.
 */
function countCandlesInRange(dataList, currentRangeFrom, windowMs) {
  if (!dataList || dataList.length < 2) return 0;
  const lastTs = dataList[dataList.length - 1].timestamp;
  const fromTs = currentRangeFrom || (lastTs - windowMs);
  const startIdx = findCandleIndex(dataList, fromTs);
  return dataList.length - startIdx;
}

/**
 * Create a bar-space calculator bound to chart state.
 *
 * @param {object} deps
 * @param {() => object|null} deps.chart - getter for KLineChart instance
 * @param {HTMLElement|null} deps.chartContainer - the chart container DOM element
 * @param {number} deps.rightOffsetPx - right margin in pixels
 * @param {string} deps.resolution - current resolution key
 * @param {string} deps.window - current window key
 * @param {number} deps.currentRangeFrom - calendar-aligned window start timestamp
 */
export function createBarSpace(deps) {
  function getBarSpace() {
    const chart = deps.chart;
    const chartArea = chart?.getSize?.('candle_pane', 'main');
    const width = chartArea?.width || deps.chartContainer?.clientWidth || 0;
    if (width <= 0) return TIMEFRAME_BAR_SPACE[deps.resolution] || 10;

    if (chart) {
      const dataList = chart.getDataList();
      const candleCount = countCandlesInRange(
        dataList, deps.currentRangeFrom, windowToMs(deps.window)
      );
      if (candleCount > 0) {
        return Math.max(1, Math.min(50, (width - deps.rightOffsetPx) / candleCount));
      }
    }

    return calcBarSpace(deps.resolution, deps.window, width - deps.rightOffsetPx);
  }

  function applyBarSpace() {
    const chart = deps.chart;
    if (!chart) return;
    const bs = getBarSpace();
    chart.setBarSpace(bs);
    chart.setOffsetRightDistance(deps.rightOffsetPx, true);
    if (import.meta.env.DEV) {
      console.log('[applyBarSpace]',
        'barSpace:', bs.toFixed(3),
        'offsetPx:', chart.getOffsetRightDistance?.()?.toFixed(1),
        'visibleRange:', JSON.stringify(chart.getVisibleRange?.()),
        'dataLen:', chart.getDataList?.()?.length,
        'containerW:', deps.chartContainer?.clientWidth
      );
    }
  }

  return { getBarSpace, applyBarSpace };
}
