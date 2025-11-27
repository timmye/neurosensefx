/**
 * Trading Safety Manager
 *
 * Provides comprehensive protection for critical trading functionality with
 * failsafe mechanisms, validation, and emergency procedures to ensure trading
 * platform stability and data integrity.
 *
 * Design Philosophy: "Simple, Performant, Maintainable"
 * - Simple: Clear safety rules with predictable behavior
 * - Performant: <1ms safety check overhead, emergency response <10ms
 * - Maintainable: Centralized trading safety management
 */

import { withErrorBoundary, withAsyncErrorBoundary, CircuitBreaker } from './errorBoundaryUtils.js';

/**
 * Trading safety levels
 */
export const SAFETY_LEVELS = {
  NORMAL: 'NORMAL',
  DEGRADED: 'DEGRADED',
  EMERGENCY: 'EMERGENCY',
  LOCKDOWN: 'LOCKDOWN'
};

/**
 * Critical trading operations
 */
export const TRADING_OPERATIONS = {
  DISPLAY_CREATE: 'DISPLAY_CREATE',
  DISPLAY_REMOVE: 'DISPLAY_REMOVE',
  SYMBOL_SEARCH: 'SYMBOL_SEARCH',
  SHORTCUT_EXECUTE: 'SHORTCUT_EXECUTE',
  DATA_RECEIVE: 'DATA_RECEIVE',
  CONFIG_UPDATE: 'CONFIG_UPDATE'
};

/**
 * Trading Safety Manager class
 */
export class TradingSafetyManager {
  constructor(options = {}) {
    this.safetyLevel = SAFETY_LEVELS.NORMAL;
    this.emergencyMode = false;
    this.criticalOperations = new Map();
    this.safetyChecks = new Map();
    this.failsafeTriggers = new Map();
    this.emergencyProcedures = new Map();

    // Performance and health monitoring
    this.operationMetrics = {
      totalOperations: 0,
      failedOperations: 0,
      averageOperationTime: 0,
      emergencyActivations: 0,
      lastEmergencyTime: null
    };

    // Safety thresholds
    this.thresholds = {
      maxErrorRate: 0.1, // 10% error rate triggers degraded mode
      maxResponseTime: 100, // 100ms average response time
      maxConsecutiveErrors: 5, // 5 consecutive errors triggers emergency
      emergencyCooldown: 60000, // 1 minute cooldown between emergencies
      ...options.thresholds
    };

    this.errorHistory = [];
    this.consecutiveErrors = 0;
    this.lastErrorTime = null;

    // Initialize safety checks and procedures
    this.initializeSafetyChecks();
    this.initializeEmergencyProcedures();
    this.startHealthMonitoring();
  }

  /**
   * Initialize safety checks for critical operations
   */
  initializeSafetyChecks() {
    // Display creation safety check
    this.safetyChecks.set(TRADING_OPERATIONS.DISPLAY_CREATE, (symbol, position, config) => {
      if (this.safetyLevel === SAFETY_LEVELS.LOCKDOWN) {
        throw new Error('Display creation disabled in lockdown mode');
      }

      if (!symbol || typeof symbol !== 'string') {
        throw new Error('Invalid symbol for display creation');
      }

      if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
        throw new Error('Invalid position for display creation');
      }

      // Check for display limit
      const currentDisplayCount = this.getCurrentDisplayCount();
      if (currentDisplayCount >= 50 && this.safetyLevel !== SAFETY_LEVELS.NORMAL) {
        throw new Error(`Display limit exceeded: ${currentDisplayCount}/50`);
      }

      return true;
    });

    // Symbol search safety check
    this.safetyChecks.set(TRADING_OPERATIONS.SYMBOL_SEARCH, (query) => {
      if (!query || typeof query !== 'string') {
        throw new Error('Invalid search query');
      }

      if (query.length > 20) {
        throw new Error('Search query too long');
      }

      return true;
    });

