# NeuroSense FX Testing Protocol

**Purpose**: Defines the exact testing methodology for NeuroSense FX development, preventing anti-patterns and ensuring consistent validation approaches.

## Core Testing Philosophy

**REAL APPLICATION TESTING ONLY**
- Test the actual NeuroSense FX application, not isolated components
- Use real browser environments (Chrome/Firefox/Safari) via Playwright
- Connect to live WebSocket services (ports 8080/8081) for data validation
- Test complete user workflows, not synthetic scenarios

## Application Access Points

### **Development Environment**
```bash
./run.sh dev          # Frontend: http://localhost:5174, Backend: ws://localhost:8080
./run.sh dev:prod     # Production mode on dev ports
```

### **Production Environment**
```bash
./run.sh start        # Frontend: http://localhost:4173, Backend: ws://localhost:8081
./run.sh start:prod   # Full production stack
```

### **Testing Commands**
```bash
npm run test:unit              # Vitest pure function tests
npm run test:e2e               # Playwright real DOM tests
npm run test:all               # Both test suites together
npm run test:e2e:headed        # Visible browser testing
npm run test:e2e:debug         # Interactive debugging
```

## Forbidden Testing Approaches

### **🚫 NEVER CREATE ISOLATED TEST PAGES**
- **Forbidden**: Creating `test.html`, `demo.html`, or standalone test files
- **Forbidden**: Testing components outside the main application
- **Forbidden**: Building custom test harnesses or sandboxes
- **Instead**: Use `npm run test:e2e` with the actual application

### **🚫 NEVER USE SYNTHETIC DATA**
- **Forbidden**: Mocking WebSocket connections with fake data
- **Forbidden**: Creating synthetic market data or price feeds
- **Forbidden**: Using `jest.mock()` or similar mocking frameworks
- **Instead**: Connect to real backend services and test with live data

### **🚫 NEVER USE PROXY VALIDATION METRICS**
- **Forbidden**: Validating success by file sizes, line counts, or code coverage
- **Forbidden**: Measuring performance with synthetic benchmarks
- **Forbidden**: Using generic accessibility tools instead of trading workflows
- **Instead**: Validate using actual trading requirements and user workflows

## Required Testing Patterns

### **1. Complete User Workflows**
Test full trader workflows from start to finish:

```javascript
// Example: Complete trader workflow test
test('Ctrl+K → ETH/USD → Canvas Creation → Close', async ({ page }) => {
  // Step 1: Open application (real URL)
  await page.goto('http://localhost:5174');

  // Step 2: Open symbol palette
  await page.keyboard.press('Control+k');
  await expect(page.locator('input[placeholder*="search" i]')).toBeVisible();

  // Step 3: Search and select symbol
  await page.fill('input[placeholder*="search" i]', 'ETH/USD');
  await page.keyboard.press('Enter');

  // Step 4: Verify canvas creation
  await expect(page.locator('.enhanced-floating')).toBeVisible();

  // Step 5: Close workflow
  await page.keyboard.press('Escape');
});
```

### **2. Real WebSocket Connections**
Test with actual market data connections:

```javascript
// Verify WebSocket connection establishment
test('WebSocket connection to live backend', async ({ page }) => {
  await page.goto('http://localhost:5174');

  // Monitor console for WebSocket connection logs
  const wsMessages = [];
  page.on('console', msg => {
    if (msg.text().includes('WebSocket') || msg.text().includes('ws://localhost:8080')) {
      wsMessages.push(msg.text());
    }
  });

  // Wait for connection establishment
  await page.waitForTimeout(2000);

  // Verify actual WebSocket connection
  expect(wsMessages.some(msg => msg.includes('connected') || msg.includes('open'))).toBeTruthy();
});
```

### **3. Performance Requirements**
Validate using real performance metrics:

```javascript
// Keyboard latency testing
test('Ctrl+K response under 310ms', async ({ page }) => {
  await page.goto('http://localhost:5174');

  const startTime = Date.now();
  await page.keyboard.press('Control+k');
  await page.locator('input[placeholder*="search" i]').waitFor({ state: 'visible' });
  const endTime = Date.now();

  expect(endTime - startTime).toBeLessThan(310); // Real requirement
});
```

## Application Structure for Testing

### **URL Patterns**
- **Development**: `http://localhost:5174/` (main application)
- **Production**: `http://localhost:4173/` (optimized build)

### **Key DOM Elements**
- Symbol palette: `input[placeholder*="search" i]`
- Canvas displays: `.enhanced-floating`, `canvas`
- Symbol list: `[data-symbol]`, `.symbol-item`
- Keyboard shortcuts: Listen for actual keyboard events

### **WebSocket Monitoring**
- Connection URL: `ws://localhost:8080` (dev) or `ws://localhost:8081` (prod)
- Console patterns: "WebSocket", "connected", "symbol data", "market data"
- Store validation: `window.displayStore`, `window.wsStatus`

## Test Environment Configuration

### **Browser Settings**
```javascript
// Playwright configuration for realistic testing
{
  viewport: { width: 1920, height: 1080 },
  launchOptions: {
    args: ['--disable-web-security', '--no-sandbox']
  }
}
```

### **Service Dependencies**
- Backend WebSocket server must be running before tests
- Frontend development server must be accessible
- Real network connectivity required (no offline testing)

## Evidence Standards

### **Valid Evidence Types**
1. **Screenshot Evidence**: Actual application screenshots showing UI state
2. **Console Logs**: Real browser console output during test execution
3. **Network Requests**: Actual WebSocket connection logs and data flow
4. **Performance Metrics**: Measured response times from real user interactions
5. **DOM State**: Verified HTML structure of the actual application

### **Invalid Evidence Types**
1. **Mock Outputs**: Synthetic test results from fake data
2. **File Metrics**: Code coverage percentages or file sizes
3. **Simulated Performance**: Benchmarks not based on real application usage
4. **Isolated Component Tests**: Tests run outside the main application context

## Testing Workflow Integration

### **Before Implementation**
1. Check if test infrastructure exists for the feature
2. Verify backend WebSocket service is running
3. Confirm application is accessible on correct port
4. Review existing test patterns for similar features

### **During Implementation**
1. Write tests against the actual application
2. Use real WebSocket connections and data
3. Test complete user workflows, not isolated functionality
4. Validate using actual performance requirements

### **After Implementation**
1. Run `npm run test:e2e` for full workflow validation
2. Run `npm run test:unit` for pure function testing
3. Verify tests use real application URLs and services
4. Confirm no synthetic data or mock connections

This protocol ensures all testing validates the actual NeuroSense FX application under realistic conditions with real data and complete user workflows.