# NeuroSense FX Logging and Debugging Guide

## Zero-Tolerance Error Monitoring System

The Zero-Tolerance Error Monitoring System eliminates "false confidence" in testing by ensuring **any JavaScript error immediately causes test failure**. No exceptions, no silent logging, immediate test termination.

### Core Components

#### ZeroToleranceErrorMonitor Class
Located: `/tests/helpers/zero-tolerance-error-monitor.js`

**Primary purpose**: Complete error capture with immediate test failure on any critical JavaScript error.

```javascript
import { ZeroToleranceErrorMonitor } from './tests/helpers/zero-tolerance-error-monitor.js';

// Setup comprehensive error monitoring
const monitor = new ZeroToleranceErrorMonitor();
await monitor.setup(page);

// Validate no errors occurred during test
await monitor.validateNoErrors(page);
```

#### Error Capture Layers

1. **Uncaught JavaScript Errors** - Immediate test failure
   ```javascript
   page.on('error', (error) => {
     // IMMEDIATE TEST FAILURE - no tolerance for JavaScript errors
     throw new Error(`Application JavaScript error: ${error.message}`);
   });
   ```

2. **Console Error Monitoring** - Immediate test failure
   ```javascript
   page.on('console', (msg) => {
     if (msg.type() === 'error') {
       throw new Error(`Console error detected: ${msg.text()}`);
     }
   });
   ```

3. **Unhandled Promise Rejections** - Immediate test failure
   ```javascript
   page.on('pageerror', (error) => {
     throw new Error(`Unhandled promise rejection: ${error.message}`);
   });
   ```

4. **Runtime Error Injection** - Captures errors not triggering page events
   ```javascript
   // Injected into browser context
   window.addEventListener('error', (event) => {
     window.jsErrors.push(errorInfo);
   });
   ```

#### Critical Error Patterns

Predefined patterns that cause immediate test failure:

```javascript
export const CRITICAL_ERROR_PATTERNS = [
  /Uncaught TypeError/i,
  /ReferenceError/i,
  /SyntaxError/i,
  /WebSocket connection error/i,
  /Critical rendering error/i,
  /Cannot read property/i,
  /Failed to load module/i,
  /UnhandledPromiseRejectionWarning/i,
  /displayContextEnhancer is not defined/i,
  /currentStore\.displays is not iterable/i,
  /workspacePersistenceManager\.load is not a function/i,
  /Cannot convert undefined or null to object/i
];
```

### Best Practices

1. **Always setup error monitoring before any test actions**
2. **Never bypass error monitoring for "known issues"**
3. **Use specific error patterns for targeted validation**
4. **Reset error monitor between test phases**

```javascript
// Correct test setup
test.beforeEach(async ({ page }) => {
  errorMonitor = new ZeroToleranceErrorMonitor();
  await errorMonitor.setup(page);

  // Clear existing errors
  errorMonitor.reset();
});

// Phase-based validation
test('Phase 1: Display Creation', async ({ page }) => {
  // Test actions
  await createDisplay(page);

  // Validate no errors in this phase
  await errorMonitor.validateNoErrors(page);
});
```

## End-to-End Logging Capture

### Browser Console Logging Infrastructure

#### BrowserAgentManager Class
Located: `/tests/helpers/browser-agents.js`

Comprehensive console monitoring with message capture and filtering:

```javascript
import { browserAgentManager } from './tests/helpers/browser-agents.js';

// Setup console monitoring for message capture
await browserAgentManager.setupConsoleMonitoring(page);

// Get all console logs
const logs = await browserAgentManager.getConsoleLogs(page);

// Get logs by type
const errors = await browserAgentManager.getConsoleLogsByType(page, 'error');
const debug = await browserAgentManager.getConsoleLogsByType(page, 'debug');

// Wait for specific message
await browserAgentManager.waitForConsoleMessage(page, 'Display created', 10000);
```

#### Console Override System

The system overrides console methods to capture all output with metadata:

```javascript
// Injected into browser context
function captureConsoleMessage(type, args) {
  const message = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ');

  const logEntry = {
    type,
    message,
    timestamp: new Date().toISOString(),
    args: Array.from(args)
  };

  window.testConsoleLogs.push(logEntry);

  // Store by type for easy filtering
  window.testConsoleLogsByType[type].push(logEntry);
}
```

### Real Browser Evidence Collection

#### Evidence Types

1. **Screenshots** - Automatic on test failure
   ```javascript
   // playwright.config.js
   use: {
     screenshot: 'only-on-failure',
   }
   ```

