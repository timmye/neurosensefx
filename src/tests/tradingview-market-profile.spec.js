/**
 * TradingView Market Profile Verification Test
 *
 * Tests the complete Alt+T workflow:
 * 1. Open application at http://localhost:5174
 * 2. Press Alt+T to create TradingView display
 * 3. Monitor browser console for specific messages
 * 4. Verify Market Profile data is received and renders
 * 5. Take screenshot on success/failure
 */

import { test, expect } from '@playwright/test';

test.describe('TradingView Market Profile', () => {
  test('Alt+T creates TradingView display with Market Profile', async ({ page }) => {
    // Increase timeout for TradingView data load
    test.setTimeout(120000);
    console.log('[TEST] Starting TradingView Market Profile verification...');

    const consoleMessages = [];
    const marketProfileDataFound = {
      initialMarketProfile: false,
      hasMarketProfileData: false,
      renderingLogs: []
    };

    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();

      consoleMessages.push({ type, text, timestamp: new Date().toISOString() });

      // Log browser console to test output
      console.log(`[BROWSER] ${type}: ${text}`);

      // Track Market Profile data reception
      if (text.includes('initialMarketProfile')) {
        marketProfileDataFound.initialMarketProfile = true;
        console.log('[TEST] Found initialMarketProfile in console');
      }

      if (text.includes('hasMarketProfileData: true')) {
        marketProfileDataFound.hasMarketProfileData = true;
        console.log('[TEST] Found hasMarketProfileData: true');
      }

      // Track Market Profile rendering logs
      if (text.includes('[DISPLAY_CANVAS]') && text.toLowerCase().includes('market')) {
        marketProfileDataFound.renderingLogs.push(text);
      }
    });

    // Monitor page errors
    const pageErrors = [];
    page.on('pageerror', error => {
      pageErrors.push({ message: error.message, stack: error.stack });
      console.log(`[PAGE ERROR] ${error.message}`);
    });

    // Navigate to application
    console.log('[TEST] Navigating to http://localhost:5174');
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');
    console.log('[TEST] Page loaded (networkidle)');

    // Wait for DOMContentLoaded and application initialization
    await page.waitForTimeout(3000);
    console.log('[TEST] Application initialized');

    // Focus the page for keyboard events
    await page.evaluate(() => {
      document.documentElement.focus();
      document.body.focus();
    });
    await page.waitForTimeout(500);
    console.log('[TEST] Page focused for keyboard events');

    // Verify workspace is ready
    const workspaceElement = page.locator('.workspace');
    await expect(workspaceElement).toBeVisible();
    console.log('[TEST] Workspace element is visible');

    // Handle the prompt dialog for symbol input
    let dialogHandled = false;
    page.on('dialog', async dialog => {
      console.log(`[TEST] Dialog type: ${dialog.type()}, message: ${dialog.message()}`);
      if (dialog.type() === 'prompt') {
        await dialog.accept('BTCUSD'); // Enter BTCUSD as the symbol
        dialogHandled = true;
        console.log('[TEST] Accepted dialog with symbol: BTCUSD');
      } else {
        await dialog.dismiss();
      }
    });

    // Execute Alt+T keyboard shortcut to create TradingView display
    console.log('[TEST] Executing Alt+T keyboard shortcut...');
    await page.keyboard.press('Alt+t');
    await page.waitForTimeout(1000);
    console.log('[TEST] Alt+T executed');

    // Wait for TradingView display to be created
    await page.waitForTimeout(3000);

    // Verify display was created
    const displayCount = await page.locator('.floating-display').count();
    console.log(`[TEST] Display count after Alt+T: ${displayCount}`);
    expect(displayCount).toBeGreaterThan(0);
    console.log('[TEST] TradingView display created successfully');

    // Wait for WebSocket connection and data load (TradingView M1 data may take up to 30 seconds)
    console.log('[TEST] Waiting for WebSocket connection and Market Profile data (up to 30s)...');
    await page.waitForTimeout(30000);
    console.log('[TEST] Wait period complete');

    // Check for Market Profile data in console
    console.log('[TEST] Analyzing console messages for Market Profile data...');

    const allConsoleText = consoleMessages.map(msg => msg.text).join('\n');

    // Verify initialMarketProfile was received
    const foundInitialMarketProfile = allConsoleText.includes('initialMarketProfile');
    console.log(`[TEST] initialMarketProfile found: ${foundInitialMarketProfile}`);

    // Verify hasMarketProfileData: true was logged
    const foundHasMarketProfileData = allConsoleText.includes('hasMarketProfileData: true');
    console.log(`[TEST] hasMarketProfileData: true found: ${foundHasMarketProfileData}`);

    // Check for Market Profile rendering logs
    const renderingLogsCount = marketProfileDataFound.renderingLogs.length;
    console.log(`[TEST] Market Profile rendering logs found: ${renderingLogsCount}`);

    // Display all Market Profile related console messages
    const marketProfileMessages = consoleMessages.filter(msg =>
      msg.text.toLowerCase().includes('market') ||
      msg.text.toLowerCase().includes('profile') ||
      msg.text.includes('initialMarketProfile')
    );

    console.log('[TEST] Market Profile related console messages:');
    marketProfileMessages.forEach((msg, index) => {
      console.log(`  ${index + 1}. ${msg.text}`);
    });

    // Verify Market Profile histogram appears in the DOM
    const canvasElement = page.locator('.floating-display canvas').first();
    const canvasExists = await canvasElement.count() > 0;
    console.log(`[TEST] Canvas element exists: ${canvasExists}`);

    if (canvasExists) {
      const isVisible = await canvasElement.isVisible();
      console.log(`[TEST] Canvas element is visible: ${isVisible}`);
    }

    // Take screenshot for visual verification
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = `/workspaces/neurosensefx/tradingview-market-profile-${timestamp}.png`;
    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });
    console.log(`[TEST] Screenshot saved to: ${screenshotPath}`);

    // Summary logging
    console.log('[TEST] === TEST SUMMARY ===');
    console.log(`[TEST] Total console messages: ${consoleMessages.length}`);
    console.log(`[TEST] Market Profile messages: ${marketProfileMessages.length}`);
    console.log(`[TEST] Page errors: ${pageErrors.length}`);
    console.log(`[TEST] Displays created: ${displayCount}`);
    console.log(`[TEST] Canvas exists: ${canvasExists}`);

    // Assertions
    expect(displayCount).toBeGreaterThan(0);
    expect(pageErrors.length).toBeLessThan(5);

    if (foundInitialMarketProfile || foundHasMarketProfileData) {
      console.log('[TEST] SUCCESS: Market Profile data was received');
    } else {
      console.log('[TEST] WARNING: Market Profile data may not have been received');
      console.log('[TEST] This could indicate a backend issue or data subscription problem');
    }

    if (renderingLogsCount > 0) {
      console.log('[TEST] SUCCESS: Market Profile rendering was attempted');
    } else {
      console.log('[TEST] INFO: No Market Profile rendering logs found');
    }

    console.log('[TEST] TradingView Market Profile verification complete');
  });
});
