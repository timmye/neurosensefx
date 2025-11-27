/**
 * Dirty Rectangle Rendering System
 *
 * Phase 2: Rendering Optimization Pipeline
 * Implements selective rendering for changed regions only to achieve sub-100ms latency
 * and consistent 60fps performance during active trading with 20+ displays.
 *
 * ARCHITECTURE:
 * - Region-based invalidation tracking
 * - Efficient dirty region management and merging
 * - Selective rendering pipeline integration
 * - Performance metrics for 60fps verification
 *
 * PERFORMANCE TARGETS:
 * - Sub-100ms data-to-visual latency
 * - Consistent 60fps rendering during active trading
 * - Support for 20+ concurrent displays without degradation
 * - Memory stability during extended sessions
 */

import {
  withErrorBoundary,
  withAsyncErrorBoundary,
  memorySafeErrorHandler,
  getContextualFallback,
  SAFE_DEFAULTS,
  CircuitBreaker
} from '../../utils/errorBoundaryUtils.js';

/**
 * Dirty Region class for tracking invalidated canvas areas
 */
class DirtyRegion {
  constructor(x = 0, y = 0, width = 0, height = 0, reason = 'unknown') {
    try {
      this.x = Math.max(0, Number(x) || 0);
      this.y = Math.max(0, Number(y) || 0);
      this.width = Math.max(0, Number(width) || 0);
      this.height = Math.max(0, Number(height) || 0);
      this.reason = String(reason || 'unknown');
      this.timestamp = performance.now();
      this.frameId = this._getFrameId();
    } catch (error) {
      memorySafeErrorHandler('DirtyRegion.constructor', error);

      // Fallback to safe defaults
      this.x = 0;
      this.y = 0;
      this.width = 0;
      this.height = 0;
      this.reason = 'error';
      this.timestamp = performance.now();
      this.frameId = 0;
    }
  }

  /**
   * Get current frame ID for tracking
   */
  _getFrameId() {
    try {
      return Math.floor(performance.now() / 16.67); // ~60fps frame timing
    } catch (error) {
      memorySafeErrorHandler('DirtyRegion._getFrameId', error);
      return 0;
    }
  }

  /**
   * Check if this region intersects with another
   */
  intersects(other) {
    try {
      if (!other || typeof other.x !== 'number' || typeof other.y !== 'number' ||
          typeof other.width !== 'number' || typeof other.height !== 'number') {
        return false;
      }

      return !(this.x + this.width < other.x ||
               other.x + other.width < this.x ||
               this.y + this.height < other.y ||
               other.y + other.height < this.y);
    } catch (error) {
      memorySafeErrorHandler('DirtyRegion.intersects', error);
      return false;
    }
  }

  /**
   * Merge this region with another (union operation)
   */
  merge(other) {
    const minX = Math.min(this.x, other.x);
    const minY = Math.min(this.y, other.y);
    const maxX = Math.max(this.x + this.width, other.x + other.width);
    const maxY = Math.max(this.y + this.height, other.y + other.height);

    return new DirtyRegion(
      minX,
      minY,
      maxX - minX,
      maxY - minY,
      `merged:${this.reason}+${other.reason}`
    );
  }

  /**
   * Check if this region is valid (has positive dimensions)
   */
  isValid() {
    return this.width > 0 && this.height > 0;
  }

  /**
   * Get region bounds as object
   */
  getBounds() {
    return {
      left: this.x,
      top: this.y,
      right: this.x + this.width,
      bottom: this.y + this.height,
      width: this.width,
      height: this.height
    };
  }

  /**
   * Check if region is expired (older than 2 frames)
   */
  isExpired() {
    const currentFrameId = this._getFrameId();
    return (currentFrameId - this.frameId) > 2;
  }
}

/**
 * Dirty Rectangle Manager
 *
 * Manages dirty regions, provides optimization strategies,
 * and integrates with the Container.svelte rendering pipeline
 */
