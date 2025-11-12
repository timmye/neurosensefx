/**
 * Common Enhancement System
 *
 * Provides shared utilities for bounds-checked enhancements across all visualization components.
 * This system ensures consistent enhancement patterns while maintaining performance optimization
 * through intelligent bounds checking.
 *
 * Features:
 * - Unified bounds checking logic
 * - Common enhancement patterns (glow, flash, markers, labels)
 * - Performance optimization through selective rendering
 * - Consistent visual styling across components
 */

import { boundsUtils } from '../../utils/canvasSizing.js';

/**
 * Enhancement Types Registry
 * Central registry for all enhancement types used across components
 */
export const ENHANCEMENT_TYPES = {
  GLOW: 'glow',
  FLASH: 'flash',
  MARKER: 'marker',
  LABEL: 'label',
  INDICATOR: 'indicator',
  OVERLAY: 'overlay'
};

/**
 * Enhancement System - Base class for managing component enhancements
 */
export class EnhancementSystem {
  constructor(componentName) {
    this.componentName = componentName;
    this.activeEnhancements = new Map();
    this.enhancementConfigs = new Map();
  }

  /**
   * Register an enhancement with its configuration
   */
  registerEnhancement(enhancementId, type, config = {}) {
    this.enhancementConfigs.set(enhancementId, {
      type,
      enabled: config.enabled !== false,
      boundsCheck: config.boundsCheck !== false,
      priority: config.priority ?? 0,
      ...config
    });
  }

  /**
   * Enable/disable an enhancement
   */
  setEnhancementEnabled(enhancementId, enabled) {
    const config = this.enhancementConfigs.get(enhancementId);
    if (config) {
      config.enabled = enabled;
    }
  }

  /**
   * Check if an enhancement should be rendered
   */
  shouldRenderEnhancement(enhancementId, renderData, contentArea) {
    const config = this.enhancementConfigs.get(enhancementId);
    if (!config || !config.enabled) {
      return false;
    }

    // Apply bounds checking if required
    if (config.boundsCheck && config.yPosition !== undefined) {
      return boundsUtils.isYInBounds(config.yPosition, renderData.config, { canvasArea: contentArea });
    }

    return true;
  }

