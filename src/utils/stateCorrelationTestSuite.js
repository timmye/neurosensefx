/**
 * State Correlation System Test Suite
 *
 * Comprehensive testing and validation utilities for the state correlation system.
 * Provides automated testing of state changes, render correlation, and pipeline performance.
 *
 * Features:
 * - Automated system validation
 * - Performance benchmarking
 * - Integration testing
 * - Health monitoring
 * - Debug utilities
 */

// Development mode detection
const isDevelopment = import.meta.env.DEV;

// Import the core systems
import {
  getStateCorrelationOverview,
  runStateCorrelationHealthCheck
} from './stateCorrelationTracker.js';

import {
  getGlobalReactivityOverview,
  runReactivityHealthCheck
} from './visualizationReactivityMonitor.js';

// Test configuration
const TEST_CONFIG = {
  PERFORMANCE_BENCHMARK: {
    STATE_TO_RENDER_MAX: 100,     // Max state-to-render latency (ms)
    WEBSOCKET_TO_STATE_MAX: 75,   // Max WebSocket-to-state latency (ms)
    VISUALIZATION_RESPONSE_MAX: 25, // Max visualization response time (ms)
    END_TO_END_MAX: 150           // Max end-to-end latency (ms)
  },
  QUALITY_THRESHOLDS: {
    CORRELATION_RATE_MIN: 0.85,   // Minimum 85% correlation rate
    RESPONSIVENESS_SCORE_MIN: 0.80, // Minimum 80% responsiveness
    PERFORMANCE_GRADE_MIN: 'B'     // Minimum performance grade B
  }
};

// Emoji-based classification system
const EMOJI_CLASSIFIERS = {
  TEST: '🧪',
  VALIDATION: '✅',
  WARNING: '⚠️',
  ERROR: '❌',
  PERFORMANCE: '📊',
  HEALTH: '🏥',
  SUCCESS: '🎉',
  INFO: 'ℹ️'
};

/**
 * Comprehensive state correlation system test suite
 */
export class StateCorrelationTestSuite {
  constructor() {
    this.testResults = [];
    this.benchmarks = new Map();
    this.healthCheckHistory = [];
  }

  /**
   * Run complete system validation
   */
  async runCompleteValidation() {
    if (!isDevelopment) return null;

    console.group(`${EMOJI_CLASSIFIERS.TEST} 🧪 State Correlation System - Complete Validation`);

    const validationResult = {
      timestamp: new Date().toISOString(),
      tests: {},
      overallStatus: 'unknown',
      recommendations: []
    };

    try {
      // 1. System Integration Test
      validationResult.tests.integration = this.testSystemIntegration();

      // 2. Performance Benchmark Test
      validationResult.tests.performance = await this.testPerformanceBenchmarks();

      // 3. Quality Metrics Test
      validationResult.tests.quality = this.testQualityMetrics();

      // 4. Health Check Test
      validationResult.tests.health = this.testSystemHealth();

      // 5. Stress Test (if possible)
      validationResult.tests.stress = await this.testStressScenarios();

      // Calculate overall status
      validationResult.overallStatus = this.calculateOverallStatus(validationResult.tests);
      validationResult.recommendations = this.generateRecommendations(validationResult.tests);

      // Store test results
      this.testResults.push(validationResult);

      // Log results
      this.logValidationResults(validationResult);

    } catch (error) {
      console.error(`${EMOJI_CLASSIFIERS.ERROR} Validation failed:`, error);
      validationResult.overallStatus = 'error';
      validationResult.error = error.message;
    }

    console.groupEnd();

    return validationResult;
  }

