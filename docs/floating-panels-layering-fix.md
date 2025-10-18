# Floating Panels Layering Fix

## Problem Analysis

The floating panels (FloatingSymbolPalette, FloatingDebugPanel, etc.) are being covered by the workspace container's background image. The current structure has:

1. **Workspace Container**: `z-index: 10` with background gradient
2. **FloatingSymbolPalette**: `z-index: 1103` (passed as prop)
3. **InteractWrapper**: `z-index: 9999` only when dragging

The issue is that the workspace container's background image is covering the floating panels despite their higher z-index values.

## Structural Solution

Instead of just increasing z-index values (which is a fragile solution), we need to reorganize the DOM structure to establish a proper layering system:

### New DOM Structure

```html
<main>
  <!-- Background Layer (z-index: 1) -->
  <div class="main-container">
    <div class="viz-area">
      <div class="workspace-container" z-index: 1>
        <!-- Background gradients and empty state -->
      </div>
    </div>
  </div>
  
  <!-- Floating Panels Layer (z-index: 1000+) -->
  <div class="floating-panels-layer">
    <!-- All floating panels and canvases -->
    <div class="floating-canvases-layer">
      <!-- FloatingCanvas components -->
    </div>
    
    <!-- Floating Panels -->
    <FloatingSymbolPalette zIndex={1001} />
    <FloatingDebugPanel zIndex={1002} />
    <FloatingSystemPanel zIndex={1003} />
    <FloatingMultiSymbolADR zIndex={1004} />
    
    <!-- Context Menu -->
    <CanvasContextMenu zIndex={10000} />
  </div>
</main>
```

## Implementation Steps

### 1. Update App.svelte Structure

Replace the current structure in App.svelte with the new layered approach:

```html
<main>
  <!-- Background Layer -->
  <div class="main-container">
    <div class="viz-area">
      <div
        bind:this={workspaceElement}
        class="workspace-container"
        class:show-grid={$workspaceState.showGrid}
      >
        <!-- Empty State for Workspace -->
        {#if $workspaceState.canvases.size === 0}
          <div class="workspace-empty-state">
            <!-- Empty state with no text or buttons -->
          </div>
        {/if}
      </div>
    </div>
  </div>
  
  <!-- Floating Panels Layer -->
  <div class="floating-panels-layer">
    <!-- Floating Canvases -->
    <div class="floating-canvases-layer">
      {#each Array.from($workspaceState.canvases.values()) as canvas (canvas.id)}
        <FloatingCanvas
          id={canvas.id}
          symbol={canvas.symbol}
          config={canvas.config}
          state={canvas.state}
          position={canvas.position}
          on:contextMenu={handleCanvasContextMenu}
          on:close={handleCanvasClose}
          on:configChange={handleCanvasConfigChange}
          on:configReset={handleCanvasConfigReset}
          on:dragStart={handleCanvasDragStart}
          on:dragMove={handleCanvasDragMove}
          on:dragEnd={handleCanvasDragEnd}
          on:hover={handleCanvasHover}
        />
      {/each}
    </div>
    
    <!-- Floating Symbol Palette -->
    <FloatingSymbolPalette
      zIndex={1001}
      on:canvasCreated={(event) => {
        console.log('🔍 DEBUG: canvasCreated event received', { event, detail: event.detail });
        // Use the canvas data from the event if available, otherwise create new
        if (event.detail.canvasData) {
          workspaceActions.addCanvas(event.detail.canvasData);
        } else {
          addFloatingCanvas(event.detail.symbol, event.detail.position);
        }
      }}
    />
    
    <!-- Floating Debug Panel -->
    <FloatingDebugPanel
      zIndex={1002}
      on:close={() => uiActions.hideFloatingDebugPanel()}
    />
    
    <!-- Floating System Panel -->
    <FloatingSystemPanel
      zIndex={1003}
      on:dataSourceChange={handleDataSourceChange}
    />
    
    <!-- Floating Multi Symbol ADR -->
    <FloatingMultiSymbolADR
      zIndex={1004}
      on:close={() => uiActions.hideFloatingADRPanel()}
    />
    
    <!-- Global Context Menu -->
    {#if showContextMenu && contextMenuCanvasId}
      <CanvasContextMenu
        position={contextMenuPosition}
        canvasId={contextMenuCanvasId}
        config={contextMenuConfig}
        on:configChange={handleCanvasConfigChange}
        on:configReset={handleCanvasConfigReset}
        on:close={handleContextMenuClose}
      />
    {/if}
  </div>
</main>
```

### 2. Update CSS in App.svelte

Add new CSS classes for the floating panels layer:

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

/* Update workspace container z-index */
.workspace-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #111827;
  background-image:
    radial-gradient(circle at 20% 50%, rgba(79, 70, 229, 0.1) 0%, transparent 50%),
    radial-gradient(circle at 80% 80%, rgba(16, 185, 129, 0.1) 0%, transparent 50%),
    radial-gradient(circle at 40% 20%, rgba(239, 68, 68, 0.1) 0%, transparent 50%);
  z-index: 1; /* Reduced from 10 to ensure it's in the background */
}
```

### 3. Update InteractWrapper.svelte

Ensure the InteractWrapper has a proper base z-index:

```css
.interact-wrapper {
  position: fixed;
  left: 0;
  top: 0;
  touch-action: none;
  user-select: none;
  z-index: 1000; /* Add base z-index */
}

.interact-wrapper.dragging {
  cursor: grabbing;
  z-index: 9999;
}
```

### 4. Update FloatingSymbolPalette.svelte

Ensure the draggable-panel has the correct z-index:

```css
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
  z-index: inherit; /* Use the z-index from the style attribute */
}
```

## Benefits of This Approach

1. **Clear Layer Separation**: Background and floating elements are in separate layers
2. **Predictable Z-Index Hierarchy**: Each layer has a clear z-index range
3. **Scalability**: Easy to add new floating elements without z-index conflicts
4. **Maintainability**: Clear structure makes it easier to understand and modify
5. **No Z-Index Arms Race**: Avoids constantly increasing z-index values

## Testing Checklist

After implementation, verify:

1. [ ] All floating panels are visible above the workspace background
2. [ ] FloatingSymbolPalette is fully functional (drag, minimize, close)
3. [ ] FloatingDebugPanel is fully functional
4. [ ] FloatingSystemPanel is fully functional
5. [ ] FloatingMultiSymbolADR is fully functional
6. [ ] Canvas context menu appears above all panels
7. [ ] Position persistence works correctly for all panels
8. [ ] Drag functionality works smoothly
9. [ ] No z-index conflicts between elements
10. [ ] Background gradients are still visible

## Implementation Order

1. Update App.svelte structure and CSS
2. Update InteractWrapper.svelte base z-index
3. Test FloatingSymbolPalette visibility and functionality
4. Uncomment and test other floating panels
5. Test all interactions and position persistence
6. Run baseline tests to ensure no regressions