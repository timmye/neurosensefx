// @ts-check
import { test, expect } from '@playwright/test';

test('debug console errors', async ({ page }) => {
  // Collect all console messages
  /** @type {Array<{type: string, text: string, location: any}>} */
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    });
  });

  // Navigate to the application
  await page.goto('http://localhost:5173');
  
  // Wait for the page to load
  await page.waitForLoadState('networkidle');
  
  // Wait a bit for any async errors to appear
  await page.waitForTimeout(3000);
  
  // Log all console messages
  console.log('=== Console Messages ===');
  consoleMessages.forEach(msg => {
    console.log(`[${msg.type.toUpperCase()}] ${msg.text}`);
    if (msg.location) {
      console.log(`  Location: ${msg.location.url}:${msg.location.lineNumber}`);
    }
  });
  
  // Check for errors
  const errors = consoleMessages.filter(msg => msg.type === 'error');
  const warnings = consoleMessages.filter(msg => msg.type === 'warning');
  
  console.log(`\n=== Summary ===`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);
  
  if (errors.length > 0) {
    console.log('\n=== Errors ===');
    errors.forEach(error => {
      console.log(`ERROR: ${error.text}`);
      if (error.location) {
        console.log(`  Location: ${error.location.url}:${error.location.lineNumber}`);
      }
    });
  }
  
  if (warnings.length > 0) {
    console.log('\n=== Warnings ===');
    warnings.forEach(warning => {
      console.log(`WARNING: ${warning.text}`);
      if (warning.location) {
        console.log(`  Location: ${warning.location.url}:${warning.location.lineNumber}`);
      }
    });
  }
  
  // Take a screenshot for visual reference
  await page.screenshot({ path: 'debug-screenshot.png', fullPage: true });
  
  // Check if basic page elements are present
  const mainContainer = page.locator('.main-container');
  const workspaceContainer = page.locator('.workspace-container');
  const welcomeMessage = page.locator('text=Welcome to NeuroSense FX');
  
  console.log('\n=== Page Elements ===');
  console.log(`Main container present: ${await mainContainer.count() > 0}`);
  console.log(`Workspace container present: ${await workspaceContainer.count() > 0}`);
  console.log(`Welcome message present: ${await welcomeMessage.count() > 0}`);
  
  // This test will always pass but provides detailed debugging information
  expect(true).toBe(true);
});