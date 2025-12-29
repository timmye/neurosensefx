<script>
  import { onMount, onDestroy } from 'svelte';
  import interact from 'interactjs';
  import { workspaceActions, workspaceStore } from '../stores/workspace.js';
  import { ConnectionManager } from '../lib/connectionManager.js';
  import { processSymbolData, getWebSocketUrl, formatSymbol } from '../lib/displayDataProcessor.js';
  import { buildInitialProfile, updateProfileWithTick } from '../lib/marketProfileProcessor.js';
  import { getBucketSizeForSymbol } from '../lib/displayDataProcessor.js';
  import { marketProfileConfig } from '../lib/marketProfileConfig.js';
  import DisplayHeader from './displays/DisplayHeader.svelte';
  import DisplayCanvas from './displays/DisplayCanvas.svelte';
  import PriceMarkerManager from './PriceMarkerManager.svelte';
  export let display;
  let element, interactable, connectionManager, canvasRef;
  let connectionStatus = 'disconnected', lastData = null, lastMarketProfileData = null;
  let formattedSymbol = formatSymbol(display.symbol);
  let source = display.source || 'ctrader';
  let priceMarkers = [], selectedMarker = null;
  let hoverPrice = null;
  let deltaInfo = null;
  let freshnessCheckInterval;
  $: currentDisplay = $workspaceStore.displays.get(display.id);
  $: showMarketProfile = currentDisplay?.showMarketProfile || false;
  $: selectedMarker = currentDisplay?.selectedMarker || null;
  onMount(() => {
  connectionManager = ConnectionManager.getInstance(getWebSocketUrl());
    interactable = interact(element)
      .draggable({
        onmove: (e) => workspaceActions.updatePosition(display.id, {x: e.rect.left, y: e.rect.top})
      })
      .resizable({
        edges: { right: true, bottom: true },
        listeners: { move (event) {
          workspaceActions.updateSize(display.id, {
            width: event.rect.width,
            height: event.rect.height
          });
        }},
        modifiers: [interact.modifiers.restrictSize({ min: { width: 150, height: 80 } })],
        inertia: true
      })
      .on('tap', () => workspaceActions.bringToFront(display.id));
    connectionManager.connect();
    const unsubscribe = connectionManager.subscribeAndRequest(formattedSymbol, (data) => {
      try {
        const result = processSymbolData(data, formattedSymbol, lastData);
        if (result?.type === 'data') {
          lastData = result.data;
        } else if (result?.type === 'error' && !isConnectionRelated(result.message)) {
          canvasRef?.renderError(`BACKEND_ERROR: ${result.message}`);
        }
        if (data.type === 'symbolDataPackage' && data.initialMarketProfile) {
          const bucketSize = getBucketSizeForSymbol(formattedSymbol, data, marketProfileConfig.bucketMode);
          lastMarketProfileData = buildInitialProfile(data.initialMarketProfile, bucketSize, data);
        } else if (data.type === 'tick' && lastMarketProfileData) {
          lastMarketProfileData = updateProfileWithTick(lastMarketProfileData, data);
        }
      } catch (error) {
        canvasRef?.renderError(`JSON_PARSE_ERROR: ${error.message}`);
      }
    }, 14, source);
    function isConnectionRelated(message) {
      const msg = message.toLowerCase();
      return ['disconnected', 'connecting', 'waiting', 'timeout', 'invalid symbol', 'backend not ready']
        .some(term => msg.includes(term));
    }
    const unsubscribeStatus = connectionManager.addStatusCallback(() => {
      connectionStatus = connectionManager.status;
    });
    connectionStatus = connectionManager.status;
    freshnessCheckInterval = setInterval(checkDataFreshness, 5000);
    return () => {
      if (unsubscribe) unsubscribe();
      if (unsubscribeStatus) unsubscribeStatus();
      if (freshnessCheckInterval) clearInterval(freshnessCheckInterval);
    };
  });
  onDestroy(() => {
    interactable?.unset();
    connectionManager?.disconnect();
  });
  function handleClose() { workspaceActions.removeDisplay(display.id); }
  function handleFocus() { workspaceActions.bringToFront(display.id); }
  function handleRefresh() {
    if (canvasRef?.refreshCanvas) canvasRef.refreshCanvas();
    if (connectionStatus === 'connected') {
      connectionManager.resubscribeSymbol(formattedSymbol);
    } else if (connectionStatus === 'disconnected') {
      refreshConnection();
    }
  }
  function checkDataFreshness() {
    if (connectionStatus === 'disconnected') refreshConnection();
  }
  function refreshConnection() {
    if (connectionManager && connectionStatus !== 'connected') {
      connectionManager.connect();
    }
  }
  function handleKeydown(e) {
    if (e.altKey && e.key.toLowerCase() === 'm') {
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
    {source}
    connectionStatus={connectionStatus}
    showMarketProfile={showMarketProfile}
    onClose={handleClose}
    onFocus={handleFocus}
    onRefresh={handleRefresh}
    initiallyVisible={display.showHeader !== false}
  />
  <DisplayCanvas
    bind:this={canvasRef}
    data={lastData}
    marketProfileData={lastMarketProfileData}
    showMarketProfile={showMarketProfile}
    width={display.size.width}
    height={display.size.height}
    connectionStatus={connectionStatus}
    symbol={formattedSymbol}
    priceMarkers={priceMarkers}
    selectedMarker={selectedMarker}
    hoverPrice={hoverPrice}
    {deltaInfo}
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
    bind:deltaInfo
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