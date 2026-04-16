# Chart Drawing System Fix Plan

**Source**: docs/chart/chart-drawing-system-audit.md (43 findings, 2026-04-15)
**Scope**: Crystal Clarity compliance — < 120 lines/file, < 15 lines/function, Framework-First, Single Source of Truth
**Constraint**: Every delivered file must comply. Svelte components with irreducible template+style overhead are excepted at documented floors.

---

## Architecture Overview

### Module Map (26 new modules + 11 modified files)

```
CHART DISPLAY (942 -> ~196 lines)
  ├── chartAxisLabels.js          (~35)  formatAxisLabel
  ├── chartBarSpace.js            (~45)  getBarSpace, applyBarSpace
  ├── chartOverlayState.js        (~20)  overlay state factory
  ├── chartOverlayCallbacks.js    (~50)  selection, context menu
  ├── chartOverlayRestore.js      (~65)  restoreDrawings
  ├── chartOverlayCommands.js     (~60)  create/delete/lock/clear
  ├── chartDataLoader.js          (~95)  loadChartData, subscriptions
  ├── chartChangeHandlers.js      (~55)  symbol/source/resolution/window
  └── chartLifecycle.js           (~95)  mountChart, destroyChart

CHART DATA STORE (468 -> ~116 lines)
  ├── barMerge.js                 (~25)  mergeAndDedupBars, upsertBar
  ├── barCache.js                 (~70)  IndexedDB cache ops
  ├── candleMessages.js           (~65)  handleCandleUpdate/History
  ├── candleTransport.js          (~70)  WebSocket send/subscribe
  ├── loadingTimers.js            (~25)  timeout management
  └── cacheFreshness.js           (~18)  staleness check

X-AXIS (315 -> ~35 lines)
  ├── xAxisCalendar.js            (~95)  boundary alignment, labels
  └── xAxisTickEngine.js          (~80)  tick generation, dedup

CUSTOM OVERLAYS (432 -> ~10 lines)
  ├── overlayIndicators.js        (~70)  watermark, AD
  ├── overlayShapes.js            (~90)  rect, circle, polygon, arc, arrow
  ├── overlayMeasurements.js      (~90)  ray line, annotation, tag, ruler
  └── overlayFibonacci.js         (~65)  fibonacci, parallel lines

CHART CONFIG (241 -> ~70 lines)
  ├── chartConstants.js           (~85)  resolution/window/barSpace tables
  └── chartTimeWindows.js         (~50)  calendar alignment functions

QUICK RULER (229 -> ~130 lines, floor)
  ├── quickRulerOverlays.js       (~45)  overlay create/remove
  └── quickRulerPositioning.js    (~25)  pixel offset, style calc

CHART TOOLBAR (382 -> ~312 lines, floor)
  └── drawingToolActions.js       (~60)  tool click, clear handlers

DRAWING COMMANDS (133 -> ~107 lines)
  └── deleteDrawingCommand.js     (~27)  DeleteDrawingCommand class
```

### Dependency Graph (no circular dependencies)

```
LEAF MODULES (zero project imports):
  chartConfig.js, styleUtils.js, barMerge.js, loadingTimers.js,
  deleteDrawingCommand.js, chartConstants.js

TIER 2 (import only from leaves):
  chartAxisLabels -> chartConfig
  chartBarSpace -> chartConfig
  chartOverlayState -> svelte/store
  barCache -> dexie, chartConstants
  cacheFreshness -> chartConstants
  xAxisCalendar -> (none)
  xAxisTickEngine -> xAxisCalendar
  chartTimeWindows -> chartConstants

TIER 3 (import from tiers 1-2):
  chartOverlayCallbacks -> chartOverlayState, drawingStore
  candleMessages -> barMerge, marketDataStore
  candleTransport -> connectionManager
  overlayIndicators, overlayShapes, overlayMeasurements, overlayFibonacci -> klinecharts
  drawingToolActions -> drawingCommands

TIER 4 (import from tiers 1-3):
  chartOverlayRestore -> drawingStore, styleUtils, chartOverlayCallbacks
  chartOverlayCommands -> drawingCommands, drawingStore, chartOverlayCallbacks
  chartDataLoader -> chartDataStore, marketDataStore, chartConfig, chartBarSpace
  chartChangeHandlers -> chartDataStore, xAxisCustom, workspace, chartDataLoader, chartOverlayRestore

TIER 5 (orchestrators):
  chartLifecycle -> klinecharts, xAxisCustom, chartThemeLight, interactSetup, chartBarSpace, chartDataLoader, chartOverlayRestore, chartDataStore
  chartDataStore.js -> all chart/ modules (orchestrator)
  xAxisCustom.js -> xAxisCalendar, xAxisTickEngine (thin shell)

ROOT:
  ChartDisplay.svelte -> all chart/ modules
```