2. **Videos** - Complete test execution recording
   ```javascript
   use: {
     video: 'retain-on-failure',
   }
   ```

3. **Traces** - Complete browser execution trace
   ```javascript
   use: {
     trace: 'retain-on-failure',
   }
   ```

4. **Console Logs** - Complete console output capture
   ```javascript
   const consoleLogs = await browserAgentManager.getConsoleLogs(page);
   ```

5. **Performance Metrics** - Real browser performance data
   ```javascript
   const performanceData = await page.evaluate(() => ({
     memory: performance.memory,
     timing: performance.timing,
     navigation: performance.navigation
   }));
   ```

### WebSocket Activity Monitoring

#### Connection State Monitoring

```javascript
// Monitor WebSocket events
page.on('websocket', ws => {
  ws.on('framesent', event => console.log('WebSocket sent:', event.payload));
  ws.on('framereceived', event => console.log('WebSocket received:', event.payload));
  ws.on('close', () => console.log('WebSocket closed'));
});
```

#### Message Flow Validation

```javascript
// Validate subscription patterns
const subscriptionLogs = consoleLogs.filter(log =>
  log.message.includes('WebSocket subscription confirmation') ||
  log.message.includes('Successfully subscribed display to data')
);

// Validate data flow
const dataFlowLogs = consoleLogs.filter(log =>
  log.message.includes('Tick received for') ||
  log.message.includes('Price updated:') ||
  log.message.includes('Market data processed')
);
```

### Performance Metrics Logging

#### Real-Time Performance Tracking

```javascript
// Performance markers for latency measurement
window.performance.mark('data-received');
// ... processing ...
window.performance.mark('visual-update');
window.performance.measure('data-to-visual', 'data-received', 'visual-update');
```

#### Memory Usage Monitoring

```javascript
// Memory snapshots
const memorySnapshot = {
  used: performance.memory.usedJSHeapSize,
  total: performance.memory.totalJSHeapSize,
  limit: performance.memory.jsHeapSizeLimit,
  timestamp: Date.now()
};
```

## Visualization Debugging Methodology

### Canvas Rendering Debugging Workflow

#### DPR-Aware Rendering Validation

```javascript
// Validate DPR scaling accuracy
const dpr = window.devicePixelRatio || 1;
const backingStoreRatio = context.backingStorePixelRatio || 1;
const actualScale = dpr / backingStoreRatio;
const scaleAccuracy = Math.min(actualScale, dpr) / Math.max(actualScale, dpr);

expect(scaleAccuracy).toBeGreaterThanOrEqual(0.95); // 95% minimum accuracy
```

#### Text Clarity Validation

```javascript
// Validate text rendering properties
const textMetrics = {
  font: context.font,
  textBaseline: context.textBaseline,
  textAlign: context.textAlign,
  fontSize: parseFloat(context.font)
};

// Check for monospace font usage
expect(textMetrics.font).toContain('JetBrains Mono');
expect(textMetrics.fontSize).toBeGreaterThan(8);
```

#### Canvas Sharpness Testing

```javascript
// Edge detection for sharpness validation
function detectEdges(imageData) {
  const edges = [];
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  // Sobel edge detection
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;

      // Calculate gradient magnitude
      const gradient = calculateGradient(imageData, x, y);
      if (gradient > 30) {
        edges.push({ x, y, gradient });
      }
    }
  }

  return edges;
}
```

### Mathematical Precision Validation

#### Coordinate Transformation Debugging

```javascript
// Test coordinate transformation accuracy
function validateCoordinateTransformation(cssPos, expectedCanvasPos, dpr) {
  const canvasPos = cssToCanvas(cssPos, dpr);
  const error = Math.sqrt(
    Math.pow(canvasPos.x - expectedCanvasPos.x, 2) +
    Math.pow(canvasPos.y - expectedCanvasPos.y, 2)
  );

  return error < 0.5; // Sub-pixel accuracy
}
```

#### Price Display Precision

```javascript
// Validate price precision tolerance
function validatePricePrecision(displayedPrice, actualPrice, tolerance = 0.001) {
  return Math.abs(displayedPrice - actualPrice) <= tolerance;
}
```

### Multi-Layer Rendering Validation

#### Z-Index Ordering Validation

