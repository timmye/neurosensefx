/**
 * Workspace Drawing Persistence Tests
 *
 * Validates that chart drawings are included in workspace export/import.
 * Export format v1.1.0 embeds IndexedDB drawings keyed by symbol|resolution.
 * Import v1.1.0 restores drawings to IndexedDB; v1.0.0 imports skip drawing restore.
 *
 * Tests:
 * 1. Export produces v1.1.0 JSON with drawings from IndexedDB
 * 2. Import v1.1.0 restores drawings to IndexedDB
 * 3. Import v1.0.0 (no drawings key) restores displays without errors
 * 4. Round-trip: seed -> export -> clear -> import -> verify drawings
 *
 * Run: npx playwright test workspace-drawing-persistence.spec.js
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const TEST_TIMEOUT = 60000;

// Seed drawing data used across tests
const TEST_SYMBOL = 'EURUSD';
const TEST_RESOLUTION = '4h';
const TEST_DRAWING = {
  overlayType: 'rect',
  points: [{ timestamp: 1700000000000, price: 1.0850 }, { timestamp: 1700006400000, price: 1.0950 }],
  styles: { color: '#ff0000' }
};

async function waitForWorkspaceAPI(page) {
  await page.waitForFunction(() => {
    return typeof window.workspaceActions !== 'undefined' &&
           typeof window.workspaceActions.addDisplay === 'function';
  }, { timeout: 20000 });
}

test.describe('Workspace Drawing Persistence', () => {
  let downloadsDir;

  test.beforeAll(async () => {
    downloadsDir = path.join(process.cwd(), 'test-results', 'downloads', `drawing-persist-${Date.now()}`);
    fs.mkdirSync(downloadsDir, { recursive: true });
  });

  test('Export produces v1.1.0 JSON with drawings from IndexedDB', async ({ page }) => {
    await page.goto('/');
    await waitForWorkspaceAPI(page);

    // Seed a drawing via drawingStore
    await page.evaluate(async ({ symbol, resolution, drawing }) => {
      await window.drawingStore.save(symbol, resolution, drawing);
    }, { symbol: TEST_SYMBOL, resolution: TEST_RESOLUTION, drawing: TEST_DRAWING });

    // Verify seed landed in IndexedDB
    const loaded = await page.evaluate(async ({ symbol, resolution }) => {
      return await window.drawingStore.load(symbol, resolution);
    }, { symbol: TEST_SYMBOL, resolution: TEST_RESOLUTION });
    expect(loaded.length).toBe(1);
    expect(loaded[0].overlayType).toBe('rect');

    // Create a chart display so export knows about the symbol/resolution
    await page.evaluate(() => {
      window.workspaceActions.addChartDisplay('EURUSD');
    });
    await page.waitForTimeout(1000);

    // Trigger export and capture download
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.evaluate(() => window.workspaceActions.exportWorkspace())
    ]);

    const downloadPath = await download.path();
    const exportData = JSON.parse(fs.readFileSync(downloadPath, 'utf-8'));

    // Verify export format
    expect(exportData.version).toBe('1.1.0');
    expect(exportData).toHaveProperty('drawings');
    expect(exportData.drawings).toHaveProperty(`${TEST_SYMBOL}|${TEST_RESOLUTION}`);
    expect(exportData.drawings[`${TEST_SYMBOL}|${TEST_RESOLUTION}`].length).toBeGreaterThanOrEqual(1);

    console.log('Export v1.1.0 with drawings: PASS');
  });

  test('Import v1.1.0 restores drawings to IndexedDB', async ({ page }) => {
    await page.goto('/');
    await waitForWorkspaceAPI(page);

    // Verify no pre-existing drawings
    const preImport = await page.evaluate(async ({ symbol, resolution }) => {
      return await window.drawingStore.load(symbol, resolution);
    }, { symbol: TEST_SYMBOL, resolution: TEST_RESOLUTION });
    expect(preImport.length).toBe(0);

    // Construct a v1.1.0 workspace file with drawings
    const importData = {
      version: '1.1.0',
      timestamp: new Date().toISOString(),
      workspace: {
        displays: [],
        nextZIndex: 1
      },
      priceMarkers: {},
      drawings: {
        [`${TEST_SYMBOL}|${TEST_RESOLUTION}`]: [TEST_DRAWING]
      }
    };

    // Import via file
    await page.evaluate(async (data) => {
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const file = new File([blob], 'workspace-import-test.json', { type: 'application/json' });
      await window.workspaceActions.importWorkspace(file);
    }, importData);

    await page.waitForTimeout(2000);

    // Verify drawings are now in IndexedDB
    const postImport = await page.evaluate(async ({ symbol, resolution }) => {
      const results = await window.drawingStore.load(symbol, resolution);
      return results.map(r => ({ overlayType: r.overlayType, symbol: r.symbol, resolution: r.resolution }));
    }, { symbol: TEST_SYMBOL, resolution: TEST_RESOLUTION });

    expect(postImport.length).toBe(1);
    expect(postImport[0].overlayType).toBe('rect');
    expect(postImport[0].symbol).toBe(TEST_SYMBOL);
    expect(postImport[0].resolution).toBe(TEST_RESOLUTION);

    console.log('Import v1.1.0 drawings restore: PASS');
  });

  test('Import v1.0.0 (no drawings key) restores without errors', async ({ page }) => {
    let consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');
    await waitForWorkspaceAPI(page);

    // Construct a v1.0.0 workspace file (no drawings key)
    const legacyData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      workspace: {
        displays: [],
        nextZIndex: 1
      },
      priceMarkers: {}
    };

    await page.evaluate(async (data) => {
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const file = new File([blob], 'legacy-workspace.json', { type: 'application/json' });
      await window.workspaceActions.importWorkspace(file);
    }, legacyData);

    await page.waitForTimeout(2000);

    // No console errors related to drawings
    const drawingErrors = consoleErrors.filter(e =>
      e.includes('Drawing') || e.includes('drawing')
    );
    expect(drawingErrors.length).toBe(0);

    console.log('Import v1.0.0 backward compat: PASS');
  });

  test('Round-trip: seed -> export -> clear -> import -> verify drawings', async ({ page }) => {
    await page.goto('/');
    await waitForWorkspaceAPI(page);

    // Seed drawing
    await page.evaluate(async ({ symbol, resolution, drawing }) => {
      await window.drawingStore.save(symbol, resolution, drawing);
    }, { symbol: TEST_SYMBOL, resolution: TEST_RESOLUTION, drawing: TEST_DRAWING });

    // Add chart display
    await page.evaluate(() => {
      window.workspaceActions.addChartDisplay('EURUSD');
    });
    await page.waitForTimeout(1000);

    // Export
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.evaluate(() => window.workspaceActions.exportWorkspace())
    ]);
    const exportPath = await download.path();

    // Clear all drawings from IndexedDB
    await page.evaluate(async ({ symbol, resolution }) => {
      await window.drawingStore.clearAll(symbol, resolution);
    }, { symbol: TEST_SYMBOL, resolution: TEST_RESOLUTION });

    // Verify cleared
    const cleared = await page.evaluate(async ({ symbol, resolution }) => {
      return await window.drawingStore.load(symbol, resolution);
    }, { symbol: TEST_SYMBOL, resolution: TEST_RESOLUTION });
    expect(cleared.length).toBe(0);

    // Import the exported file
    const exportContent = fs.readFileSync(exportPath, 'utf-8');
    await page.evaluate(async (jsonStr) => {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const file = new File([blob], 'roundtrip.json', { type: 'application/json' });
      await window.workspaceActions.importWorkspace(file);
    }, exportContent);

    await page.waitForTimeout(2000);

    // Verify drawings restored
    const restored = await page.evaluate(async ({ symbol, resolution }) => {
      const results = await window.drawingStore.load(symbol, resolution);
      return results.map(r => ({ overlayType: r.overlayType, symbol: r.symbol, resolution: r.resolution }));
    }, { symbol: TEST_SYMBOL, resolution: TEST_RESOLUTION });

    expect(restored.length).toBeGreaterThanOrEqual(1);
    expect(restored[0].overlayType).toBe('rect');

    console.log('Round-trip seed->export->clear->import: PASS');
  });
});
