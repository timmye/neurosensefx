<script>
  import { onMount, onDestroy, afterUpdate } from 'svelte';
  import { scaleLinear } from 'd3-scale';

  // Import drawing functions from our new canvas-centric library
  import { drawDayRangeMeter } from '../../lib/viz/dayRangeMeter.js';
  import { drawPriceFloat } from '../../lib/viz/priceFloat.js';
  import { drawPriceDisplay } from '../../lib/viz/priceDisplay.js';
  import { drawVolatilityOrb } from '../../lib/viz/volatilityOrb.js';
  import { drawMarketProfile } from '../../lib/viz/marketProfile.js';

  export let config;
  export let state;
  export let marketProfile;

  let canvas;
  let ctx;
  let animationFrameId;

  let width = 220;
  let height = 120;
  
  // This function sets up the canvas, considering high-DPI screens
  function setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    
    ctx.scale(dpr, dpr);
  }

  // The main render loop
  function render() {
    if (!ctx || !config || !state || !marketProfile) {
      animationFrameId = requestAnimationFrame(render);
      return;
    }

    // Establish the primary Y-axis scale for this frame
    const y = scaleLinear().domain([state.adrLow, state.adrHigh]).range([height, 0]);

    // Clear the canvas for the new frame
    ctx.clearRect(0, 0, width, height);
    
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, width, height);
    
    // Call each drawing function in order. Order matters for layering.
    drawDayRangeMeter(ctx, config, state, y);
    drawMarketProfile(ctx, config, state, y, marketProfile);
    drawVolatilityOrb(ctx, config, state, width, height);
    drawPriceFloat(ctx, config, state, y);
    drawPriceDisplay(ctx, config, state, y, width);

    animationFrameId = requestAnimationFrame(render);
  }

  onMount(() => {
    ctx = canvas.getContext('2d');
    setupCanvas();
    render();
  });
  
  afterUpdate(() => {
      if(config && (width !== config.visualizationsContentWidth || height !== config.meterHeight)) {
          width = config.visualizationsContentWidth;
          height = config.meterHeight;
          setupCanvas();
      }
  })

  onDestroy(() => {
    cancelAnimationFrame(animationFrameId);
  });

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
