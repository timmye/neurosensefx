// Global setup for AddDisplayMenu tests
const { chromium } = require('@playwright/test');

async function globalSetup(config) {
  console.log('🚀 Setting up AddDisplayMenu test environment...');
  
  // Create a browser instance for setup tasks
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Wait for the application to be ready
    await page.goto(config.webServer.url);
    await page.waitForLoadState('networkidle');
    
    // Check if the application is ready
    const appReady = await page.locator('#app').isVisible();
    if (!appReady) {
      throw new Error('Application is not ready for testing');
    }
    
    // Set up test data in local storage if needed
    await page.evaluate(() => {
      localStorage.setItem('test-mode', 'true');
      localStorage.setItem('test-symbols', JSON.stringify([
        { symbol: 'EURUSD', name: 'EUR/USD', type: 'forex' },
        { symbol: 'GBPUSD', name: 'GBP/USD', type: 'forex' },
        { symbol: 'USDJPY', name: 'USD/JPY', type: 'forex' },
        { symbol: 'AUDUSD', name: 'AUD/USD', type: 'forex' },
        { symbol: 'USDCAD', name: 'USD/CAD', type: 'forex' },
      ]));
    });
    
    console.log('✅ AddDisplayMenu test environment setup complete');
  } catch (error) {
    console.error('❌ Error during test setup:', error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

module.exports = globalSetup;