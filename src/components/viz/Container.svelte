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
    draw(state, config);
  }

  function draw(currentState, currentConfig) {
    const { visualizationsContentWidth, meterHeight } = currentConfig;

    // FIX: Convert all price-like values from state to decimals before using them.
    const conversionFactor = 100000.0;
    const visualLow = currentState.visualLow / conversionFactor;
    const visualHigh = currentState.visualHigh / conversionFactor;

    let minVisiblePrice = visualLow;
    let maxVisiblePrice = visualHigh;

    if (currentConfig.showMarketProfile && currentState.marketProfile && currentState.marketProfile.levels.length > 0) {
        const mpPrices = currentState.marketProfile.levels.map(l => (l.price / conversionFactor));
        minVisiblePrice = Math.min(minVisiblePrice, ...mpPrices);
        maxVisiblePrice = Math.max(maxVisiblePrice, ...mpPrices);
    }

    const priceRange = maxVisiblePrice - minVisiblePrice;
    const padding = priceRange * 0.1;

    const finalMinPrice = minVisiblePrice - padding;
    const finalMaxPrice = maxVisiblePrice + padding;
    
    // The Y-scale is now created with the correct decimal-based domain.
    const y = scaleLinear().domain([finalMinPrice, finalMaxPrice]).range([meterHeight, 0]);
    
    ctx.clearRect(0, 0, visualizationsContentWidth, meterHeight);
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, visualizationsContentWidth, meterHeight);

    // Pass the original state object to the children, they will handle their own conversions.
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
