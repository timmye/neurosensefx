// =============================================================================
// ENVIRONMENT DETECTION & STORAGE MANAGEMENT UTILITY
// =============================================================================
// Provides clean separation between development and production state
// Follows NeuroSense FX patterns: Simple, Performant, Maintainable
//
// DESIGN PRINCIPLES:
// 1. Environment-aware state separation for clean dev/prod isolation
// 2. Backward compatibility with existing storage patterns
// 3. Seamless migration from shared to environment-specific storage
// 4. Type-safe interfaces with comprehensive error handling
// 5. Developer experience excellence with clear documentation

// =============================================================================
// ENVIRONMENT DETECTION
// =============================================================================

/**
 * Environment configuration and detection
 * Uses Vite's built-in environment variables for reliable detection
 */
export const Environment = {
  /** @type {boolean} True when running in development mode */
  get isDevelopment() {
    // Vite provides this built-in environment variable
    return import.meta.env.DEV;
  },

  /** @type {boolean} True when running in production mode */
  get isProduction() {
    return !import.meta.env.DEV;
  },

  /** @type {string} Current environment identifier */
  get current() {
    return this.isDevelopment ? 'development' : 'production';
  },

  /** @type {string} Environment-specific prefix for storage keys */
  get prefix() {
    return this.isDevelopment ? 'dev-' : 'prod-';
  }
};

/**
 * Environment validation and safety checks
 * Ensures environment detection is working correctly
 */
export function validateEnvironment() {
  const issues = [];

  // Check if import.meta.env is available
  if (typeof import.meta.env === 'undefined') {
    issues.push('import.meta.env is not available - environment detection may fail');
  }

  // Check for inconsistent environment state
  if (Environment.isDevelopment && Environment.isProduction) {
    issues.push('Inconsistent environment state: both dev and prod detected');
  }

  if (!Environment.isDevelopment && !Environment.isProduction) {
    issues.push('Inconsistent environment state: neither dev nor prod detected');
  }

  // Check localStorage availability
  try {
    const testKey = '__neurosensefx_env_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
  } catch (error) {
    issues.push(`localStorage not available: ${error.message}`);
  }

  return {
    isValid: issues.length === 0,
    issues,
    environment: Environment.current,
    timestamp: Date.now()
  };
}

// =============================================================================
// STORAGE KEY MANAGEMENT
// =============================================================================

/**
 * Base storage keys used throughout NeuroSense FX
 * Maintains backward compatibility with existing storage patterns
 */
const BASE_STORAGE_KEYS = {
  // Core workspace storage (from workspaceStorage.js)
  WORKSPACE_SETTINGS: 'neurosensefx-workspace-settings',
  DISPLAY_SIZES: 'neurosensefx-display-sizes',

  // Extended workspace storage (from workspacePersistence.js)
  WORKSPACE_LAYOUT: 'neurosensefx-workspace-layout',
  GLOBAL_CONFIG: 'neurosensefx-global-config',
  USER_PREFERENCES: 'neurosensefx-user-preferences',
  WORKSPACE_METADATA: 'neurosensefx-workspace-metadata',

  // Application-wide storage
  RECENT_SYMBOLS: 'recent-symbols',
  UI_STATE: 'neurosensefx-ui-state'
};

/**
 * Environment-aware storage key manager
 * Provides consistent interface for environment-specific storage
 */
export const StorageKeys = {
  /**
   * Get environment-specific storage key
   * @param {string} baseKey - Base storage key
   * @returns {string} Environment-prefixed storage key
   */
  get(baseKey) {
    const validation = validateEnvironment();
    if (!validation.isValid) {
      console.warn('[ENV_UTILS] Environment validation failed:', validation.issues);
      // Fall back to base key if environment detection fails
      return baseKey;
    }

    return `${Environment.prefix}${baseKey}`;
  },

  /**
   * Get all environment-specific storage keys
   * @returns {Object} Object with all storage keys
   */
  getAll() {
    const keys = {};
    Object.entries(BASE_STORAGE_KEYS).forEach(([key, value]) => {
      keys[key] = this.get(value);
    });
    return keys;
  },

  /**
   * Check if a key is environment-specific
   * @param {string} key - Storage key to check
   * @returns {boolean} True if key has environment prefix
   */
  isEnvironmentSpecific(key) {
    return key.startsWith('dev-') || key.startsWith('prod-');
  },

  /**
   * Strip environment prefix from key
   * @param {string} key - Environment-prefixed key
   * @returns {string} Base key without prefix
   */
  stripPrefix(key) {
    if (key.startsWith('dev-')) return key.substring(4);
    if (key.startsWith('prod-')) return key.substring(5);
    return key;
  }
};

