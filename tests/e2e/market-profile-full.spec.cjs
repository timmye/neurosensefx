const { test, expect } = require('@playwright/test');

test.describe('Market Profile Full Test', () => {
  test('should test Market Profile with actual symbol subscription', async ({ page }) => {
    const allMessages = [];

    // WebSocket interception
    await page.addInitScript(() => {
      window.__capturedWsMessages = [];

      const OriginalWebSocket = window.WebSocket;
      window.WebSocket = class extends OriginalWebSocket {
        constructor(...args) {
          super(...args);

          this.addEventListener('message', (event) => {
            try {
              const data = JSON.parse(event.data);
              window.__capturedWsMessages.push(data);
              console.log('[WS]', data.type, data.symbol || '', data.initialMarketProfile?.length || 0, 'entries');
            } catch (e) {
              // Not JSON
            }
          });
        }
      };
    });

    page.on('console', msg => {
      const text = msg.text();
      allMessages.push(text);
    });

    // Navigate to the app
    await page.goto('/', { waitUntil: 'networkidle', timeout: 60000 });

    console.log('Page loaded, waiting 2 seconds...');
    await page.waitForTimeout(2000);

    // Add a display using keyboard shortcut (Alt+A for cTrader symbol)
    console.log('Pressing Alt+A to add cTrader display...');
    await page.keyboard.press('Alt+a');
    await page.waitForTimeout(1000);

    // Type a symbol (e.g., BTCUSD)
    console.log('Typing symbol...');
    await page.keyboard.type('BTCUSD');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    // Wait for data to arrive
    console.log('Waiting for symbol data...');
    await page.waitForTimeout(10000);

    // Get captured messages
    const messages = await page.evaluate(() => {
      return window.__capturedWsMessages || [];
    });

    console.log('\n=== WebSocket Messages ===');
    console.log(`Total: ${messages.length}`);

    const symbolDataPackages = messages.filter(m => m.type === 'symbolDataPackage');
    const profileUpdates = messages.filter(m => m.type === 'profileUpdate');

    console.log(`symbolDataPackage: ${symbolDataPackages.length}`);
    console.log(`profileUpdate: ${profileUpdates.length}`);

    if (symbolDataPackages.length > 0) {
      console.log('\n=== symbolDataPackage Details ===');
      symbolDataPackages.forEach(pkg => {
        console.log(`Symbol: ${pkg.symbol}`);
        console.log(`  Has initialMarketProfile: ${!!pkg.initialMarketProfile}`);
        console.log(`  Profile entries: ${pkg.initialMarketProfile?.length || 0}`);
        console.log(`  Bucket size: ${pkg.pipSize}`);
        console.log(`  ADR: ${pkg.adr}`);
      });
    }

    if (profileUpdates.length > 0) {
      console.log('\n=== profileUpdate Details ===');
      profileUpdates.forEach((update, index) => {
        console.log(`${index + 1}. Symbol: ${update.symbol}`);
        console.log(`  Seq: ${update.seq}`);
        console.log(`  Delta: ${JSON.stringify(update.delta)}`);
      });
    }

    // Check for Market Profile logs
    const mpLogs = allMessages.filter(log => log.includes('MARKET_PROFILE') || log.includes('Market Profile'));
    console.log('\n=== Market Profile Logs ===');
    mpLogs.forEach(log => console.log(log));

    // Take screenshot
    await page.screenshot({ path: 'test-results/full-test-screenshot.png', fullPage: true });
    console.log('\nScreenshot saved to: test-results/full-test-screenshot.png');

    // Assertions
    expect(messages.length, 'No WebSocket messages').toBeGreaterThan(0);
    expect(symbolDataPackages.length, 'No symbolDataPackage received').toBeGreaterThan(0);

    if (symbolDataPackages.length > 0) {
      const pkg = symbolDataPackages[0];
      expect(pkg.initialMarketProfile, 'No initialMarketProfile in package').toBeDefined();
      expect(pkg.initialMarketProfile.length, 'Empty initialMarketProfile').toBeGreaterThan(0);
    }
  });
});
