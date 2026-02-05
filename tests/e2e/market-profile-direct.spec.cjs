const { test, expect } = require('@playwright/test');

test.describe('Market Profile Direct Test', () => {
  test('should test Market Profile by directly adding display to store', async ({ page }) => {
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

    console.log('Page loaded, waiting for app to initialize...');
    await page.waitForTimeout(3000);

    // Add a display directly by evaluating in the page context
    console.log('Adding BTCUSD display to workspace...');
    await page.evaluate(() => {
      // Find the workspace store and add a display
      const { workspaceStore, workspaceActions } = window;
      if (workspaceActions && workspaceActions.addDisplay) {
        workspaceActions.addDisplay('BTCUSD', { x: 100, y: 100 }, 'ctrader');
      }
    });

    console.log('Waiting for data to arrive...');
    await page.waitForTimeout(15000);

    // Get captured messages
    const messages = await page.evaluate(() => {
      return window.__capturedWsMessages || [];
    });

    console.log('\n=== WebSocket Messages ===');
    console.log(`Total: ${messages.length}`);

    const symbolDataPackages = messages.filter(m => m.type === 'symbolDataPackage');
    const profileUpdates = messages.filter(m => m.type === 'profileUpdate');
    const ticks = messages.filter(m => m.type === 'tick');

    console.log(`symbolDataPackage: ${symbolDataPackages.length}`);
    console.log(`profileUpdate: ${profileUpdates.length}`);
    console.log(`tick: ${ticks.length}`);

    if (symbolDataPackages.length > 0) {
      console.log('\n=== symbolDataPackage Details ===');
      symbolDataPackages.forEach(pkg => {
        console.log(`Symbol: ${pkg.symbol}`);
        console.log(`  Has initialMarketProfile: ${!!pkg.initialMarketProfile}`);
        console.log(`  Profile entries: ${pkg.initialMarketProfile?.length || 0}`);
        console.log(`  Digits: ${pkg.digits}`);
        console.log(`  PipPosition: ${pkg.pipPosition}`);
        console.log(`  PipSize: ${pkg.pipSize}`);
        console.log(`  ADR: ${pkg.adr}`);
        console.log(`  Today's Open: ${pkg.todaysOpen}`);
        console.log(`  Today's High: ${pkg.todaysHigh}`);
        console.log(`  Today's Low: ${pkg.todaysLow}`);

        if (pkg.initialMarketProfile && pkg.initialMarketProfile.length > 0) {
          console.log(`  Sample profile entry:`, JSON.stringify(pkg.initialMarketProfile[0]));
        }
      });
    }

    if (profileUpdates.length > 0) {
      console.log('\n=== profileUpdate Details ===');
      profileUpdates.forEach((update, index) => {
        console.log(`${index + 1}. Symbol: ${update.symbol}`);
        console.log(`  Seq: ${update.seq}`);
        console.log(`  Delta added: ${update.delta?.added?.length || 0}`);
        console.log(`  Delta updated: ${update.delta?.updated?.length || 0}`);
      });
    }

    // Check for Market Profile logs
    const mpLogs = allMessages.filter(log =>
      log.includes('MARKET_PROFILE') ||
      log.includes('Market Profile') ||
      log.includes('profileUpdate') ||
      log.includes('initialMarketProfile')
    );
    console.log('\n=== Market Profile Related Logs ===');
    mpLogs.forEach(log => console.log(log));

    // Take screenshot
    await page.screenshot({ path: 'test-results/direct-test-screenshot.png', fullPage: true });
    console.log('\nScreenshot saved to: test-results/direct-test-screenshot.png');

    // Assertions
    expect(messages.length, 'No WebSocket messages').toBeGreaterThan(0);

    // Check for at least system messages
    const systemMessages = messages.filter(m => m.type === 'connected' || m.type === 'ready');
    expect(systemMessages.length, 'No system connection messages').toBeGreaterThan(0);

    // The key test: symbolDataPackage should be received
    if (symbolDataPackages.length > 0) {
      console.log('\n✅ SUCCESS: symbolDataPackage received!');
      const pkg = symbolDataPackages[0];
      expect(pkg.initialMarketProfile, 'No initialMarketProfile in package').toBeDefined();
      expect(pkg.initialMarketProfile.length, 'Empty initialMarketProfile').toBeGreaterThan(0);
      console.log(`\n✅ Market Profile data present: ${pkg.initialMarketProfile.length} entries`);
    } else {
      console.log('\n❌ FAILED: No symbolDataPackage received');
      console.log('This indicates the display was not added or subscription failed');
    }
  });
});
