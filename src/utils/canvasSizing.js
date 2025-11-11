/**
 * Unified Canvas Sizing Utility
 * 
 * Provides single source of truth for canvas dimensions across all components.
 * Eliminates dual sizing approaches causing conflicts between Container.svelte
 * and FloatingDisplay.svelte.
 * 
 * Reference canvas: 220×120px (standard NeuroSense FX display size)
 */

// Reference canvas dimensions (industry standard for NeuroSense FX)
export const REFERENCE_CANVAS = {
  width: 220,
  height: 120
};

// Default container dimensions (include padding and header)
export const DEFAULT_CONTAINER = {
  width: 240,  // 220px canvas + 20px padding
  height: 160   // 120px canvas + 40px header
};

// Device pixel ratio handling with zoom awareness
export const getDevicePixelRatio = () => {
  return window.devicePixelRatio || 1;
};

/**
 * Create a zoom detector for dynamic DPR monitoring
 * @param {Function} callback - Function called when DPR changes
 * @returns {Function} Cleanup function to remove event listeners
 */
export function createZoomDetector(callback) {
  let currentDpr = window.devicePixelRatio || 1;
  
  const checkZoom = () => {
    const newDpr = window.devicePixelRatio || 1;
    if (newDpr !== currentDpr) {
      currentDpr = newDpr;
      callback(newDpr);
    }
  };

  // Listen for zoom indicators
  window.addEventListener('resize', checkZoom, { passive: true });
  window.addEventListener('wheel', checkZoom, { passive: true });

  // Check periodically for smooth zoom detection (reduced frequency)
  const interval = setInterval(checkZoom, 500);

  // Return cleanup function
  return () => {
    window.removeEventListener('resize', checkZoom);
    window.removeEventListener('wheel', checkZoom);
    clearInterval(interval);
  };
}

/**
 * Calculate canvas dimensions based on container size and reference canvas
 * @param {Object} containerSize - Container dimensions {width, height}
 * @param {Object} options - Configuration options
 * @returns {Object} Canvas sizing information
 */
export function getCanvasDimensions(containerSize, options = {}) {
  const {
    includeHeader = true,
    padding = 20,
    headerHeight = 40,
    respectDpr = true
  } = options;

  // Calculate available canvas area within container
  const canvasArea = {
    width: containerSize.width - (padding * 2),
    height: containerSize.height - (includeHeader ? headerHeight + padding : padding)
  };

  // Calculate scaling factors relative to reference canvas
  const scale = {
    x: canvasArea.width / REFERENCE_CANVAS.width,
    y: canvasArea.height / REFERENCE_CANVAS.height
  };

  // Apply device pixel ratio if requested
  const dpr = respectDpr ? getDevicePixelRatio() : 1;

  // 🔧 FIX: Use Math.round() for pixel-perfect integer dimensions
  const dprMultiplier = respectDpr ? dpr : 1;
  const integerCanvasWidth = Math.round(canvasArea.width * dprMultiplier);
  const integerCanvasHeight = Math.round(canvasArea.height * dprMultiplier);

  return {
    // Reference information
    reference: REFERENCE_CANVAS,
    
    // Container and canvas area dimensions
    container: containerSize,
    canvasArea,
    
    // Scaling factors
    scale,
    
    // Final canvas dimensions (with DPR applied if requested)
    canvas: {
      width: integerCanvasWidth,
      height: integerCanvasHeight,
      cssWidth: integerCanvasWidth / dprMultiplier, // Ensure CSS matches canvas internal dimensions
      cssHeight: integerCanvasHeight / dprMultiplier
    },
    
    // Device pixel ratio information
    dpr,
    
    // Utility functions for this canvas
    transforms: {
      cssToCanvas: (cssPos) => ({
        x: cssPos.x * (respectDpr ? dpr : 1),
        y: cssPos.y * (respectDpr ? dpr : 1)
      }),
      canvasToCss: (canvasPos) => ({
        x: canvasPos.x / (respectDpr ? dpr : 1),
        y: canvasPos.y / (respectDpr ? dpr : 1)
      })
    }
  };
}

