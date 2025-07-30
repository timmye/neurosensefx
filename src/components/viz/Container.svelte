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

  $: if (ctx && state && config) {
    console.log('--- Point of Failure 5: Data Fed to Visualization Container ---');
    console.log('State:', JSON.parse(JSON.stringify(state)));
    console.log('Config:', JSON.parse(JSON.stringify(config)));
    console.log('--- End of Point of Failure 5 ---');
    draw(state, config);
  }

  function draw(currentState, currentConfig) {
    const { visualizationsContentWidth, meterHeight } = currentConfig;
    
    const y = scaleLinear().domain([currentState.visualLow, currentState.visualHigh]).range([meterHeight, 0]);
    
    ctx.clearRect(0, 0, visualizationsContentWidth, meterHeight);
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, visualizationsContentWidth, meterHeight);

    drawMarketProfile(ctx, currentConfig, currentState, y, currentState.marketProfile);
    drawDayRangeMeter(ctx, currentConfig, currentState, y); 
    drawVolatilityOrb(ctx, currentConfig, currentState, visualizationsContentWidth, meterHeight);
    drawPriceFloat(ctx, currentConfig, currentState, y);
    drawPriceDisplay(ctx, currentConfig, currentState, y, visualizationsContentWidth);
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
