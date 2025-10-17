// Error handling tests for AddDisplayMenu component
import { test, expect } from './fixtures';

test.describe('AddDisplayMenu Error Handling', () => {
  test.beforeEach(async ({ canvasPage }) => {
    // Ensure we're on the main page and canvas is ready
    await canvasPage.waitForSelector('#floating-canvas', { state: 'visible' });
  });

  test('should handle empty symbol list', async ({ canvasPage, mockEmptySymbolList, rightClickCanvas, selectMenuItem }) => {
    // Right-click to open menu
    await rightClickCanvas(200, 150);
    
    // Open symbol selector
    await selectMenuItem('add-price-display');
    
    // Verify empty state message
    const emptyState = canvasPage.locator('.symbol-selector-empty');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText(/No symbols available/i);
    
    // Verify retry button is present
    const retryButton = canvasPage.locator('.symbol-selector-retry');
    await expect(retryButton).toBeVisible();
    
    // Click retry button
    await retryButton.click();
    
    // Verify loading state is shown
    const loadingState = canvasPage.locator('.symbol-selector-loading');
    await expect(loadingState).toBeVisible();
  });

  test('should handle network error', async ({ canvasPage, mockNetworkError, rightClickCanvas, selectMenuItem }) => {
    // Right-click to open menu
    await rightClickCanvas(200, 150);
    
    // Open symbol selector
    await selectMenuItem('add-price-display');
    
    // Verify error message
    const errorMessage = canvasPage.locator('.symbol-selector-error');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText(/Failed to load symbols/i);
    
    // Verify retry button is present
    const retryButton = canvasPage.locator('.symbol-selector-retry');
    await expect(retryButton).toBeVisible();
    
    // Click retry button
    await retryButton.click();
    
    // Verify loading state is shown
    const loadingState = canvasPage.locator('.symbol-selector-loading');
    await expect(loadingState).toBeVisible();
  });

  test('should handle invalid symbol selection', async ({ canvasPage, mockInvalidSymbolError, rightClickCanvas, selectMenuItem }) => {
    // Right-click to open menu
    await rightClickCanvas(200, 150);
    
    // Open symbol selector
    await selectMenuItem('add-price-display');
    
    // Wait for symbol selector to appear
    const symbolSelector = canvasPage.locator('.symbol-selector');
    await expect(symbolSelector).toBeVisible();
    
    // Manually trigger invalid symbol selection
    await canvasPage.evaluate(() => {
      // Simulate selecting an invalid symbol
      const event = new CustomEvent('symbol-selected', {
        detail: { symbol: 'INVALID' }
      });
      document.dispatchEvent(event);
    });
    
    // Verify error message
    const errorMessage = canvasPage.locator('.visualization-error');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText(/Failed to load symbol data/i);
    
    // Verify symbol selector is still open
    await expect(symbolSelector).toBeVisible();
  });

  test('should handle slow symbol loading', async ({ canvasPage, rightClickCanvas, selectMenuItem }) => {
    // Mock a delay in symbol loading
    await canvasPage.route('/api/symbols', async (route) => {
      // Wait 3 seconds to simulate slow loading
      await new Promise(resolve => setTimeout(resolve, 3000));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { symbol: 'EURUSD', name: 'EUR/USD', type: 'forex' },
        ]),
      });
    });
    
    // Right-click to open menu
    await rightClickCanvas(200, 150);
    
    // Open symbol selector
    await selectMenuItem('add-price-display');
    
    // Verify loading state is shown
    const loadingState = canvasPage.locator('.symbol-selector-loading');
    await expect(loadingState).toBeVisible();
    
    // Verify timeout message appears after delay
    const timeoutMessage = canvasPage.locator('.symbol-selector-timeout');
    await expect(timeoutMessage).toBeVisible({ timeout: 5000 });
    await expect(timeoutMessage).toContainText(/Loading is taking longer than expected/i);
    
    // Verify retry button is present
    const retryButton = canvasPage.locator('.symbol-selector-retry');
    await expect(retryButton).toBeVisible();
  });

  test('should handle canvas not found', async ({ page }) => {
    // Navigate to a page without canvas
    await page.goto('/about:blank');
    
    // Try to right-click
    await page.mouse.click(100, 100, { button: 'right' });
    
    // Verify menu does not appear
    const contextMenu = page.locator('.add-display-menu');
    await expect(contextMenu).not.toBeVisible();
  });

  test('should handle rapid menu opening and closing with errors', async ({ canvasPage, mockNetworkError, rightClickCanvas }) => {
    // Open and close menu rapidly with network errors
    for (let i = 0; i < 3; i++) {
      // Right-click to open menu
      await rightClickCanvas(200, 150);
      
      // Verify menu appears
      const contextMenu = canvasPage.locator('.add-display-menu');
      await expect(contextMenu).toBeVisible();
      
      // Try to open symbol selector
      const menuItem = canvasPage.locator('[data-test="add-price-display"]');
      await menuItem.click();
      
      // Verify error message appears
      const errorMessage = canvasPage.locator('.symbol-selector-error');
      await expect(errorMessage).toBeVisible();
      
      // Close menu
      await canvasPage.keyboard.press('Escape');
      await expect(contextMenu).not.toBeVisible();
      
      // Small delay between iterations
      await canvasPage.waitForTimeout(100);
    }
  });

  test('should handle symbol data loading error', async ({ canvasPage, rightClickCanvas, selectMenuItem, selectSymbol }) => {
    // Mock successful symbol list but error for individual symbol data
    await canvasPage.route('/api/symbols', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { symbol: 'EURUSD', name: 'EUR/USD', type: 'forex' },
        ]),
      });
    });
    
    // Mock error for symbol data
    await canvasPage.route('/api/symbols/EURUSD/data', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });
    
    // Right-click to open menu
    await rightClickCanvas(200, 150);
    
    // Open symbol selector
    await selectMenuItem('add-price-display');
    
    // Select symbol
    await selectSymbol('EURUSD');
    
    // Verify error message
    const errorMessage = canvasPage.locator('.visualization-error');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText(/Failed to load symbol data/i);
    
    // Verify retry button is present
    const retryButton = canvasPage.locator('.visualization-retry');
    await expect(retryButton).toBeVisible();
  });

  test('should handle menu positioning outside viewport', async ({ canvasPage }) => {
    // Get canvas bounds
    const canvas = canvasPage.locator('#floating-canvas');
    const canvasBox = await canvas.boundingBox();
    
    // Check if canvas is found
    if (!canvasBox) {
      throw new Error('Canvas bounds could not be determined');
    }
    
    // Set viewport to small size
    await canvasPage.setViewportSize({ width: 400, height: 300 });
    
    // Wait for any potential repositioning
    await canvasPage.waitForTimeout(100);
    
    // Right-click outside viewport
    await canvasPage.mouse.click(canvasBox.x + canvasBox.width + 50, canvasBox.y + canvasBox.height + 50, { button: 'right' });
    
    // Verify menu appears within viewport bounds
    const contextMenu = canvasPage.locator('.add-display-menu');
    await expect(contextMenu).toBeVisible();
    
    const menuBox = await contextMenu.boundingBox();
    
    if (!menuBox) {
      throw new Error('Menu bounds could not be determined');
    }
    
    const viewport = canvasPage.viewportSize();
    if (!viewport) {
      throw new Error('Viewport size could not be determined');
    }
    
    expect(menuBox.x).toBeGreaterThanOrEqual(0);
    expect(menuBox.y).toBeGreaterThanOrEqual(0);
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewport.width);
    expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(viewport.height);
  });

  test('should handle keyboard navigation errors', async ({ canvasPage, rightClickCanvas }) => {
    // Right-click to open menu
    await rightClickCanvas(200, 150);
    
    // Verify menu appears
    const contextMenu = canvasPage.locator('.add-display-menu');
    await expect(contextMenu).toBeVisible();
    
    // Try to navigate with invalid keys
    await canvasPage.keyboard.press('F1');
    await canvasPage.keyboard.press('F12');
    
    // Verify menu is still open and functional
    await expect(contextMenu).toBeVisible();
    
    // Try valid navigation
    await canvasPage.keyboard.press('ArrowDown');
    
    // Verify first item is focused
    const menuItems = canvasPage.locator('.add-display-menu-item');
    await expect(menuItems.first()).toBeFocused();
  });

  test('should handle browser back button while menu is open', async ({ canvasPage, rightClickCanvas }) => {
    // Right-click to open menu
    await rightClickCanvas(200, 150);
    
    // Verify menu appears
    const contextMenu = canvasPage.locator('.add-display-menu');
    await expect(contextMenu).toBeVisible();
    
    // Press browser back button
    await canvasPage.goBack();
    
    // Wait for potential navigation
    await canvasPage.waitForTimeout(500);
    
    // Verify menu is closed (browser back should close it)
    await expect(contextMenu).not.toBeVisible();
  });

  test('should handle page refresh while menu is open', async ({ canvasPage, rightClickCanvas }) => {
    // Right-click to open menu
    await rightClickCanvas(200, 150);
    
    // Verify menu appears
    const contextMenu = canvasPage.locator('.add-display-menu');
    await expect(contextMenu).toBeVisible();
    
    // Refresh page
    await canvasPage.reload();
    
    // Wait for page to reload
    await canvasPage.waitForLoadState('networkidle');
    
    // Verify menu is not visible after refresh
    await expect(contextMenu).not.toBeVisible();
    
    // Verify canvas is available again
    const canvas = canvasPage.locator('#floating-canvas');
    await expect(canvas).toBeVisible();
  });

  test('should handle memory error', async ({ canvasPage, rightClickCanvas, selectMenuItem }) => {
    // Mock memory error by returning a large data set
    await canvasPage.route('/api/symbols', route => {
      // Create a large array to simulate memory error
      const largeData = Array(10000).fill(null).map((_, i) => ({
        symbol: `SYMBOL${i}`,
        name: `Symbol ${i}`,
        type: 'forex',
      }));
      
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(largeData),
      });
    });
    
    // Right-click to open menu
    await rightClickCanvas(200, 150);
    
    // Open symbol selector
    await selectMenuItem('add-price-display');
    
    // Verify loading state is shown
    const loadingState = canvasPage.locator('.symbol-selector-loading');
    await expect(loadingState).toBeVisible();
    
    // Verify error message appears after delay
    const errorMessage = canvasPage.locator('.symbol-selector-error');
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
    await expect(errorMessage).toContainText(/Too much data to display/i);
  });
});