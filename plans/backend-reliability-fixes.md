# Backend Reliability Fixes

## Overview

Implementation plan for the backend assessment findings documented in `docs/backend-architecture-assessment-2026-06.md` and `docs/backend-assessment-plain-english-2026-06.md`.

Three phases, ordered by risk reduction:
- **Phase 1 — Reliability** (7 items): Fixes that prevent outages, data corruption, and stuck states
- **Phase 2 — Cleanup** (8 items): Removes dead code, eliminates duplication, reduces future bug surface
- **Phase 3 — Hardening** (3 items): Improves maintainability of large functions and observability

All items include testable acceptance criteria. No manual verification steps.

---

## Planning Context

### Decision Log

| Decision | Reasoning Chain |
|----------|-----------------|
| Phase ordering: reliability → cleanup → hardening | Reliability fixes prevent real outages → Cleanup prevents future bugs → Hardening is maintainability investment |
| Backpressure in Phase 1 not Phase 3 | Unbounded send buffers cause memory exhaustion under load → this is a reliability risk, not a code quality issue |
| Constants extraction before other cleanup | Many Phase 2 items depend on shared constants module → extract first to avoid merge conflicts |
| God function decomposition deferred to Phase 3 | High effort, low immediate risk → not worth blocking reliability fixes |
| No new test framework introduced | Backend has `__tests__/drawingVersioning.test.js` using Vitest → continue with Vitest for new tests |

### Rejected Alternatives

| Alternative | Why Rejected |
|-------------|--------------|
| Fix everything in one phase | Too many concurrent changes to a running system → risk of regressions → phased approach allows verification between phases |
| Skip cleanup (Phase 2) | Duplicated constants will cause the exact bug the assessment warns about → next person adding a timeframe will miss one of the two copies |
| Rewrite god functions now | High effort (2-4 days), low risk reduction → defer to Phase 3 when reliability is already improved |
| Add TypeScript | Out of scope for this assessment → would touch every file → separate initiative |

### Constraints & Assumptions

**Technical**:
- Node.js backend, no TypeScript
- Vitest for backend tests (already in use)
- Both data sources must remain functional throughout (no breaking changes)
- All changes must be backward-compatible with existing frontend protocol

**Organizational**:
- Targeted fixes, not rewrites (per CLAUDE.md: "Not looking for big rewrites — small targeted fixes")
- Each item should be independently deployable and testable
- Existing `run.sh dev` workflow for testing

### Known Risks

| Risk | Mitigation | Monitoring |
|------|-----------|------------|
| Backpressure threshold too aggressive | Start conservative (64KB), monitor disconnects | Log disconnect reason and buffered amount |
| Token persistence atomic write fails on exotic filesystem | temp-file-then-rename is POSIX standard | Catch and log; fallback to current behavior |
| Reconnect subscription restore race | Save subscriptions before clearing | Unit test with concurrent disconnect/reconnect |
| Phase 2 constant extraction merge conflicts | Do constants first, then other Phase 2 items | One PR per item |

---

## Phase 1 — Reliability

### 1.1 [CR-1] Fix uncaughtException handler to exit process

**Problem:** `server.js:38-41` logs fatal errors but keeps running, leaving the process in corrupted state.

**File:** `server.js:38-41`

**Change:**
- Add `process.exit(1)` after logging in `uncaughtException` handler
- The process manager (pm2, docker, run.sh) will restart the process
- Add a brief delay (1s) to allow the log to flush before exit

**Testable acceptance criteria:**
1. Unit test: mock a function that throws, verify process.exit is called with code 1
2. Integration test: start server, force an uncaught exception (e.g., require a bad module), verify:
   - Process exits within 2 seconds
   - Log output contains `[FATAL]` prefix
   - Process manager restarts the server within 5 seconds
3. Integration test: verify normal startup still succeeds (no regressions)

---

### 1.2 [CR-2] Make token persistence atomic

**Problem:** `CTraderSession.js:273-290` reads `.env`, replaces tokens, writes entire file. Crash between read/write corrupts the file.

**File:** `CTraderSession.js:273-290`

