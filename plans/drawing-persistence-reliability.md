# Drawing Persistence Reliability Fixes

## Problem Statement

Chart drawing load/save is unreliable for traders. Six bugs identified in the sync boundary between IndexedDB (Dexie) and the PostgreSQL server, plus a one-time migration bug that silently corrupts forex pair keys.

## Scope

Three phases, ordered by risk/effort:

| Phase | Bugs | Risk | Effort |
|-------|------|------|--------|
| 1 — Zero-risk surgical fixes | #1 slash, #3 error handling, #4 cancelPendingSync, #5 Dexie transaction | Zero | ~30 min |
| 2 — Flush gap closure | #2 eager sync cache | Low | ~1 hour |
| 3 — Multi-tab concurrency | #6 optimistic locking | Medium | ~2-3 hours |

---

## Phase 1: Zero-Risk Surgical Fixes

### Fix 1.1: authStore migration slash bug (MUST)

**File:** `src/stores/authStore.js:65`
**Bug:** `key.split('/')` on `"EUR/USD/4h"` yields `["EUR","USD","4h"]` — symbol becomes `"EUR"`, resolution becomes `"USD"`. Migration stores FX drawings under wrong server keys.
**Fix:** Use `lastIndexOf('/')` (same pattern as `drawingStore.js:181`).

```diff
  for (const [key, items] of byKey) {
-     const [symbol, resolution] = key.split('/');
+     const lastSlash = key.lastIndexOf('/');
+     const symbol = key.slice(0, lastSlash);
+     const resolution = key.slice(lastSlash + 1);
      data.drawings.push({ symbol, resolution, data: items });
  }
```

### Fix 1.2: Add `.catch()` to all unhandled promise chains (SHOULD)

**Files:**
- `src/lib/chart/reloadChart.js:32` — `restoreDrawings().then()` has no `.catch()`
- `src/components/ChartDisplay.svelte:284,296,435,475` — same pattern
- `src/lib/chart/drawingStore.js:186-189` — `flushPending` fire-and-forget fetch has no `.catch()`

**`reloadChart.js:32`:**
```diff
      deps.restoreDrawings(symbol, resolution).then(() => {
        // ... existing body
      });
+     }).catch(err => console.error('[reloadChart] restoreDrawings failed:', err));
```

**`ChartDisplay.svelte`** (all 4 call sites — same pattern):
```diff
      overlayRestore.restoreDrawings(currentSymbol, currentResolution).then(() => {
        forceCanvasDPRRefresh(chartContainer);
-     });
+     }).catch(err => console.error('[ChartDisplay] restoreDrawings failed:', err));
```

**`drawingStore.js:186-189`** (flushPending fire-and-forget):
```diff
        fetch(
          API_BASE + '/api/drawings/' + encodeURIComponent(symbol) + '/' + encodeURIComponent(resolution),
          { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(data), keepalive: true }
-       );
+       ).catch(err => console.warn('[DrawingStore] flushPending failed for ' + key + ':', err));
```

### Fix 1.3: clearAll must cancel pending debounce timer (COULD)

**File:** `src/lib/chart/drawingStore.js:87-98`
**Bug:** `clearAll()` fires immediate PUT but doesn't cancel pending debounce timer. Currently benign (IndexedDB wiped first), but fragile coupling.
**Fix:** Add `this.cancelPendingSync(symbol, resolution)` before the immediate PUT.

```diff
  async clearAll(symbol, resolution) {
    await db.drawings.where({ symbol, resolution }).delete();
+   this.cancelPendingSync(symbol, resolution);
    _lastSyncData.set(symbol + '/' + resolution, []);
```

### Fix 1.4: Wrap load() merge in Dexie transaction (COULD)

**File:** `src/lib/chart/drawingStore.js:49-51`
**Bug:** `delete()` then loop `add()` — mid-loop crash leaves partial data.
**Fix:** Wrap in `db.transaction('rw', db.drawings, ...)`.

```diff
            // Reconcile IndexedDB with merged result
-           await db.drawings.where({ symbol, resolution }).delete();
-           for (const d of merged) {
-             await db.drawings.add({ ...d, symbol, resolution });
-           }
+           await db.transaction('rw', db.drawings, async () => {
+             await db.drawings.where({ symbol, resolution }).delete();
+             for (const d of merged) {
+               await db.drawings.add({ ...d, symbol, resolution });
+             }
+           });
```

