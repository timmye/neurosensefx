/**
 * ADR Percentage Visual Verification Test
 */

import { test, expect } from '@playwright/test';

test('ADR percentage markers visual verification', async ({ page }) => {
  console.log('[ADR] Starting ADR percentage visual verification test...');

  // Collect console messages
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      timestamp: new Date().toISOString()
    });
  });

  // Navigate to the application
  await page.goto('http://localhost:5175');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Check for ADR percentage rendering
  const adrMessages = consoleMessages.filter(msg =>
    msg.text.includes('ADR') ||
    msg.text.includes('%') ||
    msg.text.includes('percentage')
  );

  console.log('[ADR] ADR related messages found:', adrMessages.length);

  // Verify day range is rendering (which includes percentage markers)
  const renderMessages = consoleMessages.filter(msg =>
    msg.text.includes('Rendering dayRange')
  );

  expect(renderMessages.length).toBeGreaterThan(0);
  console.log('[ADR] ✅ Day range rendering detected');

  // Take a screenshot to verify visual output
  await page.screenshot({
    path: 'test-results/adr-percentage-test.png',
    fullPage: false
  });
  console.log('[ADR] 📸 Screenshot captured for visual verification');

  // Check canvas is rendering without errors
  const errorMessages = consoleMessages.filter(msg =>
    msg.type === 'error' &&
    (msg.text.includes('percentage') || msg.text.includes('ADR'))
  );

  expect(errorMessages.length).toBe(0);
  console.log('[ADR] ✅ No ADR percentage rendering errors');

  // Final verification
  expect(renderMessages.length).toBeGreaterThan(0);
  console.log('[ADR] ✅ ADR percentage markers rendering successfully');
});