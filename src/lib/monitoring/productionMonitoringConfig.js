/**
 * Production Monitoring Configuration
 *
 * Central configuration for all production monitoring systems.
 * Adjust these settings based on your specific deployment requirements.
 */

/**
 * Production environment configuration
 */
export const PRODUCTION_ENVIRONMENT_CONFIG = {
  // Production monitoring infrastructure
  production: {
    // Real-time monitoring settings
    ALERT_CHECK_INTERVAL: 100,
    PERFORMANCE_SAMPLE_RATE: 1.0,
    ERROR_RETENTION_HOURS: 24 * 7,
    METRICS_BATCH_SIZE: 100,
    METRICS_FLUSH_INTERVAL: 5000,

    // Performance thresholds (production-strict)
    CRITICAL_FPS_THRESHOLD: 45,
    WARNING_FPS_THRESHOLD: 55,
    CRITICAL_LATENCY_MS: 150,
    WARNING_LATENCY_MS: 100,
    CRITICAL_MEMORY_MB: 1024,
    WARNING_MEMORY_MB: 768,

    // System health thresholds
    MAX_ERROR_RATE_PER_MINUTE: 10,
    MAX_WARNING_RATE_PER_MINUTE: 30,
    MAX_DISPLAY_COUNT: 50,
    MAX_WEBSOCKET_RECONNECTS_PER_MINUTE: 5,

    // Data privacy
    ANONYMIZE_USER_DATA: true,
    DATA_RETENTION_DAYS: 30,
    GDPR_COMPLIANT: true,

    // Integration
    ENABLE_ALERTS: true,
    ALERT_COOLDOWN_MS: 30000,
    MAX_ALERTS_PER_MINUTE: 20
  },

  // Error monitoring configuration
  error: {
    // Capture settings
    CAPTURE_UNHANDLED_PROMISES: true,
    CAPTURE_NETWORK_ERRORS: true,
    CAPTURE_RENDERING_ERRORS: true,
    CAPTURE_CONSOLE_ERRORS: true,
    CAPTURE_USER_INTERACTION_ERRORS: true,

    // Categorization
    ENABLE_AUTO_CATEGORIZATION: true,
    ENABLE_ERROR_CORRELATION: true,
    ENABLE_ROOT_CAUSE_ANALYSIS: true,

    // Prioritization
    CRITICAL_ERROR_THRESHOLD: 5,
    HIGH_ERROR_THRESHOLD: 10,
    MEDIUM_ERROR_THRESHOLD: 20,

    // Resolution workflow
    ENABLE_AUTO_RESOLUTION: true,
    ENABLE_ERROR_ESCALATION: true,
    ESCALATION_TIME_MINUTES: 15,
    MAX_RESOLUTION_ATTEMPTS: 3,

    // Data retention
    ERROR_RETENTION_DAYS: 30,
    RESOLUTION_HISTORY_RETENTION_DAYS: 90,

    // Privacy
    ANONYMIZE_USER_DATA: true,
    SANITIZE_STACK_TRACES: true,
    EXCLUDE_SENSITIVE_FIELDS: ['password', 'token', 'apiKey', 'secret'],

    // Integration
    ENABLE_EXTERNAL_LOGGING: true,
    LOGGING_ENDPOINT: process.env.VITE_ERROR_LOGGING_ENDPOINT || null,
    MAX_BATCH_SIZE: 50,
    BATCH_FLUSH_INTERVAL: 5000
  },

  // Trading operations monitoring
  tradingOps: {
    // Workflow monitoring
    MONITOR_DISPLAY_CREATION: true,
    MONITOR_DISPLAY_INTERACTIONS: true,
    MONITOR_KEYBOARD_SHORTCUTS: true,
    MONITOR_DATA_UPDATES: true,
    MONITOR_USER_SESSIONS: true,

    // Performance thresholds (trading-optimized)
    KEYBOARD_SHORTCUT_LATENCY_MS: 50,
    DISPLAY_CREATION_LATENCY_MS: 200,
    DATA_UPDATE_LATENCY_MS: 100,
    USER_INTERACTION_LATENCY_MS: 100,

    // Session monitoring
    SESSION_TIMEOUT_MINUTES: 30,
    MAX_IDLE_TIME_MINUTES: 15,
    MIN_ACTIVE_TIME_MINUTES: 5,

    // Trading-specific
    MONITOR_MARKET_DATA_FLOW: true,
    MONITOR_SYMBOL_CHANGES: true,
    MONITOR_WORKFLOW_COMPLETION: true,
    MONITOR_ERROR_RECOVERY: true,

    // Analytics
    TRACK_USER_PATTERNS: true,
    TRACK_WORKFLOW_EFFICIENCY: true,
    TRACK_FEATURE_ADOPTION: true,
    TRACK_PERFORMANCE_METRICS: true,

    // Data retention
    SESSION_RETENTION_DAYS: 7,
    WORKFLOW_RETENTION_DAYS: 30,
    ANALYTICS_RETENTION_DAYS: 90,

    // Privacy
    ANONYMIZE_USER_DATA: true,
    GDPR_COMPLIANT: true
  },

  // System health monitoring
  systemHealth: {
    // Resource monitoring
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
    CRITICAL_MEMORY_THRESHOLD: 90,
    WARNING_MEMORY_THRESHOLD: 75,
    CRITICAL_CPU_THRESHOLD: 95,
    WARNING_CPU_THRESHOLD: 80,
    MIN_FRAME_RATE: 30,
    TARGET_FRAME_RATE: 60,
    MAX_GC_PAUSE_MS: 50,
    MAX_EVENT_LOOP_LAG_MS: 100,

    // Maintenance
    ENABLE_AUTO_OPTIMIZATION: true,
    ENABLE_PROACTIVE_CLEANUP: true,
    CLEANUP_INTERVAL_MINUTES: 15,
    OPTIMIZATION_THRESHOLD: 85,

    // Data retention
    HEALTH_HISTORY_RETENTION_HOURS: 24,
    METRICS_RETENTION_DAYS: 7,
    ALERT_RETENTION_DAYS: 3,

    // Reporting
    ENABLE_HEALTH_REPORTS: true,
    REPORT_INTERVAL_MINUTES: 30,
    ENABLE_TREND_ANALYSIS: true
  },

  // Analytics configuration
  analytics: {
    // Analytics settings
    ENABLE_USER_BEHAVIOR_ANALYSIS: true,
    ENABLE_PERFORMANCE_TREND_ANALYSIS: true,
    ENABLE_TRADING_INSIGHTS: true,
    ENABLE_CAPACITY_PLANNING: true,

    // Reporting
    ENABLE_AUTOMATED_REPORTS: true,
    REPORT_GENERATION_INTERVAL_HOURS: 1,
    REPORT_RETENTION_DAYS: 30,
    ENABLE_EMAIL_REPORTS: false,
    ENABLE_WEBHOOK_REPORTS: false,

    // Data aggregation
    AGGREGATION_WINDOW_MINUTES: 15,
    TREND_ANALYSIS_WINDOW_HOURS: 24,
    COMPARISON_WINDOW_DAYS: 7,

    // Analysis thresholds
    PERFORMANCE_DEGRADATION_THRESHOLD: 10,
    USER_ENGAGEMENT_THRESHOLD: 60,
    SYSTEM_UTILIZATION_THRESHOLD: 80,

    // Insights
    ENABLE_PREDICTIVE_ANALYTICS: true,
    ENABLE_ANOMALY_DETECTION: true,
    ENABLE_OPTIMIZATION_RECOMMENDATIONS: true,

    // Data privacy
    ANONYMIZE_USER_DATA: true,
    GDPR_COMPLIANT: true,
    MIN_AGGREGATION_COUNT: 5,

    // Export
    ENABLE_CSV_EXPORT: true,
    ENABLE_JSON_EXPORT: true,
    ENABLE_PDF_REPORTS: false,
    EXPORT_RETENTION_DAYS: 90
  },

  // Alerting configuration
  alerting: {
    // Alert settings
    ENABLE_REAL_TIME_ALERTING: true,
    ALERT_LATENCY_TARGET_MS: 100,
    MAX_ALERTS_PER_MINUTE: 50,
    ALERT_DEDUPlication_WINDOW_MS: 30000,

    // Notification channels
    ENABLE_CONSOLE_NOTIFICATIONS: true,
    ENABLE_EXTERNAL_NOTIFICATIONS: false, // Disabled by default in production
    ENABLE_WEBHOOK_NOTIFICATIONS: false,
    ENABLE_EMAIL_NOTIFICATIONS: false,

    // External notification settings
    NOTIFICATION_ENDPOINT: process.env.VITE_NOTIFICATION_ENDPOINT || null,
    NOTIFICATION_API_KEY: process.env.VITE_NOTIFICATION_API_KEY || null,
    NOTIFICATION_TIMEOUT_MS: 5000,
    NOTIFICATION_RETRY_ATTEMPTS: 3,

    // Webhook settings
    WEBHOOK_ENDPOINTS: process.env.VITE_WEBHOOK_ENDPOINTS ?
      process.env.VITE_WEBHOOK_ENDPOINTS.split(',') : [],
    WEBHOOK_TIMEOUT_MS: 10000,
    WEBHOOK_RETRY_ATTEMPTS: 3,

    // Severity thresholds
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

    // Escalation
    ENABLE_AUTOMATIC_ESCALATION: true,
    ESCALATION_THRESHOLDS: {
      ALERT_COUNT: 10,
      ERROR_RATE: 0.1,
      PERFORMANCE_DEGRADATION: 20
    },

    // Retention
    ALERT_RETENTION_HOURS: 24,
    NOTIFICATION_RETENTION_DAYS: 7,

    // Privacy
    SANITIZE_ALERT_DATA: true,
    EXCLUDE_SENSITIVE_INFO: ['password', 'token', 'apiKey', 'secret']
  }
};

