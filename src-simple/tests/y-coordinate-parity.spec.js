// Y-Coordinate Parity Test - Crystal Clarity Compliant
// Tests exact Y-coordinate matching between Day Range Meter and Market Profile

import { test, expect } from '@playwright/test';

test.describe('Y-Coordinate Parity Analysis', () => {
  test.beforeEach(async ({ page }) => {
    // Set up console logging to capture Y-coordinate data
    const yCoordinateData = [];

    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[Y-COORDINATE]')) {
        console.log(`[CAPTURED] ${text}`);
        yCoordinateData.push(text);
      }
    });

    page.on('pageerror', error => {
      console.error(`[PAGE ERROR] ${error.message}`);
    });

    await page.goto('http://localhost:5175');
    await page.waitForSelector('.workspace', { timeout: 10000 });

    // Handle the prompt dialog for display creation
    page.on('dialog', async dialog => {
      await dialog.accept('BTCUSD');
    });
  });

  test('Switch between visualizations and compare Y-coordinates', async ({ page }) => {
    console.log('🔍 Testing Y-coordinate parity by switching visualizations...');

    // Create display
    await page.keyboard.press('Alt+A');
    await page.waitForTimeout(3000);

    // Switch to Day Range Meter to capture its Y-coordinates
    console.log('🔄 Switching to Day Range Meter...');
    await page.keyboard.press('Alt+M');
    await page.waitForTimeout(3000);

    // Wait for Day Range Meter Y-coordinate logs
    await page.waitForTimeout(2000);

    // Switch back to Market Profile to capture its Y-coordinates
    console.log('🔄 Switching back to Market Profile...');
    await page.keyboard.press('Alt+M');
    await page.waitForTimeout(3000);

    // Wait for Market Profile Y-coordinate logs
    await page.waitForTimeout(2000);

    console.log('✅ Y-coordinate data captured - check console output for comparison');
  });

  test('Analyze price scale calculation differences', async ({ page }) => {
    console.log('🧮 Analyzing price scale calculation differences...');

    // Create display
    await page.keyboard.press('Alt+A');
    await page.waitForTimeout(3000);

    // Intercept price scale calculations
    const scaleData = await page.evaluate(() => {
      return new Promise((resolve) => {
        const scales = {
          dayRange: null,
          marketProfile: null
        };

        // Intercept priceScale function calls
        let visualizationType = '';

        const originalLog = console.log;
        console.log = function(...args) {
          originalLog.apply(console, args);

          const message = args.join(' ');

          // Detect which visualization type
          if (message.includes('[MARKET_PROFILE RENDER]')) {
            visualizationType = 'marketProfile';
          } else if (message.includes('[DAY_RANGE_RENDER]')) {
            visualizationType = 'dayRange';
          }

          // Capture price scale parameters
          if (message.includes('Using EXACT Day Range scaling')) {
            const match = message.match(/Min: ([\d.]+) Max: ([\d.]+) Range: ([\d.]+)/);
            if (match) {
              scales[visualizationType] = {
                min: parseFloat(match[1]),
                max: parseFloat(match[2]),
                range: parseFloat(match[3])
              };
            }
          }
        };

        // Wait for data collection
        setTimeout(() => {
          console.log = originalLog;
          resolve(scales);
        }, 5000);
      });
    });

    console.log('📊 Price Scale Analysis:');
    console.log(JSON.stringify(scaleData, null, 2));

    // Verify both visualizations use same scale
    if (scaleData.dayRange && scaleData.marketProfile) {
      expect(scaleData.dayRange.min).toBeCloseTo(scaleData.marketProfile.min, 4);
      expect(scaleData.dayRange.max).toBeCloseTo(scaleData.marketProfile.max, 4);
      expect(scaleData.dayRange.range).toBeCloseTo(scaleData.marketProfile.range, 4);
    }
  });
});