/**
 * Unified Console Fixture
 *
 * Provides unified console infrastructure to all tests through Playwright's fixture system.
 * This ensures the global setup is available in every test worker process.
 */

const playwright = require('@playwright/test');
const base = playwright.test;
const expect = playwright.expect;
const UnifiedConsoleReporter = require('../reporters/unified-console-reporter.cjs');
const BrowserLogCapture = require('../helpers/browser-log-capture.cjs');
const CorrelationManager = require('../helpers/correlation-manager.cjs');
const BuildLogCapture = require('../helpers/build-log-capture.cjs');

// Create a test fixture that includes unified console infrastructure
const test = base.extend({
  // Correlation manager for tracking test execution
  correlationManager: [async ({}, use) => {
    const correlationManager = new CorrelationManager();
    await use(correlationManager);
  }, { scope: 'worker' }],

  // Unified reporter for console output
  unifiedReporter: [async ({ correlationManager }, use) => {
    const unifiedReporter = new UnifiedConsoleReporter({
      enableColors: true,
      enableTimestamps: true,
      enableCorrelationIds: true,
      outputFile: 'test-results/unified-console.log'
    });
    await use(unifiedReporter);
  }, { scope: 'worker' }],

  // Browser log capture utility
  browserLogCapture: [async ({ unifiedReporter }, use) => {
    const browserLogCapture = new BrowserLogCapture(unifiedReporter);
    await use(browserLogCapture);
  }, { scope: 'worker' }],

  // Build log capture utility
  buildLogCapture: [async ({ unifiedReporter, correlationManager }, use) => {
    const buildLogCapture = new BuildLogCapture(unifiedReporter, correlationManager);
    await use(buildLogCapture);
  }, { scope: 'worker' }],

  // Test run correlation for the entire worker
  testRunCorrelation: [async ({ correlationManager }, use) => {
    const testRunCorrelation = correlationManager.createCorrelation(
      'TEST_RUN: Playwright Suite',
      'test',
      `Complete Playwright test execution with unified visibility - ${new Date().toISOString()}`
    );
    await use(testRunCorrelation);

    // Cleanup correlation after use
    correlationManager.endCorrelation(
      testRunCorrelation.id,
      'completed',
      { timestamp: new Date().toISOString() }
    );
  }, { scope: 'worker' }]
});

module.exports = { test, expect };