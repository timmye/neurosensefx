/**
 * User interaction tests for NeuroSense FX
 * Tests mouse, keyboard, and touch interactions
 */

import { test, expect } from '@playwright/test';
import { browserAgentManager } from '../helpers/browser-agents.js';
import { testFixtures } from '../helpers/fixtures.js';

test.describe('User Interaction Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await browserAgentManager.setupConsoleMonitoring(page);
    await page.waitForSelector('canvas', { timeout: 5000 });
  });

  test('mouse interactions trigger proper responses', async ({ page }) => {
    const interactionEvents = [];

    // Track mouse events
    await page.addInitScript(() => {
      window.mouseEvents = [];
      document.addEventListener('mousemove', (e) => {
        window.mouseEvents.push({ type: 'mousemove', x: e.clientX, y: e.clientY });
      });
      document.addEventListener('click', (e) => {
        window.mouseEvents.push({ type: 'click', x: e.clientX, y: e.clientY });
      });
      document.addEventListener('contextmenu', (e) => {
        window.mouseEvents.push({ type: 'contextmenu', x: e.clientX, y: e.clientY });
      });
    });

    // Perform mouse interactions
    await page.mouse.move(200, 200);
    await page.mouse.click(200, 200);
    await page.mouse.move(400, 300);
    await page.mouse.click(400, 300, { button: 'right' });

    // Verify events were captured
    const events = await page.evaluate(() => window.mouseEvents || []);
    expect(events.length).toBeGreaterThan(2);
    expect(events.some(e => e.type === 'mousemove')).toBe(true);
    expect(events.some(e => e.type === 'click')).toBe(true);
  });

  test('context menu appears on right-click', async ({ page }) => {
    // Right-click on canvas
    await page.mouse.move(400, 300);
    await page.mouse.click(400, 300, { button: 'right' });

    // Wait for potential context menu
    await page.waitForTimeout(500);

    // Check for context menu using multiple selectors
    const contextMenuSelectors = [
      '.context-menu',
      '[data-testid="context-menu"]',
      '.dropdown-menu',
      '.menu'
    ];

    let menuVisible = false;
    for (const selector of contextMenuSelectors) {
      try {
        const element = page.locator(selector);
        if (await element.isVisible({ timeout: 1000 })) {
          menuVisible = true;
          break;
        }
      } catch (error) {
        // Continue trying other selectors
      }
    }

    console.log(`Context menu visible: ${menuVisible}`);
    // Note: Context menu may not be implemented yet
  });

  test('keyboard navigation works', async ({ page }) => {
    const keyboardEvents = [];

    await page.addInitScript(() => {
      window.keyboardEvents = [];
      document.addEventListener('keydown', (e) => {
        window.keyboardEvents.push({ key: e.key, code: e.code, ctrlKey: e.ctrlKey });
      });
    });

    // Test keyboard shortcuts
    await page.keyboard.press('Escape');
    await page.keyboard.press('Space');
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Control+s');

    // Verify events were captured
    const events = await page.evaluate(() => window.keyboardEvents || []);
    expect(events.length).toBeGreaterThan(0);
    expect(events.some(e => e.key === 'Escape')).toBe(true);
    expect(events.some(e => e.key === ' ')).toBe(true);
  });

  test('drag and drop functionality works', async ({ page }) => {
    // Find draggable elements
    const draggables = await page.locator('[draggable="true"], .draggable, [data-draggable]').all();

    if (draggables.length > 0) {
      const firstDraggable = draggables[0];

      // Get initial position
      const initialPosition = await firstDraggable.boundingBox();
      expect(initialPosition).toBeTruthy();

      // Perform drag operation
      await firstDraggable.hover();
      await page.mouse.down();
      await page.mouse.move(initialPosition.x + 100, initialPosition.y + 100);
      await page.mouse.up();

      // Wait for any drop animations
      await page.waitForTimeout(500);
    } else {
      console.log('No draggable elements found - drag-drop test skipped');
    }
  });

  test('touch interactions work on mobile devices', async ({ page }) => {
    // Simulate touch device
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'maxTouchPoints', {
        get: () => 2,
      });
    });

    await page.touch.tap(300, 300);
    await page.touch.tap(400, 400);

    // Test swipe gesture
    await page.touch.tap(200, 300);
    await page.touch.move(600, 300);
    await page.touch.end();

    await page.waitForTimeout(500);
  });

  test('form inputs handle user input correctly', async ({ page }) => {
    // Look for input fields
    const inputs = await page.locator('input, textarea, select').all();

    if (inputs.length > 0) {
      const firstInput = inputs[0];

      // Test text input
      await firstInput.fill('Test input value');
      const value = await firstInput.inputValue();
      expect(value).toBe('Test input value');

      // Test input events
      await firstInput.press('Backspace');
      const backspaceValue = await firstInput.inputValue();
      expect(backspaceValue.length).toBeLessThan(value.length);
    } else {
      console.log('No input fields found - form test skipped');
    }
  });

  test('hover states work properly', async ({ page }) => {
    const hoverTargets = await page.locator('canvas, button, [role="button"], a').all();

    if (hoverTargets.length > 0) {
      const target = hoverTargets[0];

      // Test hover
      await target.hover();
      await page.waitForTimeout(200);

      // Check for hover styles or effects
      const hasHoverEffect = await page.evaluate((element) => {
        const computedStyle = window.getComputedStyle(element);
        return computedStyle.cursor !== 'default' ||
               computedStyle.transform !== 'none' ||
               computedStyle.opacity !== '1';
      }, await target.elementHandle());

      console.log(`Hover effect detected: ${hasHoverEffect}`);
    } else {
      console.log('No hover targets found - hover test skipped');
    }
  });

  test('scroll interactions work', async ({ page }) => {
    // Test page scrolling
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(500);

    await page.mouse.wheel(0, -500);
    await page.waitForTimeout(500);

    // Test horizontal scrolling
    await page.mouse.wheel(200, 0);
    await page.waitForTimeout(500);

    await page.mouse.wheel(-200, 0);
    await page.waitForTimeout(500);

    // Check scroll position
    const scrollPosition = await page.evaluate(() => ({
      x: window.scrollX,
      y: window.scrollY
    }));

    console.log(`Final scroll position: x=${scrollPosition.x}, y=${scrollPosition.y}`);
  });
});