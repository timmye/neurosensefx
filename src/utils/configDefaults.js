// =============================================================================
// CONFIGURATION DEFAULTS MANAGER
// =============================================================================
// Factory defaults management and validation for workspace persistence
// Provides clean separation between original defaults and user modifications

import { getEssentialDefaultConfig } from '../config/visualizationSchema.js';

// =============================================================================
// FACTORY DEFAULTS (original values that never change)
// =============================================================================

// Use simplified defaults from schema - 31 essential parameters only
export const FACTORY_DEFAULTS = getEssentialDefaultConfig();

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

      // Handle fullRuntimeConfig for new format
      if (state.fullRuntimeConfig && typeof state.fullRuntimeConfig === 'object') {
        console.log('[CONFIG_DEFAULTS] Importing state with full runtime config');
        // The fullRuntimeConfig will be handled by workspacePersistenceManager
      }

      console.log('[CONFIG_DEFAULTS] State imported successfully', {
        hasFullRuntimeConfig: !!state.fullRuntimeConfig,
        userDefaultsKeys: Object.keys(this.currentUserDefaults).length,
        isActive: this.isActive
      });
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
