# NeuroSense FX Evidence Standards

**Purpose**: Defines what constitutes valid evidence for successful implementation and testing, preventing validation with proxy metrics.

## Valid Evidence Categories

### **1. Application Behavior Evidence**
**Real user interactions with the actual application**

**✅ Valid Evidence:**
- Screenshots of the actual NeuroSense FX application showing implemented features
- Videos of user workflows (Ctrl+K → Symbol Search → Canvas Creation → Close)
- Console logs from real browser sessions showing WebSocket connections
- Network tab evidence of actual data flow to/from `ws://localhost:8080` or `ws://localhost:8081`

**❌ Invalid Evidence:**
- Isolated component screenshots outside the main application
- Mock data displays or synthetic UI demonstrations
- Code coverage reports or file size metrics
- Synthetic test results from isolated test pages

### **2. Performance Evidence**
**Measured performance from actual application usage**

**✅ Valid Evidence:**
```javascript
// Real keyboard latency measurement
const startTime = performance.now();
await page.keyboard.press('Control+k');
await page.locator('input[placeholder*="search" i]').waitFor({ state: 'visible' });
const responseTime = performance.now() - startTime;
console.log(`Ctrl+K response time: ${responseTime}ms`);
// Valid: Under 310ms requirement
```

**✅ Valid Evidence:**
- Real browser performance metrics using `performance.now()`
- Measured canvas rendering times from actual application
- WebSocket message latency from live connections
- Memory usage from real browser session (`performance.memory`)

**❌ Invalid Evidence:**
- Synthetic benchmark results not from the actual application
- Theoretical performance calculations
- Code analysis or static metrics
- Mock performance tests with simulated data

### **3. Real Data Evidence**
**Evidence from actual market data connections**

**✅ Valid Evidence:**
```javascript
// Real WebSocket connection validation
const wsMessages = [];
page.on('console', msg => {
  if (msg.text().includes('ws://localhost:8080') ||
      msg.text().includes('symbol data') ||
      msg.text().includes('market update')) {
    wsMessages.push(msg.text());
  }
});
// Valid: Actual connection logs from live backend
```

**✅ Valid Evidence:**
- Console logs showing successful WebSocket connections to live backend
- Real symbol data retrieval from cTrader integration
- Actual price updates in the application interface
- Live market data flow validation

**❌ Invalid Evidence:**
- Mock WebSocket connections with fake data
- Synthetic market data or price feeds
- Simulated symbol lists or trading data
- Static test data not from live sources

### **4. User Workflow Evidence**
**Complete end-to-end user interaction validation**

**✅ Valid Evidence:**
```javascript
// Complete trader workflow
test('Primary Trader Workflow: ETH/USD Display', async ({ page }) => {
  await page.goto('http://localhost:5174');

  // Step 1: Open symbol palette
  await page.keyboard.press('Control+k');
  await expect(page.locator('input[placeholder*="search" i]')).toBeVisible();

  // Step 2: Search symbol
  await page.fill('input[placeholder*="search" i]', 'ETH/USD');
  await page.keyboard.press('Enter');

  // Step 3: Verify canvas creation
  await expect(page.locator('.enhanced-floating')).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();

  // Step 4: Verify real data
  const hasRealData = await page.evaluate(() => {
    const displays = window.displayStore?.displays;
    return displays && displays.size > 0;
  });
  expect(hasRealData).toBeTruthy();
});
```

**❌ Invalid Evidence:**
- Isolated component testing outside application context
- Synthetic user interaction patterns not based on real workflows
- Mock UI states or simulated interactions
- Testing without the actual application running

## Evidence Collection Methods

### **Valid Collection Approaches**

#### **Browser Console Monitoring**
```javascript
// Real-time console log capture
page.on('console', msg => {
  const text = msg.text();
  if (text.includes('WebSocket') || text.includes('symbol') || text.includes('display')) {
    console.log('REAL EVIDENCE:', text);
  }
});
```

#### **Performance API Usage**
```javascript
// Real performance measurement
const navigationTiming = performance.getEntriesByType('navigation')[0];
console.log('Page load time:', navigationTiming.loadEventEnd - navigationTiming.loadEventStart);
```

#### **Network Request Verification**
```javascript
// Verify real WebSocket connections
page.waitForResponse(response => {
  return response.url().includes('ws://localhost:8080') ||
         response.url().includes('ws://localhost:8081');
});
```

#### **DOM State Validation**
```javascript
// Verify actual application state
const canvasCount = await page.locator('.enhanced-floating').count();
const symbolPaletteOpen = await page.locator('input[placeholder*="search" i]').isVisible();
```

### **Invalid Collection Approaches**

#### **Mock Data Generation**
```javascript
// ❌ FORBIDDEN - Synthetic data generation
const mockSymbolData = { symbol: 'BTC/USD', price: 45000 };
// This is not real evidence from the application
```

#### **Static File Analysis**
```javascript
// ❌ FORBIDDEN - File size or line count metrics
const fileStats = fs.statSync('src/components/MyComponent.svelte');
console.log('File size:', fileStats.size);
// This is not evidence of application functionality
```

#### **Synthetic Testing**
```javascript
// ❌ FORBIDDEN - Isolated test creation
const testHtml = `
  <html>
    <body>
      <div id="test-component">Mock Component</div>
    </body>
  </html>
`;
// This is not the real application
```

## Evidence Validation Criteria

### **Successful Implementation Evidence Must Include:**

1. **Application Access**: Evidence shows the real NeuroSense FX application running
   - URL: `http://localhost:5174` (dev) or `http://localhost:4173` (prod)
   - Visible application interface with implemented features

2. **Real Data Connection**: Evidence shows connection to live WebSocket services
   - Connection to `ws://localhost:8080` (dev) or `ws://localhost:8081` (prod)
   - Real symbol data retrieval and display

3. **User Interaction**: Evidence shows actual user workflows functioning
   - Keyboard shortcuts (Ctrl+K, Escape) working in real application
   - Canvas creation, symbol selection, and display management

4. **Performance Validation**: Evidence shows real performance requirements met
   - Keyboard response under 310ms measured with `performance.now()`
   - Canvas rendering with sub-100ms latency
   - Real memory usage tracking during application usage

### **Failed Implementation Evidence:**

1. **Isolated Testing**: Evidence from test.html or standalone components
2. **Mock Data**: Evidence using synthetic or simulated market data
3. **Proxy Metrics**: Evidence based on file sizes, code coverage, or synthetic benchmarks
4. **Simulated Workflows**: Evidence from fake user interactions or mock UI states

## Evidence Documentation Standards

### **Required Documentation:**

1. **Test Reports**: HTML reports from `npm run test:e2e` with screenshots
2. **Console Logs**: Full browser console output during test execution
3. **Performance Metrics**: Measured response times and resource usage
4. **Network Evidence**: WebSocket connection logs and data flow verification

### **Evidence Presentation:**

- Use actual screenshots from the real application
- Include complete console log outputs showing real connections
- Provide measured performance data with timing information
- Show network tab evidence of live data connections

This ensures all evidence represents actual application functionality and real user experiences, not synthetic validation or proxy metrics.