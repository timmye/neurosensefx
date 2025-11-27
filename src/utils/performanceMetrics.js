/**
 * Performance Metrics Collection System
 *
 * Centralized performance metrics collection for real-time monitoring of trading
 * application performance with 20+ concurrent displays.
 *
 * Design Philosophy: "Simple, Performant, Maintainable"
 * - Simple: Unified metrics interface with clear data flow
 * - Performant: <0.5ms collection overhead, efficient data structures
 * - Maintainable: Modular design with standardized metrics format
 */

import { FrameRateMonitor, LatencyMonitor, createPerformanceMonitors } from './performanceMonitoring.js';
import { globalMemoryTracker } from './memoryManagementUtils.js';

/**
 * Comprehensive performance metrics collector
 */
export class PerformanceMetricsCollector {
  constructor(options = {}) {
    this.collectionInterval = options.collectionInterval || 1000; // 1 second
    this.maxHistorySize = options.maxHistorySize || 300; // 5 minutes at 1s intervals
    this.enabled = true;
    this.collecting = false;
    this.collectionTimer = null;

    // Initialize sub-monitors
    this.monitors = createPerformanceMonitors(options);

    // Metrics storage
    this.metricsHistory = [];
    this.realTimeMetrics = null;
    this.baselineMetrics = null;
    this.sessionStartTime = Date.now();

    // Performance budgets and thresholds
    this.performanceBudgets = {
      targetFPS: 60,
      minFPS: 55,
      maxFrameTime: 16.67, // 60fps = 16.67ms per frame
      maxLatency: 100,
      memoryLimit: 0.8, // 80% of heap limit
      maxMemoryGrowth: 50 // 50MB growth warning
    };

    // Callbacks for performance events
    this.callbacks = {
      onPerformanceAlert: options.onPerformanceAlert || null,
      onBudgetViolation: options.onBudgetViolation || null,
      onPerformanceDegradation: options.onPerformanceDegradation || null
    };

    // Multi-display tracking
    this.displayMetrics = new Map(); // Track per-display performance

    console.log('[PERFORMANCE_METRICS] Collector initialized');
  }

  /**
   * Start performance metrics collection
   */
  startCollection() {
    if (this.collecting || !this.enabled) {
      console.warn('[PERFORMANCE_METRICS] Collection already active or disabled');
      return;
    }

    this.collecting = true;
    this.sessionStartTime = Date.now();

    // Initialize monitors
    this.monitors.frameRateMonitor.initialize();
    this.monitors.latencyMonitor.reset();

    // Start periodic collection
    this.collectionTimer = setInterval(() => {
      this.collectMetrics();
    }, this.collectionInterval);

    console.log('[PERFORMANCE_METRICS] Metrics collection started');
  }

  /**
   * Stop performance metrics collection
   */
  stopCollection() {
    if (!this.collecting) {
      console.warn('[PERFORMANCE_METRICS] Collection not active');
      return;
    }

    this.collecting = false;

    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = null;
    }

