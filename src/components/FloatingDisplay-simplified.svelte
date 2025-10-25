<script>
  import { onMount, onDestroy } from 'svelte';
  import { floatingStore, actions, snapToGrid, constrainToViewport, checkCollision, DIMENSIONS } from '../stores/floatingStore-simplified.js';
  import { writable } from 'svelte/store';
  import { markerStore } from '../stores/markerStore.js';
  
  // Import drawing functions
  import { drawMarketProfile } from '../lib/viz/marketProfile.js';
  import { drawDayRangeMeter } from '../lib/viz/dayRangeMeter.js';
  import { drawVolatilityOrb } from '../lib/viz/volatilityOrb.js';
  import { drawPriceDisplay } from '../lib/viz/priceDisplay.js';
  import { drawPriceMarkers } from '../lib/viz/priceMarkers.js';
  
  // Component props
  export let id;
  export let symbol;
  export let position = { x: 100, y: 100 };
  
  // Local state
  let element;
  let canvas;
  let ctx;
  
  // Store-based state - SIMPLIFIED
  let display = null;
  let config = {};
  let state = {};
  let isActive = false;
  let currentZIndex = 1;
  let isHovered = false;
  let showResizeHandles = false;
  
  // Hover and marker state
  const hoverState = writable(null);
  let markers = [];
  
  // SIMPLIFIED: Direct store subscriptions
  $: display = $floatingStore.displays.find(d => d.id === id);
  $: config = display?.config || {};
  $: state = display?.state || {};
  $: isActive = display?.isActive || false;
  $: currentZIndex = display?.zIndex || 1;
  
  // SIMPLIFIED: Direct position and size calculation
  $: displayPosition = display?.position || position;
  $: displaySize = { 
    width: config.visualizationsContentWidth || DIMENSIONS.DISPLAY.width, 
    height: (config.meterHeight || 100) + 40 // Add header height
  };
  
  // Update markers from store
  $: if ($markerStore !== undefined) {
    markers = $markerStore;
  }
  
  // SIMPLIFIED: Canvas setup
  const CANVAS_SIZE = { width: 220, height: 120 };
  let canvasWidth = CANVAS_SIZE.width;
  let canvasHeight = CANVAS_SIZE.height;
  
  // Generate yScale for price positioning
  $: yScale = state?.visualLow && state?.visualHigh
    ? d3.scaleLinear().domain([state.visualLow, state.visualHigh]).range([canvasHeight, 0])
    : null;
  
  // SIMPLIFIED: Scale config to canvas dimensions
  function scaleToCanvas(config, currentCanvasWidth, currentCanvasHeight) {
    if (!config) return {};
    
    return {
      // Layout parameters
      visualizationsContentWidth: (config.visualizationsContentWidth / 100) * currentCanvasWidth,
      meterHeight: (config.meterHeight / 100) * currentCanvasHeight,
      centralAxisXPosition: (config.centralAxisXPosition / 100) * currentCanvasWidth,
      
      // Price display parameters
      priceFloatWidth: (config.priceFloatWidth / 100) * currentCanvasWidth,
      priceFloatHeight: (config.priceFloatHeight / 100) * currentCanvasHeight,
      priceFloatXOffset: (config.priceFloatXOffset / 100) * currentCanvasWidth,
      priceFontSize: (config.priceFontSize / 100) * currentCanvasHeight,
      priceHorizontalOffset: (config.priceHorizontalOffset / 100) * currentCanvasWidth,
      
      // Volatility parameters
      volatilityOrbBaseWidth: (config.volatilityOrbBaseWidth / 100) * currentCanvasWidth,
      
      // Pass through non-scaled parameters
      ...Object.fromEntries(
        Object.entries(config).filter(([key]) => ![
          'visualizationsContentWidth', 'meterHeight', 'centralAxisXPosition',
          'priceFloatWidth', 'priceFloatHeight', 'priceFloatXOffset', 'priceFontSize',
          'priceHorizontalOffset', 'volatilityOrbBaseWidth'
        ].includes(key))
      )
    };
  }
  
  let scaledConfig = {};
  
  // Update scaled config when display size changes
  $: if (displaySize) {
    scaledConfig = scaleToCanvas(config, canvasWidth, canvasHeight);
  }
  
  // SIMPLIFIED: Mouse event handlers
  function handleMouseDown(e) {
    if (e.button !== 0) return;
    
    if (e.target.classList.contains('resize-handle')) {
      return;
    }
    
    const rect = element.getBoundingClientRect();
    const offset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    
    actions.startDrag('display', id, offset);
    actions.setActiveDisplay(id);
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    e.preventDefault();
  }
  
  function handleMouseMove(e) {
    if ($floatingStore.draggedItem?.type === 'display' && $floatingStore.draggedItem?.id === id) {
      const mouseDeltaX = e.movementX || 0;
      const mouseDeltaY = e.movementY || 0;
      
      const currentPosition = display?.position || { x: 0, y: 0 };
      let newX = currentPosition.x + mouseDeltaX;
      let newY = currentPosition.y + mouseDeltaY;
      
      // Apply grid snapping
      const snappedPosition = snapToGrid({ x: newX, y: newY });
      
      // Apply viewport constraints
      const constrainedPosition = constrainToViewport(snappedPosition, displaySize);
      
      actions.updateDrag(constrainedPosition);
    } else if ($floatingStore.resizeState?.isResizing && $floatingStore.resizeState?.displayId === id) {
      const mousePos = { x: e.clientX, y: e.clientY };
      actions.updateResize(mousePos);
    }
  }
  
  function handleMouseUp() {
    actions.endDrag();
    actions.endResize();
    
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }
  
  function handleResizeStart(e, handle) {
    actions.startResize(id, handle, displayPosition, displaySize, { x: e.clientX, y: e.clientY });
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    e.stopPropagation();
    e.preventDefault();
  }
  
  function handleContextMenu(e) {
    e.preventDefault();
    actions.setActiveDisplay(id);
    actions.showContextMenu(e.clientX, e.clientY, id, 'display');
  }
  
  function handleClose() {
    actions.removeDisplay(id);
  }
  
  function handleCanvasMouseMove(event) {
    if (!yScale) return;
    
    const rect = canvas.getBoundingClientRect();
    const cssY = event.clientY - rect.top;
    const calculatedPrice = yScale.invert(cssY);
    
    hoverState.set({ y: cssY, price: calculatedPrice });
  }
  
  function handleCanvasMouseLeave() {
    hoverState.set(null);
  }
  
  function handleCanvasClick(event) {
    if (!yScale) return;
    
    const rect = canvas.getBoundingClientRect();
    const cssY = event.clientY - rect.top;
    
    const hitThreshold = 5;
    
    const clickedMarker = markers.find(marker => {
      const markerY = yScale(marker.price);
      return Math.abs(cssY - markerY) < hitThreshold;
    });
    
    if (clickedMarker) {
      markerStore.remove(clickedMarker.id);
    } else {
      const clickedPrice = yScale.invert(cssY);
      markerStore.add(clickedPrice);
    }
  }
  
  // SIMPLIFIED: Canvas setup
  onMount(async () => {
    if (canvas) {
      canvas.width = CANVAS_SIZE.width;
      canvas.height = CANVAS_SIZE.height;
      ctx = canvas.getContext('2d');
    }
    
    // Add display to store if it doesn't exist
    if (!display) {
      actions.addDisplay(symbol, position);
    }
    
    return () => {
      // Cleanup when component is destroyed
    };
  });
  
  // Update canvas size when display size changes
  $: if (canvas && ctx && displaySize) {
    const newWidth = displaySize.width;
    const newHeight = displaySize.height - 40; // Subtract header height
    
    const safeWidth = Math.min(2000, Math.max(100, newWidth));
    const safeHeight = Math.min(2000, Math.max(80, newHeight));
    
    canvas.width = safeWidth;
    canvas.height = safeHeight;
    
    canvasWidth = safeWidth;
    canvasHeight = safeHeight;
    
    // Update scaled config for new canvas size
    scaledConfig = scaleToCanvas(config, canvasWidth, canvasHeight);
  }
  
  // SIMPLIFIED: Canvas rendering
  let renderFrame;
  
  function render() {
    if (!ctx || !state || !config || !yScale) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    try {
      drawMarketProfile(ctx, scaledConfig, state, yScale);
      drawDayRangeMeter(ctx, scaledConfig, state, yScale);
      drawVolatilityOrb(ctx, scaledConfig, state, canvasWidth, canvasHeight);
      drawPriceDisplay(ctx, scaledConfig, state, yScale, canvasWidth);
      drawPriceMarkers(ctx, scaledConfig, state, yScale, markers);
    } catch (error) {
      console.error('Render error:', error);
    }
    
    renderFrame = requestAnimationFrame(render);
  }
  
  // Start rendering when ready
  $: if (ctx && state && config && yScale) {
    if (renderFrame) {
      cancelAnimationFrame(renderFrame);
    }
    render();
  }
  
  // Show resize handles when hovered or resizing
  $: showResizeHandles = isHovered || $floatingStore.resizeState?.isResizing;
  
  onDestroy(() => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    if (renderFrame) {
      cancelAnimationFrame(renderFrame);
    }
  });