**Change:**
- Write tokens to a temporary file first (`envPath + '.tmp'`)
- Use `fs.renameSync()` (atomic on POSIX) to swap temp → real
- If temp file exists on startup, log warning (previous failed write) but don't crash
- Move `require('fs')` to top level (also fixes inline-require inconsistency)

**Testable acceptance criteria:**
1. Unit test: call `persistTokens()`, verify `.env` has new token values
2. Unit test: call `persistTokens()`, delete `.env` midway (simulate), verify `.env.tmp` doesn't exist after retry
3. Integration test: force token refresh, verify `.env` remains valid
4. Integration test: pre-create a stale `.env.tmp`, start server, verify it logs warning and starts normally

---

### 1.3 [CR-3] Remove resetSequence() call on cTrader reconnect

**Problem:** `WebSocketServer.js:61` resets sequence numbers on reconnect, violating the monotonic contract documented at `MarketProfileService.js:401`.

**Files:** `WebSocketServer.js:61`, `MarketProfileService.js:394-396`

**Change:**
- Remove the `marketProfileService.resetSequence(symbol)` call from the cTrader `connected` event handler
- Remove `resetSequence()` method from `MarketProfileService` (dead code after call site removal)
- Sequence numbers continue from where they left off after reconnect

**Testable acceptance criteria:**
1. Unit test: subscribe to a symbol, emit several bars (note sequence numbers), disconnect cTrader, reconnect, emit more bars — verify sequence numbers are strictly increasing (never reset)
2. Integration test: verify frontend profile display doesn't glitch after cTrader reconnect
3. Unit test: verify `resetSequence` method no longer exists on `MarketProfileService`

---

### 1.4 [S3/CM-6] Add backpressure protection on client.send()

**Problem:** `DataRouter.js`, `StatusBroadcaster.js`, `WebSocketServer.js` all call `client.send()` without checking `ws.bufferedAmount`. Slow clients cause unbounded memory growth.

**Files:** `DataRouter.js:185,153`, `StatusBroadcaster.js:48-50`, `WebSocketServer.js:134-142`

**Change:**
- Create `utils/SafeSender.js` — shared helper that checks `ws.bufferedAmount` before sending
- If `bufferedAmount > BUFFER_THRESHOLD` (default 64KB), disconnect the client with code 4002 ("Slow connection")
- Log the disconnect with buffered amount for monitoring
- Replace all raw `client.send()` calls with `SafeSender.send(client, message)`
- Import `WebSocket` in DataRouter and StatusBroadcaster to replace magic `readyState === 1` with `WebSocket.OPEN`

**Testable acceptance criteria:**
1. Unit test: verify `SafeSender.send()` sends when bufferedAmount < threshold
2. Unit test: verify `SafeSender.send()` disconnects client when bufferedAmount > threshold
3. Unit test: verify disconnect uses code 4002 with descriptive reason
4. Integration test: simulate slow client (mock ws with growing bufferedAmount), verify it gets disconnected, verify other clients continue receiving data
5. Integration test: verify heartbeat messages also respect backpressure (slow clients get disconnected, not just skipped)

---

### 1.5 [CM-7] Fix reconnect() losing all subscriptions

**Problem:** `CTraderSession.js:562-576` calls `disconnect()` which clears `activeSubscriptions` and `activeBarSubscriptions`, then `connect()` calls `restoreSubscriptions()` which finds empty maps.

**File:** `CTraderSession.js:562-576`

**Change:**
- In `reconnect()`, save subscription state before calling `disconnect()`
- After `connect()` succeeds, subscriptions are already restored (because `restoreSubscriptions` reads from the saved maps)
- Alternative: move subscription clearing from `disconnect()` to only happen on explicit `disconnect()` (not `reconnect()`)

**Testable acceptance criteria:**
1. Unit test: subscribe to 3 symbols, call `reconnect()`, verify `activeSubscriptions` still contains all 3 symbols after reconnect completes
2. Unit test: subscribe to M1 bars + H4 bars, call `reconnect()`, verify `activeBarSubscriptions` preserved
3. Integration test: connect frontend, subscribe to symbols, trigger reinit via WebSocket message, verify frontend continues receiving data without re-subscribing
4. Unit test: verify explicit `disconnect()` still clears subscriptions (intended for shutdown)