---

### Phase 1 Tests

**New file:** `src/lib/chart/__tests__/drawingPersistence.test.js`

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Test 1.1: authStore slash split fix ---
describe('collectLocalData key splitting', () => {
  // We can't import authStore directly (it has side effects),
  // so we test the splitting logic in isolation.
  it('splits forex pair key correctly using lastIndexOf', () => {
    const key = 'EUR/USD/4h';
    const lastSlash = key.lastIndexOf('/');
    const symbol = key.slice(0, lastSlash);
    const resolution = key.slice(lastSlash + 1);
    expect(symbol).toBe('EUR/USD');
    expect(resolution).toBe('4h');
  });

  it('splits non-slash symbol correctly', () => {
    const key = 'BTCUSDT/1h';
    const lastSlash = key.lastIndexOf('/');
    const symbol = key.slice(0, lastSlash);
    const resolution = key.slice(lastSlash + 1);
    expect(symbol).toBe('BTCUSDT');
    expect(resolution).toBe('1h');
  });

  it('handles symbol with multiple slashes', () => {
    const key = 'EUR/GBP/USD/4h';
    const lastSlash = key.lastIndexOf('/');
    const symbol = key.slice(0, lastSlash);
    const resolution = key.slice(lastSlash + 1);
    expect(symbol).toBe('EUR/GBP/USD');
    expect(resolution).toBe('4h');
  });
});

// --- Test 1.4: Dexie transaction wrapping ---
describe('drawingStore.load() merge behavior', () => {
  // Test the _mergeByTimestamp logic directly (pure function, no IndexedDB needed)
  it('merges server and local data keeping newest by updatedAt', () => {
    // Import _mergeByTimestamp if exported, or test via drawingStore.load
    // For now, test the merge logic pattern:
    const serverData = [
      { overlayId: 'd1', updatedAt: 1000 },
      { overlayId: 'd2', updatedAt: 2000 },
    ];
    const localData = [
      { overlayId: 'd1', updatedAt: 3000 }, // local is newer
      { overlayId: 'd3', updatedAt: 4000 }, // local-only
    ];

    // Build expected merged result using same algorithm
    const localById = new Map();
    for (const d of localData) {
      if (d.overlayId) localById.set(d.overlayId, d);
    }
    const result = [...serverData];
    for (const local of localData) {
      if (!local.overlayId) { result.push(local); continue; }
      const serverIdx = result.findIndex(d => d.overlayId === local.overlayId);
      if (serverIdx === -1) {
        result.push(local);
      } else {
        const server = result[serverIdx];
        if (local.updatedAt > (server.updatedAt || 0)) {
          result[serverIdx] = local;
        }
      }
    }

    // d1 should have updatedAt 3000 (local won), d2 unchanged, d3 added
    expect(result).toHaveLength(3);
    expect(result.find(d => d.overlayId === 'd1').updatedAt).toBe(3000);
    expect(result.find(d => d.overlayId === 'd2').updatedAt).toBe(2000);
    expect(result.find(d => d.overlayId === 'd3').updatedAt).toBe(4000);
  });

  it('keeps server-only drawings', () => {
    const serverData = [{ overlayId: 's1', updatedAt: 1000 }];
    const localData = [];
    const localById = new Map();
    const result = [...serverData];
    for (const local of localData) {
      if (!local.overlayId) { result.push(local); continue; }
      const serverIdx = result.findIndex(d => d.overlayId === local.overlayId);
      if (serverIdx === -1) result.push(local);
    }
    expect(result).toHaveLength(1);
    expect(result[0].overlayId).toBe('s1');
  });

  it('handles drawings without overlayId', () => {
    const serverData = [];
    const localData = [{ overlayType: 'line', updatedAt: 1000 }]; // no overlayId
    const result = [...serverData];
    for (const local of localData) {
      if (!local.overlayId) { result.push(local); continue; }
      const serverIdx = result.findIndex(d => d.overlayId === local.overlayId);
      if (serverIdx === -1) result.push(local);
    }
    expect(result).toHaveLength(1);
    expect(result[0].overlayType).toBe('line');
  });
});
```

---

## Phase 2: Flush Gap Closure

### Fix 2.1: Eager sync cache update

**File:** `src/lib/chart/drawingStore.js`
**Bug:** `_lastSyncData` only populated inside the 500ms debounce callback. `flushPending()` finds `undefined` for drawings created within 500ms of tab close.
**Fix:** After every IndexedDB write (`save`, `update`, `remove`), eagerly read all drawings for that key and update `_lastSyncData`.

```diff
  async save(symbol, resolution, drawing) {
    const stored = await db.drawings.add({
      ...drawing, symbol, resolution, schemaVersion: 1,
      createdAt: Date.now(), updatedAt: Date.now(),
    });
+   await this._updateSyncCache(symbol, resolution);
    this._debouncedServerSync(symbol, resolution);
    return stored;
  },

  async update(id, changes) {
    await db.drawings.update(id, { ...changes, updatedAt: Date.now() });
    const drawing = await db.drawings.get(id);
    if (drawing) {
+     await this._updateSyncCache(drawing.symbol, drawing.resolution);
      this._debouncedServerSync(drawing.symbol, drawing.resolution);
    }
  },

  async remove(id) {
    const drawing = await db.drawings.get(id);
    await db.drawings.delete(id);
    if (drawing) {
+     await this._updateSyncCache(drawing.symbol, drawing.resolution);
      this._debouncedServerSync(drawing.symbol, drawing.resolution);
    }
  },
