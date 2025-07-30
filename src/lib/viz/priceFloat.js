export function drawPriceFloat(ctx, config, state, y) {
  const { 
    centralAxisXPosition, 
    priceFloatXOffset, 
    priceFloatWidth, 
    priceFloatHeight, 
    priceFloatColor,
    priceFloatUseDirectionalColor,
    priceFloatUpColor,
    priceFloatDownColor
  } = config;
  const currentPriceY = y(state.currentPrice);

  // Calculate the starting X position to center the float on the axis, then apply the offset
  const centeredX = centralAxisXPosition - (priceFloatWidth / 2);
  const startX = centeredX + priceFloatXOffset;

  const color = priceFloatUseDirectionalColor
    ? (state.lastTickDirection === 'up' ? priceFloatUpColor : priceFloatDownColor)
    : priceFloatColor;

  // Draw the price float line
  ctx.beginPath();
  ctx.strokeStyle = color || '#A78BFA';
  ctx.lineWidth = priceFloatHeight;
  ctx.moveTo(startX, currentPriceY);
  ctx.lineTo(startX + priceFloatWidth, currentPriceY);
  ctx.stroke();
}
