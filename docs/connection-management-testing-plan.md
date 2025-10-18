# Connection Management Testing Plan

## Overview

This document outlines the testing strategy for the connection management improvements and symbol selection workflow enhancements in NeuroSense FX.

## Testing Objectives

1. **Validate Live Data Flow**: Ensure canvases receive live data after creation
2. **Test Symbol Selection Workflow**: Verify Enter key and click-to-create functionality
3. **Test Error Handling**: Ensure proper error handling and user feedback
4. **Performance Testing**: Validate performance with multiple canvases
5. **Regression Testing**: Ensure existing functionality remains intact

## Test Environment Setup

### 1. Test Data Sources

- **Live Data**: Use actual cTrader connection (if available)
- **Simulated Data**: Use built-in simulation mode
- **Mock Data**: Create mock WebSocket server for controlled testing

### 2. Test Scenarios

- Single canvas creation
- Multiple canvases with same symbol
- Multiple canvases with different symbols
- Connection failures and recovery
- Rapid canvas creation and deletion

## Test Cases

### 1. ConnectionManager Tests

#### 1.1 Symbol Subscription Tests

```javascript
// Test: subscribeCanvas creates proper subscription
test('subscribeCanvas creates proper subscription', async () => {
  const canvasId = 'test-canvas-1';
  const symbol = 'EURUSD';
  
  const symbolData = await connectionManager.subscribeCanvas(canvasId, symbol);
  
  expect(connectionManager.getSymbolForCanvas(canvasId)).toBe(symbol);
  expect(connectionManager.getCanvasesForSymbol(symbol)).toContain(canvasId);
  expect(symbolData).toBeDefined();
  expect(symbolData.config).toBeDefined();
  expect(symbolData.state).toBeDefined();
});

// Test: unsubscribeCanvas removes subscription
test('unsubscribeCanvas removes subscription', () => {
  const canvasId = 'test-canvas-1';
  const symbol = 'EURUSD';
  
  connectionManager.subscribeCanvas(canvasId, symbol);
  connectionManager.unsubscribeCanvas(canvasId);
  
  expect(connectionManager.getSymbolForCanvas(canvasId)).toBeNull();
  expect(connectionManager.getCanvasesForSymbol(symbol)).not.toContain(canvasId);
});

// Test: multiple canvases with same symbol
test('multiple canvases with same symbol', async () => {
  const canvas1 = 'test-canvas-1';
  const canvas2 = 'test-canvas-2';
  const symbol = 'EURUSD';
  
  await connectionManager.subscribeCanvas(canvas1, symbol);
  await connectionManager.subscribeCanvas(canvas2, symbol);
  
  const canvases = connectionManager.getCanvasesForSymbol(symbol);
  expect(canvases).toContain(canvas1);
  expect(canvases).toContain(canvas2);
  expect(canvases.size).toBe(2);
  
  // Unsubscribe one canvas, other should remain
  connectionManager.unsubscribeCanvas(canvas1);
  const remainingCanvases = connectionManager.getCanvasesForSymbol(symbol);
  expect(remainingCanvases).not.toContain(canvas1);
  expect(remainingCanvases).toContain(canvas2);
});
```

#### 1.2 Data Caching Tests

```javascript
// Test: symbol data is cached
test('symbol data is cached', async () => {
  const symbol = 'EURUSD';
  
  // First call should fetch data
  const data1 = await connectionManager.getSymbolData(symbol);
  expect(connectionManager.symbolDataCache.has(symbol)).toBe(true);
  
  // Second call should return cached data
  const data2 = await connectionManager.getSymbolData(symbol);
  expect(data1).toBe(data2);
});

// Test: cache is cleared on mode change
test('cache is cleared on mode change', async () => {
  const symbol = 'EURUSD';
  
  await connectionManager.getSymbolData(symbol);
  expect(connectionManager.symbolDataCache.has(symbol)).toBe(true);
  
  connectionManager.handleDataSourceModeChange('simulated');
  expect(connectionManager.symbolDataCache.has(symbol)).toBe(false);
});
```

### 2. Symbol Selection Workflow Tests

#### 2.1 Enter Key Support Tests

```javascript
// Test: Enter key creates canvas
test('Enter key creates canvas', async () => {
  const symbolSelector = new FXSymbolSelector();
  const canvasCreatedPromise = new Promise(resolve => {
    symbolSelector.on('canvasCreated', resolve);
  });
  
  // Simulate typing symbol and pressing Enter
  await symbolSelector.handleInput({ target: { value: 'EUR' } });
  await symbolSelector.handleKeyDown({ 
    key: 'Enter', 
    preventDefault: () => {} 
  });
  
  const canvasData = await canvasCreatedPromise;
  expect(canvasData.symbol).toBe('EURUSD');
  expect(canvasData.config).toBeDefined();
  expect(canvasData.state).toBeDefined();
});
```

