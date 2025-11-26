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

  /**
   * Get enhanced logging patterns for display creation pipeline
   * @param {Object} page - Playwright page object
   * @returns {Object} Enhanced logging pattern detection results
   */
  async getEnhancedDisplayCreationLogs(page) {
    const allLogs = await this.getConsoleLogs(page);

    // Enhanced pattern detection for new logging methods
    const patterns = {
      // Container resize/movement patterns
      containerResize: allLogs.filter(log =>
        log.message.includes('Container resized:') ||
        log.message.includes('📏') ||
        log.message.includes('📐') ||
        log.message.includes('displayId]') && log.message.includes('resized')
      ),

      containerMovement: allLogs.filter(log =>
        log.message.includes('Container moved:') ||
        log.message.includes('✋') ||
        log.message.includes('⌨️') ||
        log.message.includes('📍') ||
        log.message.includes('displayId]') && log.message.includes('moved')
      ),

      // WebSocket-to-render latency correlation patterns
      webSocketToRenderLatency: allLogs.filter(log =>
        log.message.includes('WebSocket→Render latency:') ||
        log.message.includes('⚡') ||
        log.message.includes('CRITICAL LATENCY:') ||
        log.message.includes('Elevated latency:') ||
        log.message.includes('displayId]') && log.message.includes('latency')
      ),

      // Performance threshold validation patterns
      performance60fps: allLogs.filter(log =>
        log.message.includes('60fps target') ||
        log.message.includes('Frame budget pressure:') ||
        log.message.includes('Slow render:') ||
        log.message.includes('Slow resize detected:') ||
        log.message.includes('Slow movement detected:') ||
        log.message.includes('meets60fps') ||
        log.message.includes('meetsSub100msTarget')
      ),

      // Render scheduling patterns
      renderScheduling: allLogs.filter(log =>
        log.message.includes('Render requested') ||
        log.message.includes('Render scheduled') ||
        log.message.includes('Render started') ||
        log.message.includes('Render completed') ||
        log.message.includes('📋') ||
        log.message.includes('⏰') ||
        log.message.includes('🚀') ||
        log.message.includes('✅') && log.message.includes('render')
      ),

      // YScale validation patterns
      yscaleValidation: allLogs.filter(log =>
        log.message.includes('YScale Validation Results') ||
        log.message.includes('📏') && log.message.includes('Validation') ||
        log.message.includes('Bounds Compliance:') ||
        log.message.includes('Coverage:') ||
        log.message.includes('displayId]') && log.message.includes('YScale')
      ),

      // 🔧 PHASE 4: Coordinate Consistency Patterns for Atomic Transaction System
      coordinateConsistency: allLogs.filter(log =>
        log.message.includes('RESIZE TRANSACTION:') ||
        log.message.includes('ATOMIC RESIZE TRANSACTION:') ||
        log.message.includes('ADR_ALIGNMENT:') ||
        log.message.includes('COORDINATE_VALIDATION:') ||
        log.message.includes('Coordinate systems not synchronized') ||
        log.message.includes('Transaction completed in') ||
        log.message.includes('ADR alignment deviation:') ||
        log.message.includes('YScale consistency:') ||
        log.message.includes('Synchronization validation:') ||
        log.message.includes('Canvas dimension update:') ||
        log.message.includes('coordinate validation failed')
      ),

      // Atomic resize transaction performance patterns
      atomicResizePerformance: allLogs.filter(log =>
        log.message.includes('Transaction completed in') && log.message.includes('ms') ||
        log.message.includes('ADR alignment deviation:') && log.message.includes('px') ||
        log.message.includes('Coordinate validation:') ||
        log.message.includes('ATOMIC_TRANSACTION_COMPLETE') ||
        log.message.includes('RESIZE_PERFORMANCE_METRICS')
      ),

      // Data flow patterns
      dataFlow: allLogs.filter(log =>
        log.message.includes('Data flow:') ||
        log.message.includes('📤') ||
        log.message.includes('📥') ||
        log.message.includes('🔄') ||
        log.message.includes('subscription_sent') ||
        log.message.includes('data_received') ||
        log.message.includes('first_tick')
      ),

      // Enhanced display creation patterns
      displayCreation: allLogs.filter(log =>
        log.message.includes('Creating display for symbol:') ||
        log.message.includes('Canvas initialized successfully:') ||
        log.message.includes('YScale validation') ||
        log.message.includes('DISPLAY:') && log.message.includes('Creation Complete')
      )
    };

    return {
      totalLogs: allLogs.length,
      patterns,
      summary: {
        hasContainerResize: patterns.containerResize.length > 0,
        hasContainerMovement: patterns.containerMovement.length > 0,
        hasLatencyTracking: patterns.webSocketToRenderLatency.length > 0,
        hasPerformanceValidation: patterns.performance60fps.length > 0,
        hasRenderScheduling: patterns.renderScheduling.length > 0,
        hasYScaleValidation: patterns.yscaleValidation.length > 0,
        hasCoordinateConsistency: patterns.coordinateConsistency.length > 0,
        hasAtomicResizePerformance: patterns.atomicResizePerformance.length > 0,
        hasDataFlowTracking: patterns.dataFlow.length > 0,
        hasDisplayCreation: patterns.displayCreation.length > 0
      }
    };
  }

  /**
   * Validate performance thresholds from console logs
   * @param {Object} page - Playwright page object
   * @returns {Object} Performance validation results
   */
  async validatePerformanceThresholds(page) {
    const logs = await this.getConsoleLogs(page);

    // Extract performance metrics from logs
    const performanceLogs = logs.filter(log => {
      const message = log.message;
      return message.includes('rendered in') && message.includes('ms') ||
             message.includes('latency:') && message.includes('ms') ||
             message.includes('Slow') && message.includes('ms');
    });

    const metrics = {
      renderTimes: [],
      latencyMeasurements: [],
      slowOperations: [],
      frameBudgetPressures: []
    };

    performanceLogs.forEach(log => {
      const message = log.message;

      // Extract render times
      const renderMatch = message.match(/rendered in ([\d.]+)ms/);
      if (renderMatch) {
        metrics.renderTimes.push(parseFloat(renderMatch[1]));
      }

      // Extract latency measurements
      const latencyMatch = message.match(/latency: ([\d.]+)ms/);
      if (latencyMatch) {
        metrics.latencyMeasurements.push(parseFloat(latencyMatch[1]));
      }

      // Extract slow operations
      if (message.includes('Slow') || message.includes('CRITICAL')) {
        metrics.slowOperations.push({
          type: message.includes('latency') ? 'latency' :
                message.includes('render') ? 'render' :
                message.includes('resize') ? 'resize' : 'movement',
          message: message,
          timestamp: log.timestamp
        });
      }

      // Extract frame budget pressures
      if (message.includes('Frame budget pressure')) {
        const budgetMatch = message.match(/([0-9.]+)ms remaining/);
        if (budgetMatch) {
          metrics.frameBudgetPressures.push(parseFloat(budgetMatch[1]));
        }
      }
    });

    // Calculate performance validation results
    const results = {
      render60fpsCompliance: this.calculate60fpsCompliance(metrics.renderTimes),
      latency100msCompliance: this.calculate100msCompliance(metrics.latencyMeasurements),
      slowOperationCount: metrics.slowOperations.length,
      frameBudgetPressureEvents: metrics.frameBudgetPressures.length,
      overallPerformanceGrade: this.calculatePerformanceGrade(metrics)
    };

    return {
      metrics,
      results,
      validation: {
        meets60fpsTarget: results.render60fpsCompliance.percentage >= 90,
        meets100msLatencyTarget: results.latency100msCompliance.percentage >= 95,
        hasNoCriticalSlowOperations: !metrics.slowOperations.some(op => op.message.includes('CRITICAL')),
        hasMinimalFrameBudgetPressure: metrics.frameBudgetPressures.length <= 2
      }
    };
  }

  /**
   * Calculate 60fps compliance percentage
   */
  calculate60fpsCompliance(renderTimes) {
    if (renderTimes.length === 0) return { percentage: 0, count: 0, total: 0 };

    const compliantRenders = renderTimes.filter(time => time <= 16.67); // 60fps target
    const percentage = (compliantRenders.length / renderTimes.length) * 100;

    return {
      percentage: Math.round(percentage * 100) / 100,
      count: compliantRenders.length,
      total: renderTimes.length,
      averageRenderTime: renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length
    };
  }

  /**
   * Calculate 100ms latency compliance percentage
   */
  calculate100msCompliance(latencyMeasurements) {
    if (latencyMeasurements.length === 0) return { percentage: 0, count: 0, total: 0 };

    const compliantLatency = latencyMeasurements.filter(time => time < 100); // 100ms target
    const percentage = (compliantLatency.length / latencyMeasurements.length) * 100;

    return {
      percentage: Math.round(percentage * 100) / 100,
      count: compliantLatency.length,
      total: latencyMeasurements.length,
      averageLatency: latencyMeasurements.reduce((sum, time) => sum + time, 0) / latencyMeasurements.length
    };
  }

  /**
   * Calculate overall performance grade
   */
  calculatePerformanceGrade(metrics) {
    const renderCompliance = this.calculate60fpsCompliance(metrics.renderTimes);
    const latencyCompliance = this.calculate100msCompliance(metrics.latencyMeasurements);

    let score = 0;
    let maxScore = 0;

    // Render performance (40% weight)
    maxScore += 40;
    score += (renderCompliance.percentage / 100) * 40;

    // Latency performance (40% weight)
    maxScore += 40;
    score += (latencyCompliance.percentage / 100) * 40;

    // Slow operations penalty (20% weight)
    maxScore += 20;
    const slowOperationPenalty = Math.min(20, metrics.slowOperations.length * 5);
    score += Math.max(0, 20 - slowOperationPenalty);

    const finalScore = (score / maxScore) * 100;

    let grade;
    if (finalScore >= 95) grade = 'A+';
    else if (finalScore >= 90) grade = 'A';
    else if (finalScore >= 85) grade = 'B+';
    else if (finalScore >= 80) grade = 'B';
    else if (finalScore >= 75) grade = 'C+';
    else if (finalScore >= 70) grade = 'C';
    else if (finalScore >= 65) grade = 'D';
    else grade = 'F';

    return {
      score: Math.round(finalScore * 100) / 100,
      grade,
      components: {
        renderPerformance: renderCompliance.percentage,
        latencyPerformance: latencyCompliance.percentage,
        slowOperationPenalty: slowOperationPenalty
      }
    };
  }

  /**
   * Wait for specific enhanced logging pattern
   * @param {Object} page - Playwright page object
   * @param {string} patternType - Pattern type to wait for
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Object>} The matching log entry
   */
  async waitForEnhancedLogPattern(page, patternType, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const patternMatchers = {
        containerResize: (log) => log.message.includes('Container resized:') || log.message.includes('📏'),
        containerMovement: (log) => log.message.includes('Container moved:') || log.message.includes('✋'),
        latencyTracking: (log) => log.message.includes('WebSocket→Render latency:') || log.message.includes('⚡'),
        performanceValidation: (log) => log.message.includes('60fps target') || log.message.includes('Slow render:'),
        renderScheduling: (log) => log.message.includes('Render completed') || log.message.includes('✅.*render'),
        yscaleValidation: (log) => log.message.includes('YScale Validation Results'),
        dataFlow: (log) => log.message.includes('Data flow:') || log.message.includes('📤')
      };

      const matcher = patternMatchers[patternType];
      if (!matcher) {
        reject(new Error(`Unknown pattern type: ${patternType}`));
        return;
      }

      const checkForPattern = async () => {
        try {
          const logs = await this.getConsoleLogs(page);
          const matchingLog = logs.find(matcher);

          if (matchingLog) {
            resolve(matchingLog);
            return;
          }

          if (Date.now() - startTime > timeout) {
            reject(new Error(`Timeout waiting for enhanced log pattern: ${patternType}`));
            return;
          }

          setTimeout(checkForPattern, 100);
        } catch (error) {
          reject(error);
        }
      };

      checkForPattern();
    });
  }

  /**
   * Get container resize/movement analytics
   * @param {Object} page - Playwright page object
   * @returns {Object} Container interaction analytics
   */
  async getContainerInteractionAnalytics(page) {
    const logs = await this.getConsoleLogs(page);

    const resizeLogs = logs.filter(log =>
      log.message.includes('Container resized:') ||
      log.message.includes('📏') ||
      log.message.includes('📐')
    );

    const movementLogs = logs.filter(log =>
      log.message.includes('Container moved:') ||
      log.message.includes('✋') ||
      log.message.includes('⌨️') ||
      log.message.includes('📍')
    );

    // Extract quantitative data from logs
    const resizeData = resizeLogs.map(log => {
      const message = log.message;
      const sizeMatch = message.match(/(\d+)×(\d+)\s*→\s*(\d+)×(\d+)/);
      return {
        timestamp: log.timestamp,
        oldSize: sizeMatch ? { width: parseInt(sizeMatch[1]), height: parseInt(sizeMatch[2]) } : null,
        newSize: sizeMatch ? { width: parseInt(sizeMatch[3]), height: parseInt(sizeMatch[4]) } : null,
        hasPerformanceData: message.includes('ms')
      };
    });

    const movementData = movementLogs.map(log => {
      const message = log.message;
      const posMatch = message.match(/\((\d+),\s*(\d+)\)\s*→\s*\((\d+),\s*(\d+)\)/);
      return {
        timestamp: log.timestamp,
        oldPosition: posMatch ? { x: parseInt(posMatch[1]), y: parseInt(posMatch[2]) } : null,
        newPosition: posMatch ? { x: parseInt(posMatch[3]), y: parseInt(posMatch[4]) } : null,
        hasPerformanceData: message.includes('ms')
      };
    });

    return {
      resizeEvents: {
        count: resizeLogs.length,
        data: resizeData,
        hasPerformanceTracking: resizeData.some(r => r.hasPerformanceData)
      },
      movementEvents: {
        count: movementLogs.length,
        data: movementData,
        hasPerformanceTracking: movementData.some(m => m.hasPerformanceData)
      },
      summary: {
        totalInteractions: resizeLogs.length + movementLogs.length,
        hasComprehensiveLogging: resizeLogs.length > 0 && movementLogs.length > 0,
        performanceTrackingCoverage: (resizeData.filter(r => r.hasPerformanceData).length + movementData.filter(m => m.hasPerformanceData).length) / (resizeData.length + movementData.length) * 100
      }
    };
  }
}

// Singleton instance for use across tests
export const browserAgentManager = new BrowserAgentManager();

export default browserAgentManager;