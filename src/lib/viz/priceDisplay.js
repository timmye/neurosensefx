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
    if (digits === 5 || digits === 3) {
        const pipsIndex = digits - 3;
        bigFigure += '.' + decimalPart.substring(0, pipsIndex);
        pips = decimalPart.substring(pipsIndex, pipsIndex + 2);
        pipette = decimalPart.substring(pipsIndex + 2);
    } 
    // Convention for other instruments.
    else if (digits > 0) {
        bigFigure += '.' + decimalPart;
    }

    return { bigFigure, pips, pipette };
}

/**
 * Safely converts a HEX color to an RGBA string.
 * @param {string} hex - The hex color code (e.g., '#RRGGBB' or '#RGB').
 * @param {number} opacity - The opacity value (0 to 1).
 * @returns {string} The RGBA color string.
 */
function hexToRgba(hex, opacity) {
    if (!hex) return 'rgba(0,0,0,0)'; // Return transparent for invalid hex
    
    const finalOpacity = (opacity === undefined || opacity === null) ? 1 : opacity;

    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex.substring(1, 3), 16);
        g = parseInt(hex.substring(3, 5), 16);
        b = parseInt(hex.substring(5, 7), 16);
    }
    
    return `rgba(${r},${g},${b},${finalOpacity})`;
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
    showPriceBoundingBox,
    priceDisplayPadding = 4,
    // Provide default values to prevent crashes from incomplete config
    priceBackgroundColor = '#111827',
    priceBackgroundOpacity = 0.8,
    priceBoxOutlineColor = '#4B5563',
    priceBoxOutlineOpacity = 1,
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
  const textHeight = bigFigureMetrics.actualBoundingBoxAscent + bigFigureMetrics.actualBoundingBoxDescent;

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
  const backgroundHeight = textHeight + (priceDisplayPadding * 2);

  const backgroundX = priceHorizontalOffset - priceDisplayPadding;
  const backgroundY = currentPriceY - (textHeight / 2) - priceDisplayPadding;

  // Draw background if enabled
  if (showPriceBackground) {
    ctx.fillStyle = hexToRgba(priceBackgroundColor, priceBackgroundOpacity);
    ctx.fillRect(backgroundX, backgroundY, backgroundWidth, backgroundHeight);
  }

  // Draw bounding box if enabled
  if (showPriceBoundingBox) {
    ctx.strokeStyle = hexToRgba(priceBoxOutlineColor, priceBoxOutlineOpacity);
    ctx.lineWidth = 1;
    ctx.strokeRect(backgroundX, backgroundY, backgroundWidth, backgroundHeight);
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
  currentX += bigFigureWidth;

  if (formattedPrice.pips) {
    ctx.font = `${priceFontWeight} ${pipsSize}px monospace`;
    ctx.fillText(formattedPrice.pips, currentX, currentPriceY);
    currentX += pipsWidth;
  }

  if (showPipetteDigit && formattedPrice.pipette) {
    ctx.font = `${priceFontWeight} ${pipetteSize}px monospace`;
    ctx.fillText(formattedPrice.pipette, currentX, currentPriceY);
  }
}
