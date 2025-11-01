import { writable, derived } from 'svelte/store';
import { loadWorkspaceSettings, saveWorkspaceSettings, workspaceSettingsAutoSaver } from '../utils/workspaceStorage.js';

// =============================================================================
// SIMPLIFIED GEOMETRY FOUNDATION
// =============================================================================

const GEOMETRY = {
  // SIMPLIFIED: Essential dimensions only
  DIMENSIONS: {
    HEADER_HEIGHT: 40,
    DISPLAY: {
      WIDTH: 240,
      HEIGHT: 160,
      MIN_WIDTH: 240,
      MIN_HEIGHT: 160
    },
    PANEL: {
      WIDTH: 300,
      HEIGHT: 400,
      MIN_WIDTH: 250,
      MIN_HEIGHT: 300
    }
  },
  
  // SIMPLIFIED: Component type definitions only
  COMPONENTS: {
    FloatingDisplay: {
      defaultSize: { width: 240, height: 160 },
      minSize: { width: 240, height: 160 }
    },
    SymbolPalette: {
      panel: {
        defaultSize: { width: 300, height: 400 },
        minSize: { width: 250, height: 300 }
      }
    }
  }
};

// Default configurations - FIXED: Use complete config from symbolStore with all 85+ parameters
const defaultConfig = {
  // Layout & Meter - UPDATED: Canvas-only percentage values
  visualizationsContentWidth: 100,    // 100% of canvas width
  meterHeight: 100,                   // 100% of canvas height
  centralAxisXPosition: 50,           // 50% of canvas width (center)
  adrRange: 100,
  adrLookbackDays: 14,
  adrProximityThreshold: 10,
  adrPulseColor: '#3B82F6',
  adrPulseWidthRatio: 1,
  adrPulseHeight: 2,

  // ADR Range Indicator
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

  // Labels (PH/PL, OHL)
  pHighLowLabelSide: 'right',
  ohlLabelSide: 'right',
  pHighLowLabelShowBackground: true,
  pHighLowLabelBackgroundColor: '#1f2937',
  pHighLowLabelBackgroundOpacity: 0.7,
  pHighLowLabelShowBoxOutline: false,
  pHighLowLabelBoxOutlineColor: '#4B5563',
  pHighLowLabelBoxOutlineOpacity: 1,
  ohlLabelShowBackground: true,
  ohlLabelBackgroundColor: '#1f2937',
  ohlLabelBackgroundOpacity: 0.7,
  ohlLabelShowBoxOutline: false,
  ohlLabelBoxOutlineColor: '#4B5563',
  ohlLabelBoxOutlineOpacity: 1,

  // Price Float & Display - UPDATED: Canvas-only percentage values
  priceFloatWidth: 45.5,              // 45.5% of canvas width (100px ÷ 220px)
  priceFloatHeight: 3.3,              // 3.3% of canvas height (4px ÷ 120px)
  priceFloatXOffset: 0,               // 0% of canvas width
  priceFloatUseDirectionalColor: false,
  priceFloatColor: '#FFFFFF',
  priceFloatUpColor: '#3b82f6',
  priceFloatDownColor: '#ef4444',
  showPriceFloatPulse: false,
  priceFloatPulseThreshold: 0.5,
  priceFloatPulseColor: 'rgba(167, 139, 250, 0.8)',
  priceFloatPulseScale: 1.5,
  priceFontSize: 54.2,               // 54.2% of canvas height (65px ÷ 120px)
  priceFontWeight: '600',
  priceHorizontalOffset: 1.8,        // 1.8% of canvas width (4px ÷ 220px)
  priceDisplayPadding: 0,             // 0% of canvas dimensions
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
  
  // Volatility Orb - UPDATED: Canvas-only percentage values
  showVolatilityOrb: true,
  volatilityColorMode: 'directional',
  volatilityOrbBaseWidth: 90.9,       // 90.9% of canvas width (200px ÷ 220px)
  volatilityOrbInvertBrightness: false,
  volatilitySizeMultiplier: 1.5,
  showVolatilityMetric: true,
  
  // Event Highlighting
  showFlash: false,
  flashThreshold: 2.0,
  flashIntensity: 0.3,
  showOrbFlash: false,
  orbFlashThreshold: 2.0,
  orbFlashIntensity: 0.8,
  
  // Market Profile
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

  // Price Markers
  markerLineColor: '#FFFFFF',
  markerLineThickness: 2,

  // Hover Indicator
  hoverLabelShowBackground: true,
  hoverLabelBackgroundColor: '#000000',
  hoverLabelBackgroundOpacity: 0.7,

  // Simulation
  frequencyMode: 'normal'
};

