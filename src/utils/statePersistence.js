/**
 * State Persistence Utilities
 * Handles saving, loading, and synchronizing state with localStorage
 */

import { stateValidator } from './stateValidation.js';

// Storage keys
const STORAGE_KEYS = {
  WORKSPACE: 'neurosense_workspace',
  UI_STATE: 'neurosense_ui_state',
  PERFORMANCE_STATE: 'neurosense_performance_state',
  APPLICATION_STATE: 'neurosense_application_state',
  SETTINGS: 'neurosense_settings'
};

// Storage configuration
const STORAGE_CONFIG = {
  version: '1.0.0',
  compressionEnabled: false,
  encryptionEnabled: false,
  autoSaveInterval: 30000, // 30 seconds
  maxStorageSize: 10 * 1024 * 1024, // 10MB
  backupCount: 5
};

/**
 * Storage manager for state persistence
 */
export class StatePersistenceManager {
  constructor(config = {}) {
    this.config = { ...STORAGE_CONFIG, ...config };
    this.autoSaveTimers = new Map();
    this.changeListeners = new Map();
    this.lastSaveTimes = new Map();
  }

  /**
   * Save state to localStorage with validation and error handling
   */
  async saveState(key, state, options = {}) {
    const {
      validate = true,
      compress = this.config.compressionEnabled,
      encrypt = this.config.encryptionEnabled,
      backup = true
    } = options;

    try {
      // Validate state if required
      if (validate) {
        this.validateStateForStorage(key, state);
      }

      // Prepare data for storage
      let dataToStore = {
        version: this.config.version,
        timestamp: Date.now(),
        data: state,
        metadata: {
          size: this.calculateSize(state),
          compressed: compress,
          encrypted: encrypt
        }
      };

      // Compress if enabled
      if (compress) {
        dataToStore = await this.compressData(dataToStore);
      }

      // Encrypt if enabled
      if (encrypt) {
        dataToStore = await this.encryptData(dataToStore);
      }

      // Create backup if enabled
      if (backup) {
        await this.createBackup(key, dataToStore);
      }

      // Store in localStorage
      const serialized = JSON.stringify(dataToStore);
      localStorage.setItem(key, serialized);

      // Update last save time
      this.lastSaveTimes.set(key, Date.now());

      // Notify listeners
      this.notifyListeners(key, 'save', { state, timestamp: Date.now() });

      console.log(`[StatePersistence] Saved state for ${key}`);
      return true;

    } catch (error) {
      console.error(`[StatePersistence] Failed to save state for ${key}:`, error);
      
      // Try to save to emergency backup
      await this.saveEmergencyBackup(key, state, error);
      
      return false;
    }
  }

  /**
   * Load state from localStorage with validation and error handling
   */
  async loadState(key, options = {}) {
    const {
      validate = true,
      fallbackToBackup = true,
      migrateVersion = true
    } = options;

    try {
      // Check if key exists
      const stored = localStorage.getItem(key);
      if (!stored) {
        console.log(`[StatePersistence] No saved state found for ${key}`);
        return null;
      }

      // Parse stored data
      let dataContainer = JSON.parse(stored);

      // Decrypt if needed
      if (dataContainer.metadata?.encrypted) {
        dataContainer = await this.decryptData(dataContainer);
      }

      // Decompress if needed
      if (dataContainer.metadata?.compressed) {
        dataContainer = await this.decompressData(dataContainer);
      }

      // Validate version and migrate if needed
      if (migrateVersion && dataContainer.version !== this.config.version) {
        dataContainer = await this.migrateState(dataContainer);
      }

      // Validate state if required
      let state = dataContainer.data;
      if (validate) {
        state = this.validateLoadedState(key, state);
      }

      // Update last load time
      this.lastSaveTimes.set(key, Date.now());

      // Notify listeners
      this.notifyListeners(key, 'load', { state, timestamp: Date.now() });

      console.log(`[StatePersistence] Loaded state for ${key}`);
      return state;

    } catch (error) {
      console.error(`[StatePersistence] Failed to load state for ${key}:`, error);

      // Try fallback to backup
      if (fallbackToBackup) {
        console.log(`[StatePersistence] Attempting to load backup for ${key}`);
        return await this.loadBackupState(key, options);
      }

      return null;
    }
  }

  /**
   * Setup auto-save for a state key
   */
  setupAutoSave(key, getLatestState, options = {}) {
    const {
      interval = this.config.autoSaveInterval,
      debounceMs = 1000,
      condition = () => true
    } = options;

    // Clear existing timer
    if (this.autoSaveTimers.has(key)) {
      clearInterval(this.autoSaveTimers.get(key));
    }

    let debounceTimer = null;

    // Setup auto-save timer
    const timer = setInterval(async () => {
      if (condition()) {
        // Debounce rapid changes
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(async () => {
          try {
            const state = getLatestState();
            await this.saveState(key, state);
          } catch (error) {
            console.error(`[StatePersistence] Auto-save failed for ${key}:`, error);
          }
        }, debounceMs);
      }
    }, interval);

    this.autoSaveTimers.set(key, timer);
    console.log(`[StatePersistence] Auto-save setup for ${key} (${interval}ms)`);
  }

