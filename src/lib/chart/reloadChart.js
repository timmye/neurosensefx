/**
 * Shared chart reload logic — used by handleSymbolChange and handleSourceChange.
 * Teardown subscriptions, clear chart state, reload data, restore drawings.
 *
 * deps.chart, deps.loadChartData, and deps.restoreDrawings must be provided
 * as getters so they resolve the current value at call time, not creation time.
 */

export function createReloadChart(deps) {
  function clearChartState() {
    if (deps.chart) {
      deps.chart.removeOverlay();
      deps.chart.clearData();
      deps.chart.resize();
    }
    deps.commandStack.clear();
    deps.overlayMeta.clear();
  }

  function reload(symbol, resolution, window, opts = {}) {
    deps.teardownSubscriptions();
    clearChartState();
    if (opts.applyPrecision) {
      deps.applyPricePrecision(symbol);
    }
    if (opts.removeWatermark && deps.chart) {
      deps.chart.removeIndicator('candle_pane', 'symbolWatermark');
    }
    deps.loadChartData(symbol, resolution, window, () => {
      deps.restoreDrawings(symbol, resolution);
      if (deps.createWatermarkIndicator) {
        deps.createWatermarkIndicator();
      }
    });
  }

  return { clearChartState, reload };
}