const defaultState = {
  ready: false,
  currentPrice: 0,
  projectedAdrHigh: 0,
  projectedAdrLow: 0,
  visualHigh: 0,
  visualLow: 0,
  volatility: 0
};

// Load workspace settings from localStorage
const savedWorkspaceSettings = loadWorkspaceSettings();

// =============================================================================
// SIMPLIFIED STATE - NO INTERACTION STATE MANAGEMENT
// =============================================================================

const initialState = {
  // Four distinct layers (enhanced with icons)
  displays: new Map(),      // Layer 1: visualization displays
  panels: new Map(),        // Layer 2: UI panels (symbol palette, debug, etc.)
  icons: new Map(),         // Layer 3: Floating icons (NEW)
  overlays: new Map(),      // Layer 4: context menus, modals
  
  // Z-index management per layer
  nextDisplayZIndex: 1,
  nextPanelZIndex: 1000,
  nextIconZIndex: 10000,    // NEW: Icon z-index tracking
  nextOverlayZIndex: 20000, // Adjusted for icon layer
  
  // Active state
  activeDisplayId: null,
  activePanelId: null,
  activeIconId: null,       // NEW: Track active icon
  
  // Context menu
  contextMenu: { 
    open: false, 
    x: 0, 
    y: 0, 
    targetId: null,
    targetType: null // 'display' | 'panel' | 'icon' | 'workspace'
  },
  
  // Canvas workspace settings (NEW) - loaded from localStorage
  workspaceSettings: savedWorkspaceSettings
  
  // REMOVED: All interaction state management - handled by interact.js
  // No draggedItem, no resizeState, no dragState
};

export const floatingStore = writable(initialState);

// Derived selectors
export const displays = derived(floatingStore, $store => $store.displays);
export const panels = derived(floatingStore, $store => $store.panels);
export const icons = derived(floatingStore, $store => $store.icons);
export const overlays = derived(floatingStore, $store => $store.overlays);
export const activeDisplay = derived(floatingStore, $store => 
  $store.activeDisplayId ? $store.displays.get($store.activeDisplayId) : null
);
export const activePanel = derived(floatingStore, $store => 
  $store.activePanelId ? $store.panels.get($store.activePanelId) : null
);
export const activeIcon = derived(floatingStore, $store => 
  $store.activeIconId ? $store.icons.get($store.activeIconId) : null
);
export const contextMenu = derived(floatingStore, $store => $store.contextMenu);

// Export simplified GEOMETRY foundation for component access
export { GEOMETRY };

// =============================================================================
// SIMPLIFIED ACTIONS - DATA OPERATIONS ONLY
// =============================================================================

