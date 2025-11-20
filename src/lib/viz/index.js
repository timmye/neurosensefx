/**
 * Unified Visualization Components Index
 *
 * This file provides a unified entry point for all NeuroSense FX visualization components.
 * It exports the refactored components that use the unified foundation patterns while maintaining
 * the "simple" philosophy and excellent performance characteristics.
 *
 * Key Features:
 * - Unified component architecture with consistent patterns
 * - DPR-aware rendering for crisp 1px lines
 * - Performance optimization through bounds checking
 * - Configuration management with percentage-to-decimal conversion
 * - Comprehensive enhancement system
 * - Performance monitoring and benchmarking
 */

// Core unified components
export { drawDayRangeMeter } from './dayRangeMeter.js';
export { drawPriceFloat } from './priceFloat.js';
export { drawPriceDisplay } from './priceDisplay.js';
export { drawMarketProfile } from './marketProfile.js';
export { drawVolatilityOrb } from './volatilityOrb.js';
// Unified foundation systems
export { UnifiedVisualization, createVisualization } from './UnifiedVisualization.js';
export {
  UnifiedConfig,
  validateConfig,
  mergeConfig,
  getDefaultConfig,
  CONFIG_SCHEMA
} from './UnifiedConfig.js';
export {
  decimalToPercentage,
  percentageToDecimal,
  formatConfigValue,
  parseConfigInput,
  createPercentageSliderConfig,
  createNumberInputConfig,
  DISPLAY_FORMATTERS,
  INPUT_PARSERS,
  getDisplayFormatter,
  getInputParser
} from './UIDisplayUtils.js';
export {
  EnhancementSystem,
  createEnhancementSystem,
  COMMON_ENHANCEMENTS,
  ENHANCEMENT_TYPES,
  EnhancementUtils
} from './EnhancementSystem.js';
export {
  PerformanceMonitor,
  getPerformanceMonitor,
  monitorPerformance,
  PerformanceUtils,
  PERFORMANCE_THRESHOLDS
} from './PerformanceMonitor.js';

// Additional visualization utilities
export { default as priceMarkers } from './priceMarkers.js';
export { default as volatilityMetric } from './volatilityMetric.js';
export { default as marketPulse } from './marketPulse.js';

/**
 * Component Registry
 * Central registry for all visualization components with their metadata
 */
export const VISUALIZATION_COMPONENTS = {
  dayRangeMeter: {
    name: 'Day Range Meter',
    description: 'Foundation component displaying daily price range with ADR context',
    drawFunction: 'drawDayRangeMeter',
    category: 'foundation',
    complexity: 'low',
    features: ['ADR visualization', 'price markers', 'percentage indicators']
  },

  priceFloat: {
    name: 'Price Float',
    description: 'Floating price indicator with directional coloring',
    drawFunction: 'drawPriceFloat',
    category: 'indicator',
    complexity: 'low',
    features: ['real-time price tracking', 'directional coloring', 'glow effects']
  },

  priceDisplay: {
    name: 'Price Display',
    description: 'Advanced price display with configurable formatting',
    drawFunction: 'drawPriceDisplay',
    category: 'display',
    complexity: 'medium',
    features: ['big figure display', 'pip formatting', 'background styling']
  },

  marketProfile: {
    name: 'Market Profile',
    description: 'Volume analysis with 6 rendering modes including delta analysis',
    drawFunction: 'drawMarketProfile',
    category: 'analysis',
    complexity: 'high',
    features: ['6 rendering modes', 'delta analysis', 'volume profiling', 'responsive sizing']
  },

  volatilityOrb: {
    name: 'Volatility Orb',
    description: 'Background volatility visualization with multi-mode rendering and flash alerts',
    drawFunction: 'drawVolatilityOrb',
    category: 'background',
    complexity: 'medium',
    features: ['3 color modes', 'volatility-responsive sizing', 'flash alerts', 'soft gradient rendering']
  }
};

/**
 * Version information
 */
export const VISUALIZATION_SYSTEM_VERSION = '1.0.0-unified';
