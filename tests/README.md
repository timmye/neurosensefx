# NeuroSense FX Testing System

Complete testing guide for the NeuroSense FX financial trading visualization platform using the streamlined 3-command testing architecture.

## Quick Start

```bash
npm run test:unit          # Test core utilities and business logic
npm run test:e2e           # Test user workflows in real browser
npm run test:all           # Run both test suites
npm run test:unified       # E2E with unified console visibility (LLM-optimized)
```

**Development Environment Standards:**
- Use `./run.sh dev` to start the development server (localhost:5174)
- Tests automatically start the dev server if not running
- Backend WebSocket server runs on localhost:8080
- All testing validates against the production codebase, not mocks

## Testing Architecture

### Core Philosophy: Simple, Performant, Maintainable

- **Simple**: 3 core commands instead of 13+ scattered scripts
- **Performant**: Real browser testing with native Playwright features
- **Maintainable**: Standard tools with zero custom logging infrastructure

### What We Removed (3,000+ lines eliminated)

- ❌ Custom validation runners and complex test orchestration
- ❌ Custom logging infrastructure (unified console server on localhost:9999)
- ❌ Complex browser agents with WebSocket communication
- ❌ Manual test harnesses and mock frameworks
- ❌ Redundant e2e test files (~800 lines removed)

### What We Keep (Proven & Reliable)

- ✅ **Vitest** for pure unit testing of business logic
- ✅ **Playwright** for real browser E2E testing with native capabilities
- ✅ **Native Playwright reporters** (HTML, JSON, JUnit)
- ✅ **Standard npm scripts** for all operations
- ✅ **Single comprehensive test**: primary-trader-workflow.spec.js
- ✅ **Unified Console Reporter** for LLM developer visibility
- ✅ **Browser log capture** with correlation IDs and timeline analysis

## Testing Commands

### Primary Commands

```bash
# Unit testing - Pure functions and business logic
npm run test:unit

# E2E testing - Real browser user workflows
npm run test:e2e

# Unified console testing - LLM-optimized visibility
npm run test:unified

# Complete test suite - Run both unit and E2E
npm run test:all
# Note: Currently focuses on E2E tests since unit test infrastructure is ready but no unit tests exist
```

### Utility Commands

```bash
# Install Playwright browsers (run once after npm install)
npm run test:install

# View HTML test report in browser
npm run test:report

# Clean up test results and artifacts
npm run test:cleanup
```

## Test Categories

### 1. Unit Tests (`test:unit`)

**Purpose**: Test pure functions, business logic, and data processing utilities
**Runner**: Vitest
**Location**: `src/**/*.test.js` (excluding E2E specs)
**Speed**: Fast (1-2 seconds)

**What Unit Tests Cover:**
- Keyboard shortcut processing and normalization
- Financial calculations (price formatting, ranges, percentages)
- Configuration management and validation
- Data transformation utilities
- State management logic (pure functions only)

**Running Unit Tests:**

```bash
# Run all unit tests once
npm run test:unit
# Note: "No test files found" is expected in current streamlined system

# Run in watch mode for development (when unit tests exist)
npm run test:unit -- --watch

# Run with coverage report (when unit tests exist)
npm run test:unit -- --coverage
```

**Example Unit Test Structure:**

```javascript
import { describe, it, expect } from 'vitest';
import { calculateDayRangePercentage, formatPrice } from '../src/utils/priceCalculations.js';

describe('Price Calculations', () => {
  it('should calculate day range percentage correctly', () => {
    const result = calculateDayRangePercentage(1.1050, 1.0800, 1.1200);
    expect(result).toBe(62.5); // 62.5% of daily range
  });

  it('should format price with correct precision', () => {
    const result = formatPrice(1.10504, 5);
    expect(result).toBe('1.10500');
  });
});
```

### 2. E2E Tests (`test:e2e`)

**Purpose**: Test complete user workflows in real browser environment
**Runner**: Playwright
**Location**: `tests/**/*.spec.js`
**Speed**: Medium (30-60 seconds)

