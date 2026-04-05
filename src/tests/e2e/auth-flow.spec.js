/**
 * Authentication Flow E2E Tests
 *
 * Two modes:
 * 1. Mocked API (no backend required) — runs with just the frontend
 * 2. Integration (requires PostgreSQL + Redis + backend on port 8080)
 *
 * Run mocked tests only:
 *   npx playwright test auth-flow -- --grep "mocked API"
 *
 * Run integration tests (requires full backend stack):
 *   npx playwright test auth-flow -- --grep "integration"
 */

import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_USER = {
  id: 'test-user-001',
  email: 'test@example.com',
  displayName: 'Test User',
};

/** JSON response helper for page.route fulfill(). */
function json(status, body) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

/** Set up route mocks for an unauthenticated session (GET /api/me -> 401). */
function mockUnauthenticated(page) {
  page.route('**/api/me', route =>
    route.fulfill(json(401, { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } })),
  );
}

/**
 * Set up route mocks for a login flow where user starts unauthenticated,
 * then logs in. GET /api/me starts as 401, login returns success,
 * subsequent /api/me calls return 200.
 */
function mockLoginFlow(page, user = MOCK_USER) {
  let meCallCount = 0;
  page.route('**/api/me', route => {
    meCallCount++;
    if (meCallCount === 1) {
      // Initial checkSession — not authenticated yet
      route.fulfill(json(401, { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }));
    } else {
      // After login — authenticated
      route.fulfill(json(200, { user }));
    }
  });
  page.route('**/api/login', route =>
    route.fulfill(json(200, { user })),
  );
  // Mock migration and persistence endpoints so post-login syncs don't fail
  page.route('**/api/migrate', route =>
    route.fulfill(json(200, { success: true })),
  );
  page.route('**/api/workspace', route =>
    route.fulfill(json(200, { layout: null })),
  );
  page.route('**/api/drawings/**', route =>
    route.fulfill(json(200, { data: null })),
  );
  page.route('**/api/markers/**', route =>
    route.fulfill(json(200, { data: null })),
  );
}

/** Set up route mocks for a failed login (401). */
function mockLoginFailure(page, message = 'Invalid email or password') {
  mockUnauthenticated(page);
  page.route('**/api/login', route =>
    route.fulfill(json(401, { error: { code: 'UNAUTHORIZED', message } })),
  );
}

/**
 * Set up route mocks for a registration flow where user starts unauthenticated,
 * then registers. Same pattern as mockLoginFlow.
 */
function mockRegisterFlow(page, user = MOCK_USER) {
  let meCallCount = 0;
  page.route('**/api/me', route => {
    meCallCount++;
    if (meCallCount === 1) {
      route.fulfill(json(401, { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }));
    } else {
      route.fulfill(json(200, { user }));
    }
  });
  page.route('**/api/register', route =>
    route.fulfill(json(200, { user })),
  );
  // Mock post-registration syncs
  page.route('**/api/migrate', route =>
    route.fulfill(json(200, { success: true })),
  );
  page.route('**/api/workspace', route =>
    route.fulfill(json(200, { layout: null })),
  );
  page.route('**/api/drawings/**', route =>
    route.fulfill(json(200, { data: null })),
  );
  page.route('**/api/markers/**', route =>
    route.fulfill(json(200, { data: null })),
  );
}

/** Set up route mocks for a duplicate-email registration (409). */
function mockRegisterDuplicate(page) {
  mockUnauthenticated(page);
  page.route('**/api/register', route =>
    route.fulfill(json(409, { error: { code: 'EMAIL_EXISTS', message: 'Email already registered' } })),
  );
}

// ---------------------------------------------------------------------------
// 1. Mocked API Tests
// ---------------------------------------------------------------------------

