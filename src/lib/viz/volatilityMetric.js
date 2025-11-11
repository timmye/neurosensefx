export function drawVolatilityMetric(ctx, renderingContext, config, state) {
  if (!renderingContext || !state) return;

  // 🔧 CLEAN FOUNDATION: Use rendering context instead of legacy config
  const { contentArea } = renderingContext;

  // Extract configuration parameters
  const { showVolatilityMetric } = config;

  if (!showVolatilityMetric) {
    return;
  }

  const { volatility } = state;

  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = '11px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const safeVolatility = volatility || 0;
  const sigmaText = `σ ${safeVolatility.toFixed(2)}`;

  // 🔧 CLEAN FOUNDATION: Position sigma metric in bottom-left corner
  ctx.fillText(sigmaText, 10, contentArea.height - 20);
  ctx.restore();
}
