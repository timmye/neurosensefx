<script>
  import { onMount, afterUpdate } from 'svelte';
  import * as d3 from 'd3';

  export let config = {};
  export let state = {};
  export let marketProfileData = {};
  export let flashEffect = null;

  let canvasElement;
  let ctx;
  let lastFlashId = null;

  $: if (ctx && state && state.currentPrice !== undefined) {
    drawVisualization();
  }
  
  afterUpdate(() => {
    if (flashEffect && flashEffect.id !== lastFlashId) {
      drawFlash(flashEffect.direction);
      lastFlashId = flashEffect.id;
    }
  });

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
    const scale = d3.scaleLinear()
      .domain([state.adrLow, state.adrHigh])
      .range([height, 0]);
    return scale(price);
  }

  function drawVisualization() {
    if (!ctx || !canvasElement || !state || state.adrLow === undefined || state.adrHigh === undefined || state.currentPrice === undefined) return;

    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);
    
    const meterCenterX = canvasElement.width / 2 + (state.meterHorizontalOffset || 0);

    drawVolatilityOrb(ctx);
    drawMarketProfile(ctx, meterCenterX);
    drawDayRangeMeter(ctx, meterCenterX);
    drawPriceFloat(ctx, meterCenterX);
    drawCurrentPrice(ctx);
    
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, canvasElement.width, canvasElement.height);
    
    ctx.fillStyle = '#ccc';
    ctx.font = '8px monospace';
    ctx.fillText(`${canvasElement.width}x${canvasElement.height}`, 5, 10);
  }

  function drawFlash(direction) {
    if (!ctx || !canvasElement) return;
    let opacity = config.flashIntensity || 0.3;
    const animate = () => {
      drawVisualization();
      const gradient = ctx.createRadialGradient(canvasElement.width / 2, canvasElement.height / 2, 0, canvasElement.width / 2, canvasElement.height / 2, canvasElement.width * 0.7);
      const flashColor = direction === 'up' ? `rgba(96, 165, 250, ${opacity})` : `rgba(248, 113, 113, ${opacity})`;
      gradient.addColorStop(0, flashColor);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);
      opacity -= 0.05;
      if (opacity > 0) requestAnimationFrame(animate);
      else drawVisualization();
    };
    requestAnimationFrame(animate);
  }

  function drawVolatilityOrb(ctx) {
    ctx.save();
    const centerX = canvasElement.width / 2;
    const centerY = canvasElement.height / 2;
    const radius = (config.volatilityOrbBaseWidth || 40) / 2;
    const color = config.volatilityOrbColor || 'rgba(139, 92, 246, 0.1)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  function drawMarketProfile(ctx, meterCenterX) {
    if (!marketProfileData?.levels?.length) return;
    ctx.save();
    const maxVolume = Math.max(...marketProfileData.levels.map(l => l.volume));
    if (maxVolume > 0) {
      const profileMaxWidth = (config.marketProfileWidth || 100) / 2;
      ctx.fillStyle = config.marketProfileColor || 'rgba(59, 130, 246, 0.2)';
      marketProfileData.levels.forEach(level => {
        const barWidth = (level.volume / maxVolume) * profileMaxWidth;
        const y = priceToY(level.price);
        ctx.fillRect(meterCenterX - barWidth, y - 0.5, barWidth, 1);
      });
    }
    ctx.restore();
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
    ctx.restore();
  }

  function drawPriceFloat(ctx, meterCenterX) {
    ctx.save();
    const y = priceToY(state.currentPrice);
    const floatWidth = (config.visualizationsContentWidth || 220) + 8;
    const floatHeight = 4;
    const priceFloatColor = '#a78bfa';
    ctx.shadowColor = priceFloatColor;
    ctx.shadowBlur = 10;
    ctx.fillStyle = priceFloatColor;
    ctx.fillRect(meterCenterX - floatWidth / 2, y - floatHeight / 2, floatWidth, floatHeight);
    ctx.restore();
  }

  function drawCurrentPrice(ctx) {
    if (state.currentPrice === undefined) return;
    ctx.save();
    const y = priceToY(state.currentPrice);
    const meterCenterX = canvasElement.width / 2 + (state.meterHorizontalOffset || 0);
    const priceText = state.currentPrice.toFixed(5);
    const x = meterCenterX + 30;
    ctx.font = '14px "Roboto Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const textMetrics = ctx.measureText(priceText);
    const textWidth = textMetrics.width;
    const textHeight = 14; 
    ctx.fillStyle = 'rgba(10, 10, 10, 0.75)';
    ctx.fillRect(x - 5, y - textHeight / 2 - 3, textWidth + 10, textHeight + 6);
    ctx.fillStyle = getPriceTextColor();
    ctx.fillText(priceText, x, y);
    ctx.restore();
  }

  function getPriceTextColor() {
    if (state.lastTickDirection === 'up') return config.priceUpColor || '#22c55e';
    if (state.lastTickDirection === 'down') return config.priceDownColor || '#ef4444';
    return '#d1d5db';
  }
</script>

<div class="visualization-container" style="width: {config.visualizationsContentWidth}px; height: {config.meterHeight}px;">
  <canvas bind:this={canvasElement}></canvas>
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
</style>
