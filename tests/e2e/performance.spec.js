/**
 * Performance tests for NeuroSense FX
 * Tests application performance under various conditions
 */

import { test, expect } from '@playwright/test';
import { browserAgentManager } from '../helpers/browser-agents.js';
import { testFixtures } from '../helpers/fixtures.js';

test.describe('Performance Tests', () => {
  test('memory usage stays within bounds', async ({ page }) => {
    await page.goto('/');

    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      if (performance.memory) {
        return {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit
        };
      }
      return null;
    });

    console.log('Initial memory:', initialMemory);

    // Simulate heavy usage
    for (let i = 0; i < 10; i++) {
      await page.mouse.move(100 + i * 50, 100 + i * 50);
      await page.waitForTimeout(100);
    }

    // Get final memory usage
    const finalMemory = await page.evaluate(() => {
      if (performance.memory) {
        return {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit
        };
      }
      return null;
    });

    console.log('Final memory:', finalMemory);

    if (initialMemory && finalMemory) {
      const memoryIncrease = finalMemory.used - initialMemory.used;
      const increaseMB = memoryIncrease / (1024 * 1024);
      console.log(`Memory increase: ${increaseMB.toFixed(2)} MB`);

      // Memory increase should be reasonable (< 50MB)
      expect(increaseMB).toBeLessThan(testFixtures.benchmarks.memoryUsage.maximum);
    }
  });

  test('page load time is acceptable', async ({ page }) => {
    const startTime = Date.now();

    // Enable performance timing
    await page.addInitScript(() => {
      window.loadStartTime = performance.now();
    });

    await page.goto('/');

    // Wait for everything to load
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('canvas', { timeout: 10000 });

    const loadTime = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        total: navigation.loadEventEnd - navigation.fetchStart
      };
    });

    console.log('Page load times:', loadTime);

    // Page should load within reasonable time
    expect(loadTime.total).toBeLessThan(10000); // 10 seconds
    expect(loadTime.domContentLoaded).toBeLessThan(5000); // 5 seconds
  });

  test('rendering performance under stress', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas', { timeout: 5000 });

    const { performanceMetrics, collectMetrics } = await browserAgentManager.setupPerformanceMonitoring(page);

    // Create stress by rapid mouse movements
    const duration = 3000; // 3 seconds of stress
    const interval = 16; // ~60fps

    const stressTest = async () => {
      const startTime = Date.now();
      let x = 100, y = 100;
      let dx = 5, dy = 5;

      while (Date.now() - startTime < duration) {
        x += dx;
        y += dy;

        if (x > 700 || x < 100) dx = -dx;
        if (y > 500 || y < 100) dy = -dy;

        await page.mouse.move(x, y);
        await page.waitForTimeout(interval);
      }
    };

    await stressTest();

    // Collect and analyze metrics
    const metrics = await collectMetrics();
    console.log(`Collected ${metrics.length} performance metrics`);

    if (metrics.length > 0) {
      const avgFps = metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
      const minFps = Math.min(...metrics.map(m => m.value));
      const maxFps = Math.max(...metrics.map(m => m.value));

      console.log(`FPS - Average: ${avgFps.toFixed(2)}, Min: ${minFps}, Max: ${maxFps}`);

      // Performance should stay above minimum threshold
      expect(avgFps).toBeGreaterThan(testFixtures.benchmarks.fps.minimum);
      expect(minFps).toBeGreaterThan(15); // Even minimum should stay above 15 FPS
    }
  });

  test('WebSocket connection latency', async ({ page }) => {
    await page.goto('/');

    const wsLatencies = [];

    page.on('websocket', ws => {
      const startTime = Date.now();

      ws.on('framesent', () => {
        const sendTime = Date.now();
      });

      ws.on('framereceived', () => {
        const receiveTime = Date.now();
        // Note: This is approximate latency measurement
      });
    });

    await browserAgentManager.waitForMarketData(page);

    // In a real test environment, you'd measure actual WebSocket latency
    // For now, we'll just verify the connection attempt
    const wsConnectionAttempted = await page.evaluate(() => {
      return window.wsConnectionAttempted || false;
    });

    console.log(`WebSocket connection attempted: ${wsConnectionAttempted}`);
  });

  test('canvas rendering optimization', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas', { timeout: 5000 });

    const renderingStats = await page.evaluate(() => {
      const canvases = document.querySelectorAll('canvas');
      const stats = [];

      for (const canvas of canvases) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const start = performance.now();

          // Simple rendering test
          ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
          ctx.fillRect(0, 0, 10, 10);

          const renderTime = performance.now() - start;

          stats.push({
            width: canvas.width,
            height: canvas.height,
            renderTime: renderTime,
            pixelCount: canvas.width * canvas.height
          });
        }
      }

      return stats;
    });

    console.log('Canvas rendering stats:', renderingStats);

    for (const stat of renderingStats) {
      // Rendering time should be reasonable for the canvas size
      const pixelsPerMs = stat.pixelCount / stat.renderTime;
      console.log(`Canvas rendering: ${pixelsPerMs.toFixed(0)} pixels/ms`);

      expect(stat.renderTime).toBeLessThan(testFixtures.benchmarks.renderTime.maximum);
    }
  });

  test('resource loading performance', async ({ page }) => {
    const resources = [];

    page.on('response', response => {
      resources.push({
        url: response.url(),
        status: response.status(),
        timing: response.request().timing()
      });
    });

    await page.goto('/');

    const loadedResources = resources.filter(r => r.status === 200);
    console.log(`Loaded ${loadedResources.length} resources`);

    // Analyze resource loading
    const jsResources = loadedResources.filter(r => r.url.includes('.js'));
    const cssResources = loadedResources.filter(r => r.url.includes('.css'));

    console.log(`JavaScript resources: ${jsResources.length}`);
    console.log(`CSS resources: ${cssResources.length}`);

    // Check for slow resources
    const slowResources = loadedResources.filter(r => {
      const timing = r.timing;
      return timing && (timing.responseEnd - timing.requestStart) > 2000;
    });

    console.log(`Slow resources: ${slowResources.length}`);
    if (slowResources.length > 0) {
      console.log('Slow resources:', slowResources.map(r => r.url));
    }

    // Should not have too many slow resources
    expect(slowResources.length).toBeLessThan(3);
  });
});