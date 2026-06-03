# Non-Frontend Architectural Assessment

**Date**: 2026-06-03
**Scope**: Backend services (`services/`), backtester (`backtester/`), infrastructure (Docker, scripts, configs)
**Excludes**: Frontend (`src/`) — covered in `frontend-architecture-assessment-2026-06.md`

## Project Context

- **Deployment model**: Local-first. Remote VPS is a future option, not current priority. Incomplete Docker/infra configs are expected — not urgent.
- **Backend**: Open to incremental robustness/reliability fixes. No big rewrites.
- **Backtester**: Side project, not core. May not stay in repo. Findings valid but low priority.

---

## Executive Summary

The non-frontend codebase has **solid architectural bones** — good module decomposition, proper authentication, and resilient reconnection patterns. Issues fall into three tiers based on current project priorities:

**Actionable now (affects local dev today)**:
| Area | Issue | Why it matters now |
|------|-------|--------------------|
| Backend | Tokens written to `.env` file | Race condition can corrupt .env, breaking local sessions |
| Backend | No WebSocket input validation | Malformed messages from any client cause unpredictable behavior |
| Backend | 164 unconditional debug logs | Clutters local dev output, hides real issues |
| Backend | Double dotenv loading | Can cause subtle config inconsistencies |

**Deferred (remote deployment, not current priority)**:
| Area | Issue | Why deferred |
|------|-------|--------------|
| Infrastructure | Production Docker build broken | Only matters for remote deployment |
| Infrastructure | Compose mounts non-existent paths | Only matters for `docker-compose up` in production mode |
| Infrastructure | Missing `/health` endpoint | Only matters for container orchestrators |
| Infrastructure | Backend Dockerfile COPY path | Only matters for container builds |
| Infrastructure | Hardcoded credentials in compose files | Local dev only, not exposed externally |

**Informational (backtester, side project)**:
| Area | Issue | Priority |
|------|-------|----------|
| Backtester | Zero test coverage | Fix if it becomes a core tool |
| Backtester | TZ handling fragility | Can produce wrong bars |
| Backtester | Divergent metric formulas | Same data, different numbers |

---

## Issues by Category

### Category A: Actionable Now (affects local dev)

#### A-B1. cTrader tokens written to `.env` file on disk
- `CTraderSession.js:280-298` — `persistTokens()` writes access/refresh tokens via `fs.writeFileSync`
- No file locking, no atomic write, plaintext credentials
- Concurrent token refreshes can cause interleaved writes (race condition at lines 258-278)
- **Why now**: Race condition can corrupt `.env`, breaking local dev sessions

#### A-B2. No input validation on WebSocket messages
- `WebSocketServer.js:286-348` — JSON is parsed but `symbol`, `resolution`, `source`, timestamps are not validated
- Arbitrary strings flow into cTrader API calls and data processing
- **Why now**: Any client can trigger unexpected behavior deep in the call chain

#### A-B3. Excessive diagnostic logging (164 unconditional console.log)
- 164 `console.log` calls across 16 files, many labeled `[DEBUGGER:]` / `[DEBUG_TRACE]`
- No log level gating. Logs full message contents including subscription data on every message
- **Why now**: Clutters local dev output, hides real issues, makes debugging harder

#### A-B4. Double dotenv loading
- `server.js:5` loads `.env` from project root, `CTraderSession.js:3` loads again at require time with different path
- **Why now**: Can cause subtle config inconsistencies when env vars change between loads

#### A-B5. Unbounded memory growth in MarketProfileService
- `MarketProfileService.js:137-146` caps levels at 3000 in `onM1Bar` but `initializeFromHistory` (line 369-378) has no guard
- `pendingBars` silently drops oldest bar when limit exceeded (line 112-114)
- **Why now**: Long-running local dev sessions can accumulate memory without the user noticing

#### A-B6. `broadcastTick` is dead code
- `WebSocketServer.js:650-657` defined but never called (DataRouter handles this instead)
- **Why now**: Confusing during local dev, should be removed

