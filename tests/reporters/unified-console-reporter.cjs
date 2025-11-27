/**
 * Unified Console Reporter for Playwright
 *
 * Provides total LLM visibility by aggregating:
 * - Build logs (Vite dev server output)
 * - Browser console logs (real-time forwarding)
 * - Test execution logs (Playwright test results)
 * - System events (navigation, interactions, errors)
 *
 * All with unified timestamps and correlation IDs
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class UnifiedConsoleReporter extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      enableColors: true,
      enableTimestamps: true,
      enableCorrelationIds: true,
      bufferSize: 1000,
      outputFile: 'test-results/unified-console.log',
      ...options
    };

    this.startTime = new Date();
    this.logBuffer = [];
    this.correlationId = 0;
    this.activeTestSessions = new Map();
    this.browserLogForwarders = new Map();

    this.initializeColors();
    this.setupLogForwarding();
  }

  initializeColors() {
    if (!this.options.enableColors) {
      this.colors = {
        reset: '',
        dim: '',
        bright: '',
        red: '',
        green: '',
        yellow: '',
        blue: '',
        magenta: '',
        cyan: '',
        gray: ''
      };
      return;
    }

    this.colors = {
      reset: '\x1b[0m',
      dim: '\x1b[2m',
      bright: '\x1b[1m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      gray: '\x1b[90m'
    };
  }

  setupLogForwarding() {
    // Forward process stdout/stderr to unified console
    this.originalStdoutWrite = process.stdout.write;
    this.originalStderrWrite = process.stderr.write;

    process.stdout.write = (chunk, encoding, callback) => {
      this.log('BUILD', chunk.toString().trim(), 'info');
      return this.originalStdoutWrite.call(process.stdout, chunk, encoding, callback);
    };

    process.stderr.write = (chunk, encoding, callback) => {
      this.log('BUILD', chunk.toString().trim(), 'error');
      return this.originalStderrWrite.call(process.stderr, chunk, encoding, callback);
    };
  }

  generateCorrelationId() {
    return `UNIFIED-${++this.correlationId}`;
  }

  formatTimestamp() {
    if (!this.options.enableTimestamps) return '';
    const now = new Date();
    const elapsed = now - this.startTime;
    return `${this.colors.cyan}[${now.toISOString()}][+${elapsed}ms]${this.colors.reset} `;
  }

  formatSource(source, type = 'info') {
    const sourceColors = {
      'BUILD': this.colors.blue,
      'BROWSER': this.colors.magenta,
      'TEST': this.colors.green,
      'SYSTEM': this.colors.yellow,
      'ERROR': this.colors.red
    };

    const color = sourceColors[type] || this.colors.gray;
    return `${color}[${source}]${this.colors.reset}`;
  }

  formatMessage(message, type = 'info') {
    const typeEmojis = {
      'info': '',
      'error': '❌',
      'warning': '⚠️',
      'success': '✅',
      'debug': '🔍'
    };

    const emoji = typeEmojis[type] || '';
    const dim = type === 'debug' ? this.colors.dim : '';

    return `${dim}${emoji} ${message}${this.colors.reset}`;
  }

  log(source, message, type = 'info', correlationId = null) {
    const entry = {
      timestamp: new Date().toISOString(),
      elapsed: Date.now() - this.startTime,
      source,
      message,
      type,
      correlationId
    };

    // Add to buffer
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.options.bufferSize) {
      this.logBuffer.shift();
    }

    // Format for console output
    const timestamp = this.formatTimestamp();
    const sourceTag = this.formatSource(source, type);
    const correlationTag = correlationId ? `${this.colors.gray}[${correlationId}]${this.colors.reset} ` : '';
    const formattedMessage = this.formatMessage(message, type);

    const output = `${timestamp}${sourceTag} ${correlationTag}${formattedMessage}`;

    // Write to console
    this.originalStdoutWrite.call(process.stdout, output + '\n');

    // Emit for other listeners
    this.emit('log', entry);

    // Write to file if specified
    if (this.options.outputFile) {
      this.writeToFile(entry);
    }
  }

  writeToFile(entry) {
    try {
      const logDir = path.dirname(this.options.outputFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const logLine = JSON.stringify(entry) + '\n';
      fs.appendFileSync(this.options.outputFile, logLine);
    } catch (error) {
      this.originalStdoutWrite.call(process.stdout, `Failed to write log file: ${error.message}\n`);
    }
  }

  // Playwright Reporter Interface
  onBegin(config, suite) {
    const correlationId = this.generateCorrelationId();
    this.log('SYSTEM', `🚀 Unified Console Reporter Starting`, 'info', correlationId);
    this.log('TEST', `Test Suite: ${suite.title} (${suite.allTests.length} tests)`, 'info', correlationId);
    this.log('SYSTEM', `Build Server: ${config.webServer?.command || 'Unknown'}`, 'info', correlationId);
    this.log('SYSTEM', `Target: ${config.projects?.[0]?.name || 'default'}`, 'info', correlationId);
  }

  onTestBegin(test) {
    const correlationId = this.generateCorrelationId();
    this.activeTestSessions.set(test.id, correlationId);

    this.log('TEST', `▶️  Starting: ${test.title}`, 'info', correlationId);
    this.log('TEST', `   File: ${test.location.file}:${test.location.line}`, 'debug', correlationId);
  }

  onTestEnd(test, result) {
    const correlationId = this.activeTestSessions.get(test.id) || this.generateCorrelationId();

    if (test.ok) {
      this.log('TEST', `✅ PASSED: ${test.title} (${result.duration}ms)`, 'success', correlationId);
    } else {
      this.log('TEST', `❌ FAILED: ${test.title} (${result.duration}ms)`, 'error', correlationId);
      if (result.error) {
        this.log('ERROR', `   Error: ${result.error.message}`, 'error', correlationId);
        this.log('ERROR', `   Stack: ${result.error.stack}`, 'debug', correlationId);
      }
    }

    // Log browser console events from this test
    const browserLogs = result.attachments?.filter(att => att.name === 'browser-console') || [];
    browserLogs.forEach(attachment => {
      try {
        const consoleData = JSON.parse(attachment.body?.toString() || '[]');
        consoleData.forEach(logEntry => {
          this.log('BROWSER', `${logEntry.type.toUpperCase()}: ${logEntry.message}`, logEntry.type, correlationId);
        });
      } catch (error) {
        this.log('ERROR', `Failed to parse browser console logs: ${error.message}`, 'error', correlationId);
      }
    });

    this.activeTestSessions.delete(test.id);
  }

  onStepBegin(test, step) {
    const correlationId = this.activeTestSessions.get(test.id);
    if (!correlationId) return;

    // Only log significant steps for performance
    if (step.category === 'navigation' || step.category === 'action' || step.category === 'expectation') {
      this.log('TEST', `   📍 ${step.category}: ${step.title}`, 'debug', correlationId);
    }
  }

  onStepEnd(test, step, result) {
    const correlationId = this.activeTestSessions.get(test.id);
    if (!correlationId) return;

    if (!result.ok && (step.category === 'navigation' || step.category === 'action')) {
      this.log('ERROR', `   ❌ Step failed: ${step.title} - ${result.error?.message || 'Unknown error'}`, 'error', correlationId);
    }
  }

  onError(error) {
    const correlationId = this.generateCorrelationId();
    this.log('ERROR', `System Error: ${error.message}`, 'error', correlationId);
    if (error.stack) {
      this.log('ERROR', `Stack: ${error.stack}`, 'debug', correlationId);
    }
  }

  onEnd(result) {
    const correlationId = this.generateCorrelationId();
    const duration = Math.round((Date.now() - this.startTime.getTime()) / 1000);

    this.log('SYSTEM', `🏁 Test Suite Complete`, 'info', correlationId);
    this.log('TEST', `Results: ${result.ok ? 'SUCCESS' : 'FAILED'} (${duration}s)`, result.ok ? 'success' : 'error', correlationId);

    // Summary statistics
    const passed = result.tests?.filter(t => t.ok).length || 0;
    const failed = result.tests?.filter(t => !t.ok).length || 0;
    const skipped = result.tests?.filter(t => t.results?.[0]?.status === 'skipped').length || 0;

    this.log('TEST', `Summary: ${passed} passed, ${failed} failed, ${skipped} skipped`, 'info', correlationId);

    // Restore original stdout/stderr
    process.stdout.write = this.originalStdoutWrite;
    process.stderr.write = this.originalStderrWrite;
  }

  // Browser log forwarding methods
  createBrowserLogForwarder(page, correlationId) {
    const forwarder = {
      correlationId,
      logs: []
    };

    page.on('console', msg => {
      const logEntry = {
        type: msg.type(),
        message: msg.text(),
        timestamp: new Date().toISOString()
      };

      forwarder.logs.push(logEntry);
      this.log('BROWSER', `${msg.type().toUpperCase()}: ${msg.text()}`, msg.type(), correlationId);
    });

    page.on('pageerror', error => {
      this.log('BROWSER', `PAGE ERROR: ${error.message}`, 'error', correlationId);
    });

    this.browserLogForwarders.set(page, forwarder);
    return forwarder;
  }

  getBrowserLogs(page) {
    const forwarder = this.browserLogForwarders.get(page);
    return forwarder ? forwarder.logs : [];
  }

  // Utility methods for enhanced logging
  logSystemEvent(message, type = 'info') {
    this.log('SYSTEM', message, type);
  }

  logBuildEvent(message, type = 'info') {
    this.log('BUILD', message, type);
  }

  logTestEvent(message, type = 'info', correlationId = null) {
    this.log('TEST', message, type, correlationId);
  }

  // Performance and timing utilities
  startTimer(label) {
    const startTime = Date.now();
    const correlationId = this.generateCorrelationId();

    this.log('SYSTEM', `⏱️  Timer started: ${label}`, 'info', correlationId);

    return {
      stop: (message = null) => {
        const duration = Date.now() - startTime;
        const logMessage = message || `Timer completed: ${label}`;
        this.log('SYSTEM', `⏱️  ${logMessage} (${duration}ms)`, 'info', correlationId);
        return duration;
      },
      correlationId
    };
  }
}

module.exports = UnifiedConsoleReporter;