/**
 * PerformanceValidator - Professional Trading Performance Validation
 *
 * Enforces critical performance constraints required for professional trading platforms.
 * Validates 60fps rendering, sub-100ms latency, DPR-aware crisp rendering, memory stability,
 * and extended session stability for real-world trading workflows.
 *
 * Design Philosophy: Simple, Performant, Maintainable
 * - Simple: Clear validation API with comprehensive reporting
 * - Performant: Zero-impact validation that doesn't affect application performance
 * - Maintainable: Modular design with extensible validation patterns
 *
 * Usage Pattern:
 * ```javascript
 * const validator = new PerformanceValidator(page);
 * await validator.startValidation();
 * const fpsResult = await validator.validateFrameRate('rapid-price-update');
 * const latencyResult = await validator.validateLatency('data-to-visual');
 * const report = await validator.generatePerformanceReport();
 * ```
 */

import { createLogger } from '../../src/utils/debugLogger.js';

/**
 * Performance thresholds for professional trading platforms
 */
const TRADING_PERFORMANCE_THRESHOLDS = {
  FRAME_RATE: {
    TARGET: 60,              // Target FPS for smooth rendering
    MINIMUM: 55,             // Minimum acceptable FPS
    CRITICAL: 45,            // Critical failure threshold
    MAX_FRAME_TIME: 16.67,   // Maximum time per frame (1000ms / 60fps)
    CONSECUTIVE_DROPS: 3,    // Consecutive drops before failure
    VARIANCE_TOLERANCE: 5    // FPS variance tolerance
  },
  LATENCY: {
    DATA_TO_VISUAL: 100,     // Maximum data-to-visual latency (ms)
    WEBSOCKET_PROCESSING: 50, // Maximum WebSocket message processing time (ms)
    UI_RESPONSE: 200,        // Maximum UI response time (ms)
    MARKET_DATA_UPDATE: 150, // Maximum market data update time (ms)
    CRITICAL_SPIKE: 500      // Critical latency spike threshold (ms)
  },
  MEMORY: {
    MAX_GROWTH_MB_PER_HOUR: 50,  // Maximum memory growth per hour
    LEAK_DETECTION_WINDOW: 30000, // Memory leak detection window (30s)
    MAX_GC_PAUSE: 100,            // Maximum garbage collection pause (ms)
    HEAP_UTILIZATION_THRESHOLD: 0.8 // Maximum heap utilization ratio
  },
  QUALITY: {
    MIN_DPR_SCALE: 0.95,     // Minimum DPR scaling accuracy
    MAX_TEXT_BLUR: 2,        // Maximum text blur score
    MIN_CANVAS_SHARPNESS: 0.9, // Minimum canvas sharpness score
    PRICE_PRECISION_TOLERANCE: 0.001 // Price display precision tolerance
  },
  EXTENDED_SESSION: {
    MIN_DURATION_MS: 2 * 60 * 60 * 1000, // 2 hours minimum
    MAX_DEGRADATION_PERCENT: 10, // Maximum performance degradation
    RESOURCE_CLEANUP_TIMEOUT: 5000, // Resource cleanup timeout (ms)
    STABILITY_CHECK_INTERVAL: 60000 // Stability check interval (ms)
  }
};

/**
 * Validation categories for reporting
 */
const VALIDATION_CATEGORIES = {
  CRITICAL: 'critical',     // Complete performance breakdowns
  WARNING: 'warning',       // Performance approaching thresholds
  QUALITY: 'quality',       // Rendering or visual accuracy problems
  RESOURCE: 'resource'      // Memory, CPU, or network constraints
};

/**
 * PerformanceValidator - Professional trading performance validation
 */
export class PerformanceValidator {
  constructor(page, options = {}) {
    this.page = page;
    this.options = {
      fpsTarget: 60,
      latencyThreshold: 100,
      memoryGrowthThreshold: 50, // MB/hour
      extendedSessionDuration: 120 * 60 * 1000, // 2 hours
      enableRealTimeValidation: true,
      enableQualityValidation: true,
      enableMemoryTracking: true,
      thresholds: TRADING_PERFORMANCE_THRESHOLDS,
      ...options
    };

    this.logger = createLogger('PerformanceValidator');
    this.isValidating = false;
    this.startTime = null;

    // Validation state
    this.validationState = {
      frameRate: {
        samples: [],
        violations: [],
        consecutiveDrops: 0,
        lastValidFrame: null
      },
      latency: {
        measurements: new Map(),
        violations: [],
        spikes: [],
        trends: []
      },
      memory: {
        snapshots: [],
        growthTrend: [],
        gcEvents: [],
        leaks: []
      },
      quality: {
        dprValidation: [],
        textClarity: [],
        canvasSharpness: [],
        priceAccuracy: []
      },
      extendedSession: {
        startTime: null,
        performanceBaseline: null,
        degradationPoints: [],
        stabilityChecks: []
      }
    };

    // Validation results
    this.results = {
      passed: [],
      failed: [],
      warnings: [],
      critical: [],
      summary: null
    };

    // Tracking handles for cleanup
    this.handles = {
      frameRateMonitor: null,
      memoryMonitor: null,
      latencyTracker: null,
      qualityChecker: null,
      sessionMonitor: null
    };
  }

