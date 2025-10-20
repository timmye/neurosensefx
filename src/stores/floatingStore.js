import { writable, derived } from 'svelte/store';

// Default configurations
const defaultConfig = {
  visualizationsContentWidth: 220,
  meterHeight: 120,
  flashIntensity: 0.3
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

const initialState = {
  // Three distinct layers
  displays: new Map(),      // Bottom layer: visualization displays
  panels: new Map(),        // Middle layer: UI panels (symbol palette, debug, etc.)
  overlays: new Map(),      // Top layer: context menus, modals
  
  // Z-index management per layer
  nextDisplayZIndex: 1,
  nextPanelZIndex: 1000,
  nextOverlayZIndex: 10000,
  
  // Active state
  activeDisplayId: null,
  activePanelId: null,
  
  // Context menu
  contextMenu: { 
    open: false, 
    x: 0, 
    y: 0, 
    targetId: null,
    targetType: null // 'display' | 'panel' | 'workspace'
  },
  
  // Drag state
  draggedItem: { type: null, id: null, offset: { x: 0, y: 0 } }
};

export const floatingStore = writable(initialState);

// Derived selectors
export const displays = derived(floatingStore, $store => $store.displays);
export const panels = derived(floatingStore, $store => $store.panels);
export const overlays = derived(floatingStore, $store => $store.overlays);
export const activeDisplay = derived(floatingStore, $store => 
  $store.activeDisplayId ? $store.displays.get($store.activeDisplayId) : null
);
export const contextMenu = derived(floatingStore, $store => $store.contextMenu);

// Actions
export const actions = {
  // Display operations
  addDisplay: (symbol, position = { x: 100, y: 100 }) => {
    const id = `display-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    floatingStore.update(store => {
      const newDisplays = new Map(store.displays);
      newDisplays.set(id, {
        id,
        symbol,
        position,
        config: { ...defaultConfig },
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

  // Panel operations
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

  // Context menu operations
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

  // Drag operations
  startDrag: (type, id, offset) => {
    floatingStore.update(store => ({
      ...store,
      draggedItem: { type, id, offset }
    }));
  },

  updateDrag: (position) => {
    floatingStore.update(store => {
      if (!store || !store.draggedItem || !store.draggedItem.id) return store;
      
      const { type, id } = store.draggedItem;
      
      if (type === 'display') {
        const newDisplays = new Map(store.displays);
        const display = newDisplays.get(id);
        if (display) {
          newDisplays.set(id, { ...display, position });
        }
        return { ...store, displays: newDisplays };
      } else if (type === 'panel') {
        const newPanels = new Map(store.panels);
        const panel = newPanels.get(id);
        if (panel) {
          newPanels.set(id, { ...panel, position });
        }
        return { ...store, panels: newPanels };
      }
      
      return store;
    });
  },

  endDrag: () => {
    floatingStore.update(store => ({
      ...store,
      draggedItem: { type: null, id: null, offset: { x: 0, y: 0 } }
    }));
  }
};