/**
 * Normalize configuration values to absolute pixels
 * @param {Object} config - Configuration object with percentage/absolute values
 * @param {Object} canvasDimensions - Canvas dimensions from getCanvasDimensions
 * @returns {Object} Normalized configuration with absolute pixel values
 */
export function normalizeConfig(config, canvasDimensions) {
  if (!config) return {};

  const { canvasArea } = canvasDimensions;
  
  // Helper function to determine if value is percentage (≤200) or absolute (>200)
  const isPercentage = (value) => {
    return typeof value === 'number' && value <= 200;
  };

  // Helper function to convert percentage to pixels
  // Smart conversion: handles both decimal (≤1) and percentage (>1) values
  const percentageToPixels = (value, reference) => {
    if (value <= 1) {
      // Already in decimal format (0.15 = 15%)
      return value * reference;
    } else {
      // Old percentage format (15 = 15%)
      return (value / 100) * reference;
    }
  };

  return {
    // Layout dimensions - handle both percentage and absolute values
    visualizationsContentWidth: isPercentage(config.visualizationsContentWidth)
      ? percentageToPixels(config.visualizationsContentWidth, canvasArea.width)
      : config.visualizationsContentWidth || canvasArea.width,
    
    meterHeight: isPercentage(config.meterHeight)
      ? percentageToPixels(config.meterHeight, canvasArea.height)
      : config.meterHeight || canvasArea.height,
    
    // Position-based values (always percentage-based)
    centralAxisXPosition: config.centralAxisXPosition 
      ? percentageToPixels(config.centralAxisXPosition, canvasArea.width)
      : canvasArea.width / 2,
    
    // NEW: ADR axis positioning with default to 30% right of center (65% of container width)
    adrAxisXPosition: config.adrAxisXPosition 
      ? config.adrAxisXPosition 
      : canvasArea.width * 0.65, // Default: 30% right of center
    
    // Size-based values (always percentage-based)
    priceFloatWidth: config.priceFloatWidth
      ? percentageToPixels(config.priceFloatWidth, canvasArea.width)
      : canvasArea.width * 0.15,
    
    priceFloatHeight: config.priceFloatHeight
      ? percentageToPixels(config.priceFloatHeight, canvasArea.height)
      : canvasArea.height * 0.02,
    
    priceFloatXOffset: config.priceFloatXOffset
      ? percentageToPixels(config.priceFloatXOffset, canvasArea.width)
      : 0,
    
    priceFontSize: config.priceFontSize
      ? percentageToPixels(config.priceFontSize, canvasArea.height)
      : canvasArea.height * 0.08,
    
    priceHorizontalOffset: config.priceHorizontalOffset
      ? percentageToPixels(config.priceHorizontalOffset, canvasArea.width)
      : canvasArea.width * 0.05,
    
    priceDisplayPadding: config.priceDisplayPadding
      ? percentageToPixels(config.priceDisplayPadding, canvasArea.width)
      : canvasArea.width * 0.02,

    // Pass through non-scaled parameters unchanged
    ...Object.fromEntries(
      Object.entries(config).filter(([key]) => ![
        'visualizationsContentWidth', 'meterHeight', 'centralAxisXPosition', 'adrAxisXPosition',
        'priceFloatWidth', 'priceFloatHeight', 'priceFloatXOffset', 'priceFontSize',
        'priceHorizontalOffset', 'priceDisplayPadding'
      ].includes(key))
    )
  };
}

/**
 * Configure canvas context with proper scaling
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} canvasDimensions - Canvas dimensions from getCanvasDimensions
 * @param {Object} options - Configuration options
 */
export function configureCanvasContext(ctx, canvasDimensions, options = {}) {
  const { dpr, canvas } = canvasDimensions;
  const { 
    imageSmoothingEnabled = false,
    fontSmoothingEnabled = true 
  } = options;

  // Apply device pixel ratio scaling
  if (dpr > 1) {
    ctx.scale(dpr, dpr);
  }

  // Configure rendering quality
  ctx.imageSmoothingEnabled = imageSmoothingEnabled;
  
  // Set default font properties
  if (fontSmoothingEnabled) {
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
  }

  return ctx;
}

