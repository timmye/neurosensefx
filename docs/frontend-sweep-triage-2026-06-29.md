# Frontend Sweep — Triage Against Prior Audits (2026-06-29)

**Purpose:** A *delta* review of `src/`, not a fresh audit. Classifies every finding from the
2026-06-29 multi-agent sweep against the **existing** frontend assessments so we don't retrace
prior, deliberate decisions. The user's standing instruction: structural refactors must be balanced
against prior art and real impact before they become recommendations.

**Prior audits (read these first — this doc does not duplicate them):**
- `docs/frontend-architecture-reassessment-2026-06.md` — current architecture state, active targets,
  and a **"Deferred Items — Do Not Touch Unless Triggered"** list (§4).
- `docs/frontend-audit-2026-06-23.md` — dead-code/perf/UX inventory; **verified findings + debunked
  agent claims**; Tier 1 dead-code sweep executed, Tier 2 #1/#6 perf fixed.
- `docs/analysis/frontend-debt-assessment.md` — debt assessment.
- `docs/design/drawing-architecture-redesign.md` — rationale for the ChartDisplay single-coordinator
  consolidation (commit `b2f4e5f`).

**Method (this sweep):** 6 parallel passes (cruft, duplication, structure, perf, stores, lib
naming/dead-code), then direct verification of headline claims, then reconciliation against the
prior audits above. **Investigation pending** items (§3) are being balanced by sub-agents in
parallel with this doc.

---

## 1. The headline: most structural findings retrace prior decisions

A large share of the 2026-06-29 sweep's "refactor opportunities" are **already documented as
deliberately deferred, already-fixed, or already-debunked.** Acting on them would re-tread ground.
This is the single most important conclusion of the sweep.

| 2026-06-29 finding | Prior status | Action |
|---|---|---|
| Merge chart themes (`chartThemeLight`/`Dark`, 443/438 LOC) | **Deferred** — reassessment §4: "No user-facing benefit. Mechanical but noisy refactor." | **Do not re-recommend.** (Confirming via agent — see §3.4.) |
| Code-splitting / lazy-load klinecharts | **Deferred** — reassessment §4. Bundle now ~622 kB (was 1.1 MB after three.js removal). | Do not re-recommend. |
| Shared modal base component | **Deferred** — reassessment §4: "3 modal patterns is annoying but not actively harmful." | Do not re-recommend. |
| Chart-config consolidation (8 files) | **Deferred** — reassessment §4: "Each file exists for a reason (lazy loading, runtime swap)." | Do not re-recommend. |
| Overlay registration factory (dedupe 5 overlay modules) | **Rejected after investigation** — reassessment Tier 2 #9: "the 'boilerplate' is the klinecharts API config shape, not duplicated logic; a factory would add more LOC than it saves." | Do not re-recommend. |
| Decompose `ChartDisplay.svelte` (god component) into smaller parts | **Already done and reversed** — commit `b2f4e5f` deleted `chartDrawingHandlers.js`, `chartOverlayRestore.js`, `overlayMeta.js` and consolidated into a single `drawingCoordinator.js`. User confirms the decomposition was *less efficient*. | **Do not re-decompose.** (Confirming via agent — see §3.4.) |
| `PriceTicker` mini-profile re-rendered per tick | **Known** — frontend-audit Tier 2 #4 (runtime-verify pending). | Not new. Fold into the existing runtime-verification task. |
| `App.svelte` top-level `authStore.subscribe` (no unsubscribe) | **Known** — frontend-audit Tier 2b #8 (bounded — root singleton). | Not new. Low priority. |
| `connectionManager` `visibilitychange` listener not removed | **Known** — frontend-audit Tier 2b #9 (singleton-bounded). | Not new. Low priority. |
| `displayStore.updatePosition` clones entire `Map` per drag frame | **Known** — frontend-audit Tier 2 #3 (runtime-verify pending). | Not new. |
| `DisplayCanvas` full redraw every tick × every display | **Fixed** — frontend-audit Tier 2 #1 (rAF-coalesced, 2026-06-23). | Resolved. |
| `displayCanvasRenderer` recomputes adaptive scale 3× per render | **Fixed** — frontend-audit Tier 2 #6 (memoized, 2026-06-23). | Resolved. |
| `window.*` debug globals (`workspaceStore`, `workspaceActions`, `fxBasketDebug`, `displayStore`) | **Intentional** — frontend-audit "Production noise": *"the E2E suite depends on them."* | **Do NOT DEV-gate.** The 2026-06-29 sweep rated this HIGH and proposed gating — that would break E2E. |
| `markerStore.mergeWithPersisted` is dead | **Debunked** — frontend-audit verification: it has callers. The 2026-06-29 cruft pass re-flagged it. | Drop the claim. |

