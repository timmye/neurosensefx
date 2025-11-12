/**
 * Price Markers Visualization Engine
 *
 * Implements foundation pattern for horizontal price level markers with labels.
 * Supports bounds checking, DPR-aware rendering, and enhancement system integration.
 *
 * Foundation Pattern: calculateRenderData → configureRenderContext → drawCoreMarkers → addEnhancements
 */

import {
  boundsUtils,
  configureTextForDPR
} from '../../utils/canvasSizing.js';

import {
  ENHANCEMENT_TYPES,
  COMMON_ENHANCEMENTS,
  EnhancementSystem
} from './EnhancementSystem.js';

/**
 * Main price markers rendering function
 * Implements foundation pattern with guard clauses and error handling
 */
export function drawPriceMarkers(ctx, renderingContext, config, state, y, markers) {
  // Early exit if disabled
  if (!config.showPriceMarkers || !markers || markers.length === 0) {
    return;
  }

  // Input validation with graceful fallback
  if (!ctx || !renderingContext || !state || !y) {
    console.warn('[PriceMarkers] Missing required parameters, skipping render');
    return;
  }

  // Extract rendering context
  const { contentArea } = renderingContext;

  // Foundation pattern implementation
  const renderData = calculateRenderData(markers, y, config, contentArea, state);

  // Early exit if no markers in bounds
  if (renderData.markersToRender.length === 0) {
    return;
  }

  // Configure render context for crisp rendering with proper transformation management
  ctx.save();

  // Reset composite operation to ensure proper layering
  ctx.globalCompositeOperation = 'source-over';

  // Apply sub-pixel alignment for crisp rendering
  ctx.translate(0.5, 0.5);

  try {
    // Core marker rendering with bounds checking
    drawCoreMarkers(ctx, renderingContext, config, renderData, state);

    // Enhancement patterns (optional)
    if (config.priceMarkerGlowEnabled) {
      addGlowEnhancement(ctx, renderingContext, config, renderData);
    }
  } catch (error) {
    console.error('[PriceMarkers] Rendering error:', error);
  } finally {
    // CRITICAL: Always restore to prevent transformation leakage
    ctx.restore();
  }
}

/**
 * Calculate render data for price markers
 * Implements position calculations and bounds checking for performance
 */
function calculateRenderData(markers, yScale, config, contentArea, state) {
  const processedMarkers = [];

  markers.forEach((marker, index) => {
    const markerY = yScale(marker.price);

    // Bounds checking for performance optimization
    const inBounds = boundsUtils.isYInBounds(markerY, config, { canvasArea: contentArea });

    if (inBounds) {
      processedMarkers.push({
        ...marker,
        y: markerY,
        index,
        price: marker.price,
        labelText: formatPriceLabel(marker.price, state?.digits || 5)
      });
    }
  });

  return {
    markers: processedMarkers,
    markersToRender: processedMarkers,
    contentArea,
    totalMarkers: markers.length,
    visibleMarkers: processedMarkers.length
  };
}


/**
 * Draw core marker elements with bounds checking
 * Renders lines and labels with configurable styling
 */
function drawCoreMarkers(ctx, renderingContext, config, renderData, state) {
  const { markersToRender, contentArea } = renderData;

  // Extract configuration with defaults for backward compatibility
  const lineColor = config.priceMarkerLineColor || config.markerLineColor || '#FFFFFF';
  const lineThickness = config.priceMarkerLineThickness || config.markerLineThickness || 1;
  const lineStyle = config.priceMarkerStyle || 'solid';
  const labelColor = config.priceMarkerLabelColor || config.markerLabelColor || '#9CA3AF';
  const labelFontSize = config.priceMarkerLabelFontSize || config.markerLabelFontSize || 10;
  const labelMode = config.priceMarkerLabelMode || 'right';
  const labelXOffset = config.priceMarkerLabelXOffset || config.markerLabelXOffset || 5;

  // Configure font with DPR awareness
  configureTextForDPR(ctx, labelFontSize, 'JetBrains Mono, monospace');
  ctx.textBaseline = 'middle';
  // Note: textAlign will be set per label in drawMarkerLabel

  markersToRender.forEach(marker => {
    // Draw marker line
    drawMarkerLine(ctx, marker, contentArea, lineColor, lineThickness, lineStyle);

    // Draw label based on positioning mode
    if (labelMode === 'right' || labelMode === 'both') {
      drawMarkerLabel(ctx, marker, contentArea, labelColor, labelFontSize, labelXOffset, 'right');
    }
    if (labelMode === 'left' || labelMode === 'both') {
      drawMarkerLabel(ctx, marker, contentArea, labelColor, labelFontSize, labelXOffset, 'left');
    }
  });
}

