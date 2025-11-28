import { scaleLinear } from 'd3-scale';
import { formatPriceSimple } from '../utils/priceFormatting.js';

/**
 * Simplified DPR-Aware Day Range Meter Implementation
 *
 * Ultimate simplification following "Simple, Performant, Maintainable" principles.
 * Uses direct D3 scale usage instead of complex coordinate integration.
 *
 * Architecture: Foundation First - elemental information display with perfect visual quality
 */

export function drawDayRangeMeter(ctx, renderingContext, config, state, priceScale) {
  // Guard clauses for safety
  if (!ctx || !renderingContext || !config || !state || !priceScale) {
    return;
  }

  // Extract rendering context
  const { contentArea, adrAxisX } = renderingContext;

  // Extract essential data
  const {
    midPrice,
    currentPrice,
    todaysHigh,
    todaysLow,
    projectedAdrHigh,
    projectedAdrLow,
    digits = 5
  } = state;

  // Calculate ADR value
  const adrValue = (projectedAdrHigh !== null && projectedAdrLow !== null)
    ? projectedAdrHigh - projectedAdrLow
    : null;

  // Guard for essential data
  if (midPrice === null || midPrice === undefined || adrValue === null || adrValue === undefined || adrValue <= 0) {
    return;
  }

  // Create direct D3 scale for price to Y coordinate transformation
  const priceRange = {
    min: projectedAdrLow - (adrValue * 0.1), // 10% buffer
    max: projectedAdrHigh + (adrValue * 0.1)
  };

  const yScale = scaleLinear()
    .domain([priceRange.max, priceRange.min]) // Inverted for canvas coordinates
    .range([0, contentArea.height]);

  // Draw components
  drawAdrAxis(ctx, contentArea, adrAxisX, yScale, midPrice);
  drawPercentageMarkers(ctx, contentArea, adrAxisX, config, state, yScale);
  drawPriceMarkers(ctx, contentArea, adrAxisX, state, yScale, digits);
}

/**
 * Draw ADR Axis with crisp DPR-aware rendering
 */
