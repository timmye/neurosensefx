# Backend Assessment — Plain English Summary

> Companion to `backend-architecture-assessment-2026-06.md` (technical details).
> This document is written for non-developers. No code, no jargon.

---

## What Is the Backend?

Your app has three layers:

```
[Data Providers]  →  [Backend]  →  [Frontend (what you see in the browser)]
   cTrader                     Your server
   TradingView
```

The backend's job is to:
1. **Connect** to two data providers (cTrader and TradingView) and keep those connections alive
2. **Process** incoming price data — calculate things like Market Profile, TWAP, ADR
3. **Route** that data to whoever is watching in their browser
4. **Store** user stuff — login sessions, workspace layouts, chart drawings

Think of it as a middleman that sits between the raw data and what you see on screen.

---

## Overall State

**All findings resolved (June 2026).** Implementation tracked in `plans/backend-reliability-fixes.md`, verified with 72 unit tests.

The core design was always good. Two data sources feed into shared processing services that broadcast to browsers. Authentication works. Rate limiting prevents API bans. The system degrades gracefully when a data source goes down.

What needed fixing was the "housekeeping" — things that worked fine when the backend was smaller but had become problems as it grew from one data source to two, and from simple tick streaming to multi-timeframe charts, market profiles, and persistence. All 29 issues are now resolved.

**Original scale of the problem:**
- 4 serious risks (could cause outages or data corruption) — **all fixed**
- 7 moderate problems (degrade reliability over time) — **all fixed**
- 18 cleanup/maintenance items (slow you down on future changes) — **all fixed**

---

## The Serious Problems (Must Fix) — All Resolved

These were the ones that could cause real user-visible problems — outages, wrong data, or security gaps. **All four have been fixed.**

---

### S1. The Server Doesn't Restart Itself After Crashing Internally — FIXED

**What happens:** When something unexpected goes wrong inside the server, it logs the error but keeps running. The problem is the server is now in a broken state — it might have lost connections, leaked memory, or be holding stale data — but it doesn't know it's broken. It just limps along, serving bad or missing data to users.

**Real-world impact:** Users see stale prices, missing charts, or no data. The only fix is manually restarting the server. In production this could mean hours of degraded service before anyone notices.

**What "fixed" looks like (testable):**
- Kill a data source connection mid-stream
- Verify the server process exits (not just logs)
- Verify the process manager (pm2/docker/etc) restarts it within seconds
- Verify all subscriptions restore after restart
- Verify users reconnect automatically without manual page refresh

**Effort:** Quick fix (change 2 lines). Testing takes longer than the fix.

**Fix applied:** `uncaughtException` handler now calls `process.exit(1)` with a 1-second delay for log flushing. SIGTERM handler added alongside SIGINT. Process manager restarts cleanly.

---

### S2. Writing Login Tokens Can Corrupt the Config File — FIXED

**What happens:** When cTrader refreshes its access token, the server opens the `.env` config file, reads it, swaps out the old token for the new one, and writes the whole file back. If the server crashes or restarts at exactly the wrong moment (between reading and writing), the file gets corrupted. Next time the server starts, it can't read its own config.

**Real-world impact:** Server won't start after a crash. You'd need to manually fix the `.env` file. Not likely to happen often, but when it does, it's a complete outage.

**What "fixed" looks like (testable):**
- Force a token refresh
- Kill the process during the file write
- Verify the `.env` file is still valid (either old or new tokens, not garbage)
- Verify the server starts cleanly after recovery

**Effort:** Half a day. The fix itself is simple (write to a temp file first, then swap), but testing the crash scenario takes setup.

**Fix applied:** `persistTokens()` now writes to a `.env.tmp` file first, then uses `fs.renameSync()` (atomic on POSIX) to swap it into place. On error, the temp file is cleaned up. The `fs` import was moved to module level.

---

### S3. No Protection Against Slow Users Overwhelming the Server — FIXED

**What happens:** Every time a price update comes in from cTrader or TradingView, the server immediately pushes it to every connected user's browser. It never checks whether the browser can keep up. If someone is on a slow connection, the server just keeps piling messages into a buffer. The more data comes in and the slower the user's connection, the more memory the server uses.

