# System Admin Panel — Scope Document

**Date:** 2026-04-29 (originally scoped)
**Updated:** 2026-05-13 (architectural assessment + deployment reality check)
**Status:** Deferred — UI-only surfacing layer; SSH/CLI remains the operational control plane

**Related docs:**
- [hosting.md](../docs/hosting.md) — Production deployment plan (MUST/SHOULD/COULD checklist, troubleshooting). **Not yet executed.**
- [vps-deployment-pathway.md](../docs/vps-deployment-pathway.md) — VPS deploy steps (initial setup, updates, rollback, maintenance). **Not yet executed.**
- [local-dev-setup.md](../docs/local-dev-setup.md) — Local development environment with PostgreSQL and Redis.

---

## 0. Scope Clarification & Deployment Context

### This document's current state

This panel is a **UI surfacing layer only** — it does not add functionality that SSH or CLI cannot already provide. Every operation it proposes can be done via existing tooling (see below).

### What is real vs. proposed

| Layer | State | Notes |
|-------|-------|-------|
| **Local dev** | Running now | `./run.sh dev` — Node.js backend + Vite frontend on localhost, backed by local PostgreSQL 13 and Redis processes. This is the only deployed state. |
| **Docker Compose (prod)** | Written but not tested | `docker-compose.yml` defines 7 services but references files that don't exist (`healthcheck.js`, `metrics.js`, `nginx.conf`, `sites-available/`, `ssl/`). Would fail on `docker compose up`. |
| **hosting.md** | Proposal only | Accurately identifies the gaps (missing files, SSL, nginx config). These are implementation tasks, not completed work. |
| **vps-deployment-pathway.md** | Proposal only | Full SSH deploy workflow is written but never executed on a real VPS. |
| **Prometheus/Grafana configs** | Partially exist | Configs live in `docker/performance/` (for load testing), NOT at the paths `docker-compose.yml` references (`docker/prometheus/`, `docker/grafana/`). Monitoring does not run outside perf profiles. |

### Every admin panel operation has an existing CLI equivalent

| Operation | Local CLI Equivalent | Production CLI Equivalent |
|-----------|---------------------|--------------------------|
| Service status | `./run.sh status` or `ps aux \| grep node` | `docker compose ps` / `./run.sh status` |
| Restart backend | Ctrl+C → `./run.sh dev` | `docker compose restart backend` |
| View logs | Check local terminal output | `docker compose logs --tail=50 -f backend` |
| Trigger backup | N/A (local data) | `./scripts/backup.sh` or `docker compose exec postgres pg_dump -U neurosensefx neurosensefx > backups/backup.sql` |
| Restart all services | N/A (single process) | `docker compose restart` |
| User management | `psql neurosensefx_dev -c "SELECT * FROM users;"` | Same, against production PG |
| Rotate TV session | Edit `.env`, Ctrl+C → `./run.sh dev` | Edit `.env`, `docker compose restart backend` |
| Check connections | Tail the server logs for heartbeat output | `docker compose logs backend \| grep -i connected` |

**When this panel makes sense:** Only if non-technical operators need browser access without SSH keys. For a 1-5 user VPS where admins have shell access, SSH + CLI is faster and simpler for every operation listed above.

---

## 1. Purpose

Surface backend system management, connection control, and operational visibility into a **frontend admin panel** — *if and when* the production deployment path (hosting.md) is executed and non-SSH operators need browser access. Today, all operational control already exists via:

- **Local dev:** `./run.sh`, terminal output, local `psql`
- **Proposed production:** SSH + `docker compose`, `run.sh`, `scripts/backup.sh` as documented in [hosting.md](../docs/hosting.md) and [vps-deployment-pathway.md](../docs/vps-deployment-pathway.md)

---

## 2. Current State — What Exists Today

### 2.1 Service Management (CLI Only)

