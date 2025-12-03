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
  console.log('[DEBUGGER:COMBINED_RENDERER:22] Starting combined render - Data length:', d?.length);
  console.log('[DEBUGGER:COMBINED_RENDERER:23] Canvas state before render:', ctx.globalAlpha, ctx.fillStyle);

  // Clear canvas once at the start
  ctx.clearRect(0, 0, s.width, s.height);

  // Render background for market profile
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, s.width, s.height);

  // First render market profile as background layer
  if (d && d.length > 0) {
    console.log('[DEBUGGER:COMBINED_RENDERER:27] Rendering Market Profile as background layer');
    renderMarketProfile(ctx, d, s);
    console.log('[DEBUGGER:COMBINED_RENDERER:29] Market Profile rendered - checking canvas state:', ctx.globalAlpha, ctx.fillStyle);
  }

  // Then render day range meter on top
  if (s.marketData) {
    console.log('[DEBUGGER:COMBINED_RENDERER:33] Rendering Day Range Meter as foreground layer');
    // Don't clear canvas - we want market profile to show behind
    renderDayRangeOrchestrated(ctx, s.marketData, s, getConfig, { clearCanvas: false });
    console.log('[DEBUGGER:COMBINED_RENDERER:35] Day Range rendered - Market Profile should now be visible behind');
  } else {
    console.log('[DEBUGGER:COMBINED_RENDERER:37] No market data available, rendering status');
    renderStatusMessage(ctx, 'Waiting for market data...', s);
    return;
  }
}

// Export status and error rendering functions
export { renderStatusMessage, renderErrorMessage };

// Register the visualizations
register('dayRange', renderDayRange);
register('dayRangeWithMarketProfile', renderDayRangeWithMarketProfile);
console.log('[SYSTEM] Enhanced visualizations registered: dayRange, dayRangeWithMarketProfile');
console.log('[SYSTEM] Market profile now only available as overlay - use Alt+M to toggle');