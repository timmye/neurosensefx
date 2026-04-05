# Chart & Workspace Persistence — Scope & Exploration

> Status: Phases 1-4 implemented, integration verified
> Date: 2026-04-05

## Context

NeuroSense FX charts support 16+ drawing tools (trendlines, fibonacci, shapes, annotations) with undo/redo. Drawings persist across browser sessions via IndexedDB, and workspace layout persists via localStorage. The charting system plan (`plans/charting-system.md`) explicitly scoped out server-side sync and cross-device persistence.

This document explores the current state, known gaps, and options for improving persistence durability.

---

## Current State

### Storage Inventory

| Data | Mechanism | Scope | Survives | Lost when |
|------|-----------|-------|----------|-----------|
| Chart drawings | IndexedDB (Dexie.js) | `symbol+resolution` | Tab close, browser restart | Clear site data, new browser |
| Workspace layout | localStorage | Global | Tab close, browser restart | Clear site data, new browser |
| Price markers | localStorage | Per symbol | Tab close, browser restart | Clear site data, new browser |
| Chart ghost state | localStorage | Global | Tab close, browser restart | Clear site data, new browser |
| OHLC bars (cache) | IndexedDB (Dexie.js) | `symbol+resolution+timestamp` | Tab close, browser restart | Cache eviction, clear site data |
| Server workspace | PostgreSQL JSONB `workspaces.layout` | Per user | Survives everything | Server failure (mitigated by docker restart) |
| Server drawings | PostgreSQL JSONB `drawings.data` | Per user+symbol+res | Survives everything | Server failure |
| Server price markers | PostgreSQL JSONB `price_markers.data` | Per user+symbol | Survives everything | Server failure |

### Key Files

| File | Role |
|------|------|
| `src/lib/chart/drawingStore.js` | IndexedDB drawing persistence (Dexie.js) |
| `src/lib/chart/drawingCommands.js` | Undo/redo command pattern (50-deep) |
| `src/stores/workspace.js` | Workspace state, export/import |
| `src/stores/priceMarkerPersistence.js` | Price marker localStorage |
| `src/stores/chartDataStore.js` | OHLC bar caching (IndexedDB) |
| `services/tick-backend/httpServer.js` | Express HTTP server + shared port with ws |
| `services/tick-backend/sessionManager.js` | Redis session management |
| `services/tick-backend/authRoutes.js` | Auth API endpoints (register/login/logout/me) |
| `services/tick-backend/persistenceRoutes.js` | Server persistence CRUD endpoints |
| `services/tick-backend/db.js` | PostgreSQL connection pool |
| `src/stores/authStore.js` | Frontend auth state and data migration |
| `src/components/LoginForm.svelte` | Login/register UI |

### Drawing Serialization Format

```json
{
  "id": "auto",
  "symbol": "EURUSD",
  "resolution": "4h",
  "overlayType": "fibonacciLine",
  "points": [{ "timestamp": 1712000000, "price": 1.0850 }],
  "styles": { "color": "#FF0000", "lineWidth": 2 },
  "schemaVersion": 1,
  "createdAt": 1712000000000,
  "updatedAt": 1712000000000
}
```

---

## Known Gaps

### GAP-1: Export/Import Excludes Drawings

**Severity: Resolved (v1.1.0)**

`workspace.js:exportWorkspace()` serializes workspace layout and price markers but does **not** include IndexedDB drawings. Exported workspaces lose all chart annotations.

- Export: `src/stores/workspace.js:271-306`
- Import: `src/stores/workspace.js:209-269`
- Drawing store: `src/lib/chart/drawingStore.js` — `load()` can fetch all drawings for a symbol+resolution

**Fix**: On export, iterate workspace displays, pull drawings from IndexedDB via `drawingStore.load()`, include in export JSON. On import, write them back via `drawingStore.save()`.

**Effort**: Low. The data layer already supports it. Just needs wiring in export/import.

**Resolution**: Fixed in Phase 1 (commit ba9e7f5). Drawings are now included in workspace export/import.

### GAP-2: No Cross-Device / Cross-Browser Persistence

