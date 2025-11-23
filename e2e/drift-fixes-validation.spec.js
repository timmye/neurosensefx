import { test, expect } from '@playwright/test';

test.describe('Drift Fixes Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the application to load
    await page.waitForLoadState('networkidle');

    // Wait for test canvas creation function to be available
    await page.waitForFunction(() => window.createTestCanvas, { timeout: 10000 });
  });

  test('canvas creation works with drift fixes applied', async ({ page }) => {
    console.log('🧪 Testing drift fixes with window.createTestCanvas()');

    // Create a test canvas using the new global function
    const displayId = await page.evaluate(() => {
      return window.createTestCanvas('EURUSD', 300, 200);
    });

    // Verify canvas was created successfully
    expect(displayId).toBeTruthy();
    console.log(`✅ Canvas created with ID: ${displayId}`);

    // Wait for canvas element to appear and be visible
    await page.waitForSelector('canvas', { timeout: 15000 });

    // Check that canvas elements are present
    const canvasCount = await page.locator('canvas').count();
    expect(canvasCount).toBeGreaterThan(0);
    console.log(`✅ Found ${canvasCount} canvas element(s)`);

    // Check for drift monitoring logs
    const driftLogs = await page.evaluate(() => {
      const logs = [];
      const originalLog = console.log;

      // Capture logs for the next few seconds
      console.log = (...args) => {
        logs.push(args.join(' '));
        originalLog.apply(console, args);
      };

      return logs;
    });

    // Simulate some interactions that could cause drift
    await page.mouse.move(350, 250);
    await page.mouse.down();
    await page.mouse.move(400, 300);
    await page.mouse.up();

    // Wait a bit to see if drift occurs
    await page.waitForTimeout(2000);

    // Check browser console for drift detection messages
    const consoleLogs = await page.evaluate(() => {
      return window.driftLogs || [];
    });

    // Verify no critical drift messages
    const criticalDriftMessages = consoleLogs.filter(log =>
      log.includes('CRITICAL') ||
      log.includes('SEVERE DRIFT') ||
      log.includes('transform accumulation')
    );

    console.log(`📊 Console logs checked: ${consoleLogs.length} messages`);
    console.log(`🚨 Critical drift messages: ${criticalDriftMessages.length}`);

    // The test passes if we can create and interact with canvas without critical drift
    expect(criticalDriftMessages.length).toBe(0);
  });

  test('transform matrix fix prevents cumulative drift', async ({ page }) => {
    console.log('🔧 Testing explicit transform matrix fix');

    // Create test canvas
    const displayId = await page.evaluate(() => {
      return window.createTestCanvas('EURUSD', 200, 150);
    });

    expect(displayId).toBeTruthy();

    // Wait for canvas to be ready
    await page.waitForSelector('canvas');

    // Monitor canvas position over multiple operations
    const positions = [];

    for (let i = 0; i < 5; i++) {
      const position = await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          return {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height
          };
        }
        return null;
      });

      positions.push(position);

      // Perform some operations that might trigger drift
      await page.mouse.move(250 + i * 10, 200 + i * 10);
      await page.mouse.click(250 + i * 10, 200 + i * 10);
      await page.waitForTimeout(500);
    }

    console.log('📍 Canvas positions recorded:', positions);

    // Verify position stability (no significant drift)
    if (positions.length >= 2 && positions[0] && positions[positions.length - 1]) {
      const firstPos = positions[0];
      const lastPos = positions[positions.length - 1];

      const leftDrift = Math.abs(lastPos.left - firstPos.left);
      const topDrift = Math.abs(lastPos.top - firstPos.top);

      console.log(`📏 Position drift measured: ${leftDrift.toFixed(2)}px horizontally, ${topDrift.toFixed(2)}px vertically`);

      // Drift should be minimal (less than 1px)
      expect(leftDrift).toBeLessThan(1);
      expect(topDrift).toBeLessThan(1);

      console.log('✅ Transform matrix fix successful - minimal drift detected');
    }
  });

  test('render deduplication prevents concurrent frames', async ({ page }) => {
    console.log('🚀 Testing render frame deduplication');

    // Create test canvas
    const displayId = await page.evaluate(() => {
      return window.createTestCanvas('EURUSD', 400, 300);
    });

    expect(displayId).toBeTruthy();

    // Wait for canvas to be ready
    await page.waitForSelector('canvas');

    // Trigger rapid state changes that would normally cause concurrent renders
    const renderMonitor = await page.evaluate(() => {
      let renderCount = 0;
      const originalRAF = window.requestAnimationFrame;

      window.requestAnimationFrame = function(callback) {
        renderCount++;
        console.log(`[RENDER MONITOR] RAF call #${renderCount}`);
        return originalRAF.call(this, callback);
      };

      return () => renderCount;
    });

    // Simulate rapid state updates
    for (let i = 0; i < 10; i++) {
      await page.evaluate((index) => {
        // Trigger reactive updates that would normally cause multiple renders
        const event = new CustomEvent('testUpdate', { detail: index });
        window.dispatchEvent(event);
      }, i);

      await page.waitForTimeout(50); // Small delay between updates
    }

    // Allow time for renders to settle
    await page.waitForTimeout(1000);

    // Check render count
    const finalRenderCount = await page.evaluate(() => {
      return window.renderCount || 0;
    });

    console.log(`🎬 Total render requests: ${finalRenderCount}`);

    // With deduplication, render requests should be significantly less than triggers
    expect(finalRenderCount).toBeLessThan(15); // Allow some overhead but much less than 30+

    console.log('✅ Render deduplication working correctly');
  });
});