import BaseIndicator from './BaseIndicator.js';

/**
 * ADR Meter Indicator
 * Renders an Average Daily Range indicator with boundary detection
 */
export class ADRMeterIndicator extends BaseIndicator {
  get defaultSettings() {
    return {
      ...super.defaultSettings,
      showPulse: true,
      threshold: 10,
      color: '#3b82f6',
      orientation: 'vertical',
      showLabels: true,
      showBoundaries: true,
      boundaryAlert: true,
      pulseSpeed: 2000,
      barWidth: 8,
      showPercentage: true
    };
  }
  
  doRender(data, canvas) {
    const { currentPrice, dayHigh, dayLow, adrHigh, adrLow, adrPercentage } = data;
    const { width, height } = canvas;
    
    // Calculate ADR metrics
    const adrMetrics = this.calculateADRMetrics(currentPrice, dayHigh, dayLow, adrHigh, adrLow);
    
    // Draw based on orientation
    if (this.settings.orientation === 'vertical') {
      this.drawVerticalADRMeter(adrMetrics, width, height);
    } else {
      this.drawHorizontalADRMeter(adrMetrics, width, height);
    }
    
    // Draw boundaries if enabled
    if (this.settings.showBoundaries) {
      this.drawBoundaries(adrMetrics, width, height);
    }
    
    // Draw pulse if enabled and near boundary
    if (this.settings.showPulse && this.shouldPulse(adrMetrics)) {
      this.drawPulseEffect(adrMetrics, width, height);
    }
    
    return {
      imageData: this.ctx.getImageData(0, 0, width, height),
      adrMetrics
    };
  }
  
  calculateADRMetrics(currentPrice, dayHigh, dayLow, adrHigh, adrLow) {
    const dayRange = dayHigh - dayLow;
    const adrRange = adrHigh - adrLow;
    
    // Calculate current position within ADR
    const currentADRPosition = ((currentPrice - adrLow) / adrRange) * 100;
    
    // Calculate day range percentage
    const dayRangePercentage = (dayRange / adrRange) * 100;
    
    // Determine proximity to boundaries
    const proximityToHigh = ((adrHigh - currentPrice) / adrRange) * 100;
    const proximityToLow = ((currentPrice - adrLow) / adrRange) * 100;
    
    // Determine if near boundaries
    const nearHigh = proximityToHigh < this.settings.threshold;
    const nearLow = proximityToLow < this.settings.threshold;
    
    // Calculate boundary alerts
    const boundaryAlert = nearHigh || nearLow;
    const alertType = nearHigh ? 'high' : nearLow ? 'low' : null;
    
    return {
      currentPrice,
      dayHigh,
      dayLow,
      adrHigh,
      adrLow,
      adrRange,
      dayRange,
      currentADRPosition,
      dayRangePercentage,
      proximityToHigh,
      proximityToLow,
      nearHigh,
      nearLow,
      boundaryAlert,
      alertType,
      isInRange: currentPrice >= adrLow && currentPrice <= adrHigh
    };
  }
  
  drawVerticalADRMeter(adrMetrics, width, height) {
    const centerX = width / 2;
    const meterHeight = height * 0.8;
    const meterTop = height * 0.1;
    const meterBottom = meterTop + meterHeight;
    
    // Draw ADR background
    this.drawRectangle(centerX - this.settings.barWidth / 2, meterTop, this.settings.barWidth, meterHeight, {
      fill: true,
      fillColor: 'rgba(255, 255, 255, 0.1)',
      radius: this.settings.barWidth / 2
    });
    
    // Draw ADR range
    const adrTop = meterTop + (1 - (adrMetrics.adrHigh - adrMetrics.adrLow) / adrMetrics.adrRange) * meterHeight;
    const adrHeight = ((adrMetrics.adrHigh - adrMetrics.adrLow) / adrMetrics.adrRange) * meterHeight;
    
    this.drawRectangle(centerX - this.settings.barWidth / 2, adrTop, this.settings.barWidth, adrHeight, {
      fill: true,
      fillColor: 'rgba(59, 130, 246, 0.3)',
      radius: this.settings.barWidth / 2
    });
    
    // Draw current price position
    const currentY = meterTop + (1 - adrMetrics.currentADRPosition / 100) * meterHeight;
    
    this.drawCircle(centerX, currentY, this.settings.barWidth / 2 + 2, {
      fill: true,
      fillColor: this.getAlertColor(adrMetrics),
      stroke: true,
      strokeColor: '#ffffff',
      lineWidth: 2,
      shadow: adrMetrics.boundaryAlert,
      shadowColor: this.getAlertColor(adrMetrics),
      shadowBlur: 10
    });
    
    // Draw day range bar
    const dayRangeHeight = (adrMetrics.dayRangePercentage / 100) * meterHeight;
    const dayRangeTop = currentY - dayRangeHeight / 2;
    
    this.drawRectangle(centerX - this.settings.barWidth / 4, dayRangeTop, this.settings.barWidth / 2, dayRangeHeight, {
      fill: true,
      fillColor: 'rgba(34, 197, 94, 0.6)',
      radius: this.settings.barWidth / 4
    });
    
    // Draw labels if enabled
    if (this.settings.showLabels) {
      this.drawVerticalLabels(adrMetrics, centerX, meterTop, meterBottom);
    }
  }
  
