import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  envDir: "../", // Look for .env files in the root of the project (where .idx is)
  envPrefix: "VITE_" // Expose environment variables starting with VITE_ to the client-side code
});