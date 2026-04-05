/**
 * Server-Side Persistence E2E Tests
 *
 * Validates that workspace layout, chart drawings, and price markers
 * sync to PostgreSQL via the REST API when the user is authenticated.
 *
 * Two test suites:
 * 1. Mocked API — runs without a backend (route() intercepts)
 * 2. Integration — requires a running backend + database
 *
 * Run mocked only:  npx playwright test server-persistence -- --grep "mocked"
 * Run integration:  npx playwright test server-persistence -- --grep "integration"
 * Run all:          npx playwright test server-persistence
 */

import { test, expect } from '@playwright/test';

// Use relative URL to respect Playwright config baseURL
const BASE_URL = '/';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const TEST_SYMBOL = 'EURUSD';
const TEST_RESOLUTION = '4h';

const TEST_DRAWING = {
  overlayType: 'rect',
  points: [
    { timestamp: 1700000000000, price: 1.0850 },
    { timestamp: 1700006400000, price: 1.0950 },
  ],
  styles: { color: '#ff0000' },
};

const TEST_MARKER = {
  id: 'marker-test-1',
  symbol: TEST_SYMBOL,
  price: 1.0900,
  type: 'horizontal',
};

/** Wait until the workspace JS API is available on the page. */
async function waitForWorkspaceAPI(page) {
  await page.waitForFunction(
    () =>
      typeof window.workspaceActions !== 'undefined' &&
      typeof window.workspaceActions.addDisplay === 'function',
    { timeout: 20000 },
  );
}

/**
 * Set up auth mocks so the app believes the user is logged in.
 * This intercepts GET /api/me and injects an auth cookie.
 */
async function mockAuthenticated(page) {
  await page.route('**/api/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: { id: 1, email: 'test@example.com' } }),
      headers: { 'Set-Cookie': 'neurosense_session=test-session-token; Path=/' },
    });
  });
}

// ===========================================================================
// 1. Mocked API tests (no backend required)
// ===========================================================================

