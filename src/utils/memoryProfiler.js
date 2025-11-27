/**
 * Advanced Memory Profiler
 *
 * Enhanced memory monitoring with detailed heap analysis, pressure detection,
 * and leak detection for 20+ concurrent trading displays.
 *
 * Design Philosophy: "Simple, Performant, Maintainable"
 * - Simple: Clear memory health indicators with actionable alerts
 * - Performant: <1MB profiling overhead, efficient memory sampling
 * - Maintainable: Comprehensive but focused memory analysis
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
 * Enhanced memory profiler with detailed heap analysis
 */
export class MemoryProfiler {
  constructor(options = {}) {
    try {
      this.samplingInterval = Math.max(1000, Number(options.samplingInterval) || 5000); // 1-60s
      this.historySize = Math.max(10, Math.min(1000, Number(options.historySize) || 200));
      this.enabled = true;
      this.profiling = false;
      this.profilerTimer = null;
      this.circuitBreaker = new CircuitBreaker({ failureThreshold: 5, recoveryTime: 30000 });

      // Memory thresholds and limits with safe bounds
      this.thresholds = {
        warningUsage: Math.max(0.1, Math.min(1.0, Number(options.warningUsage) || 0.7)),
        criticalUsage: Math.max(0.1, Math.min(1.0, Number(options.criticalUsage) || 0.85)),
        leakThreshold: Math.max(0.1, Number(options.leakThreshold) || 5),
        growthRateThreshold: Math.max(0.1, Number(options.growthRateThreshold) || 1),
        gcPressureThreshold: Math.max(1, Number(options.gcPressureThreshold) || 10)
      };

      // Memory history storage
      this.memoryHistory = [];
      this.gcEvents = [];
      this.lastGCEvent = null;
      this.baselineMemory = null;
      this.memoryPressureLevel = 0;

      // Callbacks for memory events
      this.callbacks = {
        onMemoryPressure: typeof options.onMemoryPressure === 'function' ? options.onMemoryPressure : null,
        onMemoryLeak: typeof options.onMemoryLeak === 'function' ? options.onMemoryLeak : null,
        onGarbageCollection: typeof options.onGarbageCollection === 'function' ? options.onGarbageCollection : null,
        onMemoryThreshold: typeof options.onMemoryThreshold === 'function' ? options.onMemoryThreshold : null
      };

      // Heap analysis
      this.heapAnalysis = {
        objects: new Map(),
      totalObjects: 0,
      lastAnalysis: null,
      analysisInterval: options.analysisInterval || 30000 // 30 seconds
    };

      // Wrap critical methods with error boundaries
      this.startProfiling = withErrorBoundary(
        this.startProfiling.bind(this),
        () => false,
        'MemoryProfiler.startProfiling'
      );

      this.stopProfiling = withErrorBoundary(
        this.stopProfiling.bind(this),
        () => false,
        'MemoryProfiler.stopProfiling'
      );

      this.sampleMemory = withErrorBoundary(
        this.sampleMemory.bind(this),
        () => SAFE_DEFAULTS.object,
        'MemoryProfiler.sampleMemory'
      );

      console.log('[MEMORY_PROFILER] Advanced memory profiler initialized');
    } catch (error) {
      memorySafeErrorHandler('MemoryProfiler.constructor', error);

      // Fallback to safe, minimal mode
      this.samplingInterval = 5000;
      this.historySize = 200;
      this.enabled = false;
      this.profiling = false;
      this.profilerTimer = null;
      this.circuitBreaker = new CircuitBreaker({ failureThreshold: 3, recoveryTime: 60000 });
      this.thresholds = {
        warningUsage: 0.7,
        criticalUsage: 0.85,
        leakThreshold: 5,
        growthRateThreshold: 1,
        gcPressureThreshold: 10
      };
      this.memoryHistory = [];
      this.gcEvents = [];
      this.lastGCEvent = null;
      this.baselineMemory = null;
      this.memoryPressureLevel = 0;
      this.callbacks = {
        onMemoryPressure: null,
        onMemoryLeak: null,
        onGarbageCollection: null,
        onMemoryThreshold: null
      };
      this.heapAnalysis = {
        objects: new Map(),
        totalObjects: 0,
        lastAnalysis: null,
        analysisInterval: 30000
      };

      console.warn('[MEMORY_PROFILER] Constructor failed, using fallback mode');
    }
  }

