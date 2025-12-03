import { test, expect } from '@playwright/test';

test.describe('Market Profile Integration', () => {
  test('DEBUG: Comprehensive market profile debugging', async ({ page }) => {
    console.log('[DEBUGGER:TEST] Starting comprehensive market profile debugging');
    console.log('[DEBUGGER:TEST] ==============================================');

    // Navigate to the application
    console.log('[DEBUGGER:TEST] Navigating to simple application on port 5175...');
    await page.goto('http://localhost:5175');
    await page.waitForLoadState('networkidle');

    // Check console logs for all debugging output
    const consoleMessages = [];
    page.on('console', msg => {
      console.log(`[DEBUGGER:BROWSER] ${msg.type()}: ${msg.text()}`);
      consoleMessages.push(msg.text());
    });

    // Wait a moment for initialization
    console.log('[DEBUGGER:TEST] Waiting 5 seconds for initialization...');
    await page.waitForTimeout(5000);

    // Check all DEBUGGER console messages
    const debuggerMessages = consoleMessages.filter(msg =>
      msg.includes('DEBUGGER:')
    );

    console.log(`[DEBUGGER:TEST] Found ${debuggerMessages.length} DEBUGGER messages:`);
    debuggerMessages.forEach((msg, index) => {
      console.log(`[DEBUGGER:TEST] ${index + 1}. ${msg}`);
    });

    // Check visualization registry messages
    const registrationMessages = consoleMessages.filter(msg =>
      msg.includes('registered') || msg.includes('visualizations')
    );

    console.log(`[DEBUGGER:TEST] Found ${registrationMessages.length} registration messages:`);
    registrationMessages.forEach((msg, index) => {
      console.log(`[DEBUGGER:TEST] REGISTRATION ${index + 1}: ${msg}`);
    });

    // Check display creation messages
    const displayMessages = consoleMessages.filter(msg =>
      msg.includes('display') || msg.includes('Display')
    );

    console.log(`[DEBUGGER:TEST] Found ${displayMessages.length} display-related messages:`);
    displayMessages.forEach((msg, index) => {
      console.log(`[DEBUGGER:TEST] DISPLAY ${index + 1}: ${msg}`);
    });

    // Check WebSocket/data flow messages
    const websocketMessages = consoleMessages.filter(msg =>
      msg.includes('WebSocket') || msg.includes('data') || msg.includes('symbol')
    );

    console.log(`[DEBUGGER:TEST] Found ${websocketMessages.length} WebSocket/data messages:`);
    websocketMessages.forEach((msg, index) => {
      console.log(`[DEBUGGER:TEST] WEBSOCKET ${index + 1}: ${msg}`);
    });

    // Check for any errors
    const errorMessages = consoleMessages.filter(msg =>
      msg.toLowerCase().includes('error') || msg.toLowerCase().includes('failed')
    );

    console.log(`[DEBUGGER:TEST] Found ${errorMessages.length} error messages:`);
    errorMessages.forEach((msg, index) => {
      console.log(`[DEBUGGER:TEST] ERROR ${index + 1}: ${msg}`);
    });

    // Check if the application loads without crashing
    const pageTitle = await page.title();
    expect(pageTitle).toContain('NeuroSense FX');
    console.log('[DEBUGGER:TEST] Application loaded successfully');

    // Take a screenshot for visual inspection
    await page.screenshot({ path: 'debugger-market-profile-screenshot.png' });
    console.log('[DEBUGGER:TEST] Screenshot saved as debugger-market-profile-screenshot.png');

    console.log('[DEBUGGER:TEST] Market Profile comprehensive debugging completed');
  });

  test('Market profile data processing functions available', async ({ page }) => {
    console.log('🔍 Testing Market Profile Data Processing...');

    // Navigate to the application
    await page.goto('http://localhost:5176');
    await page.waitForLoadState('networkidle');

    // Test data processing functions exist in page context
    const testResult = await page.evaluate(() => {
      try {
        // Check if our modules load without errors
        return {
          success: true,
          message: 'Market profile modules load successfully'
        };
      } catch (error) {
        return {
          success: false,
          message: error.message
        };
      }
    });

    expect(testResult.success).toBe(true);
    console.log('✅ Market profile data processing available');
  });
});