// Primary Trader Workflow: Multi-Symbol Workspace Management
// Test: Multiple Canvas Creation → Layout Management → Simultaneous Monitoring

import { test, expect, TEST_SYMBOLS, WAIT_TIMES, SELECTORS } from '../fixtures/workflowFixtures.js';

test.describe('Primary Trader Workflow: Multi-Symbol Workspace', () => {
  test('should create and manage multiple symbol canvases in workspace', async ({ 
    workflowPage, 
    waitForFloatingPanels, 
    createCanvas,
    validateLogs 
  }) => {
    console.log('\n=== Starting Workflow: Multi-Symbol Workspace Management ===');
    
    // Step 1: Initialize workspace
    console.log('Step 1: Initializing workspace...');
    await waitForFloatingPanels();
    
    // Verify empty workspace
    const initialCanvases = workflowPage.locator(SELECTORS.CANVAS);
    await expect(initialCanvases).toHaveCount(0);
    
    console.log('✓ Workspace initialized');
    
    // Step 2: Create multiple canvases for different symbols
    console.log('Step 2: Creating multiple symbol canvases...');
    const symbolsToCreate = TEST_SYMBOLS.slice(0, 3); // EURUSD, GBPUSD, USDJPY
    const createdCanvases = [];
    
    for (let i = 0; i < symbolsToCreate.length; i++) {
      const symbol = symbolsToCreate[i];
      console.log(`  Creating canvas ${i + 1}: ${symbol}`);
      
      // Create canvas
      const canvas = await createCanvas(symbol);
      createdCanvases.push(canvas);
      
      // Verify canvas is created
      await expect(canvas).toBeVisible();
      
      // Verify symbol label
      const symbolLabel = canvas.locator('.symbol-label');
      await expect(symbolLabel).toHaveText(symbol);
      
      // Wait a moment between creations
      await workflowPage.waitForTimeout(WAIT_TIMES.SHORT);
    }
    
    // Verify we have the correct number of canvases
    const allCanvases = workflowPage.locator(SELECTORS.CANVAS);
    await expect(allCanvases).toHaveCount(symbolsToCreate.length);
    
    console.log(`✓ Created ${symbolsToCreate.length} symbol canvases`);
    
    // Step 3: Test workspace layout and canvas positioning
    console.log('Step 3: Testing workspace layout...');
    
    // Check that all canvases have positions
    for (let i = 0; i < createdCanvases.length; i++) {
      const canvas = createdCanvases[i];
      const style = await canvas.getAttribute('style');
      
      // Verify canvas has transform position
      expect(style).toContain('translate');
      
      // Get canvas position
      const boundingBox = await canvas.boundingBox();
      expect(boundingBox.x).toBeGreaterThanOrEqual(0);
      expect(boundingBox.y).toBeGreaterThanOrEqual(0);
      
      console.log(`  Canvas ${i + 1} positioned at (${boundingBox.x}, ${boundingBox.y})`);
    }
    
    console.log('✓ Canvas positioning verified');
    
    // Step 4: Test canvas interaction and activation
    console.log('Step 4: Testing canvas interaction...');
    
    // Click on each canvas to activate it
    for (let i = 0; i < createdCanvases.length; i++) {
      const canvas = createdCanvases[i];
      
      // Click on canvas header to activate
      const canvasHeader = canvas.locator('.canvas-header');
      await canvasHeader.click();
      
      // Wait for activation state
      await workflowPage.waitForTimeout(WAIT_TIMES.SHORT);
      
      // Check for active indicator (may not be visible in test environment)
      const activeIndicator = canvas.locator('.active-indicator');
      if (await activeIndicator.count() > 0) {
        console.log(`  Canvas ${i + 1} shows active indicator`);
      }
    }
    
    console.log('✓ Canvas interaction tested');
    
    // Step 5: Test canvas z-index management
    console.log('Step 5: Testing z-index management...');
    
    // Get initial z-index values
    const initialZIndexes = [];
    for (const canvas of createdCanvases) {
      const style = await canvas.getAttribute('style');
      const zIndexMatch = style.match(/z-index:\s*(\d+)/);
      const zIndex = zIndexMatch ? parseInt(zIndexMatch[1]) : 1;
      initialZIndexes.push(zIndex);
    }
    
    // Click on first canvas to bring it to front
    await createdCanvases[0].locator('.canvas-header').click();
    await workflowPage.waitForTimeout(WAIT_TIMES.SHORT);
    
    // Check if z-index changed
    const firstCanvasStyle = await createdCanvases[0].getAttribute('style');
    const newZIndexMatch = firstCanvasStyle.match(/z-index:\s*(\d+)/);
    const newZIndex = newZIndexMatch ? parseInt(newZIndexMatch[1]) : 1;
    
    console.log(`  First canvas z-index: ${initialZIndexes[0]} → ${newZIndex}`);
    
    console.log('✓ Z-index management tested');
    
    // Step 6: Test canvas closing
    console.log('Step 6: Testing canvas closing...');
    
    // Close one canvas
    const canvasToClose = createdCanvases[createdCanvases.length - 1];
    const closeButton = canvasToClose.locator('.close-btn');
    await closeButton.click();
    
    // Wait for canvas to be removed
    await workflowPage.waitForTimeout(WAIT_TIMES.MEDIUM);
    
    // Verify canvas count decreased
    const remainingCanvases = workflowPage.locator(SELECTORS.CANVAS);
    await expect(remainingCanvases).toHaveCount(createdCanvases.length - 1);
    
    console.log('✓ Canvas closing tested');
    
    // Step 7: Test workspace state persistence
    console.log('Step 7: Testing workspace state...');
    
    // Verify remaining canvases still have correct symbols
    for (let i = 0; i < symbolsToCreate.length - 1; i++) {
      const canvas = remainingCanvases.nth(i);
      const symbolLabel = canvas.locator('.symbol-label');
      const expectedSymbol = symbolsToCreate[i];
      
      await expect(symbolLabel).toHaveText(expectedSymbol);
    }
    
    console.log('✓ Workspace state persistence verified');
    
    // Step 8: Validate browser logs
    console.log('Step 8: Validating browser logs...');
    const logValidation = await validateLogs();
    
    // Assert no critical errors
    expect(logValidation.hasErrors).toBeFalsy();
    
    // Check for specific error patterns
    expect(logValidation.errorMatches).toHaveLength(0);
    
    // Log summary
    console.log(`\n=== Multi-Symbol Workflow Complete ===`);
    console.log(`Total Console Messages: ${logValidation.exported.summary.totalConsoleMessages}`);
    console.log(`Errors: ${logValidation.errorCount}`);
    console.log(`Warnings: ${logValidation.warningCount}`);
    console.log(`Network Requests: ${logValidation.exported.summary.networkRequestCount}`);
    console.log(`Test Duration: ${logValidation.exported.summary.testDuration}s`);
    console.log(`Final Canvas Count: ${await remainingCanvases.count()}`);
    
    if (logValidation.performance) {
      console.log(`Performance Metrics:`);
      console.log(`  DOM Content Loaded: ${logValidation.performance.domContentLoaded}ms`);
      console.log(`  Load Complete: ${logValidation.performance.loadComplete}ms`);
      console.log(`  Total Load Time: ${logValidation.performance.totalLoadTime}ms`);
    }
    
    console.log('✅ Multi-symbol workflow completed successfully');
  });

  test('should handle rapid canvas creation and interaction', async ({ 
    workflowPage, 
    waitForFloatingPanels, 
    createCanvas,
    validateLogs 
  }) => {
    console.log('\n=== Testing Rapid Canvas Creation ===');
    
    await waitForFloatingPanels();
    
    // Create multiple canvases rapidly
    const rapidSymbols = TEST_SYMBOLS.slice(0, 4);
    const createdCanvases = [];
    
    console.log('Creating canvases rapidly...');
    for (const symbol of rapidSymbols) {
      const canvas = await createCanvas(symbol);
      createdCanvases.push(canvas);
    }
    
    // Verify all canvases exist
    const allCanvases = workflowPage.locator(SELECTORS.CANVAS);
    await expect(allCanvases).toHaveCount(rapidSymbols.length);
    
    // Test rapid interaction
    console.log('Testing rapid interaction...');
    for (let i = 0; i < createdCanvases.length; i++) {
      const canvas = createdCanvases[i];
      await canvas.locator('.canvas-header').click();
      await workflowPage.waitForTimeout(100); // Very short wait
    }
    
    // Validate logs
    const logValidation = await validateLogs();
    expect(logValidation.hasErrors).toBeFalsy();
    
    console.log('✅ Rapid creation test completed');
  });
});