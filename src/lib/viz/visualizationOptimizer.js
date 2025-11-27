/**
 * Visualization-Level Performance Optimizer
 *
 * Phase 2: Rendering Optimization Pipeline
 * Provides optimization utilities for individual visualization rendering functions
 * to achieve sub-100ms latency and maintain 60fps performance.
 *
 * ARCHITECTURE:
 * - D3 scale reuse and caching optimization
 * - Rendering budget management for visualizations
 * - Performance profiling hooks for optimization
 * - Memory-efficient rendering patterns
 *
 * PERFORMANCE TARGETS:
 * - Sub-5ms rendering time for individual visualizations
 * - D3 scale reuse for optimal performance
 * - Memory stability during extended trading sessions
 * - Consistent rendering quality across all display types
 */

/**
 * Visualization optimization manager
 */
export class VisualizationOptimizer {
  constructor(options = {}) {
    this.options = {
      enableScaleCaching: options.enableScaleCaching !== false,
      enableProfiling: options.enableProfiling !== false,
      enableBoundsOptimization: options.enableBoundsOptimization !== false,
      maxCacheSize: options.maxCacheSize || 100,
      debugLogging: options.debugLogging || false,
      ...options
    };

    // Scale cache for D3 optimization
    this.scaleCache = new Map();
    this.scaleCacheHits = 0;
    this.scaleCacheMisses = 0;

    // Performance tracking
    this.performanceStats = new Map();
    this.boundChecksSkipped = 0;
    this.rendersOptimized = 0;

    // Memory tracking
    this.memoryUsage = {
      scales: 0,
      profiles: 0,
      cache: 0
    };
  }

  /**
   * Get or create optimized D3 scale with caching
   */
  getOptimizedScale(type, domain, range, options = {}) {
    if (!this.options.enableScaleCaching) {
      return this._createScale(type, domain, range, options);
    }

    // Create cache key from scale configuration
    const cacheKey = this._createScaleCacheKey(type, domain, range, options);

    // Check cache first
    if (this.scaleCache.has(cacheKey)) {
      this.scaleCacheHits++;
      const cachedScale = this.scaleCache.get(cacheKey);

      // Update domain if needed (scales can be reused with different domains)
      if (options.updateDomain && cachedScale.domain) {
        cachedScale.domain(domain);
      }

      return cachedScale;
    }

    // Create new scale and cache it
    this.scaleCacheMisses++;
    const scale = this._createScale(type, domain, range, options);

    // Cache management - evict old entries if cache is full
    if (this.scaleCache.size >= this.options.maxCacheSize) {
      this._evictOldestScale();
    }

    this.scaleCache.set(cacheKey, scale);
    return scale;
  }

  /**
   * Optimize visualization rendering with bounds checking and profiling
   */
  optimizeRender(vizType, renderFunction, ctx, renderingContext, state, options = {}) {
    const startTime = performance.now();

    // Bounds optimization - skip if out of bounds
    if (this.options.enableBoundsOptimization && options.boundsCheck) {
      if (!this._shouldRender(vizType, renderingContext, state)) {
        this.boundChecksSkipped++;
        return { skipped: true, reason: 'out_of_bounds' };
      }
    }

    // Profile rendering if enabled
    let profileInfo = null;
    if (this.options.enableProfiling) {
      profileInfo = this._startProfile(vizType);
    }

    try {
      // Execute render function
      renderFunction(ctx, renderingContext, state, options);

      // Record performance
      const renderTime = performance.now() - startTime;
      this._recordPerformance(vizType, renderTime, true);

      if (this.options.enableProfiling && profileInfo) {
        this._endProfile(profileInfo, renderTime, true);
      }

      this.rendersOptimized++;

      return {
        optimized: true,
        renderTime,
        profile: profileInfo,
        boundsChecked: this.options.enableBoundsOptimization
      };

    } catch (error) {
      const renderTime = performance.now() - startTime;
      this._recordPerformance(vizType, renderTime, false);

      if (this.options.enableProfiling && profileInfo) {
        this._endProfile(profileInfo, renderTime, false);
      }

      console.error(`[VisualizationOptimizer] Render failed for ${vizType}:`, error);
      return {
        optimized: false,
        renderTime,
        error: error.message,
        profile: profileInfo
      };
    }
  }

  /**
   * Batch optimize multiple visualizations
   */
  batchOptimize(batchName, visualizations, ctx, renderingContext, sharedState) {
    const batchStart = performance.now();
    const results = [];

    for (const viz of visualizations) {
      const result = this.optimizeRender(
        viz.type,
        viz.renderFunction,
        ctx,
        renderingContext,
        viz.state || sharedState,
        viz.options || {}
      );
      results.push({ ...viz, result });
    }

    const batchTime = performance.now() - batchStart;

    return {
      batchName,
      batchTime,
      results,
      optimizations: results.filter(r => r.result.optimized).length,
      skipped: results.filter(r => r.result.skipped).length,
      errors: results.filter(r => r.result.error).length
    };
  }

