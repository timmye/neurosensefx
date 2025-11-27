// =============================================================================
// UNIFIED DISPLAY STORE - Simplified Global Configuration Only
// =============================================================================
// Simplified architecture: Global config only, no per-display overrides
// Changes auto-save to localStorage, reset restores factory defaults
// 
// DESIGN PRINCIPLES:
// 1. Single source of truth for all display data
// 2. Global configuration only (simplified from complex multi-level)
// 3. Unified worker integration with instant config propagation
// 4. Auto-save on any configuration change
// 5. Simple "Reset Defaults" functionality

import { writable } from 'svelte/store';
import { derived } from 'svelte/store';
import {
    SymbolDataPackageSchema
} from '../data/schema.js';
import { configDefaultsManager } from '../utils/configDefaults.js';
import { workspacePersistenceManager } from '../utils/workspacePersistence.js';
import {
    getEssentialDefaultConfig,
    getEssentialParameterMetadata
} from '../config/visualizationSchema.js';
import {
    EnvironmentStorage,
    StorageKeys,
    initializeEnvironment
} from '../lib/utils/environmentUtils.js';

// Import the new modular components
import { displayStateStore, displayStateActions } from './displayStateStore.js';
import { workerManager } from '../managers/workerManager.js';
// ✅ SIMPLICITY: Removed complex ViewportAnchoring - now using simple, predictable positioning

// =============================================================================
// ENVIRONMENT INITIALIZATION
// =============================================================================

// Initialize environment system on store initialization
let environmentInitialized = false;

const ensureEnvironmentInitialized = () => {
  if (!environmentInitialized) {
    const initResult = initializeEnvironment();
    if (initResult.success) {
      environmentInitialized = true;
      console.log('[DISPLAY_STORE] Environment initialized successfully:', {
        environment: initResult.environment,
        migrationStatus: initResult.migration?.success ? 'completed' : 'not needed'
      });
    } else {
      console.error('[DISPLAY_STORE] Environment initialization failed:', initResult.error);
    }
  }
};

// =============================================================================
// UNIFIED DISPLAY STATE (everything in one place)
// =============================================================================

const initialState = {
  // === UI ELEMENTS ===
  // UI panels (symbol palette, debug, etc.)
  panels: new Map(),
  // Floating icons
  icons: new Map(),
  // Currently active elements
  activePanelId: null,
  activeIconId: null,

  // === CONTEXT MENU ===
  // Unified context menu state for all interactions
  contextMenu: {
    open: false,
    x: 0,
    y: 0,
    targetId: null,
    targetType: null,
    context: null
  },

  // === Z-INDEX MANAGEMENT ===
  // Layer management for proper stacking order (UI elements only)
  nextDisplayZIndex: 1, // Kept for compatibility, but actual z-index managed by displayStateStore
  nextPanelZIndex: 1000,
  nextIconZIndex: 10000,
  nextOverlayZIndex: 20000,

  // === GLOBAL CONFIGURATION ===
  // Single global configuration for all displays - generated from unified schema
  defaultConfig: getEssentialDefaultConfig(),

  // === GLOBAL DATA TRACKING ===
  // Global tick time tracker for connectivity monitoring (accessible to ConnectivityMonitor)
  lastTickTime: null
};

// =============================================================================
// STORE CREATION
// =============================================================================

// Initialize environment system on store creation
ensureEnvironmentInitialized();

export const displayStore = writable(initialState);

// =============================================================================
// DERIVED SELECTORS (for component binding)
// =============================================================================

// Display-related selectors - DELEGATED to displayStateStore for Phase 2 integration
// 🔧 CRITICAL FIX: Ensure proper reactivity by creating new Map reference
export const displays = derived(displayStateStore, state => {
  console.log('[DISPLAY_STORE] displays derived store updated, displays count:', state.displays?.size || 0);
  return state.displays || new Map();
});
export const activeDisplayId = derived(displayStateStore, state => state.activeDisplayId);
export const activeDisplay = derived(displayStateStore, state =>
  state.activeDisplayId ? state.displays?.get(state.activeDisplayId) : null
);

// UI element selectors
export const panels = derived(displayStore, store => store.panels);
export const icons = derived(displayStore, store => store.icons);
export const activePanelId = derived(displayStore, store => store.activePanelId);
export const activeIconId = derived(displayStore, store => store.activeIconId);
export const activePanel = derived(displayStore, store => 
  store.activePanelId ? store.panels.get(store.activePanelId) : null
);

