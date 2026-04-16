/**
 * Calendar-aware custom X-axis for KLineChart.
 *
 * Registers a 'calendar' custom axis that delegates tick generation
 * to xAxisTickGenerator.js. This module manages the chart instance
 * and window state, and calls registerXAxis with the createTicks callback.
 *
 * @module xAxisCustom
 */

import { registerXAxis } from 'klinecharts';
import {
  setAxisWindow as setTickWindow,
  generateTicks,
  snapToBar,
  formatBoundaryLabel,
} from './xAxisTickGenerator.js';

export { snapToBar, formatBoundaryLabel, generateTicks };

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let _chart = null;

export function setAxisChart(chart) {
  _chart = chart;
}

export function setAxisWindow(window_) {
  setTickWindow(window_);
}

// ---------------------------------------------------------------------------
// registerXAxis — KLineChart registration
// ---------------------------------------------------------------------------

registerXAxis({
  name: 'calendar',
  createTicks({ range, bounding, defaultTicks }) {
    if (!_chart) return defaultTicks;

    const dataList = _chart.getDataList();
    const { from, to } = range;

    if (!dataList || dataList.length === 0 || from < 0 || to >= dataList.length || from > to) {
      return defaultTicks;
    }

    const fromTs = dataList[from].timestamp;
    const toTs = dataList[to].timestamp;

    const result = generateTicks(fromTs, toTs, dataList, _chart);

    if (result.length === 0) {
      console.warn('[calendarAxis] createTicks produced 0 ticks', {
        from, to, dataLen: dataList.length, fromTs, toTs
      });
      return defaultTicks;
    }

    return result;
  }
});
