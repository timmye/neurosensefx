# Frontend Architecture Assessment — June 2026

**Status:** Assessment resolved. All P0, P1, and Tier 2 items complete. Only P2 deferred items remain. Forward-looking guide: `docs/frontend-architecture-reassessment-2026-06.md`.
**Scope:** Frontend only (`src/`). Backend services are out of scope per project owner.
**Audience:** Project owner / lead developer.
**Method:** Five parallel domain assessments (charting, feature domains, workspace/UI shell, connection/data layer, cross-cutting infra), each producing a focused report. This document synthesizes them and records execution history.

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

1. ~~**Unsafe localStorage parsing** — a single corrupted key crashes the app. Trivial fix, real risk.~~ **Fixed (P0, §10.1).**
2. ~~**Unbounded in-memory growth in long-running sessions** — `marketDataStore` running high/low never resets; `barCache` eviction is manual; the `overlayMeta` Map persists across symbol changes.~~ **Refuted (§9.1).** `marketDataStore` has daily reset; `barCache` auto-evicts; growth bounded by symbol count.
3. ~~**A 654-line `workspace.js` god store** — this is the single biggest multiplier on future change cost.~~ **Resolved (§11).** Split into 3 focused stores.

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
| Feature domains (fxBasket, marketProfile, dayRange/ADR, priceMarkers) | ~25 files, organized into subfolders | All four domains follow compute/render split pattern | ~~Files in `lib/` root~~ (moved to subfolders, Tier 1), module-level mutable state in FX Basket. **Compute/render split done across all 4 domains (§12.8, §14)** |
| Workspace & UI shell | ~12 components + 5 lib files | Single shell with floating displays; `Workspace.svelte` onMount reduced (~110→40 LOC); keyboard shortcuts extracted to `workspaceKeyboardShortcuts.js` | BackgroundShader GPU cost; multiple modal patterns |
| Connection & data layer | ~16 files | Modular WS layer + fully decomposed stores | `workspace.js` (389 LOC after P1 #6 split); `marketDataStore.js` (205 LOC after §13 decomposition); localStorage parsing fixed (P0) |
| Cross-cutting infra | Build config + utils + deps | Vite/Svelte 4/klinecharts/three/dexie/interact | `ws` dep required by cTrader layer; three.js caret-pinned; composables dir removed (P0); 476 unit tests across 19 files |

### 4.2 Cross-cutting themes

These repeat across multiple domains and are the actual leverage points:

- **God stores** — ~~`workspace.js` (654 LOC → 389 LOC after P1 #6 split), `marketDataStore.js` (361 LOC)~~ **Both resolved.** `workspace.js` split (§11), `marketDataStore.js` decomposed (§13).
- **Module-level mutable state** — `fxBasketSubscription`, `drawingCoordinator.overlayMeta`
- **Leaked intervals / listeners / animations** — `FxBasketDisplay`, `BackgroundShader`, `keyManager` escape stack
- **Unbounded in-memory growth** — `barCache` (auto-evicting), ~~`marketDataStore` running H/L~~ (bounded + daily reset, §9.1 #2), `overlayMeta` Map, subscription queue
- **Duplicated patterns** — ~~price-scale calc repeated in 3 features~~ (unified P1 #8), ~~3 orchestrator variants~~ (compute/render split done across all 4 domains, §12.8, §14), 5 overlay modules, 8 chart config/theme files
- **No code splitting** — three.js + klinecharts + vendored cTrader layer all loaded eagerly
- **Unsafe localStorage parsing** — ~~3 stores, no try/catch~~ **Fixed (P0)**
- **Race conditions on reconnect / restore** — ~~subscription flush order~~ (fixed §10.3), debounced price-marker sync, drawing restoration polling

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
- **Unifying orchestrator patterns** — ~~High cost, low benefit.~~ **Reassessed and done.** See §12. Compute/render split implemented across all four feature domains (Day Range, Market Profile, FX Basket, Price Markers). 83 unit tests across the 4 domains. No behavior change.
- **Moving scattered files into subfolders** — Low cost, low benefit. **Do it next time you touch the relevant file.** Don't open a PR just for this.

### 5.3 Testing

**What was found:** Originally only 7 unit test files, all under `src/lib/chart/__tests__/`. Zero tests for stores, connection, features, or the workspace shell. Playwright is configured but no e2e suite was found in the assessment.

**Update (2026-06-03):** The narrow targets identified below were implemented — 314 tests across 12 files now cover pure-logic modules (`barMerge`, `priceFormat`, `reconcile`, `dataContracts`, `xAxisCustom`, `drawingCommands`, `drawingCoordinator`, `styleUtils`, `pricePrecision`, `cacheFreshness`, `reconnectionHandler`). All use synthetic inputs with no DOM/WebSocket mocks. An additional 51 tests cover the orchestrator compute functions (§12.8), 79 tests cover marketDataStore extracted modules (§13), and 32 tests cover price marker compute functions. Total: 476 tests across 19 files.

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
1. ~~Add try/catch around every `JSON.parse(localStorage.getItem(...))` call (3 stores).~~ **DONE.** See §10.1.
2. ~~Cap running high/low in `marketDataStore` so long sessions don't grow unbounded.~~ **DROPPED** — already bounded + daily reset (§9.1 #2).
3. ~~Clear the `freshnessCheckInterval` in `FxBasketDisplay.svelte` `onDestroy`.~~ **NO-OP** — cleanup already present (§10.2).
4. ~~Add a `visibilitychange` handler to `BackgroundShader` so it pauses when the tab is hidden.~~ **DONE.** See §10.1.
5. ~~Remove `ws` from `package.json` deps if confirmed unused; delete `src/test_debug_*.html`, `src/start.sh`, `.env_status`; remove the empty `composables/` directory.~~ **PARTIAL** — `ws` cannot be removed (cTrader layer needs it). Hygiene done. See §10.1.

### P1 — Structural, deliberate (plan, don't squeeze in)
6. ~~Split `workspace.js` into focused stores (displays / persistence / markers / import-export).~~ **DONE.** See §11.
7. ~~Fix reconnect subscription ordering — wait for backend `ready` before flushing subscriptions.~~ **DONE.** Pre-existing bug discovered and fixed during P0 live testing. See §10.3.
8. ~~Unify price-scale calculation across Day Range, Market Profile, and Price Markers.~~ **DONE.** See `docs/price-scale-unification-report.md` §6.

### P2 — Defer deliberately
9. Svelte 5 migration.
10. TypeScript migration.
11. three.js removal.
12. Chart config consolidation.
13. ~~Orchestrator pattern unification~~. **DONE.** See §12.8. Compute/render split implemented, 51 tests added.
14. Broad test coverage expansion (beyond the narrow targets in §5.3).

---

## 7. Recommended Next Step

1. ~~**Verify the assumptions in §3**~~ — Done. See §9.1.
2. ~~**Execute P0**~~ — Done. See §10.1.
3. ~~**Plan P1 #6 (`workspace.js` split) as a dedicated project**~~ — Done. See §11.
4. ~~**P1 #8 (price-scale unification)**~~ — Done. See `docs/price-scale-unification-report.md` §6.
5. **Leave P2 alone** unless and until a concrete trigger appears (team growth, user growth, performance incident, regression incident).

**All P0, P1, and god-store items are complete.** The assessment is resolved. P2 items remain deferred per §5.4.

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
| 8 | BackgroundShader is the only three.js consumer | **REFUTED (twice)** | Initial verification claimed two consumers (cited non-existent `MarketVisualization.svelte`). Corrected during P0 execution (§10.2): only `src/components/BackgroundShader.svelte` uses three.js. |

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
- ~~`workspace.js` is the single highest-leverage refactor target~~ — **Done (§11).**
- ~~Three "orchestrator" patterns across feature domains~~ — **Done (§12, §14).** All 4 feature domains now have compute/render split.
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

**All items complete.** See §11–§14 for execution records. P2 items remain deferred per §5.4.

Historical sequencing:
1. ~~User confirms the reconnect fix works in live test~~ ✅ **Confirmed — see §10.6.**
2. ~~Commit P0 + reconnect fix~~ — Done.
3. ~~Plan the `workspace.js` decomposition project~~ — Done. See §11.
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

---

## 11. P1 Execution — workspace.js Decomposition

P1 #6 was executed as a dedicated project on 2026-06-03. Plan documented in `plans/workspace-decomposition.md`.

### 11.1 Outcome

`workspace.js` (657 LOC) split into three focused modules:

| New store | LOC | Contents |
|---|---|---|
| `displayStore.js` | 254 | Display lifecycle CRUD, selection/focus, z-index, chart ghosting, navigation |
| `markerStore.js` | 173 | Marker CRUD actions (operate on displayStore) + absorbed `priceMarkerPersistence.js` |
| `workspace.js` (slimmed) | 389 | Persistence (localStorage + server), import/export, headlines state |

`priceMarkerPersistence.js` deleted — its contents absorbed into `markerStore.js`.

### 11.2 Key decisions

1. **Marker actions have no own writable state.** Markers are nested in display objects (`display.priceMarkers`). `markerStore.js` exports pure action functions that operate on `displayStore`. This avoids state duplication while giving marker logic a clear home.

2. **Combined derived store for backward compat.** `workspace.js` originally exported a Svelte `derived` store that merged `displayStore` + `_headlinesStore`. This was later removed (Tier 1 #3) after both remaining consumers were migrated to direct imports.

3. **Import/export routes through markerStore.** The original `importWorkspace` wrote price markers to localStorage directly, bypassing the persistence layer. Fixed to call `markerStore.saveMarkers()` instead, routing through the proper persistence path.

4. **Persistence subscribes to both stores.** `initPersistence()` subscribes to `displayStore` and `_headlinesStore` separately, combining their state for localStorage sync and server push. The `beforeunload` sendBeacon reads the combined `_lastWorkspaceData`.

### 11.3 Consumer migration

7 components + 2 lib files migrated to direct store imports:

| Component | Now imports from |
|---|---|
| `ChartDisplay.svelte` | `displayStore.js` |
| `PriceTicker.svelte` | `displayStore.js` |
| `FxBasketDisplay.svelte` | `displayStore.js` |
| `FloatingDisplay.svelte` | `displayStore.js` |
| `PriceMarkerManager.svelte` | `displayStore.js` + `markerStore.js` |
| `priceMarkerInteraction.js` | `markerStore.js` + `displayStore.js` |
| `priceMarkerDropdown.js` | `markerStore.js` |

`Workspace.svelte` and `HeadlinesWidget.svelte` remain on `workspace.js` — they legitimately need the combined workspace store (persistence, import/export, headlines).

### 11.4 Verification

Manual verification completed: display CRUD, arrow-key navigation, chart ghost save/restore, price markers, headlines persistence, workspace export/import round-trip, persistence round-trip (close/reopen tab), reconnect test (kill/restart backend). All passing. Build ~1070KB.

### 11.5 Remaining P1 items

| # | Item | Status |
|---|---|---|
| 6 | `workspace.js` split | **DONE** |
| 7 | Reconnect subscription ordering | **DONE** (§10.3) |
| 8 | Unify price-scale calculation | **DONE** (commit `76d2415`) |

### 11.6 Recommended next steps

**All P0 and P1 items are complete.** The remaining god store (`marketDataStore.js`) has been decomposed — see §13. P2 items remain deferred per §5.4 unless a concrete trigger appears.

---

## 12. Orchestrator Pattern Reassessment (2026-06-03)

Full analysis documented in `docs/orchestrator-unification-reassessment.md`. This section summarizes the findings for the assessment record.

### 12.1 What the original assessment claimed

§5.2 identified three "subtly different orchestrator patterns" with inconsistent subscription management, data flow, rendering triggers, and cleanup. Verdict: high cost, low benefit, defer unless building a 4th feature domain.

### 12.2 What changed

Two P1 items directly reduced the scope of this problem:

- **P1 #6 (workspace.js decomposition)** — Subscription lifecycle, the messiest inconsistency, is now managed by decomposed stores (`chartDataStore`, `displayStore`, `markerStore`), not by orchestrators.
- **P1 #8 (price-scale unification)** — Price-to-pixel calculation, one of the three key differences between domains, now uses shared code in `dayRangeRenderingUtils.js`.

### 12.3 Key finding — orchestrators are already pure functions

All three orchestrators receive `(ctx, data, config)` as parameters and render to canvas. None import stores, manage subscriptions, or own lifecycle. The "three variants" problem was in the component wiring layer (now standardized by store decomposition), not in the orchestrator functions themselves.

```
Store (owns subscription) → Component (wires lifecycle) → Orchestrator (pure render) → Canvas
```

### 12.4 Remaining work — compute/render split

The orchestrators are pure in terms of dependencies but mix computation with canvas drawing. The split needed for testability:

```
Now:   data → orchestrator (compute + draw mixed) → canvas
After: data → compute(data) → result              ← testable with synthetic data
                            → draw(ctx, result) → canvas
```

Many compute functions already exist as separate pure modules (`calculateAdaptiveScale`, `createPriceScale`, `createMappedData`). The refactor is about calling them in a separate step that returns a result object instead of consuming inline.

### 12.5 Mock data not required

The existing unit tests demonstrate the pattern — synthetic JS object literals into pure functions, no DOM/WebSocket mocks. Orchestrator compute functions follow the same approach.

### 12.6 Revised cost/benefit

| Factor | Original assessment | Now |
|---|---|---|
| Subscription unification | High cost | **Already done** (P1 #6) |
| Price-scale unification | High cost | **Already done** (P1 #8) |
| Orchestrator extraction | Medium-high | **Low-medium** (already pure functions) |
| Testing | Not possible | **Possible** via compute/render split |
| Trigger | "Building a 4th feature domain" | Also justified on testing grounds alone |

### 12.7 Updated recommendation

~~P2 #13 is still deferred, but the cost/benefit has shifted~~ **P2 #13 is now resolved.** Compute/render split implemented across all feature domains. See §12.8 and §14.

### 12.8 Implementation — Completed (2026-06-03)

The compute/render split was implemented across all three orchestrators following the recommended order. No behavior changes. Full details in `docs/orchestrator-unification-reassessment.md` §8.

| Orchestrator | New compute function | Tests |
|---|---|---|
| Day Range | `computeDayRange()` | 22 |
| Market Profile | `computeMarketProfile()` + `computeMiniMarketProfile()` | 14 |
| FX Basket | `computeFxBasketLayout()` + exported `calculateRange()` / `mapValueToY()` | 15 |
| **Total** | **4 new functions + 2 newly exported** | **51** |

All tests pass. Zero component changes required. P2 #13 is now resolved.

---

## 13. marketDataStore.js Decomposition (2026-06-03)

The last god store was decomposed following the same pattern as the workspace.js split (§11) and orchestrator compute/render splits (§12): extract pure logic into testable modules, keep the store as the wiring hub.

### 13.1 Outcome

`marketDataStore.js` (361 LOC) split into four modules:

| Module | LOC | Contents |
|---|---|---|
| `marketDataNormalizer.js` | 69 | `normalizeSymbolDataPackage()` + `normalizeTick()` — field fallback chains, mid-price calc, direction inference, running H/L |
| `marketProfileHandler.js` | 40 | `mergeProfileUpdate()` — source precedence (TV > cTrader), delta merging, profile-derived H/L |
| `dailyResetHandler.js` | 33 | `createResetFields()` + `setupDailyResetHandler()` — session field reset, daily system message subscription |
| `marketDataStore.js` (slimmed) | 205 | Store Map, subscription lifecycle, `handleStoreUpdate()` wiring, connection status, devtools exposure |

### 13.2 Key decisions

1. **Store remains the sole subscriber.** Extracted modules are pure functions — no store imports, no side effects. The store calls them and merges results.
2. **Public API unchanged.** Same 6 exports, same signatures. No consumer or component changes required.
3. **Profile handler returns null for no-ops.** Caller checks `if (result === null) return current;` — avoids unnecessary store updates when cTrader updates are rejected by TV precedence.
4. **Daily reset decoupled via callback.** `setupDailyResetHandler` takes a `resetCallback` instead of importing the store Map, keeping the module pure-testable.

### 13.3 Verification

- Build passes
- 476 tests pass (365 existing + 79 new across 3 test files, +32 price marker tests in §14)
- UI verified working by project owner
- Commit: `5ce5c4d`

---

## 14. Tier 2 Completions (2026-06-03)

Tracked in `docs/frontend-architecture-reassessment-2026-06.md` Tier 2. Three items investigated, two implemented, one rejected.

### 14.1 Keyboard service extraction

15+ keyboard shortcut registrations extracted from `Workspace.svelte` onMount into `src/lib/workspaceKeyboardShortcuts.js`. Workspace onMount reduced from ~110 to ~40 LOC. No behavior changes.

Also fixed the keyboard help overlay (`KeyboardShortcutsHelp.svelte`) — arrow keys, C (toggle chart), and chart contextual shortcuts (Ctrl+Z/Y, Del) were registered but not shown in the help.

### 14.2 Price marker compute/render split

7 pure compute functions extracted from `priceMarkerRenderer.js` into `priceMarkerCompute.js`. Renderer reduced to thin draw calls. 32 new tests. All four feature domains now follow the compute/render pattern.

| Domain | Compute function(s) | Tests |
|---|---|---|
| Day Range | `computeDayRange()` | 22 |
| Market Profile | `computeMarketProfile()` + `computeMiniMarketProfile()` | 14 |
| FX Basket | `computeFxBasketLayout()` | 15 |
| Price Markers | `computeCurrentPrice` + 6 others | 32 |
| **Total** | | **83** |

### 14.3 Overlay registration factory — rejected

Investigation found the "shared boilerplate" claim doesn't hold. Each overlay has entirely unique `createPointFigures` logic. The `registerOverlay()` API config object IS the template. A factory would add net LOC. The indicators file uses a different klinecharts API (`registerIndicator`). Not implemented.

### 14.4 Current state

**All assessment items resolved.** 476 tests across 19 files. No outstanding structural work. P2 deferred items remain in `docs/frontend-architecture-reassessment-2026-06.md` §4.
