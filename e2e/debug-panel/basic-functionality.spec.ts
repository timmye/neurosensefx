import { test, expect } from '@playwright/test';

test.describe('FloatingDebugPanel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Wait for the application to load
    await page.waitForSelector('.main-container', { timeout: 10000 });
    
    // Show workspace controls to access the debug panel toggle
    await page.click('.dev-controls button:has-text("Show Workspace Controls")');
  });

  test('should toggle debug panel visibility', async ({ page }) => {
    // Toggle debug panel on
    await page.click('button:has-text("Toggle Debug Panel")');
    
    // Check that debug panel is visible
    await expect(page.locator('.floating-debug-panel')).toBeVisible();
    
    // Toggle debug panel off
    await page.click('button:has-text("Toggle Debug Panel")');
    
    // Check that debug panel is hidden
    await expect(page.locator('.floating-debug-panel')).not.toBeVisible();
  });

  test('should display debug information when symbol is selected', async ({ page }) => {
    // First create a canvas to ensure we have symbol data
    await page.click('button:has-text("Toggle Symbol Palette")');
    await page.waitForSelector('.floating-symbol-palette');
    
    // Select a symbol if available
    const symbolOption = page.locator('.symbol-selection option').first();
    if (await symbolOption.count() > 0) {
      await symbolOption.click();
    }
    
    // Create a canvas
    await page.click('.create-btn:has-text("Create Canvas")');
    await page.waitForSelector('.floating-canvas', { timeout: 5000 });
    
    // Now show debug panel
    await page.click('button:has-text("Toggle Debug Panel")');
    await page.waitForSelector('.floating-debug-panel');
    
    // Check that debug sections are present
    const debugSections = page.locator('.debug-section');
    await expect(debugSections.first()).toBeVisible();
    
    // Check that symbol information is displayed if a symbol is selected
    const symbolHeader = page.locator('.debug-symbol-header');
    if (await symbolHeader.count() > 0) {
      await expect(symbolHeader).toBeVisible();
    }
  });

  test('should be draggable and maintain position', async ({ page }) => {
    // Show debug panel
    await page.click('button:has-text("Toggle Debug Panel")');
    await page.waitForSelector('.floating-debug-panel');
    
    // Get initial position
    const debugPanel = page.locator('.floating-debug-panel');
    await debugPanel.waitFor({ state: 'visible' });
    const initialBox = await debugPanel.boundingBox();
    expect(initialBox).toBeTruthy();
    
    // Drag the panel using the drag handle
    const dragHandle = page.locator('.debug-drag-handle');
    await dragHandle.hover();
    await page.mouse.down();
    await page.mouse.move(initialBox!.x + 100, initialBox!.y + 50);
    await page.mouse.up();
    
    // Wait a moment for position to update
    await page.waitForTimeout(500);
    
    // Check that position has changed
    const newBox = await debugPanel.boundingBox();
    expect(newBox).toBeTruthy();
    expect(newBox!.x).toBeGreaterThan(initialBox!.x);
    expect(newBox!.y).toBeGreaterThan(initialBox!.y);
  });

  test('should support minimize and close functionality', async ({ page }) => {
    // Show debug panel
    await page.click('button:has-text("Toggle Debug Panel")');
    await page.waitForSelector('.floating-debug-panel');
    
    // Check that minimize button works
    await page.click('.minimize-btn');
    await page.waitForTimeout(500); // Wait for state to update
    
    // Check if the panel content is hidden (minimized state)
    const debugContent = page.locator('.debug-content');
    await expect(debugContent).not.toBeVisible();
    
    // Restore from minimized
    await page.click('.minimize-btn');
    await page.waitForTimeout(500); // Wait for state to update
    
    // Check that content is visible again
    await expect(debugContent).toBeVisible();
    
    // Check that close button works
    await page.click('.close-btn');
    await expect(page.locator('.floating-debug-panel')).not.toBeVisible();
  });
});