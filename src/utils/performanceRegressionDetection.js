/**
 * Performance Regression Detection System
 *
 * Automatic performance degradation detection with baseline establishment,
 * trend analysis, and early warning system for trading applications.
 *
 * Design Philosophy: "Simple, Performant, Maintainable"
 * - Simple: Clear regression alerts with actionable insights
 * - Performant: <5ms detection overhead with efficient trend analysis
 * - Maintainable: Configurable thresholds with comprehensive logging
 */

/**
 * Performance regression detector with baseline management
 */
export class PerformanceRegressionDetector {
  constructor(options = {}) {
    this.analysisWindow = options.analysisWindow || 300; // 5 minutes of data
    this.baselineWindow = options.baselineWindow || 120; // 2 minutes for baseline
    this.detectionInterval = options.detectionInterval || 30000; // 30 seconds
    this.enabled = true;
    this.detecting = false;
    this.detectionTimer = null;

    // Regression thresholds (percentage degradation)
    this.thresholds = {
      fpsRegression: options.fpsRegression || 15,      // 15% FPS drop
      latencyRegression: options.latencyRegression || 25, // 25% latency increase
      memoryRegression: options.memoryRegression || 30,   // 30% memory growth
      frameTimeRegression: options.frameTimeRegression || 20, // 20% frame time increase
      consistencyRegression: options.consistencyRegression || 50 // 50% variance increase
    };

    // Baseline establishment criteria
    this.baselineCriteria = {
      minSamples: options.minSamples || 10,           // Minimum samples for baseline
      maxVariance: options.maxVariance || 10,         // Max 10% variance
      minDuration: options.minDuration || 60000       // Minimum 1 minute of data
    };

    // Baseline storage
    this.baseline = null;
    this.baselineHistory = []; // Track baseline changes over time
    this.baselineEstablished = false;

    // Current performance data
    this.performanceData = [];
    this.currentMetrics = null;

    // Regression detection state
    this.regressionHistory = [];
    this.activeRegressions = new Map();
    this.suppressionPeriod = 60000; // 1 minute suppression for same regression type

    // Callbacks for regression events
    this.callbacks = {
      onRegressionDetected: options.onRegressionDetected || null,
      onRegressionResolved: options.onRegressionResolved || null,
      onBaselineEstablished: options.onBaselineEstablished || null,
      onBaselineInvalidated: options.onBaselineInvalidated || null
    };

    console.log('[PERFORMANCE_REGRESSION] Regression detector initialized');
  }

  /**
   * Start regression detection
   */
  startDetection() {
    if (this.detecting || !this.enabled) {
      console.warn('[PERFORMANCE_REGRESSION] Detection already active or disabled');
      return false;
    }

    this.detecting = true;
    this.performanceData = [];
    this.regressionHistory = [];
    this.activeRegressions.clear();

    // Start periodic regression analysis
    this.detectionTimer = setInterval(() => {
      this.performRegressionAnalysis();
    }, this.detectionInterval);

    console.log('[PERFORMANCE_REGRESSION] Regression detection started');
    return true;
  }

  /**
   * Stop regression detection
   */
  stopDetection() {
    if (!this.detecting) {
      console.warn('[PERFORMANCE_REGRESSION] Detection not active');
      return false;
    }

    this.detecting = false;

    if (this.detectionTimer) {
      clearInterval(this.detectionTimer);
      this.detectionTimer = null;
    }

    console.log('[PERFORMANCE_REGRESSION] Regression detection stopped');
    return true;
  }

  /**
   * Add performance metrics data point
   */
  addMetricsData(metricsData) {
    if (!this.detecting) return;

    const dataPoint = {
      timestamp: Date.now(),
      fps: metricsData.frameRate?.currentFPS || 0,
      averageFPS: metricsData.frameRate?.averageFPS || 0,
      latency: metricsData.latency?.currentLatency || 0,
      averageLatency: metricsData.latency?.averageLatency || 0,
      memory: metricsData.memory?.current?.used || 0,
      frameTimeVariance: metricsData.frameRate?.frameTimeVariance || 0,
      frameTime: metricsData.frameRate ? (1000 / metricsData.frameRate.currentFPS) : 0
    };

    this.performanceData.push(dataPoint);
    this.currentMetrics = dataPoint;

    // Maintain data window size
    const cutoffTime = Date.now() - this.analysisWindow;
    this.performanceData = this.performanceData.filter(d => d.timestamp > cutoffTime);

    // Attempt baseline establishment if not established
    if (!this.baselineEstablished) {
      this.attemptBaselineEstablishment();
    }
  }

