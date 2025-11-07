# Workspace Grid Snapping Design Document

## Executive Summary

This document outlines the implementation of grid snapping functionality for NeuroSense FX workspace canvas floating containers. The system leverages interact.js's built-in snapping capabilities to provide traders with organized workspace layouts while maintaining the high-performance requirements of displaying 20+ simultaneous floating displays.

The implementation focuses on grid snapping as the primary priority, with collision detection as a secondary enhancement phase.

---

## Level 1: Interact.js Integration Strategy

### Core Interact.js Methods for Grid Snapping

#### 1. Snap Modifier (Primary Approach)
**Purpose**: Built-in, performant grid snapping using interact.js's optimized snap system

**Implementation**:
```javascript
interact(element).draggable({
  modifiers: [
    interact.modifiers.snap({
      targets: [
        interact.snappers.grid({ x: 20, y: 20 }) // 20px grid from workspace settings
      ],
      relativePoints: [{ x: 0, y: 0 }], // Snap element's origin
      range: Infinity, // Snap from any distance
      enabled: gridSnapEnabled // Dynamic enable/disable
    })
  ],
  onmove: (event) => {
    // event.rect already includes snapped coordinates
    displayActions.moveDisplay(id, {
      x: event.rect.left,
      y: event.rect.top
    });
  }
});
```

**Benefits**:
- **Performance**: Interact.js handles all math internally
- **Reliability**: Tested snapping algorithms with edge case handling
- **Integration**: Seamless with existing drag/resize setup
- **Flexibility**: Dynamic enable/disable via settings

#### 2. Restrict Modifier with Grid (Secondary Approach)
**Purpose**: Combine boundary constraints with grid snapping

**Implementation**:
```javascript
interact(element).draggable({
  modifiers: [
    interact.modifiers.restrict({
      restriction: {
        x: 0, y: 0, 
        width: window.innerWidth, 
        height: window.innerHeight
      },
      elementRect: { left: 0, top: 0 }
    }),
    interact.modifiers.snap({
      targets: interact.snappers.grid({ x: 20, y: 20 })
    })
  ]
});
```

**Use Case**: Ensures elements stay within viewport while snapping to grid

#### 3. Custom Snap Targets (Advanced Approach)
**Purpose**: Fine-grained control over snap behavior and thresholds

**Implementation**:
```javascript
const gridPoints = [];
for (let x = 0; x < window.innerWidth; x += gridSize) {
  for (let y = 0; y < window.innerHeight; y += gridSize) {
    gridPoints.push({ x, y });
  }
}

interact(element).draggable({
  modifiers: [
    interact.modifiers.snap({
      targets: gridPoints,
      range: snapThreshold // Only snap when within threshold distance
    })
  ]
});
```

**Use Case**: Custom snap ranges and non-uniform grid patterns

### Chosen Implementation Strategy

**Primary**: Snap Modifier with interact.snappers.grid()
- Leverages interact.js optimization
- Minimal code complexity
- Seamless integration with existing setup
- Built-in performance handling

---

## Level 2: Architecture Integration

### Current State Analysis

**Existing Infrastructure**:
- `FloatingDisplay.svelte` already uses interact.js for drag/resize
- `displayStore.js` provides centralized state management
- `workspaceStorage.js` has grid settings defined but not implemented
- Three-layer floating architecture (displays, panels, overlays)

**Missing Components**:
- Actual grid snapping implementation
- Grid configuration management
- Visual feedback system
- Integration with existing interact.js setup

### Integration Points

#### 1. Enhanced FloatingDisplay.svelte
**Current State**: Basic interact.js drag/resize
**Required Enhancement**: Add grid snapping modifier

```javascript
// Current interact.js setup (simplified)
interact(element).draggable({
  onmove: (event) => {
    displayActions.moveDisplay(id, {
      x: event.rect.left,
      y: event.rect.top
    });
  }
});

// Enhanced setup with grid snapping
interact(element).draggable({
  modifiers: [
    interact.modifiers.restrictEdges({
      outer: { 
        left: 0, 
        top: 0, 
        right: window.innerWidth - element.offsetWidth,
        bottom: window.innerHeight - element.offsetHeight
      }
    }),
    // Grid snapping integration
    interact.modifiers.snap({
      targets: [
        interact.snappers.grid({ 
          x: $gridSettings.gridSize, 
          y: $gridSettings.gridSize 
        })
      ],
      relativePoints: [{ x: 0, y: 0 }],
      enabled: $gridSettings.enabled
    })
  ],
  onmove: (event) => {
    // Event.rect includes snapped coordinates
    displayActions.moveDisplay(id, {
      x: event.rect.left,
      y: event.rect.top
    });
  }
});
```

#### 2. Grid Settings Management
**Location**: `src/utils/workspaceGrid.js` (New utility)
**Purpose**: Centralized grid configuration and utilities

