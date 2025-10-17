// Integration tests for AddDisplayMenu component with FloatingCanvas
import { test, expect } from './fixtures';

test.describe('AddDisplayMenu Integration with FloatingCanvas', () => {
  // Apply the mockSymbolData fixture to all tests in this describe block
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ canvasPage, mockSymbolData }) => {
    // Ensure we're on the main page and canvas is ready
    await canvasPage.waitForSelector('#floating-canvas', { state: 'visible' });
  });

  test('should position menu at click location', async ({ canvasPage, rightClickCanvas }) => {
    // Get canvas bounds
    const canvas = canvasPage.locator('#floating-canvas');
    const canvasBox = await canvas.boundingBox();
    
    // Check if canvas is found
    if (!canvasBox) {
      throw new Error('Canvas bounds could not be determined');
    }
    
    // Click at specific position
    const clickX = canvasBox.x + 200;
    const clickY = canvasBox.y + 150;
    
    // Right-click at the position
    await canvasPage.mouse.move(clickX, clickY);
    await canvasPage.mouse.click(clickX, clickY, { button: 'right' });
    
    // Wait for context menu to appear
    const contextMenu = canvasPage.locator('.add-display-menu');
    await expect(contextMenu).toBeVisible();
    
    // Verify menu position
    const menuBox = await contextMenu.boundingBox();
    
    // Check if menu is found
    if (!menuBox) {
      throw new Error('Menu bounds could not be determined');
    }
    
    // Menu should appear near click position
    expect(Math.abs(menuBox.x - clickX)).toBeLessThan(50);
    expect(Math.abs(menuBox.y - clickY)).toBeLessThan(50);
  });

  test('should keep menu within viewport bounds', async ({ canvasPage, rightClickCanvas }) => {
    // Get canvas bounds
    const canvas = canvasPage.locator('#floating-canvas');
    const canvasBox = await canvas.boundingBox();
    
    // Check if canvas is found
    if (!canvasBox) {
      throw new Error('Canvas bounds could not be determined');
    }
    
    // Click near bottom-right corner
    const clickX = canvasBox.x + canvasBox.width - 10;
    const clickY = canvasBox.y + canvasBox.height - 10;
    
    // Right-click at the position
    await canvasPage.mouse.move(clickX, clickY);
    await canvasPage.mouse.click(clickX, clickY, { button: 'right' });
    
    // Verify menu stays within viewport
    const contextMenu = canvasPage.locator('.add-display-menu');
    await expect(contextMenu).toBeVisible();
    
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
    
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewport.width);
    expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(viewport.height);
  });

  test('should create visualization at correct position on canvas', async ({ canvasPage, rightClickCanvas, selectMenuItem, selectSymbol, waitForVisualization }) => {
    // Get canvas bounds
    const canvas = canvasPage.locator('#floating-canvas');
    const canvasBox = await canvas.boundingBox();
    
    // Check if canvas is found
    if (!canvasBox) {
      throw new Error('Canvas bounds could not be determined');
    }
    
    // Click at specific position
    const clickX = canvasBox.x + 200;
    const clickY = canvasBox.y + 150;
    
    // Right-click at the position
    await canvasPage.mouse.move(clickX, clickY);
    await canvasPage.mouse.click(clickX, clickY, { button: 'right' });
    
    // Select visualization type and symbol
    await selectMenuItem('add-price-display');
    await selectSymbol('EURUSD');
    
    // Verify visualization position
    const visualization = await waitForVisualization('price-display');
    const vizBox = await visualization.boundingBox();
    
    // Check if visualization is found
    if (!vizBox) {
      throw new Error('Visualization bounds could not be determined');
    }
    
    // Visualization should appear near click position
    expect(Math.abs(vizBox.x - clickX)).toBeLessThan(100);
    expect(Math.abs(vizBox.y - clickY)).toBeLessThan(100);
  });

  test('should allow creating multiple visualizations at different positions', async ({ canvasPage, rightClickCanvas, selectMenuItem, selectSymbol, waitForVisualization }) => {
    // Get canvas bounds
    const canvas = canvasPage.locator('#floating-canvas');
    const canvasBox = await canvas.boundingBox();
    
    // Check if canvas is found
    if (!canvasBox) {
      throw new Error('Canvas bounds could not be determined');
    }
    
    // Create first visualization
    const clickX1 = canvasBox.x + 150;
    const clickY1 = canvasBox.y + 100;
    
    await canvasPage.mouse.move(clickX1, clickY1);
    await canvasPage.mouse.click(clickX1, clickY1, { button: 'right' });
    
    await selectMenuItem('add-price-display');
    await selectSymbol('EURUSD');
    
    // Verify first visualization
    const viz1 = await waitForVisualization('price-display');
    const vizBox1 = await viz1.boundingBox();
    
    if (!vizBox1) {
      throw new Error('First visualization bounds could not be determined');
    }
    
    expect(Math.abs(vizBox1.x - clickX1)).toBeLessThan(100);
    expect(Math.abs(vizBox1.y - clickY1)).toBeLessThan(100);
    
    // Create second visualization
    const clickX2 = canvasBox.x + 350;
    const clickY2 = canvasBox.y + 200;
    
    await canvasPage.mouse.move(clickX2, clickY2);
    await canvasPage.mouse.click(clickX2, clickY2, { button: 'right' });
    
    await selectMenuItem('add-adr-display');
    await selectSymbol('GBPUSD');
    
    // Verify second visualization
    const viz2 = await waitForVisualization('adr-display');
    const vizBox2 = await viz2.boundingBox();
    
    if (!vizBox2) {
      throw new Error('Second visualization bounds could not be determined');
    }
    
    expect(Math.abs(vizBox2.x - clickX2)).toBeLessThan(100);
    expect(Math.abs(vizBox2.y - clickY2)).toBeLessThan(100);
    
    // Verify both visualizations are visible and at different positions
    const allVisualizations = canvasPage.locator('.price-display, .adr-display');
    await expect(allVisualizations).toHaveCount(2);
    
    // Ensure they don't overlap significantly
    const xDistance = Math.abs(vizBox1.x - vizBox2.x);
    const yDistance = Math.abs(vizBox1.y - vizBox2.y);
    
    expect(xDistance + yDistance).toBeGreaterThan(50); // Some separation
  });

  test('should maintain canvas interaction when menu is open', async ({ canvasPage, rightClickCanvas }) => {
    // Right-click to open menu
    await rightClickCanvas(200, 150);
    
    // Verify menu is open
    const contextMenu = canvasPage.locator('.add-display-menu');
    await expect(contextMenu).toBeVisible();
    
    // Try to interact with canvas outside the menu
    const canvas = canvasPage.locator('#floating-canvas');
    await canvas.click({ position: { x: 50, y: 50 } });
    
    // Verify menu closes
    await expect(contextMenu).not.toBeVisible();
    
    // Verify canvas is still interactive
    await canvas.click({ position: { x: 100, y: 100 } });
    
    // No new menu should appear on left-click
    await expect(contextMenu).not.toBeVisible();
  });

  test('should handle rapid menu opening and closing', async ({ canvasPage, rightClickCanvas }) => {
    // Open and close menu rapidly
    for (let i = 0; i < 5; i++) {
      // Right-click to open menu
      await rightClickCanvas(200, 150);
      
      // Verify menu is open
      const contextMenu = canvasPage.locator('.add-display-menu');
      await expect(contextMenu).toBeVisible();
      
      // Close menu
      await canvasPage.keyboard.press('Escape');
      
      // Verify menu is closed
      await expect(contextMenu).not.toBeVisible();
      
      // Small delay between iterations
      await canvasPage.waitForTimeout(100);
    }
  });

  test('should handle menu positioning at canvas edges', async ({ canvasPage, rightClickCanvas }) => {
    // Get canvas bounds
    const canvas = canvasPage.locator('#floating-canvas');
    const canvasBox = await canvas.boundingBox();
    
    // Check if canvas is found
    if (!canvasBox) {
      throw new Error('Canvas bounds could not be determined');
    }
    
    // Test positions at edges
    const positions = [
      { x: 10, y: 10 },           // Top-left
      { x: canvasBox.width - 10, y: 10 },           // Top-right
      { x: 10, y: canvasBox.height - 10 },          // Bottom-left
      { x: canvasBox.width - 10, y: canvasBox.height - 10 }, // Bottom-right
    ];
    
    for (const pos of positions) {
      // Right-click at position
      await rightClickCanvas(pos.x, pos.y);
      
      // Verify menu appears
      const contextMenu = canvasPage.locator('.add-display-menu');
      await expect(contextMenu).toBeVisible();
      
      // Verify menu stays within viewport
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
      
      // Close menu
      await canvasPage.keyboard.press('Escape');
      await expect(contextMenu).not.toBeVisible();
    }
  });

  test('should handle canvas resize with open menu', async ({ canvasPage, rightClickCanvas }) => {
    // Right-click to open menu
    await rightClickCanvas(200, 150);
    
    // Verify menu is open
    const contextMenu = canvasPage.locator('.add-display-menu');
    await expect(contextMenu).toBeVisible();
    
    // Get initial menu position
    const menuBox = await contextMenu.boundingBox();
    
    if (!menuBox) {
      throw new Error('Menu bounds could not be determined');
    }
    
    // Resize viewport
    await canvasPage.setViewportSize({ width: 800, height: 600 });
    
    // Wait for potential repositioning
    await canvasPage.waitForTimeout(100);
    
    // Verify menu is still visible and within viewport
    await expect(contextMenu).toBeVisible();
    
    const newMenuBox = await contextMenu.boundingBox();
    
    if (!newMenuBox) {
      throw new Error('New menu bounds could not be determined');
    }
    
    const viewport = canvasPage.viewportSize();
    if (!viewport) {
      throw new Error('Viewport size could not be determined');
    }
    
    expect(newMenuBox.x).toBeGreaterThanOrEqual(0);
    expect(newMenuBox.y).toBeGreaterThanOrEqual(0);
    expect(newMenuBox.x + newMenuBox.width).toBeLessThanOrEqual(viewport.width);
    expect(newMenuBox.y + newMenuBox.height).toBeLessThanOrEqual(viewport.height);
  });
});