  /**
   * Attempt to establish performance baseline
   */
  attemptBaselineEstablishment() {
    if (this.performanceData.length < this.baselineCriteria.minSamples) {
      return false;
    }

    const recentData = this.performanceData.slice(-this.baselineWindow);
    const duration = recentData[recentData.length - 1].timestamp - recentData[0].timestamp;

    if (duration < this.baselineCriteria.minDuration) {
      return false;
    }

    // Calculate baseline statistics
    const baselineStats = this.calculateBaselineStatistics(recentData);

    // Validate baseline stability
    if (!this.validateBaselineStability(baselineStats)) {
      console.warn('[PERFORMANCE_REGRESSION] Baseline data too unstable for establishment');
      return false;
    }

    this.baseline = {
      ...baselineStats,
      establishedAt: Date.now(),
      sampleSize: recentData.length,
      duration
    };

    this.baselineEstablished = true;
    this.baselineHistory.push({ ...this.baseline });

    // Keep baseline history manageable
    if (this.baselineHistory.length > 10) {
      this.baselineHistory.shift();
    }

    this.triggerBaselineEstablished(this.baseline);

    console.log('[PERFORMANCE_REGRESSION] Performance baseline established:', {
      fps: Math.round(this.baseline.averageFPS),
      latency: Math.round(this.baseline.averageLatency),
      memory: this.formatMemory(this.baseline.averageMemory),
      sampleSize: this.baseline.sampleSize
    });

    return true;
  }

  /**
   * Calculate baseline statistics from performance data
   */
  calculateBaselineStatistics(data) {
    const fpsValues = data.map(d => d.fps).filter(v => v > 0);
    const latencyValues = data.map(d => d.latency).filter(v => v > 0);
    const memoryValues = data.map(d => d.memory).filter(v => v > 0);
    const frameTimeValues = data.map(d => d.frameTime).filter(v => v > 0);
    const varianceValues = data.map(d => d.frameTimeVariance).filter(v => v > 0);

    return {
      averageFPS: this.average(fpsValues),
      minFPS: Math.min(...fpsValues),
      maxFPS: Math.max(...fpsValues),
      fpsStandardDeviation: this.standardDeviation(fpsValues),

      averageLatency: this.average(latencyValues),
      minLatency: Math.min(...latencyValues),
      maxLatency: Math.max(...latencyValues),
      latencyStandardDeviation: this.standardDeviation(latencyValues),

      averageMemory: this.average(memoryValues),
      minMemory: Math.min(...memoryValues),
      maxMemory: Math.max(...memoryValues),
      memoryStandardDeviation: this.standardDeviation(memoryValues),

      averageFrameTime: this.average(frameTimeValues),
      maxFrameTime: Math.max(...frameTimeValues),
      frameTimeStandardDeviation: this.standardDeviation(frameTimeValues),

      averageVariance: this.average(varianceValues),
      maxVariance: Math.max(...varianceValues),
      varianceStandardDeviation: this.standardDeviation(varianceValues)
    };
  }

  /**
   * Validate baseline stability criteria
   */
  validateBaselineStability(stats) {
    // Check coefficient of variation for each metric
    const fpsCV = stats.fpsStandardDeviation / stats.averageFPS;
    const latencyCV = stats.latencyStandardDeviation / stats.averageLatency;
    const memoryCV = stats.memoryStandardDeviation / stats.averageMemory;

    // All metrics should have low variance (<10% coefficient of variation)
    return fpsCV < 0.1 && latencyCV < 0.1 && memoryCV < 0.1;
  }

  /**
   * Perform comprehensive regression analysis
   */
  performRegressionAnalysis() {
    if (!this.baselineEstablished || this.performanceData.length < 5) {
      return;
    }

    const recentData = this.performanceData.slice(-30); // Last 30 data points
    const currentStats = this.calculateBaselineStatistics(recentData);

    const regressions = this.detectRegressions(currentStats);

    // Process detected regressions
    regressions.forEach(regression => {
      this.processRegression(regression);
    });

    // Check for resolved regressions
    this.checkResolvedRegressions(currentStats);
  }

