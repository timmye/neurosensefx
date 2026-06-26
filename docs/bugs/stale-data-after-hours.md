# Bug: Frontend Shows Stale Data After Hours (Requires Restart)

**Status:** Root cause identified. **Defects #1–#5 + the fallback trap are RESOLVED (2026-06-24)** by executing plan `plans/feed-recovery-supervision.md` (path A→B): a `FeedSupervisor` supervision tier was extracted (explicit state machine, injected clock/transport) and the entire defect cluster was fixed at the source; **recovery is now unit-tested offline** (`npx vitest run`, 149 tests green), including the hang-after-open and hung-command modes that were the next likely incident. **Defect #1 was earlier fixed 2026-06-22 and verified in production 2026-06-23** (MAX_LEVELS freezes ~90k→1,999, all on VIX). See **"Update (2026-06-24)"** below.
**Date:** 2026-06-22
**Area:** `services/tick-backend/`

## Fix applied (2026-06-22) — defect #1

Implemented recommendations (a)+(b) so all data feeds behave identically. A shared
canonical `normalizeSymbol` (upper-case + strip slashes/suffixes) lives in
`services/tick-backend/utils/normalizeSymbol.js` and is used by both the Market
Profile and TWAP subsystems:

- **MarketProfileService** normalizes at every entry point — `onM1Bar`, `subscribeToSymbol`, `cleanupSymbol`, `getFullProfile`, `processPendingBars`, `initializeFromHistory`, `reemitProfile`, `_incrementSequence`. cTrader (normalized) and TradingView (raw) bars now key ONE profile per instrument.
- **Auto-init passes `bar.close` as `currentPrice`** (`MarketProfileService.js`) so a stray auto-init uses a price-based bucket, never the flat `0.0001`.
- **TwapService** normalizes at `onM1Bar`, `initializeFromHistory`, `resetDaily`, `getTwap` — so TWAP (part of the ticker display) accumulates into ONE state per instrument across feeds instead of splitting per name form.
- **`isSymbolInitializing(symbol)` accessors** on both services; `WebSocketServer.performDailyReset` uses them instead of reaching into the raw Maps (which would miss the canonical key).
- **Frontend `subscriptionManager`** dispatches `profileUpdate` **and** `twapUpdate` normalized + source-agnostically (mirrored `normalizeSymbol`), so the canonical emit matches any subscribed name form and the shared value reaches all subscribers. Tick routing untouched.
- Tests: `marketProfileNormalization.test.js` (5), `twapNormalization.test.js` (6, incl. the shared util), and `subscriptionManager.test.js` (6). All backend (83) and frontend (482) unit tests pass.

**Not changed (deliberate):** `BUCKET_PERCENTAGE` left at `0.0001` (price-path buckets are fine after rounding); no level eviction (would corrupt TPO semantics). The tick path and `CTraderSymbolLoader.normalizeName` are untouched. **Live verification still pending** — needs a running backend (cTrader creds + PG + Redis) to confirm the mini-profile + TWAP stay live for jpn225/xagusd/etc. over hours.

## Update (2026-06-23): Defect #1 verified FIXED in production; active stall moved to the feed-reconnection deadlock

After ~17h of overnight testing with the defect #1 fix live, the *original* symptom
(frozen mini market profiles in tickers) is gone — but a **different** stall appeared:
the cTrader (and TradingView) data feeds silently die and never recover, again requiring
a full restart. This is the deferred cTrader-path finally firing in production.

> **Port note (corrects an earlier misread).** cTrader Open API is protobuf-over-TLS on
> port **5035** (`config.js:41`, `.env PORT=5035`) — **not** HTTPS/443. An earlier
> "443 unreachable" diagnosis was probing the wrong port and was incorrect.

### Defect #1 fix — verified working

`MAX_LEVELS` profile freezes dropped from ~90,000 (12 symbols) to **1,999, all on a
single symbol — VIX**. The `normalizeSymbol` fix worked for every instrument except VIX,
which legitimately accumulates >3000 levels under current bucket sizing. VIX is a minor
residual (fix: make `MAX_LEVELS` degrade/re-bucket rather than freeze) — **not** the stall.

### The active stall is the cTrader feed-reconnection deadlock

**Network is healthy — verified live during the stall.** On port 5035: DNS resolves; raw
TCP to `live.ctraderapi.com:5035` and its IP `13.248.223.213` is reachable; **TLS handshake
completes cleanly** (cert `*.ctraderapi.com`, chain `GoGetSSL RSA DV CA` → `USERTrust`,
`verify return:1` at every depth). TradingView host is also reachable.

So the stall is **not** a network outage. The network path is fine; the code gave up trying
and won't resume.

#### Log signals during the stall (current `backend.log`, 3.02M lines, onset ~22:50 UTC)