test.describe('Auth Flow (mocked API)', () => {
  test.setTimeout(30000);

  test('shows login form when not authenticated', async ({ page }) => {
    mockUnauthenticated(page);

    await page.goto('/');
    await page.waitForSelector('.login-container');

    // Login form should be visible
    await expect(page.locator('.login-container')).toBeVisible();
    await expect(page.locator('.login-card')).toBeVisible();
    await expect(page.locator('.login-card h1')).toHaveText('NeuroSense FX');
  });

  test('shows loading state initially, then resolves to login form', async ({ page }) => {
    // Defer the /api/me response to observe the loading state
    let resolveMe;
    page.route('**/api/me', route => {
      resolveMe = route;
      // Don't fulfill yet — loading spinner should be visible
    });

    await page.goto('/');

    // Loading state should be visible while /api/me is pending
    await expect(page.locator('.loading')).toBeVisible();

    // Now fulfill the 401 response
    await resolveMe.fulfill(json(401, { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }));

    // Loading disappears, login form appears
    await expect(page.locator('.loading')).not.toBeVisible();
    await expect(page.locator('.login-container')).toBeVisible();
  });

  test('successful login transitions to workspace', async ({ page }) => {
    mockLoginFlow(page);

    await page.goto('/');
    await page.waitForSelector('.login-container');

    // Fill and submit login
    await page.fill('input[type="email"]', MOCK_USER.email);
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Login form should disappear, workspace should appear
    await expect(page.locator('.login-container')).not.toBeVisible({ timeout: 10000 });
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    mockLoginFailure(page, 'Invalid email or password');

    await page.goto('/');
    await page.waitForSelector('.login-container');

    await page.fill('input[type="email"]', 'bad@example.com');
    await page.fill('input[type="password"]', 'wrongpass');
    await page.click('button[type="submit"]');

    // Error message should be displayed
    const errorEl = page.locator('.error');
    await expect(errorEl).toBeVisible();
    await expect(errorEl).toContainText('Invalid email or password');
  });

  test('login validation: empty email shows error', async ({ page }) => {
    mockUnauthenticated(page);

    await page.goto('/');
    await page.waitForSelector('.login-container');

    // Disable native HTML5 validation so handleSubmit() runs and sets localError
    await page.locator('form').evaluate(el => el.noValidate = true);

    // Fill only password, leave email empty
    await page.fill('input[type="password"]', 'password123');
    await page.locator('input[type="password"]').press('Enter');

    const errorEl = page.locator('.error');
    await expect(errorEl).toBeVisible();
    await expect(errorEl).toContainText('Email is required');
  });

  test('login validation: short password shows error', async ({ page }) => {
    mockUnauthenticated(page);

    await page.goto('/');
    await page.waitForSelector('.login-container');

    // Disable native HTML5 validation so handleSubmit() runs and sets localError
    await page.locator('form').evaluate(el => el.noValidate = true);

    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'short');
    await page.locator('input[type="password"]').press('Enter');

    const errorEl = page.locator('.error');
    await expect(errorEl).toBeVisible();
    await expect(errorEl).toContainText('Password must be at least 8 characters');
  });

  test('tab switching between Login and Register', async ({ page }) => {
    mockUnauthenticated(page);

    await page.goto('/');
    await page.waitForSelector('.login-container');

    // Initially on login tab — no display name field
    await expect(page.locator('.tabs button.active')).toHaveText('Login');
    await expect(page.locator('input[type="text"]')).toHaveCount(0);

    // Switch to register tab
    await page.locator('.tabs button').getByText('Register').click();
    await expect(page.locator('.tabs button.active')).toHaveText('Register');
    // Display name field should now be visible
    await expect(page.locator('input[type="text"]')).toBeVisible();

    // Switch back to login tab
    await page.locator('.tabs button').getByText('Login').click();
    await expect(page.locator('.tabs button.active')).toHaveText('Login');
    await expect(page.locator('input[type="text"]')).toHaveCount(0);
  });

  test('successful register transitions to workspace', async ({ page }) => {
    mockRegisterFlow(page);

    await page.goto('/');
    await page.waitForSelector('.login-container');

    // Switch to register tab
    await page.locator('.tabs button').getByText('Register').click();
    await expect(page.locator('.tabs button.active')).toHaveText('Register');

    await page.fill('input[type="email"]', MOCK_USER.email);
    await page.fill('input[type="password"]', 'password123');
    await page.fill('input[type="text"]', MOCK_USER.displayName);
    await page.click('button[type="submit"]');

    // Workspace should appear
    await expect(page.locator('.login-container')).not.toBeVisible({ timeout: 10000 });
  });

  test('register with existing email shows error', async ({ page }) => {
    mockRegisterDuplicate(page);

    await page.goto('/');
    await page.waitForSelector('.login-container');

    // Switch to register tab
    await page.locator('.tabs button').getByText('Register').click();

    await page.fill('input[type="email"]', 'taken@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.fill('input[type="text"]', 'Duplicate User');
    await page.click('button[type="submit"]');

    const errorEl = page.locator('.error');
    await expect(errorEl).toBeVisible();
    await expect(errorEl).toContainText('Email already registered');
  });

  test('logout returns to login form', async ({ page }) => {
    // Phase 1: First /api/me call returns authenticated user; after reload it returns 401
    let meCallCount = 0;
    page.route('**/api/me', route => {
      meCallCount++;
      if (meCallCount === 1) {
        route.fulfill(json(200, { user: MOCK_USER }));
      } else {
        route.fulfill(json(401, { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }));
      }
    });
    page.route('**/api/logout', route =>
      route.fulfill(json(200, { success: true })),
    );
    // Mock persistence endpoints so workspace loading doesn't fail
    page.route('**/api/workspace', route =>
      route.fulfill(json(200, { layout: null })),
    );
    page.route('**/api/drawings/**', route =>
      route.fulfill(json(200, { data: null })),
    );
    page.route('**/api/markers/**', route =>
      route.fulfill(json(200, { data: null })),
    );

    // Phase 2: Load the app — should see workspace (authenticated)
    await page.goto('/');

    // Wait for workspace to load (authenticated state)
    await page.waitForTimeout(2000);
    // Login container should NOT be visible
    await expect(page.locator('.login-container')).not.toBeVisible();

    // Phase 3: Call the logout API directly, then reload.
    await page.evaluate(async () => {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    });
    await page.reload({ waitUntil: 'commit' });

    // After reload, /api/me returns 401, so login form should appear
    await page.waitForSelector('.login-container');
    await expect(page.locator('.login-container')).toBeVisible();
  });

  test('network error during login shows generic error', async ({ page }) => {
    // Mock /api/me to succeed (to get past loading), then mock /api/login to fail with a network error
    mockUnauthenticated(page);
    page.route('**/api/login', route =>
      route.abort(),
    );

    await page.goto('/');
    await page.waitForSelector('.login-container');

    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    const errorEl = page.locator('.error');
    await expect(errorEl).toBeVisible();
    await expect(errorEl).toContainText('Network error');
  });

  test('loading state shows loading spinner during login submission', async ({ page }) => {
    // Defer the login response to observe the loading state
    let resolveLogin;
    mockUnauthenticated(page);
    page.route('**/api/login', route => {
      resolveLogin = route;
    });

    await page.goto('/');
    await page.waitForSelector('.login-container');

    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // When login() sets isLoading=true, App.svelte replaces LoginForm with loading screen
    await expect(page.locator('.loading')).toBeVisible();
    await expect(page.locator('.loading')).toHaveText('Loading...');
    // Login form should be gone
    await expect(page.locator('.login-container')).not.toBeVisible();

    // Now fulfill the login response
    await resolveLogin.fulfill(json(200, { user: MOCK_USER }));
    // Update /api/me to return authenticated for any subsequent calls
    page.route('**/api/me', route =>
      route.fulfill(json(200, { user: MOCK_USER })),
    );
    // Mock post-login endpoints
    page.route('**/api/migrate', route =>
      route.fulfill(json(200, { success: true })),
    );
    page.route('**/api/workspace', route =>
      route.fulfill(json(200, { layout: null })),
    );
    page.route('**/api/drawings/**', route =>
      route.fulfill(json(200, { data: null })),
    );
    page.route('**/api/markers/**', route =>
      route.fulfill(json(200, { data: null })),
    );

    // Should transition to workspace (loading gone)
    await expect(page.locator('.loading')).not.toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// 2. Integration Tests (requires backend)
// ---------------------------------------------------------------------------

test.describe('Auth Flow (integration, requires backend)', () => {
  test.setTimeout(60000);

  let backendAvailable = false;

  test.beforeAll(async () => {
    try {
      const res = await fetch('http://localhost:8080/api/me', { signal: AbortSignal.timeout(5000) });
      backendAvailable = true;
    } catch {
      backendAvailable = false;
    }
  });

  test.beforeEach(async ({ page }, testInfo) => {
    test.slow();
    if (!backendAvailable) {
      testInfo.skip(true, 'Backend not available - skipping integration tests');
    }
  });

  const TEST_EMAIL = `e2e-test-${Date.now()}@example.com`;
  const TEST_PASSWORD = 'testpass123';
  const TEST_DISPLAY_NAME = 'E2E Test User';

  test('full registration flow', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.login-container');

    // Switch to register tab
    await page.locator('.tabs button').getByText('Register').click();
    await expect(page.locator('.tabs button.active')).toHaveText('Register');

    // Fill registration form
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.fill('input[type="text"]', TEST_DISPLAY_NAME);
    await page.click('button[type="submit"]');

    // Should transition to workspace
    await expect(page.locator('.login-container')).not.toBeVisible({ timeout: 15000 });
  });

  test('full login flow', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.login-container');

    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    await expect(page.locator('.login-container')).not.toBeVisible({ timeout: 15000 });
  });

  test('session persistence across reload', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.login-container');

    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for workspace to appear and session cookie to be stored
    await expect(page.locator('.login-container')).not.toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);

    // Reload the page — session cookie should persist
    await page.reload({ waitUntil: 'commit' });
    await page.waitForTimeout(3000);
    // Login form should not appear (still authenticated)
    await expect(page.locator('.login-container')).not.toBeVisible();
  });

  test('logout returns to login form', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.login-container');

    // Login first
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page.locator('.login-container')).not.toBeVisible({ timeout: 15000 });
    // Wait for session cookie to be stored before logout
    await page.waitForTimeout(1000);

    // Logout via API call and reload (logout() does window.location.reload())
    await page.evaluate(async () => {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    });
    await page.reload({ waitUntil: 'commit' });

    // Should be back at login form
    await page.waitForSelector('.login-container');
    await expect(page.locator('.login-container')).toBeVisible();
  });

  test('invalid credentials shows error', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.login-container');

    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', 'completely-wrong-password');
    await page.click('button[type="submit"]');

    const errorEl = page.locator('.error');
    await expect(errorEl).toBeVisible({ timeout: 10000 });
  });

  test('duplicate registration shows error', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.login-container');

    // Switch to register tab
    await page.locator('.tabs button').getByText('Register').click();

    // Try to register with the same email used above
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', 'anotherpass123');
    await page.fill('input[type="text"]', 'Duplicate User');
    await page.click('button[type="submit"]');

    // Wait for error to appear (backend returns 409, frontend sets error in store)
    const errorEl = page.locator('.error');
    await expect(errorEl).toBeVisible({ timeout: 15000 });
    await expect(errorEl).toContainText('already exists');
  });
});
