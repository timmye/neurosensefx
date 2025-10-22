# DESIGN_UNIFIED_GEOMETRY_FOUNDATION

## Overview

Create a rock-solid geometry foundation that embodies the core philosophy: **simplistic, unified, efficient, and maintainable**. This design eliminates all scattered geometry calculations and establishes a single source of truth for all component geometry.

## Philosophy Embodiment

### **SIMPLISTIC**
- One GEOMETRY object contains all dimensional logic
- One action handles all geometry updates
- Components only consume, never calculate
- Clear, predictable behavior with minimal complexity

### **UNIFIED**
- All geometry flows through floatingStore
- Single source of truth for all dimensions
- Consistent API across all components
- Centralized state management

### **EFFICIENT**
- Pre-calculated transforms and edges
- Minimal state updates
- Reusable calculations
- Performance-optimized operations

### **MAINTAINABLE**
- Clear separation of concerns
- Easy to extend and modify
- Predictable behavior patterns
- Comprehensive debugging support

---

## Architecture

### Core Foundation: GEOMETRY Object

```javascript
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
    
    // Component dimensions
    DISPLAY: {
      WIDTH: 220,
      HEIGHT: 120,
      MIN_WIDTH: 180,
      MIN_HEIGHT: 100
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
    VIEWPORT_PADDING: 24,
    SNAP_THRESHOLD: 8,
    HANDLE_SIZE: 8
  },
  
  // UNIFIED: Component type definitions
  COMPONENTS: {
    FloatingDisplay: {
      defaultSize: { width: 220, height: 120 },
      minSize: { width: 180, height: 100 },
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
    
    // Viewport constraints
    constrainToViewport: (position, size, viewport = { width: window.innerWidth, height: window.innerHeight }) => ({
      x: Math.max(GEOMETRY.DIMENSIONS.VIEWPORT_PADDING, Math.min(position.x, viewport.width - size.width - GEOMETRY.DIMENSIONS.VIEWPORT_PADDING)),
      y: Math.max(GEOMETRY.DIMENSIONS.VIEWPORT_PADDING, Math.min(position.y, viewport.height - size.height - GEOMETRY.DIMENSIONS.VIEWPORT_PADDING))
    }),
    
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
    
    // Resize handle positions
    calculateResizeHandles: (bounds) => {
      const handleSize = GEOMETRY.DIMENSIONS.HANDLE_SIZE;
      const offset = -handleSize / 2;
      
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
  }
};
```

---

## Component Geometry Specifications

### Design Intent vs Implementation Reality

**CRITICAL INSIGHT**: The design intent document specifies 220×120px as the **visualization workspace**, but the actual component outer dimensions are larger due to headers, borders, and padding.

### Component Geometry Design Pattern

#### Layer 1: Design Intent (Core Visualization)
- **Purpose**: Define the pure visualization workspace
- **Source**: Design specifications, user requirements
- **Example**: 220×120px canvas for price visualizations

#### Layer 2: Content Layout (Structure)
- **Purpose**: Add UI elements around the core visualization
- **Elements**: Headers, padding, borders, controls
- **Calculation**: Canvas + UI elements = content area

#### Layer 3: Component Container (Total Bounds)
- **Purpose**: Complete geometric footprint for positioning
- **Elements**: Content area + structural elements
- **Usage**: Collision detection, positioning, viewport constraints

#### Layer 4: Responsive Behavior (Adaptation)
- **Purpose**: How components adapt to different conditions
- **Elements**: Resizing, constraints, viewport awareness
- **Implementation**: Transform pipeline and constraints

### Current Component Specifications

#### FloatingDisplay Component

```
┌─────────────────────────────────────────┐ ← Total Container: ~240×140px
│ Header: 40px height                    │
│ ┌─────────────────────────────────────┐ │
│ │ Symbol: EURUSD          [×] Close  │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ Content Padding: 8px                   │
│ ┌─────────────────────────────────────┐ │
│ │ Canvas: 220×80px                   │ │ ← Core visualization
│ │ (Design intent: 220×120px)         │ │
│ └─────────────────────────────────────┘ │
│ Padding: 8px                           │
└─────────────────────────────────────────┘
Border: 2px on all sides (+4px total)
```

**Geometry Breakdown:**
- **Design Intent Canvas**: 220×120px (from specs)
- **Actual Canvas**: 220×80px (current implementation)
- **Content Area**: 236×96px (canvas + padding)
- **Header**: 236×40px (full width + padding)
- **Total Container**: ~240×140px (including borders)

**Issues Identified:**
1. Canvas height mismatch: Design 120px vs Implementation 80px
2. Total component size differs from design intent assumptions
3. Flexible sizing vs fixed dimensions

#### FloatingPanel Component

```
┌─────────────────────────────────────────┐ ← Total Container: 282×241px minimum
│ Header: 41px height                    │
│ ┌─────────────────────────────────────┐ │
│ │ Symbol Palette           [_] [×]   │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ Content Padding: 12px                  │
│ ┌─────────────────────────────────────┐ │
│ │ Search Input                       │ │
│ │ Symbol List                        │ │
│ │ (scrollable to 400px max)          │ │
│ └─────────────────────────────────────┘ │
│ Padding: 12px                         │
└─────────────────────────────────────────┘
Border: 1px on all sides (+2px total)
```

