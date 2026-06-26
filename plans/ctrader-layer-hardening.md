# cTrader Layer Hardening (internalize the reliability layer now that the lib is ours)

## Overview

Implementation plan for **moving reliability behavior out of the backend's supervision
tier and INTO the cTrader layer** (`libs/cTrader-Layer/`), now that the layer is an
**internal vendored fork** we own and modify (`libs/CLAUDE.md`, renamed to
`@neurosensefx/ctrader-layer`).

The supervision tier (`FeedSupervisor`, `CTraderTransportAdapter`, `FeedState`,
`HealthSensor`, `RetryPolicy`) was deliberately built as an **external compensator**:
almost every non-trivial piece of `CTraderTransportAdapter` (and several vestigial paths
in `CTraderSession`) exists **only** because the library was treated as a read-only black
box that hangs, leaks, or fails to emit the events a transport should. With the library
now ours, those compensations move to the source — the layer — where they belong. This is
the **retirement of the "library read-only" guardrail** that every prior feed plan
(`feed-recovery-supervision.md`, `feed-loop-stabilization.md`) operated under.

> **STATUS (2026-06-26) — Phase 0 + Phase 1 DONE + verified (full suite 225 passed / 5 skipped).**
> Assumptions were pre-verified by three investigation agents; Phase 0 then **characterized the
> real layer** and **refuted three plan hypotheses** (folded back in below): **L10** is NOT a
> stack-overflow — a `size===0` frame returns normally but is silently dropped and poisons decoder
> state (fix = length-prefix validation + reset, not "iterative loop"); **L5** is NOT a defect —
> server-side `destroy()` already emits `'close'` today (downgraded to defensive hardening +
> regression guard); **L2** encode is two-stage (`reader.encode` → protobufjs Writer →
> `encoder.encode` → the 8-byte frame). **Phase 1 DONE** (L1–L4 + a once-guard caught in review);
> L1/L2 live-smoke gate **PASSED 2026-06-26** (live.ctraderapi.com:5035: open 1194ms, pendingCount=0,
> 91.5s no-FIN); Phase 2 (L6–L10) DONE (suite 232/5); Phase 3 B1+B2 DONE (adapter 287→123 LOC); B3–B6 remain.

**North Star (definition of done).** After this plan: the cTrader layer is a
**trustworthy transport on its own** — `open()` rejects on failure, `sendHeartbeat()` does
not leak, `close()` rejects in-flight commands, sockets reliably emit `'close'`, and
commands time out inside the layer. The backend's `CTraderTransportAdapter` shrinks to a
thin pass-through (the `tls.connect` monkey-patch, the raw-heartbeat apparatus, and the
external `_pending` TTL all deleted). The supervision tier's **core** (state machine,
backoff, `HealthSensor`, connect-phase deadline, generation-token restore cancellation) is
**untouched** — it is correct and is not a layer-compensation. Every layer change is
covered by a new offline mock-server test harness or a unit test on pure layer logic;
socket-dependent changes are live-smoke-validated against `live.ctraderapi.com:5035`.

## Division of responsibility — the supervisor STAYS (the layer only retires the bandages)

A reliable layer does **not** make the supervisor redundant. What changes is *which kind*
of reliability lives where. The supervisor currently does **two jobs**: (a) genuine
supervision — detect unhealthy conditions, decide to recover, orchestrate reconnect +
restore, own the backoff policy; and (b) compensating for a broken transport — the
`tls.connect` monkey-patch, the external `_pending` TTL, reject-on-close. **This plan moves
job (b) into the layer; job (a) stays exactly where it is.**

| Concern | Owner after this plan | Why |
|---|---|---|
| `open()` fails fast, commands time out, heartbeats don't leak, close is clean | **Layer** (L1–L5) | Mechanism-level correctness a transport should just have |
| Stale/liveness detection ("no tick for 60s = reconnect") | **Supervisor** (`HealthSensor`) | A *domain/product* policy — the transport cannot know what the app calls "healthy" |
| Backoff / retry policy | **Supervisor** (`RetryPolicy`) | Orchestration; the layer is single-shot by design (zero reconnect logic) |
| Reconnect orchestration (open → re-auth → restore → re-wire) | **Supervisor** + `CTraderSession` | Spans the transport boundary; cannot live inside the transport |
| Feed state machine | **Supervisor** (`FeedState`) | Feed-level coordination |
| Connect-phase deadline | **Supervisor** (as backstop) | Still bounds the whole handshake (auth + symbol-map), not just `open()` |
| Restore generation-token / throttle / DEGRADED-during-restore gate | **Supervisor** + `CTraderSession` | Session-level |
| Ops surface (`/health`, `/admin/reconnect`, `reinit`) | **Supervisor** / backend | Operational |

**Terminology — what shrinks is the *adapter*, not the supervisor.** What becomes a thin
pass-through after B1/B2 is `CTraderTransportAdapter` (today it is mostly bandages). The
supervisor itself — `FeedSupervisor` + `FeedState` + `HealthSensor` + `RetryPolicy` — is
**unchanged in role**; it simply finally has a transport it can trust, so the connect-phase
deadline demotes from primary defense to backstop. Could reconnect *policy* eventually
migrate into the layer too? In principle, but it is the wrong boundary — a transport should
not own domain health definitions or subscription restore, and the supervisor's job spans
layer + session. Deliberately out of scope.

---

## Verification outcomes — what the three agents proved (and corrected)

This plan is built on verified evidence, not the initial assessment. Several of the
original "this is deletable" claims were **wrong** and are corrected here.

### Confirmed (no change)

