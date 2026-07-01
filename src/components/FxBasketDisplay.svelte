<script>
  import { onMount, onDestroy } from 'svelte';
  import { displayActions, displayStore } from '../stores/displayStore.js';
  import { ConnectionManager } from '../lib/connectionManager.js';
  import { getWebSocketUrl } from '../lib/displayDataProcessor.js';
  import { getAllPairs } from '../lib/fxBasket/fxBasketCalculations.js';
  import { checkDataFreshness, refreshConnection } from '../lib/fxBasket/fxBasketConnection.js';
  import { createDebugAPI, exposeDebugAPI } from '../lib/fxBasket/fxBasketDebug.js';
  import { subscribeBasket, getBasketState, BasketState } from '../lib/fxBasket/fxBasketSubscription.js';
  import { renderFxBasket } from '../lib/fxBasket/fxBasketOrchestrator.js';
  import { themeStore } from '../stores/themeStore.js';
  import DisplayFrame from './displays/DisplayFrame.svelte';
  import DisplayHeader from './displays/DisplayHeader.svelte';

  const MAX_CANVAS_SETUP_RETRIES = 100;

  export let display;
  let connectionManager;
  let connectionStatus = 'disconnected';
  let basketData = null;
  let fxPairs = [];
  let unsubscribe = null;
  let unsubscribeStatus = null;
  let unsubscribeDailyReset = null;
  let freshnessCheckInterval;
  let resizeObserver;
  let ctx, canvas;
  let renderPending = false;

  $: currentDisplay = $displayStore.displays.get(display.id);

  // Repaint on workspace-theme change — canvas colors are resolved from
  // canvasTheme.js at paint time, so a toggle needs a fresh renderCanvas().
  $: if (ctx && canvas) { void $themeStore; renderCanvas(); }

  onMount(() => {
    connectionManager = ConnectionManager.getInstance(getWebSocketUrl());
    fxPairs = getAllPairs();

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

    // Auto-refresh basket on daily reset from backend
    unsubscribeDailyReset = connectionManager.addSystemSubscription((msg) => {
      if (msg.type === 'dailyReset') {
        console.log('[FxBasketDisplay] Daily reset received, refreshing basket');
        handleRefresh();
      }
    });
  });

  onDestroy(() => {
    if (freshnessCheckInterval) clearInterval(freshnessCheckInterval);
    if (unsubscribe) unsubscribe();
    if (resizeObserver) resizeObserver.disconnect();
    if (unsubscribeStatus) unsubscribeStatus();
    if (unsubscribeDailyReset) { unsubscribeDailyReset(); unsubscribeDailyReset = null; }
  });

  // interact.js drag/resize/snap — handed to <DisplayFrame>, which owns the setup.
  const interactCallbacks = {
    onDragMove: (e) => displayActions.updatePosition(display.id, { x: e.rect.left, y: e.rect.top }),
    onResizeMove: (e) => displayActions.updateSize(display.id, { width: e.rect.width, height: e.rect.height }),
    onTap: () => displayActions.bringToFront(display.id)
  };

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
    if (renderPending) return;
    renderPending = true;
    requestAnimationFrame(() => {
      renderPending = false;
      const rect = canvas.getBoundingClientRect();
      const dimensions = { width: rect.width, height: rect.height };
      const currentData = basketData || { _state: BasketState.FAILED, _progress: { received: 0, total: 30 } };
      renderFxBasket(ctx, currentData, {}, dimensions);
    });
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

  function handleClose() { displayActions.removeDisplay(display.id); }
  function handleFocus() {
    displayActions.setSelectedDisplay(display.id);
    displayActions.bringToFront(display.id);
  }
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

<DisplayFrame
  position={display.position}
  size={display.size}
  zIndex={display.zIndex}
  selected={$displayStore.selectedDisplayId === display.id}
  tabindex="0"
  role="application"
  ariaLabel="FX Basket display"
  dataId={display.id}
  onFocus={handleFocus}
  interactCallbacks={interactCallbacks}>
  <DisplayHeader
    slot="header"
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
</DisplayFrame>

<style>
  .fx-basket-canvas{width:100%;height:100%;display:block;background:var(--bg-app)}
</style>
