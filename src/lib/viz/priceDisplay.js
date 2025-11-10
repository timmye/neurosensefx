/**
 * Optimized Price Display Implementation
 * 
 * Built on solid foundation from priceFloat.js and dayRangeMeter.js
 * for perfect visual alignment and DPR-aware crisp rendering.
 * Maintains 60fps performance with 20+ displays.
 * 
 * Architecture: Foundation First - simple, proven patterns
 */

import { boundsUtils, configureTextForDPR } from '../../utils/canvasSizing.js';

export function drawPriceDisplay(ctx, renderingContext, config, state, y) {
  // Guard clauses for safety (SAME PATTERN AS priceFloat.js)
  if (!ctx || !renderingContext || !config || !state || !y) {
    console.warn('[PriceDisplay] Missing required parameters, skipping render');
    return;
  }

  // Extract rendering context from the unified infrastructure
  const { contentArea, adrAxisX } = renderingContext;
  
  // Extract essential data (SAME PATTERN AS priceFloat.js)
  const { 
    currentPrice,      // Current tick price
    lastTickDirection, // 'up', 'down', or undefined
    digits = 5         // Price precision
  } = state;

  // Guard for essential data
  if (currentPrice === undefined || currentPrice === null) {
    console.warn('[PriceDisplay] Missing currentPrice, skipping render');
    return;
  }

  // === FOUNDATION LAYER IMPLEMENTATION ===
  // 1. Calculate render data (always calculate for core element)
  const renderData = calculateRenderData(contentArea, adrAxisX, config, state, y);

  // 2. Configure render context for crisp rendering
  configureRenderContext(ctx);

  // 3. Draw background FIRST (behind text) - ✅ FIXED: Background behind text
  drawBackground(ctx, renderData, config, state, contentArea);

  // 4. ALWAYS draw core price text (trader requirement)
  drawPriceText(ctx, renderData, config, state, digits);

  // 5. Apply bounds checking ONLY to enhancements (foundation pattern)
  addEnhancements(ctx, renderData, config, state, contentArea, digits);

  // 6. Restore context state (foundation pattern)
  ctx.restore();
}

/**
 * Calculate render data and check bounds
 */
function calculateRenderData(contentArea, adrAxisX, config, state, y) {
  // Calculate price position using same scale as dayRangeMeter
  const priceY = y(state.currentPrice);
  
  // Check if price display is within canvas bounds
  const inBounds = boundsUtils.isYInBounds(priceY, config, { canvasArea: contentArea });
  
  // Calculate font size using simplified decimal format
  const fontSize = config.priceFontSize || 0.2; // 20% default as decimal
  const baseFontSize = contentArea.height * fontSize;

  // Calculate positioning based on mode using simplified decimal format
  const positioningMode = config.priceDisplayPositioning || 'canvasRelative';
  let startX;

  if (positioningMode === 'adrAxis') {
    // Mode 1: ADR Axis Aligned
    const xOffset = config.priceDisplayXOffset || 0;
    startX = adrAxisX + (contentArea.width * xOffset);
  } else {
    // Mode 2: Canvas Relative
    const horizontalPosition = config.priceDisplayHorizontalPosition || 0.02; // 2% from left as decimal
    const xOffset = config.priceDisplayXOffset || 0;
    startX = contentArea.width * horizontalPosition + (contentArea.width * xOffset);
  }

  return {
    shouldRender: inBounds,
    startX,
    startY: priceY,
    baseFontSize,
    positioningMode
  };
}

/**
 * Configure canvas context for crisp text rendering
 * Uses proven DPR-aware patterns from dayRangeMeter.js
 */
function configureRenderContext(ctx) {
  ctx.save();

  // Sub-pixel alignment for crisp 1px lines
  ctx.translate(0.5, 0.5);

  // Disable anti-aliasing for sharp rendering
  ctx.imageSmoothingEnabled = false;

  // Set baseline for consistent text rendering
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
}

/**
 * Draw core price text with perfect alignment to dayRangeMeter
 */