```javascript
export class WorkspaceGrid {
  constructor() {
    this.enabled = true;
    this.gridSize = 20;
    this.showGridLines = false;
  }

  /**
   * Get interact.js snap configuration
   * @returns {Array} Interact.js snap targets
   */
  getInteractSnappers() {
    if (!this.enabled) {
      return [];
    }
    
    return [
      interact.snappers.grid({ 
        x: this.gridSize, 
        y: this.gridSize 
      })
    ];
  }

  /**
   * Update grid settings
   * @param {Object} newSettings - Grid configuration
   */
  updateSettings(newSettings) {
    Object.assign(this, newSettings);
    
    // Update all interact.js instances
    this.updateAllInteractInstances();
  }

  /**
   * Check if coordinate is on grid line
   * @param {number} coord - Coordinate to check
   * @returns {boolean} True if on grid line
   */
  isOnGridLine(coord) {
    return coord % this.gridSize === 0;
  }
}
```

#### 3. Enhanced Workspace Storage
**Current State**: Grid settings defined but not fully implemented
**Required Enhancement**: Complete grid settings persistence

```javascript
// Enhanced workspaceStorage.js
const DEFAULT_SETTINGS = {
  gridSnapEnabled: true,        // ✅ Already defined
  gridSize: 20,               // ✅ Already defined
  showGridLines: false,         // ✅ Already defined
  gridOpacity: 0.2,           // 🆕 Visual feedback
  snapThreshold: 10,           // 🆕 Custom snap range
  showGridOnlyOnDrag: true      // 🆕 Performance optimization
};
```

---

## Level 3: User Experience Design

### Grid Snapping Behavior

#### 1. Activation Modes
**Always Active**: Grid snapping always enabled when setting is on
- **Pros**: Consistent behavior, predictable results
- **Cons**: May interfere with fine positioning

**Threshold-Based**: Only snap when close to grid line (within threshold)
- **Pros**: Allows fine positioning, snaps when convenient
- **Cons**: Less predictable, requires custom implementation

**Recommended**: Always active with toggle option
- Matches trading workflow expectations
- Leverages interact.js optimization
- Simple to implement and maintain

#### 2. Visual Feedback Systems

**Grid Lines Overlay**:
```css
.grid-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
  background-image: 
    linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px);
  background-size: 20px 20px;
  opacity: 0.2;
}
```

**Snap Indicators**:
- Brief highlight when element snaps to grid
- Visual confirmation of successful snap
- Color-coded feedback (green = snapped, gray = free)

#### 3. User Controls

**Grid Toggle**: Keyboard shortcut (Ctrl+G) and menu option
**Grid Size Options**: 10px, 20px, 40px presets
**Visual Grid Toggle**: Show/hide grid lines overlay
**Per-Display Override**: Disable grid for specific displays if needed

---

## Level 4: Performance Considerations

### Interact.js Performance Benefits

**Internal Optimization**:
- Efficient snap algorithms
- Minimal DOM manipulation
- Hardware-accelerated transforms
- 60fps target maintenance

**Integration Performance**:
- Leverages existing interact.js setup
- No additional calculation overhead
- Minimal state updates required

### Performance Targets

**Grid Calculation**: < 1ms per frame
**Snap Response**: < 16ms (60fps)
**Memory Overhead**: < 1MB for grid system
**CPU Impact**: < 5% increase over current drag performance

### Optimization Strategies

**1. Grid Size Optimization**
```javascript
// Use power-of-2 grid sizes for better alignment
const OPTIMAL_GRID_SIZES = [8, 16, 32, 64];

// Align grid size to display density
const calculateOptimalGridSize = (displayCount) => {
  if (displayCount > 15) return 32;
  if (displayCount > 8) return 20;
  return 16;
};
```

**2. Visual Grid Throttling**
```javascript
// Only show grid lines during drag operations
let isDragging = false;

interact(element).draggable({
  onstart: () => {
    isDragging = true;
    showGridLines();
  },
  onend: () => {
    isDragging = false;
    hideGridLines();
  }
});
```

---

## Level 5: Implementation Plan

### Phase 1: Core Grid Snapping (Priority 1)

#### Step 1: Create Workspace Grid Utility
- **File**: `src/utils/workspaceGrid.js`
- **Purpose**: Centralized grid configuration and interact.js integration
- **Duration**: 2 hours

#### Step 2: Enhance Floating Display Component
- **File**: `src/components/FloatingDisplay.svelte`
- **Purpose**: Integrate grid snapping with existing interact.js setup
- **Duration**: 3 hours

#### Step 3: Update Workspace Storage
- **File**: `src/utils/workspaceStorage.js`
- **Purpose**: Complete grid settings persistence
- **Duration**: 1 hour

#### Step 4: Add Grid Controls
- **File**: `src/components/FloatingSystemPanel.svelte`
- **Purpose**: User interface for grid settings
- **Duration**: 2 hours

