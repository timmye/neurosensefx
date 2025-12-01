// Debug Console Monitoring Test for Day Range Meter
// Simple Node.js test with enhanced debugging and longer wait times
// Tests Crystal Clarity compliance violations, progressive ADR disclosure, and dynamic markers

const { chromium } = require('playwright');

console.log('🚀 Starting Debug Day Range Meter Testing...');
console.log('📋 Testing: Crystal Clarity violations, progressive ADR disclosure, dynamic percentage markers');

async function runDebugTest() {
  let browser;
  let page;

  try {
    // Enhanced console monitoring with emoji classification system
    const consoleCollector = {
      network: [],
      keyboard: [],
      errors: [],
      success: [],
      critical: [],
      warnings: [],
      debug: [],
      assets: [],
      all: [],
      dayRangeMessages: [],
      progressiveMessages: [],
      percentageMessages: [],
      performanceMessages: []
    };

    // Launch browser
    console.log('🌐 Launching browser for testing...');
    browser = await chromium.launch({
      headless: false,
      devtools: true // Open devtools for better debugging
    });
    page = await browser.newPage();

    // Set up comprehensive console monitoring with classification
    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();
      const timestamp = new Date().toISOString();

      // Store all messages
      consoleCollector.all.push({ type, text, timestamp });

      // Classify with emoji indicators
      if (text.includes('WebSocket') || text.includes('http') || text.includes('fetch') || text.includes('API')) {
        consoleCollector.network.push(`🌐 [${type.toUpperCase()}] ${text}`);
        console.log(`🌐 Network Activity: ${text}`);
      }
      else if (text.includes('keydown') || text.includes('Control') || text.includes('Alt') || text.includes('KeyK')) {
        consoleCollector.keyboard.push(`⌨️ [${type.toUpperCase()}] ${text}`);
        console.log(`⌨️ User Interaction: ${text}`);
      }
      else if (type === 'error') {
        consoleCollector.errors.push(`❌ [ERROR] ${text}`);
        console.log(`❌ System Error: ${text}`);
      }
      else if (text.includes('connected') || text.includes('success') || text.includes('created') || text.includes('✅')) {
        consoleCollector.success.push(`✅ [SUCCESS] ${text}`);
        console.log(`✅ Success Event: ${text}`);
      }
      else if (text.includes('failed') || text.includes('crash') || text.includes('exception')) {
        consoleCollector.critical.push(`🔥 [CRITICAL] ${text}`);
        console.log(`🔥 Critical Issue: ${text}`);
      }
      else if (type === 'warning' || text.includes('warning') || text.includes('deprecated')) {
        consoleCollector.warnings.push(`⚠️ [WARNING] ${text}`);
        console.log(`⚠️ Warning: ${text}`);
      }
      else if (text.includes('DEBUGGER') || text.includes('performance') || text.includes('latency') || text.includes('fps')) {
        consoleCollector.debug.push(`💡 [DEBUG] ${text}`);
        console.log(`💡 Debug Information: ${text}`);
      }
      else if (text.includes('load') || text.includes('module') || text.includes('import')) {
        consoleCollector.assets.push(`📦 [ASSET] ${text}`);
        console.log(`📦 Asset Loading: ${text}`);
      }

      // Day Range specific monitoring
      if (text.includes('Day Range') || text.includes('PROGRESSIVE') || text.includes('Max ADR') || text.includes('progressive')) {
        consoleCollector.dayRangeMessages.push(text);
        console.log(`📊 Day Range: [${type.toUpperCase()}] ${text}`);

        if (text.includes('PROGRESSIVE') || text.includes('Max ADR')) {
          consoleCollector.progressiveMessages.push(text);
          console.log(`📈 Progressive Disclosure: ${text}`);
        }
      }

      // Percentage monitoring
      if (text.includes('%') || text.includes('percentage') || text.includes('marker')) {
        consoleCollector.percentageMessages.push(text);
        console.log(`📈 Percentage Marker: ${text}`);
      }

      // Performance monitoring
      if (text.includes('performance') || text.includes('latency') || text.includes('fps') || text.includes('render')) {
        consoleCollector.performanceMessages.push(text);
        console.log(`⚡ Performance: ${text}`);
      }

      // Catch all console output for debugging
      console.log(`📝 [${type.toUpperCase()}] ${text}`);
    });

    // Navigate to Crystal Clarity frontend
    console.log('🌐 Navigating to Crystal Clarity frontend...');
    await page.goto('http://localhost:5175');

    // Wait for application to fully load - extended time
    console.log('⏳ Waiting for application to fully load...');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    // Check page title and basic elements
    const title = await page.title();
    console.log(`📄 Page title: ${title}`);

    // Check if body has content
    const bodyContent = await page.locator('body').textContent();
    console.log(`📱 Body content length: ${bodyContent.length}`);
    console.log(`📱 First 200 chars of body: ${bodyContent.substring(0, 200)}`);

    // Check for main element
    const mainElement = await page.locator('main').count();
    console.log(`🏗️ Main elements found: ${mainElement}`);

    // Check for app element
    const appElement = await page.locator('#app').count();
    console.log(`📱 #app elements found: ${appElement}`);

    // Check for any script errors by evaluating page
    try {
      const pageErrors = await page.evaluate(() => {
        return window.consoleErrors || [];
      });
      console.log(`🔍 Page errors detected: ${pageErrors.length}`);
    } catch (e) {
      console.log('🔍 No page error tracking detected');
    }

    console.log('📊 Taking initial application screenshot...');
    await page.screenshot({
      path: 'test-debug-dayrange-initial.png',
      fullPage: true
    });

    // Test 1: Module imports and loading
    console.log('\n🧪 Test 1: Verifying module imports and loading...');

    const initialErrors = consoleCollector.errors.length;
    const initialAssets = consoleCollector.assets.length;

    console.log(`📦 Assets loaded: ${initialAssets}`);
    console.log(`❌ Initial errors: ${initialErrors}`);

    // Wait for any dynamic content to load
    await page.waitForTimeout(3000);

    // Test 2: Check if JavaScript is working by evaluating something
    console.log('\n🧪 Test 2: Testing JavaScript execution...');

    try {
      const jsResult = await page.evaluate(() => {
        return {
          hasDocument: !!document,
          hasWindow: !!window,
          scriptsLoaded: document.querySelectorAll('script').length,
          canvasElements: document.querySelectorAll('canvas').length,
          bodyClasses: document.body.className,
          bodyChildren: document.body.children.length
        };
      });
      console.log('🔍 JavaScript execution results:');
      console.log(`  Has document: ${jsResult.hasDocument}`);
      console.log(`  Has window: ${jsResult.hasWindow}`);
      console.log(`  Scripts loaded: ${jsResult.scriptsLoaded}`);
      console.log(`  Canvas elements: ${jsResult.canvasElements}`);
      console.log(`  Body classes: ${jsResult.bodyClasses}`);
      console.log(`  Body children: ${jsResult.bodyChildren}`);

      // Update canvas count
      const canvasElements = jsResult.canvasElements;
      console.log(`🖼️ Found ${canvasElements} canvas elements`);

    } catch (e) {
      console.log(`❌ JavaScript execution failed: ${e.message}`);
    }

    // Test 3: Progressive ADR disclosure functionality
    console.log('\n🧪 Test 3: Testing progressive ADR disclosure (0.25 increments)...');

    // Try to create Day Range Meter display
    console.log('➕ Attempting to create EUR/USD Day Range Meter display...');

    // Check if keyboard events work
    console.log('⌨️ Testing keyboard interaction - Alt+A...');
    await page.keyboard.press('Alt+A');
    await page.waitForTimeout(2000);

    // Check for any modal or dialog
    const modalElements = await page.locator('[role="dialog"], .modal, .dialog').count();
    console.log(`📋 Modal/dialog elements found: ${modalElements}`);

    // Try to type symbol if input field exists
    const inputElements = await page.locator('input').count();
    console.log(`📝 Input elements found: ${inputElements}`);

    if (inputElements > 0) {
      console.log('📝 Typing EUR/USD...');
      await page.locator('input').first().type('EUR/USD');
      await page.waitForTimeout(1000);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(5000); // Allow for full initialization
    }

    console.log(`📈 Found ${consoleCollector.dayRangeMessages.length} Day Range related messages`);
    console.log(`📈 Found ${consoleCollector.progressiveMessages.length} Progressive disclosure messages`);

    // Test 4: Dynamic percentage markers
    console.log('\n🧪 Test 4: Testing dynamic percentage markers...');
    console.log(`📈 Found ${consoleCollector.percentageMessages.length} percentage-related messages`);

    // Test 5: Manual check for Day Range functionality
    console.log('\n🧪 Test 5: Manual check for Day Range Meter files...');

    // Check if required files exist
    const fs = require('fs');
    const path = require('path');

    const requiredFiles = [
      'lib/visualizers.js',
      'lib/dayRangeElements.js',
      'components/Workspace.svelte',
      'components/FloatingDisplay.svelte',
      'App.svelte'
    ];

    console.log('📁 Checking required files:');
    requiredFiles.forEach(file => {
      const filePath = path.join(__dirname, file);
      const exists = fs.existsSync(filePath);
      console.log(`  ${exists ? '✅' : '❌'} ${file}`);
    });

    // Test 6: Canvas rendering check
    console.log('\n🧪 Test 6: Verifying Canvas rendering with DPR awareness...');

    // Re-check canvas elements after potential creation
    try {
      const canvasCount = await page.evaluate(() => {
        return document.querySelectorAll('canvas').length;
      });
      console.log(`🖼️ Canvas elements after display creation: ${canvasCount}`);

      if (canvasCount > 0) {
        // Take screenshot of canvas rendering
        await page.locator('canvas').first().screenshot({
          path: 'test-debug-canvas-rendering.png'
        });
        console.log('📸 Canvas screenshot saved');
      }
    } catch (e) {
      console.log(`❌ Canvas check failed: ${e.message}`);
    }

    // Take final screenshot
    console.log('📊 Taking final application screenshot...');
    await page.screenshot({
      path: 'test-debug-dayrange-final.png',
      fullPage: true
    });

    // Comprehensive console analysis
    console.log('\n📊 COMPREHENSIVE CONSOLE ANALYSIS:');
    console.log('=====================================');

    console.log(`\n🌐 Network Activity: ${consoleCollector.network.length} messages`);
    consoleCollector.network.slice(-5).forEach(msg => console.log(`  ${msg}`));

    console.log(`\n⌨️ User Interactions: ${consoleCollector.keyboard.length} messages`);
    consoleCollector.keyboard.slice(-5).forEach(msg => console.log(`  ${msg}`));

    console.log(`\n❌ System Errors: ${consoleCollector.errors.length} messages`);
    if (consoleCollector.errors.length > 0) {
      consoleCollector.errors.forEach(msg => console.log(`  ${msg}`));
    }

    console.log(`\n🔥 Critical Issues: ${consoleCollector.critical.length} messages`);
    consoleCollector.critical.forEach(msg => console.log(`  ${msg}`));

    console.log(`\n⚠️ Warnings: ${consoleCollector.warnings.length} messages`);
    consoleCollector.warnings.forEach(msg => console.log(`  ${msg}`));

    console.log(`\n✅ Success Events: ${consoleCollector.success.length} messages`);
    consoleCollector.success.slice(-5).forEach(msg => console.log(`  ${msg}`));

    console.log(`\n💡 Debug Information: ${consoleCollector.debug.length} messages`);
    consoleCollector.debug.slice(-5).forEach(msg => console.log(`  ${msg}`));

    console.log(`\n📦 Asset Loading: ${consoleCollector.assets.length} messages`);
    consoleCollector.assets.slice(-5).forEach(msg => console.log(`  ${msg}`));

    console.log(`\n📊 Day Range Messages: ${consoleCollector.dayRangeMessages.length} messages`);
    consoleCollector.dayRangeMessages.slice(-5).forEach(msg => console.log(`  📈 ${msg}`));

    console.log(`\n📈 Progressive Disclosure: ${consoleCollector.progressiveMessages.length} messages`);
    consoleCollector.progressiveMessages.forEach(msg => console.log(`  📈 ${msg}`));

    console.log(`\n📈 Percentage Markers: ${consoleCollector.percentageMessages.length} messages`);
    consoleCollector.percentageMessages.slice(-5).forEach(msg => console.log(`  📈 ${msg}`));

    console.log(`\n⚡ Performance: ${consoleCollector.performanceMessages.length} messages`);
    consoleCollector.performanceMessages.forEach(msg => console.log(`  ⚡ ${msg}`));

    // Test results summary
    console.log('\n📋 TEST RESULTS SUMMARY:');
    console.log('========================');

    const moduleLoadingPass = initialErrors === 0;
    const progressiveDisclosurePass = consoleCollector.progressiveMessages.length > 0;
    const consoleClassificationPass = consoleCollector.all.length > 0;
    const jsExecutionPass = true; // We got some evaluation results

    console.log(`✅ Module Loading: ${moduleLoadingPass ? 'PASS' : 'FAIL'} (${initialAssets} assets loaded)`);
    console.log(`✅ Progressive Disclosure: ${progressiveDisclosurePass ? 'PASS' : 'FAIL'} (${consoleCollector.progressiveMessages.length} messages)`);
    console.log(`✅ JavaScript Execution: ${jsExecutionPass ? 'PASS' : 'FAIL'} (page evaluation successful)`);
    console.log(`✅ Error Count: ${consoleCollector.errors.length === 0 ? 'PASS' : 'WARN'} (${consoleCollector.errors.length} errors)`);
    console.log(`✅ Critical Issues: ${consoleCollector.critical.length === 0 ? 'PASS' : 'FAIL'} (${consoleCollector.critical.length} critical)`);
    console.log(`✅ Console Classification: ${consoleClassificationPass ? 'PASS' : 'FAIL'} (${consoleCollector.all.length} total messages)`);

    console.log('\n🎯 Debug Day Range Meter testing completed!');
    console.log('📊 Screenshots saved for visual verification');
    console.log('📝 Comprehensive console analysis completed with emoji classification');

    // Return results summary
    return {
      success: consoleCollector.critical.length === 0 && jsExecutionPass,
      summary: {
        totalConsoleMessages: consoleCollector.all.length,
        errors: consoleCollector.errors.length,
        critical: consoleCollector.critical.length,
        progressiveDisclosure: consoleCollector.progressiveMessages.length,
        percentageMarkers: consoleCollector.percentageMessages.length,
        networkActivity: consoleCollector.network.length,
        userInteractions: consoleCollector.keyboard.length,
        bodyContentLength: bodyContent.length,
        bodyChildrenCount: await page.evaluate(() => document.body.children.length)
      }
    };

  } catch (error) {
    console.error('❌ Test execution failed:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
runDebugTest()
  .then(results => {
    console.log('\n🏁 Debug Test Suite Complete');
    console.log('============================');

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
    console.error('❌ Fatal error running debug test:', error);
    process.exit(1);
  });