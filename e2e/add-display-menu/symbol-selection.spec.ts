// Symbol selection tests for AddDisplayMenu component
import { test, expect } from './fixtures';

test.describe('AddDisplayMenu Symbol Selection', () => {
  // Apply the mockSymbolData fixture to all tests in this describe block
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ canvasPage, mockSymbolData }) => {
    // Ensure we're on the main page and canvas is ready
    await canvasPage.waitForSelector('#floating-canvas', { state: 'visible' });
  });

  test('should open symbol selector when clicking menu item', async ({ canvasPage, mockSymbolData, rightClickCanvas, selectMenuItem }) => {
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

  test('should display available symbols', async ({ canvasPage, mockSymbolData, rightClickCanvas, selectMenuItem }) => {
    // Open symbol selector
    await rightClickCanvas(200, 150);
    await selectMenuItem('add-price-display');
    
    // Wait for symbol selector to be visible
    const symbolSelector = canvasPage.locator('.symbol-selector');
    await expect(symbolSelector).toBeVisible();
    
    // Check for symbols
    const symbolOptions = canvasPage.locator('.symbol-option');
    await expect(symbolOptions).toHaveCount(5); // From our mock data
    
    // Verify specific symbols
    await expect(canvasPage.locator('[data-symbol="EURUSD"]')).toBeVisible();
    await expect(canvasPage.locator('[data-symbol="GBPUSD"]')).toBeVisible();
    await expect(canvasPage.locator('[data-symbol="USDJPY"]')).toBeVisible();
    await expect(canvasPage.locator('[data-symbol="AUDUSD"]')).toBeVisible();
    await expect(canvasPage.locator('[data-symbol="USDCAD"]')).toBeVisible();
    
    // Verify symbols display their names
    await expect(canvasPage.locator('[data-symbol="EURUSD"]')).toContainText('EUR/USD');
    await expect(canvasPage.locator('[data-symbol="GBPUSD"]')).toContainText('GBP/USD');
    await expect(canvasPage.locator('[data-symbol="USDJPY"]')).toContainText('USD/JPY');
  });

  test('should filter symbols when typing in search', async ({ canvasPage, mockSymbolData, rightClickCanvas, selectMenuItem }) => {
    // Open symbol selector
    await rightClickCanvas(200, 150);
    await selectMenuItem('add-price-display');
    
    // Wait for symbol selector to be visible
    const symbolSelector = canvasPage.locator('.symbol-selector');
    await expect(symbolSelector).toBeVisible();
    
    // Type in search
    const searchInput = canvasPage.locator('.symbol-search');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('EUR');
    
    // Verify filtered results
    const symbolOptions = canvasPage.locator('.symbol-option');
    await expect(symbolOptions).toHaveCount(1);
    await expect(canvasPage.locator('[data-symbol="EURUSD"]')).toBeVisible();
    
    // Clear search
    await searchInput.fill('');
    
    // Verify all symbols are shown again
    await expect(symbolOptions).toHaveCount(5);
  });

  test('should create visualization when symbol is selected', async ({ canvasPage, mockSymbolData, rightClickCanvas, selectMenuItem, selectSymbol, waitForVisualization }) => {
    // Open symbol selector
    await rightClickCanvas(200, 150);
    await selectMenuItem('add-price-display');
    
    // Select a symbol
    await selectSymbol('EURUSD');
    
    // Verify visualization is created
    const visualization = await waitForVisualization('price-display');
    await expect(visualization).toBeVisible();
    await expect(visualization).toContainText('EURUSD');
  });

  test('should close symbol selector when clicking outside', async ({ canvasPage, mockSymbolData, rightClickCanvas, selectMenuItem }) => {
    // Open symbol selector
    await rightClickCanvas(200, 150);
    await selectMenuItem('add-price-display');
    
    // Verify symbol selector is open
    const symbolSelector = canvasPage.locator('.symbol-selector');
    await expect(symbolSelector).toBeVisible();
    
    // Click outside the symbol selector
    const canvas = canvasPage.locator('#floating-canvas');
    await canvas.click({ position: { x: 50, y: 50 } });
    
    // Verify symbol selector closes
    await expect(symbolSelector).not.toBeVisible();
  });

  test('should close symbol selector when pressing Escape key', async ({ canvasPage, mockSymbolData, rightClickCanvas, selectMenuItem }) => {
    // Open symbol selector
    await rightClickCanvas(200, 150);
    await selectMenuItem('add-price-display');
    
    // Verify symbol selector is open
    const symbolSelector = canvasPage.locator('.symbol-selector');
    await expect(symbolSelector).toBeVisible();
    
    // Press Escape key
    await canvasPage.keyboard.press('Escape');
    
    // Verify symbol selector closes
    await expect(symbolSelector).not.toBeVisible();
  });

  test('should highlight symbol on hover', async ({ canvasPage, mockSymbolData, rightClickCanvas, selectMenuItem }) => {
    // Open symbol selector
    await rightClickCanvas(200, 150);
    await selectMenuItem('add-price-display');
    
    // Get symbol option
    const eurUsdOption = canvasPage.locator('[data-symbol="EURUSD"]');
    
    // Hover over symbol option
    await eurUsdOption.hover();
    
    // Verify option is highlighted (has hover class or style)
    await expect(eurUsdOption).toHaveClass(/hover|selected/);
  });

  test('should support keyboard navigation in symbol selector', async ({ canvasPage, mockSymbolData, rightClickCanvas, selectMenuItem }) => {
    // Open symbol selector
    await rightClickCanvas(200, 150);
    await selectMenuItem('add-price-display');
    
    // Get symbol options
    const symbolOptions = canvasPage.locator('.symbol-option');
    
    // Focus on the search input
    const searchInput = canvasPage.locator('.symbol-search');
    await searchInput.focus();
    
    // Press Tab to navigate to symbol list
    await canvasPage.keyboard.press('Tab');
    
    // Verify first symbol is focused
    await expect(symbolOptions.first()).toBeFocused();
    
    // Press down arrow to navigate
    await canvasPage.keyboard.press('ArrowDown');
    
    // Verify second symbol is focused
    await expect(symbolOptions.nth(1)).toBeFocused();
    
    // Press Enter to select
    await canvasPage.keyboard.press('Enter');
    
    // Verify visualization is created
    const visualization = canvasPage.locator('.price-display');
    await expect(visualization).toBeVisible();
  });

  test('should show loading state while fetching symbols', async ({ canvasPage, rightClickCanvas, selectMenuItem }) => {
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
    
    // Open symbol selector
    await rightClickCanvas(200, 150);
    await selectMenuItem('add-price-display');
    
    // Verify loading state is shown
    const loadingState = canvasPage.locator('.symbol-selector-loading');
    await expect(loadingState).toBeVisible();
    
    // Wait for symbols to load
    const symbolOptions = canvasPage.locator('.symbol-option');
    await expect(symbolOptions).toHaveCount(1);
    
    // Verify loading state is hidden
    await expect(loadingState).not.toBeVisible();
  });

  test('should create visualization at correct position', async ({ canvasPage, mockSymbolData, rightClickCanvas, selectMenuItem, selectSymbol, waitForVisualization }) => {
    // Right-click at specific position
    await rightClickCanvas(300, 200);
    
    // Select a visualization type and symbol
    await selectMenuItem('add-price-display');
    await selectSymbol('EURUSD');
    
    // Verify visualization position
    const visualization = await waitForVisualization('price-display');
    const vizBox = await visualization.boundingBox();
    
    // Get canvas bounds for reference
    const canvas = canvasPage.locator('#floating-canvas');
    const canvasBox = await canvas.boundingBox();
    
    // Check if elements are found
    if (!vizBox || !canvasBox) {
      throw new Error('Visualization or canvas bounds could not be determined');
    }
    
    // Visualization should appear near click position
    expect(Math.abs(vizBox.x - (canvasBox.x + 300))).toBeLessThan(100);
    expect(Math.abs(vizBox.y - (canvasBox.y + 200))).toBeLessThan(100);
  });

  test('should support creating multiple visualizations with different symbols', async ({ canvasPage, mockSymbolData, rightClickCanvas, selectMenuItem, selectSymbol, waitForVisualization }) => {
    // Create first visualization
    await rightClickCanvas(200, 150);
    await selectMenuItem('add-price-display');
    await selectSymbol('EURUSD');
    
    // Verify first visualization
    const viz1 = await waitForVisualization('price-display');
    await expect(viz1).toContainText('EURUSD');
    
    // Create second visualization
    await rightClickCanvas(400, 200);
    await selectMenuItem('add-price-display');
    await selectSymbol('GBPUSD');
    
    // Verify second visualization
    const viz2 = await waitForVisualization('price-display');
    await expect(viz2).toContainText('GBPUSD');
    
    // Verify both visualizations are visible
    const allVisualizations = canvasPage.locator('.price-display');
    await expect(allVisualizations).toHaveCount(2);
  });

  test('should show recent symbols if available', async ({ canvasPage, mockSymbolData, rightClickCanvas, selectMenuItem }) => {
    // Mock recent symbols in localStorage
    await canvasPage.evaluate(() => {
      localStorage.setItem('recent-symbols', JSON.stringify(['EURUSD', 'GBPUSD']));
    });
    
    // Open symbol selector
    await rightClickCanvas(200, 150);
    await selectMenuItem('add-price-display');
    
    // Verify recent symbols section is shown
    const recentSymbols = canvasPage.locator('.recent-symbols');
    await expect(recentSymbols).toBeVisible();
    
    // Verify recent symbols are displayed
    await expect(recentSymbols.locator('[data-symbol="EURUSD"]')).toBeVisible();
    await expect(recentSymbols.locator('[data-symbol="GBPUSD"]')).toBeVisible();
  });
});