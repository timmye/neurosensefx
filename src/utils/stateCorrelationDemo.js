/**
 * State Correlation System Demo
 *
 * Demonstration script showing how to use the state correlation system
 * for monitoring and debugging visualization performance.
 */

import { globalStateCorrelationTestSuite, runQuickValidation } from './stateCorrelationTestSuite.js';
import { getStateCorrelationOverview, runStateCorrelationHealthCheck } from './stateCorrelationTracker.js';
import { getGlobalReactivityOverview, runReactivityHealthCheck } from './visualizationReactivityMonitor.js';

/**
 * Demo class for state correlation system
 */
export class StateCorrelationDemo {
  constructor() {
    this.demoStartTime = Date.now();
  }

  /**
   * Run complete demo
   */
  async runCompleteDemo() {
    console.log('🚀 Starting State Correlation System Demo');
    console.log('='.repeat(60));

    // 1. Quick validation
    await this.demoQuickValidation();

    // 2. System overview
    this.demoSystemOverview();

    // 3. Health checks
    this.demoHealthChecks();

    // 4. Performance analysis
    this.demoPerformanceAnalysis();

    // 5. Complete validation suite
    await this.demoCompleteValidation();

    console.log('✅ Demo completed successfully!');
  }

  /**
   * Demo quick validation
   */
  async demoQuickValidation() {
    console.log('\n🧪 Demo: Quick Validation');
    console.log('-'.repeat(30));

    const result = await runQuickValidation();
    console.log('Result:', result);
  }

  /**
   * Demo system overview
   */
  demoSystemOverview() {
    console.log('\n📊 Demo: System Overview');
    console.log('-'.repeat(30));

    const stateOverview = getStateCorrelationOverview();
    const reactivityOverview = getGlobalReactivityOverview();

    console.log('State Correlation Overview:');
    console.log('  State changes tracked:', stateOverview?.stateChanges || 0);
    console.log('  Render triggers:', stateOverview?.renderTriggers || 0);
    console.log('  Correlation rate:', stateOverview?.correlationRate || '0%');
    console.log('  Average latency:', stateOverview?.avgLatency || 'N/A');

    console.log('\nReactivity Overview:');
    console.log('  Total parameter updates:', reactivityOverview?.totalParameterUpdates || 0);
    console.log('  Completed cycles:', reactivityOverview?.completedReactivityCycles || 0);
    console.log('  Responsiveness rate:', reactivityOverview?.responsivenessRate || '0%');
    console.log('  Visualization profiles:', reactivityOverview?.visualizationProfiles || 0);
  }

  /**
   * Demo health checks
   */
  demoHealthChecks() {
    console.log('\n🏥 Demo: Health Checks');
    console.log('-'.repeat(30));

    console.log('Running State Correlation Health Check:');
    const stateHealth = runStateCorrelationHealthCheck();

    console.log('\nRunning Reactivity Health Check:');
    const reactivityHealth = runReactivityHealthCheck();
  }

  /**
   * Demo performance analysis
   */
  demoPerformanceAnalysis() {
    console.log('\n📈 Demo: Performance Analysis');
    console.log('-'.repeat(30));

    const stateOverview = getStateCorrelationOverview();
    const reactivityOverview = getGlobalReactivityOverview();

    // Performance thresholds
    const PERFORMANCE_THRESHOLDS = {
      STATE_TO_RENDER: 100,  // ms
      RESPONSIVENESS: 80,    // percentage
      CORRELATION_RATE: 85   // percentage
    };

    console.log('Performance Analysis:');

    if (stateOverview) {
      const avgLatency = parseFloat(stateOverview.avgLatency || 0);
      const meetsLatencyThreshold = avgLatency <= PERFORMANCE_THRESHOLDS.STATE_TO_RENDER;

      console.log(`  State-to-Render Latency: ${avgLatency.toFixed(2)}ms`);
      console.log(`  Threshold: ${PERFORMANCE_THRESHOLDS.STATE_TO_RENDER}ms`);
      console.log(`  Status: ${meetsLatencyThreshold ? '✅ PASS' : '❌ FAIL'}`);
    }

    if (reactivityOverview) {
      const responsiveness = parseFloat(reactivityOverview.responsivenessRate || 0);
      const meetsResponsivenessThreshold = responsiveness >= PERFORMANCE_THRESHOLDS.RESPONSIVENESS;

      console.log(`\n  Responsiveness Rate: ${responsiveness.toFixed(1)}%`);
      console.log(`  Threshold: ${PERFORMANCE_THRESHOLDS.RESPONSIVENESS}%`);
      console.log(`  Status: ${meetsResponsivenessThreshold ? '✅ PASS' : '❌ FAIL'}`);

      const correlationRate = parseFloat(reactivityOverview.responsivenessRate || 0);
      const meetsCorrelationThreshold = correlationRate >= PERFORMANCE_THRESHOLDS.CORRELATION_RATE;

      console.log(`\n  Correlation Rate: ${correlationRate.toFixed(1)}%`);
      console.log(`  Threshold: ${PERFORMANCE_THRESHOLDS.CORRELATION_RATE}%`);
      console.log(`  Status: ${meetsCorrelationThreshold ? '✅ PASS' : '❌ FAIL'}`);
    }
  }

