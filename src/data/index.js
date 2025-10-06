/**
 * NeuroSense FX Data Layer
 * Central entry point for all data layer components
 */

// Core managers
export { WebSocketManager, wsManager } from './websocketManager.js';
export { DataProcessor, dataProcessor } from './dataProcessor.js';
export { SubscriptionManager, subscriptionManager } from './subscriptionManager.js';
export { CacheManager, cacheManager } from './cacheManager.js';

// Reactive stores
export {
  connectionState,
  isConnected,
  hasError,
  connectionMetrics
} from './websocketManager.js';

export {
  processingMetrics,
  dataQualityMetrics
} from './dataProcessor.js';

export {
  subscriptionState,
  activeSubscriptionCount,
  hasPendingSubscriptions,
  subscriptionMetrics
} from './subscriptionManager.js';

export {
  cacheState,
  cacheMetrics,
  cacheHitRate
} from './cacheManager.js';

// Schemas and types
export {
  TickSchema,
  ProcessedTickSchema,
  HistoricalBarSchema,
  SymbolDataPackageSchema,
  MarketDataSchema,
  VisualizationStateSchema,
  VisualizationConfigSchema
} from './schema.js';

// Legacy compatibility (deprecated)
export { default as wsClient } from './wsClient.js';
export { symbolStore } from './symbolStore.js';

/**
 * Data Layer Manager
 * Provides a unified interface for managing all data layer components
 */
export class DataLayerManager {
  constructor(options = {}) {
    this.options = {
      websocket: {},
      processor: {},
      subscription: {},
      cache: {},
      ...options
    };
    
    this.initialized = false;
    this.destroyed = false;
  }

