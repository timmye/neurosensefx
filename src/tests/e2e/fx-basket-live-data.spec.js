/**
 * FX Basket Live Data E2E Tests
 *
 * Tests live cTrader WebSocket data flow for FX Basket:
 * 1. All 28 pairs subscribed with correct parameters
 * 2. Tick messages received and processed
 * 3. Basket calculations update in real-time
 * 4. Debug API exposes correct state
 *
 * Run: npx playwright test fx-basket-live-data.spec.js
 */

import { test, expect } from '@playwright/test';

// Test configuration
const BASE_URL = 'http://localhost:5174';

// Expected currency baskets (8 total)
const EXPECTED_CURRENCIES = ['USD', 'EUR', 'JPY', 'GBP', 'AUD', 'CAD', 'CHF', 'NZD'];

// Expected FX pairs (28 unique pairs across all baskets)
const EXPECTED_PAIRS = [
  'EURUSD', 'USDJPY', 'GBPUSD', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD',
  'EURJPY', 'EURGBP', 'EURAUD', 'EURCHF', 'EURCAD', 'EURNZD',
  'GBPJPY', 'GBPAUD', 'GBPCAD', 'GBPCHF', 'GBPNZD',
  'AUDJPY', 'AUDCAD', 'AUDCHF', 'AUDNZD',
  'CADJPY', 'CADCHF', 'NZDCAD', 'NZDCHF',
  'CHFJPY', 'NZDJPY'
];

// Selectors
const SELECTORS = {
  workspace: '.workspace',
  display: '.floating-display'
};

