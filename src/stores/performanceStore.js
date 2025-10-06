/**
 * Performance Monitoring Store
 * Tracks application performance metrics and health
 */

import { writable, derived } from 'svelte/store';
import { stateValidator } from '../utils/stateValidation.js';
import { statePersistence, STORAGE_KEYS } from '../utils/statePersistence.js';
import { withValidation, validatePerformanceThresholds } from '../utils/stateValidation.js';

// Create default performance state
function createDefaultPerformanceState() {
  return {
    metrics: {
      fps: 0,
      renderTime: 0,
      memoryUsage: 0,
      activeCanvases: 0,
      activeSubscriptions: 0,
      cacheHitRate: 0,
      dataProcessingTime: 0,
      networkLatency: 0,
      errorCount: 0,
      warningCount: 0
    },
    alerts: [],
    thresholds: {
      maxRenderTime: 16, // 60fps
      maxMemoryUsage: 500 * 1024 * 1024, // 500MB
      minFPS: 30,
      minCacheHitRate: 80,
      maxNetworkLatency: 1000, // 1 second
      maxErrorRate: 5 // errors per minute
    },
    history: {
      fps: [],
      renderTime: [],
      memoryUsage: [],
      cacheHitRate: [],
      timestamps: []
    },
    benchmarks: {
      lastFrameTime: 0,
      frameCount: 0,
      averageFrameTime: 0,
      worstFrameTime: 0,
      bestFrameTime: Infinity
    }
  };
}

// Initialize performance store with default state
const initialState = createDefaultPerformanceState();
const { subscribe, set, update } = writable(initialState);

// Performance monitoring utilities
class PerformanceMonitor {
  constructor() {
    this.frameCount = 0;
    this.lastFrameTime = performance.now();
    this.fpsHistory = [];
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.rafId = null;
  }

  /**
   * Start performance monitoring
   */
  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.startFrameLoop();
    this.startMetricsCollection();
    
    console.log('[PerformanceMonitor] Started monitoring');
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    console.log('[PerformanceMonitor] Stopped monitoring');
  }

  /**
   * Start frame loop for FPS calculation
   */
  startFrameLoop() {
    const measureFrame = () => {
      if (!this.isMonitoring) return;
      
      const now = performance.now();
      const deltaTime = now - this.lastFrameTime;
      
      // Calculate FPS
      const fps = 1000 / deltaTime;
      this.fpsHistory.push(fps);
      
      // Keep only last 60 frames (1 second at 60fps)
      if (this.fpsHistory.length > 60) {
        this.fpsHistory.shift();
      }
      
      // Update metrics
      if (this.frameCount % 10 === 0) { // Update every 10 frames
        const avgFPS = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
        performanceStore.updateMetrics({ fps: avgFPS });
      }
      
      this.lastFrameTime = now;
      this.frameCount++;
      
      this.rafId = requestAnimationFrame(measureFrame);
    };
    
    this.rafId = requestAnimationFrame(measureFrame);
  }

  /**
   * Start periodic metrics collection
   */
  startMetricsCollection() {
    this.monitoringInterval = setInterval(() => {
      if (!this.isMonitoring) return;
      
      this.collectMetrics();
    }, 1000); // Collect every second
  }

  /**
   * Collect performance metrics
   */
  collectMetrics() {
    const metrics = {};
    
    // Memory usage
    if (performance.memory) {
      metrics.memoryUsage = performance.memory.usedJSHeapSize;
    }
    
    // Network latency (placeholder - would be measured from actual requests)
    metrics.networkLatency = this.measureNetworkLatency();
    
    // Update store
    performanceStore.updateMetrics(metrics);
    performanceStore.checkThresholds();
  }

  /**
   * Measure network latency (FUTURE: implement actual network latency measurement)
   * TODO: Implement real network latency measurement using fetch API or WebSocket ping
   * Currently returns simulated latency - NOT REAL MEASUREMENT
   */
  measureNetworkLatency() {
    // FUTURE_IMPLEMENTATION: Measure actual network latency
    // Consider using fetch with timing or WebSocket ping/pong
    console.warn('[PerformanceStore] Using placeholder network latency - implement real measurement for production');
    
    // For now, return a reasonable estimate based on connection type
    if (navigator.connection) {
      const connection = navigator.connection;
      if (connection.effectiveType === '4g') return 20;
      if (connection.effectiveType === '3g') return 100;
      if (connection.effectiveType === '2g') return 300;
    }
    
    // Fallback to simulated value
    return Math.random() * 50 + 10; // 10-60ms simulated latency
  }

  /**
   * Record a performance event
   */
  recordEvent(type, data) {
    switch (type) {
      case 'render':
        performanceStore.recordRenderTime(data.duration);
        break;
      case 'dataProcessing':
        performanceStore.recordDataProcessingTime(data.duration);
        break;
      case 'error':
        performanceStore.recordError(data.error);
        break;
      case 'warning':
        performanceStore.recordWarning(data.warning);
        break;
    }
  }

  /**
   * Get current performance report
   */
  getReport() {
    let currentState;
    performanceStore.subscribe(state => currentState = state)();
    
    return {
      timestamp: Date.now(),
      metrics: currentState.metrics,
      alerts: currentState.alerts,
      health: this.calculateHealthScore(currentState),
      recommendations: this.generateRecommendations(currentState)
    };
  }

  /**
   * Calculate performance health score
   */
  calculateHealthScore(state) {
    const { metrics, thresholds } = state;
    let score = 100;
    
    // FPS score
    if (metrics.fps < thresholds.minFPS) {
      score -= (thresholds.minFPS - metrics.fps) * 2;
    }
    
    // Memory score
    if (metrics.memoryUsage > thresholds.maxMemoryUsage) {
      score -= (metrics.memoryUsage - thresholds.maxMemoryUsage) / (1024 * 1024);
    }
    
    // Cache hit rate score
    if (metrics.cacheHitRate < thresholds.minCacheHitRate) {
      score -= (thresholds.minCacheHitRate - metrics.cacheHitRate);
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations(state) {
    const recommendations = [];
    const { metrics, thresholds } = state;
    
    if (metrics.fps < thresholds.minFPS) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'Low FPS detected. Consider reducing canvas count or optimizing visualizations.',
        action: 'optimize'
      });
    }
    
    if (metrics.memoryUsage > thresholds.maxMemoryUsage) {
      recommendations.push({
        type: 'memory',
        priority: 'medium',
        message: 'High memory usage detected. Consider clearing cache or reducing data retention.',
        action: 'cleanup'
      });
    }
    
    if (metrics.cacheHitRate < thresholds.minCacheHitRate) {
      recommendations.push({
        type: 'cache',
        priority: 'low',
        message: 'Low cache hit rate. Consider adjusting cache strategy or increasing cache size.',
        action: 'tune'
      });
    }
    
    return recommendations;
  }
}

