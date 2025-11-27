# Atomic Trader Workflow Tests

This directory contains independent, atomic workflow tests that validate specific trader workflows on the production codebase. Each test is completely self-contained with setup/teardown and provides immediate LLM visibility.

## Test Philosophy

**Each test validates one specific workflow:**
- **Independent**: No test dependencies - can run in any order
- **Atomic**: Focused on a single trader workflow
- **Self-contained**: Complete setup/teardown included
- **Immediate visibility**: Console reporter provides real-time LLM feedback
- **Production codebase**: Tests run against the actual application

## Available Tests

### 1. `create-display.spec.js`
**Purpose**: Test Ctrl+K symbol search workflow

**Validates**:
- Clean workspace setup
- Ctrl+K opens symbol palette
- Search for BTCUSD functionality
- Press Enter to create display
- Verify display creation with live data
- Cleanup workspace

**Based on**: test-case-primary-workflow.md Step 1

**Run**:
```bash
npx playwright test tests/e2e/create-display.spec.js
# or
node run-atomic-tests.js "Create Display"
```

---

### 2. `navigate-displays.spec.js`
**Purpose**: Test Ctrl+Tab navigation

**Validates**:
- Create multiple test displays
- Test Ctrl+Tab navigation between displays
- Verify visual selection indicators
- Cleanup all displays

**Based on**: test-case-primary-workflow.md Step 2

**Run**:
```bash
npx playwright test tests/e2e/navigate-displays.spec.js
# or
node run-atomic-tests.js "Navigate Displays"
```

---

### 3. `verify-live-data.spec.js`
**Purpose**: Test data connection and updates

**Validates**:
- Create display
- Verify WebSocket connection
- Wait for live data (5 second requirement)
- Verify price updates occur
- Monitor data quality

**Based on**: test-case-primary-workflow.md Step 3

**Run**:
```bash
npx playwright test tests/e2e/verify-live-data.spec.js
# or
node run-atomic-tests.js "Verify Live Data"
```

---

### 4. `display-responsiveness.spec.js`
**Purpose**: Test drag-resize and movement

**Validates**:
- Create display
- Test drag-resize functionality
- Verify responsive canvas rendering
- Test display repositioning
- Cleanup

**Based on**: test-case-primary-workflow.md Step 4

**Run**:
```bash
npx playwright test tests/e2e/display-responsiveness.spec.js
# or
node run-atomic-tests.js "Display Responsiveness"
```

---

### 5. `cleanup-workspace.spec.js`
**Purpose**: Test Ctrl+Shift+W cleanup

**Validates**:
- Create test displays
- Test Ctrl+Shift+W removal
- Verify worker cleanup
- Confirm workspace state

**Based on**: test-case-primary-workflow.md Step 5

**Run**:
```bash
npx playwright test tests/e2e/cleanup-workspace.spec.js
# or
node run-atomic-tests.js "Cleanup Workspace"
```

## Console Reporter Features

Each test uses the `console-reporter.js` helper for immediate LLM visibility:

### Real-time Console Monitoring
- Captures all browser console output
- Categorizes logs (error, warning, info, debug)
- Immediate display with visibility markers
- WebSocket connection status tracking

### Performance Metrics
- Tracks operation durations
- Performance threshold validation
- Grade-based performance assessment
- Sub-100ms latency tracking

### Error Analysis
- Critical error detection
- Error pattern recognition
- Real-time error capture
- Error context preservation

## Running Tests

### Individual Tests
```bash
# Run specific test
npx playwright test tests/e2e/create-display.spec.js --headed

# Run with verbose output
DEBUG=* npx playwright test tests/e2e/create-display.spec.js --headed
```

### Using Test Runner
```bash
# List all available tests
node run-atomic-tests.js list

# Run specific test by name
node run-atomic-tests.js "Create Display"
node run-atomic-tests.js "Navigate Displays"

# Run all tests in sequence
node run-atomic-tests.js all
```

### Test Options
```bash
# Run in headed mode (recommended for LLM visibility)
npx playwright test tests/e2e/create-display.spec.js --headed

# Run with specific browser
npx playwright test tests/e2e/create-display.spec.js --project=chromium

# Run with debug mode
npx playwright test tests/e2e/create-display.spec.js --debug
```

## Test Environment Requirements