**Severity: Resolved (v1.2.0)**

The charting system plan explicitly scoped this out (line 788). TradingView's free anonymous tier also uses local-only storage — this is industry-standard behavior for unauthenticated charting apps.

**Resolution**: Phase 4 implemented full authentication and server-side persistence with a dual-target strategy — server as primary storage, localStorage/IndexedDB as fallback. All user data (workspace, drawings, price markers) is now persisted to PostgreSQL and available across devices.

### GAP-3: No User-Facing Durability Indication

**Severity: Partially resolved (v1.2.0)**

Users have no visible indication that data is local-only. No warning before clearing, no prompt to export, no "last backup" indicator. If someone clears their browser data without exporting, everything is lost silently.

**Resolution**: Auth gate now requires login, so data is server-persisted. The durability banner from Phase 2 may need updating to reflect server persistence instead of local-only warnings.

### GAP-4: Chart Scroll/Zoom Position Not Persisted

**Severity: Low**

On chart re-open, the scroll position within the time window is not restored. The chart always starts at the most recent data. Minor UX friction.

### GAP-5: Pre-Auth E2E Tests Broken by Auth Gate

**Severity: High**

55 existing E2E tests fail because they navigate to the app expecting `.workspace` to be visible, but the auth gate shows the login form instead. Tests need a `beforeAll` login step added.

---

## Server-Side Persistence Without Auth — Evaluation

### Approach 1: Device UUID in localStorage

Generate a UUID on first visit, use it as a key to store/retrieve data from the server.

**Verdict: Hack.** Creates an implicit user account system without any of the benefits (no recovery, no visibility, no deletion rights). The UUID is exposed to XSS. Financial drawing data (support/resistance levels, fibonacci retracements) under an opaque identifier creates GDPR compliance issues with no mechanism for users to request deletion. Orphaned data accumulates with no cleanup trigger.

### Approach 2: Shareable Workspace Link (nanoid URL)

Each workspace gets a unique URL (`neurosensefx.com/w/V1StGXR8_Z5jdHi6B-myT`). User bookmarks it.

**Verdict: Legitimate for sharing, wrong for primary persistence.** URLs leak through browser history, referrer headers, proxy logs, screen sharing. Financial chart annotations on a leaked URL is a privacy incident. Well-established pattern (Excalidraw, draw.io, Google Docs) but always used for sharing on top of an authenticated system, not as the primary persistence mechanism.

### Approach 3: Local-First with Explicit Sync

Keep IndexedDB as primary store. Add "Generate Share Link" button that serializes workspace to JSON, pushes to server (Redis with nanoid key + 30-day TTL), returns a shareable URL. User explicitly opts in.

**Verdict: Correct pattern.** Honest, safe, aligned with how the app already works. Redis is already provisioned in docker-compose (512MB, LRU eviction). The existing `exportWorkspace()` function already serializes to JSON — "sync to cloud" is essentially "export to server instead of file." This is what Excalidraw does for anonymous sharing.

### Industry Precedent

| App | Anonymous users | Persisted users |
|-----|----------------|-----------------|
| TradingView | localStorage only | Cloud sync (1-20+ layouts) |
| Excalidraw | localStorage + optional share link | — |
| draw.io | Local file | Google Drive/GitHub integration |
| TradingLite | No anonymous tier | Cloud only |

TradingView does **not** attempt server-side persistence without authentication. This is the industry consensus.

---

## Recommended Phases

### Phase 1: Fix Export/Import (Low effort, High value) — Implemented (v1.1.0)

Include drawings in workspace export/import. Close GAP-1.

- Modify `exportWorkspace()` to pull drawings from IndexedDB
- Modify `importWorkspace()` to restore drawings to IndexedDB
- Add export version bump (`1.0.0` → `1.1.0`) for forward compatibility

### Phase 2: Durability UX (Low effort, Medium value)

Address GAP-3 with minimal UI changes.

- Add "Your data is stored locally" indicator in workspace
- Add one-click export button accessible from chart toolbar
- Consider periodic auto-export prompt (e.g., weekly if drawings changed)

