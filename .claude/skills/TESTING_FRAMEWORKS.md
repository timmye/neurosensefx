# NeuroSense FX Testing Frameworks

**Purpose**: Defines the exact usage patterns for Vitest and Playwright in NeuroSense FX, ensuring consistent testing approaches and proper framework integration.

## Available Testing Frameworks

### **Vitest - Unit Testing**
**Purpose**: Pure function testing without browser mocking
**Configuration**: `vitest.config.js`
**Command**: `npm run test:unit`

### **Playwright - End-to-End Testing**
**Purpose**: Real browser testing with actual application
**Configuration**: `playwright.config.js`
**Command**: `npm run test:e2e`

## Vitest Usage Patterns

### **Configuration Analysis**
```javascript
// From vitest.config.js - Key settings for NeuroSense FX
export default defineConfig({
  test: {
    environment: 'jsdom',  // DOM access but we use real browser tests
    include: [
      'tests/**/*.test.js',
      'tests/**/*.spec.js'
    ],
    testTimeout: 60000,    // 60 seconds for real operations
    isolate: true,         // Prevent test interference
    globals: {
      PERFORMANCE_METRICS: true,
      REAL_BROWSER_TESTING: true,
      LIVE_DATA_CONNECTIONS: true,
      KEYBOARD_LATENCY_MAX: 310,      // Real requirements
      DATA_TO_VISUAL_LATENCY_MAX: 100,
      FPS_RENDERING_MIN: 60
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@tests': resolve(__dirname, './tests'),
      '@helpers': resolve(__dirname, './tests/helpers')
    }
  }
});
```

### **Valid Vitest Test Patterns**

#### **Pure Function Testing**
```javascript
// tests/unit/priceFormatting.test.js - GOOD EXAMPLE
import { describe, it, expect } from 'vitest';
import { formatPriceSimple, formatPriceWithDecimals } from '../../src/lib/utils/priceFormatting.js';

describe('Price Formatting Utilities', () => {
  it('should format simple prices correctly', () => {
    const result = formatPriceSimple(1234.56, 2);
    expect(result).toBe('1,234.56');
  });

  it('should handle different decimal places', () => {
    const result = formatPriceWithDecimals(1.234567, 5);
    expect(result).toBe('1.23457');
  });

  it('should handle edge cases', () => {
    expect(formatPriceSimple(0, 2)).toBe('0.00');
    expect(formatPriceSimple(null, 2)).toBe('0.00');
    expect(formatPriceSimple(undefined, 2)).toBe('0.00');
  });
});
```

#### **Configuration Testing**
```javascript
// tests/unit/configDefaults.test.js - GOOD EXAMPLE
import { describe, it, expect } from 'vitest';
import { getEssentialDefaultConfig } from '../../src/config/visualizationSchema.js';

describe('Configuration Defaults', () => {
  it('should provide valid default configuration', () => {
    const config = getEssentialDefaultConfig();

    expect(config).toBeDefined();
    expect(config.core).toBeDefined();
    expect(config.visuals).toBeDefined();
    expect(config.core.dayRangePercentage).toBeGreaterThan(0);
    expect(config.core.dayRangePercentage).toBeLessThan(1);
  });

  it('should validate percentage conversion', () => {
    const config = getEssentialDefaultConfig();

    // Percentages should be converted to decimals internally
    expect(typeof config.core.dayRangePercentage).toBe('number');
    expect(config.core.dayRangePercentage).toBeGreaterThanOrEqual(0);
    expect(config.core.dayRangePercentage).toBeLessThanOrEqual(1);
  });
});
```

### **Forbidden Vitest Patterns**

#### **🚫 NEVER MOCK BROWSER APIS**
```javascript
// ❌ FORBIDDEN - Don't mock browser functionality
import { vi } from 'vitest';

test('should mock canvas', () => {
  const mockCanvas = vi.fn();
  mockCanvas.getContext = vi.fn().mockReturnValue({});
  // This is synthetic testing - use Playwright instead
});
```

