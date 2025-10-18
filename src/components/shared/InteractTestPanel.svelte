<script>
  import { createEventDispatcher } from 'svelte';
  import InteractWrapper from './InteractWrapper.svelte';
  import { createLogger } from '../../utils/debugLogger.js';
  
  const logger = createLogger('InteractTestPanel');
  const dispatch = createEventDispatcher();
  
  // Props
  export let title = 'Test Panel';
  export let initialPosition = { x: 100, y: 100 };
  export let panelId = 'test-panel';
  export let showMinimize = true;
  export let showClose = true;
  export let zIndex = 100;
  
  // Internal state
  let position = { ...initialPosition };
  let isMinimized = false;
  let interactWrapperRef;
  
  // Event handlers
  function handlePositionChange(event) {
    position = event.detail.position;
    logger.debug('Position changed', { position });
    dispatch('positionChange', { position });
  }
  
  function handleDragStart(event) {
    logger.debug('Drag started', { position: event.detail.position });
    dispatch('dragStart', event.detail);
  }
  
  function handleDragMove(event) {
    logger.debug('Drag move', { position: event.detail.position });
    dispatch('dragMove', event.detail);
  }
  
  function handleDragEnd(event) {
    logger.debug('Drag ended', { position: event.detail.position });
    dispatch('dragEnd', event.detail);
  }
  
  function handleMinimize() {
    isMinimized = !isMinimized;
    if (interactWrapperRef) {
      interactWrapperRef.setMinimized(isMinimized);
    }
    logger.debug('Minimize toggled', { isMinimized });
    dispatch('minimizeChange', { isMinimized });
  }
  
  function handleClose() {
    logger.debug('Panel closed');
    dispatch('close');
  }
  
  function handleResize(event) {
    logger.debug('Panel resized', event.detail);
    dispatch('resize', event.detail);
  }
</script>

<InteractWrapper
  bind:this={interactWrapperRef}
  position={position}
  defaultPosition={initialPosition}
  positionKey={`interact-test-${panelId}-position`}
  on:positionChange={handlePositionChange}
  on:dragStart={handleDragStart}
  on:dragMove={handleDragMove}
  on:dragEnd={handleDragEnd}
  on:minimizeChange={handleMinimize}
  on:resize={handleResize}
  isDraggable={true}
  isResizable={true}
  inertia={true}
  boundaryPadding={10}
>
  <div class="test-panel" style="z-index: {zIndex};">
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
        <div class="test-info">
          <h4>InteractWrapper Test Panel</h4>
          <p>Panel ID: {panelId}</p>
          <p>Position: ({Math.round(position.x)}, {Math.round(position.y)})</p>
          <p>Minimized: {isMinimized ? 'Yes' : 'No'}</p>
        </div>
        
        <div class="test-controls">
          <button on:click={() => interactWrapperRef?.updatePosition({ x: 200, y: 200 })}>
            Reset Position
          </button>
          <button on:click={() => alert('Current position: ' + JSON.stringify(position))}>
            Show Position
          </button>
        </div>
      </div>
    {/if}
  </div>
</InteractWrapper>

<style>
  .test-panel {
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 8px;
    min-width: 250px;
    max-width: 320px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    transition: box-shadow 0.2s ease;
    pointer-events: auto;
    display: flex;
    flex-direction: column;
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
  
  .test-info {
    margin-bottom: 16px;
  }
  
  .test-info h4 {
    margin: 0 0 8px 0;
    color: #d1d5db;
    font-size: 12px;
    font-weight: 600;
  }
  
  .test-info p {
    margin: 4px 0;
    color: #9ca3af;
    font-size: 11px;
  }
  
  .test-controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .test-controls button {
    padding: 6px 10px;
    background: #374151;
    border: 1px solid #4b5563;
    border-radius: 4px;
    color: #d1d5db;
    font-size: 11px;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }
  
  .test-controls button:hover {
    background: #4b5563;
  }
</style>