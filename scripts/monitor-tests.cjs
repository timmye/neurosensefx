// Test Result Monitoring Script for NeuroSense FX
// This script runs tests and monitors/parses the results

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Logging functions
const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  result: (msg) => console.log(`${colors.cyan}[RESULT]${colors.reset} ${msg}`)
};

// Ensure test results directory exists
const testResultsDir = path.join(process.cwd(), 'test-results');
if (!fs.existsSync(testResultsDir)) {
  fs.mkdirSync(testResultsDir, { recursive: true });
}

/**
 * Run tests and monitor results
 * @param {string} testCommand - Command to run tests (default: npm run test:add-display-menu)
 * @returns {Promise<Object>} - Test results object
 */
function runTests(testCommand = 'npm run test:add-display-menu') {
  return new Promise((resolve, reject) => {
    log.info(`Running tests with command: ${testCommand}`);
    
    const startTime = Date.now();
    const testProcess = spawn(testCommand, { shell: true, stdio: 'pipe' });
    
    let stdout = '';
    let stderr = '';
    let testResults = {
      timestamp: new Date().toISOString(),
      command: testCommand,
      startTime,
      endTime: null,
      duration: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      suites: 0,
      tests: [],
      errors: [],
      warnings: []
    };
    
    // Process stdout
    testProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      process.stdout.write(output);
    });
    
    // Process stderr
    testProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      process.stderr.write(output);
    });
    
    // Handle process completion
    testProcess.on('close', (code) => {
      testResults.endTime = Date.now();
      testResults.duration = testResults.endTime - testResults.startTime;
      testResults.exitCode = code;
      testResults.stdout = stdout;
      testResults.stderr = stderr;
      
      // Parse test results from output
      parseTestResults(stdout, testResults);
      
      // Save results to file
      const resultsFile = path.join(testResultsDir, 'test-results.json');
      fs.writeFileSync(resultsFile, JSON.stringify(testResults, null, 2));
      
      // Save raw output for reference
      const outputFile = path.join(testResultsDir, 'test-output.log');
      fs.writeFileSync(outputFile, stdout);
      
      if (stderr) {
        const errorFile = path.join(testResultsDir, 'test-errors.log');
        fs.writeFileSync(errorFile, stderr);
      }
      
      // Display summary
      displayTestSummary(testResults);
      
      // Return results based on exit code
      if (code === 0) {
        log.success('All tests passed!');
        resolve(testResults);
      } else {
        log.error(`Tests failed with exit code: ${code}`);
        reject(testResults);
      }
    });
    
    // Handle process errors
    testProcess.on('error', (error) => {
      log.error(`Failed to start test process: ${error.message}`);
      testResults.errors.push({
        type: 'process',
        message: error.message,
        stack: error.stack
      });
      reject(testResults);
    });
  });
}

/**
 * Parse test results from Playwright output
 * @param {string} output - Raw test output
 * @param {Object} results - Results object to update
 */
