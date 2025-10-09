# NeuroSense FX - Data Layer API Documentation

## Overview

The NeuroSense FX data layer provides a robust, high-performance foundation for real-time financial data processing. This document outlines the complete API surface, architecture patterns, and usage guidelines for all data layer components.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
├─────────────────────────────────────────────────────────────┤
│                    State Management                         │
├─────────────────────────────────────────────────────────────┤
│                    Data Layer API                           │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│  │ WebSocket       │ │ Data Processor  │ │ Cache Manager   │ │
│  │ Manager         │ │                 │ │                 │ │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘ │
│  ┌─────────────────┐                                         │
│  │ Subscription    │                                         │
│  │ Manager         │                                         │
│  └─────────────────┘                                         │
├─────────────────────────────────────────────────────────────┤
│                    WebSocket Backend                        │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. WebSocket Manager (`websocketManager.js`)

Manages WebSocket connections with automatic reconnection, message queuing, and health monitoring.

#### Class: `WebSocketManager`

##### Constructor Options
```javascript
const options = {
  url: 'ws://localhost:8080/ws',           // WebSocket URL
  reconnect: true,                          // Enable auto-reconnect
  maxReconnectAttempts: 5,                  // Max reconnection attempts
  reconnectDelay: 1000,                     // Initial reconnection delay (ms)
  reconnectBackoffMultiplier: 2,            // Backoff multiplier
  maxReconnectDelay: 30000,                 // Maximum reconnection delay
  pingInterval: 30000,                      // Ping interval (ms)
  connectionTimeout: 10000                  // Connection timeout (ms)
};
```

#### Public Methods

##### `async connect(): Promise<void>`
Establishes WebSocket connection with error handling and timeout.

```javascript
import { wsManager } from './data/websocketManager.js';

try {
  await wsManager.connect();
  console.log('Connected successfully');
} catch (error) {
  console.error('Connection failed:', error);
}
```

##### `disconnect(): void`
Closes WebSocket connection and disables reconnection.

```javascript
wsManager.disconnect();
```

##### `send(data: object|string): boolean`
Sends message through WebSocket. Returns `true` if sent, `false` if queued.

```javascript
const message = {
  type: 'subscribe',
  symbols: ['EURUSD', 'GBPUSD']
};

const sent = wsManager.send(message);
if (!sent) {
  console.log('Message queued (disconnected)');
}
```

##### `isConnected(): boolean`
Returns current connection status.

##### `getStats(): ConnectionStats`
Returns comprehensive connection statistics.

```javascript
const stats = wsManager.getStats();
console.log('Connected:', stats.connected);
console.log('Uptime:', stats.metrics.connectionUptime);
console.log('Queued messages:', stats.queuedMessages);
```

#### Events

The WebSocket Manager emits the following events:

```javascript
// Connection events
wsManager.on('open', () => console.log('Connected'));
wsManager.on('close', (event) => console.log('Disconnected:', event));
wsManager.on('error', (error) => console.error('Connection error:', error));

// Message events
wsManager.on('message', (data) => {
  console.log('Received:', data);
  // Handle incoming data
});
```

#### Reactive Stores

```javascript
import { connectionState, isConnected, connectionMetrics } from './data/websocketManager.js';

// Subscribe to connection state
connectionState.subscribe(state => {
  console.log('Connection state:', state); // 'disconnected', 'connecting', 'connected', 'error'
});

// Subscribe to connection status
isConnected.subscribe(connected => {
  console.log('Is connected:', connected);
});

// Subscribe to connection metrics
connectionMetrics.subscribe(metrics => {
  console.log('Connection uptime:', metrics.connectionUptime);
});
```

---

### 2. Data Processor (`dataProcessor.js`)

Handles real-time data validation, normalization, aggregation, and quality monitoring.

#### Class: `DataProcessor`

##### Constructor Options
```javascript
const options = {
  bufferSize: 1000,                         // Tick buffer size per symbol
  aggregationWindow: 60000,                 // Aggregation window (ms)
  performanceMonitoring: true,              // Enable performance tracking
  dataValidation: true                      // Enable data validation
};
```

