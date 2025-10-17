# CanvasContextMenu Integration Plan

## Overview

This document outlines the plan to properly integrate the CanvasContextMenu with right-click events on canvases, ensuring that parameter changes are correctly propagated to the visualizations. This integration is essential to complete the canvas-centric interface transformation.

## Current Issues

1. **Context Menu Not Triggered**: CanvasContextMenu may not be properly triggered from right-click on canvases
2. **Parameter Changes Not Propagated**: Changes in CanvasContextMenu may not be reflected in visualizations
3. **Event Handling Conflicts**: Multiple components trying to handle the same events
4. **State Synchronization Issues**: Inconsistent state between CanvasContextMenu and visualizations

## Integration Strategy

### Phase 1: Fix Right-Click Event Handling on FloatingCanvas

Update the FloatingCanvas component to properly trigger the CanvasContextMenu:

```javascript
// src/components/FloatingCanvas.svelte
<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { defaultConfig } from '../stores/configStore.js';
  import Container from './viz/Container.svelte';
  
  export let id = '';
  export let symbol = '';
  export let position = { x: 100, y: 100 };
  export let size = { width: 220, height: 120 };
  export let state = null;
  export let config = { ...defaultConfig };
  export let isActive = false;
  
  const dispatch = createEventDispatcher();
  let canvasElement = null;
  let contextMenuOpen = false;
  let contextMenuPosition = { x: 0, y: 0 };
  
  function handleRightClick(event) {
    // Prevent default context menu
    event.preventDefault();
    
    // Store context menu position
    contextMenuPosition = {
      x: event.clientX,
      y: event.clientY
    };
    
    // Open context menu
    contextMenuOpen = true;
    
    // Dispatch event to parent
    dispatch('openContextMenu', {
      canvasId: id,
      position: contextMenuPosition,
      config
    });
  }
  
  function handleContextMenuClose() {
    contextMenuOpen = false;
  }
  
  function handleConfigChange(event) {
    const { canvasId, parameter, value } = event.detail;
    
    if (canvasId === id) {
      // Update local config
      config[parameter] = value;
      
      // Dispatch to parent
      dispatch('configChange', {
        canvasId: id,
        parameter,
        value
      });
    }
  }
  
  function handleCanvasClick(event) {
    // Dispatch canvas click event
    dispatch('canvasClick', {
      canvasId: id,
      symbol
    });
  }
</script>

<div 
  class="floating-canvas {isActive ? 'active' : ''}"
  class:context-menu-open={contextMenuOpen}
  style="left: {position.x}px; top: {position.y}px; width: {size.width}px; height: {size.height}px;"
  on:contextmenu|preventDefault={handleRightClick}
  on:click={handleCanvasClick}
>
  <div class="canvas-header">
    <span class="symbol">{symbol}</span>
    <div class="header-controls">
      <button class="minimize-btn" title="Minimize">−</button>
      <button class="close-btn" title="Close">×</button>
    </div>
  </div>
  
  <div class="canvas-content" bind:this={canvasElement}>
    {#if state}
      <Container {state} {config} />
    {/if}
  </div>
</div>

<!-- CanvasContextMenu (rendered when open) -->
{#if contextMenuOpen}
  <CanvasContextMenu
    position={contextMenuPosition}
    canvasId={id}
    config={config}
    on:configChange={handleConfigChange}
    on:close={handleContextMenuClose}
  />
{/if}

<style>
  .floating-canvas {
    position: absolute;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    transition: box-shadow 0.2s ease, border-color 0.2s ease;
  }
  
  .floating-canvas.active {
    border-color: #4f46e5;
    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.3), 0 4px 12px rgba(0, 0, 0, 0.3);
  }
  
  .floating-canvas.context-menu-open {
    z-index: 10001;
  }
  
  .canvas-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 10px;
    background: #374151;
    cursor: move;
  }
  
  .symbol {
    color: #d1d5db;
    font-size: 12px;
    font-weight: 600;
  }
  
  .header-controls {
    display: flex;
    gap: 4px;
  }
  
  .minimize-btn, .close-btn {
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    font-size: 12px;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 2px;
  }
  
  .minimize-btn:hover, .close-btn:hover {
    background: #4b5563;
    color: #e5e7eb;
  }
  
  .close-btn:hover {
    background: #ef4444;
    color: white;
  }
  
  .canvas-content {
    width: 100%;
    height: calc(100% - 28px);
  }
</style>
```

### Phase 2: Update App.svelte to Handle CanvasContextMenu Events

Update App.svelte to properly handle events from FloatingCanvas:

