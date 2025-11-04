import { scaleLinear } from 'd3-scale';

/**
 * Simple Day Range Meter Implementation
 * 
 * Radical simplification - replaces complex legacy code with minimal, working approach
 * Just 3 core functions:
 * 1. Draw vertical ADR axis at movable position
 * 2. Draw basic price markers (Open, High, Low, Current)
 * 3. Display ADR percentage
 * 
 * FIXED: Proper canvas scaling and responsive behavior
 */

export function drawDayRangeMeterSimple(ctx, canvas, config, state, y) {
  // Use proper canvas dimensions - handle DPR and actual canvas size
  const canvasWidth = canvas.width || canvas.clientWidth || 240;
  const canvasHeight = canvas.height || canvas.clientHeight || 120;
  
  // 1. Draw vertical ADR axis at movable position
  drawVerticalLine(ctx, canvasWidth, canvasHeight, config.adrAxisX || 0.65);
  
  // 2. Draw price markers
  drawPriceMarkers(ctx, canvasWidth, canvasHeight, config, state, y);
  
  // 3. Draw ADR percentage
  drawAdrPercentage(ctx, canvasWidth, canvasHeight, state);
}

/**
 * Draw vertical ADR axis line at movable position
 * adrAxisX: 0-1 percentage across canvas width
 */
function drawVerticalLine(ctx, canvasWidth, canvasHeight, adrAxisX) {
  const axisX = canvasWidth * adrAxisX;
  
  ctx.strokeStyle = '#4B5563';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(axisX, 0);
  ctx.lineTo(axisX, canvasHeight);
  ctx.stroke();
}

/**
 * Draw basic price markers (Open, High, Low, Current)
 * No close price - as clarified by user
 */
function drawPriceMarkers(ctx, canvasWidth, canvasHeight, config, state, y) {
  if (!y || !state) return;
  
  const axisX = canvasWidth * (config.adrAxisX || 0.65);
  const markerLength = 10;
  const labelOffset = 15;
  
  // Set font for labels
  ctx.font = '10px Arial';
  ctx.fillStyle = '#D1D5DB';
  
  // Draw Open Price
  if (state.dailyOpen !== undefined) {
    const openY = y(state.dailyOpen);
    if (isInBounds(openY, canvasHeight)) {
      drawPriceMarker(ctx, axisX, openY, markerLength, '#6B7280');
      drawLabel(ctx, axisX, openY, `O ${formatPrice(state.dailyOpen, state.digits)}`, labelOffset, 'left');
    }
  }
  
  // Draw High Price
  if (state.todaysHigh !== undefined) {
    const highY = y(state.todaysHigh);
    if (isInBounds(highY, canvasHeight)) {
      drawPriceMarker(ctx, axisX, highY, markerLength, '#F59E0B');
      drawLabel(ctx, axisX, highY, `H ${formatPrice(state.todaysHigh, state.digits)}`, labelOffset, 'left');
    }
  }
  
  // Draw Low Price
  if (state.todaysLow !== undefined) {
    const lowY = y(state.todaysLow);
    if (isInBounds(lowY, canvasHeight)) {
      drawPriceMarker(ctx, axisX, lowY, markerLength, '#F59E0B');
      drawLabel(ctx, axisX, lowY, `L ${formatPrice(state.todaysLow, state.digits)}`, labelOffset, 'left');
    }
  }
  
  // Draw Current Price
  if (state.currentPrice !== undefined) {
    const currentY = y(state.currentPrice);
    if (isInBounds(currentY, canvasHeight)) {
      drawPriceMarker(ctx, axisX, currentY, markerLength, '#10B981');
      drawLabel(ctx, axisX, currentY, `C ${formatPrice(state.currentPrice, state.digits)}`, labelOffset, 'right');
    }
  }
}

/**
 * Draw ADR percentage display
 */
function drawAdrPercentage(ctx, canvasWidth, canvasHeight, state) {
  if (!state.dailyOpen || !state.adrValue || !state.currentPrice) return;
  
  // Calculate ADR percentage
  const adrPercentage = ((state.currentPrice - state.dailyOpen) / state.adrValue) * 100;
  const sign = adrPercentage >= 0 ? '+' : '';
  const labelText = `ADR: ${sign}${adrPercentage.toFixed(1)}%`;
  
  // Display at top center of canvas
  ctx.fillStyle = '#3B82F6';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(labelText, canvasWidth / 2, 20);
}

/**
 * Helper: Draw price marker line
 */
function drawPriceMarker(ctx, axisX, priceY, markerLength, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(axisX - markerLength, priceY);
  ctx.lineTo(axisX + markerLength, priceY);
  ctx.stroke();
}

/**
 * Helper: Draw price label
 */
function drawLabel(ctx, axisX, priceY, labelText, labelOffset, side) {
  const textAlign = side === 'right' ? 'left' : 'right';
  const textX = side === 'right' ? axisX + labelOffset : axisX - labelOffset;
  
  ctx.fillStyle = '#D1D5DB';
  ctx.textAlign = textAlign;
  ctx.fillText(labelText, textX, priceY + 3);
}

/**
 * Helper: Format price with proper digits
 */
function formatPrice(price, digits) {
  if (price === undefined || price === null || isNaN(price)) return 'N/A';
  return price.toFixed(digits || 5);
}

/**
 * Helper: Check if Y coordinate is within canvas bounds
 */
function isInBounds(y, canvasHeight) {
  return y >= 0 && y <= canvasHeight;
}
