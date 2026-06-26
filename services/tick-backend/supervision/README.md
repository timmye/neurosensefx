# Feed Supervision Tier

The supervision tier is a control layer that owns the connection lifecycle of a data feed (currently the cTrader feed) and recovers it from stale-data and offline conditions. It sits **above** the existing session classes (`CTraderSession`, `TradingViewSession`) and the raw transport library, replacing the per-session self-reconnect that lived inside `ReconnectionManager`.

## Overview

Before this tier existed, each session embedded its own recovery: `ReconnectionManager` backoff plus `HealthMonitor` staleness detection, both wired directly into the session. That design had several failure modes that surfaced during the stale-data-after-hours incident:

- **A permanent give-up.** Recovery logic could reach a terminal "dead" state and stop retrying, so a transiently-broken feed (broker restart, DNS blip) would never come back without a manual restart.
- **No deadline on the connect/handshake phase.** A feed whose socket opened but whose auth/subscribe reply never arrived (or whose `open()` hung in a TLS fallback) would stall the connect forever with nothing to force a retry.
- **Heartbeats masked partial stalls.** `HealthMonitor` fed a single `recordTick()` from both data ticks and heartbeats, so a transport that was alive (heartbeats flowing) but delivering no data looked healthy.
- **Never-connected feeds were undetectable.** `HealthMonitor` staleness required a *prior* tick, so a feed that connected but never delivered data never tripped.
- **Recovery was untestable offline.** Real timers, real sockets, and real credentials were baked into the session, so recovery paths could not be exercised deterministically in CI.

The supervision tier was added to centralize and harden recovery against exactly these defects, and to make it deterministically testable.

## Architecture

```
                FeedSupervisor  (lifecycle owner; one FeedHandle per feed)
                       │
        ┌──────────────┼───────────────┬──────────────────┐
        │              │               │                  │
   FeedState      RetryPolicy     HealthSensor       (clock)
   (state machine) (delay calc)   (data vs liveness)  (injected)
        │
        ▼
   transportFactory() ──▶ CTraderTransportAdapter ──▶ cTrader-Layer library ──▶ TLS socket
                              │
                         feed (CTraderSession)
```

The supervisor does **not** know about cTrader, protobuf, symbols, or auth. It speaks only the three small contracts defined in `interfaces.js` (`Transport`, `Feed`, `Clock`) and drives any feed that implements them. The cTrader specifics live entirely in `CTraderTransportAdapter` (the Transport) and `CTraderSession` (the Feed, run in supervised mode).

### Ports and adapters (the interfaces pattern)

JavaScript has no interfaces, so `interfaces.js` records the contracts as JSDoc typedefs. This is deliberate: it lets the supervisor and the test fakes (`FakeTransport`, `FakeFeed`, `FakeClock`) be built against a stable spec, and it keeps the supervisor's only dependencies on the outside world to three narrow, mockable ports:

- **Transport** — the raw connection primitive (`open`/`close`/`sendCommand`/`sendHeartbeat`, emits `close`/`error` and data frames). It knows nothing about auth, symbols, or subscriptions.
- **Feed** — the domain handshake on top of a Transport (`connect(transport)`, `disconnect`, `restoreSubscriptions`, subscription methods, emits `connected`/`disconnected`/`tick`/`heartbeat`).
- **Clock** — `setTimeout`/`clearTimeout`/`now`, so all scheduling is injectable.

This is why `CTraderSession` sets `session.supervised = true` in `server.js`: in supervised mode the session becomes a dumb I/O worker that does **not** self-reconnect or self-track staleness — the supervisor recovers it.

## Design Decisions

### No terminal DEAD state

`FeedState` has six states (`DISCONNECTED`, `CONNECTING`, `HANDSHAKING`, `CONNECTED`, `DEGRADED`, `BACKOFF`) and intentionally **no DEAD state**. Every state has a legal path back to `CONNECTING` (the no-dead-end proof is documented inline in `FeedState.js`). "Give up forever" was the original bug; the machine is constructed so it cannot express it. `transition()` rejects anything not in `LEGAL_TRANSITIONS`, so an illegal jump throws rather than silently corrupting lifecycle state.

### Connect-phase deadline (the hang-after-open fix)

`_attemptConnect` races the **whole** connect phase — `transport.open()` plus the feed handshake — against a single deadline (`connectTimeoutMs`, default 15s). This bounds both failure modes that previously hung forever:

