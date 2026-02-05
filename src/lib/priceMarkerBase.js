// Price Marker Base Rendering - Crystal Clarity Compliant
// Framework-first: Common rendering patterns for price markers

import { setupTextRendering } from './dayRangeCore.js';
import { formatPriceWithPipPosition, emphasizeDigits } from './priceFormat.js';
import { defaultConfig } from './dayRangeConfig.js';

// Render a horizontal marker line with optional text label
export function renderMarkerLine(ctx, y, axisX, color, lineWidth, markerLength, config = {}) {
  const {
    text = null,
    textColor = color,
    textFont = null,
    dashed = false,
    textBackground = false,
    emphasizePips = false,
    pipPosition = null
  } = config;
  // Context is already scaled by ctx.scale(dpr, dpr) in setupCanvas()
  // So use logical pixels directly for all drawing operations
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;

  if (dashed) {
    ctx.setLineDash([6, 4]);
  }

  // Draw marker line
  ctx.beginPath();
  ctx.moveTo(axisX - markerLength, y);
  ctx.lineTo(axisX + markerLength, y);
  ctx.stroke();

  // Draw text label if provided
  if (text && textFont) {
    if (emphasizePips && pipPosition !== null) {
      // Use multi-size rendering for emphasized pips
      const { regular, emphasized, remaining } = emphasizeDigits(text, pipPosition);

      // Draw background if needed
      if (textBackground) {
        const fontSize = parseInt(textFont.match(/\d+/)) || 32;

        // Background sized to emphasized font with small padding
        const padding = fontSize * 0.1; // 10% of font size
        const backgroundHeight = fontSize * 1.5 * 0.8; // Emphasized font with 80% height

        // Use actual text measurement
        ctx.font = textFont;
        const textWidth = ctx.measureText(text).width;

        ctx.fillStyle = 'rgba(10, 10, 10, 0.7)';
        ctx.fillRect(
          axisX - textWidth - 5 - padding,
          y - backgroundHeight / 2,
          textWidth + padding * 2,
          backgroundHeight
        );
      }

      // Calculate emphasis positions from segments
      const fullText = regular + emphasized + remaining;
      const emphasisStart = regular.length;
      const emphasisEnd = emphasisStart + emphasized.length;

      // Extract base font size from textFont configuration
      const baseFontSize = parseInt(textFont.match(/\d+/)) || 46;
      renderMultiSizePrice(ctx, axisX - 5, y, fullText, emphasisStart, emphasisEnd, textColor, baseFontSize);
    } else {
      // Use original single-size rendering
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
  // Use ?? instead of || because pipPosition=0 is valid for crypto
  const pipPosition = dataOrSymbolData?.pipPosition ?? dataOrSymbolData?.marketData?.pipPosition;
  return formatPriceWithPipPosition(price, pipPosition);
}

// Scale for device pixel ratio
// Note: Context is already scaled by ctx.scale(dpr, dpr) in setupCanvas()
// So font sizes should use logical pixels directly
function scaleForDPR(value) {
  return value;
}

// Render price with emphasis
export function renderMultiSizePrice(ctx, x, y, text, emphasisStart, emphasisEnd, color, baseFontSize = null) {
  // Use configuration-based defaults
  if (!baseFontSize) {
    const configFont = defaultConfig.fonts.currentPrice;
    baseFontSize = parseInt(configFont.match(/\d+/)) || 36;
  }

  const parts = [
    { text: text.substring(0, emphasisStart), emphasized: false },
    { text: text.substring(emphasisStart, emphasisEnd), emphasized: true },
    { text: text.substring(emphasisEnd), emphasized: false }
  ];

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  // Calculate total width
  let totalWidth = 0;
  parts.forEach(part => {
    if (!part.text) return;
    const fontSize = part.emphasized ? baseFontSize * defaultConfig.emphasis.ratio : baseFontSize;
    ctx.font = `${scaleForDPR(fontSize)}px monospace`;
    totalWidth += ctx.measureText(part.text).width;
  });

  // Render left-to-right from calculated start position
  let currentX = x - totalWidth;

  parts.forEach(part => {
    if (!part.text) return;

    const fontSize = part.emphasized ? baseFontSize * defaultConfig.emphasis.ratio : baseFontSize;
    ctx.font = `${scaleForDPR(fontSize)}px monospace`;
    ctx.fillStyle = color;

    ctx.fillText(part.text, currentX, y);
    currentX += ctx.measureText(part.text).width;
  });
}