// =============================================================================
// ENVIRONMENT CONFIGURATION
// =============================================================================

/**
 * Environment-specific configuration and behaviors
 * Defines development-only features and production safeguards
 */
export const EnvironmentConfig = {
  /**
   * Development environment configuration
   */
  development: {
    /** Enable debug logging and console output */
    debugLogging: true,

    /** Show environment indicators in UI */
    showEnvironmentIndicator: true,

    /** Enable hot reload specific features */
    hotReloadFeatures: true,

    /** Enable experimental features */
    experimentalFeatures: true,

    /** Storage settings */
    storage: {
      /** Auto-migrate old storage on startup */
      autoMigrate: true,

      /** Use verbose logging for storage operations */
      verboseStorageLogging: true,

      /** Clear old storage after migration */
      clearOldStorage: false // Keep old storage for comparison
    },

    /** Performance monitoring */
    performance: {
      /** Enable performance profiling */
      enableProfiling: true,

      /** Show performance metrics */
      showMetrics: true,

      /** Log slow operations (>100ms) */
      logSlowOperations: true
    }
  },

  /**
   * Production environment configuration
   */
  production: {
    /** Disable debug logging for performance */
    debugLogging: false,

    /** Hide environment indicators */
    showEnvironmentIndicator: false,

    /** Disable hot reload features */
    hotReloadFeatures: false,

    /** Disable experimental features */
    experimentalFeatures: false,

    /** Storage settings */
    storage: {
      /** Auto-migrate old storage on startup */
      autoMigrate: true,

      /** Use minimal logging for storage operations */
      verboseStorageLogging: false,

      /** Clear old storage after migration */
      clearOldStorage: true // Clean up old storage
    },

    /** Performance monitoring */
    performance: {
      /** Disable performance profiling */
      enableProfiling: false,

      /** Hide performance metrics */
      showMetrics: false,

      /** Log only very slow operations (>500ms) */
      logSlowOperations: false
    }
  },

  /**
   * Get current environment configuration
   * @returns {Object} Current environment configuration
   */
  get current() {
    return Environment.isDevelopment ? this.development : this.production;
  },

  /**
   * Get specific configuration value
   * @param {string} path - Dot notation path to config value
   * @returns {*} Configuration value
   */
  get(path) {
    const parts = path.split('.');
    let value = this.current;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }
};

// =============================================================================
// STORAGE OPERATIONS
// =============================================================================

/**
 * Environment-aware storage operations
 * Provides safe localStorage operations with error handling
 */
