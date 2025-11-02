import { scaleLinear } from 'd3-scale';

// Helper function to convert hex to RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

export function drawVolatilityOrb(ctx, renderingContext, config, state, y) {
  if (!renderingContext || !state) return;

  // 🔧 CLEAN FOUNDATION: Use rendering context instead of legacy config
  const { contentArea, adrAxisX } = renderingContext;
  
  // Extract configuration parameters (now content-relative)
  const {
    showVolatilityOrb,
    volatilityColorMode,
    volatilityOrbBaseWidth,
    volatilityOrbInvertBrightness,
    volatilitySizeMultiplier,
    showVolatilityMetric,
    priceFloatHeight,
    priceHorizontalOffset,
    priceFontSize,
    priceUseStaticColor,
    priceStaticColor,
    priceUpColor,
    priceDownColor,
    priceDisplayPadding,
    priceFloatGlowColor,
    priceFloatGlowStrength,
  } = config;

  const { currentPrice, volatility, lastTickDirection } = state; 

  if (!showVolatilityOrb || currentPrice === null || currentPrice === undefined) return;

  // 🔧 CLEAN FOUNDATION: Use ADR axis position from rendering context
  const axisX = adrAxisX;
  
  // 🔧 CLEAN FOUNDATION: Use content-relative positioning
  // Convert percentage values to actual pixels
  const orbBaseWidth = contentArea.width * volatilityOrbBaseWidth;
  const orbRadius = (orbBaseWidth / 2) * (volatility / 100) * volatilitySizeMultiplier;
  const orbY = y(currentPrice);

  // Draw volatility orb
  ctx.save();
  
  let orbColor;
  if (volatilityColorMode === 'directional') {
    orbColor = lastTickDirection === 'up' ? priceUpColor : priceDownColor;
  } else {
    orbColor = priceStaticColor;
  }

  // Apply brightness inversion if configured
  if (volatilityOrbInvertBrightness) {
    const rgb = hexToRgb(orbColor);
    if (rgb) {
      const brightness = (rgb.r + rgb.g + rgb.b) / 3;
      const factor = brightness > 128 ? 0.5 : 2;
      orbColor = `rgb(${Math.min(255, rgb.r * factor)}, ${Math.min(255, rgb.g * factor)}, ${Math.min(255, rgb.b * factor)})`;
    }
  }

  // Create gradient for orb
  const gradient = ctx.createRadialGradient(axisX, orbY, 0, axisX, orbY, orbRadius);
  gradient.addColorStop(0, orbColor);
  gradient.addColorStop(0.7, orbColor + '88'); // Add transparency
  gradient.addColorStop(1, orbColor + '00'); // Fully transparent

  // Draw orb
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(axisX, orbY, orbRadius, 0, 2 * Math.PI);
  ctx.fill();

  // Add glow effect
  ctx.shadowColor = priceFloatGlowColor || orbColor;
  ctx.shadowBlur = priceFloatGlowStrength || 8;
  ctx.strokeStyle = orbColor;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.restore();

  // Draw volatility metric if enabled
  if (showVolatilityMetric) {
    ctx.save();
    
    // 🔧 CLEAN FOUNDATION: Use content-relative positioning
    const fontSize = contentArea.height * priceFontSize;
    const horizontalOffset = contentArea.width * priceHorizontalOffset;
    
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    
    const volatilityText = `σ: ${volatility.toFixed(1)}%`;
    const textMetrics = ctx.measureText(volatilityText);
    const textX = axisX + orbRadius + horizontalOffset;
    const textY = orbY;
    
    // Draw text background if configured
    if (priceDisplayPadding > 0) {
      const padding = priceDisplayPadding;
      const bgX = textX - padding;
      const bgY = textY - (fontSize / 2) - padding;
      const bgWidth = textMetrics.width + (padding * 2);
      const bgHeight = fontSize + (padding * 2);
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
    }
    
    // Draw text
    ctx.fillStyle = priceUseStaticColor ? priceStaticColor : (lastTickDirection === 'up' ? priceUpColor : priceDownColor);
    ctx.fillText(volatilityText, textX, textY);
    
    ctx.restore();
  }
}
