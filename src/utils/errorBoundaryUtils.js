/**
 * Error Boundary Utilities for Phase 2 Performance Systems
 *
 * Provides comprehensive error handling and fallback mechanisms for all
 * performance optimization components to prevent system crashes.
 *
 * Design Philosophy: "Simple, Performant, Maintainable"
 * - Simple: Clear error handling patterns with minimal overhead
 * - Performant: <0.1ms error boundary overhead when no errors occur
 * - Maintainable: Consistent error reporting and fallback mechanisms
 */

/**
 * Error boundary wrapper for function execution
 * Executes a function with comprehensive error handling and fallback
 */
export function withErrorBoundary(fn, fallbackValue = null, context = 'Unknown') {
  return function(...args) {
    try {
      const result = fn.apply(this, args);

      // Handle async functions
      if (result && typeof result.catch === 'function') {
        return result.catch(error => {
          logError(context, error, { args });
          return typeof fallbackValue === 'function' ? fallbackValue(...args) : fallbackValue;
        });
      }

      return result;
    } catch (error) {
      logError(context, error, { args });
      return typeof fallbackValue === 'function' ? fallbackValue(...args) : fallbackValue;
    }
  };
}

/**
 * Error boundary wrapper for async function execution
 */
export async function withAsyncErrorBoundary(fn, fallbackValue = null, context = 'Unknown') {
  try {
    const result = await fn();
    return result;
  } catch (error) {
    logError(context, error);
    return typeof fallbackValue === 'function' ? await fallbackValue() : fallbackValue;
  }
}

/**
 * Error boundary for class methods
 */
export function createErrorBoundaryWrapper(target, errorHandler = null) {
  const wrapped = {};

  for (const [key, value] of Object.entries(target)) {
    if (typeof value === 'function') {
      wrapped[key] = withErrorBoundary(
        value,
        errorHandler || ((...args) => {
          console.warn(`[${target.constructor?.name || 'Unknown'}] Method ${key} failed, returning default value`);
          return null;
        }),
        `${target.constructor?.name || 'Unknown'}.${key}`
      );
    } else {
      wrapped[key] = value;
    }
  }

  return wrapped;
}

/**
 * Safe property access with fallback
 */
export function safePropertyAccess(obj, path, fallbackValue = null) {
  try {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  } catch (error) {
    logError('SafePropertyAccess', error, { path });
    return fallbackValue;
  }
}

/**
 * Safe array operations with bounds checking
 */
export function safeArrayOperation(array, operation, index, fallbackValue = null) {
  try {
    if (!Array.isArray(array)) {
      return fallbackValue;
    }

    switch (operation) {
      case 'get':
        return index >= 0 && index < array.length ? array[index] : fallbackValue;
      case 'push':
        return array.push ? array.length : array.length;
      case 'pop':
        return array.length > 0 ? array.pop() : fallbackValue;
      case 'slice':
        return array.slice ? array.slice(index) : [];
      default:
        return fallbackValue;
    }
  } catch (error) {
    logError('SafeArrayOperation', error, { operation, index });
    return fallbackValue;
  }
}

/**
 * Error logging with context
 */
export function logError(context, error, additionalInfo = {}) {
  const errorInfo = {
    timestamp: new Date().toISOString(),
    context,
    message: error.message || 'Unknown error',
    stack: error.stack,
    additionalInfo
  };

  // Log to console with structured format
  console.error(`[ERROR_BOUNDARY] ${context}:`, errorInfo);

  // In development, you might want to send errors to a monitoring service
  if (process.env.NODE_ENV === 'development') {
    console.warn('Development mode - error details:', error);
  }

  return errorInfo;
}

/**
 * Performance-aware error boundary for critical operations
 * Only catches errors if they won't impact performance significantly
 */