#### Public Methods

##### `processTick(rawTick: object): ProcessedTick|null`
Processes incoming tick data with validation and quality checks.

```javascript
import { dataProcessor } from './data/dataProcessor.js';

const tick = {
  symbol: 'EURUSD',
  bid: 1.1234,
  ask: 1.1236,
  timestamp: Date.now()
};

const processed = dataProcessor.processTick(tick);
if (processed) {
  console.log('Processed tick:', {
    price: processed.price,
    direction: processed.direction,
    magnitude: processed.magnitude
  });
}
```

##### `getRecentTicks(symbol: string, count?: number): ProcessedTick[]`
Returns recent ticks for a symbol.

```javascript
const recentTicks = dataProcessor.getRecentTicks('EURUSD', 100);
console.log(`Recent ${recentTicks.length} ticks for EURUSD`);
```

##### `getAggregatedData(symbol: string): AggregatedData|null`
Returns aggregated data for a symbol.

```javascript
const aggregated = dataProcessor.getAggregatedData('EURUSD');
if (aggregated) {
  console.log('Aggregated data:', {
    tickCount: aggregated.tickCount,
    volatility: aggregated.volatility,
    high: aggregated.high,
    low: aggregated.low
  });
}
```

##### `calculateIndicators(symbol: string, indicators: string[]): object|null`
Calculates technical indicators for a symbol.

```javascript
const indicators = dataProcessor.calculateIndicators('EURUSD', ['sma', 'ema', 'rsi']);
if (indicators) {
  console.log('SMA (20):', indicators.sma);
  console.log('EMA (20):', indicators.ema);
  console.log('RSI (14):', indicators.rsi);
}
```

##### `processHistoricalData(symbol: string, bars: object[]): HistoricalBar[]`
Validates and processes historical bar data.

```javascript
const bars = [
  { open: 1.1234, high: 1.1238, low: 1.1232, close: 1.1236, timestamp: Date.now() },
  // ... more bars
];

const processedBars = dataProcessor.processHistoricalData('EURUSD', bars);
console.log(`Processed ${processedBars.length} historical bars`);
```

##### `getDataQualityReport(): DataQualityReport`
Returns comprehensive data quality metrics.

```javascript
const quality = dataProcessor.getDataQualityReport();
console.log('Data quality:', {
  totalGaps: quality.totalGaps,
  duplicateTicks: quality.duplicateTicks,
  priceAnomalies: quality.priceAnomalies
});
```

##### `getPerformanceStats(): PerformanceStats`
Returns processing performance statistics.

```javascript
const stats = dataProcessor.getPerformanceStats();
console.log('Performance:', {
  totalTicks: stats.totalTicks,
  averageProcessingTime: stats.averageProcessingTime,
  bufferUtilization: stats.bufferUtilization
});
```

#### Reactive Stores

```javascript
import { processingMetrics, dataQualityMetrics } from './data/dataProcessor.js';

// Processing metrics
processingMetrics.subscribe(metrics => {
  console.log('Ticks per second:', metrics.ticksPerSecond);
  console.log('Average processing time:', metrics.averageProcessingTime);
});

// Data quality metrics
dataQualityMetrics.subscribe(metrics => {
  console.log('Data gaps detected:', metrics.gaps.length);
  console.log('Duplicate ticks:', metrics.duplicateTicks);
});
```

---

### 3. Subscription Manager (`subscriptionManager.js`)

Manages symbol subscriptions with intelligent batching, rate limiting, and retry logic.

#### Class: `SubscriptionManager`

##### Constructor Options
```javascript
const options = {
  batchSize: 10,                            // Symbols per batch
  batchDelay: 100,                          // Batch delay (ms)
  maxConcurrentRequests: 3,                 // Max concurrent requests
  rateLimitDelay: 1000,                     // Rate limit delay (ms)
  subscriptionTimeout: 10000,               // Subscription timeout (ms)
  maxRetries: 3,                            // Max retry attempts
  retryBackoffMultiplier: 2                 // Retry backoff multiplier
};
```

