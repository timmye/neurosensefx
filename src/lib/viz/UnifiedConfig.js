/**
 * Unified Configuration Management
 *
 * Provides consistent configuration handling across all NeuroSense FX visualization components.
 * Standardizes percentage-to-decimal conversion, validation, and default values.
 *
 * This eliminates configuration inconsistencies and ensures predictable behavior
 * across all components while maintaining the "simple" philosophy.
 */

/**
 * Configuration schema for all visualization components
 * Defines expected types, default values, and validation rules
 */
export const CONFIG_SCHEMA = {
  // Common configuration fields
  common: {
    opacity: {
      type: 'number',
      default: 0.8,
      min: 0.1,
      max: 1.0,
      isPercentage: false // Already decimal
    },
    useDirectionalColor: {
      type: 'boolean',
      default: false
    },
    glowStrength: {
      type: 'number',
      default: 0,
      min: 0,
      max: 20
    },
    glowColor: {
      type: 'string',
      default: '#FFFFFF'
    }
  },

  // Day Range Meter configuration
  dayRangeMeter: {
    showAdrRangeIndicatorLines: {
      type: 'boolean',
      default: true
    },
    adrLabelType: {
      type: 'string',
      default: 'staticPercentage',
      options: ['staticPercentage', 'dynamicPercentage']
    }
  },

  // Price Float configuration
  priceFloat: {
    priceFloatWidth: {
      type: 'number',
      default: 0.15,
      min: 0.01,
      max: 1.0,
      isPercentage: true // Display as percentage in UI
    },
    priceFloatHeight: {
      type: 'number',
      default: 0.02,
      min: 0.01,
      max: 0.20,
      isPercentage: true
    },
    priceFloatXOffset: {
      type: 'number',
      default: 0,
      min: -0.50,
      max: 0.50,
      isPercentage: true
    },
    priceFloatUseDirectionalColor: {
      type: 'boolean',
      default: false
    },
    priceFloatColor: {
      type: 'string',
      default: '#FFFFFF'
    },
    priceFloatUpColor: {
      type: 'string',
      default: '#3b82f6'
    },
    priceFloatDownColor: {
      type: 'string',
      default: '#ef4444'
    },
    priceFloatGlowStrength: {
      type: 'number',
      default: 0,
      min: 0,
      max: 20
    },
    priceFloatGlowColor: {
      type: 'string',
      default: '#FFFFFF'
    }
  },

  // Price Display configuration
  priceDisplay: {
    priceFontSize: {
      type: 'number',
      default: 0.05,
      min: 0.02,
      max: 0.15,
      isPercentage: true
    },
    priceDisplayPositioning: {
      type: 'string',
      default: 'canvasRelative',
      options: ['canvasRelative', 'adrAxis']
    },
    priceDisplayHorizontalPosition: {
      type: 'number',
      default: 0.02,
      min: 0.0,
      max: 0.5,
      isPercentage: true
    },
    priceDisplayBigFigureRatio: {
      type: 'number',
      default: 0.50,
      min: 0.10,
      max: 0.90,
      isPercentage: true
    },
    priceDisplayPipsRatio: {
      type: 'number',
      default: 0.35,
      min: 0.05,
      max: 0.60,
      isPercentage: true
    },
    priceDisplayPipetteRatio: {
      type: 'number',
      default: 0.15,
      min: 0.05,
      max: 0.30,
      isPercentage: true
    },
    priceDisplayXOffset: {
      type: 'number',
      default: 0,
      min: -0.50,
      max: 0.50,
      isPercentage: true
    },
    priceDisplayUseBackground: {
      type: 'boolean',
      default: true
    },
    priceDisplayBackgroundOpacity: {
      type: 'number',
      default: 0.9,
      min: 0.1,
      max: 1.0,
      isPercentage: false
    },
    showPipetteDigit: {
      type: 'boolean',
      default: true
    },
    showPriceBackground: {
      type: 'boolean',
      default: true
    },
    showPriceBoundingBox: {
      type: 'boolean',
      default: false
    },
    priceDisplayPadding: {
      type: 'number',
      default: 4,
      min: 1,
      max: 10
    },
    priceBackgroundColor: {
      type: 'string',
      default: '#111827'
    },
    priceBoxOutlineColor: {
      type: 'string',
      default: '#4B5563'
    },
    priceBoxOutlineOpacity: {
      type: 'number',
      default: 1.0,
      min: 0.1,
      max: 1.0
    },
    priceUseStaticColor: {
      type: 'boolean',
      default: false
    },
    priceStaticColor: {
      type: 'string',
      default: '#FFFFFF'
    },
    priceUpColor: {
      type: 'string',
      default: '#10B981'
    },
    priceDownColor: {
      type: 'string',
      default: '#EF4444'
    }
  },

  // Market Profile configuration
  marketProfile: {
    marketProfileWidthRatio: {
      type: 'number',
      default: 0.15,
      min: 0.01,
      max: 1.0,
      isPercentage: true
    },
    marketProfileXOffset: {
      type: 'number',
      default: 0,
      min: -0.50,
      max: 0.50,
      isPercentage: true
    },
    marketProfileOpacity: {
      type: 'number',
      default: 0.8,
      min: 0.1,
      max: 1.0,
      isPercentage: false // Already decimal
    },
    marketProfileView: {
      type: 'string',
      default: 'combinedRight',
      options: ['combinedRight', 'combinedLeft', 'separate', 'deltaBoth', 'deltaLeft', 'deltaRight']
    },
    marketProfileWidthMode: {
      type: 'string',
      default: 'responsive',
      options: ['responsive', 'fixed']
    },
    marketProfileMinWidth: {
      type: 'number',
      default: 5,
      min: 1,
      max: 50
    },
    distributionDepthMode: {
      type: 'string',
      default: 'full',
      options: ['full', 'percentage']
    },
    distributionPercentage: {
      type: 'number',
      default: 100,
      min: 10,
      max: 100,
      isPercentage: true
    },
    combinedColor: {
      type: 'string',
      default: '#6b7280'
    },
    sellColor: {
      type: 'string',
      default: '#ef4444'
    },
    buyColor: {
      type: 'string',
      default: '#10b981'
    },
    positiveDeltaColor: {
      type: 'string',
      default: '#10b981'
    },
    negativeDeltaColor: {
      type: 'string',
      default: '#ef4444'
    }
  },

  // Volatility Orb configuration
  volatilityOrb: {
    volatilityOrbBaseWidth: {
      type: 'number',
      default: 0.91,
      min: 0.1,
      max: 1.0,
      isPercentage: true
    },
    volatilitySizeMultiplier: {
      type: 'number',
      default: 1.5,
      min: 0.5,
      max: 3.0
    },
    volatilityOrbRadius: {
      type: 'number',
      default: 8,
      min: 2,
      max: 30
    },
    volatilityOrbXOffset: {
      type: 'number',
      default: 0,
      min: -0.50,
      max: 0.50,
      isPercentage: true
    },
    volatilityOrbYOffset: {
      type: 'number',
      default: 0,
      min: -0.50,
      max: 0.50,
      isPercentage: true
    },
    volatilityOrbMode: {
      type: 'string',
      default: 'gradient',
      options: ['gradient', 'segments', 'pulse', 'radial']
    },
    volatilityOrbColorMode: {
      type: 'string',
      default: 'volatility',
      options: ['volatility', 'momentum', 'custom']
    },
    volatilityOrbUpdateSpeed: {
      type: 'number',
      default: 200,
      min: 100,
      max: 1000
    },
    volatilityOrbUseAlerts: {
      type: 'boolean',
      default: true
    },
    volatilityOrbBackgroundMode: {
      type: 'boolean',
      default: false
    },
    volatilityOrbInvertBrightness: {
      type: 'boolean',
      default: false
    },
    volatilityColorMode: {
      type: 'string',
      default: 'volatility',
      options: ['directional', 'static', 'intensity', 'volatility']
    },
    showVolatilityOrb: {
      type: 'boolean',
      default: true
    },
    volatilityOrbPositionMode: {
      type: 'string',
      default: 'adrAxis',
      options: ['canvasCenter', 'adrAxis']
    },
    showOrbFlash: {
      type: 'boolean',
      default: false
    },
    orbFlashThreshold: {
      type: 'number',
      default: 2.0,
      min: 0.5,
      max: 10.0
    },
    orbFlashIntensity: {
      type: 'number',
      default: 0.8,
      min: 0.1,
      max: 1.0
    },
    showVolatilityMetric: {
      type: 'boolean',
      default: true
    },
    priceDisplayPadding: {
      type: 'number',
      default: 2,
      min: 1,
      max: 10
    }
  }
};

