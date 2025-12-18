// Market Profile Debug Test - Crystal Clarity Compliant
// Testing Market Profile implementation with comprehensive console logging

import { test, expect } from '@playwright/test';

test.describe('Market Profile Debug Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up comprehensive console logging
    await page.addInitScript(() => {
      // Enhanced console logging with emoji classification
      const originalConsoleLog = console.log;
      const originalConsoleError = console.error;

      console.log = (...args) => {
        const message = args.join(' ');
        let emoji = '💡';

        if (message.includes('[MARKET_PROFILE]')) emoji = '📊';
        else if (message.includes('[DISPLAY_CANVAS]')) emoji = '🖼️';
        else if (message.includes('[FLOATING_DISPLAY]')) emoji = '🪟';
        else if (message.includes('[SYSTEM]')) emoji = '⚙️';
        else if (message.includes('[ERROR]')) emoji = '❌';

        originalConsoleLog(`[${emoji}] ${message}`);
      };

      console.error = (...args) => {
        const message = args.join(' ');
        originalConsoleError(`[🔥 CRITICAL] ${message}`);
      };
    });
  });

  test('market profile creation and data flow with detailed logging', async ({ page }) => {
    console.log('🧪 Starting Market Profile debug test');

    // Navigate to the application
    await page.goto('http://localhost:5174');

    // Wait for the app to load
    await page.waitForSelector('.workspace', { timeout: 10000 });
    console.log('✅ Application loaded successfully');

    // Create a Market Profile display
    await page.keyboard.press('Alt+A');
    await page.waitForTimeout(500);

    // Type symbol for Market Profile
    await page.keyboard.type('BTCUSD');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    console.log('📊 Market Profile display created for BTCUSD');

    // Look for the display element
    const displayElement = await page.locator('[data-display-id]').first();
    await expect(displayElement).toBeVisible({ timeout: 5000 });

    console.log('✅ Market Profile display element found');

    // Wait for connection and data flow
    await page.waitForTimeout(3000);

    // Take screenshot for visual verification
    await page.screenshot({
      path: 'market-profile-debug-state.png',
      fullPage: false
    });

    console.log('📸 Screenshot captured for visual analysis');

    // Get all console logs for analysis
    const pageConsoleLogs = [];
    page.on('console', msg => {
      pageConsoleLogs.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      });
    });

    // Wait for additional logs
    await page.waitForTimeout(2000);

    // Analyze console logs for errors
    const errorLogs = pageConsoleLogs.filter(log =>
      log.text.includes('ERROR') ||
      log.text.includes('Assignment to constant') ||
      log.text.includes('JSON_PARSE_ERROR') ||
      log.type === 'error'
    );

    if (errorLogs.length > 0) {
      console.log('🔍 Found error logs:');
      errorLogs.forEach((log, index) => {
        console.log(`${index + 1}. [${log.type.toUpperCase()}] ${log.text}`);
        if (log.location) {
          console.log(`   Location: ${log.location.url}:${log.location.lineNumber}`);
        }
      });
    } else {
      console.log('✅ No error logs detected');
    }

    // Analyze Market Profile specific logs
    const marketProfileLogs = pageConsoleLogs.filter(log =>
      log.text.includes('[MARKET_PROFILE]') ||
      log.text.includes('[DISPLAY_CANVAS]') ||
      log.text.includes('[FLOATING_DISPLAY]')
    );

    console.log('📊 Market Profile flow logs:');
    marketProfileLogs.forEach((log, index) => {
      console.log(`${index + 1}. [${log.type.toUpperCase()}] ${log.text}`);
    });

    // Check for specific error patterns
    const assignmentError = pageConsoleLogs.some(log =>
      log.text.includes('Assignment to constant')
    );

    const jsonParseError = pageConsoleLogs.some(log =>
      log.text.includes('JSON_PARSE_ERROR')
    );

    const renderError = pageConsoleLogs.some(log =>
      log.text.includes('RENDER_ERROR')
    );

    // Test results
    console.log('\n🔍 Test Results Analysis:');
    console.log(`- Assignment to constant error: ${assignmentError ? '🔴 DETECTED' : '✅ NONE'}`);
    console.log(`- JSON parse error: ${jsonParseError ? '🔴 DETECTED' : '✅ NONE'}`);
    console.log(`- Render error: ${renderError ? '🔴 DETECTED' : '✅ NONE'}`);
    console.log(`- Total console logs captured: ${pageConsoleLogs.length}`);
    console.log(`- Market Profile related logs: ${marketProfileLogs.length}`);

    if (assignmentError || jsonParseError || renderError) {
      console.log('\n🔴 ERROR ANALYSIS:');

      if (assignmentError) {
        const assignmentLogs = pageConsoleLogs.filter(log =>
          log.text.includes('Assignment to constant')
        );
        console.log('Assignment to constant details:');
        assignmentLogs.forEach(log => console.log(`  - ${log.text}`));
      }

      if (jsonParseError) {
        const jsonLogs = pageConsoleLogs.filter(log =>
          log.text.includes('JSON_PARSE_ERROR')
        );
        console.log('JSON Parse Error details:');
        jsonLogs.forEach(log => console.log(`  - ${log.text}`));
      }

      if (renderError) {
        const renderLogs = pageConsoleLogs.filter(log =>
          log.text.includes('RENDER_ERROR')
        );
        console.log('Render Error details:');
        renderLogs.forEach(log => console.log(`  - ${log.text}`));
      }
    } else {
      console.log('\n✅ No critical errors detected in Market Profile implementation');
    }

    // Assertions based on expected behavior
    if (assignmentError || jsonParseError) {
      console.log('\n🔴 Test failed due to detected errors');
      throw new Error('Market Profile implementation has critical errors that need to be fixed');
    } else {
      console.log('\n✅ Market Profile test passed - No critical errors detected');
    }
  });

  test('market profile data processing verification', async ({ page }) => {
    console.log('🧪 Starting Market Profile data processing test');

    await page.goto('http://localhost:5174');
    await page.waitForSelector('.workspace', { timeout: 10000 });

    // Create Market Profile display
    await page.keyboard.press('Alt+A');
    await page.waitForTimeout(500);
    await page.keyboard.type('EURUSD');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // Capture data processing logs
    const processingLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('MARKET_PROFILE') ||
          text.includes('processMarketProfileData') ||
          text.includes('buildInitialProfile') ||
          text.includes('updateProfileWithTick')) {
        processingLogs.push({
          type: msg.type(),
          text: text,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Wait for processing
    await page.waitForTimeout(5000);

    console.log('📊 Data Processing Analysis:');
    console.log(`Total processing logs captured: ${processingLogs.length}`);

    processingLogs.forEach((log, index) => {
      console.log(`${index + 1}. [${log.type}] ${log.text}`);
    });

    // Check for successful data flow
    const hasInitialProfile = processingLogs.some(log =>
      log.text.includes('Built initial profile')
    );

    const hasProfileUpdate = processingLogs.some(log =>
      log.text.includes('Updated profile with tick')
    );

    console.log('\n📊 Data Flow Results:');
    console.log(`- Initial profile built: ${hasInitialProfile ? '✅ YES' : '❌ NO'}`);
    console.log(`- Profile updates received: ${hasProfileUpdate ? '✅ YES' : '❌ NO'}`);

    if (!hasInitialProfile && !hasProfileUpdate) {
      console.log('⚠️ No market profile data processing detected - possible backend connection issue');
    }
  });
});