  /**
   * Apply glow enhancement
   */
  applyGlow(ctx, x, y, radius, color, strength = 8) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = strength;
    ctx.fillStyle = color + '20'; // Semi-transparent fill
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Apply flash enhancement for alerts
   */
  applyFlash(ctx, contentArea, intensity = 0.8, color = '#FFFFFF') {
    ctx.save();
    ctx.globalAlpha = intensity;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, contentArea.width, contentArea.height);
    ctx.restore();
  }

  /**
   * Draw marker enhancement
   */
  drawMarker(ctx, x, y, label, color, side = 'right', options = {}) {
    const {
      markerLength = 12,
      labelOffset = 15,
      lineWidth = 2,
      fontSize = 10
    } = options;

    ctx.save();

    // Configure text
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = side === 'right' ? 'left' : 'right';
    ctx.textBaseline = 'middle';

    // Draw marker line
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x - markerLength, y);
    ctx.lineTo(x + markerLength, y);
    ctx.stroke();

    // Draw label
    ctx.fillStyle = color;
    const textX = side === 'right' ? x + labelOffset : x - labelOffset;
    ctx.fillText(label, textX, y + 3);

    ctx.restore();
  }

  /**
   * Draw text label with background
   */
  drawLabel(ctx, text, x, y, options = {}) {
    const {
      fontSize = 10,
      fontFamily = 'sans-serif',
      textAlign = 'center',
      textBaseline = 'middle',
      textColor = '#9CA3AF',
      backgroundColor = 'rgba(0, 0, 0, 0.7)',
      padding = 4,
      border = false,
      borderColor = '#4B5563'
    } = options;

    ctx.save();

    // Configure font
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textAlign = textAlign;
    ctx.textBaseline = textBaseline;

    // Measure text
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = fontSize;

    // Calculate background position
    const bgX = x - (textWidth / 2) - padding;
    const bgY = y - (textHeight / 2) - padding;
    const bgWidth = textWidth + (padding * 2);
    const bgHeight = textHeight + (padding * 2);

    // Draw background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(bgX, bgY, bgWidth, bgHeight);

    // Draw border if requested
    if (border) {
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(bgX, bgY, bgWidth, bgHeight);
    }

    // Draw text
    ctx.fillStyle = textColor;
    ctx.fillText(text, x, y);

    ctx.restore();
  }

  /**
   * Draw indicator enhancement (arrows, triangles, etc.)
   */
  drawIndicator(ctx, x, y, type, color, size = 8, direction = 'up') {
    ctx.save();
    ctx.fillStyle = color;

    switch (type) {
      case 'arrow':
        this.drawArrow(ctx, x, y, direction, size);
        break;
      case 'triangle':
        this.drawTriangle(ctx, x, y, direction, size);
        break;
      case 'circle':
        this.drawCircle(ctx, x, y, size);
        break;
      case 'diamond':
        this.drawDiamond(ctx, x, y, size);
        break;
    }

    ctx.restore();
  }

  /**
   * Draw arrow indicator
   */
  drawArrow(ctx, x, y, direction, size) {
    ctx.beginPath();
    switch (direction) {
      case 'up':
        ctx.moveTo(x, y - size);
        ctx.lineTo(x - size/2, y + size/2);
        ctx.lineTo(x + size/2, y + size/2);
        break;
      case 'down':
        ctx.moveTo(x, y + size);
        ctx.lineTo(x - size/2, y - size/2);
        ctx.lineTo(x + size/2, y - size/2);
        break;
      case 'left':
        ctx.moveTo(x - size, y);
        ctx.lineTo(x + size/2, y - size/2);
        ctx.lineTo(x + size/2, y + size/2);
        break;
      case 'right':
        ctx.moveTo(x + size, y);
        ctx.lineTo(x - size/2, y - size/2);
        ctx.lineTo(x - size/2, y + size/2);
        break;
    }
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Draw triangle indicator
   */
  drawTriangle(ctx, x, y, direction, size) {
    ctx.beginPath();
    switch (direction) {
      case 'up':
        ctx.moveTo(x, y - size);
        ctx.lineTo(x - size, y + size);
        ctx.lineTo(x + size, y + size);
        break;
      case 'down':
        ctx.moveTo(x, y + size);
        ctx.lineTo(x - size, y - size);
        ctx.lineTo(x + size, y - size);
        break;
      case 'left':
        ctx.moveTo(x - size, y);
        ctx.lineTo(x + size, y - size);
        ctx.lineTo(x + size, y + size);
        break;
      case 'right':
        ctx.moveTo(x + size, y);
        ctx.lineTo(x - size, y - size);
        ctx.lineTo(x - size, y + size);
        break;
    }
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Draw circle indicator
   */
  drawCircle(ctx, x, y, radius) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Draw diamond indicator
   */
  drawDiamond(ctx, x, y, size) {
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x - size, y);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Apply overlay enhancement
   */
  applyOverlay(ctx, contentArea, overlayFn) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    overlayFn(ctx, contentArea);
    ctx.restore();
  }

  /**
   * Clear all enhancements
   */
  clearEnhancements() {
    this.activeEnhancements.clear();
    this.enhancementConfigs.clear();
  }

  /**
   * Get all enabled enhancements
   */
  getEnabledEnhancements() {
    return Array.from(this.enhancementConfigs.entries())
      .filter(([_, config]) => config.enabled)
      .map(([id, config]) => ({ id, ...config }))
      .sort((a, b) => b.priority - a.priority); // Sort by priority (highest first)
  }
}

/**
 * Common enhancement configurations
 * Predefined enhancement configurations for common use cases
 */