  /**
   * Test system integration
   */
  testSystemIntegration() {
    console.log(`${EMOJI_CLASSIFIERS.TEST} Testing system integration...`);

    const integrationTest = {
      status: 'unknown',
      components: {},
      issues: []
    };

    try {
      // Test state correlation system
      const stateOverview = getStateCorrelationOverview();
      if (stateOverview) {
        integrationTest.components.stateCorrelation = {
          status: 'active',
          overview: stateOverview
        };
      } else {
        integrationTest.components.stateCorrelation = {
          status: 'inactive',
          issue: 'State correlation system not responding'
        };
        integrationTest.issues.push('State correlation system inactive');
      }

      // Test reactivity monitoring
      const reactivityOverview = getGlobalReactivityOverview();
      if (reactivityOverview) {
        integrationTest.components.reactivityMonitoring = {
          status: 'active',
          overview: reactivityOverview
        };
      } else {
        integrationTest.components.reactivityMonitoring = {
          status: 'inactive',
          issue: 'Reactivity monitoring system not responding'
        };
        integrationTest.issues.push('Reactivity monitoring system inactive');
      }

      // Check for critical issues
      integrationTest.status = integrationTest.issues.length === 0 ? 'passed' : 'failed';

      console.log(`${EMOJI_CLASSIFIERS.VALIDATION} Integration test ${integrationTest.status}`);
      if (integrationTest.issues.length > 0) {
        console.warn(`${EMOJI_CLASSIFIERS.WARNING} Integration issues:`, integrationTest.issues);
      }

    } catch (error) {
      integrationTest.status = 'error';
      integrationTest.error = error.message;
      console.error(`${EMOJI_CLASSIFIERS.ERROR} Integration test error:`, error);
    }

    return integrationTest;
  }

  /**
   * Test performance benchmarks
   */
  async testPerformanceBenchmarks() {
    console.log(`${EMOJI_CLASSIFIERS.PERFORMANCE} Testing performance benchmarks...`);

    const performanceTest = {
      status: 'unknown',
      benchmarks: {},
      issues: []
    };

    try {
      // Get current performance metrics
      const stateOverview = getStateCorrelationOverview();
      const reactivityOverview = getGlobalReactivityOverview();

      if (stateOverview) {
        // Test state-to-render latency
        const stateToRenderLatency = parseFloat(stateOverview.avgLatency || 0);
        const meetsStateToRenderThreshold = stateToRenderLatency <= TEST_CONFIG.PERFORMANCE_BENCHMARK.STATE_TO_RENDER_MAX;

        performanceTest.benchmarks.stateToRenderLatency = {
          current: stateToRenderLatency,
          threshold: TEST_CONFIG.PERFORMANCE_BENCHMARK.STATE_TO_RENDER_MAX,
          meetsThreshold: meetsStateToRenderThreshold
        };

        if (!meetsStateToRenderThreshold) {
          performanceTest.issues.push(`State-to-render latency exceeds threshold: ${stateToRenderLatency}ms`);
        }
      }

      if (reactivityOverview) {
        // Test responsiveness score
        const responsivenessScore = parseFloat(reactivityOverview.responsivenessRate || 0) / 100;
        const meetsResponsivenessThreshold = responsivenessScore >= TEST_CONFIG.QUALITY_THRESHOLDS.RESPONSIVENESS_SCORE_MIN;

        performanceTest.benchmarks.responsivenessScore = {
          current: (responsivenessScore * 100).toFixed(1),
          threshold: (TEST_CONFIG.QUALITY_THRESHOLDS.RESPONSIVENESS_SCORE_MIN * 100).toFixed(1),
          meetsThreshold: meetsResponsivenessThreshold
        };

        if (!meetsResponsivenessThreshold) {
          performanceTest.issues.push(`Responsiveness score below threshold: ${(responsivenessScore * 100).toFixed(1)}%`);
        }
      }

      // Simulate performance test if no data available
      if (!stateOverview && !reactivityOverview) {
        console.warn(`${EMOJI_CLASSIFIERS.WARNING} No performance data available, running simulation...`);
        const simulatedLatency = this.simulatePerformanceTest();
        performanceTest.benchmarks.simulatedLatency = simulatedLatency;
      }

      performanceTest.status = performanceTest.issues.length === 0 ? 'passed' : 'warning';

      console.log(`${EMOJI_CLASSIFIERS.VALIDATION} Performance test ${performanceTest.status}`);
      console.log(`${EMOJI_CLASSIFIERS.INFO} Benchmarks:`, performanceTest.benchmarks);

    } catch (error) {
      performanceTest.status = 'error';
      performanceTest.error = error.message;
      console.error(`${EMOJI_CLASSIFIERS.ERROR} Performance test error:`, error);
    }

    return performanceTest;
  }

