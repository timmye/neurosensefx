<script>
  import { onMount, onDestroy } from 'svelte';
  import interact from 'interactjs';
  import { workspaceActions, workspaceStore } from '../stores/workspace.js';
  import { ConnectionManager } from '../lib/connectionManager.js';
  import { processSymbolData, getWebSocketUrl, formatSymbol, processMarketProfileData } from '../lib/displayDataProcessor.js';
  import { buildInitialProfile, updateProfileWithTick } from '../lib/marketProfileProcessor.js';
  import { getBucketSizeForSymbol } from '../lib/displayDataProcessor.js';
  import DisplayHeader from './displays/DisplayHeader.svelte';
  import DisplayCanvas from './displays/DisplayCanvas.svelte';
  import PriceMarkerManager from './PriceMarkerManager.svelte';

  export let display;
  let element, interactable, connectionManager, canvasRef;
  let connectionStatus = 'disconnected', lastData = null, lastMarketProfileData = null;
  let canvasHeight = display.size.height - 40;
  let formattedSymbol = formatSymbol(display.symbol);
  let priceMarkers = [], selectedMarker = null;
  let hoverPrice = null;

  // Simple: Track current display from store for market profile boolean
  $: currentDisplay = $workspaceStore.displays.get(display.id);
  $: showMarketProfile = currentDisplay?.showMarketProfile || false;
  $: selectedMarker = currentDisplay?.selectedMarker || null;

  onMount(() => {
    connectionManager = new ConnectionManager(getWebSocketUrl());

    interactable = interact(element).draggable({
      onmove: (e) => workspaceActions.updatePosition(display.id, {x: e.rect.left, y: e.rect.top})
    }).resizable({
      edges: { right: true, bottom: true },
      listeners: {
        move (event) {
          const newSize = { width: event.rect.width, height: event.rect.height };
          workspaceActions.updateSize(display.id, newSize);
          canvasHeight = newSize.height - 40;
        }
      },
      modifiers: [interact.modifiers.restrictSize({ min: { width: 150, height: 80 } })],
      inertia: true
    }).on('tap', () => workspaceActions.bringToFront(display.id));

    connectionManager.connect();

    // Simple subscription: ConnectionManager handles the rest
    const unsubscribe = connectionManager.subscribeAndRequest(formattedSymbol, (data) => {
      try {
        // ALWAYS process regular symbol data first (Crystal Clarity: unified data flow)
        const result = processSymbolData(data, formattedSymbol, lastData);
        if (result?.type === 'data') {
          lastData = result.data;
        } else if (result?.type === 'error') {
          // Check if this is a connection status message, not a real error
          const errorMsg = result.message.toLowerCase();
          if (errorMsg.includes('disconnected') || errorMsg.includes('connecting') || errorMsg.includes('waiting') || errorMsg.includes('timeout')) {
            // Don't call renderError for connection status messages - let DisplayCanvas handle it via connectionStatus
          } else {
            canvasRef?.renderError(`BACKEND_ERROR: ${result.message}`);
          }
        }

        // Market profile specific processing (pre-process data even when toggled off)
        if (data.type === 'symbolDataPackage' && data.initialMarketProfile) {
          const bucketSize = getBucketSizeForSymbol(formattedSymbol);
          lastMarketProfileData = buildInitialProfile(data.initialMarketProfile, bucketSize);
        } else if (data.type === 'tick' && lastMarketProfileData) {
          lastMarketProfileData = updateProfileWithTick(lastMarketProfileData, data);
        }
      } catch (error) {
        console.error('[FLOATING_DISPLAY] Caught error in data processing:', error);
        canvasRef?.renderError(`JSON_PARSE_ERROR: ${error.message}`);
      }
    });

    connectionManager.onStatusChange = () => {
      connectionStatus = connectionManager.status;
      // Canvas will update reactively through the connectionStatus prop
    };
    connectionStatus = connectionManager.status;

    return () => {
      if (unsubscribe) unsubscribe();
    };
  });

  onDestroy(() => {
    interactable?.unset();
    connectionManager?.disconnect();
  });

  function handleClose() { workspaceActions.removeDisplay(display.id); }
  function handleFocus() { workspaceActions.bringToFront(display.id); }
  function handleKeydown(e) {
    if (e.altKey && e.key === 'm') {
      e.preventDefault();
      workspaceActions.toggleMarketProfile(display.id);
    }
  }
</script>

<div class="floating-display" bind:this={element} data-display-id={display.id}
     tabindex="0" role="application" aria-label="{display.symbol} display"
     on:focus={handleFocus}
     on:keydown={handleKeydown}
     style="left: {display.position.x}px; top: {display.position.y}px; z-index: {display.zIndex};
            width: {display.size.width}px; height: {display.size.height}px;">

  <DisplayHeader
    symbol={display.symbol}
    connectionStatus={connectionStatus}
    showMarketProfile={showMarketProfile}
    onClose={handleClose}
    onFocus={handleFocus}
  />

  <DisplayCanvas
    bind:this={canvasRef}
    data={lastData}
    marketProfileData={lastMarketProfileData}
    showMarketProfile={showMarketProfile}
    width={display.size.width}
    height={canvasHeight}
    connectionStatus={connectionStatus}
    symbol={formattedSymbol}
    priceMarkers={priceMarkers}
    selectedMarker={selectedMarker}
    hoverPrice={hoverPrice}
    onResize={() => {}}
  />

  <PriceMarkerManager
    {display}
    {lastData}
    {canvasRef}
    {formattedSymbol}
    bind:priceMarkers
    bind:selectedMarker
    bind:hoverPrice
  />

  <div class="resize-handle"></div>
</div>

<style>
  .floating-display{position:absolute;background:#1a1a1a;border:1px solid #333;border-radius:4px;overflow:hidden;user-select:none;outline:none;transition:border-color .2s ease,box-shadow .2s ease}
  .floating-display:focus,.floating-display.focused{border-color:#4a9eff;box-shadow:0 0 8px rgba(74,158,255,.4)}
  .floating-display:focus-visible{border-color:#4a9eff;box-shadow:0 0 12px rgba(74,158,255,.6);outline:2px solid rgba(74,158,255,.3);outline-offset:2px}
  .resize-handle{position:absolute;right:0;bottom:0;width:16px;height:16px;background:linear-gradient(135deg,transparent 50%,#555 50%);cursor:se-resize;opacity:.6;transition:opacity .2s ease}
  .resize-handle:hover{opacity:1}
</style>