---

## 2. Genuinely-new findings (not covered by prior audits)

These are the items the prior audits did **not** already settle. Each is under investigation (§3).

### 2.1 Possible data-integrity: duplicated Dexie schema — 🔍 INVESTIGATING (§3.1)

`new Dexie('NeuroSenseDrawings')` is defined in **two** places with **divergent v3 migrations**:
- `src/lib/chart/drawingStore.js:8-17` — has `.upgrade(tx => …)`.
- `src/stores/authStore.js:60-63` — **no** upgrade callback.

If `authStore`'s instance opens the DB first during a v3 upgrade, the migration could be skipped.
**Open question:** is authStore's separate Dexie instance *intentional* (e.g. it must read drawings
at a specific point during login/migration, before `drawingStore` is guaranteed loaded)?
Verdict pending — see §3.1.

### 2.2 Perf: `localStorage` written synchronously on every drag frame — 🔍 INVESTIGATING (§3.2)

`workspace.js` `syncToStorage` (line ~285) writes `localStorage.setItem('workspace-state', …)`
synchronously on **every** `displayStore` change. Only the server `fetch` is debounced (2 s). During
a drag (~60 fps `updatePosition`), that's a full `JSON.stringify(workspace)` + `setItem` per frame.
Related to — but more specific than — the known Tier 2 #3 (Map-clone-per-drag). **Open question:**
is this the real bottleneck, or is the Map clone / subscriber fan-out the dominant cost? And is
debouncing the localStorage write safe w.r.t. `beforeunload` flush semantics? Verdict pending — §3.2.

### 2.3 Cleanup: additional dead code + prod logging not in the 2026-06-23 sweep — 🔍 RE-VERIFYING (§3.3)

The prior sweep removed ~480 LOC but the 2026-06-29 sweep found *more* candidates (and re-flagged
one debunked item). Because `mergeWithPersisted` was a false positive before, **each item must be
re-verified against current source before deletion.** Candidates under verification:
- `COLORS` export (`lib/colors.js`) — imported once, no property dereferenced anywhere.
- `renderBoundaryLabels` (`dayRange/adrBoundaryRenderer.js`) — exported no-op body `return;`.
- `fxBasketConfig` named export (`fxBasket/fxBasketConfig.js:29`) — 0 importers.
- Re-exports with 0 external importers: `formatPrice` (`dayRange/dayRangeCore.js:93`),
  `snapToBar`/`formatBoundaryLabel`/`generateTicks` (`chart/xAxisCustom.js:23`),
  `getFormatter` export (`chart/dateFormatter.js:14`), `detectClusters` export
  (`fxBasket/fxBasketElements.js:170`).
- Unused `export` keywords: `logout`, `clearStore`, `clearAllStores`, `getStorageKey`,
  `computeMiniMarketProfile` (and `mergeWithPersisted` — **already debunked, drop**).
- Unused import: `get` (`stores/authStore.js:7`).
- Prod logging not gated by `import.meta.env.DEV`: ~11 `console.log` (+ emoji) across
  `Workspace.svelte`, `workspace.js`, `fxBasketStateMachine.js`, `fxBasketSubscription.js`,
  `dailyResetHandler.js`; `console.error` used for expected (non-error) conditions
  (`fxBasketStateMachine.js:88-93`); hardcoded dev ports in WS-URL logic
  (`lib/displayDataProcessor.js:14-16`).

**Approved category** (user): dead-code removal + naming. But executed **per-item-verified**.

### 2.4 Naming (approved, low-risk) — ✅ APPROVED

- `marketProfileMerger.js` (renamed from `marketProfileHandler.js` — it isn't a handler, just one pure
  fn `mergeProfileUpdate`); `markerActions.js` (renamed from `markerStore.js` — it isn't a store,
  actions only, state lives in `displayStore`). Matches the existing `displayActions` convention.
- `getConfig` exported from **two** unrelated modules (`dayRangeConfig.js` + `fxBasketConfig.js`) →
  qualify (`getDayRangeConfig` / `getFxBasketConfig`).
- `formatPriceWithPipPosition` is commented "DEPRECATED legacy alias" but is the *primary* call-site
  name in 2 files → pick one canonical name; remove the contradiction.

---

## 3. Investigation verdicts

