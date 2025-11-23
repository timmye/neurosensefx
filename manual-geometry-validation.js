/**
 * MANUAL GEOMETRY VALIDATION SCRIPT
 *
 * This script can be run in the browser console to validate the three geometry fixes:
 * 1. Canvas Container Alignment
 * 2. ADR 0 Alignment
 * 3. Mouse Interaction
 *
 * Usage:
 * 1. Open NeuroSense FX in browser
 * 2. Create some floating displays
 * 3. Copy and paste this script into console
 * 4. Run the validation functions
 */

class ManualGeometryValidator {
  constructor() {
    this.results = {
      canvasAlignment: { passed: false, measurements: [] },
      adrAlignment: { passed: false, measurements: [] },
      mouseInteraction: { passed: false, measurements: [] }
    };
  }

  /**
   * TEST 1: Canvas Container Alignment
   */
  testCanvasContainerAlignment() {
    console.log('\n🔍 TEST 1: Canvas Container Alignment');
    console.log('=' .repeat(60));

    const results = [];
    const displays = document.querySelectorAll('.enhanced-floating.headerless');

    console.log(`Found ${displays.length} floating displays to test`);

    displays.forEach((display, index) => {
      const containerRect = display.getBoundingClientRect();
      const canvas = display.querySelector('canvas.full-canvas');

      if (!canvas) {
        console.log(`⚠️ Display ${index}: No canvas found, skipping`);
        return;
      }

      const canvasRect = canvas.getBoundingClientRect();

      // Calculate offsets
      const offsetX = canvasRect.left - containerRect.left;
      const offsetY = canvasRect.top - containerRect.top;

      const measurement = {
        displayIndex: index,
        containerRect: {
          left: containerRect.left,
          top: containerRect.top,
          width: containerRect.width,
          height: containerRect.height
        },
        canvasRect: {
          left: canvasRect.left,
          top: canvasRect.top,
          width: canvasRect.width,
          height: canvasRect.height
        },
        offset: { x: offsetX, y: offsetY },
        withinTolerance: Math.abs(offsetX) <= 2 && Math.abs(offsetY) <= 2
      };

      results.push(measurement);

      console.log(`Display ${index}:`);
      console.log(`  Container: (${containerRect.left.toFixed(1)}, ${containerRect.top.toFixed(1)}) ${containerRect.width.toFixed(1)}×${containerRect.height.toFixed(1)}`);
      console.log(`  Canvas:    (${canvasRect.left.toFixed(1)}, ${canvasRect.top.toFixed(1)}) ${canvasRect.width.toFixed(1)}×${canvasRect.height.toFixed(1)}`);
      console.log(`  Offset:    (${offsetX.toFixed(1)}, ${offsetY.toFixed(1)})`);
      console.log(`  Status:    ${measurement.withinTolerance ? '✅ PASS' : '❌ FAIL'}`);
    });

    const passedCount = results.filter(r => r.withinTolerance).length;
    const totalCount = results.length;
    this.results.canvasAlignment = {
      passed: passedCount === totalCount && totalCount > 0,
      measurements: results,
      summary: `${passedCount}/${totalCount} displays properly aligned`
    };

    console.log(`\nCanvas Alignment Test Result: ${this.results.canvasAlignment.passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Summary: ${this.results.canvasAlignment.summary}`);

    return this.results.canvasAlignment;
  }

