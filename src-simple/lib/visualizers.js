// Enhanced Day Range Meter Canvas Visualizers - Crystal Clarity Compliant
// Framework-first: Canvas 2D API, professional trading visualization
// Week-2 Phase 2 Session 2: Dynamic Markers & Configuration Integration

import { register } from './visualizationRegistry.js';
import { renderMarketProfile } from './visualizations/marketProfile.js';
import { renderDayRange as renderDayRangeOrchestrated } from './dayRangeOrchestrator.js';
import { getConfig } from './dayRangeConfig.js';
import { renderStatusMessage, renderErrorMessage } from './canvasStatusRenderer.js';

// Export the refactored renderDayRange function
export function renderDayRange(ctx, d, s) {
  renderDayRangeOrchestrated(ctx, d, s, getConfig);
}

// Export status and error rendering functions
export { renderStatusMessage, renderErrorMessage };

// Register the visualizations
register('dayRange', renderDayRange);
register('marketProfile', renderMarketProfile);
console.log('[SYSTEM] Enhanced day range meter visualization registered');
console.log('[SYSTEM] Market profile visualization registered');