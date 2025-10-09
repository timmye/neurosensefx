import BaseIndicator from './BaseIndicator.js';

/**
 * Price Display Indicator
 * Renders a numeric price display with formatting options
 */
export class PriceDisplayIndicator extends BaseIndicator {
  get defaultSettings() {
    return {
      ...super.defaultSettings,
      fontSize: 16,
      showPipettes: true,
      fontFamily: 'mono',
      format: 'decimal',
      showChange: true,
      showPercentage: false,
      changeThreshold: 0.0001,
      animationDuration: 300,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      textColor: '#ffffff',
      positiveColor: '#22c55e',
      negativeColor: '#ef4444',
      padding: 8,
      borderRadius: 4,
      showBackground: true,
      position: 'center'
    };
  }
  
  doRender(data, canvas) {
    const { currentPrice, previousPrice, priceChange, priceChangePercent } = data;
    const { width, height } = canvas;
    
    // Format the price display
    const priceDisplay = this.formatPrice(currentPrice);
    
    // Calculate position
    const position = this.calculatePosition(width, height);
    
    // Draw background if enabled
    if (this.settings.showBackground) {
      this.drawBackground(position, priceDisplay);
    }
    
    // Draw price text
    this.drawPriceText(priceDisplay, position);
    
    // Draw change information if enabled
    if (this.settings.showChange && previousPrice) {
      this.drawChangeInfo(priceChange, priceChangePercent, position);
    }
    
    return {
      imageData: this.ctx.getImageData(0, 0, width, height),
      priceDisplay,
      position
    };
  }
  
  formatPrice(price) {
    let formattedPrice;
    
    switch (this.settings.format) {
      case 'decimal':
        formattedPrice = this.formatDecimal(price);
        break;
      case 'fractional':
        formattedPrice = this.formatFractional(price);
        break;
      case 'scientific':
        formattedPrice = this.formatScientific(price);
        break;
      default:
        formattedPrice = this.formatDecimal(price);
    }
    
    return {
      main: formattedPrice.main,
      pips: formattedPrice.pips,
      pipettes: formattedPrice.pipettes,
      full: formattedPrice.full
    };
  }
  
  formatDecimal(price) {
    const priceString = price.toFixed(5);
    const parts = priceString.split('.');
    
    return {
      main: parts[0],
      pips: parts[1].substring(0, 2),
      pipettes: this.settings.showPipettes ? parts[1].substring(2) : '',
      full: priceString
    };
  }
  
  formatFractional(price) {
    // Convert to fractional format (e.g., 1/32, 1/64)
    const fractionalPrice = this.decimalToFraction(price);
    
    return {
      main: fractionalPrice.whole,
      pips: fractionalPrice.numerator,
      pipettes: `/${fractionalPrice.denominator}`,
      full: `${fractionalPrice.whole} ${fractionalPrice.numerator}/${fractionalPrice.denominator}`
    };
  }
  
  formatScientific(price) {
    return {
      main: price.toExponential(2),
      pips: '',
      pipettes: '',
      full: price.toExponential(5)
    };
  }
  
  decimalToFraction(decimal) {
    // Simple fraction conversion for common forex pairs
    const whole = Math.floor(decimal);
    const fraction = decimal - whole;
    
    // Common forex denominators
    const denominators = [2, 4, 8, 16, 32, 64, 128];
    let bestMatch = { numerator: 0, denominator: 1 };
    let minDiff = 1;
    
    denominators.forEach(denominator => {
      const numerator = Math.round(fraction * denominator);
      const diff = Math.abs(fraction - (numerator / denominator));
      
      if (diff < minDiff) {
        minDiff = diff;
        bestMatch = { numerator, denominator };
      }
    });
    
    return {
      whole,
      numerator: bestMatch.numerator,
      denominator: bestMatch.denominator
    };
  }
  
  calculatePosition(canvasWidth, canvasHeight) {
    const padding = this.settings.padding;
    const textMetrics = this.measureText();
    const textWidth = textMetrics.width;
    const textHeight = this.settings.fontSize;
    
    let x, y;
    
    switch (this.settings.position) {
      case 'top-left':
        x = padding;
        y = padding + textHeight;
        break;
      case 'top-right':
        x = canvasWidth - textWidth - padding;
        y = padding + textHeight;
        break;
      case 'bottom-left':
        x = padding;
        y = canvasHeight - padding;
        break;
      case 'bottom-right':
        x = canvasWidth - textWidth - padding;
        y = canvasHeight - padding;
        break;
      case 'center':
      default:
        x = (canvasWidth - textWidth) / 2;
        y = (canvasHeight + textHeight) / 2;
        break;
    }
    
    return { x, y, width: textWidth, height: textHeight };
  }
  
