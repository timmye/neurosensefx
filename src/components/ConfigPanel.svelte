<script>
  import { createEventDispatcher } from 'svelte';
  import { dataSourceMode } from '../data/wsClient.js';
  import { symbolStore } from '../data/symbolStore.js';
  import ConnectionManager from './config/ConnectionManager.svelte';

  export let selectedSymbol; // Can be null initially
  export let config; // Can be undefined initially

  const dispatch = createEventDispatcher();

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
              <ConnectionManager />
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
</style>
