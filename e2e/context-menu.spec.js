/**
 * Context Menu Functionality Tests
 * Tests the right-click context menu system for floating canvases
 */

import { test, expect } from '@playwright/test';

test.describe('Context Menu System', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:5173');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Enable floating canvases if not already enabled
    const floatingCanvasesToggle = page.locator('input[type="checkbox"]').first();
    if (await floatingCanvasesToggle.isVisible() && !(await floatingCanvasesToggle.isChecked())) {
      await floatingCanvasesToggle.check();
    }
    
    // Wait for floating canvases to be enabled
    await page.waitForSelector('.workspace-container', { state: 'visible' });
  });

  test('should show context menu on right-click of floating canvas', async ({ page }) => {
    // Add a floating canvas first
    await page.click('button:has-text("Add First Canvas")', { timeout: 10000 });
    
    // Wait for canvas to appear
    await page.waitForSelector('.floating-canvas', { state: 'visible' });
    
    // Right-click on the floating canvas
    const canvas = page.locator('.floating-canvas').first();
    await canvas.click({ button: 'right' });
    
    // Check that context menu appears
    const contextMenu = page.locator('.context-menu');
    await expect(contextMenu).toBeVisible({ timeout: 100 });
    
    // Verify context menu content
    await expect(contextMenu.locator('h3')).toContainText('Canvas Controls');
    await expect(contextMenu.locator('.canvas-id')).toBeVisible();
    
    // Check for control sections
    await expect(contextMenu.locator('h4:has-text("Quick Actions")')).toBeVisible();
    await expect(contextMenu.locator('h4:has-text("Price Display")')).toBeVisible();
    await expect(contextMenu.locator('h4:has-text("Market Profile")')).toBeVisible();
    await expect(contextMenu.locator('h4:has-text("Volatility")')).toBeVisible();
    await expect(contextMenu.locator('h4:has-text("Canvas Settings")')).toBeVisible();
  });

  test('should appear within 100ms of right-click', async ({ page }) => {
    // Add a floating canvas
    await page.click('button:has-text("Add First Canvas")', { timeout: 10000 });
    
    // Wait for canvas to appear
    await page.waitForSelector('.floating-canvas', { state: 'visible' });
    
    const canvas = page.locator('.floating-canvas').first();
    
    // Measure time from right-click to context menu appearance
    const startTime = Date.now();
    await canvas.click({ button: 'right' });
    
    const contextMenu = page.locator('.context-menu');
    await contextMenu.waitFor({ state: 'visible', timeout: 1000 });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Verify context menu appears within 100ms
    expect(responseTime).toBeLessThan(100);
  });

  test('should position context menu correctly at click location', async ({ page }) => {
    // Add a floating canvas
    await page.click('button:has-text("Add First Canvas")', { timeout: 10000 });
    
    // Wait for canvas to appear
    await page.waitForSelector('.floating-canvas', { state: 'visible' });
    
    const canvas = page.locator('.floating-canvas').first();
    const canvasBox = await canvas.boundingBox();
    
    // Right-click at a specific position within the canvas
    const clickX = canvasBox.x + 50;
    const clickY = canvasBox.y + 50;
    
    await page.mouse.click(clickX, clickY, { button: 'right' });
    
    // Check context menu position
    const contextMenu = page.locator('.context-menu');
    await expect(contextMenu).toBeVisible();
    
    const menuBox = await contextMenu.boundingBox();
    
    // Verify menu is positioned near the click location (within 50px)
    expect(Math.abs(menuBox.x - clickX)).toBeLessThan(50);
    expect(Math.abs(menuBox.y - clickY)).toBeLessThan(50);
  });

  test('should close context menu on Escape key', async ({ page }) => {
    // Add a floating canvas
    await page.click('button:has-text("Add First Canvas")', { timeout: 10000 });
    
    // Wait for canvas to appear
    await page.waitForSelector('.floating-canvas', { state: 'visible' });
    
    // Right-click to show context menu
    const canvas = page.locator('.floating-canvas').first();
    await canvas.click({ button: 'right' });
    
    // Verify context menu is visible
    const contextMenu = page.locator('.context-menu');
    await expect(contextMenu).toBeVisible();
    
    // Press Escape key
    await page.keyboard.press('Escape');
    
    // Verify context menu is hidden
    await expect(contextMenu).toBeHidden();
  });

  test('should close context menu on click outside', async ({ page }) => {
    // Add a floating canvas
    await page.click('button:has-text("Add First Canvas")', { timeout: 10000 });
    
    // Wait for canvas to appear
    await page.waitForSelector('.floating-canvas', { state: 'visible' });
    
    // Right-click to show context menu
    const canvas = page.locator('.floating-canvas').first();
    await canvas.click({ button: 'right' });
    
    // Verify context menu is visible
    const contextMenu = page.locator('.context-menu');
    await expect(contextMenu).toBeVisible();
    
    // Click outside the context menu
    await page.click('.workspace-container', { position: { x: 10, y: 10 } });
    
    // Verify context menu is hidden
    await expect(contextMenu).toBeHidden();
  });

  test('should allow changing configuration settings', async ({ page }) => {
    // Add a floating canvas
    await page.click('button:has-text("Add First Canvas")', { timeout: 10000 });
    
    // Wait for canvas to appear
    await page.waitForSelector('.floating-canvas', { state: 'visible' });
    
    // Right-click to show context menu
    const canvas = page.locator('.floating-canvas').first();
    await canvas.click({ button: 'right' });
    
    // Verify context menu is visible
    const contextMenu = page.locator('.context-menu');
    await expect(contextMenu).toBeVisible();
    
    // Toggle a setting
    const marketProfileToggle = contextMenu.locator('input[type="checkbox"]').first();
    const initialState = await marketProfileToggle.isChecked();
    await marketProfileToggle.click();
    
    // Verify the setting changed
    const newState = await marketProfileToggle.isChecked();
    expect(newState).toBe(!initialState);
    
    // Change a range value
    const rangeInput = contextMenu.locator('input[type="range"]').first();
    await rangeInput.fill('80');
    
    // Verify the value changed
    const rangeValue = contextMenu.locator('.range-value').first();
    await expect(rangeValue).toContainText('80');
  });

  test('should show correct canvas ID in context menu', async ({ page }) => {
    // Add a floating canvas
    await page.click('button:has-text("Add First Canvas")', { timeout: 10000 });
    
    // Wait for canvas to appear
    await page.waitForSelector('.floating-canvas', { state: 'visible' });
    
    // Get canvas ID from data attribute
    const canvas = page.locator('.floating-canvas').first();
    const canvasId = await canvas.getAttribute('data-canvas-id');
    
    // Right-click to show context menu
    await canvas.click({ button: 'right' });
    
    // Verify context menu shows correct canvas ID
    const contextMenu = page.locator('.context-menu');
    await expect(contextMenu).toBeVisible();
    
    const canvasIdElement = contextMenu.locator('.canvas-id');
    await expect(canvasIdElement).toContainText(`ID: ${canvasId}`);
  });

  test('should handle multiple canvases correctly', async ({ page }) => {
    // Add two floating canvases
    await page.click('button:has-text("Add First Canvas")', { timeout: 10000 });
    await page.waitForSelector('.floating-canvas', { state: 'visible' });
    
    // Add second canvas using Ctrl+N
    await page.keyboard.press('Control+n');
    await page.waitForSelector('.floating-canvas:nth-child(2)', { state: 'visible' });
    
    // Get both canvases
    const canvas1 = page.locator('.floating-canvas').first();
    const canvas2 = page.locator('.floating-canvas').nth(1);
    
    // Get canvas IDs
    const canvas1Id = await canvas1.getAttribute('data-canvas-id');
    const canvas2Id = await canvas2.getAttribute('data-canvas-id');
    
    // Right-click on first canvas
    await canvas1.click({ button: 'right' });
    const contextMenu = page.locator('.context-menu');
    await expect(contextMenu).toBeVisible();
    await expect(contextMenu.locator('.canvas-id')).toContainText(`ID: ${canvas1Id}`);
    
    // Close context menu
    await page.keyboard.press('Escape');
    
    // Right-click on second canvas
    await canvas2.click({ button: 'right' });
    await expect(contextMenu).toBeVisible();
    await expect(contextMenu.locator('.canvas-id')).toContainText(`ID: ${canvas2Id}`);
  });
});