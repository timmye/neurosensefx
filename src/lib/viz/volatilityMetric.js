export function drawVolatilityMetric(ctx, renderingContext, config, state) {
  if (!renderingContext || !state) return;

  // 🔧 CLEAN FOUNDATION: Use rendering context instead of legacy config
  const { contentArea } = renderingContext;
  
  // Extract configuration parameters
  const { showVolatilityMetric } = config;

  if (!showVolatilityMetric) {
    return;
  }

  const { volatility, volatilityIntensity } = state;

  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = '11px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const safeVolatility = volatility || 0;
  const safeIntensity = volatilityIntensity || 0;
  const volatilityText = `Volatility: ${safeVolatility.toFixed(4)}`;
  const intensityText = `Intensity: ${(safeIntensity * 100).toFixed(2)}%`;

  // 🔧 CLEAN FOUNDATION: Use content area dimensions for positioning
  ctx.fillText(volatilityText, 10, contentArea.height - 35);
  ctx.fillText(intensityText, 10, contentArea.height - 20);
  ctx.restore();
}
