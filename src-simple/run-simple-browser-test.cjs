// Simple Browser Test for Day Range Meter
// Direct browser automation to investigate Svelte application loading
// Tests basic application functionality and console output

const { chromium } = require('playwright');

console.log('🚀 Starting Simple Browser Test for Day Range Meter...');
console.log('📋 Testing: Application loading, Svelte components, console errors');

async function runSimpleBrowserTest() {
  let browser;
  let page;

  try {
    // Launch browser with visible UI
    console.log('🌐 Launching browser with visible UI...');
    browser = await chromium.launch({
      headless: false,
      slowMo: 500,
      devtools: true
    });

    const context = await browser.newContext();
    page = await context.newPage();

    // Enhanced console logging
    const consoleMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();
      const fullMessage = `[${type.toUpperCase()}] ${text}`;
      consoleMessages.push({ type, text, fullMessage });
      console.log(`📝 ${fullMessage}`);
    });

    // Also capture page errors
    page.on('pageerror', error => {
      console.log(`🔥 PAGE ERROR: ${error.message}`);
      consoleMessages.push({ type: 'pageerror', text: error.message, fullMessage: `PAGE ERROR: ${error.message}` });
    });

    // Navigate to the application
    console.log('🌐 Navigating to Crystal Clarity frontend...');
    await page.goto('http://localhost:5175', { waitUntil: 'networkidle' });

    // Wait for everything to load
    console.log('⏳ Waiting for application to fully load...');
    await page.waitForTimeout(5000);

    // Check page content
    console.log('\n🔍 Checking page content...');

    // Get page title
    const title = await page.title();
    console.log(`📄 Page title: "${title}"`);

    // Check body content
    const bodyHTML = await page.locator('body').innerHTML();
    console.log(`📱 Body HTML length: ${bodyHTML.length}`);
    if (bodyHTML.length > 0) {
      console.log(`📱 First 300 chars: ${bodyHTML.substring(0, 300)}`);
    } else {
      console.log('📱 Body is completely empty!');
    }

    // Check if Svelte components are being rendered
    console.log('\n🔍 Checking for Svelte components...');

    const mainElement = await page.locator('main').count();
    console.log(`🏗️ Main elements: ${mainElement}`);

    const workspaceElements = await page.locator('.workspace').count();
    console.log(`🏗️ Workspace elements: ${workspaceElements}`);

    const floatingDisplayElements = await page.locator('.floating-display').count();
    console.log(`🏗️ Floating display elements: ${floatingDisplayElements}`);

    const canvasElements = await page.locator('canvas').count();
    console.log(`🖼️ Canvas elements: ${canvasElements}`);

    // Check for script tags
    const scriptTags = await page.locator('script').count();
    console.log(`📜 Script tags: ${scriptTags}`);

    // Inject JavaScript to check if Svelte is working
    console.log('\n🧪 Injecting JavaScript to test Svelte functionality...');

    try {
      const svelteCheck = await page.evaluate(() => {
        // Check if the main.js script ran
        const results = {
          hasWindowApp: !!(window && window.app),
          hasSvelteStores: !!(window.__svelte || document.querySelector('script[src*="svelte"]')),
          bodyChildren: document.body.children.length,
          bodyInnerHTML: document.body.innerHTML,
          localStorageAvailable: typeof localStorage !== 'undefined',
          localStorageKeys: typeof localStorage !== 'undefined' ? Object.keys(localStorage) : []
        };

        // Try to manually create a simple Svelte-like element
        try {
          const testDiv = document.createElement('div');
          testDiv.textContent = 'Test element';
          testDiv.style.background = 'red';
          testDiv.style.color = 'white';
          testDiv.style.padding = '10px';
          document.body.appendChild(testDiv);
          results.manualElementCreated = true;
        } catch (e) {
          results.manualElementCreated = false;
          results.manualElementError = e.message;
        }

        return results;
      });

      console.log('🧪 Svelte functionality check:');
      console.log(`  Has window.app: ${svelteCheck.hasWindowApp}`);
      console.log(`  Has Svelte stores: ${svelteCheck.hasSvelteStores}`);
      console.log(`  Body children count: ${svelteCheck.bodyChildren}`);
      console.log(`  Body innerHTML: ${svelteCheck.bodyInnerHTML.substring(0, 200)}`);
      console.log(`  LocalStorage available: ${svelteCheck.localStorageAvailable}`);
      console.log(`  LocalStorage keys: ${svelteCheck.localStorageKeys.join(', ')}`);
      console.log(`  Manual element created: ${svelteCheck.manualElementCreated}`);
      if (svelteCheck.manualElementError) {
        console.log(`  Manual element error: ${svelteCheck.manualElementError}`);
      }

    } catch (e) {
      console.log(`❌ JavaScript evaluation failed: ${e.message}`);
    }

    // Try to interact with keyboard shortcuts
    console.log('\n⌨️ Testing keyboard interactions...');

    // Press Alt+A to create a display
    console.log('Pressing Alt+A...');
    await page.keyboard.press('Alt+A');
    await page.waitForTimeout(2000);

    // Check for any prompts or dialogs
    console.log('Checking for prompts or dialogs...');

    // Check if any new elements were created
    const newFloatingDisplayElements = await page.locator('.floating-display').count();
    console.log(`🏗️ Floating display elements after Alt+A: ${newFloatingDisplayElements}`);

    // Take screenshots
    console.log('\n📸 Taking screenshots...');

    await page.screenshot({
      path: 'test-simple-browser-initial.png',
      fullPage: true
    });

    // Console message analysis
    console.log('\n📊 Console Message Analysis:');
    console.log('================================');

    const errors = consoleMessages.filter(msg => msg.type === 'error' || msg.type === 'pageerror');
    const warnings = consoleMessages.filter(msg => msg.type === 'warning');
    const logs = consoleMessages.filter(msg => msg.type === 'log');

    console.log(`\n❌ Errors (${errors.length}):`);
    errors.forEach((msg, index) => {
      console.log(`  ${index + 1}. ${msg.fullMessage}`);
    });

    console.log(`\n⚠️ Warnings (${warnings.length}):`);
    warnings.forEach((msg, index) => {
      console.log(`  ${index + 1}. ${msg.fullMessage}`);
    });

    console.log(`\n📝 Logs (${logs.length}):`);
    logs.slice(-10).forEach((msg, index) => {
      console.log(`  ${logs.length - 10 + index + 1}. ${msg.fullMessage}`);
    });

    // Test results summary
    console.log('\n📋 Test Results Summary:');
    console.log('========================');

    const hasContent = bodyHTML.length > 0;
    const hasMainElements = mainElement > 0;
    const hasWorkspaceElements = workspaceElements > 0;
    const hasCanvasElements = canvasElements > 0;
    const hasErrors = errors.length > 0;
    const appFunctional = hasMainElements && hasWorkspaceElements;

    console.log(`✅ Page has content: ${hasContent ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Main elements rendered: ${hasMainElements ? 'PASS' : 'FAIL'} (${mainElement} found)`);
    console.log(`✅ Workspace elements rendered: ${hasWorkspaceElements ? 'PASS' : 'FAIL'} (${workspaceElements} found)`);
    console.log(`✅ Canvas elements rendered: ${hasCanvasElements ? 'PASS' : 'FAIL'} (${canvasElements} found)`);
    console.log(`❌ Console errors: ${hasErrors ? 'FAIL' : 'PASS'} (${errors.length} errors)`);
    console.log(`✅ Application functional: ${appFunctional ? 'PASS' : 'FAIL'}`);

    console.log('\n🎯 Simple Browser Test completed!');
    console.log('📸 Screenshots saved for visual verification');

    return {
      success: appFunctional && !hasErrors,
      summary: {
        hasContent,
        mainElements,
        workspaceElements,
        canvasElements,
        consoleErrors: errors.length,
        consoleWarnings: warnings.length,
        consoleLogs: logs.length
      }
    };

  } catch (error) {
    console.error('❌ Test execution failed:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    // Don't close browser immediately for debugging
    console.log('\n🔄 Keeping browser open for manual inspection...');
    console.log('Press Ctrl+C to close browser and exit...');

    // Wait for manual inspection
    await new Promise(resolve => {
      process.on('SIGINT', () => {
        console.log('\n🛑 Closing browser...');
        resolve();
      });
    });

    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
runSimpleBrowserTest()
  .then(results => {
    console.log('\n🏁 Simple Browser Test Complete');
    console.log('===============================');

    if (results.success) {
      console.log('✅ Overall Test Result: PASS');
    } else {
      console.log('❌ Overall Test Result: FAIL');
    }

    if (results.summary) {
      console.log('\n📊 Test Summary:');
      Object.entries(results.summary).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    }

    if (results.error) {
      console.log(`\n❌ Error: ${results.error}`);
    }

    process.exit(results.success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Fatal error running simple browser test:', error);
    process.exit(1);
  });