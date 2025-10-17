// Visual regression tests for AddDisplayMenu component
import { test, expect } from './fixtures';

test.describe('AddDisplayMenu Visual Regression', () => {
  // Apply the mockSymbolData fixture to all tests in this describe block
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ canvasPage, mockSymbolData }) => {
    // Ensure we're on the main page and canvas is ready
    await canvasPage.waitForSelector('#floating-canvas', { state: 'visible' });
  });

  test('should match screenshot of closed menu', async ({ canvasPage }) => {
    // Take screenshot of canvas without menu
    await expect(canvasPage).toHaveScreenshot('canvas-no-menu.png');
  });

  test('should match screenshot of open menu', async ({ canvasPage, rightClickCanvas }) => {
    // Right-click to open menu
    await rightClickCanvas(200, 150);
    
    // Take screenshot of canvas with menu
    await expect(canvasPage).toHaveScreenshot('canvas-with-menu.png');
  });

  test('should match screenshot of menu at different positions', async ({ canvasPage, rightClickCanvas }) => {
    const positions = [
      { x: 100, y: 100 },
      { x: 300, y: 200 },
      { x: 500, y: 300 },
    ];
    
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      
      // Right-click at position
      await rightClickCanvas(pos.x, pos.y);
      
      // Take screenshot of menu at position
      await expect(canvasPage).toHaveScreenshot(`menu-position-${i + 1}.png`);
      
      // Close menu
      await canvasPage.keyboard.press('Escape');
    }
  });

  test('should match screenshot of symbol selector', async ({ canvasPage, rightClickCanvas, selectMenuItem }) => {
    // Right-click to open menu
    await rightClickCanvas(200, 150);
    
    // Open symbol selector
    await selectMenuItem('add-price-display');
    
    // Take screenshot of symbol selector
    const symbolSelector = canvasPage.locator('.symbol-selector');
    await expect(symbolSelector).toHaveScreenshot('symbol-selector.png');
  });

  test('should match screenshot of symbol selector with search', async ({ canvasPage, rightClickCanvas, selectMenuItem }) => {
    // Right-click to open menu
    await rightClickCanvas(200, 150);
    
    // Open symbol selector
    await selectMenuItem('add-price-display');
    
    // Type in search
    const searchInput = canvasPage.locator('.symbol-search');
    await searchInput.fill('EUR');
    
    // Take screenshot of symbol selector with search
    const symbolSelector = canvasPage.locator('.symbol-selector');
    await expect(symbolSelector).toHaveScreenshot('symbol-selector-with-search.png');
  });

  test('should match screenshot of created visualization', async ({ canvasPage, rightClickCanvas, selectMenuItem, selectSymbol }) => {
    // Right-click to open menu
    await rightClickCanvas(200, 150);
    
    // Select visualization type and symbol
    await selectMenuItem('add-price-display');
    await selectSymbol('EURUSD');
    
    // Wait for visualization to appear
    const visualization = canvasPage.locator('.price-display');
    await expect(visualization).toBeVisible();
    
    // Take screenshot of canvas with visualization
    await expect(canvasPage).toHaveScreenshot('canvas-with-visualization.png');
  });

  test('should match screenshot of multiple visualizations', async ({ canvasPage, rightClickCanvas, selectMenuItem, selectSymbol }) => {
    // Create first visualization
    await rightClickCanvas(200, 150);
    await selectMenuItem('add-price-display');
    await selectSymbol('EURUSD');
    
    // Create second visualization
    await rightClickCanvas(400, 200);
    await selectMenuItem('add-adr-display');
    await selectSymbol('GBPUSD');
    
    // Wait for visualizations to appear
    const viz1 = canvasPage.locator('.price-display');
    const viz2 = canvasPage.locator('.adr-display');
    await expect(viz1).toBeVisible();
    await expect(viz2).toBeVisible();
    
    // Take screenshot of canvas with multiple visualizations
    await expect(canvasPage).toHaveScreenshot('canvas-with-multiple-visualizations.png');
  });

  test('should match screenshot of menu hover states', async ({ canvasPage, rightClickCanvas }) => {
    // Right-click to open menu
    await rightClickCanvas(200, 150);
    
    // Hover over menu items
    const menuItems = canvasPage.locator('.add-display-menu-item');
    
    for (let i = 0; i < await menuItems.count(); i++) {
      const item = menuItems.nth(i);
      
      // Hover over item
      await item.hover();
      
      // Take screenshot of menu with hover state
      await expect(canvasPage).toHaveScreenshot(`menu-hover-${i + 1}.png`);
      
      // Move away to reset hover state
      await canvasPage.mouse.move(100, 100);
    }
  });

  test('should match screenshot of symbol selector hover states', async ({ canvasPage, rightClickCanvas, selectMenuItem }) => {
    // Right-click to open menu
    await rightClickCanvas(200, 150);
    
    // Open symbol selector
    await selectMenuItem('add-price-display');
    
    // Hover over symbol options
    const symbolOptions = canvasPage.locator('.symbol-option');
    
    for (let i = 0; i < await symbolOptions.count(); i++) {
      const option = symbolOptions.nth(i);
      
      // Hover over option
      await option.hover();
      
      // Take screenshot of symbol selector with hover state
      const symbolSelector = canvasPage.locator('.symbol-selector');
      await expect(symbolSelector).toHaveScreenshot(`symbol-selector-hover-${i + 1}.png`);
      
      // Move away to reset hover state
      await canvasPage.mouse.move(100, 100);
    }
  });

  test('should match screenshot of menu at viewport edges', async ({ canvasPage, rightClickCanvas }) => {
    // Get canvas bounds
    const canvas = canvasPage.locator('#floating-canvas');
    const canvasBox = await canvas.boundingBox();
    
    // Check if canvas is found
    if (!canvasBox) {
      throw new Error('Canvas bounds could not be determined');
    }
    
    // Test positions at edges
    const positions = [
      { x: 10, y: 10, name: 'top-left' },
      { x: canvasBox.width - 10, y: 10, name: 'top-right' },
      { x: 10, y: canvasBox.height - 10, name: 'bottom-left' },
      { x: canvasBox.width - 10, y: canvasBox.height - 10, name: 'bottom-right' },
    ];
    
    for (const pos of positions) {
      // Right-click at position
      await rightClickCanvas(pos.x, pos.y);
      
      // Take screenshot of menu at edge
      await expect(canvasPage).toHaveScreenshot(`menu-at-${pos.name}.png`);
      
      // Close menu
      await canvasPage.keyboard.press('Escape');
    }
  });

  test('should match screenshot of loading state', async ({ canvasPage, rightClickCanvas, selectMenuItem }) => {
    // Mock a delay in symbol loading
    await canvasPage.route('/api/symbols', async (route) => {
      // Wait 1 second to simulate loading
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.fulfill({
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
    
    // Take screenshot of loading state
    const symbolSelector = canvasPage.locator('.symbol-selector');
    await expect(symbolSelector).toHaveScreenshot('symbol-selector-loading.png');
  });

  test('should match screenshot of empty state', async ({ canvasPage, rightClickCanvas, selectMenuItem }) => {
    // Mock empty symbol list
    await canvasPage.route('/api/symbols', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
    
    // Right-click to open menu
    await rightClickCanvas(200, 150);
    
    // Open symbol selector
    await selectMenuItem('add-price-display');
    
    // Take screenshot of empty state
    const symbolSelector = canvasPage.locator('.symbol-selector');
    await expect(symbolSelector).toHaveScreenshot('symbol-selector-empty.png');
  });

  test('should match screenshot of error state', async ({ canvasPage, rightClickCanvas, selectMenuItem }) => {
    // Mock network error
    await canvasPage.route('/api/symbols', route => {
      route.abort('failed');
    });
    
    // Right-click to open menu
    await rightClickCanvas(200, 150);
    
    // Open symbol selector
    await selectMenuItem('add-price-display');
    
    // Take screenshot of error state
    const symbolSelector = canvasPage.locator('.symbol-selector');
    await expect(symbolSelector).toHaveScreenshot('symbol-selector-error.png');
  });

  test('should match screenshot of keyboard focus states', async ({ canvasPage, rightClickCanvas }) => {
    // Right-click to open menu
    await rightClickCanvas(200, 150);
    
    // Get menu items
    const menuItems = canvasPage.locator('.add-display-menu-item');
    
    // Focus on the menu
    const contextMenu = canvasPage.locator('.add-display-menu');
    await contextMenu.focus();
    
    // Press down arrow to navigate
    await canvasPage.keyboard.press('ArrowDown');
    
    // Take screenshot of menu with focus state
    await expect(canvasPage).toHaveScreenshot('menu-with-focus.png');
    
    // Press down arrow again
    await canvasPage.keyboard.press('ArrowDown');
    
    // Take screenshot of menu with different focus state
    await expect(canvasPage).toHaveScreenshot('menu-with-focus-2.png');
  });

  test('should match screenshot of menu with different viewport sizes', async ({ canvasPage, rightClickCanvas }) => {
    const viewportSizes = [
      { width: 1920, height: 1080, name: 'desktop' },
      { width: 1366, height: 768, name: 'laptop' },
      { width: 768, height: 1024, name: 'tablet' },
    ];
    
    for (const viewport of viewportSizes) {
      // Set viewport size
      await canvasPage.setViewportSize(viewport);
      
      // Wait for any potential repositioning
      await canvasPage.waitForTimeout(100);
      
      // Right-click to open menu
      await rightClickCanvas(200, 150);
      
      // Take screenshot of menu with viewport size
      await expect(canvasPage).toHaveScreenshot(`menu-${viewport.name}.png`);
      
      // Close menu
      await canvasPage.keyboard.press('Escape');
    }
  });
});