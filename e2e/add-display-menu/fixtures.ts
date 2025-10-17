// Test fixtures for AddDisplayMenu testing
import { test as base, expect, type Page, type Route } from '@playwright/test';

// Mock data for testing
const mockSymbols = [
  { symbol: 'EURUSD', name: 'EUR/USD', type: 'forex', pip: 0.0001 },
  { symbol: 'GBPUSD', name: 'GBP/USD', type: 'forex', pip: 0.0001 },
  { symbol: 'USDJPY', name: 'USD/JPY', type: 'forex', pip: 0.01 },
  { symbol: 'AUDUSD', name: 'AUD/USD', type: 'forex', pip: 0.0001 },
  { symbol: 'USDCAD', name: 'USD/CAD', type: 'forex', pip: 0.0001 },
];

const mockSymbolData = {
  EURUSD: {
    symbol: 'EURUSD',
    bid: 1.05678,
    ask: 1.05688,
    timestamp: Date.now(),
  },
  GBPUSD: {
    symbol: 'GBPUSD',
    bid: 1.23456,
    ask: 1.23466,
    timestamp: Date.now(),
  },
  USDJPY: {
    symbol: 'USDJPY',
    bid: 149.876,
    ask: 149.886,
    timestamp: Date.now(),
  },
};

// Extended test fixtures type
type TestFixtures = {
  canvasPage: Page;
  mockSymbolData: Page;
  mockEmptySymbolList: Page;
  mockNetworkError: Page;
  mockInvalidSymbolError: Page;
  rightClickCanvas: (x?: number, y?: number) => Promise<void>;
  selectMenuItem: (itemDataTest: string) => Promise<void>;
  selectSymbol: (symbol: string) => Promise<void>;
  waitForVisualization: (type?: string) => Promise<any>;
};

// Extend base test with custom fixtures
export const test = base.extend<TestFixtures>({
  // Page with canvas loaded
  canvasPage: async ({ page }, use: (page: Page) => void) => {
    await page.goto('/');
    await page.waitForSelector('#floating-canvas', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await use(page);
  },
  
  // Mock symbol data API
  mockSymbolData: async ({ page }, use: (page: Page) => void) => {
    // Mock the symbols API endpoint
    await page.route('/api/symbols', (route: Route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSymbols),
      });
    });
    
    // Mock individual symbol data endpoints
    for (const [symbol, data] of Object.entries(mockSymbolData)) {
      await page.route(`/api/symbols/${symbol}/data`, (route: Route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(data),
        });
      });
    }
    
    await use(page);
  },
  
  // Mock empty symbol list
  mockEmptySymbolList: async ({ page }, use: (page: Page) => void) => {
    await page.route('/api/symbols', (route: Route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
    await use(page);
  },
  
  // Mock network error for symbols
  mockNetworkError: async ({ page }, use: (page: Page) => void) => {
    await page.route('/api/symbols', (route: Route) => {
      route.abort('failed');
    });
    await use(page);
  },
  
  // Mock invalid symbol error
  mockInvalidSymbolError: async ({ page }, use: (page: Page) => void) => {
    // Mock valid symbols list
    await page.route('/api/symbols', (route: Route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSymbols),
      });
    });
    
    // Mock error for invalid symbol
    await page.route('/api/symbols/INVALID/data', (route: Route) => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Symbol not found' }),
      });
    });
    
    await use(page);
  },
  
  // Helper to right-click on canvas at specific position
  rightClickCanvas: async ({ page }, use: (fn: (x?: number, y?: number) => Promise<void>) => void) => {
    const rightClickAt = async (x = 200, y = 150) => {
      const canvas = page.locator('#floating-canvas');
      await canvas.waitFor({ state: 'visible' });
      
      // Get canvas bounds for precise clicking
      const canvasBox = await canvas.boundingBox();
      if (!canvasBox) {
        throw new Error('Canvas not found or not visible');
      }
      const clickX = canvasBox.x + x;
      const clickY = canvasBox.y + y;
      
      // Right-click at the specified position
      await page.mouse.move(clickX, clickY);
      await page.mouse.click(clickX, clickY, { button: 'right' });
      
      // Wait for context menu to appear
      await page.waitForSelector('.add-display-menu', { state: 'visible', timeout: 5000 });
    };
    
    await use(rightClickAt);
  },
  
  // Helper to select a menu item
  selectMenuItem: async ({ page }, use: (fn: (itemDataTest: string) => Promise<void>) => void) => {
    const selectItem = async (itemDataTest: string) => {
      const menuItem = page.locator(`[data-test="${itemDataTest}"]`);
      await menuItem.waitFor({ state: 'visible' });
      await menuItem.click();
    };
    
    await use(selectItem);
  },
  
  // Helper to select a symbol from the symbol selector
  selectSymbol: async ({ page }, use: (fn: (symbol: string) => Promise<void>) => void) => {
    const selectSymbolFunc = async (symbol: string) => {
      // Wait for symbol selector to appear
      await page.waitForSelector('.symbol-selector', { state: 'visible' });
      
      // If search is available, use it
      const searchInput = page.locator('.symbol-search');
      if (await searchInput.isVisible()) {
        await searchInput.fill(symbol);
      }
      
      // Click on the symbol
      const symbolOption = page.locator(`[data-symbol="${symbol}"]`);
      await symbolOption.waitFor({ state: 'visible' });
      await symbolOption.click();
      
      // Wait for symbol selector to close
      await page.waitForSelector('.symbol-selector', { state: 'hidden' });
    };
    
    await use(selectSymbolFunc);
  },
  
  // Helper to wait for visualization to appear
  waitForVisualization: async ({ page }, use: (fn: (type?: string) => Promise<any>) => void) => {
    const waitForViz = async (type = 'price-display') => {
      await page.waitForSelector(`.${type}`, { state: 'visible', timeout: 10000 });
      return page.locator(`.${type}`);
    };
    
    await use(waitForViz);
  },
});

// Export the extended test and expect
export { expect, mockSymbols, mockSymbolData };