### Phase 3: Shareable Snapshots (Medium effort, Medium value)

Implement Approach 3 — local-first with explicit "Generate Share Link."

- One-way push: serialize workspace + drawings to JSON
- Store in Redis with nanoid key, 30-day TTL
- No authentication, no conflict resolution, no persistent identity
- Backend: one new REST endpoint (or WebSocket message type)
- Frontend: "Share" button in toolbar, generates shareable URL

### Phase 4: Full User Authentication & Server Persistence (Deep Evaluation) — Implemented (v1.2.0)

### Phase 5: Test Suite Auth Adaptation (Medium effort, High value)
Fix 55 pre-auth E2E tests broken by the auth gate. Add a shared `beforeAll` login helper that registers a test user and authenticates before each test file runs.

### Phase 6: Production Hardening (Medium effort, Critical for live)
SSL termination, Nginx security headers, Docker secrets for cTrader credentials, health check endpoint, Prometheus metrics.

### Phase 7: Live Deployment (Low effort, Final step)
Deploy to VPS with `docker-compose up -d`, provision SSL via Let's Encrypt, create production secrets, smoke test.

---

## Phase 4 — Full Evaluation

> **Status: Implemented (v1.2.0)** — See commit 2e2dc86 and plan `plans/phase4-auth-and-persistence.md`.

### 4.1 What Would Auth Solve

Auth is not just "save drawings to server." It solves three problems simultaneously:

1. **Data durability** — Drawings, workspace, markers survive browser data clear, device switch, private browsing
2. **WebSocket security** — Currently anyone who finds the WebSocket URL can subscribe to all market data through your cTrader API connection
3. **Multi-user operation** — Currently the app is single-user by convention only. There is no actual enforcement

### 4.2 Complete Data Inventory (What Moves to Server)

Every piece of user-stateful data that would migrate from client to server:

| Data | Current Location | Size Estimate | Server Storage |
|------|-----------------|---------------|----------------|
| Workspace layout | localStorage (`workspace-state`) | 5-50 KB | `workspaces.layout` JSONB |
| Chart drawings | IndexedDB (`NeuroSenseDrawings`) | 1-20 KB per symbol+res | `drawings.data` JSONB |
| Price markers | localStorage (`price-markers-{SYMBOL}`) | 1-5 KB per symbol | `price_markers.data` JSONB |
| Chart ghost state | localStorage | ~0.5 KB | `workspaces.layout` (nested) |
| User preferences | None (defaults only) | ~1 KB | `preferences.data` JSONB |

**NOT moved to server** (stays client-side):
- OHLC bar cache (IndexedDB `NeuroSenseChart`) — pure cache, re-fetchable from cTrader
- WebSocket subscription state — ephemeral, reconstructed on connect
- Market profile data — derived from ticks, recalculated on connect
- Volatility calculations — derived data, recalculated on connect
- Drawing undo/redo stack — ephemeral session state, max 50 commands

**Per-user total**: Under 1 MB. Even 1,000 users = 1 GB. No scaling concern for single-instance PostgreSQL.

### 4.3 Architecture

```
Nginx (TLS termination, /api/* proxy, /ws upgrade proxy)
  |
  v
Node.js backend (Express + ws on same port)
  |-- POST /api/register  -> create user, set cookie
  |-- POST /api/login     -> validate password, set cookie
  |-- POST /api/logout    -> delete session
  |-- GET  /api/me        -> return current user
  |-- GET  /api/workspace -> load workspace + drawings + markers
  |-- PUT  /api/workspace -> save workspace layout
  |-- PUT  /api/drawings/:symbol/:resolution -> save drawings
  |-- PUT  /api/markers/:symbol              -> save markers
  |-- WS   /ws            -> existing WebSocket with cookie auth
  |
  +-- PostgreSQL (users, sessions, workspaces, drawings, markers, preferences)
  +-- Redis (session cache, rate limit counters)
```

**Key decision**: Integrate auth into the existing Node.js backend. No separate auth service. For a single-instance VPS deployment, a separate service adds operational complexity with zero benefit.

### 4.4 Auth Approach

