# Floating Panel Implementation Plan: Structural Layering Solution

## Overview

This document provides a comprehensive implementation plan for fixing floating panel visibility issues through a structural layering solution. The approach reorganizes the DOM architecture to establish a clear layering system, ensuring all floating panels appear above the workspace container.

## Current Status

✅ **Phase 1 Complete**: Structural layering solution successfully implemented and tested
- Workspace container repositioned as background layer (z-index: 1)
- Floating panels layer created (z-index: 1000)
- All floating panels now visible and functional
- Drag, minimize, and position persistence working correctly

## Completed Implementation

### 1. DOM Structure Reorganization

**Previous Structure** (Problematic):
```html
<main>
  <div class="main-container">
    <div class="workspace-container" z-index="10">
      <!-- Background with gradients -->
      <div class="floating-canvases-layer">
        <!-- Floating canvases -->
      </div>
    </div>
  </div>
  <!-- Floating panels rendered after workspace (covered by background) -->
  <FloatingSymbolPalette z-index="1103" />
  <!-- Other panels -->
</main>
```

**New Structure** (Solution):
```html
<main>
  <!-- Background Layer -->
  <div class="main-container">
    <div class="workspace-container" z-index="1">
      <!-- Background with gradients -->
    </div>
  </div>
  
  <!-- Floating Panels Layer -->
  <div class="floating-panels-layer" z-index="1000">
    <div class="floating-canvases-layer">
      <!-- Floating canvases -->
    </div>
    <FloatingSymbolPalette z-index="1001" />
    <FloatingDebugPanel z-index="1002" />
    <FloatingSystemPanel z-index="1003" />
    <FloatingMultiSymbolADR z-index="1004" />
    <!-- Context menu at highest z-index -->
    <CanvasContextMenu z-index="10000" />
  </div>
</main>
```

### 2. Key CSS Updates

```css
.floating-panels-layer {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1000;
}

/* Allow pointer events for floating elements */
.floating-panels-layer > * {
  pointer-events: auto;
}

.workspace-container {
  /* Reduced from 10 to ensure it's truly in the background */
  z-index: 1;
}

.interact-wrapper {
  /* Added base z-index for consistency */
  z-index: 1000;
}

.interact-wrapper.dragging {
  /* Higher z-index when dragging */
  z-index: 9999;
}
```

### 3. Component Updates

**InteractWrapper.svelte**:
- Added base z-index: 1000
- Maintains dragging z-index: 9999

**FloatingSymbolPalette.svelte**:
- Updated to use z-index from style attribute
- Added `z-index: inherit` to draggable-panel class

## Phase 2: Comprehensive Floating Panel Standardization (Next)

Now that the basic structural layering is working, we need to standardize all floating elements to use the same architecture patterns.

### 2.1 Current Floating Elements Analysis

| Component | Current Implementation | Issues | Standardization Needed |
|-----------|---------------------|--------|------------------------|
| FloatingSymbolPalette | Uses InteractWrapper | ✅ Working | Minor adjustments |
| FloatingDebugPanel | Uses FloatingPanel | ❌ Mixed patterns | Full migration |
| FloatingSystemPanel | Uses FloatingPanel | ❌ Mixed patterns | Full migration |
| FloatingMultiSymbolADR | Uses FloatingPanel | ❌ Mixed patterns | Full migration |
| FloatingCanvas | Custom implementation | ❌ Inconsistent | Full migration |
| CanvasContextMenu | Fixed positioning | ⚠️ Layering issues | Z-index verification |

### 2.2 Standardization Architecture

All floating elements should follow this pattern:

```javascript
// Standard Pattern for All Floating Elements
<InteractWrapper
  position={elementPosition}
  defaultPosition={defaultPosition}
  positionKey="unique-element-position-key"
  on:positionChange={handlePositionChange}
  isDraggable={true}
  isResizable={false} // or true for resizable elements
  inertia={true}
  boundaryPadding={10}
>
  <div class="draggable-panel {isMinimized ? 'minimized' : ''}" style="z-index: {zIndex};">
    <!-- Panel Header -->
    <div class="panel-header">
      <div class="drag-indicator">⋮⋮</div>
      <div class="panel-title">{title}</div>
      <div class="panel-controls">
        <!-- Control buttons -->
      </div>
    </div>
    
    <!-- Panel Content -->
    {#if !isMinimized}
      <div class="panel-content">
        <!-- Component-specific content -->
      </div>
    {/if}
  </div>
</InteractWrapper>
```

### 2.3 Migration Plan

#### 2.3.1 FloatingDebugPanel Migration

