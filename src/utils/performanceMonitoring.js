/**
 * Performance Monitoring System
 *
 * Real-time performance monitoring for trading applications requiring 60fps rendering
 * and sub-100ms data-to-visual latency with 20+ concurrent displays.
 *
 * Design Philosophy: "Simple, Performant, Maintainable"
 * - Simple: Clear metrics collection with minimal overhead
 * - Performant: <1ms monitoring overhead, non-intrusive operation
 * - Maintainable: Extensible system with centralized metrics
 */

import {
  withErrorBoundary,
  withAsyncErrorBoundary,
  memorySafeErrorHandler,
  getContextualFallback,
  SAFE_DEFAULTS,
  CircuitBreaker
} from './errorBoundaryUtils.js';

/**
 * Real-time FPS monitoring and frame time consistency tracking
 */
export class FrameRateMonitor {
  constructor(options = {}) {
    try {
      this.windowSize = options.windowSize || 60; // Number of frames to average
      this.targetFPS = options.targetFPS || 60;
      this.frameHistory = [];
      this.lastFrameTime = 0;
      this.startTime = 0;
      this.frameCount = 0;
      this.enabled = true;
      this.circuitBreaker = new CircuitBreaker({ failureThreshold: 3, recoveryTime: 30000 });

      // Performance thresholds
      this.thresholds = {
        minFPS: options.minFPS || 55,       // Alert below 55fps
        maxFrameTime: options.maxFrameTime || 20, // Alert above 20ms frame time
        consistencyThreshold: options.consistencyThreshold || 3 // Alert on 3ms+ variance
      };

      // Callbacks for events
      this.callbacks = {
        onFPSAlert: options.onFPSAlert || null,
        onFrameTimeAlert: options.onFrameTimeAlert || null,
        onConsistencyAlert: options.onConsistencyAlert || null
      };

      // Wrap critical methods with error boundaries
      this.recordFrame = withErrorBoundary(
        this.recordFrame.bind(this),
        getContextualFallback('FrameRateMonitor'),
        'FrameRateMonitor.recordFrame'
      );

      this.getMetrics = withErrorBoundary(
        this.getMetrics.bind(this),
        () => SAFE_DEFAULTS.object,
        'FrameRateMonitor.getMetrics'
      );

    } catch (error) {
      memorySafeErrorHandler('FrameRateMonitor.constructor', error, { options });
      // Ensure we have a working instance even if constructor fails
      this.enabled = false;
      this.frameHistory = [];
      this.lastFrameTime = 0;
    }
  }

  /**
   * Initialize frame rate monitoring
   */
  initialize() {
    try {
      this.startTime = performance.now();
      this.lastFrameTime = this.startTime;
      this.frameCount = 0;
      this.frameHistory = [];

      console.log(`[FRAME_RATE_MONITOR] Initialized with ${this.windowSize}-frame window`);
    } catch (error) {
      memorySafeErrorHandler('FrameRateMonitor.initialize', error);
      this.enabled = false;
    }
  }

  /**
   * Record a new frame (call at start of each frame)
   */
  recordFrame() {
    if (!this.enabled) return;

    const now = performance.now();

    // Skip first frame to avoid initial spike
    if (this.lastFrameTime === 0) {
      this.lastFrameTime = now;
      return null;
    }

    const frameDelta = now - this.lastFrameTime;
    const currentFPS = 1000 / frameDelta;

    this.frameHistory.push({
      timestamp: now,
      frameDelta,
      fps: currentFPS,
      frameCount: ++this.frameCount
    });

    // Maintain window size
    if (this.frameHistory.length > this.windowSize) {
      this.frameHistory.shift();
    }

    this.lastFrameTime = now;

    // Check performance thresholds
    this.checkThresholds();

    return {
      frameDelta,
      fps: currentFPS,
      frameCount: this.frameCount
    };
  }

