// Day Range Meter drawing elements - Crystal Clarity Compliant
// Framework-first: Individual drawing functions, <15 lines each

import { COLORS, FONT_SIZES, LINE_WIDTHS } from './colors.js';
import { formatPriceWithPipPosition } from './priceFormat.js';

export function drawAxis(ctx, x, height) {
  ctx.strokeStyle = COLORS.axis;
  ctx.lineWidth = LINE_WIDTHS.axis;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height);
  ctx.stroke();
}

export function drawCenterLine(ctx, width, midPrice, priceScale) {
  const y = priceScale(midPrice);
  ctx.strokeStyle = COLORS.center;
  ctx.lineWidth = LINE_WIDTHS.axis;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function drawBoundaries(ctx, width, adrLow, adrHigh, priceScale) {
  const lowY = priceScale(adrLow);
  const highY = priceScale(adrHigh);

  ctx.strokeStyle = COLORS.boundary;
  ctx.lineWidth = LINE_WIDTHS.boundary;

  // Lower boundary
  ctx.beginPath();
  ctx.moveTo(0, lowY);
  ctx.lineTo(width, lowY);
  ctx.stroke();

  // Upper boundary
  ctx.beginPath();
  ctx.moveTo(0, highY);
  ctx.lineTo(width, highY);
  ctx.stroke();
}

export function drawPriceMarkers(ctx, axisX, data, midPrice, priceScale, symbolData) {
  const prices = createPriceArray(midPrice, data);
  ctx.font = `${FONT_SIZES.price}px monospace`;

  prices.forEach(item => {
    renderPriceMarker(ctx, item, axisX, priceScale, symbolData);
  });
}

// Create array of price data for rendering
function createPriceArray(midPrice, data) {
  return [
    { label: 'O', price: midPrice, color: COLORS.center },
    { label: 'H', price: data.todayHigh, color: COLORS.highLow },
    { label: 'L', price: data.todayLow, color: COLORS.highLow },
    { label: 'C', price: data.current, color: COLORS.current }
  ];
}

// Render individual price marker
function renderPriceMarker(ctx, item, axisX, priceScale, symbolData) {
  if (!item.price || !isFinite(item.price)) return;

  const y = priceScale(item.price);
  const formattedPrice = formatPriceWithPipPosition(item.price, symbolData.pipPosition);
  const label = `${item.label} ${formattedPrice}`;
  drawPriceMarker(ctx, axisX, y, label, item.color);
}

export function drawPriceMarker(ctx, x, y, label, color) {
  // Draw marker line
  ctx.strokeStyle = color;
  ctx.lineWidth = LINE_WIDTHS.priceMarker;
  ctx.beginPath();
  ctx.moveTo(x - 12, y);
  ctx.lineTo(x + 12, y);
  ctx.stroke();

  // Draw label
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 15, y);
}