export const COMMON_ENHANCEMENTS = {
  // Glow enhancements
  VOLUME_GLOW: {
    type: ENHANCEMENT_TYPES.GLOW,
    enabled: true,
    boundsCheck: true,
    priority: 1,
    strength: 6,
    color: '#10b981'
  },

  VOLATILITY_GLOW: {
    type: ENHANCEMENT_TYPES.GLOW,
    enabled: true,
    boundsCheck: true,
    priority: 2,
    strength: 8,
    color: '#3b82f6'
  },

  // Flash enhancements
  PRICE_FLASH: {
    type: ENHANCEMENT_TYPES.FLASH,
    enabled: true,
    boundsCheck: true,
    priority: 3,
    intensity: 0.6,
    color: '#FFFFFF',
    threshold: 2.0
  },

  VOLATILITY_FLASH: {
    type: ENHANCEMENT_TYPES.FLASH,
    enabled: true,
    boundsCheck: true,
    priority: 3,
    intensity: 0.8,
    color: '#FFAA00',
    threshold: 3.0
  },

  // Marker enhancements
  PRICE_MARKER: {
    type: ENHANCEMENT_TYPES.MARKER,
    enabled: true,
    boundsCheck: true,
    priority: 4,
    color: '#10B981',
    side: 'right'
  },

  PERCENTAGE_MARKER: {
    type: ENHANCEMENT_TYPES.MARKER,
    enabled: true,
    boundsCheck: true,
    priority: 4,
    color: '#9CA3AF',
    side: 'left'
  },

  // Label enhancements
  VOLUME_LABEL: {
    type: ENHANCEMENT_TYPES.LABEL,
    enabled: true,
    boundsCheck: false, // Fixed position, no bounds check needed
    priority: 5,
    fontSize: 10,
    textColor: '#9CA3AF',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 4
  },

  METRIC_LABEL: {
    type: ENHANCEMENT_TYPES.LABEL,
    enabled: true,
    boundsCheck: false,
    priority: 5,
    fontSize: 10,
    textColor: '#9CA3AF',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 4,
    position: 'bottom-left'
  },

  // Indicator enhancements
  DIRECTION_INDICATOR: {
    type: ENHANCEMENT_TYPES.INDICATOR,
    enabled: true,
    boundsCheck: true,
    priority: 6,
    type: 'arrow',
    size: 6
  },

  ALERT_INDICATOR: {
    type: ENHANCEMENT_TYPES.INDICATOR,
    enabled: true,
    boundsCheck: true,
    priority: 7,
    type: 'triangle',
    size: 8,
    color: '#EF4444'
  }
};

/**
 * Factory function to create enhancement systems for components
 */
export function createEnhancementSystem(componentName, enhancements = {}) {
  const system = new EnhancementSystem(componentName);

  // Register default enhancements
  Object.entries(enhancements).forEach(([id, config]) => {
    system.registerEnhancement(id, config.type, config);
  });

  return system;
}

/**
 * Utility functions for common enhancement patterns
 */
export const EnhancementUtils = {
  /**
   * Check if value exceeds threshold for flash enhancement
   */
  shouldFlash(value, threshold = 2.0) {
    return Math.abs(value) >= threshold;
  },

  /**
   * Calculate enhancement color based on direction
   */
  getDirectionalColor(direction, upColor = '#10b981', downColor = '#ef4444', defaultColor = '#9CA3AF') {
    switch (direction) {
      case 'up':
        return upColor;
      case 'down':
        return downColor;
      default:
        return defaultColor;
    }
  },

  /**
   * Calculate intensity-based color interpolation
   */
  getIntensityColor(intensity, minColor = '#10b981', maxColor = '#ef4444') {
    const clampedIntensity = Math.max(0, Math.min(1, intensity));
    return interpolateColor(minColor, maxColor, clampedIntensity);
  },

  /**
   * Apply fade-in/fade-out animation to enhancement
   */
  animateEnhancement(ctx, x, y, renderFn, time, duration = 1000) {
    const progress = (time % duration) / duration;
    const alpha = Math.sin(progress * Math.PI); // Smooth fade in/out

    ctx.save();
    ctx.globalAlpha = alpha;
    renderFn(ctx, x, y);
    ctx.restore();
  }
};

/**
 * Interpolate between two colors
 */
function interpolateColor(color1, color2, intensity) {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  if (!rgb1 || !rgb2) return color1;

  const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * intensity);
  const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * intensity);
  const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * intensity);

  return `rgb(${r},${g},${b})`;
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}