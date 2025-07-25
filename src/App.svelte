<script>
  import { onMount } from 'svelte';
  import VizDisplay from './components/VizDisplay.svelte';
  import ConfigPanel from './components/ConfigPanel.svelte';
  import { symbolStore } from './data/symbolStore.js';
  import { dataSourceMode, setDataSource, subscribe, unsubscribe } from './data/wsClient.js';

  let symbols = {};
  let selectedSymbolForConfig = 'SIM-EURUSD';

  symbolStore.subscribe(value => {
    symbols = value;
  });

  onMount(() => {
    // Set the initial data source
    setDataSource('simulated');
  });

  function handleSubscriptionChange(event) {
      const { symbols, subscribe: shouldSubscribe } = event.detail;
      if (shouldSubscribe) {
          subscribe(symbols);
      } else {
          unsubscribe(symbols);
      }
  }

  function handleDataSourceChange(event) {
      setDataSource(event.detail.mode);
  }

  function handleConfigChange(event) {
      const { symbol, newConfig } = event.detail;
      symbolStore.updateConfig(symbol, newConfig);
  }
</script>

<main>
  <div class="main-container">
    <div class="viz-container">
      <h1>NeuroSense FX</h1>
      <div class="viz-grid">
        {#each Object.entries(symbols) as [symbol, data] (symbol)}
          <VizDisplay 
            config={data.config} 
            state={data.state} 
            marketProfileData={data.marketProfile}
            flashEffect={null}
          />
        {/each}
      </div>
    </div>
    <div class="config-panel-container">
      <ConfigPanel 
        selectedSymbol={selectedSymbolForConfig}
        symbols={Object.keys(symbols)}
        config={symbols[selectedSymbolForConfig]?.config}
        on:subscriptionChange={handleSubscriptionChange}
        on:dataSourceChange={handleDataSourceChange}
        on:configChange={handleConfigChange}
      />
    </div>
  </div>
</main>

<style>
  main {
    background-color: #111827;
    color: #d1d5db;
    min-height: 100vh;
  }
  .main-container {
    display: flex;
    flex-direction: row;
    padding: 20px;
  }
  .viz-container {
    flex-grow: 1;
  }
  .viz-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 20px;
  }
  .config-panel-container {
    width: 350px;
    margin-left: 20px;
  }
  h1 {
    color: #60a5fa;
    margin-bottom: 20px;
  }
</style>
