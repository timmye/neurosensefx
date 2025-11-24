/**
 * PerformanceValidator Example Usage
 *
 * This file demonstrates how to use the PerformanceValidator in real-world
 * testing scenarios for NeuroSense FX professional trading platform validation.
 */

import { test, expect } from '@playwright/test';
import { PerformanceValidator, createPerformanceValidator } from './PerformanceValidator.js';

/**
 * Example: Complete trading workflow performance validation
 */
test.describe('Professional Trading Performance Validation', () => {
  test('should validate complete trading workflow performance', async ({ page }) => {
    // Initialize performance validator
    const validator = createPerformanceValidator(page, {
      fpsTarget: 60,
      latencyThreshold: 100,
      memoryGrowthThreshold: 50, // MB per hour
      extendedSessionDuration: 30 * 60 * 1000, // 30 minutes for testing
      enableRealTimeValidation: true,
      enableQualityValidation: true
    });

    await validator.startValidation();

    try {
      // Step 1: Navigate to application
      const navResult = await validator.validateLatency('page_navigation', async () => {
        await page.goto('http://localhost:5174');
        await page.waitForLoadState('networkidle');
      });

      expect(navResult.passed).toBe(true);

      // Step 2: Create multiple trading displays
      for (let i = 0; i < 5; i++) {
        const displayResult = await validator.validateLatency('display_creation', async () => {
          await page.evaluate((symbol) => {
            // Simulate creating a new display
            const display = document.createElement('div');
            display.className = 'trading-display';
            display.innerHTML = `
              <canvas id="display-${symbol}" width="400" height="300"></canvas>
              <div class="price-info">Loading ${symbol}...</div>
            `;
            document.body.appendChild(display);

            // Initialize canvas
            const canvas = document.getElementById(`display-${symbol}`);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }, `EUR/USD-${i}`);

          await page.waitForTimeout(100);
        });

        console.log(`Display ${i + 1} creation latency: ${displayResult.totalLatency.toFixed(2)}ms`);
      }

      // Step 3: Validate rendering quality for each display
      const displays = await page.$$('.trading-display');
      for (let i = 0; i < displays.length; i++) {
        const qualityResult = await validator.validateRenderingQuality(`.trading-display:nth-child(${i + 1})`);
        console.log(`Display ${i + 1} DPR accuracy: ${(qualityResult.quality.dpr.accuracy * 100).toFixed(1)}%`);
      }

      // Step 4: Validate frame rate with active trading simulation
      await page.evaluate(() => {
        // Simulate real-time price updates
        const displays = document.querySelectorAll('.trading-display');

        displays.forEach((display, index) => {
          const canvas = display.querySelector('canvas');
          const ctx = canvas.getContext('2d');
          const priceInfo = display.querySelector('.price-info');

          let price = 1.1000 + index * 0.01;

          const updatePrice = () => {
            // Simulate price movement
            price += (Math.random() - 0.5) * 0.0001;

            // Update canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw price line
            ctx.strokeStyle = '#007acc';
            ctx.lineWidth = 2;
            ctx.beginPath();

            for (let x = 0; x < canvas.width; x += 10) {
              const y = canvas.height / 2 + Math.sin((x + Date.now() / 100) * 0.02) * 50;
              if (x === 0) {
                ctx.moveTo(x, y);
              } else {
                ctx.lineTo(x, y);
              }
            }
            ctx.stroke();

            // Update price display
            ctx.fillStyle = '#000';
            ctx.font = '16px monospace';
            ctx.fillText(price.toFixed(4), 10, 30);

            // Update price info
            if (priceInfo) {
              priceInfo.textContent = `EUR/USD: ${price.toFixed(4)}`;
            }

            requestAnimationFrame(updatePrice);
          };

          updatePrice();
        });
      });

      const frameRateResult = await validator.validateFrameRate('active_trading_simulation', 5000);
      console.log(`Active trading frame rate: ${frameRateResult.frameRate.average.toFixed(2)}fps`);

      // Step 5: Validate memory stability with multiple displays
      const memoryResult = await validator.validateMemoryStability('multiple_displays', 10000);
      console.log(`Memory growth rate: ${memoryResult.memory.growthRate.toFixed(2)}MB/hr`);

      // Step 6: Test keyboard interaction performance
      const keyboardResult = await validator.validateLatency('keyboard_response', async () => {
        await page.keyboard.press('d'); // 'd' for new display
        await page.waitForTimeout(200);
      });

      console.log(`Keyboard response latency: ${keyboardResult.totalLatency.toFixed(2)}ms`);

      // Step 7: Generate comprehensive performance report
      const report = await validator.generatePerformanceReport();

      // Assert critical performance requirements
      expect(report.analysis.summary.passRate).toBeGreaterThanOrEqual(90);
      expect(report.analysis.summary.criticalIssues).toBe(0);

      // Log detailed results
      console.log('\n📊 PERFORMANCE VALIDATION SUMMARY');
      console.log(`Status: ${report.status}`);
      console.log(`Pass Rate: ${report.analysis.summary.passRate.toFixed(1)}%`);
      console.log(`Critical Issues: ${report.analysis.summary.criticalIssues}`);
      console.log(`Warnings: ${report.analysis.summary.warnings}`);

      if (report.recommendations.length > 0) {
        console.log('\n📋 RECOMMENDATIONS:');
        report.recommendations.forEach((rec, index) => {
          console.log(`${index + 1}. [${rec.priority.toUpperCase()}] ${rec.message}`);
        });
      }

    } finally {
      await validator.stopValidation();
    }
  });

  test('should handle extended trading session stability', async ({ page }) => {
    const validator = createPerformanceValidator(page, {
      extendedSessionDuration: 2 * 60 * 1000, // 2 minutes for demo
      memoryGrowthThreshold: 25 // MB per hour
    });

    await validator.startValidation();
    await page.goto('http://localhost:5174');

    try {
      // Simulate extended trading session
      console.log('Starting extended trading session simulation...');

      await page.evaluate(() => {
        // Create a realistic trading scenario
        const symbols = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF'];
        const displays = [];

        symbols.forEach((symbol, index) => {
          const container = document.createElement('div');
          container.className = 'extended-session-display';
          container.innerHTML = `
            <h3>${symbol}</h3>
            <canvas id="extended-${symbol}" width="300" height="200"></canvas>
            <div class="stats">
              <div class="price">1.0000</div>
              <div class="change">+0.0000</div>
              <div class="volume">0</div>
            </div>
          `;
          document.body.appendChild(container);

          displays.push({
            symbol,
            element: container,
            canvas: document.getElementById(`extended-${symbol}`),
            price: 1.0000 + Math.random() * 0.5,
            volume: 0
          });
        });

        // Extended session simulation
        let tickCount = 0;
        const simulateMarketData = () => {
          tickCount++;

          displays.forEach(display => {
            // Update price
            const priceChange = (Math.random() - 0.5) * 0.001;
            display.price += priceChange;

            // Update volume
            display.volume += Math.floor(Math.random() * 10);

            // Render update
            const ctx = display.canvas.getContext('2d');
            ctx.clearRect(0, 0, display.canvas.width, display.canvas.height);

            // Draw price chart
            ctx.strokeStyle = display.price > display.price - priceChange ? '#00ff00' : '#ff0000';
            ctx.lineWidth = 1;
            ctx.beginPath();

            const chartHeight = display.canvas.height - 40;
            const chartWidth = display.canvas.width - 20;

            for (let x = 0; x < chartWidth; x++) {
              const y = chartHeight / 2 + Math.sin((x + tickCount) * 0.1) * 20;
              if (x === 0) {
                ctx.moveTo(x + 10, y + 20);
              } else {
                ctx.lineTo(x + 10, y + 20);
              }
            }
            ctx.stroke();

            // Update text displays
            const priceElement = display.element.querySelector('.price');
            const changeElement = display.element.querySelector('.change');
            const volumeElement = display.element.querySelector('.volume');

            if (priceElement) priceElement.textContent = display.price.toFixed(4);
            if (changeElement) {
              changeElement.textContent = (priceChange >= 0 ? '+' : '') + priceChange.toFixed(4);
              changeElement.style.color = priceChange >= 0 ? '#00ff00' : '#ff0000';
            }
            if (volumeElement) volumeElement.textContent = display.volume;
          });

          // Continue simulation
          if (tickCount < 7200) { // 2 minutes at 60fps
            requestAnimationFrame(simulateMarketData);
          }
        };

        requestAnimationFrame(simulateMarketData);
      });

      // Run extended session validation
      const sessionResult = await validator.validateExtendedSession();

      console.log(`Extended session duration: ${(sessionResult.duration / 1000).toFixed(1)}s`);
      console.log(`Frame rate degradation: ${sessionResult.degradation.frameRate.toFixed(2)}%`);
      console.log(`Memory growth: ${sessionResult.degradation.memory.toFixed(2)}MB`);

      expect(sessionResult.passed).toBe(true);

      const finalReport = await validator.generatePerformanceReport();
      expect(finalReport.status).not.toBe('CRITICAL_FAILURE');

    } finally {
      await validator.stopValidation();
    }
  }, 150000); // 2.5 minute timeout

  test('should detect performance regression scenarios', async ({ page }) => {
    const validator = createPerformanceValidator(page);

    await validator.startValidation();
    await page.goto('http://localhost:5174');

    try {
      // Create baseline performance
      await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.id = 'regression-test';
        canvas.width = 400;
        canvas.height = 300;
        document.body.appendChild(canvas);
      });

      const baselineResult = await validator.validateFrameRate('baseline', 2000);
      console.log(`Baseline frame rate: ${baselineResult.frameRate.average.toFixed(2)}fps`);

      // Simulate performance regression
      await page.evaluate(() => {
        const canvas = document.getElementById('regression-test');
        const ctx = canvas.getContext('2d');

        // Introduce performance problems
        const degradePerformance = () => {
          // Simulate expensive operations
          for (let i = 0; i < 1000000; i++) {
            Math.random();
          }

          // Still render, but slowly
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#ff0000';
          ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 50, 50);

          setTimeout(degradePerformance, 100); // Intentionally slow
        };

        setTimeout(degradePerformance, 1000);
      });

      // Measure degraded performance
      const degradedResult = await validator.validateFrameRate('degraded', 3000);
      console.log(`Degraded frame rate: ${degradedResult.frameRate.average.toFixed(2)}fps`);

      // The validator should detect the performance regression
      expect(degradedResult.frameRate.average).toBeLessThan(baselineResult.frameRate.average);

      const report = await validator.generatePerformanceReport();

      // Should generate warnings about performance degradation
      const hasPerformanceWarnings = report.recommendations.some(rec =>
        rec.category === 'performance' || rec.category === 'rendering'
      );

      console.log(`Performance regression detected: ${hasPerformanceWarnings}`);

    } finally {
      await validator.stopValidation();
    }
  });
});