### Phase 2: Visual Feedback (Priority 2)

#### Step 5: Grid Lines Overlay
- **File**: `src/components/GridOverlay.svelte` (New)
- **Purpose**: Visual grid display for user guidance
- **Duration**: 2 hours

#### Step 6: Snap Indicators
- **File**: `src/components/FloatingDisplay.svelte` (Enhancement)
- **Purpose**: Visual feedback when snapping occurs
- **Duration**: 1 hour

### Phase 3: Advanced Features (Priority 3)

#### Step 7: Keyboard Shortcuts
- **File**: `src/App.svelte`
- **Purpose**: Global keyboard controls for grid functions
- **Duration**: 1 hour

#### Step 8: Performance Optimization
- **Files**: Multiple
- **Purpose**: Optimize for 20+ display scenarios
- **Duration**: 2 hours

---

## Level 6: Testing Strategy

### Functional Testing

**Grid Snapping**:
- Verify elements snap to 20px grid
- Test disable/enable functionality
- Verify grid size changes work correctly

**Integration Testing**:
- Test with existing drag/resize functionality
- Verify collision detection compatibility (future)
- Test workspace persistence

**Performance Testing**:
- Measure impact on 20+ display scenarios
- Verify 60fps maintenance
- Test memory usage

### User Experience Testing

**Workflow Integration**:
- Test with typical trading display arrangements
- Verify grid doesn't interfere with precise positioning when needed
- Test keyboard shortcut accessibility

**Visual Feedback**:
- Verify grid lines appear/disappear correctly
- Test snap indicators provide clear feedback
- Verify overlay doesn't interfere with trading visuals

---

## Level 7: Technical Specifications

### Configuration Schema

```javascript
const GRID_SETTINGS_SCHEMA = {
  enabled: {
    type: 'boolean',
    default: true,
    description: 'Enable grid snapping for all floating elements'
  },
  gridSize: {
    type: 'number',
    default: 20,
    min: 8,
    max: 64,
    step: 4,
    description: 'Grid size in pixels (must divide evenly into display dimensions)'
  },
  showGridLines: {
    type: 'boolean',
    default: false,
    description: 'Show visual grid lines overlay'
  },
  gridOpacity: {
    type: 'number',
    default: 0.2,
    min: 0.1,
    max: 0.5,
    step: 0.1,
    description: 'Opacity of grid lines overlay'
  },
  showGridOnlyOnDrag: {
    type: 'boolean',
    default: true,
    description: 'Only show grid lines during drag operations for performance'
  }
};
```

### API Integration

**Display Store Actions**:
```javascript
export const gridActions = {
  enableGrid: () => { /* Enable grid snapping */ },
  disableGrid: () => { /* Disable grid snapping */ },
  setGridSize: (size) => { /* Update grid size */ },
  toggleGridLines: () => { /* Toggle visual grid */ },
  updateGridSettings: (settings) => { /* Bulk update */ }
};
```

**Interact.js Integration**:
```javascript
// Enhanced interact.js configuration object
const getInteractConfig = (gridSettings) => ({
  draggable: {
    modifiers: [
      interact.modifiers.restrictEdges(viewportRestriction),
      interact.modifiers.snap({
        targets: gridSettings.enabled ? 
          [interact.snappers.grid({ 
            x: gridSettings.gridSize, 
            y: gridSettings.gridSize 
          })] : [],
        relativePoints: [{ x: 0, y: 0 }]
      })
    ]
  },
  resizable: {
    modifiers: [
      interact.modifiers.restrictSize(minSizeRestriction),
      interact.modifiers.snap({
        targets: gridSettings.enabled ? 
          [interact.snappers.grid({ 
            x: gridSettings.gridSize, 
            y: gridSettings.gridSize 
          })] : []
      })
    ]
  }
});
```

---

## Conclusion

This design provides a comprehensive grid snapping system that leverages interact.js's optimized snapping capabilities while maintaining NeuroSense FX's performance requirements. The implementation prioritizes:

1. **Performance**: Minimal overhead, 60fps target maintenance
2. **Integration**: Seamless with existing architecture
3. **User Experience**: Intuitive grid behavior with visual feedback
4. **Flexibility**: Configurable settings and keyboard shortcuts
5. **Scalability**: Works efficiently with 20+ simultaneous displays

The phased implementation approach allows for rapid delivery of core functionality while building toward advanced features. The foundation established in Phase 1 provides immediate value to traders while subsequent phases enhance the user experience.

---

## Document Maintenance

This design document should be referenced during implementation and updated as requirements evolve. All implementation decisions should align with the core principles of performance, integration, and user experience outlined above.

**Next Steps**: Proceed with Phase 1 implementation, starting with workspace grid utility creation and FloatingDisplay component enhancement.
