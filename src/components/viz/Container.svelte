<script>
  import { onMount, onDestroy } from 'svelte';
  import { scaleLinear } from 'd3-scale';
  import { drawDayRangeMeter } from '../../lib/viz/dayRangeMeter.js';
  import { drawPriceFloat } from '../../lib/viz/priceFloat.js';
  import { drawPriceDisplay } from '../../lib/viz/priceDisplay.js';
  import { drawMarketProfile } from '../../lib/viz/marketProfile.js';
  import { drawVolatilityOrb } from '../../lib/viz/volatilityOrb.js';
  import { drawVolatilityMetric } from '../../lib/viz/volatilityMetric.js';
  import { drawHoverIndicator } from '../../lib/viz/hoverIndicator.js';
  import { drawPriceMarkers } from '../../lib/viz/priceMarkers.js'; // Import drawPriceMarkers
  import { markerStore } from '../../stores/markerStore.js'; // Import markerStore
  import { writable } from 'svelte/store';
  import { Environment, EnvironmentConfig } from '../../lib/utils/environmentUtils.js';

  // Debug: Verify imports are working
  console.log('[Container] Imports loaded:', {
    drawVolatilityOrb: typeof drawVolatilityOrb,
    drawDayRangeMeter: typeof drawDayRangeMeter,
    drawMarketProfile: typeof drawMarketProfile
  });

  // 🔧 UNIFIED SIZING: Import canvas sizing utilities
  import { createCanvasSizingConfig, configureCanvasContext, CANVAS_CONSTANTS, boundsUtils, createZoomDetector } from '../../utils/canvasSizing.js';

  // Local hover state (replaces uiState.hoverState)
  const hoverState = writable(null);
  export let config;
  export let state;

  let canvas;
  let ctx;
  let dpr = 1;
  let y; // Declare y scale at top level to be accessible everywhere

  let markers = []; // Local variable to hold markers from store
  // State for flash animation
  let flashOpacity = 0;
  let flashDuration = 300; // ms
  let flashStartTime = 0;
  
  // 🔧 CLEAN FOUNDATION: Rendering context for clean parameter pipeline
  let renderingContext = null;
  let canvasSizingConfig = null;

  // 🌍 ENVIRONMENT INDICATOR: Environment detection and display state
  let showEnvironmentIndicator = false;
  let environmentDetails = null;
  let indicatorTooltip = '';

  onMount(() => {
    ctx = canvas.getContext('2d');
    dpr = window.devicePixelRatio || 1;
    
    // 🔧 ZOOM AWARENESS: Initialize zoom detector
    const cleanupZoomDetector = createZoomDetector((newDpr) => {
      console.log(`[CONTAINER_ZOOM_AWARENESS] DPR changed to ${newDpr}`);
      dpr = newDpr;

      // Recalculate canvas sizing with new DPR
      if (config) {
        const containerSize = config.containerSize || { width: 220, height: 120 }; // ✅ HEADERLESS: Correct default
        canvasSizingConfig = createCanvasSizingConfig(containerSize, config, {
          includeHeader: true,
          padding: config.padding,
          headerHeight: config.headerHeight,
          respectDpr: true
        });

        // Update canvas with new dimensions (no configureCanvasContext call - scaling done in draw)
        const { canvas: canvasDims } = canvasSizingConfig.dimensions;
        canvas.width = canvasDims.width;
        canvas.height = canvasDims.height;

        console.log(`[CONTAINER_ZOOM_AWARENESS] Canvas updated for new DPR:`, {
          newDpr,
          canvasDimensions: `${canvasDims.width}x${canvasDims.height}`
        });
      }
    });
    
    // Store cleanup function for onDestroy
    onDestroy(() => {
      if (cleanupZoomDetector) {
        cleanupZoomDetector();
      }
    });
  });

  // 🔧 CLEAN FOUNDATION: Container → Content → Rendering pipeline
  $: if (canvas && config) {
    // 1. Container layer - physical dimensions
    const containerSize = config.containerSize || { width: 220, height: 120 }; // ✅ HEADERLESS: Correct default
    
    // 2. Content area - derived from container
    const contentArea = {
      width: containerSize.width - (config.padding * 2),
      height: containerSize.height - config.headerHeight - config.padding
    };
    
    // 3. ADR axis - positioned relative to content
    const adrAxisX = contentArea.width * config.adrAxisPosition;
    
    // 4. Create rendering context for visualizations
    renderingContext = {
      containerSize,
      contentArea,
      adrAxisX,
      // Derived values for backward compatibility
      visualizationsContentWidth: contentArea.width,
      meterHeight: contentArea.height,
      adrAxisXPosition: adrAxisX
    };
    
    // Create unified canvas sizing configuration
    canvasSizingConfig = createCanvasSizingConfig(containerSize, config, {
      includeHeader: true,
      padding: config.padding,
      headerHeight: config.headerHeight,
      respectDpr: true
    });
    
    // Set canvas dimensions first
    const { canvas: canvasDims } = canvasSizingConfig.dimensions;
    canvas.width = canvasDims.width;
    canvas.height = canvasDims.height;
    
    console.log('[CONTAINER] Clean foundation renderingContext:', renderingContext);
  }

  // 🌍 ENVIRONMENT INDICATOR: Reactive environment detection and tooltip generation
  $: {
    const config = EnvironmentConfig.current;
    showEnvironmentIndicator = config.showEnvironmentIndicator;

    if (showEnvironmentIndicator) {
      environmentDetails = {
        mode: Environment.current,
        isDevelopment: Environment.isDevelopment,
        isProduction: Environment.isProduction,
        config: config
      };

      // Generate descriptive tooltip
      if (Environment.isDevelopment) {
        indicatorTooltip = 'Development Mode - Hot reload enabled, debug logging active';
      } else {
        indicatorTooltip = 'Production Mode - Optimized for performance';
      }
    }
  }

  // This reactive block triggers a redraw whenever core data, config, hover state, or marker store changes
  $: if (ctx && state && config && $hoverState !== undefined && $markerStore !== undefined) {
    // We access $hoverState here to make this block reactive to its changes
    // We access $markerStore here to make this block reactive to its changes
    markers = $markerStore; // Update local markers variable

    // Trigger draw when state, config, hoverState, or markerStore changes
    // The check for ctx, state, config ensures everything is ready
    draw(state, renderingContext, markers); // Pass rendering context and markers array to draw function
  }

  // Frame-throttled mouse move handler for optimal 60fps performance
  let lastHoverFrame = 0;
  let pendingHoverUpdate = null;

  // Drag detection state to prevent marker creation during drag operations
  let isDragging = false;
  let dragStartPos = null;
  let dragThreshold = 5; // pixels - minimum movement to be considered a drag

  function handleMouseMove(event) {
    if (!y) return; // Guard clause: Don't run if y scale hasn't been initialized yet

    const now = performance.now();

    // Throttle to 60fps (16.67ms intervals)
    if (now - lastHoverFrame < 16.67) {
      // Store the latest mouse position but don't process yet
      pendingHoverUpdate = event;
      return;
    }

    lastHoverFrame = now;

    // Check if this movement qualifies as a drag
    if (dragStartPos) {
      const rect = canvas.getBoundingClientRect();
      const currentX = event.clientX - rect.left;
      const currentY = event.clientY - rect.top;
      const distance = Math.sqrt(
        Math.pow(currentX - dragStartPos.x, 2) +
        Math.pow(currentY - dragStartPos.y, 2)
      );

      if (distance > dragThreshold) {
        isDragging = true;
      }
    }

    const rect = canvas.getBoundingClientRect();
    // 1. Calculate mouse Y relative to element's CSS position
    const cssY = event.clientY - rect.top;
    // 2. Convert CSS pixel coordinate back to a price value using the y scale
    const calculatedPrice = y.invert(cssY);

    hoverState.set({ y: cssY, price: calculatedPrice }); // Store cssY for drawing, as drawing functions operate in CSS space

    // Process any pending hover update after the frame
    requestAnimationFrame(() => {
      if (pendingHoverUpdate && pendingHoverUpdate !== event) {
        handleMouseMove(pendingHoverUpdate);
      }
      pendingHoverUpdate = null;
    });
  }

  function handleMouseLeave() {
    hoverState.set(null);
    // Reset drag state when mouse leaves canvas
    isDragging = false;
    dragStartPos = null;
  }

  function handleMouseDown(event) {
    if (!y) return; // Guard against accessing y before it's initialized

    const rect = canvas.getBoundingClientRect();
    dragStartPos = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    isDragging = false;
  }

  function handleClick(event) {
    if (!y) return; // Guard against accessing y before it's initialized

    // Prevent marker creation if this was a drag operation
    if (isDragging) {
      // Reset drag state for next interaction
      isDragging = false;
      dragStartPos = null;
      return;
    }

    // Reset drag state for clean click handling
    dragStartPos = null;
    isDragging = false;

    // Require modifier key (Ctrl/Cmd) for marker placement to avoid conflicts with display dragging
    const hasModifier = event.ctrlKey || event.metaKey;

    if (!hasModifier) {
      // Don't create markers for regular clicks - these are for display dragging
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const cssY = event.clientY - rect.top;

    // Hit detection threshold in CSS pixels
    const hitThreshold = 5;

    // Check if clicking on an existing marker
    const clickedMarker = $markerStore.find(marker => {
      const markerY = y(marker.price); // Convert marker price to Y coordinate
      return Math.abs(cssY - markerY) < hitThreshold;
    });

    if (clickedMarker) {
      markerStore.remove(clickedMarker.id);
    } else {
      // If not clicking on a marker, add a new one
      const clickedPrice = y.invert(cssY);
      markerStore.add(clickedPrice);
    }
  }

  function draw(currentState, currentRenderingContext, currentMarkers) {
    if (!ctx || !currentState || !currentRenderingContext) return;

    // 🔧 CLEAN FOUNDATION: Save context and apply DPR scaling each render frame
    ctx.save();

    // Apply DPR scaling for this render cycle only
    if (canvasSizingConfig && canvasSizingConfig.dimensions.dpr > 1) {
      ctx.scale(canvasSizingConfig.dimensions.dpr, canvasSizingConfig.dimensions.dpr);
    }

    // 🔧 CLEAN FOUNDATION: Use rendering context for all operations
    const { contentArea, adrAxisX } = currentRenderingContext;

    // Initialize/update y-scale for the current render frame
    y = scaleLinear().domain([currentState.visualLow, currentState.visualHigh]).range([contentArea.height, 0]);

    // Use canvas sizing config dimensions for clearing
    if (canvasSizingConfig) {
      const { canvasArea } = canvasSizingConfig.dimensions;
      ctx.clearRect(0, 0, canvasArea.width, canvasArea.height);
      ctx.fillStyle = '#111827'; // Ensure background is always drawn
      ctx.fillRect(0, 0, canvasArea.width, canvasArea.height);
    } else {
      // Fallback to rendering context
      ctx.clearRect(0, 0, contentArea.width, contentArea.height);
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, contentArea.width, contentArea.height);
    }

    // --- Draw Core Visualizations ---
    // 🔧 CLEAN FOUNDATION: Pass rendering context to all visualization functions

    // --- Draw Volatility Orb (Background Layer - MUST be first) ---
    console.log('[Container] About to call drawVolatilityOrb:', {
      drawVolatilityOrbExists: typeof drawVolatilityOrb,
      hasCtx: !!ctx,
      hasRenderingContext: !!currentRenderingContext,
      hasConfig: !!config,
      hasState: !!currentState,
      showVolatilityOrb: config?.showVolatilityOrb,
      stateHasVolatility: 'volatility' in (currentState || {}),
      stateVolatility: currentState?.volatility
    });

    try {
      drawVolatilityOrb(ctx, currentRenderingContext, config, currentState, y);
      console.log('[Container] drawVolatilityOrb completed successfully');
    } catch (error) {
      console.error('[Container] Volatility Orb render error:', error);
    }

    drawMarketProfile(ctx, currentRenderingContext, config, currentState, y);

    // --- Draw Volatility Metric (just in front of background) ---
    try {
      drawVolatilityMetric(ctx, currentRenderingContext, config, currentState);
    } catch (error) {
      console.error('[Container] Volatility Metric render error:', error);
    }

    try {
      drawDayRangeMeter(ctx, currentRenderingContext, config, currentState, y);
    } catch (error) {
      console.error('[Container] Day Range Meter render error:', error);
    }


    // --- Draw Price Markers (behind Price Float and Price Display) ---
    drawPriceMarkers(ctx, currentRenderingContext, config, currentState, y, currentMarkers);

    try {
      drawPriceFloat(ctx, currentRenderingContext, config, currentState, y);
    } catch (error) {
      console.error('[Container] Price Float render error:', error);
    }

    try {
      drawPriceDisplay(ctx, currentRenderingContext, config, currentState, y);
    } catch (error) {
      console.error('[Container] Price Display render error:', error);
    }
    
    // --- Draw Hover Indicator (must be last to be on top) ---
    drawHoverIndicator(ctx, currentRenderingContext, config, currentState, y, $hoverState);

    // --- Draw Flash Overlay ---
    if (flashOpacity > 0) {
      const elapsedTime = performance.now() - flashStartTime;
      const newOpacity = config.flashIntensity * (1 - (elapsedTime / flashDuration));

      flashOpacity = Math.max(0, newOpacity);

      if (flashOpacity > 0) {
        ctx.fillStyle = `rgba(200, 200, 220, ${flashOpacity})`;
        if (canvasSizingConfig) {
          const { canvasArea } = canvasSizingConfig.dimensions;
          ctx.fillRect(0, 0, canvasArea.width, canvasArea.height);
        } else {
          ctx.fillRect(0, 0, contentArea.width, contentArea.height);
        }
      }
    }

    // 🔧 CLEAN FOUNDATION: Restore context to prevent cumulative transformations
    ctx.restore();
  }
