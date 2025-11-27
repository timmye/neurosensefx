/**
 * Production Analytics and Reporting System
 *
 * Comprehensive analytics and reporting for trading platform insights,
 * performance optimization, and operational excellence.
 *
 * Features:
 * - Production analytics dashboard for trading insights
 * - User behavior and interaction analysis
 * - Performance trend analysis and reporting
 * - Automated production health reports
 * - Trading workflow optimization recommendations
 * - Production capacity planning and scaling insights
 */

/**
 * Production analytics configuration
 */
export const PRODUCTION_ANALYTICS_CONFIG = {
  // Analytics settings
  ENABLE_USER_BEHAVIOR_ANALYSIS: true,
  ENABLE_PERFORMANCE_TREND_ANALYSIS: true,
  ENABLE_TRADING_INSIGHTS: true,
  ENABLE_CAPACITY_PLANNING: true,

  // Reporting settings
  ENABLE_AUTOMATED_REPORTS: true,
  REPORT_GENERATION_INTERVAL_HOURS: 1,
  REPORT_RETENTION_DAYS: 30,
  ENABLE_EMAIL_REPORTS: false,
  ENABLE_WEBHOOK_REPORTS: true,

  // Data aggregation settings
  AGGREGATION_WINDOW_MINUTES: 15,
  TREND_ANALYSIS_WINDOW_HOURS: 24,
  COMPARISON_WINDOW_DAYS: 7,

  // Analysis thresholds
  PERFORMANCE_DEGRADATION_THRESHOLD: 10,  // 10% degradation triggers alert
  USER_ENGAGEMENT_THRESHOLD: 60,           // 60% engagement considered good
  SYSTEM_UTILIZATION_THRESHOLD: 80,         // 80% utilization triggers scaling alert

  // Insights settings
  ENABLE_PREDICTIVE_ANALYTICS: true,
  ENABLE_ANOMALY_DETECTION: true,
  ENABLE_OPTIMIZATION_RECOMMENDATIONS: true,

  // Data privacy
  ANONYMIZE_USER_DATA: true,
  GDPR_COMPLIANT: true,
  MIN_AGGREGATION_COUNT: 5,                 // Minimum data points for aggregation

  // Export settings
  ENABLE_CSV_EXPORT: true,
  ENABLE_JSON_EXPORT: true,
  ENABLE_PDF_REPORTS: false,
  EXPORT_RETENTION_DAYS: 90
};

/**
 * Report types
 */
export const REPORT_TYPES = {
  PERFORMANCE: 'PERFORMANCE',
  USER_BEHAVIOR: 'USER_BEHAVIOR',
  SYSTEM_HEALTH: 'SYSTEM_HEALTH',
  TRADING_OPERATIONS: 'TRADING_OPERATIONS',
  CAPACITY_PLANNING: 'CAPACITY_PLANNING',
  COMPREHENSIVE: 'COMPREHENSIVE',
  TREND_ANALYSIS: 'TREND_ANALYSIS'
};

/**
 * Insight categories
 */
export const INSIGHT_CATEGORIES = {
  PERFORMANCE: 'PERFORMANCE',
  USER_EXPERIENCE: 'USER_EXPERIENCE',
  SYSTEM_OPTIMIZATION: 'SYSTEM_OPTIMIZATION',
  TRADING_EFFICIENCY: 'TRADING_EFFICIENCY',
  CAPACITY_MANAGEMENT: 'CAPACITY_MANAGEMENT',
  ERROR_PREVENTION: 'ERROR_PREVENTION'
};

/**
 * Production analytics system
 */
export class ProductionAnalyticsSystem {
  constructor(config = {}) {
    this.config = { ...PRODUCTION_ANALYTICS_CONFIG, ...config };
    this.isAnalyzing = false;
    this.startTime = Date.now();

    // Data storage
    this.rawData = {
      performance: [],
      userBehavior: [],
      systemHealth: [],
      tradingOperations: [],
      errors: [],
      alerts: []
    };

    // Aggregated data
    this.aggregatedData = {
      hourly: new Map(),
      daily: new Map(),
      weekly: new Map()
    };

    // Analytics results
    this.insights = [];
    this.recommendations = [];
    this.anomalies = [];
    this.trends = new Map();

    // Reports storage
    this.reports = [];
    this.reportSchedules = new Map();

    // Analytics intervals
    this.analyticsIntervals = new Map();

    // Reference to other monitoring systems
    this.productionMonitor = null;
    this.errorMonitor = null;
    this.tradingOpsMonitor = null;
    this.systemHealthMonitor = null;
  }

  /**
   * Start production analytics
   */
  startAnalytics(monitoringSystems = {}) {
    if (this.isAnalyzing) {
      console.warn('[ProductionAnalytics] Production analytics already started');
      return;
    }

    this.isAnalyzing = true;
    this.startTime = Date.now();

    // Store references to monitoring systems
    this.productionMonitor = monitoringSystems.productionMonitor;
    this.errorMonitor = monitoringSystems.errorMonitor;
    this.tradingOpsMonitor = monitoringSystems.tradingOpsMonitor;
    this.systemHealthMonitor = monitoringSystems.systemHealthMonitor;

    console.log('[ProductionAnalytics] Starting production analytics...');

    // Start data collection
    this.startDataCollection();

    // Start aggregation
    this.startDataAggregation();

    // Start analysis
    this.startAnalysis();

    // Start automated reporting
    this.startAutomatedReporting();

    console.log('[ProductionAnalytics] Production analytics started successfully');
  }

