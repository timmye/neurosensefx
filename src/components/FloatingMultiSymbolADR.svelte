<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { displays } from '../stores/displayStore.js';
  import { drawMultiSymbolADR } from '../lib/viz/multiSymbolADR.js';
  import InteractWrapper from './shared/InteractWrapper.svelte';
  import InfoGrid from './shared/InfoGrid.svelte';
  import SectionHeader from './shared/SectionHeader.svelte';
  import { getZIndex } from '../constants/zIndex.js';
  import { createLogger } from '../utils/debugLogger.js';
  
  const dispatch = createEventDispatcher();
  const logger = createLogger('FloatingMultiSymbolADR');
  
  // Component state
  let adrPosition = { x: 20, y: 20 }; // Top left position
  let isMinimized = false;
  let canvasElement;
  let ctx;
  let symbols = [];
  let symbolsToRender = [];
  let interactWrapperRef;
  
  // Canvas dimensions
  const width = 120;
  const height = 300;
  const IS_DEBUG = true;
  
  // Subscribe to displays store
  const unsubSymbolStore = displays.subscribe(value => {
    symbols = Array.from(value.keys());
    
    // Process symbols for rendering
    if (!value || value.size === 0) {
      symbolsToRender = [];
    } else {
      symbolsToRender = Array.from(value.entries())
        .map(([symbolName, symbolData]) => {
          // Check if essential state for calculation exists
          if (symbolData && symbolData.state && typeof symbolData.state.currentPrice === 'number' && typeof symbolData.state.todaysHigh === 'number' && typeof symbolData.state.todaysLow === 'number') {
            
            const state = symbolData.state;
            
            // Calculate adrPercentage here, using to exact same logic as the main visualization.
            const adrPercentage = (state.todaysHigh > state.todaysLow) ? ((state.currentPrice - state.todaysLow) / (state.todaysHigh - state.todaysLow)) * 200 - 100 : 0;

            return {
              symbolName: symbolName,
              adrPercentage: adrPercentage
            };
          }
          return null;
        })
        .filter(Boolean);
    }
    
    // Trigger canvas redraw
    if (ctx) {
      drawMultiSymbolADR(ctx, { width, height }, symbolsToRender);
    }
  });
  
  onMount(() => {
    // Initialize canvas
    if (canvasElement) {
      ctx = canvasElement.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      
      canvasElement.width = width * dpr;
      canvasElement.height = height * dpr;
      canvasElement.style.width = `${width}px`;
      canvasElement.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
      
      logger.debug('Component mounted and canvas initialized');
      
      // Initial draw
      drawMultiSymbolADR(ctx, { width, height }, symbolsToRender);
    }
  });
  
  onDestroy(() => {
    unsubSymbolStore();
  });
  
  function handleClose() {
    logger.debug('ADR panel closed');
    dispatch('close');
  }
  
  function handlePositionChange(event) {
    adrPosition = event.detail.position;
    logger.debug('Position changed', { position: adrPosition });
  }
  
  function handleMinimize() {
    isMinimized = !isMinimized;
    if (interactWrapperRef) {
      interactWrapperRef.setMinimized(isMinimized);
    }
    logger.debug('Minimize toggled', { isMinimized });
    dispatch('minimizeChange', { isMinimized });
  }
</script>

<InteractWrapper
  bind:this={interactWrapperRef}
  position={adrPosition}
  defaultPosition={adrPosition}
  positionKey="floating-adr-panel-position"
  on:positionChange={handlePositionChange}
  isDraggable={true}
  isResizable={false}
  inertia={true}
  boundaryPadding={10}
>
  <div class="draggable-panel {isMinimized ? 'minimized' : ''}" style="z-index: {getZIndex('ADR_PANEL')};">
    <!-- Panel Header -->
    <div class="panel-header">
      <div class="drag-indicator">⋮⋮</div>
      <div class="panel-title">ADR Overview</div>
      <div class="panel-controls">
        <button
          class="control-btn minimize-btn"
          on:click={handleMinimize}
          title={isMinimized ? "Expand" : "Minimize"}
        >
          {isMinimized ? '□' : '−'}
        </button>
        
        <button
          class="control-btn close-btn"
          on:click={handleClose}
          title="Close"
        >
          ×
        </button>
      </div>
    </div>
    
    <!-- Panel Content -->
    {#if !isMinimized}
      <div class="panel-content">
  <div class="adr-content">
    <div class="adr-canvas-container">
      <canvas bind:this={canvasElement}></canvas>
    </div>
    
    <div class="adr-info">
      <div class="info-section">
        <SectionHeader title="Active Symbols" />
        <InfoGrid
          data={[
            { label: "Total:", value: symbols.length },
            { label: "With Data:", value: symbolsToRender.length }
          ]}
        />
      </div>
    </div>
  </div>
      </div>
    {/if}
  </div>
</InteractWrapper>

<style>
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
  
  .adr-canvas-container {
    display: flex;
    justify-content: center;
    margin-bottom: 12px;
  }
  
  canvas {
    display: block;
    background-color: #0a0a0a;
    border-radius: 4px;
    pointer-events: none;
  }
  
  .adr-info {
    font-size: 11px;
  }
  
  .info-section {
    margin-bottom: 12px;
  }
  
  .info-section:last-child {
    margin-bottom: 0;
  }
</style>
