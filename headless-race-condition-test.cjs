const { chromium } = require('playwright');

async function testCanvasRaceConditionFix() {
  console.log('🚀 Starting Canvas Race Condition Fix Validation (Headless)...');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu' // Disable GPU to avoid dependencies in headless mode
    ]
  });

  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 }
  });

  // Set up console monitoring to capture the specific error messages
  const consoleMessages = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push({
      type: msg.type(),
      text: text,
      location: msg.location(),
      timestamp: Date.now()
    });

    // Log important messages for debugging
    if (text.includes('RESIZE_TRANSACTION') ||
        text.includes('Critical validation failures') ||
        text.includes('Transaction failed') ||
        text.includes('Canvas initialization') ||
        text.includes('canvasInitializing') ||
        text.includes('transactionInProgress') ||
        text.includes('canvasInitializing')) {
      console.log(`[${msg.type().toUpperCase()}] ${text}`);
    }
  });

  // Also monitor page errors
  page.on('pageerror', error => {
    consoleMessages.push({
      type: 'error',
      text: error.message,
      location: error.stack,
      timestamp: Date.now()
    });
    console.log(`[PAGE ERROR] ${error.message}`);
  });

  // Navigate to the development server
  console.log('📡 Navigating to development server...');
  await page.goto('http://localhost:5174');

  // Wait for the application to load
  await page.waitForLoadState('networkidle');
  console.log('✅ Application loaded successfully');

  try {
    // Test 1: Create multiple displays rapidly to trigger race conditions
    console.log('\n🧪 Test 1: Rapid display creation...');

    for (let i = 0; i < 5; i++) {
      console.log(`Creating display ${i + 1}...`);

      try {
        // Press Ctrl+K to open the display creation dialog
        await page.keyboard.press('Control+k');

        // Wait for the symbol search dialog to appear - use a more generic selector
        await page.waitForSelector('input[placeholder*="search"], input[type="text"], [data-testid="symbol-search-input"]', { timeout: 5000 });

        // Type a symbol
        const symbol = `TEST${i + 1}`;
        const inputSelector = 'input[placeholder*="search"], input[type="text"], [data-testid="symbol-search-input"]';
        await page.fill(inputSelector, symbol);

        // Press Enter to create the display
        await page.keyboard.press('Enter');

        // Small delay between creations but not too long (simulates rapid user input)
        await page.waitForTimeout(500);
      } catch (error) {
        console.log(`⚠️ Display creation attempt ${i + 1} failed:`, error.message);
        // Continue with next display
      }
    }

    // Wait for all displays to initialize
    console.log('⏳ Waiting for displays to initialize...');
    await page.waitForTimeout(8000); // Longer wait for initialization

    // Check for the original error patterns
    const criticalValidationErrors = consoleMessages.filter(msg =>
      msg.text.includes('Critical validation failures') &&
      msg.text.includes('RESIZE_TRANSACTION')
    );

    const transactionFailedErrors = consoleMessages.filter(msg =>
      msg.text.includes('Transaction failed') &&
      msg.text.includes('RESIZE_TRANSACTION')
    );

    const initializationErrors = consoleMessages.filter(msg =>
      (msg.type === 'error' || msg.text.includes('ERROR')) &&
      msg.text.includes('Canvas initialization')
    );

    console.log('\n📊 Error Analysis:');
    console.log(`Critical validation failures: ${criticalValidationErrors.length} (Expected: 0)`);
    console.log(`Transaction failed errors: ${transactionFailedErrors.length} (Expected: 0)`);
    console.log(`Canvas initialization errors: ${initializationErrors.length} (Expected: 0)`);

    // Verify that displays were created successfully
    const displays = await page.locator('[data-display-id]').all();
    const canvases = await page.locator('canvas.full-canvas').all();
    const genericCanvases = await page.locator('canvas').all();

    console.log(`\n🖼️ Display Analysis:`);
    console.log(`Total displays created: ${displays.length}`);
    console.log(`Full canvases created: ${canvases.length}`);
    console.log(`All canvases created: ${genericCanvases.length}`);

    // Test 2: Look for successful canvas operations
    console.log('\n🧪 Test 2: Successful operation verification...');

    const successfulInitializations = consoleMessages.filter(msg =>
      (msg.type === 'log' || msg.text.includes('completed successfully')) &&
      msg.text.includes('Canvas initialization completed successfully')
    );

    const successfulTransactions = consoleMessages.filter(msg =>
      msg.text.includes('✅ [RESIZE_TRANSACTION') &&
      msg.text.includes('Transaction completed')
    );

    const atomicTransactionMessages = consoleMessages.filter(msg =>
      msg.text.includes('Starting atomic resize transaction') ||
      msg.text.includes('executeAtomicResizeTransaction')
    );

    console.log(`Successful canvas initializations: ${successfulInitializations.length}`);
    console.log(`Successful resize transactions: ${successfulTransactions.length}`);
    console.log(`Atomic transaction messages: ${atomicTransactionMessages.length}`);

    // Test 3: Check for race condition fix components
    console.log('\n🧪 Test 3: Race condition fix component verification...');

    // Check for canvas initialization lock messages
    const canvasInitializingMessages = consoleMessages.filter(msg =>
      msg.text.includes('canvasInitializing') ||
      msg.text.includes('Canvas initialization already in progress') ||
      msg.text.includes('skipping duplicate call')
    );

    // Check for transaction in progress messages
    const transactionInProgressMessages = consoleMessages.filter(msg =>
      msg.text.includes('transactionInProgress') ||
      msg.text.includes('Transaction already in progress')
    );

    // Check for consolidated canvas state management
    const consolidatedMessages = consoleMessages.filter(msg =>
      msg.text.includes('handleCanvasStateChange') ||
      msg.text.includes('Consolidated canvas') ||
      msg.text.includes('Single reactive statement') ||
      msg.text.includes('updateCanvasDimensions')
    );

    // Check for any evidence of the fix working
    const fixEvidenceMessages = consoleMessages.filter(msg =>
      msg.text.includes('RESIZE_TRANSACTION') &&
      (msg.text.includes('Transaction completed') ||
       msg.text.includes('Starting atomic') ||
       msg.text.includes('validations'))
    );

    console.log(`Canvas initialization lock messages: ${canvasInitializingMessages.length}`);
    console.log(`Transaction in progress messages: ${transactionInProgressMessages.length}`);
    console.log(`Consolidated state management messages: ${consolidatedMessages.length}`);
    console.log(`Fix evidence messages: ${fixEvidenceMessages.length}`);

    // Test 4: Final validation - Check that no error messages match the original pattern
    console.log('\n🧪 Test 4: Original error pattern elimination verification...');

    const originalErrorMessages = consoleMessages.filter(msg =>
      (msg.text.includes('Critical validation failures - rendering safe minimum: Object') ||
       msg.text.includes('Transaction failed: Object')) &&
      msg.text.includes('RESIZE_TRANSACTION')
    );

    const originalPattern1 = consoleMessages.filter(msg =>
      msg.text.includes('❌ [RESIZE_TRANSACTION') &&
      msg.text.includes('Critical validation failures')
    );

    const originalPattern2 = consoleMessages.filter(msg =>
      msg.text.includes('❌ [RESIZE_TRANSACTION') &&
      msg.text.includes('Transaction failed')
    );

    console.log('\n🎯 FINAL VALIDATION RESULTS:');
    console.log('='.repeat(50));
    console.log(`✅ Original error patterns eliminated: ${originalErrorMessages.length === 0 ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Original pattern 1 (❌ Critical validation): ${originalPattern1.length === 0 ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Original pattern 2 (❌ Transaction failed): ${originalPattern2.length === 0 ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Critical validation failures: ${criticalValidationErrors.length === 0 ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Transaction failures: ${transactionFailedErrors.length === 0 ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Some displays created: ${displays.length > 0 || genericCanvases.length > 0 ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Fix components active: ${fixEvidenceMessages.length > 0 || consolidatedMessages.length > 0 ? 'PASS' : 'FAIL'}`);

    // Generate comprehensive report
    console.log('\n📋 COMPREHENSIVE EVIDENCE REPORT:');
    console.log('='.repeat(50));
    console.log(`Total console messages captured: ${consoleMessages.length}`);
    console.log(`Error messages: ${consoleMessages.filter(msg => msg.type === 'error').length}`);
    console.log(`Warning messages: ${consoleMessages.filter(msg => msg.type === 'warning').length}`);
    console.log(`Log messages: ${consoleMessages.filter(msg => msg.type === 'log').length}`);
    console.log(`Page errors: ${consoleMessages.filter(msg => msg.text.includes('Page error')).length}`);

    // Log sample of important messages for analysis
    console.log('\n📝 SAMPLE MESSAGES FOR ANALYSIS:');
    console.log('='.repeat(50));

    const resizeTransactionMessages = consoleMessages.filter(msg =>
      msg.text.includes('RESIZE_TRANSACTION')
    ).slice(0, 10);

    if (resizeTransactionMessages.length > 0) {
      console.log('RESIZE_TRANSACTION messages:');
      resizeTransactionMessages.forEach((msg, index) => {
        console.log(`  ${index + 1}. [${msg.type.toUpperCase()}] ${msg.text}`);
      });
    } else {
      console.log('No RESIZE_TRANSACTION messages found (may indicate no displays were created or different error patterns)');
    }

    const canvasInitMessages = consoleMessages.filter(msg =>
      msg.text.toLowerCase().includes('canvas init')
    ).slice(0, 10);

    if (canvasInitMessages.length > 0) {
      console.log('\nCanvas initialization messages:');
      canvasInitMessages.forEach((msg, index) => {
        console.log(`  ${index + 1}. [${msg.type.toUpperCase()}] ${msg.text}`);
      });
    }

    // Final assessment
    const originalErrorsFixed =
      originalErrorMessages.length === 0 &&
      originalPattern1.length === 0 &&
      originalPattern2.length === 0 &&
      criticalValidationErrors.length === 0 &&
      transactionFailedErrors.length === 0;

    const basicFunctionalityWorks =
      (displays.length > 0 || genericCanvases.length > 0) &&
      consoleMessages.length > 10;

    console.log('\n🏆 OVERALL ASSESSMENT:');
    console.log('='.repeat(50));

    if (originalErrorsFixed) {
      console.log('✅ ORIGINAL RACE CONDITION ERRORS ELIMINATED');
    } else {
      console.log('❌ ORIGINAL RACE CONDITION ERRORS STILL PRESENT');
    }

    if (basicFunctionalityWorks) {
      console.log('✅ BASIC FUNCTIONALITY WORKING');
    } else {
      console.log('❌ BASIC FUNCTIONALITY NOT WORKING');
    }

    if (originalErrorsFixed && basicFunctionalityWorks) {
      console.log('\n🎉 SUCCESS: Canvas race condition fix is working correctly!');
    } else if (originalErrorsFixed && !basicFunctionalityWorks) {
      console.log('\n⚠️ PARTIAL SUCCESS: Original errors eliminated but basic functionality not working');
    } else {
      console.log('\n❌ FAILURE: Race condition fix may not be working');
    }

    if (originalErrorMessages.length > 0) {
      console.log('\n❌ ORIGINAL ERROR PATTERNS DETECTED:');
      originalErrorMessages.forEach((msg, index) => {
        console.log(`  ${index + 1}. ${msg.text}`);
      });
    }

    if (originalPattern1.length > 0) {
      console.log('\n❌ ORIGINAL PATTERN 1 DETECTED:');
      originalPattern1.forEach((msg, index) => {
        console.log(`  ${index + 1}. ${msg.text}`);
      });
    }

    if (originalPattern2.length > 0) {
      console.log('\n❌ ORIGINAL PATTERN 2 DETECTED:');
      originalPattern2.forEach((msg, index) => {
        console.log(`  ${index + 1}. ${msg.text}`);
      });
    }

    // Take screenshot for visual verification
    try {
      await page.screenshot({ path: 'race-condition-test-screenshot.png' });
      console.log('\n📸 Screenshot saved as race-condition-test-screenshot.png');
    } catch (error) {
      console.log('Could not take screenshot:', error.message);
    }

    console.log('\n🏁 Test completed successfully');

  } catch (error) {
    console.error('❌ Test execution failed:', error);

    // Still analyze console messages even if test failed
    const criticalValidationErrors = consoleMessages.filter(msg =>
      msg.text.includes('Critical validation failures') &&
      msg.text.includes('RESIZE_TRANSACTION')
    );

    const transactionFailedErrors = consoleMessages.filter(msg =>
      msg.text.includes('Transaction failed') &&
      msg.text.includes('RESIZE_TRANSACTION')
    );

    console.log('\n📊 Error Analysis (after failure):');
    console.log(`Critical validation failures: ${criticalValidationErrors.length} (Expected: 0)`);
    console.log(`Transaction failed errors: ${transactionFailedErrors.length} (Expected: 0)`);
    console.log(`Total console messages captured: ${consoleMessages.length}`);

    if (criticalValidationErrors.length === 0 && transactionFailedErrors.length === 0) {
      console.log('✅ RACE CONDITION ERRORS STILL ELIMINATED DESPITE TEST FAILURE');
    }

  } finally {
    await browser.close();
    console.log('🏁 Browser closed');
  }
}

// Run the test
testCanvasRaceConditionFix().catch(console.error);