/**
 * Automated Canvas Positioning Drift Monitor
 *
 * Systematically monitors canvas positioning across all components to detect
 * and analyze drift patterns without manual intervention.
 *
 * FEATURES:
 * - Real-time position tracking across all canvas elements
 * - Automated drift detection with configurable thresholds
 * - Browser environment monitoring (DPR, zoom, resize)
 * - Performance monitoring and bottleneck identification
 * - Comprehensive diagnostic reporting
 * - Zero-interaction drift reproduction tracking
 */

class CanvasDriftMonitor {
  constructor() {
    this.isMonitoring = false;
    this.elementMonitors = new Map();
    this.globalEvents = [];
    this.driftEvents = [];
    this.performanceEvents = [];
    this.browserEnvironment = {
      dpr: window.devicePixelRatio || 1,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      pixelRatio: window.devicePixelRatio || 1,
      systemPixelRatio: window.devicePixelRatio || 1
    };

    // Configurable thresholds for drift detection
    this.thresholds = {
      positionDelta: 0.1,      // Minimum position change to consider (pixels)
      sizeDelta: 0.1,          // Minimum size change to consider (pixels)
      timeDelta: 50,           // Minimum time between events to consider (ms)
      performanceThreshold: 16.67, // Performance threshold (ms, 60fps)
      transformDelta: 0.01,   // Minimum transform matrix change
      memoryThreshold: 100     // Memory growth threshold (MB)
    };

    // Monitoring interval (ms)
    this.monitorInterval = 100; // 10Hz monitoring frequency

    this.setupGlobalEventListeners();
  }

  /**
   * Start comprehensive monitoring
   */
  startMonitoring() {
    if (this.isMonitoring) {
      console.warn('[CanvasDriftMonitor] Monitoring already active');
      return;
    }

    console.log('[CanvasDriftMonitor] Starting comprehensive canvas drift monitoring');
    this.isMonitoring = true;
    this.startPerformanceMonitoring();
    this.startEnvironmentMonitoring();
  }

  /**
   * Stop monitoring and generate final report
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      console.warn('[CanvasDriftMonitor] Monitoring not active');
      return;
    }

    console.log('[CanvasDriftMonitor] Stopping monitoring and generating report');
    this.isMonitoring = false;
    this.stopPerformanceMonitoring();
    this.stopEnvironmentMonitoring();
    this.generateDiagnosticReport();
  }

  /**
   * Register a canvas element for monitoring
   */
  registerElement(elementId, element, type = 'unknown') {
    if (!element || !elementId) {
      console.warn('[CanvasDriftMonitor] Invalid element registration');
      return;
    }

    console.log(`[CanvasDriftMonitor] Registering ${type} element:`, elementId);

    const monitor = {
      id: elementId,
      element,
      type,
      registeredAt: performance.now(),
      lastSnapshot: null,
      eventHistory: [],
      driftEvents: [],
      canvas: null,
      ctx: null
    };

    // Find canvas element if monitoring a container
    if (type === 'container' || type === 'floating') {
      const canvas = element.querySelector('canvas');
      if (canvas) {
        monitor.canvas = canvas;
        monitor.ctx = canvas.getContext('2d');
      }
    }

    this.elementMonitors.set(elementId, monitor);
  }

  /**
   * Unregister an element from monitoring
   */
  unregisterElement(elementId) {
    if (this.elementMonitors.has(elementId)) {
      console.log(`[CanvasDriftMonitor] Unregistering element:`, elementId);
      this.elementMonitors.delete(elementId);
    }
  }

  /**
   * Take a snapshot of element state
   */
  takeSnapshot(elementId, eventType = 'snapshot', metadata = {}) {
    const monitor = this.elementMonitors.get(elementId);
    if (!monitor) {
      console.warn(`[CanvasDriftMonitor] Element not found for monitoring:`, elementId);
      return null;
    }

    const timestamp = performance.now();
    const snapshot = {
      timestamp,
      eventType,
      elementId,
      type: monitor.type,
      metadata,

      // Element positioning
      elementRect: monitor.element.getBoundingClientRect(),

      // Canvas state
      canvasSize: monitor.canvas ? {
        width: monitor.canvas.width,
        height: monitor.canvas.height,
        cssWidth: monitor.canvas.style.width,
        cssHeight: monitor.canvas.style.height
      } : null,

      canvasRect: monitor.canvas ? monitor.canvas.getBoundingClientRect() : null,

      // Transform state
      transform: monitor.ctx ? {
        a: monitor.ctx.getTransform().a,
        b: monitor.ctx.getTransform().b,
        c: monitor.ctx.getTransform().c,
        d: monitor.ctx.getTransform().d,
        e: monitor.ctx.getTransform().e,
        f: monitor.ctx.getTransform().f
      } : null,

      // Browser environment
      environment: { ...this.browserEnvironment },

      // Performance
      memory: performance.memory ? {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      } : null
    };

    // Analyze for drift if we have a previous snapshot
    if (monitor.lastSnapshot) {
      const drift = this.analyzeDrift(monitor.lastSnapshot, snapshot);
      if (drift.detected) {
        this.recordDriftEvent(elementId, drift);
      }
    }

    // Update monitor state
    monitor.lastSnapshot = snapshot;
    monitor.eventHistory.push(snapshot);

    // Keep only last 50 events per element
    if (monitor.eventHistory.length > 50) {
      monitor.eventHistory.shift();
    }

    return snapshot;
  }

