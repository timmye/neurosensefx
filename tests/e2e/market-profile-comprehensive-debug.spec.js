import { test, expect } from '@playwright/test';

/**
 * Market Profile Comprehensive Debug Test
 *
 * This test creates a display, enables Market Profile, and checks:
 * 1. Browser console for errors
 * 2. Network messages (symbolDataPackage, profileUpdate)
 * 3. bucketSize presence in messages
 * 4. Profile rendering on canvas
 */

test.describe('Market Profile Comprehensive Debug', () => {
  let consoleMessages = {
    errors: [],
    warnings: [],
    logs: [],
    marketProfileLogs: []
  };

  test.beforeEach(async ({ page }) => {
    // Reset console messages
    consoleMessages = {
      errors: [],
      warnings: [],
      logs: [],
      marketProfileLogs: []
    };

    // Navigate to the application
    await page.goto('/');

    // Set up comprehensive console logging
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();

      // Store errors and warnings
      if (type === 'error') {
        consoleMessages.errors.push({
          text,
          timestamp: Date.now()
        });
        console.error(`[ERROR] ${text}`);
      } else if (type === 'warning') {
        consoleMessages.warnings.push({
          text,
          timestamp: Date.now()
        });
        console.warn(`[WARNING] ${text}`);
      } else {
        // Store all logs
        consoleMessages.logs.push({
          text,
          timestamp: Date.now()
        });

        // Track Market Profile specific messages
        const lowerText = text.toLowerCase();
        if (lowerText.includes('market') ||
            lowerText.includes('profile') ||
            lowerText.includes('bucket') ||
            lowerText.includes('[market_profile]') ||
            lowerText.includes('initialmarketprofile')) {
          consoleMessages.marketProfileLogs.push({
            text,
            timestamp: Date.now()
          });
          console.log(`[MP] ${text}`);
        }
      }
    });

    // Set up dialog handler for symbol input
    page.on('dialog', async dialog => {
      console.log(`[DIALOG] ${dialog.message()}`);
      await dialog.accept('EURUSD');
    });

    // Wait for initial load
    await page.waitForTimeout(2000);
  });

  test('MP-COMP-1: Full Market Profile data flow analysis', async ({ page }) => {
    console.log('\n=== MP-COMP-1: Full Market Profile Data Flow Analysis ===\n');

    const startTime = Date.now();

    // Step 1: Create FloatingDisplay
    console.log('Step 1: Creating FloatingDisplay with Alt+A...');
    await page.keyboard.press('Alt+a');
    await page.waitForTimeout(5000);

    // Step 2: Check for errors after display creation
    console.log('\nStep 2: Checking for errors after display creation...');
    console.log(`Errors found: ${consoleMessages.errors.length}`);

    if (consoleMessages.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      consoleMessages.errors.forEach((err, index) => {
        console.log(`  ${index + 1}. [${err.timestamp - startTime}ms] ${err.text}`);
      });
    } else {
      console.log('✅ No errors after display creation');
    }

    // Step 3: Check Market Profile logs
    console.log('\nStep 3: Checking Market Profile logs...');
    console.log(`Market Profile logs found: ${consoleMessages.marketProfileLogs.length}`);

    consoleMessages.marketProfileLogs.forEach(log => {
      console.log(`  [${log.timestamp - startTime}ms] ${log.text}`);
    });

    // Step 4: Check display state
    console.log('\nStep 4: Checking display state...');
    const displayState = await page.evaluate(() => {
      const state = window.workspaceStore.getState();
      const displays = Array.from(state.displays.values());

      if (displays.length === 0) {
        return { error: 'No displays found' };
      }

      const display = displays[0];
      return {
        displayCount: displays.length,
        symbol: display.symbol,
        source: display.source,
        showMarketProfile: display.showMarketProfile || false,
        hasLastData: display.lastData !== null,
        hasLastMarketProfileData: display.lastMarketProfileData !== null
      };
    });

    console.log('Display State:', JSON.stringify(displayState, null, 2));

    // Step 5: Check canvas state
    console.log('\nStep 5: Checking canvas state...');
    const canvasState = await page.evaluate(() => {
      const canvases = document.querySelectorAll('canvas');
      if (canvases.length === 0) {
        return { error: 'No canvases found' };
      }

      const canvas = canvases[0];
      const ctx = canvas.getContext('2d');

      return {
        canvasCount: canvases.length,
        firstCanvasWidth: canvas.width,
        firstCanvasHeight: canvas.height,
        hasContext: ctx !== null
      };
    });

    console.log('Canvas State:', canvasState);

    // Step 6: Enable Market Profile
    console.log('\nStep 6: Enabling Market Profile with Alt+M...');
    consoleMessages.errors = [];
    consoleMessages.marketProfileLogs = [];

    await page.keyboard.press('Alt+m');
    await page.waitForTimeout(5000);

    // Step 7: Check for errors after enabling Market Profile
    console.log('\nStep 7: Checking for errors after enabling Market Profile...');
    console.log(`Errors found: ${consoleMessages.errors.length}`);

    if (consoleMessages.errors.length > 0) {
      console.log('\n❌ ERRORS after Alt+M:');
      consoleMessages.errors.forEach(err => {
        console.log(`  - ${err.text}`);
      });
    } else {
      console.log('✅ No errors after enabling Market Profile');
    }

    // Step 8: Check Market Profile logs after enabling
    console.log('\nStep 8: Checking Market Profile logs after Alt+M...');
    console.log(`Market Profile logs found: ${consoleMessages.marketProfileLogs.length}`);

    consoleMessages.marketProfileLogs.forEach(log => {
      console.log(`  ${log.text}`);
    });

    // Step 9: Check display state after enabling Market Profile
    console.log('\nStep 9: Checking display state after Alt+M...');
    const displayStateAfterMP = await page.evaluate(() => {
      const state = window.workspaceStore.getState();
      const displays = Array.from(state.displays.values());

      if (displays.length === 0) {
        return { error: 'No displays found' };
      }

      const display = displays[0];
      return {
        displayCount: displays.length,
        symbol: display.symbol,
        source: display.source,
        showMarketProfile: display.showMarketProfile || false
      };
    });

    console.log('Display State after Alt+M:', JSON.stringify(displayStateAfterMP, null, 2));

    // Step 10: Take screenshots
    console.log('\nStep 10: Taking screenshots...');

    // Screenshot before Market Profile
    const canvasExists = canvasState.canvasCount > 0;
    if (canvasExists) {
      await page.screenshot({
        path: '/workspaces/neurosensefx/test-results/market-profile-before.png',
        fullPage: false
      });
      console.log('✅ Screenshot saved: market-profile-before.png');
    }

    // Screenshot after Market Profile
    await page.screenshot({
      path: '/workspaces/neurosensefx/test-results/market-profile-after.png',
      fullPage: false
    });
    console.log('✅ Screenshot saved: market-profile-after.png');

    // Step 11: Check for symbolDataPackage in WebSocket messages
    console.log('\nStep 11: Checking WebSocket message history...');
    const wsMessages = await page.evaluate(() => {
      // Try to get WebSocket messages from window if captured
      if (window.capturedWebSocketMessages) {
        return window.capturedWebSocketMessages;
      }
      return [];
    });

    console.log(`WebSocket messages captured: ${wsMessages.length}`);

    const symbolDataPackages = wsMessages.filter(msg =>
      msg.data?.type === 'symbolDataPackage'
    );

    console.log(`symbolDataPackage messages: ${symbolDataPackages.length}`);

    if (symbolDataPackages.length > 0) {
      symbolDataPackages.forEach((msg, index) => {
        console.log(`\nsymbolDataPackage ${index + 1}:`);
        console.log(`  Symbol: ${msg.data.symbol}`);
        console.log(`  Has initialMarketProfile: ${!!msg.data.initialMarketProfile}`);
        console.log(`  Has bucketSize: ${!!msg.data.bucketSize}`);
        if (msg.data.bucketSize) {
          console.log(`  bucketSize value: ${msg.data.bucketSize}`);
        }
        if (msg.data.initialMarketProfile) {
          console.log(`  initialMarketProfile length: ${msg.data.initialMarketProfile.length}`);
        }
      });
    }

    // Step 12: Final summary
    console.log('\n=== MP-COMP-1: FINAL SUMMARY ===');
    console.log(`Display Created: ${displayState.displayCount > 0 ? '✅ YES' : '❌ NO'}`);
    console.log(`Market Profile Enabled: ${displayStateAfterMP.showMarketProfile ? '✅ YES' : '❌ NO'}`);
    console.log(`Canvas Present: ${canvasState.canvasCount > 0 ? '✅ YES' : '❌ NO'}`);
    console.log(`Console Errors: ${consoleMessages.errors.length > 0 ? '❌ FOUND' : '✅ NONE'}`);
    console.log(`Market Profile Logs: ${consoleMessages.marketProfileLogs.length}`);
    console.log(`symbolDataPackage Received: ${symbolDataPackages.length > 0 ? '✅ YES' : '❌ NO'}`);

    if (symbolDataPackages.length > 0) {
      const hasBucketSize = symbolDataPackages.some(pkg => pkg.data.bucketSize);
      const hasInitialProfile = symbolDataPackages.some(pkg => pkg.data.initialMarketProfile);
      console.log(`bucketSize Present: ${hasBucketSize ? '✅ YES' : '❌ NO'}`);
      console.log(`initialMarketProfile Present: ${hasInitialProfile ? '✅ YES' : '❌ NO'}`);
    }

    console.log('\nScreenshots:');
    console.log('  - /workspaces/neurosensefx/test-results/market-profile-before.png');
    console.log('  - /workspaces/neurosensefx/test-results/market-profile-after.png');

    // Assertions
    expect(displayState.displayCount).toBeGreaterThan(0);
    expect(canvasState.canvasCount).toBeGreaterThan(0);
  });

  test('MP-COMP-2: Check for bucketSize calculation errors', async ({ page }) => {
    console.log('\n=== MP-COMP-2: bucketSize Calculation Error Check ===\n');

    // Create display and enable Market Profile
    await page.keyboard.press('Alt+a');
    await page.waitForTimeout(3000);

    consoleMessages.errors = [];
    consoleMessages.marketProfileLogs = [];

    await page.keyboard.press('Alt+m');
    await page.waitForTimeout(5000);

    // Look for bucketSize related errors
    console.log('Checking for bucketSize-related errors...');

    const bucketSizeErrors = consoleMessages.errors.filter(err =>
      err.text.toLowerCase().includes('bucket') ||
      err.text.toLowerCase().includes('initialmarketprofile') ||
      err.text.toLowerCase().includes('undefined') && err.text.toLowerCase().includes('market')
    );

    console.log(`bucketSize-related errors: ${bucketSizeErrors.length}`);

    if (bucketSizeErrors.length > 0) {
      console.log('\n❌ BUCKET SIZE ERRORS:');
      bucketSizeErrors.forEach(err => {
        console.log(`  - ${err.text}`);
      });
    } else {
      console.log('✅ No bucketSize-related errors');
    }

    // Check Market Profile logs for bucketSize
    console.log('\nChecking Market Profile logs for bucketSize...');

    const bucketSizeLogs = consoleMessages.marketProfileLogs.filter(log =>
      log.text.toLowerCase().includes('bucket') ||
      log.text.toLowerCase().includes('bucket size')
    );

    console.log(`bucketSize logs found: ${bucketSizeLogs.length}`);

    bucketSizeLogs.forEach(log => {
      console.log(`  ${log.text}`);
    });

    // Check if profile was built
    console.log('\nChecking if profile was built...');

    const profileBuiltLogs = consoleMessages.marketProfileLogs.filter(log =>
      log.text.toLowerCase().includes('built profile') ||
      log.text.includes('[MARKET_PROFILE]')
    );

    console.log(`Profile built logs: ${profileBuiltLogs.length}`);

    profileBuiltLogs.forEach(log => {
      console.log(`  ${log.text}`);
    });

    // Summary
    console.log('\n=== MP-COMP-2: SUMMARY ===');
    console.log(`bucketSize Errors: ${bucketSizeErrors.length > 0 ? '❌ FOUND' : '✅ NONE'}`);
    console.log(`bucketSize Logs: ${bucketSizeLogs.length}`);
    console.log(`Profile Built Logs: ${profileBuiltLogs.length}`);
    console.log(`Profile Built: ${profileBuiltLogs.length > 0 ? '✅ YES' : '❌ NO'}`);

    expect(bucketSizeErrors.length).toBe(0);
  });
});
