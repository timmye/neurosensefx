# Feed Loop Stabilization (runtime cTrader reconnect loop)

## Overview

Implementation plan for the **runtime** cTrader reconnect loop exposed by
`backend.log` analysis on 2026-06-24. This is a **distinct, second-round** cluster
of defects from the ones solved by the executed `plans/feed-recovery-supervision.md`
(A → B, which fixed the *incident-doc* defects #2/#3/#4/#5 + the WSL2 TLS fallback trap
and made recovery offline-testable).

**Why this is a new plan, not an addendum.** The supervision tier (`FeedSupervisor`,
`FeedState`, `HealthSensor`, `RetryPolicy`, `CTraderTransportAdapter`) is **correct and
stays**. The defects below are **runtime / operational** — they only appear against a
*live* cTrader server under real subscription load, which the executed plan's offline test
suite (fakes, no live cTrader) is **structurally incapable of seeing**. The first live run
after A → B exposed them. They are not regressions of A → B; they are the next layer down
that A → B's `FakeTransport` deliberately could not reach.

**Core architectural finding (the structural root).** `restoreSubscriptions()` runs
**inside** `connect()`, *before* `'connected'` is emitted
(`CTraderSession.js:115`). It is heavy (≈56 subscription requests for 28 symbols), slow
(each `sendCommand` can hit the adapter's 15 s TTL), and failure-prone. Bundling it into
the handshake makes the handshake collide with **both** the adapter's 15 s per-RPC TTL
**and** the supervisor's 15 s connect-phase deadline → forced backoff → reconnect →
restore again → loop. **Everything else amplifies this; this is what stops the loop from
converging.**

**Numbering note (avoid confusion).** The incident doc uses `#1`–`#6`. This plan uses a
**separate `Loop-*` namespace** so defect numbers never collide. None of the items below
are incident-doc `#n`.

| Tag | Defect | Evidence (log/code) | Role |
|-----|--------|---------------------|------|
| **Loop-A** | Clean server FINs during idle lulls (the original "30 s disconnect") | 82× `connection lost: feed disconnected`; stack `endReadableNT → TLSSocket.emit → _onClose` = genuine server FIN; the *first* fired during an idle lull (zero cTrader traffic on the preceding lines) | **Trigger** — possibly the keepalive/heartbeat gap; **unconfirmed** |
| **Loop-B** | Connect-phase deadline aborts | 38× `connect-phase deadline exceeded (state HANDSHAKING)`. `restoreSubscriptions()` is inside `connect()` before `'connected'` and contains 15 s-TTL commands → handshake blows the 15 s deadline → forced backoff | **Structural root of the loop** |
| **Loop-C** | `Symbol ID not found` on reconnect | ≈420× (largest restore failure). `new CTraderSymbolLoader(...)` at `CTraderSession.js:86` every connect → cold `symbolMap`; fails to resolve symbols (`AUDCHF` etc.) that demonstrably exist (they delivered live `ctrader` data earlier) | **Independent defect** |
| **Loop-D** | cTrader error-code rejections swallowed | ≈294× `.ProtoOAErrorRes` (256 tick + 38 bar). Library rejects with the raw payload (`CTraderConnection.js:144`); logged only as the protobuf type name — the `errorCode` is never printed (zero `CH_*` strings in the log) | **Independent defect + diagnostic gap** |
| **Loop-E** | Command timeouts | 345 distinct adapter timeouts: 183 `SubscribeSpotsReq` + 102 `SubscribeLiveTrendbarReq` + 60 `SymbolByIdReq`. Server stops responding 15 s → adapter force-closes | **Independent defect** |
| **Loop-F** | Heartbeat `commandMap` leak | `sendHeartbeat`→`sendCommand` keys an entry never resolved (`CTraderCommandMap.js:27-40`). Pre-existing; A → B intended to fix this (raw frames) but **deferred it** — see adapter comment at `CTraderTransportAdapter.js:36-39` | **Real but minor** — not a close cause |
| **Loop-G** | Cold `symbolLoader` rebuilt every connect | `new CTraderSymbolLoader(...)` discards `symbolInfoCache` each reconnect → re-fetches symbol info, amplifying Loop-E | **Amplifier** |
| **Loop-H** | Logger emits no timestamps + swallows error payloads | `Logger.js:37-38` prefixes only `[module]`; error payloads print as type names | **Diagnostic blocker** — makes every cause above harder to confirm |

**North Star (definition of done).** After this plan: the supervised cTrader feed stays
connected for hours; when it must reconnect, it **converges in ≤1 cycle** instead of
thrashing; and any future incident is **root-causable from `backend.log` alone** (timestamps
+ errorCodes + per-cycle timing). The supervision tier is **not** re-architected. Every fix
that is reproducible offline is unit-tested with fakes; the one fix that is not (Loop-A
heartbeat) is **confirmed by timed logs before any code change**, not assumed.

All items include testable acceptance criteria. No manual-only verification steps.

---

## Planning Context

### Relationship to the executed plan (`feed-recovery-supervision.md`, A → B)

- **Kept (correct, not re-touched):** `FeedSupervisor`, `FeedState`, `HealthSensor`,
  `RetryPolicy`, the connect-phase deadline mechanism, the adapter's per-RPC TTL +
  reject-on-close, DNS→IP resolution. These are sound.
- **Re-opened deliberately:** Loop-F (raw heartbeat). A → B's B4 *intended* to send raw
  heartbeat frames and stop leaking `#openCommands`, but **deferred** it (adapter comment:
  "fully raw protobuf frames would require editing the read-only library and are deferred").
  This plan picks it up — but only after Loop-H confirms it matters (it may not).
- **Genuinely new:** Loop-B (decouple restore from connect), Loop-C/G (persist
  `symbolLoader`), Loop-D (errorCode handling), Loop-E (throttle), Loop-H (diagnostics).
  A → B bounded the heavy handshake with a deadline; it did **not** make the handshake
  light. That is the work here.

### Decision Log

| Decision | Reasoning Chain |
|----------|-----------------|
| **Diagnostics first (Loop-H, Phase 1)** | Without timestamps + errorCodes + per-cycle timing, every behavioral fix below is a guess. `backend.log` currently has **no timestamps at all** and swallows cTrader error codes. P1 is cheap, zero-behavioral-risk, and unlocks confident fixes for Loop-A/C/D/E |
| **Decouple restore from the connect handshake (Loop-B, Phase 2) — the structural root** | The loop converges only when a reconnect's handshake is **light and fast**. Moving `restoreSubscriptions()` to *after* `'connected'` (async, bounded, throttled) means the connect-phase deadline only covers open+auth+symbol-map (sub-second), so restore slowness can never abort a connect. This is the single highest-leverage change |
| **Persist `symbolLoader` across reconnects (Loop-G/C, Phase 2)** | Re-creating it every connect (`CTraderSession.js:86`) is the root of Loop-C (cold map → `Symbol ID not found`) and amplifies Loop-E (re-fetch symbol info). A persistent loader + lazy refresh kills both at once |
| **Throttle restore + handle errorCodes idempotently (Loop-E/D, Phase 4)** | 345 command timeouts + ≈294 error rejections show we exceed cTrader's concurrent-request / rate limits on the burst. Bounded concurrency + inter-request spacing, plus treating "already subscribed" as success, stops the server from throttling/dropping us |
| **Heartbeat (Loop-A/F) is data-gated, Phase 5** | The external-LLM `clientMsgId`-on-event theory is **unproven** (cTrader docs only say "send every 10 s"; proto marks `clientMsgId` optional). Do **not** hack the read-only library on an unconfirmed theory. Confirm with timed logs first; only then implement the raw frame. The leak (Loop-F) is real but minor and deprioritized until the loop is stable |
| **Supervision tier NOT re-architected** | It is correct (A → B's North Star met). These are runtime defects its offline tests cannot see. Re-architecting it would violate "no big rewrites" and trade a known-good tier for risk |
| **Offline-testable where the failure is reproducible; live smoke only for Loop-A** | Loop-B/C/D/E/H are reproducible with `FakeTransport` (script the handshake/restore/error injection). Loop-A (server FIN during idle) is not — it is a one-time live smoke once timed logs exist |

### Rejected Alternatives

| Alternative | Why Rejected |
|-------------|--------------|
| Raise the connect-phase deadline and/or command TTL to paper over slow restore | Treats the symptom; lets a slow restore pile up ever more concurrent requests against cTrader (worsens Loop-E). The deadline is correct; the handshake must get lighter, not the deadline looser |
| Patch `libs/cTrader-Layer` for raw heartbeat now | Loop-A cause is unconfirmed; the library is a separate read-only repo; risky for no proven gain. Deferred to Phase 5, gated on data |
| Shorten backoff / add more reconnect attempts | Accelerates the thrash; does not remove any cause. The supervisor's backoff is correct |
| Re-architect / re-extract the supervision tier | Not implicated; A → B is correct. Scope discipline ("no big rewrites") |
| Move TradingView under the supervisor now | Separate concern, deliberately deferred in A → B (different connection model). Out of scope |
| Add a process supervisor (pm2/nodemon) | Dev-infra, orthogonal; does not stabilize the loop |

### Constraints & Assumptions

**Technical**
- Node.js backend, Vitest, no TypeScript.
- Changes constrained to `services/tick-backend/`. `libs/cTrader-Layer` is **read-only**
  (consumed as-is) — except the *optional* Phase 5 raw-heartbeat, which is gated on data
  and assessed for library-access feasibility before any edit.
- Supervision tier (`supervision/*`) stays; changes are **additive/minimal**, not a rework.
- Offline tests must continue to pass (`npx vitest run`). Runtime fixes reproducible with
  fakes get behavioral tests; Loop-A gets a one-time live smoke.
- The frontend WebSocket protocol and `reinit` message stay valid.

**Organizational**
- Targeted, phased, each independently shippable (per CLAUDE.md "small targeted fixes").
  Phase 2 is the one structural change; the rest are localized.

### Known Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Post-connect restore + `HealthSensor` DEGRADED interaction (Phase 2) | Medium | High | If `'connected'` emits before subscriptions restore, no data flows → DEGRADED after `dataStaleMs` (60 s) → could force a reconnect *before* restore finishes. Mitigation: restore must complete well under 60 s (28 symbols × 2 at ~150–200 ms spacing ≈ 10–12 s), **and** gate the DEGRADED→forced-reconnect on a `restoreComplete` flag during the restore window. Validate in Phase 2 tests |
| Persistent `symbolLoader` serves a stale symbol set | Low | Medium | Lazy re-validate/refresh the symbol map after connect; treat unknown symbols as "defer" (Phase 3) not "fail" |
| Idempotent-subscribe handling masks real failures (Phase 4) | Medium | Medium | Classify errorCodes precisely: "already subscribed" → success; rate-limit → back off; auth/permission → escalate (do not churn). Requires Phase 1.2 errorCode surfacing first |
| Async restore changes the "connected ⇒ data flowing" assumption downstream | Medium | Medium | `WebSocketServer`/clients may expect data immediately after `'connected'`. Verify tolerance of a brief no-data window; the existing `MarketProfileService`/`isSymbolInitializing` paths already handle initializing feeds |
| Moving restore out of `connect()` changes the A → B characterization tests (B0) | High | Low | Update `__tests__/characterization/ctraderConnect.test.js`: restore is no longer part of the connect promise; assert it runs post-connect and restores symbol-for-symbol |
| Heartbeat raw-frame (Phase 5) requires reaching the library's private socket/encoder | High (if attempted) | Medium | Feasibility-gate before implementing; prefer a scoped capture (e.g., wrap `tls.connect` keyed to the cTrader host) over a broad monkey-patch. If infeasible cleanly, document and keep the leak tracked |

---

## Phase 1 — Diagnostic fidelity (Loop-H)

Goal: make `backend.log` self-sufficient for root-causing. Zero behavioral risk; unlocks
confident fixes for Loop-A/C/D/E. **Do first.**

### 1.1 Add timestamps to the logger

`services/tick-backend/utils/Logger.js:37-38` — the prefix is currently `[module]` (optionally
colored) with **no time**. Prepend an ISO-8601-with-milliseconds timestamp to every line
(e.g. `2026-06-24T15:03:21.417Z [FeedSupervisor] ...`). Keep the existing level/tag format;
only add the timestamp.

**Acceptance (unit):**
- Every emitted line, at every level, carries a millisecond-precision timestamp prefix.
- A tiny test renders a line and asserts a `/^\d{4}-\d{2}-\d{2}T…\.\d{3}Z \[/` prefix.

### 1.2 Surface cTrader `errorCode` on rejections (Loop-D)

The library rejects with the **raw protobuf payload** when `payload.errorCode` is set
(`libs/.../CTraderConnection.js:144`). Today that payload is logged as `.ProtoOAErrorRes`
(the type name) and the `errorCode` (and `description`, if present) are never printed. Fix
at our tier: wherever we catch a rejected `sendCommand` and log it
(`restoreSubscriptions`, `subscribeToTicks/M1Bars/Bars`, `WebSocketServer` subscribe paths,
`RequestCoordinator`), extract and include `err.errorCode` / `err.description` when present.

**Acceptance (unit):**
- Given a rejected command whose error object is `{ errorCode: 'CH_ALREADY_SUBSCRIBED', description: '...' }`,
  the logged message contains the `errorCode` string verbatim.
- `grep -oE 'CH_[A-Z_]+' backend.log` after a run with injected errors returns the codes.

### 1.3 Per-cycle connect timing markers

Instrument one connect cycle so its timeline is reconstructable from the log: log
`connect-start`, each handshake step's elapsed (open / auth / symbol-map), restore start +
counts, and `connect-end` with total elapsed. This is what proves whether Loop-B (deadline)
fires and how long restore actually takes.

**Acceptance (smoke + unit):**
- A unit test with `FakeTransport` asserts the timing markers are emitted in order with
  sane deltas.
- A live run shows the connect-cycle timeline end-to-end (the deliverable for confirming
  Loop-B/A timing).

**Phase 1 exit gate:** `npx vitest run` green; a reconnect cycle is fully legible in
`backend.log` (timestamps + errorCodes + step timings).

---

## Phase 2 — Structural root: decouple restore from the connect handshake (Loop-B + Loop-G)

Goal: a reconnect's handshake is **light and fast**; restore never aborts a connect. This is
the loop-breaker. Sequenced so the persistent loader (2.2) lands before the restructure (2.3).

### 2.1 Persist `symbolLoader` (and its caches) across reconnects (Loop-G/C)

`CTraderSession.js:86` currently does `this.symbolLoader = new CTraderSymbolLoader(...)`
on **every** `connect()`, discarding `symbolMap` + `symbolInfoCache`. Change: construct the
loader **once** (constructor or first connect) and **re-bind** its `connection` on each
connect instead of recreating it. After connect, **lazily refresh** the symbol map (refresh
in the background; keep the old map valid until the refresh completes so restore can proceed).

**Acceptance (unit, `FakeTransport`):**
- Across two connects, the **same** `symbolLoader` instance is used; `symbolInfoCache`
  survives (a symbol fetched on connect 1 is a cache hit on connect 2 — no second
  `ProtoOASymbolByIdReq`).
- A background refresh does not block the connect handshake.

### 2.2 Move `restoreSubscriptions()` out of the connect-critical path (Loop-B)

Split `connect()` into a **fast handshake** and a **post-connect restore**:
- Handshake (must stay bounded by the connect-phase deadline): `open()` → `authenticate()` →
  `ensureSymbolMap()` (lazy, Phase 2.1) → `startHeartbeat()` → **emit `'connected'`**.
- Restore (async, *after* `'connected'`): `restoreSubscriptions({ boundedConcurrency,
  throttleMs })`, reporting progress; failures are queued/retried, **never** abort the connect.

The supervisor's 15 s connect-phase deadline then only covers open+auth+symbol-map
(sub-second), so restore slowness or a slow `SubscribeLiveTrendbarReq` can no longer trip
the deadline.

**DEGRADED-interaction guard (Known Risk #1).** Emitting `'connected'` before data flows
means `HealthSensor` could go DEGRADED during the restore window. Gate the
DEGRADED→forced-reconnect trigger on a `restoreComplete` flag (or a restore-grace period)
so a slow-but-progressing restore is not mistaken for a dead feed. Restore must target
< `dataStaleMs`.

**Acceptance (unit, `FakeTransport`):**
- `'connected'` emits **before** any subscription request is sent.
- A restore in which one `SubscribeLiveTrendbarReq` stalls past the TTL does **not** abort
  the connect or trip the connect-phase deadline; the stall is isolated to that subscription
  (queued/retried).
- Restore completes within the expected throttled budget; DEGRADED does not force a reconnect
  while `restoreComplete === false`.
- Subscriptions still restore **symbol-for-symbol** equal to the pre-disconnect set
  (preserve the A → B characterization guarantee — update the test, don't drop it).

### 2.3 Update the A → B characterization tests

`__tests__/characterization/ctraderConnect.test.js` asserted restore as part of connect.
Update it: restore is post-connect; assert it runs after `'connected'` and restores
symbol-for-symbol. This is the safety net that proves 2.2 is non-regressing.

**Acceptance:** characterization suite green after the restructure; restore behavior
asserted in its new (post-connect) position.

**Phase 2 exit gate:** a reconnect whose restore contains a 15 s-stalling command still
reaches and **stays** `CONNECTED` (no deadline abort); the offline suite is green.

---

## Phase 3 — Resilient symbol resolution (Loop-C)

Goal: `Symbol ID not found` stops dropping subscriptions. Largely resolved by Phase 2.1
(persistent map), but harden the path so an unresolved symbol is **deferred**, not lost.

### 3.1 Defer (not drop) unresolved symbols during restore

`subscribeToTicks/M1Bars/Bars` throw `Symbol ID not found` when `getSymbolId` returns falsy.
With a persistent map this is rare, but on a genuinely-new or late-resolved symbol it can
still happen. Change `restoreSubscriptions` to **queue** a subscription whose symbol is not
yet resolved and retry it once the (lazy) symbol-map refresh lands, instead of logging an
error and moving on.

**Acceptance (unit):**
- A restore containing a symbol absent from the cold map but present after refresh: the
  subscription is eventually established (no `Symbol ID not found` drop), once the refresh
  completes.
- A symbol that is genuinely absent after refresh is logged once with its `errorCode`/reason
  (Phase 1.2) and skipped, not retried forever.

---

## Phase 4 — Throttle restore + handle errorCodes (Loop-E + Loop-D)

Goal: stop exceeding cTrader's concurrent-request / rate limits, and stop blind-retrying
server rejections. **Depends on Phase 1.2** (errorCode surfacing) to classify correctly.

### 4.1 Bounded-concurrency, throttled restore (Loop-E)

`restoreSubscriptions` currently serializes with a fixed 50 ms spacing. Under cTrader's
limits the server still throttles (345 timeouts). Replace with a **bounded-concurrency**
runner (e.g., max N in-flight subscription commands) with a configurable inter-request
spacing, and a short per-command budget. Tune so the full restore stays well under
`dataStaleMs` (Phase 2.2 guard) without bursting.

**Acceptance (unit, `FakeTransport`):**
- Restore never exceeds the configured in-flight cap at any instant.
- Full restore for 28 symbols × 2 completes in the expected throttled budget; no single
  stall blocks the others (isolated retry).

### 4.2 Idempotent + classified subscribe handling (Loop-D)

With Phase 1.2 surfacing errorCodes, classify cTrader subscribe/symbol rejections:
- **Already-subscribed** (`CH_...` already-subscribed variant) → treat as **success**
  (idempotent); do not fail the restore for it.
- **Rate-limit / too-many** → back off (reduce concurrency / raise spacing), then retry.
- **Auth / permission / permanent** → escalate (log clearly, expose on `/health`), do **not**
  churn-retry.

**Acceptance (unit):**
- An "already subscribed" rejection results in the subscription being considered restored
  (no error, no re-attempt storm).
- A rate-limit rejection triggers a backoff (reduced concurrency), not an immediate retry.
- A permanent/permission rejection is escalated (logged + surfaced), not silently retried.

**Phase 4 exit gate:** offline suite green; a restore that injects throttle/errors converges
without a timeout/abort storm.

---

## Phase 5 — Re-evaluate the heartbeat (Loop-A + Loop-F) — data-gated

Goal: settle whether the heartbeat/keepalive is the cause of Loop-A, and decide on the
Loop-F leak fix on **evidence**, not theory.

### 5.1 Confirm (or refute) the heartbeat hypothesis with timed logs

Using Phase 1's timestamps + timing markers, on a live run determine:
- Do the clean FINs (Loop-A) coincide with **idle lulls** where *only* heartbeats were sent?
- Are heartbeats actually being **sent** (interval firing) and **received** (server echoes)
  in the ~30 s before a FIN?
- Does the FIN arrive at a fixed offset from the last real (non-heartbeat) message?

**Acceptance (smoke — one live run):** a written finding in the bug doc stating whether
Loop-A correlates with heartbeat-only idle, with the timestamps that prove it.

### 5.2 (Conditional) Raw heartbeat frame, or leave the leak tracked

- **If 5.1 confirms keepalive failure:** implement sending `ProtoHeartbeatEvent` as a **raw
  frame without `clientMsgId`**, bypassing the command map (fixes Loop-F leak **and** the
  likely Loop-A cause). Feasibility-gate library access first (scoped `tls.connect` capture
  keyed to the cTrader host, or another clean seam); if no clean seam exists, document and
  do not force a fragile monkey-patch.
- **If 5.1 refutes keepalive:** leave Loop-F as a tracked low-priority cleanup (the leak is
  real but slow and not a close cause); record the finding.

**Acceptance (unit, only if implemented):** heartbeat frames do not accumulate in any
command map; the interval still fires every 10 s; a heartbeat round-trip is observable. If
**not** implemented, the acceptance is the documented finding from 5.1.

---

## Execution Order

```
Phase 1 — Diagnostics (Loop-H)            [no behavioral risk; do first]
  1.1 timestamps → 1.2 errorCode → 1.3 timing markers
        │
        ▼  (unlocks confident behavioral fixes + a live timed run)
Phase 2 — Structural root (Loop-B + Loop-G)   [the loop-breaker]
  2.1 persist symbolLoader → 2.2 move restore out of connect → 2.3 update characterization
        │
        ▼
Phase 3 — Resilient symbol resolution (Loop-C)   [hardens 2.1]
        │
        ▼
Phase 4 — Throttle + errorCode handling (Loop-E + Loop-D)   [depends on 1.2]
        │
        ▼
Phase 5 — Heartbeat re-evaluation (Loop-A + Loop-F)   [data-gated; live smoke]
```

Hard dependencies: **Phase 1 before behavioral phases** (everything is a guess without
timestamps/errorCodes). **Phase 2.1 before 2.2/3** (persistent loader underpins both).
**Phase 4.2 depends on 1.2** (needs errorCode to classify). **Phase 5 is last and
conditional** on a live timed run.

Phases 1–4 are independently shippable and offline-testable. Phase 5 is the only item
requiring a live cTrader run, and it changes code only if data confirms it should.

---

## What does NOT change (guardrail)

- **Supervision tier** (`FeedSupervisor`, `FeedState`, `HealthSensor`, `RetryPolicy`,
  `RealClock`, `interfaces.js`) — correct per A → B; **not re-architected**. Only additive,
  localized changes (e.g., a `restoreComplete` gate hook in Phase 2.2).
- **`CTraderTransportAdapter`** — TTL + reject-on-close stay; not reworked. (Phase 5 may add
  a raw-heartbeat path, feasibility-gated.)
- **Domain services** (`MarketProfileService`, `TwapService`, `DataRouter`,
  `RequestCoordinator`, `SubscriptionManager`) — interfaces preserved.
- **Frontend** (`src/`) + WebSocket client protocol + `reinit` message — unchanged.
- **`libs/cTrader-Layer`** — consumed read-only. The only possible edit is the Phase 5
  raw-heartbeat, which is **data-gated and feasibility-gated** before any change.
- **TradingView** — keeps its own self-recovery (per A → B scoping); not moved under the
  supervisor here.
- **Backtester** — untouched.

## Files touched

**Phase 1:** `utils/Logger.js` (timestamps), `CTraderSession.js` + `CTraderSymbolLoader.js`
+ `WebSocketServer.js` + `RequestCoordinator.js` (errorCode surfacing on caught rejections),
new/extended timing-marker logging in `CTraderSession.connect`.

**Phase 2:** `CTraderSession.js` (loader persistence + connect/restore split +
`restoreComplete` gate), `__tests__/characterization/ctraderConnect.test.js` (update).

**Phase 3:** `CTraderSession.js` (`restoreSubscriptions` defer-queue), `CTraderSymbolLoader.js`
(lazy refresh).

**Phase 4:** `CTraderSession.js` (bounded-concurrency restore), error-code classification
(likely a small helper in `supervision/` or `utils/`).

**Phase 5 (conditional):** `CTraderTransportAdapter.js` / `CTraderSession.startHeartbeat`
(raw heartbeat), feasibility-gated; possibly a scoped `tls.connect` capture.

**Tests:** extend `__tests__/supervision/` (restore-out-of-connect, throttle, errorCode
classification), update `__tests__/characterization/ctraderConnect.test.js`. All offline.

## Docs to update on completion

- `docs/bugs/stale-data-after-hours.md` — add a "Round 2: runtime loop" section listing
  Loop-A–H with their resolutions; record the Phase 5 heartbeat finding (confirmed/refuted).
- `docs/architecture/feed-recovery-supervision-review.md` — note that the supervision tier
  was correct and the runtime loop was a *second-round* operational cluster, fixed by this
  plan; link this plan.
- `services/tick-backend/CLAUDE.md` — note the connect/restore split + persistent loader.
- `plans/CLAUDE.md` — add this plan.

## Summary

The supervision tier built by A → B is correct; what it exposed, on the first live run, is a
**runtime reconnect loop** with several compounding causes — but one **structural root**:
`restoreSubscriptions()` is bundled inside `connect()`, so a slow/failed restore aborts the
handshake (Loop-B) and re-floods the server every cycle. This plan fixes the diagnostic gap
first (timestamps + errorCodes + timing — Loop-H), then decouples restore from the connect
handshake and persists the symbol loader (Loop-B/G/C), then makes restore throttled and
error-aware (Loop-E/D), and finally settles the heartbeat question (Loop-A/F) on **timed
evidence** rather than the unproven `clientMsgId` theory. The supervision tier is not
re-architected; the external library stays read-only unless Phase 5 data justifies otherwise.
The result: the loop converges in ≤1 cycle, and the next incident is root-causable from
`backend.log` alone.
