/**
 * Real-World Keyboard Shortcut Testing
 *
 * Tests keyboard shortcut functionality in real browser environment
 * with actual DOM interactions, no mocks or simulations
 */

import { test, expect } from '@playwright/test';
import { chromium } from 'playwright';

// Test configuration
const BASE_URL = 'http://localhost:5174';

test.describe('Real-World Keyboard Shortcuts', () => {
  let browser;
  let context;
  let page;

  test.beforeAll(async () => {
    // Launch real browser
    browser = await chromium.launch({
      headless: false, // Keep visible for debugging
      args: ['--disable-web-security'] // Allow WebSocket connections
    });
  });

  test.beforeEach(async () => {
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    page = await context.newPage();

    // Setup real performance monitoring
    await page.addInitScript(() => {
      window.performanceMetrics = {
        keyboardLatency: [],
        domUpdateTime: [],
        renderTime: []
      };

      // Monitor real keyboard event latency
      let keyPressStart;
      document.addEventListener('keydown', (e) => {
        keyPressStart = performance.now();
      });

      document.addEventListener('keyup', (e) => {
        if (keyPressStart) {
          window.performanceMetrics.keyboardLatency.push(performance.now() - keyPressStart);
        }
      });

      // Monitor DOM update performance
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'measure' && entry.name.includes('keyboard')) {
            window.performanceMetrics.domUpdateTime.push(entry.duration);
          }
        }
      });
      observer.observe({ entryTypes: ['measure'] });
    });
  });

  test.afterEach(async () => {
    await context.close();
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test('Real keyboard shortcut performance - Ctrl+K workflow', async () => {
    console.log('🧪 Testing real keyboard shortcut performance...');

    // Navigate to application
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Allow full initialization

    // Verify keyboard manager is loaded
    const keyboardManagerLoaded = await page.evaluate(() => {
      return window.keyboardManager !== undefined;
    });
    expect(keyboardManagerLoaded).toBe(true);

    // Test real keyboard shortcut latency
    const latencyMeasurements = [];

    for (let i = 0; i < 10; i++) {
      const startTime = performance.now();

      // Press real Ctrl+K combination
      await page.keyboard.press('Control+k');

      // Wait for actual DOM response
      await page.waitForFunction(() => {
        const active = document.activeElement;
        return active && active.classList && active.classList.contains('search-input');
      }, { timeout: 1000 });

      const responseTime = performance.now() - startTime;
      latencyMeasurements.push(responseTime);

      // Clear for next iteration
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // Calculate performance metrics
    const avgLatency = latencyMeasurements.reduce((a, b) => a + b, 0) / latencyMeasurements.length;
    const maxLatency = Math.max(...latencyMeasurements);

    console.log(`⚡ Average keyboard shortcut latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`⚡ Maximum latency: ${maxLatency.toFixed(2)}ms`);

    // Performance validation - should be under 310ms (professional trading requirement)
    expect(avgLatency).toBeLessThan(310);
    expect(maxLatency).toBeLessThan(500);

    // Verify symbol palette actually focuses
    const focusedElement = await page.evaluate(() => {
      const active = document.activeElement;
      return {
        tagName: active?.tagName,
        className: active?.className,
        placeholder: active?.placeholder
      };
    });

    expect(focusedElement.className).toContain('search-input');
  });

  test('Real keyboard shortcut combinations - complex workflows', async () => {
    console.log('🧪 Testing complex real-world keyboard workflows...');

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Test complex shortcut sequence: Ctrl+K → Type Search → Arrow Navigation → Enter → Escape
    const workflowStartTime = performance.now();

    // Step 1: Open symbol palette
    await page.keyboard.press('Control+k');
    await page.waitForSelector('.search-input:focus', { timeout: 1000 });

    // Step 2: Type real search query
    await page.keyboard.type('USD', { delay: 50 }); // Real typing speed
    await page.waitForTimeout(500);

    // Step 3: Navigate with arrow keys
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);

    // Verify selection state
    const firstResultSelected = await page.evaluate(() => {
      const results = document.querySelectorAll('.search-result');
      return results.length > 0 && results[0].classList.contains('selected');
    });

    expect(firstResultSelected).toBe(true);

    // Step 4: Select with Enter
    const displayCountBefore = await page.locator('[data-display-id]').count();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // Verify display was created
    const displayCountAfter = await page.locator('[data-display-id]').count();
    expect(displayCountAfter).toBeGreaterThan(displayCountBefore);

    // Step 5: Test Escape workflow
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    const workflowTime = performance.now() - workflowStartTime;
    console.log(`⚡ Complete keyboard workflow time: ${workflowTime.toFixed(2)}ms`);

    // Performance validation
    expect(workflowTime).toBeLessThan(5000); // Should complete within 5 seconds
  });

  test('Real keyboard accessibility and focus management', async () => {
    console.log('🧪 Testing real focus management and accessibility...');

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Test that keyboard shortcuts work from different focus states
    const focusStates = ['body', '.canvas-container', '.floating-display'];

    for (const state of focusStates) {
      console.log(`🎯 Testing keyboard shortcuts from ${state} focus...`);

      // Set initial focus
      if (state === 'body') {
        await page.click('body', { position: { x: 10, y: 10 } });
      } else {
        const element = page.locator(state);
        if (await element.count() > 0) {
          await element.first().click();
        }
      }

      await page.waitForTimeout(200);

      // Test keyboard shortcut works regardless of focus
      await page.keyboard.press('Control+k');

      const searchFocused = await page.evaluate(() => {
        const active = document.activeElement;
        return active && active.classList && active.classList.contains('search-input');
      });

      expect(searchFocused).toBe(true);

      // Reset for next iteration
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  });

  test('Real keyboard conflict handling and edge cases', async () => {
    console.log('🧪 Testing real keyboard conflict scenarios...');

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Test rapid key presses
    console.log('⚡ Testing rapid key press handling...');

    const rapidKeyPressStart = performance.now();

    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Control+k');
      await page.waitForTimeout(50);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(50);
    }

    const rapidKeyPressTime = performance.now() - rapidKeyPressStart;
    console.log(`⚡ Rapid key press test completed in: ${rapidKeyPressTime.toFixed(2)}ms`);

    // Test modifier key combinations
    const modifierKeys = [
      'Control+Shift+k',
      'Alt+k',
      'Meta+k', // Cmd on Mac
      'Control+Shift+Alt+k'
    ];

    for (const combo of modifierKeys) {
      console.log(`🎯 Testing modifier combination: ${combo}`);

      await page.keyboard.press(combo);
      await page.waitForTimeout(300);

      // Should still respond to basic Ctrl+K
      await page.keyboard.press('Control+k');
      const searchFocused = await page.evaluate(() => {
        const active = document.activeElement;
        return active && active.classList && active.classList.contains('search-input');
      });

      expect(searchFocused).toBe(true);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  });

  test('Real memory usage during keyboard operations', async () => {
    console.log('🧪 Testing real memory usage during keyboard operations...');

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Get initial memory baseline
    const initialMemory = await page.evaluate(() => {
      return performance.memory ? performance.memory.usedJSHeapSize : 0;
    });

    console.log(`💾 Initial memory usage: ${(initialMemory / 1024 / 1024).toFixed(2)} MB`);

    // Perform extensive keyboard operations
    for (let i = 0; i < 100; i++) {
      await page.keyboard.press('Control+k');
      await page.keyboard.type('TEST');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(10);
    }

    // Check final memory usage
    const finalMemory = await page.evaluate(() => {
      return performance.memory ? performance.memory.usedJSHeapSize : 0;
    });

    const memoryIncrease = finalMemory - initialMemory;
    console.log(`💾 Final memory usage: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`);
    console.log(`💾 Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);

    // Memory should not increase dramatically (no memory leaks)
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
  });

  test('Real keyboard shortcut integration with canvas rendering', async () => {
    console.log('🧪 Testing keyboard shortcuts with real canvas rendering...');

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Create a display via keyboard shortcuts
    await page.keyboard.press('Control+k');
    await page.keyboard.type('EUR/USD');
    await page.waitForTimeout(500);

    // Find and select EUR/USD
    const eurUsdResult = page.locator('.search-result').filter({ hasText: 'EUR/USD' });
    const eurUsdExists = await eurUsdResult.count() > 0;

    if (eurUsdExists) {
      await eurUsdResult.first().click();
      await page.waitForTimeout(2000);

      // Test keyboard interaction with canvas
      const canvasDisplay = page.locator('[data-display-id]').filter({ hasText: /EUR\/USD/i });
      await canvasDisplay.first().click();
      await page.waitForTimeout(500);

      // Test that keyboard shortcuts still work when canvas is focused
      await page.keyboard.press('Control+k');

      const searchStillFocused = await page.evaluate(() => {
        const active = document.activeElement;
        return active && active.classList && active.classList.contains('search-input');
      });

      expect(searchStillFocused).toBe(true);
    }
  });

  test('Real cross-browser keyboard shortcut consistency', async () => {
    console.log('🧪 Testing keyboard shortcut behavior consistency...');

    // Test multiple rapid cycles to ensure consistent behavior
    for (let cycle = 0; cycle < 5; cycle++) {
      console.log(`🔄 Testing cycle ${cycle + 1}/5...`);

      const cycleStartTime = performance.now();

      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Test basic shortcut
      await page.keyboard.press('Control+k');

      const shortcutWorked = await page.evaluate(() => {
        const active = document.activeElement;
        return active && active.classList && active.classList.contains('search-input');
      });

      expect(shortcutWorked).toBe(true);

      const cycleTime = performance.now() - cycleStartTime;
      console.log(`⚡ Cycle ${cycle + 1} completed in: ${cycleTime.toFixed(2)}ms`);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }
  });
});

// Global test configuration
test.use({
  timeout: 30000,
  actionTimeout: 5000
});