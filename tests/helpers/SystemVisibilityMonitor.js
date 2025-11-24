/**
 * SystemVisibilityMonitor - Core Monitoring Infrastructure
 *
 * Comprehensive monitoring utility for NeuroSense FX testing that provides
 * complete visibility into browser behavior, performance, and system health
 * during real-world trading workflow testing.
 *
 * Design Philosophy: Simple, Performant, Maintainable
 * - Simple: Clean API structure following existing project patterns
 * - Performant: Zero-impact monitoring that doesn't affect test execution
 * - Maintainable: Modular design with clear separation of concerns
 *
 * Usage Pattern:
 * ```javascript
 * const monitor = new SystemVisibilityMonitor(page);
 * await monitor.startMonitoring();
 * await monitor.trackPerformance('display-creation');
 * await monitor.validateLatency('data-to-visual', 100);
 * ```
 */

import { createLogger } from '../../src/utils/debugLogger.js';

/**
 * Performance monitoring thresholds based on NeuroSense FX requirements
 */
const PERFORMANCE_THRESHOLDS = {
  FRAME_RATE: {
    MINIMUM: 55,      // 60fps - 5fps tolerance
    TARGET: 60,
    CONSECUTIVE_DROPS: 3
  },
  LATENCY: {
    KEYBOARD_RESPONSE: 310,     // ms
    DATA_TO_VISUAL: 100,        // ms
    DISPLAY_CREATION: 1000,     // ms
    UI_RESPONSE: 200           // ms
  },
  MEMORY: {
    MAX_GROWTH_MB: 50,          // Maximum acceptable memory growth
    LEAK_DETECTION_WINDOW: 30000 // 30 seconds
  },
  WEB_SOCKET: {
    CONNECTION_TIMEOUT: 5000,    // ms
    RECONNECT_DELAY: 1000       // ms
  }
};

/**
 * Console message patterns for validation
 */
const CONSOLE_PATTERNS = {
  EXPECTED: [
    /Creating display for symbol:/,
    /Keyboard shortcut activated:/,
    /Market data received:/,
    /Canvas rendered:/,
    /Display focused:/
  ],
  REJECTED: [
    /WebSocket connection error/i,
    /Failed to load market data/i,
    /Critical rendering error/i,
    /Memory allocation failed/i,
    /Uncaught TypeError/i
  ],
  WARNING: [
    /Performance warning/i,
    /High memory usage/i,
    /Slow rendering detected/i,
    /Connection unstable/i
  ]
};

export class SystemVisibilityMonitor {
  constructor(page, options = {}) {
    this.page = page;
    this.options = {
      enablePerformanceTracking: true,
      enableConsoleMonitoring: true,
      enableInteractionTracking: true,
      enableSystemHealthMonitoring: true,
      thresholds: PERFORMANCE_THRESHOLDS,
      ...options
    };

    this.logger = createLogger('SystemVisibilityMonitor');
    this.isMonitoring = false;
    this.startTime = null;

    // Monitoring state
    this.metrics = {
      performance: new Map(),
      interactions: [],
      console: [],
      systemHealth: {
        webSocket: null,
        memory: [],
        frameRate: []
      },
      validation: {
        passed: [],
        failed: [],
        warnings: []
      }
    };

    // Tracking handles for cleanup
    this.handles = {
      console: [],
      performance: null,
      interactions: null,
      webSocket: null
    };
  }

  /**
   * Initialize monitoring systems
   */
  async startMonitoring() {
    if (this.isMonitoring) {
      this.logger.warn('Monitoring already active');
      return;
    }

    this.logger.debug('Starting comprehensive system monitoring');
    this.startTime = Date.now();
    this.isMonitoring = true;

    try {
      // Initialize browser context monitoring
      await this._initializeBrowserMonitoring();

      // Setup performance tracking
      if (this.options.enablePerformanceTracking) {
        await this._setupPerformanceTracking();
      }

      // Setup console message monitoring
      if (this.options.enableConsoleMonitoring) {
        await this._setupConsoleMonitoring();
      }

      // Setup interaction tracking
      if (this.options.enableInteractionTracking) {
        await this._setupInteractionTracking();
      }

      // Setup system health monitoring
      if (this.options.enableSystemHealthMonitoring) {
        await this._setupSystemHealthMonitoring();
      }

      this.logger.debug('System monitoring initialized successfully');

    } catch (error) {
      this.logger.error('Failed to start monitoring', error);
      await this.stopMonitoring();
      throw error;
    }
  }

