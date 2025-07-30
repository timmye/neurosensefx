function formatPrice(price, digits) {
  // No longer need to divide by 100000 here, as the price is now correct
  // from the data worker.
  if (price === undefined || price === null) return null;

  const priceStr = price.toFixed(digits);
  const parts = priceStr.split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1] || '';

  let bigFigure = integerPart;
  let pips = '';
  let pipette = '';

  if (digits === 5) {
    bigFigure += '.' + decimalPart.substring(0, 2);
    pips = decimalPart.substring(2, 4);
    pipette = decimalPart.substring(4, 5);
  } else if (digits === 3) {
    bigFigure += '.';
    pips = decimalPart.substring(0, 2);
    pipette = decimalPart.substring(2, 3);
  } else if (digits > 0) {
    bigFigure += '.';
    pips = decimalPart;
    pipette = '';
  }

  return { bigFigure, pips, pipette };
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
  
  // The y-scale is now consistent with the price format.
  const currentPriceY = y(currentPrice); 

  if (currentPrice === undefined || currentPrice === null || isNaN(currentPriceY)) return;

  // The formatPrice function now receives the correct decimal price.
  const formattedPrice = formatPrice(currentPrice, digits);
  if (!formattedPrice) return;

  ctx.textBaseline = 'middle';

  const bigFigureSize = priceFontSize * bigFigureFontSizeRatio;
  const pipsSize = priceFontSize * pipFontSizeRatio;
  const pipetteSize = priceFontSize * pipetteFontSizeRatio;

  let currentX = priceHorizontalOffset;

  const textColor = priceUseStaticColor
    ? priceStaticColor
    : lastTickDirection === 'up' ? priceUpColor : priceDownColor;
  ctx.fillStyle = textColor;

  ctx.textAlign = 'left';
  ctx.font = `${priceFontWeight} ${bigFigureSize}px monospace`;
  ctx.fillText(formattedPrice.bigFigure, currentX, currentPriceY);
  currentX += ctx.measureText(formattedPrice.bigFigure).width;

  if (formattedPrice.pips) {
    ctx.font = `${priceFontWeight} ${pipsSize}px monospace`;
    ctx.fillText(formattedPrice.pips, currentX, currentPriceY);
    currentX += ctx.measureText(formattedPrice.pips).width;
  }

  if (showPipetteDigit && formattedPrice.pipette) {
    ctx.font = `${priceFontWeight} ${pipetteSize}px monospace`;
    ctx.fillText(formattedPrice.pipette, currentX, currentPriceY);
  }
}
