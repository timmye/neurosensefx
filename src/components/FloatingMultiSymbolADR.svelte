<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { symbolStore } from '../data/symbolStore.js';
  import { drawMultiSymbolADR } from '../lib/viz/multiSymbolADR.js';
  import { uiActions } from '../stores/uiState.js';
  import FloatingPanel from './shared/FloatingPanel.svelte';
  
  const dispatch = createEventDispatcher();
  
  // Component state
  let adrPosition = { x: 100, y: 100 };
  let isMinimized = false;
  let canvasElement;
  let ctx;
  let symbols = [];
  let symbolsToRender = [];
  
  // Canvas dimensions
  const width = 120;
  const height = 300;
  const IS_DEBUG = true;
  
  // Subscribe to symbol store
  const unsubSymbolStore = symbolStore.subscribe(value => {
    symbols = Object.keys(value);
    
    // Process symbols for rendering
    if (!value || Object.keys(value).length === 0) {
      symbolsToRender = [];
    } else {
      symbolsToRender = Object.keys(value)
        .map(symbolName => {
          const symbolData = value[symbolName];
          // Check if the essential state for calculation exists
          if (symbolData && symbolData.state && typeof symbolData.state.currentPrice === 'number' && typeof symbolData.state.todaysHigh === 'number' && typeof symbolData.state.todaysLow === 'number') {
            
            const state = symbolData.state;
            
            // Calculate adrPercentage here, using the exact same logic as the main visualization.
            const adrPercentage = (state.todaysHigh > state.todaysLow) ? ((state.currentPrice - state.todaysLow) / (state.todaysHigh - state.todaysLow)) * 200 - 100 : 0;

            return {
              symbolName: symbolName,
              adrPercentage: adrPercentage
            };
          }
          return null;
        })
        .filter(Boolean);
    }
    
    // Trigger canvas redraw
    if (ctx) {
      drawMultiSymbolADR(ctx, { width, height }, symbolsToRender);
    }
  });
  
  onMount(() => {
    // Initialize canvas
    if (canvasElement) {
      ctx = canvasElement.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      
      canvasElement.width = width * dpr;
      canvasElement.height = height * dpr;
      canvasElement.style.width = `${width}px`;
      canvasElement.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
      
      if (IS_DEBUG) console.log('FloatingMultiSymbolADR: Component mounted and canvas initialized.');
      
      // Initial draw
      drawMultiSymbolADR(ctx, { width, height }, symbolsToRender);
    }
  });
  
  onDestroy(() => {
    unsubSymbolStore();
  });
  
  function handleClose() {
    uiActions.hideFloatingADRPanel();
  }
</script>

<FloatingPanel
  title="ADR Overview"
  panelId="adr-panel"
  position={adrPosition}
  on:close={handleClose}
  defaultMinimized={false}
>
  <div class="adr-content">
    <div class="adr-canvas-container">
      <canvas bind:this={canvasElement}></canvas>
    </div>
    
    <div class="adr-info">
      <div class="info-section">
        <h4>Active Symbols</h4>
        <div class="info-grid">
          <span>Total:</span>
          <span>{symbols.length}</span>
          <span>With Data:</span>
          <span>{symbolsToRender.length}</span>
        </div>
      </div>
    </div>
  </div>
</FloatingPanel>

<style>
  .adr-content {
    /* No additional styles needed, using FloatingPanel styles */
  }
  
  .adr-canvas-container {
    display: flex;
    justify-content: center;
    margin-bottom: 12px;
  }
  
  canvas {
    display: block;
    background-color: #0a0a0a;
    border-radius: 4px;
  }
  
  .adr-info {
    font-size: 11px;
  }
  
  .info-section {
    margin-bottom: 12px;
  }
  
  .info-section:last-child {
    margin-bottom: 0;
  }
  
  .info-section h4 {
    margin: 0 0 8px 0;
    color: #d1d5db;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid #374151;
    padding-bottom: 4px;
  }
  
  .info-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 8px;
    font-size: 11px;
  }
  
  .info-grid span:nth-child(odd) {
    color: #9ca3af;
    font-weight: 500;
  }
  
  .info-grid span:nth-child(even) {
    color: #e5e7eb;
    text-align: right;
  }
</style>