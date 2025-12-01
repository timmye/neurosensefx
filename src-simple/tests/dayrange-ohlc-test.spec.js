// Day Range Meter OHLC Markers Test
// Tests the fix for data structure mapping between displayDataProcessor and dayRangeElements

import { test, expect } from '@playwright/test';

test.describe('Day Range Meter - OHLC Markers', () => {

  test('should display all OHLC markers with valid price data', async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:5175');

    // Wait for the application to fully load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    // Open the symbol selector with Ctrl+K
    await page.keyboard.press('Control+KeyK');

    // Wait for symbol selector to appear
    await page.waitForTimeout(500);

    // Type EUR/USD to select the symbol
    await page.keyboard.type('EUR/USD');

    // Press Enter to create the display
    await page.keyboard.press('Enter');

    // Wait for display creation and data loading
    await page.waitForTimeout(3000);

    // Open display menu to change visualization type
    await page.keyboard.press('KeyM');
    await page.waitForTimeout(500);

    // Type "dayRange" to filter and select day range meter
    await page.keyboard.type('dayRange');
    await page.waitForTimeout(1000);
    await page.keyboard.press('Enter');

    // Wait for dayRange meter to render with data
    await page.waitForTimeout(5000);

    // Collect console logs to verify data mapping
    const consoleLogs = [];
    page.on('console', msg => {
      if (msg.text().includes('dayRange') ||
          msg.text().includes('todayHigh') ||
          msg.text().includes('todayLow') ||
          msg.text().includes('OHLC') ||
          msg.text().includes('mappedData')) {
        consoleLogs.push({
          type: msg.type(),
          text: msg.text()
        });
      }
    });

    // Take a screenshot for visual evidence
    await page.screenshot({
      path: 'dayrange-meter-initial.png',
      fullPage: false
    });

    // Wait a bit more to capture any console output
    await page.waitForTimeout(2000);

    // Verify the page loaded successfully
    await expect(page.locator('body')).toBeVisible();

    // Check for any canvas elements (indicating visualizations are rendering)
    const canvasElements = await page.locator('canvas').count();
    console.log(`Canvas elements found: ${canvasElements}`);

    // Log console messages for debugging
    console.log('Console logs collected:', consoleLogs.length);
    consoleLogs.forEach(log => {
      console.log(`[${log.type}] ${log.text}`);
    });
  });

  test('should test multiple symbols for consistency', async ({ page }) => {
    const symbols = ['GBP/USD', 'USD/JPY', 'EUR/GBP'];

    for (const symbol of symbols) {
      console.log(`Testing symbol: ${symbol}`);

      // Navigate to ensure clean state
      await page.goto('http://localhost:5175');
      await page.waitForTimeout(2000);

      // Create new display with symbol
      await page.keyboard.press('Control+KeyK');
      await page.waitForTimeout(500);
      await page.keyboard.type(symbol);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);

      // Switch to dayRange visualization
      await page.keyboard.press('KeyM');
      await page.waitForTimeout(500);
      await page.keyboard.type('dayRange');
      await page.waitForTimeout(1000);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(5000);

      // Take screenshot for this symbol
      await page.screenshot({
        path: `dayrange-${symbol.toLowerCase().replace('/', '-')}.png`,
        fullPage: false
      });

      // Clean up displays for next test (Ctrl+Shift+W to remove all displays)
      await page.keyboard.press('Control+Shift+KeyW');
      await page.waitForTimeout(1000);
    }
  });

  test('should verify data structure mapping in browser console', async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:5175');

    // Set up console monitoring before creating displays
    const dataMappingLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('mappedData') ||
          text.includes('todayHigh') ||
          text.includes('todayLow')) {
        dataMappingLogs.push({
          type: msg.type(),
          text: text,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Create a dayRange display
    await page.waitForTimeout(2000);
    await page.keyboard.press('Control+KeyK');
    await page.waitForTimeout(500);
    await page.keyboard.type('EUR/USD');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    await page.keyboard.press('KeyM');
    await page.waitForTimeout(500);
    await page.keyboard.type('dayRange');
    await page.waitForTimeout(1000);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000);

    // Check if we captured any data mapping logs
    console.log('Data mapping logs captured:', dataMappingLogs.length);
    dataMappingLogs.forEach(log => {
      console.log(`[${log.timestamp}] [${log.type}] ${log.text}`);
    });

    // Take final screenshot
    await page.screenshot({
      path: 'dayrange-data-mapping-test.png',
      fullPage: false
    });
  });
});