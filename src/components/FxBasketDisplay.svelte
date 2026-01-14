<script>
  import { onMount, onDestroy } from 'svelte';
  import interact from 'interactjs';
  import { workspaceActions, workspaceStore } from '../stores/workspace.js';
  import { ConnectionManager } from '../lib/connectionManager.js';
  import { getWebSocketUrl } from '../lib/displayDataProcessor.js';
  import { getAllPairs, initializeState, updateAllBaskets } from '../lib/fxBasket/fxBasketData.js';
  import { batchSubscribe } from '../lib/fxBasket/fxBasketSubscription.js';
  import { checkDataFreshness, refreshConnection } from '../lib/fxBasket/fxBasketConnection.js';
  import { createDataCallback } from '../lib/fxBasket/fxBasketDataProcessor.js';
  import { createDebugAPI, exposeDebugAPI } from '../lib/fxBasket/fxBasketDebug.js';
  import DisplayHeader from './displays/DisplayHeader.svelte';
  import DisplayCanvas from './displays/DisplayCanvas.svelte';

  export let display;
  let element, interactable, connectionManager, canvasRef;
  let connectionStatus = 'disconnected';
  let basketState = null;
  let fxPairs = [];
  let unsubscribe = null;
  let freshnessCheckInterval;
  let subscriptionsReady = false;

  $: currentDisplay = $workspaceStore.displays.get(display.id);

  onMount(() => {
    connectionManager = ConnectionManager.getInstance(getWebSocketUrl());
    fxPairs = getAllPairs();
    basketState = initializeState(new Date());
    const dataCallback = createDataCallback(basketState, fxPairs, () => subscriptionsReady, canvasRef);

    setupInteract();
    startSubscriptions(dataCallback);
    setupDebugAPI();
    setupConnectionMonitoring();
    setupCleanup();

    connectionManager.connect();
  });

  onDestroy(() => {
    interactable?.unset();
    connectionManager?.disconnect();
  });

  function setupInteract() {
    interactable = interact(element)
      .draggable({
        modifiers: [interact.modifiers.snap({ targets: [interact.snappers.grid({ x: 10, y: 10, range: 15 })], relativePoints: [{ x: 0, y: 0 }] })],
        onmove: (e) => workspaceActions.updatePosition(display.id, { x: e.rect.left, y: e.rect.top })
      })
      .resizable({
        edges: { right: true, bottom: true },
        listeners: { move: (e) => workspaceActions.updateSize(display.id, { width: e.rect.width, height: e.rect.height }) },
        modifiers: [
          interact.modifiers.restrictSize({ min: { width: 150, height: 80 } }),
          interact.modifiers.snapSize({ targets: [interact.snappers.grid({ width: 10, height: 10, range: 15 })] })
        ],
        inertia: true
      })
      .on('tap', () => workspaceActions.bringToFront(display.id));
  }

  function startSubscriptions(dataCallback) {
    console.log('[FX BASKET] Starting subscription to', fxPairs.length, 'FX pairs...');

    const fallbackTimeout = setTimeout(() => {
      if (!subscriptionsReady) {
        console.log('[FX BASKET] Timeout fallback: marking subscriptions ready');
        subscriptionsReady = true;
      }
    }, 12000);

    batchSubscribe(connectionManager, fxPairs, dataCallback).then(subscriptions => {
      console.log('[FX BASKET] Subscriptions complete:', subscriptions.length);
      clearTimeout(fallbackTimeout);
      unsubscribe = () => subscriptions.forEach(unsub => unsub());
      subscriptionsReady = true;
    }).catch(err => {
      console.error('[FX BASKET] Subscription failed:', err);
      clearTimeout(fallbackTimeout);
      subscriptionsReady = true;
    });
  }

  function setupConnectionMonitoring() {
    const unsubscribeStatus = connectionManager.addStatusCallback(() => {
      connectionStatus = connectionManager.status;
    });
    connectionStatus = connectionManager.status;
    freshnessCheckInterval = setInterval(() => checkDataFreshness(connectionStatus, () => refreshConnection(connectionManager, connectionStatus)), 5000);
    return unsubscribeStatus;
  }

  function setupDebugAPI() {
    return exposeDebugAPI(createDebugAPI(() => ({
      basketState, fxPairs, connectionStatus, subscriptionsReady
    })), typeof window !== 'undefined' ? window : null);
  }

  function setupCleanup() {
    return () => {
      if (unsubscribe) unsubscribe();
      if (freshnessCheckInterval) clearInterval(freshnessCheckInterval);
    };
  }

  function handleClose() { workspaceActions.removeDisplay(display.id); }
  function handleFocus() { workspaceActions.bringToFront(display.id); }
  async function handleRefresh() {
    if (connectionManager && basketState) {
      if (unsubscribe) { unsubscribe(); unsubscribe = null; }
      subscriptionsReady = false;
      basketState = initializeState(new Date());
      const dataCallback = createDataCallback(basketState, fxPairs, () => subscriptionsReady, canvasRef);
      const subscriptions = await batchSubscribe(connectionManager, fxPairs, dataCallback);
      unsubscribe = () => subscriptions.forEach(unsub => unsub());
      subscriptionsReady = true;
    }
    if (canvasRef?.refreshCanvas) canvasRef.refreshCanvas();
  }
</script>

<div class="floating-display" bind:this={element} data-display-id={display.id}
     tabindex="0" role="application" aria-label="FX Basket display"
     on:focus={handleFocus}
     style="left: {display.position.x}px; top: {display.position.y}px; z-index: {display.zIndex};
            width: {display.size.width}px; height: {display.size.height}px;">
  <DisplayHeader
    symbol="FX BASKET"
    source="ctrader"
    connectionStatus={connectionStatus}
    showMarketProfile={false}
    onClose={handleClose}
    onFocus={handleFocus}
    onRefresh={handleRefresh}
    initiallyVisible={display.showHeader !== false}
  />
  <DisplayCanvas
    bind:this={canvasRef}
    data={basketState?.baskets}
    marketProfileData={null}
    showMarketProfile={false}
    width={display.size.width}
    height={display.size.height}
    connectionStatus={connectionStatus}
    symbol="FX_BASKET"
    priceMarkers={[]}
    selectedMarker={null}
    hoverPrice={null}
    deltaInfo={null}
    onResize={() => {}}
  />
  <div class="resize-handle"></div>
</div>

<style>
  .floating-display{position:absolute;background:#1a1a1a;border:1px solid #333;border-radius:4px;overflow:hidden;user-select:none;outline:none;transition:border-color .2s ease,box-shadow .2s ease}
  .floating-display:focus{border-color:#4a9eff;box-shadow:0 0 8px rgba(74,158,255,.4)}
  .floating-display:focus-visible{border-color:#4a9eff;box-shadow:0 0 12px rgba(74,158,255,.6);outline:2px solid rgba(74,158,255,.3);outline-offset:2px}
  .resize-handle{position:absolute;right:0;bottom:0;width:16px;height:16px;background:linear-gradient(135deg,transparent 50%,#555 50%);cursor:se-resize;opacity:.6;transition:opacity .2s ease}
  .resize-handle:hover{opacity:1}
</style>
