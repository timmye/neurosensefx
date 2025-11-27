// =============================================================================
// STORE PERFORMANCE MONITOR - Phase 2 Implementation
// =============================================================================
// Comprehensive performance monitoring for store operations
// Tracks subscription overhead, derived store calculations, and cross-store communication

import { performanceMonitor } from './performanceMonitor.js';

// =============================================================================
// STORE PERFORMANCE METRICS COLLECTOR
// =============================================================================

/**
 * Store-specific performance metrics collector
 * Provides detailed insights into store operation performance
 */
class StorePerformanceMonitor {
  constructor() {
    this.metrics = {
      subscriptions: {
        total: 0,
        active: 0,
        averageTime: 0,
        errors: 0
      },
      derivedStores: {
        recalculations: 0,
        averageTime: 0,
        cacheHits: 0,
        cacheMisses: 0
      },
      crossStoreCommunication: {
        eventsQueued: 0,
        eventsProcessed: 0,
        averageProcessingTime: 0,
        queueDepth: 0
      },
      batching: {
        batchesProcessed: 0,
        averageBatchSize: 0,
        averageBatchTime: 0
      },
      memoization: {
        cacheSize: 0,
        hitRate: 0,
        totalQueries: 0
      },
      memory: {
        storeFootprint: 0,
        cacheFootprint: 0,
        gcPressure: 0
      }
    };

    this.detailedMetrics = new Map();
    this.alertThresholds = {
      subscriptionTime: 10, // ms
      derivedStoreTime: 5,  // ms
      communicationTime: 50, // ms
      batchTime: 16,        // ms (60fps)
      cacheHitRate: 80      // %
    };

    this.isMonitoring = false;
    this.monitoringInterval = null;
  }

