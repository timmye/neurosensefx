/**
 * Extended Session Monitor
 *
 * Core monitoring system for real-time memory tracking, performance metrics,
 * and system health during extended testing sessions.
 */

export class ExtendedSessionMonitor {
  constructor() {
    this.sessionId = null;
    this.isInitialized = false;
    this.memorySnapshotInterval = 30000; // 30 seconds default
    this.baselineMemory = null;
    this.monitoringStartTime = null;
  }

  async initialize(options = {}) {
    this.sessionId = options.sessionId;
    this.memorySnapshotInterval = options.memorySnapshotInterval || 30000;
    this.monitoringStartTime = Date.now();
    this.isInitialized = true;

    // Take baseline memory measurement
    this.baselineMemory = await this.takeBaselineMemorySnapshot();

    console.log(`🔍 Extended Session Monitor initialized for session: ${this.sessionId}`);
  }

  /**
   * Take baseline memory snapshot
   */
  async takeBaselineMemorySnapshot() {
    const snapshot = await this.takeMemorySnapshot();
    if (snapshot) {
      snapshot.isBaseline = true;
      snapshot.label = 'baseline';
    }
    return snapshot;
  }

  /**
   * Take comprehensive memory snapshot
   */
  async takeMemorySnapshot() {
    if (!this.isInitialized) {
      throw new Error('Monitor not initialized');
    }

    const timestamp = Date.now();
    const snapshot = {
      timestamp,
      sessionId: this.sessionId,
      elapsed: this.monitoringStartTime ? timestamp - this.monitoringStartTime : 0
    };

    // JavaScript heap memory (Chrome/Edge)
    if (performance.memory) {
      snapshot.usedJSHeapSize = performance.memory.usedJSHeapSize;
      snapshot.totalJSHeapSize = performance.memory.totalJSHeapSize;
      snapshot.jsHeapSizeLimit = performance.memory.jsHeapSizeLimit;
      snapshot.usedJSHeapSizeMB = (performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(2);
      snapshot.totalJSHeapSizeMB = (performance.memory.totalJSHeapSize / (1024 * 1024)).toFixed(2);
      snapshot.jsHeapSizeLimitMB = (performance.memory.jsHeapSizeLimit / (1024 * 1024)).toFixed(2);

      // Calculate memory utilization percentage
      snapshot.memoryUtilization = ((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100).toFixed(2);
    }

    // Browser process memory estimate (available in some browsers)
    if (navigator.deviceMemory) {
      snapshot.deviceMemoryGB = navigator.deviceMemory;
    }

    // DOM-related metrics
    snapshot.domNodes = document.querySelectorAll('*').length;
    snapshot.canvasElements = document.querySelectorAll('canvas').length;
    snapshot.enhancedFloatingDisplays = document.querySelectorAll('.enhanced-floating').length;

    // WebSocket connections
    if (window.WebSocket) {
      // We can't directly count WebSocket connections, but we can monitor if any are active
      snapshot.webSocketConnections = this.estimateWebSocketConnections();
    }

    // Event listeners estimate
    snapshot.eventListeners = this.estimateEventListeners();

    // Performance timing metrics
    const navigation = performance.getEntriesByType('navigation')[0];
    if (navigation) {
      snapshot.pageLoadTime = navigation.loadEventEnd - navigation.navigationStart;
      snapshot.domContentLoadedTime = navigation.domContentLoadedEventEnd - navigation.navigationStart;
    }

    // Custom application metrics
    snapshot.applicationMetrics = await this.collectApplicationMetrics();

    // Frame rate measurement
    snapshot.frameRate = await this.measureFrameRate();

    // Response time measurement
    snapshot.responseTime = await this.measureResponseTime();

    // Memory growth from baseline
    if (this.baselineMemory && this.baselineMemory.usedJSHeapSize) {
      snapshot.memoryGrowthFromBaseline = snapshot.usedJSHeapSize - this.baselineMemory.usedJSHeapSize;
      snapshot.memoryGrowthFromBaselineMB = (snapshot.memoryGrowthFromBaseline / (1024 * 1024)).toFixed(2);
    }

    return snapshot;
  }

  /**
   * Collect application-specific metrics
   */
  async collectApplicationMetrics() {
    const metrics = {
      displayStates: {},
      renderingMetrics: {},
      marketDataMetrics: {}
    };

    try {
      // Display states
      const displays = document.querySelectorAll('.enhanced-floating');
      displays.forEach((display, index) => {
        const rect = display.getBoundingClientRect();
        const canvas = display.querySelector('canvas');

        metrics.displayStates[`display_${index}`] = {
          visible: rect.width > 0 && rect.height > 0,
          position: { x: rect.left, y: rect.top },
          dimensions: { width: rect.width, height: rect.height },
          canvasExists: !!canvas,
          canvasSize: canvas ? { width: canvas.width, height: canvas.height } : null
        };
      });

      // Rendering metrics
      if (window.frameRateHistory) {
        metrics.renderingMetrics = {
          frameRateHistory: window.frameRateHistory.slice(-10),
          averageFrameRate: window.frameRateHistory.length > 0 ?
            (window.frameRateHistory.reduce((a, b) => a + b, 0) / window.frameRateHistory.length).toFixed(1) : null
        };
      }

      // Market data metrics (if WebSocket is active)
      if (window.marketDataBuffer) {
        metrics.marketDataMetrics = {
          bufferSize: window.marketDataBuffer.length,
          lastUpdate: window.lastMarketDataUpdate || null,
          updateFrequency: this.calculateUpdateFrequency()
        };
      }

    } catch (error) {
      console.warn('Error collecting application metrics:', error);
    }

    return metrics;
  }

  /**
   * Estimate active WebSocket connections
   */
  estimateWebSocketConnections() {
    // This is an approximation - actual counting requires instrumentation
    let estimatedConnections = 0;

    // Check for WebSocket activity in console or global variables
    if (window.activeWebSocketConnections !== undefined) {
      estimatedConnections = window.activeWebSocketConnections;
    }

    // Check for common WebSocket patterns
    if (window.ws || window.websocket || window.socket) {
      estimatedConnections++;
    }

    return estimatedConnections;
  }

  /**
   * Estimate event listeners count
   */
  estimateEventListeners() {
    // This is a rough estimation based on DOM elements and common patterns
    let estimatedListeners = 0;

    // Base listeners on document
    estimatedListeners += 10; // Document-level listeners

    // Listeners on window
    estimatedListeners += 5; // Window-level listeners

    // Listeners on interactive elements
    const interactiveElements = document.querySelectorAll('button, input, select, canvas, .enhanced-floating');
    estimatedListeners += interactiveElements.length * 2; // Average 2 listeners per interactive element

    return estimatedListeners;
  }

  /**
   * Measure current frame rate
   */
  async measureFrameRate() {
    return new Promise((resolve) => {
      let frameCount = 0;
      let startTime = performance.now();

      const countFrame = () => {
        frameCount++;
        const currentTime = performance.now();
        const elapsed = currentTime - startTime;

        if (elapsed >= 1000) { // Measure for 1 second
          const fps = (frameCount / elapsed) * 1000;
          resolve({
            fps: Math.round(fps),
            framesMeasured: frameCount,
            measurementDuration: elapsed,
            timestamp: Date.now()
          });
          return;
        }

        requestAnimationFrame(countFrame);
      };

      requestAnimationFrame(countFrame);
    });
  }

  /**
   * Measure response time for user interactions
   */
  async measureResponseTime() {
    const measurements = [];

    for (let i = 0; i < 3; i++) {
      const startTime = performance.now();

      // Create a simple interaction and measure response
      const testElement = document.createElement('div');
      testElement.style.display = 'none';
      document.body.appendChild(testElement);

      // Simulate click event
      const clickEvent = new MouseEvent('click', { bubbles: true });
      testElement.dispatchEvent(clickEvent);

      const endTime = performance.now();
      document.body.removeChild(testElement);

      measurements.push(endTime - startTime);

      // Small delay between measurements
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    const avgResponseTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;

    return {
      averageResponseTime: avgResponseTime.toFixed(3),
      measurements: measurements.map(m => m.toFixed(3)),
      timestamp: Date.now()
    };
  }

  /**
   * Collect comprehensive performance metrics
   */
  async collectPerformanceMetrics() {
    const metrics = {
      timestamp: Date.now(),
      sessionId: this.sessionId
    };

    // Frame rate
    metrics.frameRate = await this.measureFrameRate();

    // Response time
    metrics.responseTime = parseFloat((await this.measureResponseTime()).averageResponseTime);

    // Navigation timing
    const navigation = performance.getEntriesByType('navigation')[0];
    if (navigation) {
      metrics.navigationTiming = {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
        loadComplete: navigation.loadEventEnd - navigation.navigationStart,
        firstPaint: performance.getEntriesByType('paint')[0]?.startTime,
        firstContentfulPaint: performance.getEntriesByType('paint')[1]?.startTime
      };
    }

    // Resource timing
    const resources = performance.getEntriesByType('resource');
    metrics.resourceMetrics = {
      totalResources: resources.length,
      totalTransferSize: resources.reduce((sum, r) => sum + (r.transferSize || 0), 0),
      averageResourceLoadTime: resources.length > 0 ?
        (resources.reduce((sum, r) => sum + (r.duration || 0), 0) / resources.length).toFixed(2) : 0
    };

    // Long tasks (jank detection)
    const longTasks = performance.getEntriesByType('longtask');
    metrics.longTasks = {
      count: longTasks.length,
      totalDuration: longTasks.reduce((sum, t) => sum + t.duration, 0),
      averageDuration: longTasks.length > 0 ?
        (longTasks.reduce((sum, t) => sum + t.duration, 0) / longTasks.length).toFixed(2) : 0
    };

    // Memory pressure
    if (performance.memory) {
      metrics.memoryPressure = {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit,
        utilization: ((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100).toFixed(2)
      };
    }

    return metrics;
  }

  /**
   * Calculate market data update frequency
   */
  calculateUpdateFrequency() {
    if (!window.marketDataTimestamps || window.marketDataTimestamps.length < 2) {
      return null;
    }

    const timestamps = window.marketDataTimestamps.slice(-10); // Last 10 updates
    const intervals = [];

    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    return (1000 / avgInterval).toFixed(1); // Updates per second
  }

  /**
   * Get memory trend analysis
   */
  getMemoryTrend(snapshots) {
    if (snapshots.length < 3) {
      return { trend: 'insufficient_data', confidence: 0 };
    }

    const recent = snapshots.slice(-10); // Last 10 snapshots
    const memoryValues = recent.map(s => s.usedJSHeapSize).filter(v => v > 0);

    if (memoryValues.length < 3) {
      return { trend: 'insufficient_data', confidence: 0 };
    }

    // Calculate linear trend
    const n = memoryValues.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = memoryValues;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const slopeMBPerHour = (slope * 3600000) / (1024 * 1024); // Convert to MB/hour

    let trend = 'stable';
    if (slopeMBPerHour > 10) trend = 'increasing_rapidly';
    else if (slopeMBPerHour > 5) trend = 'increasing_moderately';
    else if (slopeMBPerHour < -10) trend = 'decreasing_rapidly';
    else if (slopeMBPerHour < -5) trend = 'decreasing_moderately';

    // Calculate R-squared for confidence
    const meanY = sumY / n;
    const ssTotal = y.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0);
    const ssResidual = y.reduce((sum, yi, i) => {
      const predicted = (sumY / n) + slope * (x[i] - (sumX / n));
      return sum + Math.pow(yi - predicted, 2);
    }, 0);

    const rSquared = 1 - (ssResidual / ssTotal);
    const confidence = Math.max(0, Math.min(1, rSquared));

    return {
      trend,
      slope: slopeMBPerHour.toFixed(2),
      confidence: confidence.toFixed(2),
      trendDescription: this.getTrendDescription(trend, slopeMBPerHour)
    };
  }

  /**
   * Get human-readable trend description
   */
  getTrendDescription(trend, slopeMBPerHour) {
    const descriptions = {
      'stable': `Memory usage is stable (${Math.abs(slopeMBPerHour).toFixed(1)} MB/hr)`,
      'increasing_rapidly': `Memory usage increasing rapidly (${slopeMBPerHour.toFixed(1)} MB/hr)`,
      'increasing_moderately': `Memory usage increasing moderately (${slopeMBPerHour.toFixed(1)} MB/hr)`,
      'decreasing_rapidly': `Memory usage decreasing rapidly (${Math.abs(slopeMBPerHour).toFixed(1)} MB/hr)`,
      'decreasing_moderately': `Memory usage decreasing moderately (${Math.abs(slopeMBPerHour).toFixed(1)} MB/hr)`,
      'insufficient_data': 'Insufficient data for trend analysis'
    };

    return descriptions[trend] || descriptions['stable'];
  }
}

export default ExtendedSessionMonitor;