---

### 1.6 [M3/CM-8] Fix TradingView once('candle') listener race

**Problem:** `RequestCoordinator.js:326` — `once('candle')` listener can be consumed by wrong symbol's event, leaving the original client permanently stuck.

**File:** `RequestCoordinator.js:296-344`

**Change:**
- Replace `tradingViewSession.once('candle', ...)` with `tradingViewSession.on('candle', ...)` wrapped with auto-cleanup
- Store the listener reference in the pending request so it can be removed when the correct symbol's data arrives
- Add a timeout (existing 30s from subscription manager) that rejects the promise and removes the listener

**Testable acceptance criteria:**
1. Unit test: subscribe to symbols A and B simultaneously, emit candle for B first, verify A's listener is still active
2. Unit test: subscribe to symbol A, emit candle for A, verify listener is removed after match
3. Unit test: subscribe to symbol A, wait for timeout, verify listener is removed and promise rejects
4. Integration test: subscribe to 5 TradingView symbols rapidly, verify all 5 receive data packages

---

### 1.7 [M1/EH-6] Fix handleUnsubscribe to clean up M1 bars

**Problem:** `WebSocketServer.js:461-475` only unsubscribes from ticks, not M1 bars or backend subscriptions.

**File:** `WebSocketServer.js:461-475`

**Change:**
- After unsubscribing from ticks, also call `cTraderSession.unsubscribeFromM1Bars(symbolName)`
- Remove the backend subscription via `subscriptionManager.removeBackendSubscription(symbolName, source)`
- Clean up market profile data (already done at line 472)

**Testable acceptance criteria:**
1. Unit test: subscribe to symbol (creates tick + M1 bar subscription), then unsubscribe, verify both tick and bar subscriptions are removed from CTraderSession
2. Unit test: verify `activeBarSubscriptions` map no longer contains the symbol's M1 entry
3. Integration test: subscribe to symbol, verify data flows, unsubscribe, verify no more data arrives for that symbol

---

## Phase 2 — Cleanup

### 2.1 Extract shared constants

**Problem:** `RESOLUTION_TO_PERIOD` duplicated in `WebSocketServer.js:13` and `httpServer.js:49`. `VALID_PERIODS` duplicated in `CTraderSession.js:461` and `CTraderDataProcessor.js:78`.

**Files:** New file `utils/constants.js`, then update 4 files.

**Change:**
- Create `utils/constants.js` with `RESOLUTION_TO_PERIOD` and `VALID_PERIODS`
- Import in `WebSocketServer.js`, `httpServer.js`, `CTraderSession.js`, `CTraderDataProcessor.js`
- Remove local definitions

**Testable acceptance criteria:**
1. Unit test: verify all 4 files reference the same `RESOLUTION_TO_PERIOD` object
2. Unit test: add a new resolution to constants.js, verify it's available in all consumers without touching any other file
3. Integration test: verify all existing resolutions still work (getHistoricalCandles for each resolution)

---

### 2.2 Remove dead code

**Items to remove:**

| Item | File | Lines |
|------|------|-------|
| `HealthMonitor.recordLatency()` | `HealthMonitor.js` | 16-32, plus `latencySamples` and `maxSamples` fields |
| `HealthMonitor.getLatencyStats()` | `HealthMonitor.js` | entire method |
| `RequestCoordinator.resolveRequest()` | `RequestCoordinator.js` | 384-387 |
| `SubscriptionManager.getClientSubscriptions()` | `SubscriptionManager.js` | 132-134 |
| `StatusBroadcaster.broadcastToClients()` | `StatusBroadcaster.js` | 59-81 |
| `StatusBroadcaster.getCurrentStatus()` | `StatusBroadcaster.js` | 119-130 |
| `StatusBroadcaster.getAvailableSymbols()` | `StatusBroadcaster.js` | 119-130 |
| `TradingViewSession.currentM1Bars` | `TradingViewSession.js` | 36 |
| `test-timeframe.js` | root of tick-backend | entire file |

**Testable acceptance criteria:**
1. After removal, run existing tests (`npm test` from root) — all pass
2. Grep for each removed method name — zero results in code (only in docs/tests)
3. Server starts normally with `run.sh dev`
4. Subscribe to symbol, verify data flows (smoke test)

