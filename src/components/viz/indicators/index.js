/**
 * Indicator Registry
 * Manages all available indicators and their metadata
 */

import BaseIndicator from './BaseIndicator.js';

// Import all indicator classes
import { PriceFloatIndicator } from './PriceFloatIndicator.js';
import { MarketProfileIndicator } from './MarketProfileIndicator.js';
import { VolatilityOrbIndicator } from './VolatilityOrbIndicator.js';
import { ADRMeterIndicator } from './ADRMeterIndicator.js';
import { PriceDisplayIndicator } from './PriceDisplayIndicator.js';

/**
 * Indicator Registry Class
 * Provides centralized management of all indicators
 */
export class IndicatorRegistry {
  constructor() {
    this.indicators = new Map();
    this.metadata = new Map();
    this.instances = new Map();
    
    // Register built-in indicators
    this.registerBuiltInIndicators();
  }
  
  /**
   * Register built-in indicators
   */
  registerBuiltInIndicators() {
    this.register('priceFloat', PriceFloatIndicator, {
      name: 'Price Float',
      description: 'Horizontal line showing current price',
      category: 'price',
      icon: 'trending-up',
      defaultSettings: {
        width: 100,
        height: 4,
        color: '#a78bfa',
        glow: true,
        xOffset: 0,
        yOffset: 0
      },
      presets: {
        minimal: { width: 80, height: 2, glow: false },
        detailed: { width: 120, height: 6, glow: true },
        performance: { width: 60, height: 2, glow: false }
      }
    });
    
    this.register('marketProfile', MarketProfileIndicator, {
      name: 'Market Profile',
      description: 'Price distribution over time',
      category: 'volume',
      icon: 'bar-chart',
      defaultSettings: {
        width: 1.0,
        opacity: 0.7,
        showOutline: true,
        colorScheme: 'default'
      },
      presets: {
        minimal: { opacity: 0.5, showOutline: false },
        detailed: { opacity: 0.8, showOutline: true },
        performance: { opacity: 0.4, showOutline: false }
      }
    });
    
    this.register('volatilityOrb', VolatilityOrbIndicator, {
      name: 'Volatility Orb',
      description: 'Circular volatility visualization',
      category: 'volatility',
      icon: 'activity',
      defaultSettings: {
        baseWidth: 200,
        colorMode: 'directional',
        showMetric: true,
        animationSpeed: 'medium'
      },
      presets: {
        minimal: { baseWidth: 150, showMetric: false },
        detailed: { baseWidth: 250, showMetric: true },
        performance: { baseWidth: 100, showMetric: false, animationSpeed: 'fast' }
      }
    });
    
    this.register('adrMeter', ADRMeterIndicator, {
      name: 'ADR Meter',
      description: 'Average daily range indicator',
      category: 'range',
      icon: 'target',
      defaultSettings: {
        showPulse: true,
        threshold: 10,
        color: '#3b82f6',
        orientation: 'vertical'
      },
      presets: {
        minimal: { showPulse: false },
        detailed: { showPulse: true, threshold: 15 },
        performance: { showPulse: false, threshold: 5 }
      }
    });
    
    this.register('priceDisplay', PriceDisplayIndicator, {
      name: 'Price Display',
      description: 'Numeric price display',
      category: 'price',
      icon: 'dollar-sign',
      defaultSettings: {
        fontSize: 16,
        showPipettes: true,
        fontFamily: 'mono',
        format: 'decimal'
      },
      presets: {
        minimal: { fontSize: 12, showPipettes: false },
        detailed: { fontSize: 20, showPipettes: true },
        performance: { fontSize: 14, showPipettes: false }
      }
    });
  }
  
  /**
   * Register an indicator
   * @param {string} id - Unique indicator ID
   * @param {Class} IndicatorClass - Indicator class
   * @param {Object} metadata - Indicator metadata
   */
  register(id, IndicatorClass, metadata) {
    if (!IndicatorClass || typeof IndicatorClass !== 'function') {
      throw new Error('IndicatorClass must be a valid constructor function');
    }
    
    if (!(IndicatorClass.prototype instanceof BaseIndicator)) {
      throw new Error('IndicatorClass must extend BaseIndicator');
    }
    
    this.indicators.set(id, IndicatorClass);
    this.metadata.set(id, {
      id,
      ...metadata,
      registeredAt: new Date().toISOString()
    });
  }
  
