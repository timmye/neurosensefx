<script>
  import { onMount, onDestroy } from 'svelte';
  import { setupCanvas } from '../../lib/dayRange/dayRangeCore.js';
  import { renderErrorMessage, renderStatusMessage } from '../../lib/canvasStatusRenderer.js';
  import {
    getDisplayType,
    getRenderer,
    renderWithRenderer,
    renderPriceMarkers,
    renderConnectionStatus as renderConnStatus,
    renderPriceDelta,
    computePriceScale
  } from '../../lib/displayCanvasRenderer.js';
  import { themeStore } from '../../stores/themeStore.js';

  export let data, showMarketProfile, marketProfileData, width, height, onResize;
  export let connectionStatus = null;
  export let symbol = '';
  export let symbolStatusMessage = null;
  export let priceMarkers = [];
  export let selectedMarker = null;
  export let hoverPrice = null;
  export let deltaInfo = null;

  let canvas, ctx;

  // rAF coalescing: at most one render() per animation frame for the reactive
  // (tick-driven) path. Synchronous paths (canvas init, resize) call render()
  // directly so a resize never flashes stale content while waiting a frame.
  let renderScheduled = false;

  function scheduleRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => {
      renderScheduled = false;
      render();
    });
  }

  function render() {
    if (!ctx || !canvas) {
      return;
    }

    try {
      // Per-symbol no-data status (G2): render BEFORE the data block. The store
      // object (lastData) is always truthy once subscribed — even with no price —
      // so a status check placed after `if (data)` was unreachable. symbolStatusMessage
      // is null whenever real price data exists, so this never interferes with data
      // rendering.
      if (symbolStatusMessage) {
        renderStatusMessage(ctx, symbolStatusMessage, { width, height });
        return;
      }

      const displayType = getDisplayType(symbol, showMarketProfile, marketProfileData);

      if (data) {
        const renderer = getRenderer(displayType);
        const config = displayType === 'dayRangeWithMarketProfile'
          ? { width, height, marketData: data }
          : { width, height };

        if (renderer) {
          renderWithRenderer(renderer, ctx, data, config, displayType, marketProfileData);
          // Compute the price scale once and share it across the marker and
          // delta paths (previously each recomputed calculateAdaptiveScale +
          // createPriceScale from the same data).
          const priceScale = computePriceScale(data, height);
          renderPriceMarkers(ctx, data, priceMarkers, selectedMarker, hoverPrice, width, height, priceScale);
          renderPriceDelta(ctx, deltaInfo, data, width, height, priceScale);
        } else {
          console.error('[DISPLAY_CANVAS] No renderer found for display type:', displayType);
          renderErrorMessage(ctx, 'Renderer not available', { width, height });
        }
        return;
      }

      // Handle connection status (global fallback when no per-symbol status)
      if (renderConnStatus(ctx, connectionStatus, symbol, width, height)) {
        return;
      }

      // Default error state
      renderErrorMessage(ctx, 'No data available', { width, height });
    } catch (error) {
      console.error('[DISPLAY_CANVAS] Error during render:', error);
      console.error('[DISPLAY_CANVAS] Error stack:', error.stack);
      renderErrorMessage(ctx, `RENDER_ERROR: ${error.message}`, { width, height });
    }
  }

  onMount(() => {
    if (!canvas) {
      return;
    }
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

  // Repaint on workspace-theme change — canvas colors are resolved from
  // canvasTheme.js at paint time, so a toggle needs a fresh render.
  $: if (canvas && ctx) { void $themeStore; scheduleRender(); }

  $: {
    // Force-read all dependencies to ensure tracking
    const _ctx = ctx;
    const _data = data;
    const _marketProfileData = marketProfileData;
    const _connectionStatus = connectionStatus;
    const _symbolStatusMessage = symbolStatusMessage;
    const _showMarketProfile = showMarketProfile;
    const _priceMarkers = priceMarkers;
    const _selectedMarker = selectedMarker;
    const _hoverPrice = hoverPrice;
    const _deltaInfo = deltaInfo;

    if (_ctx && (_data || _marketProfileData || _connectionStatus ||
        _symbolStatusMessage || _showMarketProfile || _priceMarkers ||
        _selectedMarker || _hoverPrice || _deltaInfo)) {
      scheduleRender();
    }
  }

  onDestroy(() => {
    renderScheduled = false;
  });

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
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }

  canvas {
    display: block;
    background: var(--bg-app);
    width: 100%;
    height: 100%;
  }
</style>