**Current Issues**:
- Uses FloatingPanel component instead of InteractWrapper
- Inconsistent z-index handling
- Mixed event handling patterns

**Migration Steps**:
1. Replace FloatingPanel with InteractWrapper
2. Update z-index to use style attribute
3. Standardize event handlers
4. Test position persistence

#### 2.3.2 FloatingSystemPanel Migration

**Current Issues**:
- Uses FloatingPanel component
- Inconsistent prop handling
- Event handling errors (TypeError in console)

**Migration Steps**:
1. Replace FloatingPanel with InteractWrapper
2. Fix event handling for data source changes
3. Update z-index handling
4. Test all controls

#### 2.3.3 FloatingMultiSymbolADR Migration

**Current Issues**:
- Uses FloatingPanel component
- Canvas rendering issues
- Inconsistent positioning

**Migration Steps**:
1. Replace FloatingPanel with InteractWrapper
2. Fix canvas rendering in floating context
3. Update z-index handling
4. Test resize functionality

#### 2.3.4 FloatingCanvas Migration

**Current Issues**:
- Custom drag implementation
- Inconsistent with other panels
- Potential layering conflicts

**Migration Steps**:
1. Replace custom drag with InteractWrapper
2. Maintain canvas rendering integrity
3. Update z-index handling
4. Test all interactions

#### 2.3.5 CanvasContextMenu Verification

**Current Issues**:
- Potential layering conflicts with panels
- Z-index needs verification

**Migration Steps**:
1. Verify z-index is highest (10000)
2. Test appearance over all panels
3. Ensure proper positioning

### 2.4 Z-Index Hierarchy Standardization

```javascript
// Clear z-index hierarchy for all floating elements
const Z_INDEX_LEVELS = {
  BACKGROUND: 1,           // Workspace container
  FLOATING_BASE: 1000,     // Base for floating panels layer
  SYMBOL_PALETTE: 1001,    // FloatingSymbolPalette
  DEBUG_PANEL: 1002,       // FloatingDebugPanel
  SYSTEM_PANEL: 1003,      // FloatingSystemPanel
  ADR_PANEL: 1004,         // FloatingMultiSymbolADR
  FLOATING_CANVAS_BASE: 2000, // Base for floating canvases
  DRAGGING: 9999,          // Any element being dragged
  CONTEXT_MENU: 10000       // CanvasContextMenu (always on top)
};
```

## Phase 3: Enhanced Interaction Patterns (Week 2)

### 3.1 Unified Event Handling

Create a standardized event handling system for all floating elements:

```javascript
// src/utils/FloatingElementEvents.js
export class FloatingElementEvents {
  constructor(elementId, eventType) {
    this.elementId = elementId;
    this.eventType = eventType;
  }
  
  // Standard event handlers
  static createDragHandlers(elementId, onSave) {
    return {
      dragStart: (event) => {
        console.log(`🔍 DEBUG: ${elementId} Drag start`, event);
      },
      dragMove: (event) => {
        console.log(`🔍 DEBUG: ${elementId} Drag move`, event);
      },
      dragEnd: (event) => {
        console.log(`🔍 DEBUG: ${elementId} Drag end`, event);
        onSave(event.detail.position);
      }
    };
  }
  
  static createControlHandlers(elementId, actions) {
    return {
      minimize: () => {
        console.log(`🔍 DEBUG: ${elementId} Minimize toggled`);
        actions.onMinimizeChange();
      },
      close: () => {
        console.log(`🔍 DEBUG: ${elementId} Close`);
        actions.onClose();
      }
    };
  }
}
```

### 3.2 Position Persistence Standardization

Create a unified position persistence system:

```javascript
// src/utils/PositionPersistence.js
export class PositionPersistence {
  static savePosition(elementId, position) {
    localStorage.setItem(`floating-${elementId}-position`, JSON.stringify(position));
  }
  
  static loadPosition(elementId, defaultPosition) {
    const saved = localStorage.getItem(`floating-${elementId}-position`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn(`Failed to parse saved position for ${elementId}`, e);
      }
    }
    return { ...defaultPosition };
  }
  
  static saveState(elementId, state) {
    localStorage.setItem(`floating-${elementId}-state`, JSON.stringify(state));
  }
  
  static loadState(elementId, defaultState) {
    const saved = localStorage.getItem(`floating-${elementId}-state`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn(`Failed to parse saved state for ${elementId}`, e);
      }
    }
    return { ...defaultState };
  }
}
```

### 3.3 Boundary Checking Enhancement

Improve boundary checking for all floating elements:

```javascript
// src/utils/BoundaryChecker.js
export class BoundaryChecker {
  static ensureInBounds(position, element, bounds = null, isMinimized = false) {
    if (!element) return position;
    
    const rect = element.getBoundingClientRect();
    let { x, y } = position;
    
    // Determine bounds
    let minX, minY, maxX, maxY;
    
    if (bounds) {
      // Use custom bounds
      minX = bounds.left || 0;
      minY = bounds.top || 0;
      maxX = bounds.right || window.innerWidth - rect.width;
      maxY = bounds.bottom || window.innerHeight - rect.height;
    } else {
      // Use viewport bounds
      minX = 10;
      minY = 10;
      maxX = window.innerWidth - rect.width - 10;
      maxY = window.innerHeight - rect.height - 10;
    }
    
    // Apply bounds with consideration for minimized state
    const elementWidth = isMinimized ? 200 : rect.width;
    const elementHeight = isMinimized ? 40 : rect.height;
    
    // Adjust horizontal position
    if (x + elementWidth > maxX + 10) {
      x = maxX - elementWidth + 10;
    }
    if (x < minX) {
      x = minX;
    }
    
    // Adjust vertical position
    if (y + elementHeight > maxY + 10) {
      y = maxY - elementHeight + 10;
    }
    if (y < minY) {
      y = minY;
    }
    
    return { x, y };
  }
}
```

## Phase 4: Testing and Validation (Week 2)

### 4.1 Comprehensive Test Suite

Create tests for all floating elements:

```javascript
// src/tests/floating-elements.test.js
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import App from '../App.svelte';

describe('Floating Elements Integration', () => {
  test('all floating panels are visible on load', async () => {
    const { getByTestId } = render(App);
    
    // Check all panels are present
    expect(getByTestId('symbol-palette')).toBeVisible();
    expect(getByTestId('debug-panel')).toBeVisible();
    expect(getByTestId('system-panel')).toBeVisible();
    expect(getByTestId('adr-panel')).toBeVisible();
  });
  
  test('panels have correct z-index hierarchy', async () => {
    const { getByTestId } = render(App);
    
    const symbolPalette = getByTestId('symbol-palette');
    const debugPanel = getByTestId('debug-panel');
    const systemPanel = getByTestId('system-panel');
    const adrPanel = getByTestId('adr-panel');
    
    // Check z-index values
    expect(parseInt(symbolPalette.style.zIndex)).toBeLessThan(
      parseInt(debugPanel.style.zIndex)
    );
    expect(parseInt(debugPanel.style.zIndex)).toBeLessThan(
      parseInt(systemPanel.style.zIndex)
    );
  });
  
  test('panels can be dragged independently', async () => {
    const { getByTestId } = render(App);
    
    const symbolPalette = getByTestId('symbol-palette');
    const debugPanel = getByTestId('debug-panel');
    
    // Drag symbol palette
    await fireEvent.mouseDown(getByTestId('symbol-palette-header'));
    await fireEvent.mouseMove(document, { clientX: 200, clientY: 200 });
    await fireEvent.mouseUp(document);
    
    // Verify only symbol palette moved
    expect(symbolPalette.style.transform).toContain('200px');
    expect(debugPanel.style.transform).not.toContain('200px');
  });
  
  test('position persistence works across reloads', async () => {
    const { getByTestId, component } = render(App);
    
    const symbolPalette = getByTestId('symbol-palette');
    
    // Drag to new position
    await fireEvent.mouseDown(getByTestId('symbol-palette-header'));
    await fireEvent.mouseMove(document, { clientX: 300, clientY: 300 });
    await fireEvent.mouseUp(document);
    
    // Simulate reload by creating new component
    component.$destroy();
    const { getByTestId: getByTestId2 } = render(App);
    
    const symbolPalette2 = getByTestId2('symbol-palette');
    
    // Position should be restored
    expect(symbolPalette2.style.transform).toContain('300px');
  });
});
```

### 4.2 Manual Testing Checklist

1. **Visibility Test**
   - [ ] All panels visible on initial load
   - [ ] No panels covered by workspace background
   - [ ] Proper layering maintained

2. **Interaction Test**
   - [ ] All panels draggable by header
   - [ ] Minimize/expand functionality works
   - [ ] Close functionality works
   - [ ] No interaction conflicts

3. **Position Persistence Test**
   - [ ] Position saves on drag
   - [ ] Position restores on reload
   - [ ] Minimized state persists
   - [ ] Boundary checking works

4. **Z-Index Test**
   - [ ] Correct hierarchy maintained
   - [ ] Context menu appears above all
   - [ ] Dragging panel comes to front

5. **Performance Test**
   - [ ] Smooth dragging with multiple panels
   - [ ] No layout thrashing
   - [ ] Efficient event handling

