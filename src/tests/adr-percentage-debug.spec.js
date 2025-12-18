/**
 * ADR Percentage Visualization Debug Test
 */

import { test, expect } from '@playwright/test';

test('debug ADR percentage visualization configuration', async ({ page }) => {
  console.log('[DEBUG] Starting ADR percentage visualization test...');

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
  await page.goto('http://localhost:5174');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Check for percentage marker configuration
  const configMessages = consoleMessages.filter(msg =>
    msg.text.includes('percentageMarkers') ||
    msg.text.includes('ADR') ||
    msg.text.includes('static') ||
    msg.text.includes('dynamic')
  );

  console.log('[DEBUG] Percentage marker related messages:');
  configMessages.forEach(msg => {
    console.log(`  - ${msg.text}`);
  });

  // Check if there are any errors related to percentage rendering
  const errorMessages = consoleMessages.filter(msg =>
    msg.text.includes('percentageMarkers') && msg.type === 'error'
  );

  expect(errorMessages.length).toBe(0);
  console.log('[DEBUG] ✅ No percentage marker rendering errors');

  // Verify day range is rendering at least
  const renderMessages = consoleMessages.filter(msg =>
    msg.text.includes('Rendering dayRange')
  );

  expect(renderMessages.length).toBeGreaterThan(0);
  console.log(`[DEBUG] ✅ Day range rendering detected (${renderMessages.length} times)`);
});