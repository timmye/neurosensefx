<script>
  export let config = {};

  function updateConfig(key, value) {
    config[key] = value;
    // Dispatch an event to notify the parent component of the change
    const event = new CustomEvent('configchange', { detail: { config } });
    window.dispatchEvent(event);
  }
</script>

<div class="control-panel">
  <h2 class="text-lg font-semibold text-blue-300 mb-3">Configuration</h2>

  <!-- Day Range Meter -->
  <div class="mb-4">
    <h3 class="font-semibold text-gray-400">Day Range Meter (Primary Y-Axis Reference)</h3>
    <p class="text-xs text-gray-500 mb-2">Central vertical axis for price reference.</p>
    
    <label class="control-label">ADR Range: {config.adrRange}</label>
    <input type="range" min="10" max="200" bind:value={config.adrRange} on:input={(e) => updateConfig('adrRange', parseInt(e.target.value))} />
    
    <label class="control-label">ADR Proximity Threshold: {config.adrProximityThreshold}</label>
    <input type="range" min="1" max="50" bind:value={config.adrProximityThreshold} on:input={(e) => updateConfig('adrProximityThreshold', parseInt(e.target.value))} />
  </div>

  <!-- Price Float -->
  <div class="mb-4">
    <h3 class="font-semibold text-gray-400">Price Float</h3>
    <p class="text-xs text-gray-500 mb-2">Represents the current FX price.</p>
    
    <label class="control-label">Width: {config.priceFloatWidth}</label>
    <input type="range" min="10" max="300" bind:value={config.priceFloatWidth} on:input={(e) => updateConfig('priceFloatWidth', parseInt(e.target.value))} />
    
    <label class="control-label">X-Offset: {config.priceFloatXOffset}</label>
    <input type="range" min="-100" max="100" bind:value={config.priceFloatXOffset} on:input={(e) => updateConfig('priceFloatXOffset', parseInt(e.target.value))} />
  </div>

  <!-- Price Display -->
  <div class="mb-4">
    <h3 class="font-semibold text-gray-400">Price Display (Numeric)</h3>
    <p class="text-xs text-gray-500 mb-2">Tracks the Price Float vertically.</p>
    
    <label class="control-label">Font Size: {config.priceFontSize}</label>
    <input type="range" min="8" max="72" bind:value={config.priceFontSize} on:input={(e) => updateConfig('priceFontSize', parseInt(e.target.value))} />

    <label class="control-label">Font Weight</label>
    <select bind:value={config.priceFontWeight} on:change={(e) => updateConfig('priceFontWeight', e.target.value)}>
      <option value="400">Normal</option>
      <option value="500">Medium</option>
      <option value="600">Semibold</option>
      <option value="700">Bold</option>
    </select>

    <label class="control-label">Big Figure Ratio: {config.bigFigureFontSizeRatio}</label>
    <input type="range" min="0.5" max="2" step="0.1" bind:value={config.bigFigureFontSizeRatio} on:input={(e) => updateConfig('bigFigureFontSizeRatio', parseFloat(e.target.value))} />

    <label class="control-label">Pip Ratio: {config.pipFontSizeRatio}</label>
    <input type="range" min="0.5" max="2" step="0.1" bind:value={config.pipFontSizeRatio} on:input={(e) => updateConfig('pipFontSizeRatio', parseFloat(e.target.value))} />
    
    <label class="control-label">Pipette Ratio: {config.pipetteFontSizeRatio}</label>
    <input type="range" min="0.5" max="2" step="0.1" bind:value={config.pipetteFontSizeRatio} on:input={(e) => updateConfig('pipetteFontSizeRatio', parseFloat(e.target.value))} />

    <label class="control-label">Toggle Pipette Digit</label>
    <input type="checkbox" bind:checked={config.showPipetteDigit} on:change={(e) => updateConfig('showPipetteDigit', e.target.checked)} />

    <label class="control-label">Show Bounding Box</label>
    <input type="checkbox" bind:checked={config.showPriceBoundingBox} on:change={(e) => updateConfig('showPriceBoundingBox', e.target.checked)} />

    <label class="control-label">Show Background</label>
    <input type="checkbox" bind:checked={config.showPriceBackground} on:change={(e) => updateConfig('showPriceBackground', e.target.checked)} />
  </div>

  <!-- Volatility Orb -->
  <div class="mb-4">
    <h3 class="font-semibold text-gray-400">Volatility Orb</h3>
    <p class="text-xs text-gray-500 mb-2">Visual representation of market volatility.</p>
    
    <label class="control-label">Base Width: {config.volatilityOrbBaseWidth}</label>
    <input type="range" min="10" max="200" bind:value={config.volatilityOrbBaseWidth} on:input={(e) => updateConfig('volatilityOrbBaseWidth', parseInt(e.target.value))} />

    <label class="control-label">Color Mode</label>
    <select bind:value={config.volatilityColorMode} on:change={(e) => updateConfig('volatilityColorMode', e.target.value)}>
      <option value="directional">Directional</option>
      <option value="intensity">Intensity</option>
      <option value="singleHue">Single Hue</option>
    </select>
    
    <label class="control-label">Invert Brightness (Inward Growth)</label>
    <input type="checkbox" bind:checked={config.volatilityOrbInvertBrightness} on:change={(e) => updateConfig('volatilityOrbInvertBrightness', e.target.checked)} />
  </div>

  <!-- Market Profile -->
  <div class="mb-4">
    <h3 class="font-semibold text-gray-400">Market Profile</h3>
    <p class="text-xs text-gray-500 mb-2">Visual representation of price distribution.</p>
    
    <label class="control-label">Toggle Market Profile</label>
    <input type="checkbox" bind:checked={config.showMarketProfile} on:change={(e) => updateConfig('showMarketProfile', e.target.checked)} />

    <label class="control-label">View Mode</label>
    <select bind:value={config.marketProfileView} on:change={(e) => updateConfig('marketProfileView', e.target.value)}>
      <option value="bars">Bars</option>
      <option value="outline">Outline</option>
    </select>

    <label class="control-label">Distribution Depth Mode</label>
    <select bind:value={config.distributionDepthMode} on:change={(e) => updateConfig('distributionDepthMode', e.target.value)}>
      <option value="all">All</option>
      <option value="percentage">Percentage</option>
    </select>

    {#if config.distributionDepthMode === 'percentage'}
      <label class="control-label">Distribution Percentage: {config.distributionPercentage}%</label>
      <input type="range" min="1" max="100" bind:value={config.distributionPercentage} on:input={(e) => updateConfig('distributionPercentage', parseInt(e.target.value))} />
    {/if}

    <label class="control-label">Single-Sided Profile</label>
    <input type="checkbox" bind:checked={config.showSingleSidedProfile} on:change={(e) => updateConfig('showSingleSidedProfile', e.target.checked)} />

    {#if config.showSingleSidedProfile}
      <div>
        <label class="control-label">Side</label>
        <label><input type="radio" bind:group={config.singleSidedProfileSide} on:change={(e) => updateConfig('singleSidedProfileSide', 'left')} value="left" /> Left</label>
        <label><input type="radio" bind:group={config.singleSidedProfileSide} on:change={(e) => updateConfig('singleSidedProfileSide', 'right')} value="right" /> Right</label>
      </div>
    {/if}
  </div>

  <!-- Flashing Effects -->
  <div class="mb-4">
    <h3 class="font-semibold text-gray-400">Flashing Effects</h3>
    <p class="text-xs text-gray-500 mb-2">Visual alerts for significant market events.</p>
    
    <label class="control-label">Toggle Flash on Tick</label>
    <input type="checkbox" bind:checked={config.showFlash} on:change={(e) => updateConfig('showFlash', e.target.checked)} />

    <label class="control-label">Toggle Orb Flash</label>
    <input type="checkbox" bind:checked={config.showOrbFlash} on:change={(e) => updateConfig('showOrbFlash', e.target.checked)} />
  </div>
</div>

<style>
  .control-panel {
    background-color: #1f2937;
    padding: 1rem;
    border-radius: 0.5rem;
    color: #d1d5db;
  }
  .control-label {
    display: block;
    margin-top: 0.5rem;
    font-size: 0.875rem;
  }
</style>
