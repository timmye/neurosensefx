# InteractWrapper Migration Guide

## Overview

This guide explains how to migrate from the `useDraggable` composable to the new `InteractWrapper` component for floating panel functionality. The `InteractWrapper` component provides a more robust and feature-rich implementation using the interact.js library.

## Benefits of InteractWrapper

1. **More Robust Dragging**: Uses interact.js for better cross-browser compatibility and touch support
2. **Advanced Features**: Built-in support for inertia, snapping, and auto-scroll
3. **Better Performance**: Optimized event handling and rendering
4. **Easier Integration**: Component-based approach simplifies usage
5. **Enhanced Boundary Checking**: More sophisticated viewport and custom bounds support

## Migration Steps

### 1. Replace useDraggable Import

**Before:**
```javascript
import { useDraggablePanel } from '../../composables/useDraggable.js';
```

**After:**
```javascript
import InteractWrapper from './shared/InteractWrapper.svelte';
```

### 2. Update Component Structure

**Before:**
```javascript
// Initialize draggable functionality
const draggable = useDraggablePanel({
  title,
  positionKey: `floating-${panelId}-position`,
  minimizedKey: `floating-${panelId}-minimized`,
  defaultPosition: position,
  defaultMinimized,
  showMinimize,
  showClose,
  zIndex,
  onPositionChange,
  onMinimizeChange: (isMinimized) => {
    if (onMinimizeChange) onMinimizeChange(isMinimized);
    dispatch('minimizeChange', { isMinimized });
  },
  onClose: () => {
    if (onClose) onClose();
    dispatch('close');
  },
  boundaryPadding
});
```

**After:**
```javascript
// Internal state
let isMinimized = defaultMinimized;
let interactWrapperRef;

// Event handlers
function handlePositionChange(event) {
  position = event.detail.position;
  if (onPositionChange) {
    onPositionChange(position);
  }
  dispatch('positionChange', { position });
}

function handleMinimize() {
  isMinimized = !isMinimized;
  if (interactWrapperRef) {
    interactWrapperRef.setMinimized(isMinimized);
  }
  if (onMinimizeChange) {
    onMinimizeChange(isMinimized);
  }
  dispatch('minimizeChange', { isMinimized });
}
```

### 3. Update Template

**Before:**
```html
<div
  bind:this={draggable.element}
  class="draggable-panel {draggable.isMinimized ? 'minimized' : ''} {draggable.isDragging ? 'dragging' : ''}"
  style="position: fixed; left: {draggable.position.x}px; top: {draggable.position.y}px; z-index: {zIndex};"
  data-panel-id={panelId}
>
  <!-- Drag Handle -->
  <div
    bind:this={draggable.dragHandle}
    class="drag-handle {draggable.isDragging ? 'grabbing' : ''}"
    style="position: relative; z-index: {zIndex + 1};"
    on:mousedown={draggable.handleDragStart}
    on:touchstart={draggable.handleDragStart}
  >
    <!-- Header content -->
  </div>
  
  <!-- Panel content -->
</div>
```

**After:**
```html
<InteractWrapper
  bind:this={interactWrapperRef}
  position={position}
  defaultPosition={position}
  positionKey={`interact-${panelId}-position`}
  on:positionChange={handlePositionChange}
  isDraggable={true}
  isResizable={false}
  inertia={true}
  boundaryPadding={boundaryPadding}
>
  <div class="draggable-panel {isMinimized ? 'minimized' : ''}" style="z-index: {zIndex};">
    <!-- Panel Header -->
    <div class="panel-header">
      <!-- Header content -->
    </div>
    
    <!-- Panel content -->
  </div>
</InteractWrapper>
```

## Complete Example

Here's a complete example of a migrated component:

```html
<script>
  import { createEventDispatcher } from 'svelte';
  import InteractWrapper from './shared/InteractWrapper.svelte';
  import { createLogger } from '../../utils/debugLogger.js';
  
  const logger = createLogger('MyFloatingPanel');
  const dispatch = createEventDispatcher();
  
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
  
  // Internal state
  let isMinimized = defaultMinimized;
  let interactWrapperRef;
  
  // Event handlers
  function handlePositionChange(event) {
    position = event.detail.position;
    logger.debug('Position changed', { position });
    
    if (onPositionChange) {
      onPositionChange(position);
    }
    
    dispatch('positionChange', { position });
  }
  
  function handleMinimize() {
    isMinimized = !isMinimized;
    if (interactWrapperRef) {
      interactWrapperRef.setMinimized(isMinimized);
    }
    logger.debug('Minimize toggled', { isMinimized });
    
    if (onMinimizeChange) {
      onMinimizeChange(isMinimized);
    }
    
    dispatch('minimizeChange', { isMinimized });
  }
  
  function handleClose() {
    logger.debug('Panel closed');
    
    if (onClose) {
      onClose();
    }
    
    dispatch('close');
  }
</script>

<InteractWrapper
  bind:this={interactWrapperRef}
  position={position}
  defaultPosition={position}
  positionKey={`interact-${panelId}-position`}
  on:positionChange={handlePositionChange}
  isDraggable={true}
  isResizable={false}
  inertia={true}
  boundaryPadding={boundaryPadding}
>
  <div class="draggable-panel {isMinimized ? 'minimized' : ''}" style="z-index: {zIndex};">
    <!-- Panel Header -->
    <div class="panel-header">
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
  /* Component styles */
</style>
```

## Advanced Features

### Snapping

To enable snapping behavior:

```html
<InteractWrapper
  snap={{
    targets: [
      { x: 100, y: 100 },
      { x: 200, y: 200 }
    ],
    relativePoints: [{ x: 0, y: 0 }],
    offset: { x: 0, y: 0 }
  }}
  /* other props */
>
  <!-- content -->
</InteractWrapper>
```

### Custom Bounds

To restrict dragging to a specific area:

```html
<InteractWrapper
  bounds={{
    left: 0,
    top: 0,
    right: 800,
    bottom: 600
  }}
  /* other props */
>
  <!-- content -->
</InteractWrapper>
```

### Resizable Panels

To make a panel resizable:

```html
<InteractWrapper
  isResizable={true}
  /* other props */
>
  <!-- content -->
</InteractWrapper>
```

## Troubleshooting

### Issue: Panel not dragging

**Solution**: Ensure `isDraggable={true}` is set on the InteractWrapper component.

### Issue: Position not persisting

**Solution**: Check that the `positionKey` prop is unique for each panel instance.

### Issue: Panel going off-screen

**Solution**: Adjust the `boundaryPadding` prop or provide custom bounds.

### Issue: Events not firing

**Solution**: Ensure event handlers are properly defined and bound to the component.

## Performance Considerations

1. **Limit the number of resizable panels**: Resizing requires more computation.
2. **Use inertia sparingly**: Inertia can improve user experience but may impact performance on slower devices.
3. **Optimize snap targets**: Too many snap targets can impact performance.

## Conclusion

The InteractWrapper component provides a more robust and feature-rich alternative to the useDraggable composable. By following this migration guide, you can easily upgrade your floating panels to take advantage of the enhanced functionality.