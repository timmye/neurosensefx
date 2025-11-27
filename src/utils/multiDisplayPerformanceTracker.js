/**
 * Multi-Display Performance Tracking System
 *
 * Specialized performance tracking for 20+ concurrent trading displays with
 * scaling analysis, resource allocation monitoring, and interaction tracking.
 *
 * Design Philosophy: "Simple, Performant, Maintainable"
 * - Simple: Clear per-display metrics with scaling insights
 * - Performant: <0.2ms per-display tracking overhead
 * - Maintainable: Unified interface for multi-display performance analysis
 */

/**
 * Multi-display performance tracker with scaling analysis
 */
export class MultiDisplayPerformanceTracker {
  constructor(options = {}) {
    this.maxDisplays = options.maxDisplays || 50; // Support up to 50 displays
    this.trackingInterval = options.trackingInterval || 1000; // 1 second tracking
    this.enabled = true;
    this.tracking = false;
    this.trackingTimer = null;

    // Display registry
    this.displays = new Map();
    this.displayGroups = new Map(); // Group displays for analysis
    this.displayLifecycle = new Map(); // Track creation/destruction events

    // Performance scaling analysis
    this.scalingMetrics = {
      baseline: null, // Performance with 1 display
      current: null,  // Current performance metrics
      trends: [],     // Historical scaling trends
      breakpoints: [] // Performance degradation breakpoints
    };

    // Scaling thresholds and expectations
    this.scalingExpectations = {
      maxOverheadPerDisplay: options.maxOverheadPerDisplay || 2, // 2ms max per display
      memoryPerDisplay: options.memoryPerDisplay || 5, // 5MB expected per display
      acceptableDegradation: options.acceptableDegradation || 20, // 20% acceptable degradation
      criticalScalingPoint: options.criticalScalingPoint || 15 // Displays where degradation becomes critical
    };

    // Performance budgets for multi-display scenarios
    this.performanceBudgets = {
      totalFrameTime: 16.67, // 60fps target
      maxDisplayRenderTime: 5, // 5ms per display max
      maxMemoryUsage: 0.8,    // 80% of heap limit
      maxCPUUsage: 0.7        // 70% CPU usage estimate
    };

    // Interaction tracking
    this.interactionMetrics = new Map(); // Track user interaction performance per display

    // Callbacks for multi-display events
    this.callbacks = {
      onScalingIssue: options.onScalingIssue || null,
      onDisplayPerformanceAlert: options.onDisplayPerformanceAlert || null,
      onResourceExhaustion: options.onResourceExhaustion || null,
      onScalingBreakpoint: options.onScalingBreakpoint || null
    };

    console.log('[MULTI_DISPLAY_TRACKER] Multi-display performance tracker initialized');
  }

  /**
   * Start multi-display performance tracking
   */
  startTracking() {
    if (this.tracking || !this.enabled) {
      console.warn('[MULTI_DISPLAY_TRACKER] Tracking already active or disabled');
      return false;
    }

    this.tracking = true;

    // Start periodic performance analysis
    this.trackingTimer = setInterval(() => {
      this.performScalingAnalysis();
      this.checkResourceExhaustion();
      this.updateScalingTrends();
    }, this.trackingInterval);

    console.log('[MULTI_DISPLAY_TRACKER] Multi-display tracking started');
    return true;
  }

  /**
   * Stop multi-display performance tracking
   */
  stopTracking() {
    if (!this.tracking) {
      console.warn('[MULTI_DISPLAY_TRACKER] Tracking not active');
      return false;
    }

    this.tracking = false;

    if (this.trackingTimer) {
      clearInterval(this.trackingTimer);
      this.trackingTimer = null;
    }

    console.log('[MULTI_DISPLAY_TRACKER] Multi-display tracking stopped');
    return true;
  }

