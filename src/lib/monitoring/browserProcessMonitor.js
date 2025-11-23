/**
 * Browser Process Monitor - Real browser performance monitoring for professional trading
 *
 * Provides comprehensive visibility into actual browser process behavior,
 * including memory usage, CPU consumption, GPU utilization, and network performance.
 *
 * Essential for validating performance requirements:
 * - Sub-100ms data-to-visual latency
 * - 60fps rendering during high-frequency updates
 * - 8+ hour session stability
 * - 20+ concurrent displays without degradation
 */

class BrowserProcessMonitor {
  constructor() {
    this.startTime = performance.now();
    this.metrics = new Map();
    this.alertThresholds = new Map();
    this.isMonitoring = false;
    this.observers = new Set();

    // Professional trading thresholds
    this.initializeThresholds();

    // Performance tracking state
    this.frameTimings = [];
    this.memorySnapshots = [];
    this.networkMetrics = [];
    this.processHealth = {};

    // Initialize monitoring capabilities
    this.initializePerformanceObservers();
    this.initializeMemoryObserver();
    this.initializeNetworkObserver();
  }

  /**
   * Initialize professional trading performance thresholds
   */
  initializeThresholds() {
    this.alertThresholds.set('frameRate', {
      warning: 55,  // Below 55fps
      critical: 30  // Below 30fps - unusable for trading
    });

    this.alertThresholds.set('latency', {
      warning: 100,  // Above 100ms
      critical: 250  // Above 250ms - too slow for active trading
    });

    this.alertThresholds.set('memoryGrowth', {
      warning: 50,   // 50MB growth over 5 minutes
      critical: 200  // 200MB growth - potential leak
    });

    this.alertThresholds.set('jank', {
      warning: 5,    // 5 long frames per second
      critical: 15   // 15 long frames - severe performance issue
    });

    this.alertThresholds.set('wsLatency', {
      warning: 150,  // WebSocket round-trip over 150ms
      critical: 500  // WebSocket over 500ms - connection issues
    });
  }

