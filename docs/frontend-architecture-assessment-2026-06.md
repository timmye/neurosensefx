# Frontend Architecture Assessment — June 2026

**Status:** First-cut assessment. Findings are directional, not definitive. Assumptions must be verified before any refactoring work begins.
**Scope:** Frontend only (`src/`). Backend services are out of scope per project owner.
**Audience:** Project owner / lead developer.
**Method:** Five parallel domain assessments (charting, feature domains, workspace/UI shell, connection/data layer, cross-cutting infra), each producing a focused report. This document synthesizes them.

---

## 1. Context & Rationale

The application is a Svelte 4 SPA built around a single WebSocket, a workspace of floating displays, and a large charting core on klinecharts. The userbase is small — a handful of traders — and the app is currently described as **workable, reliable, and responsive**. There are no active fires.

The motivation for this assessment is **not** to fix something broken. It is to identify, before problems emerge, where the codebase is:

- Fragile (small changes have large blast radius)
- Expensive to extend (each new feature requires more wiring than it should)
- Quietly accumulating debt (memory, files, dependencies) that will be harder to address later

The project owner explicitly noted the backend is "fine, not great" and not worth reworking. The frontend, however, has evolved organically as features were added (FX basket, market profile, day range, price markers, percentage markers, drawing tools, ruler) and is the natural focus for any future investment.

---

## 2. Suitability for This Application

**Verdict: The current architecture is broadly suitable for the application as it exists today.**

The codebase is fit for the operating context — a small number of trusted users, a single deployment, no multi-tenant concerns, no regulatory burden, and a tolerance for brief data gaps during reconnects. In that context, many "best practice" recommendations (TypeScript migration, full test coverage, strict immutability, formal state machines) would deliver marginal value relative to their cost.

That said, three things are **not** suitable even at this scale and warrant attention:

1. **Unsafe localStorage parsing** — a single corrupted key crashes the app. Trivial fix, real risk.
2. **Unbounded in-memory growth in long-running sessions** — `marketDataStore` running high/low never resets; `barCache` eviction is manual; the `overlayMeta` Map persists across symbol changes. For a trader who leaves a tab open for days, this matters.
3. **A 654-line `workspace.js` god store** — this is the single biggest multiplier on future change cost. Every new display feature reaches into it. It is not dangerous today, but it is the bottleneck that makes everything in the workspace feel coupled.

Everything else is defensible at current scale.

---

## 3. First-Cut Caveat — Verify Before Acting

This assessment was produced from **file reads and grep**, not from running the application, not from talking to the developer, and not from inspecting runtime behavior. Several findings rest on assumptions that must be checked before any action:

| Assumption | Where it came from | How to verify |
| --- | --- | --- |
| `marketDataStore` running H/L never resets | Read of `marketDataStore.js:135-140` | Open the app for a full trading day, take a heap snapshot, check growth |
| BackgroundShader runs at 60fps even when tab hidden | No `visibilitychange` handler found in `BackgroundShader.svelte` | Open dev tools, switch tabs, watch the WebGL frame counter |
| `ws` package is unused in browser code | Grep found no `from 'ws'` imports under `src/` | `npm ls ws` and check the dependency tree; try removing it and building |
| Reconnect subscription flush causes data gaps | Read of `connectionManager.js:59-77` vs. backend `ready` ordering | Drop the WS connection mid-session and observe whether ticks resume cleanly |
| Composables migration was abandoned | `src/composables/CLAUDE.md` self-describes as deprecated | Ask the developer, or check git history for when the decision was made |
| `workspace.js` feels coupled to all display features | Multiple domain assessments independently flagged it | Try to add a new display type without touching `workspace.js` |
| `klinecharts v9.8.x` parallel-straight-line bug is live | Comment in `overlaysChannels.js` | Reproduce on the running app |
| `src/lib/connectionManager.js` is a legacy facade | Coexists with modular `lib/connection/*` | Check which one is actually imported by components and stores |

**Recommendation:** before starting any P1 structural work, spend a few hours verifying the above. Several "risks" may turn out to be non-issues; some "defer" items may need to move up.

---

## 4. Findings Summary

### 4.1 Domain snapshots