  /**
   * Detect performance regressions by comparing current stats to baseline
   */
  detectRegressions(currentStats) {
    const regressions = [];

    // FPS regression detection
    const fpsDegradation = ((this.baseline.averageFPS - currentStats.averageFPS) / this.baseline.averageFPS) * 100;
    if (fpsDegradation > this.thresholds.fpsRegression) {
      regressions.push({
        type: 'fps_regression',
        severity: fpsDegradation > 30 ? 'critical' : fpsDegradation > 20 ? 'warning' : 'minor',
        degradation: fpsDegradation,
        baseline: this.baseline.averageFPS,
        current: currentStats.averageFPS,
        impact: this.calculateImpact('fps', fpsDegradation)
      });
    }

    // Latency regression detection
    const latencyDegradation = ((currentStats.averageLatency - this.baseline.averageLatency) / this.baseline.averageLatency) * 100;
    if (latencyDegradation > this.thresholds.latencyRegression) {
      regressions.push({
        type: 'latency_regression',
        severity: latencyDegradation > 50 ? 'critical' : latencyDegradation > 35 ? 'warning' : 'minor',
        degradation: latencyDegradation,
        baseline: this.baseline.averageLatency,
        current: currentStats.averageLatency,
        impact: this.calculateImpact('latency', latencyDegradation)
      });
    }

    // Memory regression detection
    const memoryDegradation = ((currentStats.averageMemory - this.baseline.averageMemory) / this.baseline.averageMemory) * 100;
    if (memoryDegradation > this.thresholds.memoryRegression) {
      regressions.push({
        type: 'memory_regression',
        severity: memoryDegradation > 50 ? 'critical' : memoryDegradation > 40 ? 'warning' : 'minor',
        degradation: memoryDegradation,
        baseline: this.baseline.averageMemory,
        current: currentStats.averageMemory,
        impact: this.calculateImpact('memory', memoryDegradation)
      });
    }

    // Frame time regression detection
    const frameTimeDegradation = ((currentStats.averageFrameTime - this.baseline.averageFrameTime) / this.baseline.averageFrameTime) * 100;
    if (frameTimeDegradation > this.thresholds.frameTimeRegression) {
      regressions.push({
        type: 'frame_time_regression',
        severity: frameTimeDegradation > 40 ? 'critical' : frameTimeDegradation > 30 ? 'warning' : 'minor',
        degradation: frameTimeDegradation,
        baseline: this.baseline.averageFrameTime,
        current: currentStats.averageFrameTime,
        impact: this.calculateImpact('frameTime', frameTimeDegradation)
      });
    }

    // Consistency regression detection
    const consistencyDegradation = ((currentStats.averageVariance - this.baseline.averageVariance) / this.baseline.averageVariance) * 100;
    if (consistencyDegradation > this.thresholds.consistencyRegression) {
      regressions.push({
        type: 'consistency_regression',
        severity: consistencyDegradation > 100 ? 'critical' : consistencyDegradation > 75 ? 'warning' : 'minor',
        degradation: consistencyDegradation,
        baseline: this.baseline.averageVariance,
        current: currentStats.averageVariance,
        impact: this.calculateImpact('consistency', consistencyDegradation)
      });
    }

    return regressions;
  }

  /**
   * Calculate performance impact level
   */
  calculateImpact(type, degradation) {
    // Type-specific impact calculation
    switch (type) {
      case 'fps':
        return degradation > 40 ? 'severe' : degradation > 25 ? 'high' : degradation > 15 ? 'moderate' : 'low';
      case 'latency':
        return degradation > 60 ? 'severe' : degradation > 40 ? 'high' : degradation > 25 ? 'moderate' : 'low';
      case 'memory':
        return degradation > 80 ? 'severe' : degradation > 50 ? 'high' : degradation > 30 ? 'moderate' : 'low';
      case 'frameTime':
        return degradation > 50 ? 'severe' : degradation > 35 ? 'high' : degradation > 20 ? 'moderate' : 'low';
      case 'consistency':
        return degradation > 150 ? 'severe' : degradation > 100 ? 'high' : degradation > 50 ? 'moderate' : 'low';
      default:
        return 'unknown';
    }
  }

