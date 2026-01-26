<script>
  import { onMount, onDestroy } from 'svelte';
  import { workspaceActions, workspaceStore } from '../stores/workspace.js';
  import { ConnectionManager } from '../lib/connectionManager.js';
  import { getWebSocketUrl, formatSymbol } from '../lib/displayDataProcessor.js';
  import { createInteractConfig } from '../lib/interactSetup.js';
  import { useWebSocketSub } from '../composables/useWebSocketSub.js';
  import { useDisplayState } from '../composables/useDisplayState.js';
  import { useDataCallback } from '../composables/useDataCallback.js';
  import DisplayHeader from './displays/DisplayHeader.svelte';
  import DisplayCanvas from './displays/DisplayCanvas.svelte';
  import PriceMarkerManager from './PriceMarkerManager.svelte';

  export let display;
  let element, interactable, connectionManager, canvasRef;
  let lastData = null, lastMarketProfileData = null;
  let priceMarkers = [], selectedMarker = null, hoverPrice = null, deltaInfo = null;
  let webSocketSub, displayState, handlers;
  const { createCallback } = useDataCallback();

  $: ({ currentDisplay, showMarketProfile, selectedMarker, source, formattedSymbol, connectionStatus, handlers } =
    (() => {
      const d = $workspaceStore.displays.get(display.id) || {};
      const st = displayState?.connectionStatus ?? 'disconnected';
      const src = display.source || 'ctrader';
      const fmt = formatSymbol(display.symbol);
      return {
        currentDisplay: d,
        showMarketProfile: d?.showMarketProfile || false,
        selectedMarker: d?.selectedMarker || null,
        source: src,
        formattedSymbol: fmt,
        connectionStatus: st,
        handlers: webSocketSub && ({
          close: () => workspaceActions.removeDisplay(display.id),
          focus: () => workspaceActions.bringToFront(display.id),
          refresh: () => { lastData = null; lastMarketProfileData = null; webSocketSub.refreshSubscription(fmt, src, 14); canvasRef?.refreshCanvas?.(); },
          keydown: (e) => e.altKey && e.key.toLowerCase() === 'm' && (e.preventDefault(), workspaceActions.toggleMarketProfile(display.id))
        })
      };
    })()
  );

  $: if (display.symbol && source && connectionManager && webSocketSub?.getCallback()) {
    const newSymbol = formatSymbol(display.symbol);
    const newSource = source;
    if (newSymbol !== formattedSymbol || newSource !== source) {
      console.log(`[SYMBOL_CHANGE] ${formattedSymbol}:${source} -> ${newSymbol}:${newSource}`);
      lastData = null; lastMarketProfileData = null;
      webSocketSub.unsubscribeCurrent();
      webSocketSub.subscribe(newSymbol, newSource, webSocketSub.getCallback(), 14);
    }
  }

  onMount(() => {
    connectionManager = ConnectionManager.getInstance(getWebSocketUrl());
    webSocketSub = useWebSocketSub(connectionManager);
    displayState = useDisplayState(connectionManager);

    const lastDataRef = { value: null }, lastProfileRef = { value: null };
    const dataCallback = createCallback(formattedSymbol, lastDataRef, lastProfileRef, canvasRef);

    webSocketSub.subscribe(formattedSymbol, source, (data) => {
      dataCallback(data);
      lastData = lastDataRef.value;
      lastMarketProfileData = lastProfileRef.value;
    }, 14);

    interactable = createInteractConfig(element, {
      onDragMove: (e) => workspaceActions.updatePosition(display.id, { x: e.rect.left, y: e.rect.top }),
      onResizeMove: (event) => workspaceActions.updateSize(display.id, { width: event.rect.width, height: event.rect.height }),
      onTap: () => workspaceActions.bringToFront(display.id)
    });

    const unsubscribeStatus = displayState.addStatusCallback(() => displayState.updateStatus());
    displayState.updateStatus();
    connectionManager.connect();
    displayState.startFreshnessCheck(() => displayState.refreshIfNeeded());

    return () => { webSocketSub.unsubscribeCurrent(); unsubscribeStatus?.(); displayState.stopFreshnessCheck(); };
  });

  onDestroy(() => { interactable?.unset(); connectionManager?.disconnect(); });
</script>

<div class="floating-display" bind:this={element} data-display-id={display.id}
     tabindex="0" role="region" aria-label="{display.symbol} display"
     on:focus={handlers?.focus} on:keydown={handlers?.keydown}
     style="left: {display.position.x}px; top: {display.position.y}px; z-index: {display.zIndex};
            width: {display.size.width}px; height: {display.size.height}px;">
  <DisplayHeader symbol={display.symbol} {source} {connectionStatus} {showMarketProfile}
    onClose={handlers?.close} onFocus={handlers?.focus} onRefresh={handlers?.refresh} initiallyVisible={display.showHeader !== false} />
  <DisplayCanvas bind:this={canvasRef} data={lastData} marketProfileData={lastMarketProfileData} {showMarketProfile}
    width={display.size.width} height={display.size.height} {connectionStatus} symbol={formattedSymbol}
    priceMarkers={priceMarkers} {selectedMarker} hoverPrice={hoverPrice} deltaInfo={deltaInfo} onResize={() => {}} />
  <PriceMarkerManager {display} {lastData} {canvasRef} {formattedSymbol}
    bind:priceMarkers bind:selectedMarker bind:hoverPrice bind:deltaInfo />
  <div class="resize-handle"></div>
</div>

<style>
  .floating-display{position:absolute;background:#1a1a1a;border:1px solid #333;border-radius:4px;overflow:hidden;user-select:none;outline:none;transition:border-color .2s ease,box-shadow .2s ease}
  .floating-display:focus{border-color:#4a9eff;box-shadow:0 0 8px rgba(74,158,255,.4)}
  .floating-display:focus-visible{border-color:#4a9eff;box-shadow:0 0 12px rgba(74,158,255,.6);outline:2px solid rgba(74,158,255,.3);outline-offset:2px}
  .resize-handle{position:absolute;right:0;bottom:0;width:16px;height:16px;background:linear-gradient(135deg,transparent 50%,#555 50%);cursor:se-resize;opacity:.6;transition:opacity .2s ease}
  .resize-handle:hover{opacity:1}
</style>