  /**
   * Start comprehensive performance validation
   */
  async startValidation() {
    if (this.isValidating) {
      this.logger.warn('Validation already active');
      return;
    }

    this.logger.debug('Starting comprehensive performance validation');
    this.startTime = Date.now();
    this.isValidating = true;

    try {
      // Initialize browser context for validation
      await this._initializeValidationContext();

      // Setup frame rate monitoring
      await this._setupFrameRateValidation();

      // Setup latency tracking
      await this._setupLatencyValidation();

      // Setup memory monitoring
      if (this.options.enableMemoryTracking) {
        await this._setupMemoryValidation();
      }

      // Setup quality validation
      if (this.options.enableQualityValidation) {
        await this._setupQualityValidation();
      }

      // Setup extended session monitoring
      await this._setupExtendedSessionValidation();

      // Establish performance baseline
      await this._establishPerformanceBaseline();

      this.logger.debug('Performance validation initialized successfully');

    } catch (error) {
      this.logger.error('Failed to start validation', error);
      await this.stopValidation();
      throw error;
    }
  }

  /**
   * Stop validation and generate final report
   */
  async stopValidation() {
    if (!this.isValidating) {
      return this.results;
    }

    this.logger.debug('Stopping performance validation');
    this.isValidating = false;

    // Cleanup all monitoring handles
    Object.values(this.handles).forEach(handle => {
      if (handle && typeof handle.remove === 'function') {
        handle.remove();
      }
      if (handle && typeof handle clearInterval === 'function') {
        clearInterval(handle);
      }
    });

    // Generate final results summary
    this._generateResultsSummary();

    const duration = Date.now() - this.startTime;
    this.logger.debug(`Validation stopped. Total duration: ${duration}ms`);

    return this.results;
  }

  /**
   * Validate frame rate performance for a specific operation
   * @param {string} operation - Operation identifier
   * @param {number} durationMs - Validation duration
   * @returns {Promise<Object>} Frame rate validation result
   */
  async validateFrameRate(operation, durationMs = 5000) {
    this.logger.debug(`Validating frame rate for operation: ${operation}`);

    const startTime = Date.now();
    const samples = [];
    let violations = 0;
    let consecutiveDrops = 0;

    // Monitor frame rate during operation
    const frameRatePromise = this.page.evaluate(() => {
      return new Promise(resolve => {
        const frameSamples = [];
        let lastFrameTime = performance.now();
        let frameCount = 0;

        const measureFrame = () => {
          const currentTime = performance.now();
          const frameTime = currentTime - lastFrameTime;
          const fps = 1000 / frameTime;

          frameSamples.push({
            frameTime,
            fps,
            timestamp: currentTime
          });

          lastFrameTime = currentTime;
          frameCount++;

          if (currentTime - startTime >= durationMs) {
            resolve(frameSamples);
          } else {
            requestAnimationFrame(measureFrame);
          }
        };

        requestAnimationFrame(measureFrame);
      });
    });

    const frameSamples = await frameRatePromise;
    const threshold = this.options.thresholds.FRAME_RATE;

    // Analyze frame rate data
    const avgFPS = frameSamples.reduce((sum, sample) => sum + sample.fps, 0) / frameSamples.length;
    const minFPS = Math.min(...frameSamples.map(s => s.fps));
    const maxFPS = Math.max(...frameSamples.map(s => s.fps));
    const variance = this._calculateVariance(frameSamples.map(s => s.fps));

    // Detect violations
    for (const sample of frameSamples) {
      if (sample.fps < threshold.MINIMUM) {
        violations++;
        consecutiveDrops++;
        if (consecutiveDrops >= threshold.CONSECUTIVE_DROPS) {
          this._recordViolation('frame_rate', {
            operation,
            type: 'consecutive_drops',
            value: sample.fps,
            threshold: threshold.MINIMUM,
            count: consecutiveDrops,
            timestamp: Date.now()
          });
        }
      } else {
        consecutiveDrops = 0;
      }
    }

    const result = {
      operation,
      duration: Date.now() - startTime,
      frameRate: {
        average: avgFPS,
        minimum: minFPS,
        maximum: maxFPS,
        variance,
        samples: frameSamples.length
      },
      violations,
      passed: avgFPS >= threshold.TARGET && violations === 0,
      quality: this._assessFrameRateQuality(avgFPS, variance, violations)
    };

    this.validationState.frameRate.samples.push(...frameSamples);
    this._recordValidationResult('frame_rate', result);

    this.logger.debug(`Frame rate validation for ${operation}: ${avgFPS.toFixed(2)}fps (${result.passed ? '✅' : '❌'})`);
    return result;
  }