    // Shortcut execution safety check
    this.safetyChecks.set(TRADING_OPERATIONS.SHORTCUT_EXECUTE, (shortcut, context) => {
      if (this.safetyLevel === SAFETY_LEVELS.LOCKDOWN) {
        // Only allow emergency shortcuts in lockdown
        const allowedShortcuts = ['emergency_reset', 'safety_override'];
        if (!allowedShortcuts.includes(shortcut)) {
          throw new Error(`Shortcut ${shortcut} not allowed in lockdown mode`);
        }
      }

      return true;
    });

    // Data reception safety check
    this.safetyChecks.set(TRADING_OPERATIONS.DATA_RECEIVE, (data) => {
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid data format');
      }

      // Validate critical data fields
      if (data.symbol && typeof data.symbol !== 'string') {
        throw new Error('Invalid symbol in data');
      }

      if (data.bid !== undefined && (typeof data.bid !== 'number' || data.bid < 0)) {
        throw new Error('Invalid bid price in data');
      }

      if (data.ask !== undefined && (typeof data.ask !== 'number' || data.ask < 0)) {
        throw new Error('Invalid ask price in data');
      }

      return true;
    });

    // Config update safety check
    this.safetyChecks.set(TRADING_OPERATIONS.CONFIG_UPDATE, (config) => {
      if (!config || typeof config !== 'object') {
        throw new Error('Invalid config format');
      }

      // Prevent dangerous config changes in emergency mode
      if (this.safetyLevel === SAFETY_LEVELS.EMERGENCY) {
        const allowedConfigs = ['emergency', 'safety'];
        const hasAllowedConfig = Object.keys(config).some(key => allowedConfigs.includes(key));
        if (!hasAllowedConfig) {
          throw new Error('Config updates restricted in emergency mode');
        }
      }

      return true;
    });
  }

  /**
   * Initialize emergency procedures
   */
  initializeEmergencyProcedures() {
    // Emergency reset procedure
    this.emergencyProcedures.set('emergency_reset', async () => {
      console.warn('[TRADING_SAFETY] Executing emergency reset procedure');

      try {
        // Clear all non-essential operations
        this.criticalOperations.clear();

        // Reset error counters
        this.consecutiveErrors = 0;
        this.errorHistory = [];

        // Restore safe state
        await this.restoreSafeState();

        console.log('[TRADING_SAFETY] Emergency reset completed');
        return true;
      } catch (error) {
        console.error('[TRADING_SAFETY] Emergency reset failed:', error);
        return false;
      }
    });

    // Safety override procedure
    this.emergencyProcedures.set('safety_override', async (level) => {
      console.warn(`[TRADING_SAFETY] Safety override to level: ${level}`);

      const validLevels = Object.values(SAFETY_LEVELS);
      if (!validLevels.includes(level)) {
        throw new Error(`Invalid safety level: ${level}`);
      }

      this.safetyLevel = level;
      this.operationMetrics.emergencyActivations++;
      this.operationMetrics.lastEmergencyTime = new Date();

      return true;
    });

    // Force display cleanup
    this.emergencyProcedures.set('force_cleanup', async () => {
      console.warn('[TRADING_SAFETY] Force cleanup procedure activated');

      try {
        // Clean up problematic displays
        const problematicDisplays = this.identifyProblematicDisplays();

        for (const displayId of problematicDisplays) {
          await this.safeRemoveDisplay(displayId);
        }

        return true;
      } catch (error) {
        console.error('[TRADING_SAFETY] Force cleanup failed:', error);
        return false;
      }
    });
  }

  /**
   * Execute operation with safety checks
   */
  async executeOperation(operation, ...args) {
    const startTime = performance.now();
    this.operationMetrics.totalOperations++;

    try {
      // Pre-operation safety check
      await this.performSafetyCheck(operation, ...args);

      // Execute the operation with error boundary
      const result = await this.circuitBreaker.execute(async () => {
        return await this.executeCriticalOperation(operation, ...args);
      }, null, `TradingOperation.${operation}`);

      // Record successful operation
      this.recordOperationSuccess();
      this.consecutiveErrors = 0;

      return result;

    } catch (error) {
      // Record failed operation
      this.recordOperationFailure(operation, error, args);

      // Check for emergency triggers
      this.checkEmergencyTriggers();

      // Return safe fallback or re-throw
      return this.handleOperationFailure(operation, error, args);
    } finally {
      // Record operation time
      const operationTime = performance.now() - startTime;
      this.recordOperationTime(operationTime);
    }
  }

  /**
   * Perform safety check for operation
   */
  async performSafetyCheck(operation, ...args) {
    const safetyCheck = this.safetyChecks.get(operation);
    if (!safetyCheck) {
      console.warn(`[TRADING_SAFETY] No safety check for operation: ${operation}`);
      return true;
    }

    return safetyCheck(...args);
  }

  /**
   * Execute critical operation
   */
  async executeCriticalOperation(operation, ...args) {
    // This would integrate with the actual trading operations
    // For now, return a placeholder result
    console.log(`[TRADING_SAFETY] Executing operation: ${operation}`, args);
    return { success: true, operation, args };
  }

  /**
   * Handle operation failure with fallbacks
   */
  handleOperationFailure(operation, error, args) {
    console.error(`[TRADING_SAFETY] Operation failed: ${operation}`, error);

    // Provide safe fallbacks for critical operations
    switch (operation) {
      case TRADING_OPERATIONS.DISPLAY_CREATE:
        return {
          success: false,
          fallback: true,
          message: 'Display creation failed, using fallback mode',
          displayId: `fallback-${Date.now()}`
        };

      case TRADING_OPERATIONS.SYMBOL_SEARCH:
        return {
          success: false,
          fallback: true,
          message: 'Search failed, returning empty results',
          results: []
        };

      case TRADING_OPERATIONS.DATA_RECEIVE:
        // For data reception, silently drop invalid data
        return null;

      default:
        throw error;
    }
  }

  /**
   * Record operation success
   */
  recordOperationSuccess() {
    // Update consecutive success count
    if (this.consecutiveErrors > 0) {
      this.consecutiveErrors = Math.max(0, this.consecutiveErrors - 1);
    }
  }

  /**
   * Record operation failure
   */
  recordOperationFailure(operation, error, args) {
    this.operationMetrics.failedOperations++;
    this.consecutiveErrors++;

    const errorRecord = {
      timestamp: new Date().toISOString(),
      operation,
      error: error.message,
      stack: error.stack,
      args: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg),
      safetyLevel: this.safetyLevel
    };

    this.errorHistory.push(errorRecord);
    this.lastErrorTime = new Date();

    // Limit error history size
    if (this.errorHistory.length > 100) {
      this.errorHistory.shift();
    }
  }

  /**
   * Record operation time
   */
  recordOperationTime(time) {
    const total = this.operationMetrics.averageOperationTime * (this.operationMetrics.totalOperations - 1) + time;
    this.operationMetrics.averageOperationTime = total / this.operationMetrics.totalOperations;
  }

  /**
   * Check for emergency triggers
   */
  checkEmergencyTriggers() {
    const errorRate = this.operationMetrics.failedOperations / Math.max(this.operationMetrics.totalOperations, 1);
    const avgTime = this.operationMetrics.averageOperationTime;

    // Check consecutive errors
    if (this.consecutiveErrors >= this.thresholds.maxConsecutiveErrors) {
      this.triggerEmergency('consecutive_errors', `Too many consecutive errors: ${this.consecutiveErrors}`);
      return;
    }

    // Check error rate
    if (errorRate >= this.thresholds.maxErrorRate) {
      this.setSafetyLevel(SAFETY_LEVELS.DEGRADED, `High error rate: ${(errorRate * 100).toFixed(1)}%`);
      return;
    }

    // Check response time
    if (avgTime >= this.thresholds.maxResponseTime) {
      this.setSafetyLevel(SAFETY_LEVELS.DEGRADED, `High response time: ${avgTime.toFixed(1)}ms`);
    }
  }

  /**
   * Trigger emergency mode
   */
  triggerEmergency(reason, details = '') {
    if (this.safetyLevel === SAFETY_LEVELS.EMERGENCY || this.safetyLevel === SAFETY_LEVELS.LOCKDOWN) {
      return; // Already in emergency mode
    }

    console.error(`[TRADING_SAFETY] EMERGENCY TRIGGERED: ${reason}`, details);
    this.setSafetyLevel(SAFETY_LEVELS.EMERGENCY, reason);

    // Execute emergency reset procedure
    this.executeEmergencyProcedure('emergency_reset');
  }

  /**
   * Set safety level
   */
  setSafetyLevel(level, reason = '') {
    const previousLevel = this.safetyLevel;
    this.safetyLevel = level;

    console.log(`[TRADING_SAFETY] Safety level changed: ${previousLevel} -> ${level} (${reason})`);

    // Update safety level behavior
    switch (level) {
      case SAFETY_LEVELS.DEGRADED:
        // Reduce operation frequency, increase validation
        break;
      case SAFETY_LEVELS.EMERGENCY:
        // Enable emergency procedures
        this.emergencyMode = true;
        break;
      case SAFETY_LEVELS.LOCKDOWN:
        // Disable all non-essential operations
        console.warn('[TRADING_SAFETY] LOCKDOWN MODE ACTIVATED');
        break;
      case SAFETY_LEVELS.NORMAL:
        // Resume normal operation
        this.emergencyMode = false;
        break;
    }
  }

  /**
   * Execute emergency procedure
   */
  async executeEmergencyProcedure(procedureName, ...args) {
    const procedure = this.emergencyProcedures.get(procedureName);
    if (!procedure) {
      throw new Error(`Unknown emergency procedure: ${procedureName}`);
    }

    try {
      return await procedure(...args);
    } catch (error) {
      console.error(`[TRADING_SAFETY] Emergency procedure failed: ${procedureName}`, error);
      throw error;
    }
  }

  /**
   * Get current safety status
   */
  getSafetyStatus() {
    return {
      safetyLevel: this.safetyLevel,
      emergencyMode: this.emergencyMode,
      consecutiveErrors: this.consecutiveErrors,
      lastErrorTime: this.lastErrorTime,
      metrics: { ...this.operationMetrics },
      recentErrors: this.errorHistory.slice(-10),
      thresholds: { ...this.thresholds }
    };
  }

  /**
   * Get current display count
   */
  getCurrentDisplayCount() {
    // This would integrate with the display store
    return 0; // Placeholder
  }

  /**
   * Identify problematic displays
   */
  identifyProblematicDisplays() {
    // This would identify displays with errors or performance issues
    return []; // Placeholder
  }

  /**
   * Safely remove a display
   */
  async safeRemoveDisplay(displayId) {
    console.log(`[TRADING_SAFETY] Safely removing display: ${displayId}`);
    // Implementation would integrate with display store
    return true;
  }

  /**
   * Restore safe state
   */
  async restoreSafeState() {
    console.log('[TRADING_SAFETY] Restoring safe state');
    // Implementation would reset stores to safe defaults
    return true;
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    setInterval(() => {
      this.checkEmergencyTriggers();
    }, 5000);
  }
}

/**
 * Singleton trading safety manager instance
 */
export const tradingSafetyManager = new TradingSafetyManager({
  thresholds: {
    maxErrorRate: 0.1,
    maxResponseTime: 100,
    maxConsecutiveErrors: 5,
    emergencyCooldown: 60000
  }
});

/**
 * Wrapper for trading operations with safety
 */
export function withTradingSafety(operation, ...args) {
  return tradingSafetyManager.executeOperation(operation, ...args);
}

/**
 * Emergency shortcut for safety override
 */
export function emergencySafetyOverride(level) {
  return tradingSafetyManager.executeEmergencyProcedure('safety_override', level);
}

export default tradingSafetyManager;