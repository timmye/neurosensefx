/**
 * Browser Console Log Fixture
 *
 * Pure Playwright-native approach for LLM developer browser visibility.
 * Zero custom infrastructure - just Playwright's built-in event handling.
 */

import { test as base } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    // Console event capture - shows console.log, console.error, etc.
    page.on('console', msg => {
      const type = msg.type().toUpperCase();
      const text = msg.text();
      console.log(`[BROWSER ${type}] ${text}`);
    });

    // Page error capture - shows JavaScript exceptions
    page.on('pageerror', error => {
      console.error(`[BROWSER ERROR] ${error.message}`);
      if (error.stack) {
        console.error(`[BROWSER ERROR STACK] ${error.stack}`);
      }
    });

    // Request logging - shows network activity
    page.on('request', request => {
      console.log(`[BROWSER REQUEST] ${request.method()} ${request.url()}`);
    });

    // Response logging - shows network responses
    page.on('response', response => {
      const status = response.status();
      const statusIcon = status >= 200 && status < 300 ? '✅' : status >= 400 ? '❌' : '⚠️';
      console.log(`[BROWSER RESPONSE] ${statusIcon} ${status} ${response.url()}`);
    });

    await use(page);
  }
});