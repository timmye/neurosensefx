// Price Marker Base Rendering - Crystal Clarity Compliant
// Framework-first: Common rendering patterns for price markers

import { setupTextRendering } from './dayRangeCore.js';
import { formatPriceWithPipPosition } from './priceFormat.js';

// Render a horizontal marker line with optional text label
export function renderMarkerLine(ctx, y, axisX, color, lineWidth, markerLength, config = {}) {
  const { text = null, textColor = color, textFont = null, dashed = false } = config;
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
    ctx.fillStyle = textColor;
    ctx.fillText(text, axisX - 5, y);
  }

  ctx.restore();
}

// Get symbol data with defaults for missing properties
export function getSymbolDataWithDefaults(symbolData) {
  return {
    pipPosition: symbolData?.pipPosition || 4,
    pipSize: symbolData?.pipSize || 0.0001,
    pipetteSize: symbolData?.pipetteSize || 0.00001,
    ...symbolData
  };
}

// Format price for display with proper pip handling
export function formatPriceForDisplay(price, symbolData) {
  const { pipPosition, pipSize, pipetteSize } = getSymbolDataWithDefaults(symbolData);
  return formatPriceWithPipPosition(price, pipPosition, pipSize, pipetteSize);
}