import { writable, derived } from 'svelte/store';
import { loadWorkspaceSettings, saveWorkspaceSettings, workspaceSettingsAutoSaver } from '../utils/workspaceStorage.js';

// =============================================================================
// UNIFIED GEOMETRY FOUNDATION
// =============================================================================

const GEOMETRY = {
  // SIMPLISTIC: All dimensions in one place
  DIMENSIONS: {
    // Base units
    GRID_UNIT: 8,
    HEADER_HEIGHT: 40,
    BORDER_WIDTH: 2,
    PADDING: 8,
    
    // Component dimensions - UPDATED: Total container dimensions (not just canvas)
    DISPLAY: {
      WIDTH: 240,   // ✅ UPDATED: Total container width (220 canvas + 20 padding/borders)
      HEIGHT: 160,  // ✅ UPDATED: Total container height (120 canvas + 40 header)
      MIN_WIDTH: 240, // ✅ FIXED: Should match default width for consistency
      MIN_HEIGHT: 160 // ✅ FIXED: Should match default height for consistency
    },
    
    PANEL: {
      WIDTH: 300,
      HEIGHT: 400,
      MIN_WIDTH: 250,
      MIN_HEIGHT: 300
    },
    
    ICON: {
      SIZE: 48,
      MIN_SIZE: 32,
      MAX_SIZE: 64
    },
    
    // Layout constants
    VIEWPORT_PADDING: 4, // ✅ REDUCED: Was 24px, too restrictive
    SNAP_THRESHOLD: 8,
    HANDLE_SIZE: 8
  },
  
  // UNIFIED: Component type definitions - UPDATED: Total container dimensions
  COMPONENTS: {
    FloatingDisplay: {
      defaultSize: { width: 240, height: 160 }, // ✅ UPDATED: Total container (not just canvas)
      minSize: { width: 200, height: 120 },     // ✅ UPDATED: Minimum total container size
      resizable: true,
      gridSnap: true,
      constrainToViewport: true
    },
    
    DemoFloatingDisplay: {
      defaultSize: { width: 280, height: 200 }, // Demo component slightly larger
      minSize: { width: 220, height: 160 },
      resizable: true,
      gridSnap: true,
      constrainToViewport: true
    },
    
    SymbolPalette: {
      icon: {
        defaultSize: { width: 48, height: 48 },
        minSize: { width: 48, height: 48 },
        resizable: false,
        gridSnap: true
      },
      panel: {
        defaultSize: { width: 300, height: 400 },
        minSize: { width: 250, height: 300 },
        resizable: true,
        gridSnap: true
      }
    }
  },
  
  // EFFICIENT: Pre-calculated transforms
  TRANSFORMS: {
    // Grid snapping
    snapToGrid: (position, gridUnit = GEOMETRY.DIMENSIONS.GRID_UNIT) => ({
      x: Math.round(position.x / gridUnit) * gridUnit,
      y: Math.round(position.y / gridUnit) * gridUnit
    }),
    
    // NEW: Smart grid snapping with threshold
    snapToGridSmart: (position, gridSize, threshold = gridSize/2) => {
      // Only snap if close enough to grid line
      const offset = { x: position.x % gridSize, y: position.y % gridSize };
      const shouldSnapX = offset.x < threshold || offset.x > (gridSize - threshold);
      const shouldSnapY = offset.y < threshold || offset.y > (gridSize - threshold);
      
      return {
        x: shouldSnapX ? Math.round(position.x / gridSize) * gridSize : position.x,
        y: shouldSnapY ? Math.round(position.y / gridSize) * gridSize : position.y,
        snapped: shouldSnapX || shouldSnapY
      };
    },
    
    // Viewport constraints - FIXED: Use minimal padding for proper boundaries
    constrainToViewport: (position, size, viewport = { width: window.innerWidth, height: window.innerHeight }) => ({
      x: Math.max(0, Math.min(position.x, viewport.width - size.width)),
      y: Math.max(0, Math.min(position.y, viewport.height - size.height))
    }),
    
    // NEW: Enhanced viewport constraints with better boundary handling
    constrainToViewportEnhanced: (position, size, viewport = { width: window.innerWidth, height: window.innerHeight }) => {
      const constrainedX = Math.max(0, Math.min(position.x, viewport.width - size.width));
      const constrainedY = Math.max(0, Math.min(position.y, viewport.height - size.height));
      
      return {
        x: constrainedX,
        y: constrainedY,
        wasConstrained: constrainedX !== position.x || constrainedY !== position.y
      };
    },
    
    // Size constraints
    applySizeConstraints: (size, componentType, state = 'default') => {
      const constraints = GEOMETRY.COMPONENTS[componentType];
      const componentConfig = typeof constraints === 'object' && !constraints.defaultSize ? 
        constraints[state] || constraints.default || constraints : constraints;
      
      if (!componentConfig) return size;
      
      return {
        width: Math.max(componentConfig.minSize?.width || size.width, size.width),
        height: Math.max(componentConfig.minSize?.height || size.height, size.height)
      };
    },
    
    // Complete transform pipeline
    applyTransforms: (position, size, componentType, state = 'default', options = {}) => {
      let resultPosition = { ...position };
      let resultSize = { ...size };
      
      // Apply size constraints
      resultSize = GEOMETRY.TRANSFORMS.applySizeConstraints(resultSize, componentType, state);
      
      // Apply grid snap if enabled
      if (options.gridSnap !== false) {
        resultPosition = GEOMETRY.TRANSFORMS.snapToGrid(resultPosition);
      }
      
      // Apply viewport constraints if enabled
      if (options.constrainToViewport !== false) {
        resultPosition = GEOMETRY.TRANSFORMS.constrainToViewport(resultPosition, resultSize);
      }
      
      return { position: resultPosition, size: resultSize };
    }
  },
  
  // MAINTAINABLE: Reusable edge calculations
  EDGES: {
    calculate: (position, size) => ({
      left: position.x,
      right: position.x + size.width,
      top: position.y,
      bottom: position.y + size.height,
      center: {
        x: position.x + size.width / 2,
        y: position.y + size.height / 2
      },
      corners: {
        topLeft: { x: position.x, y: position.y },
        topRight: { x: position.x + size.width, y: position.y },
        bottomLeft: { x: position.x, y: position.y + size.height },
        bottomRight: { x: position.x + size.width, y: position.y + size.height }
      }
    }),
    
    // Collision detection
    checkCollision: (pos1, size1, pos2, size2) => {
      const edges1 = GEOMETRY.EDGES.calculate(pos1, size1);
      const edges2 = GEOMETRY.EDGES.calculate(pos2, size2);
      
      return !(
        edges1.right < edges2.left ||
        edges1.left > edges2.right ||
        edges1.bottom < edges2.top ||
        edges1.top > edges2.bottom
      );
    },
    
    // Safe positioning
    findSafePosition: (size, existingComponents, viewport) => {
      let position = { x: GEOMETRY.DIMENSIONS.VIEWPORT_PADDING, y: GEOMETRY.DIMENSIONS.VIEWPORT_PADDING };
      
      // Simple grid placement
      for (const component of existingComponents.values()) {
        if (GEOMETRY.EDGES.checkCollision(position, size, component.position, component.size)) {
          // Move to next position
          position.x += size.width + GEOMETRY.DIMENSIONS.SNAP_THRESHOLD;
          
          // Check if we need to move to next row
          if (position.x + size.width > viewport.width - GEOMETRY.DIMENSIONS.VIEWPORT_PADDING) {
            position.x = GEOMETRY.DIMENSIONS.VIEWPORT_PADDING;
            position.y += size.height + GEOMETRY.DIMENSIONS.SNAP_THRESHOLD;
          }
        }
      }
      
      return position;
    },
    
    // NEW: Enhanced collision detection without self-collision
    checkCollisionEnhanced: (pos1, size1, pos2, size2, excludeId = null) => {
      if (excludeId && pos1.id === excludeId) return false; // Skip self-collision
      return GEOMETRY.EDGES.checkCollision(pos1, size1, pos2, size2);
    },
    
    // NEW: Find all collisions for a component
    findAllCollisions: (componentId, position, size, allComponents) => {
      const collisions = [];
      for (const [id, component] of allComponents) {
        if (id !== componentId && GEOMETRY.EDGES.checkCollision(position, size, component.position, component.size)) {
          collisions.push(id);
        }
      }
      return collisions;
    },
    
    // NEW: Calculate safe position avoiding collisions
    findSafePositionEnhanced: (componentId, targetPosition, size, allComponents) => {
      // Check if target position is safe
      const collisions = GEOMETRY.EDGES.findAllCollisions(componentId, targetPosition, size, allComponents);
      if (collisions.length === 0) {
        return targetPosition; // Position is safe
      }
      
      // Find alternative safe position
      let safePosition = { ...targetPosition };
      const stepSize = GEOMETRY.DIMENSIONS.GRID_UNIT;
      const maxAttempts = 50;
      let attempts = 0;
      
      // Try positions in a spiral pattern
      for (let radius = stepSize; radius < stepSize * 10 && attempts < maxAttempts; radius += stepSize) {
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
          safePosition = {
            x: targetPosition.x + Math.cos(angle) * radius,
            y: targetPosition.y + Math.sin(angle) * radius
          };
          
          // Apply viewport constraints
          safePosition = GEOMETRY.TRANSFORMS.constrainToViewport(safePosition, size);
          
          const newCollisions = GEOMETRY.EDGES.findAllCollisions(componentId, safePosition, size, allComponents);
          if (newCollisions.length === 0) {
            return safePosition; // Found safe position
          }
          attempts++;
        }
      }
      
      return null; // No safe position found
    }
  },
  
  // Specialized transforms
  SPECIALIZED: {
    // Icon to panel transformation
    iconToPanel: (iconPosition) => {
      const panelSize = GEOMETRY.COMPONENTS.SymbolPalette.panel.defaultSize;
      const iconSize = GEOMETRY.COMPONENTS.SymbolPalette.icon.defaultSize;
      
      return {
        x: Math.max(GEOMETRY.DIMENSIONS.VIEWPORT_PADDING, 
                    iconPosition.x - (panelSize.width - iconSize.width) / 2),
        y: Math.max(GEOMETRY.DIMENSIONS.VIEWPORT_PADDING, 
                    iconPosition.y - 20),
        width: panelSize.width,
        height: panelSize.height
      };
    },
    
    // Panel to icon transformation
    panelToIcon: (panelPosition) => {
      const panelSize = GEOMETRY.COMPONENTS.SymbolPalette.panel.defaultSize;
      const iconSize = GEOMETRY.COMPONENTS.SymbolPalette.icon.defaultSize;
      
      return {
        x: panelPosition.x + (panelSize.width - iconSize.width) / 2,
        y: panelPosition.y + 20,
        width: iconSize.width,
        height: iconSize.height
      };
    },
    
    // Resize handle positions - FIXED: Keep handles within display boundaries
    calculateResizeHandles: (bounds) => {
      const handleSize = GEOMETRY.DIMENSIONS.HANDLE_SIZE;
      
      return {
        nw: { x: 0, y: 0, cursor: 'nw-resize' },
        n: { x: bounds.width / 2 - handleSize / 2, y: 0, cursor: 'n-resize' },
        ne: { x: bounds.width - handleSize, y: 0, cursor: 'ne-resize' },
        e: { x: bounds.width - handleSize, y: bounds.height / 2 - handleSize / 2, cursor: 'e-resize' },
        se: { x: bounds.width - handleSize, y: bounds.height - handleSize, cursor: 'se-resize' },
        s: { x: bounds.width / 2 - handleSize / 2, y: bounds.height - handleSize, cursor: 's-resize' },
        sw: { x: 0, y: bounds.height - handleSize, cursor: 'sw-resize' },
        w: { x: 0, y: bounds.height / 2 - handleSize / 2, cursor: 'w-resize' }
      };
    }
  }
};