| Signal | Count | Meaning |
|--------|------:|---------|
| `Max reconnection attempts reached. Giving up.` | **8** | Defect #5 permanently surrendered (×8) |
| `Scheduling reconnect attempt` | 1,409 | Reconnection churning |
| `Reconnect attempt failed` | 491 | Attempts failing |
| `CTraderConnection error` | 430 | Socket errors |
| `DNS resolution failed … falling back to direct connect` | 468 | Fallback path invoked |
| `connection timeout after 10 seconds` | 468 | 100% of fallback attempts timed out |
| `getaddrinfo ENOTFOUND/EAI_AGAIN live.ctraderapi.com` | ~430 | Transient DNS blip (Docker resolver `192.168.65.7`) |
| `Connection stale` (staleness watchdog) | **0** | Defect #2: watchdog never fires despite all the above |
| `MAX_LEVELS` (defect #1) | 1,999 (all VIX) | Original bug essentially resolved |

### Reconnection lifecycle (mapped)

```
              ┌──────────────────────────────────────────┐
              │        CTraderSession.connect()   :61    │
              └────────────────────┬─────────────────────┘
                                   │
        CTraderConnection.open()  ─┴─►  CTraderSocket.connect()   libs/.../CTraderSocket.ts:27
        wrapped in Promise.race          ├─ primary: dns.lookup→IP → tls.connect(IP:5035)   ✓
        with 10s timeout  (:85)         └─ fallback (on DNS throw): tls.connect(hostname) ← WSL2 TLS-hang
                                   │
                ┌──────────────────┴───────────────────┐
             SUCCESS                              FAILURE  (10s timeout / err)
                │                                      │
   authenticate :100                                 ▼
   loadAllSymbols :101                   handleDisconnect(err, true)   :96 / :208
   restoreSubscriptions :104                      │
   startHeartbeat :106                       reconnection.cancelReconnect()   :315
   healthMonitor.start()+recordTick :111-112   ⚠ clears TIMER, NOT the attempt counter
   reconnection.reset() :114  ◄── ONLY reset path      │
   emit('connected') :115                            ▼
                │                            scheduleReconnect()   :333
          ✅ FEED ALIVE                              │
                                          ReconnectionManager.scheduleReconnect()
                                          reconnectAttempts++ (:36); backoff → connect()
                                                │   (loop up to 20×)
                                                ▼
                                     reconnectAttempts ≥ 20   (ReconnectionManager.js:23)
                                                ▼
                                   silent no-op + log.error → 💀 DEADLOCK
```

### Exact failure chain (this incident)

1. **~22:50 UTC** — the Docker-embedded DNS resolver (`192.168.65.7`) blips → `dns.lookup`
   throws `ENOTFOUND`/`EAI_AGAIN` (`CTraderSocket.ts:33`).
2. **Fallback path** runs (`CTraderSocket.ts:60-66`): it passes the **hostname** back to
   `tls.connect`. The code's own comment (`:28-30`) says this exact call hangs the TLS
   handshake on WSL2/Codespaces. → `secureConnect` never fires.
3. The 10s Promise race (`CTraderSession.js:85,89`) fires → `handleDisconnect(error, true)` (`:96`).
4. Loop: `handleDisconnect → scheduleReconnect → connect → fail` ×20.
5. `reconnectAttempts` hits 20 → `ReconnectionManager.scheduleReconnect` becomes a
   **silent no-op** (`ReconnectionManager.js:23-26`).
6. **Deadlocked.** The network fully recovers minutes later (TLS handshake verified clean),
   but nothing retries — the only counter-reset is a successful connect (`reset()` at
   `ReconnectionManager.js:39` / `CTraderSession.js:114`), and `cancelReconnect`
   (`ReconnectionManager.js:50`) never resets it.

### Why there's no self-heal — compounding defects

| Defect | Where | Effect |
|--------|-------|--------|
| **#5 — permanent give-up** | `ReconnectionManager.js:23-26`; `config.js:49` (=20) | After 20 failures the feed is dead for the process lifetime. No reset, no escalation, no event. `cancelReconnect` clears the timer but not the counter. |
| **#2 — blind watchdog** | `HealthMonitor.js:34` (`isStale = this.lastTick && …`) | On a never-/fully-disconnected feed, `lastTick===null` → `null && …` is falsy → **staleness can never evaluate true.** When partially up, heartbeat-driven `recordTick` (`CTraderSession.js:345`) masks it. → `Connection stale: 0` despite 430 errors. |
| **Fallback trap** | `CTraderSocket.ts:60-66` | The DNS-fallback re-introduces the exact WSL2 TLS-handshake hang the primary path was written to avoid. 100% of the 468 fallback attempts timed out. |

`TradingViewSession` uses the **same** `ReconnectionManager` (class docstring, `:2-3`) and
shows the same `Not connected` in the live tail — same latent bug, triggered later/less.

### The "no downtime" problem

There is currently **no recovery path shorter of a full process restart**:

- No self-heal (defect #5 deadlock).
- No reconnect/restart HTTP endpoint — `/api/dev/restart` in `docs/dev-lifecycle-modernization.md`
  was **designed but never implemented** (`httpServer.js` has only `/api/candles` + auth/persistence).
- No process supervisor in dev (`process.exit` kills the process permanently — `server.js:39,47,82`).
- The only lever today is `run.sh` restart = client disconnects + full state rebuild = **downtime**.

**Key architectural fact that makes zero-downtime recovery possible:** reconnecting the feeds
does **not** require restarting the process. The WebSocket server and connected clients stay up;
only `CTraderSession` / `TradingViewSession` need to `connect()` again. A fix can therefore
recover feeds with **zero client downtime** — it's purely a matter of (a) breaking the give-up
deadlock and (b) having something trigger reconnect.

### Fix direction (zero-downtime, ordered — targeted, not a rewrite)

1. **Break the deadlock (defect #5).** Make `ReconnectionManager` retry indefinitely with a
   capped backoff (after 20 attempts, keep retrying every `maxDelay`), and expose a public
   `reset()` / `forceReconnect()`. Smallest possible change; immediately turns "dead forever"
   into "keeps trying."
2. **Add an on-demand reconnect.** `CTraderSession.reconnect()` → `reconnection.reset()` +
   `connect()`, wired to a dev HTTP endpoint. Recovers feeds without touching the process →
   **no client downtime**. (Resurrects the half-built `/api/dev/restart` design, but as a
   *feed reconnect*, not a process kill.)
3. **Fix the fallback trap** (`CTraderSocket.ts:60-66`): on a DNS throw, retry `dns.lookup`
   a couple of times and/or fall back to a **cached last-known-good IP** instead of handing
   the hostname back to `tls.connect`. Removes the 100% fallback-timeout mode at its source.
4. **Fix the watchdog (defect #2).** Track `lastDataTick` separately from heartbeat, and
   treat `lastTick===null && connected` as stale so a never-connected feed is detected.

Items 1+2 alone convert "must restart (downtime)" into "self-heals, or one curl (no downtime)."
Items 3+4 harden the trigger so it's rarer and always caught.

## Symptom

After a recent backend refactor, the frontend shows stale / outdated data once the
system has run for a few hours. A **full system restart** is required to recover (a
page refresh alone does not fix it — so the backend producer has degraded/stopped, not
the frontend connection). Suspected backend; confirmed backend.

## TL;DR — Root cause is a cluster of defects, not one line

There is no single bug. There are several independent defects that all converge on the
same failure mode: **the backend has no reliable way to detect or recover from a feed
that is "alive" but no longer delivering usable market data.** A restart fixes it
because it rebuilds the TLS socket and clears all accumulated state from scratch.

The defects, in descending order of how strongly they are evidenced:

| # | Defect | Evidence tier | Affects |
|---|--------|---------------|---------|
| 1 | `MarketProfileService` `MAX_LEVELS` guard **permanently pauses** profile updates per symbol, with no eviction/recovery | **CONFIRMED in production logs** (≈90k occurrences, 12 symbols) | Market Profile feed |
| 2 | `HealthMonitor` staleness watchdog measures *protocol* liveness (heartbeats), not *data* liveness, so it never fires when data goes stale | **CONFIRMED in code**; consistent with logs | cTrader self-heal |
| 3 | `e0bf607` refactor clobbers a valid trendbar tick with `null` from `processSpotEvent` during illiquid periods | **CONFIRMED in code** | cTrader tick feed |
| 4 | `CTraderCommandMap` has no command timeout and does not reject pending commands on socket close → hung `sendCommand` on a half-open socket | **CONFIRMED in code** | cTrader all paths |
| 5 | `ReconnectionManager` permanently gives up after 20 attempts | **CONFIRMED in code** | recovery |
| 6 | `TradingViewSession` leaks `candle` event listeners | **CONFIRMED in logs** (`MaxListenersExceededWarning`) | TradingView feed |

---

## Findings confirmed in production logs

Source: `backend.log` (179,914 lines, last written 2026-06-18). Runbook to reproduce
these checks is at the bottom of this doc.

### 1. MAX_LEVELS permanently pauses Market Profile for nearly every instrument — **the dominant signal**

The `MAX_LEVELS` guard fires on **≈50% of all log lines (89,795 occurrences)**, starting
at line 176 (very early in the session) and continuing to the very last line.

```js
// services/tick-backend/MarketProfileService.js:134-143
if (profile.levels.size >= this.MAX_LEVELS) {          // MAX_LEVELS = 3000
    console.warn(`[MarketProfile] ${symbol} exceeded ${this.MAX_LEVELS} levels`);
    this.emit('profileError', { ... message: 'Profile exceeded 3000 levels. Updates paused.' });
    return;                                            // ← every subsequent bar also returns
}
```

`profile.levels` only ever grows (`profile.levels.set(price, newTpo)` at line 151) —
there is **no eviction, no trim, and no recovery** until UTC-midnight daily reset or a
restart. Once a volatile instrument accumulates 3000 distinct price levels, its
`profileUpdate` stream is frozen for the rest of the session.

Symbols hit (from the log, with occurrence counts):

```
13035 xagusd   10102 jpn225   9993 AUS200   9571 GBPJPY   8934 SPX500
8737 EURJPY    7775 CHFJPY    7591 AUDJPY   5494 NZDJPY   4595 GER40
2255 BRENT     1713 WTI
```

**This is a direct, active cause of "stale data":** every Market-Profile-derived
overlay (POC, value area, TPO, etc.) freezes for these symbols until restart.
**User confirmed (2026-06-22):** the stale data was the **mini market profile in
tickers**; live prices were fine. This exonerates the cTrader tick path (defects
#2–#5) as the *active* symptom — they remain latent. Defect #1 is the live bug.

#### Regression root cause (CONFIRMED in code + logs) — commit `e0bf607`

The freeze is **not** the `MAX_LEVELS` cap itself (unchanged since file creation) — it
is a **symbol-name mismatch** that forces profiles through a catastrophic bucket size:

1. `e0bf607` added `CTraderSymbolLoader.normalizeName()` and stored **normalized** names
   in the symbol maps, so cTrader `m1Bar.symbol` is normalized (e.g. `USDJPY`).
2. `TradingViewCandleHandler` initializes profiles under the **raw/client** string
   (e.g. `usdjpy`). Same instrument → two different profile keys.
3. When the normalized cTrader bar arrives, `profiles.get('USDJPY')` misses → the
   auto-init branch fires (`MarketProfileService.js:74-81`) calling
   `subscribeToSymbol(symbol, source)` **with no `currentPrice`**.
4. `calculateBucketSizeForSymbol(symbol, null)` (`:447-485`) skips the price-based path.
   None of the affected instruments match the no-price string rules (indices, oil, JPY
   crosses; lowercase `xagusd` fails the case-sensitive `includes('XAG')`) → all hit the
   **flat forex default `return 0.0001`** (`:484`).
5. A flat `0.0001` bucket on instruments ranging hundreds of points → **millions of
   levels** → instant `MAX_LEVELS` freeze.

**Log clincher:** the auto-init warning `No profile found for X` fires 57×, and the
**same instrument appears under both name forms** — `USDJPY` *and* `usdjpy`, `XAUUSD`
*and* `xagusd`, lowercase `jpn225` beside uppercase `AUS200`/`SPX500`. That mixed
casing is the fingerprint of the divergence.

**Why the price-based path is fine:** `bucket = price × 0.0001` *after rounding* lands
in a usable range — XAUUSD→0.3 (~100 levels), jpn225→3.9 (~100), GBPJPY→0.02 (~60),
all far under 3000. The blowup is purely the flat-no-price path. (Latent accomplice:
the comment at `:496` documents `0.001 = 0.1%` but the constant is `0.0001` — 10×
smaller than documented. Leave it; see fix #1.)

### 2. Zero cTrader detection activity — the watchdog never fires

Across the entire log:

| Signal | Count |
|--------|-------|
| `Max reconnection attempts reached` | **0** |
| `Scheduling reconnect attempt` | **0** |
| `Reconnect attempt failed` | **0** |
| `Connection stale` (staleness watchdog) | **0** |
| `CTraderConnection error` | **0** |
| `Unhandled error in PROTO_OA_SPOT_EVENT handler` | **0** |
| `unhandledRejection` | **0** |

The cTrader connection is recorded as perfectly healthy for the whole period — yet the
user sees stale data. This is exactly the signature of defect #2: when data goes stale
but heartbeats keep flowing, **nothing logs it and nothing recovers.** The silence is
not proof the cTrader path is fine; it is proof the detection machinery is deaf to this
failure mode.

> ⚠️ Caveat: this log period may simply not contain a captured cTrader stall. The
> cTrader-path defects (#2–#5) are confirmed by reading the code; they are *latent*
> here rather than *demonstrated firing* in this log. MAX_LEVELS (#1) is the one with
> overwhelming live evidence.

### 3. TradingView feed has its own staleness paths

```
(node:...) MaxListenersExceededWarning: 11 candle listeners added to [TradingViewSession]
[RequestCoordinator] TradingView data timeout for spy/tlt
[TradingView] Series completion timeout for spy/tlt
... same pattern for xcuusd/xauusd, de02y/us02y
```

- A confirmed **listener leak** on `TradingViewSession` (the `candle` event —
  `RequestCoordinator.handleTradingViewRequest` registers `.on('candle', ...)`
  per request; cleanup is missing on at least one path).
- Math-expression symbols (`spy/tlt`, `xcuusd/xauusd`, `de02y/us02y`) hit
  series-completion timeouts → those composite symbols go stale.

---

## Confirmed code-level defects (cTrader path)

These are verified by reading the source. They explain *why* a stall never self-heals.

### Defect 2 — Staleness watchdog conflates heartbeat liveness with data liveness

```js
// services/tick-backend/HealthMonitor.js:33-34
checkStaleness() {
    const isStale = this.lastTick && (Date.now() - this.lastTick) > this.stalenessMs; // 60s
```

`recordTick()` is called from **two** sources:

```js
// services/tick-backend/CTraderSession.js:187-190  (data path)
if (tickData) {
    this.healthMonitor.recordTick();
    this.emit('tick', tickData);
}

// services/tick-backend/CTraderSession.js:342-345  (heartbeat path)
this.heartbeatEventHandler = () => {
    this.healthMonitor.recordTick();   // ← fires every echoed heartbeat (~10s)
};
```

So as long as the socket keeps echoing `ProtoHeartbeatEvent`, `lastTick` stays fresh
**even when no prices are arriving.** The 60s watchdog cannot distinguish "socket alive,
data flowing" from "socket alive, data dead." This is the reason defect #1's freeze, and
any future cTrader data stall, is never detected.

### Defect 3 — `e0bf607` refactor clobbers a valid tick with `null`

```js
// services/tick-backend/CTraderSession.js:179-190  (commit e0bf607)
// Always derive live tick price from bid/ask when available.
if (event.bid != null && event.ask != null) {
    tickData = this.eventHandler.processSpotEvent(event, symbolName, symbolInfo); // can return null
}

if (tickData) {                       // ← skipped when processSpotEvent returned null
    this.healthMonitor.recordTick();  // ← skipped  → watchdog not fed from data path
    this.emit('tick', tickData);      // ← skipped  → tick dropped
}
```

`processSpotEvent` returns `null` on crossed / zeroed / non-finite quotes
(`CTraderEventHandler.js` — conditions `!isFinite(bid)`, `bid <= 0`, `ask <= bid`),
which occur around rollover, market close, and thin liquidity. When it does, a
previously-valid trendbar-derived `tickData` is **overwritten and lost**, no tick is
emitted, *and* the data-path `recordTick()` is skipped. This is the change that ties
most directly to the "recent refactor" the user flagged.

### Defect 4 — `sendCommand` has no timeout and isn't cleaned up on close

```js
// libs/cTrader-Layer/build/src/core/commands/CTraderCommandMap.js:27-40
create({ clientMsgId, message }) {
    const command = new CTraderCommand({ clientMsgId });
    this.#openCommands.set(clientMsgId, command);   // only removal path is extractById()
    this.#send(message);
    return command.responsePromise;                 // hangs forever if reply is lost
}
```

`extractById` (line 33) is the **only** removal path. There is no method to reject or
clear all pending commands when the socket closes. Two consequences:

- **Heartbeat leak:** the backend sends heartbeats via `sendCommand`, but the server
  echoes them back as a push event (`payloadType 51`, no `clientMsgId`) — see the
  comment at `CTraderSession.js:338-341` — so they are **never extracted** and leak one
  pending promise + Map entry per ~10s (~360/hour), unbounded.
- **Hung commands:** after a NAT/firewall idle-timeout silently half-kills the TLS
  socket, the next `sendCommand` (auth refresh, symbol load, subscription, history
  fetch) hangs forever. Callers that `await` it serially (`authenticate`,
  `loadAllSymbols`, `getFullSymbolInfo`, all `subscribeToX`) stall.

### Defect 5 — ReconnectionManager permanently gives up

```js
// services/tick-backend/utils/ReconnectionManager.js:19-23
scheduleReconnect(reconnectFn) {
    if (this.reconnectAttempts >= this.maxAttempts) {   // maxAttempts = 20 (line 6)
        console.error('[ReconnectionManager] Max reconnection attempts reached. Giving up.');
        return;                                          // ← no exit, no alert, no retry
    }
```

After 20 failed attempts the feed is dead for the lifetime of the process with only a
console message. This matches "needs a full restart."

---

## Secondary contributors (lower confidence / lower priority)

- **`lastPrices` cache has no staleness check**
  (`WebSocketServer.js:512`): `currentPrice: this.lastPrices.get(symbol)?.price ?? null`
  decorates candle-history responses with the last-known price forever, even after the
  live tick source stops. The stored `timestamp` is never read.
- **Connection reassign-before-detach** (`CTraderSession.js` `connect()` ~line 66-78):
  `this.connection` is reassigned before `removeEventListeners()` runs, so the old
  socket's listeners are never detached → zombie connections and reconnect races over
  many cycles. *(Identified in analysis; not re-verified line-by-line in this session.)*
- **`restoreSubscriptions()` swallows per-symbol failures** (`CTraderSession.js:367-401`):
  a failed re-subscribe leaves the symbol marked subscribed locally but unsubscribed
  upstream → that symbol never recovers.
- **RequestCoordinator `Promise.race` timeout orphans the underlying `sendCommand`**
  (`RequestCoordinator.js:113-116`): on timeout the original promise is never cancelled
  and stays in `#openCommands` (feeds defect #4).

---

## Recent changes (the refactor in question)

| Commit | Description | Relation to this bug |
|--------|-------------|----------------------|
| `e0bf607` | backend reliability: always derive live tick from bid/ask, normalize symbol names, fix prevDay fields | **Directly implicated (defect #3).** Changed trendbar/spot precedence so a null `processSpotEvent` can clobber a valid tick. |
| `df824bc` | backport TypeAlias import for older Python | Unrelated (skills/Python only). |
| `6bb01bd` | background theme store with localStorage | Unrelated (frontend only). |
| `3314b5d` | replace background shader with domain-warp fBm raymarcher | Unrelated (frontend visual). |
| `ee5918c` | update runtime state, clean up stale worktree | Unrelated. |

The MAX_LEVELS defect (#1) and the cTrader watchdog/command defects (#2, #4, #5)
**predate** the refactor — they are latent. The refactor is what made data-path staleness
more frequent (#3) on top of an already-fragile recovery design.

---

## Diagnostic runbook (reproduce the log checks)

The backend writes to `backend.log` (path set by `BACKEND_LOG` in `run.sh`). All
commands run from repo root. This is the exact procedure used to produce the findings
above.

### A. Quick triage — which mechanism is firing during a stall?

```bash
# MAX_LEVELS profile freezes (defect #1) — the headline check
grep -c "MAX_LEVELS" backend.log
grep -oE "routeProfileError: [A-Za-z0-9._/]+" backend.log \
  | grep -oE "[A-Za-z0-9._/]+$" | sort | uniq -c | sort -rn

# cTrader reconnect / staleness activity (defects #2, #5)
grep -c "Max reconnection attempts reached" backend.log   # permanent give-up
grep -c "Scheduling reconnect attempt"     backend.log   # any reconnect attempt
grep -c "Connection stale"                 backend.log   # watchdog firing
grep -c "CTraderConnection error"          backend.log   # socket errors

# TradingView feed health (defect #6 + series timeouts)
grep -c "MaxListenersExceededWarning"      backend.log
grep -iE "TradingView.*(timeout|stale|reconnect|error)" backend.log

# Unhandled rejections / handler crashes
grep -ci "unhandledRejection" backend.log
grep -c "Unhandled error in PROTO_OA_SPOT_EVENT handler" backend.log
```

### B. How to read the results

| Observation | Points to |
|-------------|-----------|
| `MAX_LEVELS` count in the tens of thousands across many symbols | Defect #1 is actively freezing Market Profile — fix this regardless |
| **All** symbols freeze at once + reconnect/error lines present | cTrader half-open socket (defects #4/#5) |
| **Some** symbols stale / intermittent, connection "connected", **zero** stale/reconnect lines | Defect #3 (refactor) — masked by heartbeat (defect #2) |
| `MaxListenersExceededWarning` repeats / listener count grows | defect #6 (or the cTrader connection-leak secondary) |

### C. Live instrumentation to add when reproducing (temporary)

To confirm defect #4's heartbeat leak, log the open-command count and memory growth over
time. In `CTraderCommandMap`, expose and periodically log `#openCommands.size`, and add a
process-memory sampler:

```bash
# add a one-shot memory probe to the running backend, e.g. via the dev endpoint or:
# console.log(JSON.stringify(process.memoryUsage())) on an interval
```

To confirm defect #2's masking, temporarily split `recordTick()` into `recordDataTick()`
(data path) and `recordHeartbeat()` (heartbeat path) and watch whether `recordDataTick`
stops while `recordHeartbeat` continues during a stall.

### D. What to capture during the next stall

When stale data is next observed, **before restarting**, grab:

1. `tail -2000 backend.log`
2. The full counts from section A
3. Whether the frontend's WebSocket is still open and receiving heartbeats (browser
   devtools → Network → WS frames) — heartbeats-but-no-ticks confirms defect #2/#3.

---

## Recommended fixes (prioritized, targeted — not a rewrite)

Per project preference for small targeted fixes. Ordered by evidence strength and blast
radius.

1. **Market Profile freeze (defect #1) — highest ROI, fully log-confirmed.**
   Fix the cause, not the cap:
   - **(a) Profile key consistency across feeds [fixes the regression].** Make every
     profile create/lookup site use one canonical (normalized) name — `onM1Bar`,
     `subscribeToSymbol`, the TradingView init path, and the frontend subscription.
     Each instrument then gets ONE profile receiving all its bars through the
     price-based bucket path. *Impact: zero change to profile methodology; frozen
     mini-profiles simply resume updating and become more complete.*
   - **(b) Pass `bar.close` as `currentPrice` into the auto-init `subscribeToSymbol`
     call** (`MarketProfileService.js:76`). Defense in depth: any stray auto-init'd
     profile gets a real price-based bucket instead of flat `0.0001`.
   - **(c) Never let the no-price fallback return a flat `0.0001`.** Require a price
     (skip/bar until known) or broaden the symbol-string rules (add indices/oil/JPY,
     fix the `XAG` case-sensitivity). Prevents the catastrophic-bucket mode recurring.
   - **(d) Make `MAX_LEVELS` degrade, not freeze.** When approached, log "bucket too
     small — re-sizing" and re-bucket larger rather than `return`-ing forever. Safety
     net only; never triggers with (a)–(c).
   - **Do NOT** blindly flip `BUCKET_PERCENTAGE` `0.0001→0.001`. The price-based path
     already yields ~60–225 levels for these instruments after rounding; 0.001 would
     make profiles **10× coarser** (XAUUSD → ~10 levels) and visibly degrade them.
   - **Do NOT** add level eviction/trimming — it corrupts TPO/POC/value-area semantics.
2. **Decouple data staleness from heartbeat liveness (defect #2).** Track
   `lastDataTick` separately from heartbeat; have the watchdog fire on data staleness,
   not protocol liveness.
3. **Guard the bid/ask overwrite (defect #3).** Only replace `tickData` when
   `processSpotEvent` returns non-null, so a null during illiquid periods doesn't clobber
   a valid trendbar tick.
4. **Add a timeout to `sendCommand` + reject pending commands on close (defect #4).**
   Stop routing heartbeats through the command map; reject all `#openCommands` in the
   socket `close`/`error` handler; add a per-command TTL.
5. **Make `ReconnectionManager` recoverable (defect #5).** Either never permanently give
   up, or emit a fatal event that lets the process supervisor restart it (matching the
   existing "exit so the process manager can restart" philosophy).
6. **TradingView listener leak (defect #6).** Ensure `.on('candle', ...)` is removed on
   every exit path; investigate the `MaxListenersExceededWarning` source.

## Open questions to confirm before fixing the cTrader path

- ~~Does "stale data" mean price/ticks or profile overlays?~~ **Answered 2026-06-22:**
  the mini market profile in tickers; live prices were fine → defect #1 is the live bug,
  defects #2–#5 are latent. Fix #1 first; #2–#5 can wait unless a price-stall is observed.
- Capture a log during an actual stall (section D) to turn defects #2–#5 from
  latent-confirmed to firing-confirmed.
- Before fixing #1(a), verify no symbol is *intended* to keep separate per-source
  profiles (the dual-source architecture may rely on per-source keys in places).

## Update (2026-06-24): Defect cluster RESOLVED — supervision tier built and offline-tested

Plan `plans/feed-recovery-supervision.md` (path **A → B**) was executed in full. The
cTrader feed-reconnection deadlock and its sibling defects are resolved **at the source**,
not patched line-by-line. Defects **#2/#3/#4/#5 and the fallback trap** are all closed:

- **#5 (give-up)** — `utils/ReconnectionManager.js` no longer permanently surrenders. After
  `maxAttempts` it keeps retrying indefinitely at the capped, jittered `maxDelay`, with a
  periodic escalation `log.warn` so a genuinely-broken feed is detectable rather than
  silent; `reset()` zeroes counter+delay and cancels the pending timer.
- **#2 (blind watchdog)** — a new `HealthSensor` (`services/tick-backend/supervision/`)
  splits data-tick vs heartbeat and treats never-received-data as **stale**, so a
  never-/fully-disconnected feed is now detected.
- **#3 (null-tick clobber)** — `CTraderSession` only adopts a spot tick when
  `processSpotEvent` returns non-null, so a quiet/rollover null no longer clobbers a valid
  trendbar tick or skips `recordTick`.
- **#4 (hung command / handshake hang)** — a new transport adapter
  (`supervision/CTraderTransportAdapter.js`) wraps every `sendCommand` with a per-RPC TTL
  and reject-on-close; the supervisor also enforces a connect-phase deadline
  (CONNECTING/HANDSHAKING held too long → BACKOFF), which is the **hang-after-open fix**.
- **Fallback trap (WSL2 TLS)** — the adapter passes the **hostname** straight through to the
  library (the library's primary path already does `dns.lookup(host) → tls.connect({ host: ip,
  servername: host })`, so the `*.ctraderapi.com` cert verifies). Pre-resolving to an IP in the
  adapter was tried in the first live run and **rejected**: it made the library use the IP as the
  TLS ServerName → cert mismatch (`Hostname/IP does not match certificate's altnames`). The
  remaining failure mode — the library's *fallback* (`tls.connect(hostname)` on a DNS throw),
  which hung on WSL2 during the incident — is instead mitigated one tier up: the supervisor's
  connect-phase deadline now covers the **open** phase too, so a hanging `open()` is bounded and
  the never-give-up retry re-arms until DNS recovers and the primary path succeeds. (The original
  incident's harm was the permanent *give-up*, not the bounded hang — that give-up is gone.)

### A new supervision tier owns recovery

`services/tick-backend/supervision/` houses `FeedSupervisor` (lifecycle owner), `RetryPolicy`
(never-terminating capped+jittered backoff), `FeedState` (explicit state machine with **no
terminal DEAD state** and a `HANDSHAKING` stall path), `HealthSensor`, transport/clock
contracts (`interfaces.js`), and `CTraderTransportAdapter`. The clock and transport are
**injected**, making recovery deterministic and unit-testable. `server.js` constructs the
supervisor and runs the cTrader session in `supervised` mode (a dumb I/O worker that emits
connected/disconnected/tick/heartbeat; the supervisor owns recovery). New surface:
`GET /health` (reads `supervisor.observableState()`) and dev-only
`POST /admin/reconnect {feed}`; `WebSocketServer.handleReinit` rewires to
`supervisor.reset('ctrader')`.

### Recovery is now provable offline

The North Star of the plan — *"does it recover?" is a unit test, not an overnight run* — is
met. `services/tick-backend/__tests__/supervision/recovery.test.js` exercises every
connect/reconnect/recovery path with the backend fully **offline** (no creds/PG/Redis/network):
self-heal after a failure burst; hang-after-open (#4) rescued by the deadline; hung-command
backstop; DEGRADED→reconnect; quiet-window false-staleness (#3) does **not** trip;
never-received→STALE→reconnect; `reset()`; subscriptions preserved across reconnect; and
per-feed isolation. A B0 characterization safety net
(`__tests__/characterization/{ctraderConnect,tradingviewConnect}.test.js`) scripts the full
cTrader protobuf handshake and asserts subscription restore symbol-for-symbol. Full suite:
`cd services/tick-backend && npx vitest run` → 13 files, **149 tests passing** (+1 skipped
integration).

### TradingView scoping (deliberate)

TradingView keeps its **own** self-recovery (Phase A fixed its defect #5 give-up via
`reconnection.reset()`). It is **not** wired through the supervisor — its connection model
(`tradingview-ws`, no protobuf `sendCommand`/TTL concern) is different, so full
supervisor-integration is a documented follow-up rather than a current gap. `/health`
currently surfaces the supervised cTrader feed's state.

See `docs/architecture/feed-recovery-supervision-review.md` (the design rationale) and
`plans/feed-recovery-supervision.md` (the executed plan) for full detail.

### Open finding from the first live run (2026-06-24): cTrader reconnects every ~30s

The refactor's first live run (`./run.sh start`, prod) confirmed the supervision tier works
end-to-end — cTrader authenticates and connects, `/health` reports `CONNECTED`, and recovery is
driven by the supervisor — **but** it also surfaced an **unresolved** behavior to track:

- **Symptom:** cTrader reconnects roughly **every ~30 s** — connect → clean broker close →
  supervisor recovers (`BACKOFF` → `CONNECTED` in ~1 s), repeat. Over ~7 min uptime: **13
  connects / 12 disconnects**. Every disconnect is a **clean broker-initiated close** (logged
  `connection lost: feed disconnected`, no error).
- **Ruled out (not the cause):**
  - **Not credentials** — `.env` is untouched during the run (no `persistTokens` write), and there
    are **no** `CH_ACCESS_TOKEN_INVALID` / refresh-token lines, so the access token authenticates
    cleanly.
  - **Not the supervisor's health logic** — **0** `DEGRADED`/`STALE`/forcing-reconnect lines; the
    new health sensor is not churning. Every reconnect is a genuine broker close it recovers from.
  - **Not the heartbeat change** — the session calls `connection.sendHeartbeat()`, which the adapter
    delegates straight to the library's leak-free raw-frame writer (Plan L2); this is
    **byte-for-byte equivalent** to the original raw heartbeat.
- **Leading hypothesis:** the ~30 s cadence matches a **cTrader keepalive / heartbeat-timeout**
  pattern (broker closing a connection it considers idle/unhealthy). It is **unknown whether this
  is pre-existing** broker behavior that the *old* code also exhibited but recovered from silently
  (only becoming the incident when recovery failed and gave up) **or** something new — the owner
  is unsure. **Status: UNRESOLVED, needs investigation.**
- **Diagnostic gaps blocking root-cause (fix these to finish the diagnosis):**
  1. `backend.log` has **no per-line wall-clock timestamps** (only a date at startup) — so the
     exact disconnect cadence and correlation with heartbeats can't be read from the log. The
     `Logger` should emit timestamps.
  2. The `cTrader-Layer` library does **not log socket close reasons**, so the broker's
     close cause isn't captured. Consider an adapter-level hook or lib instrumentation to surface
     why the socket closed.
- **Impact today:** data delivery has ~1 s gaps every ~30 s during reconnects; the feed **does**
  reconnect and re-subscribe automatically and never gives up, so this is a stability/noise issue,
  not a re-introduction of the original permanent-stall bug.

**Also fixed during this first live run (3 adapter bugs offline tests couldn't catch):**
(1) `CTraderTransportAdapter`'s default factory required the lib with a path one level too shallow
(`../../libs/...` instead of `../../../libs/...` — the adapter sits in `supervision/`) →
`Cannot find module`; (2) `dns.promises.lookup()` returns `{ address, family }` (an object), not a
string, so the resolved "IP" logged as `[object Object]`; (3) pre-resolving to an IP broke TLS
ServerName matching (see the corrected fallback-trap note above). A regression test now guards the
lib require path. Minor: the library prints cosmetic `Attempted to listen for unknown event type:
close/error` warnings — these are harmless (it still registers and fires those listeners).

## Round 2: runtime cTrader reconnect loop (2026-06-24) — Phases 1–4 implemented

The first live run's "reconnects every ~30s" behavior (above) was the opening symptom of a
**second-round operational cluster** — a set of *runtime* defects the offline supervision suite
could not see (they only manifest against the live broker). Plan
[`plans/feed-loop-stabilization.md`](../../plans/feed-loop-stabilization.md) drove the diagnosis and
fix. **All phases (1–5) are COMPLETE and LIVE-VALIDATED against `live.ctraderapi.com:5035`
(2026-06-24, 176 backend tests green).** The supervision tier (A→B) was confirmed **correct and
untouched** except one additive gate (below).

> **LIVE-VALIDATED ROOT CAUSE (2026-06-24) — a defect NOT in the original Loop-A–H list:** the
> persistent ~28s disconnect was a **DOUBLE-OPEN of the cTrader transport**.
> `FeedSupervisor._openAndHandshake` calls `transport.open()` (socket S1), then
> `CTraderSession.connect()` calls `this.connection.open()` *again* → a SECOND cTrader-Layer
> connection/socket (S2), orphaning S1 → **two live connections for one app/account** → cTrader's
> "at most one connection" rule kills the duplicate with a clean TLS FIN every ~28s, *regardless of
> traffic or heartbeat* (`ss` showed 2 ESTAB `:5035` conns from one pid). **Fix: `CTraderTransportAdapter.open()`
> is idempotent** (`_opened` guard) → exactly one connection. With one connection the raw heartbeat
> (Loop-A/F) was confirmed correct (server echoes it) and the 28s loop is gone. Live proof: 60s
> supervised run with EURUSD/GBPUSD/XAUUSD/USDJPY subscribed = 336 ticks / 0 disconnects; production
> `server.js` = no server-FIN kills, `0` connect-phase-deadline aborts, single connection.

The diagnosis named eight loops (A–H). Each fix targets the *structural* root the loop exposed, not
a line-level patch:

| Loop | Defect | Status |
|------|--------|--------|
| **Loop-A** | Clean server FIN during idle lulls (the ~30s broker close) | **FIXED (live-confirmed)** — was NOT the dominant cause (that was the double-open, above), but the keepalive WAS genuinely broken: the library `sendHeartbeat()`→`sendCommand()` attaches a `clientMsgId`, and cTrader ignores a one-way `ProtoHeartbeatEvent` carrying one. Now sent as a **raw clientMsgId-free frame** (`00000004 0833 1200`) written directly to the TLS socket via a scoped `tls.connect` capture; the server **echoes** it and the idle connection stays alive. |
| **Loop-B** | Connect-phase deadline aborts the handshake — **the structural root**. `restoreSubscriptions()` ran *inside* `connect()`, so a slow/failed restore blew the deadline and aborted the connect, which re-triggered restore, which re-aborted… | **FIXED** — `connect()` is now split into a FAST handshake (open → authenticate → `loadAllSymbols` → `startHeartbeat` → emit `'connected'`) and a **detached** post-connect restore via `_beginRestore()` / `_runRestore()`, exposed as `this.restorePromise` and via `'restoreStart'` / `'restoreComplete'` events. Restore can no longer trip the connect deadline. |
| **Loop-C** | `Symbol ID not found` during restore. | **Hardened** — Phase 3 defer-queue + lazy `refreshAllSymbols()`. **Corrected framing:** `loadAllSymbols()` repopulates the map every connect (merges, never clears), so the map is **not cold**; Loop-C is symbols that *don't resolve* (normalization/format mismatch), not an empty map. Unresolved symbols are deferred and retried once against the lazy refresh, then logged-once-and-skipped if still absent. Live confirmation of the actual failing symbols still wanted. |
| **Loop-D** | cTrader `errorCode` rejections swallowed — the library rejects `sendCommand` with the raw protobuf payload, so naive `err.message` logging printed `[object Object]` and the `errorCode`/`description` that explained the rejection were lost. | **FIXED** — `utils/Logger.js`'s new `describeError(err)` surfaces `errorCode`/`description`/`code`/`symbol` first at every catch site; new `utils/ctraderErrorCode.js` classifies codes (`ALREADY_SUBSCRIBED` = success, `RATE_LIMIT` = backoff+retry, `PERMANENT`/`UNKNOWN` = log-and-skip). **Live fix:** cTrader returns these codes **bare** (e.g. `ALREADY_SUBSCRIBED`, no `CH_` prefix); the classifier now strips a leading `CH_` so both forms match (previously the bare form fell through to PERMANENT and broke restore on reconnect re-subscribes). |
| **Loop-E** | Command timeouts / server throttle — the old serial-burst restore exceeded cTrader's concurrent-request limits (345 command timeouts in the incident). | **FIXED** — bounded-concurrency throttled restore (`_runBounded`), inter-request spacing, per-command budget (`_sendWithBudget`), and rate-limit retry (`_sendWithRetry`). Tuning centralized in `config.js` (`restoreConcurrency`, `restoreSpacingMs`, `restoreCommandTimeoutMs`, `restoreMaxRetries`). |
| **Loop-F** | Heartbeat commandMap leak — heartbeats echoed as push events are never extracted from `#openCommands`. | **FIXED** — the raw-heartbeat frame (Loop-A) is written directly to the socket, bypassing the library command map entirely, so no heartbeat promise is ever tracked/leaked. The library source stays read-only (the seam is a scoped `tls.connect` wrap). |
| **Loop-G** | Cold `symbolLoader` rebuilt every connect — every reconnect re-fetched ~60 `SymbolByIdReq` (the amplifier of Loop-E). | **FIXED** — `symbolLoader` is now **persistent** across reconnects (created once, `setConnection()` re-binds on reconnect); `symbolInfoCache` survives, so restore resolves symbolIds against an already-warm map. |
| **Loop-H** | No timestamps + swallowed errors — the log carried no per-line wall-clock time, making per-cycle timing impossible to reconstruct. | **FIXED** — every log line is now prefixed with an ISO-8601 ms timestamp (`utils/Logger.js`); connect-cycle timing markers (`connect-start`, `connect-step open/authenticate/loadAllSymbols`, `connect-end`, `restore-start`, `restore-end`) reconstruct the full handshake timeline from `backend.log` alone. |

### Supervision tier: confirmed correct, one additive gate

The tier built in Round 1 (A→B) was **re-confirmed correct** for this cluster — the runtime loop was
*not* a supervision-tier defect. The single supervision change is **additive** and only concerns the
restore window introduced by Loop-B's decoupling:

- `FeedSupervisor._wireFeed` now sets an additive `handle.restoreActive` flag from the feed's
  `'restoreStart'` / `'restoreComplete'` events.
- `_reactToHealth` **holds** (transitions to DEGRADED + logs, no force-reconnect) on a DEGRADED
  health status **while `restoreActive` is true** — because `'connected'` now emits *before* data
  flows, heartbeats are fresh but no data ticks arrive during restore, which would otherwise look
  like a dead-but-alive transport and re-trip the loop. **STALE (both clocks stale = genuinely dead)
  still force-reconnects even during restore.** When restore completes the flag flips and normal
  DEGRADED force-reconnect resumes.

See [`plans/feed-loop-stabilization.md`](../../plans/feed-loop-stabilization.md) for the full
diagnosis, phase breakdown, and decision log.

---

## TradingView feed — latent-defect audit (2026-06-24)

TradingView is a **critical live alternative data source** (parallel WebSocket feed via the
`tradingview-ws` library; **not** under `FeedSupervisor` — different connection model). A live probe
(4 min, unauthenticated) confirmed it is **healthy**: connected @745ms, first data @1032ms, 0
disconnects, 764 ticks / 393 M1 bars. It self-recovers via `ReconnectionManager` (never gives up;
plateaus at 15s backoff) + `HealthMonitor` (5-min staleness). **Limitation:** `tradingview-ws@0.0.3`
emits no close/error events, so staleness is the only dead-connection detector.

Six latent defects were identified (none firing at low load); **D1/D2/D4 are fixed, D3/D5/D6 deferred:**

| Tag | Defect | Status |
|-----|--------|--------|
| **D1** | `candle` listener spike → `MaxListenersExceededWarning` under concurrent multi-symbol/multi-client TV load (`RequestCoordinator.handleTradingViewRequest` added a listener per request). | **FIXED** — listener/timeout/subscribe are now **deduped per symbol** (one in-flight per symbol); data + `onComplete` fan out to all waiting clients; `TradingViewSession.setMaxListeners(50)` as a belt-and-suspenders guard. |
| **D2** | No connect-phase deadline — a hung `tradingview-ws` `connect()` (DNS/network) hung the backend forever. | **FIXED** — `connect()` now races against `config.tvConnectTimeoutMs` (default 15s); on expiry it rejects → `handleDisconnect` → `scheduleReconnect`. Timer cleared in `finally`. |
| **D4** | `subscribeToSymbol` threw "Not connected" once per queued request during a disconnect window (882× error storm in the incident). | **FIXED** — new `TradingViewSession.isConnected()`; `handleTradingViewRequest` skips the subscribe call when disconnected (single warn) and lets `fetchTimeout` clean up the listener + notify the client. |
| **D3** | TV is not supervised — invisible to `GET /health`, no DEGRADED detection, no state machine (vs cTrader's `FeedSupervisor`). | **Deferred** — moving TV under the supervisor is a larger architectural change; left for a dedicated plan. |
| **D5** | 5-min staleness threshold is generous; silent data starvation takes 5 min to detect. | **Deferred** — acceptable for candle-based feeds; revisit if silent stalls are observed. |
| **D6** | `tradingview-ws@0.0.3` is an early library; no close/error events, no configurable host. | **Deferred** — info-level; library swap is a separate decision. |

Tests: `npx vitest run` = **185 passed / 5 skipped, 0 regressions** (+9 new: TV request-dedup,
TV connect-deadline, TV subscribe-while-disconnected). Regression re-probe (2 min) confirmed TV
still connects + serves data after the fixes.
