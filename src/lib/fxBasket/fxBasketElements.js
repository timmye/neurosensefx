// FX Basket Rendering Elements - Crystal Clarity Compliant
// Individual drawing functions for basket display components
// All functions <15 lines, DPR-aware rendering

import { renderPixelPerfectLine } from '../dayRangeCore.js';

export function renderBaseline(ctx, y, width, config) {
  ctx.save();
  ctx.strokeStyle = config.colors.baseline;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  renderPixelPerfectLine(ctx, 0, y, width, y);

  ctx.font = '10px sans-serif';
  ctx.fillStyle = config.colors.baseline;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('100wt', 5, y - 3);
  ctx.restore();
}

export function renderBasketMarker(ctx, basket, y, width, config) {
  const { markerWidth } = config.positioning;
  const barWidth = 48;
  const barX = (width / 2) - (barWidth / 2);
  const isPositive = basket.normalized >= 100;

  ctx.save();
  ctx.fillStyle = isPositive ? config.colors.positive : config.colors.negative;
  ctx.fillRect(barX, y - markerWidth / 2, barWidth, markerWidth);
  ctx.restore();
}

export function renderBasketLabel(ctx, basket, y, width, config) {
  const { padding } = config.positioning;

  ctx.save();
  ctx.font = config.fonts.basketLabel;
  ctx.fillStyle = config.colors.text;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(basket.currency, padding, y);

  ctx.font = config.fonts.basketValue;
  ctx.textAlign = 'right';

  const pct = basket.changePercent;
  ctx.fillText(`${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`, width - padding, y);
  ctx.restore();
}

export function renderWaitingState(ctx, progress, config, dimensions) {
  const { width, height } = dimensions;
  const { received, total } = progress;

  ctx.fillStyle = '#1F2937';
  ctx.fillRect(0, 0, width, height);

  const barWidth = (width - 40) * (received / total);
  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(20, height / 2 - 10, barWidth, 20);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Initializing... (${received}/${total} pairs)`, width / 2, height / 2 - 30);
}

export function renderErrorState(ctx, missingPairs, config, dimensions) {
  const { width, height } = dimensions;
  const centerX = width / 2;
  const centerY = height / 2 - 40;
  const size = 30;

  ctx.fillStyle = '#1F2937';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(centerX - size, centerY - size);
  ctx.lineTo(centerX + size, centerY + size);
  ctx.moveTo(centerX + size, centerY - size);
  ctx.lineTo(centerX - size, centerY + size);
  ctx.stroke();

  ctx.fillStyle = '#EF4444';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`Unable to initialize - missing ${missingPairs.length} pairs`, centerX, centerY + 50);

  ctx.fillStyle = '#9CA3AF';
  ctx.font = '12px monospace';
  const pairsText = missingPairs.slice(0, 8).join(', ');
  ctx.fillText(pairsText, centerX, centerY + 75);

  if (missingPairs.length > 8) {
    ctx.fillText(`...and ${missingPairs.length - 8} more`, centerX, centerY + 95);
  }

  ctx.fillStyle = '#3B82F6';
  ctx.fillRect(centerX - 50, centerY + 120, 100, 30);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '14px monospace';
  ctx.fillText('Retry', centerX, centerY + 135);
}
