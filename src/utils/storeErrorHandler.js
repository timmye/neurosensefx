/**
 * Store Error Handler and Recovery System
 *
 * Provides comprehensive error handling for Svelte stores with automatic
 * recovery, state persistence, and health monitoring for trading platform stability.
 *
 * Design Philosophy: "Simple, Performant, Maintainable"
 * - Simple: Clear error handling patterns with predictable recovery
 * - Performant: <1ms store operation overhead, sub-10ms error recovery
 * - Maintainable: Centralized store error management
 */

import { withErrorBoundary, withAsyncErrorBoundary, CircuitBreaker, memorySafeErrorHandler } from './errorBoundaryUtils.js';

/**
 * Store health status levels
 */
export const STORE_HEALTH = {
  HEALTHY: 'HEALTHY',
  DEGRADED: 'DEGRADED',
  ERROR: 'ERROR',
  RECOVERING: 'RECOVERING'
};

/**
 * Store operation types for error categorization
 */
export const STORE_OPERATIONS = {
  READ: 'READ',
  WRITE: 'WRITE',
  SUBSCRIBE: 'SUBSCRIBE',
  UPDATE: 'UPDATE',
  VALIDATION: 'VALIDATION'
};

/**
 * Store error handler class with circuit breaker and recovery mechanisms
 */
