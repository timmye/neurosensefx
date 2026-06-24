# Architecture Review: Feed Connection, Recovery & Supervision

**Status:** Architecture review + redesign proposal. Complements (does not replace)
`docs/bugs/stale-data-after-hours.md`, which is the incident/root-cause doc.
**Update (2026-06-24): EXECUTED.** The recommended path **A → B was executed** via
`plans/feed-recovery-supervision.md`. Per the plan's scope decision, defects **#3 and #4
were pulled into scope** (not deferred to Phase 3) and fixed at the source. The supervisor
tier now exists (`services/tick-backend/supervision/`), the **North Star — offline-testable
recovery — is met** (`npx vitest run`, 149 tests green, including hang-after-open and
hung-command), and the **§9 non-negotiable was honored**: characterization tests (B0) were
written *before* any code moved, scripting the full cTrader protobuf handshake and asserting
subscription restore symbol-for-symbol. See the "Update (2026-06-24): executed" outcome note
at the bottom of this doc. The analysis below is preserved unchanged as the rationale.

**Update (2026-06-24, round 2): supervision tier CONFIRMED CORRECT.** The first live run exposed a
*runtime* cTrader reconnect loop that the offline supervision suite could not see. Root cause was a
**second-round operational cluster** (named Loop-A–H), **not** a supervision-tier defect — the tier
was re-confirmed correct and is **unchanged save one additive gate**: `FeedSupervisor._wireFeed` now
sets `handle.restoreActive` from the feed's `'restoreStart'`/`'restoreComplete'` events, and
`_reactToHealth` HOLDS (no force-reconnect) on DEGRADED during restore (STALE still reconnects).
The loop was fixed by decoupling `restoreSubscriptions()` from `connect()`, persisting
`symbolLoader`, and adding a throttled/error-aware restore — see
[`plans/feed-loop-stabilization.md`](../../plans/feed-loop-stabilization.md) (Phases 1–4 implemented
and offline-tested, 168 tests green; Phase 5 heartbeat commandMap leak data-gated/pending).
**Date:** 2026-06-23
**Area:** `services/tick-backend/` + `libs/cTrader-Layer/`
**Trigger:** The 2026-06-23 overnight stall exposed that the *individual* defects
documented previously are symptoms of a **missing architectural tier**. This doc steps
back from line-level bugs to the design of connection lifecycle, recovery, and supervision.

---

## 1. How this doc differs from the incident doc

The incident doc answers *"which lines are broken?"* This doc answers three questions the
incident doc did not:

1. **Are these inherent architectural issues** (not just bugs)?
2. **Are we patching a broken system, or bad designs?**
3. **Is there an alternative architecture that is *testable*** — so "does it recover?" is a
   unit test, not an overnight run?

---

## 2. Current architecture (as-built)

### 2.0 Where the code lives (repo topology)

- `services/tick-backend/` — the **single backend app** (Node, `server.js`), ~25 JS files. Talks to two external feeds.
- **cTrader is split across two places:** orchestration in `CTraderSession.js`, and the
  low-level protobuf/socket code in `libs/cTrader-Layer/` — a **separate git repository**
  (own `.git`), packaged as `@reiryoku/ctrader-layer` and consumed as a local `file:`
  dependency; the backend imports its compiled `build/entry/node/main`. ~11 TS files. The
  TLS primary/fallback logic (`CTraderSocket.ts`) lives *here*, in the library — not in the
  backend. This split is part of why the failure is hard to trace (fallback bug in the
  library, give-up in the backend).
- **TradingView has no separate repo.** It's an npm package (`tradingview-ws` ^0.0.3) used
  directly inside `TradingViewSession.js`; that one wrapper file is the only TV code we own.
- **Middle tier** (feeds → frontend): `WebSocketServer`, `DataRouter`,
  `RequestCoordinator`, domain services (`MarketProfileService`, `TwapService`),
  `SubscriptionManager` — all in `services/tick-backend/`. Working; unaffected.
