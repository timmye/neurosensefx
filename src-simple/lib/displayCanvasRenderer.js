// Display Canvas Renderer - Crystal Clarity Compliant
// Framework-first: Canvas 2D API coordination layer
// Bridges DisplayCanvas.svelte with specialized renderers

import { renderDayRange, renderDayRangeWithMarketProfile } from './visualizers.js';
import { renderStatusMessage, renderErrorMessage } from './canvasStatusRenderer.js';

// Determine display type based on market profile visibility and data
export function getDisplayType(showMarketProfile, marketProfileData) {
  if (showMarketProfile && marketProfileData) {
    return 'dayRangeWithMarketProfile';
  }
  return 'dayRange';
}

// Get the appropriate renderer function for the display type
export function getRenderer(displayType) {
  switch (displayType) {
    case 'dayRange':
      return renderDayRange;
    case 'dayRangeWithMarketProfile':
      return renderDayRangeWithMarketProfile;
    default:
      console.warn('[DISPLAY_CANVAS_RENDERER] Unknown display type:', displayType);
      return renderDayRange;
  }
}

// Render using the specified renderer
export function renderWithRenderer(renderer, ctx, data, config, displayType, marketProfileData) {
  if (!renderer || typeof renderer !== 'function') {
    console.error('[DISPLAY_CANVAS_RENDERER] Invalid renderer provided');
    return false;
  }

  try {
    // For combined display, ensure market data is properly configured
    if (displayType === 'dayRangeWithMarketProfile') {
      const renderConfig = { ...config, marketData: data };
      renderer(ctx, marketProfileData, renderConfig);
    } else {
      renderer(ctx, data, config);
    }
    return true;
  } catch (error) {
    console.error('[DISPLAY_CANVAS_RENDERER] Render error:', error);
    return false;
  }
}

// Render price markers (placeholder - delegates to price marker system)
export function renderPriceMarkers(ctx, data, priceMarkers, selectedMarker, hoverPrice, width, height) {
  if (!priceMarkers || priceMarkers.length === 0) return;

  // This is a simplified implementation
  // In a full implementation, this would delegate to the price marker renderer
  // For now, we'll just log that markers should be rendered
  console.log('[DISPLAY_CANVAS_RENDERER] Rendering', priceMarkers.length, 'price markers');
}

// Render connection status - returns true if status was rendered
export function renderConnectionStatus(ctx, connectionStatus, symbol, width, height) {
  if (!connectionStatus) return false;

  const statusConfig = { width, height };
  const message = connectionStatus === 'connected'
    ? `CONNECTED: ${symbol}`
    : `${connectionStatus.toUpperCase()}: ${symbol}`;

  if (connectionStatus === 'connected') {
    renderStatusMessage(ctx, message, statusConfig);
  } else {
    renderErrorMessage(ctx, message, statusConfig);
  }

  return true;
}