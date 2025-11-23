/**
 * Reactive Coordinate Store for NeuroSense FX
 *
 * Provides Svelte-native state management for coordinate transformations,
 * replacing complex manual state synchronization with reactive patterns.
 *
 * Architecture: Foundation First - Simple, Performant, Maintainable
 * - Cartesian coordinate system with bounds checking
 * - Reactive transforms for automatic canvas updates
 * - Integration with existing configuration system
 * - DPR-aware coordinate handling for crisp rendering
 */

import { writable, derived } from 'svelte/store';
import { REFERENCE_CANVAS, getDevicePixelRatio } from '../utils/canvasSizing.js';

// =============================================================================
// CORE COORDINATE STATE
// =============================================================================

/**
 * Initial coordinate system state
 * Uses standard NeuroSense FX canvas dimensions (220×120px)
 */
const initialCoordinateState = {
  // Coordinate system configuration
  system: 'cartesian',

  // Canvas boundaries (logical pixels)
  bounds: {
    x: [0, REFERENCE_CANVAS.width],   // 0 to 220
    y: [0, REFERENCE_CANVAS.height]   // 0 to 120
  },

  // Device pixel ratio for crisp rendering
  dpr: getDevicePixelRatio(),

  // Price range for coordinate transformations
  priceRange: {
    min: null,  // Will be set from market data
    max: null   // Will be set from market data
  },

  // Coordinate transformation functions
  transforms: new Map(),

  // Cache for performance optimization
  cache: {
    lastPriceRange: null,
    lastBounds: null,
    scale: null
  }
};

// =============================================================================
// STORE CREATION
// =============================================================================

export const coordinateStore = writable(initialCoordinateState);

// =============================================================================
// DERIVED STORES FOR REACTIVE UPDATES
// =============================================================================

/**
 * Current bounds as a derived store for reactive updates
 */
export const currentBounds = derived(
  coordinateStore,
  $coordinateStore => $coordinateStore.bounds
);

/**
 * Current device pixel ratio for reactive DPR handling
 */
export const currentDPR = derived(
  coordinateStore,
  $coordinateStore => $coordinateStore.dpr
);

/**
 * Price scale transformation - maps price values to Y coordinates
 */
export const priceScale = derived(
  coordinateStore,
  $coordinateStore => {
    const { bounds, priceRange } = $coordinateStore;

    // Guard against missing price data
    if (!priceRange.min || !priceRange.max) {
      return null;
    }

    const priceExtent = priceRange.max - priceRange.min;
    const yExtent = bounds.y[1] - bounds.y[0];

    // Create scale function: price -> Y coordinate
    const scale = (price) => {
      // Normalize price to 0-1 range
      const normalized = (price - priceRange.min) / priceExtent;
      // Invert Y coordinate (price high = Y low, price low = Y high)
      const y = bounds.y[1] - (normalized * yExtent);
      return Math.round(y); // Return integer pixel coordinate
    };

    // Create inverse scale function: Y coordinate -> price
    const inverse = (y) => {
      const normalized = (bounds.y[1] - y) / yExtent;
      return priceRange.min + (normalized * priceExtent);
    };

    return {
      scale,
      inverse,
      priceExtent,
      yExtent,
      bounds,
      priceRange
    };
  }
);

/**
 * Normalized coordinates (0-1 range) for cross-display compatibility
 */
export const normalizedCoordinates = derived(
  [coordinateStore, priceScale],
  ([$coordinateStore, $priceScale]) => {
    if (!$priceScale) return null;

    return {
      /**
       * Convert price to normalized 0-1 coordinate
       */
      priceToNormalized: (price) => {
        return (price - $priceScale.priceRange.min) / $priceScale.priceExtent;
      },

      /**
       * Convert normalized coordinate to price
       */
      normalizedToPrice: (normalized) => {
        return $priceScale.priceRange.min + (normalized * $priceScale.priceExtent);
      },

      /**
       * Convert logical pixel to normalized coordinate
       */
      pixelToNormalized: (pixel) => {
        return (pixel - $coordinateStore.bounds.y[0]) / $priceScale.yExtent;
      },

      /**
       * Convert normalized coordinate to logical pixel
       */
      normalizedToPixel: (normalized) => {
        return $coordinateStore.bounds.y[0] + (normalized * $priceScale.yExtent);
      }
    };
  }
);

// =============================================================================
// COORDINATE STORE ACTIONS
// =============================================================================

