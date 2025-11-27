/**
 * Lazy Visualization Manager
 *
 * Manages dynamic loading of visualization modules to improve
 * initial load times and enable code splitting for production builds.
 */

import { VisualizationLoaders, preloadVisualizationModules } from '../../utils/lazyLoading.js';

class LazyVisualizationManager {
  constructor() {
    this.loadedModules = new Set();
    this.loadingPromises = new Map();
    this.preloadQueue = [];
  }

  /**
   * Load a visualization module on demand
   * @param {string} vizType - Type of visualization to load
   * @returns {Promise<Object>} - Loaded visualization module
   */
  async loadVisualization(vizType) {
    // Return cached module if already loaded
    if (this.loadedModules.has(vizType)) {
      return this.getLoadedModule(vizType);
    }

    // Return existing promise if currently loading
    if (this.loadingPromises.has(vizType)) {
      return this.loadingPromises.get(vizType);
    }

    // Load the module
    const loadingPromise = this.performLoad(vizType);
    this.loadingPromises.set(vizType, loadingPromise);

    try {
      const module = await loadingPromise;
      this.loadedModules.add(vizType);
      this.loadingPromises.delete(vizType);
      return module;
    } catch (error) {
      this.loadingPromises.delete(vizType);
      throw error;
    }
  }

  /**
   * Perform the actual module loading
   * @param {string} vizType - Type of visualization
   * @returns {Promise<Object>} - Loaded module
   */
  async performLoad(vizType) {
    switch (vizType) {
      case 'marketProfile':
        return await VisualizationLoaders.loadMarketProfile();

      case 'volatilityOrb':
        return await VisualizationLoaders.loadVolatilityOrb();

      case 'dayRangeMeter':
        return await VisualizationLoaders.loadDayRangeMeter();

      case 'multiSymbolADR':
        return await VisualizationLoaders.loadMultiSymbolADR();

      case 'priceFloat':
        return await VisualizationLoaders.loadPriceFloat();

      case 'priceDisplay':
        return await VisualizationLoaders.loadPriceDisplay();

      case 'priceMarkers':
        return await VisualizationLoaders.loadPriceMarkers();

      default:
        throw new Error(`Unknown visualization type: ${vizType}`);
    }
  }

  /**
   * Get already loaded module
   * @param {string} vizType - Type of visualization
   * @returns {Object|null} - Loaded module or null if not loaded
   */
  getLoadedModule(vizType) {
    // This would be implemented based on how modules are cached in lazyLoading.js
    // For now, return a placeholder
    return null;
  }

  /**
   * Check if a visualization module is loaded
   * @param {string} vizType - Type of visualization
   * @returns {boolean} - Whether module is loaded
   */
  isLoaded(vizType) {
    return this.loadedModules.has(vizType);
  }

  /**
   * Preload common visualization modules
   * @param {string[]} vizTypes - Array of visualization types to preload
   */
  async preloadVisualizations(vizTypes = ['marketProfile', 'volatilityOrb']) {
    const preloadPromises = vizTypes.map(vizType =>
      this.loadVisualization(vizType).catch(error => {
        console.warn(`[LAZY_VIZ] Failed to preload ${vizType}:`, error);
        return null;
      })
    );

    await Promise.allSettled(preloadPromises);
  }

  /**
   * Get loading statistics
   * @returns {Object} - Loading statistics
   */
  getStats() {
    return {
      loaded: this.loadedModules.size,
      loading: this.loadingPromises.size,
      loadedTypes: Array.from(this.loadedModules),
      loadingTypes: Array.from(this.loadingPromises.keys())
    };
  }

  /**
   * Clear all loaded modules (useful for testing)
   */
  clear() {
    this.loadedModules.clear();
    this.loadingPromises.clear();
  }
}

// Create singleton instance
export const lazyVizManager = new LazyVisualizationManager();

/**
 * Utility function to create a visualization renderer with lazy loading
 * @param {string} vizType - Type of visualization
 * @param {Object} config - Visualization configuration
 * @returns {Promise<Object>} - Visualization renderer instance
 */
export async function createVisualizationRenderer(vizType, config) {
  try {
    const vizModule = await lazyVizManager.loadVisualization(vizType);

    // Create visualization instance based on type
    switch (vizType) {
      case 'marketProfile':
        return new vizModule.MarketProfile(config);

      case 'volatilityOrb':
        return new vizModule.VolatilityOrb(config);

      case 'dayRangeMeter':
        return new vizModule.DayRangeMeter(config);

      case 'multiSymbolADR':
        return new vizModule.MultiSymbolADR(config);

      default:
        throw new Error(`No renderer available for visualization type: ${vizType}`);
    }
  } catch (error) {
    console.error(`[LAZY_VIZ] Failed to create renderer for ${vizType}:`, error);
    throw error;
  }
}

/**
 * Initialize preloading for critical visualizations
 */
export function initializeVisualizationPreloading() {
  // Preload common visualizations after initial app load
  setTimeout(() => {
    lazyVizManager.preloadVisualizations([
      'marketProfile',
      'volatilityOrb',
      'dayRangeMeter'
    ]).then(() => {
      console.log('[LAZY_VIZ] Critical visualizations preloaded');
    });
  }, 1000); // Start preloading after 1 second
}

export default lazyVizManager;