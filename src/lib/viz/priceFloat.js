export function drawPriceFloat(ctx, config, state, y) {
  const { centralAxisXPosition, priceFloatXOffset, priceFloatWidth, priceFloatHeight } = config;
  const currentPriceY = y(state.currentPrice);

  // Calculate the starting X position to center the float on the axis, then apply the offset
  const centeredX = centralAxisXPosition - (priceFloatWidth / 2);
  const startX = centeredX + priceFloatXOffset;

  // Draw the price float line
  ctx.beginPath();
  ctx.strokeStyle = '#A78BFA'; // Violet-400
  ctx.lineWidth = priceFloatHeight;
  ctx.moveTo(startX, currentPriceY);
  ctx.lineTo(startX + priceFloatWidth, currentPriceY);
  ctx.stroke();
}
