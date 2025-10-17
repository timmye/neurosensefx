// Enhanced CanvasContextMenu Test Suite
import { test, expect } from '@playwright/test';

test.describe('Enhanced CanvasContextMenu - Tab Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('should open context menu and display all 6 tabs', async ({ page }) => {
    // Right-click on workspace to open context menu
    await page.locator('.workspace-container').first().click({ button: 'right' });
    
    // Wait for context menu to appear
    const contextMenu = page.locator('.context-menu.enhanced');
    await expect(contextMenu).toBeVisible({ timeout: 3000 });
    
    // Check for all 6 tabs
    const tabButtons = contextMenu.locator('.tab-button');
    await expect(tabButtons).toHaveCount(6);
    
    // Verify tab titles
    const expectedTabs = ['Quick Actions', 'Price Display', 'Market Profile', 'Volatility', 'Layout & Sizing', 'Advanced'];
    for (let i = 0; i < expectedTabs.length; i++) {
      await expect(tabButtons.nth(i)).toContainText(expectedTabs[i]);
    }
    
    // First tab should be active by default
    await expect(tabButtons.first()).toHaveClass(/active/);
    
    // Close menu
    await page.keyboard.press('Escape');
  });

  test('should switch between tabs correctly', async ({ page }) => {
    // Open context menu
    await page.locator('.workspace-container').first().click({ button: 'right' });
    const contextMenu = page.locator('.context-menu.enhanced');
    await expect(contextMenu).toBeVisible();
    
    const tabButtons = contextMenu.locator('.tab-button');
    
    // Click on each tab and verify it becomes active
    for (let i = 0; i < 6; i++) {
      await tabButtons.nth(i).click();
      await page.waitForTimeout(200);
      
      // Check that this tab is now active
      await expect(tabButtons.nth(i)).toHaveClass(/active/);
      
      // Check that other tabs are not active
      for (let j = 0; j < 6; j++) {
        if (i !== j) {
          await expect(tabButtons.nth(j)).not.toHaveClass(/active/);
        }
      }
    }
    
    // Close menu
    await page.keyboard.press('Escape');
  });

  test('should display correct content for each tab', async ({ page }) => {
    // Open context menu
    await page.locator('.workspace-container').first().click({ button: 'right' });
    const contextMenu = page.locator('.context-menu.enhanced');
    await expect(contextMenu).toBeVisible();
    
    const tabButtons = contextMenu.locator('.tab-button');
    const tabContent = contextMenu.locator('.tab-content');
    
    // Test Quick Actions tab
    await tabButtons.nth(0).click();
    await page.waitForTimeout(200);
    await expect(tabContent).toContainText('Quick Actions');
    await expect(tabContent).toContainText('Essential toggles and show/hide controls');
    
    // Test Price Display tab
    await tabButtons.nth(1).click();
    await page.waitForTimeout(200);
    await expect(tabContent).toContainText('Price Display');
    await expect(tabContent).toContainText('Price float and display settings');
    
    // Test Market Profile tab
    await tabButtons.nth(2).click();
    await page.waitForTimeout(200);
    await expect(tabContent).toContainText('Market Profile');
    await expect(tabContent).toContainText('Market profile visualization settings');
    
    // Test Volatility tab
    await tabButtons.nth(3).click();
    await page.waitForTimeout(200);
    await expect(tabContent).toContainText('Volatility');
    await expect(tabContent).toContainText('Volatility orb and flash settings');
    
    // Test Layout & Sizing tab
    await tabButtons.nth(4).click();
    await page.waitForTimeout(200);
    await expect(tabContent).toContainText('Layout & Sizing');
    await expect(tabContent).toContainText('Dimensions and positioning');
    
    // Test Advanced tab
    await tabButtons.nth(5).click();
    await page.waitForTimeout(200);
    await expect(tabContent).toContainText('Advanced');
    await expect(tabContent).toContainText('Power user and experimental features');
    
    // Close menu
    await page.keyboard.press('Escape');
  });

  test('should display correct number of controls in each tab', async ({ page }) => {
    // Open context menu
    await page.locator('.workspace-container').first().click({ button: 'right' });
    const contextMenu = page.locator('.context-menu.enhanced');
    await expect(contextMenu).toBeVisible();
    
    const tabButtons = contextMenu.locator('.tab-button');
    
    // Expected control counts for each tab
    const expectedControlCounts = [12, 20, 20, 16, 12, 17];
    
    for (let i = 0; i < 6; i++) {
      await tabButtons.nth(i).click();
      await page.waitForTimeout(200);
      
      // Count control items in the current tab
      const controlItems = contextMenu.locator('.control-item');
      const actualCount = await controlItems.count();
      
      // Verify control count (allowing for some variation in implementation)
      expect(actualCount).toBeGreaterThanOrEqual(expectedControlCounts[i] - 2);
      expect(actualCount).toBeLessThanOrEqual(expectedControlCounts[i] + 2);
    }
    
    // Close menu
    await page.keyboard.press('Escape');
  });

  test('should handle keyboard navigation between tabs', async ({ page }) => {
    // Open context menu
    await page.locator('.workspace-container').first().click({ button: 'right' });
    const contextMenu = page.locator('.context-menu.enhanced');
    await expect(contextMenu).toBeVisible();
    
    const tabButtons = contextMenu.locator('.tab-button');
    
    // Start with first tab active
    await expect(tabButtons.nth(0)).toHaveClass(/active/);
    
    // Test Ctrl+Tab to go to next tab
    await page.keyboard.press('Control+Tab');
    await page.waitForTimeout(200);
    await expect(tabButtons.nth(1)).toHaveClass(/active/);
    
    // Test Ctrl+Shift+Tab to go to previous tab
    await page.keyboard.press('Control+Shift+Tab');
    await page.waitForTimeout(200);
    await expect(tabButtons.nth(0)).toHaveClass(/active/);
    
    // Test Ctrl+Number to go to specific tab
    await page.keyboard.press('Control+3');
    await page.waitForTimeout(200);
    await expect(tabButtons.nth(2)).toHaveClass(/active/);
    
    // Test Ctrl+6 to go to last tab
    await page.keyboard.press('Control+6');
    await page.waitForTimeout(200);
    await expect(tabButtons.nth(5)).toHaveClass(/active/);
    
    // Close menu
    await page.keyboard.press('Escape');
  });

  test('should maintain tab state during search', async ({ page }) => {
    // Open context menu
    await page.locator('.workspace-container').first().click({ button: 'right' });
    const contextMenu = page.locator('.context-menu.enhanced');
    await expect(contextMenu).toBeVisible();
    
    const tabButtons = contextMenu.locator('.tab-button');
    const searchInput = contextMenu.locator('.search-input');
    
    // Switch to Price Display tab
    await tabButtons.nth(1).click();
    await page.waitForTimeout(200);
    await expect(tabButtons.nth(1)).toHaveClass(/active/);
    
    // Search for something
    await searchInput.fill('price');
    await page.waitForTimeout(300);
    
    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(200);
    
    // Tab should still be active
    await expect(tabButtons.nth(1)).toHaveClass(/active/);
    
    // Close menu
    await page.keyboard.press('Escape');
  });

  test('should handle viewport boundary positioning', async ({ page }) => {
    // Set viewport to small size
    await page.setViewportSize({ width: 800, height: 600 });
    
    // Open context menu near bottom right corner
    await page.locator('.workspace-container').first().click({ 
      position: { x: 750, y: 550 }, 
      button: 'right' 
    });
    
    const contextMenu = page.locator('.context-menu.enhanced');
    await expect(contextMenu).toBeVisible();
    
    // Menu should be positioned within viewport
    const menuBox = await contextMenu.boundingBox();
    expect(menuBox?.x).toBeGreaterThanOrEqual(0);
    expect(menuBox?.y).toBeGreaterThanOrEqual(0);
    expect(menuBox?.x! + menuBox!.width).toBeLessThanOrEqual(800);
    expect(menuBox?.y! + menuBox!.height).toBeLessThanOrEqual(600);
    
    // Tabs should still be functional
    const tabButtons = contextMenu.locator('.tab-button');
    await expect(tabButtons).toHaveCount(6);
    
    // Close menu
    await page.keyboard.press('Escape');
  });
});