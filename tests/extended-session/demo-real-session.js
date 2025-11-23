/**
 * Real Extended Session Demo
 *
 * Demonstration script showing how to use the extended session testing framework
 * for genuine 8+ hour testing with actual memory tracking.
 */

import { ExtendedSessionIntegration } from './ExtendedSessionIntegration.js';

/**
 * Demo 1: Basic 8-hour session with default settings
 */
async function runBasic8HourSession() {
  console.log('🚀 Starting Demo 1: Basic 8-Hour Session');
  console.log('=' .repeat(60));

  const integration = new ExtendedSessionIntegration();

  try {
    // Initialize with default 8-hour settings
    await integration.initialize({
      sessionDuration: 8 * 60 * 60 * 1000, // 8 hours
      enableDetailedLogging: true,
      enableProgressTracking: true,
      enableAlertNotifications: true
    });

    // Subscribe to progress updates
    integration.subscribeToProgress((report) => {
      console.log(`📊 Progress: ${report.progress.percentage}% | Memory: ${report.statistics.memorySnapshots} snapshots | Alerts: ${report.statistics.alerts}`);
    });

    // Subscribe to critical alerts
    integration.subscribeToAlerts((alert) => {
      if (alert.severity === 'critical') {
        console.error(`🚨 CRITICAL ALERT: ${alert.message}`);
      }
    });

    // Start the session
    const result = await integration.startExtendedSessionTest({
      testerOptions: {
        maxMemoryGrowthMB: 100,
        minPerformanceScore: 80
      }
    });

    console.log('✅ Session started successfully');
    console.log('📋 Session Info:', result.sessionInfo);

    // Wait for session to complete (in real usage, you'd handle this differently)
    console.log('⏰ Session running for 8 hours...');
    console.log('💡 In a real environment, you would monitor progress and handle alerts');
    console.log('📱 Use integration.getSessionStatus() to check current status');

    // For demo purposes, we'll stop after a short time
    setTimeout(async () => {
      console.log('🛑 Stopping demo session early for demonstration...');
      const stopResult = await integration.stopExtendedSessionTest();

      console.log('📊 Final Report Summary:');
      console.log(`   Overall Grade: ${stopResult.finalReport.overallGrade.grade}`);
      console.log(`   Score: ${stopResult.finalReport.overallGrade.score}/100`);
      console.log(`   Memory Growth: ${stopResult.finalReport.memoryAnalysis.memoryGrowthMB} MB`);
      console.log(`   Total Alerts: ${stopResult.finalReport.alertSummary.totalAlerts}`);

      await integration.cleanup();
    }, 30000); // Stop after 30 seconds for demo

  } catch (error) {
    console.error('❌ Demo failed:', error);
    await integration.cleanup();
  }
}

/**
 * Demo 2: High-frequency monitoring with aggressive optimization
 */