### Svelte Component Floors

Some Svelte components cannot reach 120 lines due to irreducible template + style overhead:

| Component | Template | Style | Script Budget | Floor | Strategy |
|-----------|----------|-------|---------------|-------|----------|
| ChartDisplay.svelte | ~40 | ~56 | ~100 | ~196 | Extract all script logic; accept template+style as fixed |
| QuickRuler.svelte | ~48 | 0 | ~82 | ~130 | Extract overlay/positioning logic |
| ChartToolbar.svelte | ~85 | ~157 | ~70 | ~312 | Extract drawing tool handlers |

All individual functions in these components will be under 15 lines.

---

## Phase 1: Correctness Fixes (no structural change)

### Milestone 1.1: API fix + dead code removal

**Finding #10** — Remove invalid `isCheckEvent: false`
- File: `customOverlays.js:429`
- Change: Remove `isCheckEvent: false` from fibonacciLine text figure.

**Finding #3** — Remove `pinnedOverlayMap` dead code
- File: `ChartDisplay.svelte:48, 264, 340, 492, 514, 540`
- Change: Remove declaration and all `.set()`/`.clear()` calls. `overlayPinnedMap` (line 49) is separate and stays.

### Milestone 1.2: handleClearDrawings completeness

**Finding #2** — Add overlay removal and map clears
- File: `ChartDisplay.svelte:449-452`
- Change:
  ```js
  async function handleClearDrawings() {
    if (chart) chart.removeOverlay();
    await drawingStore.clearAll(currentSymbol, currentResolution);
    commandStack.clear();
    overlayDbIdMap.clear();
    overlayPinnedMap.clear();
  }
  ```
- Note: `chart.removeOverlay()` only removes user-created overlays. Watermark is an indicator, not an overlay.

### Milestone 1.3: DeleteDrawingCommand.undo persistence

**Finding #1** — Undo must re-persist to IndexedDB
- File: `drawingCommands.js:123-132`
- Approach: Pass `onRestoreMaps` callback into `DeleteDrawingCommand` constructor.
- Implementation:
  1. Add `{ onRestoreMaps: (dbId, pinned) => void }` to constructor.
  2. Make `undo()` async — `await this.store.save(...)` then `this.onRestoreMaps(newDbId, pinned)`.
  3. Make `DrawingCommandStack.undo()` async — `async undo() { const cmd = this.undoStack.pop(); if (cmd) { await cmd.undo(); this.redoStack.push(cmd); this._notify(); } }`.
  4. Caller at ChartDisplay.svelte becomes `await commandStack.undo()`.
  5. Add try/catch in undo: if save fails, remove the re-created overlay to match failed persistence.
- Verified: `drawingStore.save()` (line 19) returns Dexie auto-incremented ID.

### Milestone 1.4: Replace subscribe()() anti-pattern

**Finding #9** — chartDataStore.js:166-167
- Change: `import { get } from 'svelte/store'; const current = get(barStore);`

**Finding #15** — ChartDisplay.svelte:162-166
- Change: Same `get()` pattern for `applyPricePrecision`.

### Milestone 1.5: ChartToolbar timer leak

**Finding #42** — Clear hold timer on destroy
- Change: Add `onDestroy(() => clearTimeout(clearHoldTimer));`

---

## Phase 2: Lifecycle Leak Fixes

### Milestone 2.1: Subscription cleanup in ChartDisplay

**Finding #4** — Orphaned onZoom/onVisibleRangeChange handlers
- Store handler function refs at component scope. Call `chart.unsubscribeAction(type, handler)` in `onDestroy` and at top of each change handler.
- Note: `subscribeAction` returns void. Store the handler itself; pass to `unsubscribeAction`. Omitting callback clears ALL handlers for that type (useful for teardown).