| Decision | Choice | Why |
|----------|--------|-----|
| Token type | Session cookies (not JWT) | Single-instance = no stateless verification benefit. Cookie revocation is instant (delete from Redis). JWT requires blacklist complexity. |
| Cookie flags | `HttpOnly`, `SameSite=Lax`, `Secure` | Immune to XSS token theft and CSRF. `Secure` requires HTTPS. |
| WebSocket auth | Cookie on HTTP upgrade request | Browser sends cookies automatically with `new WebSocket(url)`. No client-side token handling. No unauthenticated window. |
| Login method | Email/password first | Zero external dependencies. Add Google OAuth when users ask for it. |
| Password hashing | bcrypt, 12 rounds | Industry standard, ~200ms per hash on typical VPS. |
| Session store | Redis with 30-day TTL | Already provisioned in docker-compose. TTL handles cleanup automatically. |
| Session policy | One session per user | New login invalidates old. Avoids multi-device sync complexity in v1. |

**Rejected alternatives**:
- JWT in localStorage: Any XSS (charting apps use canvas libraries — klinecharts, interactjs — increasing XSS surface) exposes the token completely.
- Query param token on WebSocket: Token appears in server logs, browser history, Referer headers.
- First-message auth on WebSocket: Allows unauthenticated clients to connect and occupy resources before authenticating.
- Supabase/Firebase: External dependency for single-VPS deployment. User trading data goes to third party — compliance concern.
- API gateway (Nginx handles auth): Still needs a separate auth service. WebSocket upgrades don't work cleanly with `auth_request`.

### 4.5 Database Schema

PostgreSQL. Self-hosted. Already has init scripts at `docker/postgres/init/01-init.sql`.

```sql
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,          -- bcrypt, 12 rounds
    display_name  TEXT,
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now(),
    last_login_at TIMESTAMPTZ
);

CREATE TABLE sessions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,              -- SHA-256 of session token
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    ip_address TEXT,
    user_agent TEXT
);
CREATE INDEX idx_sessions_token ON sessions(token_hash);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE workspaces (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    layout     JSONB NOT NULL DEFAULT '{}',  -- serialized Map<id, display>
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE drawings (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol     TEXT NOT NULL,
    resolution TEXT NOT NULL,
    data       JSONB NOT NULL,             -- array of drawing objects
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, symbol, resolution)
);
CREATE INDEX idx_drawings_user_symbol ON drawings(user_id, symbol);

CREATE TABLE price_markers (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol     TEXT NOT NULL,
    data       JSONB NOT NULL,             -- array of marker objects
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, symbol)
);
CREATE INDEX idx_markers_user_symbol ON price_markers(user_id, symbol);

CREATE TABLE preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data    JSONB NOT NULL DEFAULT '{}'
);
```

**Why JSONB for workspace/drawings/markers**: These are always loaded and saved as complete units. No query pattern like "find all displays at position (100,200)." JSONB avoids JOINs to reconstruct what is currently one `JSON.parse()`. PostgreSQL GIN indexing available if ever needed.

### 4.6 WebSocket Auth Integration

Current code (`WebSocketServer.js:33`):
```javascript
this.wss.on('connection', (ws) => this.handleConnection(ws));
```

Becomes:
```javascript
this.wss.on('connection', (ws, req) => {
  const session = validateSession(req.headers.cookie);
  if (!session) {
    ws.close(4001, 'Unauthorized');
    return;
  }
  ws.userId = session.userId;
  this.handleConnection(ws);
});
```

**Impact on existing code**: Minimal. Market data (ticks, candles, profiles) remains shared — every user subscribed to EUR/USD gets the same tick. Only user-scoped data (workspace, drawings, markers) needs `ws.userId` filtering.

**Reconnection**: Existing `ConnectionManager` reconnect logic unchanged. Browser automatically resends cookies on reconnect. Session validation happens transparently.

### 4.7 Frontend Changes

**New files**:
- `src/stores/authStore.js` — Svelte store: `currentUser`, `login()`, `logout()`, `register()`
- `src/components/LoginForm.svelte` — Login/register UI

**Modified files**:

