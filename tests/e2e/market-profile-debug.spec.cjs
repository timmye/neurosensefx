const { test, expect } = require('@playwright/test');

test.describe('Market Profile Debug', () => {
  test('should debug WebSocket connection and messages', async ({ page }) => {
    const allMessages = [];

    // More detailed WebSocket interception
    await page.addInitScript(() => {
      window.__capturedWsMessages = [];
      window.__wsOpened = false;
      window.__wsUrl = null;

      const OriginalWebSocket = window.WebSocket;
      window.OriginalWebSocket = OriginalWebSocket;

      window.WebSocket = class extends OriginalWebSocket {
        constructor(...args) {
          super(...args);
          window.__wsUrl = args[0];

          console.log('[WS DEBUG] WebSocket created:', args[0]);

          this.addEventListener('open', () => {
            console.log('[WS DEBUG] WebSocket opened');
            window.__wsOpened = true;
          });

          this.addEventListener('message', (event) => {
            try {
              const data = JSON.parse(event.data);
              const msg = {
                type: data.type,
                symbol: data.symbol,
                source: data.source,
                hasProfile: !!data.initialMarketProfile,
                profileLength: data.initialMarketProfile?.length || 0,
                timestamp: Date.now()
              };
              window.__capturedWsMessages.push(msg);
              console.log('[WS DEBUG]', JSON.stringify(msg));
            } catch (e) {
              // Not JSON
              console.log('[WS DEBUG] Non-JSON message:', event.data.substring(0, 100));
            }
          });

          this.addEventListener('error', (error) => {
            console.log('[WS DEBUG] WebSocket error:', error);
          });

          this.addEventListener('close', () => {
            console.log('[WS DEBUG] WebSocket closed');
          });
        }
      };
    });

    // Capture all console messages
    page.on('console', msg => {
      const text = msg.text();
      allMessages.push(text);
    });

    // Navigate to the app
    console.log('Navigating to app...');
    await page.goto('/', { waitUntil: 'networkidle', timeout: 60000 });

    console.log('Page loaded, waiting for activity...');

    // Wait for WebSocket connection and messages
    await page.waitForTimeout(15000);

    // Check WebSocket state
    const wsState = await page.evaluate(() => {
      return {
        opened: window.__wsOpened,
        url: window.__wsUrl,
        messageCount: window.__capturedWsMessages?.length || 0
      };
    });

    console.log('\n=== WebSocket State ===');
    console.log('Opened:', wsState.opened);
    console.log('URL:', wsState.url);
    console.log('Message Count:', wsState.messageCount);

    // Get all captured messages
    const messages = await page.evaluate(() => {
      return window.__capturedWsMessages || [];
    });

    console.log('\n=== Captured Messages ===');
    messages.forEach((msg, index) => {
      console.log(`${index + 1}. Type: ${msg.type}, Symbol: ${msg.symbol}, HasProfile: ${msg.hasProfile}, ProfileLength: ${msg.profileLength}`);
    });

    // Get all console messages
    console.log('\n=== Console Messages (last 20) ===');
    allMessages.slice(-20).forEach(msg => console.log(msg));

    // Take screenshot
    await page.screenshot({ path: 'test-results/debug-screenshot.png', fullPage: true });
    console.log('\nScreenshot saved to: test-results/debug-screenshot.png');

    expect(messages.length, 'No WebSocket messages captured').toBeGreaterThan(0);
  });
});
