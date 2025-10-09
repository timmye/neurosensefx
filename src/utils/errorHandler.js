/**
 * Comprehensive error handling utilities for NeuroSense FX
 * Provides centralized error handling, logging, and recovery mechanisms
 */

// Error types and categories
export const ErrorTypes = {
  NETWORK: 'network',
  DATA: 'data',
  VALIDATION: 'validation',
  WORKSPACE: 'workspace',
  CANVAS: 'canvas',
  WEBSOCKET: 'websocket',
  PERFORMANCE: 'performance',
  USER_INPUT: 'user_input',
  SYSTEM: 'system'
};

export const ErrorSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Custom error class for NeuroSense FX
 */
export class NeuroSenseError extends Error {
  constructor(message, type = ErrorTypes.SYSTEM, severity = ErrorSeverity.MEDIUM, context = {}) {
    super(message);
    this.name = 'NeuroSenseError';
    this.type = type;
    this.severity = severity;
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.id = this.generateErrorId();
  }

  generateErrorId() {
    return `ns_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      message: this.message,
      type: this.type,
      severity: this.severity,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

/**
 * Error handler class for centralized error management
 */
export class ErrorHandler {
  constructor(options = {}) {
    this.options = {
      enableConsoleLogging: true,
      enableRemoteLogging: false,
      maxLogSize: 1000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...options
    };

    this.errorLog = [];
    this.errorCallbacks = new Map();
    this.retryQueue = new Map();
    this.performanceMetrics = {
      totalErrors: 0,
      errorsByType: {},
      errorsBySeverity: {},
      lastErrorTime: null
    };
  }

  /**
   * Handle an error
   * @param {Error|NeuroSenseError|string} error - Error to handle
   * @param {Object} context - Additional context information
   */
  handleError(error, context = {}) {
    const normalizedError = this.normalizeError(error, context);
    
    // Log the error
    this.logError(normalizedError);
    
    // Update metrics
    this.updateMetrics(normalizedError);
    
    // Trigger callbacks
    this.triggerCallbacks(normalizedError);
    
    // Attempt recovery if possible
    this.attemptRecovery(normalizedError);
    
    return normalizedError;
  }

  /**
   * Normalize error to NeuroSenseError format
   * @param {Error|NeuroSenseError|string} error - Error to normalize
   * @param {Object} context - Additional context
   * @returns {NeuroSenseError} Normalized error
   */
  normalizeError(error, context) {
    if (error instanceof NeuroSenseError) {
      return error;
    }

    let message, type, severity;

    if (error instanceof Error) {
      message = error.message;
      type = this.inferErrorType(error);
      severity = this.inferErrorSeverity(error);
    } else if (typeof error === 'string') {
      message = error;
      type = ErrorTypes.USER_INPUT;
      severity = ErrorSeverity.MEDIUM;
    } else {
      message = 'Unknown error occurred';
      type = ErrorTypes.SYSTEM;
      severity = ErrorSeverity.HIGH;
    }

    return new NeuroSenseError(message, type, severity, {
      ...context,
      originalError: error
    });
  }

  /**
   * Infer error type from error characteristics
   * @param {Error} error - Error to analyze
   * @returns {string} Error type
   */
  inferErrorType(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return ErrorTypes.NETWORK;
    }
    if (message.includes('websocket') || message.includes('ws')) {
      return ErrorTypes.WEBSOCKET;
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorTypes.VALIDATION;
    }
    if (message.includes('workspace') || message.includes('layout')) {
      return ErrorTypes.WORKSPACE;
    }
    if (message.includes('canvas') || message.includes('render')) {
      return ErrorTypes.CANVAS;
    }
    if (message.includes('performance') || message.includes('timeout')) {
      return ErrorTypes.PERFORMANCE;
    }
    if (message.includes('data') || message.includes('parse')) {
      return ErrorTypes.DATA;
    }
    
    return ErrorTypes.SYSTEM;
  }

  /**
   * Infer error severity from error characteristics
   * @param {Error} error - Error to analyze
   * @returns {string} Error severity
   */
  inferErrorSeverity(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('critical') || message.includes('fatal')) {
      return ErrorSeverity.CRITICAL;
    }
    if (message.includes('warning') || message.includes('deprecated')) {
      return ErrorSeverity.LOW;
    }
    if (message.includes('error') || message.includes('failed')) {
      return ErrorSeverity.HIGH;
    }
    
    return ErrorSeverity.MEDIUM;
  }

  /**
   * Log error to console and internal log
   * @param {NeuroSenseError} error - Error to log
   */
  logError(error) {
    // Add to internal log
    this.errorLog.push(error);
    
    // Maintain log size
    if (this.errorLog.length > this.options.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.options.maxLogSize);
    }

    // Console logging
    if (this.options.enableConsoleLogging) {
      const logMethod = this.getLogMethod(error.severity);
      logMethod(`[${error.type.toUpperCase()}] ${error.message}`, {
        id: error.id,
        type: error.type,
        severity: error.severity,
        context: error.context,
        timestamp: error.timestamp
      });
    }

    // Remote logging (if enabled)
    if (this.options.enableRemoteLogging) {
      this.sendToRemoteLogging(error);
    }
  }

  /**
   * Get appropriate console log method based on severity
   * @param {string} severity - Error severity
   * @returns {Function} Console method
   */
  getLogMethod(severity) {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return console.error;
      case ErrorSeverity.HIGH:
        return console.error;
      case ErrorSeverity.MEDIUM:
        return console.warn;
      case ErrorSeverity.LOW:
        return console.info;
      default:
        return console.log;
    }
  }

  /**
   * Update performance metrics
   * @param {NeuroSenseError} error - Error to analyze
   */
  updateMetrics(error) {
    this.performanceMetrics.totalErrors++;
    this.performanceMetrics.lastErrorTime = error.timestamp;
    
    // Count by type
    this.performanceMetrics.errorsByType[error.type] = 
      (this.performanceMetrics.errorsByType[error.type] || 0) + 1;
    
    // Count by severity
    this.performanceMetrics.errorsBySeverity[error.severity] = 
      (this.performanceMetrics.errorsBySeverity[error.severity] || 0) + 1;
  }

  /**
   * Trigger registered error callbacks
   * @param {NeuroSenseError} error - Error that occurred
   */
  triggerCallbacks(error) {
    for (const [callback, options] of this.errorCallbacks) {
      try {
        if (this.shouldTriggerCallback(error, options)) {
          callback(error);
        }
      } catch (callbackError) {
        console.error('Error in error callback:', callbackError);
      }
    }
  }

  /**
   * Check if callback should be triggered for this error
   * @param {NeuroSenseError} error - Error that occurred
   * @param {Object} options - Callback options
   * @returns {boolean} Whether to trigger callback
   */
  shouldTriggerCallback(error, options) {
    if (options.types && !options.types.includes(error.type)) {
      return false;
    }
    if (options.severities && !options.severities.includes(error.severity)) {
      return false;
    }
    if (options.filter && !options.filter(error)) {
      return false;
    }
    return true;
  }

  /**
   * Attempt error recovery based on error type
   * @param {NeuroSenseError} error - Error to recover from
   */
  attemptRecovery(error) {
    switch (error.type) {
      case ErrorTypes.NETWORK:
        this.scheduleRetry(error, () => this.retryNetworkOperation(error));
        break;
      case ErrorTypes.WEBSOCKET:
        this.scheduleRetry(error, () => this.retryWebSocketConnection(error));
        break;
      case ErrorTypes.WORKSPACE:
        this.recoverWorkspace(error);
        break;
      case ErrorTypes.CANVAS:
        this.recoverCanvas(error);
        break;
      default:
        // No automatic recovery for other error types
        break;
    }
  }

  /**
   * Schedule retry operation with exponential backoff
   * @param {NeuroSenseError} error - Error that occurred
   * @param {Function} retryFunction - Function to retry
   */
  scheduleRetry(error, retryFunction) {
    const retryKey = `${error.type}_${error.context.operation || 'unknown'}`;
    const currentAttempt = this.retryQueue.get(retryKey)?.attempt || 0;

    if (currentAttempt >= this.options.retryAttempts) {
      console.warn(`Max retry attempts reached for ${retryKey}`);
      return;
    }

    const delay = this.options.retryDelay * Math.pow(2, currentAttempt);
    
    setTimeout(async () => {
      try {
        await retryFunction();
        this.retryQueue.delete(retryKey);
        console.log(`Retry successful for ${retryKey}`);
      } catch (retryError) {
        this.retryQueue.set(retryKey, {
          attempt: currentAttempt + 1,
          lastError: retryError,
          timestamp: Date.now()
        });
        
        if (currentAttempt + 1 < this.options.retryAttempts) {
          this.scheduleRetry(error, retryFunction);
        }
      }
    }, delay);
  }

  /**
   * Retry network operation
   * @param {NeuroSenseError} error - Network error
   */
  async retryNetworkOperation(error) {
    const { url, method, body, headers } = error.context;
    
    if (!url) {
      throw new Error('Network retry requires URL in error context');
    }

    // Implement exponential backoff with jitter
    const baseDelay = 1000;
    const maxDelay = 30000;
    const attempt = this.retryQueue.get(`network_${url}`)?.attempt || 0;
    
    if (attempt >= this.options.retryAttempts) {
      throw new Error(`Max retry attempts (${this.options.retryAttempts}) reached for network operation`);
    }

    const delay = Math.min(baseDelay * Math.pow(2, attempt) + Math.random() * 1000, maxDelay);
    
    console.log(`[ErrorHandler] Retrying network operation to ${url} (attempt ${attempt + 1}/${this.options.retryAttempts}) after ${delay}ms`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      const response = await fetch(url, {
        method: method || 'GET',
        headers: headers || {},
        body: body || null
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      console.log(`[ErrorHandler] Network retry successful for ${url}`);
      return response;
    } catch (retryError) {
      console.error(`[ErrorHandler] Network retry failed for ${url}:`, retryError.message);
      throw retryError;
    }
  }

  /**
   * Retry WebSocket connection
   * @param {NeuroSenseError} error - WebSocket error
   */
  async retryWebSocketConnection(error) {
    // Import wsClient dynamically to avoid circular dependencies
    const { connect, wsStatus } = await import('../data/wsClient.js');
    
    const reconnect = async () => {
      console.log(`[ErrorHandler] Attempting WebSocket reconnection (attempt ${this.retryQueue.get('websocket')?.attempt + 1 || 1})`);
      
      // Clear any existing connection
      const { disconnect } = await import('../data/wsClient.js');
      disconnect();
      
      // Wait before reconnecting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Attempt to reconnect
      connect();
      
      // Wait for connection result
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, 10000);
        
        const unsubscribe = wsStatus.subscribe(status => {
          if (status === 'connected') {
            clearTimeout(timeout);
            unsubscribe();
            console.log('[ErrorHandler] WebSocket reconnection successful');
            resolve();
          } else if (status === 'error' || status === 'disconnected') {
            clearTimeout(timeout);
            unsubscribe();
            reject(new Error('WebSocket reconnection failed'));
          }
        });
      });
    };
    
    try {
      await reconnect();
    } catch (retryError) {
      console.error('[ErrorHandler] WebSocket reconnection failed:', retryError.message);
      throw retryError;
    }
  }

  /**
   * Recover workspace state
   * @param {NeuroSenseError} error - Workspace error
   */
  recoverWorkspace(error) {
    // Attempt to reset workspace to last known good state
    try {
      if (typeof localStorage !== 'undefined') {
        const lastGoodWorkspace = localStorage.getItem('neurosense_workspace_backup');
        if (lastGoodWorkspace) {
          console.log('Attempting workspace recovery from backup');
          // This would trigger workspace restoration
        }
      }
    } catch (recoveryError) {
      console.error('Workspace recovery failed:', recoveryError);
    }
  }

  /**
   * Recover canvas state
   * @param {NeuroSenseError} error - Canvas error
   */
  recoverCanvas(error) {
    // Attempt to reset canvas to safe state
    try {
      console.log('Attempting canvas recovery');
      // This would trigger canvas reset or reinitialization
    } catch (recoveryError) {
      console.error('Canvas recovery failed:', recoveryError);
    }
  }

  /**
   * Send error to remote logging service
   * @param {NeuroSenseError} error - Error to send
   */
  async sendToRemoteLogging(error) {
    try {
      // Implementation depends on logging service
      // For now, just log to console
      console.log('Remote logging:', error.toJSON());
    } catch (loggingError) {
      console.error('Failed to send error to remote logging:', loggingError);
    }
  }

  /**
   * Register error callback
   * @param {Function} callback - Callback function
   * @param {Object} options - Callback options
   */
  onError(callback, options = {}) {
    this.errorCallbacks.set(callback, options);
  }

  /**
   * Unregister error callback
   * @param {Function} callback - Callback function to remove
   */
  offError(callback) {
    this.errorCallbacks.delete(callback);
  }

  /**
   * Get error log
   * @param {Object} filters - Filters to apply
   * @returns {Array} Filtered error log
   */
  getErrorLog(filters = {}) {
    let filteredLog = [...this.errorLog];

    if (filters.type) {
      filteredLog = filteredLog.filter(error => error.type === filters.type);
    }

    if (filters.severity) {
      filteredLog = filteredLog.filter(error => error.severity === filters.severity);
    }

    if (filters.since) {
      const since = new Date(filters.since);
      filteredLog = filteredLog.filter(error => new Date(error.timestamp) >= since);
    }

    if (filters.limit) {
      filteredLog = filteredLog.slice(-filters.limit);
    }

    return filteredLog;
  }

  /**
   * Get performance metrics
   * @returns {Object} Performance metrics
   */
  getMetrics() {
    return {
      ...this.performanceMetrics,
      errorLogSize: this.errorLog.length,
      retryQueueSize: this.retryQueue.size,
      callbackCount: this.errorCallbacks.size
    };
  }

  /**
   * Clear error log
   */
  clearLog() {
    this.errorLog = [];
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.performanceMetrics = {
      totalErrors: 0,
      errorsByType: {},
      errorsBySeverity: {},
      lastErrorTime: null
    };
  }
}

// Global error handler instance
export const globalErrorHandler = new ErrorHandler();

/**
 * Error boundary component wrapper for Svelte
 */
export function createErrorBoundary(fallbackComponent) {
  return {
    onError: (error) => {
      globalErrorHandler.handleError(error, {
        component: 'ErrorBoundary',
        action: 'component_render'
      });
    },
    fallback: fallbackComponent
  };
}

/**
 * Async error wrapper for Promise handling
 * @param {Function} asyncFunction - Async function to wrap
 * @param {Object} context - Context for error handling
 * @returns {Function} Wrapped function
 */
export function withErrorHandling(asyncFunction, context = {}) {
  return async (...args) => {
    try {
      return await asyncFunction(...args);
    } catch (error) {
      globalErrorHandler.handleError(error, {
        ...context,
        function: asyncFunction.name,
        arguments: args
      });
      throw error;
    }
  };
}

/**
 * Validation error handler
 * @param {Object} validationResult - Validation result
 * @param {string} context - Validation context
 * @throws {NeuroSenseError} If validation fails
 */
export function handleValidationError(validationResult, context = 'validation') {
  if (!validationResult.isValid) {
    const error = new NeuroSenseError(
      `Validation failed: ${validationResult.errors.join(', ')}`,
      ErrorTypes.VALIDATION,
      ErrorSeverity.MEDIUM,
      { context, errors: validationResult.errors }
    );
    globalErrorHandler.handleError(error);
    throw error;
  }
}

/**
 * Network error handler
 * @param {Response|Error} response - Network response or error
 * @param {Object} context - Request context
 * @throws {NeuroSenseError} If network request failed
 */
export function handleNetworkError(response, context = {}) {
  if (response instanceof Error) {
    const error = new NeuroSenseError(
      `Network error: ${response.message}`,
      ErrorTypes.NETWORK,
      ErrorSeverity.HIGH,
      { ...context, originalError: response }
    );
    globalErrorHandler.handleError(error);
    throw error;
  }

  if (!response.ok) {
    const error = new NeuroSenseError(
      `HTTP ${response.status}: ${response.statusText}`,
      ErrorTypes.NETWORK,
      ErrorSeverity.HIGH,
      { ...context, status: response.status, statusText: response.statusText }
    );
    globalErrorHandler.handleError(error);
    throw error;
  }
}

/**
 * WebSocket error handler
 * @param {Event|Error} event - WebSocket event or error
 * @param {Object} context - WebSocket context
 */
export function handleWebSocketError(event, context = {}) {
  const message = event.message || event.reason || 'WebSocket connection error';
  const error = new NeuroSenseError(
    `WebSocket error: ${message}`,
    ErrorTypes.WEBSOCKET,
    ErrorSeverity.HIGH,
    { ...context, event, code: event.code }
  );
  globalErrorHandler.handleError(error);
}

/**
 * Performance error handler
 * @param {Object} metrics - Performance metrics
 * @param {Object} context - Performance context
 */
export function handlePerformanceError(metrics, context = {}) {
  const error = new NeuroSenseError(
    `Performance issue detected: ${JSON.stringify(metrics)}`,
    ErrorTypes.PERFORMANCE,
    ErrorSeverity.MEDIUM,
    { ...context, metrics }
  );
  globalErrorHandler.handleError(error);
}

// Initialize global error handlers
if (typeof window !== 'undefined') {
  // Handle unhandled JavaScript errors
  window.addEventListener('error', (event) => {
    globalErrorHandler.handleError(event.error || new Error(event.message), {
      type: 'unhandled_error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    globalErrorHandler.handleError(event.reason, {
      type: 'unhandled_promise_rejection',
      promise: event.promise
    });
  });
}

// Export convenience functions
export const handleError = (error, context) => globalErrorHandler.handleError(error, context);
export const onError = (callback, options) => globalErrorHandler.onError(callback, options);
export const offError = (callback) => globalErrorHandler.offError(callback);
export const getErrorLog = (filters) => globalErrorHandler.getErrorLog(filters);
export const getErrorMetrics = () => globalErrorHandler.getMetrics();
