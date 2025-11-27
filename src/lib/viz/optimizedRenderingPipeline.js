/**
 * Optimized Rendering Pipeline Integration
 *
 * Phase 2: Rendering Optimization Pipeline - Complete Integration
 * Integrates dirty rectangle rendering, canvas caching, frame scheduling,
 * and visualization optimization with the existing Container.svelte architecture.
 *
 * ARCHITECTURE:
 * - Unified pipeline orchestration
 * - Seamless integration with Container.svelte modular architecture
 * - Performance monitoring and automatic optimization
 * - Backward compatibility with existing rendering functions
 *
 * PERFORMANCE TARGETS:
 * - Sub-100ms data-to-visual latency across all visualizations
 * - Consistent 60fps rendering during active trading
 * - Support for 20+ concurrent displays without degradation
 * - Memory stability during extended trading sessions
 */

import { createDirtyRectRenderingIntegration } from './dirtyRectangleRendering.js';
import { createCanvasCacheIntegration } from './canvasCaching.js';
import { createFrameSchedulingIntegration } from './frameScheduler.js';
import { createVisualizationOptimizer, createOptimizedScaleFactory, optimizeVisualizationFunction } from './visualizationOptimizer.js';

// Error boundary utilities
import {
  withErrorBoundary,
  withAsyncErrorBoundary,
  memorySafeErrorHandler,
  getContextualFallback,
  SAFE_DEFAULTS,
  CircuitBreaker
} from '../../utils/errorBoundaryUtils.js';

/**
 * Complete optimized rendering pipeline
 */
