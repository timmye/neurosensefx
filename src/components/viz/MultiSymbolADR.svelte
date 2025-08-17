<script>
  import { onMount } from 'svelte';
  import { symbolStore } from '../../data/symbolStore';
  import { drawMultiSymbolADR } from '../../lib/viz/multiSymbolADR.js';

  let canvasElement;
  let ctx;
  const width = 120; // As per spec
  const height = 300; // As per spec
  const IS_DEBUG = true; // Set to false in production

  onMount(() => {
    if (!canvasElement) {
        if (IS_DEBUG) console.error('MultiSymbolADR: Canvas element not found on mount.');
        return;
    }
    ctx = canvasElement.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    canvasElement.width = width * dpr;
    canvasElement.height = height * dpr;
    canvasElement.style.width = `${width}px`;
    canvasElement.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    if (IS_DEBUG) console.log('MultiSymbolADR: Component mounted and canvas initialized.');

    const unsubscribe = symbolStore.subscribe(allSymbols => {
      if (!ctx) {
        if (IS_DEBUG) console.warn('MultiSymbolADR: Drawing context not yet available.');
        return;
      }
      if (!allSymbols || Object.keys(allSymbols).length === 0) {
        drawMultiSymbolADR(ctx, { width, height }, []);
        return;
      }
      
      // FIX: Remove the hardcoded filter and process all symbols from the store.
      const symbolsToRender = Object.keys(allSymbols)
        .map(symbolName => {
          const symbolData = allSymbols[symbolName];
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

      if (IS_DEBUG) {
        console.log(`MultiSymbolADR: Received ${Object.keys(allSymbols).length} total symbols. Mapped to ${symbolsToRender.length} valid symbols for rendering.`);
      }

      drawMultiSymbolADR(ctx, { width, height }, symbolsToRender);
    });

    return () => {
      if (IS_DEBUG) console.log('MultiSymbolADR: Component unmounted, unsubscribing from store.');
      unsubscribe();
    };
  });
</script>

<canvas bind:this={canvasElement}></canvas>

<style>
  canvas {
    display: block;
    background-color: #0a0a0a; /* Dark background for contrast */
  }
</style>
