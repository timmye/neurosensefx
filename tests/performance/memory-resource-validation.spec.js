/**
 * Memory and Resource Validation Testing Under High Load
 *
 * Comprehensive memory leak detection, resource cleanup validation,
 * and extended session stability testing for professional trading scenarios.
 */

import { test, expect } from '@playwright/test';

test.describe('Memory and Resource Validation Under High Load', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('#app', { timeout: 15000 });

    // Initialize advanced memory tracking
    await page.evaluate(() => {
      // Enhanced memory tracker
      window.enhancedMemoryTracker = {
        allocations: new Map(),
        deallocations: new Map(),
        memorySnapshots: [],
        resourceTracking: {
          canvases: new Set(),
          eventListeners: new Map(),
          timers: new Set(),
          websockets: new Set()
        },
        startTracking() {
          this.baselineMemory = performance.memory?.usedJSHeapSize || 0;
          this.startTime = performance.now();

          // Hook into allocation patterns
          const originalCreateElement = document.createElement;
          document.createElement = function(...args) {
            const element = originalCreateElement.apply(this, args);

            if (element.tagName === 'CANVAS') {
              window.enhancedMemoryTracker.resourceTracking.canvases.add(element);
            }

            return element;
          };

          // Track canvas resources
          const originalGetContext = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function(contextType, ...args) {
            const context = originalGetContext.call(this, contextType, ...args);

            if (contextType === '2d') {
              // Track context creation
              if (!this.trackedContexts) {
                this.trackedContexts = [];
              }
              this.trackedContexts.push(context);

              // Hook into image data for memory tracking
              const originalGetImageData = context.getImageData;
              context.getImageData = function(...args) {
                const imageData = originalGetImageData.apply(this, args);
                const size = imageData.width * imageData.height * 4; // RGBA
                window.enhancedMemoryTracker.allocations.set(`imagedata_${Date.now()}`, size);
                return imageData;
              };
            }

            return context;
          };

          // Track event listeners
          const originalAddEventListener = EventTarget.prototype.addEventListener;
          EventTarget.prototype.addEventListener = function(type, listener, options) {
            const id = `${this.constructor.name}_${type}_${Date.now()}`;
            window.enhancedMemoryTracker.resourceTracking.eventListeners.set(id, {
              target: this,
              type,
              listener,
              options,
              timestamp: Date.now()
            });

            return originalAddEventListener.call(this, type, listener, options);
          };

          // Track timers
          const originalSetTimeout = window.setTimeout;
          const originalSetInterval = window.setInterval;

          window.setTimeout = function(callback, delay, ...args) {
            const id = originalSetTimeout.call(this, callback, delay, ...args);
            window.enhancedMemoryTracker.resourceTracking.timers.add({ id, type: 'timeout', delay });
            return id;
          };

          window.setInterval = function(callback, delay, ...args) {
            const id = originalSetInterval.call(this, callback, delay, ...args);
            window.enhancedMemoryTracker.resourceTracking.timers.add({ id, type: 'interval', delay });
            return id;
          };

          console.log('🔍 Enhanced memory tracking initialized');
        },

        takeSnapshot(label) {
          const snapshot = {
            label,
            timestamp: Date.now(),
            memory: {
              used: performance.memory?.usedJSHeapSize || 0,
              total: performance.memory?.totalJSHeapSize || 0,
              limit: performance.memory?.jsHeapSizeLimit || 0
            },
            resources: {
              canvases: this.resourceTracking.canvases.size,
              eventListeners: this.resourceTracking.eventListeners.size,
              timers: this.resourceTracking.timers.size,
              domNodes: document.querySelectorAll('*').length
            },
            allocations: this.allocations.size,
            deallocations: this.deallocations.size
          };

          this.memorySnapshots.push(snapshot);
          return snapshot;
        },

        getMemoryStats() {
          return {
            current: {
              used: performance.memory?.usedJSHeapSize || 0,
              total: performance.memory?.totalJSHeapSize || 0,
              limit: performance.memory?.jsHeapSizeLimit || 0
            },
            snapshots: this.memorySnapshots,
            resources: {
              canvases: Array.from(this.resourceTracking.canvases).map(canvas => ({
                width: canvas.width,
                height: canvas.height,
                memory: canvas.width * canvas.height * 4 // RGBA approximation
              })),
              eventListeners: this.resourceTracking.eventListeners.size,
              timers: this.resourceTracking.timers.size
            },
            memoryPressure: (performance.memory?.usedJSHeapSize || 0) / (performance.memory?.jsHeapSizeLimit || 1)
          };
        },

        cleanup() {
          // Clean up tracked resources
          this.resourceTracking.canvases.clear();
          this.resourceTracking.eventListeners.clear();
          this.resourceTracking.timers.clear();
          this.allocations.clear();
          this.deallocations.clear();
        }
      };

      window.enhancedMemoryTracker.startTracking();
    });
  });

  test('memory leak detection under high display turnover', async ({ page }) => {
    console.log('🔍 Memory leak detection under high display turnover...');

    const leakTestConfig = {
      cycles: 10,
      displaysPerCycle: 5,
      cycleDuration: 3000, // 3 seconds per cycle
      memoryLeakThreshold: 20 * 1024 * 1024, // 20MB per cycle
      resourceGrowthThreshold: 10 // 10 resources per cycle
    };

    const leakTestResults = {
      cycles: [],
      memoryGrowthTrend: [],
      resourceGrowthTrend: [],
      detectedLeaks: [],
      cleanupEfficiency: []
    };

    // Take baseline snapshot
    await page.evaluate(() => {
      window.enhancedMemoryTracker.takeSnapshot('baseline');
    });

    for (let cycle = 0; cycle < leakTestConfig.cycles; cycle++) {
      console.log(`\n🔄 Memory Leak Test Cycle ${cycle + 1}/${leakTestConfig.cycles}`);

      // Create displays for this cycle
      const createdDisplayIds = [];
      const cycleStartTime = performance.now();

      for (let i = 0; i < leakTestConfig.displaysPerCycle; i++) {
        await page.keyboard.press('Control+k');
        await page.waitForSelector('[data-panel-id="symbol-palette"]', { timeout: 5000 });

        await page.keyboard.press('Control+a');
        const symbol = `LEAK_${cycle}_${i % 3 === 0 ? 'EURUSD' : i % 2 === 0 ? 'GBPUSD' : 'USDJPY'}`;
        await page.keyboard.type(symbol);
        await page.waitForTimeout(100);
        await page.keyboard.press('Enter');

        await page.waitForSelector('[data-display-id]', { timeout: 8000 });

        const displayId = await page.evaluate(() => {
          const displays = document.querySelectorAll('[data-display-id]');
          return displays[displays.length - 1].getAttribute('data-display-id');
        });

        createdDisplayIds.push(displayId);
      }

      // Memory snapshot after creation
      const creationSnapshot = await page.evaluate(() => {
        return window.enhancedMemoryTracker.takeSnapshot('creation');
      });

      // Simulate active usage for cycle duration
      await page.evaluate(async (displayIds, duration) => {
        const cycleStart = performance.now();

        function simulateActivity() {
          const elapsed = performance.now() - cycleStart;

          if (elapsed < duration) {
            // Simulate price updates, renders, etc.
            displayIds.forEach((displayId, index) => {
              const display = document.querySelector(`[data-display-id="${displayId}"]`);
              if (display) {
                const canvas = display.querySelector('canvas');
                if (canvas && canvas.getContext) {
                  const ctx = canvas.getContext('2d');
                  // Simulate drawing operations
                  ctx.fillStyle = `hsl(${(elapsed + index * 100) % 360}, 50%, 50%)`;
                  ctx.fillRect(
                    Math.random() * canvas.width * 0.8,
                    Math.random() * canvas.height * 0.8,
                    50, 50
                  );
                }

                // Trigger data updates
                const event = new CustomEvent('priceUpdate', {
                  detail: {
                    price: 1000 + Math.random() * 500,
                    volume: Math.random() * 1000,
                    timestamp: Date.now()
                  }
                });
                display.dispatchEvent(event);
              }
            });

            setTimeout(simulateActivity, 50); // 20 Hz activity
          }
        }

        simulateActivity();
      }, createdDisplayIds, leakTestConfig.cycleDuration);

      await page.waitForTimeout(leakTestConfig.cycleDuration);

      // Clean up all displays
      for (let i = 0; i < leakTestConfig.displaysPerCycle; i++) {
        await page.keyboard.press('Control+Shift+w');
        await page.waitForTimeout(100);
      }

      await page.waitForSelector('[data-display-id]', { state: 'detached', timeout: 10000 });

      // Memory snapshot after cleanup
      const cleanupSnapshot = await page.evaluate(() => {
        return window.enhancedMemoryTracker.takeSnapshot('cleanup');
      });

      // Analyze cycle results
      const cycleEndTime = performance.now();
      const cycleResults = await page.evaluate((cycleNumber, cycleTime, creationSnap, cleanupSnap) => {
        const memoryStats = window.enhancedMemoryTracker.getMemoryStats();
        const snapshots = memoryStats.snapshots;

        const creationSnapshot = snapshots.find(s => s.label === 'creation');
        const cleanupSnapshot = snapshots.find(s => s.label === 'cleanup');

        // Find baseline
        const baselineSnapshot = snapshots.find(s => s.label === 'baseline') || { memory: { used: 0 } };

        const memoryGrowth = cleanupSnapshot.memory.used - baselineSnapshot.memory.used;
        const resourceGrowth = cleanupSnapshot.resources.canvases + cleanupSnapshot.resources.timers;

        // Detect potential leaks
        const detectedLeaks = [];
        if (memoryGrowth > 20 * 1024 * 1024) { // 20MB threshold
          detectedLeaks.push({
            type: 'memory',
            amount: memoryGrowth,
            threshold: 20 * 1024 * 1024
          });
        }

        if (resourceGrowth > 10) {
          detectedLeaks.push({
            type: 'resource',
            amount: resourceGrowth,
            threshold: 10
          });
        }

        return {
          cycle: cycleNumber,
          duration: cycleTime,
          memoryGrowth,
          resourceGrowth,
          detectedLeaks,
          memoryStats: {
            used: cleanupSnapshot.memory.used,
            pressure: memoryStats.memoryPressure,
            canvases: cleanupSnapshot.resources.canvases,
            eventListeners: cleanupSnapshot.resources.eventListeners,
            timers: cleanupSnapshot.resources.timers
          },
          cleanupEfficiency: 1 - (memoryGrowth / (creationSnapshot.memory.used - baselineSnapshot.memory.used))
        };
      }, cycle, cycleEndTime - cycleStartTime, creationSnapshot, cleanupSnapshot);

      leakTestResults.cycles.push(cycleResults);
      leakTestResults.memoryGrowthTrend.push(cycleResults.memoryGrowth);
      leakTestResults.resourceGrowthTrend.push(cycleResults.resourceGrowth);
      leakTestResults.detectedLeaks.push(...cycleResults.detectedLeaks);
      leakTestResults.cleanupEfficiency.push(cycleResults.cleanupEfficiency);

      console.log(`  Memory growth: ${(cycleResults.memoryGrowth / 1024 / 1024).toFixed(1)}MB`);
      console.log(`  Resource growth: ${cycleResults.resourceGrowth}`);
      console.log(`  Cleanup efficiency: ${(cycleResults.cleanupEfficiency * 100).toFixed(1)}%`);
      console.log(`  Memory pressure: ${(cycleResults.memoryStats.pressure * 100).toFixed(1)}%`);

      if (cycleResults.detectedLeaks.length > 0) {
        console.log(`  ⚠️  Detected ${cycleResults.detectedLeaks.length} potential leaks`);
        cycleResults.detectedLeaks.forEach(leak => {
          console.log(`     ${leak.type}: ${(leak.amount / 1024 / 1024).toFixed(1)}MB`);
        });
      }
    }

    // Analyze overall leak test results
    console.log('\n📊 Memory Leak Detection Summary:');
    const totalMemoryGrowth = leakTestResults.memoryGrowthTrend.reduce((a, b) => a + b, 0);
    const averageMemoryGrowth = totalMemoryGrowth / leakTestConfig.cycles;
    const maxMemoryGrowth = Math.max(...leakTestResults.memoryGrowthTrend);
    const averageCleanupEfficiency = leakTestResults.cleanupEfficiency.reduce((a, b) => a + b, 0) / leakTestResults.cleanupEfficiency.length;

    console.log(`  Cycles completed: ${leakTestConfig.cycles}`);
    console.log(`  Total memory growth: ${(totalMemoryGrowth / 1024 / 1024).toFixed(1)}MB`);
    console.log(`  Average growth per cycle: ${(averageMemoryGrowth / 1024 / 1024).toFixed(1)}MB`);
    console.log(`  Max single cycle growth: ${(maxMemoryGrowth / 1024 / 1024).toFixed(1)}MB`);
    console.log(`  Average cleanup efficiency: ${(averageCleanupEfficiency * 100).toFixed(1)}%`);
    console.log(`  Total detected leaks: ${leakTestResults.detectedLeaks.length}`);

    // Memory growth trend analysis
    const memoryTrend = leakTestResults.memoryGrowthTrend[leakTestResults.memoryGrowthTrend.length - 1] - leakTestResults.memoryGrowthTrend[0];
    const resourceTrend = leakTestResults.resourceGrowthTrend[leakTestResults.resourceGrowthTrend.length - 1] - leakTestResults.resourceGrowthTrend[0];

    console.log(`  Memory growth trend: ${(memoryTrend / 1024 / 1024).toFixed(1)}MB across all cycles`);
    console.log(`  Resource growth trend: ${resourceTrend} resources across all cycles`);

    // Leak detection validation
    expect(averageMemoryGrowth).toBeLessThan(leakTestConfig.memoryLeakThreshold);
    expect(maxMemoryGrowth).toBeLessThan(leakTestConfig.memoryLeakThreshold * 2);
    expect(averageCleanupEfficiency).toBeGreaterThan(0.8); // 80% cleanup efficiency
    expect(memoryTrend).toBeLessThan(leakTestConfig.memoryLeakThreshold * leakTestConfig.cycles * 0.5); // Allow some growth but not excessive

    console.log('✅ Memory leak detection test completed successfully');
  });

  test('extended session stability testing', async ({ page }) => {
    console.log('⏰ Extended session stability testing (simulating 2-hour trading session)...');

    // Simulate 2-hour trading session compressed into 2 minutes
    const sessionConfig = {
      simulatedDuration: 120000, // 2 minutes compressed
      realDurationPerActivity: 1000, // 1 second per activity block
      displayCount: 15,
      activitiesPerMinute: 10,
      memoryGrowthRateLimit: 50 * 1024 * 1024, // 50MB per hour equivalent
      performanceDegradationLimit: 20 // 20% max performance degradation
    };

    const sessionResults = {
      startTime: Date.now(),
      activities: [],
      performanceMetrics: {
        baseline: { fps: 60, memory: 0, renderTime: 5 },
        degradation: [],
        stabilityEvents: []
      },
      resourceUtilization: [],
      memoryStability: []
    };

    // Establish baseline performance
    const baselinePerformance = await page.evaluate(() => {
      return {
        fps: 60,
        memory: performance.memory?.usedJSHeapSize || 0,
        renderTime: 5,
        timestamp: Date.now()
      };
    });

    sessionResults.performanceMetrics.baseline = baselinePerformance;

    // Create initial displays
    console.log('\n📊 Creating initial display set...');
    const displayIds = [];
    for (let i = 0; i < sessionConfig.displayCount; i++) {
      await page.keyboard.press('Control+k');
      await page.waitForSelector('[data-panel-id="symbol-palette"]', { timeout: 5000 });

      await page.keyboard.press('Control+a');
      const symbol = i % 3 === 0 ? 'EUR/USD' : i % 2 === 0 ? 'GBP/USD' : 'USD/JPY';
      await page.keyboard.type(`SESSION_${symbol}`);
      await page.waitForTimeout(100);
      await page.keyboard.press('Enter');

      await page.waitForSelector('[data-display-id]', { timeout: 8000 });

      const displayId = await page.evaluate(() => {
        const displays = document.querySelectorAll('[data-display-id]');
        return displays[displays.length - 1].getAttribute('data-display-id');
      });

      displayIds.push(displayId);
    }

    console.log(`✅ Created ${displayIds.length} displays for session testing`);

    // Run extended session simulation
    const sessionStartTime = performance.now();
    let activityCount = 0;

    while (performance.now() - sessionStartTime < sessionConfig.simulatedDuration) {
      const activityStartTime = performance.now();
      activityCount++;

      const sessionActivity = await page.evaluate((displayIds, activityNum, totalActivities) => {
        const activity = {
          number: activityNum,
          startTime: performance.now(),
          operations: [],
          memoryBefore: performance.memory?.usedJSHeapSize || 0
        };

        // Simulate various trading activities
        const activities = [
          // Price updates
          () => {
            displayIds.forEach((id, index) => {
              const display = document.querySelector(`[data-display-id="${id}"]`);
              if (display) {
                const event = new CustomEvent('priceUpdate', {
                  detail: {
                    price: 1000 + Math.random() * 500 + index * 100,
                    volume: Math.random() * 1000000,
                    timestamp: Date.now()
                  }
                });
                display.dispatchEvent(event);
                activity.operations.push('priceUpdate');
              }
            });
          },

          // Display switching
          () => {
            if (displayIds.length > 0) {
              const targetIndex = Math.floor(Math.random() * displayIds.length);
              const targetDisplay = document.querySelector(`[data-display-id="${displayIds[targetIndex]}"]`);
              if (targetDisplay) {
                targetDisplay.focus();
                activity.operations.push('displaySwitch');
              }
            }
          },

          // Canvas renders
          () => {
            displayIds.forEach((id, index) => {
              const display = document.querySelector(`[data-display-id="${id}"]`);
              if (display) {
                const canvas = display.querySelector('canvas');
                if (canvas && canvas.getContext) {
                  const ctx = canvas.getContext('2d');
                  ctx.fillStyle = `hsl(${(activityNum * 30 + index * 20) % 360}, 50%, 50%)`;
                  ctx.fillRect(
                    Math.random() * canvas.width,
                    Math.random() * canvas.height,
                    Math.random() * 100 + 10,
                    Math.random() * 50 + 5
                  );
                  activity.operations.push('canvasRender');
                }
              }
            });
          },

          // Keyboard shortcuts
          () => {
            const shortcuts = ['Control+Tab', 'Control+1', 'Control+2', 'F1', 'Escape'];
            const shortcut = shortcuts[Math.floor(Math.random() * shortcuts.length)];

            const event = new KeyboardEvent('keydown', {
              key: shortcut.includes('+') ? shortcut.split('+')[1] : shortcut,
              ctrlKey: shortcut.includes('Control'),
              code: `Key${shortcut.split('+')[1] || shortcut.toUpperCase()}`
            });
            document.dispatchEvent(event);
            activity.operations.push('keyboardShortcut');
          }
        ];

        // Execute random activities
        const numOperations = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < numOperations; i++) {
          const randomActivity = activities[Math.floor(Math.random() * activities.length)];
          randomActivity();
        }

        activity.memoryAfter = performance.memory?.usedJSHeapSize || 0;
        activity.memoryDelta = activity.memoryAfter - activity.memoryBefore;
        activity.endTime = performance.now();
        activity.duration = activity.endTime - activity.startTime;

        return activity;
      }, displayIds, activityCount, sessionConfig.activitiesPerMinute);

      sessionResults.activities.push(sessionActivity);

      // Sample performance metrics
      const performanceSample = await page.evaluate(() => {
        const memory = performance.memory?.usedJSHeapSize || 0;
        const canvases = document.querySelectorAll('canvas');
        const displays = document.querySelectorAll('[data-display-id]');

        return {
          memory,
          canvasCount: canvases.length,
          displayCount: displays.length,
          memoryPressure: memory / (performance.memory?.jsHeapSizeLimit || 1),
          timestamp: Date.now()
        };
      });

      sessionResults.resourceUtilization.push(performanceSample);

      // Calculate performance degradation
      const memoryGrowth = performanceSample.memory - baselinePerformance.memory;
      const performanceDegradation = (memoryGrowth / baselinePerformance.memory) * 100;

      if (performanceDegradation > sessionConfig.performanceDegradationLimit) {
        sessionResults.performanceMetrics.stabilityEvents.push({
          timestamp: Date.now(),
          type: 'performance_degradation',
          value: performanceDegradation,
          threshold: sessionConfig.performanceDegradationLimit
        });
      }

      await page.waitForTimeout(sessionConfig.realDurationPerActivity);

      if (activityCount % 10 === 0) {
        console.log(`  Activity ${activityCount}: Memory ${(performanceSample.memory / 1024 / 1024).toFixed(1)}MB, Degradation ${performanceDegradation.toFixed(1)}%`);
      }
    }

    // Final analysis
    console.log('\n📊 Extended Session Stability Analysis:');

    const sessionEndTime = performance.now();
    const totalSessionTime = sessionEndTime - sessionStartTime;
    const finalMemory = await page.evaluate(() => performance.memory?.usedJSHeapSize || 0);
    const totalMemoryGrowth = finalMemory - baselinePerformance.memory;
    const memoryGrowthRate = (totalMemoryGrowth / totalSessionTime) * 1000; // per second
    const memoryGrowthRatePerHour = memoryGrowthRate * 3600; // per hour equivalent

    console.log(`  Session duration: ${(totalSessionTime / 1000).toFixed(1)}s`);
    console.log(`  Total activities: ${activityCount}`);
    console.log(`  Average memory: ${(sessionResults.resourceUtilization.reduce((sum, s) => sum + s.memory, 0) / sessionResults.resourceUtilization.length / 1024 / 1024).toFixed(1)}MB`);
    console.log(`  Memory growth: ${(totalMemoryGrowth / 1024 / 1024).toFixed(1)}MB`);
    console.log(`  Memory growth rate: ${(memoryGrowthRate / 1024).toFixed(1)}KB/s`);
    console.log(`  Hourly growth rate: ${(memoryGrowthRatePerHour / 1024 / 1024).toFixed(1)}MB/hour`);
    console.log(`  Stability events: ${sessionResults.performanceMetrics.stabilityEvents.length}`);

    // Analyze performance trends
    const memorySamples = sessionResults.resourceUtilization.map(s => s.memory);
    const memoryVolatility = Math.sqrt(memorySamples.reduce((sum, memory, i) => {
      const mean = memorySamples.reduce((a, b) => a + b, 0) / memorySamples.length;
      return sum + Math.pow(memory - mean, 2);
    }, 0) / memorySamples.length);

    console.log(`  Memory volatility: ${(memoryVolatility / 1024 / 1024).toFixed(1)}MB`);

    // Session stability validation
    expect(memoryGrowthRatePerHour).toBeLessThan(sessionConfig.memoryGrowthRateLimit);
    expect(sessionResults.performanceMetrics.stabilityEvents.length).toBeLessThan(activityCount * 0.05); // Less than 5% of activities cause issues
    expect(memoryVolatility).toBeLessThan(totalMemoryGrowth * 0.3); // Volatility should be less than 30% of total growth

    // Clean up displays
    console.log('\n🧹 Cleaning up session displays...');
    for (let i = 0; i < displayIds.length; i++) {
      await page.keyboard.press('Control+Shift+w');
      await page.waitForTimeout(100);
    }

    await page.waitForSelector('[data-display-id]', { state: 'detached', timeout: 15000 });

    console.log('✅ Extended session stability testing completed successfully');
  });

  test('resource cleanup efficiency under stress conditions', async ({ page }) => {
    console.log('🧹 Resource cleanup efficiency under stress conditions...');

    const cleanupConfig = {
      stressCycles: 5,
      displaysPerCycle: 8,
      rapidCreation: true, // Rapid creation/destruction
      cleanupVerificationDelay: 2000, // 2 seconds to verify cleanup
      resourceLeakThreshold: 5 // Max 5 leaked resources per type
    };

    const cleanupResults = {
      cycles: [],
      resourceLeaks: {
        canvases: [],
        eventListeners: [],
        timers: [],
        memory: []
      },
      cleanupEfficiency: [],
      stressMetrics: []
    };

    for (let cycle = 0; cycle < cleanupConfig.stressCycles; cycle++) {
      console.log(`\n🔄 Cleanup Stress Cycle ${cycle + 1}/${cleanupConfig.stressCycles}`);

      // Resource snapshot before cycle
      const beforeSnapshot = await page.evaluate(() => {
        return window.enhancedMemoryTracker.takeSnapshot('before_cycle');
      });

      // Create displays rapidly
      const cycleDisplays = [];
      const creationTimes = [];

      for (let i = 0; i < cleanupConfig.displaysPerCycle; i++) {
        const creationStart = performance.now();

        await page.keyboard.press('Control+k');
        await page.waitForSelector('[data-panel-id="symbol-palette"]', { timeout: 3000 });

        await page.keyboard.press('Control+a');
        await page.keyboard.type(`CLEANUP_${cycle}_${i}`);
        await page.waitForTimeout(cleanupConfig.rapidCreation ? 50 : 200);
        await page.keyboard.press('Enter');

        await page.waitForSelector('[data-display-id]', { timeout: 5000 });

        const creationEnd = performance.now();
        creationTimes.push(creationEnd - creationStart);

        const displayId = await page.evaluate(() => {
          const displays = document.querySelectorAll('[data-display-id]');
          return displays[displays.length - 1].getAttribute('data-display-id');
        });

        cycleDisplays.push(displayId);
      }

      // Simulate stress activity
      await page.evaluate(async (displayIds, duration) => {
        const stressStart = performance.now();

        function stressActivity() {
          const elapsed = performance.now() - stressStart;

          if (elapsed < duration) {
            displayIds.forEach((id, index) => {
              const display = document.querySelector(`[data-display-id="${id}"]`);
              if (display) {
                // Multiple simultaneous updates
                for (let j = 0; j < 5; j++) {
                  const event = new CustomEvent('rapidUpdate', {
                    detail: {
                      data: new Array(100).fill(0).map(() => Math.random()),
                      index: index,
                      subIndex: j
                    }
                  });
                  display.dispatchEvent(event);
                }

                // Canvas stress
                const canvas = display.querySelector('canvas');
                if (canvas) {
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    // Multiple draw operations
                    for (let k = 0; k < 10; k++) {
                      ctx.fillStyle = `hsl(${(elapsed + k * 20) % 360}, 70%, 60%)`;
                      ctx.fillRect(
                        Math.random() * canvas.width,
                        Math.random() * canvas.height,
                        Math.random() * 20 + 5,
                        Math.random() * 20 + 5
                      );
                    }
                  }
                }
              }
            });

            setTimeout(stressActivity, 50);
          }
        }

        stressActivity();
      }, cycleDisplays, 2000);

      await page.waitForTimeout(2000);

      // Resource snapshot at peak usage
      const peakSnapshot = await page.evaluate(() => {
        return window.enhancedMemoryTracker.takeSnapshot('peak_usage');
      });

      // Rapid cleanup
      const cleanupStart = performance.now();
      for (let i = 0; i < cleanupConfig.displaysPerCycle; i++) {
        await page.keyboard.press('Control+Shift+w');
        await page.waitForTimeout(cleanupConfig.rapidCreation ? 50 : 100);
      }
      const cleanupEnd = performance.now();

      // Wait for cleanup verification
      await page.waitForTimeout(cleanupConfig.cleanupVerificationDelay);

      // Resource snapshot after cleanup
      const afterSnapshot = await page.evaluate(() => {
        return window.enhancedMemoryTracker.takeSnapshot('after_cleanup');
      });

      // Analyze cleanup efficiency
      const cycleAnalysis = await page.evaluate((cycleNum, beforeSnap, peakSnap, afterSnap, cleanupTime) => {
        const stats = window.enhancedMemoryTracker.getMemoryStats();

        const resourceLeaks = {
          canvases: afterSnap.resources.canvases - beforeSnap.resources.canvases,
          eventListeners: afterSnap.resources.eventListeners - beforeSnap.resources.eventListeners,
          timers: afterSnap.resources.timers - beforeSnap.resources.timers,
          memory: afterSnap.memory.used - beforeSnap.memory.used
        };

        const totalResourceGrowth = Math.abs(resourceLeaks.canvases) +
                                   Math.abs(resourceLeaks.eventListeners) +
                                   Math.abs(resourceLeaks.timers);

        const memoryRecovery = peakSnap.memory.used - afterSnap.memory.used;
        const totalMemoryUsed = peakSnap.memory.used - beforeSnap.memory.used;
        const cleanupEfficiency = totalMemoryUsed > 0 ? memoryRecovery / totalMemoryUsed : 1;

        return {
          cycle: cycleNum,
          cleanupTime,
          resourceLeaks,
          totalResourceGrowth,
          memoryRecovery,
          cleanupEfficiency,
          memoryPressure: afterSnap.memory.used / afterSnap.memory.limit,
          remainingResources: afterSnap.resources
        };
      }, cycle, beforeSnapshot, peakSnapshot, afterSnapshot, cleanupEnd - cleanupStart);

      cleanupResults.cycles.push(cycleAnalysis);
      cleanupResults.cleanupEfficiency.push(cycleAnalysis.cleanupEfficiency);

      // Track resource leaks
      Object.keys(cycleAnalysis.resourceLeaks).forEach(resourceType => {
        if (cycleAnalysis.resourceLeaks[resourceType] > 0) {
          cleanupResults.resourceLeaks[resourceType].push(cycleAnalysis.resourceLeaks[resourceType]);
        }
      });

      console.log(`  Cleanup time: ${cycleAnalysis.cleanupTime.toFixed(2)}ms`);
      console.log(`  Cleanup efficiency: ${(cycleAnalysis.cleanupEfficiency * 100).toFixed(1)}%`);
      console.log(`  Resource leaks: ${cycleAnalysis.totalResourceGrowth}`);
      console.log(`  Memory pressure: ${(cycleAnalysis.memoryPressure * 100).toFixed(1)}%`);

      if (cycleAnalysis.totalResourceGrowth > 0) {
        console.log(`  ⚠️  Leaked resources: ${JSON.stringify(cycleAnalysis.resourceLeaks)}`);
      }
    }

    // Final cleanup analysis
    console.log('\n📊 Resource Cleanup Efficiency Summary:');

    const averageCleanupEfficiency = cleanupResults.cleanupEfficiency.reduce((a, b) => a + b, 0) / cleanupResults.cleanupEfficiency.length;
    const worstCleanupEfficiency = Math.min(...cleanupResults.cleanupEfficiency);
    const totalResourceLeaks = Object.values(cleanupResults.resourceLeaks).reduce((sum, leaks) => sum + leaks.reduce((a, b) => a + b, 0), 0);

    console.log(`  Average cleanup efficiency: ${(averageCleanupEfficiency * 100).toFixed(1)}%`);
    console.log(`  Worst cleanup efficiency: ${(worstCleanupEfficiency * 100).toFixed(1)}%`);
    console.log(`  Total resource leaks: ${totalResourceLeaks}`);

    Object.entries(cleanupResults.resourceLeaks).forEach(([resourceType, leaks]) => {
      const totalLeaks = leaks.reduce((a, b) => a + b, 0);
      if (totalLeaks > 0) {
        console.log(`  ${resourceType}: ${totalLeaks} leaked resources`);
      }
    });

    // Cleanup efficiency validation
    expect(averageCleanupEfficiency).toBeGreaterThan(0.8); // 80% average cleanup efficiency
    expect(worstCleanupEfficiency).toBeGreaterThan(0.6); // 60% minimum cleanup efficiency
    expect(totalResourceLeaks).toBeLessThan(cleanupConfig.resourceLeakThreshold * cleanupConfig.stressCycles);

    // Final memory state verification
    const finalResourceState = await page.evaluate(() => {
      const finalSnapshot = window.enhancedMemoryTracker.takeSnapshot('final_state');
      return {
        memory: finalSnapshot.memory.used,
        canvases: finalSnapshot.resources.canvases,
        eventListeners: finalSnapshot.resources.eventListeners,
        timers: finalSnapshot.resources.timers
      };
    });

    console.log('\n✅ Final Resource State:');
    console.log(`  Memory: ${(finalResourceState.memory / 1024 / 1024).toFixed(1)}MB`);
    console.log(`  Remaining canvases: ${finalResourceState.canvases}`);
    console.log(`  Remaining event listeners: ${finalResourceState.eventListeners}`);
    console.log(`  Remaining timers: ${finalResourceState.timers}`);

    // Final validation
    expect(finalResourceState.canvases).toBe(0);
    expect(finalResourceState.timers).toBeLessThan(5); // Allow a few system timers

    console.log('✅ Resource cleanup efficiency test completed successfully');
  });
});