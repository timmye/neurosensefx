# Frontend Audit — Dead Code, Inefficiencies & UX Debt (2026-06-23)

**Purpose:** Consolidated inventory of frontend (`src/`) dead code, runtime inefficiencies, and UX/interface problems, with `file:line` evidence. Produced as a follow-up to removing the active-background feature (`BackgroundShader` / `three.js` / `backgroundStore`).
**Scope:** Frontend only (`src/`). Excludes `backtester/`, `src/dist/`, and test files.
**Companion doc:** `docs/frontend-architecture-reassessment-2026-06.md` (current architecture state; several items below are reconciled against its "Deferred" list).
**Method:** Parallel `general-purpose` agent sweeps (dead code, inefficiencies/leaks, UX) + direct verification of every headline claim. Agent claims that failed verification are noted as debunked.

---

## Verification discipline (read first)

Findings are tagged:
- **✅ verified** — confirmed by direct grep/read in this audit.
- **🕐 runtime** — static-analysis finding; the reassessment doc's own rule applies: *"operational/lifecycle findings should be verified at runtime before committing."*

**Debunked agent claims (not acted on):**
- *"Two divergent symbol normalizers (`formatSymbol` vs `normalizeSymbol`) — consolidation needed."* **False.** They are different functions with different jobs: `normalizeSymbol` (`subscriptionManager.js:13`) is a canonical subscription-key matcher mirroring the backend; `formatSymbol` (`displayDataProcessor.js:34`) is a per-source display formatter. This branch's HEAD commit already canonicalized keys.
- *"`markerStore.mergeWithPersisted` is dead."* **False** — it has a caller (2 refs).
- *"`FxBasketDisplay` leaks its freshness interval."* **False** — cleared in `onDestroy` (`:61`).

---

## Tier 1 — Dead code (safe deletions)

All ✅ verified. ~480 LOC total.