/**
 * Example: Integration with existing test utilities
 */
test.describe('PerformanceValidator Integration Examples', () => {
  test('should work alongside SystemVisibilityMonitor', async ({ page }) => {
    const { SystemVisibilityMonitor } = await import('./SystemVisibilityMonitor.js');
    const validator = createPerformanceValidator(page);

    // Start both monitoring systems
    await SystemVisibilityMonitor.startMonitoring();
    await validator.startValidation();

    await page.goto('http://localhost:5174');

    // Perform some trading operations
    await page.evaluate(() => {
      console.log('Performing trading operations...');
    });

    // Get comprehensive insights from both systems
    const systemReport = await SystemVisibilityMonitor.getSystemHealth();
    const performanceReport = await validator.generatePerformanceReport();

    expect(systemReport).toBeDefined();
    expect(performanceReport).toBeDefined();

    // Cross-validate results
    console.log('System Health Status:', systemReport.status);
    console.log('Performance Validation Status:', performanceReport.status);

    await SystemVisibilityMonitor.stopMonitoring();
    await validator.stopValidation();
  });

  test('should validate professional trading keyboard shortcuts', async ({ page }) => {
    const validator = createPerformanceValidator(page);

    await validator.startValidation();
    await page.goto('http://localhost:5174');

    // Test common trading keyboard shortcuts
    const shortcuts = [
      { key: 'd', description: 'New display' },
      { key: 'f', description: 'Focus display' },
      { key: 'r', description: 'Remove display' },
      { key: 'Escape', description: 'Cancel operation' }
    ];

    for (const shortcut of shortcuts) {
      const latencyResult = await validator.validateLatency(`keyboard_${shortcut.key}`, async () => {
        await page.keyboard.press(shortcut.key);
        await page.waitForTimeout(200);
      });

      console.log(`${shortcut.description} (${shortcut.key}): ${latencyResult.totalLatency.toFixed(2)}ms`);

      // Keyboard shortcuts should be very responsive
      expect(latencyResult.totalLatency).toBeLessThan(300);
    }

    await validator.stopValidation();
  });
});