**Finding #5** — Orphaned onDataReady handler on rapid symbol switch
- Store `onDataReady` handler ref at component scope. Unsubscribe prior handler at top of `loadChartData` before subscribing new one.

**Finding #14** — Anonymous mousedown listener never removed
- Store handler in variable; `chartContainer.removeEventListener('mousedown', handler)` in `onDestroy`.

---

## Phase 3: Performance + In-File Decomposition

### Milestone 3.1: chartDataStore function decomposition

**Finding #7** — Avoid full array copy on every tick
- Decompose `handleCandleUpdate` into sub-functions under 15 lines:
  - `findExistingBarIndex(bars, bar)` — optimistic last-bar check + findIndex fallback (10 lines)
  - `updateExistingBar(bars, bar, existingIndex)` — in-place mutation + return new state (8 lines)
  - `appendNewBar(bars, bar, isBarClose)` — copy + push + conditional sort (10 lines)
- Note: In-place mutation of `bars[existingIndex]` is safe because `store.update()` is synchronous and the spread creates a new top-level object for Svelte reactivity.

**Finding #8** — O(n log n) merge in handleCandleHistory
- Extract `mergeAndDedupBars(existing, incoming)` — Map-based O(1) dedup, single sort (10 lines).

**Finding #16** — Skip sort when appending newest bar
- Inside `appendNewBar`: `if (bars.length >= 2 && bars[bars.length - 2].timestamp > bar.timestamp) bars.sort(...)`.

**Finding #17** — Optimistic last-bar check
- Inside `findExistingBarIndex`: check `bars[bars.length - 1].timestamp === bar.timestamp` before `findIndex`.

**Finding #31** — Hoist periodToResolution to module scope
- Move map object outside function as module-level constant.

**Finding #32** — Remove redundant count query in evictStaleCache
- Remove `.count()` query; check `oldest.length === 0` directly.

**Finding #33** — Compute storeKey once
- Assign `const key = storeKey(symbol, resolution)` once at top of `loadHistoricalBars`.

### Milestone 3.2: QuickRuler performance

**Finding #6** — subscribe/unsubscribe on every mousemove
- Subscribe once in `bindListeners()`, store in local variable, unsubscribe in `unbindListeners()`.

**Finding #24** — rAF batching on mousemove
- Wrap mousemove body in `requestAnimationFrame`.

**Finding #25** — Cache getBoundingClientRect
- Cache on mousedown, update on resize.

### Milestone 3.3: xAxisCustom dedup

**Finding #11** — O(n^2) dedup via find()
- Replace `deduped.find(d => d.snappedTs === c.snappedTs)` with `Set` of snapped timestamps.

**Finding #39** — Remove redundant re-sort after dedup
- Remove sort call at line 241; order already established.

### Milestone 3.4: Minor cleanups

**Finding #35** — Extract `resolveDbId(state, overlayId)` helper (6 lines).

**Finding #37** — Guard dev-only logging with `if (import.meta.env.DEV)`.

**Finding #41** — Move `DRAWING_TOOLS` to module scope.

**Finding #43** — Gate `window.drawingStore` behind `if (import.meta.env.DEV)`.

### Milestone 3.5: drawingStore in-file decomposition

**Finding (load function >15 lines)** — Decompose `load` (22 lines):
- `loadFromServer(symbol, resolution)` — server fetch + IndexedDB replacement (14 lines)
- `load` — calls `loadFromServer`, falls back to local (8 lines)

**Finding (_debouncedServerSync >15 lines)** — Decompose:
- `syncToServer(symbol, resolution)` — fetch call (10 lines)
- `_debouncedServerSync` — timer management (10 lines)

---

## Phase 4: Structural Decomposition

> Phases 1-3 fix correctness and decompose functions in-place.
> Phase 4 extracts modules to achieve < 120 lines/file compliance.

### Phase 4A: ChartDisplay.svelte (942 -> ~196 lines)

#### Milestone 4A.1: Extract chartOverlayState.js (~20 lines)
- **Path**: `src/lib/chart/chartOverlayState.js`
- **Exports**: `createOverlayState()` factory returning `{ selectedOverlayId, overlayDbIdMap, overlayPinnedMap, isOverlayLocked, isOverlayPinned, contextMenu }`
- **Pattern**: Factory function. No imports from project code (only `svelte/store`).
- **Reduces ChartDisplay by**: ~8 variable declarations collapsed to 1

