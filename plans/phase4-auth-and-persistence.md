# Plan

## Overview

NeuroSense FX has no authentication. Anyone who discovers the WebSocket URL can subscribe to all market data through the cTrader API connection. User data (workspace layout, chart drawings, price markers) is client-side only (localStorage + IndexedDB) and lost on browser data clear, device switch, or private browsing. The app is designed for single-VPS deployment but has no multi-user enforcement.

**Approach**: Integrate Express HTTP layer into existing Node.js WebSocket backend. Add email/password authentication with session cookies (HttpOnly, SameSite-Lax, Secure). Store sessions in Redis. Persist user data in PostgreSQL with JSONB columns. Replace localStorage/IndexedDB persistence with API-backed server persistence. Authenticate WebSocket connections via cookie on HTTP upgrade request. Migrate existing local data to server on first login.

### Auth and Persistence Architecture

[Diagram pending Technical Writer rendering: DIAG-001]

## Planning Context

### Decision Log

| ID | Decision | Reasoning Chain |
|---|---|---|
| DL-001 | Session cookies over JWT for authentication | Single-instance VPS deployment -> no stateless verification benefit across servers -> cookie revocation is instant (delete from Redis) while JWT requires blacklist complexity -> session cookies are the simpler, safer choice |
| DL-002 | Integrate Express into existing Node.js backend, not separate auth service | Single-VPS deployment -> separate auth service adds operational overhead (two processes, two ports, inter-service communication) -> existing backend already runs Node.js -> Express alongside ws is standard pattern with zero additional infra |
| DL-003 | Redis for session store, PostgreSQL for user data | Redis already provisioned in docker-compose (512MB, LRU) -> 30-day TTL handles session cleanup automatically -> PostgreSQL already provisioned in dev docker-compose -> JSONB columns for workspace/drawings/markers (always loaded as complete units, no row-level query patterns) |
| DL-004 | Raw pg driver, no ORM | 5 tables with simple relationships -> ORM adds dependency and abstraction for no benefit -> raw SQL is transparent and matches project convention (no ORM in existing codebase) |
| DL-005 | WebSocket auth via cookie on HTTP upgrade request | Browser sends cookies automatically with new WebSocket(url) -> no client-side token handling -> no unauthenticated window (reject immediately) -> no token in URLs, logs, or Referer headers |
| DL-006 | One session per user in v1 | New login invalidates old session -> eliminates multi-device sync complexity in v1 -> single session simplifies conflict resolution -> multi-device can be added later without schema changes |
| DL-007 | Data migration is copy, not move | First login detects existing localStorage/IndexedDB data -> upload to server -> keep localStorage as fallback until server confirmed working -> prevents data loss if server persistence fails |
| DL-008 | bcrypt 12 rounds for password hashing | Industry standard -> ~200ms per hash on typical VPS -> sufficient security without excessive CPU cost -> specified in persistence-scope.md |
| DL-009 | Dual-layer rate limiting: application-level per-email lockout (10 failures / 15 min) plus Nginx per-IP rate limit (5 req/min on /api/login) | Application lockout prevents credential stuffing across IPs (same email) -> Nginx rate limit prevents brute-force across emails from single IP -> neither alone covers both vectors -> dual layer provides defense in depth |
| DL-010 | Minimal password validation policy: min 8 chars, max 72 bytes (bcrypt truncation limit), reject whitespace-only. No complexity rules in v1. | bcrypt silently truncates at 72 bytes -> must enforce max length to prevent silent truncation attack -> whitespace-only check prevents trivial passwords -> complexity rules add UX friction without proportional security gain for v1 -> bcrypt 12 rounds provides the primary brute-force protection |
| DL-011 | No anonymous mode coexistence — hard cutover to authenticated-only. Remove feature flag reference from R-001. | M-004 rejects all unauthenticated WebSocket connections with 4001 -> anonymous mode cannot coexist with enforced WS auth -> feature flag adds complexity for a transition that has no intermediate state -> R-001 mitigation was inconsistent with M-004 -> clean cutover: deploy auth, all users must register |
| DL-012 | audit_log table (from 01-init.sql) used for auth events — validates assumption M. Auth actions (register, login, logout, failed_login) logged with action VARCHAR and details JSONB containing userId, email, ip, userAgent. | audit_log table exists in 01-init.sql with action VARCHAR and details JSONB columns -> JSONB details field is flexible enough for auth event metadata -> no schema changes needed to audit_log -> validates assumption M -> provides security audit trail for incident investigation |
| DL-013 | Redis SPOF accepted for v1 single-VPS deployment — single instance with docker restart policy | Redis persistence (RDB + AOF) enabled by default -> docker restart policy restores container after host reboot -> single-VPS means host failure loses everything including PostgreSQL -> Redis HA (Sentinel/cluster) adds operational complexity with no availability gain when the single host is down -> accepted risk for v1 |
| DL-014 | Standardized JSON error envelope across all API endpoints: {error: {code: string, message: string}} | Consistent error shape enables uniform frontend error handling -> {error: {code, message}} is minimal and sufficient -> code field allows i18n and programmatic handling -> message field provides human-readable detail |
| DL-015 | Auth events logged to audit_log table — login, logout, register, failed login, session invalidation | audit_log table exists in 01-init.sql with action and details JSONB columns -> sufficient for auth event logging with action=login|logout|register etc and details={userId,email,ip,userAgent} -> validates assumption M -> provides security audit trail for incident investigation |
| DL-016 | Server-side input sanitization for display_name: strip HTML tags, enforce max 128 chars. Client renders via text interpolation (Svelte default), not {@html}. | display_name stored in PostgreSQL and returned in /api/me -> unsanitized HTML creates stored XSS vector -> Svelte default text interpolation escapes HTML but explicit server-side sanitization is defense in depth -> strip HTML tags removes attack payload -> max length prevents abuse -> no {@html} usage confirmed |
| DL-017 | Content-Security-Policy header included in Nginx security headers for XSS defense in depth | Financial application with canvas libraries increases XSS surface -> CSP restricts script sources -> default-src self + script-src self + style-src self inline + img-src self data: + connect-src self ws: wss: + frame-ancestors none -> complements existing security headers -> CSP reporting deferred to v1.1 |
| DL-018 | Environment-aware CORS: production same-origin via Nginx proxy, dev mode allows localhost:5174 (Vite dev server origin) | Vite dev server runs on port 5174 while backend runs on port 8080 -> different origins in dev -> same-origin CORS blocks dev requests -> conditional CORS based on NODE_ENV: dev allows localhost:5174, production same-origin -> Nginx proxy eliminates CORS in production |
| DL-019 | 02-auth-tables.sql must not hardcode database name — use Docker env POSTGRES_DB or connect to current database | 01-init.sql hardcodes \c neurosensefx_dev -> Docker init scripts run in separate psql sessions -> 02-auth-tables.sql does NOT inherit this connection -> production may use different database name -> solution: omit \c entirely, rely on POSTGRES_DB env var that Docker uses to select the default database for each init script -> all init scripts run against the database specified by POSTGRES_DB |
| DL-020 | Session cookie name (neurosense_session) is a formal constraint shared between frontend and backend | Cookie name is implementation-critical — mismatch between backend set-cookie and frontend read breaks auth entirely -> belongs in formal constraints alongside other cookie properties -> currently only in invisible_knowledge.invariants -> promoting to constraints prevents drift |
| DL-021 | bcrypt used in async mode (bcrypt.compare/bcrypt.hash callbacks) to avoid blocking Node.js event loop | bcrypt.compare and bcrypt.hash have async variants -> synchronous calls block the single Node.js thread for ~200ms per operation -> blocks all WebSocket connections and market data during that time -> async bcrypt yields to event loop -> no worker thread complexity needed -> async is the default recommended usage in bcrypt library |
| DL-022 | POST /api/migrate uses PostgreSQL transaction — all-or-nothing insert for workspace+drawings+markers | Migration uploads workspace+drawings+markers in one request -> partial failure leaves server data inconsistent -> db.query helper exposes pool for transactions -> wrap all INSERTs in BEGIN/COMMIT -> on failure, ROLLBACK -> client retries (copy-not-move means local data preserved) |
| DL-023 | Active WebSocket connections terminated when session is invalidated by new login from another device | One session per user -> new login invalidates old Redis session -> old WebSocket connection still alive receiving data -> must actively close old connection -> solution: userId-to-WebSocket registry in WebSocketServer, sessionManager.createSession emits event, WebSocketServer listens and closes(4001) the old connection |
| DL-024 | preferences table deferred from v1 — no CRUD endpoints needed until settings UI is built | CI-M-001-001 creates preferences table but no milestone implements CRUD endpoints -> table without endpoints is dead schema -> remove from 02-auth-tables.sql -> add later when settings UI milestone is planned -> keeps schema minimal for v1 |

### Rejected Alternatives

| Alternative | Why Rejected |
|---|---|
| JWT in localStorage | Charting apps use canvas libraries (klinecharts, interactjs) increasing XSS surface. localStorage JWT is fully accessible to XSS attacks. (ref: DL-001) |
| Query param token on WebSocket | Token appears in server logs, browser history, Referer headers. Violates security principle of keeping credentials out of URLs. (ref: DL-005) |
| First-message auth on WebSocket | Allows unauthenticated clients to connect and occupy resources before authenticating. Creates a window for abuse. (ref: DL-005) |
| Supabase/Firebase for auth | External dependency for single-VPS deployment. User trading data goes to third party. Compliance concern for financial chart annotations. (ref: DL-002) |
| Separate auth microservice | Adds operational overhead (two processes, inter-service communication) with zero benefit for single-VPS deployment. (ref: DL-002) |
| ORM (Prisma/Sequelize) | 5 simple tables. Raw pg driver is more transparent. No existing ORM in codebase to be consistent with. (ref: DL-004) |

### Constraints

- Session cookies not JWT. HttpOnly, SameSite-Lax, Secure flags. Single-instance deployment.
- Session cookie name: neurosense_session (shared between frontend and backend — mismatch breaks auth).
- WebSocket auth via cookie on HTTP upgrade request. No unauthenticated connections.
- Email/password login only. Zero external auth dependencies.
- Password validation: min 8 chars, max 72 bytes (bcrypt truncation limit), reject whitespace-only.
- Integrate auth into existing Node.js backend. No separate auth service.
- PostgreSQL JSONB for workspace/drawings/markers. Always loaded as complete unit.
- One session per user. New login invalidates old. Active WebSocket connection closed on invalidation.
- Data migration is copy not move. Keep localStorage fallback until server confirmed.
- All API error responses use standard JSON envelope: {error: {code: string, message: string}}.
- All bcrypt operations use async variants to avoid blocking Node.js event loop.

### Known Risks

- **Breaking existing workflows during auth integration**: Hard cutover to authenticated-only. All users must register after auth deployment. Frontend gracefully handles missing auth (shows login form, does not break). Data migration preserves existing localStorage/IndexedDB data via copy-not-move on first login.
- **Data loss during migration from localStorage/IndexedDB to server**: Migration is copy, not move. localStorage/IndexedDB data preserved until server persistence confirmed. Upload happens on first login only. POST /api/migrate uses PostgreSQL transaction for all-or-nothing insert.
- **WebSocket reconnection fails after session expiry**: Redis 30-day TTL. Frontend detects 4001 close code and redirects to login. ConnectionManager reconnect logic unchanged (browser resends cookies automatically).
- **Redis single point of failure — all sessions lost if Redis goes down**: Redis persistence (RDB+AOF) enabled by default. Docker restart policy restores container after host reboot. Accepted risk for v1 single-VPS: host failure loses PostgreSQL too, so Redis HA provides no availability gain. Users re-login after Redis recovery.

## Invisible Knowledge

### System

The backend is a pure WebSocket server (ws library) with no HTTP framework. Adding Express alongside ws is a standard Node.js pattern: create HTTP server with Express, attach ws to it. The WebSocketServer constructor currently takes a port and creates its own HTTP server internally. The integration point is changing it to accept an existing HTTP server instead. Browser sends cookies automatically with new WebSocket(url), so the existing ConnectionManager reconnect logic requires zero changes for cookie-based auth. Market data (ticks, candles, profiles) remains shared across all users -- only user-scoped data (workspace, drawings, markers) needs per-user isolation via userId filtering.

### Invariants

