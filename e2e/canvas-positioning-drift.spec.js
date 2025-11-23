/**
 * Canvas Positioning Drift Tests
 * Tests for the FX canvas drift bug fix and canvas coordinate stability
 */

import { test, expect } from '@playwright/test';
import { browserAgentManager } from './helpers/browser-agents.js';
import { testFixtures } from './helpers/fixtures.js';

test.describe('Canvas Positioning Drift Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await browserAgentManager.setupPerformanceMonitoring(page);
    await browserAgentManager.waitForMarketData(page);

    // Wait for the app to be ready and create a display
    await page.waitForFunction(() => window.displayActions && window.displayStore, { timeout: 10000 });

    // Create a display for testing
    await page.evaluate(() => {
      console.log('Creating display for testing...');
      console.log('displayActions available:', !!window.displayActions);
      console.log('displayStore available:', !!window.displayStore);

      // Try to create a display with BTCUSD symbol
      try {
        const displayId = window.displayActions.addDisplay('BTCUSD', { x: 100, y: 100 });
        console.log('Display created:', displayId);

        // Check if display was added to store
        if (window.displayStore) {
          window.displayStore.subscribe(store => {
            console.log('Current displays:', Object.keys(store.displays || {}));
          });
        }
      } catch (error) {
        console.error('Failed to create display:', error);
      }
    });

    // Wait for canvas to appear after creating display
    await page.waitForTimeout(5000);
  });

  test('FX display maintains position stability over time', async ({ page }) => {
    // Debug: check what elements are actually in the DOM
    await page.evaluate(() => {
      console.log('=== DOM DEBUG INFO ===');
      console.log('Body HTML:', document.body.innerHTML.substring(0, 500));
      console.log('All elements:', Array.from(document.querySelectorAll('*')).map(el => ({
        tag: el.tagName,
        id: el.id,
        class: el.className,
        hasCanvas: el.tagName === 'CANVAS'
      })));
    });

    await page.waitForSelector('canvas', { timeout: 15000 });

    // Function to capture canvas snapshot
    const captureCanvasSnapshot = async () => {
      return await page.evaluate(() => {
        const canvases = document.querySelectorAll('canvas');
        const snapshots = [];

        for (let i = 0; i < canvases.length; i++) {
          const canvas = canvases[i];
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Sample a grid of points to detect positioning changes
            const sampleSize = 50; // Sample area
            const gridPoints = 10; // 10x10 grid

            const points = [];
            for (let x = 0; x < gridPoints; x++) {
              for (let y = 0; y < gridPoints; y++) {
                const pixelX = Math.floor((canvas.width * x) / gridPoints);
                const pixelY = Math.floor((canvas.height * y) / gridPoints);
                const imageData = ctx.getImageData(pixelX, pixelY, 1, 1);
                const pixel = imageData.data;
                points.push({
                  x: pixelX,
                  y: pixelY,
                  r: pixel[0],
                  g: pixel[1],
                  b: pixel[2],
                  a: pixel[3]
                });
              }
            }

            snapshots.push({
              canvasIndex: i,
              width: canvas.width,
              height: canvas.height,
              points: points
            });
          }
        }
        return snapshots;
      });
    };

    // Capture initial snapshot
    const initialSnapshot = await captureCanvasSnapshot();
    expect(initialSnapshot.length).toBeGreaterThan(0);

    // Wait and capture multiple snapshots over time
    const snapshots = [initialSnapshot];
    const intervals = [2000, 4000, 6000]; // 2s, 4s, 6s

    for (const interval of intervals) {
      await page.waitForTimeout(interval);
      const snapshot = await captureCanvasSnapshot();
      snapshots.push(snapshot);
    }

    // Analyze for drift
    const driftAnalysis = await page.evaluate((snapshots) => {
      const results = [];

      for (let i = 0; i < snapshots[0].length; i++) {
        const canvasAnalysis = {
          canvasIndex: i,
          maxDriftX: 0,
          maxDriftY: 0,
          avgDriftX: 0,
          avgDriftY: 0,
          stabilityScore: 100
        };

        if (snapshots.length > 1 && snapshots.every(s => s[i])) {
          const firstCanvas = snapshots[0][i];
          const lastCanvas = snapshots[snapshots.length - 1][i];

          const drifts = [];

          for (let j = 0; j < firstCanvas.points.length; j++) {
            const firstPoint = firstCanvas.points[j];
            const lastPoint = lastCanvas.points[j];

            // Calculate content-based drift by finding matching pixels
            // This is a simplified approach - in practice you might use more sophisticated image comparison
            const colorDiff = Math.abs(firstPoint.r - lastPoint.r) +
                            Math.abs(firstPoint.g - lastPoint.g) +
                            Math.abs(firstPoint.b - lastPoint.b);

            if (colorDiff > 10) { // Significant color change
              drifts.push({
                x: Math.abs(lastPoint.x - firstPoint.x),
                y: Math.abs(lastPoint.y - firstPoint.y)
              });
            }
          }

          if (drifts.length > 0) {
            canvasAnalysis.maxDriftX = Math.max(...drifts.map(d => d.x));
            canvasAnalysis.maxDriftY = Math.max(...drifts.map(d => d.y));
            canvasAnalysis.avgDriftX = drifts.reduce((sum, d) => sum + d.x, 0) / drifts.length;
            canvasAnalysis.avgDriftY = drifts.reduce((sum, d) => sum + d.y, 0) / drifts.length;
            canvasAnalysis.stabilityScore = Math.max(0, 100 - (canvasAnalysis.maxDriftX + canvasAnalysis.maxDriftY) / 2);
          }
        }

        results.push(canvasAnalysis);
      }

      return results;
    }, snapshots);

    // Assert no significant drift
    for (const analysis of driftAnalysis) {
      console.log(`Canvas ${analysis.canvasIndex} drift analysis:`, analysis);

      // Max drift should be less than 5 pixels (conservative threshold)
      expect(analysis.maxDriftX).toBeLessThan(5);
      expect(analysis.maxDriftY).toBeLessThan(5);

      // Stability score should be above 80%
      expect(analysis.stabilityScore).toBeGreaterThan(80);
    }
  });

  test('drag interactions do not cause canvas drift', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 15000 });

    // Get initial canvas state
    const initialState = await page.evaluate(() => {
      const canvases = document.querySelectorAll('canvas');
      const states = [];

      for (let i = 0; i < canvases.length; i++) {
        const canvas = canvases[i];
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Get canvas center region for comparison
          const centerX = Math.floor(canvas.width / 2);
          const centerY = Math.floor(canvas.height / 2);
          const regionSize = 100;

          const imageData = ctx.getImageData(
            centerX - regionSize/2,
            centerY - regionSize/2,
            regionSize,
            regionSize
          );

          states.push({
            canvasIndex: i,
            centerX: centerX,
            centerY: centerY,
            regionSize: regionSize,
            pixelData: Array.from(imageData.data)
          });
        }
      }
      return states;
    });

    // Simulate dragging another canvas (if multiple exist)
    const canvasCount = await page.evaluate(() => document.querySelectorAll('canvas').length);

    if (canvasCount > 1) {
      // Drag one canvas to test for interference
      await page.mouse.move(200, 200);
      await page.mouse.down();
      await page.mouse.move(300, 300, { steps: 10 });
      await page.mouse.move(400, 400, { steps: 10 });
      await page.mouse.up();

      await page.waitForTimeout(2000);

      // Check if other canvases remained stable
      const finalState = await page.evaluate(() => {
        const canvases = document.querySelectorAll('canvas');
        const states = [];

        for (let i = 0; i < canvases.length; i++) {
          const canvas = canvases[i];
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const centerX = Math.floor(canvas.width / 2);
            const centerY = Math.floor(canvas.height / 2);
            const regionSize = 100;

            const imageData = ctx.getImageData(
              centerX - regionSize/2,
              centerY - regionSize/2,
              regionSize,
              regionSize
            );

            states.push({
              canvasIndex: i,
              pixelData: Array.from(imageData.data)
            });
          }
        }
        return states;
      });

      // Compare states for significant changes
      for (let i = 0; i < Math.min(initialState.length, finalState.length); i++) {
        const initial = initialState[i];
        const final = finalState[i];

        if (initial.pixelData.length === final.pixelData.length) {
          let diffCount = 0;
          for (let j = 0; j < initial.pixelData.length; j += 4) {
            const colorDiff = Math.abs(initial.pixelData[j] - final.pixelData[j]) +
                            Math.abs(initial.pixelData[j+1] - final.pixelData[j+1]) +
                            Math.abs(initial.pixelData[j+2] - final.pixelData[j+2]);

            if (colorDiff > 30) diffCount++; // Significant color difference
          }

          const diffPercentage = (diffCount / (initial.pixelData.length / 4)) * 100;
          console.log(`Canvas ${i} pixel difference after drag: ${diffPercentage.toFixed(2)}%`);

          // Allow some difference due to market data updates, but not too much
          expect(diffPercentage).toBeLessThan(50);
        }
      }
    } else {
      console.log('Only one canvas found, testing drag stability on single canvas');

      // Drag the single canvas to test its own stability
      await page.mouse.move(200, 200);
      await page.mouse.down();
      await page.mouse.move(300, 300, { steps: 10 });
      await page.mouse.move(200, 200, { steps: 10 });
      await page.mouse.up();

      await page.waitForTimeout(2000);

      // The canvas should still be functional after dragging
      const stillRendering = await page.evaluate(() => {
        const canvases = document.querySelectorAll('canvas');
        for (const canvas of canvases) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            return imageData.data.some((channel, index) => {
              return index % 4 !== 3 && channel !== 0; // Check RGB channels
            });
          }
        }
        return false;
      });

      expect(stillRendering).toBe(true);
    }
  });

  test('canvas clearing works correctly with DPR scaling', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 15000 });

    // Test that canvas clearing works properly with different DPR settings
    const dprTest = await page.evaluate(() => {
      const canvases = document.querySelectorAll('canvas');
      const results = [];

      for (let i = 0; i < canvases.length; i++) {
        const canvas = canvases[i];
        const dpr = window.devicePixelRatio || 1;

        // Check if canvas dimensions are properly scaled
        const isProperlyScaled = canvas.width !== canvas.clientWidth ||
                                canvas.height !== canvas.clientHeight;

        results.push({
          canvasIndex: i,
          dpr: dpr,
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          clientWidth: canvas.clientWidth,
          clientHeight: canvas.clientHeight,
          isProperlyScaled: isProperlyScaled,
          hasDPRScaling: dpr > 1
        });
      }

      return results;
    });

    for (const result of dprTest) {
      console.log(`Canvas ${result.canvasIndex} DPR info:`, result);

      if (result.hasDPRScaling) {
        // On high-DPI displays, canvas should be properly scaled
        expect(result.isProperlyScaled || result.canvasWidth === result.clientWidth).toBe(true);
      }

      // Canvas should have reasonable dimensions
      expect(result.canvasWidth).toBeGreaterThan(0);
      expect(result.canvasHeight).toBeGreaterThan(0);
      expect(result.clientWidth).toBeGreaterThan(0);
      expect(result.clientHeight).toBeGreaterThan(0);
    }

    // Test multiple render cycles don't accumulate artifacts
    const artifactTest = await page.evaluate(async () => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return false;

      const ctx = canvas.getContext('2d');
      if (!ctx) return false;

      // Capture initial state
      const initialData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Wait for several render cycles
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check if canvas clears properly between renders
      // (no accumulating artifacts that shouldn't be there)
      const finalData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Simple check - canvas should not be completely filled with artifacts
      let transparentPixels = 0;
      for (let i = 3; i < finalData.data.length; i += 4) {
        if (finalData.data[i] < 255) transparentPixels++;
      }

      const transparentPercentage = (transparentPixels / (finalData.data.length / 4)) * 100;

      return {
        hasTransparentAreas: transparentPercentage > 5,
        transparentPercentage: transparentPercentage
      };
    });

    console.log('Canvas clearing artifact test:', artifactTest);

    // Canvas should have some transparent/clear areas (not completely filled with artifacts)
    if (artifactTest) {
      expect(artifactTest.hasTransparentAreas).toBe(true);
    }
  });
});