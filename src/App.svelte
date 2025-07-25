<script>
  import { onMount } from 'svelte';
  import VizDisplay from './components/VizDisplay.svelte';
  import ConfigPanel from './components/ConfigPanel.svelte';
  import { symbolStore } from './data/symbolStore.js';
  import { dataSourceMode, startSimulation, stopSimulation, disconnect, connect, wsStatus } from './data/wsClient.js';

  let symbols = {};
  let selectedSymbolForConfig = null;

  // Subscribe to the symbol store to get live updates
  onMount(() => {
    const unsubscribe = symbolStore.subscribe(value => {
      symbols = value;
      const symbolKeys = Object.keys(value);
      // If no symbol is selected for config, or the selected one was removed, pick the first available one.
      if (!selectedSymbolForConfig || !value[selectedSymbolForConfig]) {
          selectedSymbolForConfig = symbolKeys[0] || null;
      }
    });

    // Start with simulated data by default
    startSimulation();

    // Cleanup when the component is destroyed
    return () => {
        unsubscribe();
        disconnect(); // Ensure WebSocket is closed if live
        stopSimulation(); // Ensure simulation is stopped if simulated
        symbolStore.clear(); // Clear the store and terminate workers
    };
  });

  // Handle the data source change from the config panel
  function handleDataSourceChange(event) {
      const mode = event.detail.mode;
      dataSourceMode.set(mode);
      symbolStore.clear(); // Always clear existing symbols when changing data source
      selectedSymbolForConfig = null; // Clear selected symbol

      if (mode === 'live') {
          // startSimulation is stopped by the dataSourceMode subscription in wsClient
          connect(); // Initiate WebSocket connection
      } else {
          // disconnect is called by startSimulation
          startSimulation();
      }
  }

  function handleConfigChange(event) {
      const { symbol, newConfig } = event.detail;
      symbolStore.updateConfig(symbol, newConfig);
  }

  function handleResetConfig(event) {
      const { symbol } = event.detail;
      symbolStore.resetConfig(symbol);
  }
</script>

<main>
  <div class="main-container">
    <div class="viz-area">
      {#if Object.keys(symbols).length === 0}
        <div class="placeholder">
          <h2>Welcome to NeuroSense FX</h2>
          {#if $dataSourceMode === 'live'}
            {#if $wsStatus === 'disconnected'}
              <p>Select Live Data and click Connect in the panel.</p>
            {:else if $wsStatus === 'ws-connecting' || $wsStatus === 'ws-open' || $wsStatus === 'ctrader-connecting'}
              <p>Connecting to live data... Status: {$wsStatus}</p>
            {:else if $wsStatus === 'connected'}
              <p>Connected to live data. Subscribe to a symbol in the panel.</p>
            {:else if $wsStatus === 'error'}
              <p class="error">Connection Error. Check console for details. Status: {$wsStatus}</p>
            {/if}
          {:else}
            <p>Simulation is running. Select SIM-EURUSD in the panel to view and configure.</p>
          {/if}
        </div>
      {:else}
        <div class="viz-grid">
          {#each Object.entries(symbols) as [symbol, data] (symbol)}
            <VizDisplay 
              {...data}
              on:click={() => selectedSymbolForConfig = symbol}
            />
          {/each}
        </div>
      {/if}
    </div>
    <div class="config-panel-container">
      <ConfigPanel 
        selectedSymbol={selectedSymbolForConfig}
        config={symbols[selectedSymbolForConfig]?.config}
        on:dataSourceChange={handleDataSourceChange}
        on:configChange={handleConfigChange}
        on:resetConfig={handleResetConfig}
      />
    </div>
  </div>
</main>

<style>
  :global(body) {
    overflow: hidden;
  }
  main {
    background-color: #111827;
    color: #d1d5db;
    height: 100vh;
    width: 100vw;
  }
  .main-container {
    display: flex;
    flex-direction: row;
    height: 100%;
  }
  .viz-area {
    flex-grow: 1;
    padding: 20px;
    overflow-y: auto;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .viz-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 20px;
    width: 100%;
    align-content: start;
  }
  .config-panel-container {
    width: 350px;
    flex-shrink: 0;
    height: 100vh;
  }
  .placeholder {
    text-align: center;
    color: #6b7280;
  }
  .placeholder h2 {
    font-size: 1.5rem;
    color: #9ca3af;
  }
  .placeholder p {
      margin-top: 10px;
      font-size: 1rem;
  }
  .placeholder .error {
      color: #ef4444;
  }
</style>
