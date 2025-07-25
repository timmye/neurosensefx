<script>
  import { createEventDispatcher } from 'svelte';
  import { 
      wsStatus, // Use the unified status store
      dataSourceMode,
      availableSymbols, 
      subscriptions,
      connect,
      disconnect,
      subscribe,
      unsubscribe,
  } from '../data/wsClient.js';
  import { symbolStore } from '../data/symbolStore.js';

  export let selectedSymbol; // Can be null initially
  export let config; // Can be undefined initially

  const dispatch = createEventDispatcher();

  let symbolInput = 'EURUSD';

  function handleConfigChange() {
      if (selectedSymbol && config) {
          symbolStore.updateConfig(selectedSymbol, config);
      }
  }

  function handleReset() {
      if (selectedSymbol) {
          symbolStore.resetConfig(selectedSymbol);
      }
  }

  function handleConnect() {
      connect();
  }

  function handleDisconnect() {
      disconnect();
  }

  function handleSubscribe() {
      // Only allow subscribing if a symbol is entered AND the WebSocket is connected
      if (symbolInput && $wsStatus === 'connected') {
          subscribe([symbolInput.toUpperCase()]);
          symbolInput = '';
      } else if ($wsStatus !== 'connected') {
          console.warn('Cannot subscribe, live data source not connected. Current status:', $wsStatus);
      }
  }

  function handleUnsubscribe(symbol) {
      // Only allow unsubscribing if the WebSocket is connected
       if ($wsStatus === 'connected') {
        unsubscribe([symbol]);
       } else {
           console.warn('Cannot unsubscribe, live data source not connected. Current status:', $wsStatus);
       }
  }

  // No need to handle data source change directly here, App.svelte does that
  // function handleDataSourceChange(event) {...}

</script>

