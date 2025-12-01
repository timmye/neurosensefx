// Simple browser test for enhanced console monitoring
const puppeteer = require('puppeteer');

(async () => {
  console.log('🧪 Starting Simple Browser Test with Enhanced Console Monitoring...');

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: false, // Visible browser for monitoring
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Enhanced console monitoring with emoji classification
    page.on('console', (msg) => {
      const text = msg.text();
      let emoji = '💡'; // Default debug info

      if (text.includes('Error') || text.includes('error')) emoji = '❌';
      else if (text.includes('WARN') || text.includes('warn')) emoji = '⚠️';
      else if (text.includes('Connected') || text.includes('connected')) emoji = '🌐';
      else if (text.includes('keydown') || text.includes('keyboard')) emoji = '⌨️';
      else if (text.includes('SUCCESS') || text.includes('success')) emoji = '✅';
      else if (text.includes('CRITICAL') || text.includes('FAIL')) emoji = '🔥';
      else if (text.includes('load') || text.includes('Loading')) emoji = '📦';
      else if (text.includes('PROGRESSIVE')) emoji = '📊';

      console.log(`${emoji} ${text}`);
    });

    page.on('pageerror', (error) => {
      console.log(`🔥 Page Error: ${error.message}`);
    });

    page.on('request', (request) => {
      if (request.url().includes('ws://') || request.url().includes('socket')) {
        console.log(`🌐 WebSocket Request: ${request.url()}`);
      }
    });

    console.log(`📱 Navigating to http://localhost:5176...`);
    await page.goto('http://localhost:5176', { waitUntil: 'networkidle0' });

    // Wait for page to load and check for our implementation
    await page.waitForTimeout(2000);

    console.log(`🔍 Testing Progressive ADR Disclosure Implementation...`);

    // Check if our new modules are loaded
    const moduleCheck = await page.evaluate(() => {
      const results = {
        appLoaded: !!document.querySelector('#app'),
        hasWorkspace: !!document.querySelector('.workspace'),
        dayRangeModules: false,
        anyErrors: false
      };

      // Try to detect if our modules are being used
      try {
        if (window.dayRangeCalculations || window.renderDayRange) {
          results.dayRangeModules = true;
        }
      } catch (e) {
        results.anyErrors = true;
      }

      return results;
    });

    if (moduleCheck.appLoaded) {
      console.log(`✅ Application loaded successfully`);
    } else {
      console.log(`❌ Application failed to load`);
    }

    if (moduleCheck.dayRangeModules) {
      console.log(`✅ Day Range modules detected`);
    }

    // Test keyboard interaction (Alt+A to create display)
    console.log(`⌨️ Testing keyboard interaction (Alt+A)...`);
    await page.keyboard.down('Alt');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Alt');
    await page.waitForTimeout(1000);

    // Final status check
    const finalCheck = await page.evaluate(() => {
      return {
        displayCount: document.querySelectorAll('.floating-display').length,
        consoleErrors: console.error ? console.error.length : 0
      };
    });

    console.log(`📊 Final Status:`);
    console.log(`   Displays created: ${finalCheck.displayCount}`);
    console.log(`   Console errors: ${finalCheck.consoleErrors}`);

    // Keep browser open for manual inspection
    console.log(`🔍 Keeping browser open for 10 seconds for manual inspection...`);
    await page.waitForTimeout(10000);

  } catch (error) {
    console.log(`🔥 Test Error: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  console.log(`🏁 Simple Browser Test Complete`);
})();