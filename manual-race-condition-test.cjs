const { chromium } = require('playwright');

async function testCanvasRaceConditionFix() {
  console.log('🚀 Starting Canvas Race Condition Fix Validation...');

  const browser = await chromium.launch({
    headless: false, // Show browser for visual verification
    args: [
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--no-sandbox',
      '--disable-dev-shm-usage'
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
        text.includes('transactionInProgress')) {
      console.log(`[${msg.type().toUpperCase()}] ${text}`);
    }
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

      // Press Ctrl+K to open the display creation dialog
      await page.keyboard.press('Control+k');

      // Wait for the symbol search dialog to appear
      await page.waitForSelector('[data-testid="symbol-search-input"]', { timeout: 5000 });

      // Type a symbol
      const symbol = `TEST${i + 1}`;
      await page.fill('[data-testid="symbol-search-input"]', symbol);

      // Press Enter to create the display
      await page.keyboard.press('Enter');

      // Small delay between creations but not too long (simulates rapid user input)
      await page.waitForTimeout(300);
    }

    // Wait for all displays to initialize
    console.log('⏳ Waiting for displays to initialize...');
    await page.waitForTimeout(5000);

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
      msg.type === 'error' &&
      msg.text.includes('Canvas initialization')
    );

    console.log('\n📊 Error Analysis:');
    console.log(`Critical validation failures: ${criticalValidationErrors.length} (Expected: 0)`);
    console.log(`Transaction failed errors: ${transactionFailedErrors.length} (Expected: 0)`);
    console.log(`Canvas initialization errors: ${initializationErrors.length} (Expected: 0)`);

    // Verify that displays were created successfully
    const displays = await page.locator('[data-display-id]').all();
    const canvases = await page.locator('canvas.full-canvas').all();

    console.log(`\n🖼️ Display Analysis:`);
    console.log(`Total displays created: ${displays.length}`);
    console.log(`Total canvases created: ${canvases.length}`);

    // Test 2: Test concurrent resize operations
    console.log('\n🧪 Test 2: Concurrent resize operations...');

    if (displays.length > 0) {
      const firstDisplay = displays[0];

      // Get initial position
      const initialBox = await firstDisplay.boundingBox();
      console.log(`Initial display size: ${initialBox.width}x${initialBox.height}`);

      // Perform multiple rapid resize operations
      for (let i = 0; i < 3; i++) {
        console.log(`Resize operation ${i + 1}...`);

        // Simulate resize by dragging from different corners
        await firstDisplay.hover({ position: { x: initialBox.width - 10, y: initialBox.height - 10 } });
        await page.mouse.down();

        // Move to new position
        const newX = initialBox.x + initialBox.width + (i * 30);
        const newY = initialBox.y + initialBox.height + (i * 25);

        await page.mouse.move(newX, newY);
        await page.waitForTimeout(200);
        await page.mouse.up();

        await page.waitForTimeout(300);
      }

      // Wait for resize operations to complete
      await page.waitForTimeout(2000);
    }

    // Test 3: Check for transaction conflicts
    console.log('\n🧪 Test 3: Transaction conflict detection...');

    const transactionConflicts = consoleMessages.filter(msg =>
      msg.text.includes('Transaction already in progress') ||
      msg.text.includes('concurrent transactions')
    );

    const duplicateInitWarnings = consoleMessages.filter(msg =>
      msg.text.includes('Canvas initialization already in progress') ||
      msg.text.includes('skipping duplicate call')
    );

    console.log(`Transaction conflicts detected: ${transactionConflicts.length}`);
    console.log(`Duplicate initialization warnings: ${duplicateInitWarnings.length}`);

    // Test 4: Check for successful operations
    console.log('\n🧪 Test 4: Successful operation verification...');

    const successfulInitializations = consoleMessages.filter(msg =>
      msg.type === 'log' &&
      msg.text.includes('Canvas initialization completed successfully')
    );

    const successfulTransactions = consoleMessages.filter(msg =>
      msg.text.includes('✅ [RESIZE_TRANSACTION') &&
      msg.text.includes('Transaction completed')
    );

    console.log(`Successful canvas initializations: ${successfulInitializations.length}`);
    console.log(`Successful resize transactions: ${successfulTransactions.length}`);

    // Final validation: Check that no error messages match the original pattern
    const originalErrorMessages = consoleMessages.filter(msg =>
      (msg.text.includes('Critical validation failures - rendering safe minimum: Object') ||
       msg.text.includes('Transaction failed: Object')) &&
      msg.text.includes('RESIZE_TRANSACTION')
    );

    console.log('\n🎯 FINAL VALIDATION RESULTS:');
    console.log('='.repeat(50));
    console.log(`✅ Original error patterns eliminated: ${originalErrorMessages.length === 0 ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Critical validation failures: ${criticalValidationErrors.length === 0 ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Transaction failures: ${transactionFailedErrors.length === 0 ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Displays created successfully: ${displays.length >= 5 ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Canvases initialized: ${canvases.length >= 5 ? 'PASS' : 'FAIL'}`);
    console.log(`✅ No transaction conflicts: ${transactionConflicts.length === 0 ? 'PASS' : 'EXPECTED'}`);

    // Generate comprehensive report
    console.log('\n📋 COMPREHENSIVE EVIDENCE REPORT:');
    console.log('='.repeat(50));
    console.log(`Total console messages captured: ${consoleMessages.length}`);
    console.log(`Error messages: ${consoleMessages.filter(msg => msg.type === 'error').length}`);
    console.log(`Warning messages: ${consoleMessages.filter(msg => msg.type === 'warning').length}`);
    console.log(`Log messages: ${consoleMessages.filter(msg => msg.type === 'log').length}`);

    // Test specific race condition fix components
    console.log('\n🔧 RACE CONDITION FIX COMPONENTS VERIFICATION:');
    console.log('='.repeat(50));

    // Check for canvas initialization lock messages
    const canvasInitializingMessages = consoleMessages.filter(msg =>
      msg.text.includes('canvasInitializing')
    );
    console.log(`Canvas initialization lock messages: ${canvasInitializingMessages.length}`);

    // Check for transaction in progress messages
    const transactionInProgressMessages = consoleMessages.filter(msg =>
      msg.text.includes('transactionInProgress')
    );
    console.log(`Transaction in progress messages: ${transactionInProgressMessages.length}`);

    // Check for consolidated canvas state management
    const consolidatedMessages = consoleMessages.filter(msg =>
      msg.text.includes('handleCanvasStateChange') ||
      msg.text.includes('Consolidated canvas') ||
      msg.text.includes('Single reactive statement')
    );
    console.log(`Consolidated state management messages: ${consolidatedMessages.length}`);

    // Final assessment
    const allTestsPassed =
      originalErrorMessages.length === 0 &&
      criticalValidationErrors.length === 0 &&
      transactionFailedErrors.length === 0 &&
      displays.length >= 5 &&
      canvases.length >= 5;

    console.log('\n🏆 OVERALL ASSESSMENT:');
    console.log('='.repeat(50));
    console.log(allTestsPassed ? '✅ ALL TESTS PASSED - Race condition fix is working correctly!' : '❌ Some tests failed - Race condition may still exist');

    if (originalErrorMessages.length > 0) {
      console.log('\n❌ ORIGINAL ERROR PATTERNS DETECTED:');
      originalErrorMessages.forEach((msg, index) => {
        console.log(`  ${index + 1}. ${msg.text}`);
      });
    }

    // Keep browser open for manual inspection if any issues found
    if (!allTestsPassed) {
      console.log('\n⚠️  Keeping browser open for manual inspection. Press Ctrl+C to close...');
      await new Promise(resolve => {
        process.on('SIGINT', resolve);
      });
    }

    console.log('\n🔍 Visual validation: Browser will remain open for 30 seconds...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('❌ Test execution failed:', error);
    console.log('\nKeeping browser open for debugging...');
    await page.waitForTimeout(30000);
  } finally {
    await browser.close();
    console.log('🏁 Test completed');
  }
}

// Run the test
testCanvasRaceConditionFix().catch(console.error);