| Domain | Size | Shape | Headline concern |
| --- | --- | --- | --- |
| Charting (`src/lib/chart/`) | ~50 files, largest domain | Modular but sprawling — 8 config/theme files, 5 overlay modules, 3 drawing files mid-refactor | Configuration sprawl + drawing-system polling + unbounded `overlayMeta` Map |
| Feature domains (fxBasket, marketProfile, dayRange/ADR, priceMarkers) | ~25 files scattered | Three subtly different "orchestrator" patterns applied inconsistently | Duplicated price-scale logic, files in `lib/` root instead of subfolders, module-level mutable state in FX Basket |
| Workspace & UI shell | ~12 components + 4 lib files | Single shell with floating displays; one 309-LOC `Workspace.svelte` onMount | `Workspace.svelte` overloaded; BackgroundShader GPU cost; multiple modal patterns |
| Connection & data layer | ~13 files | Modular WS layer + 8 stores | `workspace.js` god store (654 LOC); unsafe localStorage parsing; running H/L never resets |
| Cross-cutting infra | Build config + utils + deps | Vite/Svelte 4/klinecharts/three/dexie/interact | `ws` dep unused but bundled; three.js pinned to exact version; composables dir abandoned; only 7 unit tests |

### 4.2 Cross-cutting themes

These repeat across multiple domains and are the actual leverage points:

- **God stores** — `workspace.js` (654 LOC), `marketDataStore.js` (361 LOC)
- **Module-level mutable state** — `fxBasketSubscription`, `drawingCoordinator.overlayMeta`
- **Leaked intervals / listeners / animations** — `FxBasketDisplay`, `BackgroundShader`, `keyManager` escape stack
- **Unbounded in-memory growth** — `barCache`, `marketDataStore` running H/L, `overlayMeta` Map, subscription queue
- **Duplicated patterns** — 3 orchestrator variants, 5 overlay modules, 8 chart config/theme files, price-scale calc repeated in 3 features
- **No code splitting** — three.js + klinecharts + vendored cTrader layer all loaded eagerly
- **Unsafe localStorage parsing** — 3 stores, no try/catch
- **Race conditions on reconnect / restore** — subscription flush order, debounced price-marker sync, drawing restoration polling

---

## 5. Delta Assessment — Why the Big Items Were Avoided

Several findings sound like "you should do the standard software-engineering thing" — add tests everywhere, migrate to Svelte 5, decompose the god store, restore the composables pattern, introduce TypeScript. These recommendations appear in nearly every architecture review, and nearly every team declines them. The reasons are usually rational, not lazy. Explicit treatment:

### 5.1 Composables / Pre-refactor remnants

**What was found:** `src/composables/` exists with a `CLAUDE.md` and `README.md` describing a migration to a centralized data-store pattern. No `.js` / `.ts` files remain.

**Why it likely was avoided:** Composables are not a native Svelte idiom. Svelte's store contract (`writable`, `readable`, `derived`) already covers most "composable" use cases, and the migration to `marketDataStore` is consistent with that. Restoring composables would mean either re-inventing a pattern that didn't stick the first time, or importing a convention from React/Vue that adds nothing here.

**Honest cost/benefit:** Cost is real (re-architecting the data layer, updating every consumer). Benefit is marginal — the current store pattern works. **Verdict: leave it alone.** Delete the empty directory and its docs to remove confusion, but do not resurrect the pattern.

### 5.2 Complexity reduction (decomposing `workspace.js`, consolidating chart config)

**What was found:**
- `workspace.js` is 654 lines covering displays, persistence, markers, import/export.
- `chart/` has 8 separate config/theme files (`chartConfig`, `chartConstants`, `fadedStyleDefaults`, `themeColors`, `chartThemeDark`, `chartThemeLight`, `chartTimeWindows`, `resolutionMapping`).
- 3 subtly different "orchestrator" patterns across feature domains.
- `dayRange*` / `adrBoundary*` / `priceMarker*` files scattered across `lib/` root.

**Why it likely was avoided:** This is the textbook case where short-term cost dominates long-term benefit. Decomposing `workspace.js` requires touching every display component and every persistence path. Consolidating chart config requires understanding why each of the 8 files exists — some may be load-bearing for reasons not visible from reading (e.g., lazy loading themes, runtime swap). Unifying orchestrator patterns across features sounds nice but provides no user-visible improvement.

The features were built one at a time, each with its own variation on the orchestrator idea, because at the moment of building each one, the existing pattern didn't quite fit. That is normal product evolution, not engineering failure.