    console.log('[PERFORMANCE_METRICS] Metrics collection stopped');
  }

  /**
   * Collect comprehensive performance metrics
   */
  collectMetrics() {
    if (!this.collecting) return;

    const collectionStart = performance.now();

    // Collect metrics from all monitors
    const frameRateMetrics = this.monitors.frameRateMonitor.getMetrics();
    const latencyStats = this.monitors.latencyMonitor.getLatencyStats();
    const memoryStats = globalMemoryTracker.getStats();

    // Calculate system-wide metrics
    const systemMetrics = this.calculateSystemMetrics();

    // Create unified metrics object
    const currentMetrics = {
      timestamp: Date.now(),
      sessionDuration: Date.now() - this.sessionStartTime,
      frameRate: frameRateMetrics,
      latency: latencyStats,
      memory: memoryStats,
      system: systemMetrics,
      displayCount: this.displayMetrics.size,
      collectionOverhead: performance.now() - collectionStart
    };

    // Store real-time metrics
    this.realTimeMetrics = currentMetrics;

    // Add to history
    this.metricsHistory.push(currentMetrics);

    // Maintain history size
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }

    // Establish baseline if not set
    if (!this.baselineMetrics && this.metricsHistory.length >= 5) {
      this.establishBaseline();
    }

    // Check performance budgets and trends
    this.checkPerformanceBudgets(currentMetrics);
    this.detectPerformanceDegradation(currentMetrics);

    return currentMetrics;
  }

  /**
   * Calculate system-wide performance metrics
   */
  calculateSystemMetrics() {
    if (!performance.memory) {
      return {
        available: false
      };
    }

    const memory = performance.memory;
    const totalMemory = memory.jsHeapSizeLimit;
    const usedMemory = memory.usedJSHeapSize;
    const totalJSHeapSize = memory.totalJSHeapSize;

    return {
      memoryUtilization: usedMemory / totalMemory,
      heapUtilization: usedMemory / totalJSHeapSize,
      availableMemory: totalMemory - usedMemory,
      memoryPressure: this.calculateMemoryPressure(),
      timestamp: Date.now()
    };
  }

  /**
   * Calculate memory pressure indicator (0-1 scale)
   */
  calculateMemoryPressure() {
    if (!performance.memory) return 0;

    const usedMemory = performance.memory.usedJSHeapSize;
    const memoryLimit = performance.memory.jsHeapSizeLimit;

    // Non-linear pressure calculation (exponential growth near limit)
    const ratio = usedMemory / memoryLimit;
    return Math.pow(ratio, 2); // Squared to emphasize high usage
  }

  /**
   * Establish performance baseline
   */
  establishBaseline() {
    const recentMetrics = this.metricsHistory.slice(-10);

    const baselineFPS = recentMetrics.reduce((sum, m) => sum + m.frameRate.averageFPS, 0) / recentMetrics.length;
    const baselineLatency = recentMetrics.reduce((sum, m) => sum + m.latency.averageLatency, 0) / recentMetrics.length;
    const baselineMemory = recentMetrics.reduce((sum, m) => sum + (m.memory?.current?.used || 0), 0) / recentMetrics.length;

    this.baselineMetrics = {
      fps: baselineFPS,
      latency: baselineLatency,
      memory: baselineMemory,
      displayCount: recentMetrics[recentMetrics.length - 1].displayCount,
      establishedAt: Date.now()
    };

    console.log('[PERFORMANCE_METRICS] Performance baseline established:', this.baselineMetrics);
  }

  /**
   * Check performance budgets and trigger alerts
   */
  checkPerformanceBudgets(metrics) {
    const violations = [];

    // Frame rate budget check
    if (metrics.frameRate.currentFPS < this.performanceBudgets.minFPS) {
      violations.push({
        type: 'fps_budget',
        current: metrics.frameRate.currentFPS,
        budget: this.performanceBudgets.minFPS,
        severity: metrics.frameRate.currentFPS < 30 ? 'critical' : 'warning'
      });
    }

    // Latency budget check
    if (metrics.latency.currentLatency > this.performanceBudgets.maxLatency) {
      violations.push({
        type: 'latency_budget',
        current: metrics.latency.currentLatency,
        budget: this.performanceBudgets.maxLatency,
        severity: metrics.latency.currentLatency > 200 ? 'critical' : 'warning'
      });
    }

    // Memory budget check
    if (metrics.system?.memoryUtilization > this.performanceBudgets.memoryLimit) {
      violations.push({
        type: 'memory_budget',
        current: metrics.system.memoryUtilization,
        budget: this.performanceBudgets.memoryLimit,
        severity: metrics.system.memoryUtilization > 0.95 ? 'critical' : 'warning'
      });
    }

    // Trigger callbacks for violations
    violations.forEach(violation => {
      this.triggerBudgetViolation(violation);
    });
  }

  /**
   * Detect performance degradation relative to baseline
   */
  detectPerformanceDegradation(metrics) {
    if (!this.baselineMetrics) return;

    const degradationEvents = [];

    // FPS degradation detection (>15% drop)
    if (metrics.frameRate.averageFPS < this.baselineMetrics.fps * 0.85) {
      degradationEvents.push({
        type: 'fps_degradation',
        current: metrics.frameRate.averageFPS,
        baseline: this.baselineMetrics.fps,
        degradation: (1 - metrics.frameRate.averageFPS / this.baselineMetrics.fps) * 100
      });
    }

    // Latency degradation detection (>50% increase)
    if (metrics.latency.averageLatency > this.baselineMetrics.latency * 1.5) {
      degradationEvents.push({
        type: 'latency_degradation',
        current: metrics.latency.averageLatency,
        baseline: this.baselineMetrics.latency,
        degradation: ((metrics.latency.averageLatency / this.baselineMetrics.latency) - 1) * 100
      });
    }

    // Memory growth detection (>50MB from baseline)
    const currentMemory = metrics.memory?.current?.used || 0;
    const memoryGrowth = (currentMemory - this.baselineMetrics.memory) / 1024 / 1024;
    if (memoryGrowth > this.performanceBudgets.maxMemoryGrowth) {
      degradationEvents.push({
        type: 'memory_growth',
        current: currentMemory,
        baseline: this.baselineMetrics.memory,
        growthMB: memoryGrowth
      });
    }

    // Trigger degradation alerts
    degradationEvents.forEach(event => {
      this.triggerPerformanceDegradation(event);
    });
  }

  /**
   * Register display for multi-display tracking
   */
  registerDisplay(displayId, displayConfig = {}) {
    this.displayMetrics.set(displayId, {
      id: displayId,
      config: displayConfig,
      registeredAt: Date.now(),
      metrics: {
        frameCount: 0,
        totalRenderTime: 0,
        lastRenderTime: 0
      }
    });
  }

  /**
   * Unregister display and cleanup tracking
   */
  unregisterDisplay(displayId) {
    const displayData = this.displayMetrics.get(displayId);
    if (displayData) {
      displayData.unregisteredAt = Date.now();
      console.log(`[PERFORMANCE_METRICS] Display ${displayId} unregistered`);
    }
    this.displayMetrics.delete(displayId);
  }

  /**
   * Record display-specific performance metrics
   */
  recordDisplayMetrics(displayId, renderTime, frameData = {}) {
    const displayData = this.displayMetrics.get(displayId);
    if (!displayData) return;

    displayData.metrics.frameCount++;
    displayData.metrics.totalRenderTime += renderTime;
    displayData.metrics.lastRenderTime = renderTime;
    displayData.metrics.lastUpdate = Date.now();

    // Calculate display-specific metrics
    const averageRenderTime = displayData.metrics.totalRenderTime / displayData.metrics.frameCount;

    // Check display performance
    if (renderTime > this.performanceBudgets.maxFrameTime * 2) {
      this.triggerPerformanceAlert({
        type: 'slow_display_render',
        displayId,
        renderTime,
        averageRenderTime,
        severity: renderTime > 50 ? 'critical' : 'warning'
      });
    }
  }

  /**
   * Get real-time metrics
   */
  getRealTimeMetrics() {
    return this.realTimeMetrics;
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary() {
    if (!this.realTimeMetrics) {
      return { status: 'no_data' };
    }

    const { frameRate, latency, memory, system } = this.realTimeMetrics;

    return {
      status: this.calculateOverallStatus(),
      frameRate: {
        current: Math.round(frameRate.currentFPS),
        average: Math.round(frameRate.averageFPS),
        target: '60fps'
      },
      latency: {
        current: Math.round(latency.currentLatency),
        average: Math.round(latency.averageLatency),
        p95: Math.round(latency.p95Latency),
        target: '<100ms'
      },
      memory: {
        used: memory?.current ? this.formatMemory(memory.current.used) : 'N/A',
        pressure: system?.memoryPressure ? Math.round(system.memoryPressure * 100) + '%' : 'N/A'
      },
      displays: {
        count: this.displayMetrics.size,
        active: Array.from(this.displayMetrics.values()).filter(d => !d.unregisteredAt).length
      }
    };
  }

  /**
   * Calculate overall performance status
   */
  calculateOverallStatus() {
    if (!this.realTimeMetrics) return 'unknown';

    const { frameRate, latency, system } = this.realTimeMetrics;

    // Critical conditions
    if (frameRate.currentFPS < 30 || latency.currentLatency > 200 || (system?.memoryPressure > 0.95)) {
      return 'critical';
    }

    // Warning conditions
    if (frameRate.currentFPS < this.performanceBudgets.minFPS ||
        latency.currentLatency > this.performanceBudgets.maxLatency ||
        (system?.memoryPressure > 0.8)) {
      return 'warning';
    }

    // Degraded conditions
    if (frameRate.currentFPS < 55 || latency.currentLatency > 80 || (system?.memoryPressure > 0.6)) {
      return 'degraded';
    }

    return 'excellent';
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
   * Trigger performance alert callback
   */
  triggerPerformanceAlert(alertData) {
    const callback = this.callbacks.onPerformanceAlert;
    if (typeof callback === 'function') {
      try {
        callback(alertData);
      } catch (error) {
        console.error('[PERFORMANCE_METRICS] Error in performance alert callback:', error);
      }
    }
  }

  /**
   * Trigger budget violation callback
   */
  triggerBudgetViolation(violationData) {
    const callback = this.callbacks.onBudgetViolation;
    if (typeof callback === 'function') {
      try {
        callback(violationData);
      } catch (error) {
        console.error('[PERFORMANCE_METRICS] Error in budget violation callback:', error);
      }
    }
  }

  /**
   * Trigger performance degradation callback
   */
  triggerPerformanceDegradation(degradationData) {
    const callback = this.callbacks.onPerformanceDegradation;
    if (typeof callback === 'function') {
      try {
        callback(degradationData);
      } catch (error) {
        console.error('[PERFORMANCE_METRICS] Error in performance degradation callback:', error);
      }
    }
  }

  /**
   * Enable/disable metrics collection
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (enabled && !this.collecting) {
      this.startCollection();
    } else if (!enabled && this.collecting) {
      this.stopCollection();
    }
  }

  /**
   * Export comprehensive performance data
   */
  exportData() {
    return {
      configuration: {
        collectionInterval: this.collectionInterval,
        maxHistorySize: this.maxHistorySize,
        performanceBudgets: this.performanceBudgets
      },
      session: {
        startTime: this.sessionStartTime,
        duration: Date.now() - this.sessionStartTime,
        baselineMetrics: this.baselineMetrics
      },
      current: this.realTimeMetrics,
      summary: this.getPerformanceSummary(),
      history: this.metricsHistory.slice(-60), // Last 60 entries
      displays: Array.from(this.displayMetrics.values()),
      monitors: {
        frameRate: this.monitors.frameRateMonitor.exportData(),
        latency: this.monitors.latencyMonitor.exportData()
      },
      exportTimestamp: Date.now()
    };
  }

  /**
   * Reset all metrics and start fresh
   */
  reset() {
    this.stopCollection();

    this.metricsHistory = [];
    this.realTimeMetrics = null;
    this.baselineMetrics = null;
    this.sessionStartTime = Date.now();

    // Reset monitors
    this.monitors.frameRateMonitor.reset();
    this.monitors.latencyMonitor.reset();

    // Clear display metrics
    this.displayMetrics.clear();

    console.log('[PERFORMANCE_METRICS] All metrics reset');
  }
}

/**
 * Global performance metrics instance
 */
export const globalPerformanceMetrics = new PerformanceMetricsCollector();

/**
 * Convenience function to start monitoring with default settings
 */
export function startPerformanceMonitoring(options = {}) {
  const collector = new PerformanceMetricsCollector(options);
  collector.startCollection();
  return collector;
}