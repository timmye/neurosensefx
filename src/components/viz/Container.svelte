<script>
  import { onMount } from 'svelte';
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

  onMount(() => {
    ctx = canvas.getContext('2d');
    dpr = window.devicePixelRatio || 1;
    
    // 🔧 ZOOM AWARENESS: Initialize zoom detector
    const cleanupZoomDetector = createZoomDetector((newDpr) => {
      console.log(`[CONTAINER_ZOOM_AWARENESS] DPR changed to ${newDpr}`);
      dpr = newDpr;
      
      // Recalculate canvas sizing with new DPR
      if (config) {
        const containerSize = config.containerSize || { width: 240, height: 160 };
        canvasSizingConfig = createCanvasSizingConfig(containerSize, config, {
          includeHeader: true,
          padding: config.padding,
          headerHeight: config.headerHeight,
          respectDpr: true
        });
        
        // Update canvas with new dimensions
        configureCanvasContext(ctx, canvasSizingConfig.dimensions);
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
    const containerSize = config.containerSize || { width: 240, height: 160 };
    
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
    
    // Configure canvas with unified sizing
    configureCanvasContext(ctx, canvasSizingConfig.dimensions);
    
    // Set canvas dimensions
    const { canvas: canvasDims } = canvasSizingConfig.dimensions;
    canvas.width = canvasDims.width;
    canvas.height = canvasDims.height;
    
    console.log('[CONTAINER] Clean foundation renderingContext:', renderingContext);
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
  }

  function handleClick(event) {
    if (!y) return; // Guard against accessing y before it's initialized

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

    try {
      drawDayRangeMeter(ctx, currentRenderingContext, config, currentState, y);
    } catch (error) {
      console.error('[Container] Day Range Meter render error:', error);
    }

    
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

    try {
      drawVolatilityMetric(ctx, currentRenderingContext, config, currentState);
    } catch (error) {
      console.error('[Container] Volatility Metric render error:', error);
    }

    // --- Draw Price Markers (on top of core visuals, below hover/flash) ---
    drawPriceMarkers(ctx, currentRenderingContext, config, currentState, y, currentMarkers);
    
    // --- Draw Hover Indicator (must be last to be on top) ---
    drawHoverIndicator(ctx, currentRenderingContext, config, currentState, yScale, $hoverState);

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
  }
</script>

<div class="viz-container" style="width: {config.containerSize.width}px;">
  <canvas bind:this={canvas} on:mousemove={handleMouseMove} on:mouseleave={handleMouseLeave} on:click={handleClick}></canvas>
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
</style>
