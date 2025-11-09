// =============================================================================
// CONFIGURATION DEFAULTS MANAGER
// =============================================================================
// Factory defaults management and validation for workspace persistence
// Provides clean separation between original defaults and user modifications

import { VisualizationConfigSchema } from '../data/schema.js';

// =============================================================================
// FACTORY DEFAULTS (original values that never change)
// =============================================================================

export const FACTORY_DEFAULTS = {
  // === CONTAINER LAYOUT ===
  containerSize: { width: 220, height: 160 },     // Full display including header (220×120 content + 40px header)
  headerHeight: 40,                                // Header area height
  
  // === LAYOUT & SIZING ===
  visualizationsContentWidth: 1.0,                    // 100% of canvas width
  meterHeight: 0.75,                                 // 75% of canvas height (120px - 40px header = 80px, so 75% = 60px)
  adrAxisPosition: 0.75,                             // 75% of canvas width (35% right of center)
  adrAxisBounds: { min: 5, max: 95 },             // 5%-95% of content width
  
  // === VISUALIZATION PARAMETERS (content-relative) ===
  adrRange: 100,
  adrLookbackDays: 14,
  adrProximityThreshold: 10,
  adrPulseColor: '#3B82F6',
  adrPulseWidthRatio: 1,
  adrPulseHeight: 2,

  // === ADR RANGE INDICATOR ===
  showAdrRangeIndicatorLines: true,
  adrRangeIndicatorLinesColor: '#9CA3AF',
  adrRangeIndicatorLinesThickness: 1,
  showAdrRangeIndicatorLabel: true,
  adrRangeIndicatorLabelColor: '#E5E7EB',
  adrRangeIndicatorLabelShowBackground: true,
  adrRangeIndicatorLabelBackgroundColor: '#1F2937',
  adrRangeIndicatorLabelBackgroundOpacity: 0.8,
  adrLabelType: 'staticPercentage',
  adrRangeIndicatorLabelShowBoxOutline: true,
  adrRangeIndicatorLabelBoxOutlineColor: '#4B5563',
  adrRangeIndicatorLabelBoxOutlineOpacity: 1,

  // === LABELS (PH/PL, OHL) ===
  pHighLowLabelSide: 'right',
  ohlLabelSide: 'right',
  pHighLowLabelShowBackground: true,
  pHighLowLabelBackgroundColor: '#1f2937',
  pHighLowLabelBackgroundOpacity: 0.7,
  pHighLowLabelShowBoxOutline: false,
  pHighLowLabelBoxOutlineColor: '#4b5563',
  pHighLowLabelBoxOutlineOpacity: 1,
  ohlLabelShowBackground: true,
  ohlLabelBackgroundColor: '#1f2937',
  ohlLabelBackgroundOpacity: 0.7,
  ohlLabelShowBoxOutline: false,
  ohlLabelBoxOutlineColor: '#4b5563',
  ohlLabelBoxOutlineOpacity: 1,

  // === PRICE FLOAT & DISPLAY (content-relative) ===
  priceFloatWidth: 0.02,                             // 15% of content width (33px on 220px canvas) - converted to decimal
  priceFloatHeight: 0.02,                            // 2% of content height (2.4px on 120px canvas) - converted to decimal
  priceFloatXOffset: 0,                               // 0% of content width
  priceFloatUseDirectionalColor: false,
  priceFloatColor: '#FFFFFF',
  priceFloatUpColor: '#3b82f6',
  priceFloatDownColor: '#a78bfa',
  showPriceFloatPulse: false,
  priceFloatPulseThreshold: 0.5,
  priceFloatPulseColor: 'rgba(167, 139, 250, 0.8)',
  priceFloatPulseScale: 1.5,
  priceFontSize: 0.2,                                 // % of content height (MINIMUM: User requested minimum 5%) - converted to decimal
  priceFontWeight: '600',
  priceDisplayPositioning: 'canvasRelative',             // Positioning mode: 'canvasRelative' or 'adrAxis'
  priceDisplayHorizontalPosition: 0.02,                 // ✅ FIXED: 2% from left edge - converted to decimal
  priceDisplayXOffset: 0,                              // 0% offset from base position (DIFFERENT PURPOSE: fine-tuning)
  priceDisplayPadding: 4,                               // 4px/ padding (absolute pixels)
  bigFigureFontSizeRatio: 0.6,                         
  pipFontSizeRatio: 1,                               
  pipetteFontSizeRatio: 0.4,                           
  showPipetteDigit: false,
  priceUseStaticColor: false,
  priceStaticColor: '#d1d5db',
  priceUpColor: '#3b82f6',
  priceDownColor: '#a78bfa',
  showPriceBackground: true,
  priceBackgroundColor: '#111827',
  priceBackgroundOpacity: 0.5,
  showPriceBoundingBox: false,
  priceBoxOutlineColor: '#4b5563',
  priceBoxOutlineOpacity: 1,
  
  // === VOLATILITY ORB (content-relative) ===
  showVolatilityOrb: true,
  volatilityColorMode: 'static',
  volatilityOrbBaseWidth: 0.91,                        // 91% of content width
  volatilityOrbInvertBrightness: false,
  volatilitySizeMultiplier: 1.5,
  showVolatilityMetric: true,
  
  // === EVENT HIGHLIGHTING ===
  showFlash: false,
  flashThreshold: 2.0,
  flashIntensity: 0.3,
  showOrbFlash: false,
  orbFlashThreshold: 2.0,
  orbFlashIntensity: 0.8,
  
  // === MARKET PROFILE (NEW CLEAN SLATE IMPLEMENTATION) ===
  showMarketProfile: true,

  // === CORE ANALYSIS CONFIGURATION ===
  analysisType: 'volumeDistribution',     // 'volumeDistribution' | 'deltaPressure'
  renderingStyle: 'silhouette',           // 'silhouette' | 'barBased' | 'hybrid'
  positioning: 'right',                   // 'left' | 'right' | 'separate'

  // === SILHOUETTE RENDERING PROPERTIES ===
  silhouetteOutline: true,
  silhouetteOutlineWidth: 1,
  silhouetteFill: true,
  silhouetteFillOpacity: 0.3,
  silhouetteOutlineColor: '#374151',

  // === BAR-BASED RENDERING PROPERTIES ===
  barWidthRatio: 15,                      // Max bar width as % of canvas (not decimal)
  barMinWidth: 5,                         // Minimum bar width constraint (px)

  // === VISUAL PROPERTIES ===
  marketProfileOpacity: 0.7,              // Overall opacity (0.1-1.0)
  marketProfileXOffset: 0,                // Horizontal offset % from ADR axis

  // === VISUAL ENHANCEMENTS ===
  showMaxMarker: true,                    // Point of control marker
  marketProfileMarkerFontSize: 10,        // Font size for max volume marker

  // === COLOR SCHEME ===
  marketProfileUpColor: '#10B981',        // Green for positive/buy pressure
  marketProfileDownColor: '#EF4444',      // Red for negative/sell pressure

  // === DATA FILTERING ===
  distributionDepthMode: 'all',          // 'percentage' | 'all'
  distributionPercentage: 50,             // Show top X% of volume levels (1-100)
  deltaThreshold: 0,                      // Minimum delta magnitude for display

  // === PRICE MARKERS ===
  markerLineColor: '#FFFFFF',
  markerLineThickness: 1,

  // === HOVER INDICATOR ===
  hoverLabelShowBackground: true,
  hoverLabelBackgroundColor: '#000000',
  hoverLabelBackgroundOpacity: 0.7,

  // === SIMULATION ===
  frequencyMode: 'normal'
};

