# DESIGN_FLOATING_STORE_GEOMETRY_DETERMINISM

## Overview

Add geometry determinism to the existing `floatingStore` using a simple 0,0 origin foundation. Each component has a clear top-left corner position and total dimensions, eliminating magic numbers and providing predictable component geometry without creating a separate store.

## Problem

Components have scattered geometry calculations:
```javascript
height: (config.meterHeight || 120) + 40 // Add header height (~40px)
```

Magic numbers, ad-hoc positioning, and no single source of truth for component geometry.

## Solution

Extend `floatingStore.js` with 0,0 origin-based geometry management. Every component has:
- **position**: Top-left corner coordinates (x, y)
- **size**: Total dimensions (width, height)
- **state**: Current visual state (icon, panel, default, etc.)

---

## Foundation: 0,0 Origin System

### Core Principle
Every component is defined by its top-left corner position and total size:

```javascript
component = {
  position: { x: 100, y: 50 },    // Top-left corner from viewport 0,0
  size: { width: 220, height: 120 }, // Total dimensions
  state: 'default'                 // Visual state
}
```

### Benefits
- **Unambiguous**: No center-point or middle calculations
- **Deterministic**: Same input always produces same output
- **Calculable**: Simple addition/subtraction for all geometry
- **Debuggable**: "Component at (100, 50) is 220×120" is clear

---

## Architecture

### floatingStore.js Enhancement

