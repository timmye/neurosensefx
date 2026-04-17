# Drawing Position Corruption — Post-Refactor Diagnosis

**Date:** 2026-04-17
**Scope:** Parallel channel and other overlay drawings loading in wrong positions after Crystal Clarity decomposition (commits `42cf212`–`c98b478`)
**Status:** Root cause confirmed

## Summary

Overlay registration code (`parallelStraightLine`, `fibonacciLine`, etc.) is unchanged — verbatim extraction from `customOverlays.js` to split modules. The coordinate pipeline is sound: drawings persist in data-space (`{timestamp, value}`), and KLineChart handles pixel conversion internally on every render frame via `timestampToDataIndex` → `convertToPixel`.

**Root cause:** `handleWindowChange` is the only data-reload path that does not clean up overlays or restore drawings. This causes wrong positions in two distinct failure modes:

1. **Live session** — old overlays remain on chart, new `createOverlay` calls silently fail on ID collision
2. **Page load after window change** — workspace persistence saves the new window, next page load fetches a different data range, and drawing timestamps from the old range snap to boundary bars via `binarySearchNearest`

## Architecture (unchanged by refactor)

```
User draws overlay
  → KLineChart _coordinateToPoint: pixel → {dataIndex, timestamp, value}
  → onDrawEnd event
  → CreateDrawingCommand.persist()
  → IndexedDB + debounced server sync (JSONB)

Page load / restore
  → drawingStore.load(symbol, resolution)
    → server GET if authenticated, else IndexedDB
  → chart.createOverlay({ id, name, points, styles })
  → KLineChart stores data-space points
  → On each render frame:
      timestampToDataIndex(timestamp)  → binarySearchNearest in dataList
      convertToPixel(dataIndex)         → CSS pixel x
      yAxis.convertToPixel(value)       → CSS pixel y
      createPointFigures({ coordinates }) → figure descriptors → canvas draw
```

Key invariant: overlay `points` are NEVER in pixel coordinates. The `coordinates` parameter in `createPointFigures` is pixel-space but is only used during rendering, never persisted.

## Root Cause — `handleWindowChange` missing overlay cleanup (CONFIRMED)

**File:** `src/components/ChartDisplay.svelte:236-244`

`handleWindowChange` is the only data-reload path that does NOT clear overlays, clear data, or pass an `onDataReady` callback:

```js
// handleWindowChange — NO removeOverlay, NO clearData, NO callback
function handleWindowChange(newWindow) {
  if (newWindow === currentWindow) return;
  teardownSubscriptions();
  currentWindow = newWindow;
  setAxisWindow(currentWindow, chart);
  updateWatermark();
  loadChartData(currentSymbol, currentResolution, currentWindow); // no callback!
  workspaceActions.updateDisplay(display.id, { window: newWindow });
}
```

Compare with `handleResolutionChange` and `reload()` which both call `chart.removeOverlay()`, `chart.clearData()`, clear meta/undo state, and pass `() => restoreDrawings(...)`:

| Path | `removeOverlay()` | `clearData()` | `overlayMeta.clear()` | `commandStack.clear()` | `onDataReady` callback |
|------|---|---|---|---|---|
| `reload()` | YES | YES | YES | YES | YES |
| `handleResolutionChange` | YES | YES | YES | YES | YES |
| **`handleWindowChange`** | **NO** | **NO** | **NO** | **NO** | **NO** |

### Failure Mode 1: Live session (wrong positions immediately after window change)

1. User changes window (e.g., 3M → 1M) — old overlays remain on chart (no `removeOverlay()`)
2. `loadChartData` is called with no `onDataReady` callback
3. In `subscribeToBarStore` (`chartTickSubscriptions.js:64`), the guard `if (dataReadyCb)` is `undefined` — no new `onDataReady` handler is registered
4. The **stale** `onDataReady` handler from the initial load remains registered in KLineChart
5. When new data arrives, `applyNewData()` fires — KLineChart dispatches `onDataReady` synchronously
6. The stale handler fires and calls `restoreDrawings(currentSymbol, currentResolution)`
7. `restoreDrawings` calls `chart.createOverlay({ id: drawing.overlayId, ... })` for each drawing
8. **Every `createOverlay` call silently fails** — ID collision (klinecharts.js:5753: `if (getInstanceById(id) === null)` guard)
9. Old overlays persist with positions recalculated against the new, different dataList
10. `binarySearchNearest` snaps timestamps that don't exist in the new window to first/last bar
11. **Positions are permanently wrong** — nothing ever removes the stale overlays or recreates them with correct positions

### Failure Mode 2: Page load after window change (wrong positions persist across refresh)

