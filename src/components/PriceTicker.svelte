<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { workspaceStore, workspaceActions } from '../stores/workspace.js';
  import { ConnectionManager } from '../lib/connectionManager.js';
  import { getWebSocketUrl, formatSymbol } from '../lib/displayDataProcessor.js';
  import { getMarketDataStore, subscribeToSymbol } from '../stores/marketDataStore.js';
  import { calculateDayRangePercentage } from '../lib/dayRangeCalculations.js';
  import { formatPrice, formatPriceToPip, getPipetteDigit, splitByPipPosition } from '../lib/priceFormat.js';
  import { renderMiniMarketProfile } from '../lib/marketProfile/orchestrator.js';
  import { createInteractConfig } from '../lib/interactSetup.js';

  export let ticker;

  // Flash configuration props
  export let flashPriceEnabled = false;
  export let flashBorderEnabled = true;
  export let flashDuration = 500; // ms

  let element;
  let interactable;
  let connectionManager;
  let canvasRef;
  let lastMarketProfileData = null;
  let lastTrackedPrice = null;
  let flashTimeout = null;
  let resizeObserver = null;
  let unsubscribeSymbol;
  let previousSymbol = null;

  // Flash state
  let priceFlashClass = '';
  let borderFlashClass = '';

  // Reactive display values (auto-update when lastData changes)
  // Reactive store subscription - store reference changes when symbol changes
  $: marketData = getMarketDataStore(formattedSymbol);
  $: lastData = $marketData;

  $: currentPrice = lastData?.current ?? null;
  $: highPrice = lastData?.high ?? null;
  $: lowPrice = lastData?.low ?? null;
  $: openPrice = lastData?.open ?? null;
  $: rangePercent = calculateDayRangePercentage(lastData);
  $: direction = lastData?.direction ?? 'neutral';
  $: pipPosition = lastData?.pipPosition ?? 4;

  // Split price into larger digits (smaller font) and pip digits (normal font)
  $: priceParts = currentPrice ? splitByPipPosition(formatPriceToPip(currentPrice, pipPosition), pipPosition) : null;

  // Calculate daily change percentage
  $: dailyChangePercent = currentPrice && openPrice
    ? (((currentPrice - openPrice) / openPrice) * 100).toFixed(2)
    : null;

  $: dailyChangeClass = dailyChangePercent > 0 ? 'positive' : dailyChangePercent < 0 ? 'negative' : '';

  // Flash on price change
  $: if (currentPrice !== null && currentPrice !== lastTrackedPrice) {
    if (lastTrackedPrice !== null && (flashPriceEnabled || flashBorderEnabled)) {
      const isUp = currentPrice > lastTrackedPrice;
      const direction = isUp ? 'up' : 'down';

      // Clear any existing timeout
      if (flashTimeout) clearTimeout(flashTimeout);

      if (flashPriceEnabled) {
        priceFlashClass = `flash-${direction}`;
      }
      if (flashBorderEnabled) {
        borderFlashClass = `flash-${direction}`;
      }

      // Wait for DOM update, then schedule removal
      tick().then(() => {
        flashTimeout = setTimeout(() => {
          priceFlashClass = '';
          borderFlashClass = '';
        }, flashDuration);
      });
    }
    lastTrackedPrice = currentPrice;
  }

  // Reactive: formattedSymbol must update when ticker.symbol changes
  $: formattedSymbol = formatSymbol(ticker.symbol);

  // Function to re-render market profile (called on zoom/resize)
  function renderMarketProfile() {
    if (canvasRef && lastMarketProfileData) {
      renderMiniMarketProfile(canvasRef, lastMarketProfileData, {
        width: 37.5,
        height: 80,
        pipPosition: pipPosition,
        currentPrice,
        openPrice
      });
    }
  }

  // Reactive: render market profile whenever data, canvas, or prices change
  // Depends on currentPrice, openPrice, pipPosition which are derived from lastData
  $: if (currentPrice !== null && canvasRef && lastMarketProfileData) {
    try {
      renderMiniMarketProfile(canvasRef, lastMarketProfileData, {
        width: 37.5,
        height: 80,
        pipPosition: pipPosition,
        currentPrice,
        openPrice
      });
    } catch (e) {
      console.error('[PriceTicker] Market profile render error:', e);
    }
  }

  onMount(() => {
    connectionManager = ConnectionManager.getInstance(getWebSocketUrl());

    // Setup ResizeObserver to re-render canvas on browser zoom/resize
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        renderMarketProfile();
      });
      if (canvasRef) {
        resizeObserver.observe(canvasRef);
      }
    }

    // Subscribe via centralized store
    unsubscribeSymbol = subscribeToSymbol(formattedSymbol, ticker.source || 'tradingview', { adr: 14 });
    previousSymbol = formattedSymbol;

    // Setup drag interaction (no resize for ticker)
    interactable = createInteractConfig(element, {
      onDragMove: (e) => workspaceActions.updatePosition(ticker.id, { x: e.rect.left, y: e.rect.top }),
      onTap: () => workspaceActions.bringToFront(ticker.id),
      resizable: false
    });

    connectionManager.connect();

    return () => {
      unsubscribeSymbol?.();
      resizeObserver?.disconnect();
    };
  });

  onDestroy(() => {
    if (flashTimeout) clearTimeout(flashTimeout);
    if (resizeObserver) resizeObserver.disconnect();
    interactable?.unset();
    connectionManager?.disconnect();
  });

  // Track previous symbol to detect changes and resubscribe
  $: if (formattedSymbol !== previousSymbol && previousSymbol !== null) {
    // Unsubscribe from old symbol
    unsubscribeSymbol?.();

    // Subscribe to new symbol
    unsubscribeSymbol = subscribeToSymbol(formattedSymbol, ticker.source || 'tradingview', { adr: 14 });

    // Clear stale data
    lastMarketProfileData = null;
    lastTrackedPrice = null;

    previousSymbol = formattedSymbol;
  }

  function handleClose() {
    workspaceActions.removeDisplay(ticker.id);
  }

  function handleFocus() {
    workspaceActions.bringToFront(ticker.id);
  }

  function handleRefresh() {
    // Clear local state
    lastMarketProfileData = null;
    lastTrackedPrice = null;
    priceFlashClass = '';
    borderFlashClass = '';
    if (flashTimeout) clearTimeout(flashTimeout);

    // Resubscribe via store
    if (unsubscribeSymbol) {
      unsubscribeSymbol();
    }
    unsubscribeSymbol = subscribeToSymbol(formattedSymbol, ticker.source || 'tradingview', { adr: 14 });
  }
