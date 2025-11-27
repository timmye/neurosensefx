import App from './App.svelte';
import { initializeWsClient } from './data/wsClient.js';
import { displayStore, displayActions } from './stores/displayStore.js';

const app = new App({
  target: document.getElementById('app'),
  props: {}
});

initializeWsClient();

// ✅ EXPOSE: Make store and actions globally available for components
window.displayStore = displayStore;
window.displayActions = displayActions;


export default app;
