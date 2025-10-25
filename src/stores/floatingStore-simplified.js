import { writable } from 'svelte/store';

// =============================================================================
// SIMPLIFIED FLOATING STORE - PHASE 1 OF SIMPLIFICATION STRATEGY
// =============================================================================

// Simple component types
const COMPONENT_TYPES = {
  DISPLAY: 'display',
  PANEL: 'panel',
  ICON: 'icon'
};

// Basic dimensions
const DIMENSIONS = {
  DISPLAY: { width: 240, height: 160, minWidth: 200, minHeight: 120 },
  PANEL: { width: 300, height: 400, minWidth: 250, minHeight: 300 },
  ICON: { width: 48, height: 48 }
};

// Grid and viewport settings
const GRID_SIZE = 8;
const VIEWPORT_PADDING = 4;

// Simple initial state with arrays instead of Maps
const initialState = {
  displays: [],           // Array of display objects
  panels: [],             // Array of panel objects  
  icons: [],              // Array of icon objects
  
  activeDisplayId: null,
  activePanelId: null,
  activeIconId: null,
  
  contextMenu: { 
    open: false, 
    x: 0, 
    y: 0, 
    targetId: null,
    targetType: null
  },
  
  draggedItem: { 
    type: null, 
    id: null, 
    offset: { x: 0, y: 0 } 
  },
  
  resizeState: {
    isResizing: false,
    displayId: null,
    handleType: null,
    startPosition: { x: 0, y: 0 },
    startSize: { width: 0, height: 0 },
    startMousePos: { x: 0, y: 0 }
  }
};

// Create simplified store
export const floatingStore = writable(initialState);

// Simple derived selectors
export const displays = derived(floatingStore, $store => $store.displays);
export const panels = derived(floatingStore, $store => $store.panels);
export const icons = derived(floatingStore, $store => $store.icons);
export const activeDisplay = derived(floatingStore, $store => 
  $store.displays.find(d => d.id === $store.activeDisplayId) || null
);
export const activePanel = derived(floatingStore, $store => 
  $store.panels.find(p => p.id === $store.activePanelId) || null
);
export const activeIcon = derived(floatingStore, $store => 
  $store.icons.find(i => i.id === $store.activeIconId) || null
);
export const contextMenu = derived(floatingStore, $store => $store.contextMenu);

// =============================================================================
// SIMPLE GEOMETRY UTILITIES - ESSENTIAL FUNCTIONS ONLY
// =============================================================================

// Simple grid snapping
export const snapToGrid = (position, gridSize = GRID_SIZE) => ({
  x: Math.round(position.x / gridSize) * gridSize,
  y: Math.round(position.y / gridSize) * gridSize
});

// Simple viewport constraints
export const constrainToViewport = (position, size, viewport = { 
  width: window.innerWidth, 
  height: window.innerHeight 
}) => ({
  x: Math.max(0, Math.min(position.x, viewport.width - size.width)),
  y: Math.max(0, Math.min(position.y, viewport.height - size.height))
});

// Simple collision detection
export const checkCollision = (pos1, size1, pos2, size2) => {
  return !(
    pos1.x + size1.width < pos2.x ||
    pos2.x + size2.width < pos1.x ||
    pos1.y + size1.height < pos2.y ||
    pos2.y + size2.height < pos1.y
  );
};