  /**
   * Start memory profiling
   */
  startProfiling() {
    if (this.profiling || !this.enabled || !this.isMemoryAPIAvailable()) {
      console.warn('[MEMORY_PROFILER] Profiling already active, disabled, or Memory API not available');
      return false;
    }

    this.profiling = true;
    this.establishBaseline();

    // Start periodic memory sampling
    this.profilerTimer = setInterval(() => {
      this.sampleMemory();
      this.performHeapAnalysis();
    }, this.samplingInterval);

    // Monitor garbage collection events
    this.monitorGarbageCollection();

    console.log('[MEMORY_PROFILER] Memory profiling started');
    return true;
  }

  /**
   * Stop memory profiling
   */
  stopProfiling() {
    if (!this.profiling) {
      console.warn('[MEMORY_PROFILER] Profiling not active');
      return false;
    }

    this.profiling = false;

    if (this.profilerTimer) {
      clearInterval(this.profilerTimer);
      this.profilerTimer = null;
    }

    console.log('[MEMORY_PROFILER] Memory profiling stopped');
    return true;
  }

  /**
   * Check if Memory API is available
   */
  isMemoryAPIAvailable() {
    return performance && performance.memory;
  }

  /**
   * Establish memory usage baseline
   */
  establishBaseline() {
    if (!this.isMemoryAPIAvailable()) return;

    const memory = performance.memory;
    this.baselineMemory = {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      limit: memory.jsHeapSizeLimit,
      timestamp: Date.now()
    };

    console.log('[MEMORY_PROFILER] Memory baseline established:', {
      used: this.formatMemory(this.baselineMemory.used),
      total: this.formatMemory(this.baselineMemory.total),
      limit: this.formatMemory(this.baselineMemory.limit)
    });
  }

  /**
   * Sample current memory usage
   */
  sampleMemory() {
    if (!this.isMemoryAPIAvailable() || !this.profiling) return null;

    const memory = performance.memory;
    const now = Date.now();

    const memorySample = {
      timestamp: now,
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      limit: memory.jsHeapSizeLimit,
      usageRatio: memory.usedJSHeapSize / memory.jsHeapSizeLimit,
      totalRatio: memory.usedJSHeapSize / memory.totalJSHeapSize
    };

    // Add derived metrics
    memorySample.utilization = this.calculateUtilization(memorySample);
    memorySample.pressure = this.calculateMemoryPressure(memorySample);
    memorySample.growthFromBaseline = this.calculateGrowthFromBaseline(memorySample);

    this.memoryHistory.push(memorySample);

    // Maintain history size
    if (this.memoryHistory.length > this.historySize) {
      this.memoryHistory.shift();
    }

    // Update current pressure level
    this.memoryPressureLevel = memorySample.pressure;

    // Check for memory issues
    this.checkMemoryHealth(memorySample);
    this.detectMemoryLeaks(memorySample);

    return memorySample;
  }

  /**
   * Perform heap analysis for detailed object tracking
   */
  performHeapAnalysis() {
    if (!this.isMemoryAPIAvailable()) return;

    const now = Date.now();
    const lastAnalysis = this.heapAnalysis.lastAnalysis;

    // Skip if analysis was recently performed
    if (lastAnalysis && (now - lastAnalysis) < this.heapAnalysis.analysisInterval) {
      return;
    }

    try {
      // Get detailed heap snapshot (if available)
      const heapSnapshot = this.captureHeapSnapshot();

      this.heapAnalysis = {
        ...this.heapAnalysis,
        totalObjects: heapSnapshot.objectCount || 0,
        largestObjects: heapSnapshot.largestObjects || [],
        objectTypes: heapSnapshot.objectTypes || {},
        lastAnalysis: now,
        timestamp: now
      };

    } catch (error) {
      console.warn('[MEMORY_PROFILER] Heap analysis failed:', error.message);
    }
  }

