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
