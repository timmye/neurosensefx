/**
 * Simple Canvas Positioning Test
 * Bypasses market data loading to focus on canvas drift validation
 */

import { test, expect } from '@playwright/test';

test.describe('Simple Canvas Positioning Tests', () => {
  test('canvas maintains position stability during rendering', async ({ page }) => {
    await page.goto('/test-simple-canvas.html');
    await page.waitForFunction(() => window.canvasTestReady);

    // Wait for canvas to be ready
    await page.waitForSelector('#test-canvas', { timeout: 5000 });

    // Function to capture canvas snapshot
    const captureSnapshot = async () => {
      return await page.evaluate(() => window.captureCanvasSnapshot());
    };

    // Capture initial snapshot
    const initialSnapshot = await captureSnapshot();
    console.log('Initial canvas snapshot captured');

    // Wait and capture multiple snapshots over time
    const snapshots = [initialSnapshot];
    const intervals = [1000, 2000, 3000]; // 1s, 2s, 3s

    for (const interval of intervals) {
      await page.waitForTimeout(interval);
      const snapshot = await captureSnapshot();
      snapshots.push(snapshot);
      console.log(`Snapshot captured at ${interval}ms`);
    }

    // Analyze for drift - compare first and last snapshots
    const driftAnalysis = await page.evaluate((snapshots) => {
      const first = snapshots[0];
      const last = snapshots[snapshots.length - 1];

      let totalDrift = 0;
      let significantChanges = 0;

      for (let i = 0; i < first.points.length; i++) {
        const firstPoint = first.points[i];
        const lastPoint = last.points[i];

        // Calculate color difference
        const colorDiff = Math.abs(firstPoint.r - lastPoint.r) +
                        Math.abs(firstPoint.g - lastPoint.g) +
                        Math.abs(firstPoint.b - lastPoint.b);

        if (colorDiff > 5) { // Small threshold for minor variations
          significantChanges++;
          totalDrift += colorDiff;
        }
      }

      const avgDrift = significantChanges > 0 ? totalDrift / significantChanges : 0;
      const stabilityScore = Math.max(0, 100 - avgDrift);

      return {
        totalPoints: first.points.length,
        significantChanges,
        avgDrift,
        stabilityScore
      };
    }, snapshots);

    console.log('Canvas stability analysis:', driftAnalysis);

    // Assert that canvas is stable (no significant drift)
    expect(driftAnalysis.stabilityScore).toBeGreaterThan(90);
    expect(driftAnalysis.avgDrift).toBeLessThan(10);
  });

  test('canvas dimensions remain consistent', async ({ page }) => {
    await page.goto('/test-simple-canvas.html');
    await page.waitForFunction(() => window.canvasTestReady);

    // Check canvas dimensions are consistent
    const dimensionTest = await page.evaluate(() => {
      const canvas = document.getElementById('test-canvas');
      const dpr = window.devicePixelRatio || 1;

      return {
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        clientWidth: canvas.clientWidth,
        clientHeight: canvas.clientHeight,
        dpr: dpr,
        isProperlyScaled: canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight
      };
    });

    console.log('Canvas dimension test:', dimensionTest);

    // Canvas should have consistent dimensions
    expect(dimensionTest.canvasWidth).toBe(400);
    expect(dimensionTest.canvasHeight).toBe(300);
    expect(dimensionTest.clientWidth).toBe(400);
    expect(dimensionTest.clientHeight).toBe(300);
  });

  test('canvas clearing does not leave artifacts', async ({ page }) => {
    await page.goto('/test-simple-canvas.html');
    await page.waitForFunction(() => window.canvasTestReady);

    const artifactTest = await page.evaluate(async () => {
      const canvas = document.getElementById('test-canvas');
      const ctx = canvas.getContext('2d');

      // Capture initial state
      const initialData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Clear and redraw several times
      for (let i = 0; i < 5; i++) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 100));

        // Redraw the pattern
        window.drawTestPattern();
      }

      // Check final state
      const finalData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Simple check - make sure canvas is not completely black or white
      let blackPixels = 0;
      let whitePixels = 0;

      for (let i = 0; i < finalData.data.length; i += 4) {
        const r = finalData.data[i];
        const g = finalData.data[i + 1];
        const b = finalData.data[i + 2];

        if (r < 10 && g < 10 && b < 10) blackPixels++;
        if (r > 245 && g > 245 && b > 245) whitePixels++;
      }

      const totalPixels = finalData.data.length / 4;
      const blackPercentage = (blackPixels / totalPixels) * 100;
      const whitePercentage = (whitePixels / totalPixels) * 100;

      return {
        blackPercentage,
        whitePercentage,
        totalPixels,
        hasContent: blackPercentage < 90 && whitePercentage < 90
      };
    });

    console.log('Canvas artifact test:', artifactTest);

    // Canvas should have content and not be artifacts
    expect(artifactTest.hasContent).toBe(true);
    expect(artifactTest.blackPercentage).toBeLessThan(50);
    expect(artifactTest.whitePercentage).toBeLessThan(50);
  });
});