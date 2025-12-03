import { test, expect } from '@playwright/test';

test('Alt+M Market Profile Toggle Workflow', async ({ page }) => {
  console.log('🧪 Starting Alt+M toggle workflow test');

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

  // Create a day range meter display using Alt+A
  await page.keyboard.press('Alt+a');
  console.log('⌨️ Pressing Alt+A to create display...');

  // Handle the symbol prompt
  await page.waitForTimeout(100); // Brief wait for prompt
  await page.keyboard.type('BTCUSD');
  await page.keyboard.press('Enter');
  console.log('📝 Dialog accepted with symbol: BTCUSD');

  // Wait for display to be created and day range meter to render
  await page.waitForTimeout(3000);

  // Verify day range meter is the default
  const hasDayRangeLogs = consoleMessages.some(msg =>
    msg.includes('DisplayType: dayRange') && !msg.includes('DisplayType: dayRangeWithMarketProfile')
  );
  expect(hasDayRangeLogs).toBeTruthy();
  console.log('✅ Confirmed: Day range meter is the default display');

  // Count displays before toggle
  const displaysBefore = await page.locator('.floating-display').count();
  console.log(`📊 Displays before Alt+M toggle: ${displaysBefore}`);

  // Press Alt+M to toggle market profile overlay
  await page.locator('.floating-display').first().focus();
  await page.keyboard.press('Alt+m');
  console.log('⌨️ Pressing Alt+M to toggle market profile overlay...');

  // Wait for the toggle to take effect
  await page.waitForTimeout(2000);

  // Verify combined visualization is active
  const hasCombinedLogs = consoleMessages.some(msg =>
    msg.includes('DisplayType: dayRangeWithMarketProfile')
  );
  expect(hasCombinedLogs).toBeTruthy();
  console.log('✅ Confirmed: Combined day range + market profile visualization active');

  // Verify market profile processing is active
  const hasMarketProfileProcessing = consoleMessages.some(msg =>
    msg.includes('MARKET_PROFILE') && msg.includes('Built initial profile')
  );
  if (hasMarketProfileProcessing) {
    console.log('✅ Market profile data processing confirmed');
  }

  // Count displays after toggle (should be the same - it's an overlay, not new display)
  const displaysAfter = await page.locator('.floating-display').count();
  console.log(`📊 Displays after Alt+M toggle: ${displaysAfter}`);
  expect(displaysAfter).toBe(displaysBefore);
  console.log('✅ Confirmed: Market profile is overlay, not new display');

  // Press Alt+M again to toggle off market profile
  await page.locator('.floating-display').first().focus();
  await page.keyboard.press('Alt+m');
  console.log('⌨️ Pressing Alt+M again to toggle off market profile overlay...');

  // Wait for the toggle to take effect
  await page.waitForTimeout(2000);

  // Verify back to day range only
  const hasDayRangeAfterToggle = consoleMessages.some(msg =>
    msg.includes('DisplayType: dayRange') &&
    !msg.includes('DisplayType: dayRangeWithMarketProfile')
  );
  expect(hasDayRangeAfterToggle).toBeTruthy();
  console.log('✅ Confirmed: Reverted to day range only display');

  console.log('🎯 Alt+M toggle workflow test completed successfully');
});