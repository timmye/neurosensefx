# Production Monitoring System

Comprehensive production monitoring and alerting for the NeuroSense FX trading platform. This system provides real-time performance monitoring, error tracking, user behavior analytics, and proactive issue detection.

## 🚀 Quick Start

### Basic Usage

```javascript
import { quickStartMonitoring } from '@/lib/monitoring';

// Initialize monitoring for production
const monitoring = await quickStartMonitoring();

// Use monitoring helpers
monitoring.helpers.reportError(new Error('Something went wrong'));
monitoring.helpers.trackUserAction('button_click', { button: 'save' });

// Get monitoring status
const status = monitoring.helpers.getStatus();
console.log('System health:', status.globalHealth);
```

### Environment-Specific Initialization

```javascript
import {
  initializeProductionMonitoring,
  initializeDevelopmentMonitoring,
  autoInitializeMonitoring
} from '@/lib/monitoring';

// Production - Full monitoring
const prodMonitoring = await initializeProductionMonitoring();

// Development - Lightweight monitoring
const devMonitoring = await initializeDevelopmentMonitoring();

// Auto - Based on NODE_ENV
const autoMonitoring = await autoInitializeMonitoring();
```

### Svelte Application Integration

```javascript
// In your main.js or App.svelte
import { initializeSvelteMonitoring } from '@/lib/monitoring';

const { monitoringManager, helpers } = await initializeSvelteMonitoring();

// Use in components
helpers.trackComponentRender('MyComponent', renderTime);
helpers.trackStoreUpdate('myStore', updateCount);
```

## 📊 Monitoring Components

### 1. Production Monitoring Infrastructure
- **Real-time performance tracking** with <100ms alerting latency
- **60fps rendering monitoring** and optimization
- **Memory usage tracking** with threshold alerts
- **WebSocket connection stability** monitoring

### 2. Error Monitoring System
- **100% error capture** and categorization
- **Error correlation** and root cause analysis
- **Resolution workflow** with automatic escalation
- **GDPR-compliant** error logging

### 3. Trading Operations Monitor
- **User behavior tracking** and analytics
- **Keyboard shortcut performance** monitoring
- **Trading workflow efficiency** analysis
- **Session management** and engagement metrics

### 4. System Health Monitor
- **Resource monitoring** (CPU, memory, network)
- **Browser performance** tracking
- **Component lifecycle** management
- **Proactive maintenance** and optimization

### 5. Production Analytics System
- **Performance trend analysis** and reporting
- **User behavior insights** and recommendations
- **Automated report generation** and scheduling
- **Predictive analytics** and anomaly detection

### 6. Production Alerting System
- **Real-time alerting** with <100ms latency
- **Multi-channel notifications** (console, webhooks, APIs)
- **Alert escalation** and de-escalation workflows
- **Rate limiting** and deduplication

## ⚙️ Configuration

### Environment-Specific Configurations

The system automatically adjusts based on `NODE_ENV`:

- **Production**: Full monitoring with external logging
- **Development**: Reduced monitoring with full stack traces
- **Test**: Minimal monitoring with lowest overhead

### Custom Configuration

```javascript
import { initializeProductionMonitoring } from '@/lib/monitoring';

const customConfig = {
  production: {
    CRITICAL_FPS_THRESHOLD: 50,
    ALERT_COOLDOWN_MS: 60000
  },
  alerting: {
    ENABLE_WEBHOOK_NOTIFICATIONS: true,
    WEBHOOK_ENDPOINTS: ['https://your-webhook.example.com']
  }
};

const monitoring = await initializeProductionMonitoring(customConfig);
```

### Environment Variables

```bash
# Error logging
VITE_ERROR_LOGGING_ENDPOINT=https://your-error-service.com/api/errors

# Notifications
VITE_NOTIFICATION_ENDPOINT=https://your-notification-service.com/api/alerts
VITE_NOTIFICATION_API_KEY=your-api-key

# Webhooks
VITE_WEBHOOK_ENDPOINTS=https://webhook1.example.com,https://webhook2.example.com

# Monitoring control
VITE_MONITORING_ENABLED=false  # Disable all monitoring
```

