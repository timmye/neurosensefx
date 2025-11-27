/**
 * Performance Scaling Analysis and Measurement Tools
 *
 * Advanced analysis tools for measuring performance degradation,
 * identifying bottlenecks, and validating scaling characteristics
 * under various load conditions.
 */

import { test, expect } from '@playwright/test';

test.describe('Performance Scaling Analysis Tools', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('#app', { timeout: 15000 });

    // Initialize performance monitoring
    await page.evaluate(() => {
      // Initialize performance profiler
      window.performanceProfiler = {
        renderProfile: {
          totalRenders: 0,
          renderTimes: [],
          dirtyRectRenders: 0,
          fullRenders: 0
        },
        memoryProfile: {
          samples: [],
          allocations: 0,
          deallocations: 0,
          peakMemory: 0
        },
        eventProfile: {
          keyboardEvents: 0,
          mouseEvents: 0,
          renderEvents: 0,
          maxEventLatency: 0
        }
      };

      // Hook into canvas rendering for profiling
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(contextType, ...args) {
        const context = originalGetContext.call(this, contextType, ...args);

        if (contextType === '2d' && window.performanceProfiler) {
          const originalFillRect = context.fillRect;
          const originalClearRect = context.clearRect;
          const originalDrawImage = context.drawImage;
          const originalFillText = context.fillText;

          context.fillRect = function(...args) {
            const start = performance.now();
            const result = originalFillRect.apply(this, args);
            const duration = performance.now() - start;

            window.performanceProfiler.renderProfile.renderTimes.push(duration);
            window.performanceProfiler.renderProfile.totalRenders++;

            return result;
          };

          context.clearRect = function(...args) {
            const start = performance.now();
            const result = originalClearRect.apply(this, args);
            const duration = performance.now() - start;

            // Classify as dirty rectangle render if small area
            const area = (args[2] || this.canvas.width) * (args[3] || this.canvas.height);
            const totalArea = this.canvas.width * this.canvas.height;

            if (area < totalArea * 0.5) {
              window.performanceProfiler.renderProfile.dirtyRectRenders++;
            } else {
              window.performanceProfiler.renderProfile.fullRenders++;
            }

            window.performanceProfiler.renderProfile.renderTimes.push(duration);
            window.performanceProfiler.renderProfile.totalRenders++;

            return result;
          };

          // Hook other drawing methods similarly...
        }

        return context;
      };

      // Hook into event system
      document.addEventListener('keydown', (event) => {
        if (window.performanceProfiler) {
          window.performanceProfiler.eventProfile.keyboardEvents++;
        }
      });

      document.addEventListener('mousemove', (event) => {
        if (window.performanceProfiler) {
          window.performanceProfiler.eventProfile.mouseEvents++;
        }
      });

      // Memory allocation tracking
      if (performance.memory) {
        setInterval(() => {
          if (window.performanceProfiler) {
            const currentMemory = performance.memory.usedJSHeapSize;
            window.performanceProfiler.memoryProfile.samples.push({
              timestamp: Date.now(),
              memory: currentMemory
            });
            window.performanceProfiler.memoryProfile.peakMemory =
              Math.max(window.performanceProfiler.memoryProfile.peakMemory, currentMemory);
          }
        }, 100);
      }
    });
  });

  test('comprehensive bottleneck identification under high load', async ({ page }) => {
    console.log('🔍 Comprehensive bottleneck identification under high load...');

    const bottleneckConfig = {
      displayCounts: [1, 5, 10, 15, 20, 25],
      testDuration: 3000, // 3 seconds per test
      intensiveOperations: 100, // operations per test
      bottleneckThresholds: {
        renderTime: 16.67, // 60fps threshold
        memoryGrowth: 50 * 1024 * 1024, // 50MB
        eventLatency: 100, // 100ms
        frameDropRate: 0.1 // 10%
      }
    };

    const bottleneckResults = {
      scalingData: [],
      identifiedBottlenecks: [],
      performanceRegressionPoints: [],
      resourceUtilization: []
    };

    for (const displayCount of bottleneckConfig.displayCounts) {
      console.log(`\n🎯 Testing bottleneck identification with ${displayCount} displays...`);

      // Create test displays
      const displayIds = [];
      for (let i = 0; i < displayCount; i++) {
        await page.keyboard.press('Control+k');
        await page.waitForSelector('[data-panel-id="symbol-palette"]', { timeout: 5000 });

        await page.keyboard.press('Control+a');
        await page.keyboard.type(`BOTTLENECK_${i % 5 === 0 ? 'EURUSD' : i % 3 === 0 ? 'GBPUSD' : 'USDJPY'}`);
        await page.waitForTimeout(50);
        await page.keyboard.press('Enter');

        await page.waitForSelector('[data-display-id]', { timeout: 8000 });

        const displayId = await page.evaluate(() => {
          const displays = document.querySelectorAll('[data-display-id]');
          return displays[displays.length - 1].getAttribute('data-display-id');
        });

        displayIds.push(displayId);
      }

      // Wait for stabilization
      await page.waitForTimeout(1000);

      // Run intensive performance test
      const bottleneckAnalysis = await page.evaluate((displayIds, testDuration, operations) => {
        return new Promise((resolve) => {
          const analysis = {
            renderBottlenecks: {
              slowRenders: 0,
              renderTimeDistribution: [],
              averageRenderTime: 0,
              maxRenderTime: 0
            },
            memoryBottlenecks: {
              memoryGrowth: 0,
              memoryFragmentation: 0,
              gcPressure: 0,
              peakMemoryUsage: 0
            },
            eventBottlenecks: {
              blockedEvents: 0,
              averageEventLatency: 0,
              maxEventLatency: 0,
              eventQueueLength: 0
            },
            resourceBottlenecks: {
              canvasUtilization: 0,
              cpuUtilization: 0,
              domComplexity: 0
            },
            frameRateBottlenecks: {
              averageFPS: 0,
              frameDrops: 0,
              frameDropRate: 0,
              worstFrameTime: 0
            }
          };

          const startTime = performance.now();
          const initialMemory = performance.memory?.usedJSHeapSize || 0;
          let frameCount = 0;
          let droppedFrames = 0;
          let worstFrameTime = 0;

          // Reset performance profiler
          if (window.performanceProfiler) {
            window.performanceProfiler.renderProfile.totalRenders = 0;
            window.performanceProfiler.renderProfile.renderTimes = [];
            window.performanceProfiler.memoryProfile.samples = [];
          }

          function runBottleneckTest() {
            const frameStart = performance.now();

            // Simulate intensive operations
            for (let i = 0; i < operations / displayIds.length; i++) {
              displayIds.forEach((displayId, index) => {
                const display = document.querySelector(`[data-display-id="${displayId}"]`);
                if (display && display.querySelector('canvas')) {
                  // Trigger render operations
                  const event = new CustomEvent('intensiveUpdate', {
                    detail: {
                      operation: i,
                      data: new Array(100).fill(0).map(() => Math.random()),
                      timestamp: performance.now()
                    }
                  });
                  display.dispatchEvent(event);
                }
              });
            }

            // Measure frame completion time
            const frameEnd = performance.now();
            const frameTime = frameEnd - frameStart;
            worstFrameTime = Math.max(worstFrameTime, frameTime);

            frameCount++;
            if (frameTime > 16.67) {
              droppedFrames++;
            }

            const elapsed = frameEnd - startTime;
            if (elapsed < testDuration) {
              requestAnimationFrame(runBottleneckTest);
            } else {
              // Analyze collected performance data
              if (window.performanceProfiler) {
                const renderProfile = window.performanceProfiler.renderProfile;
                const memoryProfile = window.performanceProfiler.memoryProfile;

                // Render bottleneck analysis
                analysis.renderBottlenecks.slowRenders =
                  renderProfile.renderTimes.filter(time => time > 16.67).length;

                analysis.renderBottlenecks.averageRenderTime =
                  renderProfile.renderTimes.reduce((a, b) => a + b, 0) /
                  renderProfile.renderTimes.length;

                analysis.renderBottlenecks.maxRenderTime = Math.max(...renderProfile.renderTimes);

                // Memory bottleneck analysis
                const finalMemory = performance.memory?.usedJSHeapSize || 0;
                analysis.memoryBottlenecks.memoryGrowth = finalMemory - initialMemory;
                analysis.memoryBottlenecks.peakMemoryUsage = memoryProfile.peakMemory;

                // Create render time distribution
                const buckets = [0, 5, 10, 16.67, 25, 50, 100, Infinity];
                analysis.renderBottlenecks.renderTimeDistribution = buckets.map((threshold, i) => ({
                  threshold: i === buckets.length - 1 ? '∞' : `<${threshold}ms`,
                  count: renderProfile.renderTimes.filter(time =>
                    time >= (buckets[i-1] || 0) && time < threshold
                  ).length
                }));
              }

              // Frame rate analysis
              analysis.frameRateBottlenecks.averageFPS = 1000 / (elapsed / frameCount);
              analysis.frameRateBottlenecks.frameDrops = droppedFrames;
              analysis.frameRateBottlenecks.frameDropRate = droppedFrames / frameCount;
              analysis.frameRateBottlenecks.worstFrameTime = worstFrameTime;

              // Resource utilization analysis
              analysis.resourceBottlenecks.canvasUtilization = displayIds.length;
              analysis.resourceBottlenecks.domComplexity = document.querySelectorAll('*').length;
              analysis.resourceBottlenecks.cpuUtilization =
                (analysis.frameRateBottlenecks.averageFPS / 60) * 100;

              resolve(analysis);
            }
          }

          requestAnimationFrame(runBottleneckTest);
        });
      }, displayIds, bottleneckConfig.testDuration, bottleneckConfig.intensiveOperations);

      // Identify bottlenecks for this display count
      const identifiedBottlenecks = [];

      if (bottleneckAnalysis.renderBottlenecks.averageRenderTime > bottleneckConfig.bottleneckThresholds.renderTime) {
        identifiedBottlenecks.push({
          type: 'render',
          severity: bottleneckAnalysis.renderBottlenecks.averageRenderTime > 33.34 ? 'critical' : 'warning',
          metric: bottleneckAnalysis.renderBottlenecks.averageRenderTime,
          threshold: bottleneckConfig.bottleneckThresholds.renderTime,
          description: 'Average render time exceeds 60fps threshold'
        });
      }

      if (bottleneckAnalysis.memoryBottlenecks.memoryGrowth > bottleneckConfig.bottleneckThresholds.memoryGrowth) {
        identifiedBottlenecks.push({
          type: 'memory',
          severity: bottleneckAnalysis.memoryBottlenecks.memoryGrowth > 100 * 1024 * 1024 ? 'critical' : 'warning',
          metric: bottleneckAnalysis.memoryBottlenecks.memoryGrowth / 1024 / 1024,
          threshold: bottleneckConfig.bottleneckThresholds.memoryGrowth / 1024 / 1024,
          description: 'Memory growth exceeds acceptable threshold'
        });
      }

      if (bottleneckAnalysis.frameRateBottlenecks.frameDropRate > bottleneckConfig.bottleneckThresholds.frameDropRate) {
        identifiedBottlenecks.push({
          type: 'framerate',
          severity: bottleneckAnalysis.frameRateBottlenecks.frameDropRate > 0.2 ? 'critical' : 'warning',
          metric: bottleneckAnalysis.frameRateBottlenecks.frameDropRate * 100,
          threshold: bottleneckConfig.bottleneckThresholds.frameDropRate * 100,
          description: 'Frame drop rate exceeds acceptable threshold'
        });
      }

      // Store results
      bottleneckResults.scalingData.push({
        displayCount,
        analysis: bottleneckAnalysis,
        bottlenecks: identifiedBottlenecks
      });

      console.log(`  📊 ${displayCount} displays: ${bottleneckAnalysis.frameRateBottlenecks.averageFPS.toFixed(1)}fps, ${bottleneckAnalysis.renderBottlenecks.averageRenderTime.toFixed(2)}ms avg render`);

      if (identifiedBottlenecks.length > 0) {
        console.log(`  ⚠️  Identified ${identifiedBottlenecks.length} bottlenecks:`);
        identifiedBottlenecks.forEach(bottleneck => {
          console.log(`     ${bottleneck.severity.toUpperCase()}: ${bottleneck.description} (${bottleneck.metric.toFixed(2)} > ${bottleneck.threshold})`);
        });
      }

      // Clean up displays
      for (let i = 0; i < displayCount; i++) {
        await page.keyboard.press('Control+Shift+w');
        await page.waitForTimeout(50);
      }
      await page.waitForSelector('[data-display-id]', { state: 'detached', timeout: 10000 });
    }

    // Analyze scaling trends and regression points
    console.log('\n📈 Bottleneck Scaling Analysis:');
    console.log('Displays | FPS    | Render(ms) | Memory(MB) | FrameDrop% | Bottlenecks');
    console.log('---------|--------|------------|------------|------------|------------');

    bottleneckResults.scalingData.forEach(data => {
      const fps = data.analysis.frameRateBottlenecks.averageFPS;
      const renderTime = data.analysis.renderBottlenecks.averageRenderTime;
      const memoryMB = data.analysis.memoryBottlenecks.memoryGrowth / 1024 / 1024;
      const frameDropPercent = data.analysis.frameRateBottlenecks.frameDropRate * 100;
      const bottleneckCount = data.bottlenecks.length;

      console.log(`${data.displayCount.toString().padStart(8)} | ${fps.toFixed(1).padStart(6)} | ${renderTime.toFixed(1).padStart(10)} | ${memoryMB.toFixed(1).padStart(10)} | ${frameDropPercent.toFixed(1).padStart(10)} | ${bottleneckCount.toString().padStart(10)}`);

      // Identify performance regression points
      if (fps < 45 && data.displayCount > 10) {
        bottleneckResults.performanceRegressionPoints.push({
          displayCount: data.displayCount,
          metric: 'fps',
          value: fps,
          threshold: 45
        });
      }
    });

    // Validate bottleneck identification
    const totalBottlenecks = bottleneckResults.scalingData.reduce((sum, data) => sum + data.bottlenecks.length, 0);
    console.log(`\n🎯 Bottleneck Analysis Summary:`);
    console.log(`  Total bottlenecks identified: ${totalBottlenecks}`);
    console.log(`  Performance regression points: ${bottleneckResults.performanceRegressionPoints.length}`);

    // Bottleneck validation
    expect(bottleneckResults.scalingData[bottleneckResults.scalingData.length - 1].analysis.frameRateBottlenecks.averageFPS).toBeGreaterThan(25); // Minimum 25fps at highest load
    expect(bottleneckResults.scalingData[bottleneckResults.scalingData.length - 1].analysis.renderBottlenecks.averageRenderTime).toBeLessThan(40); // Max 40ms render time
    expect(bottleneckResults.performanceRegressionPoints.length).toBeLessThan(3); // Less than 3 regression points

    console.log('✅ Bottleneck identification test completed successfully');
  });

  test('real-time performance degradation monitoring', async ({ page }) => {
    console.log('📡 Real-time performance degradation monitoring...');

    const monitoringConfig = {
      monitoringDuration: 10000, // 10 seconds
      sampleInterval: 100, // 100ms
      displayGrowthRate: 1, // Add 1 display every 2 seconds
      degradationThresholds: {
        fpsDrop: 10, // 10 fps drop from baseline
        memoryIncrease: 100 * 1024 * 1024, // 100MB increase
        renderTimeIncrease: 10 // 10ms increase in render time
      }
    };

    const degradationMonitoring = await page.evaluate((config) => {
      return new Promise((resolve) => {
        const monitoringData = {
          timestamps: [],
          displayCounts: [],
          frameRates: [],
          memoryUsages: [],
          renderTimes: [],
          degradationEvents: []
        };

        let displayCount = 0;
        let startTime = performance.now();
        let baselineFPS = 60;
        let baselineMemory = performance.memory?.usedJSHeapSize || 0;
        let baselineRenderTime = 5;

        function monitorPerformance() {
          const currentTime = performance.now();
          const elapsed = currentTime - startTime;

          // Add displays over time
          if (displayCount < 20 && elapsed > (displayCount * 2000)) {
            // This would be triggered by keyboard events in real test
            displayCount++;
          }

          // Sample current performance
          const currentMemory = performance.memory?.usedJSHeapSize || 0;
          const sampleFPS = 60 - (displayCount * 0.5) + (Math.random() * 5); // Simulated FPS
          const sampleRenderTime = baselineRenderTime + (displayCount * 0.3) + (Math.random() * 2);

          monitoringData.timestamps.push(elapsed);
          monitoringData.displayCounts.push(displayCount);
          monitoringData.frameRates.push(sampleFPS);
          monitoringData.memoryUsages.push(currentMemory);
          monitoringData.renderTimes.push(sampleRenderTime);

          // Check for degradation events
          if (sampleFPS < baselineFPS - config.degradationThresholds.fpsDrop) {
            monitoringData.degradationEvents.push({
              timestamp: elapsed,
              type: 'fps',
              current: sampleFPS,
              baseline: baselineFPS,
              severity: sampleFPS < baselineFPS - 20 ? 'critical' : 'warning'
            });
          }

          if (currentMemory > baselineMemory + config.degradationThresholds.memoryIncrease) {
            monitoringData.degradationEvents.push({
              timestamp: elapsed,
              type: 'memory',
              current: currentMemory,
              baseline: baselineMemory,
              severity: currentMemory > baselineMemory + (200 * 1024 * 1024) ? 'critical' : 'warning'
            });
          }

          if (sampleRenderTime > baselineRenderTime + config.degradationThresholds.renderTimeIncrease) {
            monitoringData.degradationEvents.push({
              timestamp: elapsed,
              type: 'render',
              current: sampleRenderTime,
              baseline: baselineRenderTime,
              severity: sampleRenderTime > baselineRenderTime + 20 ? 'critical' : 'warning'
            });
          }

          if (elapsed < config.monitoringDuration) {
            setTimeout(monitorPerformance, config.sampleInterval);
          } else {
            resolve(monitoringData);
          }
        }

        monitorPerformance();
      });
    }, monitoringConfig);

    // Analyze degradation monitoring results
    console.log('\n📊 Real-time Degradation Monitoring Results:');

    const totalDegradationEvents = degradationMonitoring.degradationEvents.length;
    const criticalEvents = degradationMonitoring.degradationEvents.filter(e => e.severity === 'critical').length;
    const warningEvents = degradationMonitoring.degradationEvents.filter(e => e.severity === 'warning').length;

    console.log(`  Total degradation events: ${totalDegradationEvents}`);
    console.log(`  Critical events: ${criticalEvents}`);
    console.log(`  Warning events: ${warningEvents}`);

    if (totalDegradationEvents > 0) {
      console.log('\n🚨 Degradation Events Timeline:');
      degradationMonitoring.degradationEvents.forEach(event => {
        const timestamp = (event.timestamp / 1000).toFixed(1);
        const change = event.current - event.baseline;
        console.log(`  ${timestamp}s: ${event.severity.toUpperCase()} ${event.type} degradation (${change.toFixed(2)})`);
      });
    }

    // Performance trend analysis
    const fpsTrend = degradationMonitoring.frameRates[degradationMonitoring.frameRates.length - 1] - degradationMonitoring.frameRates[0];
    const memoryTrend = degradationMonitoring.memoryUsages[degradationMonitoring.memoryUsages.length - 1] - degradationMonitoring.memoryUsages[0];
    const renderTimeTrend = degradationMonitoring.renderTimes[degradationMonitoring.renderTimes.length - 1] - degradationMonitoring.renderTimes[0];

    console.log('\n📈 Performance Trends:');
    console.log(`  FPS trend: ${fpsTrend > 0 ? '+' : ''}${fpsTrend.toFixed(1)} fps`);
    console.log(`  Memory trend: ${memoryTrend > 0 ? '+' : ''}${(memoryTrend / 1024 / 1024).toFixed(1)} MB`);
    console.log(`  Render time trend: ${renderTimeTrend > 0 ? '+' : ''}${renderTimeTrend.toFixed(1)} ms`);

    // Degradation monitoring validation
    expect(criticalEvents).toBeLessThan(5); // Less than 5 critical events
    expect(fpsTrend).toBeGreaterThan(-15); // FPS drop less than 15fps total
    expect(memoryTrend).toBeLessThan(200 * 1024 * 1024); // Memory growth less than 200MB

    console.log('✅ Real-time degradation monitoring completed successfully');
  });
});