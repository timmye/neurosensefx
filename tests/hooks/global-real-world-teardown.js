/**
 * Global Real-World Test Teardown
 *
 * Cleans up after real-world testing with proper resource cleanup
 */

export default async function globalTeardown() {
  console.log('🧹 Starting global real-world test teardown...');

  // Close shared browser instance if it exists
  if (global.__SHARED_BROWSER__) {
    try {
      const browser = global.__SHARED_BROWSER__;
      if (browser.isConnected()) {
        await browser.close();
        console.log('✅ Shared browser instance closed');
      }
    } catch (error) {
      console.warn(`⚠️ Error closing shared browser: ${error.message}`);
    }
  }

  // Clean up any remaining WebSocket connections
  if (global.__WEBSOCKET_CONNECTIONS__) {
    for (const ws of global.__WEBSOCKET_CONNECTIONS__) {
      try {
        if (ws.readyState === ws.OPEN) {
          ws.close();
        }
      } catch (error) {
        console.warn(`⚠️ Error closing WebSocket: ${error.message}`);
      }
    }
  }

  // Clear global test state
  delete global.__SHARED_BROWSER__;
  delete global.__WEBSOCKET_AVAILABLE__;
  delete global.__DEVELOPMENT_SERVER_AVAILABLE__;
  delete global.__WEBSOCKET_CONNECTIONS__;

  // Clear environment variables
  delete process.env.REAL_WORLD_TESTING;
  delete process.env.LIVE_MARKET_DATA;
  delete process.env.BROWSER_AUTOMATION;

  console.log('✅ Global real-world test teardown completed');
}