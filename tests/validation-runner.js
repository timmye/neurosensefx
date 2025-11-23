#!/usr/bin/env node

/**
 * NeuroSense FX Validation Test Runner
 *
 * Comprehensive test execution script for coordinate precision and position drift validation.
 * Runs all validation tests with detailed reporting and analysis.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  testFiles: [
    'coordinate-precision.spec.js',
    'extended-session-stability.spec.js',
    'user-interaction-workflows.spec.js',
    'performance-benchmarking.spec.js',
    'memory-management-cleanup.spec.js'
  ],
  browsers: ['chromium', 'firefox', 'webkit'],
  testTimeout: 120000,
  retries: 2,
  reporters: ['html', 'json'],
  outputDir: 'test-results/validation'
};

// ANSI color codes for output formatting
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Utility functions
function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(`\n${title}`, 'bright');
  console.log('='.repeat(60));
}

function logTestResult(testName, status, details = '') {
  const statusColor = status === 'PASS' ? 'green' : status === 'FAIL' ? 'red' : 'yellow';
  const statusSymbol = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '⚠';

  log(`${statusSymbol} ${testName}`, statusColor);
  if (details) {
    console.log(`  ${details}`);
  }
}

// Create output directory
function ensureOutputDir() {
  const dir = path.join(process.cwd(), TEST_CONFIG.outputDir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// Run Playwright tests with specific configuration
function runPlaywrightTest(testFile, browser = 'chromium') {
  const testPath = path.join('tests/e2e', testFile);
  const args = [
    'playwright',
    'test',
    testPath,
    `--project=${browser}`,
    `--timeout=${TEST_CONFIG.testTimeout}`,
    `--retries=${TEST_CONFIG.retries}`,
    '--headed=false',
    '--reporter=json',
    `--output-file=${TEST_CONFIG.outputDir}/${testFile.replace('.spec.js', '')}-${browser}-report.json`
  ];

  try {
    const output = execSync(args.join(' '), {
      encoding: 'utf8',
      stdio: 'pipe'
    });

    return { success: true, output };
  } catch (error) {
    return {
      success: false,
      output: error.stdout || error.stderr || error.message,
      exitCode: error.status
    };
  }
}

// Parse Playwright JSON report
function parseReport(reportPath) {
  try {
    if (!fs.existsSync(reportPath)) {
      return { tests: [], summary: { passed: 0, failed: 0, skipped: 0 } };
    }

    const reportContent = fs.readFileSync(reportPath, 'utf8');
    const report = JSON.parse(reportContent);

    const summary = {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0
    };

    const tests = report.suites ? report.suites.flatMap(suite =>
      suite.specs.flatMap(spec =>
        spec.tests.map(test => ({
          title: `${suite.title} > ${spec.title} > ${test.title}`,
          status: test.results[0]?.status || 'unknown',
          duration: test.results[0]?.duration || 0,
          errors: test.results[0]?.errors || []
        }))
      )
    ) : [];

    tests.forEach(test => {
      summary.total++;
      switch (test.status) {
        case 'passed':
          summary.passed++;
          break;
        case 'failed':
          summary.failed++;
          break;
        case 'skipped':
          summary.skipped++;
          break;
      }
    });

    return { tests, summary };
  } catch (error) {
    console.warn(`Failed to parse report ${reportPath}:`, error.message);
    return { tests: [], summary: { passed: 0, failed: 0, skipped: 0 } };
  }
}

// Generate comprehensive HTML report
function generateHTMLReport(results) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NeuroSense FX Validation Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 2.5em; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; font-size: 1.2em; }
        .content { padding: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: #f8f9fa; border-radius: 8px; padding: 20px; text-align: center; }
        .summary-card h3 { margin: 0 0 10px 0; color: #495057; }
        .summary-card .value { font-size: 2em; font-weight: bold; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .skipped { color: #ffc107; }
        .test-results { margin-top: 30px; }
        .browser-section { margin-bottom: 40px; }
        .browser-section h2 { color: #495057; border-bottom: 2px solid #e9ecef; padding-bottom: 10px; }
        .test-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        .test-table th, .test-table td { padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6; }
        .test-table th { background: #f8f9fa; font-weight: 600; }
        .test-status { padding: 4px 8px; border-radius: 4px; font-size: 0.85em; font-weight: 600; }
        .status-passed { background: #d4edda; color: #155724; }
        .status-failed { background: #f8d7da; color: #721c24; }
        .status-skipped { background: #fff3cd; color: #856404; }
        .timestamp { color: #6c757d; font-size: 0.9em; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; border-radius: 0 0 8px 8px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>NeuroSense FX Validation Test Report</h1>
            <p>Coordinate Precision and Position Drift Validation Results</p>
        </div>

        <div class="content">
            <div class="summary">
                <div class="summary-card">
                    <h3>Total Tests</h3>
                    <div class="value">${results.totalTests}</div>
                </div>
                <div class="summary-card">
                    <h3>Passed</h3>
                    <div class="value passed">${results.totalPassed}</div>
                </div>
                <div class="summary-card">
                    <h3>Failed</h3>
                    <div class="value failed">${results.totalFailed}</div>
                </div>
                <div class="summary-card">
                    <h3>Skipped</h3>
                    <div class="value skipped">${results.totalSkipped}</div>
                </div>
                <div class="summary-card">
                    <h3>Success Rate</h3>
                    <div class="value ${results.successRate >= 90 ? 'passed' : results.successRate >= 70 ? 'skipped' : 'failed'}">
                        ${results.successRate.toFixed(1)}%
                    </div>
                </div>
            </div>

            <div class="test-results">
                ${Object.entries(results.browserResults).map(([browser, browserResult]) => `
                    <div class="browser-section">
                        <h2>${browser.charAt(0).toUpperCase() + browser.slice(1)} Results</h2>

                        <div class="summary">
                            <div class="summary-card">
                                <h3>Tests Run</h3>
                                <div class="value">${browserResult.summary.total}</div>
                            </div>
                            <div class="summary-card">
                                <h3>Passed</h3>
                                <div class="value passed">${browserResult.summary.passed}</div>
                            </div>
                            <div class="summary-card">
                                <h3>Failed</h3>
                                <div class="value failed">${browserResult.summary.failed}</div>
                            </div>
                        </div>

                        <table class="test-table">
                            <thead>
                                <tr>
                                    <th>Test</th>
                                    <th>Status</th>
                                    <th>Duration</th>
                                    <th>Errors</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${browserResult.tests.map(test => `
                                    <tr>
                                        <td>${test.title}</td>
                                        <td>
                                            <span class="test-status status-${test.status}">
                                                ${test.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td>${(test.duration / 1000).toFixed(2)}s</td>
                                        <td>
                                            ${test.errors.length > 0 ?
                                                test.errors.map(err => err.message).join('; ') :
                                                'None'
                                            }
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="footer">
            <p>Generated on ${new Date().toLocaleString()} | NeuroSense FX Validation Suite</p>
        </div>
    </div>
</body>
</html>`;

  const reportPath = path.join(ensureOutputDir(), 'validation-report.html');
  fs.writeFileSync(reportPath, html);
  return reportPath;
}

// Main validation test runner
async function runValidationTests() {
  logSection('NeuroSense FX Validation Test Runner');

  log('Starting comprehensive validation testing...', 'cyan');
  log(`Test files: ${TEST_CONFIG.testFiles.join(', ')}`, 'blue');
  log(`Target browsers: ${TEST_CONFIG.browsers.join(', ')}`, 'blue');
  log(`Timeout: ${TEST_CONFIG.testTimeout}ms`, 'blue');

  const outputDir = ensureOutputDir();
  log(`Output directory: ${outputDir}`, 'blue');

  const results = {
    browserResults: {},
    totalTests: 0,
    totalPassed: 0,
    totalFailed: 0,
    totalSkipped: 0,
    successRate: 0
  };

  // Run tests for each browser
  for (const browser of TEST_CONFIG.browsers) {
    logSection(`Running tests on ${browser}`);

    const browserResults = {
      summary: { passed: 0, failed: 0, skipped: 0, total: 0 },
      tests: []
    };

    for (const testFile of TEST_CONFIG.testFiles) {
      log(`\nTesting: ${testFile}`, 'yellow');

      const testResult = runPlaywrightTest(testFile, browser);

      if (testResult.success) {
        const reportPath = path.join(outputDir, `${testFile.replace('.spec.js', '')}-${browser}-report.json`);
        const report = parseReport(reportPath);

        browserResults.summary.passed += report.summary.passed;
        browserResults.summary.failed += report.summary.failed;
        browserResults.summary.skipped += report.summary.skipped;
        browserResults.tests.push(...report.tests);

        logTestResult(
          testFile,
          report.summary.failed === 0 ? 'PASS' : 'FAIL',
          `${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.skipped} skipped`
        );
      } else {
        logTestResult(testFile, 'FAIL', `Execution error: ${testResult.output}`);
        browserResults.summary.failed++;
      }
    }

    browserResults.summary.total = browserResults.summary.passed +
                                     browserResults.summary.failed +
                                     browserResults.summary.skipped;

    results.browserResults[browser] = browserResults;

    // Update totals
    results.totalTests += browserResults.summary.total;
    results.totalPassed += browserResults.summary.passed;
    results.totalFailed += browserResults.summary.failed;
    results.totalSkipped += browserResults.summary.skipped;
  }

  // Calculate overall success rate
  results.successRate = results.totalTests > 0 ? (results.totalPassed / results.totalTests) * 100 : 0;

  // Generate summary report
  logSection('Validation Test Summary');

  log(`Total Tests: ${results.totalTests}`, results.totalPassed === results.totalTests ? 'green' : 'yellow');
  log(`Passed: ${results.totalPassed}`, 'green');
  log(`Failed: ${results.totalFailed}`, results.totalFailed > 0 ? 'red' : 'green');
  log(`Skipped: ${results.totalSkipped}`, 'yellow');
  log(`Success Rate: ${results.successRate.toFixed(1)}%`, results.successRate >= 90 ? 'green' : results.successRate >= 70 ? 'yellow' : 'red');

  // Generate HTML report
  const reportPath = generateHTMLReport(results);
  log(`\nHTML report generated: ${reportPath}`, 'cyan');

  // Exit with appropriate code
  if (results.totalFailed > 0) {
    log('\n⚠ Some validation tests failed. Please review the report.', 'yellow');
    process.exit(1);
  } else {
    log('\n✅ All validation tests passed!', 'green');
    process.exit(0);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
NeuroSense FX Validation Test Runner

Usage: node validation-runner.js [options]

Options:
  --help, -h      Show this help message
  --browser <name> Run tests on specific browser only (chromium|firefox|webkit)
  --test <file>   Run specific test file only
  --quick         Run tests with reduced timeout for quick validation

Examples:
  node validation-runner.js                           # Run all tests on all browsers
  node validation-runner.js --browser chromium       # Run only on Chrome
  node validation-runner.js --test coordinate-precision.spec.js  # Run specific test
  node validation-runner.js --quick                   # Quick validation run
`);
  process.exit(0);
}

// Apply command line overrides
if (args.includes('--quick')) {
  TEST_CONFIG.testTimeout = 30000;
  TEST_CONFIG.retries = 0;
}

const browserIndex = args.indexOf('--browser');
if (browserIndex !== -1 && args[browserIndex + 1]) {
  TEST_CONFIG.browsers = [args[browserIndex + 1]];
}

const testIndex = args.indexOf('--test');
if (testIndex !== -1 && args[testIndex + 1]) {
  TEST_CONFIG.testFiles = [args[testIndex + 1]];
}

// Run the validation tests
runValidationTests().catch(error => {
  console.error('Validation test runner failed:', error);
  process.exit(1);
});