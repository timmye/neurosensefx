# Feed Recovery & Supervision (A → B)

## Overview

Implementation plan for the recommendation in
`docs/architecture/feed-recovery-supervision-review.md` (path **A → B**), addressing the
incident in `docs/bugs/stale-data-after-hours.md`.

**Scope decision (2026-06-24).** This plan solves connection handling **at its core**, not
just the observed stall. The "keep changes small / no big rewrites" stance from `CLAUDE.md`
is **explicitly relaxed for this work**: a correct, complete, testable connection/recovery
tier is the priority, and surface area is no longer the governing constraint. Defects that
were previously deferred as "out of tier" — the **null-tick clobber** (#3) and the
**hung-command / `#openCommands` leak** (#4) — are pulled **into scope** because leaving them
in place means a "recovered" feed can still hang silently (the next failure mode the incident
will throw). Only the TradingView listener leak (#6) remains deferred; the domain services,
frontend, library, and backtester stay untouched.

Two phases:
- **Phase A — Stop the bleeding (patch):** targeted fixes so the system self-heals the
  *observed* stall (connect-failure → permanent give-up). Independently shippable; does not
  yet fix the deeper #3/#4 hang modes (those need the Phase B seam).
- **Phase B — Extract Supervisor + solve the cluster (cohesive + testable):** pull connection
  lifecycle out of the session god-objects into a `FeedSupervisor` with an explicit state
  machine and **injectable clock + transport**, so connect/reconnect/recovery is deterministic
  and unit-testable — *and* fix #2/#3/#4/#5 + the fallback trap at their source inside the
  feed/transport tier.

**North Star (definition of done):** after Phase B, all connect/reconnect/recovery behavior
is verifiable via `npx vitest run` with the backend **offline** — no live cTrader
credentials, no PostgreSQL, no Redis, no network, no overnight runs — **including the
hang-after-open and hung-command modes (#4)**. Live testing becomes a *smoke* test ("does it
really connect?"), never the *correctness* test ("does it recover?").

All items include testable acceptance criteria. No manual verification steps.

---

## Planning Context

### Decision Log

| Decision | Reasoning Chain |
|----------|-----------------|
| A before B | A unblocks immediately and is not wasted — B supersedes A's code, but A stops the stall during the B window |
| Characterization tests before extraction (B0) | Extraction of auth/symbol-load/subscription-restore is the real risk → capture current behavior first, then move code behind it → provably no regression |
| Backend transport adapter over patching `libs/cTrader-Layer` | cTrader-Layer is a separate repo (likely upstream `@reiryoku/ctrader-layer`) → resolve DNS→IP in our adapter and bypass the library's TLS fallback → avoid editing/forking an external repo (fixes the fallback trap on our side) |
| Behavioral tests replace source-text assertions | `backend-reliability.test.js` greps source text (`toContain`) → false confidence is *why* the bug survived → new tests assert behavior with fakes |
| Domain layer untouched | MarketProfile/TWAP/DataRouter/RequestCoordinator/SubscriptionManager are working and large → keep their interfaces; only the connection/recovery tier changes |
| No terminal DEAD state in the supervisor | "Give up forever" is the bug → BACKOFF retries indefinitely with capped delay; reset-on-success; resettable on demand |
| No silent retry — escalation retained | Infinite retry is correct *for transient* failures, but a genuinely-broken feed (bad creds) must not churn invisibly → supervisor emits a periodic "still retrying after N attempts / M min" log + exposes climbing `attempts` on `/health`. Preserves the architecture-review §6.1 "never silent" property the give-up removal could lose |
| Defects #3 + #4 pulled into Phase B | A "recovered" feed can still hang: #3 (null tick clobber) stops the data-tick clock during illiquid windows → false staleness; #4 (hung `sendCommand`, no timeout, never cleaned on close) makes `connect()` hang indefinitely *after* the socket opens. Both are core to "does it recover?" → in scope, fixed inside the feed/transport tier (no library edit) |
| Handshake/connect-phase timeout in the state machine | The existing 10s timeout only wraps `connection.open()` (`CTraderSession.js:89`); `authenticate`/`loadAllSymbols`/`restoreSubscriptions` have none → `HANDSHAKING` needs its own stall → `BACKOFF` transition, or self-heal never fires for hang-after-open |
| Domain services + frontend + library stay untouched | `MarketProfile`/`TWAP`/`DataRouter`/`RequestCoordinator`/`SubscriptionManager`, `src/`, `libs/cTrader-Layer` are working/large/external → not edited. The cTrader tick-*extraction* path (defect #3) IS touched, but it lives in the feed tier being extracted, not in the domain services |
| Vitest (existing), no TypeScript | Matches `backend-reliability-fixes.md` precedent; backend is JS |

### Rejected Alternatives

| Alternative | Why Rejected |
|-------------|--------------|
| Full cohesive rework (path C) now | "No big rewrites" is no longer a hard constraint (see Scope decision), so C is *available*. Still rejected *as the starting move*: B — now expanded to absorb #2/#3/#4/#5 — achieves the core goal with a phased safety net (B0). If B's extraction shows the sessions are too entangled to extract cleanly, escalate to C rather than forcing a bad extraction. Reach C by growing from B |
| Patch only (path A) | Stops *this* stall but #3/#4 hang modes, silent/degraded detection, and testability all remain → A is a stopgap, not the North Star |
| Patch `CTraderSocket.ts` in the library | Separate/upstream repo → editing TS + rebuilding a dep we may not own; adapter avoids it |
| Add a process supervisor (pm2/nodemon) now | Dev-infra concern, orthogonal; does not make recovery logic testable; deferred |
| Rewrite the domain layer | Not implicated in the bug; high risk for no gain |
| Migrate to TypeScript | Out of scope; would touch every file |

### Constraints & Assumptions

**Technical**:
- Node.js backend, Vitest, no TypeScript.
- Both feeds (cTrader, TradingView) must remain functional throughout — incremental, backward-compatible changes.
- Frontend WebSocket protocol unchanged; the existing `reinit` message stays valid (supplemented by an endpoint).
- `libs/cTrader-Layer` consumed **as-is** (read-only dependency) — no edits to the library.
- Recovery tests must run with **no** live cTrader creds / PG / Redis / network.

**Organizational**:
- Targeted, phased changes (per CLAUDE.md: "small targeted fixes"). B is bounded to the connection/recovery tier, not a system rewrite.
- Each phase independently deployable.

### Known Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Breaking auth/symbol-load/subscription-restore during extraction (B4) | Medium | High (new outage) | B0 characterization tests must pass before *and* after extraction |
| State machine introduces new transition bugs | Medium | Medium | Small, explicit state surface + exhaustive B6 tests |
| Two recovery paths coexisting mid-B (old session path + new supervisor) | Medium | Low | Keep old path until B5 rewires, decommission in B7; never both driving one feed |
| TradingView path (currently more functional) regresses | Low-Medium | High | B0 covers TV; treat TV as the control feed |
| Fake transport diverges from real behavior | Low | Medium | B0 characterization tests run against real session internals (faked I/O only), anchoring the fakes |
| B0 safety net too thin to catch B4 regressions | Medium | High | cTrader is protobuf with a multi-step handshake — B0 must script the *full* frame sequence and assert subscription-*restore* specifically, not just the happy-path connect. If B0 can't be invested in to that depth, stop at A (architecture-review §9 non-negotiable) |
| Hang-after-open / hung-command (#4) still stalls despite A | High (this is the next incident) | High | Phase B adds a handshake/connect-phase timeout in `FeedState` + per-RPC TTL in the feed tier + reject-on-disconnect; B6 tests the "opens but auth never responds" and "command hangs" cases |

---

## Phase A — Stop the bleeding (patch)

Goal: the observed stall self-heals. Shippable on its own. Tests here are limited to what is
cheaply unit-testable (ReconnectionManager is near-pure); full recovery testability arrives
in Phase B.

### A1 [defect #5] ReconnectionManager must never permanently give up

`services/tick-backend/utils/ReconnectionManager.js:22-26` — `scheduleReconnect` becomes a
silent no-op once `reconnectAttempts >= maxAttempts`. Change: after `maxAttempts`, keep
scheduling at `maxDelay` (capped, jittered) **indefinitely**; preserve `reset()`-on-success.
Expose a public `reset()` (counter + delay) for use by reconnect-on-demand.

Also fix timer hygiene (pre-existing, amplified by infinite retry): `scheduleReconnect` must
`clearTimeout(this.reconnectTimeout)` before setting a new one, so a stale-event + error-event
firing near-simultaneously cannot spawn two concurrent reconnect chains. And emit a periodic
**escalation log** ("still reconnecting — attempt N over M min") so a genuinely-broken feed
(wrong creds) is detectable in `backend.log`, not silent — preserves the architecture-review
"never silent" property once give-up is removed.

**Acceptance (unit, `utils/ReconnectionManager`):**
- After `maxAttempts + 5` consecutive failures, `scheduleReconnect` still schedules another
  attempt (timer set), and the attempt counter does not gate further retries.
- After a successful `reconnectFn`, `reconnectAttempts` resets to 0 and delay returns to
  `initialDelay`.
- `reset()` zeroes the counter/delay and cancels any pending timer.
- Two rapid `scheduleReconnect` calls produce exactly **one** pending timer (no leak/duplex).
- Implemented with **fake timers** (`vi.useFakeTimers`); no real delay, no I/O.

### A2 `reconnect()` must reset the attempt counter before connecting

`CTraderSession.reconnect()` (`CTraderSession.js:586-593`) currently calls `cancelReconnect()`
(clears timer, **not** the counter) then `connect()`. So a post-give-up reconnect gets exactly
one shot. Change: call `this.reconnection.reset()` before `disconnect(false)` + `connect()`.
Apply the same to `TradingViewSession.reconnect()`.

**Acceptance (unit):**
- `reconnect()` invoked when `reconnectAttempts >= maxAttempts` results in
  `reconnectAttempts === 0` at the moment `connect()` runs.
- A failed `reconnect()` re-arms a full retry schedule (not a single attempt).

### A3 `handleReinit` becomes a true reset

`WebSocketServer.handleReinit` (`WebSocketServer.js:428-443`) calls `reconnect()`; with A2 it
now resets correctly. No structural change, just verified behavior. (A real endpoint replaces
this in B5; keep the message path working for now.)

**Acceptance (unit):**
- `handleReinit({source:'ctrader'})` calls `cTraderSession.reconnect()` and, given A2,
  resets the counter — asserted by spying on `reconnection.reset`.

### A4 Behavioral test for the give-up fix (establishes the testing pattern)

Add `__tests__/reconnectionManager.test.js` (behavioral, fake timers) covering A1+A2. This
both validates A and seeds the testing discipline B relies on.

**Acceptance:** suite green, runs offline, exercises the "fail past maxAttempts → still
retrying" and "reset → fresh schedule" paths.

**Phase A exit gate:** `npx vitest run` green; the give-up deadlock is gone at the unit
level. (Live confirmation that a real stall now self-heals is a one-time smoke check after
deploy — not a test gate.)

---

## Phase B — Extract Supervisor (cohesive + testable)

Goal (North Star): recovery fully unit-testable offline, *and* the full defect cluster
(#2/#3/#4/#5 + fallback) fixed at its source. Sequenced so the riskiest change (B4 extraction)
happens behind a safety net (B0) and the testability seam (B2) lands before the supervisor
(B3) and the final suite (B6).

### B0 [risk control] Characterization tests of current connect/reconnect behavior

Capture today's behavior so extraction (B4) is provably non-regressing. Use the **real**
session modules but with **faked I/O**: mock `CTraderConnection` (libs) / `tradingview-ws`
connect to scripted frame sequences; fake the clock.

**Effort note — this is the load-bearing, non-trivial step.** TradingView is easy (the
package emits candle frames). cTrader is hard: it is protobuf with a multi-step handshake
(app-auth → account-auth → symbol list → spot/bar subscription), and the faked
`CTraderConnection` must script that **full** frame sequence to drive `authenticate` /
`loadAllSymbols` / `restoreSubscriptions` for real. A shallow happy-path-only net will NOT
catch extraction regressions in auth/subscribe. If this depth cannot be invested in, stop at A
(architecture-review §9 non-negotiable).

**Acceptance (characterization, faked I/O — no live network):**
- Successful path: connect → auth → `loadAllSymbols` → `restoreSubscriptions` → emits
  `connected` with the symbol list; `reconnection.reset()` called.
- Disconnect → reconnect restores prior subscriptions — assert the **restored subscription
  set equals the pre-disconnect set symbol-for-symbol** (this is the logic moving in B4; it
  must be covered, not just "subs preserved" on the happy path).
- Mid-handshake failure (socket opens, auth frame never arrives) — capture current behavior
  (today: hangs) as the baseline the #4 fix in B4 must improve on.
- `reinit` resets and re-connects.
- TradingView equivalent path captured as the control.
- These tests are the anchor that legitimates the fakes in B2/B6.

### B1 Define the abstractions (new, small, pure modules under `services/tick-backend/supervision/`)

- `RetryPolicy` — pure function `(attempts) => delayMs`; never returns a terminal; capped +
  jittered. (Replaces the give-up logic.) Pairs with a supervisor-level **escalation hook**:
  the supervisor logs "still retrying — attempt N over M min" on each `maxDelay`-plateau retry.
- `FeedState` — explicit state machine: `DISCONNECTED → CONNECTING → HANDSHAKING →
  CONNECTED → DEGRADED → BACKOFF → CONNECTING …` with legal-transition validation. **No
  terminal DEAD state.** **`HANDSHAKING` has a stall timeout** → `BACKOFF` (this is the fix
  for hang-after-open / defect #4: today `authenticate`/`loadAllSymbols`/`restoreSubscriptions`
  have no timeout and can hang the whole connect forever).
- `HealthSensor` — `recordDataTick()` / `recordHeartbeat()` tracked separately; emits
  `stale`/`resumed`; treats never-received-data as stale (fixes defect #2 at the source).
  **Threshold must tolerate illiquid windows** — see defect #3 interaction in B4/B6: until #3
  is fixed, valid trendbar ticks can be clobbered to null and stop the data-tick clock, so a
  naive threshold produces false `DEGRADED` during rollover/thin liquidity.
- `Transport` / `Feed` interfaces — documented contracts (open/send/close + events; start/
  stop + domain-event + health-signal emission).

**Acceptance (unit, each module isolated):**
- `RetryPolicy`: delay sequence matches expected curve; never terminates; resets.
- `FeedState`: only legal transitions allowed; illegal transitions throw/log; every state
  has a path back to `CONNECTING`; **`HANDSHAKING` held past its timeout transitions to
  `BACKOFF` and re-arms a connect**.
- `HealthSensor`: data-tick staleness vs heartbeat-only both detected; never-received →
  stale within threshold.

### B2 Test doubles: `FakeTransport` + `FakeClock`

`__tests__/fakes/FakeTransport.js` (scriptable: fail-open N× then succeed; emit frames on
cue; open-then-stall — never emit the auth frame; drop connection) and
`__tests__/fakes/FakeClock.js` (advance time; fire pending timers). This is the testing seam
that makes the North Star possible.

**Clock contract (nail this here or B3 won't be deterministic).** The real code schedules via
`setTimeout`, which is bound to the event loop and not swappable. So `FeedSupervisor` must
schedule **through the injected clock** (`clock.setTimeout(fn, ms)`), and `FakeClock` must
**own timer scheduling** — it holds the pending timers and fires them when time is advanced,
not merely advance a counter. `RealClock` delegates to global `setTimeout`.

**Acceptance:** used by B3 and B6; zero real I/O; deterministic; can simulate "open succeeds,
auth frame never arrives" for the #4 hang test.

### B3 `FeedSupervisor`

`supervision/FeedSupervisor.js` — owns N `FeedHandle`s (`{ name, feed, transportFactory,
state, retryPolicy, healthSensor }`); drives the state machine; applies `RetryPolicy` using
the **injected clock**; observes `HealthSensor`; emits `ObservableState { feed, state,
since, attempts }`; exposes `start()`, `stop()`, `reset(feed)`, `resetAll()`. **Applies a
connect-phase deadline** (`CONNECTING`/`HANDSHAKING` held too long → `BACKOFF`) so a feed
that opens but never handshakes cannot stall the supervisor — the fix for hang-after-open
(#4) at the supervision layer.

**Acceptance (unit, FakeTransport + FakeClock):**
- "Fail to open 20× then succeed → feed reaches `CONNECTED` within expected (faked) time;
  `attempts` resets on success."
- "`reset(feed)` returns a feed in `BACKOFF` to `CONNECTING` regardless of prior attempts."
- "Per-feed isolation: feed A stuck in `BACKOFF` does not block feed B reaching `CONNECTED`."
- "`ObservableState` transitions are emitted and accurate."
- **"Open succeeds but the auth frame never arrives → supervisor times out of `HANDSHAKING`
  within the deadline and re-arms a connect (no permanent stall)."**

### B4 Adapter shims (the extraction — behind B0)

- `CTraderTransportAdapter` wraps `libs/cTrader-Layer` `CTraderConnection`; **performs
  DNS→IP resolution itself** (cache last-known-good IP) and connects to the IP, never
  invoking the library's hostname-fallback (**fixes the fallback trap** — the WSL2
  TLS-handshake hang — inside our code, no library edit).
- `CTraderFeed` / `TradingViewFeed` wrap the existing auth / symbol-load / subscribe /
  decode logic extracted out of `CTraderSession` / `TradingViewSession`, exposed behind the
  `Feed` interface. Two core fixes land here:
  - **[defect #4 — hung command]** Add a **per-RPC TTL** around each `sendCommand`-derived
    call (`authenticate` / `loadAllSymbols` / `getFullSymbolInfo` / `subscribeToX`); on
    expiry, reject the local promise and **force a connection close** to break the hang and
    re-arm the supervisor. **Stop routing heartbeats through the command map** (send raw
    heartbeat frames) so they stop leaking into `#openCommands` (~360/h). On disconnect,
    reject all locally-tracked pending RPCs. (The library's own `#openCommands` stays
    untouched — read-only — but our tier no longer awaits it unbounded.)
  - **[defect #3 — null tick clobber]** Only overwrite `tickData` when
    `processSpotEvent` returns non-null, so a null during illiquid/rollover windows does not
    clobber a valid trendbar tick, drop the emit, or skip `recordDataTick()`. (Otherwise the
    #2 HealthSensor fix would fire false `DEGRADED` exactly when the feed is merely quiet.)
- Sessions lose their embedded `ReconnectionManager` + `HealthMonitor`; lifecycle moves to
  the supervisor.

**Acceptance:**
- All B0 characterization tests pass **unchanged** after extraction (the safety guarantee),
  *except* the B0 mid-handshake-hang baseline case — which now improves (no longer hangs).
- Adapters conform to the `Transport`/`Feed` contracts (interface conformance tests).
- #4: a `sendCommand` whose reply never arrives rejects within the TTL and triggers a
  reconnect (no infinite await); heartbeat frames do not accumulate in any command map.
- #3: a spot event that yields null during a quiet window does not suppress a valid trendbar
  tick or the data-tick timestamp.

### B5 Rewire the composition root + real recovery surface

- `server.js`: construct transports + feeds + `FeedSupervisor`; **remove** the fire-once
  `session.connect()`; `supervisor.start()` owns lifecycle.
- `httpServer.js`: add `GET /health` (reads `ObservableState`) and dev-only
  `POST /admin/reconnect` (`{feed}` → `supervisor.reset(feed)`) — the real, multi-attempt
  recovery surface.
- `WebSocketServer.handleReinit` is **rewired** to call `supervisor.reset(feed)` (per source),
  not removed — the frontend's existing `reinit` message stays valid (guardrail). Only the
  old one-shot `session.reconnect()` *wiring inside it* is replaced.

**Acceptance (boot test, faked transport):**
- Boot reaches `CONNECTED` for both feeds via the supervisor.
- `POST /admin/reconnect {feed:'ctrader'}` drives `supervisor.reset('ctrader')` and the
  feed returns to `CONNECTING` then `CONNECTED`.
- A frontend `reinit {source:'ctrader'}` message still recovers the feed (via
  `supervisor.reset`), with no frontend change.

### B6 [NORTH STAR] Behavioral recovery suite

`__tests__/supervision/recovery.test.js` — with `FakeTransport` + `FakeClock`, assert:
1. Connect-failure burst (e.g. 20×) then recovery → `CONNECTED` (self-heal).
2. **Hang-after-open (#4):** transport opens but never emits the auth frame → supervisor
   times out of `HANDSHAKING` and retries → `CONNECTED` once frames resume (no permanent stall).
3. **Hung command (#4):** a `sendCommand` reply never arrives → rejects within TTL →
   reconnect (no infinite await).
4. Data stops while heartbeats continue → `DEGRADED` at threshold → forced reconnect →
   `CONNECTED`.
5. **Quiet-window false-staleness (#3 interaction):** spot events yielding null during an
   illiquid window do **not** trip `DEGRADED` (valid trendbar ticks still feed the data-tick
   clock). Threshold tuning validated here, not in production.
6. Never-received-data feed → detected stale → reconnect attempted.
7. `reset()`/`/admin/reconnect` recovers regardless of prior failures.
8. Subscriptions preserved across a reconnect.
9. Per-feed isolation.

**Acceptance (the goal):** suite is **green with the backend offline** — no cTrader creds,
no PG, no Redis, no network. Runs in CI in seconds.

### B7 Decommission

- Remove embedded `ReconnectionManager` + `HealthMonitor` from sessions (now in supervisor).
- Retire superseded source-text assertions in `backend-reliability.test.js` (relabel the few
  that remain as smoke, delete those the behavioral suite replaces).
- Remove the **old one-shot `session.reconnect()` wiring** from `handleReinit` (now
  `supervisor.reset` per B5). **The `reinit` message handler itself is retained** — only its
  internal one-shot recovery call is removed, honoring the "frontend protocol unchanged"
  guardrail.

**Acceptance:** no dead recovery code; full `npx vitest run` green; `grep` confirms no
remaining `Max reconnection attempts reached` give-up path; `handleReinit` still handles the
`reinit` message (delegating to the supervisor).

---

## Execution Order

```
Phase A (ship independently):
  A1 (ReconnectionManager never gives up) → A2 (reconnect resets counter) → A3 (reinit) → A4 (tests)

Phase B (after A is live):
  B0 (characterization safety net) ── must pass before B4 ──┐
  B1 (abstractions)  ┐                                     │
  B2 (fakes)         ┘── parallel after B1                 │
        ↓                                                  │
  B3 (FeedSupervisor, uses B2)                             │
        ↓                                                  │
  B4 (adapter/extraction, gated by B0) ◄───────────────────┘
        ↓
  B5 (rewire server.js + endpoints)
        ↓
  B6 (NORTH STAR behavioral suite)
        ↓
  B7 (decommission old paths)
```

Hard dependencies: B4 **blocked** until B0 green; B3/B6 **blocked** until B2; B7 **last**.

---

## What does NOT change (guardrail)

- Domain services (`MarketProfileService`, `TwapService`, `DataRouter`,
  `RequestCoordinator`, `SubscriptionManager`) — interfaces preserved. (The cTrader
  tick-*extraction* path that defect #3 lives in is part of the feed tier being extracted in
  B4, not a domain service.)
- Frontend (`src/`) and the WebSocket client protocol — unchanged; the `reinit` message stays
  valid (rewired server-side in B5). Optional health UI is a separate, later task.
- `libs/cTrader-Layer` — consumed read-only; not edited (the #4 fix wraps `sendCommand` in
  our feed tier and stops routing heartbeats through its command map; it does not patch the
  library).
- Backtester — untouched.
- **Defect #6 (TradingView `candle` listener leak in `RequestCoordinator`)** — deferred;
  separate concern, not part of the connection/recovery tier. Track separately.

## Files touched

**Phase A:** `utils/ReconnectionManager.js`, `CTraderSession.js` (reconnect),
`TradingViewSession.js` (reconnect), `WebSocketServer.js` (handleReinit verify), new
`__tests__/reconnectionManager.test.js`.

**Phase B (new):** `supervision/{RetryPolicy,FeedState,HealthSensor,FeedSupervisor,
CTraderTransportAdapter,CTraderFeed,TradingViewFeed}.js`; `__tests__/{fakes/{FakeTransport,
FakeClock}.js, supervision/recovery.test.js, characterization/*.test.js}`.
**Phase B (edited):** `CTraderSession.js`, `TradingViewSession.js`, `server.js`,
`httpServer.js`, `WebSocketServer.js` (handleReinit rewire), `CTraderEventHandler.js`
(defect #3 null-tick guard) and/or the feed's decode wiring,
`__tests__/backend-reliability.test.js`. The cTrader command/heartbeat path is rewired in
`CTraderFeed` (defect #4) — the library itself is not edited.

## Docs to update on completion

- `docs/bugs/stale-data-after-hours.md` — mark defects #2/#3/#4/#5 + the fallback trap
  resolved by B; note recovery now unit-tested (including hang-after-open / hung-command).
- `docs/architecture/feed-recovery-supervision-review.md` — record path A→B executed (with
  #3/#4 pulled into scope); link this plan.
- `services/tick-backend/CLAUDE.md` + `services/tick-backend/__tests__/CLAUDE.md` — index
  the new `supervision/` tier and recovery suite.
- `plans/CLAUDE.md` — add this plan.

## Summary

Phase A stops the observed stall with targeted fixes and seeds behavioral testing. Phase B
extracts a `FeedSupervisor` tier with an explicit state machine and injectable clock/transport,
**and solves the full defect cluster at its source** — #2 (blind watchdog), #3 (null tick
clobber), #4 (hung command / `#openCommands` leak + handshake-hang), #5 (give-up), and the
fallback trap — ending in a recovery suite that proves connect/reconnect/recovery **offline**,
including the hang-after-open mode the incident will throw next. The high-risk step (B4
extraction) is gated behind characterization tests (B0); the working domain services,
frontend, backtester, and the external cTrader library are never touched.
