// =============================================================================
// WORKSPACE PERSISTENCE MANAGER
// =============================================================================
// Centralized persistence system for workspace layouts, configurations, and defaults
// Extends existing workspaceStorage.js patterns for unified workspace management

import { 
  saveWorkspaceSettings, 
  loadWorkspaceSettings,
  saveDisplaySizes,
  loadDisplaySizes,
  clearWorkspaceData,
  AutoSaver
} from './workspaceStorage.js';
import { configDefaultsManager } from './configDefaults.js';

// =============================================================================
// STORAGE KEYS (extending existing workspaceStorage.js pattern)
// =============================================================================

const STORAGE_KEYS = {
  WORKSPACE_LAYOUT: 'neurosensefx-workspace-layout',
  GLOBAL_CONFIG: 'neurosensefx-global-config',
  USER_PREFERENCES: 'neurosensefx-user-preferences',
  WORKSPACE_METADATA: 'neurosensefx-workspace-metadata'
};

// =============================================================================
// WORKSPACE LAYOUT SCHEMA
// =============================================================================

const WORKSPACE_LAYOUT_SCHEMA = {
  version: '1.0.0',
  displays: [],
  panels: [],
  icons: [],
  timestamp: 0,
  metadata: {
    exportDate: '',
    exportedBy: 'NeuroSense FX',
    description: ''
  }
};

const GLOBAL_CONFIG_SCHEMA = {
  userDefaults: {},
  originalDefaults: {},
  isActive: false,
  version: '1.0.0',
  timestamp: 0
};

// =============================================================================
// WORKSPACE PERSISTENCE MANAGER CLASS
// =============================================================================

export class WorkspacePersistenceManager {
  constructor(autoSaverDelay = 1000) {
    this.autoSaverDelay = autoSaverDelay;
    this.workspaceAutoSaver = null;
    this.globalConfigAutoSaver = null;
    this.currentLayout = null;
    this.isInitialized = false;
    
    this.initializeAutoSavers();
  }

  /**
   * Initialize auto-savers for debounced persistence
   */
  initializeAutoSavers() {
    this.workspaceAutoSaver = new AutoSaver((layout) => {
      this.saveWorkspaceLayoutImmediate(layout);
    }, this.autoSaverDelay);

    this.globalConfigAutoSaver = new AutoSaver((config) => {
      this.saveGlobalConfigImmediate(config);
    }, this.autoSaverDelay);
  }

  /**
   * Save complete workspace layout to localStorage
   * @param {Map} displays - Map of display objects
   * @param {Map} panels - Map of panel objects  
   * @param {Map} icons - Map of icon objects
   */
  saveWorkspaceLayout(displays, panels, icons) {
    try {
      const layout = this.createWorkspaceLayout(displays, panels, icons);
      this.workspaceAutoSaver.save(layout);
      this.currentLayout = layout;
      
      console.log('[WORKSPACE_PERSISTENCE] Workspace layout saved:', {
        displayCount: displays.size,
        panelCount: panels.size,
        iconCount: icons.size
      });
    } catch (error) {
      console.error('[WORKSPACE_PERSISTENCE] Failed to save workspace layout:', error);
    }
  }