export class DirtyRectangleManager {
  constructor(options = {}) {
    try {
      this.regions = [];
      this.maxRegions = Math.max(1, Math.min(100, Number(options.maxRegions) || 10));
      this.mergeThreshold = Math.max(0, Number(options.mergeThreshold) || 50); // pixels
      this.debugLogging = Boolean(options.debugLogging);
      this.performanceTracking = options.performanceTracking !== false;
      this.circuitBreaker = new CircuitBreaker({ failureThreshold: 5, recoveryTime: 30000 });

      // Performance tracking with safe defaults
      this.stats = {
        totalRegions: 0,
        mergedRegions: 0,
        skippedRegions: 0,
        fullRenderCount: 0,
        selectiveRenderCount: 0,
        averageRenderTime: 0,
        renderTimes: []
      };

      // Last clear region for full canvas clearing
      this.lastClearRegion = null;

      // Wrap critical methods with error boundaries
      this.addRegion = withErrorBoundary(
        this.addRegion.bind(this),
        () => false,
        'DirtyRectangleManager.addRegion'
      );

      this.renderDirtyRegions = withErrorBoundary(
        this.renderDirtyRegions.bind(this),
        () => ({ rendered: false, regionsRendered: 0, renderTime: 0 }),
        'DirtyRectangleManager.renderDirtyRegions'
      );

      this.clearAllRegions = withErrorBoundary(
        this.clearAllRegions.bind(this),
        () => {},
        'DirtyRectangleManager.clearAllRegions'
      );

    } catch (error) {
      memorySafeErrorHandler('DirtyRectangleManager.constructor', error);

      // Fallback to safe, non-optimized mode
      this.regions = [];
      this.maxRegions = 10;
      this.mergeThreshold = 50;
      this.debugLogging = false;
      this.performanceTracking = false;
      this.stats = {
        totalRegions: 0,
        mergedRegions: 0,
        skippedRegions: 0,
        fullRenderCount: 0,
        selectiveRenderCount: 0,
        averageRenderTime: 0,
        renderTimes: []
      };
      this.lastClearRegion = null;
      this.circuitBreaker = new CircuitBreaker({ failureThreshold: 3, recoveryTime: 60000 });

      console.warn('[DIRTY_RECTANGLE] Constructor failed, falling back to safe mode');
    }
  }

  /**
   * Add a dirty region for invalidation
   */
  addRegion(x, y, width, height, reason = 'unknown') {
    const region = new DirtyRegion(x, y, width, height, reason);

    if (!region.isValid()) {
      return false;
    }

    if (this.debugLogging) {
      console.log(`[DirtyRectangle] Adding region:`, region);
    }

    this.regions.push(region);
    this.stats.totalRegions++;

    // Clean up expired regions
    this._cleanupExpiredRegions();

    // Merge overlapping or nearby regions to optimize rendering
    this._optimizeRegions();

    return true;
  }

  /**
   * Add regions for common visualization updates
   */
  addVisualizationRegion(vizType, bounds, reason = null) {
    const { x, y, width, height } = bounds;
    const regionReason = reason || `${vizType}:update`;

    // Add some padding for anti-aliasing and visual effects
    const padding = 2;
    return this.addRegion(
      Math.max(0, x - padding),
      Math.max(0, y - padding),
      width + padding * 2,
      height + padding * 2,
      regionReason
    );
  }

  /**
   * Add full canvas dirty region (forces complete redraw)
   */
  addFullRegion(canvasWidth, canvasHeight, reason = 'full') {
    this.regions = [new DirtyRegion(0, 0, canvasWidth, canvasHeight, reason)];
    this.stats.fullRenderCount++;

    if (this.debugLogging) {
      console.log(`[DirtyRectangle] Full canvas dirty region: ${reason}`);
    }
  }