  /**
   * Validate data-to-visual latency
   * @param {string} metric - Latency metric identifier
   * @param {Function} operation - Operation to measure
   * @returns {Promise<Object>} Latency validation result
   */
  async validateLatency(metric, operation) {
    this.logger.debug(`Validating latency for metric: ${metric}`);

    // Start precision timing
    const startTime = performance.now();

    try {
      // Inject precision timing markers
      await this.page.evaluate(() => {
        window.performanceValidator = window.performanceValidator || {};
        window.performanceValidator.latencyStart = performance.now();
      });

      // Execute the operation
      const operationResult = await operation();

      // Measure end time and visual update
      const visualUpdateTime = await this.page.evaluate(async () => {
        // Wait for next animation frame to ensure visual update
        return new Promise(resolve => {
          requestAnimationFrame(() => {
            const visualEnd = performance.now();
            resolve(visualEnd - window.performanceValidator.latencyStart);
          });
        });
      });

      const totalLatency = performance.now() - startTime;
      const threshold = this.options.thresholds.LATENCY[metric.toUpperCase()] || this.options.latencyThreshold;

      const result = {
        metric,
        totalLatency,
        visualLatency: visualUpdateTime,
        operationLatency: totalLatency - visualUpdateTime,
        threshold,
        passed: totalLatency <= threshold,
        timestamp: Date.now()
      };

      // Store measurement for trend analysis
      if (!this.validationState.latency.measurements.has(metric)) {
        this.validationState.latency.measurements.set(metric, []);
      }
      this.validationState.latency.measurements.get(metric).push(result);

      // Detect latency spikes
      if (totalLatency > threshold * 2) {
        this.validationState.latency.spikes.push({
          metric,
          value: totalLatency,
          threshold,
          timestamp: Date.now()
        });
        this._recordViolation('latency', {
          metric,
          type: 'spike',
          value: totalLatency,
          threshold,
          timestamp: Date.now()
        }, VALIDATION_CATEGORIES.CRITICAL);
      }

      this._recordValidationResult('latency', result);
      this.logger.debug(`Latency validation for ${metric}: ${totalLatency.toFixed(2)}ms (${result.passed ? '✅' : '❌'})`);

      return result;

    } catch (error) {
      const failedResult = {
        metric,
        error: error.message,
        passed: false,
        timestamp: Date.now()
      };

      this._recordValidationResult('latency', failedResult);
      throw error;
    }
  }