## Phase 5: Advanced Features (Week 3)

### 5.1 Smart Positioning

Implement intelligent positioning to prevent overlap:

```javascript
// src/utils/SmartPositioning.js
export class SmartPositioning {
  static findOptimalPosition(preferred, existing, size) {
    // Check if preferred position overlaps with existing panels
    const overlaps = existing.filter(panel =>
      this.checkOverlap(preferred, panel.position, size, panel.size)
    );
    
    if (overlaps.length === 0) {
      return preferred; // No overlap, use preferred position
    }
    
    // Find nearest non-overlapping position
    return this.findNearestFreePosition(preferred, existing, size);
  }
  
  static checkOverlap(pos1, pos2, size1, size2) {
    return !(pos1.x + size1.width < pos2.x ||
             pos2.x + size2.width < pos1.x ||
             pos1.y + size1.height < pos2.y ||
             pos2.y + size2.height < pos1.y);
  }
  
  static findNearestFreePosition(preferred, existing, size) {
    // Spiral search for nearest free position
    const step = 20;
    let maxSteps = 20;
    
    for (let i = 1; i <= maxSteps; i++) {
      // Check positions in a spiral pattern
      const positions = this.getSpiralPositions(preferred, step * i, 8);
      
      for (const pos of positions) {
        const overlaps = existing.filter(panel =>
          this.checkOverlap(pos, panel.position, size, panel.size)
        );
        
        if (overlaps.length === 0) {
          return pos;
        }
      }
    }
    
    // Fallback to preferred position if no free position found
    return preferred;
  }
  
  static getSpiralPositions(center, radius, count) {
    const positions = [];
    const angleStep = (Math.PI * 2) / count;
    
    for (let i = 0; i < count; i++) {
      const angle = angleStep * i;
      positions.push({
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius
      });
    }
    
    return positions;
  }
}
```

### 5.2 Panel Management System

Create a centralized panel management system:

```javascript
// src/stores/panelManager.js
import { writable, derived } from 'svelte/store';

export const panels = writable({});
export const activePanel = writable(null);
export const panelZIndices = writable({});

export const panelActions = {
  registerPanel(id, config) {
    panels.update(p => ({
      ...p,
      [id]: {
        ...config,
        isActive: false,
        isMinimized: false,
        zIndex: config.defaultZIndex || 1000
      }
    }));
    
    panelZIndices.update(z => ({
      ...z,
      [id]: config.defaultZIndex || 1000
    }));
  },
  
  unregisterPanel(id) {
    panels.update(p => {
      const newPanels = { ...p };
      delete newPanels[id];
      return newPanels;
    });
    
    panelZIndices.update(z => {
      const newZIndices = { ...z };
      delete newZIndices[id];
      return newZIndices;
    });
  },
  
  activatePanel(id) {
    // Bring panel to front
    const maxZIndex = Math.max(...Object.values($panelZIndices), 0);
    panelZIndices.update(z => ({
      ...z,
      [id]: maxZIndex + 1
    }));
    
    activePanel.set(id);
    
    panels.update(p => ({
      ...p,
      [id]: { ...p[id], isActive: true }
    }));
  },
  
  minimizePanel(id) {
    panels.update(p => ({
      ...p,
      [id]: { ...p[id], isMinimized: !p[id].isMinimized }
    }));
  },
  
  closePanel(id) {
    panels.update(p => ({
      ...p,
      [id]: { ...p[id], isVisible: false }
    }));
  }
};

// Derived store for visible panels
export const visiblePanels = derived(
  panels,
  $panels => Object.values($panels).filter(p => p.isVisible !== false)
);
```

## Success Criteria

### Phase 1 (Completed) ✅
- [x] Structural layering solution implemented
- [x] All floating panels visible
- [x] Basic drag, minimize, close functionality working
- [x] Position persistence working

### Phase 2 (Next)
- [ ] All floating elements use InteractWrapper
- [ ] Consistent z-index hierarchy
- [ ] Unified event handling
- [ ] No mixed implementation patterns

### Phase 3
- [ ] Enhanced interaction patterns
- [ ] Unified position persistence
- [ ] Improved boundary checking
- [ ] Performance optimizations

### Phase 4
- [ ] Comprehensive test suite
- [ ] All manual tests passing
- [ ] Cross-browser compatibility
- [ ] Touch device support

### Phase 5
- [ ] Smart positioning
- [ ] Panel management system
- [ ] Advanced features
- [ ] Documentation complete

## Risk Mitigation

1. **Breaking Changes**
   - Phase 2 migration maintains existing functionality
   - Test each component individually before integration
   - Keep backup of working implementation