**Honest cost/benefit:**
- **`workspace.js` split** — High cost, high benefit (unlocks future display work). **Worth doing**, but as a deliberate project, not a side task. Plan it.
- **Chart config consolidation** — Medium cost, low benefit. **Defer.** Group them in a folder if cosmetic order matters; do not merge the modules.
- **Unifying orchestrator patterns** — High cost, low benefit. **Defer.** The inconsistency is annoying but not dangerous.
- **Moving scattered files into subfolders** — Low cost, low benefit. **Do it next time you touch the relevant file.** Don't open a PR just for this.

### 5.3 Testing

**What was found:** Only 7 unit test files, all under `src/lib/chart/__tests__/`. Zero tests for stores, connection, features, or the workspace shell. Playwright is configured but no e2e suite was found in the assessment.

**Why it likely was avoided:** This is the most-defensible gap. The reasons compound:

1. **Small userbase, fast feedback.** With a handful of traders on chat, regressions are caught in minutes. A failing test suite is slower than a user message.
2. **Heavy chart/UI surface.** klinecharts, canvas, WebGL, and interact.js are all awkward to test. Writing a meaningful chart test takes hours; writing a trivial one adds noise.
3. **Domain-driven correctness.** Much of the logic is "does this price marker render at the right Y coordinate given these inputs" — verified by eye in seconds.
4. **WebSocket dependency.** Connection-layer tests require a mock server or a real one. Either is a project.
5. **No regression history.** Without a string of "this would have caught X" incidents, tests read as insurance against a risk that hasn't materialized.

**Honest cost/benefit at current scale:** Adding broad test coverage is **not justified**. The maintenance cost (flaky tests, false signal, slower CI) would likely exceed the bug-catching value.

**Where tests would actually pay:** Narrow, high-leverage targets only:
- `dataContracts.js` validators — pure functions, easy to test, catch real corruption
- `barMerge.js` / `barCache.js` — pure logic, wrong bar merging would silently corrupt charts
- `reconnectionHandler.js` backoff math — pure, a regression here would cause production pain
- `priceFormat.js` — pure, used everywhere, current source of truth

Adding tests for the above is a few hours' work and protects the parts most likely to silently break. **Beyond that, defer until either the team grows or the userbase does.**

### 5.4 Other "big" items, for completeness

| Item | Verdict | Why |
| --- | --- | --- |
| Svelte 4 → 5 migration | Defer | Works fine; runes migration touches every component; no concrete pain today |
| TypeScript | Defer | Discipline in JSDoc + `dataContracts.js` validators gets most of the value at none of the migration cost |
| three.js removal | Defer (but add visibility check) | Removal is high effort / low reward; the visibility check solves the worst symptom (GPU drain on hidden tabs) for a few lines of code |
| Composables resurrection | Do not | The pattern was abandoned for a reason |
| Full e2e suite | Defer | No userbase pressure; Playwright config can stay in place for when it's needed |

---

## 6. Prioritized Targets

### P0 — Real risk, low effort (hours, not days)
1. Add try/catch around every `JSON.parse(localStorage.getItem(...))` call (3 stores).
2. Cap running high/low in `marketDataStore` so long sessions don't grow unbounded.
3. Clear the `freshnessCheckInterval` in `FxBasketDisplay.svelte` `onDestroy`.
4. Add a `visibilitychange` handler to `BackgroundShader` so it pauses when the tab is hidden.
5. Remove `ws` from `package.json` deps if confirmed unused; delete `src/test_debug_*.html`, `src/start.sh`, `.env_status`; remove the empty `composables/` directory.

### P1 — Structural, deliberate (plan, don't squeeze in)
6. Split `workspace.js` into focused stores (displays / persistence / markers / import-export).
7. Fix reconnect subscription ordering — wait for backend `ready` before flushing subscriptions.
8. Unify price-scale calculation across Day Range, Market Profile, and Price Markers.

### P2 — Defer deliberately
9. Svelte 5 migration.
10. TypeScript migration.
11. three.js removal.
12. Chart config consolidation.
13. Orchestrator pattern unification.
14. Broad test coverage expansion (beyond the narrow targets in §5.3).

---

## 7. Recommended Next Step

