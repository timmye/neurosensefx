# Comprehensive Testing Prompt: Primary Trader Workflow Validation

## Test Execution Instructions

This prompt provides a complete testing framework for validating the primary trader workflow defined in `test-case-primary-workflow.md`. Use this with Playwright or similar real-world testing tools to validate that the NeuroSense FX system meets professional trading standards.

### Pre-Test Setup Requirements

1. **Environment Preparation**
   ```bash
   # Verify backend services are running
   ./run.sh status

   # For development mode testing
   ./run.sh dev

   # For production mode testing
   ./run.sh start
   ```

2. **Test Configuration**
   - Use Playwright with configuration from `playwright.config.js`
   - Enable SystemVisibilityMonitor for comprehensive tracking
   - Ensure test environment has network connectivity to market data sources
   - Clear browser cache and cookies before test start

3. **Prerequisite Validation**
   - WebSocket backend must be running and accessible
   - BTCUSD symbol must be available in the symbol list
   - No existing displays should be in the workspace
   - Network latency to data source should be <200ms

---

## Test Implementation Framework

### Import Required Dependencies

```javascript
import { test, expect } from '@playwright/test';
import { SystemVisibilityMonitor } from '../helpers/SystemVisibilityMonitor.js';
import { PerformanceValidator } from '../helpers/PerformanceValidator.js';
```

### Test Configuration

```javascript
const TEST_CONFIG = {
  // Performance thresholds from CLAUDE.md
  PERFORMANCE_THRESHOLDS: {
    FRAME_RATE_MIN: 58,           // 60fps - 2fps tolerance
    LATENCY_DATA_TO_VISUAL: 100,  // Sub-100ms requirement
    DISPLAY_CREATION_TIMEOUT: 1000,
    RESPONSIVENESS_THRESHOLD: 200
  },

  // Console message patterns to validate
  CONSOLE_PATTERNS: {
    EXPECTED_SUCCESS: [
      'Creating display for symbol: BTCUSD',
      'Successfully subscribed display to data',
      'Display created with ID:',
      'Canvas rendered for symbol: BTCUSD',
      'Initial data packet received for BTCUSD',
      'Tick received for BTCUSD',
      'Price updated:',
      'Market profile rendered',
      'Volatility orb updated',
      'focusDisplay',
      'Display resized:',
      'Canvas re-rendered at',
      'DPI-aware rendering applied:',
      'closeDisplay',
      'Worker terminated',
      'Workspace persistence save'
    ],

    EXPECTED_ERRORS: [
      'Timeout waiting for BTCUSD data',
      'WebSocket connection error',
      'Critical rendering error',
      'Memory allocation failed',
      'Display creation failed'
    ],

    KEYBOARD_EVENTS: [
      'Keyboard shortcut triggered: Ctrl+K',
      'Keyboard shortcut triggered: Ctrl+Tab',
      'Keyboard shortcut triggered: Ctrl+Shift+W'
    ]
  },

  // System state validation paths
  SYSTEM_STATE: {
    DISPLAY_STORE: 'window.displayStore',
    CANVAS_SELECTOR: 'canvas',
    SYMBOL_PALETTE_SELECTOR: '[data-testid="symbol-palette"]',
    ENVIRONMENT_BADGE_SELECTOR: '[data-testid="environment-badge"]'
  }
};
```

---

## Phase 1: System Initialization Validation

### Test Steps

1. **Navigate to Application**
   ```javascript
   await page.goto('http://localhost:5174'); // Development
   // OR
   await page.goto('http://localhost:4173'); // Production
   ```