/**
 * Validate canvas dimensions for safety
 * @param {Object} dimensions - Dimensions to validate
 * @returns {Object} Validation result with safe dimensions
 */
export function validateCanvasDimensions(dimensions) {
  const { width, height } = dimensions;
  
  // 🔧 FIX: Reduced minimum dimensions to allow smaller displays
  const MIN_WIDTH = 50;   // Reduced from 100 to allow smaller displays
  const MAX_WIDTH = 4000;
  const MIN_HEIGHT = 50;  // Reduced from 80 to allow smaller displays  
  const MAX_HEIGHT = 4000;
  
  // Apply constraints
  const safeWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width));
  const safeHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, height));
  
  const isValid = width === safeWidth && height === safeHeight;
  
  return {
    isValid,
    dimensions: {
      width: safeWidth,
      height: safeHeight
    },
    warnings: isValid ? [] : [
      ...(width !== safeWidth ? [`Width clamped from ${width} to ${safeWidth}`] : []),
      ...(height !== safeHeight ? [`Height clamped from ${height} to ${safeHeight}`] : [])
    ]
  };
}

/**
 * Create a complete canvas sizing configuration
 * @param {Object} containerSize - Container dimensions
 * @param {Object} config - Component configuration
 * @param {Object} options - Additional options
 * @returns {Object} Complete canvas sizing configuration
 */
export function createCanvasSizingConfig(containerSize, config, options = {}) {
  // Get base canvas dimensions
  const canvasDimensions = getCanvasDimensions(containerSize, options);
  
  // Validate dimensions
  const validation = validateCanvasDimensions(canvasDimensions.canvasArea);
  if (!validation.isValid) {
    console.warn('[CanvasSizing] Dimension validation warnings:', validation.warnings);
  }
  
  // Normalize configuration to absolute pixels
  const normalizedConfig = normalizeConfig(config, canvasDimensions);
  
  return {
    // Canvas dimension information
    dimensions: canvasDimensions,
    validation,
    
    // Normalized configuration
    config: normalizedConfig,
    
    // Utility functions
    utils: {
      // Coordinate transformation
      cssToCanvas: canvasDimensions.transforms.cssToCanvas,
      canvasToCss: canvasDimensions.transforms.canvasToCss,
      
      // Bounds checking
      isInBounds: (x, y) => {
        return x >= 0 && x <= canvasDimensions.canvasArea.width &&
               y >= 0 && y <= canvasDimensions.canvasArea.height;
      },
      
      // Clamp to bounds
      clampToBounds: (x, y) => ({
        x: Math.max(0, Math.min(canvasDimensions.canvasArea.width, x)),
        y: Math.max(0, Math.min(canvasDimensions.canvasArea.height, y))
      })
    }
  };
}

/**
 * Coordinate transformation utilities for consistent coordinate systems
 */
export const coordinateUtils = {
  /**
   * Convert CSS pixel coordinates to canvas coordinates
   * @param {Object} cssPos - CSS position {x, y}
   * @param {Object} canvasDimensions - Canvas dimensions from getCanvasDimensions
   * @returns {Object} Canvas coordinates {x, y}
   */
  cssToCanvas: (cssPos, canvasDimensions) => {
    const { dpr } = canvasDimensions;
    return {
      x: cssPos.x * dpr,
      y: cssPos.y * dpr
    };
  },
  
  /**
   * Convert canvas coordinates to CSS pixel coordinates
   * @param {Object} canvasPos - Canvas position {x, y}
   * @param {Object} canvasDimensions - Canvas dimensions from getCanvasDimensions
   * @returns {Object} CSS coordinates {x, y}
   */
  canvasToCss: (canvasPos, canvasDimensions) => {
    const { dpr } = canvasDimensions;
    return {
      x: canvasPos.x / dpr,
      y: canvasPos.y / dpr
    };
  }
};