| Mechanism | File | Local Dev Status | Production (proposed) |
|-----------|------|-----------------|----------------------|
| `run.sh` | `/run.sh` (v2.1.0) | **Running** — starts/stops/restarts backend + frontend, snapshot management | `docker compose` equivalent needed |
| Docker Compose (prod) | `/docker-compose.yml` | Not used locally (PostgreSQL/Redis run as host processes) | Defines 7 services but **references missing files** (see §0 table above) |
| Docker Compose (dev) | `/docker-compose.dev.yml` | Not used | Adds MailHog, Adminer |
| Backup script | `/scripts/backup.sh` | Exists — uses hardcoded dev credentials | Works against production PG if credentials updated |
| Health check | `/docker-healthcheck.sh` | **Missing** — `healthcheck.js` does not exist | Compose references it for backend health probe; will crash on startup |

### 2.2 External Connections

| Connection | Location | Credentials | Reconnect? |
|-----------|----------|-------------|------------|
| cTrader Open API | `services/tick-backend/CTraderSession.js` | Stored in `.env` as plain text (not Docker secrets) | Yes — exponential backoff, max 20 attempts |
| TradingView WS | `services/tick-backend/TradingViewSession.js` | `TRADINGVIEW_SESSION_ID` env var | Yes — exponential backoff |
| PostgreSQL | `services/tick-backend/db.js` | Local dev: localhost, prod (proposed): Docker internal DNS | Pool-based |
| Redis | `services/tick-backend/sessionManager.js` | Local dev: `redis://localhost:6379`, prod: `redis://redis:6379` | Connection pooling |

### 2.3 Existing HTTP Endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /api/register` | No | User registration |
| `POST /api/login` | No | User login |
| `POST /api/logout` | Yes | User logout |
| `GET /api/me` | Yes | Current user info |
| `PUT/GET /api/workspace` | Yes | Workspace persistence |
| `PUT/GET /api/drawings/:symbol/:resolution` | Yes | Drawing persistence |
| `PUT/GET /api/markers/:symbol` | Yes | Price marker persistence |
| `POST /api/migrate` | Yes | Local data migration |
| **No `/health` endpoint** | — | Health check in hosting.md is a proposal, not implemented. `httpServer.js` does not serve it. |
| **No `/metrics` endpoint** | — | Prometheus scrape target exists but nothing responds. `metrics.js` is a proposal in hosting.md. |

### 2.4 Monitoring Stack (Not Running Outside Perf Profile)

Prometheus, Grafana, Node Exporter, and cAdvisor are defined in `docker-compose.yml` but their config files only exist in `docker/performance/` (for load testing), not at the paths compose references. They do **not** run as part of normal dev or proposed prod deployment. The pre-built dashboard (`neurosensefx-overview.json`) exists and is ready to go once configs are placed correctly.

### 2.5 Auth System

- bcrypt password hashing (12 rounds)
- Redis-backed sessions (30-day TTL)
- `requireAuth` middleware — no admin role exists
- Rate limiting: 10 failures / 15 min per email
- Audit log table exists but no UI to view it

---

## 3. Proposed Admin Panel — Feature Scope

### 3.1 Tier 1: Operational Visibility (Read-Only Dashboard)

Expose what's already instrumented without new backend APIs beyond health/status endpoints.

| Feature | Source Data | Backend Work | Precondition |
|---------|------------|-------------|--------------|
| **Service health grid** | Docker healthchecks + `/health` endpoint | Add `GET /api/admin/health` (all services) | Implement `/health` and `healthcheck.js` first (hosting.md §3) |
| **Connection status** | cTrader heartbeat, TradingView staleness detection | Add `GET /api/admin/connections` | Session classes need public state accessors — currently private |
| **Active sessions** | Redis session store | Add `GET /api/admin/sessions` | None needed |
| **System metrics** | Prometheus API (not running yet) | Proxy Grafana embed or fetch `/api/v1/query` | Fix prometheus/grafana config paths first (hosting.md §3 Option A/B) |
| **Audit log viewer** | `audit_log` table (already exists) | Add `GET /api/admin/audit-log` with pagination | None needed |
| **Uptime / version** | `app_config` table (already exists) | Add `GET /api/admin/system-info` | None needed |

### 3.2 Tier 2: Connection & Credential Management

Control external data connections from the browser.