#### A-B7. `_receivedAt` mutates source tick object
- `DataRouter.js:19,29` mutates incoming tick/candle by setting `_receivedAt`
- **Why now**: Hidden side effect can cause confusing bugs when ticks are routed through multiple paths

#### A-B8. WebSocket heartbeat logs every 15s even with 0 clients
- `WebSocketServer.js:112-143` — generates 4 noise logs per minute on idle
- **Why now**: Annoying during local dev, obscures real log output

#### A-B9. 21 scattered `process.env` references, no centralized config
- Throughout backend modules. Config read inline in constructors and at module level
- **Why now**: Makes it unclear what env vars each module requires, hard to test

### Category B: Deferred (remote deployment)

#### B-I1. Production Docker build is broken
- `Dockerfile:37` calls `npm run build:prod` but only `build` exists in `package.json`
- `services/tick-backend/Dockerfile:15` uses `COPY ../../../package*.json` — impossible in Docker build context
- `scripts/build-production.js:225` also calls the non-existent `build:prod`
- **Deferred**: Only matters when building production images for remote deployment

#### B-I2. Production docker-compose mounts non-existent paths
- `docker-compose.yml` mounts `docker/nginx/sites-available/`, `docker/nginx/ssl/`, `docker/prometheus/prometheus.yml`, `docker/grafana/provisioning/` — none exist
- Docker refuses to start with missing bind mount sources
- **Deferred**: Only matters for `docker-compose up` in production mode

#### B-I3. No `/health` endpoint despite Docker health checks expecting one
- `Dockerfile:62` and `Dockerfile.dev:25` run `curl -f http://localhost:8081/health`
- `httpServer.js` has no `/health` route. `docker-healthcheck.sh` hardcodes port 8080 (wrong for production 8081)
- **Deferred**: Only matters for container orchestrators; `./run.sh dev` doesn't use Docker health checks

#### B-I4. Backend Dockerfile COPY path impossible
- `services/tick-backend/Dockerfile:15` — `COPY ../../../package*.json` outside build context
- **Deferred**: Only matters when building backend container

#### B-I5. Hardcoded credentials in docker-compose files
- `docker-compose.dev.yml:67,119` has `PG_PASSWORD=neurosensefx_dev_123`, `docker-compose.perf.yml:56` has hardcoded Grafana admin password
- **Deferred**: Local dev only, not exposed externally

#### B-I6. Dev compose passes cTrader secrets as environment variables
- `docker-compose.dev.yml:55-59` — visible in `docker inspect`, process listings
- **Deferred**: Local dev only, single-user machine

#### B-I7. No `.dockerignore` file
- Docker builds copy `node_modules/`, `.git/`, test results, debug files into build context
- **Deferred**: Only impacts build speed for remote deployment images

#### B-I8. Node.js version mismatch (18 vs 20) across Dockerfiles
- `Dockerfile` uses `node:20-alpine`, `Dockerfile.frontend` and dev Dockerfiles use `node:18-alpine`
- **Deferred**: Only matters for container builds

#### B-I9. Production frontend mounts `./dist` unused by nginx
- `docker-compose.yml:23` mounts `./dist:/app/dist:ro` but nginx stage serves from `/usr/share/nginx/html`
- **Deferred**: Only matters in production compose

#### B-I10. Backend volume mount overrides build-time library copy
- `docker-compose.yml:73` mounts `./libs/cTrader-Layer` over baked-in copy, negating Docker reproducibility
- **Deferred**: Only matters in production compose

#### B-I11. `privileged: true` for cAdvisor
- `docker-compose.perf.yml:97` grants full host access
- **Deferred**: Only matters in performance monitoring stack

#### B-I12. CORS origin hardcoded to `localhost:5174`
- `httpServer.js:19` — breaks in Codespaces, remote dev
- **Deferred**: Only matters for remote dev environments

#### B-I13. No graceful HTTP server shutdown
- SIGINT handler closes WebSocket but not Express server
- **Deferred**: Only matters for clean container shutdown; local dev uses Ctrl+C which is forceful anyway

