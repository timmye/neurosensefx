<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { dataSourceMode, wsStatus, availableSymbols, subscribe, unsubscribe } from '../data/wsClient.js';
  import { symbolStore } from '../data/symbolStore.js';
  import { selectedSymbol } from '../stores/uiState.js';

  export let config;
  export let state;

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

  // Use state.digits if available, otherwise default to 5.
  $: digits = state?.digits || 5;

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
                    {#if $wsStatus === 'connected'}
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

          <!-- Live Debug Info -->
          {#if state}
          <div class="control-group-container debug-info">
              <h3 class="group-title">Live Debug Info</h3>
              <div class="info-grid">
                  <span>Profile Levels:</span><span>{state.marketProfile?.levels?.length || 0}</span>
                  <span>Profile Ticks:</span><span>{state.marketProfile?.tickCount || 0}</span>
                  <span>ADR High:</span><span>{state.adrHigh?.toFixed(5)}</span>
                  <span>ADR Low:</span><span>{state.adrLow?.toFixed(5)}</span>
                  <span>Visual High:</span><span>{state.visualHigh?.toFixed(5)}</span>
                  <span>Visual Low:</span><span>{state.visualLow?.toFixed(5)}</span>
                  <hr/>
                  <span>Current Price:</span><span>{state.currentPrice?.toFixed(digits)}</span>
                  <span>Digits:</span><span>{state.digits}</span>
                  <span>Tick Direction:</span><span>{state.lastTickDirection}</span>
                  <span>Volatility:</span><span>{state.volatility?.toFixed(4)}</span>
              </div>
          </div>
          {/if}

          {#if config}
            <hr class="divider"/>
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

            <!-- Layout & Meter Controls -->
            <div class="control-group-container">
                <h3 class="group-title">Layout & Meter</h3>
                <div class="control-group">
                    <label for="visualizationsContentWidth">Viz Width: <span>{config.visualizationsContentWidth}px</span></label>
                    <input type="range" id="visualizationsContentWidth" min="100" max="500" step="1" bind:value={config.visualizationsContentWidth} on:change={handleConfigChange}>
                </div>
                 <div class="control-group">
                    <label for="meterHeight">Viz Height: <span>{config.meterHeight}px</span></label>
                    <input type="range" id="meterHeight" min="50" max="300" step="1" bind:value={config.meterHeight} on:change={handleConfigChange}>
                </div>
                <div class="control-group">
                    <label for="centralAxisXPosition">ADR Axis X-Position: <span>{config.centralAxisXPosition}px</span></label>
                    <input type="range" id="centralAxisXPosition" min="0" max={config.visualizationsContentWidth} step="1" bind:value={config.centralAxisXPosition} on:change={handleConfigChange}>
                </div>
                <div class="control-group">
                    <label for="adrProximityThreshold">ADR Proximity Pulse (%): <span>{config.adrProximityThreshold}</span></label>
                    <input type="range" id="adrProximityThreshold" min="0" max="100" step="1" bind:value={config.adrProximityThreshold} on:change={handleConfigChange}>
                </div>
                <!-- ADR Pulse Controls -->
                <div class="control-group">
                    <label for="adrPulseColor">ADR Pulse Color:</label>
                    <input type="color" id="adrPulseColor" bind:value={config.adrPulseColor} on:change={handleConfigChange}>
                </div>
                <div class="control-group">
                    <label for="adrPulseWidthRatio">ADR Pulse Width Ratio (of Viz Width): <span>{config.adrPulseWidthRatio?.toFixed(2)}</span></label>
                    <input type="range" id="adrPulseWidthRatio" min="0.1" max="1" step="0.05" bind:value={config.adrPulseWidthRatio} on:change={handleConfigChange}>
                </div>
                 <div class="control-group">
                    <label for="adrPulseHeight">ADR Pulse Height: <span>{config.adrPulseHeight}px</span></label>
                    <input type="range" id="adrPulseHeight" min="1" max="10" step="1" bind:value={config.adrPulseHeight} on:change={handleConfigChange}>
                </div>
            </div>

            <!-- Price Float & Display Controls -->
            <div class="control-group-container">
                <h3 class="group-title">Price Elements</h3>
                <div class="control-group">
                    <label for="priceFloatWidth">Price Float Width: <span>{config.priceFloatWidth}px</span></label>
                    <input type="range" id="priceFloatWidth" min="10" max="200" step="1" bind:value={config.priceFloatWidth} on:change={handleConfigChange}>
                </div>
                <div class="control-group">
                    <label for="priceFontSize">Price Font Size: <span>{config.priceFontSize}px</span></label>
                    <input type="range" id="priceFontSize" min="10" max="100" step="1" bind:value={config.priceFontSize} on:change={handleConfigChange}>
                </div>
                <div class="control-group">
                    <label for="showPipetteDigit">Show Pipette Digit</label>
                    <input type="checkbox" id="showPipetteDigit" bind:checked={config.showPipetteDigit} on:change={handleConfigChange}>
                </div>
            </div>

            <!-- Volatility Orb Controls -->
            <div class="control-group-container">
                <h3 class="group-title">Volatility Orb</h3>
                <div class="control-group">
                    <label for="showVolatilityOrb">Show Volatility Orb</label>
                    <input type="checkbox" id="showVolatilityOrb" bind:checked={config.showVolatilityOrb} on:change={handleConfigChange}>
                </div>
                <div class="control-group">
                    <label for="volatilityOrbBaseWidth">Orb Base Width: <span>{config.volatilityOrbBaseWidth}</span></label>
                    <input type="range" id="volatilityOrbBaseWidth" min="10" max="200" step="1" bind:value={config.volatilityOrbBaseWidth} on:change={handleConfigChange}>
                </div>
                <div class="control-group">
                    <label for="volatilityColorMode">Orb Color Mode</label>
                    <select id="volatilityColorMode" bind:value={config.volatilityColorMode} on:change={handleConfigChange}>
                        <option value="single">Single Hue</option>
                        <option value="intensity">Intensity Spectrum</option>
                        <option value="directional">Directional</option>
                    </select>
                </div>
            </div>

            <!-- Market Profile Controls -->
            <div class="control-group-container">
                <h3 class="group-title">Market Profile</h3>
                <div class="control-group">
                    <label for="showMarketProfile">Show Market Profile</label>
                    <input type="checkbox" id="showMarketProfile" bind:checked={config.showMarketProfile} on:change={handleConfigChange}>
                </div>
                <div class="control-group">
                    <label for="marketProfileView">View Mode</label>
                    <select id="marketProfileView" bind:value={config.marketProfileView} on:change={handleConfigChange}>
                        <option value="separate">Separate Buy/Sell</option>
                        <option value="combinedLeft">Combined (Left)</option>
                        <option value="combinedRight">Combined (Right)</option>
                    </select>
                </div>
                 <div class="control-group">
                    <label for="priceBucketMultiplier">Profile Detail / Stacking: <span>{config.priceBucketMultiplier}x</span></label>
                    <input type="range" id="priceBucketMultiplier" min="1" max="100" step="1" bind:value={config.priceBucketMultiplier} on:change={handleConfigChange}>
                </div>
                <div class="control-group">
                    <label for="marketProfileWidthRatio">Profile Width Ratio: <span>{config.marketProfileWidthRatio?.toFixed(2)}</span></label>
                    <input type="range" id="marketProfileWidthRatio" min="0.1" max="3" step="0.1" bind:value={config.marketProfileWidthRatio} on:change={handleConfigChange}>
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
  .debug-info {
      background-color: #4b5563; /* Slightly different background for debug */
      border: 1px solid #6b7280;
  }
  .info-grid {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 5px 10px;
      font-family: monospace;
      font-size: 0.9em;
  }
  .info-grid span:nth-child(odd) {
      font-weight: bold;
      color: #9ca3af;
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
  input[type="checkbox"] {
    width: auto;
    align-self: flex-start;
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
  .divider, hr {
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
  .status-connected { background-color: #22c55e; }
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
