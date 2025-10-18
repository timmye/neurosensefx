# NeuroSense FX - Event Handling Architecture

**Date**: 2025-10-18
**Status**: Current Implementation Documentation
**Update**: Floating Panel Standardization Complete

## Overview

NeuroSense FX implements a sophisticated event handling architecture that combines centralized event delegation, Svelte's reactive system, and composables for consistent behavior across floating components. The architecture is designed to support the floating workspace paradigm with efficient event processing and state management.

## Core Event Handling Components

### 1. WorkspaceEventManager.js - Centralized Event Delegation

The `WorkspaceEventManager` class provides centralized event handling for workspace-level interactions, implementing a delegation pattern for performance and consistency.

**Key Responsibilities:**
- Single event listeners for workspace interactions
- Canvas drag state management
- Right-click context menu handling
- Keyboard shortcuts for workspace operations
- Click-outside detection for menu closure

**Event Delegation Pattern:**
```javascript
// Workspace-level listeners (single listeners for all elements)
this.workspace.addEventListener('contextmenu', this.handleRightClick.bind(this));
this.workspace.addEventListener('mousedown', this.handleMouseDown.bind(this));

// Document-level listeners for drag operations
document.addEventListener('mousemove', this.handleMouseMove.bind(this));
document.addEventListener('mouseup', this.handleMouseUp.bind(this));

// Keyboard shortcuts
document.addEventListener('keydown', this.handleKeyDown.bind(this));
```

**Event Flow:**
1. Events captured at workspace level
2. Event target identification using `closest('.floating-canvas')`
3. Appropriate action dispatched based on target
4. State updates through store actions
5. Visual feedback through CSS classes

### 2. useDraggable.js - Unified Drag Functionality

The `useDraggable` composable consolidates drag functionality for all floating panels, providing consistent behavior and state management.

**Key Features:**
- Viewport boundary checking
- Position persistence via localStorage
- Touch and mouse event handling
- Minimize state management
- Proper cleanup on component destroy

**Implementation Pattern:**
```javascript
export function useDraggable(options = {}) {
  // State management
  let position = { ...defaultPosition };
  let isDragging = false;
  let isMinimized = defaultMinimized;
  
  // Event handlers
  const handleDragStart = (event) => {
    isDragging = true;
    // Calculate offset and add global listeners
  };
  
  const handleDragMove = (event) => {
    if (!isDragging) return;
    // Update position with boundary checking
  };
  
  // Return reactive state and handlers
  return {
    position, isDragging, isMinimized,
    handleDragStart, handleMinimize, handleClose
  };
}
```

### 3. Three-Store Pattern for State Management

The event handling architecture relies on three specialized stores for different aspects of state management:

#### workspaceState.js
- Canvas management and positioning
- Drag state coordination
- Active canvas tracking
- Workspace-level operations

#### uiState.js
- UI interaction state
- Context menu visibility
- Floating panel visibility
- Hover state management

#### canvasRegistry.js
- Canvas metadata tracking
- Z-index management
- Symbol-to-canvas mapping
- Canvas lifecycle management

## Event Flow Architecture

### 1. Canvas Interaction Events

**Right-Click Context Menu:**
```
User right-clicks canvas
↓
WorkspaceEventManager.handleRightClick()
↓
Identify canvas via closest('.floating-canvas')
↓
registryActions.markCanvasActive(canvasId)
↓
uiActions.showContextMenu(position, canvasId)
↓
CanvasContextMenu component rendered
```

**Canvas Drag Operations:**
```
User mousedown on canvas
↓
FloatingCanvas.handleMouseDown()
↓
dispatch('dragStart', { canvasId, offset })
↓
App.svelte.handleCanvasDragStart()
↓
workspaceActions.startDrag(canvasId, offset)
↓
WorkspaceEventManager handles mousemove/mouseup
↓
workspaceActions.updateDragPosition()
↓
workspaceActions.endDrag()
```

### 2. Floating Panel Events

**Panel Drag with InteractWrapper:**
```
User mousedown on panel drag handle
↓
InteractWrapper.handleDragStart()
↓
Global mousemove/mouseup listeners added
↓
Position updated with boundary checking
↓
Position saved to localStorage via PositionPersistence
↓
Cleanup on mouseup
```

**Standardized Panel Events:**
```
User interacts with panel control
↓
InteractWrapper handles event
↓
Consistent event dispatching pattern
↓
Position/state saved via unified utilities
↓
Parent component notified via dispatch
```

