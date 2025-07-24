<script>
  import { onMount, afterUpdate } from 'svelte';
  import * as d3 from 'd3';

  export let config = {};
  export let state = {};
  
  // Log whenever the state prop changes
  $: if (state) {
    console.log(`VizDisplay: State prop updated. Price: ${state.currentPrice}`);
  }

  let canvasElement;
  let ctx;

  $: if (ctx && state && state.currentPrice !== undefined) {
    drawVisualization();
  }
  
  onMount(() => {
    if (canvasElement) {
      ctx = canvasElement.getContext('2d');
      canvasElement.width = config.visualizationsContentWidth;
      canvasElement.height = config.meterHeight;
      drawVisualization(); 
    }
  });

  function priceToY(price) {
    const height = canvasElement?.height || config.meterHeight || 120;
    const minPrice = state.adrLow;
    const maxPrice = state.adrHigh;

    if (minPrice === undefined || maxPrice === undefined || minPrice >= maxPrice) {
      return height / 2; // Fallback to center
    }

    const scale = d3.scaleLinear()
      .domain([minPrice, maxPrice])
      .range([height, 0]);
    return scale(price);
  }

  function drawVisualization() {
    if (!ctx || !canvasElement || !state || state.adrLow === undefined || state.adrHigh === undefined || state.currentPrice === undefined) return;

    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);
    
    const meterCenterX = config.centralAxisXPosition || (canvasElement.width / 2);

    drawDayRangeMeter(ctx, meterCenterX);
    drawPriceFloat(ctx, meterCenterX);
    drawCurrentPrice(ctx, meterCenterX);
    
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, canvasElement.width, canvasElement.height);
  }

  function drawDayRangeMeter(ctx, meterCenterX) {
    ctx.save();
    const meterWidth = 40;
    const lowY = priceToY(state.adrLow);
    const highY = priceToY(state.adrHigh);
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(meterCenterX, 0);
    ctx.lineTo(meterCenterX, canvasElement.height);
    ctx.stroke();
    
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(meterCenterX - meterWidth / 2, lowY);
    ctx.lineTo(meterCenterX + meterWidth / 2, lowY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(meterCenterX - meterWidth / 2, highY);
    ctx.lineTo(meterCenterX + meterWidth / 2, highY);
    ctx.stroke();
    
    const adrRange = state.adrHigh - state.adrLow;
    if (adrRange > 0) {
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
    ctx.restore();
  }

  function drawPriceFloat(ctx, meterCenterX) {
    ctx.save();
    const y = priceToY(state.currentPrice);
    const pipsInADR = config.adrRange || 100;
    const pixelsPerPip = canvasElement.height / pipsInADR; 
    const floatHeightPx = (config.priceFloatHeight || 1) * pixelsPerPip;
    const floatWidth = (config.priceFloatWidth || 100);
    const xOffset = config.priceFloatXOffset || 0;
    const priceFloatColor = state.lastTickDirection === 'up' ? '#22c55e' : (state.lastTickDirection === 'down' ? '#ef4444' : '#a78bfa');
    
    ctx.shadowColor = priceFloatColor;
    ctx.shadowBlur = 10;
    ctx.fillStyle = priceFloatColor;
    ctx.fillRect(meterCenterX - floatWidth / 2 + xOffset, y - floatHeightPx / 2, floatWidth, floatHeightPx);
    ctx.restore();
  }

  function drawCurrentPrice(ctx) {
    if (state.currentPrice === undefined) return;
    ctx.save();
    
    const y = priceToY(state.currentPrice);
    const meterCenterX = config.centralAxisXPosition;
    const priceString = (state.currentPrice || 0).toFixed(5);
    const [integerPart, decimalPart] = priceString.split('.');
    const bigFigure = `${integerPart}.${decimalPart.substring(0, 2)}`;
    const pips = decimalPart.substring(2, 4);
    const pipette = decimalPart.substring(4, 5);
    const baseFontSize = config.priceFontSize || 14;
    const fontWeight = config.priceFontWeight || 400;

    ctx.font = `${fontWeight} ${baseFontSize}px "Roboto Mono", monospace`;
    const totalTextWidth = ctx.measureText(priceString).width; // Simplified width calc
    const x = meterCenterX + (config.priceHorizontalOffset || 0) - totalTextWidth; 
    
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = (state.lastTickDirection === 'up') ? (config.priceUpColor || '#22c55e') : (state.lastTickDirection === 'down') ? (config.priceDownColor || '#ef4444') : '#d1d5db';
    
    ctx.fillText(priceString, x, y);
    ctx.restore();
  }
</script>

<div class="visualization-container" style="width: {config.visualizationsContentWidth}px; height: {config.meterHeight}px;">
  <canvas bind:this={canvasElement}></canvas>
</div>

<style>
  /* Basic styles */
</style>
