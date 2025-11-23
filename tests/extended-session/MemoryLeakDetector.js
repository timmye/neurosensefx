/**
 * Memory Leak Detector
 *
 * Advanced memory leak detection and analysis system for extended session testing.
 * Provides component-level memory tracking, leak identification, and detailed analysis.
 */

export class MemoryLeakDetector {
  constructor() {
    this.sessionId = null;
    this.isInitialized = false;
    this.sensitivityLevel = 'medium';
    this.baselineMeasurements = null;
    this.componentMemoryMap = new Map();
    this.memorySnapshots = [];
    this.leakThresholds = {
      low: 5 * 1024 * 1024,    // 5MB
      medium: 10 * 1024 * 1024, // 10MB
      high: 20 * 1024 * 1024    // 20MB
    };
    this.componentTrackers = new Map();
    this.objectRegistry = new WeakMap();
    this.leakCandidates = new Map();
  }

  async initialize(options = {}) {
    this.sessionId = options.sessionId;
    this.sensitivityLevel = options.sensitivityLevel || 'medium';
    this.isInitialized = true;

    // Initialize component tracking
    this.initializeComponentTracking();

    // Take baseline measurements
    await this.takeBaselineMeasurements();

    console.log(`🔍 Memory Leak Detector initialized with sensitivity: ${this.sensitivityLevel}`);
  }

  /**
   * Initialize component-level memory tracking
   */
  initializeComponentTracking() {
    // Override constructors to track object creation
    this.setupObjectTracking();

    // Setup component lifecycle monitoring
    this.setupComponentLifecycleMonitoring();

    // Setup DOM mutation observer
    this.setupDOMMutationObserver();

    // Setup memory pressure monitoring
    this.setupMemoryPressureMonitoring();
  }

  /**
   * Setup object tracking for memory leak detection
   */
  setupObjectTracking() {
    // Track image objects
    const originalImage = window.Image;
    window.Image = function(...args) {
      const img = new originalImage(...args);
      const tracker = {
        type: 'Image',
        created: Date.now(),
        src: null,
        size: 0
      };

      // Monitor src changes
      const originalSetSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src').set;
      Object.defineProperty(img, 'src', {
        set: function(value) {
          tracker.src = value;
          tracker.lastModified = Date.now();
          return originalSetSrc.call(this, value);
        },
        get: function() {
          return this.getAttribute('src');
        }
      });

      this.objectRegistry.set(img, tracker);
      return img;
    }.bind(this);

    // Track canvas contexts
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(...args) {
      const ctx = originalGetContext.apply(this, args);
      if (ctx && args[0] === '2d') {
        const tracker = {
          type: 'Canvas2DContext',
          created: Date.now(),
          canvas: this,
          width: this.width,
          height: this.height,
          operations: 0
        };

        this.objectRegistry.set(ctx, tracker);

        // Monitor context operations
        const originalFillRect = ctx.fillRect;
        ctx.fillRect = function(...args) {
          tracker.operations++;
          return originalFillRect.apply(this, args);
        };
      }
      return ctx;
    }.bind(this);
  }

