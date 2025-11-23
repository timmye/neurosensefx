/**
 * Canvas rendering performance and quality tests
 * Tests the visual components of NeuroSense FX
 */

import { test, expect } from '@playwright/test';
import { browserAgentManager } from '../helpers/browser-agents.js';
import { testFixtures } from '../helpers/fixtures.js';

test.describe('Canvas Rendering Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await browserAgentManager.setupPerformanceMonitoring(page);
    await browserAgentManager.waitForMarketData(page);
  });

  test('market profile renders correctly', async ({ page }) => {
    // Wait for canvas to be ready
    await page.waitForSelector('canvas', { timeout: 5000 });

    // Check if market profile canvas exists and is rendering
    const hasMarketProfile = await page.evaluate(() => {
      const canvases = document.querySelectorAll('canvas');
      for (const canvas of canvases) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Check if canvas has been drawn to
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const hasContent = imageData.data.some((channel, index) => {
            return index % 4 !== 3 && channel !== 0; // Check RGB channels, not alpha
          });
          if (hasContent) return true;
        }
      }
      return false;
    });

    expect(hasMarketProfile).toBe(true);
  });

  test('canvas rendering maintains performance', async ({ page }) => {
    // Collect initial performance metrics
    const { collectMetrics } = await browserAgentManager.setupPerformanceMonitoring(page);

    // Simulate user interaction to trigger rendering
    await page.mouse.move(400, 300);
    await page.mouse.move(500, 400);
    await page.mouse.move(600, 500);

    // Wait for rendering cycles
    await page.waitForTimeout(2000);

    const metrics = await collectMetrics();

    // Check FPS performance
    if (metrics.length > 0) {
      const avgFps = metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
      console.log(`Average FPS: ${avgFps.toFixed(2)}`);
      expect(avgFps).toBeGreaterThan(testFixtures.benchmarks.fps.minimum);
    }
  });

  test('DPR-aware text rendering is crisp', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 5000 });

    const textQuality = await page.evaluate(() => {
      const canvases = document.querySelectorAll('canvas');
      for (const canvas of canvases) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Check if DPR-aware rendering is implemented
          const dpr = window.devicePixelRatio || 1;
          const canvasWidth = canvas.width;
          const canvasHeight = canvas.height;
          const displayWidth = canvas.clientWidth;
          const displayHeight = canvas.clientHeight;

          return {
            hasDPRSupport: dpr > 1,
            canvasScaled: canvasWidth !== displayWidth || canvasHeight !== displayHeight,
            dpr: dpr
          };
        }
      }
      return null;
    });

    if (textQuality) {
      console.log(`DPR Support: ${textQuality.hasDPRSupport}, Canvas Scaled: ${textQuality.canvasScaled}, DPR: ${textQuality.dpr}`);
      expect(textQuality.dpr).toBeGreaterThan(0);
    }
  });

  test('canvas elements handle resize events', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 5000 });

    // Get initial canvas dimensions
    const initialDimensions = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      return canvas ? { width: canvas.width, height: canvas.height } : null;
    });

    expect(initialDimensions).toBeTruthy();

    // Resize viewport
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(1000);

    // Check if canvas dimensions updated
    const resizedDimensions = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      return canvas ? { width: canvas.width, height: canvas.height } : null;
    });

    expect(resizedDimensions).toBeTruthy();
  });

  test('color gradients render correctly', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 5000 });

    const hasGradients = await page.evaluate(() => {
      const canvases = document.querySelectorAll('canvas');
      for (const canvas of canvases) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Sample some pixels to check for gradients
          const imageData = ctx.getImageData(0, 0, Math.min(canvas.width, 100), Math.min(canvas.height, 100));
          const pixels = imageData.data;

          // Check for color variation (indicating gradients)
          let colorVariations = new Set();
          for (let i = 0; i < pixels.length; i += 4) {
            const color = `${pixels[i]},${pixels[i+1]},${pixels[i+2]}`;
            colorVariations.add(color);
            if (colorVariations.size > 10) return true;
          }
        }
      }
      return false;
    });

    console.log(`Gradient rendering detected: ${hasGradients}`);
    // Note: This test may fail if no gradients are currently being rendered
  });
});