// =============================================================================
// DISPLAY STATE STORE - Core Display Lifecycle Management
// =============================================================================
// Phase 2 of Architecture Decomposition: Extracted from monolithic displayStore.js
//
// RESPONSIBILITIES:
// - Display creation, configuration, and destruction
// - Display positioning and sizing management
// - Z-index management for proper layering
// - Active display tracking and focus management
// - Display readiness state management
//
// DESIGN PRINCIPLES:
// 1. Trading Safety: Zero breaking changes, preserve all existing functionality
// 2. Performance: Maintain 60fps rendering and sub-100ms latency
// 3. Atomic Updates: All state changes must be atomic and consistent
// 4. Backward Compatibility: Components continue working without changes
// 5. Clean Code: Single responsibility, clear interfaces, comprehensive docs

import { writable, derived } from 'svelte/store';
import { getEssentialDefaultConfig } from '../config/visualizationSchema.js';
import { workspacePersistenceManager } from '../utils/workspacePersistence.js';

// =============================================================================
// INITIAL STATE
// =============================================================================

/**
 * Initial state for display management
 * Focused purely on display lifecycle concerns
 */
const initialDisplayState = {
  // === DISPLAY MANAGEMENT ===
  // Canvas displays with symbols, positions, configurations, and state
  displays: new Map(),
  activeDisplayId: null,

  // === Z-INDEX MANAGEMENT ===
  // Layer management for proper stacking order
  nextDisplayZIndex: 1,

  // === DISPLAY READINESS TRACKING ===
  // Track which displays are ready for rendering
  readyDisplays: new Set()
};

// =============================================================================
// DISPLAY STATE STORE
// =============================================================================

export const displayStateStore = writable(initialDisplayState);

// =============================================================================
// DERIVED SELECTORS
// =============================================================================

/**
 * All displays Map
 */
export const displays = derived(displayStateStore, state => state.displays);

/**
 * Currently active display ID
 */
export const activeDisplayId = derived(displayStateStore, state => state.activeDisplayId);

/**
 * Currently active display object (or null if none)
 */
export const activeDisplay = derived(displayStateStore, state =>
  state.activeDisplayId ? state.displays.get(state.activeDisplayId) : null
);

/**
 * Array of all displays (for iteration)
 */
export const displaysArray = derived(displayStateStore, state => Array.from(state.displays.values()));

/**
 * Count of active displays
 */
export const displayCount = derived(displayStateStore, state => state.displays.size);

/**
 * Set of ready display IDs
 */
export const readyDisplays = derived(displayStateStore, state => state.readyDisplays);

/**
 * Whether all displays are ready
 */
export const allDisplaysReady = derived(displayStateStore, state =>
  state.displays.size > 0 && state.displays.size === state.readyDisplays.size
);

// =============================================================================
// DISPLAY LIFECYCLE ACTIONS
// =============================================================================