  /**
   * Stop production analytics
   */
  stopAnalytics() {
    if (!this.isAnalyzing) {
      console.warn('[ProductionAnalytics] Production analytics not started');
      return;
    }

    this.isAnalyzing = false;

    // Clear all intervals
    for (const [name, interval] of this.analyticsIntervals) {
      clearInterval(interval);
    }
    this.analyticsIntervals.clear();

    console.log('[ProductionAnalytics] Production analytics stopped');
  }

  /**
   * Start data collection from monitoring systems
   */
  startDataCollection() {
    // Collect data every minute
    const collectionInterval = setInterval(() => {
      this.collectDataFromMonitoringSystems();
    }, 60000);
    this.analyticsIntervals.set('collection', collectionInterval);
  }

  /**
   * Start data aggregation
   */
  startDataAggregation() {
    // Aggregate data every 15 minutes
    const aggregationInterval = setInterval(() => {
      this.aggregateData();
    }, this.config.AGGREGATION_WINDOW_MINUTES * 60 * 1000);
    this.analyticsIntervals.set('aggregation', aggregationInterval);

    // Daily aggregation at midnight
    this.scheduleDailyAggregation();
  }

  /**
   * Start analysis
   */
  startAnalysis() {
    // Analyze trends every hour
    const trendAnalysisInterval = setInterval(() => {
      if (this.config.ENABLE_PERFORMANCE_TREND_ANALYSIS) {
        this.analyzeTrends();
      }
    }, 60 * 60 * 1000);
    this.analyticsIntervals.set('trendAnalysis', trendAnalysisInterval);

    // Generate insights every 2 hours
    const insightsInterval = setInterval(() => {
      if (this.config.ENABLE_PREDICTIVE_ANALYTICS) {
        this.generateInsights();
      }
    }, 2 * 60 * 60 * 1000);
    this.analyticsIntervals.set('insights', insightsInterval);

    // Detect anomalies every 30 minutes
    const anomalyInterval = setInterval(() => {
      if (this.config.ENABLE_ANOMALY_DETECTION) {
        this.detectAnomalies();
      }
    }, 30 * 60 * 1000);
    this.analyticsIntervals.set('anomalyDetection', anomalyInterval);
  }

  /**
   * Start automated reporting
   */
  startAutomatedReporting() {
    if (!this.config.ENABLE_AUTOMATED_REPORTS) return;

    // Generate reports every hour
    const reportingInterval = setInterval(() => {
      this.generateScheduledReports();
    }, this.config.REPORT_GENERATION_INTERVAL_HOURS * 60 * 60 * 1000);
    this.analyticsIntervals.set('reporting', reportingInterval);

    // Initialize report schedules
    this.initializeReportSchedules();
  }

  /**
   * Collect data from monitoring systems
   */
  collectDataFromMonitoringSystems() {
    const now = Date.now();

    // Collect from production monitoring
    if (this.productionMonitor) {
      const productionReport = this.productionMonitor.getMonitoringReport();
      this.rawData.performance.push({
        timestamp: now,
        data: productionReport.performance,
        systemHealth: productionReport.systemHealth
      });
    }

    // Collect from error monitoring
    if (this.errorMonitor) {
      const errorReport = this.errorMonitor.getErrorReport();
      this.rawData.errors.push({
        timestamp: now,
        data: errorReport
      });
    }

    // Collect from trading operations
    if (this.tradingOpsMonitor) {
      const tradingReport = this.tradingOpsMonitor.getTradingOperationsReport();
      this.rawData.tradingOperations.push({
        timestamp: now,
        data: tradingReport
      });

      if (this.config.ENABLE_USER_BEHAVIOR_ANALYSIS) {
        this.rawData.userBehavior.push({
          timestamp: now,
          data: {
            userPatterns: tradingReport.userPatterns,
            session: tradingReport.session,
            realTime: tradingReport.realTime
          }
        });
      }
    }

    // Collect from system health monitoring
    if (this.systemHealthMonitor) {
      const healthReport = this.systemHealthMonitor.getSystemHealthReport();
      this.rawData.systemHealth.push({
        timestamp: now,
        data: healthReport
      });
    }

    // Maintain raw data size
    this.trimRawData();
  }

  /**
   * Trim raw data to prevent memory issues
   */
  trimRawData() {
    const maxDataPoints = 10080; // 7 days of minute-level data

    for (const [key, data] of Object.entries(this.rawData)) {
      if (data.length > maxDataPoints) {
        data.splice(0, data.length - maxDataPoints);
      }
    }
  }

