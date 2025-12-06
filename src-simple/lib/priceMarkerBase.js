// Price Marker Base Rendering - Crystal Clarity Compliant
// Framework-first: Common rendering patterns for price markers

import { setupTextRendering } from './dayRangeCore.js';
import { formatPriceWithPipPosition } from './priceFormat.js';

// Render a horizontal marker line with optional text label
export function renderMarkerLine(ctx, y, axisX, color, lineWidth, markerLength, config = {}) {
  const { text = null, textColor = color, textFont = null, dashed = false, textBackground = false } = config;
  const dpr = window.devicePixelRatio || 1;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth / dpr;

  if (dashed) {
    ctx.setLineDash([6 / dpr, 4 / dpr]);
  }

  // Draw marker line
  ctx.beginPath();
  ctx.moveTo(axisX - markerLength / dpr, y);
  ctx.lineTo(axisX + markerLength / dpr, y);
  ctx.stroke();

  // Draw text label if provided
  if (text && textFont) {
    setupTextRendering(ctx, textFont, 'middle', 'right');

    // Draw semi-transparent background if enabled (for current price)
    if (textBackground) {
      const metrics = ctx.measureText(text);
      const fontHeight = parseInt(ctx.font.match(/\d+/)) || 12; // Extract font size from ctx.font
      const padding = Math.max(3, fontHeight * 0.08); // Dynamic padding based on font size
      const backgroundHeight = fontHeight * 0.7; // 70% of font height for proper text alignment

      ctx.fillStyle = 'rgba(10, 10, 10, 0.7)';
      ctx.fillRect(
        axisX - metrics.width - 5 - padding,
        y - backgroundHeight / 2,
        metrics.width + padding * 2,
        backgroundHeight
      );
    }

    ctx.fillStyle = textColor;
    ctx.fillText(text, axisX - 5, y);
  }

  ctx.restore();
}

// Get symbol data with defaults for missing properties
// Note: This function should not be used - pass pipPosition directly to formatPrice()
export function getSymbolDataWithDefaults(symbolData) {
  return {
    pipPosition: symbolData?.pipPosition || 4, // TODO: Remove this fallback - pass pipPosition directly
    pipSize: symbolData?.pipSize || 0.0001
    // pipetteSize removed - pip-based buckets are more efficient
  };
}

// Format price for display with proper pip handling
// Supports both market data and symbol data structures for flexibility
export function formatPriceForDisplay(price, dataOrSymbolData) {
  // Try pipPosition from market data first, then from symbol data
  const pipPosition = dataOrSymbolData?.pipPosition || dataOrSymbolData?.marketData?.pipPosition;
  return formatPriceWithPipPosition(price, pipPosition);
}