| Feature | Source | Backend Work | Precondition |
|---------|--------|-------------|--------------|
| **cTrader connection status** | `CTraderSession.js` state (private fields) | Add `GET /api/admin/ctrader/status` — expose via public accessor or event listener | Add `isConnected()` getter to CTraderSession |
| **cTrader reconnect** | Existing `reconnect()` method | Add `POST /api/admin/ctrader/reconnect` | None needed — method exists at line 591 |
| **TradingView session status** | `TradingViewSession.js` state (private fields) | Add `GET /api/admin/tradingview/status` | Add `isConnected()` getter to TradingViewSession |
| **TradingView session update** | `TRADINGVIEW_SESSION_ID` env var | Add `PUT /api/admin/tradingview/session` — hot-swap session ID via `this.sessionId = newId; this.reconnect(newId)` | None needed |
| **cTrader token refresh** | Existing `refreshToken()` + `persistTokens()` flow | Add `POST /api/admin/ctrader/refresh-token` | None needed — methods exist at lines 256-298 |
| **Connection latency** | Round-trip time measurement | Add to connection status response | HealthMonitor has `getLatencyStats()` but it's private — expose it |
| **Data staleness alerts** | Existing staleness detection (60s cTrader, 5s TradingView) | Surface in dashboard | Expose health monitor's `isStale` state |

### 3.3 Tier 3: Service Lifecycle Control

Equivalent of `run.sh` commands via API. **High risk — needs safeguards.** See §7.5 for architectural assessment.

