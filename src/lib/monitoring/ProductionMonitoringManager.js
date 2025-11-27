/**
 * Unified Production Monitoring Manager
 *
 * Central coordination system for all production monitoring components.
 * Provides a single interface for managing monitoring, analytics, and alerting.
 *
 * Features:
 * - Unified monitoring system orchestration
 * - Centralized configuration management
 * - Integrated reporting and analytics
 * - Coordinated alerting across all systems
 * - Production dashboard data provider
 * - System lifecycle management
 */

import { ProductionMonitoringInfrastructure } from './ProductionMonitoringInfrastructure.js';
import { ErrorMonitoringSystem } from './ErrorMonitoringSystem.js';
import { TradingOperationsMonitor } from './TradingOperationsMonitor.js';
import { SystemHealthMonitor } from './SystemHealthMonitor.js';
import { ProductionAnalyticsSystem } from './ProductionAnalyticsSystem.js';
import { ProductionAlertingSystem } from './ProductionAlertingSystem.js';

/**
 * Production monitoring manager configuration
 */
export const PRODUCTION_MANAGER_CONFIG = {
  // System settings
  AUTO_START_ALL_SYSTEMS: true,
  ENABLE_INTEGRATED_DASHBOARD: true,
  ENABLE_CROSS_SYSTEM_CORRELATION: true,
  ENABLE_GLOBAL_HEALTH_CHECKS: true,

  // Dashboard settings
  DASHBOARD_REFRESH_INTERVAL_MS: 5000,
  DASHBOARD_DATA_RETENTION_MINUTES: 30,
  ENABLE_REAL_TIME_UPDATES: true,

  // Integration settings
  SYSTEM_INTEGRATION_LATENCY_MS: 100,
  MAX_CROSS_SYSTEM_DELAY_MS: 500,
  ENABLE_SYSTEM_HEALTH_DEPENDENCIES: true,

  // Global thresholds
  GLOBAL_HEALTH_THRESHOLD: 85,        // 85% overall health required
  CRITICAL_ERROR_THRESHOLD: 5,        // 5 critical errors trigger global alert
  PERFORMANCE_DEGRADATION_THRESHOLD: 15, // 15% degradation triggers global alert

  // Reporting settings
  ENABLE_GLOBAL_REPORTS: true,
  GLOBAL_REPORT_INTERVAL_HOURS: 6,
  ENABLE_EXECUTIVE_SUMMARY: true,

  // Failover settings
  ENABLE_MONITORING_FAILOVER: true,
  FAILOVER_TIMEOUT_SECONDS: 30,
  ENABLE_GRACEFUL_DEGRADATION: true,

  // Performance settings
  COORDINATION_OVERHEAD_TARGET_MS: 50,
  MAX_SYSTEM_COORDINATION_LATENCY_MS: 200,
  ENABLE_PERFORMANCE_OPTIMIZATION: true
};

/**
 * System status levels
 */
export const SYSTEM_STATUS = {
  HEALTHY: 'HEALTHY',         // All systems operational
  DEGRADED: 'DEGRADED',       // Some systems experiencing issues
  CRITICAL: 'CRITICAL',       // Major system failures
  MAINTENANCE: 'MAINTENANCE', // System under maintenance
  OFFLINE: 'OFFLINE'         // System completely offline
};

/**
 * Production monitoring manager
 */
export class ProductionMonitoringManager {
  constructor(config = {}) {
    this.config = { ...PRODUCTION_MANAGER_CONFIG, ...config };
    this.isInitialized = false;
    this.isRunning = false;
    this.startTime = Date.now();

    // Monitoring systems
    this.systems = {
      production: null,
      error: null,
      tradingOps: null,
      systemHealth: null,
      analytics: null,
      alerting: null
    };

    // System status tracking
    this.systemStatus = new Map();
    this.globalHealth = {
      status: SYSTEM_STATUS.OFFLINE,
      score: 0,
      lastCheck: Date.now(),
      uptime: 0
    };

    // Dashboard data
    this.dashboardData = {
      realTime: {},
      historical: {},
      alerts: [],
      insights: [],
      metrics: {}
    };

    // Coordination state
    this.coordination = {
      lastHealthCheck: Date.now(),
      crossSystemCorrelations: new Map(),
      globalAlerts: [],
      systemDependencies: new Map()
    };

    // Performance tracking
    this.performance = {
      coordinationLatency: [],
      systemResponseTimes: new Map(),
      resourceUsage: [],
      globalMetrics: []
    };

    // Failover state
    this.failover = {
      active: false,
      failedSystems: new Set(),
      lastFailover: null,
      recoveryAttempts: 0
    };

    // Configuration management
    this.globalConfig = {
      production: {},
      error: {},
      tradingOps: {},
      systemHealth: {},
      analytics: {},
      alerting: {}
    };
  }

