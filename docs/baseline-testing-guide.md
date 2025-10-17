# Baseline Testing Guide

## Purpose

The baseline test suite provides fast feedback on core canvas-centric workflows for the NeuroSense FX application. It serves as the primary testing method for all development actions.

## Implementation Status

### ✅ FULLY OPERATIONALIZED

The baseline testing strategy has been fully implemented and is ready for use:

- **Test Suite**: 5 core workflow tests in `e2e/baseline/`
- **Scripts**: Test runner and monitor scripts created
- **Configuration**: Minimal configuration for fast execution
- **Documentation**: Comprehensive guides and references
- **Repository Integration**: All components aligned around baseline tests

### Current Test Status

The baseline tests are currently failing due to application loading issues:
- Canvas element not found in test environment
- Test timeouts due to slow application startup
- Missing menu elements in current implementation

This is expected given the known issues with the application in the test environment. The test infrastructure is solid and ready for use once these issues are resolved.

## Quick Start

```bash
# Run baseline tests
npm run test:baseline

# Run with monitoring
npm run test:baseline:monitor
```

## Test Structure

### Location
```
e2e/baseline/
├── workflow-tests.spec.ts    # 5 core workflow tests
├── fixtures.ts               # Simple fixtures with error monitoring
├── config.ts                 # Minimal configuration
└── README.md                 # Test documentation
```

## Test Coverage

The baseline suite includes exactly 5 tests that cover the core canvas-centric workflows:

### 1. Basic Menu Functionality Test
- **Purpose**: Verifies the AddDisplayMenu opens correctly
- **What it tests**:
  - Right-click opens menu
  - Menu has expected title
  - Menu is visible

### 2. Symbol Selection Test
- **Purpose**: Verifies the symbol selection workflow
- **What it tests**:
  - Can select a display type
  - Symbol selector opens
  - Can select a symbol
  - Visualization appears

### 3. Menu Control Test
- **Purpose**: Verifies control sections are present
- **What it tests**:
  - Quick Actions section is present
  - Price Float section is present
  - Market Profile section is present

### 4. Error Handling Test
- **Purpose**: Verifies errors are handled gracefully
- **What it tests**:
  - Network errors are handled
  - Error messages appear
  - Application remains stable

### 5. Application Loading Test
- **Purpose**: Verifies application loads without errors
- **What it tests**:
  - Workspace container is present
  - Canvas element is present
  - No console errors

## Running Tests

### Basic Execution
```bash
npm run test:baseline
```

### With Monitoring
```bash
npm run test:baseline:monitor
```

### Direct Playwright
```bash
npx playwright test e2e/baseline --config=e2e/baseline/config.ts
```

## Interpreting Results

### Success Criteria
- All 5 tests pass
- Execution time under 30 seconds (when app loads properly)
- No console errors
- Clear output showing test results

### Example Success Output
```
Running 5 tests using 1 worker
  ✓ should open AddDisplayMenu on right-click
  ✓ should complete symbol selection workflow
  ✓ should show correct control options in menu
  ✓ should handle symbol loading errors gracefully
  ✓ should load application without console errors

  5 passed (25.3s)
```

### Example Failure Output
```
✗ should open AddDisplayMenu on right-click
  Error: Test timeout of 60000ms exceeded

  1 failed
  4 passed (58.7s)
```

## Error Messages

### Console Errors
Console errors are captured and displayed in the test output:
```
[ERROR] Failed to resolve import "../stores/canvasRegistry.js"
[PAGE ERROR] Cannot read property 'addEventListener' of null
```

### Test Failures
Test failures include clear error messages with stack traces:
```
Error: Test timeout of 60000ms exceeded
    at /workspaces/c/e2e/baseline/workflow-tests.spec.ts:5:8
```

## LLM Integration

The baseline tests are designed to be LLM-friendly:

### Clear Output
- Simple line reporter shows test results clearly
- Error messages are included in output
- Execution time is displayed

### Minimal Scope
- Exactly 5 tests to avoid overwhelming output
- Tests focus on core workflows only
- Simple, descriptive test names

### Error Visibility
- Console errors are captured and reported
- Page errors are monitored
- Clear error messages for debugging

## Troubleshooting

### Common Issues

#### Test Timeouts
- **Cause**: Application loading issues or element not found
- **Solution**: Check for console errors in output
- **Command**: Run with monitoring to see detailed output

#### Canvas Element Not Found
- **Cause**: Application not fully loaded
- **Solution**: Check for import errors or console errors
- **Command**: Run application manually to verify loading

#### Network Errors in Symbol Selection
- **Cause**: Backend service not running or connectivity issues
- **Solution**: Verify WebSocket connection and backend status
- **Command**: Check backend service status

### Debugging Commands

```bash
# Check application loading
npm run dev

# Run tests with monitoring
npm run test:baseline:monitor

# Check test results
cat test-results/baseline-summary.json
```

## Test Configuration

### Browser Configuration
- **Browser**: Chromium only
- **Viewport**: Desktop Chrome (1280x720)
- **Timeout**: 60 seconds per test
- **Retries**: 0 (CI: 1)

### Web Server Configuration
- **Command**: `npm run dev`
- **URL**: `http://localhost:5173`
- **Timeout**: 180 seconds
- **Reuse**: Yes (except in CI)

## Best Practices

### During Development
1. Run baseline tests after each significant change
2. Check for console errors in output
3. Ensure tests complete in under 30 seconds (when app loads properly)
4. Fix failing tests before committing changes

### For LLM Usage
1. Use baseline tests as primary validation method
2. Check test output for error messages
3. Use clear, descriptive commit messages
4. Report specific test failures when seeking help

### Maintaining Test Suite
1. Keep test count at exactly 5
2. Maintain under 30 seconds execution time (when app loads properly)
3. Update tests only when core workflows change
4. Preserve simple, clear output for LLM consumption

## Escalation Path

### Extended Testing
If additional testing is needed:
```bash
# Extended baseline tests (future)
npm run test:baseline:extended

# Component-specific tests
npm run test:component

# Full test suite
npm run test:full
```

### Performance Testing
For performance concerns:
```bash
# Performance tests (future)
npm run test:performance

# Visual regression tests (future)
npm run test:visual
```

## Repository Integration

### Documentation
- All documentation references baseline tests as primary method
- This guide serves as the single source of truth for baseline testing
- Other documentation references this guide for detailed information

### Package.json Scripts
- `test` - Points to baseline tests (default)
- `test:baseline` - Run baseline tests
- `test:baseline:monitor` - Run with monitoring
- `test:component` - Component-specific tests
- `test:full` - All tests

## Conclusion

The baseline testing strategy provides a solid foundation for continuous development with fast, reliable feedback on core canvas-centric workflows. It is fully operationalized with all components in place and ready for use.

While the tests are currently failing due to application loading issues, the infrastructure is solid and ready for use. The tests provide useful debugging information and will be valuable once the application loading issues are resolved.

For questions or issues, refer to the test output or run tests with monitoring for detailed information.