// Generate unique ID
const generateId = (type) => `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

// Find component by ID across all arrays
const findComponent = (store, id) => {
  return store.displays.find(d => d.id === id) ||
         store.panels.find(p => p.id === id) ||
         store.icons.find(i => i.id === id);
};

// =============================================================================
// SIMPLIFIED ACTIONS - BASIC CRUD ONLY
// =============================================================================

export const actions = {
  // Display operations
  addDisplay: (symbol, position = { x: 100, y: 100 }) => {
    const id = generateId('display');
    const display = {
      id,
      symbol,
      position,
      config: {
        visualizationsContentWidth: 100,
        meterHeight: 100,
        centralAxisXPosition: 50,
        showMarketProfile: true,
        showVolatilityOrb: true,
        priceFontSize: 54.2,
        priceColor: '#FFFFFF',
        volatilityOrbBaseWidth: 90.9
      },
      state: {
        ready: false,
        currentPrice: 0,
        volatility: 0
      },
      zIndex: Date.now(),
      isActive: false,
      createdAt: Date.now()
    };

    floatingStore.update(store => ({
      ...store,
      displays: [...store.displays, display],
      activeDisplayId: id
    }));
    
    return id;
  },

  removeDisplay: (id) => {
    floatingStore.update(store => ({
      ...store,
      displays: store.displays.filter(d => d.id !== id),
      activeDisplayId: store.activeDisplayId === id ? null : store.activeDisplayId
    }));
  },

  moveDisplay: (id, position) => {
    floatingStore.update(store => ({
      ...store,
      displays: store.displays.map(display => 
        display.id === id ? { ...display, position } : display
      )
    }));
  },

  setActiveDisplay: (id) => {
    floatingStore.update(store => {
      const maxZ = Math.max(...store.displays.map(d => d.zIndex), 0);
      return {
        ...store,
        displays: store.displays.map(display => ({
          ...display,
          isActive: display.id === id,
          zIndex: display.id === id ? maxZ + 1 : display.zIndex
        })),
        activeDisplayId: id
      };
    });
  },

  // Panel operations
  addPanel: (type, position = { x: 50, y: 50 }, config = {}) => {
    const id = generateId('panel');
    const panel = {
      id,
      type,
      position,
      config,
      zIndex: Date.now(),
      isActive: false,
      isVisible: true,
      createdAt: Date.now()
    };

    floatingStore.update(store => ({
      ...store,
      panels: [...store.panels, panel]
    }));
    
    return id;
  },

  removePanel: (id) => {
    floatingStore.update(store => ({
      ...store,
      panels: store.panels.filter(p => p.id !== id),
      activePanelId: store.activePanelId === id ? null : store.activePanelId
    }));
  },

  movePanel: (id, position) => {
    floatingStore.update(store => ({
      ...store,
      panels: store.panels.map(panel => 
        panel.id === id ? { ...panel, position } : panel
      )
    }));
  },

  setActivePanel: (id) => {
    floatingStore.update(store => {
      const maxZ = Math.max(...store.panels.map(p => p.zIndex), 0);
      return {
        ...store,
        panels: store.panels.map(panel => ({
          ...panel,
          isActive: panel.id === id,
          zIndex: panel.id === id ? maxZ + 1 : panel.zIndex
        })),
        activePanelId: id
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
      if (!store.draggedItem.id) return store;
      
      const { type, id } = store.draggedItem;
      
      if (type === 'display') {
        return {
          ...store,
          displays: store.displays.map(display => 
            display.id === id ? { ...display, position } : display
          )
        };
      } else if (type === 'panel') {
        return {
          ...store,
          panels: store.panels.map(panel => 
            panel.id === id ? { ...panel, position } : panel
          )
        };
      }
      
      return store;
    });
  },

  endDrag: () => {
    floatingStore.update(store => ({
      ...store,
      draggedItem: { type: null, id: null, offset: { x: 0, y: 0 } }
    }));
  },

  // Resize operations
  resizeDisplay: (id, width, height) => {
    floatingStore.update(store => ({
      ...store,
      displays: store.displays.map(display => 
        display.id === id ? {
          ...display,
          config: {
            ...display.config,
            visualizationsContentWidth: (width / 220) * 100,
            meterHeight: ((height - 40) / 120) * 100
          }
        } : display
      )
    }));
  },

  startResize: (displayId, handleType, startPosition, startSize, startMousePos) => {
    floatingStore.update(store => ({
      ...store,
      resizeState: {
        isResizing: true,
        displayId,
        handleType,
        startPosition,
        startSize,
        startMousePos
      }
    }));
  },

  updateResize: (mousePos) => {
    floatingStore.update(store => {
      if (!store.resizeState.isResizing) return store;

      const { displayId, handleType, startSize, startMousePos, startPosition } = store.resizeState;
      const deltaX = mousePos.x - startMousePos.x;
      const deltaY = mousePos.y - startMousePos.y;

      let newWidth = startSize.width;
      let newHeight = startSize.height;
      let newPosition = { ...startPosition };

      const MIN_WIDTH = DIMENSIONS.DISPLAY.minWidth;
      const MIN_HEIGHT = DIMENSIONS.DISPLAY.minHeight;
      
      // Calculate new dimensions based on handle type
      switch (handleType) {
        case 'e':
          newWidth = Math.max(MIN_WIDTH, startSize.width + deltaX);
          break;
        case 'w':
          newWidth = Math.max(MIN_WIDTH, startSize.width - deltaX);
          newPosition.x = startPosition.x + (startSize.width - newWidth);
          break;
        case 's':
          newHeight = Math.max(MIN_HEIGHT, startSize.height + deltaY);
          break;
        case 'n':
          newHeight = Math.max(MIN_HEIGHT, startSize.height - deltaY);
          newPosition.y = startPosition.y + (startSize.height - newHeight);
          break;
        case 'se':
          newWidth = Math.max(MIN_WIDTH, startSize.width + deltaX);
          newHeight = Math.max(MIN_HEIGHT, startSize.height + deltaY);
          break;
        case 'sw':
          newWidth = Math.max(MIN_WIDTH, startSize.width - deltaX);
          newHeight = Math.max(MIN_HEIGHT, startSize.height + deltaY);
          newPosition.x = startPosition.x + (startSize.width - newWidth);
          break;
        case 'ne':
          newWidth = Math.max(MIN_WIDTH, startSize.width + deltaX);
          newHeight = Math.max(MIN_HEIGHT, startSize.height - deltaY);
          newPosition.y = startPosition.y + (startSize.height - newHeight);
          break;
        case 'nw':
          newWidth = Math.max(MIN_WIDTH, startSize.width - deltaX);
          newHeight = Math.max(MIN_HEIGHT, startSize.height - deltaY);
          newPosition.x = startPosition.x + (startSize.width - newWidth);
          newPosition.y = startPosition.y + (startSize.height - newHeight);
          break;
      }

      // Apply viewport constraints
      const maxX = window.innerWidth - newWidth;
      const maxY = window.innerHeight - newHeight;
      newPosition.x = Math.max(0, Math.min(newPosition.x, maxX));
      newPosition.y = Math.max(0, Math.min(newPosition.y, maxY));

      // Update display
      return {
        ...store,
        displays: store.displays.map(display => 
          display.id === displayId ? {
            ...display,
            position: newPosition,
            config: {
              ...display.config,
              visualizationsContentWidth: (newWidth / 220) * 100,
              meterHeight: ((newHeight - 40) / 120) * 100
            }
          } : display
        )
      };
    });
  },

  endResize: () => {
    floatingStore.update(store => ({
      ...store,
      resizeState: {
        isResizing: false,
        displayId: null,
        handleType: null,
        startPosition: { x: 0, y: 0 },
        startSize: { width: 0, height: 0 },
        startMousePos: { x: 0, y: 0 }
      }
    }));
  }
};

// Export utilities for components
export { snapToGrid, constrainToViewport, checkCollision, DIMENSIONS };
