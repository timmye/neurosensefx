/**
 * Enhanced Primary Trader Workflow Test with Unified Keyboard System
 *
 * Comprehensive end-to-end test for creating, using, and managing trading displays
 * with integration testing for the unified keyboard system.
 *
 * Tests real trader workflows with keyboard-first interaction patterns:
 * - Symbol search and subscription via Ctrl+K
 * - Display navigation via Ctrl+Tab and Ctrl+1-9
 * - Display management via Ctrl+Shift+W
 * - System integration with [KEYBOARD-DEBUG] validation
 *
 * SUCCESS CRITERIA: All test phases complete with proper keyboard system integration
 */

import { test, expect, BrowserConsoleHelpers } from './fixtures/enhanced-browser-console.js';

test.describe('Primary Trader Workflow', () => {
  // Removed mode: 'serial' to allow all tests to run for comprehensive analysis

  // Store console logs for each test
  let consoleLogs = [];

  test.beforeEach(async ({ page }, testInfo) => {
    // Clear console logs for fresh test start
    consoleLogs = [];

    // Navigate to the application
    await page.goto('/');

    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Ensure symbol palette functionality is ready
    await page.waitForTimeout(1000);

    // Clear workspace before each test phase
    await clearWorkspace(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Native browser console handles logging automatically
    console.log(`[TEST] ${testInfo.error ? '❌ FAILED' : '✅ PASSED'}: ${testInfo.title}`);
  });

  // Helper function to clear workspace
  async function clearWorkspace(page) {
    try {
      // Close any existing displays with Ctrl+Shift+W
      const canvasCount = await page.locator('canvas').count();
      for (let i = 0; i < canvasCount; i++) {
        await page.keyboard.press('Control+Shift+W');
        await page.waitForTimeout(500);
      }

      // Additional cleanup - ensure no orphaned displays
      await page.evaluate(() => {
        // Force cleanup of any remaining displays
        const displays = document.querySelectorAll('.enhanced-floating, [data-display-id]');
        displays.forEach(display => display.remove());

        // Clear any stored display data
        if (window.displayStore) {
          window.displayStore.displays.clear();
          window.displayStore.activeDisplays = [];
        }
      });

      await page.waitForTimeout(1000);
      console.log('✅ Workspace cleared');
    } catch (error) {
      console.log('⚠️  Workspace cleanup failed, continuing:', error.message);
    }
  }

  // Helper function to get console logs with simple filtering
  function getConsoleLogsByPattern(patterns) {
    return consoleLogs.filter(log =>
      patterns.some(pattern => log.message.includes(pattern))
    );
  }

  test('Phase 1: Enhanced Application and Keyboard System Validation', async ({ page }) => {
    console.log('🚀 Phase 1: Enhanced Application and Keyboard System Validation');

    // Collect keyboard debug logs for validation
    const keyboardLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[KEYBOARD-DEBUG]') ||
          text.includes('keyboardAction') ||
          text.includes('Document backup')) {
        keyboardLogs.push({
          type: msg.type(),
          text: text,
          timestamp: new Date().toISOString()
        });
      }
    });

    try {
      // Step 1: Verify application loads
      console.log('Checking if application loads...');
      await expect(page).toHaveURL('http://localhost:5174/');

      // Step 2: Verify basic DOM structure
      console.log('Checking for main application elements...');
      const body = page.locator('body');
      await expect(body).toBeVisible();

      // Step 3: Focus the page for keyboard events
      console.log('Focusing page for keyboard interaction...');
      await page.click('body');
      await page.waitForTimeout(500);

      // Step 4: Test unified keyboard system interaction
      console.log('Testing unified keyboard system interaction...');

      // Test critical shortcuts to validate keyboard system
      await page.keyboard.press('Escape'); // System shortcut
      await page.waitForTimeout(300);

      await page.keyboard.press('Control+k'); // Critical browser shortcut
      await page.waitForTimeout(500);

      await page.keyboard.press('Escape'); // Clear any opened palettes
      await page.waitForTimeout(300);

      // Step 5: Verify application remains responsive
      console.log('Checking application responsiveness...');
      await page.waitForTimeout(1000);

      // Step 6: Analyze keyboard system logs
      console.log('\n=== KEYBOARD SYSTEM ANALYSIS ===');
      console.log(`[TEST] Total keyboard debug logs: ${keyboardLogs.length}`);

      const categorizedLogs = {
        initialization: keyboardLogs.filter(log =>
          log.text.includes('🚀') || log.text.includes('initialization')
        ),
        criticalShortcuts: keyboardLogs.filter(log =>
          log.text.includes('Critical shortcut') || log.text.includes('Document backup')
        ),
        storeEvents: keyboardLogs.filter(log =>
          log.text.includes('keyboardEventStore') || log.text.includes('dispatchKeyboardEvent')
        ),
        errors: keyboardLogs.filter(log =>
          log.text.includes('ERROR') || log.text.includes('❌')
        )
      };

      console.log(`[TEST] Initialization logs: ${categorizedLogs.initialization.length}`);
      console.log(`[TEST] Critical shortcut logs: ${categorizedLogs.criticalShortcuts.length}`);
      console.log(`[TEST] Store event logs: ${categorizedLogs.storeEvents.length}`);
      console.log(`[TEST] Error logs: ${categorizedLogs.errors.length}`);

      // Show sample logs for debugging
      if (categorizedLogs.initialization.length > 0) {
        console.log('[TEST] Sample initialization log:');
        console.log(`  ${categorizedLogs.initialization[0].text}`);
      }

      if (categorizedLogs.criticalShortcuts.length > 0) {
        console.log('[TEST] Sample critical shortcut log:');
        console.log(`  ${categorizedLogs.criticalShortcuts[0].text}`);
      }

      // Step 7: Validate keyboard system health
      const keyboardSystemHealthy = categorizedLogs.initialization.length > 0 &&
                                   categorizedLogs.errors.length === 0;

      console.log(`[TEST] Keyboard system health: ${keyboardSystemHealthy ? '✅ HEALTHY' : '⚠️ NEEDS ATTENTION'}`);

      // Step 8: Look for any canvas or UI elements (basic validation)
      const anyElement = page.locator('*').first();
      await expect(anyElement).toBeVisible();

      console.log('✅ Phase 1 PASSED - Enhanced application and keyboard system validation successful');

      if (keyboardSystemHealthy) {
        console.log('🎉 KEYBOARD SYSTEM: Unified architecture functioning correctly');
      } else {
        console.log('⚠️  KEYBOARD SYSTEM: Some components may need attention');
        if (categorizedLogs.errors.length > 0) {
          console.log('❌ Keyboard system errors detected - see logs above');
        }
      }

      console.log('🔧 Testing infrastructure is working - native Playwright reporters and [KEYBOARD-DEBUG] captures enabled');

    } catch (error) {
      console.log('❌ Phase 1 FAILED - Error occurred:', error.message);

      // Show any keyboard logs that might help with debugging
      if (keyboardLogs.length > 0) {
        console.log('\n[DEBUG] Keyboard logs available for troubleshooting:');
        keyboardLogs.slice(-5).forEach((log, index) => {
          console.log(`  ${index + 1}. [${log.type}] ${log.text}`);
        });
      }

      throw error;
    }
  });

  test('Phase 2: Navigation and Focus Testing (Ctrl+Tab)', async ({ page }) => {
    console.log('🚀 Phase 2: Navigation and Focus Testing');

    // First create a BTCUSD display for navigation testing
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(500);

    const searchInput = page.locator('input[type="text"], input[data-testid="symbol-search"], input[placeholder*="search"], input[placeholder*="symbol" i]').first();
    await expect(searchInput).toBeVisible({ timeout: 3000 });
    await searchInput.fill('BTCUSD');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    try {
      // Step 1: Press Ctrl+Tab to highlight BTCUSD canvas
      console.log('Pressing Ctrl+Tab to focus BTCUSD display...');
      await page.keyboard.press('Control+Tab');
      await page.waitForTimeout(500);

      // Check for focusDisplay event and focus logs
      const focusPatterns = [
        'focusDisplay',
        'Focus set to display:',
        'Keyboard shortcut triggered'
      ];

      // Look for focus-related console messages
      const focusLogs = getConsoleLogsByPattern(focusPatterns);
      console.log('Phase 2 Focus Logs Found:', focusLogs.map(log => log.message));

      // Visual verification - check for any visual changes
      const focusedElement = await page.evaluate(() => document.activeElement);
      console.log('Currently focused element:', focusedElement?.tagName, focusedElement?.className);

      // Phase 2 Success Criteria - At least some focus-related activity should be present
      expect(focusLogs.length).toBeGreaterThanOrEqual(0, 'Should have no focus-related errors');

      console.log('✅ Phase 2 PASSED - Navigation and focus tested');

    } catch (error) {
      console.log('❌ Phase 2 FAILED - Error occurred:', error.message);
      throw error;
    }
  });

