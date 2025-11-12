// =============================================================================
// CROSS-ENVIRONMENT WORKSPACE COPY UTILITIES
// =============================================================================
// Provides comprehensive state management for copying workspace configurations
// between development and production environments with safety and validation
//
// DESIGN PRINCIPLES:
// 1. Safe operations with validation, backups, and rollback capabilities
// 2. User control with granular selection options
// 3. Clear feedback with detailed logging and UI feedback
// 4. Performance with efficient copying of potentially large workspace data
// 5. Comprehensive error handling for all edge cases and failures

import {
  Environment,
  EnvironmentStorage,
  StorageKeys,
  validateEnvironment
} from '../lib/utils/environmentUtils.js';
import {
  saveWorkspaceLayout,
  loadWorkspaceLayout,
  saveGlobalConfigState,
  loadGlobalConfigState,
  saveUserPreferences,
  loadUserPreferences,
  getComprehensiveStorageInfo,
  validateStorageIntegrity
} from './workspaceStorage.js';
import {
  saveWorkspaceSettings,
  loadWorkspaceSettings,
  saveDisplaySizes,
  loadDisplaySizes
} from './workspaceStorage.js';

// =============================================================================
// COPY OPERATION TYPES AND CONFIGURATION
// =============================================================================

/**
 * Copy operation types with predefined configurations
 */
export const COPY_PRESETS = {
  EVERYTHING: {
    name: 'Copy Everything',
    description: 'Copy all workspace data, configurations, and preferences',
    items: ['layout', 'config', 'preferences', 'settings', 'sizes']
  },
  LAYOUT_ONLY: {
    name: 'Layout Only',
    description: 'Copy only workspace layout (displays, panels, icons)',
    items: ['layout']
  },
  CONFIG_ONLY: {
    name: 'Configuration Only',
    description: 'Copy only global configuration and user preferences',
    items: ['config', 'preferences']
  },
  VISUAL_SETTINGS: {
    name: 'Visual Settings Only',
    description: 'Copy workspace settings and display sizes',
    items: ['settings', 'sizes']
  },
  SAFE_COPY: {
    name: 'Safe Copy',
    description: 'Copy layout and visual settings (no preferences)',
    items: ['layout', 'settings', 'sizes']
  }
};

/**
 * Available copy items with their storage keys and metadata
 */
export const COPY_ITEMS = {
  layout: {
    name: 'Workspace Layout',
    description: 'Display positions, sizes, and workspace arrangement',
    sourceKey: 'neurosensefx-workspace-layout',
    saveFunction: saveWorkspaceLayout,
    loadFunction: loadWorkspaceLayout,
    validator: validateLayoutData
  },
  config: {
    name: 'Global Configuration',
    description: 'Visualization parameters and display settings',
    sourceKey: 'neurosensefx-global-config',
    saveFunction: saveGlobalConfigState,
    loadFunction: loadGlobalConfigState,
    validator: validateConfigData
  },
  preferences: {
    name: 'User Preferences',
    description: 'Personal preferences and UI settings',
    sourceKey: 'neurosensefx-user-preferences',
    saveFunction: saveUserPreferences,
    loadFunction: loadUserPreferences,
    validator: validatePreferencesData
  },
  settings: {
    name: 'Workspace Settings',
    description: 'Grid snap, collision detection, and workspace behavior',
    sourceKey: 'neurosensefx-workspace-settings',
    saveFunction: saveWorkspaceSettings,
    loadFunction: loadWorkspaceSettings,
    validator: validateSettingsData
  },
  sizes: {
    name: 'Display Sizes',
    description: 'Custom display dimensions and sizing preferences',
    sourceKey: 'neurosensefx-display-sizes',
    saveFunction: saveDisplaySizes,
    loadFunction: loadDisplaySizes,
    validator: validateSizesData
  }
};

// =============================================================================
// VALIDATION UTILITIES
// =============================================================================

/**
 * Validate workspace layout data integrity
 * @param {*} data - Layout data to validate
 * @returns {Object} Validation result
 */