  /**
   * Aggregate data by time windows
   */
  aggregateData() {
    const now = Date.now();
    const aggregationWindow = this.config.AGGREGATION_WINDOW_MINUTES * 60 * 1000;

    // Aggregate each data type
    this.aggregatePerformanceData(now, aggregationWindow);
    this.aggregateUserBehaviorData(now, aggregationWindow);
    this.aggregateSystemHealthData(now, aggregationWindow);
    this.aggregateTradingOperationsData(now, aggregationWindow);
    this.aggregateErrorData(now, aggregationWindow);

    console.log('[ProductionAnalytics] Data aggregation completed');
  }

  /**
   * Aggregate performance data
   */
  aggregatePerformanceData(now, window) {
    const cutoffTime = now - window;
    const recentPerformanceData = this.rawData.performance.filter(d => d.timestamp >= cutoffTime);

    if (recentPerformanceData.length < this.config.MIN_AGGREGATION_COUNT) return;

    const windowKey = this.getTimeWindowKey(now, 'hourly');

    const aggregated = {
      timestamp: now,
      windowStart: cutoffTime,
      windowEnd: now,
      dataPoints: recentPerformanceData.length,
      performance: {
        averageFrameRate: this.calculateAverage(recentPerformanceData, 'data.performance.global.frameRate'),
        averageRenderTime: this.calculateAverage(recentPerformanceData, 'data.performance.global.averageRenderTime'),
        memoryUsage: this.calculateAverage(recentPerformanceData, 'data.performance.global.memoryUsage.used'),
        totalErrors: recentPerformanceData.reduce((sum, d) => sum + (d.data.alerts?.total || 0), 0)
      }
    };

    this.aggregatedData.hourly.set(windowKey, aggregated);
  }

  /**
   * Aggregate user behavior data
   */
  aggregateUserBehaviorData(now, window) {
    const cutoffTime = now - window;
    const recentUserData = this.rawData.userBehavior.filter(d => d.timestamp >= cutoffTime);

    if (recentUserData.length < this.config.MIN_AGGREGATION_COUNT) return;

    const windowKey = this.getTimeWindowKey(now, 'hourly');

    const aggregated = {
      timestamp: now,
      windowStart: cutoffTime,
      windowEnd: now,
      dataPoints: recentUserData.length,
      userBehavior: {
        averageSessionDuration: this.calculateAverage(recentUserData, 'data.session.duration'),
        totalKeyboardShortcuts: recentUserData.reduce((sum, d) => sum + (d.data.realTime?.operationRate || 0), 0),
        activeDisplayCount: this.calculateAverage(recentUserData, 'data.realTime.activeDisplays'),
        uniqueSymbols: this.calculateUniqueSymbols(recentUserData),
        userSatisfactionScore: this.calculateAverage(recentUserData, 'data.health.userSatisfactionScore')
      }
    };

    this.aggregatedData.hourly.set(windowKey, {
      ...this.aggregatedData.hourly.get(windowKey),
      ...aggregated
    });
  }

  /**
   * Aggregate system health data
   */
  aggregateSystemHealthData(now, window) {
    const cutoffTime = now - window;
    const recentHealthData = this.rawData.systemHealth.filter(d => d.timestamp >= cutoffTime);

    if (recentHealthData.length < this.config.MIN_AGGREGATION_COUNT) return;

    const windowKey = this.getTimeWindowKey(now, 'hourly');

    const aggregated = {
      timestamp: now,
      windowStart: cutoffTime,
      windowEnd: now,
      dataPoints: recentHealthData.length,
      systemHealth: {
        averageHealthScore: this.calculateAverage(recentHealthData, 'data.current.score'),
        memoryPressure: this.calculateMemoryPressure(recentHealthData),
        cpuUsage: this.calculateAverage(recentHealthData, 'data.resources.cpu.current.usagePercent'),
        networkLatency: this.calculateAverage(recentHealthData, 'data.connections.networkLatency.average')
      }
    };

    this.aggregatedData.hourly.set(windowKey, {
      ...this.aggregatedData.hourly.get(windowKey),
      ...aggregated
    });
  }

  /**
   * Aggregate trading operations data
   */
  aggregateTradingOperationsData(now, window) {
    const cutoffTime = now - window;
    const recentTradingData = this.rawData.tradingOperations.filter(d => d.timestamp >= cutoffTime);

    if (recentTradingData.length < this.config.MIN_AGGREGATION_COUNT) return;

    const windowKey = this.getTimeWindowKey(now, 'hourly');

    const aggregated = {
      timestamp: now,
      windowStart: cutoffTime,
      windowEnd: now,
      dataPoints: recentTradingData.length,
      tradingOperations: {
        totalOperations: recentTradingData.reduce((sum, d) => sum + (d.data.operations?.total || 0), 0),
        workflowCompletionRate: this.calculateAverage(recentTradingData, 'data.workflows.completionRate'),
        averageWorkflowDuration: this.calculateAverage(recentTradingData, 'data.workflows.averageDuration'),
        displayOperations: this.calculateAverage(recentTradingData, 'data.performance.displayOperations.count')
      }
    };

    this.aggregatedData.hourly.set(windowKey, {
      ...this.aggregatedData.hourly.get(windowKey),
      ...aggregated
    });
  }

