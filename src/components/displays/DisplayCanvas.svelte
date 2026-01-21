<script>
  import { onMount } from 'svelte';
  import { setupCanvas } from '../../lib/dayRangeCore.js';
  import { renderErrorMessage, renderStatusMessage } from '../../lib/canvasStatusRenderer.js';
  import {
    getDisplayType,
    getRenderer,
    renderWithRenderer,
    renderPriceMarkers,
    renderConnectionStatus as renderConnStatus,
    renderPriceDelta
  } from '../../lib/displayCanvasRenderer.js';

  export let data, showMarketProfile, marketProfileData, width, height, onResize;
  export let connectionStatus = null;
  export let symbol = '';
  export let priceMarkers = [];
  export let selectedMarker = null;
  export let hoverPrice = null;
  export let deltaInfo = null;

  let canvas, ctx;

  function render() {
    console.log('[DISPLAY_CANVAS] Render called with:', {
      hasContext: !!ctx,
      hasCanvas: !!canvas,
      hasData: !!data,
      showMarketProfile,
      hasMarketProfileData: !!marketProfileData,
      connectionStatus,
      symbol,
      width,
      height
    });

    if (!ctx || !canvas) {
      console.log('[DISPLAY_CANVAS] Skipping render - missing context or canvas');
      return;
    }

    try {
      const displayType = getDisplayType(symbol, showMarketProfile, marketProfileData);
      console.log('[DISPLAY_CANVAS] Determined display type:', displayType);

      if (data) {
        console.log('[DISPLAY_CANVAS] Has data, proceeding with visualization rendering');
        const renderer = getRenderer(displayType);
        const config = displayType === 'dayRangeWithMarketProfile'
          ? { width, height, marketData: data }
          : { width, height };

        console.log('[DISPLAY_CANVAS] Renderer obtained:', typeof renderer);
        console.log('[DISPLAY_CANVAS] Config:', config);

        if (renderer) {
          console.log('[DISPLAY_CANVAS] Calling renderWithRenderer...');
          const renderResult = renderWithRenderer(renderer, ctx, data, config, displayType, marketProfileData);
          console.log('[DISPLAY_CANVAS] renderWithRenderer result:', renderResult);

          console.log('[DISPLAY_CANVAS] Rendering price markers...');
          renderPriceMarkers(ctx, data, priceMarkers, selectedMarker, hoverPrice, width, height);

          console.log('[DISPLAY_CANVAS] Rendering price delta...');
          renderPriceDelta(ctx, deltaInfo, data, width, height);
        } else {
          console.error('[DISPLAY_CANVAS] No renderer found for display type:', displayType);
          renderErrorMessage(ctx, 'Renderer not available', { width, height });
        }
        return;
      }

      console.log('[DISPLAY_CANVAS] No data available, checking connection status...');
      // Handle connection status
      if (renderConnStatus(ctx, connectionStatus, symbol, width, height)) {
        console.log('[DISPLAY_CANVAS] Connection status rendered');
        return;
      }

      console.log('[DISPLAY_CANVAS] Rendering default error state - No data available');
      // Default error state
      renderErrorMessage(ctx, 'No data available', { width, height });
    } catch (error) {
      console.error('[DISPLAY_CANVAS] Error during render:', error);
      console.error('[DISPLAY_CANVAS] Error stack:', error.stack);
      renderErrorMessage(ctx, `RENDER_ERROR: ${error.message}`, { width, height });
    }
  }

  onMount(() => {
    console.log('[DISPLAY_CANVAS] Component mounting...');
    if (!canvas) {
      console.log('[DISPLAY_CANVAS] No canvas element found during mount');
      return;
    }
    console.log('[DISPLAY_CANVAS] Setting up canvas with dimensions:', { width, height });
    ctx = setupCanvas(canvas, width, height);
    console.log('[DISPLAY_CANVAS] Canvas setup complete, context:', !!ctx);
    if (ctx) {
      console.log('[DISPLAY_CANVAS] Canvas context properties:', {
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        devicePixelRatio: window.devicePixelRatio,
        contextType: ctx.constructor.name
      });
    }
    render();
  });

  $: if (canvas && ctx && width && height) {
    // Check if dimensions actually changed before setting up canvas
    const currentWidth = canvas.width / (window.devicePixelRatio || 1);
    const currentHeight = canvas.height / (window.devicePixelRatio || 1);

    if (Math.abs(currentWidth - width) > 1 || Math.abs(currentHeight - height) > 1) {
      ctx = setupCanvas(canvas, width, height);
      render();
      if (onResize) onResize();
    }
  }

  $: if (ctx && (data || marketProfileData || connectionStatus || showMarketProfile || priceMarkers || selectedMarker || hoverPrice || deltaInfo)) {
    render();
  }

  export function getContext() { return ctx; }
  export function getCanvas() { return canvas; }
  export function renderConnectionStatus(status, symbol) {
    renderStatusMessage(ctx, `${status.toUpperCase()}: ${symbol}`, { width, height });
  }

  export function renderError(message) {
    if (!ctx || !canvas) return;
    renderErrorMessage(ctx, message, { width, height });
  }

  export function refreshCanvas() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    render();
  }

  export function renderFxBasket(basketData) {
    // Update the data prop which will trigger a re-render via Svelte reactivity
    data = basketData;
    // Trigger render explicitly for immediate update
    render();
  }
</script>

<div class="canvas-container">
  <canvas bind:this={canvas} />
</div>

<style>
  .canvas-container {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
  }

  canvas {
    display: block;
    background: #0a0a0a;
    width: 100%;
    height: 100%;
  }
</style>