# Workflow-Based Testing Guide

## Overview

This guide documents the new workflow-based baseline testing approach for NeuroSense FX, which follows the **Workflows → Interactions → Technology** framework to test primary trader workflows with comprehensive browser log monitoring.

## Testing Framework

### Primary: Trader Workflows
Tests focus on how professional traders actually work and think during market analysis:

1. **Workspace to Live Prices** - Empty workspace → Symbol selection → Canvas creation → Live prices
2. **Multi-Symbol Workspace** - Multiple canvases → Layout management → Simultaneous monitoring
3. **Market Analysis** - Canvas → Context menu → Parameter configuration → Visualization changes

### Secondary: Interaction Patterns
Tests validate interface behaviors that support trader workflows:

- Floating panel interactions (drag, minimize, position)
- Canvas interactions (right-click, configuration, management)
- Symbol selection interactions (search, filter, quick selection)

### Tertiary: Technology Implementation
Tests ensure the technical foundation enables workflows without compromising performance:

- Browser log monitoring and error validation
- Performance metrics tracking
- State management and persistence
- Network request monitoring

## Test Structure

### File Organization

```
e2e/baseline/
├── config.ts                     # Test configuration
├── globalSetup.ts                # Global test setup
├── globalTeardown.ts             # Global test cleanup
├── utils/
│   └── browserLogMonitor.js      # Enhanced browser log monitoring
├── fixtures/
│   └── workflowFixtures.js       # Reusable test utilities
└── workflows/
    ├── workspace-to-live-prices.spec.js      # Core workflow test
    ├── multi-symbol-workspace.spec.js        # Multi-symbol workflow test
    └── market-analysis-workflow.spec.js      # Analysis workflow test
```

### Test Components

#### Browser Log Monitor (`utils/browserLogMonitor.js`)
Comprehensive log monitoring utility that captures:
- All console messages (error, warn, info, debug) with context
- Network requests and responses
- JavaScript errors and stack traces
- Performance metrics
- Time-based log filtering

#### Workflow Fixtures (`fixtures/workflowFixtures.js`)
Reusable test utilities including:
- Enhanced page setup with log monitoring
- Floating panel interaction utilities
- Symbol selection and canvas creation helpers
- Context menu interaction utilities
- Browser log validation utilities

#### Workflow Tests (`workflows/`)
Primary trader workflow tests:
- **workspace-to-live-prices.spec.js**: Tests complete workflow from empty workspace to live price display
- **multi-symbol-workspace.spec.js**: Tests multiple canvas creation and workspace management
- **market-analysis-workflow.spec.js**: Tests context menu configuration and parameter changes

## Running Tests

### Basic Test Execution
```bash
# Run all workflow-based baseline tests
npm run test:baseline

# Run with enhanced monitoring
npm run test:baseline:monitor
```

### Test Scripts
```bash
# Primary test runner
./scripts/test-baseline.sh

# Enhanced monitoring with detailed output
./scripts/monitor-baseline.cjs
```

### Test Configuration
- **Test Directory**: `e2e/baseline/workflows/`
- **Config File**: `e2e/baseline/config.ts`
- **Results Directory**: `test-results/workflows/`
- **Timeout**: 30 seconds per test (with 5 second action timeout)

## Browser Log Monitoring

### Log Capture
The enhanced browser log monitor captures:
- **Console Messages**: All levels with timestamps and locations
- **Page Errors**: JavaScript errors with stack traces
- **Network Activity**: Requests and responses with timing
- **Performance Metrics**: Load times, render times, memory usage

### Log Validation
Tests validate browser logs for:
- **Critical Errors**: No JavaScript errors or unhandled exceptions
- **Common Error Patterns**: Checks for common issues (TypeError, NetworkError, etc.)
- **Performance Thresholds**: Validates load times and responsiveness
- **Network Status**: Ensures proper WebSocket and API connections

### Log Reporting
Test reports include:
- **Error Summary**: Count and details of any errors found
- **Warning Summary**: Count and details of any warnings
- **Performance Metrics**: Load times, render times, network requests
- **Timeline Analysis**: Time-based correlation of events

## Test Workflows

### 1. Workspace to Live Prices Workflow
**Test**: `workspace-to-live-prices.spec.js`