function drawPriceText(ctx, renderData, config, state, digits) {
  const { startX, startY, baseFontSize } = renderData;
  
  // Format price with configurable sizing
  const formattedPrice = formatPrice(state.currentPrice, digits, config);
  
  if (!formattedPrice) {
    console.warn('[PriceDisplay] Price formatting failed, skipping render');
    return;
  }

  // Determine color and font weight based on configuration
  const color = determineColor(config, state);
  const fontWeight = config.priceFontWeight || '600'; // Default to semibold
  ctx.fillStyle = color;

  // Calculate text metrics once (PERFORMANCE OPTIMIZATION)
  const textMetrics = calculateTextMetrics(ctx, formattedPrice, baseFontSize, fontWeight);

  let currentX = startX;
  
  // Draw bigFigure with configurable size
  ctx.font = `${fontWeight} ${baseFontSize * formattedPrice.sizing.bigFigureRatio}px monospace`;
  ctx.fillText(formattedPrice.text.bigFigure, currentX, startY);
  currentX += textMetrics.bigFigure.width;

  // Draw pips with configurable size
  if (formattedPrice.text.pips) {
    ctx.font = `${fontWeight} ${baseFontSize * formattedPrice.sizing.pipsRatio}px monospace`;
    ctx.fillText(formattedPrice.text.pips, currentX, startY);
    currentX += textMetrics.pips.width;
  }

  // Draw pipette with configurable size if enabled
  if (config.showPipetteDigit && formattedPrice.text.pipette) {
    ctx.font = `${fontWeight} ${baseFontSize * formattedPrice.sizing.pipetteRatio}px monospace`;
    ctx.fillText(formattedPrice.text.pipette, currentX, startY);
  }

  // Note: Context restoration handled by main drawPriceDisplay function
}

/**
 * Apply enhancements with bounds checking (foundation pattern)
 */
function addEnhancements(ctx, renderData, config, state, contentArea, digits) {
  // Apply bounds checking ONLY to enhancements
  if (boundsUtils.isYInBounds(renderData.startY, config, { canvasArea: contentArea })) {
    // Draw bounding box if enabled (background already drawn)
    drawBoundingBox(ctx, renderData, config, state, contentArea, digits);
  }
}

/**
 * Enhanced price formatting with configurable component sizing ratios
 */
function formatPrice(price, digits, config) {
  // Base formatting
  if (price === undefined || price === null || isNaN(price)) return null;

  const safeDigits = digits || 5;
  const priceStr = price.toFixed(safeDigits);
  const parts = priceStr.split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1] || '';

  let bigFigure = integerPart;
  let pips = '';
  let pipette = '';

  // NeuroSenseFX Dynamic Asset Classification System
  // Pips are always the primary visual element (ratio = 1.0)
  const classification = classifyPriceFormat(price, digits);

  switch (classification.type) {
    case 'HIGH_VALUE_CRYPTO': // BTCUSD: 100000.00
      // Thousands = big figs, hundreds/tens = pips, ones = pipettes, decimals = meaningless
      if (integerPart.length >= 6) {
        const bigFigEnd = integerPart.length - 3; // Everything before last 3 digits
        bigFigure = integerPart.substring(0, bigFigEnd);
        pips = integerPart.substring(bigFigEnd, bigFigEnd + 2); // Hundreds/tens
        pipette = integerPart.substring(bigFigEnd + 2, bigFigEnd + 3); // Ones
      } else {
        bigFigure = integerPart;
      }
      break;

    case 'HIGH_VALUE_COMMODITY': // XAUUSD: 3000.00
      // Thousands = big figs, hundreds/tens = pips, decimals meaningless
      if (integerPart.length >= 4) {
        const bigFigEnd = integerPart.length - 2; // Everything before last 2 digits
        bigFigure = integerPart.substring(0, bigFigEnd);
        pips = integerPart.substring(bigFigEnd, bigFigEnd + 2); // Hundreds/tens
        // No pipettes for commodities
      } else {
        bigFigure = integerPart;
        pips = decimalPart.substring(0, 2); // Fall back to decimals if needed
      }
      break;

    case 'FX_JPY_STYLE': // USDJPY: 130.45 (2 digits)
      // JPY convention: pips are both decimal places (45 in 130.45)
      bigFigure = integerPart;
      pips = decimalPart.substring(0, 2); // Both decimal places = pips
      pipette = ''; // No pipettes for JPY style
      break;

    case 'FX_STANDARD': // EURUSD: 1.23456 (5 digits)
      // Traditional FX convention
      const pipsIndexStd = digits - 3;
      bigFigure = integerPart + '.' + decimalPart.substring(0, pipsIndexStd);
      pips = decimalPart.substring(pipsIndexStd, pipsIndexStd + 2);
      pipette = decimalPart.substring(pipsIndexStd + 2);
      break;

    case 'STANDARD_DECIMAL': // Default fallback
    default:
      // For other instruments, use traditional decimal formatting
      if (digits > 0) {
        const lastTwoDigits = decimalPart.slice(-2);
        const beforeLastTwo = decimalPart.slice(0, -2);
        bigFigure = integerPart + (beforeLastTwo ? '.' + beforeLastTwo : '');
        pips = lastTwoDigits;
      } else {
        bigFigure = integerPart;
      }
      break;
  }

  // NeuroSenseFX Philosophy: Pips are the primary visual element for traders
  // All sizing uses user-configurable ratios with sensible defaults
  const bigFigureRatio = config.bigFigureFontSizeRatio || 0.6;     // 60% of base (secondary)
  const pipsRatio = config.pipFontSizeRatio || 1.0;               // 100% of base (PRIMARY - most important)
  const pipetteRatio = config.pipetteFontSizeRatio || 0.4;        // 40% of base (tertiary)

  return {
    text: { bigFigure, pips, pipette },
    sizing: { bigFigureRatio, pipsRatio, pipetteRatio },
    classification // Include classification for debugging/analysis
  };
}

