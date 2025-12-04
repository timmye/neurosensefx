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
    if (!ctx || !canvas) return;
    try {
      const displayType = getDisplayType(showMarketProfile, marketProfileData);

      if (data) {
        const renderer = getRenderer(displayType);
        const config = displayType === 'dayRangeWithMarketProfile'
          ? { width, height, marketData: data }
          : { width, height };

        if (renderer) {
          renderWithRenderer(renderer, ctx, data, config, displayType, marketProfileData);
          renderPriceMarkers(ctx, data, priceMarkers, selectedMarker, hoverPrice, width, height);
          renderPriceDelta(ctx, deltaInfo, data, width, height);
        } else {
          console.error('[DISPLAY_CANVAS] No renderer found');
          renderErrorMessage(ctx, 'Renderer not available', { width, height });
        }
        return;
      }

      // Handle connection status
      if (renderConnStatus(ctx, connectionStatus, symbol, width, height)) {
        return;
      }

      // Default error state
      renderErrorMessage(ctx, 'No data available', { width, height });
    } catch (error) {
      console.error('[DISPLAY_CANVAS] Error during render:', error);
      renderErrorMessage(ctx, `RENDER_ERROR: ${error.message}`, { width, height });
    }
  }

  onMount(() => {
    if (!canvas) return;
    ctx = setupCanvas(canvas, width, height);
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

  $: if (ctx && (data || connectionStatus || showMarketProfile || priceMarkers || selectedMarker || hoverPrice || deltaInfo)) {
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