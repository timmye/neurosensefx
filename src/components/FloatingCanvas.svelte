<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import Container from './viz/Container.svelte';
  import { workspaceState, activeCanvas, isDragging } from '../stores/workspaceState.js';
  import { uiState, isCanvasActive, isCanvasHovered } from '../stores/uiState.js';
  import { registryActions } from '../stores/canvasRegistry.js';
  
  export let id;
  export let symbol;
  export let config;
  export let state;
  export let position = { x: 100, y: 100 };
  
  const dispatch = createEventDispatcher();
  
  let localPosition = { ...position };
  let isLocalDragging = false;
  let canvasElement;
  let zIndex = 1;

  // Subscribe to store changes
  $: isActive = isCanvasActive(id);
  $: isHovered = isCanvasHovered(id);
  $: isGlobalDragging = $isDragging;
  $: activeCanvasData = $activeCanvas;

  // Update local position when store position changes
  $: if ($workspaceState.canvases.has(id)) {
      const canvasData = $workspaceState.canvases.get(id);
      if (canvasData.position !== localPosition) {
        localPosition = { ...canvasData.position };
      }
    }

  // Update z-index from registry
  onMount(() => {
    const updateZIndex = () => {
      zIndex = registryActions.getCanvasZIndex(id);
    };
    
    const unsubscribe = workspaceState.subscribe(updateZIndex);
    updateZIndex();
    
    return () => unsubscribe();
  });

  function handleRightClick(event) {
    event.preventDefault();
    
    // Mark as active in registry
    registryActions.markCanvasActive(id);
    
    // Dispatch event to parent (App.svelte) to show global context menu
    dispatch('contextMenu', {
      canvasId: id,
      position: { x: event.clientX, y: event.clientY }
    });
  }

  let dragOffset = { x: 0, y: 0 };
  
  function handleMouseDown(event) {
    if (event.button !== 0) return; // Only left-click
    
    // Mark as active
    registryActions.markCanvasActive(id);
    
    // Start drag if not on interactive elements
    if (!event.target.closest('button, input, select, .context-menu')) {
      isLocalDragging = true;
      
      const rect = canvasElement.getBoundingClientRect();
      dragOffset = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
      
      dispatch('dragStart', {
        canvasId: id,
        offset: dragOffset
      });
    }
  }

  function handleMouseEnter() {
    dispatch('hover', { canvasId: id, isHovering: true });
  }

  function handleMouseLeave() {
    dispatch('hover', { canvasId: id, isHovering: false });
  }

  function handleClose() {
    dispatch('close', { canvasId: id });
  }

  function handleConfigChange(event) {
    dispatch('configChange', {
      canvasId: id,
      config: event.detail
    });
  }


  // Global mouse events for dragging
  onMount(() => {
    const handleMouseMove = (event) => {
      if (isLocalDragging) {
        // Use the stored offset from dragStart
        const newPosition = {
          x: event.clientX - dragOffset.x,
          y: event.clientY - dragOffset.y
        };
        
        localPosition = newPosition;
        dispatch('dragMove', {
          canvasId: id,
          position: newPosition
        });
      }
    };
    
    const handleMouseUp = () => {
      if (isLocalDragging) {
        isLocalDragging = false;
        dispatch('dragEnd', {
          canvasId: id,
          position: localPosition
        });
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  });

</script>

<div 
  bind:this={canvasElement}
  class="floating-canvas"
  class:active={isActive}
  class:hovered={isHovered}
  class:dragging={isLocalDragging || isGlobalDragging}
  style="transform: translate({localPosition.x}px, {localPosition.y}px); z-index: {zIndex};"
  on:contextmenu={handleRightClick}
  on:mousedown={handleMouseDown}
  on:mouseenter={handleMouseEnter}
  on:mouseleave={handleMouseLeave}
  data-canvas-id={id}
>
  <!-- Canvas Header -->
  <div class="canvas-header">
    <div class="symbol-info">
      <span class="symbol-label">{symbol}</span>
      {#if isActive}
        <div class="active-indicator"></div>
      {/if}
    </div>
    <button 
      class="close-btn" 
      on:click={handleClose}
      title="Close canvas"
    >
      ×
    </button>
  </div>
  
  <!-- Visualization Container -->
  <div class="canvas-content">
    {#if config && state}
      <Container 
        {config} 
        {state}
        on:markerAdd={(event) => dispatch('markerAdd', { canvasId: id, ...event.detail })}
        on:markerRemove={(event) => dispatch('markerRemove', { canvasId: id, ...event.detail })}
      />
    {:else}
      <div class="loading-placeholder">
        <div class="loading-spinner"></div>
        <p>Initializing {symbol}...</p>
      </div>
    {/if}
  </div>
  
</div>

<style>
  .floating-canvas {
    position: absolute;
    background: #1f2937;
    border: 2px solid #374151;
    border-radius: 8px;
    cursor: grab;
    user-select: none;
    min-width: 250px;
    min-height: 150px;
    transition: transform 0.1s ease-out, border-color 0.2s ease, box-shadow 0.2s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  
  .floating-canvas.active {
    border-color: #4f46e5;
    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.3), 0 4px 12px rgba(0, 0, 0, 0.4);
  }
  
  .floating-canvas.hovered:not(.active) {
    border-color: #6b7280;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }
  
  .floating-canvas.dragging {
    cursor: grabbing;
    transition: none;
    transform: translate(var(--drag-x), var(--drag-y)) scale(1.02);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    z-index: 1000;
  }
  
  .canvas-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #374151;
    border-radius: 6px 6px 0 0;
    border-bottom: 1px solid #4b5563;
  }
  
  .symbol-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .symbol-label {
    font-weight: bold;
    color: #d1d5db;
    font-size: 14px;
    font-family: 'Courier New', monospace;
  }
  
  .active-indicator {
    width: 8px;
    height: 8px;
    background: #10b981;
    border-radius: 50%;
    animation: pulse 2s infinite;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  
  .close-btn {
    background: none;
    border: none;
    color: #ef4444;
    cursor: pointer;
    font-size: 18px;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background-color 0.2s ease;
  }
  
  .close-btn:hover {
    background: rgba(239, 68, 68, 0.2);
  }
  
  .canvas-content {
    padding: 8px;
    background: #111827;
    border-radius: 0 0 6px 6px;
  }
  
  .loading-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 120px;
    color: #6b7280;
    gap: 8px;
  }
  
  .loading-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid #374151;
    border-top: 2px solid #4f46e5;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
</style>