#### Public Methods

##### `async subscribe(symbol: string, options?: object): Promise<Subscription>`
Subscribes to a single symbol with intelligent batching.

```javascript
import { subscriptionManager } from './data/subscriptionManager.js';

try {
  const subscription = await subscriptionManager.subscribe('EURUSD', {
    adrLookbackDays: 14
  });
  console.log('Subscribed to:', subscription.symbol);
} catch (error) {
  console.error('Subscription failed:', error);
}
```

##### `async subscribeMultiple(symbols: string[], options?: object): Promise<SubscriptionResult[]>`
Subscribes to multiple symbols with automatic batching.

```javascript
const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD'];
const results = await subscriptionManager.subscribeMultiple(symbols);

results.forEach(result => {
  if (result.error) {
    console.error(`Failed to subscribe to ${result.symbol}:`, result.error);
  } else {
    console.log(`Subscribed to ${result.symbol}`);
  }
});
```

##### `async unsubscribe(symbol: string): Promise<Subscription|null>`
Unsubscribes from a symbol.

```javascript
const unsubscribed = await subscriptionManager.unsubscribe('EURUSD');
if (unsubscribed) {
  console.log('Unsubscribed from EURUSD');
}
```

##### `async unsubscribeAll(): Promise<PromiseSettledResult[]>`
Unsubscribes from all active symbols.

```javascript
const results = await subscriptionManager.unsubscribeAll();
console.log(`Unsubscribed from ${results.length} symbols`);
```

##### `getSubscriptionStatus(symbol: string): Subscription|null`
Gets subscription status for a symbol.

```javascript
const status = subscriptionManager.getSubscriptionStatus('EURUSD');
if (status) {
  console.log('Subscription status:', status.status);
  console.log('Created at:', new Date(status.createdAt));
}
```

##### `getActiveSubscriptions(): SubscriptionInfo[]`
Returns all active subscriptions.

```javascript
const active = subscriptionManager.getActiveSubscriptions();
console.log(`Active subscriptions: ${active.length}`);
active.forEach(sub => {
  console.log(`- ${sub.symbol} (${sub.status})`);
});
```

##### `getStats(): SubscriptionStats`
Returns subscription statistics.

```javascript
const stats = subscriptionManager.getStats();
console.log('Subscription stats:', {
  total: stats.total,
  active: stats.active,
  pending: stats.pending,
  failed: stats.failed,
  averageSubscriptionTime: stats.averageSubscriptionTime
});
```

#### Events

```javascript
// Successful batch subscription
subscriptionManager.on('batchSuccess', (symbols) => {
  console.log('Batch subscription successful:', symbols);
});

// Failed batch subscription
subscriptionManager.on('batchError', ({ symbols, error }) => {
  console.error('Batch subscription failed:', symbols, error);
});
```

#### Reactive Stores

```javascript
import { subscriptionState, activeSubscriptionCount, subscriptionMetrics } from './data/subscriptionManager.js';

// Subscription state
subscriptionState.subscribe(state => {
  console.log('Active subscriptions:', state.activeSubscriptions.size);
  console.log('Pending subscriptions:', state.pendingSubscriptions.size);
});

// Active subscription count
activeSubscriptionCount.subscribe(count => {
  console.log('Active subscription count:', count);
});

// Subscription metrics
subscriptionMetrics.subscribe(metrics => {
  console.log('Successful subscriptions:', metrics.successfulSubscriptions);
  console.log('Average subscription time:', metrics.averageSubscriptionTime);
});
```

---

### 4. Cache Manager (`cacheManager.js`)

Provides high-performance in-memory caching with persistence, TTL, and intelligent eviction.

#### Class: `CacheManager`