- All /api/* endpoints require authentication via session cookie except /api/login and /api/register
- WebSocket connections without valid session cookie are rejected with close code 4001
- One active session per user at any time -- new login invalidates previous session
- User-scoped data (workspace, drawings, markers) is isolated by userId -- no cross-user access
- Market data (ticks, candles, profiles) is shared across all authenticated users
- Data migration runs once on first login after registration, then never again
- All API responses use JSON content type
- Session cookie name: neurosense_session (consistent across frontend and backend)

### Tradeoffs

- Single session per user limits multi-device use in v1, but eliminates sync complexity
- JSONB for workspace/drawings means no row-level querying, but these are always loaded as complete units anyway
- No ORM means more boilerplate SQL, but complete transparency for 5 simple tables
- bcrypt adds ~200ms to login, but this is intentional security (slows brute force)
- Data migration is copy not move -- temporarily doubles storage, but prevents data loss

## Milestones

### Milestone 1: Database Schema and Infrastructure

**Files**: docker/postgres/init/02-auth-tables.sql, docker-compose.yml

**Requirements**:

- PostgreSQL schema with users, sessions, workspaces, drawings, price_markers tables (preferences deferred per DL-024)
- All tables use UUID primary keys with gen_random_uuid()
- JSONB columns for workspace layout, drawings data, markers data, and preferences
- Foreign key constraints with ON DELETE CASCADE
- Indexes on sessions.token_hash, sessions.user_id, drawings(user_id,symbol), price_markers(user_id,symbol)
- PostgreSQL service added to production docker-compose.yml

**Acceptance Criteria**:

- docker-compose up creates PostgreSQL container with auth tables
- psql \dt shows users, sessions, workspaces, drawings, price_markers tables (no preferences)
- Foreign key constraints prevent orphaned data (deleting user cascades to all related tables)
- UNIQUE constraints on users.email, workspaces.user_id, drawings(user_id,symbol,resolution), price_markers(user_id,symbol)

**Tests**:

- Manual: Spin up docker-compose, verify tables exist via psql or Adminer

#### Code Intent

- **CI-M-001-001** `docker/postgres/init/02-auth-tables.sql`: Create auth-related tables (no \c directive — relies on Docker POSTGRES_DB env var for database selection). Tables: users (id UUID PK, email UNIQUE, password_hash, display_name, created_at, updated_at, last_login_at), sessions (id UUID PK, user_id FK, token_hash, created_at, expires_at, ip_address, user_agent), workspaces (id UUID PK, user_id UNIQUE FK, layout JSONB, updated_at), drawings (id UUID PK, user_id FK, symbol, resolution, data JSONB, updated_at, UNIQUE(user_id,symbol,resolution)), price_markers (id UUID PK, user_id FK, symbol, data JSONB, updated_at, UNIQUE(user_id,symbol)). Do NOT create preferences table (deferred to future milestone). Include indexes on sessions.token_hash, sessions.user_id, drawings(user_id,symbol), price_markers(user_id,symbol). (refs: DL-003, DL-004, DL-008, DL-019, DL-024)
- **CI-M-001-002** `docker-compose.yml`: Add PostgreSQL service to production docker-compose. Image postgres:15-alpine. Environment variables: POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD from secrets or env. Volume mount for postgres-data persistence. Volume mount docker/postgres/init to /docker-entrypoint-initdb.d. Healthcheck with pg_isready. Add postgres-data volume definition. Connect to neurosensefx-network. (refs: DL-003)

#### Code Changes

**CC-M-001-001** (docker/postgres/init/02-auth-tables.sql) - implements CI-M-001-001

**Code:**

```diff
--- a/docker/postgres/init/02-auth-tables.sql
+++ b/docker/postgres/init/02-auth-tables.sql
@@ -0,0 +1,55 @@
+-- =============================================================================
+-- NEUROSENSE FX - AUTH TABLES
+-- =============================================================================
+
+CREATE TABLE IF NOT EXISTS users (
+    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+    email VARCHAR(255) UNIQUE NOT NULL,
+    password_hash VARCHAR(255) NOT NULL,
+    display_name VARCHAR(128),
+    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
+    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
+    last_login_at TIMESTAMP
+);
+
+CREATE TABLE IF NOT EXISTS sessions (
+    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
+    token_hash VARCHAR(128) NOT NULL,
+    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
+    expires_at TIMESTAMP NOT NULL,
+    ip_address VARCHAR(45),
+    user_agent TEXT
+);
+
+CREATE TABLE IF NOT EXISTS workspaces (
+    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
+    layout JSONB,
+    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
+);
+
+CREATE TABLE IF NOT EXISTS drawings (
+    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
+    symbol VARCHAR(50) NOT NULL,
+    resolution VARCHAR(20) NOT NULL,
+    data JSONB,
+    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
+    UNIQUE(user_id, symbol, resolution)
+);
+
+CREATE TABLE IF NOT EXISTS price_markers (
+    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
+    symbol VARCHAR(50) NOT NULL,
+    data JSONB,
+    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
+    UNIQUE(user_id, symbol)
+);
+
+-- Indexes for session lookup and user-scoped data queries
+CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
+CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
+CREATE INDEX IF NOT EXISTS idx_drawings_user_symbol ON drawings(user_id, symbol);
+CREATE INDEX IF NOT EXISTS idx_price_markers_user_symbol ON price_markers(user_id, symbol);

```

**Documentation:**

```diff
--- a/docker/postgres/init/02-auth-tables.sql
+++ b/docker/postgres/init/02-auth-tables.sql
@@ -1,5 +1,10 @@
 -- =============================================================================
 -- NEUROSENSE FX - AUTH TABLES
+--
+-- User-scoped persistence tables for authentication, workspace layout,
+-- chart drawings, and price markers. Uses JSONB for user data that is
+-- always loaded as a complete unit. (ref: DL-003, DL-004)
+-- No \\c directive — relies on Docker POSTGRES_DB env var (ref: DL-019).
+-- preferences table deferred from v1 — no CRUD endpoints until settings UI (ref: DL-024).
 -- =============================================================================
 
 CREATE TABLE IF NOT EXISTS users (

```


**CC-M-001-002** (docker-compose.yml) - implements CI-M-001-002

**Code:**

```diff
--- a/docker-compose.yml
+++ b/docker-compose.yml
@@ -87,6 +87,27 @@ services:
     deploy:
       resources:
         limits:
           cpus: '0.5'
           memory: 512M
 
+  postgres:
+    image: postgres:15-alpine
+    container_name: neurosensefx-postgres
+    restart: unless-stopped
+    environment:
+      - POSTGRES_DB=${POSTGRES_DB:-neurosensefx}
+      - POSTGRES_USER=${POSTGRES_USER:-neurosensefx}
+      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:?POSTGRES_PASSWORD required}
+    volumes:
+      - postgres-data:/var/lib/postgresql/data
+      - ./docker/postgres/init:/docker-entrypoint-initdb.d:ro
+    networks:
+      - neurosensefx-network
+    healthcheck:
+      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-neurosensefx}"]
+      interval: 30s
+      timeout: 10s
+      retries: 3
+      start_period: 30s
+    deploy:
+      resources:
+        limits:
+          cpus: '1.0'
+          memory: 1G
+
   nginx:
     image: nginx:alpine
@@ -196,6 +217,8 @@ volumes:
   backend-logs:
     driver: local
     driver_opts:
       type: none
       o: bind
       device: /opt/neurosensefx/logs/backend
+  postgres-data:
+    driver: local
   redis-data:
     driver: local
   nginx-logs:

```

**Documentation:**

```diff
--- a/docker-compose.yml
+++ b/docker-compose.yml
@@ -87,6 +87,10 @@
     deploy:
       resources:
         limits:
           cpus: '0.5'
           memory: 512M
 
+  # PostgreSQL for user data and auth tables. Provisioned in dev docker-compose;
+  # replicated here for production parity. (ref: DL-003)
   postgres:

```


### Milestone 2: Express HTTP Layer and Session Management

**Files**: services/tick-backend/httpServer.js, services/tick-backend/sessionManager.js, services/tick-backend/package.json, services/tick-backend/middleware.js

**Requirements**:

- Express app created alongside existing ws WebSocket server
- HTTP server shared between Express and ws (no separate port)
- Redis session store with 30-day TTL
- Session cookie: neurosense_session, HttpOnly, SameSite-Lax, Secure in production
- One session per user (new login invalidates old)
- bcrypt 12 rounds for password hashing

**Acceptance Criteria**:

- Express app serves HTTP requests on the same port as WebSocket
- Session cookie is set after login and included in subsequent requests
- Redis stores session with correct TTL
- Password hashing produces bcrypt hash verifiable with bcrypt.compare
- New login for same user deletes previous session from Redis

**Tests**:

- Integration: curl POST /api/login with valid credentials returns session cookie

#### Code Intent

- **CI-M-002-001** `services/tick-backend/httpServer.js`: Create Express app with JSON body parser. Create HTTP server from Express app. Attach WebSocket server to the HTTP server (pass server option to ws.WebSocket.Server). Export both the Express app and the HTTP server. Add cookie-parser middleware. Add CORS middleware: production same-origin, dev mode allows localhost:5174 via NODE_ENV conditional. Add security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection). Listen on the configured port. errorResponse and requireAuth are defined in middleware.js (CC-M-002-004) to avoid circular dependencies between httpServer, authRoutes, and persistenceRoutes. (refs: DL-002, DL-005, DL-018)
- **CI-M-002-002** `services/tick-backend/sessionManager.js`: Redis-backed session management module. Functions: createSession(userId, ipAddress, userAgent) -> generates crypto.randomBytes(48) token, stores SHA-256 hash in Redis with key sess:{hash}, value {userId, createdAt, expiresAt}, TTL 30 days. Uses O(1) userId-to-session index key (sess:user:{userId}) to find and delete existing session for the same userId, avoiding O(N) redis.keys() scan. When deleting existing session, emit sessionInvalidated event with userId so WebSocketServer can close the old connection. Redis pipeline (multi) atomically sets session data and index key. validateSession(token) -> hash token, lookup in Redis, return userId or null. deleteSession(token) -> hash token, delete from Redis. Uses ioredis client connected to Redis URL from environment. Session cookie name: neurosense_session (formal constraint). Cookie settings: HttpOnly, SameSite-Lax, Secure (conditional on NODE_ENV=production), Path=/, Max-Age=2592000 (30 days). Uses async bcrypt for all hash/compare operations. (refs: DL-001, DL-003, DL-006, DL-020, DL-021)
- **CI-M-002-003** `services/tick-backend/package.json`: Add dependencies: express, cookie-parser, ioredis, bcrypt (version 12 rounds default), pg, cors. These are all production dependencies. (refs: DL-002, DL-003, DL-004, DL-008)

#### Code Changes

**CC-M-002-001** (services/tick-backend/httpServer.js) - implements CI-M-002-001

**Code:**

```diff
--- a/services/tick-backend/httpServer.js
+++ b/services/tick-backend/httpServer.js
@@ -0,0 +1,41 @@
+const express = require('express');
+const http = require('http');
+const cookieParser = require('cookie-parser');
+const { errorResponse } = require('./middleware');
+
+const app = express();
+
+app.use(express.json({ limit: '1mb' }));
+app.use(cookieParser());
+
+if (process.env.NODE_ENV !== 'production') {
+    const cors = require('cors');
+    app.use(cors({
+        origin: 'http://localhost:5174',
+        credentials: true
+    }));
+}
+
+app.use((req, res, next) => {
+    res.setHeader('X-Content-Type-Options', 'nosniff');
+    res.setHeader('X-Frame-Options', 'DENY');
+    res.setHeader('X-XSS-Protection', '1; mode=block');
+    next();
+});
+
+const { authRoutes } = require('./authRoutes');
+app.use(authRoutes);
+
+const { persistenceRoutes } = require('./persistenceRoutes');
+app.use(persistenceRoutes);
+
+const server = http.createServer(app);
+
+function listen(port) {
+    return new Promise((resolve, reject) => {
+        server.listen(port, () => {
+            console.log(`[HTTP] Express server listening on port ${port}`);
+            resolve(server);
+        });
+        server.on('error', reject);
+    });
+}
+
+module.exports = { app, server, listen };

```

**Documentation:**

```diff
--- a/services/tick-backend/httpServer.js
+++ b/services/tick-backend/httpServer.js
@@ -0,0 +1,45 @@
+/**
+ * Express HTTP server integrated into the existing Node.js backend.
+ * Shares the same port as the WebSocket server via http.createServer.
+ * Dev mode enables CORS for Vite dev server on localhost:5174. (ref: DL-002, DL-018)
+ */
 const express = require('express');
 const http = require('http');
 const cookieParser = require('cookie-parser');
 const { errorResponse } = require('./middleware');
 
 const app = express();
 
 app.use(express.json({ limit: '1mb' }));
 app.use(cookieParser());
 
 if (process.env.NODE_ENV !== 'production') {
+    // Dev-only CORS: Vite runs on port 5174, backend on 8081 (ref: DL-018)
     const cors = require('cors');
     app.use(cors({
         origin: 'http://localhost:5174',
         credentials: true
     }));
 }
 
+// Security headers applied to all responses (ref: DL-017)
 app.use((req, res, next) => {
     res.setHeader('X-Content-Type-Options', 'nosniff');
     res.setHeader('X-Frame-Options', 'DENY');
     res.setHeader('X-XSS-Protection', '1; mode=block');
     next();
 });
 
 const { authRoutes } = require('./authRoutes');
 app.use(authRoutes);
 
 const { persistenceRoutes } = require('./persistenceRoutes');
 app.use(persistenceRoutes);
 
 const server = http.createServer(app);
 
+/**
+ * Start the HTTP server on the given port. Returns a Promise that resolves
+ * with the http.Server instance once listening.
+ * @param {number} port
+ * @returns {Promise<http.Server>}
+ */
 function listen(port) {
     return new Promise((resolve, reject) => {
         server.listen(port, () => {
             console.log(`[HTTP] Express server listening on port ${port}`);
             resolve(server);
         });
         server.on('error', reject);
     });
 }
 
 module.exports = { app, server, listen };

```


**CC-M-002-002** (services/tick-backend/sessionManager.js) - implements CI-M-002-002

**Code:**

```diff
--- a/services/tick-backend/sessionManager.js
+++ b/services/tick-backend/sessionManager.js
@@ -0,0 +1,82 @@
+const Redis = require('ioredis');
+const crypto = require('crypto');
+const EventEmitter = require('events');
+
+const SESSION_COOKIE_NAME = 'neurosense_session';
+const SESSION_TTL = 30 * 24 * 60 * 60;
+const MAX_AGE_MS = SESSION_TTL * 1000;
+
+class SessionManager extends EventEmitter {
+    constructor() {
+        super();
+        this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
+        this.redis.on('error', (err) => console.error('[SessionManager] Redis error:', err.message));
+    }
+
+    get cookieOptions() {
+        return {
+            path: '/',
+            httpOnly: true,
+            sameSite: 'Lax',
+            secure: process.env.NODE_ENV === 'production',
+            maxAge: MAX_AGE_MS
+        };
+    }
+
+    hashToken(token) {
+        return crypto.createHash('sha256').update(token).digest('hex');
+    }
+
+    async createSession(userId, ipAddress, userAgent) {
+        const indexKey = 'sess:user:' + userId;
+        const existingTokenHash = await this.redis.get(indexKey);
+        if (existingTokenHash) {
+            await this.redis.del('sess:' + existingTokenHash);
+            this.emit('sessionInvalidated', { userId });
+        }
+
+        const token = crypto.randomBytes(48).toString('hex');
+        const tokenHash = this.hashToken(token);
+        const now = new Date();
+        const expiresAt = new Date(now.getTime() + MAX_AGE_MS);
+
+        const multi = this.redis.multi();
+        multi.set(
+            'sess:' + tokenHash,
+            JSON.stringify({ userId, createdAt: now.toISOString(), expiresAt: expiresAt.toISOString() }),
+            'EX', SESSION_TTL
+        );
+        multi.set(indexKey, tokenHash, 'EX', SESSION_TTL);
+        await multi.exec();
+
+        return token;
+    }
+
+    async validateSession(token) {
+        const tokenHash = this.hashToken(token);
+        const data = await this.redis.get('sess:' + tokenHash);
+        if (!data) return null;
+        try {
+            const parsed = JSON.parse(data);
+            return parsed.userId;
+        } catch (e) {
+            return null;
+        }
+    }
+
+    async deleteSession(token) {
+        const tokenHash = this.hashToken(token);
+        const data = await this.redis.get('sess:' + tokenHash);
+        if (data) {
+            try {
+                const parsed = JSON.parse(data);
+                await this.redis.del('sess:user:' + parsed.userId);
+            } catch (e) { }
+        }
+        await this.redis.del('sess:' + tokenHash);
+    }
+}
+
+module.exports = { SessionManager, SESSION_COOKIE_NAME };

```

**Documentation:**

```diff
--- a/services/tick-backend/sessionManager.js
+++ b/services/tick-backend/sessionManager.js
@@ -0,0 +1,86 @@
+/**
+ * Redis-backed session manager. Session cookies chosen over JWT for
+ * single-instance deployment where cookie revocation is instant (ref: DL-001).
+ * One session per user: creating a new session invalidates the old one (ref: DL-006).
+ * Emits 'sessionInvalidated' event so WebSocket connections can close promptly (ref: DL-023).
+ * Redis SPOF is accepted for v1 single-VPS: host failure loses PostgreSQL too (ref: DL-013).
+ */
 const Redis = require('ioredis');
 const crypto = require('crypto');
 const EventEmitter = require('events');
 
 const SESSION_COOKIE_NAME = 'neurosense_session';
 const SESSION_TTL = 30 * 24 * 60 * 60;
 const MAX_AGE_MS = SESSION_TTL * 1000;
 
 class SessionManager extends EventEmitter {
     constructor() {
         super();
         this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
         this.redis.on('error', (err) => console.error('[SessionManager] Redis error:', err.message));
     }
 
+    /** Cookie options shared between backend set-cookie and frontend reads (ref: DL-020). */
     get cookieOptions() {
         return {
             path: '/',
             httpOnly: true,
             sameSite: 'Lax',
             secure: process.env.NODE_ENV === 'production',
             maxAge: MAX_AGE_MS
         };
     }
 
+    /** SHA-256 hash of the raw session token for Redis key storage. */
     hashToken(token) {
         return crypto.createHash('sha256').update(token).digest('hex');
     }
 
+    /**
+     * Create a new session for userId. If an existing session exists for this
+     * user, it is deleted and 'sessionInvalidated' is emitted so that the
+     * corresponding WebSocket connection can be closed (ref: DL-006, DL-023).
+     * @param {string} userId
+     * @param {string} ipAddress
+     * @param {string} userAgent
+     * @returns {Promise<string>} raw session token (not hashed)
+     */
     async createSession(userId, ipAddress, userAgent) {
         const indexKey = 'sess:user:' + userId;
         const existingTokenHash = await this.redis.get(indexKey);
         if (existingTokenHash) {
             await this.redis.del('sess:' + existingTokenHash);
             this.emit('sessionInvalidated', { userId });
         }
 
         const token = crypto.randomBytes(48).toString('hex');
         const tokenHash = this.hashToken(token);
         const now = new Date();
         const expiresAt = new Date(now.getTime() + MAX_AGE_MS);
 
+        // Atomic multi: store session data + user-to-session index with shared TTL
         const multi = this.redis.multi();
         multi.set(
             'sess:' + tokenHash,
             JSON.stringify({ userId, createdAt: now.toISOString(), expiresAt: expiresAt.toISOString() }),
             'EX', SESSION_TTL
         );
         multi.set(indexKey, tokenHash, 'EX', SESSION_TTL);
         await multi.exec();
 
         return token;
     }
 
+    /**
+     * Validate a raw session token. Returns userId if valid, null otherwise.
+     * @param {string} token
+     * @returns {Promise<string|null>}
+     */
     async validateSession(token) {
         const tokenHash = this.hashToken(token);
         const data = await this.redis.get('sess:' + tokenHash);
         if (!data) return null;
         try {
             const parsed = JSON.parse(data);
             return parsed.userId;
         } catch (e) {
             return null;
         }
     }
 
+    /**
+     * Delete a session and its user-to-session index. Used on logout.
+     * @param {string} token
+     */
     async deleteSession(token) {
         const tokenHash = this.hashToken(token);
         const data = await this.redis.get('sess:' + tokenHash);
         if (data) {
             try {
                 const parsed = JSON.parse(data);
                 await this.redis.del('sess:user:' + parsed.userId);
             } catch (e) { }
         }
         await this.redis.del('sess:' + tokenHash);
     }
 }
 
 module.exports = { SessionManager, SESSION_COOKIE_NAME };