  /**
   * Register a new display for performance tracking
   */
  registerDisplay(displayId, displayConfig = {}) {
    if (this.displays.size >= this.maxDisplays) {
      console.warn(`[MULTI_DISPLAY_TRACKER] Maximum display limit (${this.maxDisplays}) reached`);
      return false;
    }

    if (this.displays.has(displayId)) {
      console.warn(`[MULTI_DISPLAY_TRACKER] Display ${displayId} already registered`);
      return false;
    }

    const displayData = {
      id: displayId,
      config: displayConfig,
      registeredAt: Date.now(),
      metrics: {
        frameCount: 0,
        totalRenderTime: 0,
        lastRenderTime: 0,
        averageRenderTime: 0,
        maxRenderTime: 0,
        minRenderTime: Infinity,
        frameRate: 0,
        memoryUsage: 0,
        lastUpdate: Date.now()
      },
      interactions: {
        clickCount: 0,
        dragCount: 0,
        resizeCount: 0,
        lastInteraction: null,
        averageInteractionLatency: 0
      },
      health: {
        status: 'healthy',
        alerts: [],
        lastAlert: null
      }
    };

    this.displays.set(displayId, displayData);

    // Track lifecycle event
    this.trackLifecycleEvent({
      type: 'display_created',
      displayId,
      timestamp: Date.now(),
      totalDisplays: this.displays.size
    });

    console.log(`[MULTI_DISPLAY_TRACKER] Display ${displayId} registered (${this.displays.size} total)`);
    return true;
  }

  /**
   * Unregister display and cleanup tracking
   */
  unregisterDisplay(displayId) {
    const displayData = this.displays.get(displayId);
    if (!displayData) {
      console.warn(`[MULTI_DISPLAY_TRACKER] Display ${displayId} not found for unregistration`);
      return false;
    }

    const unregisteredAt = Date.now();
    const lifespan = unregisteredAt - displayData.registeredAt;

    // Store final metrics before removal
    const finalMetrics = { ...displayData.metrics };
    const interactionStats = { ...displayData.interactions };

    this.displays.delete(displayId);
    this.interactionMetrics.delete(displayId);

    // Track lifecycle event
    this.trackLifecycleEvent({
      type: 'display_destroyed',
      displayId,
      timestamp: unregisteredAt,
      lifespan,
      finalMetrics,
      interactionStats,
      totalDisplays: this.displays.size
    });

    console.log(`[MULTI_DISPLAY_TRACKER] Display ${displayId} unregistered (${this.displays.size} remaining)`);
    return true;
  }

  /**
   * Record display render performance
   */
  recordDisplayRender(displayId, renderTime, frameData = {}) {
    const displayData = this.displays.get(displayId);
    if (!displayData) return;

    const metrics = displayData.metrics;
    const now = Date.now();

    metrics.frameCount++;
    metrics.totalRenderTime += renderTime;
    metrics.lastRenderTime = renderTime;
    metrics.averageRenderTime = metrics.totalRenderTime / metrics.frameCount;
    metrics.maxRenderTime = Math.max(metrics.maxRenderTime, renderTime);
    metrics.minRenderTime = Math.min(metrics.minRenderTime, renderTime);
    metrics.lastUpdate = now;

    // Calculate frame rate
    if (frameData.frameDelta) {
      metrics.frameRate = 1000 / frameData.frameDelta;
    }

    // Check display performance thresholds
    this.checkDisplayPerformanceThresholds(displayId, renderTime);

    // Update scaling baseline if this is the first display
    if (this.displays.size === 1 && !this.scalingMetrics.baseline) {
      this.establishScalingBaseline();
    }
  }

