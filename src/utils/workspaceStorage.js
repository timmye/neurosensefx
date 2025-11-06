// Workspace Settings Storage Utility
// Handles localStorage persistence for canvas workspace settings

const STORAGE_KEYS = {
  WORKSPACE_SETTINGS: 'neurosensefx-workspace-settings',
  DISPLAY_SIZES: 'neurosensefx-display-sizes'
};

const DEFAULT_SETTINGS = {
  gridSnapEnabled: true, // ✅ ENABLED: Clean grid snapping with threshold
  gridSize: 20, // ✅ 20px grid size from CleanFloatingElement
  collisionDetectionEnabled: true, // ✅ ENABLED: Smart collision detection
  showResizeHandles: true,
  showGridLines: false,
  allowOverlap: false
};

/**
 * Save workspace settings to localStorage
 * @param {Object} settings - Workspace settings object
 */
export function saveWorkspaceSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEYS.WORKSPACE_SETTINGS, JSON.stringify(settings));
  } catch (error) {
    console.warn('[WORKSPACE_STORAGE] Failed to save workspace settings:', error);
  }
}

/**
 * Load workspace settings from localStorage
 * @returns {Object} Workspace settings object
 */
export function loadWorkspaceSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.WORKSPACE_SETTINGS);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (error) {
    console.warn('[WORKSPACE_STORAGE] Failed to load workspace settings:', error);
  }
  return { ...DEFAULT_SETTINGS };
}

/**
 * Save display sizes to localStorage
 * @param {Map} displays - Map of display objects with sizes
 */
export function saveDisplaySizes(displays) {
  try {
    const sizes = {};
    displays.forEach((display, id) => {
      sizes[id] = {
        width: display.config.visualizationsContentWidth,
        height: display.config.meterHeight
      };
    });
    localStorage.setItem(STORAGE_KEYS.DISPLAY_SIZES, JSON.stringify(sizes));
  } catch (error) {
    console.warn('[WORKSPACE_STORAGE] Failed to save display sizes:', error);
  }
}

/**
 * Load display sizes from localStorage
 * @returns {Object} Display sizes object with id as key
 */
export function loadDisplaySizes() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.DISPLAY_SIZES);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('[WORKSPACE_STORAGE] Failed to load display sizes:', error);
  }
  return {};
}

/**
 * Clear all workspace-related data from localStorage
 */
export function clearWorkspaceData() {
  try {
    localStorage.removeItem(STORAGE_KEYS.WORKSPACE_SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.DISPLAY_SIZES);
  } catch (error) {
    console.warn('[WORKSPACE_STORAGE] Failed to clear workspace data:', error);
  }
}

/**
 * Get storage usage information
 * @returns {Object} Storage usage stats
 */
export function getStorageInfo() {
  try {
    const workspaceSettings = localStorage.getItem(STORAGE_KEYS.WORKSPACE_SETTINGS);
    const displaySizes = localStorage.getItem(STORAGE_KEYS.DISPLAY_SIZES);
    
    return {
      workspaceSettingsSize: workspaceSettings ? workspaceSettings.length : 0,
      displaySizesSize: displaySizes ? displaySizes.length : 0,
      totalSize: (workspaceSettings?.length || 0) + (displaySizes?.length || 0)
    };
  } catch (error) {
    console.warn('[WORKSPACE_STORAGE] Failed to get storage info:', error);
    return {
      workspaceSettingsSize: 0,
      displaySizesSize: 0,
      totalSize: 0
    };
  }
}

/**
 * Auto-save utility for debounced saving
 */
export class AutoSaver {
  constructor(saveFunction, delay = 1000) {
    this.saveFunction = saveFunction;
    this.delay = delay;
    this.timeoutId = null;
  }

  save(data) {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    
    this.timeoutId = setTimeout(() => {
      this.saveFunction(data);
      this.timeoutId = null;
    }, this.delay);
  }

  cancel() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  flush() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
      // Immediate save if pending
      this.saveFunction();
    }
  }
}

// Create auto-saver instances
export const workspaceSettingsAutoSaver = new AutoSaver(saveWorkspaceSettings);
export const displaySizesAutoSaver = new AutoSaver(saveDisplaySizes);

// =============================================================================
// WORKSPACE LAYOUT FUNCTIONS (extending existing storage pattern)
// =============================================================================

/**
 * Save workspace layout to localStorage
 * @param {Object} layout - Workspace layout object
 */
export function saveWorkspaceLayout(layout) {
  try {
    const data = JSON.stringify(layout);
    localStorage.setItem('neurosensefx-workspace-layout', data);
    console.log('[WORKSPACE_STORAGE] Workspace layout saved:', {
      displayCount: layout.displays?.length || 0,
      panelCount: layout.panels?.length || 0,
      iconCount: layout.icons?.length || 0,
      dataSize: data.length
    });
  } catch (error) {
    console.warn('[WORKSPACE_STORAGE] Failed to save workspace layout:', error);
  }
}

