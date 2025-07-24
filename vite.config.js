import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/ws': {
        target: 'ws://localhost:8080', // Corrected to match the new backend port
        ws: true,
        changeOrigin: true
      }
    }
  },
  envDir: "../", 
  envPrefix: "VITE_"
});
