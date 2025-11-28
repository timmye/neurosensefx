/**
 * Memory Management Utilities
 *
 * Centralized resource cleanup patterns to support 20+ concurrent displays
 * without performance degradation or memory leaks.
 *
 * Design Philosophy: "Simple, Performant, Maintainable"
 * - Simple: Standardized cleanup patterns with clear APIs
 * - Performant: Zero memory leaks, sub-100ms cleanup operations
 * - Maintainable: Consistent patterns across all components
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
 * Resource cleanup manager for consistent resource lifecycle management
 */
export class ResourceCleanupManager {
  constructor(componentId, componentType = 'component') {
    try {
      this.componentId = String(componentId || 'unknown');
      this.componentType = String(componentType || 'component');
      this.resources = new Map();
      this.cleanupPhases = new Map();
      this.isDestroyed = false;
      this.circuitBreaker = new CircuitBreaker({ failureThreshold: 5, recoveryTime: 30000 });

      console.log(`[MEMORY_MANAGER:${this.componentId}] Initialized for ${this.componentType}`);

      
    } catch (error) {
      memorySafeErrorHandler('ResourceCleanupManager.constructor', error);

      // Fallback to safe, minimal mode
      this.componentId = String(componentId || 'fallback');
      this.componentType = String(componentType || 'component');
      this.resources = new Map();
      this.cleanupPhases = new Map();
      this.isDestroyed = false;
      this.circuitBreaker = new CircuitBreaker({ failureThreshold: 3, recoveryTime: 60000 });

      console.warn(`[MEMORY_MANAGER:${this.componentId}] Constructor failed, using fallback mode`);
    }
  }

