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

  <!-- Canvas Dimensions -->
  <div class="mb-4">
    <h3 class="font-semibold text-gray-400">Canvas Dimensions</h3>
    <p class="text-xs text-gray-500 mb-2">Overall canvas size settings.</p>
    
    <label class="control-label">Width: {config.visualizationsContentWidth || 400}</label>
    <input type="range" min="200" max="800" bind:value={config.visualizationsContentWidth} on:input={(e) => updateConfig('visualizationsContentWidth', parseInt(e.target.value))} />
    
    <label class="control-label">Height: {config.meterHeight || 200}</label>
    <input type="range" min="100" max="600" bind:value={config.meterHeight} on:input={(e) => updateConfig('meterHeight', parseInt(e.target.value))} />
  </div>

  <!-- Day Range Meter -->
  <div class="mb-4">
    <h3 class="font-semibold text-gray-400">Day Range Meter (Primary Y-Axis Reference)</h3>
    <p class="text-xs text-gray-500 mb-2">Central vertical axis for price reference.</p>
    
    <label class="control-label">ADR Range (pips): {config.adrRange || 100}</label>
    <input type="range" min="10" max="200" bind:value={config.adrRange} on:input={(e) => updateConfig('adrRange', parseInt(e.target.value))} />
    
    <label class="control-label">Central Axis X Position: {config.centralAxisXPosition || 200}</label>
    <input type="range" min="50" max="750" bind:value={config.centralAxisXPosition} on:input={(e) => updateConfig('centralAxisXPosition', parseInt(e.target.value))} />
    
    <label class="control-label">ADR Proximity Threshold (%): {config.adrProximityThreshold || 10}</label>
    <input type="range" min="1" max="50" bind:value={config.adrProximityThreshold} on:input={(e) => updateConfig('adrProximityThreshold', parseInt(e.target.value))} />
  </div>

  <!-- Price Float -->
  <div class="mb-4">
    <h3 class="font-semibold text-gray-400">Price Float</h3>
    <p class="text-xs text-gray-500 mb-2">Represents the current FX price position.</p>
    
    <label class="control-label">Width: {config.priceFloatWidth || 100}</label>
    <input type="range" min="10" max="300" bind:value={config.priceFloatWidth} on:input={(e) => updateConfig('priceFloatWidth', parseInt(e.target.value))} />
    
    <label class="control-label">Height (pips): {config.priceFloatHeight || 1}</label>
    <input type="range" min="0.5" max="5" step="0.5" bind:value={config.priceFloatHeight} on:input={(e) => updateConfig('priceFloatHeight', parseFloat(e.target.value))} />
    
    <label class="control-label">X-Offset: {config.priceFloatXOffset || 0}</label>
    <input type="range" min="-100" max="100" bind:value={config.priceFloatXOffset} on:input={(e) => updateConfig('priceFloatXOffset', parseInt(e.target.value))} />
  </div>

  <!-- Price Display -->
  <div class="mb-4">
    <h3 class="font-semibold text-gray-400">Price Display (Numeric)</h3>
    <p class="text-xs text-gray-500 mb-2">Tracks the Price Float vertically.</p>
    
    <label class="control-label">Font Size: {config.priceFontSize || 14}</label>
    <input type="range" min="8" max="72" bind:value={config.priceFontSize} on:input={(e) => updateConfig('priceFontSize', parseInt(e.target.value))} />

    <label class="control-label">Font Weight</label>
    <select bind:value={config.priceFontWeight} on:change={(e) => updateConfig('priceFontWeight', e.target.value)}>
      <option value="400">Normal</option>
      <option value="500">Medium</option>
      <option value="600">Semibold</option>
      <option value="700">Bold</option>
    </select>

    <label class="control-label">Horizontal Offset: {config.priceHorizontalOffset || 0}</label>
    <input type="range" min="-200" max="200" bind:value={config.priceHorizontalOffset} on:input={(e) => updateConfig('priceHorizontalOffset', parseInt(e.target.value))} />

    <label class="control-label">Big Figure Ratio: {config.bigFigureFontSizeRatio || 1.0}</label>
    <input type="range" min="0.5" max="2" step="0.1" bind:value={config.bigFigureFontSizeRatio} on:input={(e) => updateConfig('bigFigureFontSizeRatio', parseFloat(e.target.value))} />

    <label class="control-label">Pip Ratio: {config.pipFontSizeRatio || 1.0}</label>
    <input type="range" min="0.5" max="2" step="0.1" bind:value={config.pipFontSizeRatio} on:input={(e) => updateConfig('pipFontSizeRatio', parseFloat(e.target.value))} />
    
    <label class="control-label">Pipette Ratio: {config.pipetteFontSizeRatio || 1.0}</label>
    <input type="range" min="0.5" max="2" step="0.1" bind:value={config.pipetteFontSizeRatio} on:input={(e) => updateConfig('pipetteFontSizeRatio', parseFloat(e.target.value))} />

    <label class="control-label">Show Pipette Digit</label>
    <input type="checkbox" bind:checked={config.showPipetteDigit} on:change={(e) => updateConfig('showPipetteDigit', e.target.checked)} />

    <label class="control-label">Use Static Color (disable directional coloring)</label>
    <input type="checkbox" bind:checked={config.priceStaticColor} on:change={(e) => updateConfig('priceStaticColor', e.target.checked)} />

    <label class="control-label">Show Bounding Box</label>
    <input type="checkbox" bind:checked={config.showPriceBoundingBox} on:change={(e) => updateConfig('showPriceBoundingBox', e.target.checked)} />

    <label class="control-label">Show Background</label>
    <input type="checkbox" bind:checked={config.showPriceBackground} on:change={(e) => updateConfig('showPriceBackground', e.target.checked)} />

    <label class="control-label">Display Padding: {config.priceDisplayPadding || 4}</label>
    <input type="range" min="0" max="20" bind:value={config.priceDisplayPadding} on:input={(e) => updateConfig('priceDisplayPadding', parseInt(e.target.value))} />
  </div>

  <!-- Volatility Orb -->
  <div class="mb-4">
    <h3 class="font-semibold text-gray-400">Volatility Orb</h3>
    <p class="text-xs text-gray-500 mb-2">Visual representation of market volatility.</p>
    
    <label class="control-label">Show Volatility Orb</label>
    <input type="checkbox" bind:checked={config.showVolatilityOrb} on:change={(e) => updateConfig('showVolatilityOrb', e.target.checked)} />
    
    <label class="control-label">Base Width: {config.volatilityOrbBaseWidth || 40}</label>
    <input type="range" min="10" max="200" bind:value={config.volatilityOrbBaseWidth} on:input={(e) => updateConfig('volatilityOrbBaseWidth', parseInt(e.target.value))} />

    <label class="control-label">Frequency Mode</label>
    <select bind:value={config.frequencyMode} on:change={(e) => updateConfig('frequencyMode', e.target.value)}>
      <option value="calm">Calm</option>
      <option value="normal">Normal</option>
      <option value="active">Active</option>
      <option value="volatile">Volatile</option>
    </select>

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
    
    <label class="control-label">Show Market Profile</label>
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
      <label class="control-label">Distribution Percentage: {config.distributionPercentage || 100}%</label>
      <input type="range" min="1" max="100" bind:value={config.distributionPercentage} on:input={(e) => updateConfig('distributionPercentage', parseInt(e.target.value))} />
    {/if}

    <label class="control-label">Single-Sided Profile</label>
    <input type="checkbox" bind:checked={config.showSingleSidedProfile} on:change={(e) => updateConfig('showSingleSidedProfile', e.target.checked)} />

    {#if config.showSingleSidedProfile}
      <div class="radio-group">
        <label class="control-label">Side</label>
        <div>
          <label><input type="radio" bind:group={config.singleSidedProfileSide} on:change={() => updateConfig('singleSidedProfileSide', 'left')} value="left" /> Left</label>
          <label><input type="radio" bind:group={config.singleSidedProfileSide} on:change={() => updateConfig('singleSidedProfileSide', 'right')} value="right" /> Right</label>
        </div>
      </div>
    {/if}
  </div>

  <!-- Flashing Effects -->
  <div class="mb-4">
    <h3 class="font-semibold text-gray-400">Flashing Effects</h3>
    <p class="text-xs text-gray-500 mb-2">Visual alerts for significant market events.</p>
    
    <label class="control-label">Show Flash on Tick</label>
    <input type="checkbox" bind:checked={config.showFlash} on:change={(e) => updateConfig('showFlash', e.target.checked)} />

    <label class="control-label">Flash Intensity: {config.flashIntensity || 0.3}</label>
    <input type="range" min="0.1" max="1" step="0.1" bind:value={config.flashIntensity} on:input={(e) => updateConfig('flashIntensity', parseFloat(e.target.value))} />

    <label class="control-label">Show Orb Flash</label>
    <input type="checkbox" bind:checked={config.showOrbFlash} on:change={(e) => updateConfig('showOrbFlash', e.target.checked)} />

    <label class="control-label">Orb Flash Threshold: {config.orbFlashThreshold || 0.5}</label>
    <input type="range" min="0.1" max="2" step="0.1" bind:value={config.orbFlashThreshold} on:input={(e) => updateConfig('orbFlashThreshold', parseFloat(e.target.value))} />

    <label class="control-label">Orb Flash Intensity: {config.orbFlashIntensity || 0.8}</label>
    <input type="range" min="0.1" max="1" step="0.1" bind:value={config.orbFlashIntensity} on:input={(e) => updateConfig('orbFlashIntensity', parseFloat(e.target.value))} />
  </div>

  <!-- Color Customization -->
  <div class="mb-4">
    <h3 class="font-semibold text-gray-400">Color Customization</h3>
    <p class="text-xs text-gray-500 mb-2">Customize directional colors for price display.</p>
    
    <label class="control-label">Price Up Color</label>
    <input type="color" bind:value={config.priceUpColor} on:input={(e) => updateConfig('priceUpColor', e.target.value)} />
    
    <label class="control-label">Price Down Color</label>
    <input type="color" bind:value={config.priceDownColor} on:input={(e) => updateConfig('priceDownColor', e.target.value)} />
  </div>
</div>

<style>
  .control-panel {
    background-color: #1f2937;
    padding: 1rem;
    border-radius: 0.5rem;
    color: #d1d5db;
    max-height: 80vh;
    overflow-y: auto;
  }
  
  .control-label {
    display: block;
    margin-top: 0.5rem;
    margin-bottom: 0.25rem;
    font-size: 0.875rem;
  }
  
  input[type="range"] {
    width: 100%;
    margin-bottom: 0.5rem;
  }
  
  select {
    width: 100%;
    background-color: #374151;
    color: #d1d5db;
    border: 1px solid #4b5563;
    border-radius: 0.25rem;
    padding: 0.25rem;
    margin-bottom: 0.5rem;
  }
  
  input[type="checkbox"] {
    margin-right: 0.5rem;
  }
  
  input[type="color"] {
    width: 100%;
    height: 2rem;
    border: none;
    border-radius: 0.25rem;
    margin-bottom: 0.5rem;
  }
  
  .radio-group {
    margin-top: 0.5rem;
  }
  
  .radio-group div {
    display: flex;
    gap: 1rem;
  }
  
  .radio-group label {
    display: flex;
    align-items: center;
    font-size: 0.875rem;
  }
  
  .radio-group input[type="radio"] {
    margin-right: 0.25rem;
  }
  
  h3 {
    margin-bottom: 0.5rem;
  }
  
  p {
    margin-bottom: 0.75rem;
  }
</style>