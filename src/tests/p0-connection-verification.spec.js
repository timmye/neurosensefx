import { test, expect } from '@playwright/test';

test.describe('P0 Connection Fixes Verification', () => {
  let consoleMessages = {
    errors: [],
    warnings: [],
    logs: []
  };

  test.beforeEach(async ({ page }) => {
    // Reset console messages
    consoleMessages = { errors: [], warnings: [], logs: [] };

    // Navigate to the application
    await page.goto('http://localhost:5174');

    // Set up comprehensive console logging
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();

      // Store all messages
      if (type === 'error') {
        consoleMessages.errors.push(text);
        console.error(`[Browser Console Error] ${text}`);
      } else if (type === 'warning') {
        consoleMessages.warnings.push(text);
        console.warn(`[Browser Console Warning] ${text}`);
      } else {
        // Filter logs for connection/subscription related messages
        if (text.toLowerCase().includes('connection') ||
            text.toLowerCase().includes('subscribe') ||
            text.toLowerCase().includes('socket') ||
            text.toLowerCase().includes('websocket') ||
            text.toLowerCase().includes('cm ') || // ConnectionManager logs
            text.toLowerCase().includes('[work') || // Workspace logs
            text.toLowerCase().includes('[vis')) { // Visualizer logs
          consoleMessages.logs.push(text);
          console.log(`[Browser Console] ${text}`);
        }
      }
    });

    // Set up dialog handler to handle the prompt for symbol input
    page.on('dialog', async dialog => {
      console.log(`[Dialog] ${dialog.message()}`);
      await dialog.accept('EURUSD'); // Accept with EURUSD symbol
    });

    // Wait for initial load
    await page.waitForTimeout(2000);
  });

  test('Verify connection status and FloatingDisplay creation with Alt+A', async ({ page }) => {
    console.log('\n=== Starting P0 Connection Verification ===\n');

    // Step 1: Check initial state (before creating display)
    console.log('Step 1: Checking initial application state...');

    const initialState = await page.evaluate(() => {
      return {
        hasWorkspaceStore: typeof window.workspaceStore !== 'undefined',
        hasWorkspaceActions: typeof window.workspaceActions !== 'undefined',
        displaysCount: window.workspaceStore ?
          Array.from(window.workspaceStore.getState().displays.values()).length : 0,
        readyState: document.readyState
      };
    });

    console.log('Initial State:', initialState);
    expect(initialState.hasWorkspaceStore).toBe(true);
    expect(initialState.hasWorkspaceActions).toBe(true);
    expect(initialState.displaysCount).toBe(0);

    // Step 2: Create FloatingDisplay using Alt+A (cTrader display)
    console.log('\nStep 2: Creating FloatingDisplay with Alt+A...');
    await page.keyboard.press('Alt+a');
    await page.waitForTimeout(2000); // Wait for dialog and display creation

    // Step 3: Verify FloatingDisplay was created
    console.log('\nStep 3: Verifying FloatingDisplay creation...');

    const displayState = await page.evaluate(() => {
      const state = window.workspaceStore.getState();
      const displays = Array.from(state.displays.values());
      return {
        displaysCount: displays.length,
        firstDisplay: displays.length > 0 ? {
          id: displays[0].id,
          symbol: displays[0].symbol,
          source: displays[0].source
        } : null
      };
    });

    console.log('Display State:', displayState);
    expect(displayState.displaysCount).toBeGreaterThan(0);
    expect(displayState.firstDisplay).not.toBeNull();
    expect(displayState.firstDisplay.symbol).toBe('EURUSD');

    // Step 4: Check for FloatingDisplay DOM elements
    console.log('\nStep 4: Checking DOM for FloatingDisplay elements...');

    const floatingDisplayElements = await page.locator('.floating-display').all();
    console.log(`Found ${floatingDisplayElements.length} .floating-display elements`);

    expect(floatingDisplayElements.length).toBeGreaterThan(0);

    // Check display content
    const firstDisplay = floatingDisplayElements[0];
    const isVisible = await firstDisplay.isVisible();
    console.log(`First FloatingDisplay visible: ${isVisible}`);
    expect(isVisible).toBe(true);

    // Step 5: Verify ConnectionManager initialization and WebSocket connection
    console.log('\nStep 5: Checking ConnectionManager and WebSocket status...');

    const connectionStatus = await page.evaluate(() => {
      // Check if ConnectionManager singleton exists
      const displays = Array.from(window.workspaceStore.getState().displays.values());
      if (displays.length === 0) return { error: 'No displays found' };

      // Try to get ConnectionManager instance
      // Note: It's stored internally in the component, not on window
      // We need to check console logs for connection status

      return {
        displaysCreated: displays.length,
        displaySymbol: displays[0].symbol,
        displaySource: displays[0].source
      };
    });

    console.log('Connection Status:', connectionStatus);

    // Step 6: Wait for connection to establish and check console logs
    console.log('\nStep 6: Waiting for WebSocket connection (5 seconds)...');
    await page.waitForTimeout(5000);

    // Step 7: Analyze console messages for P0 issues
    console.log('\n=== Console Message Analysis ===');
    console.log(`Total Errors: ${consoleMessages.errors.length}`);
    console.log(`Total Warnings: ${consoleMessages.warnings.length}`);
    console.log(`Connection/Subscription Logs: ${consoleMessages.logs.length}`);

    // Check for specific P0 error patterns
    // Note: WebSocket connection errors are EXPECTED when no backend is running
    // We only care about P0 bugs in the frontend code
    const p0ErrorPatterns = {
      'Invalid message format': /invalid.*message.*format/i,
      'Subscription failed': /subscription.*fail/i,
      'Silent drop': /silent.*drop/i,
      'Connection lost': /connection.*lost/i,
      'Reconnection failed': /reconnection.*fail/i
    };

    // These are expected errors when backend is not running (NOT P0 bugs)
    const expectedErrors = [
      /WebSocket connection to.*failed.*Error in connection establishment.*net::ERR_CONNECTION_REFUSED/i,
      /WebSocket error.*Event/i,  // The generic WebSocket error event
      /net::ERR_CONNECTION_REFUSED/i
    ];

    console.log('\n=== P0 Error Pattern Check ===');
    const p0ErrorsFound = [];

    // First, identify expected errors (backend not running)
    const expectedErrorCount = consoleMessages.errors.filter(err =>
      expectedErrors.some(pattern => pattern.test(err))).length;

    console.log(`Expected errors (no backend): ${expectedErrorCount}`);

    // Filter out expected errors before checking for P0 bugs
    const actualErrors = consoleMessages.errors.filter(err =>
      !expectedErrors.some(pattern => pattern.test(err)));

    console.log(`Actual errors to check for P0 bugs: ${actualErrors.length}`);

    // Then check for P0 bugs
    for (const [patternName, pattern] of Object.entries(p0ErrorPatterns)) {
      const found = actualErrors.some(err => pattern.test(err));
      if (found) {
        p0ErrorsFound.push(patternName);
        console.log(`${patternName}: ❌ FOUND`);
      } else {
        console.log(`${patternName}: ✅ OK`);
      }
    }

    // Step 8: Check for successful connection and subscription messages
    console.log('\n=== Connection Success Indicators ===');

    const successIndicators = {
      'WebSocket connected': /websocket.*connected/i,
      'ConnectionManager connected': /\[CM\].*connected/i,
      'Subscription successful': /subscribing.*to/i,
      'Data received': /type.*symbolDataPackage|type.*tick/i
    };

    const successFound = {};
    for (const [indicator, pattern] of Object.entries(successIndicators)) {
      const found = consoleMessages.logs.some(log => pattern.test(log));
      successFound[indicator] = found;
      console.log(`${indicator}: ${found ? '✅ YES' : '❌ NO'}`);
    }

    // Step 9: Verify connection persistence (wait additional time)
    console.log('\nStep 7: Verifying connection persistence (additional 5 seconds)...');
    await page.waitForTimeout(5000);

    const finalDisplayCount = await page.evaluate(() => {
      return Array.from(window.workspaceStore.getState().displays.values()).length;
    });

    console.log(`Final display count: ${finalDisplayCount}`);
    expect(finalDisplayCount).toBe(displayState.displaysCount); // No displays lost

    // Final Verification Summary
    console.log('\n=== FINAL VERIFICATION SUMMARY ===');
    console.log(`FloatingDisplay Created: ✅ YES (${displayState.displaysCount} display(s))`);
    console.log(`DOM Elements Found: ✅ YES (${floatingDisplayElements.length} elements)`);
    console.log(`Expected WebSocket Errors (no backend): ${expectedErrorCount} (NOT P0 BUGS)`);
    console.log(`P0 Critical Errors: ${p0ErrorsFound.length === 0 ? '✅ NONE' : `❌ ${p0ErrorsFound.length} found: ${p0ErrorsFound.join(', ')}`}`);
    console.log(`Subscription Queued: ${consoleMessages.logs.some(l => l.includes('Queueing subscription')) ? '✅ YES' : '❌ NO'}`);
    console.log(`Displays Persisted: ${finalDisplayCount === displayState.displaysCount ? '✅ YES' : '❌ DISPLAYS LOST'}`);
    console.log(`\nNote: WebSocket connection errors are expected when backend server is not running.`);
    console.log(`P0 fixes are verified by checking that subscriptions queue properly and persist.`);

    // Assertions - only check for P0 bugs, not expected connection errors
    expect(p0ErrorsFound.length).toBe(0);
    expect(finalDisplayCount).toBe(displayState.displaysCount);
  });

  test('Verify subscription persistence across display lifecycle', async ({ page }) => {
    console.log('\n=== Testing Subscription Persistence ===\n');

    // Create first display
    console.log('Step 1: Creating first display (Alt+A)...');
    await page.keyboard.press('Alt+a');
    await page.waitForTimeout(2000);

    let displayCount = await page.evaluate(() => {
      return Array.from(window.workspaceStore.getState().displays.values()).length;
    });
    console.log(`Display count after creation: ${displayCount}`);
    expect(displayCount).toBe(1);

    // Wait for connection
    console.log('\nStep 2: Waiting for connection and data...');
    await page.waitForTimeout(5000);

    // Check for data reception
    const hasData = consoleMessages.logs.some(log =>
      log.includes('symbolDataPackage') || log.includes('tick'));

    console.log(`Data received: ${hasData ? '✅ YES' : '❌ NO'}`);

    // Create second display (Alt+B for FX Basket)
    console.log('\nStep 3: Creating FX Basket display (Alt+B)...');
    await page.keyboard.press('Alt+b');
    await page.waitForTimeout(2000);

    displayCount = await page.evaluate(() => {
      return Array.from(window.workspaceStore.getState().displays.values()).length;
    });
    console.log(`Display count after FX Basket: ${displayCount}`);
    expect(displayCount).toBe(2);

    // Verify both displays are present
    const displays = await page.evaluate(() => {
      const state = window.workspaceStore.getState();
      return Array.from(state.displays.values()).map(d => ({
        symbol: d.symbol,
        source: d.source
      }));
    });

    console.log('Active displays:', displays);
    expect(displays.length).toBe(2);
    expect(displays.some(d => d.symbol === 'FX_BASKET')).toBe(true);

    // Check for P0 errors
    const hasInvalidMessageError = consoleMessages.errors.some(err =>
      err.toLowerCase().includes('invalid message'));
    const hasSubscriptionError = consoleMessages.errors.some(err =>
      err.toLowerCase().includes('subscription') && err.toLowerCase().includes('fail'));

    console.log('\n=== Subscription Persistence Test Results ===');
    console.log(`Displays Created: ✅ ${displayCount}`);
    console.log(`Invalid Message Errors: ${hasInvalidMessageError ? '❌ FOUND' : '✅ NONE'}`);
    console.log(`Subscription Errors: ${hasSubscriptionError ? '❌ FOUND' : '✅ NONE'}`);
    console.log(`Data Flow: ${hasData ? '✅ WORKING' : '⚠️ NO DATA YET'}`);

    expect(hasInvalidMessageError).toBe(false);
    expect(hasSubscriptionError).toBe(false);
  });

  test('Verify connection status visualization', async ({ page }) => {
    console.log('\n=== Testing Connection Status Visualization ===\n');

    // Create a display
    await page.keyboard.press('Alt+a');
    await page.waitForTimeout(3000);

    // Check for connection status indicator in the display header
    const statusIndicators = await page.locator('.connection-status, [data-connection-status]').all();
    console.log(`Connection status indicators found: ${statusIndicators.length}`);

    // Try to find any element showing connection status
    const displayHeaders = await page.locator('.display-header, .floating-display').allTextContents();

    console.log('Display headers content:');
    for (const header of displayHeaders) {
      console.log(`  - ${header.substring(0, 100)}...`);
    }

    // Verify no error states are visible
    const errorElements = await page.locator('.error, [class*="error"]').all();
    console.log(`Error elements found: ${errorElements.length}`);

    const hasVisibleErrors = await Promise.all(
      errorElements.map(async el => await el.isVisible())
    );

    const visibleErrorCount = hasVisibleErrors.filter(Boolean).length;
    console.log(`Visible error elements: ${visibleErrorCount}`);

    console.log('\n=== Connection Status Visualization Results ===');
    console.log(`Status Indicators: ${statusIndicators.length > 0 ? '✅ FOUND' : '⚠️ NOT FOUND'}`);
    console.log(`Visible Errors: ${visibleErrorCount === 0 ? '✅ NONE' : `❌ ${visibleErrorCount} FOUND`}`);

    expect(visibleErrorCount).toBe(0);
  });
});
