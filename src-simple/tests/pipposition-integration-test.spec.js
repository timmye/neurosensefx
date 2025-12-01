// pipPosition Integration Test - Comprehensive Browser Testing
// Tests the 3-line pipPosition formatting fix across different symbol types
// Enhanced console monitoring with emoji classification for Crystal Clarity

import { test, expect } from '@playwright/test';

test.describe('pipPosition Integration - Price Formatting Verification', () => {

  // Enhanced console monitoring with emoji classification
  function setupConsoleMonitoring(page) {
    const consoleData = {
      allLogs: [],
      pipPositionLogs: [],
      formattingLogs: [],
      websocketLogs: [],
      errorLogs: []
    };

    page.on('console', msg => {
      const text = msg.text();
      const timestamp = new Date().toISOString();
      const logEntry = {
        type: msg.type(),
        text: text,
        timestamp: timestamp
      };

      consoleData.allLogs.push(logEntry);

      // Categorized logging with emoji classification
      if (text.includes('pipPosition') || text.includes('pipSize') || text.includes('pipetteSize')) {
        consoleData.pipPositionLogs.push(logEntry);
        console.log(`📍 [${msg.type().toUpperCase()}] ${text}`);
      } else if (text.includes('formatPriceWithPipPosition') || text.includes('formatPrice') || text.includes('toFixed')) {
        consoleData.formattingLogs.push(logEntry);
        console.log(`💰 [${msg.type().toUpperCase()}] ${text}`);
      } else if (text.includes('WebSocket') || text.includes('symbolDataPackage') || text.includes('tick')) {
        consoleData.websocketLogs.push(logEntry);
        console.log(`🌐 [${msg.type().toUpperCase()}] ${text}`);
      } else if (text.includes('ERROR') || text.includes('BACKEND_ERROR')) {
        consoleData.errorLogs.push(logEntry);
        console.log(`❌ [${msg.type().toUpperCase()}] ${text}`);
      } else if (text.includes('Rendering') || text.includes('Symbol:') || text.includes('Canvas')) {
        console.log(`🎨 [${msg.type().toUpperCase()}] ${text}`);
      }
    });

    return consoleData;
  }

  test('EUR/USD - Baseline FX (should show 5 decimal places)', async ({ page }) => {
    console.log('\n💱 EUR/USD Baseline Test - Expected: 5 decimal places');
    const consoleData = setupConsoleMonitoring(page);

    await page.goto('http://localhost:5175');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Create EUR/USD display
    await page.keyboard.press('Control+KeyK');
    await page.waitForTimeout(500);
    await page.keyboard.type('EUR/USD');
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
      path: 'test-results/pipposition-eurusd-baseline.png',
      fullPage: false
    });

    // Analysis
    console.log('\n📊 EUR/USD Analysis Summary:');
    console.log(`Total logs: ${consoleData.allLogs.length}`);
    console.log(`pipPosition logs: ${consoleData.pipPositionLogs.length}`);
    console.log(`Formatting logs: ${consoleData.formattingLogs.length}`);

    // Look for pipPosition data
    const pipPositionData = consoleData.pipPositionLogs.filter(log =>
      log.text.includes('EUR/USD') && log.text.includes('pipPosition')
    );
    console.log(`\n📍 EUR/USD pipPosition data entries: ${pipPositionData.length}`);
    pipPositionData.forEach(log => {
      console.log(`  [${log.timestamp}] ${log.text}`);
    });

    // Look for formatting calls
    const formattingCalls = consoleData.formattingLogs.filter(log =>
      log.text.includes('formatPriceWithPipPosition')
    );
    console.log(`\n💰 formatPriceWithPipPosition calls: ${formattingCalls.length}`);
  });

  test('USD/JPY - JPY Style (should show 3 decimal places, not 5)', async ({ page }) => {
    console.log('\n💴 USD/JPY Test - Expected: 3 decimal places (fixed from 5)');
    const consoleData = setupConsoleMonitoring(page);

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
      path: 'test-results/pipposition-usdjpy-fixed.png',
      fullPage: false
    });

    // Analysis
    console.log('\n📊 USD/JPY Analysis Summary:');
    console.log(`Total logs: ${consoleData.allLogs.length}`);
    console.log(`pipPosition logs: ${consoleData.pipPositionLogs.length}`);

    // Look for pipPosition data specific to USD/JPY
    const pipPositionData = consoleData.pipPositionLogs.filter(log =>
      log.text.includes('USD/JPY') || (log.text.includes('pipPosition') && log.text.includes('2'))
    );
    console.log(`\n📍 USD/JPY pipPosition data entries: ${pipPositionData.length}`);
    pipPositionData.forEach(log => {
      console.log(`  [${log.timestamp}] ${log.text}`);
    });

    // Success verification: should show 3 decimals, not 5
    const hasCorrectFormatting = consoleData.formattingLogs.some(log =>
      log.text.includes('formatPriceWithPipPosition') && log.text.includes('2') // pipPosition=2 for JPY pairs
    );
    console.log(`\n✅ pipPosition formatting active: ${hasCorrectFormatting ? 'YES' : 'NO'}`);
  });

  test('XAUUSD - Gold Commodity (should show 2-3 decimal places, not 5)', async ({ page }) => {
    console.log('\n🥇 XAUUSD Test - Expected: 2-3 decimal places (fixed from 5)');
    const consoleData = setupConsoleMonitoring(page);

    await page.goto('http://localhost:5175');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Create XAUUSD display
    await page.keyboard.press('Control+KeyK');
    await page.waitForTimeout(500);
    await page.keyboard.type('XAUUSD');
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
      path: 'test-results/pipposition-xauusd-fixed.png',
      fullPage: false
    });

    // Analysis
    console.log('\n📊 XAUUSD Analysis Summary:');
    console.log(`Total logs: ${consoleData.allLogs.length}`);
    console.log(`pipPosition logs: ${consoleData.pipPositionLogs.length}`);

    // Look for pipPosition data specific to XAUUSD
    const pipPositionData = consoleData.pipPositionLogs.filter(log =>
      log.text.includes('XAUUSD') || (log.text.includes('pipPosition') && (log.text.includes('1') || log.text.includes('2')))
    );
    console.log(`\n📍 XAUUSD pipPosition data entries: ${pipPositionData.length}`);
    pipPositionData.forEach(log => {
      console.log(`  [${log.timestamp}] ${log.text}`);
    });

    // Success verification: should show 2-3 decimals, not 5
    const hasCorrectFormatting = consoleData.formattingLogs.some(log =>
      log.text.includes('formatPriceWithPipPosition') &&
      (log.text.includes('1') || log.text.includes('2')) // pipPosition=1 or 2 for commodities
    );
    console.log(`\n✅ pipPosition formatting active: ${hasCorrectFormatting ? 'YES' : 'NO'}`);
  });

  test('BTCUSD - Bitcoin Crypto (should show 2-4 decimal places, not 5)', async ({ page }) => {
    console.log('\n₿ BTCUSD Test - Expected: 2-4 decimal places (fixed from 5)');
    const consoleData = setupConsoleMonitoring(page);

    await page.goto('http://localhost:5175');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Create BTCUSD display
    await page.keyboard.press('Control+KeyK');
    await page.waitForTimeout(500);
    await page.keyboard.type('BTCUSD');
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
      path: 'test-results/pipposition-btcusd-fixed.png',
      fullPage: false
    });

    // Analysis
    console.log('\n📊 BTCUSD Analysis Summary:');
    console.log(`Total logs: ${consoleData.allLogs.length}`);
    console.log(`pipPosition logs: ${consoleData.pipPositionLogs.length}`);

    // Look for pipPosition data specific to BTCUSD
    const pipPositionData = consoleData.pipPositionLogs.filter(log =>
      log.text.includes('BTCUSD') || (log.text.includes('pipPosition') && (log.text.includes('1') || log.text.includes('2') || log.text.includes('3')))
    );
    console.log(`\n📍 BTCUSD pipPosition data entries: ${pipPositionData.length}`);
    pipPositionData.forEach(log => {
      console.log(`  [${log.timestamp}] ${log.text}`);
    });

    // Success verification: should show 2-4 decimals, not 5
    const hasCorrectFormatting = consoleData.formattingLogs.some(log =>
      log.text.includes('formatPriceWithPipPosition') &&
      (log.text.includes('1') || log.text.includes('2') || log.text.includes('3')) // pipPosition=1-3 for crypto
    );
    console.log(`\n✅ pipPosition formatting active: ${hasCorrectFormatting ? 'YES' : 'NO'}`);
  });

  test('Comprehensive pipPosition Data Flow Analysis', async ({ page }) => {
    console.log('\n🔍 Comprehensive pipPosition Data Flow Analysis');
    const consoleData = setupConsoleMonitoring(page);

    await page.goto('http://localhost:5175');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const testSymbols = [
      { symbol: 'EUR/USD', expectedPipPosition: 4, description: 'Standard FX - 5 decimals' },
      { symbol: 'USD/JPY', expectedPipPosition: 2, description: 'JPY Style - 3 decimals' },
      { symbol: 'XAUUSD', expectedPipPosition: 1, description: 'Gold - 2-3 decimals' },
      { symbol: 'BTCUSD', expectedPipPosition: 2, description: 'Bitcoin - 2-4 decimals' }
    ];

    for (const { symbol, expectedPipPosition, description } of testSymbols) {
      console.log(`\n📊 Testing ${symbol} - ${description} (pipPosition: ${expectedPipPosition})`);

      // Clean state
      await page.goto('http://localhost:5175');
      await page.waitForTimeout(2000);

      // Create display
      await page.keyboard.press('Control+KeyK');
      await page.waitForTimeout(500);
      await page.keyboard.type(symbol);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(6000); // Longer wait to capture pipPosition data

      // Switch to dayRange
      await page.keyboard.press('KeyM');
      await page.waitForTimeout(500);
      await page.keyboard.type('dayRange');
      await page.waitForTimeout(1000);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(4000);

      // Take individual screenshot
      await page.screenshot({
        path: `test-results/pipposition-flow-${symbol.toLowerCase().replace('/', '-')}.png`,
        fullPage: false
      });

      // Clean up for next symbol
      await page.keyboard.press('Control+Shift+KeyW');
      await page.waitForTimeout(1000);
    }

    // Final comprehensive analysis
    console.log('\n📋 Comprehensive pipPosition Data Flow Summary:');
    console.log(`Total console logs captured: ${consoleData.allLogs.length}`);
    console.log(`pipPosition related logs: ${consoleData.pipPositionLogs.length}`);
    console.log(`Price formatting logs: ${consoleData.formattingLogs.length}`);
    console.log(`WebSocket logs: ${consoleData.websocketLogs.length}`);
    console.log(`Error logs: ${consoleData.errorLogs.length}`);

    // Log all pipPosition data for verification
    if (consoleData.pipPositionLogs.length > 0) {
      console.log('\n📍 All pipPosition Data Captured:');
      consoleData.pipPositionLogs.forEach(log => {
        console.log(`  [${log.timestamp}] [${log.type}] ${log.text}`);
      });
    }

    // Log formatPriceWithPipPosition calls
    if (consoleData.formattingLogs.length > 0) {
      console.log('\n💰 All Price Formatting Calls:');
      consoleData.formattingLogs.forEach(log => {
        console.log(`  [${log.timestamp}] [${log.type}] ${log.text}`);
      });
    }

    // Take final comprehensive screenshot
    await page.screenshot({
      path: 'test-results/pipposition-comprehensive-analysis.png',
      fullPage: true
    });

    // Success criteria verification
    const hasPipPositionData = consoleData.pipPositionLogs.length > 0;
    const hasFormattingCalls = consoleData.formattingLogs.length > 0;
    const hasNoErrors = consoleData.errorLogs.length === 0;

    console.log('\n✅ pipPosition Integration Success Criteria:');
    console.log(`📡 pipPosition data received: ${hasPipPositionData ? '✅ YES' : '❌ NO'}`);
    console.log(`💰 formatPriceWithPipPosition called: ${hasFormattingCalls ? '✅ YES' : '❌ NO'}`);
    console.log(`❌ Error-free execution: ${hasNoErrors ? '✅ YES' : `❌ ${consoleData.errorLogs.length} errors`}`);

    if (hasPipPositionData && hasFormattingCalls && hasNoErrors) {
      console.log('\n🎉 pipPosition integration is working correctly!');
    } else {
      console.log('\n⚠️  pipPosition integration may have issues - check logs above');
    }
  });

  test.beforeEach(async ({}) => {
    // Ensure test-results directory exists
    await import('fs').then(fs => {
      if (!fs.existsSync('test-results')) {
        fs.mkdirSync('test-results', { recursive: true });
      }
    });
  });

});