/**
 * Development environment configuration
 */
export const DEVELOPMENT_ENVIRONMENT_CONFIG = {
  // Inherit production config with development overrides
  ...PRODUCTION_ENVIRONMENT_CONFIG,

  // Development-specific overrides
  production: {
    ...PRODUCTION_ENVIRONMENT_CONFIG.production,
    PERFORMANCE_SAMPLE_RATE: 0.1, // Sample 10% in development
    ERROR_RETENTION_HOURS: 2,     // Shorter retention for dev
    METRICS_BATCH_SIZE: 10,       // Smaller batches
    ENABLE_ALERTS: false          // Disable alerts in development
  },

  error: {
    ...PRODUCTION_ENVIRONMENT_CONFIG.error,
    ENABLE_EXTERNAL_LOGGING: false,
    ERROR_RETENTION_DAYS: 1,
    SANITIZE_STACK_TRACES: false  // Keep full stack traces in dev
  },

  tradingOps: {
    ...PRODUCTION_ENVIRONMENT_CONFIG.tradingOps,
    SESSION_RETENTION_DAYS: 1,
    ANONYMIZE_USER_DATA: false   // Don't anonymize in dev
  },

  systemHealth: {
    ...PRODUCTION_ENVIRONMENT_CONFIG.systemHealth,
    METRICS_RETENTION_DAYS: 1,
    ENABLE_AUTO_OPTIMIZATION: false,
    CLEANUP_INTERVAL_MINUTES: 5
  },

  analytics: {
    ...PRODUCTION_ENVIRONMENT_CONFIG.analytics,
    ENABLE_AUTOMATED_REPORTS: false,
    REPORT_RETENTION_DAYS: 1,
    ANONYMIZE_USER_DATA: false
  },

  alerting: {
    ...PRODUCTION_ENVIRONMENT_CONFIG.alerting,
    ENABLE_REAL_TIME_ALERTING: false,
    MAX_ALERTS_PER_MINUTE: 5,
    ENABLE_EXTERNAL_NOTIFICATIONS: false
  }
};

