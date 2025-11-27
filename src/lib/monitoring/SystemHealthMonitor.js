/**
 * System Health Monitoring and Resource Tracking
 *
 * Comprehensive system health monitoring with resource tracking, performance
 * analysis, and proactive maintenance for trading platform reliability.
 *
 * Features:
 * - Real-time system resource monitoring (CPU, memory, network)
 * - Browser performance and capacity monitoring
 * - WebSocket connection health tracking
 * - Component lifecycle management monitoring
 * - Proactive system maintenance and optimization
 * - Resource usage alerting and threshold management
 */

/**
 * System health monitoring configuration
 */
export const SYSTEM_HEALTH_CONFIG = {
  // Resource monitoring settings
  MONITOR_MEMORY_USAGE: true,
  MONITOR_CPU_USAGE: true,
  MONITOR_NETWORK_STATUS: true,
  MONITOR_BATTERY_STATUS: true,
  MONITOR_HARDWARE_CONCURRENCY: true,

  // Performance monitoring
  MONITOR_FRAME_RATE: true,
  MONITOR_RENDERING_PIPELINE: true,
  MONITOR_EVENT_LOOP: true,
  MONITOR_GC_IMPACT: true,

  // Connection monitoring
  MONITOR_WEBSOCKET_HEALTH: true,
  MONITOR_API_CONNECTIVITY: true,
  MONITOR_NETWORK_LATENCY: true,
  MONITOR_BANDWIDTH_USAGE: true,

  // Component monitoring
  MONITOR_COMPONENT_LIFECYCLE: true,
  MONITOR_CANVAS_HEALTH: true,
  MONITOR_STORE_HEALTH: true,
  MONITOR_WORKER_HEALTH: true,

  // Health thresholds
  CRITICAL_MEMORY_THRESHOLD: 90,      // 90% memory usage
  WARNING_MEMORY_THRESHOLD: 75,       // 75% memory usage
  CRITICAL_CPU_THRESHOLD: 95,         // 95% CPU usage
  WARNING_CPU_THRESHOLD: 80,          // 80% CPU usage
  MIN_FRAME_RATE: 30,                 // 30fps minimum
  TARGET_FRAME_RATE: 60,              // 60fps target
  MAX_GC_PAUSE_MS: 50,                // 50ms max GC pause
  MAX_EVENT_LOOP_LAG_MS: 100,         // 100ms max event loop lag

  // Maintenance settings
  ENABLE_AUTO_OPTIMIZATION: true,
  ENABLE_PROACTIVE_CLEANUP: true,
  CLEANUP_INTERVAL_MINUTES: 15,
  OPTIMIZATION_THRESHOLD: 85,         // 85% resource usage triggers optimization

  // Data retention
  HEALTH_HISTORY_RETENTION_HOURS: 24,
  METRICS_RETENTION_DAYS: 7,
  ALERT_RETENTION_DAYS: 3,

  // Reporting settings
  ENABLE_HEALTH_REPORTS: true,
  REPORT_INTERVAL_MINUTES: 30,
  ENABLE_TREND_ANALYSIS: true
};

/**
 * Health status levels
 */
export const HEALTH_STATUS = {
  EXCELLENT: 'EXCELLENT',    // All systems optimal
  GOOD: 'GOOD',             // Minor issues within thresholds
  FAIR: 'FAIR',             // Some metrics approaching thresholds
  POOR: 'POOR',             // Multiple metrics exceeding thresholds
  CRITICAL: 'CRITICAL'      // System stability at risk
};

/**
 * System health monitor
 */
export class SystemHealthMonitor {
  constructor(config = {}) {
    this.config = { ...SYSTEM_HEALTH_CONFIG, ...config };
    this.isMonitoring = false;
    this.startTime = Date.now();

    // Health tracking
    this.currentHealth = {
      status: HEALTH_STATUS.GOOD,
      score: 100,
      lastCheck: Date.now(),
      uptime: 0
    };

    // Resource monitoring
    this.resources = {
      memory: [],
      cpu: [],
      network: [],
      battery: [],
      storage: []
    };

    // Performance tracking
    this.performance = {
      frameRate: [],
      renderingPipeline: [],
      eventLoop: [],
      garbageCollection: []
    };

    // Connection health
    this.connections = {
      websockets: new Map(),
      api: [],
      networkLatency: [],
      bandwidth: []
    };

    // Component health
    this.components = {
      active: new Map(),
      lifecycle: [],
      canvas: new Map(),
      stores: new Map(),
      workers: new Map()
    };

    // Health history and trends
    this.healthHistory = [];
    this.healthTrends = new Map();
    this.healthAlerts = [];

    // Monitoring intervals
    this.monitoringIntervals = new Map();

    // Resource baselines
    this.resourceBaselines = {
      memory: 0,
      frameRate: 60,
      networkLatency: 0
    };

    // Initialize monitoring
    this.initializeResourceMonitoring();
    this.initializePerformanceMonitoring();
    this.initializeConnectionMonitoring();
  }

