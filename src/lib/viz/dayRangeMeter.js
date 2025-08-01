import { scaleLinear } from 'd3-scale';

function hexToRgba(hex, opacity) {
    if (!hex) return 'rgba(0,0,0,0)';
    
    const finalOpacity = (opacity === undefined || opacity === null) ? 1 : opacity;

    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex.substring(1, 3), 16);
        g = parseInt(hex.substring(3, 5), 16);
        b = parseInt(hex.substring(5, 7), 16);
    }
    
    return `rgba(${r},${g},${b},${finalOpacity})`;
}

export function drawDayRangeMeter(ctx, config, state, y) {
  const {
    centralAxisXPosition,
    meterHeight,
    centralMeterFixedThickness = 1,
    adrProximityThreshold,
    pHighLowLabelSide,
    ohlLabelSide,

    pHighLowLabelShowBackground,
    pHighLowLabelBackgroundColor,
    pHighLowLabelBackgroundOpacity,
    pHighLowLabelShowBoxOutline,
    pHighLowLabelBoxOutlineColor,
    pHighLowLabelBoxOutlineOpacity,

    ohlLabelShowBackground,
    ohlLabelBackgroundColor,
    ohlLabelBackgroundOpacity,
    ohlLabelShowBoxOutline,
    ohlLabelBoxOutlineColor,
    ohlLabelBoxOutlineOpacity,
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
  const labelPadding = 4;

  ctx.font = `${labelFontSize}px Arial`;
  ctx.fillStyle = labelColor;

  const drawMarkerAndLabel = (price, labelText, color = '#D1D5DB', side = 'left', labelType) => {
      const priceY = y(price);
      if (priceY === undefined || priceY === null || priceY < -50 || priceY > meterHeight + 50) return;

      const showBackground = labelType === 'pHighLow' ? pHighLowLabelShowBackground : ohlLabelShowBackground;
      const backgroundColor = labelType === 'pHighLow' ? pHighLowLabelBackgroundColor : ohlLabelBackgroundColor;
      const backgroundOpacity = labelType === 'pHighLow' ? pHighLowLabelBackgroundOpacity : ohlLabelBackgroundOpacity;
      const showBoxOutline = labelType === 'pHighLow' ? pHighLowLabelShowBoxOutline : ohlLabelShowBoxOutline;
      const boxOutlineColor = labelType === 'pHighLow' ? pHighLowLabelBoxOutlineColor : ohlLabelBoxOutlineColor;
      const boxOutlineOpacity = labelType === 'pHighLow' ? pHighLowLabelBoxOutlineOpacity : ohlLabelBoxOutlineOpacity;
      
      const metrics = ctx.measureText(labelText);
      const textWidth = metrics.width;
      const textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;

      const backgroundWidth = textWidth + (labelPadding * 2);
      const backgroundHeight = textHeight + (labelPadding * 2);
      
      const textAlign = side === 'right' ? 'left' : 'right';
      const textX = side === 'right' 
        ? centralAxisXPosition + labelOffset 
        : centralAxisXPosition - labelOffset;
      const backgroundX = side === 'right'
        ? textX - labelPadding
        : textX - textWidth - labelPadding;
      const backgroundY = priceY - (backgroundHeight / 2);

      if (showBackground) {
          ctx.fillStyle = hexToRgba(backgroundColor, backgroundOpacity);
          ctx.fillRect(backgroundX, backgroundY, backgroundWidth, backgroundHeight);
      }

      if (showBoxOutline) {
          ctx.strokeStyle = hexToRgba(boxOutlineColor, boxOutlineOpacity);
          ctx.lineWidth = 1;
          ctx.strokeRect(backgroundX, backgroundY, backgroundWidth, backgroundHeight);
      }
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(centralAxisXPosition - markerLength, priceY);
      ctx.lineTo(centralAxisXPosition + markerLength, priceY);
      ctx.stroke();

      ctx.textAlign = textAlign;
      const textY = priceY + (textHeight / 2) - metrics.actualBoundingBoxDescent;
      ctx.fillStyle = color;
      ctx.fillText(labelText, textX, textY);
  };

  const formatPrice = (price) => price?.toFixed(digits) || 'N/A';

  // Draw labels based on the side configured in the store
  drawMarkerAndLabel(todaysHigh, `H ${formatPrice(todaysHigh)}`, '#F59E0B', ohlLabelSide, 'ohl');
  drawMarkerAndLabel(todaysLow, `L ${formatPrice(todaysLow)}`, '#F59E0B', ohlLabelSide, 'ohl');
  drawMarkerAndLabel(projectedAdrHigh, `P.High ${formatPrice(projectedAdrHigh)}`, '#3B82F6', pHighLowLabelSide, 'pHighLow');
  drawMarkerAndLabel(projectedAdrLow, `P.Low ${formatPrice(projectedAdrLow)}`, '#3B82F6', pHighLowLabelSide, 'pHighLow');
  drawMarkerAndLabel(state.midPrice, `Open ${formatPrice(state.midPrice)}`, '#6B7280', ohlLabelSide, 'ohl');

  // --- ADR Proximity Pulse ---
  const adrRange = projectedAdrHigh - projectedAdrLow;
  if (adrRange > 0 && currentPrice !== undefined && currentPrice !== null) {
      const proximityUp = Math.abs(projectedAdrHigh - currentPrice);
      const proximityDown = Math.abs(currentPrice - projectedAdrLow);
      
      const threshold = adrRange * (adrProximityThreshold / 100);

      const drawPulse = (yPos, proximity) => {
          if (yPos === undefined || yPos === null || yPos < 0 || yPos > meterHeight) return;
          
          const intensity = 1 - (proximity / threshold);
          if (intensity <= 0) return;
          
          const pulseRadius = 20 + (intensity * 30); // Dynamic radius
          const pulseOpacity = intensity * 0.7; // Dynamic opacity

          const gradient = ctx.createRadialGradient(centralAxisXPosition, yPos, 0, centralAxisXPosition, yPos, pulseRadius);
          gradient.addColorStop(0, `rgba(59, 130, 246, ${pulseOpacity})`); // Using blue from config
          gradient.addColorStop(1, `rgba(59, 130, 246, 0)`);
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(centralAxisXPosition, yPos, pulseRadius, 0, 2 * Math.PI);
          ctx.fill();
      };

      if (proximityUp < threshold) {
          drawPulse(y(projectedAdrHigh), proximityUp);
      }

      if (proximityDown < threshold) {
          drawPulse(y(projectedAdrLow), proximityDown);
      }
  }
}