/**
 * Test environment configuration
 */
export const TEST_ENVIRONMENT_CONFIG = {
  // Minimal monitoring for tests
  production: {
    ALERT_CHECK_INTERVAL: 1000,     // Slower in tests
    PERFORMANCE_SAMPLE_RATE: 0.01,  // Minimal sampling
    ERROR_RETENTION_HOURS: 1,
    ENABLE_ALERTS: false
  },

  error: {
    CAPTURE_UNHANDLED_PROMISES: true,
    CAPTURE_NETWORK_ERRORS: false,
    CAPTURE_CONSOLE_ERRORS: true,
    ENABLE_EXTERNAL_LOGGING: false,
    ERROR_RETENTION_DAYS: 0.1, // 2.4 hours
    SANITIZE_STACK_TRACES: false
  },

  tradingOps: {
    MONITOR_DISPLAY_CREATION: true,
    MONITOR_KEYBOARD_SHORTCUTS: false,
    MONITOR_USER_SESSIONS: false,
    SESSION_RETENTION_DAYS: 0.1,
    ANONYMIZE_USER_DATA: false
  },

  systemHealth: {
    MONITOR_MEMORY_USAGE: true,
    MONITOR_FRAME_RATE: false,
    METRICS_RETENTION_DAYS: 0.1,
    ENABLE_AUTO_OPTIMIZATION: false
  },

  analytics: {
    ENABLE_USER_BEHAVIOR_ANALYSIS: false,
    ENABLE_PERFORMANCE_TREND_ANALYSIS: false,
    ENABLE_AUTOMATED_REPORTS: false,
    REPORT_RETENTION_DAYS: 0.1
  },

  alerting: {
    ENABLE_REAL_TIME_ALERTING: false,
    ENABLE_CONSOLE_NOTIFICATIONS: true,
    MAX_ALERTS_PER_MINUTE: 2
  }
};