  /**
   * Setup component lifecycle monitoring
   */
  setupComponentLifecycleMonitoring() {
    // Monitor display component creation/destruction
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.classList && node.classList.contains('enhanced-floating')) {
            this.trackDisplayComponent(node);
          }
        });

        mutation.removedNodes.forEach(node => {
          if (node.classList && node.classList.contains('enhanced-floating')) {
            this.untrackDisplayComponent(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    this.componentTrackers.set('dom', observer);
  }

  /**
   * Setup DOM mutation observer for tracking DOM leaks
   */
  setupDOMMutationObserver() {
    let domNodes = document.querySelectorAll('*').length;
    this.componentMemoryMap.set('domNodes', { initial: domNodes, current: domNodes });

    setInterval(() => {
      const current = document.querySelectorAll('*').length;
      const growth = current - domNodes;

      if (growth > 100) { // Significant DOM growth
        this.recordLeakCandidate({
          type: 'dom_growth',
          severity: growth > 500 ? 'high' : 'medium',
          details: { growth, current, previous: domNodes },
          timestamp: Date.now()
        });
      }

      this.componentMemoryMap.set('domNodes', {
        initial: this.componentMemoryMap.get('domNodes').initial,
        current
      });
      domNodes = current;
    }, 30000); // Check every 30 seconds
  }

  /**
   * Setup memory pressure monitoring
   */
  setupMemoryPressureMonitoring() {
    if ('memory' in performance) {
      setInterval(() => {
        const memoryInfo = performance.memory;
        const utilization = memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit;

        if (utilization > 0.85) {
          this.recordLeakCandidate({
            type: 'memory_pressure',
            severity: utilization > 0.95 ? 'critical' : 'high',
            details: {
              utilization: (utilization * 100).toFixed(1),
              used: memoryInfo.usedJSHeapSize,
              limit: memoryInfo.jsHeapSizeLimit
            },
            timestamp: Date.now()
          });
        }
      }, 10000); // Check every 10 seconds
    }
  }

  /**
   * Take baseline measurements for comparison
   */
  async takeBaselineMeasurements() {
    this.baselineMeasurements = {
      timestamp: Date.now(),
      memory: performance.memory ? {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      } : null,
      domNodes: document.querySelectorAll('*').length,
      canvasElements: document.querySelectorAll('canvas').length,
      enhancedDisplays: document.querySelectorAll('.enhanced-floating').length,
      eventListeners: this.estimateEventListeners()
    };

    console.log('📊 Baseline measurements taken');
  }

  /**
   * Track display component memory usage
   */
  trackDisplayComponent(display) {
    const displayId = display.dataset.displayId || `display_${Date.now()}`;
    const canvas = display.querySelector('canvas');

    const tracker = {
      displayId,
      created: Date.now(),
      element: display,
      canvas,
      memoryEstimate: this.estimateDisplayMemory(display),
      eventListeners: this.estimateDisplayEventListeners(display)
    };

    this.componentTrackers.set(displayId, tracker);

    // Monitor for memory growth within the display
    this.monitorDisplayMemory(displayId);
  }

  /**
   * Untrack display component
   */
  untrackDisplayComponent(display) {
    const displayId = display.dataset.displayId;
    const tracker = this.componentTrackers.get(displayId);

    if (tracker) {
      // Check for proper cleanup
      const finalMemory = this.estimateDisplayMemory(display);
      const memoryDifference = finalMemory - tracker.memoryEstimate;

      if (memoryDifference > 1024 * 1024) { // More than 1MB difference
        this.recordLeakCandidate({
          type: 'display_cleanup',
          severity: 'medium',
          details: {
            displayId,
            memoryDifference,
            finalMemory,
            initialMemory: tracker.memoryEstimate
          },
          timestamp: Date.now()
        });
      }

      this.componentTrackers.delete(displayId);
    }
  }

  /**
   * Monitor individual display memory growth
   */
  monitorDisplayMemory(displayId) {
    const tracker = this.componentTrackers.get(displayId);
    if (!tracker) return;

    const interval = setInterval(() => {
      if (!document.contains(tracker.element)) {
        clearInterval(interval);
        return;
      }

      const currentMemory = this.estimateDisplayMemory(tracker.element);
      const memoryGrowth = currentMemory - tracker.memoryEstimate;
      tracker.memoryEstimate = currentMemory;

      if (memoryGrowth > this.leakThresholds[this.sensitivityLevel]) {
        this.recordLeakCandidate({
          type: 'display_memory_leak',
          severity: 'high',
          details: {
            displayId,
            memoryGrowth,
            currentMemory,
            growthRate: (memoryGrowth / ((Date.now() - tracker.created) / 1000)).toFixed(2)
          },
          timestamp: Date.now()
        });
      }
    }, 60000); // Check every minute

    tracker.monitoringInterval = interval;
  }

  /**
   * Estimate memory usage of a display component
   */
  estimateDisplayMemory(display) {
    let memoryEstimate = 0;

    // Canvas memory
    const canvas = display.querySelector('canvas');
    if (canvas) {
      memoryEstimate += canvas.width * canvas.height * 4; // 4 bytes per pixel (RGBA)
    }

    // DOM element memory (rough estimate)
    const elementCount = display.querySelectorAll('*').length;
    memoryEstimate += elementCount * 200; // Rough estimate per element

    // Event listeners memory
    memoryEstimate += this.estimateDisplayEventListeners(display) * 100;

    // Text content memory
    const textContent = display.textContent || '';
    memoryEstimate += textContent.length * 2; // 2 bytes per character

    return memoryEstimate;
  }

  /**
   * Estimate event listeners for a display
   */
  estimateDisplayEventListeners(display) {
    // This is a rough estimation
    const interactiveElements = display.querySelectorAll('button, input, select, canvas, .enhanced-floating');
    return interactiveElements.length * 2; // Average 2 listeners per interactive element
  }

  /**
   * Estimate total event listeners in the application
   */
  estimateEventListeners() {
    let totalListeners = 0;

    // Document listeners
    totalListeners += 5; // Estimate for document-level listeners

    // Window listeners
    totalListeners += 3; // Estimate for window-level listeners

    // Interactive elements
    const interactiveElements = document.querySelectorAll('button, input, select, canvas, .enhanced-floating');
    totalListeners += interactiveElements.length * 3; // Average 3 listeners per element

    return totalListeners;
  }

  /**
   * Record a potential memory leak
   */
  recordLeakCandidate(candidate) {
    const id = `leak_${candidate.type}_${Date.now()}`;
    this.leakCandidates.set(id, candidate);

    console.warn(`🚨 Memory leak candidate detected:`, candidate);

    // Trigger leak analysis
    this.analyzeLeakCandidate(candidate);
  }

  /**
   * Analyze a memory leak candidate
   */
  analyzeLeakCandidate(candidate) {
    let analysis = { ...candidate };

    switch (candidate.type) {
      case 'display_memory_leak':
        analysis = this.analyzeDisplayMemoryLeak(candidate);
        break;
      case 'dom_growth':
        analysis = this.analyzeDOMGrowth(candidate);
        break;
      case 'memory_pressure':
        analysis = this.analyzeMemoryPressure(candidate);
        break;
      case 'display_cleanup':
        analysis = this.analyzeDisplayCleanup(candidate);
        break;
    }

    return analysis;
  }

  /**
   * Analyze display-specific memory leak
   */
  analyzeDisplayMemoryLeak(candidate) {
    const tracker = this.componentTrackers.get(candidate.details.displayId);

    return {
      ...candidate,
      analysis: {
        likelyCause: this.identifyLikelyCause(tracker),
        recommendedAction: this.getRecommendedAction(candidate),
        severityScore: this.calculateSeverityScore(candidate)
      }
    };
  }

  /**
   * Analyze DOM growth
   */
  analyzeDOMGrowth(candidate) {
    const growthRate = candidate.details.growth / ((Date.now() - this.baselineMeasurements.timestamp) / 1000);

    return {
      ...candidate,
      analysis: {
        growthRate: growthRate.toFixed(2),
        likelyCause: 'Excessive DOM element creation without cleanup',
        recommendedAction: 'Review DOM manipulation code and ensure proper element removal'
      }
    };
  }

  /**
   * Analyze memory pressure
   */
  analyzeMemoryPressure(candidate) {
    return {
      ...candidate,
      analysis: {
        urgency: candidate.details.utilization > 0.95 ? 'critical' : 'high',
        likelyCause: 'Memory accumulation over time',
        recommendedAction: 'Immediate garbage collection and leak investigation'
      }
    };
  }

  /**
   * Analyze display cleanup issues
   */
  analyzeDisplayCleanup(candidate) {
    return {
      ...candidate,
      analysis: {
        cleanupEfficiency: ((candidate.details.initialMemory - candidate.details.finalMemory) / candidate.details.initialMemory * 100).toFixed(1),
        likelyCause: 'Incomplete cleanup of display resources',
        recommendedAction: 'Review display destruction lifecycle'
      }
    };
  }

  /**
   * Identify likely cause of display memory leak
   */
  identifyLikelyCause(tracker) {
    if (!tracker) return 'Unknown';

    const canvas = tracker.canvas;
    if (canvas && canvas.width * canvas.height > 1000000) {
      return 'Large canvas not properly disposed';
    }

    if (tracker.eventListeners > 10) {
      return 'Event listeners not removed';
    }

    return 'General memory accumulation';
  }

  /**
   * Get recommended action for leak
   */
  getRecommendedAction(candidate) {
    const actions = {
      'display_memory_leak': 'Implement proper display cleanup and canvas disposal',
      'dom_growth': 'Review DOM manipulation patterns and implement cleanup',
      'memory_pressure': 'Force garbage collection and investigate memory accumulation',
      'display_cleanup': 'Enhance display destruction lifecycle'
    };

    return actions[candidate.type] || 'Investigate memory management';
  }

  /**
   * Calculate severity score
   */
  calculateSeverityScore(candidate) {
    let score = 0;

    if (candidate.type === 'display_memory_leak') {
      score = Math.min(100, candidate.details.memoryGrowth / (1024 * 1024) * 10);
    } else if (candidate.type === 'dom_growth') {
      score = Math.min(100, candidate.details.growth / 10);
    } else if (candidate.type === 'memory_pressure') {
      score = parseFloat(candidate.details.utilization) * 100;
    }

    return Math.round(score);
  }

  /**
   * Analyze memory snapshot for leaks
   */
  async analyzeMemorySnapshot(snapshot) {
    if (!this.baselineMeasurements) {
      return { hasLeaks: false, reason: 'No baseline measurements' };
    }

    const analysis = {
      timestamp: snapshot.timestamp,
      hasLeaks: false,
      leaks: [],
      summary: {}
    };

    // Analyze overall memory growth
    if (snapshot.usedJSHeapSize && this.baselineMeasurements.memory) {
      const memoryGrowth = snapshot.usedJSHeapSize - this.baselineMeasurements.memory.used;
      const memoryGrowthMB = memoryGrowth / (1024 * 1024);

      if (memoryGrowthMB > 50) { // 50MB growth threshold
        analysis.hasLeaks = true;
        analysis.leaks.push({
          type: 'overall_memory_growth',
          severity: memoryGrowthMB > 100 ? 'critical' : 'high',
          memoryGrowthMB: memoryGrowthMB.toFixed(2),
          growthRate: (memoryGrowthMB / ((snapshot.timestamp - this.baselineMeasurements.timestamp) / (1000 * 60 * 60))).toFixed(2)
        });
      }

      analysis.summary.memoryGrowthMB = memoryGrowthMB.toFixed(2);
    }

    // Analyze component-specific growth
    const currentDOMNodes = document.querySelectorAll('*').length;
    const domGrowth = currentDOMNodes - this.baselineMeasurements.domNodes;

    if (domGrowth > 100) {
      analysis.hasLeaks = true;
      analysis.leaks.push({
        type: 'dom_growth',
        severity: domGrowth > 500 ? 'high' : 'medium',
        domGrowth: domGrowth,
        growthRate: (domGrowth / ((snapshot.timestamp - this.baselineMeasurements.timestamp) / (1000 * 60 * 60))).toFixed(2)
      });
    }

    analysis.summary.domGrowth = domGrowth;

    // Check for canvas leaks
    const currentCanvasElements = document.querySelectorAll('canvas').length;
    const canvasGrowth = currentCanvasElements - this.baselineMeasurements.canvasElements;

    if (canvasGrowth > 0) {
      analysis.leaks.push({
        type: 'canvas_growth',
        severity: canvasGrowth > 5 ? 'medium' : 'low',
        canvasGrowth
      });
    }

    analysis.summary.canvasGrowth = canvasGrowth;

    // Include leak candidates from ongoing monitoring
    const recentLeakCandidates = Array.from(this.leakCandidates.values())
      .filter(candidate => snapshot.timestamp - candidate.timestamp < 300000); // Last 5 minutes

    if (recentLeakCandidates.length > 0) {
      analysis.hasLeaks = true;
      analysis.leaks.push(...recentLeakCandidates);
    }

    analysis.totalLeaks = analysis.leaks.length;
    analysis.severity = this.calculateOverallSeverity(analysis.leaks);

    return analysis;
  }

  /**
   * Calculate overall severity from multiple leaks
   */
  calculateOverallSeverity(leaks) {
    if (leaks.length === 0) return 'none';

    const criticalLeaks = leaks.filter(l => l.severity === 'critical').length;
    const highLeaks = leaks.filter(l => l.severity === 'high').length;

    if (criticalLeaks > 0) return 'critical';
    if (highLeaks > 0 || leaks.length > 3) return 'high';
    if (leaks.length > 1) return 'medium';
    return 'low';
  }

  /**
   * Get comprehensive memory leak report
   */
  getMemoryLeakReport() {
    const now = Date.now();
    const recentLeaks = Array.from(this.leakCandidates.values())
      .filter(leak => now - leak.timestamp < 3600000); // Last hour

    const leaksByType = {};
    recentLeaks.forEach(leak => {
      leaksByType[leak.type] = (leaksByType[leak.type] || 0) + 1;
    });

    const leaksBySeverity = {};
    recentLeaks.forEach(leak => {
      leaksBySeverity[leak.severity] = (leaksBySeverity[leak.severity] || 0) + 1;
    });

    return {
      session: this.sessionId,
      generatedAt: now,
      totalLeaks: this.leakCandidates.size,
      recentLeaks: recentLeaks.length,
      leaksByType,
      leaksBySeverity,
      componentTrackers: this.componentTrackers.size,
      baselineMemory: this.baselineMeasurements,
      recommendations: this.generateLeakRecommendations(recentLeaks)
    };
  }

  /**
   * Generate recommendations based on detected leaks
   */
  generateLeakRecommendations(leaks) {
    const recommendations = [];

    if (leaks.length === 0) {
      recommendations.push('No memory leaks detected - system performing well');
      return recommendations;
    }

    // Analyze leak patterns
    const leakTypes = leaks.reduce((types, leak) => {
      types[leak.type] = (types[leak.type] || 0) + 1;
      return types;
    }, {});

    if (leakTypes.display_memory_leak > 0) {
      recommendations.push({
        priority: 'high',
        category: 'Display Memory',
        title: 'Display Component Memory Leaks',
        description: `${leakTypes.display_memory_leak} display(s) showing excessive memory growth`,
        action: 'Review display lifecycle management and implement proper cleanup'
      });
    }

    if (leakTypes.dom_growth > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'DOM Management',
        title: 'Excessive DOM Growth',
        description: `${leakTypes.dom_growth} instances of uncontrolled DOM element creation`,
        action: 'Implement proper DOM cleanup and avoid memory-intensive DOM operations'
      });
    }

    if (leakTypes.memory_pressure > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'Memory Pressure',
        title: 'High Memory Utilization',
        description: 'System experiencing memory pressure issues',
        action: 'Investigate memory accumulation patterns and optimize resource usage'
      });
    }

    return recommendations;
  }

  /**
   * Cleanup detector resources
   */
  cleanup() {
    // Clear component trackers
    for (const [id, tracker] of this.componentTrackers) {
      if (tracker.monitoringInterval) {
        clearInterval(tracker.monitoringInterval);
      }
    }

    // Clear mutation observers
    const domObserver = this.componentTrackers.get('dom');
    if (domObserver) {
      domObserver.disconnect();
    }

    // Clear leak candidates
    this.leakCandidates.clear();

    console.log('🧹 Memory Leak Detector cleaned up');
  }
}

export default MemoryLeakDetector;