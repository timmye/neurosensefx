/**
 * Price Markers Import Test
 *
 * This test validates that price markers embedded in display objects
 * are properly imported and restored to localStorage.
 *
 * Problem: Previously, price markers stored on display objects (display.priceMarkers array)
 * were not being written to localStorage during workspace import.
 *
 * Solution: The import function now iterates through displays and writes each display's
 * priceMarkers array to localStorage with the correct key (price-markers-SYMBOL).
 *
 * Test Objectives:
 * 1. Import a workspace with displays that have embedded priceMarkers
 * 2. Verify price markers are written to localStorage with correct keys
 * 3. Verify PriceMarkerManager can load the markers from localStorage
 *
 * Run: npx playwright test price-markers-import.spec.js
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

test.describe('Price Markers Import', () => {
  let consoleLogs = [];

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

    // Capture console logs
    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();
      consoleLogs.push({ text, type });
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

  // Helper to get displays with embedded price markers from test file
  function getDisplaysWithEmbeddedMarkers() {
    const workspaceContent = getTestWorkspaceContent();
    const displaysWithMarkers = [];
    for (const [id, display] of workspaceContent.workspace.displays) {
      if (display.priceMarkers && display.priceMarkers.length > 0) {
        displaysWithMarkers.push({
          id,
          symbol: display.symbol,
          markerCount: display.priceMarkers.length,
          markers: display.priceMarkers
        });
      }
    }
    return displaysWithMarkers;
  }

  test('should import price markers from display objects to localStorage', async ({ page }) => {
    // Navigate to application
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Wait for workspace API to be available
    await expect.poll(async () => await waitForWorkspaceAPI(page), {
      timeout: 10000
    }).toBe(true);

    // Get test workspace content and displays with embedded markers
    const displaysWithMarkers = getDisplaysWithEmbeddedMarkers();
    console.log(`Found ${displaysWithMarkers.length} displays with embedded price markers`);

    // Log the displays with markers for debugging
    displaysWithMarkers.forEach(d => {
      console.log(`  - ${d.symbol}: ${d.markerCount} markers`);
    });

    // Import workspace
    const workspaceContent = getTestWorkspaceContent();
    await page.evaluate(async (workspaceData) => {
      const jsonStr = JSON.stringify(workspaceData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const file = new File([blob], 'workspace_import_test_file.json', { type: 'application/json' });
      await window.workspaceActions.importWorkspace(file);
    }, workspaceContent);

    // Wait for import to complete
    await page.waitForTimeout(3000);

    // Verify price markers are in localStorage with correct keys
    const localStorageKeys = await page.evaluate(() => {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('price-markers-')) {
          const value = JSON.parse(localStorage.getItem(key));
          keys.push({ key, markerCount: value.length });
        }
      }
      return keys;
    });

    console.log(`Found ${localStorageKeys.length} price-marker entries in localStorage`);
    localStorageKeys.forEach(entry => {
      console.log(`  - ${entry.key}: ${entry.markerCount} markers`);
    });

    // Verify that displays with embedded markers have localStorage entries
    const symbolsWithMarkersInStorage = localStorageKeys.map(k => k.key.replace('price-markers-', ''));

    for (const display of displaysWithMarkers) {
      const storageKey = `price-markers-${display.symbol}`;
      const storageEntry = localStorageKeys.find(k => k.key === storageKey);

      expect(storageEntry).toBeDefined();
      expect(storageEntry.markerCount).toBe(display.markerCount);

      console.log(`✓ ${display.symbol}: ${display.markerCount} markers in localStorage`);
    }
  });

  test('should load price markers from localStorage via PriceMarkerManager', async ({ page }) => {
    // Navigate to application
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Wait for workspace API
    await expect.poll(async () => await waitForWorkspaceAPI(page), {
      timeout: 10000
    }).toBe(true);

    // Get displays with embedded markers
    const displaysWithMarkers = getDisplaysWithEmbeddedMarkers();

    // Import workspace
    const workspaceContent = getTestWorkspaceContent();
    await page.evaluate(async (workspaceData) => {
      const jsonStr = JSON.stringify(workspaceData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const file = new File([blob], 'workspace_import_test_file.json', { type: 'application/json' });
      await window.workspaceActions.importWorkspace(file);
    }, workspaceContent);

    // Wait for displays to mount and PriceMarkerManager to initialize
    await page.waitForTimeout(3000);

    // Verify that price markers are loaded in the display state
    const displaysWithLoadedMarkers = await page.evaluate((expectedSymbols) => {
      const displays = window.workspaceStore.getState().displays;
      const results = [];

      for (const [id, display] of displays) {
        if (expectedSymbols.includes(display.symbol)) {
          results.push({
            id,
            symbol: display.symbol,
            markerCount: display.priceMarkers?.length || 0
          });
        }
      }
      return results;
    }, displaysWithMarkers.map(d => d.symbol));

    console.log('Price markers loaded into display state:');
    displaysWithLoadedMarkers.forEach(d => {
      console.log(`  - ${d.symbol}: ${d.markerCount} markers`);
    });

    // Verify that displays with embedded markers now have them in their state
    for (const expected of displaysWithMarkers) {
      const loaded = displaysWithLoadedMarkers.find(d => d.symbol === expected.symbol);
      expect(loaded).toBeDefined();
      expect(loaded.markerCount).toBe(expected.markerCount);
      console.log(`✓ ${expected.symbol}: ${expected.markerCount} markers loaded`);
    }
  });

  test('should preserve price marker data integrity during import', async ({ page }) => {
    // Navigate to application
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Wait for workspace API
    await expect.poll(async () => await waitForWorkspaceAPI(page), {
      timeout: 10000
    }).toBe(true);

    // Get test workspace content and extract a specific marker
    const workspaceContent = getTestWorkspaceContent();
    const displaysWithMarkers = getDisplaysWithEmbeddedMarkers();

    // Take the first display with markers and verify its data
    const testDisplay = displaysWithMarkers[0];
    const testMarker = testDisplay.markers[0];

    console.log(`Testing ${testDisplay.symbol} with marker:`, testMarker);

    // Import workspace
    await page.evaluate(async (workspaceData) => {
      const jsonStr = JSON.stringify(workspaceData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const file = new File([blob], 'workspace_import_test_file.json', { type: 'application/json' });
      await window.workspaceActions.importWorkspace(file);
    }, workspaceContent);

    // Wait for import
    await page.waitForTimeout(3000);

    // Verify the marker data integrity in localStorage
    const storedMarker = await page.evaluate(({ symbol, markerId }) => {
      const key = `price-markers-${symbol}`;
      const markers = JSON.parse(localStorage.getItem(key) || '[]');
      return markers.find(m => m.id === markerId);
    }, { symbol: testDisplay.symbol, markerId: testMarker.id });

    expect(storedMarker).toBeDefined();
    expect(storedMarker.price).toBe(testMarker.price);
    expect(storedMarker.type.name).toBe(testMarker.type.name);
    expect(storedMarker.type.color).toBe(testMarker.type.color);

    console.log(`✓ Marker data integrity verified for ${testDisplay.symbol}`);
  });
});
