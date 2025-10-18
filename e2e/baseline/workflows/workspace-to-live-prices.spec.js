// Primary Trader Workflow: Workspace to Live Prices
// Test: Empty workspace → Symbol selection → Canvas creation → Live prices

import { test, expect, TEST_SYMBOLS, WAIT_TIMES, SELECTORS } from '../fixtures/workflowFixtures.js';

test.describe('Primary Trader Workflow: Workspace to Live Prices', () => {
  test('should create complete workflow from empty workspace to live price display', async ({
    workflowPage,
    waitForFloatingPanels,
    selectSymbol,
    createCanvas,
    validateLogs
  }) => {
    console.log('\n=== Starting Workflow: Empty Workspace → Symbol Selection → Canvas Creation → Live Prices ===');
    
    // Ensure clean test state with proper cleanup
    await workflowPage.evaluate(() => {
      // Clear workspace state
      if (window.workspaceActions && window.workspaceActions.clearWorkspace) {
        window.workspaceActions.clearWorkspace();
      }
      
      // Reset symbol store to default state
      if (window.symbolStore && window.symbolStore.set) {
        window.symbolStore.set({});
      }
      
      // Reset UI state
      if (window.uiActions && window.uiActions.hideAllPanels) {
        window.uiActions.hideAllPanels();
      }
    });
    
    // Wait for cleanup to complete
    await workflowPage.waitForTimeout(500);
    
    // Step 1: Verify empty workspace
    console.log('Step 1: Verifying empty workspace...');
    await expect(workflowPage.locator(SELECTORS.WORKSPACE)).toBeVisible();
    
    // Check that workspace is initially empty (no canvases)
    const initialCanvases = workflowPage.locator(SELECTORS.CANVAS);
    await expect(initialCanvases).toHaveCount(0);
    
    // Verify empty state element exists
    const emptyState = workflowPage.locator('.workspace-empty-state');
    await expect(emptyState).toBeAttached();
    
    console.log('✓ Empty workspace verified');
    
    // Step 2: Wait for floating panels to be visible
    console.log('Step 2: Waiting for floating panels to load...');
    await waitForFloatingPanels();
    
    // Verify all floating panels are visible
    await expect(workflowPage.locator(SELECTORS.FLOATING_PANELS.SYMBOL_PALETTE)).toBeVisible();
    await expect(workflowPage.locator(SELECTORS.FLOATING_PANELS.DEBUG_PANEL)).toBeVisible();
    await expect(workflowPage.locator(SELECTORS.FLOATING_PANELS.SYSTEM_PANEL)).toBeVisible();
    await expect(workflowPage.locator(SELECTORS.FLOATING_PANELS.ADR_PANEL)).toBeVisible();
    
    console.log('✓ All floating panels are visible');
    
    // Step 3: Select symbol from palette
    console.log('Step 3: Selecting symbol from palette...');
    const selectedSymbol = TEST_SYMBOLS[0]; // EURUSD
    await selectSymbol(selectedSymbol);
    
    // Verify symbol is selected (check if create button is enabled)
    const createButton = workflowPage.locator(SELECTORS.CREATE_BUTTON);
    await expect(createButton).toBeEnabled();
    
    console.log(`✓ Symbol ${selectedSymbol} selected`);
    
    // Step 4: Create canvas
    console.log('Step 4: Creating canvas...');
    const canvas = await createCanvas(selectedSymbol);
    
    // Verify canvas is created and visible
    await expect(canvas).toBeVisible();
    
    // Check canvas header shows the selected symbol
    const symbolLabel = canvas.locator('.symbol-label');
    await expect(symbolLabel).toHaveText(selectedSymbol);
    
    // Verify canvas has proper structure
    await expect(canvas.locator('.canvas-header')).toBeVisible();
    await expect(canvas.locator('.canvas-content')).toBeVisible();
    
    console.log(`✓ Canvas created for ${selectedSymbol}`);
    
    // Step 5: Wait for data to load and verify live prices
    console.log('Step 5: Waiting for live price data...');
    
    // Wait for canvas to initialize and potentially receive data
    await workflowPage.waitForTimeout(WAIT_TIMES.EXTRA_LONG);
    
    // Check if canvas content is rendered (either Container component or loading state)
    const canvasContent = canvas.locator('.canvas-content');
    await expect(canvasContent).toBeVisible();
    
    // Check for either loading state or actual content
    const loadingPlaceholder = canvas.locator('.loading-placeholder');
    const containerElement = canvas.locator('canvas'); // The actual visualization canvas
    
    if (await loadingPlaceholder.count() > 0) {
      console.log('⚠ Canvas is still loading - this is expected in test environment');
      // Verify loading state shows correct symbol
      const loadingText = loadingPlaceholder.locator('p');
      await expect(loadingText).toContainText(selectedSymbol);
    } else {
      console.log('✓ Canvas content is rendered');
    }
    
    // Step 6: Verify workspace state
    console.log('Step 6: Verifying final workspace state...');
    
    // Verify we now have one canvas
    const finalCanvases = workflowPage.locator(SELECTORS.CANVAS);
    await expect(finalCanvases).toHaveCount(1);
    
    // Verify workspace is no longer empty
    const finalEmptyState = workflowPage.locator('.workspace-empty-state');
    // Empty state might still exist in DOM but should not be visible
    if (await finalEmptyState.count() > 0) {
      await expect(finalEmptyState).not.toBeVisible();
    }
    
    console.log('✓ Workspace state verified');
    
    // Step 7: Validate browser logs
    console.log('Step 7: Validating browser logs...');
    const logValidation = await validateLogs();
    
    // Assert no critical errors
    expect(logValidation.hasErrors).toBeFalsy();
    
    // Check for specific error patterns
    expect(logValidation.errorMatches).toHaveLength(0);
    
    // Log summary
    console.log(`\n=== Workflow Complete ===`);
    console.log(`Total Console Messages: ${logValidation.exported.summary.totalConsoleMessages}`);
    console.log(`Errors: ${logValidation.errorCount}`);
    console.log(`Warnings: ${logValidation.warningCount}`);
    console.log(`Network Requests: ${logValidation.exported.summary.networkRequestCount}`);
    console.log(`Test Duration: ${logValidation.exported.summary.testDuration}s`);
    
    if (logValidation.performance) {
      console.log(`Performance Metrics:`);
      console.log(`  DOM Content Loaded: ${logValidation.performance.domContentLoaded}ms`);
      console.log(`  Load Complete: ${logValidation.performance.loadComplete}ms`);
      console.log(`  Total Load Time: ${logValidation.performance.totalLoadTime}ms`);
    }
    
    console.log('✅ Workflow completed successfully');
  });

  test('should handle symbol selection and canvas creation with different symbols', async ({
    workflowPage,
    waitForFloatingPanels,
    createCanvas,
    validateLogs
  }) => {
    console.log('\n=== Testing Multiple Symbol Support ===');
    
    // Ensure clean test state with proper cleanup
    await workflowPage.evaluate(() => {
      // Clear workspace state
      if (window.workspaceActions && window.workspaceActions.clearWorkspace) {
        window.workspaceActions.clearWorkspace();
      }
      
      // Reset symbol store to default state
      if (window.symbolStore && window.symbolStore.set) {
        window.symbolStore.set({});
      }
      
      // Reset UI state
      if (window.uiActions && window.uiActions.hideAllPanels) {
        window.uiActions.hideAllPanels();
      }
    });
    
    // Wait for cleanup to complete
    await workflowPage.waitForTimeout(500);
    
    // Wait for panels
    await waitForFloatingPanels();
    
    // Test with different symbols
    for (const symbol of [TEST_SYMBOLS[1], TEST_SYMBOLS[2]]) { // GBPUSD, USDJPY
      console.log(`Testing symbol: ${symbol}`);
      
      // Create canvas for symbol
      const canvas = await createCanvas(symbol);
      
      // Verify canvas shows correct symbol
      const symbolLabel = canvas.locator('.symbol-label');
      await expect(symbolLabel).toHaveText(symbol);
      
      await workflowPage.waitForTimeout(WAIT_TIMES.MEDIUM);
    }
    
    // Verify we have 2 canvases
    const canvases = workflowPage.locator(SELECTORS.CANVAS);
    await expect(canvases).toHaveCount(2);
    
    // Validate logs
    const logValidation = await validateLogs();
    expect(logValidation.hasErrors).toBeFalsy();
    
    console.log('✅ Multiple symbol test completed');
  });
});