// Display Canvas Renderer - Crystal Clarity Compliant
// Framework-first: Canvas 2D API coordination layer
// Bridges DisplayCanvas.svelte with specialized renderers

import { renderDayRange, renderDayRangeWithMarketProfile } from './visualizers.js';
import { renderStatusMessage, renderErrorMessage } from './canvasStatusRenderer.js';
import { renderUserPriceMarkers, renderHoverPreview } from './priceMarkerRenderer.js';
import { createPriceScale } from './dayRangeRenderingUtils.js';
import { calculateAdaptiveScale } from './dayRangeCalculations.js';
import { getConfig } from './dayRangeConfig.js';
import { formatPriceToPipLevel, formatPipMovement, formatPriceWithPipPosition } from './priceFormat.js';
import { drawPriceMarker } from './dayRangeElements.js';

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

// Render price markers - delegates to specialized price marker renderers
export function renderPriceMarkers(ctx, data, priceMarkers, selectedMarker, hoverPrice, width, height) {
  if (!priceMarkers || priceMarkers.length === 0) return;

  // We need market data to create a price scale
  if (!data) {
    console.warn('[DISPLAY_CANVAS_RENDERER] Cannot render price markers without market data');
    return;
  }

  try {
    // Create the necessary configuration and scale for rendering
    const config = getConfig({ positioning: { adrAxisX: width * 0.75 } });
    const adaptiveScale = calculateAdaptiveScale(data, config);
    const priceScale = createPriceScale(config, adaptiveScale, height);

    // Calculate axis position (same as day range renderer)
    let axisX = config.positioning.adrAxisX;
    if (typeof axisX === 'number' && axisX > 0 && axisX <= 1) {
      axisX = width * axisX;
    }

    // Render user-placed price markers with selection highlighting
    renderUserPriceMarkers(ctx, config, axisX, priceScale, priceMarkers, selectedMarker, data);

    // Render hover preview if hovering with Alt key
    if (hoverPrice) {
      renderHoverPreview(ctx, config, axisX, priceScale, hoverPrice);
    }
  } catch (error) {
    console.error('[DISPLAY_CANVAS_RENDERER] Error rendering price markers:', error);
  }
}

// Render connection status - returns true if status was rendered
export function renderConnectionStatus(ctx, connectionStatus, symbol, width, height) {
  if (!connectionStatus) return false;

  const statusConfig = { width, height };
  const message = connectionStatus === 'connected'
    ? `CONNECTED: ${symbol}`
    : `${connectionStatus.toUpperCase()}: ${symbol}`;

  // Only render actual error states as errors
  // Connection states (connecting, disconnected) should render as status messages
  if (connectionStatus === 'connected' || connectionStatus === 'connecting' || connectionStatus === 'disconnected') {
    renderStatusMessage(ctx, message, statusConfig);
  } else {
    renderErrorMessage(ctx, message, statusConfig);
  }

  return true;
}

// Render price delta measurement
export function renderPriceDelta(ctx, deltaInfo, data, width, height) {
  if (!deltaInfo || !deltaInfo.active || !data) return;

  try {

    // Use the exact same coordinate system as Day Range Meter
    const scaleData = {
      adrHigh: data?.adrHigh,
      adrLow: data?.adrLow,
      high: data?.high,
      low: data?.low,
      current: data?.current,
      open: data?.open
    };
    const config = { scaling: 'adaptive' };
    const adaptiveScale = calculateAdaptiveScale(scaleData, config);
    const priceScale = createPriceScale(config, adaptiveScale, height);

    const delta = deltaInfo.currentPrice - deltaInfo.startPrice;
    const deltaPercent = ((delta / deltaInfo.startPrice) * 100).toFixed(2);
    const pipPosition = data?.pipPosition;
    const pipSize = data?.pipSize || 0.0001;
    const deltaPips = formatPipMovement(delta, pipPosition);

    // Use proper FX formatting for prices
    const formattedStartPrice = formatPriceWithPipPosition(deltaInfo.startPrice, pipPosition, pipSize);
    const formattedCurrentPrice = formatPriceWithPipPosition(deltaInfo.currentPrice, pipPosition, pipSize);

    const startY = priceScale(deltaInfo.startPrice);
    const currentY = priceScale(deltaInfo.currentPrice);

    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(50, startY);
    ctx.lineTo(50, currentY);
    ctx.stroke();
    ctx.setLineDash([]);

    drawPriceMarker(ctx, 35, startY, `${formattedStartPrice}`, '#FFD700');
    drawPriceMarker(ctx, 35, currentY, `${formattedCurrentPrice} (${deltaPips})`, '#FFD700');

    ctx.fillStyle = '#FFD700';
    ctx.font = config.fonts?.statusMessages || '12px monospace';
    ctx.textAlign = 'left';
    const midY = (startY + currentY) / 2;
    ctx.fillText(`${deltaPercent}%`, 55, midY);
  } catch (error) {
    console.error('[DISPLAY_CANVAS_RENDERER] Error rendering price delta:', error);
  }
}