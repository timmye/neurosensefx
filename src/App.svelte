<script>
  import { onMount, onDestroy } from 'svelte';
  import VizDisplay from './components/VizDisplay.svelte';
  import ConfigPanel from './components/ConfigPanel.svelte';

  const dataWorker = new Worker(new URL('./workers/dataProcessor.js', import.meta.url), { type: 'module' });

  // --- Configuration ---
  let config = {
    adrRange: 100,
    pulseThreshold: 0.5,
    pulseScale: 5,
    flashThreshold: 2,
    adrProximityThreshold: 10,
    frequencyMode: 'normal', // calm, normal, active, volatile
    priceBucketSize: 0.5,
    showVolatilityOrb: true,
    volatilityColorMode: 'intensity', // directional, intensity, singleHue
    volatilityOrbInvertBrightness: false,
    volatilityOrbBaseWidth: 70,
    showMarketProfile: true,
    showFlash: true,
    flashIntensity: 0.4,
    showOrbFlash: true,
    orbFlashThreshold: 2,
    orbFlashIntensity: 0.8,
    distributionDepthMode: 'all',
    distributionPercentage: 50,
    marketProfileView: 'bars',
    priceFontSize: 50,
    priceFontWeight: '600',
    priceHorizontalOffset: 14,
    priceFloatWidth: 50,
    priceFloatHeight: 1, // Height in pips (default 1 pip)
    priceFloatXOffset: 20,
    bigFigureFontSizeRatio: 1.2,
    pipFontSizeRatio: 1.1,
    pipetteFontSizeRatio: 0.8,
    showPriceBoundingBox: false,
    showPriceBackground: false,
    priceDisplayPadding: 4,
    priceStaticColor: false, // true = static gray, false = dynamic colors
    priceUpColor: '#3b82f6', // Blue for up movements
    priceDownColor: '#ef4444', // Red for down movements
    visualizationsContentWidth: 220,
    centralAxisXPosition: 170, // X position of the central ADR axis
    meterHeight: 120,
    centralMeterFixedThickness: 8,
    showPipetteDigit: false,
    showSingleSidedProfile: false,
    singleSidedProfileSide: 'right',
  };

  // --- Reactive State ---
  let state = undefined;
  let marketProfileData = { levels: [] };
  let flashEffect = null;

  function handleConfigChange(event) {
    config = { ...config, ...event.detail.config };
    dataWorker.postMessage({ type: 'updateConfig', payload: config });
  }

  onMount(() => {
    window.addEventListener('configchange', handleConfigChange);
    const initialMidPrice = 1.25500;
    dataWorker.postMessage({ 
        type: 'init', 
        payload: { config: config, midPrice: initialMidPrice } 
    });

    dataWorker.onmessage = (event) => {
      const { type, payload } = event.data;
      if (type === 'stateUpdate') {
        state = payload.newState;
        marketProfileData = payload.marketProfile || { levels: [] };
        
        if (payload.significantTick) {
          flashEffect = {
            direction: payload.newState.lastTickDirection,
            id: Date.now(),
            magnitude: payload.tickMagnitude
          };
        }
      }
    };

    dataWorker.postMessage({ type: 'startSimulation' });
  });

  onDestroy(() => {
    window.removeEventListener('configchange', handleConfigChange);
    dataWorker.terminate();
  });
</script>

<main>
  <div class="main-container">
    <div class="viz-container">
      <h1>NeuroSense FX</h1>
      {#if state && state.adrHigh !== undefined && state.adrLow !== undefined}
        <VizDisplay 
          {config} 
          {state} 
          {marketProfileData}
          {flashEffect}
        />
      {/if}
    </div>
    <div class="config-panel-container">
      <ConfigPanel {config} />
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
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .config-panel-container {
    width: 300px;
    margin-left: 20px;
  }
  h1 {
    color: #60a5fa;
    margin-bottom: 20px;
  }
</style>