| Feature | CLI Equivalent | Backend Work |
|---------|---------------|-------------|
| **Restart backend** | `run.sh restart` / `docker compose restart backend` | Add `POST /api/admin/services/restart` (see §7.5 — process can't kill itself) |
| **Restart all services** | `docker-compose restart` | Add `POST /api/admin/services/restart-all` |
| **View logs (tail)** | `run.sh logs` / `docker compose logs --tail=100` | Add `GET /api/admin/logs?service=backend&lines=100` — tail the log files |
| **Trigger backup** | `scripts/backup.sh` | Add `POST /api/admin/backup` — invoke backup script or pg_dump |
| **Restore backup** | `scripts/backup.sh --restore` | Add `POST /api/admin/restore` with confirmation — restore needs stdin input, script will deadlock without it |
| **Clear Redis cache** | `redis-cli flushall` | Add `POST /api/admin/redis/flush` |
| **Database status** | `pg_isready` + connection pool stats | Add `GET /api/admin/database/status` |

**Safety requirements for Tier 3:**
- Admin role required (see 4.1)
- Confirmation dialogs for destructive actions
- Action audit logging (use existing `audit_log` table)
- Rate limiting on restart/flush endpoints
- Read-only mode toggle to prevent accidental changes

### 3.4 Tier 4: User Management

Manage the small user base (target: 1-5 users per VPS).

| Feature | Backend Work |
|---------|-------------|
| **User list** | Add `GET /api/admin/users` |
| **User detail** | Add `GET /api/admin/users/:id` |
| **Create user** | Add `POST /api/admin/users` |
| **Disable/enable user** | Add `PATCH /api/admin/users/:id/status` |
| **Reset password** | Add `POST /api/admin/users/:id/reset-password` |
| **View user sessions** | Add `GET /api/admin/users/:id/sessions` |
| **Revoke user session** | Add `DELETE /api/admin/sessions/:id` |
| **View user data** | Add `GET /api/admin/users/:id/data` (workspace, drawings, markers) |

### 3.5 Tier 5: Configuration & Settings

Runtime configuration without redeploy.

| Feature | Backend Work |
|---------|-------------|
| **App config CRUD** | Use existing `app_config` table — add `GET/PUT /api/admin/config` |
| **Maintenance mode toggle** | Use existing `maintenance_mode` field — add `PUT /api/admin/config/maintenance` |
| **Rate limit adjustment** | Modify rate limiter config at runtime — add `PUT /api/admin/config/rate-limits` |
| **Session TTL adjustment** | Modify Redis session TTL — add `PUT /api/admin/config/session-ttl` |
| **WebSocket port config** | Display only (requires restart) |
| **Database connection pool size** | Modify at runtime if pg pool supports it |

---

## 4. Infrastructure Requirements

### 4.1 Admin Role & Authorization

**Current state:** No admin roles. `requireAuth` middleware only checks valid session.

**Required changes:**
1. Add `role` column to `users` table (`user` | `admin`)
2. Add `requireAdmin` middleware (extends `requireAuth`)
3. Seed first admin user during deployment
4. Admin-only routes under `/api/admin/*`

**Migration SQL:**
```sql
ALTER TABLE users ADD COLUMN role VARCHAR(10) DEFAULT 'user' CHECK (role IN ('user', 'admin'));
UPDATE users SET role = 'admin' WHERE email = $1;  -- first admin
```

### 4.2 New Backend API Endpoints Summary

| Method | Path | Tier | Auth | Precondition |
|--------|------|------|------|-------------|
| GET | `/api/admin/health` | 1 | Admin | Implement `/health` in httpServer.js first |
| GET | `/api/admin/connections` | 1 | Admin | Expose session state from connection classes |
| GET | `/api/admin/sessions` | 1 | Admin | None |
| GET | `/api/admin/audit-log` | 1 | Admin | None |
| GET | `/api/admin/system-info` | 1 | Admin | None |
| GET | `/api/admin/ctrader/status` | 2 | Admin | Add `isConnected()` getter to CTraderSession |
| POST | `/api/admin/ctrader/reconnect` | 2 | Admin | None (method exists) |
| POST | `/api/admin/ctrader/refresh-token` | 2 | Admin | None (methods exist) |
| GET | `/api/admin/tradingview/status` | 2 | Admin | Add `isConnected()` getter to TradingViewSession |
| PUT | `/api/admin/tradingview/session` | 2 | Admin | None |
| POST | `/api/admin/services/restart` | 3 | Admin | See §7.5 — process can't kill itself; need separate approach |
| POST | `/api/admin/services/restart-all` | 3 | Admin | Same |
| GET | `/api/admin/logs` | 3 | Admin | Tail log files on disk |
| POST | `/api/admin/backup` | 3 | Admin | Invoke backup or pg_dump directly |
| POST | `/api/admin/restore` | 3 | Admin | Handle stdin confirmation or remove interactive prompt from script |
| POST | `/api/admin/redis/flush` | 3 | Admin | None |
| GET | `/api/admin/database/status` | 3 | Admin | Query pool stats |
| GET | `/api/admin/users` | 4 | Admin | None (after admin role added) |
| GET | `/api/admin/users/:id` | 4 | Admin | Same |
| POST | `/api/admin/users` | 4 | Admin | Same |
| PATCH | `/api/admin/users/:id/status` | 4 | Admin | Same |
| POST | `/api/admin/users/:id/reset-password` | 4 | Admin | Same |
| DELETE | `/api/admin/sessions/:id` | 4 | Admin | After sessions endpoint added |
| GET/PUT | `/api/admin/config` | 5 | Admin | None (app_config table exists) |
| PUT | `/api/admin/config/maintenance` | 5 | Admin | Same |

### 4.3 Frontend Route Structure

```
/admin                          — Dashboard (health, connections, metrics)
/admin/connections              — Connection management (Tier 2)
/admin/services                 — Service lifecycle (Tier 3)
/admin/users                    — User management (Tier 4)
/admin/settings                 — Configuration (Tier 5)
/admin/audit-log                — Audit log viewer (Tier 1)
```

### 4.4 New Files Required

**Backend:**
- `services/tick-backend/adminRoutes.js` — All admin API endpoints
- `services/tick-backend/adminMiddleware.js` — `requireAdmin` middleware
- `docker/postgres/init/03-admin-role.sql` — Role migration

**Frontend:**
- `src/components/admin/AdminDashboard.svelte` — Health overview
- `src/components/admin/ConnectionManager.svelte` — cTrader/TradingView control
- `src/components/admin/ServiceControl.svelte` — Restart/logs/backup
- `src/components/admin/UserManager.svelte` — User CRUD
- `src/components/admin/SystemSettings.svelte` — Config management
- `src/components/admin/AuditLogViewer.svelte` — Audit log table
- `src/stores/adminStore.js` — Admin state management

---

## 5. Relationship to Hosting Plans

### 5.1 VPS Deployment Pathway (Proposed, Not Executed)

Per `docs/vps-deployment-pathway.md` and `plans/vps-deployment.md`:
- Target: Single VPS (Hetzner CX22, ~€4.50/month)
- Scale: 1-5 users
- Docker Compose orchestration
- Nginx reverse proxy with SSL

**Status:** None of these steps have been executed on a real VPS. The deployment pathway is a written plan — the `docker-compose.yml` references files that don't exist, and no SSH access to any remote host is configured.

The admin panel would only be useful **after** this deployment pathway is proven working. Until then, it's building a UI on top of infrastructure that hasn't been validated.

### 5.2 What Changes for Production (Once Deployed)

| Concern | Local Dev | Proposed Prod (SSH) | With Admin Panel (Future) |
|---------|-----------|--------------------|--------------------------|
| Restart services | Ctrl+C → `./run.sh dev` | `ssh` → `docker-compose restart` | Browser → API call |
| Check health | Terminal output / `curl localhost:8080` | `ssh` → `./run.sh status` | Browser → dashboard |
| Rotate TV session | Edit `.env`, Ctrl+C → `./run.sh dev` | `ssh` → edit `.env` → restart | Browser → settings page |
| Backup DB | N/A (local data) | `ssh` → `./scripts/backup.sh` | Browser → backup button |
| View logs | Terminal output | `ssh` → `docker-compose logs` | Browser → log viewer |
| Manage users | `psql neurosensefx_dev -c "..."` | `ssh` → `psql ...` | Browser → user management |
| Monitor metrics | `docker stats --no-stream` | `ssh` → `docker stats` or Grafana | Embedded in admin panel |

### 5.3 Security Considerations for Production (If/When Deployed)

- Admin panel should be behind the same Nginx auth or accessible only to admin-role users
- Tier 3 (restart/flush) endpoints should have confirmation + audit
- Grafana can be restricted to localhost-only, with metrics proxied through admin API
- Rate limit admin endpoints to prevent abuse
- Consider IP whitelist for admin routes in Nginx

---

## 6. Implementation Priority

| Priority | Tier | Effort | Value | Notes |
|----------|------|--------|-------|-------|
| **P0** | 1 — Operational Visibility | Medium | High | But requires `/health` and `healthcheck.js` to be implemented first (hosting.md prereqs) |
| **P1** | 4 — User Management | Medium | Medium | Essential for multi-user VPS. Small scope (1-5 users). |
| **P2** | 2 — Connection Management | Medium | Medium | TradingView session rotation is a frequent pain point. |
| **P3** | 5 — Configuration | Low | Low | `app_config` table already exists. |
| **P4** | 3 — Service Lifecycle | High | Low | See §7.5 — may be unnecessary for single-VPS; SSH access to `run.sh` may suffice. |

### Prerequisites Before Building Anything in This Scope

The admin panel cannot be built or tested until hosting.md's MUST items are implemented:

1. `/health` endpoint on httpServer.js
2. `healthcheck.js` script (referenced by docker-compose.yml health probe)
3. `metrics.js` handler for Prometheus scraping
4. `docker/nginx/nginx.conf` + `sites-available/` directory
5. `docker/prometheus/prometheus.yml` and/or `docker/grafana/provisioning/` configs (or comment out prometheus/grafana services from compose)

### Recommended Phases

**Phase 0 — Get production deploy working (hosting.md):**
- Implement all MUST items from hosting.md section 3
- Validate on a real VPS (or at least `docker compose up` works end-to-end)

**Phase 1 — Foundation + Visibility:**
- Admin role migration
- `requireAdmin` middleware
- Health dashboard (Tier 1)
- Audit log viewer

**Phase 2 — User Management:**
- User CRUD (Tier 4)
- Session management

**Phase 3 — Connection Control:**
- cTrader/TradingView status + reconnect (Tier 2)
- Session ID hot-swap

**Phase 4 — Settings & Lifecycle:**
- App config management (Tier 5)
- Service restart/backup (Tier 3) — with full safeguards, if still desired

---

## 7.5 Architectural Assessment

**Date:** 2026-05-13
**Assessed by:** Architecture review (codebase-grounded)
**Status:** Guidance — adopt where it fits your ops model

### What Holds Up

| Aspect | Verdict |
|--------|---------|
| Tiered prioritization (visibility → users → connections → lifecycle) | Solid. Sequencing is sound. |
| Auth model (`role` column on `users`, `requireAdmin` middleware, `/api/admin/*` prefix) | Standard and correct. |
| Connection management APIs (Tier 2) | Feasible. Both session classes already accept reconnection at runtime. TradingView session ID hot-swap is a one-liner: update `this.sessionId` + call `reconnect()`. cTrader token refresh is already wired to `persistTokens()` which writes to `.env`. |
| User management (Tier 4) | Appropriate scope for 1-5 users. |
| Config management (Tier 5) | `app_config` table exists, clean path via CRUD on the existing table. |

### Where It Cracks

**Tier 3 (service lifecycle restart/flush) fights the deployment model.** The backend process cannot restart itself: `pkill -f "node.*server.js"` in `run.sh` kills the very Node.js process handling the API request. In Docker, killing the main process triggers a container restart — so a "hot" browser restart is really just `docker-compose restart` wrapped in an HTTP endpoint with confirmation dialogs and audit logging. That is not wrong per se, but for a 1-5 user VPS, SSH + CLI (`run.sh restart`) is simpler than building, securing, and maintaining an additional API surface.

### Risk Summary

25 new admin endpoints on a system serving 1-5 users is **high leverage, low forgiveness**. One buggy restart endpoint = downtime. The scope doc's safety requirements (admin role, confirmation dialogs, audit logging, rate limiting) are the right ones. No pushback there.

### Tiered Verdict

| Tier | Go / Reconsider |
|------|-----------------|
| 1 — Operational Visibility | **Go.** Read-only, data already exists in PG + Redis. |
| 2 — Connection Management | **Go.** Session classes support runtime reconnect/refresh. |
| 3 — Service Lifecycle | **Reconsider.** For a single-VPS deployment, SSH access to `run.sh` is simpler than an API. Drop unless operators won't have SSH keys. If kept, scope to backup + logs only (no restart). |
| 4 — User Management | **Go.** Small, well-bounded CRUD. |
| 5 — Configuration | **Go.** Existing `app_config` table, low risk. |

### Leanest Path

Phase 0 (get hosting.md deployed) → Phase 1 (visibility) → Phase 2 (user management) → Phase 3 (connection control). Defer or drop Tier 3 unless there is a concrete constraint preventing SSH access to the VPS.

---

## 7. Out of Scope

- **Auto-scaling** — single VPS architecture, not Kubernetes
- **Multi-tenant** — single instance, 1-5 users
- **Infrastructure provisioning** — VPS creation, DNS, SSL cert issuance stay manual
- **Frontend redeployment** — rebuilding the Svelte app requires a build step, not suitable for runtime API
- **cTrader account management** — API credentials come from cTrader dashboard, not from our panel
- **Database schema migrations** — stay as SQL init scripts in Docker
- **Email/notification system** — no alerting pipeline (Grafana handles this separately)

---

## 8. Key Files Reference

| File | Relevance | Status |
|------|-----------|--------|
| `/run.sh` | All service management commands to surface | Running (local dev) |
| `/docker-compose.yml` | Production service definitions | Written but references missing files |
| `/services/tick-backend/CTraderSession.js` | cTrader connection logic | Exists, session state is private |
| `/services/tick-backend/TradingViewSession.js` | TradingView connection logic | Exists, session state is private |
| `/services/tick-backend/httpServer.js` | HTTP server — add admin routes here | Exists, missing `/health` and `/metrics` |
| `/services/tick-backend/middleware.js` | Auth middleware — extend with admin role | Exists, no admin variant |
| `/services/tick-backend/authRoutes.js` | Auth endpoints — reference for admin patterns | Exists |
| `/services/tick-backend/sessionManager.js` | Redis session management | Exists |
| `/services/tick-backend/db.js` | Database connection pool | Exists |
| `/docker/postgres/init/02-auth-tables.sql` | Users table — needs role column | Exists |
| `/docker/postgres/init/01-init.sql` | app_config and audit_log tables | Exists |
| `/scripts/backup.sh` | Backup/restore logic to surface | Exists, hardcoded dev credentials |
| `/docs/hosting.md` | Production deployment plan (MUST items) | Proposal — not executed |
| `/docs/vps-deployment-pathway.md` | VPS deploy steps | Proposal — never executed |
| `/plans/vps-deployment.md` | Deployment implementation plan | Planning doc |