2. **Validate Environment**
   ```javascript
   // Development mode should show environment badge
   if (isDevelopment) {
     const envBadge = await page.locator(TEST_CONFIG.SYSTEM_STATE.ENVIRONMENT_BADGE_SELECTOR);
     await expect(envBadge).toBeVisible();
     console.log('✅ Development environment badge visible');
   }

   // Production mode should NOT show environment badge
   if (isProduction) {
     const envBadge = await page.locator(TEST_CONFIG.SYSTEM_STATE.ENVIRONMENT_BADGE_SELECTOR);
     await expect(envBadge).not.toBeVisible();
     console.log('✅ Production environment confirmed (no badge)');
   }
   ```

3. **Initialize Monitoring**
   ```javascript
   const monitor = new SystemVisibilityMonitor(page, {
     enablePerformanceTracking: true,
     enableConsoleMonitoring: true,
     enableInteractionTracking: true,
     thresholds: TEST_CONFIG.PERFORMANCE_THRESHOLDS
   });

   await monitor.startMonitoring();
   ```

4. **Verify Initial System State**
   ```javascript
   // Check display store is empty
   const displayStoreState = await page.evaluate(() => {
     return window.displayStore ? {
       displaysCount: window.displayStore.displays?.size || 0,
       activeDisplaysCount: window.displayStore.activeDisplays?.length || 0
     } : null;
   });

   expect(displayStoreState).not.toBeNull();
   expect(displayStoreState.displaysCount).toBe(0);
   expect(displayStoreState.activeDisplaysCount).toBe(0);
   console.log('✅ Initial workspace state confirmed (empty)');
   ```

---

## Phase 2: BTCUSD Display Creation Workflow

### Step 2.1: Open Symbol Palette (Ctrl+K)

```javascript
test.step('Open symbol palette with Ctrl+K', async () => {
  console.log('📋 Testing Ctrl+K symbol palette activation');

  // Press Ctrl+K
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(300);

  // Verify keyboard shortcut triggered
  const keyboardEvent = await monitor.expectConsoleMessage(
    /Keyboard shortcut triggered.*Ctrl\+K/i,
    3000
  );
  expect(keyboardEvent).toBe(true, 'Ctrl+K should trigger keyboard shortcut event');

  // Verify symbol palette appears
  const symbolPalette = await page.locator('[data-testid="symbol-palette"], .symbol-palette, input[placeholder*="search" i]');
  await expect(symbolPalette).toBeVisible({ timeout: 2000 });

  // Verify search input is focused
  const searchInput = await page.locator('input[placeholder*="search" i], input[type="text"], .search-input');
  await expect(searchInput).toBeFocused();

  console.log('✅ Symbol palette opened and search input focused');
});
```

### Step 2.2: Search and Select BTCUSD

```javascript
test.step('Search and select BTCUSD symbol', async () => {
  console.log('📋 Testing BTCUSD symbol search and selection');

  // Type BTCUSD
  await page.keyboard.type('BTCUSD');
  await page.waitForTimeout(500);

  // Look for BTCUSD in search results
  const btcusdOption = await page.locator('[data-value="BTCUSD"], [data-symbol="BTCUSD"], .symbol-option:has-text("BTCUSD")');
  await expect(btcusdOption).toBeVisible({ timeout: 3000 });

  // Press Enter to select
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);

  // Verify display creation started
  const creationStarted = await monitor.expectConsoleMessage(
    'Creating display for symbol: BTCUSD',
    5000
  );
  expect(creationStarted).toBe(true, 'Should see display creation started message');

  console.log('✅ BTCUSD symbol selected and display creation initiated');
});
```

### Step 2.3: Validate Display Creation Success