#### **🚫 NEVER TEST CANVAS OR DOM MANIPULATION**
```javascript
// ❌ FORBIDDEN - Canvas testing belongs in Playwright
test('should render canvas', () => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  // Canvas rendering should be tested in real browser
});
```

#### **🚫 NEVER CREATE MOCK WEBSOCKETS**
```javascript
// ❌ FORBIDDEN - WebSocket testing needs real backend
import { vi } from 'vitest';

test('should handle WebSocket messages', () => {
  const mockWs = vi.fn();
  mockWs.onmessage = vi.fn();
  // Test with real WebSocket connections instead
});
```

## Playwright Usage Patterns

### **Configuration Analysis**
```javascript
// From playwright.config.js - Key settings for NeuroSense FX
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  fullyParallel: false,  // Sequential for system visibility
  use: {
    baseURL: 'http://localhost:5174',  // Real development URL
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,  // 2 minutes startup
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--no-sandbox',
            '--enable-precise-memory-info'
          ]
        }
      },
    },
  ],
});
```

### **Valid Playwright Test Patterns**

#### **Complete User Workflows**
```javascript
// tests/e2e/primary-trader-workflow.spec.js - GOOD EXAMPLE
import { test, expect } from '@playwright/test';

test.describe('Primary Trader Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);  // Ensure initialization
  });

  test('Complete workflow: Ctrl+K → Symbol Search → Canvas → Close', async ({ page }) => {
    // Step 1: Open symbol palette
    await page.keyboard.press('Control+k');
    await expect(page.locator('input[placeholder*="search" i]')).toBeVisible();

    // Step 2: Search and select symbol
    await page.fill('input[placeholder*="search" i]', 'ETH/USD');
    await page.keyboard.press('Enter');

    // Step 3: Verify canvas creation
    await expect(page.locator('.enhanced-floating')).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();

    // Step 4: Verify real data connection
    const hasRealData = await page.evaluate(() => {
      return window.displayStore?.displays?.size > 0;
    });
    expect(hasRealData).toBeTruthy();

    // Step 5: Close workflow
    await page.keyboard.press('Escape');
  });
});
```

#### **Performance Testing**
```javascript
// tests/e2e/performance.spec.js - GOOD EXAMPLE
import { test, expect } from '@playwright/test';

test.describe('Application Performance', () => {
  test('Keyboard shortcuts under 310ms', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const responseTimes = [];
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Escape');  // Clear any open palette
      await page.waitForTimeout(100);

      const startTime = await page.evaluate(() => performance.now());
      await page.keyboard.press('Control+k');
      await page.locator('input[placeholder*="search" i]').waitFor({ state: 'visible' });
      const endTime = await page.evaluate(() => performance.now());

      responseTimes.push(endTime - startTime);
    }

    const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    expect(avgTime).toBeLessThan(310);
    console.log(`Average keyboard response: ${avgTime.toFixed(2)}ms`);
  });

  test('Canvas rendering performance', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const startTime = await page.evaluate(() => performance.now());

    await page.keyboard.press('Control+k');
    await page.fill('input[placeholder*="search" i]', 'BTC/USD');
    await page.keyboard.press('Enter');

    await page.locator('.enhanced-floating').waitFor({ state: 'visible' });
    await page.locator('canvas').waitFor({ state: 'visible' });
    await page.waitForTimeout(500);  // Allow rendering completion

    const endTime = await page.evaluate(() => performance.now());
    const creationTime = endTime - startTime;

    expect(creationTime).toBeLessThan(1000);
    console.log(`Canvas creation time: ${creationTime.toFixed(2)}ms`);
  });
});
```

