/**
 * Real-Time Performance Dashboard
 *
 * Provides live visualization of browser performance metrics for professional trading environments.
 * Displays frame rates, memory usage, network quality, and system health in real-time.
 *
 * Critical for validating 60fps rendering, sub-100ms latency, and 8+ hour session stability.
 */

import { browserMonitor } from './browserProcessMonitor.js';

class PerformanceDashboard {
  constructor(options = {}) {
    this.options = {
      updateInterval: 1000, // Update every second
      historyLength: 60,    // Keep 60 seconds of history
      showCharts: true,
      showMetrics: true,
      showAlerts: true,
      compactMode: false,
      ...options
    };

    this.isVisible = false;
    this.isInitialized = false;
    this.metricsHistory = new Map();
    this.alerts = [];
    this.charts = new Map();
    this.elements = new Map();

    // Initialize with defaults
    this.initializeMetricsHistory();
  }

  /**
   * Initialize metrics history tracking
   */
  initializeMetricsHistory() {
    const metrics = ['fps', 'memory', 'cpu', 'network', 'latency', 'jank'];
    metrics.forEach(metric => {
      this.metricsHistory.set(metric, []);
    });
  }

  /**
   * Initialize and mount the dashboard
   */
  initialize(container) {
    if (this.isInitialized) return;

    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    if (!this.container) {
      throw new Error('Performance dashboard container not found');
    }

    this.createDashboardUI();
    this.setupEventListeners();
    this.startMonitoring();
    this.isInitialized = true;

    console.log('Performance Dashboard initialized');
  }

