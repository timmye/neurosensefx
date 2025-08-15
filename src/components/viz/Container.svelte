
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
  import { hoverState } from '../../stores/uiState.js';

  import { markerStore } from '../../stores/markerStore.js'; // Import markerStore
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

  onMount(() => {
    ctx = canvas.getContext('2d');
    dpr = window.devicePixelRatio || 1;
  });

  // This reactive block handles resizing the canvas when config changes
  $: if (canvas && config) {
    const { visualizationsContentWidth, meterHeight } = config;
    canvas.style.height = `${meterHeight}px`;
    // Remove the explicit setting of canvas width/height here,
    // rely on the reactive block below that depends on state/config
    // to set the dimensions consistently before drawing.
    canvas.width = Math.floor(visualizationsContentWidth * dpr);
    canvas.height = Math.floor(meterHeight * dpr);
    ctx?.scale(dpr, dpr);
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
    if (!y) return; // Guard clause: Don't run if the y scale hasn't been initialized yet

 console.log('handleMouseMove called');
    const rect = canvas.getBoundingClientRect();
    // 1. Calculate mouse Y relative to the element's CSS position
    const cssY = event.clientY - rect.top;
    // 2. Convert the CSS pixel coordinate back to a price value using the y scale
    const calculatedPrice = y.invert(cssY);

    hoverState.set({ y: cssY, price: calculatedPrice }); // Store cssY for drawing, as drawing functions operate in CSS space
  }
  function handleMouseLeave() {
    hoverState.set(null);
  }

  function handleClick(event) {
    console.log('handleClick called');
    if (!y) return; // Guard against accessing y before it's initialized

    const rect = canvas.getBoundingClientRect();
    const cssY = event.clientY - rect.top;

    // Hit detection threshold in CSS pixels
    const hitThreshold = 5; 

    // Check if clicking on an existing marker
    const clickedMarker = $markerStore.find(marker => {
      const markerY = y(marker.price); // Convert marker price to Y coordinate
      console.log('Hit detection: markerY =', markerY, ', cssY =', cssY, ', difference =', Math.abs(cssY - markerY));
      return Math.abs(cssY - markerY) < hitThreshold;
    });

    console.log('Clicked marker result:', clickedMarker);

    if (clickedMarker) {
      console.log('Removing marker:', clickedMarker.id);
      markerStore.remove(clickedMarker.id);
    } else {
      // If not clicking on a marker, add a new one
      const clickedPrice = y.invert(cssY);
      console.log('Adding marker:', clickedPrice);
      markerStore.add(clickedPrice);      
    }
  }

  function draw(currentState, currentConfig) {
    if (!ctx || !currentState || !currentConfig) return;

    const { visualizationsContentWidth, meterHeight } = currentConfig;
    
    // Initialize/update the y-scale for the current render frame
    y = scaleLinear().domain([currentState.visualLow, currentState.visualHigh]).range([meterHeight, 0]);
    
    ctx.clearRect(0, 0, visualizationsContentWidth, meterHeight);
    ctx.fillStyle = '#111827'; // Ensure background is always drawn
    ctx.fillRect(0, 0, visualizationsContentWidth, meterHeight);

    // --- Draw Core Visualizations ---
    drawMarketProfile(ctx, currentConfig, currentState, y);
    drawDayRangeMeter(ctx, currentConfig, currentState, y);
    drawVolatilityOrb(ctx, currentConfig, currentState, visualizationsContentWidth, meterHeight);
    drawPriceFloat(ctx, currentConfig, currentState, y);
    drawPriceDisplay(ctx, currentConfig, currentState, y, visualizationsContentWidth);
    drawVolatilityMetric(ctx, currentConfig, currentState, visualizationsContentWidth, meterHeight);

    // --- Draw Price Markers (on top of core visuals, below hover/flash) ---
    drawPriceMarkers(ctx, currentConfig, currentState, y, markers);
    // --- Draw Hover Indicator (must be last to be on top) ---
    drawHoverIndicator(ctx, currentConfig, currentState, y, $hoverState);

    // --- Draw Flash Overlay ---
    if (flashOpacity > 0) {
      const elapsedTime = performance.now() - flashStartTime;
      const newOpacity = currentConfig.flashIntensity * (1 - (elapsedTime / flashDuration));
      
      flashOpacity = Math.max(0, newOpacity);
      
      if (flashOpacity > 0) {
        ctx.fillStyle = `rgba(200, 200, 220, ${flashOpacity})`;
        ctx.fillRect(0, 0, visualizationsContentWidth, meterHeight);
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
