import App from './App.svelte';

console.log('[DEBUGGER:main.js:1] Before App constructor');
const app = new App({
  target: document.body
});
console.log('[DEBUGGER:main.js:2] After App constructor');
export default app;