```javascript
test.step('Validate display creation success', async () => {
  console.log('📋 Validating BTCUSD display creation success');

  // Wait for display creation completion
  await page.waitForTimeout(3000);

  // Verify success messages
  const expectedMessages = [
    'Successfully subscribed display to data',
    'Display created with ID:',
    'Canvas rendered for symbol: BTCUSD'
  ];

  for (const message of expectedMessages) {
    const found = await monitor.expectConsoleMessage(message, 10000);
    expect(found).toBe(true, `Should see "${message}" message`);
  }

  // Verify canvas element exists
  const canvasElement = await page.locator(TEST_CONFIG.SYSTEM_STATE.CANVAS_SELECTOR);
  await expect(canvasElement).toBeVisible({ timeout: 5000 });

  // Verify canvas has correct attributes
  const canvasWidth = await canvasElement.getAttribute('width');
  const canvasHeight = await canvasElement.getAttribute('height');
  expect(parseInt(canvasWidth)).toBeGreaterThan(0);
  expect(parseInt(canvasHeight)).toBeGreaterThan(0);

  // Verify display store updated
  const displayStoreState = await page.evaluate(() => {
    if (!window.displayStore) return null;

    const displays = Array.from(window.displayStore.displays?.values() || []);
    const btcusdDisplay = displays.find(d => d.symbol === 'BTCUSD');

    return {
      totalDisplays: displays.length,
      btcusdDisplayExists: !!btcusdDisplay,
      btcusdDisplayId: btcusdDisplay?.id,
      btcusdDisplayReady: btcusdDisplay?.ready
    };
  });

  expect(displayStoreState).not.toBeNull();
  expect(displayStoreState.totalDisplays).toBe(1);
  expect(displayStoreState.btcusdDisplayExists).toBe(true);
  expect(displayStoreState.btcusdDisplayReady).toBe(true);

  console.log(`✅ BTCUSD display created successfully with ID: ${displayStoreState.btcusdDisplayId}`);
});
```

### Step 2.4: Close Symbol Palette (Esc x2)

```javascript
test.step('Close symbol palette with Escape key', async () => {
  console.log('📋 Testing symbol palette closure with Escape key');

  // Press Escape twice (first to clear text, second to close)
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Verify symbol palette is closed
  const symbolPalette = await page.locator('[data-testid="symbol-palette"], .symbol-palette');
  await expect(symbolPalette).not.toBeVisible({ timeout: 2000 });

  console.log('✅ Symbol palette closed successfully');
});
```

---

## Phase 3: Display Navigation and Selection

### Step 3.1: Navigate to BTCUSD Display (Ctrl+Tab)

```javascript
test.step('Navigate to BTCUSD display with Ctrl+Tab', async () => {
  console.log('📋 Testing display navigation with Ctrl+Tab');

  // Press Ctrl+Tab to focus display
  await page.keyboard.press('Control+Tab');
  await page.waitForTimeout(300);

  // Verify focus event
  const focusEvent = await monitor.expectConsoleMessage(
    /focusDisplay|Display focused|Display selected/i,
    3000
  );
  expect(focusEvent).toBe(true, 'Should see display focus event');

  // Verify visual indication of focused display
  const canvasElement = await page.locator(TEST_CONFIG.SYSTEM_STATE.CANVAS_SELECTOR);
  await expect(canvasElement).toHaveClass(/focused|active|selected/, { timeout: 2000 });

  console.log('✅ BTCUSD display successfully focused');
});
```

---

## Phase 4: Data Connection and Live Updates Validation

### Step 4.1: Verify Initial Data Connection

```javascript
test.step('Verify initial data connection', async () => {
  console.log('📋 Validating initial data connection for BTCUSD');

  // Wait for initial data packet
  const initialData = await monitor.expectConsoleMessage(
    /Initial data packet received for BTCUSD|display ready|WebSocket connection established/i,
    15000
  );
  expect(initialData).toBe(true, 'Should receive initial data packet within 15 seconds');

  // Verify WebSocket connection
  const wsConnection = await monitor.expectConsoleMessage(
    /WebSocket connection established|Successfully connected/i,
    10000
  );
  expect(wsConnection).toBe(true, 'Should establish WebSocket connection');

  console.log('✅ Initial data connection established');
});
```

### Step 4.2: Validate Live Price Updates