- **Frontend:** `src/` (Svelte) — consumes data and can send a `reinit` message; not
  implicated in the feed bug.

**Blast radius (bug and redesign):** ~6 files in `services/tick-backend/`
(`CTraderSession`, `TradingViewSession`, `utils/ReconnectionManager`, `HealthMonitor`,
`WebSocketServer.handleReinit`, `server.js`) + the `CTraderSocket.ts` inside
`libs/cTrader-Layer/`. Domain services, frontend, and backtester are **not** implicated.

**Redesign implication:** because `libs/cTrader-Layer/` is a separate (likely upstream)
repo, the DNS/fallback fix is best done in a **backend transport adapter we own** (resolve
to IP ourselves; never hand the hostname to the library's fallback) rather than patching the
external library. This keeps the redesign within `services/tick-backend/`, consuming the
library as-is.

### 2.1 Wiring

### 2.1 Wiring

`server.js` boots the system:

- `new CTraderSession()` and `new TradingViewSession()` are constructed (`server.js:26-27`).
- Each gets a single **fire-once** `session.connect()` (`server.js:90`, `:97`). On failure
  the catch logs *"Continue running - graceful degradation"* (`server.js:93,100`) and
  **assumes the session will heal itself**.
- `server.js` holds references to the sessions but **never monitors or restarts them**.
- `uncaughtException → process.exit(1)` (`server.js:43-48`) with a comment asserting *"the
  process manager (pm2/Docker/run.sh) will restart."* **That assumption is false in dev** —
  see `docs/dev-lifecycle-modernization.md`: there is no process manager in dev, so
  `process.exit` kills the backend permanently.

### 2.2 Each session self-manages its own recovery

`CTraderSession` embeds its own `ReconnectionManager` and `HealthMonitor`
(`CTraderSession.js:36-37`) and drives its own lifecycle:

```
connect() → CTraderConnection (libs/cTrader-Layer) → CTraderSocket → tls.connect(:5035)
on failure → handleDisconnect → ReconnectionManager → (20 attempts) → SILENT GIVE UP
```

`TradingViewSession` uses the **same** `ReconnectionManager` (class docstring).

### 2.3 The one external recovery surface — and why it's crippled

`WebSocketServer.handleReinit(ws,{source})` (`WebSocketServer.js:428-443`) calls
`cTraderSession.reconnect()`. It is triggered by a **frontend** `reinit` message (manual).
But `reconnect()` (`CTraderSession.js:586-593`) is `cancelReconnect() → disconnect(false) →
connect()`. `cancelReconnect` clears the *timer*, not the *attempt counter*; the counter is
only reset on a *successful* connect (`CTraderSession.js:114`). So after a 20-failure
give-up, **reinit gets exactly one connect attempt**; if it fails, `handleDisconnect →
scheduleReconnect` is a no-op (counter still ≥ 20) and the feed is silently dead again.

### 2.4 As-built diagram

```
┌──────────────────────────────────────────────────────────────────┐
│ server.js (boot)                                                  │
│   new CTraderSession()  ── session.connect()  [FIRE-ONCE]          │
│   new TradingViewSession() ─ tradingViewSession.connect()         │
│   new WebSocketServer(http, session, tvSession, ...)              │
│   uncaughtException → process.exit  ⚠ comment assumes a process   │
│                                       manager restarts (FALSE dev)│
└──────────────────────────────────────────────────────────────────┘
        │ holds references; NEVER observes / restarts / health-checks them
        ▼
┌──────────────────────────────────────────────────────────────────┐
│ CTraderSession / TradingViewSession  (self-manage their lifecycle) │
│   connect() → CTraderConnection (libs) → CTraderSocket → tls :5035 │
│   on failure: handleDisconnect → ReconnectionManager              │
│   ReconnectionManager: 20 attempts → SILENT GIVE UP (no event)    │
│   HealthMonitor: staleness — but blind to never-connected feeds   │
│                                                                    │
│   ⚠ Recovery logic lives INSIDE the component that fails.          │
│   ⚠ Nothing outside this box can tell the feed is dead.            │
└──────────────────────────────────────────────────────────────────┘
        ▲
        │ the ONLY external trigger:
┌───────┴───────────────────────────────────────────────────────────┐
│ WebSocketServer.handleReinit  (:428)  ← frontend 'reinit' message │
│   → reconnect() = ONE connect() attempt                           │
│   ⚠ counter not reset → one-shot; a single failed attempt = dead  │
└───────────────────────────────────────────────────────────────────┘
```

**No supervision tier exists. No process-scope health/reconnect timer watches a session.
`WebSocketServer` does not even listen to cTrader `connected`/`disconnected` events.**

---

## 3. The core finding: a missing tier

The system has **I/O workers (sessions)** and a **server shell**, but **no supervisor**
between them. Every responsibility that a supervisor would own is instead embedded in the
session itself or absent entirely:

| Supervisor responsibility | Current state | Consequence |
|---|---|---|
| Own the retry/recovery policy | Embedded in each session (`ReconnectionManager`) | Recovery lives inside the failing component; can't observe or override it |
| Detect "feed is dead" | `HealthMonitor` inside session | Blind to never-connected; heartbeats mask partial stalls |
| Escalate / alert on unrecoverable | **Absent** | Give-up is a `log.error` + `return` — silent |
| Expose observable lifecycle state | **Absent** | UI/server cannot tell connected vs dead |
| Isolate feeds | **Absent** | One design flaw (shared counter) affects every feed |
| Reset/force recovery on demand | Half-built (`handleReinit`), crippled | One-shot; counter not reset |

This is why **"transient DNS blip → permanent stall requiring restart" is structurally
inevitable**, not a fluke: there is no component whose job is "notice a feed died and bring
it back." The session is allowed to give up, and nothing is watching.

---

## 4. Q1: Do we have inherent issues? — **Yes.**

Five architectural anti-patterns, each evidenced:

1. **Recovery embedded in the failing component (circular ownership).** The session that
   breaks is also responsible for healing itself, including deciding when to stop trying.
   (`CTraderSession.js` owns its own `ReconnectionManager`.)
2. **Silent-failure as the terminal state.** The worst outcome — permanent give-up — is a
   `log.error` + `return` with no event, no state change, no escalation
   (`ReconnectionManager.js:23-26`). Nothing downstream can react.
3. **Health monitoring conflates liveness with data-ness.** One `recordTick()` is fed by
   both ticks and heartbeats (`CTraderSession.js:190,345`); and staleness requires a prior
   tick (`HealthMonitor.js:34`, `lastTick && …`), so never-connected is undetectable.
4. **No feed isolation.** All feeds share the same `ReconnectionManager` design and the
   same class; the shared "counter only resets on success" property is load-bearing for
   every feed simultaneously.
5. **Recovery is structurally untestable** (see §6). The safety net that should catch these
   is itself broken.

These are *structural*: fixing defect #5 alone leaves 2, 3, 4, and 5 intact.

---

## 5. Q2: Are we patching a broken system, or bad designs? — **Both, and they're different.**

- **Defects #5 (give-up), #2 (blind watchdog), the fallback trap, the crippled `reinit`**
  are **bugs** — localized, fixable in lines.
- **But the *pattern* — "the system cannot recover from feed loss without a full restart,
  cannot detect it is stale, and cannot be tested for either" — is a *design gap* (the
  missing supervisor tier), not a bug.**

