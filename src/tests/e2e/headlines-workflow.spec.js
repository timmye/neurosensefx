import { test, expect } from '@playwright/test';
import os from 'os';

const BASE_URL = `http://${os.hostname()}:5174`;

const SELECTORS = {
  workspace: '.workspace',
  loginContainer: '.login-container',
  headlinesWidget: '.floating-display:has(.display-symbol)',
  headlinesLabel: '.display-symbol',
  headlinesCloseBtn: '.display-close-btn',
  headlinesHeader: '.display-header:has(.display-symbol)',
  fjContainer: '#financialjuice-news-widget-container',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wait for workspace JS API + DOM mount */
async function waitForWorkspace(page) {
  await page.waitForFunction(() => {
    return typeof window.workspaceActions !== 'undefined' &&
           typeof window.workspaceActions.toggleHeadlines === 'function' &&
           document.querySelector('.workspace') !== null;
  }, { timeout: 30000 });
}

/** Register + login, return email used */
async function registerAndLogin(page) {
  const email = `e2e-workflow-${Date.now()}@example.com`;
  const password = 'WorkflowTest123!';

  await page.goto(BASE_URL);

  // Wait for login form
  await page.waitForSelector(SELECTORS.loginContainer, { timeout: 10000 });
  await expect(page.locator(SELECTORS.loginContainer)).toBeVisible();

  // Switch to Register tab
  await page.locator('.tabs button').getByText('Register').click();
  await expect(page.locator('.tabs button.active')).toHaveText('Register');

  // Fill and submit
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.fill('input[type="text"]', 'Headlines Workflow');
  await page.click('button[type="submit"]');

  // Wait for login form to disappear and workspace to appear
  await expect(page.locator(SELECTORS.loginContainer)).not.toBeVisible({ timeout: 15000 });
  await waitForWorkspace(page);

  console.log(`  [auth] Registered and logged in as: ${email}`);
  return email;
}

/** Toggle headlines on via keyboard and wait for DOM */
async function openHeadlines(page) {
  await page.click(SELECTORS.workspace);
  await page.keyboard.press('h');
  await page.waitForSelector(SELECTORS.headlinesWidget, { timeout: 5000 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe.configure({ mode: 'serial' });

test.describe('Headlines Widget - Full Workflow', () => {
  test.setTimeout(90000);

  let consoleErrors = [];
  let consoleWarnings = [];
  let networkLog = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    consoleWarnings = [];
    networkLog = [];

    // Capture all console output
    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error') {
        consoleErrors.push(text);
        console.error(`  [browser:ERROR] ${text}`);
      }
      if (msg.type() === 'warn') {
        consoleWarnings.push(text);
        console.warn(`  [browser:WARN] ${text}`);
      }
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', err => {
      consoleErrors.push(`PageError: ${err.message}`);
      console.error(`  [page:ERROR] ${err.message}`);
    });

    // Track network requests
    page.on('request', req => {
      networkLog.push({ direction: '>>', url: req.url(), method: req.method() });
    });
    page.on('response', resp => {
      networkLog.push({ direction: '<<', url: resp.url(), status: resp.status() });
    });
  });

  test('1. Login → Workspace → Headlines Toggle → Close → Reopen', async ({ page }) => {
    console.log('\n=== Phase 1: Authentication ===');
    const email = await registerAndLogin(page);
    console.log('  [auth] PASS: Authentication successful');

    // Verify workspace state
    console.log('\n=== Phase 2: Workspace Readiness ===');
    const wsReady = await page.evaluate(() => {
      return typeof window.workspaceActions === 'object' &&
             typeof window.workspaceActions.toggleHeadlines === 'function';
    });
    console.log(`  [workspace] workspaceActions available: ${wsReady}`);
    expect(wsReady).toBe(true);

    const initialState = await page.evaluate(() => {
      return window.workspaceStore.getState().headlinesVisible;
    });
    console.log(`  [workspace] headlinesVisible initial: ${initialState}`);
    expect(initialState).toBe(false);
    console.log('  [workspace] PASS: Workspace ready, headlines hidden');

    // Open headlines with 'H' key
    console.log('\n=== Phase 3: Open Headlines with "H" key ===');
    await openHeadlines(page);

    let storeState = await page.evaluate(() => window.workspaceStore.getState().headlinesVisible);
    console.log(`  [headlines] headlinesVisible after "h": ${storeState}`);
    expect(storeState).toBe(true);

    const headerText = await page.locator(SELECTORS.headlinesLabel).textContent();
    console.log(`  [headlines] Widget header: "${headerText.trim()}"`);
    expect(headerText.trim()).toBe('HEADLINES');

    const widgetVisible = await page.locator(SELECTORS.headlinesWidget).isVisible();
    console.log(`  [headlines] Widget DOM visible: ${widgetVisible}`);
    expect(widgetVisible).toBe(true);
    console.log('  [headlines] PASS: Widget opened via keyboard');

    // Verify close button
    console.log('\n=== Phase 4: Close via close button ===');
    await page.locator(SELECTORS.headlinesCloseBtn).click();
    await page.waitForTimeout(500);

    storeState = await page.evaluate(() => window.workspaceStore.getState().headlinesVisible);
    console.log(`  [headlines] headlinesVisible after close: ${storeState}`);
    expect(storeState).toBe(false);

    const widgetGone = await page.locator(SELECTORS.headlinesWidget).isVisible().catch(() => false);
    console.log(`  [headlines] Widget DOM visible: ${widgetGone}`);
    expect(widgetGone).toBe(false);
    console.log('  [headlines] PASS: Widget closed via button');

    // Reopen with 'H'
    console.log('\n=== Phase 5: Reopen with "H" key ===');
    await openHeadlines(page);

    storeState = await page.evaluate(() => window.workspaceStore.getState().headlinesVisible);
    console.log(`  [headlines] headlinesVisible after reopen: ${storeState}`);
    expect(storeState).toBe(true);

    const reopenVisible = await page.locator(SELECTORS.headlinesWidget).isVisible();
    console.log(`  [headlines] Widget DOM visible: ${reopenVisible}`);
    expect(reopenVisible).toBe(true);
    console.log('  [headlines] PASS: Widget reopened');

    // Toggle off with 'H' again
    console.log('\n=== Phase 6: Toggle off with "H" key ===');
    await page.click(SELECTORS.workspace);
    await page.keyboard.press('h');
    await page.waitForTimeout(500);

    storeState = await page.evaluate(() => window.workspaceStore.getState().headlinesVisible);
    console.log(`  [headlines] headlinesVisible after toggle off: ${storeState}`);
    expect(storeState).toBe(false);
    console.log('  [headlines] PASS: Widget toggled off');
  });

  test('2. Headlines widget renders with correct structure', async ({ page }) => {
    console.log('\n=== Phase: Widget Structure Validation ===');
    await registerAndLogin(page);

    await openHeadlines(page);
    await page.waitForTimeout(2000); // Let FJ script attempt to load

    // Check widget structure
    const structure = await page.evaluate(() => {
      const widget = document.querySelector('.floating-display');
      if (!widget) return { error: 'Widget not found' };

      const header = widget.querySelector('.display-header');
      const symbol = widget.querySelector('.display-symbol');
      const closeBtn = widget.querySelector('.display-close-btn');
      const fjContainer = document.getElementById('financialjuice-news-widget-container');

      return {
        widgetClasses: widget.className,
        hasHeader: !!header,
        headerText: symbol?.textContent?.trim() || null,
        hasCloseButton: !!closeBtn,
        hasFJContainer: !!fjContainer,
        fjContainerHTML: fjContainer ? fjContainer.innerHTML.substring(0, 300) : 'NOT FOUND',
        widgetBounds: {
          width: widget.offsetWidth,
          height: widget.offsetHeight,
        },
      };
    });

    console.log('  [structure] Widget classes:', structure.widgetClasses);
    console.log(`  [structure] Has header: ${structure.hasHeader}, text: "${structure.headerText}"`);
    console.log(`  [structure] Has close button: ${structure.hasCloseButton}`);
    console.log(`  [structure] Has FJ container: ${structure.hasFJContainer}`);
    console.log(`  [structure] FJ container HTML (300 chars): ${structure.fjContainerHTML}`);
    console.log(`  [structure] Widget size: ${structure.widgetBounds.width}x${structure.widgetBounds.height}`);

    expect(structure.hasHeader).toBe(true);
    expect(structure.headerText).toBe('HEADLINES');
    expect(structure.hasCloseButton).toBe(true);
    expect(structure.hasFJContainer).toBe(true);
    expect(structure.widgetBounds.width).toBeGreaterThan(0);
    expect(structure.widgetBounds.height).toBeGreaterThan(0);
    console.log('  [structure] PASS: Widget structure correct');
  });

  test('3. Rapid toggle stress test', async ({ page }) => {
    console.log('\n=== Phase: Rapid Toggle Stress Test ===');
    await registerAndLogin(page);

    console.log('  [stress] Performing 10 rapid H-key toggles...');
    for (let i = 0; i < 10; i++) {
      await page.click(SELECTORS.workspace);
      await page.keyboard.press('h');
      await page.waitForTimeout(100);
    }

    const finalState = await page.evaluate(() => {
      return window.workspaceStore.getState().headlinesVisible;
    });
    // After 10 toggles (even number), should be back to false
    console.log(`  [stress] headlinesVisible after 10 toggles: ${finalState}`);
    expect(finalState).toBe(false);
    console.log('  [stress] PASS: Rapid toggles stable');

    // Check for errors
    const stressErrors = consoleErrors.filter(e =>
      e.includes('Headlines') || e.includes('headlines') || e.includes('FJWidget')
    );
    console.log(`  [stress] Headlines-related errors: ${stressErrors.length}`);
    if (stressErrors.length > 0) {
      console.log('  [stress] Errors:', stressErrors);
    }
    expect(stressErrors).toHaveLength(0);
  });

  test('4. Console error audit - full session', async ({ page }) => {
    console.log('\n=== Phase: Console Error Audit ===');
    await registerAndLogin(page);

    // Open headlines, wait for script load
    await openHeadlines(page);
    await page.waitForTimeout(3000);

    // Close headlines
    await page.locator(SELECTORS.headlinesCloseBtn).click();
    await page.waitForTimeout(500);

    // Reopen
    await openHeadlines(page);
    await page.waitForTimeout(2000);

    // Report
    console.log('\n  --- Console Error Summary ---');
    console.log(`  Total errors captured: ${consoleErrors.length}`);
    console.log(`  Total warnings captured: ${consoleWarnings.length}`);

    // Filter to app-relevant errors (exclude external CDNs, pre-auth 401s, etc.)
    const appErrors = consoleErrors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('404') &&
      !e.includes('net::ERR') &&
      !e.includes('DevTools') &&
      !e.match(/401.*Unauthorized/)
    );

    if (appErrors.length > 0) {
      console.log(`\n  App-relevant errors (${appErrors.length}):`);
      appErrors.forEach((err, i) => console.log(`    ${i + 1}. ${err}`));
    } else {
      console.log('  No app-relevant errors found');
    }

    const fjRequests = networkLog.filter(n =>
      n.url.includes('financialjuice')
    );
    console.log(`\n  FinancialJuice network requests (${fjRequests.length}):`);
    fjRequests.forEach(r => console.log(`    ${r.direction} ${r.method || ''} ${r.url} ${r.status || ''}`));

    // Headlines-specific warnings
    const hlWarnings = consoleWarnings.filter(w =>
      w.includes('Headlines') || w.includes('FJWidget') || w.includes('financialjuice')
    );
    console.log(`\n  Headlines-specific warnings (${hlWarnings.length}):`);
    hlWarnings.forEach((w, i) => console.log(`    ${i + 1}. ${w}`));

    // Assert no critical app errors
    expect(appErrors).toHaveLength(0);
  });
});
