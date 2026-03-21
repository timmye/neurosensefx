import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5174';
const SELECTORS = {
  tickerContainer: '.ticker-container',
  identityColumn: '.identity-column',
  chartColumn: '.chart-column',
  statsColumn: '.stats-column',
  symbolLabel: '.symbol-label',
  priceValue: '.price-value',
  chartCanvas: '.chart-canvas',
  closeButton: '.close-button'
};

test.describe('Price Ticker - Alt+I Workflow', () => {

  test('creates ticker with Alt+I shortcut and verifies layout', async ({ page }) => {
    // Setup console monitoring
    page.on('console', msg => {
      if (msg.type() === 'error') console.error('Browser error:', msg.text());
    });

    // Handle the prompt dialog
    page.on('dialog', async dialog => {
      await dialog.accept('EURUSD');
    });

    // Navigate to application
    await page.goto(BASE_URL);

    // Wait for workspace API to be ready using page.evaluate
    await page.waitForFunction(() => {
      return typeof window.workspaceActions !== 'undefined' &&
             typeof window.workspaceActions.addDisplay === 'function';
    }, { timeout: 10000 });

    // Press Alt+I to create ticker
    await page.keyboard.press('Alt+i');

    // Wait for ticker to appear
    await page.waitForSelector(SELECTORS.tickerContainer, { timeout: 5000 });

    // Verify ticker container exists
    const ticker = page.locator(SELECTORS.tickerContainer);
    await expect(ticker).toBeVisible();

    // Verify dimensions
    const box = await ticker.boundingBox();
    expect(box).toBeTruthy();
    expect(box.width).toBeCloseTo(240, 1);
    expect(box.height).toBeCloseTo(80, 1);

    // Verify three-column layout
    await expect(ticker.locator(SELECTORS.identityColumn)).toBeVisible();
    await expect(ticker.locator(SELECTORS.chartColumn)).toBeVisible();
    await expect(ticker.locator(SELECTORS.statsColumn)).toBeVisible();

    // Verify symbol label exists
    await expect(ticker.locator(SELECTORS.symbolLabel)).toBeVisible();

    // Verify price value area exists
    await expect(ticker.locator(SELECTORS.priceValue)).toBeVisible();

    // Verify canvas exists
    await expect(ticker.locator(SELECTORS.chartCanvas)).toBeVisible();

    // Verify close button exists
    await expect(ticker.locator(SELECTORS.closeButton)).toBeVisible();
  });
});