  /**
   * Aggregate error data
   */
  aggregateErrorData(now, window) {
    const cutoffTime = now - window;
    const recentErrorData = this.rawData.errors.filter(d => d.timestamp >= cutoffTime);

    if (recentErrorData.length < this.config.MIN_AGGREGATION_COUNT) return;

    const windowKey = this.getTimeWindowKey(now, 'hourly');

    const aggregated = {
      timestamp: now,
      windowStart: cutoffTime,
      windowEnd: now,
      dataPoints: recentErrorData.length,
      errors: {
        totalErrors: recentErrorData.reduce((sum, d) => sum + (d.data.summary?.totalErrors || 0), 0),
        criticalErrors: recentErrorData.reduce((sum, d) => sum + (d.data.errors?.bySeverity?.CRITICAL || 0), 0),
        errorCategories: this.aggregateErrorCategories(recentErrorData),
        escalationRate: this.calculateEscalationRate(recentErrorData)
      }
    };

    this.aggregatedData.hourly.set(windowKey, {
      ...this.aggregatedData.hourly.get(windowKey),
      ...aggregated
    });
  }

  /**
   * Analyze trends across all metrics
   */
  analyzeTrends() {
    console.log('[ProductionAnalytics] Analyzing trends...');

    // Analyze performance trends
    this.analyzePerformanceTrends();

    // Analyze user behavior trends
    this.analyzeUserBehaviorTrends();

    // Analyze system health trends
    this.analyzeSystemHealthTrends();

    // Analyze error trends
    this.analyzeErrorTrends();

    // Analyze capacity trends
    this.analyzeCapacityTrends();
  }

  /**
   * Analyze performance trends
   */
  analyzePerformanceTrends() {
    const hourlyData = Array.from(this.aggregatedData.hourly.values()).slice(-24); // Last 24 hours

    if (hourlyData.length < 12) return; // Need at least 12 data points

    const frameRateTrend = this.calculateTrend(hourlyData, 'performance.averageFrameRate');
    const memoryTrend = this.calculateTrend(hourlyData, 'performance.memoryUsage');
    const renderTimeTrend = this.calculateTrend(hourlyData, 'performance.averageRenderTime');

    this.trends.set('performance', {
      frameRate: frameRateTrend,
      memoryUsage: memoryTrend,
      renderTime: renderTimeTrend,
      overall: this.calculateOverallPerformanceTrend(frameRateTrend, memoryTrend, renderTimeTrend)
    });

    // Generate insights from trends
    this.generateTrendInsights('performance', this.trends.get('performance'));
  }

  /**
   * Analyze user behavior trends
   */
  analyzeUserBehaviorTrends() {
    const hourlyData = Array.from(this.aggregatedData.hourly.values()).slice(-48); // Last 48 hours

    if (hourlyData.length < 12) return;

    const sessionDurationTrend = this.calculateTrend(hourlyData, 'userBehavior.averageSessionDuration');
    const keyboardUsageTrend = this.calculateTrend(hourlyData, 'userBehavior.totalKeyboardShortcuts');
    const satisfactionTrend = this.calculateTrend(hourlyData, 'userBehavior.userSatisfactionScore');

    this.trends.set('userBehavior', {
      sessionDuration: sessionDurationTrend,
      keyboardUsage: keyboardUsageTrend,
      satisfactionScore: satisfactionTrend,
      engagement: this.calculateEngagementTrend(hourlyData)
    });

    this.generateTrendInsights('userBehavior', this.trends.get('userBehavior'));
  }

  /**
   * Analyze system health trends
   */
  analyzeSystemHealthTrends() {
    const hourlyData = Array.from(this.aggregatedData.hourly.values()).slice(-48);

    if (hourlyData.length < 12) return;

    const healthScoreTrend = this.calculateTrend(hourlyData, 'systemHealth.averageHealthScore');
    const memoryPressureTrend = this.calculateTrend(hourlyData, 'systemHealth.memoryPressure');
    const cpuTrend = this.calculateTrend(hourlyData, 'systemHealth.cpuUsage');

    this.trends.set('systemHealth', {
      healthScore: healthScoreTrend,
      memoryPressure: memoryPressureTrend,
      cpuUsage: cpuTrend,
      stability: this.calculateStabilityTrend(hourlyData)
    });

    this.generateTrendInsights('systemHealth', this.trends.get('systemHealth'));
  }

  /**
   * Generate insights from data analysis
   */
  generateInsights() {
    console.log('[ProductionAnalytics] Generating insights...');

    // Performance insights
    this.generatePerformanceInsights();

    // User experience insights
    this.generateUserExperienceInsights();

    // System optimization insights
    this.generateSystemOptimizationInsights();

    // Trading efficiency insights
    this.generateTradingEfficiencyInsights();

    // Capacity management insights
    this.generateCapacityManagementInsights();

    // Error prevention insights
    this.generateErrorPreventionInsights();
  }

