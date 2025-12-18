// Percentage markers for Day Range Meter - Crystal Clarity Compliant
// Framework-first: Individual percentage marker functions

import { COLORS, FONT_SIZES, LINE_WIDTHS } from './colors.js';

export function drawPercentageMarkers(ctx, axisX, midPrice, adrValue, priceScale) {
  ctx.font = `${FONT_SIZES.percent}px monospace`;

  drawPositivePercentages(ctx, axisX, midPrice, adrValue, priceScale);
  drawNegativePercentages(ctx, axisX, midPrice, adrValue, priceScale);
}

function drawPositivePercentages(ctx, axisX, midPrice, adrValue, priceScale) {
  const percentages = [25, 50, 75, 100];

  percentages.forEach(pct => {
    const price = midPrice + (adrValue * pct / 100);
    const y = priceScale(price);

    if (y >= 0 && y <= ctx.canvas.clientHeight) {
      drawSinglePercentageMarker(ctx, axisX, y, `${pct}%`);
    }
  });
}

function drawNegativePercentages(ctx, axisX, midPrice, adrValue, priceScale) {
  const percentages = [25, 50, 75, 100];

  percentages.forEach(pct => {
    const price = midPrice - (adrValue * pct / 100);
    const y = priceScale(price);

    if (y >= 0 && y <= ctx.canvas.clientHeight) {
      drawSinglePercentageMarker(ctx, axisX, y, `-${pct}%`);
    }
  });
}

function drawSinglePercentageMarker(ctx, axisX, y, label) {
  // Draw marker line
  ctx.strokeStyle = COLORS.percentMarker;
  ctx.lineWidth = LINE_WIDTHS.percentMarker;
  ctx.beginPath();
  ctx.moveTo(axisX - 8, y);
  ctx.lineTo(axisX + 8, y);
  ctx.stroke();

  // Draw label
  ctx.fillStyle = COLORS.percentLabel;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, axisX - 12, y);
}