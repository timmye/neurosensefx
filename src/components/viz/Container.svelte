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
    console.log('[MP_DEBUG | Container] onMount lifecycle hook. Initial config:', config);
    ctx = canvas.getContext('2d');
    dpr = window.devicePixelRatio || 1;
     console.log('[MP_DEBUG | Container] Canvas context and DPR initialized.', { ctx, dpr });
  });

  $: if (canvas && config) {
    console.log('[MP_DEBUG | Container] Canvas or config changed. Resizing canvas.', config);
    const { visualizationsContentWidth, meterHeight } = config;
    canvas.style.width = `${visualizationsContentWidth}px`;
    canvas.style.height = `${meterHeight}px`;
    canvas.width = Math.floor(visualizationsContentWidth * dpr);
    canvas.height = Math.floor(meterHeight * dpr);
    ctx?.scale(dpr, dpr);
     console.log('[MP_DEBUG | Container] Canvas resized to:', { width: canvas.width, height: canvas.height, styleWidth: canvas.style.width, styleHeight: canvas.style.height, dpr });
  }

  $: if (ctx && state && config) {
    console.log('[MP_DEBUG | Container] Drawing canvas because state or config changed.', { state, config });
    draw(state, config);
  }

  function draw(currentState, currentConfig) {
    console.log('[MP_DEBUG | Container] draw function called.', { currentState, currentConfig });
    const { visualizationsContentWidth, meterHeight } = currentConfig;
    
    // --- Dynamic Y-Scale Calculation --- START
    let minVisiblePrice = currentState.visualLow;
    let maxVisiblePrice = currentState.visualHigh;

    // Include market profile levels in the visible price range if shown
    if (currentConfig.showMarketProfile && currentState.marketProfile && currentState.marketProfile.levels && currentState.marketProfile.levels.length > 0) {
        const mpPrices = currentState.marketProfile.levels.map(l => l.price);
        const mpMinPrice = Math.min(...mpPrices);
        const mpMaxPrice = Math.max(...mpPrices);

        minVisiblePrice = Math.min(minVisiblePrice, mpMinPrice);
        maxVisiblePrice = Math.max(maxVisiblePrice, mpMaxPrice);
    }

    // Add padding to the visible range
    const priceRange = maxVisiblePrice - minVisiblePrice;
    const padding = priceRange * 0.1; // 10% padding

    const finalMinPrice = minVisiblePrice - padding;
    const finalMaxPrice = maxVisiblePrice + padding;
    // --- Dynamic Y-Scale Calculation --- END

    const y = scaleLinear().domain([finalMinPrice, finalMaxPrice]).range([meterHeight, 0]);
    
    console.log(`[MP_DEBUG | Container] Y-Scale created with dynamic domain [${finalMinPrice}, ${finalMaxPrice}] and range [${meterHeight}, 0]. Testing current price ${currentState.currentPrice} -> Y: ${y(currentState.currentPrice)}`);

    ctx.clearRect(0, 0, visualizationsContentWidth, meterHeight);
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, visualizationsContentWidth, meterHeight);
     console.log('[MP_DEBUG | Container] Canvas cleared and background filled.');

    // This single y-scale is passed to all drawing functions, ensuring they are perfectly aligned.
    console.log('[MP_DEBUG | Container] Calling drawing functions...');
    // Draw Market Profile first so ADR axis is on top
    drawMarketProfile(ctx, currentConfig, currentState, y, currentState.marketProfile);
    drawDayRangeMeter(ctx, currentConfig, currentState, y); // Draw Day Range Meter (ADR axis) second
    drawVolatilityOrb(ctx, currentConfig, currentState, visualizationsContentWidth, meterHeight);
    drawPriceFloat(ctx, currentConfig, currentState, y);
    drawPriceDisplay(ctx, currentConfig, currentState, y, visualizationsContentWidth);
     console.log('[MP_DEBUG | Container] Drawing functions called.');
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