  measureText() {
    this.ctx.font = `${this.settings.fontSize}px ${this.settings.fontFamily}`;
    
    // Measure a sample price text
    const sampleText = '1.23456';
    return this.ctx.measureText(sampleText);
  }
  
  drawBackground(position, priceDisplay) {
    const padding = this.settings.padding;
    const backgroundPadding = 4;
    
    const bgX = position.x - backgroundPadding;
    const bgY = position.y - position.height - backgroundPadding;
    const bgWidth = position.width + (backgroundPadding * 2);
    const bgHeight = position.height + (backgroundPadding * 2);
    
    this.drawRectangle(bgX, bgY, bgWidth, bgHeight, {
      fill: true,
      fillColor: this.settings.backgroundColor,
      radius: this.settings.borderRadius
    });
  }
  
  drawPriceText(priceDisplay, position) {
    const { main, pips, pipettes } = priceDisplay;
    let currentX = position.x;
    
    // Set font
    const font = `${this.settings.fontSize}px ${this.settings.fontFamily}`;
    this.ctx.font = font;
    
    // Draw main part (whole numbers)
    if (main) {
      this.drawText(main, currentX, position.y, {
        font,
        color: this.settings.textColor,
        align: 'left',
        baseline: 'bottom'
      });
      
      currentX += this.ctx.measureText(main).width;
    }
    
    // Draw decimal point
    this.drawText('.', currentX, position.y, {
      font,
      color: this.settings.textColor,
      align: 'left',
      baseline: 'bottom'
    });
    currentX += this.ctx.measureText('.').width;
    
    // Draw pips
    if (pips) {
      this.drawText(pips, currentX, position.y, {
        font,
        color: this.settings.textColor,
        align: 'left',
        baseline: 'bottom'
      });
      currentX += this.ctx.measureText(pips).width;
    }
    
    // Draw pipettes (smaller, dimmer)
    if (pipettes) {
      const pipetteFont = `${this.settings.fontSize * 0.8}px ${this.settings.fontFamily}`;
      this.drawText(pipettes, currentX, position.y, {
        font: pipetteFont,
        color: 'rgba(255, 255, 255, 0.7)',
        align: 'left',
        baseline: 'bottom'
      });
    }
  }
  
  drawChangeInfo(priceChange, priceChangePercent, position) {
    if (Math.abs(priceChange) < this.settings.changeThreshold) {
      return; // Don't show changes below threshold
    }
    
    const isPositive = priceChange >= 0;
    const changeColor = isPositive ? this.settings.positiveColor : this.settings.negativeColor;
    const changeSymbol = isPositive ? '▲' : '▼';
    
    // Position change info below price
    const changeY = position.y + this.settings.fontSize + 8;
    const changeX = position.x;
    
    // Format change text
    const changeText = `${changeSymbol} ${Math.abs(priceChange).toFixed(5)}`;
    const percentText = this.settings.showPercentage 
      ? ` (${priceChangePercent.toFixed(2)}%)` 
      : '';
    
    // Draw change text
    this.drawText(changeText + percentText, changeX, changeY, {
      font: `${this.settings.fontSize * 0.8}px ${this.settings.fontFamily}`,
      color: changeColor,
      align: 'left',
      baseline: 'top'
    });
  }
  
  animatePriceChange(fromPrice, toPrice, duration = this.settings.animationDuration) {
    const startTime = Date.now();
    const priceDiff = toPrice - fromPrice;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeProgress = this.easeInOutCubic(progress);
      const currentPrice = fromPrice + (priceDiff * easeProgress);
      
      // Trigger re-render with animated price
      if (this.onPriceUpdate) {
        this.onPriceUpdate(currentPrice);
      }
      
      if (progress < 1) {
        this.animationFrame = requestAnimationFrame(animate);
      }
    };
    
    animate();
  }
  
  easeInOutCubic(t) {
    return t < 0.5 
      ? 4 * t * t * t 
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  
  extractRelevantData(data) {
    return {
      currentPrice: data.currentPrice,
      previousPrice: data.previousPrice,
      priceChange: data.priceChange,
      priceChangePercent: data.priceChangePercent,
      timestamp: data.lastTickTime
    };
  }
  
  updateSettings(newSettings) {
    super.updateSettings(newSettings);
    
    // Clear animation if settings changed
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }
  
  destroy() {
    super.destroy();
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
  }
}

// Static metadata
PriceDisplayIndicator.type = 'priceDisplay';
PriceDisplayIndicator.version = '1.0.0';
PriceDisplayIndicator.description = 'Numeric price display with formatting and change indicators';

export default PriceDisplayIndicator;
