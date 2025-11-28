/**
 * Enhanced Browser Console Fixture with Integrated Browser-Logs System
 *
 * Philosophy: "Simple, Performant, Maintainable"
 * - Simple: Drop-in replacement for browser-console.js with enhanced logging
 * - Performant: Single event handler setup, no duplicate logging overhead
 * - Maintainable: Centralized browser console logic for all e2e tests
 *
 * Integrates the browser-logs utility capabilities into the base fixture so ALL
 * e2e tests automatically get enhanced console visibility without duplication.
 */

import { test as base, expect } from '@playwright/test';
import { addBrowserConsoleLogging, createLogCollector, analyzeErrors } from '../utils/browser-console-logger.js';

export const test = base.extend({
  page: async ({ page }, use) => {
    // Enhanced browser console logging with all the classification features
    addBrowserConsoleLogging(page, {
      enableNetworkLogging: true,
      enableErrorLogging: true,
      enableConsoleLogging: true,
      includeStackTraces: true
    });

    // Create log collectors for common debugging patterns
    const collectors = {
      keyboard: createLogCollector(page, ['KEYBOARD', '⌨️', 'shortcut', 'event']),
      performance: createLogCollector(page, ['PERF', '🚀', 'latency', 'fps', 'memory']),
      network: createLogCollector(page, ['REQUEST', 'WebSocket', 'fetch', 'network']),
      errors: createLogCollector(page, ['ERROR', '❌', 'exception', 'failed'])
    };

    // Store collectors on page for test access
    page.logCollectors = collectors;

    // Legacy console message storage for backward compatibility
    const consoleMessages = [];

    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      });
    });

    // Store messages on page for test access (backward compatibility)
    page.consoleMessages = consoleMessages;

    await use(page);
  }
});

// Export common helper functions for tests
export const BrowserConsoleHelpers = {
  /**
   * Get keyboard debug logs from enhanced collector
   */
  getKeyboardLogs: (page) => {
    return page.logCollectors?.keyboard.getLogs() || [];
  },

  /**
   * Get performance logs from enhanced collector
   */
  getPerformanceLogs: (page) => {
    return page.logCollectors?.performance.getLogs() || [];
  },

  /**
   * Get network logs from enhanced collector
   */
  getNetworkLogs: (page) => {
    return page.logCollectors?.network.getLogs() || [];
  },

  /**
   * Get error logs with analysis
   */
  getErrorAnalysis: (page) => {
    const allMessages = page.consoleMessages || [];
    return analyzeErrors(allMessages);
  },

  /**
   * Legacy compatibility - filter console messages by text
   */
  filterConsoleMessages: (page, patterns) => {
    const messages = page.consoleMessages || [];
    return messages.filter(msg =>
      patterns.some(pattern => msg.text.includes(pattern))
    );
  },

  /**
   * Quick health check for keyboard system
   */
  checkKeyboardSystemHealth: (page) => {
    const keyboardLogs = BrowserConsoleHelpers.getKeyboardLogs(page);
    const initializationLogs = keyboardLogs.filter(log =>
      log.text.includes('🚀') || log.text.includes('initialization')
    );
    const errorLogs = BrowserConsoleHelpers.getErrorAnalysis(page);

    return {
      isHealthy: initializationLogs.length > 0 && errorLogs.total === 0,
      initializationCount: initializationLogs.length,
      errorCount: errorLogs.total,
      totalKeyboardLogs: keyboardLogs.length
    };
  },

  /**
   * Performance summary for test validation
   */
  getPerformanceSummary: (page) => {
    const perfLogs = BrowserConsoleHelpers.getPerformanceLogs(page);
    return {
      hasLatencyMeasurements: perfLogs.some(log => log.text.includes('latency')),
      hasMemoryTracking: perfLogs.some(log => log.text.includes('memory')),
      hasFpsTracking: perfLogs.some(log => log.text.includes('fps')),
      totalPerformanceLogs: perfLogs.length
    };
  }
};

// Re-export test with the same name as the original for easy migration
export { test as enhancedTest, expect };