- a hanging `open()` (the cTrader-Layer library's WSL2 TLS fallback trap, where `tls.connect(hostname)` can hang on a DNS throw), and
- a hung handshake (auth/subscribe reply never arrives).

On deadline the transport is force-closed and the race rejects → `_onConnectFailure` → `BACKOFF` → re-arm. (Since Plan L1 the library's own `open()` rejects on failure/timeout rather than hanging, so there is no pending-open leak.)

The cTrader specifics that make the deadline effective now live in the **cTrader-Layer library** (Plan L1–L4), not the adapter: `open()` rejects on failure/timeout (L1); `sendHeartbeat()` writes a leak-free raw `ProtoHeartbeatEvent` frame with no `clientMsgId` (L2 — cTrader ignores heartbeats that carry one and closes idle connections); `close()` rejects all in-flight commands (L3); and every command has a per-RPC TTL that force-closes the transport on timeout (L4). `CTraderTransportAdapter` is now a **thin pass-through** — `sendCommand`/`sendHeartbeat` delegate straight to the library, plus an idempotent `open()` guard (the supervisor opens the transport and then `CTraderSession.connect()` calls `open()` again on the same transport — without the guard that created a second live cTrader connection, which the broker kills after ~28s, its "at most one connection" rule) and the `on`/`removeListener`/`removeAllListeners` pass-throughs so the supervisor still observes the library's `close`/`error`.

### Data-ness vs liveness (the partial-stall fix)

`HealthSensor` replaces the single-clock `HealthMonitor` for the supervised feed. It tracks data ticks and heartbeats **separately** and reports:

- `HEALTHY` — recent data ticks,
- `DEGRADED` — data ticks stale BUT heartbeats still fresh (transport alive, not delivering data),
- `STALE` — both stale, OR data never received.

This split is what makes a partially-alive transport self-heal: `DEGRADED` and `STALE` both force a reconnect from the supervisor (`_reactToHealth`). The sensor also treats never-received-data as stale: `start()` seeds `lastDataTick`/`lastHeartbeat` to the baseline so a feed that connects but never delivers data trips `STALE` once `dataStaleMs` elapses.

> Note: `HealthMonitor` (the old single-clock monitor) is **still used by the unsupervised TradingView session**. The supervised cTrader feed uses `HealthSensor`. Do not confuse the two.

False `DEGRADED` during illiquid/rollover windows is prevented by (a) a generous `dataStaleMs` and (b) the upstream feed fix that keeps real trendbar ticks feeding `recordDataTick()` even when spot bid/ask go null. The sensor itself does not distinguish "broker is quiet" from "feed is broken" — that distinction is the feed tier's job.

### Never-terminating retry

`RetryPolicy` is a **stateless** exponential-backoff calculator: the supervisor tracks the attempt count and asks `delayFor(attempts)`. It never returns a terminal — every attempt gets a finite, capped (`maxDelay`), jittered delay — so a transiently-failed feed always gets another retry. `isPlateau(attempts)` tells the supervisor when the un-jittered base delay has flattened against `maxDelay`, so it can emit a periodic "still reconnecting — attempt N" escalation log and make a genuinely-broken feed (e.g. wrong credentials) detectable instead of silently churning. The jitter RNG is injectable so recovery tests can pin it.

### DEGRADED-during-restore gate

Because `'connected'` now emits from the fast handshake **before** the post-connect subscription restore flows data, a freshly-connected feed legitimately looks `DEGRADED` (heartbeats fresh, no data ticks yet) during the restore window. Without a gate, that would re-trip the reconnect loop immediately after every connect. The supervisor holds (transitions to `DEGRADED` state, logs, no force-reconnect) while `restoreActive` is true, set from the feed's `'restoreStart'`/`'restoreComplete'` events. `STALE` (both clocks stale = genuinely dead) still force-reconnects even during restore. The gate is additionally cleared on `disconnected` and `stop()`, so a mid-restore disconnect or event reordering cannot leave it latched open and silently disable recovery.

### Deterministic, offline-testable recovery

Everything is scheduled through the injected `clock`, so recovery is fully exercisable in CI with `FakeClock` + `FakeTransport` + `FakeFeed` — no real timers, sockets, credentials, PostgreSQL, or Redis. The reconnect timer returns the kick's promise so an awaiting fake clock transitively awaits the full reconnect chain, giving deterministic test progress. `RealClock` (delegating to the global timer APIs) is what gets injected in production.

## Invariants

- **No DEAD state, ever.** Every feed handle always has a path back to `CONNECTING`; the machine cannot express "give up forever".
- **One loss, one reconnect.** `_forceReconnect` marks the handle not-connected *before* closing, so the synchronous `close` event from `_forceClose` is a no-op in `_onTransportClosed` — `_handleLoss` runs exactly once and does not double-count attempts or arm a duplicate reconnect timer.
- **All timers cleared on stop.** `stop()` / `reset()` clear the deadline, reconnect, and health-poll timers and force-close the transport; a stopped or reset handle has no armed retry.
- **Per-feed isolation.** Each registered feed has its own `FeedState`, `RetryPolicy`, `HealthSensor`, attempt counter, and timers; one feed's failure cannot block another's recovery.
- **Observable state is a pure snapshot.** `observableState()` reads current state/attempts/since for `/health`; it performs no I/O and triggers no transitions.
