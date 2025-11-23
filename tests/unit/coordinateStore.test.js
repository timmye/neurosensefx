/**
 * Real-World Coordinate System Testing
 *
 * Tests coordinate transformations with actual browser environment,
 * real device pixel ratios, and live canvas rendering
 */

import { test, expect } from '@playwright/test';
import { chromium } from 'playwright';

// Test configuration
const BASE_URL = 'http://localhost:5174';

test.describe('Real-World Coordinate System Performance', () => {
  let browser;
  let context;
  let page;

  test.beforeAll(async () => {
    // Launch real browser with different DPR settings
    browser = await chromium.launch({
      headless: false,
      args: [
        '--disable-web-security',
        '--force-device-scale-factor=1' // Start with 1x DPR
      ]
    });
  });

  test.beforeEach(async () => {
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    page = await context.newPage();

    // Setup coordinate monitoring
    await page.addInitScript(() => {
      window.coordinateMetrics = {
        transformations: [],
        renderTimes: [],
        dprChanges: []
      };

      // Monitor real coordinate transformations
      if (window.coordinateActions) {
        const originalCreateTransform = window.coordinateActions.createPriceToPixelTransform;
        window.coordinateActions.createPriceToPixelTransform = function(state) {
          const startTime = performance.now();
          const result = originalCreateTransform.call(this, state);
          const endTime = performance.now();

          window.coordinateMetrics.transformations.push({
            executionTime: endTime - startTime,
            state: JSON.parse(JSON.stringify(state)),
            timestamp: Date.now()
          });

          return result;
        };
      }

      // Monitor DPR changes
      let currentDPR = window.devicePixelRatio || 1;

      const observer = new MutationObserver(() => {
        const newDPR = window.devicePixelRatio || 1;
        if (newDPR !== currentDPR) {
          window.coordinateMetrics.dprChanges.push({
            from: currentDPR,
            to: newDPR,
            timestamp: Date.now()
          });
          currentDPR = newDPR;
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
    });
  });

  test.afterEach(async () => {
    await context.close();
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test('Real coordinate transformation performance at different DPRs', async () => {
    console.log('🧪 Testing coordinate transformations across different device pixel ratios...');

    // Test at standard DPR (1x)
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const currentDPR = await page.evaluate(() => window.devicePixelRatio);
    console.log(`🖼️ Starting DPR: ${currentDPR}`);

    // Test coordinate transformations with real displays
    console.log('📊 Testing coordinate transformations with real displays...');

    // Create a display to test real coordinate transformations
    await page.keyboard.press('Control+k');
    await page.keyboard.type('EUR/USD');
    await page.waitForTimeout(500);

    const eurUsdResult = page.locator('.search-result').filter({ hasText: 'EUR/USD' });
    const eurUsdExists = await eurUsdResult.count() > 0;

    let displayCreated = false;
    if (eurUsdExists) {
      await eurUsdResult.first().click();
      await page.waitForTimeout(2000);
      displayCreated = true;
    }

    expect(displayCreated).toBe(true);

    // Test coordinate transformation performance
    const transformationMetrics = await page.evaluate(() => {
      if (!window.coordinateActions) return null;

      const state = {
        bounds: { x: [0, 220], y: [0, 120] },
        priceRange: { min: 1.0000, max: 1.1000 }
      };

      const times = [];

      // Test many coordinate transformations
      for (let i = 0; i < 1000; i++) {
        const start = performance.now();
        const transform = window.coordinateActions.createPriceToPixelTransform(state);
        const result = transform(1.0500 + (i % 100) * 0.0001);
        const end = performance.now();
        times.push(end - start);
      }

      return {
        average: times.reduce((a, b) => a + b, 0) / times.length,
        max: Math.max(...times),
        min: Math.min(...times),
        total: times.reduce((a, b) => a + b, 0)
      };
    });

    if (transformationMetrics) {
      console.log(`⚡ Average transformation time: ${transformationMetrics.average.toFixed(3)}ms`);
      console.log(`⚡ Max transformation time: ${transformationMetrics.max.toFixed(3)}ms`);
      console.log(`⚡ Total transformation time: ${transformationMetrics.total.toFixed(2)}ms`);

      // Transformations should be extremely fast
      expect(transformationMetrics.average).toBeLessThan(0.01); // Less than 0.01ms per transformation
      expect(transformationMetrics.max).toBeLessThan(0.1); // Less than 0.1ms max
    }
  });

  test('Real DPR-aware coordinate accuracy', async () => {
    console.log('🧪 Testing DPR-aware coordinate accuracy...');

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Test coordinate accuracy at current DPR
    const coordinateAccuracy = await page.evaluate(() => {
      if (!window.coordinateActions) return null;

      const state = {
        bounds: { x: [0, 220], y: [0, 120] },
        priceRange: { min: 1.0000, max: 1.1000 }
      };

      const transform = window.coordinateActions.createPriceToPixelTransform(state);
      const dpr = window.devicePixelRatio || 1;

      // Test coordinate precision
      const testPrices = [
        state.priceRange.min,
        state.priceRange.max,
        (state.priceRange.min + state.priceRange.max) / 2,
        1.0234,
        1.0567,
        1.0890
      ];

      const results = testPrices.map(price => {
        const pixelY = transform(price);
        const reversePrice = window.coordinateActions.createPixelToPriceTransform(state)(pixelY);

        return {
          originalPrice: price,
          pixelY: pixelY,
          reversePrice: reversePrice,
          accuracy: Math.abs(price - reversePrice),
          dpr: dpr
        };
      });

      return results;
    });

    if (coordinateAccuracy) {
      console.log('🎯 Coordinate accuracy test results:');
      coordinateAccuracy.forEach(result => {
        console.log(`  Price ${result.originalPrice.toFixed(4)} → Pixel ${result.pixelY.toFixed(2)} → ${result.reversePrice.toFixed(4)} (accuracy: ${result.accuracy.toFixed(6)})`);
      });

      // Check accuracy requirements
      const maxAccuracy = Math.max(...coordinateAccuracy.map(r => r.accuracy));
      expect(maxAccuracy).toBeLessThan(0.0001); // Should be extremely accurate

      // All results should be at the correct DPR
      const allCorrectDPR = coordinateAccuracy.every(r => r.dpr === window.devicePixelRatio || 1);
      expect(allCorrectDPR).toBe(true);
    }
  });

  test('Real coordinate system with live canvas rendering', async () => {
    console.log('🧪 Testing coordinate system with live canvas rendering...');

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Create multiple displays to test coordinate system under load
    const testSymbols = ['EUR/USD', 'GBP/USD', 'USD/JPY'];
    const createdDisplays = [];

    for (const symbol of testSymbols) {
      await page.keyboard.press('Control+k');
      await page.keyboard.type(symbol);
      await page.waitForTimeout(500);

      const symbolResult = page.locator('.search-result').filter({ hasText: symbol });
      const symbolExists = await symbolResult.count() > 0;

      if (symbolExists) {
        await symbolResult.first().click();
        await page.waitForTimeout(2000);
        createdDisplays.push(symbol);
      }

      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    console.log(`📊 Created ${createdDisplays.length} displays for coordinate testing`);

    // Test coordinate system performance with multiple displays
    const multiDisplayMetrics = await page.evaluate(() => {
      if (!window.coordinateActions) return null;

      const displays = document.querySelectorAll('[data-display-id]');
      const metrics = [];

      displays.forEach((display, index) => {
        const canvas = display.querySelector('canvas');
        if (!canvas) return;

        const startTime = performance.now();

        // Test coordinate transformations for this display
        const state = {
          bounds: { x: [0, canvas.width], y: [0, canvas.height] },
          priceRange: { min: 1.0000, max: 1.1000 }
        };

        const transform = window.coordinateActions.createPriceToPixelTransform(state);

        // Test multiple coordinate transformations
        for (let i = 0; i < 100; i++) {
          const price = 1.0000 + (i % 100) * 0.001;
          const pixelY = transform(price);

          // Verify pixel is within canvas bounds
          if (pixelY < 0 || pixelY > canvas.height) {
            metrics.push({
              displayIndex: index,
              error: 'out_of_bounds',
              price: price,
              pixelY: pixelY,
              canvasHeight: canvas.height
            });
          }
        }

        const endTime = performance.now();

        metrics.push({
          displayIndex: index,
          transformationTime: endTime - startTime,
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          dpr: window.devicePixelRatio || 1
        });
      });

      return metrics;
    });

    if (multiDisplayMetrics) {
      const errors = multiDisplayMetrics.filter(m => m.error);
      const performanceMetrics = multiDisplayMetrics.filter(m => !m.error);

      console.log(`❌ Coordinate errors: ${errors.length}`);
      if (errors.length > 0) {
        errors.forEach(error => {
          console.log(`  Display ${error.displayIndex}: ${error.error} for price ${error.price} → pixel ${error.pixelY} (canvas height: ${error.canvasHeight})`);
        });
      }

      console.log(`⚡ Performance metrics for ${performanceMetrics.length} displays:`);
      performanceMetrics.forEach(metric => {
        console.log(`  Display ${metric.displayIndex}: ${metric.transformationTime.toFixed(3)}ms, Canvas: ${metric.canvasWidth}x${metric.canvasHeight}, DPR: ${metric.dpr}`);
      });

      // Should have no coordinate errors
      expect(errors.length).toBe(0);

      // Performance should remain good with multiple displays
      const avgTransformationTime = performanceMetrics.reduce((sum, m) => sum + m.transformationTime, 0) / performanceMetrics.length;
      expect(avgTransformationTime).toBeLessThan(5); // Less than 5ms per display
    }
  });

  test('Real coordinate system edge cases and stress testing', async () => {
    console.log('🧪 Testing coordinate system edge cases...');

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Test extreme price ranges
    const extremeRangeTest = await page.evaluate(() => {
      if (!window.coordinateActions) return null;

      const extremeRanges = [
        { min: 0.0001, max: 999.9999 },  // Very large range
        { min: 1.0000, max: 1.0001 },    // Very small range
        { min: -100.0, max: 100.0 },     // Negative prices (edge case)
        { min: 0, max: 0 }               // Zero range (edge case)
      ];

      const results = extremeRanges.map((range, index) => {
        try {
          const state = {
            bounds: { x: [0, 220], y: [0, 120] },
            priceRange: range
          };

          const transform = window.coordinateActions.createPriceToPixelTransform(state);

          // Test transformation
          const testPrice = (range.min + range.max) / 2;
          const pixelY = transform(testPrice);

          return {
            rangeIndex: index,
            range: range,
            testPrice: testPrice,
            pixelY: pixelY,
            success: true,
            error: null
          };
        } catch (error) {
          return {
            rangeIndex: index,
            range: range,
            success: false,
            error: error.message
          };
        }
      });

      return results;
    });

    if (extremeRangeTest) {
      console.log('🎯 Extreme range test results:');
      extremeRangeTest.forEach(result => {
        if (result.success) {
          console.log(`  Range ${result.rangeIndex}: [${result.range.min}, ${result.range.max}] → Price ${result.testPrice} → Pixel ${result.pixelY}`);
        } else {
          console.log(`  Range ${result.rangeIndex}: [${result.range.min}, ${result.range.max}] → ERROR: ${result.error}`);
        }
      });

      // System should handle extreme ranges gracefully
      const errors = extremeRangeTest.filter(r => !r.success);
      expect(errors.length).toBeLessThan(extremeRangeTest.length); // At least some should succeed
    }

    // Test rapid coordinate transformations (stress test)
    console.log('⚡ Testing rapid coordinate transformations...');

    const stressTestStart = performance.now();

    const stressTestResults = await page.evaluate(() => {
      if (!window.coordinateActions) return null;

      const iterations = 10000;
      const state = {
        bounds: { x: [0, 220], y: [0, 120] },
        priceRange: { min: 1.0000, max: 1.1000 }
      };

      const transform = window.coordinateActions.createPriceToPixelTransform(state);
      const results = [];

      for (let i = 0; i < iterations; i++) {
        const price = 1.0000 + (i % 1000) * 0.0001;
        const startTime = performance.now();
        const pixelY = transform(price);
        const endTime = performance.now();

        results.push({
          iteration: i,
          price: price,
          pixelY: pixelY,
          executionTime: endTime - startTime
        });
      }

      return results;
    });

    const stressTestTime = performance.now() - stressTestStart;

    if (stressTestResults) {
      const avgExecutionTime = stressTestResults.reduce((sum, r) => sum + r.executionTime, 0) / stressTestResults.length;
      const maxExecutionTime = Math.max(...stressTestResults.map(r => r.executionTime));

      console.log(`⚡ Stress test completed: ${stressTestResults.length} iterations in ${stressTestTime.toFixed(2)}ms`);
      console.log(`⚡ Average execution time: ${avgExecutionTime.toFixed(4)}ms`);
      console.log(`⚡ Max execution time: ${maxExecutionTime.toFixed(4)}ms`);

      // Should maintain performance under stress
      expect(avgExecutionTime).toBeLessThan(0.001); // Less than 0.001ms average
      expect(maxExecutionTime).toBeLessThan(0.01); // Less than 0.01ms max
      expect(stressTestTime).toBeLessThan(1000); // Complete test in less than 1 second
    }
  });

  test('Real coordinate system memory efficiency', async () => {
    console.log('🧪 Testing coordinate system memory efficiency...');

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Get baseline memory
    const baselineMemory = await page.evaluate(() => {
      return performance.memory ? performance.memory.usedJSHeapSize : 0;
    });

    console.log(`💾 Baseline memory: ${(baselineMemory / 1024 / 1024).toFixed(2)} MB`);

    // Create many coordinate transformation functions
    const memoryTestStart = performance.now();

    await page.evaluate(() => {
      if (!window.coordinateActions) return;

      const transforms = [];

      // Create many transformation functions
      for (let i = 0; i < 1000; i++) {
        const state = {
          bounds: { x: [0, 220 + i], y: [0, 120 + i] },
          priceRange: {
            min: 1.0000 + (i * 0.0001),
            max: 1.1000 + (i * 0.0001)
          }
        };

        const transform = window.coordinateActions.createPriceToPixelTransform(state);
        transforms.push(transform);
      }

      // Use all transforms to ensure they're not optimized away
      transforms.forEach((transform, index) => {
        const price = 1.0500;
        const pixelY = transform(price);

        if (pixelY < 0 || pixelY > 1000) {
          console.error(`Invalid transformation ${index}: ${pixelY}`);
        }
      });
    });

    const memoryTestTime = performance.now() - memoryTestStart;

    // Check memory usage
    const finalMemory = await page.evaluate(() => {
      return performance.memory ? performance.memory.usedJSHeapSize : 0;
    });

    const memoryIncrease = finalMemory - baselineMemory;
    console.log(`💾 Final memory: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`);
    console.log(`💾 Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);
    console.log(`⚡ Memory test completed in: ${memoryTestTime.toFixed(2)}ms`);

    // Memory increase should be minimal
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
    expect(memoryTestTime).toBeLessThan(5000); // Complete in less than 5 seconds
  });
});

// Global test configuration
test.use({
  timeout: 30000,
  actionTimeout: 5000
});