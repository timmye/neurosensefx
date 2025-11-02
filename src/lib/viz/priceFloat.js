import { interpolate } from 'd3-interpolate';
import { easeCubicOut } from 'd3-ease';

// This map will store last known price for each symbol to enable smooth animation.
const lastKnownPrices = new Map();
const animationState = new Map();

export function drawPriceFloat(ctx, renderingContext, config, state, y) {
  if (!state || !renderingContext) return;

  // 🔧 CLEAN FOUNDATION: Use rendering context instead of legacy config
  const { contentArea, adrAxisX } = renderingContext;
  
  // Extract configuration parameters (now content-relative)
  const {
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

  // 🔧 CLEAN FOUNDATION: Use ADR axis position from rendering context
  const axisX = adrAxisX;

  const color = priceFloatUseDirectionalColor
    ? (state.lastTickDirection === 'up' ? priceFloatUpColor : (state.lastTickDirection === 'down' ? priceFloatDownColor : priceFloatColor))
    : priceFloatColor;
  
  // Add glow effect
  ctx.shadowColor = priceFloatGlowColor || color;
  ctx.shadowBlur = priceFloatGlowStrength || 12;
  
  // 🔧 CLEAN FOUNDATION: Use content-relative positioning
  // Convert percentage values to actual pixels
  const floatWidth = contentArea.width * priceFloatWidth;
  const floatHeight = contentArea.height * priceFloatHeight;
  const startX = axisX - (floatWidth / 2);
  
  // Draw the price float line
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = floatHeight;
  ctx.moveTo(startX, animatedPriceY);
  ctx.lineTo(startX + floatWidth, animatedPriceY);
  ctx.stroke();
  
  // Reset shadow for subsequent drawing operations
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}
