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

// =============================================================================
// PERFORMANCE-FIRST CACHING SYSTEM (NeuroSense FX Principle)
// =============================================================================
// Eliminates redundant calculations and memory allocations
// Follows established hoverIndicator.js patterns for 60fps performance

// Caching for expensive calculations to eliminate redundant operations
const colorCache = new Map();
const textMetricsCache = new Map();
const formattedPriceCache = new Map();

/**
 * Cached color conversion to avoid string allocations
 */
function hexToRgba(hex, opacity) {
  if (!hex) return 'rgba(0,0,0,0)';

  const finalOpacity = (opacity === undefined || opacity === null) ? 1 : opacity;
  const cacheKey = `${hex}-${finalOpacity}`;

  if (colorCache.has(cacheKey)) {
    return colorCache.get(cacheKey);
  }

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

  const rgba = `rgba(${r},${g},${b},${finalOpacity})`;
  colorCache.set(cacheKey, rgba);

  // Prevent memory leaks - limit cache size
  if (colorCache.size > 100) {
    const firstKey = colorCache.keys().next().value;
    colorCache.delete(firstKey);
  }

  return rgba;
}

/**
 * Get cached formatted price to avoid expensive string operations
 */
function getCachedFormattedPrice(price, digits, config) {
  const cacheKey = `${price}-${digits}-${JSON.stringify({
    bigFigureRatio: config.bigFigureFontSizeRatio ?? 0.6,
    pipsRatio: config.pipFontSizeRatio ?? 1.0,
    pipetteRatio: config.pipetteFontSizeRatio ?? 0.4
  })}`;

  if (formattedPriceCache.has(cacheKey)) {
    return formattedPriceCache.get(cacheKey);
  }

  const formattedPrice = formatPrice(price, digits, config);
  if (!formattedPrice) return null;

  formattedPriceCache.set(cacheKey, formattedPrice);

  // Prevent memory leaks
  if (formattedPriceCache.size > 200) {
    const firstKey = formattedPriceCache.keys().next().value;
    formattedPriceCache.delete(firstKey);
  }

  return formattedPrice;
}

/**
 * Get cached text metrics to avoid expensive measureText calls (NeuroSense FX Pattern)
 */
function getCachedTextMetrics(ctx, formattedPrice, baseFontSize, fontWeight) {
  // Guard clause for safety
  if (!ctx || !formattedPrice) {
    return null;
  }

  const metrics = {};

  // Cache bigFigure metrics
  const bigFigFont = `${fontWeight} ${baseFontSize * formattedPrice.sizing.bigFigureRatio}px monospace`;
  const bigFigKey = `${formattedPrice.text.bigFigure}-${bigFigFont}`;
  if (!textMetricsCache.has(bigFigKey)) {
    const originalFont = ctx.font;
    ctx.font = bigFigFont;
    textMetricsCache.set(bigFigKey, ctx.measureText(formattedPrice.text.bigFigure));
    ctx.font = originalFont;
  }
  metrics.bigFigure = textMetricsCache.get(bigFigKey);

  // Cache pips metrics
  if (formattedPrice.text.pips) {
    const pipsFont = `${fontWeight} ${baseFontSize * formattedPrice.sizing.pipsRatio}px monospace`;
    const pipsKey = `${formattedPrice.text.pips}-${pipsFont}`;
    if (!textMetricsCache.has(pipsKey)) {
      const originalFont = ctx.font;
      ctx.font = pipsFont;
      textMetricsCache.set(pipsKey, ctx.measureText(formattedPrice.text.pips));
      ctx.font = originalFont;
    }
    metrics.pips = textMetricsCache.get(pipsKey);
  }

  // Cache pipette metrics
  if (formattedPrice.text.pipette) {
    const pipetteFont = `${fontWeight} ${baseFontSize * formattedPrice.sizing.pipetteRatio}px monospace`;
    const pipetteKey = `${formattedPrice.text.pipette}-${pipetteFont}`;
    if (!textMetricsCache.has(pipetteKey)) {
      const originalFont = ctx.font;
      ctx.font = pipetteFont;
      textMetricsCache.set(pipetteKey, ctx.measureText(formattedPrice.text.pipette));
      ctx.font = originalFont;
    }
    metrics.pipette = textMetricsCache.get(pipetteKey);
  }

  // Prevent memory leaks
  if (textMetricsCache.size > 300) {
    const firstKey = textMetricsCache.keys().next().value;
    textMetricsCache.delete(firstKey);
  }

  return metrics;
}

