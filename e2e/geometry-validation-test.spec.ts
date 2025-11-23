/**
 * COMPREHENSIVE GEOMETRY VALIDATION TEST
 *
 * Tests the three critical canvas geometry fixes implemented in NeuroSense FX:
 * 1. Initial Canvas Positioning Fix (CSS transform removal)
 * 2. ADR 0 Alignment Fix (daily open at canvas 50% height)
 * 3. Mouse Interaction Fix (remove CSS transform scale)
 *
 * This test requires manual browser execution to validate real-world behavior.
 */

import { test, expect } from '@playwright/test';

class GeometryValidationTest {
  constructor(page) {
    this.page = page;
    this.testResults = {
      canvasAlignment: { passed: false, measurements: [] },
      adrAlignment: { passed: false, measurements: [] },
      mouseInteraction: { passed: false, measurements: [] }
    };
  }

  /**
   * TEST 1: Canvas Container Alignment
   * Validates that canvas renders exactly at container top (no pixel offset)
   */
  async testCanvasContainerAlignment() {
    console.log('\n🔍 TEST 1: Canvas Container Alignment');
    console.log('=' .repeat(60));

    const results = [];

    // Find all floating display elements
    const displays = await this.page.$$('.enhanced-floating.headerless');
    console.log(`Found ${displays.length} floating displays to test`);

    for (let i = 0; i < displays.length; i++) {
      const display = displays[i];

      try {
        // Get container bounding rect
        const containerRect = await display.evaluate(el => {
          return el.getBoundingClientRect();
        });

        // Get canvas element within container
        const canvas = await display.$('canvas.full-canvas');
        if (!canvas) {
          console.log(`⚠️ Display ${i}: No canvas found, skipping`);
          continue;
        }

        // Get canvas bounding rect
        const canvasRect = await canvas.evaluate(el => {
          return el.getBoundingClientRect();
        });

        // Calculate offsets
        const offsetX = canvasRect.left - containerRect.left;
        const offsetY = canvasRect.top - containerRect.top;

        const measurement = {
          displayIndex: i,
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

        console.log(`Display ${i}:`);
        console.log(`  Container: (${containerRect.left.toFixed(1)}, ${containerRect.top.toFixed(1)}) ${containerRect.width.toFixed(1)}×${containerRect.height.toFixed(1)}`);
        console.log(`  Canvas:    (${canvasRect.left.toFixed(1)}, ${canvasRect.top.toFixed(1)}) ${canvasRect.width.toFixed(1)}×${canvasRect.height.toFixed(1)}`);
        console.log(`  Offset:    (${offsetX.toFixed(1)}, ${offsetY.toFixed(1)})`);
        console.log(`  Status:    ${measurement.withinTolerance ? '✅ PASS' : '❌ FAIL'}`);

      } catch (error) {
        console.log(`❌ Display ${i}: Error measuring alignment - ${error.message}`);
        results.push({
          displayIndex: i,
          error: error.message,
          withinTolerance: false
        });
      }
    }

    // Evaluate overall test result
    const passedCount = results.filter(r => r.withinTolerance).length;
    const totalCount = results.length;
    this.testResults.canvasAlignment = {
      passed: passedCount === totalCount && totalCount > 0,
      measurements: results,
      summary: `${passedCount}/${totalCount} displays properly aligned`
    };

    console.log(`\nCanvas Alignment Test Result: ${this.testResults.canvasAlignment.passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Summary: ${this.testResults.canvasAlignment.summary}`);

    return this.testResults.canvasAlignment;
  }

  /**
   * TEST 2: ADR 0 Alignment (Daily Open at Canvas Center)
   * Validates that ADR 0 aligns with canvas 50% height using coordinate debugger
   */
  async testAdrAlignment() {
    console.log('\n🔍 TEST 2: ADR 0 Alignment (Daily Open at Canvas Center)');
    console.log('=' .repeat(60));

    const results = [];

    // Find all ADR test buttons and click them
    const adrButtons = await this.page.$$('.debug-btn');
    console.log(`Found ${adrButtons.length} ADR test buttons`);

    for (let i = 0; i < adrButtons.length; i++) {
      const button = adrButtons[i];
      const buttonText = await button.textContent();

      if (buttonText.includes('ADR')) {
        try {
          // Get the parent display
          const displayElement = await button.locator('xpath=ancestor::div[contains(@class, "enhanced-floating")]');
          if (!displayElement) continue;

          // Click ADR test button to trigger analysis
          console.log(`\nDisplay ${i}: Triggering ADR alignment test...`);
          await button.click();

          // Wait for debugger analysis to complete
          await this.page.waitForTimeout(2000);

          // Check debug panel for results
          const debugPanel = await this.page.$('#coordinate-debugger-panel');
          if (debugPanel) {
            const debugContent = await debugPanel.textContent();

            // Look for ADR alignment messages
            const adrMessages = debugContent.match(/\[DEBUGGER:.*:ADR_ALIGNMENT\].*/g) || [];

            console.log(`ADR Alignment Messages (${adrMessages.length}):`);
            adrMessages.forEach(msg => {
              console.log(`  ${msg}`);
            });

            // Try to detect canvas center measurement
            const centerMatch = debugContent.match(/Canvas center: \((\d+), (\d+)\)/);
            const hasContentMatch = debugContent.match(/Has content at center: (true|false)/);

            const measurement = {
              displayIndex: i,
              adrMessages: adrMessages,
              canvasCenter: centerMatch ? { x: parseInt(centerMatch[1]), y: parseInt(centerMatch[2]) } : null,
              hasCenterContent: hasContentMatch ? hasContentMatch[1] === 'true' : null,
              debugOutputPresent: adrMessages.length > 0
            };

            results.push(measurement);

            // Determine if this test passed
            const hasNoWarnings = !debugContent.includes('may be misaligned') && !debugContent.includes('ERROR');
            const hasCenterData = measurement.hasCenterContent !== null;

            measurement.withinTolerance = hasNoWarnings && hasCenterData;

            console.log(`  Status: ${measurement.withinTolerance ? '✅ PASS' : '❌ FAIL'}`);

          } else {
            console.log(`⚠️ Display ${i}: Debug panel not found`);
            results.push({
              displayIndex: i,
              error: 'Debug panel not found',
              withinTolerance: false
            });
          }

        } catch (error) {
          console.log(`❌ Display ${i}: Error testing ADR alignment - ${error.message}`);
          results.push({
            displayIndex: i,
            error: error.message,
            withinTolerance: false
          });
        }
      }
    }

    // Evaluate overall test result
    const passedCount = results.filter(r => r.withinTolerance).length;
    const totalCount = results.length;
    this.testResults.adrAlignment = {
      passed: passedCount === totalCount && totalCount > 0,
      measurements: results,
      summary: `${passedCount}/${totalCount} displays have proper ADR alignment`
    };

    console.log(`\nADR Alignment Test Result: ${this.testResults.adrAlignment.passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Summary: ${this.testResults.adrAlignment.summary}`);

    return this.testResults.adrAlignment;
  }

  /**
   * TEST 3: Mouse Interaction
   * Validates that mouse events work correctly after drag operations
   */
  async testMouseInteraction() {
    console.log('\n🔍 TEST 3: Mouse Interaction (Post-Drag Event Handling)');
    console.log('=' .repeat(60));

    const results = [];

    // Find all floating display elements
    const displays = await this.page.$$('.enhanced-floating.headerless');

    for (let i = 0; i < Math.min(3, displays.length); i++) { // Test up to 3 displays
      const display = displays[i];

      try {
        // Get initial position
        const initialRect = await display.evaluate(el => el.getBoundingClientRect());

        console.log(`\nDisplay ${i}: Testing mouse interaction after drag...`);
        console.log(`Initial position: (${initialRect.left.toFixed(1)}, ${initialRect.top.toFixed(1)})`);

        // Click mouse interaction test button
        const mouseButton = await display.$('.debug-btn:text("🖱️")');
        if (!mouseButton) {
          console.log(`⚠️ Display ${i}: Mouse test button not found`);
          continue;
        }

        await mouseButton.click();
        await this.page.waitForTimeout(1000);

        // Perform drag operation
        const centerX = initialRect.left + initialRect.width / 2;
        const centerY = initialRect.top + initialRect.height / 2;

        await this.page.mouse.move(centerX, centerY);
        await this.page.mouse.down();
        await this.page.mouse.move(centerX + 100, centerY + 50);
        await this.page.mouse.up();

        // Wait for any animations to complete
        await this.page.waitForTimeout(500);

        // Get final position
        const finalRect = await display.evaluate(el => el.getBoundingClientRect());
        console.log(`Final position: (${finalRect.left.toFixed(1)}, ${finalRect.top.toFixed(1)})`);

        // Test mouse click after drag
        await this.page.mouse.move(finalRect.left + 10, finalRect.top + 10);
        await this.page.mouse.click(finalRect.left + 10, finalRect.top + 10);

        // Check for mouse interaction debug messages
        const debugPanel = await this.page.$('#coordinate-debugger-panel');
        let mouseMessages = [];

        if (debugPanel) {
          const debugContent = await debugPanel.textContent();
          mouseMessages = debugContent.match(/\[DEBUGGER:.*:MOUSE\].*/g) || [];
          console.log(`Mouse messages found: ${mouseMessages.length}`);
          mouseMessages.slice(-3).forEach(msg => {
            console.log(`  ${msg}`);
          });
        }

        const dragDistance = Math.sqrt(
          Math.pow(finalRect.left - initialRect.left, 2) +
          Math.pow(finalRect.top - initialRect.top, 2)
        );

        const measurement = {
          displayIndex: i,
          initialPosition: { x: initialRect.left, y: initialRect.top },
          finalPosition: { x: finalRect.left, y: finalRect.top },
          dragDistance,
          mouseMessagesCount: mouseMessages.length,
          dragSuccessful: dragDistance > 50,
          mouseEventsDetected: mouseMessages.length > 0
        };

        // Test passes if drag worked AND mouse events were detected
        measurement.withinTolerance = measurement.dragSuccessful && measurement.mouseEventsDetected;

        results.push(measurement);

        console.log(`Drag distance: ${dragDistance.toFixed(1)}px`);
        console.log(`Mouse events: ${mouseMessages.length}`);
        console.log(`Status: ${measurement.withinTolerance ? '✅ PASS' : '❌ FAIL'}`);

      } catch (error) {
        console.log(`❌ Display ${i}: Error testing mouse interaction - ${error.message}`);
        results.push({
          displayIndex: i,
          error: error.message,
          withinTolerance: false
        });
      }
    }

    // Evaluate overall test result
    const passedCount = results.filter(r => r.withinTolerance).length;
    const totalCount = results.length;
    this.testResults.mouseInteraction = {
      passed: passedCount === totalCount && totalCount > 0,
      measurements: results,
      summary: `${passedCount}/${totalCount} displays have working mouse interaction`
    };

    console.log(`\nMouse Interaction Test Result: ${this.testResults.mouseInteraction.passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Summary: ${this.testResults.mouseInteraction.summary}`);

    return this.testResults.mouseInteraction;
  }

  /**
   * Generate comprehensive validation report
   */
  generateReport() {
    const timestamp = new Date().toISOString();
    const allTestsPassed = Object.values(this.testResults).every(test => test.passed);

    const report = {
      timestamp,
      overallStatus: allTestsPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED',
      tests: this.testResults,
      summary: {
        canvasAlignment: this.testResults.canvasAlignment.summary,
        adrAlignment: this.testResults.adrAlignment.summary,
        mouseInteraction: this.testResults.mouseInteraction.summary,
        totalTestsPassed: Object.values(this.testResults).filter(t => t.passed).length,
        totalTests: Object.keys(this.testResults).length
      }
    };

    console.log('\n' + '='.repeat(80));
    console.log('🎯 GEOMETRY VALIDATION REPORT');
    console.log('='.repeat(80));
    console.log(`Timestamp: ${timestamp}`);
    console.log(`Overall Status: ${report.overallStatus}`);
    console.log('\nTest Results:');
    console.log(`  Canvas Alignment: ${this.testResults.canvasAlignment.passed ? '✅ PASS' : '❌ FAIL'} - ${report.summary.canvasAlignment}`);
    console.log(`  ADR Alignment:    ${this.testResults.adrAlignment.passed ? '✅ PASS' : '❌ FAIL'} - ${report.summary.adrAlignment}`);
    console.log(`  Mouse Interaction: ${this.testResults.mouseInteraction.passed ? '✅ PASS' : '❌ FAIL'} - ${report.summary.mouseInteraction}`);
    console.log(`\nSummary: ${report.summary.totalTestsPassed}/${report.summary.totalTests} tests passed`);
    console.log('='.repeat(80));

    return report;
  }

  /**
   * Run all geometry validation tests
   */
  async runAllTests() {
    console.log('\n🚀 STARTING COMPREHENSIVE GEOMETRY VALIDATION');
    console.log('Testing the three critical canvas geometry fixes...\n');

    try {
      // Test 1: Canvas Container Alignment
      await this.testCanvasContainerAlignment();

      // Test 2: ADR Alignment
      await this.testAdrAlignment();

      // Test 3: Mouse Interaction
      await this.testMouseInteraction();

      // Generate final report
      return this.generateReport();

    } catch (error) {
      console.error('❌ ERROR during geometry validation:', error);
      return {
        timestamp: new Date().toISOString(),
        overallStatus: '❌ TEST EXECUTION ERROR',
        error: error.message
      };
    }
  }
}

// Export for use in test files
export { GeometryValidationTest };

// Playwright test implementation
test.describe('Geometry Validation Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Wait for the app to load
    await page.waitForSelector('#app', { timeout: 5000 });

    // Wait for displayActions to be available
    await page.waitForFunction(() => {
      return window.displayActions && typeof window.displayActions.addDisplay === 'function';
    }, { timeout: 10000 });
  });

  test('Comprehensive canvas geometry fixes validation', async ({ page }) => {
    console.log('Creating test displays for geometry validation...');

    // Create 3 displays for testing
    const displayIds = [];
    for (let i = 0; i < 3; i++) {
      const displayId = await page.evaluate((index) => {
        return window.displayActions.addDisplay('EURUSD', {
          x: 100 + (index * 250),
          y: 100 + (index * 50)
        });
      }, i);
      displayIds.push(displayId);
      console.log(`Created display ${i + 1} with ID: ${displayId}`);
    }

    // Wait for floating displays to appear
    await page.waitForSelector('.enhanced-floating', { timeout: 10000 });

    // Create test instance
    const validator = new GeometryValidationTest(page);

    // Run all tests
    const report = await validator.runAllTests();

    // Assert that all tests passed
    expect(report.overallStatus).toContain('ALL TESTS PASSED');

    // Print detailed results
    console.log('\n📋 Detailed Test Results:');
    console.log(JSON.stringify(report, null, 2));
  });

  test('Individual Canvas Alignment test', async ({ page }) => {
    console.log('Creating test display for canvas alignment test...');

    // Create a test display
    const displayId = await page.evaluate(() => {
      return window.displayActions.addDisplay('EURUSD', { x: 100, y: 100 });
    });
    console.log(`Created display with ID: ${displayId}`);

    await page.waitForSelector('.enhanced-floating', { timeout: 10000 });

    const validator = new GeometryValidationTest(page);
    const result = await validator.testCanvasContainerAlignment();

    expect(result.passed).toBe(true);
  });

  test('Individual ADR Alignment test', async ({ page }) => {
    console.log('Creating test display for ADR alignment test...');

    // Create a test display
    const displayId = await page.evaluate(() => {
      return window.displayActions.addDisplay('EURUSD', { x: 100, y: 100 });
    });
    console.log(`Created display with ID: ${displayId}`);

    await page.waitForSelector('.enhanced-floating', { timeout: 10000 });

    const validator = new GeometryValidationTest(page);
    const result = await validator.testAdrAlignment();

    expect(result.passed).toBe(true);
  });

  test('Individual Mouse Interaction test', async ({ page }) => {
    console.log('Creating test display for mouse interaction test...');

    // Create a test display
    const displayId = await page.evaluate(() => {
      return window.displayActions.addDisplay('EURUSD', { x: 100, y: 100 });
    });
    console.log(`Created display with ID: ${displayId}`);

    await page.waitForSelector('.enhanced-floating', { timeout: 10000 });

    const validator = new GeometryValidationTest(page);
    const result = await validator.testMouseInteraction();

    expect(result.passed).toBe(true);
  });
});

console.log('📝 Geometry Validation Test Suite Ready');
console.log('Run with: npx playwright test tests/e2e/geometry-validation-test.js');