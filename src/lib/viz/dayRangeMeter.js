import { scaleLinear } from 'd3-scale';
import { createCanvasSizingConfig, configureCanvasContext, boundsUtils, configureTextForDPR } from '../../utils/canvasSizing.js';
import { formatPriceSimple } from '../utils/priceFormatting.js';
import { priceScale, currentBounds, coordinateActions } from '../../stores/coordinateStore.js';
import { CoordinateValidator } from '../../utils/coordinateValidator.js';

/**
 * DPR-Aware Day Range Meter Implementation
 * 
 * Leverages existing canvasSizing infrastructure for crisp 1px line rendering
 * and proper device pixel ratio handling across all display types.
 * 
 * Architecture: Foundation First - elemental information display with perfect visual quality
 */

export function drawDayRangeMeter(ctx, renderingContext, config, state, y) {
  // Guard clauses for safety
  if (!ctx || !renderingContext || !config || !state) {
    console.warn('[DayRangeMeter] Missing required parameters, skipping render');
    return;
  }

  // 🔧 PHASE 2: Enhanced YScale Validation for Trading-Critical Accuracy
  const displayId = renderingContext?.displayId || 'unknown';
  const coordinateValidation = CoordinateValidator.validateVisualizationCoordinateSystem(
    'DayRangeMeter', y, state, renderingContext.contentArea, displayId
  );

  if (!coordinateValidation.isValid) {
    console.warn(`[${displayId}] ${coordinateValidation.visualizationName} coordinate validation failed:`,
      coordinateValidation);
    // Continue rendering for resilience, but log the issue
  }

  // Extract rendering context from the unified infrastructure
  const { contentArea, adrAxisX } = renderingContext;

  // Extract essential data using source of truth from dataProcessor schema
  const {
    midPrice,        // Daily open price (from todaysOpen in backend)
    currentPrice,     // Current tick price
    todaysHigh,      // Session high
    todaysLow,       // Session low
    projectedAdrHigh, // ADR upper boundary
    projectedAdrLow,  // ADR lower boundary
    digits = 5       // Price precision
  } = state;

  // Calculate ADR value from projected boundaries (consistent with dataProcessor)
  const adrValue = (projectedAdrHigh !== null && projectedAdrLow !== null)
    ? projectedAdrHigh - projectedAdrLow
    : null;

  // Guard for essential data - check for null, undefined, or invalid values
  if (midPrice === null || midPrice === undefined || adrValue === null || adrValue === undefined || adrValue <= 0) {
    // Skip render silently in production to avoid console spam
    if (import.meta.env.DEV) {
      console.warn('[DayRangeMeter] Missing essential data (midPrice, adrValue), skipping render');
    }
    return;
  }

  // === REACTIVE COORDINATE SYSTEM INTEGRATION ===
  // 🔧 CRITICAL FIX: Add error handling for coordinate store updates
  try {
    // Update coordinate store with current price data for reactive transformations
    if (coordinateActions && typeof coordinateActions.updatePriceRange === 'function') {
      coordinateActions.updatePriceRange({
        midPrice,
        projectedAdrHigh,
        projectedAdrLow,
        todaysHigh,
        todaysLow
      });
    }
  } catch (error) {
    console.warn('[DayRangeMeter] Failed to update coordinate store:', error);
    // Continue without coordinate store update - don't let this break rendering
  }

  // 🔧 PHASE 2 FIX: Prioritize D3 scale over coordinateActions for reactive contentArea support
  // This ensures visualizations use the now-reactive D3 scale instead of static coordinate store
  let transformFunction = null;

  // Determine transformation function once (FIXED PRIORITY ORDER)
  if (y && typeof y === 'function') {
    transformFunction = y; // Use D3 scale first (now reactive with contentArea)
  } else if (coordinateActions && typeof coordinateActions.transform === 'function') {
    transformFunction = (price) => {
      try {
        const result = coordinateActions.transform(price, 'price', 'pixel');
        return (result !== null && !isNaN(result) && isFinite(result)) ? result : null;
      } catch (error) {
        return null; // Signal to use fallback
      }
    };
  }

  const priceToY = (price) => {
    if (transformFunction) {
      const result = transformFunction(price);
      if (result !== null && !isNaN(result) && isFinite(result)) {
        return result;
      }
    }

    // Silent fallback to center (production-optimized, no console spam)
    return contentArea ? contentArea.height / 2 : 60;
  };

  // === FOUNDATION LAYER IMPLEMENTATION ===
  // 1. Draw ADR Axis (Core Meter Element) - Using reactive coordinates for center line
  drawAdrAxis(ctx, contentArea, adrAxisX, state, priceToY);

  // 2. Draw Percentage Markers (Spatial Context) - Using reactive coordinates
  drawPercentageMarkers(ctx, contentArea, adrAxisX, config, state, priceToY);

  // 3. Draw Price Markers (OHL + Current) - Using reactive coordinates
  drawPriceMarkers(ctx, contentArea, adrAxisX, state, priceToY, digits);

  // 4. Draw ADR Information Display (DISABLED - context menu configs not working)
  // drawAdrInformation(ctx, contentArea, state);
}

