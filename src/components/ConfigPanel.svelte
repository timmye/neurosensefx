<script>
  import { createEventDispatcher } from 'svelte';
  import { vizConfig } from '../stores.js';
  import { dataSourceMode, subscriptions, availableSymbols } from '../data/wsClient.js';

  export let config;

  const dispatch = createEventDispatcher();

  let symbolToAdd = 'EURUSD';
  
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

  function handleAddSymbol() {
      if (symbolToAdd) {
          dispatch('subscriptionChange', { symbols: [symbolToAdd.toUpperCase()], subscribe: true });
      }
  }

  function handleUnsubscribe(symbol) {
      dispatch('subscriptionChange', { symbols: [symbol], subscribe: false });
  }

</script>

<div class="panel">
  <!-- Data Source Selector -->
  <div class="control-group">
    <label for="dataSource">Data Source</label>
    <select id="dataSource" bind:value={$dataSourceMode} on:change={handleDataSourceChange}>
      <option value="simulated">Simulated</option>
      <option value="live">Live</option>
    </select>
  </div>

  <!-- Subscription Management (only shown in live mode) -->
  {#if $dataSourceMode === 'live'}
    <div class="control-group">
        <label for="symbolInput">Add Symbol</label>
        <div class="subscription-input">
            <input type="text" list="available-symbols" id="symbolInput" bind:value={symbolToAdd} placeholder="e.g., EURUSD" />
            <datalist id="available-symbols">
                {#each $availableSymbols as symbol}
                    <option value={symbol}>{symbol}</option>
                {/each}
            </datalist>
            <button on:click={handleAddSymbol}>Add</button>
        </div>
        
        <div class="subscriptions-list">
            <h4>Active Subscriptions:</h4>
            {#if $subscriptions.size > 0}
              <ul>
                  {#each Array.from($subscriptions) as sub (sub)}
                      <li>
                          {sub}
                          <button class="unsubscribe-btn" on:click={() => handleUnsubscribe(sub)}>x</button>
                      </li>
                  {/each}
              </ul>
            {:else}
              <p class="no-subs">No active subscriptions.</p>
            {/if}
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

  <!-- Global Display Configuration -->
  <h3>Global Display Configuration</h3>

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

  <!-- Volatility Orb Controls -->
  <div class="control-group">
      <label>Volatility Orb</label>
      <label class="checkbox-label">
          <input type="checkbox" bind:checked={config.showVolatilityOrb} on:change={handleConfigChange}>
          Show Volatility Orb
      </label>
      {#if config.showVolatilityOrb}
          <label for="volatilityColorMode">Color Mode</label>
          <select id="volatilityColorMode" bind:value={config.volatilityColorMode} on:change={handleConfigChange}>
              <option value="intensity">Intensity</option>
              <option value="directional">Directional</option>
              <option value="singleHue">Single Hue</option>
          </select>
          <label class="checkbox-label">
              <input type="checkbox" bind:checked={config.volatilityOrbInvertBrightness} on:change={handleConfigChange}>
              Invert Brightness
          </label>
           <label for="volatilityOrbBaseWidth">Base Width</label>
          <input type="range" id="volatilityOrbBaseWidth" min="10" max="100" bind:value={config.volatilityOrbBaseWidth} on:input={handleConfigChange}>
          <span>{config.volatilityOrbBaseWidth}</span>
      {/if}
  </div>

    <!-- Market Profile Controls -->
  <div class="control-group">
      <label>Market Profile</label>
       <label class="checkbox-label">
          <input type="checkbox" bind:checked={config.showMarketProfile} on:change={handleConfigChange}>
          Show Market Profile
      </label>
      {#if config.showMarketProfile}
           <label for="priceBucketSize">Bucket Size (Pips)</label>
          <input type="number" id="priceBucketSize" min="0.1" step="0.1" bind:value={config.priceBucketSize} on:input={handleConfigChange}>

          <label for="distributionDepthMode">Distribution Depth</label>
          <select id="distributionDepthMode" bind:value={config.distributionDepthMode} on:change={handleConfigChange}>
              <option value="all">All Ticks</option>
              <option value="percentage">Percentage</option>
          </select>
          {#if config.distributionDepthMode === 'percentage'}
              <label for="distributionPercentage">Percentage</label>
              <input type="range" id="distributionPercentage" min="1" max="100" bind:value={config.distributionPercentage} on:input={handleConfigChange}>
              <span>{config.distributionPercentage}%</span>
          {/if}

           <label for="marketProfileView">View Mode</label>
          <select id="marketProfileView" bind:value={config.marketProfileView} on:change={handleConfigChange}>
              <option value="bars">Bars</option>
              <option value="outline">Outline</option>
          </select>

          <label class="checkbox-label">
              <input type="checkbox" bind:checked={config.showSingleSidedProfile} on:change={handleConfigChange}>
              Show Single Sided Profile
          </label>
           {#if config.showSingleSidedProfile}
               <label for="singleSidedProfileSide">Single Side</label>
              <select id="singleSidedProfileSide" bind:value={config.singleSidedProfileSide} on:change={handleConfigChange}>
                  <option value="right">Right (Buy)</option>
                  <option value="left">Left (Sell)</option>
              </select>
          {/if}
      {/if}
  </div>

  <!-- Flash Controls -->
   <div class="control-group">
      <label>Flash Effects</label>
       <label class="checkbox-label">
          <input type="checkbox" bind:checked={config.showFlash} on:change={handleConfigChange}>
          Show Price Flash
      </label>
       {#if config.showFlash}
           <label for="flashThreshold">Flash Threshold (Pips)</label>
          <input type="number" id="flashThreshold" min="0.1" step="0.1" bind:value={config.flashThreshold} on:input={handleConfigChange}>
           <label for="flashIntensity">Flash Intensity (0-1)</label>
          <input type="range" id="flashIntensity" min="0" max="1" step="0.05" bind:value={config.flashIntensity} on:input={handleConfigChange}>
      {/if}

       <label class="checkbox-label">
          <input type="checkbox" bind:checked={config.showOrbFlash} on:change={handleConfigChange}>
          Show Orb Flash
      </label>
       {#if config.showOrbFlash}
           <label for="orbFlashThreshold">Orb Flash Threshold (Pips)</label>
          <input type="number" id="orbFlashThreshold" min="0.1" step="0.1" bind:value={config.orbFlashThreshold} on:input={handleConfigChange}>
           <label for="orbFlashIntensity">Orb Flash Intensity (0-1)</label>
          <input type="range" id="orbFlashIntensity" min="0" max="1" step="0.05" bind:value={config.orbFlashIntensity} on:input={handleConfigChange}>
      {/if}
  </div>

   <!-- Price Display Controls -->
   <div class="control-group">
      <label>Price Display</label>
       <label for="priceHorizontalOffset">Horizontal Offset</label>
      <input type="range" id="priceHorizontalOffset" min="-100" max="100" bind:value={config.priceHorizontalOffset} on:input={handleConfigChange}>
      <span>{config.priceHorizontalOffset}</span>

      <label for="priceFloatWidth">Float Width</label>
      <input type="range" id="priceFloatWidth" min="10" max="200" bind:value={config.priceFloatWidth} on:input={handleConfigChange}>
      <span>{config.priceFloatWidth}</span>

       <label for="priceFloatHeight">Float Height (Pips)</label>
      <input type="number" id="priceFloatHeight" min="0.1" step="0.1" bind:value={config.priceFloatHeight} on:input={handleConfigChange}>

       <label for="priceFloatXOffset">Float X Offset</label>
      <input type="range" id="priceFloatXOffset" min="-100" max="100" bind:value={config.priceFloatXOffset} on:input={handleConfigChange}>
      <span>{config.priceFloatXOffset}</span>
      
       <label for="bigFigureFontSizeRatio">Big Figure Size Ratio</label>
      <input type="number" id="bigFigureFontSizeRatio" min="0.5" max="2" step="0.05" bind:value={config.bigFigureFontSizeRatio} on:input={handleConfigChange}>

       <label for="pipFontSizeRatio">Pip Size Ratio</label>
      <input type="number" id="pipFontSizeRatio" min="0.5" max="2" step="0.05" bind:value={config.pipFontSizeRatio} on:input={handleConfigChange}>

       <label for="pipetteFontSizeRatio">Pipette Size Ratio</label>
      <input type="number" id="pipetteFontSizeRatio" min="0.5" max="2" step="0.05" bind:value={config.pipetteFontSizeRatio} on:input={handleConfigChange}>

       <label class="checkbox-label">
          <input type="checkbox" bind:checked={config.showPipetteDigit} on:change={handleConfigChange}>
          Show Pipette Digit
      </label>

       <label class="checkbox-label">
          <input type="checkbox" bind:checked={config.showPriceBoundingBox} on:change={handleConfigChange}>
          Show Bounding Box
      </label>
       <label class="checkbox-label">
          <input type="checkbox" bind:checked={config.showPriceBackground} on:change={handleConfigChange}>
          Show Background
      </label>

       <label for="priceDisplayPadding">Display Padding</label>
      <input type="number" id="priceDisplayPadding" min="0" max="20" step="1" bind:value={config.priceDisplayPadding} on:input={handleConfigChange}>

       <label class="checkbox-label">
          <input type="checkbox" bind:checked={config.priceStaticColor} on:change={handleConfigChange}>
          Use Static Color
      </label>
       {#if !config.priceStaticColor}
           <label for="priceUpColor">Price Up Color</label>
          <input type="color" id="priceUpColor" bind:value={config.priceUpColor} on:input={handleConfigChange}>
           <label for="priceDownColor">Price Down Color</label>
          <input type="color" id="priceDownColor" bind:value={config.priceDownColor} on:input={handleConfigChange}>
      {/if}
  </div>

    <!-- Layout Controls -->
   <div class="control-group">
      <label>Layout</label>
       <label for="visualizationsContentWidth">Canvas Width</label>
      <input type="number" id="visualizationsContentWidth" min="100" max="500" bind:value={config.visualizationsContentWidth} on:input={handleConfigChange}>

       <label for="meterHeight">Canvas Height</label>
      <input type="number" id="meterHeight" min="50" max="300" bind:value={config.meterHeight} on:input={handleConfigChange}>
      
      <label for="centralAxisXPosition">Central Axis X Position</label>
      <input type="range" id="centralAxisXPosition" min="0" max="500" bind:value={config.centralAxisXPosition} on:input={handleConfigChange}>
      <span>{config.centralAxisXPosition}</span>

       <label for="centralMeterFixedThickness">Central Meter Thickness</label>
      <input type="number" id="centralMeterFixedThickness" min="1" max="20" bind:value={config.centralMeterFixedThickness} on:input={handleConfigChange}>
  </div>

</div>

<style>
  .panel { background-color: #1f2937; padding: 15px; border-radius: 8px; display: flex; flex-direction: column; gap: 20px; color: #d1d5db; }
  .control-group { display: flex; flex-direction: column; gap: 8px; }
  label { font-weight: 500; color: #9ca3af; }
  input[type="range"] { -webkit-appearance: none; appearance: none; width: 100%; height: 8px; background: #4b5563; border-radius: 5px; outline: none; }
  input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; background: #60a5fa; cursor: pointer; border-radius: 50%; }
  select, input[type="text"], input[type="number"], input[type="color"] { width: 100%; padding: 8px; background-color: #374151; border: 1px solid #4b5563; border-radius: 4px; color: #d1d5db; }
  button { padding: 8px 12px; background-color: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; transition: background-color 0.2s; }
  button:hover { background-color: #2563eb; }
  .subscription-input { display: flex; }
  .subscription-input input { flex-grow: 1; border-top-right-radius: 0;
  border-bottom-right-radius: 0; }
  .subscription-input button { border-top-left-radius: 0; border-bottom-left-radius: 0; }
  .subscriptions-list { margin-top: 10px; }
  .subscriptions-list h4 { margin: 0 0 8px 0; font-size: 0.875rem; color: #9ca3af; }
  .subscriptions-list ul { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 8px; }
  .subscriptions-list li { background-color: #374151; padding: 5px 10px; border-radius: 12px; display: flex; align-items: center; gap: 8px; font-size: 0.875rem; }
  .unsubscribe-btn { background-color: #ef4444; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 12px; line-height: 20px; text-align: center; padding: 0; }
  .no-subs { font-style: italic; color: #6b7280; font-size: 0.875rem; }
   .checkbox-label {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
    }
    .checkbox-label input[type="checkbox"] {
        margin: 0; /* Remove default margin */
        width: auto; /* Allow checkbox to be natural width */
    }
</style>
