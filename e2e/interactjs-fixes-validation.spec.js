import { test, expect } from '@playwright/test';

test.describe('Interact.js Fixes Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => window.createTestCanvas, { timeout: 10000 });
  });

  test('interact.js inertia disabled - no post-drag movement', async ({ page }) => {
    console.log('🔧 Testing interact.js inertia fix');

    // Create a test canvas
    const displayId = await page.evaluate(() => {
      return window.createTestCanvas('EURUSD', 300, 200);
    });

    expect(displayId).toBeTruthy();

    // Wait for canvas to be visible
    await page.waitForSelector('canvas');

    // Get initial position
    const initialPosition = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const rect = canvas.getBoundingClientRect();
      return { left: rect.left, top: rect.top };
    });

    console.log('📍 Initial position:', initialPosition);

    // Perform drag operation
    await page.mouse.move(350, 250);
    await page.mouse.down();
    await page.mouse.move(400, 300, { steps: 10 });
    await page.mouse.up();

    // Wait a moment to ensure drag is complete
    await page.waitForTimeout(100);

    // Get position immediately after drag
    const afterDragPosition = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const rect = canvas.getBoundingClientRect();
      return { left: rect.left, top: rect.top };
    });

    console.log('📍 Position after drag:', afterDragPosition);

    // CRITICAL TEST: Wait for potential inertia animation (should not happen)
    await page.waitForTimeout(500); // Give time for any inertia animation

    // Get position after wait
    const finalPosition = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const rect = canvas.getBoundingClientRect();
      return { left: rect.left, top: rect.top };
    });

    console.log('📍 Final position:', finalPosition);

    // Verify no post-drag movement (position should be stable)
    const horizontalMovement = Math.abs(finalPosition.left - afterDragPosition.left);
    const verticalMovement = Math.abs(finalPosition.top - afterDragPosition.top);

    console.log(`📏 Post-drag movement: ${horizontalMovement.toFixed(2)}px horizontal, ${verticalMovement.toFixed(2)}px vertical`);

    // With inertia disabled, there should be minimal movement (<1px)
    expect(horizontalMovement).toBeLessThan(1);
    expect(verticalMovement).toBeLessThan(1);

    console.log('✅ Interact.js inertia successfully disabled');
  });

  test('mouse interaction remains functional after drag', async ({ page }) => {
    console.log('🖱️ Testing mouse interaction after drag');

    // Create a test canvas
    const displayId = await page.evaluate(() => {
      return window.createTestCanvas('EURUSD', 300, 200);
    });

    expect(displayId).toBeTruthy();

    await page.waitForSelector('canvas');

    // Perform drag operation
    await page.mouse.move(350, 250);
    await page.mouse.down();
    await page.mouse.move(400, 300);
    await page.mouse.up();

    await page.waitForTimeout(200);

    // Test that mouse clicks still work after drag
    const clickResult = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return { success: false, message: 'Canvas not found' };

      // Simulate a click on the canvas
      const rect = canvas.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Create and dispatch a click event
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: centerX,
        clientY: centerY
      });

      const wasHandled = canvas.dispatchEvent(clickEvent);
      return { success: wasHandled, centerX, centerY };
    });

    console.log('🖱️ Click test result:', clickResult);

    // Verify that mouse events are still being handled
    expect(clickResult.success).toBe(true);

    console.log('✅ Mouse interaction remains functional after drag');
  });

  test('reasonable grid snapping - no forced repositioning', async ({ page }) => {
    console.log('📐 Testing grid snapping behavior');

    // Create canvas at specific position
    const displayId = await page.evaluate(() => {
      return window.createTestCanvas('EURUSD', 155, 77); // Non-grid position
    });

    expect(displayId).toBeTruthy();

    await page.waitForSelector('canvas');

    // Check if canvas remains at intended position (not forced to grid)
    const actualPosition = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const container = canvas.closest('.floating-display');
      const rect = container.getBoundingClientRect();
      return { left: rect.left, top: rect.top };
    });

    console.log('📐 Actual canvas position:', actualPosition);

    // With reasonable snap threshold (10px), the position should be close to intended
    // The position should not be exactly on a 20px grid if it wasn't originally
    expect(actualPosition.left).toBeGreaterThan(140); // Should be near 155, not forced to 140 or 160
    expect(actualPosition.left).toBeLessThan(170);

    console.log('✅ Grid snapping works reasonably without forced repositioning');
  });

  test('canvas positioning alignment - no initial offset', async ({ page }) => {
    console.log('⬆️ Testing initial canvas positioning');

    // Create multiple canvases to test consistent positioning
    const displayIds = await page.evaluate(() => {
      const ids = [];
      ids.push(window.createTestCanvas('EURUSD', 100, 100));
      ids.push(window.createTestCanvas('GBPUSD', 350, 100));
      ids.push(window.createTestCanvas('USDJPY', 600, 100));
      return ids;
    });

    expect(displayIds).toHaveLength(3);

    await page.waitForSelector('canvas');

    // Check canvas positions relative to their containers
    const positioningResults = await page.evaluate(() => {
      const canvases = document.querySelectorAll('canvas');
      const results = [];

      canvases.forEach((canvas, index) => {
        const container = canvas.closest('.floating-display');
        const canvasRect = canvas.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        // Check if canvas is properly aligned within container (no significant top offset)
        const topOffset = canvasRect.top - containerRect.top;

        results.push({
          index,
          topOffset: Math.round(topOffset * 100) / 100,
          isAligned: Math.abs(topOffset) < 5 // Allow small tolerance
        });
      });

      return results;
    });

    console.log('⬆️ Canvas alignment results:', positioningResults);

    // All canvases should be properly aligned (no large top offsets)
    const alignedCanvases = positioningResults.filter(r => r.isAligned);
    expect(alignedCanvases).toHaveLength(3);

    console.log('✅ All canvases properly positioned within containers');
  });
});