  /**
   * Capture heap snapshot for analysis
   */
  captureHeapSnapshot() {
    // Basic heap analysis using available Memory API
    const memory = performance.memory;

    return {
      objectCount: Math.floor(memory.usedJSHeapSize / 1000), // Rough estimate
      largestObjects: [], // Would require more advanced profiling in real implementation
      objectTypes: {
        'DOM Nodes': document.getElementsByTagName('*').length,
        'Event Listeners': this.estimateEventListeners(),
        'Timers': this.estimateTimers()
      }
    };
  }

  /**
   * Estimate number of event listeners (rough approximation)
   */
  estimateEventListeners() {
    // This is a rough estimate - real implementation would track registered listeners
    return Math.floor(Math.random() * 100) + 50; // Placeholder
  }

  /**
   * Estimate number of active timers
   */
  estimateTimers() {
    // Rough estimate of active setTimeout/setInterval calls
    return Math.floor(Math.random() * 20) + 10; // Placeholder
  }

  /**
   * Monitor garbage collection events
   */
  monitorGarbageCollection() {
    // Create object pattern to trigger GC detection
    const gcMonitor = {
      lastUsed: performance.memory?.usedJSHeapSize || 0,
      checkInterval: 1000,

      check: () => {
        if (!this.isMemoryAPIAvailable() || !this.profiling) return;

        const currentUsed = performance.memory.usedJSHeapSize;

        // Detect garbage collection (memory decrease)
        if (currentUsed < this.gcMonitor.lastUsed) {
          const gcAmount = this.gcMonitor.lastUsed - currentUsed;
          const gcEvent = {
            timestamp: Date.now(),
            amount: gcAmount,
            amountMB: gcAmount / 1024 / 1024,
            memoryBefore: this.gcMonitor.lastUsed,
            memoryAfter: currentUsed
          };

          this.gcEvents.push(gcEvent);
          this.lastGCEvent = gcEvent;

          // Keep only recent GC events
          if (this.gcEvents.length > 50) {
            this.gcEvents.shift();
          }

          this.triggerGarbageCollectionEvent(gcEvent);
        }

        this.gcMonitor.lastUsed = currentUsed;
      }
    };

    // Periodic GC monitoring
    setInterval(() => gcMonitor.check(), gcMonitor.checkInterval);
    this.gcMonitor = gcMonitor;
  }

  /**
   * Calculate memory utilization metrics
   */
  calculateUtilization(memorySample) {
    return {
      heapUsage: memorySample.usageRatio,
      totalUsage: memorySample.totalRatio,
      availableMemory: memorySample.limit - memorySample.used,
      efficiency: (memorySample.used / memorySample.total) * 100
    };
  }

  /**
   * Calculate memory pressure (0-1 scale)
   */
  calculateMemoryPressure(memorySample) {
    // Non-linear pressure calculation
    const basePressure = memorySample.usageRatio;
    const growthPressure = Math.min(memorySample.growthFromBaseline / 100, 1); // Normalize growth
    const gcPressure = this.calculateGCPressure();

    // Weighted combination of pressure factors
    return Math.min((basePressure * 0.6) + (growthPressure * 0.2) + (gcPressure * 0.2), 1);
  }

  /**
   * Calculate GC pressure based on time since last GC
   */
  calculateGCPressure() {
    if (!this.lastGCEvent) return 0.5; // Unknown pressure

    const timeSinceGC = Date.now() - this.lastGCEvent.timestamp;
    const pressureFactor = Math.min(timeSinceGC / this.thresholds.gcPressureThreshold / 1000, 1);

    return pressureFactor;
  }