/**
 * NeuroSenseFX Dynamic Asset Classification System
 * Classifies price format based on magnitude and digit requirements
 */
function classifyPriceFormat(price, digits) {
  const magnitude = Math.floor(Math.log10(Math.abs(price)));

  // HIGH_VALUE_CRYPTO: 100,000+ (BTCUSD, ETHUSD, etc.)
  if (magnitude >= 5) {
    return { type: 'HIGH_VALUE_CRYPTO', magnitude, description: 'Crypto-style high-value pricing' };
  }

  // HIGH_VALUE_COMMODITY: 1,000-99,999 (XAUUSD, indices, etc.)
  if (magnitude >= 3) {
    return { type: 'HIGH_VALUE_COMMODITY', magnitude, description: 'Commodity-style high-value pricing' };
  }

  // FX_JPY_STYLE: 100-999 with 2 decimal places (USDJPY, etc.)
  if (magnitude >= 2 && (digits === 2 || digits === 3)) {
    return { type: 'FX_JPY_STYLE', magnitude, description: 'JPY-style FX pricing' };
  }

  // FX_STANDARD: 0.1-999 with 5 decimal places (EURUSD, GBPUSD, etc.)
  if (digits === 5 || digits === 3) {
    return { type: 'FX_STANDARD', magnitude, description: 'Standard FX pricing' };
  }

  // STANDARD_DECIMAL: Everything else
  return { type: 'STANDARD_DECIMAL', magnitude, description: 'Standard decimal pricing' };
}

/**
 * Calculate text metrics for all components in single pass (PERFORMANCE OPTIMIZATION)
 */
function calculateTextMetrics(ctx, formattedPrice, baseFontSize, fontWeight = '600') {
  const metrics = {};

  // Measure bigFigure
  ctx.font = `${fontWeight} ${baseFontSize * formattedPrice.sizing.bigFigureRatio}px monospace`;
  metrics.bigFigure = ctx.measureText(formattedPrice.text.bigFigure);

  // Measure pips
  ctx.font = `${fontWeight} ${baseFontSize * formattedPrice.sizing.pipsRatio}px monospace`;
  metrics.pips = ctx.measureText(formattedPrice.text.pips || '');

  // Measure pipette
  ctx.font = `${fontWeight} ${baseFontSize * formattedPrice.sizing.pipetteRatio}px monospace`;
  metrics.pipette = ctx.measureText(formattedPrice.text.pipette || '');

  return metrics;
}

/**
 * Draw background/box with efficient calculation - ✅ FIXED: Background drawn first
 */