  /**
   * Initialize production monitoring manager
   */
  async initialize() {
    if (this.isInitialized) {
      console.warn('[ProductionMonitoringManager] Already initialized');
      return;
    }

    console.log('[ProductionMonitoringManager] Initializing production monitoring...');

    try {
      // Initialize all monitoring systems
      await this.initializeMonitoringSystems();

      // Set up system integrations
      this.setupSystemIntegrations();

      // Initialize dashboard
      if (this.config.ENABLE_INTEGRATED_DASHBOARD) {
        this.initializeDashboard();
      }

      // Set up coordination mechanisms
      this.setupCoordination();

      // Initialize failover mechanisms
      if (this.config.ENABLE_MONITORING_FAILOVER) {
        this.initializeFailover();
      }

      this.isInitialized = true;
      console.log('[ProductionMonitoringManager] Production monitoring initialized successfully');

    } catch (error) {
      console.error('[ProductionMonitoringManager] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Start all monitoring systems
   */
  async start() {
    if (!this.isInitialized) {
      throw new Error('Production monitoring manager not initialized');
    }

    if (this.isRunning) {
      console.warn('[ProductionMonitoringManager] Already running');
      return;
    }

    console.log('[ProductionMonitoringManager] Starting production monitoring systems...');

    try {
      const startTime = performance.now();

      // Start all systems
      await this.startMonitoringSystems();

      // Start coordination processes
      this.startCoordination();

      // Start dashboard updates
      if (this.config.ENABLE_INTEGRATED_DASHBOARD) {
        this.startDashboardUpdates();
      }

      // Start global health checks
      if (this.config.ENABLE_GLOBAL_HEALTH_CHECKS) {
        this.startGlobalHealthChecks();
      }

      // Start global reporting
      if (this.config.ENABLE_GLOBAL_REPORTS) {
        this.startGlobalReporting();
      }

      this.isRunning = true;
      const startupTime = performance.now() - startTime;

      console.log(`[ProductionMonitoringManager] All systems started in ${startupTime.toFixed(2)}ms`);

      // Log system status
      this.logSystemStatus();

    } catch (error) {
      console.error('[ProductionMonitoringManager] Failed to start monitoring systems:', error);
      await this.emergencyShutdown();
      throw error;
    }
  }

  /**
   * Stop all monitoring systems
   */
  async stop() {
    if (!this.isRunning) {
      console.warn('[ProductionMonitoringManager] Not running');
      return;
    }

    console.log('[ProductionMonitoringManager] Stopping production monitoring systems...');

    try {
      // Stop all systems in reverse order
      await this.stopMonitoringSystems();

      // Stop coordination processes
      this.stopCoordination();

      // Stop dashboard updates
      this.stopDashboardUpdates();

      // Stop global health checks
      this.stopGlobalHealthChecks();

      // Stop global reporting
      this.stopGlobalReporting();

      this.isRunning = false;
      this.globalHealth.status = SYSTEM_STATUS.OFFLINE;

      console.log('[ProductionMonitoringManager] All monitoring systems stopped');

    } catch (error) {
      console.error('[ProductionMonitoringManager] Error during shutdown:', error);
    }
  }

  /**
   * Initialize monitoring systems
   */
  async initializeMonitoringSystems() {
    console.log('[ProductionMonitoringManager] Initializing monitoring systems...');

    // Initialize production monitoring infrastructure
    this.systems.production = new ProductionMonitoringInfrastructure(this.globalConfig.production);

    // Initialize error monitoring system
    this.systems.error = new ErrorMonitoringSystem(this.globalConfig.error);

    // Initialize trading operations monitor
    this.systems.tradingOps = new TradingOperationsMonitor(this.globalConfig.tradingOps);

    // Initialize system health monitor
    this.systems.systemHealth = new SystemHealthMonitor(this.globalConfig.systemHealth);

    // Initialize production analytics system
    this.systems.analytics = new ProductionAnalyticsSystem(this.globalConfig.analytics);

    // Initialize production alerting system
    this.systems.alerting = new ProductionAlertingSystem(this.globalConfig.alerting);

    console.log('[ProductionMonitoringManager] All monitoring systems initialized');
  }

  /**
   * Set up system integrations
   */
  setupSystemIntegrations() {
    console.log('[ProductionMonitoringManager] Setting up system integrations...');

    // Register systems with alerting system
    this.systems.alerting.registerMonitoringSystem('production', this.systems.production);
    this.systems.alerting.registerMonitoringSystem('error', this.systems.error);
    this.systems.alerting.registerMonitoringSystem('tradingOps', this.systems.tradingOps);
    this.systems.alerting.registerMonitoringSystem('systemHealth', this.systems.systemHealth);

    // Initialize analytics with monitoring system references
    const monitoringSystems = {
      productionMonitor: this.systems.production,
      errorMonitor: this.systems.error,
      tradingOpsMonitor: this.systems.tradingOps,
      systemHealthMonitor: this.systems.systemHealth
    };

    this.systems.analytics.monitoringSystems = new Map(Object.entries(monitoringSystems));

    // Set up cross-system event handlers
    this.setupCrossSystemEventHandlers();

    console.log('[ProductionMonitoringManager] System integrations completed');
  }

  /**
   * Set up cross-system event handlers
   */
  setupCrossSystemEventHandlers() {
    // Handle critical alerts from any system
    this.systems.alerting.onCriticalAlert = (alert) => {
      this.handleCriticalAlert(alert);
    };

    // Handle system health changes
    if (this.systems.systemHealth.onHealthChange) {
      this.systems.systemHealth.onHealthChange = (health) => {
        this.handleSystemHealthChange(health);
      };
    }

    // Handle error storms
    if (this.systems.error.onErrorStorm) {
      this.systems.error.onErrorStorm = (stormData) => {
        this.handleErrorStorm(stormData);
      };
    }
  }

  /**
   * Initialize dashboard
   */
  initializeDashboard() {
    console.log('[ProductionMonitoringManager] Initializing integrated dashboard...');

    this.dashboardData = {
      realTime: {
        systemHealth: {},
        performance: {},
        alerts: [],
        userActivity: {}
      },
      historical: {
        trends: {},
        reports: [],
        analytics: {}
      },
      summary: {
        overallHealth: 0,
        activeAlerts: 0,
        systemUptime: 0,
        lastUpdate: Date.now()
      }
    };
  }

  /**
   * Set up coordination mechanisms
   */
  setupCoordination() {
    this.coordination.healthCheckInterval = setInterval(() => {
      this.performCoordinationHealthCheck();
    }, this.config.COORDINATION_OVERHEAD_TARGET_MS);

    this.coordination.correlationInterval = setInterval(() => {
      if (this.config.ENABLE_CROSS_SYSTEM_CORRELATION) {
        this.performCrossSystemCorrelation();
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Initialize failover mechanisms
   */
  initializeFailover() {
    // System health monitoring for failover
    this.failover.healthMonitorInterval = setInterval(() => {
      this.checkSystemFailoverConditions();
    }, 10000); // Every 10 seconds

    console.log('[ProductionMonitoringManager] Failover mechanisms initialized');
  }

  /**
   * Start monitoring systems
   */
  async startMonitoringSystems() {
    const startOrder = [
      'systemHealth',    // Start health monitoring first
      'production',      // Core production monitoring
      'error',          // Error monitoring
      'tradingOps',     // Trading operations
      'alerting',       // Alerting system
      'analytics'       // Analytics last (depends on others)
    ];

    for (const systemName of startOrder) {
      const system = this.systems[systemName];
      if (system) {
        console.log(`[ProductionMonitoringManager] Starting ${systemName} system...`);

        if (system.startMonitoring || system.startAnalytics || system.startAlerting) {
          system.startMonitoring?.() || system.startAnalytics?.() || system.startAlerting?.();
        }

        this.systemStatus.set(systemName, {
          status: SYSTEM_STATUS.HEALTHY,
          lastCheck: Date.now(),
          startTime: Date.now()
        });
      }
    }

    console.log('[ProductionMonitoringManager] All monitoring systems started');
  }

  /**
   * Start coordination processes
   */
  startCoordination() {
    // Coordination is already set up in setupCoordination()
    this.coordination.active = true;
  }

  /**
   * Start dashboard updates
   */
  startDashboardUpdates() {
    this.dashboardData.updateInterval = setInterval(() => {
      this.updateDashboardData();
    }, this.config.DASHBOARD_REFRESH_INTERVAL_MS);
  }

  /**
   * Start global health checks
   */
  startGlobalHealthChecks() {
    this.coordination.globalHealthInterval = setInterval(() => {
      this.performGlobalHealthCheck();
    }, 60000); // Every minute
  }

  /**
   * Start global reporting
   */
  startGlobalReporting() {
    this.coordination.reportingInterval = setInterval(() => {
      this.generateGlobalReport();
    }, this.config.GLOBAL_REPORT_INTERVAL_HOURS * 60 * 60 * 1000);
  }

  /**
   * Handle critical alert
   */
  handleCriticalAlert(alert) {
    console.log(`[ProductionMonitoringManager] Critical alert received: ${alert.type}`);

    // Add to global alerts
    this.coordination.globalAlerts.push({
      ...alert,
      timestamp: Date.now(),
      handled: false
    });

    // Check if global alert threshold is exceeded
    const recentCriticalAlerts = this.coordination.globalAlerts.filter(
      a => a.severity === 'CRITICAL' &&
           (Date.now() - a.timestamp) < 300000 // Last 5 minutes
    );

    if (recentCriticalAlerts.length >= this.config.CRITICAL_ERROR_THRESHOLD) {
      this.triggerGlobalEmergency('CRITICAL_ERROR_THRESHOLD', recentCriticalAlerts);
    }
  }

  /**
   * Handle system health change
   */
  handleSystemHealthChange(health) {
    this.coordination.systemDependencies.set('systemHealth', health);

    // Update global health if this is a significant change
    if (health.score < 70) {
      this.evaluateGlobalHealthImpact('systemHealth', health);
    }
  }

  /**
   * Handle error storm
   */
  handleErrorStorm(stormData) {
    console.log(`[ProductionMonitoringManager] Error storm detected: ${stormData.errorCount} errors`);

    // Trigger global alert for error storm
    this.triggerGlobalEmergency('ERROR_STORM', stormData);
  }

  /**
   * Perform coordination health check
   */
  performCoordinationHealthCheck() {
    const startTime = performance.now();

    // Check all systems are responsive
    let allHealthy = true;
    for (const [systemName, system] of Object.entries(this.systems)) {
      if (system && !this.isSystemHealthy(systemName, system)) {
        allHealthy = false;
        this.systemStatus.get(systemName).status = SYSTEM_STATUS.DEGRADED;
      }
    }

    const checkDuration = performance.now() - startTime;
    this.performance.coordinationLatency.push({
      timestamp: Date.now(),
      duration: checkDuration,
      allHealthy
    });

    // Maintain coordination latency history
    if (this.performance.coordinationLatency.length > 1000) {
      this.performance.coordinationLatency.shift();
    }
  }

  /**
   * Perform cross-system correlation
   */
  performCrossSystemCorrelation() {
    const now = Date.now();
    const correlationWindow = 5 * 60 * 1000; // 5 minutes

    // Collect recent events from all systems
    const events = this.collectRecentEvents(correlationWindow);

    // Find correlations
    const correlations = this.findCorrelations(events);

    // Store significant correlations
    for (const correlation of correlations) {
      if (correlation.strength > 0.7) {
        this.coordination.crossSystemCorrelations.set(correlation.id, correlation);
      }
    }

    console.log(`[ProductionMonitoringManager] Found ${correlations.length} cross-system correlations`);
  }

  /**
   * Collect recent events from all systems
   */
  collectRecentEvents(timeWindow) {
    const events = [];
    const cutoffTime = Date.now() - timeWindow;

    // Collect from system health monitor
    if (this.systems.systemHealth) {
      const healthReport = this.systems.systemHealth.getSystemHealthReport();
      if (healthReport.current.status !== 'EXCELLENT') {
        events.push({
          system: 'systemHealth',
          type: 'health_degradation',
          timestamp: Date.now(),
          severity: healthReport.current.status === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
          data: healthReport.current
        });
      }
    }

    // Collect from error monitor
    if (this.systems.error) {
      const errorReport = this.systems.error.getErrorReport();
      const recentErrors = errorReport.errors.recent.filter(e => e.timestamp >= cutoffTime);
      recentErrors.forEach(error => {
        events.push({
          system: 'error',
          type: 'error',
          timestamp: error.timestamp,
          severity: error.severity,
          data: error
        });
      });
    }

    // Collect from trading operations monitor
    if (this.systems.tradingOps) {
      const tradingReport = this.systems.tradingOpsMonitor.getTradingOperationsReport();
      const recentOps = tradingReport.operations.recent.filter(o => o.timestamp >= cutoffTime);
      recentOps.forEach(op => {
        events.push({
          system: 'tradingOps',
          type: 'operation',
          timestamp: op.timestamp,
          severity: 'LOW',
          data: op
        });
      });
    }

    return events;
  }

  /**
   * Find correlations between events
   */
  findCorrelations(events) {
    const correlations = [];
    const sortedEvents = events.sort((a, b) => a.timestamp - b.timestamp);

    // Look for temporal correlations
    for (let i = 0; i < sortedEvents.length; i++) {
      for (let j = i + 1; j < sortedEvents.length; j++) {
        const event1 = sortedEvents[i];
        const event2 = sortedEvents[j];
        const timeDiff = event2.timestamp - event1.timestamp;

        if (timeDiff < 30000) { // Within 30 seconds
          const strength = this.calculateCorrelationStrength(event1, event2);
          if (strength > 0.5) {
            correlations.push({
              id: `corr_${Date.now()}_${i}_${j}`,
              event1,
              event2,
              timeDifference: timeDiff,
              strength,
              type: this.determineCorrelationType(event1, event2)
            });
          }
        }
      }
    }

    return correlations;
  }

  /**
   * Calculate correlation strength between two events
   */
  calculateCorrelationStrength(event1, event2) {
    // Simple correlation calculation based on event types and systems
    let strength = 0;

    // Same system events have higher correlation
    if (event1.system === event2.system) {
      strength += 0.3;
    }

    // High severity events correlate more strongly
    if (event1.severity === 'HIGH' || event2.severity === 'HIGH') {
      strength += 0.2;
    }

    // Certain event types correlate strongly
    const strongCorrelations = [
      ['error', 'health_degradation'],
      ['performance_degradation', 'health_degradation'],
      ['error', 'operation_failure']
    ];

    for (const [type1, type2] of strongCorrelations) {
      if ((event1.type === type1 && event2.type === type2) ||
          (event1.type === type2 && event2.type === type1)) {
        strength += 0.5;
        break;
      }
    }

    return Math.min(1.0, strength);
  }

  /**
   * Determine correlation type
   */
  determineCorrelationType(event1, event2) {
    if (event1.type === 'error' || event2.type === 'error') {
      return 'ERROR_RELATED';
    }
    if (event1.type === 'health_degradation' || event2.type === 'health_degradation') {
      return 'HEALTH_RELATED';
    }
    if (event1.system === event2.system) {
      return 'SYSTEM_RELATED';
    }
    return 'TEMPORAL_RELATED';
  }

  /**
   * Update dashboard data
   */
  updateDashboardData() {
    const startTime = performance.now();

    try {
      // Update real-time data
      this.dashboardData.realTime = this.collectRealTimeData();

      // Update summary
      this.dashboardData.summary = {
        overallHealth: this.globalHealth.score,
        activeAlerts: this.coordination.globalAlerts.filter(a => !a.handled).length,
        systemUptime: Date.now() - this.startTime,
        lastUpdate: Date.now()
      };

      const updateTime = performance.now() - startTime;
      if (updateTime > this.config.DASHBOARD_REFRESH_INTERVAL_MS * 0.5) {
        console.warn(`[ProductionMonitoringManager] Dashboard update slow: ${updateTime.toFixed(2)}ms`);
      }

    } catch (error) {
      console.error('[ProductionMonitoringManager] Dashboard update failed:', error);
    }
  }

  /**
   * Collect real-time data for dashboard
   */
  collectRealTimeData() {
    return {
      systemHealth: this.systems.systemHealth?.getSystemHealthReport()?.current || {},
      performance: this.systems.production?.getMonitoringReport()?.performance?.global || {},
      alerts: this.coordination.globalAlerts.slice(-10),
      userActivity: this.systems.tradingOpsMonitor?.getTradingOperationsReport()?.realTime || {}
    };
  }

  /**
   * Perform global health check
   */
  performGlobalHealthCheck() {
    const startTime = Date.now();
    let totalScore = 0;
    let systemCount = 0;

    // Collect health scores from all systems
    for (const [systemName, system] of Object.entries(this.systems)) {
      if (system) {
        const score = this.getSystemHealthScore(systemName, system);
        totalScore += score;
        systemCount++;

        this.systemStatus.get(systemName).healthScore = score;
        this.systemStatus.get(systemName).lastCheck = startTime;
      }
    }

    // Calculate global health
    const averageScore = systemCount > 0 ? totalScore / systemCount : 0;
    const globalScore = Math.round(averageScore);

    // Determine global status
    let status;
    if (globalScore >= 90) status = SYSTEM_STATUS.HEALTHY;
    else if (globalScore >= 70) status = SYSTEM_STATUS.DEGRADED;
    else if (globalScore >= 50) status = SYSTEM_STATUS.CRITICAL;
    else status = SYSTEM_STATUS.OFFLINE;

    this.globalHealth = {
      status,
      score: globalScore,
      lastCheck: startTime,
      uptime: startTime - this.startTime
    };

    // Check if global health threshold is met
    if (globalScore < this.config.GLOBAL_HEALTH_THRESHOLD) {
      this.handleGlobalHealthDegradation(globalScore);
    }

    console.log(`[ProductionMonitoringManager] Global health: ${status} (${globalScore}%)`);
  }

  /**
   * Get system health score
   */
  getSystemHealthScore(systemName, system) {
    switch (systemName) {
      case 'systemHealth':
        return system.getSystemHealthReport()?.current?.score || 0;
      case 'production':
        return system.getMonitoringReport()?.systemHealth?.status === 'EXCELLENT' ? 90 : 70;
      case 'error':
        const errorReport = system.getErrorReport();
        return errorReport.summary.totalErrors === 0 ? 95 : Math.max(0, 95 - errorReport.summary.totalErrors * 5);
      case 'tradingOps':
        return system.getTradingOperationsReport()?.health?.userSatisfactionScore || 80;
      case 'alerting':
        return system.isRunning ? 100 : 0;
      case 'analytics':
        return system.isAnalyzing ? 100 : 0;
      default:
        return 0;
    }
  }

  /**
   * Handle global health degradation
   */
  handleGlobalHealthDegradation(score) {
    console.warn(`[ProductionMonitoringManager] Global health degraded: ${score}%`);

    // Create global alert
    const globalAlert = {
      id: `global_health_${Date.now()}`,
      type: 'GLOBAL_HEALTH_DEGRADATION',
      severity: score < 50 ? 'CRITICAL' : 'HIGH',
      message: `Global system health degraded to ${score}%`,
      category: 'SYSTEM_HEALTH',
      data: {
        globalScore: score,
        threshold: this.config.GLOBAL_HEALTH_THRESHOLD,
        systemStatuses: Object.fromEntries(this.systemStatus)
      }
    };

    this.coordination.globalAlerts.push(globalAlert);

    // Send to alerting system
    if (this.systems.alerting) {
      this.systems.alerting.processAlert(globalAlert);
    }
  }

  /**
   * Check system failover conditions
   */
  checkSystemFailoverConditions() {
    const now = Date.now();

    for (const [systemName, system] of Object.entries(this.systems)) {
      if (!system) continue;

      const status = this.systemStatus.get(systemName);
      if (!status) continue;

      // Check if system has been unresponsive for too long
      const timeSinceLastCheck = now - status.lastCheck;
      const failoverTimeout = this.config.FAILOVER_TIMEOUT_SECONDS * 1000;

      if (timeSinceLastCheck > failoverTimeout && !this.failover.failedSystems.has(systemName)) {
        console.warn(`[ProductionMonitoringManager] System failover triggered: ${systemName}`);
        this.triggerSystemFailover(systemName, 'UNRESPONSIVE');
      }
    }
  }

  /**
   * Trigger system failover
   */
  triggerSystemFailover(systemName, reason) {
    this.failover.failedSystems.add(systemName);
    this.failover.lastFailover = {
      system: systemName,
      reason,
      timestamp: Date.now()
    };

    // Update system status
    this.systemStatus.get(systemName).status = SYSTEM_STATUS.CRITICAL;

    // Attempt recovery
    this.attemptSystemRecovery(systemName);
  }

  /**
   * Attempt system recovery
   */
  async attemptSystemRecovery(systemName) {
    const system = this.systems[systemName];
    if (!system) return;

    console.log(`[ProductionMonitoringManager] Attempting recovery for ${systemName}...`);

    try {
      this.failover.recoveryAttempts++;

      // Attempt to restart the system
      if (system.stopMonitoring) {
        await system.stopMonitoring();
      }
      if (system.startMonitoring) {
        await system.startMonitoring();
      }

      // Check if recovery was successful
      setTimeout(() => {
        if (this.isSystemHealthy(systemName, system)) {
          this.failover.failedSystems.delete(systemName);
          this.systemStatus.get(systemName).status = SYSTEM_STATUS.HEALTHY;
          console.log(`[ProductionMonitoringManager] System recovery successful: ${systemName}`);
        } else {
          console.warn(`[ProductionMonitoringManager] System recovery failed: ${systemName}`);
        }
      }, 5000);

    } catch (error) {
      console.error(`[ProductionMonitoringManager] System recovery error for ${systemName}:`, error);
    }
  }

  /**
   * Generate global report
   */
  generateGlobalReport() {
    const report = {
      timestamp: Date.now(),
      generatedAt: new Date().toISOString(),
      globalHealth: this.globalHealth,
      systemStatuses: Object.fromEntries(this.systemStatus),
      dashboardData: this.dashboardData,
      coordination: {
        globalAlerts: this.coordination.globalAlerts,
        correlations: Array.from(this.coordination.crossSystemCorrelations.values())
      },
      performance: {
        coordinationLatency: this.performance.coordinationLatency.slice(-100),
        systemResponseTimes: Object.fromEntries(this.performance.systemResponseTimes)
      },
      failover: this.failover
    };

    // Store report
    if (!this.globalReports) {
      this.globalReports = [];
    }
    this.globalReports.push(report);

    // Maintain report history
    if (this.globalReports.length > 100) {
      this.globalReports.shift();
    }

    console.log('[ProductionMonitoringManager] Global report generated');
    return report;
  }

  /**
   * Get comprehensive monitoring report
   */
  getMonitoringReport() {
    return {
      timestamp: Date.now(),
      manager: {
        isInitialized: this.isInitialized,
        isRunning: this.isRunning,
        uptime: Date.now() - this.startTime,
        config: this.config
      },

      globalHealth: this.globalHealth,
      systemStatuses: Object.fromEntries(this.systemStatus),
      systems: this.getSystemReports(),
      dashboard: this.dashboardData,
      coordination: {
        globalAlerts: this.coordination.globalAlerts,
        correlations: Array.from(this.coordination.crossSystemCorrelations.values())
      },
      performance: this.performance,
      failover: this.failover
    };
  }

  /**
   * Get reports from all systems
   */
  getSystemReports() {
    const reports = {};

    for (const [systemName, system] of Object.entries(this.systems)) {
      if (system) {
        try {
          switch (systemName) {
            case 'production':
              reports[systemName] = system.getMonitoringReport();
              break;
            case 'error':
              reports[systemName] = system.getErrorReport();
              break;
            case 'tradingOps':
              reports[systemName] = system.getTradingOperationsReport();
              break;
            case 'systemHealth':
              reports[systemName] = system.getSystemHealthReport();
              break;
            case 'analytics':
              reports[systemName] = system.getAnalyticsReport();
              break;
            case 'alerting':
              reports[systemName] = system.getAlertingReport();
              break;
          }
        } catch (error) {
          console.error(`[ProductionMonitoringManager] Error getting report from ${systemName}:`, error);
          reports[systemName] = { error: error.message };
        }
      }
    }

    return reports;
  }

  /**
   * Trigger global emergency
   */
  triggerGlobalEmergency(type, data) {
    console.error(`[ProductionMonitoringManager] GLOBAL EMERGENCY: ${type}`, data);

    const emergencyAlert = {
      id: `emergency_${Date.now()}`,
      type: 'GLOBAL_EMERGENCY',
      severity: 'CRITICAL',
      message: `Global emergency triggered: ${type}`,
      category: 'SYSTEM_HEALTH',
      data: {
        emergencyType: type,
        emergencyData: data,
        globalHealth: this.globalHealth,
        timestamp: Date.now()
      }
    };

    // Add to global alerts
    this.coordination.globalAlerts.push(emergencyAlert);

    // Send to alerting system with highest priority
    if (this.systems.alerting) {
      this.systems.alerting.processAlert(emergencyAlert);
    }

    // Consider emergency actions
    this.considerEmergencyActions(type, data);
  }

  /**
   * Consider emergency actions
   */
  considerEmergencyActions(type, data) {
    // This would implement emergency response actions
    // For now, just log the consideration
    console.log(`[ProductionMonitoringManager] Considering emergency actions for: ${type}`);
  }

  /**
   * Check if system is healthy
   */
  isSystemHealthy(systemName, system) {
    try {
      switch (systemName) {
        case 'production':
          return system.isMonitoring;
        case 'error':
          return system.isMonitoring;
        case 'tradingOps':
          return system.isMonitoring;
        case 'systemHealth':
          return system.isMonitoring;
        case 'alerting':
          return system.isActive;
        case 'analytics':
          return system.isAnalyzing;
        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Stop monitoring systems
   */
  async stopMonitoringSystems() {
    const stopOrder = ['analytics', 'alerting', 'tradingOps', 'error', 'production', 'systemHealth'];

    for (const systemName of stopOrder) {
      const system = this.systems[systemName];
      if (system) {
        console.log(`[ProductionMonitoringManager] Stopping ${systemName} system...`);

        try {
          if (system.stopMonitoring) {
            await system.stopMonitoring();
          } else if (system.stopAnalytics) {
            await system.stopAnalytics();
          } else if (system.stopAlerting) {
            await system.stopAlerting();
          }
        } catch (error) {
          console.error(`[ProductionMonitoringManager] Error stopping ${systemName}:`, error);
        }

        this.systemStatus.get(systemName).status = SYSTEM_STATUS.OFFLINE;
      }
    }
  }

  /**
   * Stop coordination processes
   */
  stopCoordination() {
    if (this.coordination.healthCheckInterval) {
      clearInterval(this.coordination.healthCheckInterval);
    }
    if (this.coordination.correlationInterval) {
      clearInterval(this.coordination.correlationInterval);
    }
    this.coordination.active = false;
  }

  /**
   * Stop dashboard updates
   */
  stopDashboardUpdates() {
    if (this.dashboardData.updateInterval) {
      clearInterval(this.dashboardData.updateInterval);
    }
  }

  /**
   * Stop global health checks
   */
  stopGlobalHealthChecks() {
    if (this.coordination.globalHealthInterval) {
      clearInterval(this.coordination.globalHealthInterval);
    }
  }

  /**
   * Stop global reporting
   */
  stopGlobalReporting() {
    if (this.coordination.reportingInterval) {
      clearInterval(this.coordination.reportingInterval);
    }
  }

  /**
   * Log system status
   */
  logSystemStatus() {
    console.log('[ProductionMonitoringManager] System Status:');
    for (const [systemName, status] of this.systemStatus) {
      console.log(`  ${systemName}: ${status.status}`);
    }
    console.log(`  Global: ${this.globalHealth.status} (${this.globalHealth.score}%)`);
  }

  /**
   * Emergency shutdown
   */
  async emergencyShutdown() {
    console.error('[ProductionMonitoringManager] EMERGENCY SHUTDOWN INITIATED');

    try {
      // Stop all systems immediately
      await this.stop();

      // Mark system as offline
      this.globalHealth.status = SYSTEM_STATUS.OFFLINE;

      console.error('[ProductionMonitoringManager] Emergency shutdown completed');

    } catch (error) {
      console.error('[ProductionMonitoringManager] Error during emergency shutdown:', error);
    }
  }

  /**
   * Cleanup and destroy monitoring manager
   */
  async destroy() {
    console.log('[ProductionMonitoringManager] Destroying production monitoring manager...');

    await this.emergencyShutdown();

    // Destroy all systems
    for (const [systemName, system] of Object.entries(this.systems)) {
      if (system && system.destroy) {
        try {
          await system.destroy();
        } catch (error) {
          console.error(`[ProductionMonitoringManager] Error destroying ${systemName}:`, error);
        }
      }
    }

    // Clear all data
    this.systemStatus.clear();
    this.coordination.globalAlerts = [];
    this.coordination.crossSystemCorrelations.clear();
    this.performance.coordinationLatency = [];
    this.performance.systemResponseTimes.clear();
    this.failover.failedSystems.clear();

    // Reset state
    this.isInitialized = false;
    this.isRunning = false;

    console.log('[ProductionMonitoringManager] Production monitoring manager destroyed');
  }
}

/**
 * Global production monitoring manager instance
 */
let globalProductionManager = null;

/**
 * Get or create global production monitoring manager
 */
export function getProductionMonitoringManager(config = {}) {
  if (!globalProductionManager) {
    globalProductionManager = new ProductionMonitoringManager(config);
  }
  return globalProductionManager;
}

/**
 * Initialize complete production monitoring system
 */
export async function initializeProductionMonitoring(config = {}) {
  const manager = getProductionMonitoringManager(config);
  await manager.initialize();
  await manager.start();
  return manager;
}