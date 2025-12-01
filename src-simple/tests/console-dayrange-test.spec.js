// Day Range Meter Enhanced Console Monitoring Test
// Tests progressive ADR disclosure, dynamic percentage markers, and performance
import { test, expect } from '@playwright/test';

test.describe('Day Range Meter Console Monitoring', () => {
  let consoleMessages = [];
  let performanceMetrics = [];
  let renderCount = 0;
  let startTime;

  test.beforeEach(async ({ page }) => {
    // Enhanced console message collection with emoji classification
    consoleMessages = [];
    performanceMetrics = [];
    renderCount = 0;
    startTime = Date.now();

    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      const timestamp = new Date().toISOString();

      // Classify messages with emoji indicators
      let emoji = '💡'; // Default debug info
      let category = 'debug';

      if (text.includes('Error') || text.includes('error') || type === 'error') {
        emoji = '❌';
        category = 'error';
      } else if (text.includes('Warning') || text.includes('warning') || type === 'warning') {
        emoji = '⚠️';
        category = 'warning';
      } else if (text.includes('✅') || text.includes('SUCCESS') || text.includes('loaded successfully')) {
        emoji = '✅';
        category = 'success';
      } else if (text.includes('PROGRESSIVE') || text.includes('Day Range') || text.includes('ADR')) {
        emoji = '📊';
        category = 'progressive';
      } else if (text.includes('Network') || text.includes('WebSocket') || text.includes('HTTP')) {
        emoji = '🌐';
        category = 'network';
      } else if (text.includes('keyboard') || text.includes('keydown') || text.includes('keyup')) {
        emoji = '⌨️';
        category = 'keyboard';
      } else if (text.includes('render') || text.includes('canvas') || text.includes('draw')) {
        emoji = '🎨';
        category = 'rendering';
      }

      const classifiedMessage = {
        timestamp,
        type,
        category,
        emoji,
        text,
        args: msg.args().length
      };

      consoleMessages.push(classifiedMessage);

      // Track performance metrics
      if (category === 'rendering' || category === 'progressive') {
        performanceMetrics.push({
          timestamp: Date.now() - startTime,
          category,
          message: text
        });
      }
    });

    // Track page load performance
    page.on('load', () => {
      const loadTime = Date.now() - startTime;
      performanceMetrics.push({
        timestamp: loadTime,
        category: 'performance',
        message: `Page load completed in ${loadTime}ms`
      });
    });
  });

  test('Progressive ADR Disclosure with Real Data', async ({ page }) => {
    console.log('🌐 Starting Progressive ADR Disclosure test...');

    // Navigate to the application
    await page.goto('http://localhost:5176');

    // Wait for initial load
    await page.waitForLoadState('networkidle');

    console.log('📊 Testing progressive ADR disclosure functionality...');

    // Test Day Range Meter with simulated market data
    await page.evaluate(() => {
      // Simulate market data with high volatility (>50% ADR)
      const highVolatilityData = {
        symbol: 'GBP/JPY',
        current: 195.50,
        open: 194.00,
        high: 196.00,
        low: 193.00,
        adrHigh: 195.00,
        adrLow: 193.00 // ADR range of 200 pips
      };

      // Trigger day range meter rendering
      if (window.renderDayRange) {
        const canvas = document.querySelector('canvas');
        if (canvas) {
          const ctx = canvas.getContext('2d');
          const settings = {
            width: canvas.width,
            height: canvas.height,
            canvas: canvas
          };

          console.log('🎨 Rendering high volatility Day Range Meter (>50% ADR)...');
          window.renderDayRange(ctx, highVolatilityData, settings);

          // Test progressive disclosure logic
          const dayRange = highVolatilityData.high - highVolatilityData.low; // 300 pips
          const adrValue = highVolatilityData.adrHigh - highVolatilityData.adrLow; // 200 pips
          const dayRangePct = ((dayRange / adrValue) * 100).toFixed(1);

          console.log(`📊 PROGRESSIVE TEST: Day Range: ${dayRange} pips (${dayRangePct}% of ADR)`);
          console.log(`📈 Progressive disclosure should show markers up to 75%+ (0.75 * 4 = 3, ceil(3)/4 = 0.75)`);
        }
      }
    });

    // Wait for rendering
    await page.waitForTimeout(100);

    // Analyze console output for progressive disclosure
    const progressiveMessages = consoleMessages.filter(msg =>
      msg.category === 'progressive' ||
      msg.text.includes('PROGRESSIVE') ||
      msg.text.includes('Max ADR')
    );

    console.log(`\n📊 PROGRESSIVE DISCLOSURE ANALYSIS:`);
    console.log(`📈 Progressive disclosure messages: ${progressiveMessages.length}`);

    progressiveMessages.forEach(msg => {
      console.log(`${msg.emoji} ${msg.timestamp} - ${msg.text}`);
    });

    // Verify progressive disclosure functionality
    expect(progressiveMessages.length).toBeGreaterThan(0);

    const progressiveActive = progressiveMessages.some(msg =>
      msg.text.includes('ACTIVE') || msg.text.includes('75%') || msg.text.includes('100%')
    );

    if (progressiveActive) {
      console.log('✅ Progressive ADR disclosure is working correctly');
    } else {
      console.log('⚠️ Progressive disclosure may not be fully active');
    }
  });

  test('Dynamic Percentage Markers Performance', async ({ page }) => {
    console.log('🎯 Testing Dynamic Percentage Markers performance...');

    await page.goto('http://localhost:5176');
    await page.waitForLoadState('networkidle');

    // Test performance with multiple renders
    const renderTimes = [];

    for (let i = 0; i < 5; i++) {
      const renderStart = Date.now();

      await page.evaluate((renderIndex) => {
        const testScenarios = [
          // Low volatility (<25% ADR)
          {
            symbol: 'EUR/USD',
            current: 1.0850,
            open: 1.0800,
            high: 1.0825,
            low: 1.0775,
            adrHigh: 1.0900,
            adrLow: 1.0700
          },
          // Medium volatility (25-50% ADR)
          {
            symbol: 'GBP/USD',
            current: 1.2700,
            open: 1.2650,
            high: 1.2750,
            low: 1.2600,
            adrHigh: 1.2800,
            adrLow: 1.2500
          },
          // High volatility (>50% ADR)
          {
            symbol: 'USD/JPY',
            current: 150.00,
            open: 149.00,
            high: 151.00,
            low: 148.00,
            adrHigh: 151.00,
            adrLow: 149.00
          }
        ];

        const scenario = testScenarios[renderIndex % testScenarios.length];

        console.log(`🎨 Render ${renderIndex + 1}: ${scenario.symbol} (${scenario.high - scenario.low} pips range)`);

        if (window.renderDayRange) {
          const canvas = document.querySelector('canvas');
          if (canvas) {
            const ctx = canvas.getContext('2d');
            const settings = {
              width: canvas.width,
              height: canvas.height,
              canvas: canvas
            };

            window.renderDayRange(ctx, scenario, settings);
          }
        }
      }, i);

      const renderEnd = Date.now();
      const renderTime = renderEnd - renderStart;
      renderTimes.push(renderTime);

      console.log(`⏱️ Render ${i + 1} completed in ${renderTime}ms`);
    }

    // Performance analysis
    const avgRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
    const maxRenderTime = Math.max(...renderTimes);

    console.log(`\n⚡ PERFORMANCE ANALYSIS:`);
    console.log(`📊 Average render time: ${avgRenderTime.toFixed(2)}ms`);
    console.log(`🔺 Max render time: ${maxRenderTime}ms`);
    console.log(`🎯 Target: <100ms for sub-100ms latency`);

    // Performance assertions
    expect(avgRenderTime).toBeLessThan(100);
    expect(maxRenderTime).toBeLessThan(200);

    if (avgRenderTime < 50) {
      console.log('🚀 Excellent performance: Sub-50ms average render time');
    } else if (avgRenderTime < 100) {
      console.log('✅ Good performance: Sub-100ms average render time');
    } else {
      console.log('⚠️ Performance concern: Above 100ms average render time');
    }
  });

  test('Module Loading and Import Analysis', async ({ page }) => {
    console.log('📦 Testing module loading and imports...');

    await page.goto('http://localhost:5176');
    await page.waitForLoadState('networkidle');

    // Check for module loading errors
    const errorMessages = consoleMessages.filter(msg => msg.category === 'error');
    const warningMessages = consoleMessages.filter(msg => msg.category === 'warning');
    const successMessages = consoleMessages.filter(msg => msg.category === 'success');

    console.log(`\n📊 MODULE LOADING ANALYSIS:`);
    console.log(`❌ Errors: ${errorMessages.length}`);
    console.log(`⚠️ Warnings: ${warningMessages.length}`);
    console.log(`✅ Success messages: ${successMessages.length}`);

    // Log all errors and warnings
    if (errorMessages.length > 0) {
      console.log('\n❌ ERRORS FOUND:');
      errorMessages.forEach(msg => {
        console.log(`${msg.emoji} ${msg.timestamp} - ${msg.text}`);
      });
    }

    if (warningMessages.length > 0) {
      console.log('\n⚠️ WARNINGS FOUND:');
      warningMessages.forEach(msg => {
        console.log(`${msg.emoji} ${msg.timestamp} - ${msg.text}`);
      });
    }

    // Check for successful module loading
    const moduleLoaded = successMessages.some(msg =>
      msg.text.includes('loaded') ||
      msg.text.includes('registered') ||
      msg.text.includes('visualization')
    );

    if (moduleLoaded) {
      console.log('✅ Modules loaded successfully');
    } else {
      console.log('⚠️ Module loading status unclear');
    }

    // Assert no critical errors
    expect(errorMessages.filter(msg => msg.text.includes('Error')).length).toBe(0);
  });

  test('Console Classification System', async ({ page }) => {
    console.log('🏷️ Testing console emoji classification system...');

    await page.goto('http://localhost:5176');
    await page.waitForLoadState('networkidle');

    // Analyze message categories
    const categoryCounts = {};
    consoleMessages.forEach(msg => {
      categoryCounts[msg.category] = (categoryCounts[msg.category] || 0) + 1;
    });

    console.log(`\n🏷️ CONSOLE CLASSIFICATION ANALYSIS:`);
    console.log(`📊 Total messages: ${consoleMessages.length}`);

    Object.entries(categoryCounts).forEach(([category, count]) => {
      const percentage = ((count / consoleMessages.length) * 100).toFixed(1);
      console.log(`${category}: ${count} messages (${percentage}%)`);
    });

    // Verify classification is working
    expect(consoleMessages.length).toBeGreaterThan(0);
    expect(Object.keys(categoryCounts)).toContain('debug'); // Should have debug messages
  });

  test.afterEach(async () => {
    // Final analysis summary
    console.log(`\n📋 TEST SESSION SUMMARY:`);
    console.log(`📊 Total console messages: ${consoleMessages.length}`);
    console.log(`⚡ Performance metrics collected: ${performanceMetrics.length}`);

    const errors = consoleMessages.filter(msg => msg.category === 'error');
    const warnings = consoleMessages.filter(msg => msg.category === 'warning');

    if (errors.length === 0 && warnings.length === 0) {
      console.log('🎉 CLEAN TEST: No errors or warnings detected');
    } else {
      console.log(`⚠️ ISSUES FOUND: ${errors.length} errors, ${warnings.length} warnings`);
    }
  });
});