// Create performance monitor instance
const performanceMonitor = new PerformanceMonitor();

// Enhanced store with performance operations
export const performanceStore = {
  subscribe,
  
  /**
   * Set performance state with validation
   */
  set: (performanceState) => {
    const validated = stateValidator.validatePerformance(performanceState);
    set(validated);
    return validated;
  },
  
  /**
   * Update performance state with validation
   */
  update: (updater) => {
    update(withValidation('performance', updater));
  },
  
  /**
   * Reset performance state to default
   */
  reset: () => {
    const defaultState = createDefaultPerformanceState();
    set(defaultState);
    return defaultState;
  },
  
  /**
   * Update specific metrics
   */
  updateMetrics: (newMetrics) => {
    update(state => {
      const updatedMetrics = { ...state.metrics, ...newMetrics };
      
      // Update history
      const now = Date.now();
      const updatedHistory = { ...state.history };
      
      // Add to history (keep last 100 data points)
      Object.keys(newMetrics).forEach(key => {
        if (updatedHistory[key]) {
          updatedHistory[key].push(newMetrics[key]);
          if (updatedHistory[key].length > 100) {
            updatedHistory[key].shift();
          }
        }
      });
      
      updatedHistory.timestamps.push(now);
      if (updatedHistory.timestamps.length > 100) {
        updatedHistory.timestamps.shift();
      }
      
      return {
        ...state,
        metrics: updatedMetrics,
        history: updatedHistory,
        updatedAt: now
      };
    });
  },
  
  /**
   * Record render time
   */
  recordRenderTime: (duration) => {
    update(state => {
      const benchmarks = { ...state.benchmarks };
      
      benchmarks.lastFrameTime = duration;
      benchmarks.frameCount++;
      
      if (duration > benchmarks.worstFrameTime) {
        benchmarks.worstFrameTime = duration;
      }
      
      if (duration < benchmarks.bestFrameTime) {
        benchmarks.bestFrameTime = duration;
      }
      
      // Calculate average frame time
      const totalFrameTime = benchmarks.frameCount * duration;
      benchmarks.averageFrameTime = totalFrameTime / benchmarks.frameCount;
      
      return {
        ...state,
        metrics: { ...state.metrics, renderTime: duration },
        benchmarks
      };
    });
  },
  
  /**
   * Record data processing time
   */
  recordDataProcessingTime: (duration) => {
    update(state => ({
      ...state,
      metrics: { ...state.metrics, dataProcessingTime: duration }
    }));
  },
  
  /**
   * Record error
   */
  recordError: (error) => {
    update(state => ({
      ...state,
      metrics: { ...state.metrics, errorCount: state.metrics.errorCount + 1 }
    }));
    
    console.error('[PerformanceStore] Error recorded:', error);
  },
  
  /**
   * Record warning
   */
  recordWarning: (warning) => {
    update(state => ({
      ...state,
      metrics: { ...state.metrics, warningCount: state.metrics.warningCount + 1 }
    }));
    
    console.warn('[PerformanceStore] Warning recorded:', warning);
  },
  
  /**
   * Update thresholds
   */
  updateThresholds: (newThresholds) => {
    update(state => ({
      ...state,
      thresholds: { ...state.thresholds, ...newThresholds }
    }));
  },
  
  /**
   * Check performance thresholds and create alerts
   */
  checkThresholds: () => {
    update(state => {
      const newAlerts = validatePerformanceThresholds(state.metrics, state.thresholds);
      
      return {
        ...state,
        alerts: [...state.alerts, ...newAlerts]
      };
    });
  },
  
  /**
   * Clear alerts
   */
  clearAlerts: () => {
    update(state => ({
      ...state,
      alerts: []
    }));
  },
  
  /**
   * Acknowledge alert
   */
  acknowledgeAlert: (alertId) => {
    update(state => ({
      ...state,
      alerts: state.alerts.map(alert =>
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      )
    }));
  },
  
  /**
   * Update active canvas count
   */
  setActiveCanvasCount: (count) => {
    update(state => ({
      ...state,
      metrics: { ...state.metrics, activeCanvases: count }
    }));
  },
  
  /**
   * Update active subscription count
   */
  setActiveSubscriptionCount: (count) => {
    update(state => ({
      ...state,
      metrics: { ...state.metrics, activeSubscriptions: count }
    }));
  },
  
  /**
   * Update cache hit rate
   */
  setCacheHitRate: (rate) => {
    update(state => ({
      ...state,
      metrics: { ...state.metrics, cacheHitRate: rate }
    }));
  },
  
  /**
   * Save performance state to persistence
   */
  save: async () => {
    let currentState;
    subscribe(state => currentState = state)();
    
    try {
      const success = await statePersistence.saveState(
        STORAGE_KEYS.PERFORMANCE_STATE,
        currentState,
        { validate: true }
      );
      
      if (success) {
        console.log('[performanceStore] Performance state saved successfully');
      }
      
      return success;
    } catch (error) {
      console.error('[performanceStore] Failed to save performance state:', error);
      return false;
    }
  },
  
  /**
   * Load performance state from persistence
   */
  load: async () => {
    try {
      const loadedState = await statePersistence.loadState(
        STORAGE_KEYS.PERFORMANCE_STATE,
        { validate: true }
      );
      
      if (loadedState) {
        set(loadedState);
        console.log('[performanceStore] Performance state loaded successfully');
        return loadedState;
      }
      
      return null;
    } catch (error) {
      console.error('[performanceStore] Failed to load performance state:', error);
      return null;
    }
  },
  
  /**
   * Get performance monitor instance
   */
  getMonitor: () => performanceMonitor
};

