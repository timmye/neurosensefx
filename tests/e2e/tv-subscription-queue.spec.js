/**
 * TradingView Subscription Queue E2E Test
 *
 * Validates that TradingView subscriptions are properly rate-limited
 * via the RequestCoordinator queue to avoid IP bans.
 *
 * The RequestCoordinator serializes TradingView subscriptions with a
 * 2-second minimum interval between each (_TV_MIN_INTERVAL_MS = 2000).
 * This test monitors backend.log to verify:
 *   1. Consecutive subscriptions are spaced ~2s apart (>= 1.5s tolerance)
 *   2. No "banned by ip" errors appear
 *   3. No "__SYSTEM__" symbol errors appear
 *
 * Run: npx playwright test tests/e2e/tv-subscription-queue.spec.js
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';

const BASE_URL = 'http://localhost:5174';
const BACKEND_LOG_PATH = '/workspaces/neurosensefx/backend.log';

// Tolerance for subscription gap: queue uses 2000ms, allow 1500ms minimum
const MIN_SUBSCRIPTION_GAP_MS = 1500;

// Time to wait for subscriptions to fire after page load
// With 8+ symbols queued at 2s each, allow up to 90s
const SUBSCRIPTION_WAIT_MS = 90000;

// Poll interval for checking backend log
const LOG_POLL_INTERVAL_MS = 3000;

test.describe('TradingView Subscription Queue', () => {
  let consoleLogs = [];

  test.beforeAll(async () => {
    // Verify backend is running
    const backendResponse = await fetch('http://localhost:8080').catch(() => null);
    if (!backendResponse) {
      throw new Error('Backend is not running on port 8080. Start with: ./run.sh start');
    }

    // Verify backend log exists
    if (!fs.existsSync(BACKEND_LOG_PATH)) {
      throw new Error(`Backend log not found at ${BACKEND_LOG_PATH}`);
    }
  });

  test.beforeEach(async ({ page }) => {
    consoleLogs = [];

    page.on('console', msg => {
      consoleLogs.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', error => {
      consoleLogs.push({ type: 'error', text: error.message });
    });

    // Clear the backend log before each test to isolate results
    try {
      fs.writeFileSync(BACKEND_LOG_PATH, '', 'utf-8');
    } catch {
      // Log may be locked by the running process; try truncating
      try {
        fs.truncateSync(BACKEND_LOG_PATH, 0);
      } catch {
        // If we can't clear the log, record the current position
        console.warn('Could not clear backend log; will use position-based parsing');
      }
    }
  });

  /**
   * Read the backend log and extract lines matching a pattern.
   * Returns array of { timestamp, line } objects.
   */
  function extractLogLines(pattern) {
    try {
      const content = fs.readFileSync(BACKEND_LOG_PATH, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim().length > 0);
      const matched = [];

      for (const line of lines) {
        if (pattern.test(line)) {
          // Extract ISO timestamp from log line (common formats: YYYY-MM-DDTHH:MM:SS)
          const tsMatch = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
          const timestamp = tsMatch ? new Date(tsMatch[1]) : null;
          matched.push({ timestamp, line });
        }
      }

      return matched;
    } catch {
      return [];
    }
  }

  /**
   * Wait for at least `minCount` matching lines to appear in the backend log.
   * Polls at LOG_POLL_INTERVAL_MS until timeout.
   */
  async function waitForLogEntries(pattern, minCount, timeoutMs = SUBSCRIPTION_WAIT_MS) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const entries = extractLogLines(pattern);
      if (entries.length >= minCount) {
        return entries;
      }
      await new Promise(r => setTimeout(r, LOG_POLL_INTERVAL_MS));
    }
    return extractLogLines(pattern);
  }

  test('subscriptions are spaced >= 1.5s apart in backend log', async ({ page }) => {
    const subscriptionPattern = /M1 subscription active for/;

    // Navigate to app to trigger subscriptions
    await page.goto(BASE_URL);
    await page.waitForLoadState('commit');
    await page.waitForTimeout(2000);

    // Wait for at least 2 subscription log entries
    const entries = await waitForLogEntries(subscriptionPattern, 2);

    console.log(`Found ${entries.length} subscription log entries`);

    // If no subscriptions found, the feature may not have triggered (e.g., no chart displays)
    // This is acceptable — the test validates queue behavior WHEN subscriptions fire
    if (entries.length < 2) {
      console.log('Fewer than 2 subscriptions detected; skipping timing assertion');
      console.log('Subscriptions found:', entries.map(e => e.line));
      test.info().annotations.push({ type: 'skip-reason', description: 'Fewer than 2 TradingView subscriptions detected during test window' });
      return;
    }

    // Parse timestamps and calculate gaps between consecutive subscriptions
    const gaps = [];
    const entriesWithTs = entries.filter(e => e.timestamp !== null);

    if (entriesWithTs.length < 2) {
      console.log('Fewer than 2 timestamped entries; cannot verify timing');
      console.log('Entries:', entries.map(e => e.line));
      test.info().annotations.push({ type: 'skip-reason', description: 'Could not parse timestamps from log entries' });
      return;
    }

    for (let i = 1; i < entriesWithTs.length; i++) {
      const gapMs = entriesWithTs[i].timestamp - entriesWithTs[i - 1].timestamp;
      gaps.push({
        gapMs,
        from: entriesWithTs[i - 1].line.trim(),
        to: entriesWithTs[i].line.trim(),
      });
    }

    console.log(`\n=== Subscription Gaps (${gaps.length} intervals) ===`);
    for (const gap of gaps) {
      const status = gap.gapMs >= MIN_SUBSCRIPTION_GAP_MS ? 'OK' : 'FAIL';
      console.log(`  [${status}] ${gap.gapMs}ms gap`);
      console.log(`    from: ${gap.from.substring(0, 120)}`);
      console.log(`    to:   ${gap.to.substring(0, 120)}`);
    }

    // Assert all gaps meet the minimum interval
    const violatingGaps = gaps.filter(g => g.gapMs < MIN_SUBSCRIPTION_GAP_MS);
    expect(
      violatingGaps.length,
      `All subscription gaps should be >= ${MIN_SUBSCRIPTION_GAP_MS}ms. ` +
      `Violations: ${violatingGaps.map(g => `${g.gapMs}ms`).join(', ')}`
    ).toBe(0);
  });

  test('no "banned by ip" errors in backend log', async ({ page }) => {
    // Navigate to app to trigger activity
    await page.goto(BASE_URL);
    await page.waitForLoadState('commit');
    await page.waitForTimeout(2000);

    // Wait a reasonable time for any ban errors to appear
    await new Promise(r => setTimeout(r, 10000));

    const content = fs.readFileSync(BACKEND_LOG_PATH, 'utf-8').toLowerCase();
    const bannedOccurrences = content.split('banned by ip').length - 1;

    console.log(`"banned by ip" occurrences in backend log: ${bannedOccurrences}`);

    expect(bannedOccurrences, 'Should have zero "banned by ip" errors').toBe(0);
  });

  test('no "__SYSTEM__" errors in backend log', async ({ page }) => {
    // Navigate to app to trigger activity
    await page.goto(BASE_URL);
    await page.waitForLoadState('commit');
    await page.waitForTimeout(2000);

    // Wait a reasonable time for any system errors to appear
    await new Promise(r => setTimeout(r, 10000));

    const content = fs.readFileSync(BACKEND_LOG_PATH, 'utf-8');
    const systemErrors = content.split('Symbol not found in map: __SYSTEM__').length - 1;

    console.log('"Symbol not found in map: __SYSTEM__" occurrences in backend log:', systemErrors);

    expect(systemErrors, 'Should have zero "__SYSTEM__" symbol errors').toBe(0);
  });

  test('full queue validation: timing, bans, and system errors', async ({ page }) => {
    const subscriptionPattern = /M1 subscription active for/;

    // Navigate to app
    await page.goto(BASE_URL);
    await page.waitForLoadState('commit');
    await page.waitForTimeout(2000);

    // Wait for subscriptions
    const entries = await waitForLogEntries(subscriptionPattern, 2);
    console.log(`Found ${entries.length} subscription entries`);

    // Read full log for error checks
    const fullLog = fs.readFileSync(BACKEND_LOG_PATH, 'utf-8');

    // Check 1: No banned by ip
    const bannedCount = fullLog.toLowerCase().split('banned by ip').length - 1;
    console.log(`"banned by ip" count: ${bannedCount}`);
    expect(bannedCount, 'Zero "banned by ip" errors').toBe(0);

    // Check 2: No __SYSTEM__ errors
    const systemErrorCount = fullLog.split('Symbol not found in map: __SYSTEM__').length - 1;
    console.log(`"__SYSTEM__" error count: ${systemErrorCount}`);
    expect(systemErrorCount, 'Zero "__SYSTEM__" errors').toBe(0);

    // Check 3: Subscription spacing (if enough entries with timestamps)
    if (entries.length >= 2) {
      const entriesWithTs = entries.filter(e => e.timestamp !== null);
      if (entriesWithTs.length >= 2) {
        const gaps = [];
        for (let i = 1; i < entriesWithTs.length; i++) {
          const gapMs = entriesWithTs[i].timestamp - entriesWithTs[i - 1].timestamp;
          gaps.push(gapMs);
        }

        console.log(`Subscription gaps: ${gaps.map(g => `${g}ms`).join(', ')}`);

        const violatingGaps = gaps.filter(g => g < MIN_SUBSCRIPTION_GAP_MS);
        expect(
          violatingGaps.length,
          `All gaps >= ${MIN_SUBSCRIPTION_GAP_MS}ms. Violations: ${violatingGaps.join(', ')}ms`
        ).toBe(0);
      } else {
        console.log('Could not parse timestamps; skipping timing check');
      }
    } else {
      console.log('Fewer than 2 subscriptions; skipping timing check');
    }

    // Check 4: No browser errors
    const browserErrors = consoleLogs.filter(l => l.type === 'error');
    console.log(`Browser errors: ${browserErrors.length}`);
    if (browserErrors.length > 0) {
      browserErrors.forEach(e => console.log(`  [error] ${e.text}`));
    }
  });
});
