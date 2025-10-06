import BaseIndicator from './BaseIndicator.js';

/**
 * Market Profile Indicator
 * Renders price distribution over time as a horizontal profile
 */
export class MarketProfileIndicator extends BaseIndicator {
  get defaultSettings() {
    return {
      ...super.defaultSettings,
      width: 1.0,
      opacity: 0.7,
      showOutline: true,
      colorScheme: 'default',
      barWidth: 2,
      showValueArea: true,
      valueAreaPercentage: 70,
      showPoc: true,
      animationSpeed: 'medium'
    };
  }
  
  doRender(data, canvas) {
    const { priceHistory, visualHigh, visualLow, currentPrice } = data;
    const { width, height } = canvas;
    
    if (!priceHistory || priceHistory.length === 0) {
      return { imageData: null };
    }
    
    // Calculate price distribution
    const distribution = this.calculatePriceDistribution(priceHistory, visualHigh, visualLow);
    
    // Find maximum frequency for scaling
    const maxFrequency = Math.max(...Object.values(distribution));
    
    // Draw the profile bars
    this.drawProfileBars(distribution, maxFrequency, width, height, visualHigh, visualLow);
    
    // Draw value area if enabled
    if (this.settings.showValueArea) {
      this.drawValueArea(distribution, maxFrequency, width, height, visualHigh, visualLow);
    }
    
    // Draw POC if enabled
    if (this.settings.showPoc) {
      this.drawPoc(distribution, width, height, visualHigh, visualLow);
    }
    
    // Draw outline if enabled
    if (this.settings.showOutline) {
      this.drawOutline(distribution, maxFrequency, width, height, visualHigh, visualLow);
    }
    
    return {
      imageData: this.ctx.getImageData(0, 0, width, height),
      distribution,
      maxFrequency
    };
  }
  
  calculatePriceDistribution(priceHistory, visualHigh, visualLow) {
    const distribution = {};
    const priceRange = visualHigh - visualLow;
    const bucketSize = priceRange / 50; // 50 price levels
    
    priceHistory.forEach(price => {
      if (price < visualLow || price > visualHigh) return;
      
      const bucketIndex = Math.floor((price - visualLow) / bucketSize);
      const bucketPrice = visualLow + (bucketIndex * bucketSize);
      
      distribution[bucketPrice] = (distribution[bucketPrice] || 0) + 1;
    });
    
    return distribution;
  }
  
  drawProfileBars(distribution, maxFrequency, canvasWidth, canvasHeight, visualHigh, visualLow) {
    const barWidth = this.settings.barWidth;
    const maxBarWidth = canvasWidth * 0.8; // Use 80% of canvas width
    const priceRange = visualHigh - visualLow;
    
    Object.entries(distribution).forEach(([price, frequency]) => {
      const barHeight = (frequency / maxFrequency) * maxBarWidth;
      const y = canvasHeight - ((price - visualLow) / priceRange) * canvasHeight;
      const x = canvasWidth - barHeight;
      
      // Get color based on frequency
      const color = this.getProfileColor(frequency, maxFrequency);
      
      this.drawRectangle(x, y - barWidth / 2, barHeight, barWidth, {
        fill: true,
        fillColor: color
      });
    });
  }
  
  drawValueArea(distribution, maxFrequency, canvasWidth, canvasHeight, visualHigh, visualLow) {
    const sortedPrices = Object.keys(distribution)
      .map(Number)
      .sort((a, b) => a - b);
    
    const totalVolume = Object.values(distribution).reduce((sum, freq) => sum + freq, 0);
    const targetVolume = totalVolume * (this.settings.valueAreaPercentage / 100);
    
    // Find POC (Point of Control) - price with highest frequency
    const pocPrice = sortedPrices.reduce((poc, price) => 
      distribution[price] > distribution[poc] ? price : poc
    );
    
    // Build value area around POC
    let valueAreaHigh = pocPrice;
    let valueAreaLow = pocPrice;
    let volumeInArea = distribution[pocPrice];
    
    // Expand outward from POC
    let highIndex = sortedPrices.indexOf(pocPrice) + 1;
    let lowIndex = sortedPrices.indexOf(pocPrice) - 1;
    
    while (volumeInArea < targetVolume && (highIndex < sortedPrices.length || lowIndex >= 0)) {
      let addedVolume = 0;
      
      if (highIndex < sortedPrices.length && lowIndex >= 0) {
        const highFreq = distribution[sortedPrices[highIndex]];
        const lowFreq = distribution[sortedPrices[lowIndex]];
        
        if (highFreq >= lowFreq) {
          addedVolume = highFreq;
          valueAreaHigh = sortedPrices[highIndex];
          highIndex++;
        } else {
          addedVolume = lowFreq;
          valueAreaLow = sortedPrices[lowIndex];
          lowIndex--;
        }
      } else if (highIndex < sortedPrices.length) {
        addedVolume = distribution[sortedPrices[highIndex]];
        valueAreaHigh = sortedPrices[highIndex];
        highIndex++;
      } else if (lowIndex >= 0) {
        addedVolume = distribution[sortedPrices[lowIndex]];
        valueAreaLow = sortedPrices[lowIndex];
        lowIndex--;
      }
      
      volumeInArea += addedVolume;
    }
    
    // Draw value area background
    const priceRange = visualHigh - visualLow;
    const yHigh = canvasHeight - ((valueAreaHigh - visualLow) / priceRange) * canvasHeight;
    const yLow = canvasHeight - ((valueAreaLow - visualLow) / priceRange) * canvasHeight;
    
    this.drawRectangle(0, yLow, canvasWidth, yHigh - yLow, {
      fill: true,
      fillColor: 'rgba(59, 130, 246, 0.1)'
    });
  }
  