  /**
   * Analyze two snapshots for drift detection
   */
  analyzeDrift(previousSnapshot, currentSnapshot) {
    const timeDelta = currentSnapshot.timestamp - previousSnapshot.timestamp;

    const analysis = {
      detected: false,
      timestamp: currentSnapshot.timestamp,
      timeDelta,
      elementId: currentSnapshot.elementId,

      // Position changes
      positionDelta: {
        leftDelta: currentSnapshot.elementRect.left - previousSnapshot.elementRect.left,
        topDelta: currentSnapshot.elementRect.top - previousSnapshot.elementRect.top,
        widthDelta: currentSnapshot.elementRect.width - previousSnapshot.elementRect.width,
        heightDelta: currentSnapshot.elementRect.height - previousSnapshot.elementRect.height
      },

      // Canvas changes
      canvasDelta: currentSnapshot.canvasRect && previousSnapshot.canvasRect ? {
        leftDelta: currentSnapshot.canvasRect.left - previousSnapshot.canvasRect.left,
        topDelta: currentSnapshot.canvasRect.top - previousSnapshot.canvasRect.top,
        widthDelta: currentSnapshot.canvasRect.width - previousSnapshot.canvasRect.width,
        heightDelta: currentSnapshot.canvasRect.height - previousSnapshot.canvasRect.height
      } : null,

      // Transform changes
      transformDelta: currentSnapshot.transform && previousSnapshot.transform ? {
        aDelta: currentSnapshot.transform.a - previousSnapshot.transform.a,
        bDelta: currentSnapshot.transform.b - previousSnapshot.transform.b,
        cDelta: currentSnapshot.transform.c - previousSnapshot.transform.c,
        dDelta: currentSnapshot.transform.d - previousSnapshot.transform.d,
        eDelta: currentSnapshot.transform.e - previousSnapshot.transform.e,
        fDelta: currentSnapshot.transform.f - previousSnapshot.transform.f
      } : null,

      // Environment changes
      environmentDelta: {
        dprDelta: currentSnapshot.environment.dpr - previousSnapshot.environment.dpr,
        windowWidthDelta: currentSnapshot.environment.windowWidth - previousSnapshot.environment.windowWidth,
        windowHeightDelta: currentSnapshot.environment.windowHeight - previousSnapshot.environment.windowHeight
      }
    };

    // Check for significant changes based on thresholds
    const significantChanges = [];

    // Position drift detection
    if (Math.abs(analysis.positionDelta.leftDelta) > this.thresholds.positionDelta) {
      significantChanges.push(`left: ${analysis.positionDelta.leftDelta.toFixed(2)}px`);
    }
    if (Math.abs(analysis.positionDelta.topDelta) > this.thresholds.positionDelta) {
      significantChanges.push(`top: ${analysis.positionDelta.topDelta.toFixed(2)}px`);
    }
    if (Math.abs(analysis.positionDelta.widthDelta) > this.thresholds.sizeDelta) {
      significantChanges.push(`width: ${analysis.positionDelta.widthDelta.toFixed(2)}px`);
    }
    if (Math.abs(analysis.positionDelta.heightDelta) > this.thresholds.sizeDelta) {
      significantChanges.push(`height: ${analysis.positionDelta.heightDelta.toFixed(2)}px`);
    }

    // Canvas drift detection
    if (analysis.canvasDelta) {
      if (Math.abs(analysis.canvasDelta.leftDelta) > this.thresholds.positionDelta) {
        significantChanges.push(`canvas-left: ${analysis.canvasDelta.leftDelta.toFixed(2)}px`);
      }
      if (Math.abs(analysis.canvasDelta.topDelta) > this.thresholds.positionDelta) {
        significantChanges.push(`canvas-top: ${analysis.canvasDelta.topDelta.toFixed(2)}px`);
      }
    }

    // Transform drift detection
    if (analysis.transformDelta) {
      Object.entries(analysis.transformDelta).forEach(([key, delta]) => {
        if (Math.abs(delta) > this.thresholds.transformDelta) {
          significantChanges.push(`transform-${key}: ${delta.toFixed(4)}`);
        }
      });
    }

    // Environment changes
    if (Math.abs(analysis.environmentDelta.dprDelta) > 0.01) {
      significantChanges.push(`DPR: ${analysis.environmentDelta.dprDelta.toFixed(2)}`);
    }

    // Timing anomalies
    if (timeDelta > this.thresholds.timeDelta) {
      significantChanges.push(`timing: ${timeDelta.toFixed(0)}ms gap`);
    }

    analysis.detected = significantChanges.length > 0;
    analysis.changes = significantChanges;
    analysis.severity = this.calculateDriftSeverity(analysis);

    return analysis;
  }

