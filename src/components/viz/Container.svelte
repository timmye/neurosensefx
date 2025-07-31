<script>
  import { onMount } from 'svelte';
  import { scaleLinear } from 'd3-scale';
  import { drawDayRangeMeter } from '../../lib/viz/dayRangeMeter.js';
  import { drawPriceFloat } from '../../lib/viz/priceFloat.js';
  import { drawPriceDisplay } from '../../lib/viz/priceDisplay.js';
  import { drawVolatilityOrb } from '../../lib/viz/volatilityOrb.js';
  import { drawMarketProfile } from '../../lib/viz/marketProfile.js';

  export let config;
  export let state;

  let canvas;
  let ctx;
  let dpr = 1;

  // State for flash animation
  let flashOpacity = 0;
  let flashDuration = 300; // ms
  let flashStartTime = 0;

  onMount(() => {
    ctx = canvas.getContext('2d');
    dpr = window.devicePixelRatio || 1;
  });

  $: if (canvas && config) {
    const { visualizationsContentWidth, meterHeight } = config;
    canvas.style.width = `${visualizationsContentWidth}px`;
    canvas.style.height = `${meterHeight}px`;
    canvas.width = Math.floor(visualizationsContentWidth * dpr);
    canvas.height = Math.floor(meterHeight * dpr);
    ctx?.scale(dpr, dpr);
  }

  // Watch for state or config changes to trigger a redraw
  $: if (ctx && state && config) {
    // If a significant tick occurs and flash is enabled, start the flash animation state
    if (state.isSignificantTick && config.showFlash) {
        flashOpacity = config.flashIntensity;
        flashStartTime = performance.now();
    }
    // Always draw when state or config changes
    draw(state, config);
  }

  function draw(currentState, currentConfig) {
    if (!ctx || !currentState || !currentConfig) return;

    const { visualizationsContentWidth, meterHeight } = currentConfig;
    const y = scaleLinear().domain([currentState.visualLow, currentState.visualHigh]).range([meterHeight, 0]);
    
    ctx.clearRect(0, 0, visualizationsContentWidth, meterHeight);
    ctx.fillStyle = '#111827'; // Ensure background is always drawn
    ctx.fillRect(0, 0, visualizationsContentWidth, meterHeight);

    // --- Draw Core Visualizations ---
    drawMarketProfile(ctx, currentConfig, currentState, y);
    drawDayRangeMeter(ctx, currentConfig, currentState, y);
    drawVolatilityOrb(ctx, currentConfig, currentState, visualizationsContentWidth, meterHeight);
    drawPriceFloat(ctx, currentConfig, currentState, y);
    drawPriceDisplay(ctx, currentConfig, currentState, y, visualizationsContentWidth);

    // --- Draw Flash Overlay ---
    if (flashOpacity > 0) {
      const elapsedTime = performance.now() - flashStartTime;
      // Calculate opacity with a fade-out effect based on elapsed time
      const newOpacity = currentConfig.flashIntensity * (1 - (elapsedTime / flashDuration));
      
      flashOpacity = Math.max(0, newOpacity); // Ensure opacity doesn't go below 0
      
      if (flashOpacity > 0) {
        ctx.fillStyle = `rgba(200, 200, 220, ${flashOpacity})`; // A neutral, bright flash color
        ctx.fillRect(0, 0, visualizationsContentWidth, meterHeight);
      }
    }
  }
</script>

<div class="viz-container">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .viz-container {
    position: relative;
    width: 100%;
    height: 100%;
    line-height: 0;
  }
  canvas {
    display: block;
    background-color: #111827;
  }
</style>
