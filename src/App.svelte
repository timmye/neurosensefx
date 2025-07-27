<script>
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import VizDisplay from './components/VizDisplay.svelte';
  import ConfigPanel from './components/ConfigPanel.svelte';
  import { symbolStore } from './data/symbolStore.js';
  import { dataSourceMode, wsStatus, connect } from './data/wsClient.js';

  let symbols = {};
  let selectedSymbolForConfig = null;

  const unsub = symbolStore.subscribe(value => {
    symbols = value;
    const symbolKeys = Object.keys(value);
    if (!selectedSymbolForConfig || !value[selectedSymbolForConfig]) {
        selectedSymbolForConfig = symbolKeys[0] || null;
    }
  });

  onMount(() => {
    if (get(dataSourceMode) === 'simulated') {
      // The simulation now starts automatically via the dataSourceMode subscription
    }
    return () => unsub();
  });

  function handleDataSourceChange(event) {
    dataSourceMode.set(event.detail.mode);
    selectedSymbolForConfig = null;
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
            {#if data.state}
              <div class="viz-wrapper" class:selected={symbol === selectedSymbolForConfig} on:click={() => selectedSymbolForConfig = symbol}>
                <div class="symbol-header">{symbol}</div>
                <VizDisplay 
                  symbol={symbol}
                  config={data.config}
                  state={data.state}
                  marketProfile={data.marketProfile}
                  flashEffect={data.state.flashEffect}
                />
              </div>
            {:else}
              <div class="placeholder">
                <p>Loading {symbol}...</p>
              </div>
            {/if}
          {/each}
        </div>
      {/if}
    </div>
    <div class="config-panel-container">
      <ConfigPanel 
        selectedSymbol={selectedSymbolForConfig}
        config={symbols[selectedSymbolForConfig]?.config}
        on:dataSourceChange={handleDataSourceChange}
      />
    </div>
  </div>
</main>

<style>
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
  /* ... existing styles ... */
</style>