##### Constructor Options
```javascript
const options = {
  maxMemoryUsage: 50 * 1024 * 1024,        // 50MB memory limit
  maxItems: 10000,                          // Max cache items
  defaultTTL: 300000,                       // 5 minutes default TTL
  cleanupInterval: 60000,                   // 1 minute cleanup interval
  persistence: true,                        // Enable localStorage persistence
  compression: false                        // Enable compression
};
```

#### Public Methods

##### `async set(key: string, data: any, options?: CacheOptions): Promise<boolean>`
Stores data in cache with optional TTL, priority, and tags.

```javascript
import { cacheManager } from './data/cacheManager.js';
import { TickSchema } from './data/schema.js';

// Basic storage
await cacheManager.set('EURUSD:latest', { price: 1.1234, timestamp: Date.now() });

// With options
await cacheManager.set('EURUSD:ticks', tickData, {
  ttl: 60000,                               // 1 minute TTL
  priority: 'high',                         // High priority
  tags: ['ticks', 'EURUSD'],                // Tags for indexing
  schema: TickSchema,                       // Data validation
  persist: true                             // Persist to localStorage
});
```

##### `async get(key: string, options?: GetOptions): Promise<any|null>`
Retrieves data from cache with optional validation.

```javascript
// Basic retrieval
const data = await cacheManager.get('EURUSD:latest');

// With schema validation
const tickData = await cacheManager.get('EURUSD:ticks', {
  schema: TickSchema
});

if (tickData) {
  console.log('Validated tick data:', tickData);
}
```

##### `has(key: string): boolean`
Checks if key exists in cache (considers expiration).

```javascript
if (cacheManager.has('EURUSD:latest')) {
  console.log('EURUSD data is cached and valid');
}
```

##### `remove(key: string): boolean`
Removes specific key from cache.

```javascript
const removed = cacheManager.remove('EURUSD:latest');
if (removed) {
  console.log('EURUSD data removed from cache');
}
```

##### `async clear(options?: ClearOptions): Promise<void>`
Clears cache entries by criteria.

```javascript
// Clear all
await cacheManager.clear();

// Clear by tags
await cacheManager.clear({ tags: ['ticks'] });

// Clear by priority
await cacheManager.clear({ priority: 'low' });

// Clear by age (older than 1 hour)
await cacheManager.clear({ olderThan: 3600000 });
```

##### `find(criteria: FindCriteria): CacheEntry[]`
Finds cache entries by criteria.

```javascript
// Find by tags
const tickEntries = cacheManager.find({ 
  tags: ['ticks'], 
  limit: 50 
});

// Find by priority
const highPriorityEntries = cacheManager.find({ 
  priority: 'high' 
});

// Find by age
const recentEntries = cacheManager.find({ 
  newerThan: 300000,  // Last 5 minutes
  limit: 100 
});
```

##### `getStats(): CacheStats`
Returns comprehensive cache statistics.

```javascript
const stats = cacheManager.getStats();
console.log('Cache statistics:', {
  totalItems: stats.totalItems,
  memoryUsage: stats.memoryUsage,
  hitRate: stats.hitRate,
  averageRetrievalTime: stats.averageRetrievalTime,
  priorityDistribution: stats.priorityDistribution,
  tagDistribution: stats.tagDistribution
});
```

#### Cache Options

```typescript
interface CacheOptions {
  ttl?: number;              // Time to live in milliseconds
  priority?: 'low' | 'normal' | 'high' | 'critical';
  tags?: string[];           // Tags for indexing and searching
  compress?: boolean;        // Enable compression for this entry
  persist?: boolean;         // Persist to localStorage
  schema?: z.ZodSchema;      // Data validation schema
}
```

#### Reactive Stores

```javascript
import { cacheState, cacheMetrics, cacheHitRate } from './data/cacheManager.js';

// Cache state
cacheState.subscribe(state => {
  console.log('Cache memory usage:', state.memoryUsage);
  console.log('Total items:', state.totalItems);
  console.log('Eviction count:', state.evictionCount);
});

// Cache metrics
cacheMetrics.subscribe(metrics => {
  console.log('Hit rate:', metrics.hitRate);
  console.log('Memory efficiency:', metrics.memoryEfficiency);
});

// Hit rate (derived)
cacheHitRate.subscribe(rate => {
  console.log(`Cache hit rate: ${rate.toFixed(2)}%`);
});
```