// =============================================================================
// CONFIGURATION DEFAULTS MANAGER CLASS
// =============================================================================

export class ConfigDefaultsManager {
  constructor() {
    this.factoryDefaults = { ...FACTORY_DEFAULTS };
    this.currentUserDefaults = {};
    this.isActive = false;
  }

  /**
   * Get factory defaults (original values)
   * @returns {Object} Complete factory defaults
   */
  getFactoryDefaults() {
    return { ...this.factoryDefaults };
  }

  /**
   * Get user defaults (modified values)
   * @returns {Object} User-modified defaults
   */
  getUserDefaults() {
    return { ...this.currentUserDefaults };
  }

  /**
   * Get effective defaults (factory + user overrides)
   * @returns {Object} Merged defaults for new displays
   */
  getEffectiveDefaults() {
    return this.isActive ? 
      { ...this.factoryDefaults, ...this.currentUserDefaults } : 
      { ...this.factoryDefaults };
  }

  /**
   * Update user defaults
   * @param {Object} userDefaults - Partial user default overrides
   */
  updateUserDefaults(userDefaults) {
    this.currentUserDefaults = { ...this.currentUserDefaults, ...userDefaults };
    this.isActive = true;
  }

  /**
   * Reset user defaults to factory
   */
  resetToFactory() {
    this.currentUserDefaults = {};
    this.isActive = false;
  }

  /**
   * Merge configurations properly (factory → user → display)
   * @param {Object} base - Base configuration (factory or user defaults)
   * @param {Object} overrides - Display-specific overrides
   * @returns {Object} Merged configuration
   */
  mergeConfigs(base, overrides) {
    return { ...base, ...overrides };
  }