| # | What | Evidence | ~LOC |
|---|------|----------|------|
| 1 | **Volatility cluster** — orphaned by the background removal. `volatilityStore` is write-only (4 `.set()` calls, 0 readers); `fxBasketVolatility.js` (init/compute/reset) feeds only that store. | `volatilityStore.js`; `fxBasketSubscription.js:8,9,68,71,79,95,110,112`; `fxBasketVolatility.js` | ~130 |
| 2 | **`ChartHeader.svelte`** — orphaned component, 0 references (sibling `DisplayHeader` is live). | `grep ChartHeader src/` → 0 | 234 |
| 3 | **`dayRangeElements.js`** — 4 dead exports (`drawAxis`, `drawCenterLine`, `drawBoundaries`, `drawPriceMarkers`) + 2 dead helpers (`createPriceArray`, `renderPriceMarker`); only `drawPriceMarker` (singular) is live. | 0 external refs each | ~75 |
| 4 | **`fxBasketConfig.js`** — `CURRENCY_COLORS`, `ANCHOR_CONFIG`, `STATE_CONFIG` (same orphaned cluster as #1). | 0 imports | ~30 |
| 5 | **`priceMarkers.js`** — `filterMarkersByDisplay`, `removeMarkerById`, `getMarkersByPriceRange` (0 callers). | 1 ref = def only | ~25 |
| 6 | **`debugCanvasState()`** in `chartResize.js` — 0 callers. | grep → 0 | ~30 |
| 7 | **`DisplayCanvas.renderFxBasket()`** — dead method; live renderer is `fxBasketOrchestrator.renderFxBasket`. | verified | ~10 |
| 8 | **`workspace.js:355`** — re-export of `displayStore`/`displayActions`; 0 importers from workspace.js (internal use is legitimate). | verified | 1 |
| 9 | Misc dead: `fxBasketCalculations.hasMinimumDailyOpens`, `adrBoundaryCalculations.shouldShowReferenceLines`. Unused imports: `drawingCoordinator:derived`, `priceMarkerRenderer:{MARKER_TYPES, formatPriceForDisplay}`, `percentageMarkerRenderer:calculateMaxAdrPercentage`, `Workspace.svelte:displayActions`, `ChartToolbar.svelte:resolvedTimezone`. | verified | ~20 |

## Tier 2 — Runtime inefficiencies (verify at runtime, then fix)

| # | Tag | What | Evidence |
|---|-----|------|----------|
| 1 | ✅+🕐 | **DisplayCanvas full redraw on every tick × every display** — `marketDataStore` returns a new spread object per tick (no equality check) → the force-read-all-deps reactive block fires `render()` every tick. Root cause that multiplies #2/#4/#6. | `DisplayCanvas.svelte:83-101`; `marketDataStore.js:60-76` |
| 2 | 🕐 | priceMarkerInteraction mousemove → full redraw + `getBoundingClientRect`/`calculateAdaptiveScale`/`createPriceScale` recompute every move. | `priceMarkerInteraction.js:87-114` |
| 3 | 🕐 | `displayStore.updatePosition/updateSize` clones entire `Map` every drag/resize frame → re-triggers all `$displayStore` subscribers each frame. | `displayStore.js:27-37` |
| 4 | 🕐 | PriceTicker mini-profile re-rendered every tick (profile/scale don't change per-tick). | `PriceTicker.svelte:169-184` |
| 6 | 🕐 | `displayCanvasRenderer` recomputes adaptive scale 3× per render (dayRange, markers, delta). | `displayCanvasRenderer.js:95-97` |

## Tier 2b — Small resource leaks (low risk, easy fixes)

| # | Tag | What | Evidence |
|---|-----|------|----------|
| 5 | 🕐 | `PriceMarkerManager.svelte` — `setTimeout(…,100)` in onMount has no handle/`clearTimeout`; unmount <100ms builds interaction on a dead canvas. | `PriceMarkerManager.svelte:35-61` |
| 7 | 🕐 | `DisplayHeader` `hideTimeout` never cleared on unmount. | `DisplayHeader.svelte:15,25` |
| 8 | 🕐 | `App.svelte` top-level `authStore.subscribe` never unsubscribed (bounded — root component). | `App.svelte:12-15` |
| 9 | 🕐 | `connectionManager` `visibilitychange` listener added in constructor, not removed in `disconnect()` (singleton-bounded). | `connectionManager.js:23` |

## Tier 3 — UX / interfaces

| # | Sev | Tag | What | Evidence |
|---|-----|-----|------|----------|
| 1 | HIGH | ✅ | **Chart silently fails on load/error.** ChartDisplay subscribes to the bar store but never reads `state`/`error` — stuck load or fetch failure → blank chart, no feedback. | `chartDataStore.js:38` (exposes state/error); 0 reads in `ChartDisplay.svelte` |
| 2 | MED | ✅ | Chart has no connection indicator (tickers/baskets show status; chart just freezes on backend drop). | no status UI in `ChartDisplay.svelte` |
| 3 | MED | ✅ | Help/shortcut mismatches: `Alt+M` shown as global but needs focused display; `Backspace` (delete) + `Ctrl+Shift+Z` (redo) undocumented. | `KeyboardShortcutsHelp.svelte:44,78`; `ChartDisplay.svelte:311,336` |
| 4 | MED | ✅ | PriceTicker close/refresh buttons reveal only on `:hover` — keyboard users can't see them (no `:focus-within`). | `PriceTicker.svelte:517-518` |
| 5 | MED | ✅ | Modals ignore theme — `KeyboardShortcutsHelp` + `WorkspaceModal` hardcoded dark-purple, jarring in light mode. | `:119-127`; `WorkspaceModal.svelte:104-111` |
| 6 | MED | ✅ | QuickRuler is mouse-only (right-drag), no keyboard/toolbar equivalent. | `QuickRuler.svelte:33,51` |
| 7 | MED | ✅ | OverlayContextMenu has no keyboard invocation (no Shift+F10) and missing `role="menu"`/`menuitem`. | `OverlayContextMenu.svelte:51-53` |
| 8 | MED | ✅ | Modals don't trap/restore focus properly (focus escapes; no restore on close). | `KeyboardShortcutsHelp.svelte:6`; `WorkspaceModal.svelte:75` |
| — | LOW | ✅ | price-flash cyan/magenta color-only (color-blind unfriendly); ChartToolbar buttons `title`-only, no `aria-label`; z-index magic numbers; `PriceTicker` 37.5px magic width; duplicated `.resize-handle`/`.icon-btn` CSS. | various |

## Tier 4 — Reconciled against reassessment doc (real but explicitly deferred)

Flagging that these were checked, **not** re-recommending (the reassessment doc deferred them with rationale): chart theme file merge (`chartThemeLight.js`/`chartThemeDark.js`, 443+438 LOC) · code-splitting/lazy-loading · centralized error handling/toasts · shared modal base · chart-config consolidation (8 files) · FX-basket Map cleanup.

## Production noise

- `forceCanvasDPRRefresh` runs in production and logs ungated `[CANVAS-DPR]` (`chartResize.js:115`); `chartBarSpace.js:79` logs `[applyBarSpace]`. Dev-gate or remove.
- `window.*` debug globals (`workspaceStore`, `workspaceActions`, `fxBasketDebug`, `displayStore`) — intentional; the E2E suite depends on them.

## Doc drift

`docs/frontend-architecture-reassessment-2026-06.md` is now stale after the background removal: still says "three.js for background shader" (L11), "three.js used only in `BackgroundShader.svelte`" (L26), lists "three.js removal" as deferred (L149). Bundle is now ~622 kB (was ~1.1 MB).

## Verified clean (trust-builders)

`FxBasketDisplay` (not a leak) · symbol normalizers (not duplicated) · `LoginForm` (a11y clean) · `keyManager` (no binding conflicts) · timer/rAF cleanups in `ChartDisplay`/`chartSubscriptions`/`connectionHandler`/`drawingStore` · all `JSON.stringify/parse` is in persistence/WS-send paths, not per-tick.

---

## Execution plan (this audit) — status

1. **Dead-code sweep (Tier 1)** — ✅ DONE. Agent-executed, all items removed; build + 482/482 unit tests pass; 0 dangling references. ~480 LOC removed (2 modules dropped: 161→159). Notable: `chartBarSpace` log was already dev-gated (no-op). Items #1/#4 (orphaned by the background removal) are grouped with that change in the working tree.
2. **DisplayCanvas perf fix (Tier 2 #1 + #6)** — ✅ DONE (statically). rAF-coalesced the reactive render (`DisplayCanvas.svelte` `scheduleRender()`, synchronous init/resize paths preserved, `onDestroy` cancels) + memoized the price scale once per render (`computePriceScale` in `displayCanvasRenderer.js`, shared across marker/delta paths). Build + 482/482 tests pass.
   - **Runtime verification still pending** (needs live backend stack + several displays): confirm (a) visuals are pixel-identical — the price-delta path now scales from full `data` instead of a subset, and (b) per-tick full-canvas repaints are gone. The rAF change is build+reasoning-validated only (Svelte components aren't unit-tested here).
3. UX items (Tier 3) — held for separate prioritization; ChartDisplay load/error feedback (#1) recommended first.