/**
 * Example: Performance regression detection
 */
test.describe('Performance Regression Detection', () => {
  test('should establish performance baseline and detect regressions', async ({ page }) => {
    const validator = createPerformanceValidator(page, {
      thresholds: {
        FRAME_RATE: {
          TARGET: 60,
          MINIMUM: 55,
          CRITICAL: 45,
          MAX_FRAME_TIME: 16.67,
          CONSECUTIVE_DROPS: 3,
          VARIANCE_TOLERANCE: 5
        },
        LATENCY: {
          DATA_TO_VISUAL: 100,
          UI_RESPONSE: 200,
          MARKET_DATA_UPDATE: 150
        },
        MEMORY: {
          MAX_GROWTH_MB_PER_HOUR: 50,
          HEAP_UTILIZATION_THRESHOLD: 0.8
        }
      }
    });

    await validator.startValidation();
    await page.goto('http://localhost:5174');

    try {
      // Baseline measurements
      console.log('🎯 Establishing performance baseline...');

      const baselineFrameRate = await validator.validateFrameRate('baseline_animation', 3000);
      const baselineLatency = await validator.validateLatency('baseline_ui', async () => {
        await page.click('body');
      });
      const baselineMemory = await validator.validateMemoryStability('baseline', 5000);

      console.log(`Baseline Frame Rate: ${baselineFrameRate.frameRate.average.toFixed(2)}fps`);
      console.log(`Baseline UI Latency: ${baselineLatency.totalLatency.toFixed(2)}ms`);
      console.log(`Baseline Memory Growth: ${baselineMemory.memory.growthRate.toFixed(2)}MB/hr`);

      // Load testing scenario
      console.log('⚡ Running performance stress test...');

      await page.evaluate(() => {
        // Create stress test scenario
        const container = document.createElement('div');
        container.innerHTML = `
          <div id="stress-test-container">
            <h2>Performance Stress Test</h2>
          </div>
        `;
        document.body.appendChild(container);

        const stressContainer = document.getElementById('stress-test-container');

        // Create multiple animated elements
        for (let i = 0; i < 10; i++) {
          const element = document.createElement('div');
          element.style.cssText = `
            position: absolute;
            width: 50px;
            height: 50px;
            background: linear-gradient(45deg, #007acc, #00ff00);
            border-radius: 50%;
            left: ${Math.random() * window.innerWidth}px;
            top: ${Math.random() * window.innerHeight}px;
            animation: move ${2 + Math.random() * 3}s infinite alternate;
          `;
          stressContainer.appendChild(element);
        }

        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = `
          @keyframes move {
            from { transform: translate(0, 0) rotate(0deg); }
            to { transform: translate(100px, 100px) rotate(360deg); }
          }
        `;
        document.head.appendChild(style);

        // Create performance-intensive operations
        let operationsCount = 0;
        const performHeavyOperation = () => {
          // Simulate computational work
          const data = [];
          for (let j = 0; j < 10000; j++) {
            data.push({
              id: j,
              value: Math.random(),
              timestamp: Date.now(),
              processed: false
            });
          }

          // Process data
          data.forEach(item => {
            item.processed = true;
            item.value = Math.sqrt(item.value) * Math.sin(item.timestamp);
          });

          operationsCount++;
          if (operationsCount < 100) {
            setTimeout(performHeavyOperation, 100);
          }
        };

        setTimeout(performHeavyOperation, 1000);
      });

      // Stress test measurements
      const stressFrameRate = await validator.validateFrameRate('stress_animation', 5000);
      const stressLatency = await validator.validateLatency('stress_ui', async () => {
        await page.click('#stress-test-container');
      });
      const stressMemory = await validator.validateMemoryStability('stress', 10000);

      console.log(`Stress Frame Rate: ${stressFrameRate.frameRate.average.toFixed(2)}fps`);
      console.log(`Stress UI Latency: ${stressLatency.totalLatency.toFixed(2)}ms`);
      console.log(`Stress Memory Growth: ${stressMemory.memory.growthRate.toFixed(2)}MB/hr`);

      // Analyze regression
      const frameRateRegression = ((baselineFrameRate.frameRate.average - stressFrameRate.frameRate.average) / baselineFrameRate.frameRate.average) * 100;
      const latencyRegression = ((stressLatency.totalLatency - baselineLatency.totalLatency) / baselineLatency.totalLatency) * 100;

      console.log(`\n📈 Performance Regression Analysis:`);
      console.log(`Frame Rate Regression: ${frameRateRegression.toFixed(2)}%`);
      console.log(`Latency Regression: ${latencyRegression.toFixed(2)}%`);

      // Generate final report
      const finalReport = await validator.generatePerformanceReport();

      // Critical regression checks
      expect(frameRateRegression).toBeLessThan(50); // Frame rate shouldn't drop by more than 50%
      expect(latencyRegression).toBeLessThan(200); // Latency shouldn't increase by more than 200%
      expect(finalReport.analysis.summary.criticalIssues).toBe(0);

      console.log(`\n🎯 Performance Test Status: ${finalReport.status}`);

    } finally {
      await validator.stopValidation();
    }
  }, 60000);
});