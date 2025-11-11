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
  import { drawPriceFloat } from '../lib/viz/priceFloat.js';
  import { drawPriceDisplay } from '../lib/viz/priceDisplay.js';
  import { drawVolatilityOrb } from '../lib/viz/volatilityOrb.js';
  import { drawVolatilityMetric } from '../lib/viz/volatilityMetric.js';
  import { drawPriceMarkers } from '../lib/viz/priceMarkers.js';
  import { drawHoverIndicator } from '../lib/viz/hoverIndicator.js';

  // Debug: Verify imports are working
  console.log('[FloatingDisplay] Imports loaded:', {
    drawVolatilityOrb: typeof drawVolatilityOrb,
    drawDayRangeMeter: typeof drawDayRangeMeter,
    drawMarketProfile: typeof drawMarketProfile
  });

  // ✅ INTERACT.JS: Import interact.js for drag and resize
  import interact from 'interactjs';
  
  // ✅ GRID SNAPPING: Import workspace grid utility
  import { workspaceGrid } from '../utils/workspaceGrid.js';
  
  // 🔧 ZOOM AWARENESS: Import zoom detection utilities
  import { createZoomDetector } from '../utils/canvasSizing.js';
  
  // Component props
  export let id;
  export let symbol;
  export let position = { x: 100, y: 100 };
  
  // Local state
  let element;
  let canvas;
  let ctx;
  
  // Hover and marker state
  const hoverState = writable(null);
  let markers = [];
  
  // Declare variables to avoid ReferenceError
  let displayPosition = position;
  let config = {};
  let state = {};
  let isActive = false;
  let zIndex = 1;
  let displaySize = { width: 220, height: 160 }; // ✅ FIXED: Add explicit displaySize variable
  
  // Local state for interact.js instance
  let interactable = null;
  
  // ✅ UNIFIED STORE: Simple store binding - no reactive conflicts
  $: display = $displays?.get(id);
  $: {
    displayPosition = display?.position || position;
    config = display?.config || {};
    state = display?.state || {}; // ✅ FIXED: Get state from unified displayStore
    isActive = display?.isActive || false;
    zIndex = display?.zIndex || 1;
    displaySize = display?.size || { width: 220, height: 160 }; // ✅ FIXED: Extract size safely
    
    }
  
  // Update markers from store
  $: if ($markerStore !== undefined) {
    markers = $markerStore;
  }
  
  // 🔧 CONTAINER-STYLE: Use contentArea approach like Container.svelte
  let canvasWidth = 240;  // Default container width
  let canvasHeight = 160; // Default container height
  let dpr = 1;
  
  // 🔧 CONTAINER-STYLE: contentArea calculations like Container.svelte
  let contentArea = { width: 220, height: 120 }; // Default content area (220×160 container - 40px header)
  
  // yScale calculation using contentArea height
  $: yScale = state?.visualLow && state?.visualHigh && contentArea
    ? scaleLinear().domain([state.visualLow, state.visualHigh]).range([contentArea.height, 0])
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
  
  // ✅ GRID SNAPPING: Enhanced interact.js setup with grid integration
  onMount(async () => {
    
    // ✅ GRID ENHANCED: Setup interact.js with grid snapping
    if (element) {
      // Create interactable instance
      interactable = interact(element);
      
      // Configure draggable with grid snapping
      interactable
        .draggable({
          inertia: true,
          modifiers: workspaceGrid.getInteractModifiers(),
          onstart: () => {
            // ✅ GRID FEEDBACK: Notify workspace grid of drag start
            workspaceGrid.setDraggingState(true);
          },
          onmove: (event) => {
            // ✅ GRID SNAPPING: event.rect already includes snapped coordinates
            displayActions.moveDisplay(id, {
              x: event.rect.left,
              y: event.rect.top
            });
          },
          onend: () => {
            // ✅ GRID FEEDBACK: Notify workspace grid of drag end
            workspaceGrid.setDraggingState(false);
          }
        })
        .resizable({
          edges: { left: true, right: true, bottom: true, top: true },
          modifiers: [
            interact.modifiers.restrictSize({
              min: { width: 240, height: 160 }
            }),
            // ✅ GRID SNAPPING: Add grid snapping for resize
            ...(workspaceGrid.enabled ? [interact.modifiers.snap({
              targets: workspaceGrid.getInteractSnappers(),
              relativePoints: [{ x: 0, y: 0 }],
              range: workspaceGrid.snapThreshold
            })] : [])
          ],
          onstart: () => {
            // ✅ GRID FEEDBACK: Notify workspace grid of resize start
            workspaceGrid.setDraggingState(true);
          },
          onmove: (event) => {
            // ✅ GRID SNAPPING: Update element style for visual feedback
            element.style.width = event.rect.width + 'px';
            element.style.height = event.rect.height + 'px';
            
            const newPosition = {
              x: event.rect.left,
              y: event.rect.top
            };
            
            displayActions.moveDisplay(id, newPosition);
            displayActions.resizeDisplay(id, event.rect.width, event.rect.height);
          },
          onend: () => {
            // ✅ GRID FEEDBACK: Notify workspace grid of resize end
            workspaceGrid.setDraggingState(false);
          }
        });
      
      // Register interactable with workspace grid for dynamic updates
      workspaceGrid.registerInteractInstance(interactable);
      
      // Click to activate
      interactable.on('tap', (event) => {
        displayActions.setActiveDisplay(id);
      });
      
      }

    return () => {
      // ✅ CLEANUP: Enhanced cleanup with grid unregistration
      if (interactable) {
        workspaceGrid.unregisterInteractInstance(interactable);
        interactable.unset();
        interactable = null;
      }
    };
  });
  
  // 🔧 CONTAINER-STYLE: Update canvas with pixel-perfect dimensions
  $: if (canvas && ctx && config) {
    // Calculate new contentArea from config (no padding reduction)
    const containerSize = config.containerSize || { width: 220, height: 120 };
    const newContentArea = {
      width: containerSize.width,  // ✅ FIXED: No padding reduction
      height: containerSize.height - config.headerHeight  // ✅ FIXED: Only subtract header
    };
    
    // Only update if significant change
    if (Math.abs(contentArea.width - newContentArea.width) > 5 || 
        Math.abs(contentArea.height - newContentArea.height) > 5) {
      
      // Update contentArea for reactive use
      contentArea = newContentArea;
      
      // 🔧 PIXEL-PERFIX: Use integer canvas dimensions for crisp rendering
      const integerCanvasWidth = Math.round(contentArea.width * dpr);
      const integerCanvasHeight = Math.round(contentArea.height * dpr);
      
      // Calculate corresponding CSS dimensions
      const cssWidth = integerCanvasWidth / dpr;
      const cssHeight = integerCanvasHeight / dpr;
      
      // Apply pixel-perfect dimensions
      canvas.width = integerCanvasWidth;
      canvas.height = integerCanvasHeight;
      canvas.style.width = cssWidth + 'px';
      canvas.style.height = cssHeight + 'px';
      
      // 🔧 CRISP RENDERING: Reconfigure canvas context after resize
      ctx.scale(dpr, dpr);
      ctx.translate(0.5, 0.5); // Sub-pixel alignment
      ctx.imageSmoothingEnabled = false; // Disable anti-aliasing for crisp lines
      
      canvasWidth = contentArea.width;
      canvasHeight = contentArea.height;
      
          }
  }
  
  // 🔧 CONTAINER-STYLE: Initialize canvas with pixel-perfect dimensions
  $: if (state?.ready && canvas && !ctx) {
    ctx = canvas.getContext('2d');
    if (ctx) {
      dpr = window.devicePixelRatio || 1;
      
      // 🔧 ZOOM AWARENESS: Initialize zoom detector
      const cleanupZoomDetector = createZoomDetector((newDpr) => {
        dpr = newDpr;
        
        // Recalculate canvas dimensions with new DPR
        if (contentArea) {
          const integerCanvasWidth = Math.round(contentArea.width * dpr);
          const integerCanvasHeight = Math.round(contentArea.height * dpr);
          const cssWidth = integerCanvasWidth / dpr;
          const cssHeight = integerCanvasHeight / dpr;
          
          // Apply new pixel-perfect dimensions
          canvas.width = integerCanvasWidth;
          canvas.height = integerCanvasHeight;
          canvas.style.width = cssWidth + 'px';
          canvas.style.height = cssHeight + 'px';
          
          // Reconfigure canvas context for new DPR
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.scale(dpr, dpr);
          ctx.translate(0.5, 0.5);
          ctx.imageSmoothingEnabled = false;
        }
      });
      
      // Store cleanup function for onDestroy
      onDestroy(() => {
        if (cleanupZoomDetector) {
          cleanupZoomDetector();
        }
      });
      
      // 🔧 CONTAINER-STYLE: Calculate contentArea from config (no padding reduction)
      const containerSize = config.containerSize || { width: 220, height: 120 };
      const newContentArea = {
        width: containerSize.width,  // ✅ FIXED: No padding reduction
        height: containerSize.height - config.headerHeight  // ✅ FIXED: Only subtract header
      };
      
      // Update contentArea for reactive use
      contentArea = newContentArea;
      
      // 🔧 PIXEL-PERFECT: Use integer canvas dimensions for crisp rendering
      const integerCanvasWidth = Math.round(contentArea.width * dpr);
      const integerCanvasHeight = Math.round(contentArea.height * dpr);
      
      // Calculate corresponding CSS dimensions
      const cssWidth = integerCanvasWidth / dpr;
      const cssHeight = integerCanvasHeight / dpr;
      
      // Apply pixel-perfect dimensions
      canvas.width = integerCanvasWidth;
      canvas.height = integerCanvasHeight;
      canvas.style.width = cssWidth + 'px';
      canvas.style.height = cssHeight + 'px';
      
      // 🔧 CRISP RENDERING: Configure canvas context for crisp lines
      ctx.scale(dpr, dpr);
      ctx.translate(0.5, 0.5); // Sub-pixel alignment
      ctx.imageSmoothingEnabled = false; // Disable anti-aliasing for crisp lines
      
      canvasWidth = contentArea.width;
      canvasHeight = contentArea.height;
    } else {
      console.error(`[FLOATING_DISPLAY] Failed to create canvas 2D context`);
    }
  }
  
  // 🔧 CLEAN FOUNDATION: Create rendering context for visualization functions
  let renderingContext = null;
  
  // ✅ ULTRA-MINIMAL: Simple rendering - no complex dependencies
  let renderFrame;
  
  function render() {
    if (!ctx || !state || !config || !canvas) {
      return;
    }
    
    // 🔧 CLEAN FOUNDATION: Create rendering context (no padding reduction)
    const containerSize = config.containerSize || { width: canvasWidth, height: canvasHeight };
    const contentArea = {
      width: containerSize.width,  // ✅ FIXED: No padding reduction
      height: containerSize.height - config.headerHeight  // ✅ FIXED: Only subtract header
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
    
    // 🔧 CONTAINER-STYLE: Clear canvas using contentArea coordinates (CSS pixels)
    ctx.clearRect(0, 0, contentArea.width, contentArea.height);
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, contentArea.width, contentArea.height);
    
    // Draw visualizations
    if (state.visualLow && state.visualHigh && yScale) {
      try {
        // Draw Volatility Orb (Background Layer - MUST be first)
        console.log('[FloatingDisplay] About to call drawVolatilityOrb:', {
          drawVolatilityOrbExists: typeof drawVolatilityOrb,
          hasCtx: !!ctx,
          hasRenderingContext: !!renderingContext,
          hasConfig: !!config,
          hasState: !!state,
          showVolatilityOrb: config?.showVolatilityOrb,
          stateHasVolatility: 'volatility' in (state || {}),
          stateVolatility: state?.volatility
        });

        drawVolatilityOrb(ctx, renderingContext, config, state, yScale);
        console.log('[FloatingDisplay] drawVolatilityOrb completed successfully');

        drawMarketProfile(ctx, renderingContext, config, state, yScale);
        drawDayRangeMeter(ctx, renderingContext, config, state, yScale);
        drawPriceFloat(ctx, renderingContext, config, state, yScale);
        drawPriceDisplay(ctx, renderingContext, config, state, yScale);
        drawVolatilityMetric(ctx, renderingContext, config, state);
        drawPriceMarkers(ctx, renderingContext, config, state, yScale, markers);
        drawHoverIndicator(ctx, renderingContext, config, state, yScale, $hoverState);
      } catch (error) {
        console.error(`[RENDER] Error in visualization functions:`, error);
      }
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
  style="left: {displayPosition.x}px; top: {displayPosition.y}px; width: {displaySize.width}px; height: {displaySize.height}px; z-index: {zIndex};"
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
