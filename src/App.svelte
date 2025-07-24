<script>
  import { onMount } from 'svelte';
  import VizDisplay from './components/VizDisplay.svelte';
  import ConfigPanel from './components/ConfigPanel.svelte';
  import { vizConfig } from './stores.js';
  import { setDataSource, subscribe, unsubscribe, wsStatus } from './data/wsClient.js';
  import { symbolStates } from './data/symbolManager.js';

  let currentVizConfig = $vizConfig;

  // Event Handlers
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
</script>

<main>
  <div class="main-container">
    <!-- Visualization Grid -->
    <div class="viz-grid-container">
      <div class="header-bar">
        <h1>NeuroSense FX</h1>
        <div class="status-indicator status-{$wsStatus}">
          {$wsStatus}
        </div>
      </div>
      
      <div class="grid-content">
        {#each Object.entries($symbolStates) as [symbol, state] (symbol)}
          <div class="viz-wrapper">
            <div class="viz-header">{symbol}</div>
            <VizDisplay 
              config={currentVizConfig} 
              {state}
            />
          </div>
        {/each}
      </div>
    </div>

    <!-- Configuration Panel -->
    <div class="config-panel-container">
      <ConfigPanel 
        bind:config={currentVizConfig}
        on:subscriptionChange={handleSubscriptionChange}
        on:dataSourceChange={handleDataSourceChange}
      />
    </div>
  </div>
</main>

<style>
  main {
    background-color: #111827;
    color: #d1d5db;
    min-height: 100vh;
    padding: 1rem;
  }
  .main-container {
    display: flex;
    flex-direction: row;
    gap: 1rem;
  }
  .viz-grid-container {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
  }
  .header-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }
  h1 {
    margin: 0;
    color: #60a5fa;
  }
  .status-indicator {
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 500;
    text-transform: capitalize;
  }
  .status-connecting { background-color: #f59e0b; color: #fff; }
  .status-connected { background-color: #10b981; color: #fff; }
  .status-disconnected { background-color: #4b5563; color: #e5e7eb; }
  .status-error { background-color: #ef4444; color: #fff; }

  .grid-content {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1rem;
    align-content: start;
  }
  .viz-wrapper {
    border: 1px solid #374151;
    border-radius: 8px;
    padding: 0.5rem;
    background-color: #1f2937;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .viz-header {
    font-family: 'Roboto Mono', monospace;
    font-size: 0.875rem;
    color: #9ca3af;
    margin-bottom: 0.5rem;
  }
  .config-panel-container {
    width: 350px;
    flex-shrink: 0;
  }
</style>