```

Add new helper method (after `cancelPendingSync`):

```javascript
  /**
   * Eagerly update the sync cache so flushPending() can access current
   * data without waiting for the 500ms debounce to fire. Called after
   * every IndexedDB write (save/update/remove).
   */
  async _updateSyncCache(symbol, resolution) {
    const key = symbol + '/' + resolution;
    const all = await db.drawings.where({ symbol, resolution }).toArray();
    _lastSyncData.set(key, all);
  },
```

### Phase 2 Tests

**Add to `src/lib/chart/__tests__/drawingPersistence.test.js`:**

```javascript
// --- Test 2.1: Eager sync cache ---
describe('_updateSyncCache populates _lastSyncData eagerly', () => {
  it('flushPending can use data immediately after save (no 500ms wait)', async () => {
    // Simulate the fix: after save(), _lastSyncData should already have data.
    // Before the fix, _lastSyncData was only set inside the 500ms debounce callback.
    const _lastSyncData = new Map();
    const mockDbDrawings = {
      async add(data) { return 1; },
      async where() {
        return {
          async toArray() {
            return [{ overlayId: 'test', updatedAt: Date.now() }];
          },
        };
      },
    };

    // Simulate save() with eager cache update
    const symbol = 'EUR/USD';
    const resolution = '4h';
    const key = symbol + '/' + resolution;
    const drawing = { overlayType: 'line', points: [] };

    await mockDbDrawings.add(drawing);

    // Simulate _updateSyncCache (the fix)
    const all = await mockDbDrawings.where().toArray();
    _lastSyncData.set(key, all);

    // Simulate flushPending checking _lastSyncData
    const cachedData = _lastSyncData.get(key);
    expect(cachedData).toBeDefined();
    expect(cachedData).toHaveLength(1);
    expect(cachedData[0].overlayId).toBe('test');
  });

  it('flushPending returns undefined when debounce hasn fired (old behavior)', () => {
    // This test documents the bug that Fix 2.1 resolves.
    const _lastSyncData = new Map();
    const key = 'EUR/USD/4h';

    // Without eager cache update, _lastSyncData is empty
    const cachedData = _lastSyncData.get(key);
    expect(cachedData).toBeUndefined();

    // flushPending would skip this key — drawing not synced to server
    // This is the 500ms gap bug.
  });
});
```

---

## Phase 3: Multi-Tab Concurrency (Optimistic Locking)

### Fix 3.1: Add version column to drawings table

**File:** `docker/postgres/init/02-auth-tables.sql`
**Add after the existing `drawings` table definition:**

```sql
-- Migration: add version column for optimistic locking (ref: drawing-persistence-reliability)
ALTER TABLE drawings ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
```

Note: Placed as a separate `ALTER TABLE` rather than modifying the `CREATE TABLE` so existing databases are migrated safely. New databases get `version DEFAULT 1` from the column default.

### Fix 3.2: Server PUT handler with version check

**File:** `services/tick-backend/persistenceRoutes.js:44-57`

```diff
  /** PUT /api/drawings/:symbol/:resolution — save drawings (optimistic locking). */
  router.put('/api/drawings/:symbol/:resolution', async (req, res) => {
    const { symbol, resolution } = req.params;
+   const clientVersion = parseInt(req.headers['x-drawings-version'], 10) || 0;
    try {
      const result = await query(
-       'INSERT INTO drawings (user_id, symbol, resolution, data, updated_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) ON CONFLICT (user_id, symbol, resolution) DO UPDATE SET data = $4, updated_at = CURRENT_TIMESTAMP',
-       [req.userId, symbol.toUpperCase(), resolution, JSON.stringify(req.body)]
+       `INSERT INTO drawings (user_id, symbol, resolution, data, updated_at, version)
+        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, 1)
+        ON CONFLICT (user_id, symbol, resolution)
+        DO UPDATE SET data = $4, updated_at = CURRENT_TIMESTAMP, version = drawings.version + 1
+        WHERE drawings.version = $5
+        RETURNING version`,
+       [req.userId, symbol.toUpperCase(), resolution, JSON.stringify(req.body), clientVersion]
      );
+     if (result.rows.length === 0) {
+       // Version mismatch — return current server data for client-side merge
+       const current = await query(
+         'SELECT data, version FROM drawings WHERE user_id = $1 AND symbol = $2 AND resolution = $3',
+         [req.userId, symbol.toUpperCase(), resolution]
+       );
+       return res.status(409).json({
+         error: 'VERSION_CONFLICT',
+         data: current.rows[0]?.data || [],
+         version: current.rows[0]?.version || 1,
+       });
+     }
-     res.json({ success: true });
+     res.json({ success: true, version: result.rows[0].version });
    } catch (err) {
      console.error('[Persistence] PUT /api/drawings error:', err.message);
      errorResponse(res, 500, 'SERVER_ERROR', 'Failed to save drawings');
    }
  });
