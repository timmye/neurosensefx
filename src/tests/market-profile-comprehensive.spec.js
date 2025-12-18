import { test, expect } from '@playwright/test';

test.describe('Market Profile Comprehensive Analysis', () => {
  test('Complete Market Profile System Analysis with Display Creation', async ({ page }) => {
    console.log('🎯 === COMPREHENSIVE MARKET PROFILE SYSTEM ANALYSIS ===');

    // Enhanced console logging setup
    const consoleMessages = [];
    const classifiedLogs = {
      marketProfile: [],
      websocket: [],
      rendering: [],
      errors: [],
      keyboard: [],
      general: []
    };

    page.on('console', msg => {
      const logEntry = {
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString(),
        location: msg.location()
      };
      consoleMessages.push(logEntry);

      // Classify logs for comprehensive analysis
      const text = msg.text().toLowerCase();

      if (text.includes('market') || text.includes('profile') || text.includes('[market_profile]') || text.includes('tpo')) {
        classifiedLogs.marketProfile.push({ ...logEntry, emoji: '📊' });
        console.log(`📊 [MARKET_PROFILE] ${msg.text()}`);
      } else if (text.includes('websocket') || text.includes('connect') || text.includes('subscribe') || text.includes('data')) {
        classifiedLogs.websocket.push({ ...logEntry, emoji: '🔌' });
        console.log(`🔌 [WEBSOCKET] ${msg.text()}`);
      } else if (text.includes('rendering') || text.includes('canvas') || text.includes('draw') || text.includes('visualiz')) {
        classifiedLogs.rendering.push({ ...logEntry, emoji: '🎨' });
        console.log(`🎨 [RENDERING] ${msg.text()}`);
      } else if (text.includes('keydown') || text.includes('alt') || text.includes('keyboard')) {
        classifiedLogs.keyboard.push({ ...logEntry, emoji: '⌨️' });
        console.log(`⌨️ [KEYBOARD] ${msg.text()}`);
      } else if (msg.type() === 'error') {
        classifiedLogs.errors.push({ ...logEntry, emoji: '❌' });
        console.log(`❌ [ERROR] ${msg.text()}`);
      } else {
        classifiedLogs.general.push({ ...logEntry, emoji: '📝' });
        console.log(`📝 [GENERAL] ${msg.text()}`);
      }
    });

    // Page error monitoring
    const pageErrors = [];
    page.on('pageerror', error => {
      const errorEntry = {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      };
      pageErrors.push(errorEntry);
      console.log(`🔥 [PAGE_ERROR] ${error.message}`);
    });

    // ===== PHASE 1: APPLICATION INITIALIZATION =====
    console.log('🌐 === PHASE 1: APPLICATION INITIALIZATION ===');

    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Focus the page for keyboard events
    await page.evaluate(() => {
      document.documentElement.focus();
      document.body.focus();
    });
    await page.waitForTimeout(500);

    console.log('✅ Application loaded and focused');

    // ===== PHASE 2: DISPLAY CREATION TESTING =====
    console.log('🎯 === PHASE 2: DISPLAY CREATION AND ANALYSIS ===');

    let currentDisplayCount = await page.locator('.floating-display').count();
    console.log(`📊 Initial display count: ${currentDisplayCount}`);

    // Try to create a display via JavaScript evaluation (bypassing prompt())
    console.log('🎯 Attempting to create display programmatically...');

    try {
      // Create display by calling workspace actions directly
      const displayCreated = await page.evaluate(() => {
        if (window.workspaceActions && window.workspaceActions.addDisplay) {
          console.log('[EVAL] Found workspaceActions.addDisplay');
          window.workspaceActions.addDisplay('EURUSD');
          return true;
        }

        // Try accessing through the store
        if (window.workspaceStore) {
          console.log('[EVAL] Found workspaceStore');
          // Try alternative display creation
          return false;
        }

        return false;
      });

      if (displayCreated) {
        console.log('✅ Display created programmatically');
        await page.waitForTimeout(2000);
      } else {
        console.log('⚠️ Could not create display programmatically');
      }
    } catch (error) {
      console.log(`⚠️ Programmatic display creation failed: ${error.message}`);
    }

    // Alternative: Try Alt+A and handle the prompt differently
    console.log('⌨️ Testing Alt+A display creation workflow...');

    // Set up a listener for potential dialogs
    let dialogHandled = false;
    page.on('dialog', async dialog => {
      console.log(`📝 Dialog detected: ${dialog.message()}`);
      try {
        await dialog.accept('EURUSD');
        dialogHandled = true;
        console.log('✅ Dialog handled with EURUSD');
      } catch (error) {
        console.log(`⚠️ Could not handle dialog: ${error.message}`);
      }
    });

    // Press Alt+A to trigger display creation
    await page.keyboard.press('Alt+a');
    await page.waitForTimeout(1500);

    if (dialogHandled) {
      console.log('✅ Alt+A workflow completed via dialog handling');
      await page.waitForTimeout(2000);
    } else {
      console.log('⚠️ No dialog detected - Alt+A might not be working as expected');
    }

    // ===== PHASE 3: DISPLAY ANALYSIS =====
    console.log('🔍 === PHASE 3: DISPLAY AND MARKET PROFILE ANALYSIS ===');

    currentDisplayCount = await page.locator('.floating-display').count();
    console.log(`📊 Display count after creation attempts: ${currentDisplayCount}`);

    if (currentDisplayCount === 0) {
      console.log('⚠️ No displays available - focusing on Market Profile module analysis');

      // Test Market Profile functionality through module inspection
      const marketProfileModules = await page.evaluate(() => {
        const modules = {};

        // Check for market profile related variables/functions
        if (typeof window !== 'undefined') {
          // Look for any global market profile references
          Object.keys(window).forEach(key => {
            if (key.toLowerCase().includes('market') || key.toLowerCase().includes('profile')) {
              modules[key] = typeof window[key];
            }
          });
        }

        return modules;
      });

      console.log('📊 Market Profile related objects found:', marketProfileModules);

    } else {
      console.log(`✅ Found ${currentDisplayCount} display(s) for analysis`);

      // Analyze each display
      for (let i = 0; i < currentDisplayCount; i++) {
        const display = page.locator('.floating-display').nth(i);
        await expect(display).toBeVisible();

        console.log(`📊 === ANALYZING DISPLAY ${i + 1}/${currentDisplayCount} ===`);

        // Check visualization indicator
        try {
          const vizIndicator = display.locator('.viz-indicator');
          if (await vizIndicator.count() > 0) {
            const indicatorText = await vizIndicator.textContent();
            const title = await vizIndicator.getAttribute('title');
            console.log(`  📊 Visualization indicator: "${indicatorText}" (title: "${title}")`);

            // Test if it's Market Profile
            if (indicatorText === 'MP' || title?.includes('Market Profile')) {
              console.log('  ✅ Display shows Market Profile visualization');
            } else {
              console.log(`  📊 Display shows: ${indicatorText || 'Unknown'} visualization`);
            }
          } else {
            console.log('  ⚠️ No visualization indicator found');
          }
        } catch (error) {
          console.log(`  ❌ Error checking visualization indicator: ${error.message}`);
        }

        // Check symbol
        try {
          const symbolElement = display.locator('.symbol');
          if (await symbolElement.count() > 0) {
            const symbol = await symbolElement.first().textContent();
            console.log(`  📊 Symbol: ${symbol}`);
          }
        } catch (error) {
          console.log(`  ⚠️ No symbol found`);
        }

        // Check connection status
        try {
          const connectionStatus = display.locator('.connection-status');
          if (await connectionStatus.count() > 0) {
            const statusClass = await connectionStatus.first().getAttribute('class');
            console.log(`  🔌 Connection status: ${statusClass}`);
          }
        } catch (error) {
          console.log(`  ⚠️ No connection status found`);
        }

        // Test Alt+M on this display (should do nothing)
        console.log(`  ⌨️ Testing Alt+M on display ${i + 1} (should have no effect)`);
        await display.focus();
        await page.waitForTimeout(200);

        const initialVizIndicator = await display.locator('.viz-indicator').textContent().catch(() => null);
        await page.keyboard.press('Alt+m');
        await page.waitForTimeout(500);

        const currentVizIndicator = await display.locator('.viz-indicator').textContent().catch(() => null);

        if (initialVizIndicator === currentVizIndicator) {
          console.log(`  ✅ Alt+M correctly has no effect on display ${i + 1} (Crystal Clarity compliant)`);
        } else {
          console.log(`  ❌ Alt+M changed display from ${initialVizIndicator} to ${currentVizIndicator} (VIOLATION)`);
        }
      }
    }

    // ===== PHASE 4: COMPREHENSIVE CONSOLE ANALYSIS =====
    console.log('📊 === PHASE 4: COMPREHENSIVE CONSOLE ANALYSIS ===');

    const consoleText = consoleMessages.map(msg => msg.text).join('\n');

    // Market Profile Analysis
    console.log(`📊 Market Profile Messages: ${classifiedLogs.marketProfile.length}`);
    if (classifiedLogs.marketProfile.length > 0) {
      console.log('📊 Market Profile Details:');
      classifiedLogs.marketProfile.forEach(msg => {
        console.log(`  - ${msg.text}`);
      });
    }

    // WebSocket Analysis
    console.log(`🔌 WebSocket Messages: ${classifiedLogs.websocket.length}`);
    if (classifiedLogs.websocket.length > 0) {
      console.log('🔌 WebSocket Activity:');
      classifiedLogs.websocket.forEach(msg => {
        console.log(`  - ${msg.text}`);
      });
    }

    // Rendering Analysis
    console.log(`🎨 Rendering Messages: ${classifiedLogs.rendering.length}`);

    // Keyboard Analysis
    console.log(`⌨️ Keyboard Messages: ${classifiedLogs.keyboard.length}`);

    // Error Analysis
    console.log(`❌ Error Messages: ${classifiedLogs.errors.length}`);
    if (classifiedLogs.errors.length > 0) {
      console.log('❌ Error Details:');
      classifiedLogs.errors.forEach(msg => {
        console.log(`  - ${msg.text}`);
      });
    }

    // Page Errors Analysis
    console.log(`🔥 Page Errors: ${pageErrors.length}`);
    if (pageErrors.length > 0) {
      console.log('🔥 Page Error Details:');
      pageErrors.forEach(error => {
        console.log(`  - ${error.message}`);
      });
    }

    // Crystal Clarity Compliance Check
    console.log('🏗️ === CRYSTAL CLARITY COMPLIANCE CHECK ===');

    // Check for Alt+M violations
    const altMMessages = consoleMessages.filter(msg =>
      msg.text.includes('Alt+M') ||
      msg.text.includes('alt+m') ||
      msg.text.includes('marketProfile.*shortcut') ||
      msg.text.includes('toggle.*viz')
    );

    console.log(`🔍 Alt+M related messages: ${altMMessages.length}`);
    if (altMMessages.length === 0) {
      console.log('✅ Crystal Clarity Compliant: No Alt+M specialized shortcuts detected');
    } else {
      console.log('❌ Crystal Clarity Violation: Alt+M related messages found:');
      altMMessages.forEach(msg => console.log(`  - ${msg.text}`));
    }

    // Check for framework compliance
    const frameworkUsage = {
      svelte: consoleText.includes('rendering') || consoleText.includes('component'),
      interactjs: consoleText.includes('drag') || consoleText.includes('move') || consoleText.includes('interact'),
      canvas: consoleText.includes('canvas') || consoleText.includes('context') || consoleText.includes('draw'),
      websocket: consoleText.includes('websocket') || consoleText.includes('connect') || consoleText.includes('socket')
    };

    console.log('🏗️ Framework Usage Analysis:');
    Object.entries(frameworkUsage).forEach(([framework, used]) => {
      console.log(`  ${used ? '✅' : '❌'} ${framework}: ${used ? 'DETECTED' : 'NOT DETECTED'}`);
    });

    // ===== FINAL ASSESSMENT =====
    console.log('🎯 === FINAL MARKET PROFILE SYSTEM ASSESSMENT ===');

    const hasMarketProfileCode = classifiedLogs.marketProfile.length > 0 ||
                                  consoleText.includes('marketProfile') ||
                                  consoleText.includes('Market Profile');

    const hasWorkingDisplays = currentDisplayCount > 0;
    const hasAltMCompliance = altMMessages.length === 0;
    const hasMinimalErrors = pageErrors.length < 5 && classifiedLogs.errors.length < 3;

    console.log(`📊 Market Profile Code: ${hasMarketProfileCode ? 'PRESENT' : 'NOT DETECTED'}`);
    console.log(`🖼️ Working Displays: ${hasWorkingDisplays ? 'YES' : 'NO'}`);
    console.log(`🏗️ Crystal Clarity Compliance: ${hasAltMCompliance ? 'COMPLIANT' : 'VIOLATION'}`);
    console.log(`✅ System Health: ${hasMinimalErrors ? 'HEALTHY' : 'NEEDS ATTENTION'}`);

    // Summary Report
    console.log('📋 === COMPREHENSIVE ANALYSIS SUMMARY ===');
    console.log(`📊 Total Console Messages: ${consoleMessages.length}`);
    console.log(`📊 Market Profile Messages: ${classifiedLogs.marketProfile.length}`);
    console.log(`🔌 WebSocket Activity: ${classifiedLogs.websocket.length}`);
    console.log(`🎨 Rendering Activity: ${classifiedLogs.rendering.length}`);
    console.log(`⌨️ Keyboard Activity: ${classifiedLogs.keyboard.length}`);
    console.log(`❌ Error Count: ${classifiedLogs.errors.length + pageErrors.length}`);
    console.log(`🖼️ Display Count: ${currentDisplayCount}`);
    console.log(`🏗️ Crystal Clarity: ${hasAltMCompliance ? 'COMPLIANT ✅' : 'VIOLATION ❌'}`);

    // Key Findings
    console.log('🔍 === KEY FINDINGS ===');

    if (hasMarketProfileCode) {
      console.log('✅ Market Profile implementation detected in codebase');
    } else {
      console.log('⚠️ No active Market Profile code execution detected');
    }

    if (hasWorkingDisplays) {
      console.log(`✅ ${currentDisplayCount} working display(s) available for testing`);
    } else {
      console.log('⚠️ No displays available - display creation needs verification');
    }

    if (hasAltMCompliance) {
      console.log('✅ Crystal Clarity compliance verified - no Alt+M shortcuts');
    } else {
      console.log('❌ Crystal Clarity violation detected - Alt+M shortcuts present');
    }

    // Final assertions
    expect(hasAltMCompliance).toBe(true); // Must be Crystal Clarity compliant
    expect(pageErrors.length).toBeLessThan(10); // Minimal page errors
    expect(classifiedLogs.errors.length).toBeLessThan(5); // Minimal console errors

    console.log('🎉 Market Profile Comprehensive Analysis: COMPLETED');
  });
});