### 3. Unified Console Testing (`test:unified`)

**Purpose**: LLM-optimized testing with comprehensive visibility
**Runner**: Playwright with Unified Console Reporter
**Location**: `tests/**/*.spec.js`
**Speed**: Medium (30-60 seconds) + enhanced logging

**Unified Console Features:**
- **Build logs**: Real-time Vite dev server output with timestamps
- **Browser console**: JavaScript errors and warnings forwarded to unified console
- **Test execution**: Playwright test results with correlation IDs
- **System events**: Navigation, interactions, and performance metrics
- **Timeline analysis**: Unified timestamps for complete test flow visibility

**Running Unified Console Tests:**

```bash
# Run with unified console visibility
npm run test:unified

# View unified log file after tests
npm run test:logs

# View final summary
npm run test:summary
```

**Unified Console Output Example:**
```
[2025-11-27T10:30:15.123Z][+0ms] [SYSTEM] 🚀 Unified Console Reporter Starting [UNIFIED-1]
[2025-11-27T10:30:15.145Z][+22ms] [TEST] Test Suite: Trader Workflows (5 tests) [UNIFIED-1]
[2025-11-27T10:30:16.234Z][+1109ms] [BUILD] Vite server running on localhost:5174
[2025-11-27T10:30:18.456Z][+3331ms] [TEST] ▶️  Starting: Display creation workflow [UNIFIED-2]
[2025-11-27T10:30:19.123Z][+3998ms] [BROWSER] INFO: Keyboard shortcut Ctrl+K triggered [UNIFIED-2]
[2025-11-27T10:30:20.789Z][+5664ms] [TEST] ✅ PASSED: Display creation workflow (2333ms) [UNIFIED-2]
```

**What E2E Tests Cover:**
- Complete trader workflows (Ctrl+K → symbol → display → close)
- Keyboard accessibility and rapid navigation
- Canvas rendering and visual accuracy
- Real WebSocket data integration
- Multi-display workspace management
- Performance under trading conditions

**Running E2E Tests:**

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npm run test:e2e -- tests/primary-trader-workflow.spec.js

# Run with visible browser for debugging
npm run test:e2e -- --headed

# Run with Playwright Inspector for step-by-step debugging
npm run test:e2e -- --debug
```

**Example E2E Test Structure:**

```javascript
import { test, expect } from '@playwright/test';

test.describe('Trader Workflows', () => {
  test('complete display creation workflow: Ctrl+K → ETH/USD → Canvas → Close', async ({ page }) => {
    // Navigate to application
    await page.goto('/');

    // Step 1: Open symbol palette
    await page.keyboard.press('Control+k');
    await expect(page.locator('input[placeholder*="search" i]')).toBeVisible();

    // Step 2: Search for symbol
    await page.fill('input[placeholder*="search" i]', 'ETH/USD');
    await page.keyboard.press('Enter');

    // Step 3: Verify display creation
    await expect(page.locator('.enhanced-floating')).toBeVisible();

    // Step 4: Verify canvas rendering
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // Step 5: Close display
    await page.keyboard.press('Escape');
    await expect(page.locator('.enhanced-floating')).not.toBeVisible();
  });
});
```

## Test Results & Reporting

### Native Playwright Reporters

Playwright provides built-in reporters that replace custom logging infrastructure:

```bash
# HTML Report (default)
npm run test:report
# Opens: test-results/report/index.html
```

**Available Report Formats:**
- **HTML**: Interactive report in browser (primary for developers)
- **JSON**: Machine-readable results in `test-results/results.json`
- **JUnit**: CI integration format in `test-results/junit.xml`
- **Line**: Real-time console output during test execution

### Understanding Test Results

**Successful Test Output:**
```
✓ Primary trader workflow: Ctrl+K → BTCUSD → Canvas → Close (15.2s)
✓ Multi-display workspace management (8.7s)
✓ Keyboard navigation and accessibility (6.1s)
✓ Canvas rendering accuracy (12.4s)
✓ WebSocket data integration (10.8s)

