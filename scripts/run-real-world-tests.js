#!/usr/bin/env node

/**
 * Real-World Test Execution Script
 *
 * Comprehensive test execution with complete system visibility,
 * professional trading scenario validation, and detailed reporting.
 */

import { TestExecutionOrchestrator } from '../tests/helpers/test-execution-orchestrator.js';
import { realWorldConfig } from '../tests/helpers/fixtures.js';
import { program } from 'commander';

// Parse command line arguments
program
  .name('run-real-world-tests')
  .description('Execute comprehensive real-world tests with complete system visibility')
  .version('1.0.0')
  .option('-s, --suite <suite>', 'Test suite to run (primary-btcusd-workflow, professional-trader-scenarios, performance-stability, system-monitoring, full-regression)')
  .option('-b, --browsers <browsers>', 'Browsers to test (chromium,firefox,webkit)', 'chromium')
  .option('-q, --quick', 'Run quick validation only')
  .option('-v, --verbose', 'Verbose output with detailed metrics')
  .option('-r, --report <format>', 'Report format (json,markdown,console)', 'console')
  .option('-o, --output <file>', 'Output file for report')
  .option('--headless', 'Run browsers in headless mode')
  .option('--record-video', 'Record video of test execution')
  .option('--record-har', 'Record HAR files for network analysis')
  .parse();

const options = program.opts();

/**
 * Main execution function
 */
