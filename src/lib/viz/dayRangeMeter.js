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
    visualizationsContentWidth,
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

    showAdrRangeIndicatorLines,
    adrRangeIndicatorLinesColor,
    adrRangeIndicatorLinesThickness,
    showAdrRangeIndicatorLabel,
    adrRangeIndicatorLabelColor,
    adrRangeIndicatorLabelShowBackground,
    adrRangeIndicatorLabelBackgroundColor,
    adrRangeIndicatorLabelBackgroundOpacity,
    adrRangeIndicatorLabelShowBoxOutline,
    adrRangeIndicatorLabelBoxOutlineColor,
    adrRangeIndicatorLabelBoxOutlineOpacity,
    adrLabelType, // Added adrLabelType from config
  } = config;

  const { currentPrice, todaysHigh, todaysLow, projectedAdrHigh, projectedAdrLow, digits, maxAdrPercentage } = state;

  // Draw the main meter axis
  ctx.beginPath();
  ctx.strokeStyle = '#4B5563';
  ctx.lineWidth = centralMeterFixedThickness;
  ctx.moveTo(centralAxisXPosition, 0);
  ctx.lineTo(centralAxisXPosition, meterHeight);
  ctx.stroke();

  const labelFontSize = 10;
  const labelPadding = 4;
  ctx.font = `${labelFontSize}px Arial`;

  // --- ADR Range Indicator ---
  if (showAdrRangeIndicatorLines) {
    ctx.strokeStyle = adrRangeIndicatorLinesColor;
    ctx.lineWidth = adrRangeIndicatorLinesThickness;
    // Top line
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(visualizationsContentWidth, 0);
    ctx.stroke();
    // Bottom line
    ctx.beginPath();
    ctx.moveTo(0, meterHeight);
    ctx.lineTo(visualizationsContentWidth, meterHeight);
    ctx.stroke();
  }

  if (showAdrRangeIndicatorLabel) {
    const maxAdrValue = maxAdrPercentage || 0;
    const labelText = `ADR: ±${(maxAdrValue * 100).toFixed(0)}%`;
    const metrics = ctx.measureText(labelText);
    const textWidth = metrics.width;
    const textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    const backgroundWidth = textWidth + (labelPadding * 2);
    const backgroundHeight = textHeight + (labelPadding * 2);
    const backgroundX = (visualizationsContentWidth - backgroundWidth) / 2;
    const backgroundY = labelPadding;

    if (adrRangeIndicatorLabelShowBackground) {
        ctx.fillStyle = hexToRgba(adrRangeIndicatorLabelBackgroundColor, adrRangeIndicatorLabelBackgroundOpacity);
        ctx.fillRect(backgroundX, backgroundY, backgroundWidth, backgroundHeight);
    }
    if (adrRangeIndicatorLabelShowBoxOutline) {
        ctx.strokeStyle = hexToRgba(adrRangeIndicatorLabelBoxOutlineColor, adrRangeIndicatorLabelBoxOutlineOpacity);
        ctx.lineWidth = 1;
        ctx.strokeRect(backgroundX, backgroundY, backgroundWidth, backgroundHeight);
    }

    ctx.fillStyle = adrRangeIndicatorLabelColor;
    ctx.textAlign = 'center';
    const textY = backgroundY + (backgroundHeight / 2) + (textHeight / 2) - metrics.actualBoundingBoxDescent;
    ctx.fillText(labelText, visualizationsContentWidth / 2, textY);
  }

  // --- Individual Price Level Markers ---
  const markerLength = 10;
  const labelOffset = 15;
  
  const drawMarkerAndLabel = (price, labelText, color = '#D1D5DB', side = 'left', labelType) => {
      const priceY = y(price);
      if (priceY === undefined || priceY === null || priceY < -50 || priceY > meterHeight + 50) return;

      const showBg = labelType === 'pHighLow' ? pHighLowLabelShowBackground : ohlLabelShowBackground;
      const bgColor = labelType === 'pHighLow' ? pHighLowLabelBackgroundColor : ohlLabelBackgroundColor;
      const bgOpacity = labelType === 'pHighLow' ? pHighLowLabelBackgroundOpacity : ohlLabelBackgroundOpacity;
      const showOutline = labelType === 'pHighLow' ? pHighLowLabelShowBoxOutline : ohlLabelShowBoxOutline;
      const outlineColor = labelType === 'pHighLow' ? pHighLowLabelBoxOutlineColor : ohlLabelBoxOutlineColor;
      const outlineOpacity = labelType === 'pHighLow' ? pHighLowLabelBoxOutlineOpacity : ohlLabelBoxOutlineOpacity;
      
      const metrics = ctx.measureText(labelText);
      const textWidth = metrics.width;
      const textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
      const backgroundWidth = textWidth + (labelPadding * 2);
      const backgroundHeight = textHeight + (labelPadding * 2);
      
      const textAlign = side === 'right' ? 'left' : 'right';
      const textX = side === 'right' ? centralAxisXPosition + labelOffset : centralAxisXPosition - labelOffset;
      const backgroundX = side === 'right' ? textX - labelPadding : textX - textWidth - labelPadding;
      const backgroundY = priceY - (backgroundHeight / 2);

      if (showBg) {
          ctx.fillStyle = hexToRgba(bgColor, bgOpacity);
          ctx.fillRect(backgroundX, backgroundY, backgroundWidth, backgroundHeight);
      }
      if (showOutline) {
          ctx.strokeStyle = hexToRgba(outlineColor, outlineOpacity);
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

  const formatPrice = (price) => {
    try {
      return (price !== undefined && price !== null && !isNaN(price)) ? price.toFixed(digits) : 'N/A';
    } catch (error) {
      console.error('Error formatting price:', { price, digits, error });
      return 'N/A';
    }
  };

  drawMarkerAndLabel(todaysHigh, `H ${formatPrice(todaysHigh)}`, '#F59E0B', ohlLabelSide, 'ohl');
  drawMarkerAndLabel(todaysLow, `L ${formatPrice(todaysLow)}`, '#F59E0B', ohlLabelSide, 'ohl');
  drawMarkerAndLabel(state.midPrice, `Open ${formatPrice(state.midPrice)}`, '#6B7280', ohlLabelSide, 'ohl');

  const adrRange = projectedAdrHigh - projectedAdrLow;
  const adrLevels = [0.3, 0.5, 0.75, 1.0];
  
  if (adrLabelType === 'staticPercentage') {
 adrLevels.forEach(level => {
 if (maxAdrPercentage >= level) {
 const highLevel = state.midPrice + (adrRange / 2 * level);
 const lowLevel = state.midPrice - (adrRange / 2 * level);

 let label = `${level * 100}%`;

 drawMarkerAndLabel(highLevel, label, '#3B82F6', pHighLowLabelSide, 'pHighLow');
 drawMarkerAndLabel(lowLevel, label, '#3B82F6', pHighLowLabelSide, 'pHighLow');
 }
    });
  } else if (adrLabelType === 'dynamicPercentage') {
 // Calculate dynamic percentage for today's high and low relative to open and total ADR
 if (adrRange > 0) {
 const highPercentage = ((todaysHigh - state.midPrice) / adrRange) * 100;
 const lowPercentage = ((todaysLow - state.midPrice) / adrRange) * 100;

 // Format labels with sign and percentage
 const highLabel = `${highPercentage >= 0 ? '+' : ''}${(highPercentage || 0).toFixed(0)}%`;
 const lowLabel = `${lowPercentage >= 0 ? '+' : ''}${(lowPercentage || 0).toFixed(0)}%`;

 // Draw labels at the actual todaysHigh and todaysLow price levels
 drawMarkerAndLabel(todaysHigh, highLabel, '#3B82F6', pHighLowLabelSide, 'pHighLow');
 drawMarkerAndLabel(todaysLow, lowLabel, '#3B82F6', pHighLowLabelSide, 'pHighLow');
    } else {
 // Handle case where adrRange is 0 (e.g., beginning of day before any range is established)
    }
  }

  // --- ADR Proximity Pulse ---
  if (adrRange > 0 && currentPrice !== undefined && currentPrice !== null) {
      const proximityUp = Math.abs(projectedAdrHigh - currentPrice);
      const proximityDown = Math.abs(currentPrice - projectedAdrLow);
      
      const threshold = adrRange * (adrProximityThreshold / 100);

      const drawPulse = (yPos, proximity) => {
          if (yPos === undefined || yPos === null || yPos < 0 || yPos > meterHeight) return;
          
          const intensity = 1 - (proximity / threshold);
          if (intensity <= 0) return;
          
          const pulseRadius = 20 + (intensity * 30);
          const pulseOpacity = intensity * 0.7;

          const gradient = ctx.createRadialGradient(centralAxisXPosition, yPos, 0, centralAxisXPosition, yPos, pulseRadius);
          gradient.addColorStop(0, `rgba(59, 130, 246, ${pulseOpacity})`);
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
