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

// Export status and error rendering functions
export { renderStatusMessage, renderErrorMessage };

// Register the visualizations
register('dayRange', renderDayRange);
register('marketProfile', renderMarketProfileVisualization);
console.log('[SYSTEM] Enhanced visualizations registered: dayRange, marketProfile');