  drawPoc(distribution, canvasWidth, canvasHeight, visualHigh, visualLow) {
    const pocPrice = Object.keys(distribution)
      .reduce((poc, price) => 
        distribution[price] > distribution[poc] ? price : poc
      );
    
    const priceRange = visualHigh - visualLow;
    const y = canvasHeight - ((pocPrice - visualLow) / priceRange) * canvasHeight;
    
    // Draw POC line
    this.ctx.strokeStyle = '#ef4444';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    
    this.ctx.beginPath();
    this.ctx.moveTo(0, y);
    this.ctx.lineTo(canvasWidth, y);
    this.ctx.stroke();
    
    this.ctx.setLineDash([]);
    
    // Draw POC label
    this.drawText('POC', 5, y - 5, {
      font: '10px monospace',
      color: '#ef4444',
      align: 'left',
      baseline: 'bottom'
    });
  }
  
  drawOutline(distribution, maxFrequency, canvasWidth, canvasHeight, visualHigh, visualLow) {
    const sortedPrices = Object.keys(distribution)
      .map(Number)
      .sort((a, b) => a - b);
    
    const maxBarWidth = canvasWidth * 0.8;
    const priceRange = visualHigh - visualLow;
    
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    
    sortedPrices.forEach((price, index) => {
      const frequency = distribution[price];
      const barHeight = (frequency / maxFrequency) * maxBarWidth;
      const y = canvasHeight - ((price - visualLow) / priceRange) * canvasHeight;
      const x = canvasWidth - barHeight;
      
      if (index === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    });
    
    this.ctx.stroke();
  }
  
  getProfileColor(frequency, maxFrequency) {
    const intensity = frequency / maxFrequency;
    const colors = this.getColorScheme();
    
    if (intensity > 0.8) {
      return colors.high;
    } else if (intensity > 0.5) {
      return colors.medium;
    } else {
      return colors.low;
    }
  }
  
  getColorScheme() {
    const schemes = {
      default: {
        low: 'rgba(34, 197, 94, 0.6)',
        medium: 'rgba(59, 130, 246, 0.7)',
        high: 'rgba(168, 85, 247, 0.8)'
      },
      heat: {
        low: 'rgba(251, 146, 60, 0.6)',
        medium: 'rgba(239, 68, 68, 0.7)',
        high: 'rgba(127, 29, 29, 0.8)'
      },
      ocean: {
        low: 'rgba(6, 182, 212, 0.6)',
        medium: 'rgba(59, 130, 246, 0.7)',
        high: 'rgba(30, 64, 175, 0.8)'
      },
      forest: {
        low: 'rgba(134, 239, 172, 0.6)',
        medium: 'rgba(34, 197, 94, 0.7)',
        high: 'rgba(21, 128, 61, 0.8)'
      }
    };
    
    return schemes[this.settings.colorScheme] || schemes.default;
  }
  
  extractRelevantData(data) {
    return {
      priceHistory: data.priceHistory?.slice(-100), // Last 100 prices
      visualHigh: data.visualHigh,
      visualLow: data.visualLow,
      currentPrice: data.currentPrice,
      timestamp: data.lastTickTime
    };
  }
}

// Static metadata
MarketProfileIndicator.type = 'marketProfile';
MarketProfileIndicator.version = '1.0.0';
MarketProfileIndicator.description = 'Price distribution over time with value area and POC';

export default MarketProfileIndicator;
