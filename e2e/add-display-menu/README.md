# AddDisplayMenu Test Suite

This directory contains the comprehensive test suite for the AddDisplayMenu component using Playwright MCP.

## Overview

The test suite is designed to verify that the AddDisplayMenu component works correctly and solves the symbol selection issue. It includes tests for basic functionality, symbol selection, integration with FloatingCanvas, visual regression, and error handling.

## Test Structure

```
e2e/add-display-menu/
├── README.md                           # This file
├── add-display-menu.config.js          # Playwright configuration
├── global-setup.js                     # Global test setup
├── global-teardown.js                  # Global test teardown
├── fixtures.ts                         # Test fixtures and helpers
├── basic-functionality.spec.ts         # Basic functionality tests
├── symbol-selection.spec.ts            # Symbol selection tests
├── integration.spec.ts                 # Integration tests with FloatingCanvas
├── visual-regression.spec.ts           # Visual regression tests
└── error-handling.spec.ts              # Error handling tests
```

## Running Tests

### Prerequisites

1. Install dependencies:
   ```bash
   npm install
   ```

2. Install Playwright browsers:
   ```bash
   npx playwright install
   ```

### Test Commands

- Run all AddDisplayMenu tests:
  ```bash
  npm run test:add-display-menu
  ```

- Run tests with UI:
  ```bash
  npm run test:add-display-menu:ui
  ```

- Run tests in debug mode:
  ```bash
  npm run test:add-display-menu:debug
  ```

- Generate tests with codegen:
  ```bash
  npm run test:add-display-menu:codegen
  ```

### Running Specific Tests

- Run basic functionality tests:
  ```bash
  npx playwright test e2e/add-display-menu/basic-functionality.spec.ts --config=e2e/add-display-menu/add-display-menu.config.js
  ```

- Run symbol selection tests:
  ```bash
  npx playwright test e2e/add-display-menu/symbol-selection.spec.ts --config=e2e/add-display-menu/add-display-menu.config.js
  ```

- Run integration tests:
  ```bash
  npx playwright test e2e/add-display-menu/integration.spec.ts --config=e2e/add-display-menu/add-display-menu.config.js
  ```

- Run visual regression tests:
  ```bash
  npx playwright test e2e/add-display-menu/visual-regression.spec.ts --config=e2e/add-display-menu/add-display-menu.config.js
  ```

- Run error handling tests:
  ```bash
  npx playwright test e2e/add-display-menu/error-handling.spec.ts --config=e2e/add-display-menu/add-display-menu.config.js
  ```

### Browser-Specific Tests

- Run tests on Chrome:
  ```bash
  npx playwright test e2e/add-display-menu/ --config=e2e/add-display-menu/add-display-menu.config.js --project=chromium
  ```

- Run tests on Firefox:
  ```bash
  npx playwright test e2e/add-display-menu/ --config=e2e/add-display-menu/add-display-menu.config.js --project=firefox
  ```

- Run tests on Safari:
  ```bash
  npx playwright test e2e/add-display-menu/ --config=e2e/add-display-menu/add-display-menu.config.js --project=webkit
  ```

## Test Fixtures

The test suite provides several custom fixtures to simplify test writing:

### Basic Fixtures

- `canvasPage`: Loads the page and waits for the canvas to be ready
- `mockSymbolData`: Mocks the symbol API endpoints with sample data

### Specialized Mocks

- `mockEmptySymbolList`: Mocks an empty symbol list
- `mockNetworkError`: Mocks network errors for symbol API
- `mockInvalidSymbolError`: Mocks invalid symbol errors

### Helper Functions

- `rightClickCanvas`: Right-clicks on the canvas at a specific position
- `selectMenuItem`: Selects a menu item by its data-test attribute
- `selectSymbol`: Selects a symbol from the symbol selector
- `waitForVisualization`: Waits for a visualization to appear

### Example Usage