1. **Verify the assumptions in §3** — half a day of runtime checks against the live app. Some P0 items may evaporate; some P2 items may move up.
2. **Execute P0** — small, isolated changes, no architecture impact.
3. **Plan P1 #6 (`workspace.js` split) as a dedicated project** — this is the highest-leverage structural change and the only one that meaningfully changes the future change-cost curve.
4. **Leave P2 alone** unless and until a concrete trigger appears (team growth, user growth, performance incident, regression incident).

---

## 8. Appendix — Source Assessments

This document synthesizes five focused sub-assessments produced in parallel:
- Charting domain (`src/lib/chart/`)
- Feature domains (`fxBasket`, `marketProfile`, `dayRange`, `priceMarkers`)
- Workspace & UI shell
- Connection & data layer
- Cross-cutting infrastructure

Sub-assessment findings are not reproduced here in full; the cross-cutting themes in §4.2 are the union of what each sub-assessment surfaced.

---

## 9. Verification Update (post first-cut)

The assumptions in §3 were verified via four parallel deeper investigations. **Four of the eight assumptions were refuted.** This section records what changed and revises the priority list.

### 9.1 Assumption verification results

| # | Assumption | Verdict | What actually is true |
|---|---|---|---|
| 1 | Reconnect subscription flush causes data gaps | **REFUTED** | `connectionHandler.js` correctly waits for backend `ready` signal before calling `_resendSubscriptions()`. The sequence is sound. **New issue:** no timeout if `ready` never arrives — client will wait silently. |
| 2 | `marketDataStore` running H/L never resets | **REFUTED** | Per-symbol Map (bounded by symbol count). Reset on new trading day via `resetSymbolForNewDay()`, on `clearStore()`, on `clearAllStores()`, and on logout (page reload). Kilobytes, not megabytes. |
| 3 | `barCache` eviction is manual | **REFUTED** | `candleMessages.js:34,76-77` calls `evictStaleCache()` automatically after every cache write. Strict per-resolution caps in `chartConstants.js:72-76` (e.g. 260k bars for 1m/5m/10m/15m/30m, 50k for 1h/4h, 10k for D/W/M). `CACHE_VERSION` is a Dexie schema version, not a silent invalidation tag. |
| 4 | `connectionManager.js` (lib root) is a legacy facade | **PARTIALLY TRUE** | It IS a thin facade that delegates to `connection/connectionHandler.js`. But it is still actively imported by `lib/dataManager.js`, `lib/orderManager.js`, `lib/quoteManager.js` — NOT dead. Two patterns coexist by design during gradual migration. |
| 5 | `ws` package is unused in browser code | **PARTIALLY TRUE** | Browser code indeed doesn't use it. **But** `libs/cTrader-Layer/src/cTrader-Layer-API/RealTimeClient.js:55` requires it (Node.js side of the vendored layer). Removing from top-level `package.json` would break the broker layer. |
| 6 | Composables migration was abandoned mid-flight | **CORRECTED** | Not abandoned — it was a **completed** migration. `git log` shows a clean removal commit (`refactor: remove composables in favor of marketDataStore`, 2024-11-26). Directory is empty by design, kept for reference. Safe to delete. |
| 7 | `three` is exact-pinned to `0.160.0` | **REFUTED** | `package.json` uses caret `"three": "^0.160.0"`. Lockfile resolves to 0.160.0 because nothing has triggered an update. Currently 4 minor versions behind current (0.164.0 as of June 2026). |
| 8 | BackgroundShader is the only three.js consumer | **UNDERSTATED** | Three.js is imported by **two** components: `src/lib/shaders/BackgroundShader.svelte` AND `src/lib/MarketVisualization.svelte`. Both need to be considered for any three.js decision. |

### 9.2 Revised P0 list

Original P0 was 5 items. After verification:

| # | Original P0 item | Status | Action |
|---|---|---|---|
| 1 | try/catch around `JSON.parse(localStorage.getItem(...))` | **Survives** | Still real. 3 stores, trivial fix. |
| 2 | Cap `marketDataStore` running H/L | **DROPPED** | Already bounded + reset. Not a problem. |
| 3 | Clear `freshnessCheckInterval` in FxBasketDisplay | **Survives** | Still real, trivial fix. |
| 4 | `visibilitychange` handler on BackgroundShader | **Survives (stronger)** | Now known to apply to 2 components, not 1. |
| 5 | Remove `ws` dep + delete strays | **PARTIAL** | `ws` cannot be removed (cTrader layer needs it). Composables dir + debug HTML + `src/start.sh` deletion still valid. |

