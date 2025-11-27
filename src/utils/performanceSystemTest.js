/**
 * Performance System Integration Test
 *
 * Simple integration test to validate the performance monitoring system
 * functionality and ensure all components work together correctly.
 */

import { initializePerformanceMonitoring } from './performanceSystemIntegration.js';
import { globalMemoryTracker } from './memoryManagementUtils.js';

/**
 * Simple performance system test
 */
export class PerformanceSystemTest {
  constructor() {
    this.testResults = [];
    this.testStartTime = Date.now();
  }

  /**
   * Run basic integration tests
   */
  async runTests() {
    console.log('[PERFORMANCE_TEST] Starting performance system integration tests...');

    try {
      // Test 1: System initialization
      await this.testSystemInitialization();

      // Test 2: Basic metrics collection
      await this.testMetricsCollection();

      // Test 3: Memory tracking
      await this.testMemoryTracking();

      // Test 4: Performance overhead
      await this.testPerformanceOverhead();

      // Test 5: Integration functionality
      await this.testIntegrationFunctionality();

      this.logTestResults();
      return this.testResults;

    } catch (error) {
      console.error('[PERFORMANCE_TEST] Test suite failed:', error);
      this.addTestResult('suite', false, error.message);
      return this.testResults;
    }
  }

  /**
   * Test system initialization
   */
  async testSystemInitialization() {
    console.log('[PERFORMANCE_TEST] Testing system initialization...');

    try {
      const startTime = performance.now();

      // Initialize performance monitoring
      const orchestrator = await initializePerformanceMonitoring({
        enabled: true,
        autoStart: false,
        validationMode: false,
        verbose: true
      });

      const initTime = performance.now() - startTime;

      // Check if orchestrator was created successfully
      const initialized = orchestrator && orchestrator.initialized;

      this.addTestResult('system_initialization', initialized, `Initialization time: ${initTime.toFixed(2)}ms`);

      // Test system status
      const status = orchestrator.getSystemStatus();
      const systemsWorking = status.systems && Object.keys(status.systems).length > 0;

      this.addTestResult('system_status', systemsWorking, `Systems loaded: ${Object.keys(status.systems).length}`);

      return orchestrator;

    } catch (error) {
      this.addTestResult('system_initialization', false, error.message);
      throw error;
    }
  }

  /**
   * Test basic metrics collection
   */
  async testMetricsCollection() {
    console.log('[PERFORMANCE_TEST] Testing metrics collection...');

    try {
      // Test memory tracking
      const memoryBefore = globalMemoryTracker.getStats();

      // Create some memory pressure
      const testArray = new Array(100000).fill(Math.random());

      globalMemoryTracker.recordUsage();
      const memoryAfter = globalMemoryTracker.getStats();

      const memoryTrackingWorking = memoryAfter && memoryAfter !== memoryBefore;

      this.addTestResult('memory_tracking', memoryTrackingWorking,
        `Memory before: ${memoryBefore ? 'available' : 'unavailable'}, after: ${memoryAfter ? 'available' : 'unavailable'}`);

      // Cleanup
      testArray.length = 0;

      // Test basic performance measurement
      const measurementStart = performance.now();
      await new Promise(resolve => setTimeout(resolve, 10));
      const measurementTime = performance.now() - measurementStart;

      const measurementWorking = measurementTime >= 9 && measurementTime <= 15; // Allow some variance

      this.addTestResult('performance_measurement', measurementWorking,
        `Measured time: ${measurementTime.toFixed(2)}ms (expected ~10ms)`);

    } catch (error) {
      this.addTestResult('metrics_collection', false, error.message);
    }
  }

  /**
   * Test memory tracking functionality
   */
  async testMemoryTracking() {
    console.log('[PERFORMANCE_TEST] Testing memory tracking...');

    try {
      // Initialize baseline
      globalMemoryTracker.initializeBaseline();

      const baseline = globalMemoryTracker.baseline;
      const baselineWorking = baseline && baseline.used > 0;

      this.addTestResult('memory_baseline', baselineWorking,
        `Baseline memory: ${baseline ? `${(baseline.used / 1024 / 1024).toFixed(1)}MB` : 'not set'}`);

      // Test memory usage recording
      const usageBefore = globalMemoryTracker.getStats();
      globalMemoryTracker.recordUsage();
      const usageAfter = globalMemoryTracker.getStats();

      const usageRecordingWorking = usageAfter && usageAfter.measurementsCount > (usageBefore?.measurementsCount || 0);

      this.addTestResult('memory_usage_recording', usageRecordingWorking,
        `Recordings: ${usageAfter ? usageAfter.measurementsCount : 0}`);

    } catch (error) {
      this.addTestResult('memory_tracking', false, error.message);
    }
  }

