# Interaction System Cleanup Implementation Plan

## Overview
Fix move and resize functionality by removing dual-system conflicts and implementing clean unified interaction system in FloatingDisplay.svelte, leveraging existing interactionActions foundation.

## Scope and Context
The current implementation has architectural conflicts between legacy and unified interaction systems causing race conditions and state synchronization issues. This implementation removes all legacy interaction code and implements a clean, single-system approach using the existing interactionActions framework.

## Types
### Unified Interaction State
```javascript
interface InteractionState {
  mode: 'idle' | 'dragging' | 'resizing';
  activeDisplayId: string | null;
  resizeHandle: string | null;
  startData: {
    mousePosition: { x: number, y: number };
    displayPosition: { x: number, y: number };
    displaySize: { width: number, height: number };
  };
  constraints: {
    minSize: { width: number, height: number };
    maxSize: { width: number, height: number };
  };
}
```

## Files
### Files to Modify
1. **src/components/FloatingDisplay.svelte** - Remove legacy interaction code, implement clean unified system
2. **src/stores/floatingStore.js** - Minor cleanup of unused legacy actions

### Files to Test
1. **Browser testing** - User will test drag/resize functionality directly

## Functions
### Functions to Remove
1. **Legacy event handlers** in FloatingDisplay.svelte:
   - Complex `handleMouseMove()` with dual-system delegation
   - Local drag state variables (`isDragging`, `mousemoveListenerExists`, etc.)
   - Legacy resize handle start logic with dual system calls

### Functions to Implement
1. **Clean interaction handlers** in FloatingDisplay.svelte:
   - `handleMouseDown()` - Direct interaction start using interactionActions
   - `handleMouseMove()` - Simple delegation to interactionActions.updateInteraction
   - `handleMouseUp()` - Clean interaction end using interactionActions.endInteraction
   - `handleResizeStart()` - Direct resize start using interactionActions

## Classes
### No New Classes Required
Implementation uses existing interactionActions and component structure.

## Dependencies
### Existing Dependencies to Use
1. **interactionActions** from floatingStore.js - Already implemented and working
2. **floatingStore** - Existing state management
3. **GEOMETRY foundation** - Existing constraints and transforms

### No New Dependencies Required
Uses only existing architecture components.

## Testing
### User Testing Approach
1. **Drag Test**: User tests dragging displays smoothly without conflicts
2. **Resize Test**: User tests all 8 resize handles working correctly
3. **Combined Test**: User tests switching between drag and resize operations
4. **Performance Test**: User verifies smooth 60fps interactions

## Implementation Order

### Step 1: Clean Event Handler Architecture
- Remove all local drag state variables from FloatingDisplay.svelte
- Remove complex conditional logic in handleMouseMove
- Remove legacy system calls (actions.updateDrag, actions.updateResize)

### Step 2: Implement Clean Unified Handlers
- Simplify handleMouseDown to use interactionActions.startInteraction
- Simplify handleMouseMove to use interactionActions.updateInteraction
- Simplify handleMouseUp to use interactionActions.endInteraction
- Simplify handleResizeStart to use interactionActions.startInteraction

### Step 3: Clean Up Store
- Remove unused legacy interaction actions from floatingStore.js
- Keep only unified interactionActions for consistency

### Step 4: Remove Legacy State References
- Remove all references to draggedItem, resizeState in FloatingDisplay.svelte
- Use only interactionState for all interaction decisions

### Step 5: Test and Validate
- User tests drag functionality working smoothly
- User tests resize functionality working correctly
- Verify no conflicts between drag and resize operations

## Success Criteria
- Drag operations work smoothly without jitter or conflicts
- All 8 resize handles work correctly with proper constraints
- No state synchronization issues between systems
- Clean, maintainable code with single responsibility functions
- Performance maintained at 60fps during interactions