## 🔧 Advanced Usage

### Function Monitoring

```javascript
import { monitorFunction } from '@/lib/monitoring';

// Automatically monitor function execution
const monitoredFunction = monitorFunction('dataProcessing', async (data) => {
  // Your function code
  return processedData;
});

// Errors and performance will be automatically tracked
const result = await monitoredFunction(myData);
```

### Global Error Handling

```javascript
import { setupGlobalMonitoring, initializeProductionMonitoring } from '@/lib/monitoring';

const monitoring = await initializeProductionMonitoring();
setupGlobalMonitoring(monitoring);

// Now you can use global helpers
window.reportError(new Error('Global error'));
window.trackUserAction('global_action', { type: 'click' });
```

### Health Checks

```javascript
import { performHealthCheck } from '@/lib/monitoring';

const health = await performHealthCheck(monitoring.manager);
console.log('Health status:', health.overall.status);
console.log('Health score:', health.overall.score);
```

### Direct System Access

```javascript
// Access individual monitoring systems
const { systems } = monitoring;

// System health
const healthReport = systems.systemHealth.getSystemHealthReport();

// Error monitoring
const errorReport = systems.error.getErrorReport();

// Trading operations
const tradingReport = systems.tradingOps.getTradingOperationsReport();

// Analytics
const analyticsReport = systems.analytics.getAnalyticsReport();

// Alerting
const alertingReport = systems.alerting.getAlertingReport();
```

## 📈 Monitoring Dashboards

### Real-Time Dashboard

The system provides real-time data for building monitoring dashboards:

```javascript
// Get dashboard data
const report = monitoring.manager.getMonitoringReport();

// Real-time metrics
const realTimeData = {
  systemHealth: report.dashboardData.realTime.systemHealth,
  performance: report.dashboardData.realTime.performance,
  activeAlerts: report.dashboardData.realTime.alerts,
  userActivity: report.dashboardData.realTime.userActivity
};

// Summary metrics
const summary = {
  overallHealth: report.globalHealth.score,
  activeAlerts: report.coordination.globalAlerts.length,
  systemUptime: report.globalHealth.uptime,
  lastUpdate: Date.now()
};
```

### Alert Integration

```javascript
// Create custom alerts
monitoring.helpers.createAlert(
  'CUSTOM_ALERT',
  'HIGH',
  'Custom business logic alert',
  { businessData: 'value' }
);

// Subscribe to alerts (if your alerting system supports it)
if (systems.alerting.onAlert) {
  systems.alerting.onAlert((alert) => {
    console.log('New alert:', alert);
    // Handle alert (send to dashboard, etc.)
  });
}
```

## 🔍 Troubleshooting

### Common Issues

1. **High Memory Usage**: Reduce `PERFORMANCE_SAMPLE_RATE` or retention periods
2. **Too Many Alerts**: Increase `ALERT_COOLDOWN_MS` or adjust thresholds
3. **Performance Impact**: Use development configuration or disable external logging

### Debug Mode

```javascript
// Enable debug logging
const debugConfig = {
  production: {
    ENABLE_ALERTS: false,  // Disable alerts in debug
    PERFORMANCE_SAMPLE_RATE: 0.01  // Minimal sampling
  }
};

const monitoring = await initializeDevelopmentMonitoring(debugConfig);
```

### Performance Tuning

```javascript
// Low-overhead configuration
const lowOverheadConfig = {
  production: {
    ALERT_CHECK_INTERVAL: 1000,  // Slower checking
    PERFORMANCE_SAMPLE_RATE: 0.1,  // 10% sampling
    ERROR_RETENTION_HOURS: 1  // Short retention
  },
  analytics: {
    ENABLE_PREDICTIVE_ANALYTICS: false,
    ENABLE_ANOMALY_DETECTION: false
  }
};
```

## 🚀 Production Deployment

### Best Practices

