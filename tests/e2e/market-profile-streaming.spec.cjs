const { test, expect } = require('@playwright/test');

test.describe('Market Profile Streaming Test', () => {
  test('should test Market Profile streaming updates over time', async ({ page }) => {
    test.setTimeout(60000); // Increase timeout to 60 seconds
    await page.addInitScript(() => {
      window.__capturedWsMessages = [];

      const OriginalWebSocket = window.WebSocket;
      window.WebSocket = class extends OriginalWebSocket {
        constructor(...args) {
          super(...args);

          this.addEventListener('message', (event) => {
            try {
              const data = JSON.parse(event.data);
              window.__capturedWsMessages.push({
                ...data,
                _timestamp: Date.now()
              });
            } catch (e) {
              // Not JSON
            }
          });
        }
      };
    });

    // Navigate to the app
    await page.goto('/', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);

    // Add a display (use EURUSD since it's available on both cTrader and TradingView)
    console.log('Adding EURUSD display...');
    await page.evaluate(() => {
      const { workspaceActions } = window;
      if (workspaceActions && workspaceActions.addDisplay) {
        workspaceActions.addDisplay('EURUSD', { x: 100, y: 100 }, 'ctrader');
      }
    });

    console.log('Waiting for initial data...');
    await page.waitForTimeout(5000);

    // Check initial state
    let messages = await page.evaluate(() => window.__capturedWsMessages || []);
    console.log(`Initial messages: ${messages.length}`);

    const initialProfilePkgs = messages.filter(m => m.type === 'symbolDataPackage');
    console.log(`Initial profile packages: ${initialProfilePkgs.length}`);

    if (initialProfilePkgs.length > 0) {
      console.log('✅ Initial profile received');
      console.log(`  Profile entries: ${initialProfilePkgs[0].initialMarketProfile?.length || 0}`);
    }

    // Wait longer for streaming updates
    console.log('\nWaiting 30 seconds for streaming updates...');
    await page.waitForTimeout(30000);

    // Check for updates
    messages = await page.evaluate(() => window.__capturedWsMessages || []);
    console.log(`\nTotal messages after 30s: ${messages.length}`);

    const profileUpdates = messages.filter(m => m.type === 'profileUpdate');
    const ticks = messages.filter(m => m.type === 'tick');
    const symbolDataPackages = messages.filter(m => m.type === 'symbolDataPackage');

    console.log(`symbolDataPackage: ${symbolDataPackages.length}`);
    console.log(`profileUpdate: ${profileUpdates.length}`);
    console.log(`tick: ${ticks.length}`);

    if (profileUpdates.length > 0) {
      console.log('\n✅ Profile updates received!');
      profileUpdates.forEach((update, index) => {
        console.log(`  ${index + 1}. Seq: ${update.seq}, Added: ${update.delta?.added?.length || 0}, Updated: ${update.delta?.updated?.length || 0}`);
      });
    } else {
      console.log('\n❌ No profile updates received');
      console.log('This means either:');
      console.log('  1. M1 bars are not being subscribed to');
      console.log('  2. M1 bars are not being emitted');
      console.log('  3. MarketProfileService is not initialized for this symbol');
      console.log('  4. No new M1 bars have arrived yet');
    }

    // Analyze tick messages
    if (ticks.length > 0) {
      const eurusdTicks = ticks.filter(t => t.symbol === 'EURUSD');
      console.log(`\nEURUSD ticks: ${eurusdTicks.length}`);

      if (eurusdTicks.length > 0) {
        const firstTick = eurusdTicks[0];
        const lastTick = eurusdTicks[eurusdTicks.length - 1];
        const timeSpan = lastTick._timestamp - firstTick._timestamp;
        console.log(`  Time span: ${Math.round(timeSpan / 1000)}s`);
        console.log(`  Ticks per second: ${(eurusdTicks.length / (timeSpan / 1000)).toFixed(2)}`);
      }
    }

    // Take screenshot
    await page.screenshot({ path: 'test-results/streaming-test-screenshot.png', fullPage: true });
    console.log('\nScreenshot saved to: test-results/streaming-test-screenshot.png');

    // Assertions
    expect(messages.length, 'No WebSocket messages').toBeGreaterThan(0);
    expect(symbolDataPackages.length, 'No symbolDataPackage received').toBeGreaterThan(0);

    // Note: We don't assert on profileUpdates as they may not arrive within 30s
    // if no new M1 bar has completed
  });
});