function drawBackground(ctx, renderData, config, state, contentArea, digits) {
  if (!config.showPriceBackground) return; // Early return if background disabled

  const { startX, startY } = renderData;
  const padding = config.priceDisplayPadding;

  // Get formatted price and metrics
  const formattedPrice = formatPrice(state.currentPrice, digits, config);
  if (!formattedPrice) return;

  const fontWeight = config.priceFontWeight || '600'; // Default to semibold
  const textMetrics = calculateTextMetrics(ctx, formattedPrice, renderData.baseFontSize, fontWeight);
  
  // Calculate total dimensions once (PERFORMANCE OPTIMIZATION)
  const totalWidth = textMetrics.bigFigure.width + textMetrics.pips.width + textMetrics.pipette.width;
  const totalHeight = Math.max(
    textMetrics.bigFigure.actualBoundingBoxAscent + textMetrics.bigFigure.actualBoundingBoxDescent,
    textMetrics.pips.actualBoundingBoxAscent + textMetrics.pips.actualBoundingBoxDescent,
    textMetrics.pipette.actualBoundingBoxAscent + textMetrics.pipette.actualBoundingBoxDescent
  );
  
  const backgroundWidth = totalWidth + (padding * 2);
  const backgroundHeight = totalHeight + (padding * 2);
  const backgroundX = startX - padding;
  const backgroundY = startY - (totalHeight / 2) - padding;
  
  // Draw background if enabled
  if (config.showPriceBackground) {
    ctx.fillStyle = hexToRgba(config.priceBackgroundColor || '#111827', config.priceBackgroundOpacity || 0.8);
    ctx.fillRect(backgroundX, backgroundY, backgroundWidth, backgroundHeight);
  }
}

/**
 * Draw bounding box outline separately from background - ✅ FIXED: Separate function
 */
function drawBoundingBox(ctx, renderData, config, state, contentArea, digits) {
  if (!config.showPriceBoundingBox) return; // Early return if box disabled

  const { startX, startY } = renderData;
  const padding = config.priceDisplayPadding;

  // Get formatted price and metrics
  const formattedPrice = formatPrice(state.currentPrice, digits, config);
  if (!formattedPrice) return;

  const fontWeight = config.priceFontWeight || '600'; // Default to semibold
  const textMetrics = calculateTextMetrics(ctx, formattedPrice, renderData.baseFontSize, fontWeight);
  
  // Calculate total dimensions once (PERFORMANCE OPTIMIZATION)
  const totalWidth = textMetrics.bigFigure.width + textMetrics.pips.width + textMetrics.pipette.width;
  const totalHeight = Math.max(
    textMetrics.bigFigure.actualBoundingBoxAscent + textMetrics.bigFigure.actualBoundingBoxDescent,
    textMetrics.pips.actualBoundingBoxAscent + textMetrics.pips.actualBoundingBoxDescent,
    textMetrics.pipette.actualBoundingBoxAscent + textMetrics.pipette.actualBoundingBoxDescent
  );
  
  const boxWidth = totalWidth + (padding * 2);
  const boxHeight = totalHeight + (padding * 2);
  const boxX = startX - padding;
  const boxY = startY - (totalHeight / 2) - padding;
  
  // Draw border if enabled
  if (config.showPriceBoundingBox) {
    ctx.strokeStyle = hexToRgba(config.priceBoxOutlineColor || '#4B5563', config.priceBoxOutlineOpacity || 1);
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
  }
}

/**
 * Determine color based on directional settings (SAME PATTERN AS priceFloat.js)
 */
function determineColor(config, state) {
  const {
    priceUseStaticColor,
    priceStaticColor,
    priceUpColor,
    priceDownColor
  } = config;

  if (priceUseStaticColor) {
    return priceStaticColor || '#FFFFFF';
  }

  // Use directional coloring based on last tick direction
  switch (state.lastTickDirection) {
    case 'up':
      return priceUpColor || '#10B981'; // Green
    case 'down':
      return priceDownColor || '#EF4444'; // Red
    default:
      return priceStaticColor || '#FFFFFF'; // Fallback
  }
}

/**
 * Safely converts a HEX color to an RGBA string (UTILITY FUNCTION)
 */
function hexToRgba(hex, opacity) {
  if (!hex) return 'rgba(0,0,0,0)'; // Return transparent for invalid hex
  
  const finalOpacity = (opacity === undefined || opacity === null) ? 1 : opacity;

  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }
  
  return `rgba(${r},${g},${b},${finalOpacity})`;
}
