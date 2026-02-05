const { test, expect } = require('@playwright/test');

test.describe('Market Profile Implementation', () => {
  test('should load application and monitor Market Profile functionality', async ({ page }) => {
    // Collect console messages
    const consoleLogs = [];
    const errors = [];
    const warnings = [];
    const marketProfileLogs = [];
    const profileUpdates = [];

    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();

      consoleLogs.push({ type, text });

      if (type === 'error') {
        errors.push(text);
      } else if (type === 'warning') {
        warnings.push(text);
      }

      // Capture Market Profile specific logs
      if (text.includes('[MARKET_PROFILE]') || text.includes('Market Profile')) {
        marketProfileLogs.push(text);
      }

      // Capture profile update messages
      if (text.includes('profileUpdate') || text.includes('profile delta')) {
        profileUpdates.push(text);
      }
    });

    // Also capture page errors
    page.on('pageerror', error => {
      errors.push(error.toString());
    });

    // Navigate to the application
    await page.goto('/', { waitUntil: 'networkidle', timeout: 60000 });

    // Wait for initial page load
    await page.waitForTimeout(5000);

    // Check for WebSocket connection
    const wsConnected = await page.evaluate(() => {
      return typeof window !== 'undefined' &&
             (window.ws && window.ws.readyState === WebSocket.OPEN ||
              window.__ws && window.__ws.readyState === WebSocket.OPEN);
    });

    console.log('WebSocket Connected:', wsConnected);

    // Wait for Market Profile initialization
    await page.waitForTimeout(10000);

    // Check for Market Profile in DOM
    const marketProfileExists = await page.evaluate(() => {
      // Check for Market Profile containers
      const profileContainers = document.querySelectorAll('[class*="market-profile"], [class*="profile"], [data-profile]');
      return profileContainers.length > 0;
    });

    console.log('Market Profile DOM Elements Found:', marketProfileExists);

    // Check for canvas elements (Market Profile rendering uses canvas)
    const canvasCount = await page.evaluate(() => {
      return document.querySelectorAll('canvas').length;
    });

    console.log('Canvas Elements Found:', canvasCount);

    // Look for Market Profile in component state
    const profileState = await page.evaluate(() => {
      // Try to access window or global state
      if (typeof window !== 'undefined') {
        return {
          hasWindow: true,
          hasSymbolData: !!window.symbolData,
          hasProfileData: !!window.profileData,
        };
      }
      return { hasWindow: false };
    });

    console.log('Profile State:', profileState);

    // Additional wait for any delayed initialization
    await page.waitForTimeout(5000);

    // Collect WebSocket messages if available
    const wsActivity = await page.evaluate(() => {
      return new Promise((resolve) => {
        // Try to extract WebSocket activity
        let messages = [];
        const originalSend = WebSocket.prototype.send;
        const originalClose = WebSocket.prototype.close;

        // Note: This is informational - we can't intercept all WS messages
        // without modifying the application code
        resolve({
          hasWebSocket: typeof WebSocket !== 'undefined',
          messageCount: messages.length,
        });
      });
    });

    console.log('WebSocket Activity:', wsActivity);

    // Print summary
    console.log('\n=== MARKET PROFILE TEST SUMMARY ===');
    console.log(`Total Console Logs: ${consoleLogs.length}`);
    console.log(`Errors: ${errors.length}`);
    console.log(`Warnings: ${warnings.length}`);
    console.log(`Market Profile Logs: ${marketProfileLogs.length}`);
    console.log(`Profile Updates: ${profileUpdates.length}`);
    console.log(`WebSocket Connected: ${wsConnected}`);
    console.log(`Canvas Elements: ${canvasCount}`);
    console.log(`Market Profile in DOM: ${marketProfileExists}`);

    // Print Market Profile specific logs
    if (marketProfileLogs.length > 0) {
      console.log('\n=== MARKET PROFILE LOGS ===');
      marketProfileLogs.forEach(log => console.log('  ', log));
    }

    // Print profile updates
    if (profileUpdates.length > 0) {
      console.log('\n=== PROFILE UPDATES ===');
      profileUpdates.forEach(update => console.log('  ', update));
    }

    // Print errors if any
    if (errors.length > 0) {
      console.log('\n=== ERRORS ===');
      errors.forEach(error => console.log('  ERROR:', error));
    }

    // Print warnings if any
    if (warnings.length > 0) {
      console.log('\n=== WARNINGS ===');
      warnings.forEach(warning => console.log('  WARNING:', warning));
    }

    // Assertions
    expect(errors.length, `Application has ${errors.length} errors`).toBe(0);
  });

  test('should monitor Market Profile WebSocket messages', async ({ page }) => {
    const wsMessages = [];
    const profileDeltas = [];

    // Intercept WebSocket messages by injecting a script
    await page.addInitScript(() => {
      window.__capturedWsMessages = [];

      // Intercept WebSocket constructor
      const OriginalWebSocket = window.WebSocket;
      window.OriginalWebSocket = OriginalWebSocket;

      window.WebSocket = class extends OriginalWebSocket {
        constructor(...args) {
          super(...args);

          this.addEventListener('message', (event) => {
            try {
              const data = JSON.parse(event.data);
              window.__capturedWsMessages.push({
                type: data.type,
                payload: data,
                timestamp: Date.now(),
              });

              // Log Market Profile related messages
              if (data.type === 'profileUpdate' || data.type === 'symbolDataPackage') {
                console.log('[WS INTERCEPT]', data.type, data);
              }
            } catch (e) {
              // Not JSON, ignore
            }
          });
        }
      };
    });

    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[WS INTERCEPT]')) {
        console.log('Browser:', text);
        wsMessages.push(text);
      }
    });

    await page.goto('/', { waitUntil: 'networkidle', timeout: 60000 });

    // Wait for WebSocket connection and data
    await page.waitForTimeout(15000);

    // Extract captured messages
    const capturedMessages = await page.evaluate(() => {
      return window.__capturedWsMessages || [];
    });

    console.log('\n=== WEBSOCKET MESSAGES ===');
    console.log(`Total Messages Captured: ${capturedMessages.length}`);

    const profileMessages = capturedMessages.filter(m =>
      m.type === 'profileUpdate' || m.type === 'symbolDataPackage'
    );

    console.log(`Profile-Related Messages: ${profileMessages.length}`);

    profileMessages.forEach(msg => {
      console.log(`\nMessage Type: ${msg.type}`);
      if (msg.payload.profile) {
        console.log(`  Profile POC: ${msg.payload.profile.poc}`);
        console.log(`  Profile VAH: ${msg.payload.profile.vah}`);
        console.log(`  Profile VAL: ${msg.payload.profile.val}`);
        console.log(`  Profile Levels: ${msg.payload.profile.levels?.length || 0}`);
      }
      if (msg.payload.sequence !== undefined) {
        console.log(`  Sequence: ${msg.payload.sequence}`);
      }
    });

    // Assertions
    expect(capturedMessages.length, 'No WebSocket messages captured').toBeGreaterThan(0);
  });

  test('should check for Market Profile rendering', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 60000 });

    // Wait for rendering
    await page.waitForTimeout(10000);

    // Check for canvas elements and their content
    const canvasInfo = await page.evaluate(() => {
      const canvases = Array.from(document.querySelectorAll('canvas'));
      return canvases.map(canvas => ({
        width: canvas.width,
        height: canvas.height,
        hasContext: !!canvas.getContext('2d'),
        classes: canvas.className,
        id: canvas.id,
      }));
    });

    console.log('\n=== CANVAS INFORMATION ===');
    console.log(`Total Canvases: ${canvasInfo.length}`);
    canvasInfo.forEach((info, index) => {
      console.log(`\nCanvas ${index + 1}:`);
      console.log(`  Size: ${info.width}x${info.height}`);
      console.log(`  Has Context: ${info.hasContext}`);
      console.log(`  Classes: ${info.classes || 'none'}`);
      console.log(`  ID: ${info.id || 'none'}`);
    });

    // Take a screenshot for visual verification
    await page.screenshot({ path: 'test-results/market-profile-screenshot.png', fullPage: true });
    console.log('\nScreenshot saved to: test-results/market-profile-screenshot.png');

    expect(canvasInfo.length, 'No canvas elements found').toBeGreaterThan(0);
  });
});
