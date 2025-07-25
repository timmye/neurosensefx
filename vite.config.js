import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      // Proxy WebSocket requests to the backend server
      '/ws': {
        target: 'ws://localhost:8080', // Corrected to your backend WebSocket server port
        ws: true, // IMPORTANT: This enables WebSocket proxying
        changeOrigin: true // Recommended for virtual hosted sites
      }
    }
  },
  envDir: "../", 
  envPrefix: "VITE_"
});
