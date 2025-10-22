import App from './App.svelte';
import { initializeWsClient } from './data/wsClient.js';
import { floatingStore, actions } from './stores/floatingStore.js';

const app = new App({
  target: document.getElementById('app'),
  props: {}
});

initializeWsClient();

// ✅ EXPOSE: Make store and actions globally available for components
window.floatingStore = floatingStore;
window.actions = actions;

export default app;
