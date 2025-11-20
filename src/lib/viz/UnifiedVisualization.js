/**
 * Unified Visualization Base Class
 *
 * Provides common patterns for all NeuroSense FX visualization components:
 * - DPR-aware rendering for crisp 1px lines
 * - Foundation-first architecture (core + enhancements)
 * - Configuration management with percentage-to-decimal conversion
 * - Bounds checking for performance optimization
 * - Error handling with graceful degradation
 *
 * This extracts the excellent patterns established in dayRangeMeter, priceFloat,
 * and other components while maintaining the "simple" philosophy.
 */

import { boundsUtils, configureTextForDPR } from '../../utils/canvasSizing.js';
import { formatPriceSimple } from '../utils/priceFormatting.js';

export class UnifiedVisualization {
  constructor(componentName) {
    this.componentName = componentName;
  }

  /**
   * Main entry point for all visualization components
   * Follows the established signature: draw[Component](ctx, renderingContext, config, state, y)
   */
  render(ctx, renderingContext, config, state, y) {
    // === GUARD CLAUSES FOR SAFETY (FOUNDATION PATTERN) ===
    if (!this.validateRequiredParameters(ctx, renderingContext, config, state, y)) {
      return false; // Skip render
    }

  
    // === EXTRACT RENDERING CONTEXT ===
    const { contentArea, adrAxisX } = renderingContext;

    // === VALIDATE AND CONFIGURE RENDER DATA ===
    const renderData = this.validateRenderData(contentArea, adrAxisX, config, state);

  
    if (!renderData.shouldRender) {
      console.warn(`[${this.componentName}] Validation failed: ${renderData.error}`);
      return false;
    } else {
      console.log(`✅ [${this.componentName}] Validation passed, rendering...`);
    }

    // === CONFIGURE RENDER CONTEXT FOR CRISP RENDERING ===
    this.configureRenderContext(ctx);

    try {
      // === ALWAYS DRAW CORE ELEMENTS (TRADER REQUIREMENT) ===
      this.drawCore(ctx, renderData, config, state, y);

      // === APPLY BOUNDS CHECKING ONLY TO ENHANCEMENTS (FOUNDATION PATTERN) ===
      this.addEnhancements(ctx, renderData, config, state, contentArea, y);

      return true; // Render successful
    } catch (error) {
      console.error(`[${this.componentName}] Render error:`, error);
      return false;
    } finally {
      // === RESTORE CONTEXT STATE (FOUNDATION PATTERN) ===
      ctx.restore();
    }
  }

  /**
   * Validate required parameters - foundation pattern for safety
   */
  validateRequiredParameters(ctx, renderingContext, config, state, y) {
    if (!ctx || !renderingContext || !config || !state || !y) {
      console.warn(`[${this.componentName}] Missing required parameters, skipping render`);
      return false;
    }

    const { contentArea, adrAxisX } = renderingContext;
    if (!contentArea || !adrAxisX) {
      console.warn(`[${this.componentName}] Invalid renderingContext, skipping render`);
      return false;
    }

    return true;
  }

  /**
   * Configure canvas context for crisp 1px rendering
   * Uses proven DPR-aware patterns from dayRangeMeter.js
   */
  configureRenderContext(ctx) {
    ctx.save();

    // Sub-pixel alignment for crisp 1px lines
    ctx.translate(0.5, 0.5);

    // Disable anti-aliasing for sharp rendering
    ctx.imageSmoothingEnabled = false;

    // Set baseline for consistent text rendering
    ctx.textBaseline = 'middle';
  }

  
  /**
   * Calculate content-relative dimensions
   * Assumes config values are already in decimal format (0.0 to 1.0)
   */
  calculateContentDimensions(contentArea, config, dimensionConfig) {
    const dimensions = {};

    for (const [key, configKey] of Object.entries(dimensionConfig)) {
      const decimalValue = config[configKey] || 0.15; // 15% default as decimal
      dimensions[key] = contentArea.width * decimalValue;
    }

    return dimensions;
  }

  /**
   * Calculate position with content-relative offset
   */
  calculatePosition(contentArea, adrAxisX, config, offsetConfig) {
    const dimensions = this.calculateContentDimensions(contentArea, config, offsetConfig);

    // Calculate start position: center on reference point, then apply offset
    const centeredStartX = adrAxisX - (dimensions.width / 2);
    const startX = centeredStartX + (dimensions.offsetX || 0);

    return {
      ...dimensions,
      startX,
      centeredStartX,
      referenceX: adrAxisX
    };
  }