```javascript
// Validate layer ordering
function validateLayerOrder(elementSelectors, expectedOrder) {
  const elements = elementSelectors.map(selector => document.querySelector(selector));
  const computedOrder = elements.map(el => parseInt(getComputedStyle(el).zIndex));

  return JSON.stringify(computedOrder) === JSON.stringify(expectedOrder);
}
```

## Professional Trading Standards Validation

### 60fps Rendering Validation

#### Frame Rate Measurement

```javascript
async function measureFrameRate(duration = 5000) {
  return new Promise(resolve => {
    const frameSamples = [];
    let startTime = performance.now();
    let frameCount = 0;

    function measureFrame() {
      const currentTime = performance.now();
      frameCount++;

      if (currentTime - startTime >= duration) {
        const fps = Math.round((frameCount / duration) * 1000);
        resolve(fps);
      } else {
        requestAnimationFrame(measureFrame);
      }
    }

    requestAnimationFrame(measureFrame);
  });
}
```

#### PerformanceValidator Class

Located: `/tests/helpers/PerformanceValidator.js`

```javascript
import { PerformanceValidator } from './tests/helpers/PerformanceValidator.js';

const validator = new PerformanceValidator(page, {
  fpsTarget: 60,
  latencyThreshold: 100,
  enableQualityValidation: true
});

await validator.startValidation();
const fpsResult = await validator.validateFrameRate('rapid-price-update');
expect(fpsResult.passed).toBe(true);
```

### Sub-100ms Latency Measurement

#### Data-to-Visual Latency Testing

```javascript
async function measureDataToVisualLatency(page) {
  // Start precision timing
  await page.evaluate(() => {
    window.performanceValidator.latencyStart = performance.now();
  });

  // Trigger data update
  await triggerMarketDataUpdate(page);

  // Wait for visual update completion
  const visualUpdateTime = await page.evaluate(() => {
    return new Promise(resolve => {
      requestAnimationFrame(() => {
        const visualEnd = performance.now();
        resolve(visualEnd - window.performanceValidator.latencyStart);
      });
    });
  });

  return visualUpdateTime;
}
```

### Multi-Display Stress Testing

#### Concurrent Display Testing

```javascript
test('Multi-display performance validation', async ({ page }) => {
  const displayCount = 20;

  // Create multiple displays
  for (let i = 0; i < displayCount; i++) {
    await createDisplay(page, `BTCUSD_${i}`);
  }

  // Measure performance with all displays active
  const fpsResult = await validator.validateFrameRate('multi-display-stress');
  const memoryResult = await validator.validateMemoryStability('multi-display', 60000);

  expect(fpsResult.frameRate.average).toBeGreaterThanOrEqual(55);
  expect(memoryResult.leakDetected).toBe(false);
});
```

### Real-Time Data Flow Validation

#### WebSocket Message Latency

```javascript
function measureWebSocketLatency() {
  const startTime = performance.now();

  return new Promise(resolve => {
    const messageHandler = (event) => {
      const latency = performance.now() - startTime;
      websocket.off('message', messageHandler);
      resolve(latency);
    };

    websocket.on('message', messageHandler);

    // Send test message
    websocket.send(JSON.stringify({ type: 'ping', timestamp: startTime }));
  });
}
```

#### Market Data Processing Validation

```javascript
// Validate market data processing pipeline
const dataProcessingLogs = consoleLogs.filter(log =>
  log.message.includes('Market data processed') ||
  log.message.includes('Price calculation completed') ||
  log.message.includes('Visual update triggered')
);

expect(dataProcessingLogs.length).toBeGreaterThan(0);
```

## Test Infrastructure Usage

### Comprehensive Test Suite Execution

#### Primary Trader Workflow Test

Located: `/tests/e2e/primary-trader-workflow.spec.js`

```bash
# Run complete trader workflow
npm run test:e2e tests/e2e/primary-trader-workflow.spec.js

# Run with visual debugging
npm run test:e2e:headed tests/e2e/primary-trader-workflow.spec.js

# Run specific phases
npm run test:e2e tests/e2e/primary-trader-workflow.spec.js --grep "Phase 1"
```

#### Test Phases

1. **Phase 1: Display Creation Testing** - Ctrl+K workflow
2. **Phase 2: Navigation and Focus Testing** - Ctrl+Tab functionality
3. **Phase 3: Live Data Verification** - WebSocket connectivity
4. **Phase 4: Responsiveness Testing** - Drag-resize and reposition
5. **Phase 5: Cleanup Testing** - Ctrl+Shift+W removal

### Evidence Collection and Analysis

#### Automated Evidence Collection

