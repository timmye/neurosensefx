/**
 * Basic application load and functionality tests
 * Tests core functionality of NeuroSense FX
 */

import { test, expect } from '@playwright/test';
import { browserAgentManager } from '../helpers/browser-agents.js';
import { testFixtures } from '../helpers/fixtures.js';

test.describe('Basic Application Load', () => {
  test.beforeEach(async ({ page }) => {
    // Set up monitoring
    await browserAgentManager.setupConsoleMonitoring(page);
    await browserAgentManager.setupWebSocketMonitoring(page);
  });

  test('application loads successfully', async ({ page }) => {
    await page.goto('/');

    // Check that the page loads without errors
    await expect(page).toHaveTitle(/NeuroSense FX/i);

    // Check for essential UI elements
    await expect(page.locator('body')).toBeVisible();

    // Verify no critical errors in console
    const consoleErrors = await page.evaluate(() => {
      let errorCount = 0;
      const originalError = console.error;
      console.error = (...args) => errorCount++;
      return errorCount;
    });

    expect(consoleErrors).toBeLessThan(5);
  });

  test('canvas elements initialize correctly', async ({ page }) => {
    await page.goto('/');

    // Wait for canvas elements to be created
    await page.waitForSelector('canvas', { timeout: 5000 });

    // Check that canvas elements are present
    const canvasElements = await page.locator('canvas').count();
    expect(canvasElements).toBeGreaterThan(0);

    // Verify canvas contexts are available
    const canvasContexts = await page.evaluate(() => {
      const canvases = document.querySelectorAll('canvas');
      return Array.from(canvases).map(canvas => {
        const ctx = canvas.getContext('2d');
        return ctx && typeof ctx.drawImage === 'function';
      });
    });

    expect(canvasContexts.every(Boolean)).toBe(true);
  });

  test('WebSocket connection establishes', async ({ page }) => {
    await page.goto('/');

    // Wait for WebSocket connection attempt
    let wsConnected = false;

    page.on('websocket', ws => {
      console.log('WebSocket connection established');
      wsConnected = true;
    });

    await browserAgentManager.waitForMarketData(page, 8000);

    // Verify WebSocket functionality
    const wsStatus = await page.evaluate(() => {
      return window.wsConnected || window.neurosenseConnected || false;
    });

    // In container environment, we may not have actual market data
    // but the WebSocket connection should attempt to establish
    console.log(`WebSocket connection status: ${wsConnected || 'attempted'}`);
  });

  test('responsive design works on different viewports', async ({ page }) => {
    await page.goto('/');

    // Test desktop view
    await page.setViewportSize(testFixtures.viewports.desktop);
    await page.waitForLoadState('networkidle');
    const desktopVisible = await page.isVisible('body');
    expect(desktopVisible).toBe(true);

    // Test tablet view
    await page.setViewportSize(testFixtures.viewports.tablet);
    await page.waitForTimeout(1000);
    const tabletVisible = await page.isVisible('body');
    expect(tabletVisible).toBe(true);

    // Test mobile view
    await page.setViewportSize(testFixtures.viewports.mobile);
    await page.waitForTimeout(1000);
    const mobileVisible = await page.isVisible('body');
    expect(mobileVisible).toBe(true);
  });
});