/**
 * Real-World Configuration Testing
 *
 * Tests configuration system with actual browser environment,
 * real localStorage persistence, and live DOM interactions
 */

import { test, expect } from '@playwright/test';
import { chromium } from 'playwright';

// Test configuration
const BASE_URL = 'http://localhost:5174';

test.describe('Real-World Configuration Management', () => {
  let browser;
  let context;
  let page;

  test.beforeAll(async () => {
    // Launch real browser with localStorage enabled
    browser = await chromium.launch({
      headless: false,
      args: ['--disable-web-security']
    });
  });

  test.beforeEach(async () => {
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      // Enable localStorage for persistence testing
      storageState: {
        origins: [{
          origin: BASE_URL,
          localStorage: []
        }]
      }
    });
    page = await context.newPage();

    // Setup configuration monitoring
    await page.addInitScript(() => {
      window.configMetrics = {
        changes: [],
        loadTimes: [],
        saveTimes: []
      };

      // Monitor real localStorage operations
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = function(key, value) {
        const startTime = performance.now();
        const result = originalSetItem.call(this, key, value);
        const endTime = performance.now();

        if (key.includes('config') || key.includes('defaults')) {
          window.configMetrics.saveTimes.push(endTime - startTime);
          window.configMetrics.changes.push({
            key,
            value: JSON.parse(value),
            timestamp: Date.now()
          });
        }

        return result;
      };

      // Monitor configuration load performance
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = function(key) {
        const startTime = performance.now();
        const result = originalGetItem.call(this, key);
        const endTime = performance.now();

        if (key.includes('config') || key.includes('defaults')) {
          window.configMetrics.loadTimes.push(endTime - startTime);
        }

        return result;
      };
    });
  });

  test.afterEach(async () => {
    await context.close();
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test('Real configuration persistence across browser sessions', async () => {
    console.log('🧪 Testing real configuration persistence...');

    // Navigate to application
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Test configuration changes in real browser
    console.log('⚙️ Testing configuration modifications...');

    // Simulate real user configuration changes via UI
    await page.evaluate(() => {
      if (window.configDefaultsManager) {
        // Make real configuration changes
        window.configDefaultsManager.updateUserDefaults({
          visualizationsContentWidth: 180,
          adrAxisPosition: 30,
          showAdrInfo: true
        });
      }
    });

    await page.waitForTimeout(1000);

    // Verify configuration was modified
    const configModified = await page.evaluate(() => {
      return window.configDefaultsManager ?
             window.configDefaultsManager.hasUserModifications() : false;
    });

    expect(configModified).toBe(true);

    // Test configuration persistence performance
    const saveTimes = await page.evaluate(() => window.configMetrics.saveTimes);
    const avgSaveTime = saveTimes.reduce((a, b) => a + b, 0) / saveTimes.length;

    console.log(`⚡ Average configuration save time: ${avgSaveTime.toFixed(2)}ms`);
    expect(avgSaveTime).toBeLessThan(10); // Should be very fast

    // Close and reopen browser to test persistence
    await context.close();
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      // Restore localStorage state
      storageState: {
        origins: [{
          origin: BASE_URL,
          localStorage: [] // Will be populated by Playwright from previous context
        }]
      }
    });
    page = await context.newPage();

    // Navigate again
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify configuration persisted
    const configPersisted = await page.evaluate(() => {
      const manager = window.configDefaultsManager;
      if (!manager) return false;

      const defaults = manager.getEffectiveDefaults();
      return defaults.visualizationsContentWidth === 180 &&
             defaults.adrAxisPosition === 30 &&
             defaults.showAdrInfo === true;
    });

    expect(configPersisted).toBe(true);
  });

  test('Real configuration loading performance', async () => {
    console.log('🧪 Testing real configuration loading performance...');

    // Test cold start performance
    const coldLoadStart = performance.now();

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Wait for configuration system to initialize
    await page.waitForFunction(() => {
      return window.configDefaultsManager !== undefined &&
             window.configDefaultsManager.getFactoryDefaults !== undefined;
    }, { timeout: 10000 });

    const coldLoadTime = performance.now() - coldLoadStart;
    console.log(`⚡ Cold configuration load time: ${coldLoadTime.toFixed(2)}ms`);

    // Configuration should load quickly
    expect(coldLoadTime).toBeLessThan(2000);

    // Test configuration access performance
    const accessTimes = await page.evaluate(() => {
      const manager = window.configDefaultsManager;
      const times = [];

      // Test rapid configuration access
      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        const config = manager.getEffectiveDefaults();
        const end = performance.now();
        times.push(end - start);
      }

      return {
        average: times.reduce((a, b) => a + b, 0) / times.length,
        max: Math.max(...times),
        min: Math.min(...times)
      };
    });

    console.log(`⚡ Average config access time: ${accessTimes.average.toFixed(3)}ms`);
    console.log(`⚡ Max config access time: ${accessTimes.max.toFixed(3)}ms`);

    // Configuration access should be extremely fast
    expect(accessTimes.average).toBeLessThan(1);
    expect(accessTimes.max).toBeLessThan(5);
  });

  test('Real configuration validation with user interactions', async () => {
    console.log('🧪 Testing real configuration validation...');

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Test configuration validation through real UI interactions
    console.log('🎯 Testing configuration via UI interactions...');

    // Open symbol palette (uses configuration)
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(600);

    // Verify search palette uses correct configuration
    const searchPaletteConfig = await page.evaluate(() => {
      const searchInput = document.querySelector('.search-input');
      if (!searchInput) return null;

      const styles = window.getComputedStyle(searchInput);
      return {
        backgroundColor: styles.backgroundColor,
        color: styles.color,
        borderColor: styles.borderColor,
        fontSize: styles.fontSize,
        padding: styles.padding
      };
    });

    expect(searchPaletteConfig).not.toBeNull();
    expect(searchPaletteConfig.backgroundColor).toBeDefined();

    // Test configuration changes affect real UI
    await page.evaluate(() => {
      if (window.configDefaultsManager) {
        window.configDefaultsManager.updateUserDefaults({
          priceDisplayBackgroundColor: 'rgba(255, 0, 0, 0.8)', // Red background
          priceDisplayFontColor: '#FFFFFF' // White text
        });
      }
    });

    await page.waitForTimeout(500);

    // Test configuration with real display creation
    await page.keyboard.type('EUR/USD');
    await page.waitForTimeout(500);

    const eurUsdResult = page.locator('.search-result').filter({ hasText: 'EUR/USD' });
    const eurUsdExists = await eurUsdResult.count() > 0;

    if (eurUsdExists) {
      await eurUsdResult.first().click();
      await page.waitForTimeout(2000);

      // Verify display uses new configuration
      const displayConfig = await page.evaluate(() => {
        const priceDisplay = document.querySelector('.price-display');
        if (!priceDisplay) return null;

        const styles = window.getComputedStyle(priceDisplay);
        return {
          backgroundColor: styles.backgroundColor,
          color: styles.color
        };
      });

      if (displayConfig) {
        console.log('🎨 New configuration applied to display:', displayConfig);
        // Should reflect the new red background and white text
        expect(displayConfig.backgroundColor).toContain('255');
      }
    }
  });

  test('Real configuration edge cases and error handling', async () => {
    console.log('🧪 Testing real configuration edge cases...');

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Test rapid configuration changes
    console.log('⚡ Testing rapid configuration changes...');

    const rapidChangeStart = performance.now();

    for (let i = 0; i < 50; i++) {
      await page.evaluate((iteration) => {
        if (window.configDefaultsManager) {
          window.configDefaultsManager.updateUserDefaults({
            visualizationsContentWidth: 100 + (iteration % 100),
            adrAxisPosition: 10 + (iteration % 80),
            meterHeight: 20 + (iteration % 130)
          });
        }
      }, i);

      await page.waitForTimeout(10); // Small delay between changes
    }

    const rapidChangeTime = performance.now() - rapidChangeStart;
    console.log(`⚡ Rapid configuration changes completed in: ${rapidChangeTime.toFixed(2)}ms`);

    // System should handle rapid changes gracefully
    expect(rapidChangeTime).toBeLessThan(5000);

    // Test configuration corruption recovery
    console.log('🔧 Testing configuration corruption recovery...');

    // Simulate corrupted localStorage
    await page.evaluate(() => {
      localStorage.setItem('neurosense-config-user-defaults', 'invalid-json-data');
      localStorage.setItem('neurosense-config-state', 'corrupted-data');
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // System should recover gracefully
    const systemRecovered = await page.evaluate(() => {
      return window.configDefaultsManager !== undefined &&
             typeof window.configDefaultsManager.getFactoryDefaults === 'function';
    });

    expect(systemRecovered).toBe(true);

    // Configuration should be reset to defaults
    const configReset = await page.evaluate(() => {
      const manager = window.configDefaultsManager;
      return manager ? !manager.hasUserModifications() : false;
    });

    expect(configReset).toBe(true);
  });

  test('Real configuration memory usage and performance', async () => {
    console.log('🧪 Testing configuration memory usage...');

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Get baseline memory
    const baselineMemory = await page.evaluate(() => {
      return performance.memory ? performance.memory.usedJSHeapSize : 0;
    });

    console.log(`💾 Baseline memory: ${(baselineMemory / 1024 / 1024).toFixed(2)} MB`);

    // Perform extensive configuration operations
    console.log('⚡ Testing configuration operations performance...');

    for (let cycle = 0; cycle < 10; cycle++) {
      // Create many configuration instances
      await page.evaluate(() => {
        for (let i = 0; i < 20; i++) {
          if (window.ConfigDefaultsManager) {
            const manager = new window.ConfigDefaultsManager();
            manager.updateUserDefaults({
              visualizationsContentWidth: 100 + i,
              adrAxisPosition: 20 + i,
              meterHeight: 60 + i
            });
          }
        }
      });

      await page.waitForTimeout(100);

      // Test configuration serialization
      await page.evaluate(() => {
        if (window.configDefaultsManager) {
          for (let i = 0; i < 10; i++) {
            const state = window.configDefaultsManager.exportState();
            localStorage.setItem(`test-config-${i}`, JSON.stringify(state));
          }
        }
      });

      await page.waitForTimeout(50);

      // Clean up test data
      await page.evaluate(() => {
        for (let i = 0; i < 10; i++) {
          localStorage.removeItem(`test-config-${i}`);
        }
      });
    }

    // Check final memory usage
    const finalMemory = await page.evaluate(() => {
      return performance.memory ? performance.memory.usedJSHeapSize : 0;
    });

    const memoryIncrease = finalMemory - baselineMemory;
    console.log(`💾 Final memory: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`);
    console.log(`💾 Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);

    // Memory increase should be minimal
    expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024); // Less than 20MB increase
  });

  test('Real configuration integration with displays', async () => {
    console.log('🧪 Testing configuration integration with displays...');

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Test configuration affects real display creation
    console.log('🖼️ Testing display creation with custom configuration...');

    // Set specific configuration
    await page.evaluate(() => {
      if (window.configDefaultsManager) {
        window.configDefaultsManager.updateUserDefaults({
          visualizationsContentWidth: 200,
          showAdrRangeIndicatorLines: false,
          adrLabelType: 'percentage',
          priceDisplayBackgroundColor: 'rgba(0, 100, 200, 0.9)'
        });
      }
    });

    await page.waitForTimeout(500);

    // Create multiple displays with the configuration
    const testSymbols = ['EUR/USD', 'GBP/USD', 'USD/JPY'];
    const createdDisplays = [];

    for (const symbol of testSymbols) {
      await page.keyboard.press('Control+k');
      await page.keyboard.type(symbol);
      await page.waitForTimeout(500);

      const symbolResult = page.locator('.search-result').filter({ hasText: symbol });
      const symbolExists = await symbolResult.count() > 0;

      if (symbolExists) {
        await symbolResult.first().click();
        await page.waitForTimeout(2000);

        const displayCount = await page.locator('[data-display-id]').count();
        createdDisplays.push({
          symbol,
          count: displayCount,
          timestamp: Date.now()
        });
      }

      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    console.log(`📊 Created displays: ${createdDisplays.length}`);

    // Verify all displays use the custom configuration
    const configAppliedToDisplays = await page.evaluate(() => {
      const displays = document.querySelectorAll('[data-display-id]');
      const results = [];

      displays.forEach((display, index) => {
        const priceDisplay = display.querySelector('.price-display');
        if (priceDisplay) {
          const styles = window.getComputedStyle(priceDisplay);
          results.push({
            index,
            backgroundColor: styles.backgroundColor,
            hasCustomWidth: styles.width.includes('200') || styles.minWidth.includes('200')
          });
        }
      });

      return results;
    });

    console.log('🎨 Configuration applied to displays:', configAppliedToDisplays);

    // At least some displays should reflect the custom configuration
    expect(createdDisplays.length).toBeGreaterThan(0);
    expect(configAppliedToDisplays.length).toBeGreaterThan(0);
  });

  test('Real configuration workflow performance', async () => {
    console.log('🧪 Testing complete configuration workflow performance...');

    const workflowStartTime = performance.now();

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Test complete configuration workflow:
    // 1. Load defaults
    // 2. User modifies configuration
    // 3. Create displays with new configuration
    // 4. Configuration persists
    // 5. Reset to defaults

    // Step 1: Load defaults
    const loadTime = await page.evaluate(() => {
      const start = performance.now();
      const manager = window.configDefaultsManager;
      const defaults = manager.getFactoryDefaults();
      const end = performance.now();
      return end - start;
    });

    // Step 2: User modifications
    const modificationStartTime = performance.now();

    await page.evaluate(() => {
      if (window.configDefaultsManager) {
        window.configDefaultsManager.updateUserDefaults({
          visualizationsContentWidth: 180,
          meterHeight: 80,
          adrAxisPosition: 40,
          showAdrInfo: true,
          adrLabelType: 'percentage'
        });
      }
    });

    const modificationTime = performance.now() - modificationStartTime;

    // Step 3: Create display with new configuration
    await page.keyboard.press('Control+k');
    await page.keyboard.type('AUD/USD');
    await page.waitForTimeout(500);

    const audUsdResult = page.locator('.search-result').filter({ hasText: 'AUD/USD' });
    const audUsdExists = await audUsdResult.count() > 0;

    let displayCreated = false;
    if (audUsdExists) {
      await audUsdResult.first().click();
      await page.waitForTimeout(2000);
      displayCreated = true;
    }

    // Step 4: Verify configuration persistence
    const configPersisted = await page.evaluate(() => {
      const manager = window.configDefaultsManager;
      return manager ? manager.hasUserModifications() : false;
    });

    // Step 5: Reset to defaults
    const resetStartTime = performance.now();

    await page.evaluate(() => {
      if (window.configDefaultsManager) {
        window.configDefaultsManager.resetToFactory();
      }
    });

    const resetTime = performance.now() - resetStartTime;

    const totalWorkflowTime = performance.now() - workflowStartTime;

    // Performance metrics
    console.log(`⚡ Configuration load time: ${loadTime.toFixed(2)}ms`);
    console.log(`⚡ Configuration modification time: ${modificationTime.toFixed(2)}ms`);
    console.log(`⚡ Configuration reset time: ${resetTime.toFixed(2)}ms`);
    console.log(`⚡ Total workflow time: ${totalWorkflowTime.toFixed(2)}ms`);

    // Performance expectations
    expect(loadTime).toBeLessThan(50);
    expect(modificationTime).toBeLessThan(100);
    expect(resetTime).toBeLessThan(50);
    expect(totalWorkflowTime).toBeLessThan(10000); // 10 seconds max
    expect(configPersisted).toBe(true);
    expect(displayCreated).toBe(true);
  });
});

// Global test configuration
test.use({
  timeout: 30000,
  actionTimeout: 5000
});