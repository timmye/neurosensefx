<script>
  import { displayStore, displays, displayStateStore } from '../stores/displayStore.js';
  import { onMount } from 'svelte';

  let debugInfo = {
    mainStoreDisplays: 0,
    stateStoreDisplays: 0,
    derivedDisplays: 0,
    displayList: []
  };

  // Check main store displays count
  displayStore.subscribe(store => {
    debugInfo.mainStoreDisplays = store.panels?.size || 0;
  });

  // Check state store displays count
  displayStateStore.subscribe(state => {
    debugInfo.stateStoreDisplays = state.displays?.size || 0;
    debugInfo.displayList = Array.from(state.displays?.values() || []);
  });

  // Check derived displays
  displays.subscribe(d => {
    debugInfo.derivedDisplays = d?.size || 0;
  });

  onMount(() => {
    console.log('[DEBUG] Store monitor mounted');
    console.log('[DEBUG] Current store state:', debugInfo);

    // Log every 2 seconds
    const interval = setInterval(() => {
      console.log('[DEBUG] Store state check:', debugInfo);
    }, 2000);

    return () => clearInterval(interval);
  });
</script>

<div class="debug-monitor">
  <h3>Display Store Debug Monitor</h3>
  <div>Main Store Displays: {debugInfo.mainStoreDisplays}</div>
  <div>State Store Displays: {debugInfo.stateStoreDisplays}</div>
  <div>Derived Displays: {debugInfo.derivedDisplays}</div>

  <h4>Display List:</h4>
  {#each debugInfo.displayList as display}
    <div class="display-item">
      {display.id}: {display.symbol} at ({display.position?.x}, {display.position?.y})
      - Ready: {display.ready ? '✅' : '❌'}
    </div>
  {/each}
</div>

<style>
  .debug-monitor {
    position: fixed;
    top: 100px;
    right: 20px;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 15px;
    border-radius: 8px;
    font-family: monospace;
    font-size: 12px;
    z-index: 9999;
    max-width: 400px;
    max-height: 300px;
    overflow-y: auto;
  }

  .display-item {
    margin: 5px 0;
    padding: 3px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }
</style>