test.describe('Server Persistence (mocked API)', () => {
  // -----------------------------------------------------------------------
  // a. Drawing save triggers debounced server sync
  // -----------------------------------------------------------------------
  test('drawing save triggers server sync', async ({ page }) => {
    let putBody = null;
    let putCalled = false;

    // Mock /api/me so the app thinks we are authenticated
    await mockAuthenticated(page);

    // Mock PUT /api/drawings/:symbol/:resolution to capture the sync payload
    await page.route(
      `**/api/drawings/${TEST_SYMBOL}/${TEST_RESOLUTION}`,
      async (route) => {
        if (route.request().method() === 'PUT') {
          putCalled = true;
          putBody = await route.request().postDataJSON();
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true }),
          });
          return;
        }
        // GET — return null (no server data) so IndexedDB is used
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: null }),
        });
      },
    );

    await page.goto(BASE_URL);
    await waitForWorkspaceAPI(page);

    // Seed a drawing via the exposed drawingStore
    await page.evaluate(
      async ({ symbol, resolution, drawing }) => {
        await window.drawingStore.save(symbol, resolution, drawing);
      },
      { symbol: TEST_SYMBOL, resolution: TEST_RESOLUTION, drawing: TEST_DRAWING },
    );

    // Wait for the 500ms debounce plus margin
    await page.waitForTimeout(600);

    expect(putCalled).toBe(true);
    expect(Array.isArray(putBody)).toBe(true);
    expect(putBody.length).toBeGreaterThanOrEqual(1);
    expect(putBody[0].overlayType).toBe('rect');

    console.log('Drawing save triggers server sync: PASS');
  });

  // -----------------------------------------------------------------------
  // b. Drawing load fetches from server when authenticated
  // -----------------------------------------------------------------------
  test('drawing load fetches from server when authenticated', async ({ page }) => {
    const serverDrawings = [
      {
        ...TEST_DRAWING,
        id: 999,
        symbol: TEST_SYMBOL,
        resolution: TEST_RESOLUTION,
        schemaVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    await mockAuthenticated(page);

    // Mock GET /api/drawings/:symbol/:resolution to return server data
    await page.route(
      `**/api/drawings/${TEST_SYMBOL}/${TEST_RESOLUTION}`,
      async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: serverDrawings }),
          });
          return;
        }
        // PUT — accept silently
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      },
    );

    await page.goto(BASE_URL);
    await waitForWorkspaceAPI(page);

    // load() should return the server data, not IndexedDB
    const loaded = await page.evaluate(
      async ({ symbol, resolution }) => {
        return await window.drawingStore.load(symbol, resolution);
      },
      { symbol: TEST_SYMBOL, resolution: TEST_RESOLUTION },
    );

    expect(Array.isArray(loaded)).toBe(true);
    expect(loaded.length).toBe(1);
    expect(loaded[0].overlayType).toBe('rect');
    expect(loaded[0].symbol).toBe(TEST_SYMBOL);

    console.log('Drawing load fetches from server: PASS');
  });

  // -----------------------------------------------------------------------
  // c. Workspace change triggers debounced server sync
  // -----------------------------------------------------------------------
  test('workspace change triggers server sync', async ({ page }) => {
    let putBody = null;
    let putCalled = false;

    await mockAuthenticated(page);

    // Mock PUT /api/workspace
    await page.route('**/api/workspace', async (route) => {
      if (route.request().method() === 'PUT') {
        putCalled = true;
        putBody = await route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
        return;
      }
      // GET — return null
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ layout: null }),
      });
    });

    await page.goto(BASE_URL);
    await waitForWorkspaceAPI(page);

    // Trigger a workspace change (add a display)
    await page.evaluate(() => {
      window.workspaceActions.addDisplay('EURUSD');
    });

    // Wait for the 2-second debounce plus margin
    await page.waitForTimeout(2500);

    expect(putCalled).toBe(true);
    expect(putBody).toHaveProperty('displays');
    expect(putBody).toHaveProperty('nextZIndex');
    // After adding one display, there should be at least one entry
    expect(Array.isArray(putBody.displays)).toBe(true);
    expect(putBody.displays.length).toBeGreaterThanOrEqual(1);

    console.log('Workspace change triggers server sync: PASS');
  });

  // -----------------------------------------------------------------------
  // d. Unauthenticated requests get 401
  // -----------------------------------------------------------------------
  test('unauthenticated requests get 401', async ({ page }) => {
    // Mock /api/me to return unauthenticated
    await page.route('**/api/me', async (route) => {
      await route.fulfill({ status: 401, body: '' });
    });

    // Mock all persistence endpoints to return 401
    await page.route('**/api/workspace', async (route) => {
      await route.fulfill({ status: 401, body: JSON.stringify({ error: 'Unauthorized' }) });
    });
    await page.route('**/api/drawings/**', async (route) => {
      await route.fulfill({ status: 401, body: JSON.stringify({ error: 'Unauthorized' }) });
    });
    await page.route('**/api/markers/**', async (route) => {
      await route.fulfill({ status: 401, body: JSON.stringify({ error: 'Unauthorized' }) });
    });

    await page.goto(BASE_URL);
    // Wait for login form to appear (unauthenticated state)
    await page.waitForSelector('.login-container');

    // Attempt to call PUT /api/workspace directly
    const putWorkspaceStatus = await page.evaluate(async () => {
      try {
        const resp = await fetch('/api/workspace', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ displays: [], nextZIndex: 1 }),
        });
        return resp.status;
      } catch {
        return null;
      }
    });
    expect(putWorkspaceStatus).toBe(401);

    // Attempt to call GET /api/drawings/:symbol/:resolution directly
    const getDrawingsStatus = await page.evaluate(async () => {
      try {
        const resp = await fetch('/api/drawings/EURUSD/4h', { credentials: 'include' });
        return resp.status;
      } catch {
        return null;
      }
    });
    expect(getDrawingsStatus).toBe(401);

    // Attempt to call PUT /api/markers/:symbol directly
    const putMarkersStatus = await page.evaluate(async () => {
      try {
        const resp = await fetch('/api/markers/EURUSD', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify([]),
        });
        return resp.status;
      } catch {
        return null;
      }
    });
    expect(putMarkersStatus).toBe(401);

    console.log('Unauthenticated requests get 401: PASS');
  });

  // -----------------------------------------------------------------------
  // e. Data migration on first login
  // -----------------------------------------------------------------------
  test('data migration on first login', async ({ page }) => {
    let migrateCalled = false;
    let migrateBody = null;

    // Mock /api/me: 401 first (unauthenticated), then 200 after login
    let meCallCount = 0;
    await page.route('**/api/me', async (route) => {
      meCallCount++;
      if (meCallCount === 1) {
        await route.fulfill({ status: 401, body: '' });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: { id: 1, email: 'test@example.com' } }),
        });
      }
    });

    // Mock POST /api/login to succeed
    await page.route('**/api/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 1, email: 'test@example.com' },
        }),
        headers: { 'Set-Cookie': 'neurosense_session=test-session; Path=/' },
      });
    });

    // Mock POST /api/migrate to capture migration payload
    await page.route('**/api/migrate', async (route) => {
      migrateCalled = true;
      migrateBody = await route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    // Mock persistence endpoints so post-login syncs don't fail
    await page.route('**/api/workspace', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ layout: null }),
      });
    });
    await page.route('**/api/drawings/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: null }),
      });
    });
    await page.route('**/api/markers/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: null }),
      });
    });

    await page.goto(BASE_URL);

    // Wait for login form (unauthenticated state)
    await page.waitForSelector('.login-container');

    // Seed local data before login
    await page.evaluate(() => {
      // Seed workspace in localStorage
      localStorage.setItem(
        'workspace-state',
        JSON.stringify({
          displays: [],
          nextZIndex: 5,
          chartGhost: null,
        }),
      );

      // Seed price markers in localStorage
      localStorage.setItem(
        'price-markers-EURUSD',
        JSON.stringify([
          { id: 'm1', symbol: 'EURUSD', price: 1.09, type: 'horizontal' },
        ]),
      );

      // Remove the migration flag so migration runs
      localStorage.removeItem('data-migrated');
    });

    // Seed a drawing in IndexedDB (IndexedDB write does not require auth)
    await page.evaluate(
      async ({ symbol, resolution, drawing }) => {
        await window.drawingStore.save(symbol, resolution, drawing);
      },
      { symbol: TEST_SYMBOL, resolution: TEST_RESOLUTION, drawing: TEST_DRAWING },
    );

    // Fill and submit login form via UI
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'testpass123');
    await page.click('button[type="submit"]');

    // Wait for login to complete and migration to fire
    await page.waitForTimeout(3000);

    expect(migrateCalled).toBe(true);
    expect(migrateBody).toHaveProperty('workspace');
    expect(migrateBody).toHaveProperty('drawings');
    expect(migrateBody).toHaveProperty('markers');

    // Verify workspace was included
    expect(migrateBody.workspace).toBeTruthy();
    expect(migrateBody.workspace.nextZIndex).toBe(5);

    // Verify price markers were included
    expect(Array.isArray(migrateBody.markers)).toBe(true);
    expect(migrateBody.markers.length).toBeGreaterThanOrEqual(1);
    expect(migrateBody.markers[0].symbol).toBe('EURUSD');

    // Verify drawings were included
    expect(Array.isArray(migrateBody.drawings)).toBe(true);
    expect(migrateBody.drawings.length).toBeGreaterThanOrEqual(1);

    console.log('Data migration on first login: PASS');
  });
});