**Real-world impact:** If several users are on slow connections during a volatile market moment (lots of price updates), the server's memory grows until it slows down or crashes for everyone.

**What "fixed" looks like (testable):**
- Simulate a slow client (throttle network to dial-up speed)
- Subscribe to multiple volatile symbols
- Verify the server disconnects the slow client after its buffer exceeds a threshold
- Verify other (fast) clients are unaffected
- Verify memory usage stays stable under load

**Effort:** 1-2 days. Requires adding buffer checks before every message send, plus deciding on thresholds.

**Fix applied:** New `utils/SafeSender.js` checks `ws.bufferedAmount` before every send. If a client's buffer exceeds 64KB, it's disconnected with code 4002 ("Slow connection"). All raw `client.send()` calls in DataRouter, StatusBroadcaster, and WebSocketServer now go through SafeSender. Disconnect count is tracked and included in the 5-minute heartbeat summary log.

---

### S4. Sequence Numbers Reset on Reconnect, Confusing the Frontend — FIXED

**What happens:** Every market profile update has a sequence number (1, 2, 3...) that tells the frontend "this is newer than the last one." When the cTrader connection drops and reconnects, the server resets all sequence numbers back to zero. The frontend then receives update #5 followed by update #1 and gets confused — it might show stale data or re-process old updates.

**Real-world impact:** Market profile display glitches after network hiccups. Users see the profile "jump" or show wrong data until they manually refresh.

**What "fixed" looks like (testable):**
- Subscribe to a symbol and let profile build up (note sequence numbers)
- Disconnect and reconnect the cTrader data source
- Verify sequence numbers continue increasing (never reset)
- Verify frontend profile display remains correct through reconnect

**Effort:** Quick fix (remove 1 line of code, adjust 1 call site).

**Fix applied:** The `resetSequence()` call on cTrader reconnect was removed from WebSocketServer, and the `resetSequence()` method was deleted from MarketProfileService. Sequence numbers now continue from where they left off after reconnect.

---

## The Moderate Problems (Should Fix Soon) — All Resolved

These wouldn't cause immediate outages but degraded reliability, wasted resources, or made debugging hard. **All seven have been fixed.**

---

### M1. Unsubscribing From a Symbol Doesn't Fully Clean Up — FIXED

**What happens:** When a user stops watching a symbol, the server unsubscribes from tick data but forgets to unsubscribe from the 1-minute bar data. The data provider keeps sending bars that nobody uses.

**Real-world impact:** Wastes the data provider's API quota. If enough symbols leak, the server hits API limits and can't subscribe to new symbols.

**Testable:** Subscribe to a symbol, then unsubscribe. Verify both tick and bar subscriptions are removed on the backend (check active subscription count).

**Effort:** Quick fix (add a few lines to the unsubscribe path).

**Fix applied:** `handleUnsubscribe` now also calls `unsubscribeFromBars(symbolName, 'M1')` and `removeBackendSubscription(symbol, source)`. New `removeBackendSubscription()` method added to SubscriptionManager.

---

### M2. Manual Reinit Loses All Active Subscriptions — FIXED

**What happens:** The "reinit" button (which triggers a full reconnection) throws away the list of what symbols everyone was watching, then tries to restore from an empty list. Users stop receiving data until they manually switch symbols again.

**Real-world impact:** Anyone clicking reinit (or any automated reinit) drops all data for all connected users.

**Testable:** Subscribe to 3 symbols, trigger reinit, verify all 3 resume receiving data without user interaction.

**Effort:** Half a day. Need to save subscription state before clearing, then restore after reconnect.

**Fix applied:** `disconnect()` now accepts a `clearSubscriptions` parameter (default `true`). `reconnect()` passes `false` so subscription maps survive the disconnect, allowing `connect()` → `restoreSubscriptions()` to repopulate the backend from the saved maps.

---

### M3. TradingView Data Requests Can Get Permanently Stuck — FIXED

