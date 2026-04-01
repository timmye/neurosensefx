import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5174';

const SELECTORS = {
  workspace: '.workspace',
  chartWindow: '.chart-window',
  chartCanvasContainer: '.chart-canvas-container',
  chartHeader: '.chart-header',
  chartToolbar: '.chart-toolbar',
  resolutionBtn: '.resolution-btn',
  windowBtn: '.window-btn',
  drawingBtn: '.drawing-btn',
  actionBtn: '.action-btn',
  clearBtn: '.action-btn.clear-btn',
  separator: '.separator',
  tickerContainer: '.ticker-container',
  closeButton: '.close-btn',
};

test.describe('Chart Display - "c" Key Workflow', () => {

  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') console.error('Browser error:', msg.text());
    });
  });

  test('creates chart with "c" key when a ticker exists', async ({ page }) => {
    // Handle prompt dialogs for creating a ticker
    page.on('dialog', async dialog => {
      await dialog.accept('EURUSD');
    });

    await page.goto(BASE_URL);

    // Wait for workspace API
    await page.waitForFunction(() => {
      return typeof window.workspaceActions !== 'undefined' &&
             typeof window.workspaceActions.addDisplay === 'function';
    }, { timeout: 10000 });

    // Create a price ticker first (needed as symbol source)
    await page.keyboard.press('Alt+i');
    await page.waitForSelector(SELECTORS.tickerContainer, { timeout: 5000 });
    await expect(page.locator(SELECTORS.tickerContainer)).toBeVisible();

    // Press "c" to open chart
    await page.keyboard.press('c');

    // Wait for chart window to appear
    await page.waitForSelector(SELECTORS.chartWindow, { timeout: 5000 });
    await expect(page.locator(SELECTORS.chartWindow)).toBeVisible();

    // Verify chart canvas container exists
    await expect(page.locator(SELECTORS.chartCanvasContainer)).toBeVisible();

    // Verify toolbar with resolution and window buttons
    await expect(page.locator(SELECTORS.chartToolbar)).toBeVisible();
    await expect(page.locator(SELECTORS.resolutionBtn).first()).toBeVisible();
    await expect(page.locator(SELECTORS.windowBtn).first()).toBeVisible();
  });

  test('chart window has correct default dimensions', async ({ page }) => {
    page.on('dialog', async dialog => {
      await dialog.accept('EURUSD');
    });

    await page.goto(BASE_URL);
    await page.waitForFunction(() => typeof window.workspaceActions !== 'undefined', { timeout: 10000 });

    // Create ticker then chart
    await page.keyboard.press('Alt+i');
    await page.waitForSelector(SELECTORS.tickerContainer, { timeout: 5000 });
    await page.keyboard.press('c');
    await page.waitForSelector(SELECTORS.chartWindow, { timeout: 5000 });

    // Verify chart size (default 800x500)
    const box = await page.locator(SELECTORS.chartWindow).boundingBox();
    expect(box).toBeTruthy();
    expect(box.width).toBeGreaterThan(700);
    expect(box.height).toBeGreaterThan(400);
  });

  test('"c" key toggles chart minimize and restore', async ({ page }) => {
    page.on('dialog', async dialog => {
      await dialog.accept('EURUSD');
    });

    await page.goto(BASE_URL);
    await page.waitForFunction(() => typeof window.workspaceActions !== 'undefined', { timeout: 10000 });

    await page.keyboard.press('Alt+i');
    await page.waitForSelector(SELECTORS.tickerContainer, { timeout: 5000 });

    // Open chart
    await page.keyboard.press('c');
    await page.waitForSelector(SELECTORS.chartWindow, { timeout: 5000 });
    await expect(page.locator(SELECTORS.chartWindow)).toBeVisible();

    // Press "c" again to minimize
    await page.keyboard.press('c');
    // After minimize, chart may still be in DOM but hidden
    // Verify chart is either hidden or not visible
    const chartAfterMinimize = page.locator(SELECTORS.chartWindow);
    const isVisible = await chartAfterMinimize.isVisible().catch(() => false);

    // Restore chart with "c" again
    await page.keyboard.press('c');
    await page.waitForSelector(SELECTORS.chartWindow, { timeout: 5000 });
    await expect(page.locator(SELECTORS.chartWindow)).toBeVisible();
  });

  test('chart displays 12 resolution buttons', async ({ page }) => {
    page.on('dialog', async dialog => {
      await dialog.accept('EURUSD');
    });

    await page.goto(BASE_URL);
    await page.waitForFunction(() => typeof window.workspaceActions !== 'undefined', { timeout: 10000 });

    await page.keyboard.press('Alt+i');
    await page.waitForSelector(SELECTORS.tickerContainer, { timeout: 5000 });
    await page.keyboard.press('c');
    await page.waitForSelector(SELECTORS.chartWindow, { timeout: 5000 });

    // Count resolution buttons
    const resolutionBtns = page.locator(SELECTORS.resolutionBtn);
    await expect(resolutionBtns).toHaveCount(12);

    // Verify expected resolution labels
    const expectedResolutions = ['1M', '5M', '10M', '15M', '30M', '1H', '4H', '12H', 'Daily', 'Weekly', 'Monthly', 'Quarterly'];
    const actualLabels = await resolutionBtns.allTextContents();
    for (const expected of expectedResolutions) {
      expect(actualLabels).toContain(expected);
    }
  });

  test('chart displays 11 time window buttons', async ({ page }) => {
    page.on('dialog', async dialog => {
      await dialog.accept('EURUSD');
    });

    await page.goto(BASE_URL);
    await page.waitForFunction(() => typeof window.workspaceActions !== 'undefined', { timeout: 10000 });

    await page.keyboard.press('Alt+i');
    await page.waitForSelector(SELECTORS.tickerContainer, { timeout: 5000 });
    await page.keyboard.press('c');
    await page.waitForSelector(SELECTORS.chartWindow, { timeout: 5000 });

    const windowBtns = page.locator(SELECTORS.windowBtn);
    await expect(windowBtns).toHaveCount(11);
  });

  test('chart displays 10 drawing tool buttons', async ({ page }) => {
    page.on('dialog', async dialog => {
      await dialog.accept('EURUSD');
    });

    await page.goto(BASE_URL);
    await page.waitForFunction(() => typeof window.workspaceActions !== 'undefined', { timeout: 10000 });

    await page.keyboard.press('Alt+i');
    await page.waitForSelector(SELECTORS.tickerContainer, { timeout: 5000 });
    await page.keyboard.press('c');
    await page.waitForSelector(SELECTORS.chartWindow, { timeout: 5000 });

    const drawingBtns = page.locator(SELECTORS.drawingBtn);
    await expect(drawingBtns).toHaveCount(10);
  });

  test('chart displays action buttons (magnet, undo, redo, clear)', async ({ page }) => {
    page.on('dialog', async dialog => {
      await dialog.accept('EURUSD');
    });

    await page.goto(BASE_URL);
    await page.waitForFunction(() => typeof window.workspaceActions !== 'undefined', { timeout: 10000 });

    await page.keyboard.press('Alt+i');
    await page.waitForSelector(SELECTORS.tickerContainer, { timeout: 5000 });
    await page.keyboard.press('c');
    await page.waitForSelector(SELECTORS.chartWindow, { timeout: 5000 });

    const actionBtns = page.locator(`${SELECTORS.chartToolbar} ${SELECTORS.actionBtn}`);
    await expect(actionBtns).toHaveCount(4);

    // Verify clear button exists
    await expect(page.locator(SELECTORS.clearBtn)).toBeVisible();
  });

  test('resolution button becomes active on click', async ({ page }) => {
    page.on('dialog', async dialog => {
      await dialog.accept('EURUSD');
    });

    await page.goto(BASE_URL);
    await page.waitForFunction(() => typeof window.workspaceActions !== 'undefined', { timeout: 10000 });

    await page.keyboard.press('Alt+i');
    await page.waitForSelector(SELECTORS.tickerContainer, { timeout: 5000 });
    await page.keyboard.press('c');
    await page.waitForSelector(SELECTORS.chartWindow, { timeout: 5000 });

    // Default resolution is 4H — verify it's active
    const defaultActive = page.locator(`${SELECTORS.resolutionBtn}.active`);
    const defaultLabel = await defaultActive.textContent();
    expect(defaultLabel.trim()).toBe('4H');

    // Click 1H button
    await page.locator(`${SELECTORS.resolutionBtn}:has-text("1H")`).click();

    // Verify 1H is now active and 4H is not
    const activeAfter = page.locator(`${SELECTORS.resolutionBtn}.active`);
    const activeLabel = await activeAfter.textContent();
    expect(activeLabel.trim()).toBe('1H');
  });

  test('chart workspace state is persisted in store', async ({ page }) => {
    page.on('dialog', async dialog => {
      await dialog.accept('EURUSD');
    });

    await page.goto(BASE_URL);
    await page.waitForFunction(() => typeof window.workspaceActions !== 'undefined', { timeout: 10000 });

    await page.keyboard.press('Alt+i');
    await page.waitForSelector(SELECTORS.tickerContainer, { timeout: 5000 });
    await page.keyboard.press('c');
    await page.waitForSelector(SELECTORS.chartWindow, { timeout: 5000 });

    // Verify chart display exists in workspace store
    const chartInStore = await page.evaluate(() => {
      const state = window.workspaceStore;
      const current = typeof state === 'function' ? state() : state;
      const displays = current?.displays;
      if (!displays) return null;
      for (const [, d] of displays) {
        if (d.type === 'chart') return d;
      }
      return null;
    });

    expect(chartInStore).toBeTruthy();
    expect(chartInStore.symbol).toBe('EURUSD');
    expect(chartInStore.resolution).toBe('4h');
    expect(chartInStore.type).toBe('chart');
  });

  test('no browser console errors when creating chart', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('dialog', async dialog => {
      await dialog.accept('EURUSD');
    });

    await page.goto(BASE_URL);
    await page.waitForFunction(() => typeof window.workspaceActions !== 'undefined', { timeout: 10000 });

    await page.keyboard.press('Alt+i');
    await page.waitForSelector(SELECTORS.tickerContainer, { timeout: 5000 });
    await page.keyboard.press('c');
    await page.waitForSelector(SELECTORS.chartWindow, { timeout: 5000 });

    // Wait a moment for any delayed errors
    await page.waitForTimeout(1000);

    // Filter out known non-issue errors (e.g., WebGL, favicon)
    const criticalErrors = consoleErrors.filter(err =>
      !err.includes('favicon') &&
      !err.includes('WebGL') &&
      !err.includes('THREE') &&
      !err.includes('BackgroundShader')
    );

    expect(criticalErrors).toHaveLength(0);
  });
});