### Prerequisites
- WebSocket backend running (`./run.sh status` to confirm)
- Application accessible at `localhost:5174` (development mode)
- BTCUSD symbol available in symbol list
- Network connectivity to data source

### Development Environment
```bash
# Start application in development mode
./run.sh dev

# Run tests in separate terminal
node run-atomic-tests.js all
```

### Production Environment
```bash
# Start application in production mode
./run.sh start

# Run tests
node run-atomic-tests.js all
```

## Test Output and Results

### Console Visibility
Each test provides immediate LLM visibility with:
- ✅ Success indicators
- ❌ Error indicators
- ⚠️ Warning indicators
- 📊 Performance metrics
- 🔌 WebSocket status
- 📸 Screenshot capture

### Screenshots
Tests automatically capture screenshots:
- Success: `test-results/screenshots/[test-name]-workflow.png`
- Error: `test-results/screenshots/[test-name]-error.png`

### Console Reports
Detailed console analysis captured in:
- Real-time console output
- Final console summary
- Error analysis
- Performance assessment

## Validation Criteria

### Minimum Requirements
Each test validates minimum requirements:
- **Display Creation**: Canvas element creation and visibility
- **Navigation**: Focus switching and visual feedback
- **Live Data**: WebSocket connection and data patterns
- **Responsiveness**: Canvas rendering and interaction
- **Cleanup**: Complete workspace clearing

### Performance Standards
- **Display Creation**: Under 1000ms
- **Navigation**: Under 500ms per operation
- **Data Updates**: Within 5 seconds (requirement)
- **Resize Operations**: Responsive rendering
- **Cleanup**: Complete within 10 seconds

### Error Handling
- No critical console errors
- Graceful degradation for missing features
- Comprehensive error capture
- Detailed error context

## Troubleshooting

### Common Issues

**WebSocket Connection Failed**
```bash
# Check backend status
./run.sh status

# Restart backend if needed
./run.sh stop && ./run.sh dev
```

**Display Creation Fails**
- Ensure symbol is available (BTCUSD, EURUSD)
- Check console for specific error messages
- Verify application is fully loaded

**Navigation Not Working**
- Ensure multiple displays are created
- Check for focus indicators in UI
- Verify keyboard shortcuts are enabled

**Tests Not Finding Elements**
- Increase timeout values in test
- Check application structure changes
- Verify selectors match current UI

### Debug Mode
```bash
# Run with Playwright debugger
npx playwright test tests/e2e/create-display.spec.js --debug

# Run with browser dev tools
npx playwright test tests/e2e/create-display.spec.js --headed --debug
```

## Integration with CI/CD

### Automated Testing
```bash
# Headless mode for CI
npx playwright test tests/e2e/ --reporter=json

# Specific test execution
npx playwright test tests/e2e/create-display.spec.js --reporter=junit
```

### Environment Variables
```bash
# Set test environment
export PLAYWRIGHT_BROWSERS_PATH=0
export CI=true

# Configure backend endpoint
export WEBSOCKET_URL=ws://localhost:8080
```

## Contributing

When adding new atomic tests:

1. **Follow the pattern**: Use existing tests as templates
2. **Console reporter**: Always include `console-reporter.js`
3. **Self-contained**: Complete setup/teardown
4. **LLM visibility**: Immediate feedback and ✅/❌ indicators
5. **Documentation**: Update this README with new test details

### Test Template
```javascript
import { test, expect } from '@playwright/test';
import { consoleReporter } from '../helpers/console-reporter.js';

test.describe('New Workflow - Atomic Test', () => {
  let reporter;

  test.beforeEach(async ({ page }) => {
    reporter = new ConsoleReporter();
    await reporter.setupRealTimeMonitoring(page);
    // Setup code
  });

  test('New Workflow Test', async ({ page }) => {
    // Test implementation with LLM visibility
  });

  test.afterEach(async ({ page }) => {
    // Cleanup code
  });
});
```

## Technical Notes

### Browser Configuration
- Uses Playwright with Chromium by default
- DPR-aware rendering support
- Real WebSocket connections
- No mocks or simulations

### Performance Monitoring
- Sub-100ms latency validation
- 60fps rendering checks
- Memory leak detection
- WebSocket connection health

### Error Recovery
- Emergency cleanup on test failure
- Graceful error handling
- Detailed error context
- Continuation on non-critical failures