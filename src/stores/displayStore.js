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
    SymbolDataPackageSchema,
    VisualizationConfigSchema 
} from '../data/schema.js';
import { configDefaultsManager } from '../utils/configDefaults.js';
import { workspacePersistenceManager } from '../utils/workspacePersistence.js';

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
  // Single global configuration for all displays
  defaultConfig: {
    // === CONTAINER LAYOUT ===
    containerSize: { width: 220, height: 160 },     // Full display including header (220×120 content + 40px header)
    headerHeight: 40,                                // Header area height
    
    // === LAYOUT & SIZING ===
    visualizationsContentWidth: 100,                    // 100% of canvas width
    meterHeight: 75,                                   // 75% of canvas height (120px - 40px header = 80px, so 75% = 60px)
    adrAxisPosition: 75,                              // 65% of content width (30% right of center)
    adrAxisBounds: { min: 5, max: 95 },             // 5%-95% of content width
    
    // === VISUALIZATION PARAMETERS (content-relative) ===
    adrRange: 100,
    adrLookbackDays: 14,
    adrProximityThreshold: 10,
    adrPulseColor: '#3B82F6',
    adrPulseWidthRatio: 1,
    adrPulseHeight: 2,

    // === ADR RANGE INDICATOR ===
    showAdrRangeIndicatorLines: true,
    adrRangeIndicatorLinesColor: '#9CA3AF',
    adrRangeIndicatorLinesThickness: 1,
    showAdrRangeIndicatorLabel: true,
    adrRangeIndicatorLabelColor: '#E5E7EB',
    adrRangeIndicatorLabelShowBackground: true,
    adrRangeIndicatorLabelBackgroundColor: '#1F2937',
    adrRangeIndicatorLabelBackgroundOpacity: 0.8,
    adrLabelType: 'dynamicPercentage',
    adrRangeIndicatorLabelShowBoxOutline: true,
    adrRangeIndicatorLabelBoxOutlineColor: '#4B5563',
    adrRangeIndicatorLabelBoxOutlineOpacity: 1,

    // === LABELS (PH/PL, OHL) ===
    pHighLowLabelSide: 'right',
    ohlLabelSide: 'right',
    pHighLowLabelShowBackground: true,
    pHighLowLabelBackgroundColor: '#1f2937',
    pHighLowLabelBackgroundOpacity: 0.7,
    pHighLowLabelShowBoxOutline: false,
    pHighLowLabelBoxOutlineColor: '#4b5563',
    pHighLowLabelBoxOutlineOpacity: 1,
    ohlLabelShowBackground: true,
    ohlLabelBackgroundColor: '#1f2937',
    ohlLabelBackgroundOpacity: 0.7,
    ohlLabelShowBoxOutline: false,
    ohlLabelBoxOutlineColor: '#4b5563',
    ohlLabelBoxOutlineOpacity: 1,

    // === PRICE FLOAT & DISPLAY (content-relative) ===
    priceFloatWidth: 15,                               // 15% of content width (33px on 220px canvas)
    priceFloatHeight: 2,                              // 2% of content height (2.4px on 120px canvas)
    priceFloatXOffset: 0,                               // 0% of content width
    priceFloatUseDirectionalColor: false,
    priceFloatColor: '#FFFFFF',
    priceFloatUpColor: '#3b82f6',
    priceFloatDownColor: '#ef4444',
    showPriceFloatPulse: false,
    priceFloatPulseThreshold: 0.5,
    priceFloatPulseColor: 'rgba(167, 139, 250, 0.8)',
    priceFloatPulseScale: 1.5,
    priceFontSize: 40,                                  // 5% of content height (MINIMUM: User requested minimum 5%)
    priceFontWeight: '600',
    priceDisplayPositioning: 'canvasRelative',             // Positioning mode: 'canvasRelative' or 'adrAxis'
    priceDisplayHorizontalPosition: 2,                     // ✅ FIXED: 2% from left edge (percentage, not decimal)
    priceDisplayXOffset: 0,                              // 0% offset from base position (DIFFERENT PURPOSE: fine-tuning)
    priceDisplayPadding: 4,                               // 4px padding (absolute pixels)
    bigFigureFontSizeRatio: 80,                           // ✅ FIXED: 80% of base font size (percentage for context menu)
    pipFontSizeRatio: 100,                               // ✅ FIXED: 100% of base font size (percentage for context menu)
    pipetteFontSizeRatio: 70,                             // ✅ FIXED: 70% of base font size (percentage for context menu)
    showPipetteDigit: true,
    priceUseStaticColor: false,
    priceStaticColor: '#d1d5db',
    priceUpColor: '#3b82f6',
    priceDownColor: '#ef4444',
    showPriceBackground: true,
    priceBackgroundColor: '#111827',
    priceBackgroundOpacity: 0.5,
    showPriceBoundingBox: false,
    priceBoxOutlineColor: '#4b5563',
    priceBoxOutlineOpacity: 1,
    
    // === VOLATILITY ORB (content-relative) ===
    showVolatilityOrb: true,
    volatilityColorMode: 'directional',
    volatilityOrbBaseWidth: 91,                         // 91% of content width
    volatilityOrbPositionMode: 'canvasCenter',             // Default: user expectation
    volatilityOrbXOffset: 0,                            // Default: no offset
    volatilityOrbInvertBrightness: false,
    volatilitySizeMultiplier: 1.5,
    showVolatilityMetric: true,
    
    // === EVENT HIGHLIGHTING ===
    showFlash: false,
    flashThreshold: 2.0,
    flashIntensity: 0.3,
    showOrbFlash: false,
    orbFlashThreshold: 2.0,
    orbFlashIntensity: 0.8,
    
    // === MARKET PROFILE ===
    showMarketProfile: true,
    marketProfileView: 'combinedRight',
    marketProfileUpColor: '#10B981',    // ✅ FIXED: Green for buy volume
    marketProfileDownColor: '#EF4444',  // ✅ FIXED: Red for sell volume  
    marketProfileOpacity: 0.7,
    marketProfileOutline: true,
    marketProfileOutlineShowStroke: true,
    marketProfileOutlineStrokeWidth: 1,
    marketProfileOutlineUpColor: '#a78bfa',
    marketProfileOutlineDownColor: '#a78bfa',
    marketProfileOutlineOpacity: 1,
    distributionDepthMode: 'all',
    distributionPercentage: 50,
    priceBucketMultiplier: 1,
    marketProfileWidthRatio: 15,         // ✅ FIXED: 15% = visible bars (33px on 220px canvas)
    marketProfileWidthMode: 'responsive', // 'responsive' | 'fixed' - NEW: Responsive width management
    marketProfileMinWidth: 5,            // NEW: Minimum bar width constraint (5px)
    marketProfileMarkerFontSize: 10,      // Font size for max volume marker (separate from price display)
    showMaxMarker: true,

    // === PRICE MARKERS ===
    markerLineColor: '#FFFFFF',
    markerLineThickness: 1,

    // === HOVER INDICATOR ===
    hoverLabelShowBackground: true,
    hoverLabelBackgroundColor: '#000000',
    hoverLabelBackgroundOpacity: 0.7,

    // === SIMULATION ===
    frequencyMode: 'normal'
  }
};

