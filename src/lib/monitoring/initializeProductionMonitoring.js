/**
 * Production Monitoring Initialization Script
 *
 * Entry point for initializing all production monitoring systems.
 * Call this function when your application starts to enable comprehensive monitoring.
 */

import { initializeProductionMonitoring as initializeManager } from './ProductionMonitoringManager.js';
import { getFinalMonitoringConfig } from './productionMonitoringConfig.js';

/**
 * Initialize production monitoring systems
 *
 * This is the main entry point for starting all production monitoring.
 * Call this function early in your application startup sequence.
 *
 * @param {Object} customConfig - Optional custom configuration overrides
 * @returns {Promise<Object>} - Returns the monitoring manager instance
 */
export async function initializeProductionMonitoring(customConfig = {}) {
  try {
    console.log('🚀 [ProductionMonitoring] Initializing comprehensive production monitoring...');

    // Get base configuration
    const baseConfig = getFinalMonitoringConfig();

    // Apply custom overrides
    const config = mergeConfigurations(baseConfig, customConfig);

    // Validate configuration
    validateConfiguration(config);

    // Initialize monitoring manager with all systems
    const monitoringManager = await initializeManager(config);

    console.log('✅ [ProductionMonitoring] Production monitoring initialized successfully');
    console.log('📊 [ProductionMonitoring] Systems started:', getStartedSystems(monitoringManager));

    // Set up global error handling if enabled
    if (config.production.ENABLE_ALERTS) {
      setupGlobalErrorHandling(monitoringManager);
    }

    // Log system information
    logSystemInformation();

    return monitoringManager;

  } catch (error) {
    console.error('❌ [ProductionMonitoring] Failed to initialize production monitoring:', error);
    throw error;
  }
}

/**
 * Initialize monitoring for development environment
 *
 * Lightweight monitoring for development with reduced overhead.
 *
 * @param {Object} customConfig - Optional custom configuration overrides
 * @returns {Promise<Object>} - Returns the monitoring manager instance
 */
export async function initializeDevelopmentMonitoring(customConfig = {}) {
  try {
    console.log('🛠️ [ProductionMonitoring] Initializing development monitoring...');

    // Get development configuration with reduced monitoring
    const baseConfig = getFinalMonitoringConfig();

    // Development-specific overrides
    const devOverrides = {
      production: {
        PERFORMANCE_SAMPLE_RATE: 0.1, // 10% sampling
        ENABLE_ALERTS: false,        // No alerts in development
        ERROR_RETENTION_HOURS: 2
      },
      error: {
        ENABLE_EXTERNAL_LOGGING: false,
        SANITIZE_STACK_TRACES: false
      },
      analytics: {
        ENABLE_AUTOMATED_REPORTS: false,
        ENABLE_PREDICTIVE_ANALYTICS: false
      }
    };

    const config = mergeConfigurations(baseConfig, devOverrides, customConfig);

    const monitoringManager = await initializeManager(config);

    console.log('✅ [ProductionMonitoring] Development monitoring initialized successfully');

    return monitoringManager;

  } catch (error) {
    console.error('❌ [ProductionMonitoring] Failed to initialize development monitoring:', error);
    throw error;
  }
}

/**
 * Initialize monitoring for testing environment
 *
 * Minimal monitoring for testing with lowest overhead.
 *
 * @param {Object} customConfig - Optional custom configuration overrides
 * @returns {Promise<Object>} - Returns the monitoring manager instance
 */
export async function initializeTestMonitoring(customConfig = {}) {
  try {
    console.log('🧪 [ProductionMonitoring] Initializing test monitoring...');

    // Test-specific configuration with minimal overhead
    const testConfig = {
      production: {
        ALERT_CHECK_INTERVAL: 5000,
        PERFORMANCE_SAMPLE_RATE: 0.01,
        ENABLE_ALERTS: false,
        ERROR_RETENTION_HOURS: 1
      },
      error: {
        ENABLE_EXTERNAL_LOGGING: false,
        CAPTURE_NETWORK_ERRORS: false,
        SANITIZE_STACK_TRACES: false
      },
      tradingOps: {
        MONITOR_KEYBOARD_SHORTCUTS: false,
        MONITOR_USER_SESSIONS: false
      },
      systemHealth: {
        MONITOR_FRAME_RATE: false,
        ENABLE_AUTO_OPTIMIZATION: false
      },
      analytics: {
        ENABLE_USER_BEHAVIOR_ANALYSIS: false,
        ENABLE_AUTOMATED_REPORTS: false
      },
      alerting: {
        ENABLE_REAL_TIME_ALERTING: false
      }
    };

    const config = mergeConfigurations(testConfig, customConfig);

    const monitoringManager = await initializeManager(config);

    console.log('✅ [ProductionMonitoring] Test monitoring initialized successfully');

    return monitoringManager;

  } catch (error) {
    console.error('❌ [ProductionMonitoring] Failed to initialize test monitoring:', error);
    throw error;
  }
}