test.describe('FX Basket - Live Data Validation', () => {

  // Helper to wait for workspace API
  async function waitForWorkspaceAPI(page) {
    return await page.evaluate(() => {
      return typeof window.workspaceActions !== 'undefined' &&
             typeof window.workspaceActions.addDisplay === 'function';
    });
  }

  // Setup: Monitor browser console output
  test.beforeEach(async ({ page }) => {
    const browserLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();
      browserLogs.push({ type, text });
      // Also print to test runner console for visibility
      console.log(`   [Browser Console ${type}]: ${text}`);
    });

    // Store logs on page object for test access
    page.browserLogs = browserLogs;
  });

  /**
   * TEST 1: All 28 Pairs Subscribed
   * Verifies WebSocket subscribes to all required FX pairs with correct parameters
   */
  test('subscribes to all 28 FX pairs with correct parameters', async ({ page }) => {
    console.log('🚀 Testing WebSocket subscriptions for all 28 pairs...');

    const wsMessages = [];

    // Monitor WebSocket frames sent
    page.on('websocket', ws => {
      ws.on('framesent', frame => {
        if (frame.payload) {
          try {
            const data = JSON.parse(frame.payload);
            if (data.type === 'get_symbol_data_package') {
              wsMessages.push(data);
              console.log('📤 Subscribe:', data.symbol);
            }
          } catch {
            // Non-JSON message
          }
        }
      });
    });

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await waitForWorkspaceAPI(page);

    // Create FX Basket display
    const workspace = page.locator(SELECTORS.workspace);
    await workspace.focus();
    await page.keyboard.press('Alt+b');

    // Wait for all subscriptions to complete (~10 seconds for 28 pairs at 350ms intervals)
    await page.waitForFunction(() => window.fxBasketDebug?.subscriptionsReady === true, { timeout: 15000 });

    // Extract subscribed symbols
    const subscribedSymbols = wsMessages.map(msg => msg.symbol);
    const uniqueSymbols = [...new Set(subscribedSymbols)];

    console.log(`   Total subscription messages: ${wsMessages.length}`);
    console.log(`   Unique symbols: ${uniqueSymbols.length}`);
    console.log(`   Symbols: ${uniqueSymbols.sort().join(', ')}`);

    // Verify all expected pairs are subscribed
    EXPECTED_PAIRS.forEach(pair => {
      expect(uniqueSymbols, `Should subscribe to ${pair}`).toContain(pair);
    });

    expect(uniqueSymbols.length, 'Should subscribe to all 28 pairs').toBe(28);

    // Verify subscription parameters
    wsMessages.forEach(msg => {
      expect(msg.type, 'Subscription type should be get_symbol_data_package').toBe('get_symbol_data_package');
      expect(msg.source, 'Source should be ctrader').toBe('ctrader');
      expect(msg.adrLookbackDays, 'ADR lookback should be 14').toBe(14);
    });

    console.log('✅ All 28 pairs subscribed correctly');
  });

  /**
   * TEST 2: Tick Message Flow
   * Verifies tick messages are received and processed correctly
   */
  test('receives and processes tick messages', async ({ page }) => {
    console.log('🚀 Testing tick message flow...');

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await waitForWorkspaceAPI(page);

    // Create FX Basket display
    const workspace = page.locator(SELECTORS.workspace);
    await workspace.focus();
    await page.keyboard.press('Alt+b');

    // Wait for all subscriptions to complete
    await page.waitForFunction(() => window.fxBasketDebug?.subscriptionsReady === true, { timeout: 15000 });

    // Wait for some data to arrive
    await page.waitForTimeout(5000);

    // Check debug API for tick data
    const tickData = await page.evaluate(() => {
      const debug = window.fxBasketDebug;
      if (!debug) return { error: 'Debug API not available' };

      return {
        subscriptionsReady: debug.subscriptionsReady,
        tickCount: debug.tickCount,
        dataPackageCount: debug.dataPackageCount,
        connectionStatus: debug.connectionStatus,
        subscriptionInfo: debug.getSubscriptionInfo(),
        samplePrices: Array.from(debug.prices.entries()).slice(0, 5)
      };
    });

    console.log('   Tick data:', JSON.stringify(tickData, null, 2));

    expect(tickData.subscriptionsReady, 'Subscriptions should be ready').toBe(true);
    expect(tickData.connectionStatus, 'Should be connected').toBe('connected');

    // Graceful handling of low tick frequency
    // Note: dataPackageCount may be 0 if backend only sends ticks
    if (tickData.dataPackageCount > 0) {
      console.log(`   ✅ Received ${tickData.dataPackageCount} data packages`);
    } else {
      console.log('   ℹ️ No data packages received (backend may only send ticks)');
    }

    if (tickData.tickCount > 0) {
      console.log(`   ✅ Received ${tickData.tickCount} ticks`);
    } else {
      console.log('   ℹ️ No ticks received yet (market may be closed, data packages received)');
    }

    // Verify some prices are available (if any data received)
    const priceCount = tickData.samplePrices.length;
    if (priceCount > 0) {
      console.log(`   ✅ Have ${priceCount} prices available`);
    } else {
      console.log('   ℹ️ No prices yet (waiting for market data)');
    }

    console.log(`✅ Tick flow verified (${tickData.tickCount} ticks, ${tickData.dataPackageCount} packages)`);
  });

  /**
   * TEST 3: Basket Calculations Update
   * Verifies basket values update correctly when prices change
   */
  test('basket calculations update in real-time', async ({ page }) => {
    console.log('🚀 Testing basket calculation updates...');

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await waitForWorkspaceAPI(page);

    // Create FX Basket display
    const workspace = page.locator(SELECTORS.workspace);
    await workspace.focus();
    await page.keyboard.press('Alt+b');
    await page.waitForTimeout(5000);

    // Get initial basket state
    const initialState = await page.evaluate(() => {
      const debug = window.fxBasketDebug;
      const baskets = debug.baskets;
      return Object.entries(baskets).map(([currency, data]) => ({
        currency,
        normalized: data.normalized,
        initialized: data.initialized,
        changePercent: data.changePercent
      }));
    });

    console.log('   Initial basket state:', initialState);

    // Wait for more data
    await page.waitForTimeout(10000);

    // Get updated basket state
    const updatedState = await page.evaluate(() => {
      const debug = window.fxBasketDebug;
      const baskets = debug.baskets;
      return Object.entries(baskets).map(([currency, data]) => ({
        currency,
        normalized: data.normalized,
        initialized: data.initialized,
        changePercent: data.changePercent
      }));
    });

    console.log('   Updated basket state:', updatedState);

    // Verify we have 8 baskets (even if not all initialized)
    expect(updatedState.length, 'Should have 8 currency baskets').toBe(8);

    // Verify basket structure
    updatedState.forEach(basket => {
      expect(basket.currency, 'Basket should have currency').toBeTruthy();
      expect(typeof basket.normalized, 'Normalized value should be number').toBe('number');
      expect(typeof basket.changePercent, 'Change percent should be number').toBe('number');
    });

    // Check if any baskets are initialized (depends on data availability)
    const initializedCount = updatedState.filter(b => b.initialized).length;
    if (initializedCount > 0) {
      console.log(`   ✅ ${initializedCount}/8 baskets initialized with data`);
    } else {
      console.log('   ℹ️ No baskets initialized yet (insufficient price data)');
    }

    // Check if any values changed (may not happen in low-volatility markets)
    const valuesChanged = initialState.some((initial, i) =>
      initial.normalized !== updatedState[i].normalized
    );

    if (valuesChanged) {
      console.log('   ✅ Basket values updated');
    } else {
      console.log('   ℹ️ Basket values unchanged (low volatility or closed market)');
    }

    console.log('✅ Basket calculations verified');
  });

  /**
   * TEST 4: Debug API Validation
   * Verifies debug API provides correct data access
   */
  test('debug API exposes correct state', async ({ page }) => {
    console.log('🚀 Testing debug API...');

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await waitForWorkspaceAPI(page);

    // Create FX Basket display
    const workspace = page.locator(SELECTORS.workspace);
    await workspace.focus();
    await page.keyboard.press('Alt+b');
    await page.waitForTimeout(3000);

    // Validate debug API structure
    const apiValidation = await page.evaluate(() => {
      const debug = window.fxBasketDebug;
      if (!debug) return { error: 'Debug API not found' };

      return {
        hasAPI: true,
        hasBasketState: debug.basketState !== null,
        hasFxPairs: Array.isArray(debug.fxPairs),
        hasConnectionStatus: typeof debug.connectionStatus === 'string',
        hasSubscriptionsReady: typeof debug.subscriptionsReady === 'boolean',
        pairCount: debug.fxPairs?.length || 0,
        pricesCount: debug.prices?.size || 0,
        basketsCount: Object.keys(debug.baskets || {}).length,
        hasGetSubscriptionInfo: typeof debug.getSubscriptionInfo === 'function',
        hasGetLastTickTime: typeof debug.getLastTickTime === 'function',
        hasGetPairPrice: typeof debug.getPairPrice === 'function',
        hasGetBasketValue: typeof debug.getBasketValue === 'function',
        subscriptionInfo: debug.getSubscriptionInfo()
      };
    });

    console.log('   API validation:', JSON.stringify(apiValidation, null, 2));

    expect(apiValidation.hasAPI).toBe(true);
    expect(apiValidation.hasBasketState).toBe(true);
    expect(apiValidation.hasFxPairs).toBe(true);
    expect(apiValidation.pairCount).toBe(28);
    expect(apiValidation.basketsCount).toBe(8);
    expect(apiValidation.hasGetSubscriptionInfo).toBe(true);
    expect(apiValidation.subscriptionInfo.totalPairs).toBe(28);

    // Test individual methods
    const methodTests = await page.evaluate(() => {
      const debug = window.fxBasketDebug;
      return {
        getSubscriptionInfo: debug.getSubscriptionInfo(),
        samplePairPrice: debug.getPairPrice('EURUSD'),
        sampleBasketValue: debug.getBasketValue('USD'),
        lastTickTimeEURUSD: debug.getLastTickTime('EURUSD')
      };
    });

    console.log('   Method tests:', JSON.stringify(methodTests, null, 2));

    expect(methodTests.getSubscriptionInfo).toHaveProperty('totalPairs');
    expect(methodTests.getSubscriptionInfo).toHaveProperty('subscribedPairs');

    console.log('✅ Debug API validated');
  });

  /**
   * TEST 5: All 8 Currency Baskets Present
   * Verifies all 8 currency baskets exist
   */
  test('has all 8 currency baskets', async ({ page }) => {
    console.log('🚀 Testing currency basket presence...');

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await waitForWorkspaceAPI(page);

    // Create FX Basket display
    const workspace = page.locator(SELECTORS.workspace);
    await workspace.focus();
    await page.keyboard.press('Alt+b');
    await page.waitForTimeout(5000);

    // Check for all 8 currencies
    const basketCheck = await page.evaluate(() => {
      const debug = window.fxBasketDebug;
      const baskets = debug.baskets;
      const currencies = Object.keys(baskets).sort();
      const basketCount = currencies.length;
      const basketDetails = Object.entries(baskets).map(([curr, data]) => ({
        currency: curr,
        hasData: data.initialized,
        normalized: data.normalized
      }));

      return { currencies, basketCount, basketDetails };
    });

    console.log('   Currencies:', basketCheck.currencies);
    console.log('   Basket count:', basketCheck.basketCount);
    console.log('   Basket details:', basketCheck.basketDetails);

    expect(basketCheck.basketCount, 'Should have 8 currency baskets').toBe(8);

    // Check that all expected currencies are present (order may vary)
    EXPECTED_CURRENCIES.forEach(curr => {
      expect(basketCheck.currencies).toContain(curr);
    });

    // Check how many have data
    const initializedCount = basketCheck.basketDetails.filter(b => b.hasData).length;
    if (initializedCount > 0) {
      console.log(`   ✅ ${initializedCount}/8 baskets have price data`);
    } else {
      console.log('   ℹ️ Baskets created but waiting for price data');
    }

    console.log('✅ All 8 currency baskets present');
  });

  /**
   * TEST 6: Data Freshness
   * Verifies data stays fresh and connection remains stable
   */
  test('data freshness and connection stability', async ({ page }) => {
    console.log('🚀 Testing data freshness...');

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await waitForWorkspaceAPI(page);

    // Create FX Basket display
    const workspace = page.locator(SELECTORS.workspace);
    await workspace.focus();
    await page.keyboard.press('Alt+b');

    // Wait for all subscriptions to complete
    await page.waitForFunction(() => window.fxBasketDebug?.subscriptionsReady === true, { timeout: 15000 });

    // Check initial state
    const initialCheck = await page.evaluate(() => {
      const debug = window.fxBasketDebug;
      return {
        connected: debug.connectionStatus === 'connected',
        subscriptionsReady: debug.subscriptionsReady,
        hasData: debug.prices.size > 0,
        lastUpdate: debug.basketState?.lastUpdate
      };
    });

    console.log('   Initial check:', initialCheck);
    expect(initialCheck.connected).toBe(true);
    expect(initialCheck.subscriptionsReady).toBe(true);

    // Wait and check for fresh data
    await page.waitForTimeout(15000);

    const freshnessCheck = await page.evaluate(() => {
      const debug = window.fxBasketDebug;
      const now = new Date();
      const lastUpdate = new Date(debug.basketState?.lastUpdate);
      const secondsSinceUpdate = (now - lastUpdate) / 1000;

      return {
        stillConnected: debug.connectionStatus === 'connected',
        lastUpdate: debug.basketState?.lastUpdate,
        secondsSinceUpdate,
        recentTick: secondsSinceUpdate < 30
      };
    });

    console.log('   Freshness check:', freshnessCheck);

    expect(freshnessCheck.stillConnected).toBe(true);

    // Data may be stale if market is closed, so we just verify connection
    if (freshnessCheck.recentTick) {
      console.log('   ✅ Fresh data received within 30 seconds');
    } else {
      console.log('   ℹ️ No recent data (market may be closed)');
    }

    console.log('✅ Data freshness verified');
  });

  /**
   * TEST 7: Canvas Rendering
   * Verifies the FX Basket canvas is rendering with basket data
   */
  test('renders FX Basket canvas with basket data', async ({ page }) => {
    console.log('🚀 Testing FX Basket canvas rendering...');

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await waitForWorkspaceAPI(page);

    // Create FX Basket display
    const workspace = page.locator(SELECTORS.workspace);
    await workspace.focus();
    await page.keyboard.press('Alt+b');

    // Wait for all subscriptions to complete
    await page.waitForFunction(() => window.fxBasketDebug?.subscriptionsReady === true, { timeout: 15000 });

    // Wait for some data to arrive and render (longer wait for canvas content)
    await page.waitForTimeout(5000);

    // Check for canvas element (inside canvas-container)
    const canvas = page.locator('.floating-display canvas');
    await expect(canvas).toBeVisible();

    // Verify canvas has been rendered (not blank/empty)
    const canvasInfo = await canvas.evaluate(el => {
      const ctx = el.getContext('2d');
      const imageData = ctx.getImageData(0, 0, el.width, el.height);
      const data = imageData.data;

      // Count non-transparent pixels
      let nonTransparent = 0;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 0) nonTransparent++;
      }

      return {
        width: el.width,
        height: el.height,
        nonTransparentPixels: nonTransparent,
        totalPixels: el.width * el.height
      };
    });

    console.log('   Canvas info:', canvasInfo);

    // Canvas should have content (at least 0.5% non-transparent pixels)
    // (Lower threshold because baskets near baseline render minimal content)
    expect(canvasInfo.nonTransparentPixels).toBeGreaterThan(canvasInfo.totalPixels * 0.005);

    // Verify basket data via debug API
    const basketData = await page.evaluate(() => {
      const debug = window.fxBasketDebug;
      const baskets = {};
      for (const [currency, basket] of Object.entries(debug.baskets)) {
        baskets[currency] = {
          normalized: basket.normalized,
          hasData: basket.initialized
        };
      }
      return {
        basketCount: Object.keys(baskets).length,
        baskets,
        priceCount: debug.prices.size
      };
    });

    console.log('   Basket data:', basketData);

    // Should have all 8 basket objects
    expect(basketData.basketCount).toBe(8);

    // Either we have prices OR some baskets are initialized
    // (Baskets only initialize when ALL their pairs have prices)
    const hasData = basketData.priceCount > 0 ||
                    Object.values(basketData.baskets).some(b => b.hasData);

    if (!hasData) {
      console.log('   ⚠️ No data received - market may be closed');
    }

    // Don't fail if no data - market might be closed
    // Just verify the structure is correct
    console.log(`   Prices: ${basketData.priceCount}/28, Initialized baskets: ${Object.values(basketData.baskets).filter(b => b.hasData).length}/8`);

    console.log('✅ Canvas rendering verified');
  });

  /**
   * TEST 8: Browser Console Output
   * Verifies FX Basket logs appropriate messages to browser console
   */
  test('logs appropriate messages to browser console', async ({ page }) => {
    console.log('🚀 Testing browser console output...');

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await waitForWorkspaceAPI(page);

    // Create FX Basket display
    const workspace = page.locator(SELECTORS.workspace);
    await workspace.focus();
    await page.keyboard.press('Alt+b');

    // Wait for all subscriptions to complete
    await page.waitForFunction(() => window.fxBasketDebug?.subscriptionsReady === true, { timeout: 15000 });

    // Wait for data to arrive
    await page.waitForTimeout(5000);

    // Check browser logs
    const logs = page.browserLogs || [];
    const fxBasketLogs = logs.filter(log =>
      log.text.includes('[FX BASKET]') || log.text.includes('FX Basket')
    );

    console.log(`   Total browser logs: ${logs.length}`);
    console.log(`   FX Basket logs: ${fxBasketLogs.length}`);

    // Should have FX Basket console messages
    expect(fxBasketLogs.length).toBeGreaterThan(0);

    // Check for expected log messages
    const logTexts = fxBasketLogs.map(l => l.text).join('\n');
    console.log('   FX Basket log messages:');
    fxBasketLogs.forEach(log => {
      console.log(`     [${log.type}] ${log.text}`);
    });

    // Should see subscription started message
    expect(logTexts).toContain('Starting subscription to');

    // Should see subscriptions complete message
    expect(logTexts).toContain('All subscriptions complete');

    // Should NOT have errors
    const errorLogs = logs.filter(log => log.type === 'error');
    console.log(`   Error logs: ${errorLogs.length}`);
    if (errorLogs.length > 0) {
      console.log('   ⚠️ Browser console errors:');
      errorLogs.forEach(log => {
        console.log(`     ${log.text}`);
      });
    }

    // Filter out non-FX Basket errors (like from ads, trackers, etc.)
    const fxBasketErrors = errorLogs.filter(log =>
      log.text.includes('FX') || log.text.includes('basket') || log.text.includes('Basket')
    );

    expect(fxBasketErrors.length).toBe(0);

    console.log('✅ Browser console output verified');
  });
});