```javascript
// Collect comprehensive test evidence
const testEvidence = {
  screenshots: await page.screenshot({ fullPage: true }),
  consoleLogs: await browserAgentManager.getConsoleLogs(page),
  performanceMetrics: await page.evaluate(() => performance.getEntriesByType('measure')),
  memoryUsage: await page.evaluate(() => performance.memory),
  domState: await page.evaluate(() => ({
    canvasCount: document.querySelectorAll('canvas').length,
    displayElements: document.querySelectorAll('[data-display-id]').length,
    activeWebSocket: !!window.websocket
  }))
};
```

#### Evidence Analysis Patterns

```javascript
// Analyze console log patterns for specific behaviors
function analyzeConsolePatterns(logs, patterns) {
  const results = {};

  for (const [patternName, pattern] of Object.entries(patterns)) {
    results[patternName] = logs.filter(log => pattern.test(log.message));
  }

  return results;
}

const displayPatterns = {
  displayCreation: /Creating display for symbol:/,
  dataSubscription: /Successfully subscribed display to data/,
  renderingUpdate: /Canvas rendered for symbol:/,
  priceUpdate: /Price updated:/
};
```

### Debugging Failing Tests

#### Step-by-Step Debugging

1. **Enable headed mode for visual debugging**
   ```bash
   npm run test:e2e:headed tests/e2e/primary-trader-workflow.spec.js
   ```

2. **Use Playwright Inspector for step-by-step execution**
   ```bash
   npm run test:e2e:debug tests/e2e/primary-trader-workflow.spec.js
   ```

3. **Enable detailed console logging**
   ```javascript
   // In test setup
   await page.addInitScript(() => {
     console.debug = (...args) => console.log('🔍 DEBUG:', ...args);
   });
   ```

4. **Capture detailed error information**
   ```javascript
   test.afterEach(async ({ page }) => {
     if (test.info().status !== 'passed') {
       const consoleLogs = await browserAgentManager.getConsoleLogs(page);
       const errorReport = await errorMonitor.getErrorReport();

       console.log('Test failure details:', {
         status: test.info().status,
         errors: errorReport.errors,
         consoleErrors: consoleLogs.filter(log => log.type === 'error')
       });
     }
   });
   ```

### Performance Benchmarking

#### Baseline Performance Collection

```javascript
// Establish performance baseline
const baseline = {
  frameRate: await validator._getCurrentFrameRate(),
  memory: await validator._getMemorySnapshot(),
  latency: await measureDataToVisualLatency(page),
  timestamp: Date.now()
};
```

#### Performance Regression Detection

```javascript
// Compare against baseline
function detectPerformanceRegression(current, baseline, thresholds) {
  const regressions = [];

  if (current.frameRate < baseline.frameRate - thresholds.fps) {
    regressions.push({
      type: 'frame_rate',
      current: current.frameRate,
      baseline: baseline.frameRate,
      threshold: thresholds.fps
    });
  }

  if (current.memory.used > baseline.memory.used + thresholds.memory) {
    regressions.push({
      type: 'memory',
      current: current.memory.used,
      baseline: baseline.memory.used,
      threshold: thresholds.memory
    });
  }

  return regressions;
}
```

## Best Practices and Common Pitfalls

### Log Pattern Matching Strategies

#### Effective Pattern Design

```javascript
// Good patterns - specific and meaningful
const EFFECTIVE_PATTERNS = {
  displayCreation: /Creating display for symbol: ([A-Z]+)/,
  dataSubscription: /Successfully subscribed display to data/,
  renderingComplete: /Canvas rendered for symbol: \w+/,
  priceUpdate: /Price updated: \d+\.\d+/
};

// Avoid patterns that are too broad or too specific
const PROBLEMATIC_PATTERNS = {
  tooBroad: /display/, // Matches too many unrelated messages
  tooSpecific: /Creating display for symbol: BTCUSD exactly/ // Only matches one case
};
```

#### Pattern Extraction

```javascript
// Extract data from log patterns
function extractSymbolFromLog(logMessage) {
  const match = logMessage.match(/Creating display for symbol: ([A-Z]+)/);
  return match ? match[1] : null;
}

function extractPriceFromLog(logMessage) {
  const match = logMessage.match(/Price updated: (\d+\.\d+)/);
  return match ? parseFloat(match[1]) : null;
}
```

### Error Evidence Collection

#### Comprehensive Error Capture

