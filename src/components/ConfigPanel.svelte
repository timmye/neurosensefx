<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { dataSourceMode, wsStatus, availableSymbols, subscribe, unsubscribe } from '../data/wsClient.js';
  import { symbolStore } from '../data/symbolStore.js';
  import { selectedSymbol } from '../stores/uiState.js';

  export let config;

  const dispatch = createEventDispatcher();

  let selectedSymbolForSubscription = null;
  let subscribedSymbols = [];

  const unsub = symbolStore.subscribe(value => {
    subscribedSymbols = Object.keys(value);
  });

  onMount(() => {
    return () => unsub();
  });

  function handleConfigChange() {
      if ($selectedSymbol && config) {
          symbolStore.updateConfig($selectedSymbol, config);
      }
  }

  function handleReset() {
      if ($selectedSymbol) {
          symbolStore.resetConfig($selectedSymbol);
      }
  }

  function handleSubscribe() {
      if (selectedSymbolForSubscription) {
          subscribe(selectedSymbolForSubscription);
      }
  }

  function handleUnsubscribe(symbol) {
      unsubscribe(symbol);
  }

</script>

<div class="panel-wrapper">
  <div class="panel">
      <div class="panel-header">
          <h1 class="panel-title">NeuroSense FX</h1>
          <p class="panel-description">A Human-Centric Visual Trading Interface</p>
      </div>

      <div class="panel-content">
          <!-- System and Data Source -->
          <div class="control-group-container">
              <div class="title-bar">
                  <h2 class="group-title">System</h2>
              </div>
              <div class="control-group">
                  <label for="dataSource">Data Source</label>
                  <select id="dataSource" bind:value={$dataSourceMode} on:change={(e) => dispatch('dataSourceChange', { mode: e.target.value })}>
                      <option value="simulated">Simulated Data</option>
                      <option value="live">Live Data (cTrader)</option>
                  </select>
              </div>
          </div>

          <!-- Live Data Controls -->
          {#if $dataSourceMode === 'live'}
              <div class="control-group-container">
                <div class="title-bar">
                    <h2 class="group-title">Live Connection</h2>
                </div>
                <div class="control-group">
                    <div class="status-box">
                        <span class="status-indicator status-{$wsStatus}"></span>
                        <span class="status-text">{$wsStatus}</span>
                    </div>
                    {#if $wsStatus === 'ready'}
                        <div class="subscription-controls">
                            <select bind:value={selectedSymbolForSubscription}>
                                <option value={null}>Select a symbol...</option>
                                {#each $availableSymbols as symbol}
                                    <option value={symbol} disabled={subscribedSymbols.includes(symbol)}>{symbol}</option>
                                {/each}
                            </select>
                            <button on:click={handleSubscribe} disabled={!selectedSymbolForSubscription}>Subscribe</button>
                        </div>

                        {#if subscribedSymbols.length > 0}
                            <div class="subscribed-list">
                                <h4>Active Subscriptions:</h4>
                                <ul>
                                    {#each subscribedSymbols as symbol}
                                        <li>
                                            <span>{symbol}</span>
                                            <button class="unsubscribe-button" on:click={() => handleUnsubscribe(symbol)}>X</button>
                                        </li>
                                    {/each}
                                </ul>
                            </div>
                        {/if}
                    {/if}
                </div>
              </div>
          {/if}

          {#if config}
            <hr/>
            <div class="title-bar">
                <h2 class="group-title">Visual Settings for {$selectedSymbol}</h2>
                <button class="reset-button" on:click={handleReset}>Reset to Defaults</button>
            </div>

            <!-- Simulation Controls -->
            {#if $dataSourceMode === 'simulated'}
              <div class="control-group-container">
                <h3 class="group-title">Simulation Settings</h3>
                  <div class="control-group">
                    <label for="frequencyMode">Market Activity</label>
                    <select id="frequencyMode" bind:value={config.frequencyMode} on:change={handleConfigChange}>
                      <option value="calm">Calm</option>
                      <option value="normal">Normal</option>
                      <option value="active">Active</option>
                      <option value="volatile">Volatile</option>
                    </select>
                  </div>
              </div>
            {/if}

            <!-- Layout & Meter -->
            <div class="control-group-container">
                <h3 class="group-title">Layout & Meter</h3>
                <div class="control-group">
                    <label for="visualizationsContentWidth">Visualization Width: <span>{config.visualizationsContentWidth}px</span></label>
                    <input type="range" id="visualizationsContentWidth" min="100" max="500" bind:value={config.visualizationsContentWidth} on:input={handleConfigChange}>
                </div>
                 <div class="control-group">
                    <label for="meterHeight">Visualization Height: <span>{config.meterHeight}px</span></label>
                    <input type="range" id="meterHeight" min="50" max="300" bind:value={config.meterHeight} on:input={handleConfigChange}>
                </div>
                <div class="control-group">
                    <label for="centralAxisXPosition">ADR Axis Position: <span>{config.centralAxisXPosition}px</span></label>
                    <input type="range" id="centralAxisXPosition" min="0" max={config.visualizationsContentWidth} bind:value={config.centralAxisXPosition} on:input={handleConfigChange}>
                </div>
            </div>
          {/if}
      </div>
  </div>
</div>

<style>
  .panel-wrapper {
    background-color: #1f2937;
    color: #e5e7eb;
    height: 100%;
    overflow-y: auto;
  }
  .panel {
      padding: 20px;
  }
  .panel-header {
      text-align: center;
      margin-bottom: 20px;
  }
  .panel-title {
      font-size: 1.5em;
      font-weight: bold;
      color: #d1d5db;
  }
  .panel-description {
      color: #9ca3af;
  }
  .control-group-container {
      background-color: #374151;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 15px;
  }
  .title-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
  }
  .group-title {
      font-size: 1.1em;
      font-weight: 600;
      color: #d1d5db;
  }
  .control-group {
      display: flex;
      flex-direction: column;
      gap: 10px;
  }
  label {
      font-weight: 500;
      color: #9ca3af;
  }
  select, input[type="range"], button {
      width: 100%;
      padding: 8px;
      border-radius: 6px;
      border: 1px solid #4b5563;
      background-color: #1f2937;
      color: #e5e7eb;
  }
  button {
      cursor: pointer;
      background-color: #4f46e5;
      border: none;
  }
  .reset-button {
      background: none;
      border: 1px solid #4b5563;
      font-size: 0.8em;
      padding: 4px 8px;
  }
  hr {
      border: none;
      border-top: 1px solid #374151;
      margin: 20px 0;
  }
  .status-box {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background-color: #1f2937;
    border-radius: 6px;
    margin-bottom: 10px;
  }
  .status-indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }
  .status-disconnected { background-color: #ef4444; }
  .status-ws-connecting, .status-ws-open { background-color: #f59e0b; }
  .status-ready { background-color: #22c55e; }
  .status-error { background-color: #ef4444; }

  .status-text {
      font-weight: 500;
      color: #e5e7eb;
  }
  .subscription-controls {
      display: flex;
      gap: 10px;
  }
  .subscribed-list {
      margin-top: 15px;
  }
  .subscribed-list h4 {
      font-weight: 500;
      color: #9ca3af;
  }
  .subscribed-list ul {
      list-style: none;
      padding: 0;
      margin-top: 5px;
  }
    .subscribed-list li {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 5px 8px;
        background-color: #111827;
        border-radius: 4px;
        margin-bottom: 5px;
    }
    .unsubscribe-button {
        background: none;
        border: none;
        color: #ef4444;
        cursor: pointer;
        font-weight: bold;
    }
</style>
