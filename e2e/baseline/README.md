# Baseline Test Suite

## Overview

This directory contains the baseline test suite for the NeuroSense FX application. The suite consists of exactly 5 tests that cover the core canvas-centric workflows.

## Files

- `workflow-tests.spec.ts` - The 5 core workflow tests
- `fixtures.ts` - Simple fixtures with basic error monitoring
- `config.ts` - Minimal configuration for fast execution
- `README.md` - This file

## Test Coverage

1. **Basic Menu Functionality Test** - Verifies menu opens and has correct items
2. **Symbol Selection Test** - Verifies symbol selection workflow
3. **Menu Control Test** - Verifies control sections are present
4. **Error Handling Test** - Verifies errors are handled gracefully
5. **Application Loading Test** - Verifies application loads without errors

## Running Tests

```bash
# Run baseline tests
npm run test:baseline

# Run with monitoring
npm run test:baseline:monitor

# Direct Playwright execution
npx playwright test e2e/baseline --config=e2e/baseline/config.ts
```

## Test Configuration

- **Browser**: Chromium only with container-aware launch options
- **Timeout**: 15 seconds per test (reduced from 60s)
- **Action Timeout**: 3 seconds per action (reduced from 15s)
- **Workers**: 1 (sequential execution)
- **Reporter**: Line (simple output)
- **Service Management**: Integrated with run.sh for automatic server startup

## Expected Results

- All 5 tests should pass
- Execution time should be under 15 seconds (achieving ~10 seconds)
- No console errors should be present
- Clear output showing test results
- Tests validate fundamental app functionality (page load, layout, console errors)
- Automatic service management using run.sh script

## Troubleshooting

If tests fail:
1. Check for console errors in output
2. Verify application is loading properly
3. Ensure backend services are running
4. Check for import errors or missing dependencies

## Maintenance

- Keep test count at exactly 5
- Maintain under 15 seconds execution time (currently ~10 seconds)
- Update tests only when core app structure changes
- Preserve simple, clear output for LLM consumption
- Focus on fundamental validation rather than complex workflows
- Service startup is handled automatically by the test configuration