```javascript
// =============================================================================
// GEOMETRY SECTION - Add to existing floatingStore.js
// =============================================================================

// Section 1: DIMENSIONS - All sizes defined once
const DIMENSIONS = {
  // Base unit (8px grid system)
  GRID_UNIT: 8,
  
  // Component sizes
  HEADER_HEIGHT: 40,
  ICON_SIZE: 48,
  BORDER_WIDTH: 2,
  PADDING: 8,
  
  // Display defaults
  DISPLAY_WIDTH: 220,
  DISPLAY_HEIGHT: 120,
  DISPLAY_MIN_WIDTH: 180,
  DISPLAY_MIN_HEIGHT: 100,
  
  // Panel defaults
  PANEL_WIDTH: 300,
  PANEL_HEIGHT: 400,
  PANEL_MIN_WIDTH: 250,
  PANEL_MIN_HEIGHT: 300,
  
  // Layout constants
  VIEWPORT_PADDING: 24,
  SNAP_THRESHOLD: 8,
  ANIMATION_DURATION: 300
};

// Section 2: CONSTRAINTS - Per-component, per-state size rules
const CONSTRAINTS = {
  FloatingDisplay: {
    default: {
      width: DIMENSIONS.DISPLAY_WIDTH,
      height: DIMENSIONS.DISPLAY_HEIGHT,
      minWidth: DIMENSIONS.DISPLAY_MIN_WIDTH,
      minHeight: DIMENSIONS.DISPLAY_MIN_HEIGHT,
      resizable: true,
      gridSnap: true
    }
  },
  
  SymbolPalette: {
    icon: {
      width: DIMENSIONS.ICON_SIZE,
      height: DIMENSIONS.ICON_SIZE,
      resizable: false,
      gridSnap: true
    },
    panel: {
      width: DIMENSIONS.PANEL_WIDTH,
      height: DIMENSIONS.PANEL_HEIGHT,
      minWidth: DIMENSIONS.PANEL_MIN_WIDTH,
      minHeight: DIMENSIONS.PANEL_MIN_HEIGHT,
      resizable: true,
      gridSnap: true
    }
  }
};

// Section 3: TRANSFORMS - 0,0 origin calculations
const TRANSFORMS = {
  // Find safe position for new component (starts at 0,0)
  findSafePosition: (size, existingComponents, viewport) => {
    // TODO: Add proper collision detection if components can overlap
    // Current implementation assumes sequential placement and tries to avoid obvious overlaps
    // Future enhancement: Check actual bounding box intersections
    
    let x = DIMENSIONS.VIEWPORT_PADDING;
    let y = DIMENSIONS.VIEWPORT_PADDING;
    
    // Simple grid placement from top-left
    for (const component of existingComponents.values()) {
      const componentRight = component.position.x + component.size.width;
      const proposedRight = x + size.width;
      
      if (proposedRight + DIMENSIONS.SNAP_THRESHOLD < componentRight) {
        break; // Found empty spot
      }
      
      if (proposedRight > viewport.width - DIMENSIONS.VIEWPORT_PADDING) {
        // Move to next row
        x = DIMENSIONS.VIEWPORT_PADDING;
        y += size.height + DIMENSIONS.SNAP_THRESHOLD;
      } else {
        // Move right in current row
        x = componentRight + DIMENSIONS.SNAP_THRESHOLD;
      }
    }
    
    return { x, y };
  },
  
  // Reusable edge calculation
  calculateEdges: (position, size) => ({
    left: position.x,
    right: position.x + size.width,
    top: position.y,
    bottom: position.y + size.height,
    center: {
      x: position.x + size.width / 2,
      y: position.y + size.height / 2
    }
  }),
  
  // Apply constraints to position and size
  applyConstraints: (position, size, constraints, viewport) => {
    let result = { ...position, ...size };
    
    // Size constraints
    if (constraints.minWidth) result.width = Math.max(result.width, constraints.minWidth);
    if (constraints.minHeight) result.height = Math.max(result.height, constraints.minHeight);
    
    // Viewport constraints (keep within screen)
    const maxX = viewport.width - result.width;
    const maxY = viewport.height - result.height;
    result.x = Math.max(0, Math.min(result.x, maxX));
    result.y = Math.max(0, Math.min(result.y, maxY));
    
    // Grid snap
    if (constraints.gridSnap) {
      result.x = Math.round(result.x / DIMENSIONS.GRID_UNIT) * DIMENSIONS.GRID_UNIT;
      result.y = Math.round(result.y / DIMENSIONS.GRID_UNIT) * DIMENSIONS.GRID_UNIT;
    }
    
    return result;
  },
  
  // Icon to panel transformation (0,0 origin based)
  iconToPanel: (iconPosition) => {
    const panelSize = CONSTRAINTS.SymbolPalette.panel;
    
    return {
      x: Math.max(DIMENSIONS.VIEWPORT_PADDING, 
                  iconPosition.x - (panelSize.width - DIMENSIONS.ICON_SIZE) / 2),
      y: Math.max(DIMENSIONS.VIEWPORT_PADDING, 
                  iconPosition.y - 20), // Slight offset for visual balance
      width: panelSize.width,
      height: panelSize.height
    };
  },
  
  // Panel to icon transformation
  panelToIcon: (panelPosition) => {
    return {
      x: panelPosition.x + (CONSTRAINTS.SymbolPalette.panel.width - DIMENSIONS.ICON_SIZE) / 2,
      y: panelPosition.y + 20,
      width: DIMENSIONS.ICON_SIZE,
      height: DIMENSIONS.ICON_SIZE
    };
  },
  
  // Calculate resize handles positions (all relative to 0,0)
  calculateResizeHandles: (bounds) => {
    const handleSize = 8;
    const offset = -4; // Half handle size extends outside
    
    return {
      nw: { x: offset, y: offset, cursor: 'nw-resize' },
      n: { x: bounds.width / 2 - handleSize / 2, y: offset, cursor: 'n-resize' },
      ne: { x: bounds.width - handleSize + offset, y: offset, cursor: 'ne-resize' },
      e: { x: bounds.width - handleSize + offset, y: bounds.height / 2 - handleSize / 2, cursor: 'e-resize' },
      se: { x: bounds.width - handleSize + offset, y: bounds.height - handleSize + offset, cursor: 'se-resize' },
      s: { x: bounds.width / 2 - handleSize / 2, y: bounds.height - handleSize + offset, cursor: 's-resize' },
      sw: { x: offset, y: bounds.height - handleSize + offset, cursor: 'sw-resize' },
      w: { x: offset, y: bounds.height / 2 - handleSize / 2, cursor: 'w-resize' }
    };
  }
};

// =============================================================================
// ENHANCED ACTIONS - Add to existing actions object
// =============================================================================

// Add to existing actions object:
actions: {
  // ... existing actions ...
  
  // Viewport management
  updateViewport: (dimensions) => {
    floatingStore.update(store => ({
      ...store,
      viewport: dimensions
    }));
  },
  
  // Create display with automatic positioning
  addDisplayAtOrigin: (symbol) => {
    const constraints = CONSTRAINTS.FloatingDisplay.default;
    const size = { width: constraints.width, height: constraints.height };
    const viewport = store.viewport || { width: window.innerWidth, height: window.innerHeight };
    const position = TRANSFORMS.findSafePosition(size, store.displays, viewport);
    const finalBounds = TRANSFORMS.applyConstraints(position, size, constraints, viewport);
    
    return actions.addDisplay(symbol, finalBounds);
  },
  
  // Update component position and size
  updateComponentGeometry: (id, positionUpdate = {}, sizeUpdate = {}) => {
    floatingStore.update(store => {
      const component = store.displays.get(id) || store.panels.get(id);
      if (!component) return store;
      
      const currentPosition = component.position || { x: 0, y: 0 };
      const currentSize = { 
        width: component.config?.visualizationsContentWidth || component.config?.width || 220,
        height: component.config?.meterHeight || component.config?.height || 120
      };
      
      const newPosition = { ...currentPosition, ...positionUpdate };
      const newSize = { ...currentSize, ...sizeUpdate };
      
      // Get constraints based on component type and state
      const constraints = CONSTRAINTS[component.type]?.[component.state] || 
                         CONSTRAINTS[component.type]?.default || 
                         { resizable: true, gridSnap: true };
      
      const viewport = store.viewport || { width: window.innerWidth, height: window.innerHeight };
      const finalBounds = TRANSFORMS.applyConstraints(newPosition, newSize, constraints, viewport);
      
      // Update component
      if (store.displays.has(id)) {
        const newDisplays = new Map(store.displays);
        newDisplays.set(id, {
          ...component,
          position: { x: finalBounds.x, y: finalBounds.y },
          config: {
            ...component.config,
            visualizationsContentWidth: finalBounds.width,
            meterHeight: finalBounds.height - DIMENSIONS.HEADER_HEIGHT
          }
        });
        return { ...store, displays: newDisplays };
      } else if (store.panels.has(id)) {
        const newPanels = new Map(store.panels);
        newPanels.set(id, {
          ...component,
          position: { x: finalBounds.x, y: finalBounds.y },
          config: {
            ...component.config,
            width: finalBounds.width,
            height: finalBounds.height
          }
        });
        return { ...store, panels: newPanels };
      }
      
      return store;
    });
  },
  
  // Symbol palette state transitions
  expandIconToPanel: (iconId) => {
    floatingStore.update(store => {
      const icon = store.icons.get(iconId);
      if (!icon || icon.isExpanded) return store;
      
      const panelBounds = TRANSFORMS.iconToPanel(icon.position);
      
      // Update icon
      const newIcons = new Map(store.icons);
      newIcons.set(iconId, {
        ...icon,
        isExpanded: true,
        panelBounds
      });
      
      // Create/update panel
      const newPanels = new Map(store.panels);
      const panelId = `panel-${iconId}`;
      newPanels.set(panelId, {
        id: panelId,
        type: 'symbol-palette',
        position: { x: panelBounds.x, y: panelBounds.y },
        config: { width: panelBounds.width, height: panelBounds.height },
        isVisible: true,
        state: 'panel'
      });
      
      return { 
        ...store, 
        icons: newIcons, 
        panels: newPanels,
        activeIconId: iconId,
        activePanelId: panelId
      };
    });
  },
  
  collapsePanelToIcon: (panelId) => {
    floatingStore.update(store => {
      const panel = store.panels.get(panelId);
      const iconId = panelId.replace('panel-', '');
      const icon = store.icons.get(iconId);
      
      if (!panel || !icon || !icon.isExpanded) return store;
      
      const iconBounds = TRANSFORMS.panelToIcon(panel.position);
      
      // Update icon position
      const newIcons = new Map(store.icons);
      newIcons.set(iconId, {
        ...icon,
        isExpanded: false,
        position: { x: iconBounds.x, y: iconBounds.y }
      });
      
      // Hide panel
      const newPanels = new Map(store.panels);
      newPanels.set(panelId, { ...panel, isVisible: false });
      
      return { 
        ...store, 
        icons: newIcons, 
        panels: newPanels,
        activeIconId: null,
        activePanelId: null
      };
    });
  },
  
  // Get component geometry for debugging
  explainGeometry: (id) => {
    const component = store.displays.get(id) || store.panels.get(id) || store.icons.get(id);
    if (!component) return null;
    
    const size = component.config?.visualizationsContentWidth ? 
      { width: component.config.visualizationsContentWidth, height: component.config.meterHeight } :
      { width: component.config?.width || component.size?.width || 0, 
        height: component.config?.height || component.size?.height || 0 };
    
    return {
      id,
      type: component.type,
      state: component.state || 'default',
      position: component.position || { x: 0, y: 0 },
      size,
      constraints: CONSTRAINTS[component.type]?.[component.state] || CONSTRAINTS[component.type]?.default,
      edges: TRANSFORMS.calculateEdges(component.position || { x: 0, y: 0 }, size)
    };
  },
  
  // Get resize handle positions
  getResizeHandles: (id) => {
    const component = store.displays.get(id) || store.panels.get(id);
    if (!component) return null;
    
    const size = component.config?.visualizationsContentWidth ? 
      { width: component.config.visualizationsContentWidth, height: component.config.meterHeight + DIMENSIONS.HEADER_HEIGHT } :
      { width: component.config?.width || 0, height: component.config?.height || 0 };
    
    return TRANSFORMS.calculateResizeHandles(size);
  }
}
```