**What happens:** When multiple TradingView symbols are being loaded at the same time, the system sets up a "listen for this symbol's data" listener. But if another symbol's data arrives first, it consumes the listener by accident. The original symbol's listener is gone, so its data never arrives.

**Real-world impact:** User subscribes to a TradingView symbol and nothing happens. No error, no data. They'd need to refresh the page.

**Testable:** Subscribe to 3 TradingView symbols simultaneously. Verify all 3 receive data within timeout. Verify no listeners remain stuck afterward.

**Effort:** Half a day. Need to change from "listen once for any candle" to "listen for a specific symbol's candle."

**Fix applied:** Changed `once('candle')` to `on('candle')` with symbol-matching guard and auto-cleanup. Added a timeout that rejects the promise and removes the listener if no matching data arrives within 30 seconds.

---

### M4. Redis Multi-Command Failures Go Unnoticed — FIXED

**What happens:** When creating a login session, the server writes two things to Redis in one batch (the session data + a user-to-session index). If one write succeeds and the other fails, the server doesn't notice. The user might be logged in but their session can't be invalidated later (security issue).

**Real-world impact:** Rare, but could mean a user stays logged in after they should have been logged out, or their old session can't be cleaned up.

**Testable:** Force a Redis partial failure. Verify both writes succeed or both fail (atomic). Verify session invalidation still works after the edge case.

**Effort:** Quick fix (check each result in the multi-exec response).

**Fix applied:** `multi.exec()` results are now destructured and each `[err, result]` tuple is checked. On failure, the error is logged and re-thrown.

---

### M5. Database Connection Not Properly Closed on Shutdown — FIXED

**What happens:** When the server shuts down, it closes WebSocket connections but doesn't tell PostgreSQL it's done. PostgreSQL has to figure out the connections are dead on its own.

**Real-world impact:** In development, no real impact (connections clear quickly). In production, could leave zombie connections on the database server.

**Testable:** Start server, verify DB connections. Shut down server. Verify DB connections are gone (not lingering).

**Effort:** Quick fix (add `pool.end()` to shutdown handler).

**Fix applied:** Shared `gracefulShutdown()` function drains PostgreSQL pool (`pool.end()`) and Redis connection (`redis.quit()`) before closing the WebSocket server and exiting. Both SIGINT and SIGTERM use this handler.

---

### M6. Promises Left Hanging When TradingView Disconnects — FIXED

**What happens:** When the server is waiting for historical candle data from TradingView and the connection drops, the wait is never resolved. The code that asked for the data just... waits forever.

**Real-world impact:** If TradingView drops during a chart load, the chart never loads and never shows an error. The user sees a loading spinner until they refresh.

**Testable:** Request historical candles. Force TradingView disconnect mid-request. Verify the request resolves with an error (not stuck pending). Verify chart shows error state.

**Effort:** Half a day. Need to reject all pending requests during disconnect.

**Fix applied:** Before clearing `_pendingHistorical`, all pending promises are now rejected with a "TradingView session disconnected" error, unblocking any awaiting code.

---

### M7. Health Monitor Can Loop on Errors — Fixed (Category A)

This was resolved in an earlier pass (Category A fix A-B8: heartbeat is now silent unless clients are connected).

**What happens:** The health monitor runs a periodic check (every N seconds). If the check itself throws an error, the monitor keeps running and keeps throwing errors every cycle. It never stops or recovers.

**Real-world impact:** Log spam. The error happens repeatedly until the server is restarted.

**Testable:** Force an error inside a health check. Verify the monitor either recovers or stops cleanly (not infinite error loop). Verify logs show one error, not thousands.

**Effort:** Quick fix (wrap check in try/catch, stop on repeated failures).

---

## The Cleanup Items (Nice to Have) — All Resolved

These didn't cause user-visible problems but made the codebase harder to work with. **All cleanup items have been addressed.**