  /**
   * Validate memory stability over time
   * @param {string} testType - Type of memory test
   * @param {number} durationMs - Test duration
   * @returns {Promise<Object>} Memory stability result
   */
  async validateMemoryStability(testType, durationMs = 60000) {
    this.logger.debug(`Validating memory stability for test: ${testType}`);

    const startTime = Date.now();
    const snapshots = [];
    const threshold = this.options.thresholds.MEMORY;

    // Take initial memory snapshot
    const initialMemory = await this._getMemorySnapshot();
    snapshots.push({ ...initialMemory, timestamp: startTime });

    // Monitor memory over duration
    const monitorInterval = setInterval(async () => {
      if (!this.isValidating) return;

      const memory = await this._getMemorySnapshot();
      if (memory) {
        snapshots.push({ ...memory, timestamp: Date.now() });
      }
    }, 2000);

    // Wait for test duration
    await new Promise(resolve => setTimeout(resolve, durationMs));
    clearInterval(monitorInterval);

    // Take final memory snapshot
    const finalMemory = await this._getMemorySnapshot();
    snapshots.push({ ...finalMemory, timestamp: Date.now() });

    // Analyze memory stability
    const memoryGrowth = finalMemory.used - initialMemory.used;
    const growthMB = memoryGrowth / (1024 * 1024);
    const durationHours = durationMs / (1000 * 60 * 60);
    const growthRate = growthMB / durationHours;

    // Detect memory leaks
    const leakDetected = growthRate > threshold.MAX_GROWTH_MB_PER_HOUR;
    const heapUtilization = finalMemory.used / finalMemory.limit;

    const result = {
      testType,
      duration: Date.now() - startTime,
      memory: {
        initial: initialMemory,
        final: finalMemory,
        growth: memoryGrowth,
        growthRate, // MB per hour
        heapUtilization,
        snapshots: snapshots.length
      },
      leakDetected,
      passed: !leakDetected && heapUtilization < threshold.HEAP_UTILIZATION_THRESHOLD,
      threshold: threshold.MAX_GROWTH_MB_PER_HOUR
    };

    this.validationState.memory.snapshots.push(...snapshots);
    this.validationState.memory.growthTrend.push({
      testType,
      growthRate,
      timestamp: Date.now()
    });

    if (leakDetected) {
      this.validationState.memory.leaks.push({
        testType,
        growthRate,
        threshold: threshold.MAX_GROWTH_MB_PER_HOUR,
        timestamp: Date.now()
      });
      this._recordViolation('memory', {
        testType,
        type: 'leak',
        growthRate,
        threshold: threshold.MAX_GROWTH_MB_PER_HOUR,
        timestamp: Date.now()
      }, VALIDATION_CATEGORIES.CRITICAL);
    }

    this._recordValidationResult('memory', result);
    this.logger.debug(`Memory stability for ${testType}: ${growthRate.toFixed(2)}MB/hr (${result.passed ? '✅' : '❌'})`);

    return result;
  }

  /**
   * Validate DPR-aware rendering quality
   * @param {string} elementSelector - Element to validate
   * @returns {Promise<Object>} Rendering quality result
   */
  async validateRenderingQuality(elementSelector) {
    this.logger.debug(`Validating rendering quality for element: ${elementSelector}`);

    try {
      const qualityMetrics = await this.page.evaluate((selector) => {
        const element = document.querySelector(selector);
        if (!element) {
          throw new Error(`Element not found: ${selector}`);
        }

        const canvas = element.querySelector('canvas');
        if (!canvas) {
          throw new Error(`Canvas not found in element: ${selector}`);
        }

        // Get DPR information
        const dpr = window.devicePixelRatio || 1;
        const context = canvas.getContext('2d');

        // Validate DPR scaling
        const backingStorePixelRatio = context.webkitBackingStorePixelRatio ||
          context.mozBackingStorePixelRatio ||
          context.msBackingStorePixelRatio ||
          context.oBackingStorePixelRatio ||
          context.backingStorePixelRatio || 1;

        const actualScale = dpr / backingStorePixelRatio;
        const scaleAccuracy = Math.min(actualScale, dpr) / Math.max(actualScale, dpr);

        // Measure text clarity (simplified)
        const textMetrics = {
          fontSize: null,
          fontFamily: null,
          textBaseline: null,
          textAlign: null
        };

        // Check if text rendering properties are set
        const ctxProps = ['font', 'textBaseline', 'textAlign'];
        for (const prop of ctxProps) {
          if (context[prop]) {
            textMetrics[prop] = context[prop];
          }
        }

        // Measure canvas sharpness (edge detection simulation)
        const imageData = context.getImageData(0, 0, Math.min(100, canvas.width), Math.min(100, canvas.height));
        const edges = this._detectEdges(imageData);
        const sharpnessScore = edges.length / (imageData.width * imageData.height) * 100;

        return {
          dpr: {
            actual: actualScale,
            expected: dpr,
            accuracy: scaleAccuracy
          },
          textMetrics,
          sharpness: {
            score: sharpnessScore,
            edges: edges.length
          },
          canvas: {
            width: canvas.width,
            height: canvas.height,
            styleWidth: canvas.style.width || 'auto',
            styleHeight: canvas.style.height || 'auto'
          }
        };
      }, elementSelector);

      const threshold = this.options.thresholds.QUALITY;
      const qualityPassed =
        qualityMetrics.dpr.accuracy >= threshold.MIN_DPR_SCALE &&
        qualityMetrics.sharpness.score >= threshold.MIN_CANVAS_SHARPNESS * 100;

      const result = {
        elementSelector,
        quality: qualityMetrics,
        passed: qualityPassed,
        timestamp: Date.now()
      };

      this.validationState.quality.dprValidation.push(result);
      this._recordValidationResult('quality', result);

      this.logger.debug(`Rendering quality for ${elementSelector}: DPR ${(qualityMetrics.dpr.accuracy * 100).toFixed(1)}% (${result.passed ? '✅' : '❌'})`);
      return result;

    } catch (error) {
      const failedResult = {
        elementSelector,
        error: error.message,
        passed: false,
        timestamp: Date.now()
      };

      this._recordValidationResult('quality', failedResult);
      throw error;
    }
  }

