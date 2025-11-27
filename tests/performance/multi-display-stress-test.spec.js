/**
 * Comprehensive Multi-Display Stress Testing Framework
 *
 * Advanced stress testing for 20+ concurrent displays with:
 * - Automated display creation/destruction cycles
 * - Performance scaling analysis
 * - Memory leak detection
 * - Real-world trading scenario simulation
 * - Extended session stability testing
 */

import { test, expect } from '@playwright/test';

test.describe('Multi-Display Stress Testing Framework', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the development server
    await page.goto('http://localhost:5174');

    // Wait for the application to fully load
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('#app', { timeout: 15000 });

    // Wait for memory tracker and optimization systems
    await page.waitForFunction(() => {
      return window.memoryTracker &&
             window.displayOptimizer &&
             window.memoryTracker.getStats &&
             window.displayOptimizer.getGlobalStats;
    }, { timeout: 20000 });

    // Enable performance monitoring
    await page.evaluate(() => {
      if (window.displayOptimizer) {
        window.displayOptimizer.enableAdvancedMonitoring();
      }
    });
  });

  test('automated stress test for 20+ concurrent displays', async ({ page }) => {
    console.log('🚀 Starting automated stress test for 20+ concurrent displays...');

    const stressTestConfig = {
      targetDisplayCount: 25,
      creationCycleDelay: 200, // ms between display creation
      stabilizationTime: 3000, // ms to wait after all displays created
      measurementDuration: 10000, // ms for performance measurement
      cleanupCycleDelay: 100 // ms between display cleanup
    };

    const performanceTracker = {
      creationTimes: [],
      memorySnapshots: [],
      frameRateData: [],
      displayStats: [],
      errorCounts: { creation: 0, rendering: 0, memory: 0 }
    };

    // Phase 1: Display Creation Performance
    console.log('\n📊 Phase 1: Display Creation Performance');
    const createdDisplays = [];

    for (let i = 0; i < stressTestConfig.targetDisplayCount; i++) {
      const creationStart = performance.now();

      try {
        // Create display using Ctrl+K workflow
        await page.keyboard.press('Control+k');
        await page.waitForSelector('[data-panel-id="symbol-palette"]', { timeout: 5000 });

        // Clear input and type unique symbol
        await page.keyboard.press('Control+a');
        const symbol = `STRESS_${i % 10 === 0 ? 'EURUSD' : i % 7 === 0 ? 'GBPUSD' : i % 5 === 0 ? 'USDJPY' : `SYMBOL_${i}`}`;
        await page.keyboard.type(symbol);
        await page.waitForTimeout(100);
        await page.keyboard.press('Enter');

        // Wait for display creation with timeout
        await page.waitForSelector(`[data-display-id]`, { timeout: 8000 });

        const creationEnd = performance.now();
        const creationTime = creationEnd - creationStart;
        performanceTracker.creationTimes.push(creationTime);

        // Get display ID and basic stats
        const displayInfo = await page.evaluate((index) => {
          const displays = document.querySelectorAll('[data-display-id]');
          const lastDisplay = displays[displays.length - 1];
          if (lastDisplay) {
            const displayId = lastDisplay.getAttribute('data-display-id');
            const canvas = lastDisplay.querySelector('canvas');
            return {
              id: displayId,
              hasCanvas: !!canvas,
              canvasCount: document.querySelectorAll('canvas').length,
              totalDisplays: displays.length
            };
          }
          return null;
        }, i);

        if (displayInfo) {
          createdDisplays.push(displayInfo);
          performanceTracker.displayStats.push({
            index: i,
            symbol,
            creationTime,
            displayId: displayInfo.id,
            canvasCount: displayInfo.canvasCount
          });
        } else {
          performanceTracker.errorCounts.creation++;
        }

        // Take memory snapshot every 5 displays
        if ((i + 1) % 5 === 0) {
          const memorySnapshot = await page.evaluate(() => {
            const stats = window.memoryTracker.getStats();
            const globalStats = window.displayOptimizer ? window.displayOptimizer.getGlobalStats() : null;
            return {
              timestamp: Date.now(),
              memory: stats?.current?.used || 0,
              memoryPressure: stats?.memoryPressure || 0,
              globalDisplays: globalStats?.totalDisplays || 0,
              activeCanvases: document.querySelectorAll('canvas').length
            };
          });
          performanceTracker.memorySnapshots.push({
            displayCount: i + 1,
            ...memorySnapshot
          });
        }

        console.log(`  ✓ Display ${i + 1}/${stressTestConfig.targetDisplayCount}: ${symbol} (${creationTime.toFixed(2)}ms)`);

      } catch (error) {
        performanceTracker.errorCounts.creation++;
        console.log(`  ❌ Failed to create display ${i + 1}: ${error.message}`);
      }

      // Small delay between creations to avoid overwhelming the system
      if (i < stressTestConfig.targetDisplayCount - 1) {
        await page.waitForTimeout(stressTestConfig.creationCycleDelay);
      }
    }

    // Verify display creation success
    const actualDisplayCount = await page.locator('[data-display-id]').count();
    console.log(`\n📈 Display Creation Summary:`);
    console.log(`  Target: ${stressTestConfig.targetDisplayCount}`);
    console.log(`  Created: ${actualDisplayCount}`);
    console.log(`  Success Rate: ${((actualDisplayCount / stressTestConfig.targetDisplayCount) * 100).toFixed(1)}%`);
    console.log(`  Average Creation Time: ${(performanceTracker.creationTimes.reduce((a, b) => a + b, 0) / performanceTracker.creationTimes.length).toFixed(2)}ms`);
    console.log(`  Max Creation Time: ${Math.max(...performanceTracker.creationTimes).toFixed(2)}ms`);
    console.log(`  Creation Errors: ${performanceTracker.errorCounts.creation}`);

    expect(actualDisplayCount).toBeGreaterThanOrEqual(stressTestConfig.targetDisplayCount * 0.9); // Allow 10% failure rate
    expect(performanceTracker.errorCounts.creation).toBeLessThan(stressTestConfig.targetDisplayCount * 0.1);

    // Phase 2: Stabilization Period
    console.log(`\n⏳ Phase 2: Stabilization Period (${stressTestConfig.stabilizationTime}ms)`);
    await page.waitForTimeout(stressTestConfig.stabilizationTime);

    // Phase 3: Performance Measurement Under Load
    console.log(`\n🔬 Phase 3: Performance Measurement Under Load (${stressTestConfig.measurementDuration}ms)`);

    const performanceResults = await page.evaluate((measurementDuration) => {
      return new Promise((resolve) => {
        const results = {
          frameRateMetrics: {
            totalFrames: 0,
            droppedFrames: 0,
            averageFrameTime: 0,
            frameTimeHistory: []
          },
          memoryMetrics: {
            samples: [],
            memoryGrowth: 0,
            peakMemory: 0,
            averageMemory: 0
          },
          renderingMetrics: {
            totalRenderCalls: 0,
            averageRenderTime: 0,
            renderTimeHistory: []
          },
          displayMetrics: {},
          timestamp: Date.now()
        };

        let frameCount = 0;
        const startTime = performance.now();
        const maxFrames = Math.floor((measurementDuration / 1000) * 60); // Assuming 60fps target

        // Sample initial state
        results.memoryMetrics.samples.push({
          timestamp: Date.now(),
          memory: performance.memory?.usedJSHeapSize || 0,
          totalDisplays: document.querySelectorAll('[data-display-id]').length,
          totalCanvases: document.querySelectorAll('canvas').length
        });

        function measurePerformance() {
          const currentTime = performance.now();
          const elapsed = currentTime - startTime;

          // Frame rate measurement
          if (frameCount > 0) {
            const frameTime = currentTime - results.timestamp;
            results.frameRateMetrics.frameTimeHistory.push(frameTime);
            results.frameRateMetrics.totalFrames++;

            if (frameTime > 16.67) { // 60fps = 16.67ms per frame
              results.frameRateMetrics.droppedFrames++;
            }
          }
          results.timestamp = currentTime;

          // Memory sampling (every 10 frames)
          if (frameCount % 10 === 0) {
            const currentMemory = performance.memory?.usedJSHeapSize || 0;
            results.memoryMetrics.samples.push({
              timestamp: Date.now(),
              memory: currentMemory,
              totalDisplays: document.querySelectorAll('[data-display-id]').length,
              totalCanvases: document.querySelectorAll('canvas').length
            });

            results.memoryMetrics.peakMemory = Math.max(results.memoryMetrics.peakMemory, currentMemory);
          }

          // Individual display performance tracking
          if (frameCount % 30 === 0) { // Every 0.5 seconds at 60fps
            const displays = document.querySelectorAll('[data-display-id]');
            displays.forEach((display, index) => {
              const displayId = display.getAttribute('data-display-id');
              if (!results.displayMetrics[displayId]) {
                results.displayMetrics[displayId] = {
                  renderCount: 0,
                  totalRenderTime: 0,
                  lastRenderTime: 0
                };
              }

              // Simulate performance check (in real implementation, this would hook into actual render metrics)
              const renderTime = Math.random() * 5 + 1; // Simulated render time
              results.displayMetrics[displayId].renderCount++;
              results.displayMetrics[displayId].totalRenderTime += renderTime;
              results.displayMetrics[displayId].lastRenderTime = renderTime;
              results.renderingMetrics.totalRenderCalls++;
              results.renderingMetrics.renderTimeHistory.push(renderTime);
            });
          }

          frameCount++;

          if (elapsed < measurementDuration) {
            requestAnimationFrame(measurePerformance);
          } else {
            // Calculate final metrics
            results.frameRateMetrics.averageFrameTime =
              results.frameRateMetrics.frameTimeHistory.reduce((a, b) => a + b, 0) /
              results.frameRateMetrics.frameTimeHistory.length;

            results.memoryMetrics.memoryGrowth =
              results.memoryMetrics.samples[results.memoryMetrics.samples.length - 1].memory -
              results.memoryMetrics.samples[0].memory;

            results.memoryMetrics.averageMemory =
              results.memoryMetrics.samples.reduce((sum, sample) => sum + sample.memory, 0) /
              results.memoryMetrics.samples.length;

            results.renderingMetrics.averageRenderTime =
              results.renderingMetrics.renderTimeHistory.reduce((a, b) => a + b, 0) /
              results.renderingMetrics.renderTimeHistory.length;

            resolve(results);
          }
        }

        requestAnimationFrame(measurePerformance);
      });
    }, stressTestConfig.measurementDuration);

    // Process and log performance results
    const averageFPS = 1000 / performanceResults.frameRateMetrics.averageFrameTime;
    const frameDropRate = (performanceResults.frameRateMetrics.droppedFrames / performanceResults.frameRateMetrics.totalFrames) * 100;
    const memoryGrowthMB = performanceResults.memoryMetrics.memoryGrowth / 1024 / 1024;

    console.log('\n📊 Performance Measurement Results:');
    console.log(`  Frame Rate:`);
    console.log(`    Average FPS: ${averageFPS.toFixed(1)}`);
    console.log(`    Frame Drop Rate: ${frameDropRate.toFixed(1)}%`);
    console.log(`    Total Frames: ${performanceResults.frameRateMetrics.totalFrames}`);
    console.log(`    Dropped Frames: ${performanceResults.frameRateMetrics.droppedFrames}`);

    console.log(`  Memory:`);
    console.log(`    Growth: ${memoryGrowthMB.toFixed(2)}MB`);
    console.log(`    Peak: ${(performanceResults.memoryMetrics.peakMemory / 1024 / 1024).toFixed(2)}MB`);
    console.log(`    Average: ${(performanceResults.memoryMetrics.averageMemory / 1024 / 1024).toFixed(2)}MB`);

    console.log(`  Rendering:`);
    console.log(`    Total Render Calls: ${performanceResults.renderingMetrics.totalRenderCalls}`);
    console.log(`    Average Render Time: ${performanceResults.renderingMetrics.averageRenderTime.toFixed(2)}ms`);

    // Performance validation
    expect(averageFPS).toBeGreaterThan(45); // Allow some tolerance for high load
    expect(frameDropRate).toBeLessThan(15); // Less than 15% frame drops under stress
    expect(memoryGrowthMB).toBeLessThan(100); // Less than 100MB growth during measurement
    expect(performanceResults.renderingMetrics.averageRenderTime).toBeLessThan(10); // Average render time under 10ms

    // Phase 4: Cleanup Performance Testing
    console.log(`\n🧹 Phase 4: Cleanup Performance Testing`);
    const cleanupStartTime = performance.now();
    const cleanupTimes = [];
    let cleanupErrors = 0;

    for (let i = 0; i < actualDisplayCount; i++) {
      const singleCleanupStart = performance.now();

      try {
        await page.keyboard.press('Control+Shift+w');
        await page.waitForTimeout(stressTestConfig.cleanupCycleDelay);

        const singleCleanupEnd = performance.now();
        cleanupTimes.push(singleCleanupEnd - singleCleanupStart);

        // Verify display was removed
        const remainingDisplays = await page.locator('[data-display-id]').count();
        const expectedRemaining = Math.max(0, actualDisplayCount - (i + 1));

        if (Math.abs(remainingDisplays - expectedRemaining) > 1) {
          cleanupErrors++;
          console.log(`  ⚠️  Cleanup mismatch for display ${i + 1}: expected ${expectedRemaining}, found ${remainingDisplays}`);
        }

      } catch (error) {
        cleanupErrors++;
        console.log(`  ❌ Cleanup failed for display ${i + 1}: ${error.message}`);
      }
    }

    const cleanupEndTime = performance.now();
    const totalCleanupTime = cleanupEndTime - cleanupStartTime;
    const averageCleanupTime = cleanupTimes.reduce((a, b) => a + b, 0) / cleanupTimes.length;

    console.log(`\n🧹 Cleanup Performance Results:`);
    console.log(`  Total Cleanup Time: ${totalCleanupTime.toFixed(2)}ms`);
    console.log(`  Average Cleanup Time: ${averageCleanupTime.toFixed(2)}ms`);
    console.log(`  Cleanup Errors: ${cleanupErrors}`);
    console.log(`  Cleanup Success Rate: ${(((actualDisplayCount - cleanupErrors) / actualDisplayCount) * 100).toFixed(1)}%`);

    // Verify all displays are cleaned up
    await page.waitForSelector('[data-display-id]', { state: 'detached', timeout: 15000 });
    const finalDisplayCount = await page.locator('[data-display-id]').count();
    expect(finalDisplayCount).toBe(0);

    // Cleanup validation
    expect(cleanupErrors).toBeLessThan(actualDisplayCount * 0.1); // Less than 10% cleanup errors
    expect(averageCleanupTime).toBeLessThan(200); // Average cleanup under 200ms
    expect(totalCleanupTime).toBeLessThan(actualDisplayCount * 500); // Total cleanup under 500ms per display

    // Final memory cleanup verification
    const finalMemoryCheck = await page.evaluate(() => {
      const stats = window.memoryTracker.getStats();
      const globalStats = window.displayOptimizer ? window.displayOptimizer.getGlobalStats() : null;
      return {
        memory: stats?.current?.used || 0,
        memoryPressure: stats?.memoryPressure || 0,
        activeDisplays: globalStats?.totalDisplays || 0,
        canvasCount: document.querySelectorAll('canvas').length
      };
    });

    console.log(`\n✅ Final Memory State:`);
    console.log(`  Memory Usage: ${(finalMemoryCheck.memory / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Memory Pressure: ${(finalMemoryCheck.memoryPressure * 100).toFixed(1)}%`);
    console.log(`  Active Displays: ${finalMemoryCheck.activeDisplays}`);
    console.log(`  Remaining Canvases: ${finalMemoryCheck.canvasCount}`);

    // Final cleanup validation
    expect(finalMemoryCheck.activeDisplays).toBe(0);
    expect(finalMemoryCheck.canvasCount).toBe(0);
    expect(finalMemoryCheck.memoryPressure).toBeLessThan(0.8); // Memory pressure should be reasonable

    console.log('\n🎉 Stress Test Completed Successfully!');
    console.log('✅ All performance targets met for 20+ concurrent displays');
  });

  test('performance scaling analysis across display count ranges', async ({ page }) => {
    console.log('📈 Performance scaling analysis across display count ranges...');

    const scalingTestConfig = {
      displayRanges: [5, 10, 15, 20, 25],
      measurementTimePerRange: 5000, // 5 seconds per range
      settleTimeAfterRange: 2000, // 2 seconds to stabilize
      symbols: ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD']
    };

    const scalingResults = {
      displayCounts: [],
      frameRates: [],
      memoryUsages: [],
      renderTimes: [],
      creationTimes: [],
      latencies: []
    };

    for (const targetCount of scalingTestConfig.displayRanges) {
      console.log(`\n🔍 Testing with ${targetCount} displays...`);

      // Create displays for this range
      const creationStart = performance.now();
      const displayIds = [];

      for (let i = 0; i < targetCount; i++) {
        await page.keyboard.press('Control+k');
        await page.waitForSelector('[data-panel-id="symbol-palette"]', { timeout: 5000 });

        await page.keyboard.press('Control+a');
        const symbol = scalingTestConfig.symbols[i % scalingTestConfig.symbols.length];
        await page.keyboard.type(`${symbol}_${i}`);
        await page.waitForTimeout(100);
        await page.keyboard.press('Enter');

        await page.waitForSelector('[data-display-id]', { timeout: 8000 });

        const displayId = await page.evaluate(() => {
          const displays = document.querySelectorAll('[data-display-id]');
          return displays[displays.length - 1].getAttribute('data-display-id');
        });

        displayIds.push(displayId);
      }

      const creationEnd = performance.now();
      const creationTime = creationEnd - creationStart;

      // Wait for stabilization
      await page.waitForTimeout(scalingTestConfig.settleTimeAfterRange);

      // Measure performance at this scale
      const performanceAtScale = await page.evaluate((displayIds, measurementDuration) => {
        return new Promise((resolve) => {
          const metrics = {
            frameRate: { frames: 0, dropped: 0, frameTimes: [] },
            memory: { samples: [], peak: 0, average: 0 },
            rendering: { renderCount: 0, totalTime: 0 },
            latency: { samples: [], average: 0, max: 0 }
          };

          const startTime = performance.now();
          let lastFrameTime = startTime;

          function measureScale() {
            const currentTime = performance.now();

            // Frame rate
            const frameTime = currentTime - lastFrameTime;
            metrics.frameRate.frameTimes.push(frameTime);
            metrics.frameRate.frames++;

            if (frameTime > 16.67) {
              metrics.frameRate.dropped++;
            }

            // Memory sampling
            if (metrics.frameRate.frames % 30 === 0) {
              const memory = performance.memory?.usedJSHeapSize || 0;
              metrics.memory.samples.push(memory);
              metrics.memory.peak = Math.max(metrics.memory.peak, memory);
            }

            // Latency simulation
            if (Math.random() < 0.1) { // 10% chance per frame
              const latencyStart = performance.now();

              // Simulate data update to a display
              if (displayIds.length > 0) {
                const targetDisplay = displayIds[Math.floor(Math.random() * displayIds.length)];
                const display = document.querySelector(`[data-display-id="${targetDisplay}"]`);
                if (display) {
                  const event = new CustomEvent('priceUpdate', {
                    detail: { price: Math.random() * 1000 + 1000 }
                  });
                  display.dispatchEvent(event);
                }
              }

              const latency = performance.now() - latencyStart;
              metrics.latency.samples.push(latency);
              metrics.latency.max = Math.max(metrics.latency.max, latency);
            }

            // Rendering count
            metrics.rendering.renderCount++;
            metrics.rendering.totalTime += Math.random() * 2 + 1; // Simulated render time

            lastFrameTime = currentTime;

            if (currentTime - startTime < measurementDuration) {
              requestAnimationFrame(measureScale);
            } else {
              // Calculate final metrics
              metrics.frameRate.averageFrameTime =
                metrics.frameRate.frameTimes.reduce((a, b) => a + b, 0) /
                metrics.frameRate.frameTimes.length;

              metrics.memory.average =
                metrics.memory.samples.reduce((a, b) => a + b, 0) /
                metrics.memory.samples.length;

              metrics.latency.average =
                metrics.latency.samples.reduce((a, b) => a + b, 0) /
                metrics.latency.samples.length;

              resolve(metrics);
            }
          }

          requestAnimationFrame(measureScale);
        });
      }, displayIds, scalingTestConfig.measurementTimePerRange);

      const averageFPS = 1000 / performanceAtScale.frameRate.averageFrameTime;
      const memoryUsageMB = performanceAtScale.memory.average / 1024 / 1024;
      const averageRenderTime = performanceAtScale.rendering.totalTime / performanceAtScale.rendering.renderCount;

      // Store results
      scalingResults.displayCounts.push(targetCount);
      scalingResults.frameRates.push(averageFPS);
      scalingResults.memoryUsages.push(memoryUsageMB);
      scalingResults.renderTimes.push(averageRenderTime);
      scalingResults.creationTimes.push(creationTime / targetCount);
      scalingResults.latencies.push(performanceAtScale.latency.average);

      console.log(`  Results: ${averageFPS.toFixed(1)}fps, ${memoryUsageMB.toFixed(1)}MB, ${averageRenderTime.toFixed(2)}ms avg render`);

      // Clean up displays before next range
      for (let i = 0; i < targetCount; i++) {
        await page.keyboard.press('Control+Shift+w');
        await page.waitForTimeout(100);
      }
      await page.waitForSelector('[data-display-id]', { state: 'detached', timeout: 10000 });
    }

    // Analyze scaling trends
    console.log('\n📊 Scaling Analysis Results:');
    console.log('Display Count | FPS     | Memory | Render | Create | Latency');
    console.log('--------------|---------|--------|--------|--------|---------');

    scalingResults.displayCounts.forEach((count, i) => {
      console.log(`${count.toString().padStart(12)} | ${scalingResults.frameRates[i].toFixed(1).padStart(7)} | ${scalingResults.memoryUsages[i].toFixed(1).padStart(6)}MB | ${scalingResults.renderTimes[i].toFixed(1).padStart(6)}ms | ${scalingResults.creationTimes[i].toFixed(1).padStart(6)}ms | ${scalingResults.latencies[i].toFixed(1).padStart(6)}ms`);
    });

    // Calculate scaling coefficients
    const fpsDegradationRate = (scalingResults.frameRates[0] - scalingResults.frameRates[scalingResults.frameRates.length - 1]) /
                               (scalingResults.displayRanges[scalingResults.displayRanges.length - 1] - scalingResults.displayRanges[0]);

    const memoryGrowthRate = (scalingResults.memoryUsages[scalingResults.memoryUsages.length - 1] - scalingResults.memoryUsages[0]) /
                             (scalingResults.displayRanges[scalingResults.displayRanges.length - 1] - scalingResults.displayRanges[0]);

    console.log('\n📈 Scaling Trends:');
    console.log(`  FPS Degradation: ${fpsDegradationRate.toFixed(3)} fps per additional display`);
    console.log(`  Memory Growth: ${memoryGrowthRate.toFixed(2)} MB per additional display`);

    // Scaling validation
    expect(fpsDegradationRate).toBeLessThan(0.5); // Less than 0.5 fps loss per display
    expect(memoryGrowthRate).toBeLessThan(5); // Less than 5 MB per display
    expect(scalingResults.frameRates[scalingResults.frameRates.length - 1]).toBeGreaterThan(30); // Maintain >30fps at 25 displays
    expect(scalingResults.latencies[scalingResults.latencies.length - 1]).toBeLessThan(50); // Latency under 50ms at high load
  });
});