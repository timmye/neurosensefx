/**
 * Debug logging utility for NeuroSense FX
 * Provides environment-based logging to avoid console output in production
 */

// Check if we're in development mode
const DEBUG = import.meta.env.DEV;

/**
 * Logs debug messages only in development mode
 * @param {string} tag - Tag to identify the source of the log
 * @param {string} message - Message to log
 * @param {any} data - Optional data to log
 */
export function debugLog(tag, message, data = null) {
  if (!DEBUG) return;
  
  if (data) {
    console.log(`🔍 DEBUG: ${tag} ${message}`, data);
  } else {
    console.log(`🔍 DEBUG: ${tag} ${message}`);
  }
}

/**
 * Logs warnings in both development and production
 * @param {string} tag - Tag to identify the source of the warning
 * @param {string} message - Warning message
 * @param {any} data - Optional data to include
 */
export function warnLog(tag, message, data = null) {
  if (data) {
    console.warn(`⚠️ WARNING: ${tag} ${message}`, data);
  } else {
    console.warn(`⚠️ WARNING: ${tag} ${message}`);
  }
}

/**
 * Logs errors in both development and production
 * @param {string} tag - Tag to identify the source of the error
 * @param {string} message - Error message
 * @param {any} data - Optional data to include
 */
export function errorLog(tag, message, data = null) {
  if (data) {
    console.error(`❌ ERROR: ${tag} ${message}`, data);
  } else {
    console.error(`❌ ERROR: ${tag} ${message}`);
  }
}

/**
 * Creates a logger with a predefined tag
 * @param {string} tag - Tag to use for all logs from this logger
 * @returns {Object} Logger object with debug, warn, and error methods
 */
export function createLogger(tag) {
  return {
    debug: (message, data) => debugLog(tag, message, data),
    warn: (message, data) => warnLog(tag, message, data),
    error: (message, data) => errorLog(tag, message, data)
  };
}