#### 2.2 Click-to-Create Tests

```javascript
// Test: Click on symbol creates canvas
test('click on symbol creates canvas', async () => {
  const symbolSelector = new FXSymbolSelector();
  const canvasCreatedPromise = new Promise(resolve => {
    symbolSelector.on('canvasCreated', resolve);
  });
  
  // Simulate clicking on symbol in dropdown
  await symbolSelector.handleSymbolSelect('EURUSD', true);
  
  const canvasData = await canvasCreatedPromise;
  expect(canvasData.symbol).toBe('EURUSD');
});
```

### 3. Canvas Creation Tests

#### 3.1 Live Data Tests

```javascript
// Test: Canvas receives live data after creation
test('canvas receives live data after creation', async () => {
  const app = new App();
  const canvasId = 'test-canvas-1';
  const symbol = 'EURUSD';
  
  // Create canvas
  const canvasData = await app.addFloatingCanvas(symbol, { x: 100, y: 100 });
  
  // Wait for data to be received
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Verify canvas has data
  const canvas = app.getCanvasById(canvasId);
  expect(canvas.state.currentPrice).toBeGreaterThan(0);
  expect(canvas.config).toBeDefined();
});
```

#### 3.2 Simulated Data Tests

```javascript
// Test: Canvas receives simulated data after creation
test('canvas receives simulated data after creation', async () => {
  // Switch to simulated mode
  dataSourceMode.set('simulated');
  
  const app = new App();
  const canvasId = 'test-canvas-1';
  const symbol = 'SIM-EURUSD';
  
  // Create canvas
  const canvasData = await app.addFloatingCanvas(symbol, { x: 100, y: 100 });
  
  // Wait for data to be received
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Verify canvas has data
  const canvas = app.getCanvasById(canvasId);
  expect(canvas.state.currentPrice).toBeGreaterThan(0);
  expect(canvas.config).toBeDefined();
});
```

### 4. Error Handling Tests

#### 4.1 Connection Failure Tests

```javascript
// Test: Connection failure shows error message
test('connection failure shows error message', async () => {
  const palette = new FloatingSymbolPalette();
  
  // Mock connection failure
  const originalSubscribe = subscribe;
  subscribe = jest.fn(() => {
    throw new Error('Connection failed');
  });
  
  // Try to create canvas
  await palette.handleCreateCanvas();
  
  // Verify error is shown
  expect(palette.createError).toBeDefined();
  expect(palette.createError.message).toContain('Connection failed');
  
  // Restore original function
  subscribe = originalSubscribe;
});
```

#### 4.2 Invalid Symbol Tests

```javascript
// Test: Invalid symbol shows error message
test('invalid symbol shows error message', async () => {
  const palette = new FloatingSymbolPalette();
  
  // Try to create canvas with invalid symbol
  palette.selectedSymbol = 'INVALID-SYMBOL';
  await palette.handleCreateCanvas();
  
  // Verify error is shown
  expect(palette.createError).toBeDefined();
  expect(palette.createError.message).toContain('INVALID-SYMBOL');
});
```

### 5. Performance Tests

#### 5.1 Multiple Canvases Test

```javascript
// Test: Performance with multiple canvases
test('performance with multiple canvases', async () => {
  const app = new App();
  const startTime = performance.now();
  
  // Create 20 canvases
  const promises = [];
  for (let i = 0; i < 20; i++) {
    promises.push(app.addFloatingCanvas('EURUSD', { x: i * 50, y: i * 30 }));
  }
  
  await Promise.all(promises);
  const endTime = performance.now();
  
  // Verify performance is acceptable (< 5 seconds)
  expect(endTime - startTime).toBeLessThan(5000);
  
  // Verify all canvases have data
  const canvases = app.getAllCanvases();
  expect(canvases.length).toBe(20);
  
  canvases.forEach(canvas => {
    expect(canvas.state.currentPrice).toBeGreaterThan(0);
  });
});
```

#### 5.2 Memory Usage Test

```javascript
// Test: Memory usage with multiple canvases
test('memory usage with multiple canvases', async () => {
  const app = new App();
  const initialMemory = performance.memory?.usedJSHeapSize || 0;
  
  // Create 20 canvases
  for (let i = 0; i < 20; i++) {
    await app.addFloatingCanvas('EURUSD', { x: i * 50, y: i * 30 });
  }
  
  const finalMemory = performance.memory?.usedJSHeapSize || 0;
  const memoryIncrease = finalMemory - initialMemory;
  
  // Verify memory usage is reasonable (< 100MB)
  expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
});
```

