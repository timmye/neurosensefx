// State for animation
let animatedPriceY = -1;

export function drawPriceFloat(ctx, config, state, y) {
  const { 
    centralAxisXPosition, 
    priceFloatXOffset, 
    priceFloatWidth, 
    priceFloatHeight, 
    priceFloatUseDirectionalColor,
    priceFloatUpColor,
    priceFloatDownColor
  } = config;
  
  const targetPriceY = y(state.currentPrice);

  // Initialize animatedPriceY on the first run
  if (animatedPriceY === -1) {
    animatedPriceY = targetPriceY;
  }
  
  // Perform a single step of easing animation with each data update.
  // This is performant as it only calculates during a redraw.
  const easingFactor = 0.25; // A slightly faster easing for a responsive feel
  const diff = targetPriceY - animatedPriceY;
  animatedPriceY += diff * easingFactor;

  const centeredX = centralAxisXPosition - (priceFloatWidth / 2);
  const startX = centeredX + priceFloatXOffset;

  const color = priceFloatUseDirectionalColor
    ? (state.lastTickDirection === 'up' ? priceFloatUpColor : '#A78BFA')
    : '#A78BFA';

  // Add the glow effect
  ctx.shadowColor = 'rgba(167, 139, 250, 0.6)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 0;

  // Draw the price float line
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = priceFloatHeight;
  ctx.moveTo(startX, animatedPriceY);
  ctx.lineTo(startX + priceFloatWidth, animatedPriceY);
  ctx.stroke();

  // Reset shadow for subsequent drawing operations
  ctx.shadowBlur = 0;
}