---

### 2.3 Extract barToOHLC helper

**Problem:** OHLC extraction from raw cTrader bars repeated 5 times across `CTraderDataProcessor.js` and `CTraderEventHandler.js`.

**Files:** New helper in `CTraderDataProcessor.js` (or shared util), update `CTraderEventHandler.js`

**Change:**
- Create `barToOHLC(rawBar, digits, calculatePrice)` that returns `{ open, high, low, close, timestamp }`
- Replace all 5 inline OHLC extraction blocks with calls to this helper

**Testable acceptance criteria:**
1. Unit test: verify `barToOHLC` produces identical output to the inline logic it replaces
2. Unit test: test edge cases (zero deltaHigh, negative deltaLow, JPY pair digits)
3. Integration test: subscribe to EURUSD, verify tick and bar data unchanged from before

---

### 2.4 Consolidate prevDay conditional spread

**Problem:** `...(data.prevDayOpen !== undefined && { prevDayOpen })` pattern repeated in 3 files.

**Files:** `RequestCoordinator.js:208-211`, `CTraderDataProcessor.js:289-293`, `TradingViewDataPackageBuilder.js:76-79`

**Change:**
- Create a `buildPrevDayFields(data)` helper in `utils/MessageBuilder.js`
- Returns an object with only the defined prevDay fields
- Replace all 3 inline spreads with `...buildPrevDayFields(data)`

**Testable acceptance criteria:**
1. Unit test: verify helper includes fields when present, excludes when undefined
2. Unit test: verify helper with all 4 fields, 3 fields, 1 field, 0 fields
3. Integration test: verify data packages still include prevDay data when available

---

### 2.5 Move process.env reads to centralized config

**Problem:** `CTraderSession.js:19-23` reads env vars directly, bypassing `config.js`.

**File:** `CTraderSession.js:19-23`, `config.js`

**Change:**
- Add `ctraderAccountId`, `accessToken`, `refreshToken`, `clientId`, `clientSecret` to `config.js` (some already exist there)
- Update `CTraderSession` constructor to read from `config` instead of `process.env`
- Move `require('fs')` from inside `persistTokens()` to module top level

**Testable acceptance criteria:**
1. Unit test: verify `CTraderSession` reads all values from config object, not `process.env`
2. Integration test: set env vars, start server, verify cTrader connects successfully
3. Integration test: missing required env var → verify server fails to start with clear error message

---

### 2.6 Add symbol validation to HTTP routes

**Problem:** `persistenceRoutes.js` routes accept arbitrary symbol strings without validation. WebSocket layer validates with `SYMBOL_RE` but HTTP routes don't.

**Files:** `persistenceRoutes.js:47,79,97,112`, share regex from `WebSocketServer.js:300`

**Change:**
- Move `SYMBOL_RE` to `utils/constants.js`
- Import in `persistenceRoutes.js`
- Add early-return validation for `:symbol` param in all 4 routes

**Testable acceptance criteria:**
1. Unit test: valid symbol `EURUSD` → passes validation
2. Unit test: valid symbol `BTC/USD` → passes validation
3. Unit test: invalid symbol `<script>alert(1)</script>` → rejected with 400
4. Unit test: empty symbol → rejected with 400
5. Integration test: save and load workspace/drawings/markers with valid symbol

---

### 2.7 Fix Redis multi.exec() error checking

**Problem:** `sessionManager.js:68` doesn't check per-command errors from `multi.exec()`.

**File:** `sessionManager.js:68`

**Change:**
- Destructure `multi.exec()` results and check each `[err, result]` tuple
- If any command fails, throw or handle explicitly
- Add error logging for partial failures

**Testable acceptance criteria:**
1. Unit test: mock Redis to return partial failure → verify error is logged and thrown
2. Unit test: mock Redis to return full success → verify session created normally
3. Unit test: verify session validation still works after creation

---

### 2.8 Fix db.js schema check to block startup on failure

**Problem:** `db.js:49-51` logs schema verification error but allows server to start with missing tables.

**File:** `db.js:49-51`

**Change:**
- Throw instead of just logging when schema verification fails
- `server.js:35` already has `.catch()` for this — update it to exit with clear message

