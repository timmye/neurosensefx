// =============================================================================
// UNIFIED DISPLAY STORE - Single Source of Truth for All Display Operations
// =============================================================================
// Replaces fragmented symbolStore.js + floatingStore.js with unified architecture
// Solves ADR axis synchronization issues and eliminates dual-store complexity
// 
// DESIGN PRINCIPLES:
// 1. Single source of truth for all display data
// 2. Complete configuration management (ADR axis + all 85+ parameters)
// 3. Unified worker integration with instant config propagation
// 4. LLM-friendly structure with clear sections
// 5. Following successful "rip it out and start again" pattern

import { writable } from 'svelte/store';
import { derived } from 'svelte/store';
import { 
    SymbolDataPackageSchema,
    VisualizationConfigSchema 
} from '../data/schema.js';

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
  
  // === CLEAN FOUNDATION CONFIGURATION ===
  // Clean parameters without legacy confusion
  // Container → Content → Rendering pipeline
  defaultConfig: {
    // === CONTAINER LAYOUT ===
    containerSize: { width: 220, height: 160 },     // Full display including header (220×120 content + 40px header)
    headerHeight: 40,                                // Header area height
    
    // === POSITIONING ===
    adrAxisPosition: 0.65,                           // 65% of content width (30% right of center)
    adrAxisBounds: { min: 0.05, max: 0.95 },       // 5%-95% of content width
    
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
    priceFloatWidth: 0.8,                              // 80% of content width
    priceFloatHeight: 0.1,                             // 10% of content height
    priceFloatXOffset: 0,                               // 0% of content width
    priceFloatUseDirectionalColor: false,
    priceFloatColor: '#FFFFFF',
    priceFloatUpColor: '#3b82f6',
    priceFloatDownColor: '#ef4444',
    showPriceFloatPulse: false,
    priceFloatPulseThreshold: 0.5,
    priceFloatPulseColor: 'rgba(167, 139, 250, 0.8)',
    priceFloatPulseScale: 1.5,
    priceFontSize: 0.45,                                // 45% of content height
    priceFontWeight: '600',
    priceHorizontalOffset: 0.018,                         // 1.8% of content width
    priceDisplayPadding: 0,                               // 0% of content dimensions
    bigFigureFontSizeRatio: 0.7,
    pipFontSizeRatio: 1.0,
    pipetteFontSizeRatio: 0.4,
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
    volatilityOrbBaseWidth: 0.91,                        // 91% of content width
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
    marketProfileUpColor: '#a78bfa',
    marketProfileDownColor: '#a78bfa',
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
    marketProfileWidthRatio: 1,
    showMaxMarker: true,

    // === PRICE MARKERS ===
    markerLineColor: '#FFFFFF',
    markerLineThickness: 2,

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
// UNIFIED ACTIONS (everything in one place)
// =============================================================================

export const displayActions = {
  
  // === DISPLAY OPERATIONS (from floatingStore) ===
  
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
      config: { ...initialState.defaultConfig, ...config },
      state: null,
      ready: false
    };
    
    displayStore.update(store => {
      const newDisplays = new Map(store.displays);
      newDisplays.set(displayId, display);
      return {
        ...store,
        displays: newDisplays,
        activeDisplayId: displayId
      };
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
        const worker = store.workers.get(display.symbol);
        if (worker) {
          worker.terminate();
        }
        
        const newDisplays = new Map(store.displays);
        const newWorkers = new Map(store.workers);
        
        newDisplays.delete(displayId);
        newWorkers.delete(display.symbol);
        
        return {
          ...store,
          displays: newDisplays,
          workers: newWorkers,
          activeDisplayId: store.activeDisplayId === displayId ? null : store.activeDisplayId
        };
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
        newDisplays.set(displayId, {
          ...display,
          state: newState,
          ready: true
        });
      }
      return { ...store, displays: newDisplays };
    });
  },
  
  // === CONFIGURATION OPERATIONS (unified from both stores) ===
  
  updateDisplayConfig: (displayId, parameter, value) => {
    console.log('[DISPLAY_STORE] Updating config:', displayId, parameter, value);
    
    displayStore.update(store => {
      const newDisplays = new Map(store.displays);
      const display = newDisplays.get(displayId);
      if (display) {
        const updatedConfig = { ...display.config, [parameter]: value };
        newDisplays.set(displayId, {
          ...display,
          config: updatedConfig
        });
        
        // Notify worker of configuration change
        const worker = store.workers.get(display.symbol);
        if (worker) {
          worker.postMessage({ 
            type: 'updateConfig', 
            payload: { [parameter]: value } 
          });
        }
      }
      return { ...store, displays: newDisplays };
    });
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
        const worker = store.workers.get(display.symbol);
        if (worker) {
          worker.postMessage({ 
            type: 'updateConfig', 
            payload: { [parameter]: value } 
          });
        }
      });
      
      return {
        ...store,
        defaultConfig: updatedConfig,
        displays: newDisplays
      };
    });
  },
  
  resetDisplayConfig: (displayId) => {
    console.log('[DISPLAY_STORE] Resetting config for display:', displayId);
    
    displayStore.update(store => {
      const newDisplays = new Map(store.displays);
      const display = newDisplays.get(displayId);
      if (display) {
        const resetConfig = { ...store.defaultConfig };
        newDisplays.set(displayId, {
          ...display,
          config: resetConfig
        });
        
        // Notify worker of configuration reset
        const worker = store.workers.get(display.symbol);
        if (worker) {
          worker.postMessage({ 
            type: 'updateConfig', 
            payload: resetConfig 
          });
        }
      }
      return { ...store, displays: newDisplays };
    });
  },
  
  // === WORKER OPERATIONS (from symbolStore) ===
  
  createWorkerForSymbol: (symbol, displayId) => {
    console.log('[DISPLAY_STORE] Creating worker for symbol:', symbol, 'display:', displayId);
    
    displayStore.update(store => {
      // Check if worker already exists
      if (store.workers.has(symbol)) {
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
      newWorkers.set(symbol, worker);
      
      return { ...store, workers: newWorkers };
    });
  },
  
  initializeWorker: (symbol, displayId, initData) => {
    console.log('[DISPLAY_STORE] Initializing worker for symbol:', symbol, 'display:', displayId);
    
    displayStore.subscribe(store => {
      const display = store.displays.get(displayId);
      const worker = store.workers.get(symbol);
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
            initialMarketProfile: initData.marketProfile || []
          }
        };
        worker.postMessage(initPayload);
      }
    })();
  },
  
  dispatchTickToWorker: (symbol, tick) => {
    displayStore.subscribe(store => {
      const worker = store.workers.get(symbol);
      if (worker) {
        worker.postMessage({ type: 'tick', payload: tick });
      }
    })();
  },
  
  // === WEBSOCKET INTEGRATION METHODS (missing from wsClient.js) ===
  
  dispatchTick: (symbol, tickData) => {
    console.log('[DISPLAY_STORE] Dispatching tick for symbol:', symbol);
    displayActions.dispatchTickToWorker(symbol, tickData);
  },
  
  createNewSymbol: (symbol, data) => {
    console.log('[DISPLAY_STORE] Creating new symbol:', symbol);
    
    let displayId = null;
    
    // Find existing display for this symbol or create new one
    displayStore.update(store => {
      let existingDisplay = null;
      
      // Check if display already exists for this symbol
      for (const [id, display] of store.displays) {
        if (display.symbol === symbol) {
          existingDisplay = display;
          displayId = id;
          break;
        }
      }
      
      if (!existingDisplay) {
        // Create new display for this symbol
        displayId = displayActions.addDisplay(symbol, {
          x: 100 + Math.random() * 200,
          y: 100 + Math.random() * 100
        });
      }
      
      return store;
    });
    
    // Initialize worker with received data
    if (displayId) {
      displayActions.initializeWorker(symbol, displayId, data);
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
      
      // Terminate worker
      const newWorkers = new Map(store.workers);
      const worker = newWorkers.get(symbol);
      if (worker) {
        worker.terminate();
        newWorkers.delete(symbol);
      }
      
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
  
  // === UI ELEMENT OPERATIONS (from floatingStore) ===
  
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
  
  // === ADR AXIS OPERATIONS ===
  
  updateAdrAxisPosition: (displayId, position) => {
    console.log('[DISPLAY_STORE] Updating ADR axis position:', displayId, position);
    
    displayStore.update(store => {
      const newDisplays = new Map(store.displays);
      const display = newDisplays.get(displayId);
      if (display) {
        // Validate position is within bounds (5% to 95%)
        const validatedPosition = Math.max(0.05, Math.min(0.95, position));
        
        const updatedConfig = { ...display.config, adrAxisPosition: validatedPosition };
        newDisplays.set(displayId, {
          ...display,
          config: updatedConfig
        });
        
        // Notify worker of configuration change
        const worker = store.workers.get(display.symbol);
        if (worker) {
          worker.postMessage({ 
            type: 'updateConfig', 
            payload: { adrAxisPosition: validatedPosition } 
          });
        }
      }
      return { ...store, displays: newDisplays };
    });
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