**Panel State Changes:**
```
User clicks minimize/close button
↓
FloatingPanel.handleMinimize/handleClose()
↓
useDraggable state updated
↓
localStorage persistence
↓
Parent component notified via dispatch
```

### 3. Reactive Rendering Pattern

The visualization system uses Svelte's reactive statements for efficient rendering:

```javascript
// Container.svelte - Reactive rendering block
$: if (ctx && state && config && $hoverState !== undefined && $markerStore !== undefined) {
  markers = $markerStore;
  draw(state, config, markers);
}
```

**Key Characteristics:**
- Renders only when data, config, or interaction state changes
- No continuous animation loop
- Immediate response to state changes
- Efficient resource usage

## Component Event Handling Patterns

### 1. FloatingCanvas.svelte

**Event Dispatcher Pattern:**
```javascript
const dispatch = createEventDispatcher();

function handleRightClick(event) {
  event.preventDefault();
  registryActions.markCanvasActive(id);
  dispatch('contextMenu', {
    canvasId: id,
    position: { x: event.clientX, y: event.clientY }
  });
}
```

**Local Drag Handling:**
```javascript
function handleMouseDown(event) {
  if (event.button !== 0) return;
  
  registryActions.markCanvasActive(id);
  
  if (!event.target.closest('button, input, select, .context-menu')) {
    isLocalDragging = true;
    // Calculate drag offset
    dispatch('dragStart', { canvasId: id, offset: dragOffset });
  }
}
```

### 2. CanvasContextMenu.svelte

**Parameter Change Events:**
```javascript
function handleParameterChange(parameter, value) {
  config[parameter] = value;
  dispatch('configChange', { 
    canvasId,
    [parameter]: value 
  });
}
```

**Keyboard Shortcuts:**
```javascript
function handleShortcutAction(actionData) {
  const { action, params } = actionData;
  
  switch (action) {
    case 'nextTab':
      switchTab((activeTab + 1) % parameterGroups.length);
      break;
    // ... other shortcuts
  }
}
```

### 3. FloatingPanel.svelte (Base Component)

**Composable Integration:**
```javascript
const draggable = useDraggablePanel({
  title,
  positionKey: `floating-${panelId}-position`,
  defaultPosition: position,
  onPositionChange,
  onMinimizeChange: (isMinimized) => {
    dispatch('minimizeChange', { isMinimized });
  },
  onClose: () => {
    dispatch('close');
  }
});
```

## Optimization Techniques

### 1. Event Delegation

- Single listeners for multiple elements
- Reduced memory footprint
- Consistent event handling
- Better performance with many elements

### 2. Reactive Updates

- Svelte's reactive statements
- Store subscriptions for state changes
- Efficient rendering only when needed
- No unnecessary redraws

### 3. Proper Cleanup

```javascript
onDestroy(() => {
  // Cleanup shortcuts
  if (cleanupShortcuts) {
    cleanupShortcuts();
  }
  
  // Remove event listeners
  document.removeEventListener('click', handleClickOutside);
  window.removeEventListener('resize', handleResize);
});
```

### 4. Boundary Checking

```javascript
const ensureInViewport = () => {
  const rect = element.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Adjust position if outside viewport
  if (position.x + elementWidth > viewportWidth) {
    position.x = viewportWidth - elementWidth - boundaryPadding;
  }
  // ... similar for y-axis
};
```

## Event Communication Patterns

### 1. Dispatch/Listen Pattern

Components use Svelte's `createEventDispatcher` for parent-child communication:

```javascript
// Child component
const dispatch = createEventDispatcher();
dispatch('configChange', { canvasId, parameter, value });

// Parent component
<FloatingCanvas on:configChange={handleCanvasConfigChange} />
```

### 2. Store-Based Communication

Cross-component communication through stores:

```javascript
// Update store
uiActions.showContextMenu(position, canvasId);

// Subscribe to changes
const unsubUIState = uiState.subscribe(state => {
  showContextMenu = state.contextMenuOpen;
  contextMenuPosition = state.menuPosition;
});
```

### 3. Context Menu Pattern

Centralized context menu handling through event delegation:

```javascript
// Workspace level
handleRightClick(event) {
  const canvasElement = event.target.closest('.floating-canvas');
  if (canvasElement) {
    showCanvasContextMenu(canvasId, event.clientX, event.clientY);
  } else if (event.target === this.workspace) {
    showAddDisplayMenu(event.clientX, event.clientY);
  }
}
```

