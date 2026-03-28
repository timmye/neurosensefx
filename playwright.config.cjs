const { defineConfig, devices } = require('@playwright/test');
const os = require('os');

/**
 * Playwright configuration for NeuroSense FX Simple Frontend
 * Tests the Crystal Clarity implementation with real browser automation
 */
module.exports = defineConfig({
  testDir: './src/tests',

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: 'html',

  // Shared settings for all the projects below
  use: {
    // Base URL - use container hostname (Chromium can't reach localhost in Codespaces/WSL2)
    baseURL: `http://${os.hostname()}:5174`,

    // Vite HMR prevents 'load' event; use 'commit' + explicit waits
    navigationOptions: { waitUntil: 'commit' },

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Take screenshot on failure
    screenshot: 'only-on-failure',

    // Record video on failure
    video: 'retain-on-failure',

    // Global timeout for each test (increased for FX Basket 28-pair subscription)
    actionTimeout: 20000,
  },

  // Configure projects for major browsers - Chromium only for testing
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Disable WebGL to prevent Three.js BackgroundShader crashing headless Chromium
        launchOptions: {
          args: [
            '--disable-webgl',
            '--disable-software-rasterizer',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-extensions',
            '--no-sandbox',
          ],
        },
      },
    },
  ],

  // No webServer - using existing dev server
});