  /**
   * Register a resource for automatic cleanup
   * @param {string} type - Resource type ('canvas', 'interactable', 'subscription', 'timeout', etc.)
   * @param {*} resource - The resource to clean up
   * @param {Function} cleanupFunction - How to clean up this resource
   * @param {Object} options - Additional options
   */
  registerResource(type, resource, cleanupFunction, options = {}) {
    if (this.isDestroyed) {
      console.warn(`[MEMORY_MANAGER:${this.componentId}] Attempted to register resource after destruction:`, { type, resource });
      return;
    }

    const resourceId = options.id || `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.resources.set(resourceId, {
      type,
      resource,
      cleanupFunction,
      options: { ...options, id: resourceId },
      registeredAt: Date.now()
    });

    console.log(`[MEMORY_MANAGER:${this.componentId}] Registered ${type} resource:`, resourceId);
    return resourceId;
  }

  /**
   * Register multiple cleanup phases for orderly resource destruction
   * @param {string} phaseName - Name of the cleanup phase
   * @param {Function} phaseFunction - Function to execute for this phase
   * @param {number} priority - Priority order (lower numbers run first)
   */
  registerCleanupPhase(phaseName, phaseFunction, priority = 100) {
    this.cleanupPhases.set(phaseName, {
      phaseName,
      phaseFunction,
      priority,
      completed: false
    });
  }

  /**
   * Clean up a specific resource by ID
   * @param {string} resourceId - ID of the resource to clean up
   * @returns {boolean} True if resource was found and cleaned up
   */
  cleanupResource(resourceId) {
    const resourceInfo = this.resources.get(resourceId);
    if (!resourceInfo) {
      console.warn(`[MEMORY_MANAGER:${this.componentId}] Resource not found for cleanup:`, resourceId);
      return false;
    }

    try {
      const { type, resource, cleanupFunction } = resourceInfo;

      console.log(`[MEMORY_MANAGER:${this.componentId}] Cleaning up ${type} resource:`, resourceId);

      if (typeof cleanupFunction === 'function') {
        cleanupFunction(resource);
      } else {
        this.defaultCleanup(type, resource);
      }

      this.resources.delete(resourceId);
      return true;

    } catch (error) {
      console.error(`[MEMORY_MANAGER:${this.componentId}] Error cleaning up resource ${resourceId}:`, error);
      this.resources.delete(resourceId); // Still remove from tracking
      return false;
    }
  }

  /**
   * Default cleanup handlers for common resource types
   * @param {string} type - Resource type
   * @param {*} resource - Resource to clean up
   */
  defaultCleanup(type, resource) {
    const startTime = performance.now();

    switch (type) {
      case 'canvas':
        if (resource) {
          const ctx = resource.getContext?.('2d') || resource;
          if (ctx && ctx.clearRect) {
            ctx.clearRect(0, 0, resource.width || 0, resource.height || 0);
          }
          // Clear any canvas event listeners
          if (resource.removeEventListener) {
            resource.removeEventListener('contextmenu', this.handleCanvasContextMenu);
            resource.removeEventListener('click', this.handleCanvasClick);
          }
        }
        break;

      case 'interactable':
        if (resource && typeof resource.unset === 'function') {
          resource.unset();
        }
        break;

      case 'subscription':
        if (resource && typeof resource === 'function') {
          resource(); // Unsubscribe function
        }
        break;

      case 'timeout':
      case 'interval':
        if (resource) {
          clearTimeout(resource);
          clearInterval(resource);
        }
        break;

      case 'animationFrame':
        if (resource) {
          cancelAnimationFrame(resource);
        }
        break;

      case 'zoomDetector':
        if (typeof resource === 'function') {
          resource();
        }
        break;

      case 'eventListener':
        if (resource.target && resource.event && resource.handler) {
          resource.target.removeEventListener(resource.event, resource.handler);
        }
        break;

      case 'store':
        if (resource && resource.unsubscribe) {
          resource.unsubscribe();
        }
        break;

      case 'array':
        if (Array.isArray(resource)) {
          resource.length = 0; // Clear array
        }
        break;

      case 'map':
      case 'set':
        if (resource && resource.clear) {
          resource.clear();
        }
        break;

      default:
        console.warn(`[MEMORY_MANAGER:${this.componentId}] No default cleanup for resource type:`, type);
    }

    const cleanupTime = performance.now() - startTime;
    if (cleanupTime > 10) { // Log slow cleanup operations
      console.warn(`[MEMORY_MANAGER:${this.componentId}] Slow cleanup detected for ${type}: ${cleanupTime.toFixed(2)}ms`);
    }
  }

  /**
   * Execute all registered cleanup phases in priority order
   * @returns {Object} Cleanup summary with timing and success metrics
   */
  async executeCleanupPhases() {
    const startTime = performance.now();
    const phases = Array.from(this.cleanupPhases.values())
      .sort((a, b) => a.priority - b.priority);

    const results = {
      totalPhases: phases.length,
      completedPhases: 0,
      failedPhases: 0,
      phaseResults: [],
      totalTime: 0
    };

    console.log(`[MEMORY_MANAGER:${this.componentId}] Starting ${results.totalPhases} cleanup phases`);

    for (const phase of phases) {
      const phaseStartTime = performance.now();

      try {
        console.log(`[MEMORY_MANAGER:${this.componentId}] Executing cleanup phase: ${phase.phaseName}`);

        if (typeof phase.phaseFunction === 'function') {
          await phase.phaseFunction();
        }

        phase.completed = true;
        results.completedPhases++;

        const phaseTime = performance.now() - phaseStartTime;
        results.phaseResults.push({
          phaseName: phase.phaseName,
          success: true,
          time: phaseTime
        });

      } catch (error) {
        results.failedPhases++;
        const phaseTime = performance.now() - phaseStartTime;

        results.phaseResults.push({
          phaseName: phase.phaseName,
          success: false,
          error: error.message,
          time: phaseTime
        });

        console.error(`[MEMORY_MANAGER:${this.componentId}] Cleanup phase failed: ${phase.phaseName}`, error);
      }
    }

    results.totalTime = performance.now() - startTime;

    if (results.failedPhases > 0) {
      console.error(`[MEMORY_MANAGER:${this.componentId}] Cleanup completed with ${results.failedPhases} failed phases:`, results);
    } else {
      console.log(`[MEMORY_MANAGER:${this.componentId}] All cleanup phases completed successfully in ${results.totalTime.toFixed(2)}ms`);
    }

    return results;
  }

  /**
   * Clean up all registered resources
   * @returns {Object} Cleanup summary with timing and success metrics
   */
  cleanupAllResources() {
    // Safety check for initialization state
    if (this.isDestroyed || !this.resources) {
      return { totalResources: 0, cleanedResources: 0, failedCleanups: 0, cleanupResults: [], totalTime: 0 };
    }

    const startTime = performance.now();
    const resources = Array.from(this.resources.entries());
    const results = {
      totalResources: resources.length,
      cleanedResources: 0,
      failedCleanups: 0,
      cleanupResults: [],
      totalTime: 0
    };

    console.log(`[MEMORY_MANAGER:${this.componentId}] Starting cleanup of ${results.totalResources} resources`);

    for (const [resourceId, resourceInfo] of resources) {
      const resourceStartTime = performance.now();

      try {
        const success = this.cleanupResource(resourceId);
        results.cleanedResources += success ? 1 : 0;
        results.failedCleanups += success ? 0 : 1;

        const cleanupTime = performance.now() - resourceStartTime;
        results.cleanupResults.push({
          resourceId,
          type: resourceInfo.type,
          success,
          time: cleanupTime
        });

      } catch (error) {
        results.failedCleanups++;
        const cleanupTime = performance.now() - resourceStartTime;

        results.cleanupResults.push({
          resourceId,
          type: resourceInfo.type || 'unknown',
          success: false,
          error: error.message,
          time: cleanupTime
        });

        console.error(`[MEMORY_MANAGER:${this.componentId}] Unexpected error cleaning up resource ${resourceId}:`, error);
      }
    }

    results.totalTime = performance.now() - startTime;

    if (results.failedCleanups > 0) {
      console.error(`[MEMORY_MANAGER:${this.componentId}] Resource cleanup completed with ${results.failedCleanups} failures:`, results);
    } else {
      console.log(`[MEMORY_MANAGER:${this.componentId}] All resources cleaned up successfully in ${results.totalTime.toFixed(2)}ms`);
    }

    return results;
  }

  /**
   * Complete cleanup - execute phases then clean all resources
   * @returns {Object} Comprehensive cleanup summary
   */
  async destroy() {
    if (this.isDestroyed) {
      console.warn(`[MEMORY_MANAGER:${this.componentId}] Component already destroyed`);
      return { alreadyDestroyed: true };
    }

    this.isDestroyed = true;
    const startTime = performance.now();

    console.log(`[MEMORY_MANAGER:${this.componentId}] Starting complete cleanup for ${this.componentType}`);

    // Phase 1: Execute cleanup phases
    const phaseResults = await this.executeCleanupPhases();

    // Phase 2: Clean up all resources
    const resourceResults = this.cleanupAllResources();

    // Final cleanup
    this.cleanupPhases.clear();
    this.resources.clear();

    const totalTime = performance.now() - startTime;
    const meetsPerformanceTarget = totalTime < 100; // Sub-100ms cleanup target

    if (!meetsPerformanceTarget) {
      console.warn(`[MEMORY_MANAGER:${this.componentId}] Cleanup performance warning: ${totalTime.toFixed(2)}ms (target: <100ms)`);
    }

    const summary = {
      componentId: this.componentId,
      componentType: this.componentType,
      totalTime,
      meetsPerformanceTarget,
      phaseResults,
      resourceResults,
      destroyedAt: Date.now()
    };

    console.log(`[MEMORY_MANAGER:${this.componentId}] Cleanup completed: ${summary.meetsPerformanceTarget ? '✅' : '⚠️'} ${totalTime.toFixed(2)}ms`);

    return summary;
  }

  /**
   * Get current resource count by type for memory monitoring
   * @returns {Object} Resource counts by type
   */
  getResourceCounts() {
    const counts = {};
    for (const [resourceId, resourceInfo] of this.resources) {
      const type = resourceInfo.type;
      counts[type] = (counts[type] || 0) + 1;
    }
    return counts;
  }

  /**
   * Check for potential memory leaks by analyzing resource age
   * @param {number} maxAgeMs - Maximum age in milliseconds before considering a resource potentially leaked
   * @returns {Array} List of potentially leaked resources
   */
  detectPotentialLeaks(maxAgeMs = 300000) { // 5 minutes default
    const now = Date.now();
    const leaks = [];

    for (const [resourceId, resourceInfo] of this.resources) {
      const age = now - resourceInfo.registeredAt;
      if (age > maxAgeMs) {
        leaks.push({
          resourceId,
          type: resourceInfo.type,
          age,
          ageMinutes: Math.round(age / 60000),
          registeredAt: resourceInfo.registeredAt
        });
      }
    }

    if (leaks.length > 0) {
      console.warn(`[MEMORY_MANAGER:${this.componentId}] Potential memory leaks detected:`, leaks);
    }

    return leaks;
  }
}

/**
 * Memory usage tracker for monitoring application memory health
 */
export class MemoryUsageTracker {
  constructor() {
    this.baseline = null;
    this.history = [];
    this.maxHistorySize = 100;
    this.alertThreshold = 0.8; // 80% of heap limit
    this.growthWarningThreshold = 50; // 50MB growth warning
  }

  /**
   * Initialize baseline memory measurement
   */
  initializeBaseline() {
    if (performance.memory) {
      this.baseline = {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit,
        timestamp: Date.now()
      };
      console.log('[MEMORY_TRACKER] Baseline established:', this.formatMemory(this.baseline.used));
    }
  }

  /**
   * Record current memory usage
   */
  recordUsage() {
    if (!performance.memory) return null;

    const current = {
      used: performance.memory.usedJSHeapSize,
      total: performance.memory.totalJSHeapSize,
      limit: performance.memory.jsHeapSizeLimit,
      timestamp: Date.now()
    };

    this.history.push(current);

    // Maintain history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    // Check for memory issues
    this.checkMemoryHealth(current);

    return current;
  }

  /**
   * Check memory health and issue warnings if needed
   * @param {Object} current - Current memory measurements
   */
  checkMemoryHealth(current) {
    const usageRatio = current.used / current.limit;

    // Critical memory usage warning
    if (usageRatio > this.alertThreshold) {
      console.error('[MEMORY_TRACKER] ⚠️ CRITICAL: High memory usage detected:', {
        usage: this.formatMemory(current.used),
        usageRatio: `${(usageRatio * 100).toFixed(1)}%`,
        limit: this.formatMemory(current.limit)
      });
    }

    // Memory growth warning
    if (this.baseline) {
      const growth = current.used - this.baseline.used;
      const growthMB = growth / 1024 / 1024;

      if (growthMB > this.growthWarningThreshold) {
        console.warn('[MEMORY_TRACKER] 📈 Memory growth warning:', {
          growth: `${growthMB.toFixed(1)}MB`,
          baseline: this.formatMemory(this.baseline.used),
          current: this.formatMemory(current.used),
          timeSinceBaseline: `${Math.round((current.timestamp - this.baseline.timestamp) / 60000)}min`
        });
      }
    }
  }

  /**
   * Get memory usage statistics
   * @returns {Object} Memory usage statistics
   */
  getStats() {
    if (this.history.length === 0) return null;

    const recent = this.history.slice(-10); // Last 10 measurements
    const averageGrowth = this.calculateAverageGrowth(recent);

    return {
      current: this.history[this.history.length - 1],
      baseline: this.baseline,
      averageGrowth,
      measurementsCount: this.history.length,
      memoryPressure: this.calculateMemoryPressure()
    };
  }

  /**
   * Calculate average memory growth rate
   * @param {Array} measurements - Memory measurements
   * @returns {Object} Growth statistics
   */
  calculateAverageGrowth(measurements) {
    if (measurements.length < 2) return { rate: 0, trend: 'stable' };

    const first = measurements[0];
    const last = measurements[measurements.length - 1];
    const timeDiff = (last.timestamp - first.timestamp) / 1000; // seconds
    const memoryDiff = last.used - first.used;

    const rate = timeDiff > 0 ? memoryDiff / timeDiff : 0; // bytes per second
    const trend = rate > 1024 * 1024 ? 'growing' : rate < -1024 * 1024 ? 'shrinking' : 'stable';

    return { rate, trend, rateMBps: rate / 1024 / 1024 };
  }

  /**
   * Calculate current memory pressure (0-1 scale)
   * @returns {number} Memory pressure ratio
   */
  calculateMemoryPressure() {
    if (!performance.memory) return 0;

    const current = performance.memory.usedJSHeapSize;
    const limit = performance.memory.jsHeapSizeLimit;

    return current / limit;
  }

  /**
   * Format memory size for human-readable output
   * @param {number} bytes - Memory size in bytes
   * @returns {string} Formatted memory string
   */
  formatMemory(bytes) {
    const mb = bytes / 1024 / 1024;
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)}GB`;
    }
    return `${mb.toFixed(1)}MB`;
  }
}