  /**
   * Stop auto-save for a state key
   */
  stopAutoSave(key) {
    if (this.autoSaveTimers.has(key)) {
      clearInterval(this.autoSaveTimers.get(key));
      this.autoSaveTimers.delete(key);
      console.log(`[StatePersistence] Auto-save stopped for ${key}`);
    }
  }

  /**
   * Add change listener for a state key
   */
  addChangeListener(key, callback) {
    if (!this.changeListeners.has(key)) {
      this.changeListeners.set(key, new Set());
    }
    this.changeListeners.get(key).add(callback);
  }

  /**
   * Remove change listener for a state key
   */
  removeChangeListener(key, callback) {
    if (this.changeListeners.has(key)) {
      this.changeListeners.get(key).delete(callback);
    }
  }

  /**
   * Clear all persisted state
   */
  async clearAllState() {
    const keys = Object.values(STORAGE_KEYS);
    
    for (const key of keys) {
      try {
        localStorage.removeItem(key);
        this.stopAutoSave(key);
        console.log(`[StatePersistence] Cleared state for ${key}`);
      } catch (error) {
        console.error(`[StatePersistence] Failed to clear state for ${key}:`, error);
      }
    }

    // Clear backups
    await this.clearAllBackups();
  }

  /**
   * Compress data (FUTURE: implement actual compression algorithm)
   * TODO: Implement LZ4 or similar compression for large datasets
   * Currently returns JSON string - no compression applied
   */
  compressData(data) {
    // FUTURE_IMPLEMENTATION: Add real compression for workspace data
    // Consider using compression library like pako or lz-string
    console.warn('[statePersistence] Using placeholder compression - implement real compression for production');
    return JSON.stringify(data);
  }

  /**
   * Decompress data (FUTURE: implement actual decompression)
   * TODO: Implement decompression matching compressData algorithm
   * Currently parses JSON string - no decompression applied
   */
  decompressData(compressedData) {
    // FUTURE_IMPLEMENTATION: Add real decompression
    console.warn('[statePersistence] Using placeholder decompression - implement real decompression for production');
    return JSON.parse(compressedData);
  }

  /**
   * Encrypt data (FUTURE: implement actual encryption)
   * TODO: Implement proper encryption using Web Crypto API
   * Currently uses base64 encoding - NOT REAL ENCRYPTION
   */
  encryptData(data) {
    // FUTURE_IMPLEMENTATION: Implement proper encryption using Web Crypto API
    // WARNING: Current implementation is NOT secure - base64 is not encryption
    console.warn('[statePersistence] Using placeholder encryption - implement real encryption for production');
    return btoa(JSON.stringify(data));
  }

  /**
   * Decrypt data (FUTURE: implement actual decryption)
   * TODO: Implement proper decryption matching encryptData algorithm
   * Currently uses base64 decoding - NOT REAL DECRYPTION
   */
  decryptData(encryptedData) {
    // FUTURE_IMPLEMENTATION: Implement proper decryption
    // WARNING: Current implementation is NOT secure - base64 is not decryption
    console.warn('[statePersistence] Using placeholder decryption - implement real decryption for production');
    return JSON.parse(atob(encryptedData));
  }