  /**
   * Stop monitoring and cleanup resources
   */
  async stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    this.logger.debug('Stopping system monitoring');
    this.isMonitoring = false;

    // Cleanup all monitoring handles
    Object.values(this.handles).forEach(handle => {
      if (handle && typeof handle.remove === 'function') {
        handle.remove();
      }
    });

    // Clear intervals
    if (this.handles.performance) {
      clearInterval(this.handles.performance);
    }

    // Collect final metrics
    const finalMetrics = await this._collectFinalMetrics();

    this.logger.debug(`Monitoring stopped. Total duration: ${Date.now() - this.startTime}ms`);
    return finalMetrics;
  }

  /**
   * Track performance for a specific operation
   * @param {string} operation - Operation identifier
   * @param {Function} fn - Function to measure
   * @returns {Promise<*>} Operation result with timing data
   */
  async trackPerformance(operation, fn) {
    if (!this.isMonitoring) {
      return await fn();
    }

    const startTime = performance.now();
    const startMemory = await this._getMemorySnapshot();

    try {
      const result = await fn();
      const endTime = performance.now();
      const endMemory = await this._getMemorySnapshot();

      const metrics = {
        operation,
        duration: endTime - startTime,
        memoryDelta: endMemory ? endMemory.used - startMemory?.used : 0,
        timestamp: Date.now(),
        success: true
      };

      this.metrics.performance.set(operation, [
        ...(this.metrics.performance.get(operation) || []),
        metrics
      ]);

      this.logger.debug(`Performance tracked for ${operation}: ${metrics.duration.toFixed(2)}ms`);
      return result;

    } catch (error) {
      const endTime = performance.now();

      this.metrics.performance.set(operation, [
        ...(this.metrics.performance.get(operation) || []),
        {
          operation,
          duration: endTime - startTime,
          timestamp: Date.now(),
          success: false,
          error: error.message
        }
      ]);

      throw error;
    }
  }

  /**
   * Validate latency against threshold
   * @param {string} metric - Metric identifier
   * @param {number} threshold - Maximum acceptable latency in ms
   * @returns {Promise<boolean>} True if within threshold
   */
  async validateLatency(metric, threshold) {
    const performanceData = this.metrics.performance.get(metric);
    if (!performanceData || performanceData.length === 0) {
      this.logger.warn(`No performance data available for metric: ${metric}`);
      return false;
    }

    const latestMetric = performanceData[performanceData.length - 1];
    const isValid = latestMetric.duration <= threshold;

    if (isValid) {
      this.metrics.validation.passed.push({
        type: 'latency',
        metric,
        value: latestMetric.duration,
        threshold,
        timestamp: Date.now()
      });
    } else {
      this.metrics.validation.failed.push({
        type: 'latency',
        metric,
        value: latestMetric.duration,
        threshold,
        timestamp: Date.now()
      });
    }

    this.logger.debug(`Latency validation for ${metric}: ${latestMetric.duration.toFixed(2)}ms ${isValid ? '✅' : '❌'}`);
    return isValid;
  }

  /**
   * Expect a specific console message pattern
   * @param {RegExp|string} pattern - Pattern to match
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {Promise<boolean>} True if pattern found
   */
  async expectConsoleMessage(pattern, timeoutMs = 5000) {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i');
    const timeout = Date.now() + timeoutMs;

    while (Date.now() < timeout) {
      const found = this.metrics.console.some(msg =>
        regex.test(msg.text) && (Date.now() - msg.timestamp) < timeoutMs
      );

      if (found) {
        this.metrics.validation.passed.push({
          type: 'console',
          category: 'expected',
          pattern: regex.source,
          timestamp: Date.now()
        });
        return true;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.metrics.validation.failed.push({
      type: 'console',
      category: 'expected',
      pattern: regex.source,
      timestamp: Date.now()
    });

    return false;
  }

  /**
   * Reject a specific console message pattern
   * @param {RegExp|string} pattern - Pattern that should NOT appear
   * @param {number} windowMs - Time window to check (ms)
   * @returns {Promise<boolean>} True if pattern NOT found
   */
  async rejectConsoleMessage(pattern, windowMs = 10000) {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i');
    const cutoffTime = Date.now() - windowMs;

    const found = this.metrics.console.some(msg =>
      regex.test(msg.text) && msg.timestamp > cutoffTime
    );

    if (!found) {
      this.metrics.validation.passed.push({
        type: 'console',
        category: 'rejected',
        pattern: regex.source,
        timestamp: Date.now()
      });
      return true;
    }

    this.metrics.validation.failed.push({
      type: 'console',
      category: 'rejected',
      pattern: regex.source,
      timestamp: Date.now()
    });

    return false;
  }

  /**
   * Get current system health status
   * @returns {Promise<Object>} System health summary
   */
  async getSystemHealth() {
    const currentMemory = await this._getMemorySnapshot();
    const recentPerformance = this._getRecentPerformanceMetrics();
    const validationSummary = this._getValidationSummary();

    return {
      timestamp: Date.now(),
      monitoringDuration: this.isMonitoring ? Date.now() - this.startTime : null,
      memory: {
        current: currentMemory,
        trend: this._getMemoryTrend()
      },
      performance: recentPerformance,
      webSocket: this.metrics.systemHealth.webSocket,
      validation: validationSummary,
      status: this._getOverallStatus()
    };
  }

  /**
   * Get comprehensive monitoring report
   * @returns {Object} Complete monitoring data
   */
  getReport() {
    return {
      session: {
        startTime: this.startTime,
        duration: this.isMonitoring ? Date.now() - this.startTime : null,
        isActive: this.isMonitoring
      },
      metrics: this.metrics,
      summary: this._generateSummary()
    };
  }

  // Private methods

  async _initializeBrowserMonitoring() {
    // Initialize browser context for monitoring
    await this.page.evaluate(() => {
      // Create global monitoring object if it doesn't exist
      if (!window.systemVisibilityMonitor) {
        window.systemVisibilityMonitor = {
          frameRateHistory: [],
          interactionEvents: [],
          performanceMarks: new Map()
        };
      }
    });
  }

  async _setupPerformanceTracking() {
    // Setup frame rate monitoring
    this.handles.performance = setInterval(async () => {
      if (!this.isMonitoring) return;

      const frameRate = await this.page.evaluate(() => {
        const monitor = window.systemVisibilityMonitor;
        if (!monitor) return 0;

        // Simple FPS calculation using requestAnimationFrame timing
        return new Promise(resolve => {
          const start = performance.now();
          let frames = 0;

          const countFrame = () => {
            frames++;
            const elapsed = performance.now() - start;

            if (elapsed >= 1000) {
              resolve(Math.round((frames / elapsed) * 1000));
            } else {
              requestAnimationFrame(countFrame);
            }
          };

          requestAnimationFrame(countFrame);
        });
      });

      if (frameRate > 0) {
        this.metrics.systemHealth.frameRate.push({
          fps: frameRate,
          timestamp: Date.now()
        });

        // Keep only last 60 seconds of data
        const cutoff = Date.now() - 60000;
        this.metrics.systemHealth.frameRate =
          this.metrics.systemHealth.frameRate.filter(fr => fr.timestamp > cutoff);
      }
    }, 2000); // Check every 2 seconds
  }

  async _setupConsoleMonitoring() {
    // Console message monitoring
    const consoleHandler = (msg) => {
      const logEntry = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
        timestamp: Date.now()
      };

      this.metrics.console.push(logEntry);

      // Automatic validation based on patterns
      this._validateConsoleMessage(logEntry);
    };

    this.page.on('console', consoleHandler);
    this.handles.console.push({ remove: () => this.page.off('console', consoleHandler) });
  }

  async _setupInteractionTracking() {
    // Keyboard interaction tracking
    this.page.on('keypress', async (event) => {
      const interactionTime = Date.now();

      // Measure UI response time for keyboard events
      const responseStart = performance.now();
      await this.page.evaluate(() => {
        // Check if UI is responsive
        return document.activeElement !== null;
      });
      const responseTime = performance.now() - responseStart;

      this.metrics.interactions.push({
        type: 'keyboard',
        key: event.key,
        modifiers: {
          ctrl: event.ctrlKey,
          shift: event.shiftKey,
          alt: event.altKey,
          meta: event.metaKey
        },
        responseTime,
        timestamp: interactionTime
      });
    });

    // Mouse interaction tracking
    this.page.on('click', async (event) => {
      const interactionTime = Date.now();

      this.metrics.interactions.push({
        type: 'mouse',
        action: 'click',
        position: { x: event.x, y: event.y },
        button: event.button,
        timestamp: interactionTime
      });
    });
  }

  async _setupSystemHealthMonitoring() {
    // Memory monitoring
    const memoryInterval = setInterval(async () => {
      if (!this.isMonitoring) return;

      const memory = await this._getMemorySnapshot();
      if (memory) {
        this.metrics.systemHealth.memory.push({
          ...memory,
          timestamp: Date.now()
        });

        // Keep only last 5 minutes of data
        const cutoff = Date.now() - 300000;
        this.metrics.systemHealth.memory =
          this.metrics.systemHealth.memory.filter(m => m.timestamp > cutoff);
      }
    }, 5000); // Check every 5 seconds

    this.handles.performance = memoryInterval;

    // WebSocket monitoring
    this.page.on('websocket', ws => {
      const wsInfo = {
        url: ws.url(),
        status: 'connecting',
        timestamp: Date.now()
      };

      ws.on('framereceived', () => {
        wsInfo.lastDataReceived = Date.now();
        wsInfo.status = 'connected';
      });

      ws.on('framesent', () => {
        wsInfo.lastDataSent = Date.now();
      });

      ws.on('close', () => {
        wsInfo.status = 'disconnected';
        wsInfo.closedAt = Date.now();
      });

      this.metrics.systemHealth.webSocket = wsInfo;
    });
  }

  async _getMemorySnapshot() {
    return await this.page.evaluate(() => {
      if (performance.memory) {
        return {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit
        };
      }
      return null;
    });
  }

  _validateConsoleMessage(logEntry) {
    // Check against expected patterns
    for (const pattern of CONSOLE_PATTERNS.EXPECTED) {
      if (pattern.test(logEntry.text)) {
        this.metrics.validation.passed.push({
          type: 'console',
          category: 'expected',
          pattern: pattern.source,
          message: logEntry.text,
          timestamp: logEntry.timestamp
        });
        return;
      }
    }

    // Check against rejected patterns
    for (const pattern of CONSOLE_PATTERNS.REJECTED) {
      if (pattern.test(logEntry.text)) {
        this.metrics.validation.failed.push({
          type: 'console',
          category: 'rejected',
          pattern: pattern.source,
          message: logEntry.text,
          timestamp: logEntry.timestamp
        });
        return;
      }
    }

    // Check against warning patterns
    for (const pattern of CONSOLE_PATTERNS.WARNING) {
      if (pattern.test(logEntry.text)) {
        this.metrics.validation.warnings.push({
          type: 'console',
          category: 'warning',
          pattern: pattern.source,
          message: logEntry.text,
          timestamp: logEntry.timestamp
        });
        return;
      }
    }
  }

  _getRecentPerformanceMetrics() {
    const recent = [];
    const cutoff = Date.now() - 60000; // Last minute

    for (const [operation, metrics] of this.metrics.performance) {
      const recentMetrics = metrics.filter(m => m.timestamp > cutoff);
      if (recentMetrics.length > 0) {
        const latest = recentMetrics[recentMetrics.length - 1];
        recent.push({
          operation,
          latest: latest.duration,
          success: latest.success,
          count: recentMetrics.length
        });
      }
    }

    return recent;
  }

  _getMemoryTrend() {
    const memoryData = this.metrics.systemHealth.memory;
    if (memoryData.length < 2) return 'insufficient_data';

    const recent = memoryData.slice(-10); // Last 10 samples
    const first = recent[0].used;
    const last = recent[recent.length - 1].used;
    const growth = last - first;
    const growthMB = growth / (1024 * 1024);

    if (growthMB > this.options.thresholds.MEMORY.MAX_GROWTH_MB) {
      return 'high_growth';
    } else if (growthMB > 10) {
      return 'moderate_growth';
    } else {
      return 'stable';
    }
  }

  _getValidationSummary() {
    return {
      total: this.metrics.validation.passed.length + this.metrics.validation.failed.length,
      passed: this.metrics.validation.passed.length,
      failed: this.metrics.validation.failed.length,
      warnings: this.metrics.validation.warnings.length,
      successRate: this.metrics.validation.passed.length /
        (this.metrics.validation.passed.length + this.metrics.validation.failed.length) * 100 || 0
    };
  }

  _getOverallStatus() {
    const validation = this._getValidationSummary();
    const frameRateData = this.metrics.systemHealth.frameRate.slice(-5); // Last 5 samples
    const avgFrameRate = frameRateData.length > 0 ?
      frameRateData.reduce((sum, fr) => sum + fr.fps, 0) / frameRateData.length : 0;

    // Determine overall health
    if (validation.failed.length > 0) return 'degraded';
    if (avgFrameRate < this.options.thresholds.FRAME_RATE.MINIMUM) return 'performance_issues';
    if (validation.warnings.length > 5) return 'warnings';
    return 'healthy';
  }

  async _collectFinalMetrics() {
    return {
      finalMemory: await this._getMemorySnapshot(),
      totalInteractions: this.metrics.interactions.length,
      totalConsoleMessages: this.metrics.console.length,
      performanceSummary: this._getRecentPerformanceMetrics(),
      validationSummary: this._getValidationSummary()
    };
  }

  _generateSummary() {
    return {
      performance: {
        totalOperations: Array.from(this.metrics.performance.values())
          .reduce((sum, ops) => sum + ops.length, 0),
        averageLatency: this._calculateAverageLatency(),
        frameRateStats: this._calculateFrameRateStats()
      },
      interactions: {
        total: this.metrics.interactions.length,
        keyboard: this.metrics.interactions.filter(i => i.type === 'keyboard').length,
        mouse: this.metrics.interactions.filter(i => i.type === 'mouse').length
      },
      console: {
        total: this.metrics.console.length,
        byType: this._consoleMessagesByType()
      },
      validation: this._getValidationSummary()
    };
  }

  _calculateAverageLatency() {
    const allMetrics = Array.from(this.metrics.performance.values()).flat();
    if (allMetrics.length === 0) return 0;

    const totalTime = allMetrics.reduce((sum, metric) => sum + metric.duration, 0);
    return totalTime / allMetrics.length;
  }

  _calculateFrameRateStats() {
    const frameRates = this.metrics.systemHealth.frameRate.map(fr => fr.fps);
    if (frameRates.length === 0) return null;

    return {
      average: frameRates.reduce((sum, fr) => sum + fr, 0) / frameRates.length,
      minimum: Math.min(...frameRates),
      maximum: Math.max(...frameRates),
      samples: frameRates.length
    };
  }

  _consoleMessagesByType() {
    const byType = {};
    for (const msg of this.metrics.console) {
      byType[msg.type] = (byType[msg.type] || 0) + 1;
    }
    return byType;
  }
}

/**
 * Factory function to create a monitor instance
 * @param {Object} page - Playwright page object
 * @param {Object} options - Configuration options
 * @returns {SystemVisibilityMonitor} Monitor instance
 */
export function createSystemMonitor(page, options = {}) {
  return new SystemVisibilityMonitor(page, options);
}