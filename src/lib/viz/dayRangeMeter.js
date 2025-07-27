import { scaleLinear } from 'd3-scale';

export function drawDayRangeMeter(ctx, config, state, y) {
  const {
    centralAxisXPosition,
    meterHeight,
    centralMeterFixedThickness,
    adrProximityThreshold,
    adrHigh,
    adrLow,
  } = config;

  const currentPrice = state.currentPrice;

  // Draw the main meter axis
  ctx.beginPath();
  ctx.strokeStyle = '#4B5563'; // Gray-600
  ctx.lineWidth = centralMeterFixedThickness;
  ctx.moveTo(centralAxisXPosition, 0);
  ctx.lineTo(centralAxisXPosition, meterHeight);
  ctx.stroke();

  // ADR Proximity Pulse
  const adrRange = state.adrHigh - state.adrLow;
  const proximityUp = Math.abs(state.adrHigh - currentPrice);
  const proximityDown = Math.abs(currentPrice - state.adrLow);

  if (proximityUp / adrRange < adrProximityThreshold / 100) {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)'; // Blue-500 with opacity
    ctx.lineWidth = centralMeterFixedThickness * 1.5;
    ctx.moveTo(centralAxisXPosition, y(state.adrHigh));
    ctx.lineTo(centralAxisXPosition, y(state.adrHigh) + 10);
    ctx.stroke();
  }

  if (proximityDown / adrRange < adrProximityThreshold / 100) {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)'; // Blue-500 with opacity
    ctx.lineWidth = centralMeterFixedThickness * 1.5;
    ctx.moveTo(centralAxisXPosition, y(state.adrLow));
    ctx.lineTo(centralAxisXPosition, y(state.adrLow) - 10);
    ctx.stroke();
  }
}
