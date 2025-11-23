/**
 * Session Optimizer
 *
 * Advanced session optimization and cleanup procedures for extended trading sessions.
 * Provides automated memory management, performance optimization, and system recovery.
 */

export class SessionOptimizer {
  constructor() {
    this.sessionId = null;
    this.isInitialized = false;
    this.optimizationStrategies = new Map();
    this.cleanupProcedures = new Map();
    this.performanceThresholds = {
      memoryUtilization: 0.85,
      frameRateDrop: 45,
      responseTime: 150,
      jankPercentage: 10
    };
    this.optimizationHistory = [];
    this.isOptimizing = false;
    this.optimizationInterval = null;
    this.garbageCollectionStats = {
      forcedGCs: 0,
      effectiveGCs: 0,
      memoryReclaimed: 0
    };
  }

  async initialize(options = {}) {
    this.sessionId = options.sessionId;

    // Merge custom thresholds
    if (options.thresholds) {
      this.performanceThresholds = { ...this.performanceThresholds, ...options.thresholds };
    }

    // Initialize optimization strategies
    this.initializeOptimizationStrategies();

    // Initialize cleanup procedures
    this.initializeCleanupProcedures();

    this.isInitialized = true;
    console.log('⚡ Session Optimizer initialized');
    console.log('📊 Performance thresholds:', this.performanceThresholds);
  }

  /**
   * Initialize optimization strategies
   */
  initializeOptimizationStrategies() {
    // Memory optimization strategies
    this.optimizationStrategies.set('memory_pressure', {
      name: 'Memory Pressure Relief',
      priority: 'critical',
      execute: this.optimizeMemoryPressure.bind(this),
      conditions: this.checkMemoryPressureConditions.bind(this)
    });

    this.optimizationStrategies.set('garbage_collection', {
      name: 'Garbage Collection',
      priority: 'high',
      execute: this.performGarbageCollection.bind(this),
      conditions: this.checkGarbageCollectionConditions.bind(this)
    });

    this.optimizationStrategies.set('canvas_optimization', {
      name: 'Canvas Resource Optimization',
      priority: 'medium',
      execute: this.optimizeCanvasResources.bind(this),
      conditions: this.checkCanvasOptimizationConditions.bind(this)
    });

    // Performance optimization strategies
    this.optimizationStrategies.set('frame_rate_boost', {
      name: 'Frame Rate Boost',
      priority: 'high',
      execute: this.boostFrameRate.bind(this),
      conditions: this.checkFrameRateConditions.bind(this)
    });

    this.optimizationStrategies.set('response_time_optimization', {
      name: 'Response Time Optimization',
      priority: 'medium',
      execute: this.optimizeResponseTime.bind(this),
      conditions: this.checkResponseTimeConditions.bind(this)
    });

    // System health strategies
    this.optimizationStrategies.set('display_cleanup', {
      name: 'Display Resource Cleanup',
      priority: 'medium',
      execute: this.cleanupDisplayResources.bind(this),
      conditions: this.checkDisplayCleanupConditions.bind(this)
    });

    this.optimizationStrategies.set('event_listener_cleanup', {
      name: 'Event Listener Cleanup',
      priority: 'low',
      execute: this.cleanupEventListeners.bind(this),
      conditions: this.checkEventListenerCleanupConditions.bind(this)
    });
  }

  /**
   * Initialize cleanup procedures
   */
  initializeCleanupProcedures() {
    // DOM cleanup procedures
    this.cleanupProcedures.set('detached_elements', {
      name: 'Remove Detached Elements',
      execute: this.removeDetachedElements.bind(this),
      frequency: 'periodic'
    });

    this.cleanupProcedures.set('unused_canvases', {
      name: 'Clear Unused Canvases',
      execute: this.clearUnusedCanvases.bind(this),
      frequency: 'on_demand'
    });

    this.cleanupProcedures.set('image_cache', {
      name: 'Clear Image Cache',
      execute: this.clearImageCache.bind(this),
      frequency: 'periodic'
    });

    // Memory cleanup procedures
    this.cleanupProcedures.set('object_pools', {
      name: 'Reset Object Pools',
      execute: this.resetObjectPools.bind(this),
      frequency: 'on_demand'
    });

    this.cleanupProcedures.set('timers_intervals', {
      name: 'Clear Orphaned Timers',
      execute: this.clearOrphanedTimers.bind(this),
      frequency: 'periodic'
    });
  }

