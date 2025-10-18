<script>
  import { createEventDispatcher } from 'svelte';
  import InteractWrapper from './InteractWrapper.svelte';
  import { createLogger } from '../../utils/debugLogger.js';
  
  const logger = createLogger('FloatingPanelWithInteract');
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
  .draggable-panel {
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 8px;
    min-width: 200px;
    max-width: 320px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    transition: box-shadow 0.2s ease;
    pointer-events: auto;
  }
  
  .draggable-panel.minimized {
    min-width: 200px;
    max-width: 200px;
  }
  
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: #374151;
    border-bottom: 1px solid #4b5563;
    border-radius: 8px 8px 0 0;
    cursor: grab;
    user-select: none;
    pointer-events: auto;
    position: relative;
    z-index: 1;
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
    pointer-events: auto;
    position: relative;
    z-index: 2;
  }
  
  .control-btn:hover {
    background: rgba(156, 163, 175, 0.1);
    color: #d1d5db;
  }
  
  .panel-content {
    padding: 12px;
  }
</style>