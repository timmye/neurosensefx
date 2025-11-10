/**
 * Unified Volatility Orb Implementation
 *
 * Refactored to use UnifiedVisualization base class and UnifiedConfig for consistency.
 * Maintains all existing functionality while standardizing patterns across components.
 *
 * Features:
 * - DPR-aware crisp rendering via UnifiedVisualization
 * - Background element positioning with configurable positioning
 * - Multi-mode visualization (directional, static, intensity)
 * - Performance optimization for 60fps with 20+ displays
 * - Comprehensive error handling with graceful fallbacks
 * - Alert system integration with flash mechanisms
 */

import { UnifiedVisualization, createVisualization } from './UnifiedVisualization.js';

/**
 * Volatility Orb implementation using the unified foundation patterns
 */
const volatilityOrbImplementation = {
  /**
   * Validate render data specific to volatility orb
   */
  validateRenderData(contentArea, adrAxisX, config, state) {
    // Early exit for performance
    if (!config.showVolatilityOrb) {
      return { shouldRender: false, error: 'Volatility orb disabled' };
    }

    // Validate essential data
    const { volatility, currentPrice } = state;
    if (currentPrice === undefined || currentPrice === null || volatility === undefined || volatility === null) {
      return { shouldRender: false, error: 'Missing essential data' };
    }

    // Calculate orb dimensions using simplified decimal format
    const baseWidthPercentage = config.volatilityOrbBaseWidth || 0.91;
    const sizeMultiplier = config.volatilitySizeMultiplier || 1.5;

    // Use max canvas dimension for responsive scaling
    const maxDimension = Math.max(contentArea.width, contentArea.height);
    const orbBaseWidth = maxDimension * baseWidthPercentage;

    // Calculate orb position based on positioning mode
    let orbX;
    switch (config.volatilityOrbPositionMode) {
      case 'canvasCenter':
        orbX = contentArea.width / 2;
        break;
      case 'adrAxis':
      default:
        orbX = adrAxisX;
        break;
    }

    // Apply X offset if configured
    if (config.volatilityOrbXOffset) {
      const xOffset = config.volatilityOrbXOffset;
      orbX += contentArea.width * xOffset;
    }

    return {
      shouldRender: true,
      orbBaseWidth,
      orbX,
      maxDimension,
      sizeMultiplier,
      contentArea,
      adrAxisX
    };
  },

  /**
   * Draw core volatility orb element
   */
  drawCore(ctx, renderData, config, state, y) {
    const { volatility, currentPrice, lastTickDirection } = state;

    // Process volatility data
    const orbData = this.processVolatilityData(volatility, currentPrice, lastTickDirection, y);
    if (!orbData.isValid) {
      console.warn('[VolatilityOrb] Invalid volatility data, skipping render');
      return;
    }

    // Draw the orb
    this.drawVolatilityOrbCore(ctx, renderData, orbData, config);

    // Store orb data for enhancements
    this._orbData = orbData;
  },

  /**
   * Add enhancements with bounds checking
   */
  addEnhancements(ctx, renderData, config, state, contentArea, y) {
    const orbData = this._orbData;
    if (!orbData) return;

    // Draw volatility metric (core information, no bounds checking needed)
    if (config.showVolatilityMetric) {
      this.drawVolatilityMetric(ctx, renderData, orbData, config, contentArea);
    }

    // Flash effects with bounds checking (enhancement)
    if (config.showOrbFlash && this.shouldFlash(state, config)) {
      if (this.isYInBounds(orbData.priceY, config, contentArea)) {
        this.applyVolatilityFlash(ctx, renderData, config);
      }
    }
  },

  /**
   * Process volatility data with validation
   */
  processVolatilityData(volatility, currentPrice, lastTickDirection, y) {
    const safeVolatility = volatility || 0;
    const safePrice = currentPrice || 0;
    const safeDirection = lastTickDirection || 'up';

    const priceY = y(safePrice);
    const isValid = safeVolatility >= 0 && safePrice > 0 && !isNaN(priceY);

    return {
      volatility: safeVolatility,
      priceY,
      direction: safeDirection,
      isValid
    };
  },

  /**
   * Draw core volatility orb with cognitive-aware background positioning
   */
  drawVolatilityOrbCore(ctx, renderData, orbData, config) {
    const { orbX, sizeMultiplier } = renderData;
    const { volatility, priceY } = orbData;

    // Calculate orb dimensions
    const { orbRadius } = this.calculateOrbDimensions(renderData.orbBaseWidth, volatility, sizeMultiplier);

    // Determine color based on mode
    const orbColor = this.calculateVolatilityColor(orbData, config);

    // Create gradient with appropriate transparency for background rendering
    const gradient = ctx.createRadialGradient(orbX, priceY, 0, orbX, priceY, orbRadius);
    gradient.addColorStop(0, orbColor + '40'); // 40% opacity at center
    gradient.addColorStop(0.5, orbColor + '20'); // 20% opacity
    gradient.addColorStop(1, orbColor + '00'); // Fully transparent at edges

    // Draw background orb
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(orbX, priceY, orbRadius, 0, 2 * Math.PI);
    ctx.fill();

    // Apply glow effect for foreground mode
    if (!config.volatilityOrbBackgroundMode) {
      this.applyGlowEffect(ctx, orbX, priceY, orbRadius, orbColor, config);
    }
  },

  /**
   * Calculate orb dimensions with content-relative sizing
   */
  calculateOrbDimensions(orbBaseWidth, volatility, sizeMultiplier) {
    const volatilityScale = Math.min(2.0, volatility * 0.8);
    const orbRadius = (orbBaseWidth / 2) * volatilityScale * sizeMultiplier;

    return {
      orbRadius: Math.max(3, orbRadius) // Minimum 3px for visibility
    };
  },

  /**
   * Calculate volatility color based on visualization mode
   */
  calculateVolatilityColor(orbData, config) {
    const { volatility, direction } = orbData;
    const { volatilityColorMode } = config;

    switch (volatilityColorMode) {
      case 'directional':
        return direction === 'up'
          ? (config.priceUpColor || '#3b82f6')
          : (config.priceDownColor || '#ef4444');

      case 'static':
        return config.priceStaticColor || '#d1d5db';

      case 'intensity':
        const intensity = Math.min(1.0, volatility / 2.0);
        return this.interpolateColor('#10b981', '#ef4444', intensity);

      default:
        return config.priceStaticColor || '#d1d5db';
    }
  },

  /**
   * Apply glow effect with environmental adaptation
   */
  applyGlowEffect(ctx, orbX, orbY, orbRadius, orbColor, config) {
    if (config.volatilityOrbBackgroundMode === 'background') {
      return;
    }

    const glowStrength = 8;

    // Apply brightness inversion if configured
    let finalGlowColor = orbColor;
    if (config.volatilityOrbInvertBrightness) {
      finalGlowColor = this.invertColorBrightness(orbColor);
    }

    // Apply glow effect
    ctx.shadowColor = finalGlowColor;
    ctx.shadowBlur = glowStrength;
    ctx.fillStyle = orbColor + '20';
    ctx.beginPath();
    ctx.arc(orbX, orbY, orbRadius, 0, 2 * Math.PI);
    ctx.fill();
    this.resetGlowEffect(ctx);
  },

  /**
   * Draw volatility metric with fixed positioning
   */
  drawVolatilityMetric(ctx, renderData, orbData, config, contentArea) {
    const { volatility } = orbData;

    ctx.save();

    // Use consistent font styling
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const volatilityText = `σ: ${volatility.toFixed(1)}`;
    const textMetrics = ctx.measureText(volatilityText);

    // Fixed positioning to bottom left of canvas
    const fixedTextX = 20;
    const fixedTextY = contentArea.height - 15;

    // Draw text background if configured
    if (config.priceDisplayPadding > 0) {
      const padding = config.priceDisplayPadding;
      const bgX = fixedTextX - padding;
      const bgY = fixedTextY - 5 - padding;
      const bgWidth = textMetrics.width + (padding * 2);
      const bgHeight = 10 + (padding * 2);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
    }

    // Use consistent grey color matching other components
    ctx.fillStyle = '#9CA3AF';
    ctx.fillText(volatilityText, fixedTextX, fixedTextY);

    ctx.restore();
  },

  /**
   * Check if flash should be triggered
   */
  shouldFlash(state, config) {
    if (!config.showOrbFlash) return false;

    const priceChange = Math.abs(state.tickDelta || 0);
    const threshold = config.orbFlashThreshold || 2.0;

    return priceChange >= threshold;
  },

  /**
   * Apply volatility flash for significant market events
   */
  applyVolatilityFlash(ctx, renderData, config) {
    const intensity = config.orbFlashIntensity || 0.8;

    ctx.save();

    ctx.globalAlpha = intensity;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, renderData.orbBaseWidth * 2, renderData.orbBaseWidth * 2);

    ctx.restore();
  },

  /**
   * Interpolate between two colors for intensity visualization
   */
  interpolateColor(color1, color2, intensity) {
    const rgb1 = this.hexToRgb(color1);
    const rgb2 = this.hexToRgb(color2);

    if (!rgb1 || !rgb2) return color1;

    const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * intensity);
    const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * intensity);
    const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * intensity);

    return `rgb(${r},${g},${b})`;
  },

  /**
   * Invert color brightness for environmental adaptation
   */
  invertColorBrightness(color) {
    const rgb = this.hexToRgb(color);
    if (!rgb) return color;

    const brightness = (rgb.r + rgb.g + rgb.b) / 3;
    const factor = brightness > 128 ? 0.5 : 2;

    const r = Math.min(255, rgb.r * factor);
    const g = Math.min(255, rgb.g * factor);
    const b = Math.min(255, rgb.b * factor);

    return `rgb(${r},${g},${b})`;
  },

  /**
   * Helper function to convert hex to RGB
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }
};

// Create the unified visualization component
export const drawVolatilityOrb = createVisualization('VolatilityOrb', volatilityOrbImplementation);

