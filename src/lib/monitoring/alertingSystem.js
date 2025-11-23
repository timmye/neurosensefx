/**
 * Automated Alerting and Reporting System
 *
 * Provides intelligent alerting for performance issues that impact professional trading.
 * Generates comprehensive reports with actionable insights and baseline comparisons.
 *
 * Essential for maintaining system reliability and catching performance regressions
 * before they impact live trading decisions.
 */

import { browserMonitor } from './browserProcessMonitor.js';
import { tradingValidator } from './tradingPerformanceValidator.js';

class AlertingSystem {
  constructor(options = {}) {
    this.options = {
      enableNotifications: true,
      enableReporting: true,
      enableAlerts: true,
      reportInterval: 5 * 60 * 1000, // 5 minutes
      historyRetention: 24 * 60 * 60 * 1000, // 24 hours
      ...options
    };

    this.alerts = [];
    this.reports = [];
    this.baselines = new Map();
    this.subscribers = new Map();
    this.alertRules = new Map();
    this.isRunning = false;

    // Initialize alert rules
    this.initializeAlertRules();

    // Setup scheduling
    this.reportInterval = null;
    this.cleanupInterval = null;
  }

  /**
   * Initialize professional trading alert rules
   */
  initializeAlertRules() {
    // Critical alerts (immediate attention required)
    this.alertRules.set('critical-frame-rate', {
      name: 'Critical Frame Rate Drop',
      severity: 'critical',
      category: 'performance',
      condition: (metrics) => {
        const fps = metrics.frameRate?.current;
        return fps < 30; // Below 30fps is unusable for trading
      },
      message: (metrics) => `Frame rate critical: ${metrics.frameRate?.current.toFixed(1)} FPS`,
      action: 'immediate',
      cooldown: 30000 // 30 seconds
    });

    this.alertRules.set('critical-latency', {
      name: 'Critical Data Latency',
      severity: 'critical',
      category: 'latency',
      condition: (metrics) => {
        const latency = metrics.dataLatency?.current;
        return latency > 500; // Above 500ms impacts trading decisions
      },
      message: (metrics) => `Data latency critical: ${metrics.dataLatency?.current.toFixed(0)}ms`,
      action: 'immediate',
      cooldown: 15000 // 15 seconds
    });

    this.alertRules.set('memory-leak-detected', {
      name: 'Memory Leak Detected',
      severity: 'critical',
      category: 'memory',
      condition: (metrics) => {
        const growthRate = metrics.memory?.growthRate;
        return growthRate > 20; // Growing faster than 20MB/min
      },
      message: (metrics) => `Memory leak detected: ${metrics.memory?.growthRate.toFixed(1)} MB/min`,
      action: 'immediate',
      cooldown: 60000 // 1 minute
    });

    // Warning alerts (attention required soon)
    this.alertRules.set('frame-rate-degradation', {
      name: 'Frame Rate Degradation',
      severity: 'warning',
      category: 'performance',
      condition: (metrics) => {
        const fps = metrics.frameRate?.current;
        return fps < 50 && fps >= 30; // Below target but usable
      },
      message: (metrics) => `Frame rate degraded: ${metrics.frameRate?.current.toFixed(1)} FPS`,
      action: 'investigate',
      cooldown: 120000 // 2 minutes
    });

    this.alertRules.set('latency-increase', {
      name: 'Data Latency Increase',
      severity: 'warning',
      category: 'latency',
      condition: (metrics) => {
        const latency = metrics.dataLatency?.current;
        return latency > 150 && latency <= 500;
      },
      message: (metrics) => `Data latency increased: ${metrics.dataLatency?.current.toFixed(0)}ms`,
      action: 'investigate',
      cooldown: 60000 // 1 minute
    });

    this.alertRules.set('memory-pressure', {
      name: 'Memory Pressure Building',
      severity: 'warning',
      category: 'memory',
      condition: (metrics) => {
        const current = metrics.memory?.current;
        return current > 400 && current <= 600; // MB
      },
      message: (metrics) => `Memory pressure: ${metrics.memory?.current.toFixed(0)} MB`,
      action: 'monitor',
      cooldown: 180000 // 3 minutes
    });

    // Info alerts (tracking and trends)
    this.alertRules.set('performance-trend-negative', {
      name: 'Performance Trending Down',
      severity: 'info',
      category: 'trend',
      condition: (metrics, history) => {
        // Check if performance is declining over time
        if (history.length < 10) return false;

        const recent = history.slice(-5);
        const older = history.slice(-10, -5);

        const recentAvg = recent.reduce((sum, h) => sum + (h.frameRate?.current || 0), 0) / recent.length;
        const olderAvg = older.reduce((sum, h) => sum + (h.frameRate?.current || 0), 0) / older.length;

        return recentAvg < olderAvg * 0.9; // 10% decline
      },
      message: () => 'Performance trending downward over recent measurements',
      action: 'analyze',
      cooldown: 300000 // 5 minutes
    });

    // Professional trading specific alerts
    this.alertRules.set('trading-requirements-failed', {
      name: 'Trading Requirements Not Met',
      severity: 'critical',
      category: 'trading',
      condition: (metrics) => {
        // Check if professional trading requirements are failing
        const fpsOk = (metrics.frameRate?.current || 0) >= 55;
        const latencyOk = (metrics.dataLatency?.current || Infinity) <= 100;
        const memoryOk = (metrics.memory?.growthRate || 0) < 5;

        return !fpsOk || !latencyOk || !memoryOk;
      },
      message: (metrics) => {
        const issues = [];
        if ((metrics.frameRate?.current || 0) < 55) issues.push('frame rate');
        if ((metrics.dataLatency?.current || Infinity) > 100) issues.push('data latency');
        if ((metrics.memory?.growthRate || 0) >= 5) issues.push('memory growth');
        return `Trading requirements failed: ${issues.join(', ')}`;
      },
      action: 'immediate',
      cooldown: 60000 // 1 minute
    });
  }

