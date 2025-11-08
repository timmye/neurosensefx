/**
 * Performance Monitoring System
 *
 * Provides unified benchmarking and performance monitoring across all visualization components.
 * Ensures 60fps performance standard is maintained while providing detailed insights into
 * rendering performance and potential bottlenecks.
 *
 * Features:
 * - Frame rate monitoring with 60fps target
 * - Component-specific performance metrics
 * - Memory usage tracking
 * - Performance alerts and warnings
 * - Benchmark reporting and analysis
 */

/**
 * Performance metrics structure
 */
const PERFORMANCE_METRICS = {
  FRAME_RATE: 'frameRate',
  RENDER_TIME: 'renderTime',
  COMPONENT_COUNT: 'componentCount',
  MEMORY_USAGE: 'memoryUsage',
  BOUNDS_CHECKS: 'boundsChecks',
  ENHANCEMENT_COUNT: 'enhancementCount'
};

/**
 * Performance thresholds and targets
 */
export const PERFORMANCE_THRESHOLDS = {
  TARGET_FPS: 60,
  MIN_FPS: 30,
  MAX_RENDER_TIME: 16.67, // ms for 60fps
  WARNING_RENDER_TIME: 13.33, // ms for 75fps
  CRITICAL_RENDER_TIME: 33.33, // ms for 30fps
  MAX_MEMORY_MB: 500,
  WARNING_MEMORY_MB: 400,
  MAX_COMPONENTS: 20,
  BOUNDS_CHECK_TARGET: 0.1 // ms per bounds check
};

/**
 * Performance Monitor Class
 */
export class PerformanceMonitor {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.componentMetrics = new Map();
    this.globalMetrics = {
      totalFrames: 0,
      totalRenderTime: 0,
      frameRateHistory: [],
      memoryHistory: [],
      lastFrameTime: performance.now(),
      sessionStartTime: performance.now()
    };

    this.thresholds = { ...PERFORMANCE_THRESHOLDS, ...options.thresholds };
    this.alerts = [];
    this.benchmarkMode = options.benchmarkMode || false;
    this.maxHistorySize = options.maxHistorySize || 300; // 5 seconds at 60fps

