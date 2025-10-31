# Interaction Fix Implementation Plan

## Overview
Fix drag and resize functionality in NeuroSense FX by eliminating state conflicts and using proven working actions from floatingStore.js, following "simple, robust, maintainable" philosophy.

## Scope and Context
Current FloatingDisplay.svelte has 919 lines with mixed legacy and partial implementations causing event handler conflicts. The system has three competing state authorities: local component state, partial interactionActions, and existing working store actions. This implementation chooses one authority (existing store actions) and removes all others to create clear, predictable interaction behavior.

## Types
### Interaction State Type
```javascript
interface InteractionState {
  mode: 'idle' | 'dragging' | 'resizing';
  activeDisplayId: string | null;
  resizeHandle: string | null;
  isHandling: boolean;
}
```

### Event Handler Type
```javascript
interface EventHandler {
  mouseDown: (e: MouseEvent) => void;
  mouseMove: (e: MouseEvent) => void;
  mouseUp: (e: MouseEvent) => void;
}
```

## Files
### Files to Modify
1. **src/components/FloatingDisplay.svelte** - Remove all local interaction state and fix event handlers
2. **src/stores/floatingStore.js** - Remove partial interactionActions (unused)

### Files to Test
1. **Browser testing** - User tests drag and resize functionality

## Functions
### Functions to Remove
1. **Local interaction state variables** in FloatingDisplay.svelte:
   - `isResizing`, `isDragging`, `resizeHandle`, `isHovered`
   - All local mouse position tracking variables

2. **interactionActions** in floatingStore.js:
   - Remove entire `interactionActions` export (partial implementation)

3. **Complex conditional logic** in FloatingDisplay.svelte:
   - Remove drag vs resize else-if chains in shared handlers

### Functions to Implement
1. **Simplified event handlers** in FloatingDisplay.svelte:
   - `handleMouseDown()` - Clear delegation to appropriate action
   - `handleDragMove()` - Dedicated drag handler using `actions.updateDrag()`
   - `handleResizeMove()` - Dedicated resize handler using `actions.updateResize()`
   - `handleMouseUp()` - Unified end handler using `actions.endDrag()` or `actions.endResize()`

2. **Resize handle starter** in FloatingDisplay.svelte:
   - `handleResizeStart()` - Direct call to `actions.startResize()`

## Classes
### No New Classes Required
Implementation uses existing component structure and proven store actions.

## Dependencies
### Existing Dependencies to Use
1. **actions from floatingStore.js** - Already implemented and working:
   - `startDrag()`, `updateDrag()`, `endDrag()`
   - `startResize()`, `updateResize()`, `endResize()`

### Dependencies to Remove
1. **interactionActions** - Remove partial implementation that's causing conflicts

## Testing
### User Testing Approach
1. **Drag Test**: User tests dragging displays smoothly without resize conflicts
2. **Resize Test**: User tests all 8 resize handles working correctly
3. **Conflict Test**: User tests switching between drag and resize operations
4. **Performance Test**: User verifies smooth 60fps interactions

## Implementation Order

### Step 1: Remove Conflicting State
- Remove all local interaction state variables from FloatingDisplay.svelte
- Remove interactionActions export from floatingStore.js
- Remove complex conditional logic from shared event handlers
- Replace template dependencies with store-based reactive statements
- Fix resize handle visibility using store state instead of local variables

### Step 2: Implement Clean Event Delegation
- Simplify handleMouseDown to delegate to correct action based on target
- Create dedicated handleDragMove using actions.updateDrag
- Create dedicated handleResizeMove using actions.updateResize
- Implement unified handleMouseUp using appropriate end action
- Add proper event listener cleanup in onDestroy

### Step 3: Fix Resize Handle Logic
- Simplify handleResizeStart to use actions.startResize directly
- Remove local state tracking and use store state exclusively
- Ensure proper event propagation control
- Verify action signatures match floatingStore.js implementations

### Step 4: Test and Validate
- User tests drag functionality working smoothly
- User tests resize functionality working correctly
- Verify no conflicts between drag and resize operations
  +++++++ REPLACE

## Success Criteria
- Drag operations work smoothly without resize conflicts
- All 8 resize handles work correctly with proper constraints
- No state synchronization issues between competing systems
- Clean, maintainable code with single responsibility functions
- Performance maintained at 60fps during interactions

## Implementation Pattern

### Event Handler Structure
```javascript
// BEFORE: Complex shared handler with conflicts
function handleMouseMove(e) {
  if ($floatingStore.draggedItem?.type === 'display' && $floatingStore.draggedItem?.id === id) {
    // Complex drag logic...
  } else if ($floatingStore.resizeState?.isResizing && $floatingStore.resizeState?.displayId === id) {
    // Complex resize logic...
  }
}

// AFTER: Simple delegated handlers
function handleDragMove(e) {
  const mousePos = { x: e.clientX, y: e.clientY };
  actions.updateDrag(mousePos);
}

function handleResizeMove(e) {
  const mousePos = { x: e.clientX, y: e.clientY };
  actions.updateResize(mousePos);
}
```

### Mouse Down Logic
```javascript
function handleMouseDown(e) {
  actions.setActiveDisplay(id);
  
  if (e.target.classList.contains('resize-handle')) {
    // Resize operation
    const handle = e.target.className.split(' ').find(c => ['nw','ne','se','sw','n','s','e','w'].includes(c));
    actions.startResize(id, handle, displayPosition, displaySize);
    document.addEventListener('mousemove', handleResizeMove);
  } else {
    // Drag operation
    actions.startDrag('display', id, displayPosition, { x: e.clientX, y: e.clientY });
    document.addEventListener('mousemove', handleDragMove);
  }
  
  document.addEventListener('mouseup', handleMouseUp);
  e.preventDefault();
}
```

This approach eliminates all state conflicts by using proven working store actions as the single authority for interaction state.