  /**
   * Create optimized rendering context with pre-computed values
   */
  createOptimizedContext(renderingContext, state, config) {
    const optimized = { ...renderingContext };

    // Pre-compute expensive calculations
    optimized.preComputed = {
      contentAreaCenter: {
        x: renderingContext.contentArea.width / 2,
        y: renderingContext.contentArea.height / 2
      },
      priceRange: state.visualHigh - state.visualLow,
      priceCenter: (state.visualHigh + state.visualLow) / 2,
      adrAxisRatio: renderingContext.adrAxisX / renderingContext.contentArea.width,
      // Cache font configurations
      fonts: {
        price: this._optimizeFontConfig(config.priceFontSize, 'monospace'),
        label: this._optimizeFontConfig(config.labelFontSize, 'sans-serif'),
        metric: this._optimizeFontConfig(config.metricFontSize, 'monospace')
      }
    };

    return optimized;
  }

  /**
   * Get performance statistics
   */
  getStats() {
    return {
      scaleCache: {
        size: this.scaleCache.size,
        hits: this.scaleCacheHits,
        misses: this.scaleCacheMisses,
        hitRate: this.scaleCacheHits + this.scaleCacheMisses > 0
          ? (this.scaleCacheHits / (this.scaleCacheHits + this.scaleCacheMisses)) * 100
          : 0
      },
      performance: {
        visualizations: Object.fromEntries(this.performanceStats),
        rendersOptimized: this.rendersOptimized,
        boundsChecksSkipped: this.boundChecksSkipped
      },
      memory: this.memoryUsage,
      options: this.options
    };
  }

  /**
   * Clear caches and reset statistics
   */
  clearCaches() {
    this.scaleCache.clear();
    this.performanceStats.clear();
    this.scaleCacheHits = 0;
    this.scaleCacheMisses = 0;
    this.boundChecksSkipped = 0;
    this.rendersOptimized = 0;

    if (this.options.debugLogging) {
      console.log('[VisualizationOptimizer] All caches cleared');
    }
  }

  /**
   * Create D3 scale with caching key
   */
  _createScale(type, domain, range, options = {}) {
    const { scaleLinear, scaleLog } = require('d3-scale');

    let scale;
    switch (type) {
      case 'linear':
        scale = scaleLinear().domain(domain).range(range);
        break;
      case 'log':
        scale = scaleLog().domain(domain).range(range);
        break;
      default:
        scale = scaleLinear().domain(domain).range(range);
    }

    // Apply additional scale options
    if (options.clamp) scale.clamp(true);
    if (options.nice) scale.nice();
    if (options.interpolate) scale.interpolate(options.interpolate);

    return scale;
  }

  /**
   * Create cache key for scale
   */
  _createScaleCacheKey(type, domain, range, options) {
    const domainStr = domain ? domain.join(',') : '';
    const rangeStr = range ? range.join(',') : '';
    const optionsStr = JSON.stringify(options);
    return `${type}:${domainStr}:${rangeStr}:${optionsStr}`;
  }

  /**
   * Evict oldest scale from cache
   */
  _evictOldestScale() {
    const firstKey = this.scaleCache.keys().next().value;
    if (firstKey) {
      this.scaleCache.delete(firstKey);
    }
  }

  /**
   * Check if visualization should render based on bounds
   */
  _shouldRender(vizType, renderingContext, state) {
    const { contentArea } = renderingContext;

    // Check if essential data is within reasonable bounds
    if (state.currentPrice < state.visualLow || state.currentPrice > state.visualHigh) {
      return false;
    }

    // Visualization-specific bounds checking
    switch (vizType) {
      case 'priceDisplay':
      case 'priceFloat':
        // Always render price elements
        return true;

      case 'marketProfile':
      case 'volatilityOrb':
        // Check if data range is reasonable
        return (state.visualHigh - state.visualLow) > 0;

      case 'dayRangeMeter':
        // Check if ADR data is valid
        return state.projectedAdrHigh !== null &&
               state.projectedAdrLow !== null &&
               state.midPrice !== null;

      default:
        return true;
    }
  }

  /**
   * Start performance profiling for visualization
   */
  _startProfile(vizType) {
    return {
      vizType,
      startTime: performance.now(),
      startMemory: performance.memory ? performance.memory.usedJSHeapSize : null,
      frameId: Math.floor(performance.now() / 16.67)
    };
  }