    // Performance observer setup
    this.setupPerformanceObserver();
  }

  /**
   * Setup performance observer for memory monitoring
   */
  setupPerformanceObserver() {
    if ('memory' in performance) {
      this.memoryMonitor = setInterval(() => {
        if (this.enabled) {
          this.recordMemoryUsage();
        }
      }, 1000); // Check memory every second
    }
  }

  /**
   * Start monitoring a component render
   */
  startComponentRender(componentName) {
    if (!this.enabled) return null;

    const renderId = `${componentName}_${Date.now()}_${Math.random()}`;
    const startTime = performance.now();

    // Initialize component metrics if not exists
    if (!this.componentMetrics.has(componentName)) {
      this.componentMetrics.set(componentName, {
        renderCount: 0,
        totalRenderTime: 0,
        averageRenderTime: 0,
        maxRenderTime: 0,
        minRenderTime: Infinity,
        skippedRenders: 0,
        enhancementCount: 0,
        boundsCheckTime: 0,
        lastRenderTime: 0
      });
    }

    return {
      renderId,
      startTime,
      componentName
    };
  }

  /**
   * End component render and record metrics
   */
  endComponentRender(renderContext, enhancementCount = 0, boundsCheckTime = 0) {
    if (!this.enabled || !renderContext) return;

    const { renderId, startTime, componentName } = renderContext;
    const endTime = performance.now();
    const renderTime = endTime - startTime;

    const metrics = this.componentMetrics.get(componentName);
    if (metrics) {
      metrics.renderCount++;
      metrics.totalRenderTime += renderTime;
      metrics.averageRenderTime = metrics.totalRenderTime / metrics.renderCount;
      metrics.maxRenderTime = Math.max(metrics.maxRenderTime, renderTime);
      metrics.minRenderTime = Math.min(metrics.minRenderTime, renderTime);
      metrics.lastRenderTime = renderTime;
      metrics.enhancementCount += enhancementCount;
      metrics.boundsCheckTime += boundsCheckTime;

      // Check for performance warnings
      this.checkComponentPerformance(componentName, renderTime);
    }

    // Update global metrics
    this.updateGlobalMetrics(renderTime);
  }

  /**
   * Record a skipped render (bounds check optimization)
   */
  recordSkippedRender(componentName, reason = 'bounds_check') {
    if (!this.enabled) return;

    const metrics = this.componentMetrics.get(componentName);
    if (metrics) {
      metrics.skippedRenders++;
    }
  }

  /**
   * Update global performance metrics
   */
  updateGlobalMetrics(renderTime) {
    const now = performance.now();
    const frameDelta = now - this.globalMetrics.lastFrameTime;

    this.globalMetrics.totalFrames++;
    this.globalMetrics.totalRenderTime += renderTime;
    this.globalMetrics.lastFrameTime = now;

    // Calculate frame rate
    const currentFps = 1000 / frameDelta;
    this.globalMetrics.frameRateHistory.push({
      timestamp: now,
      fps: currentFps,
      renderTime
    });

    // Trim history if too large
    if (this.globalMetrics.frameRateHistory.length > this.maxHistorySize) {
      this.globalMetrics.frameRateHistory.shift();
    }

    // Check global performance
    this.checkGlobalPerformance(currentFps, renderTime);
  }

  /**
   * Record memory usage
   */
  recordMemoryUsage() {
    if ('memory' in performance) {
      const memoryInfo = performance.memory;
      const usedMemoryMB = memoryInfo.usedJSHeapSize / (1024 * 1024);
      const totalMemoryMB = memoryInfo.totalJSHeapSize / (1024 * 1024);

      this.globalMetrics.memoryHistory.push({
        timestamp: performance.now(),
        used: usedMemoryMB,
        total: totalMemoryMB
      });

      // Trim history
      if (this.globalMetrics.memoryHistory.length > 60) { // Keep 1 minute of history
        this.globalMetrics.memoryHistory.shift();
      }

      // Check memory thresholds
      if (usedMemoryMB > this.thresholds.MAX_MEMORY_MB) {
        this.addAlert('CRITICAL', 'MEMORY_HIGH', `Memory usage: ${usedMemoryMB.toFixed(1)}MB`);
      } else if (usedMemoryMB > this.thresholds.WARNING_MEMORY_MB) {
        this.addAlert('WARNING', 'MEMORY_WARNING', `Memory usage: ${usedMemoryMB.toFixed(1)}MB`);
      }
    }
  }

  /**
   * Check component-specific performance
   */
  checkComponentPerformance(componentName, renderTime) {
    if (renderTime > this.thresholds.CRITICAL_RENDER_TIME) {
      this.addAlert('CRITICAL', 'COMPONENT_SLOW',
        `${componentName} render time: ${renderTime.toFixed(2)}ms`);
    } else if (renderTime > this.thresholds.WARNING_RENDER_TIME) {
      this.addAlert('WARNING', 'COMPONENT_WARNING',
        `${componentName} render time: ${renderTime.toFixed(2)}ms`);
    }
  }

  /**
   * Check global performance
   */
  checkGlobalPerformance(currentFps, renderTime) {
    if (currentFps < this.thresholds.MIN_FPS) {
      this.addAlert('CRITICAL', 'FPS_LOW', `Frame rate: ${currentFps.toFixed(1)}fps`);
    } else if (currentFps < this.thresholds.TARGET_FPS) {
      this.addAlert('WARNING', 'FPS_WARNING', `Frame rate: ${currentFps.toFixed(1)}fps`);
    }

    if (renderTime > this.thresholds.CRITICAL_RENDER_TIME) {
      this.addAlert('CRITICAL', 'RENDER_SLOW', `Frame render time: ${renderTime.toFixed(2)}ms`);
    }
  }

  /**
   * Add performance alert
   */
  addAlert(severity, type, message) {
    const alert = {
      timestamp: performance.now(),
      severity,
      type,
      message,
      id: Date.now() + Math.random()
    };

    this.alerts.push(alert);

    // Keep only recent alerts (last 100)
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }

    // Log to console
    const logMethod = severity === 'CRITICAL' ? console.error :
                     severity === 'WARNING' ? console.warn : console.log;
    logMethod(`[PerformanceMonitor] ${severity}: ${message}`);
  }

  /**
   * Get current performance metrics
   */
  getMetrics() {
    const currentFrameRate = this.getCurrentFrameRate();
    const averageRenderTime = this.globalMetrics.totalRenderTime / this.globalMetrics.totalFrames;
    const sessionDuration = performance.now() - this.globalMetrics.sessionStartTime;

    return {
      global: {
        frameRate: currentFrameRate,
        averageRenderTime,
        totalFrames: this.globalMetrics.totalFrames,
        sessionDuration,
        memoryUsage: this.getCurrentMemoryUsage()
      },
      components: this.getComponentMetrics(),
      alerts: this.getRecentAlerts(),
      summary: this.getPerformanceSummary()
    };
  }

  /**
   * Get current frame rate
   */
  getCurrentFrameRate() {
    const recentFrames = this.globalMetrics.frameRateHistory.slice(-10);
    if (recentFrames.length === 0) return 0;

    const averageFps = recentFrames.reduce((sum, frame) => sum + frame.fps, 0) / recentFrames.length;
    return averageFps;
  }

  /**
   * Get current memory usage
   */
  getCurrentMemoryUsage() {
    if (!('memory' in performance)) return null;

    const memoryInfo = performance.memory;
    return {
      used: memoryInfo.usedJSHeapSize / (1024 * 1024),
      total: memoryInfo.totalJSHeapSize / (1024 * 1024),
      limit: memoryInfo.jsHeapSizeLimit / (1024 * 1024)
    };
  }

  /**
   * Get component-specific metrics
   */
  getComponentMetrics() {
    const componentData = {};

    for (const [componentName, metrics] of this.componentMetrics.entries()) {
      componentData[componentName] = {
        ...metrics,
        renderEfficiency: this.calculateRenderEfficiency(metrics),
        skipRate: this.calculateSkipRate(metrics)
      };
    }

    return componentData;
  }

  /**
   * Calculate render efficiency (percentage of frames under target time)
   */
  calculateRenderEfficiency(metrics) {
    if (metrics.renderCount === 0) return 100;

    // This is a simplified calculation - in practice you'd track actual frame times
    const efficiency = Math.max(0, Math.min(100,
      (this.thresholds.TARGET_FPS / (this.thresholds.TARGET_FPS + metrics.averageRenderTime)) * 100
    ));

    return efficiency;
  }

  /**
   * Calculate skip rate (percentage of renders skipped due to bounds checking)
   */
  calculateSkipRate(metrics) {
    if (metrics.renderCount === 0) return 0;

    return (metrics.skippedRenders / (metrics.renderCount + metrics.skippedRenders)) * 100;
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit = 10) {
    return this.alerts.slice(-limit);
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary() {
    const currentFps = this.getCurrentFrameRate();
    const memoryUsage = this.getCurrentMemoryUsage();
    const recentAlerts = this.getRecentAlerts(5);

    const status = currentFps >= this.thresholds.TARGET_FPS ? 'EXCELLENT' :
                  currentFps >= this.thresholds.MIN_FPS ? 'GOOD' : 'POOR';

    return {
      status,
      frameRate: currentFps,
      targetFrameRate: this.thresholds.TARGET_FPS,
      memoryStatus: memoryUsage ?
        (memoryUsage.used > this.thresholds.WARNING_MEMORY_MB ? 'WARNING' : 'NORMAL') : 'UNKNOWN',
      recentAlerts: recentAlerts.length,
      totalComponents: this.componentMetrics.size
    };
  }

  /**
   * Generate performance report
   */
  generateReport() {
    const metrics = this.getMetrics();
    const report = {
      timestamp: new Date().toISOString(),
      summary: metrics.summary,
      globalMetrics: metrics.global,
      componentMetrics: metrics.components,
      alerts: metrics.alerts,
      recommendations: this.generateRecommendations(metrics)
    };

    return report;
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations(metrics) {
    const recommendations = [];

    // Frame rate recommendations
    if (metrics.global.frameRate < this.thresholds.TARGET_FPS) {
      recommendations.push({
        type: 'PERFORMANCE',
        priority: 'HIGH',
        message: 'Frame rate below target. Consider reducing component complexity or number of active components.'
      });
    }

    // Memory recommendations
    if (metrics.global.memoryUsage && metrics.global.memoryUsage.used > this.thresholds.WARNING_MEMORY_MB) {
      recommendations.push({
        type: 'MEMORY',
        priority: 'MEDIUM',
        message: 'Memory usage is high. Consider implementing object pooling or reducing cached data.'
      });
    }

    // Component-specific recommendations
    for (const [componentName, componentMetrics] of Object.entries(metrics.components)) {
      if (componentMetrics.averageRenderTime > this.thresholds.WARNING_RENDER_TIME) {
        recommendations.push({
          type: 'COMPONENT',
          priority: 'MEDIUM',
          message: `${componentName} has high render time. Consider optimizing rendering logic.`,
          component: componentName
        });
      }

      if (componentMetrics.skipRate < 10) {
        recommendations.push({
          type: 'OPTIMIZATION',
          priority: 'LOW',
          message: `${componentName} has low optimization rate. Consider implementing more bounds checking.`,
          component: componentName
        });
      }
    }

    return recommendations;
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.componentMetrics.clear();
    this.globalMetrics = {
      totalFrames: 0,
      totalRenderTime: 0,
      frameRateHistory: [],
      memoryHistory: [],
      lastFrameTime: performance.now(),
      sessionStartTime: performance.now()
    };
    this.alerts = [];
  }

  /**
   * Start benchmark mode
   */
  startBenchmark() {
    this.benchmarkMode = true;
    this.reset();
    console.log('[PerformanceMonitor] Benchmark mode started');
  }

  /**
   * End benchmark mode and return results
   */
  endBenchmark() {
    this.benchmarkMode = false;
    const report = this.generateReport();
    console.log('[PerformanceMonitor] Benchmark completed');
    return report;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.memoryMonitor) {
      clearInterval(this.memoryMonitor);
    }
    this.reset();
  }
}