#### B-I14. `docker-healthcheck.sh` checks wrong port in production
- Line 13 checks `localhost:8080` (dev), production uses `8081`
- **Deferred**: Only matters in production containers

#### B-I15. `Dockerfile.frontend` has unused `deps` stage
- `Dockerfile.frontend:9-11` creates stage never referenced
- **Deferred**: Minor, only affects build time

### Category C: Informational (backtester)

#### C-K1. Zero test coverage
- No test files exist. Simulation engine is a pure function, straightforward to test. Correctness depends on manual verification.
- **Action if backtester becomes core**: Add unit tests for `simulate_trades` with synthetic OHLC, parser tests with known CSV, regression test for trade #35

#### C-K2. TZ-naive vs TZ-aware datetime comparison can silently include wrong bars
- `sl_tp_analyzer.py:515` strips timezone, line 511 compares against tz-aware DataFrame index
- pandas behavior varies by version — some silently coerce, others raise

#### C-K3. Fallback exits create phantom P/L
- `sl_tp_analyzer.py:562-575` — trades that don't hit SL/TP exit at last bar close. Metrics include these without flagging.

#### C-K4. Bar count wrong for mid-bar entries
- `sl_tp_analyzer.py:537` reports `idx+1` bars but doesn't account for skipped entry bar. `avg_bars` is misleading.

#### C-K5. Divergent metric computations across files
- `sl_tp_analyzer.py`, `analyze_sweep.py`, `deep_analysis.py` each compute Sharpe/expectancy/profit factor with different formulas.

#### C-K6. Global mutable `ohlc_cache` cross-contaminates runs
- `sl_tp_analyzer.py:114` at module scope. Stale data if `simulate_trades` called without `ohlc_cache.clear()`.

#### C-K7. `parse_datetime` silently returns `datetime(2000,1,1)` on failure
- `sl_tp_analyzer.py:229-230` — bad date parsing produces invisible failures.

#### C-K8. Cache key collision risk (day-level granularity)
- `sl_tp_analyzer.py:125` — same symbol, same day, different time ranges share a cache entry.

### ~~Category D: Low-priority tooling/misc~~ — RESOLVED

All 15 items resolved in hygiene pass (2026-06-03):

| ID | Resolution |
|----|------------|
| D-1 | `git add .` replaced with explicit staging in `run.sh` |
| D-2 | `$API_KEY` injection fixed — piped via stdin with escaping |
| D-3 | sed JSON replaced with `node -e` + proper parse/stringify |
| D-4 | Security warning added to `.env.example` |
| D-5 | Divisor 100000 documented in `calculatePrice` JSDoc |
| D-6 | No-op progress check collapsed to single assignment |
| D-7 | Body size limit documented on persistence routes |
| D-8 | `sl_actual` column added to backtester console + CSV output |
| D-9 | 35-week constant cross-reference comment added |
| D-10 | `version: '3.8'` removed from all 3 compose files |
| D-11 | 10 dead scripts deleted, docs cleaned |
| D-12 | 9 unused deps removed from backend `package.json` |
| D-13 | `moment` replaced with native Date math, removed from package.json |
| D-14 | Package renamed to `neurosensefx-backend`, engine → node >= 18 |
| D-15 | `stream-real.cjs` deleted |

---

## Strengths Worth Preserving

These patterns are done well and should be maintained as the codebase evolves:

1. **Backend module decomposition** — CTraderSession delegates to 3 focused sub-modules (~120 lines each). TradingView follows same pattern. Cross-cutting concerns separated. Avoids god-file pattern.

2. **Reconnection with exponential backoff + jitter** — `ReconnectionManager` prevents thundering herd. Shared by both data sources.

3. **Request coalescing** — `RequestCoordinator` deduplicates identical in-flight requests and rate-limits API calls (300ms cTrader, 500ms TradingView).

