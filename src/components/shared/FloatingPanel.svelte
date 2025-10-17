<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { useDraggablePanel } from '../../composables/useDraggable.js';
  
  // Props
  export let title = 'Panel';
  export let position = { x: 100, y: 100 };
  export let panelId = 'floating-panel';
  export let showMinimize = true;
  export let showClose = true;
  export let zIndex = 1000;
  export let onClose = null;
  export let onMinimizeChange = null;
  export let onPositionChange = null;
  export let defaultMinimized = false;
  export let boundaryPadding = 10;
  
  const dispatch = createEventDispatcher();
  
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
  
  // Forward position changes to parent
  $: if (draggable.position.x !== position.x || draggable.position.y !== position.y) {
    position = { ...draggable.position };
    if (onPositionChange) onPositionChange(position);
  }
</script>

<div 
  bind:this={draggable.element}
  class={draggable.getPanelClasses()}
  style={draggable.getPanelStyles()}
  data-panel-id={panelId}
>
  <!-- Drag Handle -->
  <div 
    bind:this={draggable.dragHandle}
    class={draggable.getDragHandleClasses()}
    on:mousedown={draggable.handleDragStart}
    on:touchstart={draggable.handleDragStart}
  >
    <div class="drag-indicator">⋮⋮</div>
    <div class="panel-title">{title}</div>
    <div class="panel-controls">
      {#if showMinimize}
        <button 
          class="control-btn minimize-btn" 
          on:click={draggable.handleMinimize}
          title={draggable.isMinimized ? "Expand" : "Minimize"}
        >
          {draggable.isMinimized ? '□' : '−'}
        </button>
      {/if}
      
      {#if showClose}
        <button 
          class="control-btn close-btn" 
          on:click={draggable.handleClose}
          title="Close"
        >
          ×
        </button>
      {/if}
    </div>
  </div>
  
  <!-- Panel Content -->
  {#if !draggable.isMinimized}
    <div class="panel-content">
      <slot />
    </div>
  {/if}
</div>

<style>
  .draggable-panel {
    position: fixed;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 8px;
    min-width: 200px;
    max-width: 320px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    transition: box-shadow 0.2s ease;
  }
  
  .draggable-panel.dragging {
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);
    cursor: grabbing;
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
  }
  
  .control-btn:hover {
    background: rgba(156, 163, 175, 0.1);
    color: #d1d5db;
  }
  
  .panel-content {
    padding: 12px;
  }
</style>