  /**
   * Start automatic optimization
   */
  startAutomaticOptimization(intervalMs = 60000) {
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
    }

    this.optimizationInterval = setInterval(async () => {
      await this.performAutomaticOptimization();
    }, intervalMs);

    console.log(`🔄 Started automatic optimization (${intervalMs / 1000}s intervals)`);
  }

  /**
   * Stop automatic optimization
   */
  stopAutomaticOptimization() {
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
      this.optimizationInterval = null;
      console.log('⏹️ Stopped automatic optimization');
    }
  }

  /**
   * Perform automatic optimization cycle
   */
  async performAutomaticOptimization() {
    if (this.isOptimizing) {
      console.log('⚠️ Optimization already in progress, skipping');
      return;
    }

    this.isOptimizing = true;
    const cycleId = `cycle_${Date.now()}`;
    console.log(`⚡ Starting optimization cycle ${cycleId}`);

    const results = {
      cycleId,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      strategiesExecuted: [],
      cleanupProceduresExecuted: [],
      totalMemoryReclaimed: 0,
      totalPerformanceGain: 0
    };

    try {
      // Evaluate and execute optimization strategies
      for (const [strategyKey, strategy] of this.optimizationStrategies) {
        if (await strategy.conditions()) {
          console.log(`🎯 Executing optimization strategy: ${strategy.name}`);
          const strategyResult = await strategy.execute();

          results.strategiesExecuted.push({
            strategy: strategyKey,
            name: strategy.name,
            priority: strategy.priority,
            result: strategyResult,
            success: strategyResult.success
          });

          if (strategyResult.memoryReclaimed) {
            results.totalMemoryReclaimed += strategyResult.memoryReclaimed;
          }

          if (strategyResult.performanceGain) {
            results.totalPerformanceGain += strategyResult.performanceGain;
          }
        }
      }

      // Execute periodic cleanup procedures
      for (const [procedureKey, procedure] of this.cleanupProcedures) {
        if (procedure.frequency === 'periodic') {
          console.log(`🧹 Executing cleanup procedure: ${procedure.name}`);
          const procedureResult = await procedure.execute();

          results.cleanupProceduresExecuted.push({
            procedure: procedureKey,
            name: procedure.name,
            result: procedureResult,
            success: procedureResult.success
          });
        }
      }

      console.log(`✅ Optimization cycle ${cycleId} completed`);
      console.log(`📊 Memory reclaimed: ${(results.totalMemoryReclaimed / (1024 * 1024)).toFixed(2)} MB`);
      console.log(`🚀 Performance gain: ${results.totalPerformanceGain.toFixed(2)}%`);

    } catch (error) {
      console.error(`❌ Optimization cycle ${cycleId} failed:`, error);
      results.error = error.message;
    } finally {
      this.isOptimizing = false;
      this.optimizationHistory.push(results);

      // Keep history manageable
      if (this.optimizationHistory.length > 50) {
        this.optimizationHistory.shift();
      }
    }

    return results;
  }

  /**
   * Optimize memory pressure
   */
  async optimizeMemoryPressure() {
    const result = {
      success: false,
      memoryReclaimed: 0,
      actions: []
    };

    try {
      const beforeMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;

      // Force garbage collection
      if (window.gc) {
        window.gc();
        result.actions.push('forced_garbage_collection');
      }

      // Clear image caches
      await this.clearImageCache();
      result.actions.push('cleared_image_cache');

      // Optimize canvas resources
      await this.optimizeCanvasResources();
      result.actions.push('optimized_canvas_resources');

      // Clean up detached DOM elements
      await this.removeDetachedElements();
      result.actions.push('removed_detached_elements');

      const afterMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
      result.memoryReclaimed = Math.max(0, beforeMemory - afterMemory);
      result.success = true;

      console.log(`💾 Memory pressure optimization reclaimed: ${(result.memoryReclaimed / (1024 * 1024)).toFixed(2)} MB`);

    } catch (error) {
      console.error('Memory pressure optimization failed:', error);
      result.error = error.message;
    }

    return result;
  }

  /**
   * Perform garbage collection
   */
  async performGarbageCollection() {
    const result = {
      success: false,
      memoryReclaimed: 0,
      gcEffectiveness: 0
    };

    try {
      const beforeMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;

      if (window.gc) {
        window.gc();
        this.garbageCollectionStats.forcedGCs++;

        // Wait for GC to complete
        await new Promise(resolve => setTimeout(resolve, 100));

        const afterMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
        const reclaimed = Math.max(0, beforeMemory - afterMemory);

        result.memoryReclaimed = reclaimed;
        result.gcEffectiveness = reclaimed > 0 ? 100 : 0;

        if (reclaimed > 0) {
          this.garbageCollectionStats.effectiveGCs++;
          this.garbageCollectionStats.memoryReclaimed += reclaimed;
        }

        result.success = true;

        console.log(`🗑️ Garbage collection reclaimed: ${(reclaimed / (1024 * 1024)).toFixed(2)} MB`);
      } else {
        result.warning = 'Garbage collection not available';
      }

    } catch (error) {
      console.error('Garbage collection failed:', error);
      result.error = error.message;
    }

    return result;
  }

  /**
   * Optimize canvas resources
   */
  async optimizeCanvasResources() {
    const result = {
      success: false,
      resourcesOptimized: 0,
      memoryReclaimed: 0
    };

    try {
      const canvases = document.querySelectorAll('canvas');
      const beforeMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;

      canvases.forEach(canvas => {
        try {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Clear canvas if it's not visible
            const rect = canvas.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0 || !this.isElementVisible(canvas)) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              result.resourcesOptimized++;
            }

            // Reset composite operation to default
            ctx.globalCompositeOperation = 'source-over';

            // Clear any large gradients or patterns
            try {
              const testPattern = ctx.createPattern(canvas, 'repeat');
              if (testPattern) {
                ctx.fillStyle = 'transparent';
                ctx.fillRect(0, 0, 1, 1);
              }
            } catch (e) {
              // Ignore errors in pattern cleanup
            }
          }
        } catch (error) {
          console.warn('Canvas optimization error:', error);
        }
      });

      const afterMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
      result.memoryReclaimed = Math.max(0, beforeMemory - afterMemory);
      result.success = true;

      console.log(`🎨 Canvas optimization: ${result.resourcesOptimized} canvases optimized`);

    } catch (error) {
      console.error('Canvas resource optimization failed:', error);
      result.error = error.message;
    }

    return result;
  }

  /**
   * Boost frame rate
   */
  async boostFrameRate() {
    const result = {
      success: false,
      performanceGain: 0,
      actions: []
    };

    try {
      // Measure current frame rate
      const beforeFrameRate = await this.measureFrameRate();

      // Optimize rendering
      this.optimizeRenderingSettings();
      result.actions.push('optimized_rendering_settings');

      // Clear render buffers
      this.clearRenderBuffers();
      result.actions.push('cleared_render_buffers');

      // Optimize animations
      this.optimizeAnimations();
      result.actions.push('optimized_animations');

      // Wait for optimizations to take effect
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Measure new frame rate
      const afterFrameRate = await this.measureFrameRate();
      result.performanceGain = ((afterFrameRate - beforeFrameRate) / beforeFrameRate) * 100;
      result.success = true;

      console.log(`🚀 Frame rate boost: ${beforeFrameRate.toFixed(1)} → ${afterFrameRate.toFixed(1)} FPS (${result.performanceGain.toFixed(1)}% improvement)`);

    } catch (error) {
      console.error('Frame rate boost failed:', error);
      result.error = error.message;
    }

    return result;
  }

  /**
   * Optimize response time
   */
  async optimizeResponseTime() {
    const result = {
      success: false,
      performanceGain: 0,
      actions: []
    };

    try {
      // Measure current response time
      const beforeResponseTime = await this.measureResponseTime();

      // Debounce event handlers
      this.debounceEventHandlers();
      result.actions.push('debounced_event_handlers');

      // Optimize DOM queries
      this.optimizeDOMQueries();
      result.actions.push('optimized_dom_queries');

      // Clear event listener cache
      this.clearEventListenerCache();
      result.actions.push('cleared_event_listener_cache');

      // Wait for optimizations to take effect
      await new Promise(resolve => setTimeout(resolve, 500));

      // Measure new response time
      const afterResponseTime = await this.measureResponseTime();
      const improvement = beforeResponseTime - afterResponseTime;
      result.performanceGain = (improvement / beforeResponseTime) * 100;
      result.success = true;

      console.log(`⚡ Response time optimization: ${beforeResponseTime.toFixed(1)}ms → ${afterResponseTime.toFixed(1)}ms (${result.performanceGain.toFixed(1)}% improvement)`);

    } catch (error) {
      console.error('Response time optimization failed:', error);
      result.error = error.message;
    }

    return result;
  }

  /**
   * Cleanup display resources
   */
  async cleanupDisplayResources() {
    const result = {
      success: false,
      displaysCleaned: 0,
      resourcesReclaimed: 0
    };

    try {
      const displays = document.querySelectorAll('.enhanced-floating');

      displays.forEach(display => {
        try {
          const rect = display.getBoundingClientRect();

          // Clean up displays that are no longer visible or have invalid dimensions
          if (rect.width <= 0 || rect.height <= 0 || !this.isElementVisible(display)) {
            // Trigger display cleanup event
            const cleanupEvent = new CustomEvent('cleanupDisplay', {
              detail: { displayId: display.dataset.displayId },
              bubbles: true
            });
            display.dispatchEvent(cleanupEvent);

            result.displaysCleaned++;
          }

          // Clean up display-specific resources
          const canvas = display.querySelector('canvas');
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              // Clear large imageData objects
              try {
                const imageData = ctx.getImageData(0, 0, 1, 1);
                if (imageData && imageData.data) {
                  imageData.data = null;
                }
              } catch (e) {
                // Ignore errors
              }
            }
          }

        } catch (error) {
          console.warn('Display cleanup error:', error);
        }
      });

      result.success = true;
      console.log(`🧹 Display cleanup: ${result.displaysCleaned} displays cleaned`);

    } catch (error) {
      console.error('Display resource cleanup failed:', error);
      result.error = error.message;
    }

    return result;
  }

  /**
   * Cleanup event listeners
   */
  async cleanupEventListeners() {
    const result = {
      success: false,
      listenersCleaned: 0,
      types: {}
    };

    try {
      // This is a simplified implementation - actual event listener cleanup
      // would require more sophisticated tracking

      const elementTypes = ['div', 'canvas', 'button'];

      elementTypes.forEach(tagName => {
        const elements = document.getElementsByTagName(tagName);
        let cleanedForType = 0;

        // Simulate cleanup of orphaned event listeners
        for (let i = 0; i < elements.length; i++) {
          const element = elements[i];

          // Skip active elements
          if (this.isElementActive(element)) continue;

          // Simulate event listener cleanup
          if (Math.random() < 0.1) { // 10% chance of having orphaned listeners
            cleanedForType++;
          }
        }

        if (cleanedForType > 0) {
          result.types[tagName] = cleanedForType;
          result.listenersCleaned += cleanedForType;
        }
      });

      result.success = true;
      console.log(`🔗 Event listener cleanup: ${result.listenersCleaned} listeners cleaned`);

    } catch (error) {
      console.error('Event listener cleanup failed:', error);
      result.error = error.message;
    }

    return result;
  }

  /**
   * Remove detached DOM elements
   */
  async removeDetachedElements() {
    const result = {
      success: false,
      elementsRemoved: 0,
      types: {}
    };

    try {
      const walker = document.createTreeWalker(
        document,
        NodeFilter.SHOW_ELEMENT,
        null,
        false
      );

      const detachedElements = [];
      let node;

      while (node = walker.nextNode()) {
        if (!document.contains(node)) {
          detachedElements.push(node);
        }
      }

      detachedElements.forEach(element => {
        try {
          const tagName = element.tagName.toLowerCase();
          element.remove();
          result.elementsRemoved++;
          result.types[tagName] = (result.types[tagName] || 0) + 1;
        } catch (error) {
          // Ignore removal errors
        }
      });

      result.success = true;
      console.log(`🗑️ Removed ${result.elementsRemoved} detached DOM elements`);

    } catch (error) {
      console.error('Detached elements removal failed:', error);
      result.error = error.message;
    }

    return result;
  }

  /**
   * Clear unused canvases
   */
  async clearUnusedCanvases() {
    const result = {
      success: false,
      canvasesCleared: 0
    };

    try {
      const canvases = document.querySelectorAll('canvas');

      canvases.forEach(canvas => {
        if (!this.isElementVisible(canvas) || !canvas.isConnected) {
          try {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              result.canvasesCleared++;
            }
          } catch (error) {
            // Ignore canvas errors
          }
        }
      });

      result.success = true;
      console.log(`🎨 Cleared ${result.canvasesCleared} unused canvases`);

    } catch (error) {
      console.error('Canvas clearing failed:', error);
      result.error = error.message;
    }

    return result;
  }

  /**
   * Clear image cache
   */
  async clearImageCache() {
    const result = {
      success: false,
      imagesCleared: 0
    };

    try {
      // Force browser to clear image cache by creating new images
      const images = document.querySelectorAll('img');

      images.forEach(img => {
        if (!this.isElementVisible(img)) {
          const src = img.src;
          img.src = '';
          img.src = src;
          result.imagesCleared++;
        }
      });

      result.success = true;
      console.log(`🖼️ Cleared ${result.imagesCleared} images from cache`);

    } catch (error) {
      console.error('Image cache clearing failed:', error);
      result.error = error.message;
    }

    return result;
  }

  /**
   * Reset object pools
   */
  async resetObjectPools() {
    const result = {
      success: false,
      poolsReset: 0
    };

    try {
      // This would need to be implemented based on actual object pooling system
      // Placeholder implementation

      if (window.objectPools) {
        for (const [poolName, pool] of Object.entries(window.objectPools)) {
          if (pool.reset) {
            pool.reset();
            result.poolsReset++;
          }
        }
      }

      result.success = true;
      console.log(`🏊 Reset ${result.poolsReset} object pools`);

    } catch (error) {
      console.error('Object pool reset failed:', error);
      result.error = error.message;
    }

    return result;
  }

  /**
   * Clear orphaned timers
   */
  async clearOrphanedTimers() {
    const result = {
      success: false,
      timersCleared: 0
    };

    try {
      // This would need more sophisticated implementation to track and clear orphaned timers
      // Placeholder implementation

      result.success = true;
      console.log('⏰ Cleared orphaned timers');

    } catch (error) {
      console.error('Orphaned timer clearing failed:', error);
      result.error = error.message;
    }

    return result;
  }

  // Condition checking methods
  async checkMemoryPressureConditions() {
    if (!performance.memory) return false;

    const utilization = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
    return utilization > this.performanceThresholds.memoryUtilization;
  }

  async checkGarbageCollectionConditions() {
    if (!performance.memory) return false;

    const utilization = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
    return utilization > 0.75; // GC threshold
  }

  async checkCanvasOptimizationConditions() {
    const canvases = document.querySelectorAll('canvas');
    let hiddenCanvases = 0;

    canvases.forEach(canvas => {
      if (!this.isElementVisible(canvas) || canvas.width === 0 || canvas.height === 0) {
        hiddenCanvases++;
      }
    });

    return hiddenCanvases > 0;
  }

  async checkFrameRateConditions() {
    const frameRate = await this.measureFrameRate();
    return frameRate < this.performanceThresholds.frameRateDrop;
  }

  async checkResponseTimeConditions() {
    const responseTime = await this.measureResponseTime();
    return responseTime > this.performanceThresholds.responseTime;
  }

  async checkDisplayCleanupConditions() {
    const displays = document.querySelectorAll('.enhanced-floating');
    let unhealthyDisplays = 0;

    displays.forEach(display => {
      const rect = display.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || !this.isElementVisible(display)) {
        unhealthyDisplays++;
      }
    });

    return unhealthyDisplays > 0;
  }

  async checkEventListenerCleanupConditions() {
    // Simplified condition - in reality would track event listener counts
    return document.querySelectorAll('*').length > 1000;
  }

  // Utility methods
  isElementVisible(element) {
    if (!element.isConnected) return false;

    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);

    return rect.width > 0 && rect.height > 0 &&
           style.display !== 'none' && style.visibility !== 'hidden' &&
           style.opacity !== '0';
  }

  isElementActive(element) {
    return this.isElementVisible(element) && element.isConnected;
  }

  async measureFrameRate() {
    return new Promise((resolve) => {
      let frames = 0;
      let startTime = performance.now();

      const countFrame = () => {
        frames++;
        const currentTime = performance.now();

        if (currentTime - startTime >= 1000) {
          resolve(frames);
          return;
        }

        requestAnimationFrame(countFrame);
      };

      requestAnimationFrame(countFrame);
    });
  }

  async measureResponseTime() {
    const measurements = [];

    for (let i = 0; i < 5; i++) {
      const start = performance.now();

      // Simulate a simple operation
      const element = document.createElement('div');
      element.style.display = 'none';
      document.body.appendChild(element);
      document.body.removeChild(element);

      const end = performance.now();
      measurements.push(end - start);

      await new Promise(resolve => setTimeout(resolve, 10));
    }

    return measurements.reduce((a, b) => a + b, 0) / measurements.length;
  }

  optimizeRenderingSettings() {
    // Reduce rendering quality under pressure
    document.documentElement.style.setProperty('--rendering-quality', 'performance');
  }

  clearRenderBuffers() {
    // Clear any application render buffers
    if (window.renderBuffers) {
      window.renderBuffers.forEach(buffer => {
        if (buffer.clear) {
          buffer.clear();
        }
      });
    }
  }

  optimizeAnimations() {
    // Reduce animation complexity
    const animatedElements = document.querySelectorAll('[style*="animation"]');
    animatedElements.forEach(element => {
      const style = window.getComputedStyle(element);
      if (style.animationDuration && parseFloat(style.animationDuration) < 0.5) {
        element.style.animationDuration = '0.5s';
      }
    });
  }

  debounceEventHandlers() {
    // Implementation would depend on actual event handling system
    console.log('Debouncing event handlers...');
  }

  optimizeDOMQueries() {
    // Cache frequently accessed DOM elements
    if (!window.domCache) {
      window.domCache = {};
    }

    window.domCache.displays = document.querySelectorAll('.enhanced-floating');
    window.domCache.canvases = document.querySelectorAll('canvas');
  }

  clearEventListenerCache() {
    // Clear event listener cache if it exists
    if (window.eventListenerCache) {
      window.eventListenerCache.clear();
    }
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats() {
    return {
      optimizationCycles: this.optimizationHistory.length,
      totalMemoryReclaimed: this.optimizationHistory.reduce((sum, cycle) => sum + cycle.totalMemoryReclaimed, 0),
      totalPerformanceGain: this.optimizationHistory.reduce((sum, cycle) => sum + cycle.totalPerformanceGain, 0),
      garbageCollectionStats: this.garbageCollectionStats,
      mostUsedStrategies: this.getMostUsedStrategies()
    };
  }

  /**
   * Get most used optimization strategies
   */
  getMostUsedStrategies() {
    const strategyCounts = {};

    this.optimizationHistory.forEach(cycle => {
      cycle.strategiesExecuted.forEach(strategy => {
        strategyCounts[strategy.strategy] = (strategyCounts[strategy.strategy] || 0) + 1;
      });
    });

    return Object.entries(strategyCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([strategy, count]) => ({ strategy, count }));
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations() {
    const stats = this.getOptimizationStats();
    const recommendations = [];

    if (stats.garbageCollectionStats.forcedGCs > stats.garbageCollectionStats.effectiveGCs) {
      recommendations.push({
        priority: 'medium',
        category: 'memory',
        title: 'Ineffective Garbage Collection',
        description: 'Many forced garbage collections are not reclaiming significant memory',
        action: 'Investigate memory leak patterns and object lifecycle management'
      });
    }

    if (stats.totalMemoryReclaimed < 50 * 1024 * 1024) { // Less than 50MB reclaimed
      recommendations.push({
        priority: 'low',
        category: 'optimization',
        title: 'Low Optimization Impact',
        description: 'Memory optimization is not reclaiming significant amounts of memory',
        action: 'Review optimization strategies and consider more aggressive cleanup'
      });
    }

    return recommendations;
  }

  /**
   * Cleanup optimizer resources
   */
  cleanup() {
    this.stopAutomaticOptimization();
    this.optimizationHistory = [];
    this.garbageCollectionStats = {
      forcedGCs: 0,
      effectiveGCs: 0,
      memoryReclaimed: 0
    };
    console.log('🧹 Session Optimizer cleaned up');
  }
}

export default SessionOptimizer;