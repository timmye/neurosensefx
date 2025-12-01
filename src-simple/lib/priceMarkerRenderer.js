// Day Range Price Marker Renderer - Crystal Clarity Compliant
// Framework-first: Current, open, and H/L price markers with Canvas 2D

import { setupTextRendering } from './dayRangeCore.js';
import { formatPrice } from './priceFormat.js';

// Render current price marker with color coding
export function renderCurrentPrice(ctx, config, axisX, priceScale, price) {
  if (!price) return;

  ctx.save();
  setupTextRendering(ctx, config.fonts.priceLabels, 'middle', 'center');
  ctx.fillStyle = config.colors.currentPrice;

  const label = `C ${formatPrice(price)}`;
  const currentY = priceScale(price);
  ctx.fillText(label, axisX, currentY);
  ctx.restore();
}

// Render open price marker with color coding
export function renderOpenPrice(ctx, config, axisX, priceScale, price) {
  if (!price) return;

  ctx.save();
  setupTextRendering(ctx, config.fonts.priceLabels, 'middle', 'center');
  ctx.fillStyle = config.colors.openPrice;

  const label = `O ${formatPrice(price)}`;
  const openY = priceScale(price);
  ctx.fillText(label, axisX, openY);
  ctx.restore();
}

// Render today's high and low price markers
export function renderHighLowMarkers(ctx, config, axisX, priceScale, mappedData) {
  ctx.save();
  ctx.fillStyle = config.colors.sessionPrices;
  ctx.font = config.fonts.priceLabels;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  renderHighMarker(ctx, axisX, priceScale, mappedData.todayHigh);
  renderLowMarker(ctx, axisX, priceScale, mappedData.todayLow);

  ctx.restore();
}

// Render high price marker
function renderHighMarker(ctx, axisX, priceScale, todayHigh) {
  if (!todayHigh) return;

  const highY = priceScale(todayHigh);
  const highLabel = `H ${formatPrice(todayHigh)}`;
  ctx.fillText(highLabel, axisX, highY);
}

// Render low price marker
function renderLowMarker(ctx, axisX, priceScale, todayLow) {
  if (!todayLow) return;

  const lowY = priceScale(todayLow);
  const lowLabel = `L ${formatPrice(todayLow)}`;
  ctx.fillText(lowLabel, axisX, lowY);
}