  /**
   * Get storage statistics
   */
  getStorageStats() {
    const stats = {
      totalSize: 0,
      keys: {},
      availableSpace: 0
    };

    // Calculate total size and individual key sizes
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        try {
          const value = localStorage.getItem(key);
          const size = new Blob([value]).size;
          
          stats.totalSize += size;
          stats.keys[key] = {
            key,
            size,
            exists: true
          };
        } catch (error) {
          stats.keys[key] = {
            key,
            size: 0,
            exists: false,
            error: error.message
          };
        }
      }
    }

    return stats;
  }

  /**
   * Validate state before storage
   */
  validateStateForStorage(key, state) {
    switch (key) {
      case STORAGE_KEYS.WORKSPACE:
        stateValidator.validateWorkspace(state);
        break;
      case STORAGE_KEYS.UI_STATE:
        stateValidator.validateUI(state);
        break;
      case STORAGE_KEYS.PERFORMANCE_STATE:
        stateValidator.validatePerformance(state);
        break;
      case STORAGE_KEYS.APPLICATION_STATE:
        stateValidator.validateApplication(state);
        break;
      default:
        // Basic validation for unknown keys
        if (!state || typeof state !== 'object') {
          throw new Error('Invalid state: must be an object');
        }
    }
  }

  /**
   * Validate loaded state
   */
  validateLoadedState(key, state) {
    // Same validation as storage validation
    this.validateStateForStorage(key, state);
    return state;
  }

  /**
   * Calculate data size
   */
  calculateSize(data) {
    return new Blob([JSON.stringify(data)]).size;
  }

  /**
   * Create backup of current state
   */
  async createBackup(key, data) {
    const backupKey = `${key}_backup_${Date.now()}`;
    
    try {
      localStorage.setItem(backupKey, JSON.stringify(data));
      
      // Clean old backups
      await this.cleanOldBackups(key);
      
      console.log(`[StatePersistence] Created backup: ${backupKey}`);
    } catch (error) {
      console.error(`[StatePersistence] Failed to create backup for ${key}:`, error);
    }
  }

  /**
   * Load backup state
   */
  async loadBackupState(key, options = {}) {
    const backups = this.getAvailableBackups(key);
    
    if (backups.length === 0) {
      console.log(`[StatePersistence] No backups found for ${key}`);
      return null;
    }

    // Try most recent backup first
    for (const backup of backups.reverse()) {
      try {
        const stored = localStorage.getItem(backup.key);
        if (stored) {
          const dataContainer = JSON.parse(stored);
          const state = dataContainer.data;
          
          // Validate if required
          if (options.validate !== false) {
            this.validateLoadedState(key, state);
          }

          console.log(`[StatePersistence] Loaded backup: ${backup.key}`);
          return state;
        }
      } catch (error) {
        console.warn(`[StatePersistence] Failed to load backup ${backup.key}:`, error);
      }
    }

    return null;
  }

  /**
   * Get available backups for a key
   */
  getAvailableBackups(key) {
    const backups = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (storageKey && storageKey.startsWith(`${key}_backup_`)) {
        try {
          const stored = localStorage.getItem(storageKey);
          const data = JSON.parse(stored);
          
          backups.push({
            key: storageKey,
            timestamp: data.timestamp || parseInt(storageKey.split('_').pop()),
            size: this.calculateSize(stored)
          });
        } catch (error) {
          // Skip invalid backups
        }
      }
    }

    return backups.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Clean old backups
   */
  async cleanOldBackups(key) {
    const backups = this.getAvailableBackups(key);
    const maxBackups = this.config.backupCount;
    
    if (backups.length > maxBackups) {
      const toDelete = backups.slice(0, backups.length - maxBackups);
      
      for (const backup of toDelete) {
        localStorage.removeItem(backup.key);
        console.log(`[StatePersistence] Deleted old backup: ${backup.key}`);
      }
    }
  }

  /**
   * Save emergency backup
   */
  async saveEmergencyBackup(key, state, error) {
    try {
      const emergencyKey = `${key}_emergency_${Date.now()}`;
      const emergencyData = {
        originalError: error.message,
        timestamp: Date.now(),
        state: state,
        stack: error.stack
      };
      
      localStorage.setItem(emergencyKey, JSON.stringify(emergencyData));
      console.log(`[StatePersistence] Emergency backup saved: ${emergencyKey}`);
    } catch (backupError) {
      console.error(`[StatePersistence] Emergency backup failed:`, backupError);
    }
  }

  /**
   * Clear all backups
   */
  async clearAllBackups() {
    const keysToDelete = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('_backup_') || key.includes('_emergency_'))) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      localStorage.removeItem(key);
    }
    
    console.log(`[StatePersistence] Cleared ${keysToDelete.length} backup files`);
  }

  /**
   * Notify change listeners
   */
  notifyListeners(key, event, data) {
    const listeners = this.changeListeners.get(key);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(event, data);
        } catch (error) {
          console.error(`[StatePersistence] Listener error for ${key}:`, error);
        }
      });
    }
  }

  /**
   * Migrate state to new version
   */
  async migrateState(dataContainer) {
    // In a real implementation, you would handle version migrations
    // For now, just update the version
    console.log(`[StatePersistence] Migrating from version ${dataContainer.version} to ${this.config.version}`);
    
    return {
      ...dataContainer,
      version: this.config.version,
      timestamp: Date.now(),
      metadata: {
        ...dataContainer.metadata,
        migrated: true,
        originalVersion: dataContainer.version
      }
    };
  }

  /**
   * Destroy the persistence manager
   */
  destroy() {
    // Clear all auto-save timers
    for (const [key, timer] of this.autoSaveTimers) {
      clearInterval(timer);
    }
    this.autoSaveTimers.clear();
    
    // Clear all listeners
    this.changeListeners.clear();
    this.lastSaveTimes.clear();
    
    console.log('[StatePersistence] Persistence manager destroyed');
  }
}

// Create singleton instance
export const statePersistence = new StatePersistenceManager();

// Convenience functions
export const saveState = (key, state, options) => statePersistence.saveState(key, state, options);
export const loadState = (key, options) => statePersistence.loadState(key, options);
export const setupAutoSave = (key, getLatestState, options) => statePersistence.setupAutoSave(key, getLatestState, options);
export const stopAutoSave = (key) => statePersistence.stopAutoSave(key);

export default {
  StatePersistenceManager,
  statePersistence,
  saveState,
  loadState,
  setupAutoSave,
  stopAutoSave,
  STORAGE_KEYS,
  STORAGE_CONFIG
};
