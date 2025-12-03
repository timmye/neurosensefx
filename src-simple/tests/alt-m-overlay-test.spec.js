import { test, expect } from '@playwright/test';

test('Alt+M Market Profile Overlay - Bug Fix Verification', async ({ page }) => {
  console.log('🧪 Starting Alt+M overlay bug fix verification test');

  // Navigate to the application
  await page.goto('http://localhost:5175');
  console.log('✅ Navigated to localhost:5175');

  // Wait for workspace to load
  await page.waitForSelector('.workspace', { timeout: 5000 });
  console.log('✅ Workspace loaded');

  // Listen for console events
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push(msg.text());
    console.log('[LOG]', msg.text());
  });

  // Step 1: Create a day range meter display
  await page.keyboard.press('Alt+a');
  await page.waitForTimeout(100);
  await page.keyboard.type('BTCUSD');
  await page.keyboard.press('Enter');
  console.log('📝 Created BTCUSD display');

  // Wait for display to be created and day range meter to render
  await page.waitForTimeout(3000);

  // Verify day range meter is rendering
  const hasDayRangeLogs = consoleMessages.some(msg =>
    msg.includes('DisplayType: dayRange') &&
    msg.includes('Got renderer: true for display type: dayRange')
  );
  expect(hasDayRangeLogs).toBeTruthy();
  console.log('✅ Day range meter confirmed as rendering');

  // Count displays
  const displaysBefore = await page.locator('.floating-display').count();
  console.log(`📊 Displays created: ${displaysBefore}`);

  // Step 2: Press Alt+M to toggle market profile overlay
  await page.locator('.floating-display').first().focus();
  await page.keyboard.press('Alt+m');
  console.log('⌨️ Pressing Alt+M to toggle market profile overlay...');

  // Wait for the toggle to take effect
  await page.waitForTimeout(2000);

  // Step 3: Verify the fix - should see combined renderer being called
  const hasCombinedRendererLogs = consoleMessages.some(msg =>
    msg.includes('DisplayType: dayRangeWithMarketProfile')
  );
  expect(hasCombinedRendererLogs).toBeTruthy();
  console.log('✅ Display type changed to combined visualization');

  // Verify the special handling is working
  const hasCombinedRendererCall = consoleMessages.some(msg =>
    msg.includes('Got combined renderer: true for display type: dayRangeWithMarketProfile')
  );
  expect(hasCombinedRendererCall).toBeTruthy();
  console.log('✅ Combined renderer being called');

  // Verify it's calling with market data
  const hasMarketDataCall = consoleMessages.some(msg =>
    msg.includes('Calling combined renderer with market data')
  );
  expect(hasMarketDataCall).toBeTruthy();
  console.log('✅ Combined renderer receiving market data');

  // Verify combined renderer completed successfully
  const hasCombinedSuccess = consoleMessages.some(msg =>
    msg.includes('Combined renderer completed successfully')
  );
  expect(hasCombinedSuccess).toBeTruthy();
  console.log('✅ Combined renderer completing successfully');

  // Count displays after toggle (should be same - it's an overlay)
  const displaysAfter = await page.locator('.floating-display').count();
  expect(displaysAfter).toBe(displaysBefore);
  console.log('✅ Confirmed: Market profile is overlay, not new display');

  // Step 4: Verify no "WAITING FOR DATA" message
  const hasWaitingMessage = consoleMessages.some(msg =>
    msg.includes('WAITING FOR DATA') && msg.includes('DisplayType: dayRangeWithMarketProfile')
  );
  expect(hasWaitingMessage).toBeFalsy();
  console.log('✅ No waiting for data message with combined visualization');

  console.log('🎯 Alt+M overlay bug fix verification completed successfully');
});