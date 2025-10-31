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
  
  // 🔧 UNIFIED SIZING: Import canvas sizing utilities
  import { createCanvasSizingConfig, configureCanvasContext, configUtils } from '../utils/canvasSizing.js';
  
  // ✅ CONSOLIDATED: Import simplified ResizeHandle component
  import ResizeHandle from './ResizeHandle.svelte';
  
  // ✅ CENTRALIZED: Import InteractionManager for single authority
  import { interactionManager } from '../managers/InteractionManager.js';
  
  // Component props
  export let id;
  export let symbol;
  export let position = { x: 100, y: 100 };
  
  // Local state
  let element;
  let canvas;
  let ctx;
  let dpr = 1;
  
  // Clean unified interaction - using store state only
  
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
  
  // 🔧 UNIFIED SIZING: Canvas sizing configuration for FloatingDisplay
  let canvasSizingConfig = null;
  let normalizedConfig = {};
  
  // 🔧 UNIFIED SIZING: Use unified canvas sizing for display size
  $: if (display && config) {
    // 🔧 FIX: Use proper default container dimensions from GEOMETRY foundation
    const containerSize = {
      width: GEOMETRY.COMPONENTS.FloatingDisplay.defaultSize.width,   // 240px default width
      height: GEOMETRY.COMPONENTS.FloatingDisplay.defaultSize.height  // 160px default height (includes header)
    };
    
    // Create unified canvas sizing configuration
    canvasSizingConfig = createCanvasSizingConfig(containerSize, config, {
      includeHeader: true,
      padding: 8,
      headerHeight: 40,
      respectDpr: true
    });
    
    // Update normalized config for rendering
    normalizedConfig = canvasSizingConfig.config;
    
    // Canvas sizing applied silently
  }
  
  // 🔧 UNIFIED SIZING: Calculate display size from canvas sizing config
  // 🔧 CRITICAL FIX: Make displaySize reactive to position changes during resize
  $: displaySize = canvasSizingConfig ? {
    width: canvasSizingConfig.dimensions.container.width,
    height: canvasSizingConfig.dimensions.container.height
  } : {
    width: GEOMETRY.COMPONENTS.FloatingDisplay.defaultSize.width,
    height: GEOMETRY.COMPONENTS.FloatingDisplay.defaultSize.height
  };
  
  // 🔧 CRITICAL FIX: Alternative display size calculation for resize operations
  // When resize is active, calculate size directly from display position changes
  $: resizeDisplaySize = () => {
    if (!$floatingStore.resizeState.isResizing || $floatingStore.resizeState.displayId !== id) {
      return displaySize; // Use normal calculation
    }
    
    // During resize, calculate container size from position + stored config percentages
    const display = $floatingStore.displays?.get(id);
    if (!display) return displaySize;
    
    // Calculate actual canvas dimensions from stored percentages
    const canvasWidth = (display.config.visualizationsContentWidth / 100) * 220; // Reference canvas width
    const canvasHeight = (display.config.meterHeight / 100) * 120; // Reference canvas height
    
    // Convert to container dimensions (add header and padding)
    return {
      width: canvasWidth + 20, // Add padding/borders
      height: canvasHeight + 40  // Add header height
    };
  };
  
  // 🔧 CRITICAL FIX: Use resize-aware size during operations
  $: actualDisplaySize = $floatingStore.resizeState.isResizing && $floatingStore.resizeState.displayId === id 
    ? resizeDisplaySize() 
    : displaySize;
  
  // Update markers from store
  $: if ($markerStore !== undefined) {
    markers = $markerStore;
  }
  
  // ✅ REMOVED: All competing collision detection and grid snapping functions
  // These are now handled by store actions and InteractionManager
  
  // ✅ CENTRALIZED: Simplified mouse handling using InteractionManager
  function handleMouseDown(e) {
    if (e.button !== 0) return;
    if (e.target.closest('.resize-handle')) return; // Let handles handle themselves
    
    // Set this display as active
    actions.setActiveDisplay(id);
    
    const bounds = element.getBoundingClientRect();
    
    interactionManager.handleMouseDown(
      id,
      'drag',
      null,
      { x: e.clientX, y: e.clientY },
      { 
        position: { x: bounds.left, y: bounds.top },
        size: { width: bounds.width, height: bounds.height }
      }
    );
    
    e.preventDefault();
  }
  
  // ✅ REMOVED: checkIfOnlyTouching - competing collision detection
  // Now handled by store actions and InteractionManager
  
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
  
  // 🔧 UNIFIED CONFIG HANDLING: Use configUtils for clean percentage/absolute detection
  function scaleToCanvas(config, currentCanvasWidth, currentCanvasHeight) {
    if (!config) return {};
    
    // 🔧 UNIFIED CONFIG HANDLING: Use configUtils for consistent value detection
    const normalizedConfig = configUtils.normalizeConfig(config);
    
    return {
      // Layout parameters - handle both percentage and absolute values
      visualizationsContentWidth: normalizedConfig.visualizationsContentWidth <= 200
        ? (normalizedConfig.visualizationsContentWidth / 100) * currentCanvasWidth
        : normalizedConfig.visualizationsContentWidth || currentCanvasWidth,
      meterHeight: normalizedConfig.meterHeight <= 200
        ? (normalizedConfig.meterHeight / 100) * currentCanvasHeight
        : normalizedConfig.meterHeight || currentCanvasHeight,
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
  
  // 🔧 UNIFIED SIZING: Initialize canvas with unified sizing approach
  onMount(async () => {
    console.log(`[FLOATING_DISPLAY] Mounting display ${id} for symbol ${symbol}`);
    
    // Initialize canvas context
    if (canvas) {
      ctx = canvas.getContext('2d');
      dpr = window.devicePixelRatio || 1;
      
      // Set default canvas size using reference dimensions
      canvas.width = REFERENCE_CANVAS.width;
      canvas.height = REFERENCE_CANVAS.height;
      canvasWidth = REFERENCE_CANVAS.width;
      canvasHeight = REFERENCE_CANVAS.height;
      
      console.log(`[CANVAS_INIT] Set initial canvas size: ${REFERENCE_CANVAS.width}x${REFERENCE_CANVAS.height}`);
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
        
        // Ensure canvas has proper default size
        if (canvas.width === 0 || canvas.height === 0) {
          canvas.width = REFERENCE_CANVAS.width;
          canvas.height = REFERENCE_CANVAS.height;
          console.log(`[CANVAS_FIX] Reset canvas to reference size: ${REFERENCE_CANVAS.width}x${REFERENCE_CANVAS.height}`);
        }
        
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
  
  // 🔧 UNIFIED SIZING: Update canvas using unified sizing config
  $: if (canvas && ctx && canvasSizingConfig) {
    const currentWidth = canvas.width;
    const currentHeight = canvas.height;
    const { canvas: newCanvasDims } = canvasSizingConfig.dimensions;
    
    // STABILITY: Add threshold to prevent micro-updates and infinite loops
    const widthThreshold = 5; // Minimum 5px change required
    const heightThreshold = 5; // Minimum 5px change required
    const widthDiff = Math.abs(currentWidth - newCanvasDims.width);
    const heightDiff = Math.abs(currentHeight - newCanvasDims.height);
    
    // Canvas resize check performed
    
    if (widthDiff > widthThreshold || heightDiff > heightThreshold) {
      updateCanvasSizeUnified(newCanvasDims.width, newCanvasDims.height);
    }
  }
  
  function updateCanvasSizeUnified(newWidth, newHeight) {
    if (!canvas || !ctx) return;
    
    // 🔧 UNIFIED SIZING: Use canvas sizing configuration for consistent updates
    if (canvasSizingConfig) {
      // Configure canvas context with unified sizing
      configureCanvasContext(ctx, canvasSizingConfig.dimensions);
      
      // Update canvas dimensions from unified config
      const { canvas: canvasDims } = canvasSizingConfig.dimensions;
      canvas.width = canvasDims.width;
      canvas.height = canvasDims.height;
      
      console.log(`[CANVAS_UPDATE_UNIFIED] Setting canvas size from unified config: ${canvasDims.width}x${canvasDims.height}`, {
        canvasDimensions: canvasDims,
        containerDimensions: canvasSizingConfig.dimensions.container,
        normalizedConfig: canvasSizingConfig.config
      });
    } else {
      // Fallback to manual sizing
      const safeWidth = Math.min(2000, Math.max(100, newWidth));
      const safeHeight = Math.min(2000, Math.max(80, newHeight));
      
      canvas.width = safeWidth;
      canvas.height = safeHeight;
      
      if (dpr !== 1) {
        ctx.scale(dpr, dpr);
      }
    }
  }
  
  // 🔧 PERFORMANCE OPTIMIZATION: Add debouncing for reactive rendering
  let renderFrame;
  let lastRenderTime = 0;
  let renderDebounceTimer = null;
  let lastRenderState = null;
  
  function render(timestamp = 0) {
    if (!ctx || !state || !config || !canvas) {
      return;
    }
    
    // 🔧 STEP 1: CLEAR CANVAS AND PREPARE FOR VISUALIZATIONS
    
    // Clear canvas completely
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 🔧 COMMENTED OUT: Test shapes - visualizations are working, remove test artifacts
    // Draw test rectangle (should be visible)
    // ctx.fillStyle = '#ff0000';
    // ctx.fillRect(10, 10, 50, 30);
    // console.log(`[RENDER_PIPELINE] Drew test rectangle at (10, 10) with size (50, 30)`);
    
    // Draw test text (should be visible)
    // ctx.fillStyle = '#ffffff';
    // ctx.font = '12px Arial';
    // ctx.fillText('TEST TEXT', 10, 60);
    // console.log(`[RENDER_PIPELINE] Drew test text at (10, 60)`);
    
    // 🔧 STEP 2: TEST YSCALE CALCULATION
    if (state.visualLow && state.visualHigh && scaledConfig?.meterHeight) {
      const renderYScale = scaleLinear().domain([state.visualLow, state.visualHigh]).range([scaledConfig.meterHeight, 0]);
      
      // 🔧 STEP 3: TEST VISUALIZATION FUNCTIONS
      try {
        drawMarketProfile(ctx, scaledConfig, state, renderYScale);
        drawDayRangeMeter(ctx, scaledConfig, state, renderYScale);
        drawPriceFloat(ctx, scaledConfig, state, renderYScale);
        drawPriceDisplay(ctx, scaledConfig, state, renderYScale, scaledConfig.visualizationsContentWidth);
      } catch (error) {
        console.error(`[RENDER_PIPELINE] Error in visualization functions:`, error);
      }
    }
    
    // 🔧 STEP 4: TEST HOVER AND MARKERS
    try {
      drawPriceMarkers(ctx, scaledConfig, state, yScale, markers); // Use proper yScale
      drawHoverIndicator(ctx, scaledConfig, state, yScale, $hoverState); // Use proper yScale
    } catch (error) {
      console.error(`[RENDER_PIPELINE] Error in hover/markers:`, error);
    }
    
    //console.log(`[RENDER_PIPELINE] Render frame completed - should see test rectangle and text`);
  }
  
  // 🔧 SIMPLIFIED TRIGGER: Remove complex dependencies that block rendering
  $: if (ctx && state && config) {
    // 🔧 SIMPLIFIED TRIGGER: Remove isReady and yScale from critical path
    // They should be true but don't block rendering if data is available
    if (state.visualLow && state.visualHigh) {
      // Calculate yScale on-demand if not available
      const currentYScale = yScale || (
        scaledConfig?.meterHeight 
          ? scaleLinear().domain([state.visualLow, state.visualHigh]).range([scaledConfig.meterHeight, 0])
          : null
      );
      
      if (currentYScale) {
        if (renderFrame) {
          cancelAnimationFrame(renderFrame);
        }
        
        // Override yScale for this render call
        const originalYScale = yScale;
        yScale = currentYScale;
        render();
        yScale = originalYScale;
      }
    }
  }
  
  // 🔧 FIXED: Show resize handles on hover AND during active interaction using store state only
  $: showResizeHandles = $floatingStore.resizeState.isResizing || 
                         $floatingStore.resizeState.displayId === id ||
                         $floatingStore.draggedItem?.id === id ||
                         // 🔧 CRITICAL FIX: Show handles when this display is active
                         $floatingStore.activeDisplayId === id;
  
  // Resize handle visibility calculated
  
  onDestroy(() => {
    // ✅ CENTRALIZED: Use InteractionManager for cleanup instead of direct listeners
    interactionManager.cleanup();
    
    // 🔧 PERFORMANCE OPTIMIZATION: Clean up render frame and timers
    if (renderFrame) {
      cancelAnimationFrame(renderFrame);
    }
    if (renderDebounceTimer) {
      clearTimeout(renderDebounceTimer);
    }
    if (resizeDebounceTimer) {
      clearTimeout(resizeDebounceTimer);
    }
  });
</script>

<div 
  bind:this={element}
  class="enhanced-floating"
  class:hovered={showResizeHandles}
  class:active={isActive}
  style="left: {displayPosition.x}px; top: {displayPosition.y}px; width: {actualDisplaySize.width}px; height: {actualDisplaySize.height}px; z-index: {currentZIndex};"
  on:contextmenu={handleContextMenu}
  on:mousedown={handleMouseDown}
  on:mouseenter={() => {
    // Set this display as active when hovered (store-based hover)
    actions.setActiveDisplay(id);
  }}
  on:mouseleave={() => {
    // Clear active display when not hovering (store-based hover)
    if ($floatingStore.activeDisplayId === id) {
      actions.setActiveDisplay(null);
    }
  }}
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
  
  <!-- ✅ FIXED: Use simplified ResizeHandle components with InteractionManager -->
  {#if showResizeHandles}
    <ResizeHandle handleType="nw" isVisible={true} displayId={id} />
    <ResizeHandle handleType="ne" isVisible={true} displayId={id} />
    <ResizeHandle handleType="se" isVisible={true} displayId={id} />
    <ResizeHandle handleType="sw" isVisible={true} displayId={id} />
    
    <ResizeHandle handleType="n" isVisible={true} displayId={id} />
    <ResizeHandle handleType="s" isVisible={true} displayId={id} />
    <ResizeHandle handleType="e" isVisible={true} displayId={id} />
    <ResizeHandle handleType="w" isVisible={true} displayId={id} />
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
    /* 🔧 CRITICAL FIX: Remove object-fit to prevent CSS/JS dimension conflicts */
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
  
  /* ✅ ENHANCED: Improved resize handle CSS for better visual feedback */
  .resize-handle {
    position: absolute;
    background: #4f46e5;
    border: 1px solid #6366f1;
    border-radius: 2px;
    opacity: 0;
    transition: opacity 0.2s ease, background-color 0.2s ease;
    z-index: 1000; /* ✅ Ensure handles are on top */
  }
  
  .enhanced-floating:hovered .resize-handle,
  .resize-handle:hover {
    opacity: 1;
  }
  
  .resize-handle:hover {
    background: #6366f1;
    transform: scale(1.2); /* ✅ Enhanced hover feedback */
  }
  
  /* ✅ FIXED: Keep handles within container bounds for better UX */
  .resize-handle.nw {
    top: 0px;
    left: 0px;
    width: 10px;
    height: 10px;
    cursor: nw-resize;
  }
  
  .resize-handle.ne {
    top: 0px;
    right: 0px;
    width: 10px;
    height: 10px;
    cursor: ne-resize;
  }
  
  .resize-handle.se {
    bottom: 0px;
    right: 0px;
    width: 10px;
    height: 10px;
    cursor: se-resize;
  }
  
  .resize-handle.sw {
    bottom: 0px;
    left: 0px;
    width: 10px;
    height: 10px;
    cursor: sw-resize;
  }
  
  .resize-handle.n {
    top: 0px;
    left: 50%;
    transform: translateX(-50%);
    width: 10px;
    height: 10px;
    cursor: n-resize;
  }
  
  .resize-handle.n:hover {
    transform: translateX(-50%) scale(1.2);
  }
  
  .resize-handle.s {
    bottom: 0px;
    left: 50%;
    transform: translateX(-50%);
    width: 10px;
    height: 10px;
    cursor: s-resize;
  }
  
  .resize-handle.s:hover {
    transform: translateX(-50%) scale(1.2);
  }
  
  .resize-handle.e {
    top: 50%;
    right: 0px;
    transform: translateY(-50%);
    width: 10px;
    height: 10px;
    cursor: e-resize;
  }
  
  .resize-handle.e:hover {
    transform: translateY(-50%) scale(1.2);
  }
  
  .resize-handle.w {
    top: 50%;
    left: 0px;
    transform: translateY(-50%);
    width: 10px;
    height: 10px;
    cursor: w-resize;
  }
  
  .resize-handle.w:hover {
    transform: translateY(-50%) scale(1.2);
  }
</style>