async function main() {
  console.log('🎯 NEUROSENSE FX - REAL-WORLD TESTING SYSTEM');
  console.log('='.repeat(60));
  console.log('Professional Trading Platform Validation with Complete System Visibility');
  console.log('='.repeat(60));

  const orchestrator = new TestExecutionOrchestrator();

  try {
    // Initialize environment
    await orchestrator.initializeEnvironment();

    // Quick validation mode
    if (options.quick) {
      console.log('\n⚡ Running quick validation...');
      const quickResult = await orchestrator.executeQuickValidation();

      if (quickResult.status === 'passed') {
        console.log('✅ Quick validation passed - system ready for comprehensive testing');
        process.exit(0);
      } else {
        console.log('❌ Quick validation failed - check system configuration');
        console.log('Error:', quickResult.error);
        process.exit(1);
      }
    }

    // Run specific test suite or all suites
    if (options.suite) {
      await runSpecificSuite(orchestrator, options.suite, options);
    } else {
      await runAllSuites(orchestrator, options);
    }

    // Generate and display comprehensive report
    const report = orchestrator.generateExecutionReport();

    // Save report if requested
    if (options.output) {
      await saveReport(report, options.output, options.report);
    }

    // Determine exit code based on results
    const failedSuites = report.summary.failedSuites;
    if (failedSuites > 0) {
      console.log(`\n❌ ${failedSuites} test suite(s) failed`);
      process.exit(1);
    } else {
      console.log('\n✅ All test suites passed successfully');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await orchestrator.cleanup();
  }
}

/**
 * Run a specific test suite
 */
async function runSpecificSuite(orchestrator, suiteName, options) {
  console.log(`\n🚀 Running test suite: ${suiteName}`);

  const suiteOptions = {
    browsers: options.browsers.split(','),
    headless: options.headless,
    recordVideo: options.recordVideo,
    recordHar: options.recordHar,
    verbose: options.verbose
  };

  const result = await orchestrator.executeTestSuite(suiteName, suiteOptions);

  if (options.verbose) {
    displayDetailedSuiteResults(result);
  }

  return result;
}

/**
 * Run all test suites
 */
async function runAllSuites(orchestrator, options) {
  console.log('\n🎯 Running all test suites...');

  const availableSuites = orchestrator.getAvailableTestSuites();
  const suiteOptions = {
    browsers: options.browsers.split(','),
    headless: options.headless,
    recordVideo: options.recordVideo,
    recordHar: options.recordHar,
    verbose: options.verbose
  };

  // Run suites in priority order
  const priorityOrder = ['critical', 'high', 'medium'];
  const sortedSuites = availableSuites.sort((a, b) => {
    const aPriority = priorityOrder.indexOf(a.priority);
    const bPriority = priorityOrder.indexOf(b.priority);
    return aPriority - bPriority;
  });

  for (const suite of sortedSuites) {
    console.log(`\n📋 ${suite.name} (${suite.priority} priority)`);
    console.log(`   ${suite.description}`);
    console.log(`   Estimated duration: ${(suite.estimatedDuration / 1000 / 60).toFixed(1)} minutes`);

    try {
      const result = await orchestrator.executeTestSuite(suite.key, suiteOptions);

      if (options.verbose) {
        displayDetailedSuiteResults(result);
      }

    } catch (error) {
      console.error(`❌ Failed to execute suite: ${suite.key}`, error.message);
    }
  }
}

/**
 * Display detailed suite results
 */
function displayDetailedSuiteResults(result) {
  console.log(`\n📊 Detailed Results for ${result.suiteName}:`);
  console.log(`Status: ${result.status.toUpperCase()}`);
  console.log(`Duration: ${(result.duration / 1000).toFixed(1)}s`);

  if (result.browserResults.length > 0) {
    console.log('\nBrowser Results:');
    result.browserResults.forEach(browserResult => {
      const icon = browserResult.status === 'passed' ? '✅' : '❌';
      console.log(`  ${icon} ${browserResult.browserName}: ${browserResult.status}`);

      if (browserResult.errors.length > 0) {
        console.log('    Errors:');
        browserResult.errors.forEach(error => {
          console.log(`      - ${error.error}`);
        });
      }
    });
  }

  if (result.systemMetrics && Object.keys(result.systemMetrics).length > 0) {
    console.log('\nSystem Metrics:');
    const metrics = result.systemMetrics;
    console.log(`  Peak Memory: ${(metrics.peakMemory / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Memory Growth: ${(metrics.memoryGrowth / 1024 / 1024).toFixed(2)} MB`);
  }
}

/**
 * Save report to file
 */
async function saveReport(report, filename, format) {
  const fs = await import('fs/promises');

  let content;
  let extension;

  switch (format) {
    case 'json':
      content = JSON.stringify(report, null, 2);
      extension = '.json';
      break;

    case 'markdown':
      content = generateMarkdownReport(report);
      extension = '.md';
      break;

    default:
      console.log('Console report format selected - no file saved');
      return;
  }

  // Add extension if not present
  const outputFile = filename.endsWith(extension) ? filename : filename + extension;

  try {
    await fs.writeFile(outputFile, content, 'utf8');
    console.log(`\n📄 Report saved to: ${outputFile}`);
  } catch (error) {
    console.error(`❌ Failed to save report: ${error.message}`);
  }
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(report) {
  const timestamp = new Date().toISOString();

  return `# NeuroSense FX - Real-World Testing Report

Generated: ${timestamp}

## Executive Summary

- **Total Test Suites:** ${report.summary.totalSuites}
- **Passed:** ${report.summary.passedSuites}
- **Failed:** ${report.summary.failedSuites}
- **Success Rate:** ${((report.summary.passedSuites / report.summary.totalSuites) * 100).toFixed(1)}%
- **Total Duration:** ${(report.summary.totalDuration / 1000 / 60).toFixed(1)} minutes

## Environment

- **Node.js:** ${report.environment.nodeVersion}
- **Platform:** ${report.environment.platform} (${report.environment.arch})
- **Process ID:** ${report.environment.pid}

## System Performance

${Object.keys(report.systemMetrics).length > 0 ? `
- **Monitoring Samples:** ${report.systemMetrics.samplesCount}
- **Peak Memory:** ${(report.systemMetrics.peakMemory / 1024 / 1024).toFixed(2)} MB
- **Average Memory:** ${(report.systemMetrics.averageMemory / 1024 / 1024).toFixed(2)} MB
- **Memory Growth:** ${(report.systemMetrics.memoryGrowth / 1024 / 1024).toFixed(2)} MB
` : 'No system metrics available.'}

## Test Suite Results

${report.testResults.map((result, index) => `
### ${index + 1}. ${result.suite.name}

**Status:** ${result.status.toUpperCase()}
**Duration:** ${(result.duration / 1000).toFixed(1)}s
**Priority:** ${result.suite.priority}

**Browsers Tested:**
${result.browserResults.map(browser =>
  `- **${browser.browserName}:** ${browser.status} (${browser.testResults.length} tests)`
).join('\n')}

**Description:** ${result.suite.description}
`).join('\n')}

## Performance Insights

This report provides comprehensive visibility into system performance during professional trading scenarios. Key areas monitored include:

- Real-time rendering performance (60fps target)
- Memory usage and leak detection
- WebSocket connection stability
- User interaction latency
- Multi-instrument monitoring efficiency

## Recommendations

Based on the test results, consider the following for production deployment:

1. **Performance:** All tests should maintain 60fps rendering
2. **Memory:** Monitor memory usage in extended sessions
3. **Connectivity:** Ensure WebSocket stability for live data
4. **User Experience:** Validate keyboard shortcuts under load

---

*Generated by NeuroSense FX Real-World Testing System*
`;
}

// Execute main function
main().catch(console.error);