## Keyboard Shortcuts System

### 1. Global Shortcuts

Handled by WorkspaceEventManager:

```javascript
handleKeyDown(event) {
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
  
  switch (event.key) {
    case 'Escape':
      uiActions.hideAllMenus();
      break;
    case 'Delete':
    case 'Backspace':
      const activeCanvasId = this.getActiveSheet();
      if (activeCanvasId) {
        this.deleteCanvas(activeCanvasId);
      }
      break;
    // ... other shortcuts
  }
}
```

### 2. Context-Specific Shortcuts

Handled by individual components:

```javascript
// CanvasContextMenu shortcuts
const shortcuts = {
  'Ctrl+F': () => searchInput.focus(),
  'Ctrl+Tab': () => switchTab((activeTab + 1) % tabs.length),
  'Escape': () => searchQuery ? clearSearch() : handleClose()
};
```

## Performance Considerations

### 1. Efficient Event Handling

- Single event listeners through delegation
- Minimal DOM manipulation
- Efficient state updates
- Proper cleanup patterns

### 2. Memory Management

- Store subscription cleanup
- Event listener removal
- Canvas resource cleanup
- Worker termination on symbol removal

### 3. Rendering Optimization

- Reactive rendering only on state changes
- Canvas-based visualizations
- Efficient drawing order
- Dirty region rendering potential

## Consistency Patterns

### 1. Standardized Event Names

```javascript
// Canvas events
'contextMenu', 'dragStart', 'dragMove', 'dragEnd', 'hover', 'close', 'configChange'

// Panel events
'close', 'minimizeChange', 'positionChange'
```

### 2. Unified Drag Implementation

All floating components use the same `InteractWrapper` component:
- Consistent behavior
- Shared functionality
- Reduced code duplication
- Centralized optimization
- Standardized z-index management
- Unified position persistence

### 3. Standard Store Patterns

All stores follow similar patterns:
- Writable store with derived stores
- Actions object for updates
- Utility functions for common queries
- Proper TypeScript types

## Error Handling

### 1. Event Validation

```javascript
function handleRightClick(event) {
  event.preventDefault();
  
  const canvasElement = event.target.closest('.floating-canvas');
  if (!canvasElement) return;
  
  const canvasId = canvasElement.dataset.canvasId;
  if (!canvasId) return;
  
  // Proceed with valid event
}
```

### 2. Store Update Safeguards

```javascript
updateCanvas(canvasId, updates) {
  workspaceState.update(state => {
    const newCanvases = new Map(state.canvases);
    const existingCanvas = newCanvases.get(canvasId);
    
    if (existingCanvas) {
      newCanvases.set(canvasId, {
        ...existingCanvas,
        ...updates
      });
    }
    
    return { ...state, canvases: newCanvases };
  });
}
```

## Recent Enhancements (2025-10-18)

### Floating Panel Standardization

All floating panels have been standardized to use the InteractWrapper component, which provides:

- **Unified Event Handling**: Consistent event handling patterns across all floating panels
- **Standardized Z-Index Management**: Proper visual layering with standardized z-index hierarchy
- **Enhanced Boundary Checking**: Improved viewport boundary handling during drag operations
- **Unified Position Persistence**: Consistent position saving using PositionPersistence utilities

### Event Handling Improvements

- **Consistent Event Dispatching**: Standardized event patterns for position changes, drag start/end, and minimize changes
- **Enhanced Cleanup**: Proper event listener cleanup and resource management
- **Improved Performance**: Optimized event handling with reduced duplication

## Conclusion

The NeuroSense FX event handling architecture provides a robust, efficient foundation for the floating workspace interface. By combining centralized event delegation, Svelte's reactive system, and well-designed components, the application delivers a responsive user experience with consistent behavior across all components.

The architecture successfully handles:
- Complex multi-canvas interactions
- Efficient drag operations with boundary checking
- Context-sensitive menus and controls
- Keyboard shortcuts for power users
- Proper resource management and cleanup
- Consistent patterns across all components
- Standardized floating panel behavior

The recent floating panel standardization has further improved the event handling consistency and maintainability of the codebase, with all floating elements now using a unified InteractWrapper component.

This event handling system is a key enabler of the application's performance and usability, supporting the floating workspace paradigm while maintaining clean, maintainable code.