/**
 * Get configuration based on environment
 */
export function getMonitoringConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development';

  switch (nodeEnv) {
    case 'production':
      return PRODUCTION_ENVIRONMENT_CONFIG;
    case 'test':
      return TEST_ENVIRONMENT_CONFIG;
    case 'development':
    default:
      return DEVELOPMENT_ENVIRONMENT_CONFIG;
  }
}

/**
 * Environment-specific overrides
 */
export function applyEnvironmentOverrides(config) {
  const overrides = {};

  // Apply environment variable overrides
  if (process.env.VITE_MONITORING_ENABLED === 'false') {
    overrides.production = { ...overrides.production, ENABLE_ALERTS: false };
    overrides.error = { ...overrides.error, ENABLE_EXTERNAL_LOGGING: false };
    overrides.alerting = { ...overrides.alerting, ENABLE_REAL_TIME_ALERTING: false };
  }

  if (process.env.VITE_EXTERNAL_LOGGING_ENDPOINT) {
    overrides.error = {
      ...overrides.error,
      ENABLE_EXTERNAL_LOGGING: true,
      LOGGING_ENDPOINT: process.env.VITE_EXTERNAL_LOGGING_ENDPOINT
    };
  }

  if (process.env.VITE_NOTIFICATION_ENDPOINT) {
    overrides.alerting = {
      ...overrides.alerting,
      ENABLE_EXTERNAL_NOTIFICATIONS: true,
      NOTIFICATION_ENDPOINT: process.env.VITE_NOTIFICATION_ENDPOINT,
      NOTIFICATION_API_KEY: process.env.VITE_NOTIFICATION_API_KEY
    };
  }

  // Apply overrides to config
  const finalConfig = { ...config };
  for (const [system, systemOverrides] of Object.entries(overrides)) {
    if (finalConfig[system]) {
      finalConfig[system] = { ...finalConfig[system], ...systemOverrides };
    }
  }

  return finalConfig;
}

/**
 * Get final monitoring configuration with environment overrides
 */
export function getFinalMonitoringConfig() {
  const baseConfig = getMonitoringConfig();
  return applyEnvironmentOverrides(baseConfig);
}