/**
 * ConnectivityMonitor - Real-time network and server connectivity monitoring
 *
 * Provides comprehensive monitoring of:
 * - Internet connectivity status
 * - WebSocket server connection health
 * - Network latency measurements
 * - Symbol data availability tracking
 */

import { writable, derived } from 'svelte/store';
import { wsStatus, availableSymbols } from '../../data/wsClient.js';
import { subscribe, unsubscribe } from '../../data/wsClient.js';
import { displayStore } from '../../stores/displayStore.js';

// Default ping endpoints for connectivity testing
const PING_ENDPOINTS = [
  'https://dns.google/resolve?name=google.com',
  'https://httpbin.org/get',
  'https://api.github.com/rate_limit'
];

// Status thresholds
const LATENCY_THRESHOLDS = {
  GOOD: 50,     // ms
  WARNING: 150, // ms
  ERROR: 500    // ms
};

const PING_INTERVAL = 5000; // 5 seconds
const LATENCY_MEASUREMENT_INTERVAL = 1000; // 1 second

/**
 * Main connectivity store with all status metrics
 */
export const connectivityStore = writable({
  internet: {
    status: 'unknown',     // 'good', 'warning', 'error', 'unknown'
    lastUpdate: Date.now(),
    details: 'Initializing...',
    consecutiveFails: 0
  },
  server: {
    status: 'unknown',
    lastUpdate: Date.now(),
    details: 'Initializing...',
    reconnectAttempts: 0
  },
  symbolData: {
    status: 'unknown',
    lastUpdate: Date.now(),
    details: 'Initializing...',
    symbolCount: 0
  },
  latency: {
    value: 0,              // milliseconds
    status: 'unknown',
    lastUpdate: Date.now(),
    measurements: []       // Last 10 measurements for averaging
  }
});

// Derived store for overall system health
export const systemHealth = derived(connectivityStore, ($connectivity) => {
  const statuses = [
    $connectivity.internet.status,
    $connectivity.server.status,
    $connectivity.symbolData.status
  ];

  const goodCount = statuses.filter(s => s === 'good').length;
  const errorCount = statuses.filter(s => s === 'error').length;

  if (errorCount > 0) return 'error';
  if (goodCount === statuses.length) return 'good';
  if (goodCount > 0) return 'warning';
  return 'unknown';
});

/**
 * Internet Connectivity Monitor
 */
class InternetMonitor {
  constructor() {
    this.isOnline = navigator.onLine;
    this.lastSuccessfulPing = null;
    this.pingInterval = null;

    // Monitor browser online/offline events
    window.addEventListener('online', this.handleOnlineEvent.bind(this));
    window.addEventListener('offline', this.handleOfflineEvent.bind(this));
  }

  async handleOnlineEvent() {
    this.isOnline = true;
    await this.performConnectivityTest();
  }

  async handleOfflineEvent() {
    this.isOnline = false;
    this.updateStatus('error', 'Browser detected offline connection');
  }

  async performConnectivityTest() {
    const startTime = performance.now();

    try {
      // Test multiple endpoints for reliability
      const results = await Promise.allSettled(
        PING_ENDPOINTS.map(endpoint => this.pingEndpoint(endpoint))
      );

      const successfulResults = results.filter(r => r.status === 'fulfilled');

      if (successfulResults.length > 0) {
        const avgLatency = (performance.now() - startTime) / successfulResults.length;
        this.lastSuccessfulPing = Date.now();

        // Determine status based on latency and success rate
        const successRate = successfulResults.length / results.length;
        let status = 'good';
        let details = `Connected (${Math.round(avgLatency)}ms)`;

        if (avgLatency > LATENCY_THRESHOLDS.ERROR) {
          status = 'warning'; // Changed: Use warning instead of error for slow connections
          details = `Slow connection (${Math.round(avgLatency)}ms)`;
        } else if (avgLatency > LATENCY_THRESHOLDS.WARNING || successRate < 0.8) {
          status = 'warning';
          details = `Unstable connection (${Math.round(avgLatency)}ms)`;
        }

        this.updateStatus(status, details);
      } else {
        this.updateStatus('error', 'No internet connectivity detected');
      }
    } catch (error) {
      this.updateStatus('error', `Connectivity test failed: ${error.message}`);
    }
  }

