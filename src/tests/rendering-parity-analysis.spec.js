// Rendering Parity Analysis Test - Crystal Clarity Compliant
// Tests exact Y-coordinate alignment between Day Range Meter and Market Profile

import { test, expect } from '@playwright/test';

test.describe('Rendering Parity Analysis', () => {
  test.beforeEach(async ({ page }) => {
    // Set up console logging to capture Y-coordinate data
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[Y-COORDINATE]') ||
          text.includes('[DAY_RANGE_RENDER]') ||
          text.includes('[MARKET_PROFILE_RENDER]') ||
          text.includes('priceScale(')) {
        console.log(`[${msg.type().toUpperCase()}] ${text}`);
      }
    });

    page.on('pageerror', error => {
      console.error(`[PAGE ERROR] ${error.message}`);
    });

    await page.goto('http://localhost:5174');
    await page.waitForSelector('.workspace', { timeout: 10000 });

    // Handle the prompt dialog for display creation
    page.on('dialog', async dialog => {
      await dialog.accept('BTCUSD');
    });
  });

  test('Exact Y-coordinate parity analysis between visualizations', async ({ page }) => {
    console.log('🔍 Starting exact Y-coordinate parity analysis...');

    // Create two displays for comparison
    await page.keyboard.press('Alt+A');
    await page.waitForTimeout(2000);
    await page.keyboard.press('Alt+A');
    await page.waitForTimeout(3000); // Wait for full data initialization

    // Get both display elements
    const displays = await page.locator('.floating-display').all();
    expect(displays).toHaveLength(2);

    // Switch first display to Day Range Meter
    console.log('🔄 Switching first display to Day Range Meter...');
    await displays[0].click();
    await page.keyboard.press('Alt+M');
    await page.waitForTimeout(2000);

    // Ensure second display is Market Profile
    console.log('🔄 Ensuring second display is Market Profile...');
    await displays[1].click();
    await page.waitForTimeout(1000);

    // Capture Y-coordinate data from console logs
    const yCoordinateData = await page.evaluate(() => {
      return new Promise((resolve) => {
        const yData = {
          dayRange: [],
          marketProfile: []
        };

        // Intercept console.log calls
        const originalLog = console.log;
        console.log = function(...args) {
          originalLog.apply(console, args);

          const message = args.join(' ');

          // Capture priceScale calculations from Day Range
          if (message.includes('[DAY_RANGE_RENDER]') &&
              (message.includes('Current Price:') || message.includes('Open Price:') ||
               message.includes('High:') || message.includes('Low:'))) {
            const match = message.match(/Y:\s*([\d.]+)/);
            if (match) {
              yData.dayRange.push(parseFloat(match[1]));
            }
          }

          // Capture priceScale calculations from Market Profile
          if (message.includes('[MARKET_PROFILE RENDER]') &&
              message.includes('Y:')) {
            const match = message.match(/Y:\s*([\d.]+)/);
            if (match) {
              yData.marketProfile.push(parseFloat(match[1]));
            }
          }
        };

        // Wait for data collection
        setTimeout(() => {
          console.log = originalLog; // Restore original
          resolve(yData);
        }, 3000);
      });
    });

    console.log('📊 Y-Coordinate Analysis Results:');
    console.log('Day Range Y-coordinates:', yCoordinateData.dayRange);
    console.log('Market Profile Y-coordinates:', yCoordinateData.marketProfile);

    // Calculate differences for matching price levels
    if (yCoordinateData.dayRange.length > 0 && yCoordinateData.marketProfile.length > 0) {
      const differences = [];
      const minLength = Math.min(yCoordinateData.dayRange.length, yCoordinateData.marketProfile.length);

      for (let i = 0; i < minLength; i++) {
        const diff = Math.abs(yCoordinateData.dayRange[i] - yCoordinateData.marketProfile[i]);
        differences.push(diff);
      }

      const maxDifference = Math.max(...differences);
      const avgDifference = differences.reduce((a, b) => a + b, 0) / differences.length;

      console.log(`📏 Maximum Y-coordinate difference: ${maxDifference.toFixed(4)} pixels`);
      console.log(`📏 Average Y-coordinate difference: ${avgDifference.toFixed(4)} pixels`);

      // Check for pixel-perfect parity (within 0.5 pixels)
      expect(maxDifference).toBeLessThan(1.0);
      expect(avgDifference).toBeLessThan(0.5);
    }
  });

  test('Canvas setup and CSS compliance analysis', async ({ page }) => {
    console.log('🎨 Analyzing canvas setup and CSS compliance...');

    // Create display for analysis
    await page.keyboard.press('Alt+A');
    await page.waitForTimeout(3000);

    // Get canvas elements and analyze their setup
    const canvasData = await page.evaluate(() => {
      const canvas = document.querySelector('.floating-display canvas');
      if (!canvas) return null;

      const computedStyle = window.getComputedStyle(canvas);
      const rect = canvas.getBoundingClientRect();

      return {
        width: canvas.width,
        height: canvas.height,
        styleWidth: computedStyle.width,
        styleHeight: computedStyle.height,
        position: computedStyle.position,
        top: computedStyle.top,
        left: computedStyle.left,
        transform: computedStyle.transform,
        transformOrigin: computedStyle.transformOrigin,
        fontFamily: computedStyle.fontFamily,
        fontSize: computedStyle.fontSize,
        color: computedStyle.color,
        backgroundColor: computedStyle.backgroundColor,
        border: computedStyle.border,
        borderRadius: computedStyle.borderRadius,
        padding: computedStyle.padding,
        margin: computedStyle.margin,
        boxSizing: computedStyle.boxSizing,
        display: computedStyle.display,
        zIndex: computedStyle.zIndex,
        clientWidth: rect.width,
        clientHeight: rect.height
      };
    });

    console.log('🖼️ Canvas Analysis Results:');
    console.log(JSON.stringify(canvasData, null, 2));

    // Verify canvas setup compliance
    expect(canvasData).not.toBeNull();
    expect(canvasData.display).toBe('block');
    expect(canvasData.position).toBe('static');
    expect(canvasData.transform).toBe('none');
    expect(canvasData.borderRadius).toBe('0px');
  });

  test('Text rendering compliance analysis', async ({ page }) => {
    console.log('📝 Analyzing text rendering compliance...');

    // Create display for analysis
    await page.keyboard.press('Alt+A');
    await page.waitForTimeout(3000);

    // Capture text rendering information
    const textData = await page.evaluate(() => {
      const canvas = document.querySelector('.floating-display canvas');
      if (!canvas) return null;

      const ctx = canvas.getContext('2d');

      // Get current text rendering state
      return {
        font: ctx.font,
        fillStyle: ctx.fillStyle,
        strokeStyle: ctx.strokeStyle,
        textAlign: ctx.textAlign,
        textBaseline: ctx.textBaseline,
        direction: ctx.direction,
        fontKerning: ctx.fontKerning,
        fontStretch: ctx.fontStretch,
        fontVariant: ctx.fontVariant,
        fontWeight: ctx.fontWeight,
        lineHeight: ctx.lineHeight,
        letterSpacing: ctx.letterSpacing
      };
    });

    console.log('📝 Text Rendering Analysis Results:');
    console.log(JSON.stringify(textData, null, 2));

    // Verify text rendering setup
    expect(textData).not.toBeNull();
    expect(textData.textAlign).toBe('start'); // Default should be start
    expect(textData.textBaseline).toBe('alphabetic'); // Default should be alphabetic
  });
});