// Console Logging Test - Crystal Clarity Compliant
// Comprehensive console visibility for debugging Market Profile issues

import { test, expect } from '@playwright/test';

test.describe('Market Profile Console Debugging', () => {
  test('capture all console output during market profile creation', async ({ page }) => {
    console.log('🧪 Starting Market Profile console capture test');

    // Set up comprehensive console logging
    const allConsoleLogs = [];
    const errorLogs = [];
    const marketProfileLogs = [];

    page.on('console', msg => {
      const text = msg.text();
      allConsoleLogs.push({
        type: msg.type(),
        text: text,
        timestamp: new Date().toISOString()
      });

      // Capture error logs
      if (msg.type() === 'error' || text.includes('ERROR') || text.includes('Assignment to constant')) {
        errorLogs.push({
          type: msg.type(),
          text: text,
          location: msg.location(),
          timestamp: new Date().toISOString()
        });
      }

      // Capture Market Profile specific logs
      if (text.includes('[MARKET_PROFILE]') || text.includes('[DISPLAY_CANVAS]') || text.includes('[FLOATING_DISPLAY]')) {
        marketProfileLogs.push({
          type: msg.type(),
          text: text,
          timestamp: new Date().toISOString()
        });
      }

      // Log to console for immediate visibility
      console.log(`[${msg.type().toUpperCase()}] ${text}`);
    });

    page.on('pageerror', error => {
      console.error(`[PAGE ERROR] ${error.message}`);
      console.error(`[PAGE ERROR STACK] ${error.stack}`);
    });

    // Navigate to the application on correct port
    await page.goto('http://localhost:5175');
    console.log('✅ Navigated to localhost:5175');

    // Wait for app to load
    await page.waitForSelector('.workspace', { timeout: 10000 });
    console.log('✅ Workspace loaded');

    // Focus the page to ensure keyboard events work
    await page.focus('body');

    // Create a Market Profile display
    console.log('⌨️ Pressing Alt+A to create display...');

    // Handle the prompt dialog that appears BEFORE the keyboard press
    let dialogHandled = false;
    page.on('dialog', async dialog => {
      console.log(`📝 Dialog appeared: ${dialog.message()}`);
      await dialog.accept('BTCUSD');
      console.log('✅ Dialog accepted with symbol: BTCUSD');
      dialogHandled = true;
    });

    // Focus the workspace div to ensure it receives keyboard events
    await page.focus('.workspace');
    await page.waitForTimeout(500);

    // Press Alt+A
    console.log('🎹 Executing Alt+A key combination...');
    await page.keyboard.down('Alt');
    await page.keyboard.press('a');
    await page.keyboard.up('Alt');
    await page.waitForTimeout(1000);

    // Check if dialog was handled
    if (!dialogHandled) {
      console.log('⚠️ No dialog was handled - checking for display creation...');
    }

    console.log('⏱️ Waiting 5 seconds for Market Profile initialization...');
    await page.waitForTimeout(5000);

    // Step 2: Press Alt+M to toggle market profile overlay
    console.log('🔄 Pressing Alt+M to toggle Market Profile overlay...');

    // Focus the first display to ensure keyboard events work
    const firstDisplay = page.locator('.floating-display').first();
    if (await firstDisplay.count() > 0) {
      await firstDisplay.focus();
      await page.waitForTimeout(500);

      // Press Alt+M
      await page.keyboard.down('Alt');
      await page.keyboard.press('m');
      await page.keyboard.up('Alt');
      console.log('🔄 Alt+M pressed - waiting for market profile overlay...');

      // Wait for overlay to render
      await page.waitForTimeout(3000);
    } else {
      console.log('⚠️ No displays found to toggle market profile');
    }

    // Take screenshot for documentation
    await page.screenshot({
      path: 'market-profile-console-debug.png',
      fullPage: false
    });

    // Analyze logs
    console.log('\n📊 CONSOLE LOG ANALYSIS:');
    console.log(`Total console messages: ${allConsoleLogs.length}`);
    console.log(`Error messages: ${errorLogs.length}`);
    console.log(`Market Profile messages: ${marketProfileLogs.length}`);

    // Print all Market Profile related logs
    if (marketProfileLogs.length > 0) {
      console.log('\n📊 MARKET PROFILE LOGS:');
      marketProfileLogs.forEach((log, index) => {
        console.log(`${index + 1}. [${log.type.toUpperCase()}] ${log.text}`);
      });
    } else {
      console.log('\n❌ No Market Profile logs found - this indicates the Market Profile is not being initialized properly');
    }

    // Print error logs
    if (errorLogs.length > 0) {
      console.log('\n🔴 ERROR LOGS:');
      errorLogs.forEach((log, index) => {
        console.log(`${index + 1}. [${log.type.toUpperCase()}] ${log.text}`);
        if (log.location) {
          console.log(`   Location: ${log.location.url}:${log.location.lineNumber}`);
        }
      });
    } else {
      console.log('\n✅ No error logs detected');
    }

    // Check for the specific "Assignment to constant" error
    const assignmentError = errorLogs.some(log => log.text.includes('Assignment to constant'));
    const jsonParseError = errorLogs.some(log => log.text.includes('JSON_PARSE_ERROR'));
    const renderError = errorLogs.some(log => log.text.includes('RENDER_ERROR'));

    console.log('\n🔍 SPECIFIC ERROR CHECKS:');
    console.log(`Assignment to constant error: ${assignmentError ? '🔴 FOUND' : '✅ NOT FOUND'}`);
    console.log(`JSON parse error: ${jsonParseError ? '🔴 FOUND' : '✅ NOT FOUND'}`);
    console.log(`Render error: ${renderError ? '🔴 FOUND' : '✅ NOT FOUND'}`);

    // Test results
    const hasErrors = assignmentError || jsonParseError || renderError;

    if (hasErrors) {
      console.log('\n🔴 TEST FAILED: Critical errors detected in Market Profile implementation');

      // Find the exact source of the error
      const assignmentLogs = errorLogs.filter(log => log.text.includes('Assignment to constant'));
      if (assignmentLogs.length > 0) {
        console.log('\n🎯 ASSIGNMENT ERROR DETAILS:');
        assignmentLogs.forEach(log => {
          console.log(`Message: ${log.text}`);
          if (log.location) {
            console.log(`Source: ${log.location.url}:${log.location.lineNumber}`);
          }
        });
      }

      throw new Error(`Market Profile implementation has ${errorLogs.length} errors that need to be fixed`);
    } else {
      console.log('\n✅ TEST PASSED: No critical errors detected in Market Profile implementation');
    }

    // Check if Market Profile display was created
    const displays = await page.locator('.floating-display').count();
    console.log(`\n🪟 Floating displays created: ${displays}`);

    if (displays === 0) {
      console.log('⚠️ No floating displays found - check display creation logic');
    }
  });
});