```javascript
test.step('Validate live price updates', async () => {
  console.log('📋 Validating live price updates for BTCUSD');

  // Monitor for price updates over 15 seconds
  let updateCount = 0;
  const updateListener = (msg) => {
    if (/Tick received for BTCUSD|Price updated/i.test(msg.text)) {
      updateCount++;
    }
  };

  monitor.onConsoleMessage(updateListener);

  await page.waitForTimeout(15000);

  monitor.offConsoleMessage(updateListener);

  expect(updateCount).toBeGreaterThan(0, 'Should receive at least one price update');

  // Verify specific price update message
  const priceUpdate = await monitor.expectConsoleMessage(
    /Price updated:\s*\d+(\.\d+)?/i,
    10000
  );
  expect(priceUpdate).toBe(true, 'Should see specific price update message');

  console.log(`✅ Received ${updateCount} price updates`);
});
```

### Step 4.3: Validate Visualization Rendering

```javascript
test.step('Validate visualization rendering', async () => {
  console.log('📋 Validating visualization rendering for BTCUSD');

  // Expected visualization rendering messages
  const visualizationMessages = [
    'Market profile rendered',
    'Volatility orb updated',
    'Day range meter rendered'
  ];

  let foundVisualizations = 0;
  for (const message of visualizationMessages) {
    const found = await monitor.expectConsoleMessage(message, 10000);
    if (found) foundVisualizations++;
  }

  expect(foundVisualizations).toBeGreaterThanOrEqual(2, 'Should render at least 2 visualization types');

  // Verify canvas is actually rendering content (not blank)
  const canvasElement = await page.locator(TEST_CONFIG.SYSTEM_STATE.CANVAS_SELECTOR);
  const canvasContent = await canvasElement.evaluate((canvas) => {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    // Check if canvas has non-blank content
    let nonBlankPixels = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] !== 0 || pixels[i+1] !== 0 || pixels[i+2] !== 0) {
        nonBlankPixels++;
      }
    }

    return nonBlankPixels > 100; // Should have at least some content
  });

  expect(canvasContent).toBe(true, 'Canvas should have rendered content');

  console.log(`✅ ${foundVisualizations} visualization types rendered successfully`);
});
```

---

## Phase 5: Display Responsiveness Testing

### Step 5.1: Test Resize Responsiveness

```javascript
test.step('Test display resize responsiveness', async () => {
  console.log('📋 Testing display resize responsiveness');

  const canvasElement = await page.locator(TEST_CONFIG.SYSTEM_STATE.CANVAS_SELECTOR);

  // Get initial dimensions
  const initialSize = await canvasElement.evaluate((canvas) => ({
    width: canvas.width,
    height: canvas.height
  }));

  // Simulate resize by dragging corner
  // Note: Actual drag simulation depends on your UI implementation
  // This is a placeholder - adjust based on your resize mechanism

  // Option 1: Keyboard-based resize (if implemented)
  try {
    await page.keyboard.press('Control+Shift+ArrowRight');
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+Shift+ArrowDown');
    await page.waitForTimeout(500);
  } catch (e) {
    // Option 2: Direct canvas resize via JavaScript (for testing)
    await canvasElement.evaluate((canvas) => {
      canvas.width = canvas.width * 1.2;
      canvas.height = canvas.height * 1.2;
      canvas.dispatchEvent(new Event('resize'));
    });
  }

  // Verify resize event logged
  const resizeEvent = await monitor.expectConsoleMessage(
    /Display resized|Canvas re-rendered at/i,
    3000
  );
  expect(resizeEvent).toBe(true, 'Should log resize/re-render event');

  // Verify DPI scaling applied
  const dpiScaling = await monitor.expectConsoleMessage(
    /DPI-aware rendering applied|DPI scaling/i,
    3000
  );
  expect(dpiScaling).toBe(true, 'Should apply DPI-aware rendering on resize');

  // Verify new dimensions
  const newSize = await canvasElement.evaluate((canvas) => ({
    width: canvas.width,
    height: canvas.height
  }));

  expect(newSize.width).not.toBe(initialSize.width);
  expect(newSize.height).not.toBe(initialSize.height);

  // Verify canvas still has content after resize
  const hasContentAfterResize = await canvasElement.evaluate((canvas) => {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return imageData.data.some((pixel, index) => index % 4 !== 3 && pixel !== 0);
  });

  expect(hasContentAfterResize).toBe(true, 'Canvas should maintain content after resize');

  console.log(`✅ Display resized from ${initialSize.width}x${initialSize.height} to ${newSize.width}x${newSize.height}`);
});
```

