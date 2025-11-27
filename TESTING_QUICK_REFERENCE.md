# NeuroSense FX Testing - Quick Reference Guide

## Essential Commands

### Core Testing Commands
```bash
# Primary testing workflow
./run.sh dev                    # Start development server (localhost:5174 + 8080)
npm run test:unit               # Pure business logic testing (Vitest)
npm run test:e2e                # Real browser workflow testing (Playwright)
npm run test:unified            # LLM-optimized visibility (recommended for development)
npm run test:all                # Complete test suite

# Utility commands
npm run test:install            # Install Playwright browsers (run once)
npm run test:report             # View HTML test report
npm run test:cleanup            # Clean test results
npm run test:logs               # View unified console logs
npm run test:summary            # View final test summary
```

### Debugging Commands
```bash
# Visible browser testing
npm run test:e2e -- --headed
npm run test:unified -- --headed

# Step-by-step debugging
npm run test:e2e -- --debug
npm run test:unified -- --debug

# Full trace capture
npm run test:e2e -- --trace on
npm run test:unified -- --trace on

# Specific test execution
npm run test:e2e -- tests/primary-trader-workflow.spec.js
npm run test:unified -- tests/primary-trader-workflow.spec.js
```

## Unified Console System

### Command Usage
```bash
# Run with maximum visibility
npm run test:unified

# Follow logs in real-time (after test starts)
npm run test:logs

# View final results summary
npm run test:summary
```

### Console Output Format
```
[TIMESTAMP][+ELAPSED] [SOURCE] MESSAGE [CORRELATION_ID]

Examples:
[2025-11-27T10:30:15.123Z][+0ms]     [SYSTEM] 🚀 Unified Console Reporter Starting [UNIFIED-1]
[2025-11-27T10:30:16.234Z][+1109ms]  [BUILD]  Vite server running on localhost:5174
[2025-11-27T10:30:19.123Z][+3998ms]  [TEST]   ▶️  Starting: Display creation workflow [UNIFIED-2]
[2025-11-27T10:30:19.456Z][+4331ms]  [BROWSER] INFO: Keyboard shortcut Ctrl+K triggered [UNIFIED-2]
[2025-11-27T10:30:20.789Z][+5664ms]  [TEST]   ✅ PASSED: Display creation workflow (2333ms) [UNIFIED-2]
```

### Log Sources and Meanings
- **SYSTEM**: Test infrastructure events (start/stop, configuration)
- **BUILD**: Vite dev server output (compilation, hot reload)
- **TEST**: Playwright test execution (start/stop, results)
- **BROWSER**: Browser console events (errors, warnings, info)
- **ERROR**: Critical errors and failures

### Correlation ID System
- **UNIFIED-1**: System-level events (test suite start/end)
- **UNIFIED-2, UNIFIED-3**: Individual test execution tracking
- Used to trace complete test flows from start to finish

## Error Interpretation Guide

### Common Error Patterns

#### Build System Errors
```
[2025-11-27T10:30:16.234Z][+1109ms] [BUILD] ERROR: Failed to compile
```
**Causes**: Syntax errors, missing dependencies, TypeScript issues
**Solutions**: Check source code, run `npm install`, verify imports

#### Browser Console Errors
```
[2025-11-27T10:30:19.456Z][+4331ms] [BROWSER] ERROR: Cannot read property 'price' of undefined
```
**Causes**: JavaScript runtime errors, undefined variables, API failures
**Solutions**: Check component state, verify data flow, use --headed debugging

#### Test Timeout Errors
```
[2025-11-27T10:30:45.123Z][+30000ms] [TEST] ❌ FAILED: Test timeout (30000ms)
```
**Causes**: Slow loading, network issues, element not found
**Solutions**: Increase timeout, check selectors, verify dev server status

#### WebSocket Connection Errors
```
[2025-11-27T10:30:18.789Z][+3664ms] [BROWSER] ERROR: WebSocket connection failed
```
**Causes**: Backend not running, port conflicts, network issues
**Solutions**: Run `./run.sh dev`, check ports, verify network connectivity