  /**
   * Create the dashboard UI components
   */
  createDashboardUI() {
    this.container.innerHTML = `
      <div class="perf-dashboard ${this.options.compactMode ? 'compact' : ''}" style="
        position: fixed;
        top: 10px;
        right: 10px;
        width: ${this.options.compactMode ? '300px' : '400px'};
        background: rgba(0, 0, 0, 0.9);
        color: #fff;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        border: 1px solid #333;
        border-radius: 8px;
        padding: 10px;
        z-index: 10000;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
      ">

        <!-- Header -->
        <div class="dashboard-header" style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          border-bottom: 1px solid #333;
          padding-bottom: 5px;
        ">
          <span style="font-weight: bold; color: #4CAF50;">Performance Monitor</span>
          <div style="display: flex; gap: 5px;">
            <button id="toggle-dashboard" style="
              background: #333;
              color: #fff;
              border: none;
              padding: 2px 6px;
              border-radius: 3px;
              cursor: pointer;
              font-size: 10px;
            ">−</button>
            <button id="close-dashboard" style="
              background: #333;
              color: #fff;
              border: none;
              padding: 2px 6px;
              border-radius: 3px;
              cursor: pointer;
              font-size: 10px;
            ">×</button>
          </div>
        </div>

        <!-- Content -->
        <div id="dashboard-content">
          <!-- Status Indicators -->
          <div class="status-row" style="display: flex; gap: 10px; margin-bottom: 10px;">
            <div class="status-indicator" id="fps-status" style="
              width: 80px;
              padding: 4px;
              border-radius: 4px;
              text-align: center;
              background: #333;
            ">
              <div class="label" style="font-size: 10px; opacity: 0.7;">FPS</div>
              <div class="value" id="fps-value" style="font-weight: bold;">--</div>
            </div>
            <div class="status-indicator" id="memory-status" style="
              width: 80px;
              padding: 4px;
              border-radius: 4px;
              text-align: center;
              background: #333;
            ">
              <div class="label" style="font-size: 10px; opacity: 0.7;">Memory</div>
              <div class="value" id="memory-value" style="font-weight: bold;">--</div>
            </div>
            <div class="status-indicator" id="latency-status" style="
              width: 80px;
              padding: 4px;
              border-radius: 4px;
              text-align: center;
              background: #333;
            ">
              <div class="label" style="font-size: 10px; opacity: 0.7;">Latency</div>
              <div class="value" id="latency-value" style="font-weight: bold;">--</div>
            </div>
            <div class="status-indicator" id="network-status" style="
              width: 80px;
              padding: 4px;
              border-radius: 4px;
              text-align: center;
              background: #333;
            ">
              <div class="label" style="font-size: 10px; opacity: 0.7;">Network</div>
              <div class="value" id="network-value" style="font-weight: bold;">--</div>
            </div>
          </div>

          <!-- Mini Charts -->
          <div id="charts-section" style="margin-bottom: 10px;">
            <div class="mini-chart" style="margin-bottom: 5px;">
              <div class="chart-label" style="font-size: 10px; opacity: 0.7;">Frame Rate</div>
              <canvas id="fps-chart" width="380" height="40" style="
                width: 100%;
                height: 40px;
                background: #222;
                border-radius: 3px;
              "></canvas>
            </div>
            <div class="mini-chart" style="margin-bottom: 5px;">
              <div class="chart-label" style="font-size: 10px; opacity: 0.7;">Memory Usage</div>
              <canvas id="memory-chart" width="380" height="40" style="
                width: 100%;
                height: 40px;
                background: #222;
                border-radius: 3px;
              "></canvas>
            </div>
          </div>

          <!-- Professional Trading Metrics -->
          <div class="trading-metrics" style="
            background: #1a1a1a;
            padding: 8px;
            border-radius: 4px;
            margin-bottom: 10px;
          ">
            <div class="section-title" style="font-weight: bold; margin-bottom: 5px; color: #4CAF50;">
              Trading Requirements
            </div>
            <div class="metrics-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; font-size: 11px;">
              <div>
                <span style="opacity: 0.7;">60fps Target:</span>
                <span id="fps-target" style="float: right; color: #4CAF50;">--</span>
              </div>
              <div>
                <span style="opacity: 0.7;">&lt;100ms Latency:</span>
                <span id="latency-target" style="float: right; color: #4CAF50;">--</span>
              </div>
              <div>
                <span style="opacity: 0.7;">Memory Stable:</span>
                <span id="memory-stable" style="float: right; color: #4CAF50;">--</span>
              </div>
              <div>
                <span style="opacity: 0.7;">No Jank:</span>
                <span id="jank-status" style="float: right; color: #4CAF50;">--</span>
              </div>
            </div>
          </div>

          <!-- Alerts Section -->
          <div id="alerts-section" style="
            display: none;
            background: rgba(255, 0, 0, 0.1);
            border: 1px solid rgba(255, 0, 0, 0.3);
            border-radius: 4px;
            padding: 8px;
            margin-bottom: 10px;
          ">
            <div class="section-title" style="font-weight: bold; color: #ff6b6b; margin-bottom: 5px;">
              ⚠ Performance Alerts
            </div>
            <div id="alerts-list" style="font-size: 11px;"></div>
          </div>

          <!-- Session Stats -->
          <div class="session-stats" style="font-size: 10px; opacity: 0.7;">
            <div>
              <span>Session: </span>
              <span id="session-duration">0:00</span>
            </div>
            <div>
              <span>Grade: </span>
              <span id="performance-grade" style="color: #4CAF50; font-weight: bold;">A+</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // Cache element references
    this.cacheElements();
  }

  /**
   * Cache frequently used DOM elements
   */
  cacheElements() {
    const elements = [
      'dashboard-content', 'fps-value', 'memory-value', 'latency-value', 'network-value',
      'fps-chart', 'memory-chart', 'fps-target', 'latency-target', 'memory-stable',
      'jank-status', 'alerts-section', 'alerts-list', 'session-duration', 'performance-grade'
    ];

    elements.forEach(id => {
      this.elements.set(id, this.container.querySelector(`#${id}`));
    });
  }

  /**
   * Setup event listeners for dashboard controls
   */
  setupEventListeners() {
    // Toggle dashboard visibility
    this.container.querySelector('#toggle-dashboard').addEventListener('click', () => {
      this.toggleContent();
    });

    // Close dashboard
    this.container.querySelector('#close-dashboard').addEventListener('click', () => {
      this.hide();
    });

    // Make dashboard draggable
    this.makeDraggable();
  }

  /**
   * Make the dashboard draggable
   */
  makeDraggable() {
    const header = this.container.querySelector('.dashboard-header');
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;

    header.style.cursor = 'move';

    header.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;

      isDragging = true;
      initialX = e.clientX - this.container.offsetLeft;
      initialY = e.clientY - this.container.offsetTop;
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;

      this.container.style.left = currentX + 'px';
      this.container.style.top = currentY + 'px';
      this.container.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  /**
   * Toggle dashboard content visibility
   */
  toggleContent() {
    const content = this.elements.get('dashboard-content');
    const toggleBtn = this.container.querySelector('#toggle-dashboard');

    if (content.style.display === 'none') {
      content.style.display = 'block';
      toggleBtn.textContent = '−';
    } else {
      content.style.display = 'none';
      toggleBtn.textContent = '+';
    }
  }

  /**
   * Start monitoring and dashboard updates
   */
  startMonitoring() {
    // Subscribe to browser monitor events
    this.unsubscribe = browserMonitor.subscribe((event, data) => {
      this.handleMonitoringEvent(event, data);
    });

    // Start browser monitoring
    browserMonitor.start();

    // Start periodic updates
    this.updateInterval = setInterval(() => {
      this.updateMetrics();
      this.updateCharts();
      this.updateSessionStats();
    }, this.options.updateInterval);

    // Record session start time
    this.sessionStartTime = performance.now();
  }

  /**
   * Handle monitoring events
   */
  handleMonitoringEvent(event, data) {
    switch (event) {
      case 'performance:frame-rate':
        this.handleFrameRateAlert(data);
        break;
      case 'performance:memory-growth':
        this.handleMemoryAlert(data);
        break;
      case 'performance:websocket-latency':
        this.handleLatencyAlert(data);
        break;
      case 'performance:jank':
        this.handleJankAlert(data);
        break;
      case 'metric:updated':
        this.updateMetricHistory(data.type, data.data);
        break;
    }
  }

  /**
   * Handle frame rate alerts
   */
  handleFrameRateAlert(data) {
    this.addAlert({
      type: 'frame-rate',
      severity: data.severity,
      message: `Frame rate: ${data.fps} FPS (target: 60)`,
      suggestion: data.fps < 30 ? 'Critical - reduce canvas complexity' : 'Optimize rendering'
    });
  }

  /**
   * Handle memory growth alerts
   */
  handleMemoryAlert(data) {
    this.addAlert({
      type: 'memory',
      severity: data.severity,
      message: `Memory growing: ${data.growthRate.toFixed(1)} MB/min`,
      suggestion: 'Check for memory leaks in event listeners or canvas contexts'
    });
  }

  /**
   * Handle latency alerts
   */
  handleLatencyAlert(data) {
    this.addAlert({
      type: 'latency',
      severity: data.severity,
      message: `WebSocket latency: ${data.latency}ms`,
      suggestion: data.latency > 250 ? 'Connection issues - check network' : 'Monitor connection quality'
    });
  }

  /**
   * Handle jank alerts
   */
  handleJankAlert(data) {
    this.addAlert({
      type: 'jank',
      severity: data.severity,
      message: `Main thread blocked: ${data.duration}ms`,
      suggestion: 'Move heavy computations to web workers'
    });
  }

  /**
   * Add alert to dashboard
   */
  addAlert(alert) {
    this.alerts.unshift({
      ...alert,
      timestamp: performance.now()
    });

    // Keep only last 10 alerts
    if (this.alerts.length > 10) {
      this.alerts = this.alerts.slice(0, 10);
    }

    this.updateAlertsDisplay();
  }

  /**
   * Update alerts display
   */
  updateAlertsDisplay() {
    const alertsSection = this.elements.get('alerts-section');
    const alertsList = this.elements.get('alerts-list');

    if (this.alerts.length === 0) {
      alertsSection.style.display = 'none';
      return;
    }

    alertsSection.style.display = 'block';
    alertsList.innerHTML = this.alerts.slice(0, 3).map(alert => `
      <div style="
        margin-bottom: 4px;
        padding: 4px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 3px;
        border-left: 3px solid ${alert.severity === 'critical' ? '#ff3838' : '#ffa726'};
      ">
        <div style="font-weight: bold;">${alert.message}</div>
        <div style="opacity: 0.8; font-size: 10px;">${alert.suggestion}</div>
      </div>
    `).join('');
  }

  /**
   * Update metric history
   */
  updateMetricHistory(type, data) {
    const history = this.metricsHistory.get(type);
    if (!history) return;

    let value;
    switch (type) {
      case 'frameRate':
        value = data.fps || 0;
        break;
      case 'memory':
        value = (data.usedJSHeapSize || 0) / 1024 / 1024; // MB
        break;
      case 'websocket':
        value = data.latency || 0;
        break;
      case 'jank':
        value = data.duration || 0;
        break;
      default:
        value = data.value || 0;
    }

    history.push({
      timestamp: data.timestamp || performance.now(),
      value
    });

    // Keep only recent history
    if (history.length > this.options.historyLength) {
      history.shift();
    }
  }

  /**
   * Update dashboard metrics display
   */
  updateMetrics() {
    const snapshot = browserMonitor.getCurrentSnapshot();
    const fpsHistory = this.metricsHistory.get('fps');
    const memoryHistory = this.metricsHistory.get('memory');

    // Update FPS
    const currentFps = fpsHistory.length > 0 ? fpsHistory[fpsHistory.length - 1].value : 0;
    this.updateStatusIndicator('fps-value', 'fps-status', currentFps, {
      good: 58,
      warning: 45,
      format: (v) => `${Math.round(v)} FPS`
    });

    // Update Memory
    const currentMemory = memoryHistory.length > 0 ? memoryHistory[memoryHistory.length - 1].value : 0;
    this.updateStatusIndicator('memory-value', 'memory-status', currentMemory, {
      good: 200,
      warning: 400,
      format: (v) => `${Math.round(v)} MB`
    });

    // Update Latency (from WebSocket metrics)
    const wsMetrics = browserMonitor.processHealth.websocket || [];
    const recentLatency = wsMetrics.filter(m => m.eventType === 'message').slice(-5);
    const avgLatency = recentLatency.length > 0
      ? recentLatency.reduce((sum, m) => sum + (m.latency || 0), 0) / recentLatency.length
      : 0;

    this.updateStatusIndicator('latency-value', 'latency-status', avgLatency, {
      good: 50,
      warning: 150,
      format: (v) => `${Math.round(v)}ms`,
      inverse: true // Lower is better
    });

    // Update Network
    const networkStatus = snapshot.connection?.effectiveType || 'Unknown';
    const networkEl = this.elements.get('network-value');
    const networkStatusEl = this.container.querySelector('#network-status');

    networkEl.textContent = networkStatus.toUpperCase();
    networkStatusEl.style.background = networkStatus === '4g' ? '#4CAF50' :
                                     networkStatus === '3g' ? '#FFA726' : '#FF5252';

    // Update trading requirements
    this.updateTradingRequirements(currentFps, avgLatency, currentMemory);
  }

  /**
   * Update status indicator with color coding
   */
  updateStatusIndicator(valueElId, statusElId, value, thresholds) {
    const valueEl = this.elements.get(valueElId);
    const statusEl = this.container.querySelector(`#${statusElId}`);

    if (!valueEl || !statusEl) return;

    valueEl.textContent = thresholds.format(value);

    let color;
    if (thresholds.inverse) {
      color = value <= thresholds.good ? '#4CAF50' :
              value <= thresholds.warning ? '#FFA726' : '#FF5252';
    } else {
      color = value >= thresholds.good ? '#4CAF50' :
              value >= thresholds.warning ? '#FFA726' : '#FF5252';
    }

    statusEl.style.background = color;
  }

  /**
   * Update professional trading requirements
   */
  updateTradingRequirements(fps, latency, memory) {
    // 60fps Target
    const fpsTarget = this.elements.get('fps-target');
    const fpsGrade = fps >= 58 ? '✓' : fps >= 45 ? '⚠' : '✗';
    fpsTarget.textContent = fpsGrade;
    fpsTarget.style.color = fps >= 58 ? '#4CAF50' : fps >= 45 ? '#FFA726' : '#FF5252';

    // <100ms Latency
    const latencyTarget = this.elements.get('latency-target');
    const latencyGrade = latency <= 100 ? '✓' : latency <= 250 ? '⚠' : '✗';
    latencyTarget.textContent = latencyGrade;
    latencyTarget.style.color = latency <= 100 ? '#4CAF50' : latency <= 250 ? '#FFA726' : '#FF5252';

    // Memory Stable
    const memoryStable = this.elements.get('memory-stable');
    const memoryGrowthRate = this.calculateMemoryGrowthRate();
    const memoryGrade = memoryGrowthRate < 5 ? '✓' : memoryGrowthRate < 15 ? '⚠' : '✗';
    memoryStable.textContent = memoryGrade;
    memoryStable.style.color = memoryGrowthRate < 5 ? '#4CAF50' : memoryGrowthRate < 15 ? '#FFA726' : '#FF5252';

    // No Jank
    const jankStatus = this.elements.get('jank-status');
    const jankEvents = browserMonitor.processHealth.jank || [];
    const severeJank = jankEvents.filter(j => j.duration > 100);
    const jankGrade = severeJank.length < 5 ? '✓' : severeJank.length < 15 ? '⚠' : '✗';
    jankStatus.textContent = jankGrade;
    jankStatus.style.color = severeJank.length < 5 ? '#4CAF50' : severeJank.length < 15 ? '#FFA726' : '#FF5252';

    // Update overall grade
    this.updateOverallGrade(fpsGrade, latencyGrade, memoryGrade, jankGrade);
  }

  /**
   * Calculate memory growth rate
   */
  calculateMemoryGrowthRate() {
    const memoryHistory = this.metricsHistory.get('memory');
    if (memoryHistory.length < 10) return 0;

    const recent = memoryHistory.slice(-10);
    const first = recent[0].value;
    const last = recent[recent.length - 1].value;
    const timeDelta = (last.timestamp - first.timestamp) / 1000 / 60; // minutes

    return timeDelta > 0 ? ((last.value - first.value) / timeDelta) : 0;
  }

  /**
   * Update overall performance grade
   */
  updateOverallGrade(fpsGrade, latencyGrade, memoryGrade, jankGrade) {
    const gradeEl = this.elements.get('performance-grade');

    const checks = [fpsGrade, latencyGrade, memoryGrade, jankGrade];
    const passed = checks.filter(c => c === '✓').length;

    let grade;
    if (passed === 4) grade = 'A+';
    else if (passed === 3) grade = 'B+';
    else if (passed === 2) grade = 'C+';
    else if (passed === 1) grade = 'D+';
    else grade = 'F';

    gradeEl.textContent = grade;
    gradeEl.style.color = grade.startsWith('A') || grade.startsWith('B') ? '#4CAF50' :
                         grade.startsWith('C') ? '#FFA726' : '#FF5252';
  }

  /**
   * Update charts
   */
  updateCharts() {
    this.drawFpsChart();
    this.drawMemoryChart();
  }

  /**
   * Draw FPS chart
   */
  drawFpsChart() {
    const canvas = this.elements.get('fps-chart');
    const ctx = canvas.getContext('2d');
    const fpsHistory = this.metricsHistory.get('fps');

    if (!canvas || !ctx || fpsHistory.length === 0) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, width, height);

    // Draw grid line at 60fps
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    const sixtyFpsY = height - (60 / 120) * height; // Assuming max 120fps
    ctx.beginPath();
    ctx.moveTo(0, sixtyFpsY);
    ctx.lineTo(width, sixtyFpsY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw FPS line
    ctx.strokeStyle = '#00BCD4';
    ctx.lineWidth = 2;
    ctx.beginPath();

    fpsHistory.forEach((point, index) => {
      const x = (index / (this.options.historyLength - 1)) * width;
      const y = height - (point.value / 120) * height;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw current value
    if (fpsHistory.length > 0) {
      const current = fpsHistory[fpsHistory.length - 1].value;
      ctx.fillStyle = current >= 58 ? '#4CAF50' : current >= 45 ? '#FFA726' : '#FF5252';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`${Math.round(current)} FPS`, width - 40, 15);
    }
  }

  /**
   * Draw memory chart
   */
  drawMemoryChart() {
    const canvas = this.elements.get('memory-chart');
    const ctx = canvas.getContext('2d');
    const memoryHistory = this.metricsHistory.get('memory');

    if (!canvas || !ctx || memoryHistory.length === 0) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, width, height);

    // Find max value for scaling
    const maxMemory = Math.max(...memoryHistory.map(m => m.value), 500);

    // Draw memory line
    ctx.strokeStyle = '#FF9800';
    ctx.lineWidth = 2;
    ctx.beginPath();

    memoryHistory.forEach((point, index) => {
      const x = (index / (this.options.historyLength - 1)) * width;
      const y = height - (point.value / maxMemory) * height;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw current value
    if (memoryHistory.length > 0) {
      const current = memoryHistory[memoryHistory.length - 1].value;
      ctx.fillStyle = current < 200 ? '#4CAF50' : current < 400 ? '#FFA726' : '#FF5252';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`${Math.round(current)} MB`, width - 45, 15);
    }
  }

  /**
   * Update session statistics
   */
  updateSessionStats() {
    if (!this.sessionStartTime) return;

    const duration = performance.now() - this.sessionStartTime;
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);

    const durationEl = this.elements.get('session-duration');
    durationEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Show the dashboard
   */
  show() {
    this.container.style.display = 'block';
    this.isVisible = true;
  }

  /**
   * Hide the dashboard
   */
  hide() {
    this.container.style.display = 'none';
    this.isVisible = false;
  }

  /**
   * Toggle dashboard visibility
   */
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Destroy the dashboard and cleanup resources
   */
  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    if (this.unsubscribe) {
      this.unsubscribe();
    }

    browserMonitor.stop();

    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    this.isInitialized = false;
  }

  /**
   * Export current metrics as JSON
   */
  exportMetrics() {
    return {
      timestamp: new Date().toISOString(),
      sessionDuration: this.sessionStartTime ? performance.now() - this.sessionStartTime : 0,
      metrics: Object.fromEntries(this.metricsHistory),
      alerts: this.alerts,
      snapshot: browserMonitor.getCurrentSnapshot()
    };
  }

  /**
   * Set compact mode
   */
  setCompactMode(compact) {
    this.options.compactMode = compact;
    if (this.isInitialized) {
      this.container.querySelector('.perf-dashboard').classList.toggle('compact', compact);
      this.container.style.width = compact ? '300px' : '400px';
    }
  }
}

// Export singleton instance
export const performanceDashboard = new PerformanceDashboard();

// Export class for testing
export { PerformanceDashboard };