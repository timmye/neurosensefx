/**
 * Browser Agents Helper for E2E Testing
 *
 * Provides utilities for console monitoring and browser interaction
 * specifically for the Primary Trader Workflow test.
 */

export class BrowserAgentManager {
  constructor() {
    this.consoleLogs = new Map();
    this.setupConsoleMonitoring = this.setupConsoleMonitoring.bind(this);
    this.getConsoleLogs = this.getConsoleLogs.bind(this);
  }

  /**
   * Setup console monitoring for a Playwright page
   * @param {Object} page - Playwright page object
   */
  async setupConsoleMonitoring(page) {
    // Clear any existing logs
    this.consoleLogs.clear();

    // Setup console message capture
    await page.addInitScript(() => {
      // Store console messages globally for test access
      window.testConsoleLogs = [];

      // Override console methods to capture all output
      const originalConsole = {
        log: console.log,
        info: console.info,
        warn: console.warn,
        error: console.error,
        debug: console.debug
      };

      // Capture all console messages with metadata
      function captureConsoleMessage(type, args) {
        const message = args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');

        const logEntry = {
          type,
          message,
          timestamp: new Date().toISOString(),
          args: Array.from(args)
        };

        // Store in global array
        window.testConsoleLogs.push(logEntry);

        // Also store by message type for easy filtering
        if (!window.testConsoleLogsByType) {
          window.testConsoleLogsByType = {};
        }
        if (!window.testConsoleLogsByType[type]) {
          window.testConsoleLogsByType[type] = [];
        }
        window.testConsoleLogsByType[type].push(logEntry);

        // Call original console method
        originalConsole[type].apply(console, args);
      }

      // Override console methods
      console.log = (...args) => captureConsoleMessage('log', args);
      console.info = (...args) => captureConsoleMessage('info', args);
      console.warn = (...args) => captureConsoleMessage('warn', args);
      console.error = (...args) => captureConsoleMessage('error', args);
      console.debug = (...args) => captureConsoleMessage('debug', args);
    });
  }

  /**
   * Get all captured console logs from a page
   * @param {Object} page - Playwright page object
   * @returns {Array} Array of console log entries
   */
  async getConsoleLogs(page) {
    try {
      const logs = await page.evaluate(() => {
        return window.testConsoleLogs || [];
      });
      return logs;
    } catch (error) {
      console.warn('Failed to retrieve console logs:', error);
      return [];
    }
  }

  /**
   * Get console logs by type
   * @param {Object} page - Playwright page object
   * @param {string} type - Log type ('log', 'error', 'warn', 'info', 'debug')
   * @returns {Array} Array of console log entries of specified type
   */
  async getConsoleLogsByType(page, type) {
    try {
      const logs = await page.evaluate((logType) => {
        return window.testConsoleLogsByType?.[logType] || [];
      }, type);
      return logs;
    } catch (error) {
      console.warn(`Failed to retrieve ${type} logs:`, error);
      return [];
    }
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
    try {
      await page.evaluate(() => {
        window.testConsoleLogs = [];
        if (window.testConsoleLogsByType) {
          window.testConsoleLogsByType = {};
        }
      });
    } catch (error) {
      console.warn('Failed to clear console logs:', error);
    }
  }
}

// Singleton instance for use across tests
export const browserAgentManager = new BrowserAgentManager();

export default browserAgentManager;