  /**
   * Validate extended session stability
   * @param {number} durationMs - Session duration to validate
   * @returns {Promise<Object>} Extended session result
   */
  async validateExtendedSession(durationMs = null) {
    const sessionDuration = durationMs || this.options.extendedSessionDuration;
    this.logger.debug(`Validating extended session stability: ${sessionDuration / 1000 / 60} minutes`);

    const startTime = Date.now();
    const baseline = this.validationState.extendedSession.performanceBaseline;

    if (!baseline) {
      throw new Error('Performance baseline not established. Call startValidation() first.');
    }

    this.validationState.extendedSession.startTime = startTime;

    // Monitor performance degradation over time
    const stabilityChecks = [];
    const checkInterval = setInterval(async () => {
      if (!this.isValidating) return;

      const currentTime = Date.now();
      const elapsed = currentTime - startTime;

      // Collect current performance metrics
      const currentFrameRate = await this._getCurrentFrameRate();
      const currentMemory = await this._getMemorySnapshot();

      // Calculate degradation
      const frameRateDegradation = baseline.frameRate ?
        ((baseline.frameRate - currentFrameRate) / baseline.frameRate) * 100 : 0;
      const memoryGrowth = currentMemory && baseline.memory ?
        ((currentMemory.used - baseline.memory.used) / baseline.memory.used) * 100 : 0;

      const check = {
        elapsed,
        frameRate: currentFrameRate,
        frameRateDegradation,
        memoryGrowth,
        timestamp: currentTime
      };

      stabilityChecks.push(check);

      // Check for significant degradation
      const threshold = this.options.thresholds.EXTENDED_SESSION;
      if (frameRateDegradation > threshold.MAX_DEGRADATION_PERCENT) {
        this.validationState.extendedSession.degradationPoints.push({
          type: 'frame_rate',
          degradation: frameRateDegradation,
          threshold: threshold.MAX_DEGRADATION_PERCENT,
          timestamp: currentTime
        });
      }

    }, this.options.thresholds.EXTENDED_SESSION.STABILITY_CHECK_INTERVAL);

    // Wait for session duration
    await new Promise(resolve => setTimeout(resolve, sessionDuration));
    clearInterval(checkInterval);

    // Analyze extended session results
    const finalFrameRate = await this._getCurrentFrameRate();
    const finalMemory = await this._getMemorySnapshot();
    const totalFrameRateDegradation = baseline.frameRate ?
      ((baseline.frameRate - finalFrameRate) / baseline.frameRate) * 100 : 0;
    const totalMemoryGrowth = finalMemory && baseline.memory ?
      ((finalMemory.used - baseline.memory.used) / (1024 * 1024)) : 0;

    const passed =
      totalFrameRateDegradation <= this.options.thresholds.EXTENDED_SESSION.MAX_DEGRADATION_PERCENT &&
      totalMemoryGrowth <= this.options.thresholds.MEMORY.MAX_GROWTH_MB_PER_HOUR * (sessionDuration / (1000 * 60 * 60));

    const result = {
      duration: Date.now() - startTime,
      performanceBaseline: baseline,
      final: {
        frameRate: finalFrameRate,
        memory: finalMemory
      },
      degradation: {
        frameRate: totalFrameRateDegradation,
        memory: totalMemoryGrowth
      },
      stabilityChecks: stabilityChecks.length,
      passed,
      timestamp: Date.now()
    };

    this.validationState.extendedSession.stabilityChecks.push(...stabilityChecks);
    this._recordValidationResult('extended_session', result);

    this.logger.debug(`Extended session validation: ${(totalFrameRateDegradation).toFixed(1)}% degradation (${result.passed ? '✅' : '❌'})`);
    return result;
  }

  /**
   * Generate comprehensive performance report
   * @returns {Promise<Object>} Complete performance validation report
   */
  async generatePerformanceReport() {
    this.logger.debug('Generating comprehensive performance report');

    const report = {
      metadata: {
        validationStartTime: this.startTime,
        duration: this.isValidating ? Date.now() - this.startTime : null,
        isActive: this.isValidating,
        thresholds: this.options.thresholds,
        generatedAt: Date.now()
      },
      results: this.results,
      validationState: this.validationState,
      analysis: this._analyzeValidationResults(),
      recommendations: this._generateRecommendations(),
      status: this._getOverallValidationStatus()
    };

    // Log summary to console
    this._logReportSummary(report);

    return report;
  }

