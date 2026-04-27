// Integration tests for optimistic locking on PUT /api/drawings.
// These require a running backend with PostgreSQL and Redis on port 3001.
// They are skipped by default — run with `npx vitest run --no-skip` when the backend is up.

const { describe, it, expect, beforeAll, afterAll } = require('vitest');

const BASE_URL = 'http://localhost:3001';

describe.skip('PUT /api/drawings optimistic locking', () => {
  let cookie;

  beforeAll(async () => {
    // Login to get a session cookie
    const loginResp = await fetch(BASE_URL + '/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'testpass123' }),
    });
    expect(loginResp.ok).toBe(true);
    cookie = loginResp.headers.get('set-cookie');
  });

  afterAll(async () => {
    // Logout to clean up session
    if (cookie) {
      await fetch(BASE_URL + '/api/logout', {
        method: 'POST',
        headers: { Cookie: cookie },
      });
    }
  });

  it('first PUT succeeds and returns version', async () => {
    const putResp = await fetch(BASE_URL + '/api/drawings/EUR/USD/4h', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify([{ overlayId: 'd1', overlayType: 'line' }]),
    });
    expect(putResp.ok).toBe(true);
    const result = await putResp.json();
    expect(result.version).toBeDefined();
    expect(typeof result.version).toBe('number');
    expect(result.version).toBeGreaterThanOrEqual(1);
  });

  it('PUT with correct version succeeds and increments version', async () => {
    // Seed initial version
    const seedResp = await fetch(BASE_URL + '/api/drawings/EUR/USD/4h', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify([{ overlayId: 'd1', overlayType: 'line' }]),
    });
    const seed = await seedResp.json();
    const currentVersion = seed.version;

    // PUT with the version we just got
    const putResp = await fetch(BASE_URL + '/api/drawings/EUR/USD/4h', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-drawings-version': String(currentVersion),
        Cookie: cookie,
      },
      body: JSON.stringify([
        { overlayId: 'd1', overlayType: 'line' },
        { overlayId: 'd2', overlayType: 'fibonacci' },
      ]),
    });
    expect(putResp.ok).toBe(true);
    const result = await putResp.json();
    expect(result.version).toBe(currentVersion + 1);
  });

  it('PUT with stale version returns 409 with current data and version', async () => {
    // Seed and get version
    const seedResp = await fetch(BASE_URL + '/api/drawings/EUR/USD/4h', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify([{ overlayId: 'd1', overlayType: 'line' }]),
    });
    const seed = await seedResp.json();
    const currentVersion = seed.version;

    // Increment to version + 1
    const incResp = await fetch(BASE_URL + '/api/drawings/EUR/USD/4h', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-drawings-version': String(currentVersion),
        Cookie: cookie,
      },
      body: JSON.stringify([{ overlayId: 'd2', overlayType: 'fibonacci' }]),
    });
    expect(incResp.ok).toBe(true);

    // Now send stale version (currentVersion, which is one behind)
    const staleResp = await fetch(BASE_URL + '/api/drawings/EUR/USD/4h', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-drawings-version': String(currentVersion),
        Cookie: cookie,
      },
      body: JSON.stringify([{ overlayId: 'd3', overlayType: 'line' }]),
    });
    expect(staleResp.status).toBe(409);
    const result = await staleResp.json();
    expect(result.error).toBe('VERSION_CONFLICT');
    expect(result.version).toBe(currentVersion + 1);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('GET returns version alongside data', async () => {
    // Seed data
    await fetch(BASE_URL + '/api/drawings/EUR/USD/4h', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify([{ overlayId: 'd1', overlayType: 'line' }]),
    });

    const getResp = await fetch(BASE_URL + '/api/drawings/EUR/USD/4h', {
      headers: { Cookie: cookie },
    });
    const result = await getResp.json();
    expect(result.version).toBeDefined();
    expect(typeof result.version).toBe('number');
  });

  it('PUT without version header succeeds (backward compatibility)', async () => {
    const putResp = await fetch(BASE_URL + '/api/drawings/EUR/USD/4h', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify([]),
    });
    expect(putResp.ok).toBe(true);
  });
});