export const displayStateActions = {

  // ========================================================================
  // DISPLAY CREATION AND DESTRUCTION
  // ========================================================================

  /**
   * Add a new display to the workspace
   *
   * @param {string} symbol - Trading symbol to display (e.g., 'EURUSD')
   * @param {Object} position - Initial position {x, y} in pixels
   * @param {Object} config - Configuration overrides (merged with defaults)
   * @param {Object} size - Initial size {width, height} in pixels (optional)
   * @returns {string} Display ID for reference
   *
   * Performance: Sub-100ms operation, minimal memory allocation
   * Safety: Atomic state update, no partial display creation
   */
  addDisplay: (symbol, position = { x: 100, y: 100 }, config = {}, size = null) => {
    const normalizedSymbol = symbol.toUpperCase();
    console.log(`[DISPLAY_STATE] Creating display for symbol: ${normalizedSymbol}`);

    // CRITICAL FIX: Check for existing displays with same symbol to prevent duplicates
    let existingDisplayId = null;
    let existingDisplay = null;
    displayStateStore.update(state => {
      for (const [id, display] of state.displays) {
        if (display.symbol === normalizedSymbol) {
          existingDisplayId = id;
          existingDisplay = display;
          break;
        }
      }
      return state;
    });

    if (existingDisplayId) {
      console.warn(`[DISPLAY_STATE] Display for ${normalizedSymbol} already exists: ${existingDisplayId}`, existingDisplay);
      return existingDisplayId; // Return existing display ID instead of creating duplicate
    }

    const displayId = `display-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Default headerless size for trading displays
    const headerlessSize = size || { width: 220, height: 120 };

    // Get current runtime configuration for inheritance
    let currentRuntimeConfig;
    displayStateStore.update(state => {
      currentRuntimeConfig = state.defaultConfig || getEssentialDefaultConfig();
      return state;
    });

    const display = {
      id: displayId,
      symbol: symbol.toUpperCase(), // Normalize symbol case
      position: { ...position }, // Clone to avoid mutation
      size: { ...headerlessSize }, // Clone to avoid mutation
      isActive: false,
      zIndex: initialDisplayState.nextDisplayZIndex++,
      config: {
        ...currentRuntimeConfig,
        ...config, // Allow override via parameter
        // CRITICAL: Sync containerSize with display size for immediate canvas fill
        containerSize: { ...headerlessSize }
      },
      state: null,
      ready: false,
      createdAt: Date.now() // For debugging and cleanup
    };

    displayStateStore.update(state => {
      const newDisplays = new Map(state.displays);
      newDisplays.set(displayId, display);

      const newState = {
        ...state,
        displays: newDisplays,
        activeDisplayId: displayId
      };

      // Persist workspace state after adding display
      workspacePersistenceManager.saveCompleteWorkspace(
        newState.displays,
        new Map(), // Empty panels - handled by other stores
        new Map(), // Empty icons - handled by other stores
        state.defaultConfig
      );

      console.log(`[DISPLAY_STATE] Display created: ${displayId} for ${symbol}`);
      return newState;
    });

    return displayId;
  },

  /**
   * Remove a display from the workspace with proper cleanup
   *
   * @param {string} displayId - Display ID to remove
   * @returns {boolean} True if display was removed, false if not found
   *
   * Performance: Sub-50ms operation, ensures resource cleanup
   * Safety: Atomic state update, proper worker cleanup handled by caller
   */
  removeDisplay: (displayId) => {
    console.log(`[DISPLAY_STATE] Removing display: ${displayId}`);

    let removed = false;

    displayStateStore.update(state => {
      const display = state.displays.get(displayId);
      if (!display) {
        console.warn(`[DISPLAY_STATE] Display ${displayId} not found for removal`);
        return state;
      }

      const newDisplays = new Map(state.displays);
      newDisplays.delete(displayId);

      const newReadyDisplays = new Set(state.readyDisplays);
      newReadyDisplays.delete(displayId);

      const newState = {
        ...state,
        displays: newDisplays,
        readyDisplays: newReadyDisplays,
        activeDisplayId: state.activeDisplayId === displayId ? null : state.activeDisplayId
      };

      // Persist workspace after removing display
      workspacePersistenceManager.saveCompleteWorkspace(
        newState.displays,
        new Map(), // Empty panels
        new Map(), // Empty icons
        state.defaultConfig
      );

      removed = true;
      console.log(`[DISPLAY_STATE] Display removed: ${displayId} (${display.symbol})`);
      return newState;
    });

    return removed;
  },

  // ========================================================================
  // DISPLAY POSITIONING AND SIZING
  // ========================================================================

  /**
   * Update display position
   *
   * @param {string} displayId - Display ID to move
   * @param {Object} position - New position {x, y} in pixels
   * @returns {boolean} True if position was updated, false if display not found
   *
   * Performance: Sub-10ms operation, triggers persistence
   */
  moveDisplay: (displayId, position) => {
    let updated = false;

    displayStateStore.update(state => {
      const newDisplays = new Map(state.displays);
      const display = newDisplays.get(displayId);

      if (!display) {
        console.warn(`[DISPLAY_STATE] Display ${displayId} not found for move operation`);
        return state;
      }

      newDisplays.set(displayId, {
        ...display,
        position: { ...position } // Clone to avoid mutation
      });

      updated = true;

      // Persist workspace after moving display
      workspacePersistenceManager.saveCompleteWorkspace(
        newDisplays,
        new Map(), // Empty panels
        new Map(), // Empty icons
        state.defaultConfig
      );

      return { ...state, displays: newDisplays };
    });

    return updated;
  },

  /**
   * Update display size and synchronize configuration
   *
   * @param {string} displayId - Display ID to resize
   * @param {number} width - New width in pixels
   * @param {number} height - New height in pixels
   * @returns {boolean} True if size was updated, false if display not found
   *
   * Performance: Sub-20ms operation, triggers canvas re-render
   * Critical: Maintains containerSize synchronization for DPI-aware rendering
   */
  resizeDisplay: (displayId, width, height) => {
    console.log(`[DISPLAY_STATE] Resizing display: ${displayId} to ${width}x${height}`);

    let updated = false;

    displayStateStore.update(state => {
      const newDisplays = new Map(state.displays);
      const display = newDisplays.get(displayId);

      if (!display) {
        console.warn(`[DISPLAY_STATE] Display ${displayId} not found for resize operation`);
        return state;
      }

      const newSize = { width, height };

      // CRITICAL: Sync containerSize with actual display size for DPI-aware rendering
      newDisplays.set(displayId, {
        ...display,
        size: newSize,
        config: {
          ...display.config,
          containerSize: newSize // KEY: Sync containerSize for immediate canvas fill
        }
      });

      updated = true;

      // Log DPI-aware rendering for performance monitoring
      const dpr = window.devicePixelRatio || 1;
      console.log(`[DISPLAY_STATE] DPI-aware rendering: ${dpr}x scale for ${width}x${height}`);

      // Persist workspace after resizing display
      workspacePersistenceManager.saveCompleteWorkspace(
        newDisplays,
        new Map(), // Empty panels
        new Map(), // Empty icons
        state.defaultConfig
      );

      return { ...state, displays: newDisplays };
    });

    return updated;
  },

  // ========================================================================
  // DISPLAY FOCUS AND ACTIVITY MANAGEMENT
  // ========================================================================

  /**
   * Set a display as active (focused)
   *
   * @param {string} displayId - Display ID to activate, null to deactivate all
   * @returns {boolean} True if active display was set
   *
   * Performance: Sub-5ms operation
   * UX: Keyboard-first interaction support for rapid trading
   */
  setActiveDisplay: (displayId) => {
    console.log(`[DISPLAY_STATE] Setting active display: ${displayId || 'none'}`);

    let changed = false;

    displayStateStore.update(state => {
      if (state.activeDisplayId === displayId) {
        return state; // No change needed
      }

      changed = true;
      return {
        ...state,
        activeDisplayId: displayId
      };
    });

    return changed;
  },

  /**
   * Toggle display activation state
   *
   * @param {string} displayId - Display ID to toggle
   * @returns {boolean} New active state (true if now active)
   */
  toggleActiveDisplay: (displayId) => {
    let newState = false;

    displayStateStore.update(state => {
      const currentlyActive = state.activeDisplayId === displayId;
      newState = !currentlyActive;

      return {
        ...state,
        activeDisplayId: newState ? displayId : null
      };
    });

    return newState;
  },

  // ========================================================================
  // DISPLAY STATE UPDATES
  // ========================================================================

  /**
   * Update display state (rendering state, readiness, market data)
   *
   * @param {string} displayId - Display ID to update
   * @param {Object} newState - New state object from worker/renderer
   * @returns {boolean} True if state was updated, false if display not found
   *
   * Performance: Sub-30ms operation, critical for 60fps rendering
   * Safety: Validates state structure, maintains readiness tracking
   */
  updateDisplayState: (displayId, newState) => {
    if (!newState || typeof newState !== 'object') {
      console.warn(`[DISPLAY_STATE] Invalid state provided for display ${displayId}:`, newState);
      return false;
    }

    let updated = false;

    displayStateStore.update(state => {
      const newDisplays = new Map(state.displays);
      const display = newDisplays.get(displayId);

      if (!display) {
        console.warn(`[DISPLAY_STATE] Display ${displayId} not found for state update`);
        return state;
      }

      const wasReady = display.ready;
      const isReady = newState?.ready || false;

      const updatedDisplay = {
        ...display,
        state: newState,
        ready: isReady,
        lastUpdate: Date.now()
      };

      newDisplays.set(displayId, updatedDisplay);

      // Update readiness tracking
      const newReadyDisplays = new Set(state.readyDisplays);
      if (isReady && !wasReady) {
        newReadyDisplays.add(displayId);
        console.log(`[DISPLAY_STATE] Display ${displayId} (${display.symbol}) is now ready`);
      } else if (!isReady && wasReady) {
        newReadyDisplays.delete(displayId);
        console.log(`[DISPLAY_STATE] Display ${displayId} (${display.symbol}) is no longer ready`);
      }

      updated = true;
      return {
        ...state,
        displays: newDisplays,
        readyDisplays: newReadyDisplays
      };
    });

    return updated;
  },

  // ========================================================================
  // Z-INDEX MANAGEMENT
  // ========================================================================

  /**
   * Bring display to front of z-index stack
   *
   * @param {string} displayId - Display ID to bring to front
   * @returns {boolean} True if z-index was updated, false if display not found
   *
   * Performance: Sub-10ms operation
   * Critical: Maintains proper layering for trading workflows
   */
  bringToFront: (displayId) => {
    console.log(`[DISPLAY_STATE] Bringing display to front: ${displayId}`);

    let updated = false;

    displayStateStore.update(state => {
      const newDisplays = new Map(state.displays);
      const display = newDisplays.get(displayId);

      if (!display) {
        console.warn(`[DISPLAY_STATE] Display ${displayId} not found for bringToFront operation`);
        return state;
      }

      const newZIndex = state.nextDisplayZIndex + 1;

      newDisplays.set(displayId, {
        ...display,
        zIndex: newZIndex
      });

      updated = true;
      return {
        ...state,
        displays: newDisplays,
        nextDisplayZIndex: newZIndex
      };
    });

    return updated;
  },

  /**
   * Get the highest z-index value for proper layering
   *
   * @returns {number} Current highest z-index
   */
  getHighestZIndex: () => {
    let highestZIndex = 0;

    displayStateStore.update(state => {
      state.displays.forEach(display => {
        if (display.zIndex > highestZIndex) {
          highestZIndex = display.zIndex;
        }
      });
      return state;
    });

    return highestZIndex;
  },

  // ========================================================================
  // DISPLAY QUERIES AND UTILITIES
  // ========================================================================

  /**
   * Check if a display exists
   *
   * @param {string} displayId - Display ID to check
   * @returns {boolean} True if display exists
   */
  hasDisplay: (displayId) => {
    let exists = false;

    displayStateStore.subscribe(state => {
      exists = state.displays.has(displayId);
    })();

    return exists;
  },

  /**
   * Get display by ID
   *
   * @param {string} displayId - Display ID to retrieve
   * @returns {Object|null} Display object or null if not found
   */
  getDisplay: (displayId) => {
    let display = null;

    displayStateStore.subscribe(state => {
      display = state.displays.get(displayId) || null;
    })();

    return display;
  },

  /**
   * Get display by symbol (first match)
   *
   * @param {string} symbol - Trading symbol to find
   * @returns {Object|null} Display object or null if not found
   */
  getDisplayBySymbol: (symbol) => {
    let display = null;
    const targetSymbol = symbol.toUpperCase();

    displayStateStore.subscribe(state => {
      for (const [id, d] of state.displays) {
        if (d.symbol === targetSymbol) {
          display = d;
          break;
        }
      }
    })();

    return display;
  },

  /**
   * Get all displays for a symbol
   *
   * @param {string} symbol - Trading symbol to find
   * @returns {Array} Array of display objects
   */
  getDisplaysBySymbol: (symbol) => {
    const displays = [];
    const targetSymbol = symbol.toUpperCase();

    displayStateStore.subscribe(state => {
      for (const [id, display] of state.displays) {
        if (display.symbol === targetSymbol) {
          displays.push(display);
        }
      }
    })();

    return displays;
  },

  /**
   * Check if display is ready for rendering
   *
   * @param {string} displayId - Display ID to check
   * @returns {boolean} True if display is ready
   */
  isDisplayReady: (displayId) => {
    let isReady = false;

    displayStateStore.subscribe(state => {
      isReady = state.readyDisplays.has(displayId);
    })();

    return isReady;
  },

  // ========================================================================
  // BATCH OPERATIONS
  // ========================================================================

  /**
   * Remove all displays (with proper cleanup)
   *
   * @returns {number} Number of displays that were removed
   *
   * Performance: Sub-100ms operation regardless of display count
   * Safety: Atomic bulk operation
   */
  clearAllDisplays: () => {
    console.log(`[DISPLAY_STATE] Clearing all displays`);

    let removedCount = 0;

    displayStateStore.update(state => {
      removedCount = state.displays.size;

      // Clear persistence
      workspacePersistenceManager.saveCompleteWorkspace(
        new Map(), // Empty displays
        new Map(), // Empty panels
        new Map(), // Empty icons
        state.defaultConfig
      );

      console.log(`[DISPLAY_STATE] Cleared ${removedCount} displays`);

      return {
        ...state,
        displays: new Map(),
        readyDisplays: new Set(),
        activeDisplayId: null,
        nextDisplayZIndex: 1
      };
    });

    return removedCount;
  },

  /**
   * Update multiple displays in batch (for performance)
   *
   * @param {Array} updates - Array of {displayId, updates} objects
   * @returns {number} Number of displays that were updated
   *
   * Performance: Single state update for multiple changes
   * Use Case: Market data updates, configuration changes
   */
  batchUpdateDisplays: (updates) => {
    if (!Array.isArray(updates) || updates.length === 0) {
      return 0;
    }

    let updatedCount = 0;

    displayStateStore.update(state => {
      const newDisplays = new Map(state.displays);

      updates.forEach(({ displayId, updates: displayUpdates }) => {
        const display = newDisplays.get(displayId);
        if (display) {
          newDisplays.set(displayId, {
            ...display,
            ...displayUpdates,
            lastUpdate: Date.now()
          });
          updatedCount++;
        }
      });

      return { ...state, displays: newDisplays };
    });

    console.log(`[DISPLAY_STATE] Batch updated ${updatedCount}/${updates.length} displays`);
    return updatedCount;
  }
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get comprehensive display data for debugging
 *
 * @param {string} displayId - Display ID to analyze
 * @returns {Object} Analysis object with display data, readiness, etc.
 */
export const getDisplayAnalysis = (displayId) => {
  let analysis = {
    displayId,
    exists: false,
    display: null,
    isActive: false,
    isReady: false,
    zIndex: 0,
    symbol: null,
    hasState: false,
    lastUpdate: null
  };

  displayStateStore.subscribe(state => {
    const display = state.displays.get(displayId);
    analysis.exists = !!display;

    if (display) {
      analysis.display = display;
      analysis.isActive = state.activeDisplayId === displayId;
      analysis.isReady = state.readyDisplays.has(displayId);
      analysis.zIndex = display.zIndex;
      analysis.symbol = display.symbol;
      analysis.hasState = !!display.state;
      analysis.lastUpdate = display.lastUpdate;
    }
  })();

  return analysis;
};

/**
 * Validate display integrity for trading safety
 *
 * @param {string} displayId - Display ID to validate
 * @returns {Object} Validation result with any issues found
 */
export const validateDisplayIntegrity = (displayId) => {
  const analysis = getDisplayAnalysis(displayId);
  const issues = [];

  if (!analysis.exists) {
    issues.push('Display does not exist');
  } else {
    if (!analysis.symbol) issues.push('Missing symbol');
    if (!analysis.display.position || typeof analysis.display.position.x !== 'number') {
      issues.push('Invalid position');
    }
    if (!analysis.display.size || analysis.display.size.width <= 0 || analysis.display.size.height <= 0) {
      issues.push('Invalid size');
    }
    if (!analysis.display.config) issues.push('Missing configuration');
    if (analysis.isReady && !analysis.hasState) {
      issues.push('Display marked ready but no state available');
    }
  }

  return {
    displayId,
    isValid: issues.length === 0,
    issues,
    analysis
  };
};

// =============================================================================
// EXPORTS
// =============================================================================

export default displayStateStore;