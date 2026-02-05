const { test, expect } = require('@playwright/test');

test.describe('Market Profile Crypto Streaming Test', () => {
  test('should test Market Profile streaming for BTCUSD crypto symbol', async ({ page }) => {
    test.setTimeout(90000); // Increase timeout to 90 seconds

    // Capture console messages from the browser
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Market Profile') || text.includes('profileUpdate') || text.includes('BTCUSD') || text.includes('[TradingView]')) {
        console.log(`[Browser Console] ${text}`);
      }
    });

    // Capture WebSocket messages
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

              // Log important messages
              if (data.type === 'profileUpdate' || data.type === 'symbolDataPackage') {
                console.log(`[WS] ${data.type} for ${data.symbol}`, data);
              }
            } catch (e) {
              // Not JSON
            }
          });
        }
      };
    });

    // Navigate to the app
    console.log('\n=== Navigating to app ===');
    await page.goto('/', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);

    // Add BTCUSD display with TradingView
    console.log('\n=== Adding BTCUSD display with TradingView ===');
    await page.evaluate(() => {
      const { workspaceActions } = window;
      if (workspaceActions && workspaceActions.addDisplay) {
        workspaceActions.addDisplay('BTCUSD', { x: 100, y: 100 }, 'tradingview');
      }
    });

    console.log('Waiting for initial data...');
    await page.waitForTimeout(5000);

    // Check initial state
    let messages = await page.evaluate(() => window.__capturedWsMessages || []);
    console.log(`\nInitial messages: ${messages.length}`);

    const initialProfilePkgs = messages.filter(m => m.type === 'symbolDataPackage' && m.symbol === 'BTCUSD');
    console.log(`Initial BTCUSD profile packages: ${initialProfilePkgs.length}`);

    if (initialProfilePkgs.length > 0) {
      console.log('✅ Initial BTCUSD profile received');
      const profile = initialProfilePkgs[0].initialMarketProfile;
      console.log(`  Profile entries: ${profile?.length || 0}`);
      if (profile && profile.length > 0) {
        console.log(`  First entry:`, profile[0]);
        console.log(`  Last entry:`, profile[profile.length - 1]);
      }
    } else {
      console.log('❌ No initial BTCUSD profile received');
    }

    // Wait for streaming updates
    console.log('\n=== Waiting 45 seconds for streaming updates ===');
    await page.waitForTimeout(45000);

    // Check for updates
    messages = await page.evaluate(() => window.__capturedWsMessages || []);
    console.log(`\nTotal messages after 45s: ${messages.length}`);

    const btcusdMessages = messages.filter(m => m.symbol === 'BTCUSD');
    const profileUpdates = btcusdMessages.filter(m => m.type === 'profileUpdate');
    const ticks = btcusdMessages.filter(m => m.type === 'tick');
    const symbolDataPackages = btcusdMessages.filter(m => m.type === 'symbolDataPackage');

    console.log(`\n=== BTCUSD Message Summary ===`);
    console.log(`symbolDataPackage: ${symbolDataPackages.length}`);
    console.log(`profileUpdate: ${profileUpdates.length}`);
    console.log(`tick: ${ticks.length}`);

    if (profileUpdates.length > 0) {
      console.log('\n✅ Profile updates received for BTCUSD!');
      profileUpdates.forEach((update, index) => {
        console.log(`  ${index + 1}. Seq: ${update.seq}, Added: ${update.delta?.added?.length || 0}, Updated: ${update.delta?.updated?.length || 0}`);
        if (update.delta?.added?.length > 0) {
          console.log(`     Added sample:`, update.delta.added[0]);
        }
      });
    } else {
      console.log('\n⚠️  No profile updates received for BTCUSD');
      console.log('This could mean:');
      console.log('  1. TradingView M1 bars are not being subscribed to');
      console.log('  2. TradingView M1 bars are not being emitted');
      console.log('  3. MarketProfileService is not initialized for BTCUSD');
      console.log('  4. No new M1 bars have completed yet (M1 bars take 1 minute)');
    }

    // Check all message types for debugging
    const allTypes = {};
    messages.forEach(m => {
      allTypes[m.type] = (allTypes[m.type] || 0) + 1;
    });
    console.log('\n=== All message types ===');
    Object.entries(allTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

    // Take screenshot
    await page.screenshot({ path: 'test-results/crypto-streaming-test-screenshot.png', fullPage: true });
    console.log('\nScreenshot saved to: test-results/crypto-streaming-test-screenshot.png');

    // Assertions
    expect(messages.length, 'No WebSocket messages').toBeGreaterThan(0);
    expect(symbolDataPackages.length, 'No symbolDataPackage received for BTCUSD').toBeGreaterThan(0);

    // Log final verdict
    console.log('\n=== TEST VERDICT ===');
    if (profileUpdates.length > 0) {
      console.log('✅ SUCCESS: BTCUSD is receiving streaming Market Profile updates');
    } else if (symbolDataPackages.length > 0) {
      console.log('⚠️  PARTIAL: BTCUSD initial profile received, but no streaming updates yet');
      console.log('   This may be normal if no M1 bar has completed');
    } else {
      console.log('❌ FAILED: BTCUSD is not receiving Market Profile data');
    }
  });
});
