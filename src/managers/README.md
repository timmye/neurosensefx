# Worker Management Module

## Overview

The `workerManager.js` module provides high-performance worker management for real-time FX trading data processing. This module is specifically designed to handle WebSocket communication, worker lifecycle management, and data distribution with trading-grade performance requirements.

## Key Features

### Trading-Grade Performance
- **Sub-100ms latency** from market data to visual display
- **Zero data loss** during active trading sessions
- **20+ concurrent displays** without performance degradation
- **Memory stability** during extended trading sessions
- **Automatic reconnection** for WebSocket reliability

### Core Responsibilities
- WebSocket worker creation and management per symbol/display
- Real-time data distribution to multiple displays
- Worker lifecycle management with comprehensive cleanup
- Data routing and dispatching with performance optimization
- Error handling and recovery mechanisms

## Architecture

### Class-Based Design
The module uses a modern JavaScript class-based architecture with:

```javascript
export class WorkerManager {
    // Core worker management
    async createWorkerForSymbol(symbol, displayId)
    async initializeWorker(symbol, displayId, initData)
    dispatchTickToWorker(symbol, tick)

    // WebSocket integration
    dispatchTick(symbol, tickData)
    async createNewSymbol(symbol, data, addDisplayCallback)
    async updateExistingSymbol(symbol, data, findDisplayCallback)
    removeSymbol(symbol, findDisplaysCallback)

    // Configuration management
    updateWorkerConfig(symbol, displayId, configUpdate)
    broadcastConfigUpdate(configUpdate)

    // Performance and monitoring
    getWorkerStats()
    getMemoryUsage()
    configureOptimizations(options)
    cleanup()
}
```

### Singleton Pattern
The module exports a singleton instance for global worker management:

```javascript
import { workerManager } from './workerManager.js';
```

## Performance Optimizations

### 1. Worker Pooling
- Efficient resource utilization with configurable pool size
- Supports 20+ concurrent displays with buffer capacity
- Automatic worker creation and cleanup

### 2. Batch Dispatching
- Optimized tick distribution to multiple workers
- Reduces message passing overhead
- Maintains sub-100ms latency requirements

### 3. Memory Management
- Comprehensive cleanup to prevent memory leaks
- Memory usage monitoring with trend analysis
- Automatic resource recovery

### 4. Error Handling
- Graceful degradation for connection issues
- Automatic recovery mechanisms
- Comprehensive error logging and reporting

## Usage Examples

### Basic Worker Management

```javascript
import { workerManager } from './managers/workerManager.js';

// Create worker for new display
const worker = await workerManager.createWorkerForSymbol('EURUSD', 'display-1');

// Initialize worker with market data
await workerManager.initializeWorker('EURUSD', 'display-1', {
    digits: 5,
    bid: 1.1000,
    currentPrice: 1.1000,
    todaysOpen: 1.0900,
    projectedAdrHigh: 1.1100,
    projectedAdrLow: 1.0800
});
```

### Real-Time Data Processing

```javascript
// Process incoming WebSocket tick
workerManager.dispatchTick('EURUSD', {
    symbol: 'EURUSD',
    bid: 1.1005,
    ask: 1.1008,
    timestamp: Date.now()
});
```

### Symbol Management

```javascript
// Create new symbol with display
const displayId = await workerManager.createNewSymbol('GBPUSD', initData, (symbol, position) => {
    return addDisplay(symbol, position);
});

// Update existing symbol
await workerManager.updateExistingSymbol('GBPUSD', freshData, (symbol) => {
    return findDisplayBySymbol(symbol);
});

// Remove symbol and cleanup
workerManager.removeSymbol('GBPUSD', (symbol) => {
    return findDisplaysBySymbol(symbol);
});
```

### Configuration Management

```javascript
// Update single worker configuration
workerManager.updateWorkerConfig('EURUSD', 'display-1', {
    volatilitySmoothing: 0.8,
    priceBucketMultiplier: 1.5
});

// Broadcast configuration to all workers
workerManager.broadcastConfigUpdate({
    volatilitySmoothing: 0.8,
    priceBucketMultiplier: 1.5
});
```

### Performance Monitoring

