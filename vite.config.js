import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
  plugins: [svelte()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'specs/NeuroSense FX_trimmed.html'),
      },
    },
  },
  server: {
    // Ensure that the server runs on 0.0.0.0 for external access in Firebase Studio
    host: '0.0.0.0',
    // Explicitly set the port to 5173 to ensure consistency
    port: 5173,
  }
});