  /**
   * Start system health monitoring
   */
  startMonitoring() {
    if (this.isMonitoring) {
      console.warn('[SystemHealthMonitor] System health monitoring already started');
      return;
    }

    this.isMonitoring = true;
    this.startTime = Date.now();

    console.log('[SystemHealthMonitor] Starting system health monitoring...');

    // Establish baselines
    this.establishBaselines();

    // Start monitoring intervals
    this.startResourceMonitoring();
    this.startPerformanceMonitoring();
    this.startConnectionMonitoring();
    this.startComponentMonitoring();

    // Start health analysis
    this.startHealthAnalysis();

    // Start proactive maintenance
    this.startProactiveMaintenance();

    console.log('[SystemHealthMonitor] System health monitoring started successfully');
  }

  /**
   * Stop system health monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      console.warn('[SystemHealthMonitor] System health monitoring not started');
      return;
    }

    this.isMonitoring = false;

    // Clear all monitoring intervals
    for (const [name, interval] of this.monitoringIntervals) {
      clearInterval(interval);
    }
    this.monitoringIntervals.clear();

    console.log('[SystemHealthMonitor] System health monitoring stopped');
  }

  /**
   * Initialize resource monitoring capabilities
   */
  initializeResourceMonitoring() {
    // Memory monitoring
    if ('memory' in performance) {
      this.memoryMonitor = {
        isAvailable: true,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        usedJSHeapSize: performance.memory.usedJSHeapSize
      };
    } else {
      this.memoryMonitor = { isAvailable: false };
    }

    // Battery monitoring
    if ('getBattery' in navigator) {
      navigator.getBattery().then(battery => {
        this.batteryMonitor = battery;
        this.setupBatteryMonitoring();
      }).catch(() => {
        this.batteryMonitor = { isAvailable: false };
      });
    } else {
      this.batteryMonitor = { isAvailable: false };
    }

    // Network monitoring
    if ('connection' in navigator) {
      this.networkMonitor = navigator.connection;
      this.setupNetworkMonitoring();
    } else {
      this.networkMonitor = { isAvailable: false };
    }

    // Hardware monitoring
    this.hardwareMonitor = {
      cores: navigator.hardwareConcurrency || 4,
      deviceMemory: navigator.deviceMemory || 4,
      platform: navigator.platform
    };
  }