  /**
   * Calculate drift severity based on magnitude of changes
   */
  calculateDriftSeverity(driftAnalysis) {
    if (!driftAnalysis.detected) return 'none';

    let severityScore = 0;

    // Position changes contribute more to severity
    severityScore += Math.abs(driftAnalysis.positionDelta.leftDelta) * 2;
    severityScore += Math.abs(driftAnalysis.positionDelta.topDelta) * 2;
    severityScore += Math.abs(driftAnalysis.positionDelta.widthDelta);
    severityScore += Math.abs(driftAnalysis.positionDelta.heightDelta);

    // Environment changes are significant
    if (Math.abs(driftAnalysis.environmentDelta.dprDelta) > 0.01) {
      severityScore += 100; // DPR changes are high severity
    }

    if (severityScore > 50) return 'high';
    if (severityScore > 10) return 'medium';
    if (severityScore > 1) return 'low';
    return 'minimal';
  }

  /**
   * Record a drift event
   */
  recordDriftEvent(elementId, driftAnalysis) {
    const monitor = this.elementMonitors.get(elementId);
    if (!monitor) return;

    console.warn(`[CanvasDriftMonitor] DRIFT DETECTED [${driftAnalysis.severity.toUpperCase()}]:`, {
      elementId,
      type: monitor.type,
      changes: driftAnalysis.changes,
      positionDelta: driftAnalysis.positionDelta,
      timeDelta: driftAnalysis.timeDelta
    });

    const driftEvent = {
      elementId,
      type: monitor.type,
      timestamp: driftAnalysis.timestamp,
      severity: driftAnalysis.severity,
      analysis: driftAnalysis
    };

    monitor.driftEvents.push(driftEvent);
    this.driftEvents.push(driftEvent);

    // Keep only last 50 drift events globally
    if (this.driftEvents.length > 50) {
      this.driftEvents.shift();
    }
  }

  /**
   * Setup global event listeners
   */
  setupGlobalEventListeners() {
    // Monitor browser zoom/DPI changes
    this.dprChecker = setInterval(() => {
      const currentDpr = window.devicePixelRatio || 1;
      if (Math.abs(currentDpr - this.browserEnvironment.dpr) > 0.01) {
        const oldDpr = this.browserEnvironment.dpr;
        this.browserEnvironment.dpr = currentDpr;
        console.warn(`[CanvasDriftMonitor] DPR change detected:`, {
          oldDpr,
          newDpr: currentDpr,
          timestamp: performance.now()
        });
      }
    }, 500);

    // Monitor window resize
    this.resizeHandler = () => {
      this.browserEnvironment.windowWidth = window.innerWidth;
      this.browserEnvironment.windowHeight = window.innerHeight;

      const event = {
        type: 'resize',
        timestamp: performance.now(),
        windowSize: { width: window.innerWidth, height: window.innerHeight }
      };

      this.globalEvents.push(event);
    };

    window.addEventListener('resize', this.resizeHandler, { passive: true });
  }

  /**
   * Start performance monitoring
   */
  startPerformanceMonitoring() {
    this.performanceMonitor = setInterval(() => {
      const now = performance.now();
      const memory = performance.memory;

      const perfEvent = {
        timestamp: now,
        memory: memory ? {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit
        } : null,
        timing: performance.timing ? {
          loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart
        } : null
      };

      this.performanceEvents.push(perfEvent);

      // Keep only last 100 performance events
      if (this.performanceEvents.length > 100) {
        this.performanceEvents.shift();
      }
    }, this.monitorInterval);
  }