#### Milestone 4A.2: Extract chartAxisLabels.js (~35 lines)
- **Path**: `src/lib/chart/chartAxisLabels.js`
- **Exports**: `formatAxisLabel(dateTimeFormat, timestamp, format, type, currentWindow)`
- **Imports**: `getWindowTier` from `chartConfig.js`
- **Pattern**: Plain exports. `currentWindow` passed as explicit parameter.
- **Exception**: `formatAxisLabel` is ~30 lines (9-case switch dispatch table). Cannot decompose without creating 9 trivial functions. Accepted as Crystal Clarity exception — the switch IS the minimum representation.

#### Milestone 4A.3: Extract chartBarSpace.js (~45 lines)
- **Path**: `src/lib/chart/chartBarSpace.js`
- **Exports**: `getBarSpace(chart, container, resolution, rangeFrom, window)`, `applyBarSpace(...)`
- **Imports**: `TIMEFRAME_BAR_SPACE`, `windowToMs`, `calcBarSpace` from `chartConfig.js`
- **Decomposition**:
  - `countCandlesInRange(dataList, fromTs)` — binary search (8 lines)
  - `getBarSpace(...)` — uses countCandlesInRange (12 lines)
  - `applyBarSpace(...)` — calls getBarSpace, applies to chart (8 lines)

#### Milestone 4A.4: Extract chartOverlayCallbacks.js (~50 lines)
- **Path**: `src/lib/chart/chartOverlayCallbacks.js`
- **Exports**: `createOverlayCallbacks(state)`, context menu handlers
- **Imports**: `drawingStore` from `drawingStore.js`
- **Pattern**: Factory function receiving overlay state object.
- **Decomposition**:
  - `resolveDbId(state, overlayId)` — dbId lookup with fallback (6 lines)
  - `createOverlayCallbacks(state)` — returns { onSelected, onDeselected, onRightClick } (15 lines)
  - `handleContextMenuDelete/ToggleLock/TogglePin/Close(state)` — each under 10 lines

#### Milestone 4A.5: Extract chartOverlayRestore.js (~65 lines)
- **Path**: `src/lib/chart/chartOverlayRestore.js`
- **Exports**: `restoreDrawings(chart, symbol, resolution, state)`
- **Imports**: `drawingStore`, `styleUtils`, `chartOverlayCallbacks`
- **Decomposition** (from 81-line monolith):
  - `mergeDrawings(local, pinned)` — dedup by dbId (12 lines)
  - `renderLocalDrawings(chart, drawings, callbacks, state)` (14 lines)
  - `renderForeignDrawings(chart, drawings, state)` (15 lines)
  - `restoreDrawings(chart, symbol, resolution, state)` — orchestrator (14 lines)

#### Milestone 4A.6: Extract chartOverlayCommands.js (~60 lines)
- **Path**: `src/lib/chart/chartOverlayCommands.js`
- **Exports**: `handleDrawingCreated`, `handleOverlayDelete`, `handleOverlayToggleLock`, `handleClearDrawings`, `registerOverlayForInteraction`
- **Imports**: `drawingCommands`, `drawingStore`, `chartOverlayCallbacks`
- **Decomposition**:
  - `resolveDbId` reuses pattern from 4A.4 (6 lines)
  - `serializeOverlay(overlay)` (6 lines)
  - Each handler under 14 lines

#### Milestone 4A.7: Extract chartDataLoader.js (~95 lines)
- **Path**: `src/lib/chart/chartDataLoader.js`
- **Exports**: `loadChartData(params)`, `applyDataToChart(chart, klineData)`, `tryApplyData(...)`
- **Imports**: `chartDataStore`, `marketDataStore`, `chartConfig`, `chartBarSpace`
- **Decomposition** (from 101-line monolith):
  - `mapBarToKline(bar)` (7 lines)
  - `applyDataToChart(chart, klineData)` (9 lines)
  - `tryApplyData(chart, container, klineData, pendingRef)` (6 lines)
  - `applyIncrementalBar(chart, data)` (8 lines)
  - `subscribeToBarStore(chart, symbol, resolution, onDataReady)` (14 lines)
  - `subscribeToLiveTicks(chart, symbol)` (15 lines)
  - `computeFetchRange(window)` (4 lines)
  - `loadChartData(params)` — orchestrator (15 lines)

