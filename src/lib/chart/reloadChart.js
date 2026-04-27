/**
 * Shared chart reload logic — used by handleSymbolChange and handleSourceChange.
 * Teardown subscriptions, clear chart state, reload data, restore drawings.
 *
 * deps.chart, deps.loadChartData, and deps.restoreDrawings must be provided
 * as getters so they resolve the current value at call time, not creation time.
 */

import { forceCanvasDPRRefresh } from './chartResize.js';
import { ConnectionManager } from '../connectionManager.js';

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
    // Clear stale pending chart messages from previous symbol
    const cm = ConnectionManager.getInstance();
    if (cm) {
      cm.pendingMessages = cm.pendingMessages.filter(
        m => m.type !== 'getHistoricalCandles' && m.type !== 'subscribeCandles' && m.type !== 'unsubscribeCandles'
      );
    }
    clearChartState();
    if (opts.applyPrecision) {
      deps.applyPricePrecision(symbol);
    }
    if (opts.removeWatermark && deps.chart) {
      deps.chart.removeIndicator('candle_pane', 'symbolWatermark');
    }
    deps.loadChartData(symbol, resolution, window, () => {
      deps.restoreDrawings(symbol, resolution).then(() => {
        if (deps.createWatermarkIndicator) {
          deps.createWatermarkIndicator();
        }
        // Wait for klinecharts' pending rAFs to settle, then directly fix any
        // canvas buffer/CSS dimension mismatches. KLineCharts' rAF coalescing guard
        // drops buffer updates during rapid layout changes, leaving canvas.width
        // stale. We bypass KLineCharts and set buffers + transform directly.
        requestAnimationFrame(() => {
          forceCanvasDPRRefresh(deps.chartContainer);
        });
      }).catch(err => console.error('[reloadChart] restoreDrawings failed:', err));
    });
  }

  return { clearChartState, reload };
}