// Actions
export const actions = {
  // Display operations - DATA ONLY
  addDisplay: (symbol, position = { x: 100, y: 100 }) => {
    const id = `display-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    floatingStore.update(store => {
      const newDisplays = new Map(store.displays);
      
      // REFERENCE CANVAS PATTERN: Use percentage-based default config
      const displayConfig = { ...defaultConfig };
      
      newDisplays.set(id, {
        id,
        symbol,
        position,
        config: displayConfig,
        state: { ...defaultState },
        zIndex: store.nextDisplayZIndex++,
        isActive: false,
        isHovered: false,
        createdAt: Date.now()
      });
      return { 
        ...store, 
        displays: newDisplays, 
        activeDisplayId: id,
        nextDisplayZIndex: store.nextDisplayZIndex
      };
    });
    return id;
  },

  removeDisplay: (id) => {
    floatingStore.update(store => {
      const newDisplays = new Map(store.displays);
      newDisplays.delete(id);
      return { 
        ...store, 
        displays: newDisplays,
        activeDisplayId: store.activeDisplayId === id ? null : store.activeDisplayId
      };
    });
  },

  moveDisplay: (id, position) => {
    floatingStore.update(store => {
      const newDisplays = new Map(store.displays);
      const display = newDisplays.get(id);
      if (display) {
        newDisplays.set(id, { ...display, position });
      }
      return { ...store, displays: newDisplays };
    });
  },

  resizeDisplay: (id, width, height) => {
    floatingStore.update(store => {
      const newDisplays = new Map(store.displays);
      const display = newDisplays.get(id);
      if (display) {
        // REFERENCE CANVAS PATTERN: Convert absolute pixels to percentages
        const REFERENCE_CANVAS = { width: 220, height: 120 };
        
        // Calculate canvas dimensions (subtract header height for canvas)
        const canvasHeight = Math.max(120, height - 40);
        const canvasWidth = width;
        
        // Convert to percentages for storage
        const widthPercentage = (canvasWidth / REFERENCE_CANVAS.width) * 100;
        const heightPercentage = (canvasHeight / REFERENCE_CANVAS.height) * 100;
        
        newDisplays.set(id, {
          ...display,
          config: {
            ...display.config,
            visualizationsContentWidth: widthPercentage,
            meterHeight: heightPercentage
          }
        });
      }
      return { ...store, displays: newDisplays };
    });
  },

  setActiveDisplay: (id) => {
    floatingStore.update(store => {
      const newDisplays = new Map(store.displays);
      
      // Deactivate all displays
      newDisplays.forEach(display => {
        display.isActive = false;
      });
      
      // Activate new display and bring to front
      const display = newDisplays.get(id);
      if (display) {
        display.isActive = true;
        display.zIndex = store.nextDisplayZIndex++;
      }
      
      return { 
        ...store, 
        displays: newDisplays, 
        activeDisplayId: id,
        nextDisplayZIndex: store.nextDisplayZIndex
      };
    });
  },

  // Panel operations - DATA ONLY
  addPanel: (id, type, position = { x: 50, y: 50 }, config = {}) => {
    floatingStore.update(store => {
      const newPanels = new Map(store.panels);
      newPanels.set(id, {
        id,
        type, // 'symbol-palette', 'debug', 'system', etc.
        position,
        config,
        zIndex: store.nextPanelZIndex++,
        isActive: false,
        isVisible: true,
        createdAt: Date.now()
      });
      return { 
        ...store, 
        panels: newPanels,
        nextPanelZIndex: store.nextPanelZIndex
      };
    });
  },

  removePanel: (id) => {
    floatingStore.update(store => {
      const newPanels = new Map(store.panels);
      newPanels.delete(id);
      return { 
        ...store, 
        panels: newPanels,
        activePanelId: store.activePanelId === id ? null : store.activePanelId
      };
    });
  },

  movePanel: (id, position) => {
    floatingStore.update(store => {
      const newPanels = new Map(store.panels);
      const panel = newPanels.get(id);
      if (panel) {
        newPanels.set(id, { ...panel, position });
      }
      return { ...store, panels: newPanels };
    });
  },

  setActivePanel: (id) => {
    floatingStore.update(store => {
      const newPanels = new Map(store.panels);
      
      // Deactivate all panels
      newPanels.forEach(panel => {
        panel.isActive = false;
      });
      
      // Activate new panel and bring to front
      const panel = newPanels.get(id);
      if (panel) {
        panel.isActive = true;
        panel.zIndex = store.nextPanelZIndex++;
      }
      
      return { 
        ...store, 
        panels: newPanels, 
        activePanelId: id,
        nextPanelZIndex: store.nextPanelZIndex
      };
    });
  },

  // Icon operations - DATA ONLY
  addIcon: (id, type, position = { x: 20, y: 20 }, config = {}) => {
    floatingStore.update(store => {
      const newIcons = new Map(store.icons);
      newIcons.set(id, {
        id,
        type, // 'symbol-palette', 'debug', 'control', etc.
        position,
        config,
        zIndex: store.nextIconZIndex++,
        isActive: false,
        isExpanded: false,
        isVisible: true,
        panelId: null, // Link to associated panel
        createdAt: Date.now()
      });
      return { 
        ...store, 
        icons: newIcons,
        nextIconZIndex: store.nextIconZIndex
      };
    });
    return id;
  },

  removeIcon: (id) => {
    floatingStore.update(store => {
      const newIcons = new Map(store.icons);
      const icon = newIcons.get(id);
      
      // Also remove associated panel if it exists
      if (icon && icon.panelId) {
        const newPanels = new Map(store.panels);
        newPanels.delete(icon.panelId);
        store.panels = newPanels;
      }
      
      newIcons.delete(id);
      return { 
        ...store, 
        icons: newIcons,
        panels: store.panels,
        activeIconId: store.activeIconId === id ? null : store.activeIconId
      };
    });
  },

  moveIcon: (id, position) => {
    floatingStore.update(store => {
      const newIcons = new Map(store.icons);
      const icon = newIcons.get(id);
      if (icon) {
        newIcons.set(id, { ...icon, position });
      }
      return { ...store, icons: newIcons };
    });
  },

  setActiveIcon: (id) => {
    floatingStore.update(store => {
      const newIcons = new Map(store.icons);
      
      // Deactivate all icons
      newIcons.forEach(icon => {
        icon.isActive = false;
      });
      
      // Activate new icon and bring to front
      const icon = newIcons.get(id);
      if (icon) {
        icon.isActive = true;
        icon.zIndex = store.nextIconZIndex++;
      }
      
      return { 
        ...store, 
        icons: newIcons, 
        activeIconId: id,
        nextIconZIndex: store.nextIconZIndex
      };
    });
  },

  // Icon expansion/collapse operations - DATA ONLY
  expandIcon: (id) => {
    floatingStore.update(store => {
      const newIcons = new Map(store.icons);
      const icon = newIcons.get(id);
      
      if (icon) {
        icon.isExpanded = true;
        
        // Show associated panel if it exists
        if (icon.panelId) {
          const newPanels = new Map(store.panels);
          const panel = newPanels.get(icon.panelId);
          if (panel) {
            panel.isVisible = true;
            panel.position = { ...icon.position }; // Position panel at icon location
          }
          store.panels = newPanels;
        }
      }
      
      return { ...store, icons: newIcons, panels: store.panels };
    });
  },

  collapseIcon: (id) => {
    floatingStore.update(store => {
      const newIcons = new Map(store.icons);
      const icon = newIcons.get(id);
      
      if (icon) {
        icon.isExpanded = false;
        
        // Hide associated panel if it exists
        if (icon.panelId) {
          const newPanels = new Map(store.panels);
          const panel = newPanels.get(icon.panelId);
          if (panel) {
            panel.isVisible = false;
          }
          store.panels = newPanels;
        }
      }
      
      return { ...store, icons: newIcons, panels: store.panels };
    });
  },

  toggleIconExpansion: (id) => {
    floatingStore.update(store => {
      const newIcons = new Map(store.icons);
      const icon = newIcons.get(id);
      
      if (icon) {
        icon.isExpanded = !icon.isExpanded;
        
        // Show/hide associated panel if it exists
        if (icon.panelId) {
          const newPanels = new Map(store.panels);
          const panel = newPanels.get(icon.panelId);
          if (panel) {
            panel.isVisible = icon.isExpanded;
            if (icon.isExpanded) {
              panel.position = { ...icon.position }; // Position panel at icon location
            }
          }
          store.panels = newPanels;
        }
      }
      
      return { ...store, icons: newIcons, panels: store.panels };
    });
  },

  // Link icon to panel - DATA ONLY
  linkIconToPanel: (iconId, panelId) => {
    floatingStore.update(store => {
      const newIcons = new Map(store.icons);
      const icon = newIcons.get(iconId);
      
      if (icon) {
        icon.panelId = panelId;
      }
      
      return { ...store, icons: newIcons };
    });
  },

  // Context menu operations - DATA ONLY
  showContextMenu: (x, y, targetId, targetType) => {
    floatingStore.update(store => ({
      ...store,
      contextMenu: { open: true, x, y, targetId, targetType }
    }));
  },

  hideContextMenu: () => {
    floatingStore.update(store => ({
      ...store,
      contextMenu: { open: false, x: 0, y: 0, targetId: null, targetType: null }
    }));
  },

  // NEW: Unified context menu operations - DATA ONLY
  showUnifiedContextMenu: (x, y, context) => {
    floatingStore.update(store => ({
      ...store,
      contextMenu: {
        open: true,
        x,
        y,
        context // { type: 'canvas' | 'header' | 'workspace' | 'panel', targetId, targetType }
      }
    }));
  },

  // NEW: Canvas configuration management - DATA ONLY
  updateCanvasConfig: (displayId, parameter, value) => {
    floatingStore.update(store => {
      const newDisplays = new Map(store.displays);
      const display = newDisplays.get(displayId);
      if (display) {
        newDisplays.set(displayId, {
          ...display,
          config: {
            ...display.config,
            [parameter]: value
          }
        });
      }
      return { ...store, displays: newDisplays };
    });
  },

  updateMultipleCanvasConfig: (displayId, configUpdates) => {
    floatingStore.update(store => {
      const newDisplays = new Map(store.displays);
      const display = newDisplays.get(displayId);
      if (display) {
        newDisplays.set(displayId, {
          ...display,
          config: {
            ...display.config,
            ...configUpdates
          }
        });
      }
      return { ...store, displays: newDisplays };
    });
  },

  resetCanvasConfig: (displayId) => {
    floatingStore.update(store => {
      const newDisplays = new Map(store.displays);
      const display = newDisplays.get(displayId);
      if (display) {
        newDisplays.set(displayId, {
          ...display,
          config: { ...defaultConfig }
        });
      }
      return { ...store, displays: newDisplays };
    });
  }
};

// =============================================================================
// REMOVED: All interaction state management and geometry actions
// These are now handled by interact.js library
// =============================================================================