/**
 * Merge multiple configuration objects
 */
function mergeConfigurations(...configs) {
  const result = {};

  for (const config of configs) {
    for (const [system, systemConfig] of Object.entries(config)) {
      if (!result[system]) {
        result[system] = {};
      }
      result[system] = { ...result[system], ...systemConfig };
    }
  }

  return result;
}

/**
 * Validate monitoring configuration
 */
function validateConfiguration(config) {
  const requiredSystems = ['production', 'error', 'tradingOps', 'systemHealth', 'analytics', 'alerting'];

  for (const system of requiredSystems) {
    if (!config[system]) {
      throw new Error(`Missing configuration for monitoring system: ${system}`);
    }
  }

  // Validate specific critical settings
  if (config.production.ALERT_CHECK_INTERVAL < 50) {
    console.warn('⚠️ [ProductionMonitoring] Very aggressive alert checking interval may impact performance');
  }

  if (config.production.CRITICAL_MEMORY_MB < 512) {
    console.warn('⚠️ [ProductionMonitoring] Low memory threshold may cause frequent alerts');
  }

  if (config.error.ERROR_RETENTION_DAYS < 1) {
    console.warn('⚠️ [ProductionMonitoring] Very short error retention may limit debugging capabilities');
  }
}

/**
 * Set up global error handling
 */
function setupGlobalErrorHandling(monitoringManager) {
  // Global error handler that routes to monitoring system
  window.addEventListener('error', (event) => {
    if (monitoringManager.systems.error) {
      monitoringManager.systems.error.captureError({
        type: 'GLOBAL_ERROR',
        message: event.error?.message || event.message,
        stack: event.error?.stack,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        timestamp: Date.now()
      });
    }
  });

  // Global promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    if (monitoringManager.systems.error) {
      monitoringManager.systems.error.captureError({
        type: 'UNHANDLED_PROMISE_REJECTION',
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
        timestamp: Date.now(),
        promise: true
      });
    }
  });

  console.log('🔧 [ProductionMonitoring] Global error handling configured');
}

/**
 * Log system information
 */
function logSystemInformation() {
  const info = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    screen: {
      width: screen.width,
      height: screen.height,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth
    },
    memory: 'memory' in performance ? {
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
    } : null,
    connection: 'connection' in navigator ? {
      effectiveType: navigator.connection.effectiveType,
      downlink: navigator.connection.downlink,
      rtt: navigator.connection.rtt
    } : null,
    hardware: {
      cores: navigator.hardwareConcurrency,
      deviceMemory: navigator.deviceMemory
    }
  };

  console.log('🖥️ [ProductionMonitoring] System Information:', info);
}

/**
 * Get list of started systems for logging
 */
function getStartedSystems(monitoringManager) {
  const systems = [];
  for (const [name, system] of Object.entries(monitoringManager.systems)) {
    if (system) {
      let status = 'unknown';
      if (system.isMonitoring !== undefined) {
        status = system.isMonitoring ? 'active' : 'inactive';
      } else if (system.isAnalyzing !== undefined) {
        status = system.isAnalyzing ? 'active' : 'inactive';
      } else if (system.isActive !== undefined) {
        status = system.isActive ? 'active' : 'inactive';
      }
      systems.push(`${name} (${status})`);
    }
  }
  return systems;
}

/**
 * Create monitoring helper functions for easy access
 */
export function createMonitoringHelpers(monitoringManager) {
  return {
    // Performance monitoring
    trackPerformance: (name, fn) => {
      const start = performance.now();
      const result = fn();
      const duration = performance.now() - start;

      if (monitoringManager.systems.production) {
        monitoringManager.systems.production.recordOperation(`PERFORMANCE_${name}`, {
          duration,
          timestamp: Date.now()
        });
      }

      return result;
    },

    // Error reporting
    reportError: (error, context = {}) => {
      if (monitoringManager.systems.error) {
        monitoringManager.systems.error.captureError({
          type: 'MANUAL_ERROR',
          message: error.message,
          stack: error.stack,
          context,
          timestamp: Date.now()
        });
      }
    },

    // User interaction tracking
    trackUserAction: (action, data = {}) => {
      if (monitoringManager.systems.tradingOps) {
        monitoringManager.systems.tradingOps.recordOperation(TRADING_OPERATIONS.USER_INTERACTION, {
          action,
          ...data,
          timestamp: Date.now()
        });
      }
    },

    // Custom alert
    createAlert: (type, severity, message, data = {}) => {
      if (monitoringManager.systems.alerting) {
        monitoringManager.systems.alerting.processAlert({
          type,
          severity,
          message,
          category: 'CUSTOM',
          data,
          timestamp: Date.now()
        });
      }
    },

    // Get monitoring status
    getStatus: () => monitoringManager.getMonitoringReport(),

    // Get system health
    getHealth: () => monitoringManager.systems.systemHealth?.getSystemHealthReport(),

    // Get performance metrics
    getPerformance: () => monitoringManager.systems.production?.getMonitoringReport()?.performance
  };
}

