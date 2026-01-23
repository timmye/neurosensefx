// Market Profile Rendering - Crystal Clarity Compliant
// Framework-first: Canvas 2D API for all drawing operations

import { renderPixelPerfectLine } from '../dayRangeCore.js';
import { getIntensityColor } from './calculations.js';

export function drawBackground(ctx, startX, width, height) {
  ctx.fillStyle = 'rgba(74, 158, 255, 0.1)';
  ctx.fillRect(startX, 0, width, height);
}

export function drawValueArea(ctx, valueArea, priceScale, startX, width) {
  if (!valueArea.high || !valueArea.low) return;

  const vaY = priceScale(valueArea.high);
  const vaHeight = priceScale(valueArea.low) - priceScale(valueArea.high);

  ctx.fillStyle = 'rgba(74, 158, 255, 0.1)';
  ctx.fillRect(startX, vaY, width, vaHeight);
}

export function drawBars(ctx, data, priceScale, tpoScale, startX) {
  const maxTpo = Math.max(...data.map(d => d.tpo));

  data.forEach((level) => {
    const intensity = level.tpo / maxTpo;
    const x = startX;
    const y = priceScale(level.price);
    const barWidth = Math.max(level.tpo * tpoScale, 1);
    const color = getIntensityColor(getIntensityLevel(intensity));

    ctx.fillStyle = color;
    ctx.fillRect(x, y, barWidth, 2);
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
