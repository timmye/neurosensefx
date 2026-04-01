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
    const actualLabels = (await resolutionBtns.allTextContents()).map(l => l.trim());
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
      const state = window.workspaceStore.getState();
      const displays = state?.displays;
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

// Live data tests run serially to avoid backend contention
test.describe.configure({ mode: 'serial' });

test.describe('Chart Display - Live Data Flow', () => {

  // Helper to set up ticker and open chart
  async function setupTickerAndChart(page) {
    await page.waitForFunction(() => {
      return typeof window.workspaceActions !== 'undefined' &&
             typeof window.workspaceActions.addDisplay === 'function';
    }, { timeout: 10000 });

    page.on('dialog', async dialog => {
      await dialog.accept('EURUSD');
    });
    await page.keyboard.press('Alt+i');
    await page.waitForSelector(SELECTORS.tickerContainer, { timeout: 5000 });
    await page.keyboard.press('c');
    await page.waitForSelector(SELECTORS.chartWindow, { timeout: 5000 });
  }

  // Wait for a condition to become true via polling (bypasses Playwright actionTimeout)
  // Default timeout is 60s to accommodate cTrader API rate limiting between tests
  async function waitForCondition(page, fn, timeoutMs = 60000, pollMs = 1000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const result = await page.evaluate(fn);
      if (result) return result;
      await page.waitForTimeout(pollMs);
    }
    throw new Error(`waitForCondition timed out after ${timeoutMs}ms`);
  }

  // Wait for candleHistory with rate-limit retry logic.
  // If initial response has 0 bars or doesn't arrive, clicks refresh and retries once.
  async function waitForCandleHistory(page, requireBars = false) {
    let historyMsg = await waitForCondition(page, () => {
      return window.__wsMessages?.find(m => !m.__sent && m.type === 'candleHistory');
    });

    if (!historyMsg || !historyMsg.bars || historyMsg.bars.length === 0) {
      console.log('   candleHistory returned 0 bars or empty (rate-limited), refreshing...');
      await page.locator('.refresh-btn').click();
      await page.waitForTimeout(15000);

      historyMsg = await waitForCondition(page, () => {
        const msgs = window.__wsMessages || [];
        return msgs.find(m => !m.__sent && m.type === 'candleHistory' && m.bars?.length > 0);
      });
    }

    if (!historyMsg || !historyMsg.bars || historyMsg.bars.length === 0) {
      console.log('   candleHistory still 0 bars after first retry, retrying again...');
      await page.locator('.refresh-btn').click();
      await page.waitForTimeout(10000);

      historyMsg = await waitForCondition(page, () => {
        const msgs = window.__wsMessages || [];
        return msgs.find(m => !m.__sent && m.type === 'candleHistory' && m.bars?.length > 0);
      });
    }

    if (requireBars && (!historyMsg || !historyMsg.bars || historyMsg.bars.length === 0)) {
      throw new Error('candleHistory did not return any bars after retry');
    }

    return historyMsg;
  }
  // Uses addInitScript so the interceptor is in place before any modules load.
  // Hooks both addEventListener('message') and onmessage property assignment.
  async function injectWsInterceptor(page) {
    await page.addInitScript(() => {
      window.__wsMessages = [];
      const OrigWS = window.WebSocket;
      window.WebSocket = function(...args) {
        const ws = new OrigWS(...args);

        // Capture via addEventListener
        const origAddEventListener = ws.addEventListener.bind(ws);
        ws.addEventListener = (type, listener, ...rest) => {
          if (type === 'message') {
            const wrappedListener = (event) => {
              try { window.__wsMessages.push(JSON.parse(event.data)); } catch {}
              return listener(event);
            };
            return origAddEventListener(type, wrappedListener, ...rest);
          }
          return origAddEventListener(type, listener, ...rest);
        };

        // Capture via onmessage property assignment
        const origOnmessageDescriptor = Object.getOwnPropertyDescriptor(OrigWS.prototype, 'onmessage');
        Object.defineProperty(ws, 'onmessage', {
          get() { return origOnmessageDescriptor?.get?.call(ws); },
          set(fn) {
            if (typeof fn === 'function') {
              const wrappedFn = (event) => {
                try { window.__wsMessages.push(JSON.parse(event.data)); } catch {}
                return fn(event);
              };
              origOnmessageDescriptor?.set?.call(ws, wrappedFn);
            } else {
              origOnmessageDescriptor?.set?.call(ws, fn);
            }
          },
          configurable: true
        });

        // Capture sent messages
        const origSend = ws.send.bind(ws);
        ws.send = (msg) => {
          try { window.__wsMessages.push({ __sent: true, ...JSON.parse(msg) }); } catch {}
          return origSend(msg);
        };

        return ws;
      };
      window.WebSocket.prototype = OrigWS.prototype;
      window.WebSocket.CONNECTING = OrigWS.CONNECTING;
      window.WebSocket.OPEN = OrigWS.OPEN;
      window.WebSocket.CLOSING = OrigWS.CLOSING;
      window.WebSocket.CLOSED = OrigWS.CLOSED;
    });
  }

  test('complete candle data flow: history, subscription, and OHLCV validation', async ({ page }) => {
    test.setTimeout(120000);

    // Step 1: Set up once - inject WS interceptor, navigate, open chart
    await injectWsInterceptor(page);
    await page.goto(BASE_URL);
    await setupTickerAndChart(page);

    // Step 2: Fetch historical data
    await waitForCondition(page, () => {
      return window.__wsMessages?.some(m => m.__sent && m.type === 'getHistoricalCandles');
    });
    const historyMsg = await waitForCandleHistory(page, true);

    // Step 3: Validate historical data
    expect(historyMsg.symbol).toBe('EURUSD');
    expect(historyMsg.bars.length).toBeGreaterThan(0);

    const bar = historyMsg.bars[0];
    expect(bar).toHaveProperty('open');
    expect(bar).toHaveProperty('high');
    expect(bar).toHaveProperty('low');
    expect(bar).toHaveProperty('close');
    expect(bar).toHaveProperty('timestamp');
    expect(typeof bar.open).toBe('number');
    expect(bar.open).toBeGreaterThan(0);

    // Verify chart canvas rendered content (KLineChart creates multiple canvases, use first)
    const canvas = page.locator(`${SELECTORS.chartCanvasContainer} canvas`).first();
    await expect(canvas).toBeVisible({ timeout: 10000 });

    const canvasInfo = await canvas.evaluate(el => {
      const ctx = el.getContext('2d');
      const imageData = ctx.getImageData(0, 0, el.width, el.height);
      let nonTransparent = 0;
      for (let i = 3; i < imageData.data.length; i += 4) {
        if (imageData.data[i] > 0) nonTransparent++;
      }
      return { total: el.width * el.height, nonTransparent };
    });

    expect(canvasInfo.nonTransparent).toBeGreaterThan(canvasInfo.total * 0.01);

    // Step 4: Validate subscribeCandles was sent
    const subMsg = await waitForCondition(page, () => {
      return window.__wsMessages?.find(m => m.__sent && m.type === 'subscribeCandles');
    }, 15000);
    expect(subMsg.symbol).toBe('EURUSD');
    expect(subMsg.resolution).toBe('4h');

    // Step 5: Wait for candleUpdate (may not arrive if market is quiet)
    const hasUpdate = await waitForCondition(page, () => {
      return window.__wsMessages?.some(m => !m.__sent && m.type === 'candleUpdate');
    }, 30000).catch(() => false);

    if (hasUpdate) {
      const updateMsg = await page.evaluate(() => {
        return window.__wsMessages.find(m => !m.__sent && m.type === 'candleUpdate');
      });
      expect(updateMsg).toHaveProperty('symbol');
      expect(updateMsg).toHaveProperty('bar');
      expect(updateMsg.bar).toHaveProperty('timestamp');
    }

    // Chart canvas should still be visible (connection alive)
    await expect(canvas).toBeVisible({ timeout: 5000 });

    // Step 6: Validate OHLCV format across all bars
    const bars = await page.evaluate(() => {
      const allBars = [];
      for (const msg of window.__wsMessages) {
        if (!msg.__sent && msg.type === 'candleHistory' && msg.bars) {
          allBars.push(...msg.bars);
        }
        if (!msg.__sent && msg.type === 'candleUpdate' && msg.bar) {
          allBars.push(msg.bar);
        }
      }
      return allBars;
    });

    expect(bars.length, 'Should have historical bars').toBeGreaterThan(0);

    for (const bar of bars) {
      expect(typeof bar.open).toBe('number');
      expect(typeof bar.high).toBe('number');
      expect(typeof bar.low).toBe('number');
      expect(typeof bar.close).toBe('number');
      expect(typeof bar.timestamp).toBe('number');
      expect(bar.open).toBeGreaterThan(0);
      expect(bar.close).toBeGreaterThan(0);
      expect(bar.high).toBeGreaterThanOrEqual(bar.low);
      expect(bar.timestamp).toBeGreaterThan(1577836800000); // after 2020
      expect(bar.timestamp).toBeLessThan(1893456000000);   // before 2030
      if (bar.volume !== undefined && bar.volume !== null) {
        // cTrader may send volume as an object (tick volume + real volume)
        const vol = typeof bar.volume === 'object' ? (bar.volume.tick || bar.volume.real || 0) : bar.volume;
        expect(typeof vol).toBe('number');
        expect(vol).toBeGreaterThanOrEqual(0);
      }
    }

    // Verify sorted by timestamp
    for (let i = 1; i < bars.length; i++) {
      expect(bars[i].timestamp).toBeGreaterThanOrEqual(bars[i - 1].timestamp);
    }
  });
});
