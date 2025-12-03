<script>
  import { onMount } from 'svelte';
  import { setupCanvas } from '../../lib/dayRangeCore.js';
  import { renderErrorMessage, renderStatusMessage } from '../../lib/canvasStatusRenderer.js';
  import { get, getDefault } from '../../lib/visualizationRegistry.js';

  export let data, displayType, width, height, onResize;
  export let connectionStatus = null;
  export let symbol = '';
  export let marketData = null; // Market data (ADR values) for market profile

  let canvas, ctx;

  function render() {
    if (!ctx || !canvas) return;
    try {
      console.log('[DISPLAY_CANVAS] Starting render - DisplayType:', displayType, 'Data length:', data?.length);

      // If we have data, render it
      if (data) {
        const renderer = get(displayType || 'dayRange') || getDefault();
        console.log('[DISPLAY_CANVAS] Got renderer:', !!renderer, 'for display type:', displayType);

        if (renderer) {
          console.log('[DISPLAY_CANVAS] Calling renderer with data:', data?.length ? `${data.length} items` : 'no data');
          // Pass market data to renderer for market profile scaling
          const config = { width, height, marketData };
          renderer(ctx, data, config);
          console.log('[DISPLAY_CANVAS] Renderer completed successfully');
        } else {
          console.error('[DISPLAY_CANVAS] No renderer found for display type:', displayType);
          renderErrorMessage(ctx, `Unknown display type: ${displayType}`, { width, height });
        }
        return;
      }

      // Only show connection status for non-connected states (use status message, not error)
      if (connectionStatus && connectionStatus !== 'connected') {
        renderStatusMessage(ctx, `${connectionStatus.toUpperCase()}: ${symbol}`, { width, height });
        return;
      }

      // Show waiting for data when connected but no data yet (use status message, not error)
      if (connectionStatus === 'connected') {
        renderStatusMessage(ctx, `WAITING FOR DATA: ${symbol}`, { width, height });
        return;
      }

      // Only show "No data available" if this is truly an error state (no data, no connection status)
      renderErrorMessage(ctx, 'No data available', { width, height });
    } catch (error) {
      console.error('[DISPLAY_CANVAS] Error during render:', error);
      console.error('[DISPLAY_CANVAS] Error stack:', error.stack);
      console.error('[DISPLAY_CANVAS] Display type:', displayType);
      console.error('[DISPLAY_CANVAS] Data:', data);
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

  $: if (ctx && (data || connectionStatus)) {
    render();
  }

  export function getContext() { return ctx; }
  export function getCanvas() { return canvas; }
  export function renderConnectionStatus(status, symbol) {
    if (!ctx || !canvas) return;
    renderStatusMessage(ctx, `${status.toUpperCase()}: ${symbol}`, { width, height });
  }
  export function renderError(message) {
    if (!ctx || !canvas) return;
    renderErrorMessage(ctx, message, { width, height });
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