import BaseIndicator from './BaseIndicator.js';

/**
 * Volatility Orb Indicator
 * Renders a circular visualization of market volatility
 */
export class VolatilityOrbIndicator extends BaseIndicator {
  get defaultSettings() {
    return {
      ...super.defaultSettings,
      baseWidth: 200,
      colorMode: 'directional',
      showMetric: true,
      animationSpeed: 'medium',
      segments: 12,
      innerRadius: 0.3,
      outerRadius: 0.9,
      glowIntensity: 0.8,
      pulseEnabled: true,
      showLabels: false
    };
  }
  
  doRender(data, canvas) {
    const { currentPrice, priceHistory, volatility, priceChange } = data;
    const { width, height } = canvas;
    
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) * this.settings.outerRadius / 2;
    const minRadius = maxRadius * this.settings.innerRadius;
    
    // Calculate volatility metrics
    const volatilityMetrics = this.calculateVolatilityMetrics(priceHistory, currentPrice);
    
    // Draw the orb segments
    this.drawOrbSegments(centerX, centerY, minRadius, maxRadius, volatilityMetrics, priceChange);
    
    // Draw center circle
    this.drawCenterCircle(centerX, centerY, minRadius, volatilityMetrics);
    
    // Draw metric if enabled
    if (this.settings.showMetric) {
      this.drawVolatilityMetric(centerX, centerY, volatilityMetrics);
    }
    
    // Draw labels if enabled
    if (this.settings.showLabels) {
      this.drawLabels(centerX, centerY, maxRadius);
    }
    