  /**
   * Record display interaction
   */
  recordDisplayInteraction(displayId, interactionType, latency = 0) {
    const displayData = this.displays.get(displayId);
    if (!displayData) return;

    const interactions = displayData.interactions;
    const now = Date.now();

    // Update interaction counts
    switch (interactionType) {
      case 'click':
        interactions.clickCount++;
        break;
      case 'drag':
        interactions.dragCount++;
        break;
      case 'resize':
        interactions.resizeCount++;
        break;
      default:
        console.warn(`[MULTI_DISPLAY_TRACKER] Unknown interaction type: ${interactionType}`);
    }

    interactions.lastInteraction = {
      type: interactionType,
      timestamp: now,
      latency
    };

    // Update average interaction latency
    if (latency > 0) {
      const totalInteractions = interactions.clickCount + interactions.dragCount + interactions.resizeCount;
      interactions.averageInteractionLatency =
        (interactions.averageInteractionLatency * (totalInteractions - 1) + latency) / totalInteractions;
    }

    // Store in interaction metrics for detailed analysis
    if (!this.interactionMetrics.has(displayId)) {
      this.interactionMetrics.set(displayId, []);
    }

    const interactionHistory = this.interactionMetrics.get(displayId);
    interactionHistory.push({
      type: interactionType,
      latency,
      timestamp: now
    });

    // Keep interaction history manageable
    if (interactionHistory.length > 50) {
      interactionHistory.shift();
    }

    // Check interaction performance
    this.checkInteractionPerformance(displayId, interactionType, latency);
  }

  /**
   * Group displays for analysis
   */
  createDisplayGroup(groupName, displayIds) {
    const validDisplays = displayIds.filter(id => this.displays.has(id));

    this.displayGroups.set(groupName, {
      name: groupName,
      displayIds: validDisplays,
      createdAt: Date.now(),
      metrics: {
        totalRenderTime: 0,
        averageRenderTime: 0,
        combinedFrameRate: 0
      }
    });

    console.log(`[MULTI_DISPLAY_TRACKER] Display group '${groupName}' created with ${validDisplays.length} displays`);
  }

  /**
   * Perform comprehensive scaling analysis
   */
  performScalingAnalysis() {
    const displayCount = this.displays.size;
    if (displayCount === 0) return;

    // Calculate current scaling metrics
    const currentMetrics = this.calculateCurrentScalingMetrics();
    this.scalingMetrics.current = currentMetrics;

    // Analyze scaling performance
    const scalingAnalysis = this.analyzeScalingPerformance(currentMetrics);

    // Detect scaling issues
    this.detectScalingIssues(scalingAnalysis);

    // Update display health based on scaling
    this.updateDisplayHealth(scalingAnalysis);
  }

  /**
   * Calculate current scaling metrics
   */
  calculateCurrentScalingMetrics() {
    const displayMetrics = Array.from(this.displays.values()).map(d => d.metrics);

    const totalRenderTime = displayMetrics.reduce((sum, m) => sum + m.averageRenderTime, 0);
    const averageRenderTime = totalRenderTime / displayMetrics.length;
    const maxRenderTime = Math.max(...displayMetrics.map(m => m.maxRenderTime));

    const frameRates = displayMetrics.map(m => m.frameRate).filter(fps => fps > 0);
    const averageFrameRate = frameRates.length > 0 ? frameRates.reduce((a, b) => a + b, 0) / frameRates.length : 0;
    const minFrameRate = frameRates.length > 0 ? Math.min(...frameRates) : 0;

    return {
      displayCount: this.displays.size,
      totalRenderTime,
      averageRenderTime,
      maxRenderTime,
      averageFrameRate,
      minFrameRate,
      renderEfficiency: this.calculateRenderEfficiency(displayMetrics),
      memoryDistribution: this.calculateMemoryDistribution(),
      timestamp: Date.now()
    };
  }