/**
 * Load workspace layout from localStorage
 * @returns {Object|null} Workspace layout or null if not found
 */
export function loadWorkspaceLayout() {
  try {
    const stored = localStorage.getItem('neurosensefx-workspace-layout');
    if (stored) {
      const layout = JSON.parse(stored);
      console.log('[WORKSPACE_STORAGE] Workspace layout loaded:', {
        displayCount: layout.displays?.length || 0,
        panelCount: layout.panels?.length || 0,
        iconCount: layout.icons?.length || 0,
        timestamp: layout.timestamp
      });
      return layout;
    }
  } catch (error) {
    console.warn('[WORKSPACE_STORAGE] Failed to load workspace layout:', error);
  }
  return null;
}

/**
 * Save global configuration state
 * @param {Object} config - Global configuration object
 */
export function saveGlobalConfigState(config) {
  try {
    const data = JSON.stringify(config);
    localStorage.setItem('neurosensefx-global-config', data);
    console.log('[WORKSPACE_STORAGE] Global config saved:', {
      hasUserModifications: config.isActive,
      modifiedParameters: Object.keys(config.userDefaults || {}).length,
      dataSize: data.length
    });
  } catch (error) {
    console.warn('[WORKSPACE_STORAGE] Failed to save global config state:', error);
  }
}

/**
 * Load global configuration state from localStorage
 * @returns {Object|null} Global configuration or null if not found
 */
export function loadGlobalConfigState() {
  try {
    const stored = localStorage.getItem('neurosensefx-global-config');
    if (stored) {
      const config = JSON.parse(stored);
      console.log('[WORKSPACE_STORAGE] Global config loaded:', {
        hasUserModifications: config.isActive,
        modifiedParameters: Object.keys(config.userDefaults || {}).length,
        version: config.version
      });
      return config;
    }
  } catch (error) {
    console.warn('[WORKSPACE_STORAGE] Failed to load global config state:', error);
  }
  return null;
}

/**
 * Save user preferences
 * @param {Object} preferences - User preferences object
 */
export function saveUserPreferences(preferences) {
  try {
    localStorage.setItem('neurosensefx-user-preferences', JSON.stringify(preferences));
    console.log('[WORKSPACE_STORAGE] User preferences saved');
  } catch (error) {
    console.warn('[WORKSPACE_STORAGE] Failed to save user preferences:', error);
  }
}

/**
 * Load user preferences from localStorage
 * @returns {Object|null} User preferences or null if not found
 */
export function loadUserPreferences() {
  try {
    const stored = localStorage.getItem('neurosensefx-user-preferences');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('[WORKSPACE_STORAGE] Failed to load user preferences:', error);
  }
  return null;
}

/**
 * Enhanced clear function for all workspace data
 */
export function clearAllWorkspaceData() {
  try {
    // Clear existing data
    clearWorkspaceData();
    
    // Clear new persistence data
    localStorage.removeItem('neurosensefx-workspace-layout');
    localStorage.removeItem('neurosensefx-global-config');
    localStorage.removeItem('neurosensefx-user-preferences');
    localStorage.removeItem('neurosensefx-workspace-metadata');
    
    console.log('[WORKSPACE_STORAGE] All workspace data cleared');
  } catch (error) {
    console.warn('[WORKSPACE_STORAGE] Failed to clear all workspace data:', error);
  }
}

/**
 * Get comprehensive storage usage information
 * @returns {Object} Detailed storage usage stats
 */
export function getComprehensiveStorageInfo() {
  try {
    const info = {
      // Existing storage
      workspaceSettings: 0,
      displaySizes: 0,
      
      // New storage
      workspaceLayout: 0,
      globalConfig: 0,
      userPreferences: 0,
      workspaceMetadata: 0,
      
      totals: {
        existing: 0,
        new: 0,
        overall: 0
      }
    };

    // Check existing storage
    const workspaceSettings = localStorage.getItem(STORAGE_KEYS.WORKSPACE_SETTINGS);
    const displaySizes = localStorage.getItem(STORAGE_KEYS.DISPLAY_SIZES);
    
    info.workspaceSettings = workspaceSettings ? workspaceSettings.length : 0;
    info.displaySizes = displaySizes ? displaySizes.length : 0;
    
    // Check new storage
    const workspaceLayout = localStorage.getItem('neurosensefx-workspace-layout');
    const globalConfig = localStorage.getItem('neurosensefx-global-config');
    const userPreferences = localStorage.getItem('neurosensefx-user-preferences');
    const workspaceMetadata = localStorage.getItem('neurosensefx-workspace-metadata');
    
    info.workspaceLayout = workspaceLayout ? workspaceLayout.length : 0;
    info.globalConfig = globalConfig ? globalConfig.length : 0;
    info.userPreferences = userPreferences ? userPreferences.length : 0;
    info.workspaceMetadata = workspaceMetadata ? workspaceMetadata.length : 0;
    
    // Calculate totals
    info.totals.existing = info.workspaceSettings + info.displaySizes;
    info.totals.new = info.workspaceLayout + info.globalConfig + info.userPreferences + info.workspaceMetadata;
    info.totals.overall = info.totals.existing + info.totals.new;

    return info;
  } catch (error) {
    console.warn('[WORKSPACE_STORAGE] Failed to get comprehensive storage info:', error);
    return {
      workspaceSettings: 0,
      displaySizes: 0,
      workspaceLayout: 0,
      globalConfig: 0,
      userPreferences: 0,
      workspaceMetadata: 0,
      totals: { existing: 0, new: 0, overall: 0 }
    };
  }
}