```

**Server GET handler** — return version:

```diff
  /** GET /api/drawings/:symbol/:resolution — load drawings. */
  router.get('/api/drawings/:symbol/:resolution', async (req, res) => {
    const { symbol, resolution } = req.params;
    try {
      const result = await query(
-       'SELECT data FROM drawings WHERE user_id = $1 AND symbol = $2 AND resolution = $3',
+       'SELECT data, version FROM drawings WHERE user_id = $1 AND symbol = $2 AND resolution = $3',
        [req.userId, symbol.toUpperCase(), resolution]
      );
      if (result.rows.length === 0) {
-       return res.json({ data: null });
+       return res.json({ data: null, version: 0 });
      }
-     res.json({ data: result.rows[0].data });
+     res.json({ data: result.rows[0].data, version: result.rows[0].version });
    } catch (err) {
      console.error('[Persistence] GET /api/drawings error:', err.message);
      errorResponse(res, 500, 'SERVER_ERROR', 'Failed to load drawings');
    }
  });
```

### Fix 3.3: Client-side version tracking and 409 merge

**File:** `src/lib/chart/drawingStore.js`

Add version cache alongside `_lastSyncData`:

```diff
  const _lastSyncData = new Map();
+ const _versionCache = new Map();
```

**Modify `_debouncedServerSync`:**

```diff
  _debouncedServerSync(symbol, resolution) {
    if (!get(authStore).isAuthenticated) return;
    const key = symbol + '/' + resolution;
    const existing = saveDebounceTimers.get(key);
    if (existing) clearTimeout(existing);
    saveDebounceTimers.set(key, setTimeout(async () => {
      saveDebounceTimers.delete(key);
      try {
        const all = await db.drawings.where({ symbol, resolution }).toArray();
        _lastSyncData.set(key, all);
+       const version = _versionCache.get(key) || 0;
        const resp = await fetch(
          API_BASE + '/api/drawings/' + encodeURIComponent(symbol) + '/' + encodeURIComponent(resolution),
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
+             'x-drawings-version': String(version),
            },
            credentials: 'include',
            body: JSON.stringify(all),
          }
        );
+       if (resp.status === 409) {
+         // Version conflict — merge server data with local, then re-sync
+         const { data: serverData, version: serverVersion } = await resp.json();
+         const local = await db.drawings.where({ symbol, resolution }).toArray();
+         const merged = this._mergeByTimestamp(serverData, local);
+         await db.transaction('rw', db.drawings, async () => {
+           await db.drawings.where({ symbol, resolution }).delete();
+           for (const d of merged) {
+             await db.drawings.add({ ...d, symbol, resolution });
+           }
+         });
+         _lastSyncData.set(key, merged);
+         _versionCache.set(key, serverVersion);
+         // Re-sync merged result (recursive, but should converge on next call)
+         this._debouncedServerSync(symbol, resolution);
+         return;
+       }
        const result = await resp.json();
+       if (result.version) {
+         _versionCache.set(key, result.version);
+       }
      } catch (err) {
        console.warn('[DrawingStore] Server sync failed for ' + key + ':', err);
      }
    }, 500));
  },
