# Chart Module Quality Audit

Comprehensive audit of 30 files across `src/lib/chart/` and `src/components/` (ChartDisplay,
ChartToolbar). Conducted after "crystal clarity" refactoring to identify waste, patches,
non-optimal code, and structural issues. Includes testability assessment.

**Date**: 2026-04-18
**Scope**: All custom chart code — data pipeline, lifecycle, overlays, drawing persistence,
axis/theme, and component layer.

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| Critical Bug | 4 | Data corruption, dark mode breakage, regex logic error |
| High | 12 | Structural duplication, untestable patterns, async state corruption |
| Medium | 28 | Non-optimal hot paths, patches/workarounds, inconsistent patterns |
| Low | 45 | Dead code, naming, minor cleanup |

---

## Critical Bugs

### B1. ~~RGB regex bug in `styleUtils.js:30`~~ — FALSE POSITIVE

Originally reported as a regex bug where `rgba(...)` strings would match the `rgb` regex
first. Investigation revealed the `$` anchor in `rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$`
already rejects 4-param `rgba(...)` strings — the regex requires exactly 3 values before
the closing paren. **No fix needed.**

### B2. Async undo not awaited in `drawingCommands.js:38` + `DeleteDrawingCommand.js:29`

`DrawingCommandStack.undo()` calls `cmd.undo()` without `await`. If the IndexedDB write
fails, the command is still moved to `redoStack`, corrupting undo/redo state.

**Fix**: Make `DrawingCommandStack.undo()` and `redo()` async. Only push to redoStack on
successful undo.

### B3. `_dbId` injected into extendData in `chartDrawingHandlers.js:33`

`{ ...ext, _dbId }` destroys string extendData (annotations store text as a string,
spreading a string into an object produces `{}`). The `_dbId` is redundant — `overlayMeta`
already tracks it.

**Fix**: Remove the extendData injection on line 34 and the `_dbId` read in
ChartDisplay.svelte:103. Use `overlayMeta.setDbId` exclusively.

### B4. Arrow hard-coded dark color in `overlaysShapes.js:109`

`color: '#333333'` is invisible in dark mode. Every other shape overlay delegates to
klinecharts theme defaults.

**Fix**: Remove explicit `styles.color` and let klinecharts apply its default theme color.

---

## Structural Debt

### Duplication: Clear-state pattern (3x)

`chart.removeOverlay(); chart.clearData(); chart.resize(); overlayMeta.clear();
commandStack.clear()` appears identically in:

- `reloadChart.js:11-17` — inside `clearChartState()`
- `ChartDisplay.svelte:237` — `handleResolutionChange`
- `ChartDisplay.svelte:247` — `handleWindowChange`

**Fix**: Have resolution/window handlers call through `reloadChart.js`.

### Duplication: Chart init sequence (2x)

~20 lines of identical init code copy-pasted between:

- `ChartDisplay.svelte:401-421` — onMount
- `ChartDisplay.svelte:369-384` — un-minimize reactive

**Fix**: Extract a `bootChart()` function that both paths call.

### Duplication: Subscribe/unsubscribe boilerplate

`chartSubscriptions.js:19-56` — 3 pairs of structurally identical subscribe/unsubscribe
functions.

**Fix**: Replace with 2 generic functions using a `handlers` map. Reduces ~70 lines to ~30.

### Duplication: Formatter code (3-way)

`chartAxisFormatter.js:12-37` and `calendarBoundaries.js:62-88` contain identical
`formatterCache`, `getFormatter`, and `getLocalizedParts` logic. Subtle inconsistency:
`String(Number(map.month))` vs `Number(map.month)`.

**Fix**: Extract to shared `timeFormatShared.js`.

### Circular dependency

`styleUtils.js` imports `getFadedStyles` from `fadedStyleDefaults.js`, which imports
`fadeStyles` from `styleUtils.js`.

**Fix**: Move `fadeColor`/`fadeStyles` into a separate `colorUtils.js` (no chart imports).

### Re-export chain depth

`xAxisCustom.js` → `xAxisTickGenerator.js` → `dataSearch.js` / `calendarBoundaries.js`.

3-hop chain obscures function ownership.

**Fix**: Flatten. Each consumer imports from the defining module.

---

## Patches & Workarounds