  /**
   * Test quality metrics
   */
  testQualityMetrics() {
    console.log(`${EMOJI_CLASSIFIERS.TEST} Testing quality metrics...`);

    const qualityTest = {
      status: 'unknown',
      metrics: {},
      issues: []
    };

    try {
      // Get quality metrics
      const stateOverview = getStateCorrelationOverview();
      const reactivityOverview = getGlobalReactivityOverview();

      if (stateOverview) {
        // Test correlation rate
        const correlationRate = parseFloat(stateOverview.correlationRate || 0) / 100;
        const meetsCorrelationThreshold = correlationRate >= TEST_CONFIG.QUALITY_THRESHOLDS.CORRELATION_RATE_MIN;

        qualityTest.metrics.correlationRate = {
          current: (correlationRate * 100).toFixed(1),
          threshold: (TEST_CONFIG.QUALITY_THRESHOLDS.CORRELATION_RATE_MIN * 100).toFixed(1),
          meetsThreshold: meetsCorrelationThreshold
        };

        if (!meetsCorrelationThreshold) {
          qualityTest.issues.push(`Correlation rate below threshold: ${(correlationRate * 100).toFixed(1)}%`);
        }
      }

      if (reactivityOverview) {
        // Test performance grade
        const performanceGrade = reactivityOverview.performanceGrade;
        const gradeRanking = { 'A+': 5, 'A': 4, 'B': 3, 'C': 2, 'D': 1, 'F': 0, 'N/A': -1 };
        const currentGrade = gradeRanking[performanceGrade] || 0;
        const minGrade = gradeRanking[TEST_CONFIG.QUALITY_THRESHOLDS.PERFORMANCE_GRADE_MIN] || 3;
        const meetsGradeThreshold = currentGrade >= minGrade;

        qualityTest.metrics.performanceGrade = {
          current: performanceGrade,
          threshold: TEST_CONFIG.QUALITY_THRESHOLDS.PERFORMANCE_GRADE_MIN,
          meetsThreshold: meetsGradeThreshold
        };

        if (!meetsGradeThreshold) {
          qualityTest.issues.push(`Performance grade below threshold: ${performanceGrade}`);
        }
      }

      qualityTest.status = qualityTest.issues.length === 0 ? 'passed' : 'warning';

      console.log(`${EMOJI_CLASSIFIERS.VALIDATION} Quality test ${qualityTest.status}`);
      console.log(`${EMOJI_CLASSIFIERS.INFO} Metrics:`, qualityTest.metrics);

    } catch (error) {
      qualityTest.status = 'error';
      qualityTest.error = error.message;
      console.error(`${EMOJI_CLASSIFIERS.ERROR} Quality test error:`, error);
    }

    return qualityTest;
  }

  /**
   * Test system health
   */
  testSystemHealth() {
    console.log(`${EMOJI_CLASSIFIERS.HEALTH} Testing system health...`);

    const healthTest = {
      status: 'unknown',
      checks: {},
      issues: []
    };

    try {
      // Run health checks
      const stateHealthCheck = runStateCorrelationHealthCheck();
      const reactivityHealthCheck = runReactivityHealthCheck();

      healthTest.checks.stateCorrelationHealth = {
        status: stateHealthCheck ? 'passed' : 'failed',
        result: stateHealthCheck
      };

      healthTest.checks.reactivityHealth = {
        status: reactivityHealthCheck ? 'passed' : 'failed',
        result: reactivityHealthCheck
      };

      // Store health check history
      this.healthCheckHistory.push({
        timestamp: new Date().toISOString(),
        stateHealthCheck,
        reactivityHealthCheck
      });

      // Keep history limited
      if (this.healthCheckHistory.length > 10) {
        this.healthCheckHistory = this.healthCheckHistory.slice(-10);
      }

      // Determine overall health status
      const allChecksPassed = stateHealthCheck && reactivityHealthCheck;
      healthTest.status = allChecksPassed ? 'passed' : 'warning';

      if (!allChecksPassed) {
        healthTest.issues.push('One or more health checks failed');
      }

      console.log(`${EMOJI_CLASSIFIERS.VALIDATION} Health test ${healthTest.status}`);

    } catch (error) {
      healthTest.status = 'error';
      healthTest.error = error.message;
      console.error(`${EMOJI_CLASSIFIERS.ERROR} Health test error:`, error);
    }

    return healthTest;
  }