/**
 * Unified configuration validator and normalizer
 */
export class UnifiedConfig {
  
  /**
   * Validate and normalize a single configuration value
   * @param {*} value - Value to validate
   * @param {Object} fieldSchema - Schema definition for the field
   * @returns {*} Validated and normalized value
   */
  static validateField(value, fieldSchema) {
    const { type, default: defaultValue, min, max, options } = fieldSchema;

    // Handle type conversion
    let normalizedValue;
    switch (type) {
      case 'number':
        normalizedValue = typeof value === 'number' ? value : defaultValue;
        break;
      case 'boolean':
        normalizedValue = typeof value === 'boolean' ? value : defaultValue;
        break;
      case 'string':
        normalizedValue = typeof value === 'string' ? value : defaultValue;
        break;
      default:
        normalizedValue = defaultValue;
    }

    // Apply constraints
    if (type === 'number') {
      if (min !== undefined) normalizedValue = Math.max(min, normalizedValue);
      if (max !== undefined) normalizedValue = Math.min(max, normalizedValue);
    }

    // Validate options
    if (options && !options.includes(normalizedValue)) {
      console.warn(`[UnifiedConfig] Invalid option "${normalizedValue}", using default "${defaultValue}"`);
      return defaultValue;
    }

    return normalizedValue;
  }