| § | Target | Verdict |
|---|---|---|
| 3.1 | Dexie schema duplication | **NOT a bug** (severity LOW). Original finding's assumption was wrong. Optional hygiene fix. |
| 3.2 | Perf hot-paths | One **NEW** actionable fix (localStorage-per-drag, ~5 lines); rest is known/deferred/dropped. |
| 3.3 | Dead-code + prod-noise | 8 verified-safe items; `mergeWithPersisted` re-confirmed DEAD (prior audit was wrong); dev-port "leak" is not a defect. |
| 3.4 | ChartDisplay + theme | ChartDisplay: ONE safe presentational extraction (key-bindings, ~80 LOC); drawing state load-bearing. Theme: leave as-is (corrected rationale). |

### 3.1 Dexie duplication — NOT a data-loss bug (debunked)

The original finding assumed the two instances "race" on the upgrade. **Dexie doesn't work that way**
(verified against installed Dexie 4.4.2 source): each version's upgrade runs **exactly once**, on the
first open that bumps the on-disk version. `drawingStore.js`'s instance carries the `.upgrade()`
callback, so the v3 upgrade is guaranteed to run regardless of open order. `authStore`'s instance is
**not dead** — it's the login-time migration reader (`collectLocalData()` → DL-007 first-login
upload), opened to read drawings before `drawingStore` loads. The missing callback was an accidental
omission in commit `053a555`, not a design choice. Worst realistic case: a handful of ancient
pre-`overlayId` drawings survive a v3 migration run via the auth path — which the upgrade callback's
own comment says is acceptable to lose.

**Action:** LOW-priority hygiene only. Either export a `getDrawingsDb()`/`readAllDrawingsForMigration()`
from `drawingStore.js` and read through it, or add the symmetric `.upgrade()` callback to `authStore`
as a zero-risk stopgap. **Not a reliability emergency.** (This is genuinely NEW — not in prior audits.)

### 3.2 Perf — one new fix; the root cause is upstream of all of it

- **localStorage-per-drag (`workspace.js` `syncToStorage`) — NEW, FIX NOW.** Verified: subscribed to
  `displayStore` (`:309`), writes `localStorage.setItem` synchronously every change, only the server
  fetch is debounced. Mitigated by 10 px grid-snap (`interactSetup.js:23`) so it's not literally
  60 fps, but it stacks on the known Tier 2 #3 Map-clone. **Safe fix (~5 lines):** debounce the
  `localStorage.setItem` exactly like the server fetch, but keep `_lastWorkspaceData = data` immediate
  so the `beforeunload` beacon still works. No reactivity/persistence-semantics change.
- **PriceTicker per-tick mini-profile (`:169-184`) — KNOWN = Tier 2 #4.** Fold into the existing
  runtime-verification task; apply the DisplayCanvas `scheduleRender()` rAF gate in that pass.
- **~13 `$:` blocks per tick — DROP (theoretical).** Svelte no-ops DOM patches on unchanged
  primitives; the only real cost in those blocks is the `:169` canvas redraw (= #4).
- **Eager bundle / static ChartDisplay import — DEFERRED.** Bundle ~622 kB, no new trigger.

**Root-cause note (out of scope here):** `marketDataStore.js:60-76` emits a brand-new spread object
every tick, which is the common driver behind Tier 2 #1 (fixed via DisplayCanvas rAF) and #4 (still
open). A future pass that gates that spread on "did price-relevant fields change" would retire
several items at once.

### 3.3 Dead-code + prod-noise — verified list

**Confirmed DO-NOT-TOUCH** (E2E-load-bearing, 30+ spec files depend on them): `window.workspaceStore`,
`window.displayStore`, `window.workspaceActions`, `window.workspacePersistence`, `window.fxBasketDebug`.

**Safe to execute now (verified 0 prod + 0 test callers):**
| file:line | action |
|---|---|
| `fxBasket/fxBasketConfig.js:29` `fxBasketConfig` | delete the export line |
| `chart/dateFormatter.js:14` `getFormatter` | drop `export` keyword |
| `fxBasket/fxBasketElements.js:170` `detectClusters` | drop `export` keyword |
| `stores/authStore.js:178` `logout` | drop `export` keyword |
| `stores/marketDataStore.js:193,206` `clearStore`,`clearAllStores` | drop `export` keyword |
| `stores/markerStore.js:92` `getStorageKey` | drop `export` keyword (keep fn — used internally) |
| `stores/markerStore.js:155` `mergeWithPersisted` | **delete the function** (see correction below) |
| `stores/authStore.js:7` unused `get` import | remove from import |