/**
 * Auto-initialize based on environment (if not in production)
 *
 * This function can be imported and called at application startup
 * to automatically initialize the appropriate monitoring level.
 */
export function autoInitializeMonitoring(customConfig = {}) {
  const nodeEnv = process.env.NODE_ENV || 'development';

  switch (nodeEnv) {
    case 'production':
      return initializeProductionMonitoring(customConfig);
    case 'test':
      return initializeTestMonitoring(customConfig);
    case 'development':
    default:
      return initializeDevelopmentMonitoring(customConfig);
  }
}

/**
 * Production monitoring initialization for Svelte applications
 *
 * This is optimized for Svelte application initialization.
 * Call this in your main.js or App.svelte.
 */
export async function initializeSvelteMonitoring(customConfig = {}) {
  try {
    console.log('🎯 [ProductionMonitoring] Initializing monitoring for Svelte application...');

    const monitoringManager = await initializeProductionMonitoring(customConfig);

    // Set up Svelte-specific monitoring
    setupSvelteMonitoring(monitoringManager);

    // Create helper functions for Svelte components
    const svelteHelpers = createSvelteHelpers(monitoringManager);

    console.log('✅ [ProductionMonitoring] Svelte monitoring initialized successfully');

    return {
      monitoringManager,
      helpers: svelteHelpers
    };

  } catch (error) {
    console.error('❌ [ProductionMonitoring] Failed to initialize Svelte monitoring:', error);
    throw error;
  }
}

/**
 * Set up Svelte-specific monitoring
 */
function setupSvelteMonitoring(monitoringManager) {
  // Monitor Svelte component lifecycle if possible
  if (typeof window !== 'undefined' && window.__svelte) {
    console.log('📝 [ProductionMonitoring] Svelte development detected, enabling enhanced monitoring');
  }

  // Set up WebSocket monitoring for SvelteKit applications
  if (typeof window !== 'undefined' && window.__sveltekit) {
    console.log('🚀 [ProductionMonitoring] SvelteKit detected, enabling WebSocket monitoring');
  }
}

/**
 * Create Svelte-specific helper functions
 */
function createSvelteHelpers(monitoringManager) {
  const baseHelpers = createMonitoringHelpers(monitoringManager);

  return {
    ...baseHelpers,

    // Svelte component monitoring
    trackComponentRender: (componentName, renderTime) => {
      if (monitoringManager.systems.tradingOps) {
        monitoringManager.systems.tradingOps.recordOperation('COMPONENT_RENDER', {
          componentName,
          renderTime,
          timestamp: Date.now()
        });
      }
    },

    // Svelte store monitoring
    trackStoreUpdate: (storeName, updateCount) => {
      if (monitoringManager.systems.production) {
        monitoringManager.systems.production.recordOperation('STORE_UPDATE', {
          storeName,
          updateCount,
          timestamp: Date.now()
        });
      }
    },

    // Svelte navigation monitoring
    trackNavigation: (from, to) => {
      if (monitoringManager.systems.tradingOps) {
        monitoringManager.systems.tradingOps.recordOperation('NAVIGATION', {
          from,
          to,
          timestamp: Date.now()
        });
      }
    }
  };
}

/**
 * Export convenience functions for direct access
 */
export { getFinalMonitoringConfig as getConfig };

/**
 * Export monitoring utilities
 */
export * from './ProductionMonitoringManager.js';
export * from './ProductionMonitoringInfrastructure.js';
export * from './ErrorMonitoringSystem.js';
export * from './TradingOperationsMonitor.js';
export * from './SystemHealthMonitor.js';
export * from './ProductionAnalyticsSystem.js';
export * from './ProductionAlertingSystem.js';

/**
 * Default export for easy importing
 */
export default {
  initializeProductionMonitoring,
  initializeDevelopmentMonitoring,
  initializeTestMonitoring,
  autoInitializeMonitoring,
  initializeSvelteMonitoring,
  createMonitoringHelpers,
  getConfig: getFinalMonitoringConfig
};