  /**
   * End performance profiling and record results
   */
  _endProfile(profileInfo, renderTime, success) {
    const endTime = performance.now();
    const endMemory = performance.memory ? performance.memory.usedJSHeapSize : null;

    profileInfo.endTime = endTime;
    profileInfo.renderTime = renderTime;
    profileInfo.success = success;
    profileInfo.memoryDelta = endMemory && profileInfo.startMemory
      ? endMemory - profileInfo.startMemory
      : null;

    return profileInfo;
  }

  /**
   * Record visualization performance statistics
   */
  _recordPerformance(vizType, renderTime, success) {
    if (!this.performanceStats.has(vizType)) {
      this.performanceStats.set(vizType, {
        totalRenders: 0,
        successfulRenders: 0,
        failedRenders: 0,
        totalTime: 0,
        minTime: Infinity,
        maxTime: 0,
        averageTime: 0
      });
    }

    const stats = this.performanceStats.get(vizType);
    stats.totalRenders++;
    stats.totalTime += renderTime;
    stats.minTime = Math.min(stats.minTime, renderTime);
    stats.maxTime = Math.max(stats.maxTime, renderTime);
    stats.averageTime = stats.totalTime / stats.totalRenders;

    if (success) {
      stats.successfulRenders++;
    } else {
      stats.failedRenders++;
    }
  }

  /**
   * Optimize font configuration for better performance
   */
  _optimizeFontConfig(fontSize, fontFamily = 'sans-serif') {
    return {
      size: fontSize,
      family: fontFamily,
      weight: 'normal',
      baseline: 'middle',
      align: 'center',
      // Pre-computed font string for reuse
      string: `${fontSize}px ${fontFamily}`
    };
  }
}

/**
 * Factory function to create visualization optimizer with default options
 */
export function createVisualizationOptimizer(options = {}) {
  return new VisualizationOptimizer(options);
}

/**
 * Utility function to optimize existing visualization functions
 */
export function optimizeVisualizationFunction(vizType, originalFunction, optimizer) {
  return function optimizedFunction(ctx, renderingContext, state, options = {}) {
    const result = optimizer.optimizeRender(
      vizType,
      originalFunction,
      ctx,
      renderingContext,
      state,
      options
    );

    if (result.skipped) {
      return result; // Early exit for out-of-bounds renders
    }

    if (result.error) {
      console.error(`[Optimized${vizType}] Render error:`, result.error);
      return result;
    }

    return result;
  };
}

/**
 * Create optimized D3 scale factory with caching
 */
export function createOptimizedScaleFactory(optimizer) {
  return {
    linear: (domain, range, options = {}) => {
      return optimizer.getOptimizedScale('linear', domain, range, options);
    },
    log: (domain, range, options = {}) => {
      return optimizer.getOptimizedScale('log', domain, range, options);
    },
    getCachedScale: (type, domain, range, options = {}) => {
      return optimizer.getOptimizedScale(type, domain, range, options);
    }
  };
}

/**
 * Performance monitoring utilities for visualization optimization
 */
export const PerformanceMonitor = {
  /**
   * Monitor visualization performance over time
   */
  monitorVisualization(optimizer, vizType, duration = 10000) {
    const startTime = performance.now();
    const samples = [];

    const interval = setInterval(() => {
      const stats = optimizer.getStats();
      if (stats.performance.visualizations[vizType]) {
        samples.push({
          timestamp: performance.now(),
          ...stats.performance.visualizations[vizType]
        });
      }

      if (performance.now() - startTime > duration) {
        clearInterval(interval);
        return this.analyzePerformance(samples, vizType);
      }
    }, 100);

    return samples;
  },

  /**
   * Analyze performance samples and provide recommendations
   */
  analyzePerformance(samples, vizType) {
    if (samples.length === 0) return null;

    const averageRenderTime = samples.reduce((sum, s) => sum + s.averageTime, 0) / samples.length;
    const successRate = samples.reduce((sum, s) => sum + (s.successfulRenders / s.totalRenders), 0) / samples.length;

    let recommendation = 'Performance is good';
    if (averageRenderTime > 5) {
      recommendation = 'Consider optimizing rendering logic or reducing complexity';
    } else if (averageRenderTime > 10) {
      recommendation = 'High render time detected - review for performance bottlenecks';
    }

    if (successRate < 0.95) {
      recommendation += '. Also check for rendering errors';
    }

    return {
      vizType,
      sampleCount: samples.length,
      averageRenderTime,
      successRate: successRate * 100,
      recommendation,
      grade: this.getPerformanceGrade(averageRenderTime, successRate)
    };
  },

  /**
   * Get performance grade based on metrics
   */
  getPerformanceGrade(averageRenderTime, successRate) {
    if (averageRenderTime < 2 && successRate > 0.99) return 'A+';
    if (averageRenderTime < 3 && successRate > 0.98) return 'A';
    if (averageRenderTime < 5 && successRate > 0.95) return 'B';
    if (averageRenderTime < 8 && successRate > 0.90) return 'C';
    return 'D';
  }
};