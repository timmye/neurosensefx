import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'

  return {
    plugins: [
      svelte({
        // Production optimizations
        compilerOptions: isProduction ? {
          dev: false,
          css: 'injected',
          hydratable: false
        } : {
          dev: true
        }
      }),
    ],
  test: {
    include: [
      'src/**/*.test.js', // Include unit tests in src
      'tests/unit/**/*.test.js' // Include unit tests in tests/unit
    ],
    exclude: [
      'node_modules/**',
      'services/**', // Exclude backend services
      'tests/e2e/**', // Exclude Playwright e2e tests
      '**/*.spec.js' // Exclude Playwright spec files
    ],
    environment: 'node' // Use node environment for compatibility
  },

    // Production build optimizations
    ...(isProduction && {
      build: {
        // Target modern browsers for better optimization
        target: 'es2020',
        // Enable CSS code splitting
        cssCodeSplit: true,
        // Optimize chunks for production
        rollupOptions: {
          output: {
            // Manual chunk splitting for better caching and loading
            manualChunks: {
              // Core vendor libraries (stable dependencies)
              'vendor-core': ['svelte', 'd3'],

              // cTrader API and WebSocket handling
              'vendor-trading': ['@reilleryoku/ctrader-layer', 'ws', 'interactjs'],

              // Validation and utilities
              'vendor-utils': ['zod'],

              // Heavy visualization modules
              'viz-core': [
                'src/lib/viz/marketProfile.js',
                'src/lib/viz/volatilityOrb.js',
                'src/lib/viz/dayRangeMeter.js'
              ],

              // Performance and monitoring (can be loaded lazily)
              'perf-monitoring': [
                'src/utils/performanceDashboard.js',
                'src/utils/multiDisplayPerformanceTracker.js',
                'src/lib/monitoring/storePerformanceMonitor.js'
              ],

              // Development and debugging tools (can be excluded in production)
              'dev-tools': [
                'src/utils/canvasSizing.js',
                'src/utils/canvasRenderingMonitor.js',
                'src/utils/canvasBoundsLogger.js'
              ]
            },
            // Optimize chunk naming for better caching
            chunkFileNames: (chunkInfo) => {
              const facadeModuleId = chunkInfo.facadeModuleId || ''
              const fileName = facadeModuleId.split('/').pop() || 'chunk'

              // Core chunks get content-based hashing
              if (fileName.includes('vendor') || fileName.includes('viz')) {
                return `assets/[name]-[hash].js`
              }

              // Dynamic chunks get simpler naming
              return `assets/[name]-[hash].js`
            }
          },
          // External dependencies that should not be bundled
          external: (id) => {
            // Don't bundle large external libraries in production
            return false // Keep all dependencies bundled for trading platform
          },
          // Optimize treeshaking
          treeshake: {
            moduleSideEffects: false,
            propertyReadSideEffects: false,
            unknownGlobalSideEffects: false
          }
        },
        // Minification options
        minify: 'terser',
        terserOptions: {
          compress: {
            // Remove console logs in production
            drop_console: true,
            drop_debugger: true,
            pure_funcs: ['console.log', 'console.warn', 'console.info'],
            // Optimize for trading platform performance
            passes: 2
          },
          mangle: {
            // Keep class names for debugging in production if needed
            keep_classnames: false,
            keep_fnames: false
          }
        },
        // Set chunk size warning limit higher for visualization platform
        chunkSizeWarningLimit: 800,
        // Generate source maps for production debugging (can be disabled for final production)
        sourcemap: false
      }
    }),

    // Development server configuration
    ...(!isProduction && {
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
      }
    }),

    // Environment-specific definitions
    define: {
      __FRONTEND_PORT__: isProduction ? 4173 : 5174,
      __BACKEND_PORT__: isProduction ? 8081 : 8080,
      __ENVIRONMENT__: JSON.stringify(isProduction ? 'production' : 'development'),
      __DEV__: JSON.stringify(!isProduction),
      __PROD__: JSON.stringify(isProduction)
    },

    // Resolve configuration for optimal bundling
    resolve: {
      // Optimize module resolution
      dedupe: ['svelte', 'd3'],
      // Main field resolution for optimal imports
      mainFields: ['module', 'browser', 'main'],
      // Extension optimization
      extensions: ['.mjs', '.js', '.svelte', '.json']
    },

    // Optimize dependencies
    optimizeDeps: {
      // Include common dependencies for pre-bundling
      include: [
        'svelte',
        'd3',
        'd3-scale',
        'zod',
        'interactjs'
      ],
      // Exclude heavy dependencies from pre-bundling for better code splitting
      exclude: [
        '@reilleryoku/ctrader-layer'
      ]
    }
  }
})