  /**
   * Process detected regression
   */
  processRegression(regression) {
    const regressionKey = regression.type;
    const now = Date.now();
    const existingRegression = this.activeRegressions.get(regressionKey);

    // Check if this is a new regression or suppressed
    if (!existingRegression || (now - existingRegression.lastDetected > this.suppressionPeriod)) {
      const regressionData = {
        ...regression,
        id: `reg_${now}_${regression.type}`,
        detectedAt: now,
        lastDetected: now,
        occurrences: existingRegression ? existingRegression.occurrences + 1 : 1,
        status: 'active'
      };

      this.activeRegressions.set(regressionKey, regressionData);
      this.regressionHistory.push(regressionData);

      // Keep regression history manageable
      if (this.regressionHistory.length > 100) {
        this.regressionHistory.shift();
      }

      this.triggerRegressionDetected(regressionData);

      console.warn(`[PERFORMANCE_REGRESSION] ${regression.type} detected:`, {
        severity: regression.severity,
        degradation: `${regression.degradation.toFixed(1)}%`,
        impact: regression.impact
      });
    } else {
      // Update existing regression
      existingRegression.lastDetected = now;
      existingRegression.occurrences++;
      existingRegression.severity = regression.severity; // Update severity if worse
    }
  }

  /**
   * Check for resolved regressions
   */
  checkResolvedRegressions(currentStats) {
    const now = Date.now();
    const resolvedRegressions = [];

    for (const [key, regression] of this.activeRegressions) {
      const isResolved = this.isRegressionResolved(regression, currentStats);

      if (isResolved) {
        regression.resolvedAt = now;
        regression.status = 'resolved';
        regression.duration = now - regression.detectedAt;

        resolvedRegressions.push(regression);
        this.activeRegressions.delete(key);

        this.triggerRegressionResolved(regression);

        console.log(`[PERFORMANCE_REGRESSION] ${regression.type} resolved after ${Math.round(regression.duration / 1000)}s`);
      }
    }
  }

  /**
   * Check if a regression has been resolved
   */
  isRegressionResolved(regression, currentStats) {
    const resolutionThreshold = 0.5; // 50% improvement needed for resolution

    switch (regression.type) {
      case 'fps_regression':
        const fpsImprovement = ((currentStats.averageFPS - regression.current) / (regression.baseline - regression.current)) * 100;
        return fpsImprovement > resolutionThreshold;

      case 'latency_regression':
        const latencyImprovement = ((regression.current - currentStats.averageLatency) / (regression.current - regression.baseline)) * 100;
        return latencyImprovement > resolutionThreshold;

      case 'memory_regression':
        const memoryImprovement = ((regression.current - currentStats.averageMemory) / (regression.current - regression.baseline)) * 100;
        return memoryImprovement > resolutionThreshold;

      case 'frame_time_regression':
        const frameTimeImprovement = ((regression.current - currentStats.averageFrameTime) / (regression.current - regression.baseline)) * 100;
        return frameTimeImprovement > resolutionThreshold;

      case 'consistency_regression':
        const consistencyImprovement = ((regression.current - currentStats.averageVariance) / (regression.current - regression.baseline)) * 100;
        return consistencyImprovement > resolutionThreshold;

      default:
        return false;
    }
  }

  /**
   * Get current regression status
   */
  getRegressionStatus() {
    return {
      baseline: this.baseline ? {
        established: this.baseline.establishedAt,
        fps: Math.round(this.baseline.averageFPS),
        latency: Math.round(this.baseline.averageLatency),
        memory: this.formatMemory(this.baseline.averageMemory)
      } : null,
      activeRegressions: Array.from(this.activeRegressions.values()).map(r => ({
        type: r.type,
        severity: r.severity,
        impact: r.impact,
        degradation: `${r.degradation.toFixed(1)}%`,
        detectedAt: r.detectedAt
      })),
      regressionCount: {
        active: this.activeRegressions.size,
        total: this.regressionHistory.length,
        critical: Array.from(this.activeRegressions.values()).filter(r => r.severity === 'critical').length
      },
      health: this.calculateOverallHealth()
    };
  }

