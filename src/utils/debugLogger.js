/**
 * Enhanced Debug logging utility for NeuroSense FX
 * Provides environment-based logging with comprehensive debug configuration integration
 * Maintains backward compatibility while adding new features
 */

import debug, { DebugCategories, DebugLevels } from './debugConfig.js';

// Check if we're in development mode
const DEBUG = import.meta.env.DEV;

/**
 * Legacy tag-to-category mapping for backward compatibility
 * Maps old tags to new category system
 */
const TAG_TO_CATEGORY = {
  'WORKSPACE': DebugCategories.DISPLAY,
  'DISPLAY': DebugCategories.DISPLAY,
  'CANVAS': DebugCategories.CANVAS,
  'CONFIG': DebugCategories.CONFIG,
  'STATE': DebugCategories.STATE,
  'PERFORMANCE': DebugCategories.PERFORMANCE,
  'WORKER': DebugCategories.WORKER,
  'NETWORK': DebugCategories.NETWORK,
  'INTERACTION': DebugCategories.INTERACTION,
  'STORAGE': DebugCategories.STORAGE,
  'VISUALIZATION': DebugCategories.VISUALIZATION,
  'COMPONENT': DebugCategories.COMPONENT,
  'MEMORY': DebugCategories.MEMORY
};

/**
 * Get debug category from legacy tag
 * @param {string} tag - Legacy tag
 * @returns {string} Debug category
 */
function getCategoryFromTag(tag) {
  // Try direct mapping first
  if (TAG_TO_CATEGORY[tag]) {
    return TAG_TO_CATEGORY[tag];
  }

  // Try to find category by partial match
  const upperTag = tag.toUpperCase();
  for (const [legacyTag, category] of Object.entries(TAG_TO_CATEGORY)) {
    if (upperTag.includes(legacyTag)) {
      return category;
    }
  }

  // Default to interaction for unknown tags
  return DebugCategories.INTERACTION;
}

/**
 * Logs debug messages only in development mode (enhanced with new debug system)
 * @param {string} tag - Tag to identify the source of the log
 * @param {string} message - Message to log
 * @param {any} data - Optional data to log
 */
export function debugLog(tag, message, data = null) {
  // Fall back to old behavior for backward compatibility
  if (!DEBUG) return;

  try {
    // Try to use new debug system
    const category = getCategoryFromTag(tag);

    if (debug.isEnabled(category, DebugLevels.DEBUG)) {
      debug.debug(category, `[${tag}] ${message}`, data);
      return;
    }
  } catch (error) {
    // Fallback to simple logging if new system fails
    console.warn('[DEBUG_LOGGER] New debug system failed, using fallback:', error);
  }

  // Fallback to original behavior
  if (data) {
    console.log(`🔍 DEBUG: ${tag} ${message}`, data);
  } else {
    console.log(`🔍 DEBUG: ${tag} ${message}`);
  }
}

/**
 * Logs warnings in both development and production (enhanced with new debug system)
 * @param {string} tag - Tag to identify the source of the warning
 * @param {string} message - Warning message
 * @param {any} data - Optional data to include
 */
export function warnLog(tag, message, data = null) {
  try {
    // Try to use new debug system
    const category = getCategoryFromTag(tag);

    if (debug.isEnabled(category, DebugLevels.WARN)) {
      debug.warn(category, `[${tag}] ${message}`, data);
      return;
    }
  } catch (error) {
    // Fallback to simple logging if new system fails
    console.warn('[DEBUG_LOGGER] New debug system failed, using fallback:', error);
  }

  // Fallback to original behavior
  if (data) {
    console.warn(`⚠️ WARNING: ${tag} ${message}`, data);
  } else {
    console.warn(`⚠️ WARNING: ${tag} ${message}`);
  }
}

/**
 * Logs errors in both development and production (enhanced with new debug system)
 * @param {string} tag - Tag to identify the source of the error
 * @param {string} message - Error message
 * @param {any} data - Optional data to include
 */
export function errorLog(tag, message, data = null) {
  try {
    // Try to use new debug system (errors always show if category allows)
    const category = getCategoryFromTag(tag);

    if (debug.isEnabled(category, DebugLevels.ERROR)) {
      debug.error(category, `[${tag}] ${message}`, data);
      return;
    }
  } catch (error) {
    // Fallback to simple logging if new system fails
    console.warn('[DEBUG_LOGGER] New debug system failed, using fallback:', error);
  }

  // Fallback to original behavior
  if (data) {
    console.error(`❌ ERROR: ${tag} ${message}`, data);
  } else {
    console.error(`❌ ERROR: ${tag} ${message}`);
  }
}

/**
 * Creates a logger with a predefined tag (enhanced with new debug system)
 * @param {string} tag - Tag to use for all logs from this logger
 * @returns {Object} Logger object with debug, warn, and error methods
 */
export function createLogger(tag) {
  return {
    debug: (message, data) => debugLog(tag, message, data),
    warn: (message, data) => warnLog(tag, message, data),
    error: (message, data) => errorLog(tag, message, data),

    // New methods from enhanced debug system
    info: (message, data) => {
      try {
        const category = getCategoryFromTag(tag);
        if (debug.isEnabled(category, DebugLevels.INFO)) {
          debug.info(category, `[${tag}] ${message}`, data);
        }
      } catch (error) {
        console.log(`💡 INFO: ${tag} ${message}`, data);
      }
    },

    // Performance measurement
    timer: (operation) => {
      try {
        const category = getCategoryFromTag(tag);
        if (debug.isEnabled(category, DebugLevels.PERFORMANCE)) {
          return debug.timer(`${tag}_${operation}`);
        }
      } catch (error) {
        // Fallback simple timer
        const start = performance.now();
        return () => {
          const duration = performance.now() - start;
          console.log(`⚡ TIMER [${tag}] ${operation}: ${duration.toFixed(2)}ms`);
          return duration;
        };
      }
      return () => {};
    },

    // Measure function execution
    measure: (fn, operation) => {
      try {
        const category = getCategoryFromTag(tag);
        if (debug.isEnabled(category, DebugLevels.PERFORMANCE)) {
          return debug.measure(fn, `${tag}_${operation}`);
        }
      } catch (error) {
        // Fallback simple measurement
        const timer = this.timer(operation);
        try {
          const result = fn();
          if (result && typeof result.then === 'function') {
            return result.finally(() => timer());
          }
          timer();
          return result;
        } catch (error) {
          timer();
          throw error;
        }
      }
      return fn();
    }
  };
}

/**
 * Get access to the new debug system for advanced usage
 * @returns {Object} Enhanced debug system API
 */
export function getDebugSystem() {
  return debug;
}

/**
 * Get debug configuration for monitoring
 * @returns {Object} Current debug configuration and status
 */
export function getDebugStatus() {
  try {
    return {
      legacy: { DEBUG },
      enhanced: debug.status(),
      tagMappings: TAG_TO_CATEGORY
    };
  } catch (error) {
    return {
      legacy: { DEBUG },
      enhanced: { error: error.message },
      tagMappings: TAG_TO_CATEGORY
    };
  }
}