  /**
   * Validate and normalize configuration for a specific component
   * @param {Object} config - Raw configuration object
   * @param {string} componentType - Component type (e.g., 'priceFloat', 'marketProfile')
   * @returns {Object} Validated and normalized configuration
   */
  static validateComponentConfig(config, componentType) {
    const componentSchema = CONFIG_SCHEMA[componentType];
    const commonSchema = CONFIG_SCHEMA.common;

    if (!componentSchema) {
      console.warn(`[UnifiedConfig] Unknown component type: ${componentType}`);
      return this.validateCommonConfig(config);
    }

    const normalizedConfig = {};

    // Validate common fields
    for (const [fieldName, fieldSchema] of Object.entries(commonSchema)) {
      normalizedConfig[fieldName] = this.validateField(config[fieldName], fieldSchema);
    }

    // Validate component-specific fields
    for (const [fieldName, fieldSchema] of Object.entries(componentSchema)) {
      normalizedConfig[fieldName] = this.validateField(config[fieldName], fieldSchema);
    }

    return normalizedConfig;
  }

  /**
   * Validate common configuration fields
   * @param {Object} config - Raw configuration object
   * @returns {Object} Validated common configuration
   */
  static validateCommonConfig(config) {
    const normalizedConfig = {};
    const commonSchema = CONFIG_SCHEMA.common;

    for (const [fieldName, fieldSchema] of Object.entries(commonSchema)) {
      normalizedConfig[fieldName] = this.validateField(config[fieldName], fieldSchema);
    }

    return normalizedConfig;
  }

  /**
   * Get default configuration for a component
   * @param {string} componentType - Component type
   * @returns {Object} Default configuration
   */
  static getDefaultConfig(componentType) {
    const componentSchema = CONFIG_SCHEMA[componentType];
    const commonSchema = CONFIG_SCHEMA.common;

    const defaultConfig = {};

    // Add common defaults
    for (const [fieldName, fieldSchema] of Object.entries(commonSchema)) {
      defaultConfig[fieldName] = fieldSchema.default;
    }

    // Add component-specific defaults
    if (componentSchema) {
      for (const [fieldName, fieldSchema] of Object.entries(componentSchema)) {
        defaultConfig[fieldName] = fieldSchema.default;
      }
    }

    return defaultConfig;
  }

  /**
   * Merge user configuration with defaults, ensuring all required fields exist
   * @param {Object} userConfig - User-provided configuration
   * @param {string} componentType - Component type
   * @returns {Object} Complete, validated configuration
   */
  static mergeWithDefaults(userConfig, componentType) {
    const defaultConfig = this.getDefaultConfig(componentType);
    const mergedConfig = { ...defaultConfig, ...userConfig };

    return this.validateComponentConfig(mergedConfig, componentType);
  }

  /**
   * Calculate content-relative dimensions
   * @param {Object} contentArea - Content area dimensions
   * @param {Object} config - Configuration object
   * @param {Object} dimensionMap - Map of config fields to dimension names
   * @returns {Object} Calculated dimensions in pixels
   */
  static calculateDimensions(contentArea, config, dimensionMap) {
    const dimensions = {};

    for (const [dimensionName, configField] of Object.entries(dimensionMap)) {
      const value = config[configField];
      if (value !== undefined) {
        // Assume value is already normalized to decimal
        dimensions[dimensionName] = contentArea.width * value;
      }
    }

    return dimensions;
  }

  /**
   * Validate cross-component parameter consistency
   * @param {Object} allConfigs - All component configurations
   * @returns {Array} Array of validation warnings
   */
  static validateCrossComponentConsistency(allConfigs) {
    const warnings = [];

    // Check for logical inconsistencies
    const priceFloatConfig = allConfigs.priceFloat;
    const priceDisplayConfig = allConfigs.priceDisplay;

    if (priceFloatConfig && priceDisplayConfig) {
      // Warn if both components use large width ratios
      const floatWidth = priceFloatConfig.priceFloatWidth;
      const displayWidth = priceDisplayConfig.priceDisplayXOffset;

      if (floatWidth > 0.3 && displayWidth > 0.3) {
        warnings.push('Price float and display may overlap with large width ratios');
      }
    }

    return warnings;
  }
}

/**
 * Convenience function for component configuration validation
 * @param {Object} config - Raw configuration
 * @param {string} componentType - Component type
 * @returns {Object} Validated configuration
 */
export function validateConfig(config, componentType) {
  return UnifiedConfig.validateComponentConfig(config, componentType);
}

/**
 * Convenience function for getting default configuration
 * @param {string} componentType - Component type
 * @returns {Object} Default configuration
 */
export function getDefaultConfig(componentType) {
  return UnifiedConfig.getDefaultConfig(componentType);
}

/**
 * Convenience function for merging configuration with defaults
 * @param {Object} userConfig - User configuration
 * @param {string} componentType - Component type
 * @returns {Object} Complete configuration
 */
export function mergeConfig(userConfig, componentType) {
  return UnifiedConfig.mergeWithDefaults(userConfig, componentType);
}