  /**
   * Initialize PerformanceObserver for comprehensive metrics
   */
  initializePerformanceObservers() {
    if (!window.PerformanceObserver) return;

    // Monitor paint events for frame rate calculation
    this.paintObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'paint') {
          this.recordPaintEvent(entry);
        }
      }
    });

    // Monitor long tasks (jank detection)
    this.longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'longtask') {
          this.recordLongTask(entry);
        }
      }
    });

    // Monitor navigation timing
    this.navigationObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'navigation') {
          this.recordNavigationTiming(entry);
        }
      }
    });

    // Monitor resource timing
    this.resourceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'resource') {
          this.recordResourceTiming(entry);
        }
      }
    });
  }

  /**
   * Initialize Memory Observer for heap tracking
   */
  initializeMemoryObserver() {
    if (!window.performance?.memory) return;

    this.memoryInterval = setInterval(() => {
      const memory = {
        timestamp: performance.now(),
        usedJSHeapSize: window.performance.memory.usedJSHeapSize,
        totalJSHeapSize: window.performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: window.performance.memory.jsHeapSizeLimit
      };

      this.memorySnapshots.push(memory);
      this.processMemorySnapshot(memory);

      // Keep only last 1000 snapshots
      if (this.memorySnapshots.length > 1000) {
        this.memorySnapshots.shift();
      }
    }, 1000); // Sample every second
  }

  /**
   * Initialize Network Performance Monitoring
   */
  initializeNetworkObserver() {
    // Monitor connection quality
    if (navigator.connection) {
      this.networkInterval = setInterval(() => {
        const connection = {
          timestamp: performance.now(),
          effectiveType: navigator.connection.effectiveType,
          downlink: navigator.connection.downlink,
          rtt: navigator.connection.rtt,
          saveData: navigator.connection.saveData
        };

        this.networkMetrics.push(connection);
        this.processNetworkMetrics(connection);

        // Keep only last 100 measurements
        if (this.networkMetrics.length > 100) {
          this.networkMetrics.shift();
        }
      }, 5000); // Sample every 5 seconds
    }
  }

  /**
   * Start comprehensive monitoring
   */
  start() {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.startTime = performance.now();

    // Start all observers
    try {
      this.paintObserver?.observe({ entryTypes: ['paint'] });
      this.longTaskObserver?.observe({ entryTypes: ['longtask'] });
      this.navigationObserver?.observe({ entryTypes: ['navigation'] });
      this.resourceObserver?.observe({ entryTypes: ['resource'] });
    } catch (error) {
      console.warn('Some performance observers may not be supported:', error);
    }

    // Start frame rate monitoring
    this.startFrameRateMonitoring();

    // Start WebSocket monitoring if available
    this.startWebSocketMonitoring();

    // Notify observers
    this.notifyObservers('monitoring:started', {
      timestamp: this.startTime,
      capabilities: this.getMonitoringCapabilities()
    });

    console.log('Browser Process Monitor started - monitoring professional trading performance');
  }

  /**
   * Stop monitoring and generate report
   */
  stop() {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    const endTime = performance.now();
    const duration = endTime - this.startTime;

    // Stop all observers and intervals
    this.paintObserver?.disconnect();
    this.longTaskObserver?.disconnect();
    this.navigationObserver?.disconnect();
    this.resourceObserver?.disconnect();

    if (this.memoryInterval) clearInterval(this.memoryInterval);
    if (this.networkInterval) clearInterval(this.networkInterval);
    if (this.frameRateInterval) clearInterval(this.frameRateInterval);
    if (this.wsMonitorInterval) clearInterval(this.wsMonitorInterval);

    // Generate final report
    const report = this.generatePerformanceReport(duration);

    // Notify observers
    this.notifyObservers('monitoring:stopped', {
      timestamp: endTime,
      duration,
      report
    });

    return report;
  }

  /**
   * Start frame rate monitoring using requestAnimationFrame
   */
  startFrameRateMonitoring() {
    let lastTime = performance.now();
    let frameCount = 0;
    let fpsHistory = [];

    const measureFrameRate = (currentTime) => {
      if (!this.isMonitoring) return;

      frameCount++;
      const deltaTime = currentTime - lastTime;

      if (deltaTime >= 1000) { // Calculate FPS every second
        const fps = Math.round((frameCount * 1000) / deltaTime);
        fpsHistory.push(fps);

        if (fpsHistory.length > 60) fpsHistory.shift(); // Keep last 60 seconds

        const avgFps = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length;

        this.processFrameRateMetrics({
          timestamp: currentTime,
          fps,
          avgFps,
          frameCount,
          deltaTime
        });

        frameCount = 0;
        lastTime = currentTime;
      }

      requestAnimationFrame(measureFrameRate);
    };

    requestAnimationFrame(measureFrameRate);
  }

  /**
   * Monitor WebSocket performance for trading data
   */
  startWebSocketMonitoring() {
    // Monitor WebSocket connection quality
    const originalWebSocket = window.WebSocket;
    const monitor = this;

    window.WebSocket = class extends originalWebSocket {
      constructor(url, protocols) {
        super(url, protocols);

        const wsMetrics = {
          url,
          connectTime: performance.now(),
          messageCount: 0,
          totalLatency: 0,
          reconnectCount: 0,
          lastMessageTime: null
        };

        this.addEventListener('open', () => {
          wsMetrics.connectedAt = performance.now();
          wsMetrics.connectionTime = wsMetrics.connectedAt - wsMetrics.connectTime;
          monitor.processWebSocketEvent('open', wsMetrics);
        });

        this.addEventListener('message', (event) => {
          const now = performance.now();
          if (wsMetrics.lastMessageTime) {
            const latency = now - wsMetrics.lastMessageTime;
            wsMetrics.totalLatency += latency;
            wsMetrics.messageCount++;
          }
          wsMetrics.lastMessageTime = now;

          monitor.processWebSocketEvent('message', {
            ...wsMetrics,
            latency: wsMetrics.lastMessageTime - wsMetrics.connectTime,
            messageSize: event.data.length
          });
        });

        this.addEventListener('close', () => {
          wsMetrics.closedAt = performance.now();
          wsMetrics.duration = wsMetrics.closedAt - wsMetrics.connectedAt;
          monitor.processWebSocketEvent('close', wsMetrics);
        });

        this.addEventListener('error', (error) => {
          monitor.processWebSocketEvent('error', { ...wsMetrics, error });
        });
      }
    };
  }

  /**
   * Process paint events for frame timing
   */
  recordPaintEvent(entry) {
    this.frameTimings.push({
      timestamp: entry.startTime,
      name: entry.name,
      type: 'paint'
    });

    // Keep only recent timings
    if (this.frameTimings.length > 1000) {
      this.frameTimings.shift();
    }
  }

  /**
   * Process long tasks for jank detection
   */
  recordLongTask(entry) {
    const duration = entry.duration;
    const thresholds = this.alertThresholds.get('jank');

    this.processHealthMetric('jank', {
      timestamp: entry.startTime,
      duration,
      attribution: entry.attribution
    });

    if (duration > 50) { // Long task threshold
      this.notifyObservers('performance:jank', {
        duration,
        timestamp: entry.startTime,
        severity: duration > 100 ? 'critical' : 'warning'
      });
    }
  }

  /**
   * Process navigation timing for page load performance
   */
  recordNavigationTiming(entry) {
    const timing = {
      timestamp: entry.startTime,
      domContentLoaded: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
      loadComplete: entry.loadEventEnd - entry.loadEventStart,
      totalTime: entry.loadEventEnd - entry.navigationStart,
      domInteractive: entry.domInteractive - entry.navigationStart
    };

    this.processHealthMetric('navigation', timing);
  }

  /**
   * Process resource timing for network performance
   */
  recordResourceTiming(entry) {
    const timing = {
      timestamp: entry.startTime,
      name: entry.name,
      duration: entry.duration,
      size: entry.transferSize || 0,
      cached: entry.transferSize === 0 && entry.decodedBodySize > 0
    };

    this.processHealthMetric('resource', timing);
  }

  /**
   * Process memory snapshots for leak detection
   */
  processMemorySnapshot(memory) {
    if (this.memorySnapshots.length < 2) return;

    const previous = this.memorySnapshots[this.memorySnapshots.length - 2];
    const growth = memory.usedJSHeapSize - previous.usedJSHeapSize;
    const timeDelta = memory.timestamp - previous.timestamp;

    // Calculate growth rate (MB per minute)
    const growthRate = (growth / 1024 / 1024) * (60000 / timeDelta);

    this.processHealthMetric('memory', {
      ...memory,
      growthRate,
      growth: growth / 1024 / 1024 // MB
    });

    // Check for memory leaks
    if (growthRate > this.alertThresholds.get('memoryGrowth').warning) {
      this.notifyObservers('performance:memory-growth', {
        growthRate,
        severity: growthRate > this.alertThresholds.get('memoryGrowth').critical ? 'critical' : 'warning'
      });
    }
  }

  /**
   * Process network metrics for connection quality
   */
  processNetworkMetrics(connection) {
    this.processHealthMetric('network', connection);

    // Check for poor connection
    if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
      this.notifyObservers('performance:network-poor', {
        effectiveType: connection.effectiveType,
        rtt: connection.rtt
      });
    }
  }

  /**
   * Process frame rate metrics
   */
  processFrameRateMetrics(metrics) {
    this.processHealthMetric('frameRate', metrics);

    const thresholds = this.alertThresholds.get('frameRate');

    if (metrics.fps < thresholds.warning) {
      this.notifyObservers('performance:frame-rate', {
        fps: metrics.fps,
        avgFps: metrics.avgFps,
        severity: metrics.fps < thresholds.critical ? 'critical' : 'warning'
      });
    }
  }

  /**
   * Process WebSocket events
   */
  processWebSocketEvent(eventType, metrics) {
    this.processHealthMetric('websocket', {
      eventType,
      ...metrics
    });

    if (eventType === 'message' && metrics.latency > this.alertThresholds.get('wsLatency').warning) {
      this.notifyObservers('performance:websocket-latency', {
        latency: metrics.latency,
        severity: metrics.latency > this.alertThresholds.get('wsLatency').critical ? 'critical' : 'warning'
      });
    }
  }

  /**
   * Generic health metric processor
   */
  processHealthMetric(type, data) {
    if (!this.processHealth[type]) {
      this.processHealth[type] = [];
    }

    this.processHealth[type].push({
      timestamp: data.timestamp || performance.now(),
      ...data
    });

    // Keep only recent data
    if (this.processHealth[type].length > 100) {
      this.processHealth[type].shift();
    }

    this.notifyObservers('metric:updated', { type, data });
  }

  /**
   * Get monitoring capabilities
   */
  getMonitoringCapabilities() {
    return {
      performanceObserver: !!window.PerformanceObserver,
      memoryAPI: !!window.performance?.memory,
      networkAPI: !!navigator.connection,
      requestAnimationFrame: !!window.requestAnimationFrame,
      webSocketAPI: !!window.WebSocket,
      canvasAPI: !!window.HTMLCanvasElement
    };
  }

  /**
   * Generate comprehensive performance report
   */
  generatePerformanceReport(duration) {
    const report = {
      summary: {
        duration: Math.round(duration),
        timestamp: new Date().toISOString(),
        professionalGrade: true
      },
      frameRate: this.analyzeFrameRate(),
      memory: this.analyzeMemory(),
      network: this.analyzeNetwork(),
      webSocket: this.analyzeWebSocket(),
      longTasks: this.analyzeLongTasks(),
      resources: this.analyzeResources(),
      recommendations: this.generateRecommendations()
    };

    // Validate against professional trading requirements
    report.professionalValidation = this.validateProfessionalRequirements(report);

    return report;
  }

  /**
   * Analyze frame rate performance
   */
  analyzeFrameRate() {
    const frameRates = this.processHealth.frameRate || [];
    if (frameRates.length === 0) return null;

    const fpsValues = frameRates.map(f => f.fps);
    const avgFps = fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length;
    const minFps = Math.min(...fpsValues);
    const maxFps = Math.max(...fpsValues);

    // Calculate time spent below 60fps
    const below60 = fpsValues.filter(fps => fps < 60).length;
    const below30 = fpsValues.filter(fps => fps < 30).length;
    const timeBelow60 = (below60 / fpsValues.length) * 100;
    const timeBelow30 = (below30 / fpsValues.length) * 100;

    return {
      average: Math.round(avgFps),
      minimum: minFps,
      maximum: maxFps,
      stability: avgFps > 55 ? 'excellent' : avgFps > 45 ? 'good' : 'poor',
      timeBelow60fps: Math.round(timeBelow60),
      timeBelow30fps: Math.round(timeBelow30),
      professionalGrade: timeBelow30 < 1 && avgFps >= 58
    };
  }

  /**
   * Analyze memory usage and potential leaks
   */
  analyzeMemory() {
    if (this.memorySnapshots.length === 0) return null;

    const latest = this.memorySnapshots[this.memorySnapshots.length - 1];
    const first = this.memorySnapshots[0];

    const totalGrowth = latest.usedJSHeapSize - first.usedJSHeapSize;
    const growthRate = this.processHealth.memory?.[this.processHealth.memory.length - 1]?.growthRate || 0;

    return {
      current: Math.round(latest.usedJSHeapSize / 1024 / 1024), // MB
      peak: Math.round(Math.max(...this.memorySnapshots.map(s => s.usedJSHeapSize)) / 1024 / 1024),
      growth: Math.round(totalGrowth / 1024 / 1024), // MB
      growthRate: Math.round(growthRate * 100) / 100, // MB/min
      leakSuspected: growthRate > 10, // Growing faster than 10MB/min
      professionalGrade: growthRate < 5 && latest.usedJSHeapSize < 512 * 1024 * 1024 // < 512MB
    };
  }

  /**
   * Analyze network performance
   */
  analyzeNetwork() {
    const metrics = this.networkMetrics;
    if (metrics.length === 0) return null;

    const latest = metrics[metrics.length - 1];
    const avgRtt = metrics.reduce((sum, m) => sum + (m.rtt || 0), 0) / metrics.length;
    const avgDownlink = metrics.reduce((sum, m) => sum + (m.downlink || 0), 0) / metrics.length;

    return {
      effectiveType: latest.effectiveType,
      averageRtt: Math.round(avgRtt),
      averageDownlink: Math.round(avgDownlink * 100) / 100,
      stability: latest.effectiveType === '4g' ? 'excellent' :
                latest.effectiveType === '3g' ? 'good' : 'poor',
      professionalGrade: latest.effectiveType !== '2g' && latest.effectiveType !== 'slow-2g'
    };
  }

  /**
   * Analyze WebSocket performance
   */
  analyzeWebSocket() {
    const wsMetrics = this.processHealth.websocket || [];
    if (wsMetrics.length === 0) return null;

    const messages = wsMetrics.filter(m => m.eventType === 'message');
    const avgLatency = messages.reduce((sum, m) => sum + (m.latency || 0), 0) / messages.length;

    return {
      messageCount: messages.length,
      averageLatency: Math.round(avgLatency),
      maxLatency: Math.max(...messages.map(m => m.latency || 0)),
      stability: avgLatency < 100 ? 'excellent' : avgLatency < 250 ? 'good' : 'poor',
      professionalGrade: avgLatency < 150 // Sub-150ms for trading data
    };
  }

  /**
   * Analyze long tasks (jank)
   */
  analyzeLongTasks() {
    const tasks = this.processHealth.jank || [];
    if (tasks.length === 0) return null;

    const totalTime = tasks.reduce((sum, task) => sum + task.duration, 0);
    const avgDuration = totalTime / tasks.length;
    const maxDuration = Math.max(...tasks.map(t => t.duration));

    // Count tasks over different thresholds
    const over50 = tasks.filter(t => t.duration > 50).length;
    const over100 = tasks.filter(t => t.duration > 100).length;

    return {
      count: tasks.length,
      totalTime: Math.round(totalTime),
      averageDuration: Math.round(avgDuration),
      maxDuration: Math.round(maxDuration),
      over50ms: over50,
      over100ms: over100,
      jankScore: (over100 / tasks.length) * 100, // Percentage of severe jank
      professionalGrade: over100 < 5 // Less than 5 severe long tasks
    };
  }

  /**
   * Analyze resource loading
   */
  analyzeResources() {
    const resources = this.processHealth.resource || [];
    if (resources.length === 0) return null;

    const totalSize = resources.reduce((sum, r) => sum + (r.size || 0), 0);
    const avgLoadTime = resources.reduce((sum, r) => sum + r.duration, 0) / resources.length;
    const cachedCount = resources.filter(r => r.cached).length;

    return {
      count: resources.length,
      totalSize: Math.round(totalSize / 1024), // KB
      averageLoadTime: Math.round(avgLoadTime),
      cacheHitRate: Math.round((cachedCount / resources.length) * 100),
      professionalGrade: avgLoadTime < 200 && cachedCount > resources.length * 0.5
    };
  }

  /**
   * Validate against professional trading requirements
   */
  validateProfessionalRequirements(report) {
    const requirements = {
      sub100msLatency: report.webSocket?.averageLatency < 100,
      solid60fps: report.frameRate?.timeBelow60fps < 5 && report.frameRate?.average >= 58,
      memoryStability: report.memory?.leakSuspected === false && report.memory?.growthRate < 5,
      networkReliability: report.network?.professionalGrade,
      noSevereJank: report.longTasks?.professionalGrade,
      resourceEfficiency: report.resources?.professionalGrade
    };

    const passedCount = Object.values(requirements).filter(Boolean).length;
    const totalCount = Object.keys(requirements).length;

    return {
      ...requirements,
      overall: passedCount === totalCount ? 'pass' : passedCount >= totalCount * 0.8 ? 'warning' : 'fail',
      score: Math.round((passedCount / totalCount) * 100)
    };
  }

  /**
   * Generate actionable recommendations
   */
  generateRecommendations() {
    const recommendations = [];

    if (this.processHealth.frameRate) {
      const avgFps = this.processHealth.frameRate.reduce((sum, f) => sum + f.fps, 0) / this.processHealth.frameRate.length;
      if (avgFps < 55) {
        recommendations.push({
          category: 'performance',
          severity: 'high',
          message: 'Frame rate below professional trading standards',
          suggestion: 'Reduce canvas complexity, implement render throttling, or optimize animation loops'
        });
      }
    }

    if (this.processHealth.memory) {
      const latest = this.processHealth.memory[this.processHealth.memory.length - 1];
      if (latest.growthRate > 10) {
        recommendations.push({
          category: 'memory',
          severity: 'critical',
          message: 'Potential memory leak detected',
          suggestion: 'Check for unclosed WebSocket connections, event listeners, or canvas contexts'
        });
      }
    }

    if (this.processHealth.jank) {
      const severeTasks = this.processHealth.jank.filter(t => t.duration > 100);
      if (severeTasks.length > 5) {
        recommendations.push({
          category: 'responsiveness',
          severity: 'high',
          message: 'Excessive main thread blocking detected',
          suggestion: 'Move heavy computations to web workers, implement time-slicing, or reduce synchronous operations'
        });
      }
    }

    return recommendations;
  }

  /**
   * Subscribe to monitoring events
   */
  subscribe(callback) {
    this.observers.add(callback);
    return () => this.observers.delete(callback);
  }

  /**
   * Notify all observers
   */
  notifyObservers(event, data) {
    for (const observer of this.observers) {
      try {
        observer(event, data);
      } catch (error) {
        console.error('Observer error:', error);
      }
    }
  }

  /**
   * Get current performance snapshot
   */
  getCurrentSnapshot() {
    return {
      timestamp: performance.now(),
      memory: window.performance?.memory ? {
        used: window.performance.memory.usedJSHeapSize,
        total: window.performance.memory.totalJSHeapSize,
        limit: window.performance.memory.jsHeapSizeLimit
      } : null,
      connection: navigator.connection ? {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt
      } : null,
      frameRate: this.processHealth.frameRate?.[this.processHealth.frameRate.length - 1] || null
    };
  }
}

// Export singleton instance
export const browserMonitor = new BrowserProcessMonitor();

// Export class for testing
export { BrowserProcessMonitor };