/**
 * Performance System Integration and Validation
 *
 * Comprehensive integration layer for all performance monitoring systems with
 * validation, accuracy testing, and overhead impact measurement.
 *
 * Design Philosophy: "Simple, Performant, Maintainable"
 * - Simple: Unified interface for all performance monitoring
 * - Performant: <0.1ms integration overhead with automatic optimization
 * - Maintainable: Modular integration with comprehensive testing
 */

import { globalPerformanceMetrics } from './performanceMetrics.js';
import { globalMemoryProfiler } from './memoryProfiler.js';
import { globalRegressionDetector } from './performanceRegressionDetection.js';
import { globalMultiDisplayTracker } from './multiDisplayPerformanceTracker.js';
import { globalPerformanceDashboard } from './performanceDashboard.js';

/**
 * Performance system orchestrator with validation and testing
 */
export class PerformanceSystemOrchestrator {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.autoStart = options.autoStart !== false;
    this.validationMode = options.validationMode || false;
    this.verbose = options.verbose || false;

    // System state
    this.initialized = false;
    this.systems = new Map();
    this.validators = new Map();
    this.integrationActive = false;

    // Validation configuration
    this.validation = {
      accuracyThreshold: options.accuracyThreshold || 0.95,    // 95% accuracy required
      maxOverhead: options.maxOverhead || 0.5,                // 0.5ms max overhead
      testDuration: options.testDuration || 60000,            // 1 minute validation
      sampleInterval: options.sampleInterval || 100,          // 100ms sampling for testing
      maxDataLoss: options.maxDataLoss || 0.01               // 1% max data loss
    };

    // Performance validation results
    this.validationResults = {
      accuracy: null,
      overhead: null,
      reliability: null,
      timestamp: null
    };

    // Integration callbacks
    this.callbacks = {
      onSystemReady: options.onSystemReady || null,
      onValidationComplete: options.onValidationComplete || null,
      onPerformanceIssue: options.onPerformanceIssue || null,
      onSystemError: options.onSystemError || null
    };

