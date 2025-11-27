/**
 * Real-World Trading Scenario Performance Tests
 *
 * Simulates actual professional trading workflows including:
 * - Active market data updates during trading sessions
 * - Rapid display switching and keyboard shortcut usage
 * - High-frequency price movements and visual updates
 * - Multi-instrument monitoring scenarios
 */

import { test, expect } from '@playwright/test';

test.describe('Real-World Trading Scenario Performance Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('#app', { timeout: 15000 });

    // Initialize trading scenario simulator
    await page.evaluate(() => {
      window.tradingSimulator = {
        instruments: [
          { symbol: 'EUR/USD', basePrice: 1.0845, volatility: 0.0002 },
          { symbol: 'GBP/USD', basePrice: 1.2743, volatility: 0.0003 },
          { symbol: 'USD/JPY', basePrice: 149.85, volatility: 0.05 },
          { symbol: 'AUD/USD', basePrice: 0.6542, volatility: 0.0003 },
          { symbol: 'USD/CAD', basePrice: 1.3621, volatility: 0.0002 },
          { symbol: 'EUR/GBP', basePrice: 0.8512, volatility: 0.0002 },
          { symbol: 'USD/CHF', basePrice: 0.8845, volatility: 0.0002 },
          { symbol: 'NZD/USD', basePrice: 0.6142, volatility: 0.0003 }
        ],

        marketSessions: [
          { name: 'London', active: true, volume: 1.2 },
          { name: 'New York', active: true, volume: 1.5 },
          { name: 'Tokyo', active: false, volume: 0.8 },
          { name: 'Sydney', active: false, volume: 0.6 }
        ],

        activeTrades: [],
        priceHistory: new Map(),
        performanceMetrics: {
          marketDataUpdates: 0,
          displayUpdates: 0,
          userInteractions: 0,
          responseTimes: []
        },

        startSimulation() {
          this.startTime = performance.now();
          this.priceHistory.clear();
          this.activeTrades = [];
          this.performanceMetrics = {
            marketDataUpdates: 0,
            displayUpdates: 0,
            userInteractions: 0,
            responseTimes: []
          };

          // Initialize price history
          this.instruments.forEach(instrument => {
            this.priceHistory.set(instrument.symbol, []);
          });

          console.log('🏦 Trading simulation started');
        },

        generateMarketData() {
          const updates = [];
          const currentTime = Date.now();
          const activeVolume = this.marketSessions
            .filter(session => session.active)
            .reduce((sum, session) => sum + session.volume, 0);

          this.instruments.forEach(instrument => {
            // Generate realistic price movement
            const sessionMultiplier = activeVolume || 0.5;
            const volatility = instrument.volatility * sessionMultiplier;
            const trend = Math.sin(currentTime / 10000) * 0.0001; // Slow trend
            const noise = (Math.random() - 0.5) * volatility;
            const priceChange = trend + noise;

            const lastPrice = instrument.basePrice + (this.priceHistory.get(instrument.symbol).slice(-1)[0]?.change || 0);
            const newPrice = Math.max(0.0001, lastPrice + priceChange);

            const priceUpdate = {
              symbol: instrument.symbol,
              price: newPrice,
              change: priceChange,
              changePercent: (priceChange / lastPrice) * 100,
              volume: Math.floor(Math.random() * 10000000) + 1000000,
              timestamp: currentTime,
              sessionVolume: activeVolume
            };

            updates.push(priceUpdate);
            this.priceHistory.get(instrument.symbol).push(priceUpdate);

            // Keep only recent history
            if (this.priceHistory.get(instrument.symbol).length > 1000) {
              this.priceHistory.get(instrument.symbol).shift();
            }
          });

          this.performanceMetrics.marketDataUpdates++;
          return updates;
        },

        simulateTradingActivity(displayIds) {
          const activities = [];

          // Simulate rapid price updates during active trading
          displayIds.forEach((displayId, index) => {
            const display = document.querySelector(`[data-display-id="${displayId}"]`);
            if (display) {
              const instrument = this.instruments[index % this.instruments.length];
              const marketData = this.generateMarketData();
              const relevantData = marketData.find(data => data.symbol === instrument.symbol);

              if (relevantData) {
                const event = new CustomEvent('marketDataUpdate', {
                  detail: relevantData
                });
                display.dispatchEvent(event);
                this.performanceMetrics.displayUpdates++;
                activities.push({
                  type: 'marketData',
                  displayId,
                  symbol: instrument.symbol,
                  price: relevantData.price,
                  change: relevantData.change
                });
              }

              // Simulate user interactions (keyboard shortcuts, clicks)
              if (Math.random() < 0.1) { // 10% chance per update
                this.simulateUserInteraction(displayId);
                activities.push({
                  type: 'userInteraction',
                  displayId,
                  timestamp: Date.now()
                });
              }
            }
          });

          return activities;
        },

        simulateUserInteraction(displayId) {
          const interactionStart = performance.now();

          // Simulate various keyboard shortcuts
          const shortcuts = [
            { keys: 'Tab', description: 'Focus next display' },
            { keys: 'F1', description: 'Toggle help' },
            { keys: 'F2', description: 'Switch visualization' },
            { keys: 'F3', description: 'Toggle grid' },
            { keys: 'Ctrl+1', description: 'Set timeframe 1m' },
            { keys: 'Ctrl+5', description: 'Set timeframe 5m' },
            { keys: 'Ctrl+Tab', description: 'Cycle displays' },
            { keys: 'Enter', description: 'Confirm action' },
            { keys: 'Escape', description: 'Cancel action' }
          ];

          const shortcut = shortcuts[Math.floor(Math.random() * shortcuts.length)];

          const event = new KeyboardEvent('keydown', {
            key: shortcut.keys.includes('+') ? shortcut.keys.split('+')[1] : shortcut.keys,
            ctrlKey: shortcut.keys.includes('Ctrl'),
            code: `Key${shortcut.keys.split('+')[1] || shortcut.keys.toUpperCase()}`,
            bubbles: true
          });

          document.querySelector(`[data-display-id="${displayId}"]`)?.dispatchEvent(event);

          const interactionEnd = performance.now();
          this.performanceMetrics.userInteractions++;
          this.performanceMetrics.responseTimes.push(interactionEnd - interactionStart);

          return {
            shortcut: shortcut.keys,
            description: shortcut.description,
            responseTime: interactionEnd - interactionStart
          };
        },

        getPerformanceReport() {
          const currentTime = performance.now();
          const duration = (currentTime - this.startTime) / 1000; // seconds

          const avgResponseTime = this.performanceMetrics.responseTimes.length > 0 ?
            this.performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) / this.performanceMetrics.responseTimes.length : 0;

          return {
            duration,
            marketDataUpdates: this.performanceMetrics.marketDataUpdates,
            displayUpdates: this.performanceMetrics.displayUpdates,
            userInteractions: this.performanceMetrics.userInteractions,
            averageResponseTime: avgResponseTime,
            maxResponseTime: Math.max(...this.performanceMetrics.responseTimes, 0),
            dataUpdateRate: this.performanceMetrics.marketDataUpdates / duration,
            displayUpdateRate: this.performanceMetrics.displayUpdates / duration,
            interactionRate: this.performanceMetrics.userInteractions / duration
          };
        }
      };

      // Start simulation
      window.tradingSimulator.startSimulation();
    });
  });

  test('high-frequency trading session with active market data', async ({ page }) => {
    console.log('⚡ High-frequency trading session with active market data...');

    const tradingConfig = {
      displayCount: 12,
      sessionDuration: 15000, // 15 seconds compressed session
      marketDataFrequency: 50, // 20 Hz data updates
      userInteractionFrequency: 200, // 5 Hz user interactions
      performanceTargets: {
        dataLatency: 50, // 50ms max data latency
        interactionResponse: 100, // 100ms max interaction response
        minimumFPS: 30, // Minimum 30fps during trading
        memoryGrowth: 100 * 1024 * 1024 // 100MB max growth
      }
    };

    // Create trading displays
    console.log('\n📊 Creating trading displays...');
    const tradingDisplays = [];

    for (let i = 0; i < tradingConfig.displayCount; i++) {
      await page.keyboard.press('Control+k');
      await page.waitForSelector('[data-panel-id="symbol-palette"]', { timeout: 5000 });

      await page.keyboard.press('Control+a');
      const instrument = await page.evaluate((index) => {
        const sim = window.tradingSimulator;
        const instrument = sim.instruments[index % sim.instruments.length];
        return instrument.symbol;
      }, i);
      await page.keyboard.type(`TRADING_${instrument}`);
      await page.waitForTimeout(100);
      await page.keyboard.press('Enter');

      await page.waitForSelector('[data-display-id]', { timeout: 8000 });

      const displayId = await page.evaluate(() => {
        const displays = document.querySelectorAll('[data-display-id]');
        return displays[displays.length - 1].getAttribute('data-display-id');
      });

      tradingDisplays.push(displayId);
    }

    console.log(`✅ Created ${tradingDisplays.length} trading displays`);

    // Start high-frequency trading simulation
    console.log(`\n⚡ Starting ${tradingConfig.sessionDuration / 1000}s trading simulation...`);

    const tradingResults = await page.evaluate(async (displayIds, config) => {
      const sim = window.tradingSimulator;
      const results = {
        startTime: Date.now(),
        activities: [],
        performanceMetrics: {
          frameRate: { samples: [], average: 0, min: 60, max: 0 },
          memory: { samples: [], growth: 0, peak: 0 },
          dataLatency: { samples: [], average: 0, max: 0 },
          interactions: { count: 0, responseTimes: [], average: 0 }
        },
        marketDataEvents: 0,
        displayUpdateEvents: 0
      };

      let frameCount = 0;
      const sessionStart = performance.now();

      function tradingLoop() {
        const currentTime = performance.now();
        const elapsed = currentTime - sessionStart;

        if (elapsed < config.sessionDuration) {
          // Frame rate measurement
          const frameStart = performance.now();

          // High-frequency market data updates
          if (frameCount % Math.floor(config.marketDataFrequency / 20) === 0) { // 20 FPS base rate
            const dataUpdateStart = performance.now();
            const activities = sim.simulateTradingActivity(displayIds);
            const dataUpdateEnd = performance.now();
            const dataLatency = dataUpdateEnd - dataUpdateStart;

            results.marketDataEvents += activities.filter(a => a.type === 'marketData').length;
            results.displayUpdateEvents += activities.filter(a => a.type === 'marketData').length;

            results.performanceMetrics.dataLatency.samples.push(dataLatency);
            results.performanceMetrics.dataLatency.max = Math.max(
              results.performanceMetrics.dataLatency.max, dataLatency
            );
          }

          // User interaction simulation
          if (frameCount % Math.floor(config.userInteractionFrequency / 20) === 0) {
            const randomDisplayId = displayIds[Math.floor(Math.random() * displayIds.length)];
            const interaction = sim.simulateUserInteraction(randomDisplayId);

            if (interaction) {
              results.activities.push({
                type: 'interaction',
                ...interaction,
                timestamp: Date.now()
              });

              results.performanceMetrics.interactions.count++;
              results.performanceMetrics.interactions.responseTimes.push(interaction.responseTime);
            }
          }

          // Memory sampling
          if (frameCount % 30 === 0) { // Every 1.5 seconds at 20fps
            const currentMemory = performance.memory?.usedJSHeapSize || 0;
            results.performanceMetrics.memory.samples.push({
              timestamp: Date.now(),
              memory: currentMemory
            });
            results.performanceMetrics.memory.peak = Math.max(results.performanceMetrics.memory.peak, currentMemory);
          }

          // Frame rate calculation
          const frameEnd = performance.now();
          const frameTime = frameEnd - frameStart;
          const currentFPS = 1000 / frameTime;

          results.performanceMetrics.frameRate.samples.push(currentFPS);
          results.performanceMetrics.frameRate.min = Math.min(results.performanceMetrics.frameRate.min, currentFPS);
          results.performanceMetrics.frameRate.max = Math.max(results.performanceMetrics.frameRate.max, currentFPS);

          frameCount++;
          requestAnimationFrame(tradingLoop);
        } else {
          // Calculate final metrics
          const frameRateSamples = results.performanceMetrics.frameRate.samples;
          results.performanceMetrics.frameRate.average =
            frameRateSamples.reduce((a, b) => a + b, 0) / frameRateSamples.length;

          const dataLatencySamples = results.performanceMetrics.dataLatency.samples;
          results.performanceMetrics.dataLatency.average =
            dataLatencySamples.length > 0 ?
            dataLatencySamples.reduce((a, b) => a + b, 0) / dataLatencySamples.length : 0;

          const interactionSamples = results.performanceMetrics.interactions.responseTimes;
          results.performanceMetrics.interactions.average =
            interactionSamples.length > 0 ?
            interactionSamples.reduce((a, b) => a + b, 0) / interactionSamples.length : 0;

          const memorySamples = results.performanceMetrics.memory.samples;
          if (memorySamples.length > 1) {
            results.performanceMetrics.memory.growth =
              memorySamples[memorySamples.length - 1].memory - memorySamples[0].memory;
          }

          results.endTime = Date.now();
          results.duration = results.endTime - results.startTime;

          // Add simulator performance report
          results.simulatorReport = sim.getPerformanceReport();

          resolve(results);
        }
      }

      requestAnimationFrame(tradingLoop);
    }, tradingDisplays, tradingConfig);

    console.log(`\n📊 Trading Session Performance Results:`);
    console.log(`  Session duration: ${(tradingResults.duration / 1000).toFixed(1)}s`);
    console.log(`  Market data events: ${tradingResults.marketDataEvents}`);
    console.log(`  Display update events: ${tradingResults.displayUpdateEvents}`);
    console.log(`  User interactions: ${tradingResults.performanceMetrics.interactions.count}`);

    console.log(`\n🎯 Performance Metrics:`);
    console.log(`  Frame Rate:`);
    console.log(`    Average: ${tradingResults.performanceMetrics.frameRate.average.toFixed(1)} fps`);
    console.log(`    Min: ${tradingResults.performanceMetrics.frameRate.min.toFixed(1)} fps`);
    console.log(`    Max: ${tradingResults.performanceMetrics.frameRate.max.toFixed(1)} fps`);

    console.log(`  Data Latency:`);
    console.log(`    Average: ${tradingResults.performanceMetrics.dataLatency.average.toFixed(2)}ms`);
    console.log(`    Max: ${tradingResults.performanceMetrics.dataLatency.max.toFixed(2)}ms`);

    console.log(`  Interaction Response:`);
    console.log(`    Average: ${tradingResults.performanceMetrics.interactions.average.toFixed(2)}ms`);
    console.log(`    Count: ${tradingResults.performanceMetrics.interactions.count}`);

    console.log(`  Memory:`);
    console.log(`    Growth: ${(tradingResults.performanceMetrics.memory.growth / 1024 / 1024).toFixed(1)}MB`);
    console.log(`    Peak: ${(tradingResults.performanceMetrics.memory.peak / 1024 / 1024).toFixed(1)}MB`);

    console.log(`\n🏦 Simulator Report:`);
    console.log(`  Data update rate: ${tradingResults.simulatorReport.dataUpdateRate.toFixed(1)} updates/s`);
    console.log(`  Display update rate: ${tradingResults.simulatorReport.displayUpdateRate.toFixed(1)} updates/s`);
    console.log(`  Interaction rate: ${tradingResults.simulatorReport.interactionRate.toFixed(1)} interactions/s`);

    // Validate performance against trading requirements
    expect(tradingResults.performanceMetrics.frameRate.average).toBeGreaterThan(tradingConfig.performanceTargets.minimumFPS);
    expect(tradingResults.performanceMetrics.dataLatency.average).toBeLessThan(tradingConfig.performanceTargets.dataLatency);
    expect(tradingResults.performanceMetrics.dataLatency.max).toBeLessThan(tradingConfig.performanceTargets.dataLatency * 2);
    expect(tradingResults.performanceMetrics.interactions.average).toBeLessThan(tradingConfig.performanceTargets.interactionResponse);
    expect(tradingResults.performanceMetrics.memory.growth).toBeLessThan(tradingConfig.performanceTargets.memoryGrowth);

    console.log('✅ High-frequency trading session test completed successfully');
  });

  test('multi-instrument monitoring with rapid switching', async ({ page }) => {
    console.log('🔄 Multi-instrument monitoring with rapid switching...');

    const switchingConfig = {
      instruments: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'EUR/GBP', 'USD/CHF', 'NZD/USD'],
      displaysPerInstrument: 2,
      switchingFrequency: 500, // Switch every 500ms
      sessionDuration: 8000, // 8 seconds
      switchingPatterns: ['sequential', 'random', 'pattern-based']
    };

    // Create displays for multiple instruments
    console.log('\n📊 Creating multi-instrument displays...');
    const instrumentDisplays = new Map();

    for (const instrument of switchingConfig.instruments) {
      const instrumentDisplayIds = [];

      for (let i = 0; i < switchingConfig.displaysPerInstrument; i++) {
        await page.keyboard.press('Control+k');
        await page.waitForSelector('[data-panel-id="symbol-palette"]', { timeout: 5000 });

        await page.keyboard.press('Control+a');
        await page.keyboard.type(`${instrument}_${i}`);
        await page.waitForTimeout(100);
        await page.keyboard.press('Enter');

        await page.waitForSelector('[data-display-id]', { timeout: 8000 });

        const displayId = await page.evaluate(() => {
          const displays = document.querySelectorAll('[data-display-id]');
          return displays[displays.length - 1].getAttribute('data-display-id');
        });

        instrumentDisplayIds.push(displayId);
      }

      instrumentDisplays.set(instrument, instrumentDisplayIds);
      console.log(`  ✅ Created ${instrumentDisplayIds.length} displays for ${instrument}`);
    }

    const totalDisplays = Array.from(instrumentDisplays.values()).flat().length;
    console.log(`✅ Created ${totalDisplays} total displays for ${switchingConfig.instruments.length} instruments`);

    // Run switching simulation
    console.log(`\n🔄 Starting rapid switching simulation...`);

    const switchingResults = await page.evaluate(async (instrumentMap, config) => {
      const results = {
        switchingEvents: [],
        performanceMetrics: {
          switchLatency: { samples: [], average: 0, max: 0 },
          focusChangeTime: { samples: [], average: 0 },
          renderUpdateSpeed: { samples: [], average: 0 },
          memoryImpact: { samples: [], max: 0 }
        },
        instrumentFocus: new Map(),
        switchPatterns: {
          sequential: 0,
          random: 0,
          patternBased: 0
        }
      };

      const instruments = Array.from(instrumentMap.keys());
      let currentInstrumentIndex = 0;
      let lastSwitchTime = performance.now();

      function switchToInstrument(targetInstrument, pattern) {
        const switchStart = performance.now();
        const displayIds = instrumentMap.get(targetInstrument);

        if (displayIds && displayIds.length > 0) {
          // Switch to first display of target instrument
          const targetDisplay = document.querySelector(`[data-display-id="${displayIds[0]}"]`);

          if (targetDisplay) {
            // Focus the display
            targetDisplay.focus();

            // Simulate Ctrl+Tab style switching
            const focusEvent = new FocusEvent('focus', { bubbles: true });
            targetDisplay.dispatchEvent(focusEvent);

            // Update active displays for this instrument
            displayIds.forEach(displayId => {
              const display = document.querySelector(`[data-display-id="${displayId}"]`);
              if (display) {
                const event = new CustomEvent('instrumentFocus', {
                  detail: { instrument: targetInstrument, timestamp: Date.now() }
                });
                display.dispatchEvent(event);
              }
            });

            const switchEnd = performance.now();
            const switchLatency = switchEnd - switchStart;

            results.switchingEvents.push({
              instrument: targetInstrument,
              pattern,
              latency: switchLatency,
              timestamp: Date.now(),
              displayCount: displayIds.length
            });

            results.performanceMetrics.switchLatency.samples.push(switchLatency);
            results.performanceMetrics.switchLatency.max = Math.max(
              results.performanceMetrics.switchLatency.max, switchLatency
            );

            // Track instrument focus
            if (!results.instrumentFocus.has(targetInstrument)) {
              results.instrumentFocus.set(targetInstrument, 0);
            }
            results.instrumentFocus.set(targetInstrument, results.instrumentFocus.get(targetInstrument) + 1);

            return switchLatency;
          }
        }
        return 0;
      }

      function switchingLoop() {
        const currentTime = performance.now();
        const elapsed = currentTime - lastSwitchTime;

        if (elapsed < config.sessionDuration) {
          if (elapsed > config.switchingFrequency) {
            const pattern = config.switchingPatterns[
              Math.floor(Math.random() * config.switchingPatterns.length)
            ];

            let targetInstrument;
            switch (pattern) {
              case 'sequential':
                targetInstrument = instruments[currentInstrumentIndex];
                currentInstrumentIndex = (currentInstrumentIndex + 1) % instruments.length;
                results.switchPatterns.sequential++;
                break;

              case 'random':
                targetInstrument = instruments[Math.floor(Math.random() * instruments.length)];
                results.switchPatterns.random++;
                break;

              case 'pattern-based':
                // Simulate trader patterns (focus on major pairs)
                const majorPairs = ['EUR/USD', 'GBP/USD', 'USD/JPY'];
                if (Math.random() < 0.7) { // 70% chance to pick major pair
                  targetInstrument = majorPairs[Math.floor(Math.random() * majorPairs.length)];
                } else {
                  targetInstrument = instruments[Math.floor(Math.random() * instruments.length)];
                }
                results.switchPatterns.patternBased++;
                break;
            }

            const switchLatency = switchToInstrument(targetInstrument, pattern);

            // Measure rendering update speed after switch
            const renderStart = performance.now();
            requestAnimationFrame(() => {
              const renderEnd = performance.now();
              const renderTime = renderEnd - renderStart;
              results.performanceMetrics.renderUpdateSpeed.samples.push(renderTime);
            });

            // Memory impact sampling
            if (Math.random() < 0.2) { // 20% chance
              const currentMemory = performance.memory?.usedJSHeapSize || 0;
              results.performanceMetrics.memoryImpact.samples.push(currentMemory);
              results.performanceMetrics.memoryImpact.max = Math.max(
                results.performanceMetrics.memoryImpact.max, currentMemory
              );
            }

            lastSwitchTime = currentTime;
          }

          setTimeout(switchingLoop, 50);
        } else {
          // Calculate final metrics
          const switchSamples = results.performanceMetrics.switchLatency.samples;
          results.performanceMetrics.switchLatency.average =
            switchSamples.length > 0 ?
            switchSamples.reduce((a, b) => a + b, 0) / switchSamples.length : 0;

          const renderSamples = results.performanceMetrics.renderUpdateSpeed.samples;
          results.performanceMetrics.renderUpdateSpeed.average =
            renderSamples.length > 0 ?
            renderSamples.reduce((a, b) => a + b, 0) / renderSamples.length : 0;

          resolve(results);
        }
      }

      switchingLoop();
    }, instrumentDisplays, switchingConfig);

    console.log(`\n📊 Rapid Switching Results:`);
    console.log(`  Total switching events: ${switchingResults.switchingEvents.length}`);
    console.log(`  Switching frequency: ${(switchingResults.switchingEvents.length / (switchingConfig.sessionDuration / 1000)).toFixed(1)} switches/s`);

    console.log(`\n🎯 Switching Performance:`);
    console.log(`  Average switch latency: ${switchingResults.performanceMetrics.switchLatency.average.toFixed(2)}ms`);
    console.log(`  Max switch latency: ${switchingResults.performanceMetrics.switchLatency.max.toFixed(2)}ms`);
    console.log(`  Average render update: ${switchingResults.performanceMetrics.renderUpdateSpeed.average.toFixed(2)}ms`);

    console.log(`\n📈 Switching Patterns:`);
    Object.entries(switchingResults.switchPatterns).forEach(([pattern, count]) => {
      console.log(`  ${pattern}: ${count} (${(count / switchingResults.switchingEvents.length * 100).toFixed(1)}%)`);
    });

    console.log(`\n🎯 Instrument Focus Distribution:`);
    Array.from(switchingResults.instrumentFocus.entries()).forEach(([instrument, count]) => {
      console.log(`  ${instrument}: ${count} switches`);
    });

    // Validate switching performance
    expect(switchingResults.performanceMetrics.switchLatency.average).toBeLessThan(50); // Average under 50ms
    expect(switchingResults.performanceMetrics.switchLatency.max).toBeLessThan(100); // Max under 100ms
    expect(switchingResults.performanceMetrics.renderUpdateSpeed.average).toBeLessThan(16.67); // 60fps equivalent

    // Validate switching frequency meets requirements
    const actualSwitchingFrequency = switchingResults.switchingEvents.length / (switchingConfig.sessionDuration / 1000);
    expect(actualSwitchingFrequency).toBeGreaterThan(1.5); // At least 1.5 switches per second

    console.log('✅ Multi-instrument monitoring with rapid switching test completed successfully');
  });

  test('professional trading workflow under market volatility', async ({ page }) => {
    console.log('📈 Professional trading workflow under market volatility...');

    const workflowConfig = {
      volatilityLevels: ['low', 'medium', 'high', 'extreme'],
      workflows: [
        { name: 'scalping', displayCount: 8, updateFrequency: 100, duration: 3000 },
        { name: 'day-trading', displayCount: 12, updateFrequency: 500, duration: 4000 },
        { name: 'swing-trading', displayCount: 15, updateFrequency: 1000, duration: 5000 }
      ],
      volatilityThresholds: {
        low: { volatility: 0.0001, updates: 5 },
        medium: { volatility: 0.0002, updates: 10 },
        high: { volatility: 0.0005, updates: 20 },
        extreme: { volatility: 0.001, updates: 40 }
      }
    };

    for (const workflow of workflowConfig.workflows) {
      console.log(`\n🔄 Testing ${workflow.name} workflow (${workflow.displayCount} displays)...`);

      // Create displays for workflow
      const workflowDisplays = [];
      for (let i = 0; i < workflow.displayCount; i++) {
        await page.keyboard.press('Control+k');
        await page.waitForSelector('[data-panel-id="symbol-palette"]', { timeout: 5000 });

        await page.keyboard.press('Control+a');
        await page.keyboard.type(`${workflow.name.toUpperCase()}_${i % 3 === 0 ? 'EURUSD' : i % 2 === 0 ? 'GBPUSD' : 'USDJPY'}`);
        await page.waitForTimeout(100);
        await page.keyboard.press('Enter');

        await page.waitForSelector('[data-display-id]', { timeout: 8000 });

        const displayId = await page.evaluate(() => {
          const displays = document.querySelectorAll('[data-display-id]');
          return displays[displays.length - 1].getAttribute('data-display-id');
        });

        workflowDisplays.push(displayId);
      }

      // Test workflow under different volatility levels
      for (const volatilityLevel of workflowConfig.volatilityLevels) {
        console.log(`  📊 Testing ${volatilityLevel} volatility...`);

        const volatilityThreshold = workflowConfig.volatilityThresholds[volatilityLevel];

        const workflowResults = await page.evaluate(async (displayIds, wfConfig, volThreshold, volLevel) => {
          const results = {
            workflow: wfConfig.name,
            volatilityLevel: volLevel,
            performanceMetrics: {
              updateFrequency: 0,
              renderLatency: { samples: [], average: 0, max: 0 },
              frameRate: { samples: [], average: 0, drops: 0 },
              memoryUsage: { start: 0, peak: 0, growth: 0 },
              uiResponsiveness: { samples: [], average: 0 }
            },
            successfulUpdates: 0,
            failedUpdates: 0,
            systemStability: true
          };

          const startTime = performance.now();
          results.performanceMetrics.memoryUsage.start = performance.memory?.usedJSHeapSize || 0;

          let updateCount = 0;
          let frameCount = 0;

          function volatilitySimulation() {
            const currentTime = performance.now();
            const elapsed = currentTime - startTime;

            if (elapsed < wfConfig.duration) {
              const frameStart = performance.now();

              // Simulate market updates based on volatility
              const updateIntensity = volThreshold.updates;
              for (let i = 0; i < updateIntensity; i++) {
                displayIds.forEach((displayId, index) => {
                  const display = document.querySelector(`[data-display-id="${displayId}"]`);
                  if (display) {
                    const volatility = volThreshold.volatility;
                    const priceMove = (Math.random() - 0.5) * volatility;
                    const volume = Math.random() * 5000000 + 1000000;

                    const event = new CustomEvent('volatilityUpdate', {
                      detail: {
                        priceChange: priceMove,
                        volume,
                        volatility: volLevel,
                        timestamp: Date.now(),
                        intensity: i + 1
                      }
                    });

                    try {
                      display.dispatchEvent(event);
                      results.successfulUpdates++;
                    } catch (error) {
                      results.failedUpdates++;
                      console.error(`Update failed for display ${displayId}:`, error);
                    }
                  }
                });
              }

              // Measure UI responsiveness
              const responsivenessStart = performance.now();
              const dummyElement = document.createElement('div');
              document.body.appendChild(dummyElement);
              dummyElement.focus();
              document.body.removeChild(dummyElement);
              const responsivenessEnd = performance.now();
              const responsiveness = responsivenessEnd - responsivenessStart;

              results.performanceMetrics.uiResponsiveness.samples.push(responsiveness);

              // Frame rate measurement
              const frameEnd = performance.now();
              const frameTime = frameEnd - frameStart;
              const fps = 1000 / frameTime;

              results.performanceMetrics.frameRate.samples.push(fps);
              if (fps < 30) {
                results.performanceMetrics.frameRate.drops++;
              }

              // Memory sampling
              if (frameCount % 30 === 0) {
                const currentMemory = performance.memory?.usedJSHeapSize || 0;
                results.performanceMetrics.memoryUsage.peak = Math.max(
                  results.performanceMetrics.memoryUsage.peak, currentMemory
                );
              }

              updateCount++;
              frameCount++;

              setTimeout(volatilitySimulation, wfConfig.updateFrequency);
            } else {
              // Calculate final metrics
              const endTime = performance.now();
              results.performanceMetrics.updateFrequency = updateCount / ((endTime - startTime) / 1000);

              const frameRateSamples = results.performanceMetrics.frameRate.samples;
              results.performanceMetrics.frameRate.average =
                frameRateSamples.reduce((a, b) => a + b, 0) / frameRateSamples.length;

              const responsivenessSamples = results.performanceMetrics.uiResponsiveness.samples;
              results.performanceMetrics.uiResponsiveness.average =
                responsivenessSamples.reduce((a, b) => a + b, 0) / responsivenessSamples.length;

              const finalMemory = performance.memory?.usedJSHeapSize || 0;
              results.performanceMetrics.memoryUsage.growth = finalMemory - results.performanceMetrics.memoryUsage.start;

              // System stability check
              results.systemStability =
                results.failedUpdates < (results.successfulUpdates * 0.01) && // Less than 1% failures
                results.performanceMetrics.frameRate.average > 25 && // Maintain >25fps
                results.performanceMetrics.memoryUsage.growth < 50 * 1024 * 1024; // Less than 50MB growth

              resolve(results);
            }
          }

          volatilitySimulation();
        }, workflowDisplays, workflow, volatilityThreshold, volatilityLevel);

        console.log(`    Update frequency: ${workflowResults.performanceMetrics.updateFrequency.toFixed(1)} updates/s`);
        console.log(`    Frame rate: ${workflowResults.performanceMetrics.frameRate.average.toFixed(1)} fps`);
        console.log(`    Frame drops: ${workflowResults.performanceMetrics.frameRate.drops}`);
        console.log(`    UI responsiveness: ${workflowResults.performanceMetrics.uiResponsiveness.average.toFixed(2)}ms`);
        console.log(`    Memory growth: ${(workflowResults.performanceMetrics.memoryUsage.growth / 1024 / 1024).toFixed(1)}MB`);
        console.log(`    Success rate: ${((workflowResults.successfulUpdates / (workflowResults.successfulUpdates + workflowResults.failedUpdates)) * 100).toFixed(1)}%`);
        console.log(`    System stability: ${workflowResults.systemStability ? '✅' : '❌'}`);

        // Validate workflow performance under volatility
        expect(workflowResults.systemStability).toBeTruthy();
        expect(workflowResults.performanceMetrics.frameRate.average).toBeGreaterThan(25);
        expect(workflowResults.performanceMetrics.uiResponsiveness.average).toBeLessThan(50);
        expect(workflowResults.performanceMetrics.memoryUsage.growth).toBeLessThan(50 * 1024 * 1024);
      }

      // Clean up workflow displays
      for (let i = 0; i < workflowDisplays.length; i++) {
        await page.keyboard.press('Control+Shift+w');
        await page.waitForTimeout(100);
      }
      await page.waitForSelector('[data-display-id]', { state: 'detached', timeout: 10000 });
    }

    console.log('✅ Professional trading workflow under market volatility test completed successfully');
  });
});