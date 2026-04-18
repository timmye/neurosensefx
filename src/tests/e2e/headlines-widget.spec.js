import { test, expect } from '@playwright/test';
import os from 'os';

const BASE_URL = `http://${os.hostname()}:5174`;

const SELECTORS = {
  headlinesWidget: '.floating-display:has(.display-symbol)',
  headlinesHeader: '.display-header:has(.display-symbol)',
  headlinesLabel: '.display-symbol',
  headlinesCloseBtn: '.display-close-btn',
  headlinesContainer: '#financialjuice-news-widget-container',
  workspace: '.workspace',
  loginContainer: '.login-container',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wait until the workspace JS API is available AND the .workspace DOM element
 * exists (confirms Workspace.svelte actually mounted, not just the module-level
 * window.workspaceActions export from workspace.js).
 */
async function waitForWorkspace(page) {
  await page.waitForFunction(() => {
    return typeof window.workspaceActions !== 'undefined' &&
           typeof window.workspaceActions.toggleHeadlines === 'function' &&
           document.querySelector('.workspace') !== null;
  }, { timeout: 30000 });
}

/**
 * Perform real login: if login form is shown, register a new user.
 * Returns after workspace is mounted and ready.
 */
async function ensureAuthenticated(page) {
  await page.goto(BASE_URL);

  // Wait for either workspace or login form to appear
  await Promise.race([
    page.waitForSelector(SELECTORS.workspace, { timeout: 5000 }),
    page.waitForSelector(SELECTORS.loginContainer, { timeout: 5000 }),
  ]).catch(() => {});

  // If already authenticated (workspace visible), we're done
  const workspaceVisible = await page.locator(SELECTORS.workspace).isVisible().catch(() => false);
  if (workspaceVisible) {
    await waitForWorkspace(page);
    return;
  }

  // Login form is shown — register a new user
  const loginVisible = await page.locator(SELECTORS.loginContainer).isVisible().catch(() => false);
  if (loginVisible) {
    const uniqueEmail = `e2e-headlines-${Date.now()}@example.com`;
    const password = 'testpass123';

    // Switch to Register tab
    await page.locator('.tabs button').getByText('Register').click();
    await expect(page.locator('.tabs button.active')).toHaveText('Register');

    // Fill registration form
    await page.fill('input[type="email"]', uniqueEmail);
    await page.fill('input[type="password"]', password);
    await page.fill('input[type="text"]', 'E2E Headlines Test');
    await page.click('button[type="submit"]');

    // Wait for workspace to appear (login container should disappear)
    await expect(page.locator(SELECTORS.loginContainer)).not.toBeVisible({ timeout: 15000 });
  }

  // Ensure workspace is fully ready
  await waitForWorkspace(page);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe.configure({ mode: 'serial' });

test.describe('Headlines Widget - "H" Key Debug', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') console.error('Browser error:', msg.text());
      if (msg.type() === 'warn') console.warn('Browser warn:', msg.text());
    });
    await ensureAuthenticated(page);
  });

  test('1. workspace store exposes toggleHeadlines', async ({ page }) => {
    const hasToggle = await page.evaluate(() => {
      return typeof window.workspaceActions.toggleHeadlines === 'function';
    });

    console.log(`  toggleHeadlines exposed: ${hasToggle}`);
    expect(hasToggle).toBe(true);
  });

  test('2. headlinesVisible starts false', async ({ page }) => {
    const isVisible = await page.evaluate(() => {
      return window.workspaceStore.getState().headlinesVisible;
    });

    console.log(`  headlinesVisible initial: ${isVisible}`);
    expect(isVisible).toBe(false);
  });

  test('3. toggleHeadlines flips store state', async ({ page }) => {
    // Toggle on via store action directly
    const afterFirst = await page.evaluate(() => {
      window.workspaceActions.toggleHeadlines();
      return window.workspaceStore.getState().headlinesVisible;
    });
    console.log(`  after first toggle: ${afterFirst}`);
    expect(afterFirst).toBe(true);

    // Toggle off
    const afterSecond = await page.evaluate(() => {
      window.workspaceActions.toggleHeadlines();
      return window.workspaceStore.getState().headlinesVisible;
    });
    console.log(`  after second toggle: ${afterSecond}`);
    expect(afterSecond).toBe(false);
  });

  test('4. HeadlinesWidget renders when store headlinesVisible is true', async ({ page }) => {
    // Toggle on via store directly
    await page.evaluate(() => window.workspaceActions.toggleHeadlines());

    // Wait for the widget DOM to appear
    try {
      await page.waitForSelector(SELECTORS.headlinesWidget, { timeout: 5000 });
      const headerText = await page.locator(SELECTORS.headlinesLabel).textContent();
      console.log(`  Widget header text: "${headerText}"`);
      expect(headerText.trim()).toBe('HEADLINES');
    } catch (e) {
      // Dump DOM for debugging
      const html = await page.evaluate(() => {
        const ws = document.querySelector('.workspace');
        return ws ? ws.innerHTML.substring(0, 2000) : 'NO .workspace FOUND';
      });
      console.log('  Widget NOT found. workspace innerHTML (first 2000 chars):');
      console.log(html);
      throw e;
    }
  });

  test('5. "h" key triggers toggleHeadlines', async ({ page }) => {
    // Focus the workspace so KeyManager processes the key
    await page.click(SELECTORS.workspace);

    // Press "h"
    await page.keyboard.press('h');
    await page.waitForTimeout(500);

    const isVisible = await page.evaluate(() => {
      return window.workspaceStore.getState().headlinesVisible;
    });
    console.log(`  after "h" press, headlinesVisible: ${isVisible}`);
    expect(isVisible).toBe(true);
  });

  test('6. "h" key toggles widget visibility in DOM', async ({ page }) => {
    // Focus the workspace so KeyManager processes the key
    await page.click(SELECTORS.workspace);

    // Press "h" to open
    await page.keyboard.press('h');
    await page.waitForTimeout(500);

    const storeAfterOpen = await page.evaluate(() => {
      return window.workspaceStore.getState().headlinesVisible;
    });
    console.log(`  after "h" open, headlinesVisible: ${storeAfterOpen}`);
    expect(storeAfterOpen).toBe(true);

    const widgetAfterOpen = page.locator(SELECTORS.headlinesWidget);
    const visibleAfterOpen = await widgetAfterOpen.isVisible().catch(() => false);
    console.log(`  after "h" open, widget visible in DOM: ${visibleAfterOpen}`);
    expect(visibleAfterOpen).toBe(true);

    // Press "h" to close
    await page.keyboard.press('h');
    await page.waitForTimeout(500);

    const storeAfterClose = await page.evaluate(() => {
      return window.workspaceStore.getState().headlinesVisible;
    });
    console.log(`  after "h" close, headlinesVisible: ${storeAfterClose}`);
    expect(storeAfterClose).toBe(false);

    const widgetAfterClose = page.locator(SELECTORS.headlinesWidget);
    const visibleAfterClose = await widgetAfterClose.isVisible().catch(() => false);
    console.log(`  after "h" close, widget visible in DOM: ${visibleAfterClose}`);
    expect(visibleAfterClose).toBe(false);
  });

  test('7. HeadlinesWidget close button works', async ({ page }) => {
    // Focus workspace, then open via "h"
    await page.click(SELECTORS.workspace);
    await page.keyboard.press('h');
    await page.waitForSelector(SELECTORS.headlinesWidget, { timeout: 5000 });

    // Click close button
    await page.locator(SELECTORS.headlinesCloseBtn).click();
    await page.waitForTimeout(500);

    const storeState = await page.evaluate(() => {
      return window.workspaceStore.getState().headlinesVisible;
    });
    console.log(`  after close button click, headlinesVisible: ${storeState}`);
    expect(storeState).toBe(false);
  });

  test('8. FinancialJuice script load diagnostics', async ({ page }) => {
    const consoleErrors = [];
    const consoleWarns = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
      if (msg.type() === 'warn') consoleWarns.push(msg.text());
    });

    // Track script network requests
    const scriptRequests = [];
    page.on('request', req => {
      if (req.url().includes('financialjuice')) {
        scriptRequests.push({ url: req.url(), method: req.method() });
      }
    });
    page.on('response', resp => {
      if (resp.url().includes('financialjuice')) {
        scriptRequests.push({ url: resp.url(), status: resp.status() });
      }
    });

    // Open headlines widget
    await page.evaluate(() => window.workspaceActions.toggleHeadlines());
    await page.waitForTimeout(2000); // Give script time to load

    // Check FJWidgets global
    const hasFJWidgets = await page.evaluate(() => typeof window.FJWidgets !== 'undefined');
    console.log(`  FJWidgets global exists: ${hasFJWidgets}`);

    // Check container
    const containerHTML = await page.evaluate(() => {
      const c = document.getElementById('financialjuice-news-widget-container');
      return c ? c.innerHTML.substring(0, 500) : 'CONTAINER NOT FOUND';
    });
    console.log(`  FJ container innerHTML (first 500): ${containerHTML}`);

    // Log relevant warnings
    const fjWarns = consoleWarns.filter(w => w.includes('HeadlinesWidget') || w.includes('FJWidgets') || w.includes('financialjuice'));
    console.log(`  HeadlinesWidget warnings (${fjWarns.length}):`, fjWarns);

    const fjErrors = consoleErrors.filter(e => e.includes('HeadlinesWidget') || e.includes('FJWidgets') || e.includes('financialjuice'));
    console.log(`  HeadlinesWidget errors (${fjErrors.length}):`, fjErrors);

    console.log(`  Script requests (${scriptRequests.length}):`, scriptRequests);
  });

  test('9. KeyManager "h" registration debug', async ({ page }) => {
    // Simulate keydown and check if it reaches the handler
    const result = await page.evaluate(() => {
      const before = window.workspaceStore.getState().headlinesVisible;

      // Dispatch a synthetic keydown event on document (where KeyManager listens)
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'h', code: 'KeyH', bubbles: true, cancelable: true,
        altKey: false, ctrlKey: false, metaKey: false, shiftKey: false
      }));

      // Small delay for event to process
      return new Promise(resolve => {
        setTimeout(() => {
          const after = window.workspaceStore.getState().headlinesVisible;
          resolve({ before, after, changed: before !== after });
        }, 100);
      });
    });

    console.log(`  before: ${result.before}, after: ${result.after}, changed: ${result.changed}`);
    expect(result.changed).toBe(true);
  });
});
