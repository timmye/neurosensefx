<script>
  import { onMount, onDestroy } from 'svelte';
  import VizDisplay from './components/VizDisplay.svelte';

  const dataWorker = new Worker(new URL('./workers/dataProcessor.js', import.meta.url), { type: 'module' });

  // --- Configuration ---
  const config = {
    adrRange: 100,
    pulseThreshold: 0.5,
    pulseScale: 5,
    maxMarkerDecay: 10,
    flashThreshold: 2,
    adrProximityThreshold: 10,
    frequencyMode: 'normal',
    priceBucketSize: 0.5,
    showMaxMarker: true,
    showVolatilityOrb: true,
    showMarketProfile: true,
    showFlash: true, // Enable flash by default for demonstration
    flashIntensity: 0.4,
    showOrbFlash: false,
    orbFlashThreshold: 2,
    orbFlashIntensity: 0.8,
    distributionDepthMode: 'all',
    distributionPercentage: 50,
    marketProfileView: 'bars',
    priceFontSize: 50,
    priceFontWeight: '600',
    priceHorizontalOffset: 14,
    priceFloatWidth: 50,
    priceFloatXOffset: 20,
    bigFigureFontSizeRatio: 1.2,
    pipFontSizeRatio: 1.1,
    pipetteFontSizeRatio: 0.8,
    showPriceBoundingBox: false,
    showPriceBackground: false,
    priceDisplayPadding: 4,
    visualizationsContentWidth: 220,
    centralAxisXPosition: 170,
    meterHeight: 120,
    centralMeterFixedThickness: 8,
    showPipetteDigit: false,
    showSingleSidedProfile: false,
    singleSidedProfileSide: 'right',
  };

  // --- Reactive State ---
  let state = undefined;
  let marketProfileData = { levels: [] };
  let flashEffect = null; // Used to trigger the flash animation

  onMount(() => {
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
        
        // If a significant tick event is received, trigger the flash
        if (payload.significantTick) {
          flashEffect = {
            direction: payload.newState.lastTickDirection,
            // Reset flashEffect after animation duration
            id: Date.now() 
          };
        }
      }
    };

    dataWorker.postMessage({ type: 'startSimulation' });
  });

  onDestroy(() => {
    dataWorker.terminate();
  });
</script>

<main>
  <h1>NeuroSense FX</h1>
  {#if state && state.adrHigh !== undefined && state.adrLow !== undefined}
    <VizDisplay 
      {config} 
      {state} 
      {marketProfileData}
      {flashEffect}
    />
  {/if}
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px;
    background-color: #111827;
    color: #d1d5db;
    min-height: 100vh;
  }
  h1 {
    color: #60a5fa;
    margin-bottom: 20px;
  }
</style>
