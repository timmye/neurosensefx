/**
 * Formats a given price into its major components for display, based on the number of digits.
 * This function correctly handles various forex and commodity pricing conventions.
 * @param {number} price - The numerical price to format (e.g., 1.12345).
 * @param {number} digits - The total number of decimal places for the symbol.
 * @returns {{bigFigure: string, pips: string, pipette: string}|null}
 */
function formatPrice(price, digits) {
    if (price === undefined || price === null || isNaN(price)) return null;

    // Use toFixed to ensure the price has the correct number of decimal places, preventing floating point issues.
    const priceStr = price.toFixed(digits);
    const parts = priceStr.split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1] || '';

    let bigFigure = integerPart;
    let pips = '';
    let pipette = '';

    // Standard convention for FX pairs (e.g., EURUSD, USDJPY) with 3 or 5 digits.
    // The last digit is the 'pipette', and the two before it are the 'pips'.
    if (digits === 5 || digits === 3) {
        const pipsIndex = digits - 3; // The starting index of the 'pips' part.
        bigFigure += '.' + decimalPart.substring(0, pipsIndex);
        pips = decimalPart.substring(pipsIndex, pipsIndex + 2);
        pipette = decimalPart.substring(pipsIndex + 2);
    } 
    // Convention for indices, commodities, or other instruments (e.g., XAUUSD, WTI).
    // The entire decimal part is considered the 'big figure'.
    else if (digits > 0) {
        bigFigure += '.' + decimalPart;
    }
    // For prices with no decimal places.
    else {
        // bigFigure is already just the integerPart.
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
    priceDownColor,
    showPriceBackground,
    priceDisplayPadding = 4 // Default padding
  } = config;

  const { currentPrice, digits, lastTickDirection, lastTick } = state; 

  const displayPrice = lastTick ? lastTick.bid : currentPrice;
  
  const currentPriceY = y(displayPrice);

  if (displayPrice === undefined || displayPrice === null || isNaN(currentPriceY)) return;

  const formattedPrice = formatPrice(displayPrice, digits);

  if (!formattedPrice) return;

  ctx.textBaseline = 'middle';

  const bigFigureSize = priceFontSize * bigFigureFontSizeRatio;
  const pipsSize = priceFontSize * pipFontSizeRatio;
  const pipetteSize = priceFontSize * pipetteFontSizeRatio;

  // --- Measure text widths and heights for accurate background ---
  ctx.font = `${priceFontWeight} ${bigFigureSize}px monospace`;
  const bigFigureMetrics = ctx.measureText(formattedPrice.bigFigure);
  const bigFigureWidth = bigFigureMetrics.width;
  const textHeight = bigFigureMetrics.actualBoundingBoxAscent + bigFigureMetrics.actualBoundingBoxDescent; // Use actual text height

  let pipsWidth = 0;
  if (formattedPrice.pips) {
    ctx.font = `${priceFontWeight} ${pipsSize}px monospace`;
    pipsWidth = ctx.measureText(formattedPrice.pips).width;
  }

  let pipetteWidth = 0;
   if (showPipetteDigit && formattedPrice.pipette) {
    ctx.font = `${priceFontWeight} ${pipetteSize}px monospace`;
    pipetteWidth = ctx.measureText(formattedPrice.pipette).width;
  }

  const totalTextWidth = bigFigureWidth + pipsWidth + pipetteWidth;
  const backgroundWidth = totalTextWidth + (priceDisplayPadding * 2);
  // Calculate background height based on actual text height plus padding
  const backgroundHeight = textHeight + (priceDisplayPadding * 2);

  // Calculate background position relative to the text's middle baseline
  const backgroundX = priceHorizontalOffset - priceDisplayPadding;
  const backgroundY = currentPriceY - (textHeight / 2) - priceDisplayPadding; // Position based on text height and padding

  // Draw background if enabled
  if (showPriceBackground) {
    ctx.fillStyle = 'rgba(17, 24, 39, 0.8)'; // Increased opacity slightly for better visibility
    ctx.fillRect(backgroundX, backgroundY, backgroundWidth, backgroundHeight);
  }

  let currentX = priceHorizontalOffset;

  const textColor = priceUseStaticColor
    ? priceStaticColor
    : lastTickDirection === 'up' ? priceUpColor : priceDownColor;
  ctx.fillStyle = textColor;

  ctx.textAlign = 'left';
  
  // Draw text components
  ctx.font = `${priceFontWeight} ${bigFigureSize}px monospace`;
  ctx.fillText(formattedPrice.bigFigure, currentX, currentPriceY);
  currentX += bigFigureWidth; // Use measured width

  if (formattedPrice.pips) {
    ctx.font = `${priceFontWeight} ${pipsSize}px monospace`;
    ctx.fillText(formattedPrice.pips, currentX, currentPriceY);
    currentX += pipsWidth; // Use measured width
  }

  if (showPipetteDigit && formattedPrice.pipette) {
    ctx.font = `${priceFontWeight} ${pipetteSize}px monospace`;
    ctx.fillText(formattedPrice.pipette, currentX, currentPriceY);
  }
}
