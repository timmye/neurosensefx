// Import design system styles in correct order
import './styles/design-tokens.css';
import './styles/base.css';
import './styles/utilities.css';
import './styles/components.css';

import App from './App-New.svelte';
import { initializeWsClient } from './data/wsClient.js';

const app = new App({
  target: document.getElementById('app'),
  props: {}
});

initializeWsClient();

export default app;