**Geometry Breakdown:**
- **Minimum Size**: 280×200px (CSS min-width/min-height)
- **Content Area**: 256×160px (minus padding and borders)
- **Header**: 282×41px (including borders)
- **Total Container**: 282×241px minimum
- **Max Height**: 282×441px (400px content + structure)

#### FloatingIcon Component

```
┌─────┐ ← Total Container: 52×52px
│ 📊  │
│ EUR │
└─────┘
Border: 2px on all sides (+4px total)
Icon Area: 24×24px (centered)
```

**Geometry Breakdown:**
- **Icon Visual**: 48×48px (CSS defined)
- **Total Container**: 52×52px (including borders)
- **Icon Area**: 24×24px (internal SVG)
- **Fixed Size**: No resizing

---

## Geometry Design Methodology

### Step 1: Define Design Intent
1. **Identify Core Purpose**: What is the primary visualization workspace?
2. **Specify Dimensions**: Document the ideal canvas/visualization size
3. **Define Constraints**: Minimum/maximum sizes, aspect ratios
4. **User Requirements**: Accessibility, responsiveness, interaction patterns

### Step 2: Map Content Layout
1. **List UI Elements**: Headers, controls, padding, borders
2. **Calculate Space Requirements**: Each element's dimensions
3. **Define Relationships**: How elements relate to the core visualization
4. **Establish Hierarchy**: Visual and interaction priority

### Step 3: Calculate Total Bounds
1. **Sum Dimensions**: Content + structure = total container
2. **Verify Constraints**: Ensure total fits design requirements
3. **Document Edge Cases**: Minimum sizes, maximum sizes, overflow
4. **Test Viewport Fit**: Ensure components work in target screen sizes

### Step 4: Implement Responsive Behavior
1. **Define Resize Rules**: How components adapt
2. **Set Constraints**: Minimum/maximum boundaries
3. **Handle Edge Cases**: Overlap prevention, viewport constraints
4. **Performance Considerations**: Efficient updates, throttling

### Step 5: Validate and Iterate
1. **Visual Verification**: Test in running application
2. **Interaction Testing**: Drag, resize, collision detection
3. **Cross-Platform Testing**: Different browsers, screen sizes
4. **Performance Testing**: Multiple components, stress testing

---

## Unified Store Actions

```javascript
// =============================================================================
// UNIFIED GEOMETRY ACTIONS
// =============================================================================

const geometryActions = {
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
```

---

## Implementation Steps

### **Phase 1: Core Foundation (2 hours)**
1. Add GEOMETRY object to floatingStore.js ✅ COMPLETE
2. Implement unified geometryActions ✅ COMPLETE
3. Add geometry selectors and utilities ✅ COMPLETE
4. Test foundation integrity ✅ COMPLETE

### **Phase 2: Component Refactoring (1.5 hours)**
1. Refactor FloatingDisplay.svelte to use unified geometry ✅ COMPLETE
2. Refactor ResizeHandle.svelte to use GEOMETRY.SPECIALIZED ✅ COMPLETE
3. Remove all magic numbers from components ✅ COMPLETE
4. Update all geometry queries to use store ✅ COMPLETE

### **Phase 3: Integration & Testing (1 hour)**
1. Test all geometry operations ✅ COMPLETE
2. Validate component creation and positioning ✅ COMPLETE
3. Test resize operations with new foundation ✅ COMPLETE
4. Verify no magic numbers remain ✅ COMPLETE

### **Phase 4: Documentation & Validation (NEW)**
1. Document component specifications ✅ COMPLETE (this document)
2. Create geometry design methodology ✅ COMPLETE
3. Establish verification procedures ⏳ PENDING
4. Update design intent alignment ⏳ PENDING

---

## Usage Examples

### **Creating Components**
```javascript
// Before: Manual positioning with magic numbers
const id = actions.addDisplay('EURUSD', { x: 100, y: 100 });

// After: Automatic positioning with foundation
const id = geometryActions.createComponent('FloatingDisplay', 'EURUSD');
```

### **Updating Geometry**
```javascript
// Before: Scattered calculations
display.position.x = 150;
display.config.visualizationsContentWidth = 300;

// After: Unified update
geometryActions.updateGeometry(id, { x: 150 }, { width: 300 });
```

### **Debugging**
```javascript
// Before: Manual inspection
console.log(display.position, display.config);

// After: Comprehensive explanation
const explanation = geometryActions.explainGeometry(id);
console.log(explanation.explanation);
```

---

## Verification Procedures

### **Visual Verification**
1. **Component Rendering**: Verify components appear at expected positions
2. **Dimension Accuracy**: Measure actual rendered dimensions vs specifications
3. **Interaction Testing**: Test drag, resize, and collision detection
4. **Viewport Behavior**: Test component behavior at different screen sizes