  async pingEndpoint(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    try {
      const response = await fetch(url, {
        method: 'GET',
        mode: 'no-cors', // Avoid CORS issues
        signal: controller.signal,
        cache: 'no-cache'
      });

      clearTimeout(timeoutId);
      return response.ok || response.type === 'opaque'; // opaque = successful no-cors
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  updateStatus(status, details) {
    connectivityStore.update(store => ({
      ...store,
      internet: {
        ...store.internet,
        status,
        lastUpdate: Date.now(),
        details,
        consecutiveFails: status === 'error' ? store.internet.consecutiveFails + 1 : 0
      }
    }));
  }

  start() {
    // Initial test
    this.performConnectivityTest();

    // Periodic testing
    this.pingInterval = setInterval(() => {
      this.performConnectivityTest();
    }, PING_INTERVAL);
  }

  stop() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

/**
 * Server Connection Monitor
 */
class ServerMonitor {
  constructor() {
    this.latencyMeasurements = [];
    this.latencyInterval = null;
    this.currentWsStatus = 'disconnected';
    this.displayState = null; // Store display state for data delay

    // Subscribe to WebSocket status changes
    this.unsubscribeStatus = wsStatus.subscribe(this.handleStatusChange.bind(this));

    // TRADER-FOCUSED: Subscribe to display store for real data delay tracking
    this.unsubscribeDisplay = displayStore.subscribe(this.handleDisplayUpdate.bind(this));
  }

  start() {
    // ServerMonitor starts automatically via subscription, no additional setup needed
    console.log('[ServerMonitor] Started monitoring');
  }

  handleStatusChange(status) {
    this.currentWsStatus = status;
    let statusText = 'good';
    let details = 'Connected';

    switch (status) {
      case 'connected':
        statusText = 'good';
        details = 'WebSocket connected';
        this.startLatencyMeasurement();
        break;
      case 'connecting':
        statusText = 'warning';
        details = 'WebSocket connecting...';
        this.stopLatencyMeasurement();
        break;
      case 'disconnected':
        statusText = 'error';
        details = 'WebSocket disconnected';
        this.stopLatencyMeasurement();
        break;
      case 'error':
        statusText = 'error';
        details = 'WebSocket connection error';
        this.stopLatencyMeasurement();
        break;
      default:
        statusText = 'unknown';
        details = 'Unknown connection status';
        this.stopLatencyMeasurement();
    }

    this.updateStatus(statusText, details);
  }

  handleDisplayUpdate(displayState) {
    // TRADER-FOCUSED: Store display state and update data delay when new tick data arrives
    this.displayState = displayState;
    if (displayState && displayState.lastTickTime > 0) {
      this.updateDataDelay();
    }
  }

  async measureLatency() {
    // TRADER-FOCUSED: We don't measure fake latency anymore
    // Instead, we focus on data delay which matters for trading
    // This function is kept for compatibility but does nothing meaningful
    if (this.currentWsStatus !== 'connected') return;

    // No simulated latency - traders care about data delay, not ping times
    // Real trading decisions are made in seconds, not milliseconds
  }

  updateDataDelay() {
    // TRADER-FOCUSED: Track real data delay from live trading data
    const now = Date.now();
    let dataAge = null;
    let status = 'unknown';
    let details = 'No data available';

    // 🔧 FIXED: Get real data delay from global display store lastTickTime
    if (this.displayState && this.displayState.lastTickTime > 0) {
      // Calculate how old the data is in milliseconds
      dataAge = Math.round((now - this.displayState.lastTickTime));

      if (dataAge <= 1000) {
        status = 'good';
        details = `${dataAge}ms ago - Live data`;
      } else if (dataAge <= 5000) {
        status = 'warning';
        details = `${dataAge}ms ago - Slightly delayed`;
      } else {
        status = 'warning'; // Changed: Use warning instead of error for stale data
        details = `${dataAge}ms ago - Data delayed`;
      }
    } else {
      status = 'error';
      details = 'No recent tick data';
    }

    connectivityStore.update(store => ({
      ...store,
      latency: {
        value: dataAge, // Show actual data age in milliseconds instead of fake latency
        status,
        lastUpdate: now,
        measurements: [dataAge], // Store as single measurement instead of fake array
        details: details // Human-readable description
      }
    }));
  }

  startLatencyMeasurement() {
    if (this.latencyInterval) return;

    // TRADER-FOCUSED: Monitor real data delay instead of fake latency
    this.latencyInterval = setInterval(() => {
      this.updateDataDelay();
    }, LATENCY_MEASUREMENT_INTERVAL);
  }

  stopLatencyMeasurement() {
    if (this.latencyInterval) {
      clearInterval(this.latencyInterval);
      this.latencyInterval = null;
    }
  }

  updateStatus(status, details) {
    connectivityStore.update(store => ({
      ...store,
      server: {
        ...store.server,
        status,
        lastUpdate: Date.now(),
        details
      }
    }));
  }

  destroy() {
    this.stopLatencyMeasurement();
    if (this.unsubscribeStatus) {
      this.unsubscribeStatus();
    }
  }
}

/**
 * Symbol Data Monitor
 */
class SymbolDataMonitor {
  constructor() {
    this.unsubscribeSymbols = null;
  }

  start() {
    // Monitor available symbols
    this.unsubscribeSymbols = availableSymbols.subscribe(this.handleSymbolsChange.bind(this));
  }

  handleSymbolsChange(symbols) {
    const symbolCount = symbols.length;
    let status = 'good';
    let details = `${symbolCount} symbols available`;

    if (symbolCount === 0) {
      status = 'error';
      details = 'No symbols available';
    } else if (symbolCount < 5) {
      status = 'warning';
      details = `Limited symbols available (${symbolCount})`;
    }

    connectivityStore.update(store => ({
      ...store,
      symbolData: {
        ...store.symbolData,
        status,
        lastUpdate: Date.now(),
        details,
        symbolCount
      }
    }));
  }

  destroy() {
    if (this.unsubscribeSymbols) {
      this.unsubscribeSymbols();
    }
  }
}

/**
 * Main ConnectivityMonitor class that coordinates all monitoring
 */
class ConnectivityMonitor {
  constructor() {
    this.internetMonitor = null;
    this.serverMonitor = null;
    this.symbolDataMonitor = null;
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) return;

    console.log('[ConnectivityMonitor] Starting connectivity monitoring');

    this.internetMonitor = new InternetMonitor();
    this.serverMonitor = new ServerMonitor();
    this.symbolDataMonitor = new SymbolDataMonitor();

    // Start all monitors
    this.internetMonitor.start();
    this.serverMonitor.start();
    this.symbolDataMonitor.start();

    this.isRunning = true;
  }

  stop() {
    if (!this.isRunning) return;

    console.log('[ConnectivityMonitor] Stopping connectivity monitoring');

    if (this.internetMonitor) {
      this.internetMonitor.stop();
    }

    if (this.serverMonitor) {
      this.serverMonitor.destroy();
    }

    if (this.symbolDataMonitor) {
      this.symbolDataMonitor.destroy();
    }

    this.isRunning = false;
  }

  // Utility methods for manual status checks removed - monitoring is automatic
}

// Export singleton instance
export const connectivityMonitor = new ConnectivityMonitor();

// Auto-start monitoring in browser environment
if (typeof window !== 'undefined') {
  // Start monitoring after a short delay to ensure everything is initialized
  setTimeout(() => {
    connectivityMonitor.start();
  }, 1000);
}

export default connectivityMonitor;