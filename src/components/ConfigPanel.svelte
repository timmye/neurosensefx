<script>
  import { createEventDispatcher } from 'svelte';
  import { vizConfig } from '../stores.js';
  import { dataSourceMode, subscriptions } from '../data/wsClient.js';

  export let config;

  const dispatch = createEventDispatcher();

  let symbolInput = 'EURUSD';
  
  // Add console log for dataSourceMode in ConfigPanel
  $: console.log('ConfigPanel.svelte: $dataSourceMode:', $dataSourceMode);

  // --- Event Handlers ---

  function handleConfigChange() {
    vizConfig.set(config);
  }

  function handleDataSourceChange(event) {
    const mode = event.target.value;
    dispatch('dataSourceChange', { mode });
  }

  function handleSubscribe() {
      if (symbolInput) {
          dispatch('subscriptionChange', { symbols: [symbolInput.toUpperCase()], subscribe: true });
          symbolInput = '';
      }
  }

  function handleUnsubscribe(symbol) {
      dispatch('subscriptionChange', { symbols: [symbol], subscribe: false });
  }
  
  const availableSymbols = ["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD", "EURGBP", "EURJPY", "GBPJPY"];

</script>

<div class="panel">
  <!-- Data Source Selector -->
  <div class="control-group">
    <label for="dataSource">Data Source</label>
    <select id="dataSource" bind:value={$dataSourceMode} on:change={handleDataSourceChange}>
      <option value="simulated">Simulated Data</option>
      <option value="live">Live Data (WebSocket)</option>
    </select>
  </div>

  <!-- Subscription Management (only shown in live mode) -->
  {#if $dataSourceMode === 'live'}
    <div class="control-group">
        <label for="symbolInput">Subscribe to Symbol</label>
        <div class="subscription-input">
            <input list="symbols" id="symbolInput" name="symbolInput" bind:value={symbolInput} placeholder="e.g., EURUSD" />
            <datalist id="symbols">
                {#each availableSymbols as symbol}
                    <option value={symbol}>{symbol}</option>
                {/each}
            </datalist>
            <button on:click={handleSubscribe}>Subscribe</button>
        </div>
        
        <div class="subscriptions-list">
            <h4>Active Subscriptions:</h4>
            <ul>
                {#each $subscriptions as sub (sub)}
                    <li>
                        {sub}
                        <button class="unsubscribe-btn" on:click={() => handleUnsubscribe(sub)}>x</button>
                    </li>
                {:else}
                    <li>None</li>
                {/each}
            </ul>
        </div>
    </div>
  {/if}

  <!-- Simulation Controls (only shown in simulated mode) -->
  {#if $dataSourceMode === 'simulated'}
    <div class="control-group">
      <label for="frequencyMode">Simulation Frequency</label>
      <select id="frequencyMode" bind:value={config.frequencyMode} on:change={handleConfigChange}>
        <option value="calm">Calm</option>
        <option value="normal">Normal</option>
        <option value="active">Active</option>
        <option value="volatile">Volatile</option>
      </select>
    </div>
  {/if}

  <!-- Display and ADR -->
  <div class="control-group">
    <label for="adrRange">ADR Range (Pips)</label>
    <input type="range" id="adrRange" min="10" max="300" bind:value={config.adrRange} on:input={handleConfigChange}>
    <span>{config.adrRange}</span>
  </div>
  
  <div class="control-group">
      <label for="priceFontSize">Price Font Size</label>
      <input type="range" id="priceFontSize" min="20" max="100" bind:value={config.priceFontSize} on:input={handleConfigChange}>
      <span>{config.priceFontSize}</span>
  </div>
  
  <!-- Other controls can be added here -->

</div>

<style>
  .panel {
    background-color: #1f2937;
    padding: 15px;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    color: #d1d5db;
  }
  .control-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  label {
    font-weight: 500;
    color: #9ca3af;
  }
  input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 8px;
    background: #4b5563;
    border-radius: 5px;
    outline: none;
  }
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    background: #60a5fa;
    cursor: pointer;
    border-radius: 50%;
  }
  select, input[type="text"] {
    width: 100%;
    padding: 8px;
    background-color: #374151;
    border: 1px solid #4b5563;
    border-radius: 4px;
    color: #d1d5db;
  }
  button {
      padding: 8px 12px;
      background-color: #3b82f6;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: background-color 0.2s;
  }
  button:hover {
      background-color: #2563eb;
  }
  .subscription-input {
      display: flex;
  }
  .subscription-input input {
      flex-grow: 1;
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
  }
  .subscription-input button {
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
  }
  .subscriptions-list {
      margin-top: 10px;
  }
  .subscriptions-list ul {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
  }
  .subscriptions-list li {
      background-color: #374151;
      padding: 5px 10px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 5px;
  }
  .unsubscribe-btn {
      background-color: #ef4444;
      color: white;
      border: none;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      cursor: pointer;
      font-size: 12px;
      line-height: 20px;
      text-align: center;
  }
</style>