| Defect | Source evidence | Verified by |
|--------|-----------------|-------------|
| **L1** `open()` never rejects → hangs forever | `CTraderConnection.ts:75-84`; `#rejectConnectionPromise` stored, never called; `#onError`/`#onClose` only `emit` | agent 3 (CONFIRM) + direct read |
| **L2** `sendHeartbeat()` leaks a command-map entry every call | `CTraderConnection.ts:71-73` → `sendCommand` → `commandMap.create` keys a `clientMsgId` cTrader never echoes | agent 3 (CONFIRM) + direct read |
| **L3** `close()` strands all in-flight commands | `CTraderConnection.ts:149-151`; `CTraderCommandMap.ts` has only `create`+`extractById`, no reject/clear | agent 3 (CONFIRM) + direct read |
| **L5** socket binds `"end"` not Node's `"close"` | `CTraderSocket.ts:48-50, 74-76` | agent 3 (CONFIRM) + direct read |
| **L6** `on()` normalizes but `removeListener`/`removeAllListeners` don't | `CTraderConnection.ts:86-99`; zero overrides of the removal methods in `src/` | agent 3 (CONFIRM) + direct read |
| **L7** `trySendCommand` bare `catch {}` swallows errors | `CTraderConnection.ts:62-69` | agent 3 (CONFIRM) + direct read |
| Raw-heartbeat frame is **byte-exact derivable** from the proto | `encode(51, {}, undefined)` → `00 00 00 04 08 33 12 00`; proven empirically by the agent against the built encoder; matches `PINNED_RAW_HEARTBEAT_FRAME` | agent 3 (Part B) |
| Build = `cd libs/cTrader-Layer && npx ttsc` (**ttypescript**, not standard `tsc`); `build/` is **committed** (34 files) | `package.json:21` (`"build": "ttsc"`), `:45` (`ttypescript` devDep); `git ls-files libs/cTrader-Layer/build` = 34 | agent 2 |
| Real layer has **zero offline test coverage** | all supervision/characterization tests inject fakes; `ctraderFake.js:126-136` mutates the module to replace `CTraderConnection`; no lib `__tests__` exist | agent 2 |

### Corrections to the initial assessment (these reshape the plan)

| Original claim | Verdict | Correction |
|----------------|---------|------------|
| "Adapter `_pending`/TTL deletable once layer rejects on close" | **CONDITIONAL** | The per-RPC TTL is the supervisor's **only** mid-stream hung-command re-arm path (the connect-phase deadline covers the *handshake only*, `FeedSupervisor.js:317-328` races `_openAndHandshake:221-228`). So `_pending` collapses **only if the layer gains BOTH reject-on-close AND a TTL** (→ **L4**). Deleting `_pending` after L3-only reintroduces defect #4 (unbounded await) for any post-connect `sendCommand` that hangs without a socket close. |
| "ReconnectionManager's sole live consumer is TradingView" | **FALSE** | `CTraderSession` calls `reconnection.reset()` (`:177`, `:1038`) and `cancelReconnect()` (`:492`) every connect/disconnect cycle even when supervised, and `session.reconnect()` is reachable via `WebSocketServer.handleReinit:445` (dead in prod only because `server.js` always wires a supervisor). Removing it is a **3-site rewire + handleReinit audit**, not a delete. `ReconnectionManager` itself stays (TradingView). |
| "HealthMonitor removable in supervised path" | **CONDITIONAL / rewire, not delete** | The `'stale'` handler IS gated (`CTraderSession.js:396-398`), but `recordTick()` is still called at `:364` and `:524`, `start()`/`stop()` at 3 sites, and `CTraderEventHandler` holds a ref (`:120`). It is **output-less but reference-less**. Only the dead `tick_resumed` event / `isStale` are safe trims. |
| "Session 10s connect timeout is redundant" | **CONDITIONAL** | Dominated by the supervisor's 15s deadline **in production supervised mode**, but the offline characterization tests (`ctraderConnect.test.js`, `ctraderRestoreStabilization.test.js`, `ctraderConnectTiming.test.js`) run `CTraderSession` **unsupervised** and rely on it as their only hang backstop. (It also races `open()` only, not the full handshake.) Post-L1 it becomes redundant for open-hangs even unsupervised, but the tests must be updated. |
| "DNS fallback can create a double socket" | **FALSE / not reachable** | `CTraderSocket.connect()` is a single linear try/fallback; the double-socket case is unreachable. The **real** fragility there is the WSL2 TLS-handshake hang (DNS resolves, socket created, `secureConnect` never fires → open promise hangs) — which is **the same root cause as L1** and is fixed by L1. Folded in; not a separate item. |

### Additional defects found by the adversarial scan (new, Tier 2 candidates)

| Tag | Defect | Evidence |
|-----|--------|----------|
| **L8** | `reject()` rejects with a bare `GenericObject`, not an `Error` | `CTraderCommand.ts` `reject(response)`; `#onDecodedData:126` rejects with raw `payload`. Callers can't `instanceof Error` / read `.message`; backend works around with `err?.message || err` (`CTraderTransportAdapter.js:223`, supervisor stringify). |
| **L9** | Orphaned/unknown responses silently dropped or emitted under `"null"` | `#onDecodedData:132-134` misroutes unmatched responses as push events; `CTraderProtobufReader.decode:37-43` nulls unknown payloadTypes; no logging anywhere. |
| **L10** | Encoder `decode` trusts the length prefix; `size===0` silently drops the frame + poisons state | **Phase-0 characterization REFUTED the "stack-overflow" hypothesis**: a lone `00 00 00 00` returns normally (no recursion, no throw) — but the handler is never called (frame dropped) and internal `size` stays `0`, mis-decoding the NEXT frame. Real defect: silent data loss + state poisoning. |

---

## Defect → workaround → layer-fix → what it retires