```javascript
// Capture complete error context
function captureErrorContext(error, page) {
  return {
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    context: {
      url: page.url(),
      timestamp: new Date().toISOString(),
      consoleLogs: page.consoleLogs,
      networkRequests: page.networkRequests,
      screenshots: page.screenshot()
    },
    application: {
      displays: page.evaluate(() => window.displayStore?.displays?.size || 0),
      webSocketState: page.evaluate(() => !!window.websocket),
      lastAction: page.evaluate(() => window.lastUserAction)
    }
  };
}
```

### Performance Optimization Techniques

#### Efficient Logging

```javascript
// Use lazy evaluation for expensive operations
function expensiveDebugOperation() {
  if (!DEBUG) return; // Early exit
  const expensiveResult = computeExpensiveResult();
  console.log('Debug result:', expensiveResult);
}

// Batch log operations
function batchLogDebug(logs) {
  if (!DEBUG || logs.length === 0) return;

  // Process all logs at once
  const batchedLogs = logs.map(processLog);
  console.log('Batch debug output:', batchedLogs);
}
```

#### Memory-Efficient Testing

```javascript
// Clean up resources between tests
test.afterEach(async () => {
  // Clear console logs
  if (window.testConsoleLogs) {
    window.testConsoleLogs.length = 0;
  }

  // Clear performance entries
  performance.clearMeasures();
  performance.clearMarks();

  // Reset application state
  if (window.displayStore) {
    window.displayStore.displays.clear();
  }
});
```

### Browser Compatibility Considerations

#### Cross-Browser Testing Matrix

```javascript
// playwright.config.js projects configuration
projects: [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] }
  },
  {
    name: 'firefox',
    use: { ...devices['Desktop Firefox'] }
  },
  {
    name: 'webkit',
    use: { ...devices['Desktop Safari'] }
  }
]
```

#### Browser-Specific Debugging

```javascript
// Handle browser differences in error handling
function getBrowserSpecificErrorHandler(browserName) {
  switch (browserName) {
    case 'chromium':
      return (error) => {
        // Chrome-specific error handling
        if (error.message.includes('DevTools')) {
          console.warn('Chrome DevTools error (expected in test environment)');
        }
      };

    case 'firefox':
      return (error) => {
        // Firefox-specific error handling
        if (error.message.includes('Content Security Policy')) {
          console.warn('Firefox CSP warning (handled)');
        }
      };

    case 'webkit':
      return (error) => {
        // Safari-specific error handling
        if (error.message.includes('Cross-origin')) {
          console.warn('Safari CORS warning (handled by test setup)');
        }
      };

    default:
      return (error) => console.error('Browser error:', error);
  }
}
```

### Advanced Debugging Techniques

#### WebSocket Debugging

```javascript
// Enhanced WebSocket debugging
function setupWebSocketDebugging(page) {
  return page.evaluateOnNewDocument(() => {
    const originalWebSocket = window.WebSocket;

    window.WebSocket = function(url, protocols) {
      const ws = new originalWebSocket(url, protocols);

      console.debug('🔌 WebSocket connecting:', url);

      ws.addEventListener('open', () => {
        console.debug('✅ WebSocket opened');
      });

      ws.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.debug('📨 WebSocket received:', data);
        } catch {
          console.debug('📨 WebSocket received (raw):', event.data);
        }
      });

      ws.addEventListener('error', (error) => {
        console.error('❌ WebSocket error:', error);
      });

      ws.addEventListener('close', () => {
        console.debug('🔌 WebSocket closed');
      });

      return ws;
    };
  });
}
```

#### Canvas Debugging

```javascript
// Canvas debugging utilities
function setupCanvasDebugging(page) {
  return page.evaluateOnNewDocument(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;

    HTMLCanvasElement.prototype.getContext = function(contextType, ...args) {
      const context = originalGetContext.call(this, contextType, ...args);

      if (contextType === '2d') {
        console.debug('🎨 2D Canvas context created:', {
          width: this.width,
          height: this.height,
          dpr: window.devicePixelRatio
        });

        // Wrap drawing methods for debugging
        const originalDrawImage = context.drawImage.bind(context);
        context.drawImage = function(...args) {
          console.debug('🖼️ Canvas.drawImage called:', args);
          return originalDrawImage(...args);
        };
      }

      return context;
    };
  });
}
```

This comprehensive logging and debugging system provides complete visibility into application behavior, performance characteristics, and potential issues. It ensures that NeuroSense FX maintains professional trading platform standards while providing actionable insights for developers working on visualization components.