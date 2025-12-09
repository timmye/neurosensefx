// Enhanced Canvas Visualizers - Crystal Clarity Compliant
// Framework-first: Canvas 2D API, professional trading visualization
// Week 2: Market Profile integration + Day Range Meter

import { register } from './visualizationRegistry.js';
import { renderDayRange as renderDayRangeOrchestrated } from './dayRangeOrchestrator.js';
import { getConfig } from './dayRangeConfig.js';
import { renderStatusMessage, renderErrorMessage } from './canvasStatusRenderer.js';
import { renderMarketProfile } from './marketProfileRenderer.js';

// Export the refactored renderDayRange function
export function renderDayRange(ctx, d, s) {
  renderDayRangeOrchestrated(ctx, d, s, getConfig);
}

// Export market profile rendering function
export function renderMarketProfileVisualization(ctx, d, s) {
  renderMarketProfile(ctx, d, s);
}

// Combined renderer: Market Profile behind Day Range Meter
export function renderDayRangeWithMarketProfile(ctx, d, s) {
  // Clear canvas once at the start
  ctx.clearRect(0, 0, s.width, s.height);

  // Render background for market profile
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, s.width, s.height);

  // First render market profile as background layer
  if (d && d.length > 0) {
    renderMarketProfile(ctx, d, s);
  }

  // Then render day range meter on top
  if (s.marketData) {
    // Don't clear canvas - we want market profile to show behind
    renderDayRangeOrchestrated(ctx, s.marketData, s, getConfig, { clearCanvas: false });
  } else {
    renderStatusMessage(ctx, 'Waiting for market data...', s);
    return;
  }
}

// Export status and error rendering functions
export { renderStatusMessage, renderErrorMessage };

// Register the visualizations
register('dayRange', renderDayRange);
register('dayRangeWithMarketProfile', renderDayRangeWithMarketProfile);