#### **WebSocket Integration Testing**
```javascript
// tests/e2e/websocket-integration.spec.js - GOOD EXAMPLE
import { test, expect } from '@playwright/test';

test.describe('WebSocket Integration', () => {
  test('Real WebSocket connection to backend', async ({ page }) => {
    await page.goto('/');

    // Monitor console for WebSocket activity
    const wsMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('WebSocket') || text.includes('ws://localhost:8080')) {
        wsMessages.push(text);
      }
    });

    await page.waitForTimeout(3000);  // Allow connection establishment

    const hasConnection = wsMessages.some(msg =>
      msg.includes('connected') || msg.includes('ws://localhost:8080')
    );
    expect(hasConnection).toBeTruthy();

    console.log('WebSocket messages:', wsMessages);
  });

  test('Real market data updates', async ({ page }) => {
    await page.goto('/');

    // Create display to receive data
    await page.keyboard.press('Control+k');
    await page.fill('input[placeholder*="search" i]', 'EUR/USD');
    await page.keyboard.press('Enter');

    // Monitor for real data updates
    const updateMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('update') || text.includes('tick')) {
        updateMessages.push(text);
      }
    });

    await page.waitForTimeout(5000);  // Wait for market data

    expect(updateMessages.length).toBeGreaterThan(0);
    console.log('Market data updates:', updateMessages);
  });
});
```

### **Test Helpers and Utilities**

#### **Browser Agents Setup**
```javascript
// tests/helpers/browser-agents.js - ACTUAL HELPER FROM PROJECT
export const browserAgentManager = {
  async setupConsoleMonitoring(page) {
    const consoleMessages = [];

    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      });
    });

    page.on('pageerror', error => {
      consoleMessages.push({
        type: 'error',
        text: error.message,
        stack: error.stack
      });
    });

    return consoleMessages;
  },

  async setupPerformanceMonitoring(page) {
    const performanceData = {
      navigationStart: 0,
      firstContentfulPaint: 0,
      largestContentfulPaint: 0
    };

    await page.evaluateOnNewDocument(() => {
      // Performance monitoring setup
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.entryType === 'largest-contentful-paint') {
              window.lcpTime = entry.startTime;
            }
          });
        });
        observer.observe({ entryTypes: ['largest-contentful-paint'] });
      }
    });

    return performanceData;
  }
};
```

## Test Execution Commands

### **Development Testing**
```bash
# Unit tests only
npm run test:unit              # Run all unit tests
npm run test:unit:watch        # Watch mode for development
npm run test:unit:coverage     # With coverage report

# E2E tests only
npm run test:e2e               # Run all E2E tests
npm run test:e2e:headed        # Visible browser
npm run test:e2e:debug         # Interactive debugging
npm run test:e2e:chrome        # Chrome specifically
npm run test:e2e:firefox       # Firefox specifically

# Combined testing
npm run test:all               # Both unit and E2E
```

### **Production Testing**
```bash
# Test production build
npm run build                  # Build production version
npm run preview                # Start production server
npm run test:e2e               # Test against production build

# Production-specific tests
npm run test:e2e -- --project=production
npm run test:e2e:performance   # Performance-focused tests
```

## Framework Integration Best Practices

### **Vitest Best Practices**
1. **Pure Functions Only**: Test utilities and business logic
2. **No Browser Mocking**: Use Playwright for DOM/canvas testing
3. **Fast Execution**: Keep unit tests under 5 seconds total
4. **Clear Naming**: Test names should explain the behavior
5. **Edge Cases**: Test null, undefined, and error conditions

### **Playwright Best Practices**
1. **Real URLs Only**: Always use localhost:5174 or localhost:4173
2. **Wait Strategies**: Use `waitForSelector` and proper waits
3. **Console Monitoring**: Capture real application logs
4. **Performance Measurement**: Use `performance.now()` for timing
5. **Clean State**: Clear workspace between tests

## Forbidden Testing Patterns

### **🚫 NEVER MIX FRAMEWORK RESPONSIBILITIES**
- **Vitest**: Never test browser-specific functionality
- **Playwright**: Never test pure utility functions
- **Separation**: Keep unit tests and E2E tests clearly separated

### **🚫 NEVER CREATE CUSTOM TEST INFRASTRUCTURE**
- **No Custom Runners**: Use the established npm scripts
- **No Mock Servers**: Test against real WebSocket backend
- **No Synthetic Browsers**: Use Playwright's real browser automation

This ensures consistent, reliable testing that validates the actual NeuroSense FX application behavior and performance.