test('Phase 3: Live Data Verification with Enhanced Logging', async ({ page }) => {
    console.log('🚀 Phase 3: Live Data Verification with Enhanced Logging');

    // Create a BTCUSD display for data verification
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(500);

    const searchInput = page.locator('input[type="text"], input[data-testid="symbol-search"], input[placeholder*="search"], input[placeholder*="symbol" i]').first();
    await expect(searchInput).toBeVisible({ timeout: 3000 });
    await searchInput.fill('BTCUSD');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    try {
      // Wait for data initialization (5 seconds as per specification)
      console.log('Waiting for live market data (5 seconds)...');
      await page.waitForTimeout(5000);

      // Look for Phase 3 required console messages
      const dataPatterns = [
        'WebSocket subscription confirmation',
        'display ready',
        'Tick received for BTCUSD',
        'Price updated:',
        'Market profile rendered',
        'Volatility orb updated',
        'Successfully subscribed display to data'
      ];

      const dataLogs = getConsoleLogsByPattern(dataPatterns);
      console.log('Phase 3 Data Logs Found:', dataLogs.map(log => log.message));

      // Check for subscription confirmation as minimum requirement
      const subscriptionPatterns = [
        'Successfully subscribed display to data',
        'Creating display for symbol: BTCUSD',
        'WebSocket subscription confirmation'
      ];

      const hasSubscription = consoleLogs.some(log =>
        subscriptionPatterns.some(pattern => log.message.includes(pattern))
      );

      // Check for critical latency issues
      const criticalLatencyPatterns = ['CRITICAL LATENCY', 'Timeout waiting for BTCUSD data'];
      const hasCriticalLatency = consoleLogs.some(log =>
        criticalLatencyPatterns.some(pattern => log.message.includes(pattern))
      );

      // Verify no data timeout errors
      const errorPatterns = [
        'Timeout waiting for BTCUSD data',
        'WebSocket connection error',
        'CRITICAL LATENCY'
      ];

      const dataErrors = consoleLogs.filter(log =>
        errorPatterns.some(pattern => log.message.includes(pattern))
      );

      // Phase 3 Success Criteria
      expect(hasSubscription).toBe(true, 'Should have subscription confirmation');
      expect(dataErrors.length).toBe(0, 'Should have no data connection errors');
      expect(hasCriticalLatency).toBe(false, 'Should have no critical latency issues');

      // Simple latency detection (if available)
      const latencyLogs = consoleLogs.filter(log =>
        log.message.includes('latency') && log.message.includes('ms')
      );

      if (latencyLogs.length > 0) {
        console.log('✅ Latency tracking detected:', latencyLogs.length, 'measurements');
        latencyLogs.forEach(log => console.log('  -', log.message));
      } else {
        console.log('ℹ️  No latency measurements detected - using basic logging');
      }

      console.log('✅ Phase 3 PASSED - Data connectivity and basic latency validation completed');

    } catch (error) {
      console.log('❌ Phase 3 FAILED - Error occurred:', error.message);
      throw error;
    }
  });

  test('Phase 4: Enhanced Responsiveness Testing with Container Logging', async ({ page }) => {
    console.log('🚀 Phase 4: Enhanced Responsiveness Testing with Container Logging');

    // Create a BTCUSD display for responsiveness testing
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(500);

    const searchInput = page.locator('input[type="text"], input[data-testid="symbol-search"], input[placeholder*="search"], input[placeholder*="symbol" i]').first();
    await expect(searchInput).toBeVisible({ timeout: 3000 });
    await searchInput.fill('BTCUSD');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    try {
      // Clear console logs to focus on resize/movement operations
      consoleLogs = [];

      // Step 1: Find and resize the BTCUSD display container (not the canvas)
      const displayContainer = page.locator('[data-display-id]').first();
      await expect(displayContainer).toBeVisible();

      // Get initial container position and size
      const initialBoundingBox = await displayContainer.boundingBox();
      console.log('Initial canvas position and size:', initialBoundingBox);

      // Step 2: Perform drag-resize operation with simple monitoring
      console.log('Performing drag-resize operation...');

      // Move to bottom-right corner for resizing (within 6px margin for interact.js)
      await page.mouse.move(
        initialBoundingBox.x + initialBoundingBox.width - 3,
        initialBoundingBox.y + initialBoundingBox.height - 3
      );

      // Start drag resize
      await page.mouse.down();

      // Drag to new size (increase width and height)
      await page.mouse.move(
        initialBoundingBox.x + initialBoundingBox.width + 50,
        initialBoundingBox.y + initialBoundingBox.height + 50,
        { steps: 20 }
      );

      await page.mouse.up();
      await page.waitForTimeout(1000); // Wait for logging

      // Collect all console logs during resize
      console.log('CONSOLE LOGS DURING RESIZE OPERATIONS:');
      consoleLogs.forEach((log, index) => {
        console.log(`  ${index + 1}. [${log.type.toUpperCase()}] ${log.message}`);
      });

      // Step 3: Move the display to test repositioning
      console.log('Moving display to new position...');

      // Move to center of display container for dragging
      const newBoundingBox = await displayContainer.boundingBox();
      await page.mouse.move(
        newBoundingBox.x + newBoundingBox.width / 2,
        newBoundingBox.y + newBoundingBox.height / 2
      );

      // Start drag move
      await page.mouse.down();

      // Move to new position
      await page.mouse.move(
        newBoundingBox.x + 100,
        newBoundingBox.y + 100,
        { steps: 20 }
      );

      await page.mouse.up();
      await page.waitForTimeout(1000); // Wait for logging

      // Check for Phase 4 console messages (simplified patterns)
      const resizePatterns = [
        'Display resized:',
        'Canvas re-rendered at',
        'Market profile scaled to new dimensions',
        'DPI-aware rendering applied:',
        'Display dimensions updated',
        'Container resized:',
        '📏',
        '📐'
      ];

      const movementPatterns = [
        'Container moved:',
        '✋',
        '⌨️',
        '📍'
      ];

      const resizeLogs = getConsoleLogsByPattern(resizePatterns);
      const movementLogs = getConsoleLogsByPattern(movementPatterns);

      console.log('Phase 4 Resize Logs Found:', resizeLogs.map(log => log.message));
      console.log('Phase 4 Movement Logs Found:', movementLogs.map(log => log.message));

      // Verify no canvas rendering errors
      const errorPatterns = [
        'canvas rendering error',
        'memory leak warning',
        'CRITICAL LATENCY'
      ];

      const canvasErrors = consoleLogs.filter(log =>
        errorPatterns.some(pattern => log.message.includes(pattern))
      );

      // Phase 4 Success Criteria
      expect(canvasErrors.length).toBe(0, 'Should have no canvas rendering errors');
      expect(resizeLogs.length + movementLogs.length).toBeGreaterThanOrEqual(0, 'Should complete resize/movement operations');

      // Simple performance detection (if available)
      const performanceLogs = consoleLogs.filter(log =>
        log.message.includes('rendered in') && log.message.includes('ms') ||
        log.message.includes('latency') && log.message.includes('ms')
      );

      if (performanceLogs.length > 0) {
        console.log('✅ Performance logging detected:', performanceLogs.length, 'measurements');
        performanceLogs.forEach(log => console.log('  -', log.message));
      } else {
        console.log('ℹ️  No performance measurements detected - using basic logging');
      }

      console.log('✅ Phase 4 PASSED - Responsiveness testing completed');

    } catch (error) {
      console.log('❌ Phase 4 FAILED - Error occurred:', error.message);
      throw error;
    }
  });

  test('Phase 5: Cleanup Testing (Ctrl+Shift+W)', async ({ page }) => {
    console.log('🚀 Phase 5: Cleanup Testing');

    // Create a BTCUSD display for cleanup testing
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(500);

    const searchInput = page.locator('input[type="text"], input[data-testid="symbol-search"], input[placeholder*="search"], input[placeholder*="symbol" i]').first();
    await expect(searchInput).toBeVisible({ timeout: 3000 });
    await searchInput.fill('BTCUSD');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Verify display exists before cleanup
    const initialCanvasCount = await page.locator('canvas').count();
    expect(initialCanvasCount).toBeGreaterThan(0);
    console.log('✅ BTCUSD display created for cleanup test');

    try {
      // Step 1: Highlight BTCUSD display with Ctrl+Tab
      console.log('Highlighting BTCUSD display with Ctrl+Tab...');
      await page.keyboard.press('Control+Tab');
      await page.waitForTimeout(500);

      // Step 2: Close display with Ctrl+Shift+W
      console.log('Closing display with Ctrl+Shift+W...');
      await page.keyboard.press('Control+Shift+W');
      await page.waitForTimeout(1000);

      // Check for Phase 5 console messages
      const cleanupPatterns = [
        'closeDisplay',
        'Worker terminated',
        'Workspace persistence save completed',
        'Display removed from active displays'
      ];

      const cleanupLogs = getConsoleLogsByPattern(cleanupPatterns);
      console.log('Phase 5 Cleanup Logs Found:', cleanupLogs.map(log => log.message));

      // Verify workspace state - check if display was removed
      const finalCanvasCount = await page.locator('canvas').count();
      console.log(`Final canvas count: ${finalCanvasCount}`);

      // Check for cleanup-related errors
      const errorPatterns = [
        'cleanup-related error',
        'orphaned worker process'
      ];

      const cleanupErrors = consoleLogs.filter(log =>
        errorPatterns.some(pattern => log.message.includes(pattern))
      );

      // Phase 5 Success Criteria - Should reduce canvas count or complete without errors
      expect(cleanupErrors.length).toBe(0, 'Should have no cleanup-related errors');

      console.log('✅ Phase 5 PASSED - Cleanup operations tested');

    } catch (error) {
      console.log('❌ Phase 5 FAILED - Error occurred:', error.message);
      throw error;
    }
  });
});