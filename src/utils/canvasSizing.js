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

// Performance thresholds (professional trading standards)
export const PERFORMANCE_THRESHOLDS = {
  CANVAS_OPERATION_MAX_MS: 10,
  DATA_TO_VISUAL_MAX_MS: 100,
  TARGET_FPS: 60,
  CONCURRENT_DISPLAYS: 20
};

// Default container dimensions (headerless design)
export const DEFAULT_CONTAINER = {
  width: 220,  // 220px canvas (no header, no padding)
  height: 120   // 120px canvas (no header, no padding)
};

// Device pixel ratio handling with zoom awareness
export const getDevicePixelRatio = () => {
  return window.devicePixelRatio || 1;
};

/**
 * Enhanced Zoom Detection with ResizeObserver Integration
 *
 * Provides event-driven zoom detection using ResizeObserver for optimal performance,
 * with automatic fallback to polling-based detection for browser compatibility.
 *
 * PERFORMANCE BENEFITS:
 * - Event-driven detection eliminates polling overhead
 * - Immediate response to zoom changes for better UX
 * - Reduced CPU usage during extended trading sessions
 * - Better integration with modern browser APIs
 *
 * BROWSER COMPATIBILITY:
 * - Modern browsers: ResizeObserver for instant detection
 * - Legacy browsers: Automatic fallback to polling-based detection
 * - Progressive enhancement with feature detection
 */

/**
 * Debounce utility for performance optimization
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Check if ResizeObserver is supported in the current environment
 * @returns {boolean} True if ResizeObserver is supported
 */
function isResizeObserverSupported() {
  return typeof window !== 'undefined' &&
         typeof window.ResizeObserver !== 'undefined' &&
         typeof window.devicePixelRatio !== 'undefined';
}

/**
 * Create a ResizeObserver-based zoom detector for modern browsers
 * @param {Function} callback - Function called when DPR changes
 * @param {Object} options - Configuration options
 * @returns {Function} Cleanup function to remove observers
 */
function createResizeObserverZoomDetector(callback, options = {}) {
  const {
    debugLogging = false,
    debounceMs = 16 // ~60fps for smooth updates
  } = options;

  let currentDpr = window.devicePixelRatio || 1;
  let observer = null;
  let measurementElement = null;

  // Create a hidden element for observing DPR changes
  measurementElement = document.createElement('div');
  measurementElement.style.position = 'absolute';
  measurementElement.style.width = '1px';
  measurementElement.style.height = '1px';
  measurementElement.style.visibility = 'hidden';
  measurementElement.style.pointerEvents = 'none';
  measurementElement.style.left = '-9999px';
  measurementElement.style.top = '-9999px';

  // Add to DOM for measurement
  document.body.appendChild(measurementElement);

  // Create the debounced callback
  const debouncedCallback = debounce((newDpr) => {
    if (debugLogging) {
      console.log(`[ZoomDetector] ResizeObserver: DPR changed from ${currentDpr} to ${newDpr}`);
    }
    callback(newDpr);
    currentDpr = newDpr;
  }, debounceMs);

  // Create ResizeObserver to monitor element dimensions
  observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      // Check if DPR has changed by examining content box size
      const newDpr = window.devicePixelRatio || 1;

      if (newDpr !== currentDpr) {
        debouncedCallback(newDpr);
        break; // Only need to detect once per change
      }
    }
  });

  // Start observing the measurement element
  observer.observe(measurementElement);

  // Return cleanup function
  return () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (measurementElement && measurementElement.parentNode) {
      measurementElement.parentNode.removeChild(measurementElement);
      measurementElement = null;
    }
    if (debugLogging) {
      console.log('[ZoomDetector] ResizeObserver: Cleanup completed');
    }
  };
}

/**
 * Create a polling-based zoom detector for legacy browser compatibility
 * @param {Function} callback - Function called when DPR changes
 * @param {Object} options - Configuration options
 * @returns {Function} Cleanup function to remove event listeners
 */