2. **Performance Impact**
   - Monitor performance with multiple panels
   - Optimize event handling
   - Test with 20+ floating elements

3. **User Experience**
   - Maintain existing interaction patterns
   - Add visual feedback for all interactions
   - Test with actual traders

This updated implementation plan builds on our successful structural layering solution to create a comprehensive, standardized floating panel system for NeuroSense FX.

## Phase 1: Foundation Setup (Day 1)

### 1.1 Install Dependencies

```bash
npm install interactjs
npm install --save-dev @types/interactjs
```

### 1.2 Create InteractWrapper Component

Create `src/components/shared/InteractWrapper.svelte`:

```javascript
<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import interact from 'interactjs';
  
  // Props
  export let position = { x: 0, y: 0 };
  export let draggable = true;
  export let resizable = false;
  export let bounds = 'parent';
  export let inertia = true;
  export let snap = null;
  export let zIndex = 100;
  export let disabled = false;
  
  // Event callbacks
  export let onDragStart = null;
  export let onDragMove = null;
  export let onDragEnd = null;
  export let onResizeStart = null;
  export let onResizeMove = null;
  export let onResizeEnd = null;
  
  const dispatch = createEventDispatcher();
  let element;
  let interactable;
  
  // Load saved position
  onMount(() => {
    if (!disabled) {
      initializeInteract();
    }
  });
  
  function initializeInteract() {
    interactable = interact(element);
    
    // Configure draggable
    if (draggable) {
      const dragConfig = {
        inertia: inertia ? {
          resistance: 20,
          minSpeed: 200,
          endSpeed: 100
        } : false,
        modifiers: [],
        listeners: {
          start: (event) => {
            dispatch('dragStart', event);
            if (onDragStart) onDragStart(event);
          },
          move: (event) => {
            position.x += event.dx;
            position.y += event.dy;
            
            dispatch('dragMove', { ...event, position });
            if (onDragMove) onDragMove({ ...event, position });
          },
          end: (event) => {
            dispatch('dragEnd', { ...event, position });
            if (onDragEnd) onDragEnd({ ...event, position });
          }
        }
      };
      
      // Add bounds restriction
      if (bounds) {
        dragConfig.modifiers.push(
          interact.modifiers.restrictRect({
            restriction: bounds,
            endOnly: true
          })
        );
      }
      
      // Add snap if provided
      if (snap) {
        dragConfig.modifiers.push(
          interact.modifiers.snap({
            targets: snap.targets,
            range: snap.range || Infinity,
            relativePoints: snap.relativePoints || [{ x: 0, y: 0 }]
          })
        );
      }
      
      interactable.draggable(dragConfig);
    }
    
    // Configure resizable
    if (resizable) {
      interactable.resizable({
        edges: { left: true, right: true, bottom: true, top: true },
        listeners: {
          start: (event) => {
            dispatch('resizeStart', event);
            if (onResizeStart) onResizeStart(event);
          },
          move: (event) => {
            let { x, y } = element.dataset;
            
            x = (parseFloat(x) || 0) + event.deltaRect.left;
            y = (parseFloat(y) || 0) + event.deltaRect.top;
            
            Object.assign(element.style, {
              width: `${event.rect.width}px`,
              height: `${event.rect.height}px`,
              transform: `translate(${x}px, ${y}px)`
            });
            
            Object.assign(element.dataset, { x, y });
            
            position.x = x;
            position.y = y;
            
            dispatch('resizeMove', { 
              ...event, 
              position, 
              size: { width: event.rect.width, height: event.rect.height }
            });
            if (onResizeMove) onResizeMove({ 
              ...event, 
              position, 
              size: { width: event.rect.width, height: event.rect.height }
            });
          },
          end: (event) => {
            dispatch('resizeEnd', event);
            if (onResizeEnd) onResizeEnd(event);
          }
        },
        modifiers: [
          interact.modifiers.restrictEdges({
            outer: bounds
          }),
          interact.modifiers.restrictSize({
            min: { width: 100, height: 50 }
          })
        ],
        inertia: inertia
      });
    }
  }
  
  // Cleanup
  onDestroy(() => {
    if (interactable) {
      interactable.unset();
    }
  });
  
  // Update bounds if they change
  $: if (interactable && bounds) {
    interactable.reflow({ action: 'drag' });
  }
  
  // Enable/disable interactability
  $: if (interactable) {
    if (disabled) {
      interactable.unset();
    } else {
      initializeInteract();
    }
  }
</script>

<div
  bind:this={element}
  class="interact-wrapper"
  style="position: fixed; left: {position.x}px; top: {position.y}px; z-index: {zIndex}; transform: translate(0, 0);"
  data-x={position.x}
  data-y={position.y}
>
  <slot />
</div>

<style>
  .interact-wrapper {
    touch-action: none;
    user-select: none;
  }
</style>
```

