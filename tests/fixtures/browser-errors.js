import { test as base } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    // Only capture JavaScript errors
    page.on('pageerror', error => {
      console.error(`[BROWSER ERROR] ${error.message}`);
      if (error.stack) {
        console.error(`[BROWSER ERROR STACK] ${error.stack}`);
      }
    });

    // Only capture console errors/warnings
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.error(`[BROWSER ${msg.type().toUpperCase()}] ${msg.text()}`);
      }
    });

    await use(page);
  }
});