---

## Integration Patterns

### 1. Complete Data Flow Example

```javascript
import { wsManager } from './data/websocketManager.js';
import { dataProcessor } from './data/dataProcessor.js';
import { subscriptionManager } from './data/subscriptionManager.js';
import { cacheManager } from './data/cacheManager.js';

class NeuroSenseDataManager {
  constructor() {
    this.setupEventHandlers();
  }

  async initialize() {
    // Connect to WebSocket
    await wsManager.connect();
    
    // Subscribe to symbols
    await subscriptionManager.subscribeMultiple(['EURUSD', 'GBPUSD']);
  }

  setupEventHandlers() {
    // Handle WebSocket messages
    wsManager.on('message', async (data) => {
      if (data.type === 'tick') {
        await this.handleTick(data);
      }
    });

    // Handle subscription events
    subscriptionManager.on('batchSuccess', (symbols) => {
      console.log('Subscribed to symbols:', symbols);
    });
  }

  async handleTick(tickData) {
    // Process tick
    const processed = dataProcessor.processTick(tickData);
    if (!processed) return;

    // Cache processed data
    await cacheManager.set(`${processed.symbol}:latest`, processed, {
      ttl: 30000,
      priority: 'high',
      tags: ['tick', processed.symbol]
    });

    // Update UI (this would be handled by state management)
    this.updateVisualization(processed);
  }

  async getHistoricalData(symbol, limit = 100) {
    const cacheKey = `${symbol}:historical:${limit}`;
    
    // Try cache first
    let data = await cacheManager.get(cacheKey);
    if (data) return data;

    // Fetch from backend (implementation dependent)
    data = await this.fetchHistoricalData(symbol, limit);
    
    // Cache the result
    await cacheManager.set(cacheKey, data, {
      ttl: 300000, // 5 minutes
      tags: ['historical', symbol]
    });

    return data;
  }

  updateVisualization(processedTick) {
    // This would integrate with the state management layer
    console.log('Update visualization with:', processedTick);
  }
}

// Usage
const dataManager = new NeuroSenseDataManager();
await dataManager.initialize();
```

### 2. Performance Monitoring

```javascript
import { processingMetrics, subscriptionMetrics, cacheMetrics } from './data/index.js';

class PerformanceMonitor {
  constructor() {
    this.setupMonitoring();
  }

  setupMonitoring() {
    // Monitor processing performance
    processingMetrics.subscribe(metrics => {
      if (metrics.ticksPerSecond < 10) {
        console.warn('Low tick processing rate:', metrics.ticksPerSecond);
      }
      
      if (metrics.averageProcessingTime > 10) {
        console.warn('High processing latency:', metrics.averageProcessingTime);
      }
    });

    // Monitor subscription health
    subscriptionMetrics.subscribe(metrics => {
      if (metrics.failedSubscriptions > 0) {
        console.error('Subscription failures detected');
      }
    });

    // Monitor cache efficiency
    cacheMetrics.subscribe(metrics => {
      if (metrics.hitRate < 80) {
        console.warn('Low cache hit rate:', metrics.hitRate);
      }
    });
  }

  getPerformanceReport() {
    return {
      processing: dataProcessor.getPerformanceStats(),
      subscriptions: subscriptionManager.getStats(),
      cache: cacheManager.getStats()
    };
  }
}
```

### 3. Error Handling and Recovery

