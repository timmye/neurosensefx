/**
 * Browser Log Capture Utility
 *
 * Integrates with the Unified Console Reporter to provide real-time
 * browser console log forwarding and enhanced debugging visibility.
 */

class BrowserLogCapture {
  constructor(unifiedReporter) {
    this.unifiedReporter = unifiedReporter;
    this.activeSessions = new Map();
    this.logBuffer = [];
    this.maxBufferSize = 1000;
  }

  /**
   * Setup comprehensive browser monitoring for a page
   */
  async setupPageMonitoring(page, testContext = {}) {
    const correlationId = testContext.correlationId || this.unifiedReporter.generateCorrelationId();
    const sessionId = this.generateSessionId();

    const session = {
      page,
      sessionId,
      correlationId,
      startTime: Date.now(),
      logs: [],
      errors: [],
      networkRequests: [],
      performanceMetrics: []
    };

    this.activeSessions.set(sessionId, session);

    // Setup comprehensive event listeners
    this.setupConsoleMonitoring(page, session);
    this.setupErrorMonitoring(page, session);
    this.setupNetworkMonitoring(page, session);
    this.setupPerformanceMonitoring(page, session);
    this.setupCrashMonitoring(page, session);

    this.unifiedReporter.log('BROWSER', `🔍 Browser monitoring started for session: ${sessionId}`, 'info', correlationId);

    return session;
  }