    return {
      imageData: this.ctx.getImageData(0, 0, width, height),
      volatilityMetrics,
      center: { x: centerX, y: centerY }
    };
  }
  
  calculateVolatilityMetrics(priceHistory, currentPrice) {
    if (!priceHistory || priceHistory.length < 2) {
      return {
        volatility: 0,
        averageVolatility: 0,
        volatilityPercentile: 0,
        trend: 'neutral',
        momentum: 0
      };
    }
    
    // Calculate price changes
    const priceChanges = [];
    for (let i = 1; i < priceHistory.length; i++) {
      priceChanges.push(priceHistory[i] - priceHistory[i - 1]);
    }
    
    // Calculate standard deviation (volatility)
    const mean = priceChanges.reduce((sum, change) => sum + change, 0) / priceChanges.length;
    const variance = priceChanges.reduce((sum, change) => sum + Math.pow(change - mean, 2), 0) / priceChanges.length;
    const volatility = Math.sqrt(variance);
    
    // Calculate average volatility
    const averageVolatility = volatility / currentPrice * 100;
    
    // Calculate recent momentum
    const recentChanges = priceChanges.slice(-10);
    const momentum = recentChanges.reduce((sum, change) => sum + change, 0) / recentChanges.length;
    
    // Determine trend
    let trend = 'neutral';
    if (momentum > 0.0001) trend = 'bullish';
    else if (momentum < -0.0001) trend = 'bearish';
    
    return {
      volatility,
      averageVolatility,
      volatilityPercentile: Math.min(averageVolatility * 10, 100), // Scale to 0-100
      trend,
      momentum,
      priceChanges: priceChanges.slice(-this.settings.segments)
    };
  }
  
  drawOrbSegments(centerX, centerY, minRadius, maxRadius, volatilityMetrics, priceChange) {
    const segments = this.settings.segments;
    const angleStep = (Math.PI * 2) / segments;
    
    volatilityMetrics.priceChanges.forEach((change, index) => {
      const startAngle = index * angleStep - Math.PI / 2;
      const endAngle = (index + 1) * angleStep - Math.PI / 2;
      
      // Calculate segment properties based on price change
      const intensity = Math.abs(change) / volatilityMetrics.volatility || 0;
      const isPositive = change >= 0;
      
      // Calculate segment radius based on intensity
      const segmentRadius = minRadius + (maxRadius - minRadius) * intensity;
      
      // Get color based on color mode and direction
      const color = this.getSegmentColor(intensity, isPositive, volatilityMetrics.trend);
      
      // Draw segment
      this.drawSegment(centerX, centerY, minRadius, segmentRadius, startAngle, endAngle, color);
      
      // Add glow effect for high volatility
      if (intensity > 0.7 && this.settings.glowIntensity > 0) {
        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = 10 * this.settings.glowIntensity;
        this.drawSegment(centerX, centerY, minRadius, segmentRadius, startAngle, endAngle, color);
        this.ctx.shadowBlur = 0;
      }
    });
  }
  
  drawSegment(centerX, centerY, innerRadius, outerRadius, startAngle, endAngle, color) {
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
    this.ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
    this.ctx.closePath();
    
    this.ctx.fillStyle = color;
    this.ctx.fill();
    
    // Add subtle border
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    this.ctx.lineWidth = 0.5;
    this.ctx.stroke();
  }
  
  drawCenterCircle(centerX, centerY, radius, volatilityMetrics) {
    // Draw filled center
    const gradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    
    if (this.settings.colorMode === 'directional') {
      if (volatilityMetrics.trend === 'bullish') {
        gradient.addColorStop(0, 'rgba(34, 197, 94, 0.8)');
        gradient.addColorStop(1, 'rgba(34, 197, 94, 0.2)');
      } else if (volatilityMetrics.trend === 'bearish') {
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0.8)');
        gradient.addColorStop(1, 'rgba(239, 68, 68, 0.2)');
      } else {
        gradient.addColorStop(0, 'rgba(156, 163, 175, 0.8)');
        gradient.addColorStop(1, 'rgba(156, 163, 175, 0.2)');
      }
    } else {
      gradient.addColorStop(0, 'rgba(168, 85, 247, 0.8)');
      gradient.addColorStop(1, 'rgba(168, 85, 247, 0.2)');
    }
    
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    this.ctx.fillStyle = gradient;
    this.ctx.fill();
    
    // Add pulse effect if enabled
    if (this.settings.pulseEnabled && volatilityMetrics.volatilityPercentile > 50) {
      const pulseRadius = radius * (1 + 0.1 * Math.sin(Date.now() / 200));
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
      this.ctx.strokeStyle = `rgba(168, 85, 247, ${0.3 * (volatilityMetrics.volatilityPercentile / 100)})`;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }
  }
  
  drawVolatilityMetric(centerX, centerY, volatilityMetrics) {
    const volatilityText = `${volatilityMetrics.averageVolatility.toFixed(2)}%`;
    
    // Draw volatility percentage
    this.drawText(volatilityText, centerX, centerY, {
      font: 'bold 14px monospace',
      color: '#ffffff',
      align: 'center',
      baseline: 'middle',
      shadow: true,
      shadowColor: 'rgba(0, 0, 0, 0.8)',
      shadowBlur: 4
    });
    
    // Draw trend indicator
    if (volatilityMetrics.trend !== 'neutral') {
      const trendSymbol = volatilityMetrics.trend === 'bullish' ? '▲' : '▼';
      const trendColor = volatilityMetrics.trend === 'bullish' ? '#22c55e' : '#ef4444';
      
      this.drawText(trendSymbol, centerX, centerY - 20, {
        font: '12px sans-serif',
        color: trendColor,
        align: 'center',
        baseline: 'middle'
      });
    }
  }
  
  drawLabels(centerX, centerY, radius) {
    const segments = this.settings.segments;
    const angleStep = (Math.PI * 2) / segments;
    const labelRadius = radius + 15;
    
    // Draw time labels
    const timeLabels = ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
    
    timeLabels.forEach((label, index) => {
      const angle = index * angleStep - Math.PI / 2;
      const x = centerX + Math.cos(angle) * labelRadius;
      const y = centerY + Math.sin(angle) * labelRadius;
      
      this.drawText(label, x, y, {
        font: '10px sans-serif',
        color: 'rgba(255, 255, 255, 0.6)',
        align: 'center',
        baseline: 'middle'
      });
    });
  }
  
  getSegmentColor(intensity, isPositive, trend) {
    const alpha = 0.3 + (intensity * 0.7); // Alpha based on intensity
    
    if (this.settings.colorMode === 'directional') {
      if (trend === 'bullish') {
        return `rgba(34, 197, 94, ${alpha})`;
      } else if (trend === 'bearish') {
        return `rgba(239, 68, 68, ${alpha})`;
      } else {
        return `rgba(156, 163, 175, ${alpha})`;
      }
    } else if (this.settings.colorMode === 'intensity') {
      // Color based on intensity (heat map)
      if (intensity > 0.8) {
        return `rgba(239, 68, 68, ${alpha})`;
      } else if (intensity > 0.5) {
        return `rgba(251, 146, 60, ${alpha})`;
      } else if (intensity > 0.3) {
        return `rgba(250, 204, 21, ${alpha})`;
      } else {
        return `rgba(34, 197, 94, ${alpha})`;
      }
    } else {
      // Default purple theme
      return `rgba(168, 85, 247, ${alpha})`;
    }
  }
  
  extractRelevantData(data) {
    return {
      currentPrice: data.currentPrice,
      priceHistory: data.priceHistory?.slice(-50), // Last 50 prices
      volatility: data.volatility,
      priceChange: data.priceChange,
      timestamp: data.lastTickTime
    };
  }
  
  handleResize(newCanvas) {
    super.handleResize(newCanvas);
    // Recalculate base width based on new canvas size
    this.settings.baseWidth = Math.min(newCanvas.width, newCanvas.height) * 0.8;
  }
}

// Static metadata
VolatilityOrbIndicator.type = 'volatilityOrb';
VolatilityOrbIndicator.version = '1.0.0';
VolatilityOrbIndicator.description = 'Circular volatility visualization with directional coloring';

export default VolatilityOrbIndicator;