  /**
   * Initialize performance monitoring
   */
  initializePerformanceMonitoring() {
    // Performance observer for various metrics
    this.performanceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.processPerformanceEntry(entry);
      }
    });

    try {
      // Monitor different performance entry types
      this.performanceObserver.observe({
        entryTypes: ['measure', 'navigation', 'paint', 'longtask', 'layout-shift', 'largest-contentful-paint']
      });
    } catch (error) {
      console.warn('[SystemHealthMonitor] Performance observer setup failed:', error);
    }

    // Frame rate monitoring
    this.frameRateMonitor = {
      lastFrameTime: performance.now(),
      frameCount: 0,
      frameRates: []
    };
  }

  /**
   * Initialize connection monitoring
   */
  initializeConnectionMonitoring() {
    this.connectionMonitor = {
      testEndpoints: [
        'https://httpbin.org/get', // General connectivity test
        'https://jsonplaceholder.typicode.com/posts/1' // API connectivity test
      ],
      activeTests: new Map(),
      lastConnectivityCheck: 0
    };
  }

  /**
   * Setup battery monitoring
   */
  setupBatteryMonitoring() {
    if (!this.batteryMonitor || !this.batteryMonitor.isAvailable) return;

    // Monitor battery events
    this.batteryMonitor.addEventListener('levelchange', () => {
      this.recordBatteryStatus();
    });

    this.batteryMonitor.addEventListener('chargingchange', () => {
      this.recordBatteryStatus();
    });
  }

  /**
   * Setup network monitoring
   */
  setupNetworkMonitoring() {
    if (!this.networkMonitor || !this.networkMonitor.isAvailable) return;

    // Monitor network changes
    this.networkMonitor.addEventListener('change', () => {
      this.recordNetworkStatus();
    });
  }

  /**
   * Establish resource baselines
   */
  establishBaselines() {
    // Memory baseline
    if (this.memoryMonitor.isAvailable) {
      this.resourceBaselines.memory = this.memoryMonitor.usedJSHeapSize / (1024 * 1024);
    }

    // Network latency baseline
    this.measureNetworkLatency().then(latency => {
      this.resourceBaselines.networkLatency = latency;
    });

    console.log('[SystemHealthMonitor] Resource baselines established:', this.resourceBaselines);
  }

  /**
   * Start resource monitoring
   */
  startResourceMonitoring() {
    // Memory monitoring (every 5 seconds)
    const memoryInterval = setInterval(() => {
      if (this.config.MONITOR_MEMORY_USAGE) {
        this.monitorMemoryUsage();
      }
    }, 5000);
    this.monitoringIntervals.set('memory', memoryInterval);

    // CPU monitoring (every 2 seconds)
    const cpuInterval = setInterval(() => {
      if (this.config.MONITOR_CPU_USAGE) {
        this.monitorCPUUsage();
      }
    }, 2000);
    this.monitoringIntervals.set('cpu', cpuInterval);

    // Network monitoring (every 30 seconds)
    const networkInterval = setInterval(() => {
      if (this.config.MONITOR_NETWORK_STATUS) {
        this.monitorNetworkStatus();
      }
    }, 30000);
    this.monitoringIntervals.set('network', networkInterval);

    // Battery monitoring (every 30 seconds)
    const batteryInterval = setInterval(() => {
      if (this.config.MONITOR_BATTERY_STATUS) {
        this.recordBatteryStatus();
      }
    }, 30000);
    this.monitoringIntervals.set('battery', batteryInterval);
  }

  /**
   * Start performance monitoring
   */
  startPerformanceMonitoring() {
    // Frame rate monitoring
    const frameRateInterval = setInterval(() => {
      if (this.config.MONITOR_FRAME_RATE) {
        this.monitorFrameRate();
      }
    }, 1000);
    this.monitoringIntervals.set('frameRate', frameRateInterval);

    // Event loop monitoring
    const eventLoopInterval = setInterval(() => {
      if (this.config.MONITOR_EVENT_LOOP) {
        this.monitorEventLoop();
      }
    }, 1000);
    this.monitoringIntervals.set('eventLoop', eventLoopInterval);

    // Garbage collection monitoring
    if ('gc' in window) {
      const gcInterval = setInterval(() => {
        if (this.config.MONITOR_GC_IMPACT) {
          this.monitorGarbageCollection();
        }
      }, 5000);
      this.monitoringIntervals.set('gc', gcInterval);
    }
  }

  /**
   * Start connection monitoring
   */
  startConnectionMonitoring() {
    // Connectivity checks (every 2 minutes)
    const connectivityInterval = setInterval(() => {
      if (this.config.MONITOR_API_CONNECTIVITY) {
        this.checkConnectivity();
      }
    }, 120000);
    this.monitoringIntervals.set('connectivity', connectivityInterval);

    // Network latency monitoring (every 30 seconds)
    const latencyInterval = setInterval(() => {
      if (this.config.MONITOR_NETWORK_LATENCY) {
        this.measureNetworkLatency();
      }
    }, 30000);
    this.monitoringIntervals.set('latency', latencyInterval);
  }

  /**
   * Start component monitoring
   */
  startComponentMonitoring() {
    // Component lifecycle monitoring
    const componentInterval = setInterval(() => {
      if (this.config.MONITOR_COMPONENT_LIFECYCLE) {
        this.monitorComponentLifecycle();
      }
    }, 10000);
    this.monitoringIntervals.set('components', componentInterval);

    // Canvas health monitoring
    const canvasInterval = setInterval(() => {
      if (this.config.MONITOR_CANVAS_HEALTH) {
        this.monitorCanvasHealth();
      }
    }, 5000);
    this.monitoringIntervals.set('canvas', canvasInterval);
  }

  /**
   * Start health analysis
   */
  startHealthAnalysis() {
    // Health score calculation (every 30 seconds)
    const healthAnalysisInterval = setInterval(() => {
      this.calculateOverallHealth();
    }, 30000);
    this.monitoringIntervals.set('healthAnalysis', healthAnalysisInterval);

    // Trend analysis (every 5 minutes)
    const trendAnalysisInterval = setInterval(() => {
      if (this.config.ENABLE_TREND_ANALYSIS) {
        this.analyzeHealthTrends();
      }
    }, 300000);
    this.monitoringIntervals.set('trendAnalysis', trendAnalysisInterval);
  }

  /**
   * Start proactive maintenance
   */
  startProactiveMaintenance() {
    // Cleanup interval
    if (this.config.ENABLE_PROACTIVE_CLEANUP) {
      const cleanupInterval = setInterval(() => {
        this.performProactiveCleanup();
      }, this.config.CLEANUP_INTERVAL_MINUTES * 60 * 1000);
      this.monitoringIntervals.set('cleanup', cleanupInterval);
    }

    // Optimization check
    if (this.config.ENABLE_AUTO_OPTIMIZATION) {
      const optimizationInterval = setInterval(() => {
        this.checkOptimizationNeeds();
      }, 60000);
      this.monitoringIntervals.set('optimization', optimizationInterval);
    }
  }

  /**
   * Monitor memory usage
   */
  monitorMemoryUsage() {
    if (!this.memoryMonitor.isAvailable) return;

    const now = Date.now();
    const memoryInfo = performance.memory;
    const usedMB = memoryInfo.usedJSHeapSize / (1024 * 1024);
    const totalMB = memoryInfo.totalJSHeapSize / (1024 * 1024);
    const limitMB = memoryInfo.jsHeapSizeLimit / (1024 * 1024);
    const usagePercent = (usedMB / limitMB) * 100;

    const memoryData = {
      timestamp: now,
      used: usedMB,
      total: totalMB,
      limit: limitMB,
      usagePercent,
      pressure: this.calculateMemoryPressure(usagePercent)
    };

    this.resources.memory.push(memoryData);

    // Maintain memory history
    if (this.resources.memory.length > 1000) {
      this.resources.memory.shift();
    }

    // Check thresholds
    if (usagePercent > this.config.CRITICAL_MEMORY_THRESHOLD) {
      this.generateHealthAlert('CRITICAL', 'MEMORY_USAGE',
        `Memory usage critical: ${usagePercent.toFixed(1)}%`, memoryData);
    } else if (usagePercent > this.config.WARNING_MEMORY_THRESHOLD) {
      this.generateHealthAlert('WARNING', 'MEMORY_USAGE',
        `Memory usage high: ${usagePercent.toFixed(1)}%`, memoryData);
    }
  }

  /**
   * Monitor CPU usage (approximate)
   */
  monitorCPUUsage() {
    const now = Date.now();
    const startTime = performance.now();

    // Simulate CPU load by measuring task execution time
    const iterations = 1000000;
    let sum = 0;
    for (let i = 0; i < iterations; i++) {
      sum += Math.random();
    }

    const executionTime = performance.now() - startTime;

    // Approximate CPU usage based on execution time
    const cpuUsagePercent = Math.min(100, (executionTime / 10) * 100); // Normalize to percentage

    const cpuData = {
      timestamp: now,
      usagePercent: cpuUsagePercent,
      executionTime,
      cores: this.hardwareMonitor.cores
    };

    this.resources.cpu.push(cpuData);

    // Maintain CPU history
    if (this.resources.cpu.length > 1000) {
      this.resources.cpu.shift();
    }

    // Check thresholds
    if (cpuUsagePercent > this.config.CRITICAL_CPU_THRESHOLD) {
      this.generateHealthAlert('CRITICAL', 'CPU_USAGE',
        `CPU usage critical: ${cpuUsagePercent.toFixed(1)}%`, cpuData);
    } else if (cpuUsagePercent > this.config.WARNING_CPU_THRESHOLD) {
      this.generateHealthAlert('WARNING', 'CPU_USAGE',
        `CPU usage high: ${cpuUsagePercent.toFixed(1)}%`, cpuData);
    }
  }

  /**
   * Monitor network status
   */
  monitorNetworkStatus() {
    const now = Date.now();

    if (this.networkMonitor.isAvailable) {
      const networkData = {
        timestamp: now,
        effectiveType: this.networkMonitor.effectiveType,
        downlink: this.networkMonitor.downlink,
        rtt: this.networkMonitor.rtt,
        saveData: this.networkMonitor.saveData,
        online: navigator.onLine
      };

      this.resources.network.push(networkData);

      // Maintain network history
      if (this.resources.network.length > 500) {
        this.resources.network.shift();
      }
    }
  }

  /**
   * Record battery status
   */
  recordBatteryStatus() {
    if (!this.batteryMonitor || !this.batteryMonitor.isAvailable) return;

    const now = Date.now();
    const batteryData = {
      timestamp: now,
      level: this.batteryMonitor.level,
      charging: this.batteryMonitor.charging,
      chargingTime: this.batteryMonitor.chargingTime,
      dischargingTime: this.batteryMonitor.dischargingTime
    };

    this.resources.battery.push(batteryData);

    // Maintain battery history
    if (this.resources.battery.length > 500) {
      this.resources.battery.shift();
    }

    // Alert on low battery
    if (!batteryData.charging && batteryData.level < 0.1) {
      this.generateHealthAlert('WARNING', 'BATTERY_LOW',
        `Battery level low: ${(batteryData.level * 100).toFixed(0)}%`, batteryData);
    }
  }

  /**
   * Monitor frame rate
   */
  monitorFrameRate() {
    const now = performance.now();
    const frameDelta = now - this.frameRateMonitor.lastFrameTime;

    if (frameDelta > 0) {
      const currentFps = 1000 / frameDelta;
      this.frameRateMonitor.frameRates.push(currentFps);

      // Keep only last 60 frames (1 second at 60fps)
      if (this.frameRateMonitor.frameRates.length > 60) {
        this.frameRateMonitor.frameRates.shift();
      }

      // Calculate average FPS
      const averageFps = this.frameRateMonitor.frameRates.reduce((sum, fps) => sum + fps, 0) / this.frameRateMonitor.frameRates.length;

      const frameRateData = {
        timestamp: now,
        currentFps,
        averageFps,
        frameDelta
      };

      this.performance.frameRate.push(frameRateData);

      // Maintain frame rate history
      if (this.performance.frameRate.length > 300) {
        this.performance.frameRate.shift();
      }

      // Check thresholds
      if (averageFps < this.config.MIN_FRAME_RATE) {
        this.generateHealthAlert('CRITICAL', 'LOW_FRAME_RATE',
          `Frame rate critical: ${averageFps.toFixed(1)}fps`, frameRateData);
      } else if (averageFps < this.config.TARGET_FRAME_RATE * 0.8) {
        this.generateHealthAlert('WARNING', 'LOW_FRAME_RATE',
          `Frame rate low: ${averageFps.toFixed(1)}fps`, frameRateData);
      }
    }

    this.frameRateMonitor.lastFrameTime = now;
  }

  /**
   * Monitor event loop lag
   */
  monitorEventLoop() {
    const startTime = performance.now();

    // Schedule a task to measure event loop lag
    setTimeout(() => {
      const lag = performance.now() - startTime;

      const eventLoopData = {
        timestamp: Date.now(),
        lag,
        blocked: lag > this.config.MAX_EVENT_LOOP_LAG_MS
      };

      this.performance.eventLoop.push(eventLoopData);

      // Maintain event loop history
      if (this.performance.eventLoop.length > 300) {
        this.performance.eventLoop.shift();
      }

      // Check for event loop blocking
      if (lag > this.config.MAX_EVENT_LOOP_LAG_MS) {
        this.generateHealthAlert('WARNING', 'EVENT_LOOP_LAG',
          `Event loop lag: ${lag.toFixed(2)}ms`, eventLoopData);
      }
    }, 0);
  }

  /**
   * Monitor garbage collection
   */
  monitorGarbageCollection() {
    // This would be implemented with actual GC monitoring if available
    // For now, we'll monitor memory pressure as a proxy
  }

  /**
   * Monitor component lifecycle
   */
  monitorComponentLifecycle() {
    const now = Date.now();
    const activeComponents = document.querySelectorAll('[data-component-id]').length;

    const componentData = {
      timestamp: now,
      activeCount: activeComponents,
      memoryUsage: this.memoryMonitor.isAvailable ?
        this.memoryMonitor.usedJSHeapSize / (1024 * 1024) : 0
    };

    this.components.lifecycle.push(componentData);

    // Maintain component history
    if (this.components.lifecycle.length > 200) {
      this.components.lifecycle.shift();
    }
  }

  /**
   * Monitor canvas health
   */
  monitorCanvasHealth() {
    const canvases = document.querySelectorAll('canvas');
    const now = Date.now();

    for (const canvas of canvases) {
      const canvasId = canvas.id || canvas.getAttribute('data-display-id') || 'unknown';

      const canvasData = {
        timestamp: now,
        id: canvasId,
        width: canvas.width,
        height: canvas.height,
        context: canvas.getContext('2d') ? '2d' : 'unknown',
        cssWidth: canvas.clientWidth,
        cssHeight: canvas.clientHeight,
        dprMismatch: canvas.width !== canvas.clientWidth * window.devicePixelRatio
      };

      this.components.canvas.set(canvasId, canvasData);

      // Check for DPR mismatch
      if (canvasData.dprMismatch) {
        this.generateHealthAlert('WARNING', 'CANVAS_DPR_MISMATCH',
          `DPR mismatch for canvas ${canvasId}`, canvasData);
      }
    }
  }

  /**
   * Check connectivity
   */
  async checkConnectivity() {
    const now = Date.now();

    for (const endpoint of this.connectionMonitor.testEndpoints) {
      try {
        const startTime = performance.now();
        const response = await fetch(endpoint, {
          method: 'GET',
          cache: 'no-cache',
          signal: AbortSignal.timeout(5000)
        });
        const responseTime = performance.now() - startTime;

        const connectivityData = {
          timestamp: now,
          endpoint,
          status: response.ok ? 'OK' : 'ERROR',
          responseTime,
          statusCode: response.status
        };

        this.connections.api.push(connectivityData);

        if (!response.ok) {
          this.generateHealthAlert('WARNING', 'API_CONNECTIVITY',
            `API connectivity issue: ${endpoint}`, connectivityData);
        }

      } catch (error) {
        const connectivityData = {
          timestamp: now,
          endpoint,
          status: 'ERROR',
          error: error.message,
          responseTime: null
        };

        this.connections.api.push(connectivityData);

        this.generateHealthAlert('CRITICAL', 'API_CONNECTIVITY',
          `API connectivity failure: ${endpoint} - ${error.message}`, connectivityData);
      }
    }

    // Maintain API connectivity history
    if (this.connections.api.length > 100) {
      this.connections.api.shift();
    }

    this.connectionMonitor.lastConnectivityCheck = now;
  }

  /**
   * Measure network latency
   */
  async measureNetworkLatency() {
    const startTime = performance.now();

    try {
      await fetch('https://httpbin.org/json', {
        method: 'GET',
        cache: 'no-cache',
        signal: AbortSignal.timeout(3000)
      });

      const latency = performance.now() - startTime;

      const latencyData = {
        timestamp: Date.now(),
        latency,
        endpoint: 'https://httpbin.org/json'
      };

      this.connections.networkLatency.push(latencyData);

      // Maintain latency history
      if (this.connections.networkLatency.length > 200) {
        this.connections.networkLatency.shift();
      }

      return latency;

    } catch (error) {
      console.warn('[SystemHealthMonitor] Network latency measurement failed:', error);
      return null;
    }
  }

  /**
   * Process performance observer entries
   */
  processPerformanceEntry(entry) {
    switch (entry.entryType) {
      case 'longtask':
        this.handleLongTask(entry);
        break;
      case 'largest-contentful-paint':
        this.handleLargestContentfulPaint(entry);
        break;
      case 'layout-shift':
        this.handleLayoutShift(entry);
        break;
      case 'measure':
        this.handleCustomMeasure(entry);
        break;
    }
  }

  /**
   * Handle long tasks
   */
  handleLongTask(entry) {
    const longTaskData = {
      timestamp: Date.now(),
      duration: entry.duration,
      startTime: entry.startTime,
      type: 'longtask'
    };

    this.performance.renderingPipeline.push(longTaskData);

    // Alert on long tasks
    if (entry.duration > 100) {
      this.generateHealthAlert('WARNING', 'LONG_TASK',
        `Long task detected: ${entry.duration.toFixed(2)}ms`, longTaskData);
    }
  }

  /**
   * Handle largest contentful paint
   */
  handleLargestContentfulPaint(entry) {
    // Would be used for page load performance monitoring
  }

  /**
   * Handle layout shift
   */
  handleLayoutShift(entry) {
    // Would be used for visual stability monitoring
  }

  /**
   * Handle custom measure
   */
  handleCustomMeasure(entry) {
    const measureData = {
      timestamp: Date.now(),
      name: entry.name,
      duration: entry.duration,
      type: 'measure'
    };

    this.performance.renderingPipeline.push(measureData);
  }

  /**
   * Calculate overall system health
   */
  calculateOverallHealth() {
    const now = Date.now();
    const healthFactors = [];

    // Memory health factor
    const memoryHealth = this.calculateMemoryHealth();
    healthFactors.push({ name: 'memory', weight: 0.3, score: memoryHealth });

    // Performance health factor
    const performanceHealth = this.calculatePerformanceHealth();
    healthFactors.push({ name: 'performance', weight: 0.4, score: performanceHealth });

    // Connection health factor
    const connectionHealth = this.calculateConnectionHealth();
    healthFactors.push({ name: 'connection', weight: 0.2, score: connectionHealth });

    // Component health factor
    const componentHealth = this.calculateComponentHealth();
    healthFactors.push({ name: 'components', weight: 0.1, score: componentHealth });

    // Calculate weighted score
    const weightedScore = healthFactors.reduce((sum, factor) =>
      sum + (factor.score * factor.weight), 0);

    // Determine health status
    let status;
    if (weightedScore >= 90) status = HEALTH_STATUS.EXCELLENT;
    else if (weightedScore >= 75) status = HEALTH_STATUS.GOOD;
    else if (weightedScore >= 60) status = HEALTH_STATUS.FAIR;
    else if (weightedScore >= 40) status = HEALTH_STATUS.POOR;
    else status = HEALTH_STATUS.CRITICAL;

    // Update current health
    this.currentHealth = {
      status,
      score: Math.round(weightedScore),
      lastCheck: now,
      uptime: now - this.startTime,
      factors: healthFactors
    };

    // Record health history
    this.healthHistory.push({ ...this.currentHealth, timestamp: now });

    // Maintain health history
    if (this.healthHistory.length > this.config.HEALTH_HISTORY_RETENTION_HOURS * 60) {
      this.healthHistory.shift();
    }

    // Log health status
    console.log(`[SystemHealthMonitor] Health status: ${status} (${weightedScore.toFixed(1)}%)`);
  }

  /**
   * Calculate memory health score
   */
  calculateMemoryHealth() {
    if (!this.memoryMonitor.isAvailable || this.resources.memory.length === 0) {
      return 100;
    }

    const latestMemory = this.resources.memory[this.resources.memory.length - 1];
    const usagePercent = latestMemory.usagePercent;

    if (usagePercent > this.config.CRITICAL_MEMORY_THRESHOLD) return 20;
    if (usagePercent > this.config.WARNING_MEMORY_THRESHOLD) return 50;
    if (usagePercent > 60) return 80;
    return 100;
  }

  /**
   * Calculate performance health score
   */
  calculatePerformanceHealth() {
    let totalScore = 0;
    let factorCount = 0;

    // Frame rate factor
    if (this.performance.frameRate.length > 0) {
      const latestFrameRate = this.performance.frameRate[this.performance.frameRate.length - 1];
      const fps = latestFrameRate.averageFps;

      let frameScore;
      if (fps >= this.config.TARGET_FRAME_RATE) frameScore = 100;
      else if (fps >= this.config.MIN_FRAME_RATE) frameScore = 70;
      else frameScore = 30;

      totalScore += frameScore;
      factorCount++;
    }

    // Event loop factor
    if (this.performance.eventLoop.length > 0) {
      const recentEventLoops = this.performance.eventLoop.slice(-60);
      const blockedCount = recentEventLoops.filter(el => el.blocked).length;
      const eventLoopScore = Math.max(0, 100 - (blockedCount * 10));

      totalScore += eventLoopScore;
      factorCount++;
    }

    return factorCount > 0 ? totalScore / factorCount : 100;
  }

  /**
   * Calculate connection health score
   */
  calculateConnectionHealth() {
    let totalScore = 0;
    let factorCount = 0;

    // API connectivity factor
    if (this.connections.api.length > 0) {
      const recentApiCalls = this.connections.api.slice(-10);
      const successCount = recentApiCalls.filter(call => call.status === 'OK').length;
      const apiScore = (successCount / recentApiCalls.length) * 100;

      totalScore += apiScore;
      factorCount++;
    }

    // Network latency factor
    if (this.connections.networkLatency.length > 0) {
      const latestLatency = this.connections.networkLatency[this.connections.networkLatency.length - 1];
      let latencyScore;

      if (latestLatency.latency < 100) latencyScore = 100;
      else if (latestLatency.latency < 500) latencyScore = 80;
      else if (latestLatency.latency < 1000) latencyScore = 60;
      else latencyScore = 30;

      totalScore += latencyScore;
      factorCount++;
    }

    return factorCount > 0 ? totalScore / factorCount : 100;
  }

  /**
   * Calculate component health score
   */
  calculateComponentHealth() {
    // Simple component health based on canvas DPR matches
    if (this.components.canvas.size === 0) return 100;

    let healthyCanvases = 0;
    for (const [id, canvas] of this.components.canvas) {
      if (!canvas.dprMismatch) healthyCanvases++;
    }

    return (healthyCanvases / this.components.canvas.size) * 100;
  }

  /**
   * Calculate memory pressure
   */
  calculateMemoryPressure(usagePercent) {
    if (usagePercent > this.config.CRITICAL_MEMORY_THRESHOLD) return 'CRITICAL';
    if (usagePercent > this.config.WARNING_MEMORY_THRESHOLD) return 'HIGH';
    if (usagePercent > 50) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Analyze health trends
   */
  analyzeHealthTrends() {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    const recentHealth = this.healthHistory.filter(h => h.timestamp >= oneHourAgo);

    if (recentHealth.length < 10) return; // Not enough data

    // Calculate trend for each health factor
    const factors = ['memory', 'performance', 'connection', 'components'];

    for (const factor of factors) {
      const factorScores = recentHealth.map(h =>
        h.factors.find(f => f.name === factor)?.score || 100
      );

      const trend = this.calculateTrend(factorScores);
      this.healthTrends.set(factor, {
        trend,
        currentScore: factorScores[factorScores.length - 1],
        dataPoints: factorScores.length
      });
    }

    console.log('[SystemHealthMonitor] Health trends analyzed:', Object.fromEntries(this.healthTrends));
  }

  /**
   * Calculate trend from scores
   */
  calculateTrend(scores) {
    if (scores.length < 2) return 'STABLE';

    const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
    const secondHalf = scores.slice(Math.floor(scores.length / 2));

    const firstAvg = firstHalf.reduce((sum, score) => sum + score, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, score) => sum + score, 0) / secondHalf.length;

    const change = secondAvg - firstAvg;

    if (change > 5) return 'IMPROVING';
    if (change < -5) return 'DECLINING';
    return 'STABLE';
  }

  /**
   * Check optimization needs
   */
  checkOptimizationNeeds() {
    if (this.currentHealth.score < this.config.OPTIMIZATION_THRESHOLD) {
      console.log('[SystemHealthMonitor] System health below optimization threshold, triggering optimization');
      this.performSystemOptimization();
    }
  }

  /**
   * Perform proactive cleanup
   */
  performProactiveCleanup() {
    console.log('[SystemHealthMonitor] Performing proactive cleanup...');

    // Clear old monitoring data
    const cutoffTime = Date.now() - (this.config.METRICS_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    // Clean memory history
    this.resources.memory = this.resources.memory.filter(m => m.timestamp > cutoffTime);

    // Clean performance data
    this.performance.frameRate = this.performance.frameRate.filter(f => f.timestamp > cutoffTime);
    this.performance.eventLoop = this.performance.eventLoop.filter(e => e.timestamp > cutoffTime);

    // Clean connection data
    this.connections.api = this.connections.api.filter(a => a.timestamp > cutoffTime);
    this.connections.networkLatency = this.connections.networkLatency.filter(n => n.timestamp > cutoffTime);

    console.log('[SystemHealthMonitor] Proactive cleanup completed');
  }

  /**
   * Perform system optimization
   */
  performSystemOptimization() {
    console.log('[SystemHealthMonitor] Performing system optimization...');

    // Trigger garbage collection if available
    if ('gc' in window) {
      try {
        window.gc();
        console.log('[SystemHealthMonitor] Manual garbage collection triggered');
      } catch (error) {
        console.warn('[SystemHealthMonitor] Manual garbage collection failed:', error);
      }
    }

    // Clean up unused DOM elements
    const unusedElements = document.querySelectorAll('[data-destroyed="true"]');
    unusedElements.forEach(element => element.remove());

    console.log('[SystemHealthMonitor] System optimization completed');
  }

  /**
   * Generate health alert
   */
  generateHealthAlert(severity, type, message, data) {
    const alert = {
      id: `health_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      severity,
      type,
      message,
      data,
      resolved: false
    };

    this.healthAlerts.push(alert);

    // Maintain alert history
    if (this.healthAlerts.length > 1000) {
      this.healthAlerts.shift();
    }

    // Log alert
    const logMethod = severity === 'CRITICAL' ? console.error :
                     severity === 'WARNING' ? console.warn : console.log;
    logMethod(`[SystemHealthMonitor] ${severity} ${type}: ${message}`, data);
  }

  /**
   * Get comprehensive system health report
   */
  getSystemHealthReport() {
    const now = Date.now();
    const uptime = now - this.startTime;

    return {
      timestamp: now,
      uptime,
      isMonitoring: this.isMonitoring,
      config: this.config,

      // Current health status
      current: this.currentHealth,

      // Resource status
      resources: {
        memory: {
          current: this.resources.memory.slice(-1)[0],
          history: this.resources.memory.slice(-100),
          pressure: this.resources.memory.slice(-1)[0]?.pressure || 'UNKNOWN'
        },
        cpu: {
          current: this.resources.cpu.slice(-1)[0],
          history: this.resources.cpu.slice(-100),
          average: this.calculateAverageCPU()
        },
        network: {
          current: this.resources.network.slice(-1)[0],
          history: this.resources.network.slice(-50)
        },
        battery: {
          current: this.resources.battery.slice(-1)[0],
          history: this.resources.battery.slice(-50)
        }
      },

      // Performance metrics
      performance: {
        frameRate: {
          current: this.performance.frameRate.slice(-1)[0],
          history: this.performance.frameRate.slice(-300),
          average: this.calculateAverageFrameRate()
        },
        eventLoop: {
          current: this.performance.eventLoop.slice(-1)[0],
          history: this.performance.eventLoop.slice(-300),
          blockedCount: this.performance.eventLoop.filter(el => el.blocked).length
        },
        renderingPipeline: {
          longTasks: this.performance.renderingPipeline.filter(t => t.duration > 50),
          customMeasures: this.performance.renderingPipeline.filter(t => t.type === 'measure')
        }
      },

      // Connection status
      connections: {
        api: {
          current: this.connections.api.slice(-10),
          successRate: this.calculateAPISuccessRate()
        },
        networkLatency: {
          current: this.connections.networkLatency.slice(-1)[0],
          history: this.connections.networkLatency.slice(-50),
          average: this.calculateAverageLatency()
        }
      },

      // Component health
      components: {
        activeCount: document.querySelectorAll('[data-component-id]').length,
        canvasHealth: Array.from(this.components.canvas.values()),
        lifecycle: this.components.lifecycle.slice(-100)
      },

      // Health trends
      trends: Object.fromEntries(this.healthTrends),

      // Alerts
      alerts: {
        active: this.healthAlerts.filter(a => !a.resolved),
        recent: this.healthAlerts.slice(-50),
        byType: this.groupAlertsByType()
      },

      // Baselines and thresholds
      baselines: this.resourceBaselines,
      thresholds: {
        memory: { critical: this.config.CRITICAL_MEMORY_THRESHOLD, warning: this.config.WARNING_MEMORY_THRESHOLD },
        cpu: { critical: this.config.CRITICAL_CPU_THRESHOLD, warning: this.config.WARNING_CPU_THRESHOLD },
        frameRate: { min: this.config.MIN_FRAME_RATE, target: this.config.TARGET_FRAME_RATE }
      }
    };
  }

  /**
   * Calculate average CPU usage
   */
  calculateAverageCPU() {
    if (this.resources.cpu.length === 0) return 0;
    const recent = this.resources.cpu.slice(-60);
    return recent.reduce((sum, cpu) => sum + cpu.usagePercent, 0) / recent.length;
  }

  /**
   * Calculate average frame rate
   */
  calculateAverageFrameRate() {
    if (this.performance.frameRate.length === 0) return 0;
    const recent = this.performance.frameRate.slice(-60);
    return recent.reduce((sum, fr) => sum + fr.averageFps, 0) / recent.length;
  }

  /**
   * Calculate API success rate
   */
  calculateAPISuccessRate() {
    if (this.connections.api.length === 0) return 100;
    const recent = this.connections.api.slice(-50);
    const successCount = recent.filter(call => call.status === 'OK').length;
    return (successCount / recent.length) * 100;
  }

  /**
   * Calculate average network latency
   */
  calculateAverageLatency() {
    if (this.connections.networkLatency.length === 0) return 0;
    const recent = this.connections.networkLatency.slice(-30);
    const validLatencies = recent.filter(l => l.latency !== null);
    if (validLatencies.length === 0) return 0;
    return validLatencies.reduce((sum, l) => sum + l.latency, 0) / validLatencies.length;
  }

  /**
   * Group alerts by type
   */
  groupAlertsByType() {
    const grouped = {};
    for (const alert of this.healthAlerts) {
      grouped[alert.type] = (grouped[alert.type] || 0) + 1;
    }
    return grouped;
  }

  /**
   * Cleanup and destroy system health monitor
   */
  destroy() {
    this.stopMonitoring();

    // Disconnect performance observer
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }

    // Clear all data
    this.resources.memory = [];
    this.resources.cpu = [];
    this.resources.network = [];
    this.resources.battery = [];
    this.performance.frameRate = [];
    this.performance.eventLoop = [];
    this.performance.renderingPipeline = [];
    this.connections.api = [];
    this.connections.networkLatency = [];
    this.components.lifecycle = [];
    this.components.canvas.clear();
    this.healthHistory = [];
    this.healthTrends.clear();
    this.healthAlerts = [];

    console.log('[SystemHealthMonitor] System health monitoring system destroyed');
  }
}

/**
 * Global system health monitor instance
 */
let globalSystemHealthMonitor = null;

/**
 * Get or create global system health monitor
 */
export function getSystemHealthMonitor(config = {}) {
  if (!globalSystemHealthMonitor) {
    globalSystemHealthMonitor = new SystemHealthMonitor(config);
  }
  return globalSystemHealthMonitor;
}

/**
 * Initialize system health monitoring with default configuration
 */
export function initializeSystemHealthMonitoring(config = {}) {
  const monitor = getSystemHealthMonitor(config);
  monitor.startMonitoring();
  return monitor;
}