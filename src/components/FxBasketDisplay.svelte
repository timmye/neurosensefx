<script>
  import { onMount, onDestroy } from 'svelte';
  import { createInteractConfig } from '../lib/interactSetup.js';
  import { workspaceActions, workspaceStore } from '../stores/workspace.js';
  import { ConnectionManager } from '../lib/connectionManager.js';
  import { getWebSocketUrl } from '../lib/displayDataProcessor.js';
  import { getAllPairs } from '../lib/fxBasket/fxBasketCalculations.js';
  import { checkDataFreshness, refreshConnection } from '../lib/fxBasket/fxBasketConnection.js';
  import { createDebugAPI, exposeDebugAPI } from '../lib/fxBasket/fxBasketDebug.js';
  import { subscribeBasket, getBasketState, BasketState } from '../lib/fxBasket/fxBasketSubscription.js';
  import { renderFxBasket } from '../lib/fxBasket/fxBasketOrchestrator.js';
  import DisplayHeader from './displays/DisplayHeader.svelte';

  const MAX_CANVAS_SETUP_RETRIES = 100;

  export let display;
  let element, interactable, connectionManager;
  let connectionStatus = 'disconnected';
  let basketData = null;
  let fxPairs = [];
  let unsubscribe = null;
  let unsubscribeStatus = null;
  let freshnessCheckInterval;
  let resizeObserver;
  let ctx, canvas;

  $: currentDisplay = $workspaceStore.displays.get(display.id);

  onMount(() => {
    connectionManager = ConnectionManager.getInstance(getWebSocketUrl());
    fxPairs = getAllPairs();

    setupInteract();
    setupCanvas();
    setupConnectionMonitoring();
    if (import.meta.env.DEV) {
      setupDebugAPI();
    }

    // Subscribe via centralized store
    unsubscribe = subscribeBasket(fxPairs, (data) => {
      basketData = data;
      renderCanvas();
    }, 30000);

    connectionManager.connect();
  });

  onDestroy(() => {
    interactable?.unset();
    if (freshnessCheckInterval) clearInterval(freshnessCheckInterval);
    if (unsubscribe) unsubscribe();
    if (resizeObserver) resizeObserver.disconnect();
    if (unsubscribeStatus) unsubscribeStatus();
  });

  function setupInteract() {
    interactable = createInteractConfig(element, {
      onDragMove: (e) => workspaceActions.updatePosition(display.id, { x: e.rect.left, y: e.rect.top }),
      onResizeMove: (e) => workspaceActions.updateSize(display.id, { width: e.rect.width, height: e.rect.height }),
      onTap: () => workspaceActions.bringToFront(display.id)
    });
  }

  function finishSetup(rect) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Set up ResizeObserver to handle resize events
    resizeObserver = new ResizeObserver(() => {
      const freshDpr = window.devicePixelRatio || 1;
      const newRect = canvas.getBoundingClientRect();
      if (newRect.width > 0 && newRect.height > 0) {
        canvas.width = newRect.width * freshDpr;
        canvas.height = newRect.height * freshDpr;
        ctx.setTransform(freshDpr, 0, 0, freshDpr, 0, 0);
        renderCanvas();
      }
    });
    resizeObserver.observe(canvas);

    renderCanvas();
  }

  function setupCanvas() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) {
      let retries = 0;
      const retry = () => {
        const currentRect = canvas.getBoundingClientRect();
        if (currentRect.width > 0 && currentRect.height > 0) {
          finishSetup(currentRect);
        } else if (retries < MAX_CANVAS_SETUP_RETRIES) {
          retries++;
          requestAnimationFrame(retry);
        } else if (import.meta.env.DEV) {
          console.warn('[FxBasketDisplay] Canvas setup gave up after', MAX_CANVAS_SETUP_RETRIES, 'retries');
        }
      };
      requestAnimationFrame(retry);
      return;
    }

    finishSetup(rect);
  }

  function renderCanvas() {
    if (!ctx || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dimensions = { width: rect.width, height: rect.height };
    const currentData = basketData || { _state: BasketState.FAILED, _progress: { received: 0, total: 30 } };
    renderFxBasket(ctx, currentData, {}, dimensions);
  }

  function setupConnectionMonitoring() {
    unsubscribeStatus = connectionManager.addStatusCallback(() => {
      connectionStatus = connectionManager.status;
    });
    connectionStatus = connectionManager.status;
    freshnessCheckInterval = setInterval(() => checkDataFreshness(connectionStatus, () => refreshConnection(connectionManager, connectionStatus)), 5000);
  }

  function setupDebugAPI() {
    return exposeDebugAPI(createDebugAPI(() => ({
      basketData,
      connectionStatus,
      fxPairs,
      subscriptionsReady: true,
      basketState: getBasketState(),
      getMissingPairs: () => getBasketState()?.missingPairs || [],
      getFailedPairs: () => getBasketState()?.failedPairs || []
    })), typeof window !== 'undefined' ? window : null);
  }

  function handleClose() { workspaceActions.removeDisplay(display.id); }
  function handleFocus() { workspaceActions.bringToFront(display.id); }
  async function handleRefresh() {
    if (connectionManager) {
      if (unsubscribe) { unsubscribe(); }
      basketData = null;
      unsubscribe = subscribeBasket(fxPairs, (data) => {
        basketData = data;
        renderCanvas();
      }, 30000);
    }
    renderCanvas();
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
  <canvas bind:this={canvas} class="fx-basket-canvas"></canvas>
  <div class="resize-handle"></div>
</div>

<style>
  .floating-display{position:absolute;background:#1a1a1a;border:1px solid #333;border-radius:4px;overflow:hidden;user-select:none;outline:none;transition:border-color .2s ease,box-shadow .2s ease;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  .floating-display:focus{border-color:#4a9eff;box-shadow:0 0 8px rgba(74,158,255,.4)}
  .floating-display:focus-visible{border-color:#4a9eff;box-shadow:0 0 12px rgba(74,158,255,.6);outline:2px solid rgba(74,158,255,.3);outline-offset:2px}
  .fx-basket-canvas{width:100%;height:100%;display:block;background:#0a0a0a}
  .resize-handle{position:absolute;right:0;bottom:0;width:16px;height:16px;background:linear-gradient(135deg,transparent 50%,#555 50%);cursor:se-resize;opacity:.6;transition:opacity .2s ease}
  .resize-handle:hover{opacity:1}
</style>