---

## Implementation Steps

### Step 1: Add Enhanced Foundation (1.5 hours)
- Add DIMENSIONS, CONSTRAINTS, TRANSFORMS sections to `floatingStore.js`
- Add viewport state and listener
- Add edge calculation utility

### Step 2: Add Enhanced Actions (1.5 hours)
- Add geometry methods with viewport awareness
- Add collision detection documentation
- Update all transforms to use cached viewport

### Step 3: Migrate Display Creation (1 hour)
Update display creation to use `addDisplayAtOrigin()` instead of manual positioning.

### Step 4: Migrate Resize Handling (2 hours)
Update resize operations to use `updateComponentGeometry()` and `getResizeHandles()`.

### Step 5: Migrate Symbol Palette (2 hours)
Update icon/panel transitions to use the new state management methods.

### Step 6: Test and Validate (1 hour)
Test all positioning, resizing, and state transitions.

---

## Usage Examples

### Creating Components
```javascript
// Before - manual positioning
const id = actions.addDisplay('EURUSD', { x: 100, y: 100 });

// After - automatic positioning
const id = actions.addDisplayAtOrigin('EURUSD');
```

### Updating Geometry
```javascript
// Before - direct manipulation
display.config.visualizationsContentWidth = 300;
display.position.x = 150;

// After - through store
actions.updateComponentGeometry(displayId, 
  { x: 150 }, 
  { width: 300 }
);
```