/**
 * Draw ADR Axis - Core meter element with enhanced DPR-aware crisp rendering
 */
function drawAdrAxis(ctx, contentArea, adrAxisX, state, priceToY) {
  // Get DPR information for crisp rendering (if available)
  const dpr = ctx.getTransform ? ctx.getTransform().a || 1 : 1;

  // Configure for DPR-aware crisp 1px lines
  ctx.save();

  // Apply sub-pixel translation for crisp rendering
  ctx.translate(0.5 / dpr, 0.5 / dpr);

  // Main ADR axis line with DPR-optimized width
  ctx.strokeStyle = '#4B5563'; // Neutral gray
  ctx.lineWidth = 1 / dpr; // Scale line width for crisp rendering
  ctx.beginPath();
  ctx.moveTo(Math.round(adrAxisX), 0);
  ctx.lineTo(Math.round(adrAxisX), Math.round(contentArea.height));
  ctx.stroke();

  // 🔧 CRITICAL FIX: Use reactive coordinate transformation for center line
  // Center reference line (Daily Open Price position) - now reactive!
  let centerY;

  // Safety checks for reactive coordinate system
  if (state && state.midPrice !== null && state.midPrice !== undefined && priceToY && typeof priceToY === 'function') {
    try {
      // Use reactive coordinate transformation for actual midPrice position
      centerY = priceToY(state.midPrice);

      // Validate the result
      if (centerY === null || centerY === undefined || isNaN(centerY) || !isFinite(centerY)) {
        // Fallback to static calculation if reactive fails
        centerY = Math.floor(contentArea.height / 2);
        console.warn('[DayRangeMeter] Reactive center coordinate failed, using static fallback');
      }
    } catch (error) {
      // Fallback to static calculation if error occurs
      centerY = Math.floor(contentArea.height / 2);
      console.warn('[DayRangeMeter] Error calculating reactive center coordinate:', error);
    }
  } else {
    // Fallback to static calculation if data unavailable
    centerY = Math.floor(contentArea.height / 2);
  }

  // Ensure center line is within reasonable bounds
  centerY = Math.max(-50, Math.min(contentArea.height + 50, centerY));

  // Draw the center reference line with reactive positioning and DPR optimization
  ctx.strokeStyle = '#6B7280'; // Lighter gray for center
  ctx.lineWidth = 1 / dpr; // Scale line width for crisp rendering
  ctx.setLineDash([2 / dpr, 2 / dpr]); // Scale dash pattern for DPR
  ctx.beginPath();
  ctx.moveTo(0, Math.round(centerY));
  ctx.lineTo(Math.round(contentArea.width), Math.round(centerY));
  ctx.stroke();
  ctx.setLineDash([]); // Reset dash pattern

  ctx.restore();
}