### 1.3 Update Package Dependencies

Add to `package.json`:
```json
{
  "dependencies": {
    "interactjs": "^1.10.27"
  },
  "devDependencies": {
    "@types/interactjs": "^1.10.7"
  }
}
```

## Phase 2: Update Floating Panel Component (Day 1-2)

### 2.1 Refactor FloatingPanel.svelte

```javascript
<script>
  import { createEventDispatcher } from 'svelte';
  import InteractWrapper from './InteractWrapper.svelte';
  
  // Props
  export let title = 'Panel';
  export let position = { x: 100, y: 100 };
  export let panelId = 'floating-panel';
  export let showMinimize = true;
  export let showClose = true;
  export let zIndex = 100;
  export let onClose = null;
  export let onMinimizeChange = null;
  export let onPositionChange = null;
  export let defaultMinimized = false;
  export let boundaryPadding = 10;
  export let resizable = false;
  
  const dispatch = createEventDispatcher();
  
  // Internal state
  let isMinimized = defaultMinimized;
  let isDragging = false;
  let interactPosition = { ...position };
  
  // Load saved state from localStorage
  function loadSavedState() {
    const savedPosition = localStorage.getItem(`floating-${panelId}-position`);
    if (savedPosition) {
      try {
        interactPosition = JSON.parse(savedPosition);
        position = { ...interactPosition };
      } catch (e) {
        console.warn(`Failed to parse saved position for ${panelId}`);
      }
    }
    
    const savedMinimized = localStorage.getItem(`floating-${panelId}-minimized`);
    if (savedMinimized) {
      isMinimized = savedMinimized === 'true';
    }
  }
  
  // Save position to localStorage
  function savePosition(pos) {
    localStorage.setItem(`floating-${panelId}-position`, JSON.stringify(pos));
    if (onPositionChange) {
      onPositionChange(pos);
    }
    dispatch('positionChange', pos);
  }
  
  // Save minimized state
  function saveMinimized() {
    localStorage.setItem(`floating-${panelId}-minimized`, isMinimized.toString());
    if (onMinimizeChange) {
      onMinimizeChange(isMinimized);
    }
    dispatch('minimizeChange', { isMinimized });
  }
  
  // Event handlers
  function handleDragStart(event) {
    isDragging = true;
    dispatch('dragStart', event);
  }
  
  function handleDragMove(event) {
    interactPosition = { ...event.position };
    savePosition(interactPosition);
  }
  
  function handleDragEnd(event) {
    isDragging = false;
    interactPosition = { ...event.position };
    savePosition(interactPosition);
    dispatch('dragEnd', event);
  }
  
  function handleMinimize() {
    isMinimized = !isMinimized;
    saveMinimized();
  }
  
  function handleClose() {
    if (onClose) {
      onClose();
    }
    dispatch('close');
  }
  
  // Initialize saved state
  loadSavedState();
  
  // Sync position changes
  $: if (position.x !== interactPosition.x || position.y !== interactPosition.y) {
    interactPosition = { ...position };
  }
</script>

<InteractWrapper
  bind:position={interactPosition}
  {draggable}
  {resizable}
  bounds="parent"
  zIndex={zIndex}
  onDragStart={handleDragStart}
  onDragMove={handleDragMove}
  onDragEnd={handleDragEnd}
>
  <div
    class="draggable-panel {isMinimized ? 'minimized' : ''} {isDragging ? 'dragging' : ''}"
    data-panel-id={panelId}
  >
    <!-- Drag Handle -->
    <div class="drag-handle {isDragging ? 'grabbing' : ''}">
      <div class="drag-indicator">⋮⋮</div>
      <div class="panel-title">{title}</div>
      <div class="panel-controls">
        {#if showMinimize}
          <button 
            class="control-btn minimize-btn" 
            on:click={handleMinimize}
            title={isMinimized ? "Expand" : "Minimize"}
          >
            {isMinimized ? '□' : '−'}
          </button>
        {/if}
        
        {#if showClose}
          <button 
            class="control-btn close-btn" 
            on:click={handleClose}
            title="Close"
          >
            ×
          </button>
        {/if}
      </div>
    </div>
    
    <!-- Panel Content -->
    {#if !isMinimized}
      <div class="panel-content">
        <slot />
      </div>
    {/if}
  </div>
</InteractWrapper>

<style>
  .draggable-panel {
    position: relative;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 8px;
    min-width: 200px;
    max-width: 320px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    transition: box-shadow 0.2s ease;
    pointer-events: auto;
  }
  
  .draggable-panel.dragging {
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);
  }
  
  .draggable-panel.minimized {
    min-width: 200px;
    max-width: 200px;
  }
  
  .drag-handle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: #374151;
    border-bottom: 1px solid #4b5563;
    border-radius: 8px 8px 0 0;
    cursor: grab;
    user-select: none;
    pointer-events: auto;
    position: relative;
    z-index: 1;
  }
  
  .drag-handle.grabbing {
    cursor: grabbing;
  }
  
  .drag-indicator {
    color: #9ca3af;
    font-size: 12px;
    margin-right: 8px;
  }
  
  .panel-title {
    color: #d1d5db;
    font-size: 12px;
    font-weight: 600;
    flex: 1;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .panel-controls {
    display: flex;
    gap: 4px;
  }
  
  .control-btn {
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    font-size: 14px;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background-color 0.2s ease;
    pointer-events: auto;
    position: relative;
    z-index: 2;
  }
  
  .control-btn:hover {
    background: rgba(156, 163, 175, 0.1);
    color: #d1d5db;
  }
  
  .panel-content {
    padding: 12px;
  }
</style>
```

