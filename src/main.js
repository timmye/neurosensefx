import App from './App.svelte';
import { vizConfig, vizState } from './stores.js';
import { get } from 'svelte/store';

// Initialize stores with default values if they don't have them
// (Assuming default values are set in stores.js)

const app = new App({
  target: document.getElementById('app'),
  props: {
    // No props related to config/state here, as App will get them from stores.
    // Any other global props can be passed if necessary.
  }
});

// Instantiate the Web Worker for data processing
const dataProcessorWorker = new Worker(new URL('./workers/dataProcessor.js', import.meta.url));

// Listen for messages from the Web Worker and update the vizState store
dataProcessorWorker.onmessage = (event) => {
  const newState = event.data.payload; // The worker now sends state updates within a payload
  if (event.data.type === 'stateUpdate') {
    vizState.set(newState);
  }
};

// Send the initial configuration and state to the worker
const initialVizState = get(vizState);
console.log('Sending initial state to worker:', initialVizState);

// Create a simplified state to send to the worker, excluding the Map
const simplifiedInitialState = {
  currentPrice: initialVizState.currentPrice,
  midPrice: initialVizState.midPrice,
  lastTickTime: initialVizState.lastTickTime,
  maxDeflection: initialVizState.maxDeflection,
  volatility: initialVizState.volatility,
  lastTickDirection: initialVizState.lastTickDirection,
};

dataProcessorWorker.postMessage({
  type: 'init',
  payload: {
    config: get(vizConfig),
    initialState: simplifiedInitialState, // Send the simplified state
  }
});

// Start the simulation after initialization
dataProcessorWorker.postMessage({
  type: 'startSimulation'
});

export default app;