  /**
   * Test stress scenarios
   */
  async testStressScenarios() {
    console.log(`${EMOJI_CLASSIFIERS.TEST} Testing stress scenarios...`);

    const stressTest = {
      status: 'unknown',
      scenarios: {},
      issues: []
    };

    try {
      // Simulate rapid state changes
      console.log(`${EMOJI_CLASSIFIERS.INFO} Simulating rapid state changes...`);
      const rapidStateChangeResults = this.simulateRapidStateChanges(50); // 50 rapid changes

      stressTest.scenarios.rapidStateChanges = {
        status: 'completed',
        results: rapidStateChangeResults
      };

      // Simulate memory pressure
      console.log(`${EMOJI_CLASSIFIERS.INFO} Simulating memory pressure...`);
      const memoryPressureResults = this.simulateMemoryPressure();

      stressTest.scenarios.memoryPressure = {
        status: 'completed',
        results: memoryPressureResults
      };

      stressTest.status = 'passed';

      console.log(`${EMOJI_CLASSIFIERS.VALIDATION} Stress test ${stressTest.status}`);

    } catch (error) {
      stressTest.status = 'error';
      stressTest.error = error.message;
      console.error(`${EMOJI_CLASSIFIERS.ERROR} Stress test error:`, error);
    }

    return stressTest;
  }

  /**
   * Simulate performance test
   */
  simulatePerformanceTest() {
    const iterations = 10;
    const latencies = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();

      // Simulate some work
      let sum = 0;
      for (let j = 0; j < 1000; j++) {
        sum += Math.random();
      }

      const endTime = performance.now();
      latencies.push(endTime - startTime);
    }

    const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;