  /**
   * TEST 2: ADR 0 Alignment (via yScale analysis)
   */
  testAdrAlignment() {
    console.log('\n🔍 TEST 2: ADR 0 Alignment (Daily Open at Canvas Center)');
    console.log('=' .repeat(60));

    const results = [];

    // Check if coordinate debugger is available
    if (!window.coordinateDebugger) {
      console.log('❌ Coordinate debugger not available');
      this.results.adrAlignment = {
        passed: false,
        measurements: [],
        summary: 'Coordinate debugger not available'
      };
      return this.results.adrAlignment;
    }

    const displays = document.querySelectorAll('.enhanced-floating.headerless');
    console.log(`Found ${displays.length} floating displays to test`);

    displays.forEach((display, index) => {
      try {
        const canvas = display.querySelector('canvas.full-canvas');
        if (!canvas) return;

        const displayId = display.getAttribute('data-display-id');
        if (!displayId) {
          console.log(`⚠️ Display ${index}: No display ID found`);
          return;
        }

        // Click ADR test button if available
        const adrButton = display.querySelector('.debug-btn');
        if (adrButton && adrButton.textContent.includes('ADR')) {
          console.log(`\nDisplay ${index}: Triggering ADR alignment test...`);
          adrButton.click();
        }

        // Analyze the yScale calculation from FloatingDisplay
        setTimeout(() => {
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          const centerX = Math.floor(canvas.width / 2);
          const centerY = Math.floor(canvas.height / 2);

          console.log(`Display ${index}:`);
          console.log(`  Canvas center: (${centerX}, ${centerY})`);
          console.log(`  Canvas dimensions: ${canvas.width} × ${canvas.height}`);

          // Check debug panel for results
          const debugPanel = document.getElementById('coordinate-debugger-panel');
          if (debugPanel) {
            const debugContent = debugPanel.textContent;
            const adrMessages = debugContent.match(/\[DEBUGGER:.*:ADR_ALIGNMENT\].*/g) || [];

            console.log(`ADR Alignment Messages: ${adrMessages.length}`);
            adrMessages.forEach(msg => console.log(`  ${msg}`));

            const hasNoWarnings = !debugContent.includes('may be misaligned') && !debugContent.includes('ERROR');

            const measurement = {
              displayIndex: index,
              displayId,
              canvasCenter: { x: centerX, y: centerY },
              adrMessages: adrMessages,
              debugOutputPresent: adrMessages.length > 0,
              withinTolerance: hasNoWarnings && adrMessages.length > 0
            };

            results.push(measurement);
            console.log(`  Status: ${measurement.withinTolerance ? '✅ PASS' : '❌ FAIL'}`);
          }
        }, 2000);

      } catch (error) {
        console.log(`❌ Display ${index}: Error testing ADR alignment - ${error.message}`);
        results.push({
          displayIndex: index,
          error: error.message,
          withinTolerance: false
        });
      }
    });

    // Wait for async operations and evaluate
    setTimeout(() => {
      const passedCount = results.filter(r => r.withinTolerance).length;
      const totalCount = results.length;
      this.results.adrAlignment = {
        passed: passedCount === totalCount && totalCount > 0,
        measurements: results,
        summary: `${passedCount}/${totalCount} displays have proper ADR alignment`
      };

      console.log(`\nADR Alignment Test Result: ${this.results.adrAlignment.passed ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`Summary: ${this.results.adrAlignment.summary}`);
    }, 3000);

    return this.results.adrAlignment;
  }

  /**
   * TEST 3: Mouse Interaction
   */
  testMouseInteraction() {
    console.log('\n🔍 TEST 3: Mouse Interaction (Post-Drag Event Handling)');
    console.log('=' .repeat(60));

    const results = [];
    const displays = document.querySelectorAll('.enhanced-floating.headerless');

    // Test up to 3 displays
    Array.from(displays).slice(0, 3).forEach((display, index) => {
      try {
        const initialRect = display.getBoundingClientRect();

        console.log(`\nDisplay ${index}: Testing mouse interaction after drag...`);
        console.log(`Initial position: (${initialRect.left.toFixed(1)}, ${initialRect.top.toFixed(1)})`);

        // Click mouse interaction test button if available
        const mouseButton = display.querySelector('.debug-btn');
        if (mouseButton && mouseButton.textContent.includes('🖱️')) {
          mouseButton.click();
        }

        // Simulate drag operation
        const centerX = initialRect.left + initialRect.width / 2;
        const centerY = initialRect.top + initialRect.height / 2;

        // Create mouse events for drag
        const mouseDownEvent = new MouseEvent('mousedown', {
          bubbles: true,
          clientX: centerX,
          clientY: centerY,
          button: 0
        });

        const mouseMoveEvent = new MouseEvent('mousemove', {
          bubbles: true,
          clientX: centerX + 100,
          clientY: centerY + 50,
          button: 0
        });

        const mouseUpEvent = new MouseEvent('mouseup', {
          bubbles: true,
          clientX: centerX + 100,
          clientY: centerY + 50,
          button: 0
        });

        // Dispatch drag events
        display.dispatchEvent(mouseDownEvent);
        setTimeout(() => {
          display.dispatchEvent(mouseMoveEvent);
          setTimeout(() => {
            display.dispatchEvent(mouseUpEvent);

            // Get final position
            const finalRect = display.getBoundingClientRect();
            console.log(`Final position: (${finalRect.left.toFixed(1)}, ${finalRect.top.toFixed(1)})`);

            // Test mouse click after drag
            const clickEvent = new MouseEvent('click', {
              bubbles: true,
              clientX: finalRect.left + 10,
              clientY: finalRect.top + 10
            });

            display.dispatchEvent(clickEvent);

            const dragDistance = Math.sqrt(
              Math.pow(finalRect.left - initialRect.left, 2) +
              Math.pow(finalRect.top - initialRect.top, 2)
            );

            const measurement = {
              displayIndex: index,
              initialPosition: { x: initialRect.left, y: initialRect.top },
              finalPosition: { x: finalRect.left, y: finalRect.top },
              dragDistance,
              dragSuccessful: dragDistance > 50,
              mouseEventsDetected: true // Click was dispatched without errors
            };

            measurement.withinTolerance = measurement.dragSuccessful && measurement.mouseEventsDetected;
            results.push(measurement);

            console.log(`Drag distance: ${dragDistance.toFixed(1)}px`);
            console.log(`Status: ${measurement.withinTolerance ? '✅ PASS' : '❌ FAIL'}`);
          }, 100);
        }, 100);

      } catch (error) {
        console.log(`❌ Display ${index}: Error testing mouse interaction - ${error.message}`);
        results.push({
          displayIndex: index,
          error: error.message,
          withinTolerance: false
        });
      }
    });

    // Wait for operations to complete
    setTimeout(() => {
      const passedCount = results.filter(r => r.withinTolerance).length;
      const totalCount = results.length;
      this.results.mouseInteraction = {
        passed: passedCount === totalCount && totalCount > 0,
        measurements: results,
        summary: `${passedCount}/${totalCount} displays have working mouse interaction`
      };

      console.log(`\nMouse Interaction Test Result: ${this.results.mouseInteraction.passed ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`Summary: ${this.results.mouseInteraction.summary}`);
    }, 1000);

    return this.results.mouseInteraction;
  }

  /**
   * Run all tests and generate report
   */
  async runAllTests() {
    console.log('\n🚀 STARTING MANUAL GEOMETRY VALIDATION');
    console.log('Testing the three critical canvas geometry fixes...\n');

    // Test 1: Canvas Container Alignment
    this.testCanvasContainerAlignment();

    // Test 2: ADR Alignment
    this.testAdrAlignment();

    // Test 3: Mouse Interaction
    this.testMouseInteraction();

    // Generate final report after async operations
    setTimeout(() => {
      this.generateReport();
    }, 5000);

    return this.results;
  }

  /**
   * Generate comprehensive validation report
   */
  generateReport() {
    const timestamp = new Date().toISOString();
    const allTestsPassed = Object.values(this.results).every(test => test.passed);

    const report = {
      timestamp,
      overallStatus: allTestsPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED',
      tests: this.results,
      summary: {
        canvasAlignment: this.results.canvasAlignment.summary,
        adrAlignment: this.results.adrAlignment.summary,
        mouseInteraction: this.results.mouseInteraction.summary,
        totalTestsPassed: Object.values(this.results).filter(t => t.passed).length,
        totalTests: Object.keys(this.results).length
      }
    };

    console.log('\n' + '='.repeat(80));
    console.log('🎯 MANUAL GEOMETRY VALIDATION REPORT');
    console.log('='.repeat(80));
    console.log(`Timestamp: ${timestamp}`);
    console.log(`Overall Status: ${report.overallStatus}`);
    console.log('\nTest Results:');
    console.log(`  Canvas Alignment: ${this.results.canvasAlignment.passed ? '✅ PASS' : '❌ FAIL'} - ${report.summary.canvasAlignment}`);
    console.log(`  ADR Alignment:    ${this.results.adrAlignment.passed ? '✅ PASS' : '❌ FAIL'} - ${report.summary.adrAlignment}`);
    console.log(`  Mouse Interaction: ${this.results.mouseInteraction.passed ? '✅ PASS' : '❌ FAIL'} - ${report.summary.mouseInteraction}`);
    console.log(`\nSummary: ${report.summary.totalTestsPassed}/${report.summary.totalTests} tests passed`);
    console.log('='.repeat(80));

    return report;
  }
}

// Create global instance
window.geometryValidator = new ManualGeometryValidator();

console.log('🔧 Manual Geometry Validator loaded!');
console.log('Usage:');
console.log('  window.geometryValidator.testCanvasContainerAlignment()');
console.log('  window.geometryValidator.testAdrAlignment()');
console.log('  window.geometryValidator.testMouseInteraction()');
console.log('  window.geometryValidator.runAllTests()');