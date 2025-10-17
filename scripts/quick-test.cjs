// Quick Test Script for NeuroSense FX
// This script runs tests without starting/stopping services
// Assumes services are already running or tests are mocked

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

/**
 * Run a quick test without service management
 * @param {string} testCommand - Command to run tests
 * @returns {Promise<Object>} - Test results object
 */
function runQuickTest(testCommand = 'npm run test:add-display-menu') {
  return new Promise((resolve, reject) => {
    log.info(`Running quick test with command: ${testCommand}`);
    
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
      exitCode: null,
      success: false
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
      testResults.success = code === 0;
      
      // Parse test results from output
      parseQuickResults(stdout, testResults);
      
      // Display summary
      displayQuickSummary(testResults);
      
      // Return results based on exit code
      if (code === 0) {
        log.success('Quick test completed successfully!');
        resolve(testResults);
      } else {
        log.error(`Quick test failed with exit code: ${code}`);
        reject(testResults);
      }
    });
    
    // Handle process errors
    testProcess.on('error', (error) => {
      log.error(`Failed to start test process: ${error.message}`);
      reject(error);
    });
  });
}

/**
 * Parse basic test results from output
 * @param {string} output - Raw test output
 * @param {Object} results - Results object to update
 */
function parseQuickResults(output, results) {
  // Simple regex to extract basic metrics
  const passedRegex = /(\d+)\s+passed/g;
  const failedRegex = /(\d+)\s+failed/g;
  const skippedRegex = /(\d+)\s+skipped/g;
  
  const passedMatch = output.match(passedRegex);
  const failedMatch = output.match(failedRegex);
  const skippedMatch = output.match(skippedRegex);
  
  if (passedMatch) results.passed = parseInt(passedMatch[1]);
  if (failedMatch) results.failed = parseInt(failedMatch[1]);
  if (skippedMatch) results.skipped = parseInt(skippedMatch[1]);
  
  results.total = results.passed + results.failed + results.skipped;
}

/**
 * Display a quick test summary
 * @param {Object} results - Test results object
 */
function displayQuickSummary(results) {
  console.log('\n' + '='.repeat(50));
  console.log(`${colors.bright}QUICK TEST SUMMARY${colors.reset}`);
  console.log('='.repeat(50));
  
  console.log(`Exit Code: ${results.exitCode}`);
  console.log(`Success: ${results.success ? 'Yes' : 'No'}`);
  console.log(`Duration: ${(results.duration / 1000).toFixed(2)}s`);
  
  if (results.total > 0) {
    console.log(`Total Tests: ${results.total}`);
    console.log(`${colors.green}Passed: ${results.passed}${colors.reset}`);
    
    if (results.failed > 0) {
      console.log(`${colors.red}Failed: ${results.failed}${colors.reset}`);
    }
    
    if (results.skipped > 0) {
      console.log(`${colors.yellow}Skipped: ${results.skipped}${colors.reset}`);
    }
  }
  
  console.log('='.repeat(50));
}

// Run quick test if script is executed directly
if (require.main === module) {
  const testCommand = process.argv[2] || 'npm run test:add-display-menu';
  
  runQuickTest(testCommand)
    .then(results => {
      process.exit(0);
    })
    .catch(error => {
      process.exit(1);
    });
}

module.exports = { runQuickTest };