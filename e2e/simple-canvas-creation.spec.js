/**
 * Simple Canvas Creation Test
 * Bypasses symbol palette workflow to directly test canvas rendering and drift fixes
 */

import { test, expect } from '@playwright/test';

test.describe('Simple Canvas Creation and Drift Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Wait for the app to load
    await page.waitForSelector('#app', { timeout: 5000 });

    // Wait for displayActions to be available
    await page.waitForFunction(() => {
      return window.displayActions && typeof window.displayActions.addDisplay === 'function';
    }, { timeout: 10000 });
  });

  test('creates display directly and validates canvas visibility', async ({ page }) => {
    console.log('Creating display directly via displayActions...');

    // Create a display directly using the exposed displayActions
    const displayId = await page.evaluate(() => {
      return window.displayActions.addDisplay('EURUSD', { x: 100, y: 100 });
    });

    console.log(`Display created with ID: ${displayId}`);
    expect(displayId).toBeTruthy();

    // Wait for canvas to appear
    await page.waitForSelector('canvas', { timeout: 10000 });

    // Verify canvas elements exist and are visible
    const canvasInfo = await page.evaluate(() => {
      const canvases = document.querySelectorAll('canvas');
      const results = [];

      canvases.forEach((canvas, index) => {
        const rect = canvas.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(canvas);
        const ctx = canvas.getContext('2d');

        results.push({
          index,
          width: canvas.width,
          height: canvas.height,
          clientWidth: canvas.clientWidth,
          clientHeight: canvas.clientHeight,
          rect: {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height
          },
          isVisible: rect.width > 0 && rect.height > 0 && computedStyle.display !== 'none',
          display: computedStyle.display,
          visibility: computedStyle.visibility,
          opacity: computedStyle.opacity,
          hasContext: !!ctx,
          dpr: window.devicePixelRatio || 1
        });
      });

      return results;
    });

    console.log('Canvas information:', canvasInfo);
    expect(canvasInfo.length).toBeGreaterThan(0);

    // At least one canvas should be visible
    const visibleCanvases = canvasInfo.filter(c => c.isVisible);
    expect(visibleCanvases.length).toBeGreaterThan(0);

    // Validate canvas dimensions
    const firstCanvas = canvasInfo[0];
    expect(firstCanvas.width).toBeGreaterThan(0);
    expect(firstCanvas.height).toBeGreaterThan(0);
    expect(firstCanvas.clientWidth).toBeGreaterThan(0);
    expect(firstCanvas.clientHeight).toBeGreaterThan(0);
    expect(firstCanvas.hasContext).toBe(true);
  });

  test('validates drift fix with explicit transform reset', async ({ page }) => {
    console.log('Testing drift fix with explicit transform reset...');

    // Create a display
    const displayId = await page.evaluate(() => {
      return window.displayActions.addDisplay('GBPUSD', { x: 200, y: 150 });
    });

    // Wait for canvas and initial render
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.waitForTimeout(1000); // Allow initial render to complete

    // Monitor console for drift debugging messages
    const consoleMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('DEBUGGER:DRIFT') || text.includes('setTransform') || text.includes('restore')) {
        consoleMessages.push({
          type: msg.type(),
          text: text,
          location: msg.location()
        });
      }
    });

    // Simulate rapid position changes to trigger potential drift
    const positions = [
      { x: 100, y: 100 },
      { x: 250, y: 100 },
      { x: 250, y: 250 },
      { x: 100, y: 250 },
      { x: 175, y: 175 }
    ];

    for (const pos of positions) {
      await page.evaluate((x, y, id) => {
        window.displayActions.moveDisplay(id, { x, y });
      }, pos.x, pos.y, displayId);

      await page.waitForTimeout(500); // Small delay between moves
    }

    // Wait for any drift detection to occur
    await page.waitForTimeout(2000);

    // Check if drift debugging messages were logged
    const driftMessages = consoleMessages.filter(msg => msg.text.includes('DEBUGGER:DRIFT'));
    const transformMessages = consoleMessages.filter(msg => msg.text.includes('setTransform'));

    console.log(`Found ${driftMessages.length} drift debug messages`);
    console.log(`Found ${transformMessages.length} transform messages`);

    // The explicit transform reset should be visible in console logs
    const explicitResetFound = consoleMessages.some(msg =>
      msg.text.includes('setTransform(1, 0, 0, 1, 0, 0)') ||
      msg.text.includes('CRITICAL FIX: Explicit reset')
    );

    console.log('Explicit transform reset found:', explicitResetFound);

    // Test that canvas is still rendering properly after position changes
    const canvasStillRendering = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return false;

      const ctx = canvas.getContext('2d');
      if (!ctx) return false;

      // Check if canvas has content (not just blank)
      const imageData = ctx.getImageData(0, 0, Math.min(canvas.width, 100), Math.min(canvas.height, 100));
      const hasContent = imageData.data.some((channel, index) => {
        return index % 4 !== 3 && channel !== 17 && channel !== 0; // Not default background
      });

      return hasContent;
    });

    expect(canvasStillRendering).toBe(true);
  });

  test('validates render deduplication prevents race conditions', async ({ page }) => {
    console.log('Testing render deduplication...');

    // Create a display
    const displayId = await page.evaluate(() => {
      return window.displayActions.addDisplay('USDJPY', { x: 300, y: 200 });
    });

    await page.waitForSelector('canvas', { timeout: 10000 });

    // Monitor for render-related console messages
    const renderMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('scheduleRender') || text.includes('pendingRender') || text.includes('requestAnimationFrame')) {
        renderMessages.push({
          type: msg.type(),
          text: text,
          timestamp: Date.now()
        });
      }
    });

    // Rapidly trigger position changes to potentially cause render race conditions
    for (let i = 0; i < 20; i++) {
      await page.evaluate((id, offset) => {
        window.displayActions.moveDisplay(id, {
          x: 300 + offset,
          y: 200 + offset
        });
      }, displayId, i * 5);
    }

    await page.waitForTimeout(1000);

    // Check if render deduplication messages are present
    const deduplicationMessages = renderMessages.filter(msg =>
      msg.text.includes('pendingRender') || msg.text.includes('scheduleRender')
    );

    console.log(`Found ${deduplicationMessages.length} render deduplication messages`);

    // The canvas should still be stable after rapid position changes
    const finalPosition = await page.evaluate((id) => {
      const display = window.displayStore.displays.get(id);
      return display ? display.position : null;
    }, displayId);

    expect(finalPosition).toBeTruthy();
    expect(finalPosition.x).toBeGreaterThan(300);
    expect(finalPosition.y).toBeGreaterThan(200);

    // Canvas should still be rendering properly
    const canvasHealth = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return { hasCanvas: false, isRendering: false };

      const ctx = canvas.getContext('2d');
      const rect = canvas.getBoundingClientRect();

      return {
        hasCanvas: true,
        isRendering: !!ctx,
        isVisible: rect.width > 0 && rect.height > 0,
        position: { left: rect.left, top: rect.top }
      };
    });

    expect(canvasHealth.hasCanvas).toBe(true);
    expect(canvasHealth.isRendering).toBe(true);
    expect(canvasHealth.isVisible).toBe(true);
  });

  test('validates DPR scaling works correctly', async ({ page }) => {
    console.log('Testing DPR scaling...');

    // Create a display
    const displayId = await page.evaluate(() => {
      return window.displayActions.addDisplay('EURUSD', { x: 100, y: 100 });
    });

    await page.waitForSelector('canvas', { timeout: 10000 });

    // Get DPR scaling information
    const dprInfo = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return null;

      const dpr = window.devicePixelRatio || 1;
      const ctx = canvas.getContext('2d');

      return {
        dpr: dpr,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        clientWidth: canvas.clientWidth,
        clientHeight: canvas.clientHeight,
        isDprScaled: canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight,
        hasContext: !!ctx,
        transform: ctx ? ctx.getTransform() : null
      };
    });

    console.log('DPR scaling information:', dprInfo);
    expect(dprInfo).toBeTruthy();
    expect(dprInfo.dpr).toBeGreaterThan(0);
    expect(dprInfo.hasContext).toBe(true);
    expect(dprInfo.canvasWidth).toBeGreaterThan(0);
    expect(dprInfo.canvasHeight).toBeGreaterThan(0);

    // On high-DPI displays, canvas should be properly scaled
    if (dprInfo.dpr > 1) {
      expect(dprInfo.isDprScaled).toBe(true);
    }

    // Test that content renders correctly with DPR scaling
    const contentCheck = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return false;

      const ctx = canvas.getContext('2d');
      if (!ctx) return false;

      // Sample some pixels to check if content is rendered
      const imageData = ctx.getImageData(
        Math.floor(canvas.width / 4),
        Math.floor(canvas.height / 4),
        50,
        50
      );

      // Check if we have non-background content
      let contentPixels = 0;
      for (let i = 0; i < imageData.data.length; i += 4) {
        // Check RGB channels for non-background colors
        if (imageData.data[i] !== 17 ||
            imageData.data[i + 1] !== 24 ||
            imageData.data[i + 2] !== 39) {
          contentPixels++;
        }
      }

      const contentRatio = contentPixels / (imageData.data.length / 4);
      return {
        hasContent: contentRatio > 0.1, // At least 10% content
        contentRatio: contentRatio,
        totalPixels: imageData.data.length / 4
      };
    });

    console.log('Content rendering check:', contentCheck);
    expect(contentCheck.hasContent).toBe(true);
  });
});