  /**
   * Get current performance metrics
   */
  getMetrics() {
    if (this.frameHistory.length === 0) {
      return {
        currentFPS: 0,
        averageFPS: 0,
        minFPS: 0,
        maxFPS: 0,
        frameTimeVariance: 0,
        frameCount: 0,
        duration: 0
      };
    }

    const recentFrames = this.frameHistory.slice(-this.windowSize);
    const frameTimes = recentFrames.map(f => f.frameDelta);
    const fpsValues = recentFrames.map(f => f.fps);

    const currentFPS = fpsValues[fpsValues.length - 1];
    const averageFPS = fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length;
    const minFPS = Math.min(...fpsValues);
    const maxFPS = Math.max(...fpsValues);

    // Calculate variance for consistency tracking
    const meanFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    const frameTimeVariance = Math.sqrt(
      frameTimes.reduce((sum, time) => sum + Math.pow(time - meanFrameTime, 2), 0) / frameTimes.length
    );

    const duration = performance.now() - this.startTime;

    return {
      currentFPS,
      averageFPS,
      minFPS,
      maxFPS,
      frameTimeVariance,
      frameCount: this.frameCount,
      duration,
      meetsTarget: averageFPS >= this.thresholds.minFPS && frameTimeVariance <= this.thresholds.consistencyThreshold
    };
  }

  /**
   * Check performance thresholds and trigger alerts
   */
  checkThresholds() {
    const metrics = this.getMetrics();

    // FPS threshold check
    if (metrics.currentFPS < this.thresholds.minFPS) {
      this.triggerAlert('onFPSAlert', {
        type: 'low_fps',
        currentFPS: metrics.currentFPS,
        threshold: this.thresholds.minFPS,
        severity: metrics.currentFPS < 30 ? 'critical' : 'warning'
      });
    }

    // Frame time threshold check
    const currentFrameTime = 1000 / metrics.currentFPS;
    if (currentFrameTime > this.thresholds.maxFrameTime) {
      this.triggerAlert('onFrameTimeAlert', {
        type: 'high_frame_time',
        frameTime: currentFrameTime,
        threshold: this.thresholds.maxFrameTime,
        severity: currentFrameTime > 33 ? 'critical' : 'warning' // >33ms = <30fps
      });
    }

    // Consistency threshold check
    if (metrics.frameTimeVariance > this.thresholds.consistencyThreshold) {
      this.triggerAlert('onConsistencyAlert', {
        type: 'frame_time_inconsistency',
        variance: metrics.frameTimeVariance,
        threshold: this.thresholds.consistencyThreshold,
        severity: metrics.frameTimeVariance > 10 ? 'critical' : 'warning'
      });
    }
  }

  /**
   * Trigger alert callback if registered
   */
  triggerAlert(callbackName, alertData) {
    const callback = this.callbacks[callbackName];
    if (typeof callback === 'function') {
      try {
        callback(alertData);
      } catch (error) {
        console.error(`[FRAME_RATE_MONITOR] Error in ${callbackName} callback:`, error);
      }
    }
  }

  /**
   * Enable/disable monitoring
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (enabled && this.frameHistory.length === 0) {
      this.initialize();
    }
  }

  /**
   * Reset monitoring state
   */
  reset() {
    this.frameHistory = [];
    this.lastFrameTime = 0;
    this.frameCount = 0;
    this.startTime = performance.now();
  }

  /**
   * Get detailed performance analysis
   */
  getDetailedAnalysis() {
    const metrics = this.getMetrics();

    if (this.frameHistory.length < 10) {
      return { ...metrics, analysis: 'insufficient_data' };
    }

    const recentFrames = this.frameHistory.slice(-30); // Last 30 frames
    const frameTimes = recentFrames.map(f => f.frameDelta);
    const fpsValues = recentFrames.map(f => f.fps);

    // Calculate percentiles
    const sortedFrameTimes = [...frameTimes].sort((a, b) => a - b);
    const p50 = sortedFrameTimes[Math.floor(sortedFrameTimes.length * 0.5)];
    const p95 = sortedFrameTimes[Math.floor(sortedFrameTimes.length * 0.95)];
    const p99 = sortedFrameTimes[Math.floor(sortedFrameTimes.length * 0.99)];

    // Frame drops detection (frames > 2x target frame time)
    const targetFrameTime = 1000 / this.targetFPS;
    const frameDrops = frameTimes.filter(time => time > targetFrameTime * 2).length;
    const frameDropRate = (frameDrops / frameTimes.length) * 100;

    return {
      ...metrics,
      percentiles: {
        p50: 1000 / p50, // Convert back to FPS
        p95: 1000 / p95,
        p99: 1000 / p99
      },
      frameDropAnalysis: {
        frameDrops,
        frameDropRate,
        totalFrames: frameTimes.length
      },
      analysis: this.analyzePerformance(metrics, frameDropRate)
    };
  }

