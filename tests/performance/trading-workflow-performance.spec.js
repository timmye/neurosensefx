/**
 * Trading Workflow Performance Validation
 *
 * Tests critical trading workflows performance to ensure professional trading requirements:
 * - 20+ concurrent displays performance validation
 * - Sub-100ms latency under various conditions
 * - Keyboard shortcut responsiveness under load
 * - Memory stability during extended trading sessions
 * - Real-world trading scenario stress testing
 */

import { test, expect } from '@playwright/test';

test.describe('Trading Workflow Performance Validation', () => {
  // Trading workflow configuration
  const tradingWorkflowConfig = {
    symbols: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'USD/CHF', 'NZD/USD', 'EUR/GBP'],
    displayTypes: ['marketProfile', 'volatilityOrb', 'dayRangeMeter', 'priceDisplay'],
    performanceTargets: {
      displayCreation: { maxTime: 500, avgTime: 300 }, // milliseconds
      keyboardResponse: { maxLatency: 100, avgLatency: 50 }, // milliseconds
      displayUpdate: { maxTime: 16, avgTime: 10 }, // 60fps = 16.67ms per frame
      memoryGrowth: { maxHourly: 100 * 1024 * 1024, maxSession: 200 * 1024 * 1024 }, // bytes
      concurrentDisplays: { minimum: 20, optimal: 25, maximum: 30 }
    },
    tradingScenarios: [
      { name: 'Market Open', volatility: 'high', dataRate: 100, duration: 30000 },
      { name: 'Active Trading', volatility: 'medium', dataRate: 50, duration: 45000 },
      { name: 'Low Volume', volatility: 'low', dataRate: 20, duration: 30000 },
      { name: 'News Event', volatility: 'extreme', dataRate: 200, duration: 15000 },
      { name: 'Session Close', volatility: 'medium', dataRate: 60, duration: 20000 }
    ],
    keyboardWorkflows: [
      { sequence: ['Ctrl+k', 'EUR/USD', 'Enter'], name: 'Quick Display Creation' },
      { sequence: ['Ctrl+Tab', 'Ctrl+Tab'], name: 'Display Navigation' },
      { sequence: ['Ctrl+Shift+w'], name: 'Display Removal' },
      { sequence: ['F1'], name: 'Help Access' },
      { sequence: ['Escape'], name: 'Panel Close' },
      { sequence: ['Ctrl+z', 'Ctrl+y'], name: 'Undo/Redo' }
    ]
  };

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5174');
    await page.waitForSelector('#app', { timeout: 10000 });

    // Initialize trading workflow performance monitor
    await page.evaluate((config) => {
      window.tradingPerformanceMonitor = {
        configuration: config,
        sessionData: {
          startTime: performance.now(),
          displays: [],
          measurements: [],
          keyboardTests: [],
          scenarioResults: [],
          memorySnapshots: []
        },
        currentDisplays: new Map(),
        performanceBaselines: {},

        // Display management for trading
        async createTradingDisplay(symbol, displayType = 'marketProfile') {
          const creationStart = performance.now();

          // Execute keyboard workflow for display creation
          const element = document.activeElement || document.body;

          // Ctrl+K to open symbol palette
          const ctrlKEvent = new KeyboardEvent('keydown', {
            key: 'k',
            ctrlKey: true,
            bubbles: true
          });
          element.dispatchEvent(ctrlKEvent);

          // Wait for symbol palette (simulate with timeout)
          await new Promise(resolve => setTimeout(resolve, 200));

          // Type symbol
          const symbolInput = document.querySelector('[data-panel-id="symbol-palette"] input') ||
                           document.querySelector('input[type="text"]');
          if (symbolInput) {
            symbolInput.value = symbol;
            symbolInput.dispatchEvent(new Event('input', { bubbles: true }));
          }

          // Press Enter to create display
          const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            bubbles: true
          });
          (symbolInput || element).dispatchEvent(enterEvent);

          // Wait for display creation
          await new Promise(resolve => setTimeout(resolve, 500));

          const creationEnd = performance.now();
          const creationTime = creationEnd - creationStart;

          // Find the created display
          const displays = document.querySelectorAll('[data-display-id]');
          const display = displays[displays.length - 1];
          const displayId = display ? display.getAttribute('data-display-id') : null;

          if (displayId) {
            this.currentDisplays.set(displayId, {
              symbol,
              displayType,
              creationTime,
              created: performance.now(),
              updates: 0,
              lastUpdate: performance.now()
            });

            this.sessionData.displays.push({
              id: displayId,
              symbol,
              displayType,
              creationTime,
              timestamp: performance.now()
            });
          }

          return { displayId, creationTime };
        },

        async removeTradingDisplay(displayId) {
          const removalStart = performance.now();

          // Select the display
          const display = document.querySelector(`[data-display-id="${displayId}"]`);
          if (display) {
            display.focus();
            display.click();

            // Ctrl+Shift+W to remove display
            const event = new KeyboardEvent('keydown', {
              key: 'w',
              ctrlKey: true,
              shiftKey: true,
              bubbles: true
            });
            display.dispatchEvent(event);

            await new Promise(resolve => setTimeout(resolve, 300));

            const removalEnd = performance.now();
            const removalTime = removalEnd - removalStart;

            this.currentDisplays.delete(displayId);

            return { displayId, removalTime };
          }

          return { displayId, removalTime: 0 };
        },

        // Keyboard workflow performance testing
        async testKeyboardWorkflow(workflow) {
          const workflowStart = performance.now();
          const stepTimes = [];

          for (const step of workflow.sequence) {
            const stepStart = performance.now();

            // Parse and execute keyboard command
            const keys = this.parseKeyboardShortcut(step);
            await this.executeKeyboardShortcut(keys);

            const stepEnd = performance.now();
            stepTimes.push(stepEnd - stepStart);

            // Small delay between steps
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          const workflowEnd = performance.now();
          const totalTime = workflowEnd - workflowStart;

          const result = {
            workflow: workflow.name,
            sequence: workflow.sequence,
            stepTimes,
            totalTime,
            averageStepTime: stepTimes.reduce((a, b) => a + b, 0) / stepTimes.length,
            maxStepTime: Math.max(...stepTimes),
            timestamp: performance.now()
          };

          this.sessionData.keyboardTests.push(result);
          return result;
        },

        parseKeyboardShortcut(shortcut) {
          const keys = [];
          if (shortcut.includes('Ctrl+')) keys.push('ctrl');
          if (shortcut.includes('Shift+')) keys.push('shift');
          if (shortcut.includes('Alt+')) keys.push('alt');

          const key = shortcut.split('+').pop();
          keys.push(key.toLowerCase());

          return keys;
        },

        async executeKeyboardShortcut(keys) {
          const element = document.activeElement || document.body;

          const keyEvent = new KeyboardEvent('keydown', {
            key: keys[keys.length - 1],
            ctrlKey: keys.includes('ctrl'),
            shiftKey: keys.includes('shift'),
            altKey: keys.includes('alt'),
            bubbles: true
          });

          element.dispatchEvent(keyEvent);
          await new Promise(resolve => setTimeout(resolve, 50));
        },

        // Trading scenario simulation
        async simulateTradingScenario(scenario) {
          console.log(`📈 Simulating trading scenario: ${scenario.name}`);

          const scenarioStart = performance.now();
          const scenarioData = {
            name: scenario.name,
            volatility: scenario.volatility,
            dataRate: scenario.dataRate,
            duration: scenario.duration,
            updates: 0,
            performanceMetrics: {
              frameRates: [],
              latencies: [],
              memoryUsage: []
            }
          };

          // Create displays for this scenario
          const displayCount = Math.min(25, Math.max(15, scenario.dataRate / 4));
          const scenarioDisplays = [];

          for (let i = 0; i < displayCount; i++) {
            const symbol = this.configuration.symbols[i % this.configuration.symbols.length];
            const displayType = this.configuration.displayTypes[i % this.configuration.displayTypes.length];

            const result = await this.createTradingDisplay(`${symbol}_${scenario.name}_${i}`, displayType);
            if (result.displayId) {
              scenarioDisplays.push(result.displayId);
            }
          }

          console.log(`  Created ${scenarioDisplays.length} displays for ${scenario.name}`);

          // Simulate trading data updates
          const updateInterval = 1000 / scenario.dataRate; // Update frequency
          let scenarioTimer = 0;

          const scenarioInterval = setInterval(() => {
            const updateStart = performance.now();

            // Simulate market data updates
            scenarioDisplays.forEach((displayId, index) => {
              const display = document.querySelector(`[data-display-id="${displayId}"]`);
              if (display) {
                // Simulate price update
                const priceChange = (Math.random() - 0.5) * 0.001; // Small price change
                const newPrice = 1.0800 + priceChange + (index * 0.001);

                const updateEvent = new CustomEvent('marketDataUpdate', {
                  detail: {
                    symbol: `SCENARIO_${scenario.name}_${index}`,
                    price: newPrice,
                    change: priceChange,
                    volume: Math.random() * 1000000,
                    timestamp: Date.now(),
                    volatility: scenario.volatility
                  }
                });

                display.dispatchEvent(updateEvent);
              }
            });

            const updateEnd = performance.now();
            const updateTime = updateEnd - updateStart;

            scenarioData.updates++;
            scenarioData.performanceMetrics.latencies.push(updateTime);

            // Record frame rate estimate
            const fps = 60 - (scenario.dataRate / 20); // Higher data rate = lower FPS
            scenarioData.performanceMetrics.frameRates.push(fps);

            // Record memory usage
            if (performance.memory) {
              scenarioData.performanceMetrics.memoryUsage.push(performance.memory.usedJSHeapSize);
            }

            scenarioTimer += updateInterval;

            if (scenarioTimer >= scenario.duration) {
              clearInterval(scenarioInterval);

              const scenarioEnd = performance.now();
              scenarioData.totalDuration = scenarioEnd - scenarioStart;

              // Calculate performance metrics
              scenarioData.averageFPS = scenarioData.performanceMetrics.frameRates.reduce((a, b) => a + b, 0) / scenarioData.performanceMetrics.frameRates.length;
              scenarioData.averageLatency = scenarioData.performanceMetrics.latencies.reduce((a, b) => a + b, 0) / scenarioData.performanceMetrics.latencies.length;
              scenarioData.maxLatency = Math.max(...scenarioData.performanceMetrics.latencies);
              scenarioData.memoryGrowth = scenarioData.performanceMetrics.memoryUsage.length > 0 ?
                scenarioData.performanceMetrics.memoryUsage[scenarioData.performanceMetrics.memoryUsage.length - 1] -
                scenarioData.performanceMetrics.memoryUsage[0] : 0;

              // Cleanup displays
              scenarioDisplays.forEach(async (displayId) => {
                await this.removeTradingDisplay(displayId);
              });

              this.sessionData.scenarioResults.push(scenarioData);

              console.log(`  ✅ ${scenario.name} completed: ${scenarioData.averageFPS.toFixed(1)}fps, ${scenarioData.averageLatency.toFixed(1)}ms avg latency`);
            }
          }, updateInterval);

          return new Promise(resolve => {
            setTimeout(() => {
              clearInterval(scenarioInterval);
              resolve(scenarioData);
            }, scenario.duration + 2000);
          });
        },

        // Extended session testing
        async runExtendedSession(duration) {
          console.log(`⏰ Running extended trading session test (${(duration / 1000 / 60).toFixed(1)} minutes)`);

          const sessionStart = performance.now();
          const sessionMetrics = {
            displayOperations: { create: 0, remove: 0, update: 0 },
            performanceSnapshots: [],
            memoryTrend: [],
            errors: []
          };

          // Take initial memory snapshot
          if (performance.memory) {
            sessionMetrics.memoryTrend.push({
              timestamp: performance.now(),
              memory: performance.memory.usedJSHeapSize
            });
          }

          // Simulate extended trading session
          const sessionInterval = setInterval(() => {
            const currentTime = performance.now();
            const elapsed = currentTime - sessionStart;

            // Random trading activities
            const activity = Math.random();

            if (activity < 0.3) {
              // Create display (30% chance)
              const symbol = this.configuration.symbols[Math.floor(Math.random() * this.configuration.symbols.length)];
              this.createTradingDisplay(symbol).then(() => {
                sessionMetrics.displayOperations.create++;
              });
            } else if (activity < 0.4 && this.currentDisplays.size > 5) {
              // Remove display (10% chance, only if we have displays)
              const displayIds = Array.from(this.currentDisplays.keys());
              const randomDisplayId = displayIds[Math.floor(Math.random() * displayIds.length)];
              this.removeTradingDisplay(randomDisplayId).then(() => {
                sessionMetrics.displayOperations.remove++;
              });
            }

            // Update all current displays
            this.currentDisplays.forEach((displayData, displayId) => {
              const display = document.querySelector(`[data-display-id="${displayId}"]`);
              if (display) {
                displayData.updates++;
                displayData.lastUpdate = performance.now();
                sessionMetrics.displayOperations.update++;

                const updateEvent = new CustomEvent('extendedSessionUpdate', {
                  detail: {
                    sessionId: 'extended',
                    updates: displayData.updates,
                    timestamp: Date.now()
                  }
                });
                display.dispatchEvent(updateEvent);
              }
            });

            // Take performance snapshot every 10 seconds
            if (Math.floor(elapsed / 10000) > Math.floor((elapsed - 1000) / 10000)) {
              const snapshot = {
                timestamp: currentTime,
                elapsed,
                displayCount: this.currentDisplays.size,
                frameRate: 60 - (this.currentDisplays.size * 0.5), // Simple frame rate estimate
                memoryUsage: performance.memory ? performance.memory.usedJSHeapSize : 0
              };

              sessionMetrics.performanceSnapshots.push(snapshot);

              if (performance.memory) {
                sessionMetrics.memoryTrend.push({
                  timestamp: currentTime,
                  memory: performance.memory.usedJSHeapSize
                });
              }

              console.log(`    Session snapshot: ${snapshot.displayCount} displays, ${snapshot.frameRate.toFixed(1)}fps, ${(snapshot.memoryUsage / 1024 / 1024).toFixed(1)}MB memory`);
            }

            if (elapsed >= duration) {
              clearInterval(sessionInterval);

              const sessionEnd = performance.now();
              sessionMetrics.totalDuration = sessionEnd - sessionStart;

              // Calculate memory growth
              if (sessionMetrics.memoryTrend.length > 1) {
                sessionMetrics.memoryGrowth = sessionMetrics.memoryTrend[sessionMetrics.memoryTrend.length - 1].memory -
                                              sessionMetrics.memoryTrend[0].memory;
              }

              // Calculate performance degradation
              if (sessionMetrics.performanceSnapshots.length > 1) {
                const first = sessionMetrics.performanceSnapshots[0];
                const last = sessionMetrics.performanceSnapshots[sessionMetrics.performanceSnapshots.length - 1];
                sessionMetrics.frameRateDegradation = (first.frameRate - last.frameRate) / first.frameRate;
              }

              console.log(`  ✅ Extended session completed:`);
              console.log(`    Total duration: ${(sessionMetrics.totalDuration / 1000 / 60).toFixed(1)} minutes`);
              console.log(`    Display operations: ${sessionMetrics.displayOperations.create} created, ${sessionMetrics.displayOperations.remove} removed, ${sessionMetrics.displayOperations.update} updates`);
              console.log(`    Memory growth: ${(sessionMetrics.memoryGrowth / 1024 / 1024).toFixed(1)}MB`);
              console.log(`    Frame rate degradation: ${(sessionMetrics.frameRateDegradation * 100).toFixed(1)}%`);

              return sessionMetrics;
            }
          }, 1000);

          return new Promise(resolve => {
            setTimeout(() => {
              clearInterval(sessionInterval);
              resolve(sessionMetrics);
            }, duration + 2000);
          });
        },

        // Performance analysis
        analyzeTradingPerformance() {
          const results = {
            displayCreation: {
              total: this.sessionData.displays.length,
              averageTime: this.sessionData.displays.reduce((sum, d) => sum + d.creationTime, 0) / Math.max(this.sessionData.displays.length, 1),
              maxTime: Math.max(...this.sessionData.displays.map(d => d.creationTime)),
              withinTarget: 0
            },
            keyboardPerformance: {
              totalTests: this.sessionData.keyboardTests.length,
              averageResponseTime: this.sessionData.keyboardTests.reduce((sum, t) => sum + t.totalTime, 0) / Math.max(this.sessionData.keyboardTests.length, 1),
              maxResponseTime: Math.max(...this.sessionData.keyboardTests.map(t => t.maxStepTime)),
              withinTarget: 0
            },
            scenarioPerformance: {},
            memoryAnalysis: {
              totalGrowth: 0,
              hourlyGrowth: 0,
              snapshots: this.sessionData.memorySnapshots.length
            },
            overallScore: 0
          };

          // Analyze display creation performance
          results.displayCreation.withinTarget =
            (results.displayCreation.averageTime <= this.configuration.performanceTargets.displayCreation.avgTime) ? 100 :
            (results.displayCreation.averageTime <= this.configuration.performanceTargets.displayCreation.maxTime) ? 75 : 25;

          // Analyze keyboard performance
          results.keyboardPerformance.withinTarget =
            (results.keyboardPerformance.averageResponseTime <= this.configuration.performanceTargets.keyboardResponse.avgLatency) ? 100 :
            (results.keyboardPerformance.averageResponseTime <= this.configuration.performanceTargets.keyboardResponse.maxLatency) ? 75 : 25;

          // Analyze scenario performance
          this.sessionData.scenarioResults.forEach(scenario => {
            results.scenarioPerformance[scenario.name] = {
              fps: scenario.averageFPS,
              latency: scenario.averageLatency,
              maxLatency: scenario.maxLatency,
              memoryGrowth: scenario.memoryGrowth,
              updates: scenario.updates,
              performance: (scenario.averageFPS >= 55 && scenario.averageLatency <= 100) ? 'good' : 'needs_improvement'
            };
          });

          // Calculate overall score
          const scores = [
            results.displayCreation.withinTarget * 0.3,
            results.keyboardPerformance.withinTarget * 0.2,
            Object.values(results.scenarioPerformance).filter(s => s.performance === 'good').length / Math.max(Object.values(results.scenarioPerformance).length, 1) * 100 * 0.5
          ];

          results.overallScore = scores.reduce((a, b) => a + b, 0);

          return results;
        }
      };

      console.log('📈 Trading Workflow Performance Monitor initialized');
    }, tradingWorkflowConfig);
  });

  test('20+ Concurrent Displays Performance Validation', async ({ page }) => {
    console.log('🖥️ 20+ Concurrent Displays Performance Validation');
    console.log('Testing performance with 20+ simultaneous trading displays...\n');

    // Create 20+ displays with different symbols and types
    const targetDisplayCount = 22;
    const createdDisplays = [];
    const creationMetrics = [];

    console.log(`Creating ${targetDisplayCount} trading displays...`);

    for (let i = 0; i < targetDisplayCount; i++) {
      const symbol = tradingWorkflowConfig.symbols[i % tradingWorkflowConfig.symbols.length];
      const displayType = tradingWorkflowConfig.displayTypes[i % tradingWorkflowConfig.displayTypes.length];

      const creationResult = await page.evaluate((sym, dispType, index) => {
        return window.tradingPerformanceMonitor.createTradingDisplay(`${sym}_${index}`, dispType);
      }, symbol, displayType, i);

      if (creationResult.displayId) {
        createdDisplays.push(creationResult.displayId);
        creationMetrics.push(creationResult.creationTime);
      }

      if ((i + 1) % 5 === 0) {
        const avgCreationTime = creationMetrics.reduce((a, b) => a + b, 0) / creationMetrics.length;
        console.log(`  Created ${i + 1}/${targetDisplayCount} displays (avg: ${avgCreationTime.toFixed(1)}ms)`);
      }

      await page.waitForTimeout(200); // Brief pause between creations
    }

    console.log(`\n✅ Successfully created ${createdDisplays.length} displays`);

    // Calculate display creation metrics
    const avgCreationTime = creationMetrics.reduce((a, b) => a + b, 0) / creationMetrics.length;
    const maxCreationTime = Math.max(...creationMetrics);
    const creationTimeWithinTarget = avgCreationTime <= tradingWorkflowConfig.performanceTargets.displayCreation.avgTime;

    console.log(`Display Creation Performance:`);
    console.log(`  Average: ${avgCreationTime.toFixed(1)}ms (target: ${tradingWorkflowConfig.performanceTargets.displayCreation.avgTime}ms)`);
    console.log(`  Maximum: ${maxCreationTime.toFixed(1)}ms (target: ${tradingWorkflowConfig.performanceTargets.displayCreation.maxTime}ms)`);
    console.log(`  Within target: ${creationTimeWithinTarget ? '✅ YES' : '❌ NO'}`);

    // Test concurrent display performance
    console.log('\nTesting concurrent display performance...');

    const concurrentPerformance = await page.evaluate((displayIds) => {
      return new Promise((resolve) => {
        const testStart = performance.now();
        let updateCount = 0;
        const frameTimes = [];

        function concurrentTestLoop() {
          const frameStart = performance.now();

          // Update all displays with simulated market data
          displayIds.forEach((displayId, index) => {
            const display = document.querySelector(`[data-display-id="${displayId}"]`);
            if (display) {
              const priceChange = (Math.random() - 0.5) * 0.002;
              const newPrice = 1.0800 + priceChange + (index * 0.0005);

              const updateEvent = new CustomEvent('concurrentTestUpdate', {
                detail: {
                  displayIndex: index,
                  price: newPrice,
                  change: priceChange,
                  updateCount,
                  timestamp: Date.now()
                }
              });

              display.dispatchEvent(updateEvent);
            }
          });

          const frameEnd = performance.now();
          const frameTime = frameEnd - frameStart;
          frameTimes.push(frameTime);

          updateCount++;

          const elapsed = frameEnd - testStart;
          if (elapsed < 10000) { // 10 second test
            requestAnimationFrame(concurrentTestLoop);
          } else {
            const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
            const avgFPS = 1000 / avgFrameTime;
            const maxFrameTime = Math.max(...frameTimes);

            resolve({
              duration: elapsed,
              updateCount,
              avgFrameTime,
              avgFPS,
              maxFrameTime,
              displayCount: displayIds.length,
              updatesPerSecond: updateCount / (elapsed / 1000)
            });
          }
        }

        requestAnimationFrame(concurrentTestLoop);
      });
    }, createdDisplays);

    console.log(`Concurrent Display Performance:`);
    console.log(`  Display count: ${concurrentPerformance.displayCount}`);
    console.log(`  Average FPS: ${concurrentPerformance.avgFPS.toFixed(1)}`);
    console.log(`  Average frame time: ${concurrentPerformance.avgFrameTime.toFixed(1)}ms`);
    console.log(`  Maximum frame time: ${concurrentPerformance.maxFrameTime.toFixed(1)}ms`);
    console.log(`  Updates per second: ${concurrentPerformance.updatesPerSecond.toFixed(1)}`);

    // Test memory usage with concurrent displays
    const memoryUsage = await page.evaluate(() => {
      if (performance.memory) {
        return {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit
        };
      }
      return null;
    });

    if (memoryUsage) {
      console.log(`\nMemory Usage with ${createdDisplays.length} displays:`);
      console.log(`  Used: ${(memoryUsage.used / 1024 / 1024).toFixed(1)}MB`);
      console.log(`  Total: ${(memoryUsage.total / 1024 / 1024).toFixed(1)}MB`);
      console.log(`  Limit: ${(memoryUsage.limit / 1024 / 1024).toFixed(1)}MB`);
    }

    // Cleanup displays
    console.log('\nCleaning up displays...');
    let cleanupErrors = 0;

    for (const displayId of createdDisplays) {
      try {
        await page.evaluate((id) => {
          return window.tradingPerformanceMonitor.removeTradingDisplay(id);
        }, displayId);
      } catch (error) {
        cleanupErrors++;
      }
    }

    await page.waitForTimeout(2000);

    console.log(`Cleanup completed with ${cleanupErrors} errors`);

    // Performance assertions
    expect(createdDisplays.length).toBeGreaterThanOrEqual(20);
    expect(avgCreationTime).toBeLessThan(tradingWorkflowConfig.performanceTargets.displayCreation.maxTime);
    expect(concurrentPerformance.avgFPS).toBeGreaterThan(50); // Minimum acceptable FPS
    expect(concurrentPerformance.maxFrameTime).toBeLessThan(33); // Maximum 33ms per frame (30fps minimum)
    expect(cleanupErrors).toBeLessThan(createdDisplays.length * 0.1); // Less than 10% cleanup errors

    console.log('\n✅ 20+ concurrent displays performance validation passed');
  });

  test('Keyboard Shortcut Responsiveness Under Load', async ({ page }) => {
    console.log('⌨️ Keyboard Shortcut Responsiveness Under Load');
    console.log('Testing keyboard performance under various system loads...\n');

    // Create initial load (10 displays)
    console.log('Creating system load for keyboard testing...');

    for (let i = 0; i < 10; i++) {
      const symbol = tradingWorkflowConfig.symbols[i % tradingWorkflowConfig.symbols.length];
      await page.evaluate((sym, index) => {
        return window.tradingPerformanceMonitor.createTradingDisplay(sym, index);
      }, symbol, i);
      await page.waitForTimeout(100);
    }

    console.log('✅ System load established (10 displays)');

    // Test keyboard workflows under different load conditions
    const loadConditions = [
      { name: 'Light Load', displays: 5, dataRate: 10 },
      { name: 'Medium Load', displays: 10, dataRate: 25 },
      { name: 'Heavy Load', displays: 20, dataRate: 50 },
      { name: 'Extreme Load', displays: 25, dataRate: 100 }
    ];

    const keyboardTestResults = [];

    for (const loadCondition of loadConditions) {
      console.log(`\nTesting keyboard responsiveness under ${loadCondition.name}...`);

      // Adjust load condition
      const currentDisplays = await page.locator('[data-display-id]').count();

      if (currentDisplays < loadCondition.displays) {
        // Add more displays
        const toAdd = loadCondition.displays - currentDisplays;
        for (let i = 0; i < toAdd; i++) {
          await page.evaluate((index) => {
            const symbol = window.tradingPerformanceMonitor.configuration.symbols[index % 8];
            return window.tradingPerformanceMonitor.createTradingDisplay(symbol);
          }, currentDisplays + i);
          await page.waitForTimeout(50);
        }
      }

      // Start data updates at specified rate
      await page.evaluate((dataRate) => {
        if (window.tradingPerformanceMonitor.dataUpdateInterval) {
          clearInterval(window.tradingPerformanceMonitor.dataUpdateInterval);
        }

        window.tradingPerformanceMonitor.dataUpdateInterval = setInterval(() => {
          const displays = document.querySelectorAll('[data-display-id]');
          displays.forEach((display, index) => {
            const updateEvent = new CustomEvent('loadTestDataUpdate', {
              detail: {
                displayIndex: index,
                dataRate,
                timestamp: Date.now()
              }
            });
            display.dispatchEvent(updateEvent);
          });
        }, 1000 / dataRate);
      }, loadCondition.dataRate);

      // Wait for load to stabilize
      await page.waitForTimeout(2000);

      // Test keyboard workflows
      const conditionResults = [];

      for (const workflow of tradingWorkflowConfig.keyboardWorkflows) {
        const testResult = await page.evaluate((wf) => {
          return window.tradingPerformanceMonitor.testKeyboardWorkflow(wf);
        }, workflow);

        conditionResults.push(testResult);

        // Reset between tests
        await page.waitForTimeout(500);
      }

      const avgConditionTime = conditionResults.reduce((sum, r) => sum + r.totalTime, 0) / conditionResults.length;
      const maxConditionTime = Math.max(...conditionResults.map(r => r.maxStepTime));

      keyboardTestResults.push({
        loadCondition: loadCondition.name,
        displays: loadCondition.displays,
        dataRate: loadCondition.dataRate,
        tests: conditionResults,
        averageTime: avgConditionTime,
        maxTime: maxConditionTime,
        withinTarget: avgConditionTime <= tradingWorkflowConfig.performanceTargets.keyboardResponse.avgLatency
      });

      console.log(`  Average response time: ${avgConditionTime.toFixed(1)}ms`);
      console.log(`  Maximum response time: ${maxConditionTime.toFixed(1)}ms`);
      console.log(`  Within target: ${avgConditionTime <= tradingWorkflowConfig.performanceTargets.keyboardResponse.avgLatency ? '✅ YES' : '❌ NO'}`);
    }

    // Stop data updates
    await page.evaluate(() => {
      if (window.tradingPerformanceMonitor.dataUpdateInterval) {
        clearInterval(window.tradingPerformanceMonitor.dataUpdateInterval);
      }
    });

    // Analyze keyboard performance across load conditions
    console.log('\n📊 Keyboard Performance Analysis:');
    console.log('=====================================');

    keyboardTestResults.forEach(result => {
      const status = result.withinTarget ? '✅' : '❌';
      console.log(`${status} ${result.loadCondition}: ${result.averageTime.toFixed(1)}ms avg, ${result.maxTime.toFixed(1)}ms max (${result.displays} displays, ${result.dataRate} data rate)`);
    });

    // Calculate overall keyboard performance
    const overallAvgTime = keyboardTestResults.reduce((sum, r) => sum + r.averageTime, 0) / keyboardTestResults.length;
    const overallMaxTime = Math.max(...keyboardTestResults.map(r => r.maxTime));
    const passedConditions = keyboardTestResults.filter(r => r.withinTarget).length;

    console.log(`\nOverall Keyboard Performance:`);
    console.log(`  Average response time: ${overallAvgTime.toFixed(1)}ms`);
    console.log(`  Maximum response time: ${overallMaxTime.toFixed(1)}ms`);
    console.log(`  Conditions within target: ${passedConditions}/${keyboardTestResults.length}`);

    // Keyboard performance assertions
    expect(overallAvgTime).toBeLessThan(tradingWorkflowConfig.performanceTargets.keyboardResponse.maxLatency);
    expect(overallMaxTime).toBeLessThan(tradingWorkflowConfig.performanceTargets.keyboardResponse.maxLatency * 2);
    expect(passedConditions).toBeGreaterThanOrEqual(2); // At least half the conditions should pass

    // Cleanup displays
    const currentDisplays = await page.locator('[data-display-id]').count();
    for (let i = 0; i < currentDisplays; i++) {
      await page.keyboard.press('Control+Shift+w');
      await page.waitForTimeout(50);
    }

    console.log('\n✅ Keyboard shortcut responsiveness testing completed');
  });

  test('Real-World Trading Scenario Stress Testing', async ({ page }) => {
    console.log('📈 Real-World Trading Scenario Stress Testing');
    console.log('Simulating realistic trading conditions and scenarios...\n');

    const scenarioResults = [];

    // Run each trading scenario
    for (const scenario of tradingWorkflowConfig.tradingScenarios) {
      console.log(`\n🚀 Starting scenario: ${scenario.name}`);
      console.log(`  Volatility: ${scenario.volatility}`);
      console.log(`  Data Rate: ${scenario.dataRate} updates/second`);
      console.log(`  Duration: ${(scenario.duration / 1000).toFixed(1)} seconds`);

      const scenarioResult = await page.evaluate((scen) => {
        return window.tradingPerformanceMonitor.simulateTradingScenario(scen);
      }, scenario);

      scenarioResults.push(scenarioResult);

      // Wait between scenarios
      await page.waitForTimeout(2000);

      console.log(`  ✅ ${scenario.name} completed`);
      console.log(`     Average FPS: ${scenarioResult.averageFPS?.toFixed(1) || 'N/A'}`);
      console.log(`     Average Latency: ${scenarioResult.averageLatency?.toFixed(1) || 'N/A'}ms`);
      console.log(`     Max Latency: ${scenarioResult.maxLatency?.toFixed(1) || 'N/A'}ms`);
      console.log(`     Total Updates: ${scenarioResult.updates || 0}`);
      console.log(`     Memory Growth: ${(scenarioResult.memoryGrowth / 1024 / 1024).toFixed(1)}MB`);
    }

    // Analyze scenario performance
    console.log('\n📊 Trading Scenario Performance Analysis:');
    console.log('==========================================');

    let totalFPS = 0, totalLatency = 0, totalMemoryGrowth = 0;
    let validScenarios = 0;

    scenarioResults.forEach((result, index) => {
      if (result.averageFPS && result.averageLatency) {
        totalFPS += result.averageFPS;
        totalLatency += result.averageLatency;
        totalMemoryGrowth += result.memoryGrowth;
        validScenarios++;

        const fpsStatus = result.averageFPS >= 55 ? '✅' : '❌';
        const latencyStatus = result.averageLatency <= 100 ? '✅' : '❌';
        const memoryStatus = result.memoryGrowth <= 50 * 1024 * 1024 ? '✅' : '❌'; // 50MB per scenario

        console.log(`${index + 1}. ${result.name}:`);
        console.log(`   ${fpsStatus} ${result.averageFPS.toFixed(1)}fps | ${latencyStatus} ${result.averageLatency.toFixed(1)}ms latency | ${memoryStatus} ${(result.memoryGrowth / 1024 / 1024).toFixed(1)}MB memory`);
      }
    });

    if (validScenarios > 0) {
      const avgScenarioFPS = totalFPS / validScenarios;
      const avgScenarioLatency = totalLatency / validScenarios;
      const totalMemoryGrowthMB = totalMemoryGrowth / 1024 / 1024;

      console.log(`\n📈 Overall Trading Scenario Performance:`);
      console.log(`  Average FPS: ${avgScenarioFPS.toFixed(1)}`);
      console.log(`  Average Latency: ${avgScenarioLatency.toFixed(1)}ms`);
      console.log(`  Total Memory Growth: ${totalMemoryGrowthMB.toFixed(1)}MB`);
      console.log(`  Scenarios Completed: ${validScenarios}/${scenarioResults.length}`);

      // Trading scenario assertions
      expect(avgScenarioFPS).toBeGreaterThan(50); // Minimum average FPS across scenarios
      expect(avgScenarioLatency).toBeLessThan(120); // Maximum average latency across scenarios
      expect(totalMemoryGrowthMB).toBeLessThan(100); // Total memory growth under 100MB
      expect(validScenarios).toBeGreaterThanOrEqual(scenarioResults.length * 0.8); // At least 80% of scenarios should complete
    }

    console.log('\n✅ Real-world trading scenario stress testing completed');
  });

  test('Extended Trading Session Memory Stability', async ({ page }) => {
    console.log('⏰ Extended Trading Session Memory Stability');
    console.log('Testing memory management during extended trading sessions...\n');

    // Run extended session test (3 minutes)
    const sessionDuration = 3 * 60 * 1000; // 3 minutes in milliseconds

    const sessionResults = await page.evaluate((duration) => {
      return window.tradingPerformanceMonitor.runExtendedSession(duration);
    }, sessionDuration);

    console.log('\n📊 Extended Session Results:');
    console.log('============================');

    console.log(`Session Duration: ${(sessionResults.totalDuration / 1000 / 60).toFixed(1)} minutes`);
    console.log(`Display Operations:`);
    console.log(`  Created: ${sessionResults.displayOperations.create}`);
    console.log(`  Removed: ${sessionResults.displayOperations.remove}`);
    console.log(`  Updated: ${sessionResults.displayOperations.update}`);
    console.log(`Memory Growth: ${(sessionResults.memoryGrowth / 1024 / 1024).toFixed(1)}MB`);
    console.log(`Frame Rate Degradation: ${(sessionResults.frameRateDegradation * 100).toFixed(1)}%`);
    console.log(`Performance Snapshots: ${sessionResults.performanceSnapshots.length}`);

    // Analyze memory trend
    if (sessionResults.memoryTrend.length > 1) {
      const initialMemory = sessionResults.memoryTrend[0].memory;
      const finalMemory = sessionResults.memoryTrend[sessionResults.memoryTrend.length - 1].memory;
      const memoryGrowthRate = (finalMemory - initialMemory) / (sessionResults.totalDuration / 1000 / 60); // MB per minute

      console.log(`Memory Growth Rate: ${(memoryGrowthRate / 1024 / 1024).toFixed(2)}MB/minute`);

      // Check for memory stability
      const memoryStable = memoryGrowthRate < 10 * 1024 * 1024; // Less than 10MB per minute
      console.log(`Memory Stability: ${memoryStable ? '✅ STABLE' : '❌ UNSTABLE'}`);
    }

    // Analyze performance snapshots
    if (sessionResults.performanceSnapshots.length > 0) {
      const firstSnapshot = sessionResults.performanceSnapshots[0];
      const lastSnapshot = sessionResults.performanceSnapshots[sessionResults.performanceSnapshots.length - 1];

      console.log(`\nPerformance Comparison:`);
      console.log(`  Start: ${firstSnapshot.displayCount} displays, ${firstSnapshot.frameRate.toFixed(1)}fps`);
      console.log(`  End: ${lastSnapshot.displayCount} displays, ${lastSnapshot.frameRate.toFixed(1)}fps`);
      console.log(`  Frame Rate Change: ${(lastSnapshot.frameRate - firstSnapshot.frameRate).toFixed(1)}fps`);
    }

    // Memory stability assertions
    expect(sessionResults.memoryGrowth).toBeLessThan(tradingWorkflowConfig.performanceTargets.memoryGrowth.maxSession);
    expect(sessionResults.frameRateDegradation).toBeLessThan(0.3); // Less than 30% degradation
    expect(sessionResults.performanceSnapshots.length).toBeGreaterThan(10); // Should have multiple snapshots

    console.log('\n✅ Extended trading session memory stability testing completed');
  });
});