function parseTestResults(output, results) {
  try {
    // Parse summary line (e.g., "5 passed (5s)")
    const summaryRegex = /(\d+)\s+passed\s+\((\d+(?:\.\d+)?)s\)/g;
    let summaryMatch;
    
    while ((summaryMatch = summaryRegex.exec(output)) !== null) {
      results.passed += parseInt(summaryMatch[1]);
    }
    
    // Parse failed tests
    const failedRegex = /(\d+)\s+failed/g;
    const failedMatch = output.match(failedRegex);
    if (failedMatch) {
      results.failed = parseInt(failedMatch[1]);
    }
    
    // Parse skipped tests
    const skippedRegex = /(\d+)\s+skipped/g;
    const skippedMatch = output.match(skippedRegex);
    if (skippedMatch) {
      results.skipped = parseInt(skippedMatch[1]);
    }
    
    // Parse total number of tests
    results.total = results.passed + results.failed + results.skipped;
    
    // Parse individual test results
    const testRegex = /^(✓|✕)\s+(.+?)\s+\[(\d+(?:\.\d+)?)ms\]/gm;
    let testMatch;
    
    while ((testMatch = testRegex.exec(output)) !== null) {
      const status = testMatch[1] === '✓' ? 'passed' : 'failed';
      const name = testMatch[2].trim();
      const duration = parseFloat(testMatch[3]);
      
      results.tests.push({
        name,
        status,
        duration,
        timestamp: new Date().toISOString()
      });
    }
    
    // Parse suite information
    const suiteRegex = /Test\s+Suite\s+(.+)/g;
    let suiteMatch;
    results.suites = 0;
    
    while ((suiteMatch = suiteRegex.exec(output)) !== null) {
      results.suites++;
    }
    
    // Extract errors and warnings from output
    const errorRegex = /Error:\s*(.+)/gi;
    let errorMatch;
    
    while ((errorMatch = errorRegex.exec(output)) !== null) {
      results.errors.push({
        type: 'test',
        message: errorMatch[1],
        timestamp: new Date().toISOString()
      });
    }
    
    const warningRegex = /Warning:\s*(.+)/gi;
    let warningMatch;
    
    while ((warningMatch = warningRegex.exec(output)) !== null) {
      results.warnings.push({
        type: 'test',
        message: warningMatch[1],
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    log.warning(`Error parsing test results: ${error.message}`);
    results.errors.push({
      type: 'parsing',
      message: error.message,
      stack: error.stack
    });
  }
}

/**
 * Display a formatted test summary
 * @param {Object} results - Test results object
 */
function displayTestSummary(results) {
  console.log('\n' + '='.repeat(60));
  console.log(`${colors.bright}TEST RESULTS SUMMARY${colors.reset}`);
  console.log('='.repeat(60));
  
  console.log(`Total Tests: ${results.total}`);
  console.log(`${colors.green}Passed: ${results.passed}${colors.reset}`);
  
  if (results.failed > 0) {
    console.log(`${colors.red}Failed: ${results.failed}${colors.reset}`);
  }
  
  if (results.skipped > 0) {
    console.log(`${colors.yellow}Skipped: ${results.skipped}${colors.reset}`);
  }
  
  console.log(`Duration: ${(results.duration / 1000).toFixed(2)}s`);
  console.log(`Exit Code: ${results.exitCode}`);
  
  if (results.errors.length > 0) {
    console.log(`\n${colors.red}Errors:${colors.reset}`);
    results.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error.message}`);
    });
  }
  
  if (results.warnings.length > 0) {
    console.log(`\n${colors.yellow}Warnings:${colors.reset}`);
    results.warnings.forEach((warning, index) => {
      console.log(`  ${index + 1}. ${warning.message}`);
    });
  }
  
  console.log('='.repeat(60));
  
  // Show file locations
  console.log(`\n${colors.blue}Results saved to:${colors.reset}`);
  console.log(`  JSON: ${path.join(testResultsDir, 'test-results.json')}`);
  console.log(`  Output: ${path.join(testResultsDir, 'test-output.log')}`);
  
  if (results.stderr) {
    console.log(`  Errors: ${path.join(testResultsDir, 'test-errors.log')}`);
  }
}

/**
 * Get latest test results
 * @returns {Object|null} - Latest test results or null if not found
 */
function getLatestResults() {
  const resultsFile = path.join(testResultsDir, 'test-results.json');
  
  if (fs.existsSync(resultsFile)) {
    try {
      const data = fs.readFileSync(resultsFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      log.error(`Error reading test results: ${error.message}`);
      return null;
    }
  }
  
  return null;
}

/**
 * Check if tests passed in the latest run
 * @returns {boolean|null} - True if passed, false if failed, null if no results
 */
function didTestsPass() {
  const results = getLatestResults();
  if (!results) {
    return null;
  }
  
  return results.exitCode === 0 && results.failed === 0;
}

// Run tests if script is executed directly
if (require.main === module) {
  const testCommand = process.argv[2] || 'npm run test:add-display-menu';
  
  runTests(testCommand)
    .then(results => {
      log.success('Test monitoring completed successfully');
      process.exit(0);
    })
    .catch(error => {
      log.error('Test monitoring failed');
      process.exit(1);
    });
}

module.exports = {
  runTests,
  parseTestResults,
  getLatestResults,
  didTestsPass
};