### Symbol Palette Transitions
```javascript
// Expand icon to panel
actions.expandIconToPanel('symbol-palette-icon');

// Collapse panel to icon
actions.collapsePanelToIcon('panel-symbol-palette-icon');
```

### Debugging
```javascript
const geometry = actions.explainGeometry('display-1');
console.log(`Display at (${geometry.position.x}, ${geometry.position.y}) spans to (${geometry.edges.right}, ${geometry.edges.bottom})`);
```

---

## Benefits

- **0,0 Origin Clarity**: Every component has unambiguous top-left positioning
- **No Magic Numbers**: All sizes defined in DIMENSIONS section
- **Deterministic Behavior**: Same input always produces same geometry
- **Simple Math**: All calculations are basic addition/subtraction
- **Predictable Transitions**: State changes follow clear geometric rules
- **Debuggable**: Can explain any component's geometry instantly
- **Viewport Caching**: Consistent viewport dimensions across calculations
- **Edge Calculations**: Reusable edge calculation utilities

---

## Rules

1. **All components** use 0,0 origin (top-left corner)
2. **All dimensions** come from DIMENSIONS section
3. **All size rules** come from CONSTRAINTS section
4. **All calculations** happen in TRANSFORMS section
5. **Components query** store methods, never calculate directly

---

