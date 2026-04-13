import App from './App.svelte';

document.fonts.load('400 16px "Georgia Pro"').then(() => {
  new App({ target: document.body });
});