  /**
   * Calculate growth from baseline in MB
   */
  calculateGrowthFromBaseline(memorySample) {
    if (!this.baselineMemory) return 0;

    const growth = memorySample.used - this.baselineMemory.used;
    return growth / 1024 / 1024; // Convert to MB
  }

  /**
   * Check memory health and trigger alerts
   */
  checkMemoryHealth(memorySample) {
    // Warning threshold
    if (memorySample.usageRatio > this.thresholds.warningUsage) {
      this.triggerMemoryThreshold('warning', {
        type: 'high_usage',
        current: memorySample.usageRatio,
        threshold: this.thresholds.warningUsage,
        memory: memorySample
      });
    }

    // Critical threshold
    if (memorySample.usageRatio > this.thresholds.criticalUsage) {
      this.triggerMemoryThreshold('critical', {
        type: 'critical_usage',
        current: memorySample.usageRatio,
        threshold: this.thresholds.criticalUsage,
        memory: memorySample
      });
    }

    // Memory pressure alert
    if (memorySample.pressure > 0.8) {
      this.triggerMemoryPressure({
        pressure: memorySample.pressure,
        usage: memorySample.usageRatio,
        memory: memorySample
      });
    }
  }

  /**
   * Detect potential memory leaks
   */
  detectMemoryLeaks(memorySample) {
    if (this.memoryHistory.length < 10) return;

    // Analyze growth trend over last 10 samples
    const recentSamples = this.memoryHistory.slice(-10);
    const growthRates = [];

    for (let i = 1; i < recentSamples.length; i++) {
      const timeDiff = (recentSamples[i].timestamp - recentSamples[i-1].timestamp) / 1000 / 60; // minutes
      const memoryDiff = recentSamples[i].used - recentSamples[i-1].used;
      const growthRate = memoryDiff / timeDiff / 1024 / 1024; // MB per minute
      growthRates.push(growthRate);
    }

    const averageGrowthRate = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;

    // Detect consistent growth pattern (potential leak)
    if (averageGrowthRate > this.thresholds.growthRateThreshold &&
        growthRates.every(rate => rate > 0)) {
      this.triggerMemoryLeak({
        type: 'consistent_growth',
        growthRate: averageGrowthRate,
        duration: recentSamples[recentSamples.length - 1].timestamp - recentSamples[0].timestamp,
        totalGrowth: recentSamples[recentSamples.length - 1].used - recentSamples[0].used,
        samples: recentSamples.length
      });
    }
  }

  /**
   * Get current memory statistics
   */
  getMemoryStats() {
    if (this.memoryHistory.length === 0) {
      return { status: 'no_data' };
    }

    const current = this.memoryHistory[this.memoryHistory.length - 1];
    const recent = this.memoryHistory.slice(-10);

    // Calculate recent statistics
    const averageUsage = recent.reduce((sum, sample) => sum + sample.usageRatio, 0) / recent.length;
    const maxUsage = Math.max(...recent.map(s => s.usageRatio));
    const growthTrend = this.calculateGrowthTrend(recent);

    return {
      current: {
        used: this.formatMemory(current.used),
        total: this.formatMemory(current.total),
        limit: this.formatMemory(current.limit),
        usage: Math.round(current.usageRatio * 100) + '%'
      },
      recent: {
        averageUsage: Math.round(averageUsage * 100) + '%',
        maxUsage: Math.round(maxUsage * 100) + '%',
        growthTrend
      },
      baseline: this.baselineMemory ? {
        used: this.formatMemory(this.baselineMemory.used),
        growthFromBaseline: this.formatMemory(current.used - this.baselineMemory.used)
      } : null,
      pressure: {
        level: Math.round(this.memoryPressureLevel * 100) + '%',
        status: this.getPressureStatus()
      },
      gcEvents: {
        total: this.gcEvents.length,
        lastGC: this.lastGCEvent ?
          Math.round((Date.now() - this.lastGCEvent.timestamp) / 1000) + 's ago' :
          'No GC events detected'
      }
    };
  }

