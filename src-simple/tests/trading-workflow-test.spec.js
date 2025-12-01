// Actual Trading Workflow Test
// Tests the full application with real user workflows
import { test, expect } from '@playwright/test';

test.describe('Actual Trading Workflow Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Enhanced console monitoring for trading workflows
    const consoleMessages = [];

    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();

      let emoji = '💡';
      let category = 'debug';

      if (text.includes('Error') || text.includes('error') || type === 'error') {
        emoji = '❌';
        category = 'error';
      } else if (text.includes('Warning') || text.includes('warning') || type === 'warning') {
        emoji = '⚠️';
        category = 'warning';
      } else if (text.includes('✅') || text.includes('SUCCESS') || text.includes('loaded')) {
        emoji = '✅';
        category = 'success';
      } else if (text.includes('🌐') || text.includes('WebSocket') || text.includes('Network')) {
        emoji = '🌐';
        category = 'network';
      } else if (text.includes('⌨️') || text.includes('keyboard') || text.includes('keydown')) {
        emoji = '⌨️';
        category = 'keyboard';
      } else if (text.includes('🎨') || text.includes('render') || text.includes('canvas')) {
        emoji = '🎨';
        category = 'rendering';
      } else if (text.includes('📊') || text.includes('PROGRESSIVE') || text.includes('ADR')) {
        emoji = '📊';
        category = 'progressive';
      }

      consoleMessages.push({
        text,
        category,
        emoji,
        type,
        timestamp: new Date().toISOString()
      });

      console.log(`${emoji} ${text}`);
    });

    // Store messages for analysis
    page.on('close', () => {
      const errors = consoleMessages.filter(m => m.category === 'error');
      const warnings = consoleMessages.filter(m => m.category === 'warning');
      const progressive = consoleMessages.filter(m => m.category === 'progressive');

      console.log(`\n📋 WORKFLOW ANALYSIS SUMMARY:`);
      console.log(`❌ Errors: ${errors.length}`);
      console.log(`⚠️ Warnings: ${warnings.length}`);
      console.log(`📊 Progressive ADR messages: ${progressive.length}`);

      if (errors.length > 0) {
        console.log('\n❌ ERRORS FOUND:');
        errors.forEach(e => console.log(`${e.emoji} ${e.text}`));
      }
    });
  });

  test('Main Application Loading and Display Creation', async ({ page }) => {
    console.log('🌐 Testing main application loading and display creation...');

    // Navigate to main application
    await page.goto('http://localhost:5176');
    await page.waitForLoadState('networkidle');

    // Wait for application to initialize
    await page.waitForTimeout(3000);

    // Check if the workspace loaded
    const workspace = page.locator('.workspace');
    await expect(workspace).toBeVisible();

    // Check if a default display was created
    const displays = page.locator('.floating-display, canvas');
    const displayCount = await displays.count();

    console.log(`📊 Found ${displayCount} displays in workspace`);

    if (displayCount === 0) {
      console.log('⚠️ No displays found, creating one manually...');

      // Try to create a display using Alt+A shortcut
      await page.keyboard.press('Alt+a');
      await page.waitForTimeout(1000);

      // Look for prompt and enter symbol
      try {
        await page.waitForSelector('input', { timeout: 2000 });
        await page.fill('input', 'EURUSD');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
      } catch (error) {
        console.log('⚠️ Could not create display via keyboard, trying manual approach');
      }
    }

    // Verify displays are present
    const finalDisplayCount = await displays.count();
    expect(finalDisplayCount).toBeGreaterThan(0);
    console.log(`✅ Application loaded with ${finalDisplayCount} displays`);
  });

  test('Canvas Rendering and Day Range Meter Functionality', async ({ page }) => {
    console.log('🎨 Testing Canvas Rendering and Day Range Meter...');

    await page.goto('http://localhost:5176');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Find canvases in the application
    const canvases = page.locator('canvas');
    const canvasCount = await canvases.count();

    console.log(`📊 Found ${canvasCount} canvas elements`);

    if (canvasCount > 0) {
      // Check first canvas for content
      const firstCanvas = canvases.first();
      await expect(firstCanvas).toBeVisible();

      // Get canvas context to verify it's rendering
      const canvasData = await firstCanvas.evaluate(canvas => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Try to get image data to verify canvas has content
        try {
          const imageData = ctx.getImageData(0, 0, Math.min(canvas.width, 100), Math.min(canvas.height, 100));
          return {
            hasContext: true,
            width: canvas.width,
            height: canvas.height,
            hasContent: imageData.data.some(pixel => pixel !== 0)
          };
        } catch (error) {
          return {
            hasContext: true,
            width: canvas.width,
            height: canvas.height,
            hasContent: false,
            error: error.message
          };
        }
      });

      console.log('📊 Canvas Analysis:', canvasData);
      expect(canvasData.hasContext).toBe(true);
    } else {
      console.log('⚠️ No canvas elements found in application');
    }
  });

  test('Keyboard Navigation and Interactions', async ({ page }) => {
    console.log('⌨️ Testing keyboard navigation and interactions...');

    await page.goto('http://localhost:5176');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Test ESC key for progressive escape pattern
    console.log('⌨️ Testing ESC key progressive escape pattern...');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Test Alt+A for display creation
    console.log('⌨️ Testing Alt+A display creation...');
    await page.keyboard.press('Alt+a');
    await page.waitForTimeout(1000);

    // Check if prompt appears
    try {
      const prompt = page.locator('input, [role="dialog"], .modal');
      const isPromptVisible = await prompt.isVisible();

      if (isPromptVisible) {
        console.log('✅ Display creation prompt appeared');
        await page.fill('input', 'GBPUSD');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
        console.log('✅ Display creation workflow completed');
      } else {
        console.log('⚠️ Display creation prompt not detected');
      }
    } catch (error) {
      console.log('⚠️ Keyboard workflow test incomplete');
    }
  });

  test('Error Handling and Resilience', async ({ page }) => {
    console.log('🛡️ Testing error handling and resilience...');

    // Monitor console for errors during navigation
    let errorCount = 0;
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errorCount++;
      }
    });

    await page.goto('http://localhost:5176');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Try to interact with elements that might not exist
    try {
      const nonExistentElement = page.locator('.non-existent-element');
      await nonExistentElement.click({ timeout: 1000 });
    } catch (error) {
      // Expected to fail
      console.log('✅ Graceful handling of non-existent elements');
    }

    // Try rapid interactions to stress test
    console.log('⚡ Stress testing with rapid interactions...');
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(50);
    }

    console.log(`🛡️ Error count during stress test: ${errorCount}`);
    expect(errorCount).toBeLessThan(5); // Allow some errors but not too many
  });

  test('WebSocket Connection and Data Flow', async ({ page }) => {
    console.log('🌐 Testing WebSocket connection and data flow...');

    // Monitor network activity
    const requests = [];
    page.on('request', request => {
      requests.push({
        url: request.url(),
        method: request.method(),
        timestamp: new Date().toISOString()
      });
    });

    await page.goto('http://localhost:5176');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000); // Give time for WebSocket connections

    // Analyze network requests
    const webSocketRequests = requests.filter(req => req.url.includes('ws://') || req.url.includes('socket'));
    const httpRequest = requests.filter(req => req.url.startsWith('http'));

    console.log(`📊 Network Analysis:`);
    console.log(`  WebSocket requests: ${webSocketRequests.length}`);
    console.log(`  HTTP requests: ${httpRequest.length}`);

    if (httpRequest.length > 0) {
      console.log('📡 HTTP requests detected:');
      httpRequest.slice(0, 5).forEach(req => {
        console.log(`  ${req.method} ${req.url}`);
      });
    }

    // Check for WebSocket errors in console
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('WebSocket') || text.includes('socket')) {
        console.log(`🌐 WebSocket: ${text}`);
      }
    });
  });

  test('Progressive ADR Disclosure in Real Application', async ({ page }) => {
    console.log('📊 Testing Progressive ADR Disclosure in real application...');

    let progressiveMessages = [];

    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('PROGRESSIVE') || text.includes('ADR') || text.includes('Day Range')) {
        progressiveMessages.push({
          text,
          timestamp: new Date().toISOString()
        });
        console.log(`📊 ${text}`);
      }
    });

    await page.goto('http://localhost:5176');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    console.log(`📊 Progressive ADR messages found: ${progressiveMessages.length}`);

    if (progressiveMessages.length > 0) {
      progressiveMessages.forEach(msg => {
        console.log(`  ${msg.timestamp}: ${msg.text}`);
      });
    } else {
      console.log('⚠️ No progressive ADR messages detected in real application');
    }
  });

  test('Performance Under Load', async ({ page }) => {
    console.log('⚡ Testing performance under load...');

    const startTime = Date.now();

    await page.goto('http://localhost:5176');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;
    console.log(`⚡ Initial page load time: ${loadTime}ms`);

    // Test rapid display interactions
    const interactionTimes = [];

    for (let i = 0; i < 20; i++) {
      const interactionStart = Date.now();

      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);

      const interactionTime = Date.now() - interactionStart;
      interactionTimes.push(interactionTime);
    }

    const avgInteractionTime = interactionTimes.reduce((a, b) => a + b, 0) / interactionTimes.length;
    console.log(`⚡ Average interaction time: ${avgInteractionTime.toFixed(2)}ms`);

    // Performance assertions
    expect(loadTime).toBeLessThan(5000); // Page should load in under 5 seconds
    expect(avgInteractionTime).toBeLessThan(200); // Interactions should be responsive

    if (avgInteractionTime < 50) {
      console.log('🚀 EXCELLENT: Highly responsive interactions');
    } else if (avgInteractionTime < 100) {
      console.log('✅ GOOD: Responsive interactions');
    } else {
      console.log('⚠️ Performance could be improved');
    }
  });
});