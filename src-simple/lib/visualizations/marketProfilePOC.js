// Market Profile Point of Control Rendering - Crystal Clarity Compliant
// POC marker and label rendering functions

/**
 * Render Point of Control (POC) marker
 */
export function renderPointOfControl(ctx, levels, priceScale, cfg) {
  const pocLevel = findPOC(levels);
  if (!pocLevel) return;

  const y = priceScale(pocLevel.price);
  const { markerX } = calculatePOCPosition(pocLevel, levels, priceScale, cfg);

  drawPOCMarker(ctx, markerX, y, cfg);
  drawPOCLabel(ctx, markerX, y, pocLevel, cfg);
}

/**
 * Find Point of Control (highest volume level)
 */
function findPOC(levels) {
  return levels.reduce((max, level) =>
    level.volume > max.volume ? level : max
  , levels[0]);
}

/**
 * Calculate POC marker position
 */
function calculatePOCPosition(pocLevel, levels, priceScale, cfg) {
  const maxVolume = Math.max(...levels.map(level => level.volume));
  const barWidth = Math.max(cfg.minBarWidth, (pocLevel.volume / maxVolume) * cfg.maxBarWidth);

  let markerX;
  switch (cfg.positioning) {
    case 'left':
      markerX = cfg.axisX - barWidth - 10;
      break;
    case 'right':
      markerX = cfg.axisX + barWidth + 10;
      break;
    case 'separate':
    default:
      markerX = pocLevel.isPositive ?
        cfg.axisX + barWidth + 10 :
        cfg.axisX - barWidth - 10;
      break;
  }

  return { markerX, barWidth };
}

/**
 * Draw POC marker dot
 */
function drawPOCMarker(ctx, x, y, cfg) {
  ctx.fillStyle = cfg.pocMarkerColor;
  ctx.beginPath();
  ctx.arc(x, y, cfg.pocMarkerSize, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw POC label
 */
function drawPOCLabel(ctx, x, y, pocLevel, cfg) {
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`POC: ${pocLevel.volume}`, x + 15, y);
}