export class StoreErrorHandler {
  constructor(options = {}) {
    this.maxErrors = options.maxErrors || 50;
    this.errorThreshold = options.errorThreshold || 10;
    this.recoveryAttempts = options.recoveryAttempts || 3;
    this.healthCheckInterval = options.healthCheckInterval || 5000;

    this.errorCount = 0;
    this.lastError = null;
    this.lastErrorTime = null;
    this.healthStatus = STORE_HEALTH.HEALTHY;
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      recoveryTime: 30000
    });

    this.stores = new Map(); // storeName -> storeInfo
    this.errorHistory = [];
    this.recoveryStrategies = new Map();
    this.healthMonitors = new Set();

    this.logError = memorySafeErrorHandler;
    this.performanceMetrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageOperationTime: 0,
      lastHealthCheck: null
    };

    // Start health monitoring
    this.startHealthMonitoring();
  }

  /**
   * Register a store with error handling
   */
  registerStore(name, store, options = {}) {
    const storeInfo = {
      name,
      store,
      originalSubscribe: store.subscribe,
      originalSet: store.set,
      originalUpdate: store.update,
      options: {
        persistToLocalStorage: options.persistToLocalStorage || false,
        validation: options.validation || null,
        fallbackValue: options.fallbackValue || null,
        critical: options.critical || false,
        ...options
      },
      errorCount: 0,
      lastError: null,
      subscriptionCount: 0
    };

    // Wrap store methods with error handling
    this.wrapStoreMethods(storeInfo);
    this.stores.set(name, storeInfo);

    // Load persisted state if available
    if (storeInfo.options.persistToLocalStorage) {
      this.loadPersistedState(name);
    }

    console.log(`[STORE_REGISTRY] Registered store: ${name}`);
    return store;
  }

  /**
   * Wrap store methods with error handling
   */
  wrapStoreMethods(storeInfo) {
    const { store, name, options } = storeInfo;

    // Wrap subscribe method
    store.subscribe = (callback) => {
      storeInfo.subscriptionCount++;
      const startTime = performance.now();

      return withErrorBoundary(() => {
        const unsubscribe = storeInfo.originalSubscribe.call(store, (value) => {
          try {
            this.validateStoreValue(name, value);
            callback(value);
            this.recordOperationSuccess();
          } catch (error) {
            this.handleStoreError(name, error, STORE_OPERATIONS.READ, { value });
            // Provide fallback value if available
            if (options.fallbackValue !== null) {
              callback(options.fallbackValue);
            }
          }
        });

        this.recordOperationTime(performance.now() - startTime);
        return unsubscribe;
      }, () => {
        storeInfo.subscriptionCount--;
        return () => {}; // Return safe unsubscribe function
      }, `${name}.subscribe`)();
    };

    // Wrap set method
    store.set = (value) => {
      return withErrorBoundary(() => {
        const startTime = performance.now();

        this.validateStoreValue(name, value);
        storeInfo.originalSet.call(store, value);

        this.recordOperationSuccess();
        this.recordOperationTime(performance.now() - startTime);

        // Persist state if enabled
        if (options.persistToLocalStorage) {
          this.persistState(name, value);
        }

        return true;
      }, () => {
        // Use fallback value if available
        if (options.fallbackValue !== null) {
          storeInfo.originalSet.call(store, options.fallbackValue);
          return false; // Indicate fallback was used
        }
        return false;
      }, `${name}.set`)(value);
    };

    // Wrap update method
    store.update = (updater) => {
      return withErrorBoundary(() => {
        const startTime = performance.now();

        return this.circuitBreaker.execute(() => {
          return new Promise((resolve, reject) => {
            try {
              const result = storeInfo.originalUpdate.call(store, (currentValue) => {
                try {
                  const newValue = updater(currentValue);
                  this.validateStoreValue(name, newValue);
                  return newValue;
                } catch (error) {
                  reject(error);
                  return currentValue; // Return original value if validation fails
                }
              });

              this.recordOperationSuccess();
              this.recordOperationTime(performance.now() - startTime);

              // Persist state if enabled (need to get new value)
              if (options.persistToLocalStorage) {
                let newValue;
                store.subscribe((value) => {
                  newValue = value;
                })();
                this.persistState(name, newValue);
              }

              resolve(result);
            } catch (error) {
              reject(error);
            }
          });
        }, null, `${name}.update`);
      }, () => {
        // Fallback: try to get current value and apply simple update
        try {
          let currentValue;
          store.subscribe((value) => {
            currentValue = value;
          })();

          // If critical store, try to preserve existing state
          if (options.critical) {
            return currentValue; // Don't update critical stores on error
          }

          return null;
        } catch (fallbackError) {
          this.logError('StoreUpdateFallback', fallbackError);
          return null;
        }
      }, `${name}.update`)(updater);
    };
  }

  /**
   * Validate store value against schema or rules
   */
  validateStoreValue(storeName, value) {
    const storeInfo = this.stores.get(storeName);
    if (!storeInfo?.options.validation) {
      return true; // No validation required
    }

    try {
      if (typeof storeInfo.options.validation === 'function') {
        return storeInfo.options.validation(value);
      }

      if (storeInfo.options.validation.schema) {
        // Schema validation would go here
        return true; // Simplified for now
      }

      return true;
    } catch (error) {
      throw new Error(`Store validation failed for ${storeName}: ${error.message}`);
    }
  }

  /**
   * Handle store errors with recovery strategies
   */
  handleStoreError(storeName, error, operation, context = {}) {
    const storeInfo = this.stores.get(storeName);
    if (!storeInfo) {
      this.logError('UnknownStoreError', error, { storeName, operation });
      return;
    }

    storeInfo.errorCount++;
    storeInfo.lastError = error;
    this.errorCount++;
    this.lastError = error;
    this.lastErrorTime = new Date();

    const errorInfo = {
      timestamp: new Date().toISOString(),
      storeName,
      operation,
      error: error.message,
      stack: error.stack,
      context,
      isCritical: storeInfo.options.critical
    };

    // Add to error history
    this.errorHistory.push(errorInfo);
    if (this.errorHistory.length > this.maxErrors) {
      this.errorHistory.shift();
    }

    this.logError('StoreOperation', error, errorInfo);

    // Update health status
    this.updateHealthStatus();

    // Trigger recovery if critical error
    if (storeInfo.options.critical || this.errorCount >= this.errorThreshold) {
      this.triggerRecovery(storeName);
    }

    return errorInfo;
  }

  /**
   * Trigger recovery for a store
   */
  async triggerRecovery(storeName) {
    const storeInfo = this.stores.get(storeName);
    if (!storeInfo) return;

    this.healthStatus = STORE_HEALTH.RECOVERING;
    console.log(`[STORE_ERROR_HANDLER] Triggering recovery for store: ${storeName}`);

    for (let attempt = 1; attempt <= this.recoveryAttempts; attempt++) {
      try {
        console.log(`[STORE_ERROR_HANDLER] Recovery attempt ${attempt}/${this.recoveryAttempts} for ${storeName}`);

        // Try different recovery strategies
        const strategies = [
          () => this.recoverFromPersistedState(storeName),
          () => this.recoverToDefaultState(storeName),
          () => this.recoverToSafeState(storeName)
        ];

        for (const strategy of strategies) {
          try {
            const success = await strategy();
            if (success) {
              console.log(`[STORE_ERROR_HANDLER] Recovery successful for ${storeName}`);
              storeInfo.errorCount = 0;
              this.healthStatus = STORE_HEALTH.HEALTHY;
              return true;
            }
          } catch (strategyError) {
            console.log(`[STORE_ERROR_HANDLER] Recovery strategy failed for ${storeName}:`, strategyError.message);
          }
        }

      } catch (error) {
        console.error(`[STORE_ERROR_HANDLER] Recovery attempt ${attempt} failed for ${storeName}:`, error);
      }

      // Wait before next attempt
      if (attempt < this.recoveryAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    console.error(`[STORE_ERROR_HANDLER] Recovery failed for ${storeName} after ${this.recoveryAttempts} attempts`);
    this.healthStatus = STORE_HEALTH.ERROR;
    return false;
  }

  /**
   * Recover from persisted state
   */
  async recoverFromPersistedState(storeName) {
    const storeInfo = this.stores.get(storeName);
    if (!storeInfo?.options.persistToLocalStorage) {
      return false;
    }

    try {
      const persistedState = this.loadPersistedState(storeName);
      if (persistedState !== null) {
        storeInfo.store.set(persistedState);
        return true;
      }
    } catch (error) {
      console.log(`[STORE_ERROR_HANDLER] Failed to recover from persisted state for ${storeName}:`, error.message);
    }

    return false;
  }

  /**
   * Recover to default state
   */
  async recoverToDefaultState(storeName) {
    const storeInfo = this.stores.get(storeName);
    if (!storeInfo?.options.defaultValue) {
      return false;
    }

    try {
      storeInfo.store.set(storeInfo.options.defaultValue);
      return true;
    } catch (error) {
      console.log(`[STORE_ERROR_HANDLER] Failed to recover to default state for ${storeName}:`, error.message);
    }

    return false;
  }

  /**
   * Recover to safe minimal state
   */
  async recoverToSafeState(storeName) {
    const storeInfo = this.stores.get(storeName);

    try {
      // Create safe minimal state based on store type
      let safeState;
      if (storeInfo.options.safeState) {
        safeState = storeInfo.options.safeState;
      } else {
        // Default safe states
        safeState = this.getDefaultSafeState(storeName);
      }

      storeInfo.store.set(safeState);
      return true;
    } catch (error) {
      console.log(`[STORE_ERROR_HANDLER] Failed to recover to safe state for ${storeName}:`, error.message);
    }

    return false;
  }

  /**
   * Get default safe state for store types
   */
  getDefaultSafeState(storeName) {
    // Store-specific safe states
    const safeStates = {
      'displays': new Map(),
      'panels': new Map(),
      'icons': new Map(),
      'shortcuts': new Map(),
      'defaultConfig': {},
      'contextMenu': {
        open: false,
        x: 0,
        y: 0,
        targetId: null,
        targetType: null,
        context: null
      }
    };

    return safeStates[storeName] || null;
  }

  /**
   * Persist state to localStorage
   */
  persistState(storeName, value) {
    try {
      const key = `neurosensefx_store_${storeName}`;
      const serialized = JSON.stringify({
        value,
        timestamp: new Date().toISOString(),
        version: '1.0'
      });
      localStorage.setItem(key, serialized);
    } catch (error) {
      console.warn(`[STORE_ERROR_HANDLER] Failed to persist state for ${storeName}:`, error.message);
    }
  }

  /**
   * Load persisted state from localStorage
   */
  loadPersistedState(storeName) {
    try {
      const key = `neurosensefx_store_${storeName}`;
      const serialized = localStorage.getItem(key);

      if (serialized) {
        const parsed = JSON.parse(serialized);

        // Check if persisted data is recent (within 24 hours)
        const timestamp = new Date(parsed.timestamp);
        const now = new Date();
        const hoursDiff = (now - timestamp) / (1000 * 60 * 60);

        if (hoursDiff < 24) {
          return parsed.value;
        }
      }
    } catch (error) {
      console.warn(`[STORE_ERROR_HANDLER] Failed to load persisted state for ${storeName}:`, error.message);
    }

    return null;
  }

  /**
   * Record successful operation
   */
  recordOperationSuccess() {
    this.performanceMetrics.totalOperations++;
    this.performanceMetrics.successfulOperations++;
  }

  /**
   * Record operation time
   */
  recordOperationTime(time) {
    const total = this.performanceMetrics.averageOperationTime * (this.performanceMetrics.totalOperations - 1) + time;
    this.performanceMetrics.averageOperationTime = total / this.performanceMetrics.totalOperations;
  }

  /**
   * Update health status based on errors and performance
   */
  updateHealthStatus() {
    if (this.healthStatus === STORE_HEALTH.RECOVERING) {
      return; // Don't change status while recovering
    }

    const errorRate = this.errorCount / Math.max(this.performanceMetrics.totalOperations, 1);
    const avgTime = this.performanceMetrics.averageOperationTime;

    if (errorRate > 0.1 || avgTime > 10) {
      this.healthStatus = STORE_HEALTH.ERROR;
    } else if (errorRate > 0.05 || avgTime > 5) {
      this.healthStatus = STORE_HEALTH.DEGRADED;
    } else {
      this.healthStatus = STORE_HEALTH.HEALTHY;
    }
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    const healthCheck = setInterval(() => {
      this.updateHealthStatus();
      this.performanceMetrics.lastHealthCheck = new Date();

      // Notify health monitors
      this.healthMonitors.forEach(callback => {
        try {
          callback(this.getHealthStatus());
        } catch (error) {
          this.logError('HealthMonitorCallback', error);
        }
      });
    }, this.healthCheckInterval);

    this.healthCheckInterval = healthCheck;
  }

  /**
   * Add health monitor callback
   */
  addHealthMonitor(callback) {
    this.healthMonitors.add(callback);
    return () => this.healthMonitors.delete(callback);
  }

  /**
   * Get current health status
   */
  getHealthStatus() {
    const storeHealths = {};
    this.stores.forEach((storeInfo, name) => {
      storeHealths[name] = {
        errorCount: storeInfo.errorCount,
        lastError: storeInfo.lastError?.message,
        subscriptionCount: storeInfo.subscriptionCount,
        isCritical: storeInfo.options.critical
      };
    });

    return {
      overall: this.healthStatus,
      totalErrors: this.errorCount,
      lastError: this.lastError?.message,
      lastErrorTime: this.lastErrorTime,
      stores: storeHealths,
      metrics: { ...this.performanceMetrics },
      circuitBreakerState: this.circuitBreaker.state
    };
  }

  /**
   * Get store error history
   */
  getErrorHistory(limit = 20) {
    return this.errorHistory.slice(-limit);
  }

  /**
   * Clear error history and reset counters
   */
  resetErrors() {
    this.errorCount = 0;
    this.lastError = null;
    this.lastErrorTime = null;
    this.errorHistory = [];

    this.stores.forEach(storeInfo => {
      storeInfo.errorCount = 0;
      storeInfo.lastError = null;
    });

    this.healthStatus = STORE_HEALTH.HEALTHY;
    console.log('[STORE_ERROR_HANDLER] Errors reset');
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthMonitors.clear();
    this.stores.clear();
    this.errorHistory = [];
    this.circuitBreaker = null;
  }
}

/**
 * Singleton store error handler instance
 */
export const storeErrorHandler = new StoreErrorHandler({
  maxErrors: 50,
  errorThreshold: 10,
  recoveryAttempts: 3,
  healthCheckInterval: 5000
});

/**
 * Store wrapper function for easy registration
 */
export function createStoreWithErrorHandling(name, store, options = {}) {
  return storeErrorHandler.registerStore(name, store, options);
}

/**
 * Store operation wrapper with error handling
 */
export function withStoreErrorHandling(storeName, operation, fallbackValue = null) {
  return withErrorBoundary(operation, fallbackValue, `Store.${storeName}`);
}

export default storeErrorHandler;