#### Milestone 4A.8: Extract chartChangeHandlers.js (~55 lines)
- **Path**: `src/lib/chart/chartChangeHandlers.js`
- **Exports**: `createChangeHandlers(deps)` returning `{ handleSymbolChange, handleSourceChange, handleResolutionChange, handleWindowChange, teardownSubscriptions }`
- **Imports**: `chartDataStore`, `xAxisCustom`, `workspace`, `chartDataLoader`, `chartOverlayRestore`, `chartConfig`
- **Decomposition**:
  - `clearOverlayState(state)` — shared teardown pattern (8 lines)
  - `teardownSubscriptions(state)` (6 lines)
  - Each change handler under 12 lines (reduced from 20-30 by extracting shared teardown)

#### Milestone 4A.9: Extract chartLifecycle.js (~95 lines)
- **Path**: `src/lib/chart/chartLifecycle.js`
- **Exports**: `mountChart(params)`, `destroyChart(params)`
- **Imports**: `klinecharts`, `xAxisCustom`, `chartThemeLight`, `interactSetup`, `chartBarSpace`, `chartDataLoader`, `chartOverlayRestore`, `chartDataStore`
- **Decomposition** (from 120-line onMount + 40-line onDestroy):
  - `initChart(container, window, formatLabel)` (12 lines)
  - `setupResizeObserver(chart, container, state)` (15 lines)
  - `setupIndicators(chart, watermarkData)` (8 lines)
  - `setupChartActions(chart, state)` (14 lines)
  - `setupInteract(element, displayId)` (8 lines)
  - `setupWheelHandler(chart, container)` (8 lines)
  - `cleanupListeners(...)` (8 lines)
  - `cleanupObservers(...)` (5 lines)
  - `mountChart(params)` — orchestrator (12 lines)
  - `destroyChart(params)` — orchestrator (10 lines)

### Phase 4B: chartDataStore.js (468 -> ~116 lines)

#### Milestone 4B.1: Extract barMerge.js (~25 lines)
- **Path**: `src/stores/chart/barMerge.js`
- **Exports**: `mergeAndDedupBars(existing, incoming)`, `upsertBar(bars, bar, isBarClose)`
- **Imports**: None (pure functions)
- **Pattern**: Pure functions taking arrays, returning arrays. Zero store coupling.

#### Milestone 4B.2: Extract barCache.js (~70 lines)
- **Path**: `src/stores/chart/barCache.js`
- **Exports**: `createBarDb()`, `getCachedBars(db, ...)`, `putCachedBars(db, ...)`, `evictStaleCache(db, ...)`
- **Imports**: `dexie`, `CACHE_MAX_BARS` from `chartConfig.js`
- **Pattern**: Factory + functions. `db` created by `createBarDb()` and passed as first arg. No shared module state.
- **Decomposition**:
  - `createBarDb()` (8 lines)
  - `buildCacheRecords(symbol, resolution, bars, source)` (11 lines)
  - `putCachedBars(...)` (6 lines)
  - `countCachedBars(db, ...)` (8 lines)
  - `fetchOldestBarKeys(db, ...)` (10 lines)
  - `evictStaleCache(...)` (12 lines)

#### Milestone 4B.3: Extract candleMessages.js (~65 lines)
- **Path**: `src/stores/chart/candleMessages.js`
- **Exports**: `handleCandleUpdate(message, deps)`, `handleCandleHistory(message, deps)`
- **Imports**: `barMerge`, `marketDataStore`
- **Pattern**: Dependency injection via `deps` object. Never imports from `chartDataStore.js`.
- **Decomposition**:
  - `periodToResolution(period)` (8 lines)
  - `injectCurrentPrice(symbol, currentPrice)` (9 lines)
  - `handleCandleUpdate(message, deps)` (14 lines)
  - `handleCandleHistory(message, deps)` (14 lines)

#### Milestone 4B.4: Extract candleTransport.js (~70 lines)
- **Path**: `src/stores/chart/candleTransport.js`
- **Exports**: `setupCandleMessageHandler(state, deps)`, `sendGetHistoricalCandles(...)`, `sendSubscribeCandles(...)`, `sendUnsubscribeCandles(...)`
- **Imports**: `ConnectionManager`, `getWebSocketUrl`
- **Pattern**: Mutable state object + deps injection.
- **Decomposition**:
  - `ensureConnectionManager(state)` (5 lines)
  - Each send function (8 lines)
  - `resubscribeOnReconnect(state, deps)` (14 lines)
  - `setupCandleMessageHandler(state, deps)` (12 lines)

