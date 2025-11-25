import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000, // Increased for comprehensive tests
  fullyParallel: false, // Sequential for system visibility
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : 1, // Single worker for comprehensive monitoring
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['line'] // Console output
  ],
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure', // Keep traces for failed tests
    video: 'retain-on-failure', // Keep videos for failed tests
    screenshot: 'only-on-failure', // Screenshots on failure
  },

  // Start dev server if not already running
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes
    stdout: 'pipe',
    stderr: 'pipe',
  },

  projects: [
    {
      name: 'chromium',
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
    },
    // Only add Firefox/WebKit if dependencies are available
    // {
    //   name: 'firefox',
    //   use: {
    //     ...devices['Desktop Firefox'],
    //     viewport: { width: 1920, height: 1080 }
    //   },
    // },
    // {
    //   name: 'webkit',
    //   use: {
    //     ...devices['Desktop Safari'],
    //     viewport: { width: 1920, height: 1080 }
    //   },
    // },
  ],

  // Disable global setup/teardown for now
  // globalSetup: './tests/helpers/global-test-setup.js',
  // globalTeardown: './tests/helpers/global-test-teardown.js',
});