  /**
   * Check if Y position is within canvas bounds
   * Foundation pattern for performance optimization
   */
  isYInBounds(y, config, contentArea) {
    return boundsUtils.isYInBounds(y, config, { canvasArea: contentArea });
  }

  /**
   * Configure text with DPR-aware sizing
   */
  configureText(ctx, canvasDimensions, textConfig) {
    return configureTextForDPR(ctx, canvasDimensions, {
      baseFontSize: 10,
      fontFamily: 'monospace',
      textAlign: 'center',
      textBaseline: 'middle',
      fillStyle: '#9CA3AF',
      ...textConfig
    });
  }

  /**
   * Validate render data and apply percentage-to-decimal conversion
   * To be implemented by specific components
   */
  validateRenderData(contentArea, adrAxisX, config, state) {
    // Base implementation - components should override this
    return {
      shouldRender: true,
      contentArea,
      adrAxisX,
      config: this.normalizeConfiguration(config)
    };
  }

  /**
   * Normalize configuration values
   * Assumes config values are already in decimal format (0.0 to 1.0)
   */
  normalizeConfiguration(config) {
    // Return config as-is since values should already be in decimal format
    return { ...config };
  }

  /**
   * Draw core elements - always rendered (trader requirement)
   * To be implemented by specific components
   */
  drawCore(ctx, renderData, config, state, y) {
    throw new Error(`drawCore() must be implemented by ${this.componentName}`);
  }

  /**
   * Add enhancements with bounds checking
   * To be implemented by specific components
   */
  addEnhancements(ctx, renderData, config, state, contentArea, y) {
    // Base implementation - components can override for specific enhancements
    // Default: no enhancements
  }

  /**
   * Determine color based on configuration
   * Common pattern for directional coloring
   */
  determineDirectionalColor(config, state, defaultColor, upColor, downColor) {
    if (!config.useDirectionalColor) {
      return defaultColor;
    }

    const { direction } = state;
    switch (direction) {
      case 'up':
        return upColor;
      case 'down':
        return downColor;
      default:
        return defaultColor;
    }
  }

  /**
   * Format price using the optimized central formatting engine
   * Provides consistent asset classification and performance optimization
   */
  formatPrice(price, digits = 5) {
    return formatPriceSimple(price, digits);
  }

  /**
   * Draw crisp 1px line
   * Foundation pattern for perfect line rendering
   */
  drawCrispLine(ctx, x1, y1, x2, y2, color = '#FFFFFF', lineWidth = 1) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  /**
   * Draw text marker with line and label
   * Common pattern for price and percentage markers
   */
  drawMarker(ctx, axisX, y, label, color, side = 'right', options = {}) {
    const {
      markerLength = 12,
      labelOffset = 15,
      lineWidth = 2
    } = options;

    // Draw marker line
    this.drawCrispLine(ctx, axisX - markerLength, y, axisX + markerLength, y, color, lineWidth);

    // Draw label
    ctx.fillStyle = color;
    ctx.textAlign = side === 'right' ? 'left' : 'right';
    const textX = side === 'right' ? axisX + labelOffset : axisX - labelOffset;
    ctx.fillText(label, textX, y + 3);
  }

  /**
   * Apply glow effects
   * Common enhancement pattern
   */
  applyGlowEffect(ctx, color, strength) {
    if (strength > 0) {
      ctx.shadowColor = color;
      ctx.shadowBlur = strength;
    }
  }

  /**
   * Reset glow effects
   */
  resetGlowEffect(ctx) {
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
  }
}

/**
 * Factory function to create visualization components
 * Simplifies component creation and ensures consistent patterns
 */
export function createVisualization(componentName, implementation) {
  console.log(`[UnifiedVisualization] createVisualization called for: ${componentName}`);

  const viz = new UnifiedVisualization(componentName);

  // Override the abstract methods with the component-specific implementation
  Object.assign(viz, implementation);

  // Return the main render function that matches the established signature
  const drawComponent = function drawComponent(ctx, renderingContext, config, state, y) {
    console.log(`[UnifiedVisualization] ${componentName}.render() called`);
    return viz.render(ctx, renderingContext, config, state, y);
  };

  console.log(`[UnifiedVisualization] Created draw function for: ${componentName}`);
  return drawComponent;
}