export const EnvironmentStorage = {
  /**
   * Set item in environment-specific storage
   * @param {string} key - Storage key (will be environment-prefixed)
   * @param {string} value - Value to store
   * @param {Object} options - Storage options
   */
  setItem(key, value, options = {}) {
    try {
      const envKey = StorageKeys.get(key);
      const config = EnvironmentConfig.current;

      if (config.storage.verboseStorageLogging) {
        console.log(`[ENV_STORAGE] Setting ${envKey}:`, value);
      }

      localStorage.setItem(envKey, value);

      // Validate storage if requested
      if (options.validate) {
        this.validateStorage();
      }

    } catch (error) {
      console.error(`[ENV_STORAGE] Failed to set ${key}:`, error);
      throw error;
    }
  },

  /**
   * Get item from environment-specific storage
   * @param {string} key - Storage key (will be environment-prefixed)
   * @param {*} defaultValue - Default value if not found
   * @returns {*} Stored value or default
   */
  getItem(key, defaultValue = null) {
    try {
      const envKey = StorageKeys.get(key);
      const config = EnvironmentConfig.current;
      const value = localStorage.getItem(envKey);

      if (config.storage.verboseStorageLogging && value !== null) {
        console.log(`[ENV_STORAGE] Retrieved ${envKey}:`, value);
      }

      return value !== null ? value : defaultValue;
    } catch (error) {
      console.error(`[ENV_STORAGE] Failed to get ${key}:`, error);
      return defaultValue;
    }
  },

  /**
   * Remove item from environment-specific storage
   * @param {string} key - Storage key (will be environment-prefixed)
   */
  removeItem(key) {
    try {
      const envKey = StorageKeys.get(key);
      const config = EnvironmentConfig.current;

      if (config.storage.verboseStorageLogging) {
        console.log(`[ENV_STORAGE] Removing ${envKey}`);
      }

      localStorage.removeItem(envKey);
    } catch (error) {
      console.error(`[ENV_STORAGE] Failed to remove ${key}:`, error);
    }
  },

  /**
   * Clear all environment-specific storage
   * @param {Object} options - Clear options
   */
  clear(options = {}) {
    try {
      const keys = StorageKeys.getAll();
      const config = EnvironmentConfig.current;

      if (config.storage.verboseStorageLogging) {
        console.log('[ENV_STORAGE] Clearing all environment-specific storage');
      }

      Object.values(keys).forEach(key => {
        localStorage.removeItem(key);
      });

      // Optionally clear old (non-environment-specific) storage
      if (options.clearOldStorage) {
        this.clearOldStorage();
      }

    } catch (error) {
      console.error('[ENV_STORAGE] Failed to clear storage:', error);
    }
  },

  /**
   * Get storage usage information
   * @returns {Object} Storage usage statistics
   */
  getStorageInfo() {
    try {
      const keys = StorageKeys.getAll();
      const info = {
        environment: Environment.current,
        keys: {},
        totalSize: 0,
        itemCount: 0
      };

      Object.entries(keys).forEach(([name, key]) => {
        const value = localStorage.getItem(key);
        const size = value ? value.length : 0;

        info.keys[name] = {
          key,
          size,
          hasData: value !== null
        };

        info.totalSize += size;
        if (value !== null) info.itemCount++;
      });

      return info;
    } catch (error) {
      console.error('[ENV_STORAGE] Failed to get storage info:', error);
      return {
        environment: Environment.current,
        keys: {},
        totalSize: 0,
        itemCount: 0,
        error: error.message
      };
    }
  },

  /**
   * Validate storage integrity
   * @returns {Object} Validation results
   */
  validateStorage() {
    try {
      const info = this.getStorageInfo();
      const issues = [];

      // Check for data size issues
      if (info.totalSize > 1024 * 1024) { // 1MB warning
        issues.push(`Large storage usage: ${(info.totalSize / 1024).toFixed(1)}KB`);
      }

      // Check for potential JSON parsing issues
      Object.entries(info.keys).forEach(([name, keyInfo]) => {
        if (keyInfo.hasData) {
          try {
            const value = localStorage.getItem(keyInfo.key);
            JSON.parse(value); // Test JSON validity
          } catch (parseError) {
            issues.push(`Invalid JSON in ${name}: ${parseError.message}`);
          }
        }
      });

      return {
        isValid: issues.length === 0,
        issues,
        info
      };
    } catch (error) {
      return {
        isValid: false,
        issues: [`Storage validation error: ${error.message}`],
        error
      };
    }
  },

  /**
   * Clear old (non-environment-specific) storage
   */
  clearOldStorage() {
    try {
      const config = EnvironmentConfig.current;

      if (config.storage.verboseStorageLogging) {
        console.log('[ENV_STORAGE] Clearing old storage keys');
      }

      Object.values(BASE_STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });

    } catch (error) {
      console.error('[ENV_STORAGE] Failed to clear old storage:', error);
    }
  }
};

// =============================================================================
// MIGRATION SUPPORT
// =============================================================================