/**
 * Unified bounds checking utilities for consistent behavior across visualization functions
 * 
 * FOUNDATION PATTERN: Performance optimization for 60fps rendering with 20+ displays
 * 
 * ARCHITECTURAL INTENT:
 * - Skip unnecessary canvas operations for out-of-bounds elements
 * - Support expandable range scenarios (elements beyond initial canvas)
 * - Maintain trader precision with professional-grade rendering
 * - Enable zero-latency updates for real-time trading data
 * 
 * USAGE PATTERNS:
 * - ELEMENT-SPECIFIC: Check individual elements before rendering (PREFERRED - see dayRangeMeter.js)
 * - AVOID BINARY CHECKING: Do NOT use all-or-nothing approach for entire visualizations
 * - CONTEXT-AWARE: Use different bounds logic for different element types
 * 
 * PERFORMANCE BENEFITS:
 * - Reduces canvas operations for elements outside visible area
 * - Enables smooth 60fps rendering with 20+ simultaneous displays
 * - Maintains sub-100ms latency for real-time trading data
 * - Supports visual effects that extend beyond canvas boundaries
 * 
 * EXAMPLE USAGE:
 * // GOOD: Element-specific checking (like dayRangeMeter.js)
 * if (boundsUtils.isYInBounds(highY, {}, { canvasArea: contentArea })) {
 *   drawHighMarker(ctx, highY); // Only draw if visible
 * }
 * 
 * // AVOID: Binary checking for entire visualization
 * const inBounds = boundsUtils.isYInBounds(priceY, config, { canvasArea: contentArea });
 * if (!inBounds) return; // Don't skip entire visualization!
 */
export const boundsUtils = {
  /**
   * Check if a point is within canvas bounds
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {Object} canvasDimensions - Canvas dimensions from getCanvasDimensions
   * @returns {boolean} True if point is within bounds
   */
  isPointInBounds: (x, y, canvasDimensions) => {
    const { canvasArea } = canvasDimensions;
    return x >= 0 && x <= canvasArea.width && y >= 0 && y <= canvasArea.height;
  },

  /**
   * Check if a Y coordinate is within drawable bounds with overflow tolerance
   * 
   * FOUNDATION PATTERN: Enables expandable range support for trading visualizations
   * 
   * PURPOSE: Allows elements slightly outside canvas to support:
   * - Visual effects that extend beyond boundaries (glow, shadows)
   * - Smooth transitions when elements move in/out of view
   * - Expandable range scenarios when price moves beyond expected limits
   * 
   * OVERFLOW TOLERANCE: ±50px allows for visual effects while preventing
   * unnecessary rendering of elements far outside visible area
   * 
   * @param {number} y - Y coordinate to check
   * @param {Object} config - Configuration object (optional, can be {} for minimal checks)
   * @param {Object} canvasDimensions - Canvas dimensions containing canvasArea
   * @returns {boolean} True if Y is within drawable bounds (including overflow tolerance)
   */
  isYInBounds: (y, config, canvasDimensions) => {
    const { canvasArea } = canvasDimensions;
    return y >= -50 && y <= canvasArea.height + 50; // Allow some overflow for effects
  },

  /**
   * Check if a bar position is within bounds for market profile
   * @param {number} yPos - Y position for bar
   * @param {number} barHeight - Height of the bar
   * @param {Object} canvasDimensions - Canvas dimensions
   * @returns {boolean} True if bar is within reasonable bounds
   */
  isBarInBounds: (yPos, barHeight, canvasDimensions) => {
    const { canvasArea } = canvasDimensions;
    return yPos >= -barHeight && yPos <= canvasArea.height + barHeight;
  },

  /**
   * Clamp coordinates to canvas bounds
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {Object} canvasDimensions - Canvas dimensions
   * @returns {Object} Clamped coordinates {x, y}
   */
  clampToBounds: (x, y, canvasDimensions) => {
    const { canvasArea } = canvasDimensions;
    return {
      x: Math.max(0, Math.min(canvasArea.width, x)),
      y: Math.max(0, Math.min(canvasArea.height, y))
    };
  },

  /**
   * Check if ADR axis position is within container bounds
   * @param {number} axisX - ADR axis X position
   * @param {Object} config - Configuration object
   * @param {Object} canvasDimensions - Canvas dimensions
   * @returns {boolean} True if axis is within bounds
   */
  isAxisInBounds: (axisX, config, canvasDimensions) => {
    const { canvasArea } = canvasDimensions;
    const minX = (config.adrAxisXMin || 5) * canvasArea.width / 100;
    const maxX = (config.adrAxisXMax || 95) * canvasArea.width / 100;
    return axisX >= minX && axisX <= maxX;
  },

  /**
   * Clamp ADR axis position to container bounds
   * @param {number} axisX - ADR axis X position
   * @param {Object} config - Configuration object
   * @param {Object} canvasDimensions - Canvas dimensions
   * @returns {number} Clamped axis position
   */
  clampAxisToBounds: (axisX, config, canvasDimensions) => {
    const { canvasArea } = canvasDimensions;
    const minX = (config.adrAxisXMin || 5) * canvasArea.width / 100;
    const maxX = (config.adrAxisXMax || 95) * canvasArea.width / 100;
    return Math.max(minX, Math.min(maxX, axisX));
  }
};

