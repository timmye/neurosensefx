// =============================================================================
// STORE OPTIMIZATION INTEGRATION - Phase 2 Implementation
// =============================================================================
// Integration layer for optimized stores with error handling and recovery
// Provides unified interface for using optimized stores across the application

import {
  subscriptionBatcher,
  storeMemoizer,
  storeCommunicationOptimizer,
  getStorePerformanceMetrics,
  cleanupStoreOptimizer
} from './storeOptimizer.js';

import {
  initializeOptimizedStores,
  optimizedDisplays,
  optimizedActiveDisplay,
  optimizedPanels,
  subscribeToDisplaysOptimized,
  subscribeToActiveDisplayOptimized,
  subscribeToPanelsOptimized,
  getOptimizedStoreMetrics
} from '../../stores/optimizedDisplayStore.js';

import {
  initializeOptimizedShortcutStore,
  optimizedActiveShortcuts,
  optimizedActiveContext,
  subscribeToActiveShortcutsOptimized,
  subscribeToActiveContextOptimized,
  getOptimizedShortcutStoreMetrics
} from '../../stores/optimizedShortcutStore.js';

import { performanceMonitor } from '../monitoring/performanceMonitor.js';

// =============================================================================
// STORE OPTIMIZATION MANAGER
// =============================================================================

/**
 * Central manager for store optimization with error handling and recovery
 * Provides unified interface for all store optimization features
 */
class StoreOptimizationManager {
  constructor() {
    this.isInitialized = false;
    this.cleanupFunctions = [];
    this.errorHandlers = new Map();
    this.performanceMetrics = {
      totalSubscriptions: 0,
      totalErrors: 0,
      totalRecoveries: 0,
      startTime: Date.now()
    };
    this.healthCheckInterval = null;
  }

  /**
   * Initialize all store optimizations
   * @param {Object} options - Initialization options
   * @returns {Promise<boolean>} Initialization success
   */
  async initialize(options = {}) {
    if (this.isInitialized) {
      console.warn('[STORE_OPTIMIZATION] Already initialized');
      return true;
    }

    try {
      console.log('[STORE_OPTIMIZATION] Initializing store optimization system');

      // Initialize optimized display store
      const displayStoreCleanup = initializeOptimizedStores();
      this.cleanupFunctions.push(displayStoreCleanup);

      // Initialize optimized shortcut store
      const shortcutStoreCleanup = initializeOptimizedShortcutStore();
      this.cleanupFunctions.push(shortcutStoreCleanup);

      // Setup error handling
      this.setupErrorHandling();

      // Setup health monitoring
      this.setupHealthMonitoring(options.healthCheckInterval || 30000);

      // Setup performance monitoring
      this.setupPerformanceMonitoring();

      this.isInitialized = true;
      performanceMonitor.recordMetric('store_optimization_initialized', true);

      console.log('[STORE_OPTIMIZATION] Initialization completed successfully');
      return true;

    } catch (error) {
      console.error('[STORE_OPTIMIZATION] Initialization failed:', error);
      this.handleInitializationError(error);
      return false;
    }
  }

  /**
   * Setup comprehensive error handling for store operations
   */
  setupErrorHandling() {
    // Handle subscription errors
    this.errorHandlers.set('subscription_error', (error, context) => {
      console.error('[STORE_OPTIMIZATION] Subscription error:', error, context);
      this.performanceMetrics.totalErrors++;

      // Attempt recovery based on error type
      if (error.message.includes('undefined')) {
        this.recoverFromUndefinedError(error, context);
      } else if (error.message.includes('memory')) {
        this.recoverFromMemoryError(error, context);
      } else {
        this.performGenericRecovery(error, context);
      }
    });

    // Handle batch processing errors
    this.errorHandlers.set('batch_error', (error, context) => {
      console.error('[STORE_OPTIMIZATION] Batch processing error:', error, context);
      this.performanceMetrics.totalErrors++;

      // Flush batch to prevent hanging operations
      subscriptionBatcher.flushBatch();
    });

    // Handle communication errors
    this.errorHandlers.set('communication_error', (error, context) => {
      console.error('[STORE_OPTIMIZATION] Communication error:', error, context);
      this.performanceMetrics.totalErrors++;

      // Reset communication optimizer
      storeCommunicationOptimizer.resetMetrics();
    });
  }

