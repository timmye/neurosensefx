import { scaleLinear } from 'd3-scale';

export function drawDayRangeMeter(ctx, config, state, y) {
  const {
    centralAxisXPosition,
    visualizationsContentWidth,
    meterHeight,
    centralMeterFixedThickness = 1,
    adrProximityThreshold,
    adrPulseColor,
    adrPulseWidthRatio,
    adrPulseHeight,
  } = config;

  const { currentPrice, todaysHigh, todaysLow, projectedAdrHigh, projectedAdrLow, digits } = state;

  // Draw the main meter axis
  ctx.beginPath();
  ctx.strokeStyle = '#4B5563'; // Gray-600
  ctx.lineWidth = centralMeterFixedThickness;
  ctx.moveTo(centralAxisXPosition, 0);
  ctx.lineTo(centralAxisXPosition, meterHeight);
  ctx.stroke();

  // Draw markers and labels
  const markerLength = 10;
  const labelOffset = 15;
  const labelColor = '#9CA3AF'; // Gray-400
  const labelFontSize = 10;

  ctx.font = `${labelFontSize}px Arial`;
  ctx.fillStyle = labelColor;
  ctx.textAlign = 'left';

  const drawMarkerAndLabel = (price, labelText, color = '#D1D5DB', align = 'left') => {
      const priceY = y(price);
      if (priceY === undefined || priceY === null || priceY < -50 || priceY > meterHeight + 50) return;

      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(centralAxisXPosition - markerLength, priceY);
      ctx.lineTo(centralAxisXPosition, priceY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(centralAxisXPosition, priceY);
      ctx.lineTo(centralAxisXPosition + markerLength, priceY);
      ctx.stroke();

      ctx.textAlign = align;
      const textX = align === 'left' ? centralAxisXPosition + labelOffset : centralAxisXPosition - labelOffset;
      const textY = priceY + labelFontSize * 0.3;
      ctx.fillText(labelText, textX, textY);
  };

  const formatPrice = (price) => price?.toFixed(digits) || 'N/A';

  drawMarkerAndLabel(todaysHigh, `H ${formatPrice(todaysHigh)}`, '#F59E0B', 'right');
  drawMarkerAndLabel(todaysLow, `L ${formatPrice(todaysLow)}`, '#F59E0B', 'right');
  drawMarkerAndLabel(projectedAdrHigh, `P.High ${formatPrice(projectedAdrHigh)}`, '#3B82F6', 'left');
  drawMarkerAndLabel(projectedAdrLow, `P.Low ${formatPrice(projectedAdrLow)}`, '#3B82F6', 'left');
  drawMarkerAndLabel(state.midPrice, `Open ${formatPrice(state.midPrice)}`, '#6B7280', 'right');

  // ADR Proximity Pulse - Drawing horizontal bars at the ADR boundaries
  const adrRange = projectedAdrHigh - projectedAdrLow;
  if (adrRange > 0 && currentPrice !== undefined && currentPrice !== null) {
      const proximityUp = Math.abs(projectedAdrHigh - currentPrice);
      const proximityDown = Math.abs(currentPrice - projectedAdrLow);

      // Use values from config
      const pulseWidth = visualizationsContentWidth * adrPulseWidthRatio;
      const pulseX = (visualizationsContentWidth - pulseWidth) / 2; // Center the pulse bar

      if (proximityUp / adrRange < adrProximityThreshold / 100) {
          const adrHighY = y(projectedAdrHigh);
           if (adrHighY !== undefined && adrHighY !== null && adrHighY > -adrPulseHeight && adrHighY < meterHeight + adrPulseHeight) {
                ctx.fillStyle = adrPulseColor;
                ctx.fillRect(pulseX, adrHighY - adrPulseHeight / 2, pulseWidth, adrPulseHeight);
           }
      }

      if (proximityDown / adrRange < adrProximityThreshold / 100) {
          const adrLowY = y(projectedAdrLow);
           if (adrLowY !== undefined && adrLowY !== null && adrLowY > -adrPulseHeight && adrLowY < meterHeight + adrPulseHeight) {
               ctx.fillStyle = adrPulseColor;
               ctx.fillRect(pulseX, adrLowY - adrPulseHeight / 2, pulseWidth, adrPulseHeight);
           }
      }
  }
}
