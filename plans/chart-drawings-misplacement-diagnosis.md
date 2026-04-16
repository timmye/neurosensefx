# Chart Drawings Misplacement — Root Cause Diagnosis

**Date:** 2026-04-15
**Scope:** Drawings appearing in wrong location on chart load, suspected regression from TradingView data source integration.
**Reviewed:** 2026-04-15 — quality review applied, fixes hardened, severity re-ranked.

---

## Executive Summary

The investigation traced the full pipeline from TradingView data fetch → IndexedDB cache → KLineChart rendering → drawing persistence → overlay restore. **Three high-severity issues** were identified that can independently cause drawings to appear in wrong locations, plus several contributing factors.

The most likely regression vectors are:
1. **visibleRange.from used as millisecond timestamp** for foreign pinned drawings (Issue #1) — definite bug, always triggered
2. **rAF timing gap** between data application and drawing restore (Issue #2) — race condition on every chart load
3. **Progressive loading shifting overlay positions** after initial restore (Issue #3) — triggered on scroll-to-load

---

## Issue #1 (HIGH) — visibleRange.from Is a DataIndex, Not a Timestamp

### Root Cause

`chart.getVisibleRange()` returns `{ from: dataIndex, to: dataIndex, ... }` — integer data indices (confirmed at `klinecharts.js:2048`, used as loop bounds at `klinecharts.js:6418-6419`). But the foreign pinned drawing code at `ChartDisplay.svelte:317-323` uses `visibleRange.from` as if it were a millisecond timestamp:

```javascript
const visibleRange = chart.getVisibleRange();
const mappedPoints = drawing.points.map(p => {
    if (isPriceOnlyOverlay(drawing.overlayType) && visibleRange) {
        return { ...p, timestamp: visibleRange.from };  // ← dataIndex used as timestamp!
    }
    return p;
});
```

### How It Manifests

- `visibleRange.from` might be e.g. `0` or `150` (a data index)
- This gets set as the point's `timestamp` (a millisecond timestamp)
- KLineChart's `timestampToDataIndex()` does a binary search for timestamp=0 or timestamp=150
- Timestamp 0 = Jan 1 1970 → binary search snaps to the **first bar** (leftmost)
- If dataIndex=150 and bars are at millisecond timestamps (e.g., 1,710,000,000,000), the search snaps to the **leftmost** bar
- Foreign pinned horizontal lines always appear at the left edge regardless of where they should be

### Why This Is the Top Priority

- **Always triggered** on every chart load that has foreign pinned drawings (different resolution than current)
- Not conditional on timing, device speed, or progressive loading
- Produces a clearly wrong result (leftmost bar) rather than a subtle offset
- Simplest fix of the three HIGH issues

### Impact

- Only affects **foreign pinned drawings** (different resolution than current)
- Price-only overlays (horizontal lines) are the primary victims
- Local drawings and same-resolution pinned drawings are unaffected

---

## Issue #2 (HIGH) — rAF Timing Gap Between applyNewData and restoreDrawings

### Root Cause

`applyDataToChart()` uses `requestAnimationFrame` for post-processing (resize, barSpace, scrollToRealTime), but `restoreDrawings()` runs synchronously in the store callback — **before** the rAF fires.

**Evidence — `ChartDisplay.svelte:559-577, 590-603`:**
```javascript
// applyDataToChart — defers layout work to next frame
function applyDataToChart(klineData) {
    chart.applyNewData(klineData);
    requestAnimationFrame(() => {     // <-- DEFERRED
        chart.resize();
        applyBarSpace();              // <-- Bar spacing not yet applied
        chart.scrollToRealTime();     // <-- Visible range not yet set
    });
}

// Store subscription fires synchronously when handleCandleHistory sets state
barStoreUnsubscribe = store.subscribe(data => {
    if (data.state === 'ready' && data.bars.length > 0) {
        if (data.updateType === 'full') {
            tryApplyData(klineData);   // Calls applyDataToChart above
            if (onDataReady) { onDataReady(); }  // <-- Fires BEFORE rAF
        }
    }
});
```

### How It Manifests

1. `applyNewData()` loads N bars into KLineChart
2. Store callback fires → `tryApplyData()` called → rAF queued for layout
3. **Immediately after**, `onDataReady()` fires → `restoreDrawings()` runs
4. Inside `restoreDrawings()`, `chart.getVisibleRange()` returns the **default** visible range (not the one set by `scrollToRealTime()`)
5. Foreign pinned drawings get `visibleRange.from` which is a dataIndex used as timestamp — compounding Issue #1
6. `applyBarSpace()` hasn't run yet, so bar spacing may differ from what was used when drawings were saved

### Why This Is a Regression

- Before TradingView: cache hits were instant (synchronous), so the rAF timing was less visible
- TradingView: network latency makes the rAF gap more impactful because the chart has more work to do in the deferred frame
- The `tryApplyData()` path with `pendingDataApply` (when container has zero width) introduces an **additional** rAF delay

---

## Issue #3 (HIGH) — Progressive Loading Shifts Existing Overlays

### Root Cause

KLineChart's `updatePointPosition()` only adjusts overlays that have `dataIndex` set but **no** `timestamp`. Overlays created with `timestamp` (the normal case) are **NOT repositioned** when new bars are prepended.

**Evidence — `klinecharts.js:5966-5984`:**
```javascript
OverlayStore.prototype.updatePointPosition = function (dataChangeLength, type) {
    if (dataChangeLength > 0) {
        var dataList_1 = this._chartStore.getDataList();
        this._instances.forEach(function (overlays) {
            overlays.forEach(function (o) {
                var points = o.points;
                points.forEach(function (point) {
                    // ONLY updates points with dataIndex but NO timestamp
                    if (!isValid(point.timestamp) && isValid(point.dataIndex)) {
                        if (type === exports.LoadDataType.Forward) {
                            point.dataIndex = point.dataIndex + dataChangeLength;
                        }
                        var data = dataList_1[point.dataIndex];
                        point.timestamp = data?.timestamp ?? undefined;
                    }
                });
            });
        });
    }
};
```

### How It Manifests

1. Chart loads with N bars → `restoreDrawings()` places overlays via `timestampToDataIndex()` binary search
2. Overlay points get `dataIndex` resolved from their timestamp (e.g., dataIndex=50 for bar at timestamp T)
3. User scrolls left → `loadMoreHistory()` fires → `handleCandleHistory()` merges (prepends + sorts + deduplicates) bars
4. `handleCandleHistory` sets `updateType: 'full'` (always, at `chartDataStore.js:404`) → subscriber calls `applyNewData` with full merged array
5. `applyNewData` triggers KLineChart's `updatePointPosition` — but since points have valid `timestamp`, the guard `!isValid(point.timestamp)` is **false**, so they are **skipped**
6. Overlay stays at old dataIndex, which now points to a **different bar** (M bars earlier than intended)

### Why This Is a Regression from TradingView

- cTrader data typically arrives in a single batch (backend has full history)
- TradingView `fetchHistoricalCandles()` limits to **5000 bars** (`TradingViewSession.js:244`) — so larger time windows trigger progressive loading more often
- The `amount` calculation `Math.min(5000, Math.ceil((to - from) / resMs) + 100)` means any window > ~5000 bars will be chunked
- Weekly/Monthly resolutions on 3M+ windows easily exceed 5000 bars

### Affected Code Path

```
ChartDisplay.svelte:748  → loadMoreHistory() triggered by scroll
chartDataStore.js:280    → loadMoreHistory() sends getHistoricalCandles with older range
chartDataStore.js:361    → handleCandleHistory() merges (prepend+sort+dedup), sets updateType='full'
ChartDisplay.svelte:591  → subscriber receives full replacement → applyNewData()
klinecharts.js:5966      → updatePointPosition() SKIPS timestamp-based overlays
```

### Why Rated Below Issues #1 and #2

- **Conditional**: only triggers when user scrolls near the left edge (progressive load)
- Issues #1 and #2 affect every chart load unconditionally
- However, on time windows > 5000 bars (common with TradingView on weekly/monthly), this becomes frequent

---

## Issue #4 (MEDIUM) — binarySearchNearest Biases Left

### Root Cause

KLineChart's `binarySearchNearest()` returns the **left** index when no exact timestamp match is found, not the nearest.

**Evidence — `klinecharts.js:1786-1813`:**
```javascript
function binarySearchNearest(dataList, valueKey, targetValue) {
    var left = 0, right = 0;
    for (right = dataList.length - 1; left !== right;) {
        // ... binary search ...
        if (mid <= 2) break;  // Exits early with potentially wrong result
    }
    return left;  // Always returns left, never right
}
```

### How It Manifests

- Drawing saved at timestamp T where T falls between bar[N] and bar[N+1]
- Binary search returns N (left), but N+1 might be closer
- Systematic left-bias means drawings drift leftward over time
- More pronounced with sparse data (D1, W1, MN1 resolutions) where gaps between bars are large
- Weekend gaps in FX data make this worse — a Friday close timestamp will snap to the Friday bar, but a drawing placed on Saturday (impossible, but the timestamp arithmetic can land there) snaps to the earlier bar

### Why This Is a Contributing Factor, Not a Root Cause

- This is a pre-existing KLineChart behavior, not introduced by TradingView
- TradingView and cTrader may round timestamps differently (trading hours vs midnight UTC), which makes the bias more visible when drawings saved under one source are loaded with bars from another
- Severity is MEDIUM because it causes subtle drift rather than total misplacement

---

## Issue #5 (LOW) — No Cross-Source Cache Invalidation

### Root Cause

When switching data sources via `handleSourceChange()`, the chart data is cleared and overlays removed, but the **IndexedDB cache for bars** is not invalidated.

**Evidence — `ChartDisplay.svelte:500-518`:**
```javascript
function handleSourceChange(newSource) {
    currentSource = newSource;
    teardownSubscriptions();
    if (chart) {
        chart.removeOverlay();
        chart.clearData();   // Clears chart, but NOT IndexedDB cache
    }
    // ...
    loadChartData(currentSymbol, currentResolution, currentWindow, () => {
        restoreDrawings(currentSymbol, currentResolution);
    });
}
```

The cache key `[symbol+resolution+source+timestamp]` properly segregates data, so this is **not currently exploitable**. However:

- If TradingView and cTrader produce bars at **different timestamps** for the same period (e.g., TradingView uses trading session open, cTrader uses midnight UTC), the drawing timestamps saved under one source won't match bars from the other
- The `loadHistoricalBars()` staleness check (`chartDataStore.js:220-236`) uses a 2-bar-period threshold — if a user switches sources quickly, stale cache from the old source could be served

### Impact

- Only manifests when switching sources and the cache hasn't expired
- Drawings saved under one source may not align with bars from another source due to timestamp differences

---

## Issue #6 (LOW) — Schema Version Not Enforced

### Root Cause

`drawingStore.js` stamps `schemaVersion: 1` on saved drawings but never validates it on load.

**Evidence — `drawingStore.js:19-54`:**
- Save adds `schemaVersion: 1` (line 24)
- Load returns data directly without checking schemaVersion
- Server stores raw JSON without schemaVersion

### Impact

- If the drawing point format changes (e.g., adding/removing fields), old drawings load without migration
- Currently low risk because the schema hasn't changed, but fragile going forward

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     DATA FETCH PATH                              │
│                                                                  │
│  TradingViewSession.js ──► WebSocketServer.js ──► Frontend WS   │
│  (5000 bar limit)       (candleHistory msg)     (handleCandle   │
│                                                  History)       │
│                                                         │       │
│                                                         ▼       │
│                                              chartDataStore.js  │
│                                              (merge + dedup)    │
│                                                         │       │
│                                            ┌────────────┴────┐  │
│                                            ▼                 ▼  │
│                                       IndexedDB          Store  │
│                                       (cache)          (state)  │
│                                                              │
│  ┌───────────────────────────────────────────────────────────┘  │
│  ▼                                                              │
│  ChartDisplay.svelte :: loadChartData()                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  store.subscribe() → tryApplyData() → applyNewData()     │   │
│  │       │                              │                   │   │
│  │       │                              ▼                   │   │
│  │       │                     requestAnimationFrame ─────┐  │   │
│  │       │                     (resize, barSpace,         │  │   │
│  │       │                      scrollToRealTime)         │  │   │
│  │       ▼                                                 │  │   │
│  │  onDataReady() → restoreDrawings()  ◄── RUNS HERE ────┘  │   │
│  │       │                                                  │   │
│  │       ▼                                                  │   │
│  │  drawingStore.load() → createOverlay({points})           │   │
│  │       │                                                  │   │
│  │       ▼                                                  │   │
│  │  KLineChart: timestampToDataIndex()                      │   │
│  │  (binarySearchNearest — biases LEFT)                     │   │
│  │       │                                                  │   │
│  │       ▼                                                  │   │
│  │  Overlay rendered at resolved position                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  LATER: User scrolls left → loadMoreHistory()            │   │
│  │       │                                                  │   │
│  │       ▼                                                  │   │
│  │  handleCandleHistory() merges (prepend+sort+dedup)       │   │
│  │  sets updateType='full' → subscriber calls applyNewData  │   │
│  │       │                                                  │   │
│  │       ▼                                                  │   │
│  │  KLineChart: updatePointPosition()                       │   │
│  │  (SKIPS overlays with valid timestamp — Issue #3)        │   │
│  │       │                                                  │   │
│  │       ▼                                                  │   │
│  │  Overlay stays at OLD dataIndex → WRONG POSITION         │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Recommended Fixes (Priority Order)

### Fix #1: Convert visibleRange.from to timestamp for foreign pinned drawings

In `restoreDrawings()`, convert the data index to an actual timestamp before using it as a point timestamp:

```javascript
// In restoreDrawings(), line 317-323:
const visibleRange = chart.getVisibleRange();
const dataList = chart.getDataList();
const fromTimestamp = dataList?.[visibleRange.from]?.timestamp;

const mappedPoints = drawing.points.map(p => {
    if (isPriceOnlyOverlay(drawing.overlayType) && fromTimestamp != null) {
        return { ...p, timestamp: fromTimestamp };
    }
    return p;
});
```

**Why this approach:** Direct lookup from the data list — no ambiguity, no timing dependency, O(1). Eliminates the dataIndex-as-timestamp type confusion entirely.

### Fix #2: Defer restoreDrawings to after chart layout completes

Use KLineChart's `onDraw` action instead of double-rAF, since rAF nesting doesn't guarantee execution after KLineChart's own internal deferred rendering:

```javascript
// In loadChartData store callback, replace synchronous onDataReady:
if (onDataReady) {
    // Wait for KLineChart to complete its internal render pass
    // (resize, barSpace, scrollToRealTime all execute before onDraw fires)
    const unsubs = chart.subscribeAction('onDraw', () => {
        unsubs();
        onDataReady();
        onDataReady = null;
    });
}
```

**Why `onDraw` over double-rAF:** `onDraw` fires after KLineChart's own render pipeline completes, which includes any internal rAF work. Double-rAF creates a fragile timing assumption that can break under heavy load or slower devices.

### Fix #3: Reposition overlays after progressive load (full data replacement)

After `applyNewData` is called with a merged dataset (progressive load), overlay points with timestamps need their `dataIndex` recalculated since KLineChart's `updatePointPosition` skips them. The safest approach is to snapshot existing overlays and recreate them, letting KLineChart re-resolve `timestamp → dataIndex` through its own `createOverlay` path:

```javascript
// In the store subscription callback, after tryApplyData for full updates:
if (data.updateType === 'full' && initialFullReceived && chart.getOverlays()?.length > 0) {
    const overlays = chart.getOverlays();
    const specs = overlays.map(o => ({
        id: o.id,
        name: o.name,
        points: o.points.map(p => ({ timestamp: p.timestamp, value: p.value })),
        styles: o.styles,
        extendData: o.extendData
    }));
    chart.removeOverlay();
    const callbacks = getOverlayCallbacks();
    for (const spec of specs) {
        chart.createOverlay({ ...spec, ...callbacks });
    }
    // overlayDbIdMap and overlayPinnedMap survive since they use overlay IDs
    // which are preserved in the specs above
}
```

**Why recreate over manual update:** KLineChart's `createOverlay` internally calls `timestampToDataIndex` for each point, which is the correct re-resolution path. Manually updating `dataIndex` requires accessing KLineChart's internal overlay instance structure, which is fragile across versions. Recreation preserves overlay IDs, so `overlayDbIdMap` and `overlayPinnedMap` remain valid.

**Performance note:** Overlay counts are typically small (< 50 per chart). Recreation cost is negligible compared to the data merge and render.

### Fix #4: Clear IndexedDB cache on source switch (defensive)

```javascript
// In handleSourceChange(), before loadChartData:
import { db } from './chartDataStore.js'; // db is the Dexie instance

function handleSourceChange(newSource) {
    // ... existing teardown ...
    // Clear cached bars for this symbol/resolution/source combo to prevent
    // stale cross-source data from being served on reload
    db.bars
        .where('[symbol+resolution+source+timestamp]')
        .between(
            [currentSymbol, currentResolution, currentSource, Dexie.minKey],
            [currentSymbol, currentResolution, currentSource, Dexie.maxKey],
            true, true
        )
        .delete()
        .catch(err => console.warn('[ChartDisplay] Cache eviction failed:', err));
    // ...
}
```

**Note:** The existing `evictStaleCache(symbol, resolution, source)` function (line 100 of `chartDataStore.js`) performs size-based eviction (removes bars exceeding `CACHE_MAX_BARS`), which is different from source-based clearing. A new function or direct Dexie query is needed for this use case.

---

## Files Referenced

| File | Lines | Relevance |
|------|-------|-----------|
| `src/components/ChartDisplay.svelte` | 317-323 | Foreign pinned drawing restore (visibleRange bug) |
| `src/components/ChartDisplay.svelte` | 559-577 | Data apply + rAF timing |
| `src/components/ChartDisplay.svelte` | 589-603 | Store subscription + onDataReady sync |
| `src/components/ChartDisplay.svelte` | 500-519 | Source change handler |
| `src/components/ChartDisplay.svelte` | 740-759 | Progressive load trigger |
| `src/stores/chartDataStore.js` | 361-415 | Candle history merge (always sets updateType='full') |
| `src/stores/chartDataStore.js` | 280-316 | loadMoreHistory |
| `src/stores/chartDataStore.js` | 69-98 | IndexedDB cache operations |
| `src/lib/chart/drawingStore.js` | 19-116 | Drawing persistence |
| `src/lib/chart/customOverlays.js` | 73-483 | Overlay definitions |
| `services/tick-backend/TradingViewSession.js` | 237-295 | 5000 bar limit |
| `services/tick-backend/WebSocketServer.js` | 461-516 | Candle history routing |
| `node_modules/klinecharts/dist/umd/klinecharts.js` | 1786-1813 | binarySearchNearest |
| `node_modules/klinecharts/dist/umd/klinecharts.js` | 2210-2216 | timestampToDataIndex |
| `node_modules/klinecharts/dist/umd/klinecharts.js` | 5966-5984 | updatePointPosition |
| `node_modules/klinecharts/dist/umd/klinecharts.js` | 8773-8787 | Overlay draw coordinate resolution |
| `node_modules/klinecharts/dist/umd/klinecharts.js` | 6603-6611 | ChartStore.clear() |
| `node_modules/klinecharts/dist/umd/klinecharts.js` | 2040-2048 | visibleRange = dataIndices |