  generateSessionId() {
    return `BROWSER-SESSION-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  setupConsoleMonitoring(page, session) {
    page.on('console', msg => {
      const logEntry = {
        type: msg.type(),
        message: msg.text(),
        timestamp: new Date().toISOString(),
        location: msg.location(),
        sessionId: session.sessionId,
        correlationId: session.correlationId
      };

      // Add to session logs
      session.logs.push(logEntry);
      this.addToGlobalBuffer(logEntry);

      // Forward to unified reporter with real-time output
      const messageType = this.mapConsoleTypeToLogType(msg.type());
      this.unifiedReporter.log('BROWSER', `${msg.type().toUpperCase()}: ${msg.text()}`, messageType, session.correlationId);

      // Handle special console messages for enhanced debugging
      this.handleSpecialConsoleMessages(msg, session);
    });
  }

  setupErrorMonitoring(page, session) {
    // Page errors (JavaScript errors)
    page.on('pageerror', error => {
      const errorEntry = {
        type: 'pageerror',
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        sessionId: session.sessionId,
        correlationId: session.correlationId
      };

      session.errors.push(errorEntry);
      this.addToGlobalBuffer(errorEntry);

      this.unifiedReporter.log('BROWSER', `PAGE ERROR: ${error.message}`, 'error', session.correlationId);

      if (error.stack) {
        this.unifiedReporter.log('BROWSER', `Stack trace: ${error.stack}`, 'debug', session.correlationId);
      }
    });

    // Request failures
    page.on('requestfailed', request => {
      const failureEntry = {
        type: 'requestfailed',
        url: request.url(),
        method: request.method(),
        failure: request.failure()?.errorText || 'Unknown error',
        timestamp: new Date().toISOString(),
        sessionId: session.sessionId,
        correlationId: session.correlationId
      };

      session.errors.push(failureEntry);
      this.addToGlobalBuffer(failureEntry);

      this.unifiedReporter.log('BROWSER', `REQUEST FAILED: ${request.method()} ${request.url()} - ${failureEntry.failure}`, 'error', session.correlationId);
    });
  }

  setupNetworkMonitoring(page, session) {
    page.on('request', request => {
      const requestEntry = {
        type: 'request',
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        timestamp: new Date().toISOString(),
        sessionId: session.sessionId,
        correlationId: session.correlationId
      };

      session.networkRequests.push(requestEntry);

      // Log important requests
      if (this.isImportantRequest(request.url())) {
        this.unifiedReporter.log('BROWSER', `🌐 REQUEST: ${request.method()} ${request.url()}`, 'info', session.correlationId);
      }
    });

    page.on('response', response => {
      const responseEntry = {
        type: 'response',
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
        timestamp: new Date().toISOString(),
        sessionId: session.sessionId,
        correlationId: session.correlationId
      };

      const correspondingRequest = session.networkRequests
        .reverse()
        .find(req => req.type === 'request' && req.url === response.url() && !req.responseLogged);

      if (correspondingRequest) {
        correspondingRequest.responseLogged = true;
        correspondingRequest.status = response.status();
        correspondingRequest.statusText = response.statusText();
      }

      // Log important responses
      if (this.isImportantRequest(response.url()) || !response.ok()) {
        const statusIcon = response.ok() ? '✅' : '❌';
        this.unifiedReporter.log('BROWSER', `${statusIcon} RESPONSE: ${response.status()} ${response.url()}`, response.ok() ? 'info' : 'error', session.correlationId);
      }
    });
  }

  setupPerformanceMonitoring(page, session) {
    // Monitor page performance metrics
    page.on('metrics', metrics => {
      const metricEntry = {
        type: 'metrics',
        timestamp: new Date().toISOString(),
        metrics: metrics.metrics,
        sessionId: session.sessionId,
        correlationId: session.correlationId
      };

      session.performanceMetrics.push(metricEntry);

      // Log important performance metrics
      if (metrics.metrics.JSHeapUsedSize) {
        const heapUsedMB = Math.round(metrics.metrics.JSHeapUsedSize / 1024 / 1024);
        if (heapUsedMB > 100) { // Alert on high memory usage
          this.unifiedReporter.log('BROWSER', `⚠️  High memory usage: ${heapUsedMB}MB`, 'warning', session.correlationId);
        }
      }
    });
  }

  setupCrashMonitoring(page, session) {
    page.on('crash', () => {
      this.unifiedReporter.log('BROWSER', '💥 PAGE CRASHED', 'error', session.correlationId);
    });

    page.on('close', () => {
      this.unifiedReporter.log('BROWSER', `🔚 Browser session closed: ${session.sessionId}`, 'info', session.correlationId);
      this.cleanupSession(session.sessionId);
    });
  }

  handleSpecialConsoleMessages(msg, session) {
    const message = msg.text().toLowerCase();

    // WebSocket connection events
    if (message.includes('websocket') || message.includes('socket')) {
      this.unifiedReporter.log('BROWSER', `🔌 WebSocket event: ${msg.text()}`, 'info', session.correlationId);
    }

    // Performance-related logs
    if (message.includes('latency') || message.includes('render') || message.includes('fps')) {
      this.unifiedReporter.log('BROWSER', `⚡ Performance event: ${msg.text()}`, 'info', session.correlationId);
    }

    // Data flow events
    if (message.includes('tick') || message.includes('market data') || message.includes('price')) {
      this.unifiedReporter.log('BROWSER', `📊 Market data: ${msg.text()}`, 'info', session.correlationId);
    }

    // User interaction events
    if (message.includes('keyboard') || message.includes('shortcut') || message.includes('focus')) {
      this.unifiedReporter.log('BROWSER', `⌨️  User interaction: ${msg.text()}`, 'info', session.correlationId);
    }
  }

  mapConsoleTypeToLogType(consoleType) {
    const typeMapping = {
      'log': 'info',
      'info': 'info',
      'warn': 'warning',
      'error': 'error',
      'debug': 'debug',
      'trace': 'debug'
    };

    return typeMapping[consoleType] || 'info';
  }

  isImportantRequest(url) {
    const importantPatterns = [
      'localhost:5174', // Vite dev server
      'websocket', 'ws://', 'wss://', // WebSocket connections
      '/api/', '/data/', '/market/', // API endpoints
      'ctrader', 'open-api' // Trading API
    ];

    return importantPatterns.some(pattern => url.toLowerCase().includes(pattern));
  }

  addToGlobalBuffer(logEntry) {
    this.logBuffer.push(logEntry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }
  }

  cleanupSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const duration = Date.now() - session.startTime;
    this.unifiedReporter.log('BROWSER', `📊 Session summary: ${session.logs.length} console logs, ${session.errors.length} errors, ${session.networkRequests.length} network requests (${duration}ms)`, 'info', session.correlationId);

    this.activeSessions.delete(sessionId);
  }

  // Query methods for debugging
  getSessionLogs(sessionId) {
    const session = this.activeSessions.get(sessionId);
    return session ? session.logs : [];
  }

  getSessionErrors(sessionId) {
    const session = this.activeSessions.get(sessionId);
    return session ? session.errors : [];
  }

  getAllLogs() {
    return this.logBuffer;
  }

  getErrorsByType(type) {
    return this.logBuffer.filter(log => log.type === type);
  }

  getLogsByPattern(pattern) {
    return this.logBuffer.filter(log =>
      log.message && log.message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  // Export methods for test reports
  exportSessionReport(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    return {
      sessionId,
      correlationId: session.correlationId,
      startTime: session.startTime,
      duration: Date.now() - session.startTime,
      logs: session.logs,
      errors: session.errors,
      networkRequests: session.networkRequests,
      performanceMetrics: session.performanceMetrics
    };
  }

  exportAllSessionsReport() {
    const sessions = Array.from(this.activeSessions.values());
    return sessions.map(session => this.exportSessionReport(session.sessionId)).filter(Boolean);
  }
}

module.exports = BrowserLogCapture;