/**
 * Storage migration utilities
 * Handles transition from shared to environment-specific storage
 */
export const StorageMigration = {
  /**
   * Check if migration is needed
   * @returns {boolean} True if old storage exists and new doesn't
   */
  needsMigration() {
    try {
      // Check if any old storage exists
      const hasOldStorage = Object.values(BASE_STORAGE_KEYS).some(key =>
        localStorage.getItem(key) !== null
      );

      // Check if new storage already exists
      const envKeys = StorageKeys.getAll();
      const hasNewStorage = Object.values(envKeys).some(key =>
        localStorage.getItem(key) !== null
      );

      return hasOldStorage && !hasNewStorage;
    } catch (error) {
      console.error('[MIGRATION] Failed to check migration status:', error);
      return false;
    }
  },

  /**
   * Perform migration from old to environment-specific storage
   * @param {Object} options - Migration options
   * @returns {Object} Migration results
   */
  migrate(options = {}) {
    try {
      const config = EnvironmentConfig.current;
      const results = {
        success: false,
        migrated: [],
        failed: [],
        warnings: [],
        timestamp: Date.now()
      };

      if (!this.needsMigration()) {
        results.success = true;
        results.warnings.push('No migration needed');
        return results;
      }

      if (config.storage.verboseStorageLogging || options.verbose) {
        console.log('[MIGRATION] Starting storage migration...');
      }

      // Migrate each storage key
      Object.entries(BASE_STORAGE_KEYS).forEach(([name, baseKey]) => {
        try {
          const oldValue = localStorage.getItem(baseKey);

          if (oldValue !== null) {
            const newKey = StorageKeys.get(baseKey);
            localStorage.setItem(newKey, oldValue);
            results.migrated.push({
              name,
              from: baseKey,
              to: newKey,
              size: oldValue.length
            });

            if (config.storage.verboseStorageLogging) {
              console.log(`[MIGRATION] Migrated ${name}: ${baseKey} -> ${newKey}`);
            }
          }
        } catch (error) {
          results.failed.push({
            name,
            key: baseKey,
            error: error.message
          });
          console.error(`[MIGRATION] Failed to migrate ${name}:`, error);
        }
      });

      // Clear old storage if configured
      if (config.storage.clearOldStorage && options.clearOld !== false) {
        if (config.storage.verboseStorageLogging) {
          console.log('[MIGRATION] Clearing old storage...');
        }
        EnvironmentStorage.clearOldStorage();
      }

      results.success = results.failed.length === 0;

      if (config.storage.verboseStorageLogging || options.verbose) {
        console.log('[MIGRATION] Migration completed:', results);
      }

      return results;
    } catch (error) {
      console.error('[MIGRATION] Migration failed:', error);
      return {
        success: false,
        migrated: [],
        failed: [],
        warnings: [`Migration error: ${error.message}`],
        timestamp: Date.now(),
        error
      };
    }
  },

  /**
   * Perform automatic migration if needed
   * @returns {Object} Migration results
   */
  autoMigrate() {
    const config = EnvironmentConfig.current;

    if (!config.storage.autoMigrate) {
      return { success: true, skipped: true, reason: 'Auto-migration disabled' };
    }

    if (this.needsMigration()) {
      return this.migrate();
    }

    return { success: true, skipped: true, reason: 'No migration needed' };
  },

  /**
   * Create backup of current storage
   * @returns {Object} Backup results with data
   */
  createBackup() {
    try {
      const backup = {
        environment: Environment.current,
        timestamp: Date.now(),
        data: {}
      };

      // Backup old storage
      Object.entries(BASE_STORAGE_KEYS).forEach(([name, key]) => {
        const value = localStorage.getItem(key);
        if (value !== null) {
          backup.data[key] = value;
        }
      });

      // Backup new storage
      const envKeys = StorageKeys.getAll();
      Object.entries(envKeys).forEach(([name, key]) => {
        const value = localStorage.getItem(key);
        if (value !== null) {
          backup.data[key] = value;
        }
      });

      console.log('[MIGRATION] Storage backup created');
      return { success: true, backup };
    } catch (error) {
      console.error('[MIGRATION] Failed to create backup:', error);
      return { success: false, error };
    }
  }
};