export class OptimizedRenderingPipeline {
  constructor(options = {}) {
    try {
      this.options = {
        enableDirtyRectangles: options.enableDirtyRectangles !== false,
        enableCaching: options.enableCaching !== false,
        enableFrameScheduling: options.enableFrameScheduling !== false,
        enableVisualizationOptimization: options.enableVisualizationOptimization !== false,
        debugLogging: options.debugLogging || false,
        performanceMonitoring: options.performanceMonitoring !== false,
        ...options
      };

      this.isInitialized = false;
      this.containerId = null;
      this.renderingContext = null;
      this.circuitBreaker = new CircuitBreaker({ failureThreshold: 5, recoveryTime: 30000 });

      // Initialize all optimization systems with error handling
      this.optimizationSystems = {};

      if (this.options.enableDirtyRectangles) {
        try {
          this.optimizationSystems.dirtyRectangles = createDirtyRectRenderingIntegration({
            debugLogging: this.options.debugLogging,
            performanceTracking: this.options.performanceMonitoring
          });
        } catch (dirtyRectError) {
          memorySafeErrorHandler('OptimizedRenderingPipeline.dirtyRectangles', dirtyRectError);
          console.warn('[OPTIMIZED_PIPELINE] Dirty rectangle initialization failed, continuing without it');
        }
      }

      if (this.options.enableCaching) {
        try {
          this.optimizationSystems.cache = createCanvasCacheIntegration({
            maxEntries: options.maxCacheEntries || 50,
            maxMemoryMB: options.maxCacheMemoryMB || 50,
            debugLogging: this.options.debugLogging
          });
        } catch (cacheError) {
          memorySafeErrorHandler('OptimizedRenderingPipeline.cache', cacheError);
          console.warn('[OPTIMIZED_PIPELINE] Canvas cache initialization failed, continuing without it');
        }
      }

      try {
        this.optimizationSystems.scheduler = createFrameSchedulingIntegration({
          debugLogging: this.options.debugLogging,
          targetFrameTime: 16.67
        });
      } catch (schedulerError) {
        memorySafeErrorHandler('OptimizedRenderingPipeline.scheduler', schedulerError);
        console.warn('[OPTIMIZED_PIPELINE] Frame scheduler initialization failed, continuing without it');
      }
    }

    try {
      if (this.options.enableVisualizationOptimization) {
        this.optimizationSystems.optimizer = createVisualizationOptimizer({
          enableScaleCaching: true,
          enableProfiling: this.options.performanceMonitoring,
          enableBoundsOptimization: true,
          maxCacheSize: 100,
          debugLogging: this.options.debugLogging
        });

          // Create optimized scale factory
        this.scaleFactory = createOptimizedScaleFactory(this.optimizationSystems.optimizer);
      }
    } catch (vizError) {
      memorySafeErrorHandler('OptimizedRenderingPipeline.visualization', vizError);
      console.warn('[OPTIMIZED_PIPELINE] Visualization optimization initialization failed, continuing without it');
    }

    // Pipeline state
    this.pipelineStats = {
      totalRenders: 0,
      optimizedRenders: 0,
      cacheHits: 0,
      cacheMisses: 0,
      dirtyRegionsProcessed: 0,
      averageRenderTime: 0,
      lastRenderTime: 0,
      renderTimeHistory: []
    };

    // Performance monitoring
    this.performanceThresholds = {
      targetRenderTime: 16.67,  // 60fps
      warningThreshold: 20.0,    // 50fps
      criticalThreshold: 33.33,  // 30fps
      maxRenderTimeHistory: 100
    };

    if (this.options.debugLogging) {
      console.log('[OptimizedRenderingPipeline] Initialized with options:', this.options);
    }

    // Wrap critical methods with error boundaries
    this.render = withErrorBoundary(
      this.render.bind(this),
      () => ({ success: false, fallback: true, renderTime: 0 }),
      'OptimizedRenderingPipeline.render'
    );

    this.cleanup = withErrorBoundary(
      this.cleanup.bind(this),
      () => {},
      'OptimizedRenderingPipeline.cleanup'
    );

    } catch (error) {
      memorySafeErrorHandler('OptimizedRenderingPipeline.constructor', error);

      // Fallback to basic non-optimized mode
      this.options = {
        enableDirtyRectangles: false,
        enableCaching: false,
        enableFrameScheduling: false,
        enableVisualizationOptimization: false,
        debugLogging: false,
        performanceMonitoring: false
      };

      this.isInitialized = false;
      this.optimizationSystems = {};
      this.pipelineStats = {
        totalRenders: 0,
        optimizedRenders: 0,
        cacheHits: 0,
        cacheMisses: 0,
        dirtyRegionsProcessed: 0,
        averageRenderTime: 0,
        lastRenderTime: 0,
        renderTimeHistory: []
      };

      console.warn('[OPTIMIZED_PIPELINE] Constructor failed, falling back to non-optimized mode');
    }
  }

  /**
   * Initialize pipeline with container context
   */
  initialize(containerId, renderingContext) {
    if (this.isInitialized) {
      console.warn('[OptimizedRenderingPipeline] Already initialized');
      return false;
    }

    this.containerId = containerId;
    this.renderingContext = renderingContext;

    // Start frame scheduler if enabled
    if (this.optimizationSystems.scheduler && !this.optimizationSystems.scheduler.scheduler.isRunning) {
      this.optimizationSystems.scheduler.start(() => {
        // Frame callback - could be used for background tasks
        this._processFrameTasks();
      });
    }

    this.isInitialized = true;

    if (this.options.debugLogging) {
      console.log(`[OptimizedRenderingPipeline] Initialized for container: ${containerId}`);
    }

    return true;
  }

  /**
   * Execute optimized rendering pipeline
   */
  executeOptimizedRender(ctx, originalRenderFunction, currentState, config) {
    if (!this.isInitialized) {
      console.error('[OptimizedRenderingPipeline] Not initialized');
      return originalRenderFunction(ctx, this.renderingContext, config, currentState);
    }

    const startTime = performance.now();
    let renderResult = { optimized: false, renderTime: 0 };

    try {
      // Create optimized rendering context
      const optimizedContext = this._createOptimizedRenderingContext(currentState, config);

      // Choose rendering strategy based on optimization systems
      if (this.options.enableDirtyRectangles && this.optimizationSystems.dirtyRectangles) {
        renderResult = this._executeSelectiveRender(ctx, originalRenderFunction, optimizedContext);
      } else {
        renderResult = this._executeFullRender(ctx, originalRenderFunction, optimizedContext);
      }

      // Update pipeline statistics
      this._updatePipelineStats(renderResult.renderTime, renderResult.optimized);

      // Performance monitoring and warnings
      this._checkPerformanceThresholds(renderResult.renderTime);

      return renderResult;

    } catch (error) {
      console.error('[OptimizedRenderingPipeline] Render error:', error);

      // Fallback to original render function
      const fallbackResult = originalRenderFunction(ctx, this.renderingContext, config, currentState);
      this._updatePipelineStats(performance.now() - startTime, false);

      return {
        optimized: false,
        renderTime: performance.now() - startTime,
        error: error.message,
        fallbackResult
      };
    }
  }

  /**
   * Invalidate regions for selective rendering
   */
  invalidateVisualization(vizType, bounds, reason) {
    if (this.optimizationSystems.dirtyRectangles) {
      return this.optimizationSystems.dirtyRectangles.invalidateVisualization(vizType, bounds, reason);
    }
    return false;
  }

  /**
   * Invalidate cached elements
   */
  invalidateCache(pattern = null, dependency = null) {
    if (this.optimizationSystems.cache) {
      return this.optimizationSystems.cache.invalidate(pattern, dependency);
    }
    return 0;
  }

  /**
   * Get cached background canvas
   */
  getCachedBackground(width, height, backgroundColor) {
    if (this.optimizationSystems.cache) {
      return this.optimizationSystems.cache.cacheBackground(width, height, backgroundColor);
    }
    return null;
  }

  /**
   * Get cached text canvas
   */
  getCachedText(text, fontConfig, color) {
    if (this.optimizationSystems.cache) {
      return this.optimizationSystems.cache.cacheText(text, fontConfig, color);
    }
    return null;
  }

  /**
   * Create optimized D3 scale
   */
  createOptimizedScale(type, domain, range, options = {}) {
    if (this.scaleFactory) {
      return this.scaleFactory[type](domain, range, options);
    }

    // Fallback to standard D3 scale
    const { scaleLinear, scaleLog } = require('d3-scale');
    switch (type) {
      case 'linear': return scaleLinear().domain(domain).range(range);
      case 'log': return scaleLog().domain(domain).range(range);
      default: return scaleLinear().domain(domain).range(range);
    }
  }

  /**
   * Schedule rendering task with priority
   */
  scheduleRenderTask(taskId, renderFunction, priority = 'normal') {
    if (this.optimizationSystems.scheduler) {
      switch (priority) {
        case 'critical':
          return this.optimizationSystems.scheduler.scheduleCriticalRender(taskId, renderFunction);
        case 'background':
          return this.optimizationSystems.scheduler.scheduleBackgroundRender(taskId, renderFunction);
        default:
          return this.optimizationSystems.scheduler.scheduleNormalRender(taskId, renderFunction);
      }
    }
    return false;
  }

  /**
   * Get comprehensive pipeline statistics
   */
  getPipelineStats() {
    const stats = {
      pipeline: { ...this.pipelineStats },
      systems: {},
      performance: {
        isHealthy: true,
        warnings: [],
        grade: 'A'
      }
    };

    // Collect statistics from each optimization system
    if (this.optimizationSystems.dirtyRectangles) {
      stats.systems.dirtyRectangles = this.optimizationSystems.dirtyRectangles.getStats();
    }

    if (this.optimizationSystems.cache) {
      stats.systems.cache = this.optimizationSystems.cache.getStats();
    }

    if (this.optimizationSystems.scheduler) {
      stats.systems.scheduler = this.optimizationSystems.scheduler.getStats();
    }

    if (this.optimizationSystems.optimizer) {
      stats.systems.optimizer = this.optimizationSystems.optimizer.getStats();
    }

    // Performance analysis
    stats.performance = this._analyzeOverallPerformance(stats);

    return stats;
  }

  /**
   * Destroy pipeline and clean up resources
   */
  destroy() {
    if (!this.isInitialized) return;

    // Stop frame scheduler
    if (this.optimizationSystems.scheduler) {
      this.optimizationSystems.scheduler.stop();
    }

    // Clear caches
    if (this.optimizationSystems.cache) {
      this.optimizationSystems.cache.clear();
      this.optimizationSystems.cache.destroy();
    }

    // Clear optimization systems
    Object.values(this.optimizationSystems).forEach(system => {
      if (system.clear) system.clear();
      if (system.destroy) system.destroy();
    });

    this.optimizationSystems = {};
    this.isInitialized = false;

    if (this.options.debugLogging) {
      console.log(`[OptimizedRenderingPipeline] Destroyed for container: ${this.containerId}`);
    }
  }

  /**
   * Execute selective rendering using dirty rectangles
   */
  _executeSelectiveRender(ctx, renderFunction, optimizedContext) {
    return this.optimizationSystems.dirtyRectangles.executeRender(
      ctx,
      () => renderFunction(ctx, optimizedContext, optimizedContext.config, optimizedContext.state),
      optimizedContext.contentArea.width,
      optimizedContext.contentArea.height,
      optimizedContext
    );
  }

  /**
   * Execute full canvas rendering
   */
  _executeFullRender(ctx, renderFunction, optimizedContext) {
    const startTime = performance.now();

    // Clear canvas using cached background if available
    if (this.optimizationSystems.cache) {
      const bgCanvas = this.getCachedBackground(
        optimizedContext.contentArea.width,
        optimizedContext.contentArea.height,
        '#111827'
      );

      if (bgCanvas) {
        ctx.drawImage(bgCanvas, 0, 0);
      } else {
        // Fallback clear
        ctx.clearRect(0, 0, optimizedContext.contentArea.width, optimizedContext.contentArea.height);
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 0, optimizedContext.contentArea.width, optimizedContext.contentArea.height);
      }
    }

    // Execute original render function
    renderFunction(ctx, optimizedContext, optimizedContext.config, optimizedContext.state);

    const renderTime = performance.now() - startTime;
    return { optimized: true, renderTime, type: 'full' };
  }

  /**
   * Create optimized rendering context with pre-computed values
   */
  _createOptimizedRenderingContext(state, config) {
    const context = {
      ...this.renderingContext,
      state,
      config,
      // Optimization systems
      cache: this.optimizationSystems.cache,
      optimizer: this.optimizationSystems.optimizer,
      scaleFactory: this.scaleFactory
    };

    // Add pre-computed values if optimizer is available
    if (this.optimizationSystems.optimizer) {
      return this.optimizationSystems.optimizer.createOptimizedContext(context, state, config);
    }

    return context;
  }

  /**
   * Update pipeline statistics
   */
  _updatePipelineStats(renderTime, optimized) {
    this.pipelineStats.totalRenders++;
    this.pipelineStats.lastRenderTime = renderTime;

    if (optimized) {
      this.pipelineStats.optimizedRenders++;
    }

    // Update render time history
    this.pipelineStats.renderTimeHistory.push(renderTime);
    if (this.pipelineStats.renderTimeHistory.length > this.performanceThresholds.maxRenderTimeHistory) {
      this.pipelineStats.renderTimeHistory.shift();
    }

    // Update average render time
    const history = this.pipelineStats.renderTimeHistory;
    this.pipelineStats.averageRenderTime = history.reduce((a, b) => a + b, 0) / history.length;
  }

  /**
   * Check performance thresholds and issue warnings
   */
  _checkPerformanceThresholds(renderTime) {
    if (!this.options.debugLogging && !this.options.performanceMonitoring) return;

    const warnings = [];

    if (renderTime > this.performanceThresholds.criticalThreshold) {
      warnings.push(`Critical render time: ${renderTime.toFixed(2)}ms (target: ${this.performanceThresholds.targetFrameTime}ms)`);
    } else if (renderTime > this.performanceThresholds.warningThreshold) {
      warnings.push(`Slow render time: ${renderTime.toFixed(2)}ms (target: ${this.performanceThresholds.targetFrameTime}ms)`);
    }

    if (warnings.length > 0 && this.options.debugLogging) {
      console.warn(`[OptimizedRenderingPipeline] Performance warnings for ${this.containerId}:`, warnings);
    }
  }

  /**
   * Analyze overall pipeline performance
   */
  _analyzeOverallPerformance(stats) {
    const analysis = {
      isHealthy: true,
      warnings: [],
      grade: 'A',
      recommendations: []
    };

    // Analyze render times
    const avgRenderTime = this.pipelineStats.averageRenderTime;
    if (avgRenderTime > this.performanceThresholds.criticalThreshold) {
      analysis.isHealthy = false;
      analysis.grade = 'D';
      analysis.warnings.push(`Average render time too high: ${avgRenderTime.toFixed(2)}ms`);
      analysis.recommendations.push('Consider reducing visualization complexity or enabling more optimizations');
    } else if (avgRenderTime > this.performanceThresholds.warningThreshold) {
      analysis.grade = 'C';
      analysis.warnings.push(`Average render time elevated: ${avgRenderTime.toFixed(2)}ms`);
      analysis.recommendations.push('Monitor performance and consider additional optimizations');
    }

    // Analyze cache performance
    if (stats.systems.cache) {
      const cacheStats = stats.systems.cache;
      if (cacheStats.hitRate < 50) {
        analysis.warnings.push(`Low cache hit rate: ${cacheStats.hitRate.toFixed(1)}%`);
        analysis.recommendations.push('Review caching strategy and cache invalidation patterns');
      }
    }

    // Analyze optimization rate
    const optimizationRate = this.pipelineStats.totalRenders > 0
      ? (this.pipelineStats.optimizedRenders / this.pipelineStats.totalRenders) * 100
      : 0;

    if (optimizationRate < 80) {
      analysis.warnings.push(`Low optimization rate: ${optimizationRate.toFixed(1)}%`);
      analysis.recommendations.push('Check if optimization systems are properly configured');
    }

    return analysis;
  }

  /**
   * Process background frame tasks
   */
  _processFrameTasks() {
    // This could be used for background optimization tasks
    // such as cache warming, performance analysis, etc.
  }
}

