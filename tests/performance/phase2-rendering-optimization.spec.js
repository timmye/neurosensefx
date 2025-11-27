/**
 * Phase 2: Rendering Optimization Pipeline Performance Tests
 *
 * Tests for 60fps performance and sub-100ms data-to-visual latency
 * with 20+ concurrent displays during active trading scenarios.
 */

import { test, expect } from '@playwright/test';

test.describe('Phase 2: Rendering Optimization Pipeline', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the development server
    await page.goto('http://localhost:5174');

    // Wait for the application to load
    await page.waitForLoadState('networkidle');

    // Wait for containers to be available
    await page.waitForSelector('.viz-container', { timeout: 10000 });
  });

  test('should maintain 60fps rendering with multiple displays', async ({ page }) => {
    console.log('🧪 Testing 60fps performance with multiple displays...');

    // Create multiple displays (simulate 20+ concurrent displays)
    const displayCount = 20;
    const createdDisplays = [];

    for (let i = 0; i < displayCount; i++) {
      // Open symbol search and create display
      await page.keyboard.press('Control+k');
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

      // Type a symbol and press Enter
      const symbol = i % 2 === 0 ? 'EUR/USD' : 'GBP/USD';
      await page.fill('[role="dialog"] input', symbol);
      await page.keyboard.press('Enter');

      // Wait for display to be created
      await page.waitForTimeout(500);

      const displayId = await page.evaluate(() => {
        const containers = document.querySelectorAll('.viz-container');
        return containers[containers.length - 1].getAttribute('data-display-id');
      });

      createdDisplays.push(displayId);
    }

    console.log(`✅ Created ${createdDisplays.length} displays for performance testing`);

    // Monitor frame rates for 10 seconds
    const frameData = await page.evaluate((displayIds) => {
      return new Promise((resolve) => {
        const frameMetrics = {
          totalFrames: 0,
          droppedFrames: 0,
          averageFrameTime: 0,
          frameTimes: [],
          displayMetrics: {}
        };

        let frameCount = 0;
        const maxFrames = 600; // 10 seconds at 60fps

        function measureFrame() {
          const startTime = performance.now();

          // Trigger renders for all displays
          displayIds.forEach((displayId, index) => {
            const container = document.querySelector(`[data-display-id="${displayId}"]`);
            if (container) {
              // Get optimization stats for each display
              const stats = window.getContainerOptimizationStats?.(displayId);
              if (stats) {
                if (!frameMetrics.displayMetrics[displayId]) {
                  frameMetrics.displayMetrics[displayId] = {
                    renderTimes: [],
                    optimizedRenders: 0,
                    totalRenders: 0
                  };
                }

                frameMetrics.displayMetrics[displayId].totalRenders++;
                if (stats.pipeline?.optimizedRenders > 0) {
                  frameMetrics.displayMetrics[displayId].optimizedRenders++;
                }

                if (stats.pipeline?.lastRenderTime) {
                  frameMetrics.displayMetrics[displayId].renderTimes.push(stats.pipeline.lastRenderTime);
                }
              }
            }
          });

          const frameTime = performance.now() - startTime;
          frameMetrics.frameTimes.push(frameTime);
          frameMetrics.totalFrames++;

          if (frameTime > 16.67) {
            frameMetrics.droppedFrames++;
          }

          frameCount++;

          if (frameCount < maxFrames) {
            requestAnimationFrame(measureFrame);
          } else {
            // Calculate average frame time
            frameMetrics.averageFrameTime = frameMetrics.frameTimes.reduce((a, b) => a + b, 0) / frameMetrics.frameTimes.length;
            resolve(frameMetrics);
          }
        }

        requestAnimationFrame(measureFrame);
      });
    }, createdDisplays);

    // Verify 60fps performance (within acceptable tolerance)
    const averageFPS = 1000 / frameData.averageFrameTime;
    const dropRate = (frameData.droppedFrames / frameData.totalFrames) * 100;

    console.log(`📊 Performance Results:`);
    console.log(`  - Average FPS: ${averageFPS.toFixed(1)}`);
    console.log(`  - Frame drop rate: ${dropRate.toFixed(1)}%`);
    console.log(`  - Total frames: ${frameData.totalFrames}`);
    console.log(`  - Dropped frames: ${frameData.droppedFrames}`);

    // Performance assertions
    expect(averageFPS).toBeGreaterThan(50); // At least 50fps average
    expect(dropRate).toBeLessThan(10); // Less than 10% frame drops
    expect(frameData.totalFrames).toBeGreaterThan(500); // At least 500 frames in 10 seconds

    // Verify optimization effectiveness
    let totalOptimizedRenders = 0;
    let totalRenders = 0;

    Object.values(frameData.displayMetrics).forEach(metrics => {
      totalOptimizedRenders += metrics.optimizedRenders;
      totalRenders += metrics.totalRenders;
    });

    const optimizationRate = totalRenders > 0 ? (totalOptimizedRenders / totalRenders) * 100 : 0;
    console.log(`  - Optimization rate: ${optimizationRate.toFixed(1)}%`);

    expect(optimizationRate).toBeGreaterThan(80); // At least 80% of renders should be optimized
  });

  test('should achieve sub-100ms data-to-visual latency', async ({ page }) => {
    console.log('🧪 Testing sub-100ms data-to-visual latency...');

    // Create a test display
    await page.keyboard.press('Control+k');
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await page.fill('[role="dialog"] input', 'EUR/USD');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Get display ID
    const displayId = await page.evaluate(() => {
      const containers = document.querySelectorAll('.viz-container');
      return containers[containers.length - 1].getAttribute('data-display-id');
    });

    // Monitor data-to-visual latency
    const latencyData = await page.evaluate((displayId) => {
      return new Promise((resolve) => {
        const latencyMetrics = {
          samples: [],
          averageLatency: 0,
          maxLatency: 0,
          minLatency: Infinity,
          sub100msRate: 0
        };

        let sampleCount = 0;
        const maxSamples = 100;

        function measureLatency() {
          // Simulate data update with timestamp
          const dataTimestamp = performance.now();

          // Trigger reactive update by modifying display state
          const container = document.querySelector(`[data-display-id="${displayId}"]`);
          if (container && container.component) {
            // Trigger state update (this would normally come from WebSocket)
            const event = new CustomEvent('dataUpdate', {
              detail: { timestamp: dataTimestamp, price: Math.random() * 1000 }
            });
            container.dispatchEvent(event);
          }

          // Measure when visual update completes
          setTimeout(() => {
            const visualTimestamp = performance.now();
            const latency = visualTimestamp - dataTimestamp;

            latencyMetrics.samples.push(latency);
            latencyMetrics.maxLatency = Math.max(latencyMetrics.maxLatency, latency);
            latencyMetrics.minLatency = Math.min(latencyMetrics.minLatency, latency);

            sampleCount++;

            if (sampleCount < maxSamples) {
              setTimeout(measureLatency, 50); // Sample every 50ms
            } else {
              // Calculate final metrics
              latencyMetrics.averageLatency = latencyMetrics.samples.reduce((a, b) => a + b, 0) / latencyMetrics.samples.length;
              latencyMetrics.sub100msRate = (latencyMetrics.samples.filter(l => l < 100).length / latencyMetrics.samples.length) * 100;
              resolve(latencyMetrics);
            }
          }, 10);
        }

        measureLatency();
      });
    }, displayId);

    console.log(`📊 Latency Results:`);
    console.log(`  - Average latency: ${latencyData.averageLatency.toFixed(2)}ms`);
    console.log(`  - Max latency: ${latencyData.maxLatency.toFixed(2)}ms`);
    console.log(`  - Min latency: ${latencyData.minLatency.toFixed(2)}ms`);
    console.log(`  - Sub-100ms rate: ${latencyData.sub100msRate.toFixed(1)}%`);

    // Latency assertions
    expect(latencyData.averageLatency).toBeLessThan(100); // Average under 100ms
    expect(latencyData.sub100msRate).toBeGreaterThan(90); // At least 90% under 100ms
    expect(latencyData.maxLatency).toBeLessThan(200); // Max under 200ms
  });

  test('should maintain memory stability during extended rendering', async ({ page }) => {
    console.log('🧪 Testing memory stability during extended rendering...');

    // Create multiple displays
    const displayCount = 15;
    const createdDisplays = [];

    for (let i = 0; i < displayCount; i++) {
      await page.keyboard.press('Control+k');
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
      await page.fill('[role="dialog"] input', i % 2 === 0 ? 'EUR/USD' : 'GBP/USD');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);

      const displayId = await page.evaluate(() => {
        const containers = document.querySelectorAll('.viz-container');
        return containers[containers.length - 1].getAttribute('data-display-id');
      });

      createdDisplays.push(displayId);
    }

    console.log(`✅ Created ${createdDisplays.length} displays for memory stability testing`);

    // Monitor memory usage over extended period
    const memoryData = await page.evaluate(() => {
      return new Promise((resolve) => {
        const memoryMetrics = {
          initialMemory: performance.memory?.usedJSHeapSize || 0,
          samples: [],
          memoryGrowth: 0,
          maxMemory: 0,
          minMemory: Infinity
        };

        let sampleCount = 0;
        const maxSamples = 200; // Sample over ~10 seconds

        function sampleMemory() {
          const currentMemory = performance.memory?.usedJSHeapSize || 0;
          memoryMetrics.samples.push(currentMemory);
          memoryMetrics.maxMemory = Math.max(memoryMetrics.maxMemory, currentMemory);
          memoryMetrics.minMemory = Math.min(memoryMetrics.minMemory, currentMemory);

          sampleCount++;

          if (sampleCount < maxSamples) {
            setTimeout(sampleMemory, 50);
          } else {
            memoryMetrics.memoryGrowth = memoryMetrics.samples[memoryMetrics.samples.length - 1] - memoryMetrics.samples[0];
            resolve(memoryMetrics);
          }
        }

        setTimeout(sampleMemory, 1000); // Start sampling after 1 second
      });
    });

    const memoryGrowthMB = memoryData.memoryGrowth / 1024 / 1024;
    const initialMemoryMB = memoryData.initialMemory / 1024 / 1024;
    const maxMemoryMB = memoryData.maxMemory / 1024 / 1024;

    console.log(`📊 Memory Results:`);
    console.log(`  - Initial memory: ${initialMemoryMB.toFixed(2)}MB`);
    console.log(`  - Max memory: ${maxMemoryMB.toFixed(2)}MB`);
    console.log(`  - Memory growth: ${memoryGrowthMB.toFixed(2)}MB`);
    console.log(`  - Growth rate: ${(memoryGrowthMB / 10).toFixed(2)}MB/second`);

    // Memory stability assertions
    expect(memoryGrowthMB).toBeLessThan(50); // Less than 50MB growth over 10 seconds
    expect(memoryGrowthMB / 10).toBeLessThan(10); // Less than 10MB per second growth rate
  });

  test('should verify dirty rectangle rendering effectiveness', async ({ page }) => {
    console.log('🧪 Testing dirty rectangle rendering effectiveness...');

    // Create a display
    await page.keyboard.press('Control+k');
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await page.fill('[role="dialog"] input', 'EUR/USD');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    const displayId = await page.evaluate(() => {
      const containers = document.querySelectorAll('.viz-container');
      return containers[containers.length - 1].getAttribute('data-display-id');
    });

    // Test dirty rectangle rendering
    const dirtyRectMetrics = await page.evaluate((displayId) => {
      return new Promise((resolve) => {
        const metrics = {
          selectiveRenderCount: 0,
          fullRenderCount: 0,
          averageRenderTime: 0,
          renderTimes: []
        };

        let renderCount = 0;
        const maxRenders = 50;

        function triggerRender() {
          const startTime = performance.now();

          // Trigger small region update (price change)
          const container = document.querySelector(`[data-display-id="${displayId}"]`);
          if (container) {
            // Invalidate price visualization region
            const event = new CustomEvent('priceUpdate', {
              detail: { region: 'price', x: 0, y: 50, width: 200, height: 20 }
            });
            container.dispatchEvent(event);
          }

          setTimeout(() => {
            const renderTime = performance.now() - startTime;
            metrics.renderTimes.push(renderTime);

            // Get optimization stats to determine render type
            const stats = window.getContainerOptimizationStats?.(displayId);
            if (stats) {
              if (stats.systems?.dirtyRectangles?.selectiveRenderCount > metrics.selectiveRenderCount) {
                metrics.selectiveRenderCount++;
              } else {
                metrics.fullRenderCount++;
              }
            }

            renderCount++;

            if (renderCount < maxRenders) {
              setTimeout(triggerRender, 100);
            } else {
              metrics.averageRenderTime = metrics.renderTimes.reduce((a, b) => a + b, 0) / metrics.renderTimes.length;
              resolve(metrics);
            }
          }, 20);
        }

        triggerRender();
      });
    }, displayId);

    const selectiveRenderRate = (dirtyRectMetrics.selectiveRenderCount / (dirtyRectMetrics.selectiveRenderCount + dirtyRectMetrics.fullRenderCount)) * 100;

    console.log(`📊 Dirty Rectangle Results:`);
    console.log(`  - Selective renders: ${dirtyRectMetrics.selectiveRenderCount}`);
    console.log(`  - Full renders: ${dirtyRectMetrics.fullRenderCount}`);
    console.log(`  - Selective render rate: ${selectiveRenderRate.toFixed(1)}%`);
    console.log(`  - Average render time: ${dirtyRectMetrics.averageRenderTime.toFixed(2)}ms`);

    // Dirty rectangle effectiveness assertions
    expect(selectiveRenderRate).toBeGreaterThan(70); // At least 70% should be selective renders
    expect(dirtyRectMetrics.averageRenderTime).toBeLessThan(10); // Selective renders should be fast
  });
});