### Debugging Workflow

#### 1. Quick Issue Identification
```bash
# Run with unified visibility to see all errors
npm run test:unified
```

#### 2. Detailed Browser Investigation
```bash
# See what's happening in the browser
npm run test:unified -- --headed
```

#### 3. Step-by-Step Analysis
```bash
# Pause at each test step
npm run test:unified -- --debug
```

#### 4. Full Trace Capture
```bash
# Capture complete execution trace
npm run test:unified -- --trace on
npm run test:report  # View detailed HTML report
```

## Performance Metrics

### Expected Performance Thresholds
- **Display creation**: < 1000ms
- **Keyboard response**: < 310ms
- **Canvas rendering**: 60fps (16.7ms per frame)
- **WebSocket latency**: < 100ms
- **Test execution**: 30-60 seconds total

### Performance Monitoring
```bash
# Monitor test execution time
npm run test:unified | grep "PASSED\|FAILED"

# Check for performance regressions
npm run test:summary | jq '.duration'
```

## File Locations

### Configuration Files
- `/workspaces/neurosensefx/playwright.config.cjs` - Playwright configuration
- `/workspaces/neurosensefx/package.json` - Test commands and dependencies
- `/workspaces/neurosensefx/tests/reporters/unified-console-reporter.cjs` - Unified console system

### Test Files
- `/workspaces/neurosensefx/tests/primary-trader-workflow.spec.js` - Main E2E test
- `/workspaces/neurosensefx/tests/README.md` - Complete testing documentation

### Results and Logs
- `/workspaces/neurosensefx/test-results/unified-console.log` - Unified console output
- `/workspaces/neurosensefx/test-results/report/index.html` - Interactive HTML report
- `/workspaces/neurosensefx/test-results/final-summary.json` - Test summary data

## Developer Workflow Integration

### Before Code Changes
```bash
./run.sh dev                   # Start development environment
npm run test:unit -- --watch   # Run unit tests in watch mode
```

### During Development
```bash
npm run test:e2e              # Quick workflow validation
npm run test:unified          # Detailed debugging when needed
```

### Before Commits
```bash
npm run test:all              # Complete validation
npm run test:summary          # Verify all tests passed
```

### For Pull Requests
```bash
npm run test:all              # Full test suite
npm run test:cleanup && npm run test:all  # Clean run for CI
```

## Troubleshooting Checklist

### Environment Issues
- [ ] Development server running: `./run.sh dev`
- [ ] WebSocket server accessible: localhost:8080
- [ ] Playwright browsers installed: `npm run test:install`
- [ ] Dependencies up to date: `npm install`

### Test Execution Issues
- [ ] Port 5174 available for dev server
- [ ] Sufficient memory for browser testing
- [ ] Network connectivity for WebSocket tests
- [ ] File permissions for test-results directory

### Debugging Steps
1. **Run unified test**: `npm run test:unified`
2. **Check console logs**: `npm run test:logs`
3. **View HTML report**: `npm run test:report`
4. **Run with visible browser**: `npm run test:unified -- --headed`
5. **Step-by-step debug**: `npm run test:unified -- --debug`

## LLM Developer Tips

### Prompt Engineering for Test Analysis
- Ask for specific correlation IDs: "What happened in UNIFIED-2?"
- Request timeline analysis: "Show me the 5 seconds before the error"
- Focus on specific log types: "Show me only BROWSER errors"
- Performance queries: "What's the average display creation time?"

### Efficient Log Analysis
```bash
# Filter for errors only
npm run test:logs | grep ERROR

# Trace specific test
npm run test:logs | grep UNIFIED-2

# Performance analysis
npm run test:logs | grep "PASSED\|ms"
```

This quick reference provides the essential commands and patterns needed for effective testing of the NeuroSense FX trading platform with the unified console visibility system.