  /**
   * Analyze scaling performance against expectations
   */
  analyzeScalingPerformance(currentMetrics) {
    const displayCount = currentMetrics.displayCount;
    const baseline = this.scalingMetrics.baseline;

    if (!baseline) {
      return { status: 'no_baseline' };
    }

    // Calculate scaling factors
    const renderTimeScaling = currentMetrics.averageRenderTime / baseline.averageRenderTime;
    const frameRateScaling = currentMetrics.averageFrameRate / baseline.averageFrameRate;
    const efficiencyLoss = ((baseline.renderEfficiency - currentMetrics.renderEfficiency) / baseline.renderEfficiency) * 100;

    // Check against expectations
    const expectedOverhead = displayCount * this.scalingExpectations.maxOverheadPerDisplay;
    const actualOverhead = currentMetrics.totalRenderTime - baseline.totalRenderTime;
    const overheadExcess = actualOverhead - expectedOverhead;

    return {
      status: this.determineScalingStatus(renderTimeScaling, frameRateScaling, efficiencyLoss),
      scalingFactors: {
        renderTime: renderTimeScaling,
        frameRate: frameRateScaling,
        efficiency: efficiencyLoss
      },
      overhead: {
        expected: expectedOverhead,
        actual: actualOverhead,
        excess: overheadExcess,
        excessPercent: expectedOverhead > 0 ? (overheadExcess / expectedOverhead) * 100 : 0
      },
      performanceDegradation: {
        renderTime: ((renderTimeScaling - 1) * 100),
        frameRate: ((1 - frameRateScaling) * 100),
        efficiency: efficiencyLoss
      },
      criticalScalingPoint: displayCount >= this.scalingExpectations.criticalScalingPoint,
      timestamp: Date.now()
    };
  }

  /**
   * Determine overall scaling status
   */
  determineScalingStatus(renderTimeScaling, frameRateScaling, efficiencyLoss) {
    const severeDegradation = renderTimeScaling > 2 || frameRateScaling < 0.5 || efficiencyLoss > 40;
    const moderateDegradation = renderTimeScaling > 1.5 || frameRateScaling < 0.7 || efficiencyLoss > 25;
    const mildDegradation = renderTimeScaling > 1.2 || frameRateScaling < 0.85 || efficiencyLoss > 15;

    if (severeDegradation) return 'critical';
    if (moderateDegradation) return 'degraded';
    if (mildDegradation) return 'warning';
    return 'healthy';
  }

  /**
   * Detect scaling issues and trigger alerts
   */
  detectScalingIssues(scalingAnalysis) {
    if (scalingAnalysis.status === 'no_baseline') return;

    const issues = [];

    // Check render time scaling
    if (scalingAnalysis.performanceDegradation.renderTime > this.scalingExpectations.acceptableDegradation) {
      issues.push({
        type: 'render_time_scaling',
        severity: scalingAnalysis.performanceDegradation.renderTime > 50 ? 'critical' : 'warning',
        degradation: scalingAnalysis.performanceDegradation.renderTime,
        message: `Render time increased by ${scalingAnalysis.performanceDegradation.renderTime.toFixed(1)}%`
      });
    }

    // Check frame rate degradation
    if (scalingAnalysis.performanceDegradation.frameRate > this.scalingExpectations.acceptableDegradation) {
      issues.push({
        type: 'frame_rate_scaling',
        severity: scalingAnalysis.performanceDegradation.frameRate > 40 ? 'critical' : 'warning',
        degradation: scalingAnalysis.performanceDegradation.frameRate,
        message: `Frame rate decreased by ${scalingAnalysis.performanceDegradation.frameRate.toFixed(1)}%`
      });
    }

    // Check overhead excess
    if (scalingAnalysis.overhead.excessPercent > 50) {
      issues.push({
        type: 'overhead_excess',
        severity: scalingAnalysis.overhead.excessPercent > 100 ? 'critical' : 'warning',
        excess: scalingAnalysis.overhead.excessPercent,
        message: `Overhead ${scalingAnalysis.overhead.excessPercent.toFixed(1)}% above expectations`
      });
    }

    // Check critical scaling point
    if (scalingAnalysis.criticalScalingPoint) {
      issues.push({
        type: 'critical_scaling_point',
        severity: 'critical',
        displayCount: this.scalingMetrics.current.displayCount,
        message: `Reached critical scaling point at ${this.scalingMetrics.current.displayCount} displays`
      });

      this.triggerScalingBreakpoint(scalingAnalysis);
    }

    // Trigger alerts for detected issues
    issues.forEach(issue => {
      this.triggerScalingIssue(issue);
    });
  }

