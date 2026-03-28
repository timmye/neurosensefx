import { renderDayRange as renderDayRangeOrchestrated } from './dayRangeOrchestrator.js';
import { getConfig } from './dayRangeConfig.js';
import { renderStatusMessage } from './canvasStatusRenderer.js';
import { renderMarketProfile } from './marketProfile/orchestrator.js';

export function renderDayRange(ctx, d, s) {
  renderDayRangeOrchestrated(ctx, d, s, getConfig);
}

export function renderDayRangeWithMarketProfile(ctx, d, s) {
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, s.width, s.height);

  if (d && d.length > 0) {
    renderMarketProfile(ctx, d, s);
  }

  if (s.marketData) {
    renderDayRangeOrchestrated(ctx, s.marketData, s, getConfig, { clearCanvas: false });
  } else {
    renderStatusMessage(ctx, 'Waiting for market data...', s);
    return;
  }
}

export { renderStatusMessage, renderErrorMessage } from './canvasStatusRenderer.js';