</script>

<style>
  :global(.ticker-container) {
    --flash-color-up: #00d4ff;
    --flash-color-down: #e040fb;
    --flash-duration: 500ms;
  }

  .ticker-container {
    position: absolute;
    display: flex;
    width: 240px;
    height: 80px;
    box-sizing: border-box;
    background: #141414; /* Card BG from spec */
    border: 1px solid #333; /* Border Line from spec */
    border-radius: 4px;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-variant-numeric: tabular-nums;
    cursor: move;
    user-select: none;
  }

  .ticker-container:focus {
    outline: 2px solid #00ff00;
    outline-offset: -2px;
    box-shadow: 0 0 4px rgba(0, 255, 0, 0.5);
  }

  /* Border flash - only when not focused to avoid overriding focus outline */
  .ticker-container:not(:focus) {
    transition: border-color var(--flash-duration) ease-out;
  }

  .ticker-container:not(:focus).flash-up {
    border-color: var(--flash-color-up);
  }

  .ticker-container:not(:focus).flash-down {
    border-color: var(--flash-color-down);
  }

  /* Column 1: Identity (135px) */
  .identity-column {
    width: 115px;
    flex-shrink: 0;
    padding: 8px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    border-right: 1px solid #333;
    background: #141414; /* Card BG from spec */
  }

  .symbol-label {
    font-size: 16px; /* Spec: 14px, 600, #888888 */
    font-weight: 600;
    color: #888888;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }


  .price-value {
    font-size: 32px; /* Spec: 24px, 700, #FFFFFF */
    font-weight: 600;
    color: #FFFFFF;
    white-space: nowrap;
    overflow: visible;
    transition: color var(--flash-duration) ease-out;
  }

  /* Larger value digits displayed smaller to emphasize pips */
  .price-larger-digits {
    font-size: 0.50em; /* 75% of base size */
  }

  /* Pip digits at full normal size */
  .price-pip-digits {
    font-size: 1em; /* Normal size */
  }

  .price-value.flash-up {
    color: var(--flash-color-up);
  }

  .price-value.flash-down {
    color: var(--flash-color-down);
  }

  /* Tiny top-aligned pipette digit (FX standard) */
  .pipette {
    font-size: 0.5em;
    vertical-align: top;
    line-height: 1.2;
    margin-left: 1px;
    opacity: 0.7;
  }

  /* Column 2: Chart (37.5px) */
  .chart-column {
    width: 37.5px;
    flex-shrink: 0;
    position: relative;
    background: #111111; /* Chart BG from spec */
    border-right: 1px solid #333;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .chart-canvas {
    width: 37.5px;
    height: 80px;
    display: block;
  }

  /* Column 3: Stats (flex: 1, remaining 67.5px) */
  .stats-column {
    flex: 1;
    min-width: 0;
    padding: 8px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background: #141414; /* Card BG from spec */
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px; /* Spec: Mid Stats 10px, 400, #666666 */
  }

  .stat-spacer {
    flex: 1;
  }

  .stat-label {
    color: #666666; /* Spec: Mid Stats 10px, 400, #666666 */
    font-weight: 400;
  }

  .stat-value {
    color: #CCCCCC; /* Spec: High/Low Price 12px, 500, #CCCCCC */
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .stat-value.positive {
    color: #00d4ff;
  }

  .stat-value.negative {
    color: #e040fb;
  }

  .daily-change {
    font-size: 15px;
    font-weight: 600;
  }

  .close-button {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 18px;
    height: 18px;
    border: none;
    background: rgba(255, 0, 0, 0.5);
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: bold;
    border-radius: 2px;
    transition: opacity 0.15s;
    opacity: 0;
    pointer-events: auto;
  }

  .refresh-button {
    position: absolute;
    top: 2px;
    right: 22px;
    width: 18px;
    height: 18px;
    border: none;
    background: rgba(0, 150, 255, 0.5);
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: bold;
    border-radius: 2px;
    transition: opacity 0.15s;
    opacity: 0;
    pointer-events: auto;
  }

  .ticker-container:hover .close-button,
  .ticker-container:hover .refresh-button {
    opacity: 1;
  }

  .close-button:hover {
    background: rgba(255, 0, 0, 0.9);
  }

  .refresh-button:hover {
    background: rgba(0, 150, 255, 0.9);
  }

  /* Loading state */
  .loading {
    color: #666;
    font-style: italic;
  }

  /* Respect user's motion preferences */
  @media (prefers-reduced-motion: reduce) {
    .price-value,
    .ticker-container:not(:focus).flash-up,
    .ticker-container:not(:focus).flash-down {
      transition: none;
    }
  }
</style>

<div class="ticker-container" bind:this={element} data-ticker-id={ticker.id}
     style="left: {ticker.position?.x || 100}px; top: {ticker.position?.y || 100}px; z-index: {ticker.zIndex || 1}; --flash-duration: {flashDuration}ms;"
     class:flash-up={borderFlashClass === 'flash-up'}
     class:flash-down={borderFlashClass === 'flash-down'}
     tabindex="0" role="region" aria-label="{ticker.symbol} ticker"
     on:focus={handleFocus}>
  <button class="refresh-button" on:click={handleRefresh} aria-label="Refresh ticker">↻</button>
  <button class="close-button" on:click={handleClose} aria-label="Close ticker">×</button>

  <!-- Column 1: Identity -->
  <div class="identity-column">
    <div class="symbol-label">{ticker.symbol}</div>
    <div class="price-value" class:flash-up={priceFlashClass === 'flash-up'} class:flash-down={priceFlashClass === 'flash-down'}>
      {#if currentPrice}
        <span class="price-larger-digits">{priceParts.largerDigits}</span><span class="price-pip-digits">{priceParts.pipDigits}</span><span class="pipette">{getPipetteDigit(currentPrice, pipPosition)}</span>
      {:else}
        <span class="loading">...</span>
      {/if}
    </div>
  </div>

  <!-- Column 2: Mini Market Profile -->
  <div class="chart-column">
    <canvas bind:this={canvasRef} class="chart-canvas" width="37.5" height="80"></canvas>
  </div>

  <!-- Column 3: Session Stats -->
  <div class="stats-column">
    <div class="stat-row">
      <span class="stat-label">H</span>
      <span class="stat-value">
        {#if highPrice}
          {formatPrice(highPrice, pipPosition)}
        {:else}
          <span class="loading">...</span>
        {/if}
      </span>
    </div>
    <div class="stat-spacer"></div>
    <div class="stat-row">
      <span class="stat-value daily-change" class:positive={dailyChangeClass === 'positive'} class:negative={dailyChangeClass === 'negative'}>
        {#if dailyChangePercent !== null}
          {dailyChangePercent > 0 ? '+' : ''}{dailyChangePercent}%
        {:else}
          <span class="loading">...</span>
        {/if}
      </span>
    </div>
    <div class="stat-row">
      <span class="stat-value">
        {#if rangePercent !== null}
          DR {rangePercent}%
        {:else}
          <span class="loading">...</span>
        {/if}
      </span>
    </div>
    <div class="stat-spacer"></div>
    <div class="stat-row">
      <span class="stat-label">L</span>
      <span class="stat-value">
        {#if lowPrice}
          {formatPrice(lowPrice, pipPosition)}
        {:else}
          <span class="loading">...</span>
        {/if}
      </span>
    </div>
  </div>
</div>