// =============================================================================
// INITIALIZATION & UTILITIES
// =============================================================================

/**
 * Initialize environment utilities
 * Performs validation, migration, and setup
 * @returns {Object} Initialization results
 */
export function initializeEnvironment() {
  try {
    const config = EnvironmentConfig.current;
    const results = {
      success: false,
      environment: Environment.current,
      validation: null,
      migration: null,
      timestamp: Date.now()
    };

    if (config.debugLogging) {
      console.log(`[ENV_UTILS] Initializing ${Environment.current} environment...`);
    }

    // Validate environment
    results.validation = validateEnvironment();
    if (!results.validation.isValid) {
      console.warn('[ENV_UTILS] Environment validation failed:', results.validation.issues);
    }

    // Perform auto-migration if needed
    results.migration = StorageMigration.autoMigrate();
    if (!results.migration.success) {
      console.error('[ENV_UTILS] Auto-migration failed:', results.migration);
    }

    // Validate storage
    const storageValidation = EnvironmentStorage.validateStorage();
    if (!storageValidation.isValid) {
      console.warn('[ENV_UTILS] Storage validation issues:', storageValidation.issues);
    }

    results.success = true;

    if (config.debugLogging) {
      console.log('[ENV_UTILS] Environment initialization completed:', results);
    }

    return results;
  } catch (error) {
    console.error('[ENV_UTILS] Environment initialization failed:', error);
    return {
      success: false,
      environment: Environment.current,
      error: error.message,
      timestamp: Date.now()
    };
  }
}

/**
 * Get environment information for debugging and display
 * @returns {Object} Environment information
 */
export function getEnvironmentInfo() {
  return {
    current: Environment.current,
    isDevelopment: Environment.isDevelopment,
    isProduction: Environment.isProduction,
    prefix: Environment.prefix,
    config: EnvironmentConfig.current,
    storage: EnvironmentStorage.getStorageInfo(),
    validation: validateEnvironment()
  };
}

/**
 * Development-only utility for environment debugging
 * Only available in development mode
 */
export const DevTools = {
  /**
   * Show environment information in console
   */
  showInfo() {
    if (!Environment.isDevelopment) {
      console.warn('[DEV_TOOLS] Only available in development mode');
      return;
    }

    console.group('🔧 NeuroSense FX Environment Info');
    console.log('Environment:', getEnvironmentInfo());
    console.log('Storage Keys:', StorageKeys.getAll());
    console.log('Migration Status:', StorageMigration.needsMigration());
    console.groupEnd();
  },

  /**
   * Switch between development and production storage
   * @param {string} targetEnv - Target environment ('development' or 'production')
   */
  switchStorage(targetEnv) {
    if (!Environment.isDevelopment) {
      console.warn('[DEV_TOOLS] Only available in development mode');
      return;
    }

    // This is a development utility for testing storage switching
    console.warn(`[DEV_TOOLS] Switching to ${targetEnv} storage (development only)`);
    // Implementation would depend on specific requirements
  },

  /**
   * Clear all storage (both old and new)
   */
  clearAllStorage() {
    if (!Environment.isDevelopment) {
      console.warn('[DEV_TOOLS] Only available in development mode');
      return;
    }

    console.warn('[DEV_TOOLS] Clearing all storage (development only)');

    // Clear old storage
    Object.values(BASE_STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });

    // Clear both dev and prod storage
    const devPrefix = 'dev-';
    const prodPrefix = 'prod-';

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(devPrefix) || key.startsWith(prodPrefix)) {
        localStorage.removeItem(key);
      }
    }

    console.log('[DEV_TOOLS] All storage cleared');
  }
};

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  Environment,
  StorageKeys,
  EnvironmentConfig,
  EnvironmentStorage,
  StorageMigration,
  initializeEnvironment,
  getEnvironmentInfo,
  validateEnvironment,
  DevTools
};