  /**
   * Unregister an indicator
   * @param {string} id - Indicator ID to unregister
   */
  unregister(id) {
    // Clean up any active instances
    if (this.instances.has(id)) {
      const instances = this.instances.get(id);
      instances.forEach(instance => instance.destroy());
      this.instances.delete(id);
    }
    
    this.indicators.delete(id);
    this.metadata.delete(id);
  }
  
  /**
   * Create an indicator instance
   * @param {string} id - Indicator ID
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} settings - Indicator settings
   * @returns {BaseIndicator} Indicator instance
   */
  create(id, ctx, settings = {}) {
    const IndicatorClass = this.indicators.get(id);
    if (!IndicatorClass) {
      throw new Error(`Indicator not found: ${id}`);
    }
    
    const metadata = this.metadata.get(id);
    const mergedSettings = { ...metadata.defaultSettings, ...settings };
    
    const instance = new IndicatorClass(ctx, mergedSettings);
    
    // Store instance for cleanup
    if (!this.instances.has(id)) {
      this.instances.set(id, new Set());
    }
    this.instances.get(id).add(instance);
    
    return instance;
  }
  
  /**
   * Get indicator class by ID
   * @param {string} id - Indicator ID
   * @returns {Class} Indicator class
   */
  getIndicatorClass(id) {
    return this.indicators.get(id);
  }
  
  /**
   * Get indicator metadata by ID
   * @param {string} id - Indicator ID
   * @returns {Object} Indicator metadata
   */
  getMetadata(id) {
    return this.metadata.get(id);
  }
  
  /**
   * Get all registered indicator IDs
   * @returns {Array<string>} Array of indicator IDs
   */
  getIndicatorIds() {
    return Array.from(this.indicators.keys());
  }
  
  /**
   * Get all indicators by category
   * @param {string} category - Category name
   * @returns {Array<Object>} Array of indicator metadata
   */
  getIndicatorsByCategory(category) {
    const indicators = [];
    
    for (const [id, metadata] of this.metadata) {
      if (metadata.category === category) {
        indicators.push(metadata);
      }
    }
    
    return indicators;
  }
  
  /**
   * Get all available categories
   * @returns {Array<string>} Array of category names
   */
  getCategories() {
    const categories = new Set();
    
    for (const metadata of this.metadata.values()) {
      categories.add(metadata.category);
    }
    
    return Array.from(categories).sort();
  }
  
  /**
   * Search indicators by name or description
   * @param {string} query - Search query
   * @returns {Array<Object>} Array of matching indicator metadata
   */
  search(query) {
    const results = [];
    const lowerQuery = query.toLowerCase();
    
    for (const [id, metadata] of this.metadata) {
      const searchText = `${metadata.name} ${metadata.description} ${id}`.toLowerCase();
      if (searchText.includes(lowerQuery)) {
        results.push(metadata);
      }
    }
    
    return results;
  }
  
  /**
   * Get indicator presets
   * @param {string} id - Indicator ID
   * @returns {Object} Indicator presets
   */
  getPresets(id) {
    const metadata = this.metadata.get(id);
    return metadata?.presets || {};
  }
  
  /**
   * Apply preset to indicator settings
   * @param {string} id - Indicator ID
   * @param {string} presetName - Preset name
   * @param {Object} currentSettings - Current settings
   * @returns {Object} Updated settings
   */
  applyPreset(id, presetName, currentSettings = {}) {
    const metadata = this.metadata.get(id);
    if (!metadata || !metadata.presets[presetName]) {
      throw new Error(`Preset not found: ${presetName} for indicator: ${id}`);
    }
    
    const defaultSettings = metadata.defaultSettings;
    const presetSettings = metadata.presets[presetName];
    
    return {
      ...defaultSettings,
      ...currentSettings,
      ...presetSettings
    };
  }
  
