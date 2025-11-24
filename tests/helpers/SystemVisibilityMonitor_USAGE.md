# SystemVisibilityMonitor Usage Guide

The SystemVisibilityMonitor is a comprehensive monitoring utility designed for NeuroSense FX testing that provides complete visibility into browser behavior, performance, and system health during real-world trading workflow testing.

## Design Philosophy

**Simple, Performant, Maintainable**

- **Simple**: Clean API structure following existing project patterns
- **Performant**: Zero-impact monitoring that doesn't affect test execution
- **Maintainable**: Modular design with clear separation of concerns

## Quick Start

```javascript
import { SystemVisibilityMonitor } from '../helpers/SystemVisibilityMonitor.js';

test('my trading workflow test', async ({ page }) => {
  // Initialize monitor
  const monitor = new SystemVisibilityMonitor(page);
  await monitor.startMonitoring();

  // Use monitor during test
  await monitor.trackPerformance('display-creation', async () => {
    await page.keyboard.press('Control+k');
    await page.fill('input[placeholder*="search" i]', 'BTCUSD');
    await page.keyboard.press('Enter');
  });

  // Validate performance constraints
  await monitor.validateLatency('display-creation', 1000);

  // Monitor console messages
  await monitor.expectConsoleMessage('Creating display for symbol: BTCUSD');
  await monitor.rejectConsoleMessage('Critical error');

  // Get system health status
  const health = await monitor.getSystemHealth();
  console.log('System health:', health.status);

  // Stop monitoring and get report
  const report = await monitor.stopMonitoring();
  console.log('Test performance summary:', report.summary);
});
```

## Core Features

### 1. Performance Monitoring

**Track operation timing and resource usage:**

```javascript
// Track any operation with automatic timing
const result = await monitor.trackPerformance('operation-name', async () => {
  // Your operation code here
  await page.click('#button');
  await page.waitForSelector('.result');
  return await page.textContent('.result');
});

// Validate against threshold
const isValid = await monitor.validateLatency('operation-name', 500); // 500ms threshold
console.log(`Performance ${isValid ? '✅' : '❌'}`);
```

**Built-in performance thresholds:**
- **Keyboard Response**: 310ms (project standard)
- **Data to Visual**: 100ms (sub-100ms requirement)
- **Display Creation**: 1000ms
- **UI Response**: 200ms

### 2. Console Message Monitoring

**Automatic validation of console output:**

```javascript
// Expect specific console messages
const hasLoadMessage = await monitor.expectConsoleMessage(/page loaded/i);
const hasSymbolCreated = await monitor.expectConsoleMessage('Creating display for symbol: ETH/USD');

// Reject error messages
const hasNoErrors = await monitor.rejectConsoleMessage(/uncaught error/i);
const hasNoWebSocketErrors = await monitor.rejectConsoleMessage('WebSocket connection failed');
```

**Automatic pattern matching:**
The monitor automatically validates console messages against predefined patterns:

- **Expected patterns**: Display creation, keyboard shortcuts, market data, canvas rendering
- **Rejected patterns**: WebSocket errors, critical rendering errors, memory allocation failures
- **Warning patterns**: Performance warnings, high memory usage, connection issues

### 3. Interaction Tracking

**Monitor user interactions automatically:**

```javascript
// All keyboard and mouse interactions are tracked automatically
await page.keyboard.press('Control+k');  // Tracked
await page.mouse.click(100, 100);       // Tracked
await page.keyboard.press('Escape');     // Tracked

// Get interaction data from system health
const health = await monitor.getSystemHealth();
console.log(`Total interactions: ${health.interactions?.total || 0}`);
```

### 4. System Health Monitoring

**Comprehensive system health tracking:**

```javascript
// Get real-time system health
const health = await monitor.getSystemHealth();

// Health includes:
console.log('Memory usage:', health.memory);
console.log('Frame rate:', health.performance);
console.log('WebSocket status:', health.webSocket);
console.log('Overall status:', health.status); // healthy, degraded, performance_issues, warnings

// System status values:
// - 'healthy': All systems operating within normal parameters
// - 'degraded': Some validation failures detected
// - 'performance_issues': Frame rate below minimum threshold
// - 'warnings': Multiple warning conditions detected
```

### 5. Memory Management

**Track memory usage and detect leaks:**