## End-to-End Tests

### 1. Complete Workflow Test

```javascript
// Test: Complete workflow from symbol selection to live data
test('complete workflow from symbol selection to live data', async () => {
  // Start with empty workspace
  const app = new App();
  app.clearWorkspace();
  
  // Select symbol using Enter key
  const palette = app.floatingSymbolPalette;
  await palette.handleSymbolSelect({ symbol: 'EURUSD', shouldSubscribe: true });
  
  // Wait for canvas creation
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Verify canvas exists
  const canvases = app.getAllCanvases();
  expect(canvases.length).toBe(1);
  expect(canvases[0].symbol).toBe('EURUSD');
  
  // Wait for data
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Verify canvas has live data
  expect(canvases[0].state.currentPrice).toBeGreaterThan(0);
});
```

### 2. Connection Recovery Test

```javascript
// Test: Connection recovery after failure
test('connection recovery after failure', async () => {
  const app = new App();
  
  // Create canvas
  await app.addFloatingCanvas('EURUSD', { x: 100, y: 100 });
  
  // Simulate connection failure
  wsStatus.set('error');
  
  // Wait for reconnection
  wsStatus.set('connected');
  
  // Verify canvas receives data after reconnection
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const canvases = app.getAllCanvases();
  expect(canvases[0].state.currentPrice).toBeGreaterThan(0);
});
```

## Test Execution Plan

### 1. Unit Tests
- Run during development
- Fast feedback (< 1 second)
- Focus on individual components

### 2. Integration Tests
- Run before commits
- Medium feedback (< 10 seconds)
- Focus on component interactions

### 3. End-to-End Tests
- Run before releases
- Longer feedback (< 30 seconds)
- Focus on complete workflows

### 4. Performance Tests
- Run weekly
- Monitor performance trends
- Focus on resource usage

## Test Automation

### 1. Continuous Integration

```yaml
# .github/workflows/test.yml
name: Test Connection Management

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run unit tests
      run: npm run test:unit
    
    - name: Run integration tests
      run: npm run test:integration
    
    - name: Run E2E tests
      run: npm run test:e2e
```

### 2. Test Scripts

```json
// package.json
{
  "scripts": {
    "test": "npm run test:unit && npm run test:integration",
    "test:unit": "jest src/data/ConnectionManager.test.js",
    "test:integration": "jest tests/integration/",
    "test:e2e": "playwright test tests/e2e/",
    "test:performance": "node tests/performance/run-tests.js",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

## Test Data Management

### 1. Mock WebSocket Server

```javascript
// tests/mocks/websocket-server.js
class MockWebSocketServer {
  constructor() {
    this.clients = new Set();
    this.symbols = new Set(['EURUSD', 'GBPUSD', 'USDJPY']);
  }
  
  simulateConnection() {
    // Simulate connection establishment
    setTimeout(() => {
      this.broadcast({ type: 'ready', availableSymbols: Array.from(this.symbols) });
    }, 100);
  }
  
  simulateTick(symbol, price) {
    this.broadcast({
      type: 'tick',
      symbol,
      bid: price,
      ask: price + 0.0001,
      timestamp: Date.now()
    });
  }
  
  broadcast(data) {
    this.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify(data));
      }
    });
  }
}
```

### 2. Test Fixtures

```javascript
// tests/fixtures/symbol-data.js
export const mockSymbolData = {
  EURUSD: {
    symbol: 'EURUSD',
    digits: 5,
    adr: 0.0085,
    todaysOpen: 1.08500,
    todaysHigh: 1.08750,
    todaysLow: 1.08250,
    projectedAdrHigh: 1.08925,
    projectedAdrLow: 1.08075,
    initialPrice: 1.08500,
    initialMarketProfile: []
  }
};
```

## Success Criteria

### 1. Functional Criteria
- [ ] All tests pass
- [ ] Live data appears in canvases within 2 seconds of creation
- [ ] Enter key creates canvas successfully
- [ ] Click-to-create works for all symbols
- [ ] Error messages display correctly

### 2. Performance Criteria
- [ ] Canvas creation takes < 1 second
- [ ] 20 canvases can be created in < 5 seconds
- [ ] Memory usage stays < 100MB with 20 canvases
- [ ] CPU usage stays < 50% with 20 canvases

### 3. User Experience Criteria
- [ ] Loading states display during creation
- [ ] Error messages are clear and actionable
- [ ] Workflow feels intuitive and responsive
- [ ] No visual glitches or delays

## Conclusion

This comprehensive testing plan ensures that the connection management improvements and symbol selection workflow enhancements are thoroughly validated. The combination of unit, integration, end-to-end, and performance tests will provide confidence in the reliability and performance of the new features.