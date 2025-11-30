# Playwright Browser Console Log Visibility Guide

## 🎯 Overview

Yes! Playwright offers **excellent browser console log visibility**. The test results above demonstrate comprehensive console monitoring capabilities.

## 📊 What's Available

### ✅ **Built-in Console Monitoring**
- **Real-time console output** with emoji classification
- **Error tracking** with stack traces and locations
- **WebSocket connection monitoring**
- **Network request/response logging**
- **Performance metrics capture**

### ✅ **Message Classification**
```
📝 LOG: General console.log messages
ℹ️ INFO: Console.info messages
⚠️ WARN: Console.warning messages
❌ ERROR: Console.error and page errors
🐛 DEBUG: Debug messages
📁 DIR: Console.dir output
📊 TABLE: Console.table output
⏱️ TIME: Performance timing
🔍 TRACE: Stack traces
```

## 🛠️ Usage Examples

### **1. Basic Console Monitoring**
```javascript
import { test, expect } from '@playwright/test';

test('monitor console', async ({ page }) => {
  page.on('console', msg => {
    console.log(`${msg.type().toUpperCase()}: ${msg.text()}`);
  });

  await page.goto('http://localhost:5175');
  // All console output now visible in test runner
});
```

### **2. Error-Specific Monitoring**
```javascript
test('monitor errors only', async ({ page }) => {
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error(`❌ ERROR: ${msg.text()}`);
      if (msg.location()) {
        console.error(`   📍 ${msg.location().url}:${msg.location().lineNumber}`);
      }
    }
  });

  page.on('pageerror', error => {
    console.error('💥 PAGE ERROR:', error.message);
  });
});
```

### **3. WebSocket-Specific Monitoring**
```javascript
test('monitor websockets', async ({ page }) => {
  const wsMessages = [];

  page.on('console', msg => {
    if (msg.text().toLowerCase().includes('websocket')) {
      wsMessages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      });
    }
  });

  await page.goto('http://localhost:5175');

  console.log(`🔌 Found ${wsMessages.length} WebSocket messages:`);
  wsMessages.forEach(msg => {
    console.log(`   ${msg.type}: ${msg.text}`);
  });
});
```

## 🔧 Running Console Tests

### **Run the Enhanced Console Test**
```bash
# Using npm scripts (recommended)
npm run test:console             # Comprehensive console logging analysis
npm run test:console:headed      # Console monitoring with visible browser
npm run test:console:ui          # Interactive console debugging with UI
```

### **Run with UI Mode for Live Debugging**
```bash
npm run test:ui                  # Standard Playwright UI mode
npm run test:console:ui          # Console debugging with UI mode
```

## 📋 Current Console Output Analysis

### **What We Can See in Your Application:**

1. **🔗 WebSocket Connection Status**
   ```
   ❌ WebSocket connection to 'ws://localhost:8081/' failed: Connection refused
   ❌ WebSocket error: Event
   ```

2. **🖼️ Canvas Rendering Events**
   ```
   📝 [SYSTEM ERROR] Canvas display: SYSTEM ERROR: ERROR: EURUSD with canvas size: {width: 300, height: 140}
   📝 [SYSTEM ERROR] Canvas display: SYSTEM ERROR: DISCONNECTED: EURUSD with canvas size: {width: 300, height: 140}
   ```

3. **🌐 Network Activity**
   ```
   📤 GET http://localhost:5175/
   📥 200 http://localhost:5175/
   📤 GET http://localhost:5175/main.js?t=...
   ```

4. **🐛 Vite Development Server**
   ```
   🐛 DEBUG: [vite] connecting...
   🐛 DEBUG: [vite] connected.
   ```

## 🚀 Advanced Features

### **Message Location Tracking**
```javascript
page.on('console', msg => {
  if (msg.location()) {
    console.log(`📍 Source: ${msg.location().url}:${msg.location().lineNumber}`);
  }
});
```

### **Console Arguments Capture**
```javascript
page.on('console', msg => {
  // Access raw console arguments
  const args = msg.args();
  for (const arg of args) {
    console.log('🔧 Arg:', await arg.jsonValue());
  }
});
```

### **Filter by Message Pattern**
```javascript
page.on('console', msg => {
  const text = msg.text();

  // Filter for specific patterns
  if (text.includes('CONNECTION MANAGER') ||
      text.includes('SYSTEM ERROR') ||
      text.includes('WebSocket')) {
    console.log(`🎯 FILTERED: ${text}`);
  }
});
```

## 📊 Benefits for Debugging

1. **✅ Complete Visibility**: See every console message from the browser
2. **✅ Error Context**: Get exact file locations and line numbers
3. **✅ WebSocket Debugging**: Monitor connection status in real-time
4. **✅ Network Monitoring**: Track all HTTP requests and responses
5. **✅ Timestamp Tracking**: Know exactly when events occurred
6. **✅ Message Classification**: Visual indicators for different message types

## 🎯 Best Practices

1. **Use emoji indicators** for quick visual scanning
2. **Filter messages** to focus on what's important
3. **Capture timestamps** for debugging timing issues
4. **Monitor WebSocket connections** separately for connection issues
5. **Use location information** to find source code problems

## 🔍 Current Issues Identified

Based on the console output, I can see:

1. **WebSocket Connection Problem**: App trying to connect to port 8081, backend likely on 8080
2. **Canvas Error Handling**: Good error display when WebSocket is disconnected
3. **Environment Detection**: The port configuration needs adjustment

The enhanced console logging provides **complete visibility** into what's happening in the browser, making debugging much easier!