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
  let displaySize = { width: 220, height: 120 }; // ✅ HEADERLESS: Correct display size (no header)
  
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
    displaySize = display?.size || { width: 220, height: 120 }; // ✅ HEADERLESS: Correct fallback size
    
    }
  
  // Update markers from store
  $: if ($markerStore !== undefined) {
    markers = $markerStore;
  }

    
  // 🔧 CONTAINER-STYLE: Use contentArea approach like Container.svelte (headerless design)
  let canvasWidth = 220;  // Default container width (no header)
  let canvasHeight = 120; // Default container height (no header)
  let dpr = 1;

  // 🔧 CONTAINER-STYLE: contentArea calculations like Container.svelte (headerless design)
  let contentArea = { width: 220, height: 120 }; // Full content area (220×120 container - no header)
  
  // yScale calculation using contentArea height
  $: yScale = state?.visualLow && state?.visualHigh && contentArea
    ? scaleLinear().domain([state.visualLow, state.visualHigh]).range([contentArea.height, 0])
    : null;
  
  // Event handlers
  function handleContextMenu(e) {
    e.preventDefault();
    displayActions.setActiveDisplay(id);

    const context = {
      type: e.target.closest('canvas') ? 'canvas' : 'workspace',
      targetId: id,
      targetType: 'display'
    };

    displayActions.showContextMenu(e.clientX, e.clientY, id, 'display', context);
  }
  
  function handleClose() {
    displayActions.removeDisplay(id);
  }

  function handleRefresh() {
    const refreshDisplay = $displays.get(id);
    if (refreshDisplay) {
      import('../data/wsClient.js').then(({ subscribe }) => {
        subscribe(refreshDisplay.symbol);
      });
    }
  }
  
  // Frame-throttled hover updates
  let hoverUpdateFrame = null;
  let lastHoverState = null;

  function handleCanvasMouseMove(event) {
    if (!yScale) return;

    const rect = canvas.getBoundingClientRect();
    const cssX = event.clientX - rect.left;
    const cssY = event.clientY - rect.top;
    const calculatedPrice = yScale.invert(cssY);

    const newHoverState = { x: cssX, y: cssY, price: calculatedPrice };

    // Check if hovering over refresh button (left of close button)
    const refreshX = contentArea.width - 50;
    const refreshY = 6;
    const buttonSize = 20;
    const newIsHoveringRefreshButton = cssX >= refreshX && cssX <= refreshX + buttonSize &&
                                        cssY >= refreshY && cssY <= refreshY + buttonSize;

    // Check if hovering over close button
    const closeX = contentArea.width - 24;
    const closeY = 6;
    const newIsHoveringCloseButton = cssX >= closeX && cssX <= closeX + buttonSize &&
                                     cssY >= closeY && cssY <= closeY + buttonSize;

    // Update hover states if changed
    if (isHovering !== true ||
        isHoveringCloseButton !== newIsHoveringCloseButton ||
        isHoveringRefreshButton !== newIsHoveringRefreshButton) {
      isHovering = true;
      isHoveringCloseButton = newIsHoveringCloseButton;
      isHoveringRefreshButton = newIsHoveringRefreshButton;

      // Trigger re-render for button visibility
      if (renderFrame) {
        cancelAnimationFrame(renderFrame);
      }
      renderFrame = requestAnimationFrame(render);
    }

    // Only update if state actually changed to avoid unnecessary renders
    if (lastHoverState &&
        Math.abs(lastHoverState.x - newHoverState.x) < 1 &&
        Math.abs(lastHoverState.y - newHoverState.y) < 1 &&
        isHoveringCloseButton === newIsHoveringCloseButton &&
        isHoveringRefreshButton === newIsHoveringRefreshButton) {
      return;
    }

    // Cancel previous frame request if still pending
    if (hoverUpdateFrame) {
      cancelAnimationFrame(hoverUpdateFrame);
    }

    // Throttle update to next animation frame
    hoverUpdateFrame = requestAnimationFrame(() => {
      lastHoverState = newHoverState;
      hoverState.set(newHoverState);
      hoverUpdateFrame = null;
    });
  }
  
  function handleCanvasMouseLeave() {
    // Cancel any pending hover update
    if (hoverUpdateFrame) {
      cancelAnimationFrame(hoverUpdateFrame);
      hoverUpdateFrame = null;
    }
    lastHoverState = null;
    hoverState.set(null);

    // Reset hover states for buttons
    const hadHoverState = isHovering || isHoveringCloseButton || isHoveringRefreshButton;
    isHovering = false;
    isHoveringCloseButton = false;
    isHoveringRefreshButton = false;

    // Trigger re-render to hide buttons
    if (hadHoverState) {
      if (renderFrame) {
        cancelAnimationFrame(renderFrame);
      }
      renderFrame = requestAnimationFrame(render);
    }
  }
  
  function handleCanvasClick(event) {
    if (!yScale || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const cssX = event.clientX - rect.left;
    const cssY = event.clientY - rect.top;

    // Check if refresh button was clicked (left of close button)
    const refreshX = contentArea.width - 50;
    const refreshY = 6;
    const buttonSize = 20;

    if (cssX >= refreshX && cssX <= refreshX + buttonSize &&
        cssY >= refreshY && cssY <= refreshY + buttonSize) {
      // Refresh button clicked
      handleRefresh();
      return;
    }

    // Check if close button was clicked (top-right corner)
    const closeX = contentArea.width - 24;
    const closeY = 6;

    if (cssX >= closeX && cssX <= closeX + buttonSize &&
        cssY >= closeY && cssY <= closeY + buttonSize) {
      // Close button clicked
      displayActions.removeDisplay(id);
      return;
    }

    // Handle marker clicks
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
              min: { width: 220, height: 120 }
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
  
  // 🔧 CONTAINER-STYLE: Update canvas with pixel-perfect dimensions (headerless design)
  $: if (canvas && ctx && config) {
    // Calculate new contentArea from config (full container, no header)
    const containerSize = config.containerSize || { width: 220, height: 120 };
    const newContentArea = {
      width: containerSize.width,  // ✅ HEADERLESS: Full container width
      height: containerSize.height // ✅ HEADERLESS: Full container height
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
      
      // 🔧 CONTAINER-STYLE: Calculate contentArea from config (headerless design)
      const containerSize = config.containerSize || { width: 220, height: 120 };
      const newContentArea = {
        width: containerSize.width,  // ✅ HEADERLESS: Full container width
        height: containerSize.height // ✅ HEADERLESS: Full container height
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

  // Hover state for close button and refresh button
  let isHovering = false;
  let isHoveringCloseButton = false;
  let isHoveringRefreshButton = false;

  // Canvas overlay rendering for refresh and close buttons
  function renderCanvasOverlays() {
    if (!ctx || !contentArea) return;

    // Save context state
    ctx.save();

    // Draw buttons (top-right) - only when hovering
    if (isHovering || isHoveringCloseButton || isHoveringRefreshButton) {
      const buttonSize = 20;
      const refreshX = contentArea.width - 50;
      const closeX = contentArea.width - 24;
      const buttonY = 6;

      // Draw refresh button
      ctx.fillStyle = isHoveringRefreshButton ? 'rgba(59, 130, 246, 0.7)' : 'rgba(59, 130, 246, 0.2)';
      ctx.fillRect(refreshX, buttonY, buttonSize, buttonSize);

      // Refresh button icon (↻)
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      // Draw circular arrow for refresh
      ctx.arc(refreshX + 10, buttonY + 10, 6, -Math.PI/2, Math.PI);
      ctx.stroke();
      // Arrow head
      ctx.beginPath();
      ctx.moveTo(refreshX + 15, buttonY + 4);
      ctx.lineTo(refreshX + 10, buttonY + 4);
      ctx.lineTo(refreshX + 10, buttonY + 9);
      ctx.stroke();

      // Draw close button
      ctx.fillStyle = isHoveringCloseButton ? 'rgba(239, 68, 68, 0.7)' : 'rgba(239, 68, 68, 0.2)';
      ctx.fillRect(closeX, buttonY, buttonSize, buttonSize);

      // Close button X
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(closeX + 5, buttonY + 5);
      ctx.lineTo(closeX + 15, buttonY + 15);
      ctx.moveTo(closeX + 15, buttonY + 5);
      ctx.lineTo(closeX + 5, buttonY + 15);
      ctx.stroke();
    }

    // Restore context state
    ctx.restore();
  }

  // Function to render symbol as canvas background (drawn before other visualizations)
  function renderSymbolBackground() {
    if (!ctx || !contentArea) return;

    // Save context state
    ctx.save();

    // Draw symbol background (top-left, behind other visualizations)
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.fillStyle = 'rgba(209, 213, 219, 0.15)'; // Very subtle - will be in background
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const symbolText = symbol || '';
    ctx.fillText(symbolText, 8, 8);

    // Restore context state
    ctx.restore();
  }

  // Function to render symbol overlay (drawn after visualizations, before buttons)
  function renderSymbolOverlay() {
    if (!ctx || !contentArea || !isHovering) return;

    // Save context state
    ctx.save();

    // Draw symbol overlay (top-left, in front of visualizations but behind buttons)
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.fillStyle = 'rgba(209, 213, 219, 1.0)'; // Full opacity - crisp and visible
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const symbolText = symbol || '';
    ctx.fillText(symbolText, 8, 8);

    // Restore context state
    ctx.restore();
  }

  function render() {
    if (!ctx || !state || !config || !canvas) {
      return;
    }

    // 🔧 CLEAN FOUNDATION: Create rendering context (headerless design)
    const containerSize = config.containerSize || { width: canvasWidth, height: canvasHeight };
    const contentArea = {
      width: containerSize.width,  // ✅ HEADERLESS: Full container width
      height: containerSize.height // ✅ HEADERLESS: Full container height
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

    // Draw symbol background first (behind all other visualizations)
    renderSymbolBackground();

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
        drawHoverIndicator(ctx, renderingContext, config, state, yScale, lastHoverState);
      } catch (error) {
        console.error(`[RENDER] Error in visualization functions:`, error);
      }
    }

    // Draw symbol overlay when hovering (appears in front of visualizations but behind buttons)
    renderSymbolOverlay();

    // Draw canvas overlays on top of everything (buttons appear above symbol overlay)
    renderCanvasOverlays();
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
  class="enhanced-floating headerless"
  class:active={isActive}
  style="left: {displayPosition.x}px; top: {displayPosition.y}px; width: {displaySize.width}px; height: {displaySize.height}px; z-index: {zIndex};"
  data-display-id={id}
  on:contextmenu={handleContextMenu}
>
  <!-- Canvas fills entire container area (headerless design) -->
  {#if state?.ready}
    <canvas
      bind:this={canvas}
      class="full-canvas"
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

<style>
  /* ✅ ULTRA-MINIMAL: Headerless design CSS - maximize trading data display */
  .enhanced-floating {
    position: fixed;
    background: #111827; /* Dark background for better contrast */
    border: 2px solid #374151;
    border-radius: 6px; /* Slightly smaller radius for headerless design */
    cursor: grab;
    user-select: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    overflow: hidden; /* Prevent canvas overflow */
  }

  .enhanced-floating:hover {
    border-color: #4f46e5;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }

  .enhanced-floating.active {
    border-color: #4f46e5;
    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.3), 0 4px 12px rgba(0, 0, 0, 0.4);
  }

  /* Full canvas fills entire container area (headerless design) */
  .full-canvas {
    display: block;
    width: 100%;
    height: 100%;
    cursor: grab;
  }

  .full-canvas:active {
    cursor: grabbing;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #6b7280;
    gap: 8px;
    background: #111827;
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

  /* Active state visual feedback (border glow instead of header dot) */
  .enhanced-floating.active::before {
    content: '';
    position: absolute;
    top: -2px;
    left: -2px;
    right: -2px;
    bottom: -2px;
    border-radius: 6px;
    background: linear-gradient(45deg, #4f46e5, #8b5cf6);
    opacity: 0.3;
    z-index: -1;
    animation: activeGlow 2s ease-in-out infinite alternate;
  }

  @keyframes activeGlow {
    0% { opacity: 0.2; }
    100% { opacity: 0.4; }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .enhanced-floating.active::before {
      animation: none;
    }
  }
</style>