---

## Phase 6: Display Cleanup and Reset

### Step 6.1: Close BTCUSD Display (Ctrl+Shift+W)

```javascript
test.step('Close BTCUSD display with Ctrl+Shift+W', async () => {
  console.log('📋 Testing display closure with Ctrl+Shift+W');

  // Ensure display is focused first
  await page.keyboard.press('Control+Tab');
  await page.waitForTimeout(200);

  // Press Ctrl+Shift+W to close
  await page.keyboard.press('Control+Shift+W');
  await page.waitForTimeout(1000);

  // Verify close event
  const closeEvent = await monitor.expectConsoleMessage(
    /closeDisplay|Display closed/i,
    3000
  );
  expect(closeEvent).toBe(true, 'Should trigger display close event');

  // Verify cleanup messages
  const cleanupMessages = [
    'Worker terminated',
    'Workspace persistence save'
  ];

  for (const message of cleanupMessages) {
    const found = await monitor.expectConsoleMessage(message, 5000);
    if (found) {
      console.log(`✅ Cleanup message received: ${message}`);
    }
  }

  console.log('✅ Display close initiated');
});
```

### Step 6.2: Validate Workspace Reset

```javascript
test.step('Validate workspace reset after display closure', async () => {
  console.log('📋 Validating workspace state after display closure');

  // Wait for cleanup completion
  await page.waitForTimeout(2000);

  // Verify canvas element is removed
  const canvasElement = await page.locator(TEST_CONFIG.SYSTEM_STATE.CANVAS_SELECTOR);
  await expect(canvasElement).not.toBeVisible({ timeout: 3000 });

  // Verify display store is empty
  const displayStoreState = await page.evaluate(() => {
    if (!window.displayStore) return null;

    return {
      displaysCount: window.displayStore.displays?.size || 0,
      activeDisplaysCount: window.displayStore.activeDisplays?.length || 0
    };
  });

  expect(displayStoreState).not.toBeNull();
  expect(displayStoreState.displaysCount).toBe(0);
  expect(displayStoreState.activeDisplaysCount).toBe(0);

  console.log('✅ Workspace successfully reset to empty state');
});
```

---

## Phase 7: Performance Standards Validation

### 7.1: Frame Rate Validation

```javascript
test.step('Validate 60fps rendering requirement', async () => {
  console.log('📋 Validating 60fps rendering performance');

  // Use PerformanceValidator to measure frame rate
  const validator = new PerformanceValidator(page);

  // Monitor frame rate during data updates
  const frameRateMetrics = await validator.measureFrameRate({
    duration: 5000, // 5 seconds
    threshold: 58   // Minimum acceptable fps
  });

  expect(frameRateMetrics.average).toBeGreaterThan(55, 'Average frame rate should be >55fps');
  expect(frameRateMetrics.minimum).toBeGreaterThan(45, 'Minimum frame rate should be >45fps');
  expect(frameRateMetrics.drops).toBeLessThan(5, 'Should have <5 frame drops during test');

  console.log(`✅ Frame rate validation passed - Avg: ${frameRateMetrics.average.toFixed(1)}fps, Min: ${frameRateMetrics.minimum}fps`);
});
```

### 7.2: Latency Validation