5 passed (53.2s)
```

**Failure Information:**
- Screenshots automatically captured on failure
- Video recordings available for failed tests
- Full browser traces for debugging
- Console logs with correlation IDs

### Performance Metrics

**Key Performance Thresholds:**
- **Display creation**: < 1000ms
- **Keyboard response**: < 310ms
- **Canvas rendering**: 60fps (16.7ms per frame)
- **WebSocket latency**: < 100ms
- **Memory stability**: No leaks during sessions

## Developer Workflow Guide

### Typical Testing Session

1. **Start Development Server**
   ```bash
   ./run.sh dev  # Starts on localhost:5174 + WebSocket on 8080
   ```

2. **Run Unit Tests During Development**
   ```bash
   npm run test:unit -- --watch  # Auto-run on file changes
   ```

3. **Run E2E Tests Before Commit**
   ```bash
   npm run test:e2e  # Full browser workflow validation
   ```

4. **Run with LLM Visibility (Enhanced Debugging)**
   ```bash
   npm run test:unified  # Comprehensive console visibility
   ```

5. **Run Complete Suite for Pull Request**
   ```bash
   npm run test:all  # Comprehensive validation
   ```

### Debugging Failed Tests

**For Unit Test Failures:**
1. Check Vitest output for specific assertion failures
2. Review test isolation and pure function assumptions
3. Verify test data and expected values

**For E2E Test Failures:**
1. View HTML report: `npm run test:report`
2. Examine screenshots and videos in `test-results/`
3. Check console logs for JavaScript errors
4. Use `--debug` flag for step-by-step execution

```bash
# Debug failing E2E test
npm run test:e2e -- tests/primary-trader-workflow.spec.js --debug
```

### Creating New Tests

**Unit Test Guidelines:**
- Test pure functions only (no DOM, no network)
- Use descriptive test names explaining the scenario
- Test edge cases and error conditions
- Keep tests fast and isolated

```javascript
// Good unit test example
test('should handle zero division in percentage calculation', () => {
  const result = calculatePercentage(100, 0);
  expect(result).toBe(0); // Graceful handling
});
```

**E2E Test Guidelines:**
- Test complete user workflows, not individual components
- Use keyboard-first interaction patterns
- Verify visual outcomes, not just DOM state
- Include performance assertions where relevant

```javascript
// Good E2E test example
test('rapid display creation and removal workflow', async ({ page }) => {
  const startTime = Date.now();

  // Create display quickly
  await page.keyboard.press('Control+k');
  await page.fill('input[placeholder*="search" i]', 'EUR/USD');
  await page.keyboard.press('Enter');

  // Verify display appears within performance threshold
  await expect(page.locator('.enhanced-floating')).toBeVisible({ timeout: 1000 });
  const creationTime = Date.now() - startTime;
  expect(creationTime).toBeLessThan(1000); // Performance requirement

  // Remove display
  await page.keyboard.press('Control+Shift+W');
  await expect(page.locator('.enhanced-floating')).not.toBeVisible();
});
```

## Configuration Files

### Playwright Configuration (`playwright.config.cjs`)

Key settings optimized for financial trading platform:
- **30s timeout** for complex workflows
- **Sequential execution** for clear console output
- **Trading monitor resolution** (1920x1080)
- **Automatic dev server startup** for testing
- **Built-in reporters** for comprehensive visibility

### Vitest Configuration

Uses Vite configuration in `vite.config.js`:
- **Environment isolation** for unit testing
- **Coverage reporting** available
- **Watch mode** for development
- **Source map support** for debugging

## Best Practices

### Unit Testing Best Practices

1. **Test Pure Functions Only**
   - No DOM manipulation
   - No network requests
   - No file system access
   - Deterministic results

2. **Use Descriptive Names**
   ```javascript
   // Good
   test('should calculate ADR percentage when price is at high of day')

   // Bad
   test('test price calculation')
   ```

3. **Test Edge Cases**
   ```javascript
   test('should handle invalid input gracefully', () => {
     expect(() => calculatePercentage(null, 100)).not.toThrow();
   });
   ```

### E2E Testing Best Practices

1. **Test Complete Workflows**
   - User journeys from start to finish
   - Keyboard-first interaction patterns
   - Error handling and recovery

2. **Use Realistic Data**
   - Actual currency pairs (EUR/USD, BTC/USD)
   - Realistic price movements
   - Standard timeframes for operations

3. **Include Performance Assertions**
   ```javascript
   const responseTime = await measureResponseTime(() => {
     await page.keyboard.press('Control+k');
   });
   expect(responseTime).toBeLessThan(310); // Keyboard performance requirement
   ```

## Troubleshooting

### Common Issues

**Port Already in Use (5174)**
```bash
# Kill existing process
lsof -ti:5174 | xargs kill -9
npm run test:e2e  # Restart tests
```

**Browser Not Installed**
```bash
npm run test:install  # Install Playwright browsers
```

**Tests Time Out**
- Check if dev server is running on localhost:5174
- Verify WebSocket connection to backend
- Increase timeout in playwright.config.cjs if needed (current: 30s)

**Flaky Tests**
- Sequential execution is already configured (workers: 1)
- Add proper waitFor calls for async operations
- Ensure test isolation between runs

**Zero-Gap Visibility Issues**
- Use native Playwright reporters: HTML, JSON, JUnit
- Check test-results/report/index.html for detailed analysis
- No custom console server needed (localhost:9999 removed)

### Getting Help

1. **Native Playwright Reports**: `npm run test:report` for interactive HTML analysis
2. **Unified Console Logs**: `npm run test:logs` for detailed timeline analysis
3. **Test Summary**: `npm run test:summary` for final results overview
4. **Debug Mode**: Use `--debug` flag for step-by-step test execution
5. **Reference Test**: See `tests/primary-trader-workflow.spec.js` for current patterns

### Unified Console Troubleshooting

**No unified log file found:**
```bash
# Run tests first to generate logs
npm run test:unified
npm run test:logs  # View generated logs
```

**Browser console logs not appearing:**
- Check that tests are using the unified console reporter
- Verify browser console events are being captured in test attachments
- Use `--headed` mode to see browser console directly

**Correlation IDs confusing:**
- Each test gets a unique UNIFIED-X correlation ID
- System events use separate correlation IDs
- Timeline analysis shows elapsed time from test start

**Build logs overwhelming:**
- Build logs are captured but can be filtered by timestamp
- Use correlation IDs to trace specific test execution
- Focus on TEST and BROWSER logs for application issues

## Migration from Old System

The streamlined testing system replaces the following legacy components:

| Removed Component | Replacement |
|------------------|-------------|
| Custom validation runners | `npm run test:e2e` |
| Complex browser agents (770 lines) | Simplified browser-agents.js (245 lines) |
| Custom logging infrastructure | Unified Console Reporter (`test:unified`) |
| Unified console server (localhost:9999) | Built-in unified console with correlation IDs |
| Manual test orchestration | Standard npm scripts |
| 7 redundant e2e test files | Single primary-trader-workflow.spec.js |
| Complex HTML reporting systems | Native Playwright HTML + unified console logs |

**Implementation Summary:**
- **Phase 1**: Removed 7 redundant e2e test files (~800 lines)
- **Phase 2**: Removed custom console capture from vite.config.js and src/main.js (~1,500 lines)
- **Phase 3**: Simplified browser-agents.js from 770 to 245 lines (68% reduction)
- **Phase 4**: Updated primary-trader-workflow.spec.js to use native Playwright
- **Result**: Clean, maintainable testing system focused on Primary Trader Workflow

All existing test files remain compatible and follow the same patterns. Only the execution infrastructure has been simplified.