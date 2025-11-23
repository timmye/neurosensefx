# Browser Monitoring System for Professional Trading

A comprehensive performance monitoring system designed specifically for professional FX trading environments. Provides real-time visibility into browser performance, automated alerting for performance issues, and validation against professional trading requirements.

## Features

### 🔍 Real Browser Process Monitoring
- **Memory Usage Tracking**: Real JavaScript heap monitoring with leak detection
- **CPU Performance**: Main thread blocking detection and jank measurement
- **Frame Rate Analysis**: Precise 60fps rendering validation
- **Network Monitoring**: WebSocket latency and connection quality tracking
- **Process Health**: Browser tab resource consumption monitoring

### 📊 Live Performance Dashboard
- **Real-time Metrics**: Live frame rate, memory, latency displays
- **Visual Charts**: Mini charts for performance trends
- **Trading Requirements**: Professional trading grade validation
- **Alert Integration**: Real-time performance alert display
- **Responsive Design**: Adaptable to different screen sizes

### 🎯 Professional Trading Validation
- **60fps Rendering**: Ensures smooth price movement visualization
- **Sub-100ms Latency**: Validates real-time market data display
- **8+ Hour Sessions**: Extended trading session stability testing
- **20+ Displays**: Multi-instrument monitoring capability validation
- **Professional Standards**: Trading-specific performance requirements

### 🚨 Automated Alerting & Reporting
- **Critical Alerts**: Immediate notification of performance failures
- **Trend Analysis**: Performance degradation detection
- **Periodic Reports**: Automated performance summaries
- **Recommendations**: Actionable performance optimization suggestions
- **Historical Tracking**: Performance baseline and trend monitoring

## Quick Start

### Basic Usage

```javascript
import { startMonitoring } from './monitoring/index.js';

// Start monitoring with defaults
const monitoring = startMonitoring();

// Access monitoring components
const { browserMonitor, performanceDashboard, alertingSystem } = monitoring;
```

### Advanced Configuration

```javascript
import { initializeMonitoring } from './monitoring/index.js';

const monitoring = initializeMonitoring({
  autoStart: false, // Don't auto-start

  dashboard: {
    enabled: true,
    compactMode: false,
    updateInterval: 1000,
    showCharts: true
  },

  alerting: {
    enabled: true,
    reportInterval: 5 * 60 * 1000, // 5 minutes
    enableNotifications: true
  },

  validation: {
    enabled: true,
    autoRun: false, // Don't auto-run validation
    scenarios: ['highFrequencyData', 'multiDisplayStress']
  }
});

// Start when ready
await monitoring.start();
```

### Production vs Development

```javascript
// Production monitoring (minimal UI, maximum stability)
import { createProductionMonitoring } from './monitoring/index.js';
const productionMonitoring = createProductionMonitoring();

// Development monitoring (full UI, detailed diagnostics)
import { createDevelopmentMonitoring } from './monitoring/index.js';
const devMonitoring = createDevelopmentMonitoring();
```

## Professional Trading Requirements

The system validates against these critical trading performance standards:

| Requirement | Target | Minimum | Critical Impact |
|-------------|--------|---------|-----------------|
| Frame Rate | 60 FPS | 45 FPS | Price visualization stutter |
| Data Latency | <50ms | <100ms | Delayed trading decisions |
| Memory Stability | <2MB/hr | <5MB/hr | Session crashes |
| Session Duration | 8+ hours | 4+ hours | Trading day coverage |
| Concurrent Displays | 20+ | 15+ | Multi-instrument monitoring |

## Components

### BrowserProcessMonitor

Core monitoring engine that tracks browser performance:

```javascript
import { browserMonitor } from './monitoring/browserProcessMonitor.js';

// Start monitoring
browserMonitor.start();

// Get current snapshot
const snapshot = browserMonitor.getCurrentSnapshot();

// Get comprehensive report
const report = browserMonitor.stop();
```

### PerformanceDashboard

Real-time visual monitoring interface:

```javascript
import { performanceDashboard } from './monitoring/performanceDashboard.js';

// Initialize dashboard
performanceDashboard.initialize('#dashboard-container');

// Toggle visibility
performanceDashboard.toggle();

// Set compact mode
performanceDashboard.setCompactMode(true);
```

### TradingPerformanceValidator

Professional trading requirements validation:

```javascript
import { tradingValidator } from './monitoring/tradingPerformanceValidator.js';

// Run validation
const report = await tradingValidator.startValidation({
  scenarios: ['highFrequencyData', 'multiDisplayStress']
});

// Check professional validation
console.log('Professional Grade:', report.professionalValidation);
```

### AlertingSystem

Automated alerting and reporting:

```javascript
import { alertingSystem } from './monitoring/alertingSystem.js';

// Start alerting
alertingSystem.start();

// Subscribe to alerts
alertingSystem.subscribe('alert:triggered', (alert) => {
  console.warn('Performance Alert:', alert.message);
});

// Get recent alerts
const alerts = alertingSystem.getRecentAlerts(10);
```

## Test Scenarios

### High-Frequency Data Test
Simulates rapid market data updates during volatile conditions:
- 100 updates per second for 1 minute
- Validates frame rate and latency under load
- Detects memory growth during high-frequency updates

### Multi-Display Stress Test
Tests performance with multiple trading displays:
- Creates 25 concurrent displays
- Updates each display 30 times per second
- Validates memory usage and frame rate degradation