1. **Configure External Logging**: Set up error logging endpoints
2. **Adjust Thresholds**: Tune thresholds for your specific environment
3. **Monitor Overhead**: Use the built-in performance monitoring
4. **Set Up Webhooks**: Configure alert notifications
5. **Test Failover**: Verify system recovery mechanisms

### Configuration Checklist

```javascript
const productionChecklist = {
  // Error handling
  error: {
    ENABLE_EXTERNAL_LOGGING: true,
    LOGGING_ENDPOINT: 'https://your-error-service.com/api/errors',
    ERROR_RETENTION_DAYS: 30
  },

  // Alerting
  alerting: {
    ENABLE_REAL_TIME_ALERTING: true,
    ENABLE_WEBHOOK_NOTIFICATIONS: true,
    WEBHOOK_ENDPOINTS: ['https://your-alerting.com/webhook']
  },

  // Performance
  production: {
    CRITICAL_FPS_THRESHOLD: 45,
    CRITICAL_MEMORY_MB: 1024,
    ENABLE_ALERTS: true
  }
};
```

## 📚 API Reference

### Main Functions

- `initializeProductionMonitoring(config)` - Start full production monitoring
- `initializeDevelopmentMonitoring(config)` - Start development monitoring
- `initializeTestMonitoring(config)` - Start minimal test monitoring
- `autoInitializeMonitoring(config)` - Auto-detect environment
- `quickStartMonitoring(config)` - Quick production setup
- `createMonitoringHelpers(manager)` - Create helper functions

### Monitoring Helpers

- `helpers.reportError(error, context)` - Report an error
- `helpers.trackUserAction(action, data)` - Track user interaction
- `helpers.trackPerformance(name, fn)` - Monitor function performance
- `helpers.createAlert(type, severity, message, data)` - Create custom alert
- `helpers.getStatus()` - Get comprehensive monitoring status
- `helpers.getHealth()` - Get system health report
- `helpers.getPerformance()` - Get performance metrics

### System Classes

- `ProductionMonitoringInfrastructure` - Core performance monitoring
- `ErrorMonitoringSystem` - Error tracking and analysis
- `TradingOperationsMonitor` - User behavior and workflow tracking
- `SystemHealthMonitor` - Resource and system health monitoring
- `ProductionAnalyticsSystem` - Analytics and reporting
- `ProductionAlertingSystem` - Alerting and notifications
- `ProductionMonitoringManager` - System orchestration and management

## 🛠️ Development

### Architecture

The monitoring system follows a modular architecture:

```
ProductionMonitoringManager (Orchestration)
├── ProductionMonitoringInfrastructure (Core Monitoring)
├── ErrorMonitoringSystem (Error Tracking)
├── TradingOperationsMonitor (User Analytics)
├── SystemHealthMonitor (Resource Monitoring)
├── ProductionAnalyticsSystem (Reporting & Insights)
└── ProductionAlertingSystem (Alerting & Notifications)
```

### Adding Custom Metrics

```javascript
// Add custom performance tracking
monitoring.helpers.trackPerformance('custom_operation', () => {
  // Your custom operation
  return result;
});

// Create custom alerts
monitoring.helpers.createAlert(
  'BUSINESS_RULE_VIOLATION',
  'MEDIUM',
  'Business rule violation detected',
  { ruleId: 'BR001', violation: 'details' }
);
```

### Extending Monitoring

```javascript
// Access individual systems to extend functionality
const { systems } = monitoring;

// Add custom error categorization
systems.error.addCustomCategory('BUSINESS_LOGIC', /business.*error/i);

// Add custom performance markers
systems.production.markCustomMetric('custom_metric', value);
```

## 📄 License

This monitoring system is part of the NeuroSense FX trading platform and follows the same licensing terms.

## 🤝 Contributing

When contributing to the monitoring system:

1. **Test thoroughly** - Add unit and integration tests
2. **Document changes** - Update this README and inline documentation
3. **Consider performance** - Monitor overhead and optimize
4. **Maintain compatibility** - Ensure backward compatibility
5. **Follow patterns** - Use existing architectural patterns

---

For questions or support, please refer to the main NeuroSense FX documentation or contact the development team.