async function runHighFrequencySession() {
  console.log('🚀 Starting Demo 2: High-Frequency Monitoring');
  console.log('=' .repeat(60));

  const integration = new ExtendedSessionIntegration();

  try {
    // Initialize with high-frequency settings
    await integration.initialize({
      sessionDuration: 2 * 60 * 60 * 1000, // 2 hours for demo
      memorySnapshotInterval: 10000,        // 10 seconds
      healthCheckInterval: 15000,           // 15 seconds
      enableAutomaticOptimization: true,
      optimizationInterval: 30000,          // 30 seconds
      enableDetailedLogging: true,
      enableProgressTracking: true
    });

    // Enhanced progress tracking
    let lastMemoryReport = 0;
    integration.subscribeToProgress((report) => {
      const now = Date.now();
      if (now - lastMemoryReport > 60000) { // Report memory every minute
        console.log(`💾 Memory Report:`);
        console.log(`   Snapshots: ${report.statistics.memorySnapshots}`);
        console.log(`   Optimizations: ${report.statistics.optimizationCycles}`);
        console.log(`   Memory Reclaimed: ${(report.statistics.totalMemoryReclaimed / 1024 / 1024).toFixed(2)} MB`);
        lastMemoryReport = now;
      }
    });

    // All alerts for high-frequency monitoring
    integration.subscribeToAlerts((alert) => {
      const icon = alert.severity === 'critical' ? '🚨' :
                   alert.severity === 'high' ? '⚠️' :
                   alert.severity === 'medium' ? '⚡' : 'ℹ️';

      console.log(`${icon} [${alert.severity.toUpperCase()}] ${alert.message}`);

      if (alert.details && Object.keys(alert.details).length > 0) {
        console.log(`   Details:`, alert.details);
      }
    });

    // Start with aggressive settings
    const result = await integration.startExtendedSessionTest({
      testerOptions: {
        maxMemoryGrowthMB: 50,              // Stricter memory limits
        maxMemoryLeakRateMBPerHour: 5,      // Stricter leak detection
        minPerformanceScore: 90              // Higher performance requirements
      },
      optimizerOptions: {
        thresholds: {
          memoryUtilization: 0.75,          // Lower threshold for optimization
          frameRateDrop: 50,                // Higher sensitivity
          responseTime: 100                 // Stricter response time requirements
        }
      }
    });

    console.log('✅ High-frequency session started');
    console.log('📊 Monitoring every 10 seconds with optimization every 30 seconds');

    // Manual optimization demo after 1 minute
    setTimeout(async () => {
      console.log('⚡ Triggering manual optimization...');
      const optimizationResult = await integration.triggerManualOptimization();

      console.log('📈 Optimization Results:');
      console.log(`   Strategies Executed: ${optimizationResult.strategiesExecuted.length}`);
      console.log(`   Memory Reclaimed: ${(optimizationResult.totalMemoryReclaimed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Performance Gain: ${optimizationResult.totalPerformanceGain.toFixed(2)}%`);

      optimizationResult.strategiesExecuted.forEach(strategy => {
        console.log(`   - ${strategy.name}: ${strategy.success ? '✅' : '❌'}`);
      });
    }, 60000);

    // Stop after 2 minutes for demo
    setTimeout(async () => {
      console.log('🛑 Stopping high-frequency demo...');
      const stopResult = await integration.stopExtendedSessionTest();

      console.log('📊 High-Frequency Session Summary:');
      console.log(`   Optimization Cycles: ${stopResult.integrationReport.optimization.totalOptimizationCycles}`);
      console.log(`   Total Memory Reclaimed: ${stopResult.integrationReport.optimization.totalMemoryReclaimed}`);
      console.log(`   GC Effectiveness: ${stopResult.integrationReport.optimization.garbageCollectionStats.effectiveGCs}/${stopResult.integrationReport.optimization.garbageCollectionStats.forcedGCs}`);

      await integration.cleanup();
    }, 120000);

  } catch (error) {
    console.error('❌ High-frequency demo failed:', error);
    await integration.cleanup();
  }
}

/**
 * Demo 3: Memory leak detection focus
 */
