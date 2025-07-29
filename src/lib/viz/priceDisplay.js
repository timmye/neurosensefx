function formatPrice(price, digits) {
  if (price === undefined || price === null) return null; // Handle null or undefined prices

  const priceStr = price.toFixed(digits);
  const parts = priceStr.split('.');

  // Ensure we have enough decimal places for pip/pipette logic
  const decimalPart = parts[1] || '';
  const paddedDecimalPart = decimalPart.padEnd(digits, '0');

  // Define indices based on standard FX (5 digits)
  const pipStartIndex = digits >= 4 ? digits - 2 : digits;
  const pipetteIndex = digits >= 5 ? digits - 1 : digits;

  return {
    integer: parts[0],
    decimal: parts[1] !== undefined ? '.' : '',
    paddedDecimal: paddedDecimalPart,
    bigFigure: parts[0] + (parts[1] !== undefined ? '.' : '') + paddedDecimalPart.substring(0, pipStartIndex),
    pips: paddedDecimalPart.substring(pipStartIndex, pipetteIndex),
    pipette: paddedDecimalPart.substring(pipetteIndex, pipetteIndex + 1),
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
    priceUseStaticColor,
    priceStaticColor,
    priceUpColor,
    priceDownColor
  } = config;

  const { currentPrice, digits, lastTickDirection } = state;
  const currentPriceY = y(currentPrice);

  // Don't draw if current price is not available or outside bounds
  if (currentPrice === undefined || currentPrice === null || currentPriceY < -50 || currentPriceY > config.meterHeight + 50) return;

  const formattedPrice = formatPrice(currentPrice, digits);
  if (!formattedPrice) return; // Don't draw if formatting failed

  ctx.textBaseline = 'middle';

  const bigFigureSize = priceFontSize * bigFigureFontSizeRatio;
  const pipsSize = priceFontSize * pipFontSizeRatio;
  const pipetteSize = priceFontSize * pipetteFontSizeRatio;

  let currentX = priceHorizontalOffset;

  // Determine color based on config and last tick direction
  const textColor = priceUseStaticColor
    ? priceStaticColor
    : state.lastTickDirection === 'up' ? priceUpColor : priceDownColor;
  ctx.fillStyle = textColor;

  // Draw Big Figure
  ctx.textAlign = 'left';
  ctx.font = `${priceFontWeight} ${bigFigureSize}px monospace`;
  ctx.fillText(formattedPrice.bigFigure, currentX, currentPriceY);
  currentX += ctx.measureText(formattedPrice.bigFigure).width;

  // Draw Pips
  ctx.textAlign = 'left';
  ctx.font = `${priceFontWeight} ${pipsSize}px monospace`;
  ctx.fillText(formattedPrice.pips, currentX, currentPriceY);
  currentX += ctx.measureText(formattedPrice.pips).width;

  // Draw Pipette if enabled
  if (showPipetteDigit && digits >= 5) { // Only show pipette if symbol has at least 5 digits
    ctx.textAlign = 'left';
    ctx.font = `${priceFontWeight} ${pipetteSize}px monospace`;
    ctx.fillText(formattedPrice.pipette, currentX, currentPriceY);
  }

  // Note: Bounding box and background drawing is not implemented yet.
}
