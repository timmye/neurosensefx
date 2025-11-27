/**
 * Playwright Configuration for NeuroSense FX
 *
 * Configures Playwright for testing the neurosensefx application
 * with proper base URL and development server settings.
 */

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  // Test directory
  testDir: 'tests',

  // Base URL for all tests - points to development server
  baseURL: 'http://localhost:5174',

  // Global test timeout
  timeout: 30000,

  // Global expect timeout
  expect: {
    timeout: 10000
  },

  // Run tests in parallel by default
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }]
  ],

  // Web server configuration - start both frontend and backend services
  webServer: {
    command: './run.sh dev',
    port: 5174,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  
  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // Use settings
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Test ignore patterns
  testIgnore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**'
  ]
});