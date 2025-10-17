// Basic functionality tests for AddDisplayMenu component
import { test, expect } from './fixtures';

test.describe('AddDisplayMenu Basic Functionality', () => {
  test.beforeEach(async ({ canvasPage }) => {
    // Ensure we're on the main page and canvas is ready
    await canvasPage.waitForSelector('#floating-canvas', { state: 'visible' });
  });

  test('should open context menu on right-click', async ({ canvasPage, rightClickCanvas }) => {
    // Right-click on the canvas
    await rightClickCanvas(200, 150);
    
    // Verify context menu appears
    const contextMenu = canvasPage.locator('.add-display-menu');
    await expect(contextMenu).toBeVisible();
    
    // Verify menu has the expected title
    await expect(contextMenu.locator('h3, .menu-title')).toContainText(/Add Display/i);
  });

  test('should show correct menu options', async ({ canvasPage, rightClickCanvas }) => {
    // Right-click on the canvas
    await rightClickCanvas(200, 150);
    
    // Check for expected menu items
    const menuItems = canvasPage.locator('.add-display-menu-item');
    await expect(menuItems).toHaveCount(4); // Expected number of options
    
    // Verify specific menu items
    await expect(canvasPage.locator('[data-test="add-price-display"]')).toBeVisible();
    await expect(canvasPage.locator('[data-test="add-adr-display"]')).toBeVisible();
    await expect(canvasPage.locator('[data-test="add-volatility-display"]')).toBeVisible();
    await expect(canvasPage.locator('[data-test="add-custom-display"]')).toBeVisible();
    
    // Verify menu items have correct text
    await expect(canvasPage.locator('[data-test="add-price-display"]')).toContainText(/Price Display/i);
    await expect(canvasPage.locator('[data-test="add-adr-display"]')).toContainText(/ADR Display/i);
    await expect(canvasPage.locator('[data-test="add-volatility-display"]')).toContainText(/Volatility Display/i);
    await expect(canvasPage.locator('[data-test="add-custom-display"]')).toContainText(/Custom Display/i);
  });

  test('should close menu when clicking outside', async ({ canvasPage, rightClickCanvas }) => {
    // Right-click on the canvas
    await rightClickCanvas(200, 150);
    
    // Verify menu is open
    const contextMenu = canvasPage.locator('.add-display-menu');
    await expect(contextMenu).toBeVisible();
    
    // Click outside the menu (on the canvas)
    const canvas = canvasPage.locator('#floating-canvas');
    await canvas.click({ position: { x: 50, y: 50 } });
    
    // Verify menu closes
    await expect(contextMenu).not.toBeVisible();
  });

  test('should close menu when pressing Escape key', async ({ canvasPage, rightClickCanvas }) => {
    // Right-click on the canvas
    await rightClickCanvas(200, 150);
    
    // Verify menu is open
    const contextMenu = canvasPage.locator('.add-display-menu');
    await expect(contextMenu).toBeVisible();
    
    // Press Escape key
    await canvasPage.keyboard.press('Escape');
    
    // Verify menu closes
    await expect(contextMenu).not.toBeVisible();
  });

  test('should position menu at click location', async ({ canvasPage, rightClickCanvas }) => {
    // Right-click at specific position
    await rightClickCanvas(200, 150);
    
    // Verify menu position
    const contextMenu = canvasPage.locator('.add-display-menu');
    const menuBox = await contextMenu.boundingBox();
    
    // Get canvas bounds for reference
    const canvas = canvasPage.locator('#floating-canvas');
    const canvasBox = await canvas.boundingBox();
    
    // Check if elements are found
    if (!menuBox || !canvasBox) {
      throw new Error('Menu or canvas bounds could not be determined');
    }
    
    // Menu should appear near the click position (within 50px)
    expect(Math.abs(menuBox.x - (canvasBox.x + 200))).toBeLessThan(50);
    expect(Math.abs(menuBox.y - (canvasBox.y + 150))).toBeLessThan(50);
  });

  test('should keep menu within viewport bounds', async ({ canvasPage, rightClickCanvas }) => {
    // Get canvas bounds
    const canvas = canvasPage.locator('#floating-canvas');
    const canvasBox = await canvas.boundingBox();
    
    // Check if canvas is found
    if (!canvasBox) {
      throw new Error('Canvas bounds could not be determined');
    }
    
    // Click near bottom-right corner of canvas
    await rightClickCanvas(canvasBox.width - 20, canvasBox.height - 20);
    
    // Verify menu stays within viewport
    const contextMenu = canvasPage.locator('.add-display-menu');
    const menuBox = await contextMenu.boundingBox();
    
    // Check if menu is found
    if (!menuBox) {
      throw new Error('Menu bounds could not be determined');
    }
    
    // Menu should be fully visible within viewport
    const viewport = canvasPage.viewportSize();
    if (!viewport) {
      throw new Error('Viewport size could not be determined');
    }
    
    expect(menuBox.x).toBeGreaterThanOrEqual(0);
    expect(menuBox.y).toBeGreaterThanOrEqual(0);
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewport.width);
    expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(viewport.height);
  });

  test('should open menu at different positions', async ({ canvasPage, rightClickCanvas }) => {
    const positions = [
      { x: 100, y: 100 },
      { x: 300, y: 200 },
      { x: 500, y: 300 },
    ];
    
    for (const pos of positions) {
      // Right-click at specific position
      await rightClickCanvas(pos.x, pos.y);
      
      // Verify menu appears
      const contextMenu = canvasPage.locator('.add-display-menu');
      await expect(contextMenu).toBeVisible();
      
      // Verify menu position
      const menuBox = await contextMenu.boundingBox();
      const canvas = canvasPage.locator('#floating-canvas');
      const canvasBox = await canvas.boundingBox();
      
      // Check if elements are found
      if (!menuBox || !canvasBox) {
        throw new Error('Menu or canvas bounds could not be determined');
      }
      
      expect(Math.abs(menuBox.x - (canvasBox.x + pos.x))).toBeLessThan(50);
      expect(Math.abs(menuBox.y - (canvasBox.y + pos.y))).toBeLessThan(50);
      
      // Close menu before next test
      await canvasPage.keyboard.press('Escape');
      await expect(contextMenu).not.toBeVisible();
    }
  });

  test('should highlight menu items on hover', async ({ canvasPage, rightClickCanvas }) => {
    // Right-click on the canvas
    await rightClickCanvas(200, 150);
    
    // Get menu items
    const priceDisplayItem = canvasPage.locator('[data-test="add-price-display"]');
    
    // Hover over menu item
    await priceDisplayItem.hover();
    
    // Verify item is highlighted (has hover class or style)
    await expect(priceDisplayItem).toHaveClass(/hover|active/);
  });

  test('should open symbol selector when clicking menu item', async ({ canvasPage, rightClickCanvas, selectMenuItem }) => {
    // Right-click on the canvas
    await rightClickCanvas(200, 150);
    
    // Click on a menu item that requires symbol selection
    await selectMenuItem('add-price-display');
    
    // Verify symbol selector opens
    const symbolSelector = canvasPage.locator('.symbol-selector');
    await expect(symbolSelector).toBeVisible();
    
    // Verify context menu closes
    const contextMenu = canvasPage.locator('.add-display-menu');
    await expect(contextMenu).not.toBeVisible();
  });

  test('should have correct ARIA attributes for accessibility', async ({ canvasPage, rightClickCanvas }) => {
    // Right-click on the canvas
    await rightClickCanvas(200, 150);
    
    // Verify menu has correct role
    const contextMenu = canvasPage.locator('.add-display-menu');
    await expect(contextMenu).toHaveAttribute('role', 'menu');
    
    // Verify menu items have correct role
    const menuItems = canvasPage.locator('.add-display-menu-item');
    await expect(menuItems.first()).toHaveAttribute('role', 'menuitem');
    
    // Verify menu items are focusable
    await expect(menuItems.first()).toHaveAttribute('tabindex', '0');
  });

  test('should support keyboard navigation', async ({ canvasPage, rightClickCanvas }) => {
    // Right-click on the canvas
    await rightClickCanvas(200, 150);
    
    // Get menu items
    const menuItems = canvasPage.locator('.add-display-menu-item');
    
    // Focus on the menu
    const contextMenu = canvasPage.locator('.add-display-menu');
    await contextMenu.focus();
    
    // Press down arrow to navigate
    await canvasPage.keyboard.press('ArrowDown');
    
    // Verify first item is focused
    await expect(menuItems.first()).toBeFocused();
    
    // Press down arrow again
    await canvasPage.keyboard.press('ArrowDown');
    
    // Verify second item is focused
    await expect(menuItems.nth(1)).toBeFocused();
    
    // Press Enter to select
    await canvasPage.keyboard.press('Enter');
    
    // Verify symbol selector opens
    const symbolSelector = canvasPage.locator('.symbol-selector');
    await expect(symbolSelector).toBeVisible();
  });
});