```javascript
// Get current performance statistics
const stats = workerManager.getWorkerStats();
console.log('Active workers:', stats.activeWorkers);
console.log('Average latency:', `${stats.averageLatency.toFixed(2)}ms`);

// Monitor memory usage
const memoryUsage = workerManager.getMemoryUsage();
if (memoryUsage.available) {
    console.log('Memory usage:', `${(memoryUsage.current / memoryUsage.total * 100).toFixed(1)}%`);
}
```

### Performance Optimization

```javascript
// Configure optimizations for specific trading scenarios
workerManager.configureOptimizations({
    batchDispatching: true,      // Enable for multiple displays
    memoryOptimization: true,    // Enable for extended sessions
    performanceMonitoring: false // Disable for production (reduces overhead)
});
```

## Integration with DisplayStore

The workerManager is designed to integrate seamlessly with the displayStore decomposition:

```javascript
// In displayStore.js
import { workerManager } from '../managers/workerManager.js';

export const displayActions = {
    // Replace original worker methods with workerManager calls
    createWorkerForSymbol: (symbol, displayId) =>
        workerManager.createWorkerForSymbol(symbol, displayId),

    initializeWorker: (symbol, displayId, initData) =>
        workerManager.initializeWorker(symbol, displayId, initData),

    dispatchTickToWorker: (symbol, tick) =>
        workerManager.dispatchTickToWorker(symbol, tick),

    dispatchTick: (symbol, tickData) =>
        workerManager.dispatchTick(symbol, tickData)
};
```

## Error Handling and Recovery

### Automatic Recovery
- Connection health monitoring with 30-second intervals
- Exponential backoff for reconnection attempts
- Worker pool cleanup and regeneration

### Error Categories
1. **Worker Creation Errors** - Handled with retry logic
2. **Initialization Errors** - Worker termination and recreation
3. **Runtime Errors** - Worker isolation and cleanup
4. **Dispatch Errors** - Individual worker handling
5. **Critical Errors** - Emergency recovery procedures

### Logging Strategy
- Comprehensive error logging with context
- Performance metrics collection (outside critical path)
- Memory usage tracking and trend analysis

## Testing

The module includes comprehensive testing in `workerManager.test.js`:

```javascript
import { testWorkerManager } from './managers/workerManager.test.js';

// Run all tests
const results = await testWorkerManager();
console.log('Test results:', results);
```

### Test Categories
1. **Basic Functionality** - Worker creation and initialization
2. **Performance Tests** - Latency and throughput validation
3. **Error Handling** - Graceful degradation testing
4. **Memory Management** - Leak prevention and cleanup
5. **Optimization** - Batch processing and efficiency

## Performance Requirements

### Latency Requirements
- **Sub-100ms latency** from data to visual display
- **Average latency** under 50ms for optimal trading performance
- **Maximum acceptable latency** 100ms for real-time trading

### Throughput Requirements
- **20+ concurrent displays** without performance degradation
- **1000+ ticks/second** processing capability
- **Zero data loss** during high-frequency trading

### Memory Requirements
- **Stable memory usage** during extended trading sessions
- **Automatic cleanup** to prevent memory leaks
- **Memory monitoring** with trend analysis

## Browser Compatibility

The module requires modern browser features:
- **Web Workers API** - For background processing
- **Performance API** - For latency measurement
- **Map/Set Collections** - For efficient data structures
- **ES6 Modules** - For modern import/export syntax

## Best Practices

1. **Initialize Early** - Create workers before market data arrives
2. **Monitor Performance** - Use built-in metrics for optimization
3. **Handle Cleanup** - Always call cleanup() when done
4. **Configure Optimizations** - Adjust based on trading scenarios
5. **Monitor Memory** - Watch for memory leaks during extended sessions

## Migration Notes

This module extracts worker management functionality from the monolithic `displayStore.js`. Key changes:

1. **Extracted Functions**: All worker-related methods moved to dedicated class
2. **Enhanced Performance**: Added comprehensive optimizations and monitoring
3. **Improved Error Handling**: Better error recovery and reporting
4. **Memory Management**: Enhanced cleanup and leak prevention
5. **Testing**: Comprehensive test suite for validation

## Future Enhancements

1. **WebSockets Integration** - Direct WebSocket connection management
2. **Worker Pooling** - Advanced pooling strategies for efficiency
3. **Load Balancing** - Intelligent worker distribution
4. **Persistence** - Worker state recovery after browser refresh
5. **Analytics** - Advanced performance analytics and reporting