| Layer fix | Layer defect | Current external workaround (retired) |
|-----------|--------------|---------------------------------------|
| **L1** `open()` rejects on error/timeout | open promise hangs forever | `CTraderSession` 10s timeout (`:126-150`); supervisor 15s deadline becomes a backstop |
| **L2** `sendHeartbeat()` writes raw frame (`encode(51,{},undefined)`) | heartbeat leaks a command entry | **the entire `tls.connect` monkey-patch** + `sendRaw` + `buildHeartbeatFrame` + `PINNED_RAW_HEARTBEAT_FRAME` + `_rawSocket` |
| **L3** `close()` rejects all pending | in-flight commands strand | adapter `_rejectAllPending` + the `conn.on('close')` reject hook |
| **L4** per-RPC command TTL in the layer | (layer has none) | adapter `_pending` Map + `commandTtlMs` + `_forceClose`-on-TTL (only with L3+L4 **together**) |
| **L5** socket binds `"close"` (not just `"end"`) | RST/destroy may not emit `'close'` | adapter's extra close/error binding backstop |
| **L6** override `removeListener`/`removeAllListeners` | asymmetric normalization | backend's raw-numeric-string cleanup (`'2131'`, `'51'`) |
| **L7** `trySendCommand` logs/rejects instead of bare `catch` | silent error swallowing | caller's inability to distinguish failure modes |
| **L8** reject with `Error` wrapping `{errorCode,description}` | non-`Error` rejection | backend `err?.message || err` defensive stringify |
| **L9** log orphaned/unknown responses | silent misrouting | (diagnostic; no external workaround exists today — things just go missing) |
| **L10** guard `decode` recursion (`size>=1`, iterative) | stack-overflow on malformed stream | (none — latent crash) |

---

## Planning Context

### Relationship to prior plans

- **`feed-recovery-supervision.md` (A→B, EXECUTED)** — built the supervision tier. **Correct; untouched.** It operated under "library read-only"; this plan removes that constraint.
- **`feed-loop-stabilization.md` (Phases 1–4 EXECUTED, Phase 5 live-validated 2026-06-24)** — stabilized the runtime reconnect loop. Its "What does NOT change" guardrail explicitly said **"`libs/cTrader-Layer` — consumed read-only. The only possible edit is the Phase 5 raw-heartbeat, data-gated and feasibility-gated."** Phase 5.2 *did* implement the raw heartbeat — but **externally**, via the `tls.connect` monkey-patch, precisely because editing the library was off the table. **This plan is the proper, in-layer execution of that deferred item** (L2), which retires the monkey-patch. Its top status banner says the loop is live-stable; this plan is **consolidation + latent-bug-fixing + simplification**, not a live-fire response.
- **`backend-reliability-fixes.md`** — separate track; no overlap.

### Decision Log