/**
 * Draw Percentage Markers for spatial context
 * Updated to use reactive coordinate transformations
 */
function drawPercentageMarkers(ctx, contentArea, adrAxisX, config, state, priceToY) {
  // Use source of truth from dataProcessor schema
  const dailyOpen = state.midPrice;  // This IS the daily open price
  const adrValue = state.projectedAdrHigh - state.projectedAdrLow;

  const { showAdrRangeIndicatorLines, adrLabelType, adrLabelPosition } = config;

  // Helper function to determine which side to draw markers on
  function getMarkerSide(isHighSide) {
    switch (adrLabelPosition) {
      case 'left':
        return 'left';
      case 'right':
        return 'right';
      case 'both':
      default:
        // For both sides: high side markers on right, low side markers on left
        return isHighSide ? 'right' : 'left';
    }
  }

  if (!dailyOpen || !adrValue) {
    console.log('[ADR_DEBUG] Missing essential data, returning');
    return;
  }

  // Guard: Only draw if enabled in configuration
  if (!showAdrRangeIndicatorLines) {
    console.log('[ADR_DEBUG] ADR range indicator lines disabled in config');
    return;
  }

  // Calculate ADR levels up to current maximum
  const adrRange = adrValue;
  const currentMaxAdr = calculateMaxAdrPercentage(state);

  // 🔍 DEBUG: Log calculations
  console.log('[ADR_DEBUG] Calculations:', {
    adrRange,
    currentMaxAdr,
    todaysHigh: state.todaysHigh,
    todaysLow: state.todaysLow
  });

  ctx.save();
  ctx.translate(0.5, 0.5); // Crisp line rendering

  // Font setup for percentage labels
  ctx.font = '10px sans-serif';
  ctx.fillStyle = '#9CA3AF'; // Light gray for percentage markers

  if (adrLabelType === 'static') {
    // Static: Draw fixed ADR percentage levels (25%, 50%, 75%, 100%)
    const adrLevels = [0.25, 0.5, 0.75, 1.0];

    console.log('[ADR_DEBUG] Static mode, levels to check:', adrLevels.filter(level => currentMaxAdr >= level));

    adrLevels.forEach(level => {
      if (currentMaxAdr >= level) {
        const adrHigh = dailyOpen + (adrRange * level);
        const adrLow = dailyOpen - (adrRange * level);

        // High side marker - Using reactive coordinates
        const highY = priceToY(adrHigh);
        const highInBounds = boundsUtils.isYInBounds(highY, config, { canvasArea: contentArea });
        console.log('[ADR_DEBUG] Static high marker (reactive):', {
          level,
          adrHigh,
          highY,
          highInBounds
        });
        if (highInBounds) {
          const markerSide = getMarkerSide(true); // High side marker
          drawPercentageMarker(ctx, adrAxisX, highY, `${level * 100}%`, markerSide);
        }

        // Low side marker - Using reactive coordinates
        const lowY = priceToY(adrLow);
        const lowInBounds = boundsUtils.isYInBounds(lowY, config, { canvasArea: contentArea });
        console.log('[ADR_DEBUG] Static low marker (reactive):', {
          level,
          adrLow,
          lowY,
          lowInBounds
        });
        if (lowInBounds) {
          const markerSide = getMarkerSide(false); // Low side marker
          drawPercentageMarker(ctx, adrAxisX, lowY, `-${level * 100}%`, markerSide);
        }
      }
    });
  } else if (adrLabelType === 'dynamic') {
    // Dynamic: Show actual percentage of ADR that today's high/low represent
    const { todaysHigh, todaysLow } = state;


    console.log('[ADR_DEBUG] Dynamic mode, H/L data:', { todaysHigh, todaysLow });

    if (todaysHigh !== undefined) {
      const highPercentage = ((todaysHigh - dailyOpen) / adrRange) * 100;
      const highY = priceToY(todaysHigh); // Using reactive coordinates
      const highLabel = `${highPercentage >= 0 ? '+' : ''}${highPercentage.toFixed(0)}%`;
      const highInBounds = boundsUtils.isYInBounds(highY, config, { canvasArea: contentArea });

      console.log('[ADR_DEBUG] Dynamic high marker (reactive):', {
        todaysHigh,
        dailyOpen,
        highPercentage,
        highY,
        highLabel,
        highInBounds
      });

      if (highInBounds) {
        const markerSide = getMarkerSide(true); // High side marker
        drawPercentageMarker(ctx, adrAxisX, highY, highLabel, markerSide);
      }
    }

    if (todaysLow !== undefined) {
      const lowPercentage = ((dailyOpen - todaysLow) / adrRange) * 100;
      const lowY = priceToY(todaysLow); // Using reactive coordinates
      const lowLabel = `${lowPercentage >= 0 ? '+' : ''}${lowPercentage.toFixed(0)}%`;
      const lowInBounds = boundsUtils.isYInBounds(lowY, config, { canvasArea: contentArea });

      console.log('[ADR_DEBUG] Dynamic low marker (reactive):', {
        todaysLow,
        dailyOpen,
        lowPercentage,
        lowY,
        lowLabel,
        lowInBounds
      });

      if (lowInBounds) {
        const markerSide = getMarkerSide(false); // Low side marker
        drawPercentageMarker(ctx, adrAxisX, lowY, lowLabel, markerSide);
      }

    }
  }

  // Draw boundary lines at current canvas extremes - Using reactive coordinates
  drawBoundaryLines(ctx, contentArea, adrAxisX, state, priceToY);

  ctx.restore();
}

