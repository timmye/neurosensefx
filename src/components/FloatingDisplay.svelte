<script>
  import { onMount, onDestroy } from 'svelte';
  import { displayActions, displayStore } from '../stores/displayStore.js';
  import { ConnectionManager } from '../lib/connectionManager.js';
  import { getWebSocketUrl, formatSymbol } from '../lib/displayDataProcessor.js';
  import { keyManager } from '../lib/keyManager.js';
  import { getMarketDataStore, subscribeToSymbol, getConnectionStatus } from '../stores/marketDataStore.js';
  import { symbolStatusMessage } from '../lib/symbolStatusMessage.js';
  import DisplayFrame from './displays/DisplayFrame.svelte';
  import DisplayHeader from './displays/DisplayHeader.svelte';
  import DisplayCanvas from './displays/DisplayCanvas.svelte';
  import PriceMarkerManager from './PriceMarkerManager.svelte';

  export let display;
  let element, connectionManager, canvasRef;
  let lastMarketProfileData = null;
  let priceMarkers = [], selectedMarker = null, hoverPrice = null, deltaInfo = null;
  let unsubscribeSymbol;
  let previousSymbol = null;

  const handlers = {
    close: () => displayActions.removeDisplay(display.id),
    focus: () => {
      displayActions.setSelectedDisplay(display.id);
      displayActions.bringToFront(display.id);
    },
    refresh: () => {
      lastMarketProfileData = null;
      if (unsubscribeSymbol) {
        unsubscribeSymbol();
        unsubscribeSymbol = subscribeToSymbol(formattedSymbol, source, { adr: 14 });
      }
      canvasRef?.refreshCanvas?.();
    },
  };

  // interact.js drag/resize/snap — handed to <DisplayFrame>, which owns the setup.
  const interactCallbacks = {
    onDragMove: (e) => displayActions.updatePosition(display.id, { x: e.rect.left, y: e.rect.top }),
    onResizeMove: (event) => displayActions.updateSize(display.id, { width: event.rect.width, height: event.rect.height }),
    onTap: () => displayActions.bringToFront(display.id)
  };

  // Stable callback identities handed to child components. Inline arrows in the
  // markup (e.g. `bindElement={(n) => (element = n)}`) get a NEW identity on every
  // render → the child prop is invalidated every flush. Combined with Svelte's
  // safe_not_equal (which returns true even for identical object refs), an inline
  // arrow that writes a bound/element variable can self-reinforce into a
  // make_dirty cycle. Hoisting to a const kills the churn at the source.
  // (DisplayFrame also calls bindElement only from onMount, so the cycle is doubly
  // broken — this just removes the residual per-render invalidation.)
  const bindElementCb = (node) => { element = node; };
  const noopResize = () => {};

  // Compute source and formattedSymbol first (needed for store subscription)
  $: source = display.source || 'ctrader';
  $: formattedSymbol = formatSymbol(display.symbol, source);

  // Reactive store subscription
  $: marketData = getMarketDataStore(formattedSymbol);
  $: lastData = $marketData;
  $: connectionStatusStore = getConnectionStatus();
  $: status = $connectionStatusStore;

  $: if (lastData?.marketProfile && lastData.marketProfile !== lastMarketProfileData) {
    lastMarketProfileData = lastData.marketProfile;
  }

  $: ({ currentDisplay, showMarketProfile, selectedMarker, connectionStatus } =
    (() => {
      const d = $displayStore.displays.get(display.id) || {};
      const st = status?.status ?? 'disconnected';
      return {
        currentDisplay: d,
        showMarketProfile: d?.showMarketProfile || false,
        selectedMarker: d?.selectedMarker || null,
        connectionStatus: st
      };
    })()
  );

  // Per-symbol no-data status message (G2). Only resolved while there is no
  // price data; once data arrives this is null and normal rendering resumes.
  // When the socket itself is down the helper yields a disconnected message,
  // so this stays consistent with the global-disconnected path below.
  $: effectiveStatusMessage = symbolStatusMessage(lastData?.status, {
    hasData: lastData?.current != null,
    symbol: formattedSymbol,
    globalConnected: connectionStatus === 'connected'
  });

  $: if (formattedSymbol && formattedSymbol !== previousSymbol && previousSymbol !== null) {
    // Unsubscribe from old symbol
    unsubscribeSymbol?.();

    // Subscribe to new symbol
    unsubscribeSymbol = subscribeToSymbol(formattedSymbol, source, { adr: 14 });

    // Clear stale data
    lastMarketProfileData = null;

    previousSymbol = formattedSymbol;
  }

  let keyUnsubs = [];

  onMount(() => {
    connectionManager = ConnectionManager.getInstance(getWebSocketUrl());

    // Alt+M: toggle market profile (only when this display is focused)
    keyUnsubs.push(keyManager.register(
      { key: 'm', alt: true },
      (e) => {
        if (!element || !element.contains(document.activeElement)) return false;
        e.preventDefault();
        displayActions.toggleMarketProfile(display.id);
        return true;
      },
      { priority: 10 }
    ));

    // Initial subscription via store
    unsubscribeSymbol = subscribeToSymbol(formattedSymbol, source, { adr: 14 });
    previousSymbol = formattedSymbol;

    connectionManager.connect();

    return () => {
      unsubscribeSymbol?.();
    };
  });

  onDestroy(() => {
    keyUnsubs.forEach(fn => fn()); keyUnsubs = [];
  });
</script>

<DisplayFrame
  position={display.position}
  size={display.size}
  zIndex={display.zIndex}
  selected={$displayStore.selectedDisplayId === display.id}
  tabindex="0"
  role="region"
  ariaLabel="{display.symbol} display"
  dataId={display.id}
  onFocus={handlers.focus}
  interactCallbacks={interactCallbacks}
  bindElement={bindElementCb}>
  <DisplayHeader slot="header" symbol={display.symbol} {source} {connectionStatus} {showMarketProfile}
    onClose={handlers.close} onFocus={handlers.focus} onRefresh={handlers.refresh} initiallyVisible={display.showHeader !== false} />
  <DisplayCanvas bind:this={canvasRef} data={lastData} marketProfileData={lastMarketProfileData} {showMarketProfile}
    width={display.size.width} height={display.size.height} {connectionStatus} symbol={formattedSymbol}
    symbolStatusMessage={effectiveStatusMessage}
    priceMarkers={priceMarkers} {selectedMarker} hoverPrice={hoverPrice} deltaInfo={deltaInfo} onResize={noopResize} />
  <PriceMarkerManager {display} {lastData} {canvasRef} {formattedSymbol}
    bind:priceMarkers bind:selectedMarker bind:hoverPrice bind:deltaInfo />
</DisplayFrame>
