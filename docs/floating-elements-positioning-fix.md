# Floating Elements Positioning Fix

## Problem Analysis
The floating elements (panels) are appearing at full width and below the workspace canvas on startup instead of floating properly at their designated positions.

## Root Causes Identified

1. **CSS Positioning Issue in FloatingPanel.svelte**
   - The panel is using `position: fixed` but the inline style might be getting overridden
   - The z-index might not be high enough to appear above the workspace

2. **Z-index Conflict**
   - Workspace container has z-index of 10 (App.svelte line 328)
   - Floating panels need to be above this value

3. **Initial Positioning Problem**
   - The useDraggable composable loads saved positions from localStorage
   - If no position exists, it uses default position but might not be applying it correctly

## Fix Plan

### 1. Fix FloatingPanel Component CSS
- Update the inline style to ensure proper positioning
- Increase z-index to ensure panels appear above workspace
- Make sure position: fixed is properly applied

### 2. Update useDraggable Composable
- Ensure initial position is properly set before component renders
- Add debug logging to track position changes
- Fix the ensureInViewport function to work correctly on initial load

### 3. Verify Z-index Layering
- Ensure floating panels have z-index higher than workspace (z-index: 100)
- Make sure context menu has even higher z-index (z-index: 1000)

## Implementation Steps

1. Update FloatingPanel.svelte to fix positioning CSS
2. Update useDraggable.js to properly handle initial positioning
3. Test all floating panels (SymbolPalette, DebugPanel, SystemPanel, MultiSymbolADR)
4. Verify fix works on startup and after interactions

## Files to Modify

1. `src/components/shared/FloatingPanel.svelte`
   - Fix inline style for positioning
   - Ensure proper z-index value

2. `src/composables/useDraggable.js`
   - Fix initial position handling
   - Improve ensureInViewport function
   - Add debug logging

## Testing

1. Start application and verify all floating panels appear at correct positions
2. Test dragging panels to new positions
3. Test minimizing/maximizing panels
4. Test closing and reopening panels
5. Verify panels stay above workspace canvas at all times