async function runMemoryLeakDetectionSession() {
  console.log('🚀 Starting Demo 3: Memory Leak Detection Focus');
  console.log('=' .repeat(60));

  const integration = new ExtendedSessionIntegration();

  try {
    // Initialize with memory leak detection focus
    await integration.initialize({
      sessionDuration: 1 * 60 * 60 * 1000, // 1 hour
      memorySnapshotInterval: 5000,         // 5 seconds - very frequent for leak detection
      healthCheckInterval: 10000,           // 10 seconds
      enableAutomaticOptimization: true,
      enableDetailedLogging: true
    });

    // Memory-specific progress tracking
    integration.subscribeToProgress((report) => {
      if (report.statistics.memorySnapshots % 10 === 0) { // Every 10 snapshots
        console.log(`🔍 Memory Analysis Snapshot ${report.statistics.memorySnapshots}:`);
        console.log(`   Total Memory Snapshots: ${report.statistics.memorySnapshots}`);
        console.log(`   Current Status: ${report.health.status}`);
      }
    });

    // Focus on memory-related alerts
    integration.subscribeToAlerts((alert) => {
      if (alert.type.includes('memory') || alert.type.includes('leak')) {
        console.log(`🧠 MEMORY ALERT: ${alert.message}`);
        if (alert.details) {
          console.log(`   Severity: ${alert.severity}`);
          console.log(`   Growth Rate: ${alert.details.growthRate || 'N/A'} MB/hr`);
          console.log(`   Component: ${alert.details.component || 'N/A'}`);
        }
      }
    });

    // Start with leak detection focus
    const result = await integration.startExtendedSessionTest({
      testerOptions: {
        maxMemoryGrowthMB: 25,              // Very strict for leak detection
        maxMemoryLeakRateMBPerHour: 2,      // Very strict leak detection
        enableMemoryLeakDetection: true,
        memoryLeakDetectionSensitivity: 'high'
      }
    });

    console.log('✅ Memory leak detection session started');
    console.log('🔍 Monitoring for memory leaks with high sensitivity');

    // Simulate memory pressure to test leak detection
    setTimeout(async () => {
      console.log('💾 Simulating memory pressure for leak detection testing...');

      // Create some temporary objects to simulate memory pressure
      const tempArrays = [];
      for (let i = 0; i < 100; i++) {
        tempArrays.push(new Array(10000).fill(Math.random()));
      }

      console.log(`📊 Created ${tempArrays.length} temporary arrays for pressure testing`);

      // Clear references after 10 seconds
      setTimeout(() => {
        tempArrays.length = 0;
        console.log('🧹 Cleared temporary arrays - testing garbage collection');

        // Force garbage collection to test cleanup
        integration.forceGarbageCollection();
      }, 10000);
    }, 30000);

    // Stop after 3 minutes for demo
    setTimeout(async () => {
      console.log('🛑 Stopping memory leak detection demo...');
      const stopResult = await integration.stopExtendedSessionTest();

      console.log('📊 Memory Leak Detection Summary:');
      console.log(`   Total Memory Leaks: ${stopResult.finalReport.summary.totalMemoryLeaks}`);
      console.log(`   Memory Growth: ${stopResult.finalReport.memoryAnalysis.memoryGrowthMB} MB`);
      console.log(`   Memory Stable: ${stopResult.finalReport.memoryAnalysis.memoryStable ? '✅' : '❌'}`);

      // Show leak analysis if available
      if (stopResult.finalReport.memoryAnalysis.memoryGrowthRate > 0) {
        console.log(`   Growth Rate: ${stopResult.finalReport.memoryAnalysis.memoryGrowthRate} MB/hr`);
      }

      await integration.cleanup();
    }, 180000);

  } catch (error) {
    console.error('❌ Memory leak detection demo failed:', error);
    await integration.cleanup();
  }
}

/**
 * Demo 4: Professional trading simulation
 */
async function runProfessionalTradingSimulation() {
  console.log('🚀 Starting Demo 4: Professional Trading Simulation');
  console.log('=' .repeat(60));

  const integration = new ExtendedSessionIntegration();

  try {
    // Initialize with trading simulation focus
    await integration.initialize({
      sessionDuration: 3 * 60 * 60 * 1000, // 3 hours
      memorySnapshotInterval: 30000,        // 30 seconds
      healthCheckInterval: 60000,           // 1 minute
      enableProfessionalTradingSimulation: true,
      enableProgressTracking: true,
      enableDetailedLogging: true
    });

    // Trading-specific progress tracking
    integration.subscribeToProgress((report) => {
      console.log(`💹 Trading Session Update:`);
      console.log(`   Trading Operations: ${report.statistics.tradingOperations}`);
      console.log(`   Active Displays: ${report.health.status}`);
      console.log(`   Session Progress: ${report.progress.percentage}%`);
    });

    // Professional trading alerts
    integration.subscribeToAlerts((alert) => {
      if (alert.type.includes('trading') || alert.type.includes('display')) {
        console.log(`💼 TRADING ALERT: ${alert.message}`);
      }
    });

    // Start with professional trading settings
    const result = await integration.startExtendedSessionTest({
      testerOptions: {
        enableProfessionalTradingSimulation: true,
        minPerformanceScore: 85,            // Higher requirements for trading
        maxResponseTime: 50,                // Stricter response time
        maxMemoryLeakRateMBPerHour: 8
      },
      testConfig: {
        tradingSimulation: {
          enableMarketData: true,
          enableUserInteractions: true,
          enableDisplayManagement: true,
          symbols: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD'],
          updateFrequency: 100               // 10 updates per second
        }
      }
    });

    console.log('✅ Professional trading simulation started');
    console.log('💼 Simulating realistic professional trading workflows');

    // Monitor trading-specific metrics
    setInterval(() => {
      const status = integration.getSessionStatus();
      if (status.tester && status.tester.tradingOperations) {
        console.log(`💹 Live Trading Stats:`);
        console.log(`   Operations/sec: ${(status.tester.tradingOperations / ((Date.now() - status.tester.startTime) / 1000)).toFixed(2)}`);
        console.log(`   Memory Growth: ${status.memoryGrowthMB || 'N/A'} MB`);
      }
    }, 60000); // Every minute

    // Stop after 4 minutes for demo
    setTimeout(async () => {
      console.log('🛑 Stopping professional trading simulation demo...');
      const stopResult = await integration.stopExtendedSessionTest();

      console.log('📊 Professional Trading Simulation Summary:');
      console.log(`   Trading Operations: ${stopResult.finalReport.summary.totalTradingOperations}`);
      console.log(`   Operations/Hour: ${stopResult.finalReport.tradingAnalysis.operationsPerHour}`);
      console.log(`   Overall Grade: ${stopResult.finalReport.overallGrade.grade}`);
      console.log(`   Professional Ready: ${stopResult.finalReport.overallGrade.score >= 85 ? '✅' : '❌'}`);

      await integration.cleanup();
    }, 240000);

  } catch (error) {
    console.error('❌ Professional trading simulation demo failed:', error);
    await integration.cleanup();
  }
}