### Extended Session Test
Accelerated 8-hour trading session simulation:
- 5-minute test representing 8 hours (96x acceleration)
- Monitors memory leak detection
- Validates performance degradation over time

### Rapid Interaction Test
Validates UI responsiveness during active trading:
- 10 user interactions per second
- Measures response times
- Detects main thread blocking

## API Reference

### Monitoring System API

```javascript
const monitoring = initializeMonitoring();

// Control
await monitoring.start();
monitoring.stop();

// Dashboard
monitoring.toggleDashboard();
monitoring.showDashboard();
monitoring.hideDashboard();

// Validation
const report = await monitoring.runValidation();

// Data
const snapshot = monitoring.getSnapshot();
const tradingStatus = monitoring.getTradingStatus();
const fullReport = await monitoring.exportReport();

// Events
monitoring.subscribe('alert:triggered', callback);
monitoring.subscribe('report:generated', callback);
monitoring.subscribe('validation:completed', callback);
```

### Browser Monitor API

```javascript
// Control
browserMonitor.start();
const report = browserMonitor.stop();

// Real-time data
const snapshot = browserMonitor.getCurrentSnapshot();
const metrics = browserMonitor.extractCurrentMetrics();

// Historical data
const frameRateHistory = browserMonitor.processHealth.frameRate;
const memorySnapshots = browserMonitor.memorySnapshots;
```

### Alerting System API

```javascript
// Control
alertingSystem.start();
alertingSystem.stop();

// Alerts
const alerts = alertingSystem.getRecentAlerts(50);
const acknowledged = alertingSystem.acknowledgeAlert(alertId);
const resolved = alertingSystem.resolveAlert(alertId);

// Reports
const reports = alertingSystem.getRecentReports(10);

// Events
alertingSystem.subscribe('alert:triggered', callback);
alertingSystem.subscribe('report:generated', callback);
```

## Performance Metrics

### Frame Rate Metrics
- **Current FPS**: Real-time frame rate
- **Average FPS**: Rolling average over window
- **Frame Drops**: Frames below target threshold
- **Jank Events**: Long tasks blocking rendering

### Memory Metrics
- **Current Usage**: JavaScript heap size in MB
- **Growth Rate**: Memory increase over time (MB/min)
- **Peak Usage**: Maximum memory consumption
- **Leak Detection**: Suspicious growth patterns

### Latency Metrics
- **WebSocket Latency**: Round-trip message time
- **Network Quality**: Connection type and RTT
- **Processing Time**: Data handling duration
- **Queue Depth**: Pending message count

### System Metrics
- **CPU Usage**: Main thread utilization
- **Response Time**: UI interaction latency
- **Connection Health**: WebSocket stability
- **Process Health**: Browser tab resource usage

## Testing

### End-to-End Tests

```bash
# Run monitoring system tests
npm run test:e2e:monitoring

# Run individual test suites
npm run test:e2e:monitoring -- --grep "Browser Process Monitor"
npm run test:e2e:monitoring -- --grep "Performance Dashboard"
npm run test:e2e:monitoring -- --grep "Professional Trading Validation"
```

### Test Page

Open `src/lib/monitoring/test-page.html` in your browser to:
- Test all monitoring components
- Run performance validation scenarios
- Generate comprehensive reports
- Visualize real-time metrics

## Integration

### With NeuroSense FX

The monitoring system integrates seamlessly with the trading platform:

```javascript
// In main application
import { createProductionMonitoring } from './monitoring/index.js';

// Initialize monitoring for production
const monitoring = createProductionMonitoring();

// Monitor trading-specific components
monitoring.subscribe('alert:triggered', (alert) => {
  // Handle performance alerts in trading context
  if (alert.category === 'trading') {
    // Critical trading performance issue
    showTradingAlert(alert);
  }
});
```

### Custom Metrics

Add custom monitoring for trading-specific components:

```javascript
// Subscribe to monitoring events
monitoring.subscribe('metric:updated', ({ type, data }) => {
  if (type === 'frameRate' && data.value < 55) {
    // Trading performance impacted
    reduceDisplayComplexity();
  }
});
```

## Troubleshooting

### Common Issues

**Dashboard not showing:**
- Ensure DOM is loaded before initializing
- Check container element exists
- Verify `dashboard.enabled: true` in config

**No frame rate data:**
- Requires browser animation activity
- Check PerformanceObserver support
- Ensure `requestAnimationFrame` is used

**High memory usage detected:**
- Check for memory leaks in event listeners
- Verify canvas context cleanup
- Monitor WebSocket connection lifecycle

**Validation hanging:**
- Test scenarios may take several minutes
- Check browser console for errors
- Reduce scenario complexity for testing

### Performance Impact

The monitoring system is designed for minimal performance impact:
- <1% CPU overhead during normal operation
- <5MB memory usage for monitoring data
- Non-blocking alert and report generation
- Optimized for 60fps applications

## License

This monitoring system is part of the NeuroSense FX trading platform and follows the same licensing terms.

## Contributing

When contributing to the monitoring system:

1. Maintain professional trading performance standards
2. Ensure minimal impact on application performance
3. Add comprehensive tests for new features
4. Update documentation for API changes
5. Validate against all test scenarios

## Support

For issues and questions about the monitoring system:

1. Check the test page for component functionality
2. Review browser console for error messages
3. Run E2E tests to verify system health
4. Consult the API reference for proper usage

---

**Note**: This monitoring system is specifically designed for professional FX trading environments where performance directly impacts trading decisions and financial outcomes.