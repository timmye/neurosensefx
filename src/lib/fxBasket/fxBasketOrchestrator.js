// FX Basket Orchestrator - Crystal Clarity Compliant
// Framework-first: Main FX basket rendering coordination
import { renderPixelPerfectLine } from '../dayRangeCore.js';
import { renderStatusMessage } from '../canvasStatusRenderer.js';
import { getConfig } from './fxBasketConfig.js';

export function renderFxBasket(ctx, basketData, config = {}, dimensions) {
  const { width, height } = dimensions;
  const cfg = getConfig(config);
  ctx.clearRect(0, 0, width, height);
  const hasLiveData = Object.values(basketData).some(b => b.initialized);
  if (!hasLiveData) { renderStatusMessage(ctx, 'Waiting for FX data...', { width, height }); return; }
  const verticalPadding = cfg.positioning.verticalPadding || 20;
  const renderHeight = height - (verticalPadding * 2);
  const initializedBaskets = Object.values(basketData).filter(b => b.initialized);
  const normalizedValues = initializedBaskets.map(b => b.normalized);
  const minVal = Math.min(...normalizedValues);
  const maxVal = Math.max(...normalizedValues);
  const centerValue = 100;
  const maxUpwardMovement = Math.max(maxVal - centerValue, 0);
  const maxDownwardMovement = Math.max(centerValue - minVal, 0);
  const maxMovement = Math.max(maxUpwardMovement, maxDownwardMovement);
  let rangeExpansion = maxMovement <= 0.01 ? 0.02 : maxMovement <= 0.02 ? 0.03 : maxMovement * 1.1;
  const rangeMin = centerValue - rangeExpansion;
  const rangeMax = centerValue + rangeExpansion;
  const baselineY = verticalPadding + renderHeight / 2;
  renderBaseline(ctx, baselineY, width, cfg);
  Object.entries(basketData).forEach(([currency, basket]) => {
    let y = mapBasketToY(basket.normalized, renderHeight, rangeMin, rangeMax, verticalPadding);
    y = Math.max(verticalPadding, Math.min(height - verticalPadding, y));
    const isPositive = basket.normalized >= 100;
    renderBasketMarker(ctx, basket, y, width, cfg, isPositive);
    renderBasketLabel(ctx, basket, y, width, cfg);
  });
}

function renderBaseline(ctx, y, width, config) {
  ctx.save();
  ctx.strokeStyle = config.colors.baseline;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  renderPixelPerfectLine(ctx, 0, y, width, y);

  // Add "100wt" label on the baseline
  ctx.font = '10px sans-serif';
  ctx.fillStyle = config.colors.baseline;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('100wt', 5, y - 3);
  ctx.restore();
}

function renderBasketMarker(ctx, basket, y, width, config, isPositive) {
  const { padding, markerWidth } = config.positioning;

  // Fixed bar width: 48px centered on axis
  const barWidth = 48;
  const barX = (width / 2) - (barWidth / 2);

  ctx.save();
  ctx.fillStyle = isPositive ? config.colors.positive : config.colors.negative;
  ctx.fillRect(barX, y - markerWidth / 2, barWidth, markerWidth);
  ctx.restore();
}

function renderBasketLabel(ctx, basket, y, width, config) {
  const { padding } = config.positioning;
  ctx.save();
  ctx.font = config.fonts.basketLabel;
  ctx.fillStyle = config.colors.text;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(basket.currency, padding, y);
  ctx.font = config.fonts.basketValue;
  if (!basket.initialized) {
    ctx.textAlign = 'center';
    ctx.fillText('n/n', width / 2, y);
  } else if (Math.abs(basket.normalized - 100) < 0.01) {
    ctx.textAlign = 'right';
    ctx.fillText('100wt', width - padding, y);
  } else {
    ctx.textAlign = 'right';
    const pct = basket.normalized - 100;
    ctx.fillText(`${pct > 0 ? '+' : ''}${Math.round(pct)}%`, width - padding, y);
  }
  ctx.restore();
}

function mapBasketToY(normalizedValue, renderHeight, fixedMin, fixedMax, verticalPadding) {
  const range = fixedMax - fixedMin;
  const position = (normalizedValue - fixedMin) / range;
  return verticalPadding + renderHeight - (position * renderHeight);
}
