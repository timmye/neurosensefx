<script>
  import { onMount, onDestroy } from 'svelte';
  import { workspaceActions, workspaceStore } from '../stores/workspace.js';
  import { ConnectionManager } from '../lib/connectionManager.js';
  import { getWebSocketUrl, formatSymbol } from '../lib/displayDataProcessor.js';
  import { createInteractConfig } from '../lib/interactSetup.js';
  import { getMarketDataStore, subscribeToSymbol, getConnectionStatus } from '../stores/marketDataStore.js';
  import DisplayHeader from './displays/DisplayHeader.svelte';
  import DisplayCanvas from './displays/DisplayCanvas.svelte';
  import PriceMarkerManager from './PriceMarkerManager.svelte';

  export let display;
  let element, interactable, connectionManager, canvasRef;
  let lastMarketProfileData = null;
  let priceMarkers = [], selectedMarker = null, hoverPrice = null, deltaInfo = null;
  let unsubscribeSymbol;
  let previousSymbol = null;

  // Flash state
  let borderFlashClass = '';
  let flashTimeout = null;
  let lastTrackedPrice = null;

  // Flash configuration
  const flashDuration = 500; // ms

  // Compute source and formattedSymbol first (needed for store subscription)
  $: source = display.source || 'ctrader';
  $: formattedSymbol = formatSymbol(display.symbol);

  // Reactive store subscription
  $: marketData = getMarketDataStore(formattedSymbol);
  $: lastData = $marketData;
  $: connectionStatusStore = getConnectionStatus();
  $: status = $connectionStatusStore;

  $: ({ currentDisplay, showMarketProfile, selectedMarker, connectionStatus, handlers } =
    (() => {
      const d = $workspaceStore.displays.get(display.id) || {};
      const st = status?.status ?? 'disconnected';
      return {
        currentDisplay: d,
        showMarketProfile: d?.showMarketProfile || false,
        selectedMarker: d?.selectedMarker || null,
        connectionStatus: st,
        handlers: {
          close: () => workspaceActions.removeDisplay(display.id),
          focus: () => workspaceActions.bringToFront(display.id),
          refresh: () => {
            lastMarketProfileData = null;
            if (unsubscribeSymbol) {
              unsubscribeSymbol();
              unsubscribeSymbol = subscribeToSymbol(formattedSymbol, source, { adr: 14 });
            }
            canvasRef?.refreshCanvas?.();
          },
          keydown: (e) => e.altKey && e.key.toLowerCase() === 'm' && (e.preventDefault(), workspaceActions.toggleMarketProfile(display.id))
        }
      };
    })()
  );

  // Track price changes for border flash
  $: if (lastData?.current && lastTrackedPrice !== null && lastData.current !== lastTrackedPrice) {
    const isUp = lastData.current > lastTrackedPrice;
    const direction = isUp ? 'up' : 'down';

    if (flashTimeout) clearTimeout(flashTimeout);

    borderFlashClass = `flash-${direction}`;

    flashTimeout = setTimeout(() => {
      borderFlashClass = '';
    }, flashDuration);

    lastTrackedPrice = lastData.current;
  }

  $: if (formattedSymbol && formattedSymbol !== previousSymbol && previousSymbol !== null) {
    // Unsubscribe from old symbol
    unsubscribeSymbol?.();

    // Subscribe to new symbol
    unsubscribeSymbol = subscribeToSymbol(formattedSymbol, source, { adr: 14 });

    // Clear stale data
    lastMarketProfileData = null;

    previousSymbol = formattedSymbol;
  }

  onMount(() => {
    connectionManager = ConnectionManager.getInstance(getWebSocketUrl());

    // Initial subscription via store
    unsubscribeSymbol = subscribeToSymbol(formattedSymbol, source, { adr: 14 });
    previousSymbol = formattedSymbol;

    interactable = createInteractConfig(element, {
      onDragMove: (e) => workspaceActions.updatePosition(display.id, { x: e.rect.left, y: e.rect.top }),
      onResizeMove: (event) => workspaceActions.updateSize(display.id, { width: event.rect.width, height: event.rect.height }),
      onTap: () => workspaceActions.bringToFront(display.id)
    });

    connectionManager.connect();

    return () => {
      unsubscribeSymbol?.();
    };
  });

  onDestroy(() => {
    if (flashTimeout) clearTimeout(flashTimeout);
    interactable?.unset();
    connectionManager?.disconnect();
  });
</script>

<div class="floating-display" bind:this={element} data-display-id={display.id}
     class:flash-up={borderFlashClass === 'flash-up'}
     class:flash-down={borderFlashClass === 'flash-down'}
     tabindex="0" role="region" aria-label="{display.symbol} display"
     on:focus={handlers?.focus} on:keydown={handlers?.keydown}
     style="left: {display.position.x}px; top: {display.position.y}px; z-index: {display.zIndex};
            width: {display.size.width}px; height: {display.size.height}px; --flash-duration: {flashDuration}ms;">
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
  .floating-display{position:absolute;background:#1a1a1a;border:1px solid #333;border-radius:4px;overflow:hidden;user-select:none;outline:none;transition:border-color .2s ease,box-shadow .2s ease;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  .floating-display:focus{border-color:#4a9eff;box-shadow:0 0 8px rgba(74,158,255,.4)}
  .floating-display:focus-visible{border-color:#4a9eff;box-shadow:0 0 12px rgba(74,158,255,.6);outline:2px solid rgba(74,158,255,.3);outline-offset:2px}
  .resize-handle{position:absolute;right:0;bottom:0;width:16px;height:16px;background:linear-gradient(135deg,transparent 50%,#555 50%);cursor:se-resize;opacity:.6;transition:opacity .2s ease}
  .resize-handle:hover{opacity:1}

  /* Border flash - only when not focused to avoid overriding focus outline */
  .floating-display:not(:focus) {
    transition: border-color var(--flash-duration, 500ms) ease-out;
  }

  .floating-display:not(:focus).flash-up {
    border-color: #00d4ff;
  }

  .floating-display:not(:focus).flash-down {
    border-color: #e040fb;
  }

  /* Respect user's motion preferences */
  @media (prefers-reduced-motion: reduce) {
    .floating-display:not(:focus).flash-up,
    .floating-display:not(:focus).flash-down {
      transition: none;
    }
  }
</style>
