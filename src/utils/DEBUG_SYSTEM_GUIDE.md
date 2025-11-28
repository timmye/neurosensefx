# NeuroSense FX Debug Configuration System

## Overview

The NeuroSense FX Debug Configuration System provides comprehensive debug visibility in development while maintaining zero performance impact in production. It follows the core design principles: **Simple, Performant, Maintainable**.

## Features

### 🔧 Environment-Aware Debug Control
- **Automatic environment detection** using existing `environmentUtils.js`
- **Development mode**: Full debug visibility with rich formatting
- **Production mode**: Zero overhead with optional critical error logging
- **Runtime configuration updates** without application restart

### 📊 Category-Based Debug Management
- **13 specialized debug categories** for granular control
- **5 debug levels** from NONE to TRACE
- **Runtime category level adjustment**
- **Hierarchical logging** with level inheritance

### ⚡ Performance-Conscious Logging
- **Minimal overhead** in production (< 1ms for all operations)
- **Smart data truncation** for large objects
- **Circular reference handling** for complex data structures
- **Emoji-based visual classification** for quick scanning

### 🛡️ Production Safety
- **Zero debug overhead** when disabled
- **Emergency shutdown** capability
- **Configuration validation** with detailed reporting
- **Fallback mechanisms** for graceful degradation

## Quick Start

```javascript
import { debug, DebugCategories, DebugLevels } from './utils/debugConfig.js';

// Basic usage
debug.debug(DebugCategories.CANVAS, 'Canvas initialized', { width: 800, height: 600 });
debug.info(DebugCategories.PERFORMANCE, 'Performance monitoring started');
debug.warn(DebugCategories.CONFIG, 'Missing configuration key');
debug.error(DebugCategories.WORKER, 'WebSocket connection failed', { error: 'timeout' });

// Category control
debug.setLevel(DebugCategories.INTERACTION, DebugLevels.TRACE); // Maximum detail
debug.setLevel(DebugCategories.INTERACTION, DebugLevels.NONE);  // Disable completely

// Performance measurement
const timer = debug.timer('data-processing');
// ... do work ...
const duration = timer(); // Automatically logs performance data

const result = debug.measure(expensiveFunction, 'calculation'); // Auto-measured
```

## Debug Categories

| Category | Emoji | Use Case | Default Dev Level | Default Prod Level |
|----------|-------|----------|------------------|-------------------|
| `CANVAS` | 🎨 | Canvas rendering, DPR management | DEBUG | NONE |
| `VISUALIZATION` | 📊 | Visualization import/validation | INFO | NONE |
| `STATE` | 🔄 | State changes, store updates | WARN | NONE |
| `PERFORMANCE` | ⚡ | FPS monitoring, bottlenecks | DEBUG | NONE |
| `WORKER` | 🔧 | WebSocket communication | INFO | ERROR |
| `DISPLAY` | 🖼️ | Display lifecycle management | DEBUG | NONE |
| `CONFIG` | ⚙️ | Configuration management | WARN | NONE |
| `STORAGE` | 💾 | Local storage operations | INFO | NONE |
| `NETWORK` | 🌐 | HTTP requests, API calls | INFO | ERROR |
| `INTERACTION` | ⌨️ | User interactions, shortcuts | DEBUG | NONE |
| `COMPONENT` | 🧩 | Component lifecycle | WARN | NONE |
| `MEMORY` | 🧠 | Memory usage, garbage collection | INFO | NONE |

## Debug Levels

| Level | Value | Description | Typical Use |
|-------|-------|-------------|-------------|
| `NONE` | 0 | No output | Production optimization |
| `ERROR` | 1 | Critical errors only | Production error tracking |
| `WARN` | 2 | Errors + warnings | Development warnings |
| `INFO` | 3 | Errors + warnings + important info | Key application events |
| `DEBUG` | 4 | All development output | Detailed development debugging |
| `TRACE` | 5 | Maximum detail | Performance profiling |

## Specialized Debug Helpers

### Canvas Debugging
```javascript
debug.canvas('render', {
  width: 800,
  height: 600,
  dpr: 2
}, 16.67); // Duration in ms
```

### Performance Debugging
```javascript
debug.performance('frame-render', 25.5, {
  fps: 60,
  displays: 4,
  isSlow: true // Auto-detected if > 16.67ms
});
```

### State Debugging
```javascript
debug.state('displayStore', 'add-display', {
  displayId: 'display-123',
  symbol: 'EURUSD',
  type: 'marketProfile'
});
```

### Worker Debugging
```javascript
debug.worker('sent', 'subscribe-symbol', {
  symbol: 'EURUSD',
  timeframe: 'm1'
});
// Payload automatically included if < 1KB
```

### Display Debugging
```javascript
debug.display('create', 'display-456', {
  type: 'volatility-orb',
  config: { size: 'large', theme: 'dark' }
});
```

## Performance Measurement

### Timer Helper
```javascript
const timer = debug.timer('operation-name');
// ... do work ...
const duration = timer(); // Returns duration in ms
```

### Measure Helper
```javascript
const result = debug.measure(() => {
  // Expensive function
  return expensiveCalculation();
}, 'calculation'); // Optional operation name

// Automatically measures and logs performance
```

### Async Function Measurement
```javascript
const asyncResult = debug.measure(async () => {
  const data = await fetchData();
  return processData(data);
}, 'async-operation');
```

## Configuration Management

### Get Current Configuration
```javascript
const config = debug.getConfig();
console.log(config.enabled);        // true/false
console.log(config.categories);     // Category levels
console.log(config.formatting);     // Formatting options
```