## Success Metrics

- ✅ Zero magic numbers in component code
- ✅ All positioning uses 0,0 origin system
- ✅ Viewport dimensions cached and consistent
- ✅ Edge calculations reusable and consistent
- ✅ State transitions are mathematically predictable
- ✅ Can explain any component's geometry with one method call
- ✅ New components position intelligently without overlap
- ✅ Clear documentation of collision detection limitations

---

## Future Opportunities

The 0,0 origin geometry foundation enables a range of powerful utilities and enhancements that align with the project's principles of simplicity, determinism, and pragmatic architecture. These opportunities can be pursued incrementally as needs arise.

---

### Category 1: Spatial Intelligence Utilities

#### **Geometry Cache System**
```javascript
// Cache calculated geometry to avoid recalculation
const geometryCache = new Map();

function getCachedGeometry(id, calculateFn) {
  if (!geometryCache.has(id)) {
    geometryCache.set(id, calculateFn());
  }
  return geometryCache.get(id);
}
```
**Value**: Performance optimization without complexity, follows existing caching patterns

#### **Spatial Index for Performance**
```javascript
// Simple grid-based spatial index for fast queries
const spatialIndex = {
  grid: {},
  cellSize: 100, // 100px grid cells
  
  add: (component) => {
    const cellX = Math.floor(component.position.x / cellSize);
    const cellY = Math.floor(component.position.y / cellSize);
    const key = `${cellX},${cellY}`;
    
    if (!grid[key]) grid[key] = [];
    grid[key].push(component.id);
  },
  
  queryNearby: (position, radius) => {
    // O(1) instead of O(n) for collision detection
  }
};
```
**Value**: Enables fast collision detection and spatial queries at scale

#### **Geometry Validation Layer**
```javascript
const geometryValidator = {
  validate: (component) => ({
    isValid: true,
    warnings: [],
    errors: []
  }),
  
  checkViewportBounds: (component, viewport) => {
    // Returns specific boundary violations
  },
  
  checkOverlap: (component1, component2) => {
    // Returns overlap area and severity
  }
};
```
**Value**: Enhanced debugging and error prevention

---

### Category 2: Layout Intelligence

#### **Auto-Arrangement Algorithms**
```javascript
const layoutAlgorithms = {
  cascade: (components, viewport) => {
    // Arrange in diagonal cascade pattern
  },
  
  grid: (components, viewport, cols = 3) => {
    // Arrange in even grid
  },
  
  stack: (components, viewport) => {
    // Stack with slight offsets
  },
  
  register: (name, algorithm) => {
    layoutAlgorithms[name] = algorithm;
  }
};
```
**Value**: Solves workspace organization problems, extensible system

#### **Workspace Templates**
```javascript
const workspaceTemplates = {
  'day-trader': {
    displays: [
      { symbol: 'EURUSD', position: { x: 0, y: 0 }, size: { width: 300, height: 200 } },
      { symbol: 'GBPUSD', position: { x: 320, y: 0 }, size: { width: 300, height: 200 } }
    ],
    panels: [
      { type: 'symbol-palette', position: { x: 20, y: 20 } }
    ]
  },
  
  save: (name, currentLayout) => {
    // Save current workspace as template
  }
};
```
**Value**: User productivity, quick workspace setup

---

### Category 3: Developer Experience Utilities

#### **Geometry Debug Panel**
```javascript
const geometryDebugger = {
  showOverlay: true,
  showOrigins: true,
  showEdges: true,
  showCoordinates: true,
  
  render: (ctx, components) => {
    // Draw debug information on canvas
    // Show 0,0 origins, edges, coordinates
  },
  
  highlightComponent: (id) => {
    // Visual debugging for specific component
  }
};
```
**Value**: Enhanced debugging capabilities, visual feedback

