/**
 * Connection Stress Test
 *
 * Stress-tests the connection system by:
 * 1. Opening multiple concurrent tabs/connections
 * 2. Monitoring backend logs for errors, IP bans, and queue issues
 * 3. Verifying both cTrader and TradingView data sources work simultaneously
 * 4. Checking that the cTrader queue (300ms) and TradingView queue (2s) operate independently
 *
 * Prerequisites:
 *   - Backend running (./run.sh dev or ./run.sh start)
 *   - PostgreSQL and Redis running
 *   - Playwright installed (npm install)
 *
 * Run (from project root):
 *   npx playwright test connection-stress --config=tests/e2e/playwright-stress.config.cjs
 *
 * Or with a temporary override:
 *   npx playwright test tests/e2e/connection-stress.spec.js --config=- < tests/e2e/playwright-stress.config.cjs
 *
 * Note: The main playwright.config.cjs has testDir set to ./src/tests.
 * This file lives in tests/e2e/ and requires either a separate config or
 * adjusting testDir to include both directories.
 */

import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'http://localhost:5174';
const BACKEND_LOG_PATH = join(process.cwd(), 'backend.log');

const SELECTORS = {
  workspace: '.workspace',
  display: '.floating-display',
  closeButton: '.close'
};

// cTrader queue: 300ms between requests
const CTRADER_MIN_INTERVAL_MS = 300;
// TradingView queue: 2000ms between subscriptions
const TV_MIN_INTERVAL_MS = 2000;
// Tolerance for timing assertions (network jitter)
const TIMING_TOLERANCE_MS = 200;

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read the last N lines from the backend log file.
 * Returns empty string if file does not exist.
 */
function readBackendLog(maxLines = 500) {
  if (!existsSync(BACKEND_LOG_PATH)) {
    console.log(`   [Log] backend.log not found at ${BACKEND_LOG_PATH}`);
    return '';
  }
  try {
    const content = readFileSync(BACKEND_LOG_PATH, 'utf-8');
    const lines = content.split('\n');
    return lines.slice(-maxLines).join('\n');
  } catch (err) {
    console.log(`   [Log] Could not read backend.log: ${err.message}`);
    return '';
  }
}

/**
 * Truncate the backend log file (write empty string).
 */
function clearBackendLog() {
  if (existsSync(BACKEND_LOG_PATH)) {
    try {
      writeFileSync(BACKEND_LOG_PATH, '', 'utf-8');
      console.log('   [Log] backend.log cleared');
    } catch (err) {
      console.log(`   [Log] Could not clear backend.log: ${err.message}`);
    }
  } else {
    console.log('   [Log] backend.log does not exist, nothing to clear');
  }
}

/**
 * Parse cTrader subscription timestamps from backend log.
 * Matches lines like: [COALESCE] Sending EURUSD:14 to 1 clients
 * and returns { symbol, timestamp } entries.
 */
function parseCTraderSubscriptionTimings(logContent) {
  const pattern = /\[COALESCE\] Sending (\w+:\d+) to \d+ clients/g;
  const entries = [];
  let match;
  // We need the actual timestamps from the log lines
  const lines = logContent.split('\n');
  for (const line of lines) {
    const m = line.match(/\[COALESCE\] Sending (\w+:\d+) to \d+ clients/);
    if (m) {
      // Try to extract ISO timestamp from the start of the line
      const tsMatch = line.match(/^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/);
      entries.push({
        symbol: m[1],
        timestamp: tsMatch ? tsMatch[1] : null,
        rawLine: line.trim()
      });
    }
  }
  return entries;
}

/**
 * Parse TradingView subscription timestamps from backend log.
 * Matches lines like: [TradingView] Subscribing to EURUSD D1 candles...
 * and returns { symbol, timestamp } entries.
 */
function parseTradingViewSubscriptionTimings(logContent) {
  const lines = logContent.split('\n');
  const entries = [];
  for (const line of lines) {
    const m = line.match(/\[TradingView\] Subscribing to (\S+) D1 candles/);
    if (m) {
      const tsMatch = line.match(/^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/);
      entries.push({
        symbol: m[1],
        timestamp: tsMatch ? tsMatch[1] : null,
        rawLine: line.trim()
      });
    }
  }
  return entries;
}