**Needs decision:** `COLORS` unused *import binding* in `dayRangeElements.js:4` (drop the import,
leave the export); `renderBoundaryLabels` (`adrBoundaryRenderer.js:20`) is an **intentional API-compat
no-op stub** — leave; `formatPrice` re-export (`dayRangeCore.js:93`) safe to delete; ~~`xAxisCustom.js:23`
re-exports are test-imported — rewire the unit test first or leave~~ — **done in Batch B4** (re-export
deleted; test rewired to import from `xAxisTickGenerator.js`); `computeMiniMarketProfile` is a
**FALSE POSITIVE** (has a test importer) — leave.

**Prod logging:** dev-port detection (`displayDataProcessor.js:14-16`) is **not a defect** — it's a
fallback reached only when `VITE_BACKEND_URL` is unset; leave. The ~ungated `console.log` (+ emoji)
rows: wrap with `if (import.meta.env.DEV)`. The `console.error` rows used for *expected* conditions
(`fxBasketStateMachine.js:91-93`, several in `workspace.js`) should become `console.warn` — **this
also protects `tests/e2e/console-check.spec.js:49` which asserts zero `console.error` during init.**

### 3.4 ChartDisplay + theme — prior decisions confirmed (with two rationale corrections)

**ChartDisplay.** The consolidation (`b2f4e5f`) was driven by **single-ownership / race-safety /
cancellability / eliminating duplicated teardown** — *not* "efficiency" (that recollection doesn't
match the design doc; the only perf argument in the doc is about the in-memory `overlayMeta` cache vs
async DB reads, a different decision). The doc warns against fragmenting **drawing-state ownership**,
not against splitting presentational pieces. **Verdict:** the drawing-coordination wiring is
load-bearing and must stay cohesive, but the **~80-line key-bindings block (`registerChartKeys`,
`ChartDisplay.svelte:264-347`) is purely presentational** — every handler is a thin delegate to the
coordinator's public API. Extracting it to `chartKeyBindings.js` mirrors the approved
`workspaceKeyboardShortcuts.js` precedent and touches no drawing internals. Optional; leaving the file
whole is also defensible.

**Theme.** The "supposedly no other method" recollection is **false** — verified against
`node_modules/klinecharts/dist/index.d.ts:620,841` (klinecharts 9.8.12): `setStyles`/`Options.styles`
accept `string | DeepPartial<Styles>`, so a `buildTheme(colors)` factory is API-legal. The two-file
split was just how it was written (`2bda815` then `600921d`), not a documented constraint. **Verdict:
leave as-is anyway** — merging has no runtime/bundle/behavioral benefit and the palettes diverge
structurally enough that the DRY win is modest. The reassessment §4 deferral stands; the real trigger
to introduce `buildTheme()` is adding a third theme or token-driven theming.

---

## 4. Corrections to the prior record (worth noting)

1. **`markerStore.mergeWithPersisted` is actually dead.** The 2026-06-23 audit's "has callers"
   verdict was a **false negative** — it trusted a misleading E2E comment
   (`server-persistence.spec.js:612`, which describes an approach the test did *not* take) over actual
   call-site evidence. Re-verified: 0 callers anywhere. The 2026-06-29 sweep was right; the function
   is safe to delete.
2. **Theme split rationale was misremembered.** Not "klinecharts forces two files" — a factory is
   API-legal. The split persists because merging has no benefit, not because it's impossible.