  /**
   * Analyze overall performance health
   */
  analyzePerformance(metrics, frameDropRate) {
    const { averageFPS, frameTimeVariance } = metrics;

    if (averageFPS < 30 || frameDropRate > 10) {
      return 'poor';
    } else if (averageFPS < this.thresholds.minFPS || frameDropRate > 5 || frameTimeVariance > 8) {
      return 'degraded';
    } else if (frameDropRate > 2 || frameTimeVariance > 5) {
      return 'acceptable';
    } else {
      return 'excellent';
    }
  }

  /**
   * Export performance data for debugging
   */
  exportData() {
    return {
      configuration: {
        windowSize: this.windowSize,
        targetFPS: this.targetFPS,
        thresholds: this.thresholds
      },
      metrics: this.getMetrics(),
      detailedAnalysis: this.getDetailedAnalysis(),
      frameHistory: this.frameHistory.slice(-10), // Last 10 frames for debugging
      exportTimestamp: Date.now()
    };
  }
}

/**
 * Data-to-visual latency tracking system
 */
export class LatencyMonitor {
  constructor(options = {}) {
    try {
      this.historySize = options.historySize || 100;
      this.latencyHistory = [];
      this.circuitBreaker = new CircuitBreaker({ failureThreshold: 3, recoveryTime: 30000 });

      this.thresholds = {
        warning: options.warningThreshold || 100,   // 100ms warning
        critical: options.criticalThreshold || 200  // 200ms critical
      };
      this.callbacks = {
        onLatencyAlert: options.onLatencyAlert || null
      };

      // Wrap critical methods with error boundaries
      this.recordDisplayCompletion = withErrorBoundary(
        this.recordDisplayCompletion.bind(this),
        getContextualFallback('LatencyMonitor'),
        'LatencyMonitor.recordDisplayCompletion'
      );

      this.getLatencyStats = withErrorBoundary(
        this.getLatencyStats.bind(this),
        () => SAFE_DEFAULTS.object,
        'LatencyMonitor.getLatencyStats'
      );

    } catch (error) {
      memorySafeErrorHandler('LatencyMonitor.constructor', error, { options });
      // Ensure we have a working instance even if constructor fails
      this.latencyHistory = [];
      this.historySize = 100;
      this.thresholds = { warning: 100, critical: 200 };
      this.callbacks = { onLatencyAlert: null };
    }
  }

  /**
   * Record data receipt timestamp
   */
  recordDataReceipt(dataId = null) {
    return {
      dataId,
      receiptTime: performance.now()
    };
  }

  /**
   * Record visual display completion and calculate latency
   */
  recordDisplayCompletion(dataReceipt, displayContext = {}) {
    if (!dataReceipt) return null;

    const completionTime = performance.now();
    const latency = completionTime - dataReceipt.receiptTime;

    const latencyEntry = {
      dataId: dataReceipt.dataId,
      receiptTime: dataReceipt.receiptTime,
      completionTime,
      latency,
      context: displayContext,
      timestamp: completionTime
    };

    this.latencyHistory.push(latencyEntry);

    // Maintain history size
    if (this.latencyHistory.length > this.historySize) {
      this.latencyHistory.shift();
    }

    // Check latency thresholds
    this.checkLatencyThresholds(latencyEntry);

    return latencyEntry;
  }