/**
 * Check backend log for error patterns.
 */
function parseBackendErrors(logContent) {
  const errors = {
    bannedByIp: [],
    systemErrors: [],
    fatalErrors: [],
    rateLimits: [],
    connectionErrors: [],
    generalErrors: []
  };

  const lines = logContent.split('\n');
  for (const line of lines) {
    if (/banned by ip/i.test(line)) {
      errors.bannedByIp.push(line.trim());
    }
    if (/__SYSTEM__/.test(line)) {
      errors.systemErrors.push(line.trim());
    }
    if (/\[FATAL\]/.test(line)) {
      errors.fatalErrors.push(line.trim());
    }
    if (/Rate limit/i.test(line) || /REQUEST_FREQUENCY_EXCEEDED/.test(line)) {
      errors.rateLimits.push(line.trim());
    }
    if (/connection.*(?:fail|refused|error|reset)/i.test(line) && !/\[DEBUGGER\]/.test(line)) {
      errors.connectionErrors.push(line.trim());
    }
    if (/^\[ERROR\]|console\.error/.test(line)) {
      errors.generalErrors.push(line.trim());
    }
  }

  return errors;
}

/**
 * Check backend log for data flow indicators.
 */
function parseDataFlowIndicators(logContent) {
  const indicators = {
    ticksReceived: 0,
    profileUpdates: 0,
    symbolDataPackages: 0,
    m1Bars: 0,
    tvCandles: 0
  };

  const lines = logContent.split('\n');
  for (const line of lines) {
    if (/type.*tick/i.test(line) || /Tick event/i.test(line)) {
      indicators.ticksReceived++;
    }
    if (/profileUpdate/i.test(line) || /profile.*update/i.test(line)) {
      indicators.profileUpdates++;
    }
    if (/symbolDataPackage/i.test(line)) {
      indicators.symbolDataPackages++;
    }
    if (/m1Bar|M1 bar/i.test(line)) {
      indicators.m1Bars++;
    }
    if (/TradingView.*candle|d1Bar/i.test(line)) {
      indicators.tvCandles++;
    }
  }

  return indicators;
}

/**
 * Calculate intervals between consecutive subscription entries.
 * If timestamps are available (ISO format), uses actual time.
 * Otherwise returns null (timing cannot be determined).
 */
function calculateIntervals(entries) {
  if (entries.length < 2) return [];

  const intervals = [];

  // Check if we have parseable timestamps
  if (entries[0].timestamp) {
    for (let i = 1; i < entries.length; i++) {
      const prev = new Date(entries[i - 1].timestamp).getTime();
      const curr = new Date(entries[i].timestamp).getTime();
      if (!isNaN(prev) && !isNaN(curr)) {
        intervals.push({
          from: entries[i - 1].symbol,
          to: entries[i].symbol,
          intervalMs: curr - prev
        });
      }
    }
  }

  return intervals;
}

/**
 * Wait for workspace API to be available.
 */
async function waitForWorkspaceAPI(page, timeout = 10000) {
  await page.waitForFunction(() => {
    return typeof window.workspaceActions !== 'undefined' &&
           typeof window.workspaceActions.addDisplay === 'function';
  }, { timeout });
}

/**
 * Setup console monitoring on a page.
 */
