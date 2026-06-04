# Backend Architecture Assessment — June 2026

Comprehensive review of `services/tick-backend/` (25 source files, ~4,500 lines). Two data sources (cTrader + TradingView) feeding a WebSocket frontend through shared processing services.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Critical Risks (CR)](#critical-risks-cr)
- [Error Handling Issues (EH)](#error-handling-issues-eh)
- [Connection & Resource Management (CM)](#connection--resource-management-cm)
- [Code Quality Issues](#code-quality-issues)
- [Security Concerns (SEC)](#security-concerns-sec)
- [Inconsistencies & Anti-patterns](#inconsistencies--anti-patterns)
- [Dead Code](#dead-code)
- [God Functions](#god-functions)
- [Recommendations by Priority](#recommendations-by-priority)

---

## Architecture Overview

```
cTrader (protobuf/TCP)  ──┐
                           ├── CTraderEventHandler  ──┐
CTraderSession ────────────┤                           │
                           ├── CTraderDataProcessor ──┤
                           └── CTraderSymbolLoader ────┤
                                                      │
                           ┌───────────────────────────┤
                           │  Shared Services          │
                           │  ├─ MarketProfileService  ├──┐
                           │  ├─ TwapService           ├──┤
                           │  └─ HealthMonitor         │  │
                           │                           │  │
TradingView (WebSocket) ───┤                           │  │
                           ├── TradingViewCandleHandler┤  │
TradingViewSession ────────┤                           │  │
                           ├── TradingViewSubManager ──┤  │
                           └── TradingViewDataPkgBldr ─┘  │
                                                         ▼
                           ┌─────────────────────────────────┐
                           │  WebSocketServer                 │
                           │  ├─ DataRouter ──────────────────┼── Frontend WS Clients
                           │  ├─ RequestCoordinator           │
                           │  ├─ SubscriptionManager          │
                           │  └─ StatusBroadcaster            │
                           └─────────────────────────────────┘
                                                         │
                           ┌─────────────────────────────────┐
                           │  HTTP Layer                      │
                           │  ├─ authRoutes (register/login)  │
                           │  ├─ persistenceRoutes (CRUD)     │
                           │  ├─ sessionManager (Redis)       │
                           │  └─ db.js (PostgreSQL pool)      │
                           └─────────────────────────────────┘
```

**Where it works well:**
- Clean separation of cTrader-specific vs TradingView-specific modules
- Shared `ReconnectionManager` and `HealthMonitor` used by both sessions
- Cookie-based auth with Redis session invalidation and WS kick-on-relogin
- Rate-limited queues for both cTrader and TradingView API calls
- Request coalescing prevents duplicate API calls for the same symbol

---

## Critical Risks (CR)

### CR-1: Process limps on after fatal errors instead of restarting

**File:** `server.js:38-41`

`uncaughtException` handler logs the error but does not exit. Corrupted state (half-initialized connections, leaked resources) persists indefinitely. A single unhandled exception leaves the process in unpredictable state with no recovery path.

```js
process.on('uncaughtException', (error) => {
    console.error('[FATAL] Uncaught exception:', error.message);
    console.error(error.stack);
    // Missing: process.exit(1) so process manager can restart cleanly
});
```

### CR-2: .env file corruption risk on token refresh

**File:** `CTraderSession.js:273-290`

`persistTokens()` reads `.env`, regex-replaces token values, writes entire file back. A crash between read and write, or concurrent process writing the same file, corrupts it. Non-atomic file mutation of config is a data loss risk.

### CR-3: resetSequence() contradicts monotonic contract

**File:** `WebSocketServer.js:61` calls `marketProfileService.resetSequence(symbol)` on every cTrader reconnect. But `_incrementSequence` at `MarketProfileService.js:401` states: "Sequence numbers should ONLY ever increase — never reset during normal operation." Frontend clients may re-process profile updates with stale sequence numbers after any reconnect.

### CR-4: TradingView connection drops are undetectable for up to 5 minutes

**File:** `TradingViewSession.js:315-320`

The `client.on('close')` and `client.on('error')` bindings are wrapped in try/catch with comment "Library doesn't support these events." If the TradingView WebSocket drops silently, only the 5-minute staleness timer detects it.

---

## Error Handling Issues (EH)

### EH-1: Silent catch on session validation parse failure

**File:** `sessionManager.js:85-86`

`validateSession()` catches JSON parse errors and returns `null` (same as "no session"). Corrupt session data is indistinguishable from "not logged in."

### EH-2: Silent catch on session delete parse failure

**File:** `sessionManager.js:101`

Empty `catch (e) { }` swallows parse errors during logout. Corrupt session data means the user-to-session index is never cleaned up, leaking Redis keys until TTL expiry (30 days).

### EH-3: Silent catch blocks in TradingView historical fetch

**File:** `TradingViewSession.js:246, 259, 265`

Three `catch (e) { /* ignore */ }` blocks on `client.send('delete_session')`. Best-effort cleanup, but makes debugging harder.

### EH-4: TradingView event errors emitted but no recovery

**File:** `TradingViewSession.js:117-119`

`handleEvent` catches errors and emits them, but doesn't trigger disconnect/reconnect. A persistent parsing error spams error events without recovery.

### EH-5: handleSubscribe fire-and-forget on tick subscription

**File:** `WebSocketServer.js:403-413`

`cTraderSession.subscribeToTicks(symbolName).catch(...)` is fire-and-forget. If subscription fails, client is added to subscription manager but never receives data. Subscription state is inconsistent.

### EH-6: handleUnsubscribe never unsubscribes from M1 bars

**File:** `WebSocketServer.js:461-475`

Only unsubscribes from ticks via `unsubscribeFromTicks`. Never calls `unsubscribeFromM1Bars` or removes backend subscription. M1 bar subscriptions leak.

### EH-7: Redis multi.exec() results not checked

**File:** `sessionManager.js:68`

`multi.exec()` returns `[error, result]` tuples. No check for errors in individual commands. Partial failure leaves inconsistent state.

---

## Connection & Resource Management (CM)

### CM-1: WebSocket server event listeners never removed

**File:** `WebSocketServer.js:52-104`

Constructor adds ~15 permanent `.on()` listeners to sessions and services. Never removed, even on shutdown. Acceptable for singletons but `close()` only clears intervals, not listeners.

### CM-2: Async auth gap allows message loss

**File:** `WebSocketServer.js:258-269`

Session validation is async. Between WS upgrade and `.then()` callback, socket is open but has no handlers. Client messages sent during this window are silently dropped.

### CM-3: isDisconnecting guard ineffective for async operations

**File:** `CTraderSession.js:292-316`, `TradingViewSession.js:365-393`

Flag set and reset synchronously, making it useless for preventing concurrent async operations.

### CM-4: Pending historical promises can leak on disconnect

**File:** `TradingViewSession.js:243-286`

If `handleDisconnect` clears `_pendingHistorical` before the 30s timeout fires, the promise's resolve/reject are never called. Calling code awaits a promise that never settles.

### CM-5: HealthMonitor interval not cleared on internal error

**File:** `HealthMonitor.js`

`start()` creates `setInterval` but if `checkStaleness()` throws, the interval keeps running and may throw repeatedly.

### CM-6: No backpressure on client.send() [HIGH]

**File:** `DataRouter.js:185,153`, `StatusBroadcaster.js:48-50`, `WebSocketServer.js:134-142`

All `client.send()` calls proceed without checking `ws.bufferedAmount`. During high-frequency tick bursts with slow clients, send buffers grow unbounded. Memory grows proportionally to `data_rate * slow_clients`. No client is ever disconnected for being slow.

### CM-7: reconnect() destroys subscription state

**File:** `CTraderSession.js:562-576`

`disconnect()` clears `activeSubscriptions` and `activeBarSubscriptions`, then `connect()` calls `restoreSubscriptions()` which finds empty maps. Manual reinit causes all clients to stop receiving data until they re-subscribe.

### CM-8: TradingView once('candle') listener race

**File:** `RequestCoordinator.js:326`

If multiple symbols are subscribed simultaneously, a `once('candle')` listener for symbol A can be consumed by a candle event for symbol B. The original client is permanently stuck waiting for data.

### CM-9: PostgreSQL pool never drained on shutdown

**File:** `server.js:49-57`, `db.js:8-17`

SIGINT handler doesn't call `pool.end()`. In-flight queries terminated ungracefully.

### CM-10: TradingView completionTimeout leaks on disconnect

**File:** `TradingViewSubscriptionManager.js:91-97`

Timeouts stored on subscription objects are not cleared when `handleDisconnect` calls `this.subscriptions.clear()`. Timeout callbacks fire into a disconnected session, hold closure references preventing GC.

---

## Code Quality Issues

### High-value fixes

| Issue | Files | Impact |
|-------|-------|--------|
| `RESOLUTION_TO_PERIOD` duplicated | `WebSocketServer.js:13`, `httpServer.js:49` | Adding a new resolution requires changing two files |
| `VALID_PERIODS` duplicated | `CTraderSession.js:461`, `CTraderDataProcessor.js:78` | Validation silently diverges across files |
| `broadcastToClients` implemented twice | `DataRouter.js:168`, `StatusBroadcaster.js:59` | StatusBroadcaster version is dead code duplicating live code |
| OHLC extraction pattern repeated 5x | `CTraderDataProcessor.js:122,215,265`, `CTraderEventHandler.js:27,55` | Price calculation changes require 5-place replication |
| `prevDay` conditional spread repeated 3x | `RequestCoordinator.js:208`, `CTraderDataProcessor.js:289`, `TradingViewDataPackageBuilder.js:76` | New prevDay field needs 3 file changes |
| `process.env` bypasses centralized config | `CTraderSession.js:19-23` | All other files use `config.js`; CTraderSession reads env vars directly |
| Dead `currentM1Bars` Map | `TradingViewSession.js:36` | Declared but never read/written |
| `ADR` calculation duplicated | `CTraderDataProcessor.js:198`, `TradingViewCandleHandler.js:113` | Same "average of ranges" pattern, different implementations per source |

### Maps growing without bounds

| Map | File | Cleanup |
|-----|------|---------|
| `WebSocketServer.lastPrices` | `WebSocketServer.js:85` | Never removed on unsubscribe |
| `TradingViewCandleHandler.currentM1Bars` | `TradingViewCandleHandler.js:16` | Never removed on unsubscribe |
| `CTraderSymbolLoader` caches | `CTraderSymbolLoader.js:10-12` | Never cleared (bounded by total symbols) |

---

## Security Concerns (SEC)

### SEC-1: Token persistence writes secrets to disk

**File:** `CTraderSession.js:273-290`

Non-atomic write of access/refresh tokens to `.env`. If file permissions are permissive, tokens readable by any process on the host.

### SEC-2: Persistence routes don't validate symbol/resolution format

**File:** `persistenceRoutes.js:47,79,97,112`

Route params go directly to SQL queries. Parameterized queries prevent SQL injection, but no format validation means arbitrary strings are stored. WebSocket layer validates with `SYMBOL_RE = /^[A-Za-z0-9./_-]+$/` at `WebSocketServer.js:300`, but HTTP routes don't.

---

## Inconsistencies & Anti-patterns

| Issue | Location | Detail |
|-------|----------|--------|
| Magic `readyState === 1` | `DataRouter.js:153,185`, `StatusBroadcaster.js:74,89` | Should use `WebSocket.OPEN` |
| `includeField` after spread is redundant | `MessageBuilder.js:27-44` | Spread already copies all fields |
| `require()` inside method body | `CTraderSession.js:274`, `TradingViewSession.js:38` | Inconsistent with top-level requires everywhere else |
| `maxLevels = 5000` vs `MAX_LEVELS = 3000` | `MarketProfileService.js:195` vs `:15` | Inner limit unreachable, misleading |
| `== null` vs `=== null` | `WebSocketServer.js:494` | Only place using loose equality |
| Schema check failure silently continues | `db.js:49-51` | Logs error but server starts with missing tables |
| `enqueueDirect` with `skipTimeout` bypasses timeout | `RequestCoordinator.js:69-85` | Hung request blocks entire queue forever |

---

## Dead Code

| Item | File:Line | Notes |
|------|-----------|-------|
| `HealthMonitor.recordLatency()` / `getLatencyStats()` | `HealthMonitor.js:16-32` | Entire latency tracking infrastructure unused |
| `RequestCoordinator.resolveRequest()` | `RequestCoordinator.js:384-387` | Never called |
| `SubscriptionManager.getClientSubscriptions()` | `SubscriptionManager.js:132-134` | Never called |
| `StatusBroadcaster.getCurrentStatus()` / `getAvailableSymbols()` | `StatusBroadcaster.js:119-130` | Never called externally |
| `StatusBroadcaster.broadcastToClients()` | `StatusBroadcaster.js:59-81` | Duplicates DataRouter, never called |
| `TradingViewSession.currentM1Bars` Map | `TradingViewSession.js:36` | Declared but never used |
| `test-timeframe.js` | Entire file | Standalone live-network test script in source dir |

---

## God Functions

| Function | File:Lines | Size | Nesting |
|----------|-----------|------|---------|
| `spotEventHandler` closure | `CTraderSession.js:118-189` | 72 lines | 4 levels |
| `WebSocketServer.handleMessage()` | `WebSocketServer.js:280-390` | 110 lines | Repetitive validation |
| `MarketProfileService.onM1Bar()` | `MarketProfileService.js:56-178` | 122 lines | 5 levels |
| `MarketProfileService.initializeFromHistory()` | `MarketProfileService.js:299-392` | 93 lines | Guards + state + processing |

---

## Recommendations by Priority

### Do now (high impact, low risk)

1. **Extract shared constants** (`RESOLUTION_TO_PERIOD`, `VALID_PERIODS`) to `constants.js`
2. **Remove dead code** — all items listed in Dead Code section
3. **Fix `uncaughtException` handler** — add `process.exit(1)` so process manager restarts cleanly
4. **Remove `resetSequence()` call** on reconnect — contradicts monotonic contract
5. **Fix `handleUnsubscribe`** to also unsubscribe from M1 bars and remove backend subscriptions
6. **Add backpressure check** — check `ws.bufferedAmount` before send, disconnect slow clients

### Do soon (medium impact, medium risk)

7. **Make token persistence atomic** — write to temp file then rename (or use a proper secret store)
8. **Extract `barToOHLC()` helper** to replace 5 copy-pasted OHLC extraction blocks
9. **Add symbol validation** to persistence HTTP routes (reuse `SYMBOL_RE` from WebSocketServer)
10. **Settle pending historical promises** on TradingView disconnect instead of abandoning them
11. **Check Redis `multi().exec()` results** for per-command errors
12. **Fix `reconnect()` subscription loss** — save subscriptions before clearing, restore after connect
13. **Fix TradingView `once('candle')` race** — use a symbol-scoped listener or map-based approach
14. **Drain PostgreSQL pool** on SIGINT via `pool.end()`

### Consider later (lower priority)

15. Decompose god functions (especially `onM1Bar` and `handleMessage`)
16. Use `WebSocket.OPEN` constant instead of magic `1`
17. Move inline `require()` calls to module top level
18. Consolidate `broadcastToClients` into one place
19. Make `db.js` schema verification failure startup-blocking
20. Add `bufferedAmount` monitoring / slow-client metrics

---

## Timer/Interval Cleanup Matrix

| Timer | Created | Cleared | Status |
|-------|---------|---------|--------|
| `WebSocketServer.heartbeatInterval` | WS:108 | WS:228 (`close()`) | OK |
| `WebSocketServer.heartbeatSummaryInterval` | WS:113 | WS:232 (`close()`) | OK |
| `WebSocketServer._dailyResetTimeout` | WS:150 | WS:235 (`close()`) | OK |
| `CTraderSession.heartbeatInterval` | CS:334 | CS:342 via CS:303 | OK |
| `HealthMonitor.interval` | HM:41 | HM:45 (`stop()`) | OK |
| `ReconnectionManager.reconnectTimeout` | RM:32 | RM:49 (`cancelReconnect()`) | OK |
| `TradingViewSubscriptionManager.completionTimeout` | TVSM:91 | TVDPB:91 | **LEAK** — not cleared on disconnect |
| `TradingViewSession._pendingHistorical` timeouts | TVS:244 | TVS:256/264 | **PARTIAL** — may fire after disconnect |

---

## File Reference Index

All paths relative to `services/tick-backend/`:

| Abbrev | File |
|--------|------|
| CS | `CTraderSession.js` |
| CSL | `CTraderSymbolLoader.js` |
| CDP | `CTraderDataProcessor.js` |
| CEH | `CTraderEventHandler.js` |
| TVS | `TradingViewSession.js` |
| TVCH | `TradingViewCandleHandler.js` |
| TVSM | `TradingViewSubscriptionManager.js` |
| TVDPB | `TradingViewDataPackageBuilder.js` |
| WS | `WebSocketServer.js` |
| DR | `DataRouter.js` |
| RC | `RequestCoordinator.js` |
| SM | `SubscriptionManager.js` |
| SB | `StatusBroadcaster.js` |
| MPS | `MarketProfileService.js` |
| TS | `TwapService.js` |
| HM | `HealthMonitor.js` |
| RM | `utils/ReconnectionManager.js` |
| MB | `utils/MessageBuilder.js` |
| sessMgr | `sessionManager.js` |
| db | `db.js` |
| http | `httpServer.js` |
| auth | `authRoutes.js` |
| persist | `persistenceRoutes.js` |
| mw | `middleware.js` |
| srv | `server.js` |
| cfg | `config.js` |