export const coordinateActions = {

  /**
   * Update canvas bounds (for responsive resizing)
   * @param {Object} bounds - New bounds { x: [min, max], y: [min, max] }
   */
  updateBounds: (bounds) => {
    coordinateStore.update(state => ({
      ...state,
      bounds: { ...bounds },
      cache: {
        ...state.cache,
        lastBounds: bounds,
        scale: null // Invalidate cache
      }
    }));
  },

  /**
   * Update price range from market data
   * @param {Object} priceData - Market data with price information
   */
  updatePriceRange: (priceData) => {
    const {
      midPrice,           // Daily open price (center)
      projectedAdrHigh,   // ADR upper boundary
      projectedAdrLow,    // ADR lower boundary
      todaysHigh,         // Session high
      todaysLow           // Session low
    } = priceData;

    if (!midPrice || !projectedAdrHigh || !projectedAdrLow) {
      console.warn('[COORDINATE_STORE] Insufficient price data for range calculation');
      return;
    }

    // Calculate full price range with buffer
    const adrValue = projectedAdrHigh - projectedAdrLow;
    const buffer = adrValue * 0.1; // 10% buffer on each side

    const priceRange = {
      min: projectedAdrLow - buffer,
      max: projectedAdrHigh + buffer,
      center: midPrice,
      adr: adrValue
    };

    coordinateStore.update(state => ({
      ...state,
      priceRange,
      cache: {
        ...state.cache,
        lastPriceRange: priceRange,
        scale: null // Invalidate cache
      }
    }));
  },

  /**
   * Update device pixel ratio for zoom/resize events
   */
  updateDPR: () => {
    const newDPR = getDevicePixelRatio();

    coordinateStore.update(state => {
      if (state.dpr !== newDPR) {
        return {
          ...state,
          dpr: newDPR
        };
      }
      return state;
    });
  },

  /**
   * Transform coordinates between different coordinate spaces
   * @param {number} value - Value to transform
   * @param {string} fromSpace - Source coordinate space
   * @param {string} toSpace - Target coordinate space
   * @returns {number|null} Transformed value or null if transformation unavailable
   */
  transform: (value, fromSpace, toSpace) => {
    const transformKey = `${fromSpace}_to_${toSpace}`;
    let currentState = null;

    // Get current state
    coordinateStore.subscribe(state => {
      currentState = state;
    })();

    if (!currentState) {
      return null;
    }

    const transforms = new Map(currentState.transforms);

    // Return cached transformation if available
    if (transforms.has(transformKey)) {
      return transforms.get(transformKey)(value);
    }

    // Create new transformation based on spaces
    let transformFunction;

    switch (transformKey) {
      case 'price_to_pixel':
        if (currentState.priceRange.min && currentState.priceRange.max) {
          transformFunction = coordinateActions.createPriceToPixelTransform(currentState);
          // Cache the transformation
          transforms.set(transformKey, transformFunction);
          coordinateStore.update(state => ({ ...state, transforms }));
        }
        break;

      case 'pixel_to_price':
        if (currentState.priceRange.min && currentState.priceRange.max) {
          transformFunction = coordinateActions.createPixelToPriceTransform(currentState);
          // Cache the transformation
          transforms.set(transformKey, transformFunction);
          coordinateStore.update(state => ({ ...state, transforms }));
        }
        break;

      case 'price_to_normalized':
        if (currentState.priceRange.min && currentState.priceRange.max) {
          transformFunction = (price) =>
            (price - currentState.priceRange.min) /
            (currentState.priceRange.max - currentState.priceRange.min);
          // Cache the transformation
          transforms.set(transformKey, transformFunction);
          coordinateStore.update(state => ({ ...state, transforms }));
        }
        break;

      case 'normalized_to_price':
        if (currentState.priceRange.min && currentState.priceRange.max) {
          transformFunction = (normalized) =>
            currentState.priceRange.min +
            (normalized * (currentState.priceRange.max - currentState.priceRange.min));
          // Cache the transformation
          transforms.set(transformKey, transformFunction);
          coordinateStore.update(state => ({ ...state, transforms }));
        }
        break;

      default:
        console.warn(`[COORDINATE_STORE] Unknown transformation: ${transformKey}`);
        return null;
    }

    if (transformFunction) {
      return transformFunction(value);
    }

    return null;
  },

  /**
   * Create price to pixel transformation function
   * @private
   */
  createPriceToPixelTransform: (state) => {
    const { bounds, priceRange } = state;
    const priceExtent = priceRange.max - priceRange.min;
    const yExtent = bounds.y[1] - bounds.y[0];

    return (price) => {
      const normalized = (price - priceRange.min) / priceExtent;
      const y = bounds.y[1] - (normalized * yExtent);
      return Math.round(y);
    };
  },

  /**
   * Create pixel to price transformation function
   * @private
   */
  createPixelToPriceTransform: (state) => {
    const { bounds, priceRange } = state;
    const priceExtent = priceRange.max - priceRange.min;
    const yExtent = bounds.y[1] - bounds.y[0];

    return (y) => {
      const normalized = (bounds.y[1] - y) / yExtent;
      return priceRange.min + (normalized * priceExtent);
    };
  },

  /**
   * Check if a coordinate is within bounds
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {boolean} True if within bounds
   */
  isInBounds: (x, y) => {
    let result = false;

    coordinateStore.subscribe(state => {
      const { bounds } = state;
      result = x >= bounds.x[0] && x <= bounds.x[1] &&
               y >= bounds.y[0] && y <= bounds.y[1];
    })();

    return result;
  },

  /**
   * Clamp coordinates to bounds
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {Object} Clamped coordinates { x, y }
   */
  clampToBounds: (x, y) => {
    let result = { x, y };

    coordinateStore.subscribe(state => {
      const { bounds } = state;
      result = {
        x: Math.max(bounds.x[0], Math.min(bounds.x[1], x)),
        y: Math.max(bounds.y[0], Math.min(bounds.y[1], y))
      };
    })();

    return result;
  },

  /**
   * Reset coordinate system to initial state
   */
  reset: () => {
    coordinateStore.set(initialCoordinateState);
  },

  /**
   * Get current coordinate system information
   * @returns {Object} Current coordinate system state
   */
  getSystemInfo: () => {
    let info = null;

    coordinateStore.subscribe(state => {
      info = {
        system: state.system,
        bounds: state.bounds,
        dpr: state.dpr,
        priceRange: state.priceRange,
        hasValidPriceRange: !!(state.priceRange.min && state.priceRange.max)
      };
    })();

    return info;
  }
};

