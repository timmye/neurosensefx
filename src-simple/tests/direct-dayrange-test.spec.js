// Direct Day Range Meter Test
// Tests progressive ADR disclosure and performance directly
import { test, expect } from '@playwright/test';

test.describe('Direct Day Range Meter Testing', () => {
  test.beforeEach(async ({ page }) => {
    // Set up enhanced console logging
    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();

      let emoji = '💡';
      if (text.includes('❌') || type === 'error') emoji = '❌';
      else if (text.includes('⚠️') || type === 'warning') emoji = '⚠️';
      else if (text.includes('✅')) emoji = '✅';
      else if (text.includes('📊')) emoji = '📊';
      else if (text.includes('🎨')) emoji = '🎨';
      else if (text.includes('⚡')) emoji = '⚡';
      else if (text.includes('🧪')) emoji = '🧪';

      console.log(`${emoji} ${text}`);
    });
  });

  test('Progressive ADR Disclosure Validation', async ({ page }) => {
    console.log('🌐 Starting Progressive ADR Disclosure Validation...');

    // Navigate to the direct test page
    await page.goto('http://localhost:5176/test-direct-dayrange.html');
    await page.waitForLoadState('networkidle');

    // Wait for modules to load
    await page.waitForTimeout(2000);

    // Test high volatility scenario (>50% ADR)
    console.log('🧪 Testing high volatility scenario (>50% ADR)...');
    await page.click('button:has-text("Test High Volatility")');
    await page.waitForTimeout(1000);

    // Check console output for progressive disclosure results
    const consoleContent = await page.$eval('#console-output', el => el.textContent);

    console.log('\n📊 CONSOLE OUTPUT ANALYSIS:');
    console.log(consoleContent);

    // Verify progressive disclosure is working
    expect(consoleContent).toContain('Progressive disclosure: ACTIVE');
    expect(consoleContent).toContain('Expected static markers');
    expect(consoleContent).toContain('Day Range %:');

    // Test extreme volatility scenario (>75% ADR)
    console.log('🧪 Testing extreme volatility scenario (>75% ADR)...');
    await page.click('button:has-text("Test Extreme Volatility")');
    await page.waitForTimeout(1000);

    const extremeConsoleContent = await page.$eval('#console-output', el => el.textContent);
    expect(extremeConsoleContent).toContain('Progressive disclosure: ACTIVE');
  });

  test('Dynamic Percentage Markers Test', async ({ page }) => {
    console.log('🎯 Testing Dynamic Percentage Markers...');

    await page.goto('http://localhost:5176/test-direct-dayrange.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Test dynamic markers
    await page.click('button:has-text("Test Dynamic Markers")');
    await page.waitForTimeout(1000);

    const consoleContent = await page.$eval('#console-output', el => el.textContent);
    expect(consoleContent).toContain('Dynamic marker test');
    expect(consoleContent).toContain('Day Range =');
    expect(consoleContent).toContain('% of ADR');
  });

  test('Performance Analysis', async ({ page }) => {
    console.log('⚡ Testing Performance Analysis...');

    await page.goto('http://localhost:5176/test-direct-dayrange.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Test performance with 100 renders
    await page.click('button:has-text("Test Performance (100 renders)")');
    await page.waitForTimeout(5000); // Wait for performance test to complete

    const consoleContent = await page.$eval('#console-output', el => el.textContent);

    console.log('\n⚡ PERFORMANCE ANALYSIS RESULTS:');
    console.log(consoleContent);

    // Verify performance metrics are displayed
    expect(consoleContent).toContain('Performance Analysis (100 renders)');
    expect(consoleContent).toContain('Average:');
    expect(consoleContent).toContain('Theoretical FPS');

    // Check for good performance indicators
    if (consoleContent.includes('EXCELLENT: 60+ FPS capable')) {
      console.log('🚀 EXCELLENT: Performance target achieved (60+ FPS)');
    } else if (consoleContent.includes('GOOD: 30+ FPS capable')) {
      console.log('✅ GOOD: Performance acceptable (30+ FPS)');
    } else if (consoleContent.includes('ACCEPTABLE: Sub-100ms latency')) {
      console.log('✅ ACCEPTABLE: Sub-100ms latency achieved');
    } else {
      console.log('⚠️ Performance may need optimization');
    }
  });

  test('Module Loading Validation', async ({ page }) => {
    console.log('📦 Testing Module Loading...');

    await page.goto('http://localhost:5176/test-direct-dayrange.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Wait for all modules to load

    const consoleContent = await page.$eval('#console-output', el => el.textContent);

    console.log('\n📦 MODULE LOADING RESULTS:');
    console.log(consoleContent);

    // Verify all modules loaded successfully
    expect(consoleContent).toContain('All modules loaded successfully');
    expect(consoleContent).toContain('renderDayRange function: function');
    expect(consoleContent).toContain('Ready for testing');

    // Check for any loading errors
    expect(consoleContent).not.toContain('Module loading failed');
  });
});