| File | Change |
|------|--------|
| `src/App.svelte` | Auth gate — redirect to login if no session |
| `src/stores/workspace.js` | Replace localStorage writes with `PUT /api/workspace` |
| `src/stores/priceMarkerPersistence.js` | Replace localStorage with `PUT /api/markers/:symbol` |
| `src/lib/chart/drawingStore.js` | Replace Dexie/IndexedDB with `PUT /api/drawings/:symbol/:resolution` |

**Data migration on first login**: Detect existing localStorage/IndexedDB data, upload to server via API, clear local copies. Seamless transition.

**No new frontend dependencies**: Auth uses `fetch()` for API calls, cookies for session (browser handles automatically). No auth library needed.

### 4.8 Security

| Threat | Mitigation |
|--------|------------|
| XSS steals auth token | `HttpOnly` cookies — JavaScript cannot read them |
| CSRF | `SameSite=Lax` cookie flag blocks cross-site POST |
| Brute force login | Nginx `limit_req_zone` on `/api/login` (5/min/IP) + Redis failed-attempt tracking (lock after 10 failures for 15 min) |
| Packet sniffing | HTTPS/WSS mandatory (Nginx TLS termination) |
| Drawing data exposure | Per-user database rows. No cross-user access. |
| WebSocket hijacking | Cookie validated on upgrade request. No anonymous connections. |

**Financial data sensitivity**: Chart drawings reveal trading intent (support/resistance, fibonacci levels = likely position). Protection level: medium. HTTPS + auth + per-user isolation is appropriate. Not healthcare-level, but not public either.

### 4.9 Effort Estimate

| Component | Effort | Notes |
|-----------|--------|-------|
| PostgreSQL + Redis in docker-compose | 2h | Add PG service, configure Redis for sessions |
| Database schema + migrations | 3h | Tables above, startup migration script |
| Express HTTP layer in backend | 4h | Register, login, logout, me endpoints |
| Redis session store | 2h | Create/validate/delete sessions |
| WebSocket cookie authentication | 3h | Parse cookie on upgrade, validate, reject |
| Frontend auth store + login UI | 5h | Svelte store, login/register forms, auth gate |
| Data migration (localStorage → PostgreSQL) | 6h | Detect local data on first login, upload, clear |
| Workspace sync (API-backed) | 4h | Replace localStorage writes with API calls |
| Drawing sync (API-backed) | 4h | Replace Dexie/IndexedDB with API calls |
| Price marker sync (API-backed) | 2h | Replace localStorage with API calls |
| Nginx SSL + WebSocket proxy | 2h | TLS config, proxy_pass for /ws and /api |
| Security hardening | 2h | Rate limits, security headers |
| Testing | 6h | Auth flow E2E, reconnect, data migration |
| **Total** | **~45h** | |

**Minimum viable auth** (covers the whole project, ~15h):
Email/password login, session cookies, WebSocket cookie auth, PostgreSQL, workspace persistence to DB. Drawings and markers stay local initially.

### 4.10 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Over-building for single user | Medium | Wasted effort | Auth is justified the moment the app is exposed on the internet. Current WebSocket is open to anyone. |
| ORM/framework bloat | Low | Complexity | No ORM. Raw `pg` driver for 5 tables. Plain SQL migrations. |
| Breaking existing workflows | Medium | Regression | Auth is additive. Existing anonymous mode can coexist behind a feature flag during transition. |
| Data loss during migration | Low | Severe | Migration is copy, not move. Keep localStorage as fallback until server persistence confirmed working. |
| Session management complexity | Low | Medium | Single session per user in v1. Multi-device can wait. |

### 4.11 What Phase 4 Enables Beyond Persistence

Auth is not just about saving drawings. It unlocks:

- **Admin panel** — User management, usage metrics
- **Named workspaces** — Multiple layouts per user (TradingView charges for this)
- **Sharing with access control** — Share specific drawings/workspaces with named users, not anonymous links
- **Audit trail** — `audit_log` table already exists in `docker/postgres/init/01-init.sql`
- **Rate limiting per user** — Prevent abuse of cTrader API connection
- **Future monetization** — Subscription tiers (free: local only, paid: cloud sync, multi-workspace)

