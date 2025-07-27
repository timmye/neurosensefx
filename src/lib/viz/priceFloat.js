export function drawPriceFloat(ctx, config, state, y) {
  const { priceFloatXOffset, priceFloatWidth, priceFloatHeight } = config;
  const currentPriceY = y(state.currentPrice);

  // Draw the price float line
  ctx.beginPath();
  ctx.strokeStyle = '#A78BFA'; // Violet-400
  ctx.lineWidth = priceFloatHeight;
  ctx.moveTo(priceFloatXOffset, currentPriceY);
  ctx.lineTo(priceFloatXOffset + priceFloatWidth, currentPriceY);
  ctx.stroke();
}
