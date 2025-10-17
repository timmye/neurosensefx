// Workflow Test Fixtures for Primary Trader Workflows
// Reusable utilities for workflow-based testing

import { test as base, expect } from '@playwright/test';
import { createLogMonitor, COMMON_ERROR_PATTERNS } from '../utils/browserLogMonitor.js';

// Extended test fixtures with workflow utilities
export const test = base.extend({
  // Enhanced page with log monitoring
  workflowPage: async ({ page }, use) => {
    // Create log monitor
    const logMonitor = createLogMonitor(page);
    
    // Set up page with longer timeouts for workflow tests
    page.setDefaultTimeout(10000);
    page.setDefaultNavigationTimeout(15000);
    
    // Navigate to application
    await page.goto('/');
    
    // Wait for application to load
    await page.waitForSelector('.workspace-container', { timeout: 10000 });
    
    // Wait a moment for floating panels to initialize
    await page.waitForTimeout(2000);
    
    // Store log monitor on page for access in tests
    page.logMonitor = logMonitor;
    
    await use(page);
  },
  
  // Utility to wait for floating panels to be visible
  waitForFloatingPanels: async ({ page }, use) => {
    const waitPanels = async () => {
      // Wait for all floating panels to be attached to DOM (not necessarily visible)
      await Promise.all([
        page.waitForSelector('[data-panel-id="symbol-palette"]', { state: 'attached', timeout: 5000 }),
        page.waitForSelector('[data-panel-id="debug-panel"]', { state: 'attached', timeout: 5000 }),
        page.waitForSelector('[data-panel-id="system-panel"]', { state: 'attached', timeout: 5000 }),
        page.waitForSelector('[data-panel-id="adr-panel"]', { state: 'attached', timeout: 5000 })
      ]);
      
      // Give panels a moment to fully render
      await page.waitForTimeout(1000);
    };
    
    await use(waitPanels);
  },
  
  // Utility to select symbol from palette
  selectSymbol: async ({ page }, use) => {
    const selectSymbolFromPalette = async (symbol = 'EURUSD') => {
      // Find symbol palette
      const palette = page.locator('[data-panel-id="symbol-palette"]');
      await expect(palette).toBeVisible();
      
      // Find symbol selector input
      const searchInput = palette.locator('#symbol-selector');
      if (await searchInput.count() > 0) {
        await searchInput.fill(symbol);
        await page.waitForTimeout(500);
      }
      
      // Find symbol option or button
      const symbolOption = palette.locator(`[data-symbol="${symbol}"]`).first();
      if (await symbolOption.count() > 0) {
        await symbolOption.click();
      } else {
        // Try clicking on recent symbol buttons
        const recentButton = palette.locator('.recent-symbol-btn').filter({ hasText: symbol }).first();
        if (await recentButton.count() > 0) {
          await recentButton.click();
        }
      }
      
      await page.waitForTimeout(500);
    };
    
    await use(selectSymbolFromPalette);
  },
  
  // Utility to create canvas from palette
  createCanvas: async ({ page }, use) => {
    const createCanvasFromPalette = async (symbol = null) => {
      // Select symbol if provided
      if (symbol) {
        const selectSymbol = async (s) => {
          const palette = page.locator('[data-panel-id="symbol-palette"]');
          const searchInput = palette.locator('#symbol-selector');
          if (await searchInput.count() > 0) {
            await searchInput.fill(s);
            await page.waitForTimeout(500);
          }
        };
        await selectSymbol(symbol);
      }
      
      // Find and click create canvas button
      const createButton = page.locator('.create-btn');
      await expect(createButton).toBeVisible();
      await createButton.click();
      
      // Wait for canvas to be created
      await page.waitForTimeout(1000);
      
      // Verify canvas exists
      const canvases = page.locator('.floating-canvas');
      await expect(canvases).toHaveCount(1);
      
      return canvases.first();
    };
    
    await use(createCanvasFromPalette);
  },
  
  // Utility to open context menu on canvas
  openContextMenu: async ({ page }, use) => {
    const openCanvasContextMenu = async (canvasIndex = 0) => {
      // Get canvas
      const canvas = page.locator('.floating-canvas').nth(canvasIndex);
      await expect(canvas).toBeVisible();
      
      // Get canvas bounding box
      const canvasBox = await canvas.boundingBox();
      
      // Right-click in the middle of the canvas
      await page.mouse.move(
        canvasBox.x + canvasBox.width / 2,
        canvasBox.y + canvasBox.height / 2
      );
      await page.mouse.click(
        canvasBox.x + canvasBox.width / 2,
        canvasBox.y + canvasBox.height / 2,
        { button: 'right' }
      );
      
      // Wait for context menu to appear
      await page.waitForSelector('.context-menu.enhanced', { state: 'visible', timeout: 3000 });
      
      return page.locator('.context-menu.enhanced');
    };
    
    await use(openCanvasContextMenu);
  },
  
  // Utility to validate browser logs
  validateLogs: async ({ page }, use) => {
    const validateBrowserLogs = async () => {
      const logMonitor = page.logMonitor;
      const validation = logMonitor.validateNoErrors();
      
      // Check for common error patterns
      const errorMatches = logMonitor.checkForErrorPatterns(COMMON_ERROR_PATTERNS);
      
      // Get performance metrics
      const performance = await logMonitor.getPerformanceMetrics();
      
      return {
        ...validation,
        errorMatches,
        performance,
        exported: logMonitor.exportLogs()
      };
    };
    
    await use(validateBrowserLogs);
  }
});

// Export expect for use in tests
export { expect };

// Common test data
export const TEST_SYMBOLS = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD'];

// Common wait times
export const WAIT_TIMES = {
  SHORT: 500,
  MEDIUM: 1000,
  LONG: 2000,
  EXTRA_LONG: 5000
};

// Common selectors
export const SELECTORS = {
  WORKSPACE: '.workspace-container',
  FLOATING_PANELS: {
    SYMBOL_PALETTE: '[data-panel-id="symbol-palette"]',
    DEBUG_PANEL: '[data-panel-id="debug-panel"]',
    SYSTEM_PANEL: '[data-panel-id="system-panel"]',
    ADR_PANEL: '[data-panel-id="adr-panel"]'
  },
  CANVAS: '.floating-canvas',
  CONTEXT_MENU: '.context-menu.enhanced',
  CREATE_BUTTON: '.create-btn',
  SYMBOL_SEARCH: '#symbol-selector',
  RECENT_SYMBOL: '.recent-symbol-btn'
};