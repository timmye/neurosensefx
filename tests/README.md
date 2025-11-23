# NeuroSense FX Testing with Simplified Infrastructure

This directory contains comprehensive tests for the NeuroSense FX financial trading visualization platform, using **simplified testing methods** aligned with the project's "Simple, Performant, Maintainable" philosophy.

## Test Structure

```
tests/
├── unit/                        # Vitest unit tests (pure functions)
│   ├── keyboardCore.test.js      # Keyboard utility functions
│   ├── keyboardConfig.test.js    # Keyboard configuration management
│   ├── dayRangeMeter.test.js     # Financial calculation tests
│   ├── priceFormatting.test.js   # Price formatting utilities
│   └── configDefaults.test.js    # Configuration validation
├── e2e/                          # Playwright E2E tests (real DOM)
│   ├── complete-trader-workflow.spec.js # Full trader workflows
│   ├── simple-trader-workflow.spec.js   # Core functionality tests
│   ├── basic-load.spec.js        # Basic application loading tests
│   ├── canvas-rendering.spec.js  # Canvas rendering performance tests
│   ├── user-interactions.spec.js # User interaction tests
│   ├── performance.spec.js       # Performance benchmarking tests
│   └── [other-e2e-tests].spec.js
├── helpers/                      # Test utilities and fixtures
│   ├── fixtures.js               # Test data and configurations
│   └── marketDataGenerator.js    # Enhanced market data generation
├── UNIT_TESTING.md              # Unit testing guidelines and patterns
└── README.md                    # This file
```

## Available Test Scripts (SIMPLIFIED & VALIDATED)

### **Primary Test Commands**
```bash
npm run test:unit               # Run Vitest unit tests
npm run test:e2e                # Run Playwright E2E tests
npm run test:all                # Run both test suites together
```

### **Development Testing**
```bash
npm run test:unit:watch         # Unit tests in watch mode
npm run test:unit:coverage      # Unit tests with coverage report
npm run test:e2e:debug          # E2E tests with debugging
npm run test:e2e:headed         # E2E tests with visible browser
```

### **Browser-Specific Testing**
```bash
npm run test:e2e:chrome         # Chrome/Chromium tests
npm run test:e2e:firefox        # Firefox tests
npm run test:e2e:mobile         # Mobile viewport tests
```

### **Performance & Reporting**
```bash
npm run test:performance        # Performance-focused tests
npm run test:e2e:report         # View HTML test report
```

## Simplified Testing Infrastructure

### **Removed Complexity (70% Reduction)**
- ❌ **Custom validation-runner.js** (426 lines) - Replaced with standard npm scripts
- ❌ **Custom browser-agents.js** (246 lines) - Replaced with Playwright config
- ❌ **Custom logger.js** (223 lines) - Replaced with built-in Playwright logging
- ❌ **Complex HTML reporting** - Replaced with built-in Playwright reporters

### **Simplified Standards (PROVEN RELIABLE)**
- ✅ **Standard npm scripts** - `test:unit`, `test:e2e`, `test:all`
- ✅ **Built-in Playwright reporters** - HTML, JSON, JUnit formats
- ✅ **Vitest for pure functions** - No canvas mocks, direct testing
- ✅ **Real DOM E2E testing** - Actual browser rendering, no fakes

## Test Categories

### **1. Complete Trader Workflows**

**Core Workflow: Ctrl+K → Symbol Search → Canvas → Close**
```javascript
test('should handle complete trader workflow: Ctrl+K → ETH/USD → Canvas → Close', async ({ page }) => {
  // Step 1: Open symbol palette
  await page.keyboard.press('Control+k');
  await expect(page.locator('input[placeholder*="search" i]')).toBeVisible();

  // Step 2: Search and select symbol
  await page.fill('input[placeholder*="search" i]', 'ETH/USD');
  await page.keyboard.press('Enter');

  // Step 3: Verify canvas creation and focus
  await expect(page.locator('.enhanced-floating')).toBeVisible();

  // Step 4: Close with Escape or click-away
  await page.keyboard.press('Escape');
});
```

### **2. Unit Testing (Vitest)**

**Pure Function Testing - No Canvas Mocks**
```javascript
import { describe, it, expect } from 'vitest';
import { normalizeKeyCombo, processKeyboardEvent } from '../../src/utils/keyboardCore.js';

describe('Keyboard Core Functions', () => {
  it('should normalize key combinations correctly', () => {
    const result = normalizeKeyCombo('Control+Shift+K');
    expect(result).toBe('Ctrl+Shift+K');
  });
});
```

### **3. Performance Testing**

**Performance Requirements:**
- **Keyboard shortcuts**: Under 310ms response time
- **Canvas updates**: Sub-100ms data-to-visual latency
- **Display creation**: Under 1000ms per new display
- **Memory stability**: No leaks during extended sessions

**Console Logging & Debugging:**
- Network request monitoring and timing analysis
- Error detection and reporting
- WebSocket connection tracking
- Performance metrics collection

## Testing Best Practices

### **1. Simplified Test Structure**
- **Use standard tools**: Vitest for units, Playwright for E2E
- **No canvas mocks**: Test real DOM rendering
- **Deterministic data**: Consistent test data across runs
- **Clear naming**: Descriptive test names that explain purpose

### **2. Performance Requirements**
- **Keyboard shortcuts**: Under 310ms response time
- **Canvas updates**: Sub-100ms data-to-visual latency
- **Test execution**: Under 60s for full suite
- **Memory stability**: No leaks during extended testing

### **3. UX Interaction Flows**
- **Complete workflows**: Open → Interact → Close patterns
- **Keyboard-first**: All functions accessible via keyboard
- **Error handling**: Graceful degradation on failures
- **Console monitoring**: Track all events for debugging

### **4. Financial Platform Specific**
- **Multi-display**: Test 5-20 concurrent displays
- **Real-time data**: WebSocket connection stability
- **Extended sessions**: 8+ hour operation simulation
- **Professional workflows**: Rapid response during active trading

---

## **Documentation & Support**

### **Complete Test Report**
- 📄 **[TESTING_VALIDATION_REPORT.md](../TESTING_VALIDATION_REPORT.md)** - Comprehensive validation results with detailed metrics and findings

### **Unit Testing Guidelines**
- 📄 **[UNIT_TESTING.md](./UNIT_TESTING.md)** - Detailed unit testing patterns and best practices for pure functions

### **Key Configuration Files**
- ⚙️ **[playwright.config.js](../playwright.config.js)** - Simplified Playwright configuration with financial app optimizations
- ⚙️ **[vitest.config.js](../vitest.config.js)** - Vitest configuration for unit testing
- 📦 **[package.json](../package.json)** - Simplified npm test scripts

### **Test Examples**
- 📄 **[complete-trader-workflow.spec.js](./e2e/complete-trader-workflow.spec.js)** - Complete trader workflow examples
- 📄 **[simple-trader-workflow.spec.js](./e2e/simple-trader-workflow.spec.js)** - Core functionality tests
- 📁 **[unit/](./unit/)** - Unit testing examples and patterns

---

**🎯 QUICK START:**
```bash
npm run test:unit          # Test core utilities
npm run test:e2e           # Test trader workflows
npm run test:all           # Run both suites together
```