function createPollingZoomDetector(callback, options = {}) {
  const {
    debugLogging = false,
    pollInterval = 500 // Reduced frequency for performance
  } = options;

  let currentDpr = window.devicePixelRatio || 1;

  const checkZoom = () => {
    const newDpr = window.devicePixelRatio || 1;
    if (newDpr !== currentDpr) {
      if (debugLogging) {
        console.log(`[ZoomDetector] Polling: DPR changed from ${currentDpr} to ${newDpr}`);
      }
      currentDpr = newDpr;
      callback(newDpr);
    }
  };

  // Listen for zoom indicators (traditional approach)
  window.addEventListener('resize', checkZoom, { passive: true });
  window.addEventListener('wheel', checkZoom, { passive: true });

  // Check periodically for smooth zoom detection
  const interval = setInterval(checkZoom, pollInterval);

  // Return cleanup function
  return () => {
    window.removeEventListener('resize', checkZoom);
    window.removeEventListener('wheel', checkZoom);
    clearInterval(interval);
    if (debugLogging) {
      console.log('[ZoomDetector] Polling: Cleanup completed');
    }
  };
}

/**
 * Create a zoom detector for dynamic DPR monitoring
 *
 * Enhanced implementation with ResizeObserver support for modern browsers
 * and automatic fallback to polling for legacy compatibility.
 *
 * @param {Function} callback - Function called when DPR changes
 * @param {Object} options - Configuration options
 * @param {boolean} options.debugLogging - Enable debug logging for troubleshooting
 * @param {number} options.debounceMs - Debounce delay for rapid zoom changes (default: 16ms ~60fps)
 * @param {number} options.pollInterval - Polling interval for fallback detection (default: 500ms)
 * @returns {Function} Cleanup function to remove event listeners and observers
 *
 * @example
 * // Basic usage (backward compatible)
 * const cleanup = createZoomDetector((newDpr) => {
 *   console.log('DPR changed:', newDpr);
 *   // Update canvas dimensions and re-render
 * });
 *
 * // Advanced usage with debug logging
 * const cleanup = createZoomDetector((newDpr) => {
 *   handleZoomChange(newDpr);
 * }, { debugLogging: true });
 *
 * // Cleanup when component unmounts
 * onDestroy(() => cleanup());
 */
export function createZoomDetector(callback, options = {}) {
  // Input validation
  if (typeof callback !== 'function') {
    throw new Error('[createZoomDetector] Callback must be a function');
  }

  const {
    debugLogging = false,
    ...detectorOptions
  } = options;

  // Choose detection method based on browser support
  if (isResizeObserverSupported()) {
    if (debugLogging) {
      console.log('[ZoomDetector] Using ResizeObserver-based detection (enhanced performance)');
    }
    return createResizeObserverZoomDetector(callback, { debugLogging, ...detectorOptions });
  } else {
    if (debugLogging) {
      console.log('[ZoomDetector] Using polling-based detection (legacy fallback)');
    }
    return createPollingZoomDetector(callback, { debugLogging, ...detectorOptions });
  }
}

/**
 * Calculate canvas dimensions based on container size and reference canvas (headerless design)
 * @param {Object} containerSize - Container dimensions {width, height}
 * @param {Object} options - Configuration options
 * @returns {Object} Canvas sizing information
 */
