/**
 * Production Alerting and Notification System
 *
 * Comprehensive alerting and notification system for trading platform
 * with real-time alerting, escalation workflows, and notification channels.
 *
 * Features:
 * - Real-time alerting with <100ms latency
 * - Multi-channel notifications (console, external APIs, webhooks)
 * - Alert escalation and de-escalation workflows
 * - Alert rate limiting and deduplication
 * - Alert categorization and prioritization
 * - Integration with monitoring systems
 */

/**
 * Alerting configuration
 */
export const ALERTING_CONFIG = {
  // Alert settings
  ENABLE_REAL_TIME_ALERTING: true,
  ALERT_LATENCY_TARGET_MS: 100,
  MAX_ALERTS_PER_MINUTE: 50,
  ALERT_DEDUPlication_WINDOW_MS: 30000, // 30 seconds

  // Notification channels
  ENABLE_CONSOLE_NOTIFICATIONS: true,
  ENABLE_EXTERNAL_NOTIFICATIONS: true,
  ENABLE_WEBHOOK_NOTIFICATIONS: false,
  ENABLE_EMAIL_NOTIFICATIONS: false,

  // External notification settings
  NOTIFICATION_ENDPOINT: null,
  NOTIFICATION_API_KEY: null,
  NOTIFICATION_TIMEOUT_MS: 5000,
  NOTIFICATION_RETRY_ATTEMPTS: 3,

  // Webhook settings
  WEBHOOK_ENDPOINTS: [],
  WEBHOOK_TIMEOUT_MS: 10000,
  WEBHOOK_RETRY_ATTEMPTS: 3,

  // Alert severity levels
  SEVERITY_THRESHOLDS: {
    CRITICAL: { escalationTimeMinutes: 5, maxRetries: 3, notificationIntervalMinutes: 2 },
    HIGH: { escalationTimeMinutes: 15, maxRetries: 2, notificationIntervalMinutes: 5 },
    MEDIUM: { escalationTimeMinutes: 30, maxRetries: 1, notificationIntervalMinutes: 15 },
    LOW: { escalationTimeMinutes: 60, maxRetries: 1, notificationIntervalMinutes: 30 }
  },

  // Alert categories
  ALERT_CATEGORIES: {
    SYSTEM_HEALTH: 'SYSTEM_HEALTH',
    PERFORMANCE: 'PERFORMANCE',
    USER_EXPERIENCE: 'USER_EXPERIENCE',
    TRADING_OPERATIONS: 'TRADING_OPERATIONS',
    ERROR_MANAGEMENT: 'ERROR_MANAGEMENT',
    CAPACITY_MANAGEMENT: 'CAPACITY_MANAGEMENT'
  },

  // Escalation settings
  ENABLE_AUTOMATIC_ESCALATION: true,
  ESCALATION_THRESHOLDS: {
    ALERT_COUNT: 10,           // Escalate after 10 alerts in 5 minutes
    ERROR_RATE: 0.1,          // Escalate if error rate > 10%
    PERFORMANCE_DEGRADATION: 20 // Escalate if performance degrades by 20%
  },

  // Alert retention
  ALERT_RETENTION_HOURS: 24,
  NOTIFICATION_RETENTION_DAYS: 7,

  // Privacy settings
  SANITIZE_ALERT_DATA: true,
  EXCLUDE_SENSITIVE_INFO: ['password', 'token', 'apiKey', 'secret']
};

/**
 * Alert severity levels
 */
export const ALERT_SEVERITY = {
  CRITICAL: 'CRITICAL',    // System-breaking issues requiring immediate attention
  HIGH: 'HIGH',           // Major issues impacting core functionality
  MEDIUM: 'MEDIUM',       // Issues affecting partial functionality
  LOW: 'LOW',            // Minor issues or informational alerts
  INFO: 'INFO'           // Informational messages
};

/**
 * Alert status levels
 */
export const ALERT_STATUS = {
  ACTIVE: 'ACTIVE',           // Alert is currently active
  ACKNOWLEDGED: 'ACKNOWLEDGED', // Alert has been acknowledged
  RESOLVED: 'RESOLVED',       // Alert has been resolved
  ESCALATED: 'ESCALATED',      // Alert has been escalated
  SUPPRESSED: 'SUPPRESSED'     // Alert has been suppressed
};

/**
 * Production alerting system
 */