---

## Integration Verification (2026-04-05)

Phase 4 was verified against a live backend stack running locally:

### Test Environment
- Backend: Node.js (Express + WebSocket) on port 8080
- Frontend: Vite dev server on port 5174 with `/api/*` and `/ws` proxy to backend
- PostgreSQL 15 (native, socket at `/tmp`, database `neurosensefx_dev`)
- Redis 7 (native, default port 6379)
- Playwright Chromium (headless, single worker)

### Auth Flow Results

| Test Suite | Mocked | Integration | Status |
|---|---|---|---|
| Auth flow | 12/12 pass | 6/6 pass | Verified |
| Server persistence | 5/5 pass | 5 skipped (not yet run) | Partial |
| Workspace drawing persistence | 4/4 pass | N/A | Verified |

**Integration tests verified**: full registration, login, session persistence across reload, logout, invalid credentials error, duplicate registration error.

### Infrastructure Fixes Applied
- Added Vite dev proxy (`vite.config.js`) to forward `/api/*` → `localhost:8080` and `/ws` → `ws://localhost:8080`
- Fixed timing in integration tests (added `waitForTimeout(1000)` after login before reload to allow cookie storage)

### Remaining Before Live Deployment

| Phase | Scope | Priority |
|---|---|---|
| Fix pre-auth E2E tests | Add `beforeAll` login step to 55 tests across 11 test files | P0 |
| Server persistence integration | Run 5 integration tests for workspace/drawings/markers round-trip | P0 |
| Production infrastructure | SSL certificates, Nginx HTTPS, Docker secrets, health endpoint | P1 |
| Security verification | Rate limiting, WebSocket auth rejection, session invalidation | P1 |
| VPS deployment | Deploy to production VPS with full docker-compose stack | P2 |

---

## Decision Log

| Decision | Rationale |
|----------|-----------|
| Server-side persistence without auth rejected | Device UUID is a dishonest account system. Shareable links are for sharing, not persistence. Both create worse problems than they solve for financial data. |
| Phase 1 (fix export) is the immediate priority | Highest value per effort. Drawing data is already in IndexedDB, just needs to be included in the export flow. |
| Phase 3 is the only viable anonymous server-side pattern | Local-first with explicit sync is honest, safe, and uses existing infrastructure (Redis + exportWorkspace). |
| TradingView's approach validated | Largest charting platform uses local-only for anonymous users. No competitive pressure to do otherwise. |
| Phase 4 uses session cookies, not JWT | Single-instance deployment. Cookie revocation is instant. JWT adds blacklist complexity for no benefit. |
| Phase 4 integrates auth into existing backend | Separate auth service adds operational overhead. The backend already runs Node.js. Add Express alongside ws. |
| Phase 4 uses PostgreSQL JSONB, no ORM | 5 tables with simple relationships. Raw `pg` driver. JSONB for workspace/drawings (always loaded as unit). |
| WebSocket auth via cookie on upgrade request | Browser sends cookies automatically. No unauthenticated window. No token in URLs or logs. |

---

## References

- `plans/charting-system.md` — Original charting system plan, Part 5 (drawing persistence), Out of Scope (line 788)
- `src/lib/chart/drawingStore.js` — IndexedDB drawing store
- `src/stores/workspace.js:271-306` — Export function (missing drawings)
- `src/stores/workspace.js:209-269` — Import function (missing drawings)
- `src/lib/chart/drawingCommands.js` — Undo/redo command pattern
- `docker-compose.yml` — Redis provisioned but unused for user data
- `docker-compose.dev.yml:99-118` — PostgreSQL dev config (neurosensefx_dev)
- `docker/postgres/init/01-init.sql` — Existing PG init script (app_config, audit_log tables)
- `services/tick-backend/WebSocketServer.js:33` — WebSocket connection handler (auth integration point)
- `services/tick-backend/server.js:32` — Backend entry point (Express integration point)
- `docker/nginx/frontend.conf` — Nginx config (needs TLS + WebSocket proxy)
