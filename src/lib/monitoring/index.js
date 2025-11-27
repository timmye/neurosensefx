/**
 * Production Monitoring System
 *
 * Comprehensive monitoring and alerting for the NeuroSense FX trading platform.
 * This module provides unified access to all monitoring components.
 */

// Main initialization functions
export {
  initializeProductionMonitoring,
  initializeDevelopmentMonitoring,
  initializeTestMonitoring,
  autoInitializeMonitoring,
  initializeSvelteMonitoring,
  createMonitoringHelpers,
  getConfig
} from './initializeProductionMonitoring.js';

// Core monitoring systems
export { ProductionMonitoringInfrastructure } from './ProductionMonitoringInfrastructure.js';
export { ErrorMonitoringSystem, ERROR_SEVERITY, ERROR_CATEGORIES } from './ErrorMonitoringSystem.js';
export { TradingOperationsMonitor, TRADING_OPERATIONS, TRADING_WORKFLOWS } from './TradingOperationsMonitor.js';
export { SystemHealthMonitor, HEALTH_STATUS } from './SystemHealthMonitor.js';
export { ProductionAnalyticsSystem, REPORT_TYPES, INSIGHT_CATEGORIES } from './ProductionAnalyticsSystem.js';
export { ProductionAlertingSystem, ALERT_SEVERITY, ALERT_STATUS } from './ProductionAlertingSystem.js';

// Management and orchestration
export { ProductionMonitoringManager, SYSTEM_STATUS } from './ProductionMonitoringManager.js';

// Configuration
export {
  getFinalMonitoringConfig,
  PRODUCTION_ENVIRONMENT_CONFIG,
  DEVELOPMENT_ENVIRONMENT_CONFIG,
  TEST_ENVIRONMENT_CONFIG
} from './productionMonitoringConfig.js';

// Convenience imports for common use cases
export { getProductionMonitor } from './ProductionMonitoringInfrastructure.js';
export { getErrorMonitor } from './ErrorMonitoringSystem.js';
export { getTradingOperationsMonitor } from './TradingOperationsMonitor.js';
export { getSystemHealthMonitor } from './SystemHealthMonitor.js';
export { getProductionAnalytics } from './ProductionAnalyticsSystem.js';
export { getAlertingSystem } from './ProductionAlertingSystem.js';
export { getProductionMonitoringManager } from './ProductionMonitoringManager.js';

/**
 * Quick start function for production monitoring
 *
 * This is the simplest way to get started with production monitoring:
 *
 * ```javascript
 * import { quickStartMonitoring } from '@/lib/monitoring';
 *
 * // Initialize monitoring
 * const monitoring = await quickStartMonitoring();
 *
 * // Use monitoring helpers
 * monitoring.helpers.reportError(new Error('Something went wrong'));
 * monitoring.helpers.trackUserAction('button_click', { button: 'save' });
 * ```
 */
export async function quickStartMonitoring(customConfig = {}) {
  const { initializeProductionMonitoring, createMonitoringHelpers } = await import('./initializeProductionMonitoring.js');

  const monitoringManager = await initializeProductionMonitoring(customConfig);
  const helpers = createMonitoringHelpers(monitoringManager);

  return {
    manager: monitoringManager,
    helpers,
    // Direct access to systems for advanced usage
    systems: monitoringManager.systems
  };
}

/**
 * Development monitoring quick start
 */
export async function quickStartDevMonitoring(customConfig = {}) {
  const { initializeDevelopmentMonitoring, createMonitoringHelpers } = await import('./initializeProductionMonitoring.js');

  const monitoringManager = await initializeDevelopmentMonitoring(customConfig);
  const helpers = createMonitoringHelpers(monitoringManager);

  return {
    manager: monitoringManager,
    helpers,
    systems: monitoringManager.systems
  };
}

/**
 * Test monitoring quick start
 */
export async function quickStartTestMonitoring(customConfig = {}) {
  const { initializeTestMonitoring, createMonitoringHelpers } = await import('./initializeProductionMonitoring.js');

  const monitoringManager = await initializeTestMonitoring(customConfig);
  const helpers = createMonitoringHelpers(monitoringManager);

  return {
    manager: monitoringManager,
    helpers,
    systems: monitoringManager.systems
  };
}

/**
 * Create monitoring decorator for functions
 *
 * Automatically monitors function execution time and errors
 *
 * ```javascript
 * import { monitorFunction } from '@/lib/monitoring';
 *
 * const monitoredFunction = monitorFunction('myFunction', async () => {
 *   // Your function code here
 * });
 * ```
 */
export function monitorFunction(name, fn) {
  return async (...args) => {
    const startTime = performance.now();

    try {
      const result = await fn(...args);
      const duration = performance.now() - startTime;

      // Log successful execution
      console.debug(`[Monitoring] ${name} completed in ${duration.toFixed(2)}ms`);

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;

      // Log error
      console.error(`[Monitoring] ${name} failed after ${duration.toFixed(2)}ms:`, error);

      // Report to error monitoring if available
      if (typeof window !== 'undefined' && window.__monitoringHelpers) {
        window.__monitoringHelpers.reportError(error, {
          functionName: name,
          duration,
          arguments: args.length
        });
      }

      throw error;
    }
  };
}

/**
 * Global monitoring setup
 *
 * Call this once during application startup to make monitoring helpers globally available
 */
export function setupGlobalMonitoring(monitoringManager) {
  if (typeof window !== 'undefined') {
    const helpers = createMonitoringHelpers(monitoringManager);

    // Make helpers available globally
    window.__monitoringHelpers = helpers;
    window.__monitoringManager = monitoringManager;

    // Add convenience functions to window
    window.reportError = helpers.reportError;
    window.trackUserAction = helpers.trackUserAction;
    window.createAlert = helpers.createAlert;
    window.getMonitoringStatus = helpers.getStatus;
  }
}

/**
 * Monitoring health check utility
 */
export async function performHealthCheck(monitoringManager) {
  try {
    const report = monitoringManager.getMonitoringReport();

    const healthCheck = {
      overall: {
        status: report.globalHealth.status,
        score: report.globalHealth.score,
        uptime: report.globalHealth.uptime
      },
      systems: {},
      timestamp: Date.now()
    };

    // Check individual system health
    for (const [systemName, systemReport] of Object.entries(report.systems)) {
      healthCheck.systems[systemName] = {
        status: 'unknown', // Would be determined from system report
        lastUpdate: Date.now()
      };
    }

    return healthCheck;

  } catch (error) {
    console.error('Health check failed:', error);
    return {
      overall: { status: 'ERROR', score: 0, uptime: 0 },
      systems: {},
      error: error.message,
      timestamp: Date.now()
    };
  }
}

// Default export for convenience
export default {
  // Initialization
  quickStartMonitoring,
  quickStartDevMonitoring,
  quickStartTestMonitoring,
  initializeProductionMonitoring,
  autoInitializeMonitoring,

  // Helpers
  createMonitoringHelpers,
  monitorFunction,
  setupGlobalMonitoring,
  performHealthCheck,

  // Configuration
  getConfig,

  // Core systems (named exports above cover these)
};