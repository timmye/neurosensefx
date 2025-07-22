import App from './App.svelte';
import { vizConfig, vizState } from './stores.js';

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
  const newState = event.data; // The worker sends the updated state
  vizState.set(newState); // Update the Svelte store
};

// Send the initial configuration to the Web Worker once the main app is initialized.
// This ensures the worker has the necessary parameters for its calculations.
vizConfig.subscribe(currentConfig => {
  dataProcessorWorker.postMessage({
    type: 'init',
    config: currentConfig // Send the entire config object
  });
  // Also send a message to start the game loop in the worker after initialization
  dataProcessorWorker.postMessage({ type: 'startLoop' });
}, { once: true }); // Only send the initial config and start loop once

export default app;
