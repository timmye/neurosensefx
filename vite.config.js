import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte()],
  server: {
    host: true, // Allow external connections
    port: 5174, // Use different port to avoid conflicts
    hmr: {
      port: 5174,
      protocol: 'ws',
      host: 'localhost',
      clientPort: 5174,
      overlay: true // Show error overlay in browser
    },
    watch: {
      usePolling: true,
      interval: 100,
      ignored: ['**/node_modules/**', '**/.git/**', '**/logs/**']
    },
    proxy: {
      '/ws': {
        target: 'ws://127.0.0.1:8080',
        ws: true,
        changeOrigin: true,
        secure: false
      },
    },
  },
})