  drawHorizontalADRMeter(adrMetrics, width, height) {
    const centerY = height / 2;
    const meterWidth = width * 0.8;
    const meterLeft = width * 0.1;
    const meterRight = meterLeft + meterWidth;
    
    // Draw ADR background
    this.drawRectangle(meterLeft, centerY - this.settings.barWidth / 2, meterWidth, this.settings.barWidth, {
      fill: true,
      fillColor: 'rgba(255, 255, 255, 0.1)',
      radius: this.settings.barWidth / 2
    });
    
    // Draw ADR range
    const adrLeft = meterLeft + ((adrMetrics.adrLow - adrMetrics.adrLow) / adrMetrics.adrRange) * meterWidth;
    const adrWidth = ((adrMetrics.adrHigh - adrMetrics.adrLow) / adrMetrics.adrRange) * meterWidth;
    
    this.drawRectangle(adrLeft, centerY - this.settings.barWidth / 2, adrWidth, this.settings.barWidth, {
      fill: true,
      fillColor: 'rgba(59, 130, 246, 0.3)',
      radius: this.settings.barWidth / 2
    });
    
    // Draw current price position
    const currentX = meterLeft + (adrMetrics.currentADRPosition / 100) * meterWidth;
    
    this.drawCircle(currentX, centerY, this.settings.barWidth / 2 + 2, {
      fill: true,
      fillColor: this.getAlertColor(adrMetrics),
      stroke: true,
      strokeColor: '#ffffff',
      lineWidth: 2,
      shadow: adrMetrics.boundaryAlert,
      shadowColor: this.getAlertColor(adrMetrics),
      shadowBlur: 10
    });
    
    // Draw day range bar
    const dayRangeWidth = (adrMetrics.dayRangePercentage / 100) * meterWidth;
    const dayRangeLeft = currentX - dayRangeWidth / 2;
    
    this.drawRectangle(dayRangeLeft, centerY - this.settings.barWidth / 4, dayRangeWidth, this.settings.barWidth / 2, {
      fill: true,
      fillColor: 'rgba(34, 197, 94, 0.6)',
      radius: this.settings.barWidth / 4
    });
    
    // Draw labels if enabled
    if (this.settings.showLabels) {
      this.drawHorizontalLabels(adrMetrics, centerY, meterLeft, meterRight);
    }
  }
  
  drawBoundaries(adrMetrics, width, height) {
    const isVertical = this.settings.orientation === 'vertical';
    
    // Draw high boundary
    if (isVertical) {
      const centerX = width / 2;
      const meterHeight = height * 0.8;
      const meterTop = height * 0.1;
      const highY = meterTop + (1 - ((adrMetrics.adrHigh - adrMetrics.adrLow) / adrMetrics.adrRange)) * meterHeight;
      
      this.ctx.strokeStyle = adrMetrics.nearHigh ? '#ef4444' : 'rgba(255, 255, 255, 0.3)';
      this.ctx.lineWidth = adrMetrics.nearHigh ? 2 : 1;
      this.ctx.setLineDash([5, 5]);
      
      this.ctx.beginPath();
      this.ctx.moveTo(centerX - 20, highY);
      this.ctx.lineTo(centerX + 20, highY);
      this.ctx.stroke();
      
      this.ctx.setLineDash([]);
    } else {
      const centerY = height / 2;
      const meterWidth = width * 0.8;
      const meterLeft = width * 0.1;
      const highX = meterLeft + ((adrMetrics.adrHigh - adrMetrics.adrLow) / adrMetrics.adrRange) * meterWidth;
      
      this.ctx.strokeStyle = adrMetrics.nearHigh ? '#ef4444' : 'rgba(255, 255, 255, 0.3)';
      this.ctx.lineWidth = adrMetrics.nearHigh ? 2 : 1;
      this.ctx.setLineDash([5, 5]);
      
      this.ctx.beginPath();
      this.ctx.moveTo(highX, centerY - 20);
      this.ctx.lineTo(highX, centerY + 20);
      this.ctx.stroke();
      
      this.ctx.setLineDash([]);
    }
  }
  