/**
 * Factory function to create optimized rendering pipeline with default options
 */
export function createOptimizedRenderingPipeline(options = {}) {
  return new OptimizedRenderingPipeline(options);
}

/**
 * Integration utility for Container.svelte
 */
export function createContainerOptimization(options = {}) {
  const pipeline = createOptimizedRenderingPipeline(options);

  return {
    /**
     * Initialize optimization for Container.svelte
     */
    initialize: (containerId, renderingContext) => {
      return pipeline.initialize(containerId, renderingContext);
    },

    /**
     * Optimized draw function that replaces the original Container.svelte draw
     */
    optimizedDraw: (ctx, originalDrawFunction, currentState, renderingContext, config) => {
      return pipeline.executeOptimizedRender(ctx, originalDrawFunction, currentState, config);
    },

    /**
     * Invalidate visualization regions
     */
    invalidateVisualization: (vizType, bounds, reason) => {
      return pipeline.invalidateVisualization(vizType, bounds, reason);
    },

    /**
     * Invalidate cache entries
     */
    invalidateCache: (pattern, dependency) => {
      return pipeline.invalidateCache(pattern, dependency);
    },

    /**
     * Create optimized scales
     */
    createScale: (type, domain, range, options) => {
      return pipeline.createOptimizedScale(type, domain, range, options);
    },

    /**
     * Get cached elements
     */
    getCachedBackground: (width, height, color) => pipeline.getCachedBackground(width, height, color),
    getCachedText: (text, fontConfig, color) => pipeline.getCachedText(text, fontConfig, color),

    /**
     * Performance and statistics
     */
    getStats: () => pipeline.getPipelineStats(),
    getPerformanceGrade: () => pipeline.getPipelineStats().performance,

    /**
     * Cleanup
     */
    destroy: () => pipeline.destroy(),

    /**
     * Access to individual optimization systems (for advanced usage)
     */
    systems: pipeline.optimizationSystems
  };
}