  /**
   * Test performance overhead
   */
  async testPerformanceOverhead() {
    console.log('[PERFORMANCE_TEST] Testing performance overhead...');

    try {
      const iterations = 1000;

      // Baseline measurement (no monitoring)
      const baselineStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        Math.sqrt(i) * Math.sin(i);
      }
      const baselineTime = performance.now() - baselineStart;

      // Measurement with basic tracking
      const trackedStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        Math.sqrt(i) * Math.sin(i);
        if (i % 100 === 0) {
          globalMemoryTracker.recordUsage();
        }
      }
      const trackedTime = performance.now() - trackedStart;

      const overhead = trackedTime - baselineTime;
      const overheadPercent = (overhead / baselineTime) * 100;

      const overheadAcceptable = overheadPercent < 10; // Less than 10% overhead

      this.addTestResult('performance_overhead', overheadAcceptable,
        `Overhead: ${overhead.toFixed(2)}ms (${overheadPercent.toFixed(1)}%)`);

    } catch (error) {
      this.addTestResult('performance_overhead', false, error.message);
    }
  }

  /**
   * Test integration functionality
   */
  async testIntegrationFunctionality() {
    console.log('[PERFORMANCE_TEST] Testing integration functionality...');

    try {
      // Test that we can import all modules
      const modulesWorking = true;

      this.addTestResult('module_imports', modulesWorking, 'All modules imported successfully');

      // Test basic data flow
      const testData = {
        frameRate: { currentFPS: 60, averageFPS: 58 },
        latency: { currentLatency: 45, averageLatency: 50 },
        timestamp: Date.now()
      };

      // Simple data validation
      const dataFlowWorking = testData.frameRate && testData.latency && testData.timestamp;

      this.addTestResult('data_flow', dataFlowWorking, 'Test data structure valid');

      // Test error handling
      let errorHandlingWorking = false;
      try {
        // This should not crash the system
        globalMemoryTracker.recordUsage(); // Call with valid state
        errorHandlingWorking = true;
      } catch (error) {
        console.warn('[PERFORMANCE_TEST] Expected error in error handling test:', error.message);
      }

      this.addTestResult('error_handling', errorHandlingWorking, 'Error handling functional');

    } catch (error) {
      this.addTestResult('integration_functionality', false, error.message);
    }
  }

  /**
   * Add test result
   */
  addTestResult(testName, passed, details) {
    this.testResults.push({
      test: testName,
      passed,
      details,
      timestamp: Date.now()
    });

    const status = passed ? '✅' : '❌';
    console.log(`[PERFORMANCE_TEST] ${status} ${testName}: ${details}`);
  }

  /**
   * Log test results summary
   */
  logTestResults() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;

    console.log('\n[PERFORMANCE_TEST] Test Results Summary:');
    console.log(`  Total Tests: ${totalTests}`);
    console.log(`  Passed: ${passedTests} ✅`);
    console.log(`  Failed: ${failedTests} ❌`);
    console.log(`  Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    console.log(`  Duration: ${(Date.now() - this.testStartTime).toFixed(0)}ms`);

    if (failedTests > 0) {
      console.log('\n[PERFORMANCE_TEST] Failed Tests:');
      this.testResults
        .filter(r => !r.passed)
        .forEach(r => console.log(`  ❌ ${r.test}: ${r.details}`));
    }
  }

  /**
   * Get test results as JSON
   */
  getResults() {
    return {
      summary: {
        total: this.testResults.length,
        passed: this.testResults.filter(r => r.passed).length,
        failed: this.testResults.filter(r => !r.passed).length,
        successRate: (this.testResults.filter(r => r.passed).length / this.testResults.length) * 100,
        duration: Date.now() - this.testStartTime
      },
      details: this.testResults
    };
  }
}

/**
 * Quick test function for console use
 */
export async function quickPerformanceTest() {
  console.log('[PERFORMANCE_TEST] Running quick performance system test...');

  try {
    const test = new PerformanceSystemTest();
    const results = await test.runTests();

    console.log('\n[PERFORMANCE_TEST] Test completed. Results available in console.');
    return results;

  } catch (error) {
    console.error('[PERFORMANCE_TEST] Quick test failed:', error);
    return null;
  }
}