**New P0 from verification:**

| # | Item | Rationale |
|---|---|---|
| 6 | Add timeout to `ready` signal wait in connectionHandler | If backend never sends `ready`, client waits silently forever. Few lines of code, real resilience win. |

**Revised P0 to execute (4 items, ~half a day):**
1. try/catch on localStorage parsing in 3 stores
2. Clear `freshnessCheckInterval` in `FxBasketDisplay.svelte` onDestroy
3. Add `visibilitychange` handler to BackgroundShader (and check `MarketVisualization.svelte` too)
4. Add timeout to `ready` signal wait in `connectionHandler.js`

Plus hygiene (separate from P0):
5. Delete empty `src/composables/` (and its docs)
6. Delete `src/test_debug_*.html` and `src/start.sh`
7. Do NOT remove `ws` — it is needed by the vendored broker layer

### 9.3 Revised `workspace.js` decomposition scope

Deeper investigation of `workspace.js` (654 LOC) produced a concrete decomposition proposal:

**Suggested 3-store split:**

| New store | LOC | Contents |
|---|---|---|
| `displayStore.js` | ~225 | Display lifecycle CRUD, selection/focus, z-index, chart ghosting |
| `markerStore.js` | ~90 | Price marker state. Absorbs existing `priceMarkerPersistence.js`. |
| `workspaceStore.js` (slimmed) | ~339 | Persistence (localStorage + server), import/export, headlines |

**Risks identified during deep-dive:**
- ~50 test files call `workspaceStore.getState()` — split will require widespread test updates.
- Import/export bypasses the persistence layer and manipulates localStorage directly (lines 328-343). This should be fixed during the split, not preserved.
- `beforeunload` `sendBeacon` would need to coordinate across multiple stores after split.
- Auth coupling is pervasive in the persistence layer.

**Verdict on the split:** **Worth doing**, but it is a project (not a side task). Plan a dedicated effort, sequence it after the revised P0 is done, and budget for test updates.

### 9.4 What did not change

These findings from the first-cut assessment survived verification and remain valid:
- `workspace.js` is the single highest-leverage refactor target
- Three subtly different "orchestrator" patterns across feature domains (defer unification)
- 8 chart config/theme files (defer consolidation)
- Test coverage gap is real but not worth closing broadly (narrow targets only — see §5.3)
- Svelte 4 → 5, TypeScript, three.js removal, full e2e suite: all still deferred
- Composables resurrection: still "do not" (the migration was completed correctly)

### 9.5 Lesson on the first-cut methodology

Half of the highest-confidence "risks" in §6 P0 turned out to be non-issues on closer inspection. The first-cut assessment over-claimed in exactly the places where reading individual lines suggested a problem without verifying the surrounding lifecycle (cache eviction, daily reset, ready-signal sequencing). The structural findings (god stores, organic sprawl, pattern duplication) survived intact — those are visible from architecture-level reading. **Operational / lifecycle findings need runtime or deeper-static verification before action.**

---

## 10. P0 Execution Update (post live-test)

The revised P0 list from §9.2 was executed. Two more assumptions fell during execution, and live testing surfaced a pre-existing reconnect bug that none of the prior static analysis caught. This section records what actually happened.

### 10.1 P0 execution status