```typescript
import { test, expect } from './fixtures';

test('should add a price display', async ({ canvasPage, mockSymbolData, rightClickCanvas, selectMenuItem, selectSymbol, waitForVisualization }) => {
  // Right-click on canvas
  await rightClickCanvas(200, 150);
  
  // Select price display option
  await selectMenuItem('add-price-display');
  
  // Select a symbol
  await selectSymbol('EURUSD');
  
  // Wait for visualization to appear
  const visualization = await waitForVisualization('price-display');
  
  // Verify the visualization contains the symbol
  await expect(visualization).toContainText('EURUSD');
});
```

## Test Categories

### 1. Basic Functionality Tests

Tests the core functionality of the AddDisplayMenu component:

- Context menu appears on right-click
- Menu contains correct options
- Menu closes when clicking outside
- Menu positioning is correct

### 2. Symbol Selection Tests

Tests the symbol selection functionality:

- Symbol selector opens correctly
- Symbol search and filtering works
- Symbol selection persists
- Selected symbol creates visualization

### 3. Integration Tests

Tests the integration with FloatingCanvas:

- Menu positioning at click location
- Visualization placement on canvas
- Multiple visualization handling
- Workspace state management

### 4. Visual Regression Tests

Tests the visual appearance of the component:

- Menu appearance matches screenshots
- Symbol selector appearance matches screenshots
- Visualization appearance matches screenshots

### 5. Error Handling Tests

Tests error scenarios:

- Empty symbol list handling
- Network error handling
- Invalid symbol handling
- User feedback validation

## Test Configuration

The test suite uses a custom Playwright configuration (`add-display-menu.config.js`) that includes:

- Multiple browser support (Chrome, Firefox, Safari)
- Mobile device testing
- Automatic dev server startup
- Test reporting (HTML, JSON, JUnit)
- Screenshot and video capture on failure
- Trace capturing on retry

## Mock Data

The test suite uses mock data for consistent testing:

### Symbols

```json
[
  { "symbol": "EURUSD", "name": "EUR/USD", "type": "forex", "pip": 0.0001 },
  { "symbol": "GBPUSD", "name": "GBP/USD", "type": "forex", "pip": 0.0001 },
  { "symbol": "USDJPY", "name": "USD/JPY", "type": "forex", "pip": 0.01 },
  { "symbol": "AUDUSD", "name": "AUD/USD", "type": "forex", "pip": 0.0001 },
  { "symbol": "USDCAD", "name": "USD/CAD", "type": "forex", "pip": 0.0001 }
]
```

### Symbol Data

```json
{
  "EURUSD": {
    "symbol": "EURUSD",
    "bid": 1.05678,
    "ask": 1.05688,
    "timestamp": 1234567890
  },
  ...
}
```

## Troubleshooting

### Common Issues

1. **Tests fail with "Canvas not found"**
   - Ensure the application is running on localhost:5173
   - Check that the canvas element has the correct ID

2. **Tests fail with timeout waiting for menu**
   - Increase timeout in the test configuration
   - Check if the menu CSS selectors are correct

3. **Visual regression tests fail**
   - Review if the changes are intentional
   - Update screenshots with `npx playwright test --update-snapshots`

4. **Mock data not working**
   - Check if the API routes are correctly mocked
   - Verify the request URLs match the mocked routes

### Debug Tips

- Use the UI mode to step through tests: `npm run test:add-display-menu:ui`
- Use debug mode to pause execution: `npm run test:add-display-menu:debug`
- Use trace viewer to analyze test execution: `npx playwright show-trace trace.zip`
- Check the HTML report for detailed test results: open `playwright-report/index.html`

## Contributing

When adding new tests:

1. Follow the existing test structure
2. Use the provided fixtures and helpers
3. Add descriptive test names
4. Include assertions for both positive and negative cases
5. Update this README if adding new test categories

## CI/CD Integration

The test suite can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run AddDisplayMenu tests
  run: npm run test:add-display-menu

- name: Upload test results
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: playwright-report
    path: playwright-report/