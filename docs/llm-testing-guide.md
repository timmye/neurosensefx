# LLM Testing Guide for NeuroSense FX

## Overview
This document provides a simple guide for LLMs to run and monitor tests for the NeuroSense FX frontend application.

## Available Testing Scripts

### 1. Basic Test Runner (`scripts/run-tests.sh`)
This script starts the application services, runs tests, and stops services.

**Usage:**
```bash
./scripts/run-tests.sh
```

**What it does:**
1. Checks if services are already running and stops them if needed
2. Starts the backend and frontend services
3. Waits for services to be ready
4. Runs the AddDisplayMenu Playwright tests
5. Stops the services
6. Reports the final test result

**Expected Output:**
- Success message: "✅ All tests passed!"
- Failure message: "❌ Some tests failed!"
- Exit code: 0 for success, 1 for failure

### 2. Test Result Monitor (`scripts/monitor-tests.js`)
This Node.js script runs tests and provides detailed monitoring and parsing of results.

**Usage:**
```bash
node scripts/monitor-tests.js
```

**What it does:**
1. Runs the AddDisplayMenu Playwright tests
2. Monitors the test output in real-time
3. Parses test results (pass/fail counts, duration, etc.)
4. Displays a formatted summary
5. Saves results to JSON and log files

**Output Files:**
- `test-results/test-results.json` - Detailed test results in JSON format
- `test-results/test-output.log` - Raw test output
- `test-results/test-errors.log` - Error output (if any)

**Expected Output:**
```
============================================
TEST RESULTS SUMMARY
============================================
Total Tests: X
Passed: X
Failed: X (if any)
Skipped: X (if any)
Duration: X.XXs
Exit Code: X
============================================
```

### 3. Continuous Testing (`scripts/watch-and-test.sh`)
This script watches for file changes and automatically runs tests.

**Usage:**
```bash
./scripts/watch-and-test.sh
```

**What it does:**
1. Runs an initial test
2. Watches for changes in source and test files
3. Automatically runs tests when changes are detected
4. Continues until interrupted (Ctrl+C)

**File Types Watched:**
- `.svelte` files in `src/`
- `.js` files in `src/`
- `.ts` files in `src/`
- `.spec.js` files in `e2e/`
- `.spec.ts` files in `e2e/`

## LLM Integration Examples

### Example 1: Run Tests and Get Results
```bash
# Run tests and get results
node scripts/monitor-tests.js && cat test-results/test-results.json
```

### Example 2: Check if Tests Passed
```bash
# Run tests and check exit code
if node scripts/monitor-tests.js; then
  echo "Tests passed"
else
  echo "Tests failed"
fi
```

### Example 3: Run Tests and Get Summary
```bash
# Run tests and extract key metrics
node scripts/monitor-tests.js | grep -E "(Total Tests|Passed|Failed|Duration)"
```

### Example 4: Run Tests with Custom Command
```bash
# Run specific test suite
node scripts/monitor-tests.js "npm run test:e2e"
```

## Test Result JSON Format

The `test-results.json` file contains detailed test results:

```json
{
  "timestamp": "2023-XX-XXTXX:XX:XX.XXXZ",
  "command": "npm run test:add-display-menu",
  "startTime": 1234567890,
  "endTime": 1234567990,
  "duration": 1000,
  "exitCode": 0,
  "passed": 5,
  "failed": 0,
  "skipped": 0,
  "total": 5,
  "suites": 2,
  "tests": [
    {
      "name": "Test name",
      "status": "passed",
      "duration": 100,
      "timestamp": "2023-XX-XXTXX:XX:XX.XXXZ"
    }
  ],
  "errors": [],
  "warnings": []
}
```

## Key Test Indicators

When checking test results, look for these key indicators:

1. **Exit Code**: 0 = success, non-zero = failure
2. **Passed Count**: Number of tests that passed
3. **Failed Count**: Number of tests that failed
4. **Duration**: Total time taken to run tests
5. **Errors Array**: List of error messages (if any)

## Common Testing Scenarios for LLM

### Before Making Changes:
```bash
# Run tests to establish baseline
node scripts/monitor-tests.js
```

### After Making Changes:
```bash
# Run tests to verify changes didn't break anything
node scripts/monitor-tests.js && cat test-results/test-results.json
```

### When Debugging:
```bash
# Run tests with detailed output
./scripts/run-tests.sh
```

### During Development:
```bash
# Start continuous testing
./scripts/watch-and-test.sh
```

## Troubleshooting

### Tests Won't Start:
1. Check if services are already running: `./run.sh status`
2. Stop services: `./run.sh stop`
3. Try again: `./scripts/run-tests.sh`

### Tests Fail:
1. Check the error log: `cat test-results/test-errors.log`
2. Check the full output: `cat test-results/test-output.log`
3. Look at the JSON results: `cat test-results/test-results.json`

### File Watching Doesn't Work:
1. Install required tools:
   - Linux: `sudo apt-get install inotify-tools`
   - macOS: `brew install fswatch`
   - Cross-platform: `gem install entr`

## Best Practices for LLM

1. Always check test results before making changes
2. Run tests after making changes to verify nothing broke
3. Use the JSON output for programmatic analysis of test results
4. Use the continuous testing script during development sessions
5. Check for errors in the test results when debugging

## Next Steps

After running tests, you can:
1. If tests pass: Continue with development or deployment
2. If tests fail: Analyze the errors and fix the issues
3. Run tests again to verify fixes