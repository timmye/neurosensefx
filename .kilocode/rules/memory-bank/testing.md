# NeuroSense FX - Testing Strategy

## Overview

NeuroSense FX uses a workflow-based testing approach that follows the **Workflows → Interactions → Technology** framework to validate primary trader workflows with comprehensive browser log monitoring.

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

### Browser Log Monitoring

The enhanced browser log monitor (`utils/browserLogMonitor.js`) captures:
- **Console Messages**: All levels with timestamps and locations
- **Page Errors**: JavaScript errors with stack traces
- **Network Activity**: Requests and responses with timing
- **Performance Metrics**: Load times, render times, memory usage
- **Error Patterns**: Common issues (TypeError, NetworkError, etc.)

### Test Fixtures

Workflow fixtures (`fixtures/workflowFixtures.js`) provide:
- Enhanced page setup with integrated log monitoring
- Floating panel interaction utilities
- Symbol selection and canvas creation helpers
- Context menu interaction utilities
- Browser log validation utilities

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

## Test Workflows

### 1. Workspace to Live Prices Workflow
**Test**: `workflows/workspace-to-live-prices.spec.js`

**Validates**:
- Empty workspace initially
- All floating panels visible by default
- Symbol selection works correctly
- Canvas creation successful
- Canvas shows correct symbol
- No critical browser errors

### 2. Multi-Symbol Workspace Workflow
**Test**: `workflows/multi-symbol-workspace.spec.js`

**Validates**:
- Multiple canvases created successfully
- Proper positioning and layout
- Canvas activation and interaction
- Z-index management works
- Canvas closing functions
- State persistence maintained
- No critical browser errors

### 3. Market Analysis Workflow
**Test**: `workflows/market-analysis-workflow.spec.js`

**Validates**:
- Context menu opens correctly
- Tab navigation works across all 6 tabs
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

## Testing Best Practices

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

## Continuous Testing

### Development Workflow
1. Run baseline tests after each code change
2. Use enhanced monitoring for detailed analysis
3. Review browser logs for any issues
4. Update tests as UI changes
5. Maintain test documentation

### Quality Assurance
- Baseline tests must pass before code integration
- Browser logs must be free of critical errors
- Performance metrics must remain within acceptable thresholds
- Test execution time should remain under 30 seconds

This workflow-based testing approach ensures that NeuroSense FX provides a reliable, professional trading experience by validating the complete user workflows that traders depend on.