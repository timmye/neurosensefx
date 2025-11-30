// Keyboard Integration Test
// Verifies Alt+A and Escape keyboard shortcuts work correctly

import { test, expect } from '@playwright/test';

test.describe('Keyboard Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5175');
    await page.waitForLoadState('networkidle');

    // Wait for the application to initialize
    await page.waitForTimeout(1000);
  });

  test('Alt+A symbol prompt works', async ({ page }) => {
    // Test the existing Alt+A functionality
    await page.keyboard.press('Alt+a');

    // Check for prompt appearance by checking for alert dialog
    const promptPromise = page.waitForEvent('dialog');
    await page.keyboard.type('EURUSD');
    await promptPromise.then(dialog => dialog.accept());

    // Wait for display creation
    await page.waitForTimeout(500);

    // Verify display was created
    const displays = page.locator('.floating-display');
    await expect(displays).toHaveCount(1);

    // Verify it shows the correct symbol
    const symbol = page.locator('.symbol');
    await expect(symbol).toContainText('EURUSD');
  });

  test('Escape key progressive pattern works', async ({ page }) => {
    // Create a display first
    await page.keyboard.press('Alt+a');
    await page.waitForEvent('dialog').then(dialog => {
      dialog.type('EURUSD');
      dialog.accept();
    });
    await page.waitForTimeout(500);

    // Focus the display
    await page.click('.floating-display');
    await page.waitForTimeout(100);

    // Verify display has focus
    const focusedDisplay = page.locator('.floating-display.focused');
    await expect(focusedDisplay).toHaveCount(1);

    // Press Escape twice: once to clear any overlays, once to clear focus
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    // Verify focus is cleared
    await expect(focusedDisplay).toHaveCount(0);
  });

  test('Keyboard accessibility attributes present', async ({ page }) => {
    // Create a display first
    await page.keyboard.press('Alt+a');
    await page.waitForEvent('dialog').then(dialog => {
      dialog.type('EURUSD');
      dialog.accept();
    });
    await page.waitForTimeout(500);

    // Check that displays have proper accessibility attributes
    const displays = page.locator('.floating-display');
    if (await displays.count() > 0) {
      // Check for tabindex
      const firstDisplay = displays.first();
      await expect(firstDisplay).toHaveAttribute('tabindex', '0');

      // Check for ARIA attributes
      await expect(firstDisplay).toHaveAttribute('role', 'application');
      await expect(firstDisplay).toHaveAttribute('aria-label');
    }
  });
});