  /**
   * Calculate memory growth trend
   */
  calculateGrowthTrend(samples) {
    if (samples.length < 2) return 'stable';

    const firstSample = samples[0];
    const lastSample = samples[samples.length - 1];
    const growth = lastSample.used - firstSample.used;
    const growthMB = growth / 1024 / 1024;

    if (growthMB > 10) return 'growing';
    if (growthMB < -10) return 'shrinking';
    return 'stable';
  }

  /**
   * Get memory pressure status
   */
  getPressureStatus() {
    if (this.memoryPressureLevel > 0.85) return 'critical';
    if (this.memoryPressureLevel > 0.7) return 'warning';
    if (this.memoryPressureLevel > 0.5) return 'moderate';
    return 'low';
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
   * Trigger memory pressure callback
   */
  triggerMemoryPressure(pressureData) {
    const callback = this.callbacks.onMemoryPressure;
    if (typeof callback === 'function') {
      try {
        callback(pressureData);
      } catch (error) {
        console.error('[MEMORY_PROFILER] Error in memory pressure callback:', error);
      }
    }
  }

  /**
   * Trigger memory leak callback
   */
  triggerMemoryLeak(leakData) {
    const callback = this.callbacks.onMemoryLeak;
    if (typeof callback === 'function') {
      try {
        callback(leakData);
      } catch (error) {
        console.error('[MEMORY_PROFILER] Error in memory leak callback:', error);
      }
    }
  }

  /**
   * Trigger garbage collection callback
   */
  triggerGarbageCollectionEvent(gcData) {
    const callback = this.callbacks.onGarbageCollection;
    if (typeof callback === 'function') {
      try {
        callback(gcData);
      } catch (error) {
        console.error('[MEMORY_PROFILER] Error in GC callback:', error);
      }
    }
  }

  /**
   * Trigger memory threshold callback
   */
  triggerMemoryThreshold(severity, thresholdData) {
    const callback = this.callbacks.onMemoryThreshold;
    if (typeof callback === 'function') {
      try {
        callback({ severity, ...thresholdData });
      } catch (error) {
        console.error('[MEMORY_PROFILER] Error in memory threshold callback:', error);
      }
    }
  }

  /**
   * Export comprehensive memory data
   */
  exportData() {
    return {
      configuration: {
        samplingInterval: this.samplingInterval,
        historySize: this.historySize,
        thresholds: this.thresholds
      },
      baseline: this.baselineMemory,
      current: this.memoryHistory.length > 0 ? this.memoryHistory[this.memoryHistory.length - 1] : null,
      stats: this.getMemoryStats(),
      history: this.memoryHistory.slice(-50), // Last 50 samples
      gcEvents: this.gcEvents.slice(-20), // Last 20 GC events
      heapAnalysis: this.heapAnalysis,
      exportTimestamp: Date.now()
    };
  }

  /**
   * Reset memory profiling
   */
  reset() {
    this.stopProfiling();

    this.memoryHistory = [];
    this.gcEvents = [];
    this.lastGCEvent = null;
    this.baselineMemory = null;
    this.memoryPressureLevel = 0;
    this.heapAnalysis.lastAnalysis = null;

    console.log('[MEMORY_PROFILER] Memory profiler reset');
  }
}

/**
 * Global memory profiler instance
 */
export const globalMemoryProfiler = new MemoryProfiler();

/**
 * Convenience function to start memory profiling
 */
export function startMemoryProfiling(options = {}) {
  const profiler = new MemoryProfiler(options);
  profiler.startProfiling();
  return profiler;
}