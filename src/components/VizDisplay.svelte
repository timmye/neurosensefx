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
    console.log('State updated:', state.currentPrice, 'ADR:', state.adrLow, state.adrHigh);
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
    // Use config.meterHeight as fallback to ensure we always have a valid height
    const height = canvasElement?.height || config.meterHeight || 600;
    const scale = d3.scaleLinear()
      .domain([state.adrLow, state.adrHigh])
      .range([height, 0]);
    return scale(price);
  }

  // --- Main Drawing Function ---
  // No more guards needed here, as the parent ensures data readiness.
  function drawVisualization() {
     if (!ctx || !canvasElement || !state || state.adrLow === undefined || state.adrHigh === undefined || state.currentPrice === undefined) return; // Final safety check

    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // Spec canvas: 220x120px - baseline verification
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);
    
    // Draw border to show canvas boundaries
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, canvasElement.width, canvasElement.height);
    
    // Display dimensions
    ctx.fillStyle = '#ccc';
    ctx.font = '10px monospace';
    ctx.fillText(`${canvasElement.width}x${canvasElement.height}`, 5, 15);
    
    const meterCenterX = canvasElement.width / 2 + (state.meterHorizontalOffset || 0);
    
    // Enable ADR day range meter as anchor/basis
    drawDayRangeMeter(ctx, meterCenterX);
    
    // Enable price float level indicator
    drawPriceFloat(ctx, meterCenterX);
    
    // Enable current price display
    drawCurrentPrice(ctx);
    
    // Debug: Log ADR rendering details
    console.log('ADR rendering debug:', {
      width: canvasElement.width,
      height: canvasElement.height,
      adrLow: state.adrLow,
      adrHigh: state.adrHigh,
      lowY: priceToY(state.adrLow),
      highY: priceToY(state.adrHigh),
      currentPrice: state.currentPrice,
      priceY: priceToY(state.currentPrice)
    });
  }

  // --- Component-Specific Drawing Functions ---
  function drawDayRangeMeter(ctx, meterCenterX) {
    const meterWidth = 40; // Narrower meter for better visibility
    const lowY = priceToY(state.adrLow);
    const highY = priceToY(state.adrHigh);
    
    // Draw ADR axis - the fundamental basis
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(meterCenterX, 0);
    ctx.lineTo(meterCenterX, canvasElement.height);
    ctx.stroke();
    
    // Draw ADR range with thicker lines
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    
    // ADR low line
    ctx.beginPath();
    ctx.moveTo(meterCenterX - meterWidth / 2, lowY);
    ctx.lineTo(meterCenterX + meterWidth / 2, lowY);
    ctx.stroke();
    
    // ADR high line
    ctx.beginPath();
    ctx.moveTo(meterCenterX - meterWidth / 2, highY);
    ctx.lineTo(meterCenterX + meterWidth / 2, highY);
    ctx.stroke();
    
    // 25%, 50%, 75% markers
    const adrRange = state.adrHigh - state.adrLow;
    const steps = [0.25, 0.50, 0.75];
    
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    
    steps.forEach(step => {
      const price = state.adrLow + adrRange * step;
      const y = priceToY(price);
      
      ctx.beginPath();
      ctx.moveTo(meterCenterX - meterWidth / 4, y);
      ctx.lineTo(meterCenterX + meterWidth / 4, y);
      ctx.stroke();
    });
  }

  function drawPriceFloat(ctx, meterCenterX) {
      const y = priceToY(state.currentPrice);
      const floatWidth = (config.visualizationsContentWidth || 220) + 8;
      const floatHeight = 4;
      const priceFloatColor = '#a78bfa';
      ctx.shadowColor = priceFloatColor;
      ctx.shadowBlur = 10;
      ctx.fillStyle = priceFloatColor;
      ctx.fillRect(meterCenterX - floatWidth / 2, y - floatHeight / 2, floatWidth, floatHeight);
      ctx.shadowBlur = 0;
  }

  function drawCurrentPrice(ctx) {
    // Skip drawing if no current price
    if (!state.currentPrice) return;
    
    // Draw price text in top-left corner
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(state.currentPrice.toFixed(5), 10, 15);
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
  
  <!-- All other elements disabled for baseline verification -->
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
  /* Price display is now rendered on canvas */
</style>