  /**
   * Start the alerting system
   */
  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log('🚨 Starting Automated Alerting and Reporting System');

    // Subscribe to browser monitor events
    this.unsubscribe = browserMonitor.subscribe((event, data) => {
      this.handleMonitoringEvent(event, data);
    });

    // Start monitoring
    if (!browserMonitor.isMonitoring) {
      browserMonitor.start();
    }

    // Setup periodic reporting
    this.setupPeriodicReporting();

    // Setup cleanup
    this.setupCleanup();

    // Establish baseline if not exists
    this.establishBaseline();
  }

  /**
   * Stop the alerting system
   */
  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;

    // Clear intervals
    if (this.reportInterval) clearInterval(this.reportInterval);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);

    // Unsubscribe from events
    if (this.unsubscribe) this.unsubscribe();

    console.log('🛑 Alerting and Reporting System stopped');
  }

  /**
   * Setup periodic reporting
   */
  setupPeriodicReporting() {
    this.reportInterval = setInterval(() => {
      if (this.options.enableReporting) {
        this.generatePeriodicReport();
      }
    }, this.options.reportInterval);
  }

  /**
   * Setup cleanup for old data
   */
  setupCleanup() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000); // Run cleanup every hour
  }

  /**
   * Handle monitoring events and check alert rules
   */
  handleMonitoringEvent(event, data) {
    if (!this.options.enableAlerts) return;

    const metrics = this.extractCurrentMetrics();
    const history = this.getMetricsHistory();

    // Check all alert rules
    for (const [ruleId, rule] of this.alertRules) {
      try {
        if (this.shouldTriggerAlert(ruleId, rule, metrics, history)) {
          this.triggerAlert(ruleId, rule, metrics, data);
        }
      } catch (error) {
        console.error(`Error checking alert rule ${ruleId}:`, error);
      }
    }
  }

  /**
   * Extract current metrics from browser monitor
   */
  extractCurrentMetrics() {
    const snapshot = browserMonitor.getCurrentSnapshot();
    const continuous = browserMonitor.processHealth;

    const metrics = {
      timestamp: performance.now(),
      frameRate: null,
      dataLatency: null,
      memory: null,
      network: null,
      jank: null
    };

    // Frame rate
    const fpsHistory = continuous.frameRate;
    if (fpsHistory && fpsHistory.length > 0) {
      const recentFps = fpsHistory.slice(-5);
      metrics.frameRate = {
        current: recentFps.reduce((sum, f) => sum + f.fps, 0) / recentFps.length,
        trend: this.calculateTrend(recentFps.map(f => f.fps))
      };
    }

    // Data latency
    const wsMetrics = continuous.websocket;
    if (wsMetrics && wsMetrics.length > 0) {
      const recentLatency = wsMetrics
        .filter(m => m.eventType === 'message')
        .slice(-10);

      if (recentLatency.length > 0) {
        const avgLatency = recentLatency.reduce((sum, m) => sum + m.latency, 0) / recentLatency.length;
        metrics.dataLatency = {
          current: avgLatency,
          trend: this.calculateTrend(recentLatency.map(m => m.latency))
        };
      }
    }

    // Memory
    if (snapshot.memory) {
      const currentMemory = snapshot.memory.used / 1024 / 1024; // MB
      const growthRate = this.calculateMemoryGrowthRate();

      metrics.memory = {
        current: currentMemory,
        growthRate,
        trend: growthRate > 2 ? 'increasing' : growthRate < -2 ? 'decreasing' : 'stable'
      };
    }

    // Network
    if (snapshot.connection) {
      metrics.network = {
        type: snapshot.connection.effectiveType,
        rtt: snapshot.connection.rtt,
        downlink: snapshot.connection.downlink
      };
    }

    // Jank
    const jankEvents = continuous.jank;
    if (jankEvents && jankEvents.length > 0) {
      const recentJank = jankEvents.slice(-10);
      metrics.jank = {
        count: recentJank.length,
        averageDuration: recentJank.reduce((sum, j) => sum + j.duration, 0) / recentJank.length,
        maxDuration: Math.max(...recentJank.map(j => j.duration))
      };
    }

    return metrics;
  }

  /**
   * Get metrics history for trend analysis
   */
  getMetricsHistory() {
    // This would typically come from stored historical data
    // For now, return recent snapshots
    const history = [];
    const now = performance.now();

    for (let i = 0; i < 20; i++) {
      history.push(this.extractCurrentMetrics());
      // Simulate historical data by going back in time
      history[i].timestamp = now - (i * 60000); // 1 minute intervals
    }

    return history;
  }

  /**
   * Check if alert should be triggered
   */
  shouldTriggerAlert(ruleId, rule, metrics, history) {
    // Check cooldown
    if (this.isOnCooldown(ruleId)) return false;

    // Check condition
    try {
      return rule.condition(metrics, history);
    } catch (error) {
      console.error(`Error evaluating alert condition for ${ruleId}:`, error);
      return false;
    }
  }

  /**
   * Trigger an alert
   */
  triggerAlert(ruleId, rule, metrics, data) {
    const alert = {
      id: this.generateAlertId(),
      ruleId,
      timestamp: performance.now(),
      severity: rule.severity,
      category: rule.category,
      name: rule.name,
      message: rule.message(metrics),
      metrics: this.sanitizeMetrics(metrics),
      action: rule.action,
      acknowledged: false,
      resolved: false
    };

    this.alerts.unshift(alert);

    // Set cooldown
    this.setCooldown(ruleId, rule.cooldown);

    // Notify subscribers
    this.notifySubscribers('alert:triggered', alert);

    // Log alert
    this.logAlert(alert);

    // Take automatic action if needed
    this.takeAutomaticAction(alert);

    console.warn(`🚨 ALERT [${rule.severity.toUpperCase()}]: ${alert.message}`);
  }

  /**
   * Take automatic action based on alert severity and type
   */
  takeAutomaticAction(alert) {
    switch (alert.action) {
      case 'immediate':
        // Critical alerts - take immediate action
        this.handleCriticalAlert(alert);
        break;
      case 'investigate':
        // Warning alerts - prepare investigation data
        this.prepareInvestigationData(alert);
        break;
      case 'monitor':
        // Info alerts - just monitor for now
        this.monitorTrend(alert);
        break;
      case 'analyze':
        // Trend alerts - analyze pattern
        this.analyzeTrend(alert);
        break;
    }
  }

  /**
   * Handle critical alerts
   */
  handleCriticalAlert(alert) {
    switch (alert.category) {
      case 'performance':
        // Suggest performance optimization
        this.suggestPerformanceOptimization(alert);
        break;
      case 'latency':
        // Suggest network optimization
        this.suggestNetworkOptimization(alert);
        break;
      case 'memory':
        // Suggest memory cleanup
        this.suggestMemoryCleanup(alert);
        break;
      case 'trading':
        // Critical trading requirements failure
        this.handleTradingRequirementsFailure(alert);
        break;
    }
  }

  /**
   * Suggest performance optimizations
   */
  suggestPerformanceOptimization(alert) {
    const suggestions = [
      'Reduce canvas rendering complexity',
      'Implement render throttling',
      'Optimize animation loops',
      'Consider using web workers for heavy computations',
      'Reduce number of concurrent displays'
    ];

    this.notifySubscribers('suggestion:performance', {
      alert,
      suggestions
    });
  }

  /**
   * Suggest network optimizations
   */
  suggestNetworkOptimization(alert) {
    const suggestions = [
      'Check WebSocket connection health',
      'Implement message batching',
      'Add connection retry logic',
      'Monitor network quality indicators'
    ];

    this.notifySubscribers('suggestion:network', {
      alert,
      suggestions
    });
  }

  /**
   * Suggest memory cleanup
   */
  suggestMemoryCleanup(alert) {
    const suggestions = [
      'Check for memory leaks in event listeners',
      'Clean up unused canvas contexts',
      'Close unused WebSocket connections',
      'Implement object pooling for frequent allocations'
    ];

    this.notifySubscribers('suggestion:memory', {
      alert,
      suggestions
    });
  }

  /**
   * Handle trading requirements failure
   */
  handleTradingRequirementsFailure(alert) {
    const criticalActions = [
      'System does not meet professional trading standards',
      'Consider reducing workload or optimizing performance',
      'Monitor closely during active trading periods',
      'May impact trading decision accuracy'
    ];

    this.notifySubscribers('critical:trading', {
      alert,
      actions: criticalActions,
      recommendation: 'Immediate optimization required'
    });
  }

  /**
   * Generate periodic performance report
   */
  async generatePeriodicReport() {
    const reportStartTime = performance.now();
    const metrics = this.extractCurrentMetrics();
    const history = this.getMetricsHistory();

    const report = {
      id: this.generateReportId(),
      timestamp: new Date().toISOString(),
      duration: this.options.reportInterval,
      summary: this.generateReportSummary(metrics, history),
      metrics: metrics,
      alerts: this.getRecentAlerts(),
      trends: this.analyzeTrends(history),
      recommendations: this.generateRecommendations(metrics, history),
      grade: this.calculatePerformanceGrade(metrics)
    };

    this.reports.unshift(report);

    // Notify subscribers
    this.notifySubscribers('report:generated', report);

    // Log report
    this.logReport(report);

    console.log('📊 Performance report generated:', report.summary);

    return report;
  }

  /**
   * Generate report summary
   */
  generateReportSummary(metrics, history) {
    const summary = {
      overallGrade: 'A',
      criticalIssues: 0,
      warnings: 0,
      performance: 'excellent'
    };

    // Check frame rate
    if (metrics.frameRate?.current < 30) {
      summary.criticalIssues++;
      summary.performance = 'critical';
    } else if (metrics.frameRate?.current < 50) {
      summary.warnings++;
      summary.performance = summary.performance === 'excellent' ? 'degraded' : summary.performance;
    }

    // Check latency
    if (metrics.dataLatency?.current > 500) {
      summary.criticalIssues++;
      summary.performance = 'critical';
    } else if (metrics.dataLatency?.current > 150) {
      summary.warnings++;
      summary.performance = summary.performance === 'excellent' ? 'degraded' : summary.performance;
    }

    // Check memory
    if (metrics.memory?.growthRate > 20) {
      summary.criticalIssues++;
      summary.performance = 'critical';
    } else if (metrics.memory?.growthRate > 10) {
      summary.warnings++;
      summary.performance = summary.performance === 'excellent' ? 'degraded' : summary.performance;
    }

    // Determine overall grade
    if (summary.criticalIssues > 0) {
      summary.overallGrade = 'F';
    } else if (summary.warnings > 2) {
      summary.overallGrade = 'C';
    } else if (summary.warnings > 0) {
      summary.overallGrade = 'B';
    }

    return summary;
  }

  /**
   * Analyze trends from historical data
   */
  analyzeTrends(history) {
    const trends = {};

    if (history.length < 5) return trends;

    // Frame rate trend
    const fpsValues = history.map(h => h.frameRate?.current || 0);
    trends.frameRate = this.calculateTrendAnalysis(fpsValues);

    // Latency trend
    const latencyValues = history.map(h => h.dataLatency?.current || 0);
    trends.latency = this.calculateTrendAnalysis(latencyValues);

    // Memory trend
    const memoryValues = history.map(h => h.memory?.current || 0);
    trends.memory = this.calculateTrendAnalysis(memoryValues);

    return trends;
  }

  /**
   * Calculate trend analysis for a series of values
   */
  calculateTrendAnalysis(values) {
    if (values.length < 3) return { direction: 'stable', slope: 0 };

    // Simple linear regression
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, index) => sum + (index * val), 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgValue = sumY / n;

    let direction = 'stable';
    if (Math.abs(slope) > avgValue * 0.01) { // 1% change threshold
      direction = slope > 0 ? 'increasing' : 'decreasing';
    }

    return {
      direction,
      slope,
      average: avgValue,
      confidence: Math.min(1, Math.abs(slope) / (avgValue * 0.1))
    };
  }

  /**
   * Calculate performance grade
   */
  calculatePerformanceGrade(metrics) {
    const checks = [
      metrics.frameRate?.current >= 55,
      metrics.dataLatency?.current <= 100,
      metrics.memory?.growthRate < 5,
      (metrics.jank?.count || 0) < 5
    ];

    const passed = checks.filter(Boolean).length;

    if (passed === 4) return 'A';
    if (passed === 3) return 'B';
    if (passed === 2) return 'C';
    return 'F';
  }

  /**
   * Subscribe to alerting system events
   */
  subscribe(event, callback) {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, new Set());
    }

    this.subscribers.get(event).add(callback);

    // Return unsubscribe function
    return () => {
      const eventSubscribers = this.subscribers.get(event);
      if (eventSubscribers) {
        eventSubscribers.delete(callback);
      }
    };
  }

  /**
   * Notify subscribers of events
   */
  notifySubscribers(event, data) {
    const eventSubscribers = this.subscribers.get(event);
    if (eventSubscribers) {
      for (const callback of eventSubscribers) {
        try {
          callback(data);
        } catch (error) {
          console.error(`Subscriber error for event ${event}:`, error);
        }
      }
    }
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = performance.now();
      this.notifySubscribers('alert:acknowledged', alert);
    }
    return alert;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = performance.now();
      this.notifySubscribers('alert:resolved', alert);
    }
    return alert;
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit = 50) {
    return this.alerts.slice(0, limit);
  }

  /**
   * Get recent reports
   */
  getRecentReports(limit = 10) {
    return this.reports.slice(0, limit);
  }

  /**
   * Establish performance baseline
   */
  async establishBaseline() {
    console.log('📈 Establishing performance baseline...');

    const baselineDuration = 30000; // 30 seconds
    const baselineStart = performance.now();

    // Wait for stable measurements
    await new Promise(resolve => setTimeout(resolve, baselineDuration));

    const baselineMetrics = this.extractCurrentMetrics();

    this.baselines.set('default', {
      timestamp: baselineStart,
      metrics: baselineMetrics,
      duration: baselineDuration
    });

    console.log('✅ Performance baseline established');
    this.notifySubscribers('baseline:established', this.baselines.get('default'));
  }

  // Helper methods
  generateAlertId() {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  generateReportId() {
    return `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  sanitizeMetrics(metrics) {
    // Remove potentially sensitive data and reduce size
    const sanitized = { ...metrics };
    delete sanitized.sensitiveData;
    return sanitized;
  }

  isOnCooldown(ruleId) {
    const cooldown = this.alertRules.get(ruleId)?.cooldown;
    if (!cooldown) return false;

    const lastAlert = this.alerts.find(a => a.ruleId === ruleId);
    if (!lastAlert) return false;

    return (performance.now() - lastAlert.timestamp) < cooldown;
  }

  setCooldown(ruleId, duration) {
    // Cooldown is handled by isOnCooldown method
  }

  calculateTrend(values) {
    if (values.length < 2) return 'stable';

    const recent = values.slice(-3);
    const older = values.slice(-6, -3);

    if (older.length === 0) return 'stable';

    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;

    const change = (recentAvg - olderAvg) / olderAvg;

    if (change > 0.1) return 'improving';
    if (change < -0.1) return 'degrading';
    return 'stable';
  }

  calculateMemoryGrowthRate() {
    const memorySnapshots = browserMonitor.memorySnapshots;
    if (memorySnapshots && memorySnapshots.length > 1) {
      const recent = memorySnapshots.slice(-5);
      const first = recent[0];
      const last = recent[recent.length - 1];
      const timeDelta = (last.timestamp - first.timestamp) / 1000 / 60; // minutes

      if (timeDelta > 0) {
        return ((last.usedJSHeapSize - first.usedJSHeapSize) / 1024 / 1024) / timeDelta; // MB/min
      }
    }
    return 0;
  }

  cleanupOldData() {
    const cutoff = performance.now() - this.options.historyRetention;

    // Cleanup old alerts
    this.alerts = this.alerts.filter(alert => alert.timestamp > cutoff);

    // Cleanup old reports
    this.reports = this.reports.filter(report =>
      new Date(report.timestamp).getTime() > cutoff
    );
  }

  logAlert(alert) {
    console.group(`🚨 ALERT [${alert.severity.toUpperCase()}] ${alert.name}`);
    console.log('Message:', alert.message);
    console.log('Metrics:', alert.metrics);
    console.log('Timestamp:', new Date(alert.timestamp).toISOString());
    console.groupEnd();
  }

  logReport(report) {
    console.group(`📊 PERFORMANCE REPORT [${report.id}]`);
    console.log('Summary:', report.summary);
    console.log('Grade:', report.grade);
    console.log('Alerts:', report.alerts.length);
    console.log('Timestamp:', report.timestamp);
    console.groupEnd();
  }

  prepareInvestigationData(alert) {
    // Collect additional data for investigation
    const investigationData = {
      alert,
      systemInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        memory: navigator.deviceMemory,
        cores: navigator.hardwareConcurrency
      },
      browserMetrics: browserMonitor.getCurrentSnapshot(),
      recentAlerts: this.getRecentAlerts(5)
    };

    this.notifySubscribers('investigation:data', investigationData);
  }

  monitorTrend(alert) {
    // Just monitor for now, trends will be analyzed in periodic reports
    this.notifySubscribers('trend:monitor', { alert, metrics: this.extractCurrentMetrics() });
  }

  analyzeTrend(alert) {
    const history = this.getMetricsHistory();
    const trendAnalysis = this.analyzeTrends(history);

    this.notifySubscribers('trend:analysis', {
      alert,
      trends: trendAnalysis,
      recommendations: this.generateRecommendations(this.extractCurrentMetrics(), history)
    });
  }

  generateRecommendations(metrics, history) {
    const recommendations = [];

    if (metrics.frameRate?.current < 50) {
      recommendations.push({
        priority: 'high',
        category: 'performance',
        title: 'Optimize Frame Rate',
        description: 'Consider reducing canvas complexity or implementing render throttling'
      });
    }

    if (metrics.dataLatency?.current > 100) {
      recommendations.push({
        priority: 'critical',
        category: 'latency',
        title: 'Reduce Data Latency',
        description: 'Optimize WebSocket handling and message processing'
      });
    }

    if (metrics.memory?.growthRate > 5) {
      recommendations.push({
        priority: 'high',
        category: 'memory',
        title: 'Investigate Memory Growth',
        description: 'Check for potential memory leaks in event listeners or canvas contexts'
      });
    }

    return recommendations;
  }
}

// Export singleton instance
export const alertingSystem = new AlertingSystem();

// Export class for testing
export { AlertingSystem };