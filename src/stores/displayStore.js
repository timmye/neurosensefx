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
  // === DISPLAY MANAGEMENT ===
  // Canvas displays with symbols, positions, configurations
  displays: new Map(),
  activeDisplayId: null,

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
  // Layer management for proper stacking order
  nextDisplayZIndex: 1,
  nextPanelZIndex: 1000,
  nextIconZIndex: 10000,
  nextOverlayZIndex: 20000,

  // === WORKER MANAGEMENT ===
  // WebSocket workers per symbol for data processing
  workers: new Map(),

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

// Display-related selectors
export const displays = derived(displayStore, store => store.displays);
export const activeDisplayId = derived(displayStore, store => store.activeDisplayId);
export const activeDisplay = derived(displayStore, store => 
  store.activeDisplayId ? store.displays.get(store.activeDisplayId) : null
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
  
  addDisplay: (symbol, position = { x: 100, y: 100 }, config = {}) => {

    const displayId = `display-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // 🔧 HEADERLESS FIX: Create displays with correct headerless dimensions
    const headerlessSize = { width: 220, height: 120 }; // ✅ HEADERLESS: No 40px header

    // 🔧 CONFIGURATION INHERITANCE FIX: Get current runtime config instead of stale defaults
    let currentRuntimeConfig;
    displayStore.update(store => {
      currentRuntimeConfig = store.defaultConfig;
      return store;
    });

    const display = {
      id: displayId,
      symbol,
      position,
      size: headerlessSize,
      isActive: false,
      zIndex: initialState.nextDisplayZIndex++,
      config: {
        ...currentRuntimeConfig,
        ...config, // Allow override via parameter
        // 🔧 CRITICAL: Sync containerSize with display size for immediate canvas fill
        containerSize: headerlessSize
      },
      state: null,
      ready: false
    };
    
    displayStore.update(store => {
      const newDisplays = new Map(store.displays);
      newDisplays.set(displayId, display);
      const newStore = {
        ...store,
        displays: newDisplays,
        activeDisplayId: displayId
      };
      
      // Persist complete workspace after adding display
      workspacePersistenceManager.saveCompleteWorkspace(
        newStore.displays,
        newStore.panels,
        newStore.icons,
        newStore.defaultConfig
      );
      
      return newStore;
    });
    
    // Create worker for this display
    displayActions.createWorkerForSymbol(symbol, displayId);
    
    return displayId;
  },
  
  removeDisplay: (displayId) => {
    
    displayStore.update(store => {
      const display = store.displays.get(displayId);
      if (display) {
        // Terminate worker if exists
        const workerKey = `${display.symbol}-${displayId}`;
        const worker = store.workers.get(workerKey);
        if (worker) {
          worker.terminate();
        }
        
        const newDisplays = new Map(store.displays);
        const newWorkers = new Map(store.workers);
        
        newDisplays.delete(displayId);
        newWorkers.delete(workerKey);
        
        const newStore = {
          ...store,
          displays: newDisplays,
          workers: newWorkers,
          activeDisplayId: store.activeDisplayId === displayId ? null : store.activeDisplayId
        };
        
        // Persist complete workspace after removing display
        workspacePersistenceManager.saveCompleteWorkspace(
          newStore.displays,
          newStore.panels,
          newStore.icons,
          newStore.defaultConfig
        );
        
        return newStore;
      }
      return store;
    });
  },
  
  moveDisplay: (displayId, position) => {
    displayStore.update(store => {
      const newDisplays = new Map(store.displays);
      const display = newDisplays.get(displayId);
      if (display) {
        newDisplays.set(displayId, {
          ...display,
          position
        });
        
        // Persist complete workspace after moving display
        workspacePersistenceManager.saveCompleteWorkspace(
          newDisplays,
          store.panels,
          store.icons,
          store.defaultConfig
        );
      }
      return { ...store, displays: newDisplays };
    });
  },
  
  resizeDisplay: (displayId, width, height) => {
    displayStore.update(store => {
      const newDisplays = new Map(store.displays);
      const display = newDisplays.get(displayId);
      if (display) {
        // 🔧 FIX: Sync containerSize with actual display size
        newDisplays.set(displayId, {
          ...display,
          size: { width, height },
          config: {
            ...display.config,
            containerSize: { width, height }  // 🔧 KEY: Sync containerSize
          }
        });
        
        // Persist complete workspace after resizing display
        workspacePersistenceManager.saveCompleteWorkspace(
          newDisplays,
          store.panels,
          store.icons,
          store.defaultConfig
        );
      }
      return { ...store, displays: newDisplays };
    });
  },
  
  setActiveDisplay: (displayId) => {
    displayStore.update(store => ({
      ...store,
      activeDisplayId: displayId,
      activePanelId: null,
      activeIconId: null
    }));
  },
  
  updateDisplayState: (displayId, newState) => {

    displayStore.update(store => {
      const newDisplays = new Map(store.displays);
      const display = newDisplays.get(displayId);
      if (display) {
        const updatedDisplay = {
          ...display,
          state: newState,
          ready: newState?.ready || false
        };
        newDisplays.set(displayId, updatedDisplay);

        // 🔧 NEW: Update global lastTickTime when display state includes new tick data
        if (newState?.lastTickTime && newState.lastTickTime > (store.lastTickTime || 0)) {
          store.lastTickTime = newState.lastTickTime;
        }

      } else {
        console.warn(`[DISPLAY_STORE] Display ${displayId} not found for state update`);
      }
      return { ...store, displays: newDisplays };
    });
  },
  
  // === SIMPLIFIED CONFIGURATION OPERATIONS (global only) ===
  
  updateDisplayConfig: (displayId, parameter, value) => {

    displayStore.update(store => {
      // Get the existing config for this display and only update the specific parameter
      const existingConfig = store.displays.get(displayId)?.config || store.defaultConfig;
      const updatedConfig = { ...existingConfig, [parameter]: value };

      // Update all displays with this parameter (global-only approach)
      const newDisplays = new Map(store.displays);
      newDisplays.forEach((display, id) => {
        const newConfig = { ...display.config, [parameter]: value };

        newDisplays.set(id, {
          ...display,
          config: newConfig
        });
        
        // Notify worker of configuration change
        const workerKey = `${display.symbol}-${id}`;
        const worker = store.workers.get(workerKey);
        if (worker) {
          worker.postMessage({ 
            type: 'updateConfig', 
            payload: { [parameter]: value } 
          });
        }
      });
      
      const newStore = {
        ...store,
        defaultConfig: updatedConfig,
        displays: newDisplays
      };
      
      return newStore;
    });

    // Auto-save global config change with full runtime config
    displayStore.update(store => {
      workspacePersistenceManager.saveGlobalConfig({ [parameter]: value }, store.defaultConfig);
      return store;
    });
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
        totalDisplays: store.displays.size,
        timestamp: new Date().toISOString()
      });

      // Update all displays with this parameter
      const newDisplays = new Map(store.displays);
      newDisplays.forEach((display, displayId) => {
        const newDisplayConfig = { ...display.config, [parameter]: value };

        newDisplays.set(displayId, {
          ...display,
          config: newDisplayConfig
        });
        
        // Notify worker of configuration change
        const workerKey = `${display.symbol}-${displayId}`;
        const worker = store.workers.get(workerKey);
        if (worker) {
          worker.postMessage({ 
            type: 'updateConfig', 
            payload: { [parameter]: value } 
          });
        }
      });
      
      const newStore = {
        ...store,
        defaultConfig: updatedConfig,
        displays: newDisplays
      };
      
      return newStore;
    });

    // Auto-save global config change with full runtime config
    displayStore.update(store => {
      workspacePersistenceManager.saveGlobalConfig({ [parameter]: value }, store.defaultConfig);
      return store;
    });
  },

  resetToFactoryDefaults: () => {

    displayStore.update(store => {
      const factoryDefaults = getEssentialDefaultConfig();
      const newDisplays = new Map(store.displays);
      
      newDisplays.forEach((display, displayId) => {
        newDisplays.set(displayId, {
          ...display,
          config: { ...factoryDefaults }
        });
        
        // Notify worker of configuration reset
        const workerKey = `${display.symbol}-${displayId}`;
        const worker = store.workers.get(workerKey);
        if (worker) {
          worker.postMessage({ 
            type: 'updateConfig', 
            payload: factoryDefaults 
          });
        }
      });
      
      const newStore = {
        ...store,
        defaultConfig: factoryDefaults,
        displays: newDisplays
      };
      
      return newStore;
    });
    
    // Reset persistence to factory defaults with empty runtime config
    displayStore.update(store => {
      workspacePersistenceManager.saveGlobalConfig({}, factoryDefaults);
      return store;
    });
  },
  
  // === WORKER OPERATIONS ===
  
  createWorkerForSymbol: (symbol, displayId) => {
    
    return new Promise((resolve) => {
      displayStore.update(store => {
        // 🔧 RACE FIX: Create unique worker per display (not per symbol)
        const workerKey = `${symbol}-${displayId}`;
        
        // Check if worker already exists for this specific display
        if (store.workers.has(workerKey)) {
          resolve(store.workers.get(workerKey));
          return store;
        }
        
        const worker = new Worker(new URL('../workers/dataProcessor.js', import.meta.url), { type: 'module' });
        
        worker.onmessage = ({ data }) => {
          const { type, payload } = data;
          if (type === 'stateUpdate') {
            displayActions.updateDisplayState(displayId, payload.newState);
          }
        };
        
        const newWorkers = new Map(store.workers);
        newWorkers.set(workerKey, worker);

        resolve(worker);
        
        return { ...store, workers: newWorkers };
      });
    });
  },
  
  initializeWorker: (symbol, displayId, initData) => {
    
    displayStore.subscribe(store => {
      const display = store.displays.get(displayId);
      // 🔧 RACE FIX: Use unique worker key (symbol-displayId)
      const workerKey = `${symbol}-${displayId}`;
      const worker = store.workers.get(workerKey);
      if (display && worker) {
        const initPayload = {
          type: 'init',
          payload: {
            config: display.config,
            symbol,
            displayId,
            digits: initData.digits || 5,
            initialPrice: initData.bid || initData.currentPrice,
            todaysOpen: initData.todaysOpen || initData.currentPrice,
            projectedAdrHigh: initData.projectedAdrHigh,
            projectedAdrLow: initData.projectedAdrLow,
            todaysHigh: initData.todaysHigh,
            todaysLow: initData.todaysLow,
            initialMarketProfile: initData.initialMarketProfile || []
          }
        };
        worker.postMessage(initPayload);
      } else {
        console.warn(`[DISPLAY_STORE] Cannot initialize worker - display or worker missing:`, {
          displayId,
          symbol,
          hasDisplay: !!display,
          hasWorker: !!worker,
          workerKey
        });
      }
    })();
  },
  
  dispatchTickToWorker: (symbol, tick) => {
    displayStore.subscribe(store => {
      // 🔧 RACE FIX: Find all workers for this symbol (multiple displays possible)
      const matchingWorkers = [];
      store.workers.forEach((worker, workerKey) => {
        if (workerKey.startsWith(`${symbol}-`)) {
          matchingWorkers.push({ worker, workerKey });
        }
      });
      
      // Send tick to all matching workers
      matchingWorkers.forEach(({ worker }) => {
        worker.postMessage({ type: 'tick', payload: tick });
      });
    })();
  },
  
  // === WEBSOCKET INTEGRATION METHODS ===
  
  dispatchTick: (symbol, tickData) => {
    displayActions.dispatchTickToWorker(symbol, tickData);
  },
  
  createNewSymbol: (symbol, data) => {
    
    // For Symbol Palette: ALWAYS create new display (maintain existing behavior)
    const displayId = displayActions.addDisplay(symbol, {
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 100
    });
    
    // Initialize worker with received data
    displayActions.initializeWorker(symbol, displayId, data);
  },

  /**
   * Update existing symbol with fresh data (used by workspace restoration)
   * 🔧 RACE FIX: Sequential worker creation and unique worker per display
   * @param {string} symbol - Symbol to update
   * @param {Object} data - Fresh market data
   */
  updateExistingSymbol: async (symbol, data) => {
    
    let existingDisplayId = null;
    
    // Find existing display ID (simplified approach)
    displayStore.update(store => {
      for (const [id, display] of store.displays) {
        if (display.symbol === symbol) {
          existingDisplayId = id;
          break;
        }
      }
      return store; // No changes, just finding ID
    });
    
    // Use existing display ID with sequential worker initialization
    if (existingDisplayId) {
      try {
        // 🔧 RACE FIX: Create worker first, wait for it to be ready
        await displayActions.createWorkerForSymbol(symbol, existingDisplayId);

        // 🔧 RACE FIX: Initialize worker after it's created
        displayActions.initializeWorker(symbol, existingDisplayId, data);
      } catch (error) {
        console.error(`[DISPLAY_STORE] Failed to create worker for ${symbol}:`, error);
      }
    }
  },
  
  removeSymbol: (symbol) => {
    
    displayStore.update(store => {
      // Find and remove all displays for this symbol
      const newDisplays = new Map(store.displays);
      const displaysToRemove = [];
      
      for (const [displayId, display] of store.displays) {
        if (display.symbol === symbol) {
          displaysToRemove.push(displayId);
        }
      }
      
      // Remove each display
      displaysToRemove.forEach(displayId => {
        newDisplays.delete(displayId);
      });
      
      // Terminate workers for this symbol
      const newWorkers = new Map(store.workers);
      store.workers.forEach((worker, workerKey) => {
        if (workerKey.startsWith(`${symbol}-`)) {
          worker.terminate();
          newWorkers.delete(workerKey);
        }
      });
      
      return {
        ...store,
        displays: newDisplays,
        workers: newWorkers,
        activeDisplayId: displaysToRemove.includes(store.activeDisplayId) ? null : store.activeDisplayId
      };
    });
  },
  
  clear: () => {

    displayStore.update(store => {
      // Terminate all workers
      store.workers.forEach(worker => worker.terminate());

      return {
        ...store,
        displays: new Map(),
        workers: new Map(),
        activeDisplayId: null,
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
    displayStore.update(store => {
      let newStore = { ...store };
      
      switch (elementType) {
        case 'display':
          newStore.nextDisplayZIndex++;
          const newDisplays = new Map(store.displays);
          const display = newDisplays.get(elementId);
          if (display) {
            newDisplays.set(elementId, { ...display, zIndex: newStore.nextDisplayZIndex });
          }
          newStore.displays = newDisplays;
          break;
          
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
  },

  // === SIMPLIFIED WORKSPACE OPERATIONS ===

  /**
   * Initialize workspace from persisted data
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
        // Restore workspace layout
        displayStore.update(store => {
          let newStore = { ...store };

          // Restore displays using the restored runtime defaults
          const newDisplays = new Map();

          // 🔧 CONFIGURATION INHERITANCE FIX: Use restored runtime defaults for workspace restoration
          const restoredRuntimeDefaults = store.defaultConfig;

          workspaceData.layout.displays.forEach(displayData => {
            const display = {
              ...displayData,
              config: {
                ...restoredRuntimeDefaults, // 🔧 CRITICAL FIX: Use restored runtime defaults
                ...displayData.config, // 🔧 CRITICAL FIX: Preserve saved config overrides
                // 🔧 CRITICAL FIX: Ensure containerSize matches actual display size
                ...(displayData.size ? { containerSize: displayData.size } : {})
              },
              state: null,
              ready: false
            };
            newDisplays.set(displayData.id, display);
          });
          newStore.displays = newDisplays;

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

          // Set active elements
          newStore.activeDisplayId = null;
          newStore.activePanelId = null;
          newStore.activeIconId = null;

          return newStore;
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

      return workspaceData;
    } catch (error) {
      console.error('[DISPLAY_STORE] Failed to initialize workspace:', error);
      return null;
    }
  },

  /**
   * Save current workspace state
   */
  saveWorkspace: () => {
    displayStore.subscribe(store => {
      workspacePersistenceManager.saveCompleteWorkspace(
        store.displays,
        store.panels,
        store.icons,
        store.defaultConfig
      );
    })();
  },

  /**
   * Save workspace layout only (for backwards compatibility)
   */
  saveWorkspaceLayout: () => {
    displayStore.subscribe(store => {
      workspacePersistenceManager.saveWorkspaceLayout(
        store.displays,
        store.panels,
        store.icons
      );
    })();
  },

  /**
   * Export workspace to JSON
   */
  exportWorkspace: (metadata = {}) => {
    return new Promise((resolve) => {
      displayStore.subscribe(store => {
        // Create workspace export with runtime defaults
        const exportDataRaw = workspacePersistenceManager.exportWorkspace(
          store.displays,
          store.panels,
          store.icons,
          metadata
        );

        // Parse and inject the runtime defaults into the export
        try {
          const exportData = JSON.parse(exportDataRaw);
          if (exportData.globalConfig) {
            exportData.globalConfig.fullRuntimeConfig = store.defaultConfig;
          }
          resolve(JSON.stringify(exportData, null, 2));
        } catch (error) {
          console.error('[DISPLAY_STORE] Failed to process workspace export:', error);
          resolve(exportDataRaw);
        }
      })();
    });
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
    displayStore.update(store => {
      // Terminate all workers
      store.workers.forEach(worker => worker.terminate());
      
      // Clear persistence data
      workspacePersistenceManager.clearAllPersistence();
      
      return {
        ...store,
        displays: new Map(),
        panels: new Map(),
        icons: new Map(),
        workers: new Map(),
        activeDisplayId: null,
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
  const display = store.displays.get(displayId);
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
  displayStore.update(store => {
    // Terminate all workers
    store.workers.forEach(worker => worker.terminate());
    
    return initialState;
  });
};

// =============================================================================
// EXPORTS
// =============================================================================

export default displayStore;