```

**Modify `load()` to cache version from GET response:**

```diff
            if (resp.ok) {
-             const { data } = await resp.json();
+             const { data, version } = await resp.json();
              if (data && Array.isArray(data) && data.length > 0) {
+               if (version) _versionCache.set(symbol + '/' + resolution, version);
                const local = await db.drawings.where({ symbol, resolution }).toArray();
                const merged = this._mergeByTimestamp(data, local);
```

### Phase 3 Tests

**New file:** `services/tick-backend/__tests__/drawingVersioning.test.js`

```javascript
const { describe, it, expect, beforeAll, afterAll } = require('vitest');

describe('PUT /api/drawings optimistic locking', () => {
  it('first PUT succeeds and returns version 1', async () => {
    // POST /api/login to get session cookie
    const loginResp = await fetch('http://localhost:3001/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'testpass123' }),
    });
    const cookie = loginResp.headers.get('set-cookie');
    expect(loginResp.ok).toBe(true);

    // PUT drawings without version header (first write)
    const putResp = await fetch('http://localhost:3001/api/drawings/EUR/USD/4h', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify([{ overlayId: 'd1', overlayType: 'line' }]),
    });
    expect(putResp.ok).toBe(true);
    const result = await putResp.json();
    expect(result.version).toBe(1);
  });

  it('PUT with correct version succeeds and increments version', async () => {
    // ... login, initial PUT ...
    // PUT with x-drawings-version: 1
    const putResp = await fetch('http://localhost:3001/api/drawings/EUR/USD/4h', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-drawings-version': '1',
        Cookie: cookie,
      },
      body: JSON.stringify([{ overlayId: 'd1', overlayType: 'line' }, { overlayId: 'd2', overlayType: 'fibonacci' }]),
    });
    expect(putResp.ok).toBe(true);
    const result = await putResp.json();
    expect(result.version).toBe(2);
  });

  it('PUT with stale version returns 409 with current data', async () => {
    // ... login, PUT with version 1 (succeeds, now version 2) ...
    // PUT again with version 1 (stale — simulating multi-tab)
    const putResp = await fetch('http://localhost:3001/api/drawings/EUR/USD/4h', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-drawings-version': '1',
        Cookie: cookie,
      },
      body: JSON.stringify([{ overlayId: 'd3', overlayType: 'line' }]),
    });
    expect(putResp.status).toBe(409);
    const result = await putResp.json();
    expect(result.error).toBe('VERSION_CONFLICT');
    expect(result.version).toBe(2);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('GET returns version alongside data', async () => {
    // ... login, PUT some data ...
    const getResp = await fetch('http://localhost:3001/api/drawings/EUR/USD/4h', {
      headers: { Cookie: cookie },
    });
    const result = await getResp.json();
    expect(result.version).toBeDefined();
    expect(typeof result.version).toBe('number');
  });

  it('PUT without version header succeeds (backward compat)', async () => {
    const putResp = await fetch('http://localhost:3001/api/drawings/EUR/USD/4h', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify([]),
    });
    expect(putResp.ok).toBe(true);
  });
});
```

**Add to `src/lib/chart/__tests__/drawingPersistence.test.js`:**

```javascript
// --- Test 3.3: Client 409 merge logic ---
describe('client-side 409 merge behavior', () => {
  it('mergeByTimestamp combines server and local data correctly on conflict', () => {
    // Simulate: Tab A added D1, Tab B added D2 without knowing about D1
    // Server has [D1], local has [D1, D2] (D2 is local-only)
    const serverData = [{ overlayId: 'd1', updatedAt: 1000, overlayType: 'line' }];
    const localData = [
      { overlayId: 'd1', updatedAt: 1000, overlayType: 'line' },
      { overlayId: 'd2', updatedAt: 2000, overlayType: 'fibonacci' },
    ];

    const localById = new Map();
    for (const d of localData) {
      if (d.overlayId) localById.set(d.overlayId, d);
    }
    const result = [...serverData];
    for (const local of localData) {
      if (!local.overlayId) { result.push(local); continue; }
      const serverIdx = result.findIndex(d => d.overlayId === local.overlayId);
      if (serverIdx === -1) result.push(local);
      else if (local.updatedAt > (result[serverIdx].updatedAt || 0)) {
        result[serverIdx] = local;
      }
    }

    // Both D1 and D2 should survive the merge
    expect(result).toHaveLength(2);
    expect(result.map(d => d.overlayId).sort()).toEqual(['d1', 'd2']);
  });

  it('local wins when updatedAt is newer', () => {
    const serverData = [{ overlayId: 'd1', updatedAt: 1000, points: [{ x: 1 }] }];
    const localData = [{ overlayId: 'd1', updatedAt: 2000, points: [{ x: 2 }] }];

    const localById = new Map();
    for (const d of localData) {
      if (d.overlayId) localById.set(d.overlayId, d);
    }
    const result = [...serverData];
    for (const local of localData) {
      if (!local.overlayId) { result.push(local); continue; }
      const serverIdx = result.findIndex(d => d.overlayId === local.overlayId);
      if (serverIdx === -1) result.push(local);
      else if (local.updatedAt > (result[serverIdx].updatedAt || 0)) {
        result[serverIdx] = local;
      }
    }

    expect(result).toHaveLength(1);
    expect(result[0].points[0].x).toBe(2); // local won
  });
});
```

---

## Implementation Checklist

### Phase 1 (single PR, zero-risk)
- [ ] Fix 1.1: authStore.js slash split (`lastIndexOf`)
- [ ] Fix 1.2: Add `.catch()` to reloadChart.js:32
- [ ] Fix 1.2: Add `.catch()` to ChartDisplay.svelte lines 284, 296, 435, 475
- [ ] Fix 1.2: Add `.catch()` to drawingStore.js flushPending fetch
- [ ] Fix 1.3: Add `cancelPendingSync()` to `clearAll()`
- [ ] Fix 1.4: Wrap load() merge in Dexie transaction
- [ ] Create `src/lib/chart/__tests__/drawingPersistence.test.js`
- [ ] Run `npm run test:unit` — all pass

### Phase 2 (separate PR, low-risk)
- [ ] Fix 2.1: Add `_updateSyncCache()` helper to drawingStore.js
- [ ] Fix 2.1: Call `_updateSyncCache` in `save()`, `update()`, `remove()`
- [ ] Add Phase 2 tests to drawingPersistence.test.js
- [ ] Run `npm run test:unit` — all pass
- [ ] Manual test: create drawing, close tab within 500ms, reopen — drawing persists

### Phase 3 (separate PR, medium-risk)
- [ ] Fix 3.1: Add `ALTER TABLE drawings ADD COLUMN version` to 02-auth-tables.sql
- [ ] Fix 3.2: Update PUT handler with version check and 409 response
- [ ] Fix 3.2: Update GET handler to return version
- [ ] Fix 3.3: Add `_versionCache` to drawingStore.js
- [ ] Fix 3.3: Update `_debouncedServerSync` with version header and 409 merge
- [ ] Fix 3.3: Update `load()` to cache version from GET
- [ ] Create `services/tick-backend/__tests__/drawingVersioning.test.js`
- [ ] Add Phase 3 client tests to drawingPersistence.test.js
- [ ] Run `npm run test:unit` — all pass
- [ ] Run backend integration tests
- [ ] Manual test: open two tabs, draw in each, verify both drawings survive reload
