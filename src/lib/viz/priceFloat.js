import { interpolate } from 'd3-interpolate';
import { easeCubicOut } from 'd3-ease';

// This map will store the last known price for each symbol to enable smooth animation.
const lastKnownPrices = new Map();
const animationState = new Map();

export function drawPriceFloat(ctx, config, state, y) {
  if (!state || !config) return;

  const {
    visualizationsContentWidth,
    centralAxisXPosition,
    priceFloatWidth,
    priceFloatHeight,
    priceFloatUseDirectionalColor,
    priceFloatColor,
    priceFloatUpColor,
    priceFloatDownColor,
    priceFloatGlowColor,
    priceFloatGlowStrength
  } = config;

  const symbol = state.symbol; // Assuming state has a unique symbol identifier
  const targetPriceY = y(state.currentPrice);
  let animatedPriceY = targetPriceY;

  const color = priceFloatUseDirectionalColor
    ? (state.lastTickDirection === 'up' ? priceFloatUpColor : (state.lastTickDirection === 'down' ? priceFloatDownColor : priceFloatColor))
    : priceFloatColor;
  
  // Add the glow effect
  ctx.shadowColor = priceFloatGlowColor || color;
  ctx.shadowBlur = priceFloatGlowStrength || 12;
  const startX = centralAxisXPosition - (priceFloatWidth / 2);
  
  // Draw the price float line
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = priceFloatHeight;
  ctx.moveTo(startX, animatedPriceY);
  ctx.lineTo(startX + priceFloatWidth, animatedPriceY);
  ctx.stroke();
  
  // Reset shadow for subsequent drawing operations
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}