  /**
   * Stop performance monitoring
   */
  stopPerformanceMonitoring() {
    if (this.performanceMonitor) {
      clearInterval(this.performanceMonitor);
      this.performanceMonitor = null;
    }
  }

  /**
   * Start environment monitoring
   */
  startEnvironmentMonitoring() {
    // Environment monitoring is handled by the DPR checker and resize handler
  }

  /**
   * Stop environment monitoring
   */
  stopEnvironmentMonitoring() {
    if (this.dprChecker) {
      clearInterval(this.dprChecker);
      this.dprChecker = null;
    }

    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
  }

  /**
   * Generate comprehensive diagnostic report
   */
  generateDiagnosticReport() {
    const report = {
      generatedAt: new Date().toISOString(),
      monitoringDuration: performance.now() - (this.globalEvents[0]?.timestamp || performance.now()),

      // Element summary
      elements: Array.from(this.elementMonitors.values()).map(monitor => ({
        id: monitor.id,
        type: monitor.type,
        totalEvents: monitor.eventHistory.length,
        driftEvents: monitor.driftEvents.length,
        registeredAt: monitor.registeredAt
      })),

      // Drift analysis
      driftSummary: {
        totalEvents: this.driftEvents.length,
        bySeverity: this.driftEvents.reduce((acc, event) => {
          acc[event.severity] = (acc[event.severity] || 0) + 1;
          return acc;
        }, {}),
        byType: this.driftEvents.reduce((acc, event) => {
          acc[event.type] = (acc[event.type] || 0) + 1;
          return acc;
        }, {})
      },

      // Recent drift events
      recentDrifts: this.driftEvents.slice(-10),

      // Performance summary
      performance: this.performanceEvents.length > 0 ? {
        totalSamples: this.performanceEvents.length,
        memoryGrowth: this.calculateMemoryGrowth(),
        averageMemoryUsage: this.calculateAverageMemoryUsage()
      } : null,

      // Environment events
      environmentEvents: this.globalEvents.filter(event => event.type === 'resize'),

      // Recommendations
      recommendations: this.generateRecommendations()
    };

    console.log('[CanvasDriftMonitor] DIAGNOSTIC REPORT:', report);

    // Store report for later access
    this.lastReport = report;

    return report;
  }

  /**
   * Calculate memory growth trend
   */
  calculateMemoryGrowth() {
    if (this.performanceEvents.length < 2 || !performance.memory) return null;

    const first = this.performanceEvents[0].memory;
    const last = this.performanceEvents[this.performanceEvents.length - 1].memory;

    if (!first || !last) return null;

    return {
      growthMB: (last.usedJSHeapSize - first.usedJSHeapSize) / 1024 / 1024,
      growthRate: ((last.usedJSHeapSize - first.usedJSHeapSize) / first.usedJSHeapSize) * 100
    };
  }

  /**
   * Calculate average memory usage
   */
  calculateAverageMemoryUsage() {
    if (!performance.memory || this.performanceEvents.length === 0) return null;

    const memoryEvents = this.performanceEvents.filter(e => e.memory);
    if (memoryEvents.length === 0) return null;

    const totalUsage = memoryEvents.reduce((sum, event) => sum + event.memory.usedJSHeapSize, 0);
    return totalUsage / memoryEvents.length / 1024 / 1024; // MB
  }

  /**
   * Generate recommendations based on findings
   */
  generateRecommendations() {
    const recommendations = [];

    const highSeverityDrifts = this.driftEvents.filter(e => e.severity === 'high');
    if (highSeverityDrifts.length > 0) {
      recommendations.push('HIGH SEVERITY DRIFT DETECTED: Implement immediate coordinate system debugging');
    }

    const memoryGrowth = this.calculateMemoryGrowth();
    if (memoryGrowth && Math.abs(memoryGrowth.growthMB) > this.thresholds.memoryThreshold) {
      recommendations.push('MEMORY GROWTH DETECTED: Investigate potential memory leaks in canvas operations');
    }

    const dprChanges = this.driftEvents.filter(e =>
      e.analysis && Math.abs(e.analysis.environmentDelta.dprDelta) > 0.01
    );
    if (dprChanges.length > 0) {
      recommendations.push('DPR CHANGES DETECTED: Implement robust device pixel ratio handling');
    }

    if (recommendations.length === 0) {
      recommendations.push('No critical issues detected - system appears stable');
    }

    return recommendations;
  }
}

// Global instance for easy access
export const canvasDriftMonitor = new CanvasDriftMonitor();

// Auto-start monitoring in development
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  canvasDriftMonitor.startMonitoring();
}

export default CanvasDriftMonitor;