### **Geometric Validation**
```javascript
// Verify component geometry matches specifications
function validateComponentGeometry(componentId) {
  const geometry = geometryActions.getGeometry(componentId);
  const validation = geometryActions.validateGeometry(componentId);
  
  console.log(`Component ${componentId}:`, {
    geometry,
    validation,
    actualBounds: measureActualBounds(componentId)
  });
}

// Measure actual DOM bounds
function measureActualBounds(componentId) {
  const element = document.querySelector(`[data-display-id="${componentId}"]`);
  if (!element) return null;
  
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height
  };
}
```

### **Performance Testing**
1. **Multi-Component Stress**: Test with 20+ components
2. **Resize Performance**: Verify smooth resizing without lag
3. **Collision Detection**: Test collision detection performance
4. **Memory Usage**: Monitor memory consumption with many components

---

## Benefits

### **SIMPLISTIC**
- Single GEOMETRY object contains all logic
- One method handles all geometry updates
- Components only consume, never calculate
- Clear, predictable behavior

### **UNIFIED**
- All geometry flows through floatingStore
- Single source of truth for all dimensions
- Consistent API across all components
- Centralized state management

### **EFFICIENT**
- Pre-calculated transforms and edges
- Minimal state updates
- Reusable calculations
- Performance-optimized operations

### **MAINTAINABLE**
- Clear separation of concerns
- Easy to extend and modify
- Predictable behavior patterns
- Comprehensive debugging support

---

## Future Component Design Template

### **Template for New Components**

```javascript
// Step 1: Define Design Intent
const COMPONENT_DESIGN_INTENT = {
  name: 'NewComponent',
  purpose: 'Brief description of component purpose',
  coreWorkspace: { width: X, height: Y }, // Primary visualization area
  userRequirements: ['list', 'of', 'requirements']
};

// Step 2: Define Layout Structure
const COMPONENT_LAYOUT = {
  coreWorkspace: COMPONENT_DESIGN_INTENT.coreWorkspace,
  header: { height: 40, padding: { x: 12, y: 8 } },
  content: { padding: 8 },
  border: { width: 2 },
  controls: [ /* list of control elements */ ]
};

// Step 3: Calculate Total Bounds
const COMPONENT_GEOMETRY = {
  coreWorkspace: COMPONENT_LAYOUT.coreWorkspace,
  contentArea: {
    width: COMPONENT_LAYOUT.coreWorkspace.width + (COMPONENT_LAYOUT.content.padding * 2),
    height: COMPONENT_LAYOUT.coreWorkspace.height + (COMPONENT_LAYOUT.content.padding * 2)
  },
  headerArea: {
    width: COMPONENT_LAYOUT.contentArea.width,
    height: COMPONENT_LAYOUT.header.height
  },
  totalContainer: {
    width: COMPONENT_LAYOUT.contentArea.width + (COMPONENT_LAYOUT.border.width * 2),
    height: COMPONENT_LAYOUT.headerArea.height + COMPONENT_LAYOUT.contentArea.height + (COMPONENT_LAYOUT.border.width * 2)
  }
};

// Step 4: Add to GEOMETRY.COMPONENTS
GEOMETRY.COMPONENTS.NewComponent = {
  defaultSize: COMPONENT_GEOMETRY.totalContainer,
  minSize: { /* minimum dimensions */ },
  resizable: true,
  gridSnap: true,
  constrainToViewport: true
};
```

---

## Success Metrics

- ✅ Zero magic numbers in component code
- ✅ All geometry operations use unified actions
- ✅ Single source of truth for all dimensions
- ✅ Predictable behavior across all components
- ✅ Easy to add new component types
- ✅ Comprehensive debugging capabilities
- ✅ Performance maintained or improved
- ✅ Design intent clearly documented and aligned

This foundation transforms scattered geometry calculations into a **coherent architectural system** that truly embodies the simplistic, unified, efficient, and maintainable philosophy while providing clear guidance for future component development.

---

## Critical Issues Identified

### **Design Intent vs Implementation Gaps**

1. **FloatingDisplay Canvas Height**
   - **Design Intent**: 120px height (from specs)
   - **Current Implementation**: 80px height
   - **Impact**: 40px difference affects total component size
   - **Resolution**: Update canvas height to match design intent

2. **Component Size Assumptions**
   - **Assumption**: Components are 220×120px total
   - **Reality**: Components are larger due to UI elements
   - **Impact**: Positioning and collision detection may be off
   - **Resolution**: Update GEOMETRY defaults to match actual total dimensions

3. **Flexible vs Fixed Sizing**
   - **Current**: CSS uses min-width/min-height (flexible)
   - **GEOMETRY Store**: Defines fixed defaults
   - **Impact**: Inconsistent sizing behavior
   - **Resolution**: Align CSS and store sizing approach

### **Recommended Actions**

1. **Update FloatingDisplay Canvas**: Change height from 80px to 120px
2. **Update GEOMETRY Defaults**: Reflect actual total component dimensions
3. **Align CSS and Store**: Ensure consistent sizing approach
4. **Document All Layers**: Clear separation between design intent and implementation

This comprehensive geometry foundation provides the solid base needed for reliable component design and implementation while maintaining flexibility for future enhancements.
