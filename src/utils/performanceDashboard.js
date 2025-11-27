/**
 * Performance Dashboard - Developer Tools Integration
 *
 * Comprehensive performance monitoring dashboard for development and debugging
 * of trading applications with real-time metrics and optimization suggestions.
 *
 * Design Philosophy: "Simple, Performant, Maintainable"
 * - Simple: Clear visual interface with actionable insights
 * - Performant: Minimal overhead on the monitored application
 * - Maintainable: Modular dashboard components with easy extensibility
 */

import { globalPerformanceMetrics } from './performanceMetrics.js';
import { globalMemoryProfiler } from './memoryProfiler.js';
import { globalRegressionDetector } from './performanceRegressionDetection.js';
import { globalMultiDisplayTracker } from './multiDisplayPerformanceTracker.js';

/**
 * Performance dashboard with developer tools integration
 */
export class PerformanceDashboard {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.verbose = options.verbose || false;
    this.updateInterval = options.updateInterval || 1000; // 1 second updates
    this.maxDataPoints = options.maxDataPoints || 60; // 1 minute of history

    // Dashboard state
    this.isVisible = false;
    this.dashboardElement = null;
    this.updateTimer = null;
    this.lastUpdate = 0;

    // Performance data storage
    this.historicalData = {
      fps: [],
      latency: [],
      memory: [],
      displays: [],
      regressions: []
    };

    // Dashboard configuration
    this.config = {
      showCharts: options.showCharts !== false,
      showAlerts: options.showAlerts !== false,
      showRecommendations: options.showRecommendations !== false,
      autoHide: options.autoHide || false,
      position: options.position || 'bottom-right'
    };

    // Thresholds for color coding
    this.thresholds = {
      fps: {
        excellent: 58,
        good: 55,
        warning: 45,
        critical: 30
      },
      latency: {
        excellent: 50,
        good: 80,
        warning: 120,
        critical: 200
      },
      memory: {
        excellent: 0.5,
        good: 0.7,
        warning: 0.85,
        critical: 0.95
      }
    };

    // Performance recommendations engine
    this.recommendations = new RecommendationEngine();