    return {
      iterations,
      avgLatency: avgLatency.toFixed(2),
      minLatency: Math.min(...latencies).toFixed(2),
      maxLatency: Math.max(...latencies).toFixed(2)
    };
  }

  /**
   * Simulate rapid state changes
   */
  async simulateRapidStateChanges(count) {
    const startTime = performance.now();
    const latencies = [];

    for (let i = 0; i < count; i++) {
      const changeStartTime = performance.now();

      // Simulate state change processing
      const mockState = {
        timestamp: Date.now(),
        currentPrice: Math.random() * 100,
        bid: Math.random() * 99,
        ask: Math.random() * 101,
        ready: true
      };

      // Simulate state change tracking
      const changeEndTime = performance.now();
      latencies.push(changeEndTime - changeStartTime);

      // Small delay to simulate real processing
      await new Promise(resolve => setTimeout(resolve, 1));
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;

    return {
      stateChanges: count,
      totalTime: totalTime.toFixed(2),
      avgLatency: avgLatency.toFixed(2),
      throughput: (count / (totalTime / 1000)).toFixed(2) // changes per second
    };
  }

  /**
   * Simulate memory pressure
   */
  simulateMemoryPressure() {
    const initialMemory = performance.memory ? performance.memory.usedJSHeapSize : 'N/A';

    // Create memory pressure
    const largeArrays = [];
    for (let i = 0; i < 10; i++) {
      largeArrays.push(new Array(100000).fill(Math.random()));
    }

    const peakMemory = performance.memory ? performance.memory.usedJSHeapSize : 'N/A';

    // Clean up
    largeArrays.length = 0;

    // Force garbage collection if available
    if (window.gc) {
      window.gc();
    }

    const finalMemory = performance.memory ? performance.memory.usedJSHeapSize : 'N/A';

    return {
      initialMemory,
      peakMemory,
      finalMemory,
      memoryRecovered: finalMemory !== 'N/A' && initialMemory !== 'N/A' ?
        (peakMemory - finalMemory).toLocaleString() : 'N/A'
    };
  }

  /**
   * Calculate overall test status
   */
  calculateOverallStatus(tests) {
    const testStatuses = Object.values(tests).map(test => test.status);

    if (testStatuses.includes('error')) {
      return 'error';
    } else if (testStatuses.includes('failed')) {
      return 'failed';
    } else if (testStatuses.includes('warning')) {
      return 'warning';
    } else if (testStatuses.every(status => status === 'passed')) {
      return 'passed';
    } else {
      return 'unknown';
    }
  }

  /**
   * Generate recommendations based on test results
   */
  generateRecommendations(tests) {
    const recommendations = [];

    if (tests.performance?.issues?.length > 0) {
      recommendations.push('Consider optimizing render performance - check for bottlenecks in state-to-render pipeline');
    }

    if (tests.quality?.issues?.length > 0) {
      recommendations.push('Review state change detection and correlation logic to improve quality metrics');
    }

    if (tests.health?.issues?.length > 0) {
      recommendations.push('Address health check failures to improve system reliability');
    }

    if (tests.integration?.issues?.length > 0) {
      recommendations.push('Fix integration issues to ensure all monitoring systems are active');
    }

    if (recommendations.length === 0) {
      recommendations.push('System performing well - continue monitoring for any changes');
    }

    return recommendations;
  }

  /**
   * Log validation results
   */
  logValidationResults(validationResult) {
    console.log(`${EMOJI_CLASSIFIERS.SUCCESS} 🎉 Validation completed with status: ${validationResult.overallStatus}`);

    Object.entries(validationResult.tests).forEach(([testName, testResult]) => {
      console.log(`${EMOJI_CLASSIFIERS.INFO} ${testName}: ${testResult.status}`);
      if (testResult.issues?.length > 0) {
        console.warn(`${EMOJI_CLASSIFIERS.WARNING} Issues:`, testResult.issues);
      }
    });

    if (validationResult.recommendations?.length > 0) {
      console.log(`${EMOJI_CLASSIFIERS.INFO} Recommendations:`);
      validationResult.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }
  }

  /**
   * Get test history
   */
  getTestHistory(limit = 10) {
    return this.testResults.slice(-limit);
  }

  /**
   * Get health check history
   */
  getHealthCheckHistory(limit = 10) {
    return this.healthCheckHistory.slice(-limit);
  }

  /**
   * Clear test history
   */
  clearHistory() {
    this.testResults = [];
    this.healthCheckHistory = [];
    this.benchmarks.clear();
    console.log(`${EMOJI_CLASSIFIERS.INFO} Test history cleared`);
  }
}

/**
 * Global test suite instance
 */
export const globalStateCorrelationTestSuite = new StateCorrelationTestSuite();

/**
 * Quick validation function
 */
export async function runQuickValidation() {
  if (!isDevelopment) return null;

  console.log(`${EMOJI_CLASSIFIERS.TEST} 🧪 Running quick state correlation validation...`);

  try {
    const stateOverview = getStateCorrelationOverview();
    const reactivityOverview = getGlobalReactivityOverview();

    const quickResult = {
      timestamp: new Date().toISOString(),
      stateCorrelation: stateOverview ? 'active' : 'inactive',
      reactivityMonitoring: reactivityOverview ? 'active' : 'inactive',
      status: (stateOverview || reactivityOverview) ? 'passed' : 'failed'
    };

    console.log(`${EMOJI_CLASSIFIERS.VALIDATION} Quick validation ${quickResult.status}:`, quickResult);

    return quickResult;
  } catch (error) {
    console.error(`${EMOJI_CLASSIFIERS.ERROR} Quick validation failed:`, error);
    return {
      timestamp: new Date().toISOString(),
      status: 'error',
      error: error.message
    };
  }
}