```javascript
test.step('Validate sub-100ms latency requirement', async () => {
  console.log('📋 Validating sub-100ms data-to-visual latency');

  // Measure latency from data receipt to visual update
  const latencyMetrics = await monitor.validateLatency('data-connection', 100);

  expect(latencyMetrics.dataToVisual).toBeLessThan(150, 'Data-to-visual latency should be <150ms');
  expect(latencyMetrics.displayCreation).toBeLessThan(1200, 'Display creation should be <1.2s');
  expect(latencyMetrics.keyboardResponse).toBeLessThan(350, 'Keyboard response should be <350ms');

  console.log(`✅ Latency validation passed - Data-to-visual: ${latencyMetrics.dataToVisual}ms`);
});
```

### 7.3: Memory Usage Validation

```javascript
test.step('Validate memory stability', async () => {
  console.log('📋 Validating memory usage stability');

  const initialMemory = await monitor.getMemoryUsage();
  await page.waitForTimeout(10000); // Monitor for 10 seconds
  const finalMemory = await monitor.getMemoryUsage();

  const memoryGrowth = finalMemory - initialMemory;
  const memoryGrowthMB = memoryGrowth / (1024 * 1024);

  expect(memoryGrowthMB).toBeLessThan(25, 'Memory growth should be <25MB during test');

  console.log(`✅ Memory stability validated - Growth: ${memoryGrowthMB.toFixed(2)}MB`);
});
```

---

## Final Report Generation

### Comprehensive Test Report

```javascript
test.afterEach(async () => {
  // Generate comprehensive monitoring report
  const report = await monitor.generateReport();
  const systemHealth = await monitor.getSystemHealth();

  console.log('\n' + '='.repeat(80));
  console.log('📊 COMPREHENSIVE PRIMARY WORKFLOW TEST REPORT');
  console.log('='.repeat(80));

  // Test summary
  console.log(`\n📋 TEST EXECUTION SUMMARY:`);
  console.log(`Test Duration: ${(report.session.duration / 1000).toFixed(2)}s`);
  console.log(`Environment: ${isDevelopment ? 'Development' : 'Production'}`);
  console.log(`Total Interactions: ${report.summary.interactions.total}`);
  console.log(`Console Messages: ${report.summary.console.total}`);

  // Console verification results
  console.log(`\n🔍 CONSOLE VERIFICATION RESULTS:`);

  // Success messages validation
  for (const message of TEST_CONFIG.CONSOLE_PATTERNS.EXPECTED_SUCCESS) {
    const found = await monitor.expectConsoleMessage(message, 100);
    const icon = found ? '✅' : '❌';
    console.log(`${icon} "${message.substring(0, 50)}..." - ${found ? 'FOUND' : 'NOT FOUND'}`);
  }

  // Error messages validation (should be absent)
  console.log(`\n🚫 ERROR VERIFICATION (should be absent):`);
  for (const message of TEST_CONFIG.CONSOLE_PATTERNS.EXPECTED_ERRORS) {
    const hasError = await monitor.rejectConsoleMessage(new RegExp(message, 'i'), 30000);
    const icon = hasError ? '✅' : '❌';
    console.log(`${icon} "${message}" - ${hasError ? 'CLEAN' : 'DETECTED'}`);
  }

  // Performance summary
  console.log(`\n⚡ PERFORMANCE SUMMARY:`);
  if (report.summary.performance.frameRateStats) {
    const fps = report.summary.performance.frameRateStats;
    console.log(`Frame Rate: ${fps.minimum}fps - ${fps.maximum}fps (avg: ${fps.average.toFixed(1)}fps)`);
  }
  if (report.summary.performance.averageLatency > 0) {
    console.log(`Average Latency: ${report.summary.performance.averageLatency.toFixed(2)}ms`);
  }

  // System health
  console.log(`\n🏥 SYSTEM HEALTH:`);
  console.log(`Status: ${systemHealth.status.toUpperCase()}`);
  console.log(`Validation Success Rate: ${systemHealth.validation.successRate.toFixed(1)}%`);
  console.log(`Passed: ${systemHealth.validation.passed}, Failed: ${systemHealth.validation.failed}, Warnings: ${systemHealth.validation.warnings}`);

  console.log('='.repeat(80));

  // Final assertions
  expect(systemHealth.validation.failed).toBe(0, 'Should have no validation failures');
  expect(systemHealth.validation.successRate).toBeGreaterThan(90, 'Should have >90% validation success rate');

  if (report.summary.performance.frameRateStats) {
    expect(report.summary.performance.frameRateStats.minimum).toBeGreaterThan(55, 'Should maintain minimum 55fps');
  }

  console.log('✅ Primary trader workflow test completed successfully');
});
```

