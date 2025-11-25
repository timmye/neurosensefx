# NeuroSense FX Logging and Monitoring

**Purpose**: Defines comprehensive logging and monitoring approaches for NeuroSense FX development, ensuring visibility of build errors, browser logs, and service status.

## Service Management Monitoring

### **run.sh Script Visibility**
The `run.sh` script provides comprehensive service monitoring with color-coded output:

```bash
# Service status monitoring
./run.sh status        # Shows all service statuses
./run.sh logs          # Displays service logs
./run.sh env-status    # Environment configuration status

# Service startup with detailed logging
./run.sh dev           # Development mode with verbose output
./run.sh start         # Production mode with error monitoring
```

#### **Service Status Indicators**
- ✅ **Green**: Service running successfully
- ❌ **Red**: Service failed to start or stopped
- ⚠️ **Yellow**: Service warnings or degraded performance
- 🔵 **Blue**: Production mode services

#### **Log File Locations**
- `backend.log` - WebSocket backend service logs
- `frontend.log` - Vite development server logs
- Console output - Real-time service status

## Build Error Monitoring

### **Vite Build System Visibility**
Vite configuration provides comprehensive build error reporting:

```javascript
// vite.config.js - Error monitoring setup
export default defineConfig({
  server: {
    hmr: {
      overlay: true,        // Shows build errors in browser
    },
    watch: {
      usePolling: true,     // Detects file changes reliably
      interval: 100,
    }
  }
});
```

#### **Build Error Sources**
1. **Svelte Compilation Errors**: Component syntax and structure issues
2. **JavaScript Import Errors**: Module resolution and dependency issues
3. **CSS/Style Errors**: Styling and asset loading problems
4. **TypeScript Errors**: Type checking and interface issues (if using TS)

#### **Accessing Build Errors**
```bash
# Development build errors (visible in browser overlay)
npm run dev               # Build errors shown in browser overlay
npm run dev:prod          # Production build mode errors

# Production build errors
npm run build             # Command line build error reporting
npm run build:prod        # Production build with error details
```

## Browser Console Monitoring

### **Comprehensive Console Log Capture**
Tests capture all browser console activity for debugging and validation:

#### **Console Message Types Captured**
```javascript
// Complete console monitoring setup
page.on('console', msg => {
  consoleMessages.push({
    type: msg.type(),        // 'log', 'error', 'warn', 'info'
    text: msg.text(),        // Full message text
    location: msg.location(), // Source file and line number
    timestamp: new Date().toISOString()
  });
});

// Error monitoring
page.on('pageerror', error => {
  consoleMessages.push({
    type: 'error',
    text: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
});
```

#### **Key Console Patterns for NeuroSense FX**
```javascript
// WebSocket connection monitoring
const wsPatterns = [
  'WebSocket',              // Connection establishment
  'ws://localhost:8080',    // Backend connection URL
  'ws://localhost:8081',    // Production backend URL
  'connected',              // Connection success
  'disconnected',           // Connection loss
  'reconnect',              // Reconnection attempts
  'symbol data',            // Market data received
  'market update',          // Price updates
  'tick data'               // Real-time price changes
];

// Application state monitoring
const appPatterns = [
  'displayStore',           // Display management
  'symbol palette',         // UI component state
  'canvas rendering',       // Visualization updates
  'keyboard shortcut',      // User interactions
  'performance',            // Performance metrics
  'memory usage',           // Memory monitoring
  'configuration',          // Settings changes
];

// Error patterns to monitor
const errorPatterns = [
  'Error:',                 // JavaScript errors
  'Failed to',              // Operation failures
  'Cannot read',            // Undefined property errors
  'Network error',          // Connection issues
  'Timeout',                // Operation timeouts
];
```

### **Real-Time Log Analysis**

#### **WebSocket Connection Validation**
```javascript
// Verify WebSocket connection establishment
const validateWebSocketConnection = (consoleMessages) => {
  const wsMessages = consoleMessages.filter(msg =>
    wsPatterns.some(pattern => msg.text.includes(pattern))
  );

  return {
    hasConnection: wsMessages.some(msg =>
      msg.text.includes('connected') || msg.text.includes('ws://localhost')
    ),
    hasData: wsMessages.some(msg =>
      msg.text.includes('symbol') || msg.text.includes('market')
    ),
    connectionEvents: wsMessages,
    errorCount: wsMessages.filter(msg => msg.type === 'error').length
  };
};
```