// Default configurations - FIXED: Use correct canvas height matching design intent
const defaultConfig = {
  visualizationsContentWidth: 220,
  meterHeight: 120, // ✅ FIXED: Canvas height (120px design intent - was 80px)
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

// Load workspace settings from localStorage
const savedWorkspaceSettings = loadWorkspaceSettings();

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
  
  // Drag state
  draggedItem: { type: null, id: null, offset: { x: 0, y: 0 } },
  
  // Canvas workspace settings (NEW) - loaded from localStorage
  workspaceSettings: savedWorkspaceSettings,
  
  // Resize state (NEW)
  resizeState: {
    isResizing: false,
    displayId: null,
    handleType: null, // 'nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'
    startPosition: { x: 0, y: 0 },
    startSize: { width: 0, height: 0 },
    startMousePos: { x: 0, y: 0 }
  }
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

// Export GEOMETRY foundation for component access
export { GEOMETRY };

// =============================================================================
// UNIFIED GEOMETRY ACTIONS
// =============================================================================

// Utility functions for geometry actions
const getComponent = (store, id) => {
  return store.displays.get(id) || store.panels.get(id) || store.icons.get(id);
};

const getAllComponents = (store) => {
  const allComponents = new Map();
  store.displays.forEach((display, id) => {
    allComponents.set(id, { ...display, type: 'FloatingDisplay', size: { 
      width: display.config.visualizationsContentWidth, 
      height: display.config.meterHeight + GEOMETRY.DIMENSIONS.HEADER_HEIGHT 
    }});
  });
  store.panels.forEach((panel, id) => {
    allComponents.set(id, { ...panel, type: panel.type, size: { 
      width: panel.config.width || GEOMETRY.COMPONENTS.SymbolPalette.panel.defaultSize.width,
      height: panel.config.height || GEOMETRY.COMPONENTS.SymbolPalette.panel.defaultSize.height
    }});
  });
  store.icons.forEach((icon, id) => {
    allComponents.set(id, { ...icon, type: icon.type, size: GEOMETRY.COMPONENTS.SymbolPalette.icon.defaultSize });
  });
  return allComponents;
};

const getDefaultSize = (componentType, state = 'default') => {
  const componentConfig = GEOMETRY.COMPONENTS[componentType];
  if (typeof componentConfig === 'object' && !componentConfig.defaultSize) {
    return componentConfig[state]?.defaultSize || componentConfig.default?.defaultSize || componentConfig.defaultSize;
  }
  return componentConfig.defaultSize;
};

const updateComponentInStore = (store, id, position, size) => {
  const component = getComponent(store, id);
  if (!component) return store;
  
  if (store.displays.has(id)) {
    const newDisplays = new Map(store.displays);
    newDisplays.set(id, {
      ...component,
      position,
      config: {
        ...component.config,
        visualizationsContentWidth: size.width,
        meterHeight: size.height - GEOMETRY.DIMENSIONS.HEADER_HEIGHT
      }
    });
    return { ...store, displays: newDisplays };
  } else if (store.panels.has(id)) {
    const newPanels = new Map(store.panels);
    newPanels.set(id, {
      ...component,
      position,
      config: {
        ...component.config,
        width: size.width,
        height: size.height
      }
    });
    return { ...store, panels: newPanels };
  } else if (store.icons.has(id)) {
    const newIcons = new Map(store.icons);
    newIcons.set(id, {
      ...component,
      position,
      size
    });
    return { ...store, icons: newIcons };
  }
  
  return store;
};

const generateComponentId = (type) => {
  return `${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
};

const createComponentObject = (id, type, symbol, position, size) => {
  const baseComponent = {
    id,
    type,
    position,
    size,
    zIndex: 1,
    isActive: false,
    createdAt: Date.now()
  };
  
  if (type === 'FloatingDisplay') {
    return {
      ...baseComponent,
      symbol,
      config: { 
        visualizationsContentWidth: size.width,
        meterHeight: size.height - GEOMETRY.DIMENSIONS.HEADER_HEIGHT,
        flashIntensity: 0.3
      },
      state: {
        ready: false,
        currentPrice: 0,
        projectedAdrHigh: 0,
        projectedAdrLow: 0,
        visualHigh: 0,
        visualLow: 0,
        volatility: 0
      }
    };
  }
  
  return baseComponent;
};

const addComponentToStore = (store, component) => {
  if (component.type === 'FloatingDisplay') {
    const newDisplays = new Map(store.displays);
    newDisplays.set(component.id, {
      ...component,
      zIndex: store.nextDisplayZIndex++
    });
    return { 
      ...store, 
      displays: newDisplays, 
      activeDisplayId: component.id,
      nextDisplayZIndex: store.nextDisplayZIndex
    };
  } else if (component.type === 'SymbolPalette') {
    const newPanels = new Map(store.panels);
    newPanels.set(component.id, {
      ...component,
      zIndex: store.nextPanelZIndex++
    });
    return { 
      ...store, 
      panels: newPanels,
      nextPanelZIndex: store.nextPanelZIndex
    };
  }
  
  return store;
};

const getStore = () => {
  let currentStore;
  floatingStore.subscribe(store => currentStore = store)();
  return currentStore;
};

export const geometryActions = {
  // SIMPLISTIC: One action for all geometry updates
  updateGeometry: (id, positionUpdate = {}, sizeUpdate = {}, options = {}) => {
    return floatingStore.update(store => {
      const component = getComponent(store, id);
      if (!component) return store;
      
      const currentPosition = component.position || { x: 0, y: 0 };
      const currentSize = component.size || getDefaultSize(component.type, component.state);
      
      const newPosition = { ...currentPosition, ...positionUpdate };
      const newSize = { ...currentSize, ...sizeUpdate };
      
      // EFFICIENT: Use unified transform pipeline
      const transforms = GEOMETRY.TRANSFORMS.applyTransforms(
        newPosition, 
        newSize, 
        component.type, 
        component.state, 
        options
      );
      
      // MAINTAINABLE: Single update path
      return updateComponentInStore(store, id, transforms.position, transforms.size);
    });
  },
  
  // Create component with automatic positioning
  createComponent: (type, symbol, options = {}) => {
    return floatingStore.update(store => {
      const componentConfig = GEOMETRY.COMPONENTS[type];
      const defaultSize = componentConfig.defaultSize || componentConfig.default?.defaultSize;
      
      const size = { ...defaultSize };
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      
      // Find safe position if not specified
      const position = options.position || 
        GEOMETRY.EDGES.findSafePosition(size, getAllComponents(store), viewport);
      
      // Apply transforms
      const transforms = GEOMETRY.TRANSFORMS.applyTransforms(
        position, size, type, options.state, options
      );
      
      // Create component
      const id = generateComponentId(type);
      const component = createComponentObject(id, type, symbol, transforms.position, transforms.size);
      
      return addComponentToStore(store, component);
    });
  },
  
  // Get component geometry
  getGeometry: (id) => {
    const store = getStore();
    const component = getComponent(store, id);
    if (!component) return null;
    
    return {
      id,
      type: component.type,
      state: component.state || 'default',
      position: component.position,
      size: component.size,
      edges: GEOMETRY.EDGES.calculate(component.position, component.size),
      constraints: GEOMETRY.COMPONENTS[component.type]
    };
  },
  
  // Debug and validation
  explainGeometry: (id) => {
    const geometry = geometryActions.getGeometry(id);
    if (!geometry) return null;
    
    return {
      ...geometry,
      explanation: `Component ${geometry.type} at (${geometry.position.x}, ${geometry.position.y}) with size ${geometry.size.width}×${geometry.size.height}`,
      bounds: `Spans from (${geometry.edges.left}, ${geometry.edges.top}) to (${geometry.edges.right}, ${geometry.edges.bottom})`,
      constraints: `Constraints: ${JSON.stringify(geometry.constraints)}`
    };
  },
  
  // Validate geometry integrity
  validateGeometry: (id) => {
    const geometry = geometryActions.getGeometry(id);
    if (!geometry) return { valid: false, errors: ['Component not found'] };
    
    const errors = [];
    const warnings = [];
    
    // Check viewport bounds
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    if (geometry.edges.right > viewport.width || geometry.edges.bottom > viewport.height) {
      warnings.push('Component extends beyond viewport');
    }
    
    // Check size constraints
    const constraints = GEOMETRY.COMPONENTS[geometry.type];
    const minSize = constraints.minSize || constraints.default?.minSize;
    if (minSize) {
      if (geometry.size.width < minSize.width) {
        errors.push(`Width ${geometry.size.width} below minimum ${minSize.width}`);
      }
      if (geometry.size.height < minSize.height) {
        errors.push(`Height ${geometry.size.height} below minimum ${minSize.height}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      geometry
    };
  }
};

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
      } else if (type === 'icon') {
        const newIcons = new Map(store.icons);
        const icon = newIcons.get(id);
        if (icon) {
          newIcons.set(id, { ...icon, position });
        }
        return { ...store, icons: newIcons };
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

  // Icon operations (NEW)
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

  // Icon expansion/collapse operations
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

  // Link icon to panel
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

  // Workspace settings operations (NEW)
  updateWorkspaceSettings: (settings) => {
    floatingStore.update(store => {
      const newSettings = { ...store.workspaceSettings, ...settings };
      
      // Auto-save to localStorage
      workspaceSettingsAutoSaver.save(newSettings);
      
      return {
        ...store,
        workspaceSettings: newSettings
      };
    });
  },

  // Display resize operations (NEW)
  resizeDisplay: (id, width, height) => {
    floatingStore.update(store => {
      const newDisplays = new Map(store.displays);
      const display = newDisplays.get(id);
      if (display) {
        newDisplays.set(id, {
          ...display,
          config: {
            ...display.config,
            visualizationsContentWidth: width,
            meterHeight: height
          }
        });
      }
      return { ...store, displays: newDisplays };
    });
  },

  // Resize state management (NEW)
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

      // ✅ FIXED: Use consistent minimum sizes from GEOMETRY foundation
      const MIN_WIDTH = GEOMETRY.COMPONENTS.FloatingDisplay.defaultSize.width;   // 240px
      const MIN_HEIGHT = GEOMETRY.COMPONENTS.FloatingDisplay.defaultSize.height;  // 160px
      
      console.log(`[RESIZE_DEBUG] ${handleType} resize:`, {
        startSize, startMousePos, mousePos, deltaX, deltaY
      });
      
      // Calculate new dimensions based on handle type
      switch (handleType) {
        case 'e': // East - resize width only
          newWidth = Math.max(MIN_WIDTH, startSize.width + deltaX);
          break;
        case 'w': // West - resize width and move position
          newWidth = Math.max(MIN_WIDTH, startSize.width - deltaX);
          newPosition.x = startPosition.x + (startSize.width - newWidth);
          break;
        case 's': // South - resize height only
          newHeight = Math.max(MIN_HEIGHT, startSize.height + deltaY);
          break;
        case 'n': // North - resize height and move position
          newHeight = Math.max(MIN_HEIGHT, startSize.height - deltaY);
          newPosition.y = startPosition.y + (startSize.height - newHeight);
          break;
        case 'se': // Southeast - resize width and height
          newWidth = Math.max(MIN_WIDTH, startSize.width + deltaX);
          newHeight = Math.max(MIN_HEIGHT, startSize.height + deltaY);
          break;
        case 'sw': // Southwest - resize width/height and move position
          newWidth = Math.max(MIN_WIDTH, startSize.width - deltaX);
          newHeight = Math.max(MIN_HEIGHT, startSize.height + deltaY);
          newPosition.x = startPosition.x + (startSize.width - newWidth);
          break;
        case 'ne': // Northeast - resize width/height and move position
          newWidth = Math.max(MIN_WIDTH, startSize.width + deltaX);
          newHeight = Math.max(MIN_HEIGHT, startSize.height - deltaY);
          newPosition.y = startPosition.y + (startSize.height - newHeight);
          break;
        case 'nw': // Northwest - resize width/height and move position
          newWidth = Math.max(MIN_WIDTH, startSize.width - deltaX);
          newHeight = Math.max(MIN_HEIGHT, startSize.height - deltaY);
          newPosition.x = startPosition.x + (startSize.width - newWidth);
          newPosition.y = startPosition.y + (startSize.height - newHeight);
          break;
      }
      
      console.log(`[RESIZE_DEBUG] ${handleType} result:`, {
        newWidth, newHeight, newPosition
      });

      // ✅ DISABLED: Grid snap completely bypassed for troubleshooting - causes massive jumps
      // if (store.workspaceSettings.gridSnapEnabled) {
      //   const gridSize = store.workspaceSettings.gridSize;
      //   newPosition.x = Math.round(newPosition.x / gridSize) * gridSize;
      //   newPosition.y = Math.round(newPosition.y / gridSize) * gridSize;
      //   // ✅ FIXED: Don't snap size during resize - causes massive jumps
      // }

      // Apply viewport boundary constraints for resize
      const maxX = window.innerWidth - newWidth;
      const maxY = window.innerHeight - newHeight;
      newPosition.x = Math.max(0, Math.min(newPosition.x, maxX));
      newPosition.y = Math.max(0, Math.min(newPosition.y, maxY));

      // Update display size and position
      const newDisplays = new Map(store.displays);
      const display = newDisplays.get(displayId);
      if (display) {
        // Update canvas dimensions (subtract header height for canvas)
        const canvasHeight = Math.max(120, newHeight - 40); // ✅ FIXED: Use correct minimum canvas height
        newDisplays.set(displayId, {
          ...display,
          position: newPosition,
          config: {
            ...display.config,
            visualizationsContentWidth: newWidth,
            meterHeight: canvasHeight
          }
        });
      }

      return { ...store, displays: newDisplays };
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
  },

  // Grid snap utility (NEW)
  snapToGrid: (position, gridSize = 8) => {
    return {
      x: Math.round(position.x / gridSize) * gridSize,
      y: Math.round(position.y / gridSize) * gridSize
    };
  },

  // Collision detection (FIXED) - Use GEOMETRY.EDGES for ALL calculations
  checkCollision: (displayId, position, size, allDisplays) => {
    // Use GEOMETRY.EDGES.calculate for consistent edge calculations
    const testEdges = GEOMETRY.EDGES.calculate(position, size);

    for (const [id, display] of allDisplays) {
      if (id === displayId) continue;

      // ✅ FIXED: Use FULL CONTAINER dimensions for collision detection (240×160px)
      // This includes header, borders, padding - the entire visual frame users see
      const displaySize = {
        width: GEOMETRY.COMPONENTS.FloatingDisplay.defaultSize.width,   // 240px - full container width
        height: GEOMETRY.COMPONENTS.FloatingDisplay.defaultSize.height  // 160px - full container height
      };
      
      // Use GEOMETRY.EDGES.calculate for the other display too
      const displayEdges = GEOMETRY.EDGES.calculate(display.position, displaySize);

      // Use GEOMETRY.EDGES.checkCollision for consistent detection
      if (GEOMETRY.EDGES.checkCollision(position, size, display.position, displaySize)) {
        return true; // Collision detected
      }
    }

    return false; // No collision
  },

  // ✅ REMOVED: Simple move without collision detection - user requested removal
  moveDisplayWithCollision: (id, newPosition) => {
    floatingStore.update(store => {
      const newDisplays = new Map(store.displays);
      const display = newDisplays.get(id);
      
      if (!display) return store;

      // ✅ REMOVED: No collision detection - just apply viewport constraints
      const displaySize = {
        width: GEOMETRY.COMPONENTS.FloatingDisplay.defaultSize.width,   // 240px - full container width
        height: GEOMETRY.COMPONENTS.FloatingDisplay.defaultSize.height  // 160px - full container height
      };

      // Apply viewport boundary constraints using GEOMETRY.TRANSFORMS
      const constrainedPosition = GEOMETRY.TRANSFORMS.constrainToViewport(newPosition, displaySize);

      // Apply the move - NO COLLISION DETECTION
      newDisplays.set(id, { ...display, position: constrainedPosition });
      return { ...store, displays: newDisplays };
    });
  },

  // NEW: Enhanced geometry update action for demo component
  updateGeometry: (id, positionUpdate = {}, sizeUpdate = {}) => {
    return floatingStore.update(store => {
      const component = getComponent(store, id);
      if (!component) return store;
      
      const currentPosition = component.position || { x: 0, y: 0 };
      const currentSize = component.size || getDefaultSize(component.type, component.state);
      
      const newPosition = { ...currentPosition, ...positionUpdate };
      const newSize = { ...currentSize, ...sizeUpdate };
      
      // Update component in store
      return updateComponentInStore(store, id, newPosition, newSize);
    });
  }
};
