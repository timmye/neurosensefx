const { defineConfig, devices } = require('@playwright/test');
const os = require('os');

/**
 * Playwright configuration for stress tests in tests/e2e/
 * Extends the same browser settings as the main config.
 */
module.exports = defineConfig({
  testDir: '.',

  fullyParallel: false,

  retries: 0,

  reporter: 'html',

  use: {
    baseURL: `http://${os.hostname()}:5174`,
    navigationOptions: { waitUntil: 'commit' },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20000,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
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
});