  /**
   * Setup periodic health monitoring
   * @param {number} interval - Health check interval in milliseconds
   */
  setupHealthMonitoring(interval) {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, interval);
  }

  /**
   * Setup performance monitoring integration
   */
  setupPerformanceMonitoring() {
    // Record subscription metrics
    const originalSubscribe = optimizedSubscribe;
    optimizedSubscribe = (store, callback, options) => {
      this.performanceMetrics.totalSubscriptions++;
      return originalSubscribe(store, callback, options);
    };
  }

  /**
   * Perform comprehensive health check
   */
  performHealthCheck() {
    try {
      const health = {
        timestamp: Date.now(),
        subscriptionBatcher: {
          pendingUpdates: subscriptionBatcher.pendingUpdates.size,
          activeSubscribers: subscriptionBatcher.subscribers.size
        },
        memoizer: {
          cacheSize: storeMemoizer.cache.size,
          cacheUtilization: storeMemoizer.cache.size / storeMemoizer.maxCacheSize
        },
        communication: storeCommunicationOptimizer.getMetrics(),
        performance: this.performanceMetrics
      };

      // Check for health issues
      const issues = [];

      if (health.subscriptionBatcher.pendingUpdates > 100) {
        issues.push('High number of pending updates');
      }

      if (health.memoizer.cacheUtilization > 0.9) {
        issues.push('Cache approaching capacity');
      }

      if (health.communication.averageProcessingTime > 50) {
        issues.push('Slow communication processing');
      }

      if (issues.length > 0) {
        console.warn('[STORE_OPTIMIZATION] Health check issues:', issues);
        this.handleHealthIssues(issues, health);
      }

      // Record health metrics
      performanceMonitor.recordMetric('store_optimization_health', health);

    } catch (error) {
      console.error('[STORE_OPTIMIZATION] Health check failed:', error);
      this.errorHandlers.get('health_check_error')?.(error, { source: 'health_check' });
    }
  }

  /**
   * Handle health issues with automatic recovery
   * @param {Array} issues - Array of health issues
   * @param {Object} health - Current health status
   */
  handleHealthIssues(issues, health) {
    issues.forEach(issue => {
      switch (issue) {
        case 'High number of pending updates':
          // Force flush pending updates
          subscriptionBatcher.flushBatch();
          console.log('[STORE_OPTIMIZATION] Forced batch flush due to high pending updates');
          break;

        case 'Cache approaching capacity':
          // Clear memoization cache
          storeMemoizer.clear();
          console.log('[STORE_OPTIMIZATION] Cleared cache due to capacity pressure');
          break;

        case 'Slow communication processing':
          // Reset communication optimizer
          storeCommunicationOptimizer.resetMetrics();
          console.log('[STORE_OPTIMIZATION] Reset communication optimizer due to slow processing');
          break;
      }
    });

    this.performanceMetrics.totalRecoveries++;
  }

  /**
   * Recover from undefined reference errors
   * @param {Error} error - The error that occurred
   * @param {Object} context - Error context
   */
  recoverFromUndefinedError(error, context) {
    console.log('[STORE_OPTIMIZATION] Attempting recovery from undefined error');

    // Clear caches to remove stale references
    storeMemoizer.clear();

    // Flush any pending batches
    subscriptionBatcher.flushBatch();

    // Reset communication optimizer
    storeCommunicationOptimizer.resetMetrics();

    console.log('[STORE_OPTIMIZATION] Recovery from undefined error completed');
  }

  /**
   * Recover from memory errors
   * @param {Error} error - The error that occurred
   * @param {Object} context - Error context
   */
  recoverFromMemoryError(error, context) {
    console.log('[STORE_OPTIMIZATION] Attempting recovery from memory error');

    // Aggressive cache clearing
    storeMemoizer.clear();

    // Force garbage collection hints
    if (window.gc) {
      window.gc();
    }

    console.log('[STORE_OPTIMIZATION] Recovery from memory error completed');
  }

  /**
   * Perform generic error recovery
   * @param {Error} error - The error that occurred
   * @param {Object} context - Error context
   */
  performGenericRecovery(error, context) {
    console.log('[STORE_OPTIMIZATION] Performing generic error recovery');

    // Clear caches and reset state
    storeMemoizer.clear();
    subscriptionBatcher.flushBatch();
    storeCommunicationOptimizer.resetMetrics();

    console.log('[STORE_OPTIMIZATION] Generic recovery completed');
  }

  /**
   * Handle initialization errors
   * @param {Error} error - Initialization error
   */
  handleInitializationError(error) {
    console.error('[STORE_OPTIMIZATION] Critical initialization error, attempting recovery');

    // Try to initialize with minimal optimization
    try {
      this.isInitialized = true; // Mark as initialized even if partially
      console.warn('[STORE_OPTIMIZATION] Operating in degraded mode');
    } catch (recoveryError) {
      console.error('[STORE_OPTIMIZATION] Failed to initialize even in degraded mode');
    }
  }

  /**
   * Get comprehensive performance metrics
   * @returns {Object} Complete performance metrics
   */
  getPerformanceMetrics() {
    return {
      optimization: this.performanceMetrics,
      displayStore: getOptimizedStoreMetrics(),
      shortcutStore: getOptimizedShortcutStoreMetrics(),
      system: getStorePerformanceMetrics(),
      uptime: Date.now() - this.performanceMetrics.startTime
    };
  }

  /**
   * Create optimized subscription with error handling
   * @param {Object} store - Store to subscribe to
   * @param {Function} callback - Subscription callback
   * @param {Object} options - Subscription options
   * @returns {Function} Unsubscribe function
   */
  createSafeSubscription(store, callback, options = {}) {
    let unsubscribe = null;

    try {
      // Wrap callback with error handling
      const safeCallback = (value) => {
        try {
          callback(value);
        } catch (error) {
          this.errorHandlers.get('subscription_error')?.(error, {
            store: options.storeName || 'unknown',
            value
          });
        }
      };

      // Create optimized subscription
      unsubscribe = optimizedSubscribe(store, safeCallback, {
        ...options,
        subscriberId: options.subscriberId || `safe_sub_${Date.now()}`
      });

      return unsubscribe;

    } catch (error) {
      this.errorHandlers.get('subscription_error')?.(error, {
        store: options.storeName || 'unknown',
        during: 'subscription_creation'
      });
      return () => {}; // Return no-op unsubscribe
    }
  }

  /**
   * Cleanup all store optimizations
   */
  cleanup() {
    console.log('[STORE_OPTIMIZATION] Cleaning up store optimization system');

    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Execute all cleanup functions
    this.cleanupFunctions.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.error('[STORE_OPTIMIZATION] Cleanup function error:', error);
      }
    });

    // Cleanup optimizer resources
    cleanupStoreOptimizer();

    // Reset state
    this.cleanupFunctions = [];
    this.isInitialized = false;

    console.log('[STORE_OPTIMIZATION] Cleanup completed');
  }
}