</script>

<div class="viz-container" style="width: {config.containerSize.width}px;">
  <canvas bind:this={canvas} on:mousemove={handleMouseMove} on:mouseleave={handleMouseLeave} on:mousedown={handleMouseDown} on:click={handleClick}></canvas>

  {#if showEnvironmentIndicator && environmentDetails}
    <div
      class="environment-indicator {environmentDetails.mode}"
      class:development={environmentDetails.isDevelopment}
      class:production={environmentDetails.isProduction}
      title={indicatorTooltip}
      aria-label={indicatorTooltip}
      role="status"
      aria-live="polite"
    >
      <span class="indicator-dot"></span>
      <span class="indicator-text">
        {environmentDetails.isDevelopment ? 'DEV' : 'PROD'}
      </span>
    </div>
  {/if}
</div>

<style>
  .viz-container {
    position: relative;
    height: 100%;
    line-height: 0;
  }
  canvas {
    display: block;
    background-color: #111827;
    width: 100%;
  }

  /* 🌍 Environment Indicator Styles */
  .environment-indicator {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    pointer-events: auto;
    z-index: 10;
    transition: all 0.2s ease;
    opacity: 0.7;
    backdrop-filter: blur(4px);
  }

  .environment-indicator:hover {
    opacity: 1;
    transform: scale(1.05);
  }

  .indicator-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    animation: pulse 2s infinite;
  }

  .indicator-text {
    color: #ffffff;
    font-family: 'JetBrains Mono', 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
    white-space: nowrap;
  }

  /* Development mode styling - warning orange to indicate non-production */
  .environment-indicator.development {
    background: rgba(251, 146, 60, 0.15);
    border: 1px solid rgba(251, 146, 60, 0.3);
    color: #fb923c;
  }

  .environment-indicator.development .indicator-dot {
    background-color: #fb923c;
    box-shadow: 0 0 4px rgba(251, 146, 60, 0.5);
  }

  .environment-indicator.development:hover {
    background: rgba(251, 146, 60, 0.25);
    border-color: rgba(251, 146, 60, 0.5);
  }

  /* Production mode styling - calm green/blue to indicate stable environment */
  .environment-indicator.production {
    background: rgba(34, 197, 94, 0.15);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #22c55e;
  }

  .environment-indicator.production .indicator-dot {
    background-color: #22c55e;
    box-shadow: 0 0 4px rgba(34, 197, 94, 0.5);
  }

  .environment-indicator.production:hover {
    background: rgba(34, 197, 94, 0.25);
    border-color: rgba(34, 197, 94, 0.5);
  }

  /* Pulse animation for the indicator dot */
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.7;
      transform: scale(1.2);
    }
  }

  /* Responsive adjustments for smaller displays */
  @media (max-width: 300px) {
    .environment-indicator {
      top: 4px;
      right: 4px;
      padding: 3px 4px;
      font-size: 9px;
    }

    .indicator-dot {
      width: 5px;
      height: 5px;
    }
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .environment-indicator {
      opacity: 0.9;
      border-width: 2px;
    }

    .environment-indicator:hover {
      opacity: 1;
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .environment-indicator {
      transition: none;
    }

    .indicator-dot {
      animation: none;
    }
  }
</style>