| File | Issue | Severity |
|------|-------|----------|
| `ChartDisplay.svelte:401` | `setTimeout(0)` for layout timing — fragile across browsers | High |
| `chartTickSubscriptions.js:26` | Bare `requestAnimationFrame` in `applyDataToChart` races with klinecharts internal rAF | High |
| `ChartToolbar.svelte:92` | `prompt()` for annotation text — blocks UI, untestable | High |
| `overlaysChannels.js:23-101` | Two full overlay registrations to work around klinecharts ray-drawing limitation | Medium |
| `xAxisCustom.js:78` | `_lastChart` mutable global — assumes synchronous rendering | Medium |
| `barCache.js:62` | `evictStaleCache` magic number `99999999999999`, loads all records to find delete targets | Medium |
| `cacheFreshness.js:27` | Missing `updatedAt` treated as fresh (should be stale — fail-safe) | Medium |

---

## Non-Optimal Hot Paths

| File | Issue | Trigger |
|------|-------|---------|
| `chartTickSubscriptions.js:97` | `chart.getDataList()` on every tick frame — full array retrieval for last bar | Every price tick |
| `chartTickSubscriptions.js:74` | `chart.getDataList()` on every store emission even when timestamp matches | Every store update |
| `xAxisTickGenerator.js:56` | `dedupCandidates()` O(n^2) via `Array.find` | Every axis render |
| `xAxisTickGenerator.js:19` | `barCoord()` allocates input/output objects per candidate | Every axis render |
| `overlaysChannels.js:67` | Fibonacci creates 2 arrays + 24 objects per render call | Every mouse move during draw |
| `overlaysIndicators.js:22` | Watermark `calc` maps all candles to `{}` on every data update | Every candle update |
| `barMerge.js:19` | `bars.slice()` copies full array for single last-bar tick update | Every tick on large history |

---

## Component Issues

### ChartDisplay.svelte (553 lines, 10+ responsibilities)

| # | Issue | Severity |
|---|-------|----------|
| C1 | Does too much: init, data, overlays, drawings, keys, context menu, theme, timezone, resize, interact.js | High |
| C2 | 83 lines of repetitive key registration (`registerChartKeys`) | Medium |
| C3 | 10+ `if (!chart) return` defensive guards from async lifecycle | Medium |
| C7 | `loadChartData` callback threaded through 3 layers of nesting | Medium |

### ChartToolbar.svelte (465 lines)

| # | Issue | Severity |
|---|-------|----------|
| C4 | `handleDrawingToolClick` mixes UI, business logic, and persistence | High |
| C5 | `prompt()` for annotation text — synchronous, untestable | High |
| C6 | Mixed props vs store usage (some from props, some from stores) | Medium |

---

## Detailed File Findings

### Data Pipeline

| File | Issues | High | Med | Low |
|------|--------|------|-----|-----|
| `chartDataLoader.js` | 3 | 0 | 1 | 2 |
| `chartTickSubscriptions.js` | 6 | 1 | 3 | 2 |
| `barMerge.js` | 4 | 0 | 1 | 3 |
| `barCache.js` | 3 | 1 | 1 | 1 |
| `cacheFreshness.js` | 2 | 0 | 0 | 2 |
| `chartRequests.js` | 3 | 0 | 2 | 1 |
| `candleMessages.js` | 6 | 1 | 3 | 2 |

#### Notable findings:

- **chartDataLoader.js:26** — Uses raw string `'loading'` instead of `STATE.LOADING` enum.
- **chartTickSubscriptions.js:2.1** — Bare rAF in `applyDataToChart` should use `scheduleResize`.
- **chartTickSubscriptions.js:2.2** — `getDataList()` called on every store emission even when
  timestamp matches.
- **barCache.js:4.1** — `evictStaleCache` loads all 260K records to find bars to delete.
- **chartRequests.js:6.1** — Imports `getWebSocketUrl` from display-layer module (cross-layer dep).
- **candleMessages.js:7.1** — 27-line inline connection-recovery handler should be extracted.
- **candleMessages.js:7.4** — `injectCurrentPrice` exported but only used internally; wrong module.

### Lifecycle & Config

| File | Issues | High | Med | Low |
|------|--------|------|-----|-----|
| `chartLifecycle.js` | 4 | 0 | 2 | 2 |
| `chartResize.js` | 3 | 0 | 2 | 1 |
| `chartBarSpace.js` | 2 | 0 | 0 | 2 |
| `reloadChart.js` | 2 | 1 | 1 | 0 |
| `chartSubscriptions.js` | 1 | 1 | 0 | 0 |
| `chartConfig.js` | 2 | 0 | 1 | 1 |
| `chartConstants.js` | 2 | 0 | 0 | 2 |
| `chartTimeWindows.js` | 4 | 0 | 2 | 2 |
| `resolutionMapping.js` | 1 | 0 | 0 | 1 |