```javascript
// In App.svelte script section
import CanvasContextMenu from './components/CanvasContextMenu.svelte';

// Add state for context menu
let showContextMenu = false;
let contextMenuCanvasId = null;
let contextMenuPosition = { x: 0, y: 0 };
let contextMenuConfig = null;

// Add event handlers for context menu
function handleOpenContextMenu(event) {
  const { canvasId, position, config } = event.detail;
  
  contextMenuCanvasId = canvasId;
  contextMenuPosition = position;
  contextMenuConfig = { ...config };
  showContextMenu = true;
  
  // Update active canvas
  activeCanvas = canvasId;
}

function handleContextMenuClose(event) {
  const { canvasId } = event.detail;
  
  if (canvasId === contextMenuCanvasId) {
    showContextMenu = false;
    contextMenuCanvasId = null;
  }
}

function handleCanvasConfigChange(event) {
  const { canvasId, parameter, value } = event.detail;
  
  // Update canvas configuration
  if (canvases.has(canvasId)) {
    const canvas = canvases.get(canvasId);
    canvas.config[parameter] = value;
    
    // Update symbol store
    symbolStore.updateConfig(canvas.symbol, canvas.config);
  }
}
```

```html
<!-- In App.svelte template section -->
<!-- CanvasContextMenu (rendered when open) -->
{#if showContextMenu}
  <CanvasContextMenu
    position={contextMenuPosition}
    canvasId={contextMenuCanvasId}
    config={contextMenuConfig}
    on:configChange={handleCanvasConfigChange}
    on:close={handleContextMenuClose}
  />
{/if}
```

### Phase 3: Update WorkspaceEventManager to Handle Context Menu Events

Update the WorkspaceEventManager to properly handle context menu events:

```javascript
// src/utils/WorkspaceEventManager.js
export class WorkspaceEventManager {
  constructor(workspaceElement) {
    this.workspace = workspaceElement;
    this.setupEventDelegation();
  }
  
  setupEventDelegation() {
    // Single listener for all canvas interactions
    this.workspace.addEventListener('contextmenu', this.handleRightClick.bind(this));
    this.workspace.addEventListener('mousedown', this.handleMouseDown.bind(this));
    
    // Document-level listeners for drag operations
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
  }
  
  handleRightClick(event) {
    const canvasElement = event.target.closest('.floating-canvas');
    
    if (canvasElement) {
      // Let the canvas handle its own context menu
      return;
    } else if (event.target === this.workspace) {
      // Show workspace-specific context menu (e.g., Add Display)
      this.showAddDisplayMenu(event.clientX, event.clientY);
    }
  }
  
  // ... other event handlers
}
```

### Phase 4: Standardize Event Handling Pattern

Create a standardized event handling pattern for all floating components:

```javascript
// src/utils/EventBus.js
class EventBus {
  constructor() {
    this.events = {};
  }
  
  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }
  
  off(event, callback) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    }
  }
  
  emit(event, data) {
    if (this.events[event]) {
      this.events[event].forEach(callback => callback(data));
    }
  }
}

export const eventBus = new EventBus();
```

### Phase 5: Fix State Synchronization

Ensure proper state synchronization between components:

```javascript
// src/stores/canvasStore.js
import { writable, derived } from 'svelte/store';
import { symbolStore } from './symbolStore.js';

export const canvases = writable(new Map());

export const activeCanvas = derived(
  canvases,
  $canvases => {
    // Find the active canvas
    for (const [id, canvas] of $canvases.entries()) {
      if (canvas.isActive) {
        return id;
      }
    }
    return null;
  }
);

export const activeCanvasData = derived(
  [canvases, activeCanvas],
  ([$canvases, $activeCanvas]) => {
    if ($activeCanvas && $canvases.has($activeCanvas)) {
      return $canvases.get($activeCanvas);
    }
    return null;
  }
);

// Helper functions to update canvas state
export function updateCanvasConfig(canvasId, parameter, value) {
  canvases.update(currentCanvases => {
    if (currentCanvases.has(canvasId)) {
      const canvas = currentCanvases.get(canvasId);
      canvas.config[parameter] = value;
      
      // Update symbol store
      symbolStore.updateConfig(canvas.symbol, canvas.config);
      
      return new Map(currentCanvases.set(canvasId, { ...canvas }));
    }
    return currentCanvases;
  });
}
```

## Integration Order

1. **Fix right-click event handling on FloatingCanvas** (Priority: High)
2. **Update App.svelte to handle CanvasContextMenu events** (Priority: High)
3. **Update WorkspaceEventManager** (Priority: Medium)
4. **Standardize event handling pattern** (Priority: Medium)
5. **Fix state synchronization** (Priority: High)
6. **Test integration and fix any issues** (Priority: High)

## Testing Strategy

1. **Unit Tests**: Test each component's event handling
2. **Integration Tests**: Test CanvasContextMenu integration with FloatingCanvas
3. **E2E Tests**: Test complete user workflows with context menu
4. **Visual Regression Tests**: Ensure UI consistency after integration

## Expected Benefits

1. **Proper Context Menu Triggering**: CanvasContextMenu opens on right-click of canvases
2. **Correct Parameter Propagation**: Changes in CanvasContextMenu are reflected in visualizations
3. **Consistent Event Handling**: Standardized pattern across all components
4. **Improved State Synchronization**: Consistent state between components

## Rollback Plan

If issues arise during implementation:

1. Keep original event handling in a separate branch
2. Implement changes incrementally with feature flags
3. Test thoroughly before merging
4. Have a quick revert strategy if critical issues are found

This integration plan will ensure that the CanvasContextMenu is properly integrated with the canvas-centric interface, providing an intuitive way for users to access and modify visualization parameters.