    console.log('[PERFORMANCE_DASHBOARD] Performance dashboard initialized');
  }

  /**
   * Initialize and show the performance dashboard
   */
  initialize() {
    if (!this.enabled) {
      console.warn('[PERFORMANCE_DASHBOARD] Dashboard is disabled');
      return false;
    }

    if (this.dashboardElement) {
      console.warn('[PERFORMANCE_DASHBOARD] Dashboard already initialized');
      return false;
    }

    this.createDashboardElement();
    this.setupEventListeners();
    this.startUpdates();

    console.log('[PERFORMANCE_DASHBOARD] Dashboard initialized and shown');
    return true;
  }

  /**
   * Create the dashboard DOM element
   */
  createDashboardElement() {
    // Create main dashboard container
    this.dashboardElement = document.createElement('div');
    this.dashboardElement.id = 'performance-dashboard';
    this.dashboardElement.className = 'performance-dashboard';
    this.dashboardElement.style.cssText = this.getDashboardStyles();

    // Create dashboard content structure
    this.dashboardElement.innerHTML = `
      <div class="dashboard-header">
        <h3>Performance Dashboard</h3>
        <div class="dashboard-controls">
          <button class="toggle-btn" data-action="toggle-visibility">Hide</button>
          <button class="reset-btn" data-action="reset-metrics">Reset</button>
          <button class="export-btn" data-action="export-data">Export</button>
        </div>
      </div>

      <div class="dashboard-content">
        <div class="metrics-section">
          <div class="metric-card fps-card">
            <h4>Frame Rate</h4>
            <div class="metric-value" id="fps-value">--</div>
            <div class="metric-trend" id="fps-trend"></div>
            <div class="mini-chart" id="fps-chart"></div>
          </div>

          <div class="metric-card latency-card">
            <h4>Latency</h4>
            <div class="metric-value" id="latency-value">--</div>
            <div class="metric-trend" id="latency-trend"></div>
            <div class="mini-chart" id="latency-chart"></div>
          </div>

          <div class="metric-card memory-card">
            <h4>Memory</h4>
            <div class="metric-value" id="memory-value">--</div>
            <div class="metric-trend" id="memory-trend"></div>
            <div class="mini-chart" id="memory-chart"></div>
          </div>

          <div class="metric-card displays-card">
            <h4>Displays</h4>
            <div class="metric-value" id="displays-value">--</div>
            <div class="metric-trend" id="displays-trend"></div>
            <div class="scaling-info" id="scaling-info"></div>
          </div>
        </div>

        ${this.config.showAlerts ? `
        <div class="alerts-section">
          <h4>Performance Alerts</h4>
          <div class="alerts-container" id="alerts-container">
            <div class="no-alerts">No active alerts</div>
          </div>
        </div>
        ` : ''}

        ${this.config.showRecommendations ? `
        <div class="recommendations-section">
          <h4>Optimization Recommendations</h4>
          <div class="recommendations-container" id="recommendations-container">
            <div class="no-recommendations">No recommendations at this time</div>
          </div>
        </div>
        ` : ''}

        <div class="details-section">
          <div class="details-tabs">
            <button class="tab-btn active" data-tab="system">System</button>
            <button class="tab-btn" data-tab="displays">Displays</button>
            <button class="tab-btn" data-tab="regressions">Regressions</button>
            <button class="tab-btn" data-tab="timeline">Timeline</button>
          </div>

          <div class="tab-content">
            <div class="tab-pane active" id="system-tab">
              <div class="system-details" id="system-details">
                Loading system details...
              </div>
            </div>

            <div class="tab-pane" id="displays-tab">
              <div class="displays-details" id="displays-details">
                Loading display details...
              </div>
            </div>

            <div class="tab-pane" id="regressions-tab">
              <div class="regressions-details" id="regressions-details">
                Loading regression details...
              </div>
            </div>

            <div class="tab-pane" id="timeline-tab">
              <div class="timeline-details" id="timeline-details">
                Loading timeline...
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add to page
    document.body.appendChild(this.dashboardElement);

    // Add custom styles
    this.addDashboardStyles();
  }

  /**
   * Get base dashboard styles
   */
  getDashboardStyles() {
    const positions = {
      'top-right': 'top: 10px; right: 10px;',
      'top-left': 'top: 10px; left: 10px;',
      'bottom-right': 'bottom: 10px; right: 10px;',
      'bottom-left': 'bottom: 10px; left: 10px;'
    };

    return `
      position: fixed;
      ${positions[this.config.position] || positions['bottom-right']};
      width: 400px;
      max-height: 80vh;
      background: rgba(17, 24, 39, 0.95);
      border: 1px solid rgba(75, 85, 99, 0.5);
      border-radius: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: #f3f4f6;
      z-index: 10000;
      overflow: hidden;
      backdrop-filter: blur(10px);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    `;
  }

  /**
   * Add custom dashboard styles
   */
  addDashboardStyles() {
    if (document.getElementById('performance-dashboard-styles')) return;

    const style = document.createElement('style');
    style.id = 'performance-dashboard-styles';
    style.textContent = `
      .performance-dashboard * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      .performance-dashboard h3, .performance-dashboard h4 {
        color: #f3f4f6;
        font-weight: 600;
        margin-bottom: 8px;
      }

      .dashboard-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: rgba(31, 41, 55, 0.8);
        border-bottom: 1px solid rgba(75, 85, 99, 0.5);
      }

      .dashboard-header h3 {
        font-size: 14px;
        margin: 0;
      }

      .dashboard-controls {
        display: flex;
        gap: 6px;
      }

      .dashboard-controls button {
        padding: 4px 8px;
        background: rgba(55, 65, 81, 0.8);
        border: 1px solid rgba(75, 85, 99, 0.5);
        border-radius: 4px;
        color: #f3f4f6;
        font-size: 10px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .dashboard-controls button:hover {
        background: rgba(75, 85, 99, 0.9);
      }

      .dashboard-content {
        max-height: 60vh;
        overflow-y: auto;
        padding: 12px;
      }

      .metrics-section {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-bottom: 16px;
      }

      .metric-card {
        background: rgba(31, 41, 55, 0.6);
        border: 1px solid rgba(75, 85, 99, 0.3);
        border-radius: 6px;
        padding: 12px;
      }

      .metric-card h4 {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #9ca3af;
      }

      .metric-value {
        font-size: 24px;
        font-weight: bold;
        margin: 4px 0;
      }

      .metric-trend {
        font-size: 10px;
        margin-bottom: 8px;
      }

      .mini-chart {
        height: 30px;
        background: rgba(17, 24, 39, 0.8);
        border-radius: 3px;
        position: relative;
        overflow: hidden;
      }

      .alerts-section, .recommendations-section {
        margin-bottom: 16px;
      }

      .alerts-container, .recommendations-container {
        max-height: 120px;
        overflow-y: auto;
        background: rgba(31, 41, 55, 0.4);
        border-radius: 4px;
        padding: 8px;
      }

      .alert-item, .recommendation-item {
        padding: 6px 8px;
        margin-bottom: 4px;
        border-radius: 3px;
        font-size: 11px;
      }

      .alert-critical {
        background: rgba(239, 68, 68, 0.2);
        border-left: 3px solid #ef4444;
      }

      .alert-warning {
        background: rgba(245, 158, 11, 0.2);
        border-left: 3px solid #f59e0b;
      }

      .alert-info {
        background: rgba(59, 130, 246, 0.2);
        border-left: 3px solid #3b82f6;
      }

      .recommendation-item {
        background: rgba(34, 197, 94, 0.1);
        border-left: 3px solid #22c55e;
      }

      .details-tabs {
        display: flex;
        gap: 2px;
        margin-bottom: 12px;
      }

      .tab-btn {
        flex: 1;
        padding: 6px 12px;
        background: rgba(55, 65, 81, 0.6);
        border: 1px solid rgba(75, 85, 99, 0.3);
        color: #9ca3af;
        cursor: pointer;
        font-size: 11px;
        transition: all 0.2s;
      }

      .tab-btn.active, .tab-btn:hover {
        background: rgba(75, 85, 99, 0.8);
        color: #f3f4f6;
      }

      .tab-content {
        background: rgba(31, 41, 55, 0.4);
        border-radius: 4px;
        padding: 12px;
        min-height: 150px;
      }

      .tab-pane {
        display: none;
      }

      .tab-pane.active {
        display: block;
      }

      .no-alerts, .no-recommendations {
        color: #6b7280;
        font-style: italic;
        text-align: center;
        padding: 20px;
      }

      .status-excellent { color: #22c55e; }
      .status-good { color: #84cc16; }
      .status-warning { color: #f59e0b; }
      .status-critical { color: #ef4444; }

      .trend-up { color: #ef4444; }
      .trend-down { color: #22c55e; }
      .trend-stable { color: #6b7280; }

      /* Scrollbar styling */
      .dashboard-content::-webkit-scrollbar,
      .alerts-container::-webkit-scrollbar,
      .recommendations-container::-webkit-scrollbar {
        width: 6px;
      }

      .dashboard-content::-webkit-scrollbar-track,
      .alerts-container::-webkit-scrollbar-track,
      .recommendations-container::-webkit-scrollbar-track {
        background: rgba(31, 41, 55, 0.4);
      }

      .dashboard-content::-webkit-scrollbar-thumb,
      .alerts-container::-webkit-scrollbar-thumb,
      .recommendations-container::-webkit-scrollbar-thumb {
        background: rgba(75, 85, 99, 0.6);
        border-radius: 3px;
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Setup event listeners for dashboard controls
   */
  setupEventListeners() {
    const dashboard = this.dashboardElement;

    // Toggle visibility
    const toggleBtn = dashboard.querySelector('[data-action="toggle-visibility"]');
    toggleBtn.addEventListener('click', () => this.toggleVisibility());

    // Reset metrics
    const resetBtn = dashboard.querySelector('[data-action="reset-metrics"]');
    resetBtn.addEventListener('click', () => this.resetMetrics());

    // Export data
    const exportBtn = dashboard.querySelector('[data-action="export-data"]');
    exportBtn.addEventListener('click', () => this.exportData());

    // Tab switching
    const tabBtns = dashboard.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });
  }

  /**
   * Start dashboard updates
   */
  startUpdates() {
    if (this.updateTimer) return;

    this.updateTimer = setInterval(() => {
      this.updateDashboard();
    }, this.updateInterval);

    // Initial update
    this.updateDashboard();
  }

  /**
   * Update dashboard with latest performance data
   */
  updateDashboard() {
    if (!this.isVisible || !this.dashboardElement) return;

    const now = Date.now();
    if (now - this.lastUpdate < this.updateInterval) return;

    try {
      // Collect performance data
      const metricsData = this.collectPerformanceData();

      // Update historical data
      this.updateHistoricalData(metricsData);

      // Update UI components
      this.updateMetricsDisplay(metricsData);
      if (this.config.showAlerts) {
        this.updateAlertsDisplay(metricsData);
      }
      if (this.config.showRecommendations) {
        this.updateRecommendationsDisplay(metricsData);
      }
      this.updateDetailsDisplay(metricsData);

      // Update mini charts
      this.updateMiniCharts();

      this.lastUpdate = now;

    } catch (error) {
      console.error('[PERFORMANCE_DASHBOARD] Error updating dashboard:', error);
    }
  }

  /**
   * Collect performance data from all monitoring systems
   */
  collectPerformanceData() {
    return {
      timestamp: Date.now(),
      performanceMetrics: globalPerformanceMetrics.getRealTimeMetrics(),
      memoryStats: globalMemoryProfiler.getMemoryStats(),
      regressionStatus: globalRegressionDetector.getRegressionStatus(),
      multiDisplaySummary: globalMultiDisplayTracker.getPerformanceSummary()
    };
  }

  /**
   * Update historical data storage
   */
  updateHistoricalData(metricsData) {
    const fps = metricsData.performanceMetrics?.frameRate?.currentFPS || 0;
    const latency = metricsData.performanceMetrics?.latency?.currentLatency || 0;
    const memoryPressure = metricsData.memoryStats?.pressure?.level || 0;
    const displayCount = metricsData.multiDisplaySummary?.displays?.total || 0;

    // Add to historical data
    this.historicalData.fps.push({ timestamp: metricsData.timestamp, value: fps });
    this.historicalData.latency.push({ timestamp: metricsData.timestamp, value: latency });
    this.historicalData.memory.push({ timestamp: metricsData.timestamp, value: memoryPressure });
    this.historicalData.displays.push({ timestamp: metricsData.timestamp, value: displayCount });

    // Maintain maximum data points
    Object.values(this.historicalData).forEach(dataArray => {
      if (dataArray.length > this.maxDataPoints) {
        dataArray.shift();
      }
    });
  }

  /**
   * Update metrics display cards
   */
  updateMetricsDisplay(metricsData) {
    // Update FPS
    const fpsValue = metricsData.performanceMetrics?.frameRate?.currentFPS || 0;
    const fpsElement = this.dashboardElement.querySelector('#fps-value');
    if (fpsElement) {
      fpsElement.textContent = Math.round(fpsValue);
      fpsElement.className = `metric-value ${this.getStatusClass('fps', fpsValue)}`;
    }

    // Update FPS trend
    this.updateTrendDisplay('fps', this.historicalData.fps);

    // Update Latency
    const latencyValue = metricsData.performanceMetrics?.latency?.currentLatency || 0;
    const latencyElement = this.dashboardElement.querySelector('#latency-value');
    if (latencyElement) {
      latencyElement.textContent = `${Math.round(latencyValue)}ms`;
      latencyElement.className = `metric-value ${this.getStatusClass('latency', latencyValue)}`;
    }

    // Update Latency trend
    this.updateTrendDisplay('latency', this.historicalData.latency);

    // Update Memory
    const memoryUsage = metricsData.memoryStats?.current?.usage || '0%';
    const memoryElement = this.dashboardElement.querySelector('#memory-value');
    if (memoryElement) {
      memoryElement.textContent = memoryUsage;
      memoryElement.className = `metric-value ${this.getStatusClass('memory', parseFloat(memoryUsage))}`;
    }

    // Update Memory trend
    this.updateTrendDisplay('memory', this.historicalData.memory);

    // Update Displays
    const displayCount = metricsData.multiDisplaySummary?.displays?.total || 0;
    const displaysElement = this.dashboardElement.querySelector('#displays-value');
    if (displaysElement) {
      displaysElement.textContent = displayCount;
      displaysElement.className = 'metric-value';
    }

    // Update scaling info
    this.updateScalingInfo(metricsData.multiDisplaySummary);
  }

  /**
   * Update trend display for a metric
   */
  updateTrendDisplay(metric, historicalData) {
    const trendElement = this.dashboardElement.querySelector(`#${metric}-trend`);
    if (!trendElement || historicalData.length < 2) return;

    const recent = historicalData.slice(-5);
    const older = historicalData.slice(-10, -5);

    if (older.length === 0) {
      trendElement.textContent = '•';
      trendElement.className = 'metric-trend trend-stable';
      return;
    }

    const recentAvg = recent.reduce((sum, d) => sum + d.value, 0) / recent.length;
    const olderAvg = older.reduce((sum, d) => sum + d.value, 0) / older.length;

    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    const trend = Math.abs(change) < 2 ? 'stable' : change > 0 ? 'up' : 'down';

    trendElement.textContent = `${trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} ${Math.abs(Math.round(change))}%`;
    trendElement.className = `metric-trend trend-${trend}`;
  }

  /**
   * Update scaling information display
   */
  updateScalingInfo(multiDisplaySummary) {
    const scalingElement = this.dashboardElement.querySelector('#scaling-info');
    if (!scalingElement || !multiDisplaySummary?.scaling) return;

    const scaling = multiDisplaySummary.scaling;
    scalingElement.innerHTML = `
      <div style="font-size: 10px; color: #9ca3af;">
        Status: <span class="${this.getStatusClass('scaling', scaling.status)}">${scaling.status}</span>
      </div>
    `;
  }

  /**
   * Update alerts display
   */
  updateAlertsDisplay(metricsData) {
    const alertsContainer = this.dashboardElement.querySelector('#alerts-container');
    if (!alertsContainer) return;

    const alerts = this.collectActiveAlerts(metricsData);

    if (alerts.length === 0) {
      alertsContainer.innerHTML = '<div class="no-alerts">No active alerts</div>';
      return;
    }

    alertsContainer.innerHTML = alerts.map(alert => `
      <div class="alert-item alert-${alert.severity}">
        <strong>${alert.title}</strong>
        <div>${alert.message}</div>
        <div style="font-size: 9px; color: #9ca3af; margin-top: 2px;">
          ${new Date(alert.timestamp).toLocaleTimeString()}
        </div>
      </div>
    `).join('');
  }

  /**
   * Update recommendations display
   */
  updateRecommendationsDisplay(metricsData) {
    const recommendationsContainer = this.dashboardElement.querySelector('#recommendations-container');
    if (!recommendationsContainer) return;

    const recommendations = this.recommendations.generateRecommendations(metricsData);

    if (recommendations.length === 0) {
      recommendationsContainer.innerHTML = '<div class="no-recommendations">No recommendations at this time</div>';
      return;
    }

    recommendationsContainer.innerHTML = recommendations.map(rec => `
      <div class="recommendation-item">
        <strong>${rec.title}</strong>
        <div>${rec.description}</div>
        <div style="font-size: 9px; color: #9ca3af; margin-top: 2px;">
          Priority: ${rec.priority}
        </div>
      </div>
    `).join('');
  }

  /**
   * Update details display tabs
   */
  updateDetailsDisplay(metricsData) {
    this.updateSystemDetails(metricsData);
    this.updateDisplaysDetails(metricsData);
    this.updateRegressionsDetails(metricsData);
    this.updateTimelineDetails();
  }

  /**
   * Update system details tab
   */
  updateSystemDetails(metricsData) {
    const systemDetails = this.dashboardElement.querySelector('#system-details');
    if (!systemDetails) return;

    const memory = metricsData.memoryStats;
    const performance = metricsData.performanceMetrics;

    systemDetails.innerHTML = `
      <div style="display: grid; gap: 12px;">
        <div>
          <strong>Memory Usage</strong>
          <div style="margin-top: 4px;">
            Used: ${memory?.current?.used || 'N/A'}<br>
            Total: ${memory?.current?.total || 'N/A'}<br>
            Limit: ${memory?.current?.limit || 'N/A'}<br>
            Pressure: ${memory?.pressure?.level || 'N/A'}
          </div>
        </div>
        <div>
          <strong>Performance</strong>
          <div style="margin-top: 4px;">
            Frame Rate: ${Math.round(performance?.frameRate?.averageFPS || 0)}fps<br>
            Latency: ${Math.round(performance?.latency?.averageLatency || 0)}ms<br>
            Displays: ${metricsData.multiDisplaySummary?.displays?.total || 0}
          </div>
        </div>
        <div>
          <strong>Collection Overhead</strong>
          <div style="margin-top: 4px;">
            ${performance?.collectionOverhead ? `${performance.collectionOverhead.toFixed(2)}ms` : 'N/A'}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Update displays details tab
   */
  updateDisplaysDetails(metricsData) {
    const displaysDetails = this.dashboardElement.querySelector('#displays-details');
    if (!displaysDetails) return;

    const multiDisplay = metricsData.multiDisplaySummary;

    displaysDetails.innerHTML = `
      <div style="display: grid; gap: 12px;">
        <div>
          <strong>Display Count</strong>
          <div style="margin-top: 4px;">
            Total: ${multiDisplay?.displays?.total || 0}<br>
            Healthy: ${multiDisplay?.displays?.health?.healthy || 0}<br>
            Warning: ${multiDisplay?.displays?.health?.warning || 0}<br>
            Critical: ${multiDisplay?.displays?.health?.critical || 0}
          </div>
        </div>
        <div>
          <strong>Performance</strong>
          <div style="margin-top: 4px;">
            Avg Render Time: ${multiDisplay?.performance?.averageRenderTime || 0}ms<br>
            Max Render Time: ${multiDisplay?.performance?.maxRenderTime || 0}ms<br>
            Avg Frame Rate: ${multiDisplay?.performance?.averageFrameRate || 0}fps<br>
            Render Efficiency: ${multiDisplay?.performance?.renderEfficiency || 0}%
          </div>
        </div>
        <div>
          <strong>Scaling Analysis</strong>
          <div style="margin-top: 4px;">
            Status: ${multiDisplay?.scaling?.status || 'unknown'}<br>
            ${multiDisplay?.scaling?.degradation ?
              `Render Degradation: ${multiDisplay.scaling.degradation.renderTime}%<br>
               Frame Rate Degradation: ${multiDisplay.scaling.degradation.frameRate}%<br>
               Overhead Excess: ${multiDisplay.scaling.overhead?.excess || 0}%` :
              'No scaling data available'
            }
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Update regressions details tab
   */
  updateRegressionsDetails(metricsData) {
    const regressionsDetails = this.dashboardElement.querySelector('#regressions-details');
    if (!regressionsDetails) return;

    const regressionStatus = metricsData.regressionStatus;

    regressionsDetails.innerHTML = `
      <div style="display: grid; gap: 12px;">
        <div>
          <strong>Regression Status</strong>
          <div style="margin-top: 4px;">
            Health: <span class="${this.getStatusClass('health', regressionStatus.health)}">${regressionStatus.health || 'unknown'}</span><br>
            Active Regressions: ${regressionStatus.regressionCount?.active || 0}<br>
            Critical Regressions: ${regressionStatus.regressionCount?.critical || 0}<br>
            Total Regressions: ${regressionStatus.regressionCount?.total || 0}
          </div>
        </div>
        ${regressionStatus.activeRegressions && regressionStatus.activeRegressions.length > 0 ? `
        <div>
          <strong>Active Regressions</strong>
          <div style="margin-top: 4px;">
            ${regressionStatus.activeRegressions.map(reg => `
              <div style="padding: 4px; margin: 4px 0; background: rgba(239, 68, 68, 0.1); border-left: 2px solid #ef4444; font-size: 11px;">
                <strong>${reg.type.replace('_', ' ')}</strong><br>
                Severity: ${reg.severity}<br>
                Impact: ${reg.impact}<br>
                Degradation: ${reg.degradation}
              </div>
            `).join('')}
          </div>
        </div>
        ` : '<div>No active regressions</div>'}
      </div>
    `;
  }

  /**
   * Update timeline details tab
   */
  updateTimelineDetails() {
    const timelineDetails = this.dashboardElement.querySelector('#timeline-details');
    if (!timelineDetails) return;

    const recentEvents = this.getRecentEvents();

    timelineDetails.innerHTML = `
      <div style="max-height: 200px; overflow-y: auto;">
        ${recentEvents.length > 0 ? recentEvents.map(event => `
          <div style="padding: 6px; margin: 4px 0; background: rgba(31, 41, 55, 0.6); font-size: 11px;">
            <div style="color: #9ca3af;">${new Date(event.timestamp).toLocaleTimeString()}</div>
            <div><strong>${event.type}:</strong> ${event.message}</div>
          </div>
        `).join('') : '<div>No recent events</div>'}
      </div>
    `;
  }

  /**
   * Update mini charts
   */
  updateMiniCharts() {
    this.updateMiniChart('fps', this.historicalData.fps, this.thresholds.fps.excellent);
    this.updateMiniChart('latency', this.historicalData.latency, this.thresholds.latency.warning);
    this.updateMiniChart('memory', this.historicalData.memory, this.thresholds.memory.warning);
  }

  /**
   * Update individual mini chart
   */
  updateMiniChart(metric, data, warningThreshold) {
    const chartElement = this.dashboardElement.querySelector(`#${metric}-chart`);
    if (!chartElement || data.length < 2) return;

    const width = chartElement.offsetWidth;
    const height = chartElement.offsetHeight;

    // Create canvas for chart
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    const ctx = canvas.getContext('2d');

    // Clear and draw chart
    ctx.clearRect(0, 0, width, height);

    const values = data.map(d => d.value);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const range = maxValue - minValue || 1;

    // Draw line chart
    ctx.strokeStyle = this.getChartColor(metric, values[values.length - 1]);
    ctx.lineWidth = 1;
    ctx.beginPath();

    values.forEach((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - minValue) / range) * height;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Replace chart content
    chartElement.innerHTML = '';
    chartElement.appendChild(canvas);
  }

  /**
   * Get status class for metric value
   */
  getStatusClass(metric, value) {
    const threshold = this.thresholds[metric];
    if (!threshold) return '';

    let status;
    if (metric === 'fps') {
      status = value >= threshold.excellent ? 'excellent' :
               value >= threshold.good ? 'good' :
               value >= threshold.warning ? 'warning' : 'critical';
    } else if (metric === 'latency') {
      status = value <= threshold.excellent ? 'excellent' :
               value <= threshold.good ? 'good' :
               value <= threshold.warning ? 'warning' : 'critical';
    } else if (metric === 'memory') {
      status = value <= threshold.excellent ? 'excellent' :
               value <= threshold.good ? 'good' :
               value <= threshold.warning ? 'warning' : 'critical';
    } else if (metric === 'health') {
      status = value === 'excellent' ? 'excellent' :
               value === 'good' ? 'good' :
               value === 'warning' ? 'warning' : 'critical';
    } else if (metric === 'scaling') {
      status = value === 'healthy' ? 'excellent' :
               value === 'warning' ? 'warning' : 'critical';
    } else {
      return '';
    }

    return `status-${status}`;
  }

  /**
   * Get chart color based on metric and value
   */
  getChartColor(metric, value) {
    const statusClass = this.getStatusClass(metric, value);
    const colors = {
      'status-excellent': '#22c55e',
      'status-good': '#84cc16',
      'status-warning': '#f59e0b',
      'status-critical': '#ef4444'
    };

    return colors[statusClass] || '#6b7280';
  }

  /**
   * Collect active alerts from all monitoring systems
   */
  collectActiveAlerts(metricsData) {
    const alerts = [];

    // Performance alerts
    const performance = metricsData.performanceMetrics;
    if (performance) {
      if (performance.frameRate && performance.frameRate.currentFPS < this.thresholds.fps.critical) {
        alerts.push({
          title: 'Critical Frame Rate',
          message: `Frame rate dropped to ${Math.round(performance.frameRate.currentFPS)}fps`,
          severity: 'critical',
          timestamp: Date.now()
        });
      }

      if (performance.latency && performance.latency.currentLatency > this.thresholds.latency.critical) {
        alerts.push({
          title: 'High Latency',
          message: `Latency increased to ${Math.round(performance.latency.currentLatency)}ms`,
          severity: 'critical',
          timestamp: Date.now()
        });
      }
    }

    // Memory alerts
    const memory = metricsData.memoryStats;
    if (memory && memory.pressure && memory.pressure.level > this.thresholds.memory.critical) {
      alerts.push({
        title: 'Critical Memory Pressure',
        message: `Memory pressure at ${memory.pressure.level}`,
        severity: 'critical',
        timestamp: Date.now()
      });
    }

    // Regression alerts
    const regressions = metricsData.regressionStatus;
    if (regressions && regressions.regressionCount && regressions.regressionCount.critical > 0) {
      alerts.push({
        title: 'Critical Performance Regression',
        message: `${regressions.regressionCount.critical} critical regressions detected`,
        severity: 'critical',
        timestamp: Date.now()
      });
    }

    return alerts.sort((a, b) => {
      const severityOrder = { critical: 3, warning: 2, info: 1 };
      return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
    });
  }

  /**
   * Get recent performance events
   */
  getRecentEvents() {
    const events = [];

    // Add recent regression events
    const regressionData = globalRegressionDetector.exportData();
    if (regressionData.history && regressionData.history.regressions) {
      regressionData.history.regressions.slice(-10).forEach(regression => {
        events.push({
          type: 'Regression',
          message: `${regression.type.replace('_', ' ')} - ${regression.severity}`,
          timestamp: regression.detectedAt
        });
      });
    }

    return events.sort((a, b) => b.timestamp - a.timestamp).slice(-20);
  }

  /**
   * Switch between detail tabs
   */
  switchTab(tabName) {
    // Update tab buttons
    const tabBtns = this.dashboardElement.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab panes
    const tabPanes = this.dashboardElement.querySelectorAll('.tab-pane');
    tabPanes.forEach(pane => {
      pane.classList.toggle('active', pane.id === `${tabName}-tab`);
    });
  }

  /**
   * Toggle dashboard visibility
   */
  toggleVisibility() {
    this.isVisible = !this.isVisible;

    if (this.isVisible) {
      this.dashboardElement.style.display = 'block';
      this.startUpdates();
    } else {
      this.dashboardElement.style.display = 'none';
      this.stopUpdates();
    }

    // Update button text
    const toggleBtn = this.dashboardElement.querySelector('[data-action="toggle-visibility"]');
    if (toggleBtn) {
      toggleBtn.textContent = this.isVisible ? 'Hide' : 'Show';
    }
  }

  /**
   * Stop dashboard updates
   */
  stopUpdates() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  /**
   * Reset all metrics
   */
  resetMetrics() {
    globalPerformanceMetrics.reset();
    globalMemoryProfiler.reset();
    globalRegressionDetector.reset();
    globalMultiDisplayTracker.reset();

    // Clear historical data
    Object.keys(this.historicalData).forEach(key => {
      this.historicalData[key] = [];
    });

    console.log('[PERFORMANCE_DASHBOARD] All metrics reset');
  }

  /**
   * Export performance data
   */
  exportData() {
    const exportData = {
      timestamp: Date.now(),
      historicalData: this.historicalData,
      performanceMetrics: globalPerformanceMetrics.exportData(),
      memoryProfiler: globalMemoryProfiler.exportData(),
      regressionDetector: globalRegressionDetector.exportData(),
      multiDisplayTracker: globalMultiDisplayTracker.exportData()
    };

    // Create download link
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `performance-data-${new Date().toISOString().slice(0, 19)}.json`;
    link.click();

    URL.revokeObjectURL(url);

    console.log('[PERFORMANCE_DASHBOARD] Performance data exported');
  }

  /**
   * Show the dashboard
   */
  show() {
    if (!this.dashboardElement) {
      this.initialize();
    } else {
      this.isVisible = true;
      this.dashboardElement.style.display = 'block';
      this.startUpdates();
    }
  }

  /**
   * Hide the dashboard
   */
  hide() {
    this.isVisible = false;
    if (this.dashboardElement) {
      this.dashboardElement.style.display = 'none';
    }
    this.stopUpdates();
  }

  /**
   * Destroy the dashboard
   */
  destroy() {
    this.stopUpdates();

    if (this.dashboardElement) {
      this.dashboardElement.remove();
      this.dashboardElement = null;
    }

    // Remove styles
    const styles = document.getElementById('performance-dashboard-styles');
    if (styles) {
      styles.remove();
    }

    console.log('[PERFORMANCE_DASHBOARD] Dashboard destroyed');
  }
}

/**
 * Performance recommendations engine
 */
class RecommendationEngine {
  constructor() {
    this.rules = [
      // FPS recommendations
      {
        condition: (data) => data.performanceMetrics?.frameRate?.currentFPS < 45,
        generate: () => ({
          title: 'Optimize Frame Rate',
          description: 'Consider reducing visual complexity or disabling animations',
          priority: 'High'
        })
      },

      // Memory recommendations
      {
        condition: (data) => {
          const pressure = parseFloat(data.memoryStats?.pressure?.level || '0');
          return pressure > 0.8;
        },
        generate: () => ({
          title: 'High Memory Usage',
          description: 'Monitor for memory leaks and consider garbage collection',
          priority: 'Critical'
        })
      },

      // Display scaling recommendations
      {
        condition: (data) => {
          const total = data.multiDisplaySummary?.displays?.total || 0;
          return total > 15;
        },
        generate: () => ({
          title: 'High Display Count',
          description: 'Consider grouping displays or reducing concurrent visualizations',
          priority: 'Medium'
        })
      },

      // Regression recommendations
      {
        condition: (data) => data.regressionStatus?.regressionCount?.active > 0,
        generate: () => ({
          title: 'Performance Regression Detected',
          description: 'Review recent changes that may have impacted performance',
          priority: 'High'
        })
      }
    ];
  }

  generateRecommendations(metricsData) {
    return this.rules
      .filter(rule => rule.condition(metricsData))
      .map(rule => rule.generate())
      .slice(0, 5); // Limit to top 5 recommendations
  }
}

/**
 * Global performance dashboard instance
 */
export const globalPerformanceDashboard = new PerformanceDashboard();

/**
 * Convenience function to show performance dashboard
 */
export function showPerformanceDashboard(options = {}) {
  const dashboard = new PerformanceDashboard(options);
  dashboard.show();
  return dashboard;
}