# Bug: Frontend Shows Stale Data After Hours (Requires Restart)

**Status:** Root cause identified. **Defect #1 (the live bug) FIXED 2026-06-22** — see "Fix applied" below. cTrader-path defects (#2–#5) remain latent (no price-stall observed yet).
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