// =============================================================================
// INTEGRATION HELPERS
// =============================================================================

/**
 * Initialize coordinate store with display configuration
 * Integrates with existing displayStore configuration system
 */
export const initializeCoordinates = (displayConfig) => {
  const { containerSize = { width: 220, height: 120 } } = displayConfig;

  // Update bounds to match display configuration
  coordinateActions.updateBounds({
    x: [0, containerSize.width],
    y: [0, containerSize.height]
  });

  console.log('[COORDINATE_STORE] Initialized with display config:', {
    bounds: {
      x: [0, containerSize.width],
      y: [0, containerSize.height]
    },
    dpr: getDevicePixelRatio()
  });
};

/**
 * Subscribe to market data updates for reactive price range changes
 * Integrates with existing display state management
 */
export const subscribeToMarketData = (displayStore) => {
  let lastPriceData = null;

  return displayStore.subscribe(state => {
    const activeDisplay = state.activeDisplayId ?
      state.displays.get(state.activeDisplayId) : null;

    if (activeDisplay && activeDisplay.state) {
      const { state: displayState } = activeDisplay;

      // Check if price data has changed
      const currentPriceData = {
        midPrice: displayState.midPrice,
        projectedAdrHigh: displayState.projectedAdrHigh,
        projectedAdrLow: displayState.projectedAdrLow,
        todaysHigh: displayState.todaysHigh,
        todaysLow: displayState.todaysLow
      };

      // Only update if essential price data has changed
      if (!lastPriceData ||
          lastPriceData.midPrice !== currentPriceData.midPrice ||
          lastPriceData.projectedAdrHigh !== currentPriceData.projectedAdrHigh ||
          lastPriceData.projectedAdrLow !== currentPriceData.projectedAdrLow) {

        coordinateActions.updatePriceRange(currentPriceData);
        lastPriceData = currentPriceData;
      }
    }
  });
};

// =============================================================================
// EVENT LISTENERS FOR DPR CHANGES
// =============================================================================

/**
 * Listen for zoom/resize events that affect DPR
 */
export const setupDPRListeners = () => {
  // Handle window resize events
  const handleResize = () => {
    coordinateActions.updateDPR();
  };

  // Handle zoom events (where supported)
  const handleZoom = () => {
    coordinateActions.updateDPR();
  };

  // Add event listeners
  window.addEventListener('resize', handleResize);

  // Add zoom detection for browsers that support it
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleZoom);
  }

  console.log('[COORDINATE_STORE] DPR listeners setup complete');

  // Return cleanup function
  return () => {
    window.removeEventListener('resize', handleResize);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', handleZoom);
    }
  };
};

// =============================================================================
// EXPORTS
// =============================================================================

export default coordinateStore;