1. User creates drawing on 3M window — overlay points saved with `{timestamp, value}` where timestamps are from 3M bars
2. User changes window to 1M via `handleWindowChange` — workspace persistence saves `window: '1M'`
3. User refreshes page to "fix" the visual corruption
4. On page load, workspace restores `window: '1M'`, `loadChartData` fetches 1M data range
5. `restoreDrawings` loads drawings from IndexedDB — these have timestamps from the original 3M bars
6. Many of those timestamps are **outside the 1M data range** (2 of the 3 months of bars don't exist in 1M data)
7. `timestampToDataIndex` → `binarySearchNearest` (klinecharts.js:8778-8779) snaps out-of-range timestamps to the nearest boundary bar (first or last bar in dataList)
8. **Drawing appears collapsed/shifted to the edge of the chart**
9. This is NOT a code path issue — the page load path itself is clean. The corruption is in the **data**: drawings were created against one time range but are being rendered against a different time range.

### Why this is non-self-correcting

- **Live session:** Old overlays are never removed (no `removeOverlay()`), new overlays cannot be created (silent ID collision)
- **Page load:** The persisted drawing timestamps are valid but belong to a different time range. `binarySearchNearest` faithfully snaps them to the nearest available bar, which is at the data boundary — not at the drawing's intended position

### Why the page load path itself is clean

Traced initialization sequence (no bugs in this path):

```
T1  Workspace.svelte onMount → await loadFromStorage()
T2  workspaceStore.update() with saved displays (including window)
T3  Svelte each block renders ChartDisplay with saved display prop
T4  ChartDisplay instance script: currentWindow = display.window (line 44)
T5  onMount: setTimeout(0) → initChart → rAF → loadChartData(callback)
T6  loadHistoricalBars → getCachedBars (async IndexedDB)
T7  Cache hit: store.set({updateType:'full'})
T8  applyNewData(klineData) → register subscribeOnDataReady(restoreDrawings)
T9  onDataReady fires → restoreDrawings (async: await drawingStore.load)
T10 rAF: applyBarSpace() → restoreDrawings resumes → createOverlay for each drawing
```

- `handleWindowChange` does NOT fire during page load (no reactive statement watches `display.window`)
- Exactly ONE data load, ONE overlay restore — no competing paths
- Drawings are created AFTER `applyBarSpace` runs (async await yields to rAF)
- DPR timing causes at most transient visual blur, not position corruption (points are data-space, never pixel-space)

### File:line evidence

| Evidence | Location |
|----------|----------|
| Missing cleanup in `handleWindowChange` | `src/components/ChartDisplay.svelte:236-244` |
| No callback passed to `loadChartData` | `src/components/ChartDisplay.svelte:242` |
| Guard prevents new `onDataReady` subscription | `src/lib/chart/chartTickSubscriptions.js:64` |
| Stale handler from initial load still registered | `src/lib/chart/chartTickSubscriptions.js:67` |
| Silent `createOverlay` ID collision | `node_modules/klinecharts/dist/umd/klinecharts.js:5753` |
| `binarySearchNearest` snaps to boundary bars | `node_modules/klinecharts/dist/umd/klinecharts.js:8778-8779` |
| `timestampToDataIndex` binary search | `node_modules/klinecharts/dist/umd/klinecharts.js:2210-2215` |
| Workspace saves window to persistence | `src/components/ChartDisplay.svelte:251` |

### Data integrity: persisted points are never mutated by `updatePointPosition`

`updatePointPosition` (klinecharts.js:5966-5984) only mutates points where `!isValid(point.timestamp) && isValid(point.dataIndex)`. All user-drawn overlays have valid timestamps (set by `_coordinateToPoint` at klinecharts.js:8646-8647). No code path deletes or nullifies `point.timestamp`. The `handleWindowChange` bug does NOT corrupt persisted drawing data — the timestamps in IndexedDB remain the original values from when the drawing was created.

## Ruled-Out Issues

### `onDataReady` handler lifecycle leak — NOT a standalone root cause

**File:** `src/lib/chart/chartTickSubscriptions.js:57-68`

`subscribeToBarStore` only subscribes `onDataReady` once (on first `full` update). After that, `dataReadyCb` is set to `null`:

```js
if (dataReadyCb) {
  const cb = dataReadyCb;
  dataReadyCb = null;                    // consumed — never set again
  chartSubs.subscribeOnDataReady(() => cb());  // registered permanently
}
```

The `chartSubs.subscribeOnDataReady()` call at line 46 does call `unsubscribeOnDataReady()` first, so each new subscription replaces the old one. However, in the `handleWindowChange` path, `subscribeOnDataReady` is NEVER called (because `dataReadyCb` is `undefined`). The stale handler persists — but this is the **mechanism** by which the root cause (Failure Mode 1) manifests, not a separate bug.

### `applyBarSpace` timing change in DPR fix — NOT a root cause

**Commit:** `c98b478`

On initial page load, `restoreDrawings` is async (awaits IndexedDB/server), so drawings are created AFTER `applyBarSpace` runs in the rAF callback. Even if there were a brief timing mismatch, KLineChart recalculates all coordinates from data-space points on every render frame — positions self-correct immediately.

DPR/canvas scaling issues cause transient visual blur (documented in `blurry-render-on-load-diagnosis.md`), not persistent position corruption. Overlay points store `{timestamp, value}`, never pixel coordinates.

### `createOverlay` silent ID collision — enabler, not cause

**File:** `node_modules/klinecharts/dist/umd/klinecharts.js:5753`

If an overlay with the given `id` already exists, `createOverlay` returns the id but does NOT create, update, or warn. This is the mechanism that prevents recovery in Failure Mode 1 — but only fires because the root cause (missing `removeOverlay`) leaves old overlays in place.

## Additional Finding — Missing `overlayMeta` and `commandStack` cleanup

`handleWindowChange` also skips `overlayMeta.clear()` and `commandStack.clear()`, which `handleResolutionChange` and `reload()` both perform. This leaves stale undo state that could cause further issues if the user attempts to undo after a window change.

## Crystal Clarity Code Quality Assessment

The extracted modules from the Phase 3 decomposition are well-structured:

| Aspect | Assessment |
|--------|------------|
| Factory patterns | Good — `createChartSubscriptions`, `createResizeState`, `createOverlayRestore`, `createBarSpace` all prevent multi-chart state clobbering |
| Dep injection | Consistent — all factories accept `deps` objects with getters for late-bound values |
| Single responsibility | Each module has a clear, focused purpose |
| Naming | Descriptive and consistent |

**Code smell:** `handleWindowChange` is inconsistent with other data-reload paths (`handleResolutionChange`, `reload`). This is the only defect — the decomposition itself is clean.

## KLineChart Internal Reference

Key functions for understanding coordinate transformations:

| Function | Location | Purpose |
|----------|----------|---------|
| `timestampToDataIndex` | `klinecharts.js:2210-2215` | Binary search for nearest bar by timestamp; returns `0` when dataList is empty |
| `binarySearchNearest` | `klinecharts.js:1786-1810` | O(log n) nearest-match search |
| `_coordinateToPoint` | `klinecharts.js:8635-8711` | Pixel → data point (during user drawing) — always produces `{dataIndex, timestamp, value}` |
| `_drawOverlay` | `klinecharts.js:8773-8789` | Data point → pixel coordinates (every render frame) |
| `updatePointPosition` | `klinecharts.js:5966-5984` | Adjusts overlay points on data load; only mutates points WITHOUT `timestamp` |
| `addInstances` | `klinecharts.js:5748-5773` | `createOverlay` implementation; silent no-op on ID collision |
| `setPoints` | `klinecharts.js:1313-1316` | Shallow copies points array (`[...points]`) — no shared reference with caller |
| `OnDataReady` | `klinecharts.js:6568` | Fires inside `addData` after `adjustPaneViewport` |

## Fix

Make `handleWindowChange` consistent with `handleResolutionChange` (pattern already exists verbatim at ChartDisplay.svelte:224-234):

```js
function handleWindowChange(newWindow) {
  if (newWindow === currentWindow) return;
  teardownSubscriptions();
  currentWindow = newWindow;
  setAxisWindow(currentWindow, chart);
  updateWatermark();
  if (chart) { chart.removeOverlay(); chart.clearData(); }
  overlayMeta.clear(); commandStack.clear();
  loadChartData(currentSymbol, currentResolution, currentWindow,
    () => overlayRestore.restoreDrawings(currentSymbol, currentResolution)
  );
  workspaceActions.updateDisplay(display.id, { window: newWindow });
}
```

**What this fixes:**
- **Failure Mode 1 (live session):** Old overlays are properly removed before new data loads, and `restoreDrawings` creates fresh overlays after data is ready. No ID collision.
- **Failure Mode 2 (page load after window change):** After the fix, `handleWindowChange` calls `restoreDrawings` with the new data, so overlays are re-created with their original `{timestamp, value}` points against the new dataList. Timestamps that fall outside the new range will still snap to boundary bars (this is inherent to time-range-dependent drawings), but the user will see the correct behavior immediately rather than stale overlays from the old range.

**Note on time-range-dependent drawings:** Drawings created on a wider window (e.g., 3M) will always have some points outside a narrower window's data range (e.g., 1M). `binarySearchNearest` snaps these to boundary bars, which is correct KLineChart behavior. This is a design characteristic, not a bug — the drawing's timestamps are faithfully preserved, they just don't have matching bars in the narrower range.

Single-file, single-location change. No other code modifications needed.

## Reproduction Steps to Verify

1. Create a parallel channel drawing on any symbol (default 3M window)
2. Refresh the page — drawing should appear in correct position (clean page load)
3. Change the window (e.g., 3M → 1M) — **before fix:** drawing shifts to wrong position; **after fix:** drawing re-renders correctly (points outside 1M range snap to edge)
4. After step 3, refresh the page — **before fix:** drawing still wrong (workspace saved 1M, timestamps from 3M); **after fix:** drawing re-renders correctly against 1M data
5. Change resolution and back — check if drawing position is preserved
6. Open two charts for the same symbol — check for position interference