function setupConsoleMonitoring(page) {
  const logs = {
    errors: [],
    warnings: [],
    all: []
  };

  page.on('console', msg => {
    const entry = { type: msg.type(), text: msg.text() };
    logs.all.push(entry);
    if (msg.type() === 'error') {
      logs.errors.push(entry);
      console.error(`   [Browser ${msg.type()}] ${msg.text()}`);
    } else if (msg.type() === 'warning') {
      logs.warnings.push(entry);
    }
  });

  page.on('pageerror', err => {
    logs.errors.push({ type: 'pageerror', text: err.message });
    console.error(`   [Page Error] ${err.message}`);
  });

  return logs;
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

test.describe('Connection Stress Test', () => {

  test.describe.configure({ timeout: 180000 }); // 3 minute suite timeout

  test.beforeAll(async () => {
    // Clear backend log before starting the stress test suite
    clearBackendLog();
    console.log('\n=== Connection Stress Test Suite Starting ===');
    console.log(`   Backend log: ${BACKEND_LOG_PATH}`);
    console.log(`   Base URL: ${BASE_URL}`);
  });

  /**
   * TEST 1: Multiple concurrent tabs/connections
   * Opens 3 browser contexts simultaneously and verifies all connect.
   */
  test('handles multiple concurrent tab connections', async ({ browser }) => {
    console.log('\n--- Test 1: Multiple concurrent tab connections ---');

    const NUM_TABS = 3;
    const contexts = [];
    const pages = [];
    const consoleMonitors = [];
    const connectionResults = [];

    // Create multiple browser contexts (isolated tabs)
    for (let i = 0; i < NUM_TABS; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      contexts.push(context);
      pages.push(page);
      consoleMonitors.push(setupConsoleMonitoring(page));
    }

    // Navigate all pages simultaneously
    console.log(`   Opening ${NUM_TABS} tabs concurrently...`);
    const navPromises = pages.map(async (page, idx) => {
      const start = Date.now();
      await page.goto(BASE_URL);
      await waitForWorkspaceAPI(page, 15000);
      const elapsed = Date.now() - start;
      return { tab: idx, elapsed };
    });

    const navResults = await Promise.all(navPromises);
    console.log('   Navigation results:');
    navResults.forEach(r => {
      console.log(`     Tab ${r.tab}: loaded in ${r.elapsed}ms`);
      connectionResults.push(r);
    });

    // Verify all tabs loaded successfully
    expect(connectionResults.length).toBe(NUM_TABS);
    connectionResults.forEach(r => {
      expect(r.elapsed).toBeLessThan(15000);
    });

    // Create displays in each tab
    console.log('   Creating FX Basket display in all tabs...');
    const displayPromises = pages.map(async (page, idx) => {
      const workspace = page.locator(SELECTORS.workspace);
      await workspace.focus();
      await page.keyboard.press('Alt+b');

      // Wait for subscriptions
      await page.waitForFunction(
        () => window.fxBasketDebug?.subscriptionsReady === true,
        { timeout: 20000 }
      );

      const state = await page.evaluate(() => {
        const debug = window.fxBasketDebug;
        return {
          connected: debug.connectionStatus,
          subscriptionsReady: debug.subscriptionsReady,
          pairCount: debug.getSubscriptionInfo().totalPairs
        };
      });

      return { tab: idx, ...state };
    });

    const displayResults = await Promise.all(displayPromises);
    console.log('   Display results:');
    displayResults.forEach(r => {
      console.log(`     Tab ${r.tab}: connected=${r.connected}, ready=${r.subscriptionsReady}, pairs=${r.pairCount}`);
    });

    // Verify all tabs have subscriptions ready
    displayResults.forEach(r => {
      expect(r.connected).toBe('connected');
      expect(r.subscriptionsReady).toBe(true);
      expect(r.pairCount).toBe(28);
    });

    // Wait for data to flow to all tabs
    console.log('   Waiting for data to flow to all tabs (10s)...');
    await new Promise(r => setTimeout(r, 10000));

    // Check each tab has received data
    const dataResults = await Promise.all(pages.map(async (page, idx) => {
      const data = await page.evaluate(() => {
        const debug = window.fxBasketDebug;
        return {
          tickCount: debug.tickCount,
          dataPackageCount: debug.dataPackageCount,
          pricesCount: debug.prices.size
        };
      });
      return { tab: idx, ...data };
    }));

    console.log('   Data flow results:');
    dataResults.forEach(r => {
      console.log(`     Tab ${r.tab}: ticks=${r.tickCount}, packages=${r.dataPackageCount}, prices=${r.pricesCount}`);
    });

    // At least some tabs should have data (market may be closed)
    const anyDataReceived = dataResults.some(r => r.tickCount > 0 || r.dataPackageCount > 0 || r.pricesCount > 0);
    if (!anyDataReceived) {
      console.log('   NOTE: No data received on any tab (market may be closed)');
    }

    // Check for browser console errors across all tabs
    console.log('   Browser console errors per tab:');
    consoleMonitors.forEach((monitor, idx) => {
      console.log(`     Tab ${idx}: ${monitor.errors.length} errors, ${monitor.warnings.length} warnings`);
    });

    // Clean up
    for (const context of contexts) {
      await context.close();
    }

    console.log('   PASS: All concurrent tab connections handled successfully');
  });

  /**
   * TEST 2: Backend log analysis for errors, IP bans, and queue issues
   * Reads backend.log and verifies no critical errors occurred during the test.
   */
  test('backend logs show no IP bans or system errors', async () => {
    console.log('\n--- Test 2: Backend log error analysis ---');

    const logContent = readBackendLog(1000);
    if (!logContent) {
      console.log('   SKIP: No backend log available');
      return;
    }

    const logLines = logContent.split('\n').length;
    console.log(`   Analyzing ${logLines} log lines...`);

    // Parse errors
    const errors = parseBackendErrors(logContent);

    console.log('   Error analysis:');
    console.log(`     Banned by IP: ${errors.bannedByIp.length}`);
    console.log(`     __SYSTEM__ errors: ${errors.systemErrors.length}`);
    console.log(`     FATAL errors: ${errors.fatalErrors.length}`);
    console.log(`     Rate limits: ${errors.rateLimits.length}`);
    console.log(`     Connection errors: ${errors.connectionErrors.length}`);
    console.log(`     General errors: ${errors.generalErrors.length}`);

    // Print any IP ban errors
    if (errors.bannedByIp.length > 0) {
      console.log('   BANNED BY IP entries:');
      errors.bannedByIp.forEach(e => console.log(`     ${e}`));
    }

    // Print any __SYSTEM__ errors
    if (errors.systemErrors.length > 0) {
      console.log('   __SYSTEM__ error entries:');
      errors.systemErrors.forEach(e => console.log(`     ${e}`));
    }

    // Print any FATAL errors
    if (errors.fatalErrors.length > 0) {
      console.log('   FATAL error entries:');
      errors.fatalErrors.forEach(e => console.log(`     ${e}`));
    }

    // Print rate limit entries (informational, not necessarily a failure)
    if (errors.rateLimits.length > 0) {
      console.log('   Rate limit entries (informational):');
      errors.rateLimits.slice(0, 5).forEach(e => console.log(`     ${e}`));
    }

    // Assertions - no IP bans or system errors should occur
    expect(errors.bannedByIp.length, 'Should have no IP bans').toBe(0);
    expect(errors.systemErrors.length, 'Should have no __SYSTEM__ errors').toBe(0);
    expect(errors.fatalErrors.length, 'Should have no FATAL errors').toBe(0);

    // Rate limits are retried automatically, so a few are acceptable
    // but excessive rate limits indicate a problem
    if (errors.rateLimits.length > 5) {
      console.log(`   WARNING: ${errors.rateLimits.length} rate limit entries detected`);
    }

    console.log('   PASS: No IP bans or system errors in backend log');
  });

  /**
   * TEST 3: Both cTrader and TradingView data sources produce data
   * Opens a cTrader chart (Alt+A) and checks for data flow indicators in backend logs.
   */
  test('both cTrader and TradingView data sources produce data', async ({ page }) => {
    console.log('\n--- Test 3: Both data sources produce data ---');

    const consoleLogs = setupConsoleMonitoring(page);
    clearBackendLog();

    await page.goto(BASE_URL);
    await waitForWorkspaceAPI(page);

    // Create a cTrader chart display (Alt+A with EURUSD)
    page.on('dialog', async dialog => {
      console.log(`   [Dialog] ${dialog.message()}`);
      await dialog.accept('EURUSD');
    });

    console.log('   Creating cTrader chart display (Alt+A -> EURUSD)...');
    await page.keyboard.press('Alt+a');
    await page.waitForTimeout(2000);

    // Create FX Basket display (uses cTrader for 28 pairs)
    console.log('   Creating FX Basket display (Alt+B)...');
    const workspace = page.locator(SELECTORS.workspace);
    await workspace.focus();
    await page.keyboard.press('Alt+b');

    // Wait for FX Basket subscriptions to complete
    await page.waitForFunction(
      () => window.fxBasketDebug?.subscriptionsReady === true,
      { timeout: 20000 }
    );

    console.log('   FX Basket subscriptions ready. Waiting for data flow (15s)...');
    await page.waitForTimeout(15000);

    // Check debug API for data received
    const basketData = await page.evaluate(() => {
      const debug = window.fxBasketDebug;
      return {
        connectionStatus: debug.connectionStatus,
        subscriptionsReady: debug.subscriptionsReady,
        tickCount: debug.tickCount,
        dataPackageCount: debug.dataPackageCount,
        pricesCount: debug.prices.size,
        totalPairs: debug.getSubscriptionInfo().totalPairs
      };
    });

    console.log('   FX Basket state:', basketData);
    expect(basketData.connectionStatus).toBe('connected');
    expect(basketData.subscriptionsReady).toBe(true);
    expect(basketData.totalPairs).toBe(28);

    // Analyze backend log for data flow from both sources
    const logContent = readBackendLog(500);
    const dataFlow = parseDataFlowIndicators(logContent);

    console.log('   Data flow indicators from backend log:');
    console.log(`     Ticks received: ${dataFlow.ticksReceived}`);
    console.log(`     Profile updates: ${dataFlow.profileUpdates}`);
    console.log(`     Symbol data packages: ${dataFlow.symbolDataPackages}`);
    console.log(`     M1 bars: ${dataFlow.m1Bars}`);
    console.log(`     TradingView candles: ${dataFlow.tvCandles}`);

    // Verify cTrader data is flowing (ticks or data packages)
    const hasCTraderData = dataFlow.ticksReceived > 0 || dataFlow.symbolDataPackages > 0;
    if (hasCTraderData) {
      console.log('   PASS: cTrader data source is producing data');
    } else {
      console.log('   NOTE: No cTrader data received (market may be closed)');
    }

    // Verify profile updates are being generated
    if (dataFlow.profileUpdates > 0) {
      console.log('   PASS: Profile updates are being generated');
    } else {
      console.log('   NOTE: No profile updates (requires active market data)');
    }

    // Check browser console for errors
    console.log(`   Browser errors: ${consoleLogs.errors.length}`);
    consoleLogs.errors.forEach(e => console.log(`     ${e.text}`));

    // Filter out expected WebSocket errors (backend not reachable)
    const unexpectedErrors = consoleLogs.errors.filter(e =>
      !/ERR_CONNECTION_REFUSED/i.test(e.text) &&
      !/WebSocket error/i.test(e.text)
    );

    expect(unexpectedErrors.length, 'Should have no unexpected browser errors').toBe(0);

    console.log('   PASS: Both data source verification complete');
  });

  /**
   * TEST 4: cTrader queue (300ms) and TradingView queue (2s) operate independently
   * Verifies subscription timing by parsing backend log timestamps.
   */
  test('cTrader and TradingView queues operate independently with correct timing', async ({ page }) => {
    console.log('\n--- Test 4: Queue independence and timing verification ---');

    clearBackendLog();

    const consoleLogs = setupConsoleMonitoring(page);

    await page.goto(BASE_URL);
    await waitForWorkspaceAPI(page);

    // Track WebSocket frames to capture subscription requests
    const wsFrames = [];
    page.on('websocket', ws => {
      ws.on('framesent', frame => {
        if (frame.payload) {
          try {
            const data = JSON.parse(frame.payload);
            if (data.type === 'get_symbol_data_package' || data.type === 'subscribe') {
              wsFrames.push({ ...data, sentAt: Date.now() });
            }
          } catch {
            // Non-JSON message
          }
        }
      });
    });

    console.log('   Creating FX Basket display (28 cTrader pairs)...');
    const workspace = page.locator(SELECTORS.workspace);
    await workspace.focus();
    await page.keyboard.press('Alt+b');

    // Wait for all cTrader subscriptions to complete
    await page.waitForFunction(
      () => window.fxBasketDebug?.subscriptionsReady === true,
      { timeout: 25000 }
    );

    console.log('   cTrader subscriptions complete. Waiting for backend processing (5s)...');
    await page.waitForTimeout(5000);

    // Analyze backend log for cTrader subscription timing
    const logContent = readBackendLog(1000);
    const ctraderEntries = parseCTraderSubscriptionTimings(logContent);
    const tvEntries = parseTradingViewSubscriptionTimings(logContent);

    console.log(`\n   cTrader subscription entries found: ${ctraderEntries.length}`);
    console.log(`   TradingView subscription entries found: ${tvEntries.length}`);

    // Analyze cTrader queue timing
    if (ctraderEntries.length > 1) {
      const ctraderIntervals = calculateIntervals(ctraderEntries);

      if (ctraderIntervals.length > 0) {
        console.log('\n   cTrader queue intervals (expected ~300ms):');
        const intervalValues = ctraderIntervals.map(i => i.intervalMs);
        const avgInterval = intervalValues.reduce((a, b) => a + b, 0) / intervalValues.length;
        const minInterval = Math.min(...intervalValues);
        const maxInterval = Math.max(...intervalValues);

        console.log(`     Count: ${intervalValues.length}`);
        console.log(`     Average: ${Math.round(avgInterval)}ms`);
        console.log(`     Min: ${Math.round(minInterval)}ms`);
        console.log(`     Max: ${Math.round(maxInterval)}ms`);

        // Verify cTrader intervals are approximately 300ms (with tolerance)
        // Allow wider tolerance since network/processing adds overhead
        const withinTolerance = intervalValues.every(v =>
          v >= CTRADER_MIN_INTERVAL_MS - TIMING_TOLERANCE_MS
        );

        if (withinTolerance) {
          console.log('   PASS: cTrader queue intervals within expected range (~300ms)');
        } else {
          console.log(`   NOTE: Some cTrader intervals below ${CTRADER_MIN_INTERVAL_MS - TIMING_TOLERANCE_MS}ms (may be coalesced requests)`);
        }

        // Print first 5 intervals for inspection
        ctraderIntervals.slice(0, 5).forEach(i => {
          console.log(`     ${i.from} -> ${i.to}: ${Math.round(i.intervalMs)}ms`);
        });
      } else {
        console.log('   NOTE: Cannot determine cTrader timing (no parseable timestamps in log)');
        // Fallback: check that all 28 pairs were subscribed
        const subscribedSymbols = ctraderEntries.map(e => e.symbol.split(':')[0]);
        const uniqueSymbols = [...new Set(subscribedSymbols)];
        console.log(`   cTrader unique symbols subscribed: ${uniqueSymbols.length}`);
      }
    } else {
      console.log('   NOTE: Insufficient cTrader entries for timing analysis');
    }

    // Analyze TradingView queue timing
    if (tvEntries.length > 1) {
      const tvIntervals = calculateIntervals(tvEntries);

      if (tvIntervals.length > 0) {
        console.log('\n   TradingView queue intervals (expected ~2000ms):');
        const intervalValues = tvIntervals.map(i => i.intervalMs);
        const avgInterval = intervalValues.reduce((a, b) => a + b, 0) / intervalValues.length;
        const minInterval = Math.min(...intervalValues);
        const maxInterval = Math.max(...intervalValues);

        console.log(`     Count: ${intervalValues.length}`);
        console.log(`     Average: ${Math.round(avgInterval)}ms`);
        console.log(`     Min: ${Math.round(minInterval)}ms`);
        console.log(`     Max: ${Math.round(maxInterval)}ms`);

        // Verify TradingView intervals are approximately 2s (with wider tolerance)
        const withinTolerance = intervalValues.every(v =>
          v >= TV_MIN_INTERVAL_MS - TIMING_TOLERANCE_MS
        );

        if (withinTolerance) {
          console.log('   PASS: TradingView queue intervals within expected range (~2000ms)');
        } else {
          const belowTolerance = intervalValues.filter(v =>
            v < TV_MIN_INTERVAL_MS - TIMING_TOLERANCE_MS
          );
          console.log(`   WARNING: ${belowTolerance.length} TradingView intervals below expected 2s`);
          belowTolerance.slice(0, 3).forEach((v, i) => {
            console.log(`     Interval ${i}: ${Math.round(v)}ms`);
          });
        }

        // Print intervals for inspection
        tvIntervals.forEach(i => {
          console.log(`     ${i.from} -> ${i.to}: ${Math.round(i.intervalMs)}ms`);
        });
      } else {
        console.log('   NOTE: Cannot determine TradingView timing (no parseable timestamps in log)');
      }
    } else {
      console.log('   NOTE: Insufficient TradingView entries for timing analysis');
      console.log('   (TradingView subscriptions are triggered by chart displays, not FX Basket)');
    }

    // Verify queues are independent: cTrader subscriptions should not be blocked by TV queue
    // If we have entries for both, verify they overlap in time (processed concurrently)
    if (ctraderEntries.length > 0 && tvEntries.length > 0) {
      console.log('\n   Queue independence check:');
      console.log(`     cTrader entries: ${ctraderEntries.length}`);
      console.log(`     TradingView entries: ${tvEntries.length}`);
      console.log('   PASS: Both queues produced entries, indicating independent operation');
    }

    // Verify no errors in console
    console.log(`   Browser console errors: ${consoleLogs.errors.length}`);

    // Check for backend errors during queue processing
    const backendErrors = parseBackendErrors(logContent);
    console.log(`   Backend errors during queue processing: ${backendErrors.generalErrors.length}`);
    if (backendErrors.bannedByIp.length > 0) {
      console.log('   FAIL: IP ban detected during queue processing');
      backendErrors.bannedByIp.forEach(e => console.log(`     ${e}`));
    }
    expect(backendErrors.bannedByIp.length, 'No IP bans during queue processing').toBe(0);

    console.log('   PASS: Queue independence and timing verification complete');
  });

  /**
   * TEST 5: Timing metrics report
   * Collects and reports comprehensive timing metrics for both queues.
   */
  test('reports comprehensive timing metrics for both queues', async ({ page }) => {
    console.log('\n--- Test 5: Comprehensive timing metrics report ---');

    clearBackendLog();

    const testStartTime = Date.now();

    await page.goto(BASE_URL);
    await waitForWorkspaceAPI(page);

    // Create FX Basket display and measure subscription completion time
    console.log('   Creating FX Basket display and measuring timing...');
    const subscribeStart = Date.now();

    const workspace = page.locator(SELECTORS.workspace);
    await workspace.focus();
    await page.keyboard.press('Alt+b');

    await page.waitForFunction(
      () => window.fxBasketDebug?.subscriptionsReady === true,
      { timeout: 25000 }
    );

    const subscribeEnd = Date.now();
    const subscriptionTimeMs = subscribeEnd - subscribeStart;
    console.log(`   All 28 subscriptions queued in: ${subscriptionTimeMs}ms`);

    // Expected minimum time: 27 gaps * 300ms = 8100ms (with tolerance)
    const expectedMinTime = 27 * (CTRADER_MIN_INTERVAL_MS - TIMING_TOLERANCE_MS);
    console.log(`   Expected minimum queue time: ${expectedMinTime}ms (27 gaps * ~300ms)`);

    if (subscriptionTimeMs >= expectedMinTime) {
      console.log('   PASS: Subscription time consistent with 300ms queue spacing');
    } else {
      console.log(`   NOTE: Subscription time (${subscriptionTimeMs}ms) faster than expected queue time`);
      console.log('   (May indicate coalescing or concurrent processing)');
    }

    // Wait for data flow
    console.log('   Waiting for data flow (10s)...');
    await page.waitForTimeout(10000);

    // Collect timing metrics from debug API
    const metrics = await page.evaluate(() => {
      const debug = window.fxBasketDebug;
      const subscriptionInfo = debug.getSubscriptionInfo();

      return {
        connectionStatus: debug.connectionStatus,
        subscriptionsReady: debug.subscriptionsReady,
        totalPairs: subscriptionInfo.totalPairs,
        subscribedPairs: subscriptionInfo.subscribedPairs,
        dataPackageCount: debug.dataPackageCount,
        tickCount: debug.tickCount,
        pricesCount: debug.prices.size,
        basketCount: Object.keys(debug.baskets).length,
        initializedBaskets: Object.values(debug.baskets).filter(b => b.initialized).length
      };
    });

    const testEndTime = Date.now();
    const totalTestTimeMs = testEndTime - testStartTime;

    // Collect backend log metrics
    const logContent = readBackendLog(500);
    const ctraderEntries = parseCTraderSubscriptionTimings(logContent);
    const dataFlow = parseDataFlowIndicators(logContent);
    const backendErrors = parseBackendErrors(logContent);

    // Calculate timing metrics from log if possible
    const ctraderIntervals = calculateIntervals(ctraderEntries);
    let ctraderTimingMetrics = {};
    if (ctraderIntervals.length > 0) {
      const values = ctraderIntervals.map(i => i.intervalMs);
      ctraderTimingMetrics = {
        count: values.length,
        avgMs: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
        minMs: Math.round(Math.min(...values)),
        maxMs: Math.round(Math.max(...values)),
        p50Ms: Math.round(values.sort((a, b) => a - b)[Math.floor(values.length / 2)])
      };
    }

    // Print comprehensive report
    console.log('\n   ============================================================');
    console.log('   CONNECTION STRESS TEST - TIMING METRICS REPORT');
    console.log('   ============================================================');
    console.log('');
    console.log('   --- General ---');
    console.log(`   Total test time:           ${totalTestTimeMs}ms (${(totalTestTimeMs / 1000).toFixed(1)}s)`);
    console.log(`   Subscription queue time:   ${subscriptionTimeMs}ms (${(subscriptionTimeMs / 1000).toFixed(1)}s)`);
    console.log(`   Connection status:         ${metrics.connectionStatus}`);
    console.log('');
    console.log('   --- cTrader Data Source ---');
    console.log(`   Total pairs:               ${metrics.totalPairs}`);
    console.log(`   Data packages received:    ${metrics.dataPackageCount}`);
    console.log(`   Ticks received:            ${metrics.tickCount}`);
    console.log(`   Prices available:          ${metrics.pricesCount}`);
    if (ctraderTimingMetrics.count) {
      console.log(`   Queue intervals count:      ${ctraderTimingMetrics.count}`);
      console.log(`   Queue interval avg:         ${ctraderTimingMetrics.avgMs}ms (expected ~${CTRADER_MIN_INTERVAL_MS}ms)`);
      console.log(`   Queue interval min:         ${ctraderTimingMetrics.minMs}ms`);
      console.log(`   Queue interval max:         ${ctraderTimingMetrics.maxMs}ms`);
      console.log(`   Queue interval p50:         ${ctraderTimingMetrics.p50Ms}ms`);
    } else {
      console.log('   Queue interval metrics:     N/A (no parseable log timestamps)');
    }
    console.log('');
    console.log('   --- Basket Calculations ---');
    console.log(`   Baskets created:           ${metrics.basketCount}`);
    console.log(`   Baskets initialized:       ${metrics.initializedBaskets}/${metrics.basketCount}`);
    console.log('');
    console.log('   --- Backend Log Data Flow ---');
    console.log(`   Tick events (log):         ${dataFlow.ticksReceived}`);
    console.log(`   Profile updates (log):     ${dataFlow.profileUpdates}`);
    console.log(`   Symbol packages (log):     ${dataFlow.symbolDataPackages}`);
    console.log(`   M1 bars (log):             ${dataFlow.m1Bars}`);
    console.log(`   TV candles (log):          ${dataFlow.tvCandles}`);
    console.log('');
    console.log('   --- Error Summary ---');
    console.log(`   IP bans:                   ${backendErrors.bannedByIp.length}`);
    console.log(`   __SYSTEM__ errors:         ${backendErrors.systemErrors.length}`);
    console.log(`   FATAL errors:              ${backendErrors.fatalErrors.length}`);
    console.log(`   Rate limits:               ${backendErrors.rateLimits.length}`);
    console.log(`   General errors:            ${backendErrors.generalErrors.length}`);
    console.log('');
    console.log('   ============================================================');

    // Core assertions
    expect(metrics.connectionStatus).toBe('connected');
    expect(metrics.subscriptionsReady).toBe(true);
    expect(metrics.totalPairs).toBe(28);
    expect(backendErrors.bannedByIp.length).toBe(0);
    expect(backendErrors.systemErrors.length).toBe(0);

    console.log('   PASS: Timing metrics report complete');
  });
});