  /**
   * Check if selective rendering should be used
   */
  shouldUseSelectiveRendering(canvasWidth, canvasHeight) {
    if (this.regions.length === 0) {
      return false;
    }

    // Check if total dirty area is less than 50% of canvas
    const totalDirtyArea = this._calculateTotalDirtyArea();
    const canvasArea = canvasWidth * canvasHeight;
    const dirtyRatio = totalDirtyArea / canvasArea;

    const useSelective = dirtyRatio < 0.5 && this.regions.length <= this.maxRegions;

    if (useSelective) {
      this.stats.selectiveRenderCount++;
    } else {
      this.stats.skippedRegions += this.regions.length;
      // If too much is dirty, just do a full render
      this.addFullRegion(canvasWidth, canvasHeight, 'dirty_ratio_exceeded');
    }

    return useSelective;
  }

  /**
   * Get regions for rendering (optimized for performance)
   */
  getRenderRegions() {
    if (this.regions.length === 0) {
      return [];
    }

    // Convert to bounds format for rendering
    return this.regions.map(region => region.getBounds());
  }

  /**
   * Execute selective rendering with optimized pipeline
   */
  executeSelectiveRendering(ctx, renderFunction, canvasWidth, canvasHeight, renderContext) {
    const startTime = performance.now();

    if (!this.shouldUseSelectiveRendering(canvasWidth, canvasHeight)) {
      // Full render
      renderFunction(ctx, renderContext);
      this._recordRenderTime(performance.now() - startTime);
      return { type: 'full', regions: 0 };
    }

    // Selective rendering
    const regions = this.getRenderRegions();
    let renderedRegions = 0;

    // Save original context state
    ctx.save();

    for (const region of regions) {
      // Set clipping region for selective rendering
      ctx.beginPath();
      ctx.rect(region.left, region.top, region.width, region.height);
      ctx.clip();

      // Clear only the dirty region
      ctx.clearRect(region.left, region.top, region.width, region.height);

      // Restore background for this region
      ctx.fillStyle = '#111827';
      ctx.fillRect(region.left, region.top, region.width, region.height);

      // Render only this region
      renderFunction(ctx, renderContext);
      renderedRegions++;

      // Reset clip for next region
      ctx.restore();
      ctx.save();
    }

    // Restore final context state
    ctx.restore();

    // Clear regions after rendering
    this.clear();

    const renderTime = performance.now() - startTime;
    this._recordRenderTime(renderTime);

    if (this.debugLogging) {
      console.log(`[DirtyRectangle] Selective render completed:`, {
        regions: renderedRegions,
        renderTime: `${renderTime.toFixed(2)}ms`,
        type: 'selective'
      });
    }

    return { type: 'selective', regions: renderedRegions, renderTime };
  }

  /**
   * Clear all dirty regions
   */
  clear() {
    this.regions = [];
    this.lastClearRegion = null;
  }

  /**
   * Get performance statistics
   */
  getStats() {
    return {
      ...this.stats,
      currentRegions: this.regions.length,
      averageRenderTime: this.stats.renderTimes.length > 0
        ? this.stats.renderTimes.reduce((a, b) => a + b, 0) / this.stats.renderTimes.length
        : 0
    };
  }

  /**
   * Reset performance statistics
   */
  resetStats() {
    this.stats = {
      totalRegions: 0,
      mergedRegions: 0,
      skippedRegions: 0,
      fullRenderCount: 0,
      selectiveRenderCount: 0,
      averageRenderTime: 0,
      renderTimes: []
    };
  }

  /**
   * Clean up expired regions to prevent memory leaks
   */
  _cleanupExpiredRegions() {
    const initialCount = this.regions.length;
    this.regions = this.regions.filter(region => !region.isExpired());

    if (this.debugLogging && initialCount !== this.regions.length) {
      console.log(`[DirtyRectangle] Cleaned up ${initialCount - this.regions.length} expired regions`);
    }
  }

