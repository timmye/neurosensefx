<script>
  import { onMount, onDestroy } from 'svelte';
  import { floatingStore, actions, geometryActions, GEOMETRY } from '../stores/floatingStore.js';
  import { connectionManager, canvasDataStore } from '../data/ConnectionManager.js';
  import { scaleLinear } from 'd3-scale';
  import { writable } from 'svelte/store';
  import { markerStore } from '../stores/markerStore.js';
  
  // Import drawing functions
  import { drawMarketProfile } from '../lib/viz/marketProfile.js';
  import { drawDayRangeMeter } from '../lib/viz/dayRangeMeter.js';
  import { drawVolatilityOrb } from '../lib/viz/volatilityOrb.js';
  import { drawPriceFloat } from '../lib/viz/priceFloat.js';
  import { drawPriceDisplay } from '../lib/viz/priceDisplay.js';
  import { drawVolatilityMetric } from '../lib/viz/volatilityMetric.js';
  import { drawPriceMarkers } from '../lib/viz/priceMarkers.js';
  import { drawHoverIndicator } from '../lib/viz/hoverIndicator.js';
  
  // Component props
  export let id;
  export let symbol;
  export let position = { x: 100, y: 100 };
  
  // Local state
  let element;
  let canvas;
  let ctx;
  let dpr = 1;
  
  // Store-based state - REMOVED local drag variables for full store migration
  let isResizing = false;
  let resizeHandle = null;
  let isHovered = false;
  
  // Production canvas and data state
  let canvasData = {};
  let config = {};
  let state = {};
  let isReady = false;
  let display = null;
  let isActive = false;
  let currentZIndex = 1;
  let showResizeHandles = false;
  
  // Hover and marker state
  const hoverState = writable(null);
  let markers = [];
  
  // Store-derived position and size
  $: displayPosition = display?.position || position;
  $: displaySize = { 
    width: display?.config?.visualizationsContentWidth || 240, 
    height: (display?.config?.meterHeight || 120) + 40 // Add header height
  };
  
  // Store subscriptions
  $: if ($canvasDataStore) {
    canvasData = $canvasDataStore.get(id) || {};
    config = canvasData.config || {};
    state = canvasData.state || {};
    isReady = canvasData?.ready || false;
    
    display = $floatingStore.displays?.get(id);
    isActive = display?.isActive || false;
    currentZIndex = display?.zIndex || 1;
  }
  
  // Update markers from store
  $: if ($markerStore !== undefined) {
    markers = $markerStore;
  }
  
  // WORKING: All functions from CleanFloatingElement - no changes
  
  function getAllFloatingElements() {
    return Array.from(document.querySelectorAll('.enhanced-floating'))
      .filter(el => el !== element)
      .map(el => ({
        element: el,
        x: parseInt(el.style.left) || 0,
        y: parseInt(el.style.top) || 0,
        width: el.offsetWidth,
        height: el.offsetHeight
      }));
  }
  
  function checkCollision(newX, newY, newWidth = displaySize.width, newHeight = displaySize.height) {
    const workspaceSettings = $floatingStore.workspaceSettings || {};
    if (!workspaceSettings.collisionDetectionEnabled) return { canMove: true };
    
    const others = getAllFloatingElements();
    
    for (const other of others) {
      const otherBounds = {
        left: other.x,
        right: other.x + other.width,
        top: other.y,
        bottom: other.y + other.height
      };
      
      const newBounds = {
        left: newX,
        right: newX + newWidth,
        top: newY,
        bottom: newY + newHeight
      };
      
      if (newBounds.left < otherBounds.right &&
          newBounds.right > otherBounds.left &&
          newBounds.top < otherBounds.bottom &&
          newBounds.bottom > otherBounds.top) {
        
        const currentBounds = {
          left: displayPosition.x,
          right: displayPosition.x + displaySize.width,
          top: displayPosition.y,
          bottom: displayPosition.y + displaySize.height
        };
        
        const positions = [
          { x: otherBounds.left - newWidth, y: newY },
          { x: otherBounds.right, y: newY },
          { x: newX, y: otherBounds.top - newHeight },
          { x: newX, y: otherBounds.bottom }
        ];
        
        let bestPosition = null;
        let minDistance = Infinity;
        
        for (const pos of positions) {
          const distance = Math.sqrt(
            Math.pow(pos.x - currentBounds.left, 2) + 
            Math.pow(pos.y - currentBounds.top, 2)
          );
          
          if (distance < minDistance) {
            minDistance = distance;
            bestPosition = pos;
          }
        }
        
        return { 
          canMove: false, 
          collision: other,
          suggestedPosition: bestPosition
        };
      }
    }
    
    return { canMove: true };
  }
  
  function snapToGrid(value) {
    const workspaceSettings = $floatingStore.workspaceSettings || {};
    if (!workspaceSettings.gridSnapEnabled) return value;
    
    const gridSize = workspaceSettings.gridSize || 20;
    const threshold = gridSize / 2;
    
    const offset = value % gridSize;
    const shouldSnap = offset < threshold || offset > (gridSize - threshold);
    
    return shouldSnap ? Math.round(value / gridSize) * gridSize : value;
  }
  
  function handleMouseDown(e) {
    if (e.button !== 0) return;
    
    if (e.target.classList.contains('resize-handle')) {
      return;
    }
    
    // ✅ STORE ACTION: Use central store for dragging - no local state
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
    // ✅ STORE ACTION: Let store handle all interactions - no local calculations
    if ($floatingStore.draggedItem?.type === 'display' && $floatingStore.draggedItem?.id === id) {
      // Store manages drag state and calculations
      const rect = element.getBoundingClientRect();
      let newX = e.clientX - $floatingStore.draggedItem.offset.x;
      let newY = e.clientY - $floatingStore.draggedItem.offset.y;
      
      // ✅ ENABLED: Apply grid snapping if enabled in workspace settings
      const workspaceSettings = $floatingStore.workspaceSettings || {};
      if (workspaceSettings.gridSnapEnabled) {
        const gridSize = workspaceSettings.gridSize || 20;
        newX = Math.round(newX / gridSize) * gridSize;
        newY = Math.round(newY / gridSize) * gridSize;
      }
      
      // ✅ ENABLED: Apply viewport boundary constraints
      const displaySize = {
        width: GEOMETRY.COMPONENTS.FloatingDisplay.defaultSize.width,
        height: GEOMETRY.COMPONENTS.FloatingDisplay.defaultSize.height
      };
      const constrainedPosition = GEOMETRY.TRANSFORMS.constrainToViewport(
        { x: newX, y: newY }, 
        displaySize
      );
      
      // ✅ ENABLED: Check collision detection if enabled
      if (workspaceSettings.collisionDetectionEnabled) {
        const collision = checkCollision(constrainedPosition.x, constrainedPosition.y);
        if (collision.canMove) {
          actions.updateDrag({ x: constrainedPosition.x, y: constrainedPosition.y });
        } else if (collision.suggestedPosition) {
          // Apply grid snapping to suggested position
          let suggestedX = collision.suggestedPosition.x;
          let suggestedY = collision.suggestedPosition.y;
          if (workspaceSettings.gridSnapEnabled) {
            const gridSize = workspaceSettings.gridSize || 20;
            suggestedX = Math.round(suggestedX / gridSize) * gridSize;
            suggestedY = Math.round(suggestedY / gridSize) * gridSize;
          }
          actions.updateDrag({ x: suggestedX, y: suggestedY });
        }
      } else {
        // No collision detection - just apply constrained position
        actions.updateDrag({ x: constrainedPosition.x, y: constrainedPosition.y });
      }
    } else if ($floatingStore.resizeState?.isResizing && $floatingStore.resizeState?.displayId === id) {
      // ✅ STORE ACTION: Already working - store manages resize
      const mousePos = { x: e.clientX, y: e.clientY };
      actions.updateResize(mousePos);
    }
  }
  
  function handleMouseUp() {
    // ✅ STORE ACTION: Use store end actions - no local state management
    actions.endDrag();
    actions.endResize();
    
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }
  
  function handleResizeStart(e, handle) {
    isResizing = true;
    resizeHandle = handle;
    
    // ✅ STORE ACTION: Use store action for resize start - no local state
    actions.startResize(id, handle, displayPosition, displaySize, { x: e.clientX, y: e.clientY });
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    e.stopPropagation();
    e.preventDefault();
  }
  
  function checkIfOnlyTouching(other, newX, newY, newWidth, newHeight) {
    const otherBounds = {
      left: other.x,
      right: other.x + other.width,
      top: other.y,
      bottom: other.y + other.height
    };
    
    const newBounds = {
      left: newX,
      right: newX + newWidth,
      top: newY,
      bottom: newY + newHeight
    };
    
    const tolerance = 1;
    
    const touchingLeft = Math.abs(newBounds.right - otherBounds.left) <= tolerance;
    const touchingRight = Math.abs(newBounds.left - otherBounds.right) <= tolerance;
    const touchingTop = Math.abs(newBounds.bottom - otherBounds.top) <= tolerance;
    const touchingBottom = Math.abs(newBounds.top - otherBounds.bottom) <= tolerance;
    
    const horizontalTouch = touchingLeft || touchingRight;
    const verticalTouch = touchingTop || touchingBottom;
    
    const horizontalOverlap = newBounds.left < otherBounds.right && newBounds.right > otherBounds.left;
    const verticalOverlap = newBounds.top < otherBounds.bottom && newBounds.bottom > otherBounds.top;
    
    return (horizontalTouch && !verticalOverlap) || (verticalTouch && !horizontalOverlap);
  }
  
  // Production event handlers
  function handleContextMenu(e) {
    e.preventDefault();
    actions.showContextMenu(e.clientX, e.clientY, id, 'display');
    actions.setActiveDisplay(id);
  }
  
  function handleClose() {
    actions.removeDisplay(id);
  }
  
  // Canvas mouse event handlers
  let yScale;
  $: if (state && config && state.visualLow && state.visualHigh) {
    yScale = scaleLinear()
      .domain([state.visualLow, state.visualHigh])
      .range([config.meterHeight, 0]);
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
  
  // Canvas setup and rendering
  onMount(() => {
    const checkCanvas = setInterval(() => {
      if (canvas && !ctx) {
        ctx = canvas.getContext('2d');
        dpr = window.devicePixelRatio || 1;
        
        updateCanvasSize();
        
        clearInterval(checkCanvas);
      }
    }, 100);
    
    return () => {
      clearInterval(checkCanvas);
    };
  });
  
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
  
  // Canvas rendering
  let renderFrame;
  let lastRenderTime = 0;
  
  function render(timestamp = 0) {
    if (!ctx || !state || !config || !yScale) {
      return;
    }
    
    if (timestamp - lastRenderTime < 16) {
      renderFrame = requestAnimationFrame(render);
      return;
    }
    lastRenderTime = timestamp;
    
    const { visualizationsContentWidth, meterHeight } = config;
    
    ctx.clearRect(0, 0, visualizationsContentWidth, meterHeight);
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, visualizationsContentWidth, meterHeight);
    
    try {
      drawMarketProfile(ctx, config, state, yScale);
      drawDayRangeMeter(ctx, config, state, yScale);
      drawVolatilityOrb(ctx, config, state, visualizationsContentWidth, meterHeight);
      drawPriceFloat(ctx, config, state, yScale);
      drawPriceDisplay(ctx, config, state, yScale, visualizationsContentWidth);
      drawVolatilityMetric(ctx, config, state, visualizationsContentWidth, meterHeight);
      
      drawPriceMarkers(ctx, config, state, yScale, markers);
      drawHoverIndicator(ctx, config, state, yScale, $hoverState);
    } catch (error) {
      console.error(`[RENDER_ERROR] Error drawing visualizations:`, error);
    }
    
    renderFrame = requestAnimationFrame(render);
  }
  
  $: if (ctx && state && config && isReady && yScale) {
    if (renderFrame) {
      cancelAnimationFrame(renderFrame);
    }
    render();
  }
  
  $: showResizeHandles = isHovered || isResizing;
  
  onDestroy(() => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    if (renderFrame) {
      cancelAnimationFrame(renderFrame);
    }
  });