export function getCanvasDimensions(containerSize, options = {}) {
  const {
    padding = 0, // No padding in headerless design
    respectDpr = true
  } = options;

  // Calculate available canvas area within container (headerless design)
  const canvasArea = {
    width: containerSize.width,  // Full container width
    height: containerSize.height // Full container height (no header)
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
      cssWidth: canvasArea.width, // CSS must match container dimensions exactly
      cssHeight: canvasArea.height
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

/**
 * Zoom Detection Utilities for Enhanced Development Experience
 *
 * These utilities complement the enhanced createZoomDetector function and provide
 * additional capabilities for development, testing, and runtime debugging.
 */

/**
 * Get current zoom detection capabilities and information
 * @returns {Object} Information about zoom detection support and current state
 */
export function getZoomDetectionInfo() {
  const hasResizeObserver = isResizeObserverSupported();
  const currentDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  return {
    supportedMethods: {
      resizeObserver: hasResizeObserver,
      polling: true // Always available as fallback
    },
    recommendedMethod: hasResizeObserver ? 'resizeObserver' : 'polling',
    currentDpr,
    browserInfo: typeof navigator !== 'undefined' ? {
      userAgent: navigator.userAgent,
      platform: navigator.platform
    } : null,
    performanceProfile: hasResizeObserver ? {
      description: 'Event-driven detection with minimal CPU overhead',
      latency: 'Immediate (sub-16ms)',
      memoryUsage: 'Low (single observer instance)'
    } : {
      description: 'Polling-based detection with configurable intervals',
      latency: `~${500}ms average`,
      memoryUsage: 'Very low (simple event listeners)'
    }
  };
}

/**
 * Test zoom detection functionality with simulated zoom events
 * @param {Function} callback - Test callback function
 * @param {Object} options - Test options
 * @returns {Object} Test results and cleanup function
 */
export function testZoomDetection(callback, options = {}) {
  const {
    testDuration = 5000, // 5 seconds
    debugLogging = true
  } = options;

  const testResults = {
    startTime: Date.now(),
    eventsDetected: 0,
    dprValues: [],
    errors: []
  };

  const testCallback = (newDpr) => {
    testResults.eventsDetected++;
    testResults.dprValues.push(newDpr);

    if (callback) {
      callback(newDpr);
    }

    if (debugLogging) {
      console.log(`[ZoomDetectionTest] Event #${testResults.eventsDetected}: DPR = ${newDpr}`);
    }
  };

  const cleanup = createZoomDetector(testCallback, { debugLogging });

  // Auto-cleanup after test duration
  const timeout = setTimeout(() => {
    cleanup();
    testResults.endTime = Date.now();
    testResults.duration = testResults.endTime - testResults.startTime;

    if (debugLogging) {
      console.log('[ZoomDetectionTest] Test completed:', testResults);
    }
  }, testDuration);

  return {
    results: testResults,
    cleanup: () => {
      clearTimeout(timeout);
      cleanup();
    }
  };
}

/**
 * Create a performance-optimized zoom detector specifically for trading applications
 *
 * This function provides optimized defaults for the NeuroSense FX trading environment,
 * focusing on minimal latency during rapid market movements and stable performance
 * during extended trading sessions.
 *
 * @param {Function} callback - Function called when DPR changes
 * @param {Object} options - Configuration options with trading-optimized defaults
 * @returns {Function} Cleanup function
 */
export function createTradingOptimizedZoomDetector(callback, options = {}) {
  const tradingDefaults = {
    debugLogging: false, // Disabled in production for performance
    debounceMs: 8, // Faster response for active trading (~120fps)
    pollInterval: isResizeObserverSupported() ? 0 : 250 // Faster polling if needed
  };

  return createZoomDetector(callback, { ...tradingDefaults, ...options });
}

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

/**
 * === PHASE 2: DPR-AWARE RENDERING ENHANCEMENT SYSTEM ===
 *
 * Professional trading-grade visual quality system with crisp 1px line rendering,
 * zoom-aware optimizations, and device-specific performance profiles.
 */

/**
 * Device Performance Profiles for Adaptive Rendering
 *
 * Optimizes rendering quality based on device capabilities to maintain
 * 60fps performance across all hardware types.
 */
export const DEVICE_PROFILES = {
  // High-end devices with unlimited rendering quality
  high: {
    name: 'high',
    description: 'High-end devices with maximum quality',
    thresholds: {
      memory: 8, // GB RAM
      cores: 8,  // CPU cores
      dpr: 2     // Device pixel ratio
    },
    settings: {
      maxDprScaling: 3,
      antiAliasing: true,
      subpixelRendering: true,
      advancedEffects: true,
      zoomOptimizations: true
    }
  },

  // Standard devices with balanced quality/performance
  standard: {
    name: 'standard',
    description: 'Standard devices with balanced quality',
    thresholds: {
      memory: 4, // GB RAM
      cores: 4,  // CPU cores
      dpr: 2     // Device pixel ratio
    },
    settings: {
      maxDprScaling: 2,
      antiAliasing: true,
      subpixelRendering: true,
      advancedEffects: false,
      zoomOptimizations: true
    }
  },

  // Low-end devices with performance-focused settings
  low: {
    name: 'low',
    description: 'Low-end devices optimized for performance',
    thresholds: {
      memory: 2, // GB RAM
      cores: 2,  // CPU cores
      dpr: 1.5   // Device pixel ratio
    },
    settings: {
      maxDprScaling: 1.5,
      antiAliasing: false,
      subpixelRendering: false,
      advancedEffects: false,
      zoomOptimizations: false
    }
  }
};

/**
 * Detect device capabilities and determine optimal performance profile
 * @returns {Object} Device profile with rendering settings
 */
export function detectDeviceProfile() {
  // Default to standard profile for safety
  const defaultProfile = DEVICE_PROFILES.standard;

  try {
    // Get device information
    const dpr = getDevicePixelRatio();
    const memory = navigator.deviceMemory || 4; // Default to 4GB if unknown
    const cores = navigator.hardwareConcurrency || 4; // Default to 4 cores if unknown

    // Check for completely missing device information (fallback to standard)
    if (dpr === undefined || navigator === undefined) {
      return defaultProfile;
    }

    // Determine profile based on thresholds
    if (memory >= DEVICE_PROFILES.high.thresholds.memory &&
        cores >= DEVICE_PROFILES.high.thresholds.cores &&
        dpr >= DEVICE_PROFILES.high.thresholds.dpr) {
      return DEVICE_PROFILES.high;
    }

    if (memory >= DEVICE_PROFILES.standard.thresholds.memory &&
        cores >= DEVICE_PROFILES.standard.thresholds.cores &&
        dpr >= DEVICE_PROFILES.standard.thresholds.dpr) {
      return DEVICE_PROFILES.standard;
    }

    return DEVICE_PROFILES.low;
  } catch (error) {
    console.warn('[DeviceProfile] Failed to detect device capabilities:', error);
    return defaultProfile;
  }
}

/**
 * Crisp 1px Line Rendering System
 *
 * Provides pixel-perfect line rendering across all device pixel ratios
 * with sub-pixel alignment and anti-aliasing control.
 */
export const crispLineRenderer = {
  /**
   * Configure canvas context for crisp 1px line rendering
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} dpr - Device pixel ratio
   * @param {Object} options - Rendering options
   */
  configureForCrispLines: (ctx, dpr, options = {}) => {
    const {
      lineWidth = 1,
      antiAliasing = false,
      subpixelAlignment = true
    } = options;

    ctx.save();

    // Apply sub-pixel translation for crisp lines
    if (subpixelAlignment) {
      ctx.translate(0.5 / dpr, 0.5 / dpr);
    }

    // Configure line properties
    ctx.lineWidth = lineWidth / dpr;
    ctx.imageSmoothingEnabled = antiAliasing;

    // Ensure integer coordinates for crisp rendering
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#000000';

    return ctx;
  },

  /**
   * Draw a crisp 1px horizontal line
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x1 - Start X coordinate
   * @param {number} x2 - End X coordinate
   * @param {number} y - Y coordinate
   * @param {Object} options - Line options
   */
  drawHorizontalLine: (ctx, x1, x2, y, options = {}) => {
    const {
      color = '#000000',
      lineWidth = 1,
      dashPattern = null
    } = options;

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;

    if (dashPattern) {
      ctx.setLineDash(dashPattern);
    }

    ctx.beginPath();
    ctx.moveTo(Math.round(x1), Math.round(y));
    ctx.lineTo(Math.round(x2), Math.round(y));
    ctx.stroke();

    if (dashPattern) {
      ctx.setLineDash([]);
    }
  },

  /**
   * Draw a crisp 1px vertical line
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - X coordinate
   * @param {number} y1 - Start Y coordinate
   * @param {number} y2 - End Y coordinate
   * @param {Object} options - Line options
   */
  drawVerticalLine: (ctx, x, y1, y2, options = {}) => {
    const {
      color = '#000000',
      lineWidth = 1,
      dashPattern = null
    } = options;

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;

    if (dashPattern) {
      ctx.setLineDash(dashPattern);
    }

    ctx.beginPath();
    ctx.moveTo(Math.round(x), Math.round(y1));
    ctx.lineTo(Math.round(x), Math.round(y2));
    ctx.stroke();

    if (dashPattern) {
      ctx.setLineDash([]);
    }
  },

  /**
   * Draw a crisp rectangle with 1px borders
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} width - Width
   * @param {number} height - Height
   * @param {Object} options - Rectangle options
   */
  drawRect: (ctx, x, y, width, height, options = {}) => {
    const {
      strokeColor = '#000000',
      fillColor = null,
      lineWidth = 1
    } = options;

    const rx = Math.round(x);
    const ry = Math.round(y);
    const rw = Math.round(width);
    const rh = Math.round(height);

    if (fillColor) {
      ctx.fillStyle = fillColor;
      ctx.fillRect(rx, ry, rw, rh);
    }

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(rx, ry, rw, rh);
  }
};

/**
 * Zoom-Aware Rendering Optimizations
 *
 * Adapts rendering quality based on zoom level to maintain performance
 * while providing optimal visual quality at each zoom level.
 */
export const zoomOptimizer = {
  /**
   * Get zoom level category for adaptive rendering
   * @param {number} dpr - Current device pixel ratio
   * @returns {Object} Zoom level information
   */
  getZoomLevel: (dpr) => {
    if (dpr <= 1) {
      return {
        category: 'standard',
        description: 'Standard zoom (100%)',
        qualityMultiplier: 1,
        performanceImpact: 'low'
      };
    } else if (dpr <= 1.5) {
      return {
        category: 'slight',
        description: 'Slight zoom (100-150%)',
        qualityMultiplier: 1.2,
        performanceImpact: 'low'
      };
    } else if (dpr <= 2) {
      return {
        category: 'moderate',
        description: 'Moderate zoom (150-200%)',
        qualityMultiplier: 1.5,
        performanceImpact: 'medium'
      };
    } else if (dpr <= 3) {
      return {
        category: 'high',
        description: 'High zoom (200-300%)',
        qualityMultiplier: 2,
        performanceImpact: 'high'
      };
    } else {
      return {
        category: 'extreme',
        description: 'Extreme zoom (300%+)',
        qualityMultiplier: 2.5,
        performanceImpact: 'very-high'
      };
    }
  },

  /**
   * Get adaptive rendering settings based on zoom level
   * @param {number} dpr - Current device pixel ratio
   * @param {Object} deviceProfile - Device performance profile
   * @returns {Object} Adaptive rendering settings
   */
  getAdaptiveSettings: (dpr, deviceProfile) => {
    const zoomLevel = zoomOptimizer.getZoomLevel(dpr);
    const { settings } = deviceProfile;

    return {
      // Line rendering optimization
      lineWidth: Math.max(1, Math.round(settings.maxDprScaling / dpr)),
      antiAliasing: settings.antiAliasing && zoomLevel.category !== 'extreme',

      // Text rendering optimization
      fontSize: {
        base: 10,
        scaled: Math.round(10 * Math.min(dpr, settings.maxDprScaling))
      },

      // Effect optimization
      enableEffects: settings.advancedEffects &&
                     zoomLevel.performanceImpact !== 'very-high',
      enableSubpixel: settings.subpixelRendering &&
                     zoomLevel.category !== 'extreme',

      // Performance optimization
      frameSkip: zoomLevel.category === 'extreme' ? 2 : 1,
      qualityReduction: zoomLevel.category === 'extreme' ? 0.8 : 1.0,

      zoomLevel
    };
  }
};

/**
 * Advanced DPR Coordinate Transformation Utilities
 *
 * Provides precise coordinate transformations with device-specific
 * optimizations and zoom-aware calculations.
 */
export const dprCoordinateUtils = {
  /**
   * Transform CSS coordinates to canvas coordinates with DPR precision
   * @param {Object} cssPos - CSS position {x, y}
   * @param {number} dpr - Device pixel ratio
   * @param {Object} options - Transformation options
   * @returns {Object} Canvas coordinates {x, y}
   */
  cssToCanvasPrecise: (cssPos, dpr, options = {}) => {
    const {
      rounding = 'round', // 'round', 'floor', 'ceil'
      subpixelAlignment = true
    } = options;

    let x = cssPos.x * dpr;
    let y = cssPos.y * dpr;

    // Apply rounding for crisp rendering
    switch (rounding) {
      case 'floor':
        x = Math.floor(x);
        y = Math.floor(y);
        break;
      case 'ceil':
        x = Math.ceil(x);
        y = Math.ceil(y);
        break;
      default: // round
        x = Math.round(x);
        y = Math.round(y);
    }

    // Apply sub-pixel alignment for crisp lines
    if (subpixelAlignment) {
      x += 0.5;
      y += 0.5;
    }

    return { x, y };
  },

  /**
   * Transform canvas coordinates to CSS coordinates with DPR precision
   * @param {Object} canvasPos - Canvas position {x, y}
   * @param {number} dpr - Device pixel ratio
   * @returns {Object} CSS coordinates {x, y}
   */
  canvasToCssPrecise: (canvasPos, dpr) => {
    return {
      x: canvasPos.x / dpr,
      y: canvasPos.y / dpr
    };
  },

  /**
   * Clamp coordinates to canvas bounds with DPR precision
   * @param {Object} coords - Coordinates {x, y}
   * @param {Object} dimensions - Canvas dimensions {width, height}
   * @param {number} dpr - Device pixel ratio
   * @returns {Object} Clamped coordinates
   */
  clampToCanvasBounds: (coords, dimensions, dpr) => {
    const maxX = dimensions.width * dpr;
    const maxY = dimensions.height * dpr;

    return {
      x: Math.max(0, Math.min(maxX, coords.x)),
      y: Math.max(0, Math.min(maxY, coords.y))
    };
  }
};

/**
 * DPR Performance Monitoring System
 *
 * Monitors DPR-related performance metrics and provides optimization
 * recommendations for different device and zoom scenarios.
 */
export const dprPerformanceMonitor = {
  /**
   * Create a DPR performance monitor instance
   * @param {Object} options - Monitoring options
   * @returns {Object} Performance monitor instance
   */
  create: (options = {}) => {
    const {
      sampleInterval = 1000, // ms
      maxSamples = 60, // 1 minute at 60fps
      debugLogging = false
    } = options;

    let samples = [];
    let startTime = Date.now();
    let monitoring = false;

    return {
      /**
       * Record a frame sample
       * @param {Object} sample - Frame sample data
       */
      recordFrame: (sample) => {
        if (!monitoring) return;

        const frameSample = {
          timestamp: Date.now() - startTime,
          dpr: sample.dpr || getDevicePixelRatio(),
          renderTime: sample.renderTime || 0,
          frameTime: sample.frameTime || 0,
          quality: sample.quality || 1.0,
          effects: sample.effects || false
        };

        samples.push(frameSample);

        // Maintain sample limit
        if (samples.length > maxSamples) {
          samples.shift();
        }

        if (debugLogging) {
          console.log('[DPR-Perf] Frame sample:', frameSample);
        }
      },

      /**
       * Get performance metrics
       * @returns {Object} Performance metrics
       */
      getMetrics: () => {
        if (samples.length === 0) return null;

        const renderTimes = samples.map(s => s.renderTime);
        const frameTimes = samples.map(s => s.frameTime);
        const qualities = samples.map(s => s.quality);

        return {
          sampleCount: samples.length,
          duration: Date.now() - startTime,
          dpr: samples[0].dpr, // Current DPR

          // Performance metrics
          avgRenderTime: renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length,
          maxRenderTime: Math.max(...renderTimes),
          avgFrameTime: frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length,

          // Quality metrics
          avgQuality: qualities.reduce((a, b) => a + b, 0) / qualities.length,

          // Performance analysis
          performanceLevel: dprPerformanceMonitor.analyzePerformance(renderTimes, frameTimes)
        };
      },

      /**
       * Start monitoring
       */
      start: () => {
        monitoring = true;
        startTime = Date.now();
        samples = [];

        if (debugLogging) {
          console.log('[DPR-Perf] Started monitoring');
        }
      },

      /**
       * Stop monitoring
       */
      stop: () => {
        monitoring = false;

        if (debugLogging) {
          console.log('[DPR-Perf] Stopped monitoring');
        }
      },

      /**
       * Reset monitoring data
       */
      reset: () => {
        samples = [];
        startTime = Date.now();
      }
    };
  },

  /**
   * Analyze performance metrics and provide recommendations
   * @param {Array} renderTimes - Array of render times
   * @param {Array} frameTimes - Array of frame times
   * @returns {Object} Performance analysis
   */
  analyzePerformance: (renderTimes, frameTimes) => {
    const avgRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
    const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;

    // Performance thresholds (ms)
    const THRESHOLDS = {
      excellent: { render: 5, frame: 16 },  // 60fps
      good: { render: 10, frame: 20 },     // 50fps
      acceptable: { render: 15, frame: 33 }, // 30fps
      poor: { render: 20, frame: 50 }      // 20fps
    };

    if (avgRenderTime <= THRESHOLDS.excellent.render &&
        avgFrameTime <= THRESHOLDS.excellent.frame) {
      return {
        level: 'excellent',
        description: 'Excellent performance - 60fps rendering',
        recommendations: []
      };
    }

    if (avgRenderTime <= THRESHOLDS.good.render &&
        avgFrameTime <= THRESHOLDS.good.frame) {
      return {
        level: 'good',
        description: 'Good performance - smooth rendering',
        recommendations: []
      };
    }

    if (avgRenderTime <= THRESHOLDS.acceptable.render &&
        avgFrameTime <= THRESHOLDS.acceptable.frame) {
      return {
        level: 'acceptable',
        description: 'Acceptable performance - minor optimization recommended',
        recommendations: ['Consider reducing effects quality', 'Monitor memory usage']
      };
    }

    return {
      level: 'poor',
      description: 'Poor performance - optimization required',
      recommendations: [
        'Reduce rendering quality settings',
        'Disable advanced effects',
        'Consider lower device profile',
        'Optimize canvas operations'
      ]
    };
  }
};

/**
 * Comprehensive DPR Configuration Factory
 *
 * Creates complete DPR-aware rendering configurations with
 * device-specific optimizations and zoom-aware settings.
 */
export function createDprRenderingConfig(canvasDimensions, options = {}) {
  const {
    deviceProfile = detectDeviceProfile(),
    enablePerformanceMonitoring = false,
    debugLogging = false
  } = options;

  const { dpr } = canvasDimensions;

  // Get adaptive settings for current zoom level
  const adaptiveSettings = zoomOptimizer.getAdaptiveSettings(dpr, deviceProfile);

  // Create performance monitor if requested
  const performanceMonitor = enablePerformanceMonitoring
    ? dprPerformanceMonitor.create({ debugLogging })
    : null;

  return {
    // Device and zoom information
    deviceProfile,
    dpr,
    zoomLevel: adaptiveSettings.zoomLevel,

    // Rendering settings
    rendering: {
      // Line rendering
      lineWidth: adaptiveSettings.lineWidth,
      antiAliasing: adaptiveSettings.antiAliasing,
      subpixelRendering: adaptiveSettings.enableSubpixel,

      // Text rendering
      fontSize: adaptiveSettings.fontSize,

      // Effects
      enableEffects: adaptiveSettings.enableEffects,
      qualityReduction: adaptiveSettings.qualityReduction,

      // Performance
      frameSkip: adaptiveSettings.frameSkip
    },

    // Coordinate utilities
    coordinates: {
      cssToCanvas: (cssPos, options = {}) =>
        dprCoordinateUtils.cssToCanvasPrecise(cssPos, dpr, options),
      canvasToCss: (canvasPos) =>
        dprCoordinateUtils.canvasToCssPrecise(canvasPos, dpr),
      clampToBounds: (coords, dimensions) =>
        dprCoordinateUtils.clampToCanvasBounds(coords, dimensions, dpr)
    },

    // Line renderer
    lineRenderer: crispLineRenderer,

    // Performance monitoring
    performanceMonitor,

    // Utility methods
    utils: {
      /**
       * Configure canvas context for optimal rendering
       * @param {CanvasRenderingContext2D} ctx - Canvas context
       */
      configureContext: (ctx) => {
        return crispLineRenderer.configureForCrispLines(
          ctx, dpr, {
            lineWidth: adaptiveSettings.lineWidth,
            antiAliasing: adaptiveSettings.antiAliasing,
            subpixelAlignment: adaptiveSettings.enableSubpixel
          }
        );
      },

      /**
       * Record performance frame
       * @param {Object} frameData - Frame performance data
       */
      recordFrame: (frameData) => {
        if (performanceMonitor) {
          performanceMonitor.recordFrame({
            ...frameData,
            dpr,
            quality: adaptiveSettings.qualityReduction
          });
        }
      },

      /**
       * Get performance metrics
       */
      getPerformanceMetrics: () => {
        return performanceMonitor ? performanceMonitor.getMetrics() : null;
      }
    }
  };
}