**Testable acceptance criteria:**
1. Integration test: drop a required table, start server, verify it exits with clear error message
2. Integration test: all tables present, verify server starts normally
3. Unit test: verify `verifySchema()` throws on missing table

---

## Phase 3 — Hardening

### 3.1 Settle pending TradingView promises on disconnect

**Problem:** `TradingViewSession.js:384-385` clears `_pendingHistorical` map, abandoning promises that will never settle.

**File:** `TradingViewSession.js:384-385`

**Change:**
- Before clearing `_pendingHistorical`, iterate all entries and reject their promises with a `DisconnectedError`
- This unblocks any code awaiting `fetchHistoricalCandles()`

**Testable acceptance criteria:**
1. Unit test: call `fetchHistoricalCandles()`, immediately call `handleDisconnect()`, verify promise rejects with disconnect error
2. Integration test: load chart, force TV disconnect, verify chart shows error (not infinite spinner)

---

### 3.2 Drain PostgreSQL pool and Redis on shutdown

**Problem:** `server.js:49-57` SIGINT handler doesn't close DB pool or Redis connection.

**Files:** `server.js:49-57`, `db.js`, `sessionManager.js`

**Change:**
- Export `pool.end()` from `db.js`
- Export `redis.quit()` from `sessionManager.js`
- Add both to SIGINT handler before `process.exit(0)`
- Add SIGTERM handler (same as SIGINT)

**Testable acceptance criteria:**
1. Integration test: start server, verify DB and Redis connections exist, send SIGINT, verify connections are closed cleanly
2. Integration test: start server, send SIGTERM, verify same clean shutdown
3. Unit test: verify `pool.end()` and `redis.quit()` are called before `process.exit(0)`

---

### 3.3 Add SafeSender disconnect metrics

**Problem:** No observability into slow-client disconnects from the backpressure fix (1.4).

**File:** `utils/SafeSender.js` (created in 1.4)

**Change:**
- Log disconnect events with: timestamp, symbol, bufferedAmount, client IP (if available)
- Add to the 5-minute heartbeat summary log in `WebSocketServer.js:113-121`
- No external metrics service — just structured logs

**Testable acceptance criteria:**
1. Unit test: force a slow-client disconnect, verify log output contains bufferedAmount and reason
2. Integration test: verify heartbeat summary includes slow-client disconnect count when > 0
3. Integration test: verify no slow-client log entries when all clients are fast

---

## Execution Order

Items within each phase can be done in any order. Items across phases MUST be sequential (Phase 1 before Phase 2 before Phase 3).

Within Phase 1, recommended order:
1. **1.4** (SafeSender/backpressure) — new utility, no existing code touched except call sites
2. **1.1** (uncaughtException) — 2-line change, high impact
3. **1.3** (resetSequence) — remove dead code path, quick
4. **1.7** (handleUnsubscribe M1 bars) — small addition to existing path
5. **1.5** (reconnect subscriptions) — moderate, needs careful testing
6. **1.6** (TV once listener race) — moderate, changes request flow
7. **1.2** (token persistence) — standalone change, testable independently

Within Phase 2, recommended order:
1. **2.1** (constants) — other items depend on this
2. **2.6** (symbol validation) — uses constants from 2.1
3. **2.2** (dead code) — includes removing StatusBroadcaster methods that duplicate SafeSender
4. **2.5** (config centralization) — standalone
5. **2.3** (barToOHLC helper) — standalone
6. **2.4** (prevDay spread) — standalone
7. **2.7** (Redis error checking) — standalone
8. **2.8** (db schema check) — standalone

Phase 3: any order.

---

## Summary

| Phase | Items | Estimated Effort | Risk Reduction |
|-------|-------|-----------------|----------------|
| 1 — Reliability | 7 fixes | ~1.5-2 weeks | Eliminates 4 serious + 3 moderate risks |
| 2 — Cleanup | 8 items | ~1 week | Prevents duplication bugs, removes 9 dead code items |
| 3 — Hardening | 3 items | ~2-3 days | Improves shutdown, observability, promise cleanup |
| **Total** | **18 items** | **~3-4 weeks** | |