  // Private methods

  async _initializeValidationContext() {
    await this.page.evaluate(() => {
      // Initialize performance validation context
      window.performanceValidator = {
        frameRateHistory: [],
        latencyMarks: new Map(),
        qualityMetrics: new Map(),
        sessionMetrics: {
          startTime: null,
          baseline: null,
          checkpoints: []
        }
      };

      // Setup performance observers if available
      if ('PerformanceObserver' in window) {
        try {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.entryType === 'measure') {
                window.performanceValidator.latencyMarks.set(entry.name, {
                  duration: entry.duration,
                  timestamp: entry.startTime
                });
              }
            }
          });
          observer.observe({ entryTypes: ['measure'] });
          window.performanceValidator.observer = observer;
        } catch (error) {
          console.warn('Performance observer setup failed:', error);
        }
      }
    });
  }

  async _setupFrameRateValidation() {
    this.handles.frameRateMonitor = setInterval(async () => {
      if (!this.isValidating) return;

      const frameRate = await this._getCurrentFrameRate();
      if (frameRate > 0) {
        this.validationState.frameRate.samples.push({
          fps: frameRate,
          timestamp: Date.now()
        });

        // Check for consecutive drops
        const threshold = this.options.thresholds.FRAME_RATE;
        if (frameRate < threshold.MINIMUM) {
          this.validationState.frameRate.consecutiveDrops++;
          if (this.validationState.frameRate.consecutiveDrops >= threshold.CONSECUTIVE_DROPS) {
            this._recordViolation('frame_rate', {
              type: 'consecutive_drops',
              value: frameRate,
              threshold: threshold.MINIMUM,
              count: this.validationState.frameRate.consecutiveDrops,
              timestamp: Date.now()
            }, VALIDATION_CATEGORIES.CRITICAL);
          }
        } else {
          this.validationState.frameRate.consecutiveDrops = 0;
        }

        // Keep only recent samples (last 5 minutes)
        const cutoff = Date.now() - 300000;
        this.validationState.frameRate.samples =
          this.validationState.frameRate.samples.filter(s => s.timestamp > cutoff);
      }
    }, 1000); // Check every second
  }

  async _setupLatencyValidation() {
    // Monitor for custom performance marks
    this.page.on('console', (msg) => {
      if (msg.type() === 'debug' && msg.text().includes('LATENCY_MEASURE:')) {
        try {
          const data = JSON.parse(msg.text().replace('LATENCY_MEASURE: ', ''));
          this.validationState.latency.measurements.set(data.metric, [
            ...(this.validationState.latency.measurements.get(data.metric) || []),
            {
              ...data,
              timestamp: Date.now()
            }
          ]);
        } catch (error) {
          // Ignore parsing errors
        }
      }
    });
  }

  async _setupMemoryValidation() {
    this.handles.memoryMonitor = setInterval(async () => {
      if (!this.isValidating) return;

      const memory = await this._getMemorySnapshot();
      if (memory) {
        this.validationState.memory.snapshots.push({
          ...memory,
          timestamp: Date.now()
        });

        // Keep only recent snapshots (last 10 minutes)
        const cutoff = Date.now() - 600000;
        this.validationState.memory.snapshots =
          this.validationState.memory.snapshots.filter(s => s.timestamp > cutoff);
      }
    }, 5000); // Check every 5 seconds
  }

  async _setupQualityValidation() {
    // Quality validation is done on-demand via validateRenderingQuality()
  }

  async _setupExtendedSessionValidation() {
    // Session monitoring is handled in validateExtendedSession()
  }

  async _establishPerformanceBaseline() {
    this.logger.debug('Establishing performance baseline');

    const baseline = {
      frameRate: await this._getCurrentFrameRate(),
      memory: await this._getMemorySnapshot(),
      timestamp: Date.now()
    };

    this.validationState.extendedSession.performanceBaseline = baseline;
    await this.page.evaluate((baseline) => {
      window.performanceValidator.sessionMetrics.baseline = baseline;
    }, baseline);

    this.logger.debug(`Performance baseline established: ${baseline.frameRate}fps`);
  }

  async _getCurrentFrameRate() {
    return await this.page.evaluate(() => {
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

  _calculateVariance(values) {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  _assessFrameRateQuality(avgFPS, variance, violations) {
    const threshold = this.options.thresholds.FRAME_RATE;

    if (avgFPS < threshold.CRITICAL || violations > 10) {
      return 'poor';
    } else if (avgFPS < threshold.MINIMUM || violations > 5) {
      return 'fair';
    } else if (avgFPS < threshold.TARGET || variance > threshold.VARIANCE_TOLERANCE) {
      return 'good';
    } else {
      return 'excellent';
    }
  }

  _recordValidationResult(type, result) {
    if (result.passed) {
      this.results.passed.push({ type, ...result });
    } else {
      this.results.failed.push({ type, ...result });
    }
  }

  _recordViolation(type, details, category = VALIDATION_CATEGORIES.CRITICAL) {
    const violation = { type, category, ...details };

    switch (category) {
      case VALIDATION_CATEGORIES.CRITICAL:
        this.results.critical.push(violation);
        break;
      case VALIDATION_CATEGORIES.WARNING:
        this.results.warnings.push(violation);
        break;
      case VALIDATION_CATEGORIES.QUALITY:
        this.results.warnings.push(violation);
        break;
      case VALIDATION_CATEGORIES.RESOURCE:
        this.results.warnings.push(violation);
        break;
    }
  }

  _analyzeValidationResults() {
    const totalValidations = this.results.passed.length + this.results.failed.length;
    const passRate = totalValidations > 0 ? (this.results.passed.length / totalValidations) * 100 : 0;
    const criticalIssues = this.results.critical.length;
    const warnings = this.results.warnings.length;

    // Analyze trends
    const frameRateTrend = this._analyzeFrameRateTrend();
    const latencyTrend = this._analyzeLatencyTrend();
    const memoryTrend = this._analyzeMemoryTrend();

    return {
      summary: {
        totalValidations,
        passRate,
        criticalIssues,
        warnings,
        status: criticalIssues > 0 ? 'critical_failure' :
                warnings > 5 ? 'degraded_performance' :
                passRate >= 95 ? 'excellent' : 'acceptable'
      },
      trends: {
        frameRate: frameRateTrend,
        latency: latencyTrend,
        memory: memoryTrend
      }
    };
  }

  _analyzeFrameRateTrend() {
    const samples = this.validationState.frameRate.samples;
    if (samples.length < 10) return 'insufficient_data';

    const recent = samples.slice(-10);
    const older = samples.slice(-20, -10);

    const recentAvg = recent.reduce((sum, s) => sum + s.fps, 0) / recent.length;
    const olderAvg = older.length > 0 ? older.reduce((sum, s) => sum + s.fps, 0) / older.length : recentAvg;

    const change = ((recentAvg - olderAvg) / olderAvg) * 100;

    if (change < -10) return 'degrading';
    if (change < -5) return 'declining';
    if (change > 5) return 'improving';
    return 'stable';
  }

  _analyzeLatencyTrend() {
    const measurements = this.validationState.latency.measurements;
    if (measurements.size === 0) return 'insufficient_data';

    let totalMeasurements = 0;
    let increasingTrends = 0;

    for (const [metric, data] of measurements) {
      if (data.length < 5) continue;

      totalMeasurements++;
      const recent = data.slice(-3);
      const older = data.slice(-6, -3);

      const recentAvg = recent.reduce((sum, d) => sum + d.totalLatency, 0) / recent.length;
      const olderAvg = older.reduce((sum, d) => sum + d.totalLatency, 0) / older.length;

      if (recentAvg > olderAvg * 1.1) {
        increasingTrends++;
      }
    }

    if (increasingTrends > totalMeasurements * 0.5) return 'increasing';
    if (increasingTrends > totalMeasurements * 0.2) return 'fluctuating';
    return 'stable';
  }

  _analyzeMemoryTrend() {
    const snapshots = this.validationState.memory.snapshots;
    if (snapshots.length < 5) return 'insufficient_data';

    const recent = snapshots.slice(-3);
    const older = snapshots.slice(-6, -3);

    const recentAvg = recent.reduce((sum, s) => sum + s.used, 0) / recent.length;
    const olderAvg = older.length > 0 ? older.reduce((sum, s) => sum + s.used, 0) / older.length : recentAvg;

    const growthRate = ((recentAvg - olderAvg) / olderAvg) * 100;

    if (growthRate > 20) return 'leaking';
    if (growthRate > 10) return 'growing';
    if (growthRate < -5) return 'optimizing';
    return 'stable';
  }

  _generateRecommendations() {
    const recommendations = [];
    const analysis = this._analyzeValidationResults();

    if (analysis.summary.criticalIssues > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'performance',
        message: 'Critical performance issues detected. Immediate optimization required.',
        details: `${analysis.summary.criticalIssues} critical failures found.`
      });
    }

    if (analysis.trends.frameRate === 'degrading') {
      recommendations.push({
        priority: 'high',
        category: 'rendering',
        message: 'Frame rate degradation detected. Review rendering optimization.',
        details: 'Consider implementing dirty rectangle rendering or reducing visual complexity.'
      });
    }

    if (analysis.trends.latency === 'increasing') {
      recommendations.push({
        priority: 'high',
        category: 'latency',
        message: 'Latency trends increasing. Review data processing pipeline.',
        details: 'Consider optimizing WebSocket message processing or reducing computational overhead.'
      });
    }

    if (analysis.trends.memory === 'leaking') {
      recommendations.push({
        priority: 'critical',
        category: 'memory',
        message: 'Memory leak detected. Review resource cleanup.',
        details: 'Check for event listener cleanup, object lifecycle management, and memory pools.'
      });
    }

    if (analysis.summary.passRate < 90) {
      recommendations.push({
        priority: 'medium',
        category: 'general',
        message: 'Performance validation pass rate below target.',
        details: `Current pass rate: ${analysis.summary.passRate.toFixed(1)}%. Target: 95%.`
      });
    }

    return recommendations;
  }

  _getOverallValidationStatus() {
    const analysis = this._analyzeValidationResults();

    if (analysis.summary.criticalIssues > 0) {
      return 'CRITICAL_FAILURE';
    } else if (analysis.summary.passRate < 80) {
      return 'MAJOR_ISSUES';
    } else if (analysis.summary.passRate < 95 || analysis.summary.warnings > 10) {
      return 'DEGRADED_PERFORMANCE';
    } else if (analysis.summary.warnings > 0) {
      return 'MINOR_ISSUES';
    } else {
      return 'EXCELLENT';
    }
  }

  _logReportSummary(report) {
    const status = report.status;
    const analysis = report.analysis.summary;

    console.log('\n' + '='.repeat(60));
    console.log('🔍 PERFORMANCE VALIDATION REPORT');
    console.log('='.repeat(60));
    console.log(`Status: ${status}`);
    console.log(`Validations: ${analysis.totalValidations} total`);
    console.log(`Pass Rate: ${analysis.passRate.toFixed(1)}%`);
    console.log(`Critical Issues: ${analysis.criticalIssues}`);
    console.log(`Warnings: ${analysis.warnings}`);
    console.log(`Duration: ${report.metadata.duration ? (report.metadata.duration / 1000 / 60).toFixed(1) + ' minutes' : 'Active'}`);

    if (report.recommendations.length > 0) {
      console.log('\n📋 RECOMMENDATIONS:');
      report.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. [${rec.priority.toUpperCase()}] ${rec.message}`);
      });
    }

    console.log('='.repeat(60) + '\n');
  }

  // Edge detection helper for quality validation
  _detectEdges(imageData) {
    const edges = [];
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    // Simple edge detection using Sobel operator
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;

        // Convert to grayscale
        const gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;

        // Get neighboring pixels
        const leftIdx = (y * width + (x - 1)) * 4;
        const rightIdx = (y * width + (x + 1)) * 4;
        const topIdx = ((y - 1) * width + x) * 4;
        const bottomIdx = ((y + 1) * width + x) * 4;

        const leftGray = data[leftIdx] * 0.299 + data[leftIdx + 1] * 0.587 + data[leftIdx + 2] * 0.114;
        const rightGray = data[rightIdx] * 0.299 + data[rightIdx + 1] * 0.587 + data[rightIdx + 2] * 0.114;
        const topGray = data[topIdx] * 0.299 + data[topIdx + 1] * 0.587 + data[topIdx + 2] * 0.114;
        const bottomGray = data[bottomIdx] * 0.299 + data[bottomIdx + 1] * 0.587 + data[bottomIdx + 2] * 0.114;

        // Calculate gradient
        const gradX = Math.abs(rightGray - leftGray);
        const gradY = Math.abs(bottomGray - topGray);
        const gradient = Math.sqrt(gradX * gradX + gradY * gradY);

        // Threshold for edge detection
        if (gradient > 30) {
          edges.push({ x, y, gradient });
        }
      }
    }

    return edges;
  }
}

/**
 * Factory function to create a performance validator instance
 * @param {Object} page - Playwright page object
 * @param {Object} options - Configuration options
 * @returns {PerformanceValidator} Performance validator instance
 */
export function createPerformanceValidator(page, options = {}) {
  return new PerformanceValidator(page, options);
}