**Therefore:** patching the line-bugs (#1/#2 from the incident doc) is correct and urgent
(stop the bleeding), **but it is treating symptoms.** Without adding the supervisor tier
and replacing the static tests, the next variant of this failure slips through the same
gaps. Concretely:

- Fix #5 → the feed no longer *silently* dies, but there is still **nothing observing** it
  and **no behavioral test** proving recovery.
- The **test architecture is itself a design problem**: `backend-reliability.test.js`
  verifies recovery by `readFileSync(...).toContain('disconnect(false)')`
  (`backend-reliability.test.js:121-139`) — i.e. it asserts the source *contains a string*,
  not that the system *recovers*. This gave false confidence and is **why the systemic bug
  survived a "tested" codebase.** Fixing code without fixing how it is tested means the next
  regression is equally invisible.

---

## 6. Q3: Is there an alternative, *testable* architecture? — **Yes.**

### 6.1 Target: a Supervisor tier with an explicit state machine

```
┌─────────────────────────────────────────────────────────────────┐
│ FeedSupervisor  (NEW — the missing tier; owns lifecycle)         │
│   • per-feed FeedHandle { name, session, state }                 │
│   • explicit state machine:                                      │
│       DISCONNECTED → CONNECTING → CONNECTED → DEGRADED →         │
│         BACKOFF → CONNECTING …   (NO terminal DEAD state)        │
│   • owns retry policy — clock + transport INJECTED (→ testable)  │
│   • observes HealthSensor { dataTick | heartbeat | error }       │
│   • emits ObservableState {feed, state, since} for UI/monitoring │
│   • on sustained unrecoverable: escalate (log+metric), never silent │
└─────────────────────────────────────────────────────────────────┘
        │ drives                    │ observes
        ▼                           ▼
┌────────────────────┐     ┌──────────────────────┐
│ CTraderSession /   │     │ HealthSensor         │
│ TradingViewSession │     │  dataTick vs heartbeat│  (splits defect #2)
│  = dumb I/O worker │     │  never-received=stale │
│  connect/disconnect│     └──────────────────────┘
│  /send ONLY        │
│  (no ReconnectionManager inside)                  │
└────────────────────┘
```

### 6.2 Design properties (each maps to a current anti-pattern)

1. **Recovery logic lives *outside* the failing component.** Sessions become dumb I/O
   workers; the Supervisor owns the retry policy. (Fixes §4.1.)
2. **Explicit state machine — no silent terminal state.** Every transition is logged and
   observable; "give up" is not a state. (Fixes §4.2.)
3. **Injectable clock + transport.** The retry policy takes `now()` and a `transport`
   (real or fake). Recovery becomes deterministic and unit-testable. (Fixes §4.5.)
4. **Per-feed isolation.** Each `FeedHandle` has its own state/counter. (Fixes §4.4.)
5. **Observable.** `ObservableState` lets the UI and a future monitor render feed health;
   today `WebSocketServer` cannot even tell cTrader is dead.
6. **Health split.** `HealthSensor` distinguishes data ticks from heartbeats and treats
   never-received-data as stale. (Fixes §4.3 / defect #2.)

### 6.3 What becomes testable (impossible today)

- *"After 20 consecutive connect failures, the feed is in BACKOFF and attempt #21 is
  scheduled"* (today: it is dead).
- *"After a transient failure burst, the feed returns to CONNECTED within X seconds of the
  network recovering"* (the self-heal property).
- *"A manual reinit resets the feed to CONNECTING regardless of prior attempts."*
- *"Heartbeat-only (no data) for >threshold → DEGRADED."*

All run as fast unit tests with a fake transport + fake clock — **no overnight run, no live
cTrader credentials, no PG/Redis.**

---

## 7. Migration path (incremental — respects "small targeted fixes")

This is **not a rewrite**. Each phase ships independently and leaves the system better.

- **Phase 0 — stop the bleeding (days).** Incident-doc fixes #1 (never give up) + make
  `reconnect()` reset the counter before connecting + ensure `reinit` is a true reset.
  Restores self-heal for the *observed* failure. Low risk, high value.
- **Phase 1 — extract the Supervisor (1–2 weeks).** Lift the retry policy out of
  `ReconnectionManager` into a `FeedSupervisor` that owns both sessions' lifecycle.
  `server.js` creates the Supervisor; sessions lose their embedded `ReconnectionManager`.
  Introduce the state machine.
- **Phase 2 — make it testable.** Inject clock + transport; write the behavioral tests in
  §6.3. Retire the source-text assertions (or keep only as smoke tests, clearly labeled).
- **Phase 3 — hardening.** `HealthSensor` split (defect #2), fallback/transport resilience
  (defect #3/#4), and a real dev supervisor (pm2/nodemon, or build the
  `/api/dev/restart`-style endpoint that currently exists only as a design).

Phase 0 is the targeted fix the project prefers. Phases 1–3 progressively replace the
design gap rather than patch over it.

---

## 8. Why this wasn't caught sooner (honest)

Two compounding reasons, and both are real:

- **(b) The code is genuinely hard to reason about systemically.** The connection lifecycle
  is fragmented across ≥5 files in **two repos** (`CTraderSession`, `ReconnectionManager`,
  `HealthMonitor`, `WebSocketServer.handleReinit` in `services/`; `CTraderSocket` +
  `CTraderConnection` in `libs/cTrader-Layer`). The worst outcome is a silent `log.error +
  return`. There are no architecture diagrams. And the "tests" assert source text, not
  behavior — so the safety net reinforces the illusion that recovery works. This is a
  fixable clarity/structure problem (§7 phases 1–2).
- **(a) The prior analysis was bug-enumeration, not architecture-synthesis.** To be precise:
  the incident doc *did* identify defect #5 explicitly (with code and a "make it
  recoverable" recommendation) — the line-level issue was not missed. What was missed was
  the **synthesis**: that #5 is the visible tip of an *absent supervision tier*; that
  recovery is *structurally* impossible, not just "buggy"; that `reinit` is crippled; and
  that none of it is behaviorally tested. I treated #5 as a deprioritizable latent bug
  rather than a load-bearing architectural gap. That depth-of-analysis miss is mine to own.

**Net:** both, and they compound. The correction: analyze at the *tier* level (does
recovery work *as a system*?), not only the *line* level (which lines are buggy?); and
demand **behavioral** tests, not source-text assertions.

---

## 9. Decision: patch, partial redesign, or full cohesive rework?

The choice is a three-option spectrum. **Phase 0 (the patch) happens first regardless** —
it's cheap, unblocks immediately, and is not wasted even under a redesign (the redesigned
code supersedes it). The real question is what follows Phase 0. A = Phase 0 only;
B ≈ Phase 1 (extract Supervisor, sessions largely intact); C ≈ Phase 2 (full layered tier).

| | **A — Phase 0 patch** (days) | **B — extract Supervisor** (~1–1.5 wk) | **C — full cohesive tier** (~2–3 wk) |
|---|---|---|---|
| Stops *this* stall (connect-failure → give-up) | ✅ | ✅ | ✅ |
| Stops the *next* stall (silent/degraded modes, #2/#3) | ❌ | mostly ✅ | ✅ by construction |
| Recovery is testable (no overnight runs) | ❌ | ✅ | ✅ |
| Observable feed health (UI/ops) | ❌ | ✅ | ✅ |
| Zero-downtime recovery *structurally guaranteed* | hoped-for | ✅ | ✅ |
| Risk | low | medium | medium-high |
| Touches working domain/frontend code | no | no | no |

**Recommendation: A → B** (B evolving into C over time). B is the sweet spot for "cohesive
without a big-bang rewrite": supervisor tier + observability + testable recovery, with
limited surgery on the sessions. C is the clean end-state, best reached by growing from B,
not by starting over. A-only is correct only if backend capacity is nil or the system is
short-lived — which conflicts with the stated "we cannot have downtime."

**Non-negotiable risk control for B/C (stress-test of the recommendation):** the real risk
is *breaking the currently-working TradingView path and the auth / subscription-restoration
/ token-persistence logic* during extraction. Mitigation: write **characterization tests**
capturing current behavior *before* moving any code, then extract behind them. An untested
extraction of auth/subscription logic is exactly how you trade one outage for a different
one. If those tests can't be invested in, A is the safer call.

### Scope clarification (do NOT overreach)

"Rework the entire thing" is the wrong frame and would violate the project's "no big
rewrites" stance. The domain layer (MarketProfile, TWAP, DataRouter, RequestCoordinator,
SubscriptionManager, WebSocket routing) and the frontend are **working and large** and stay
untouched. Only the **connection/recovery tier** — the part that is incoherent and causing
the downtime — is reworked. That bounding is what makes B/C safe.

Related: `docs/bugs/stale-data-after-hours.md` (incident + line-level defects),
`docs/dev-lifecycle-modernization.md` (the never-built restart endpoint).

---

## Update (2026-06-24): executed (outcome)

The recommendation in this doc — **A → B** — was executed via plan
`plans/feed-recovery-supervision.md`. The outcome maps cleanly onto the design above:

- **The missing tier exists.** `services/tick-backend/supervision/` houses `FeedSupervisor`
  (lifecycle owner), `RetryPolicy` (never-terminating capped+jittered backoff), `FeedState`
  (the §6.1 state machine — DISCONNECTED→CONNECTING→HANDSHAKING→CONNECTED→DEGRADED→BACKOFF,
  **no terminal DEAD state**, plus a `HANDSHAKING` stall path), `HealthSensor` (the §6.2 #6
  health split — data-tick vs heartbeat, never-received=stale), `CTraderTransportAdapter`
  (Transport over the read-only cTrader-Layer lib), `RealClock`, and `interfaces.js`
  contracts.
- **Clock + transport injected** (§6.2 #3). The supervisor takes `now()` and a transport,
  real or fake → recovery is deterministic and unit-testable.
- **Sessions became dumb I/O workers** (§6.2 #1). `server.js` runs the cTrader session in
  `supervised` mode; the session emits connected/disconnected/tick/heartbeat and the
  supervisor owns recovery. The embedded give-up path is gone.
- **Per-feed isolation + observability** (§6.2 #4/#5). `GET /health` reads
  `supervisor.observableState()`; dev-only `POST /admin/reconnect {feed}` forces recovery.
- **Scope was widened deliberately per the plan:** defects **#3 and #4** were pulled in
  alongside #2 and #5 (rather than deferred to §7 Phase 3). #3 got a null-tick guard in
  `CTraderSession`; #4 + the hang-after-open got a per-RPC TTL + reject-on-close in the
  adapter plus the supervisor's connect-phase deadline. The fallback trap (WSL2 TLS) was
  closed by having the adapter resolve DNS→IP itself and connect to the IP.

**The §9 non-negotiable was honored.** Characterization tests (B0) were written *before*
extraction: `__tests__/characterization/{ctraderConnect,tradingviewConnect}.test.js` script
the full cTrader protobuf handshake (app-auth → account-auth → symbols-list → subscribe)
with faked I/O and assert subscription restore symbol-for-symbol. Extraction then proceeded
behind them.

**The North Star (§6.3) is met.** `__tests__/supervision/recovery.test.js` proves every
recovery behavior offline — self-heal after a failure burst; hang-after-open rescued by the
deadline; hung-command backstop; DEGRADED→reconnect; quiet-window false-staleness (#3) does
not trip; never-received→STALE→reconnect; `reset()`; subscriptions preserved across
reconnect; per-feed isolation. Full suite: `cd services/tick-backend && npx vitest run` →
13 files, **149 tests passing**.

**TradingView scoping (deliberate, not a gap).** TradingView keeps its own self-recovery
(Phase A fixed its #5 give-up). It is not wired through the supervisor — different
connection model (`tradingview-ws`, no protobuf `sendCommand`/TTL concern). Full TV
supervisor-integration is a documented follow-up. `/health` currently surfaces the
supervised cTrader feed's state.