  /**
   * Calculate overall performance health
   */
  calculateOverallHealth() {
    if (!this.baselineEstablished) return 'unknown';

    const activeRegressions = Array.from(this.activeRegressions.values());
    const criticalRegressions = activeRegressions.filter(r => r.severity === 'critical');
    const warningRegressions = activeRegressions.filter(r => r.severity === 'warning');

    if (criticalRegressions.length > 0) return 'critical';
    if (warningRegressions.length > 2) return 'warning';
    if (warningRegressions.length > 0) return 'degraded';
    if (activeRegressions.length > 0) return 'minor';
    return 'excellent';
  }

  /**
   * Manually invalidate baseline (for testing or after major changes)
   */
  invalidateBaseline(reason = 'manual') {
    if (!this.baselineEstablished) return false;

    const oldBaseline = this.baseline;
    this.baseline = null;
    this.baselineEstablished = false;

    this.triggerBaselineInvalidated({
      reason,
      previousBaseline: oldBaseline,
      invalidatedAt: Date.now()
    });

    console.log(`[PERFORMANCE_REGRESSION] Baseline invalidated: ${reason}`);
    return true;
  }

  /**
   * Statistical utilities
   */
  average(values) {
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  standardDeviation(values) {
    if (values.length < 2) return 0;
    const avg = this.average(values);
    const squaredDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquaredDiff = this.average(squaredDiffs);
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Format memory size for display
   */
  formatMemory(bytes) {
    const mb = bytes / 1024 / 1024;
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)}GB`;
    }
    return `${mb.toFixed(1)}MB`;
  }

  /**
   * Trigger regression detected callback
   */
  triggerRegressionDetected(regressionData) {
    const callback = this.callbacks.onRegressionDetected;
    if (typeof callback === 'function') {
      try {
        callback(regressionData);
      } catch (error) {
        console.error('[PERFORMANCE_REGRESSION] Error in regression detected callback:', error);
      }
    }
  }

  /**
   * Trigger regression resolved callback
   */
  triggerRegressionResolved(regressionData) {
    const callback = this.callbacks.onRegressionResolved;
    if (typeof callback === 'function') {
      try {
        callback(regressionData);
      } catch (error) {
        console.error('[PERFORMANCE_REGRESSION] Error in regression resolved callback:', error);
      }
    }
  }

  /**
   * Trigger baseline established callback
   */
  triggerBaselineEstablished(baselineData) {
    const callback = this.callbacks.onBaselineEstablished;
    if (typeof callback === 'function') {
      try {
        callback(baselineData);
      } catch (error) {
        console.error('[PERFORMANCE_REGRESSION] Error in baseline established callback:', error);
      }
    }
  }

  /**
   * Trigger baseline invalidated callback
   */
  triggerBaselineInvalidated(invalidationData) {
    const callback = this.callbacks.onBaselineInvalidated;
    if (typeof callback === 'function') {
      try {
        callback(invalidationData);
      } catch (error) {
        console.error('[PERFORMANCE_REGRESSION] Error in baseline invalidated callback:', error);
      }
    }
  }

  /**
   * Export regression detection data
   */
  exportData() {
    return {
      configuration: {
        analysisWindow: this.analysisWindow,
        baselineWindow: this.baselineWindow,
        detectionInterval: this.detectionInterval,
        thresholds: this.thresholds
      },
      current: {
        baseline: this.baseline,
        metrics: this.currentMetrics,
        status: this.getRegressionStatus()
      },
      history: {
        regressions: this.regressionHistory.slice(-50), // Last 50 regressions
        baselines: this.baselineHistory
      },
      performanceData: this.performanceData.slice(-100), // Last 100 data points
      exportTimestamp: Date.now()
    };
  }

  /**
   * Reset regression detection
   */
  reset() {
    this.stopDetection();

    this.performanceData = [];
    this.currentMetrics = null;
    this.baseline = null;
    this.baselineHistory = [];
    this.baselineEstablished = false;
    this.regressionHistory = [];
    this.activeRegressions.clear();

    console.log('[PERFORMANCE_REGRESSION] Regression detector reset');
  }
}

/**
 * Global regression detector instance
 */
export const globalRegressionDetector = new PerformanceRegressionDetector();

/**
 * Convenience function to start regression detection
 */
export function startRegressionDetection(options = {}) {
  const detector = new PerformanceRegressionDetector(options);
  detector.startDetection();
  return detector;
}