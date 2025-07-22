<script>
  import { onMount, onDestroy } from 'svelte';
  import VizDisplay from './components/VizDisplay.svelte';

  // The Web Worker for data processing
  const dataWorker = new Worker(new URL('./workers/dataProcessor.js', import.meta.url), { type: 'module' });

  // --- Initial Configuration ---
  const config = {
    adrRange: 100, // in pips
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
    showFlash: false,
    flashIntensity: 0.3,
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
    meterHeight: 120, // Spec: 220x120px canvas
    centralMeterFixedThickness: 8,
    showPipetteDigit: false,
    showSingleSidedProfile: false,
    singleSidedProfileSide: 'right',
  };

  // --- Reactive State ---
  // Initialize state as null or undefined to ensure conditional rendering works
  let state = undefined;
  let marketProfileData = { levels: [] };

  onMount(() => {
    // Pass the initial configuration to the worker
    const initialMidPrice = 1.25500;
    dataWorker.postMessage({ 
        type: 'init', 
        payload: { config: config, midPrice: initialMidPrice } 
    });

    // Listen for ongoing updates from the worker
    dataWorker.onmessage = (event) => {
      const { type, payload } = event.data;
      if (type === 'stateUpdate') {
        // Update state with the latest data from the worker
        state = payload.newState;
        marketProfileData = payload.marketProfile || { levels: [] };
      }
    };

    // Start the simulation
    dataWorker.postMessage({ type: 'startSimulation' });
  });

  onDestroy(() => {
    dataWorker.terminate();
  });
</script>

<main>
  <h1>NeuroSense FX</h1>
  <!-- 
    This is the definitive fix for the race condition. 
    The VizDisplay component is ONLY rendered when the essential state data (ADR high/low)
    has been received from the worker.
  -->
  {#if state && state.adrHigh !== undefined && state.adrLow !== undefined}
    <VizDisplay 
      id="main-viz"
      {config} 
      {state} 
      {marketProfileData}
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
