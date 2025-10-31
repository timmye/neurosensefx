# Implementation Plan

## Overview
Fix resize functionality that currently drags instead of resizing by consolidating event handling and eliminating conflicts between resize handles and container drag operations.

## Context
The resize functionality is broken due to competing event listener systems between FloatingDisplay.svelte and ResizeHandle.svelte components. While drag functionality works correctly, resize operations are being intercepted by the container's drag handler, causing resize attempts to trigger drag movements instead.

## Types
Single-responsibility event handling architecture with centralized resize management.

### Event Handler Interface
```javascript
// Consolidated resize event handlers in FloatingDisplay.svelte
interface ResizeEventHandlers {
  handleResizeStart(e: MouseEvent, handle: string): void
  handleResizeMove(e: MouseEvent): void  
  handleResizeEnd(): void
}

// Simplified ResizeHandle.svelte interface
interface ResizeHandleProps {
  handleType: string
  isVisible: boolean
  onResizeStart: (e: MouseEvent, handle: string) => void
}
```

### State Management
```javascript
// Resize state structure (maintained in floatingStore.js)
interface ResizeState {
  isResizing: boolean
  displayId: string | null
  handleType: string | null
  startPosition: { x: number, y: number }
  startSize: { width: number, height: number }
  startMousePos: { x: number, y: number }
}
```

## Files
Modify existing components to consolidate resize functionality and eliminate event handling conflicts.

### Files to Modify
- **src/components/FloatingDisplay.svelte**: Consolidate all resize event handling
- **src/components/ResizeHandle.svelte**: Simplify to only trigger resize start events
- **src/stores/floatingStore.js**: Ensure resize actions work correctly (no changes expected)

### Files to Leave Unchanged
- All other components and files remain as-is since they're working correctly

## Functions
Consolidate resize event handling into FloatingDisplay.svelte and simplify ResizeHandle.svelte.

### New Functions
- **handleResizeStartEnhanced()**: Enhanced resize start with proper event handling (FloatingDisplay.svelte)
- **handleResizeMoveConsolidated()**: Consolidated resize move handler (FloatingDisplay.svelte)
- **handleResizeEndCleanup()**: Proper cleanup after resize operations (FloatingDisplay.svelte)

### Modified Functions
- **handleResizeStart()**: Remove global event listeners (ResizeHandle.svelte)
- **handleMouseDown()**: Ensure proper event propagation handling (FloatingDisplay.svelte)
- **handleResizeStart()**: Enhanced with better event prevention (FloatingDisplay.svelte)

### Removed Functions
- **handleGlobalMouseMove()**: Remove duplicate global handler (ResizeHandle.svelte)
- **handleGlobalMouseUp()**: Remove duplicate global handler (ResizeHandle.svelte)

## Classes
No new classes - this is a consolidation of existing component functionality.

### Modified Classes
- **ResizeHandle**: Simplified to only dispatch resize start events, no global event management
- **FloatingDisplay**: Enhanced to handle all resize operations centrally

## Dependencies
No new dependencies required - using existing Svelte store system and DOM APIs.

## Testing
Comprehensive testing of all resize handles and edge cases.

### Test Coverage
- All 8 resize handles (nw, n, ne, e, se, s, sw, w) function correctly
- Resize operations don't trigger drag movements
- Event propagation properly prevents container drag conflicts
- Performance maintained during resize operations
- Visual feedback (cursor changes, handle highlighting) works correctly
- Resize constraints (minimum sizes) are enforced
- Viewport boundary constraints work during resize

## Implementation Order
Sequential implementation to ensure each step works before proceeding to the next.

1. **Simplify ResizeHandle.svelte** - Remove duplicate event handling, make it a pure trigger component
2. **Enhance FloatingDisplay.svelte resize handlers** - Consolidate all resize logic with proper event handling
3. **Fix event propagation conflicts** - Ensure resize events don't bubble to drag handlers
4. **Test all resize handles** - Verify each handle works correctly without drag conflicts
5. **Performance validation** - Ensure resize operations maintain 60fps performance
6. **Edge case testing** - Test boundary constraints and minimum size enforcement

## Current Issue Analysis

**Problem Identified**: 
- `ResizeHandle.svelte` has its own global event listeners (`handleGlobalMouseMove`, `handleGlobalMouseUp`)
- `FloatingDisplay.svelte` also has global event listeners (`handleResizeMove`, `handleMouseUp`)
- When resize starts, both components add listeners to the same events (`mousemove`, `mouseup`)
- This creates competing event handling where resize operations trigger drag movements

**Root Cause**:
- `ResizeHandle.svelte` calls `actions.startResize()` AND adds its own global listeners
- `FloatingDisplay.svelte` handles resize through store state but also adds its own listeners
- Event propagation isn't properly stopped between resize handle and container drag handling
- The container's `handleMouseDown` can fire after resize handle's `handleMouseDown`

**Solution Strategy**:
1. Make `ResizeHandle.svelte` a pure trigger component - only dispatch events, no global listeners
2. Consolidate ALL resize event handling in `FloatingDisplay.svelte`
3. Ensure proper event propagation to prevent drag conflicts
4. Use store state as single source of truth for resize operations