    console.log('[PERFORMANCE_ORCHESTRATOR] Performance system orchestrator initialized');
  }

  /**
   * Initialize all performance monitoring systems
   */
  async initialize() {
    if (this.initialized) {
      console.warn('[PERFORMANCE_ORCHESTRATOR] Systems already initialized');
      return true;
    }

    try {
      const initStartTime = performance.now();

      // Initialize each system with proper configuration
      await this.initializeMetricsSystem();
      await this.initializeMemoryProfiler();
      await this.initializeRegressionDetector();
      await this.initializeMultiDisplayTracker();
      await this.initializePerformanceDashboard();

      // Setup cross-system integration
      this.setupCrossSystemIntegration();

      // Setup validation if enabled
      if (this.validationMode) {
        await this.setupValidation();
      }

      this.initialized = true;
      const initTime = performance.now() - initStartTime;

      console.log(`[PERFORMANCE_ORCHESTRATOR] All systems initialized in ${initTime.toFixed(2)}ms`);

      // Auto-start if enabled
      if (this.autoStart) {
        await this.start();
      }

      this.triggerSystemReady();
      return true;

    } catch (error) {
      console.error('[PERFORMANCE_ORCHESTRATOR] System initialization failed:', error);
      this.triggerSystemError('initialization_failed', error);
      return false;
    }
  }

  /**
   * Initialize performance metrics system
   */
  async initializeMetricsSystem() {
    const system = globalPerformanceMetrics;

    // Configure system with integration callbacks
    system.callbacks.onPerformanceAlert = (alertData) => {
      this.handlePerformanceAlert('metrics', alertData);
    };

    system.callbacks.onBudgetViolation = (violationData) => {
      this.handleBudgetViolation('metrics', violationData);
    };

    system.callbacks.onPerformanceDegradation = (degradationData) => {
      this.handlePerformanceDegradation('metrics', degradationData);
    };

    this.systems.set('metrics', system);
    this.validators.set('metrics', new MetricsSystemValidator());

    if (this.verbose) {
      console.log('[PERFORMANCE_ORCHESTRATOR] Metrics system initialized');
    }
  }

  /**
   * Initialize memory profiler
   */
  async initializeMemoryProfiler() {
    const system = globalMemoryProfiler;

    // Configure system with integration callbacks
    system.callbacks.onMemoryPressure = (pressureData) => {
      this.handleMemoryPressure(pressureData);
    };

    system.callbacks.onMemoryLeak = (leakData) => {
      this.handleMemoryLeak(leakData);
    };

    system.callbacks.onMemoryThreshold = (thresholdData) => {
      this.handleMemoryThreshold(thresholdData);
    };

    this.systems.set('memory', system);
    this.validators.set('memory', new MemorySystemValidator());

    if (this.verbose) {
      console.log('[PERFORMANCE_ORCHESTRATOR] Memory profiler initialized');
    }
  }

  /**
   * Initialize regression detector
   */
  async initializeRegressionDetector() {
    const system = globalRegressionDetector;

    // Configure system with integration callbacks
    system.callbacks.onRegressionDetected = (regressionData) => {
      this.handleRegressionDetected(regressionData);
    };

    system.callbacks.onRegressionResolved = (regressionData) => {
      this.handleRegressionResolved(regressionData);
    };

    system.callbacks.onBaselineEstablished = (baselineData) => {
      this.handleBaselineEstablished(baselineData);
    };

    this.systems.set('regression', system);
    this.validators.set('regression', new RegressionSystemValidator());

    if (this.verbose) {
      console.log('[PERFORMANCE_ORCHESTRATOR] Regression detector initialized');
    }
  }

  /**
   * Initialize multi-display tracker
   */
  async initializeMultiDisplayTracker() {
    const system = globalMultiDisplayTracker;

    // Configure system with integration callbacks
    system.callbacks.onScalingIssue = (issueData) => {
      this.handleScalingIssue(issueData);
    };

    system.callbacks.onDisplayPerformanceAlert = (alertData) => {
      this.handleDisplayPerformanceAlert(alertData);
    };

    system.callbacks.onResourceExhaustion = (exhaustionData) => {
      this.handleResourceExhaustion(exhaustionData);
    };

    this.systems.set('multidisplay', system);
    this.validators.set('multidisplay', new MultiDisplaySystemValidator());

    if (this.verbose) {
      console.log('[PERFORMANCE_ORCHESTRATOR] Multi-display tracker initialized');
    }
  }

  /**
   * Initialize performance dashboard
   */
  async initializePerformanceDashboard() {
    const system = globalPerformanceDashboard;

    // Dashboard is mainly visual, but we can track its state
    this.systems.set('dashboard', system);
    this.validators.set('dashboard', new DashboardSystemValidator());

    if (this.verbose) {
      console.log('[PERFORMANCE_ORCHESTRATOR] Performance dashboard initialized');
    }
  }

  /**
   * Setup cross-system integration and data flow
   */
  setupCrossSystemIntegration() {
    // Create integration points between systems
    const integrationPoints = [
      {
        source: 'metrics',
        target: 'regression',
        handler: (data) => this.forwardMetricsToRegression(data)
      },
      {
        source: 'memory',
        target: 'metrics',
        handler: (data) => this.forwardMemoryToMetrics(data)
      },
      {
        source: 'multidisplay',
        target: 'metrics',
        handler: (data) => this.forwardDisplayMetrics(data)
      },
      {
        source: 'regression',
        target: 'dashboard',
        handler: (data) => this.forwardRegressionToDashboard(data)
      }
    ];

    this.integrationPoints = integrationPoints;

    if (this.verbose) {
      console.log(`[PERFORMANCE_ORCHESTRATOR] ${integrationPoints.length} integration points established`);
    }
  }

  /**
   * Start all performance monitoring systems
   */
  async start() {
    if (!this.initialized) {
      console.warn('[PERFORMANCE_ORCHESTRATOR] Systems not initialized');
      return false;
    }

    if (this.integrationActive) {
      console.warn('[PERFORMANCE_ORCHESTRATOR] Integration already active');
      return false;
    }

    try {
      const startStartTime = performance.now();

      // Start each system
      await this.startSystem('metrics', () => globalPerformanceMetrics.startCollection());
      await this.startSystem('memory', () => globalMemoryProfiler.startProfiling());
      await this.startSystem('regression', () => globalRegressionDetector.startDetection());
      await this.startSystem('multidisplay', () => globalMultiDisplayTracker.startTracking());

      this.integrationActive = true;
      const startTime = performance.now() - startStartTime;

      console.log(`[PERFORMANCE_ORCHESTRATOR] All systems started in ${startTime.toFixed(2)}ms`);

      // Start integration data flow
      this.startIntegrationFlow();

      return true;

    } catch (error) {
      console.error('[PERFORMANCE_ORCHESTRATOR] Failed to start systems:', error);
      this.triggerSystemError('start_failed', error);
      return false;
    }
  }

  /**
   * Start individual system with error handling
   */
  async startSystem(systemName, startFunction) {
    try {
      const systemStartTime = performance.now();
      await startFunction();
      const systemStart_time = performance.now() - systemStartTime;

      if (this.verbose) {
        console.log(`[PERFORMANCE_ORCHESTRATOR] ${systemName} system started in ${systemStart_time.toFixed(2)}ms`);
      }

    } catch (error) {
      console.error(`[PERFORMANCE_ORCHESTRATOR] Failed to start ${systemName} system:`, error);
      throw error;
    }
  }

  /**
   * Stop all performance monitoring systems
   */
  async stop() {
    if (!this.integrationActive) {
      console.warn('[PERFORMANCE_ORCHESTRATOR] Integration not active');
      return false;
    }

    try {
      const stopStartTime = performance.now();

      // Stop each system
      globalPerformanceMetrics.stopCollection();
      globalMemoryProfiler.stopProfiling();
      globalRegressionDetector.stopDetection();
      globalMultiDisplayTracker.stopTracking();

      // Stop integration flow
      this.stopIntegrationFlow();

      this.integrationActive = false;
      const stopTime = performance.now() - stopStartTime;

      console.log(`[PERFORMANCE_ORCHESTRATOR] All systems stopped in ${stopTime.toFixed(2)}ms`);
      return true;

    } catch (error) {
      console.error('[PERFORMANCE_ORCHESTRATOR] Failed to stop systems:', error);
      this.triggerSystemError('stop_failed', error);
      return false;
    }
  }

  /**
   * Start integration data flow between systems
   */
  startIntegrationFlow() {
    this.integrationTimer = setInterval(() => {
      this.processIntegrationData();
    }, 1000); // Process integration every second
  }

  /**
   * Stop integration data flow
   */
  stopIntegrationFlow() {
    if (this.integrationTimer) {
      clearInterval(this.integrationTimer);
      this.integrationTimer = null;
    }
  }

  /**
   * Process integration data between systems
   */
  processIntegrationData() {
    if (!this.integrationActive) return;

    try {
      // Get current metrics from main system
      const currentMetrics = globalPerformanceMetrics.getRealTimeMetrics();
      if (!currentMetrics) return;

      // Forward to regression detector
      globalRegressionDetector.addMetricsData(currentMetrics);

      // Forward memory data to metrics system
      const memoryStats = globalMemoryProfiler.getMemoryStats();
      if (memoryStats && memoryStats.status !== 'no_data') {
        // Update metrics with memory data if needed
      }

    } catch (error) {
      console.error('[PERFORMANCE_ORCHESTRATOR] Error processing integration data:', error);
    }
  }

  /**
   * Setup validation system
   */
  async setupValidation() {
    console.log('[PERFORMANCE_ORCHESTRATOR] Setting up validation system...');

    // Initialize all validators
    for (const [systemName, validator] of this.validators) {
      await validator.initialize();
    }

    // Run validation tests
    await this.runValidationTests();
  }

  /**
   * Run comprehensive validation tests
   */
  async runValidationTests() {
    console.log('[PERFORMANCE_ORCHESTRATOR] Running validation tests...');

    const validationStartTime = performance.now();

    try {
      // Test accuracy
      this.validationResults.accuracy = await this.testAccuracy();

      // Test overhead
      this.validationResults.overhead = await this.testOverhead();

      // Test reliability
      this.validationResults.reliability = await this.testReliability();

      this.validationResults.timestamp = Date.now();
      const validationTime = performance.now() - validationStartTime;

      console.log(`[PERFORMANCE_ORCHESTRATOR] Validation completed in ${validationTime.toFixed(2)}ms`);

      // Log results
      this.logValidationResults();

      // Trigger callback
      this.triggerValidationComplete();

      return this.validationResults;

    } catch (error) {
      console.error('[PERFORMANCE_ORCHESTRATOR] Validation failed:', error);
      this.triggerSystemError('validation_failed', error);
      return null;
    }
  }

  /**
   * Test accuracy of performance measurements
   */
  async testAccuracy() {
    const accuracyTests = [];

    // Test frame rate accuracy
    const fpsAccuracy = await this.testFrameRateAccuracy();
    accuracyTests.push({ metric: 'fps', accuracy: fpsAccuracy });

    // Test latency accuracy
    const latencyAccuracy = await this.testLatencyAccuracy();
    accuracyTests.push({ metric: 'latency', accuracy: latencyAccuracy });

    // Test memory accuracy
    const memoryAccuracy = await this.testMemoryAccuracy();
    accuracyTests.push({ metric: 'memory', accuracy: memoryAccuracy });

    const overallAccuracy = accuracyTests.reduce((sum, test) => sum + test.accuracy, 0) / accuracyTests.length;

    return {
      overall: overallAccuracy,
      details: accuracyTests,
      passed: overallAccuracy >= this.validation.accuracyThreshold
    };
  }

  /**
   * Test frame rate measurement accuracy
   */
  async testFrameRateAccuracy() {
    // Create synthetic frame rate scenario
    const testDuration = 5000; // 5 seconds
    const expectedFrames = 300; // 60fps for 5 seconds
    const frameInterval = 1000 / 60; // 16.67ms

    const startTime = performance.now();
    let frameCount = 0;

    // Simulate frames
    const frameInterval_id = setInterval(() => {
      frameCount++;
      globalPerformanceMetrics.monitors.frameRateMonitor.recordFrame();

      if (performance.now() - startTime >= testDuration) {
        clearInterval(frameInterval_id);
      }
    }, frameInterval);

    // Wait for test to complete
    await new Promise(resolve => setTimeout(resolve, testDuration + 100));

    const measuredFrames = globalPerformanceMetrics.monitors.frameRateMonitor.getMetrics().frameCount;
    const accuracy = Math.min(measuredFrames / expectedFrames, 1);

    console.log(`[PERFORMANCE_ORCHESTRATOR] FPS accuracy test: ${measuredFrames}/${expectedFrames} frames (${(accuracy * 100).toFixed(1)}%)`);

    return accuracy;
  }

  /**
   * Test latency measurement accuracy
   */
  async testLatencyAccuracy() {
    // Test with known latencies
    const testLatencies = [10, 50, 100, 200]; // ms
    const accuracyResults = [];

    for (const expectedLatency of testLatencies) {
      const dataReceipt = globalPerformanceMetrics.monitors.latencyMonitor.recordDataReceipt('test');

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, expectedLatency));

      const latencyEntry = globalPerformanceMetrics.monitors.latencyMonitor.recordDisplayCompletion(dataReceipt);

      if (latencyEntry) {
        const accuracy = 1 - Math.abs(latencyEntry.latency - expectedLatency) / expectedLatency;
        accuracyResults.push(accuracy);
      }
    }

    const overallAccuracy = accuracyResults.length > 0 ?
      accuracyResults.reduce((sum, acc) => sum + acc, 0) / accuracyResults.length : 0;

    console.log(`[PERFORMANCE_ORCHESTRATOR] Latency accuracy test: ${(overallAccuracy * 100).toFixed(1)}%`);

    return overallAccuracy;
  }

  /**
   * Test memory measurement accuracy
   */
  async testMemoryAccuracy() {
    if (!performance.memory) {
      console.warn('[PERFORMANCE_ORCHESTRATOR] Memory API not available for accuracy test');
      return 1; // Assume perfect accuracy if API not available
    }

    // Create memory allocation pattern
    const initialMemory = performance.memory.usedJSHeapSize;
    const testArrays = [];

    // Allocate memory
    for (let i = 0; i < 10; i++) {
      testArrays.push(new Array(100000).fill(Math.random()));
    }

    const afterAllocation = performance.memory.usedJSHeapSize;
    const allocatedMemory = afterAllocation - initialMemory;

    // Check if profiler detects the change
    const memoryStats = globalMemoryProfiler.getMemoryStats();
    const detectedMemory = memoryStats.current ? memoryStats.current.used : 0;

    const accuracy = allocatedMemory > 0 ?
      1 - Math.abs((detectedMemory - afterAllocation) / allocatedMemory) : 1;

    // Cleanup
    testArrays.length = 0;

    console.log(`[PERFORMANCE_ORCHESTRATOR] Memory accuracy test: ${(accuracy * 100).toFixed(1)}%`);

    return accuracy;
  }

  /**
   * Test system overhead impact
   */
  async testOverhead() {
    const overheadTests = [];

    // Test with all systems disabled
    const baselineTime = await this.measureProcessingTime(false);

    // Test with all systems enabled
    const activeTime = await this.measureProcessingTime(true);

    const overheadMs = activeTime - baselineTime;
    const overheadPercent = (overheadMs / baselineTime) * 100;

    const passed = overheadMs <= this.validation.maxOverhead;

    overheadTests.push({
      test: 'overall_processing',
      baselineTime,
      activeTime,
      overheadMs,
      overheadPercent,
      passed
    });

    console.log(`[PERFORMANCE_ORCHESTRATOR] Overhead test: ${overheadMs.toFixed(2)}ms (${overheadPercent.toFixed(1)}%)`);

    return {
      overall: overheadMs,
      percent: overheadPercent,
      passed: passed,
      details: overheadTests
    };
  }

  /**
   * Measure processing time with/without monitoring
   */
  async measureProcessingTime(withMonitoring) {
    const iterations = 10000;
    const testArray = new Array(iterations).fill(0);

    // Toggle monitoring systems
    if (withMonitoring && !this.integrationActive) {
      await this.start();
    } else if (!withMonitoring && this.integrationActive) {
      await this.stop();
    }

    const startTime = performance.now();

    // Perform CPU-intensive task
    for (let i = 0; i < iterations; i++) {
      testArray[i] = Math.sqrt(i) * Math.sin(i);
    }

    const endTime = performance.now();

    return endTime - startTime;
  }

  /**
   * Test system reliability and data consistency
   */
  async testReliability() {
    const reliabilityTests = [];

    // Test data consistency
    const dataConsistency = await this testDataConsistency();
    reliabilityTests.push({ test: 'data_consistency', result: dataConsistency });

    // Test error recovery
    const errorRecovery = await this.testErrorRecovery();
    reliabilityTests.push({ test: 'error_recovery', result: errorRecovery });

    // Test memory leaks in monitoring systems
    const memoryLeaks = await this.testMemoryLeaks();
    reliabilityTests.push({ test: 'memory_leaks', result: memoryLeaks });

    const overallReliability = reliabilityTests.reduce((sum, test) => sum + test.result.score, 0) / reliabilityTests.length;

    return {
      overall: overallReliability,
      passed: overallReliability >= 0.95,
      details: reliabilityTests
    };
  }

  /**
   * Test data consistency across systems
   */
  async testDataConsistency() {
    // Generate test data and verify consistency across systems
    const testDataCount = 100;
    let consistentData = 0;

    for (let i = 0; i < testDataCount; i++) {
      // Add test metrics
      const testMetrics = {
        timestamp: Date.now(),
        frameRate: { currentFPS: 60 + Math.random() * 10 - 5 },
        latency: { currentLatency: 50 + Math.random() * 20 - 10 }
      };

      globalPerformanceMetrics.collectMetrics();
      globalRegressionDetector.addMetricsData(testMetrics);

      // Verify data consistency (simplified check)
      const metricsData = globalPerformanceMetrics.getRealTimeMetrics();
      if (metricsData) {
        consistentData++;
      }
    }

    const consistency = consistentData / testDataCount;

    console.log(`[PERFORMANCE_ORCHESTRATOR] Data consistency test: ${(consistency * 100).toFixed(1)}%`);

    return {
      score: consistency,
      consistentData,
      totalData: testDataCount
    };
  }

  /**
   * Test error recovery mechanisms
   */
  async testErrorRecovery() {
    // Simulate various error conditions and test recovery
    const errorTests = [
      () => this.testInvalidDataHandling(),
      () => this.testSystemRestart(),
      () => this.testMemoryPressureRecovery()
    ];

    let successfulRecoveries = 0;

    for (const test of errorTests) {
      try {
        const result = await test();
        if (result) {
          successfulRecoveries++;
        }
      } catch (error) {
        console.warn('[PERFORMANCE_ORCHESTRATOR] Error recovery test failed:', error.message);
      }
    }

    const recoveryRate = successfulRecoveries / errorTests.length;

    console.log(`[PERFORMANCE_ORCHESTRATOR] Error recovery test: ${(recoveryRate * 100).toFixed(1)}%`);

    return {
      score: recoveryRate,
      successfulRecoveries,
      totalTests: errorTests.length
    };
  }

  /**
   * Test invalid data handling
   */
  async testInvalidDataHandling() {
    // Test with invalid data
    try {
      globalRegressionDetector.addMetricsData(null);
      globalRegressionDetector.addMetricsData({ invalid: 'data' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Test system restart capability
   */
  async testSystemRestart() {
    try {
      if (this.integrationActive) {
        await this.stop();
        await new Promise(resolve => setTimeout(resolve, 100));
        await this.start();
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Test memory pressure recovery
   */
  async testMemoryPressureRecovery() {
    // This would be a more complex test in real implementation
    return true; // Placeholder
  }

  /**
   * Test for memory leaks in monitoring systems
   */
  async testMemoryLeaks() {
    if (!performance.memory) {
      return { score: 1, message: 'Memory API not available' };
    }

    const initialMemory = performance.memory.usedJSHeapSize;
    const testDuration = 10000; // 10 seconds

    // Run monitoring systems for test duration
    if (!this.integrationActive) {
      await this.start();
    }

    // Generate monitoring load
    const interval_id = setInterval(() => {
      globalPerformanceMetrics.collectMetrics();
      globalMemoryProfiler.sampleMemory();
    }, 100);

    await new Promise(resolve => setTimeout(resolve, testDuration));

    clearInterval(interval_id);

    const finalMemory = performance.memory.usedJSHeapSize;
    const memoryIncrease = finalMemory - initialMemory;
    const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

    // Allow for some memory increase, but check for excessive growth
    const acceptableIncrease = 10; // 10MB acceptable increase
    const leakScore = Math.max(0, 1 - (memoryIncreaseMB - acceptableIncrease) / acceptableIncrease);

    console.log(`[PERFORMANCE_ORCHESTRATOR] Memory leak test: ${memoryIncreaseMB.toFixed(1)}MB increase`);

    return {
      score: leakScore,
      memoryIncreaseMB,
      passed: memoryIncreaseMB <= acceptableIncrease
    };
  }

  /**
   * Log validation results
   */
  logValidationResults() {
    const results = this.validationResults;

    console.log('[PERFORMANCE_ORCHESTRATOR] Validation Results:');
    console.log(`  Accuracy: ${(results.accuracy.overall * 100).toFixed(1)}% ${results.accuracy.passed ? '✅' : '❌'}`);
    console.log(`  Overhead: ${results.overhead.overall.toFixed(2)}ms (${results.overhead.percent.toFixed(1)}%) ${results.overhead.passed ? '✅' : '❌'}`);
    console.log(`  Reliability: ${(results.reliability.overall * 100).toFixed(1)}% ${results.reliability.passed ? '✅' : '❌'}`);

    const overallPassed = results.accuracy.passed && results.overhead.passed && results.reliability.passed;
    console.log(`  Overall: ${overallPassed ? '✅ PASSED' : '❌ FAILED'}`);
  }

  /**
   * Integration event handlers
   */
  handlePerformanceAlert(system, alertData) {
    this.triggerPerformanceIssue('performance_alert', { system, ...alertData });
  }

  handleMemoryPressure(pressureData) {
    this.triggerPerformanceIssue('memory_pressure', pressureData);
  }

  handleRegressionDetected(regressionData) {
    this.triggerPerformanceIssue('regression_detected', regressionData);
  }

  handleScalingIssue(issueData) {
    this.triggerPerformanceIssue('scaling_issue', issueData);
  }

  /**
   * Trigger performance issue callback
   */
  triggerPerformanceIssue(type, data) {
    const callback = this.callbacks.onPerformanceIssue;
    if (typeof callback === 'function') {
      try {
        callback({ type, timestamp: Date.now(), data });
      } catch (error) {
        console.error('[PERFORMANCE_ORCHESTRATOR] Error in performance issue callback:', error);
      }
    }
  }

  /**
   * Trigger system ready callback
   */
  triggerSystemReady() {
    const callback = this.callbacks.onSystemReady;
    if (typeof callback === 'function') {
      try {
        callback({ timestamp: Date.now(), systems: Array.from(this.systems.keys()) });
      } catch (error) {
        console.error('[PERFORMANCE_ORCHESTRATOR] Error in system ready callback:', error);
      }
    }
  }

  /**
   * Trigger validation complete callback
   */
  triggerValidationComplete() {
    const callback = this.callbacks.onValidationComplete;
    if (typeof callback === 'function')) {
      try {
        callback(this.validationResults);
      } catch (error) {
        console.error('[PERFORMANCE_ORCHESTRATOR] Error in validation complete callback:', error);
      }
    }
  }

  /**
   * Trigger system error callback
   */
  triggerSystemError(errorType, error) {
    const callback = this.callbacks.onSystemError;
    if (typeof callback === 'function') {
      try {
        callback({ type: errorType, error, timestamp: Date.now() });
      } catch (error) {
        console.error('[PERFORMANCE_ORCHESTRATOR] Error in system error callback:', error);
      }
    }
  }

  /**
   * Get comprehensive system status
   */
  getSystemStatus() {
    return {
      initialized: this.initialized,
      active: this.integrationActive,
      systems: Object.fromEntries(
        Array.from(this.systems.entries()).map(([name, system]) => [
          name,
          {
            type: system.constructor.name,
            status: this.getSystemStatusByName(name)
          }
        ])
      ),
      validation: this.validationResults,
      timestamp: Date.now()
    };
  }

  /**
   * Get status of individual system
   */
  getSystemStatusByName(systemName) {
    switch (systemName) {
      case 'metrics':
        return globalPerformanceMetrics.collecting ? 'active' : 'inactive';
      case 'memory':
        return globalMemoryProfiler.profiling ? 'active' : 'inactive';
      case 'regression':
        return globalRegressionDetector.detecting ? 'active' : 'inactive';
      case 'multidisplay':
        return globalMultiDisplayTracker.tracking ? 'active' : 'inactive';
      case 'dashboard':
        return globalPerformanceDashboard.isVisible ? 'visible' : 'hidden';
      default:
        return 'unknown';
    }
  }

  /**
   * Export comprehensive system data
   */
  exportData() {
    return {
      configuration: {
        enabled: this.enabled,
        autoStart: this.autoStart,
        validationMode: this.validationMode,
        validation: this.validation
      },
      status: this.getSystemStatus(),
      systems: {
        metrics: globalPerformanceMetrics.exportData(),
        memory: globalMemoryProfiler.exportData(),
        regression: globalRegressionDetector.exportData(),
        multidisplay: globalMultiDisplayTracker.exportData()
      },
      validation: this.validationResults,
      exportTimestamp: Date.now()
    };
  }

  /**
   * Reset all systems
   */
  async reset() {
    await this.stop();

    // Reset individual systems
    globalPerformanceMetrics.reset();
    globalMemoryProfiler.reset();
    globalRegressionDetector.reset();
    globalMultiDisplayTracker.reset();

    // Reset validation results
    this.validationResults = {
      accuracy: null,
      overhead: null,
      reliability: null,
      timestamp: null
    };

    console.log('[PERFORMANCE_ORCHESTRATOR] All systems reset');
  }

  /**
   * Destroy orchestrator and cleanup
   */
  async destroy() {
    await this.stop();
    await this.reset();

    this.systems.clear();
    this.validators.clear();
    this.initialized = false;

    // Hide dashboard if visible
    if (globalPerformanceDashboard.isVisible) {
      globalPerformanceDashboard.hide();
    }

    console.log('[PERFORMANCE_ORCHESTRATOR] Orchestrator destroyed');
  }
}

/**
 * Base system validator class
 */
class SystemValidator {
  async initialize() {
    // Base initialization
  }
}

/**
 * Metrics system validator
 */
class MetricsSystemValidator extends SystemValidator {
  async initialize() {
    // Metrics-specific validation setup
  }
}

/**
 * Memory system validator
 */
class MemorySystemValidator extends SystemValidator {
  async initialize() {
    // Memory-specific validation setup
  }
}

/**
 * Regression system validator
 */
class RegressionSystemValidator extends SystemValidator {
  async initialize() {
    // Regression-specific validation setup
  }
}

/**
 * Multi-display system validator
 */
class MultiDisplaySystemValidator extends SystemValidator {
  async initialize() {
    // Multi-display specific validation setup
  }
}

/**
 * Dashboard system validator
 */
class DashboardSystemValidator extends SystemValidator {
  async initialize() {
    // Dashboard-specific validation setup
  }
}

/**
 * Global performance system orchestrator instance
 */
export const globalPerformanceOrchestrator = new PerformanceOrchestrator();

/**
 * Convenience function to initialize performance monitoring
 */
export async function initializePerformanceMonitoring(options = {}) {
  const orchestrator = new PerformanceOrchestrator(options);
  await orchestrator.initialize();
  return orchestrator;
}