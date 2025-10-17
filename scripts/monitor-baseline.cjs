// Workflow-Based Baseline Test Monitoring Script
// Monitors workflow test output and provides enhanced reporting with browser log analysis

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('[INFO] Starting workflow-based baseline test monitoring...');
console.log('[INFO] Testing primary trader workflows with enhanced browser log monitoring');

// Create test results directory if it doesn't exist
const testResultsDir = path.join(process.cwd(), 'test-results', 'workflows');
if (!fs.existsSync(testResultsDir)) {
  fs.mkdirSync(testResultsDir, { recursive: true });
}

// Initialize test results
const testResults = {
  status: 'running',
  startTime: new Date().toISOString(),
  endTime: null,
  duration: null,
  passed: 0,
  failed: 0,
  skipped: 0,
  total: 0,
  tests: [],
  errors: [],
  warnings: [],
  workflows: {
    'workspace-to-live-prices': { status: 'pending', duration: 0 },
    'multi-symbol-workspace': { status: 'pending', duration: 0 },
    'market-analysis-workflow': { status: 'pending', duration: 0 }
  },
  browserLogs: {
    totalConsoleMessages: 0,
    errors: 0,
    warnings: 0,
    networkRequests: 0
  }
};

// Run tests
const testProcess = spawn('npx', [
  'playwright', 'test',
  'e2e/baseline',
  '--config=e2e/baseline/config.ts',
  '--reporter=json',
  `--output=${testResultsDir}`
], {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true
});

// Track workflow start times
const workflowStartTimes = {};

// Capture stdout
testProcess.stdout.on('data', (data) => {
  const output = data.toString().trim();
  if (output) {
    console.log(output);
    
    // Track workflow progress
    if (output.includes('workspace-to-live-prices')) {
      if (!workflowStartTimes['workspace-to-live-prices']) {
        workflowStartTimes['workspace-to-live-prices'] = Date.now();
        testResults.workflows['workspace-to-live-prices'].status = 'running';
      }
    }
    if (output.includes('multi-symbol-workspace')) {
      if (!workflowStartTimes['multi-symbol-workspace']) {
        workflowStartTimes['multi-symbol-workspace'] = Date.now();
        testResults.workflows['multi-symbol-workspace'].status = 'running';
      }
    }
    if (output.includes('market-analysis-workflow')) {
      if (!workflowStartTimes['market-analysis-workflow']) {
        workflowStartTimes['market-analysis-workflow'] = Date.now();
        testResults.workflows['market-analysis-workflow'].status = 'running';
      }
    }
  }
});

// Capture stderr
testProcess.stderr.on('data', (data) => {
  const output = data.toString().trim();
  if (output) {
    console.error(`[ERROR] ${output}`);
    testResults.errors.push(output);
  }
});

