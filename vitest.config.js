import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'jsdom',

    // Global test setup
    globals: true,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        '**/*.config.js',
        '**/*.config.ts',
        'e2e/',
        'libs/',
        'services/'
      ]
    },

    // Test file patterns
    include: [
      'tests/unit/**/*.test.{js,ts}',
      'tests/unit/**/*.spec.{js,ts}',
      'src/**/*.test.{js,ts}',
      'src/**/*.spec.{js,ts}'
    ],

    // Exclude patterns
    exclude: [
      'node_modules/',
      'dist/',
      'e2e/',
      '**/*.e2e.{js,ts}',
      '**/*.integration.{js,ts}'
    ],

    // Test timeout
    testTimeout: 5000,

    // Hook timeout
    hookTimeout: 10000,

    // Verbose output
    verbose: true,

    // Watch mode (disabled for CI)
    watch: false,

    // Reporting
    reporter: ['verbose', 'json']
  },

  // Resolve configuration for imports
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@tests': resolve(__dirname, './tests')
    }
  },

  // Define global constants for tests
  define: {
    'process.env.NODE_ENV': '"test"'
  }
});