import App from './App.svelte';
import { initializeWsClient } from './data/wsClient.js';

const app = new App({
  target: document.getElementById('app'),
  props: {}
});

initializeWsClient();

export default app;