  /**
   * Check display performance thresholds
   */
  checkDisplayPerformanceThresholds(displayId, renderTime) {
    const displayData = this.displays.get(displayId);
    if (!displayData) return;

    const alerts = [];
    const health = displayData.health;

    // Check render time threshold
    if (renderTime > this.performanceBudgets.maxDisplayRenderTime) {
      alerts.push({
        type: 'slow_render',
        severity: renderTime > 10 ? 'critical' : 'warning',
        renderTime,
        threshold: this.performanceBudgets.maxDisplayRenderTime
      });
    }

    // Check frame rate threshold
    if (displayData.metrics.frameRate > 0 && displayData.metrics.frameRate < 30) {
      alerts.push({
        type: 'low_frame_rate',
        severity: displayData.metrics.frameRate < 15 ? 'critical' : 'warning',
        frameRate: displayData.metrics.frameRate,
        threshold: 30
      });
    }

    // Update health status
    if (alerts.length > 0) {
      health.status = alerts.some(a => a.severity === 'critical') ? 'critical' : 'warning';
      health.alerts = alerts;
      health.lastAlert = Date.now();

      this.triggerDisplayPerformanceAlert(displayId, alerts);
    } else {
      health.status = 'healthy';
      health.alerts = [];
    }
  }

  /**
   * Check interaction performance
   */
  checkInteractionPerformance(displayId, interactionType, latency) {
    const thresholds = {
      click: 50,    // 50ms max click latency
      drag: 16,     // 16ms max drag latency (60fps)
      resize: 100   // 100ms max resize latency
    };

    const threshold = thresholds[interactionType] || 50;

    if (latency > threshold) {
      const alert = {
        type: 'slow_interaction',
        interactionType,
        latency,
        threshold,
        severity: latency > threshold * 2 ? 'critical' : 'warning'
      };

      this.triggerDisplayPerformanceAlert(displayId, [alert]);
    }
  }

  /**
   * Calculate render efficiency
   */
  calculateRenderEfficiency(displayMetrics) {
    if (displayMetrics.length === 0) return 0;

    const totalExpectedTime = displayMetrics.length * this.performanceBudgets.maxDisplayRenderTime;
    const totalActualTime = displayMetrics.reduce((sum, m) => sum + m.averageRenderTime, 0);

    return Math.max(0, (totalExpectedTime / totalActualTime) * 100);
  }

  /**
   * Calculate memory distribution across displays
   */
  calculateMemoryDistribution() {
    if (!performance.memory) return null;

    const totalMemory = performance.memory.usedJSHeapSize;
    const displayCount = this.displays.size;

    return {
      total: totalMemory,
      perDisplay: displayCount > 0 ? totalMemory / displayCount : 0,
      expected: displayCount * (this.scalingExpectations.memoryPerDisplay * 1024 * 1024),
      efficiency: displayCount > 0 ? (this.scalingExpectations.memoryPerDisplay * 1024 * 1024) / (totalMemory / displayCount) : 0
    };
  }

  /**
   * Check for resource exhaustion
   */
  checkResourceExhaustion() {
    const currentMetrics = this.scalingMetrics.current;
    if (!currentMetrics) return;

    const issues = [];

    // Check render time budget
    if (currentMetrics.totalRenderTime > this.performanceBudgets.totalFrameTime) {
      issues.push({
        type: 'render_time_exhaustion',
        current: currentMetrics.totalRenderTime,
        budget: this.performanceBudgets.totalFrameTime,
        overflow: currentMetrics.totalRenderTime - this.performanceBudgets.totalFrameTime
      });
    }

    // Check memory usage
    if (currentMetrics.memoryDistribution && performance.memory) {
      const memoryUsage = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
      if (memoryUsage > this.performanceBudgets.maxMemoryUsage) {
        issues.push({
          type: 'memory_exhaustion',
          current: memoryUsage,
          budget: this.performanceBudgets.maxMemoryUsage,
          overflow: memoryUsage - this.performanceBudgets.maxMemoryUsage
        });
      }
    }

    // Trigger resource exhaustion alerts
    issues.forEach(issue => {
      this.triggerResourceExhaustion(issue);
    });
  }

