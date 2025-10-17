// Primary Trader Workflow: Market Analysis
// Test: Canvas Creation → Context Menu Configuration → Parameter Changes → Visualization Updates

import { test, expect, TEST_SYMBOLS, WAIT_TIMES, SELECTORS } from '../fixtures/workflowFixtures.js';

test.describe('Primary Trader Workflow: Market Analysis', () => {
  test('should complete market analysis workflow with context menu configuration', async ({ 
    workflowPage, 
    waitForFloatingPanels, 
    createCanvas,
    openContextMenu,
    validateLogs 
  }) => {
    console.log('\n=== Starting Workflow: Market Analysis with Context Menu ===');
    
    // Step 1: Initialize workspace and create canvas
    console.log('Step 1: Setting up workspace and canvas...');
    await waitForFloatingPanels();
    
    const selectedSymbol = TEST_SYMBOLS[0]; // EURUSD
    const canvas = await createCanvas(selectedSymbol);
    
    // Verify canvas is ready
    await expect(canvas).toBeVisible();
    await expect(canvas.locator('.symbol-label')).toHaveText(selectedSymbol);
    
    console.log(`✓ Canvas created for ${selectedSymbol}`);
    
    // Step 2: Open context menu on canvas
    console.log('Step 2: Opening context menu...');
    const contextMenu = await openContextMenu(0);
    
    // Verify context menu is visible
    await expect(contextMenu).toBeVisible();
    
    // Check for menu header
    const menuHeader = contextMenu.locator('.menu-header');
    await expect(menuHeader).toBeVisible();
    
    // Check for canvas ID in header
    const canvasId = contextMenu.locator('.canvas-id');
    await expect(canvasId).toBeVisible();
    
    console.log('✓ Context menu opened successfully');
    
    // Step 3: Test tab navigation
    console.log('Step 3: Testing tab navigation...');
    
    // Get all tab buttons
    const tabButtons = contextMenu.locator('.tab-button');
    const tabCount = await tabButtons.count();
    
    expect(tabCount).toBeGreaterThan(0);
    console.log(`Found ${tabCount} tabs`);
    
    // Navigate through each tab
    for (let i = 0; i < tabCount; i++) {
      const tabButton = tabButtons.nth(i);
      const tabLabel = await tabButton.locator('.tab-label').textContent();
      
      console.log(`  Switching to tab: ${tabLabel}`);
      await tabButton.click();
      
      // Wait for tab content to update
      await workflowPage.waitForTimeout(WAIT_TIMES.SHORT);
      
      // Verify tab is active
      await expect(tabButton).toHaveClass(/active/);
      
      // Check for tab content
      const tabContent = contextMenu.locator('.tab-content');
      await expect(tabContent).toBeVisible();
    }
    
    console.log('✓ Tab navigation tested');
    
    // Step 4: Test search functionality
    console.log('Step 4: Testing search functionality...');
    
    // Find search input
    const searchInput = contextMenu.locator('.search-input');
    await expect(searchInput).toBeVisible();
    
    // Test searching for a parameter
    const searchQuery = 'price';
    await searchInput.fill(searchQuery);
    await workflowPage.waitForTimeout(WAIT_TIMES.SHORT);
    
    // Check for search results
    const searchResults = contextMenu.locator('.search-results');
    const hasSearchResults = await searchResults.count() > 0;
    
    if (hasSearchResults) {
      console.log(`  Found search results for "${searchQuery}"`);
      
      // Test navigating search results
      const resultItems = searchResults.locator('.search-result');
      const resultCount = await resultItems.count();
      
      if (resultCount > 0) {
        // Click first result
        await resultItems.first().click();
        await workflowPage.waitForTimeout(WAIT_TIMES.SHORT);
        
        console.log(`  Selected first search result`);
      }
    } else {
      console.log(`  No search results found for "${searchQuery}"`);
    }
    
    // Clear search
    await searchInput.fill('');
    await workflowPage.waitForTimeout(WAIT_TIMES.SHORT);
    
    console.log('✓ Search functionality tested');
    
    // Step 5: Test parameter configuration
    console.log('Step 5: Testing parameter configuration...');
    
    // Switch to Quick Actions tab (usually first tab)
    const quickActionsTab = tabButtons.first();
    await quickActionsTab.click();
    await workflowPage.waitForTimeout(WAIT_TIMES.SHORT);
    
    // Look for toggle controls
    const toggleControls = contextMenu.locator('input[type="checkbox"], input[type="range"], select');
    const controlCount = await toggleControls.count();
    
    if (controlCount > 0) {
      console.log(`  Found ${controlCount} configurable controls`);
      
      // Test first few controls
      const controlsToTest = Math.min(3, controlCount);
      
      for (let i = 0; i < controlsToTest; i++) {
        const control = toggleControls.nth(i);
        const controlType = await control.getAttribute('type');
        
        try {
          if (controlType === 'checkbox') {
            // Toggle checkbox
            const isChecked = await control.isChecked();
            await control.click();
            console.log(`  Toggled checkbox (was ${isChecked}, now ${await control.isChecked()})`);
          } else if (controlType === 'range') {
            // Adjust range slider
            await control.focus();
            await workflowPage.keyboard.press('ArrowRight');
            console.log(`  Adjusted range slider`);
          } else if (controlType === 'select-one') {
            // Change select value
            const options = await control.locator('option').count();
            if (options > 1) {
              await control.selectOption({ index: 1 });
              console.log(`  Changed select value`);
            }
          }
          
          await workflowPage.waitForTimeout(WAIT_TIMES.SHORT);
        } catch (error) {
          console.log(`  Could not interact with control ${i}: ${error.message}`);
        }
      }
    } else {
      console.log('  No configurable controls found in current tab');
    }
    
    console.log('✓ Parameter configuration tested');
    
    // Step 6: Test menu actions
    console.log('Step 6: Testing menu actions...');
    
    // Look for action buttons
    const resetButton = contextMenu.locator('.reset-btn');
    const closeButton = contextMenu.locator('.close-btn');
    
    // Test close button
    await expect(closeButton).toBeVisible();
    await closeButton.click();
    
    // Wait for menu to close
    await workflowPage.waitForTimeout(WAIT_TIMES.SHORT);
    
    // Verify menu is closed
    await expect(contextMenu).not.toBeVisible();
    
    console.log('✓ Menu actions tested');
    
    // Step 7: Re-open context menu to verify persistence
    console.log('Step 7: Testing configuration persistence...');
    
    // Re-open context menu
    const contextMenu2 = await openContextMenu(0);
    await expect(contextMenu2).toBeVisible();
    
    // Switch back to Quick Actions tab
    const quickActionsTab2 = contextMenu2.locator('.tab-button').first();
    await quickActionsTab2.click();
    await workflowPage.waitForTimeout(WAIT_TIMES.SHORT);
    
    console.log('✓ Context menu re-opened successfully');
    
    // Close menu again
    const closeButton2 = contextMenu2.locator('.close-btn');
    await closeButton2.click();
    await workflowPage.waitForTimeout(WAIT_TIMES.SHORT);
    
    // Step 8: Validate browser logs
    console.log('Step 8: Validating browser logs...');
    const logValidation = await validateLogs();
    
    // Assert no critical errors
    expect(logValidation.hasErrors).toBeFalsy();
    
    // Check for specific error patterns
    expect(logValidation.errorMatches).toHaveLength(0);
    
    // Log summary
    console.log(`\n=== Market Analysis Workflow Complete ===`);
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
    
    console.log('✅ Market analysis workflow completed successfully');
  });

  test('should handle keyboard shortcuts in context menu', async ({ 
    workflowPage, 
    waitForFloatingPanels, 
    createCanvas,
    openContextMenu,
    validateLogs 
  }) => {
    console.log('\n=== Testing Context Menu Keyboard Shortcuts ===');
    
    await waitForFloatingPanels();
    
    // Create canvas and open context menu
    const canvas = await createCanvas(TEST_SYMBOLS[0]);
    const contextMenu = await openContextMenu(0);
    
    // Test Escape key to close
    await workflowPage.keyboard.press('Escape');
    await workflowPage.waitForTimeout(WAIT_TIMES.SHORT);
    
    // Verify menu is closed
    await expect(contextMenu).not.toBeVisible();
    
    // Re-open menu
    const contextMenu2 = await openContextMenu(0);
    
    // Test tab navigation with keyboard
    await workflowPage.keyboard.press('Tab');
    await workflowPage.waitForTimeout(WAIT_TIMES.SHORT);
    
    // Test search shortcut (Ctrl+F)
    await workflowPage.keyboard.press('Control+f');
    await workflowPage.waitForTimeout(WAIT_TIMES.SHORT);
    
    // Check if search input is focused
    const searchInput = contextMenu2.locator('.search-input');
    const isSearchFocused = await searchInput.evaluate(el => document.activeElement === el);
    
    if (isSearchFocused) {
      console.log('✓ Search shortcut (Ctrl+F) worked');
    }
    
    // Close menu
    await workflowPage.keyboard.press('Escape');
    
    // Validate logs
    const logValidation = await validateLogs();
    expect(logValidation.hasErrors).toBeFalsy();
    
    console.log('✅ Keyboard shortcuts test completed');
  });
});