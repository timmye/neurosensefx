/**
 * Global Setup for Unified Console Infrastructure
 *
 * Initializes correlation manager, unified reporter, browser log capture,
 * and build log capture before any tests run.
 */

const UnifiedConsoleReporter = require('./reporters/unified-console-reporter.cjs');
const BrowserLogCapture = require('./helpers/browser-log-capture.cjs');
const CorrelationManager = require('./helpers/correlation-manager.cjs');
const BuildLogCapture = require('./helpers/build-log-capture.cjs');
const fs = require('fs');
const path = require('path');

async function globalSetup(config) {
  console.log('🚀 Initializing Unified Console Infrastructure...');

  // Ensure test-results directory exists
  const testResultsDir = path.join(process.cwd(), 'test-results');
  if (!fs.existsSync(testResultsDir)) {
    fs.mkdirSync(testResultsDir, { recursive: true });
  }

  // Initialize correlation manager globally
  global.correlationManager = new CorrelationManager();

  // Initialize unified reporter globally
  global.unifiedReporter = new UnifiedConsoleReporter({
    enableColors: true,
    enableTimestamps: true,
    enableCorrelationIds: true,
    outputFile: 'test-results/unified-console.log'
  });

  // Initialize browser log capture globally
  global.browserLogCapture = new BrowserLogCapture(global.unifiedReporter);

  // Initialize build log capture globally
  global.buildLogCapture = new BuildLogCapture(global.unifiedReporter, global.correlationManager);

  // Create global correlation for entire test run
  global.testRunCorrelation = global.correlationManager.createCorrelation(
    'TEST_RUN: Playwright Suite',
    'test',
    `Complete Playwright test execution with unified visibility - ${new Date().toISOString()}`
  );

  // Log initialization to unified console
  global.unifiedReporter.log('SYSTEM', '🚀 Unified Console Infrastructure initialized', 'success', global.testRunCorrelation.id);
  global.unifiedReporter.log('SYSTEM', `Test Suite: ${config.testDir}`, 'info', global.testRunCorrelation.id);
  global.unifiedReporter.log('SYSTEM', `Projects: ${config.projects?.map(p => p.name).join(', ') || 'default'}`, 'info', global.testRunCorrelation.id);
  global.unifiedReporter.log('SYSTEM', `Workers: ${config.workers}`, 'info', global.testRunCorrelation.id);
  global.unifiedReporter.log('SYSTEM', `Timeout: ${config.timeout}ms`, 'info', global.testRunCorrelation.id);

  // Start build log capture for the development server
  if (config.webServer?.command) {
    global.buildLogCapture.startBuildCapture(config.webServer.command, {
      timeout: config.webServer.timeout
    });
  }

  console.log('✅ Unified Console Infrastructure initialized successfully');
  console.log(`📊 Test Run Correlation ID: ${global.testRunCorrelation.id}`);

  return {
    testRunCorrelationId: global.testRunCorrelation.id,
    startTime: new Date().toISOString()
  };
}

module.exports = globalSetup;