#### Notable findings:

- **reloadChart.js:37** — `clearChartState` exported but never imported (dead export).
- **chartSubscriptions.js:19-56** — 3 identical subscribe/unsubscribe pairs.
- **chartConfig.js:1-31** — Barrel re-export hurts tree-shaking, no backward-compat justification.
- **chartTimeWindows.js:30** — `parseWindowString` silently returns 3M fallback for invalid input.
- **chartBarSpace.js:75** — DEV console.log fires on every resize (drag-flood).

### Overlays & Drawing

| File | Issues | High | Med | Low |
|------|--------|------|-----|-----|
| `overlaysAnnotations.js` | 3 | 0 | 0 | 3 |
| `overlaysChannels.js` | 4 | 0 | 2 | 2 |
| `overlaysIndicators.js` | 2 | 0 | 0 | 2 |
| `overlaysPriceLines.js` | 2 | 0 | 1 | 1 |
| `overlaysShapes.js` | 3 | 0 | 1 | 2 |
| `drawingCommands.js` | 4 | 1 | 0 | 3 |
| `DeleteDrawingCommand.js` | 3 | 1 | 1 | 1 |
| `drawingStore.js` | 5 | 0 | 2 | 3 |
| `chartOverlayRestore.js` | 3 | 0 | 2 | 1 |
| `chartDrawingHandlers.js` | 3 | 1 | 1 | 1 |
| `overlayMeta.js` | 2 | 0 | 0 | 2 |
| `fadedStyleDefaults.js` | 2 | 0 | 1 | 1 |
| `styleUtils.js` | 5 | 1 | 1 | 3 |

#### Notable findings:

- **styleUtils.js:5-7** — Circular dependency with `fadedStyleDefaults.js`.
- **drawingCommands.js:85** — `onDrawEnd: null` explicitly set — leftover or workaround?
- **DeleteDrawingCommand.js:21** — Constructor takes 7 positional params (error-prone).
- **drawingStore.js:39-45** — Non-atomic IndexedDB replace: deletes local then inserts server
  data one-by-one.
- **chartOverlayRestore.js:68-94** — Foreign overlay positioning depends on data being loaded.
- **fadedStyleDefaults.js:19** — `getFadedStyles()` reads theme store on every call.
- **overlaysShapes.js:109** — Arrow hard-coded `#333333` invisible in dark mode.
- **overlaysIndicators.js:22** — Watermark `calc` maps all candles to `{}` (pure waste).

### Axis & Theme

| File | Issues | High | Med | Low |
|------|--------|------|-----|-----|
| `chartAxisFormatter.js` | 3 | 1 | 1 | 1 |
| `chartThemeLight.js` | 3 | 0 | 1 | 2 |
| `xAxisTickGenerator.js` | 4 | 1 | 2 | 1 |
| `xAxisCustom.js` | 3 | 1 | 1 | 1 |
| `calendarBoundaries.js` | 3 | 0 | 0 | 3 |
| `dataSearch.js` | 1 | 0 | 0 | 1 |
| `quickRulerUtils.js` | 2 | 0 | 2 | 0 |
| `rulerData.js` | 0 | 0 | 0 | 0 |
| `rulerOverlays.js` | 2 | 0 | 1 | 1 |
| `rulerPosition.js` | 1 | 0 | 0 | 1 |

#### Notable findings:

- **chartAxisFormatter.js:9-23** — Formatter code copy-pasted from `calendarBoundaries.js`.
- **chartThemeLight.js:35-43** — Seven `// was #XXXXXX` dead archaeology comments.
- **xAxisTickGenerator.js:56** — O(n^2) dedup via `Array.find`.
- **xAxisCustom.js:78** — `_lastChart` mutable global assumes synchronous rendering.
- **quickRulerUtils.js:52-70** — `bars` and `time` computed twice (once before early return,
  once inside it).
- **rulerOverlays.js:62** — `getLineColor` re-export couples SVG rendering to overlay module.

### Cross-Module Issues

- **Unstructured deps object** — `candleMessages.js` receives a 12+ property bag with no
  validation. Missing dep causes runtime error only on WebSocket reconnection.
- **Three different DI patterns** — factory+getter, positional params, single getter. No
  consistency across modules.
- **Three different rAF patterns** — bare rAF in `chartTickSubscriptions`, pendingTick flag
  in live ticks, `scheduleResize` in resize handler.
- **Inconsistent error handling** — silent swallow (cache), return-value check (requests),
  no handling (barCache, cacheFreshness), try/catch (data store).