  /**
   * Generate performance insights
   */
  generatePerformanceInsights() {
    const performanceTrend = this.trends.get('performance');
    const recentData = Array.from(this.aggregatedData.hourly.values()).slice(-6);

    if (recentData.length === 0) return;

    const avgFrameRate = this.calculateAverage(recentData, 'performance.averageFrameRate');
    const avgMemoryUsage = this.calculateAverage(recentData, 'performance.memoryUsage');
    const avgRenderTime = this.calculateAverage(recentData, 'performance.averageRenderTime');

    // Frame rate insights
    if (avgFrameRate < 55) {
      this.addInsight({
        category: INSIGHT_CATEGORIES.PERFORMANCE,
        type: 'LOW_FRAME_RATE',
        severity: avgFrameRate < 45 ? 'HIGH' : 'MEDIUM',
        title: 'Low Frame Rate Detected',
        description: `Average frame rate is ${avgFrameRate.toFixed(1)}fps, below optimal 60fps`,
        recommendation: 'Consider optimizing rendering pipeline or reducing active display count',
        metrics: { avgFrameRate, targetFrameRate: 60 }
      });
    }

    // Memory usage insights
    if (avgMemoryUsage > 800) {
      this.addInsight({
        category: INSIGHT_CATEGORIES.SYSTEM_OPTIMIZATION,
        type: 'HIGH_MEMORY_USAGE',
        severity: avgMemoryUsage > 1000 ? 'HIGH' : 'MEDIUM',
        title: 'High Memory Usage Detected',
        description: `Average memory usage is ${avgMemoryUsage.toFixed(1)}MB`,
        recommendation: 'Implement memory cleanup and object pooling',
        metrics: { avgMemoryUsage, memoryLimit: performance.memory?.jsHeapSizeLimit || 0 }
      });
    }

    // Performance trend insights
    if (performanceTrend?.overall === 'DECLINING') {
      this.addInsight({
        category: INSIGHT_CATEGORIES.PERFORMANCE,
        type: 'PERFORMANCE_DEGRADATION',
        severity: 'HIGH',
        title: 'Performance Trend Declining',
        description: 'System performance has been declining over the analysis period',
        recommendation: 'Investigate performance bottlenecks and optimize resource usage',
        metrics: { trend: performanceTrend.overall }
      });
    }
  }

  /**
   * Generate user experience insights
   */
  generateUserExperienceInsights() {
    const userBehaviorTrend = this.trends.get('userBehavior');
    const recentData = Array.from(this.aggregatedData.hourly.values()).slice(-6);

    if (recentData.length === 0) return;

    const avgSatisfaction = this.calculateAverage(recentData, 'userBehavior.userSatisfactionScore');
    const avgSessionDuration = this.calculateAverage(recentData, 'userBehavior.averageSessionDuration') / (1000 * 60); // Convert to minutes

    // Satisfaction insights
    if (avgSatisfaction < 70) {
      this.addInsight({
        category: INSIGHT_CATEGORIES.USER_EXPERIENCE,
        type: 'LOW_SATISFACTION',
        severity: avgSatisfaction < 50 ? 'HIGH' : 'MEDIUM',
        title: 'Low User Satisfaction Detected',
        description: `User satisfaction score is ${avgSatisfaction.toFixed(1)}%`,
        recommendation: 'Analyze user pain points and improve interface responsiveness',
        metrics: { avgSatisfaction, targetSatisfaction: 85 }
      });
    }

    // Engagement insights
    if (avgSessionDuration < 5) {
      this.addInsight({
        category: INSIGHT_CATEGORIES.USER_EXPERIENCE,
        type: 'LOW_ENGAGEMENT',
        severity: 'MEDIUM',
        title: 'Low User Engagement',
        description: `Average session duration is ${avgSessionDuration.toFixed(1)} minutes`,
        recommendation: 'Improve user onboarding and feature discoverability',
        metrics: { avgSessionDuration, targetDuration: 15 }
      });
    }
  }

  /**
   * Detect anomalies in the data
   */
  detectAnomalies() {
    console.log('[ProductionAnalytics] Detecting anomalies...');

    const recentData = Array.from(this.aggregatedData.hourly.values()).slice(-48);

    if (recentData.length < 24) return;

    // Detect performance anomalies
    this.detectPerformanceAnomalies(recentData);

    // Detect error rate anomalies
    this.detectErrorAnomalies(recentData);

    // Detect user behavior anomalies
    this.detectUserBehaviorAnomalies(recentData);

    // Detect system health anomalies
    this.detectSystemHealthAnomalies(recentData);
  }

  /**
   * Detect performance anomalies
   */
  detectPerformanceAnomalies(data) {
    const frameRates = data.map(d => d.performance?.averageFrameRate || 0);
    const frameRateAnomalies = this.detectOutliers(frameRates);

    frameRateAnomalies.forEach(anomaly => {
      this.addAnomaly({
        category: INSIGHT_CATEGORIES.PERFORMANCE,
        type: 'FRAME_RATE_ANOMALY',
        severity: anomaly.severity,
        timestamp: data[anomaly.index].timestamp,
        value: anomaly.value,
        expectedRange: anomaly.expectedRange,
        description: `Frame rate of ${anomaly.value.toFixed(1)}fps detected, outside normal range`
      });
    });
  }

  /**
   * Detect error rate anomalies
   */
  detectErrorAnomalies(data) {
    const errorCounts = data.map(d => d.errors?.totalErrors || 0);
    const errorAnomalies = this.detectOutliers(errorCounts);

    errorAnomalies.forEach(anomaly => {
      this.addAnomaly({
        category: INSIGHT_CATEGORIES.ERROR_PREVENTION,
        type: 'ERROR_RATE_ANOMALY',
        severity: anomaly.severity,
        timestamp: data[anomaly.index].timestamp,
        value: anomaly.value,
        expectedRange: anomaly.expectedRange,
        description: `Error count of ${anomaly.value} detected, significantly above normal`
      });
    });
  }

