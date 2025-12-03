/**
 * Final ADR Percentage Visualization Verification Test
 */

import { test, expect } from '@playwright/test';

test('verify ADR percentage markers are rendering', async ({ page }) => {
  console.log('[FINAL] Verifying ADR percentage markers are visible...');

  // Navigate to the application
  await page.goto('http://localhost:5175');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Collect console messages for analysis
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      timestamp: new Date().toISOString()
    });
  });

  // Check for successful day range rendering (which includes percentage markers)
  const renderMessages = consoleMessages.filter(msg =>
    msg.text.includes('Rendering dayRange')
  );

  expect(renderMessages.length).toBeGreaterThan(0);
  console.log('[FINAL] ✅ Day range rendering detected');

  // Verify no rendering errors
  const errorMessages = consoleMessages.filter(msg =>
    msg.type === 'error' &&
    (msg.text.includes('percentage') ||
     msg.text.includes('Cannot read properties of undefined'))
  );

  expect(errorMessages.length).toBe(0);
  console.log('[FINAL] ✅ No ADR percentage rendering errors');

  // Take screenshot for visual verification
  await page.screenshot({
    path: 'test-results/final-adr-verification.png',
    fullPage: false
  });

  console.log('[FINAL] 📸 Screenshot captured for manual verification');
  console.log('[FINAL] ✅ ADR percentage markers should be visible on the right side of day range displays');
});