/**
 * Configure text rendering with DPR-aware font sizing
 * 
 * Fixes fuzzy text rendering by using base CSS font sizes in DPR-scaled canvas context.
 * When canvas context is already scaled by DPR, we use base font size directly.
 * 
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} canvasDimensions - Canvas dimensions from getCanvasDimensions
 * @param {Object} options - Text configuration options
 * @returns {Object} Configured text settings for DPR-aware rendering
 */
export function configureTextForDPR(ctx, canvasDimensions, options = {}) {
  const { dpr } = canvasDimensions;
  const {
    baseFontSize = 10,        // Base font size in CSS pixels
    fontFamily = 'sans-serif',
    fontWeight = 'normal',
    textAlign = 'center',
    textBaseline = 'middle',
    fillStyle = '#000000',
    smoothingEnabled = true
  } = options;

  // When canvas context is DPR-scaled (ctx.scale(dpr, dpr) was called),
  // we use the base CSS font size directly - no need to scale again
  const finalFontSize = baseFontSize;
  const fontString = `${fontWeight} ${finalFontSize}px ${fontFamily}`;
  
  // Apply font and text properties
  ctx.font = fontString;
  ctx.textAlign = textAlign;
  ctx.textBaseline = textBaseline;
  ctx.fillStyle = fillStyle;
  
  // Configure text smoothing for crisp rendering
  ctx.imageSmoothingEnabled = smoothingEnabled;
  
  return {
    fontString,
    baseFontSize,
    finalFontSize,
    dpr,
    fontFamily,
    fontWeight,
    textAlign,
    textBaseline,
    fillStyle,
    smoothingEnabled
  };
}

/**
 * Configuration normalization utilities
 */
export const configUtils = {
  /**
   * Normalize configuration values with clear contract
   * Clear contract: ≤200 = percentage, >200 = absolute pixels
   * @param {Object} config - Configuration object
   * @returns {Object} Normalized configuration
   */
  normalizeConfig: (config) => {
    if (!config) return {};
    
    // Helper function to determine if value is percentage (≤200) or absolute (>200)
    const isPercentage = (value) => {
      return typeof value === 'number' && value <= 200;
    };
    
    return {
      ...config,
      // Clear contract: ≤200 = percentage, >200 = absolute pixels
      visualizationsContentWidth: config.visualizationsContentWidth <= 200
        ? config.visualizationsContentWidth
        : config.visualizationsContentWidth,
      meterHeight: config.meterHeight <= 200
        ? config.meterHeight
        : config.meterHeight
    };
  }
};

// Export constants for easy access
export const CANVAS_CONSTANTS = {
  REFERENCE_CANVAS,
  DEFAULT_CONTAINER,
  MIN_DIMENSIONS: { width: 50, height: 50 },  // 🔧 FIX: Updated to match new minimums
  MAX_DIMENSIONS: { width: 4000, height: 4000 }
};

// Export percentage utilities for testing and external use
export const isPercentage = (value) => {
  return typeof value === 'number' && value <= 200;
};

export const percentageToPixels = (value, reference) => {
  if (value <= 1) {
    // Already in decimal format (0.15 = 15%)
    return value * reference;
  } else {
    // Old percentage format (15 = 15%)
    return (value / 100) * reference;
  }
};
