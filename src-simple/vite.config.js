import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [svelte()],
  build: {
    outDir: 'dist'
  },
  server: {
    port: 5175,
    host: '0.0.0.0'
  },
  preview: {
    port: 5175,
    host: '0.0.0.0'
  }
});