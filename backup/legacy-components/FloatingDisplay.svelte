<script>
  import { onMount, onDestroy } from 'svelte';
  import { floatingStore, actions, geometryActions, GEOMETRY } from '../stores/floatingStore.js';
  import { connectionManager } from '../data/ConnectionManager.js';
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
  
  // SIMPLIFIED SOLUTION: Direct store access with no cyclical dependencies
  $: display = $floatingStore.displays?.get(id);
  $: config = display?.config || {};
  $: state = display?.state || {};
  $: isReady = display?.ready || false;
  $: isActive = display?.isActive || false;
  $: currentZIndex = display?.zIndex || 1;
  
  // Store-derived position and size (Reference Canvas Pattern)
  $: displayPosition = display?.position || position;
  
  // 🔧 CRITICAL FIX: Use proper default container dimensions (240×160px)
  // This matches GEOMETRY.COMPONENTS.FloatingDisplay.defaultSize (240×160px total)
  // Canvas will be 220×120px, container will be 240×160px (including 40px header)
  $: displaySize = { 
    width: Math.min(2000, config.visualizationsContentWidth || 240), 
    height: Math.min(2000, (config.meterHeight || 120) + 40) // Canvas height (120px) + header height (40px) = 160px total
  };
  
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
    // 🔧 CRITICAL FIX: Debug coordinate transformation pipeline
    if ($floatingStore.draggedItem?.type === 'display' && $floatingStore.draggedItem?.id === id) {
      // Get raw mouse movement delta
      const mouseDeltaX = e.movementX || 0;
      const mouseDeltaY = e.movementY || 0;
      
      console.log(`[DRAG_DEBUG] Mouse movement: ${mouseDeltaX}x${mouseDeltaY}px`);
      
      // Get current position and apply direct mouse delta for 1:1 scaling
      const currentPosition = $floatingStore.displays.get(id)?.position || { x: 0, y: 0 };
      let newX = currentPosition.x + mouseDeltaX;
      let newY = currentPosition.y + mouseDeltaY;
      
      console.log(`[DRAG_DEBUG] New position: ${newX}x${newY}px (from ${currentPosition.x}x${currentPosition.y})`);
      
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
    console.log(`[RESIZE_START] ${handle} handle clicked for display ${id}`);
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
    actions.setActiveDisplay(id);
    
    // Use unified context menu system
    const context = {
      type: e.target.closest('canvas') ? 'canvas' : 
            e.target.closest('.header') ? 'header' : 'workspace',
      targetId: id,
      targetType: 'display'
    };
    
    actions.showUnifiedContextMenu(e.clientX, e.clientY, context);
  }
  
  function handleClose() {
    actions.removeDisplay(id);
  }
  
  // REFERENCE CANVAS PATTERN: Base reference dimensions
  const REFERENCE_CANVAS = { width: 220, height: 120 };
  
  // Current canvas dimensions (can be resized)
  let canvasWidth = REFERENCE_CANVAS.width;
  let canvasHeight = REFERENCE_CANVAS.height;
  
  // 🔧 CRITICAL FIX: Updated scaleToCanvas to handle config values correctly
  // The config values are now in their raw form (percentages or absolute pixels)
  function scaleToCanvas(config, currentCanvasWidth, currentCanvasHeight) {
    if (!config) return {};
    
    // 🔧 CRITICAL FIX: Handle both percentage and absolute values
    // If config.visualizationsContentWidth is a percentage (<= 200), treat as percentage
    // If it's an absolute pixel value (> 200), use it directly
    const isContentWidthPercentage = (config.visualizationsContentWidth || 0) <= 200;
    const isMeterHeightPercentage = (config.meterHeight || 0) <= 200;
    
    return {
      // Layout parameters - handle both percentage and absolute values
      visualizationsContentWidth: isContentWidthPercentage 
        ? (config.visualizationsContentWidth / 100) * currentCanvasWidth
        : config.visualizationsContentWidth || currentCanvasWidth,
      meterHeight: isMeterHeightPercentage
        ? (config.meterHeight / 100) * currentCanvasHeight
        : config.meterHeight || currentCanvasHeight,
      centralAxisXPosition: (config.centralAxisXPosition / 100) * currentCanvasWidth,
      
      // Price display parameters (always percentage-based)
      priceFloatWidth: (config.priceFloatWidth / 100) * currentCanvasWidth,
      priceFloatHeight: (config.priceFloatHeight / 100) * currentCanvasHeight,
      priceFloatXOffset: (config.priceFloatXOffset / 100) * currentCanvasWidth,
      priceFontSize: (config.priceFontSize / 100) * currentCanvasHeight,
      priceHorizontalOffset: (config.priceHorizontalOffset / 100) * currentCanvasWidth,
      priceDisplayPadding: (config.priceDisplayPadding / 100) * currentCanvasWidth,
      
      // Volatility parameters (always percentage-based)
      volatilityOrbBaseWidth: (config.volatilityOrbBaseWidth / 100) * currentCanvasWidth,
      
      // Pass through non-scaled parameters unchanged
      ...Object.fromEntries(
        Object.entries(config).filter(([key]) => ![
          'visualizationsContentWidth', 'meterHeight', 'centralAxisXPosition',
          'priceFloatWidth', 'priceFloatHeight', 'priceFloatXOffset', 'priceFontSize',
          'priceHorizontalOffset', 'priceDisplayPadding', 'volatilityOrbBaseWidth'
        ].includes(key))
      )
    };
  }
  
  // 🔧 CRITICAL FIX: Debounce scaledConfig during resize to prevent temporary overscaling
  let resizeDebounceTimer = null;
  let lastDisplaySize = { width: 0, height: 0 };
  
  $: if (displaySize && (displaySize.width !== lastDisplaySize.width || displaySize.height !== lastDisplaySize.height)) {
    lastDisplaySize = { ...displaySize };
    
    // Clear existing timer
    if (resizeDebounceTimer) {
      clearTimeout(resizeDebounceTimer);
    }
    
    // Debounce during resize operations
    const isResizing = $floatingStore.resizeState?.isResizing;
    if (isResizing) {
      // During resize, wait a bit longer to settle
      resizeDebounceTimer = setTimeout(() => {
        scaledConfig = scaleToCanvas(config, displaySize.width, displaySize.height - 40);
      }, 50);
    } else {
      // Not resizing, update immediately
      scaledConfig = scaleToCanvas(config, displaySize.width, displaySize.height - 40);
    }
  }
  
  // Initialize scaledConfig
  let scaledConfig = {};
  
  // FIXED: Use scaled config height for yScale calculation
  $: yScale = state?.visualLow && state?.visualHigh && scaledConfig?.meterHeight
    ? scaleLinear().domain([state.visualLow, state.visualHigh]).range([scaledConfig.meterHeight, 0])
    : null;
  
  // UNIFIED: Use config directly for rendering (no conversion needed)
  $: renderingConfig = config;
  
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
  
  // 🔧 CRITICAL FIX: Initialize canvas with proper default container dimensions
  onMount(async () => {
    console.log(`[FLOATING_DISPLAY] Mounting display ${id} for symbol ${symbol}`);
    
    // 🔧 CRITICAL FIX: Use actual default container dimensions (240×160px total, 220×120px canvas)
    if (canvas) {
      const DEFAULT_CANVAS_WIDTH = 220;  // Canvas width (container width - padding)
      const DEFAULT_CANVAS_HEIGHT = 120; // Canvas height (container height - header - padding)
      
      canvas.width = DEFAULT_CANVAS_WIDTH;
      canvas.height = DEFAULT_CANVAS_HEIGHT;
      canvasWidth = DEFAULT_CANVAS_WIDTH;
      canvasHeight = DEFAULT_CANVAS_HEIGHT;
      console.log(`[CANVAS_INIT] Set initial canvas size: ${DEFAULT_CANVAS_WIDTH}x${DEFAULT_CANVAS_HEIGHT}`);
    }
    
    // Subscribe to data through ConnectionManager
    try {
      console.log(`[FLOATING_DISPLAY] Subscribing to data for ${symbol}`);
      await connectionManager.subscribeCanvas(id, symbol);
      console.log(`[FLOATING_DISPLAY] Successfully subscribed to ${symbol}`);
    } catch (error) {
      console.error(`[FLOATING_DISPLAY] Failed to subscribe to ${symbol}:`, error);
    }
    
    const checkCanvas = setInterval(() => {
      if (canvas && !ctx) {
        ctx = canvas.getContext('2d');
        dpr = window.devicePixelRatio || 1;
        
        // 🔧 CRITICAL FIX: Ensure canvas has proper default size
        if (canvas.width === 0 || canvas.height === 0) {
          const DEFAULT_CANVAS_WIDTH = 220;
          const DEFAULT_CANVAS_HEIGHT = 120;
          
          canvas.width = DEFAULT_CANVAS_WIDTH;
          canvas.height = DEFAULT_CANVAS_HEIGHT;
          console.log(`[CANVAS_FIX] Reset canvas to default size: ${DEFAULT_CANVAS_WIDTH}x${DEFAULT_CANVAS_HEIGHT}`);
        }
        
        updateCanvasSize();
        
        clearInterval(checkCanvas);
      }
    }, 100);
    
    return () => {
      clearInterval(checkCanvas);
      // Unsubscribe from data when component is destroyed
      console.log(`[FLOATING_DISPLAY] Unsubscribing from data for ${symbol}`);
      connectionManager.unsubscribeCanvas(id);
    };
  });
  
  // REFERENCE CANVAS: Update canvas when display size changes - FIXED: Use container size, not scaled config
  $: if (canvas && ctx && displaySize) {
    const currentWidth = canvas.width;
    const currentHeight = canvas.height;
    const newWidth = displaySize.width;
    const newHeight = displaySize.height - 40; // Subtract header height
    
    // STABILITY: Add threshold to prevent micro-updates and infinite loops
    const widthThreshold = 5; // Minimum 5px change required
    const heightThreshold = 5; // Minimum 5px change required
    const widthDiff = Math.abs(currentWidth - newWidth);
    const heightDiff = Math.abs(currentHeight - newHeight);
    
    console.log(`[CANVAS_RESIZE] Size check: current=${currentWidth}x${currentHeight}, new=${newWidth}x${newHeight}, diff=${widthDiff}x${heightDiff}`);
    
    if (widthDiff > widthThreshold || heightDiff > heightThreshold) {
      updateCanvasSize(newWidth, newHeight);
    }
  }
  
  function updateCanvasSize(newWidth, newHeight) {
    if (!canvas || !ctx) return;
    
    // SAFETY: Apply reasonable limits to prevent exponential growth
    const safeWidth = Math.min(2000, Math.max(100, newWidth));
    const safeHeight = Math.min(2000, Math.max(80, newHeight));
    
    console.log(`[CANVAS_UPDATE] Setting canvas size to: ${safeWidth}x${safeHeight}`);
    
    // Update canvas dimensions
    canvas.width = safeWidth;
    canvas.height = safeHeight;
    
    // Update tracking variables
    canvasWidth = safeWidth;
    canvasHeight = safeHeight;
    
    // Clear and reset context
    ctx.clearRect(0, 0, safeWidth, safeHeight);
    
    // No device pixel ratio scaling for pure canvas dimensions
    if (dpr !== 1) {
      ctx.scale(dpr, dpr);
    }
  }
  
  // Canvas rendering
  let renderFrame;
  let lastRenderTime = 0;
  
  function render(timestamp = 0) {
    if (!ctx || !state || !config || !yScale) {
      console.log(`[RENDER_DEBUG] Render blocked:`, {
        hasCtx: !!ctx,
        hasState: !!state,
        hasConfig: !!config,
        hasYScale: !!yScale,
        stateKeys: state ? Object.keys(state) : null,
        configKeys: config ? Object.keys(config) : null,
        visualLow: state?.visualLow,
        visualHigh: state?.visualHigh
      });
      return;
    }
    
    if (timestamp - lastRenderTime < 16) {
      renderFrame = requestAnimationFrame(render);
      return;
    }
    lastRenderTime = timestamp;
    
    // 🔧 CRITICAL FIX: Clear entire canvas to prevent trail artifacts
    // Use full canvas dimensions, not just content dimensions
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // REFERENCE CANVAS: Use scaled config for rendering
    const { visualizationsContentWidth, meterHeight } = scaledConfig;
    
    try {
      drawMarketProfile(ctx, scaledConfig, state, yScale);
      drawDayRangeMeter(ctx, scaledConfig, state, yScale);
      drawVolatilityOrb(ctx, scaledConfig, state, visualizationsContentWidth, meterHeight);
      drawPriceFloat(ctx, scaledConfig, state, yScale);
      drawPriceDisplay(ctx, scaledConfig, state, yScale, visualizationsContentWidth);
      drawVolatilityMetric(ctx, scaledConfig, state, visualizationsContentWidth, meterHeight);
      
      drawPriceMarkers(ctx, scaledConfig, state, yScale, markers);
      drawHoverIndicator(ctx, scaledConfig, state, yScale, $hoverState);
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
    height: 100%;
    object-fit: contain; /* 🔧 CRITICAL FIX: Restore object-fit to maintain proper aspect ratio */
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
