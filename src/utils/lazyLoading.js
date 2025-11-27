/**
 * Lazy Loading Utilities for Production Build Optimization
 *
 * Provides dynamic imports for heavy modules to enable code splitting
 * and improve initial load times for the trading platform.
 */

// Lazy loading cache to avoid duplicate imports
const importCache = new Map();

/**
 * Dynamically import a visualization module with caching
 * @param {string} modulePath - Path to the module to import
 * @returns {Promise<any>} - Imported module
 */
export async function lazyImport(modulePath) {
  if (importCache.has(modulePath)) {
    return importCache.get(modulePath);
  }

  try {
    const module = await import(modulePath);
    importCache.set(modulePath, module);
    return module;
  } catch (error) {
    console.error(`[LAZY_IMPORT] Failed to load module: ${modulePath}`, error);
    throw new Error(`Failed to load visualization module: ${modulePath}`);
  }
}

/**
 * Load visualization modules on demand
 */
export const VisualizationLoaders = {
  /**
   * Load Market Profile visualization
   */
  async loadMarketProfile() {
    return lazyImport('../lib/viz/marketProfile.js');
  },

  /**
   * Load Volatility Orb visualization
   */
  async loadVolatilityOrb() {
    return lazyImport('../lib/viz/volatilityOrb.js');
  },

  /**
   * Load Day Range Meter visualization
   */
  async loadDayRangeMeter() {
    return lazyImport('../lib/viz/dayRangeMeter.js');
  },

  /**
   * Load Multi-Symbol ADR visualization
   */
  async loadMultiSymbolADR() {
    return lazyImport('../lib/viz/multiSymbolADR.js');
  },

  /**
   * Load Price Float visualization
   */
  async loadPriceFloat() {
    return lazyImport('../lib/viz/priceFloat.js');
  },

  /**
   * Load Price Display visualization
   */
  async loadPriceDisplay() {
    return lazyImport('../lib/viz/priceDisplay.js');
  },

  /**
   * Load Price Markers visualization
   */
  async loadPriceMarkers() {
    return lazyImport('../lib/viz/priceMarkers.js');
  }
};

/**
 * Load performance monitoring modules on demand
 */
export const PerformanceLoaders = {
  /**
   * Load Performance Dashboard
   */
  async loadPerformanceDashboard() {
    return lazyImport('../utils/performanceDashboard.js');
  },

  /**
   * Load Multi-Display Performance Tracker
   */
  async loadMultiDisplayTracker() {
    return lazyImport('../utils/multiDisplayPerformanceTracker.js');
  },

  /**
   * Load Store Performance Monitor
   */
  async loadStorePerformanceMonitor() {
    return lazyImport('../lib/monitoring/storePerformanceMonitor.js');
  },

  /**
   * Load Memory Management Utils
   */
  async loadMemoryManagement() {
    return lazyImport('../utils/memoryManagementUtils.js');
  }
};

/**
 * Load development tools only in development mode
 */
export const DevToolLoaders = {
  /**
   * Load Canvas Sizing Utils
   */
  async loadCanvasSizing() {
    if (__DEV__) {
      return lazyImport('../utils/canvasSizing.js');
    }
    return null;
  },

  /**
   * Load Canvas Rendering Monitor
   */
  async loadCanvasRenderingMonitor() {
    if (__DEV__) {
      return lazyImport('../utils/canvasRenderingMonitor.js');
    }
    return null;
  },

  /**
   * Load Canvas Bounds Logger
   */
  async loadCanvasBoundsLogger() {
    if (__DEV__) {
      return lazyImport('../utils/canvasBoundsLogger.js');
    }
    return null;
  }
};

/**
 * Preload critical visualization modules for better UX
 * @param {string[]} moduleNames - Array of module names to preload
 */
export async function preloadVisualizationModules(moduleNames = []) {
  const preloadPromises = moduleNames.map(async (moduleName) => {
    try {
      switch (moduleName) {
        case 'marketProfile':
          await VisualizationLoaders.loadMarketProfile();
          break;
        case 'volatilityOrb':
          await VisualizationLoaders.loadVolatilityOrb();
          break;
        case 'dayRangeMeter':
          await VisualizationLoaders.loadDayRangeMeter();
          break;
        default:
          console.warn(`[LAZY_IMPORT] Unknown visualization module: ${moduleName}`);
      }
    } catch (error) {
      console.warn(`[LAZY_IMPORT] Failed to preload ${moduleName}:`, error);
    }
  });

  await Promise.allSettled(preloadPromises);
}

/**
 * Component lazy loading utilities
 */
export function createLazyComponent(loader, fallback = null) {
  return {
    load: loader,
    fallback: fallback || (() => null)
  };
}

/**
 * Batch load multiple modules
 * @param {Array<Function>} loaders - Array of loader functions
 * @returns {Promise<Array>} - Array of loaded modules
 */
export async function batchLoad(loaders) {
  const results = await Promise.allSettled(loaders.map(loader => loader()));

  return results.map(result => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      console.error('[LAZY_IMPORT] Batch load failed:', result.reason);
      return null;
    }
  });
}

/**
 * Clear import cache (useful for development or hot reloading)
 */
export function clearImportCache() {
  importCache.clear();
}

/**
 * Get cache statistics for monitoring
 */
export function getImportCacheStats() {
  return {
    size: importCache.size,
    modules: Array.from(importCache.keys())
  };
}