```javascript
// Memory is tracked automatically during monitoring
const health = await monitor.getSystemHealth();

if (health.memory.current) {
  console.log(`Current memory: ${(health.memory.current.used / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Memory trend: ${health.memory.trend}`); // stable, moderate_growth, high_growth
}

// Detect memory growth over time
const report = await monitor.stopMonitoring();
console.log('Memory growth:', report.summary.performance);
```

## Configuration Options

```javascript
const monitor = new SystemVisibilityMonitor(page, {
  // Enable/disable specific monitoring features
  enablePerformanceTracking: true,
  enableConsoleMonitoring: true,
  enableInteractionTracking: true,
  enableSystemHealthMonitoring: true,

  // Custom performance thresholds
  thresholds: {
    FRAME_RATE: {
      MINIMUM: 55,    // fps
      TARGET: 60      // fps
    },
    LATENCY: {
      KEYBOARD_RESPONSE: 500,    // ms
      DATA_TO_VISUAL: 150,       // ms
      DISPLAY_CREATION: 2000,    // ms
      UI_RESPONSE: 300          // ms
    },
    MEMORY: {
      MAX_GROWTH_MB: 100,        // Maximum acceptable growth
      LEAK_DETECTION_WINDOW: 60000 // ms
    }
  }
});
```

## Integration with Existing Tests

### Extending Existing E2E Tests

```javascript
import { test, expect } from '@playwright/test';
import { SystemVisibilityMonitor } from '../helpers/SystemVisibilityMonitor.js';

test.describe('Trading Workflow with Monitoring', () => {
  test('BTCUSD complete workflow', async ({ page }) => {
    const monitor = new SystemVisibilityMonitor(page);
    await monitor.startMonitoring();

    try {
      // Your existing test code
      await page.goto('/');

      // Track display creation performance
      await monitor.trackPerformance('btc-display-creation', async () => {
        await page.keyboard.press('Control+k');
        await page.fill('input[placeholder*="search" i]', 'BTCUSD');
        await page.keyboard.press('Enter');
        await page.waitForSelector('.enhanced-floating');
      });

      // Validate performance requirements
      const displayCreationValid = await monitor.validateLatency('btc-display-creation', 1000);
      expect(displayCreationValid).toBe(true);

      // Verify console messages
      await monitor.expectConsoleMessage('Creating display for symbol: BTCUSD');
      await monitor.rejectConsoleMessage('WebSocket connection error');

      // Continue with test...
      await page.keyboard.press('Escape');

      // Final validation
      const health = await monitor.getSystemHealth();
      expect(health.status).toMatch(/healthy|warnings/);

    } finally {
      const report = await monitor.stopMonitoring();
      console.log(`Test completed with ${report.summary.validation.passed} validations passed`);
    }
  });
});
```

### Multi-Instrument Monitoring

```javascript
test('Multi-instrument performance test', async ({ page }) => {
  const monitor = new SystemVisibilityMonitor(page);
  await monitor.startMonitoring();

  const symbols = ['BTCUSD', 'ETHUSD', 'EURUSD', 'GBPUSD', 'USDJPY'];

  for (const symbol of symbols) {
    await monitor.trackPerformance(`display-${symbol}`, async () => {
      await page.keyboard.press('Control+k');
      await page.fill('input[placeholder*="search" i]', symbol);
      await page.keyboard.press('Enter');
      await page.waitForSelector('.enhanced-floating');
    });

    // Validate each display creation
    const isValid = await monitor.validateLatency(`display-${symbol}`, 1500);
    expect(isValid).toBe(true);
  }

  // Check system handles multiple displays
  const health = await monitor.getSystemHealth();
  expect(health.frameRateStats?.average).toBeGreaterThan(50);

  await monitor.stopMonitoring();
});
```

## Reports and Analytics

### Getting Detailed Reports

```javascript
const report = monitor.getReport();

// Session information
console.log(`Session duration: ${report.session.duration}ms`);
console.log(`Monitoring active: ${report.session.isActive}`);

// Performance summary
console.log(`Total operations: ${report.summary.performance.totalOperations}`);
console.log(`Average latency: ${report.summary.performance.averageLatency.toFixed(2)}ms`);

// Interaction summary
console.log(`Keyboard interactions: ${report.summary.interactions.keyboard}`);
console.log(`Mouse interactions: ${report.summary.interactions.mouse}`);

// Validation summary
console.log(`Validations passed: ${report.summary.validation.passed}`);
console.log(`Validations failed: ${report.summary.validation.failed}`);
console.log(`Success rate: ${report.summary.validation.successRate.toFixed(1)}%`);
```

### Real-time Health Monitoring

```javascript
// Continuous health monitoring during extended tests
setInterval(async () => {
  const health = await monitor.getSystemHealth();

  if (health.status !== 'healthy') {
    console.warn(`System health degraded: ${health.status}`);

    // Check specific issues
    if (health.frameRateStats?.average < 50) {
      console.warn('Frame rate below threshold');
    }

    if (health.memory.trend === 'high_growth') {
      console.warn('High memory growth detected');
    }
  }
}, 30000); // Check every 30 seconds
```

## Best Practices

### 1. Test Structure

```javascript
test.beforeEach(async ({ page }) => {
  // Initialize monitor for each test
  monitor = new SystemVisibilityMonitor(page);
  await monitor.startMonitoring();
});

test.afterEach(async () => {
  // Always clean up
  if (monitor) {
    const report = await monitor.stopMonitoring();
    // Log results for test reporting
    console.log(`Test validation: ${report.summary.validation.successRate}% success rate`);
  }
});
```

### 2. Performance Validation

```javascript
// Validate critical user workflows
const workflows = [
  { name: 'symbol-search', threshold: 310 },
  { name: 'display-creation', threshold: 1000 },
  { name: 'canvas-rendering', threshold: 100 }
];

for (const workflow of workflows) {
  const isValid = await monitor.validateLatency(workflow.name, workflow.threshold);
  expect(isValid).toBe(true, `${workflow.name} exceeded ${workflow.threshold}ms threshold`);
}
```

### 3. Error Detection

```javascript
// Comprehensive error checking
const health = await monitor.getSystemHealth();

// No critical console errors
const hasCriticalErrors = await monitor.rejectConsoleMessage(/critical|fatal|uncaught/i);
expect(hasCriticalErrors).toBe(true);

// Performance within bounds
expect(health.frameRateStats?.average).toBeGreaterThan(55);

// Memory stable
expect(['stable', 'moderate_growth']).toContain(health.memory.trend);
```

### 4. Extended Session Testing

```javascript
// For tests running 2+ hours
test('extended session stability', async ({ page }) => {
  const monitor = new SystemVisibilityMonitor(page, {
    thresholds: {
      MEMORY: { MAX_GROWTH_MB: 200 } // Allow more growth for extended sessions
    }
  });

  await monitor.startMonitoring();

  // Run 2-hour trading simulation...

  // Check for memory leaks
  const health = await monitor.getSystemHealth();
  expect(health.memory.trend).not.toBe('high_growth');

  await monitor.stopMonitoring();
});
```

## Troubleshooting

### Common Issues

1. **Performance tracking not working**
   - Ensure `await monitor.startMonitoring()` is called before using trackPerformance
   - Check that operations are properly awaited

2. **Console message validation failing**
   - Console messages may have timing - use appropriate timeouts
   - Check that message patterns match exactly

3. **Memory tracking showing no data**
   - Memory tracking only works in Chromium-based browsers
   - Ensure browser is launched with `--enable-precise-memory-info`

4. **Frame rate monitoring showing 0**
   - Wait a few seconds after startMonitoring() for frame rate collection
   - Ensure page has visible content to animate

### Debug Information

```javascript
// Get detailed debug information
const report = monitor.getReport();

console.log('Raw performance metrics:', report.metrics.performance);
console.log('Raw console messages:', report.metrics.console);
console.log('Raw interaction data:', report.metrics.interactions);
console.log('System health raw data:', report.metrics.systemHealth);
```

## Integration with Test Reporting

The SystemVisibilityMonitor integrates seamlessly with Playwright's built-in reporting:

```javascript
// Add monitoring results to test metadata
test.afterEach(async ({}, testInfo) => {
  if (monitor) {
    const report = await monitor.stopMonitoring();

    // Attach to test results
    await testInfo.attach('monitoring-report', {
      body: JSON.stringify(report, null, 2),
      contentType: 'application/json'
    });

    // Add performance annotations
    testInfo.annotations.push({
      type: 'performance',
      description: `Average latency: ${report.summary.performance.averageLatency.toFixed(2)}ms`
    });

    testInfo.annotations.push({
      type: 'validation',
      description: `Success rate: ${report.summary.validation.successRate.toFixed(1)}%`
    });
  }
});
```

This comprehensive monitoring infrastructure provides the foundation for validating that NeuroSense FX meets its performance requirements for professional trading workflows, including 60fps rendering, sub-100ms latency, and stable operation during extended sessions.