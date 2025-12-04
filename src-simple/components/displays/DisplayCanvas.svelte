<script>
  import { onMount } from 'svelte';
  import { setupCanvas } from '../../lib/dayRangeCore.js';
  import { renderErrorMessage, renderStatusMessage } from '../../lib/canvasStatusRenderer.js';
  import { get, getDefault } from '../../lib/visualizationRegistry.js';
  import { renderMarketProfile } from '../../lib/marketProfileRenderer.js';
  import { renderUserPriceMarkers, renderHoverPreview } from '../../lib/priceMarkerRenderer.js';
  import { calculateAdaptiveScale } from '../../lib/dayRangeCalculations.js';
  import { createDayRangeConfig, createPriceScale } from '../../lib/dayRangeRenderingUtils.js';

  export let data, showMarketProfile, marketProfileData, width, height, onResize;
  export let connectionStatus = null;
  export let symbol = '';
  export let priceMarkers = [];
  export let selectedMarker = null;
  export let hoverPrice = null;
  export let interactionSystem = null;

  let canvas, ctx;

  function render() {
    if (!ctx || !canvas) return;
    try {
      // Determine display type for renderer selection
      const displayType = showMarketProfile && marketProfileData && marketProfileData.length > 0 ? 'dayRangeWithMarketProfile' : 'dayRange';

      // Select appropriate renderer based on display type
      if (data) {
        let renderer;
        let config = { width, height };

        if (displayType === 'dayRangeWithMarketProfile') {
          // Use combined renderer for market profile overlay
          renderer = get('dayRangeWithMarketProfile');
          config = { width, height, marketData: data };

          if (!renderer) {
            // Fallback to overlay approach if combined renderer not available
            renderer = get('dayRange') || getDefault();
          }
        } else {
          // Use day range renderer for regular display
          renderer = get('dayRange') || getDefault();
        }

        if (renderer) {
          if (displayType === 'dayRangeWithMarketProfile' && get('dayRangeWithMarketProfile')) {
            // Use the combined renderer which handles both visualizations
            renderer(ctx, marketProfileData, config);
          } else {
            renderer(ctx, data, config);

            // Overlay market profile if enabled and data available (fallback)
            if (showMarketProfile && marketProfileData && marketProfileData.length > 0) {
              const marketProfileConfig = { width, height, marketData: data };
              ctx.save(); // Save context for overlay
              renderMarketProfile(ctx, marketProfileData, marketProfileConfig);
              ctx.restore(); // Restore context
            }
          }

          // Add price marker rendering after existing visualizations
          if (data && (priceMarkers || hoverPrice)) {
            // Get proper configuration for price markers
            const defaultConfig = (() => {
              // Import default configuration to ensure colors and fonts are available
              try {
                // Use a minimal but complete config for price marker rendering
                return {
                  colors: {
                    currentPrice: '#10B981',
                    openPrice: '#6B7280',
                    sessionPrices: '#F59E0B'
                  },
                  fonts: {
                    currentPrice: 'bold 36px monospace',
                    priceLabels: '20px monospace'
                  }
                };
              } catch {
                return {};
              }
            })();
            const dayRangeConfig = createDayRangeConfig({ width, height }, width, height, () => defaultConfig);
            const adaptiveScale = calculateAdaptiveScale(data, dayRangeConfig);
            const priceScale = createPriceScale(dayRangeConfig, adaptiveScale, height);
            const axisX = width - 15; // ADR axis position

            // Render user price markers
            if (priceMarkers && priceMarkers.length > 0) {
              renderUserPriceMarkers(ctx, dayRangeConfig, axisX, priceScale, priceMarkers, selectedMarker, data);
            }

            // Render hover preview
            if (hoverPrice && interactionSystem) {
              renderHoverPreview(ctx, dayRangeConfig, axisX, priceScale, hoverPrice);
            }
          }
        } else {
          console.error('[DISPLAY_CANVAS] No renderer found');
          renderErrorMessage(ctx, 'Renderer not available', { width, height });
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

  $: if (ctx && (data || connectionStatus || showMarketProfile || priceMarkers || selectedMarker || hoverPrice)) {
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