/**
 * Global performance monitor instance
 */
let globalMonitor = null;

/**
 * Get or create global performance monitor
 */
export function getPerformanceMonitor(options = {}) {
  if (!globalMonitor) {
    globalMonitor = new PerformanceMonitor(options);
  }
  return globalMonitor;
}

/**
 * Performance monitoring decorator for component functions
 */
export function monitorPerformance(componentName, monitor = null) {
  const perfMonitor = monitor || getPerformanceMonitor();

  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function(...args) {
      const renderContext = perfMonitor.startComponentRender(componentName);

      try {
        const result = originalMethod.apply(this, args);

        // Handle async functions
        if (result && typeof result.then === 'function') {
          return result.then(
            (resolvedResult) => {
              perfMonitor.endComponentRender(renderContext);
              return resolvedResult;
            },
            (error) => {
              perfMonitor.endComponentRender(renderContext);
              throw error;
            }
          );
        } else {
          perfMonitor.endComponentRender(renderContext);
          return result;
        }
      } catch (error) {
        perfMonitor.endComponentRender(renderContext);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Utility functions for performance monitoring
 */
export const PerformanceUtils = {
  /**
   * Measure function execution time
   */
  measureTime(fn, label = 'Function') {
    const start = performance.now();
    const result = fn();
    const end = performance.now();

    if (result && typeof result.then === 'function') {
      return result.then(resolvedResult => {
        console.log(`[Performance] ${label}: ${(performance.now() - start).toFixed(2)}ms (async)`);
        return resolvedResult;
      });
    } else {
      console.log(`[Performance] ${label}: ${(end - start).toFixed(2)}ms`);
      return result;
    }
  },

  /**
   * Create performance marker
   */
  mark(name) {
    if ('performance' in window && 'mark' in performance) {
      performance.mark(name);
    }
  },

  /**
   * Measure time between two marks
   */
  measure(name, startMark, endMark) {
    if ('performance' in window && 'measure' in performance) {
      performance.measure(name, startMark, endMark);
      const entries = performance.getEntriesByName(name, 'measure');
      if (entries.length > 0) {
        return entries[entries.length - 1].duration;
      }
    }
    return 0;
  }
};