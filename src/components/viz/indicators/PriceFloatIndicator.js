import BaseIndicator from './BaseIndicator.js';

/**
 * Price Float Indicator
 * Renders a horizontal line representing the current price
 */
export class PriceFloatIndicator extends BaseIndicator {
  get defaultSettings() {
    return {
      ...super.defaultSettings,
      width: 100,
      height: 4,
      color: '#a78bfa',
      glow: true,
      xOffset: 0,
      yOffset: 0,
      animationDuration: 300,
      showPriceLabel: false,
      labelPosition: 'right'
    };
  }
  
  doRender(data, canvas) {
    const { currentPrice, visualHigh, visualLow } = data;
    const { width, height } = canvas;
    
    // Calculate Y position from price
    const priceRange = visualHigh - visualLow;
    const pricePercent = (currentPrice - visualLow) / priceRange;
    const y = height - (pricePercent * height) + this.settings.yOffset;
    const x = (width - this.settings.width) / 2 + this.settings.xOffset;
    
    // Draw glow effect
    if (this.settings.glow) {
      this.ctx.shadowColor = this.settings.color;
      this.ctx.shadowBlur = 8;
    }
    
    // Draw price line
    this.ctx.fillStyle = this.settings.color;
    this.drawRectangle(x, y - this.settings.height / 2, this.settings.width, this.settings.height, {
      fill: true,
      fillColor: this.settings.color,
      shadow: this.settings.glow,
      shadowColor: this.settings.color,
      shadowBlur: 8
    });
    
    // Draw price label if enabled
    if (this.settings.showPriceLabel) {
      this.drawPriceLabel(currentPrice, x, y, width);
    }
    
    return {
      imageData: this.ctx.getImageData(0, 0, width, height),
      price,
      position: { x, y }
    };
  }
  
  drawPriceLabel(price, lineX, lineY, canvasWidth) {
    const priceText = price.toFixed(5);
    const labelPadding = 4;
    const labelMargin = 8;
    
    // Measure text
    this.ctx.font = '10px monospace';
    const textWidth = this.ctx.measureText(priceText).width;
    const labelHeight = 14;
    
    // Calculate label position
    let labelX, labelY;
    
    if (this.settings.labelPosition === 'right') {
      labelX = lineX + this.settings.width + labelMargin;
      labelY = lineY - labelHeight / 2;
    } else if (this.settings.labelPosition === 'left') {
      labelX = lineX - textWidth - labelPadding * 2 - labelMargin;
      labelY = lineY - labelHeight / 2;
    } else {
      // Center
      labelX = (canvasWidth - textWidth - labelPadding * 2) / 2;
      labelY = lineY - this.settings.height - labelMargin;
    }
    
    // Draw label background
    this.drawRectangle(labelX, labelY, textWidth + labelPadding * 2, labelHeight, {
      fill: true,
      fillColor: 'rgba(0, 0, 0, 0.8)',
      radius: 2
    });
    
    // Draw text
    this.drawText(priceText, labelX + labelPadding, labelY + 10, {
      font: '10px monospace',
      color: '#ffffff',
      align: 'left',
      baseline: 'top'
    });
  }
  
  extractRelevantData(data) {
    return {
      price: data.currentPrice,
      visualHigh: data.visualHigh,
      visualLow: data.visualLow,
      timestamp: data.lastTickTime
    };
  }
}

// Static metadata
PriceFloatIndicator.type = 'priceFloat';
PriceFloatIndicator.version = '1.0.0';
PriceFloatIndicator.description = 'Horizontal line showing current price with optional label';

export default PriceFloatIndicator;
