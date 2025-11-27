import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [
    sveltekit(),
    {
      name: 'unified-console-log-capture',
      configureServer(server) {
        // Inject browser log capture script into every page
        server.middlewares.use((req, res, next) => {
          if (req.url === '/' || req.url.endsWith('.html')) {
            // This will be handled by the transformIndexHtml hook
            next();
          } else {
            next();
          }
        });
      },

      transformIndexHtml(html) {
        // Inject browser log capture script into HTML
        const browserLogScript = `
          <script>
            (function() {
              // Only capture logs when unified test runner is active
              if (window.location.hostname === 'localhost') {
                // Override console methods to capture logs
                const originalConsole = {
                  log: console.log,
                  error: console.error,
                  warn: console.warn,
                  info: console.info
                };

                function captureConsoleLog(level, ...args) {
                  const message = args.map(arg =>
                    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                  ).join(' ');

                  // Send to our unified console via fetch
                  fetch('http://localhost:9999/log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      source: 'BROWSER',
                      level: level.toUpperCase(),
                      message: message,
                      timestamp: new Date().toISOString()
                    })
                  }).catch(() => {
                    // Silently fail if logger server is not available
                  });

                  // Call original console method
                  return originalConsole[level.toLowerCase()](...args);
                }

                // Override console methods
                console.log = (...args) => captureConsoleLog('LOG', ...args);
                console.error = (...args) => captureConsoleLog('ERROR', ...args);
                console.warn = (...args) => captureConsoleLog('WARNING', ...args);
                console.info = (...args) => captureConsoleLog('INFO', ...args);

                console.log('🌐 BROWSER: Console log capture initialized');
              }
            })();
          </script>
        `;

        return html.replace('</head>', browserLogScript + '</head>');
      }
    }
  ],

  // Enhanced logging configuration
  clearScreen: false, // Keep console history visible

  build: {
    // More verbose build logging
    logLevel: 'info',

    rollupOptions: {
      onwarn(warning, warn) {
        // Capture all warnings for unified console
        if (warning.code === 'UNUSED_EXPORT') {
          console.warn(`⚠️  BUILD WARNING: ${warning.message}`);
        } else {
          warn(warning);
        }
      }
    }
  },

  server: {
    // Enhanced server logging
    host: true,
    port: 5174,
    strictPort: true
  },

  // Optimize for development with visibility
  optimizeDeps: {
    // Show dependency optimization progress
    force: true
  }
});