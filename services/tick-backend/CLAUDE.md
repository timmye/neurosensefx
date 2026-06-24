# services/tick-backend/

WebSocket data streaming and HTTP API backend service.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `CTraderSession.js` | cTrader connection orchestration; `connect()` is a FAST handshake (open→authenticate→`loadAllSymbols`→`startHeartbeat`→emit `'connected'`) with a DETACHED post-connect restore (`_beginRestore`/`_runRestore`, exposed as `this.restorePromise` and `'restoreStart'`/`'restoreComplete'`); `restoreSubscriptions()` uses a bounded-concurrency throttled runner (`_runBounded`/`_sendWithBudget`/`_sendWithRetry`), a Phase-3 defer-queue, and `ctraderErrorCode` classification; delegates to CTraderSymbolLoader, CTraderDataProcessor, CTraderEventHandler | Debugging connection lifecycle, modifying reconnection/restore behavior, troubleshooting data flow issues |
| `CTraderSymbolLoader.js` | Symbol loading, mapping, and symbol info caching for cTrader; **persistent across reconnects** (`setConnection()` re-binds without recreating, so `symbolInfoCache` + maps survive); `loadedOnce` flag; `refreshAllSymbols()` does an atomic map swap preserving `symbolInfoCache` | Working with symbol lookups, adding symbol-related features, debugging symbol data/restore issues |
| `CTraderDataProcessor.js` | Data processing and calculations for cTrader (price calculation, ADR, OHLC extraction, historical bars) | Modifying data processing logic, adding calculations, fixing data transformation bugs |
| `CTraderEventHandler.js` | Event processing for cTrader spot events (trendbar and spot event handlers) | Debugging tick data processing, modifying event handling logic, fixing data extraction |
| `TradingViewCandleHandler.js` | Candle processing logic for TradingView (D1/M1 handlers, ADR calculation, data package emission) | Debugging candle processing, modifying ADR logic, fixing data package emission timing |
| `SubscriptionManager.js` | Client and backend subscription tracking with coalescing support | Debugging subscription state, understanding coalescing logic, modifying subscription lifecycle |
| `RequestCoordinator.js` | Symbol data request handling with fetch timeout and retry logic; `handleTradingViewRequest` **dedupes the `candle` listener per symbol** (one in-flight per symbol; fans data + `onComplete` to all waiting clients — D1) and skips subscribe when TV is disconnected (D4) | Debugging data fetching, modifying retry behavior, understanding request coordination |
| `StatusBroadcaster.js` | Status message broadcasting to subscribed clients | Understanding status propagation, modifying broadcast logic, debugging client notifications |
| `DataRouter.js` | Data routing from cTrader/TradingView sessions to WebSocket clients using MessageBuilder | Understanding data flow, modifying routing logic, debugging message delivery |
| `HealthMonitor.js` | Centralized staleness detection service; tracks lastTick timestamp, emits stale/tick_resumed events | Understanding health monitoring logic, debugging staleness detection, modifying timeout thresholds |
| `supervision/FeedSupervisor.js` | Owns feed lifecycle via an explicit state machine; injectable clock/transport; applies RetryPolicy, observes HealthSensor, enforces connect-phase deadline (the hang-after-open fix); per-feed isolation; emits ObservableState. Additive `restoreActive` gate: `_wireFeed` sets it from the feed's `'restoreStart'`/`'restoreComplete'` and `_reactToHealth` HOLDS (no force-reconnect) on DEGRADED during restore — STALE still reconnects | Connection lifecycle, recovery behavior, debugging feed health, adding a supervised feed |
| `supervision/CTraderTransportAdapter.js` | Transport over cTrader-Layer; resolves DNS→IP itself to bypass the WSL2 TLS fallback trap; per-RPC TTL + reject-on-close around `sendCommand`. **`open()` is idempotent** (`_opened` guard) — the supervisor opens the transport, then `CTraderSession.connect()` calls `open()` again; without the guard that created a SECOND connection and cTrader killed the duplicate @ ~28s (the runtime loop's true root cause, found live). **`sendRaw()` writes a raw clientMsgId-free `ProtoHeartbeatEvent`** (frame `00000004 0833 1200`, built via the library encoder) directly to the TLS socket captured by a scoped `tls.connect` wrap keyed to the cTrader host — the server echoes it (keeps the idle connection alive) and it bypasses the library command map (no heartbeat promise leak). Falls back to `sendHeartbeat()` if no socket was captured (fakes) | Connection lifecycle, transport/TTL, the raw-heartbeat seam, debugging the cTrader reconnect loop |
| `MarketProfileService.js` | Market Profile calculation with bucket size determination and level aggregation | Understanding Market Profile logic, modifying bucket calculations, debugging profile generation |
| `TradingViewDataPackageBuilder.js` | Builds TradingView-compatible data packages | Building data packages for TradingView, debugging data format |
| `TradingViewSession.js` | TradingView protocol session handler (`tradingview-ws` lib; **standalone, not supervised**); self-recovers via `ReconnectionManager` (never gives up) + `HealthMonitor` (5-min staleness). Has a **connect-phase deadline** (`config.tvConnectTimeoutMs`, default 15s — D2) and an `isConnected()` accessor (D4). Note: `tradingview-ws@0.0.3` emits no close/error events — staleness is the only dead-connection detector | Debugging TradingView connection, modifying session lifecycle |
| `TradingViewSubscriptionManager.js` | Manages TradingView symbol subscriptions | Adding subscription types, debugging symbol subscription flow |
| `TwapService.js` | TWAP (Time-Weighted Average Price) service | Implementing TWAP calculations, debugging time-weighted pricing |
| `WebSocketServer.js` | WebSocket server for frontend connections | Debugging WebSocket connections, modifying server configuration |
| `httpServer.js` | Express HTTP server alongside WebSocket server | Adding HTTP endpoints, modifying auth/persistence routes |
| `authRoutes.js` | Register, login, logout endpoints | Modifying authentication flow, adding auth endpoints |
| `persistenceRoutes.js` | CRUD routes for workspaces, drawings, price markers | Adding persistence endpoints, modifying data sync |
| `middleware.js` | Auth middleware (session validation) | Adding protected routes, modifying auth checks |
| `sessionManager.js` | Redis-backed session create/validate/destroy | Debugging session issues, modifying session TTL or storage |
| `db.js` | PostgreSQL connection and query helpers | Adding database queries, debugging persistence |
| `server.js` | WebSocket server entry point; constructs `FeedSupervisor` and drives the supervised cTrader feed; exposes `GET /health` and dev-only `POST /admin/reconnect` | Starting backend, debugging server startup, understanding supervised feed wiring |
| `Dockerfile` | Production container build definition | Building backend container |
| `Dockerfile.dev` | Development container build definition | Building backend dev container |
| `README.md` | Backend architecture and API documentation | Understanding backend design, API reference |
| `package.json` | Backend dependencies and scripts | Adding packages, running backend scripts |
| `.env.example` | Environment variable template for backend configuration | Setting up backend environment |

## Subdirectories

| Directory | What | When to read |
| --------- | ---- | ------------ |
| `utils/` | Shared utility modules (ReconnectionManager, MessageBuilder, Logger, ctraderErrorCode) | Understanding reconnection logic, using message building utilities, adding shared utilities |
| `utils/Logger.js` | Tiny dependency-free logging layer; every line prefixed with an ISO-8601 ms timestamp; exports `createLogger` and `describeError(err)` (surfaces `errorCode`/`description` from raw cTrader rejection payloads) | Adding module logging, diagnosing reconnect loops from `backend.log`, rendering cTrader rejections |
| `utils/ctraderErrorCode.js` | Classifies cTrader subscribe/symbol `errorCode` rejections into `ALREADY_SUBSCRIBED`/`RATE_LIMIT`/`PERMANENT`/`UNKNOWN` (used by the restore runner) | Modifying restore error handling, adding new retryable/permanent error codes |
| `supervision/` | Feed recovery & supervision tier: `FeedSupervisor` (lifecycle owner), `RetryPolicy` (never-terminating capped+jittered backoff), `FeedState` (explicit state machine, no terminal DEAD state), `HealthSensor` (data-tick vs heartbeat, never-received=stale), `CTraderTransportAdapter` (Transport over cTrader-Layer; resolves DNS→IP itself to bypass the WSL2 TLS fallback trap; per-RPC TTL + reject-on-close around `sendCommand`), `RealClock`, `interfaces.js` (Transport/Feed/Clock contracts) | Connection lifecycle, recovery, feed health, transport adapter (DNS/TTL) |
| `specs/` | cTrader API specifications and OpenAPI definitions | Looking up cTrader API message schemas, debugging protobuf definitions |
| `docs/` | Backend design documentation | Adding API endpoints, debugging WebSocket protocol, reviewing service design |
| `UI/` | Backend UI design mockups and concept HTML files | Reviewing ADR visualization mockups, iterating on ticker bar design concepts |
| `__tests__/` | Backend unit tests | Running backend tests, adding test coverage |