```javascript
class ErrorHandler {
  constructor() {
    this.setupErrorHandling();
  }

  setupErrorHandling() {
    // WebSocket errors
    wsManager.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.handleWebSocketError(error);
    });

    // Data quality issues
    dataQualityMetrics.subscribe(metrics => {
      if (metrics.gaps.length > 0) {
        this.handleDataGaps(metrics.gaps);
      }
    });
  }

  async handleWebSocketError(error) {
    // Implement error recovery logic
    if (error.message.includes('rate limit')) {
      // Back off and retry
      await this.delay(5000);
      await wsManager.connect();
    }
  }

  handleDataGaps(gaps) {
    // Notify user or implement gap filling logic
    console.warn('Data gaps detected:', gaps);
    // Could trigger historical data fetch to fill gaps
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Best Practices

### 1. Performance Optimization

- **Use caching strategically**: Cache frequently accessed data with appropriate TTL
- **Monitor memory usage**: Watch cache memory consumption and adjust limits
- **Batch operations**: Use subscription batching for multiple symbols
- **Handle backpressure**: Implement rate limiting for high-frequency data

### 2. Error Handling

- **Validate data**: Always use schema validation for critical data
- **Monitor quality**: Track data quality metrics and implement alerts
- **Graceful degradation**: Provide fallbacks when data is unavailable
- **Retry logic**: Use built-in retry mechanisms for transient failures

### 3. Resource Management

- **Clean up resources**: Properly destroy managers when done
- **Monitor connections**: Track WebSocket connection health
- **Limit subscriptions**: Avoid subscribing to unnecessary symbols
- **Optimize cache size**: Balance cache size with memory constraints

### 4. Testing

- **Mock WebSocket**: Use WebSocket mocks for unit testing
- **Test error scenarios**: Verify error handling and recovery
- **Performance testing**: Test with realistic data volumes
- **Integration testing**: Test complete data flows

## Migration Guide

### From Legacy `wsClient.js`

```javascript
// Old approach
import { connect, subscribe, unsubscribe } from './data/wsClient.js';

connect();
subscribe('EURUSD');

// New approach
import { wsManager, subscriptionManager } from './data/index.js';

await wsManager.connect();
await subscriptionManager.subscribe('EURUSD');
```

### From Legacy `symbolStore.js`

```javascript
// Old approach
import { symbolStore } from './data/symbolStore.js';
symbolStore.createNewSymbol('EURUSD', dataPackage);

// New approach
import { dataProcessor, cacheManager } from './data/index.js';

const processed = dataProcessor.processTick(tick);
await cacheManager.set(`EURUSD:latest`, processed);
```

## API Reference

### Type Definitions

```typescript
interface Tick {
  symbol: string;
  bid: number;
  ask: number;
  timestamp: number;
}

interface ProcessedTick {
  price: number;
  direction: number;
  magnitude: number;
  time: number;
  ticks: number;
  originalTick: Tick;
}

interface Subscription {
  symbol: string;
  status: 'pending' | 'active' | 'failed' | 'unsubscribed';
  createdAt: number;
  options: object;
}

interface CacheEntry {
  key: string;
  size: number;
  createdAt: number;
  accessCount: number;
  priority: string;
  tags: string[];
}

interface ConnectionStats {
  connected: boolean;
  url: string;
  metrics: {
    connectTime: number;
    lastPingTime: number;
    lastPongTime: number;
    reconnectAttempts: number;
    totalReconnects: number;
    connectionUptime: number;
  };
  queuedMessages: number;
}
```

### Error Types

```javascript
// WebSocket errors
class WebSocketConnectionError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'WebSocketConnectionError';
    this.code = code;
  }
}

// Data processing errors
class DataValidationError extends Error {
  constructor(message, schema) {
    super(message);
    this.name = 'DataValidationError';
    this.schema = schema;
  }
}

// Cache errors
class CacheCapacityError extends Error {
  constructor(message, currentUsage, maxUsage) {
    super(message);
    this.name = 'CacheCapacityError';
    this.currentUsage = currentUsage;
    this.maxUsage = maxUsage;
  }
}
```

## Conclusion

The NeuroSense FX data layer provides a comprehensive, production-ready foundation for real-time financial data processing. By following the patterns and best practices outlined in this documentation, developers can build robust, high-performance trading applications with excellent data quality and reliability.

For additional information or support, refer to the test files in the `__tests__` directory, which provide comprehensive examples of all API usage patterns.