/**
 * Global memory tracker instance
 */
export const globalMemoryTracker = new MemoryUsageTracker();

/**
 * Convenience functions for common cleanup patterns
 */

/**
 * Create cleanup manager for a component
 * @param {string} componentId - Unique component identifier
 * @param {string} componentType - Component type for logging
 * @returns {ResourceCleanupManager} Cleanup manager instance
 */
export function createCleanupManager(componentId, componentType = 'component') {
  return new ResourceCleanupManager(componentId, componentType);
}

/**
 * Setup standardized component lifecycle cleanup
 * @param {ResourceCleanupManager} manager - Cleanup manager instance
 * @param {Object} resources - Component resources to manage
 */
export function setupComponentCleanup(manager, resources = {}) {
  const {
    canvas,
    ctx,
    interactable,
    zoomDetector,
    renderFrame,
    timeouts = [],
    intervals = [],
    subscriptions = [],
    eventListeners = []
  } = resources;

  // Register canvas and context cleanup
  if (canvas) {
    manager.registerResource('canvas', canvas, null, { id: 'main_canvas' });
  }

  if (ctx) {
    manager.registerResource('canvas', ctx, null, { id: 'canvas_context' });
  }

  // Register interactable cleanup
  if (interactable) {
    manager.registerResource('interactable', interactable, null, { id: 'main_interactable' });
  }

  // Register zoom detector cleanup
  if (zoomDetector) {
    manager.registerResource('zoomDetector', zoomDetector, null, { id: 'zoom_detector' });
  }

  // Register animation frame cleanup
  if (renderFrame) {
    manager.registerResource('animationFrame', renderFrame, null, { id: 'render_frame' });
  }

  // Register timeout cleanups
  timeouts.forEach((timeout, index) => {
    if (timeout) {
      manager.registerResource('timeout', timeout, null, { id: `timeout_${index}` });
    }
  });

  // Register interval cleanups
  intervals.forEach((interval, index) => {
    if (interval) {
      manager.registerResource('interval', interval, null, { id: `interval_${index}` });
    }
  });

  // Register subscription cleanups
  subscriptions.forEach((subscription, index) => {
    if (subscription) {
      manager.registerResource('subscription', subscription, null, { id: `subscription_${index}` });
    }
  });

  // Register event listener cleanups
  eventListeners.forEach((listener, index) => {
    if (listener && listener.target && listener.handler) {
      manager.registerResource('eventListener', listener, null, { id: `event_listener_${index}` });
    }
  });
}

/**
 * Initialize global memory tracking
 */
export function initializeMemoryTracking() {
  globalMemoryTracker.initializeBaseline();

  // Record memory usage every 30 seconds
  setInterval(() => {
    globalMemoryTracker.recordUsage();
  }, 30000);

  console.log('[MEMORY_TRACKER] Global memory tracking initialized');
}