#### Milestone 4B.5: Extract loadingTimers.js (~25 lines)
- **Path**: `src/stores/chart/loadingTimers.js`
- **Exports**: `startLoadingTimer(timers, key, store, timeoutMs, targetState)`, `clearLoadingTimer(timers, key)`
- **Imports**: None (pure utility)

#### Milestone 4B.6: Extract cacheFreshness.js (~18 lines)
- **Path**: `src/stores/chart/cacheFreshness.js`
- **Exports**: `isCacheStale(cachedBars, resolution)`
- **Imports**: `RESOLUTION_MS` from `chartConfig.js`

### Phase 4C: xAxisCustom.js (315 -> ~35 lines)

#### Milestone 4C.1: Extract xAxisCalendar.js (~95 lines)
- **Path**: `src/lib/chart/xAxisCalendar.js`
- **Exports**: `pad2`, `snapToBar`, `alignToBoundary`, `formatBoundaryLabel`
- **Imports**: None
- **Note**: `alignToBoundary` (27 lines) is a 6-case switch — accepted as exception. `formatBoundaryLabel` decomposed into per-rank helpers.

#### Milestone 4C.2: Extract xAxisTickEngine.js (~80 lines)
- **Path**: `src/lib/chart/xAxisTickEngine.js`
- **Exports**: `generateTicks(fromTs, toTs, dataList, chart, levels)`
- **Decomposition**:
  - `collectBoundaryCandidates(fromTs, toTs, dataList, chart, levels)` (30 lines)
  - `deduplicateBySnappedBar(candidates)` — Set-based (15 lines)
  - `applyMinFloorCollision(deduped)` (30 lines)
  - `generateTicks(...)` — 5-line orchestrator

#### Remaining xAxisCustom.js (~35 lines)
- `setAxisChart`, `setAxisWindow`, module-level state, `registerXAxis` (thin delegate to `generateTicks`)

### Phase 4D: customOverlays.js (432 -> ~10 lines)

#### Milestone 4D.1: Split into domain-grouped files
- `overlayIndicators.js` (~70 lines) — symbolWatermark, AD
- `overlayShapes.js` (~90 lines) — rect, circle, polygon, arc, arrow
- `overlayMeasurements.js` (~90 lines) — horizontalRayLine, annotation, tag, rulerPriceLine
- `overlayFibonacci.js` (~65 lines) — fibonacciLine, parallelStraightLine

#### Remaining customOverlays.js (~10 lines)
- Side-effect imports only: `import './overlayIndicators.js'` etc.

### Phase 4E: chartConfig.js (241 -> ~70 lines)

#### Milestone 4E.1: Extract chartConstants.js (~85 lines)
- **Path**: `src/lib/chart/chartConstants.js`
- **Exports**: All data tables (RESOLUTION_LABELS, RESOLUTION_GROUPS, TIME_WINDOW_GROUPS, DEFAULT_RESOLUTION_WINDOW, RESOLUTION_TO_PERIOD, TIMEFRAME_BAR_SPACE, PERIOD_RANGE_LIMITS, CACHE_MAX_BARS, WINDOW_MS, RESOLUTION_MS)

#### Milestone 4E.2: Extract chartTimeWindows.js (~50 lines)
- **Path**: `src/lib/chart/chartTimeWindows.js`
- **Exports**: `windowToMs`, `parseWindowString`, `getCalendarAlignedRange`
- **Decomposition**: `alignRollingWindow`, `alignCalendarWindow`, `getCalendarAlignedRange` as 5/15/8-line orchestrator

#### Remaining chartConfig.js (~70 lines)
- `TRANSITION_MATRIX`, `WINDOW_TIER`, `resolutionToPeriod`, `calcBarSpace`, `getWindowTier`

### Phase 4F: QuickRuler, ChartToolbar, drawingCommands

#### Milestone 4F.1: QuickRuler extractions
- `quickRulerOverlays.js` (~45 lines) — createOverlays, removeOverlays, updateCursorOverlay
- `quickRulerPositioning.js` (~25 lines) — getPixelOffset, calcDataWindowStyle
- Remaining QuickRuler.svelte: ~130 lines (48 template + 82 script — floor)