3. **ChartDisplay consolidation was about ownership/races, not efficiency.** The user-facing
   consequence (don't re-decompose the drawing layer) is correct; the reason is different from the
   "less efficient" recollection.

---

## 5. Standing constraints (carry forward)

- **`window.*` globals are E2E load-bearing.** Never DEV-gate `workspaceStore` / `workspaceActions` /
  `fxBasketDebug` / `displayStore` without first moving the E2E dependencies off them.
- **Structural findings need prior-art check.** Before any "decompose/merge/extract" recommendation,
  grep `docs/frontend-*.md` and `git log` — most have been considered.
- **Dead-code claims need per-item verification — in *both* directions.** The 2026-06-23 sweep called
  `mergeWithPersisted` live (wrong — it's dead, see §4), and the 2026-06-29 sweep called
  `computeMiniMarketProfile` dead (wrong — it has a test importer). Lesson: never bulk-delete on
  agent say-so; grep callers *and* test importers each time.
- **`console.error` is asserted against by `tests/e2e/console-check.spec.js:49`** (zero errors during
  init). Any change that adds/keeps an error-level log on an *expected* path must use `console.warn`.
- **Reassessment doc has known drift** (flagged in frontend-audit §"Doc drift"): still references
  three.js / 1.1 MB bundle. Out of scope here; a separate doc-sync pass can reconcile.

---

## 6. Execution batch & status (2026-06-29)

Approved cleanup split into two passes by risk class. **Batch A** is in flight (low-risk, no
cross-file renames). **Batch B** (file renames) is deferred to its own pass because it cascades into
`docs/frontend-architecture-reassessment-2026-06.md`, `stores/CLAUDE.md`, and import sites, and
deserves isolated verification.

### Batch A — executed 2026-06-29 (deletions + dev-gating + one debounce)

All 14 items done. Verified: `npm run test:unit` → **482/482 pass**; `npm run build` succeeds
(~619 kB); 0 dangling references to any removed/dropped symbol. Changes uncommitted in working tree.

| # | Change | File:line | Status |
|---|---|---|---|
| A1 | Delete `fxBasketConfig` export line | `lib/fxBasket/fxBasketConfig.js:29` | ✅ done |
| A2 | Drop `export` on `getFormatter` | `lib/chart/dateFormatter.js:14` | ✅ done |
| A3 | Drop `export` on `detectClusters` | `lib/fxBasket/fxBasketElements.js:170` | ✅ done |
| A4 | Drop `export` on `logout` | `stores/authStore.js:178` | ✅ done |
| A5 | Drop `export` on `clearStore`,`clearAllStores` | `stores/marketDataStore.js:193,206` | ✅ done |
| A6 | Drop `export` on `getStorageKey` (keep fn — internal use) | `stores/markerStore.js:92` | ✅ done |
| A7 | **Delete `mergeWithPersisted` function** | `stores/markerStore.js:155` | ✅ done |
| A8 | Remove unused `get` import | `stores/authStore.js:7` | ✅ done |
| A9 | Drop unused `COLORS` import binding | `lib/dayRange/dayRangeElements.js:4` | ✅ done |
| A10 | Delete `formatPrice` re-export | `lib/dayRange/dayRangeCore.js:93` | ✅ done |
| A11 | Debounce `localStorage.setItem` in `syncToStorage` (keep `_lastWorkspaceData` immediate for `beforeunload`) | `stores/workspace.js` (~277-305) | ✅ done |
| A12 | Dev-gate ungated `console.log` (+ emoji) with `import.meta.env.DEV` | `Workspace.svelte`, `workspace.js`, `fxBasketStateMachine.js`, `fxBasketSubscription.js`, `dailyResetHandler.js`, `authStore.js` | ✅ done |
| A13 | Convert expected-condition `console.error` → `console.warn` | `fxBasketStateMachine.js:91-93`; `workspace.js` drawing-restore paths | ✅ done |
| A14 | Resolve `formatPriceWithPipPosition` "DEPRECATED alias" contradiction (in-file) | `lib/priceFormat.js:14` | ✅ done |

**Exclusions (do not touch in this batch):** `window.*` globals (E2E); `renderBoundaryLabels`
(intentional no-op stub); `computeMiniMarketProfile` (false positive — test-imported);
`xAxisCustom.js:23` re-exports (test-imported — needs test rewire, defer); dev-port detection in
`displayDataProcessor.js` (not a defect).

**Verification gate:** build clean; `npm run test:unit` green; `grep` confirms 0 dangling references
to any removed/renamed symbol; `beforeunload` persistence semantics preserved (A11).

### Batch B — executed 2026-06-29 (cross-file renames + re-export cleanup)

B2/B3/B4 completed (file renames via `git mv` — exported symbol names unchanged, only import paths rewired).
B1 (`getConfig` qualify) deliberately **skipped** — out of scope for this pass.

| # | Change | Files touched | Status |
|---|---|---|---|
| B1 | `getConfig` → `getDayRangeConfig` / `getFxBasketConfig` | — | ⏭️ skipped |
| B2 | `marketProfileHandler.js` → `marketProfileMerger.js` | rename + `marketDataStore.js`, `__tests__/marketProfileHandler.test.js`, reassessment §2.4, assessment, stores/CLAUDE.md | ✅ done |
| B3 | `markerStore.js` → `markerActions.js` | rename + `PriceMarkerManager.svelte`, `priceMarkerDropdown.js`, `priceMarkerInteraction.js`, `workspace.js`, assessment, reassessment §2.3, audit, orchestrator-reassessment, stores/CLAUDE.md | ✅ done |
| B4 | `xAxisCustom.js:23` re-export cleanup | delete re-export + rewire `xAxisCustom.test.js` to import from `xAxisTickGenerator.js` | ✅ done |

Each Batch B item updated the referencing docs in the same change (doc-sync).