export class ProductionAlertingSystem {
  constructor(config = {}) {
    this.config = { ...ALERTING_CONFIG, ...config };
    this.isActive = false;
    this.startTime = Date.now();

    // Alert storage
    this.activeAlerts = new Map();
    this.alertHistory = [];
    this.suppressedAlerts = new Map();
    this.escalatedAlerts = new Map();

    // Notification tracking
    this.notificationHistory = [];
    this.notificationFailures = new Map();
    this.deliveryStatus = new Map();

    // Alert processing
    this.alertQueue = [];
    this.processingAlerts = false;
    this.alertDeduplication = new Map();

    // Rate limiting
    this.alertCounts = new Map();
    this.lastAlertReset = Date.now();

    // Escalation management
    this.escalationTimers = new Map();
    this.escalationPolicies = new Map();

    // Notification channels
    this.notificationChannels = new Map();

    // Monitoring system references
    this.monitoringSystems = new Map();

    // Initialize alerting system
    this.initializeAlerting();
  }

  /**
   * Start alerting system
   */
  startAlerting() {
    if (this.isActive) {
      console.warn('[AlertingSystem] Alerting system already active');
      return;
    }

    this.isActive = true;
    this.startTime = Date.now();

    console.log('[AlertingSystem] Starting production alerting system...');

    // Initialize notification channels
    this.initializeNotificationChannels();

    // Start alert processing
    this.startAlertProcessing();

    // Start escalation management
    this.startEscalationManagement();

    // Start cleanup processes
    this.startCleanupProcesses();

    console.log('[AlertingSystem] Production alerting system started successfully');
  }

  /**
   * Stop alerting system
   */
  stopAlerting() {
    if (!this.isActive) {
      console.warn('[AlertingSystem] Alerting system not active');
      return;
    }

    this.isActive = false;

    // Clear escalation timers
    for (const [alertId, timer] of this.escalationTimers) {
      clearTimeout(timer);
    }
    this.escalationTimers.clear();

    // Clear processing interval
    if (this.alertProcessingInterval) {
      clearInterval(this.alertProcessingInterval);
    }

    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    console.log('[AlertingSystem] Production alerting system stopped');
  }

  /**
   * Initialize alerting system components
   */
  initializeAlerting() {
    // Initialize escalation policies
    this.initializeEscalationPolicies();

    // Initialize notification channels
    this.initializeNotificationChannels();
  }

  /**
   * Initialize escalation policies
   */
  initializeEscalationPolicies() {
    for (const [severity, config] of Object.entries(this.config.SEVERITY_THRESHOLDS)) {
      this.escalationPolicies.set(severity, {
        ...config,
        escalationTimeMs: config.escalationTimeMinutes * 60 * 1000,
        notificationIntervalMs: config.notificationIntervalMinutes * 60 * 1000
      });
    }
  }

  /**
   * Initialize notification channels
   */
  initializeNotificationChannels() {
    if (this.config.ENABLE_CONSOLE_NOTIFICATIONS) {
      this.notificationChannels.set('console', {
        type: 'console',
        enabled: true,
        send: this.sendConsoleNotification.bind(this)
      });
    }

    if (this.config.ENABLE_EXTERNAL_NOTIFICATIONS && this.config.NOTIFICATION_ENDPOINT) {
      this.notificationChannels.set('external', {
        type: 'external',
        enabled: true,
        endpoint: this.config.NOTIFICATION_ENDPOINT,
        apiKey: this.config.NOTIFICATION_API_KEY,
        timeout: this.config.NOTIFICATION_TIMEOUT_MS,
        retries: this.config.NOTIFICATION_RETRY_ATTEMPTS,
        send: this.sendExternalNotification.bind(this)
      });
    }

    if (this.config.ENABLE_WEBHOOK_NOTIFICATIONS) {
      this.config.WEBHOOK_ENDPOINTS.forEach((endpoint, index) => {
        this.notificationChannels.set(`webhook_${index}`, {
          type: 'webhook',
          enabled: true,
          endpoint,
          timeout: this.config.WEBHOOK_TIMEOUT_MS,
          retries: this.config.WEBHOOK_RETRY_ATTEMPTS,
          send: this.sendWebhookNotification.bind(this)
        });
      });
    }
  }

  /**
   * Start alert processing
   */
  startAlertProcessing() {
    this.alertProcessingInterval = setInterval(() => {
      this.processAlertQueue();
    }, 100); // Process alerts every 100ms for <100ms latency
  }

  /**
   * Start escalation management
   */
  startEscalationManagement() {
    if (!this.config.ENABLE_AUTOMATIC_ESCALATION) return;

    // Check for escalation opportunities every minute
    const escalationInterval = setInterval(() => {
      this.checkEscalationOpportunities();
    }, 60000);

    // Store for cleanup
    this.escalationInterval = escalationInterval;
  }

