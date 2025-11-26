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
import { CoordinateValidator } from '../../utils/coordinateValidator.js';
import {
  formatPrice,
  formatPriceSimple,
  getTextMetricsCached,
  clearPriceFormattingCache,
  priceFormattingEngine
} from '../utils/priceFormatting.js';

// =============================================================================
// PERFORMANCE-FIRST CACHING SYSTEM (NeuroSense FX Principle)
// =============================================================================
// Eliminates redundant calculations and memory allocations
// Follows established performance patterns for 60fps rendering

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
 * Get cached formatted price using the optimized central engine
 */
function getCachedFormattedPrice(price, digits, config) {
  // Use the central formatting engine with optimized caching
  return priceFormattingEngine.formatPrice(price, digits, config);
}

/**
 * Get cached text metrics using the optimized central engine
 */
function getCachedTextMetrics(ctx, formattedPrice, baseFontSize, fontWeight) {
  // Guard clause for safety
  if (!ctx || !formattedPrice) {
    return null;
  }

  const metrics = {};

  // Get bigFigure metrics using central cache
  const bigFigFont = `${fontWeight} ${baseFontSize * formattedPrice.sizing.bigFigureRatio}px monospace`;
  metrics.bigFigure = getTextMetricsCached(ctx, formattedPrice.text.bigFigure, bigFigFont);

  // Get pips metrics using central cache
  if (formattedPrice.text.pips) {
    const pipsFont = `${fontWeight} ${baseFontSize * formattedPrice.sizing.pipsRatio}px monospace`;
    metrics.pips = getTextMetricsCached(ctx, formattedPrice.text.pips, pipsFont);
  }

  // Get pipette metrics using central cache
  if (formattedPrice.text.pipette) {
    const pipetteFont = `${fontWeight} ${baseFontSize * formattedPrice.sizing.pipetteRatio}px monospace`;
    metrics.pipette = getTextMetricsCached(ctx, formattedPrice.text.pipette, pipetteFont);
  }

  return metrics;
}

/**
 * Clear all caches (useful for testing or memory management)
 * Now uses the central formatting engine's cache management
 */
export function clearPriceDisplayCache() {
  colorCache.clear();
  clearPriceFormattingCache(); // Use central cache management
}

export function drawPriceDisplay(ctx, renderingContext, config, state, y) {
  // Guard clauses for safety (SAME PATTERN AS priceFloat.js)
  if (!ctx || !renderingContext || !config || !state || !y) {
    console.warn('[PriceDisplay] Missing required parameters, skipping render');
    return;
  }

  // 🔧 PHASE 2: Enhanced YScale Validation for Trading-Critical Accuracy
  const displayId = renderingContext?.displayId || 'unknown';
  const coordinateValidation = CoordinateValidator.validateVisualizationCoordinateSystem(
    'PriceDisplay', y, state, renderingContext.contentArea, displayId
  );

  if (!coordinateValidation.isValid) {
    console.warn(`[${displayId}] ${coordinateValidation.visualizationName} coordinate validation failed:`,
      coordinateValidation);
    // Continue rendering for resilience, but log the issue
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

// formatPrice function now imported from central formatting engine

// formatPriceSimple function now imported from central formatting engine

// classifyPriceFormat function now handled by central formatting engine


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