#### Milestone 4F.2: ChartToolbar extraction
- `drawingToolActions.js` (~60 lines) — DRAWING_TOOLS, handleDrawingToolClick (decomposed), clear handlers
- Remaining ChartToolbar.svelte: ~312 lines (85 template + 157 style + 70 script — floor)

#### Milestone 4F.3: drawingCommands split
- `deleteDrawingCommand.js` (~27 lines) — DeleteDrawingCommand class
- Remaining drawingCommands.js: ~107 lines — DrawingCommandStack + CreateDrawingCommand

---

## Decision Log

| ID | Question | Answer | Rationale |
|----|----------|--------|-----------|
| D1 | Fix correctness before decomposition? | Yes | Correctness bugs cause data loss regardless of file structure |
| D2 | Merge overlayDbIdMap + overlayPinnedMap? | No | Different value types (number vs boolean); encapsulate via chartOverlayState factory instead |
| D3 | Factory function vs class for extracted modules? | Factory | No inheritance needed; avoids `this` binding issues with Svelte reactivity |
| D4 | State passing: explicit params vs Svelte stores? | Explicit params/factory | Stores create hidden coupling; explicit params make data flow visible |
| D5 | Accept formatAxisLabel at 30 lines? | Yes | 9-case switch dispatch table — decomposing creates 9 trivial functions that are harder to read |
| D6 | Accept alignToBoundary at 27 lines? | Yes | 6-case switch — same rationale as D5 |
| D7 | Accept Svelte component floors (196/130/312)? | Yes | Template+style are irreducible in Svelte scoped components. Script sections all under 100 lines |
| D8 | Batch IndexedDB writes (finding #18)? | Defer | Requires timer/flush mechanism; pure perf, no correctness impact |
| D9 | scheduleResize coalescing (findings #21, #38)? | Defer | Requires refactoring resize paths; perf-only |
| D10 | Generate FADED_* from theme (finding #29)? | Defer | Cross-module dependency for cosmetic concern |
| D11 | drawingStore.update() params (finding #12)? | Defer | API change for minor inefficiency |
| D12 | bulkAdd for server sync (finding #13)? | Defer | Runs only on login; fast enough for < 100 drawings |
| D13 | Dual store.set (finding #20)? | Defer | Both resets serve different purposes |
| D14 | QuickRuler convertFromPixel batching (finding #26)? | Defer | Called once per activation, not per-frame |
| D15 | symbolWatermark font strings (finding #40)? | No action | Partially refuted — already static literals |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Async undo window (overlay visible, no dbId) | Medium | High | `onRestoreMaps` fires immediately after save; window < 1ms |
| chart.removeOverlay() removes indicators | Low | High | Verified: removes user overlays only; watermark is an indicator |
| Phase 4A state object creates coupling | Medium | Medium | Factory pattern limits coupling; state object is typed and documented |
| Phase 4B deps injection misses a dependency | Low | High | Wire-up is explicit in chartDataStore.js; TypeScript would catch at compile time |
| xAxisCustom.js registerXAxis breaks after extraction | Low | Medium | `generateTicks` export signature unchanged; registerXAxis is thin delegate |
| customOverlays.js split breaks side-effect registration | Low | High | All 4 files call `registerOverlay`/`registerIndicator` at module scope; import aggregator preserves this |

---

## Verification Checklist

After each milestone:
- [ ] `npm run build` passes
- [ ] All new module files: `wc -l <file>` < 120
- [ ] All functions in modified files: < 15 lines (exceptions: formatAxisLabel, alignToBoundary)
- [ ] No circular imports (`madge --circular src/`)
- [ ] Drawings persist across symbol switches
- [ ] Drawings persist across resolution switches
- [ ] Drawings persist across page reloads
- [ ] Clear drawings removes all overlays from chart
- [ ] Undo after delete re-creates overlay AND persists to IndexedDB
- [ ] No console errors during rapid symbol switching
- [ ] No accumulated handlers after 10 rapid symbol switches
- [ ] Bar data remains sorted after 60+ seconds of live tick updates
- [ ] QuickRuler drag shows correct price/time measurements
- [ ] X-axis labels render correctly at all window levels