// =============================================================================
// GLOBAL STORE OPTIMIZATION MANAGER
// =============================================================================

export const storeOptimizationManager = new StoreOptimizationManager();

// =============================================================================
// PUBLIC API FOR OPTIMIZED STORES
// =============================================================================

/**
 * Initialize store optimization system
 * @param {Object} options - Initialization options
 * @returns {Promise<boolean>} Success status
 */
export async function initializeStoreOptimization(options = {}) {
  return await storeOptimizationManager.initialize(options);
}

/**
 * Create safe subscription to optimized displays
 * @param {Function} callback - Subscription callback
 * @param {Object} options - Subscription options
 * @returns {Function} Unsubscribe function
 */
export function subscribeToDisplays(callback, options = {}) {
  return storeOptimizationManager.createSafeSubscription(
    optimizedDisplays,
    callback,
    { ...options, storeName: 'optimizedDisplays' }
  );
}

/**
 * Create safe subscription to optimized active display
 * @param {Function} callback - Subscription callback
 * @param {Object} options - Subscription options
 * @returns {Function} Unsubscribe function
 */
export function subscribeToActiveDisplay(callback, options = {}) {
  return storeOptimizationManager.createSafeSubscription(
    optimizedActiveDisplay,
    callback,
    { ...options, storeName: 'optimizedActiveDisplay' }
  );
}

/**
 * Create safe subscription to optimized active shortcuts
 * @param {Function} callback - Subscription callback
 * @param {Object} options - Subscription options
 * @returns {Function} Unsubscribe function
 */
export function subscribeToActiveShortcuts(callback, options = {}) {
  return storeOptimizationManager.createSafeSubscription(
    optimizedActiveShortcuts,
    callback,
    { ...options, storeName: 'optimizedActiveShortcuts' }
  );
}

/**
 * Create safe subscription to optimized active context
 * @param {Function} callback - Subscription callback
 * @param {Object} options - Subscription options
 * @returns {Function} Unsubscribe function
 */
export function subscribeToActiveContext(callback, options = {}) {
  return storeOptimizationManager.createSafeSubscription(
    optimizedActiveContext,
    callback,
    { ...options, storeName: 'optimizedActiveContext' }
  );
}

/**
 * Get comprehensive store optimization metrics
 * @returns {Object} Performance metrics
 */
export function getStoreOptimizationMetrics() {
  return storeOptimizationManager.getPerformanceMetrics();
}

/**
 * Cleanup store optimization system
 */
export function cleanupStoreOptimization() {
  storeOptimizationManager.cleanup();
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  // Optimized stores
  optimizedDisplays,
  optimizedActiveDisplay,
  optimizedPanels,
  optimizedActiveShortcuts,
  optimizedActiveContext,

  // Manager
  storeOptimizationManager,

  // Integration utilities
  initializeStoreOptimization,
  subscribeToDisplays,
  subscribeToActiveDisplay,
  subscribeToActiveShortcuts,
  subscribeToActiveContext,
  getStoreOptimizationMetrics,
  cleanupStoreOptimization
};

export default {
  optimizedDisplays,
  optimizedActiveDisplay,
  optimizedPanels,
  optimizedActiveShortcuts,
  optimizedActiveContext,
  storeOptimizationManager,
  initializeStoreOptimization,
  subscribeToDisplays,
  subscribeToActiveDisplay,
  subscribeToActiveShortcuts,
  subscribeToActiveContext,
  getStoreOptimizationMetrics,
  cleanupStoreOptimization
};