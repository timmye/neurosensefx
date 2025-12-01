// Symbol Formatting Investigation Test
// Tests price formatting across different symbol types to identify decimal precision issues

import { test, expect } from '@playwright/test';

test.describe('Symbol Price Formatting Investigation', () => {

  test.beforeEach(async ({ page }) => {
    // Set up comprehensive console monitoring to capture price formatting calls
    page.on('console', msg => {
      const text = msg.text();

      // Focus on price formatting and pipPosition related logs
      if (text.includes('formatPrice') ||
          text.includes('pipPosition') ||
          text.includes('toFixed') ||
          text.includes('digits') ||
          text.includes('decimal') ||
          text.includes('Rendering') ||
          text.includes('Symbol:') ||
          text.includes('BACKEND_ERROR') ||
          text.includes('symbolDataPackage') ||
          text.includes('tick')) {
        console.log(`🔍 [${msg.type().toUpperCase()}] ${text}`);
      }
    });

    // Monitor network requests for WebSocket data
    page.on('request', request => {
      if (request.url().includes('ws') || request.url().includes('socket')) {
        console.log(`🌐 Request: ${request.url()}`);
      }
    });
  });

  test('should investigate USD/JPY formatting (should show 3 decimals, not 5)', async ({ page }) => {
    console.log('\n📊 Testing USD/JPY - Expected: 3 decimal places');

    await page.goto('http://localhost:5175');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Create USD/JPY display
    await page.keyboard.press('Control+KeyK');
    await page.waitForTimeout(500);
    await page.keyboard.type('USD/JPY');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(4000);

    // Switch to dayRange visualization to see price formatting
    await page.keyboard.press('KeyM');
    await page.waitForTimeout(500);
    await page.keyboard.type('dayRange');
    await page.waitForTimeout(1000);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000);

    // Take screenshot for visual evidence
    await page.screenshot({
      path: 'test-results/usdjpy-formatting.png',
      fullPage: false
    });

    // Wait for any additional console output
    await page.waitForTimeout(2000);

    console.log('✅ USD/JPY test completed - check screenshot for decimal places');
  });

  test('should investigate XAUUSD formatting (Gold - should show 2-3 decimals, not 5)', async ({ page }) => {
    console.log('\n🥇 Testing XAUUSD - Expected: 2-3 decimal places');

    await page.goto('http://localhost:5175');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Create XAUUSD display
    await page.keyboard.press('Control+KeyK');
    await page.waitForTimeout(500);
    await page.keyboard.type('XAUUSD');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(4000);

    // Switch to dayRange visualization
    await page.keyboard.press('KeyM');
    await page.waitForTimeout(500);
    await page.keyboard.type('dayRange');
    await page.waitForTimeout(1000);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000);

    // Take screenshot for visual evidence
    await page.screenshot({
      path: 'test-results/xauusd-formatting.png',
      fullPage: false
    });

    await page.waitForTimeout(2000);
    console.log('✅ XAUUSD test completed - check screenshot for decimal places');
  });

  test('should investigate BTCUSD formatting (Bitcoin - should show 2-4 decimals, not 5)', async ({ page }) => {
    console.log('\n₿ Testing BTCUSD - Expected: 2-4 decimal places for readability');

    await page.goto('http://localhost:5175');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Create BTCUSD display
    await page.keyboard.press('Control+KeyK');
    await page.waitForTimeout(500);
    await page.keyboard.type('BTCUSD');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(4000);

    // Switch to dayRange visualization
    await page.keyboard.press('KeyM');
    await page.waitForTimeout(500);
    await page.keyboard.type('dayRange');
    await page.waitForTimeout(1000);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000);

    // Take screenshot for visual evidence
    await page.screenshot({
      path: 'test-results/btcusd-formatting.png',
      fullPage: false
    });

    await page.waitForTimeout(2000);
    console.log('✅ BTCUSD test completed - check screenshot for decimal places');
  });

  test('should investigate standard FX pair formatting (EUR/USD - should show 5 decimals)', async ({ page }) => {
    console.log('\n💱 Testing EUR/USD - Expected: 5 decimal places (baseline)');

    await page.goto('http://localhost:5175');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Create EUR/USD display
    await page.keyboard.press('Control+KeyK');
    await page.waitForTimeout(500);
    await page.keyboard.type('EUR/USD');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(4000);

    // Switch to dayRange visualization
    await page.keyboard.press('KeyM');
    await page.waitForTimeout(500);
    await page.keyboard.type('dayRange');
    await page.waitForTimeout(1000);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000);

    // Take screenshot for baseline comparison
    await page.screenshot({
      path: 'test-results/eurusd-formatting.png',
      fullPage: false
    });

    await page.waitForTimeout(2000);
    console.log('✅ EUR/USD test completed - baseline for 5 decimal places');
  });

  test('should investigate another JPY pair (GBP/JPY - should show 3 decimals)', async ({ page }) => {
    console.log('\n💱 Testing GBP/JPY - Expected: 3 decimal places');

    await page.goto('http://localhost:5175');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Create GBP/JPY display
    await page.keyboard.press('Control+KeyK');
    await page.waitForTimeout(500);
    await page.keyboard.type('GBP/JPY');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(4000);

    // Switch to dayRange visualization
    await page.keyboard.press('KeyM');
    await page.waitForTimeout(500);
    await page.keyboard.type('dayRange');
    await page.waitForTimeout(1000);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000);

    // Take screenshot for visual evidence
    await page.screenshot({
      path: 'test-results/gbpjpy-formatting.png',
      fullPage: false
    });

    await page.waitForTimeout(2000);
    console.log('✅ GBP/JPY test completed - check screenshot for decimal places');
  });

  test('should capture pipPosition data from backend for all symbol types', async ({ page }) => {
    console.log('\n🔍 Investigating pipPosition data from backend');

    const pipPositionLogs = [];

    // Enhanced console monitoring specifically for pipPosition data
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('pipPosition') ||
          text.includes('pipSize') ||
          text.includes('pipetteSize') ||
          text.includes('symbolDataPackage') ||
          text.includes('tick')) {
        pipPositionLogs.push({
          type: msg.type(),
          text: text,
          timestamp: new Date().toISOString()
        });
        console.log(`📍 [${msg.type().toUpperCase()}] ${text}`);
      }
    });

    const symbols = ['EUR/USD', 'USD/JPY', 'XAUUSD', 'BTCUSD'];

    for (const symbol of symbols) {
      console.log(`\n📊 Testing pipPosition data for: ${symbol}`);

      // Navigate to ensure clean state
      await page.goto('http://localhost:5175');
      await page.waitForTimeout(2000);

      // Create display and capture backend data
      await page.keyboard.press('Control+KeyK');
      await page.waitForTimeout(500);
      await page.keyboard.type(symbol);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(6000); // Longer wait to capture backend data

      // Clean up for next test
      await page.keyboard.press('Control+Shift+KeyW');
      await page.waitForTimeout(1000);
    }

    // Log all pipPosition related data
    console.log('\n📋 pipPosition Data Summary:');
    console.log(`Total pipPosition-related logs captured: ${pipPositionLogs.length}`);
    pipPositionLogs.forEach(log => {
      console.log(`[${log.timestamp}] [${log.type}] ${log.text}`);
    });

    // Take final screenshot
    await page.screenshot({
      path: 'test-results/pipposition-investigation.png',
      fullPage: false
    });
  });

  test('should create comprehensive comparison of all symbol types', async ({ page }) => {
    console.log('\n📊 Creating comprehensive symbol formatting comparison');

    await page.goto('http://localhost:5175');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const symbols = [
      { symbol: 'EUR/USD', expected: '5 decimals', description: 'Standard FX pair' },
      { symbol: 'USD/JPY', expected: '3 decimals', description: 'JPY pair' },
      { symbol: 'XAUUSD', expected: '2-3 decimals', description: 'Gold commodity' },
      { symbol: 'BTCUSD', expected: '2-4 decimals', description: 'Cryptocurrency' }
    ];

    for (let i = 0; i < symbols.length; i++) {
      const { symbol, expected, description } = symbols[i];
      console.log(`\n💱 Creating display: ${symbol} (${description} - expected: ${expected})`);

      // Create display
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
      await page.waitForTimeout(4000);

      // Move display to avoid overlap (simple positioning)
      if (i > 0) {
        // Move right and down based on index
        const moveRight = i * 50;
        const moveDown = i * 30;

        // Bring to front first
        await page.keyboard.press('Control+Tab');
        await page.waitForTimeout(200);

        // Simple drag positioning (this is approximate)
        await page.mouse.move(300, 200);
        await page.mouse.down();
        await page.mouse.move(300 + moveRight, 200 + moveDown);
        await page.mouse.up();
        await page.waitForTimeout(500);
      }
    }

    // Take comprehensive comparison screenshot
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: 'test-results/symbol-formatting-comparison.png',
      fullPage: true
    });

    console.log('✅ Comprehensive symbol formatting comparison completed');
    console.log('📸 Check screenshots in test-results/ directory for visual evidence');
  });
});