  drawPulseEffect(adrMetrics, width, height) {
    const isVertical = this.settings.orientation === 'vertical';
    const pulseIntensity = Math.sin(Date.now() / this.settings.pulseSpeed) * 0.5 + 0.5;
    
    if (isVertical) {
      const centerX = width / 2;
      const meterHeight = height * 0.8;
      const meterTop = height * 0.1;
      const currentY = meterTop + (1 - adrMetrics.currentADRPosition / 100) * meterHeight;
      
      const pulseRadius = (this.settings.barWidth / 2 + 5) * (1 + pulseIntensity * 0.5);
      
      this.drawCircle(centerX, currentY, pulseRadius, {
        fill: false,
        stroke: true,
        strokeColor: this.getAlertColor(adrMetrics),
        lineWidth: 2 * pulseIntensity
      });
    } else {
      const centerY = height / 2;
      const meterWidth = width * 0.8;
      const meterLeft = width * 0.1;
      const currentX = meterLeft + (adrMetrics.currentADRPosition / 100) * meterWidth;
      
      const pulseRadius = (this.settings.barWidth / 2 + 5) * (1 + pulseIntensity * 0.5);
      
      this.drawCircle(currentX, centerY, pulseRadius, {
        fill: false,
        stroke: true,
        strokeColor: this.getAlertColor(adrMetrics),
        lineWidth: 2 * pulseIntensity
      });
    }
  }
  
  drawVerticalLabels(adrMetrics, centerX, meterTop, meterBottom) {
    // Draw ADR percentage
    if (this.settings.showPercentage) {
      const percentageText = `${adrMetrics.dayRangePercentage.toFixed(1)}%`;
      this.drawText(percentageText, centerX, meterBottom + 20, {
        font: 'bold 12px monospace',
        color: '#ffffff',
        align: 'center',
        baseline: 'top'
      });
    }
    
    // Draw boundary alerts
    if (adrMetrics.boundaryAlert && this.settings.boundaryAlert) {
      const alertText = adrMetrics.alertType === 'high' ? 'HIGH' : 'LOW';
      const alertY = adrMetrics.alertType === 'high' ? meterTop : meterBottom;
      
      this.drawText(alertText, centerX, alertY - 10, {
        font: 'bold 10px sans-serif',
        color: this.getAlertColor(adrMetrics),
        align: 'center',
        baseline: 'bottom'
      });
    }
  }
  
  drawHorizontalLabels(adrMetrics, centerY, meterLeft, meterRight) {
    // Draw ADR percentage
    if (this.settings.showPercentage) {
      const percentageText = `${adrMetrics.dayRangePercentage.toFixed(1)}%`;
      this.drawText(percentageText, meterRight + 10, centerY, {
        font: 'bold 12px monospace',
        color: '#ffffff',
        align: 'left',
        baseline: 'middle'
      });
    }
    
    // Draw boundary alerts
    if (adrMetrics.boundaryAlert && this.settings.boundaryAlert) {
      const alertText = adrMetrics.alertType === 'high' ? 'HIGH' : 'LOW';
      const alertX = adrMetrics.alertType === 'high' ? meterRight : meterLeft;
      
      this.drawText(alertText, alertX, centerY - 20, {
        font: 'bold 10px sans-serif',
        color: this.getAlertColor(adrMetrics),
        align: 'center',
        baseline: 'bottom'
      });
    }
  }
  
  shouldPulse(adrMetrics) {
    return adrMetrics.boundaryAlert && this.settings.showPulse;
  }
  
  getAlertColor(adrMetrics) {
    if (adrMetrics.nearHigh) {
      return '#ef4444';
    } else if (adrMetrics.nearLow) {
      return '#22c55e';
    } else if (!adrMetrics.isInRange) {
      return '#f59e0b';
    } else {
      return this.settings.color;
    }
  }
  
  extractRelevantData(data) {
    return {
      currentPrice: data.currentPrice,
      dayHigh: data.dayHigh,
      dayLow: data.dayLow,
      adrHigh: data.adrHigh,
      adrLow: data.adrLow,
      adrPercentage: data.adrPercentage,
      timestamp: data.lastTickTime
    };
  }
}

// Static metadata
ADRMeterIndicator.type = 'adrMeter';
ADRMeterIndicator.version = '1.0.0';
ADRMeterIndicator.description = 'Average daily range indicator with boundary detection and alerts';

export default ADRMeterIndicator;