### Update Configuration
```javascript
debug.updateConfig({
  enabled: true,
  formatting: {
    useTimestamps: true,
    maxDataLength: 500
  }
});
```

### Category Level Control
```javascript
// Enable detailed debugging for interactions
debug.setLevel(DebugCategories.INTERACTION, DebugLevels.TRACE);

// Disable verbose canvas debugging
debug.setLevel(DebugCategories.CANVAS, DebugLevels.ERROR);

// Check if category is enabled for a level
if (debug.isEnabled(DebugCategories.PERFORMANCE, DebugLevels.DEBUG)) {
  // Debug performance
}
```

## Production Safety Features

### Environment Detection
The system automatically detects the environment and applies appropriate settings:

- **Development**: Full debug capabilities with rich formatting
- **Production**: Minimal overhead with only critical error logging

### Configuration Validation
```javascript
const validation = debug.validate();
if (!validation.isValid) {
  console.warn('Debug configuration issues:', validation.issues);
}
```

### Emergency Shutdown
```javascript
debug.shutdown(); // Immediately disable all debug output
```

### System Status Monitoring
```javascript
const status = debug.status();
console.log(status.initialized); // true/false
console.log(status.enabled);     // true/false
console.log(status.environment); // 'development'/'production'
console.log(status.validation);  // Validation results
```

## Message Formatting

### Automatic Emoji Classification
- **🎨 Canvas**: Canvas and rendering operations
- **📊 Visualization**: Data visualization components
- **🔄 State**: State management and changes
- **⚡ Performance**: Performance monitoring and timing
- **🔧 Worker**: WebSocket and worker communication
- **🖼️ Display**: Display lifecycle and management
- **⚙️ Config**: Configuration and settings
- **💾 Storage**: Local storage operations
- **🌐 Network**: Network requests and API calls
- **⌨️ Interaction**: User interactions and shortcuts
- **🧩 Component**: Component lifecycle and rendering
- **🧠 Memory**: Memory usage and garbage collection

### Data Processing
- **Circular reference safe** - Handles complex object graphs
- **Size limiting** - Truncates large data to prevent console spam
- **JSON serialization** - Clean, readable output format
- **Error handling** - Graceful fallback for unserializable data

## Integration with Existing Code

### Backward Compatibility
The debug system maintains full compatibility with existing `debugLogger.js`:

```javascript
import { debugLog, warnLog, errorLog, createLogger } from './utils/debugLogger.js';

// Existing code continues to work
debugLog('WORKSPACE', 'Legacy debug message');
warnLog('CONFIG', 'Configuration warning');
errorLog('NETWORK', 'Network error', { status: 500 });

// Enhanced logger with new features
const logger = createLogger('CANVAS');
logger.debug('Canvas debug message');
logger.info('Canvas info message');
logger.timer('render-operation')(); // New timing feature
```

### Component Integration
```javascript
// Svelte component example
import { debug, DebugCategories } from '../utils/debugConfig.js';

export function createDisplay(type, symbol, config) {
  const timer = debug.timer('display-creation');

  try {
    debug.display('create-start', type, { symbol, config });

    const display = new Display(type, symbol, config);

    debug.display('create-complete', display.id, {
      type: display.type,
      symbol: display.symbol,
      config: display.config
    });

    return display;
  } catch (error) {
    debug.error(DebugCategories.DISPLAY, 'Display creation failed', {
      type,
      symbol,
      error: error.message
    });
    throw error;
  } finally {
    timer();
  }
}
```

## Best Practices

### Development
1. **Use appropriate categories** - Don't put performance issues in CONFIG
2. **Set meaningful levels** - Use WARN for important warnings, DEBUG for detailed info
3. **Include context** - Add relevant data to debug messages
4. **Measure performance** - Use timer/measure helpers for critical paths
5. **Test with all levels** - Ensure your debug output is useful at different verbosity levels

### Production
1. **Keep critical errors** - Use ERROR level for production-critical issues
2. **Validate configuration** - Check debug.validate() in development
3. **Monitor performance** - Ensure debug doesn't impact trading performance
4. **Use emergency shutdown** - Have a way to disable debug if needed

### Performance Guidelines
- **Keep operations under 16.67ms** (60fps target)
- **Avoid large data logging** in hot paths
- **Use appropriate levels** to reduce noise
- **Leverage built-in performance helpers**
- **Monitor debug overhead** in development

## Examples and Testing

Run the debug examples to see the system in action:

```javascript
import { runAllExamples } from './utils/debugExample.js';
runAllExamples();
```

This demonstrates:
- Basic debug usage
- Specialized helpers
- Performance measurement
- Configuration management
- Production safety
- Real code integration

## Files

- `/src/utils/debugConfig.js` - Main debug configuration system
- `/src/utils/debugLogger.js` - Enhanced backward-compatible logger
- `/src/utils/debugConfig.test.js` - Comprehensive test suite
- `/src/utils/debugExample.js` - Usage examples and demonstrations
- `/src/utils/DEBUG_SYSTEM_GUIDE.md` - This documentation

## Troubleshooting

### Debug not appearing
1. Check if system is initialized: `debug.status().initialized`
2. Verify category is enabled: `debug.isEnabled(category, level)`
3. Check environment: `debug.status().environment`

### Performance impact
1. Reduce debug levels for noisy categories
2. Use debug.updateConfig() to optimize formatting
3. Monitor with debug.validate() for issues

### Integration issues
1. Ensure proper import path for debugConfig.js
2. Check environment utils are working correctly
3. Verify existing debugLogger.js compatibility

---

**NeuroSense FX Debug Configuration System** - Comprehensive development visibility with zero production impact.