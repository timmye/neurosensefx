# NeuroSense FX Application Testing

**Purpose**: Defines how to test the actual NeuroSense FX application structure, ensuring tests run against the real system rather than isolated components.

## Application Structure

### **Main Application Entry Points**
```
Development:  http://localhost:5174/     # ./run.sh dev
Production:   http://localhost:4173/     # ./run.sh start
```

### **Core Application Components**

#### **Main Display System**
- **Symbol Palette**: Keyboard-triggered symbol search (Ctrl+K)
- **Floating Displays**: Canvas-based visualizations with `.enhanced-floating` class
- **Canvas Rendering**: DPR-aware 60fps rendering in `canvas` elements
- **Workspace Management**: Multiple display layout and positioning

#### **Data Layer**
- **WebSocket Client**: `src/data/wsClient.js` connects to backend services
- **Display Store**: `src/stores/displayStore.js` manages application state
- **Symbol Management**: Real-time symbol data from cTrader integration
- **Configuration System**: Global settings stored in localStorage

#### **Visualization System**
- **Market Profile**: `src/lib/viz/marketProfile.js`
- **Day Range Meter**: `src/lib/viz/dayRangeMeter.js`
- **Price Display**: `src/lib/viz/priceDisplay.js`
- **Volatility Orb**: `src/lib/viz/volatilityOrb.js`
- **Enhancement System**: `src/lib/viz/EnhancementSystem.js`

## Testing the Real Application

### **Environment Setup**
```bash
# Start development environment for testing
./run.sh dev          # Frontend: 5174, Backend: 8080
./run.sh start        # Production: 4173, Backend: 8081

# Verify services are running
./run.sh status        # Check service health
```

### **Application Access Patterns**

#### **1. Page Navigation**
```javascript
// Always navigate to the real application
await page.goto('http://localhost:5174');  // Development
// await page.goto('http://localhost:4173');  // Production

// Wait for application to fully load
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1000);  // Ensure initialization complete
```

#### **2. DOM Element Selection**
```javascript
// Symbol palette (search input)
const searchInput = page.locator('input[placeholder*="search" i]');

// Floating displays
const floatingDisplays = page.locator('.enhanced-floating');
const canvasElements = page.locator('canvas');

// Symbol list items
const symbolItems = page.locator('[data-symbol]');

// Application containers
const appContainer = page.locator('#app');
```

#### **3. Application State Verification**
```javascript
// Verify display store exists and has data
const hasDisplays = await page.evaluate(() => {
  return window.displayStore &&
         window.displayStore.displays &&
         window.displayStore.displays.size > 0;
});

// Verify WebSocket connection status
const wsConnected = await page.evaluate(() => {
  return window.wsStatus === 'connected' ||
         document.body.textContent.includes('WebSocket connected');
});
```

### **Real User Workflow Testing**

#### **Primary Trader Workflow**
```javascript
test('Complete Trader Workflow: BTC/USD Display Creation', async ({ page }) => {
  // Navigate to real application
  await page.goto('http://localhost:5174');
  await page.waitForLoadState('networkidle');

  // Step 1: Open symbol palette
  await page.keyboard.press('Control+k');
  await expect(page.locator('input[placeholder*="search" i]')).toBeVisible();

  // Step 2: Search for symbol
  await page.fill('input[placeholder*="search" i]', 'BTC/USD');
  await page.keyboard.press('Enter');

  // Step 3: Verify display creation
  await expect(page.locator('.enhanced-floating')).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();

  // Step 4: Verify real data connection
  const hasRealData = await page.evaluate(() => {
    const displays = window.displayStore?.displays;
    if (!displays || displays.size === 0) return false;

    const firstDisplay = Array.from(displays.values())[0];
    return firstDisplay.symbol && firstDisplay.symbolData;
  });
  expect(hasRealData).toBeTruthy();

  // Step 5: Verify canvas rendering
  const canvasCount = await page.locator('canvas').count();
  expect(canvasCount).toBeGreaterThan(0);

  // Step 6: Close display
  await page.keyboard.press('Escape');
});
```

#### **Multi-Display Management**
```javascript
test('Multiple Display Management Workflow', async ({ page }) => {
  await page.goto('http://localhost:5174');

  // Create first display
  await page.keyboard.press('Control+k');
  await page.fill('input[placeholder*="search" i]', 'ETH/USD');
  await page.keyboard.press('Enter');

  // Create second display
  await page.keyboard.press('Control+k');
  await page.fill('input[placeholder*="search" i]', 'EUR/USD');
  await page.keyboard.press('Enter');

  // Verify both displays exist
  const displays = await page.locator('.enhanced-floating').count();
  expect(displays).toBe(2);

  // Test workspace management
  await page.keyboard.press('Control+Shift+W');  // Close all displays
  await page.waitForTimeout(500);

  const displaysAfter = await page.locator('.enhanced-floating').count();
  expect(displaysAfter).toBe(0);
});
```

### **WebSocket Integration Testing**

