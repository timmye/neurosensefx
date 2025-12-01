// Console Price Formatting Analysis
// Detailed investigation of price formatting console output

import { test, expect } from '@playwright/test';

test.describe('Console Price Formatting Analysis', () => {

  test('should capture detailed price formatting for USD/JPY', async ({ page }) => {
    console.log('\n🔍 USD/JPY Detailed Price Formatting Analysis');

    // Enhanced console monitoring
    const allConsoleLogs = [];
    const priceFormattingLogs = [];

    page.on('console', msg => {
      const text = msg.text();
      allConsoleLogs.push({
        type: msg.type(),
        text: text,
        timestamp: new Date().toISOString()
      });

      // Focus on price and formatting related logs
      if (text.includes('formatPrice') ||
          text.includes('toFixed') ||
          text.includes('pipPosition') ||
          text.includes('Rendering') ||
          text.includes('Symbol:') ||
          text.includes('digit') ||
          text.includes('decimal') ||
          text.includes('price') ||
          text.includes('BACKEND_ERROR') ||
          text.includes('symbolDataPackage') ||
          text.includes('tick')) {
        priceFormattingLogs.push({
          type: msg.type(),
          text: text,
          timestamp: new Date().toISOString()
        });
        console.log(`💰 [${msg.type().toUpperCase()}] ${text}`);
      }
    });

    await page.goto('http://localhost:5175');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Create USD/JPY display
    await page.keyboard.press('Control+KeyK');
    await page.waitForTimeout(500);
    await page.keyboard.type('USD/JPY');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000);

    // Switch to dayRange to see price formatting
    await page.keyboard.press('KeyM');
    await page.waitForTimeout(500);
    await page.keyboard.type('dayRange');
    await page.waitForTimeout(1000);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000);

    // Take screenshot
    await page.screenshot({
      path: 'test-results/usdjpy-console-analysis.png',
      fullPage: false
    });

    // Summary report
    console.log('\n📊 USD/JPY Price Formatting Analysis Summary:');
    console.log(`Total console logs: ${allConsoleLogs.length}`);
    console.log(`Price formatting logs: ${priceFormattingLogs.length}`);

    if (priceFormattingLogs.length > 0) {
      console.log('\n💰 Key Price Formatting Logs:');
      priceFormattingLogs.forEach(log => {
        console.log(`  [${log.timestamp}] ${log.text}`);
      });
    } else {
      console.log('❌ No price formatting logs captured - suggests fixed 5-decimal formatting');
    }

    // Look specifically for pipPosition mentions
    const pipPositionLogs = allConsoleLogs.filter(log =>
      log.text.includes('pipPosition')
    );
    console.log(`\n📍 pipPosition logs found: ${pipPositionLogs.length}`);
    pipPositionLogs.forEach(log => {
      console.log(`  [${log.timestamp}] ${log.text}`);
    });
  });

  test('should capture detailed price formatting for XAUUSD', async ({ page }) => {
    console.log('\n🥇 XAUUSD Detailed Price Formatting Analysis');

    const priceFormattingLogs = [];

    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('formatPrice') ||
          text.includes('toFixed') ||
          text.includes('pipPosition') ||
          text.includes('Rendering') ||
          text.includes('Symbol:') ||
          text.includes('price') ||
          text.includes('symbolDataPackage')) {
        priceFormattingLogs.push({
          type: msg.type(),
          text: text,
          timestamp: new Date().toISOString()
        });
        console.log(`🥇 [${msg.type().toUpperCase()}] ${text}`);
      }
    });

    await page.goto('http://localhost:5175');
    await page.waitForTimeout(3000);

    // Create XAUUSD display
    await page.keyboard.press('Control+KeyK');
    await page.waitForTimeout(500);
    await page.keyboard.type('XAUUSD');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000);

    // Switch to dayRange
    await page.keyboard.press('KeyM');
    await page.waitForTimeout(500);
    await page.keyboard.type('dayRange');
    await page.waitForTimeout(1000);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000);

    await page.screenshot({
      path: 'test-results/xauusd-console-analysis.png',
      fullPage: false
    });

    console.log(`\n🥇 XAUUSD Analysis: ${priceFormattingLogs.length} formatting logs captured`);
  });

  test('should capture detailed price formatting for BTCUSD', async ({ page }) => {
    console.log('\n₿ BTCUSD Detailed Price Formatting Analysis');

    const priceFormattingLogs = [];

    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('formatPrice') ||
          text.includes('toFixed') ||
          text.includes('pipPosition') ||
          text.includes('Rendering') ||
          text.includes('Symbol:') ||
          text.includes('price') ||
          text.includes('symbolDataPackage')) {
        priceFormattingLogs.push({
          type: msg.type(),
          text: text,
          timestamp: new Date().toISOString()
        });
        console.log(`₿ [${msg.type().toUpperCase()}] ${text}`);
      }
    });

    await page.goto('http://localhost:5175');
    await page.waitForTimeout(3000);

    // Create BTCUSD display
    await page.keyboard.press('Control+KeyK');
    await page.waitForTimeout(500);
    await page.keyboard.type('BTCUSD');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000);

    // Switch to dayRange
    await page.keyboard.press('KeyM');
    await page.waitForTimeout(500);
    await page.keyboard.type('dayRange');
    await page.waitForTimeout(1000);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000);

    await page.screenshot({
      path: 'test-results/btcusd-console-analysis.png',
      fullPage: false
    });

    console.log(`\n₿ BTCUSD Analysis: ${priceFormattingLogs.length} formatting logs captured`);
  });

  test('should capture detailed price formatting for EUR/USD baseline', async ({ page }) => {
    console.log('\n💱 EUR/USD Baseline Price Formatting Analysis');

    const priceFormattingLogs = [];

    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('formatPrice') ||
          text.includes('toFixed') ||
          text.includes('pipPosition') ||
          text.includes('Rendering') ||
          text.includes('Symbol:') ||
          text.includes('price') ||
          text.includes('symbolDataPackage')) {
        priceFormattingLogs.push({
          type: msg.type(),
          text: text,
          timestamp: new Date().toISOString()
        });
        console.log(`💱 [${msg.type().toUpperCase()}] ${text}`);
      }
    });

    await page.goto('http://localhost:5175');
    await page.waitForTimeout(3000);

    // Create EUR/USD display
    await page.keyboard.press('Control+KeyK');
    await page.waitForTimeout(500);
    await page.keyboard.type('EUR/USD');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000);

    // Switch to dayRange
    await page.keyboard.press('KeyM');
    await page.waitForTimeout(500);
    await page.keyboard.type('dayRange');
    await page.waitForTimeout(1000);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000);

    await page.screenshot({
      path: 'test-results/eurusd-console-analysis.png',
      fullPage: false
    });

    console.log(`\n💱 EUR/USD Baseline: ${priceFormattingLogs.length} formatting logs captured`);
  });
});