<script>
  import { onMount, onDestroy } from 'svelte';
  import { workspaceStore, workspaceActions } from '../stores/workspace.js';
  import { createPriceMarkerInteraction } from '../lib/priceMarkerInteraction.js';
  import { loadMarkers, saveMarkers } from '../stores/priceMarkerPersistence.js';
  import { formatSymbol } from '../lib/displayDataProcessor.js';

  export let display;
  export let lastData;
  export let canvasRef;
  export let formattedSymbol = undefined; // Optional, computed locally if not provided

  // Expose these to parent component
  export let priceMarkers = [];
  export let selectedMarker = null;
  export let hoverPrice = null;
  export let deltaInfo = null;

  let priceMarkerInteraction = null;

  // Compute formattedSymbol from display.symbol to avoid undefined during mount
  $: localFormattedSymbol = display.symbol ? formatSymbol(display.symbol) : '';

  // Initialize price markers when component mounts
  onMount(() => {
    // Load saved markers and set in workspace
    const symbol = localFormattedSymbol || formattedSymbol;
    if (!symbol) return;
    priceMarkers = loadMarkers(symbol);
    workspaceActions.setDisplayPriceMarkers(display.id, priceMarkers);

    // Initialize interaction system after a short delay
    setTimeout(() => {
      const canvasElement = canvasRef?.getCanvas ? canvasRef.getCanvas() : null;
      if (canvasElement) {
        priceMarkerInteraction = createPriceMarkerInteraction(canvasElement, display.id, lastData, null);

        // Set up hover price callback
        priceMarkerInteraction.onHoverPrice = (price) => {
          hoverPrice = price;
        };

        // Set up delta callbacks for reactive rendering
        priceMarkerInteraction.onDeltaMove = (startPrice, currentPrice) => {
          deltaInfo = { startPrice, currentPrice, active: true };
        };

        priceMarkerInteraction.onDeltaEnd = () => {
          deltaInfo = null;
        };

        // Keep rerender callback for backward compatibility
        priceMarkerInteraction.onRerender = () => {
          if (canvasRef && canvasRef.render) {
            canvasRef.render();
          }
        };
      }
    }, 100);
  });

  // Update interaction when data changes
  $: if (lastData && priceMarkerInteraction) {
    priceMarkerInteraction.updateData(lastData);
  }

  // Sync with workspace store
  $: currentDisplay = $workspaceStore.displays.get(display.id);
  $: if (currentDisplay?.priceMarkers) {
    priceMarkers = currentDisplay.priceMarkers;
    const symbol = localFormattedSymbol || formattedSymbol;
    if (symbol) {
      saveMarkers(symbol, priceMarkers);
    }
  }
  $: if (currentDisplay?.selectedMarker) selectedMarker = currentDisplay.selectedMarker;

  // Cleanup
  onDestroy(() => {
    priceMarkerInteraction?.destroy();
  });
</script>

<!-- This component manages price marker state and interaction -->
<!-- It doesn't render any UI, just manages the logic -->