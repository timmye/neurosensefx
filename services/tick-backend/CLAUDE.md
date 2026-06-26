# services/tick-backend/

WebSocket data streaming and HTTP API backend service.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `CTraderSession.js` | cTrader connection orchestration; `connect()` is a FAST handshake (open→authenticate→`loadAllSymbols`→`startHeartbeat`→emit `'connected'`) with a DETACHED post-connect restore (`_beginRestore`/`_runRestore`, exposed as `this.restorePromise` and `'restoreStart'`/`'restoreComplete'`); `restoreSubscriptions()` uses a bounded-concurrency throttled runner (`_runBounded`/`_sendWithBudget`/`_sendWithRetry`), a Phase-3 defer-queue, and `ctraderErrorCode` classification; delegates to CTraderSymbolLoader, CTraderDataProcessor, CTraderEventHandler. **In supervised mode**, its `HealthMonitor` + `ReconnectionManager` are **inert** (gated `!this.supervised` — the supervisor's `HealthSensor`/`RetryPolicy` own liveness/recovery), and the old 10 s `open()` timeout is dropped (the layer's `open()` self-rejects since `plans/ctrader-layer-hardening.md` L1); they remain live for the unsupervised TradingView session | Debugging connection lifecycle, modifying reconnection/restore behavior, troubleshooting data flow issues |
| `CTraderSymbolLoader.js` | Symbol loading, mapping, and symbol info caching for cTrader; **persistent across reconnects** (`setConnection()` re-binds without recreating, so `symbolInfoCache` + maps survive); `loadedOnce` flag; `refreshAllSymbols()` does an atomic map swap preserving `symbolInfoCache` | Working with symbol lookups, adding symbol-related features, debugging symbol data/restore issues |
| `config.js` | Centralized config: reads all env vars once at startup into a typed object (cTrader creds, host/port, TV session + connect deadline, restore-runner tuning, PG/Redis, `logLevel`); `required()` throws on missing | Adding/reading config, debugging missing env vars, tuning restore concurrency |
| `CTraderDataProcessor.js` | Data processing and calculations for cTrader (price calculation, ADR, OHLC extraction, historical bars) | Modifying data processing logic, adding calculations, fixing data transformation bugs |
| `CTraderEventHandler.js` | Event processing for cTrader spot events (trendbar and spot event handlers) | Debugging tick data processing, modifying event handling logic, fixing data extraction |
| `TradingViewCandleHandler.js` | Candle processing logic for TradingView (D1/M1 handlers, ADR calculation, data package emission) | Debugging candle processing, modifying ADR logic, fixing data package emission timing |
| `SubscriptionManager.js` | Client and backend subscription tracking with coalescing support | Debugging subscription state, understanding coalescing logic, modifying subscription lifecycle |
| `RequestCoordinator.js` | Symbol data request handling with fetch timeout and retry logic; `handleTradingViewRequest` **dedupes the `candle` listener per symbol** (one in-flight per symbol; fans data + `onComplete` to all waiting clients — D1) and skips subscribe when TV is disconnected (D4) | Debugging data fetching, modifying retry behavior, understanding request coordination |
| `StatusBroadcaster.js` | Status message broadcasting to subscribed clients | Understanding status propagation, modifying broadcast logic, debugging client notifications |
| `DataRouter.js` | Data routing from cTrader/TradingView sessions to WebSocket clients using MessageBuilder | Understanding data flow, modifying routing logic, debugging message delivery |
| `HealthMonitor.js` | Single-clock staleness detector (default `stalenessMs=60000`) used by the **unsupervised** TradingView session; tracks lastTick timestamp, emits stale/tick_resumed events (the supervised cTrader feed uses `supervision/HealthSensor` instead) | Understanding TradingView staleness detection, modifying timeout thresholds |
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
| `vitest.config.js` | Vitest config (node env, includes `__tests__/**/*.test.js`, 15s timeout) | Configuring the unit test runner, debugging test discovery |

## Subdirectories

| Directory | What | When to read |
| --------- | ---- | ------------ |
| `utils/` | Shared utility modules (Logger, ReconnectionManager, ctraderErrorCode, MessageBuilder, normalizeSymbol, constants, SafeSender) | Adding module logging, debugging reconnection, building/normalizing messages |
| `supervision/` | Feed recovery & supervision tier (FeedSupervisor, CTraderTransportAdapter, FeedState, HealthSensor, RetryPolicy, RealClock, interfaces) | Implementing recovery, debugging feed health, adding a supervised feed |
| `specs/` | cTrader API specifications and architectural decision records | Looking up cTrader API message schemas, debugging protobuf definitions |
| `docs/` | Backend design documentation | Adding API endpoints, debugging WebSocket protocol, reviewing service design |
| `UI/` | Placeholder directory (concept HTML removed during cleanup) | Reserved for future UI mockup additions |
| `__tests__/` | Backend unit tests (offline supervision/characterization suites + reliability/normalization tests) | Running backend tests, adding test coverage |