// Handle process completion
testProcess.on('close', (code) => {
  testResults.endTime = new Date().toISOString();
  testResults.duration = new Date(testResults.endTime) - new Date(testResults.startTime);
  testResults.status = code === 0 ? 'passed' : 'failed';
  
  // Try to read JSON results
  const jsonResultsPath = path.join(testResultsDir, 'results.json');
  try {
    if (fs.existsSync(jsonResultsPath)) {
      const jsonResults = JSON.parse(fs.readFileSync(jsonResultsPath, 'utf8'));
      
      // Extract test results
      testResults.total = jsonResults.suites.reduce((total, suite) => total + suite.specs.length, 0);
      testResults.passed = jsonResults.suites.reduce((total, suite) => 
        total + suite.specs.filter(spec => spec.ok).length, 0);
      testResults.failed = jsonResults.suites.reduce((total, suite) => 
        total + suite.specs.filter(spec => !spec.ok).length, 0);
      
      // Extract individual test results
      testResults.tests = jsonResults.suites.flatMap(suite => 
        suite.specs.map(spec => ({
          title: spec.title,
          file: suite.file,
          ok: spec.ok,
          duration: spec.results?.[0]?.duration || 0,
          errors: spec.errors || []
        }))
      );
      
      // Update workflow statuses
      testResults.tests.forEach(test => {
        if (test.title.includes('workspace-to-live-prices')) {
          testResults.workflows['workspace-to-live-prices'].status = test.ok ? 'passed' : 'failed';
          testResults.workflows['workspace-to-live-prices'].duration = test.duration;
        }
        if (test.title.includes('multi-symbol-workspace')) {
          testResults.workflows['multi-symbol-workspace'].status = test.ok ? 'passed' : 'failed';
          testResults.workflows['multi-symbol-workspace'].duration = test.duration;
        }
        if (test.title.includes('market-analysis-workflow')) {
          testResults.workflows['market-analysis-workflow'].status = test.ok ? 'passed' : 'failed';
          testResults.workflows['market-analysis-workflow'].duration = test.duration;
        }
      });
    }
  } catch (error) {
    console.log(`[WARNING] Could not parse JSON results: ${error.message}`);
    testResults.warnings.push(`Could not parse JSON results: ${error.message}`);
  }
  
  // Try to read browser log data from test results
  try {
    const logFiles = fs.readdirSync(testResultsDir).filter(file => file.includes('logs'));
    if (logFiles.length > 0) {
      // Aggregate browser log data
      logFiles.forEach(logFile => {
        try {
          const logData = JSON.parse(fs.readFileSync(path.join(testResultsDir, logFile), 'utf8'));
          if (logData.browserLogs) {
            testResults.browserLogs.totalConsoleMessages += logData.browserLogs.totalConsoleMessages || 0;
            testResults.browserLogs.errors += logData.browserLogs.errors || 0;
            testResults.browserLogs.warnings += logData.browserLogs.warnings || 0;
            testResults.browserLogs.networkRequests += logData.browserLogs.networkRequests || 0;
          }
        } catch (e) {
          // Skip invalid log files
        }
      });
    }
  } catch (error) {
    console.log(`[WARNING] Could not read browser log data: ${error.message}`);
  }
  
  // Write test results
  const resultsPath = path.join(testResultsDir, 'workflow-summary.json');
  fs.writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));
  
  // Display summary
  console.log('');
  console.log('==========================================');
  console.log('WORKFLOW-BASED BASELINE TEST SUMMARY');
  console.log('==========================================');
  console.log(`Status: ${testResults.status.toUpperCase()}`);
  console.log(`Duration: ${(testResults.duration / 1000).toFixed(2)}s`);
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`Passed: ${testResults.passed}`);
  console.log(`Failed: ${testResults.failed}`);
  
  console.log('');
  console.log('WORKFLOW RESULTS:');
  Object.entries(testResults.workflows).forEach(([workflow, result]) => {
    const status = result.status === 'passed' ? '✅' : result.status === 'failed' ? '❌' : '⏳';
    const duration = result.duration ? ` (${result.duration}ms)` : '';
    console.log(`  ${status} ${workflow}${duration}`);
  });
  
  console.log('');
  console.log('BROWSER LOG SUMMARY:');
  console.log(`  Console Messages: ${testResults.browserLogs.totalConsoleMessages}`);
  console.log(`  Errors: ${testResults.browserLogs.errors}`);
  console.log(`  Warnings: ${testResults.browserLogs.warnings}`);
  console.log(`  Network Requests: ${testResults.browserLogs.networkRequests}`);
  
  if (testResults.errors.length > 0) {
    console.log('');
    console.log('ERRORS:');
    testResults.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error}`);
    });
  }
  
  if (testResults.warnings.length > 0) {
    console.log('');
    console.log('WARNINGS:');
    testResults.warnings.forEach((warning, index) => {
      console.log(`${index + 1}. ${warning}`);
    });
  }
  
  console.log('==========================================');
  console.log(`Results saved to: ${resultsPath}`);
  console.log('==========================================');
  
  // Exit with test result code
  process.exit(code);
});

// Handle process errors
testProcess.on('error', (error) => {
  console.error(`[ERROR] Failed to start test process: ${error.message}`);
  testResults.status = 'error';
  testResults.endTime = new Date().toISOString();
  testResults.duration = new Date(testResults.endTime) - new Date(testResults.startTime);
  testResults.errors.push(`Failed to start test process: ${error.message}`);
  
  // Write error results
  const resultsPath = path.join(testResultsDir, 'workflow-summary.json');
  fs.writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));
  
  process.exit(1);
});