  /**
   * Initialize all data layer components
   */
  async initialize() {
    if (this.initialized) {
      console.warn('DataLayerManager already initialized');
      return;
    }

    try {
      console.log('[DataLayerManager] Initializing data layer...');

      // Initialize cache first (other components may use it)
      if (this.options.cache !== false) {
        console.log('[DataLayerManager] Cache manager ready');
      }

      // Initialize data processor
      if (this.options.processor !== false) {
        console.log('[DataLayerManager] Data processor ready');
      }

      // Initialize subscription manager
      if (this.options.subscription !== false) {
        console.log('[DataLayerManager] Subscription manager ready');
      }

      // Initialize WebSocket connection
      if (this.options.websocket !== false) {
        await wsManager.connect();
        console.log('[DataLayerManager] WebSocket connected');
      }

      this.initialized = true;
      console.log('[DataLayerManager] Data layer initialized successfully');

    } catch (error) {
      console.error('[DataLayerManager] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Destroy all data layer components
   */
  async destroy() {
    if (this.destroyed) {
      console.warn('DataLayerManager already destroyed');
      return;
    }

    try {
      console.log('[DataLayerManager] Destroying data layer...');

      // Disconnect WebSocket
      if (wsManager.isConnected()) {
        wsManager.disconnect();
        console.log('[DataLayerManager] WebSocket disconnected');
      }

      // Clear subscriptions
      await subscriptionManager.clear();
      console.log('[DataLayerManager] Subscriptions cleared');

      // Clear cache
      await cacheManager.clear();
      console.log('[DataLayerManager] Cache cleared');

      // Clear processor
      dataProcessor.clear();
      console.log('[DataLayerManager] Data processor cleared');

      this.destroyed = true;
      console.log('[DataLayerManager] Data layer destroyed successfully');

    } catch (error) {
      console.error('[DataLayerManager] Destruction failed:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive status report
   */
  getStatus() {
    return {
      initialized: this.initialized,
      destroyed: this.destroyed,
      websocket: {
        connected: wsManager.isConnected(),
        stats: wsManager.getStats()
      },
      processor: {
        stats: dataProcessor.getPerformanceStats(),
        quality: dataProcessor.getDataQualityReport()
      },
      subscription: {
        stats: subscriptionManager.getStats(),
        active: subscriptionManager.getActiveSubscriptions()
      },
      cache: {
        stats: cacheManager.getStats()
      }
    };
  }

  /**
   * Subscribe to symbols with automatic processing and caching
   */
  async subscribeToSymbols(symbols, options = {}) {
    if (!this.initialized) {
      throw new Error('DataLayerManager not initialized');
    }

    const results = await subscriptionManager.subscribeMultiple(symbols, options);
    
    // Setup automatic data processing for new subscriptions
    this.setupDataProcessing();
    
    return results;
  }

  /**
   * Setup automatic data processing pipeline
   */
  setupDataProcessing() {
    if (this._processingSetup) return;
    
    wsManager.on('message', async (data) => {
      try {
        // Process tick data
        if (data.type === 'tick' || data.symbol) {
          const processed = dataProcessor.processTick(data);
          
          if (processed) {
            // Cache processed data
            await cacheManager.set(`${processed.symbol}:latest`, processed, {
              ttl: 30000,
              priority: 'high',
              tags: ['tick', processed.symbol]
            });
          }
        }
        
        // Handle other message types as needed
        if (data.type === 'subscription_success') {
          console.log('[DataLayerManager] Subscription successful:', data.symbols);
        }
        
        if (data.type === 'subscription_error') {
          console.error('[DataLayerManager] Subscription failed:', data);
        }
        
      } catch (error) {
        console.error('[DataLayerManager] Data processing error:', error);
      }
    });
    
    this._processingSetup = true;
  }

  /**
   * Get cached data for a symbol
   */
  async getCachedData(symbol, type = 'latest') {
    const key = `${symbol}:${type}`;
    return await cacheManager.get(key);
  }

  /**
   * Get recent ticks for a symbol
   */
  getRecentTicks(symbol, count = 100) {
    return dataProcessor.getRecentTicks(symbol, count);
  }

  /**
   * Get aggregated data for a symbol
   */
  getAggregatedData(symbol) {
    return dataProcessor.getAggregatedData(symbol);
  }

  /**
   * Calculate technical indicators for a symbol
   */
  calculateIndicators(symbol, indicators = ['sma', 'ema', 'rsi']) {
    return dataProcessor.calculateIndicators(symbol, indicators);
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return {
      websocket: wsManager.getStats(),
      processor: dataProcessor.getPerformanceStats(),
      subscription: subscriptionManager.getStats(),
      cache: cacheManager.getStats()
    };
  }

  /**
   * Export data layer configuration
   */
  exportConfig() {
    return {
      options: this.options,
      status: this.getStatus(),
      timestamp: Date.now()
    };
  }

  /**
   * Import data layer configuration
   */
  importConfig(config) {
    if (config.options) {
      this.options = { ...this.options, ...config.options };
    }
    
    // Note: This doesn't restore state, only configuration
    console.log('[DataLayerManager] Configuration imported');
  }
}

// Create singleton instance
export const dataLayerManager = new DataLayerManager();

// Convenience exports for common operations
export const connect = () => wsManager.connect();
export const disconnect = () => wsManager.disconnect();
export const subscribe = (symbol, options) => subscriptionManager.subscribe(symbol, options);
export const unsubscribe = (symbol) => subscriptionManager.unsubscribe(symbol);
export const getCache = (key, options) => cacheManager.get(key, options);
export const setCache = (key, data, options) => cacheManager.set(key, data, options);
export const processTick = (tick) => dataProcessor.processTick(tick);

// Default export
export default {
  // Managers
  WebSocketManager,
  DataProcessor,
  SubscriptionManager,
  CacheManager,
  dataLayerManager,
  
  // Instances
  wsManager,
  dataProcessor,
  subscriptionManager,
  cacheManager,
  
  // Stores
  connectionState,
  isConnected,
  processingMetrics,
  subscriptionState,
  cacheState,
  
  // Convenience functions
  connect,
  disconnect,
  subscribe,
  unsubscribe,
  getCache,
  setCache,
  processTick,
  
  // Legacy compatibility
  wsClient,
  symbolStore
};