export function withPerformanceAwareErrorBoundary(fn, fallbackValue = null, context = 'Unknown', maxErrorTime = 10) {
  return function(...args) {
    const startTime = performance.now();

    try {
      const result = fn.apply(this, args);

      // Check if error handling took too long
      const executionTime = performance.now() - startTime;
      if (executionTime > maxErrorTime) {
        console.warn(`[PERFORMANCE_WARNING] ${context} took ${executionTime.toFixed(2)}ms (threshold: ${maxErrorTime}ms)`);
      }

      return result;
    } catch (error) {
      const errorTime = performance.now() - startTime;

      // Only log if error handling was fast enough
      if (errorTime <= maxErrorTime) {
        logError(context, error, { args, executionTime: errorTime });
      } else {
        // For slow error cases, use minimal logging
        console.error(`[ERROR_BOUNDARY] ${context}: ${error.message} (handling took ${errorTime.toFixed(2)}ms)`);
      }

      return typeof fallbackValue === 'function' ? fallbackValue(...args) : fallbackValue;
    }
  };
}

/**
 * Circuit breaker pattern for error-prone operations
 * Automatically disables operations that fail repeatedly
 */
export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.recoveryTime = options.recoveryTime || 60000; // 1 minute
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }

  async execute(fn, fallbackValue = null, context = 'Unknown') {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTime) {
        this.state = 'HALF_OPEN';
      } else {
        return typeof fallbackValue === 'function' ? await fallbackValue() : fallbackValue;
      }
    }

    try {
      const result = await fn();

      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failureCount = 0;
      }

      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.failureThreshold) {
        this.state = 'OPEN';
        console.warn(`[CIRCUIT_BREAKER] ${context} opened due to ${this.failureCount} failures`);
      }

      logError(`CircuitBreaker.${context}`, error);
      return typeof fallbackValue === 'function' ? await fallbackValue() : fallbackValue;
    }
  }
}

/**
 * Memory-safe error handler that prevents error cascades
 */
export function createMemorySafeErrorHandler() {
  let errorCount = 0;
  const maxErrors = 100; // Prevent error spam
  const errorCooldown = 5000; // 5 seconds between same errors
  const recentErrors = new Map();

  return function(context, error, additionalInfo = {}) {
    errorCount++;

    // Prevent error cascades
    if (errorCount > maxErrors) {
      console.error('[ERROR_BOUNDARY] Error cascade detected, suppressing further errors');
      return null;
    }

    const errorKey = `${context}:${error.message}`;
    const now = Date.now();
    const lastError = recentErrors.get(errorKey);

    // Rate limit repeated errors
    if (lastError && now - lastError < errorCooldown) {
      return null;
    }

    recentErrors.set(errorKey, now);

    // Clean old error entries
    if (recentErrors.size > 50) {
      for (const [key, time] of recentErrors) {
        if (now - time > errorCooldown * 2) {
          recentErrors.delete(key);
        }
      }
    }

    return logError(context, error, additionalInfo);
  };
}

/**
 * Default safe return values for different contexts
 */
export const SAFE_DEFAULTS = {
  number: 0,
  string: '',
  boolean: false,
  array: [],
  object: {},
  function: () => null,
  map: new Map(),
  set: new Set(),
  promise: Promise.resolve(null)
};

/**
 * Context-aware fallback values
 */
export function getContextualFallback(context, operation = 'get') {
  const fallbackMap = {
    'FrameRateMonitor': SAFE_DEFAULTS.number,
    'LatencyMonitor': SAFE_DEFAULTS.number,
    'StoreOptimizer': SAFE_DEFAULTS.object,
    'MemoryProfiler': SAFE_DEFAULTS.object,
    'RenderingPipeline': SAFE_DEFAULTS.boolean,
    'FrameScheduler': SAFE_DEFAULTS.boolean,
    'Cache': operation === 'get' ? null : SAFE_DEFAULTS.boolean,
    'PerformanceMetrics': SAFE_DEFAULTS.object
  };

  return fallbackMap[context] || SAFE_DEFAULTS.object;
}

// Create singleton error handler
export const memorySafeErrorHandler = createMemorySafeErrorHandler();

// Export commonly used patterns
export const safeExecute = withErrorBoundary;
export const safeExecuteAsync = withAsyncErrorBoundary;
export const safeExecuteWithPerformance = withPerformanceAwareErrorBoundary;