function validateLayoutData(data) {
  try {
    if (!data || typeof data !== 'object') {
      return { isValid: false, error: 'Layout data must be an object' };
    }

    const errors = [];

    // Check required structure
    if (!data.displays || !Array.isArray(data.displays)) {
      errors.push('Missing or invalid displays array');
    } else {
      data.displays.forEach((display, index) => {
        if (!display.id) errors.push(`Display ${index}: missing ID`);
        if (!display.symbol) errors.push(`Display ${index}: missing symbol`);
        if (!display.position || typeof display.position !== 'object') {
          errors.push(`Display ${index}: missing or invalid position`);
        }
        if (!display.size || typeof display.size !== 'object') {
          errors.push(`Display ${index}: missing or invalid size`);
        }
      });
    }

    if (!data.panels || !Array.isArray(data.panels)) {
      errors.push('Missing or invalid panels array');
    }

    if (!data.icons || !Array.isArray(data.icons)) {
      errors.push('Missing or invalid icons array');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
      data
    };
  } catch (error) {
    return { isValid: false, error: `Layout validation error: ${error.message}` };
  }
}

/**
 * Validate global configuration data
 * @param {*} data - Configuration data to validate
 * @returns {Object} Validation result
 */
function validateConfigData(data) {
  try {
    if (!data || typeof data !== 'object') {
      return { isValid: false, error: 'Configuration data must be an object' };
    }

    const errors = [];

    if (!data.userDefaults || typeof data.userDefaults !== 'object') {
      errors.push('Missing or invalid userDefaults object');
    }

    if (typeof data.isActive !== 'boolean') {
      errors.push('Missing or invalid isActive boolean');
    }

    // Validate individual configuration parameters
    if (data.userDefaults) {
      const validParamTypes = ['boolean', 'string', 'number'];
      Object.entries(data.userDefaults).forEach(([key, value]) => {
        if (!validParamTypes.includes(typeof value)) {
          errors.push(`Invalid parameter type for ${key}: ${typeof value}`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
      data
    };
  } catch (error) {
    return { isValid: false, error: `Configuration validation error: ${error.message}` };
  }
}

/**
 * Validate user preferences data
 * @param {*} data - Preferences data to validate
 * @returns {Object} Validation result
 */
function validatePreferencesData(data) {
  try {
    if (!data || typeof data !== 'object') {
      return { isValid: false, error: 'Preferences data must be an object' };
    }

    // Basic structure validation - preferences can be flexible
    return {
      isValid: true,
      errors: [],
      warnings: [],
      data
    };
  } catch (error) {
    return { isValid: false, error: `Preferences validation error: ${error.message}` };
  }
}

/**
 * Validate workspace settings data
 * @param {*} data - Settings data to validate
 * @returns {Object} Validation result
 */
function validateSettingsData(data) {
  try {
    if (!data || typeof data !== 'object') {
      return { isValid: false, error: 'Settings data must be an object' };
    }

    const errors = [];

    // Check known settings with expected types
    const expectedSettings = {
      gridSnapEnabled: 'boolean',
      gridSize: 'number',
      collisionDetectionEnabled: 'boolean',
      showResizeHandles: 'boolean',
      showGridLines: 'boolean',
      allowOverlap: 'boolean'
    };

    Object.entries(expectedSettings).forEach(([key, expectedType]) => {
      if (key in data && typeof data[key] !== expectedType) {
        errors.push(`Invalid type for ${key}: expected ${expectedType}, got ${typeof data[key]}`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
      data
    };
  } catch (error) {
    return { isValid: false, error: `Settings validation error: ${error.message}` };
  }
}

/**
 * Validate display sizes data
 * @param {*} data - Sizes data to validate
 * @returns {Object} Validation result
 */
function validateSizesData(data) {
  try {
    if (!data || typeof data !== 'object') {
      return { isValid: false, error: 'Sizes data must be an object' };
    }

    const errors = [];

    // Validate each display size entry
    Object.entries(data).forEach(([displayId, size]) => {
      if (!size || typeof size !== 'object') {
        errors.push(`Invalid size object for display ${displayId}`);
        return;
      }

      if (typeof size.width !== 'number' || size.width <= 0) {
        errors.push(`Invalid width for display ${displayId}: ${size.width}`);
      }

      if (typeof size.height !== 'number' || size.height <= 0) {
        errors.push(`Invalid height for display ${displayId}: ${size.height}`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
      data
    };
  } catch (error) {
    return { isValid: false, error: `Sizes validation error: ${error.message}` };
  }
}

// =============================================================================
// BACKUP AND ROLLBACK UTILITIES
// =============================================================================

/**
 * Create backup of current environment state
 * @param {string} backupId - Unique backup identifier
 * @returns {Object} Backup result
 */
export function createBackup(backupId = null) {
  try {
    const backup = {
      id: backupId || `backup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      environment: Environment.current,
      timestamp: Date.now(),
      data: {}
    };

    // Backup all copy items
    Object.entries(COPY_ITEMS).forEach(([itemKey, itemConfig]) => {
      try {
        const data = itemConfig.loadFunction();
        if (data !== null) {
          backup.data[itemKey] = {
            data,
            timestamp: Date.now(),
            size: JSON.stringify(data).length
          };
        }
      } catch (error) {
        console.warn(`[COPY_UTILS] Failed to backup ${itemKey}:`, error);
      }
    });

    // Store backup in localStorage
    const backupKey = `neurosensefx-backup-${backup.id}`;
    localStorage.setItem(backupKey, JSON.stringify(backup));

    console.log(`[COPY_UTILS] Backup created: ${backup.id} with ${Object.keys(backup.data).length} items`);

    return {
      success: true,
      backupId: backup.id,
      items: Object.keys(backup.data),
      totalSize: JSON.stringify(backup).length
    };
  } catch (error) {
    console.error('[COPY_UTILS] Backup creation failed:', error);
    return {
      success: false,
      error: error.message,
      backupId: null
    };
  }
}

/**
 * Restore from backup
 * @param {string} backupId - Backup identifier to restore
 * @param {Array<string>} items - Optional specific items to restore
 * @returns {Object} Restore result
 */
export function restoreFromBackup(backupId, items = null) {
  try {
    const backupKey = `neurosensefx-backup-${backupId}`;
    const backupData = localStorage.getItem(backupKey);

    if (!backupData) {
      return {
        success: false,
        error: `Backup ${backupId} not found`
      };
    }

    const backup = JSON.parse(backupData);
    const itemsToRestore = items || Object.keys(backup.data);
    const results = {
      success: true,
      restored: [],
      failed: [],
      backupId: backup.id,
      backupEnvironment: backup.environment
    };

    // Restore each item
    itemsToRestore.forEach(itemKey => {
      if (!backup.data[itemKey]) {
        results.failed.push({
          item: itemKey,
          error: 'Item not found in backup'
        });
        return;
      }

      try {
        const itemConfig = COPY_ITEMS[itemKey];
        if (itemConfig) {
          itemConfig.saveFunction(backup.data[itemKey].data);
          results.restored.push(itemKey);
        }
      } catch (error) {
        results.failed.push({
          item: itemKey,
          error: error.message
        });
        results.success = false;
      }
    });

    console.log(`[COPY_UTILS] Restore completed: ${results.restored.length} restored, ${results.failed.length} failed`);

    return results;
  } catch (error) {
    console.error('[COPY_UTILS] Restore failed:', error);
    return {
      success: false,
      error: error.message,
      backupId
    };
  }
}

/**
 * List available backups
 * @returns {Array} Array of backup information
 */
export function listBackups() {
  try {
    const backups = [];

    // Scan localStorage for backup keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('neurosensefx-backup-')) {
        try {
          const backupData = localStorage.getItem(key);
          const backup = JSON.parse(backupData);
          backups.push({
            id: backup.id,
            environment: backup.environment,
            timestamp: backup.timestamp,
            items: Object.keys(backup.data),
            size: backupData.length,
            date: new Date(backup.timestamp).toLocaleString()
          });
        } catch (parseError) {
          console.warn(`[COPY_UTILS] Invalid backup data for key: ${key}`);
        }
      }
    }

    // Sort by timestamp (newest first)
    backups.sort((a, b) => b.timestamp - a.timestamp);

    return backups;
  } catch (error) {
    console.error('[COPY_UTILS] Failed to list backups:', error);
    return [];
  }
}

/**
 * Delete backup
 * @param {string} backupId - Backup identifier to delete
 * @returns {boolean} Success status
 */
export function deleteBackup(backupId) {
  try {
    const backupKey = `neurosensefx-backup-${backupId}`;
    localStorage.removeItem(backupKey);
    console.log(`[COPY_UTILS] Backup deleted: ${backupId}`);
    return true;
  } catch (error) {
    console.error('[COPY_UTILS] Failed to delete backup:', error);
    return false;
  }
}

/**
 * Clean up old backups (keep only the most recent N)
 * @param {number} keepCount - Number of backups to keep
 * @returns {Object} Cleanup result
 */
export function cleanupOldBackups(keepCount = 10) {
  try {
    const backups = listBackups();
    if (backups.length <= keepCount) {
      return { success: true, deleted: 0, message: 'No cleanup needed' };
    }

    const backupsToDelete = backups.slice(keepCount);
    let deletedCount = 0;

    backupsToDelete.forEach(backup => {
      if (deleteBackup(backup.id)) {
        deletedCount++;
      }
    });

    console.log(`[COPY_UTILS] Cleaned up ${deletedCount} old backups (kept ${keepCount})`);

    return {
      success: true,
      deleted: deletedCount,
      kept: keepCount,
      message: `Deleted ${deletedCount} old backups`
    };
  } catch (error) {
    console.error('[COPY_UTILS] Backup cleanup failed:', error);
    return {
      success: false,
      error: error.message,
      deleted: 0
    };
  }
}

// =============================================================================
// MAIN COPY OPERATIONS
// =============================================================================

/**
 * Copy data between environments with comprehensive validation and safety
 * @param {Object} options - Copy operation options
 * @returns {Object} Copy operation result
 */
export async function copyBetweenEnvironments(options = {}) {
  const {
    sourceEnv = Environment.isDevelopment ? 'production' : 'development',
    targetEnv = Environment.current,
    items = ['layout', 'config', 'preferences', 'settings', 'sizes'],
    createBackup: shouldBackup = true,
    validateData = true,
    mergeMode = false
  } = options;

  const startTime = Date.now();
  const operationId = `copy-${startTime}-${Math.random().toString(36).substr(2, 9)}`;

  console.log(`[COPY_UTILS] Starting copy operation ${operationId}:`, {
    sourceEnv,
    targetEnv,
    items,
    shouldBackup,
    validateData,
    mergeMode
  });

  try {
    // Validate environments
    const envValidation = validateEnvironment();
    if (!envValidation.isValid) {
      return {
        success: false,
        error: 'Environment validation failed',
        issues: envValidation.issues,
        operationId
      };
    }

    // Create backup if requested
    let backupResult = null;
    if (shouldBackup) {
      backupResult = createBackup(`pre-copy-${operationId}`);
      if (!backupResult.success) {
        return {
          success: false,
          error: 'Backup creation failed',
          backupError: backupResult.error,
          operationId
        };
      }
    }

    // Prepare copy results
    const results = {
      success: true,
      operationId,
      sourceEnv,
      targetEnv,
      backupId: backupResult?.backupId,
      startTime,
      endTime: null,
      duration: null,
      items: {
        copied: [],
        skipped: [],
        failed: [],
        validated: []
      },
      sourceInfo: null,
      targetInfo: null,
      warnings: [],
      errors: []
    };

    // Get storage info for both environments
    results.sourceInfo = await getEnvironmentStorageInfo(sourceEnv);
    results.targetInfo = await getEnvironmentStorageInfo(targetEnv);

    // Perform copy operation for each item
    for (const itemKey of items) {
      const itemConfig = COPY_ITEMS[itemKey];
      if (!itemConfig) {
        results.items.skipped.push({
          item: itemKey,
          reason: 'Unknown item type'
        });
        continue;
      }

      try {
        // Load data from source environment
        const sourceData = await loadFromEnvironment(sourceEnv, itemConfig);
        if (sourceData === null) {
          results.items.skipped.push({
            item: itemKey,
            reason: 'No data found in source environment'
          });
          continue;
        }

        // Validate data if requested
        if (validateData && itemConfig.validator) {
          const validation = itemConfig.validator(sourceData);
          if (!validation.isValid) {
            results.items.failed.push({
              item: itemKey,
              error: `Validation failed: ${validation.errors.join(', ')}`
            });
            results.success = false;
            continue;
          }
          results.items.validated.push(itemKey);
        }

        // Handle merge mode if applicable
        let finalData = sourceData;
        if (mergeMode && itemKey === 'config') {
          const targetData = await loadFromEnvironment(targetEnv, itemConfig);
          if (targetData !== null) {
            finalData = mergeConfigData(targetData, sourceData);
            results.warnings.push(`Merged ${itemKey} data with existing configuration`);
          }
        }

        // Save to target environment
        await saveToEnvironment(targetEnv, itemConfig, finalData);
        results.items.copied.push({
          item: itemKey,
          size: JSON.stringify(finalData).length,
          merged: mergeMode && finalData !== sourceData
        });

      } catch (error) {
        results.items.failed.push({
          item: itemKey,
          error: error.message
        });
        results.success = false;
      }
    }

    // Finalize results
    results.endTime = Date.now();
    results.duration = results.endTime - results.startTime;

    // Log final result
    if (results.success) {
      console.log(`[COPY_UTILS] Copy operation completed successfully:`, {
        operationId,
        duration: `${results.duration}ms`,
        copied: results.items.copied.length,
        skipped: results.items.skipped.length,
        failed: results.items.failed.length
      });
    } else {
      console.error(`[COPY_UTILS] Copy operation failed:`, {
        operationId,
        errors: results.errors,
        failedItems: results.items.failed
      });
    }

    return results;

  } catch (error) {
    console.error(`[COPY_UTILS] Copy operation crashed:`, error);
    return {
      success: false,
      error: `Copy operation crashed: ${error.message}`,
      operationId,
      startTime,
      endTime: Date.now(),
      duration: Date.now() - startTime
    };
  }
}

/**
 * Load data from specific environment
 * @param {string} environment - Target environment
 * @param {Object} itemConfig - Item configuration
 * @returns {*} Loaded data or null
 */
async function loadFromEnvironment(environment, itemConfig) {
  try {
    // Temporarily switch to source environment storage
    const originalEnv = Environment.current;

    // Simulate environment switch by using appropriate storage keys
    const prefix = environment === 'development' ? 'dev-' : 'prod-';
    const sourceKey = prefix + itemConfig.sourceKey;

    const data = localStorage.getItem(sourceKey);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`[COPY_UTILS] Failed to load from ${environment}:`, error);
    return null;
  }
}

/**
 * Save data to specific environment
 * @param {string} environment - Target environment
 * @param {Object} itemConfig - Item configuration
 * @param {*} data - Data to save
 */
async function saveToEnvironment(environment, itemConfig, data) {
  try {
    // Simulate environment switch by using appropriate storage keys
    const prefix = environment === 'development' ? 'dev-' : 'prod-';
    const targetKey = prefix + itemConfig.sourceKey;

    localStorage.setItem(targetKey, JSON.stringify(data));

    // Also use the item's save function for current environment if it matches
    if (environment === Environment.current) {
      itemConfig.saveFunction(data);
    }
  } catch (error) {
    console.error(`[COPY_UTILS] Failed to save to ${environment}:`, error);
    throw error;
  }
}

/**
 * Get storage information for specific environment
 * @param {string} environment - Target environment
 * @returns {Object} Storage information
 */
async function getEnvironmentStorageInfo(environment) {
  try {
    const prefix = environment === 'development' ? 'dev-' : 'prod-';
    const info = {
      environment,
      prefix,
      items: {},
      totalSize: 0,
      itemCount: 0
    };

    Object.entries(COPY_ITEMS).forEach(([itemKey, itemConfig]) => {
      const storageKey = prefix + itemConfig.sourceKey;
      const data = localStorage.getItem(storageKey);
      const size = data ? data.length : 0;

      info.items[itemKey] = {
        hasData: data !== null,
        size,
        lastModified: data ? Date.now() : null
      };

      info.totalSize += size;
      if (data !== null) info.itemCount++;
    });

    return info;
  } catch (error) {
    console.error(`[COPY_UTILS] Failed to get storage info for ${environment}:`, error);
    return {
      environment,
      error: error.message,
      items: {},
      totalSize: 0,
      itemCount: 0
    };
  }
}

/**
 * Merge configuration data intelligently
 * @param {Object} targetData - Existing target configuration
 * @param {Object} sourceData - Source configuration to merge
 * @returns {Object} Merged configuration
 */
function mergeConfigData(targetData, sourceData) {
  try {
    const merged = {
      ...targetData,
      userDefaults: {
        ...targetData.userDefaults,
        ...sourceData.userDefaults
      },
      isActive: sourceData.isActive !== undefined ? sourceData.isActive : targetData.isActive,
      version: sourceData.version || targetData.version,
      timestamp: Date.now()
    };

    return merged;
  } catch (error) {
    console.error('[COPY_UTILS] Config merge failed:', error);
    return sourceData; // Fall back to source data
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Quick copy from production to development
 * @param {Array<string>} items - Items to copy (optional)
 * @returns {Object} Copy result
 */
export async function copyFromProduction(items = null) {
  return copyBetweenEnvironments({
    sourceEnv: 'production',
    targetEnv: 'development',
    items: items || ['layout', 'config', 'settings', 'sizes']
  });
}

/**
 * Quick copy from development to production
 * @param {Array<string>} items - Items to copy (optional)
 * @returns {Object} Copy result
 */
export async function copyToProduction(items = null) {
  return copyBetweenEnvironments({
    sourceEnv: 'development',
    targetEnv: 'production',
    items: items || ['layout', 'config', 'settings', 'sizes']
  });
}

/**
 * Get comparison between environments
 * @returns {Object} Comparison result
 */
export async function compareEnvironments() {
  try {
    const devInfo = await getEnvironmentStorageInfo('development');
    const prodInfo = await getEnvironmentStorageInfo('production');

    const comparison = {
      development: devInfo,
      production: prodInfo,
      differences: [],
      summary: {
        devOnly: [],
        prodOnly: [],
        bothPresent: [],
        bothMissing: []
      }
    };

    // Compare each item
    Object.keys(COPY_ITEMS).forEach(itemKey => {
      const devHasData = devInfo.items[itemKey]?.hasData || false;
      const prodHasData = prodInfo.items[itemKey]?.hasData || false;

      if (devHasData && !prodHasData) {
        comparison.summary.devOnly.push(itemKey);
      } else if (!devHasData && prodHasData) {
        comparison.summary.prodOnly.push(itemKey);
      } else if (devHasData && prodHasData) {
        comparison.summary.bothPresent.push(itemKey);

        // Compare data sizes for differences
        const devSize = devInfo.items[itemKey].size;
        const prodSize = prodInfo.items[itemKey].size;
        if (devSize !== prodSize) {
          comparison.differences.push({
            item: itemKey,
            type: 'size_difference',
            devSize,
            prodSize,
            diff: Math.abs(devSize - prodSize)
          });
        }
      } else {
        comparison.summary.bothMissing.push(itemKey);
      }
    });

    return comparison;
  } catch (error) {
    console.error('[COPY_UTILS] Environment comparison failed:', error);
    return {
      error: error.message,
      development: null,
      production: null,
      differences: [],
      summary: {}
    };
  }
}

/**
 * Validate all data in current environment
 * @returns {Object} Validation results
 */
export function validateCurrentEnvironment() {
  const results = {
    isValid: true,
    items: {},
    errors: [],
    warnings: [],
    summary: {
      valid: 0,
      invalid: 0,
      missing: 0
    }
  };

  Object.entries(COPY_ITEMS).forEach(([itemKey, itemConfig]) => {
    try {
      const data = itemConfig.loadFunction();

      if (data === null) {
        results.items[itemKey] = {
          status: 'missing',
          error: 'No data found'
        };
        results.summary.missing++;
      } else if (itemConfig.validator) {
        const validation = itemConfig.validator(data);
        results.items[itemKey] = {
          status: validation.isValid ? 'valid' : 'invalid',
          validation
        };

        if (validation.isValid) {
          results.summary.valid++;
        } else {
          results.summary.invalid++;
          results.isValid = false;
          results.errors.push(...validation.errors.map(e => `${itemKey}: ${e}`));
        }

        if (validation.warnings && validation.warnings.length > 0) {
          results.warnings.push(...validation.warnings.map(w => `${itemKey}: ${w}`));
        }
      } else {
        results.items[itemKey] = {
          status: 'valid',
          message: 'No validator available'
        };
        results.summary.valid++;
      }
    } catch (error) {
      results.items[itemKey] = {
        status: 'error',
        error: error.message
      };
      results.summary.invalid++;
      results.isValid = false;
      results.errors.push(`${itemKey}: ${error.message}`);
    }
  });

  return results;
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  // Main operations
  copyBetweenEnvironments,
  copyFromProduction,
  copyToProduction,

  // Backup and rollback
  createBackup,
  restoreFromBackup,
  listBackups,
  deleteBackup,
  cleanupOldBackups,

  // Analysis and validation
  compareEnvironments,
  validateCurrentEnvironment,

  // Configuration
  COPY_PRESETS,
  COPY_ITEMS
};