```


**CC-M-002-003** (services/tick-backend/package.json) - implements CI-M-002-003

**Code:**

```diff
--- a/services/tick-backend/package.json
+++ b/services/tick-backend/package.json
@@ -13,6 +13,12 @@
         "ws-stream": "node server.js"
     },
     "dependencies": {
+        "bcrypt": "^5.1.1",
+        "cookie": "^0.6.0",
+        "cookie-parser": "^1.4.6",
+        "cors": "^2.8.5",
+        "express": "^4.18.2",
+        "ioredis": "^5.3.2",
+        "pg": "^8.11.3",
         "@reiryoku/ctrader-layer": "file:../../libs/cTrader-Layer",
         "blessed": "^0.1.81",
         "blessed-contrib": "^4.11.0",

```

**Documentation:**

```diff
--- a/services/tick-backend/package.json
+++ b/services/tick-backend/package.json
@@ -13,6 +13,7 @@
         "ws-stream": "node server.js"
     },
     "dependencies": {
+        // Auth dependencies: express (HTTP), bcrypt (passwords), pg (PostgreSQL), ioredis (sessions) (ref: DL-002, DL-003, DL-004)
         "bcrypt": "^5.1.1",

```


**CC-M-002-004** (services/tick-backend/middleware.js) - implements CI-M-002-001

**Code:**

```diff
--- a/services/tick-backend/middleware.js
+++ b/services/tick-backend/middleware.js
@@ -0,0 +1,15 @@
+const { SessionManager, SESSION_COOKIE_NAME } = require('./sessionManager');
+
+const sessionManager = new SessionManager();
+
+function errorResponse(res, statusCode, code, message) {
+    return res.status(statusCode).json({ error: { code, message } });
+}
+
+async function requireAuth(req, res, next) {
+    const token = req.cookies[SESSION_COOKIE_NAME];
+    if (!token) return errorResponse(res, 401, 'UNAUTHORIZED', 'Authentication required');
+    const userId = await sessionManager.validateSession(token);
+    if (!userId) return errorResponse(res, 401, 'UNAUTHORIZED', 'Session expired or invalid');
+    req.userId = userId;
+    req.sessionToken = token;
+    next();
+}
+
+module.exports = { errorResponse, requireAuth, sessionManager };

```

**Documentation:**

```diff
--- a/services/tick-backend/middleware.js
+++ b/services/tick-backend/middleware.js
@@ -0,0 +1,19 @@
+/**
+ * Shared middleware and singleton sessionManager instance.
+ * requireAuth validates the neurosense_session cookie and attaches
+ * userId and sessionToken to the request. (ref: DL-005, DL-020)
+ */
 const { SessionManager, SESSION_COOKIE_NAME } = require('./sessionManager');
 
 const sessionManager = new SessionManager();
 
+/** Standardized JSON error envelope: {error: {code, message}} (ref: DL-014) */
 function errorResponse(res, statusCode, code, message) {
     return res.status(statusCode).json({ error: { code, message } });
 }
 
+/**
+ * Authentication middleware. Reads the session cookie, validates it against
+ * Redis, and attaches userId/sessionToken to req. Returns 401 with standard
+ * error envelope if cookie is missing or session is invalid/expired.
+ */
 async function requireAuth(req, res, next) {
     const token = req.cookies[SESSION_COOKIE_NAME];
     if (!token) return errorResponse(res, 401, 'UNAUTHORIZED', 'Authentication required');
     const userId = await sessionManager.validateSession(token);
     if (!userId) return errorResponse(res, 401, 'UNAUTHORIZED', 'Session expired or invalid');
     req.userId = userId;
     req.sessionToken = token;
     next();
 }
 
 module.exports = { errorResponse, requireAuth, sessionManager };

```


**CC-M-002-005** (services/tick-backend/README.md)

**Documentation:**

```diff
--- a/services/tick-backend/README.md
+++ b/services/tick-backend/README.md
@@ -9,6 +9,30 @@
 
 ```
 ┌─────────────────────────────────────────────────────────────┐
+│                     HTTP Layer (Express)                     │
+│  cookieParser → CORS (dev) → Security Headers → Routes       │
+├─────────────────────────────────────────────────────────────┤
+│  /api/register  /api/login  /api/logout  /api/me            │
+│  /api/workspace  /api/drawings/:sym/:res  /api/markers/:sym │
+│  /api/migrate                                             │
+├─────────────────────────────────────────────────────────────┤
+│  middleware.js: requireAuth (session cookie validation)      │
+│  sessionManager.js: Redis-backed session store               │
+│  db.js: PostgreSQL connection pool (raw pg, no ORM)         │
+└─────────────────────────────────────────────────────────────┘
+
+┌─────────────────────────────────────────────────────────────┐
+│                 Authentication & Persistence                  │
+│                                                              │
+│  Session: Redis (30-day TTL, one session per user)          │
+│  User data: PostgreSQL (users, sessions, workspaces,        │
+│             drawings, price_markers — JSONB for payloads)   │
+│  Password: bcrypt 12 rounds (async)                         │
+│  Cookie: neurosense_session (HttpOnly, SameSite-Lax, Secure)│
+│  WebSocket: cookie auth on HTTP upgrade (close 4001)        │
+│                                                              │
+└─────────────────────────────────────────────────────────────┘
+
+```
+
+```
+┌─────────────────────────────────────────────────────────────┐
 │                     WebSocketServer                         │
 │  (206 lines - orchestrator, delegates to sub-managers)        │

```


### Milestone 3: Auth API Endpoints

**Files**: services/tick-backend/authRoutes.js, services/tick-backend/db.js

**Requirements**:

- POST /api/register creates user with bcrypt-hashed password
- POST /api/login validates credentials and creates session
- POST /api/logout deletes session and clears cookie
- GET /api/me returns current user from session cookie
- Rate limiting on login: 10 failures locks for 15 minutes per email
- All endpoints return JSON with appropriate HTTP status codes

**Acceptance Criteria**:

- Register with valid email/password creates user and returns session cookie
- Register with duplicate email returns 409
- Login with correct credentials returns user and session cookie
- Login with wrong password returns 401
- GET /api/me with valid cookie returns user object
- GET /api/me without cookie returns 401
- 10 failed login attempts locks the account for 15 minutes

**Tests**:

- Integration: curl-based test of all auth endpoints with various inputs

#### Code Intent

- **CI-M-003-001** `services/tick-backend/db.js`: PostgreSQL connection pool module using pg driver. Creates pg.Pool with connection config from environment variables (PG_HOST, PG_PORT, PG_DATABASE, PG_USER, PG_PASSWORD). Pool settings: max 10 connections, idle timeout 30s, connection timeout 5s. Exports query(text, params) helper that acquires client, executes query, releases client. Exposes pool for transaction support. Logs connection errors. Runs startup schema migration check (verify auth tables exist). (refs: DL-003, DL-004)
- **CI-M-003-002** `services/tick-backend/authRoutes.js`: Express router with auth endpoints. POST /api/register: validate email format, validate password (min 8 chars, max 72 bytes to prevent bcrypt truncation, reject whitespace-only), sanitize display_name (strip HTML tags, max 128 chars), hash password with async bcrypt 12 rounds, INSERT into users table, log auth event to audit_log (action=register, user_id, details JSONB with email/ip), create session, set cookie, return {user:{id,email,displayName}}. POST /api/login: lookup user by email, verify with async bcrypt.compare, update last_login_at, log auth event to audit_log (action=login, user_id, details with email/ip), create session (invalidates old, triggers sessionInvalidated event), set cookie, return user. POST /api/logout: delete session from Redis, clear cookie, log auth event to audit_log (action=logout, user_id). GET /api/me: authenticate via cookie, return current user. All endpoints return JSON using standard error envelope: {error: {code, message}}. Error responses: 400 (validation), 401 (unauthorized), 409 (email exists), 429 (rate limited), 500 (server error). Rate limiting: dual-layer — application-level track failed login attempts in Redis, lock after 10 failures for 15 minutes per email; Nginx per-IP rate limit on /api/login at 5 req/min. (refs: DL-001, DL-006, DL-008, DL-009, DL-010, DL-015, DL-016, DL-021)

#### Code Changes

**CC-M-003-001** (services/tick-backend/db.js) - implements CI-M-003-001

**Code:**

```diff
--- a/services/tick-backend/db.js
+++ b/services/tick-backend/db.js
@@ -0,0 +1,41 @@
+const { Pool } = require('pg');
+
+const pool = new Pool({
+    host: process.env.PG_HOST || 'localhost',
+    port: parseInt(process.env.PG_PORT || '5432', 10),
+    database: process.env.PG_DATABASE || 'neurosensefx',
+    user: process.env.PG_USER || 'neurosensefx',
+    password: process.env.PG_PASSWORD || '',
+    max: 10,
+    idleTimeoutMillis: 30000,
+    connectionTimeoutMillis: 5000
+});
+
+pool.on('error', (err) => {
+    console.error('[DB] Unexpected pool error:', err.message);
+});
+
+async function query(text, params) {
+    const client = await pool.connect();
+    try {
+        const result = await client.query(text, params);
+        return result;
+    } finally {
+        client.release();
+    }
+}
+
+async function verifySchema() {
+    try {
+        const result = await query(
+            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users','sessions','workspaces','drawings','price_markers')"
+        );
+        const tables = result.rows.map(r => r.table_name);
+        if (tables.length === 5) {
+            console.log('[DB] Auth schema verified (5 tables found)');
+        } else {
+            console.warn('[DB] Auth schema incomplete: found ' + tables.length + '/5 tables: ' + tables.join(', '));
+        }
+    } catch (err) {
+        console.error('[DB] Schema verification failed:', err.message);
+    }
+}
+
+module.exports = { query, pool, verifySchema };

```

**Documentation:**

```diff
--- a/services/tick-backend/db.js
+++ b/services/tick-backend/db.js
@@ -0,0 +1,45 @@
+/**
+ * PostgreSQL connection pool and query helper. Raw pg driver, no ORM (ref: DL-004).
+ * verifySchema confirms all 5 auth tables exist on startup.
+ */
 const { Pool } = require('pg');
 
 const pool = new Pool({
     host: process.env.PG_HOST || 'localhost',
     port: parseInt(process.env.PG_PORT || '5432', 10),
     database: process.env.PG_DATABASE || 'neurosensefx',
     user: process.env.PG_USER || 'neurosensefx',
     password: process.env.PG_PASSWORD || '',
     max: 10,
     idleTimeoutMillis: 30000,
     connectionTimeoutMillis: 5000
 });
 
 pool.on('error', (err) => {
     console.error('[DB] Unexpected pool error:', err.message);
 });
 
+/**
+ * Execute a parameterized query using a checked-out client.
+ * Client is released in a finally block to prevent pool leaks.
+ * @param {string} text - SQL query with $1, $2 placeholders
+ * @param {any[]} params
+ * @returns {Promise<import('pg').QueryResult>}
+ */
 async function query(text, params) {
     const client = await pool.connect();
     try {
         const result = await client.query(text, params);
         return result;
     } finally {
         client.release();
     }
 }
 
+/**
+ * Verify that all 5 auth tables exist in the public schema.
+ * Called on server startup. Logs warning if schema is incomplete.
+ */
 async function verifySchema() {
     try {
         const result = await query(
             "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users','sessions','workspaces','drawings','price_markers')"
         );
         const tables = result.rows.map(r => r.table_name);
         if (tables.length === 5) {
             console.log('[DB] Auth schema verified (5 tables found)');
         } else {
             console.warn('[DB] Auth schema incomplete: found ' + tables.length + '/5 tables: ' + tables.join(', '));
         }
     } catch (err) {
         console.error('[DB] Schema verification failed:', err.message);
     }
 }
 
 module.exports = { query, pool, verifySchema };

```


**CC-M-003-002** (services/tick-backend/authRoutes.js) - implements CI-M-003-002

**Code:**

```diff
--- a/services/tick-backend/authRoutes.js
+++ b/services/tick-backend/authRoutes.js
@@ -0,0 +1,184 @@
+const express = require('express');
+const bcrypt = require('bcrypt');
+const { query } = require('./db');
+const { errorResponse, requireAuth, sessionManager, SESSION_COOKIE_NAME } = require('./middleware');
+
+const router = express.Router();
+const BCRYPT_ROUNDS = 12;
+const LOGIN_LOCKOUT_THRESHOLD = 10;
+const LOGIN_LOCKOUT_DURATION = 15 * 60;
+
+function isValidEmail(email) {
+    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
+}
+
+function isValidPassword(password) {
+    if (typeof password !== 'string') return false;
+    if (password.length < 8) return false;
+    if (Buffer.byteLength(password, 'utf8') > 72) return false;
+    if (password.trim().length === 0) return false;
+    return true;
+}
+
+function sanitizeDisplayName(name) {
+    if (!name) return null;
+    return name.replace(/<[^>]*>/g, '').slice(0, 128).trim() || null;
+}
+
+async function isEmailLocked(email) {
+    const key = 'login_lockout:' + email;
+    const attempts = await sessionManager.redis.get(key);
+    return parseInt(attempts, 10) >= LOGIN_LOCKOUT_THRESHOLD;
+}
+
+async function recordFailedLogin(email) {
+    const key = 'login_lockout:' + email;
+    const current = await sessionManager.redis.incr(key);
+    if (current === 1) {
+        await sessionManager.redis.expire(key, LOGIN_LOCKOUT_DURATION);
+    }
+}
+
+async function clearLoginAttempts(email) {
+    await sessionManager.redis.del('login_lockout:' + email);
+}
+
+async function logAuthEvent(action, userId, details) {
+    try {
+        await query(
+            'INSERT INTO audit_log (action, user_id, details) VALUES ($1, $2, $3)',
+            [action, userId, JSON.stringify(details)]
+        );
+    } catch (err) {
+        console.error('[Auth] Audit log failed:', err.message);
+    }
+}
+
+router.post('/api/register', async (req, res) => {
+    const { email, password, display_name } = req.body;
+
+    if (!email || !password) {
+        return errorResponse(res, 400, 'VALIDATION_ERROR', 'Email and password are required');
+    }
+    if (!isValidEmail(email)) {
+        return errorResponse(res, 400, 'VALIDATION_ERROR', 'Invalid email format');
+    }
+    if (!isValidPassword(password)) {
+        return errorResponse(res, 400, 'VALIDATION_ERROR', 'Password must be 8-72 characters and not whitespace-only');
+    }
+
+    const displayName = sanitizeDisplayName(display_name);
+
+    try {
+        const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
+        if (existing.rows.length > 0) {
+            return errorResponse(res, 409, 'EMAIL_EXISTS', 'An account with this email already exists');
+        }
+
+        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
+        const result = await query(
+            'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, email, display_name',
+            [email, passwordHash, displayName]
+        );
+
+        const user = result.rows[0];
+        await logAuthEvent('register', user.id, { email: email, ip: req.ip, userAgent: req.get('User-Agent') });
+
+        const token = await sessionManager.createSession(user.id, req.ip, req.get('User-Agent'));
+        res.cookie(SESSION_COOKIE_NAME, token, sessionManager.cookieOptions);
+
+        res.status(201).json({ user: { id: user.id, email: user.email, displayName: user.display_name } });
+    } catch (err) {
+        console.error('[Auth] Register error:', err.message);
+        errorResponse(res, 500, 'SERVER_ERROR', 'Registration failed');
+    }
+});
+
+router.post('/api/login', async (req, res) => {
+    const { email, password } = req.body;
+
+    if (!email || !password) {
+        return errorResponse(res, 400, 'VALIDATION_ERROR', 'Email and password are required');
+    }
+
+    const locked = await isEmailLocked(email);
+    if (locked) {
+        return errorResponse(res, 429, 'RATE_LIMITED', 'Too many failed login attempts. Try again later.');
+    }
+
+    try {
+        const result = await query('SELECT id, email, password_hash, display_name FROM users WHERE email = $1', [email]);
+        if (result.rows.length === 0) {
+            await recordFailedLogin(email);
+            return errorResponse(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
+        }
+
+        const user = result.rows[0];
+        const valid = await bcrypt.compare(password, user.password_hash);
+        if (!valid) {
+            await recordFailedLogin(email);
+            return errorResponse(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
+        }
+
+        await clearLoginAttempts(email);
+        await query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
+        await logAuthEvent('login', user.id, { email: email, ip: req.ip, userAgent: req.get('User-Agent') });
+
+        const token = await sessionManager.createSession(user.id, req.ip, req.get('User-Agent'));
+        res.cookie(SESSION_COOKIE_NAME, token, sessionManager.cookieOptions);
+
+        res.json({ user: { id: user.id, email: user.email, displayName: user.display_name } });
+    } catch (err) {
+        console.error('[Auth] Login error:', err.message);
+        errorResponse(res, 500, 'SERVER_ERROR', 'Login failed');
+    }
+});
+
+router.post('/api/logout', requireAuth, async (req, res) => {
+    await sessionManager.deleteSession(req.sessionToken);
+    await logAuthEvent('logout', req.userId, { ip: req.ip, userAgent: req.get('User-Agent') });
+    res.clearCookie(SESSION_COOKIE_NAME, sessionManager.cookieOptions);
+    res.json({ success: true });
+});
+
+router.get('/api/me', requireAuth, async (req, res) => {
+    try {
+        const result = await query('SELECT id, email, display_name, created_at FROM users WHERE id = $1', [req.userId]);
+        if (result.rows.length === 0) {
+            return errorResponse(res, 401, 'UNAUTHORIZED', 'User not found');
+        }
+        const user = result.rows[0];
+        res.json({ user: { id: user.id, email: user.email, displayName: user.display_name } });
+    } catch (err) {
+        console.error('[Auth] GET /api/me error:', err.message);
+        errorResponse(res, 500, 'SERVER_ERROR', 'Failed to fetch user');
+    }
+});
+
+module.exports = { authRoutes: router };

```

**Documentation:**

```diff
--- a/services/tick-backend/authRoutes.js
+++ b/services/tick-backend/authRoutes.js
@@ -0,0 +1,190 @@
+/**
+ * Auth API routes: register, login, logout, GET /api/me.
+ * Password hashing uses bcrypt 12 rounds in async mode (ref: DL-008, DL-021).
+ * Rate limiting: application-level per-email lockout (10 failures / 15 min) (ref: DL-009).
+ * Audit events logged to audit_log table (ref: DL-012, DL-015).
+ */
 const express = require('express');
 const bcrypt = require('bcrypt');
 const { query } = require('./db');
 const { errorResponse, requireAuth, sessionManager, SESSION_COOKIE_NAME } = require('./middleware');
 
 const router = express.Router();
 const BCRYPT_ROUNDS = 12;
 const LOGIN_LOCKOUT_THRESHOLD = 10;
+// 15-minute lockout window after threshold exceeded (ref: DL-009)
 const LOGIN_LOCKOUT_DURATION = 15 * 60;
 
+/** Email format validation: basic structure check only. */
 function isValidEmail(email) {
     return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
 }
 
+/**
+ * Password validation: 8-72 bytes, reject whitespace-only (ref: DL-010).
+ * Max 72 bytes prevents silent bcrypt truncation attack.
+ */
 function isValidPassword(password) {
     if (typeof password !== 'string') return false;
     if (password.length < 8) return false;
     if (Buffer.byteLength(password, 'utf8') > 72) return false;
     if (password.trim().length === 0) return false;
     return true;
 }
 
+/** Strip HTML tags and enforce max 128 chars to prevent stored XSS (ref: DL-016). */
 function sanitizeDisplayName(name) {
     if (!name) return null;
     return name.replace(/<[^>]*>/g, '').slice(0, 128).trim() || null;
 }
 
+/** Check if email is locked out due to too many failed login attempts (ref: DL-009). */
 async function isEmailLocked(email) {
     const key = 'login_lockout:' + email;
     const attempts = await sessionManager.redis.get(key);
     return parseInt(attempts, 10) >= LOGIN_LOCKOUT_THRESHOLD;
 }
 
+/** Record a failed login attempt. Sets TTL on first failure for auto-expiry. */
 async function recordFailedLogin(email) {
     const key = 'login_lockout:' + email;
     const current = await sessionManager.redis.incr(key);
     if (current === 1) {
         await sessionManager.redis.expire(key, LOGIN_LOCKOUT_DURATION);
     }
 }
 
+/** Clear failed login counter on successful authentication. */
 async function clearLoginAttempts(email) {
     await sessionManager.redis.del('login_lockout:' + email);
 }
 
+/** Log an auth event to the audit_log table. Non-blocking: errors are logged but not thrown (ref: DL-012, DL-015). */
 async function logAuthEvent(action, userId, details) {
     try {
         await query(
             'INSERT INTO audit_log (action, user_id, details) VALUES ($1, $2, $3)',
             [action, userId, JSON.stringify(details)]
         );
     } catch (err) {
         console.error('[Auth] Audit log failed:', err.message);
     }
 }
 
+/** POST /api/register — create account and auto-login. Returns user object. */
 router.post('/api/register', async (req, res) => {
     const { email, password, display_name } = req.body;
 
     if (!email || !password) {
         return errorResponse(res, 400, 'VALIDATION_ERROR', 'Email and password are required');
     }
     if (!isValidEmail(email)) {
         return errorResponse(res, 400, 'VALIDATION_ERROR', 'Invalid email format');
     }
     if (!isValidPassword(password)) {
         return errorResponse(res, 400, 'VALIDATION_ERROR', 'Password must be 8-72 characters and not whitespace-only');
     }
 
     const displayName = sanitizeDisplayName(display_name);
 
     try {
         const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
         if (existing.rows.length > 0) {
             return errorResponse(res, 409, 'EMAIL_EXISTS', 'An account with this email already exists');
         }
 
+        // Async bcrypt to avoid blocking the event loop during hash (ref: DL-021)
         const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
         const result = await query(
             'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, email, display_name',
             [email, passwordHash, displayName]
         );
 
         const user = result.rows[0];
         await logAuthEvent('register', user.id, { email: email, ip: req.ip, userAgent: req.get('User-Agent') });
 
         const token = await sessionManager.createSession(user.id, req.ip, req.get('User-Agent'));
         res.cookie(SESSION_COOKIE_NAME, token, sessionManager.cookieOptions);
 
         res.status(201).json({ user: { id: user.id, email: user.email, displayName: user.display_name } });
     } catch (err) {
         console.error('[Auth] Register error:', err.message);
         errorResponse(res, 500, 'SERVER_ERROR', 'Registration failed');
     }
 });
 
+/** POST /api/login — authenticate and create session. Rate limited per email. */
 router.post('/api/login', async (req, res) => {
     const { email, password } = req.body;
 
     if (!email || !password) {
         return errorResponse(res, 400, 'VALIDATION_ERROR', 'Email and password are required');
     }
 
+    // Dual-layer rate limit: application-level per-email check (ref: DL-009)
     const locked = await isEmailLocked(email);
     if (locked) {
         return errorResponse(res, 429, 'RATE_LIMITED', 'Too many failed login attempts. Try again later.');
     }
 
     try {
         const result = await query('SELECT id, email, password_hash, display_name FROM users WHERE email = $1', [email]);
         if (result.rows.length === 0) {
             await recordFailedLogin(email);
             return errorResponse(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
         }
 
         const user = result.rows[0];
+        // Async bcrypt.compare to avoid blocking event loop (ref: DL-021)
         const valid = await bcrypt.compare(password, user.password_hash);
         if (!valid) {
             await recordFailedLogin(email);
             return errorResponse(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
         }
 
         await clearLoginAttempts(email);
         await query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
         await logAuthEvent('login', user.id, { email: email, ip: req.ip, userAgent: req.get('User-Agent') });
 
         const token = await sessionManager.createSession(user.id, req.ip, req.get('User-Agent'));
         res.cookie(SESSION_COOKIE_NAME, token, sessionManager.cookieOptions);
 
         res.json({ user: { id: user.id, email: user.email, displayName: user.display_name } });
     } catch (err) {
         console.error('[Auth] Login error:', err.message);
         errorResponse(res, 500, 'SERVER_ERROR', 'Login failed');
     }
 });
 
+/** POST /api/logout — delete session and clear cookie. Requires auth. */
 router.post('/api/logout', requireAuth, async (req, res) => {
     await sessionManager.deleteSession(req.sessionToken);
     await logAuthEvent('logout', req.userId, { ip: req.ip, userAgent: req.get('User-Agent') });
     res.clearCookie(SESSION_COOKIE_NAME, sessionManager.cookieOptions);
     res.json({ success: true });
 });
 
+/** GET /api/me — return current user info. Requires auth. */
 router.get('/api/me', requireAuth, async (req, res) => {
     try {
         const result = await query('SELECT id, email, display_name, created_at FROM users WHERE id = $1', [req.userId]);
         if (result.rows.length === 0) {
             return errorResponse(res, 401, 'UNAUTHORIZED', 'User not found');
         }
         const user = result.rows[0];
         res.json({ user: { id: user.id, email: user.email, displayName: user.display_name } });
     } catch (err) {
         console.error('[Auth] GET /api/me error:', err.message);
         errorResponse(res, 500, 'SERVER_ERROR', 'Failed to fetch user');
     }
 });
 
 module.exports = { authRoutes: router };

```


### Milestone 4: WebSocket Cookie Authentication

**Files**: services/tick-backend/WebSocketServer.js, services/tick-backend/server.js

**Requirements**:

- WebSocket connection validates session cookie on upgrade request
- Invalid or missing session cookie results in close code 4001
- Valid session attaches ws.userId to WebSocket object
- Existing WebSocket message handling unchanged (market data remains shared)
- Backend server.js uses shared HTTP server between Express and ws

**Acceptance Criteria**:

- WebSocket connection without cookie is rejected with close code 4001
- WebSocket connection with valid session cookie succeeds and has ws.userId
- Existing market data subscription and message handling works unchanged
- Reconnection with valid cookie succeeds transparently

**Tests**:

- Integration: wscat connects with/without cookie, verifies accept/reject behavior

#### Code Intent

- **CI-M-004-001** `services/tick-backend/WebSocketServer.js`: Modify constructor to accept an existing HTTP server instead of creating its own. Change wss.on(connection) handler to accept (ws, req) parameters. Add cookie validation in the connection handler: parse cookie header, extract neurosense_session, validate via sessionManager.validateSession(). If invalid, close with code 4001 and reason Unauthorized. If valid, attach ws.userId from session. Add userId-to-WebSocket registry (Map): on connect, store ws by userId; on disconnect, remove. Listen for sessionManager sessionInvalidated event and close(4001) the old WebSocket connection for that userId. Pass ws to handleConnection as before. The constructor signature changes from (port, ...) to (server, ...) where server is the HTTP server from Express. Add sessionManager import from middleware.js (not authRoutes.js, to avoid circular dependency). (refs: DL-005, DL-002, DL-023)
- **CI-M-004-002** `services/tick-backend/server.js`: Replace direct WebSocketServer(port, ...) instantiation with the new flow: import httpServer (Express app + HTTP server), then pass the HTTP server to WebSocketServer constructor. Remove port parameter from WebSocketServer instantiation. The httpServer.listen() call replaces the implicit server creation inside WebSocketServer. Environment variable WS_PORT still controls the listening port. (refs: DL-002, DL-005)

#### Code Changes

**CC-M-004-001** (services/tick-backend/WebSocketServer.js) - implements CI-M-004-001

**Code:**

```diff
--- a/services/tick-backend/WebSocketServer.js
+++ b/services/tick-backend/WebSocketServer.js
@@ -1,5 +1,7 @@
 const WebSocket = require('ws');
+const cookie = require('cookie');
+const { sessionManager, SESSION_COOKIE_NAME } = require('./middleware');
 const { DataRouter } = require('./DataRouter');
 const { MarketProfileService } = require('./MarketProfileService');
 const { TwapService } = require('./TwapService');
@@ -17,11 +19,24 @@ const RESOLUTION_TO_PERIOD = {
 
 class WebSocketServer {
-    constructor(port, cTraderSession, tradingViewSession, twapService = null, marketProfileService = null) {
-        this.wss = new WebSocket.Server({ port });
+    constructor(server, cTraderSession, tradingViewSession, twapService = null, marketProfileService = null) {
+        this.wss = new WebSocket.Server({ server });
         this.cTraderSession = cTraderSession;
         this.tradingViewSession = tradingViewSession;
 
+        this.wsByUserId = new Map();
+
+        sessionManager.on('sessionInvalidated', ({ userId }) => {
+            const oldWs = this.wsByUserId.get(userId);
+            if (oldWs && oldWs.readyState === WebSocket.OPEN) {
+                oldWs.close(4001, 'Session invalidated by new login');
+            }
+        });
+
         // Initialize sub-managers
         this.subscriptionManager = new SubscriptionManager();
         this.requestCoordinator = new RequestCoordinator(this);
@@ -30,7 +45,7 @@ class WebSocketServer {
         this.marketProfileService = marketProfileService || new MarketProfileService();
         this.twapService = twapService || new TwapService();
 
-        this.wss.on('connection', (ws) => this.handleConnection(ws));
+        this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
 
         this.cTraderSession.on('tick', (tick) => this.dataRouter.routeFromCTrader(tick));
         this.cTraderSession.on('connected', (symbols) => {
@@ -214,7 +229,28 @@ class WebSocketServer {
         }
     }
 
-    handleConnection(ws) {
-        console.log('Client connected');
+    handleConnection(ws, req) {
+        const cookieHeader = req.headers.cookie || '';
+        const parsed = cookie.parse(cookieHeader);
+        const sessionToken = parsed[SESSION_COOKIE_NAME];
+
+        if (!sessionToken) {
+            ws.close(4001, 'No session cookie');
+            return;
+        }
+
+        sessionManager.validateSession(sessionToken).then(userId => {
+            if (!userId) {
+                ws.close(4001, 'Invalid session');
+                return;
+            }
+            ws.userId = userId;
+            this.wsByUserId.set(userId, ws);
+            console.log('Client connected (userId=' + userId + ')');
+            this.attachConnectionHandlers(ws);
+        }).catch(() => {
+            ws.close(4001, 'Session validation failed');
+        });
+    }
+
+    attachConnectionHandlers(ws) {
         ws.on('message', (message) => this.handleMessage(ws, message));
         ws.on('close', () => this.handleClose(ws));
         ws.on('error', (error) => console.error('Client WebSocket error:', error));
+        this.statusBroadcaster.sendInitialStatus(ws);
@@ -559,6 +595,12 @@ class WebSocketServer {
     handleClose(ws) {
         console.log('Client disconnected');
+        if (ws.userId) {
+            const existing = this.wsByUserId.get(ws.userId);
+            if (existing === ws) {
+                this.wsByUserId.delete(ws.userId);
+            }
+        }
+
         const subscriptions = this.subscriptionManager.removeClient(ws);

```

**Documentation:**

```diff
--- a/services/tick-backend/WebSocketServer.js
+++ b/services/tick-backend/WebSocketServer.js
@@ -1,5 +1,7 @@
 const WebSocket = require('ws');
 const cookie = require('cookie');
 const { sessionManager, SESSION_COOKIE_NAME } = require('./middleware');
 const { DataRouter } = require('./DataRouter');
@@ -17,11 +19,24 @@
 const RESOLUTION_TO_PERIOD = {
 
 class WebSocketServer {
+    // Constructor receives an http.Server instead of a port number (ref: DL-002).
+    // The ws.Server attaches to the same HTTP server that Express uses.
     constructor(server, cTraderSession, tradingViewSession, twapService = null, marketProfileService = null) {
         this.wss = new WebSocket.Server({ server });
         this.cTraderSession = cTraderSession;
         this.tradingViewSession = tradingViewSession;
 
+        // Registry of active WebSocket connections by userId.
+        // Used to close old connections when a new login invalidates the session (ref: DL-023).
         this.wsByUserId = new Map();
 
+        // When a session is invalidated (new login from another device),
+        // close the old WebSocket connection with code 4001 (ref: DL-006, DL-023).
         sessionManager.on('sessionInvalidated', ({ userId }) => {
             const oldWs = this.wsByUserId.get(userId);
             if (oldWs && oldWs.readyState === WebSocket.OPEN) {
                 oldWs.close(4001, 'Session invalidated by new login');
             }
         });
 
         // Initialize sub-managers
         this.subscriptionManager = new SubscriptionManager();
         this.requestCoordinator = new RequestCoordinator(this);
@@ -30,7 +45,7 @@
         this.marketProfileService = marketProfileService || new MarketProfileService();
         this.twapService = twapService || new TwapService();
 
+        // Connection handler receives the HTTP upgrade request for cookie parsing (ref: DL-005).
         this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
 
         this.cTraderSession.on('tick', (tick) => this.dataRouter.routeFromCTrader(tick));
         this.cTraderSession.on('connected', (symbols) => {
@@ -214,7 +229,28 @@
         }
     }
 
+    /**
+     * Authenticate the WebSocket upgrade request via session cookie.
+     * Rejects unauthenticated connections immediately with close code 4001 (ref: DL-005).
+     * No unauthenticated window — unlike first-message auth which allows resource occupation (ref: RA-003).
+     */
     handleConnection(ws, req) {
         const cookieHeader = req.headers.cookie || '';
         const parsed = cookie.parse(cookieHeader);
         const sessionToken = parsed[SESSION_COOKIE_NAME];
 
         if (!sessionToken) {
             ws.close(4001, 'No session cookie');
             return;
         }
 
+        // Session validation is async; handlers are attached only after auth succeeds.
+        // This prevents unauthenticated sockets from receiving any market data (ref: DL-005).
         sessionManager.validateSession(sessionToken).then(userId => {
             if (!userId) {
                 ws.close(4001, 'Invalid session');
                 return;
             }
             ws.userId = userId;
             this.wsByUserId.set(userId, ws);
             console.log('Client connected (userId=' + userId + ')');
             this.attachConnectionHandlers(ws);
         }).catch(() => {
             ws.close(4001, 'Session validation failed');
         });
     }
 
+    /** Attach message/close/error handlers after successful authentication. */
     attachConnectionHandlers(ws) {
         ws.on('message', (message) => this.handleMessage(ws, message));
         ws.on('close', () => this.handleClose(ws));
         ws.on('error', (error) => console.error('Client WebSocket error:', error));
         this.statusBroadcaster.sendInitialStatus(ws);
@@ -559,6 +595,12 @@
     handleClose(ws) {
         console.log('Client disconnected');
+        // Clean up userId registry on disconnect. Only delete if this is the
+        // current connection for the user (avoids deleting a newer connection) (ref: DL-023).
         if (ws.userId) {
             const existing = this.wsByUserId.get(ws.userId);
             if (existing === ws) {
                 this.wsByUserId.delete(ws.userId);
             }
         }
 
         const subscriptions = this.subscriptionManager.removeClient(ws);

```


**CC-M-004-002** (services/tick-backend/server.js) - implements CI-M-004-002

**Code:**

```diff
--- a/services/tick-backend/server.js
+++ b/services/tick-backend/server.js
@@ -7,6 +7,8 @@ const { CTraderSession } = require('./CTraderSession');
 const { TradingViewSession } = require('./TradingViewSession');
 const { WebSocketServer } = require('./WebSocketServer');
+const { listen: listenHttp, server: httpServer } = require('./httpServer');
+const { verifySchema } = require('./db');
 
 // Create services first (needed by WebSocketServer and TradingViewSession)
 const { TwapService } = require('./TwapService');
@@ -28,9 +30,12 @@ console.log('WebSocket URL: ws://localhost:' + port);
 console.log('TradingView Session: ' + (tradingViewSessionId ? 'authenticated' : 'unauthenticated (limited)'));
 
 const session = new CTraderSession();
 const tradingViewSession = new TradingViewSession(twapService, marketProfileService);
-const wsServer = new WebSocketServer(port, session, tradingViewSession, twapService, marketProfileService);
+const wsServer = new WebSocketServer(httpServer, session, tradingViewSession, twapService, marketProfileService);
 
+listenHttp(port);
+verifySchema().catch(err => console.error('[DB] Schema verification failed on startup:', err.message));
+
 // Global error handlers to prevent crashes on connection interrupt
 process.on('uncaughtException', (error) => {
     console.error('[FATAL] Uncaught exception:', error.message);

```

**Documentation:**

```diff
--- a/services/tick-backend/server.js
+++ b/services/tick-backend/server.js
@@ -7,6 +7,8 @@
 const { CTraderSession } = require('./CTraderSession');
 const { TradingViewSession } = require('./TradingViewSession');
 const { WebSocketServer } = require('./WebSocketServer');
+const { listen: listenHttp, server: httpServer } = require('./httpServer');
+const { verifySchema } = require('./db');
 
 // Create services first (needed by WebSocketServer and TradingViewSession)
 const { TwapService } = require('./TwapService');
@@ -28,9 +30,12 @@
 console.log('WebSocket URL: ws://localhost:' + port);
 console.log('TradingView Session: ' + (tradingViewSessionId ? 'authenticated' : 'unauthenticated (limited)'));
 
 const session = new CTraderSession();
 const tradingViewSession = new TradingViewSession(twapService, marketProfileService);
+// WebSocketServer receives the shared http.Server instead of a port (ref: DL-002).
+// Express and ws share the same HTTP server; cookies are sent on WS upgrade.
 const wsServer = new WebSocketServer(httpServer, session, tradingViewSession, twapService, marketProfileService);
 
+// Start Express HTTP server and verify PostgreSQL auth schema on startup (ref: DL-002, DL-004)
 listenHttp(port);
 verifySchema().catch(err => console.error('[DB] Schema verification failed on startup:', err.message));
 
 // Global error handlers to prevent crashes on connection interrupt
 process.on('uncaughtException', (error) => {
     console.error('[FATAL] Uncaught exception:', error.message);

```


### Milestone 5: Persistence API Endpoints

**Files**: services/tick-backend/persistenceRoutes.js

**Requirements**:

- PUT /api/workspace saves workspace layout JSONB for authenticated user
- GET /api/workspace loads workspace layout for authenticated user
- PUT /api/drawings/:symbol/:resolution saves drawings JSONB array
- GET /api/drawings/:symbol/:resolution loads drawings for user+symbol+resolution
- PUT /api/markers/:symbol saves price markers JSONB array
- GET /api/markers/:symbol loads markers for user+symbol
- POST /api/migrate accepts bulk data upload for first-login migration
- All endpoints require authentication, return 401 without valid session
- Upsert behavior: INSERT ON CONFLICT DO UPDATE

**Acceptance Criteria**:

- PUT then GET /api/workspace returns same data
- PUT then GET /api/drawings/EURUSD/4h returns same drawings array
- PUT then GET /api/markers/EURUSD returns same markers array
- POST /api/migrate with workspace+drawings+markers saves all data
- Unauthenticated request to any endpoint returns 401
- User A cannot access User B's data

**Tests**:

- Integration: curl-based CRUD test of all persistence endpoints per user

#### Code Intent

- **CI-M-005-001** `services/tick-backend/persistenceRoutes.js`: Express router with persistence endpoints. All endpoints require authentication (validate session cookie middleware). PUT /api/workspace: upsert workspace layout JSONB for authenticated user. GET /api/workspace: load workspace layout for authenticated user. PUT /api/drawings/:symbol/:resolution: upsert drawings JSONB array for user+symbol+resolution. GET /api/drawings/:symbol/:resolution: load drawings for user+symbol+resolution. PUT /api/markers/:symbol: upsert price markers JSONB array for user+symbol. GET /api/markers/:symbol: load markers for user+symbol. POST /api/migrate: bulk upload endpoint for data migration (accepts workspace, drawings array, markers array in one request). Migrate uses PostgreSQL transaction (BEGIN/COMMIT/ROLLBACK) — all inserts succeed or all roll back. All use the db.query() helper with parameterized SQL. Upserts use INSERT ... ON CONFLICT ... DO UPDATE. Returns 200 with saved data confirmation. All errors use standard envelope: {error: {code, message}}. (refs: DL-003, DL-004, DL-007, DL-014, DL-022)

#### Code Changes

**CC-M-005-001** (services/tick-backend/persistenceRoutes.js) - implements CI-M-005-001

**Code:**

```diff
--- a/services/tick-backend/persistenceRoutes.js
+++ b/services/tick-backend/persistenceRoutes.js
@@ -0,0 +1,146 @@
+const express = require('express');
+const { query, pool } = require('./db');
+const { requireAuth, errorResponse } = require('./middleware');
+
+const router = express.Router();
+
+router.use(requireAuth);
+
+router.put('/api/workspace', async (req, res) => {
+    try {
+        await query(
+            'INSERT INTO workspaces (user_id, layout, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (user_id) DO UPDATE SET layout = $2, updated_at = CURRENT_TIMESTAMP',
+            [req.userId, JSON.stringify(req.body)]
+        );
+        res.json({ success: true });
+    } catch (err) {
+        console.error('[Persistence] PUT /api/workspace error:', err.message);
+        errorResponse(res, 500, 'SERVER_ERROR', 'Failed to save workspace');
+    }
+});
+
+router.get('/api/workspace', async (req, res) => {
+    try {
+        const result = await query('SELECT layout FROM workspaces WHERE user_id = $1', [req.userId]);
+        if (result.rows.length === 0) {
+            return res.json({ layout: null });
+        }
+        res.json({ layout: result.rows[0].layout });
+    } catch (err) {
+        console.error('[Persistence] GET /api/workspace error:', err.message);
+        errorResponse(res, 500, 'SERVER_ERROR', 'Failed to load workspace');
+    }
+});
+
+router.put('/api/drawings/:symbol/:resolution', async (req, res) => {
+    const { symbol, resolution } = req.params;
+    try {
+        await query(
+            'INSERT INTO drawings (user_id, symbol, resolution, data, updated_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) ON CONFLICT (user_id, symbol, resolution) DO UPDATE SET data = $4, updated_at = CURRENT_TIMESTAMP',
+            [req.userId, symbol.toUpperCase(), resolution, JSON.stringify(req.body)]
+        );
+        res.json({ success: true });
+    } catch (err) {
+        console.error('[Persistence] PUT /api/drawings error:', err.message);
+        errorResponse(res, 500, 'SERVER_ERROR', 'Failed to save drawings');
+    }
+});
+
+router.get('/api/drawings/:symbol/:resolution', async (req, res) => {
+    const { symbol, resolution } = req.params;
+    try {
+        const result = await query(
+            'SELECT data FROM drawings WHERE user_id = $1 AND symbol = $2 AND resolution = $3',
+            [req.userId, symbol.toUpperCase(), resolution]
+        );
+        if (result.rows.length === 0) {
+            return res.json({ data: null });
+        }
+        res.json({ data: result.rows[0].data });
+    } catch (err) {
+        console.error('[Persistence] GET /api/drawings error:', err.message);
+        errorResponse(res, 500, 'SERVER_ERROR', 'Failed to load drawings');
+    }
+});
+
+router.put('/api/markers/:symbol', async (req, res) => {
+    const { symbol } = req.params;
+    try {
+        await query(
+            'INSERT INTO price_markers (user_id, symbol, data, updated_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) ON CONFLICT (user_id, symbol) DO UPDATE SET data = $3, updated_at = CURRENT_TIMESTAMP',
+            [req.userId, symbol.toUpperCase(), JSON.stringify(req.body)]
+        );
+        res.json({ success: true });
+    } catch (err) {
+        console.error('[Persistence] PUT /api/markers error:', err.message);
+        errorResponse(res, 500, 'SERVER_ERROR', 'Failed to save markers');
+    }
+});
+
+router.get('/api/markers/:symbol', async (req, res) => {
+    const { symbol } = req.params;
+    try {
+        const result = await query(
+            'SELECT data FROM price_markers WHERE user_id = $1 AND symbol = $2',
+            [req.userId, symbol.toUpperCase()]
+        );
+        if (result.rows.length === 0) {
+            return res.json({ data: null });
+        }
+        res.json({ data: result.rows[0].data });
+    } catch (err) {
+        console.error('[Persistence] GET /api/markers error:', err.message);
+        errorResponse(res, 500, 'SERVER_ERROR', 'Failed to load markers');
+    }
+});
+
+router.post('/api/migrate', async (req, res) => {
+    const { workspace, drawings, markers } = req.body;
+    const client = await pool.connect();
+    try {
+        await client.query('BEGIN');
+
+        if (workspace) {
+            await client.query(
+                'INSERT INTO workspaces (user_id, layout, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (user_id) DO UPDATE SET layout = $2, updated_at = CURRENT_TIMESTAMP',
+                [req.userId, JSON.stringify(workspace)]
+            );
+        }
+
+        if (drawings && Array.isArray(drawings)) {
+            for (const d of drawings) {
+                await client.query(
+                    'INSERT INTO drawings (user_id, symbol, resolution, data, updated_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) ON CONFLICT (user_id, symbol, resolution) DO UPDATE SET data = $4, updated_at = CURRENT_TIMESTAMP',
+                    [req.userId, d.symbol.toUpperCase(), d.resolution, JSON.stringify(d.data)]
+                );
+            }
+        }
+
+        if (markers && Array.isArray(markers)) {
+            for (const m of markers) {
+                await client.query(
+                    'INSERT INTO price_markers (user_id, symbol, data, updated_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) ON CONFLICT (user_id, symbol) DO UPDATE SET data = $3, updated_at = CURRENT_TIMESTAMP',
+                    [req.userId, m.symbol.toUpperCase(), JSON.stringify(m.data)]
+                );
+            }
+        }
+
+        await client.query('COMMIT');
+        res.json({ success: true });
+    } catch (err) {
+        await client.query('ROLLBACK');
+        console.error('[Persistence] Migration failed, rolled back:', err.message);
+        errorResponse(res, 500, 'SERVER_ERROR', 'Data migration failed');
+    } finally {
+        client.release();
+    }
+});
+
+module.exports = { persistenceRoutes: router };

```

**Documentation:**

```diff
--- a/services/tick-backend/persistenceRoutes.js
+++ b/services/tick-backend/persistenceRoutes.js
@@ -0,0 +1,150 @@
+/**
+ * CRUD API for user-scoped persistence: workspace layout, chart drawings,
+ * and price markers. All routes require authentication (ref: DL-003).
+ * Uses PostgreSQL JSONB columns — data is always loaded/saved as a complete unit.
+ * POST /api/migrate uses a transaction for all-or-nothing insert (ref: DL-022).
+ */
 const express = require('express');
 const { query, pool } = require('./db');
 const { requireAuth, errorResponse } = require('./middleware');
 
 const router = express.Router();
 
+// All persistence endpoints require authentication
 router.use(requireAuth);
 
+/** PUT /api/workspace — save workspace layout (upsert). */
 router.put('/api/workspace', async (req, res) => {
     try {
         await query(
             'INSERT INTO workspaces (user_id, layout, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (user_id) DO UPDATE SET layout = $2, updated_at = CURRENT_TIMESTAMP',
             [req.userId, JSON.stringify(req.body)]
         );
         res.json({ success: true });
     } catch (err) {
         console.error('[Persistence] PUT /api/workspace error:', err.message);
         errorResponse(res, 500, 'SERVER_ERROR', 'Failed to save workspace');
     }
 });
 
+/** GET /api/workspace — load workspace layout. Returns {layout: null} if none exists. */
 router.get('/api/workspace', async (req, res) => {
     try {
         const result = await query('SELECT layout FROM workspaces WHERE user_id = $1', [req.userId]);
         if (result.rows.length === 0) {
             return res.json({ layout: null });
         }
         res.json({ layout: result.rows[0].layout });
     } catch (err) {
         console.error('[Persistence] GET /api/workspace error:', err.message);
         errorResponse(res, 500, 'SERVER_ERROR', 'Failed to load workspace');
     }
 });
 
+/** PUT /api/drawings/:symbol/:resolution — save drawings for a symbol/resolution pair (upsert). */
 router.put('/api/drawings/:symbol/:resolution', async (req, res) => {
     const { symbol, resolution } = req.params;
     try {
         await query(
             'INSERT INTO drawings (user_id, symbol, resolution, data, updated_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) ON CONFLICT (user_id, symbol, resolution) DO UPDATE SET data = $4, updated_at = CURRENT_TIMESTAMP',
             [req.userId, symbol.toUpperCase(), resolution, JSON.stringify(req.body)]
         );
         res.json({ success: true });
     } catch (err) {
         console.error('[Persistence] PUT /api/drawings error:', err.message);
         errorResponse(res, 500, 'SERVER_ERROR', 'Failed to save drawings');
     }
 });
 
+/** GET /api/drawings/:symbol/:resolution — load drawings for a symbol/resolution pair. */
 router.get('/api/drawings/:symbol/:resolution', async (req, res) => {
     const { symbol, resolution } = req.params;
     try {
         const result = await query(
             'SELECT data FROM drawings WHERE user_id = $1 AND symbol = $2 AND resolution = $3',
             [req.userId, symbol.toUpperCase(), resolution]
         );
         if (result.rows.length === 0) {
             return res.json({ data: null });
         }
         res.json({ data: result.rows[0].data });
     } catch (err) {
         console.error('[Persistence] GET /api/drawings error:', err.message);
         errorResponse(res, 500, 'SERVER_ERROR', 'Failed to load drawings');
     }
 });
 
+/** PUT /api/markers/:symbol — save price markers for a symbol (upsert). */
 router.put('/api/markers/:symbol', async (req, res) => {
     const { symbol } = req.params;
     try {
         await query(
             'INSERT INTO price_markers (user_id, symbol, data, updated_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) ON CONFLICT (user_id, symbol) DO UPDATE SET data = $3, updated_at = CURRENT_TIMESTAMP',
             [req.userId, symbol.toUpperCase(), JSON.stringify(req.body)]
         );
         res.json({ success: true });
     } catch (err) {
         console.error('[Persistence] PUT /api/markers error:', err.message);
         errorResponse(res, 500, 'SERVER_ERROR', 'Failed to save markers');
     }
 });
 
+/** GET /api/markers/:symbol — load price markers for a symbol. */
 router.get('/api/markers/:symbol', async (req, res) => {
     const { symbol } = req.params;
     try {
         const result = await query(
             'SELECT data FROM price_markers WHERE user_id = $1 AND symbol = $2',
             [req.userId, symbol.toUpperCase()]
         );
         if (result.rows.length === 0) {
             return res.json({ data: null });
         }
         res.json({ data: result.rows[0].data });
     } catch (err) {
         console.error('[Persistence] GET /api/markers error:', err.message);
         errorResponse(res, 500, 'SERVER_ERROR', 'Failed to load markers');
     }
 });
 
+/**
+ * POST /api/migrate — upload local browser data to server on first login.
+ * Uses a PostgreSQL transaction for all-or-nothing insert: if any INSERT fails,
+ * the entire migration rolls back and local data is preserved (ref: DL-007, DL-022).
+ * Body: {workspace?, drawings?: [{symbol, resolution, data}], markers?: [{symbol, data}]}
+ */
 router.post('/api/migrate', async (req, res) => {
     const { workspace, drawings, markers } = req.body;
+    // Raw pool.connect for transaction control (ref: DL-022)
     const client = await pool.connect();
     try {
         await client.query('BEGIN');
 
         if (workspace) {
             await client.query(
                 'INSERT INTO workspaces (user_id, layout, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (user_id) DO UPDATE SET layout = $2, updated_at = CURRENT_TIMESTAMP',
                 [req.userId, JSON.stringify(workspace)]
             );
         }
 
         if (drawings && Array.isArray(drawings)) {
             for (const d of drawings) {
                 await client.query(
                     'INSERT INTO drawings (user_id, symbol, resolution, data, updated_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) ON CONFLICT (user_id, symbol, resolution) DO UPDATE SET data = $4, updated_at = CURRENT_TIMESTAMP',
                     [req.userId, d.symbol.toUpperCase(), d.resolution, JSON.stringify(d.data)]
                 );
             }
         }
 
         if (markers && Array.isArray(markers)) {
             for (const m of markers) {
                 await client.query(
                     'INSERT INTO price_markers (user_id, symbol, data, updated_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) ON CONFLICT (user_id, symbol) DO UPDATE SET data = $3, updated_at = CURRENT_TIMESTAMP',
                     [req.userId, m.symbol.toUpperCase(), JSON.stringify(m.data)]
                 );
             }
         }
 
         await client.query('COMMIT');
         res.json({ success: true });
     } catch (err) {
+        // Transaction rollback on any failure — local data remains intact (ref: DL-022)
         await client.query('ROLLBACK');
         console.error('[Persistence] Migration failed, rolled back:', err.message);
         errorResponse(res, 500, 'SERVER_ERROR', 'Data migration failed');
     } finally {
         client.release();
     }
 });
 
 module.exports = { persistenceRoutes: router };

```


### Milestone 6: Frontend Auth Store and Login UI

**Files**: src/stores/authStore.js, src/components/LoginForm.svelte, src/App.svelte

**Requirements**:

- authStore Svelte store manages authentication state reactively
- LoginForm component provides login and register UI
- App.svelte shows LoginForm when unauthenticated, Workspace when authenticated
- Data migration runs on first login after registration
- WebSocket URL uses wss:// in production (same origin with Nginx proxy)

**Acceptance Criteria**:

- App shows login form on first load with no session
- Successful login transitions to Workspace view
- Successful registration transitions to Workspace view
- Logout returns to login form
- Page refresh preserves session (cookie survives reload)
- Existing localStorage/IndexedDB data is uploaded on first login

**Tests**:

- E2E: Playwright test: register, login, verify workspace loads, logout, login again

#### Code Intent

- **CI-M-006-001** `src/stores/authStore.js`: Svelte writable store for authentication state. State shape: { user: null|{id,email,displayName}, isLoading: true, error: null, isAuthenticated: false }. Functions: checkSession() -> GET /api/me, update store based on response. login(email, password) -> POST /api/login, update store, trigger data migration if local data exists. register(email, password, displayName) -> POST /api/register, update store. logout() -> POST /api/logout, clear store, reload page. migrateLocalData() -> detect localStorage keys (workspace-state, price-markers-*, chart-drawings-*) and Dexie/IndexedDB (NeuroSenseDrawings database), serialize into POST /api/migrate request, clear local copies only after server confirms 200. All API calls use fetch() with credentials: include. Base URL from VITE_API_BASE_URL environment variable (defaults to same origin in production). (refs: DL-001, DL-007)
- **CI-M-006-002** `src/components/LoginForm.svelte`: Svelte component with login and register tabs. Login tab: email input, password input, submit button. Register tab: email input, password input (min 8 chars), display name input, submit button. Error display for validation and server errors. Loading state disables submit button. On successful login/register, authStore updates and the parent conditionally renders Workspace. No external dependencies -- plain HTML form with fetch() calls. Styling matches existing app dark theme (#1a0a1a background). (refs: DL-003)
- **CI-M-006-003** `src/App.svelte`: Add auth gate: on mount, call authStore.checkSession(). While loading, show loading spinner. If authenticated, render Workspace component. If not authenticated, render LoginForm component. Subscribe to authStore.isAuthenticated for reactive updates. The Workspace component only mounts after successful authentication, ensuring all persistence calls have valid session cookies. (refs: DL-005)

#### Code Changes

**CC-M-006-001** (src/stores/authStore.js) - implements CI-M-006-001

**Code:**

```diff
--- a/src/stores/authStore.js
+++ b/src/stores/authStore.js
@@ -0,0 +1,120 @@
+import { writable, get } from 'svelte/store';
+import Dexie from 'dexie';
+
+const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
+
+const initialState = {
+    user: null,
+    isLoading: true,
+    error: null,
+    isAuthenticated: false
+};
+
+export const authStore = writable(initialState);
+
+function hasLocalData() {
+    if (typeof localStorage === 'undefined') return false;
+    if (localStorage.getItem('workspace-state')) return true;
+    for (let i = 0; i < localStorage.length; i++) {
+        const key = localStorage.key(i);
+        if (key.startsWith('price-markers-')) return true;
+        if (key.startsWith('chart-drawings-')) return true;
+    }
+    return false;
+}
+
+async function collectLocalData() {
+    const data = { drawings: [], markers: [] };
+    if (typeof localStorage === 'undefined') return data;
+
+    const ws = localStorage.getItem('workspace-state');
+    if (ws) data.workspace = JSON.parse(ws);
+
+    for (let i = 0; i < localStorage.length; i++) {
+        const key = localStorage.key(i);
+        if (key.startsWith('price-markers-')) {
+            data.markers.push({
+                symbol: key.replace('price-markers-', ''),
+                data: JSON.parse(localStorage.getItem(key))
+            });
+        }
+    }
+
+    try {
+        const db = new Dexie('NeuroSenseDrawings');
+        db.version(1).stores({ drawings: '++id, [symbol+resolution], overlayType, createdAt' });
+        const allDrawings = await db.drawings.toArray();
+        const byKey = new Map();
+        for (const d of allDrawings) {
+            const k = d.symbol + '/' + d.resolution;
+            if (!byKey.has(k)) byKey.set(k, []);
+            byKey.get(k).push(d);
+        }
+        for (const [key, items] of byKey) {
+            const [symbol, resolution] = key.split('/');
+            data.drawings.push({ symbol, resolution, data: items });
+        }
+        await db.close();
+    } catch (err) {
+        console.warn('[Auth] Could not read IndexedDB drawings:', err);
+    }
+
+    return data;
+}
+
+async function migrateLocalData() {
+    if (!hasLocalData()) return;
+    try {
+        const data = await collectLocalData();
+        const resp = await fetch(API_BASE + '/api/migrate', {
+            method: 'POST',
+            headers: { 'Content-Type': 'application/json' },
+            credentials: 'include',
+            body: JSON.stringify(data)
+        });
+        if (resp.ok) {
+            console.log('[Auth] Local data migrated to server');
+        } else {
+            console.warn('[Auth] Migration upload failed, local data preserved:', resp.status);
+        }
+    } catch (err) {
+        console.warn('[Auth] Migration upload error, local data preserved:', err);
+    }
+}
+
+export async function checkSession() {
+    try {
+        const resp = await fetch(API_BASE + '/api/me', { credentials: 'include' });
+        if (resp.ok) {
+            const { user } = await resp.json();
+            authStore.set({ user, isLoading: false, error: null, isAuthenticated: true });
+            return true;
+        }
+    } catch (err) {
+        console.warn('[Auth] Session check failed:', err);
+    }
+    authStore.set({ ...initialState, isLoading: false });
+    return false;
+}
+
+export async function login(email, password) {
+    authStore.update(s => ({ ...s, isLoading: true, error: null }));
+    try {
+        const resp = await fetch(API_BASE + '/api/login', {
+            method: 'POST',
+            headers: { 'Content-Type': 'application/json' },
+            credentials: 'include',
+            body: JSON.stringify({ email, password })
+        });
+        const data = await resp.json();
+        if (!resp.ok) {
+            authStore.set({ ...initialState, isLoading: false, error: data.error?.message || 'Login failed' });
+            return false;
+        }
+        authStore.set({ user: data.user, isLoading: false, error: null, isAuthenticated: true });
+        await migrateLocalData();
+        return true;
+    } catch (err) {
+        authStore.set({ ...initialState, isLoading: false, error: 'Network error' });
+        return false;
+    }
+}
+
+export async function register(email, password, displayName) {
+    authStore.update(s => ({ ...s, isLoading: true, error: null }));
+    try {
+        const resp = await fetch(API_BASE + '/api/register', {
+            method: 'POST',
+            headers: { 'Content-Type': 'application/json' },
+            credentials: 'include',
+            body: JSON.stringify({ email, password, display_name: displayName })
+        });
+        const data = await resp.json();
+        if (!resp.ok) {
+            authStore.set({ ...initialState, isLoading: false, error: data.error?.message || 'Registration failed' });
+            return false;
+        }
+        authStore.set({ user: data.user, isLoading: false, error: null, isAuthenticated: true });
+        await migrateLocalData();
+        return true;
+    } catch (err) {
+        authStore.set({ ...initialState, isLoading: false, error: 'Network error' });
+        return false;
+    }
+}
+
+export async function logout() {
+    try {
+        await fetch(API_BASE + '/api/logout', { method: 'POST', credentials: 'include' });
+    } catch (err) {
+    }
+    authStore.set({ ...initialState, isLoading: false });
+    window.location.reload();
+}

```

**Documentation:**

```diff
--- a/src/stores/authStore.js
+++ b/src/stores/authStore.js
@@ -0,0 +1,124 @@
+/**
+ * Client-side authentication state management.
+ * Stores user/session state in a Svelte writable store.
+ * On first login, migrates existing localStorage/IndexedDB data to server (ref: DL-007).
+ * All API calls use credentials: 'include' to send session cookies (ref: DL-005).
+ */
 import { writable, get } from 'svelte/store';
 import Dexie from 'dexie';
 
 const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
 
 const initialState = {
     user: null,
     isLoading: true,
     error: null,
     isAuthenticated: false
 };
 
 export const authStore = writable(initialState);
 
+/** Check if any local browser data exists for migration. */
 function hasLocalData() {
     if (typeof localStorage === 'undefined') return false;
     if (localStorage.getItem('workspace-state')) return true;
     for (let i = 0; i < localStorage.length; i++) {
         const key = localStorage.key(i);
         if (key.startsWith('price-markers-')) return true;
         if (key.startsWith('chart-drawings-')) return true;
     }
     return false;
 }
 
+/**
+ * Collect all local browser data for migration upload.
+ * Reads localStorage for workspace and markers, IndexedDB (Dexie) for drawings.
+ */
 async function collectLocalData() {
     const data = { drawings: [], markers: [] };
     if (typeof localStorage === 'undefined') return data;
 
     const ws = localStorage.getItem('workspace-state');
     if (ws) data.workspace = JSON.parse(ws);
 
     for (let i = 0; i < localStorage.length; i++) {
         const key = localStorage.key(i);
         if (key.startsWith('price-markers-')) {
             data.markers.push({
                 symbol: key.replace('price-markers-', ''),
                 data: JSON.parse(localStorage.getItem(key))
             });
         }
     }
 
     try {
         const db = new Dexie('NeuroSenseDrawings');
         db.version(1).stores({ drawings: '++id, [symbol+resolution], overlayType, createdAt' });
         const allDrawings = await db.drawings.toArray();
         const byKey = new Map();
         for (const d of allDrawings) {
             const k = d.symbol + '/' + d.resolution;
             if (!byKey.has(k)) byKey.set(k, []);
             byKey.get(k).push(d);
         }
         for (const [key, items] of byKey) {
             const [symbol, resolution] = key.split('/');
             data.drawings.push({ symbol, resolution, data: items });
         }
         await db.close();
     } catch (err) {
         console.warn('[Auth] Could not read IndexedDB drawings:', err);
     }
 
     return data;
 }
 
+/**
+ * Upload local browser data to server. Copy-not-move: local data is preserved
+ * regardless of upload outcome (ref: DL-007). Only runs if local data exists.
+ */
 async function migrateLocalData() {
     if (!hasLocalData()) return;
     try {
         const data = await collectLocalData();
         const resp = await fetch(API_BASE + '/api/migrate', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             credentials: 'include',
             body: JSON.stringify(data)
         });
         if (resp.ok) {
             console.log('[Auth] Local data migrated to server');
         } else {
             console.warn('[Auth] Migration upload failed, local data preserved:', resp.status);
         }
     } catch (err) {
         console.warn('[Auth] Migration upload error, local data preserved:', err);
     }
 }
 
+/** Check existing session via GET /api/me. Updates authStore state accordingly. */
 export async function checkSession() {
     try {
         const resp = await fetch(API_BASE + '/api/me', { credentials: 'include' });
         if (resp.ok) {
             const { user } = await resp.json();
             authStore.set({ user, isLoading: false, error: null, isAuthenticated: true });
             return true;
         }
     } catch (err) {
         console.warn('[Auth] Session check failed:', err);
     }
     authStore.set({ ...initialState, isLoading: false });
     return false;
 }
 
+/** Login and trigger local data migration on success. */
 export async function login(email, password) {
     authStore.update(s => ({ ...s, isLoading: true, error: null }));
     try {
         const resp = await fetch(API_BASE + '/api/login', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             credentials: 'include',
             body: JSON.stringify({ email, password })
         });
         const data = await resp.json();
         if (!resp.ok) {
             authStore.set({ ...initialState, isLoading: false, error: data.error?.message || 'Login failed' });
             return false;
         }
         authStore.set({ user: data.user, isLoading: false, error: null, isAuthenticated: true });
+        // Migrate local data on first login (ref: DL-007)
         await migrateLocalData();
         return true;
     } catch (err) {
         authStore.set({ ...initialState, isLoading: false, error: 'Network error' });
         return false;
     }
 }
 
+/** Register and trigger local data migration on success. */
 export async function register(email, password, displayName) {
     authStore.update(s => ({ ...s, isLoading: true, error: null }));
     try {
         const resp = await fetch(API_BASE + '/api/register', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             credentials: 'include',
             body: JSON.stringify({ email, password, display_name: displayName })
         });
         const data = await resp.json();
         if (!resp.ok) {
             authStore.set({ ...initialState, isLoading: false, error: data.error?.message || 'Registration failed' });
             return false;
         }
         authStore.set({ user: data.user, isLoading: false, error: null, isAuthenticated: true });
+        // Migrate local data on first registration (ref: DL-007)
         await migrateLocalData();
         return true;
     } catch (err) {
         authStore.set({ ...initialState, isLoading: false, error: 'Network error' });
         return false;
     }
 }
 
+/** Logout and reload to clear all client state. */
 export async function logout() {
     try {
         await fetch(API_BASE + '/api/logout', { method: 'POST', credentials: 'include' });
     } catch (err) {
     }
     authStore.set({ ...initialState, isLoading: false });
     window.location.reload();
 }

```


**CC-M-006-002** (src/components/LoginForm.svelte) - implements CI-M-006-002

**Code:**

```diff
--- a/src/components/LoginForm.svelte
+++ b/src/components/LoginForm.svelte
@@ -0,0 +1,96 @@
+<script>
+    import { authStore, login, register } from '../stores/authStore.js';
+    let tab = 'login';
+    let email = '';
+    let password = '';
+    let displayName = '';
+    let localError = '';
+
+    $: isLoading = $authStore.isLoading;
+    $: serverError = $authStore.error;
+
+    async function handleSubmit() {
+        localError = '';
+        if (!email.trim()) { localError = 'Email is required'; return; }
+        if (!password || password.length < 8) { localError = 'Password must be at least 8 characters'; return; }
+
+        if (tab === 'login') {
+            await login(email, password);
+        } else {
+            await register(email, password, displayName);
+        }
+    }
+
+    function switchTab(t) {
+        tab = t;
+        localError = '';
+    }
+</script>
+
+<div class="login-container">
+    <div class="login-card">
+        <h1>NeuroSense FX</h1>
+        <p class="subtitle">Trading Visualization Platform</p>
+
+        <div class="tabs">
+            <button class:active={tab === 'login'} on:click={() => switchTab('login')}>Login</button>
+            <button class:active={tab === 'register'} on:click={() => switchTab('register')}>Register</button>
+        </div>
+
+        <form on:submit|preventDefault={handleSubmit}>
+            <label>
+                Email
+                <input type="email" bind:value={email} disabled={isLoading} required />
+            </label>
+
+            <label>
+                Password
+                <input type="password" bind:value={password} disabled={isLoading} required minlength="8" />
+            </label>
+
+            {#if tab === 'register'}
+                <label>
+                    Display Name
+                    <input type="text" bind:value={displayName} disabled={isLoading} maxlength="128" />
+                </label>
+            {/if}
+
+            {#if localError}
+                <p class="error">{localError}</p>
+            {/if}
+            {#if serverError}
+                <p class="error">{serverError}</p>
+            {/if}
+
+            <button type="submit" disabled={isLoading}>
+                {isLoading ? 'Please wait...' : (tab === 'login' ? 'Login' : 'Create Account')}
+            </button>
+        </form>
+    </div>
+</div>
+
+<style>
+    .login-container {
+        display: flex;
+        align-items: center;
+        justify-content: center;
+        height: 100vh;
+        background: #1a0a1a;
+    }
+    .login-card {
+        background: #2a1a2a;
+        border: 1px solid #3a2a3a;
+        border-radius: 8px;
+        padding: 2rem;
+        width: 360px;
+        color: #e0d0e0;
+    }
+    .login-card h1 { margin: 0 0 0.25rem 0; font-size: 1.5rem; }
+    .subtitle { margin: 0 0 1.5rem 0; color: #a090a0; font-size: 0.875rem; }
+    .tabs { display: flex; gap: 0; margin-bottom: 1.5rem; border-bottom: 1px solid #3a2a3a; }
+    .tabs button {
+        flex: 1; padding: 0.5rem; border: none; background: none;
+        color: #a090a0; cursor: pointer; font-size: 0.875rem;
+        border-bottom: 2px solid transparent;
+    }
+    .tabs button.active { color: #e0d0e0; border-bottom-color: #7c5caf; }
+    form label { display: block; margin-bottom: 1rem; font-size: 0.875rem; color: #a090a0; }
+    form input {
+        width: 100%; padding: 0.5rem; margin-top: 0.25rem;
+        background: #1a0a1a; border: 1px solid #3a2a3a; border-radius: 4px;
+        color: #e0d0e0; box-sizing: border-box;
+    }
+    form input:disabled { opacity: 0.6; }
+    .error { color: #e74c3c; font-size: 0.8rem; margin-bottom: 0.5rem; }
+    form button[type="submit"] {
+        width: 100%; padding: 0.75rem; margin-top: 0.5rem;
+        background: #7c5caf; border: none; border-radius: 4px;
+        color: white; cursor: pointer; font-size: 0.875rem;
+    }
+    form button[type="submit"]:disabled { opacity: 0.6; cursor: not-allowed; }
+</style>

```

**Documentation:**

```diff
--- a/src/components/LoginForm.svelte
+++ b/src/components/LoginForm.svelte
@@ -0,0 +1,4 @@
+<!--
+  Login/Register form. Tabbed UI with client-side validation.
+  Server errors displayed via authStore.error. Renders before Workspace when unauthenticated.
+-->
 <script>
     import { authStore, login, register } from '../stores/authStore.js';

```


**CC-M-006-003** (src/App.svelte) - implements CI-M-006-003

**Code:**

```diff
--- a/src/App.svelte
+++ b/src/App.svelte
@@ -1,8 +1,17 @@
 <script>
+  import { authStore, checkSession } from './stores/authStore.js';
   import Workspace from './components/Workspace.svelte';
+  import LoginForm from './components/LoginForm.svelte';
   import './lib/visualizers.js';
+
+  let authenticated = false;
+  let loading = true;
+
+  authStore.subscribe(state => {
+    authenticated = state.isAuthenticated;
+    loading = state.isLoading;
+  });
+
+  checkSession();
 </script>
 
 <main>
-  <Workspace />
+  {#if loading}
+    <div class="loading">Loading...</div>
+  {:else if authenticated}
+    <Workspace />
+  {:else}
+    <LoginForm />
+  {/if}
 </main>
 
 <style>
   main {
     position: fixed;
     inset: 0;
     overflow: hidden;
     background: #1a0a1a;
   }
+  .loading {
+    display: flex;
+    align-items: center;
+    justify-content: center;
+    height: 100vh;
+    color: #a090a0;
+    font-size: 1.25rem;
+  }
 </style>

```

**Documentation:**

```diff
--- a/src/App.svelte
+++ b/src/App.svelte
@@ -1,8 +1,12 @@
 <script>
+  // Auth gate: checks session on mount. Shows loading, then either Workspace or LoginForm (ref: DL-011).
+  // Hard cutover — no anonymous mode. All users must register after auth deployment.
   import { authStore, checkSession } from './stores/authStore.js';
   import Workspace from './components/Workspace.svelte';
   import LoginForm from './components/LoginForm.svelte';
   import './lib/visualizers.js';
 
   let authenticated = false;
   let loading = true;
 
   authStore.subscribe(state => {
     authenticated = state.isAuthenticated;
     loading = state.isLoading;
   });
 
   checkSession();
 </script>
 
 <main>
+  {#if loading}
+    <div class="loading">Loading...</div>
+  {:else if authenticated}
+    <Workspace />
+  {:else}
+    <LoginForm />
+  {/if}
 </main>

```


### Milestone 7: Frontend Persistence Migration

**Files**: src/stores/workspace.js, src/stores/priceMarkerPersistence.js, src/lib/chart/drawingStore.js

**Requirements**:

- Workspace persistence uses PUT /api/workspace instead of localStorage (with fallback)
- Drawing persistence uses PUT /api/drawings/:symbol/:resolution instead of IndexedDB (with fallback)
- Price marker persistence uses PUT /api/markers/:symbol instead of localStorage (with fallback)
- All persistence calls are debounced to avoid rapid API requests
- localStorage/IndexedDB retained as fallback cache

**Acceptance Criteria**:

- Workspace layout changes are persisted to server and survive page reload
- Chart drawings are persisted to server and survive page reload
- Price markers are persisted to server and survive page reload
- If API call fails, data is still saved to localStorage as fallback
- No data loss compared to pre-auth behavior

**Tests**:

- E2E: Playwright test: create drawing, reload page, verify drawing persists

#### Code Intent

- **CI-M-007-001** `src/stores/workspace.js`: Replace localStorage persistence with server-backed persistence. initPersistence() subscribe handler: debounced (2s) PUT /api/workspace with serialized workspace state. Keep localStorage write as fallback. loadFromStorage(): first attempt GET /api/workspace, fall back to localStorage if API fails. On successful server load, write to localStorage as cache. addChartDisplay and addDisplay remain unchanged (local state only). Export function includes drawings from server instead of only localStorage markers. (refs: DL-007)
- **CI-M-007-002** `src/stores/priceMarkerPersistence.js`: Replace localStorage with API-backed persistence. saveMarkers(): debounced (1s) PUT /api/markers/:symbol. Keep localStorage write as fallback cache. loadMarkers(): first attempt GET /api/markers/:symbol, fall back to localStorage. mergeWithPersisted(): merge locally and remotely. All API calls use fetch() with credentials:include. (refs: DL-007)
- **CI-M-007-003** `src/lib/chart/drawingStore.js`: Replace Dexie/IndexedDB with API-backed persistence. save(): POST individual drawing to server via PUT /api/drawings/:symbol/:resolution (sends full array). load(): GET /api/drawings/:symbol/:resolution. update() and remove(): modify local array, then PUT full array to server. clearAll(): DELETE /api/drawings/:symbol/:resolution. Keep Dexie as local cache/fallback. API calls use fetch() with credentials:include. Debounced saves (500ms) to avoid rapid PUT requests during drawing operations. (refs: DL-007)

#### Code Changes

**CC-M-007-001** (src/stores/workspace.js) - implements CI-M-007-001

**Code:**

```diff
--- a/src/stores/workspace.js
+++ b/src/stores/workspace.js
@@ -1,3 +1,5 @@
+import { authStore } from './authStore.js';
+import { get } from 'svelte/store';
 
 import { writable } from 'svelte/store';
 
@@ -368,17 +370,48 @@ const persistence = {
   loadFromStorage: async () => {
     try {
       if (typeof localStorage === 'undefined') {
         return;
       }
+      if (get(authStore).isAuthenticated) {
+        try {
+          const resp = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/workspace', { credentials: 'include' });
+          if (resp.ok) {
+            const data = await resp.json();
+            if (data && data.layout) {
+              const layout = typeof data.layout === 'string' ? JSON.parse(data.layout) : data.layout;
+              workspaceStore.update(state => ({
+                ...state,
+                displays: new Map(layout.displays || []),
+                nextZIndex: layout.nextZIndex || 1,
+                chartGhost: layout.chartGhost || null
+              }));
+              localStorage.setItem('workspace-state', JSON.stringify(layout));
+              return;
+            }
+          }
+        } catch (err) {
+          console.warn('[Workspace] Server load failed, falling back to localStorage:', err);
+        }
+      }
+      loadFromLocalStorage();
+    } catch (error) {
+      console.warn('Failed to load workspace from storage:', error);
+    }
+  },
+
+  initPersistence: () => {
+    if (typeof localStorage === 'undefined') {
+      return () => {};
+    }
+    let debounceTimer = null;
+    return workspaceStore.subscribe(state => {
+      const data = {
+        displays: Array.from(state.displays.entries()),
+        nextZIndex: state.nextZIndex,
+        chartGhost: state.chartGhost || null
+      };
+      try {
+        localStorage.setItem('workspace-state', JSON.stringify(data));
+      } catch (error) {
+        console.warn('Failed to save workspace to storage:', error);
+      }
+      if (get(authStore).isAuthenticated) {
+        clearTimeout(debounceTimer);
+        debounceTimer = setTimeout(() => {
+          fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/workspace', {
+            method: 'PUT',
+            headers: { 'Content-Type': 'application/json' },
+            credentials: 'include',
+            body: JSON.stringify(data)
+          }).catch(err => console.warn('Failed to sync workspace to server:', err));
+        }, 2000);
+      }
+    });
+  }
+};
+
+function loadFromLocalStorage() {
+  try {
       const stored = localStorage.getItem('workspace-state');
       if (!stored) {
         return;
       }
 
       const data = JSON.parse(stored);
       workspaceStore.update(state => ({
         ...state,
         displays: new Map(data.displays || []),
         nextZIndex: data.nextZIndex || 1,
         chartGhost: data.chartGhost || null
       }));
-    } catch (error) {
-      console.warn('Failed to load workspace from storage:', error);
-    }
-  },
-
-  initPersistence: () => {
-    if (typeof localStorage === 'undefined') {
-      return () => {};
-    }
-    return workspaceStore.subscribe(state => {
-      const data = {
-        displays: Array.from(state.displays.entries()),
-        nextZIndex: state.nextZIndex,
-        chartGhost: state.chartGhost || null
-      };
-      try {
-        localStorage.setItem('workspace-state', JSON.stringify(data));
-      } catch (error) {
-        console.warn('Failed to save workspace to storage:', error);
-      }
-    });
-  }
-};
+  } catch (error) {
+    console.warn('Failed to load workspace from localStorage:', error);
+  }
+}
 
 export const workspaceActions = actions;
 export const workspacePersistence = persistence;

```

**Documentation:**

```diff
--- a/src/stores/workspace.js
+++ b/src/stores/workspace.js
@@ -1,3 +1,5 @@
+// Workspace persistence dual-targets localStorage and server API when authenticated (ref: DL-007).
+// Server is the source of truth; localStorage is fallback if server load fails.
 import { authStore } from './authStore.js';
 import { get } from 'svelte/store';
 
@@ -368,17 +370,48 @@
   loadFromStorage: async () => {
     try {
       if (typeof localStorage === 'undefined') {
         return;
       }
+      // When authenticated, try server first. Fall back to localStorage on failure (ref: DL-007).
       if (get(authStore).isAuthenticated) {
         try {
           const resp = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/workspace', { credentials: 'include' });
           if (resp.ok) {
             const data = await resp.json();
             if (data && data.layout) {
               const layout = typeof data.layout === 'string' ? JSON.parse(data.layout) : data.layout;
               workspaceStore.update(state => ({
                 ...state,
                 displays: new Map(layout.displays || []),
                 nextZIndex: layout.nextZIndex || 1,
                 chartGhost: layout.chartGhost || null
               }));
+              // Cache server data in localStorage for offline fallback
               localStorage.setItem('workspace-state', JSON.stringify(layout));
               return;
             }
           }
         } catch (err) {
           console.warn('[Workspace] Server load failed, falling back to localStorage:', err);
         }
       }
       loadFromLocalStorage();
     } catch (error) {
       console.warn('Failed to load workspace from storage:', error);
     }
   },
 
   initPersistence: () => {
     if (typeof localStorage === 'undefined') {
       return () => {};
     }
     let debounceTimer = null;
     return workspaceStore.subscribe(state => {
       const data = {
         displays: Array.from(state.displays.entries()),
         nextZIndex: state.nextZIndex,
         chartGhost: state.chartGhost || null
       };
       try {
         localStorage.setItem('workspace-state', JSON.stringify(data));
       } catch (error) {
         console.warn('Failed to save workspace to storage:', error);
       }
+      // Debounced server sync: 2-second delay to batch rapid workspace changes (ref: DL-007).
       if (get(authStore).isAuthenticated) {
         clearTimeout(debounceTimer);
         debounceTimer = setTimeout(() => {
           fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/workspace', {
             method: 'PUT',
             headers: { 'Content-Type': 'application/json' },
             credentials: 'include',
             body: JSON.stringify(data)
           }).catch(err => console.warn('Failed to sync workspace to server:', err));
         }, 2000);
       }
     });
   }
 };
 
+/** Load workspace state from localStorage only. Used as fallback when server is unavailable. */
 function loadFromLocalStorage() {
   try {
       const stored = localStorage.getItem('workspace-state');

```


**CC-M-007-002** (src/stores/priceMarkerPersistence.js) - implements CI-M-007-002

**Code:**

```diff
--- a/src/stores/priceMarkerPersistence.js
+++ b/src/stores/priceMarkerPersistence.js
@@ -1,3 +1,5 @@
+import { authStore } from './authStore.js';
+import { get } from 'svelte/store';
 
 // Price marker persistence using localStorage
 // Follows pattern from PERSISTENT_STORAGE_SOLUTIONS.md
@@ -7,10 +9,14 @@ export function getStorageKey(symbol) {
 }
 
 export async function loadMarkers(symbol) {
   try {
     if (typeof localStorage === 'undefined') return [];
+    if (get(authStore).isAuthenticated) {
+      try {
+        const resp = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/markers/' + symbol.toUpperCase(), { credentials: 'include' });
+        if (resp.ok) {
+          const result = await resp.json();
+          if (result && result.data) {
+            localStorage.setItem(getStorageKey(symbol), JSON.stringify(result.data));
+            return result.data;
+          }
+        }
+      } catch (err) {
+        console.warn('[Markers] Server load failed for ' + symbol + ', falling back to localStorage:', err);
+      }
+    }
-    const key = getStorageKey(symbol);
-    const stored = localStorage.getItem(key);
-    return stored ? JSON.parse(stored) : [];
+    return loadMarkersFromLocal(symbol);
   } catch (error) {
     console.warn('Failed to load markers for ' + symbol + ':', error);
     return [];
   }
 }
 
+function loadMarkersFromLocal(symbol) {
+  try {
+    const stored = localStorage.getItem(getStorageKey(symbol));
+    return stored ? JSON.parse(stored) : [];
+  } catch (error) {
+    return [];
+  }
+}
+
 export function saveMarkers(symbol, markers) {
   try {
     if (typeof localStorage === 'undefined') return;
     const key = getStorageKey(symbol);
     localStorage.setItem(key, JSON.stringify(markers));
+    if (get(authStore).isAuthenticated) {
+      clearTimeout(saveMarkers._debounceTimers && saveMarkers._debounceTimers[symbol]);
+      if (!saveMarkers._debounceTimers) saveMarkers._debounceTimers = {};
+      saveMarkers._debounceTimers[symbol] = setTimeout(() => {
+        fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/markers/' + symbol.toUpperCase(), {
+          method: 'PUT',
+          headers: { 'Content-Type': 'application/json' },
+          credentials: 'include',
+          body: JSON.stringify(markers)
+        }).catch(err => console.warn('Failed to sync markers for ' + symbol + ':', err));
+      }, 1000);
+    }
   } catch (error) {
     console.warn('Failed to save markers for ' + symbol + ':', error);
   }

```

**Documentation:**

```diff
--- a/src/stores/priceMarkerPersistence.js
+++ b/src/stores/priceMarkerPersistence.js
@@ -1,3 +1,5 @@
+// Price marker persistence dual-targets localStorage and server API when authenticated (ref: DL-007).
+// Server is source of truth; localStorage provides offline fallback.
 import { authStore } from './authStore.js';
 import { get } from 'svelte/store';
 
@@ -7,10 +9,14 @@
 }
 
 export async function loadMarkers(symbol) {
   try {
     if (typeof localStorage === 'undefined') return [];
+    // Try server first when authenticated, fall back to localStorage (ref: DL-007)
     if (get(authStore).isAuthenticated) {
       try {
         const resp = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/markers/' + symbol.toUpperCase(), { credentials: 'include' });
         if (resp.ok) {
           const result = await resp.json();
           if (result && result.data) {
+            // Cache server data in localStorage for offline fallback
             localStorage.setItem(getStorageKey(symbol), JSON.stringify(result.data));
             return result.data;
           }
         }
       } catch (err) {
         console.warn('[Markers] Server load failed for ' + symbol + ', falling back to localStorage:', err);
       }
     }
     return loadMarkersFromLocal(symbol);
   } catch (error) {
     console.warn('Failed to load markers for ' + symbol + ':', error);
     return [];
   }
 }
 
+/** Load markers from localStorage only. Used as fallback when server is unavailable. */
 function loadMarkersFromLocal(symbol) {
   try {
     const stored = localStorage.getItem(getStorageKey(symbol));
     return stored ? JSON.parse(stored) : [];
   } catch (error) {
     return [];
   }
 }
 
 export function saveMarkers(symbol, markers) {
   try {
     if (typeof localStorage === 'undefined') return;
     const key = getStorageKey(symbol);
     localStorage.setItem(key, JSON.stringify(markers));
+    // Debounced server sync: 1-second delay to batch rapid marker changes (ref: DL-007)
     if (get(authStore).isAuthenticated) {
       clearTimeout(saveMarkers._debounceTimers && saveMarkers._debounceTimers[symbol]);
       if (!saveMarkers._debounceTimers) saveMarkers._debounceTimers = {};
       saveMarkers._debounceTimers[symbol] = setTimeout(() => {
         fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/markers/' + symbol.toUpperCase(), {
           method: 'PUT',
           headers: { 'Content-Type': 'application/json' },
           credentials: 'include',
           body: JSON.stringify(markers)
         }).catch(err => console.warn('Failed to sync markers for ' + symbol + ':', err));
       }, 1000);
     }
   } catch (error) {
     console.warn('Failed to save markers for ' + symbol + ':', error);

```


**CC-M-007-003** (src/lib/chart/drawingStore.js) - implements CI-M-007-003

**Code:**

```diff
--- a/src/lib/chart/drawingStore.js
+++ b/src/lib/chart/drawingStore.js
@@ -1,5 +1,7 @@
 import Dexie from 'dexie';
+import { authStore } from '../../stores/authStore.js';
+import { get } from 'svelte/store';
 
 const db = new Dexie('NeuroSenseDrawings');
 db.version(1).stores({
   drawings: '++id, [symbol+resolution], overlayType, createdAt',
 });
 
+const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
+const saveDebounceTimers = new Map();
+
 export const drawingStore = {
   async save(symbol, resolution, drawing) {
-    return db.drawings.add({
+    const stored = await db.drawings.add({
       ...drawing,
       symbol,
       resolution,
       schemaVersion: 1,
       createdAt: Date.now(),
       updatedAt: Date.now(),
     });
+    this._debouncedServerSync(symbol, resolution);
+    return stored;
   },
 
   async load(symbol, resolution) {
-    return db.drawings
-      .where({ symbol, resolution })
-      .toArray();
+    if (get(authStore).isAuthenticated) {
+      try {
+        const resp = await fetch(API_BASE + '/api/drawings/' + symbol + '/' + resolution, { credentials: 'include' });
+        if (resp.ok) {
+          const { data } = await resp.json();
+          if (data) {
+            await db.drawings.where({ symbol, resolution }).delete();
+            if (Array.isArray(data)) {
+              for (const d of data) {
+                await db.drawings.add({ ...d, symbol, resolution });
+              }
+            }
+            return data;
+          }
+        }
+      } catch (err) {
+        console.warn('[DrawingStore] Server load failed for ' + symbol + '/' + resolution + ':', err);
+      }
+    }
+    return db.drawings.where({ symbol, resolution }).toArray();
   },
 
   async update(id, changes) {
-    return db.drawings.update(id, { ...changes, updatedAt: Date.now() });
+    await db.drawings.update(id, { ...changes, updatedAt: Date.now() });
+    const drawing = await db.drawings.get(id);
+    if (drawing) {
+      this._debouncedServerSync(drawing.symbol, drawing.resolution);
+    }
   },
 
-  async remove(id) {
-    return db.drawings.delete(id);
-  },
+  async remove(id) {
+    const drawing = await db.drawings.get(id);
+    await db.drawings.delete(id);
+    if (drawing) {
+      this._debouncedServerSync(drawing.symbol, drawing.resolution);
+    }
+  },
 
   async clearAll(symbol, resolution) {
-    return db.drawings.where({ symbol, resolution }).delete();
+    await db.drawings.where({ symbol, resolution }).delete();
+    if (get(authStore).isAuthenticated) {
+      fetch(API_BASE + '/api/drawings/' + symbol + '/' + resolution, {
+        method: 'PUT',
+        headers: { 'Content-Type': 'application/json' },
+        credentials: 'include',
+        body: JSON.stringify([])
+      }).catch(err => console.warn('[DrawingStore] Failed to clear drawings on server:', err));
+    }
   },
+
+  _debouncedServerSync(symbol, resolution) {
+    if (!get(authStore).isAuthenticated) return;
+    const key = symbol + '/' + resolution;
+    const existing = saveDebounceTimers.get(key);
+    if (existing) clearTimeout(existing);
+    saveDebounceTimers.set(key, setTimeout(async () => {
+      saveDebounceTimers.delete(key);
+      try {
+        const all = await db.drawings.where({ symbol, resolution }).toArray();
+        await fetch(API_BASE + '/api/drawings/' + symbol + '/' + resolution, {
+          method: 'PUT',
+          headers: { 'Content-Type': 'application/json' },
+          credentials: 'include',
+          body: JSON.stringify(all)
+        });
+      } catch (err) {
+        console.warn('[DrawingStore] Server sync failed for ' + key + ':', err);
+      }
+    }, 500));
+  }
 };

```

**Documentation:**

```diff
--- a/src/lib/chart/drawingStore.js
+++ b/src/lib/chart/drawingStore.js
@@ -1,5 +1,7 @@
 import Dexie from 'dexie';
+// Drawing persistence dual-targets IndexedDB (Dexie) and server API when authenticated (ref: DL-007).
+// IndexedDB remains the local cache; server is the source of truth across logins.
 import { authStore } from '../../stores/authStore.js';
 import { get } from 'svelte/store';
 
 const db = new Dexie('NeuroSenseDrawings');
 db.version(1).stores({
   drawings: '++id, [symbol+resolution], overlayType, createdAt',
 });
 
 const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
 const saveDebounceTimers = new Map();
 
 export const drawingStore = {
   async save(symbol, resolution, drawing) {
     const stored = await db.drawings.add({
       ...drawing,
       symbol,
       resolution,
       schemaVersion: 1,
       createdAt: Date.now(),
       updatedAt: Date.now(),
     });
+    // Trigger debounced server sync after local IndexedDB write (ref: DL-007)
     this._debouncedServerSync(symbol, resolution);
     return stored;
   },
 
   async load(symbol, resolution) {
+    // Try server first when authenticated; replace local IndexedDB with server data (ref: DL-007)
     if (get(authStore).isAuthenticated) {
       try {
         const resp = await fetch(API_BASE + '/api/drawings/' + symbol + '/' + resolution, { credentials: 'include' });
         if (resp.ok) {
           const { data } = await resp.json();
           if (data) {
+            // Replace local IndexedDB data with server data to keep cache in sync
             await db.drawings.where({ symbol, resolution }).delete();
             if (Array.isArray(data)) {
               for (const d of data) {
                 await db.drawings.add({ ...d, symbol, resolution });
               }
             }
             return data;
           }
         }
       } catch (err) {
         console.warn('[DrawingStore] Server load failed for ' + symbol + '/' + resolution + ':', err);
       }
     }
     return db.drawings.where({ symbol, resolution }).toArray();
   },
 
   async update(id, changes) {
     await db.drawings.update(id, { ...changes, updatedAt: Date.now() });
     const drawing = await db.drawings.get(id);
     if (drawing) {
+      // Sync updated drawing to server after local IndexedDB write
       this._debouncedServerSync(drawing.symbol, drawing.resolution);
     }
   },
 
   async remove(id) {
     const drawing = await db.drawings.get(id);
     await db.drawings.delete(id);
     if (drawing) {
+      // Sync removal to server after local IndexedDB delete
       this._debouncedServerSync(drawing.symbol, drawing.resolution);
     }
   },
 
   async clearAll(symbol, resolution) {
     await db.drawings.where({ symbol, resolution }).delete();
+    // Immediate (non-debounced) sync for clearAll — user expects instant server state (ref: DL-007)
     if (get(authStore).isAuthenticated) {
       fetch(API_BASE + '/api/drawings/' + symbol + '/' + resolution, {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         credentials: 'include',
         body: JSON.stringify([])
       }).catch(err => console.warn('[DrawingStore] Failed to clear drawings on server:', err));
     }
   },
 
+  /**
+   * Debounced server sync: 500ms delay batches rapid drawing operations.
+   * Reads the full set of drawings for the symbol/resolution from IndexedDB
+   * and uploads as a complete unit (ref: DL-003).
+   */
   _debouncedServerSync(symbol, resolution) {
     if (!get(authStore).isAuthenticated) return;
     const key = symbol + '/' + resolution;

```


**CC-M-007-004** (src/components/Workspace.svelte) - implements CI-M-007-001

**Code:**

```diff
--- a/src/components/Workspace.svelte
+++ b/src/components/Workspace.svelte
@@ -180,8 +180,8 @@
     // Load workspace persistence first
-    workspacePersistence.loadFromStorage();
+    await workspacePersistence.loadFromStorage();
     unsubscribePersistence = workspacePersistence.initPersistence();
 
     // Initialize keyboard handler
```

**Documentation:**

```diff
--- a/src/components/Workspace.svelte
+++ b/src/components/Workspace.svelte
@@ -180,8 +180,8 @@
     // Load workspace persistence first
+    // Async: server API load may take time, so await before proceeding (ref: DL-007)
     await workspacePersistence.loadFromStorage();
     unsubscribePersistence = workspacePersistence.initPersistence();
 
     // Initialize keyboard handler

```


**CC-M-007-005** (src/components/PriceMarkerManager.svelte) - implements CI-M-007-001

**Code:**

```diff
--- a/src/components/PriceMarkerManager.svelte
+++ b/src/components/PriceMarkerManager.svelte
@@ -28,8 +28,7 @@
   onMount(() => {
     // Load saved markers and set in workspace
     const symbol = localFormattedSymbol || formattedSymbol;
     if (!symbol) return;
-    priceMarkers = loadMarkers(symbol);
-    workspaceActions.setDisplayPriceMarkers(display.id, priceMarkers);
+    loadMarkers(symbol).then(m => { priceMarkers = m; workspaceActions.setDisplayPriceMarkers(display.id, m); });
 
     // Initialize interaction system after a short delay
```

**Documentation:**

```diff
--- a/src/components/PriceMarkerManager.svelte
+++ b/src/components/PriceMarkerManager.svelte
@@ -28,8 +28,7 @@
   onMount(() => {
     // Load saved markers and set in workspace
     const symbol = localFormattedSymbol || formattedSymbol;
     if (!symbol) return;
+    // loadMarkers is async (server API call) — use .then() (ref: DL-007)
     loadMarkers(symbol).then(m => { priceMarkers = m; workspaceActions.setDisplayPriceMarkers(display.id, m); });
 
     // Initialize interaction system after a short delay

```


### Milestone 8: Nginx TLS Proxy and Security Hardening

**Files**: docker/nginx/frontend.conf, docker/nginx/ssl.conf, src/lib/displayDataProcessor.js

**Requirements**:

- Nginx terminates TLS with HTTPS on port 443
- HTTP port 80 redirects to HTTPS
- /api/* requests proxied to backend Express server
- /ws WebSocket upgrade proxied to backend with correct headers
- Rate limiting on /api/login: 5 requests per minute per IP
- Security headers: HSTS, X-Content-Type-Options, X-Frame-Options

**Acceptance Criteria**:

- curl https://domain.com returns frontend
- curl http://domain.com redirects to https://
- wss://domain.com/ws connects to backend WebSocket
- https://domain.com/api/me returns 401 (auth required)
- Rate limiting blocks after 5 rapid login attempts
- Security headers present in all responses

**Tests**:

- Manual: curl-based verification of TLS, proxy, rate limiting, and security headers

#### Code Intent

- **CI-M-008-001** `docker/nginx/frontend.conf`: Replace current HTTP-only config with TLS-enabled config. Add HTTPS server block on port 443 with SSL certificate paths. Add HTTP->HTTPS redirect on port 80. Add location /api/* proxy_pass to backend:8081 with proxy_set_header for Host, X-Real-IP, X-Forwarded-For, X-Forwarded-Proto. Add location /ws for WebSocket upgrade: proxy_pass http://backend:8081 with Upgrade and Connection headers, proxy_http_version 1.1, read_timeout 3600s. Add rate limiting: limit_req_zone on /api/login at 5 requests per minute per IP. Add security headers: X-Content-Type-Options nosniff, X-Frame-Options DENY, Strict-Transport-Security max-age=31536000, Content-Security-Policy default-src self; script-src self; style-src self unsafe-inline; img-src self data:; connect-src self ws: wss:; frame-ancestors none. Keep existing SPA routing and static asset caching. (refs: DL-001, DL-005, DL-009, DL-017)
- **CI-M-008-002** `docker/nginx/ssl.conf`: SSL configuration snippet included by frontend.conf. SSL protocols: TLSv1.2 TLSv1.3. SSL ciphers: modern cipher suite preferring AEAD. SSL session cache: shared:SSL:10m. SSL session timeout: 1d. OCSP stapling enabled. DH params file path (optional, generate with openssl dhparam). This file is referenced by frontend.conf via include directive. (refs: DL-001)

#### Code Changes

**CC-M-008-001** (docker/nginx/frontend.conf) - implements CI-M-008-001

**Code:**

```diff
--- a/docker/nginx/frontend.conf
+++ b/docker/nginx/frontend.conf
@@ -1,31 +1,72 @@
-server {
-    listen 80;
-    server_name localhost;
-
-    root /usr/share/nginx/html;
-    index index.html;
-
-    # Enable gzip compression
-    gzip on;
-    gzip_vary on;
-    gzip_min_length 1024;
-    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
-
-    # Cache static assets
-    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
-        expires 1y;
-        add_header Cache-Control "public, immutable";
-    }
-
-    # Handle SPA routing
-    location / {
-        try_files $uri $uri/ /index.html;
-    }
-
-    # Health check endpoint
-    location /health {
-        access_log off;
-        return 200 "healthy\n";
-        add_header Content-Type text/plain;
-    }
-}
+# Rate limiting zone: 5 requests per minute per IP on /api/login
+limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
+
+# HTTP to HTTPS redirect
+server {
+    listen 80;
+    server_name localhost;
+    return 301 https://$host$request_uri;
+}
+
+# HTTPS server with TLS termination
+server {
+    listen 443 ssl;
+    server_name localhost;
+
+    include /etc/nginx/ssl/ssl.conf;
+
+    ssl_certificate /etc/nginx/ssl/fullchain.pem;
+    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
+
+    root /usr/share/nginx/html;
+    index index.html;
+
+    # Security headers
+    add_header X-Content-Type-Options nosniff always;
+    add_header X-Frame-Options DENY always;
+    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
+    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:; frame-ancestors 'none'" always;
+
+    # Enable gzip compression
+    gzip on;
+    gzip_vary on;
+    gzip_min_length 1024;
+    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
+
+    # Cache static assets
+    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
+        expires 1y;
+        add_header Cache-Control "public, immutable";
+    }
+
+    # API proxy to backend Express
+    location /api/ {
+        proxy_pass http://backend:8081;
+        proxy_set_header Host $host;
+        proxy_set_header X-Real-IP $remote_addr;
+        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
+        proxy_set_header X-Forwarded-Proto $scheme;
+    }
+
+    # Login endpoint with rate limiting
+    location /api/login {
+        limit_req zone=login burst=3 nodelay;
+        proxy_pass http://backend:8081;
+        proxy_set_header Host $host;
+        proxy_set_header X-Real-IP $remote_addr;
+        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
+        proxy_set_header X-Forwarded-Proto $scheme;
+    }
+
+    # WebSocket upgrade proxy
+    location /ws {
+        proxy_pass http://backend:8081;
+        proxy_http_version 1.1;
+        proxy_set_header Upgrade $http_upgrade;
+        proxy_set_header Connection "upgrade";
+        proxy_set_header Host $host;
+        proxy_set_header X-Real-IP $remote_addr;
+        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
+        proxy_set_header X-Forwarded-Proto $scheme;
+        proxy_read_timeout 3600s;
+    }
+
+    # Handle SPA routing
+    location / {
+        try_files $uri $uri/ /index.html;
+    }
+
+    # Health check endpoint
+    location /health {
+        access_log off;
+        return 200 "healthy\n";
+        add_header Content-Type text/plain;
+    }
+}

```

**Documentation:**

```diff
--- a/docker/nginx/frontend.conf
+++ b/docker/nginx/frontend.conf
@@ -1,31 +1,76 @@
+# Nginx rate limiting zone: 5 requests per minute per IP on /api/login (ref: DL-009).
+# This is the second layer of rate limiting; the first is application-level per-email lockout.
 limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
 
+# HTTP to HTTPS redirect — all traffic must use TLS (ref: DL-017)
 server {
     listen 80;
     server_name localhost;
     return 301 https://$host$request_uri;
 }
 
+# Main HTTPS server with TLS termination, security headers, and API/WS proxying.
+# Security headers provide defense in depth against XSS (ref: DL-017).
 server {
     listen 443 ssl;
     server_name localhost;
 
     include /etc/nginx/ssl/ssl.conf;
 
     ssl_certificate /etc/nginx/ssl/fullchain.pem;
     ssl_certificate_key /etc/nginx/ssl/privkey.pem;
 
     root /usr/share/nginx/html;
     index index.html;
 
+    # Security headers: CSP restricts script/img/connect sources (ref: DL-017).
+    # connect-src includes ws: wss: for WebSocket connections through Nginx proxy.
+    # CSP reporting deferred to v1.1.
     add_header X-Content-Type-Options nosniff always;
     add_header X-Frame-Options DENY always;
     add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
     add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:; frame-ancestors 'none'" always;
 
     # Enable gzip compression
     gzip on;
     gzip_vary on;
     gzip_min_length 1024;
     gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
 
     # Cache static assets
     location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
         expires 1y;
         add_header Cache-Control "public, immutable";
     }
 
+    # API proxy — forwards /api/* to Express backend (ref: DL-002).
+    # In production, this is same-origin, eliminating CORS entirely (ref: DL-018).
     location /api/ {
         proxy_pass http://backend:8081;
         proxy_set_header Host $host;
         proxy_set_header X-Real-IP $remote_addr;
         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
         proxy_set_header X-Forwarded-Proto $scheme;
     }
 
+    # Login rate limiting — second layer of defense after application-level per-email lockout (ref: DL-009).
+    # Nginx layer protects against brute-force across emails from a single IP.
     location /api/login {
         limit_req zone=login burst=3 nodelay;
         proxy_pass http://backend:8081;
         proxy_set_header Host $host;
         proxy_set_header X-Real-IP $remote_addr;
         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
         proxy_set_header X-Forwarded-Proto $scheme;
     }
 
+    # WebSocket upgrade proxy — browser sends cookies automatically on upgrade (ref: DL-005).
+    # 1-hour read timeout for long-lived WebSocket connections.
     location /ws {
         proxy_pass http://backend:8081;
         proxy_http_version 1.1;
         proxy_set_header Upgrade $http_upgrade;
         proxy_set_header Connection "upgrade";
         proxy_set_header Host $host;
         proxy_set_header X-Real-IP $remote_addr;
         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
         proxy_set_header X-Forwarded-Proto $scheme;
         proxy_read_timeout 3600s;
     }
 
     # Handle SPA routing
     location / {
         try_files $uri $uri/ /index.html;
     }
 
     # Health check endpoint
     location /health {
         access_log off;
         return 200 "healthy\n";
         add_header Content-Type text/plain;
     }
 }

```


**CC-M-008-002** (docker/nginx/ssl.conf) - implements CI-M-008-002

**Code:**

```diff
--- a/docker/nginx/ssl.conf
+++ b/docker/nginx/ssl.conf
@@ -0,0 +1,14 @@
+# SSL/TLS configuration for NeuroSense FX
+# Included by frontend.conf
+
+ssl_protocols TLSv1.2 TLSv1.3;
+ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
+ssl_prefer_server_ciphers off;
+
+ssl_session_cache shared:SSL:10m;
+ssl_session_timeout 1d;
+ssl_session_tickets off;
+
+# OCSP stapling
+ssl_stapling on;
+ssl_stapling_verify on;
+resolver 8.8.8.8 8.8.4.4 valid=300s;
+resolver_timeout 5s;

```

**Documentation:**

```diff
--- a/docker/nginx/ssl.conf
+++ b/docker/nginx/ssl.conf
@@ -0,0 +1,4 @@
+# SSL/TLS configuration for NeuroSense FX (ref: DL-017).
+# TLS 1.2+ with modern cipher suite. OCSP stapling enabled for certificate verification.
 # Included by frontend.conf

```


**CC-M-008-003** (src/lib/displayDataProcessor.js) - implements CI-M-008-001

**Code:**

```diff
--- a/src/lib/displayDataProcessor.js
+++ b/src/lib/displayDataProcessor.js
@@ -9,7 +9,12 @@
-  const wsUrl = import.meta.env.VITE_BACKEND_URL ||
-    (window.location.port === '5174' || window.location.port === '4173'
-      ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:${window.location.port === '5174' ? 8080 : 8081}`
-      : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:8080`);
+  if (import.meta.env.VITE_BACKEND_URL) {
+    return import.meta.env.VITE_BACKEND_URL;
+  }
+  if (window.location.port === '5174' || window.location.port === '4173') {
+    return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:${window.location.port === '5174' ? 8080 : 8081}`;
+  }
+  if (window.location.protocol === 'https:') {
+    return `${window.location.protocol.replace('http', 'ws')}//${window.location.host}/ws`;
+  }
+  return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:8080`;
   return wsUrl;

```

**Documentation:**

```diff
--- a/src/lib/displayDataProcessor.js
+++ b/src/lib/displayDataProcessor.js
@@ -9,7 +9,12 @@
+  // WebSocket URL construction updated for Nginx TLS proxy (ref: DL-005).
+  // When behind Nginx with HTTPS, connect to /ws path which proxies to backend.
+  // In production (HTTPS), cookies are automatically sent on the upgrade request.
+  // In dev (HTTP, no Nginx), connect directly to backend port.
   if (import.meta.env.VITE_BACKEND_URL) {
     return import.meta.env.VITE_BACKEND_URL;
   }
   if (window.location.port === '5174' || window.location.port === '4173') {
     return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:${window.location.port === '5174' ? 8080 : 8081}`;
   }
   if (window.location.protocol === 'https:') {
     return `${window.location.protocol.replace('http', 'ws')}//${window.location.host}/ws`;
   }
   return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:8080`;
   return wsUrl;

```


## Execution Waves

- W-001: M-001, M-008
- W-002: M-002
- W-003: M-003
- W-004: M-004
- W-005: M-005
- W-006: M-006
- W-007: M-007
