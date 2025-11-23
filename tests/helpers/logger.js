/**
 * Enhanced logging system for Playwright tests
 * Provides detailed logs for debugging and monitoring
 */

import fs from 'fs';
import path from 'path';

export class TestLogger {
  constructor(testName, logDir = 'test-results/logs') {
    this.testName = testName;
    this.logDir = logDir;
    this.startTime = Date.now();
    this.logs = [];

    // Create log directory if it doesn't exist
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    this.logFile = path.join(logDir, `${testName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.log`);
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const elapsed = Date.now() - this.startTime;
    const logEntry = {
      timestamp,
      elapsed: `${elapsed}ms`,
      level,
      message,
      data
    };

    this.logs.push(logEntry);

    // Format for file output
    const formattedLog = `[${timestamp}] [${elapsed}ms] [${level.toUpperCase()}] ${message}${data ? ' | ' + JSON.stringify(data) : ''}\n`;

    // Write to file
    fs.writeFileSync(this.logFile, formattedLog, { flag: 'a' });

    // Console output with colors
    const colors = {
      info: '\x1b[36m',    // Cyan
      warn: '\x1b[33m',    // Yellow
      error: '\x1b[31m',   // Red
      debug: '\x1b[35m',   // Magenta
      success: '\x1b[32m'  // Green
    };

    const reset = '\x1b[0m';
    const color = colors[level] || '';
    console.log(`${color}${formattedLog.trim()}${reset}`);
  }

  info(message, data) {
    this.log('info', message, data);
  }

  warn(message, data) {
    this.log('warn', message, data);
  }

  error(message, data) {
    this.log('error', message, data);
  }

  debug(message, data) {
    this.log('debug', message, data);
  }

  success(message, data) {
    this.log('success', message, data);
  }

  // Specialized logging methods for common test scenarios
  logPageLoad(url, loadTime) {
    this.info(`Page loaded: ${url}`, { loadTime: `${loadTime}ms` });
  }

  logAction(action, target, duration) {
    this.info(`Action completed: ${action}`, { target, duration: `${duration}ms` });
  }

  logAssertion(assertion, expected, actual, passed) {
    const level = passed ? 'success' : 'error';
    this.log(level, `Assertion: ${assertion}`, { expected, actual, passed });
  }

  logNetworkRequest(request, response) {
    this.info('Network request', {
      url: request.url(),
      method: request.method(),
      status: response.status(),
      duration: `${response.request().timing().responseEnd - response.request().timing().requestStart}ms`
    });
  }

  logWebSocketMessage(type, payload) {
    this.debug(`WebSocket ${type}`, { payloadSize: payload ? payload.length : 0 });
  }

  logPerformanceMetrics(metrics) {
    this.info('Performance metrics', metrics);
  }

  logScreenshot(path, description) {
    this.info(`Screenshot saved: ${description}`, { path });
  }

  logVideo(path, description) {
    this.info(`Video recorded: ${description}`, { path });
  }

  logTrace(path, description) {
    this.info(`Trace saved: ${description}`, { path });
  }

  // Generate test summary
  generateSummary(testResult) {
    const summary = {
      testName: this.testName,
      startTime: new Date(this.startTime).toISOString(),
      endTime: new Date().toISOString(),
      duration: `${Date.now() - this.startTime}ms`,
      status: testResult.status,
      logs: this.logs,
      summary: {
        totalLogs: this.logs.length,
        errors: this.logs.filter(log => log.level === 'error').length,
        warnings: this.logs.filter(log => log.level === 'warn').length,
        assertions: this.logs.filter(log => log.message.includes('Assertion')).length
      }
    };

    // Write summary to file
    const summaryFile = this.logFile.replace('.log', '_summary.json');
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));

    return summary;
  }

  // Get all logs
  getLogs() {
    return this.logs;
  }

  // Get logs by level
  getLogsByLevel(level) {
    return this.logs.filter(log => log.level === level);
  }

  // Clear logs
  clearLogs() {
    this.logs = [];
  }
}

// Global logger factory
export function createTestLogger(testName) {
  return new TestLogger(testName);
}

// Utility function to set up logging for a Playwright test
export function setupTestLogging(page, testName) {
  const logger = createTestLogger(testName);

  // Log page events
  page.on('load', () => logger.info('Page loaded'));
  page.on('domcontentloaded', () => logger.info('DOM content loaded'));
  page.on('load', () => logger.info('Page fully loaded'));

  // Log network requests
  page.on('request', request => {
    logger.debug('Request started', {
      url: request.url(),
      method: request.method()
    });
  });

  page.on('response', response => {
    logger.logNetworkRequest(response.request(), response);
  });

  // Log console messages
  page.on('console', msg => {
    const level = msg.type();
    const text = msg.text();

    switch (level) {
      case 'error':
        logger.error('Browser console error', { text, location: msg.location() });
        break;
      case 'warning':
        logger.warn('Browser console warning', { text, location: msg.location() });
        break;
      case 'info':
      case 'log':
        logger.debug('Browser console log', { text });
        break;
      default:
        logger.debug(`Browser console ${level}`, { text });
    }
  });

  // Log page errors
  page.on('pageerror', error => {
    logger.error('Page error', {
      message: error.message,
      stack: error.stack
    });
  });

  // Log WebSocket connections
  page.on('websocket', ws => {
    logger.info('WebSocket connection established', { url: ws.url() });
  });

  return logger;
}

export default TestLogger;