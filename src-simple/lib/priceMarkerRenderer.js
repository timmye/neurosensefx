// Day Range Price Marker Renderer - Crystal Clarity Compliant
// Framework-first: Current, open, and H/L price markers with Canvas 2D

import { setupTextRendering } from './dayRangeCore.js';
import { formatPriceWithPipPosition } from './priceFormat.js';

// Render current price marker with color coding
export function renderCurrentPrice(ctx, config, axisX, priceScale, price, symbolData) {
  if (!price) return;

  ctx.save();
  setupTextRendering(ctx, config.fonts.priceLabels, 'middle', 'right');
  ctx.fillStyle = config.colors.currentPrice;

  const formattedPrice = formatPriceWithPipPosition(price, symbolData?.pipPosition, symbolData?.pipSize, symbolData?.pipetteSize);
  const currentY = priceScale(price);

  // Draw horizontal marker line on ADR axis
  const dpr = window.devicePixelRatio || 1;
  const markerLength = 12 / dpr;
  ctx.strokeStyle = config.colors.currentPrice;
  ctx.lineWidth = 2 / dpr;
  ctx.beginPath();
  ctx.moveTo(axisX - markerLength, currentY);
  ctx.lineTo(axisX + markerLength, currentY);
  ctx.stroke();

  ctx.fillText(formattedPrice, axisX - 5, currentY);
  ctx.restore();
}

// Render open price marker with color coding
export function renderOpenPrice(ctx, config, axisX, priceScale, price, symbolData) {
  if (!price) return;

  ctx.save();
  setupTextRendering(ctx, config.fonts.priceLabels, 'middle', 'right');
  ctx.fillStyle = config.colors.openPrice;

  const formattedPrice = formatPriceWithPipPosition(price, symbolData?.pipPosition, symbolData?.pipSize, symbolData?.pipetteSize);
  const openY = priceScale(price);

  // Draw horizontal marker line on ADR axis
  const dpr = window.devicePixelRatio || 1;
  const markerLength = 12 / dpr;
  ctx.strokeStyle = config.colors.openPrice;
  ctx.lineWidth = 2 / dpr;
  ctx.beginPath();
  ctx.moveTo(axisX - markerLength, openY);
  ctx.lineTo(axisX + markerLength, openY);
  ctx.stroke();

  ctx.fillText(formattedPrice, axisX - 5, openY);
  ctx.restore();
}

// Render today's high and low price markers
export function renderHighLowMarkers(ctx, config, axisX, priceScale, mappedData, symbolData) {
  ctx.save();
  ctx.fillStyle = config.colors.sessionPrices;
  ctx.font = config.fonts.priceLabels;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  renderHighMarker(ctx, axisX, priceScale, mappedData.todayHigh, symbolData, config);
  renderLowMarker(ctx, axisX, priceScale, mappedData.todayLow, symbolData, config);

  ctx.restore();
}

// Render high price marker
function renderHighMarker(ctx, axisX, priceScale, todayHigh, symbolData, config) {
  if (!todayHigh) return;

  const highY = priceScale(todayHigh);
  const formattedPrice = formatPriceWithPipPosition(todayHigh, symbolData?.pipPosition, symbolData?.pipSize, symbolData?.pipetteSize);

  // Draw horizontal marker line on ADR axis
  const dpr = window.devicePixelRatio || 1;
  const markerLength = 12 / dpr;
  ctx.strokeStyle = config.colors.sessionPrices;
  ctx.lineWidth = 2 / dpr;
  ctx.beginPath();
  ctx.moveTo(axisX - markerLength, highY);
  ctx.lineTo(axisX + markerLength, highY);
  ctx.stroke();

  ctx.fillText(formattedPrice, axisX - 5, highY);
}

// Render low price marker
function renderLowMarker(ctx, axisX, priceScale, todayLow, symbolData, config) {
  if (!todayLow) return;

  const lowY = priceScale(todayLow);
  const formattedPrice = formatPriceWithPipPosition(todayLow, symbolData?.pipPosition, symbolData?.pipSize, symbolData?.pipetteSize);

  // Draw horizontal marker line on ADR axis
  const dpr = window.devicePixelRatio || 1;
  const markerLength = 12 / dpr;
  ctx.strokeStyle = config.colors.sessionPrices;
  ctx.lineWidth = 2 / dpr;
  ctx.beginPath();
  ctx.moveTo(axisX - markerLength, lowY);
  ctx.lineTo(axisX + markerLength, lowY);
  ctx.stroke();

  ctx.fillText(formattedPrice, axisX - 5, lowY);
}