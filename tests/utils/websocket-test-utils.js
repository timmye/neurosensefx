/**
 * Real WebSocket Test Utilities for cTrader Integration
 *
 * Comprehensive testing framework for live WebSocket connections
 * with actual cTrader market data. No simulations or mocks.
 *
 * Features:
 * - Real connection validation
 * - Market data freshness verification
 * - Performance monitoring
 * - Error scenario testing
 * - Connection reliability testing
 */

import { realWorldConfig, MarketDataValidator } from '../helpers/fixtures.js';

export class WebSocketTestUtils {
  constructor() {
    this.connections = new Map();
    this.metrics = new Map();
    this.subscriptions = new Map();
    this.testResults = [];
  }

  /**
   * Establish real WebSocket connection to cTrader backend
   */
  async connectToLiveBackend(testName = 'default') {
    const wsUrl = realWorldConfig.websocketConfig.development;
    const connectionId = `${testName}-${Date.now()}`;

    console.log(`🔌 Establishing live WebSocket connection for ${testName}...`);

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      const startTime = Date.now();

      // Connection timeout
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error(`Connection timeout for ${testName} after ${realWorldConfig.websocketConfig.connectionTimeout}ms`));
      }, realWorldConfig.websocketConfig.connectionTimeout);

      ws.onopen = () => {
        clearTimeout(timeout);
        const connectionTime = Date.now() - startTime;

        console.log(`✅ WebSocket connected for ${testName} in ${connectionTime}ms`);

        // Initialize connection tracking
        this.connections.set(connectionId, {
          ws,
          testName,
          connectedAt: startTime,
          lastActivity: Date.now(),
          status: 'connected'
        });

        this.metrics.set(connectionId, {
          connectionTime,
          messagesReceived: 0,
          messagesSent: 0,
          errors: [],
          latencies: [],
          dataFreshness: [],
          reconnections: 0
        });

        resolve({
          connectionId,
          ws,
          send: (data) => this.sendMessage(connectionId, data),
          subscribe: (symbol) => this.subscribeToSymbol(connectionId, symbol),
          close: () => this.closeConnection(connectionId),
          getMetrics: () => this.getConnectionMetrics(connectionId)
        });
      };

      ws.onmessage = (event) => {
        this.handleMessage(connectionId, event);
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        console.error(`❌ WebSocket error for ${testName}:`, error);
        this.recordError(connectionId, error);
        reject(error);
      };

      ws.onclose = (event) => {
        if (this.connections.has(connectionId)) {
          console.log(`🔌 WebSocket closed for ${testName}. Code: ${event.code}, Reason: ${event.reason}`);
          this.connections.get(connectionId).status = 'disconnected';
        }
      };
    });
  }

  /**
   * Subscribe to real market data for a symbol
   */
  async subscribeToSymbol(connectionId, symbol, adrLookbackDays = 14) {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    const subscribeStartTime = Date.now();

    // Subscribe to symbol
    const subscribeMessage = {
      type: 'get_symbol_data_package',
      symbol,
      adrLookbackDays
    };

    await this.sendMessage(connectionId, subscribeMessage);

    // Wait for data package response
    const dataPackagePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for data package for ${symbol}`));
      }, 15000);

      const messageHandler = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'symbolDataPackage' && data.symbol === symbol) {
          clearTimeout(timeout);
          connection.ws.removeEventListener('message', messageHandler);

          const subscriptionTime = Date.now() - subscribeStartTime;

          // Record subscription details
          if (!this.subscriptions.has(connectionId)) {
            this.subscriptions.set(connectionId, new Map());
          }
          this.subscriptions.get(connectionId).set(symbol, {
            subscribedAt: subscribeStartTime,
            subscriptionTime,
            lastDataReceived: Date.now(),
            dataPoints: 0
          });

          resolve({
            symbol,
            subscriptionTime,
            dataPackage: data
          });
        } else if (data.type === 'error' && data.message.includes(symbol)) {
          clearTimeout(timeout);
          connection.ws.removeEventListener('message', messageHandler);
          reject(new Error(`Subscription error for ${symbol}: ${data.message}`));
        }
      };

      connection.ws.addEventListener('message', messageHandler);
    });

    return dataPackagePromise;
  }

  /**
   * Monitor real-time market data for a symbol
   */
  async monitorRealTimeData(connectionId, symbol, duration = 60000) {
    const connection = this.connections.get(connectionId);
    const subscription = this.subscriptions.get(connectionId)?.get(symbol);

    if (!connection || !subscription) {
      throw new Error(`No active subscription for ${symbol} on connection ${connectionId}`);
    }

    console.log(`📊 Monitoring real-time data for ${symbol} for ${duration}ms...`);

    const monitoringData = {
      symbol,
      startTime: Date.now(),
      endTime: Date.now() + duration,
      dataPoints: [],
      latencies: [],
      validationResults: [],
      totalDataPoints: 0
    };

    return new Promise((resolve) => {
      const messageHandler = (event) => {
        const data = JSON.parse(event.data);
        const currentTime = Date.now();

        if (data.type === 'tick' && data.symbol === symbol) {
          const latency = currentTime - (data.timestamp || currentTime);

          // Update subscription tracking
          subscription.lastDataReceived = currentTime;
          subscription.dataPoints++;

          // Validate market data
          const validation = MarketDataValidator.validateRealTimeData(data);

          monitoringData.dataPoints.push({
            timestamp: currentTime,
            bid: data.bid,
            ask: data.ask,
            latency,
            validation
          });

          monitoringData.latencies.push(latency);
          monitoringData.validationResults.push(validation);
          monitoringData.totalDataPoints++;

          // Update connection metrics
          const metrics = this.metrics.get(connectionId);
          if (metrics) {
            metrics.latencies.push(latency);
            metrics.dataFreshness.push(currentTime - data.timestamp);
          }

          console.log(`📈 ${symbol} tick: ${data.bid}/${data.ask} (${latency}ms latency) - ${validation.valid ? '✅' : '❌'}`);
        }
      };

      connection.ws.addEventListener('message', messageHandler);

      // Stop monitoring after duration
      setTimeout(() => {
        connection.ws.removeEventListener('message', messageHandler);

        const monitoringDuration = Date.now() - monitoringData.startTime;
        const summary = {
          ...monitoringData,
          duration: monitoringDuration,
          avgLatency: monitoringData.latencies.length > 0
            ? monitoringData.latencies.reduce((a, b) => a + b, 0) / monitoringData.latencies.length
            : 0,
          maxLatency: monitoringData.latencies.length > 0 ? Math.max(...monitoringData.latencies) : 0,
          minLatency: monitoringData.latencies.length > 0 ? Math.min(...monitoringData.latencies) : 0,
          dataPointsPerSecond: (monitoringData.totalDataPoints / monitoringDuration) * 1000,
          validDataPercentage: monitoringData.validationResults.filter(r => r.valid).length / monitoringData.validationResults.length * 100
        };

        console.log(`📊 Monitoring summary for ${symbol}:`, {
          duration: `${monitoringDuration}ms`,
          dataPoints: monitoringData.totalDataPoints,
          avgLatency: `${summary.avgLatency.toFixed(2)}ms`,
          dataPointsPerSecond: summary.dataPointsPerSecond.toFixed(1),
          validDataPercentage: `${summary.validDataPercentage.toFixed(1)}%`
        });

        resolve(summary);
      }, duration);
    });
  }

  /**
   * Test WebSocket connection reliability under various conditions
   */
  async testConnectionReliability(connectionId, testDuration = 300000) {
    console.log(`🧪 Testing connection reliability for ${testDuration / 1000} seconds...`);

    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    const reliabilityTest = {
      startTime: Date.now(),
      endTime: Date.now() + testDuration,
      disconnections: 0,
      reconnections: 0,
      messageFailures: 0,
      heartbeatIntervals: []
    };

    // Set up heartbeat monitoring
    const heartbeatInterval = setInterval(() => {
      try {
        if (connection.ws.readyState === WebSocket.OPEN) {
          this.sendMessage(connectionId, { type: 'heartbeat', timestamp: Date.now() });
          reliabilityTest.heartbeatIntervals.push(Date.now());
        } else {
          reliabilityTest.disconnections++;
          console.warn(`⚠️ Connection disconnected during reliability test`);
        }
      } catch (error) {
        reliabilityTest.messageFailures++;
        console.error(`❌ Heartbeat failed:`, error);
      }
    }, 30000); // Every 30 seconds

    // Monitor connection status
    const originalOnClose = connection.ws.onclose;
    connection.ws.onclose = (event) => {
      reliabilityTest.disconnections++;
      originalOnClose?.(event);
    };

    return new Promise((resolve) => {
      setTimeout(() => {
        clearInterval(heartbeatInterval);

        const testDurationActual = Date.now() - reliabilityTest.startTime;
        const reliability = {
          ...reliabilityTest,
          duration: testDurationActual,
          uptimePercentage: ((testDurationActual - (reliabilityTest.disconnections * 5000)) / testDurationActual) * 100,
          heartbeatsSent: reliabilityTest.heartbeatIntervals.length,
          heartbeatSuccessRate: ((reliabilityTest.heartbeatIntervals.length - reliabilityTest.messageFailures) / reliabilityTest.heartbeatIntervals.length) * 100
        };

        console.log(`📊 Reliability test completed:`, {
          duration: `${testDurationActual}ms`,
          disconnections: reliabilityTest.disconnections,
          uptime: `${reliability.uptimePercentage.toFixed(2)}%`,
          heartbeats: reliabilityTest.heartbeatIntervals.length,
          heartbeatSuccessRate: `${reliability.heartbeatSuccessRate.toFixed(2)}%`
        });

        resolve(reliability);
      }, testDuration);
    });
  }

  /**
   * Test WebSocket performance under high load
   */
  async testHighLoadPerformance(connectionId, symbols = ['EUR/USD', 'GBP/USD', 'USD/JPY']) {
    console.log(`🚀 Testing high load performance with ${symbols.length} symbols...`);

    const loadTest = {
      startTime: Date.now(),
      symbols: symbols,
      subscriptionTimes: [],
      dataPointsReceived: 0,
      totalLatency: 0,
      maxLatency: 0,
      minLatency: Infinity,
      errors: []
    };

    try {
      // Subscribe to all symbols rapidly
      for (const symbol of symbols) {
        const startTime = Date.now();

        try {
          await this.subscribeToSymbol(connectionId, symbol);
          const subscriptionTime = Date.now() - startTime;
          loadTest.subscriptionTimes.push({ symbol, time: subscriptionTime });
          console.log(`✅ Subscribed to ${symbol} in ${subscriptionTime}ms`);
        } catch (error) {
          loadTest.errors.push({ symbol, error: error.message });
          console.error(`❌ Failed to subscribe to ${symbol}:`, error.message);
        }

        // Small delay between subscriptions
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Monitor data for 60 seconds
      const monitoringDuration = 60000;
      const messageHandler = (event) => {
        const data = JSON.parse(event.data);
        const currentTime = Date.now();

        if (data.type === 'tick' && symbols.includes(data.symbol)) {
          const latency = currentTime - (data.timestamp || currentTime);
          loadTest.dataPointsReceived++;
          loadTest.totalLatency += latency;
          loadTest.maxLatency = Math.max(loadTest.maxLatency, latency);
          loadTest.minLatency = Math.min(loadTest.minLatency, latency);
        }
      };

      const connection = this.connections.get(connectionId);
      connection.ws.addEventListener('message', messageHandler);

      await new Promise(resolve => setTimeout(resolve, monitoringDuration));
      connection.ws.removeEventListener('message', messageHandler);

    } catch (error) {
      loadTest.errors.push({ error: error.message });
      console.error(`❌ Load test error:`, error);
    }

    const testDuration = Date.now() - loadTest.startTime;
    const avgLatency = loadTest.dataPointsReceived > 0 ? loadTest.totalLatency / loadTest.dataPointsReceived : 0;

    const performance = {
      ...loadTest,
      duration: testDuration,
      avgSubscriptionTime: loadTest.subscriptionTimes.length > 0
        ? loadTest.subscriptionTimes.reduce((sum, sub) => sum + sub.time, 0) / loadTest.subscriptionTimes.length
        : 0,
      avgLatency,
      dataPointsPerSecond: (loadTest.dataPointsReceived / testDuration) * 1000,
      successfulSubscriptions: loadTest.subscriptionTimes.length,
      subscriptionSuccessRate: (loadTest.subscriptionTimes.length / symbols.length) * 100
    };

    console.log(`📊 Load test performance:`, {
      duration: `${testDuration}ms`,
      successfulSubscriptions: `${performance.successfulSubscriptions}/${symbols.length}`,
      avgSubscriptionTime: `${performance.avgSubscriptionTime.toFixed(2)}ms`,
      dataPointsReceived: loadTest.dataPointsReceived,
      avgLatency: `${avgLatency.toFixed(2)}ms`,
      dataPointsPerSecond: performance.dataPointsPerSecond.toFixed(1)
    });

    return performance;
  }

  /**
   * Send message through WebSocket with tracking
   */
  async sendMessage(connectionId, data) {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    return new Promise((resolve, reject) => {
      try {
        if (connection.ws.readyState !== WebSocket.OPEN) {
          reject(new Error(`WebSocket not open (state: ${connection.ws.readyState})`));
          return;
        }

        const message = JSON.stringify(data);
        connection.ws.send(message);

        // Update metrics
        const metrics = this.metrics.get(connectionId);
        if (metrics) {
          metrics.messagesSent++;
        }

        connection.lastActivity = Date.now();
        resolve();
      } catch (error) {
        this.recordError(connectionId, error);
        reject(error);
      }
    });
  }

  /**
   * Close connection and cleanup
   */
  async closeConnection(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    console.log(`🔌 Closing connection ${connectionId}...`);

    try {
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.close();
      }
    } catch (error) {
      console.error(`Error closing connection:`, error);
    }

    this.connections.delete(connectionId);
    this.subscriptions.delete(connectionId);

    // Store final metrics
    const finalMetrics = this.metrics.get(connectionId);
    if (finalMetrics) {
      this.testResults.push({
        connectionId,
        testName: connection.testName,
        metrics: finalMetrics,
        closedAt: Date.now()
      });
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(connectionId, event) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.lastActivity = Date.now();

    const metrics = this.metrics.get(connectionId);
    if (metrics) {
      metrics.messagesReceived++;
    }

    // Parse message for additional tracking
    try {
      const data = JSON.parse(event.data);
      const messageLatency = Date.now() - (data.timestamp || Date.now());

      if (metrics && messageLatency > 0) {
        metrics.latencies.push(messageLatency);
      }
    } catch (error) {
      // Ignore JSON parsing errors for latency tracking
    }
  }

  /**
   * Record error for connection
   */
  recordError(connectionId, error) {
    const metrics = this.metrics.get(connectionId);
    if (metrics) {
      metrics.errors.push({
        error: error.message || error,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Get connection metrics
   */
  getConnectionMetrics(connectionId) {
    const connection = this.connections.get(connectionId);
    const metrics = this.metrics.get(connectionId);
    const subscriptions = this.subscriptions.get(connectionId);

    return {
      connection: {
        id: connectionId,
        testName: connection?.testName,
        status: connection?.status,
        connectedAt: connection?.connectedAt,
        lastActivity: connection?.lastActivity
      },
      metrics: metrics || {},
      subscriptions: subscriptions ? Array.from(subscriptions.keys()) : []
    };
  }

  /**
   * Get comprehensive test results
   */
  getTestResults() {
    return {
      totalConnections: this.connections.size,
      totalSubscriptions: Array.from(this.subscriptions.values()).reduce((total, subMap) => total + subMap.size, 0),
      testResults: this.testResults,
      activeConnections: Array.from(this.connections.keys()),
      summary: this.generateSummary()
    };
  }

  /**
   * Generate summary of all tests
   */
  generateSummary() {
    const allMetrics = Array.from(this.metrics.values());

    if (allMetrics.length === 0) {
      return { message: 'No test data available' };
    }

    const totalMessages = allMetrics.reduce((sum, metrics) => sum + metrics.messagesReceived, 0);
    const totalErrors = allMetrics.reduce((sum, metrics) => sum + metrics.errors.length, 0);
    const allLatencies = allMetrics.flatMap(metrics => metrics.latencies);

    return {
      totalConnections: allMetrics.length,
      totalMessagesReceived: totalMessages,
      totalErrors: totalErrors,
      averageLatency: allLatencies.length > 0 ? allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length : 0,
      maxLatency: allLatencies.length > 0 ? Math.max(...allLatencies) : 0,
      minLatency: allLatencies.length > 0 ? Math.min(...allLatencies) : 0,
      errorRate: totalMessages > 0 ? (totalErrors / totalMessages) * 100 : 0
    };
  }

  /**
   * Cleanup all connections and resources
   */
  async cleanup() {
    console.log('🧹 Cleaning up WebSocket test utilities...');

    const connectionIds = Array.from(this.connections.keys());
    for (const connectionId of connectionIds) {
      await this.closeConnection(connectionId);
    }

    this.connections.clear();
    this.metrics.clear();
    this.subscriptions.clear();

    console.log('✅ WebSocket test utilities cleaned up');
  }
}

// Singleton instance for easy import
export const webSocketTestUtils = new WebSocketTestUtils();

export default WebSocketTestUtils;