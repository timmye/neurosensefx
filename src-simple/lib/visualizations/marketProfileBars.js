// Market Profile Bar Rendering - Crystal Clarity Compliant
// Volume distribution bar rendering functions

/**
 * Render volume distribution bars
 */
export function renderVolumeBars(ctx, levels, priceScale, cfg) {
  const maxVolume = Math.max(...levels.map(level => level.volume));

  levels.forEach(level => {
    const y = priceScale(level.price);
    const barWidth = calculateBarWidth(level.volume, maxVolume, cfg);
    const { x, color } = getBarPosition(level, barWidth, cfg);

    drawBar(ctx, x, y, barWidth, color, cfg);
    drawOutline(ctx, x, y, barWidth, cfg);
  });

  ctx.globalAlpha = 1.0;
}

/**
 * Calculate bar width based on volume
 */
function calculateBarWidth(volume, maxVolume, cfg) {
  return Math.max(cfg.minBarWidth, (volume / maxVolume) * cfg.maxBarWidth);
}

/**
 * Get bar position and color based on configuration
 */
function getBarPosition(level, barWidth, cfg) {
  let x, color;

  switch (cfg.positioning) {
    case 'left':
      x = cfg.axisX - barWidth;
      color = cfg.barColor;
      break;
    case 'right':
      x = cfg.axisX;
      color = cfg.barColor;
      break;
    case 'separate':
    default:
      if (level.isPositive) {
        x = cfg.axisX;
        color = cfg.barColor;
      } else {
        x = cfg.axisX - barWidth;
        color = cfg.sellColor;
      }
      break;
  }

  return { x, color };
}

/**
 * Draw a single bar
 */
function drawBar(ctx, x, y, width, color, cfg) {
  ctx.globalAlpha = cfg.opacity;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, 1);
}

/**
 * Draw bar outline
 */
function drawOutline(ctx, x, y, width, cfg) {
  ctx.strokeStyle = cfg.outlineColor;
  ctx.lineWidth = cfg.outlineWidth;
  ctx.strokeRect(x, y, width, 1);
}