/**
 * Run all demos sequentially
 */
async function runAllDemos() {
  console.log('🎬 Extended Session Testing Framework Demos');
  console.log('=' .repeat(80));

  const demos = [
    { name: 'Basic 8-Hour Session', fn: runBasic8HourSession },
    { name: 'High-Frequency Monitoring', fn: runHighFrequencySession },
    { name: 'Memory Leak Detection', fn: runMemoryLeakDetectionSession },
    { name: 'Professional Trading Simulation', fn: runProfessionalTradingSimulation }
  ];

  for (let i = 0; i < demos.length; i++) {
    const demo = demos[i];
    console.log(`\n🎯 Demo ${i + 1}/${demos.length}: ${demo.name}`);
    console.log('Start time:', new Date().toLocaleTimeString());

    try {
      await demo.fn();
      console.log(`✅ Demo "${demo.name}" completed successfully\n`);
    } catch (error) {
      console.error(`❌ Demo "${demo.name}" failed:`, error);
    }

    // Wait between demos
    if (i < demos.length - 1) {
      console.log('⏳ Waiting 10 seconds before next demo...\n');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }

  console.log('🏁 All demos completed!');
  console.log('📚 For more information, see README.md');
}

/**
 * Interactive demo selector
 */
async function runInteractiveDemo() {
  console.log('🎮 Extended Session Testing Framework - Interactive Demo');
  console.log('=' .repeat(60));
  console.log('Available demos:');
  console.log('1. Basic 8-Hour Session');
  console.log('2. High-Frequency Monitoring');
  console.log('3. Memory Leak Detection Focus');
  console.log('4. Professional Trading Simulation');
  console.log('5. Run All Demos');
  console.log('0. Exit');

  // In a real environment, you'd use readline or similar for interactive input
  // For this demo, we'll just run a specific demo
  const selectedDemo = 1; // Change this to run different demos

  switch (selectedDemo) {
    case 1:
      await runBasic8HourSession();
      break;
    case 2:
      await runHighFrequencySession();
      break;
    case 3:
      await runMemoryLeakDetectionSession();
      break;
    case 4:
      await runProfessionalTradingSimulation();
      break;
    case 5:
      await runAllDemos();
      break;
    default:
      console.log('👋 Exiting demo');
  }
}

// Export demo functions for external usage
export {
  runBasic8HourSession,
  runHighFrequencySession,
  runMemoryLeakDetectionSession,
  runProfessionalTradingSimulation,
  runAllDemos,
  runInteractiveDemo
};

// Auto-run if this file is executed directly
if (typeof window !== 'undefined') {
  // Browser environment
  window.addEventListener('DOMContentLoaded', () => {
    console.log('🌐 Browser environment detected');
    console.log('💡 Run runInteractiveDemo() to start interactive demos');
  });
} else if (typeof process !== 'undefined' && process.argv) {
  // Node.js environment
  if (process.argv[1] === import.meta.url.replace('file://', '')) {
    console.log('🖥️ Node.js environment detected');
    console.log('💡 Run: node demo-real-session.js');

    // Run a basic demo for Node.js environment
    runBasic8HourSession().catch(console.error);
  }
}

export default {
  runBasic8HourSession,
  runHighFrequencySession,
  runMemoryLeakDetectionSession,
  runProfessionalTradingSimulation,
  runAllDemos,
  runInteractiveDemo
};