  /**
   * Establish scaling baseline with single display
   */
  establishScalingBaseline() {
    if (this.displays.size !== 1) return;

    const displayData = Array.from(this.displays.values())[0];
    const memoryUsage = performance.memory?.usedJSHeapSize || 0;

    this.scalingMetrics.baseline = {
      displayCount: 1,
      averageRenderTime: displayData.metrics.averageRenderTime,
      totalRenderTime: displayData.metrics.averageRenderTime,
      maxRenderTime: displayData.metrics.maxRenderTime,
      averageFrameRate: displayData.metrics.frameRate,
      renderEfficiency: 100,
      memoryUsage,
      establishedAt: Date.now()
    };

    console.log('[MULTI_DISPLAY_TRACKER] Scaling baseline established with single display');
  }

  /**
   * Track display lifecycle events
   */
  trackLifecycleEvent(event) {
    if (!this.displayLifecycle.has('events')) {
      this.displayLifecycle.set('events', []);
    }

    const events = this.displayLifecycle.get('events');
    events.push(event);

    // Keep manageable size
    if (events.length > 100) {
      events.shift();
    }
  }

  /**
   * Update scaling trends
   */
  updateScalingTrends() {
    if (!this.scalingMetrics.current) return;

    const trend = {
      timestamp: Date.now(),
      displayCount: this.scalingMetrics.current.displayCount,
      averageRenderTime: this.scalingMetrics.current.averageRenderTime,
      totalRenderTime: this.scalingMetrics.current.totalRenderTime,
      averageFrameRate: this.scalingMetrics.current.averageFrameRate,
      renderEfficiency: this.scalingMetrics.current.renderEfficiency
    };

    this.scalingMetrics.trends.push(trend);

    // Keep trends manageable
    if (this.scalingMetrics.trends.length > 300) { // 5 minutes at 1s intervals
      this.scalingMetrics.trends.shift();
    }
  }

  /**
   * Update display health based on scaling analysis
   */
  updateDisplayHealth(scalingAnalysis) {
    // Update global display health based on scaling performance
    for (const [displayId, displayData] of this.displays) {
      if (scalingAnalysis.status === 'critical') {
        displayData.health.status = 'critical';
        if (!displayData.health.alerts.some(a => a.type === 'system_scaling_issue')) {
          displayData.health.alerts.push({
            type: 'system_scaling_issue',
            severity: 'critical',
            message: 'System experiencing critical scaling performance issues'
          });
        }
      } else if (scalingAnalysis.status === 'degraded' && displayData.health.status === 'healthy') {
        displayData.health.status = 'warning';
      }
    }
  }

