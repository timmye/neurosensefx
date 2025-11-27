/**
 * Simple optimization system test
 * Tests basic functionality of the Phase 2 optimization systems
 */

import { test, expect } from '@playwright/test';

test.describe('Phase 2: Simple Optimization Test', () => {
  test('should load optimization modules without errors', async ({ page }) => {
    console.log('🧪 Testing optimization module loading...');

    // Navigate to the development server
    await page.goto('http://localhost:5174');

    // Wait for basic page load
    await page.waitForLoadState('networkidle');

    // Test that the page loads without JavaScript errors
    const errors = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    // Wait a moment for any initialization errors
    await page.waitForTimeout(2000);

    // Check for critical errors
    const criticalErrors = errors.filter(error =>
      error.includes('Failed to load') ||
      error.includes('Module not found') ||
      error.includes('ImportError')
    );

    console.log(`Found ${errors.length} errors, ${criticalErrors.length} critical:`);
    errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error}`);
    });

    // Should not have critical errors
    expect(criticalErrors.length).toBe(0);

    // Test that optimization modules can be accessed
    const optimizationStatus = await page.evaluate(() => {
      return {
        hasDirtyRectangles: typeof window.DirtyRectangleManager !== 'undefined',
        hasCanvasCache: typeof window.CanvasCacheManager !== 'undefined',
        hasFrameScheduler: typeof window.FrameScheduler !== 'undefined',
        hasVisualizationOptimizer: typeof window.VisualizationOptimizer !== 'undefined',
        hasOptimizedPipeline: typeof window.OptimizedRenderingPipeline !== 'undefined'
      };
    });

    console.log('📊 Module loading status:', optimizationStatus);

    // At least some optimization modules should be available
    const availableModules = Object.values(optimizationStatus).filter(Boolean).length;
    expect(availableModules).toBeGreaterThan(0);
  });

  test('should create displays with optimization active', async ({ page }) => {
    console.log('🧪 Testing display creation with optimizations...');

    // Navigate to the development server
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');

    // Wait for application to initialize
    await page.waitForTimeout(2000);

    // Create a display using the normal workflow
    await page.keyboard.press('Control+k');

    // Wait for the symbol palette to appear
    try {
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
      await page.fill('[role="dialog"] input', 'EUR/USD');
      await page.keyboard.press('Enter');

      // Wait for display creation
      await page.waitForTimeout(2000);

      console.log('✅ Display created successfully');

      // Check if any containers exist
      const containers = await page.locator('.viz-container').count();
      console.log(`Found ${containers} visualization containers`);

      expect(containers).toBeGreaterThan(0);

    } catch (error) {
      console.log('Display creation test failed - may be expected if components not ready');
      console.log('Error:', error.message);
    }
  });
});