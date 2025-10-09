<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { Badge, Icon, Button } from '../atoms/index.js';
  
  export let canvas = null;
  export let width = 300;
  export let height = 200;
  export let showControls = true;
  export let interactive = false;
  export let scale = 1;
  
  const dispatch = createEventDispatcher();
  
  let canvasElement;
  let ctx;
  let isRendering = false;
  let renderFrame = null;
  
  // Sample data for preview
  let sampleData = {
    currentPrice: 1.0856,
    visualHigh: 1.0900,
    visualLow: 1.0800,
    volatility: 0.0023,
    adr: 0.0089,
    adrPercent: 75
  };
  
  onMount(() => {
    if (canvasElement) {
      ctx = canvasElement.getContext('2d');
      startRendering();
    }
    
    return () => {
      stopRendering();
    };
  });
  
  function startRendering() {
    if (isRendering) return;
    isRendering = true;
    render();
  }
  
  function stopRendering() {
    isRendering = false;
    if (renderFrame) {
      cancelAnimationFrame(renderFrame);
    }
  }
  
  function render() {
    if (!isRendering || !ctx || !canvas) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Set up canvas context
    ctx.save();
    ctx.scale(scale, scale);
    
    // Draw background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width / scale, height / scale);
    
    // Draw active indicators
    if (canvas.indicators && canvas.indicators.length > 0) {
      canvas.indicators.forEach(indicatorId => {
        drawIndicator(indicatorId);
      });
    }
    
    // Draw canvas border
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width / scale, height / scale);
    
    // Draw symbol info
    drawSymbolInfo();
    
    ctx.restore();
    
    // Continue rendering
    renderFrame = requestAnimationFrame(render);
  }
  
  function drawIndicator(indicatorId) {
    switch (indicatorId) {
      case 'priceFloat':
        drawPriceFloat();
        break;
      case 'marketProfile':
        drawMarketProfile();
        break;
      case 'volatilityOrb':
        drawVolatilityOrb();
        break;
      case 'adrMeter':
        drawADRMeter();
        break;
      case 'priceDisplay':
        drawPriceDisplay();
        break;
    }
  }
  
  function drawPriceFloat() {
    const { currentPrice, visualHigh, visualLow } = sampleData;
    const canvasHeight = height / scale;
    const canvasWidth = width / scale;
    
    // Calculate Y position
    const priceRange = visualHigh - visualLow;
    const pricePercent = (currentPrice - visualLow) / priceRange;
    const y = canvasHeight - (pricePercent * canvasHeight);
    
    // Draw price line
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#a78bfa';
    ctx.shadowBlur = 8;
    
    ctx.beginPath();
    ctx.moveTo(canvasWidth * 0.2, y);
    ctx.lineTo(canvasWidth * 0.8, y);
    ctx.stroke();
    
    ctx.shadowBlur = 0;
  }
  
  function drawMarketProfile() {
    const canvasHeight = height / scale;
    const canvasWidth = width / scale;
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const radius = Math.min(canvasWidth, canvasHeight) * 0.3;
    
    // Draw market profile circle
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.7;
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw profile data (simplified)
    ctx.fillStyle = '#10b981';
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const x = centerX + Math.cos(angle) * radius * 0.7;
      const y = centerY + Math.sin(angle) * radius * 0.7;
      
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.globalAlpha = 1;
  }
  
  function drawVolatilityOrb() {
    const canvasHeight = height / scale;
    const canvasWidth = width / scale;
    const centerX = canvasWidth * 0.8;
    const centerY = canvasHeight * 0.2;
    const baseRadius = 20;
    const volatility = sampleData.volatility;
    const radius = baseRadius + (volatility * 10000);
    
    // Draw volatility orb
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, '#f59e0b');
    gradient.addColorStop(1, 'rgba(245, 158, 11, 0.2)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw center dot
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  
  function drawADRMeter() {
    const canvasHeight = height / scale;
    const canvasWidth = width / scale;
    const meterX = canvasWidth * 0.8;
    const meterY = canvasHeight * 0.8;
    const meterWidth = 60;
    const meterHeight = 8;
    const adrPercent = sampleData.adrPercent;
    
    // Draw ADR meter background
    ctx.fillStyle = '#333';
    ctx.fillRect(meterX - meterWidth/2, meterY - meterHeight/2, meterWidth, meterHeight);
    
    // Draw ADR meter fill
    const fillWidth = (adrPercent / 100) * meterWidth;
    const fillColor = adrPercent > 80 ? '#ef4444' : adrPercent > 50 ? '#f59e0b' : '#3b82f6';
    
    ctx.fillStyle = fillColor;
    ctx.fillRect(meterX - meterWidth/2, meterY - meterHeight/2, fillWidth, meterHeight);
    
    // Draw ADR text
    ctx.fillStyle = '#fff';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${adrPercent}%`, meterX, meterY - 5);
  }
  
  function drawPriceDisplay() {
    const canvasHeight = height / scale;
    const canvasWidth = width / scale;
    const { currentPrice } = sampleData;
    
    // Draw price background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 80, 25);
    
    // Draw price text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(currentPrice.toFixed(4), 15, 27);
  }
  
  function drawSymbolInfo() {
    const canvasHeight = height / scale;
    const canvasWidth = width / scale;
    
    // Draw symbol name
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(canvas.symbol || 'EURUSD', 5, canvasHeight - 5);
    
    // Draw canvas name if available
    if (canvas.name) {
      ctx.textAlign = 'right';
      ctx.fillText(canvas.name, canvasWidth - 5, canvasHeight - 5);
    }
  }
  
  function handleCanvasClick() {
    if (interactive) {
      dispatch('canvasClick', { canvas });
    }
  }
  
  function handleSettings() {
    dispatch('canvasSettings', { canvas });
  }
  
  function handleDuplicate() {
    dispatch('canvasDuplicate', { canvas });
  }
  
  function handleDelete() {
    dispatch('canvasDelete', { canvas });
  }
  
  function updateSampleData() {
    // Simulate real-time data updates
    sampleData.currentPrice += (Math.random() - 0.5) * 0.0001;
    sampleData.volatility = Math.max(0.0001, sampleData.volatility + (Math.random() - 0.5) * 0.0001);
    sampleData.adrPercent = Math.max(10, Math.min(100, sampleData.adrPercent + (Math.random() - 0.5) * 5));
  }
  
  // Update sample data periodically for live preview
  setInterval(updateSampleData, 1000);
</script>

<div class="canvas-preview" class:interactive>
  <div class="preview-container">
    <!-- Canvas Preview -->
    <div class="canvas-wrapper">
      <canvas 
        bind:this={canvasElement}
        width={width}
        height={height}
        class="preview-canvas"
        class:interactive
        on:click={handleCanvasClick}
      />
      
      <!-- Overlay Info -->
      {#if canvas}
        <div class="canvas-overlay">
          <div class="canvas-info">
            <Badge variant="outline" size="xs">
              {canvas.symbol || 'No Symbol'}
            </Badge>
            
            {#if canvas.indicators && canvas.indicators.length > 0}
              <Badge variant="subtle" size="xs">
                {canvas.indicators.length} indicators
              </Badge>
            {/if}
          </div>
        </div>
      {/if}
    </div>
    
    <!-- Controls -->
    {#if showControls && canvas}
      <div class="preview-controls">
        <div class="control-group">
          <Button 
            variant="ghost" 
            size="xs"
            on:click={handleSettings}
            title="Canvas settings"
          >
            <Icon name="settings" size="xs" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="xs"
            on:click={handleDuplicate}
            title="Duplicate canvas"
          >
            <Icon name="copy" size="xs" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="xs"
            on:click={handleDelete}
            title="Delete canvas"
          >
            <Icon name="trash-2" size="xs" />
          </Button>
        </div>
      </div>
    {/if}
  </div>
  
  <!-- Empty State -->
  {#if !canvas}
    <div class="empty-state">
      <Icon name="box" size="lg" variant="muted" />
      <h4>No Canvas Selected</h4>
      <p>Select a canvas to preview its appearance and indicators.</p>
    </div>
  {/if}
</div>

<style>
  .canvas-preview {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  
  .preview-container {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  
  .canvas-wrapper {
    position: relative;
    display: inline-block;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--bg-secondary);
  }
  
  .preview-canvas {
    display: block;
    cursor: default;
  }
  
  .preview-canvas.interactive {
    cursor: pointer;
  }
  
  .preview-canvas.interactive:hover {
    opacity: 0.9;
  }
  
  .canvas-overlay {
    position: absolute;
    top: var(--space-2);
    left: var(--space-2);
    right: var(--space-2);
    display: flex;
    justify-content: space-between;
    pointer-events: none;
  }
  
  .canvas-info {
    display: flex;
    gap: var(--space-1);
  }
  
  .preview-controls {
    display: flex;
    justify-content: flex-end;
  }
  
  .control-group {
    display: flex;
    gap: var(--space-1);
  }
  
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: var(--space-6) var(--space-4);
    gap: var(--space-3);
    border: 2px dashed var(--border-default);
    border-radius: var(--radius-md);
    background: var(--bg-secondary);
    min-height: 200px;
  }
  
  .empty-state h4 {
    margin: 0;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }
  
  .empty-state p {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    max-width: 250px;
  }
  
  /* Responsive Design */
  @media (max-width: 768px) {
    .canvas-overlay {
      top: var(--space-1);
      left: var(--space-1);
      right: var(--space-1);
    }
    
    .canvas-info {
      flex-direction: column;
      gap: var(--space-1);
    }
    
    .control-group {
      flex-direction: column;
      gap: var(--space-1);
    }
  }
</style>