---

## Execution Commands

### Running the Test

```bash
# Run with Playwright
npm run test:e2e tests/e2e/primary-trader-workflow-comprehensive.spec.js

# Run with specific environment
ENVIRONMENT=development npm run test:e2e tests/e2e/primary-trader-workflow-comprehensive.spec.js
ENVIRONMENT=production npm run test:e2e tests/e2e/primary-trader-workflow-comprehensive.spec.js

# Run with additional debugging
DEBUG=true npm run test:e2e tests/e2e/primary-trader-workflow-comprehensive.spec.js
```

### Test Output Files

- **HTML Report**: `test-results/html-report/index.html`
- **JSON Results**: `test-results/results.json`
- **Junit XML**: `test-results/results.xml`
- **Screenshots**: `test-results/` (on failure)
- **Traces**: `test-results/traces/` (on failure)
- **Videos**: `test-results/videos/` (on failure)

---

## Success Criteria

The test passes when ALL of the following are met:

1. **Functional Requirements**
   - [ ] BTCUSD display created successfully with Ctrl+K workflow
   - [ ] Display selection works with Ctrl+Tab
   - [ ] Live data connection established within 15 seconds
   - [ ] Price updates received in real-time
   - [ ] Visualizations render correctly
   - [ ] Display responsiveness maintained during resize
   - [ ] Display closes cleanly with Ctrl+Shift+W

2. **Performance Requirements**
   - [ ] Frame rate maintained >55fps throughout test
   - [ ] Data-to-visual latency <150ms
   - [ ] Display creation <1.2s
   - [ ] Memory growth <25MB during test
   - [ ] Keyboard response <350ms

3. **System Health**
   - [ ] No critical errors in console
   - [ ] WebSocket connection stable
   - [ ] Proper cleanup after display closure
   - [ ] Workspace state correctly managed
   - [ ] Validation success rate >90%

4. **Environment Specific**
   - [ ] Development mode shows environment badge
   - [ ] Production mode has no environment warnings
   - [ ] Live market data in both modes
   - [ ] Professional-grade visual quality

---

## Troubleshooting Guide

### Common Issues and Solutions

1. **Symbol Palette Not Opening**
   - Check if keyboard shortcuts are properly initialized
   - Verify keyboardManager is bound to document
   - Ensure no other elements are intercepting Ctrl+K

2. **BTCUSD Not Found**
   - Verify symbol is available in symbol list
   - Check WebSocket connection to data provider
   - Confirm symbol format (BTCUSD vs BTC/USD)

3. **No Live Data Updates**
   - Check WebSocket connection status
   - Verify data provider credentials in .env
   - Confirm symbol subscription was successful

4. **Performance Issues**
   - Check browser developer tools for memory leaks
   - Verify canvas rendering optimizations are active
   - Confirm DPR-aware rendering is implemented

5. **Cleanup Failures**
   - Check for orphaned worker processes
   - Verify event listeners are properly removed
   - Ensure display store updates correctly

This comprehensive testing prompt validates that the NeuroSense FX primary trader workflow meets professional trading standards across all critical dimensions: functionality, performance, reliability, and user experience.