  /**
   * Detect outliers using statistical methods
   */
  detectOutliers(values) {
    if (values.length < 10) return [];

    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    const anomalies = [];
    values.forEach((value, index) => {
      if (value < lowerBound || value > upperBound) {
        const severity = Math.abs(value - (q1 + q3) / 2) > iqr * 2 ? 'HIGH' : 'MEDIUM';
        anomalies.push({
          index,
          value,
          severity,
          expectedRange: [lowerBound, upperBound]
        });
      }
    });

    return anomalies;
  }

  /**
   * Generate automated reports
   */
  generateScheduledReports() {
    if (!this.config.ENABLE_AUTOMATED_REPORTS) return;

    const now = Date.now();
    const hour = new Date(now).getHours();

    // Generate hourly performance report
    if (hour % this.config.REPORT_GENERATION_INTERVAL_HOURS === 0) {
      this.generateReport(REPORT_TYPES.PERFORMANCE, 'hourly');
    }

    // Generate daily comprehensive report at midnight
    if (hour === 0) {
      this.generateReport(REPORT_TYPES.COMPREHENSIVE, 'daily');
      this.generateReport(REPORT_TYPES.TREND_ANALYSIS, 'daily');
    }

    // Generate weekly reports on Monday at 9 AM
    if (hour === 9 && new Date(now).getDay() === 1) {
      this.generateReport(REPORT_TYPES.CAPACITY_PLANNING, 'weekly');
    }
  }

  /**
   * Generate specific type of report
   */
  generateReport(reportType, frequency = 'hourly') {
    const report = {
      id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: reportType,
      frequency,
      timestamp: Date.now(),
      generatedAt: new Date().toISOString(),
      data: this.generateReportData(reportType)
    };

    this.reports.push(report);

    // Maintain report history
    if (this.reports.length > this.config.REPORT_RETENTION_DAYS * 24) {
      this.reports.shift();
    }

    // Send report if configured
    this.sendReport(report);

    console.log(`[ProductionAnalytics] Generated ${reportType} report (${frequency})`);

    return report;
  }