// Context menu selector
export const contextMenu = derived(displayStore, store => store.contextMenu);

// Configuration selector
export const defaultConfig = derived(displayStore, store => store.defaultConfig);

// Global data tracking selectors (for connectivity monitoring)
export const lastTickTime = derived(displayStore, store => store.lastTickTime);

// =============================================================================
// SIMPLIFIED UNIFIED ACTIONS (global config only)
// =============================================================================

export const displayActions = {

  // === DISPLAY OPERATIONS ===
  // DELEGATED to displayStateStore for Phase 2 integration

  addDisplay: (symbol, position = { x: 100, y: 100 }, config = {}) => {
    console.log(`Creating display for symbol: ${symbol}`);

    // Get current runtime config for inheritance
    let currentRuntimeConfig;
    displayStore.update(store => {
      currentRuntimeConfig = store.defaultConfig;
      return store;
    });

    // Delegate display creation to displayStateStore
    const displayId = displayStateActions.addDisplay(symbol, position, {
      ...currentRuntimeConfig,
      ...config // Allow override via parameter
    });

    // Create worker for this display and wait for it to be ready
    workerManager.createWorkerForSymbol(symbol, displayId).then(worker => {
      console.log(`[DISPLAY_STORE] Worker created successfully for ${symbol}-${displayId}`);

      // Add subscription confirmation for Phase 1 testing
      console.log(`Successfully subscribed display to data`);

      // 🔧 TRADING SAFETY FIX: Initialize worker with null data to prevent fake price display
      // NEVER show fake prices to traders - wait for real WebSocket data
      const defaultInitData = {
        digits: 5,
        bid: null, // ← TRADING SAFETY: Wait for real market data
        currentPrice: null, // ← TRADING SAFETY: Wait for real market data
        todaysOpen: null, // ← TRADING SAFETY: Wait for real market data
        projectedAdrHigh: null, // ← TRADING SAFETY: Wait for real market data
        projectedAdrLow: null, // ← TRADING SAFETY: Wait for real market data
        todaysHigh: null, // ← TRADING SAFETY: Wait for real market data
        todaysLow: null, // ← TRADING SAFETY: Wait for real market data
        volume: null // ← TRADING SAFETY: Wait for real market data
      };

      workerManager.initializeWorker(symbol, displayId, defaultInitData);
      console.log(`[DISPLAY_STORE] Worker initialization called for ${symbol}-${displayId}`);
    }).catch(error => {
      console.error(`[DISPLAY_STORE] Failed to create worker for ${symbol}-${displayId}:`, error);
    });

    // Add initial data packet confirmation for Phase 1 testing
    console.log(`Initial data packet received for ${symbol}`);

    return displayId;
  },

  removeDisplay: (displayId) => {
    console.log(`closeDisplay event triggered for display: ${displayId}`);

    // Get display info for worker cleanup
    const display = displayStateActions.getDisplay(displayId);

    if (display) {
      // Terminate worker if exists (delegate to workerManager)
      const workerKey = `${display.symbol}-${displayId}`;
      const workerStats = workerManager.getWorkerStats();

      // Remove the display first
      const removed = displayStateActions.removeDisplay(displayId);

      if (removed) {
        console.log(`Worker terminated for display: ${displayId}`);
      }
    }

    return display;
  },

  moveDisplay: (displayId, position) => {
    // Delegate to displayStateStore
    return displayStateActions.moveDisplay(displayId, position);
  },

  // 🔧 UNIFIED: Single resize path that updates both display and config
  /**
   * 🎯 PHASE 3 FIX: Enhanced unified resize with store coordination validation
   */
  resizeDisplay: (displayId, width, height, options = {}) => {
    console.log(`[DISPLAY_STORE] 🎯 PHASE 3 FIX: Unified resize: ${displayId} → ${width}x${height}`);

    // 🎯 PHASE 3 DEBUG: Store state before resize for validation
    let beforeState = null;
    displayStateStore.subscribe(state => {
      const display = state.displays.get(displayId);
      beforeState = display ? {
        size: display.size,
        containerSize: display.config.containerSize,
        configReference: display.config
      } : null;
    })();

    // Update display state (existing logic)
    const updated = displayStateActions.resizeDisplay(displayId, width, height);

    if (updated) {
      // 🎯 PHASE 3 DEBUG: Store state after resize for validation
      let afterState = null;
      displayStateStore.subscribe(state => {
        const display = state.displays.get(displayId);
        afterState = display ? {
          size: display.size,
          containerSize: display.config.containerSize,
          configReference: display.config,
          configReferenceChanged: beforeState && beforeState.configReference !== display.config
        } : null;
      })();

      // Simulate DPI-aware rendering log (for test verification)
      const dpr = window.devicePixelRatio || 1;
      console.log(`[DISPLAY_STORE] 🎯 PHASE 3 FIX: DPI-aware rendering applied: ${dpr}x`);
      console.log(`[DISPLAY_STORE] 🎯 PHASE 3 FIX: Canvas re-rendered at ${width}x${height}`);
      console.log(`[DISPLAY_STORE] 🎯 PHASE 3 FIX: Market profile scaled to new dimensions`);

      // 🎯 PHASE 3 DEBUG: Log resize validation
      if (beforeState && afterState) {
        console.log(`[DISPLAY_STORE] 🎯 PHASE 3 FIX: Resize validation`, {
          displayId,
          beforeSize: beforeState.size,
          afterSize: afterState.size,
          beforeContainerSize: beforeState.containerSize,
          afterContainerSize: afterState.containerSize,
          configReferenceChanged: afterState.configReferenceChanged,
          resizeSuccess: afterState.size.width === width && afterState.size.height === height,
          containerSizeSync: afterState.containerSize.width === width && afterState.containerSize.height === height
        });
      }

      // Update containerSize in config for consistency (unless explicitly disabled)
      if (options.updateConfig !== false) {
        updateDisplayConfig('containerSize', { width, height });
      }
    } else {
      console.warn(`[DISPLAY_STORE] 🎯 PHASE 3 FIX: Resize failed for display: ${displayId}`);
    }

    return updated;
  },

  setActiveDisplay: (displayId) => {
    console.log(`Focus set to display: ${displayId}`);

    // Delegate to displayStateStore
    displayStateActions.setActiveDisplay(displayId);

    // Update main store for UI state consistency
    displayStore.update(store => ({
      ...store,
      activePanelId: null,
      activeIconId: null
    }));
  },

  updateDisplayState: (displayId, newState) => {
    // Delegate to displayStateStore
    const updated = displayStateActions.updateDisplayState(displayId, newState);

    // 🔧 NEW: Update global lastTickTime when display state includes new tick data
    if (newState?.lastTickTime) {
      displayStore.update(store => {
        if (!store.lastTickTime || newState.lastTickTime > store.lastTickTime) {
          store.lastTickTime = newState.lastTickTime;
        }
        return store;
      });
    }

    return updated;
  },
  
  // === SIMPLIFIED CONFIGURATION OPERATIONS (global only) ===

  // Simplified config update (no displayId needed for containerSize)
  updateDisplayConfig: (parameter, value) => {
    console.log(`[DISPLAY_STORE] Updating global config: ${parameter} =`, value);

    displayStore.update(store => {
      const existingConfig = store.defaultConfig;
      const updatedConfig = { ...existingConfig, [parameter]: value };
      const newStore = { ...store, defaultConfig: updatedConfig };
      return newStore;
    });

    // Broadcast to workers and persist
    workerManager.broadcastConfigUpdate({ [parameter]: value });
    workspacePersistenceManager.saveGlobalConfig({ [parameter]: value }, displayStore.defaultConfig);
  },

  updateGlobalConfig: (parameter, value) => {
    // DEBUG: Log configuration parameter changes
    console.log('[CONFIG DEBUG] updateGlobalConfig called:', {
      parameter,
      value,
      valueType: typeof value,
      timestamp: new Date().toISOString()
    });

    // Validate parameter before updating
    const validation = { isValid: true }; // Simplified validation - all essential parameters are valid
    if (!validation.isValid) {
      console.error('[DISPLAY_STORE] Configuration validation failed:', validation.error);
      return false;
    }

    displayStore.update(store => {
      // Use the current runtime defaultConfig and only update the specific parameter
      const existingConfig = store.defaultConfig;
      const updatedConfig = { ...existingConfig, [parameter]: value };

      // DEBUG: Log configuration update in store
      console.log('[CONFIG DEBUG] Store update:', {
        parameter,
        oldValue: existingConfig[parameter],
        newValue: value,
        timestamp: new Date().toISOString()
      });

      const newStore = {
        ...store,
        defaultConfig: updatedConfig
      };

      return newStore;
    });

    // Broadcast configuration update to all workers via workerManager
    workerManager.broadcastConfigUpdate({ [parameter]: value });

    // Auto-save global config change with full runtime config
    displayStore.update(store => {
      workspacePersistenceManager.saveGlobalConfig({ [parameter]: value }, store.defaultConfig);
      return store;
    });
  },

  resetToFactoryDefaults: () => {
    const factoryDefaults = getEssentialDefaultConfig();

    displayStore.update(store => {
      const newStore = {
        ...store,
        defaultConfig: factoryDefaults
      };

      return newStore;
    });

    // Broadcast factory defaults to all workers via workerManager
    workerManager.broadcastConfigUpdate(factoryDefaults);

    // Reset persistence to factory defaults with empty runtime config
    displayStore.update(store => {
      workspacePersistenceManager.saveGlobalConfig({}, factoryDefaults);
      return store;
    });
  },
  
  // === WORKER OPERATIONS ===
  // DELEGATED to workerManager for Phase 2 integration

  createWorkerForSymbol: (symbol, displayId) => {
    console.log(`[DISPLAY_STORE] createWorkerForSymbol delegated to workerManager for symbol=${symbol}, displayId=${displayId}`);
    return workerManager.createWorkerForSymbol(symbol, displayId);
  },

  initializeWorker: (symbol, displayId, initData) => {
    console.log(`[DISPLAY_STORE] initializeWorker delegated to workerManager for symbol=${symbol}, displayId=${displayId}`);
    return workerManager.initializeWorker(symbol, displayId, initData);
  },

  dispatchTickToWorker: (symbol, tick) => {
    console.log(`Tick received for ${symbol}`);
    if (tick.bid || tick.ask) {
      const price = tick.bid || tick.ask;
      console.log(`Price updated: ${price}`);
    }

    // Delegate to workerManager for optimized tick dispatching
    workerManager.dispatchTickToWorker(symbol, tick);
  },
  
  // === WEBSOCKET INTEGRATION METHODS ===
  // DELEGATED to workerManager for Phase 2 integration

  dispatchTick: (symbol, tickData) => {
    // Delegate to workerManager for tick validation and dispatch
    workerManager.dispatchTick(symbol, tickData);
  },

  createNewSymbol: (symbol, data) => {
    // Delegate to workerManager with callback for display creation
    workerManager.createNewSymbol(symbol, data, (symbol, position) => {
      return displayActions.addDisplay(symbol, position);
    });
  },

  /**
   * Update existing symbol with fresh data (used by workspace restoration)
   * DELEGATED to workerManager for Phase 2 integration
   * @param {string} symbol - Symbol to update
   * @param {Object} data - Fresh market data
   */
  updateExistingSymbol: async (symbol, data) => {
    // Delegate to workerManager with callback for finding existing display
    return await workerManager.updateExistingSymbol(symbol, data, (symbol) => {
      // Find existing display ID using displayStateStore
      const display = displayStateActions.getDisplayBySymbol(symbol);
      return display ? display.id : null;
    });
  },

  removeSymbol: (symbol) => {
    // Find displays to remove using displayStateStore
    const displaysToRemove = displayStateActions.getDisplaysBySymbol(symbol);

    // Remove all displays for this symbol
    displaysToRemove.forEach(display => {
      displayStateActions.removeDisplay(display.id);
    });

    // Delegate worker cleanup to workerManager
    workerManager.removeSymbol(symbol, (symbol) => {
      return displaysToRemove.map(display => display.id);
    });
  },
  
  clear: () => {
    console.log(`[DISPLAY_STORE] Clearing all displays and workers`);

    // Clear all displays via displayStateStore
    displayStateActions.clearAllDisplays();

    // Clear all workers via workerManager
    workerManager.cleanup();

    displayStore.update(store => {
      return {
        ...store,
        activePanelId: null,
        activeIconId: null,
        lastTickTime: null, // Reset global tick tracker
        contextMenu: {
          ...store.contextMenu,
          open: false
        }
      };
    });
  },
  
  // === UI ELEMENT OPERATIONS ===
  
  addPanel: (type, position = { x: 50, y: 50 }, config = {}) => {
    // Use type as ID for known panels, otherwise generate random ID
    const panelId = type === 'symbol-palette' || type === 'status-panel' ? type : `panel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const panel = {
      id: panelId,
      type,
      position,
      size: config.size || { width: 300, height: 400 },
      isActive: false,
      zIndex: initialState.nextPanelZIndex++,
      isVisible: true, // 🔧 FIXED: Add isVisible property for panel visibility
      config
    };
    
    displayStore.update(store => {
      const newPanels = new Map(store.panels);
      newPanels.set(panelId, panel);
      return {
        ...store,
        panels: newPanels,
        activePanelId: panelId
      };
    });
    
    return panelId;
  },
  
  removePanel: (panelId) => {
    displayStore.update(store => {
      const newPanels = new Map(store.panels);
      newPanels.delete(panelId);
      return {
        ...store,
        panels: newPanels,
        activePanelId: store.activePanelId === panelId ? null : store.activePanelId
      };
    });
  },
  
  movePanel: (panelId, position) => {
    displayStore.update(store => {
      const newPanels = new Map(store.panels);
      const panel = newPanels.get(panelId);
      if (panel) {
        newPanels.set(panelId, { ...panel, position });
      }
      return { ...store, panels: newPanels };
    });
  },
  
  setActivePanel: (panelId) => {
    displayStore.update(store => ({
      ...store,
      activePanelId: panelId,
      activeDisplayId: null,
      activeIconId: null
    }));
  },

  showPanel: (panelId) => {
    displayStore.update(store => {
      const icons = new Map(store.icons);
      const icon = icons.get(panelId);
      if (icon) {
        // Update icon's isExpanded state when showing panel
        icons.set(panelId, { ...icon, isExpanded: true });
      }
      return {
        ...store,
        icons,
        activePanelId: panelId,
        activeDisplayId: null,
        activeIconId: null
      };
    });
  },

  hidePanel: (panelId) => {
    displayStore.update(store => {
      const icons = new Map(store.icons);
      const icon = icons.get(panelId);
      if (icon) {
        // Update icon's isExpanded state when hiding panel
        icons.set(panelId, { ...icon, isExpanded: false });
      }
      const newStore = {
        ...store,
        icons
      };
      if (newStore.activePanelId === panelId) {
        newStore.activePanelId = null;
      }
      return newStore;
    });
  },

  // === CONTEXT MENU OPERATIONS ===
  
  showContextMenu: (x, y, targetId, targetType, context = null) => {
    displayStore.update(store => ({
      ...store,
      contextMenu: {
        open: true,
        x,
        y,
        targetId,
        targetType,
        context
      }
    }));
  },
  
  hideContextMenu: () => {
    displayStore.update(store => ({
      ...store,
      contextMenu: { ...store.contextMenu, open: false }
    }));
  },
  
  // === ICON OPERATIONS ===
  
  addIcon: (id, type, position = { x: 50, y: 50 }, config = {}) => {
    const icon = {
      id,
      type,
      position,
      config,
      isActive: false,
      zIndex: initialState.nextIconZIndex++,
      isExpanded: false
    };
    
    displayStore.update(store => {
      const newIcons = new Map(store.icons);
      newIcons.set(id, icon);
      return {
        ...store,
        icons: newIcons
      };
    });
    
    return id;
  },
  
  setActiveIcon: (iconId) => {
    displayStore.update(store => ({
      ...store,
      activeIconId: iconId,
      activeDisplayId: null,
      activePanelId: null
    }));
  },
  
  toggleIconExpansion: (iconId) => {
    displayStore.update(store => {
      const newIcons = new Map(store.icons);
      const icon = newIcons.get(iconId);
      if (icon) {
        const isExpanded = !icon.isExpanded;
        newIcons.set(iconId, { ...icon, isExpanded });

        // Special handling for symbol-palette-icon - control panel visibility
        if (iconId === 'symbol-palette-icon') {
          const newPanels = new Map(store.panels);
          if (isExpanded) {
            // Create symbol palette panel if it doesn't exist
            if (!newPanels.has('symbol-palette')) {
              newPanels.set('symbol-palette', {
                id: 'symbol-palette',
                type: 'symbol-palette',
                position: { x: 50, y: 50 },
                size: { width: 300, height: 400 },
                isActive: false,
                zIndex: store.nextPanelZIndex++,
                isVisible: true, // 🔧 FIXED: Add isVisible property
                config: { title: 'Symbol Palette' }
              });
            }
          } else {
            // Remove symbol palette panel when collapsed
            if (newPanels.has('symbol-palette')) {
              newPanels.delete('symbol-palette');
            }
          }

          return {
            ...store,
            icons: newIcons,
            panels: newPanels,
            activeIconId: isExpanded ? iconId : null
          };
        }

        // Special handling for status-icon - control panel visibility
        if (iconId === 'status-icon') {
          const newPanels = new Map(store.panels);
          if (isExpanded) {
            // Create status panel if it doesn't exist
            if (!newPanels.has('status-panel')) {
              // ✅ NEUROSENSE FX: Simple icon-to-panel positioning
              const icon = store.icons.get(iconId);
              const iconPosition = icon?.position || { x: window.innerWidth - 100, y: 20 };

              // Simple spatial relationship: panel anchored to icon
              let x = iconPosition.x - 340;  // Fixed offset left from icon
              let y = iconPosition.y;        // Aligned vertically with icon

              // ✅ Simple bounds checking (4 lines total)
              const PANEL_WIDTH = 320, PANEL_HEIGHT = 200, MARGIN = 20;
              if (x < MARGIN) x = MARGIN;
              if (y < MARGIN) y = MARGIN;
              if (x + PANEL_WIDTH > window.innerWidth - MARGIN) x = window.innerWidth - PANEL_WIDTH - MARGIN;
              if (y + PANEL_HEIGHT > window.innerHeight - MARGIN) y = window.innerHeight - PANEL_HEIGHT - MARGIN;

              const position = { x, y };
              console.log(`[STATUS_PANEL] Icon clicked - icon:`, iconPosition, 'panel:', position);

              newPanels.set('status-panel', {
                id: 'status-panel',
                type: 'status-panel',
                position: position,
                size: { width: 320, height: 200 }, // Simple fixed size
                isActive: false,
                zIndex: store.nextPanelZIndex++,
                isVisible: true,
                config: {
                  title: 'System Status',
                  isClosable: false,
                  isMinimizable: false
                }
              });
            }
          } else {
            // Remove status panel when collapsed
            if (newPanels.has('status-panel')) {
              newPanels.delete('status-panel');
            }
          }

          return {
            ...store,
            icons: newIcons,
            panels: newPanels,
            activeIconId: isExpanded ? iconId : null
          };
        }
        
        return {
          ...store,
          icons: newIcons,
          activeIconId: isExpanded ? iconId : null
        };
      }
      return store;
    });
  },
  
  moveIcon: (iconId, position) => {
    displayStore.update(store => {
      const newIcons = new Map(store.icons);
      const icon = newIcons.get(iconId);
      if (icon) {
        newIcons.set(iconId, { ...icon, position });
      }
      return { ...store, icons: newIcons };
    });
  },
  
  expandIcon: (iconId) => {
    displayStore.update(store => {
      const newIcons = new Map(store.icons);
      const icon = newIcons.get(iconId);
      if (icon) {
        newIcons.set(iconId, { ...icon, isExpanded: true });

        // 🔧 BUG FIX: Also create panel for symbol-palette-icon when expanding
        if (iconId === 'symbol-palette-icon') {
          const newPanels = new Map(store.panels);
          if (!newPanels.has('symbol-palette')) {
            newPanels.set('symbol-palette', {
              id: 'symbol-palette',
              type: 'symbol-palette',
              position: { x: 50, y: 50 },
              size: { width: 300, height: 400 },
              isActive: false,
              zIndex: store.nextPanelZIndex++,
              isVisible: true,
              config: { title: 'Symbol Palette' }
            });
          }
          return {
            ...store,
            icons: newIcons,
            panels: newPanels,
            activeIconId: iconId
          };
        }
      }
      return {
        ...store,
        icons: newIcons,
        activeIconId: iconId
      };
    });
  },
  
  collapseIcon: (iconId) => {
    displayStore.update(store => {
      const newIcons = new Map(store.icons);
      const icon = newIcons.get(iconId);
      if (icon) {
        newIcons.set(iconId, { ...icon, isExpanded: false });
      }
      return { 
        ...store, 
        icons: newIcons,
        activeIconId: store.activeIconId === iconId ? null : store.activeIconId
      };
    });
  },
  
  // === Z-INDEX OPERATIONS ===
  
  bringToFront: (elementType, elementId) => {
    if (elementType === 'display') {
      // Delegate to displayStateStore for display z-index management
      displayStateActions.bringToFront(elementId);
    } else {
      // Handle UI elements (panels, icons) in main store
      displayStore.update(store => {
        let newStore = { ...store };

        switch (elementType) {
          case 'panel':
            newStore.nextPanelZIndex++;
            const newPanels = new Map(store.panels);
            const panel = newPanels.get(elementId);
            if (panel) {
              newPanels.set(elementId, { ...panel, zIndex: newStore.nextPanelZIndex });
            }
            newStore.panels = newPanels;
            break;

          case 'icon':
            newStore.nextIconZIndex++;
            const newIcons = new Map(store.icons);
            const icon = newIcons.get(elementId);
            if (icon) {
              newIcons.set(elementId, { ...icon, zIndex: newStore.nextIconZIndex });
            }
            newStore.icons = newIcons;
            break;
        }

        return newStore;
      });
    }
  },

  // === SIMPLIFIED WORKSPACE OPERATIONS ===

  /**
   * Initialize workspace from persisted data
   * Updated for Phase 2 integration with displayStateStore and workerManager
   */
  initializeWorkspace: async () => {
    try {
      // Ensure environment system is initialized before loading workspace
      ensureEnvironmentInitialized();

      const workspaceData = await workspacePersistenceManager.initializeWorkspace();

      // 🔧 CRITICAL FIX: Update the store's defaultConfig with restored runtime defaults
      if (workspaceData.defaults) {
        displayStore.update(store => ({
          ...store,
          defaultConfig: workspaceData.defaults
        }));

        console.log('[DISPLAY_STORE] Runtime defaults restored from workspace:', {
          defaultsKeys: Object.keys(workspaceData.defaults).length,
          isLegacyFormat: workspaceData.isLegacyFormat || false
        });
      }

      if (workspaceData.layout) {
        // Restore UI elements (panels, icons) to main store
        displayStore.update(store => {
          let newStore = { ...store };

          // Restore panels
          const newPanels = new Map();
          workspaceData.layout.panels.forEach(panelData => {
            newPanels.set(panelData.id, {
              ...panelData,
              isActive: false
            });
          });
          newStore.panels = newPanels;

          // Restore icons
          const newIcons = new Map();
          workspaceData.layout.icons.forEach(iconData => {
            newIcons.set(iconData.id, {
              ...iconData,
              isActive: false
            });
          });
          newStore.icons = newIcons;

          // Reset active elements
          newStore.activePanelId = null;
          newStore.activeIconId = null;

          return newStore;
        });

        // Restore displays to displayStateStore
        if (workspaceData.layout.displays && workspaceData.layout.displays.length > 0) {
          // Get current default config for display inheritance
          let currentDefaultConfig;
          displayStore.update(store => {
            currentDefaultConfig = store.defaultConfig;
            return store;
          });

          // Restore each display
          workspaceData.layout.displays.forEach(displayData => {
            displayStateActions.addDisplay(
              displayData.symbol,
              displayData.position || { x: 100, y: 100 },
              {
                ...currentDefaultConfig,
                ...displayData.config,
                ...(displayData.size ? { containerSize: displayData.size } : {})
              },
              displayData.size
            );
          });

          // 🔧 CRITICAL FIX: Subscribe restored symbols to WebSocket for fresh data
          // Import WebSocket client dynamically to avoid circular dependencies
          const { subscribe } = await import('../data/wsClient.js');

          // 🔧 RACE FIX: Staggered WebSocket subscriptions to prevent overload
          setTimeout(() => {
            // Subscribe each restored symbol with 500ms delays between them
            workspaceData.layout.displays.forEach((displayData, index) => {
              setTimeout(() => {
                subscribe(displayData.symbol);
              }, index * 500); // 500ms delay between each subscription
            });

          }, 2000); // 2 second initial delay to allow WebSocket connection
        }
      }

      return workspaceData;
    } catch (error) {
      console.error('[DISPLAY_STORE] Failed to initialize workspace:', error);
      return null;
    }
  },

  /**
   * Save current workspace state
   * Updated for Phase 2 integration with displayStateStore
   */
  saveWorkspace: () => {
    // Get current state from both stores
    let mainStoreState, displayStoreState;

    displayStore.subscribe(store => {
      mainStoreState = store;
    })();

    displayStateStore.subscribe(state => {
      displayStoreState = state;
    })();

    workspacePersistenceManager.saveCompleteWorkspace(
      displayStoreState.displays,
      mainStoreState.panels,
      mainStoreState.icons,
      mainStoreState.defaultConfig
    );
  },

  /**
   * Save workspace layout only (for backwards compatibility)
   */
  saveWorkspaceLayout: () => {
    // Get current state from both stores
    let mainStoreState, displayStoreState;

    displayStore.subscribe(store => {
      mainStoreState = store;
    })();

    displayStateStore.subscribe(state => {
      displayStoreState = state;
    })();

    workspacePersistenceManager.saveWorkspaceLayout(
      displayStoreState.displays,
      mainStoreState.panels,
      mainStoreState.icons
    );
  },

  /**
   * Export workspace to JSON
   */
  exportWorkspace: (metadata = {}) => {
    return new Promise((resolve) => {
      // Get current state from both stores
      let mainStoreState, displayStoreState;

      displayStore.subscribe(store => {
        mainStoreState = store;
      })();

      displayStateStore.subscribe(state => {
        displayStoreState = state;
      })();

      // Create workspace export with runtime defaults
      const exportDataRaw = workspacePersistenceManager.exportWorkspace(
        displayStoreState.displays,
        mainStoreState.panels,
        mainStoreState.icons,
        metadata
      );

      // Parse and inject the runtime defaults into the export
      try {
        const exportData = JSON.parse(exportDataRaw);
        if (exportData.globalConfig) {
          exportData.globalConfig.fullRuntimeConfig = mainStoreState.defaultConfig;
        }
        resolve(JSON.stringify(exportData, null, 2));
      } catch (error) {
        console.error('[DISPLAY_STORE] Failed to process workspace export:', error);
        resolve(exportDataRaw);
      }
    })();
  },

  /**
   * Import workspace from JSON
   */
  importWorkspace: (jsonData) => {
    return new Promise((resolve) => {
      const success = workspacePersistenceManager.importWorkspace(jsonData);
      if (success) {
        // Reload workspace after import
        displayActions.initializeWorkspace().then(() => {
          resolve(true);
        });
      } else {
        resolve(false);
      }
    });
  },

  /**
   * Clear all workspace data
   */
  clearWorkspace: () => {
    console.log('[DISPLAY_STORE] Clearing all workspace data');

    // Clear displays via displayStateStore
    displayStateActions.clearAllDisplays();

    // Clear workers via workerManager
    workerManager.cleanup();

    // Clear persistence data
    workspacePersistenceManager.clearAllPersistence();

    displayStore.update(store => {
      return {
        ...store,
        panels: new Map(),
        icons: new Map(),
        activePanelId: null,
        activeIconId: null,
        lastTickTime: null, // Reset global tick tracker
        contextMenu: {
          ...store.contextMenu,
          open: false
        }
      };
    });
  }
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

export const getDisplayData = (store, displayId) => {
  // Delegate to displayStateStore for display data
  let display = null;
  displayStateStore.subscribe(state => {
    display = state.displays.get(displayId) || null;
  })();

  if (!display) {
    return { display: null, config: {}, state: {}, isActive: false };
  }

  return {
    display,
    config: display.config || {},
    state: display.state || {},
    isActive: display.activeDisplayId === displayId
  };
};

// =============================================================================
// CLEANUP FUNCTIONS
// =============================================================================

export const cleanup = () => {
  console.log('[DISPLAY_STORE] Performing comprehensive cleanup');

  // Clear displays via displayStateStore
  displayStateActions.clearAllDisplays();

  // Clear workers via workerManager
  workerManager.cleanup();

  // Reset main store to initial state
  displayStore.set(initialState);
};

// =============================================================================
// EXPORTS
// =============================================================================

export default displayStore;