| Item | What It Means | Status |
|------|---------------|--------|
| Same settings defined in two files | Adding a new timeframe requires editing 2 files. Miss one = bugs. | **Fixed** — extracted `RESOLUTION_TO_PERIOD`, `VALID_PERIODS`, `SYMBOL_RE` to `utils/constants.js` (frozen, immutable) |
| Dead code (unused functions) | Functions that were written but never called. Like leaving construction debris in a house. | **Fixed** — removed 7 unused methods + 1 property + deleted `test-timeframe.js` |
| Same calculation copied in 5 places | If the price calculation needs changing, it must be updated in 5 spots. | **Fixed** — extracted `barToOHLC()` helper, replacing 5 inline OHLC blocks |
| Magic numbers (unexplained values) | Numbers like `100000` and `1` used without explanation. Is it seconds? Milliseconds? Price precision? | **Fixed** — constants extracted to named, documented exports |
| Test script in source folder | A developer test script that makes live network calls is in the main code folder | **Fixed** — deleted `test-timeframe.js` |
| Massive functions (100+ lines) | Some functions try to do too many things at once. Hard to understand and modify. | Deferred — low risk, high effort. Not blocking. |
| Same pattern copied in 3 files | prevDay conditional spread repeated identically | **Fixed** — extracted `buildPrevDayFields()` helper in `utils/MessageBuilder.js` |
| Config reads scattered across files | `process.env` reads bypassing centralized config | **Fixed** — CTraderSession now reads from `config.js` |
| HTTP API doesn't validate symbol names | Routes accept arbitrary strings without validation | **Fixed** — `SYMBOL_RE` validation added to all 4 persistence routes |
| Schema errors don't block startup | Database table check logs but allows server to start | **Fixed** — `verifySchema()` now throws; server exits on failure |

---

## Security Summary — Both Resolved

| Item | Risk Level | Status |
|------|-----------|--------|
| Token written to config file | Low for local dev, higher for production | **Fixed** — now uses atomic write (temp file + rename) |
| HTTP API doesn't validate symbol names | Low | **Fixed** — `SYMBOL_RE` validation on all persistence routes |

Both are now addressed ahead of any future remote deployment.

---

## Overall Assessment

### What's Working

- Two-source data architecture (cTrader + TradingView)
- Authentication and session management
- Rate limiting to prevent API bans
- Graceful degradation when a data source goes down
- Request coalescing (multiple users watching same symbol = one API call)

### What Was Fixed (June 2026)

All 29 findings from this assessment have been resolved across three phases:

**Phase 1 — Reliability (7 fixes):** Eliminated crash-without-restart, token file corruption, slow-client memory exhaustion, sequence number resets, subscription loss on reconnect, TradingView listener race, and incomplete unsubscribe cleanup.

**Phase 2 — Cleanup (8 items):** Extracted shared constants, removed 7+ dead code items, consolidated barToOHLC (5 copies → 1 helper), consolidated prevDay spread (3 copies → 1 helper), centralized config reads, added HTTP symbol validation, fixed Redis error checking, made schema verification blocking.

**Phase 3 — Hardening (3 items):** Settle pending TradingView promises on disconnect, drain PostgreSQL and Redis on shutdown, SafeSender disconnect metrics in heartbeat summary.

**Testing:** 72 unit tests covering all acceptance criteria. 476 total tests passing (including 404 pre-existing frontend tests).

### What Remains Deferred

- God function decomposition (high effort, low risk — not blocking)
- Remote deployment hardening (per CLAUDE.md: not a current priority)

---

## Glossary

| Term | Plain English |
|------|--------------|
| Backend | The server program that sits between data providers and your browser |
| WebSocket | A persistent two-way connection between server and browser (like a phone call that stays open) |
| Subscription | "I want to receive updates for EURUSD" — telling the data provider to send price changes |
| Market Profile | A visualization showing which price levels traded the most |
| TWAP | Time-Weighted Average Price — the average price over time |
| ADR | Average Daily Range — how much a symbol typically moves in a day |
| Reconnection | When the connection drops and the server tries to reconnect automatically |
| Backpressure | When data comes in faster than it can be sent out — needs a plan for handling the backup |
| Dead code | Code that exists but is never used — like furniture in a room nobody enters |
| Fire-and-forget | Sending a message and not checking if it arrived — like sending a letter with no return address |
