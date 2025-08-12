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
  const startX = centralAxisXPosition - (priceFloatWidth / 2);

  // Initialize if this is the first time we see this symbol
  if (!lastKnownPrices.has(symbol)) {
    lastKnownPrices.set(symbol, targetPriceY);
    animationState.set(symbol, {
      startTime: null,
      startPrice: targetPriceY,
      interpolator: null,
      duration: 300 // ms
    });
  }

  const anim = animationState.get(symbol);
  const lastPriceY = lastKnownPrices.get(symbol);

  // If the price has changed, start a new animation
  if (targetPriceY !== lastPriceY) {
    anim.startTime = performance.now();
    anim.startPrice = lastPriceY;
    anim.interpolator = interpolate(lastPriceY, targetPriceY);
    lastKnownPrices.set(symbol, targetPriceY);
  }

  let animatedPriceY = targetPriceY;

  // If an animation is in progress
  if (anim.startTime) {
    const elapsed = performance.now() - anim.startTime;
    const t = Math.min(1, elapsed / anim.duration);
    const easedT = easeCubicOut(t);
    animatedPriceY = anim.interpolator(easedT);

    if (t >= 1) {
      anim.startTime = null; // Animation finished
    }
  }

  const color = priceFloatUseDirectionalColor
    ? (state.lastTickDirection === 'up' ? priceFloatUpColor : (state.lastTickDirection === 'down' ? priceFloatDownColor : priceFloatColor))
    : priceFloatColor;
  
  // Add the glow effect
  ctx.shadowColor = priceFloatGlowColor || color;
  ctx.shadowBlur = priceFloatGlowStrength || 12;
  
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
