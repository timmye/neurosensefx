<script>
  import { onMount } from 'svelte';
  import { setupCanvas, renderErrorMessage, renderStatusMessage } from '../../lib/visualizers.js';
  import { get, getDefault } from '../../lib/visualizationRegistry.js';

  export let data, displayType, width, height, onResize;
  export let connectionStatus = null;
  export let symbol = '';

  let canvas, ctx;

  function render() {
    if (!ctx || !canvas) return;
    try {
      // If we have data, render it
      if (data) {
        const renderer = get(displayType || 'dayRange') || getDefault();
        if (renderer) {
          renderer(ctx, data, { width, height });
        } else {
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
      renderErrorMessage(ctx, `RENDER_ERROR: ${error.message}`, { width, height });
    }
  }

  onMount(() => {
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    ctx = setupCanvas(canvas);
    render();
  });

  $: if (canvas && ctx && width && height) {
    canvas.width = width;
    canvas.height = height;
    ctx = setupCanvas(canvas);
    render();
    if (onResize) onResize();
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

<canvas bind:this={canvas} />

<style>
  canvas{display:block;background:#0a0a0a;width:100%;height:100%}
</style>