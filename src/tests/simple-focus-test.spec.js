import { chromium } from 'playwright';
import { exit } from 'process';

/**
 * Simple test for basic display creation and focus functionality
 */

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🚀 Starting Simple Focus Test');
  console.log('=' .repeat(40));

  let browser;
  let page;
  let testPassed = true;

  try {
    // Launch browser
    console.log('🌐 Launching browser...');
    browser = await chromium.launch({
      headless: true,
      slowMo: 100
    });

    page = await browser.newPage();
    await page.setViewportSize({ width: 1200, height: 800 });

    // Capture console logs
    page.on('console', msg => {
      console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`);
    });

    // Navigate to the simple application
    console.log('🌍 Navigating to simple application...');
    await page.goto('http://localhost:5174/src-simple/', { waitUntil: 'domcontentloaded' });
    await delay(3000);

    // Check if page loaded
    const title = await page.title();
    console.log(`📋 Page title: ${title}`);

    // Take a screenshot to see what's loaded
    await page.screenshot({ path: 'simple-test-screenshot.png' });
    console.log('📸 Screenshot saved');

    // Check for the workspace
    try {
      await page.waitForSelector('.workspace', { timeout: 5000 });
      console.log('✅ Workspace found');
    } catch (error) {
      console.log('❌ Workspace not found, checking what is on the page...');
      const pageContent = await page.content();
      console.log('Page content length:', pageContent.length);
      // Look for any error messages
      const bodyText = await page.evaluate(() => document.body.innerText);
      console.log('Page body text:', bodyText.substring(0, 500));
      testPassed = false;
    }

    if (testPassed) {
      // Test display creation
      console.log('🧪 Testing display creation...');

      // Handle JavaScript prompt - setup before keypress
      let dialogHandled = false;
      page.on('dialog', async dialog => {
        console.log('🔍 Dialog detected:', dialog.message());
        dialogHandled = true;
        await dialog.accept('EURUSD');
      });

      // Focus the workspace element specifically
      console.log('🎯 Focusing workspace element...');
      await page.focus('.workspace');
      await delay(500);

      // Verify workspace is focused
      const workspaceFocused = await page.evaluate(() => {
        const workspace = document.querySelector('.workspace');
        return document.activeElement === workspace;
      });
      console.log(`📋 Workspace focused: ${workspaceFocused}`);

      // Press Alt+A using the standard Playwright method
      console.log('⌨️ Pressing Alt+A...');
      await page.keyboard.press('Alt+a');
      await delay(1000);

      // Check if dialog was handled
      console.log(`📋 Dialog handled: ${dialogHandled}`);

      // Wait a bit more for display creation
      await delay(2000);

      // Check if display was created
      const displays = await page.$$('.floating-display');
      console.log(`📋 Found ${displays.length} displays`);

      if (displays.length > 0) {
        console.log('✅ Display creation successful');

        // Test focus functionality
        console.log('🧪 Testing focus functionality...');

        // Click the display
        await displays[0].click();
        await delay(500);

        // Check for focused class
        const hasFocusedClass = await displays[0].evaluate(el =>
          el.classList.contains('focused')
        );

        console.log(`📋 Display focused: ${hasFocusedClass}`);

        if (hasFocusedClass) {
          console.log('✅ Focus functionality working');
        } else {
          console.log('❌ Focus functionality not working');
          testPassed = false;
        }

      } else {
        console.log('❌ No displays created');
        testPassed = false;
      }
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    testPassed = false;
  } finally {
    if (page) {
      await page.close();
    }
    if (browser) {
      await browser.close();
      console.log('🌐 Browser closed');
    }

    if (testPassed) {
      console.log('✅ Simple focus test PASSED');
    } else {
      console.log('❌ Simple focus test FAILED');
    }

    exit(testPassed ? 0 : 1);
  }
}

main();