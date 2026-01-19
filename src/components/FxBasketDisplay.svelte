<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import interact from 'interactjs';
  import { workspaceActions, workspaceStore } from '../stores/workspace.js';
  import { ConnectionManager } from '../lib/connectionManager.js';
  import { getWebSocketUrl } from '../lib/displayDataProcessor.js';
  import { getAllPairs } from '../lib/fxBasket/fxBasketCalculations.js';
  import { checkDataFreshness, refreshConnection } from '../lib/fxBasket/fxBasketConnection.js';
  import { createDebugAPI, exposeDebugAPI } from '../lib/fxBasket/fxBasketDebug.js';
  import { createStore } from '../lib/fxBasket/fxBasketStore.js';
  import { createStateMachine, BasketState } from '../lib/fxBasket/fxBasketStateMachine.js';
  import { createProcessorCallback } from '../lib/fxBasket/fxBasketProcessor.js';
  import { renderFxBasket } from '../lib/fxBasket/fxBasketOrchestrator.js';
  import DisplayHeader from './displays/DisplayHeader.svelte';

  export let display;
  let element, interactable, connectionManager;
  let connectionStatus = 'disconnected';
  let store, stateMachine;
  let basketData = null;
  let fxPairs = [];
  let unsubscribe = null;
  let freshnessCheckInterval;
  let resizeObserver;
  let ctx, canvas;
  let subscriptionsReady = false;
  let tickCount = 0;
  let dataPackageCount = 0;
  let lastTickTimes = new Map();
  let basketState = { lastUpdate: new Date().toISOString() };

  $: currentDisplay = $workspaceStore.displays.get(display.id);

  onMount(() => {
    connectionManager = ConnectionManager.getInstance(getWebSocketUrl());
    fxPairs = getAllPairs();
    store = createStore();
    stateMachine = createStateMachine(fxPairs, 45000); // 45s: 11s subscription + 25s coordinator + buffer

    setupInteract();
    startSubscriptions();
    setupDebugAPI();
    setupCanvas();
    setupConnectionMonitoring();

    // Connect immediately - subscriptions will be added as they're registered
    connectionManager.connect();
  });

  onDestroy(() => {
    interactable?.unset();
    connectionManager?.disconnect();
    if (freshnessCheckInterval) clearInterval(freshnessCheckInterval);
    if (unsubscribe) unsubscribe();
    if (resizeObserver) resizeObserver.disconnect();
  });

  function setupInteract() {
    const dragConfig = {
      modifiers: [interact.modifiers.snap({ targets: [interact.snappers.grid({ x: 10, y: 10, range: 15 })], relativePoints: [{ x: 0, y: 0 }] })],
      onmove: (e) => workspaceActions.updatePosition(display.id, { x: e.rect.left, y: e.rect.top })
    };
    const resizeConfig = {
      edges: { right: true, bottom: true },
      listeners: { move: (e) => workspaceActions.updateSize(display.id, { width: e.rect.width, height: e.rect.height }) },
      modifiers: [interact.modifiers.restrictSize({ min: { width: 150, height: 80 } }), interact.modifiers.snapSize({ targets: [interact.snappers.grid({ width: 10, height: 10, range: 15 })] })],
      inertia: true
    };
    interactable = interact(element).draggable(dragConfig).resizable(resizeConfig).on('tap', () => workspaceActions.bringToFront(display.id));
  }

  async function startSubscriptions() {
    console.log('[FX BASKET] Starting subscription to', fxPairs.length, 'FX pairs...');

    // Create processor callback - processes messages as they arrive
    const processorCallback = createProcessorCallback(store, stateMachine, handleBasketUpdate);

    // Wait for connection to be established
    await waitForConnection();

    // Simple subscription - process messages as they arrive (Crystal Clarity)
    const subscriptions = [];
    const REQUEST_DELAY_MS = 600; // Avoids cTrader rate limits (400ms was too fast)

    for (let i = 0; i < fxPairs.length; i++) {
      const pair = fxPairs[i];

      console.log(`[FX BASKET] Subscribing to ${pair} (${i+1}/${fxPairs.length})`);

      const unsub = connectionManager.subscribeAndRequest(
        pair,
        processorCallback,
        14, // adr
        'ctrader'
      );

      subscriptions.push(unsub);

      // Rate limiting: 400ms delay between subscriptions
      if (i < fxPairs.length - 1) {
        await sleep(REQUEST_DELAY_MS);
      }
    }

    console.log(`[FX BASKET] Subscriptions complete: ${subscriptions.length}`);
    subscriptionsReady = true;
    unsubscribe = () => subscriptions.forEach(unsub => unsub());
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function waitForConnection() {
    // Check BOTH status AND actual WebSocket readyState
    const isReady = connectionManager.status === 'connected'
      && connectionManager.ws?.readyState === WebSocket.OPEN;

    if (isReady) {
      console.log('[FX BASKET] Already connected and ready');
      return;
    }

    // Otherwise wait for connection with timeout
    console.log('[FX BASKET] Waiting for connection...');
    return new Promise(resolve => {
      let timeoutId;

      const unsubscribe = connectionManager.addStatusCallback(() => {
        const readyNow = connectionManager.status === 'connected'
          && connectionManager.ws?.readyState === WebSocket.OPEN;

        if (readyNow) {
          clearTimeout(timeoutId); // Clear timeout when connected
          unsubscribe();
          console.log('[FX BASKET] Connected and ready!');
          resolve();
        }
      });

      // Timeout after 10 seconds - proceed even if not connected
      // (allows tests to work without WebSocket server)
      timeoutId = setTimeout(() => {
        unsubscribe();
        console.warn('[FX BASKET] Connection timeout - proceeding anyway');
        resolve();
      }, 10000);
    });
  }

  function handleBasketUpdate(baskets) {
    basketData = baskets;
    renderCanvas();
  }

  function setupCanvas() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    // Handle case where canvas has no dimensions yet
    if (rect.width === 0 || rect.height === 0) {
      requestAnimationFrame(() => setupCanvas());
      return;
    }

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Set up ResizeObserver to handle resize events
    resizeObserver = new ResizeObserver(() => {
      const newRect = canvas.getBoundingClientRect();
      if (newRect.width > 0 && newRect.height > 0) {
        canvas.width = newRect.width * dpr;
        canvas.height = newRect.height * dpr;
        // Reset transform and re-apply scale (prevents accumulation)
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        renderCanvas();
      }
    });
    resizeObserver.observe(canvas);

    // Initial render
    renderCanvas();
  }

  function renderCanvas() {
    if (!ctx || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dimensions = { width: rect.width, height: rect.height };
    const currentData = basketData || { _state: stateMachine.state, _progress: stateMachine.getProgress?.() || { received: 0, total: 30 } };
    renderFxBasket(ctx, currentData, {}, dimensions);
  }

  function setupConnectionMonitoring() {
    const unsubscribeStatus = connectionManager.addStatusCallback(() => {
      connectionStatus = connectionManager.displayStatus;
    });
    connectionStatus = connectionManager.displayStatus;
    freshnessCheckInterval = setInterval(() => checkDataFreshness(connectionStatus, () => refreshConnection(connectionManager, connectionStatus)), 5000);
    return unsubscribeStatus;
  }

  function setupDebugAPI() {
    return exposeDebugAPI(createDebugAPI(() => ({
      store, stateMachine, basketData, connectionStatus, fxPairs, subscriptionsReady,
      basketState, lastTickTimes, tickCount, dataPackageCount
    })), typeof window !== 'undefined' ? window : null);
  }

  function handleClose() { workspaceActions.removeDisplay(display.id); }
  function handleFocus() { workspaceActions.bringToFront(display.id); }
  async function handleRefresh() {
    if (connectionManager) {
      if (unsubscribe) { unsubscribe(); unsubscribe = null; }
      stateMachine = createStateMachine(fxPairs, 45000); // 45s: 11s subscription + 25s coordinator + buffer
      basketData = null;
      startSubscriptions();
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
  .floating-display{position:absolute;background:#1a1a1a;border:1px solid #333;border-radius:4px;overflow:hidden;user-select:none;outline:none;transition:border-color .2s ease,box-shadow .2s ease}
  .floating-display:focus{border-color:#4a9eff;box-shadow:0 0 8px rgba(74,158,255,.4)}
  .floating-display:focus-visible{border-color:#4a9eff;box-shadow:0 0 12px rgba(74,158,255,.6);outline:2px solid rgba(74,158,255,.3);outline-offset:2px}
  .fx-basket-canvas{width:100%;height:100%;display:block;background:#0a0a0a}
  .resize-handle{position:absolute;right:0;bottom:0;width:16px;height:16px;background:linear-gradient(135deg,transparent 50%,#555 50%);cursor:se-resize;opacity:.6;transition:opacity .2s ease}
  .resize-handle:hover{opacity:1}
</style>
