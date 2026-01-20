// Display Canvas Renderer - Crystal Clarity Compliant
// Framework-first: Canvas 2D API coordination layer
// Bridges DisplayCanvas.svelte with specialized renderers

import { renderDayRange, renderDayRangeWithMarketProfile } from './visualizers.js';
import { renderFxBasket as renderFxBasketOrchestrator } from './fxBasket/fxBasketOrchestrator.js';
import { renderStatusMessage, renderErrorMessage } from './canvasStatusRenderer.js';
import { renderUserPriceMarkers, renderHoverPreview } from './priceMarkerRenderer.js';
import { createPriceScale } from './dayRangeRenderingUtils.js';
import { calculateAdaptiveScale } from './dayRangeCalculations.js';
import { getConfig } from './dayRangeConfig.js';
import { formatPriceToPipLevel, formatPipMovement, formatPriceWithPipPosition } from './priceFormat.js';
import { drawPriceMarker } from './dayRangeElements.js';

// Determine display type based on symbol, market profile visibility and data
export function getDisplayType(symbol, showMarketProfile, marketProfileData) {
  // Check for FX Basket first
  if (symbol === 'FX_BASKET') {
    return 'fxBasket';
  }
  if (showMarketProfile && marketProfileData) {
    return 'dayRangeWithMarketProfile';
  }
  return 'dayRange';
}

// Get the appropriate renderer function for the display type
export function getRenderer(displayType) {
  console.log('[DISPLAY_CANVAS_RENDERER] Getting renderer for display type:', displayType);
  let renderer;
  switch (displayType) {
    case 'fxBasket':
      renderer = renderFxBasketOrchestrator;
      console.log('[DISPLAY_CANVAS_RENDERER] Selected fxBasket renderer:', typeof renderer);
      return renderer;
    case 'dayRange':
      renderer = renderDayRange;
      console.log('[DISPLAY_CANVAS_RENDERER] Selected dayRange renderer:', typeof renderer);
      return renderer;
    case 'dayRangeWithMarketProfile':
      renderer = renderDayRangeWithMarketProfile;
      console.log('[DISPLAY_CANVAS_RENDERER] Selected dayRangeWithMarketProfile renderer:', typeof renderer);
      return renderer;
    default:
      console.warn('[DISPLAY_CANVAS_RENDERER] Unknown display type:', displayType, 'falling back to dayRange');
      renderer = renderDayRange;
      console.log('[DISPLAY_CANVAS_RENDERER] Selected fallback renderer:', typeof renderer);
      return renderer;
  }
}

// Render using the specified renderer
export function renderWithRenderer(renderer, ctx, data, config, displayType, marketProfileData) {
  console.log('[DISPLAY_CANVAS_RENDERER] renderWithRenderer called with:', {
    renderer: typeof renderer,
    hasContext: !!ctx,
    hasData: !!data,
    dataKeys: data ? Object.keys(data) : null,
    displayType,
    hasMarketProfileData: !!marketProfileData,
    config
  });

  if (!renderer || typeof renderer !== 'function') {
    console.error('[DISPLAY_CANVAS_RENDERER] Invalid renderer provided:', renderer);
    return false;
  }

  try {
    console.log('[DISPLAY_CANVAS_RENDERER] Calling renderer function...');

    // Handle FX Basket rendering (different signature)
    if (displayType === 'fxBasket') {
      console.log('[DISPLAY_CANVAS_RENDERER] Rendering fxBasket');
      console.log('[DISPLAY_CANVAS_RENDERER] Basket data:', data);
      console.log('[DISPLAY_CANVAS_RENDERER] Dimensions:', config);
      renderer(ctx, data, {}, config); // fxBasket signature: (ctx, basketData, config, dimensions)
      return true;
    }

    // For combined display, ensure market data is properly configured
    if (displayType === 'dayRangeWithMarketProfile') {
      console.log('[DISPLAY_CANVAS_RENDERER] Rendering dayRangeWithMarketProfile');
      const renderConfig = { ...config, marketData: data };
      console.log('[DISPLAY_CANVAS_RENDERER] Render config:', renderConfig);
      renderer(ctx, marketProfileData, renderConfig);
    } else {
      console.log('[DISPLAY_CANVAS_RENDERER] Rendering dayRange');
      console.log('[DISPLAY_CANVAS_RENDERER] Data passed to renderer:', data);
      console.log('[DISPLAY_CANVAS_RENDERER] Config passed to renderer:', config);
      renderer(ctx, data, config);
    }
    console.log('[DISPLAY_CANVAS_RENDERER] Renderer completed successfully');
    return true;
  } catch (error) {
    console.error('[DISPLAY_CANVAS_RENDERER] Render error:', error);
    console.error('[DISPLAY_CANVAS_RENDERER] Error stack:', error.stack);
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

    // Calculate ADR axis position (same as Day Range Meter)
    const dayRangeConfig = getConfig({ positioning: { adrAxisX: width * 0.75 } });
    let axisX = dayRangeConfig.positioning.adrAxisX;
    if (typeof axisX === 'number' && axisX > 0 && axisX <= 1) {
      axisX = width * axisX;
    }

    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(axisX, startY);
    ctx.lineTo(axisX, currentY);
    ctx.stroke();
    ctx.setLineDash([]);

    drawPriceMarker(ctx, axisX, startY, formattedStartPrice, '#FFD700', true, 'right');
    drawPriceMarker(ctx, axisX, currentY, formattedCurrentPrice, '#FFD700', true, 'right', `(${deltaPips})`);

    // Setup font for percentage text
    ctx.font = config.fonts?.statusMessages || '16px monospace';
    ctx.textAlign = 'right';
    const midY = (startY + currentY) / 2;
    const percentText = `${deltaPercent}%`;
    const percentX = axisX - 5;

    // Draw background for percentage text
    const textWidth = ctx.measureText(percentText).width;
    const fontHeight = 12;
    const padding = 3;
    const backgroundHeight = fontHeight * 0.7;

    ctx.fillStyle = 'rgba(10, 10, 10, 0.7)';
    ctx.fillRect(
      percentX - padding - textWidth,
      midY - backgroundHeight / 2,
      textWidth + padding * 2,
      backgroundHeight
    );

    // Draw percentage text
    ctx.fillStyle = '#FFD700';
    ctx.fillText(percentText, percentX, midY);
  } catch (error) {
    console.error('[DISPLAY_CANVAS_RENDERER] Error rendering price delta:', error);
  }
}