  /**
   * Get configuration for a specific display
   * @param {Object} displayConfig - Display-specific config
   * @returns {Object} Final configuration for display
   */
  getDisplayConfig(displayConfig = {}) {
    const effectiveDefaults = this.getEffectiveDefaults();
    return this.mergeConfigs(effectiveDefaults, displayConfig);
  }

  /**
   * Validate configuration against schema
   * @param {Object} config - Configuration to validate
   * @returns {Object} Validation result with isValid and errors
   */
  validateConfig(config) {
    try {
      // Basic validation - in production, this would use VisualizationConfigSchema
      const requiredFields = ['visualizationsContentWidth', 'meterHeight', 'adrAxisPosition'];
      const errors = [];

      requiredFields.forEach(field => {
        if (config[field] === undefined || config[field] === null) {
          errors.push(`Missing required field: ${field}`);
        }
      });

      // Validate ranges
      if (config.adrAxisPosition !== undefined) {
        if (config.adrAxisPosition < 5 || config.adrAxisPosition > 95) {
          errors.push('adrAxisPosition must be between 5 and 95');
        }
      }

      if (config.visualizationsContentWidth !== undefined) {
        if (config.visualizationsContentWidth < 50 || config.visualizationsContentWidth > 200) {
          errors.push('visualizationsContentWidth must be between 50 and 200');
        }
      }

      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`]
      };
    }
  }

  /**
   * Export current state for persistence
   * @returns {Object} Serializable state
   */
  exportState() {
    return {
      userDefaults: this.currentUserDefaults,
      originalDefaults: this.factoryDefaults,
      isActive: this.isActive,
      version: '1.0.0',
      timestamp: Date.now()
    };
  }

  /**
   * Import state from persistence
   * @param {Object} state - Previously exported state
   * @returns {boolean} Success status
   */
  importState(state) {
    try {
      if (!state || typeof state !== 'object') {
        console.warn('[CONFIG_DEFAULTS] Invalid state provided');
        return false;
      }

      if (state.userDefaults && typeof state.userDefaults === 'object') {
        this.currentUserDefaults = { ...state.userDefaults };
      }

      this.isActive = Boolean(state.isActive);

      console.log('[CONFIG_DEFAULTS] State imported successfully');
      return true;
    } catch (error) {
      console.error('[CONFIG_DEFAULTS] Failed to import state:', error);
      return false;
    }
  }

  /**
   * Check if user defaults differ from factory
   * @returns {boolean} True if user has modified defaults
   */
  hasUserModifications() {
    return this.isActive && Object.keys(this.currentUserDefaults).length > 0;
  }

  /**
   * Get list of modified parameters
   * @returns {Array} Array of modified parameter names
   */
  getModifiedParameters() {
    return Object.keys(this.currentUserDefaults);
  }

  /**
   * Reset specific parameter to factory default
   * @param {string} parameter - Parameter name to reset
   */
  resetParameter(parameter) {
    if (this.currentUserDefaults[parameter] !== undefined) {
      delete this.currentUserDefaults[parameter];
      
      // If no more user modifications, deactivate
      if (Object.keys(this.currentUserDefaults).length === 0) {
        this.isActive = false;
      }
    }
  }
}

// =============================================================================
// GLOBAL INSTANCE
// =============================================================================

export const configDefaultsManager = new ConfigDefaultsManager();

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Create display configuration with proper defaults
 * @param {Object} userConfig - User-provided configuration
 * @returns {Object} Complete display configuration
 */
export function createDisplayConfig(userConfig = {}) {
  return configDefaultsManager.getDisplayConfig(userConfig);
}

/**
 * Validate and sanitize configuration
 * @param {Object} config - Configuration to validate
 * @returns {Object} Validated and sanitized configuration
 */
export function validateAndSanitizeConfig(config) {
  const validation = configDefaultsManager.validateConfig(config);
  
  if (!validation.isValid) {
    console.warn('[CONFIG_DEFAULTS] Configuration validation failed:', validation.errors);
  }

  // Sanitize common issues
  const sanitized = { ...config };

  // Ensure numeric values are valid
  if (typeof sanitized.visualizationsContentWidth === 'number') {
    sanitized.visualizationsContentWidth = Math.max(50, Math.min(200, sanitized.visualizationsContentWidth));
  }

  if (typeof sanitized.adrAxisPosition === 'number') {
    sanitized.adrAxisPosition = Math.max(5, Math.min(95, sanitized.adrAxisPosition));
  }

  if (typeof sanitized.meterHeight === 'number') {
    sanitized.meterHeight = Math.max(20, Math.min(150, sanitized.meterHeight));
  }

  return sanitized;
}

export default configDefaultsManager;
