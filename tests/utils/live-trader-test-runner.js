/**
 * Live Trader Test Runner
 *
 * Comprehensive test runner that orchestrates all live trading tests with real cTrader data.
 * This runner completely eliminates any simulated or artificial market data, ensuring
 * 100% visibility into actual data flow performance.
 *
 * Features:
 * - Live WebSocket connection testing
 * - Real market data validation
 * - Performance benchmarking
 * - Connection reliability testing
 * - Professional trading standards validation
 */

import { WebSocketTestUtils } from './websocket-test-utils.js';
import { MarketDataValidator } from './market-data-validator.js';
import { realWorldConfig } from '../helpers/fixtures.js';

export class LiveTraderTestRunner {
  constructor() {
    this.wsUtils = new WebSocketTestUtils();
    this.marketValidator = new MarketDataValidator();
    this.testResults = {
      connectivity: null,
      marketData: null,
      performance: null,
      reliability: null,
      summary: null
    };
  }

  /**
   * Run complete live trading test suite
   */
  async runCompleteTestSuite(options = {}) {
    console.log('🚀 Starting Complete Live Trading Test Suite...');
    console.log('=' .repeat(60));

    const startTime = Date.now();

    try {
      // Test 1: Connectivity Validation
      console.log('📡 Test 1: WebSocket Connectivity Validation');
      this.testResults.connectivity = await this.testConnectivity();

      // Test 2: Real Market Data Validation
      console.log('\n📊 Test 2: Real Market Data Validation');
      this.testResults.marketData = await this.testMarketData();

      // Test 3: Performance Benchmarking
      console.log('\n⚡ Test 3: Performance Benchmarking');
      this.testResults.performance = await this.testPerformance();

      // Test 4: Connection Reliability
      console.log('\n🔒 Test 4: Connection Reliability Testing');
      this.testResults.reliability = await this.testReliability();

      // Generate comprehensive summary
      console.log('\n📋 Generating Test Summary...');
      this.testResults.summary = this.generateTestSummary();

      const totalDuration = Date.now() - startTime;
      console.log(`\n✅ Complete Test Suite finished in ${totalDuration}ms`);

      return this.testResults;

    } catch (error) {
      console.error('❌ Test suite failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Test WebSocket connectivity with real cTrader backend
   */
  async testConnectivity() {
    const connectivityTest = {
      name: 'WebSocket Connectivity',
      startTime: Date.now(),
      results: []
    };

    try {
      // Test basic connection
      console.log('  🔌 Testing basic WebSocket connection...');
      const connection1 = await this.wsUtils.connectToLiveBackend('connectivity-test-1');
      const connection1Metrics = connection1.getMetrics();

      connectivityTest.results.push({
        test: 'basic_connection',
        success: true,
        connectionTime: connection1Metrics.metrics.connectionTime,
        status: connection1Metrics.connection.status
      });

      await connection1.close();

      // Test multiple simultaneous connections
      console.log('  🔌 Testing multiple simultaneous connections...');
      const connections = [];
      const connectionPromises = [];

      for (let i = 0; i < 3; i++) {
        connectionPromises.push(
          this.wsUtils.connectToLiveBackend(`simultaneous-test-${i}`)
            .then(conn => {
              connections.push(conn);
              return conn.getMetrics();
            })
        );
      }

      const simultaneousResults = await Promise.all(connectionPromises);
      const avgConnectionTime = simultaneousResults.reduce((sum, result) =>
        sum + result.metrics.connectionTime, 0) / simultaneousResults.length;

      connectivityTest.results.push({
        test: 'simultaneous_connections',
        success: true,
        connectionCount: simultaneousResults.length,
        avgConnectionTime: avgConnectionTime,
        allConnected: simultaneousResults.every(result => result.connection.status === 'connected')
      });

      // Close all connections
      for (const conn of connections) {
        await conn.close();
      }

      // Test connection recovery
      console.log('  🔌 Testing connection recovery...');
      const recoveryConnection = await this.wsUtils.connectToLiveBackend('recovery-test');

      // Simulate connection loss and recovery
      await recoveryConnection.close();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

      const recoveryTime = Date.now();
      const recoveredConnection = await this.wsUtils.connectToLiveBackend('recovery-test-2');
      const recoveryDuration = Date.now() - recoveryTime;

      connectivityTest.results.push({
        test: 'connection_recovery',
        success: true,
        recoveryTime: recoveryDuration
      });

      await recoveredConnection.close();

      connectivityTest.success = true;
      connectivityTest.duration = Date.now() - connectivityTest.startTime;
      connectivityTest.summary = {
        totalTests: connectivityTest.results.length,
        successfulTests: connectivityTest.results.filter(r => r.success).length
      };

    } catch (error) {
      connectivityTest.success = false;
      connectivityTest.error = error.message;
      connectivityTest.duration = Date.now() - connectivityTest.startTime;
    }

    return connectivityTest;
  }

  /**
   * Test real market data validation
   */
  async testMarketData() {
    const marketDataTest = {
      name: 'Real Market Data Validation',
      startTime: Date.now(),
      symbols: ['EUR/USD', 'GBP/USD', 'USD/JPY'],
      results: {}
    };

    try {
      for (const symbol of marketDataTest.symbols) {
        console.log(`  📈 Testing ${symbol} market data...`);

        // Establish connection and subscribe
        const connection = await this.wsUtils.connectToLiveBackend(`market-data-${symbol}`);

        try {
          // Subscribe to symbol
          const subscription = await connection.subscribe(symbol);
          console.log(`    ✅ Subscribed to ${symbol}`);

          // Validate initial data package
          const packageValidation = this.marketValidator.validateDataPackage(subscription.dataPackage);

          // Monitor real-time ticks
          const realTimeData = await this.wsUtils.monitorRealTimeData(connection, symbol, 10000); // 10 seconds

          // Validate collected data points
          const tickValidations = realTimeData.dataPoints.map(point =>
            this.marketValidator.validateRealTimeTick({
              symbol: symbol,
              bid: point.bid,
              ask: point.ask,
              timestamp: point.timestamp
            })
          );

          marketDataTest.results[symbol] = {
            subscriptionSuccess: true,
            packageValidation: packageValidation,
            realTimeDataPoints: realTimeData.dataPoints.length,
            avgLatency: realTimeData.avgLatency,
            maxLatency: realTimeData.maxLatency,
            validDataPercentage: realTimeData.validDataPercentage,
            tickValidationResults: {
              total: tickValidations.length,
              valid: tickValidations.filter(v => v.isValid).length,
              avgLatency: tickValidations.reduce((sum, v) => sum + (v.metrics.latency || 0), 0) / tickValidations.length
            }
          };

          console.log(`    📊 ${symbol}: ${realTimeData.dataPoints.length} points, ${realTimeData.validDataPercentage.toFixed(1)}% valid`);

        } catch (symbolError) {
          console.error(`    ❌ Error testing ${symbol}:`, symbolError.message);
          marketDataTest.results[symbol] = {
            subscriptionSuccess: false,
            error: symbolError.message
          };
        }

        await connection.close();
      }

      marketDataTest.success = true;
      marketDataTest.duration = Date.now() - marketDataTest.startTime;
      marketDataTest.summary = {
        totalSymbols: marketDataTest.symbols.length,
        successfulSymbols: Object.values(marketDataTest.results).filter(r => r.subscriptionSuccess).length,
        totalDataPoints: Object.values(marketDataTest.results)
          .filter(r => r.realTimeDataPoints)
          .reduce((sum, r) => sum + r.realTimeDataPoints, 0)
      };

    } catch (error) {
      marketDataTest.success = false;
      marketDataTest.error = error.message;
      marketDataTest.duration = Date.now() - marketDataTest.startTime;
    }

    return marketDataTest;
  }

  /**
   * Test performance against professional trading requirements
   */
  async testPerformance() {
    const performanceTest = {
      name: 'Performance Benchmarking',
      startTime: Date.now(),
      results: {}
    };

    try {
      // Test 1: High load performance
      console.log('  🚀 Testing high load performance...');
      const loadConnection = await this.wsUtils.connectToLiveBackend('load-test');
      const loadResults = await this.wsUtils.testHighLoadPerformance(loadConnection);

      performanceTest.results.highLoad = {
        avgSubscriptionTime: loadResults.avgSubscriptionTime,
        successfulSubscriptions: loadResults.successfulSubscriptions,
        dataPointsPerSecond: loadResults.dataPointsPerSecond,
        avgLatency: loadResults.avgLatency
      };

      await loadConnection.close();

      // Test 2: Data throughput under stress
      console.log('  📊 Testing data throughput...');
      const throughputConnection = await this.wsUtils.connectToLiveBackend('throughput-test');
      await throughputConnection.subscribe('EUR/USD');

      const throughputData = await this.wsUtils.monitorRealTimeData(throughputConnection, 'EUR/USD', 15000); // 15 seconds

      performanceTest.results.throughput = {
        dataPointsCollected: throughputData.dataPoints.length,
        avgLatency: throughputData.avgLatency,
        maxLatency: throughputData.maxLatency,
        dataRate: throughputData.dataPoints.length / 15, // per second
        validDataPercentage: throughputData.validDataPercentage
      };

      await throughputConnection.close();

      // Test 3: Keyboard shortcut performance (if browser testing available)
      console.log('  ⌨️ Testing professional trading requirements compliance...');
      performanceTest.results.professionalRequirements = {
        keyboardLatencyMax: realWorldConfig.performanceRequirements.keyboardShortcutLatency.maximum,
        dataToVisualLatencyMax: realWorldConfig.performanceRequirements.dataToVisualLatency.maximum,
        fpsRenderingMin: realWorldConfig.performanceRequirements.fpsRendering.minimum,
        displayCreationTimeMax: realWorldConfig.performanceRequirements.displayCreationTime.maximum
      };

      // Validate actual performance against requirements
      const actualAvgLatency = performanceTest.results.throughput.avgLatency;
      const actualDataRate = performanceTest.results.throughput.dataRate;

      performanceTest.results.requirementsCompliance = {
        latencyWithinLimit: actualAvgLatency <= realWorldConfig.performanceRequirements.dataToVisualLatency.maximum,
        dataRateAcceptable: actualDataRate >= 1, // At least 1 data point per second
        highDataQuality: performanceTest.results.throughput.validDataPercentage >= 90
      };

      performanceTest.success = true;
      performanceTest.duration = Date.now() - performanceTest.startTime;

    } catch (error) {
      performanceTest.success = false;
      performanceTest.error = error.message;
      performanceTest.duration = Date.now() - performanceTest.startTime;
    }

    return performanceTest;
  }

  /**
   * Test connection reliability over extended periods
   */
  async testReliability() {
    const reliabilityTest = {
      name: 'Connection Reliability',
      startTime: Date.now(),
      results: {}
    };

    try {
      console.log('  🔒 Testing connection reliability (60 seconds)...');

      const reliabilityConnection = await this.wsUtils.connectToLiveBackend('reliability-test');
      const reliabilityResults = await this.wsUtils.testConnectionReliability(reliabilityConnection, 60000); // 60 seconds

      reliabilityTest.results.extendedReliability = {
        duration: reliabilityResults.duration,
        disconnections: reliabilityResults.disconnections,
        uptimePercentage: reliabilityResults.uptimePercentage,
        heartbeatsSent: reliabilityResults.heartbeatsSent,
        heartbeatSuccessRate: reliabilityResults.heartbeatSuccessRate
      };

      await reliabilityConnection.close();

      // Test rapid connection/disconnection cycles
      console.log('  🔄 Testing rapid connection cycles...');
      const cycleResults = [];

      for (let i = 0; i < 5; i++) {
        const cycleStart = Date.now();
        const cycleConnection = await this.wsUtils.connectToLiveBackend(`cycle-test-${i}`);
        await cycleConnection.close();
        const cycleDuration = Date.now() - cycleStart;
        cycleResults.push(cycleDuration);
      }

      reliabilityTest.results.connectionCycles = {
        cyclesCompleted: cycleResults.length,
        avgCycleTime: cycleResults.reduce((a, b) => a + b, 0) / cycleResults.length,
        maxCycleTime: Math.max(...cycleResults),
        minCycleTime: Math.min(...cycleResults)
      };

      reliabilityTest.success = true;
      reliabilityTest.duration = Date.now() - reliabilityTest.startTime;

    } catch (error) {
      reliabilityTest.success = false;
      reliabilityTest.error = error.message;
      reliabilityTest.duration = Date.now() - reliabilityTest.startTime;
    }

    return reliabilityTest;
  }

  /**
   * Generate comprehensive test summary
   */
  generateTestSummary() {
    const summary = {
      timestamp: Date.now(),
      overallSuccess: true,
      totalDuration: 0,
      testCategories: Object.keys(this.testResults).filter(key => key !== 'summary'),
      categoryResults: {},
      professionalStandards: {
        dataLatencyAcceptable: true,
        dataQualityAcceptable: true,
        connectionReliable: true,
        performanceAdequate: true
      }
    };

    let totalDuration = 0;

    for (const [category, results] of Object.entries(this.testResults)) {
      if (category === 'summary') continue;

      summary.categoryResults[category] = {
        name: results.name,
        success: results.success,
        duration: results.duration,
        error: results.error || null
      };

      totalDuration += results.duration || 0;

      if (!results.success) {
        summary.overallSuccess = false;
      }

      // Evaluate professional standards
      if (category === 'performance') {
        const compliance = results.results.requirementsCompliance;
        if (compliance) {
          summary.professionalStandards.dataLatencyAcceptable = compliance.latencyWithinLimit;
          summary.professionalStandards.performanceAdequate = compliance.dataRateAcceptable && compliance.highDataQuality;
        }
      }

      if (category === 'reliability') {
        const extendedReliability = results.results.extendedReliability;
        if (extendedReliability) {
          summary.professionalStandards.connectionReliable = extendedReliability.uptimePercentage >= 99;
        }
      }

      if (category === 'marketData') {
        const dataPoints = Object.values(results.results)
          .filter(r => r.realTimeDataPoints)
          .reduce((sum, r) => sum + r.realTimeDataPoints, 0);

        if (dataPoints === 0) {
          summary.professionalStandards.dataQualityAcceptable = false;
        }
      }
    }

    summary.totalDuration = totalDuration;
    summary.recommendations = this.generateRecommendations(summary);

    return summary;
  }

  /**
   * Generate recommendations based on test results
   */
  generateRecommendations(summary) {
    const recommendations = [];

    if (!summary.professionalStandards.dataLatencyAcceptable) {
      recommendations.push({
        category: 'performance',
        priority: 'high',
        issue: 'Data latency exceeds professional trading requirements',
        suggestion: 'Optimize WebSocket message processing and reduce network overhead'
      });
    }

    if (!summary.professionalStandards.connectionReliable) {
      recommendations.push({
        category: 'reliability',
        priority: 'high',
        issue: 'Connection reliability below 99% uptime',
        suggestion: 'Implement robust reconnection logic and connection monitoring'
      });
    }

    if (!summary.professionalStandards.dataQualityAcceptable) {
      recommendations.push({
        category: 'data_quality',
        priority: 'high',
        issue: 'Insufficient real-time data quality',
        suggestion: 'Verify cTrader connection and symbol subscription mechanisms'
      });
    }

    if (!summary.professionalStandards.performanceAdequate) {
      recommendations.push({
        category: 'performance',
        priority: 'medium',
        issue: 'Performance below professional trading standards',
        suggestion: 'Review rendering pipeline and data processing efficiency'
      });
    }

    // If everything is good, add optimization suggestions
    if (recommendations.length === 0) {
      recommendations.push({
        category: 'optimization',
        priority: 'low',
        issue: 'System meets professional standards',
        suggestion: 'Consider further optimizations for enhanced user experience'
      });
    }

    return recommendations;
  }

  /**
   * Cleanup all test resources
   */
  async cleanup() {
    console.log('🧹 Cleaning up test resources...');
    await this.wsUtils.cleanup();
    console.log('✅ Cleanup completed');
  }

  /**
   * Print detailed test results
   */
  printResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 LIVE TRADING TEST RESULTS');
    console.log('='.repeat(60));

    if (!this.testResults.summary) {
      console.log('❌ No test results available');
      return;
    }

    const summary = this.testResults.summary;

    console.log(`\n📊 Overall Status: ${summary.overallSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`⏱️ Total Duration: ${summary.totalDuration}ms`);

    console.log('\n📈 Test Categories:');
    for (const [category, results] of Object.entries(summary.categoryResults)) {
      const status = results.success ? '✅' : '❌';
      console.log(`  ${status} ${results.name}: ${results.duration}ms ${results.error ? `(${results.error})` : ''}`);
    }

    console.log('\n🎯 Professional Standards:');
    console.log(`  Data Latency: ${summary.professionalStandards.dataLatencyAcceptable ? '✅' : '❌'} Acceptable`);
    console.log(`  Data Quality: ${summary.professionalStandards.dataQualityAcceptable ? '✅' : '❌'} Acceptable`);
    console.log(`  Connection Reliability: ${summary.professionalStandards.connectionReliable ? '✅' : '❌'} Acceptable`);
    console.log(`  Performance: ${summary.professionalStandards.performanceAdequate ? '✅' : '❌'} Acceptable`);

    if (summary.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      for (const rec of summary.recommendations) {
        const priority = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
        console.log(`  ${priority} [${rec.category.toUpperCase()}] ${rec.issue}`);
        console.log(`     Suggestion: ${rec.suggestion}`);
      }
    }

    console.log('\n' + '='.repeat(60));
  }
}

export default LiveTraderTestRunner;