#### **Performance Monitoring**
```javascript
// Capture performance-related console output
const monitorPerformance = (consoleMessages) => {
  const perfMessages = consoleMessages.filter(msg =>
    msg.text.includes('performance') ||
    msg.text.includes('response time') ||
    msg.text.includes('rendering')
  );

  return {
    performanceEvents: perfMessages,
    hasWarnings: perfMessages.some(msg => msg.type === 'warn'),
    hasErrors: perfMessages.some(msg => msg.type === 'error')
  };
};
```

## Error Logging Integration

### **Service Error Visibility**

#### **Backend WebSocket Service**
```bash
# Monitor backend service errors
./run.sh logs              # Shows all service logs
tail -f backend.log        # Real-time backend monitoring
```

**Backend Error Patterns:**
- WebSocket connection failures
- cTrader API integration issues
- Symbol data retrieval problems
- Port binding conflicts (8080/8081)

#### **Frontend Development Server**
```bash
# Monitor frontend build errors
npm run dev                # Shows build errors in real-time
tail -f frontend.log       # Continuous build monitoring
```

**Frontend Error Patterns:**
- Module resolution failures
- Svelte compilation errors
- Asset loading issues
- HMR (Hot Module Reload) problems

## Browser DevTools Integration

### **Network Tab Monitoring**
Tests can capture network activity for comprehensive debugging:

```javascript
// Network request monitoring
const networkRequests = [];
page.on('request', request => {
  networkRequests.push({
    url: request.url(),
    method: request.method(),
    timestamp: new Date().toISOString()
  });
});

page.on('response', response => {
  networkRequests.push({
    url: response.url(),
    status: response.status(),
    timestamp: new Date().toISOString()
  });
});
```

### **Performance Tab Monitoring**
```javascript
// Performance metrics collection
const performanceMetrics = await page.evaluate(() => {
  const navigation = performance.getEntriesByType('navigation')[0];

  return {
    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
    loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
    firstPaint: performance.getEntriesByType('paint')[0]?.startTime,
    firstContentfulPaint: performance.getEntriesByType('paint')[1]?.startTime,
    memoryUsage: performance.memory ? {
      used: performance.memory.usedJSHeapSize,
      total: performance.memory.totalJSHeapSize,
      limit: performance.memory.jsHeapSizeLimit
    } : null
  };
});
```

## Logging Best Practices

### **Development Environment Logging**
```bash
# Start development with maximum visibility
./run.sh dev              # Color-coded service status
npm run test:e2e:headed   # Visible browser with console
npm run test:e2e:debug    # Interactive debugging mode
```

### **Test Execution Logging**
```javascript
// Comprehensive test logging setup
test.beforeEach(async ({ page }) => {
  // Setup console monitoring
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location(),
      timestamp: new Date().toISOString()
    });
  });

  // Store messages for test analysis
  page.consoleMessages = consoleMessages;
});

test.afterEach(async ({ page }, testInfo) => {
  // Log test results with console output
  if (testInfo.status !== 'passed') {
    console.log(`❌ Test failed: ${testInfo.title}`);
    console.log('Console messages:', page.consoleMessages);

    // Attach console logs to test report
    await testInfo.attach('console-logs', {
      body: JSON.stringify(page.consoleMessages, null, 2),
      contentType: 'application/json'
    });
  }
});
```

### **Production Monitoring**
```bash
# Production environment monitoring
./run.sh start            # Production services
./run.sh status           # Check all service health
./run.sh logs             # View production logs
```

## Error Recovery and Debugging

### **Service Recovery Commands**
```bash
# Service recovery procedures
./run.sh stop             # Stop all services
./run.sh start            # Restart services
./run.sh status           # Verify recovery

# Environment-specific recovery
./run.sh dev              # Restart development environment
./run.sh start            # Restart production environment
```

### **Build Error Resolution**
```bash
# Clear build cache and rebuild
rm -rf node_modules/.vite  # Clear Vite cache
npm run dev                # Restart with clean build

# Dependency issues
npm install               # Reinstall dependencies
npm run build             # Test production build
```

### **Browser Error Debugging**
```javascript
// Debug browser errors with detailed information
const debugBrowserErrors = async (page) => {
  const errors = [];

  page.on('pageerror', error => {
    errors.push({
      message: error.message,
      stack: error.stack,
      name: error.name
    });
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push({
        message: msg.text(),
        location: msg.location()
      });
    }
  });

  return errors;
};
```

## Integration with Skills System

This logging skill integrates with other skills to provide:
- **TESTING_PROTOCOL**: Service status verification
- **EVIDENCE_STANDARDS**: Console log evidence collection
- **APPLICATION_TESTING**: Real-time browser monitoring
- **PERFORMANCE_VALIDATION**: Performance metric logging
- **TESTING_FRAMEWORKS**: Test execution logging

Comprehensive logging ensures complete visibility of all system components during development, testing, and production operation.