/**
 * Draw individual percentage marker with line and label
 */
function drawPercentageMarker(ctx, axisX, y, label, side) {
  const markerLength = 8;
  const labelOffset = 12;

  // Horizontal line at percentage level
  ctx.strokeStyle = '#374151'; // Subtle gray
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(axisX - markerLength, y);
  ctx.lineTo(axisX + markerLength, y);
  ctx.stroke();

  // Percentage label
  ctx.textAlign = side === 'right' ? 'left' : 'right';
  ctx.fillStyle = '#9CA3AF';
  const textX = side === 'right' ? axisX + labelOffset : axisX - labelOffset;
  ctx.fillText(label, textX, y + 3);
}

/**
 * Draw boundary lines at canvas extremes with proper bounds checking
 * Updated to use reactive coordinate transformations
 */
function drawBoundaryLines(ctx, contentArea, axisX, state, priceToY) {
  const { midPrice, projectedAdrHigh, projectedAdrLow } = state;
  const adrValue = projectedAdrHigh - projectedAdrLow;
  if (!midPrice || !adrValue) return;

  const currentMaxAdr = calculateMaxAdrPercentage(state);
  const adrRange = adrValue;

  // Calculate actual boundary positions
  const highBoundary = midPrice + (adrRange * currentMaxAdr);
  const lowBoundary = midPrice - (adrRange * currentMaxAdr);

  const highY = priceToY(highBoundary); // Using reactive coordinates
  const lowY = priceToY(lowBoundary); // Using reactive coordinates

  // Clamp X coordinates to canvas bounds
  const minX = Math.max(0, 0);
  const maxX = Math.min(contentArea.width, contentArea.width);

  // Draw boundary lines if they're within reasonable canvas bounds
  ctx.strokeStyle = '#EF4444'; // Red for boundaries
  ctx.lineWidth = 1;

  if (highY >= -10 && highY <= contentArea.height + 10) {
    ctx.beginPath();
    ctx.moveTo(minX, highY);
    ctx.lineTo(maxX, highY);
    ctx.stroke();
  }

  if (lowY >= -10 && lowY <= contentArea.height + 10) {
    ctx.beginPath();
    ctx.moveTo(minX, lowY);
    ctx.lineTo(maxX, lowY);
    ctx.stroke();
  }
}

