# Basic Continuous Testing Loop Plan

## Overview
This document outlines a simple, reliable approach to implement continuous browser testing for the NeuroSense FX frontend using Playwright and console output monitoring.

## Current State Analysis
- Playwright is already installed and configured
- Test suite exists for AddDisplayMenu component in `e2e/add-display-menu/`
- Basic GitHub Actions workflow exists for CI/CD
- Project uses Vite dev server for frontend and Node.js for backend

## Goal
Create a simple, reliable continuous testing loop that:
1. Runs Playwright tests automatically
2. Monitors console output for test results
3. Provides clear feedback on test status
4. Can be easily triggered by LLM or developer

## Implementation Plan

### Phase 1: Basic Test Runner Script
Create a simple shell script that:
- Starts the application services (backend and frontend)
- Waits for services to be ready
- Runs Playwright tests
- Captures and displays test results
- Stops services after testing

### Phase 2: Result Monitoring
Implement console output monitoring to:
- Parse test results in real-time
- Extract key metrics (pass/fail counts, execution time)
- Display clear success/failure indicators
- Log results to a file for reference

### Phase 3: Continuous Testing Loop
Add file watching capability to:
- Monitor source code files for changes
- Automatically trigger test runs on changes
- Provide feedback on test status
- Maintain a history of test results

### Phase 4: LLM Integration Framework
Create a simple interface that allows:
- LLM to trigger test runs
- LLM to retrieve test results
- LLM to understand test outcomes
- Clear documentation of the testing workflow

## Technical Implementation Details

### Test Runner Script (`scripts/run-tests.sh`)
```bash
#!/bin/bash
# Simple test runner script
echo "Starting NeuroSense FX Test Runner..."

# Start services
./run.sh start

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 10

# Run tests
echo "Running Playwright tests..."
npm run test:add-display-menu

# Capture exit code
TEST_EXIT_CODE=$?

# Stop services
./run.sh stop

# Return test result
if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo "✅ All tests passed!"
  exit 0
else
  echo "❌ Some tests failed!"
  exit 1
fi
```

### Result Monitoring Script (`scripts/monitor-tests.js`)
```javascript
// Node.js script to monitor and parse test results
const { spawn } = require('child_process');
const fs = require('fs');

function runTests() {
  return new Promise((resolve, reject) => {
    const testProcess = spawn('npm', ['run', 'test:add-display-menu'], {
      stdio: 'pipe',
      shell: true
    });
    
    let stdout = '';
    let stderr = '';
    
    testProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      process.stdout.write(output);
    });
    
    testProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      process.stderr.write(output);
    });
    
    testProcess.on('close', (code) => {
      const results = parseTestResults(stdout);
      results.exitCode = code;
      results.stderr = stderr;
      
      // Save results to file
      fs.writeFileSync('test-results.json', JSON.stringify(results, null, 2));
      
      if (code === 0) {
        console.log('✅ All tests passed!');
        resolve(results);
      } else {
        console.log('❌ Some tests failed!');
        reject(results);
      }
    });
  });
}

function parseTestResults(output) {
  // Parse test results from output
  const results = {
    timestamp: new Date().toISOString(),
    passed: 0,
    failed: 0,
    skipped: 0,
    total: 0,
    duration: 0,
    tests: []
  };
  
  // Simple regex parsing (can be enhanced)
  const passRegex = /(\d+) passed/g;
  const failRegex = /(\d+) failed/g;
  const skipRegex = /(\d+) skipped/g;
  const durationRegex = /in (\d+)ms/g;
  
  const passMatch = output.match(passRegex);
  const failMatch = output.match(failRegex);
  const skipMatch = output.match(skipRegex);
  const durationMatch = output.match(durationRegex);
  
  if (passMatch) results.passed = parseInt(passMatch[1]);
  if (failMatch) results.failed = parseInt(failMatch[1]);
  if (skipMatch) results.skipped = parseInt(skipMatch[1]);
  if (durationMatch) results.duration = parseInt(durationMatch[1]);
  
  results.total = results.passed + results.failed + results.skipped;
  
  return results;
}

// Run tests if script is executed directly
if (require.main === module) {
  runTests()
    .then(results => {
      console.log('Test results:', results);
      process.exit(0);
    })
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = { runTests, parseTestResults };
```

### Continuous Testing Script (`scripts/watch-and-test.sh`)
```bash
#!/bin/bash
# Simple file watcher and test runner
echo "Starting Continuous Testing Loop..."

# Function to run tests
run_tests() {
  echo "$(date): Changes detected, running tests..."
  node scripts/monitor-tests.js
  echo "$(date): Test run completed."
  echo "----------------------------------------"
}

# Initial test run
run_tests

# Watch for changes and run tests
inotifywait -m -r -e modify,create,delete --include '\.svelte$' --include '\.js$' --include '\.ts$' src/ |
while read path action file; do
  echo "File $file was $action"
  run_tests
done
```

## Usage Instructions

### Basic Test Run
```bash
# Run tests once
./scripts/run-tests.sh
```

### Monitor Test Results
```bash
# Run tests with detailed monitoring
node scripts/monitor-tests.js
```

### Continuous Testing
```bash
# Start continuous testing loop
./scripts/watch-and-test.sh
```

### LLM Integration
```bash
# LLM can run tests and get results
node scripts/monitor-tests.js && cat test-results.json
```

## Next Steps
1. Create the basic test runner script
2. Implement the result monitoring script
3. Test the basic loop with existing AddDisplayMenu tests
4. Add file watching for continuous testing
5. Create documentation for LLM integration
6. Test the complete workflow

## Expected Outcomes
- A reliable, simple testing loop that runs automatically
- Clear console output showing test results
- JSON file with detailed test results for programmatic access
- Ability for LLM to trigger tests and interpret results
- Foundation for more advanced testing features in the future