/**
 * Validate storage data integrity
 * @returns {Object} Validation results
 */
export function validateStorageIntegrity() {
  try {
    const results = {
      isValid: true,
      errors: [],
      warnings: [],
      dataFound: {}
    };

    // Check workspace layout
    const layoutData = localStorage.getItem('neurosensefx-workspace-layout');
    if (layoutData) {
      try {
        const layout = JSON.parse(layoutData);
        results.dataFound.workspaceLayout = true;
        
        if (!layout.displays || !Array.isArray(layout.displays)) {
          results.errors.push('Invalid workspace layout: missing or invalid displays array');
          results.isValid = false;
        }
        
        if (!layout.panels || !Array.isArray(layout.panels)) {
          results.errors.push('Invalid workspace layout: missing or invalid panels array');
          results.isValid = false;
        }
        
        if (!layout.icons || !Array.isArray(layout.icons)) {
          results.errors.push('Invalid workspace layout: missing or invalid icons array');
          results.isValid = false;
        }
      } catch (parseError) {
        results.errors.push(`Invalid workspace layout JSON: ${parseError.message}`);
        results.isValid = false;
      }
    }

    // Check global config
    const configData = localStorage.getItem('neurosensefx-global-config');
    if (configData) {
      try {
        const config = JSON.parse(configData);
        results.dataFound.globalConfig = true;
        
        if (!config.userDefaults || typeof config.userDefaults !== 'object') {
          results.errors.push('Invalid global config: missing or invalid userDefaults object');
          results.isValid = false;
        }
        
        if (typeof config.isActive !== 'boolean') {
          results.errors.push('Invalid global config: missing or invalid isActive boolean');
          results.isValid = false;
        }
      } catch (parseError) {
        results.errors.push(`Invalid global config JSON: ${parseError.message}`);
        results.isValid = false;
      }
    }

    // Check for data size warnings
    const info = getComprehensiveStorageInfo();
    if (info.totals.overall > 500000) { // 500KB warning threshold
      results.warnings.push(`Large storage usage: ${(info.totals.overall / 1024).toFixed(1)}KB`);
    }

    return results;
  } catch (error) {
    return {
      isValid: false,
      errors: [`Storage validation error: ${error.message}`],
      warnings: [],
      dataFound: {}
    };
  }
}

/**
 * Migrate old storage format to new format
 * @returns {boolean} Migration success status
 */
export function migrateStorageFormat() {
  try {
    console.log('[WORKSPACE_STORAGE] Starting storage format migration...');
    
    // Check if migration is needed
    const newLayoutExists = localStorage.getItem('neurosensefx-workspace-layout');
    if (newLayoutExists) {
      console.log('[WORKSPACE_STORAGE] New format already exists, skipping migration');
      return true;
    }
    
    // Get old data
    const oldDisplays = loadDisplaySizes();
    const oldSettings = loadWorkspaceSettings();
    
    if (!oldDisplays && !oldSettings) {
      console.log('[WORKSPACE_STORAGE] No old data found to migrate');
      return true;
    }
    
    // Create new layout structure from old data
    const newLayout = {
      version: '1.0.0',
      displays: Object.entries(oldDisplays || {}).map(([id, config]) => ({
        id,
        symbol: 'EURUSD', // Default symbol since old format didn't track it
        position: { x: 100, y: 100 }, // Default position
        size: { 
          width: config.visualizationsContentWidth || 220, 
          height: (config.meterHeight || 75) + 40 // Add header height
        },
        config: {},
        zIndex: 1,
        isActive: false
      })),
      panels: [],
      icons: [],
      timestamp: Date.now(),
      metadata: {
        exportDate: '',
        exportedBy: 'NeuroSense FX',
        description: 'Migrated from legacy storage format'
      }
    };
    
    // Save new format
    saveWorkspaceLayout(newLayout);
    
    // Create new global config from old settings
    const newGlobalConfig = {
      userDefaults: oldSettings || {},
      originalDefaults: {},
      isActive: Object.keys(oldSettings || {}).length > 0,
      version: '1.0.0',
      timestamp: Date.now()
    };
    
    saveGlobalConfigState(newGlobalConfig);
    
    console.log('[WORKSPACE_STORAGE] Storage migration completed successfully');
    return true;
  } catch (error) {
    console.error('[WORKSPACE_STORAGE] Storage migration failed:', error);
    return false;
  }
}
