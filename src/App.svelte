<script>
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import Container from './components/viz/Container.svelte';
  import ConfigPanel from './components/ConfigPanel.svelte';
  import MultiSymbolADR from './components/viz/MultiSymbolADR.svelte'; // Import the new component
  import { symbolStore } from './data/symbolStore.js';
  import { dataSourceMode, wsStatus } from './data/wsClient.js';
  import { selectedSymbol } from './stores/uiState.js';

  let symbols = {};

  const unsubSymbolStore = symbolStore.subscribe(value => {
    symbols = value;
    const symbolKeys = Object.keys(value);
    if (!$selectedSymbol || !value[$selectedSymbol]) {
        selectedSymbol.set(symbolKeys[0] || null);
    }
  });

  onMount(() => {
    return () => unsubSymbolStore();
  });

  function handleDataSourceChange(event) {
    dataSourceMode.set(event.detail.mode);
    selectedSymbol.set(null);
  }

</script>

<main>
  <div class="main-container">
    
    <!-- New Multi-Symbol ADR Panel -->
    {#if Object.keys(symbols).length > 0}
      <div class="adr-panel-container">
        <div class="symbol-header">ADR Overview</div>
        <MultiSymbolADR />
      </div>
    {/if}

    <div class="viz-area">
      {#if Object.keys(symbols).length === 0}
        <div class="placeholder">
          <h2>Welcome to NeuroSense FX</h2>
          {#if $dataSourceMode === 'live'}
            {#if $wsStatus === 'disconnected'}
              <p>Select "Live Data" in the panel to connect.</p>
            {:else if $wsStatus === 'ws-connecting' || $wsStatus === 'ws-open'}
              <p>Connecting to backend...</p>
            {:else if $wsStatus === 'ready'}
              <p>Connection successful. Select a symbol in the panel to subscribe.</p>
            {:else if $wsStatus === 'error'}
              <p class="error">Connection Error. Check the console for details.</p>
            {/if}
          {:else}
            <p>Simulation is running. Select a symbol in the panel to configure it.</p>
          {/if}
        </div>
      {:else}
        <div class="viz-grid">
          {#each Object.entries(symbols) as [symbol, data] (symbol)}
            <div class="viz-wrapper" class:selected={symbol === $selectedSymbol} on:click={() => selectedSymbol.set(symbol)}>
              <div class="symbol-header">{symbol}</div>
              {#if data.ready}
                <Container
                  config={data.config}
                  state={data.state}
                />
              {:else}
                <div class="placeholder">
                  <p>Initializing {symbol}...</p>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
    <div class="config-panel-container">
      <ConfigPanel
        config={symbols[$selectedSymbol]?.config}
        state={symbols[$selectedSymbol]?.state} 
        on:dataSourceChange={handleDataSourceChange}
      />
    </div>
  </div>
</main>

<style>
  :global(body) {
    background-color: #111827;
  }
  .viz-wrapper {
    border: 2px solid transparent;
    border-radius: 8px;
    padding: 5px;
    transition: border-color 0.2s;
  }
  .viz-wrapper.selected {
    border-color: #4f46e5;
  }
  .symbol-header {
    text-align: center;
    font-weight: bold;
    color: #9ca3af;
    margin-bottom: 5px;
  }
  .main-container {
    display: flex;
    height: 100vh;
  }
  /* Style for the new ADR panel */
  .adr-panel-container {
    width: 150px; /* Canvas is 120px wide */
    flex-shrink: 0;
    padding: 20px 10px;
    border-right: 1px solid #374151;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .viz-area {
    flex-grow: 1;
    padding: 20px;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow-x: auto;
  }
  .viz-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 20px;
  }
  .config-panel-container {
    width: 350px;
    flex-shrink: 0;
    overflow-y: auto;
    border-left: 1px solid #374151;
  }
  .placeholder {
    color: #6b7280;
    text-align: center;
    height: 120px; /* Match canvas height */
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .error {
    color: #ef4444;
  }
</style>