**Steps**:
1. Verify empty workspace state
2. Wait for floating panels to load
3. Select symbol from palette
4. Create canvas for selected symbol
5. Wait for live price data
6. Validate workspace state
7. Validate browser logs

**Validations**:
- Empty workspace initially
- All floating panels visible
- Symbol selection works
- Canvas creation successful
- Canvas shows correct symbol
- No critical browser errors

### 2. Multi-Symbol Workspace Workflow
**Test**: `multi-symbol-workspace.spec.js`

**Steps**:
1. Initialize workspace
2. Create multiple symbol canvases
3. Test workspace layout and positioning
4. Test canvas interaction and activation
5. Test z-index management
6. Test canvas closing
7. Test workspace state persistence
8. Validate browser logs

**Validations**:
- Multiple canvases created successfully
- Proper positioning and layout
- Canvas activation and interaction
- Z-index management works
- Canvas closing functions
- State persistence maintained
- No critical browser errors

### 3. Market Analysis Workflow
**Test**: `market-analysis-workflow.spec.js`

**Steps**:
1. Set up workspace and canvas
2. Open context menu on canvas
3. Test tab navigation
4. Test search functionality
5. Test parameter configuration
6. Test menu actions
7. Test configuration persistence
8. Validate browser logs

**Validations**:
- Context menu opens correctly
- Tab navigation works
- Search functionality operates
- Parameter configuration applies
- Menu actions function
- Configuration persists
- No critical browser errors

## Test Results

### Result Files
- **JSON Results**: `test-results/workflows/workflow-results.json`
- **Test Summary**: `test-results/workflows/workflow-summary.json`
- **Browser Logs**: `test-results/workflows/logs/`
- **Test Videos**: `test-results/workflows/` (for failed tests)

### Result Format
```json
{
  "status": "passed",
  "duration": 15420,
  "total": 5,
  "passed": 5,
  "failed": 0,
  "workflows": {
    "workspace-to-live-prices": { "status": "passed", "duration": 5230 },
    "multi-symbol-workspace": { "status": "passed", "duration": 6120 },
    "market-analysis-workflow": { "status": "passed", "duration": 4070 }
  },
  "browserLogs": {
    "totalConsoleMessages": 45,
    "errors": 0,
    "warnings": 2,
    "networkRequests": 12
  }
}
```

## Troubleshooting

### Common Issues

#### Test Timeouts
- **Cause**: Services not starting quickly enough
- **Solution**: Check service status with `./run.sh status`
- **Prevention**: Ensure clean environment with `./run.sh cleanup`

#### Browser Errors
- **Cause**: JavaScript errors or network issues
- **Solution**: Check browser logs in test results
- **Prevention**: Validate application loads manually before running tests

#### Context Menu Issues
- **Cause**: Canvas not ready or timing issues
- **Solution**: Add longer wait times before context menu interactions
- **Prevention**: Ensure canvas is fully loaded before right-clicking

### Debugging Tips

1. **Run Tests with Monitoring**: Use `npm run test:baseline:monitor` for detailed output
2. **Check Service Logs**: Use `./run.sh logs` to view service status
3. **Manual Verification**: Test workflows manually to ensure they work
4. **Browser DevTools**: Use browser developer tools to inspect issues
5. **Test Videos**: Review test videos for failed tests to see what happened

## Best Practices

### Test Development
1. **Focus on Workflows**: Always test complete user workflows, not just components
2. **Validate Logs**: Always include browser log validation in tests
3. **Use Fixtures**: Leverage reusable test fixtures for common operations
4. **Clear Assertions**: Use descriptive assertions that explain what's being tested
5. **Proper Timeouts**: Use appropriate wait times for different operations

### Test Maintenance
1. **Update Selectors**: Keep CSS selectors updated when UI changes
2. **Review Logs**: Regularly review browser logs for new issues
3. **Performance Monitoring**: Track test execution times and optimize
4. **Error Patterns**: Update common error patterns as new issues are found
5. **Documentation**: Keep documentation updated with test changes

This workflow-based testing approach ensures that NeuroSense FX provides a reliable, professional trading experience by validating the complete user workflows that traders depend on.