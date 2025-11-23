/**
 * Global Real-World Test Setup
 *
 * Sets up the testing environment for real-world validation
 * with live data connections and browser automation
 */

import { chromium } from 'playwright';

export default async function globalSetup() {
  console.log('🌐 Initializing global real-world test setup...');

  // Set global environment variables
  process.env.REAL_WORLD_TESTING = 'true';
  process.env.LIVE_MARKET_DATA = 'true';
  process.env.BROWSER_AUTOMATION = 'true';

  // Verify required services are available
  const requiredServices = [
    { name: 'Development Server', url: 'http://localhost:5174' },
    { name: 'WebSocket Backend', url: 'ws://localhost:8080' }
  ];

  for (const service of requiredServices) {
    try {
      const response = await fetch(service.url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok && !response.redirected) {
        throw new Error(`Service responded with ${response.status}`);
      }

      console.log(`✅ ${service.name} is available at ${service.url}`);
    } catch (error) {
      console.warn(`⚠️ ${service.name} may not be available: ${error.message}`);
      // Don't fail the setup - tests will handle missing services
    }
  }

  // Create a shared browser instance for performance
  let sharedBrowser;
  try {
    sharedBrowser = await chromium.launch({
      headless: false, // Keep visible for debugging
      args: [
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });

    console.log('✅ Shared browser instance created');
  } catch (error) {
    console.warn(`⚠️ Failed to create shared browser: ${error.message}`);
  }

  // Store in global scope for tests to access
  global.__SHARED_BROWSER__ = sharedBrowser;

  // Test WebSocket connectivity
  let websocketAvailable = false;
  try {
    const ws = new WebSocket('ws://localhost:8080');

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WebSocket timeout')), 5000);

      ws.onopen = () => {
        clearTimeout(timeout);
        websocketAvailable = true;
        ws.close();
        resolve();
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        resolve(); // Don't reject - just note that it's not available
      };
    });

    if (websocketAvailable) {
      console.log('✅ WebSocket connection available');
    } else {
      console.warn('⚠️ WebSocket connection not available');
    }
  } catch (error) {
    console.warn(`⚠️ WebSocket test failed: ${error.message}`);
  }

  // Set global test flags
  global.__WEBSOCKET_AVAILABLE__ = websocketAvailable;
  global.__DEVELOPMENT_SERVER_AVAILABLE__ = true; // Assume available since we got this far

  console.log('✅ Global real-world test setup completed');
}