  /**
   * Optimize regions by merging overlapping or nearby regions
   */
  _optimizeRegions() {
    if (this.regions.length <= 1) return;

    let merged = true;
    let iterations = 0;
    const maxIterations = 10;

    while (merged && iterations < maxIterations) {
      merged = false;
      iterations++;

      for (let i = 0; i < this.regions.length - 1; i++) {
        for (let j = i + 1; j < this.regions.length; j++) {
          const region1 = this.regions[i];
          const region2 = this.regions[j];

          // Check if regions intersect or are close enough to merge
          const shouldMerge = region1.intersects(region2) ||
                            this._areRegionsNearby(region1, region2);

          if (shouldMerge) {
            const mergedRegion = region1.merge(region2);
            this.regions.splice(j, 1);
            this.regions.splice(i, 1);
            this.regions.push(mergedRegion);
            this.stats.mergedRegions++;
            merged = true;
            break;
          }
        }
        if (merged) break;
      }
    }

    // Limit number of regions to prevent performance issues
    if (this.regions.length > this.maxRegions) {
      // Merge all regions into one full canvas region
      if (this.debugLogging) {
        console.log(`[DirtyRectangle] Too many regions (${this.regions.length}), merging to full canvas`);
      }
      // This will be handled in shouldUseSelectiveRendering
    }
  }

  /**
   * Check if two regions are close enough to merge
   */
  _areRegionsNearby(region1, region2) {
    const distance = Math.sqrt(
      Math.pow(region1.x - region2.x, 2) +
      Math.pow(region1.y - region2.y, 2)
    );
    return distance < this.mergeThreshold;
  }

  /**
   * Calculate total dirty area for optimization decisions
   */
  _calculateTotalDirtyArea() {
    return this.regions.reduce((total, region) => {
      return total + (region.width * region.height);
    }, 0);
  }

  /**
   * Record render time for performance tracking
   */
  _recordRenderTime(renderTime) {
    if (!this.performanceTracking) return;

    this.stats.renderTimes.push(renderTime);

    // Keep only last 100 render times
    if (this.stats.renderTimes.length > 100) {
      this.stats.renderTimes.shift();
    }
  }
}

/**
 * Factory function to create a dirty rectangle manager with default options
 */
export function createDirtyRectangleManager(options = {}) {
  return new DirtyRectangleManager(options);
}

/**
 * Utility function to integrate dirty rectangle rendering with existing Container.svelte pipeline
 */
export function createDirtyRectRenderingIntegration(options = {}) {
  const dirtyManager = new DirtyRectangleManager(options);

  return {
    // Manager instance
    manager: dirtyManager,

    // Convenience methods for common operations
    invalidateVisualization: (vizType, bounds, reason) => {
      return dirtyManager.addVisualizationRegion(vizType, bounds, reason);
    },

    invalidatePriceChange: (oldPrice, newPrice, yScale, contentArea) => {
      if (!yScale || !contentArea) return false;

      const oldY = yScale(oldPrice);
      const newY = yScale(newPrice);

      if (oldY === null || newY === null) return false;

      // Create region covering both old and new positions
      const y = Math.min(oldY, newY) - 10;
      const height = Math.abs(newY - oldY) + 20;

      return dirtyManager.addRegion(0, y, contentArea.width, height, 'price_change');
    },

    invalidateDataUpdate: (contentArea) => {
      // For general data updates, invalidate key areas
      dirtyManager.addRegion(0, 0, contentArea.width, contentArea.height * 0.3, 'data_update_top');
      dirtyManager.addRegion(0, contentArea.height * 0.7, contentArea.width, contentArea.height * 0.3, 'data_update_bottom');
    },

    executeRender: (ctx, renderFunction, canvasWidth, canvasHeight, renderContext) => {
      return dirtyManager.executeSelectiveRendering(ctx, renderFunction, canvasWidth, canvasHeight, renderContext);
    },

    getStats: () => dirtyManager.getStats(),
    resetStats: () => dirtyManager.resetStats(),
    clear: () => dirtyManager.clear()
  };
}