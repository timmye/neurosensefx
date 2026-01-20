import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    svelte({
      onwarn: (warning, handler) => {
        // Ignore a11y warnings for focusable, interactive containers
        if (warning.code?.startsWith('a11y-')) return;
        handler(warning);
      }
    })
  ],
  root: 'src',
  server: {
    port: 5174,
    strictPort: true,
    host: true // Allow external connections
  },
  preview: {
    port: 4173,
    strictPort: true
  }
});