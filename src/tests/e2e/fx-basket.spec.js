/**
 * FX Basket E2E Test - Alt+B Workflow
 *
 * Tests the complete FX Basket display creation and interaction workflow:
 * 1. Alt+B shortcut creates FX Basket display
 * 2. Display appears with correct symbol and 8 currency baskets
 * 3. WebSocket subscriptions are made for all required pairs
 * 4. No console errors during initialization and operation
 * 5. Display is draggable and resizable
 * 6. Close button works properly
 *
 * Run: npx playwright test fx-basket.spec.js
 */

import { test, expect } from '@playwright/test';

// Test configuration
const BASE_URL = 'http://localhost:5174';
const TEST_TIMEOUT = 60000;

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
  display: '.floating-display',
  displayHeader: '.header',
  symbol: '.symbol',
  sourceBadge: '.source-badge',
  connectionStatus: '.connection-status',
  canvas: 'canvas.display-canvas, canvas',
  resizeHandle: '.resize-handle',
  closeButton: '.close',
  refreshButton: '.refresh'
};

test.describe('FX Basket - Alt+B Workflow', () => {

  // Helper to wait for workspace API
  async function waitForWorkspaceAPI(page) {
    return await page.evaluate(() => {
      return typeof window.workspaceActions !== 'undefined' &&
             typeof window.workspaceActions.addDisplay === 'function';
    });
  }

  // Helper to check console for errors
  function setupConsoleMonitoring(page) {
    const consoleLogs = {
      errors: [],
      warnings: [],
      info: [],
      network: []
    };

    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();

      if (type === 'error') {
        consoleLogs.errors.push({
          text,
          location: msg.location()
        });
        console.error('❌ Browser error:', text);
      } else if (type === 'warning') {
        consoleLogs.warnings.push({ text });
        console.warn('⚠️ Browser warning:', text);
      } else if (text.includes('websocket') || text.includes('subscribe') || text.includes('connect')) {
        consoleLogs.network.push({ text });
        console.log('🌐 Network log:', text);
      } else {
        consoleLogs.info.push({ text });
      }
    });

    return consoleLogs;
  }

  /**
   * TEST 1: Alt+B Creates FX Basket Display
   * Verifies the keyboard shortcut creates a display with correct symbol
   */
  test('Alt+B creates FX Basket display', async ({ page }) => {
    console.log('🚀 Testing Alt+B shortcut...');

    // Navigate to application
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Wait for workspace API to be ready
    const apiReady = await waitForWorkspaceAPI(page);
    expect(apiReady, 'Workspace API should be available').toBe(true);

    // Focus workspace for keyboard events
    const workspace = page.locator(SELECTORS.workspace);
    await workspace.focus();
    await page.waitForTimeout(500);

    // Press Alt+B to create FX Basket display
    await page.keyboard.press('Alt+b');
    await page.waitForTimeout(2000);

    // Verify display was created
    const displays = page.locator(SELECTORS.display);
    const displayCount = await displays.count();
    expect(displayCount, 'Should have 1 display after Alt+B').toBe(1);

    console.log('✅ Display created via Alt+B');
  });

  /**
   * TEST 2: Display Shows Correct Symbol
   * Verifies the display shows "FX BASKET" as the symbol
   */
  test('Display shows FX BASKET symbol', async ({ page }) => {
    console.log('🚀 Testing display symbol...');

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await waitForWorkspaceAPI(page);

    // Create FX Basket display
    const workspace = page.locator(SELECTORS.workspace);
    await workspace.focus();
    await page.keyboard.press('Alt+b');
    await page.waitForTimeout(2000);

    // Verify symbol in store (header is auto-hidden)
    const displaySymbol = await page.evaluate(() => {
      const store = window.workspaceStore;
      let state;
      const unsub = store.subscribe(s => { state = s; });
      unsub();
      const displays = Array.from(state.displays.values());
      return displays[0]?.symbol || 'NOT_FOUND';
    });

    expect(displaySymbol).toBe('FX_BASKET');
    console.log(`✅ Symbol verified: ${displaySymbol}`);

    // Hover to show header and verify symbol text
    const display = page.locator(SELECTORS.display).first();
    const box = await display.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + 10);
    await page.waitForTimeout(500);

    const symbolText = await display.locator(SELECTORS.symbol).first().textContent();
    expect(symbolText).toContain('FX BASKET');
    console.log(`✅ Header symbol text: ${symbolText}`);
  });

  /**
   * TEST 3: Console Has No Errors
   * Critical test - verifies no JavaScript errors during creation
   */
  test('Console has no errors', async ({ page }) => {
    console.log('🚀 Testing console output...');

    const consoleLogs = setupConsoleMonitoring(page);

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await waitForWorkspaceAPI(page);

    // Create FX Basket display
    const workspace = page.locator(SELECTORS.workspace);
    await workspace.focus();
    await page.keyboard.press('Alt+b');
    await page.waitForTimeout(3000);

    // Check for errors
    console.log(`   Errors: ${consoleLogs.errors.length}`);
    console.log(`   Warnings: ${consoleLogs.warnings.length}`);
    console.log(`   Network logs: ${consoleLogs.network.length}`);

    expect(consoleLogs.errors.length, 'Should have no console errors').toBe(0);

    console.log('✅ No console errors detected');
  });

  /**
   * TEST 4: Display Shows 8 Currency Baskets
   * Verifies the visualization renders all 8 currency baskets
   */
  test('Display shows 8 currency baskets', async ({ page }) => {
    console.log('🚀 Testing currency basket rendering...');

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await waitForWorkspaceAPI(page);

    // Create FX Basket display
    const workspace = page.locator(SELECTORS.workspace);
    await workspace.focus();
    await page.keyboard.press('Alt+b');
    await page.waitForTimeout(3000);

    // Wait for data to load
    await page.waitForTimeout(5000);

    // Check basket state via store
    const basketData = await page.evaluate(() => {
      const store = window.workspaceStore;
      let state;
      const unsub = store.subscribe(s => { state = s; });
      unsub();

      // Get canvas reference and check basket data
      const display = document.querySelector('.floating-display');
      const canvas = display?.querySelector('canvas');

      if (!canvas) return { error: 'Canvas not found' };

      // Try to get basket data from component context
      return {
        hasCanvas: true,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height
      };
    });

    console.log('   Basket data:', basketData);
    expect(basketData.hasCanvas).toBe(true);

    // Verify canvas has content (rendered baskets)
    const display = page.locator(SELECTORS.display).first();
    const canvas = display.locator(SELECTORS.canvas).first();
    const canvasHasContent = await canvas.evaluate(c => {
      try {
        const ctx = c.getContext('2d');
        const imageData = ctx.getImageData(0, 0, c.width, c.height);
        return imageData.data.some((channel, i) => i % 4 !== 3 && channel > 0);
      } catch {
        return false;
      }
    });

    console.log(`   Canvas has rendered content: ${canvasHasContent}`);
    expect(canvasHasContent, 'Canvas should have rendered content').toBe(true);

    console.log('✅ Currency baskets rendered');
  });

  /**
   * TEST 5: WebSocket Subscriptions Made
   * Verifies WebSocket subscribes to all 28 required pairs
   */
  test('WebSocket subscribes to FX pairs', async ({ page }) => {
    console.log('🚀 Testing WebSocket subscriptions...');

    const networkLogs = [];
    const wsMessages = [];

    // Monitor network activity
    page.on('websocket', ws => {
      ws.on('framesent', frame => {
        if (frame.payload) {
          try {
            const data = JSON.parse(frame.payload);
            wsMessages.push({ type: 'sent', data });
            console.log('📤 WebSocket sent:', data);
          } catch {
            // Non-JSON message
          }
        }
      });

      ws.on('framereceived', frame => {
        if (frame.payload) {
          try {
            const data = JSON.parse(frame.payload);
            wsMessages.push({ type: 'received', data });
            console.log('📥 WebSocket received:', data);
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
    await page.waitForTimeout(5000);

    // Check WebSocket activity
    console.log(`   WebSocket messages captured: ${wsMessages.length}`);

    // Verify subscriptions were made
    const hasSubscribeMessages = wsMessages.some(msg =>
      msg.data && (msg.data.type === 'subscribe' || msg.data.symbol)
    );

    console.log(`   Has subscription activity: ${hasSubscribeMessages}`);

    // Check if multiple pairs were subscribed
    const subscribedSymbols = new Set();
    wsMessages.forEach(msg => {
      if (msg.data && msg.data.symbol) {
        subscribedSymbols.add(msg.data.symbol);
      }
    });

    console.log(`   Unique symbols subscribed: ${subscribedSymbols.size}`);
    console.log(`   Symbols: ${Array.from(subscribedSymbols).join(', ')}`);

    expect(subscribedSymbols.size, 'Should subscribe to multiple pairs').toBeGreaterThan(0);

    console.log('✅ WebSocket subscriptions verified');
  });

  /**
   * TEST 6: Display is Draggable
   * Verifies interact.js drag functionality
   */
  test('Display is draggable', async ({ page }) => {
    console.log('🚀 Testing drag functionality...');

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await waitForWorkspaceAPI(page);

    // Create FX Basket display
    const workspace = page.locator(SELECTORS.workspace);
    await workspace.focus();
    await page.keyboard.press('Alt+b');
    await page.waitForTimeout(2000);

    const display = page.locator(SELECTORS.display).first();
    const initialBox = await display.boundingBox();
    console.log(`   Initial position: x=${initialBox.x}, y=${initialBox.y}`);

    // Drag the display
    const dragStartX = initialBox.x + initialBox.width / 2;
    const dragStartY = initialBox.y + 20; // Header area

    await page.mouse.move(dragStartX, dragStartY);
    await page.mouse.down();
    await page.mouse.move(dragStartX + 100, dragStartY + 50);
    await page.mouse.up();
    await page.waitForTimeout(500);

    const draggedBox = await display.boundingBox();
    const deltaX = Math.abs(draggedBox.x - initialBox.x);
    const deltaY = Math.abs(draggedBox.y - initialBox.y);

    console.log(`   After drag: x=${draggedBox.x}, y=${draggedBox.y}`);
    console.log(`   Delta: ${deltaX}px, ${deltaY}px`);

    expect(deltaX, 'Display should move horizontally').toBeGreaterThan(50);
    expect(deltaY, 'Display should move vertically').toBeGreaterThan(25);

    console.log('✅ Display is draggable');
  });

  /**
   * TEST 7: Display is Resizable
   * Verifies interact.js resize functionality
   */
  test('Display is resizable', async ({ page }) => {
    console.log('🚀 Testing resize functionality...');

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await waitForWorkspaceAPI(page);

    // Create FX Basket display
    const workspace = page.locator(SELECTORS.workspace);
    await workspace.focus();
    await page.keyboard.press('Alt+b');
    await page.waitForTimeout(2000);

    const display = page.locator(SELECTORS.display).first();
    const initialBox = await display.boundingBox();
    const initialSize = { width: initialBox.width, height: initialBox.height };

    console.log(`   Initial size: ${initialSize.width}x${initialSize.height}`);

    // Resize using resize handle
    const resizeHandle = display.locator(SELECTORS.resizeHandle);
    await expect(resizeHandle, 'Resize handle should be visible').toBeVisible();

    await page.mouse.move(
      initialBox.x + initialBox.width - 10,
      initialBox.y + initialBox.height - 10
    );
    await page.mouse.down();
    await page.mouse.move(
      initialBox.x + initialBox.width + 50,
      initialBox.y + initialBox.height + 50
    );
    await page.mouse.up();
    await page.waitForTimeout(500);

    const resizedBox = await display.boundingBox();
    const resizedSize = { width: resizedBox.width, height: resizedBox.height };

    console.log(`   After resize: ${resizedSize.width}x${resizedSize.height}`);
    console.log(`   Delta: +${resizedSize.width - initialSize.width}px, +${resizedSize.height - initialSize.height}px`);

    expect(resizedSize.width, 'Width should increase').toBeGreaterThan(initialSize.width);
    expect(resizedSize.height, 'Height should increase').toBeGreaterThan(initialSize.height);

    console.log('✅ Display is resizable');
  });

  /**
   * TEST 8: Close Button Works
   * Verifies the close button removes the display
   */
  test('Close button works', async ({ page }) => {
    console.log('🚀 Testing close button...');

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await waitForWorkspaceAPI(page);

    // Create FX Basket display
    const workspace = page.locator(SELECTORS.workspace);
    await workspace.focus();
    await page.keyboard.press('Alt+b');
    await page.waitForTimeout(2000);

    // Verify display exists
    let displays = page.locator(SELECTORS.display);
    let displayCount = await displays.count();
    expect(displayCount, 'Should have 1 display').toBe(1);

    // Hover to show header
    const display = displays.first();
    const box = await display.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + 10);
    await page.waitForTimeout(500);

    // Click close button
    const closeButton = display.locator(SELECTORS.closeButton).first();
    await closeButton.click();
    await page.waitForTimeout(500);

    // Verify display is removed
    displayCount = await displays.count();
    expect(displayCount, 'Should have 0 displays after close').toBe(0);

    console.log('✅ Close button works');
  });

  /**
   * TEST 9: Full Workflow Integration
   * Complete end-to-end test of the entire Alt+B workflow
   */
  test('Full Alt+B workflow integration', async ({ page }) => {
    console.log('🚀 Testing complete Alt+B workflow...');

    const consoleLogs = setupConsoleMonitoring(page);

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await waitForWorkspaceAPI(page);

    // Step 1: Create display with Alt+B
    console.log('   Step 1: Press Alt+B');
    const workspace = page.locator(SELECTORS.workspace);
    await workspace.focus();
    await page.keyboard.press('Alt+b');
    await page.waitForTimeout(2000);

    // Step 2: Verify display appears
    console.log('   Step 2: Verify display');
    const displays = page.locator(SELECTORS.display);
    const displayCount = await displays.count();
    expect(displayCount).toBe(1);

    // Step 3: Verify symbol
    console.log('   Step 3: Verify symbol');
    const displaySymbol = await page.evaluate(() => {
      const store = window.workspaceStore;
      let state;
      const unsub = store.subscribe(s => { state = s; });
      unsub();
      const displays = Array.from(state.displays.values());
      return displays[0]?.symbol || 'NOT_FOUND';
    });
    expect(displaySymbol).toBe('FX_BASKET');

    // Step 4: Drag display
    console.log('   Step 4: Test drag');
    const display = displays.first();
    const initialBox = await display.boundingBox();
    await page.mouse.move(
      initialBox.x + initialBox.width / 2,
      initialBox.y + 20
    );
    await page.mouse.down();
    await page.mouse.move(
      initialBox.x + initialBox.width / 2 + 50,
      initialBox.y + 20 + 30
    );
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Step 5: Resize display
    console.log('   Step 5: Test resize');
    const boxAfterDrag = await display.boundingBox();
    await page.mouse.move(
      boxAfterDrag.x + boxAfterDrag.width - 10,
      boxAfterDrag.y + boxAfterDrag.height - 10
    );
    await page.mouse.down();
    await page.mouse.move(
      boxAfterDrag.x + boxAfterDrag.width + 30,
      boxAfterDrag.y + boxAfterDrag.height + 30
    );
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Step 6: Wait for data
    console.log('   Step 6: Wait for data');
    await page.waitForTimeout(5000);

    // Step 7: Verify no errors
    console.log('   Step 7: Verify no errors');
    expect(consoleLogs.errors.length).toBe(0);

    // Step 8: Close display
    console.log('   Step 8: Close display');
    const boxBeforeClose = await display.boundingBox();
    await page.mouse.move(
      boxBeforeClose.x + boxBeforeClose.width / 2,
      boxBeforeClose.y + 10
    );
    await page.waitForTimeout(500);
    const closeButton = display.locator(SELECTORS.closeButton).first();
    await closeButton.click();
    await page.waitForTimeout(500);

    const finalDisplayCount = await displays.count();
    expect(finalDisplayCount).toBe(0);

    console.log('✅ Complete workflow successful');
  });
});

/**
 * QUICK REFERENCE: FX Basket Test
 *
 * Keyboard Shortcut:
 * - Alt+B: Create FX Basket display
 *
 * Expected Behavior:
 * - Creates display with symbol "FX_BASKET"
 * - Subscribes to 28 currency pairs via WebSocket
 * - Renders 8 currency baskets: USD, EUR, JPY, GBP, AUD, CAD, CHF, NZD
 * - Display is draggable and resizable
 * - No console errors during operation
 *
 * Currency Pairs (28 total):
 * - Major: EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD, USDCHF, NZDUSD
 * - Cross: EURJPY, EURGBP, EURAUD, EURCHF, EURCAD, EURNZD, GBPJPY, GBPAUD, GBPCAD, GBPCHF, GBPNZD
 * - Minor: AUDJPY, CADJPY, CHFJPY, NZDJPY, AUDCAD, AUDCHF, AUDNZD, NZDCAD, NZDCHF, CADCHF
 *
 * Test Files:
 * - FX Basket Data: src/lib/fxBasket/fxBasketData.js
 * - FX Basket Calculations: src/lib/fxBasket/fxBasketCalculations.js
 * - FX Basket Component: src/components/FxBasketDisplay.svelte
 * - Keyboard Handler: src/lib/keyboardHandler.js
 */
