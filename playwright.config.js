import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: ['./tests/e2e', './e2e'],
  timeout: 60000, // Increased for comprehensive tests
  fullyParallel: false, // Sequential for system visibility
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : 1, // Single worker for comprehensive monitoring
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
    ['line'] // Console output
  ],
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure', // Keep traces for failed tests
    video: 'retain-on-failure', // Keep videos for failed tests
    screenshot: 'only-on-failure', // Screenshots on failure
  },

  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--enable-precise-memory-info'
          ]
        }
      },
      testMatch: '**/comprehensive-real-world-btcusd.spec.js',
      timeout: 120000, // 2 minutes for comprehensive tests
    },
    {
      name: 'chromium-performance',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        launchOptions: {
          args: [
            '--disable-web-security',
            '--enable-precise-memory-info'
          ]
        }
      },
      testMatch: '**/multi-instrument-monitoring.spec.js',
      timeout: 180000, // 3 minutes for multi-instrument tests
    },
    {
      name: 'firefox-professional',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 }
      },
      testMatch: '**/performance-benchmarking.spec.js',
      timeout: 300000, // 5 minutes for performance tests
    },
  ],

  // Global setup and teardown for comprehensive testing
  globalSetup: './tests/helpers/global-test-setup.js',
  globalTeardown: './tests/helpers/global-test-teardown.js',
});