#### **Geometry Test Framework**
```javascript
const geometryTests = {
  testPositioning: (component) => {
    // Test component positioning logic
  },
  
  testConstraints: (component) => {
    // Test constraint enforcement
  },
  
  testTransitions: (fromState, toState) => {
    // Test state transition geometry
  },
  
  runAll: () => {
    // Run all geometry tests
  }
};
```
**Value**: Automated testing, regression prevention

---

### Category 4: Advanced Geometry Concepts

#### **Relative Positioning System**
```javascript
const relativePositioning = {
  positionRightOf: (componentId, targetId, gap = 10) => {
    const target = getComponent(targetId);
    return {
      x: target.position.x + target.size.width + gap,
      y: target.position.y
    };
  },
  
  positionBelow: (componentId, targetId, gap = 10) => {
    const target = getComponent(targetId);
    return {
      x: target.position.x,
      y: target.position.y + target.size.height + gap
    };
  }
};
```
**Value**: Powerful positioning while maintaining 0,0 origin simplicity

#### **Geometry Animation System**
```javascript
const geometryAnimations = {
  animateTo: (componentId, targetGeometry, duration = 300) => {
    // Smooth animation from current to target geometry
  },
  
  animateResize: (componentId, targetSize, duration = 300) => {
    // Smooth resize animation
  },
  
  animateTransform: (componentId, transform, duration = 300) => {
    // Animate state transitions
  }
};
```
**Value**: Enhanced user experience, smooth visual transitions

---

### Category 5: Performance & Optimization

#### **Geometry Batch Updates**
```javascript
const geometryBatch = {
  updates: [],
  
  schedule: (componentId, updateFn) => {
    updates.push({ id: componentId, update: updateFn });
  },
  
  flush: () => {
    // Apply all updates in single render frame
    // Prevents layout thrashing
  }
};
```
**Value**: Performance optimization, prevents layout thrashing

#### **Lazy Geometry Calculation**
```javascript
const lazyGeometry = {
  calculated: new WeakMap(),
  
  get: (component, calculation) => {
    if (!calculated.has(component)) {
      calculated.set(component, calculation(component));
    }
    return calculated.get(component);
  }
};
```
**Value**: On-demand calculation, memory efficiency

---

### Category 6: Integration Opportunities

#### **Geometry + Data Visualization**
```javascript
const vizGeometry = {
  calculateDisplaySize: (data) => {
    // More complex data = larger display
  },
  
  positionRelatedDisplays: (symbols) => {
    // Group related currency pairs
  }
};
```
**Value**: Intelligent layout based on data characteristics

#### **Geometry + User Behavior**
```javascript
const behaviorGeometry = {
  trackUserPositions: () => {
    // Learn where users place components
  },
  
  suggestOptimalLayout: (userPatterns) => {
    // Suggest layouts based on behavior
  }
};
```
**Value**: Adaptive interface, user-centric optimization

---

## Implementation Priority

### **Immediate Impact (Low Effort, High Value)**
1. **Geometry Cache System** - Performance win, simple implementation
2. **Auto-Arrangement Algorithms** - User value, extends existing system
3. **Geometry Debug Panel** - Developer productivity, debugging clarity

### **Medium-term Impact (Medium Effort, High Value)**
1. **Workspace Templates** - User productivity, builds on geometry system
2. **Relative Positioning System** - Developer productivity, maintains simplicity
3. **Geometry Test Framework** - Quality assurance, prevents regressions

### **Future Opportunities (High Effort, High Value)**
1. **Spatial Index** - Performance at scale, enables advanced features
2. **Geometry Animation System** - User experience polish
3. **Behavior Geometry** - Intelligent features, user adaptation

---

## Guiding Principles

All future opportunities should follow these principles:
- **Build on 0,0 origin foundation** - Don't create competing coordinate systems
- **Maintain simplicity** - Add power without complexity
- **Incremental adoption** - Each feature valuable independently
- **Developer experience** - Enhanced debugging and productivity
- **Performance awareness** - Optimize before problems arise

These opportunities represent a roadmap for evolving the geometry system from basic determinism to intelligent spatial management, always building on the solid 0,0 origin foundation.

---

This 0,0 origin foundation provides the geometric determinism you need while maintaining simplicity and building on your proven floatingStore pattern.
