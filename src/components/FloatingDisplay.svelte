<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { displayStore, displayActions, displays, activeDisplay } from '../stores/displayStore.js';
  import { subscribe, unsubscribe, wsStatus } from '../data/wsClient.js';
  import { scaleLinear } from 'd3-scale';
  import { writable } from 'svelte/store';
  import { markerStore } from '../stores/markerStore.js';
  
  // Import drawing functions
  import { drawMarketProfile } from '../lib/viz/marketProfile.js';
  import { drawDayRangeMeter } from '../lib/viz/dayRangeMeter.js';
  import { drawVolatilityOrb } from '../lib/viz/volatilityOrb.js';
  import { drawPriceFloat } from '../lib/viz/priceFloat.js';
  import { drawPriceDisplay } from '../lib/viz/priceDisplay.js';
  import { drawPriceMarkers } from '../lib/viz/priceMarkers.js';
  import { drawHoverIndicator } from '../lib/viz/hoverIndicator.js';
  
  // ✅ INTERACT.JS: Import interact.js for drag and resize
  import interact from 'interactjs';
  
  // Component props
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
  
  // Declare variables to avoid ReferenceError
  let displayPosition = position;
  let config = {};
  let state = {};
  let isActive = false;
  let zIndex = 1;
  
  // ✅ UNIFIED STORE: Simple store binding - no reactive conflicts
  $: display = $displays?.get(id);
  $: {
    displayPosition = display?.position || position;
    config = display?.config || {};
    state = display?.state || {}; // ✅ FIXED: Get state from unified displayStore
    isActive = display?.isActive || false;
    zIndex = display?.zIndex || 1;
    
    // 🔍 DEBUG: Log state changes to track data flow
    if (state && Object.keys(state).length > 0) {
      console.log(`[FLOATING_DISPLAY_DEBUG] State updated for ${symbol}:`, {
        ready: state.ready,
        hasPrice: !!state.currentPrice,
        visualLow: state.visualLow,
        visualHigh: state.visualHigh,
        volatility: state.volatility
      });
    }
  }
  
  // Update markers from store
  $: if ($markerStore !== undefined) {
    markers = $markerStore;
  }
  
  // Simple canvas dimensions
  const REFERENCE_CANVAS = { width: 220, height: 120 };
  let canvasWidth = REFERENCE_CANVAS.width;
  let canvasHeight = REFERENCE_CANVAS.height;
  
  // Simple yScale calculation
  $: yScale = state?.visualLow && state?.visualHigh
    ? scaleLinear().domain([state.visualLow, state.visualHigh]).range([canvasHeight, 0])
    : null;
  
  // Event handlers
  function handleContextMenu(e) {
    e.preventDefault();
    displayActions.setActiveDisplay(id);
    
    const context = {
      type: e.target.closest('canvas') ? 'canvas' : 
            e.target.closest('.header') ? 'header' : 'workspace',
      targetId: id,
      targetType: 'display'
    };
    
    displayActions.showContextMenu(e.clientX, e.clientY, id, 'display', context);
  }
  
  function handleClose() {
    displayActions.removeDisplay(id);
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
  
  // ✅ ULTRA-MINIMAL: Simple interact.js setup - no complex logic
  onMount(async () => {
    console.log(`[FLOATING_DISPLAY] Mounting display ${id} for symbol ${symbol}`);
    console.log(`[FLOATING_DISPLAY] Canvas element available:`, !!canvas);
    
    // ✅ INTERACT.JS: Ultra-minimal setup - use event.rect directly
    if (element) {
      interact(element)
        .draggable({
          inertia: true,
          modifiers: [
            interact.modifiers.restrictEdges({
              outer: { 
                left: 0, 
                top: 0, 
                right: window.innerWidth - element.offsetWidth,
                bottom: window.innerHeight - element.offsetHeight
              }
            })
          ],
          onmove: (event) => {
            // ✅ DIRECT: Use interact.js rect directly - no position tracking
            displayActions.moveDisplay(id, {
              x: event.rect.left,
              y: event.rect.top
            });
          },
          onend: () => {
            console.log(`[INTERACT_JS] Drag ended for display ${id}`);
          }
        })
        .resizable({
          edges: { left: true, right: true, bottom: true, top: true },
          modifiers: [
            interact.modifiers.restrictSize({
              min: { width: 240, height: 160 }
            })
          ],
          onmove: (event) => {
            // ✅ FIXED: Update element style immediately for visual feedback
            element.style.width = event.rect.width + 'px';
            element.style.height = event.rect.height + 'px';
            
            // ✅ FIXED: Calculate correct position based on resize edge
            const newPosition = {
              x: event.rect.left,
              y: event.rect.top
            };
            
            // ✅ FIXED: Update both position and size
            displayActions.moveDisplay(id, newPosition);
            displayActions.resizeDisplay(id, event.rect.width, event.rect.height);
          },
          onend: () => {
            console.log(`[INTERACT_JS] Resize ended for display ${id}`);
          }
        });
      
      // Click to activate
      interact(element).on('tap', (event) => {
        displayActions.setActiveDisplay(id);
      });
    }
    
    // Display is already created by parent component, no need to create again
    // Worker creation is handled automatically by displayActions.addDisplay() in parent
    console.log(`[FLOATING_DISPLAY] Display ${id} for ${symbol} is ready`);
    
    return () => {
      // ✅ CLEANUP: Simple interact.js cleanup
      if (element) {
        interact(element).unset();
      }
      console.log(`[FLOATING_DISPLAY] Cleaning up display for ${symbol}`);
      // Display cleanup is handled by displayActions.removeDisplay() which also terminates worker
    };
  });
  
  // ✅ ULTRA-MINIMAL: Simple canvas update - no complex sizing
  $: if (canvas && ctx && config) {
    // Simple canvas sizing based on clean foundation config
    const newWidth = config.containerSize?.width || canvasWidth;
    const newHeight = config.containerSize?.height || canvasHeight;
    
    // Only update if significant change
    if (Math.abs(canvas.width - newWidth) > 5 || Math.abs(canvas.height - newHeight) > 5) {
      canvas.width = newWidth;
      canvas.height = newHeight;
      canvasWidth = newWidth;
      canvasHeight = newHeight;
    }
  }
  
  // ✅ FIXED: Initialize canvas when it becomes available (reactive to state.ready)
  $: if (state?.ready && canvas && !ctx) {
    console.log(`[FLOATING_DISPLAY] Canvas becoming available, initializing context`);
    ctx = canvas.getContext('2d');
    console.log(`[FLOATING_DISPLAY] Canvas context created:`, !!ctx);
    if (ctx) {
      dpr = window.devicePixelRatio || 1;
      canvas.width = REFERENCE_CANVAS.width;
      canvas.height = REFERENCE_CANVAS.height;
      canvasWidth = REFERENCE_CANVAS.width;
      canvasHeight = REFERENCE_CANVAS.height;
      console.log(`[FLOATING_DISPLAY] Canvas initialized with dimensions: ${canvas.width}x${canvas.height}`);
    } else {
      console.error(`[FLOATING_DISPLAY] Failed to create canvas 2D context`);
    }
  }
  
  // 🔧 CLEAN FOUNDATION: Create rendering context for visualization functions
  let renderingContext = null;
  
  // ✅ ULTRA-MINIMAL: Simple rendering - no complex dependencies
  let renderFrame;
  
  function render() {
    console.log(`[RENDER_DEBUG] Render called - ctx: ${!!ctx}, state: ${!!state}, config: ${!!config}, canvas: ${!!canvas}`);
    console.log(`[RENDER_DEBUG] State visualLow: ${state?.visualLow}, visualHigh: ${state?.visualHigh}, yScale: ${!!yScale}`);
    console.log(`[RENDER_DEBUG] Canvas dimensions: ${canvas?.width}x${canvas?.height}`);
    
    if (!ctx || !state || !config || !canvas) {
      console.log(`[RENDER_DEBUG] Early return - missing requirements`);
      return;
    }
    
    // 🔧 CLEAN FOUNDATION: Create rendering context
    const containerSize = config.containerSize || { width: canvasWidth, height: canvasHeight };
    const contentArea = {
      width: containerSize.width - (config.padding * 2),
      height: containerSize.height - config.headerHeight - config.padding
    };
    const adrAxisX = contentArea.width * config.adrAxisPosition;
    
    renderingContext = {
      containerSize,
      contentArea,
      adrAxisX,
      // Derived values for backward compatibility
      visualizationsContentWidth: contentArea.width,
      meterHeight: contentArea.height,
      adrAxisXPosition: adrAxisX
    };
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    console.log(`[RENDER_DEBUG] Canvas cleared and background filled`);
    console.log(`[RENDER_DEBUG] Rendering context created:`, renderingContext);
    
    // Draw visualizations
    if (state.visualLow && state.visualHigh && yScale) {
      console.log(`[RENDER_DEBUG] Starting to draw visualizations`);
      try {
        console.log(`[RENDER_DEBUG] Drawing market profile`);
        drawMarketProfile(ctx, renderingContext, config, state, yScale);
        console.log(`[RENDER_DEBUG] Drawing day range meter`);
        drawDayRangeMeter(ctx, renderingContext, config, state, yScale);
        console.log(`[RENDER_DEBUG] Drawing volatility orb`);
        drawVolatilityOrb(ctx, renderingContext, config, state, yScale);
        console.log(`[RENDER_DEBUG] Drawing price float`);
        drawPriceFloat(ctx, renderingContext, config, state, yScale);
        console.log(`[RENDER_DEBUG] Drawing price display`);
        drawPriceDisplay(ctx, renderingContext, config, state, yScale);
        console.log(`[RENDER_DEBUG] Drawing price markers`);
        drawPriceMarkers(ctx, renderingContext, config, state, yScale, markers);
        console.log(`[RENDER_DEBUG] Drawing hover indicator`);
        drawHoverIndicator(ctx, renderingContext, config, state, yScale, $hoverState);
        console.log(`[RENDER_DEBUG] All visualizations drawn successfully`);
      } catch (error) {
        console.error(`[RENDER] Error in visualization functions:`, error);
      }
    } else {
      console.log(`[RENDER_DEBUG] Cannot draw visualizations - missing requirements`);
    }
  }
  
  // ✅ ULTRA-MINIMAL: Simple render trigger
  $: if (state && config && yScale) {
    if (renderFrame) {
      cancelAnimationFrame(renderFrame);
    }
    renderFrame = requestAnimationFrame(render);
  }
  
  onDestroy(() => {
    if (renderFrame) {
      cancelAnimationFrame(renderFrame);
    }
  });
</script>

<div 
  bind:this={element}
  class="enhanced-floating"
  class:active={isActive}
  style="left: {displayPosition.x}px; top: {displayPosition.y}px; width: 240px; height: 160px; z-index: {zIndex};"
  on:contextmenu={handleContextMenu}
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
</div>

<style>
  /* ✅ ULTRA-MINIMAL: Clean CSS - no resize cursor complexity */
  .enhanced-floating {
    position: fixed;
    background: #1f2937;
    border: 2px solid #374151;
    border-radius: 8px;
    cursor: grab;
    user-select: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  
  .enhanced-floating:hover {
    border-color: #4f46e5;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }
  
  .enhanced-floating.active {
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
    transition: background-color 0.2s ease;
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
    box-sizing: border-box;
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
</style>