function drawAdrAxis(ctx, contentArea, adrAxisX, yScale, midPrice) {
  const dpr = window.devicePixelRatio || 1;

  ctx.save();
  ctx.translate(0.5 / dpr, 0.5 / dpr);

  // Main ADR axis line
  ctx.strokeStyle = '#4B5563';
  ctx.lineWidth = 1 / dpr;
  ctx.beginPath();
  ctx.moveTo(Math.round(adrAxisX), 0);
  ctx.lineTo(Math.round(adrAxisX), Math.round(contentArea.height));
  ctx.stroke();

  // Center reference line (Daily Open Price)
  const centerY = Math.round(yScale(midPrice));
  ctx.strokeStyle = '#6B7280';
  ctx.lineWidth = 1 / dpr;
  ctx.setLineDash([2 / dpr, 2 / dpr]);
  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(Math.round(contentArea.width), centerY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();
}

/**
 * Draw Percentage Markers for spatial context
 */
function drawPercentageMarkers(ctx, contentArea, adrAxisX, config, state, yScale) {
  const { midPrice } = state;
  const adrValue = state.projectedAdrHigh - state.projectedAdrLow;
  const { showAdrRangeIndicatorLines, adrLabelType, adrLabelPosition } = config;

  if (!showAdrRangeIndicatorLines || !midPrice || !adrValue) {
    return;
  }

  const currentMaxAdr = calculateMaxAdrPercentage(state);

  ctx.save();
  ctx.translate(0.5, 0.5);
  ctx.font = '10px sans-serif';
  ctx.fillStyle = '#9CA3AF';

  const getMarkerSide = (isHighSide) => {
    switch (adrLabelPosition) {
      case 'left': return 'left';
      case 'right': return 'right';
      case 'both':
      default: return isHighSide ? 'right' : 'left';
    }
  };

  if (adrLabelType === 'static') {
    // Static ADR percentage levels (25%, 50%, 75%, 100%)
    const adrLevels = [0.25, 0.5, 0.75, 1.0];

    adrLevels.forEach(level => {
      if (currentMaxAdr >= level) {
        const adrHigh = midPrice + (adrValue * level);
        const adrLow = midPrice - (adrValue * level);

        // High side marker
        const highY = yScale(adrHigh);
        if (isYInBounds(highY, contentArea)) {
          const markerSide = getMarkerSide(true);
          drawPercentageMarker(ctx, adrAxisX, highY, `${level * 100}%`, markerSide);
        }

        // Low side marker
        const lowY = yScale(adrLow);
        if (isYInBounds(lowY, contentArea)) {
          const markerSide = getMarkerSide(false);
          drawPercentageMarker(ctx, adrAxisX, lowY, `-${level * 100}%`, markerSide);
        }
      }
    });
  } else if (adrLabelType === 'dynamic') {
    // Dynamic: Show actual percentage of ADR for today's high/low
    const { todaysHigh, todaysLow } = state;

    if (todaysHigh !== undefined) {
      const highPercentage = ((todaysHigh - midPrice) / adrValue) * 100;
      const highY = yScale(todaysHigh);
      if (isYInBounds(highY, contentArea)) {
        const highLabel = `${highPercentage >= 0 ? '+' : ''}${highPercentage.toFixed(0)}%`;
        const markerSide = getMarkerSide(true);
        drawPercentageMarker(ctx, adrAxisX, highY, highLabel, markerSide);
      }
    }

    if (todaysLow !== undefined) {
      const lowPercentage = ((midPrice - todaysLow) / adrValue) * 100;
      const lowY = yScale(todaysLow);
      if (isYInBounds(lowY, contentArea)) {
        const lowLabel = `${lowPercentage >= 0 ? '+' : ''}${lowPercentage.toFixed(0)}%`;
        const markerSide = getMarkerSide(false);
        drawPercentageMarker(ctx, adrAxisX, lowY, lowLabel, markerSide);
      }
    }
  }

  // Draw boundary lines
  drawBoundaryLines(ctx, contentArea, adrAxisX, state, yScale);

  ctx.restore();
}

/**
 * Draw individual percentage marker
 */
function drawPercentageMarker(ctx, axisX, y, label, side) {
  const markerLength = 8;
  const labelOffset = 12;

  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(axisX - markerLength, y);
  ctx.lineTo(axisX + markerLength, y);
  ctx.stroke();

  ctx.textAlign = side === 'right' ? 'left' : 'right';
  ctx.fillStyle = '#9CA3AF';
  const textX = side === 'right' ? axisX + labelOffset : axisX - labelOffset;
  ctx.fillText(label, textX, y + 3);
}

/**
 * Draw Price Markers (Open, High, Low, Current)
 */
function drawPriceMarkers(ctx, contentArea, axisX, state, yScale, digits) {
  const { midPrice, currentPrice, todaysHigh, todaysLow } = state;

  ctx.save();
  ctx.translate(0.5, 0.5);

  const dpr = window.devicePixelRatio || 1;
  const fontSize = Math.max(8, Math.round(10 / dpr));
  ctx.font = `${fontSize}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Draw Open Price (always at center)
  if (midPrice !== undefined) {
    const openY = yScale(midPrice);
    drawPriceMarker(ctx, axisX, openY, `O ${formatPrice(midPrice, digits)}`, '#6B7280', 'right');
  }

  // Draw High Price
  if (todaysHigh !== undefined) {
    const highY = yScale(todaysHigh);
    if (isYInBounds(highY, contentArea)) {
      drawPriceMarker(ctx, axisX, highY, `H ${formatPrice(todaysHigh, digits)}`, '#F59E0B', 'right');
    }
  }

  // Draw Low Price
  if (todaysLow !== undefined) {
    const lowY = yScale(todaysLow);
    if (isYInBounds(lowY, contentArea)) {
      drawPriceMarker(ctx, axisX, lowY, `L ${formatPrice(todaysLow, digits)}`, '#F59E0B', 'right');
    }
  }

  // Draw Current Price (emphasized)
  if (currentPrice !== undefined) {
    const currentY = yScale(currentPrice);
    if (isYInBounds(currentY, contentArea)) {
      drawPriceMarker(ctx, axisX, currentY, `C ${formatPrice(currentPrice, digits)}`, '#10B981', 'right');
    }
  }

  ctx.restore();
}

/**
 * Draw individual price marker
 */
function drawPriceMarker(ctx, axisX, y, label, color, side) {
  const markerLength = 12;
  const labelOffset = 15;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(axisX - markerLength, y);
  ctx.lineTo(axisX + markerLength, y);
  ctx.stroke();

  ctx.textAlign = side === 'right' ? 'left' : 'right';
  ctx.fillStyle = color;
  const textX = side === 'right' ? axisX + labelOffset : axisX - labelOffset;
  ctx.fillText(label, textX, y + 3);
}

/**
 * Draw boundary lines at canvas extremes
 */
function drawBoundaryLines(ctx, contentArea, axisX, state, yScale) {
  const { midPrice, projectedAdrHigh, projectedAdrLow } = state;
  const adrValue = projectedAdrHigh - projectedAdrLow;
  if (!midPrice || !adrValue) return;

  const currentMaxAdr = calculateMaxAdrPercentage(state);
  const adrRange = adrValue;

  const highBoundary = midPrice + (adrRange * currentMaxAdr);
  const lowBoundary = midPrice - (adrRange * currentMaxAdr);

  const highY = yScale(highBoundary);
  const lowY = yScale(lowBoundary);

  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 1;

  if (highY >= -10 && highY <= contentArea.height + 10) {
    ctx.beginPath();
    ctx.moveTo(0, highY);
    ctx.lineTo(contentArea.width, highY);
    ctx.stroke();
  }

  if (lowY >= -10 && lowY <= contentArea.height + 10) {
    ctx.beginPath();
    ctx.moveTo(0, lowY);
    ctx.lineTo(contentArea.width, lowY);
    ctx.stroke();
  }
}

/**
 * Calculate maximum ADR percentage needed for current data
 */
function calculateMaxAdrPercentage(state) {
  const { midPrice, todaysHigh, todaysLow, projectedAdrHigh, projectedAdrLow } = state;
  const adrValue = projectedAdrHigh && projectedAdrLow ? projectedAdrHigh - projectedAdrLow : null;

  if (!midPrice || !adrValue || (!todaysHigh && !todaysLow)) {
    return 0.5; // Default to 50% if no data
  }

  let maxPercentage = 0.5;

  if (todaysHigh) {
    const highPercentage = Math.abs(todaysHigh - midPrice) / adrValue;
    maxPercentage = Math.max(maxPercentage, highPercentage);
  }

  if (todaysLow) {
    const lowPercentage = Math.abs(midPrice - todaysLow) / adrValue;
    maxPercentage = Math.max(maxPercentage, lowPercentage);
  }

  // Round up to next 0.25 increment for clean marker spacing
  return Math.ceil(maxPercentage * 4) / 4;
}

/**
 * Check if Y coordinate is within content area bounds
 */
function isYInBounds(y, contentArea) {
  return y >= 0 && y <= contentArea.height;
}

/**
 * Format price using the centralized formatting engine
 */
function formatPrice(price, digits) {
  return formatPriceSimple(price, digits);
}