## Phase 3: Update Panel Positions (Day 2)

### 3.1 Fix Initial Positioning in uiState.js

```javascript
// Update positions to prevent overlap
const initialUIState = {
  // ... other state
  floatingSymbolPalettePosition: { x: 400, y: 20 }, // Top center
  floatingDebugPanelPosition: { x: 680, y: 200 }, // Middle right
  floatingSystemPanelPosition: { x: 680, y: 20 }, // Top right
  floatingADRPanelPosition: { x: 20, y: 20 }, // Top left
  // ... rest of state
};
```

### 3.2 Update Panel Components

Update each panel to use the new FloatingPanel:

**FloatingSymbolPalette.svelte:**
```javascript
// Replace useDraggable import with FloatingPanel
import FloatingPanel from './shared/FloatingPanel.svelte';

// Update component to use FloatingPanel
<FloatingPanel
  title="Symbol Palette"
  panelId="symbol-palette"
  bind:position={palettePosition}
  zIndex={1103}
  onClose={handleClose}
  onPositionChange={handlePositionChange}
  defaultMinimized={false}
  on:minimizeChange={(e) => { isMinimized = e.detail.isMinimized; }}
>
  <!-- existing content -->
</FloatingPanel>
```

**Similar updates for:**
- FloatingDebugPanel.svelte
- FloatingSystemPanel.svelte
- FloatingMultiSymbolADR.svelte

## Phase 4: Testing and Validation (Day 2)

### 4.1 Create Test Suite

Create `src/tests/floating-panels.test.js`:

```javascript
import { render, fireEvent } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import FloatingPanel from '../components/shared/FloatingPanel.svelte';

describe('FloatingPanel', () => {
  test('should render with correct initial position', () => {
    const position = { x: 100, y: 100 };
    const { getByTestId } = render(FloatingPanel, {
      props: { position, panelId: 'test-panel' }
    });
    
    const panel = getByTestId('floating-panel');
    expect(panel.style.left).toBe('100px');
    expect(panel.style.top).toBe('100px');
  });
  
  test('should handle drag events', async () => {
    const onDragEnd = jest.fn();
    const position = { x: 100, y: 100 };
    
    const { getByTestId } = render(FloatingPanel, {
      props: { position, panelId: 'test-panel', onDragEnd }
    });
    
    const dragHandle = getByTestId('drag-handle');
    
    // Simulate drag
    await fireEvent.mouseDown(dragHandle);
    await fireEvent.mouseMove(document, { clientX: 150, clientY: 150 });
    await fireEvent.mouseUp(document);
    
    expect(onDragEnd).toHaveBeenCalledWith(
      expect.objectContaining({
        position: { x: 150, y: 150 }
      })
    );
  });
  
  test('should minimize and expand', async () => {
    const { getByTestId } = render(FloatingPanel, {
      props: { position: { x: 0, y: 0 }, panelId: 'test-panel' }
    });
    
    const minimizeBtn = getByTestId('minimize-btn');
    const content = getByTestId('panel-content');
    
    expect(content).toBeVisible();
    
    await fireEvent.click(minimizeBtn);
    
    expect(content).not.toBeVisible();
  });
});
```

### 4.2 Manual Testing Checklist

1. **Header Interaction**
   - [ ] Click and drag panel by header
   - [ ] Minimize button works
   - [ ] Close button works
   - [ ] No interaction conflicts

