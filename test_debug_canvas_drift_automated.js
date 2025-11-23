/**
 * Automated Test Scenarios for Canvas Positioning Drift Reproduction
 *
 * This test file creates controlled scenarios to reproduce canvas positioning drift
 * and validate the diagnostic system's ability to detect and analyze these issues.
 *
 * TO BE DELETED BEFORE FINAL REPORT - DEBUGGING ONLY
 */

// Import drift monitor for testing
import { canvasDriftMonitor } from './src/lib/diagnostics/canvasDriftMonitor.js';

/**
 * Test configuration and utilities
 */
class CanvasDriftTester {
  constructor() {
    this.testResults = [];
    this.testStartTime = performance.now();
    this.isRunning = false;

    // Test thresholds - more sensitive than production
    this.testThresholds = {
      positionDelta: 0.01,      // More sensitive for testing
      sizeDelta: 0.01,          // More sensitive for testing
      timeDelta: 10,            // Shorter time for testing
      performanceThreshold: 5   // Lower threshold for test detection
    };
  }

  /**
   * Run all automated drift reproduction tests
   */
  async runAllTests() {
    console.log('=== AUTOMATED DRIFT REPRODUCTION TESTS STARTING ===');
    this.isRunning = true;

    try {
      // Ensure monitoring is active
      if (!canvasDriftMonitor.isMonitoring) {
        canvasDriftMonitor.startMonitoring();
        await this.sleep(500); // Let monitoring stabilize
      }

      // Run test scenarios
      await this.testBrowserZoomSimulation();
      await this.testRapidResizeSequence();
      await this.testConcurrentRendering();
      await this.testTransformMatrixAccumulation();
      await this.testMemoryPressureScenario();
      await this.testHighFrequencyUpdates();
      await this.testDPRChangeRecovery();

      // Generate comprehensive test report
      this.generateTestReport();

    } catch (error) {
      console.error('[CanvasDriftTester] Test execution failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Test 1: Browser Zoom Simulation
   * Simulates browser zoom changes that commonly cause drift
   */
  async testBrowserZoomSimulation() {
    console.log('🧪 Test 1: Browser Zoom Simulation');

    const testId = 'browser_zoom_simulation';
    const testStart = performance.now();

    // Create test element
    const testElement = this.createTestElement('zoom-test');

    try {
      // Simulate zoom changes
      const zoomLevels = [1.0, 1.25, 1.5, 0.8, 1.0];

      for (const zoomLevel of zoomLevels) {
        // Mock DPR change
        this.mockDevicePixelRatioChange(zoomLevel);

        // Trigger resize to simulate zoom
        window.dispatchEvent(new Event('resize'));

        // Update element size
        testElement.style.width = `${220 * zoomLevel}px`;
        testElement.style.height = `${120 * zoomLevel}px`;

        // Take snapshot after each zoom change
        canvasDriftMonitor.takeSnapshot(testElement.id, 'zoom_change', {
          zoomLevel,
          testPhase: 'browser_zoom_simulation'
        });

        await this.sleep(100); // Allow for event processing
      }

      const testDuration = performance.now() - testStart;
      this.recordTestResult(testId, true, testDuration, {
        zoomLevelsTested: zoomLevels.length,
        driftEventsDetected: canvasDriftMonitor.driftEvents.filter(e => e.elementId === testElement.id).length
      });

    } catch (error) {
      this.recordTestResult(testId, false, performance.now() - testStart, { error: error.message });
    } finally {
      testElement.remove();
      canvasDriftMonitor.unregisterElement(testElement.id);
    }
  }

  /**
   * Test 2: Rapid Resize Sequence
   * Tests drift during rapid container resizing
   */
  async testRapidResizeSequence() {
    console.log('🧪 Test 2: Rapid Resize Sequence');

    const testId = 'rapid_resize_sequence';
    const testStart = performance.now();

    const testElement = this.createTestElement('resize-test');

    try {
      // Perform rapid resize sequence
      const resizeSequence = [
        { width: 220, height: 120 },
        { width: 300, height: 200 },
        { width: 150, height: 100 },
        { width: 400, height: 250 },
        { width: 220, height: 120 } // Return to original
      ];

      for (const [index, size] of resizeSequence.entries()) {
        testElement.style.width = `${size.width}px`;
        testElement.style.height = `${size.height}px`;

        // Take snapshot after each resize
        canvasDriftMonitor.takeSnapshot(testElement.id, 'rapid_resize', {
          resizeIndex: index,
          newSize: size,
          testPhase: 'rapid_resize_sequence'
        });

        // Rapid sequence - short delay
        await this.sleep(50);
      }

      const testDuration = performance.now() - testStart;
      this.recordTestResult(testId, true, testDuration, {
        resizeOperations: resizeSequence.length,
        driftEventsDetected: canvasDriftMonitor.driftEvents.filter(e => e.elementId === testElement.id).length
      });

    } catch (error) {
      this.recordTestResult(testId, false, performance.now() - testStart, { error: error.message });
    } finally {
      testElement.remove();
      canvasDriftMonitor.unregisterElement(testElement.id);
    }
  }

  /**
   * Test 3: Concurrent Rendering
   * Tests drift under concurrent canvas rendering load
   */
  async testConcurrentRendering() {
    console.log('🧪 Test 3: Concurrent Rendering');

    const testId = 'concurrent_rendering';
    const testStart = performance.now();

    const testElements = [];
    const elementCount = 5;

    try {
      // Create multiple test elements
      for (let i = 0; i < elementCount; i++) {
        const element = this.createTestElement(`concurrent-test-${i}`);
        element.style.left = `${100 + (i * 50)}px`;
        element.style.top = `${100 + (i * 30)}px`;
        testElements.push(element);
      }

      // Simulate concurrent rendering operations
      const renderingOperations = 20;

      for (let i = 0; i < renderingOperations; i++) {
        // Randomly update elements to simulate concurrent operations
        const randomElement = testElements[Math.floor(Math.random() * testElements.length)];

        randomElement.style.width = `${220 + Math.random() * 100}px`;
        randomElement.style.height = `${120 + Math.random() * 50}px`;

        // Trigger render-like operations
        canvasDriftMonitor.takeSnapshot(randomElement.id, 'concurrent_render', {
          operationIndex: i,
          totalOperations: renderingOperations,
          testPhase: 'concurrent_rendering'
        });

        // Short delay to simulate real rendering timing
        await this.sleep(20);
      }

      const testDuration = performance.now() - testStart;
      const totalDriftEvents = testElements.reduce((sum, element) => {
        return sum + canvasDriftMonitor.driftEvents.filter(e => e.elementId === element.id).length;
      }, 0);

      this.recordTestResult(testId, true, testDuration, {
        elementsCreated: elementCount,
        renderingOperations,
        totalDriftEvents,
        avgDriftEventsPerElement: totalDriftEvents / elementCount
      });

    } catch (error) {
      this.recordTestResult(testId, false, performance.now() - testStart, { error: error.message });
    } finally {
      // Cleanup test elements
      testElements.forEach(element => {
        element.remove();
        canvasDriftMonitor.unregisterElement(element.id);
      });
    }
  }

  /**
   * Test 4: Transform Matrix Accumulation
   * Tests for transform matrix drift accumulation
   */
  async testTransformMatrixAccumulation() {
    console.log('🧪 Test 4: Transform Matrix Accumulation');

    const testId = 'transform_accumulation';
    const testStart = performance.now();

    const testElement = this.createTestElement('transform-test');
    const canvas = this.createTestCanvas(testElement);
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      this.recordTestResult(testId, false, 0, { error: 'Failed to get canvas context' });
      return;
    }

    try {
      // Simulate transform operations that might cause accumulation
      const transformOperations = 50;

      for (let i = 0; i < transformOperations; i++) {
        // Save transform state
        ctx.save();

        // Apply transforms similar to real rendering
        ctx.translate(1, 1);
        ctx.scale(1.01, 1.01); // Slight scale drift
        ctx.rotate(0.01); // Slight rotation drift

        // Perform some drawing
        ctx.fillRect(0, 0, 10, 10);

        // Restore transform state (should reset accumulations)
        ctx.restore();

        // Monitor transform state
        const transform = ctx.getTransform();
        canvasDriftMonitor.takeSnapshot(testElement.id, 'transform_operation', {
          operationIndex: i,
          transformState: {
            a: transform.a,
            b: transform.b,
            c: transform.c,
            d: transform.d,
            e: transform.e,
            f: transform.f
          },
          testPhase: 'transform_accumulation'
        });

        await this.sleep(10);
      }

      const testDuration = performance.now() - testStart;
      this.recordTestResult(testId, true, testDuration, {
        transformOperations,
        finalTransform: ctx.getTransform(),
        driftEventsDetected: canvasDriftMonitor.driftEvents.filter(e => e.elementId === testElement.id).length
      });

    } catch (error) {
      this.recordTestResult(testId, false, performance.now() - testStart, { error: error.message });
    } finally {
      testElement.remove();
      canvasDriftMonitor.unregisterElement(testElement.id);
    }
  }

  /**
   * Test 5: Memory Pressure Scenario
   * Tests drift under memory pressure conditions
   */
  async testMemoryPressureScenario() {
    console.log('🧪 Test 5: Memory Pressure Scenario');

    const testId = 'memory_pressure';
    const testStart = performance.now();

    const testElement = this.createTestElement('memory-test');
    const memoryHogs = [];

    try {
      // Create memory pressure
      const memoryHogSize = 1024 * 1024 * 5; // 5MB per hog
      const hogCount = 10;

      for (let i = 0; i < hogCount; i++) {
        memoryHogs.push(new ArrayBuffer(memoryHogSize));
      }

      // Perform operations under memory pressure
      const operationsUnderPressure = 30;

      for (let i = 0; i < operationsUnderPressure; i++) {
        // Update element
        testElement.style.width = `${220 + (i % 10)}px`;
        testElement.style.height = `${120 + (i % 5)}px`;

        // Take snapshot with memory pressure
        canvasDriftMonitor.takeSnapshot(testElement.id, 'memory_pressure', {
          operationIndex: i,
          memoryHogsCreated: hogCount,
          currentMemoryUsage: performance.memory ? performance.memory.usedJSHeapSize : 'unknown',
          testPhase: 'memory_pressure'
        });

        await this.sleep(50);
      }

      const testDuration = performance.now() - testStart;
      this.recordTestResult(testId, true, testDuration, {
        memoryHogsCreated: hogCount,
        operationsUnderPressure,
        driftEventsDetected: canvasDriftMonitor.driftEvents.filter(e => e.elementId === testElement.id).length,
        finalMemoryUsage: performance.memory ? performance.memory.usedJSHeapSize : 'unknown'
      });

    } catch (error) {
      this.recordTestResult(testId, false, performance.now() - testStart, { error: error.message });
    } finally {
      // Cleanup memory
      memoryHogs.length = 0;
      testElement.remove();
      canvasDriftMonitor.unregisterElement(testElement.id);
    }
  }

  /**
   * Test 6: High Frequency Updates
   * Tests drift under high-frequency update scenarios
   */
  async testHighFrequencyUpdates() {
    console.log('🧪 Test 6: High Frequency Updates');

    const testId = 'high_frequency_updates';
    const testStart = performance.now();

    const testElement = this.createTestElement('highfreq-test');

    try {
      // Simulate high-frequency updates (like market data)
      const updateCount = 100;
      const updateInterval = 5; // 5ms between updates (200Hz)

      for (let i = 0; i < updateCount; i++) {
        // Simulate frequent small changes (like price updates)
        const xOffset = Math.sin(i * 0.1) * 2; // Small oscillation
        const yOffset = Math.cos(i * 0.1) * 2;

        testElement.style.transform = `translate(${xOffset}px, ${yOffset}px)`;

        // Take snapshot for each update
        canvasDriftMonitor.takeSnapshot(testElement.id, 'high_frequency_update', {
          updateIndex: i,
          xOffset,
          yOffset,
          updateInterval,
          testPhase: 'high_frequency_updates'
        });

        // High-frequency delay
        await this.sleep(updateInterval);
      }

      const testDuration = performance.now() - testStart;
      this.recordTestResult(testId, true, testDuration, {
        updateCount,
        updateInterval,
        actualFrequency: updateCount / (testDuration / 1000),
        driftEventsDetected: canvasDriftMonitor.driftEvents.filter(e => e.elementId === testElement.id).length
      });

    } catch (error) {
      this.recordTestResult(testId, false, performance.now() - testStart, { error: error.message });
    } finally {
      testElement.remove();
      canvasDriftMonitor.unregisterElement(testElement.id);
    }
  }

  /**
   * Test 7: DPR Change Recovery
   * Tests system recovery from DPR changes
   */
  async testDPRChangeRecovery() {
    console.log('🧪 Test 7: DPR Change Recovery');

    const testId = 'dpr_recovery';
    const testStart = performance.now();

    const testElement = this.createTestElement('dpr-recovery-test');

    try {
      // Establish baseline
      canvasDriftMonitor.takeSnapshot(testElement.id, 'baseline', {
        testPhase: 'dpr_recovery'
      });

      await this.sleep(100);

      // Simulate DPR change event
      this.mockDevicePixelRatioChange(2.0);
      window.dispatchEvent(new Event('resize'));

      // Monitor recovery process
      const recoveryPhases = ['immediate', 'short_term', 'stabilized'];
      const recoveryDelays = [10, 100, 500];

      for (const [index, phase] of recoveryPhases.entries()) {
        await this.sleep(recoveryDelays[index]);

        canvasDriftMonitor.takeSnapshot(testElement.id, 'recovery_phase', {
          phase,
          delay: recoveryDelays[index],
          testPhase: 'dpr_recovery'
        });
      }

      // Return to normal DPR
      this.mockDevicePixelRatioChange(1.0);
      window.dispatchEvent(new Event('resize'));

      await this.sleep(500);

      // Final recovery check
      canvasDriftMonitor.takeSnapshot(testElement.id, 'final_recovery', {
        testPhase: 'dpr_recovery'
      });

      const testDuration = performance.now() - testStart;
      this.recordTestResult(testId, true, testDuration, {
        recoveryPhasesTested: recoveryPhases.length,
        driftEventsDetected: canvasDriftMonitor.driftEvents.filter(e => e.elementId === testElement.id).length
      });

    } catch (error) {
      this.recordTestResult(testId, false, performance.now() - testStart, { error: error.message });
    } finally {
      testElement.remove();
      canvasDriftMonitor.unregisterElement(testElement.id);
    }
  }

  /**
   * Helper methods
   */
  createTestElement(id) {
    const element = document.createElement('div');
    element.id = id;
    element.style.position = 'fixed';
    element.style.width = '220px';
    element.style.height = '120px';
    element.style.backgroundColor = '#111827';
    element.style.border = '2px solid #374151';
    element.style.borderRadius = '6px';
    element.style.zIndex = '9999';
    element.style.left = '50px';
    element.style.top = '50px';

    document.body.appendChild(element);

    // Register with drift monitor
    canvasDriftMonitor.registerElement(id, element, 'test');

    return element;
  }

  createTestCanvas(parentElement) {
    const canvas = document.createElement('canvas');
    canvas.width = 220;
    canvas.height = 120;
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    parentElement.appendChild(canvas);

    return canvas;
  }

  mockDevicePixelRatioChange(newDpr) {
    // This is a mock for testing - in real scenarios, browser zoom changes DPR
    Object.defineProperty(window, 'devicePixelRatio', {
      writable: true,
      value: newDpr
    });
  }

  recordTestResult(testId, success, duration, details) {
    const result = {
      testId,
      success,
      duration,
      timestamp: performance.now(),
      details
    };

    this.testResults.push(result);

    console.log(`${success ? '✅' : '❌'} ${testId}: ${success ? 'PASSED' : 'FAILED'} (${duration.toFixed(2)}ms)`);

    if (!success) {
      console.error(`  Error details:`, details);
    }
  }

  generateTestReport() {
    const totalDuration = performance.now() - this.testStartTime;
    const passedTests = this.testResults.filter(r => r.success).length;
    const totalTests = this.testResults.length;

    const report = {
      summary: {
        totalTests,
        passedTests,
        failedTests: totalTests - passedTests,
        successRate: (passedTests / totalTests * 100).toFixed(1) + '%',
        totalDuration,
        generatedAt: new Date().toISOString()
      },
      testResults: this.testResults,
      driftMonitorReport: canvasDriftMonitor.lastReport,
      recommendations: this.generateTestRecommendations()
    };

    console.log('\n=== AUTOMATED DRIFT TEST REPORT ===');
    console.log('SUMMARY:', report.summary);
    console.log('DETAILED RESULTS:', report.testResults);
    console.log('RECOMMENDATIONS:', report.recommendations);

    return report;
  }

  generateTestRecommendations() {
    const recommendations = [];
    const failureCount = this.testResults.filter(r => !r.success).length;

    if (failureCount > 0) {
      recommendations.push('Some tests failed - investigate drift detection system');
    }

    if (canvasDriftMonitor.driftEvents.length > 0) {
      recommendations.push('Drift events detected - review diagnostic logs for root cause');
    }

    const highSeverityDrifts = canvasDriftMonitor.driftEvents.filter(e => e.severity === 'high');
    if (highSeverityDrifts.length > 0) {
      recommendations.push('HIGH SEVERITY DRIFT DETECTED - immediate investigation required');
    }

    if (recommendations.length === 0) {
      recommendations.push('All tests passed - system appears stable under test conditions');
    }

    return recommendations;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Auto-run tests if in test environment
 */
if (typeof window !== 'undefined' && window.location.search.includes('driftTest=true')) {
  const tester = new CanvasDriftTester();

  // Wait for page to load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => tester.runAllTests(), 1000);
    });
  } else {
    setTimeout(() => tester.runAllTests(), 1000);
  }
}

export { CanvasDriftTester };
export default CanvasDriftTester;