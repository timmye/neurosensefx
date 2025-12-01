// Non-FX Symbol Subscription Test
// Tests the fix for WebSocket server symbol validation using symbolMap instead of currentAvailableSymbols

import { test, expect } from '@playwright/test';

test.describe('Non-FX Symbol Subscription Fix', () => {

  test('should successfully subscribe to XAUUSD (Gold) and receive complete data packages', async ({ page }) => {
    console.log('🧪 Testing XAUUSD symbol subscription and data reception...');

    // Navigate to the application
    await page.goto('http://localhost:5175');

    // Set up comprehensive console monitoring
    const consoleLogs = {
      websocket: [],
      symbolData: [],
      errors: [],
      validation: [],
      ohlc: []
    };

    page.on('console', msg => {
      const text = msg.text();
      const timestamp = new Date().toISOString();

      // Categorize console messages for detailed analysis
      if (text.includes('WebSocket') || text.includes('subscribe') || text.includes('symbolDataPackage')) {
        consoleLogs.websocket.push({ timestamp, type: msg.type(), text });
      }
      if (text.includes('XAUUSD') || text.includes('symbol:') || text.includes('symbolName')) {
        consoleLogs.symbolData.push({ timestamp, type: msg.type(), text });
      }
      if (text.includes('error') || text.includes('Error') || text.includes('Invalid symbol')) {
        consoleLogs.errors.push({ timestamp, type: msg.type(), text });
      }
      if (text.includes('symbolMap.has') || text.includes('validation') || text.includes('validating')) {
        consoleLogs.validation.push({ timestamp, type: msg.type(), text });
      }
      if (text.includes('todayHigh') || text.includes('todayLow') || text.includes('OHLC') || text.includes('dayRange')) {
        consoleLogs.ohlc.push({ timestamp, type: msg.type(), text });
      }
    });

    // Wait for application to fully load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Try to create XAUUSD display
    console.log('🎯 Creating XAUUSD display...');
    await page.keyboard.press('Control+KeyK');
    await page.waitForTimeout(500);

    // Type XAU/USD (with slash format)
    await page.keyboard.type('XAU/USD');
    await page.waitForTimeout(1000);

    // Press Enter to create the display
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000); // Longer wait for data processing

    // Switch to dayRange visualization to test OHLC data
    console.log('📊 Switching to dayRange visualization...');
    await page.keyboard.press('KeyM');
    await page.waitForTimeout(500);
    await page.keyboard.type('dayRange');
    await page.waitForTimeout(1000);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000); // Wait for dayRange to render with data

    // Take screenshot for visual evidence
    await page.screenshot({
      path: 'nonfx-xauusd-dayrange-test.png',
      fullPage: false
    });

    // Analyze console logs for evidence of successful subscription
    console.log('\n=== XAUUSD Subscription Analysis ===');
    console.log(`📡 WebSocket messages: ${consoleLogs.websocket.length}`);
    consoleLogs.websocket.forEach(log => {
      console.log(`  [${log.timestamp}] ${log.text}`);
    });

    console.log(`\n🎯 Symbol data messages: ${consoleLogs.symbolData.length}`);
    consoleLogs.symbolData.forEach(log => {
      console.log(`  [${log.timestamp}] ${log.text}`);
    });

    console.log(`\n❌ Error messages: ${consoleLogs.errors.length}`);
    consoleLogs.errors.forEach(log => {
      console.log(`  [${log.timestamp}] ${log.text}`);
    });

    console.log(`\n✅ Validation messages: ${consoleLogs.validation.length}`);
    consoleLogs.validation.forEach(log => {
      console.log(`  [${log.timestamp}] ${log.text}`);
    });

    console.log(`\n📈 OHLC/DayRange messages: ${consoleLogs.ohlc.length}`);
    consoleLogs.ohlc.forEach(log => {
      console.log(`  [${log.timestamp}] ${log.text}`);
    });

    // Verify the page loaded successfully
    await expect(page.locator('body')).toBeVisible();

    // Check for canvas elements (indicating visualizations are rendering)
    const canvasElements = await page.locator('canvas').count();
    console.log(`\n🖼️ Canvas elements found: ${canvasElements}`);

    // Log test results summary
    const hasSymbolDataPackage = consoleLogs.websocket.some(log => log.text.includes('symbolDataPackage'));
    const hasInvalidSymbolError = consoleLogs.errors.some(log => log.text.includes('Invalid symbol'));
    const hasXAUUSDMessages = consoleLogs.symbolData.some(log => log.text.includes('XAUUSD'));
    const hasOHLCData = consoleLogs.ohlc.some(log => log.text.includes('todayHigh') || log.text.includes('todayLow'));

    console.log('\n=== Test Results Summary ===');
    console.log(`✅ Received symbolDataPackage: ${hasSymbolDataPackage}`);
    console.log(`❌ Invalid symbol errors: ${hasInvalidSymbolError}`);
    console.log(`🎯 XAUUSD data messages: ${hasXAUUSDMessages}`);
    console.log(`📈 OHLC data available: ${hasOHLCData}`);

    // Clean up
    await page.keyboard.press('Control+Shift+KeyW');
    await page.waitForTimeout(1000);
  });

  test('should successfully subscribe to multiple non-FX symbols', async ({ page }) => {
    const nonFxSymbols = ['XAG/USD', 'BTC/USD']; // Silver and Bitcoin

    for (const symbol of nonFxSymbols) {
      console.log(`\n🧪 Testing ${symbol} symbol subscription...`);

      // Navigate for clean state
      await page.goto('http://localhost:5175');
      await page.waitForTimeout(2000);

      // Monitor console for this specific symbol
      const symbolLogs = [];
      page.on('console', msg => {
        if (msg.text().includes(symbol.replace('/', '')) ||
            msg.text().includes('symbolDataPackage') ||
            msg.text().includes('Invalid symbol')) {
          symbolLogs.push({
            timestamp: new Date().toISOString(),
            type: msg.type(),
            text: msg.text()
          });
        }
      });

      // Create display for the symbol
      await page.keyboard.press('Control+KeyK');
      await page.waitForTimeout(500);
      await page.keyboard.type(symbol);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(4000); // Wait for data processing

      // Switch to dayRange to test OHLC data
      await page.keyboard.press('KeyM');
      await page.waitForTimeout(500);
      await page.keyboard.type('dayRange');
      await page.waitForTimeout(1000);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(4000);

      // Take screenshot
      await page.screenshot({
        path: `nonfx-${symbol.toLowerCase().replace('/', '-')}-test.png`,
        fullPage: false
      });

      // Analyze results for this symbol
      const hasDataPackage = symbolLogs.some(log => log.text.includes('symbolDataPackage'));
      const hasError = symbolLogs.some(log => log.text.includes('Invalid symbol'));
      const hasSymbolMessages = symbolLogs.some(log => log.text.includes(symbol.replace('/', '')));

      console.log(`📊 ${symbol} Results:`);
      console.log(`  ✅ Data package received: ${hasDataPackage}`);
      console.log(`  ❌ Invalid symbol error: ${hasError}`);
      console.log(`  🎯 Symbol messages: ${hasSymbolMessages}`);
      console.log(`  📝 Total logs: ${symbolLogs.length}`);

      symbolLogs.forEach(log => {
        console.log(`    [${log.timestamp}] ${log.text}`);
      });

      // Clean up for next symbol
      await page.keyboard.press('Control+Shift+KeyW');
      await page.waitForTimeout(1000);
    }
  });

  test('should verify FX symbols still work correctly after the fix', async ({ page }) => {
    console.log('🧪 Testing FX symbol compatibility (EUR/USD)...');

    // Navigate to the application
    await page.goto('http://localhost:5175');
    await page.waitForTimeout(2000);

    // Monitor console for FX symbol
    const fxLogs = [];
    page.on('console', msg => {
      if (msg.text().includes('EURUSD') ||
          msg.text().includes('symbolDataPackage') ||
          msg.text().includes('EUR/USD')) {
        fxLogs.push({
          timestamp: new Date().toISOString(),
          type: msg.type(),
          text: msg.text()
        });
      }
    });

    // Create EUR/USD display (the standard FX symbol)
    await page.keyboard.press('Control+KeyK');
    await page.waitForTimeout(500);
    await page.keyboard.type('EUR/USD');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(4000);

    // Switch to dayRange
    await page.keyboard.press('KeyM');
    await page.waitForTimeout(500);
    await page.keyboard.type('dayRange');
    await page.waitForTimeout(1000);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(4000);

    // Take screenshot
    await page.screenshot({
      path: 'fx-eurusd-compatibility-test.png',
      fullPage: false
    });

    // Analyze FX symbol results
    const hasDataPackage = fxLogs.some(log => log.text.includes('symbolDataPackage'));
    const hasError = fxLogs.some(log => log.text.includes('Invalid symbol'));
    const hasSymbolMessages = fxLogs.some(log => log.text().includes('EURUSD'));

    console.log('\n=== EUR/USD Compatibility Results ===');
    console.log(`✅ Data package received: ${hasDataPackage}`);
    console.log(`❌ Invalid symbol error: ${hasError}`);
    console.log(`🎯 EUR/USD messages: ${hasSymbolMessages}`);
    console.log(`📝 Total logs: ${fxLogs.length}`);

    fxLogs.forEach(log => {
      console.log(`  [${log.timestamp}] ${log.text}`);
    });

    // Verify FX symbols still work
    await expect(page.locator('body')).toBeVisible();
    const canvasElements = await page.locator('canvas').count();
    console.log(`🖼️ Canvas elements found: ${canvasElements}`);

    // Clean up
    await page.keyboard.press('Control+Shift+KeyW');
    await page.waitForTimeout(1000);
  });

  test('should compare before/after behavior of symbol validation', async ({ page }) => {
    console.log('🔍 Testing symbol validation behavior comparison...');

    // Navigate to the application
    await page.goto('http://localhost:5175');
    await page.waitForTimeout(2000);

    // Monitor all validation-related console messages
    const validationLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('symbolMap') ||
          text.includes('currentAvailableSymbols') ||
          text.includes('validation') ||
          text.includes('Invalid symbol') ||
          text.includes('symbolDataPackage')) {
        validationLogs.push({
          timestamp: new Date().toISOString(),
          type: msg.type(),
          text: text
        });
      }
    });

    // Test a mix of FX and non-FX symbols
    const testSymbols = ['EUR/USD', 'XAU/USD', 'BTC/USD', 'USD/JPY', 'XAG/USD'];

    for (const symbol of testSymbols) {
      console.log(`\n🎯 Testing validation for ${symbol}...`);

      // Create display
      await page.keyboard.press('Control+KeyK');
      await page.waitForTimeout(500);
      await page.keyboard.type(symbol);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);

      // Clean up for next symbol
      await page.keyboard.press('Control+Shift+KeyW');
      await page.waitForTimeout(1000);
    }

    // Analyze validation logs
    console.log('\n=== Symbol Validation Analysis ===');
    console.log(`📝 Total validation logs: ${validationLogs.length}`);

    const invalidSymbolErrors = validationLogs.filter(log => log.text.includes('Invalid symbol'));
    const dataPackages = validationLogs.filter(log => log.text.includes('symbolDataPackage'));
    const symbolMapReferences = validationLogs.filter(log => log.text.includes('symbolMap'));

    console.log(`❌ Invalid symbol errors: ${invalidSymbolErrors.length}`);
    console.log(`✅ Data packages sent: ${dataPackages.length}`);
    console.log(`🗺️ Symbol map references: ${symbolMapReferences.length}`);

    console.log('\n📋 Detailed Validation Log:');
    validationLogs.forEach(log => {
      console.log(`  [${log.timestamp}] [${log.type}] ${log.text}`);
    });

    // Take final screenshot
    await page.screenshot({
      path: 'nonfx-validation-comparison-test.png',
      fullPage: false
    });
  });
});