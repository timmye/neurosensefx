<script>
  import { onMount, onDestroy } from 'svelte';
  import { floatingStore, actions } from '../stores/floatingStore.js';
  import { connectionManager, canvasDataStore } from '../data/ConnectionManager.js';
  import { scaleLinear } from 'd3-scale';
  
  // Import drawing functions
  import { drawMarketProfile } from '../lib/viz/marketProfile.js';
  import { drawDayRangeMeter } from '../lib/viz/dayRangeMeter.js';
  import { drawVolatilityOrb } from '../lib/viz/volatilityOrb.js';
  import { drawPriceFloat } from '../lib/viz/priceFloat.js';
  import { drawPriceDisplay } from '../lib/viz/priceDisplay.js';
  import { drawVolatilityMetric } from '../lib/viz/volatilityMetric.js';
  import { drawPriceMarkers } from '../lib/viz/priceMarkers.js';
  import { drawHoverIndicator } from '../lib/viz/hoverIndicator.js';
  import { markerStore } from '../stores/markerStore.js';
  import { writable } from 'svelte/store';
  
  export let id;
  export let symbol;
  export let position = { x: 100, y: 100 };
  
  // Local state
  let element;
  let canvas;
  let ctx;
  let dpr = 1;
  
  // Hover and marker state
  const hoverState = writable(null);
  let markers = [];
  
  // Component state variables
  let canvasData = {};
  let config = {};
  let state = {};
  let isReady = false;
  let display = null;
  let isActive = false;
  let currentZIndex = 1;
  
  // Store subscriptions - use only canvasDataStore (FIX)
  $: if ($canvasDataStore) {
    canvasData = $canvasDataStore.get(id) || {};
    config = canvasData.config || {};
    state = canvasData.state || {};
    isReady = canvasData?.ready || false;
    
    // For display management, use floatingStore for UI state only
    display = $floatingStore.displays?.get(id);
    isActive = display?.isActive || false;
    currentZIndex = display?.zIndex || 1;
    
    // Debug reactive dependencies
    console.log(`[REACTIVE_DEBUG] Dependencies updated for ${symbol}:`, {
      canvasData: !!canvasData,
      config: !!config,
      state: !!state,
      isReady,
      canvasDataKeys: Object.keys(canvasData),
      stateKeys: Object.keys(state),
      configKeys: Object.keys(config),
      display: !!display,
      isActive
    });
  }
  
  // Update markers from store
  $: if ($markerStore !== undefined) {
    markers = $markerStore;
  }
  
  // Canvas setup
  onMount(() => {
    // Start render loop when canvas becomes available
    const checkCanvas = setInterval(() => {
      if (canvas && !ctx) {
        ctx = canvas.getContext('2d');
        dpr = window.devicePixelRatio || 1;
        
        // Initialize canvas
        updateCanvasSize();
        
        clearInterval(checkCanvas);
      }
    }, 100);
    
    return () => {
      clearInterval(checkCanvas);
    };
  });
  
  // Update canvas size when config changes (but only when dimensions actually change)
  $: if (canvas && config && ctx && config.visualizationsContentWidth && config.meterHeight) {
    const currentWidth = canvas.width;
    const currentHeight = canvas.height;
    const newWidth = Math.floor(config.visualizationsContentWidth * dpr);
    const newHeight = Math.floor(config.meterHeight * dpr);
    
    if (currentWidth !== newWidth || currentHeight !== newHeight) {
      updateCanvasSize();
    }
  }
  
  function updateCanvasSize() {
    if (!canvas || !ctx || !config || !config.visualizationsContentWidth || !config.meterHeight) return;
    
    const { visualizationsContentWidth, meterHeight } = config;
    
    canvas.width = Math.floor(visualizationsContentWidth * dpr);
    canvas.height = Math.floor(meterHeight * dpr);
    ctx.scale(dpr, dpr);
  }
  
  // Direct event handlers
  function handleContextMenu(e) {
    e.preventDefault();
    actions.showContextMenu(e.clientX, e.clientY, id, 'display');
    actions.setActiveDisplay(id);
  }
  
  function handleMouseDown(e) {
    if (e.button !== 0) return; // Left click only
    
    const rect = element.getBoundingClientRect();
    const offset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    
    actions.startDrag('display', id, offset);
    actions.setActiveDisplay(id);
    
    // Global mouse events for dragging
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
  }
  
  function handleGlobalMouseMove(e) {
    const newPosition = {
      x: e.clientX - $floatingStore.draggedItem.offset.x,
      y: e.clientY - $floatingStore.draggedItem.offset.y
    };
    
    // Simple bounds checking
    newPosition.x = Math.max(0, Math.min(newPosition.x, window.innerWidth - 250));
    newPosition.y = Math.max(0, Math.min(newPosition.y, window.innerHeight - 150));
    
    actions.updateDrag(newPosition);
  }
  
  function handleGlobalMouseUp() {
    actions.endDrag();
    document.removeEventListener('mousemove', handleGlobalMouseMove);
    document.removeEventListener('mouseup', handleGlobalMouseUp);
  }
  
  function handleClose() {
    actions.removeDisplay(id);
  }
  
  // Canvas mouse event handlers
  function handleMouseMove(event) {
    if (!yScale) return;
    
    const rect = canvas.getBoundingClientRect();
    const cssY = event.clientY - rect.top;
    const calculatedPrice = yScale.invert(cssY);
    
    hoverState.set({ y: cssY, price: calculatedPrice });
  }
  
  function handleMouseLeave() {
    hoverState.set(null);
  }
  
  function handleClick(event) {
    if (!yScale) return;
    
    const rect = canvas.getBoundingClientRect();
    const cssY = event.clientY - rect.top;
    
    // Hit detection threshold in CSS pixels
    const hitThreshold = 5;
    
    // Check if clicking on an existing marker
    const clickedMarker = markers.find(marker => {
      const markerY = yScale(marker.price);
      return Math.abs(cssY - markerY) < hitThreshold;
    });
    
    if (clickedMarker) {
      markerStore.remove(clickedMarker.id);
    } else {
      // Add a new marker
      const clickedPrice = yScale.invert(cssY);
      markerStore.add(clickedPrice);
    }
  }
  
  // Canvas rendering
  let yScale;
  $: if (state && config && state.visualLow && state.visualHigh) {
    yScale = scaleLinear()
      .domain([state.visualLow, state.visualHigh])
      .range([config.meterHeight, 0]);
  }
  
  let renderFrame;
  let lastRenderTime = 0;
  
  function render(timestamp = 0) {
    if (!ctx || !state || !config || !yScale) {
      // Skipping render - missing required dependencies
      return;
    }
    
    // Throttle renders to 60fps
    if (timestamp - lastRenderTime < 16) {
      renderFrame = requestAnimationFrame(render);
      return;
    }
    lastRenderTime = timestamp;
    
    const { visualizationsContentWidth, meterHeight } = config;
    
    // Clear and draw background
    ctx.clearRect(0, 0, visualizationsContentWidth, meterHeight);
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, visualizationsContentWidth, meterHeight);
    
    // Drawing visualizations
    
    try {
      // Core visualizations (in correct order from legacy)
      drawMarketProfile(ctx, config, state, yScale);
      drawDayRangeMeter(ctx, config, state, yScale);
      drawVolatilityOrb(ctx, config, state, visualizationsContentWidth, meterHeight);
      drawPriceFloat(ctx, config, state, yScale);
      drawPriceDisplay(ctx, config, state, yScale, visualizationsContentWidth);
      drawVolatilityMetric(ctx, config, state, visualizationsContentWidth, meterHeight);
      
      // Interactive elements (on top)
      drawPriceMarkers(ctx, config, state, yScale, markers);
      drawHoverIndicator(ctx, config, state, yScale, $hoverState);
    } catch (error) {
      console.error(`[RENDER_ERROR] Error drawing visualizations:`, error);
    }
    
    renderFrame = requestAnimationFrame(render);
  }
  
  // Start render only when everything is ready
  $: if (ctx && state && config && isReady && yScale) {
    console.log(`[RENDER_START] Starting render for ${symbol}:`, {
      ctx: !!ctx,
      state: !!state,
      config: !!config,
      isReady,
      yScale: !!yScale,
      stateKeys: Object.keys(state),
      configKeys: Object.keys(config)
    });
    if (renderFrame) {
      cancelAnimationFrame(renderFrame);
    }
    render();
  } else {
    console.log(`[RENDER_WAITING] Not ready for ${symbol}:`, {
      ctx: !!ctx,
      state: !!state,
      config: !!config,
      isReady,
      yScale: !!yScale
    });
  }
  
  // Cleanup global listeners
  onDestroy(() => {
    document.removeEventListener('mousemove', handleGlobalMouseMove);
    document.removeEventListener('mouseup', handleGlobalMouseUp);
    if (renderFrame) {
      cancelAnimationFrame(renderFrame);
    }
  });
