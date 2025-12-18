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
  console.log('[VISUALIZERS] renderDayRangeWithMarketProfile called with:', {
    hasContext: !!ctx,
    hasMarketProfileData: !!d,
    marketProfileDataLength: d ? d.length : 0,
    hasConfig: !!s,
    configKeys: s ? Object.keys(s) : null,
    hasMarketData: !!s?.marketData
  });

  // Clear canvas once at the start
  console.log('[VISUALIZERS] Clearing canvas for combined render');
  ctx.clearRect(0, 0, s.width, s.height);

  // Render background for market profile
  console.log('[VISUALIZERS] Rendering background for market profile');
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, s.width, s.height);

  // First render market profile as background layer
  if (d && d.length > 0) {
    console.log('[VISUALIZERS] Rendering market profile background');
    renderMarketProfile(ctx, d, s);
  } else {
    console.log('[VISUALIZERS] No market profile data to render');
  }

  // Then render day range meter on top
  if (s.marketData) {
    console.log('[VISUALIZERS] Rendering day range on top of market profile');
    // Don't clear canvas - we want market profile to show behind
    renderDayRangeOrchestrated(ctx, s.marketData, s, getConfig, { clearCanvas: false });
  } else {
    console.log('[VISUALIZERS] No market data, rendering waiting message');
    renderStatusMessage(ctx, 'Waiting for market data...', s);
    return;
  }

  console.log('[VISUALIZERS] Combined render complete');
}

// Export status and error rendering functions
export { renderStatusMessage, renderErrorMessage };

// Register the visualizations
console.log('[VISUALIZERS] Registering visualizations...');
register('dayRange', renderDayRange);
console.log('[VISUALIZERS] dayRange renderer registered');
register('dayRangeWithMarketProfile', renderDayRangeWithMarketProfile);
console.log('[VISUALIZERS] dayRangeWithMarketProfile renderer registered');

// Log available visualizers for debugging
console.log('[VISUALIZERS] Available renderers:', {
  dayRange: typeof renderDayRange,
  dayRangeWithMarketProfile: typeof renderDayRangeWithMarketProfile,
  renderStatusMessage: typeof renderStatusMessage,
  renderErrorMessage: typeof renderErrorMessage
});