/**
 * Draw Price Markers (Open, High, Low, Current)
 * Updated to use reactive coordinate transformations
 */
function drawPriceMarkers(ctx, contentArea, axisX, state, priceToY, digits) {
  const { midPrice, currentPrice, todaysHigh, todaysLow } = state;
  
  ctx.save();
  ctx.translate(0.5, 0.5); // Crisp line rendering
  
  // 🔧 PIXEL-PERFECT: Use enhanced DPR-aware font configuration
  // Create canvas dimensions object for configureTextForDPR
  const canvasDimensions = {
    dpr: window.devicePixelRatio || 1,
    canvas: { width: contentArea.width, height: contentArea.height }
  };
  
  // Configure text with pixel-perfect sizing
  const textConfig = configureTextForDPR(ctx, canvasDimensions, {
    baseFontSize: 10,
    fontFamily: 'monospace',
    textAlign: 'center',
    textBaseline: 'middle',
    fillStyle: '#9CA3AF' // Light gray for price markers
  });
  
  // Draw Open Price (always at center) - Using reactive coordinates
  if (midPrice !== undefined) {
    const openY = priceToY(midPrice);
    drawPriceMarker(ctx, axisX, openY, `O ${formatPrice(midPrice, digits)}`, '#6B7280', 'right');
  }

  // Draw High Price - Using reactive coordinates
  if (todaysHigh !== undefined) {
    const highY = priceToY(todaysHigh);
    if (boundsUtils.isYInBounds(highY, {}, { canvasArea: contentArea })) {
      drawPriceMarker(ctx, axisX, highY, `H ${formatPrice(todaysHigh, digits)}`, '#F59E0B', 'right');
    }
  }

  // Draw Low Price - Using reactive coordinates
  if (todaysLow !== undefined) {
    const lowY = priceToY(todaysLow);
    if (boundsUtils.isYInBounds(lowY, {}, { canvasArea: contentArea })) {
      drawPriceMarker(ctx, axisX, lowY, `L ${formatPrice(todaysLow, digits)}`, '#F59E0B', 'right');
    }
  }


  // Draw Current Price (emphasized) - Using reactive coordinates
  if (currentPrice !== undefined) {
    const currentY = priceToY(currentPrice);
    if (boundsUtils.isYInBounds(currentY, {}, { canvasArea: contentArea })) {
      drawPriceMarker(ctx, axisX, currentY, `C ${formatPrice(currentPrice, digits)}`, '#10B981', 'right');
    }
  }
  
  ctx.restore();
}

/**
 * Draw individual price marker with line and label
 */
function drawPriceMarker(ctx, axisX, y, label, color, side) {
  const markerLength = 12;
  const labelOffset = 15;
  
  // Price marker line (longer than percentage markers)
  ctx.strokeStyle = color;
  ctx.lineWidth = 2; // Slightly thicker for price markers
  ctx.beginPath();
  ctx.moveTo(axisX - markerLength, y);
  ctx.lineTo(axisX + markerLength, y);
  ctx.stroke();
  
  // Price label
  ctx.textAlign = side === 'right' ? 'left' : 'right';
  ctx.fillStyle = color;
  const textX = side === 'right' ? axisX + labelOffset : axisX - labelOffset;
  ctx.fillText(label, textX, y + 3);
}

/**
 * Draw dynamic session marker (real-time high/low percentages)
 * Distinguished from static markers with different visual style
 */