// =============================================================================
// STORE CREATION
// =============================================================================

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

// =============================================================================
// SIMPLIFIED UNIFIED ACTIONS (global config only)
// =============================================================================

export const displayActions = {
  
  // === DISPLAY OPERATIONS ===
  
  addDisplay: (symbol, position = { x: 100, y: 100 }, config = {}) => {
    console.log('[DISPLAY_STORE] Adding display:', symbol);
    
    const displayId = `display-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const display = {
      id: displayId,
      symbol,
      position,
      size: { width: 220, height: 160 },  // Full display including header
      isActive: false,
      zIndex: initialState.nextDisplayZIndex++,
      config: { ...initialState.defaultConfig }, // Use global config only
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
      
      // Persist workspace layout after adding display
      workspacePersistenceManager.saveWorkspaceLayout(
        newStore.displays,
        newStore.panels,
        newStore.icons
      );
      
      return newStore;
    });
    
    // Create worker for this display
    displayActions.createWorkerForSymbol(symbol, displayId);
    
    return displayId;
  },
  
  removeDisplay: (displayId) => {
    console.log('[DISPLAY_STORE] Removing display:', displayId);
    
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
        
        // Persist workspace layout after removing display
        workspacePersistenceManager.saveWorkspaceLayout(
          newStore.displays,
          newStore.panels,
          newStore.icons
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
        
        // Persist workspace layout after moving display
        workspacePersistenceManager.saveWorkspaceLayout(
          newDisplays,
          store.panels,
          store.icons
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
        
        // Persist workspace layout after resizing display
        workspacePersistenceManager.saveWorkspaceLayout(
          newDisplays,
          store.panels,
          store.icons
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
    console.log(`[DISPLAY_STORE] Updating state for display ${displayId}:`, {
      ready: newState?.ready,
      hasPrice: newState?.hasPrice,
      currentPrice: newState?.currentPrice
    });
    
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
        
        console.log(`[DISPLAY_STORE] Display ${displayId} updated:`, {
          symbol: display.symbol,
          ready: updatedDisplay.ready,
          hasPrice: newState?.hasPrice,
          stateKeys: Object.keys(newState || {})
        });
      } else {
        console.warn(`[DISPLAY_STORE] Display ${displayId} not found for state update`);
      }
      return { ...store, displays: newDisplays };
    });
  },
  
  // === SIMPLIFIED CONFIGURATION OPERATIONS (global only) ===
  
  updateDisplayConfig: (displayId, parameter, value) => {
    console.log('[DISPLAY_STORE] Updating global config:', parameter, value);
    
    displayStore.update(store => {
      const updatedConfig = { ...store.defaultConfig, [parameter]: value };
      
      // Update all displays with this parameter (global-only approach)
      const newDisplays = new Map(store.displays);
      newDisplays.forEach((display, id) => {
        newDisplays.set(id, {
          ...display,
          config: { ...display.config, [parameter]: value }
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
    
    // Auto-save global config change
    workspacePersistenceManager.saveGlobalConfig({ [parameter]: value });
  },
  
  updateGlobalConfig: (parameter, value) => {
    console.log('[DISPLAY_STORE] Updating global config:', parameter, value);
    
    displayStore.update(store => {
      const updatedConfig = { ...store.defaultConfig, [parameter]: value };
      
      // Update all displays with this parameter
      const newDisplays = new Map(store.displays);
      newDisplays.forEach((display, displayId) => {
        newDisplays.set(displayId, {
          ...display,
          config: { ...display.config, [parameter]: value }
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
    
    // Auto-save global config change
    workspacePersistenceManager.saveGlobalConfig({ [parameter]: value });
  },
  
  resetToFactoryDefaults: () => {
    console.log('[DISPLAY_STORE] Resetting to factory defaults');
    
    displayStore.update(store => {
      const factoryDefaults = configDefaultsManager.getFactoryDefaults();
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
    
    // Reset persistence to factory defaults
    workspacePersistenceManager.resetToFactoryDefaults();
  },
  
  // === WORKER OPERATIONS ===
  
  createWorkerForSymbol: (symbol, displayId) => {
    console.log('[DISPLAY_STORE] Creating worker for symbol:', symbol, 'display:', displayId);
    
    return new Promise((resolve) => {
      displayStore.update(store => {
        // 🔧 RACE FIX: Create unique worker per display (not per symbol)
        const workerKey = `${symbol}-${displayId}`;
        
        // Check if worker already exists for this specific display
        if (store.workers.has(workerKey)) {
          console.log(`[DISPLAY_STORE] Worker already exists for ${workerKey}, reusing`);
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
        
        console.log(`[DISPLAY_STORE] Worker created for ${workerKey}`);
        resolve(worker);
        
        return { ...store, workers: newWorkers };
      });
    });
  },
  
  initializeWorker: (symbol, displayId, initData) => {
    console.log('[DISPLAY_STORE] Initializing worker for symbol:', symbol, 'display:', displayId);
    
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
        console.log(`[DISPLAY_STORE] Sending init payload to ${workerKey}:`, initPayload);
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
      matchingWorkers.forEach(({ worker, workerKey }) => {
        console.log(`[DISPLAY_STORE] Dispatching tick to ${workerKey}`);
        worker.postMessage({ type: 'tick', payload: tick });
      });
      
      if (matchingWorkers.length === 0) {
        console.warn(`[DISPLAY_STORE] No workers found for symbol: ${symbol}`);
      }
    })();
  },
  
  // === WEBSOCKET INTEGRATION METHODS ===
  
  dispatchTick: (symbol, tickData) => {
    console.log('[DISPLAY_STORE] Dispatching tick for symbol:', symbol);
    displayActions.dispatchTickToWorker(symbol, tickData);
  },
  
  createNewSymbol: (symbol, data) => {
    console.log('[DISPLAY_STORE] Creating new symbol:', symbol);
    
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
    console.log('[DISPLAY_STORE] Updating existing symbol:', symbol);
    
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
      console.log(`[DISPLAY_STORE] Using existing display ${existingDisplayId} for ${symbol}`);
      
      try {
        // 🔧 RACE FIX: Create worker first, wait for it to be ready
        const worker = await displayActions.createWorkerForSymbol(symbol, existingDisplayId);
        console.log(`[DISPLAY_STORE] Worker created successfully for ${symbol}-${existingDisplayId}`);
        
        // 🔧 RACE FIX: Initialize worker after it's created
        displayActions.initializeWorker(symbol, existingDisplayId, data);
      } catch (error) {
        console.error(`[DISPLAY_STORE] Failed to create worker for ${symbol}:`, error);
      }
    } else {
      console.warn(`[DISPLAY_STORE] No existing display found for symbol ${symbol}`);
    }
  },
  
  removeSymbol: (symbol) => {
    console.log('[DISPLAY_STORE] Removing symbol:', symbol);
    
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
    console.log('[DISPLAY_STORE] Clearing all displays and workers');
    
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
        contextMenu: { 
          ...store.contextMenu,
          open: false
        }
      };
    });
  },
  
  // === UI ELEMENT OPERATIONS ===
  
  addPanel: (type, position = { x: 50, y: 50 }, config = {}) => {
    console.log('[DISPLAY_STORE] Adding panel:', type, 'with config:', config);
    // Use type as ID for known panels, otherwise generate random ID
    const panelId = type === 'symbol-palette' ? 'symbol-palette' : `panel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
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
    console.log('[DISPLAY_STORE] Removing panel:', panelId);
    displayStore.update(store => {
      const newPanels = new Map(store.panels);
      newPanels.delete(panelId);
      console.log('[DISPLAY_STORE] Panel removed, remaining panels:', newPanels.size);
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
              console.log('[DISPLAY_STORE] Creating symbol palette panel for icon expansion');
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
              console.log('[DISPLAY_STORE] Removing symbol palette panel for icon collapse');
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
      console.log('[DISPLAY_STORE] Initializing workspace...');
      
      const workspaceData = await workspacePersistenceManager.initializeWorkspace();
      
      if (workspaceData.layout) {
        // Restore workspace layout
        displayStore.update(store => {
          let newStore = { ...store };
          
          // Restore displays
          const newDisplays = new Map();
          workspaceData.layout.displays.forEach(displayData => {
            // 🔍 DEBUG: Log size restoration for each display
            console.log(`[DISPLAY_STORE_DEBUG] Restoring display ${displayData.id}:`, {
              symbol: displayData.symbol,
              restoredSize: displayData.size,
              hasCustomSize: !!displayData.size,
              defaultSize: { width: 220, height: 160 }
            });
            const display = {
              ...displayData,
              config: {
                ...initialState.defaultConfig,
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
          
          console.log('[DISPLAY_STORE] Workspace restored:', {
            displays: newDisplays.size,
            panels: newPanels.size,
            icons: newIcons.size
          });
          
          return newStore;
        });

        // 🔧 CRITICAL FIX: Subscribe restored symbols to WebSocket for fresh data
        console.log('[DISPLAY_STORE] Scheduling delayed subscription for restored symbols...');
        
        // Import WebSocket client dynamically to avoid circular dependencies
        const { subscribe, wsStatus } = await import('../data/wsClient.js');
        
        // 🔧 RACE FIX: Staggered WebSocket subscriptions to prevent overload
        setTimeout(() => {
          console.log('[DISPLAY_STORE] Attempting to subscribe restored symbols with staggered timing...');
          
          // Subscribe each restored symbol with 500ms delays between them
          workspaceData.layout.displays.forEach((displayData, index) => {
            setTimeout(() => {
              console.log(`[DISPLAY_STORE] Subscribing restored symbol ${index + 1}/${workspaceData.layout.displays.length}: ${displayData.symbol}`);
              subscribe(displayData.symbol);
            }, index * 500); // 500ms delay between each subscription
          });
          
          // Log when all subscriptions are scheduled
          const totalDelay = (workspaceData.layout.displays.length - 1) * 500;
          setTimeout(() => {
            console.log(`[DISPLAY_STORE] All ${workspaceData.layout.displays.length} restored symbols subscription attempts completed`);
          }, totalDelay);
          
        }, 2000); // 2 second initial delay to allow WebSocket connection
        
        console.log(`[DISPLAY_STORE] Scheduled subscriptions for ${workspaceData.layout.displays.length} restored symbols in 2 seconds`);
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
        const exportData = workspacePersistenceManager.exportWorkspace(
          store.displays,
          store.panels,
          store.icons,
          metadata
        );
        resolve(exportData);
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