  /**
   * Validate indicator settings
   * @param {string} id - Indicator ID
   * @param {Object} settings - Settings to validate
   * @returns {Object} Validation result
   */
  validateSettings(id, settings) {
    const metadata = this.metadata.get(id);
    if (!metadata) {
      return { valid: false, errors: [`Indicator not found: ${id}`] };
    }
    
    const errors = [];
    
    // Basic validation against default settings structure
    const defaultSettings = metadata.defaultSettings;
    for (const key in settings) {
      if (!(key in defaultSettings)) {
        errors.push(`Unknown setting: ${key}`);
      }
    }
    
    // Type validation
    for (const key in settings) {
      const defaultValue = defaultSettings[key];
      const value = settings[key];
      
      if (typeof value !== typeof defaultValue) {
        errors.push(`Invalid type for ${key}: expected ${typeof defaultValue}, got ${typeof value}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Get performance metrics for all indicators
   * @returns {Object} Performance metrics by indicator ID
   */
  getPerformanceMetrics() {
    const metrics = {};
    
    for (const [id, instances] of this.instances) {
      const instanceMetrics = [];
      
      instances.forEach(instance => {
        if (instance.getPerformanceMetrics) {
          instanceMetrics.push(instance.getPerformanceMetrics());
        }
      });
      
      if (instanceMetrics.length > 0) {
        metrics[id] = {
          instanceCount: instanceMetrics.length,
          averageRenderTime: instanceMetrics.reduce((sum, m) => sum + m.averageRenderTime, 0) / instanceMetrics.length,
          totalRenderCount: instanceMetrics.reduce((sum, m) => sum + m.renderCount, 0),
          averageCacheSize: instanceMetrics.reduce((sum, m) => sum + m.cacheSize, 0) / instanceMetrics.length
        };
      }
    }
    
    return metrics;
  }
  
  /**
   * Clean up all indicator instances
   */
  destroy() {
    for (const [id, instances] of this.instances) {
      instances.forEach(instance => instance.destroy());
    }
    
    this.instances.clear();
    this.indicators.clear();
    this.metadata.clear();
  }
  
  /**
   * Export registry configuration
   * @returns {Object} Exportable configuration
   */
  export() {
    const config = {
      indicators: {},
      metadata: {},
      exportedAt: new Date().toISOString()
    };
    
    for (const [id, metadata] of this.metadata) {
      config.metadata[id] = {
        ...metadata,
        registeredAt: undefined // Remove runtime metadata
      };
    }
    
    return config;
  }
  
  /**
   * Get registry statistics
   * @returns {Object} Registry statistics
   */
  getStats() {
    const categories = this.getCategories();
    const stats = {
      totalIndicators: this.indicators.size,
      totalCategories: categories.length,
      totalInstances: 0,
      categories: {}
    };
    
    for (const category of categories) {
      const indicators = this.getIndicatorsByCategory(category);
      stats.categories[category] = indicators.length;
    }
    
    for (const instances of this.instances.values()) {
      stats.totalInstances += instances.size;
    }
    
    return stats;
  }
}

// Create global registry instance
export const indicatorRegistry = new IndicatorRegistry();

// Export individual indicators for direct use
export {
  BaseIndicator,
  PriceFloatIndicator,
  MarketProfileIndicator,
  VolatilityOrbIndicator,
  ADRMeterIndicator,
  PriceDisplayIndicator
};

// Export registry as default
export default indicatorRegistry;

/**
 * Utility function to create indicator with error handling
 * @param {string} id - Indicator ID
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} settings - Indicator settings
 * @returns {BaseIndicator|null} Indicator instance or null if error
 */
export function createIndicator(id, ctx, settings = {}) {
  try {
    return indicatorRegistry.create(id, ctx, settings);
  } catch (error) {
    console.error(`Failed to create indicator ${id}:`, error);
    return null;
  }
}

/**
 * Utility function to get all available indicators
 * @returns {Array<Object>} Array of indicator metadata
 */
export function getAvailableIndicators() {
  return indicatorRegistry.getIndicatorIds().map(id => ({
    id,
    ...indicatorRegistry.getMetadata(id)
  }));
}

/**
 * Utility function to get indicators by category
 * @param {string} category - Category name
 * @returns {Array<Object>} Array of indicator metadata
 */
export function getIndicatorsByCategory(category) {
  return indicatorRegistry.getIndicatorsByCategory(category);
}

/**
 * Utility function to search indicators
 * @param {string} query - Search query
 * @returns {Array<Object>} Array of matching indicator metadata
 */
export function searchIndicators(query) {
  return indicatorRegistry.search(query);
}