</script>

<div 
  bind:this={element}
  class="enhanced-floating"
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
    {#if isReady}
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
  
  <!-- WORKING Resize Handles from CleanFloatingElement -->
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

<style>
  /* WORKING: Exact CSS from CleanFloatingElement */
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
  
  .enhanced-floating:hovered {
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
    height: auto;
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
  
  /* WORKING: Exact resize handle CSS from CleanFloatingElement */
  .resize-handle {
    position: absolute;
    background: #4f46e5;
    border: 1px solid #6366f1;
    border-radius: 2px;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  
  .enhanced-floating:hovered .resize-handle,
  .resize-handle:hover {
    opacity: 1;
  }
  
  .resize-handle:hover {
    background: #6366f1;
  }
  
  .resize-handle.nw {
    top: -4px;
    left: -4px;
    width: 8px;
    height: 8px;
    cursor: nw-resize;
  }
  
  .resize-handle.ne {
    top: -4px;
    right: -4px;
    width: 8px;
    height: 8px;
    cursor: ne-resize;
  }
  
  .resize-handle.se {
    bottom: -4px;
    right: -4px;
    width: 8px;
    height: 8px;
    cursor: se-resize;
  }
  
  .resize-handle.sw {
    bottom: -4px;
    left: -4px;
    width: 8px;
    height: 8px;
    cursor: sw-resize;
  }
  
  .resize-handle.n {
    top: -4px;
    left: 50%;
    transform: translateX(-50%);
    width: 8px;
    height: 8px;
    cursor: n-resize;
  }
  
  .resize-handle.s {
    bottom: -4px;
    left: 50%;
    transform: translateX(-50%);
    width: 8px;
    height: 8px;
    cursor: s-resize;
  }
  
  .resize-handle.e {
    top: 50%;
    right: -4px;
    transform: translateY(-50%);
    width: 8px;
    height: 8px;
    cursor: e-resize;
  }
  
  .resize-handle.w {
    top: 50%;
    left: -4px;
    transform: translateY(-50%);
    width: 8px;
    height: 8px;
    cursor: w-resize;
  }
</style>
