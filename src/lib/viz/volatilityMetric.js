
export function drawVolatilityMetric(ctx, config, state, width, height) {
  if (!config.showVolatilityMetric) {
    return;
  }

  const { volatility, volatilityIntensity } = state;

  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = '11px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const volatilityText = `Volatility: ${volatility.toFixed(4)}`;
  const intensityText = `Intensity: ${(volatilityIntensity * 100).toFixed(2)}%`;

  ctx.fillText(volatilityText, 10, height - 35);
  ctx.fillText(intensityText, 10, height - 20);
  ctx.restore();
}