2. **Position Persistence**
   - [ ] Position saves to localStorage
   - [ ] Position restores on reload
   - [ ] Minimized state persists

3. **Multiple Panels**
   - [ ] No overlap on initial load
   - [ ] Panels can be dragged independently
   - [ ] Z-index management works

4. **Boundary Checking**
   - [ ] Panels stay within viewport
   - [ ] No panels extend beyond screen edges

## Phase 5: Enhanced Features (Day 3-4)

### 5.1 Add Snapping Feature

```javascript
// In InteractWrapper.svelte
export let snapGrid = null;

// Update drag configuration
if (snapGrid) {
  dragConfig.modifiers.push(
    interact.modifiers.snap({
      targets: [
        interact.snappers.grid(snapGrid)
      ]
    })
  );
}
```

### 5.2 Add Resize Handles

```javascript
// In FloatingPanel.svelte
export let resizable = false;
export let minSize = { width: 200, height: 100 };
export let maxSize = { width: 600, height: 400 };

// Add resize handles to panel
{#if resizable}
  <div class="resize-handle top-left"></div>
  <div class="resize-handle top-right"></div>
  <div class="resize-handle bottom-left"></div>
  <div class="resize-handle bottom-right"></div>
{/if}

<style>
  .resize-handle {
    position: absolute;
    width: 10px;
    height: 10px;
    background: #4b5563;
    border: 1px solid #6b7280;
  }
  
  .resize-handle.top-left {
    top: -5px;
    left: -5px;
    cursor: nw-resize;
  }
  
  .resize-handle.top-right {
    top: -5px;
    right: -5px;
    cursor: ne-resize;
  }
  
  .resize-handle.bottom-left {
    bottom: -5px;
    left: -5px;
    cursor: sw-resize;
  }
  
  .resize-handle.bottom-right {
    bottom: -5px;
    right: -5px;
    cursor: se-resize;
  }
</style>
```

### 5.3 Add Keyboard Navigation

```javascript
// In FloatingPanel.svelte
import { setContext, onMount } from 'svelte';

// Add keyboard shortcuts
function handleKeydown(event) {
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
  
  switch (event.key) {
    case 'Escape':
      handleClose();
      break;
    case ' ':
      if (event.ctrlKey) {
        handleMinimize();
        event.preventDefault();
      }
      break;
  }
}

onMount(() => {
  window.addEventListener('keydown', handleKeydown);
  return () => window.removeEventListener('keydown', handleKeydown);
});
```

## Phase 6: Performance Optimization (Day 4)

### 6.1 Add Throttling to Drag Events

```javascript
// In InteractWrapper.svelte
function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }
}

// Throttle drag move events
const throttledDragMove = throttle((event) => {
  position.x += event.dx;
  position.y += event.dy;
  dispatch('dragMove', { ...event, position });
  if (onDragMove) onDragMove({ ...event, position });
}, 16); // ~60fps
```

### 6.2 Add Virtual Scrolling for Many Panels

```javascript
// Only render visible panels
import { writable } from 'svelte/store';

export const visiblePanels = writable([]);

function updateVisiblePanels() {
  const viewport = {
    top: window.scrollY,
    bottom: window.scrollY + window.innerHeight,
    left: window.scrollX,
    right: window.scrollX + window.innerWidth
  };
  
  // Update visiblePanels based on viewport intersection
}
```

## Rollout Plan

### Day 1: Foundation
- Install dependencies
- Create InteractWrapper component
- Basic FloatingPanel refactoring

### Day 2: Migration
- Update all panel components
- Fix initial positioning
- Basic testing

### Day 3: Enhancement
- Add snapping features
- Implement resize functionality
- Add keyboard navigation

### Day 4: Polish
- Performance optimization
- Advanced features
- Comprehensive testing

## Success Criteria

1. **Functional Requirements**
   - All panel headers are interactive
   - No overlap on initial load
   - Smooth drag interactions
   - Position persistence works

2. **Performance Requirements**
   - 60fps drag performance
   - Minimal memory usage
   - Fast initial load

3. **User Experience**
   - Intuitive interactions
   - Visual feedback
   - Keyboard accessibility

## Risk Mitigation

1. **Feature Parity**
   - Maintain all existing functionality
   - Gradual migration approach
   - Fallback to old implementation

2. **Performance**
   - Monitor performance metrics
   - Optimize event handling
   - Test with multiple panels

3. **Compatibility**
   - Test across browsers
   - Ensure touch device support
   - Verify accessibility

This implementation plan provides a clear path from the current problematic implementation to a robust, professional floating panel system using interact.js.