  /**
   * Start comprehensive performance monitoring
   * @param {Object} options - Monitoring options
   */
  startMonitoring(options = {}) {
    if (this.isMonitoring) {
      console.warn('[STORE_PERF_MONITOR] Already monitoring');
      return;
    }

    this.isMonitoring = true;
    const interval = options.interval || 5000; // 5 second default

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.checkAlerts();
    }, interval);

    console.log('[STORE_PERF_MONITOR] Started store performance monitoring');
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('[STORE_PERF_MONITOR] Stopped store performance monitoring');
  }

  /**
   * Record subscription performance
   * @param {string} storeName - Store name
   * @param {number} time - Subscription time in ms
   * @param {boolean} success - Whether subscription succeeded
   */
  recordSubscription(storeName, time, success = true) {
    if (!success) {
      this.metrics.subscriptions.errors++;
      return;
    }

    this.metrics.subscriptions.total++;
    this.metrics.subscriptions.averageTime =
      (this.metrics.subscriptions.averageTime + time) / 2;

    // Record detailed metrics
    const key = `subscription_${storeName}`;
    if (!this.detailedMetrics.has(key)) {
      this.detailedMetrics.set(key, {
        count: 0,
        totalTime: 0,
        averageTime: 0,
        errors: 0
      });
    }

    const detail = this.detailedMetrics.get(key);
    detail.count++;
    detail.totalTime += time;
    detail.averageTime = detail.totalTime / detail.count;

    performanceMonitor.recordMetric('store_subscription_time', time, {
      storeName,
      category: 'store_performance'
    });
  }

  /**
   * Record derived store calculation
   * @param {string} storeName - Derived store name
   * @param {number} time - Calculation time in ms
   * @param {boolean} cacheHit - Whether result was from cache
   */
  recordDerivedStoreCalculation(storeName, time, cacheHit = false) {
    this.metrics.derivedStores.recalculations++;
    this.metrics.derivedStores.averageTime =
      (this.metrics.derivedStores.averageTime + time) / 2;

    if (cacheHit) {
      this.metrics.derivedStores.cacheHits++;
    } else {
      this.metrics.derivedStores.cacheMisses++;
    }

    // Record detailed metrics
    const key = `derived_${storeName}`;
    if (!this.detailedMetrics.has(key)) {
      this.detailedMetrics.set(key, {
        calculations: 0,
        totalTime: 0,
        averageTime: 0,
        cacheHits: 0,
        cacheMisses: 0
      });
    }

    const detail = this.detailedMetrics.get(key);
    detail.calculations++;
    detail.totalTime += time;
    detail.averageTime = detail.totalTime / detail.calculations;

    if (cacheHit) {
      detail.cacheHits++;
    } else {
      detail.cacheMisses++;
    }

    performanceMonitor.recordMetric('derived_store_time', time, {
      storeName,
      cacheHit,
      category: 'store_performance'
    });
  }

  /**
   * Record cross-store communication event
   * @param {string} fromStore - Source store
   * @param {string} toStore - Target store
   * @param {string} eventType - Event type
   * @param {number} processingTime - Processing time in ms
   */
  recordCrossStoreEvent(fromStore, toStore, eventType, processingTime) {
    this.metrics.crossStoreCommunication.eventsProcessed++;
    this.metrics.crossStoreCommunication.averageProcessingTime =
      (this.metrics.crossStoreCommunication.averageProcessingTime + processingTime) / 2;

    // Record detailed metrics
    const key = `communication_${fromStore}_to_${toStore}`;
    if (!this.detailedMetrics.has(key)) {
      this.detailedMetrics.set(key, {
        events: 0,
        totalTime: 0,
        averageTime: 0,
        eventTypes: {}
      });
    }

    const detail = this.detailedMetrics.get(key);
    detail.events++;
    detail.totalTime += processingTime;
    detail.averageTime = detail.totalTime / detail.events;

    if (!detail.eventTypes[eventType]) {
      detail.eventTypes[eventType] = 0;
    }
    detail.eventTypes[eventType]++;

    performanceMonitor.recordMetric('cross_store_communication_time', processingTime, {
      fromStore,
      toStore,
      eventType,
      category: 'store_performance'
    });
  }

  /**
   * Record batch processing performance
   * @param {number} batchSize - Number of items in batch
   * @param {number} processingTime - Processing time in ms
   */
  recordBatchProcessing(batchSize, processingTime) {
    this.metrics.batching.batchesProcessed++;
    this.metrics.batching.averageBatchSize =
      (this.metrics.batching.averageBatchSize + batchSize) / 2;
    this.metrics.batching.averageBatchTime =
      (this.metrics.batching.averageBatchTime + processingTime) / 2;

    performanceMonitor.recordMetric('batch_processing_time', processingTime, {
      batchSize,
      category: 'store_performance'
    });
  }

  /**
   * Record memoization performance
   * @param {number} cacheSize - Current cache size
   * @param {number} hitRate - Cache hit rate percentage
   * @param {number} totalQueries - Total number of queries
   */
  recordMemoizationPerformance(cacheSize, hitRate, totalQueries) {
    this.metrics.memoization.cacheSize = cacheSize;
    this.metrics.memoization.hitRate = hitRate;
    this.metrics.memoization.totalQueries = totalQueries;

    performanceMonitor.recordMetric('memoization_hit_rate', hitRate, {
      cacheSize,
      category: 'store_performance'
    });
  }

  /**
   * Collect current performance metrics
   */
  collectMetrics() {
    // Update active subscription count (would need integration with subscription manager)
    // This is a placeholder - actual implementation would query subscription state
    this.metrics.subscriptions.active = this.estimateActiveSubscriptions();

    // Update queue depth
    this.metrics.crossStoreCommunication.queueDepth = this.estimateQueueDepth();

    // Record memory metrics
    this.updateMemoryMetrics();

    // Store metrics in performance monitor
    performanceMonitor.recordMetric('store_performance_metrics', this.metrics);
  }

  /**
   * Check for performance alerts
   */
  checkAlerts() {
    const alerts = [];

    // Check subscription times
    if (this.metrics.subscriptions.averageTime > this.alertThresholds.subscriptionTime) {
      alerts.push({
        type: 'subscription_performance',
        severity: 'warning',
        message: `Average subscription time (${this.metrics.subscriptions.averageTime.toFixed(2)}ms) exceeds threshold`,
        value: this.metrics.subscriptions.averageTime,
        threshold: this.alertThresholds.subscriptionTime
      });
    }

    // Check derived store times
    if (this.metrics.derivedStores.averageTime > this.alertThresholds.derivedStoreTime) {
      alerts.push({
        type: 'derived_store_performance',
        severity: 'warning',
        message: `Average derived store time (${this.metrics.derivedStores.averageTime.toFixed(2)}ms) exceeds threshold`,
        value: this.metrics.derivedStores.averageTime,
        threshold: this.alertThresholds.derivedStoreTime
      });
    }

    // Check cache hit rate
    if (this.metrics.memoization.hitRate < this.alertThresholds.cacheHitRate) {
      alerts.push({
        type: 'cache_performance',
        severity: 'warning',
        message: `Cache hit rate (${this.metrics.memoization.hitRate}%) below threshold`,
        value: this.metrics.memoization.hitRate,
        threshold: this.alertThresholds.cacheHitRate
      });
    }

    // Check communication times
    if (this.metrics.crossStoreCommunication.averageProcessingTime > this.alertThresholds.communicationTime) {
      alerts.push({
        type: 'communication_performance',
        severity: 'error',
        message: `Cross-store communication time (${this.metrics.crossStoreCommunication.averageProcessingTime.toFixed(2)}ms) exceeds threshold`,
        value: this.metrics.crossStoreCommunication.averageProcessingTime,
        threshold: this.alertThresholds.communicationTime
      });
    }

    // Check batch processing times
    if (this.metrics.batching.averageBatchTime > this.alertThresholds.batchTime) {
      alerts.push({
        type: 'batch_performance',
        severity: 'warning',
        message: `Batch processing time (${this.metrics.batching.averageBatchTime.toFixed(2)}ms) exceeds 60fps threshold`,
        value: this.metrics.batching.averageBatchTime,
        threshold: this.alertThresholds.batchTime
      });
    }

    // Emit alerts
    alerts.forEach(alert => {
      console.warn(`[STORE_PERF_MONITOR] ${alert.type.toUpperCase()}: ${alert.message}`);
      performanceMonitor.recordMetric('store_performance_alert', alert);
    });
  }

  /**
   * Estimate active subscriptions (placeholder implementation)
   * @returns {number} Estimated active subscriptions
   */
  estimateActiveSubscriptions() {
    // This would need actual integration with subscription tracking
    return this.metrics.subscriptions.total * 0.8; // Rough estimate
  }

  /**
   * Estimate queue depth (placeholder implementation)
   * @returns {number} Estimated queue depth
   */
  estimateQueueDepth() {
    // This would need actual integration with communication system
    return Math.max(0, this.metrics.crossStoreCommunication.eventsQueued -
                     this.metrics.crossStoreCommunication.eventsProcessed);
  }

  /**
   * Update memory metrics
   */
  updateMemoryMetrics() {
    try {
      // Estimate memory usage (simplified approach)
      if (performance.memory) {
        const memInfo = performance.memory;
        this.metrics.memory.storeFootprint = memInfo.usedJSHeapSize / 1024 / 1024; // MB
        this.metrics.memory.gcPressure = memInfo.jsHeapSizeLimit > 0 ?
          (memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit) * 100 : 0;
      }
    } catch (error) {
      // Memory API not available
      console.debug('[STORE_PERF_MONITOR] Memory monitoring not available');
    }
  }

  /**
   * Get comprehensive performance report
   * @returns {Object} Performance report
   */
  getPerformanceReport() {
    const cacheHitRate = this.metrics.derivedStores.cacheHits +
                        this.metrics.derivedStores.cacheMisses > 0 ?
      (this.metrics.derivedStores.cacheHits /
       (this.metrics.derivedStores.cacheHits + this.metrics.derivedStores.cacheMisses)) * 100 : 0;

    return {
      summary: {
        isMonitoring: this.isMonitoring,
        totalSubscriptions: this.metrics.subscriptions.total,
        subscriptionErrors: this.metrics.subscriptions.errors,
        averageSubscriptionTime: this.metrics.subscriptions.averageTime,
        derivedStoreRecalculations: this.metrics.derivedStores.recalculations,
        averageDerivedStoreTime: this.metrics.derivedStores.averageTime,
        crossStoreEventsProcessed: this.metrics.crossStoreCommunication.eventsProcessed,
        averageCommunicationTime: this.metrics.crossStoreCommunication.averageProcessingTime,
        batchesProcessed: this.metrics.batching.batchesProcessed,
        averageBatchTime: this.metrics.batching.averageBatchTime,
        cacheHitRate: cacheHitRate
      },
      detailed: Object.fromEntries(this.detailedMetrics),
      metrics: this.metrics,
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * Generate performance recommendations
   * @returns {Array} Array of recommendations
   */
  generateRecommendations() {
    const recommendations = [];

    if (this.metrics.subscriptions.averageTime > this.alertThresholds.subscriptionTime) {
      recommendations.push({
        category: 'subscriptions',
        priority: 'high',
        issue: 'Slow subscription times detected',
        suggestion: 'Consider implementing subscription deduplication or reducing store update frequency'
      });
    }

    if (this.metrics.derivedStores.averageTime > this.alertThresholds.derivedStoreTime) {
      recommendations.push({
        category: 'derived_stores',
        priority: 'medium',
        issue: 'Derived store calculations are slow',
        suggestion: 'Implement memoization or optimize derived store logic'
      });
    }

    const cacheHitRate = this.metrics.derivedStores.cacheHits +
                        this.metrics.derivedStores.cacheMisses > 0 ?
      (this.metrics.derivedStores.cacheHits /
       (this.metrics.derivedStores.cacheHits + this.metrics.derivedStores.cacheMisses)) * 100 : 0;

    if (cacheHitRate < this.alertThresholds.cacheHitRate) {
      recommendations.push({
        category: 'memoization',
        priority: 'medium',
        issue: 'Low cache hit rate',
        suggestion: 'Review cache key generation and consider increasing cache size'
      });
    }

    if (this.metrics.crossStoreCommunication.averageProcessingTime > this.alertThresholds.communicationTime) {
      recommendations.push({
        category: 'communication',
        priority: 'high',
        issue: 'Slow cross-store communication',
        suggestion: 'Optimize event batching or reduce cross-store dependencies'
      });
    }

    if (this.metrics.memory.gcPressure > 80) {
      recommendations.push({
        category: 'memory',
        priority: 'high',
        issue: 'High garbage collection pressure',
        suggestion: 'Implement more aggressive cache eviction and reduce object creation'
      });
    }

    return recommendations;
  }

  /**
   * Reset all metrics
   */
  resetMetrics() {
    this.metrics = {
      subscriptions: { total: 0, active: 0, averageTime: 0, errors: 0 },
      derivedStores: { recalculations: 0, averageTime: 0, cacheHits: 0, cacheMisses: 0 },
      crossStoreCommunication: { eventsQueued: 0, eventsProcessed: 0, averageProcessingTime: 0, queueDepth: 0 },
      batching: { batchesProcessed: 0, averageBatchSize: 0, averageBatchTime: 0 },
      memoization: { cacheSize: 0, hitRate: 0, totalQueries: 0 },
      memory: { storeFootprint: 0, cacheFootprint: 0, gcPressure: 0 }
    };

    this.detailedMetrics.clear();
    console.log('[STORE_PERF_MONITOR] Metrics reset');
  }
}

// =============================================================================
// GLOBAL STORE PERFORMANCE MONITOR
// =============================================================================

export const storePerformanceMonitor = new StorePerformanceMonitor();

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Start store performance monitoring
 * @param {Object} options - Monitoring options
 */
export function startStorePerformanceMonitoring(options = {}) {
  storePerformanceMonitor.startMonitoring(options);
}

/**
 * Stop store performance monitoring
 */
export function stopStorePerformanceMonitoring() {
  storePerformanceMonitor.stopMonitoring();
}

/**
 * Get store performance report
 * @returns {Object} Performance report
 */
export function getStorePerformanceReport() {
  return storePerformanceMonitor.getPerformanceReport();
}

/**
 * Record store subscription performance
 * @param {string} storeName - Store name
 * @param {number} time - Subscription time in ms
 * @param {boolean} success - Whether subscription succeeded
 */
export function recordStoreSubscription(storeName, time, success = true) {
  storePerformanceMonitor.recordSubscription(storeName, time, success);
}

/**
 * Record derived store calculation
 * @param {string} storeName - Derived store name
 * @param {number} time - Calculation time in ms
 * @param {boolean} cacheHit - Whether result was from cache
 */
export function recordDerivedStoreCalculation(storeName, time, cacheHit = false) {
  storePerformanceMonitor.recordDerivedStoreCalculation(storeName, time, cacheHit);
}

/**
 * Record cross-store communication event
 * @param {string} fromStore - Source store
 * @param {string} toStore - Target store
 * @param {string} eventType - Event type
 * @param {number} processingTime - Processing time in ms
 */
export function recordCrossStoreEvent(fromStore, toStore, eventType, processingTime) {
  storePerformanceMonitor.recordCrossStoreEvent(fromStore, toStore, eventType, processingTime);
}

/**
 * Record batch processing performance
 * @param {number} batchSize - Number of items in batch
 * @param {number} processingTime - Processing time in ms
 */
export function recordBatchProcessing(batchSize, processingTime) {
  storePerformanceMonitor.recordBatchProcessing(batchSize, processingTime);
}

export default storePerformanceMonitor;