// Derived stores for specific performance aspects
export const performanceMetrics = derived(
  performanceStore,
  $performance => $performance.metrics
);

export const performanceAlerts = derived(
  performanceStore,
  $performance => $performance.alerts
);

export const performanceThresholds = derived(
  performanceStore,
  $performance => $performance.thresholds
);

export const performanceHistory = derived(
  performanceStore,
  $performance => $performance.history
);

export const performanceBenchmarks = derived(
  performanceStore,
  $performance => $performance.benchmarks
);

// Computed derived stores
export const isPerformanceHealthy = derived(
  performanceMetrics,
  $metrics => $metrics.fps >= 30 && $metrics.memoryUsage < 500 * 1024 * 1024
);

export const hasPerformanceAlerts = derived(
  performanceAlerts,
  $alerts => $alerts.length > 0
);

export const unacknowledgedAlerts = derived(
  performanceAlerts,
  $alerts => $alerts.filter(alert => !alert.acknowledged)
);

export const performanceScore = derived(
  performanceMetrics,
  $metrics => {
    let score = 100;
    
    // FPS scoring
    if ($metrics.fps < 30) score -= 50;
    else if ($metrics.fps < 45) score -= 25;
    else if ($metrics.fps < 55) score -= 10;
    
    // Memory scoring
    const memoryMB = $metrics.memoryUsage / (1024 * 1024);
    if (memoryMB > 500) score -= 30;
    else if (memoryMB > 300) score -= 15;
    else if (memoryMB > 200) score -= 5;
    
    // Cache scoring
    if ($metrics.cacheHitRate < 70) score -= 20;
    else if ($metrics.cacheHitRate < 80) score -= 10;
    
    return Math.max(0, score);
  }
);

// Start monitoring automatically
if (typeof window !== 'undefined') {
  // Start monitoring after a short delay
  setTimeout(() => {
    performanceMonitor.startMonitoring();
  }, 1000);
}

// Initialize performance state from persistence on startup
(async () => {
  try {
    const loaded = await performanceStore.load();
    if (!loaded) {
      console.log('[performanceStore] Using default performance state (no saved state found)');
    }
  } catch (error) {
    console.error('[performanceStore] Failed to load saved performance state, using default:', error);
  }
})();

export default performanceStore;