| Decision | Reasoning |
|----------|-----------|
| **Fix the layer at the source, then thin the adapter — in that order** | Every external workaround exists because the layer is wrong. Fixing the layer first means each backend deletion is provably redundant at removal time (a defense and its replacement never swap in one step). |
| **L4 (layer TTL) is part of Tier 1, not optional** | Verification proved the adapter's `_pending`/TTL is the supervisor's only mid-stream hung-command re-arm. Without L4, deleting `_pending` reintroduces the unbounded-await hang (defect #4). L4 is what makes the adapter fully thin. |
| **Build a mock-cTrader-server test harness (Phase 0) before any layer change** | The real layer has **zero offline test coverage**. L1/L2/L3/L4/L5 touch exactly the socket/command paths no test reaches. Shipping them blind (build + live-smoke only) is unacceptable for reliability-critical code. The harness is the highest-leverage enabler in this plan. |
| **Split layer changes into pure-logic (unit-testable) vs socket-dependent (harness/smoke)** | L3/L4/L6/L8/L9/L10 are pure logic — unit-testable in isolation. L1/L2/L5/L7 are socket-dependent — harness + live smoke. This shapes each item's acceptance gate. |
| **Tier 3 backend consolidation is conditional, each item gated on its enabling layer fix** | Verification refuted "just delete dead code." B1 (raw-heartbeat apparatus) gates on L2; B2 (`_pending`) gates on L3+L4; B3 (heartbeat chain) gates on the layer emitting a domain `'heartbeat'` + resolving the HealthMonitor double-feed; B4 (10s timeout) gates on L1; B5/B6 are rewires, not deletes. |
| **Supervision tier core untouched** | It is correct (A→B + loop-stabilization both validated). It is not a layer-compensation. A reliable `open()` makes its deadline a backstop, not redundant. |
| **Retire the "library read-only" guardrail across docs** | The constraint is gone; leaving it in `libs/CLAUDE.md`, `feed-loop-stabilization.md`, etc. is now actively misleading. |

### Rejected Alternatives

| Alternative | Why Rejected |
|-------------|--------------|
| Keep compensating externally forever | The monkey-patch is the most fragile code in the stack (global `tls.connect` mutation, reaches into private build artifacts, silently falls back to pinned bytes). The latent L10 crash and L9 silent-drops have **no** external workaround. Consolidation is the point. |
| L3-only (skip L4) and delete `_pending` | Reintroduces defect #4 — a post-connect hung subscribe would never re-arm the supervisor. Verification-confirmed load-bearing. |
| Wholesale rewrite/replace the layer with a custom client | The `ctrader lib decision.txt` already evaluated this (Option 2, "3–5 days, reinventing the wheel") and rejected it. The library's connect/auth/encode/decode are sound; only specific lifecycle defects need fixing. Violates "no big rewrites" outside the core-reliability carve-out, and this isn't a root-cause connection fix — it's hardening. |
| Skip Phase 0, ship layer changes build+live-smoke only | Zero offline coverage + live cTrader rate limits = slow, flaky, regression-prone feedback loop. Unacceptable for the exact paths being changed. |
| Move TradingView under the supervisor / touch the backtester | Out of scope; same deferral as prior plans. |

### Constraints & Assumptions

**Technical**
- Layer is TypeScript; edit `src/*.ts`, rebuild with `cd libs/cTrader-Layer && npx ttsc` (**ttypescript** via root `node_modules/.bin/ttsc`; standard `tsc` will choke on the `typescript-transform-paths` plugin). `build/` is committed (34 files) — **rebuild + `git add build/` + commit the compiled output** every layer change; the backend `require`s `build/entry/node/main` (`CTraderTransportAdapter.js:70`) and `build/src/core/...` (`:38-39`).
- Backend imports only through `CTraderTransportAdapter`; `CTraderSession` never imports the lib directly (agent 2). Public API to preserve: `CTraderConnection` constructor, `open`, `close`, `sendCommand`, `trySendCommand`, `sendHeartbeat`, `on`, `removeListener`, `removeAllListeners`, events `'close'`/`'error'`/`<payloadType>`.
- Offline layer test coverage is **zero today**; Phase 0 establishes it. Pure-logic items get unit tests; socket items get the harness + a one-time live smoke.
- Supervision tier core (`FeedSupervisor`, `FeedState`, `HealthSensor`, `RetryPolicy`, `RealClock`, `interfaces.js`) **stays**. Adapter changes are **deletions/simplifications enabled by the layer fixes**, gated per Tier 3.
- Existing offline suite (`npx vitest run`) must stay green throughout; characterization tests that assert soon-to-change behavior (10s timeout, restore-in-connect) are **updated, not dropped**.

**Organizational**
- Phased; each independently shippable. Tier 1 (L1–L4) is the structural core; Tier 2 (L5–L10) is independent hardening; Tier 3 (B1–B6) is gated backend cleanup. Per CLAUDE.md "small targeted fixes" — but the core-reliability carve-out (memory `feedback_core_reliability_allows_rewrites`) applies: these are root-cause fixes to the connection layer.

### Known Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Layer change breaks the live feed (no prior offline coverage) | Medium | High | Phase 0 harness first; pure-logic items unit-tested; socket items harness-then-live-smoke before merge |
| `ttsc` build drift (wrong compiler, stale `build/`) | Medium | Medium | Pin the exact command; CI/local `npm run build` from the lib dir; verify `git diff build/` is non-empty and sane after each `.ts` edit |
| L2 raw heartbeat regresses the live-validated keepalive | Low | High | Frame is proven byte-exact derivable (`encode(51,{},undefined)`); harness asserts the 8-byte frame; live smoke confirms `ProtoHeartbeatEvent` echo + no 28s FIN (per loop-stabilization 5.2) |
| L4 layer TTL tuned wrong (too short → spurious reconnects; too long → re-hangs) | Medium | Medium | Make `commandTtlMs` configurable (reuse backend's 15s default); harness tests both timeout-fires and happy-path; live-smoke confirms no storm |
| B3 heartbeat-chain collapse + HealthMonitor double-feed interaction | Medium | Medium | In supervised mode `recordTick()` (`:524`) feeds a monitor whose output nobody reads (agent verified `tick_resumed`/`isStale` have zero consumers). Collapse only after confirming the supervisor's `HealthSensor` is the sole live heartbeat consumer; relocate `recordTick` to feed it, don't just delete |
| B6 `ReconnectionManager` removal misses `WebSocketServer.handleReinit:445` | Medium | Medium | Audit all `reconnect()`/`reset()`/`cancelReconnect()` callers; `handleReinit`'s `else` branch is dead in prod but live if a supervisor is absent — keep `reconnect()` callable or hard-require the supervisor |
| L8 reject-with-`Error` changes downstream error shape | Low | Low | Backend already stringifies defensively; update tests that assert the bare-payload rejection |

---

## Phase 0 — Test enabler: mock cTrader server harness + layer unit tests

**✅ DONE 2026-06-26.** 32 pure-logic unit tests (`__tests__/layer/`) + 5 real-`CTraderConnection`
integration tests (`__tests__/integration/` against `helpers/mockCtraderServer.js`); full backend
suite **222 passed / 5 skipped**. Characterized L2/L3/L5/L8/L9/L10 and **refuted** the L5 + L10
hypotheses (see status banner + Corrections). **Portability note:** the mock server generates its
self-signed cert via the `openssl` CLI (`execFileSync` with an arg list — no shell injection); `openssl`
must be on PATH. Harden to pure-Node `crypto` if CI lacks `openssl`.

**Goal:** give the real layer offline regression coverage for the first time. **Do first.**
Zero behavioral risk; unlocks confident layer changes.

### 0.1 Mock cTrader TCP server harness
A local TLS server speaking the length-prefixed protobuf framing (`CTraderEncoderDecoder`:
4-byte BE length + payload), scriptable to: accept connect; **reject/hang the handshake**
(tests L1); **echo `ProtoHeartbeatEvent`** (tests L2); **close mid-command** (tests L3/L4);
**send a malformed/`size=0` frame** (tests L10). Lives in `libs/cTrader-Layer/__tests__/`
or `services/tick-backend/__tests__/integration/` (decide: lib-owned tests vs backend-owned
harness — prefer lib-owned so the layer becomes self-testing).

**Acceptance:**
- A test instantiates the **real** `CTraderConnection` against the mock server and asserts
  connect/heartbeat/command round-trips (currently impossible — no test touches the real class).
- Mock scripts for handshake-reject, mid-command-close, malformed-frame each drive a test.

### 0.2 Layer unit tests for pure logic (no socket)
Cover `CTraderCommandMap` reject/clear, `CTraderProtobufReader` encode/decode + unknown-type,
`CTraderEncoderDecoder` framing/recursion — the pure-logic surfaces L3/L4/L6/L8/L9/L10 touch.

**Acceptance:** `npx vitest run` (or the lib's new test runner) green; the pure-logic layer
changes in later phases have a place to land tests.

**Phase 0 exit gate:** the real `CTraderConnection` is instantiable in a test against the
mock server, and pure-logic layer modules are unit-testable.

---

## Phase 1 — Tier 1: layer owns its connection/command lifecycle (the structural core)

**✅ DONE 2026-06-26 (full suite 225 passed / 5 skipped).** L1–L4 implemented in
`libs/cTrader-Layer/src/` + rebuilt (`ttsc`). **Review caught one latent regression:** binding both
`'end'` and `'close'` to `onClose` (for L1) double-emitted `'close'` on a clean FIN — fixed with a
`#closed` once-guard on `CTraderConnection.#onClose` (this also satisfies L5's guard; the L5 `'close'`
binding landed here, so Phase 2's L5 reduces to verification). L4 wires `timeout → reject + close()`
via an injected `onCommandTimeout` callback, preserving the supervisor's hung-command re-arm. The L2
unit test proves the heartbeat leak is gone (`pendingCommandCount` stays 0); the L3 test proves
`close()` rejects in-flight commands as `Error`. **Live gate — PASSED 2026-06-26** via `services/tick-backend/scripts/ctrader-layer-live-smoke.cjs`
(bounded, read-only: app-auth + heartbeat only): `open()` 1194ms, app-auth 289ms, `pendingCommandCount=0`
across 9 heartbeats (L2 leak-free, measured live), server echoed `ProtoHeartbeatEvent` (3 echoes at ~30s
cadence — server-side throttle, not a defect), connection survived **91.5s with zero** `'close'`/`'error'`
(well past the 28s FIN threshold). **Tier 3 (B1/B2) is now unblocked.** Adapter UNCHANGED.

**Goal:** the layer is a trustworthy transport on its own. Each fix retires a specific
external workaround (Tier 3). Socket items gated on Phase 0.

### 1.1 L1 — `open()` rejects on failure
`CTraderConnection.ts:75-84` + `CTraderSocket.ts`. Wire `#rejectConnectionPromise` from
`#onError` (`:141-143`), the socket `'error'` path, and a connect timeout (the
`tls.connect({timeout:10000})` at `CTraderSocket.ts:38,65` sets a socket timeout but the
library never acts on the resulting `'timeout'` event — wire it to reject). Guard
double-settle (resolve+reject) with a `settled` flag.

**Acceptance (harness + unit):**
- Mock server that rejects/TLS-errors/hangs the handshake → `open()` rejects (today: hangs forever).
- A successful connect still resolves exactly once.
- The `secureConnect`-timeout path rejects (WSL2 TLS-hang case — root cause of the prior
  connect-phase deadline being load-bearing).

### 1.2 L2 — `sendHeartbeat()` writes a raw, leak-free frame
`CTraderConnection.ts:71-73`. Replace `this.sendCommand("ProtoHeartbeatEvent")` with a raw
write via the encoder: `this.#send(this.#encoderDecoder.encode(this.#protobufReader.encode(51, {}, undefined)))`
(byte-exact `00 00 00 04 08 33 12 00`, proven derivable — no `commandMap.create`, no
`clientMsgId`, no leak). Optionally emit a domain `'heartbeat'` event on send/receipt (enables B3).

**Acceptance (harness + unit):**
- `commandMap.openCommands` stays empty across N heartbeats (today: grows by N).
- Wire frame matches the 8-byte constant; live smoke confirms `ProtoHeartbeatEvent` echo + no 28s FIN.

### 1.3 L3 — `close()` rejects all pending commands
`CTraderCommandMap.ts` (add `rejectAll(err)`/`clear()`); call from `CTraderConnection.#onClose`
(`:137-139`) before `emit('close')`. Reject with a proper `Error` (ties to L8).

**Acceptance (unit):** in-flight `sendCommand` promises reject when `close()` is called
(today: hang forever); `openCommands` is empty after close.

### 1.4 L4 — per-RPC command TTL in the layer
`CTraderCommandMap.create` / `CTraderConnection.sendCommand`: arm a per-command timer
(configurable `commandTtlMs`, default 15000 to match the backend); on expiry, reject the
promise **and** close the transport (mirrors `CTraderTransportAdapter:206-226` semantics —
this is the supervisor's mid-stream hung-command re-arm path, so the close→supervisor
behavior must be preserved). Reuse the timer cleanup from L3's `rejectAll`.

**Acceptance (harness + unit):**
- A command whose response never arrives rejects at `commandTtlMs` and closes the transport
  (today: only the adapter catches this; the library entry leaks forever).
- Happy-path commands settle well under the TTL with no spurious close.
- `openCommands` does not grow unboundedly under a hung server.

**Phase 1 exit gate:** the layer self-heals on open-fail, heartbeat-leak, stranded-commands,
and hung-commands — all four reproducible offline via the harness. `build/` rebuilt + committed.
Adapter still works unchanged (Tier 3 deletions come next, gated).

---

## Phase 2 — Tier 2: independent layer hardening (additive, lower-risk)

**✅ DONE 2026-06-26 (full suite 232 passed / 5 skipped).** L6 (`removeListener`/`removeAllListeners`/`off`
normalization via a shared `#normalizeEventType` helper), L7 (`trySendCommand` logs instead of bare
`catch {}`), L8 (Error-wrapped rejections on the errorCode path — `Object.assign(new Error(...), payload)`,
null-payload guarded), L9 (orphaned-`clientMsgId` + unknown-payloadType logging in `#onDecodedData` +
`CTraderProtobufReader.decode`), L10 (decode length-prefix guard: reset-on-0, NOT a recursion fix — confirms
the Phase-0 refutation). L5 already landed in Phase 1. Rebuilt via `ttsc`.

**Goal:** retire the remaining fragilities found in verification + the adversarial scan.
Each item shippable independently; pure-logic items unit-tested, socket items via harness.

### 2.1 L5 — bind Node's `"close"` event (defensive hardening, NOT a defect fix)
Phase-0 characterization **showed server-side `socket.destroy()` already emits `'close'` today**
(client gets `'end'` → `onClose`). So L5 is **downgraded from a defect fix to defensive hardening**
for the true-RST / no-FIN edge case the harness did not provoke. `CTraderSocket.ts:48-50, 74-76`:
add `socket.on("close", this.onClose)` alongside `"end"`, with a `closed` flag to avoid double-emission.

**Acceptance (harness):** the existing Phase-0 L5 characterization test stays green (regression guard);
a true-RST case (if reproducible) emits `'close'`.

### 2.2 L6 — override `removeListener`/`removeAllListeners` to normalize
`CTraderConnection.ts:86-99`: factor the name→payloadType normalization out of `on()` and
apply it in `removeListener`/`removeAllListeners`/`off` too.

**Acceptance (unit):** `on('PROTO_OA_SPOT_EVENT', f)` then `removeListener('PROTO_OA_SPOT_EVENT', f)`
actually removes (today: silent no-op; must use `'2131'`).

### 2.3 L7 — `trySendCommand` stops swallowing errors
`CTraderConnection.ts:62-69`: log the error (via an injectable logger or `console.warn` with
context); consider rejecting instead of returning `undefined`, or returning a tagged result.

**Acceptance (unit):** a failing `trySendCommand` produces a visible log + a distinguishable result.

### 2.4 L8 — reject with an `Error`, not a bare payload
`CTraderCommand.ts` + `#onDecodedData:124-131`: reject with `Object.assign(new Error(...), payload)`
so callers can `instanceof Error` / read `.message` while preserving `errorCode`/`description`.

**Acceptance (unit):** a rejected `sendCommand` is `instanceof Error` with `.errorCode`/`.message`.
Backend's `err?.message || err` workaround becomes redundant (retire in Tier 3 if desired).

### 2.5 L9 — log orphaned/unknown responses
`#onDecodedData:132-134` + `CTraderProtobufReader.decode:37-43`: warn when a response carries a
`clientMsgId` with no matching command (late/duplicate/server-originated), and when a payloadType
is unknown. Stop emitting under a `"null"`/`"undefined"` key.

**Acceptance (unit):** an unmatched response logs a warning and is not misrouted as a push event.

### 2.6 L10 — guard the encoder `decode` length prefix (NOT a recursion fix)
`CTraderEncoderDecoder.ts:39-68`. Phase-0 characterization **refuted the stack-overflow hypothesis**
(pinned: a `size===0` frame returns normally). The real defect is silent frame drop + poisoned
`size` state. Fix: validate `size >= 1` (drop/reset on `0`, log a warning) and reset internal framing
state so a malformed frame cannot poison the next one. (A max-iterations cap is reasonable
defense-in-depth but is not the primary fix.)

**Acceptance (unit):** update the Phase-0 L10 characterization tests — a `size===0` frame no longer
poisons the next frame's decode (the poisoned-state test flips to "next frame arrives intact");
a well-formed frame following a zero-length header still arrives intact.

**Phase 2 exit gate:** all six items land with tests; `build/` rebuilt + committed; offline suite green.

---

## Phase 3 — Tier 3: backend consolidation (each gated on its enabling layer fix)

**Goal:** delete/simplify the external workarounds now that the layer owns the behavior.
Each item is independently shippable and **gated** — do not precede its enabler.

**✅ B1 + B2 DONE + live-validated 2026-06-26.** The adapter thinned from **287 → 123 LOC**:
deleted the raw-heartbeat apparatus (`tls.connect` monkey-patch, `sendRaw`, `buildHeartbeatFrame`,
`PINNED_RAW_HEARTBEAT_FRAME`, `_rawSocket`, socket-capture) and the external `_pending`/TTL/
`_rejectAllPending`. `sendCommand`/`sendHeartbeat` are thin delegates; `open()` keeps the idempotent
one-connection guard; `on`/`removeListener`/`removeAllListeners` pass-throughs preserve the supervisor's
`'close'`/`'error'` observation (its mid-stream re-arm now comes from the layer's L4). Full suite
225 passed / 5 skipped; **live-validated** via an adapter smoke (open 1298ms, app-auth 292ms,
`pendingCommandCount=0`, heartbeat echoes through `adapter.on`, 76.6s no-FIN). **B3–B6 remain**
(independent rewires, lower priority).

### 3.1 B1 — delete the raw-heartbeat apparatus (gates on L2) — SAFE-TO-REMOVE
`CTraderTransportAdapter.js`: delete `_installSocketCapture`/`_uninstallSocketCapture`,
`_tlsPatched`/`_origTlsConnect`, `sendRaw`, `buildHeartbeatFrame`, `PINNED_RAW_HEARTBEAT_FRAME`,
`_rawSocket` (lines `:22, :34-53, :127-129, :154, :158, :171-197, :237-249, :271, :286`).
`CTraderSession.startHeartbeat` (`:531-537`) calls `this.connection.sendHeartbeat()` instead.
Update the 3 adapter tests (`ctraderTransportAdapter.test.js:139-181`) + `FakeTransport.js:69` +
`ctraderFake.js:75` stubs.

**Acceptance:** `startHeartbeat` interval still fires every 10s via the layer; grep confirms zero
remaining references to the deleted symbols; offline suite green.

### 3.2 B2 — thin the adapter's `_pending`/TTL (gates on L3 **and** L4) — CONDITIONAL
`CTraderTransportAdapter.js:120, 148, 206-226, 267-283`: once the layer owns reject-on-close
(L3) and the TTL (L4), the adapter's `_pending` Map, `_rejectAllPending`, `commandTtlMs`, and
`_forceClose`-on-TTL collapse into pass-throughs to `this.conn`. **Do NOT attempt before L4**
(reintroduces defect #4).

**Acceptance:** `sendCommand` becomes a thin delegate; the supervisor's mid-stream hung-command
re-arm still fires (harness: a hung post-connect subscribe still closes the transport → supervisor
BACKOFF → re-arm).

### 3.3 B3 — collapse the heartbeat event chain (gates on L2 emitting `'heartbeat'` + B5) — CONDITIONAL
Map today: lib `ProtoHeartbeatEvent`→`CTraderSession:529` listener→`emit('heartbeat')` (`:527`)
+ `healthMonitor.recordTick()` (`:524`)→`FeedSupervisor.js:102`→`HealthSensor.recordHeartbeat`.
If L2 emits a clean domain `'heartbeat'`, the session's `ProtoHeartbeatEvent` listener +
re-emit collapse to a pass-through. **But** `recordTick()` (`:524`) double-feeds the
output-less-in-supervised-mode `HealthMonitor` — resolve with B5 first (relocate `recordTick`
to feed `HealthSensor`, don't just delete). Single consumer of session `'heartbeat'` confirmed
(`FeedSupervisor.js:102` only).

**Acceptance:** heartbeat reaches `HealthSensor` via one clean path; no double-feed; offline suite green.

### 3.4 B4 — remove `CTraderSession`'s 10s connect timeout (gates on L1) — CONDITIONAL
`CTraderSession.js:126-150`. Post-L1, `open()` self-rejects, making the 10s wrapper redundant
even unsupervised. **Update** the characterization tests (`ctraderConnect.test.js`,
`ctraderRestoreStabilization.test.js`, `ctraderConnectTiming.test.js`) that rely on it as their
hang backstop — inject a supervisor/FakeClock deadline instead of dropping the guard silently.

**Acceptance:** supervised connect still bounded by the supervisor deadline; characterization
tests updated and green.

### 3.5 B5 — `HealthMonitor` supervised-path rewire (independent, careful) — REWIRE
Safe trims now: remove the dead `tick_resumed` event (`HealthMonitor.js:40`, zero listeners) and
`isStale` internal state. Bigger (gates B3): relocate `recordTick()` (`:364, :524`) so it no longer
double-feeds a monitor whose output nobody reads in supervised mode; decide whether `HealthMonitor`
stays for TradingView only or is rewired out of the supervised cTrader path entirely (5 call sites +
`CTraderEventHandler:120` ref — multi-site).

**Acceptance:** supervised cTrader feed has exactly one staleness consumer (`HealthSensor`);
no dead events emitted.

### 3.6 B6 — `ReconnectionManager` in `CTraderSession` (independent, careful) — REWIRE
`CTraderSession.js:48, 177, 492, 507-509, 1038`. `scheduleReconnect()` is dead when supervised
(gated `:507`), but `reset()`/`cancelReconnect()` are called every cycle. To stop constructing
it in the supervised path: remove the 3 live call sites (`:177`, `:492`, `:1038`) **and** audit
`WebSocketServer.handleReinit:445` (calls `session.reconnect()`; dead in prod but live without a
supervisor — keep `reconnect()` callable or hard-require the supervisor). `ReconnectionManager`
itself stays (TradingView is a live consumer).

**Acceptance:** supervised cTrader session no longer constructs/calls `ReconnectionManager`;
TradingView unaffected; `handleReinit` audited and correct.

**Phase 3 exit gate:** adapter is a thin pass-through; no monkey-patch; no external TTL; one
clean heartbeat path; no dead monitors/reconnect-managers in the supervised path. Offline suite green.

---

## Phase 4 — Live validation & completion (data-gated)

**Goal:** earn "done" against a live cTrader server. Mirror `feed-loop-stabilization.md` Phase 5.

### 4.1 Deploy + harvest
Rebuild `build/`, deploy, run the supervised feed against `live.ctraderapi.com:5035` under the
normal basket for ≥ several hours including an idle window and ≥1 reconnect. Harvest `backend.log`:
heartbeat echoes (`ProtoHeartbeatEvent`), no 28s FIN kills, no `connect-phase deadline` storm,
no command-timeout storm, `errorCode=CH_*` surfacing intact.

### 4.2 Confirm each fix live
- **L1:** a TLS-error/timeout connect rejects (not hangs) — provoke if needed (bad host).
- **L2:** heartbeats echo; `commandMap` stays bounded over hours (no leak growth).
- **L3/L4:** a mid-stream server close rejects in-flight commands; a hung command times out and re-arms.
- **B1/B2:** adapter has no monkey-patch; supervisor mid-stream re-arm still fires.

### 4.3 Completion criteria
1. Feed stays connected for hours, converges in ≤1 cycle on any reconnect.
2. Layer is self-healing on all four L1–L4 failure modes (proven offline + live).
3. Adapter is a thin pass-through; the `tls.connect` monkey-patch and external TTL are gone.
4. Supervision tier core unchanged; offline suite green throughout.
5. `build/` rebuilt + committed; "library read-only" language retired from docs.

---

## Execution Order

```
Phase 0 — Test enabler (mock-server harness + layer unit tests)   [✅ DONE 2026-06-26 — 32 unit + 5 integration, full suite green]
   0.1 mock cTrader TCP server  →  0.2 pure-logic unit tests
        │
        ▼  (unlocks confident layer changes)
Phase 1 — Tier 1: layer lifecycle (structural core)               [✅ DONE 2026-06-26 — L1–L4 + once-guard; live-validated (91.5s no-FIN)]
   1.1 L1 open() rejects  →  1.2 L2 sendHeartbeat raw  →  1.3 L3 close() rejects  →  1.4 L4 layer TTL
        │                                                            (L3+L4 together enable B2)
        ▼
Phase 2 — Tier 2: independent hardening (additive)                [✅ DONE 2026-06-26 — L6–L10, suite 232/5]
   2.1 L5 bind close  ·  2.2 L6 removeListener  ·  2.3 L7 trySendCommand
   2.4 L8 reject-as-Error  ·  2.5 L9 orphan logging  ·  2.6 L10 decode guard
        │
        ▼
Phase 3 — Tier 3: backend consolidation (GATED on enabling layer fix)
   3.1 B1 raw-heartbeat apparatus  (needs L2)          — ✅ DONE (live-validated)
   3.2 B2 _pending/TTL             (needs L3 AND L4)    — CONDITIONAL
   3.3 B3 heartbeat chain          (needs L2 emit + B5)  — CONDITIONAL
   3.4 B4 10s connect timeout      (needs L1)           — CONDITIONAL
   3.5 B5 HealthMonitor rewire     (independent)         — REWIRE
   3.6 B6 ReconnectionManager      (independent)         — REWIRE
        │
        ▼
Phase 4 — Live validation + completion (data-gated)
```

Tier 1 (Phase 1) and Tier 2 (Phase 2) are **layer-only** and can proceed once Phase 0 lands.
Tier 3 (Phase 3) items are unlocked as their enablers land and may be done incrementally —
B1 is the cleanest early win (single-purpose, SAFE-TO-REMOVE); B2 is the highest-value but
must wait for L3+L4; B5/B6 are independent rewires that can be slotted anywhere.

**Progress (2026-06-26):** Phase 0 + Phase 1 + Phase 3 (B1+B2) are DONE & live-validated.
Phase 2 (L6–L10) and Phase 3 B3–B6 are in progress.

---

## What does NOT change (guardrail)

- **Supervision tier core** — `FeedSupervisor`, `FeedState`, `HealthSensor`, `RetryPolicy`,
  `RealClock`, `interfaces.js`. Correct per A→B + loop-stabilization; **not re-architected**.
  A reliable `open()` makes the connect-phase deadline a backstop, not redundant.
- **Public layer API** — `CTraderConnection` constructor/open/close/sendCommand/trySendCommand/
  sendHeartbeat/on/removeListener/removeAllListeners + events. Signatures preserved.
- **Domain services** — `MarketProfileService`, `TwapService`, `DataRouter`, `RequestCoordinator`,
  `SubscriptionManager`. Interfaces preserved.
- **Frontend** (`src/`) + WebSocket client protocol + `reinit` message — unchanged.
- **TradingView** — keeps its own self-recovery (per prior scoping); not moved under the supervisor.
- **Backtester** — untouched.

---

## Files touched

**Phase 0:** new `libs/cTrader-Layer/__tests__/` (mock TCP server + harness) or
`services/tick-backend/__tests__/integration/`; layer unit-test setup (runner/config).

**Phase 1 (layer, all rebuilt + committed):** `CTraderConnection.ts` (L1 open-reject,
L2 sendHeartbeat, L3 close-reject wiring, L4 TTL), `CTraderSocket.ts` (L1 timeout wiring),
`CTraderCommandMap.ts` (L3 `rejectAll`, L4 TTL timer), `CTraderCommand.ts` (L8 reject-as-Error).

**Phase 2 (layer):** `CTraderSocket.ts` (L5 bind close), `CTraderConnection.ts` (L6 removal
overrides, L7 trySendCommand, L9 orphan logging), `CTraderProtobufReader.ts` (L9 unknown-type),
`CTraderEncoderDecoder.ts` (L10 decode guard).

**Phase 3 (backend):** `CTraderTransportAdapter.js` (B1 deletions, B2 thinning),
`CTraderSession.js` (B3 heartbeat chain, B4 10s timeout removal, B5 recordTick relocation,
B6 ReconnectionManager removal), `HealthMonitor.js` (B5 dead-event trims),
`WebSocketServer.js` (B6 handleReinit audit), `__tests__/fakes/FakeTransport.js` +
`__tests__/characterization/helpers/ctraderFake.js` (B1 stub updates),
`__tests__/characterization/ctraderConnect.test.js` + `ctraderRestoreStabilization.test.js` +
`ctraderConnectTiming.test.js` (B4 test updates).

---

## Docs to update on completion

- `libs/CLAUDE.md` + `libs/cTrader-Layer/CLAUDE.md` — note the layer now self-heals (open-reject,
  leak-free heartbeat, reject-on-close, TTL, reliable close); document the `ttsc` rebuild workflow.
- `services/tick-backend/CLAUDE.md` — note the adapter is now a thin pass-through; update
  `CTraderSession.js` / `CTraderTransportAdapter` rows; note ReconnectionManager/HealthMonitor
  supervised-path status.
- `plans/feed-loop-stabilization.md` — mark its deferred "Phase 5 raw-heartbeat (external monkey-patch)"
  as **superseded** by L2 (proper in-layer fix); retire the "library read-only" guardrail.
- `plans/CLAUDE.md` — add this plan.
- `docs/architecture/feed-recovery-supervision-review.md` (if present) — note the supervision tier
  is unchanged and the layer is now the reliability owner for transport lifecycle.

---

## Summary

The supervision tier is correct and stays. What it exposed — by being built against a
read-only library — is a pile of **external compensations** for layer defects: a global
`tls.connect` monkey-patch to inject a raw heartbeat, an external `_pending` TTL because the
layer never times out or rejects-on-close, a 10s session timeout because `open()` hangs forever.
The library is now ours, so these move to the source. **Verification corrected the plan's riskiest
assumptions:** the adapter's TTL is load-bearing (the layer must gain a TTL too — L4 — or deleting
`_pending` reintroduces the unbounded-await hang), and the `ReconnectionManager`/`HealthMonitor`
"deletions" are rewires, not deletes. The raw heartbeat frame is proven byte-exact derivable, so
L2 needs no pinned bytes. **The plan is sequenced** — a mock-server test harness first (the layer
has zero offline coverage today), then Tier 1 layer lifecycle fixes (L1–L4), then Tier 2 hardening
(L5–L10), then Tier 3 gated backend consolidation (B1–B6), then live validation. The supervision
core is untouched; the adapter becomes a thin pass-through; the latent L10 crash and L9 silent-drops
— which have no external workaround — are fixed at the source. Completion = a self-healing layer,
a thinned adapter, and the "library read-only" guardrail retired across the docs.
