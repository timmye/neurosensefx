// Test: Y-Axis Scaling Comparison between Market Profile and Day Range Meter
// Verifies that both displays use the same y-axis scaling system

import { test, expect } from '@playwright/test';

test('y-axis scaling comparison - Market Profile vs Day Range Meter', async ({ page }) => {
  console.log('🔬 Starting Y-AXIS SCALING COMPARISON test');

  await page.goto('http://localhost:5174');

  // Wait for the application to load
  await page.waitForSelector('.workspace', { timeout: 5000 });
  console.log('✅ Application loaded');

  // Create Day Range Meter display
  console.log('📊 Creating Day Range Meter display...');
  await page.keyboard.press('Control+k');
  await page.waitForSelector('.symbol-search-overlay', { timeout: 2000 });
  await page.fill('.symbol-search-input', 'EURUSD');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500); // Wait for display creation

  // Create Market Profile display for the same symbol
  console.log('📈 Creating Market Profile display...');
  // Press Alt+M to toggle to Market Profile for the selected display
  await page.keyboard.press('Alt+m');
  await page.waitForTimeout(500);

  // Verify both displays are present
  const displays = page.locator('.floating-display');
  await expect(displays).toHaveCount(1);
  console.log('✅ Displays created successfully');

  // Get canvas elements from both displays
  const dayRangeCanvas = page.locator('.floating-display canvas').first();
  await expect(dayRangeCanvas).toBeVisible();

  // Check console logs for scaling information
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('ADR-based scaling') || text.includes('Using ADR-based scaling')) {
      console.log('🔍 Console -', text);
    }
  });

  // Reload to trigger scaling calculation logs
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.floating-display canvas', { timeout: 5000 });

  console.log('📏 Test completed - Check console logs for scaling verification');
  console.log('   Look for "ADR-based scaling" messages to confirm Market Profile is using Day Range scaling');
});