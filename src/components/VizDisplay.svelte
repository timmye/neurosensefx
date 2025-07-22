<script>
  import { onMount } from 'svelte';
  import * as d3 from 'd3';

  // Removed the unused id prop
  export let config = {};
  export let state = {};
  export let marketProfileData = {};

  let canvasElement;
  let ctx;
  
  // Removed the isReady flag as conditional rendering in parent handles readiness

  // --- Reactive Trigger ---
  // Now simply react to state changes, trusting the parent to provide valid data
  $: if (ctx && state && state.currentPrice !== undefined) { // Add check for state and currentPrice
    drawVisualization();
  }

  onMount(() => {
    if (canvasElement) {
      ctx = canvasElement.getContext('2d');
      canvasElement.width = config.visualizationsContentWidth;
      canvasElement.height = config.meterHeight;
      // Initial draw call - state is guaranteed to be ready by parent component
      drawVisualization(); 
    }
  });

  // --- Central Reference and Coordinate System ---
  function priceToY(price) {
    // Trust that state.adrLow and state.adrHigh are always valid numbers here
    const scale = d3.scaleLinear()
      .domain([state.adrLow, state.adrHigh])
      .range([canvasElement.height, 0]);
    return scale(price);
  }

  // --- Main Drawing Function ---
  // No more guards needed here, as the parent ensures data readiness.
  function drawVisualization() {
     if (!ctx || !canvasElement || !state || state.adrLow === undefined || state.adrHigh === undefined || state.currentPrice === undefined) return; // Final safety check

    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    const meterCenterX = canvasElement.width / 2 + (state.meterHorizontalOffset || 0);
    
    drawDayRangeMeter(ctx, meterCenterX);
    drawMarketProfile(ctx, meterCenterX);
    drawPriceFloat(ctx, meterCenterX); 
  }

  // --- Component-Specific Drawing Functions ---
  function drawDayRangeMeter(ctx, meterCenterX) {
    const meterWidth = config.meterWidth || 10;
    ctx.fillStyle = config.adrBoundaryColor || 'rgba(0, 150, 255, 0.7)';
    ctx.fillRect(meterCenterX - meterWidth / 2, priceToY(state.adrHigh), meterWidth, 2);
    ctx.fillRect(meterCenterX - meterWidth / 2, priceToY(state.adrLow), meterWidth, 2);
    const adrRange = state.adrHigh - state.adrLow;
    const steps = [0.25, 0.50, 0.75];
    ctx.fillStyle = config.adrStepColor || 'rgba(100, 100, 100, 0.5)';
    steps.forEach(step => {
        const price = state.adrLow + adrRange * step;
        ctx.fillRect(meterCenterX - meterWidth / 2, priceToY(price), meterWidth, 1);
    });
  }

  function drawPriceFloat(ctx, meterCenterX) {
      const y = priceToY(state.currentPrice);
      const floatWidth = (config.meterWidth || 10) + 8;
      const floatHeight = 4;
      const priceFloatColor = '#a78bfa';
      ctx.shadowColor = priceFloatColor;
      ctx.shadowBlur = 10;
      ctx.fillStyle = priceFloatColor;
      ctx.fillRect(meterCenterX - floatWidth / 2, y - floatHeight / 2, floatWidth, floatHeight);
      ctx.shadowBlur = 0;
  }

  function drawMarketProfile(ctx, meterCenterX) {
      if (!marketProfileData?.levels?.length) return;
      const maxVolume = Math.max(...marketProfileData.levels.map(l => l.volume));
      if (maxVolume <= 0) return;
      const profileWidth = config.marketProfileWidth || 100;
      ctx.fillStyle = config.marketProfileColor || 'rgba(255, 165, 0, 0.2)';
      marketProfileData.levels.forEach(level => {
          const barWidth = (level.volume / maxVolume) * profileWidth;
          ctx.fillRect(meterCenterX - barWidth / 2, priceToY(level.price) - 0.5, barWidth, 1);
      });
  }

  function getPriceTextColor() {
      if (state.lastTickDirection === 'up') return config.priceUpColor || '#22c55e';
      if (state.lastTickDirection === 'down') return config.priceDownColor || '#ef4444';
      return '#d1d5db';
  }

</script>

<div class="visualization-container" style="width: {config.visualizationsContentWidth}px; height: {config.meterHeight}px;">
  <canvas bind:this={canvasElement}></canvas>
  
  <!-- The price display is now unconditionally rendered within VizDisplay, 
       as the parent ensures state.currentPrice exists before rendering VizDisplay. -->
  <div 
    class="price-display"
    style="
      position: absolute;
      top: {priceToY(state.currentPrice)}px;
      left: {canvasElement ? (canvasElement.width / 2 + (state.meterHorizontalOffset || 0)) : 0}px;
      transform: translate(15px, -50%);
      color: {getPriceTextColor()};
    "
  >
    {state.currentPrice.toFixed(2)}
  </div>
</div>

<style>
  .visualization-container {
    position: relative;
    margin: 0 auto;
    border: 1px solid #374151; 
  }
  canvas {
    display: block;
    position: absolute;
    top: 0;
    left: 0;
  }
  .price-display {
    font-family: 'Courier New', Courier, monospace;
    font-size: 1.2em;
    font-weight: bold;
    text-shadow: 0 0 5px rgba(0,0,0,0.7);
    pointer-events: none;
    position: absolute;
  }
</style>
