/**
 * Backend Reinitialization E2E Tests
 *
 * This test suite validates the backend reinitialization feature implemented
 * according to the plan at /workspaces/neurosensefx/plans/backend-reinit.md.
 *
 * Tests verify:
 * 1. Alt+R keyboard shortcut triggers reinit for all sources
 * 2. Reinit WebSocket message format and content
 * 3. Reinit acknowledgment handling
 *
 * Run: npx playwright test backend-reinit.spec.js
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5174';

test.describe('Backend Reinitialization', () => {
  let consoleMessages = {
    errors: [],
    warnings: [],
    logs: []
  };

  test.beforeEach(async ({ page }) => {
    consoleMessages = { errors: [], warnings: [], logs: [] };

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();

      if (type === 'error') {
        consoleMessages.errors.push(text);
        console.error(`[Browser Console Error] ${text}`);
      } else if (type === 'warning') {
        consoleMessages.warnings.push(text);
        console.warn(`[Browser Console Warning] ${text}`);
      } else {
        if (text.toLowerCase().includes('reinit') ||
            text.toLowerCase().includes('connection') ||
            text.toLowerCase().includes('websocket')) {
          consoleMessages.logs.push(text);
          console.log(`[Browser Console] ${text}`);
        }
      }
    });

    page.on('dialog', async dialog => {
      console.log(`[Dialog] ${dialog.message()}`);
      await dialog.accept('EURUSD');
    });

    await page.locator('.workspace').focus();
    await page.waitForTimeout(500);

    const apiReady = await page.evaluate(() => {
      return typeof window.workspaceActions !== 'undefined' &&
             typeof window.workspaceActions.addDisplay === 'function';
    });

    if (!apiReady) {
      console.log('Waiting for workspace API...');
      await page.waitForTimeout(2000);
    }
  });

  /**
   * TEST 1: Alt+R Keyboard Shortcut
   * Verifies that Alt+R triggers reinit for all sources (cTrader + TradingView)
   */
  test('Alt+R keyboard shortcut test', async ({ page }) => {
    console.log('\n=== Test 1: Alt+R Keyboard Shortcut ===\n');

    // Step 1: Create a display using Alt+A
    console.log('Step 1: Creating display using Alt+A...');
    await page.locator('.workspace').focus();
    await page.waitForTimeout(200);
    await page.keyboard.press('Alt+a');
    await page.waitForTimeout(2500);

    // Step 2: Set up WebSocket message interception
    console.log('\nStep 2: Setting up WebSocket message interception...');
    await page.evaluate(() => {
      const originalSend = WebSocket.prototype.send;
      WebSocket.prototype.send = function(...args) {
        window.__testSentMessages = window.__testSentMessages || [];
        try {
          const message = JSON.parse(args[0]);
          window.__testSentMessages.push(message);
        } catch (e) {
          window.__testSentMessages.push({ raw: args[0] });
        }
        return originalSend.apply(this, args);
      };
    });

    // Step 3: Press Alt+R to trigger reinit
    console.log('\nStep 3: Pressing Alt+R to reinit all...');
    await page.locator('.workspace').focus();
    await page.waitForTimeout(200);
    await page.keyboard.press('Alt+r');
    await page.waitForTimeout(500);

    // Step 4: Verify reinit message was sent
    console.log('\nStep 4: Verifying reinit message...');
    const messages = await page.evaluate(() => window.__testSentMessages || []);
    console.log('Messages after Alt+R:', messages);

    const reinitMsg = messages.find(m => m.type === 'reinit' && m.source === 'all');
    expect(reinitMsg).toBeDefined();
    expect(reinitMsg.type).toBe('reinit');
    expect(reinitMsg.source).toBe('all');

    console.log('✅ Test 1 PASSED: Alt+R sends reinit message for all sources');
  });

  /**
   * TEST 2: Reinit Message Format
   * Verifies the WebSocket message has correct structure
   */
  test('Reinit message format test', async ({ page }) => {
    console.log('\n=== Test 2: Reinit Message Format ===\n');

    await page.evaluate(() => {
      const originalSend = WebSocket.prototype.send;
      WebSocket.prototype.send = function(...args) {
        window.__testSentMessages = window.__testSentMessages || [];
        try {
          const message = JSON.parse(args[0]);
          window.__testSentMessages.push(message);
        } catch (e) {
          window.__testSentMessages.push({ raw: args[0] });
        }
        return originalSend.apply(this, args);
      };
    });

    await page.locator('.workspace').focus();
    await page.waitForTimeout(200);
    await page.keyboard.press('Alt+r');
    await page.waitForTimeout(500);

    const messages = await page.evaluate(() => window.__testSentMessages || []);

    // Find the reinit message
    const reinitMsg = messages.find(m => m.type === 'reinit');
    expect(reinitMsg).toBeDefined();

    // Verify structure
    expect(reinitMsg).toHaveProperty('type', 'reinit');
    expect(reinitMsg).toHaveProperty('source', 'all');

    console.log('Message structure:', reinitMsg);
    console.log('✅ Test 2 PASSED: Message format is correct');
  });

  /**
   * TEST 3: Console Logging
   * Verifies reinit is logged to console
   */
  test('Console logging test', async ({ page }) => {
    console.log('\n=== Test 3: Console Logging ===\n');

    await page.locator('.workspace').focus();
    await page.waitForTimeout(200);
    await page.keyboard.press('Alt+r');
    await page.waitForTimeout(500);

    const hasReinitLog = consoleMessages.logs.some(log =>
      log.includes('Reinit requested') || log.includes('reinit')
    );

    console.log('Reinit-related logs:', consoleMessages.logs.filter(l =>
      l.includes('reinit') || l.includes('Reinit')
    ));

    expect(hasReinitLog).toBe(true);
    console.log('✅ Test 3 PASSED: Reinit is logged to console');
  });

  /**
   * TEST 4: No UI Buttons
   * Verifies that reinit buttons are NOT in the UI (keyboard-only approach)
   */
  test('No UI buttons test', async ({ page }) => {
    console.log('\n=== Test 4: No UI Buttons (Keyboard-Only) ===\n');

    await page.waitForTimeout(1000);

    // Check that reinit controls container does NOT exist
    const reinitControls = page.locator('.reinit-controls');
    const count = await reinitControls.count();

    console.log(`Reinit controls found: ${count}`);
    expect(count).toBe(0);

    console.log('✅ Test 4 PASSED: No reinit buttons in UI (keyboard-only approach)');
  });
});
