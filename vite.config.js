import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [
    svelte(),
  ],
  test: {
    include: [
      'src/**/*.test.js' // Only include unit tests in src
    ],
    exclude: [
      'node_modules/**',
      'services/**', // Exclude backend services
      'tests/**', // Exclude all Playwright tests
      '**/*.spec.js' // Exclude Playwright spec files
    ],
    environment: 'node'
  },
  server: {
    host: true,
    port: 5174,
    strictPort: true,
    hmr: {
      port: 5174,
      protocol: 'ws',
      host: 'localhost',
      clientPort: 5174,
      overlay: true
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
  define: {
    __FRONTEND_PORT__: 5174,
    __BACKEND_PORT__: 8080,
    __ENVIRONMENT__: JSON.stringify('development'),
  }
});