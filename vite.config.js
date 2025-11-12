import { defineConfig, loadEnv } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), '');

  // Environment-aware port configuration
  const isDev = mode === 'development';
  const frontendPort = isDev ? 5174 : 4173; // Vite preview standard for production
  const backendPort = isDev ? 8080 : 8081;   // Separate backend ports

  console.log(`🌍 ${isDev ? 'Development' : 'Production'} Environment:`);
  console.log(`   Frontend: http://localhost:${frontendPort}`);
  console.log(`   Backend:  ws://localhost:${backendPort}`);

  return {
    plugins: [svelte()],
    server: {
      host: true, // Allow external connections
      port: frontendPort,
      strictPort: true, // Don't auto-switch ports - we want explicit control
      hmr: {
        port: frontendPort,
        protocol: 'ws',
        host: 'localhost',
        clientPort: frontendPort,
        overlay: true // Show error overlay in browser
      },
      watch: {
        usePolling: true,
        interval: 100,
        ignored: ['**/node_modules/**', '**/.git/**', '**/logs/**']
      },
      proxy: {
        '/ws': {
          target: `ws://127.0.0.1:${backendPort}`,
          ws: true,
          changeOrigin: true,
          secure: false
        },
      },
    },
    preview: {
      host: true,
      port: frontendPort,
      strictPort: true,
    },
    // Define constants for use in the application
    define: {
      __FRONTEND_PORT__: frontendPort,
      __BACKEND_PORT__: backendPort,
      __ENVIRONMENT__: JSON.stringify(mode),
    }
  };
});