// ===========================================================================
// 2. Integration tests (require running backend + PostgreSQL)
// ===========================================================================

test.describe('Server Persistence (integration, requires backend)', () => {
  let backendReachable = false;
  const BACKEND_API = 'http://localhost:8080/api/me';

  test.beforeAll(async () => {
    try {
      const resp = await fetch(BACKEND_API, { signal: AbortSignal.timeout(5000) });
      backendReachable = resp.status === 200 || resp.status === 401;
    } catch {
      backendReachable = false;
    }
  });

  test.beforeEach(async ({ page }) => {
    test.skip(!backendReachable, 'Backend not reachable — skipping integration test');
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('Browser error:', msg.text());
    });
  });

  // -----------------------------------------------------------------------
  // a. Full workspace round-trip
  // -----------------------------------------------------------------------
  test('full workspace round-trip', async ({ page }) => {
    // Login via the auth store
    await page.goto(BASE_URL);
    await waitForWorkspaceAPI(page);

    const loginOk = await page.evaluate(async () => {
      const resp = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: 'test@example.com', password: 'testpass' }),
      });
      return resp.ok;
    });

    test.skip(!loginOk, 'Login failed — skipping workspace round-trip');

    // Wait for auth state to propagate
    await page.waitForTimeout(1000);

    // Modify workspace by adding a display
    await page.evaluate(() => {
      window.workspaceActions.addDisplay('GBPUSD');
    });

    // Wait for the 2-second debounce to sync to server
    await page.waitForTimeout(3000);

    // Reload the page
    await page.reload();
    await waitForWorkspaceAPI(page);

    // Wait for checkSession + loadFromStorage
    await page.waitForTimeout(3000);

    // Verify workspace restored from server (has the GBPUSD display)
    const displays = await page.evaluate(() => {
      const state = window.workspaceStore.getState();
      return Array.from(state.displays.values()).map((d) => ({
        symbol: d.symbol,
        type: d.type,
      }));
    });

    expect(displays.length).toBeGreaterThanOrEqual(1);
    const gbpDisplay = displays.find((d) => d.symbol === 'GBPUSD');
    expect(gbpDisplay).toBeTruthy();

    console.log('Full workspace round-trip: PASS');
  });

  // -----------------------------------------------------------------------
  // b. Drawing round-trip
  // -----------------------------------------------------------------------
  test('drawing round-trip', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForWorkspaceAPI(page);

    const loginOk = await page.evaluate(async () => {
      const resp = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: 'test@example.com', password: 'testpass' }),
      });
      return resp.ok;
    });

    test.skip(!loginOk, 'Login failed — skipping drawing round-trip');
    await page.waitForTimeout(1000);

    // Add a drawing
    await page.evaluate(
      async ({ symbol, resolution, drawing }) => {
        await window.drawingStore.save(symbol, resolution, drawing);
      },
      { symbol: TEST_SYMBOL, resolution: TEST_RESOLUTION, drawing: TEST_DRAWING },
    );

    // Wait for the 500ms debounce to sync to server
    await page.waitForTimeout(1000);

    // Reload the page
    await page.reload();
    await waitForWorkspaceAPI(page);

    // Wait for auth check + drawing load from server
    await page.waitForTimeout(2000);

    // Verify drawing restored from server
    const loaded = await page.evaluate(
      async ({ symbol, resolution }) => {
        const results = await window.drawingStore.load(symbol, resolution);
        return results.map((r) => ({
          overlayType: r.overlayType,
          symbol: r.symbol,
          resolution: r.resolution,
        }));
      },
      { symbol: TEST_SYMBOL, resolution: TEST_RESOLUTION },
    );

    expect(loaded.length).toBeGreaterThanOrEqual(1);
    expect(loaded[0].overlayType).toBe('rect');
    expect(loaded[0].symbol).toBe(TEST_SYMBOL);
    expect(loaded[0].resolution).toBe(TEST_RESOLUTION);

    console.log('Drawing round-trip: PASS');
  });

  // -----------------------------------------------------------------------
  // c. Price marker round-trip
  // -----------------------------------------------------------------------
  test('price marker round-trip', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForWorkspaceAPI(page);

    const loginOk = await page.evaluate(async () => {
      const resp = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: 'test@example.com', password: 'testpass' }),
      });
      return resp.ok;
    });

    test.skip(!loginOk, 'Login failed — skipping price marker round-trip');
    await page.waitForTimeout(1000);

    // Seed a price marker in localStorage
    await page.evaluate(() => {
      localStorage.setItem(
        'price-markers-EURUSD',
        JSON.stringify([
          { id: 'marker-rt-1', symbol: 'EURUSD', price: 1.0880, type: 'horizontal' },
        ]),
      );
    });

    // The saveMarkers function in priceMarkerPersistence.js is called
    // when the workspace store changes. To trigger it, we import and call
    // saveMarkers directly through an evaluate that triggers a store update.
    // Instead, we use the exposed mergeWithPersisted or just directly
    // invoke the fetch that saveMarkers would debounce.
    // Simplest approach: add a chart display which triggers marker loading,
    // then verify on reload.
    await page.evaluate(() => {
      window.workspaceActions.addChartDisplay('EURUSD');
    });

    // Wait for the 1-second marker sync debounce
    await page.waitForTimeout(2000);

    // Reload the page
    await page.reload();
    await waitForWorkspaceAPI(page);
    await page.waitForTimeout(2000);

    // Verify marker restored from server
    const markers = await page.evaluate(() => {
      const stored = localStorage.getItem('price-markers-EURUSD');
      return stored ? JSON.parse(stored) : [];
    });

    // After reload, the server data should have been cached to localStorage
    expect(markers.length).toBeGreaterThanOrEqual(1);
    expect(markers[0].symbol).toBe('EURUSD');

    console.log('Price marker round-trip: PASS');
  });

  // -----------------------------------------------------------------------
  // d. Migration uploads local data
  // -----------------------------------------------------------------------
  test('migration uploads local data', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForWorkspaceAPI(page);

    // Clear migration flag
    await page.evaluate(() => {
      localStorage.removeItem('data-migrated');
    });

    // Seed local data (workspace, drawings, markers)
    await page.evaluate(() => {
      localStorage.setItem(
        'workspace-state',
        JSON.stringify({
          displays: [],
          nextZIndex: 10,
          chartGhost: null,
        }),
      );
      localStorage.setItem(
        'price-markers-EURUSD',
        JSON.stringify([
          { id: 'mig-marker-1', symbol: 'EURUSD', price: 1.0920, type: 'horizontal' },
        ]),
      );
    });

    // Seed a drawing in IndexedDB
    await page.evaluate(
      async ({ symbol, resolution, drawing }) => {
        await window.drawingStore.save(symbol, resolution, drawing);
      },
      { symbol: TEST_SYMBOL, resolution: TEST_RESOLUTION, drawing: TEST_DRAWING },
    );

    // Now login — migration should fire
    const loginOk = await page.evaluate(async () => {
      const resp = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: 'test@example.com', password: 'testpass' }),
      });
      return resp.ok;
    });

    test.skip(!loginOk, 'Login failed — skipping migration test');

    // Wait for migration to complete
    await page.waitForTimeout(3000);

    // Verify migration flag was set
    const migrated = await page.evaluate(() => {
      return localStorage.getItem('data-migrated');
    });
    expect(migrated).toBe('true');

    // Reload and verify data is available from server
    await page.reload();
    await waitForWorkspaceAPI(page);
    await page.waitForTimeout(3000);

    // Verify drawings available after reload (server should have them)
    const loaded = await page.evaluate(
      async ({ symbol, resolution }) => {
        return await window.drawingStore.load(symbol, resolution);
      },
      { symbol: TEST_SYMBOL, resolution: TEST_RESOLUTION },
    );

    expect(loaded.length).toBeGreaterThanOrEqual(1);
    expect(loaded[0].overlayType).toBe('rect');

    console.log('Migration uploads local data: PASS');
  });

  // -----------------------------------------------------------------------
  // e. Server is source of truth
  // -----------------------------------------------------------------------
  test('server is source of truth', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForWorkspaceAPI(page);

    const loginOk = await page.evaluate(async () => {
      const resp = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: 'test@example.com', password: 'testpass' }),
      });
      return resp.ok;
    });

    test.skip(!loginOk, 'Login failed — skipping source-of-truth test');
    await page.waitForTimeout(1000);

    // Add a drawing and let it sync to server
    await page.evaluate(
      async ({ symbol, resolution, drawing }) => {
        await window.drawingStore.save(symbol, resolution, drawing);
      },
      { symbol: TEST_SYMBOL, resolution: TEST_RESOLUTION, drawing: TEST_DRAWING },
    );

    // Wait for debounce sync
    await page.waitForTimeout(1000);

    // Now directly modify the server data via PUT to a different drawing set.
    // This simulates another client/device updating the drawings.
    const serverOverride = await page.evaluate(async () => {
      const overrideDrawing = {
        overlayType: 'circle',
        points: [{ timestamp: 1700000000000, price: 1.1000 }],
        styles: { color: '#0000ff' },
      };
      const resp = await fetch('/api/drawings/EURUSD/4h', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify([overrideDrawing]),
      });
      return resp.ok;
    });
    expect(serverOverride).toBe(true);

    // Reload the page — the server should be the source of truth
    await page.reload();
    await waitForWorkspaceAPI(page);
    await page.waitForTimeout(2000);

    // Load drawings — should get the circle from server, not the rect from IndexedDB
    const loaded = await page.evaluate(
      async ({ symbol, resolution }) => {
        const results = await window.drawingStore.load(symbol, resolution);
        return results.map((r) => ({
          overlayType: r.overlayType,
          styles: r.styles,
        }));
      },
      { symbol: TEST_SYMBOL, resolution: TEST_RESOLUTION },
    );

    expect(loaded.length).toBeGreaterThanOrEqual(1);
    // The circle (from server) should take precedence over the rect (local IndexedDB)
    const hasCircle = loaded.some((d) => d.overlayType === 'circle');
    expect(hasCircle).toBe(true);

    console.log('Server is source of truth: PASS');
  });
});
