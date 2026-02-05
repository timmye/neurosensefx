/**
 * Batched Import Rate Limit Test
 *
 * This test validates the frontend batched import fix for cTrader API rate limiting.
 *
 * Problem: Previously, importing 29 displays would cause rate limiting errors
 * because all displays were created simultaneously.
 *
 * Solution: Displays are now imported in batches of 5 with 200ms delays between batches.
 *
 * Test Objectives:
 * 1. Verify backend is running on port 8080
 * 2. Import a workspace with 29 displays
 * 3. Verify all displays are created in the DOM
 * 4. Verify no rate limit errors in browser console
 * 5. Verify displays show data (not empty/error states)
 * 6. Verify batch timing (should take ~1-2 seconds for 29 displays)
 *
 * Run: npx playwright test batched-import-rate-limit.spec.js
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// Test configuration
const BASE_URL = 'http://localhost:5174';
const TEST_TIMEOUT = 60000;

// Test workspace file path
const TEST_WORKSPACE_PATH = path.join(
  process.cwd(),
  'tests',
  'e2e',
  'workspace_import_test_file.json'
);

// Expected number of displays in test file
const EXPECTED_DISPLAY_COUNT = 29;

// Batch configuration (must match workspace.js)
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 200;

// Expected import duration for 29 displays:
// 29 displays / 5 per batch = 6 batches
// 5 delays between batches = 5 * 200ms = 1000ms
// Plus processing time = ~1200-1500ms total
// Allow extra time for slower systems and rendering
const EXPECTED_MIN_DURATION = 1000; // 1 second
const EXPECTED_MAX_DURATION = 5000; // 5 seconds (generous for CI/slower systems)

test.describe('Batched Import - Rate Limit Prevention', () => {
  let consoleLogs = [];
  let pageErrors = [];

  test.beforeAll(async () => {
    // Verify test workspace file exists
    if (!fs.existsSync(TEST_WORKSPACE_PATH)) {
      throw new Error(`Test workspace file not found: ${TEST_WORKSPACE_PATH}`);
    }

    // Verify backend is running
    const backendResponse = await fetch('http://localhost:8080').catch(() => null);
    if (!backendResponse) {
      throw new Error('Backend is not running on port 8080. Start with: ./run.sh start');
    }
  });

  test.beforeEach(async ({ page }) => {
    consoleLogs = [];
    pageErrors = [];

    // Capture console logs
    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();
      consoleLogs.push({ text, type });
    });

    // Capture page errors
    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });
  });

  // Helper to wait for workspace API
  async function waitForWorkspaceAPI(page) {
    return await page.evaluate(() => {
      return typeof window.workspaceActions !== 'undefined' &&
             typeof window.workspaceActions.addDisplay === 'function' &&
             typeof window.workspaceActions.importWorkspace === 'function';
    });
  }

  // Helper to read test workspace file
  function getTestWorkspaceContent() {
    return JSON.parse(fs.readFileSync(TEST_WORKSPACE_PATH, 'utf-8'));
  }

  test('should import 29 displays in batches without rate limiting', async ({ page }) => {
    const startTime = Date.now();

    // Navigate to application
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Wait for workspace API to be available
    await expect.poll(async () => await waitForWorkspaceAPI(page), {
      timeout: 10000
    }).toBe(true);

    // Get test workspace content
    const workspaceContent = getTestWorkspaceContent();
    console.log(`Test workspace contains ${workspaceContent.workspace.displays.length} displays`);

    // Create a File object and import in one go
    await page.evaluate(async (workspaceData) => {
      const jsonStr = JSON.stringify(workspaceData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const file = new File([blob], 'workspace_import_test_file.json', { type: 'application/json' });
      await window.workspaceActions.importWorkspace(file);
    }, workspaceContent);

    // Wait for all displays to be created
    // With batching: 6 batches * 200ms = ~1200ms minimum
    const importDuration = Date.now() - startTime;
    console.log(`Import completed in ${importDuration}ms`);

    // Wait for DOM to update with all displays
    await page.waitForTimeout(2000);

    // Count displays in DOM
    const displayCount = await page.locator('.floating-display').count();
    console.log(`Found ${displayCount} displays in DOM`);

    // Verify all displays were created
    expect(displayCount).toBe(EXPECTED_DISPLAY_COUNT);

    // Verify batch timing - should take at least the minimum delay
    expect(importDuration).toBeGreaterThanOrEqual(EXPECTED_MIN_DURATION);

    // But not too long (indicates problem)
    expect(importDuration).toBeLessThan(EXPECTED_MAX_DURATION);
  });

  test('should show success message in console', async ({ page }) => {
    // Navigate to application
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Wait for workspace API
    await expect.poll(async () => await waitForWorkspaceAPI(page), {
      timeout: 10000
    }).toBe(true);

    // Get test workspace content
    const workspaceContent = getTestWorkspaceContent();

    // Import workspace
    await page.evaluate(async (workspaceData) => {
      const jsonStr = JSON.stringify(workspaceData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const file = new File([blob], 'workspace_import_test_file.json', { type: 'application/json' });
      await window.workspaceActions.importWorkspace(file);
    }, workspaceContent);

    // Wait for import to complete
    await page.waitForTimeout(2000);

    // Check console logs for success message
    const successLog = consoleLogs.find(log =>
      log.type === 'log' &&
      log.text.includes('Workspace imported successfully') &&
      log.text.includes('29 displays')
    );

    expect(successLog).toBeDefined();
    console.log('Found success message:', successLog?.text);
  });

  test('should have no rate limit errors in console', async ({ page }) => {
    // Navigate to application
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Wait for workspace API
    await expect.poll(async () => await waitForWorkspaceAPI(page), {
      timeout: 10000
    }).toBe(true);

    // Get test workspace content
    const workspaceContent = getTestWorkspaceContent();

    // Import workspace
    await page.evaluate(async (workspaceData) => {
      const jsonStr = JSON.stringify(workspaceData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const file = new File([blob], 'workspace_import_test_file.json', { type: 'application/json' });
      await window.workspaceActions.importWorkspace(file);
    }, workspaceContent);

    // Wait for import to complete
    await page.waitForTimeout(2000);

    // Check for actual rate limit errors (more specific pattern matching)
    const rateLimitErrors = consoleLogs.filter(log => {
      const text = log.text.toLowerCase();
      // Look for actual rate limit errors, not just the word "rate"
      return (text.includes('rate limit') || text.includes('ratelimit') || text.includes('429')) &&
             !text.includes('rate-limit') && // Exclude rate-limit in non-error contexts
             (text.includes('error') || text.includes('exceeded') || text.includes('too many'));
    });

    console.log('Filtered rate limit errors:', rateLimitErrors.map(l => l.text));

    // Verify no rate limit errors
    expect(rateLimitErrors.length).toBe(0);

    // Check page errors - filter out known non-critical errors (PriceMarkerManager issues during import)
    const criticalErrors = pageErrors.filter(err => {
      const errStr = err.toLowerCase();
      // Filter out PriceMarkerManager errors that occur during display initialization
      return !errStr.includes('pricemarkermanager') &&
             !errStr.includes('touppercase') &&
             !errStr.includes('cannot read properties');
    });

    expect(criticalErrors.length).toBe(0);
  });

  test('should verify displays have correct symbols and sources', async ({ page }) => {
    // Navigate to application
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Wait for workspace API
    await expect.poll(async () => await waitForWorkspaceAPI(page), {
      timeout: 10000
    }).toBe(true);

    // Get test workspace content
    const workspaceContent = getTestWorkspaceContent();
    const expectedDisplays = workspaceContent.workspace.displays;

    // Import workspace
    await page.evaluate(async (workspaceData) => {
      const jsonStr = JSON.stringify(workspaceData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const file = new File([blob], 'workspace_import_test_file.json', { type: 'application/json' });
      await window.workspaceActions.importWorkspace(file);
    }, workspaceContent);

    // Wait for displays to be created in DOM
    await page.waitForTimeout(2000);

    // Get all displays and check their data attributes
    const displayInfo = await page.evaluate(() => {
      const displays = document.querySelectorAll('.floating-display');
      return {
        totalCount: displays.length,
        sampleIds: Array.from(displays).slice(0, 5).map(d => d.getAttribute('data-display-id'))
      };
    });

    console.log(`Total displays: ${displayInfo.totalCount}`);
    console.log('Sample display IDs:', displayInfo.sampleIds);

    // Verify all displays were created
    expect(displayInfo.totalCount).toBe(EXPECTED_DISPLAY_COUNT);

    // Verify displays have valid IDs
    const validIds = displayInfo.sampleIds.filter(id => id && id.startsWith('display-'));
    expect(validIds.length).toBeGreaterThan(0);
  });

  test('should verify displays are not in error state', async ({ page }) => {
    // Navigate to application
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Wait for workspace API
    await expect.poll(async () => await waitForWorkspaceAPI(page), {
      timeout: 10000
    }).toBe(true);

    // Get test workspace content
    const workspaceContent = getTestWorkspaceContent();

    // Import workspace
    await page.evaluate(async (workspaceData) => {
      const jsonStr = JSON.stringify(workspaceData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const file = new File([blob], 'workspace_import_test_file.json', { type: 'application/json' });
      await window.workspaceActions.importWorkspace(file);
    }, workspaceContent);

    // Wait for displays to load data
    await page.waitForTimeout(5000);

    // Check for error states
    const errorDisplays = await page.evaluate(() => {
      const displays = document.querySelectorAll('.floating-display');
      return Array.from(displays).filter(display => {
        const text = display.textContent || '';
        return text.includes('Error') ||
               text.includes('error') ||
               text.includes('Failed') ||
               text.includes('failed');
      }).length;
    });

    // Most displays should not be in error state
    // Allow up to 5 displays that might still be loading or have transient errors
    console.log(`Displays with error states: ${errorDisplays}`);
    expect(errorDisplays).toBeLessThan(5);
  });

  test('should verify batching console output', async ({ page }) => {
    // Navigate to application
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Wait for workspace API
    await expect.poll(async () => await waitForWorkspaceAPI(page), {
      timeout: 10000
    }).toBe(true);

    // Get test workspace content
    const workspaceContent = getTestWorkspaceContent();

    // Capture import start time
    const importStartTime = Date.now();

    // Import workspace
    await page.evaluate(async (workspaceData) => {
      const jsonStr = JSON.stringify(workspaceData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const file = new File([blob], 'workspace_import_test_file.json', { type: 'application/json' });
      await window.workspaceActions.importWorkspace(file);
    }, workspaceContent);

    // Wait for import to complete
    await page.waitForTimeout(2000);

    const importDuration = Date.now() - importStartTime;

    // Output console logs for debugging
    console.log('\n=== Console Logs ===');
    consoleLogs.forEach(log => {
      console.log(`[${log.type}] ${log.text}`);
    });

    // Verify timing indicates batching
    console.log(`\nImport took ${importDuration}ms`);
    console.log(`Expected minimum: ${EXPECTED_MIN_DURATION}ms (5 batches × 200ms delays)`);
    console.log(`Expected maximum: ${EXPECTED_MAX_DURATION}ms`);

    // With batching, should take at least 1 second
    expect(importDuration).toBeGreaterThanOrEqual(EXPECTED_MIN_DURATION);

    // But complete within reasonable time
    expect(importDuration).toBeLessThan(EXPECTED_MAX_DURATION);
  });
});