  /**
   * Check latency against thresholds and trigger alerts
   */
  checkLatencyThresholds(latencyEntry) {
    const { latency } = latencyEntry;

    if (latency > this.thresholds.critical) {
      this.triggerLatencyAlert('critical', latencyEntry);
    } else if (latency > this.thresholds.warning) {
      this.triggerLatencyAlert('warning', latencyEntry);
    }
  }

  /**
   * Trigger latency alert
   */
  triggerLatencyAlert(severity, latencyEntry) {
    const callback = this.callbacks.onLatencyAlert;
    if (typeof callback === 'function') {
      try {
        callback({
          severity,
          latency: latencyEntry.latency,
          threshold: severity === 'critical' ? this.thresholds.critical : this.thresholds.warning,
          dataId: latencyEntry.dataId,
          context: latencyEntry.context
        });
      } catch (error) {
        console.error('[LATENCY_MONITOR] Error in latency alert callback:', error);
      }
    }
  }

  /**
   * Get latency statistics
   */
  getLatencyStats() {
    if (this.latencyHistory.length === 0) {
      return {
        currentLatency: 0,
        averageLatency: 0,
        minLatency: 0,
        maxLatency: 0,
        p95Latency: 0,
        sampleCount: 0
      };
    }

    const latencies = this.latencyHistory.map(entry => entry.latency);
    const currentLatency = latencies[latencies.length - 1];
    const averageLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const minLatency = Math.min(...latencies);
    const maxLatency = Math.max(...latencies);

    // Calculate 95th percentile
    const sortedLatencies = [...latencies].sort((a, b) => a - b);
    const p95Latency = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)];

    return {
      currentLatency,
      averageLatency,
      minLatency,
      maxLatency,
      p95Latency,
      sampleCount: this.latencyHistory.length,
      latencyBudgetUtilization: (averageLatency / this.thresholds.warning) * 100
    };
  }

  /**
   * Reset latency tracking
   */
  reset() {
    this.latencyHistory = [];
  }

  /**
   * Export latency data for analysis
   */
  exportData() {
    return {
      configuration: {
        historySize: this.historySize,
        thresholds: this.thresholds
      },
      stats: this.getLatencyStats(),
      recentEntries: this.latencyHistory.slice(-20), // Last 20 entries
      exportTimestamp: Date.now()
    };
  }
}

/**
 * Factory function to create configured monitors
 */
export function createPerformanceMonitors(options = {}) {
  try {
    const frameRateOptions = {
      windowSize: 60,
      targetFPS: 60,
      minFPS: 55,
      maxFrameTime: 20,
      consistencyThreshold: 3,
      ...options.frameRate
    };

    const latencyOptions = {
      historySize: 100,
      warningThreshold: 100,
      criticalThreshold: 200,
      ...options.latency
    };

    return {
      frameRateMonitor: new FrameRateMonitor(frameRateOptions),
      latencyMonitor: new LatencyMonitor(latencyOptions)
    };
  } catch (error) {
    memorySafeErrorHandler('createPerformanceMonitors', error, { options });

    // Fallback: Create safe default monitors
    try {
      return {
        frameRateMonitor: new FrameRateMonitor({
          windowSize: 60,
          targetFPS: 60,
          minFPS: 55,
          maxFrameTime: 20,
          consistencyThreshold: 3
        }),
        latencyMonitor: new LatencyMonitor({
          historySize: 100,
          warningThreshold: 100,
          criticalThreshold: 200
        })
      };
    } catch (fallbackError) {
      memorySafeErrorHandler('createPerformanceMonitors.fallback', fallbackError);

      // Last resort: Return disabled monitors
      return {
        frameRateMonitor: {
          enabled: false,
          recordFrame: () => null,
          getMetrics: () => SAFE_DEFAULTS.object
        },
        latencyMonitor: {
          recordDataReceipt: () => ({ dataId: null, receiptTime: performance.now() }),
          recordDisplayCompletion: () => null,
          getLatencyStats: () => SAFE_DEFAULTS.object
        }
      };
    }
  }
}