  /**
   * Demo complete validation suite
   */
  async demoCompleteValidation() {
    console.log('\n🔬 Demo: Complete Validation Suite');
    console.log('-'.repeat(30));

    const validationResult = await globalStateCorrelationTestSuite.runCompleteValidation();

    console.log('\nValidation Summary:');
    console.log('  Overall Status:', validationResult.overallStatus);
    console.log('  Timestamp:', validationResult.timestamp);

    if (validationResult.recommendations?.length > 0) {
      console.log('\nRecommendations:');
      validationResult.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }

    // Test history
    const testHistory = globalStateCorrelationTestSuite.getTestHistory(3);
    if (testHistory.length > 0) {
      console.log('\nRecent Test History:');
      testHistory.forEach((test, index) => {
        console.log(`  ${index + 1}. ${test.timestamp} - Status: ${test.overallStatus}`);
      });
    }
  }

  /**
   * Demo real-time monitoring simulation
   */
  async demoRealTimeMonitoring() {
    console.log('\n⏱️ Demo: Real-time Monitoring Simulation');
    console.log('-'.repeat(30));

    console.log('Simulating state changes and monitoring responses...');

    for (let i = 0; i < 5; i++) {
      console.log(`\nSimulation ${i + 1}:`);

      // Simulate a state change
      const mockStateChange = {
        timestamp: Date.now(),
        currentPrice: 1.1234 + (Math.random() * 0.01),
        bid: 1.1233 + (Math.random() * 0.01),
        ask: 1.1235 + (Math.random() * 0.01),
        ready: true
      };

      console.log('  Simulated state change:', mockStateChange);

      // Check system response
      await new Promise(resolve => setTimeout(resolve, 100));

      const quickCheck = await runQuickValidation();
      console.log('  System status:', quickCheck.status);
    }
  }

  /**
   * Demo troubleshooting guide
   */
  demoTroubleshooting() {
    console.log('\n🔧 Demo: Troubleshooting Guide');
    console.log('-'.repeat(30));

    const troubleshootingTips = [
      {
        issue: 'Low correlation rate',
        solution: 'Check state change detection logic and ensure reactive statements are properly configured'
      },
      {
        issue: 'High state-to-render latency',
        solution: 'Optimize render pipeline, check for expensive operations, and consider render throttling'
      },
      {
        issue: 'Poor responsiveness score',
        solution: 'Review visualization performance and optimize heavy computations'
      },
      {
        issue: 'Health check failures',
        solution: 'Check system initialization and ensure all monitoring components are properly loaded'
      },
      {
        issue: 'Memory leaks',
        solution: 'Verify cleanup procedures and check for lingering references in tracking registries'
      }
    ];

    console.log('Common Issues and Solutions:');
    troubleshootingTips.forEach((tip, index) => {
      console.log(`\n${index + 1}. Issue: ${tip.issue}`);
      console.log(`   Solution: ${tip.solution}`);
    });
  }

  /**
   * Demo API usage examples
   */
  demoAPIUsage() {
    console.log('\n💻 Demo: API Usage Examples');
    console.log('-'.repeat(30));

    console.log('// Quick validation');
    console.log('await runQuickValidation();');

    console.log('\n// Get system overviews');
    console.log('const stateOverview = getStateCorrelationOverview();');
    console.log('const reactivityOverview = getGlobalReactivityOverview();');

    console.log('\n// Run health checks');
    console.log('const stateHealth = runStateCorrelationHealthCheck();');
    console.log('const reactivityHealth = runReactivityHealthCheck();');

    console.log('\n// Run complete validation suite');
    console.log('const validation = await globalStateCorrelationTestSuite.runCompleteValidation();');

    console.log('\n// Get test history');
    console.log('const history = globalStateCorrelationTestSuite.getTestHistory();');

    console.log('\n// Get health check history');
    console.log('const healthHistory = globalStateCorrelationTestSuite.getHealthCheckHistory();');
  }
}

/**
 * Quick demo function
 */
export async function runQuickDemo() {
  const demo = new StateCorrelationDemo();
  await demo.runCompleteDemo();
}

/**
 * Interactive demo function (if in browser environment)
 */
export async function runInteractiveDemo() {
  if (typeof window === 'undefined') {
    console.log('Interactive demo requires browser environment');
    return;
  }

  console.log('🎮 Interactive State Correlation System Demo');
  console.log('Available commands:');
  console.log('  demo.runCompleteDemo() - Run complete demo');
  console.log('  demo.demoQuickValidation() - Quick validation demo');
  console.log('  demo.demoSystemOverview() - System overview demo');
  console.log('  demo.demoHealthChecks() - Health checks demo');
  console.log('  demo.demoPerformanceAnalysis() - Performance analysis demo');
  console.log('  demo.demoRealTimeMonitoring() - Real-time monitoring simulation');
  console.log('  demo.demoTroubleshooting() - Troubleshooting guide');
  console.log('  demo.demoAPIUsage() - API usage examples');
  console.log('\nGlobal test suite available as: globalStateCorrelationTestSuite');

  // Make demo globally available
  window.stateCorrelationDemo = new StateCorrelationDemo();
  window.globalStateCorrelationTestSuite = globalStateCorrelationTestSuite;

  return window.stateCorrelationDemo;
}

// Auto-run demo if in development mode and this file is imported directly
if (import.meta.env.DEV && typeof window !== 'undefined') {
  console.log('🎯 State Correlation System Demo loaded');
  console.log('Run runQuickDemo() for a quick demo');
  console.log('Run runInteractiveDemo() for interactive mode');
}