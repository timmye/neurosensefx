<script>
  import { onMount, onDestroy } from 'svelte';
  import { workspaceStore, workspaceActions } from '../stores/workspace.js';
  import { createPriceMarkerInteraction } from '../lib/priceMarkerInteraction.js';
  import { loadMarkers, saveMarkers } from '../stores/priceMarkerPersistence.js';

  export let display;
  export let lastData;
  export let canvasRef;
  export let formattedSymbol;

  // Expose these to parent component
  export let priceMarkers = [];
  export let selectedMarker = null;
  export let hoverPrice = null;

  let priceMarkerInteraction = null;

  // Initialize price markers when component mounts
  onMount(() => {
    // Load saved markers and set in workspace
    priceMarkers = loadMarkers(formattedSymbol);
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
    saveMarkers(formattedSymbol, priceMarkers);
  }
  $: if (currentDisplay?.selectedMarker) selectedMarker = currentDisplay.selectedMarker;

  // Cleanup
  onDestroy(() => {
    priceMarkerInteraction?.destroy();
  });
</script>

<!-- This component manages price marker state and interaction -->
<!-- It doesn't render any UI, just manages the logic -->