// Market Profile Rendering - Crystal Clarity Compliant
// Framework-first: Canvas 2D API for all drawing operations

import { renderPixelPerfectLine } from '../dayRangeCore.js';
import { getIntensityColor } from './calculations.js';

export function drawValueArea(ctx, valueArea, priceScale, startX, width) {
  if (!valueArea.high || !valueArea.low) return;

  const vaY = priceScale(valueArea.high);
  const vaHeight = priceScale(valueArea.low) - priceScale(valueArea.high);

  ctx.fillStyle = 'rgba(74, 158, 255, 0.1)';
  ctx.fillRect(startX, vaY, width, vaHeight);
}

export function drawBars(ctx, data, priceScale, tpoScale, startX, maxTpo, barHeight = 2) {
  data.forEach((level) => {
    const intensity = level.tpo / maxTpo;
    const x = startX;
    const y = priceScale(level.price);
    const barWidth = Math.max(level.tpo * tpoScale, 1);
    const color = getIntensityColor(getIntensityLevel(intensity));

    ctx.fillStyle = color;
    ctx.fillRect(x, y, barWidth, barHeight);
  });
}

function getIntensityLevel(intensity) {
  if (intensity <= 0.6) return 'low';
  if (intensity <= 0.8) return 'medium';
  return 'high';
}

export function drawPOC(ctx, poc, priceScale, startX, width) {
  if (!poc) return;

  const pocY = priceScale(poc.price);

  ctx.save();
  ctx.strokeStyle = '#ff8c4a';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 3]);
  renderPixelPerfectLine(ctx, startX, pocY, width, pocY);
  ctx.setLineDash([]);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Mini Market Profile rendering (37.5px wide, for PriceTicker component)
// ---------------------------------------------------------------------------

/**
 * Draw mini profile bars with DPR-aware bar height derived from price scale.
 */
export function drawMiniBars(ctx, profile, priceScale, maxTpo, width, height, dpr) {
  const adaptiveScale = {
    min: profile.reduce((min, l) => l.price < min ? l.price : min, Infinity),
    max: profile.reduce((max, l) => l.price > max ? l.price : max, -Infinity),
    range: 0,
  };
  adaptiveScale.range = adaptiveScale.max - adaptiveScale.min || 1;

  const gap = 1 / dpr;

  profile.forEach((level) => {
    const y = Math.round(priceScale(level.price));
    const barWidth = (level.tpo / maxTpo) * (width - 2);
    const intensity = level.tpo / maxTpo;
    ctx.fillStyle = `rgba(0, 210, 255, ${0.2 + (intensity * 0.4)})`;

    const nextPriceY = Math.round(priceScale(level.price + (adaptiveScale.range / profile.length)));
    const barHeight = Math.max(1, Math.abs(nextPriceY - y) - gap);

    ctx.fillRect(0, y, barWidth, barHeight);
  });
}

/**
 * Draw current price marker (neon orange line + dot), clamped to visible range.
 */
export function drawMiniCurrentPrice(ctx, priceScale, currentPrice, minPrice, maxPrice, width) {
  if (currentPrice == null) return;
  const clampedPrice = Math.max(minPrice, Math.min(maxPrice, currentPrice));
  const y = Math.round(priceScale(clampedPrice));

  ctx.save();
  ctx.strokeStyle = '#FF6600';
  ctx.lineWidth = 1.5;
  renderPixelPerfectLine(ctx, 0, y, width - 4, y);
  ctx.restore();

  ctx.fillStyle = '#FF6600';
  ctx.beginPath();
  ctx.arc(Math.round(width - 4), y, 2, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw open price marker (orange dot on left edge).
 */
export function drawMiniOpenPrice(ctx, priceScale, openPrice, minPrice, maxPrice, height) {
  if (openPrice == null) return;
  const y = (openPrice >= minPrice && openPrice <= maxPrice)
    ? Math.round(priceScale(openPrice))
    : Math.round(height / 2);

  ctx.fillStyle = '#FF8800';
  ctx.beginPath();
  ctx.arc(2, y, 2, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw TWAP price marker (green dot).
 */
export function drawMiniTwapPrice(ctx, priceScale, twapPrice, minPrice, maxPrice) {
  if (twapPrice == null || twapPrice < minPrice || twapPrice > maxPrice) return;
  const y = Math.round(priceScale(twapPrice));

  ctx.fillStyle = '#00FF66';
  ctx.beginPath();
  ctx.arc(5, y, 2, 0, Math.PI * 2);
  ctx.fill();
}