  /**
   * Load workspace layout from localStorage
   * @returns {Object|null} Workspace layout or null if not found
   */
  loadWorkspaceLayout() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.WORKSPACE_LAYOUT);
      if (stored) {
        const layout = JSON.parse(stored);
        const validation = this.validateWorkspaceLayout(layout);
        
        if (validation.isValid) {
          console.log('[WORKSPACE_PERSISTENCE] Workspace layout loaded successfully');
          return layout;
        } else {
          console.warn('[WORKSPACE_PERSISTENCE] Invalid workspace layout data:', validation.errors);
          return null;
        }
      }
    } catch (error) {
      console.error('[WORKSPACE_PERSISTENCE] Failed to load workspace layout:', error);
    }
    return null;
  }

  /**
   * Save global configuration defaults
   * @param {Object} userDefaults - User-modified defaults
   */
  saveGlobalConfig(userDefaults = {}) {
    try {
      const config = {
        userDefaults,
        originalDefaults: configDefaultsManager.getFactoryDefaults(),
        isActive: Object.keys(userDefaults).length > 0,
        version: GLOBAL_CONFIG_SCHEMA.version,
        timestamp: Date.now()
      };

      this.globalConfigAutoSaver.save(config);
      configDefaultsManager.importState(config);
      
      console.log('[WORKSPACE_PERSISTENCE] Global config saved:', {
        hasUserModifications: config.isActive,
        modifiedParameters: Object.keys(userDefaults)
      });
    } catch (error) {
      console.error('[WORKSPACE_PERSISTENCE] Failed to save global config:', error);
    }
  }

  /**
   * Load global configuration defaults
   * @returns {Object|null} Global configuration or null if not found
   */
  loadGlobalConfig() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.GLOBAL_CONFIG);
      if (stored) {
        const config = JSON.parse(stored);
        const validation = this.validateGlobalConfig(config);
        
        if (validation.isValid) {
          configDefaultsManager.importState(config);
          console.log('[WORKSPACE_PERSISTENCE] Global config loaded successfully');
          return config;
        } else {
          console.warn('[WORKSPACE_PERSISTENCE] Invalid global config data:', validation.errors);
          return null;
        }
      }
    } catch (error) {
      console.error('[WORKSPACE_PERSISTENCE] Failed to load global config:', error);
    }
    return null;
  }

  /**
   * Reset global configuration to factory defaults
   */
  resetToFactoryDefaults() {
    try {
      configDefaultsManager.resetToFactory();
      this.saveGlobalConfig({});
      
      console.log('[WORKSPACE_PERSISTENCE] Reset to factory defaults completed');
    } catch (error) {
      console.error('[WORKSPACE_PERSISTENCE] Failed to reset to factory defaults:', error);
    }
  }

  /**
   * Export workspace as JSON string
   * @param {Map} displays - Map of display objects
   * @param {Map} panels - Map of panel objects
   * @param {Map} icons - Map of icon objects
   * @param {Object} metadata - Optional metadata
   * @returns {string} JSON string of workspace
   */
  exportWorkspace(displays, panels, icons, metadata = {}) {
    try {
      const layout = this.createWorkspaceLayout(displays, panels, icons);
      layout.metadata = {
        ...WORKSPACE_LAYOUT_SCHEMA.metadata,
        exportDate: new Date().toISOString(),
        exportedBy: 'NeuroSense FX',
        description: metadata.description || 'Exported workspace layout',
        ...metadata
      };

      const globalConfig = {
        userDefaults: configDefaultsManager.getUserDefaults(),
        isActive: configDefaultsManager.isActive,
        version: GLOBAL_CONFIG_SCHEMA.version
      };

      const exportData = {
        workspaceLayout: layout,
        globalConfig,
        exportInfo: {
          version: '1.0.0',
          exportDate: new Date().toISOString(),
          neurosensefxVersion: '1.0.0'
        }
      };

      console.log('[WORKSPACE_PERSISTENCE] Workspace exported successfully');
      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('[WORKSPACE_PERSISTENCE] Failed to export workspace:', error);
      return null;
    }
  }

  /**
   * Import workspace from JSON string
   * @param {string} jsonData - JSON string of exported workspace
   * @returns {boolean} Success status
   */
  importWorkspace(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      
      if (!data.workspaceLayout || !data.globalConfig) {
        console.error('[WORKSPACE_PERSISTENCE] Invalid workspace export format');
        return false;
      }

      // Validate workspace layout
      const layoutValidation = this.validateWorkspaceLayout(data.workspaceLayout);
      if (!layoutValidation.isValid) {
        console.error('[WORKSPACE_PERSISTENCE] Invalid workspace layout:', layoutValidation.errors);
        return false;
      }

      // Validate global config
      const configValidation = this.validateGlobalConfig(data.globalConfig);
      if (!configValidation.isValid) {
        console.error('[WORKSPACE_PERSISTENCE] Invalid global config:', configValidation.errors);
        return false;
      }

      // Save imported data
      this.saveWorkspaceLayoutImmediate(data.workspaceLayout);
      configDefaultsManager.importState(data.globalConfig);
      this.saveGlobalConfigImmediate(data.globalConfig);

      console.log('[WORKSPACE_PERSISTENCE] Workspace imported successfully');
      return true;
    } catch (error) {
      console.error('[WORKSPACE_PERSISTENCE] Failed to import workspace:', error);
      return false;
    }
  }

  /**
   * Create workspace layout object from current state
   * @param {Map} displays - Map of display objects
   * @param {Map} panels - Map of panel objects
   * @param {Map} icons - Map of icon objects
   * @returns {Object} Workspace layout object
   */
  createWorkspaceLayout(displays, panels, icons) {
    const layoutDisplays = [];
    const layoutPanels = [];
    const layoutIcons = [];

    // Convert displays to serializable format
    displays.forEach((display, id) => {
      layoutDisplays.push({
        id,
        symbol: display.symbol,
        position: { ...display.position },
        size: { 
          width: display.size?.width || 220, 
          height: display.size?.height || 160 
        },
        config: this.extractUserOverrides(display.config),
        zIndex: display.zIndex || 1,
        isActive: display.isActive || false
      });
    });

    // Convert panels to serializable format
    panels.forEach((panel, id) => {
      layoutPanels.push({
        id,
        type: panel.type,
        position: { ...panel.position },
        size: { ...panel.size },
        isVisible: panel.isVisible !== false, // Default to true
        zIndex: panel.zIndex || 1000,
        isActive: panel.isActive || false,
        config: panel.config || {}
      });
    });

    // Convert icons to serializable format
    icons.forEach((icon, id) => {
      layoutIcons.push({
        id,
        type: icon.type,
        position: { ...icon.position },
        isExpanded: icon.isExpanded || false,
        zIndex: icon.zIndex || 10000,
        isActive: icon.isActive || false,
        config: icon.config || {}
      });
    });

    return {
      ...WORKSPACE_LAYOUT_SCHEMA,
      displays: layoutDisplays,
      panels: layoutPanels,
      icons: layoutIcons,
      timestamp: Date.now()
    };
  }

  /**
   * Extract user overrides from display configuration
   * @param {Object} config - Display configuration
   * @returns {Object} User overrides only
   */
  extractUserOverrides(config) {
    const factoryDefaults = configDefaultsManager.getFactoryDefaults();
    const userDefaults = configDefaultsManager.getUserDefaults();
    const overrides = {};

    // Find parameters that differ from effective defaults
    Object.keys(config).forEach(key => {
      const effectiveValue = userDefaults[key] !== undefined ? userDefaults[key] : factoryDefaults[key];
      if (config[key] !== effectiveValue) {
        overrides[key] = config[key];
      }
    });

    return overrides;
  }

  /**
   * Validate workspace layout data
   * @param {Object} layout - Workspace layout to validate
   * @returns {Object} Validation result
   */
  validateWorkspaceLayout(layout) {
    const errors = [];

    if (!layout || typeof layout !== 'object') {
      errors.push('Layout must be an object');
      return { isValid: false, errors };
    }

    if (!Array.isArray(layout.displays)) {
      errors.push('Layout displays must be an array');
    }

    if (!Array.isArray(layout.panels)) {
      errors.push('Layout panels must be an array');
    }

    if (!Array.isArray(layout.icons)) {
      errors.push('Layout icons must be an array');
    }

    // Validate display objects
    if (layout.displays) {
      layout.displays.forEach((display, index) => {
        if (!display.id) errors.push(`Display ${index}: missing id`);
        if (!display.symbol) errors.push(`Display ${index}: missing symbol`);
        if (!display.position) errors.push(`Display ${index}: missing position`);
        if (!display.size) errors.push(`Display ${index}: missing size`);
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate global configuration data
   * @param {Object} config - Global config to validate
   * @returns {Object} Validation result
   */
  validateGlobalConfig(config) {
    const errors = [];

    if (!config || typeof config !== 'object') {
      errors.push('Global config must be an object');
      return { isValid: false, errors };
    }

    if (!config.userDefaults || typeof config.userDefaults !== 'object') {
      errors.push('Global config userDefaults must be an object');
    }

    if (typeof config.isActive !== 'boolean') {
      errors.push('Global config isActive must be a boolean');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Initialize workspace on app startup
   * @returns {Object} Initial workspace state
   */
  async initializeWorkspace() {
    try {
      console.log('[WORKSPACE_PERSISTENCE] Initializing workspace...');

      // Load global configuration first
      const globalConfig = this.loadGlobalConfig();
      
      // Load workspace layout
      const layout = this.loadWorkspaceLayout();

      this.isInitialized = true;

      console.log('[WORKSPACE_PERSISTENCE] Workspace initialized:', {
        hasGlobalConfig: !!globalConfig,
        hasLayout: !!layout,
        globalConfigActive: globalConfig?.isActive || false
      });

      return {
        globalConfig,
        layout,
        defaults: configDefaultsManager.getEffectiveDefaults()
      };
    } catch (error) {
      console.error('[WORKSPACE_PERSISTENCE] Failed to initialize workspace:', error);
      return {
        globalConfig: null,
        layout: null,
        defaults: configDefaultsManager.getFactoryDefaults()
      };
    }
  }

  /**
   * Cleanup workspace on app shutdown
   */
  cleanupWorkspace() {
    try {
      console.log('[WORKSPACE_PERSISTENCE] Cleaning up workspace...');

      // Flush any pending auto-saves
      if (this.workspaceAutoSaver) {
        this.workspaceAutoSaver.flush();
      }
      if (this.globalConfigAutoSaver) {
        this.globalConfigAutoSaver.flush();
      }

      this.isInitialized = false;
      console.log('[WORKSPACE_PERSISTENCE] Workspace cleanup completed');
    } catch (error) {
      console.error('[WORKSPACE_PERSISTENCE] Failed to cleanup workspace:', error);
    }
  }

  /**
   * Clear all workspace persistence data
   */
  clearAllPersistence() {
    try {
      // Clear existing workspace data
      clearWorkspaceData();
      
      // Clear new persistence data
      localStorage.removeItem(STORAGE_KEYS.WORKSPACE_LAYOUT);
      localStorage.removeItem(STORAGE_KEYS.GLOBAL_CONFIG);
      localStorage.removeItem(STORAGE_KEYS.USER_PREFERENCES);
      localStorage.removeItem(STORAGE_KEYS.WORKSPACE_METADATA);

      // Reset in-memory state
      configDefaultsManager.resetToFactory();
      this.currentLayout = null;

      console.log('[WORKSPACE_PERSISTENCE] All persistence data cleared');
    } catch (error) {
      console.error('[WORKSPACE_PERSISTENCE] Failed to clear persistence data:', error);
    }
  }

  /**
   * Get storage usage information
   * @returns {Object} Storage usage stats
   */
  getStorageInfo() {
    try {
      const info = {
        workspaceLayout: 0,
        globalConfig: 0,
        userPreferences: 0,
        workspaceMetadata: 0,
        total: 0
      };

      Object.keys(info).forEach(key => {
        if (key !== 'total') {
          const storageKey = STORAGE_KEYS[key.toUpperCase()];
          const data = localStorage.getItem(storageKey);
          info[key] = data ? data.length : 0;
          info.total += info[key];
        }
      });

      return info;
    } catch (error) {
      console.error('[WORKSPACE_PERSISTENCE] Failed to get storage info:', error);
      return {
        workspaceLayout: 0,
        globalConfig: 0,
        userPreferences: 0,
        workspaceMetadata: 0,
        total: 0
      };
    }
  }

  // =============================================================================
  // PRIVATE METHODS (immediate save operations)
  // =============================================================================

  /**
   * Immediate save of workspace layout (bypasses auto-saver)
   * @param {Object} layout - Workspace layout to save
   */
  saveWorkspaceLayoutImmediate(layout) {
    try {
      localStorage.setItem(STORAGE_KEYS.WORKSPACE_LAYOUT, JSON.stringify(layout));
    } catch (error) {
      console.error('[WORKSPACE_PERSISTENCE] Failed to save workspace layout immediately:', error);
    }
  }

  /**
   * Immediate save of global config (bypasses auto-saver)
   * @param {Object} config - Global config to save
   */
  saveGlobalConfigImmediate(config) {
    try {
      localStorage.setItem(STORAGE_KEYS.GLOBAL_CONFIG, JSON.stringify(config));
    } catch (error) {
      console.error('[WORKSPACE_PERSISTENCE] Failed to save global config immediately:', error);
    }
  }
}

// =============================================================================
// GLOBAL INSTANCE
// =============================================================================

export const workspacePersistenceManager = new WorkspacePersistenceManager();

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Merge workspace layout with current state
 * @param {Object} importedLayout - Imported workspace layout
 * @param {Map} currentDisplays - Current displays
 * @param {Map} currentPanels - Current panels
 * @param {Map} currentIcons - Current icons
 * @returns {Object} Merged workspace layout
 */
export function mergeWorkspaceLayout(importedLayout, currentDisplays, currentPanels, currentIcons) {
  try {
    const merged = { ...importedLayout };

    // Merge displays (preserve current if no conflict)
    if (importedLayout.displays) {
      merged.displays = importedLayout.displays.map(importedDisplay => {
        const existingDisplay = currentDisplays.get(importedDisplay.id);
        if (existingDisplay) {
          // Preserve current position/size if user has moved them
          return {
            ...importedDisplay,
            position: existingDisplay.position,
            size: existingDisplay.size
          };
        }
        return importedDisplay;
      });
    }

    return merged;
  } catch (error) {
    console.error('[WORKSPACE_PERSISTENCE] Failed to merge workspace layout:', error);
    return importedLayout;
  }
}

export default workspacePersistenceManager;