#### **Real Connection Verification**
```javascript
test('WebSocket Connection to Live Backend', async ({ page }) => {
  await page.goto('http://localhost:5174');

  // Monitor console for WebSocket activity
  const wsMessages = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('WebSocket') ||
        text.includes('ws://localhost:8080') ||
        text.includes('connected') ||
        text.includes('symbol')) {
      wsMessages.push(text);
    }
  });

  // Wait for connection establishment
  await page.waitForTimeout(3000);

  // Verify real WebSocket connection
  const hasConnection = wsMessages.some(msg =>
    msg.includes('connected') || msg.includes('ws://localhost:8080')
  );
  expect(hasConnection).toBeTruthy();

  // Verify symbol data retrieval
  const hasSymbolData = wsMessages.some(msg =>
    msg.includes('symbol') && msg.includes('data')
  );
  expect(hasSymbolData).toBeTruthy();
});
```

#### **Real Data Flow Testing**
```javascript
test('Live Market Data Updates in Display', async ({ page }) => {
  await page.goto('http://localhost:5174');

  // Create display
  await page.keyboard.press('Control+k');
  await page.fill('input[placeholder*="search" i]', 'BTC/USD');
  await page.keyboard.press('Enter');

  // Monitor for real data updates
  const updateMessages = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('update') || text.includes('tick') || text.includes('price')) {
      updateMessages.push(text);
    }
  });

  // Wait for real data updates
  await page.waitForTimeout(5000);

  // Verify real market data updates
  expect(updateMessages.length).toBeGreaterThan(0);

  // Verify display shows real-time updates
  const hasActiveUpdates = await page.evaluate(() => {
    const displays = window.displayStore?.displays;
    if (!displays || displays.size === 0) return false;

    const display = Array.from(displays.values())[0];
    return display.lastUpdate &&
           (Date.now() - display.lastUpdate) < 10000;  // Recent update
  });
  expect(hasActiveUpdates).toBeTruthy();
});
```

### **Performance Testing with Real Application**

#### **Keyboard Shortcut Performance**
```javascript
test('Ctrl+K Performance Under 310ms', async ({ page }) => {
  await page.goto('http://localhost:5174');

  // Measure actual keyboard response time
  const startTime = performance.now();
  await page.keyboard.press('Control+k');
  await page.locator('input[placeholder*="search" i]').waitFor({ state: 'visible' });
  const responseTime = performance.now() - startTime;

  console.log(`Ctrl+K response time: ${responseTime.toFixed(2)}ms`);
  expect(responseTime).toBeLessThan(310);  // Real requirement
});
```

#### **Canvas Rendering Performance**
```javascript
test('Canvas Creation and Rendering Performance', async ({ page }) => {
  await page.goto('http://localhost:5174');

  // Measure display creation performance
  const startTime = performance.now();

  await page.keyboard.press('Control+k');
  await page.fill('input[placeholder*="search" i]', 'EUR/USD');
  await page.keyboard.press('Enter');

  // Wait for canvas to be fully rendered
  await page.locator('.enhanced-floating').waitFor({ state: 'visible' });
  await page.locator('canvas').waitFor({ state: 'visible' });
  await page.waitForTimeout(500);  // Allow rendering completion

  const creationTime = performance.now() - startTime;

  console.log(`Display creation time: ${creationTime.toFixed(2)}ms`);
  expect(creationTime).toBeLessThan(1000);  // Reasonable creation time
});
```

### **Application State Management**

#### **Persistent Configuration Testing**
```javascript
test('Configuration Persistence Across Sessions', async ({ page }) => {
  await page.goto('http://localhost:5174');

  // Modify configuration in real application
  await page.evaluate(() => {
    if (window.displayStore) {
      window.displayStore.defaultConfig.visuals.brightness = 0.8;
      window.displayStore.defaultConfig.core.dayRangePercentage = 0.6;
    }
  });

  // Reload page to test persistence
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Verify configuration persisted
  const persistedConfig = await page.evaluate(() => {
    return window.displayStore?.defaultConfig?.visuals?.brightness === 0.8 &&
           window.displayStore?.defaultConfig?.core?.dayRangePercentage === 0.6;
  });

  expect(persistedConfig).toBeTruthy();
});
```

## Forbidden Testing Approaches

### **🚫 NEVER TEST ISOLATED COMPONENTS**
- **Forbidden**: Testing components outside the main application context
- **Forbidden**: Creating standalone test files or mock applications
- **Forbidden**: Testing with synthetic DOM structures not from the real app

### **🚫 NEVER USE MOCK APPLICATIONS**
- **Forbidden**: Creating test.html files with isolated components
- **Forbidden**: Building custom test harnesses or sandboxes
- **Forbidden**: Testing with fake application structures

### **🚫 NEVER SYNTHESIZE USER INTERFACES**
- **Forbidden**: Testing with mock UI elements not present in real application
- **Forbidden**: Simulating user workflows that don't exist in the actual system
- **Forbidden**: Testing with fake DOM states or synthetic component trees

## Application Testing Checklist

### **Before Testing:**
- [ ] Real application is running on correct port (5174 or 4173)
- [ ] Backend WebSocket service is active (8080 or 8081)
- [ ] Application fully loads with network idle state
- [ ] Display store and WebSocket client initialized

### **During Testing:**
- [ ] Tests interact with actual application DOM elements
- [ ] Real user workflows are tested end-to-end
- [ ] Performance measurements use actual browser APIs
- [ ] WebSocket connections to live backend are verified

### **After Testing:**
- [ ] Test results show real application behavior
- [ ] Performance metrics from actual user interactions
- [ ] Evidence includes screenshots of real application
- [ ] Console logs show genuine application activity

This ensures all testing validates the actual NeuroSense FX application under realistic conditions with real data and complete user workflows.