/**
 * Clear all caches (useful for testing or memory management)
 */
export function clearPriceDisplayCache() {
  colorCache.clear();
  textMetricsCache.clear();
  formattedPriceCache.clear();
}

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

  // === FOUNDATION LAYER IMPLEMENTATION (NeuroSense FX Pattern) ===
  // 1. Calculate render data with performance optimizations
  const renderData = calculateRenderData(contentArea, adrAxisX, config, state, y);

  // 2. Configure render context for crisp rendering
  configureRenderContext(ctx);

  // 3. Draw background FIRST (behind text) - Foundation First
  drawBackground(ctx, renderData, config, contentArea);

  // 4. ALWAYS draw core price text (trader requirement) - using cached data
  drawPriceText(ctx, renderData, config, state);

  // 5. Apply bounds checking ONLY to enhancements (foundation pattern)
  addEnhancements(ctx, renderData, config, state, contentArea);

  // 6. Restore context state (foundation pattern)
  ctx.restore();
}

/**
 * Calculate render data with performance optimizations (NeuroSense FX Pattern)
 * Pre-calculates all dimensions once, uses cached formatting and metrics
 */
function calculateRenderData(contentArea, adrAxisX, config, state, y) {
  // Calculate price position using same scale as dayRangeMeter
  const priceY = y(state.currentPrice);

  // Check if price display is within canvas bounds
  const inBounds = boundsUtils.isYInBounds(priceY, config, { canvasArea: contentArea });

  // Calculate font size using simplified decimal format
  const fontSize = config.priceFontSize ?? 0.2; // 20% default as decimal
  const baseFontSize = contentArea.height * fontSize;

  // Calculate positioning based on mode using simplified decimal format
  const positioningMode = config.priceDisplayPositioning ?? 'canvasRelative';
  let startX;

  if (positioningMode === 'adrAxis') {
    // Mode 1: ADR Axis Aligned
    const xOffset = config.priceDisplayXOffset ?? 0;
    startX = adrAxisX + (contentArea.width * xOffset);
  } else {
    // Mode 2: Canvas Relative
    const horizontalPosition = config.priceDisplayHorizontalPosition ?? 0.02; // 2% from left as decimal
    const xOffset = config.priceDisplayXOffset ?? 0;
    startX = contentArea.width * horizontalPosition + (contentArea.width * xOffset);
  }

  // PERFORMANCE OPTIMIZATION: Pre-calculate cached data once (Foundation First)
  const cachedFormattedPrice = getCachedFormattedPrice(state.currentPrice, state.digits, config);
  const fontWeight = config.priceFontWeight ?? '600';

  return {
    shouldRender: inBounds,
    startX,
    startY: priceY,
    baseFontSize,
    positioningMode,
    // Pre-calculated data for rendering (no ctx dependency - Foundation First)
    formattedPrice: cachedFormattedPrice,
    fontWeight
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
 * Draw core price text with caching during rendering (NeuroSense FX Pattern)
 * Calculates text metrics during rendering phase when ctx is available
 */
function drawPriceText(ctx, renderData, config, state) {
  const { startX, startY, baseFontSize, formattedPrice, fontWeight } = renderData;

  // Guard clause using cached formatted price
  if (!formattedPrice) {
    console.warn('[PriceDisplay] Missing formatted price, skipping text render');
    return;
  }

  // Determine color based on configuration
  const color = determineColor(config, state);
  ctx.fillStyle = color;

  // PERFORMANCE OPTIMIZATION: Calculate cached text metrics during rendering
  const textMetrics = getCachedTextMetrics(ctx, formattedPrice, baseFontSize, fontWeight);

  let currentX = startX;

  // Draw bigFigure with configurable size (using cached metrics)
  if (textMetrics?.bigFigure) {
    ctx.font = `${fontWeight} ${baseFontSize * formattedPrice.sizing.bigFigureRatio}px monospace`;
    ctx.fillText(formattedPrice.text.bigFigure, currentX, startY);
    currentX += textMetrics.bigFigure.width;
  }

  // Draw pips with configurable size (using cached metrics)
  if (formattedPrice.text.pips && textMetrics?.pips) {
    ctx.font = `${fontWeight} ${baseFontSize * formattedPrice.sizing.pipsRatio}px monospace`;
    ctx.fillText(formattedPrice.text.pips, currentX, startY);
    currentX += textMetrics.pips.width;
  }

  // Draw pipette with configurable size if enabled (using cached metrics)
  if (config.showPipetteDigit && formattedPrice.text.pipette && textMetrics?.pipette) {
    ctx.font = `${fontWeight} ${baseFontSize * formattedPrice.sizing.pipetteRatio}px monospace`;
    ctx.fillText(formattedPrice.text.pipette, currentX, startY);
  }

  // Note: Context restoration handled by main drawPriceDisplay function
}

/**
 * Apply enhancements with bounds checking using cached data (NeuroSense FX Pattern)
 */
function addEnhancements(ctx, renderData, config, state, contentArea) {
  // Apply bounds checking ONLY to enhancements
  if (boundsUtils.isYInBounds(renderData.startY, config, { canvasArea: contentArea })) {
    // Draw bounding box if enabled (background already drawn)
    drawBoundingBox(ctx, renderData, config, state, contentArea);
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
  const bigFigureRatio = config.bigFigureFontSizeRatio ?? 0.6;     // 60% of base (secondary)
  const pipsRatio = config.pipFontSizeRatio ?? 1.0;               // 100% of base (PRIMARY - most important)
  const pipetteRatio = config.pipetteFontSizeRatio ?? 0.4;        // 40% of base (tertiary)

  return {
    text: { bigFigure, pips, pipette },
    sizing: { bigFigureRatio, pipsRatio, pipetteRatio },
    classification // Include classification for debugging/analysis
  };
}

/**
 * Simplified price formatting for hover indicators using NeuroSenseFX classification
 * Returns properly formatted string WITHOUT pipettes for clean display
 */
export function formatPriceSimple(price, digits) {
  if (price === undefined || price === null || isNaN(price)) {
    return 'N/A';
  }

  const safeDigits = digits || 5;
  const priceStr = price.toFixed(safeDigits);
  const parts = priceStr.split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1] || '';

  // Apply NeuroSenseFX Dynamic Asset Classification System
  const classification = classifyPriceFormat(price, digits);

  switch (classification.type) {
    case 'FX_JPY_STYLE': // USDJPY: 149.876 → 149.87 (show 2 decimal places, no pipettes)
      const jpyDecimalPlaces = Math.min(2, decimalPart.length);
      return `${integerPart}.${decimalPart.substring(0, jpyDecimalPlaces)}`;

    case 'FX_STANDARD': // EURUSD: 1.23456 → 1.2345 (show 4 decimal places, no pipettes)
      if (safeDigits === 5) {
        // Remove the 5th digit (pipette) - show only 4 decimals
        return `${integerPart}.${decimalPart.substring(0, 4)}`;
      } else {
        // For other digit counts, show all but the last digit
        const displayDigits = Math.max(safeDigits - 1, 2);
        return `${integerPart}.${decimalPart.substring(0, displayDigits)}`;
      }

    case 'HIGH_VALUE_COMMODITY': // XAUUSD: 3000.00 (show 2 decimals)
      if (safeDigits >= 2) {
        return `${integerPart}.${decimalPart.substring(0, 2)}`;
      } else {
        return `${integerPart}`;
      }

    case 'HIGH_VALUE_CRYPTO': // BTCUSD: 95000.00 → 95000 (no decimals for high values)
      if (price >= 1000) {
        return integerPart; // No decimals for high-value crypto
      } else {
        return priceStr; // Use standard formatting for lower values
      }

    default:
      return priceStr;
  }
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
 * Draw background using EXACT text measurements (NeuroSense FX Pattern)
 * Uses cached text metrics for pixel-perfect background sizing
 */
function drawBackground(ctx, renderData, config, contentArea) {
  if (!config.showPriceBackground) return; // Early return if disabled

  const { startX, startY, formattedPrice, baseFontSize, fontWeight } = renderData;

  // FIX: Use config value properly, with fallback to contentArea percentage
  const padding = (config.priceDisplayPadding !== undefined) ?
    config.priceDisplayPadding :
    contentArea.height * 0.02;

  // Use EXACT text measurements for pixel-perfect background
  let totalWidth = 0;
  let totalHeight = 0;

  if (formattedPrice) {
    // Get exact text metrics (same as used in drawPriceText)
    const textMetrics = getCachedTextMetrics(ctx, formattedPrice, baseFontSize, fontWeight);

    if (textMetrics) {
      // Calculate total width using EXACT measurements
      totalWidth += textMetrics.bigFigure?.width || 0;
      totalWidth += textMetrics.pips?.width || 0;
      totalWidth += textMetrics.pipette?.width || 0;

      // FIX: Use ACTUAL text bounding box heights, not font size calculations
      const bigFigHeight = (textMetrics.bigFigure?.actualBoundingBoxAscent || 0) +
                          (textMetrics.bigFigure?.actualBoundingBoxDescent || 0);
      const pipsHeight = (textMetrics.pips?.actualBoundingBoxAscent || 0) +
                        (textMetrics.pips?.actualBoundingBoxDescent || 0);
      const pipetteHeight = (textMetrics.pipette?.actualBoundingBoxAscent || 0) +
                           (textMetrics.pipette?.actualBoundingBoxDescent || 0);

      // Use the LARGEST actual text height
      totalHeight = Math.max(bigFigHeight, pipsHeight, pipetteHeight, 1); // Minimum 1px
    } else {
      // Fallback to contentArea percentages if text metrics unavailable
      totalWidth = contentArea.width * 0.12;
      totalHeight = contentArea.height * 0.03;
    }
  } else {
    // Fallback estimation
    totalWidth = contentArea.width * 0.12;
    totalHeight = contentArea.height * 0.03;
  }

  // Calculate background dimensions using EXACT measurements
  const backgroundWidth = totalWidth + (padding * 2);
  const backgroundHeight = totalHeight + (padding * 2);
  const backgroundX = startX - padding;
  const backgroundY = startY - (totalHeight / 2) - padding;

  // Draw pixel-perfect background rectangle
  ctx.fillStyle = hexToRgba(config.priceBackgroundColor ?? '#111827', config.priceBackgroundOpacity ?? 0.8);
  ctx.fillRect(backgroundX, backgroundY, backgroundWidth, backgroundHeight);
}

/**
 * Draw bounding box outline using EXACT text measurements (NeuroSense FX Pattern)
 * Enhancement layer - perfectly aligned with background using same measurements
 */
function drawBoundingBox(ctx, renderData, config, state, contentArea) {
  if (!config.showPriceBoundingBox) return; // Early return if disabled

  const { startX, startY, formattedPrice, baseFontSize, fontWeight } = renderData;

  // FIX: Use config value properly, with fallback to contentArea percentage
  const padding = (config.priceDisplayPadding !== undefined) ?
    config.priceDisplayPadding :
    contentArea.height * 0.02;

  // Use EXACT text measurements for perfect alignment with background
  let totalWidth = 0;
  let totalHeight = 0;

  if (formattedPrice) {
    // Get exact text metrics (same as background and drawPriceText)
    const textMetrics = getCachedTextMetrics(ctx, formattedPrice, baseFontSize, fontWeight);

    if (textMetrics) {
      // Calculate total width using EXACT measurements
      totalWidth += textMetrics.bigFigure?.width || 0;
      totalWidth += textMetrics.pips?.width || 0;
      totalWidth += textMetrics.pipette?.width || 0;

      // FIX: Use ACTUAL text bounding box heights, not font size calculations
      const bigFigHeight = (textMetrics.bigFigure?.actualBoundingBoxAscent || 0) +
                          (textMetrics.bigFigure?.actualBoundingBoxDescent || 0);
      const pipsHeight = (textMetrics.pips?.actualBoundingBoxAscent || 0) +
                        (textMetrics.pips?.actualBoundingBoxDescent || 0);
      const pipetteHeight = (textMetrics.pipette?.actualBoundingBoxAscent || 0) +
                           (textMetrics.pipette?.actualBoundingBoxDescent || 0);

      // Use the LARGEST actual text height
      totalHeight = Math.max(bigFigHeight, pipsHeight, pipetteHeight, 1); // Minimum 1px
    } else {
      // Fallback to contentArea percentages if text metrics unavailable
      totalWidth = contentArea.width * 0.12;
      totalHeight = contentArea.height * 0.03;
    }
  } else {
    // Fallback estimation
    totalWidth = contentArea.width * 0.12;
    totalHeight = contentArea.height * 0.03;
  }

  // Calculate box dimensions (same as background for perfect alignment)
  const boxWidth = totalWidth + (padding * 2);
  const boxHeight = totalHeight + (padding * 2);
  const boxX = startX - padding;
  const boxY = startY - (totalHeight / 2) - padding;

  // Draw border outline (enhancement layer)
  ctx.strokeStyle = hexToRgba(config.priceBoxOutlineColor ?? '#4B5563', config.priceBoxOutlineOpacity ?? 1);
  ctx.lineWidth = 1;
  ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
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