| # | Item | Outcome |
|---|---|---|
| 1 | try/catch on `JSON.parse(localStorage.getItem(...))` | **DONE.** 3 sites fixed across `authStore.js` (lines 41, 48) and `workspace.js` (line 422). 2 additional sites already had outer try/catch (no change needed). Test-file occurrences under `page.evaluate` left untouched. |
| 2 | Clear `freshnessCheckInterval` in FxBasketDisplay | **NO-OP.** The cleanup was already correctly implemented at `FxBasketDisplay.svelte:61` — `onDestroy` clears the interval; every other interval, observer, and subscription in the file also has matching cleanup. The first-cut claim was wrong. |
| 3 | `visibilitychange` handler on three.js components | **PARTIAL.** The verification report's claim of two three.js consumers was wrong: `src/lib/MarketVisualization.svelte` does not exist. Only `src/components/BackgroundShader.svelte` was changed (+10 lines for `tabVisible` flag, `handleVisibility`, listener register/remove). Path noted in verification report (`src/lib/shaders/`) was also wrong — actual location is `src/components/`. |
| 4 | `ws` removal | **DROPPED.** Confirmed `ws` is required by the vendored broker layer (`libs/cTrader-Layer/.../RealTimeClient.js:55`). Cannot be removed from top-level `package.json` without breaking the cTrader integration. |
| 5 | Hygiene: delete empty `composables/`, debug HTML, `src/start.sh` | **DONE.** `composables/CLAUDE.md`, `composables/README.md`, `start.sh` removed via `git rm`. `test_debug_isolate.html`, `test_debug_tracer.html` removed from disk (were untracked). `src/CLAUDE.md` updated to remove stale references. |
| 6 | Timeout on `ready` signal wait | **DONE.** Added to `connectionManager.js` constructor + `onOpen` + `onMessage(ready)` + `onClose` / `onError` / `onStale` / `disconnect`. 15s timeout reuses the existing `tryScheduleReconnect()` mechanism. |

**Net P0 result:** 4 real code changes (try/catch, BackgroundShader visibility, ready timeout, reconnect flush fix — see §10.3), 1 no-op, 2 dropped, hygiene complete.

### 10.2 Two more assumptions corrected during execution

The agent-driven execution pass surfaced two more inaccuracies in the earlier analysis that deeper static reading had not caught:

| Claim | Source | Reality |
|---|---|---|
| `FxBasketDisplay.svelte` leaks `freshnessCheckInterval` | First-cut assessment, repeated in verification | Cleanup was already present at line 61. All async resources in the file have proper teardown. |
| Two three.js consumers: `BackgroundShader.svelte` + `MarketVisualization.svelte` | Verification report §9.1 | `MarketVisualization.svelte` does not exist. Only one three.js component. Verification report also got the path wrong (`src/lib/shaders/` vs actual `src/components/`). |

### 10.3 Pre-existing reconnect bug discovered during live testing

After applying P0, the user ran the live reconnect test (kill backend via `./run.sh stop`, restart, observe whether ticks resume). **Ticks did not resume.** Console filtering by "Connection Manager" showed `subscribeCandles` and `getHistoricalCandles` being flushed before `ready`, then `_skipResubscribe` suppressing the recovery path.

**Root cause** (in `src/lib/connectionManager.js` pre-fix):

1. Chart sends `subscribeCandles` and `getHistoricalCandles` via `sendRaw()`, which queues to `ConnectionManager.pendingMessages[]` when the WebSocket is closed.
2. On reconnect `onOpen`, the original code called both `subscriptionManager.flushPending()` and `flushPendingMessages()` immediately — **before** the backend had sent its `ready` message.
3. The backend `StatusBroadcaster.js:37-44` only emits `ready` after its upstream cTrader/TradingView sessions are established. Messages received before `ready` are processed against a backend with no live data sources and silently produce no effect.
4. When `ready` arrived, the `_skipResubscribe` flag (set because `subscriptionManager.hasPending()` had been true at `onOpen`) caused `resubscribeAll()` to be skipped.
5. Even when `resubscribeAll()` did fire (backend can emit `ready` more than once during a full reconnection), it only re-sends `get_symbol_data_package` messages via `SubscriptionManager`. The chart's `subscribeCandles` and `getHistoricalCandles` requests — which travel via `sendRaw`, not `SubscriptionManager` — were never re-sent.

The chart-side `candleMessages.js:96-128` has its own `ready` handler that checks `cm.hasFlushedPendingMessages` and skips re-sending candle subscriptions if a flush already happened. With the original code, that flag was set by a flush that occurred **too early** — the chart trusted a flush that had been silently dropped.

**Fix applied** (`src/lib/connectionManager.js`):

- Moved `subscriptionManager.flushPending()` from `onOpen` to the `ready` branch of `onMessage`.
- Moved `flushPendingMessages()` from `onOpen` to the `ready` branch of `onMessage` (before the `_skipResubscribe` check).
- Added explanatory comments documenting why both flushes must wait for `ready`.

New sequence on reconnect:

