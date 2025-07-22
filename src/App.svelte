<script>
  import { onMount, onDestroy } from 'svelte';
  import VizDisplay from './components/VizDisplay.svelte';

  // Initialize a Web Worker
  // The `/*?worker*/` suffix is a Vite-specific syntax to import a file as a Web Worker
  const dataWorker = new Worker(new URL('./workers/dataProcessor.js', import.meta.url), { type: 'module' });

  // Reactive variables to hold state received from the worker
  let simulationState = {
    currentPrice: 1.25500,
    lastTickDirection: 0,
    maxDeflection: { up: 0, down: 0, lastUpdateTime: 0 },
    volatility: 0,
    midPrice: 1.25500,
    minObservedPrice: Infinity,
    maxObservedPrice: Infinity,
  };
  let marketProfileData = [];

  // Initial configuration to send to the worker
  const initialConfig = {
    adrRange: 100,
    pulseThreshold: 0.5,
    pulseScale: 5,
    maxMarkerDecay: 10,
    flashThreshold: 2,
    adrProximityThreshold: 10,
    frequencyMode: 'normal',
    priceBucketSize: 0.5,
    showMaxMarker: true,
    showVolatilityOrb: false,
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
    meterHeight: 120,
    centralMeterFixedThickness: 8,
    showPipetteDigit: false,
    showSingleSidedProfile: false,
    singleSidedProfileSide: 'right',
  };

  onMount(() => {
    // Send initial configuration to the worker
    dataWorker.postMessage({ type: 'init', payload: { config: initialConfig } });

    // Listen for messages from the worker
    dataWorker.onmessage = (event) => {
      const { type, payload } = event.data;
      if (type === 'stateUpdate') {
        // Update reactive variables with data from the worker
        simulationState = {
          currentPrice: payload.currentPrice,
          lastTickDirection: payload.lastTickDirection,
          maxDeflection: payload.maxDeflection,
          volatility: payload.volatility,
          midPrice: payload.midPrice,
          minObservedPrice: payload.minObservedPrice,
          maxObservedPrice: payload.maxObservedPrice
        };
        marketProfileData = payload.marketProfile;
      }
    };

    // Start the simulation in the worker *AFTER* attaching the message listener
    dataWorker.postMessage({ type: 'startSimulation' });
  });

  // Terminate the worker when the component is destroyed to prevent memory leaks
  onDestroy(() => {
    dataWorker.terminate();
  });
</script>

<main>
  <h1>Hello, NeuroSense FX!</h1>
  <VizDisplay 
    id="main-viz"
    config={initialConfig} 
    state={simulationState} 
    marketProfileData={marketProfileData}
  />
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px;
    background-color: #111827; /* Dark background */
    color: #d1d5db; /* Light text */
    min-height: 100vh;
  }
  h1 {
    color: #60a5fa;
    margin-bottom: 20px;
  }
</style>