  /**
   * Start cleanup processes
   */
  startCleanupProcesses() {
    // Clean up old alerts every hour
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 60 * 60 * 1000);
  }

  /**
   * Register monitoring system for alerting
   */
  registerMonitoringSystem(name, system) {
    this.monitoringSystems.set(name, system);

    // Subscribe to system alerts if available
    if (system.onAlert) {
      system.onAlert((alert) => {
        this.processAlert(alert);
      });
    }

    console.log(`[AlertingSystem] Registered monitoring system: ${name}`);
  }

  /**
   * Process alert from monitoring system
   */
  processAlert(alertData) {
    if (!this.isActive) return;

    try {
      // Validate alert data
      if (!this.validateAlertData(alertData)) {
        console.warn('[AlertingSystem] Invalid alert data received:', alertData);
        return;
      }

      // Check rate limiting
      if (this.isRateLimited(alertData)) {
        console.warn('[AlertingSystem] Alert rate limited:', alertData.type);
        return;
      }

      // Check for deduplication
      const deduplicationKey = this.generateDeduplicationKey(alertData);
      if (this.isDuplicate(deduplicationKey)) {
        console.log(`[AlertingSystem] Alert deduplicated: ${deduplicationKey}`);
        return;
      }

      // Create enriched alert
      const alert = this.createEnrichedAlert(alertData);

      // Add to queue for processing
      this.alertQueue.push(alert);

      // Update deduplication tracking
      this.updateDeduplicationTracking(deduplicationKey, alert.id);

      console.log(`[AlertingSystem] Alert queued for processing: ${alert.id}`);

    } catch (error) {
      console.error('[AlertingSystem] Error processing alert:', error);
    }
  }

  /**
   * Validate alert data
   */
  validateAlertData(alertData) {
    return alertData &&
           typeof alertData === 'object' &&
           alertData.type &&
           alertData.message &&
           Object.values(ALERT_SEVERITY).includes(alertData.severity);
  }

  /**
   * Check if alert is rate limited
   */
  isRateLimited(alertData) {
    const now = Date.now();
    const minuteKey = Math.floor(now / 60000);

    // Reset counter if new minute
    if (this.lastAlertReset < minuteKey * 60000) {
      this.alertCounts.clear();
      this.lastAlertReset = minuteKey * 60000;
    }

    const currentCount = this.alertCounts.get(minuteKey) || 0;
    if (currentCount >= this.config.MAX_ALERTS_PER_MINUTE) {
      return true;
    }

    this.alertCounts.set(minuteKey, currentCount + 1);
    return false;
  }

  /**
   * Generate deduplication key
   */
  generateDeduplicationKey(alertData) {
    const components = [
      alertData.type,
      alertData.category || 'UNKNOWN',
      alertData.severity,
      alertData.displayId || 'global',
      alertData.symbol || 'system'
    ];

    return components.join(':');
  }

  /**
   * Check if alert is duplicate
   */
  isDuplicate(deduplicationKey) {
    const lastAlert = this.alertDeduplication.get(deduplicationKey);
    if (!lastAlert) return false;

    const now = Date.now();
    return (now - lastAlert.timestamp) < this.config.ALERT_DEDUPlication_WINDOW_MS;
  }

  /**
   * Update deduplication tracking
   */
  updateDeduplicationTracking(deduplicationKey, alertId) {
    this.alertDeduplication.set(deduplicationKey, {
      alertId,
      timestamp: Date.now()
    });

    // Clean old deduplication entries
    setTimeout(() => {
      this.alertDeduplication.delete(deduplicationKey);
    }, this.config.ALERT_DEDUPlication_WINDOW_MS * 2);
  }

  /**
   * Create enriched alert
   */
  createEnrichedAlert(alertData) {
    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      status: ALERT_STATUS.ACTIVE,
      category: alertData.category || this.config.ALERT_CATEGORIES.SYSTEM_HEALTH,
      ...alertData,
      data: this.sanitizeAlertData(alertData.data || {}),
      context: this.generateAlertContext(alertData),
      escalationLevel: 0,
      notificationCount: 0,
      lastNotified: null
    };
  }

  /**
   * Generate alert context
   */
  generateAlertContext(alertData) {
    return {
      systemUptime: Date.now() - this.startTime,
      activeAlertCount: this.activeAlerts.size,
      recentAlertCount: this.getRecentAlertCount(),
      systemLoad: this.getCurrentSystemLoad(),
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Sanitize alert data for privacy
   */
  sanitizeAlertData(data) {
    if (!this.config.SANITIZE_ALERT_DATA) return data;

    const sanitized = { ...data };

    for (const field of this.config.EXCLUDE_SENSITIVE_INFO) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Process alert queue
   */
  processAlertQueue() {
    if (this.processingAlerts || this.alertQueue.length === 0) return;

    this.processingAlerts = true;

    try {
      // Process alerts in batch
      const batchSize = Math.min(10, this.alertQueue.length); // Process up to 10 alerts at once
      const batch = this.alertQueue.splice(0, batchSize);

      for (const alert of batch) {
        this.handleAlert(alert);
      }

    } catch (error) {
      console.error('[AlertingSystem] Error processing alert queue:', error);
    } finally {
      this.processingAlerts = false;
    }
  }

  /**
   * Handle individual alert
   */
  handleAlert(alert) {
    try {
      // Add to active alerts
      this.activeAlerts.set(alert.id, alert);

      // Add to history
      this.alertHistory.push(alert);

      // Maintain alert history size
      if (this.alertHistory.length > 10000) {
        this.alertHistory.shift();
      }

      // Send notifications
      this.sendAlertNotifications(alert);

      // Set up escalation if needed
      this.setupEscalation(alert);

      // Update metrics
      this.updateAlertMetrics(alert);

      console.log(`[AlertingSystem] Alert processed: ${alert.id} (${alert.severity} ${alert.type})`);

    } catch (error) {
      console.error(`[AlertingSystem] Error handling alert ${alert.id}:`, error);
    }
  }

  /**
   * Send alert notifications
   */
  async sendAlertNotifications(alert) {
    const notificationPromises = [];

    for (const [channelName, channel] of this.notificationChannels) {
      if (channel.enabled) {
        notificationPromises.push(
          this.sendNotification(channel, alert, channelName)
        );
      }
    }

    try {
      const results = await Promise.allSettled(notificationPromises);
      this.handleNotificationResults(alert, results);
    } catch (error) {
      console.error(`[AlertingSystem] Error sending notifications for alert ${alert.id}:`, error);
    }
  }

  /**
   * Send notification to specific channel
   */
  async sendNotification(channel, alert, channelName) {
    const startTime = Date.now();

    try {
      const result = await channel.send(alert);

      const endTime = Date.now();
      const deliveryTime = endTime - startTime;

      // Record successful notification
      this.recordNotification({
        alertId: alert.id,
        channel: channelName,
        status: 'SUCCESS',
        deliveryTime,
        timestamp: startTime,
        result
      });

      return { success: true, deliveryTime, result };

    } catch (error) {
      const endTime = Date.now();
      const deliveryTime = endTime - startTime;

      // Record failed notification
      this.recordNotification({
        alertId: alert.id,
        channel: channelName,
        status: 'FAILED',
        deliveryTime,
        timestamp: startTime,
        error: error.message
      });

      // Track failure for retry logic
      this.trackNotificationFailure(channelName, alert.id, error);

      throw error;
    }
  }

  /**
   * Send console notification
   */
  sendConsoleNotification(alert) {
    const logMethod = alert.severity === ALERT_SEVERITY.CRITICAL ? console.error :
                     alert.severity === ALERT_SEVERITY.HIGH ? console.error :
                     alert.severity === ALERT_SEVERITY.MEDIUM ? console.warn :
                     alert.severity === ALERT_SEVERITY.LOW ? console.info :
                     console.log;

    logMethod(`[ALERT] ${alert.severity} [${alert.category}] ${alert.type}: ${alert.message}`, {
      id: alert.id,
      timestamp: new Date(alert.timestamp).toISOString(),
      data: alert.data,
      context: alert.context
    });

    return Promise.resolve({ channel: 'console', delivered: true });
  }

  /**
   * Send external notification
   */
  async sendExternalNotification(alert) {
    if (!this.config.NOTIFICATION_ENDPOINT) {
      throw new Error('External notification endpoint not configured');
    }

    const payload = {
      alert,
      timestamp: Date.now(),
      source: 'neurosensefx-alerting'
    };

    const response = await fetch(this.config.NOTIFICATION_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.NOTIFICATION_API_KEY || ''
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.config.NOTIFICATION_TIMEOUT_MS)
    });

    if (!response.ok) {
      throw new Error(`External notification failed: ${response.status} ${response.statusText}`);
    }

    return { channel: 'external', response: await response.json() };
  }

  /**
   * Send webhook notification
   */
  async sendWebhookNotification(alert) {
    const endpoint = this.endpoint; // This would be bound in the channel object
    if (!endpoint) {
      throw new Error('Webhook endpoint not configured');
    }

    const payload = {
      alert,
      timestamp: Date.now(),
      event: 'alert_triggered'
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'NeuroSenseFX-Alerting/1.0'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.config.WEBHOOK_TIMEOUT_MS)
    });

    if (!response.ok) {
      throw new Error(`Webhook notification failed: ${response.status} ${response.statusText}`);
    }

    return { channel: 'webhook', response: await response.json() };
  }

  /**
   * Handle notification results
   */
  handleNotificationResults(alert, results) {
    let successCount = 0;
    let failureCount = 0;

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successCount++;
      } else {
        failureCount++;
        console.error(`[AlertingSystem] Notification failed for alert ${alert.id}:`, result.reason);
      }
    });

    // Update alert notification count
    alert.notificationCount += successCount;
    alert.lastNotified = Date.now();

    // Update delivery status
    this.deliveryStatus.set(alert.id, {
      totalChannels: results.length,
      successCount,
      failureCount,
      lastUpdate: Date.now()
    });

    console.log(`[AlertingSystem] Alert ${alert.id}: ${successCount}/${results.length} notifications sent successfully`);
  }

  /**
   * Track notification failure
   */
  trackNotificationFailure(channelName, alertId, error) {
    if (!this.notificationFailures.has(channelName)) {
      this.notificationFailures.set(channelName, new Map());
    }

    const channelFailures = this.notificationFailures.get(channelName);
    channelFailures.set(alertId, {
      error: error.message,
      timestamp: Date.now(),
      retryCount: (channelFailures.get(alertId)?.retryCount || 0) + 1
    });
  }

  /**
   * Record notification
   */
  recordNotification(notification) {
    this.notificationHistory.push(notification);

    // Maintain notification history
    if (this.notificationHistory.length > 50000) {
      this.notificationHistory.shift();
    }
  }

  /**
   * Setup escalation for alert
   */
  setupEscalation(alert) {
    if (!this.config.ENABLE_AUTOMATIC_ESCALATION) return;

    const policy = this.escalationPolicies.get(alert.severity);
    if (!policy) return;

    const escalationTimer = setTimeout(() => {
      this.escalateAlert(alert.id);
    }, policy.escalationTimeMs);

    this.escalationTimers.set(alert.id, escalationTimer);
  }

  /**
   * Escalate alert
   */
  escalateAlert(alertId) {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return;

    // Clear existing timer
    const timer = this.escalationTimers.get(alertId);
    if (timer) {
      clearTimeout(timer);
      this.escalationTimers.delete(alertId);
    }

    // Update alert
    alert.status = ALERT_STATUS.ESCALATED;
    alert.escalationLevel++;
    alert.escalationTime = Date.now();

    // Store in escalated alerts
    this.escalatedAlerts.set(alertId, alert);

    console.log(`[AlertingSystem] Alert escalated: ${alertId} (level ${alert.escalationLevel})`);

    // Send escalation notifications
    this.sendEscalationNotifications(alert);

    // Set up next escalation if within limits
    const policy = this.escalationPolicies.get(alert.severity);
    if (policy && alert.escalationLevel < policy.maxRetries) {
      const nextTimer = setTimeout(() => {
        this.escalateAlert(alertId);
      }, policy.notificationIntervalMs);
      this.escalationTimers.set(alertId, nextTimer);
    }
  }

  /**
   * Send escalation notifications
   */
  async sendEscalationNotifications(alert) {
    // Create escalation notification with higher priority
    const escalationNotification = {
      ...alert,
      escalated: true,
      escalationLevel: alert.escalationLevel,
      type: `ESCALATED_${alert.type}`,
      message: `ESCALATED (${alert.escalationLevel}): ${alert.message}`
    };

    await this.sendAlertNotifications(escalationNotification);
  }

  /**
   * Check escalation opportunities
   */
  checkEscalationOpportunities() {
    if (!this.config.ENABLE_AUTOMATIC_ESCALATION) return;

    // Check alert count threshold
    this.checkAlertCountEscalation();

    // Check error rate threshold
    this.checkErrorRateEscalation();

    // Check performance degradation threshold
    this.checkPerformanceDegradationEscalation();
  }

  /**
   * Check alert count escalation
   */
  checkAlertCountEscalation() {
    const now = Date.now();
    const fiveMinutesAgo = now - 300000;

    const recentAlerts = Array.from(this.activeAlerts.values())
      .filter(alert => alert.timestamp >= fiveMinutesAgo);

    if (recentAlerts.length >= this.config.ESCALATION_THRESHOLDS.ALERT_COUNT) {
      this.createSystemWideEscalation('HIGH_ALERT_COUNT', {
        alertCount: recentAlerts.length,
        timeWindow: '5 minutes',
        threshold: this.config.ESCALATION_THRESHOLDS.ALERT_COUNT
      });
    }
  }

  /**
   * Check error rate escalation
   */
  checkErrorRateEscalation() {
    const errorMonitor = this.monitoringSystems.get('errorMonitor');
    if (!errorMonitor) return;

    const errorReport = errorMonitor.getErrorReport();
    const errorRate = errorReport.summary.errorRate || 0;

    if (errorRate >= this.config.ESCALATION_THRESHOLDS.ERROR_RATE) {
      this.createSystemWideEscalation('HIGH_ERROR_RATE', {
        errorRate,
        threshold: this.config.ESCALATION_THRESHOLDS.ERROR_RATE,
        totalErrors: errorReport.summary.totalErrors
      });
    }
  }

  /**
   * Check performance degradation escalation
   */
  checkPerformanceDegradationEscalation() {
    const productionMonitor = this.monitoringSystems.get('productionMonitor');
    if (!productionMonitor) return;

    const monitoringReport = productionMonitor.getMonitoringReport();
    const currentFps = monitoringReport.performance?.global?.frameRate || 60;
    const degradation = ((60 - currentFps) / 60) * 100;

    if (degradation >= this.config.ESCALATION_THRESHOLDS.PERFORMANCE_DEGRADATION) {
      this.createSystemWideEscalation('PERFORMANCE_DEGRADATION', {
        degradation,
        currentFps,
        threshold: this.config.ESCALATION_THRESHOLDS.PERFORMANCE_DEGRADATION
      });
    }
  }

  /**
   * Create system-wide escalation
   */
  createSystemWideEscalation(type, data) {
    const escalationAlert = {
      type,
      category: this.config.ALERT_CATEGORIES.SYSTEM_HEALTH,
      severity: ALERT_SEVERITY.HIGH,
      message: `System-wide escalation triggered: ${type}`,
      data: {
        escalationType: type,
        ...data,
        systemUptime: Date.now() - this.startTime
      }
    };

    this.processAlert(escalationAlert);
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId, acknowledgedBy = 'system') {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      console.warn(`[AlertingSystem] Alert not found for acknowledgment: ${alertId}`);
      return false;
    }

    alert.status = ALERT_STATUS.ACKNOWLEDGED;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = Date.now();

    // Clear escalation timer
    const timer = this.escalationTimers.get(alertId);
    if (timer) {
      clearTimeout(timer);
      this.escalationTimers.delete(alertId);
    }

    console.log(`[AlertingSystem] Alert acknowledged: ${alertId} by ${acknowledgedBy}`);
    return true;
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId, resolvedBy = 'system') {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      console.warn(`[AlertingSystem] Alert not found for resolution: ${alertId}`);
      return false;
    }

    alert.status = ALERT_STATUS.RESOLVED;
    alert.resolvedBy = resolvedBy;
    alert.resolvedAt = Date.now();

    // Remove from active alerts
    this.activeAlerts.delete(alertId);

    // Clear escalation timer
    const timer = this.escalationTimers.get(alertId);
    if (timer) {
      clearTimeout(timer);
      this.escalationTimers.delete(alertId);
    }

    // Remove from escalated alerts if present
    this.escalatedAlerts.delete(alertId);

    console.log(`[AlertingSystem] Alert resolved: ${alertId} by ${resolvedBy}`);
    return true;
  }

  /**
   * Suppress alert
   */
  suppressAlert(alertId, reason, duration = 3600000) { // Default 1 hour
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      console.warn(`[AlertingSystem] Alert not found for suppression: ${alertId}`);
      return false;
    }

    alert.status = ALERT_STATUS.SUPPRESSED;
    alert.suppressedReason = reason;
    alert.suppressedAt = Date.now();
    alert.suppressionExpires = Date.now() + duration;

    // Store in suppressed alerts
    this.suppressedAlerts.set(alertId, alert);

    // Remove from active alerts
    this.activeAlerts.delete(alertId);

    // Clear escalation timer
    const timer = this.escalationTimers.get(alertId);
    if (timer) {
      clearTimeout(timer);
      this.escalationTimers.delete(alertId);
    }

    // Set up unsuppression timer
    setTimeout(() => {
      this.unsuppressAlert(alertId);
    }, duration);

    console.log(`[AlertingSystem] Alert suppressed: ${alertId} for ${duration}ms - ${reason}`);
    return true;
  }

  /**
   * Unsuppress alert
   */
  unsuppressAlert(alertId) {
    const alert = this.suppressedAlerts.get(alertId);
    if (!alert) return;

    // Check if alert should be reactivated
    if (Date.now() >= alert.suppressionExpires) {
      alert.status = ALERT_STATUS.ACTIVE;
      delete alert.suppressedAt;
      delete alert.suppressionExpires;

      // Move back to active alerts
      this.activeAlerts.set(alertId, alert);
      this.suppressedAlerts.delete(alertId);

      // Set up escalation again
      this.setupEscalation(alert);

      console.log(`[AlertingSystem] Alert unsuppressed: ${alertId}`);
    }
  }

  /**
   * Update alert metrics
   */
  updateAlertMetrics(alert) {
    // Update alert counts by severity and category
    // This would be used for analytics and reporting
  }

  /**
   * Perform cleanup
   */
  performCleanup() {
    const now = Date.now();
    const cutoffTime = now - (this.config.ALERT_RETENTION_HOURS * 60 * 60 * 1000);

    // Clean old alert history
    this.alertHistory = this.alertHistory.filter(alert => alert.timestamp >= cutoffTime);

    // Clean old notification history
    const notificationCutoffTime = now - (this.config.NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    this.notificationHistory = this.notificationHistory.filter(
      notification => notification.timestamp >= notificationCutoffTime
    );

    // Clean expired suppressions
    for (const [alertId, alert] of this.suppressedAlerts) {
      if (now >= alert.suppressionExpires) {
        this.unsuppressAlert(alertId);
      }
    }

    console.log('[AlertingSystem] Cleanup completed');
  }

  /**
   * Get recent alert count
   */
  getRecentAlertCount() {
    const fiveMinutesAgo = Date.now() - 300000;
    return Array.from(this.activeAlerts.values())
      .filter(alert => alert.timestamp >= fiveMinutesAgo)
      .length;
  }

  /**
   * Get current system load
   */
  getCurrentSystemLoad() {
    // This would integrate with system health monitoring
    return {
      activeAlerts: this.activeAlerts.size,
      escalatedAlerts: this.escalatedAlerts.size,
      recentNotifications: this.notificationHistory.filter(
        n => Date.now() - n.timestamp < 60000
      ).length
    };
  }

  /**
   * Get comprehensive alerting report
   */
  getAlertingReport() {
    const now = Date.now();
    const uptime = now - this.startTime;

    return {
      timestamp: now,
      uptime,
      isActive: this.isActive,
      config: this.config,

      // Current alert status
      current: {
        activeAlerts: Array.from(this.activeAlerts.values()),
        escalatedAlerts: Array.from(this.escalatedAlerts.values()),
        suppressedAlerts: Array.from(this.suppressedAlerts.values()),
        queueSize: this.alertQueue.length,
        processingAlerts: this.processingAlerts
      },

      // Alert statistics
      statistics: {
        totalAlerts: this.alertHistory.length,
        alertsBySeverity: this.getAlertsBySeverity(),
        alertsByCategory: this.getAlertsByCategory(),
        averageResolutionTime: this.getAverageResolutionTime(),
        escalationRate: this.getEscalationRate()
      },

      // Notification status
      notifications: {
        totalSent: this.notificationHistory.length,
        successRate: this.getNotificationSuccessRate(),
        channelStatus: this.getChannelStatus(),
        recentFailures: this.getRecentNotificationFailures()
      },

      // System health
      health: {
        alertRate: this.getAlertRate(),
        systemLoad: this.getCurrentSystemLoad(),
        rateLimitStatus: this.getRateLimitStatus(),
        deduplicationEfficiency: this.getDeduplicationEfficiency()
      },

      // Recent activity
      recent: {
        alerts: this.alertHistory.slice(-20),
        notifications: this.notificationHistory.slice(-50),
        escalations: this.getRecentEscalations()
      }
    };
  }

  /**
   * Get alerts by severity
   */
  getAlertsBySeverity() {
    const counts = {};
    for (const severity of Object.values(ALERT_SEVERITY)) {
      counts[severity] = this.alertHistory.filter(alert => alert.severity === severity).length;
    }
    return counts;
  }

  /**
   * Get alerts by category
   */
  getAlertsByCategory() {
    const counts = {};
    for (const category of Object.values(this.config.ALERT_CATEGORIES)) {
      counts[category] = this.alertHistory.filter(alert => alert.category === category).length;
    }
    return counts;
  }

  /**
   * Get average resolution time
   */
  getAverageResolutionTime() {
    const resolvedAlerts = this.alertHistory.filter(alert => alert.resolvedAt);
    if (resolvedAlerts.length === 0) return 0;

    const totalResolutionTime = resolvedAlerts.reduce(
      (sum, alert) => sum + (alert.resolvedAt - alert.timestamp), 0
    );
    return totalResolutionTime / resolvedAlerts.length;
  }

  /**
   * Get escalation rate
   */
  getEscalationRate() {
    if (this.alertHistory.length === 0) return 0;
    const escalatedCount = this.alertHistory.filter(alert => alert.escalationLevel > 0).length;
    return (escalatedCount / this.alertHistory.length) * 100;
  }

  /**
   * Get notification success rate
   */
  getNotificationSuccessRate() {
    if (this.notificationHistory.length === 0) return 100;
    const successCount = this.notificationHistory.filter(n => n.status === 'SUCCESS').length;
    return (successCount / this.notificationHistory.length) * 100;
  }

  /**
   * Get channel status
   */
  getChannelStatus() {
    const status = {};
    for (const [name, channel] of this.notificationChannels) {
      status[name] = {
        enabled: channel.enabled,
        type: channel.type,
        recentSuccesses: this.notificationHistory.filter(
          n => n.channel === name && n.status === 'SUCCESS' &&
               Date.now() - n.timestamp < 3600000
        ).length,
        recentFailures: this.notificationHistory.filter(
          n => n.channel === name && n.status === 'FAILED' &&
               Date.now() - n.timestamp < 3600000
        ).length
      };
    }
    return status;
  }

  /**
   * Get recent notification failures
   */
  getRecentNotificationFailures() {
    const oneHourAgo = Date.now() - 3600000;
    return this.notificationHistory.filter(
      n => n.status === 'FAILED' && n.timestamp >= oneHourAgo
    );
  }

  /**
   * Get alert rate
   */
  getAlertRate() {
    const oneHourAgo = Date.now() - 3600000;
    const recentAlerts = this.alertHistory.filter(alert => alert.timestamp >= oneHourAgo);
    return recentAlerts.length; // alerts per hour
  }

  /**
   * Get rate limit status
   */
  getRateLimitStatus() {
    const currentMinute = Math.floor(Date.now() / 60000);
    const currentCount = this.alertCounts.get(currentMinute) || 0;

    return {
      currentCount,
      limit: this.config.MAX_ALERTS_PER_MINUTE,
      utilization: (currentCount / this.config.MAX_ALERTS_PER_MINUTE) * 100,
      resetTime: (currentMinute + 1) * 60000
    };
  }

  /**
   * Get deduplication efficiency
   */
  getDeduplicationEfficiency() {
    // This would track how many alerts were successfully deduplicated
    return 0; // Placeholder
  }

  /**
   * Get recent escalations
   */
  getRecentEscalations() {
    const oneHourAgo = Date.now() - 3600000;
    return Array.from(this.escalatedAlerts.values())
      .filter(alert => alert.escalationTime >= oneHourAgo);
  }

  /**
   * Cleanup and destroy alerting system
   */
  destroy() {
    this.stopAlerting();

    // Clear all data
    this.activeAlerts.clear();
    this.alertHistory = [];
    this.suppressedAlerts.clear();
    this.escalatedAlerts.clear();
    this.alertQueue = [];
    this.alertDeduplication.clear();
    this.alertCounts.clear();
    this.escalationTimers.clear();
    this.escalationPolicies.clear();
    this.notificationChannels.clear();
    this.notificationHistory = [];
    this.notificationFailures.clear();
    this.deliveryStatus.clear();
    this.monitoringSystems.clear();

    console.log('[AlertingSystem] Production alerting system destroyed');
  }
}

/**
 * Global alerting system instance
 */
let globalAlertingSystem = null;

/**
 * Get or create global alerting system instance
 */
export function getAlertingSystem(config = {}) {
  if (!globalAlertingSystem) {
    globalAlertingSystem = new ProductionAlertingSystem(config);
  }
  return globalAlertingSystem;
}

/**
 * Initialize production alerting system with default configuration
 */
export function initializeProductionAlerting(config = {}) {
  const alerting = getAlertingSystem(config);
  alerting.startAlerting();
  return alerting;
}