- **Overlay registration side effects** — top-level `registerOverlay()` calls with no
  idempotency guard. HMR could duplicate registrations.

---

## Testability Assessment

### Currently testable (pure functions, no DOM)

- `drawingCommands.js` — DrawingCommandStack (undo/redo/clear/execute, maxDepth eviction)
- `overlayMeta.js` — Map operations (setDbId, getPinned, delete, clear)
- `chartAxisFormatter.js` — format output for each tier and timestamp
- `mapBarToKline`, `computeFetchRange` — pure transforms
- `dataSearch.js` — binary search (`dataIndexOf`, `snapToBar`)
- `barMerge.js` — merge logic (`mergeTickBar`, `mergeHistoryBars`)
- `xAxisCustom.js` — already has 724 lines of tests

### Currently untested but extractable

- Symbol/resolution/window transition logic (state machine, no DOM)
- Key binding definitions (data structure + handler functions)
- Drawing tool style overrides (pure config map)
- Watermark data transformation
- Formatter shared logic (once extracted from duplication)

### Requires chart instance (needs headless harness)

- `chartResize.js` — rAF coalescing with mocked rAF
- `chartSubscriptions.js` — subscribe/unsubscribe lifecycle
- `chartDrawingHandlers.js` — all CRUD operations
- `chartOverlayRestore.js` — merge/render drawings
- `chartBarSpace.js` — bar space calculation

### Headless harness feasibility

KLineChart uses Canvas 2D. With `node-canvas` + jsdom, a chart instance can be created
off-screen. This covers ~70% of untested logic — init, data application, overlay CRUD,
bar space calculation, resize coalescing. Visual pixel correctness cannot be verified
without a browser, but functional correctness can.

```js
// Proposed: src/lib/chart/__tests__/helpers/chartHarness.js
import { init, dispose } from 'klinecharts';
import { JSDOM } from 'jsdom';

export function createTestChart(width = 800, height = 500) {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="chart"></div></body></html>');
  const container = dom.window.document.getElementById('chart');
  Object.defineProperty(container, 'clientWidth', { value: width });
  Object.defineProperty(container, 'clientHeight', { value: height });
  const chart = init(container);
  return { chart, container, dom, cleanup: () => dispose(container) };
}
```

### Existing test coverage

| Test file | Coverage |
|-----------|----------|
| `src/lib/chart/__tests__/xAxisCustom.test.js` | 724 lines, comprehensive |
| `src/tests/e2e/chart-display.spec.js` | Chart creation, dimensions, minimize, toolbar, resolution, persistence, live data |
| `src/tests/e2e/workspace-drawing-persistence.spec.js` | Drawing export/import round-trip |

### Coverage gaps

- No unit tests for: `drawingCommands.js`, `overlayMeta.js`, `chartAxisFormatter.js`,
  `chartBarSpace.js`, `chartResize.js`, `chartDrawingHandlers.js`, `chartOverlayRestore.js`
- No tests for keyboard shortcut behavior
- No tests for context menu state transitions
- No tests for symbol/source/resolution change transitions
- No tests for ChartToolbar in isolation

---

## Recommended Remediation Order

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| 1 | Fix B1-B4 (critical bugs) | Small | Prevents data corruption + dark mode breakage |
| 2 | Extract `bootChart()` to deduplicate init | Small | Eliminates 20-line copy-paste |
| 3 | Route resolution/window changes through `reloadChart.js` | Small | Eliminates 3x clear-state duplication |
| 4 | Generic subscribe/unsubscribe in `chartSubscriptions.js` | Small | 70 → ~30 lines |
| 5 | Extract shared formatter module | Small | Eliminates 3-way duplication |
| 6 | Flatten re-export chains | Small | Mechanical, improves traceability |
| 7 | Replace `prompt()` with Svelte dialog | Medium | Testability + UX |
| 8 | Break circular dep (styleUtils ↔ fadedStyleDefaults) | Small | Structural correctness |
| 9 | Fix async undo in command stack | Medium | Prevents state corruption |
| 10 | Build headless chart test harness | Medium | Enables ~70% untested coverage |
| 11 | O(n^2) dedup → Map in xAxisTickGenerator | Small | Axis render performance |
| 12 | Fix cacheFreshness fail-safe (missing updatedAt → stale) | Small | Correctness |
| 13 | Fix barCache eviction (avoid loading all records) | Medium | Cache performance |
| 14 | Consolidate rAF patterns | Medium | Consistency, fewer race conditions |
| 15 | Clean chartThemeLight.js dead comments | Small | Readability |