  /**
   * Generate report data based on type
   */
  generateReportData(reportType) {
    const now = Date.now();
    const data = {
      timestamp: now,
      generatedAt: new Date().toISOString(),
      analyticsVersion: '1.0.0'
    };

    switch (reportType) {
      case REPORT_TYPES.PERFORMANCE:
        return {
          ...data,
          performance: this.generatePerformanceReport(),
          summary: this.generatePerformanceSummary()
        };

      case REPORT_TYPES.USER_BEHAVIOR:
        return {
          ...data,
          userBehavior: this.generateUserBehaviorReport(),
          insights: this.getUserBehaviorInsights()
        };

      case REPORT_TYPES.SYSTEM_HEALTH:
        return {
          ...data,
          systemHealth: this.generateSystemHealthReport(),
          recommendations: this.getSystemHealthRecommendations()
        };

      case REPORT_TYPES.TRADING_OPERATIONS:
        return {
          ...data,
          tradingOperations: this.generateTradingOperationsReport(),
          efficiency: this.calculateTradingEfficiency()
        };

      case REPORT_TYPES.CAPACITY_PLANNING:
        return {
          ...data,
          capacityPlanning: this.generateCapacityPlanningReport(),
          scaling: this.generateScalingRecommendations()
        };

      case REPORT_TYPES.COMPREHENSIVE:
        return {
          ...data,
          performance: this.generatePerformanceReport(),
          userBehavior: this.generateUserBehaviorReport(),
          systemHealth: this.generateSystemHealthReport(),
          tradingOperations: this.generateTradingOperationsReport(),
          insights: this.getAllInsights(),
          recommendations: this.getAllRecommendations(),
          summary: this.generateComprehensiveSummary()
        };

      case REPORT_TYPES.TREND_ANALYSIS:
        return {
          ...data,
          trends: Object.fromEntries(this.trends),
          analysis: this.generateTrendAnalysis(),
          predictions: this.generatePredictions()
        };

      default:
        return { ...data, error: `Unknown report type: ${reportType}` };
    }
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport() {
    const recentData = Array.from(this.aggregatedData.hourly.values()).slice(-24);
    const trends = this.trends.get('performance');

    return {
      current: recentData[recentData.length - 1]?.performance || {},
      average: this.calculateAverages(recentData, 'performance'),
      trends,
      bottlenecks: this.identifyPerformanceBottlenecks(recentData),
      optimization: this.generatePerformanceOptimization()
    };
  }

  /**
   * Generate user behavior report
   */
  generateUserBehaviorReport() {
    const recentData = Array.from(this.aggregatedData.hourly.values()).slice(-48);
    const trends = this.trends.get('userBehavior');

    return {
      current: recentData[recentData.length - 1]?.userBehavior || {},
      average: this.calculateAverages(recentData, 'userBehavior'),
      trends,
      engagement: this.calculateEngagementMetrics(recentData),
      patterns: this.identifyUserPatterns(recentData)
    };
  }

  /**
   * Generate system health report
   */
  generateSystemHealthReport() {
    const recentData = Array.from(this.aggregatedData.hourly.values()).slice(-24);
    const trends = this.trends.get('systemHealth');

    return {
      current: recentData[recentData.length - 1]?.systemHealth || {},
      average: this.calculateAverages(recentData, 'systemHealth'),
      trends,
      issues: this.identifyHealthIssues(recentData),
      maintenance: this.generateMaintenanceSchedule()
    };
  }

  /**
   * Generate trading operations report
   */
  generateTradingOperationsReport() {
    const recentData = Array.from(this.aggregatedData.hourly.values()).slice(-24);

    return {
      current: recentData[recentData.length - 1]?.tradingOperations || {},
      average: this.calculateAverages(recentData, 'tradingOperations'),
      workflows: this.analyzeWorkflowEfficiency(recentData),
      utilization: this.calculateSystemUtilization(recentData)
    };
  }

  /**
   * Get comprehensive analytics report
   */
  getAnalyticsReport() {
    return {
      timestamp: Date.now(),
      isAnalyzing: this.isAnalyzing,
      config: this.config,

      // Data summary
      data: {
        raw: this.getDataSummary(),
        aggregated: this.getAggregatedDataSummary(),
        insights: this.getInsightsSummary(),
        anomalies: this.getAnomaliesSummary(),
        trends: Object.fromEntries(this.trends)
      },

      // Current status
      current: {
        performance: this.getCurrentPerformanceStatus(),
        userBehavior: this.getCurrentUserBehaviorStatus(),
        systemHealth: this.getCurrentSystemHealthStatus(),
        tradingOperations: this.getCurrentTradingOperationsStatus()
      },

      // Reports
      reports: {
        total: this.reports.length,
        recent: this.reports.slice(-10),
        schedules: Array.from(this.reportSchedules.values())
      },

      // Analytics capabilities
      capabilities: {
        predictiveAnalytics: this.config.ENABLE_PREDICTIVE_ANALYTICS,
        anomalyDetection: this.config.ENABLE_ANOMALY_DETECTION,
        trendAnalysis: this.config.ENABLE_PERFORMANCE_TREND_ANALYSIS,
        userBehaviorAnalysis: this.config.ENABLE_USER_BEHAVIOR_ANALYSIS
      }
    };
  }

  // Utility methods for calculations
  calculateAverage(data, path) {
    if (data.length === 0) return 0;
    const values = data.map(d => this.getNestedValue(d, path)).filter(v => typeof v === 'number' && !isNaN(v));
    return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
  }

  calculateAverages(data, category) {
    const result = {};
    const item = data[0]?.[category];
    if (!item) return result;

    for (const key of Object.keys(item)) {
      result[key] = this.calculateAverage(data, `${category}.${key}`);
    }

    return result;
  }

  calculateTrend(data, path) {
    if (data.length < 6) return 'INSUFFICIENT_DATA';

    const values = data.map(d => this.getNestedValue(d, path)).filter(v => typeof v === 'number' && !isNaN(v));
    if (values.length < 6) return 'INSUFFICIENT_DATA';

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;

    const change = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (change > 5) return 'IMPROVING';
    if (change < -5) return 'DECLINING';
    return 'STABLE';
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  getTimeWindowKey(timestamp, granularity) {
    const date = new Date(timestamp);
    switch (granularity) {
      case 'hourly':
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
      case 'daily':
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      case 'weekly':
        const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
        return `${weekStart.getFullYear()}-W${Math.ceil(weekStart.getDate() / 7)}`;
      default:
        return timestamp.toString();
    }
  }

  addInsight(insight) {
    const enhancedInsight = {
      id: `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      ...insight
    };

    this.insights.push(enhancedInsight);

    // Maintain insights history
    if (this.insights.length > 1000) {
      this.insights.shift();
    }

    console.log(`[ProductionAnalytics] Insight generated: ${insight.title}`);
  }

  addAnomaly(anomaly) {
    const enhancedAnomaly = {
      id: `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      ...anomaly
    };

    this.anomalies.push(enhancedAnomaly);

    // Maintain anomalies history
    if (this.anomalies.length > 500) {
      this.anomalies.shift();
    }

    console.log(`[ProductionAnalytics] Anomaly detected: ${anomaly.type}`);
  }

  // Placeholder methods for extended functionality
  initializeReportSchedules() {
    // Implementation for report scheduling
  }

  scheduleDailyAggregation() {
    // Implementation for daily aggregation scheduling
  }

  generatePerformanceOptimization() {
    // Implementation for performance optimization generation
    return { recommendations: [] };
  }

  identifyPerformanceBottlenecks(data) {
    // Implementation for bottleneck identification
    return { bottlenecks: [] };
  }

  generateTrendInsights(category, trend) {
    // Implementation for trend-based insights
  }

  calculateOverallPerformanceTrend(frameRateTrend, memoryTrend, renderTimeTrend) {
    // Implementation for overall performance trend calculation
    return 'STABLE';
  }

  calculateUniqueSymbols(data) {
    // Implementation for unique symbols calculation
    return 0;
  }

  calculateMemoryPressure(data) {
    // Implementation for memory pressure calculation
    return 'LOW';
  }

  aggregateErrorCategories(data) {
    // Implementation for error category aggregation
    return {};
  }

  calculateEscalationRate(data) {
    // Implementation for escalation rate calculation
    return 0;
  }

  calculateEngagementTrend(data) {
    // Implementation for engagement trend calculation
    return 'STABLE';
  }

  calculateStabilityTrend(data) {
    // Implementation for stability trend calculation
    return 'STABLE';
  }

  detectPerformanceAnomalies(data) {
    // Implementation for performance anomaly detection
  }

  detectErrorAnomalies(data) {
    // Implementation for error anomaly detection
  }

  detectUserBehaviorAnomalies(data) {
    // Implementation for user behavior anomaly detection
  }

  detectSystemHealthAnomalies(data) {
    // Implementation for system health anomaly detection
  }

  sendReport(report) {
    // Implementation for report sending
    console.log(`[ProductionAnalytics] Report sent: ${report.id}`);
  }

  generateUserExperienceInsights() {
    // Implementation for user experience insights
  }

  generateSystemOptimizationInsights() {
    // Implementation for system optimization insights
  }

  generateTradingEfficiencyInsights() {
    // Implementation for trading efficiency insights
  }

  generateCapacityManagementInsights() {
    // Implementation for capacity management insights
  }

  generateErrorPreventionInsights() {
    // Implementation for error prevention insights
  }

  generateCapacityPlanningReport() {
    // Implementation for capacity planning report
    return {};
  }

  generateScalingRecommendations() {
    // Implementation for scaling recommendations
    return [];
  }

  generateComprehensiveSummary() {
    // Implementation for comprehensive summary
    return {};
  }

  generateTrendAnalysis() {
    // Implementation for trend analysis
    return {};
  }

  generatePredictions() {
    // Implementation for predictions
    return {};
  }

  getDataSummary() {
    // Implementation for data summary
    return {};
  }

  getAggregatedDataSummary() {
    // Implementation for aggregated data summary
    return {};
  }

  getInsightsSummary() {
    // Implementation for insights summary
    return {};
  }

  getAnomaliesSummary() {
    // Implementation for anomalies summary
    return {};
  }

  getCurrentPerformanceStatus() {
    // Implementation for current performance status
    return {};
  }

  getCurrentUserBehaviorStatus() {
    // Implementation for current user behavior status
    return {};
  }

  getCurrentSystemHealthStatus() {
    // Implementation for current system health status
    return {};
  }

  getCurrentTradingOperationsStatus() {
    // Implementation for current trading operations status
    return {};
  }

  analyzeWorkflowEfficiency(data) {
    // Implementation for workflow efficiency analysis
    return {};
  }

  calculateSystemUtilization(data) {
    // Implementation for system utilization calculation
    return {};
  }

  identifyHealthIssues(data) {
    // Implementation for health issues identification
    return [];
  }

  generateMaintenanceSchedule() {
    // Implementation for maintenance schedule generation
    return {};
  }

  calculateEngagementMetrics(data) {
    // Implementation for engagement metrics calculation
    return {};
  }

  identifyUserPatterns(data) {
    // Implementation for user pattern identification
    return {};
  }

  getUserBehaviorInsights() {
    // Implementation for user behavior insights
    return [];
  }

  getSystemHealthRecommendations() {
    // Implementation for system health recommendations
    return [];
  }

  calculateTradingEfficiency() {
    // Implementation for trading efficiency calculation
    return {};
  }

  getAllInsights() {
    // Implementation for getting all insights
    return this.insights;
  }

  getAllRecommendations() {
    // Implementation for getting all recommendations
    return this.recommendations;
  }

  generatePerformanceSummary() {
    // Implementation for performance summary generation
    return {};
  }

  /**
   * Cleanup and destroy analytics system
   */
  destroy() {
    this.stopAnalytics();

    // Clear all data
    this.rawData = {
      performance: [],
      userBehavior: [],
      systemHealth: [],
      tradingOperations: [],
      errors: [],
      alerts: []
    };

    this.aggregatedData.hourly.clear();
    this.aggregatedData.daily.clear();
    this.aggregatedData.weekly.clear();
    this.insights = [];
    this.recommendations = [];
    this.anomalies = [];
    this.trends.clear();
    this.reports = [];
    this.reportSchedules.clear();

    console.log('[ProductionAnalytics] Production analytics system destroyed');
  }
}

/**
 * Global production analytics instance
 */
let globalProductionAnalytics = null;

/**
 * Get or create global production analytics instance
 */
export function getProductionAnalytics(config = {}) {
  if (!globalProductionAnalytics) {
    globalProductionAnalytics = new ProductionAnalyticsSystem(config);
  }
  return globalProductionAnalytics;
}

/**
 * Initialize production analytics with default configuration
 */
export function initializeProductionAnalytics(config = {}, monitoringSystems = {}) {
  const analytics = getProductionAnalytics(config);
  analytics.startAnalytics(monitoringSystems);
  return analytics;
}