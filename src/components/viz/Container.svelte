
<script>
  import { onMount } from 'svelte';
  import { scaleLinear } from 'd3-scale';
  import { drawDayRangeMeter } from '../../lib/viz/dayRangeMeter.js';
  import { drawPriceFloat } from '../../lib/viz/priceFloat.js';
  import { drawPriceDisplay } from '../../lib/viz/priceDisplay.js';
  import { drawVolatilityOrb } from '../../lib/viz/volatilityOrb.js';
  import { drawMarketProfile } from '../../lib/viz/marketProfile.js';
  import { drawVolatilityMetric } from '../../lib/viz/volatilityMetric.js';
  import { drawHoverIndicator } from '../../lib/viz/hoverIndicator.js';
  import { drawPriceMarkers } from '../../lib/viz/priceMarkers.js'; // Import drawPriceMarkers
  import { markerStore } from '../../stores/markerStore.js'; // Import markerStore
  import { writable } from 'svelte/store';
  
  // 🔧 UNIFIED SIZING: Import canvas sizing utilities
  import { createCanvasSizingConfig, configureCanvasContext, CANVAS_CONSTANTS } from '../../utils/canvasSizing.js';

  // Local hover state (replaces uiState.hoverState)
  const hoverState = writable(null);
  export let config;
  export let state;

  let canvas;
  let ctx;
  let dpr = 1;
  let y; // Declare y scale at the top level to be accessible everywhere

  let markers = []; // Local variable to hold the markers from the store
  // State for flash animation
  let flashOpacity = 0;
  let flashDuration = 300; // ms
  let flashStartTime = 0;
  
  // 🔧 UNIFIED SIZING: Canvas sizing configuration
  let canvasSizingConfig = null;
  let normalizedConfig = {};

  onMount(() => {
    ctx = canvas.getContext('2d');
    dpr = window.devicePixelRatio || 1;
  });

  // 🔧 UNIFIED SIZING: Use createCanvasSizingConfig for consistent canvas sizing
  $: if (canvas && config) {
    // Create container size from config (treat config values as container dimensions)
    const containerSize = {
      width: config.visualizationsContentWidth || CANVAS_CONSTANTS.DEFAULT_CONTAINER.width,
      height: (config.meterHeight || CANVAS_CONSTANTS.DEFAULT_CONTAINER.height) + 40 // Add header height
    };
    
    // Create unified canvas sizing configuration
    canvasSizingConfig = createCanvasSizingConfig(containerSize, config, {
      includeHeader: true,
      padding: 10,
      headerHeight: 40,
      respectDpr: true
    });
    
    // Configure canvas with unified sizing
    configureCanvasContext(ctx, canvasSizingConfig.dimensions);
    
    // Set canvas dimensions
    const { canvas: canvasDims } = canvasSizingConfig.dimensions;
    canvas.width = canvasDims.width;
    canvas.height = canvasDims.height;
    
    // Update normalized config for rendering
    normalizedConfig = canvasSizingConfig.config;
    
    // Canvas sizing applied
  }

  // This reactive block triggers a redraw whenever the core data, config, hover state, or marker store changes
  $: if (ctx && state && config && $hoverState !== undefined && $markerStore !== undefined) {
    // We access $hoverState here to make this block reactive to its changes
    // We access $markerStore here to make this block reactive to its changes
    markers = $markerStore; // Update local markers variable

    // Trigger draw when state, config, hoverState, or markerStore changes
    // The check for ctx, state, config ensures everything is ready
    draw(state, config, markers); // Pass the markers array to the draw function
  }

  function handleMouseMove(event) {
    if (!y) return; // Guard clause: Don't run if y scale hasn't been initialized yet

    const rect = canvas.getBoundingClientRect();
    // 1. Calculate mouse Y relative to the element's CSS position
    const cssY = event.clientY - rect.top;
    // 2. Convert CSS pixel coordinate back to a price value using the y scale
    const calculatedPrice = y.invert(cssY);

    hoverState.set({ y: cssY, price: calculatedPrice }); // Store cssY for drawing, as drawing functions operate in CSS space
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

  function draw(currentState, currentConfig) {
    if (!ctx || !currentState || !currentConfig) return;

    // 🔧 UNIFIED SIZING: Use normalized config for consistent rendering
    const { visualizationsContentWidth, meterHeight } = normalizedConfig;
    
    // Initialize/update the y-scale for the current render frame
    y = scaleLinear().domain([currentState.visualLow, currentState.visualHigh]).range([meterHeight, 0]);
    
    // Use canvas sizing config dimensions for clearing
    if (canvasSizingConfig) {
      const { canvasArea } = canvasSizingConfig.dimensions;
      ctx.clearRect(0, 0, canvasArea.width, canvasArea.height);
      ctx.fillStyle = '#111827'; // Ensure background is always drawn
      ctx.fillRect(0, 0, canvasArea.width, canvasArea.height);
    } else {
      // Fallback to current approach if sizing config not available
      ctx.clearRect(0, 0, visualizationsContentWidth, meterHeight);
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, visualizationsContentWidth, meterHeight);
    }

    // --- Draw Core Visualizations ---
    // 🔧 UNIFIED SIZING: Use normalized config for consistent rendering
    drawMarketProfile(ctx, normalizedConfig, currentState, y);
    drawDayRangeMeter(ctx, normalizedConfig, currentState, y);
    drawVolatilityOrb(ctx, normalizedConfig, currentState, visualizationsContentWidth, meterHeight);
    drawPriceFloat(ctx, normalizedConfig, currentState, y);
    drawPriceDisplay(ctx, normalizedConfig, currentState, y, visualizationsContentWidth);
    drawVolatilityMetric(ctx, normalizedConfig, currentState, visualizationsContentWidth, meterHeight);

    // --- Draw Price Markers (on top of core visuals, below hover/flash) ---
    drawPriceMarkers(ctx, normalizedConfig, currentState, y, markers);
    // --- Draw Hover Indicator (must be last to be on top) ---
    drawHoverIndicator(ctx, normalizedConfig, currentState, y, $hoverState);

    // --- Draw Flash Overlay ---
    if (flashOpacity > 0) {
      const elapsedTime = performance.now() - flashStartTime;
      const newOpacity = currentConfig.flashIntensity * (1 - (elapsedTime / flashDuration));
      
      flashOpacity = Math.max(0, newOpacity);
      
      if (flashOpacity > 0) {
        ctx.fillStyle = `rgba(200, 200, 220, ${flashOpacity})`;
        if (canvasSizingConfig) {
          const { canvasArea } = canvasSizingConfig.dimensions;
          ctx.fillRect(0, 0, canvasArea.width, canvasArea.height);
        } else {
          ctx.fillRect(0, 0, visualizationsContentWidth, meterHeight);
        }
      }
    }
  }
</script>

<div class="viz-container" style="width: {config.visualizationsContentWidth}px;">
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