```
WS opens → onOpen → start ready-timeout (no flushing yet)
         ↓
         (wait)
         ↓
ready arrives → clear ready-timeout
             → subscriptionManager.flushPending()    [now safe — backend ready]
             → flushPendingMessages()                 [now safe — backend ready]
             → _skipResubscribe check
             → dispatch(d) → chart's ready callback
                            → sees hasFlushedPendingMessages=true
                            → trusts the flush, doesn't re-send
```

This is a **pre-existing bug**, not introduced by any P0 change. It would have been caught by the original first-cut assessment's "reconnect subscription flush causes data gaps" hypothesis — except that hypothesis was about the wrong mechanism (`resubscribeAll` ordering) and was correctly refuted in §9.1. The actual bug was on a different code path (`flushPendingMessages` + `sendRaw`-queued chart messages) that no one had traced.

### 10.4 Updated meta-lesson on verification

§9.5 noted that operational/lifecycle findings need runtime or deeper-static verification before action. **The reconnect bug refines that further:** even the deeper-static verification in §9 missed this one. The reason is informative:

- The verification in §9 looked at `resubscribeAll` sequencing and concluded "subscription flush properly waits for `ready`." That was correct for the SubscriptionManager path.
- The verification did **not** trace the `sendRaw` → `pendingMessages` → `flushPendingMessages` path, because that path wasn't named in the original assumption.
- The bug was only discoverable by (a) running the app, killing the backend, and watching what actually happened, or (b) a much more exhaustive static trace that followed every code path leading into `onOpen` — not just the one the original assumption pointed at.

**Refined rule:** static verification of an operational claim should trace **every code path** into the relevant lifecycle event, not just the path the original assumption named. If that's too expensive, runtime verification is cheaper than the bug making it to production.

### 10.5 Recommended next steps (updated)

With P0 complete and the reconnect bug fixed, the situation is:

- **P0 + reconnect fix need live re-verification** after the user refreshes the browser / rebuilds. The fix is in source; the running app may still be on old code.
- **P1 #6 (workspace.js split)** remains the recommended next structural project, with the scope outlined in §9.3 unchanged.
- **No new P0 items** have emerged. The reconnect flush bug was a one-off discovery from live testing, not a category of issue that suggests further fishing.

Suggested sequencing:
1. User confirms the reconnect fix works in live test (ticks resume after backend kill/restart). ✅ **Confirmed — see §10.6.**
2. Commit P0 + reconnect fix as one or two commits.
3. Plan the `workspace.js` decomposition project when ready (not under time pressure).
4. P2 items remain deferred indefinitely unless a concrete trigger appears.

### 10.6 Live re-verification result

The reconnect fix was live-tested with the same kill/restart sequence that originally surfaced the bug. **Ticks now resume correctly.** The observed console sequence:

```
[ConnectionManager] sendRaw() queued (WebSocket not open): subscribeCandles
[ConnectionManager] sendRaw() queued (WebSocket not open): getHistoricalCandles
                                          ← WS reconnects (onOpen fires)
                                          ← ready arrives (handler runs, see below)
[ConnectionManager] Flushing 2 pending messages          ← flush now AFTER ready
[ConnectionManager] Skipping resubscribeAll - flushPending already sent subscriptions
[ConnectionManager] WebSocket error: Event { … }         ← transient, on the secondary ready
[ConnectionManager] Backend ready, resubscribing to all symbols
```

Three things to note from the verified log:

1. **"Flushing 2 pending messages" now appears AFTER backend ready** — confirming the fix's central change. The chart's `subscribeCandles` and `getHistoricalCandles` reach a backend that is ready to act on them, instead of being silently dropped.
2. **Backend emits `ready` twice during a full reconnection** (consistent with the §10.3 analysis — once per upstream source, or once for the recovered backend state). The first `ready` flushes pending; the second triggers `resubscribeAll`. Both paths now fire at the correct time.
3. **A transient `WebSocket error` event appears between the two ready messages** — likely an artifact of the second upstream source reconnecting (or the stale connection from the first ready cycle being reaped). It did not affect tick delivery. This is non-fatal and worth noting but not currently a bug to fix.

**P0 + reconnect fix: verified working in production-equivalent conditions.**

**Open small observation (not P0):** the transient `WebSocket error` between the two `ready` messages. If it becomes a usability issue (visible in UI, or causes a spurious reconnect loop), investigate then. Otherwise leave it — the reconnect path is robust to it.