<div class="panel-wrapper">
  <div class="panel">
      <div class="panel-header">
          <h1 class="panel-title">Adaptive Flow Meter</h1>
          <p class="panel-description">Tune the simulation and visual feedback.</p>
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

          <!-- Simulation Controls -->
          {#if $dataSourceMode === 'simulated' && config}
              <div class="control-group-container">
                <h2 class="group-title">Simulation Settings</h2>
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

          <!-- Live Data Controls -->
          {#if $dataSourceMode === 'live'}
              <div class="control-group-container">
                  <div class="title-bar">
                      <h2 class="group-title">Live Connection</h2>
                      <div class="connection-status status-{$wsStatus}">
                          {$wsStatus}
                      </div>
                  </div>
                  <div class="control-group">
                      {#if $wsStatus === 'disconnected' || $wsStatus === 'error'}
                          <button class="action-button connect" on:click={handleConnect}>Connect</button>
                      {:else if $wsStatus === 'ws-connecting' || $wsStatus === 'ws-open' || $wsStatus === 'ctrader-connecting'}
                          <button class="action-button" disabled>Connecting...</button>
                      {:else if $wsStatus === 'connected'}
                          <button class="action-button disconnect" on:click={handleDisconnect}>Disconnect</button>
                      {/if}
                  </div>

                  {#if $wsStatus === 'connected'}
                      <div class="control-group">
                          <label for="symbolInput">Subscribe to Symbol</label>
                          <div class="subscription-input">
                              <input list="availableSymbols" id="symbolInput" name="symbolInput" bind:value={symbolInput} placeholder="e.g., EURUSD" />
                              <datalist id="availableSymbols">
                                  {#each $availableSymbols as symbol}
                                      <option value={symbol}>{symbol}</option>
                                  {/each}
                              </datalist>
                              <button on:click={handleSubscribe} disabled={!symbolInput}>Subscribe</button>
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
              </div>
          {/if}
          
          {#if config}
            <hr/>
            <div class="title-bar">
                <h2 class="group-title">Visual Settings</h2>
                <button class="reset-button" on:click={handleReset}>Reset to Defaults</button>
            </div>

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
                    <label for="centralAxisXPosition">Central Axis Position: <span>{config.centralAxisXPosition}px</span></label>
                    <input type="range" id="centralAxisXPosition" min="0" max={config.visualizationsContentWidth} bind:value={config.centralAxisXPosition} on:input={handleConfigChange}>
                </div>
                <div class="control-group">
                    <label for="adrRange">ADR (Pips): <span>{config.adrRange}</span></label>
                    <input type="range" id="adrRange" min="10" max="300" bind:value={config.adrRange} on:input={handleConfigChange}>
                </div>
                <div class="control-group">
                    <label for="adrProximityThreshold">ADR Proximity Pulse Threshold: <span>{config.adrProximityThreshold}%</span></label>
                    <input type="range" id="adrProximityThreshold" min="0" max="50" bind:value={config.adrProximityThreshold} on:input={handleConfigChange}>
                </div>
            </div>

            <hr/>

            <!-- Price Representation -->
            <div class="control-group-container">
              <h3 class="group-title">Price Representation</h3>
              <div class="control-grid">
                <div class="control-group">
                    <label for="priceFontSize">Base Font Size: <span>{config.priceFontSize}px</span></label>
                    <input type="range" id="priceFontSize" min="10" max="100" bind:value={config.priceFontSize} on:input={handleConfigChange}>
                </div>
                <div class="control-group">
                    <label for="priceFontWeight">Font Weight: <span>{config.priceFontWeight}</span></label>
                    <input type="range" id="priceFontWeight" min="100" max="900" step="100" bind:value={config.priceFontWeight} on:input={handleConfigChange}>
                </div>
                <div class="control-group">
                    <label for="priceHorizontalOffset">H-Offset: <span>{config.priceHorizontalOffset}px</span></label>
                    <input type="range" id="priceHorizontalOffset" min="-100" max="100" bind:value={config.priceHorizontalOffset} on:input={handleConfigChange}>
                </div>
                <div class="control-group">
                    <label for="priceDisplayPadding">Padding: <span>{config.priceDisplayPadding}px</span></label>
                    <input type="range" id="priceDisplayPadding" min="0" max="20" bind:value={config.priceDisplayPadding} on:input={handleConfigChange}>
                </div>
                <div class="control-group">
                    <label for="bigFigureFontSizeRatio">Big Fig Ratio: <span>{config.bigFigureFontSizeRatio.toFixed(1)}x</span></label>
                    <input type="range" id="bigFigureFontSizeRatio" min="0.5" max="2" step="0.1" bind:value={config.bigFigureFontSizeRatio} on:input={handleConfigChange}>
                </div>
                <div class="control-group">
                    <label for="pipFontSizeRatio">Pip Ratio: <span>{config.pipFontSizeRatio.toFixed(1)}x</span></label>
                    <input type="range" id="pipFontSizeRatio" min="0.5" max="2" step="0.1" bind:value={config.pipFontSizeRatio} on:input={handleConfigChange}>
                </div>
                 <div class="control-group">
                    <label for="pipetteFontSizeRatio">Pipette Ratio: <span>{config.pipetteFontSizeRatio.toFixed(1)}x</span></label>
                    <input type="range" id="pipetteFontSizeRatio" min="0.5" max="2" step="0.1" bind:value={config.pipetteFontSizeRatio} on:input={handleConfigChange}>
                </div>
                <div class="control-group colors">
                    <label for="priceUpColor">Up Color</label>
                    <input type="color" id="priceUpColor" bind:value={config.priceUpColor} on:input={handleConfigChange} disabled={config.priceUseStaticColor}>
                </div>
                <div class="control-group colors">
                    <label for="priceDownColor">Down Color</label>
                    <input type="color" id="priceDownColor" bind:value={config.priceDownColor} on:input={handleConfigChange} disabled={config.priceUseStaticColor}>
                </div>
              </div>
               <div class="toggle-group">
                  <div class="toggle-switch">
                      <span>Use Static Color</span>
                      <input type="checkbox" id="priceUseStaticColor" bind:checked={config.priceUseStaticColor} on:change={handleConfigChange}>
                      <label for="priceUseStaticColor">Toggle Static Color</label>
                  </div>
                  {#if config.priceUseStaticColor}
                    <div class="control-group colors">
                        <label for="priceStaticColor">Static Color</label>
                        <input type="color" id="priceStaticColor" bind:value={config.priceStaticColor} on:input={handleConfigChange}>
                    </div>
                  {/if}
               </div>
               <div class="toggle-group">
                    <div class="toggle-switch">
                        <span>Show B-Box</span>
                        <input type="checkbox" id="showPriceBoundingBox" bind:checked={config.showPriceBoundingBox} on:change={handleConfigChange}>
                        <label for="showPriceBoundingBox">Toggle B-Box</label>
                    </div>
                    <div class="toggle-switch">
                        <span>Show BG</span>
                        <input type="checkbox" id="showPriceBackground" bind:checked={config.showPriceBackground} on:change={handleConfigChange}>
                        <label for="showPriceBackground">Toggle BG</label>
                    </div>
                    <div class="toggle-switch">
                        <span>Show Pipette</span>
                        <input type="checkbox" id="showPipetteDigit" bind:checked={config.showPipetteDigit} on:change={handleConfigChange}>
                        <label for="showPipetteDigit">Toggle Pipette</label>
                    </div>
                 </div>
              </div>

              <hr/>

              <!-- Price Float Element -->
              <div class="control-group-container">
                <h3 class="group-title">Price Float Element</h3>
                <div class="control-grid">
                  <div class="control-group">
                      <label for="priceFloatWidth">Width: <span>{config.priceFloatWidth}</span></label>
                      <input type="range" id="priceFloatWidth" min="1" max="200" bind:value={config.priceFloatWidth} on:input={handleConfigChange}>
                  </div>
                  <div class="control-group">
                      <label for="priceFloatHeight">Height: <span>{config.priceFloatHeight.toFixed(1)}</span></label>
                      <input type="range" id="priceFloatHeight" min="0.1" max="10" step="0.1" bind:value={config.priceFloatHeight} on:input={handleConfigChange}>
                  </div>
                  <div class="control-group">
                      <label for="priceFloatXOffset">X Offset: <span>{config.priceFloatXOffset}</span></label>
                      <input type="range" id="priceFloatXOffset" min="-100" max="100" bind:value={config.priceFloatXOffset} on:input={handleConfigChange}>
                  </div>
                </div>
              </div>

              <hr/>

              <!-- Dynamic Feedback -->
              <div class="control-group-container">
                  <h3 class="group-title">Dynamic Feedback</h3>
                  <div class="control-grid">
                    <!-- Volatility Orb -->
                    <div class="control-group nested">
                        <h4 class="nested-title">Volatility Orb</h4>
                        <div class="toggle-switch standalone">
                            <span>Show Orb</span>
                            <input type="checkbox" id="showVolatilityOrb" bind:checked={config.showVolatilityOrb} on:change={handleConfigChange}>
                            <label for="showVolatilityOrb">Toggle Orb</label>
                        </div>
                        {#if config.showVolatilityOrb}
                            <label for="volatilityColorMode">Color Mode</label>
                            <select id="volatilityColorMode" bind:value={config.volatilityColorMode} on:change={handleConfigChange}>
                                <option value="intensity">Intensity</option>
                                <option value="directional">Directional</option>
                                <option value="singleHue">Single Hue</option>
                            </select>
                            <label for="volatilityOrbBaseWidth">Base Width: <span>{config.volatilityOrbBaseWidth}</span></label>
                            <input type="range" id="volatilityOrbBaseWidth" min="10" max="200" bind:value={config.volatilityOrbBaseWidth} on:input={handleConfigChange}>
                            <label for="volatilitySizeMultiplier">Size Multiplier: <span>{config.volatilitySizeMultiplier.toFixed(1)}x</span></label>
                            <input type="range" min="0.1" max="3" step="0.1" bind:value={config.volatilitySizeMultiplier} on:input={handleConfigChange}>
                            <div class="toggle-switch">
                                <span>Invert Brightness</span>
                                <input type="checkbox" id="volatilityOrbInvertBrightness" bind:checked={config.volatilityOrbInvertBrightness} on:change={handleConfigChange}>
                                <label for="volatilityOrbInvertBrightness">Toggle Invert</label>
                            </div>
                        {/if}
                    </div>
                    <!-- Flash Effects -->
                    <div class="control-group nested">
                        <h4 class="nested-title">Flash Effects</h4>
                        <div class="toggle-switch standalone">
                            <span>Price Flash</span>
                            <input type="checkbox" id="showFlash" bind:checked={config.showFlash} on:change={handleConfigChange}>
                            <label for="showFlash">Toggle Price Flash</label>
                        </div>
                        {#if config.showFlash}
                            <label>Threshold: <span>{config.flashThreshold.toFixed(1)}</span></label>
                            <input type="range" min="0" max="5" step="0.1" bind:value={config.flashThreshold} on:input={handleConfigChange}>
                            <label>Intensity: <span>{config.flashIntensity.toFixed(1)}</span></label>
                            <input type="range" min="0.1" max="1" step="0.1" bind:value={config.flashIntensity} on:input={handleConfigChange}>
                        {/if}
                        <div class="toggle-switch standalone">
                            <span>Orb Flash</span>
                            <input type="checkbox" id="showOrbFlash" bind:checked={config.showOrbFlash} on:change={handleConfigChange}>
                            <label for="showOrbFlash">Toggle Orb Flash</label>
                        </div>
                        {#if config.showOrbFlash}
                            <label>Threshold: <span>{config.orbFlashThreshold.toFixed(1)}</span></label>
                            <input type="range" min="0" max="5" step="0.1" bind:value={config.orbFlashThreshold} on:input={handleConfigChange}>
                            <label>Intensity: <span>{config.orbFlashIntensity.toFixed(1)}</span></label>
                            <input type="range" min="0.1" max="1" step="0.1" bind:value={config.orbFlashIntensity} on:input={handleConfigChange}>
                        {/if}
                    </div>
                  </div>
              </div>
              
              <hr/>

              <!-- Contextual Layers -->
              <div class="control-group-container">
                  <h3 class="group-title">Contextual Layers</h3>
                  <div class="control-group nested">
                      <h4 class="nested-title">Market Profile</h4>
                      <div class="toggle-switch standalone">
                          <span>Show Profile</span>
                          <input type="checkbox" id="showMarketProfile" bind:checked={config.showMarketProfile} on:change={handleConfigChange}>
                          <label for="showMarketProfile">Toggle Profile</label>
                      </div>
                      {#if config.showMarketProfile}
                          <label for="marketProfileView">View Mode</label>
                          <select id="marketProfileView" bind:value={config.marketProfileView} on:change={handleConfigChange}>
                              <option value="bars">Bars</option>
                              <option value="outline">Outline</option>
                          </select>
                          <label for="distributionDepthMode">Data Depth</label>
                          <select id="distributionDepthMode" bind:value={config.distributionDepthMode} on:change={handleConfigChange}>
                              <option value="all">All Ticks</option>
                              <option value="recent">Recent Ticks</option>
                          </select>
                          {#if config.distributionDepthMode === 'recent'}
                              <label>Recent Ticks %: <span>{config.distributionPercentage}%</span></label>
                              <input type="range" min="1" max="100" bind:value={config.distributionPercentage} on:input={handleConfigChange}>
                          {/if}
                          <div class="toggle-switch">
                              <span>Single-Sided</span>
                              <input type="checkbox" id="showSingleSidedProfile" bind:checked={config.showSingleSidedProfile} on:change={handleConfigChange}>
                              <label for="showSingleSidedProfile">Toggle Single-Sided</label>
                          </div>
                          {#if config.showSingleSidedProfile}
                              <label for="singleSidedProfileSide">Side</label>
                              <select id="singleSidedProfileSide" bind:value={config.singleSidedProfileSide} on:change={handleConfigChange}>
                                  <option value="right">Buy</option>
                                  <option value="left">Sell</option>
                              </select>
                          {/if}
                      {/if}
                  </div>
              </div>
          {/if}
      </div>
  </div>
</div>

<style>
  /* General Panel Styles */
  .panel-wrapper {
    height: 100vh;
    width: 100%;
    background-color: #111827;
    display: flex;
    flex-direction: column;
    border-left: 1px solid #374151;
  }
  .panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
  }
  .panel-header {
    padding: 20px;
    border-bottom: 1px solid #374151;
  }
  .panel-title {
    font-size: 1.5rem;
    font-weight: bold;
    color: #c7d2fe;
    margin: 0;
  }
  .panel-description {
    color: #9ca3af;
    margin: 4px 0 0 0;
  }
  .panel-content {
    padding: 20px;
    overflow-y: auto;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  /* Scrollbar */
  .panel-content::-webkit-scrollbar { width: 8px; }
  .panel-content::-webkit-scrollbar-track { background: #1f2937; }
  .panel-content::-webkit-scrollbar-thumb {
    background-color: #4b5563;
    border-radius: 4px;
    border: 2px solid #1f2937;
  }

  /* Control Groups and Titles */
  hr {
    border: none;
    height: 1px;
    background-color: #374151;
  }
  .title-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .group-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: #a5b4fc;
  }
  .control-group-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .control-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .control-group label {
    font-weight: 500;
    color: #9ca3af;
    font-size: 0.875rem;
    display: flex;
    justify-content: space-between;
  }

  /* Connection Status & Buttons */
  .connection-status {
    padding: 4px 12px;
    border-radius: 12px;
    font-weight: 600;
    text-transform: capitalize;
  }
  .status-disconnected { background-color: #4b5563; color: #d1d5db; }
  .status-ws-connecting { background-color: #f59e0b; color: #1f2937; }
  .status-ws-open { background-color: #f59e0b; color: #1f2937; }
   .status-ctrader-connecting { background-color: #f59e0b; color: #1f2937; }
  .status-connected { background-color: #10b981; color: #d1d5db; }
  .status-error { background-color: #ef4444; color: #fee2e2; }

  .action-button {
    width: 100%;
    padding: 10px;
    font-size: 1rem;
    font-weight: 600;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  .action-button.connect { background-color: #2563eb; color: white; }
  .action-button.connect:hover { background-color: #1d4ed8; }
  .action-button.disconnect { background-color: #9ca3af; color: #1f2937; }
  .action-button.disconnect:hover { background-color: #d1d5db; }
  .action-button:disabled { background-color: #374151; color: #9ca3af; cursor: not-allowed; }

  .reset-button {
    background: #374151;
    color: #9ca3af;
    border: none;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
  }
  .reset-button:hover { background: #4b5563; color: #e5e7eb; }

  /* Subscription styles */
  .subscription-input {
      display: flex;
  }
  .subscription-input input {
      flex-grow: 1;
      padding: 8px;
      background-color: #374151;
      border: 1px solid #4b5563;
      border-radius: 4px;
      color: #d1d5db;
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
  }
  .subscription-input button {
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
      padding: 8px 12px;
      background-color: #4f46e5;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
  }
  .subscription-input button:disabled {
      background-color: #374151;
      cursor: not-allowed;
  }
  
  .subscriptions-list ul {
      list-style: none;
      padding: 0;
      margin-top: 10px;
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
      font-size: 0.875rem;
  }
  .unsubscribe-btn {
      background-color: #ef4444;
      color: white;
      border: none;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      cursor: pointer;
      line-height: 20px;
      text-align: center;
  }
</style>
