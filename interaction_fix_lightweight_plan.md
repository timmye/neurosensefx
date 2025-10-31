# Lightweight Interaction Fix Plan

## Problem Summary
- **Dragging**: Container snaps to 0,0 instead of following cursor properly
- **Resizing**: Each resize handle behaves incorrectly - corners move instead of resizing from correct anchor points

## Root Cause Analysis
1. **Event propagation conflicts** between drag and resize handlers
2. **Coordinate system mismatches** in mouse position calculations
3. **Wrong reference points** causing 0,0 snapping behavior
4. **Store vs component state inconsistencies** in interaction logic

## Fix Implementation Steps

### Step 1: Fix Event Handler Architecture
- Clean up mouseDown event delegation in `FloatingDisplay.svelte`
- Ensure resize handles properly stop event propagation
- Fix drag vs resize event routing logic

### Step 2: Fix Coordinate Calculations
- Correct drag offset calculations (mouse position - element start position)
- Fix resize handle coordinate references (use correct anchor points)
- Standardize coordinate systems between store and component

### Step 3: Fix Store Integration
- Simplify `updateResize` logic in `floatingStore.js`
- Ensure proper position/size updates for each handle type
- Fix minimum size constraints handling

### Step 4: Validate All 8 Resize Handles
- NW: resize width/height from top-left, move position down-right
- NE: resize width/height from top-right, move position down
- SE: resize width/height from bottom-right, position unchanged
- SW: resize width/height from bottom-left, move position right
- N: resize height from top, move position down
- S: resize height from bottom, position unchanged  
- E: resize width from right, position unchanged
- W: resize width from left, move position right

## Files to Modify
1. `src/components/FloatingDisplay.svelte` - Event handlers and coordinate logic
2. `src/stores/floatingStore.js` - `updateResize` action fixes

## Testing Approach
- Browser testing after each step
- Test drag behavior: smooth cursor following without snapping
- Test each resize handle individually
- Verify minimum size constraints work
- Test switching between drag and resize operations

## Implementation Progress

### ✅ Completed Fixes
- [x] Fixed event handler architecture in FloatingDisplay.svelte
- [x] Fixed drag coordinate calculations using proper mouse offset
- [x] Updated store updateDrag function to use startMousePos properly
- [x] Fixed resize handle coordinate calculations in updateResize function
- [x] Added proper event propagation handling for resize handles

### 🔄 Current Status
- **Drag Fix**: Implemented but needs testing for 0,0 snapping issue
- **Resize Fix**: All 8 handle types implemented with proper coordinate calculations
- **Event Propagation**: Resize handles properly stop propagation to prevent drag conflicts

## Testing Plan
1. Test drag behavior - should follow cursor without snapping to 0,0
2. Test each resize handle individually:
   - NW: resize from top-left corner
   - NE: resize from top-right corner  
   - SE: resize from bottom-right corner
   - SW: resize from bottom-left corner
   - N, S, E, W: resize from edges
3. Test switching between drag and resize operations
4. Test collision detection (if enabled)

## Success Criteria
- Dragging: Container follows cursor smoothly from initial click position
- Resizing: All 8 handles resize correctly with proper anchor points
- No conflicts between drag and resize operations
- Smooth 60fps performance during interactions
