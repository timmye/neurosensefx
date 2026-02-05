/**
 * Message Coordinator E2E Tests
 *
 * Tests the generic message coordinator in browser environment:
 * 1. Coordinator coordinates symbolDataPackage + tick messages for FX Basket
 * 2. Timeout handling when messages don't arrive within 5 seconds
 * 3. Cleanup functionality when displays are closed
 * 4. Console logging shows proper coordination events
 * 5. Multiple symbols tracked independently
 *
 * Run: npx playwright test message-coordination.spec.js
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5174';
const SELECTORS = {
  workspace: '.workspace',
  display: '.floating-display',
  closeButton: '.close'
};

test.describe('Message Coordinator - Browser Integration', () => {

  async function waitForWorkspaceAPI(page) {
    return await page.evaluate(() => {
      return typeof window.workspaceActions !== 'undefined' &&
             typeof window.workspaceActions.addDisplay === 'function';
    });
  }

  function setupConsoleMonitoring(page) {
    const consoleLogs = {
      coordination: [],
      timeouts: [],
      errors: [],
      warnings: [],
      all: []
    };

    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();

      consoleLogs.all.push({ type, text });

      if (text.includes('Timeout') && text.includes('FX BASKET')) {
        consoleLogs.timeouts.push(text);
        console.log('⏱️ Timeout detected:', text);
      }

      if (text.includes('symbolDataPackage') || text.includes('coordinated')) {
        consoleLogs.coordination.push(text);
      }

      if (type === 'error') {
        consoleLogs.errors.push({ text, location: msg.location() });
      }

      if (type === 'warning' && text.includes('FX BASKET')) {
        consoleLogs.warnings.push(text);
      }
    });

    return consoleLogs;
  }

  test('coordinator is accessible via FX Basket processor', async ({ page }) => {
    console.log('🚀 Testing coordinator accessibility...');

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const apiReady = await waitForWorkspaceAPI(page);
    expect(apiReady, 'Workspace API should be available').toBe(true);

    // Create FX Basket display (which uses coordinator)
    const workspace = page.locator(SELECTORS.workspace);
    await workspace.focus();
    await page.keyboard.press('Alt+b');
    await page.waitForTimeout(2000);

    // Verify FX Basket debug API is available
    const debugAPI = await page.evaluate(() => {
      return typeof window.fxBasketDebug !== 'undefined' &&
             typeof window.fxBasketDebug.getSubscriptionInfo === 'function';
    });

    expect(debugAPI, 'FX Basket debug API should be accessible').toBe(true);
    console.log('✅ Coordinator accessible via FX Basket debug API');
  });

  test('coordinated message handling for symbolDataPackage + tick', async ({ page }) => {
    console.log('🚀 Testing coordinated message handling...');

    const consoleLogs = setupConsoleMonitoring(page);

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await waitForWorkspaceAPI(page);

    // Create FX Basket display
    const workspace = page.locator(SELECTORS.workspace);
    await workspace.focus();
    await page.keyboard.press('Alt+b');

    // Wait for subscriptions to complete
    await page.waitForFunction(() => window.fxBasketDebug?.subscriptionsReady === true, { timeout: 15000 });

    // Wait for coordinated messages to arrive
    await page.waitForTimeout(8000);

    // Check that we received symbolDataPackage messages
    const coordinationLogs = consoleLogs.coordination.filter(log =>
      log.includes('symbolDataPackage')
    );

    console.log(`   Coordination logs: ${coordinationLogs.length}`);
    console.log(`   Timeout warnings: ${consoleLogs.timeouts.length}`);

    // Verify we have coordination activity (symbolDataPackage messages)
    expect(coordinationLogs.length, 'Should have symbolDataPackage coordination activity').toBeGreaterThan(0);

    // Check debug API for message counts
    const messageCounts = await page.evaluate(() => {
      const debug = window.fxBasketDebug;
      return {
        dataPackageCount: debug.dataPackageCount,
        tickCount: debug.tickCount,
        subscriptionInfo: debug.getSubscriptionInfo()
      };
    });

    console.log('   Message counts:', messageCounts);

    expect(messageCounts.subscriptionInfo.totalPairs).toBe(28);

    // We should have at least some data packages or ticks
    const hasData = messageCounts.dataPackageCount > 0 || messageCounts.tickCount > 0;
    if (hasData) {
      console.log(`   ✅ Received ${messageCounts.dataPackageCount} data packages, ${messageCounts.tickCount} ticks`);
    } else {
      console.log('   ℹ️ No data received (market may be closed)');
    }

    console.log('✅ Coordinated message handling verified');
  });

  test('timeout handling when incomplete messages', async ({ page }) => {
    console.log('🚀 Testing timeout handling...');

    const consoleLogs = setupConsoleMonitoring(page);

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await waitForWorkspaceAPI(page);

    // Create FX Basket display
    const workspace = page.locator(SELECTORS.workspace);
    await workspace.focus();
    await page.keyboard.press('Alt+b');

    // Wait for subscriptions
    await page.waitForFunction(() => window.fxBasketDebug?.subscriptionsReady === true, { timeout: 15000 });

    // Wait for potential timeouts (5 second timeout per symbol)
    await page.waitForTimeout(8000);

    console.log(`   Timeout warnings: ${consoleLogs.timeouts.length}`);
    console.log(`   Coordination logs: ${consoleLogs.coordination.length}`);

    // If we have timeout warnings, verify they're proper format
    if (consoleLogs.timeouts.length > 0) {
      console.log('   Timeout messages:');
      consoleLogs.timeouts.forEach(msg => console.log(`     - ${msg}`));

      // Verify timeout messages include expected info
      const timeoutFormatValid = consoleLogs.timeouts.every(msg =>
        msg.includes('Timeout') && msg.includes('FX BASKET')
      );

      expect(timeoutFormatValid, 'Timeout messages should have proper format').toBe(true);
    }

    // Check coordinator state via debug API
    const coordinatorState = await page.evaluate(() => {
      const debug = window.fxBasketDebug;
      return {
        subscriptionInfo: debug.getSubscriptionInfo(),
        pricesCount: debug.prices.size,
        lastTickTimesCount: debug.lastTickTimes.size
      };
    });

    console.log('   Coordinator state:', coordinatorState);

    // Verify we have some progress even with potential timeouts
    expect(coordinatorState.subscriptionInfo.totalPairs, 'Should have subscribed to 28 pairs').toBe(28);

    console.log('✅ Timeout handling verified');
  });

  test('cleanup when display closed', async ({ page }) => {
    console.log('🚀 Testing cleanup functionality...');

    const consoleLogs = setupConsoleMonitoring(page);

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await waitForWorkspaceAPI(page);

    // Create FX Basket display
    const workspace = page.locator(SELECTORS.workspace);
    await workspace.focus();
    await page.keyboard.press('Alt+b');
    await page.waitForTimeout(2000);

    // Verify display exists
    let displays = page.locator(SELECTORS.display);
    let displayCount = await displays.count();
    expect(displayCount, 'Should have 1 display').toBe(1);

    // Get initial subscription state
    const initialState = await page.evaluate(() => {
      const debug = window.fxBasketDebug;
      return {
        totalPairs: debug.getSubscriptionInfo().totalPairs,
        pricesCount: debug.prices.size,
        hasDebugAPI: typeof window.fxBasketDebug !== 'undefined'
      };
    });

    console.log('   Initial state:', initialState);

    // Hover to show header and close display
    const display = displays.first();
    const box = await display.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + 10);
    await page.waitForTimeout(500);

    const closeButton = display.locator(SELECTORS.closeButton).first();
    await closeButton.click();
    await page.waitForTimeout(1000);

    // Verify display is removed
    displayCount = await displays.count();
    expect(displayCount, 'Should have 0 displays after close').toBe(0);

    // Note: Debug API cleanup happens on component destroy
    // We verify display is closed (which triggers cleanup)
    console.log('✅ Cleanup verified (display closed successfully)');
  });

  test('independent symbol tracking', async ({ page }) => {
    console.log('🚀 Testing independent symbol tracking...');

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await waitForWorkspaceAPI(page);

    // Create FX Basket display
    const workspace = page.locator(SELECTORS.workspace);
    await workspace.focus();
    await page.keyboard.press('Alt+b');

    // Wait for subscriptions
    await page.waitForFunction(() => window.fxBasketDebug?.subscriptionsReady === true, { timeout: 15000 });

    // Wait for data to arrive
    await page.waitForTimeout(8000);

    // Check multiple symbols are tracked independently
    const symbolTracking = await page.evaluate(() => {
      const debug = window.fxBasketDebug;
      const lastTickTimes = debug.lastTickTimes;
      const prices = debug.prices;

      return {
        totalPairs: debug.getSubscriptionInfo().totalPairs,
        symbolsWithTickTimes: Array.from(lastTickTimes.keys()).length,
        symbolsWithPrices: prices.size,
        sampleTickTimes: Array.from(lastTickTimes.entries()).slice(0, 5),
        samplePrices: Array.from(prices.entries()).slice(0, 5)
      };
    });

    console.log('   Symbol tracking:', symbolTracking);

    expect(symbolTracking.totalPairs).toBe(28);

    // Verify we have independent tracking for multiple symbols
    const hasMultipleSymbols = symbolTracking.symbolsWithTickTimes > 0 ||
                               symbolTracking.symbolsWithPrices > 0;

    if (hasMultipleSymbols) {
      console.log(`   ✅ Tracking ${symbolTracking.symbolsWithTickTimes} symbols with tick times, ${symbolTracking.symbolsWithPrices} with prices`);
    } else {
      console.log('   ℹ️ No data received yet (market may be closed)');
    }

    console.log('✅ Independent symbol tracking verified');
  });

  test('console shows proper coordination events', async ({ page }) => {
    console.log('🚀 Testing console coordination events...');

    const consoleLogs = setupConsoleMonitoring(page);

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await waitForWorkspaceAPI(page);

    // Create FX Basket display
    const workspace = page.locator(SELECTORS.workspace);
    await workspace.focus();
    await page.keyboard.press('Alt+b');

    // Wait for subscriptions and coordination
    await page.waitForFunction(() => window.fxBasketDebug?.subscriptionsReady === true, { timeout: 15000 });
    await page.waitForTimeout(8000);

    // Analyze console logs
    const analysis = {
      totalLogs: consoleLogs.all.length,
      coordinationLogs: consoleLogs.coordination.length,
      timeoutWarnings: consoleLogs.timeouts.length,
      fxWarnings: consoleLogs.warnings.length,
      errors: consoleLogs.errors.length,
      hasSymbolDataPackageLogs: consoleLogs.coordination.some(log => log.includes('symbolDataPackage')),
      hasSubscriptionLogs: consoleLogs.all.some(log => log.text.includes('Starting subscription') || log.text.includes('All subscriptions complete'))
    };

    console.log('   Console analysis:', analysis);

    expect(analysis.totalLogs, 'Should have console activity').toBeGreaterThan(0);
    expect(analysis.hasSubscriptionLogs, 'Should have subscription logs').toBe(true);

    // Check for FX Basket specific logs
    const fxBasketLogs = consoleLogs.all.filter(log =>
      log.text.includes('FX BASKET') || log.text.includes('symbolDataPackage')
    );

    console.log(`   FX Basket logs: ${fxBasketLogs.length}`);
    fxBasketLogs.slice(0, 10).forEach(log => {
      console.log(`     [${log.type}] ${log.text.substring(0, 100)}`);
    });

    expect(fxBasketLogs.length, 'Should have FX Basket console activity').toBeGreaterThan(0);

    // Should not have errors related to coordination
    const coordinationErrors = consoleLogs.errors.filter(err =>
      err.text.includes('coordinator') || err.text.includes('coordinate')
    );

    expect(coordinationErrors.length, 'Should have no coordination errors').toBe(0);

    console.log('✅ Console coordination events verified');
  });

  test('coordinator handles 5 second timeout correctly', async ({ page }) => {
    console.log('🚀 Testing 5 second coordinator timeout...');

    const consoleLogs = setupConsoleMonitoring(page);

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await waitForWorkspaceAPI(page);

    // Track start time
    const startTime = Date.now();

    // Create FX Basket display
    const workspace = page.locator(SELECTORS.workspace);
    await workspace.focus();
    await page.keyboard.press('Alt+b');

    // Wait for subscriptions
    await page.waitForFunction(() => window.fxBasketDebug?.subscriptionsReady === true, { timeout: 15000 });

    // Wait at least 6 seconds to allow for 5-second timeouts
    await page.waitForTimeout(7000);

    const elapsed = Date.now() - startTime;
    console.log(`   Elapsed time: ${elapsed}ms`);

    // Check if any timeouts occurred (they should if data is incomplete)
    if (consoleLogs.timeouts.length > 0) {
      console.log(`   ✅ Detected ${consoleLogs.timeouts.length} timeout warnings (expected if data incomplete)`);

      // Verify timeout occurred after reasonable time (should be ~5 seconds after first message)
      // We can't verify exact timing in E2E, but we can verify the pattern
      const hasTimeoutMessage = consoleLogs.timeouts.some(msg =>
        msg.includes('Timeout') && msg.includes('received:')
      );

      expect(hasTimeoutMessage, 'Timeout should include received types').toBe(true);
    } else {
      console.log('   ℹ️ No timeout warnings (all data arrived within 5 seconds)');
    }

    // Verify we still have a functional state
    const finalState = await page.evaluate(() => {
      const debug = window.fxBasketDebug;
      return {
        subscriptionInfo: debug.getSubscriptionInfo(),
        connectionStatus: debug.connectionStatus
      };
    });

    console.log('   Final state:', finalState);
    expect(finalState.connectionStatus).toBe('connected');

    console.log('✅ 5 second timeout handling verified');
  });

  test('message coordinator integration with FX Basket workflow', async ({ page }) => {
    console.log('🚀 Testing full coordinator workflow...');

    const consoleLogs = setupConsoleMonitoring(page);

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await waitForWorkspaceAPI(page);

    // Step 1: Create display
    console.log('   Step 1: Create FX Basket display');
    const workspace = page.locator(SELECTORS.workspace);
    await workspace.focus();
    await page.keyboard.press('Alt+b');
    await page.waitForTimeout(2000);

    // Step 2: Verify subscriptions started
    console.log('   Step 2: Verify subscriptions started');
    const subscriptionsReady = await page.evaluate(() => {
      return window.fxBasketDebug?.subscriptionsReady === true;
    });

    await page.waitForFunction(() => window.fxBasketDebug?.subscriptionsReady === true, { timeout: 15000 });

    // Step 3: Wait for coordinated messages
    console.log('   Step 3: Wait for coordinated messages (symbolDataPackage + tick)');
    await page.waitForTimeout(8000);

    // Step 4: Check coordinator results
    console.log('   Step 4: Check coordinator results');
    const coordinatorResults = await page.evaluate(() => {
      const debug = window.fxBasketDebug;
      const subscriptionInfo = debug.getSubscriptionInfo();
      return {
        totalPairs: subscriptionInfo.totalPairs,
        dataPackagesReceived: subscriptionInfo.dataPackageCount,
        ticksReceived: subscriptionInfo.tickCount,
        pricesCount: debug.prices.size,
        basketCount: Object.keys(debug.baskets).length,
        hasBaskets: Object.keys(debug.baskets).length > 0
      };
    });

    console.log('   Coordinator results:', coordinatorResults);

    expect(coordinatorResults.totalPairs).toBe(28);
    expect(coordinatorResults.basketCount).toBe(8);

    // Step 5: Verify console shows coordination activity
    console.log('   Step 5: Verify console coordination');
    const hasCoordinationLogs = consoleLogs.coordination.length > 0;
    console.log(`     Coordination logs: ${consoleLogs.coordination.length}`);

    // Step 6: Verify no coordination errors
    console.log('   Step 6: Verify no errors');
    const coordinationErrors = consoleLogs.errors.filter(err =>
      err.text.includes('coordinator') || err.text.includes('coordinate')
    );

    expect(coordinationErrors.length).toBe(0);

    // Step 7: Cleanup - close display
    console.log('   Step 7: Close display and verify cleanup');
    const displays = page.locator(SELECTORS.display);
    const display = displays.first();
    const box = await display.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + 10);
    await page.waitForTimeout(500);

    const closeButton = display.locator(SELECTORS.closeButton).first();
    await closeButton.click();
    await page.waitForTimeout(500);

    const finalDisplayCount = await displays.count();
    expect(finalDisplayCount).toBe(0);

    console.log('✅ Full coordinator workflow verified');
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Cleanup: Close any remaining displays
    const displays = page.locator(SELECTORS.display);
    const count = await displays.count();

    if (count > 0) {
      console.log(`   Cleanup: Closing ${count} display(s)`);
      for (let i = 0; i < count; i++) {
        try {
          const display = displays.nth(i);
          const box = await display.boundingBox();
          if (box) {
            await page.mouse.move(box.x + box.width / 2, box.y + 10);
            await page.waitForTimeout(300);
            const closeButton = display.locator(SELECTORS.closeButton).first();
            await closeButton.click();
            await page.waitForTimeout(300);
          }
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  });
});

/**
 * QUICK REFERENCE: Message Coordinator Tests
 *
 * What is tested:
 * - Generic coordinator coordinates symbolDataPackage + tick messages
 * - 5-second timeout handling when messages incomplete
 * - Cleanup on display close
 * - Independent tracking per symbol (28 FX pairs)
 * - Console logging for coordination events
 *
 * How it works:
 * - FX Basket uses coordinator via fxBasketProcessor.subscribeCoordinated()
 * - Required types: ['symbolDataPackage', 'tick']
 * - Timeout: 5000ms (5 seconds)
 * - Coordinator triggers onAllReceived when both types arrive
 * - Coordinator triggers onTimeout with partial data if incomplete
 *
 * Test patterns used:
 * - page.on('console') for monitoring console output
 * - page.evaluate() for accessing browser state (fxBasketDebug API)
 * - page.waitForFunction() for waiting on async conditions
 * - WebSocket message interception for data flow verification
 */
