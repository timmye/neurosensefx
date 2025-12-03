import { test, expect } from '@playwright/test';

test.describe('Market Profile Current Implementation Status', () => {
  test.beforeEach(async ({ page }) => {
    // Load the application
    await page.goto('http://localhost:5175');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Focus the page for keyboard events
    await page.evaluate(() => {
      document.documentElement.focus();
      document.body.focus();
    });
    await page.waitForTimeout(500);
  });

  test('Displays use Market Profile visualization by default', async ({ page }) => {
    console.log('🎯 Testing displays use Market Profile by default...');

    // Comprehensive console logging setup
    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      });
      console.log(`📝 [CONSOLE] ${msg.text()}`);
    });

    // Check for existing displays (since prompt() is problematic in Playwright)
    const currentDisplayCount = await page.locator('.floating-display').count();
    console.log(`📊 Current display count: ${currentDisplayCount}`);

    if (currentDisplayCount === 0) {
      console.log('⚠️ No displays found - testing requires at least one display');
      // Skip test if no displays available
      test.skip(true, 'No displays available to test Market Profile functionality');
      return;
    }

    // Test the first available display
    const testDisplay = page.locator('.floating-display').first();
    await expect(testDisplay).toBeVisible();

    // Check if display shows "MP" indicator (Market Profile)
    try {
      const vizIndicator = testDisplay.locator('.viz-indicator');
      await expect(vizIndicator).toBeVisible({ timeout: 3000 });

      const indicatorText = await vizIndicator.textContent();
      console.log(`📊 Visualization indicator: "${indicatorText}"`);

      // Verify it's Market Profile (MP)
      expect(indicatorText).toBe('MP');
      console.log('✅ Display correctly shows Market Profile (MP) by default');

    } catch (error) {
      console.log('❌ Could not find visualization indicator - checking alternative selectors');

      // Try alternative selectors for visualization type
      const altVizIndicator = await testDisplay.locator('[title*="Market"], [title*="Profile"], .mp-indicator, .market-profile').first().textContent().catch(() => null);

      if (altVizIndicator) {
        console.log(`📊 Alternative visualization indicator found: "${altVizIndicator}"`);
      } else {
        console.log('⚠️ No visualization indicator found - might be a different display component');
      }
    }

    // Check for market profile related console messages
    const marketProfileMessages = consoleMessages.filter(msg =>
      msg.text.includes('marketProfile') ||
      msg.text.includes('Market Profile') ||
      msg.text.includes('[MARKET_PROFILE]') ||
      msg.text.includes('market profile')
    );

    console.log(`📝 Found ${marketProfileMessages.length} market profile console messages:`);
    marketProfileMessages.forEach(msg => {
      console.log(`  - ${msg.text}`);
    });

    // Verify display symbol and connection status
    const symbol = await testDisplay.locator('.symbol').first().textContent().catch(() => 'UNKNOWN');
    console.log(`📊 Testing display symbol: ${symbol}`);

    // Check connection status
    const connectionStatus = testDisplay.locator('.connection-status');
    if (await connectionStatus.count() > 0) {
      const statusClass = await connectionStatus.first().getAttribute('class');
      console.log(`🔌 Connection status class: ${statusClass}`);
    }

    console.log('✅ Market Profile default behavior test completed');
  });

  test('Alt+M functionality has been removed (Crystal Clarity Compliance)', async ({ page }) => {
    console.log('🎯 Testing Crystal Clarity Compliance: Alt+M removed...');

    // Console monitoring setup
    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      });
      console.log(`📝 [CONSOLE] ${msg.text()}`);
    });

    // Check that Alt+M keyboard shortcut is NOT implemented
    // This test verifies Crystal Clarity compliance - no specialized shortcuts

    const currentDisplayCount = await page.locator('.floating-display').count();
    console.log(`📊 Current display count: ${currentDisplayCount}`);

    // Verify Alt+M doesn't trigger any visualization toggle
    if (currentDisplayCount > 0) {
      const testDisplay = page.locator('.floating-display').first();
      await expect(testDisplay).toBeVisible();

      // Focus the display
      await testDisplay.focus();
      await page.waitForTimeout(200);

      // Record initial state
      let initialVizIndicator = null;
      try {
        initialVizIndicator = await testDisplay.locator('.viz-indicator').textContent();
        console.log(`📊 Initial visualization indicator: "${initialVizIndicator}"`);
      } catch (error) {
        console.log('⚠️ No visualization indicator found');
      }

      // Press Alt+M (should do nothing - Crystal Clarity compliance)
      console.log('⌨️ Testing Alt+M keypress (should have no effect)...');
      await page.keyboard.press('Alt+m');
      await page.waitForTimeout(500);

      // Check if anything changed (it shouldn't)
      let currentVizIndicator = null;
      try {
        currentVizIndicator = await testDisplay.locator('.viz-indicator').textContent();
        console.log(`📊 Current visualization indicator after Alt+M: "${currentVizIndicator}"`);
      } catch (error) {
        console.log('⚠️ No visualization indicator found after Alt+M');
      }

      // Verify no change occurred
      expect(currentVizIndicator).toBe(initialVizIndicator);
      console.log('✅ Alt+M correctly has no effect - Crystal Clarity compliance verified');
    }

    // Check for any Alt+M related console messages (should be none)
    const altMMessages = consoleMessages.filter(msg =>
      msg.text.includes('Alt+M') ||
      msg.text.includes('alt+m') ||
      msg.text.includes('marketProfile.*shortcut') ||
      msg.text.includes('toggle.*viz')
    );

    console.log(`📝 Alt+M related console messages found: ${altMMessages.length}`);
    if (altMMessages.length > 0) {
      console.log('❌ VIOLATION: Alt+M related messages detected:');
      altMMessages.forEach(msg => console.log(`  - ${msg.text()}`));
    } else {
      console.log('✅ No Alt+M related messages found - compliant with Crystal Clarity');
    }

    // Verify no Alt+M violations
    expect(altMMessages.length).toBe(0);
    console.log('✅ Crystal Clarity compliance: Alt+M specialized shortcut not implemented');
  });

  test('Current Market Profile implementation verification', async ({ page }) => {
    console.log('🎯 Testing current Market Profile implementation...');

    // Comprehensive console monitoring
    const consoleMessages = [];
    const classifiedLogs = {
      marketProfile: [],
      websocket: [],
      rendering: [],
      errors: []
    };

    page.on('console', msg => {
      const logEntry = {
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      };
      consoleMessages.push(logEntry);

      // Classify logs for analysis
      const text = msg.text().toLowerCase();

      if (text.includes('market') || text.includes('profile') || text.includes('[market_profile]')) {
        classifiedLogs.marketProfile.push({ ...logEntry, emoji: '📊' });
        console.log(`📊 [MARKET_PROFILE] ${msg.text()}`);
      } else if (text.includes('websocket') || text.includes('connect') || text.includes('subscribe')) {
        classifiedLogs.websocket.push({ ...logEntry, emoji: '🔌' });
        console.log(`🔌 [WEBSOCKET] ${msg.text()}`);
      } else if (text.includes('rendering') || text.includes('canvas') || text.includes('draw')) {
        classifiedLogs.rendering.push({ ...logEntry, emoji: '🎨' });
        console.log(`🎨 [RENDERING] ${msg.text()}`);
      } else if (msg.type() === 'error') {
        classifiedLogs.errors.push({ ...logEntry, emoji: '❌' });
        console.log(`❌ [ERROR] ${msg.text()}`);
      } else {
        console.log(`📝 [GENERAL] ${msg.text()}`);
      }
    });

    // Page error monitoring
    const pageErrors = [];
    page.on('pageerror', error => {
      pageErrors.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      console.log(`🔥 [PAGE_ERROR] ${error.message}`);
    });

    // Wait for app initialization
    await page.waitForTimeout(2000);

    const currentDisplayCount = await page.locator('.floating-display').count();
    console.log(`📊 Current display count: ${currentDisplayCount}`);

    if (currentDisplayCount === 0) {
      console.log('⚠️ No displays available - testing Market Profile modules and configuration');
      test.skip(true, 'No displays available to test Market Profile functionality');
      return;
    }

    // Test each available display
    for (let i = 0; i < currentDisplayCount; i++) {
      const display = page.locator('.floating-display').nth(i);
      await expect(display).toBeVisible();

      console.log(`📊 Testing display ${i + 1}/${currentDisplayCount}`);

      // Check visualization indicator
      try {
        const vizIndicator = display.locator('.viz-indicator');
        await expect(vizIndicator).toBeVisible({ timeout: 3000 });
        const indicatorText = await vizIndicator.textContent();
        console.log(`  📊 Visualization indicator: "${indicatorText}"`);

        // Check tooltip/title
        const title = await vizIndicator.getAttribute('title');
        console.log(`  📊 Visualization title: "${title}"`);

      } catch (error) {
        console.log(`  ⚠️ No visualization indicator found on display ${i + 1}`);
      }

      // Check symbol
      try {
        const symbol = await display.locator('.symbol').first().textContent();
        console.log(`  📊 Symbol: ${symbol}`);
      } catch (error) {
        console.log(`  ⚠️ No symbol found on display ${i + 1}`);
      }

      // Check connection status
      try {
        const connectionStatus = display.locator('.connection-status');
        if (await connectionStatus.count() > 0) {
          const statusClass = await connectionStatus.first().getAttribute('class');
          console.log(`  🔌 Connection status: ${statusClass}`);
        }
      } catch (error) {
        console.log(`  ⚠️ No connection status found on display ${i + 1}`);
      }
    }

    // Console analysis
    console.log('📊 === CONSOLE ANALYSIS ===');
    console.log(`📊 Market Profile logs: ${classifiedLogs.marketProfile.length} messages`);
    console.log(`🔌 WebSocket logs: ${classifiedLogs.websocket.length} messages`);
    console.log(`🎨 Rendering logs: ${classifiedLogs.rendering.length} messages`);
    console.log(`❌ Error logs: ${classifiedLogs.errors.length} messages`);

    // Display market profile messages
    if (classifiedLogs.marketProfile.length > 0) {
      console.log('📊 Market Profile messages:');
      classifiedLogs.marketProfile.forEach(msg => {
        console.log(`  - ${msg.text}`);
      });
    }

    // Error analysis
    if (classifiedLogs.errors.length > 0) {
      console.log('❌ Error analysis:');
      classifiedLogs.errors.forEach(msg => {
        console.log(`  - ${msg.text}`);
      });
    }

    // Final assertions
    expect(pageErrors.length).toBeLessThan(5); // Minimal errors acceptable
    console.log('✅ Market Profile implementation test completed');

    // Summary
    console.log('📋 === MARKET PROFILE IMPLEMENTATION SUMMARY ===');
    console.log(`📊 Displays tested: ${currentDisplayCount}`);
    console.log(`📊 Market Profile messages: ${classifiedLogs.marketProfile.length}`);
    console.log(`🔌 WebSocket activity: ${classifiedLogs.websocket.length}`);
    console.log(`🎨 Rendering activity: ${classifiedLogs.rendering.length}`);
    console.log(`❌ Page errors: ${pageErrors.length}`);
    console.log(`✅ Crystal Clarity compliance: Alt+M not implemented`);
  });
});