/**
 * Streamlined Browser Agents Helper for E2E Testing
 *
 * Provides essential console monitoring utilities for real trader workflow testing.
 * Uses Playwright-native console capture methods for simplicity and reliability.
 */

export class BrowserAgentManager {
  constructor() {
    this.pageConsoleLogs = new Map(); // Store logs per page instance
  }

  /**
   * Setup console monitoring for a Playwright page using native methods
   * @param {Object} page - Playwright page object
   */
  async setupConsoleMonitoring(page) {
    // Clear any existing logs for this page
    this.pageConsoleLogs.delete(page);
    this.pageConsoleLogs.set(page, []);

    // Use Playwright's native console event capture
    page.on('console', (msg) => {
      const logEntry = {
        type: msg.type(),
        message: msg.text(),
        timestamp: new Date().toISOString(),
        args: msg.args().length > 0 ? msg.args().map(arg => arg.toString()) : []
      };

      // Store log for this page
      const pageLogs = this.pageConsoleLogs.get(page) || [];
      pageLogs.push(logEntry);
      this.pageConsoleLogs.set(page, pageLogs);
    });

    // Also capture page errors for comprehensive monitoring
    page.on('pageerror', (error) => {
      const logEntry = {
        type: 'error',
        message: error.message,
        timestamp: new Date().toISOString(),
        args: [error.stack || error.toString()]
      };

      const pageLogs = this.pageConsoleLogs.get(page) || [];
      pageLogs.push(logEntry);
      this.pageConsoleLogs.set(page, pageLogs);
    });
  }

  /**
   * Get all captured console logs from a page
   * @param {Object} page - Playwright page object
   * @returns {Array} Array of console log entries
   */
  async getConsoleLogs(page) {
    const logs = this.pageConsoleLogs.get(page) || [];
    return [...logs]; // Return a copy to prevent external modification
  }

  /**
   * Get console logs by type
   * @param {Object} page - Playwright page object
   * @param {string} type - Log type ('log', 'error', 'warn', 'info', 'debug')
   * @returns {Array} Array of console log entries of specified type
   */
  async getConsoleLogsByType(page, type) {
    const allLogs = await this.getConsoleLogs(page);
    return allLogs.filter(log => log.type === type);
  }

  /**
   * Wait for specific console message
   * @param {Object} page - Playwright page object
   * @param {string} messagePattern - Message pattern to wait for
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Object>} The matching log entry
   */
  async waitForConsoleMessage(page, messagePattern, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const checkForMessage = async () => {
        try {
          const logs = await this.getConsoleLogs(page);
          const matchingLog = logs.find(log =>
            log.message.includes(messagePattern)
          );

          if (matchingLog) {
            resolve(matchingLog);
            return;
          }

          if (Date.now() - startTime > timeout) {
            reject(new Error(`Timeout waiting for console message: ${messagePattern}`));
            return;
          }

          setTimeout(checkForMessage, 100);
        } catch (error) {
          reject(error);
        }
      };

      checkForMessage();
    });
  }

  /**
   * Clear console logs for a page
   * @param {Object} page - Playwright page object
   */
  async clearConsoleLogs(page) {
    this.pageConsoleLogs.set(page, []);
  }

  /**
   * Get basic console summary for essential test validation
   * @param {Object} page - Playwright page object
   * @returns {Object} Basic console summary
   */
  async getConsoleSummary(page) {
    const allLogs = await this.getConsoleLogs(page);
    const errors = allLogs.filter(log => log.type === 'error');
    const warnings = allLogs.filter(log => log.type === 'warn');

    // Basic WebSocket connection tracking
    const webSocketLogs = allLogs.filter(log =>
      log.message.includes('WebSocket') ||
      log.message.includes('socket') ||
      log.message.includes('connection')
    );

    // Basic performance tracking
    const performanceLogs = allLogs.filter(log =>
      log.message.includes('ms') ||
      log.message.includes('latency') ||
      log.message.includes('render')
    );

    // Display creation tracking
    const displayCreationLogs = allLogs.filter(log =>
      log.message.includes('display') ||
      log.message.includes('symbol') ||
      log.message.includes('canvas') ||
      log.message.includes('Creating display')
    );

    return {
      totalLogs: allLogs.length,
      errorCount: errors.length,
      warningCount: warnings.length,
      webSocketEventCount: webSocketLogs.length,
      performanceEventCount: performanceLogs.length,
      displayCreationCount: displayCreationLogs.length,
      hasErrors: errors.length > 0,
      criticalErrors: errors.slice(0, 3),
      recentWebSocketEvent: webSocketLogs[webSocketLogs.length - 1] || null,
      recentPerformanceEvents: performanceLogs.slice(-2)
    };
  }

  /**
   * Monitor basic application health during test execution
   * @param {Object} page - Playwright page object
   * @param {number} interval - Monitoring interval in milliseconds
   * @param {number} duration - Total monitoring duration in milliseconds
   * @returns {Promise<Object>} Health monitoring results
   */
  async monitorApplicationHealth(page, interval = 2000, duration = 10000) {
    console.log(`🏥 Starting health monitoring for ${duration}ms...`);

    const startTime = Date.now();
    const healthChecks = [];

    const monitorInterval = setInterval(async () => {
      try {
        const currentLogs = await this.getConsoleLogs(page);
        const currentErrors = currentLogs.filter(log => log.type === 'error');
        const canvasCount = await page.locator('canvas').count();

        const healthCheck = {
          timestamp: new Date().toISOString(),
          elapsedTime: Date.now() - startTime,
          logCount: currentLogs.length,
          errorCount: currentErrors.length,
          canvasCount,
          healthy: currentErrors.length === 0
        };

        healthChecks.push(healthCheck);

        const status = healthCheck.healthy ? '✅' : '❌';
        console.log(`   ${status} Health check: ${healthCheck.logCount} logs, ${healthCheck.errorCount} errors, ${healthCheck.canvasCount} canvases`);

      } catch (error) {
        console.log(`   ❌ Health check failed: ${error.message}`);
        healthChecks.push({
          timestamp: new Date().toISOString(),
          elapsedTime: Date.now() - startTime,
          error: error.message,
          healthy: false
        });
      }
    }, interval);

    // Stop monitoring after duration
    return new Promise((resolve) => {
      setTimeout(() => {
        clearInterval(monitorInterval);

        const totalDuration = Date.now() - startTime;
        const healthyChecks = healthChecks.filter(check => check.healthy).length;
        const overallHealth = healthChecks.length > 0 && (healthyChecks / healthChecks.length) >= 0.8;

        console.log(`\n🏥 Health monitoring complete: ${healthyChecks}/${healthChecks.length} checks healthy`);

        resolve({
          duration: totalDuration,
          totalChecks: healthChecks.length,
          healthyChecks,
          overallHealth,
          healthChecks
        });
      }, duration);
    });
  }

  /**
   * Cleanup console monitoring for a page
   * @param {Object} page - Playwright page object
   */
  cleanup(page) {
    this.pageConsoleLogs.delete(page);

    // Remove event listeners (this is handled by page.close() in Playwright)
    // But we clean up our internal state
  }
}

// Singleton instance for use across tests
export const browserAgentManager = new BrowserAgentManager();

export default browserAgentManager;