/**
 * Draw individual marker line with style support
 */
function drawMarkerLine(ctx, marker, contentArea, color, thickness, style) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;

  // Apply line style
  switch (style) {
    case 'dashed':
      ctx.setLineDash([5, 5]);
      break;
    case 'dotted':
      ctx.setLineDash([2, 2]);
      break;
    case 'solid':
    default:
      ctx.setLineDash([]);
      break;
  }

  // Draw line across content area
  ctx.moveTo(0, marker.y);
  ctx.lineTo(contentArea.width, marker.y);
  ctx.stroke();

  // Reset line dash for other drawing functions
  ctx.setLineDash([]);
}

/**
 * Draw marker label with background
 */
function drawMarkerLabel(ctx, marker, contentArea, color, fontSize, xOffset, position) {
  const textMetrics = ctx.measureText(marker.labelText);
  const textWidth = textMetrics.width;
  const textHeight = fontSize + 4;
  const padding = 3;

  // Set text alignment based on position
  ctx.textAlign = position === 'right' ? 'right' : 'left';
  ctx.textBaseline = 'middle';

  let labelX;
  let bgX;

  if (position === 'right') {
    // For right alignment: position from right edge
    labelX = contentArea.width - xOffset;
    bgX = contentArea.width - textWidth - xOffset - (padding * 2);
  } else { // left
    // For left alignment: position from left edge
    labelX = xOffset;
    bgX = xOffset - padding;
  }

  const labelY = marker.y;

  // Draw background rectangle for better visibility
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(
    bgX,
    labelY - textHeight / 2,
    textWidth + (padding * 2),
    textHeight
  );

  // Draw text on top of background
  ctx.fillStyle = color;
  ctx.fillText(marker.labelText, labelX, labelY);
}

/**
 * Add glow enhancement for visual prominence
 * Integrates with EnhancementSystem for consistency
 */
function addGlowEnhancement(ctx, renderingContext, config, renderData) {
  const { markersToRender } = renderData;
  const glowColor = config.priceMarkerLineColor || '#FFFFFF';
  const glowIntensity = 0.3;

  // Store original context properties to restore after
  const originalShadowColor = ctx.shadowColor;
  const originalShadowBlur = ctx.shadowBlur;
  const originalShadowOffsetX = ctx.shadowOffsetX;
  const originalShadowOffsetY = ctx.shadowOffsetY;

  markersToRender.forEach(marker => {
    // Create glow effect using shadow properties
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Draw glowing line
    ctx.strokeStyle = `${glowColor}${Math.floor(glowIntensity * 255).toString(16).padStart(2, '0')}`;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);

    const { contentArea } = renderingContext;
    ctx.beginPath();
    ctx.moveTo(0, marker.y);
    ctx.lineTo(contentArea.width, marker.y);
    ctx.stroke();

    // Reset shadow properties after each marker to prevent accumulation
    ctx.shadowColor = originalShadowColor;
    ctx.shadowBlur = originalShadowBlur;
    ctx.shadowOffsetX = originalShadowOffsetX;
    ctx.shadowOffsetY = originalShadowOffsetY;
  });
}

/**
 * Format price label with proper decimal handling
 * Utility function for consistent price formatting
 */
function formatPriceLabel(price, digits = 5) {
  if (price === undefined || price === null || isNaN(price)) {
    return 'N/A';
  }
  return price.toFixed(digits);
}
