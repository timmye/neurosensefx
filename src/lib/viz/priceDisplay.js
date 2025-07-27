function formatPrice(price) {
  const priceStr = price.toFixed(5);
  const parts = priceStr.split('.');
  return {
    bigFigure: `${parts[0]}.${parts[1].substring(0, 2)}`,
    pips: parts[1].substring(2, 4),
    pipette: parts[1].substring(4, 5),
  };
}

export function drawPriceDisplay(ctx, config, state, y, width) {
  const {
    priceHorizontalOffset,
    priceFontSize,
    bigFigureFontSizeRatio,
    pipFontSizeRatio,
    pipetteFontSizeRatio,
    showPipetteDigit,
    priceFontWeight,
  } = config;

  const currentPriceY = y(state.currentPrice);
  const { bigFigure, pips, pipette } = formatPrice(state.currentPrice);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const bigFigureSize = priceFontSize * bigFigureFontSizeRatio;
  const pipsSize = priceFontSize * pipFontSizeRatio;
  const pipetteSize = priceFontSize * pipetteFontSizeRatio;

  let currentX = priceHorizontalOffset;

  // Draw Big Figure
  ctx.font = `${priceFontWeight} ${bigFigureSize}px monospace`;
  ctx.fillStyle = '#E5E7EB'; // Gray-200
  ctx.fillText(bigFigure, currentX, currentPriceY);
  currentX += ctx.measureText(bigFigure).width;

  // Draw Pips
  ctx.font = `${priceFontWeight} ${pipsSize}px monospace`;
  ctx.fillStyle = '#E5E7EB'; // Gray-200
  ctx.fillText(pips, currentX, currentPriceY);
  currentX += ctx.measureText(pips).width;

  // Draw Pipette if enabled
  if (showPipetteDigit) {
    ctx.font = `${priceFontWeight} ${pipetteSize}px monospace`;
    ctx.fillStyle = '#E5E7EB'; // Gray-200
    ctx.fillText(pipette, currentX, currentPriceY);
  }
}
