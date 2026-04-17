/**
 * Calendar-aware custom X-axis for KLineChart.
 *
 * Registers a 'calendar' custom axis that delegates tick generation
 * to xAxisTickGenerator.js.
 *
 * Multi-chart support: Since registerXAxis is a one-time global registration
 * and KLineCharts doesn't pass the chart instance to createTicks, we use
 * a simple last-set chart reference. This is sufficient because createTicks
 * is called synchronously during chart render — no interleaving between
 * chart instances within a single frame.
 *
 * @module xAxisCustom
 */

import { registerXAxis } from 'klinecharts';
import {
  generateTicks,
  snapToBar,
  formatBoundaryLabel,
} from './xAxisTickGenerator.js';

export { snapToBar, formatBoundaryLabel, generateTicks };

// ---------------------------------------------------------------------------
// Per-chart state tracking
// ---------------------------------------------------------------------------

const chartRegistry = new Map(); // chart instance -> { window, timezone }

export function setAxisChart(chart, timezone = 'UTC') {
  if (chart) {
    if (!chartRegistry.has(chart)) {
      chartRegistry.set(chart, { window: '3M', timezone });
    } else {
      chartRegistry.get(chart).timezone = timezone;
    }
    _lastChart = chart;
  }
}

export function setAxisWindow(window_, chart) {
  if (chart && chartRegistry.has(chart)) {
    chartRegistry.get(chart).window = window_;
    _lastChart = chart;
  } else {
    // No specific chart — update all registered charts
    for (const state of chartRegistry.values()) {
      state.window = window_;
    }
  }
}

/** Update timezone for a specific chart. */
export function setAxisTimezone(timezone, chart) {
  if (chart && chartRegistry.has(chart)) {
    chartRegistry.get(chart).timezone = timezone;
  } else {
    for (const state of chartRegistry.values()) {
      state.timezone = timezone;
    }
  }
}

/** Remove a chart from the registry (call on dispose). */
export function removeAxisChart(chart) {
  chartRegistry.delete(chart);
  if (_lastChart === chart) _lastChart = null;
}

// ---------------------------------------------------------------------------
// registerXAxis — KLineChart registration
// ---------------------------------------------------------------------------

// Track which chart most recently called setAxisChart.
// createTicks is called synchronously during chart render, so this
// reliably identifies the calling chart without needing WeakMap iteration.
let _lastChart = null;

registerXAxis({
  name: 'calendar',
  createTicks({ range, bounding, defaultTicks }) {
    const chart = _lastChart;
    if (!chart || !chartRegistry.has(chart)) return defaultTicks;

    const state = chartRegistry.get(chart);
    const dataList = chart.getDataList();
    const { from, to } = range;

    if (!dataList || dataList.length === 0 || from < 0 || to >= dataList.length || from > to) {
      return defaultTicks;
    }

    const fromTs = dataList[from].timestamp;
    const toTs = dataList[to].timestamp;

    const result = generateTicks(fromTs, toTs, dataList, chart, state.window, state.timezone);

    if (result.length === 0) {
      console.warn('[calendarAxis] createTicks produced 0 ticks', {
        from, to, dataLen: dataList.length, fromTs, toTs
      });
      return defaultTicks;
    }

    return result;
  }
});