</script>

<!-- SIMPLIFIED: Direct DOM structure -->
<div 
  bind:this={element}
  class="floating-display"
  class:hovered={isHovered}
  class:active={isActive}
  style="left: {displayPosition.x}px; top: {displayPosition.y}px; width: {displaySize.width}px; height: {displaySize.height}px; z-index: {currentZIndex};"
  on:contextmenu={handleContextMenu}
  on:mousedown={handleMouseDown}
  on:mouseenter={() => isHovered = true}
  on:mouseleave={() => isHovered = false}
  data-display-id={id}
>
  <!-- Header -->
  <div class="header" on:mousedown={handleMouseDown}>
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
    {#if state?.ready}
      <canvas 
        bind:this={canvas}
        on:mousemove={handleCanvasMouseMove}
        on:mouseleave={handleCanvasMouseLeave}
        on:click={handleCanvasClick}
      ></canvas>
    {:else}
      <div class="loading">
        <div class="loading-spinner"></div>
        <p>Initializing {symbol}...</p>
      </div>
    {/if}
  </div>
  
  <!-- Resize Handles -->
  {#if showResizeHandles}
    <div class="resize-handle nw" on:mousedown={(e) => handleResizeStart(e, 'nw')}></div>
    <div class="resize-handle ne" on:mousedown={(e) => handleResizeStart(e, 'ne')}></div>
    <div class="resize-handle se" on:mousedown={(e) => handleResizeStart(e, 'se')}></div>
    <div class="resize-handle sw" on:mousedown={(e) => handleResizeStart(e, 'sw')}></div>
    
    <div class="resize-handle n" on:mousedown={(e) => handleResizeStart(e, 'n')}></div>
    <div class="resize-handle s" on:mousedown={(e) => handleResizeStart(e, 's')}></div>
    <div class="resize-handle e" on:mousedown={(e) => handleResizeStart(e, 'e')}></div>
    <div class="resize-handle w" on:mousedown={(e) => handleResizeStart(e, 'w')}></div>
  {/if}
</div>

<!-- SIMPLIFIED: Essential styles only -->
<style>
  .floating-display {
    position: fixed;
    background: #1f2937;
    border: 2px solid #374151;
    border-radius: 8px;
    cursor: grab;
    user-select: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  
  .floating-display:hovered {
    border-color: #4f46e5;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }
  
  .floating-display.active {
    border-color: #4f46e5;
    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.3);
  }
  
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #374151;
    border-bottom: 1px solid #4b5563;
    cursor: grab;
    border-radius: 6px 6px 0 0;
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
  }
  
  .close-btn:hover {
    background: rgba(239, 68, 68, 0.2);
  }
  
  .content {
    padding: 8px;
    background: #111827;
    border-radius: 0 0 6px 6px;
    height: calc(100% - 41px);
    overflow: hidden;
  }
  
  canvas {
    display: block;
    background-color: #111827;
    width: 100%;
    height: 100%;
  }
  
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
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
  
  .resize-handle {
    position: absolute;
    background: #4f46e5;
    border: 1px solid #6366f1;
    border-radius: 2px;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  
  .floating-display:hovered .resize-handle,
  .resize-handle:hover {
    opacity: 1;
  }
  
  .resize-handle:hover {
    background: #6366f1;
  }
  
  .resize-handle.nw { top: -4px; left: -4px; cursor: nw-resize; }
  .resize-handle.ne { top: -4px; right: -4px; cursor: ne-resize; }
  .resize-handle.se { bottom: -4px; right: -4px; cursor: se-resize; }
  .resize-handle.sw { bottom: -4px; left: -4px; cursor: sw-resize; }
  .resize-handle.n { top: -4px; left: 50%; transform: translateX(-50%); cursor: n-resize; }
  .resize-handle.s { bottom: -4px; left: 50%; transform: translateX(-50%); cursor: s-resize; }
  .resize-handle.e { top: 50%; right: -4px; transform: translateY(-50%); cursor: e-resize; }
  .resize-handle.w { top: 50%; left: -4px; transform: translateY(-50%); cursor: w-resize; }
  
  .resize-handle.n, .resize-handle.s { width: 8px; height: 8px; }
  .resize-handle.e, .resize-handle.w { width: 8px; height: 8px; }
</style>