function drawDynamicSessionMarker(ctx, axisX, y, label, side) {
  const markerLength = 10; // Slightly shorter than static markers
  const labelOffset = 15;
  
  // Use different visual style to distinguish from static markers
  ctx.strokeStyle = '#60A5FA'; // Blue color for session markers
  ctx.lineWidth = 1.5; // Intermediate thickness
  ctx.beginPath();
  ctx.moveTo(axisX - markerLength, y);
  ctx.lineTo(axisX + markerLength, y);
  ctx.stroke();
  
  // Add small circle marker for additional visual distinction
  ctx.fillStyle = '#60A5FA';
  ctx.beginPath();
  ctx.arc(axisX, y, 3, 0, Math.PI * 2);
  ctx.fill();
  
  // Session label with different color
  ctx.textAlign = side === 'right' ? 'left' : 'right';
  ctx.fillStyle = '#60A5FA'; // Blue to match marker
  const textX = side === 'right' ? axisX + labelOffset + 5 : axisX - labelOffset - 5;
  ctx.fillText(label, textX, y + 3);
}

/**
 * Draw ADR Information Display at top center
 */
function drawAdrInformation(ctx, contentArea, state) {
  const { midPrice, currentPrice, projectedAdrHigh, projectedAdrLow } = state;
  const adrValue = projectedAdrHigh - projectedAdrLow;
  
  if (!midPrice || !currentPrice || !adrValue) return;
  
  // Calculate current ADR percentage
  const adrPercentage = ((currentPrice - midPrice) / adrValue) * 100;
  const sign = adrPercentage >= 0 ? '+' : '';
  const labelText = `ADR: ${sign}${adrPercentage.toFixed(1)}%`;
  
  // Draw at top center with background
  ctx.save();
  
  // Simple font setup for ADR information (no DPR scaling in DPR-scaled context)
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#3B82F6'; // Blue for ADR info
  
  // Text metrics for background (using DPR-aware font)
  const metrics = ctx.measureText(labelText);
  const textWidth = metrics.width;
  const padding = 8;
  const backgroundHeight = 20;
  
  // Calculate positions relative to canvas area
  const centerX = contentArea.width / 2;
  const bgX = centerX - textWidth / 2 - padding;
  const bgY = 5;
  const bgWidth = textWidth + (padding * 2);
  
  // Background
  ctx.fillStyle = 'rgba(31, 41, 55, 0.9)'; // Dark semi-transparent background
  ctx.fillRect(bgX, bgY, bgWidth, backgroundHeight);
  
  // Border
  ctx.strokeStyle = '#4B5563';
  ctx.lineWidth = 1;
  ctx.strokeRect(bgX, bgY, bgWidth, backgroundHeight);
  
  // Text (using configured DPR-aware settings)
  ctx.fillText(labelText, centerX, bgY + backgroundHeight / 2);
  
  ctx.restore();
}

/**
 * Helper: Calculate maximum ADR percentage needed for current data
 */
function calculateMaxAdrPercentage(state) {
  const { midPrice: dailyOpen, todaysHigh, todaysLow, projectedAdrHigh, projectedAdrLow } = state;
  const adrValue = projectedAdrHigh && projectedAdrLow ? projectedAdrHigh - projectedAdrLow : null;
  
  if (!dailyOpen || !adrValue || (!todaysHigh && !todaysLow)) {
    return 0.5; // Default to 50% if no data
  }
  
  let maxPercentage = 0.5; // Start with 50% baseline
  
  if (todaysHigh) {
    const highPercentage = Math.abs(todaysHigh - dailyOpen) / adrValue;
    maxPercentage = Math.max(maxPercentage, highPercentage);
  }
  
  if (todaysLow) {
    const lowPercentage = Math.abs(dailyOpen - todaysLow) / adrValue;
    maxPercentage = Math.max(maxPercentage, lowPercentage);
  }
  
  // Round up to next 0.25 increment for clean marker spacing
  return Math.ceil(maxPercentage * 4) / 4;
}

/**
 * Helper: Format price using the optimized central formatting engine
 * Provides consistent asset classification and clean display without pipettes
 */
function formatPrice(price, digits) {
  return formatPriceSimple(price, digits);
}