</script>

<div 
  bind:this={element}
  class="floating-display"
  class:active={isActive}
  style="left: {display?.position.x || position.x}px; top: {display?.position.y || position.y}px; z-index: {currentZIndex};"
  on:contextmenu={handleContextMenu}
  on:mousedown={handleMouseDown}
  data-display-id={id}
>
  <!-- Header -->
  <div class="header">
    <div class="symbol-info">
      <span class="symbol">{symbol}</span>
      {#if isActive}
        <div class="active-indicator"></div>
      {/if}
    </div>
    <button class="close-btn" on:click={handleClose}>×</button>
  </div>
  
  <!-- Canvas Content -->
  <div class="content">
    {#if isReady}
      <canvas 
        bind:this={canvas}
        on:mousemove={handleMouseMove}
        on:mouseleave={handleMouseLeave}
        on:click={handleClick}
      ></canvas>
    {:else}
      <div class="loading">
        <div class="loading-spinner"></div>
        <p>Initializing {symbol}...</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .floating-display {
    position: fixed;
    background: #1f2937;
    border: 2px solid #374151;
    border-radius: 8px;
    cursor: grab;
    user-select: none;
    min-width: 250px;
    min-height: 150px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  
  .floating-display.active {
    border-color: #4f46e5;
    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.3), 0 4px 12px rgba(0, 0, 0, 0.4);
  }
  
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #374151;
    border-bottom: 1px solid #4b5563;
    cursor: grab;
  }
  
  .symbol-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .symbol {
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
  
  .content {
    padding: 8px;
    background: #111827;
    border-radius: 0 0 6px 6px;
  }
  
  canvas {
    display: block;
    background-color: #111827;
    width: 100%;
    height: auto;
  }
  
  .loading {
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