4. **Authentication** — Session cookies (not JWT), SHA-256 hashed tokens in Redis, httpOnly + sameSite, bcrypt with 12 rounds, per-email rate limiting, audit logging, WS upgrade validates cookie.

5. **Optimistic locking on drawings** — Version-based conflict detection with 409 responses.

6. **Graceful degradation at startup** — Continues in degraded mode if a data source fails, rather than crashing.

7. **Subscription lifecycle management** — Auto-unsubscribe when last client disconnects, re-subscription after reconnect.

8. **Backtester simulation soundness** — Correct look-ahead bias prevention (skips entry bar), three-mode ambiguity resolution (conservative/optimistic/neutral).

9. **Robust trade log parser** — Auto-detects header row, delimiter, handles cTrader export quirks.

10. **Production nginx config** — TLS 1.2+, HSTS, CSP, rate limiting on login, gzip, SPA routing.

11. **Idempotent PostgreSQL init** — `IF NOT EXISTS`, proper indexes, foreign keys with `ON DELETE CASCADE`.

---

## Files Assessed

### Backend Services (24 source files)
- `services/tick-backend/server.js` — entry point, startup orchestration
- `services/tick-backend/httpServer.js` — Express HTTP server
- `services/tick-backend/WebSocketServer.js` — WS server, client management, message routing
- `services/tick-backend/CTraderSession.js` — cTrader connection lifecycle, token persistence
- `services/tick-backend/CTraderDataProcessor.js` — OHLC fetching, price calculation, chunking
- `services/tick-backend/CTraderSymbolLoader.js` — Symbol discovery and caching
- `services/tick-backend/CTraderEventHandler.js` — cTrader event dispatch
- `services/tick-backend/TradingViewSession.js` — TradingView connection lifecycle
- `services/tick-backend/TradingViewCandleHandler.js` — TV candle processing
- `services/tick-backend/TradingViewSubscriptionManager.js` — TV subscription management
- `services/tick-backend/TradingViewDataPackageBuilder.js` — TV data packaging
- `services/tick-backend/RequestCoordinator.js` — Request deduplication and rate limiting
- `services/tick-backend/SubscriptionManager.js` — Per-client subscription tracking
- `services/tick-backend/StatusBroadcaster.js` — Status updates to clients
- `services/tick-backend/DataRouter.js` — Tick/candle routing to subscribed clients
- `services/tick-backend/HealthMonitor.js` — Stale connection detection
- `services/tick-backend/MarketProfileService.js` — Market profile computation
- `services/tick-backend/TwapService.js` — TWAP calculation
- `services/tick-backend/authRoutes.js` — Authentication endpoints
- `services/tick-backend/persistenceRoutes.js` — Drawing/workspace persistence
- `services/tick-backend/utils/ReconnectionManager.js` — Reconnection with backoff
- `services/tick-backend/utils/ConfigManager.js` — Configuration management

### Backtester (5 source files)
- `backtester/sl_tp_analyzer.py` — Main simulation engine + CLI (1171 lines)
- `backtester/analyze_sweep.py` — Sweep metrics post-processing (191 lines)
- `backtester/deep_analysis.py` — Time/seasonal analysis (327 lines)
- `backtester/debug_trade_35.py` — Trade debug script (207 lines)
- `backtester/debug_trade35_trace.py` — Simulation trace script (292 lines)

### Infrastructure (30+ files)
- `Dockerfile`, `Dockerfile.frontend`, `Dockerfile.performance`
- `services/tick-backend/Dockerfile`, `services/tick-backend/Dockerfile.dev`
- `docker-compose.yml`, `docker-compose.dev.yml`, `docker-compose.perf.yml`
- `docker/nginx/frontend.conf`, `docker/postgres/init/*.sql`
- `run.sh`, `docker-healthcheck.sh`
- `scripts/*.sh`, `scripts/*.js`
- `vite.config.js`, `vitest.config.js`, `playwright.config.cjs`, `package.json`
- `test-candles-v2.mjs`, `test-math-expression-candles.cjs`
