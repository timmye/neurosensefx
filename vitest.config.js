/**
 * Vitest Configuration for Real-World Testing
 *
 * No mocks, no simulations - only real browser testing
 * with live data connections and actual system validation
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Test environment configuration
    environment: 'jsdom', // For DOM access but we use real browser tests
    setupFiles: ['./tests/setup/real-world-setup.js'],

    // Test file patterns - real-world browser tests only
    include: [
      'tests/**/*.test.js',
      'tests/**/*.spec.js'
    ],

    // Exclude tests that violate live-data-only philosophy
    exclude: [
      'node_modules/**',
      // No mock-based market data tests allowed
      // Only pure utility functions and real browser tests permitted
    ],

    // Test configuration for real-world validation
    testTimeout: 60000, // 60 seconds for real browser operations
    hookTimeout: 30000,   // 30 seconds for setup/teardown
    isolate: true,         // Isolate tests to prevent interference
    watch: false,          // Disable watch for CI/CD

    // Global test configuration
    globals: {
      // Performance monitoring globals
      PERFORMANCE_METRICS: true,
      REAL_BROWSER_TESTING: true,
      LIVE_DATA_CONNECTIONS: true,

      // Professional trading requirements
      KEYBOARD_LATENCY_MAX: 310,  // ms
      DATA_TO_VISUAL_LATENCY_MAX: 100, // ms
      FPS_RENDERING_MIN: 60,     // frames per second

      // Memory management
      MEMORY_LEAK_THRESHOLD: 52428800,     // 50MB in bytes
    },

    // Reporter configuration for detailed reporting
    reporter: [
      'verbose',
      'json',
      ['html', { outputFile: 'tests-results/vitest-report.html' }]
    ],

    // Output configuration
    outputFile: {
      html: 'tests-results/vitest-report.html',
      json: 'tests-results/vitest-results.json'
    },

    // Coverage configuration for real-world testing
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'tests/**',
        'dist/**',
        '**/*.config.js',
        '**/*.config.ts',
        'coverage/**'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },

    // Performance testing configuration
    benchmark: {
      include: ['**/*.bench.js'],
      exclude: ['node_modules/**']
    },

    // Real-world testing hooks
    globalSetup: './tests/hooks/global-real-world-setup.js',
    globalTeardown: './tests/hooks/global-real-world-teardown.js',

    // Browser testing integration
    threads: true,
    singleThread: false,
    maxThreads: 4,
    minThreads: 1,

    // Memory and performance monitoring
    logHeapUsage: true,
    dangerousIgnoreModuleErrors: false,

    // Test retry configuration for flaky real-world tests
    retry: 2,

    // Test ordering (important for stateful real-world tests)
    sequence: {
      shuffle: false,
      concurrent: false
    }
  },

  // Resolve configuration for real-world modules
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@tests': resolve(__dirname, './tests'),
      '@helpers': resolve(__dirname, './tests/helpers'),
      '@fixtures': resolve(__dirname, './tests/helpers/fixtures.js')
    }
  },

  // Define configuration for different environments
  define: {
    // Enable real-world testing flags
    __REAL_WORLD_TESTING__: JSON.stringify(true),
    __LIVE_MARKET_DATA__: JSON.stringify(true),
    __BROWSER_AUTOMATION__: JSON.stringify(true),

    // Performance monitoring flags
    __PERFORMANCE_MONITORING__: JSON.stringify(true),
    __MEMORY_TRACKING__: JSON.stringify(true),
    __LATENCY_TRACKING__: JSON.stringify(true),

    // Professional trading requirements
    __PROFESSIONAL_TRADING__: JSON.stringify(true),
    __MULTI_DISPLAY__: JSON.stringify(true)
  },

  // Optimizations for real-world testing
  optimizeDeps: {
    include: [
      'vitest/globals',
      'playwright',
      '@playwright/test'
    ]
  },

  // Environment-specific configurations
  server: {
    // Development server for testing
    port: 5175, // Different from main app port
    strictPort: true,
    hmr: false   // Disable HMR for consistent testing
  },

  // Build configuration for test environment
  build: {
    target: 'esnext',
    sourcemap: true,
    minify: false,
    rollupOptions: {
      input: {
        testSetup: './tests/setup/real-world-setup.js'
      },
      output: {
        format: 'es'
      }
    }
  }
});