  /**
   * Get comprehensive multi-display performance summary
   */
  getPerformanceSummary() {
    const displayCount = this.displays.size;
    const currentMetrics = this.scalingMetrics.current;
    const scalingAnalysis = currentMetrics ? this.analyzeScalingPerformance(currentMetrics) : null;

    // Calculate display health distribution
    const healthCounts = {
      healthy: 0,
      warning: 0,
      critical: 0
    };

    for (const displayData of this.displays.values()) {
      healthCounts[displayData.health.status]++;
    }

    return {
      displays: {
        total: displayCount,
        health: healthCounts,
        groups: this.displayGroups.size
      },
      performance: {
        averageRenderTime: currentMetrics ? Math.round(currentMetrics.averageRenderTime * 100) / 100 : 0,
        maxRenderTime: currentMetrics ? Math.round(currentMetrics.maxRenderTime * 100) / 100 : 0,
        averageFrameRate: currentMetrics ? Math.round(currentMetrics.averageFrameRate) : 0,
        renderEfficiency: currentMetrics ? Math.round(currentMetrics.renderEfficiency) : 0
      },
      scaling: {
        status: scalingAnalysis ? scalingAnalysis.status : 'unknown',
        degradation: scalingAnalysis ? {
          renderTime: Math.round(scalingAnalysis.performanceDegradation.renderTime),
          frameRate: Math.round(scalingAnalysis.performanceDegradation.frameRate),
          efficiency: Math.round(scalingAnalysis.performanceDegradation.efficiency)
        } : null,
        overhead: scalingAnalysis ? {
          actual: Math.round(scalingAnalysis.overhead.actual * 100) / 100,
          expected: Math.round(scalingAnalysis.overhead.expected * 100) / 100,
          excess: Math.round(scalingAnalysis.overhead.excessPercent)
        } : null
      },
      resources: {
        memoryUsage: performance.memory ? {
          used: this.formatMemory(performance.memory.usedJSHeapSize),
          total: this.formatMemory(performance.memory.jsHeapSizeLimit),
          perDisplay: displayCount > 0 ? this.formatMemory(performance.memory.usedJSHeapSize / displayCount) : 0
        } : null
      }
    };
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
   * Trigger scaling issue callback
   */
  triggerScalingIssue(issueData) {
    const callback = this.callbacks.onScalingIssue;
    if (typeof callback === 'function') {
      try {
        callback(issueData);
      } catch (error) {
        console.error('[MULTI_DISPLAY_TRACKER] Error in scaling issue callback:', error);
      }
    }
  }

  /**
   * Trigger display performance alert callback
   */
  triggerDisplayPerformanceAlert(displayId, alerts) {
    const callback = this.callbacks.onDisplayPerformanceAlert;
    if (typeof callback === 'function') {
      try {
        callback({ displayId, alerts });
      } catch (error) {
        console.error('[MULTI_DISPLAY_TRACKER] Error in display performance alert callback:', error);
      }
    }
  }

  /**
   * Trigger resource exhaustion callback
   */
  triggerResourceExhaustion(exhaustionData) {
    const callback = this.callbacks.onResourceExhaustion;
    if (typeof callback === 'function') {
      try {
        callback(exhaustionData);
      } catch (error) {
        console.error('[MULTI_DISPLAY_TRACKER] Error in resource exhaustion callback:', error);
      }
    }
  }

  /**
   * Trigger scaling breakpoint callback
   */
  triggerScalingBreakpoint(scalingAnalysis) {
    const callback = this.callbacks.onScalingBreakpoint;
    if (typeof callback === 'function') {
      try {
        callback(scalingAnalysis);
      } catch (error) {
        console.error('[MULTI_DISPLAY_TRACKER] Error in scaling breakpoint callback:', error);
      }
    }
  }

  /**
   * Export comprehensive multi-display data
   */
  exportData() {
    return {
      configuration: {
        maxDisplays: this.maxDisplays,
        trackingInterval: this.trackingInterval,
        scalingExpectations: this.scalingExpectations,
        performanceBudgets: this.performanceBudgets
      },
      displays: Object.fromEntries(this.displays),
      displayGroups: Object.fromEntries(this.displayGroups),
      scaling: {
        baseline: this.scalingMetrics.baseline,
        current: this.scalingMetrics.current,
        trends: this.scalingMetrics.trends.slice(-100), // Last 100 trends
        breakpoints: this.scalingMetrics.breakpoints
      },
      lifecycle: {
        events: this.displayLifecycle.get('events') || []
      },
      summary: this.getPerformanceSummary(),
      exportTimestamp: Date.now()
    };
  }

  /**
   * Reset multi-display tracking
   */
  reset() {
    this.stopTracking();

    this.displays.clear();
    this.displayGroups.clear();
    this.displayLifecycle.clear();
    this.interactionMetrics.clear();

    this.scalingMetrics = {
      baseline: null,
      current: null,
      trends: [],
      breakpoints: []
    };

    console.log('[MULTI_DISPLAY_TRACKER] Multi-display tracker reset');
  }
}

/**
 * Global multi-display tracker instance
 */
export const globalMultiDisplayTracker = new MultiDisplayPerformanceTracker();

/**
 * Convenience function to start multi-display tracking
 */
export function startMultiDisplayTracking(options = {}) {
  const tracker = new MultiDisplayPerformanceTracker(options);
  tracker.startTracking();
  return tracker;
}