# Timeframe Switching Regression — Research & Findings

**Date:** 2026-04-05 (updated 2026-04-06)
**Status:** Root cause FOUND and FIXED.

## Observed Behaviour

| Action | Result |
|--------|--------|
| Switch timeframe (e.g. 4h → 1m) | X-axis labels update, candle data does NOT |
| Switch timeframes back (1m → 4h) | Sometimes works, sometimes doesn't |
| Change ticker symbol | Works correctly — data updates |
| Change symbol then change back | Works correctly |

**Key insight:** `handleSymbolChange` works. `handleResolutionChange` does not.

---

## Why X-Axis Labels Change Immediately

`updateWatermark()` (ChartDisplay.svelte:390) calls `chart.overrideIndicator()` on the watermark indicator. KLineChart schedules a **microtask** that calls `adjustPaneViewport(forceUpdate=true)`. This triggers:

1. `buildTicks(true)` on the x-axis — reads the new `_window` value (set by `setAxisWindow` at line 389)
2. `updatePane(UpdateLevel.All)` — full canvas redraw of all panes

This microtask fires **within the same event loop tick**, before any async data fetch can complete. The x-axis rebuilds using the new window value, but `chart.getDataList()` still returns **old resolution candles**.

**The x-axis does NOT update because of `setAxisResolution()` or `setAxisWindow()` directly.** `setAxisResolution` is a no-op. `setAxisWindow` only sets a module-level variable. The actual redraw is triggered indirectly by `updateWatermark()` → `overrideIndicator()`.

---

## Why Candle Data Doesn't Update

`loadChartData` (ChartDisplay.svelte:398) is **async**. It calls `loadHistoricalBars` which hits `await getCachedBars()` (IndexedDB) or waits for a WebSocket `getHistoricalCandles` response. Data arrives later via `store.set()` or `store.update()`, which triggers:

```
subscription callback → tryApplyData → applyDataToChart → chart.applyNewData()
```

The visible gap: **old candles with new x-axis labels** persist until the async data arrives and `applyNewData` replaces them.

---

## Why Symbol Change Works (Every Time)

`handleSymbolChange` calls `chart.clearData()` at line 364, which **immediately empties `_dataList` to `[]`**. When the `overrideIndicator` microtask fires and triggers `updatePane(All)`, the chart draws **empty** (no candles). Then when data arrives via `applyNewData`, the chart fills in correctly.

Additionally, `handleSymbolChange` calls `chart.removeIndicator('candle_pane', 'symbolWatermark')` which removes the watermark indicator entirely. The watermark is later re-created inside the `onDataReady` callback via `chart.createIndicator()`.

---

## Why Timeframe Switch Is Intermittent

No `chart.clearData()` call → old candles persist during the async gap. Whether the user sees the correct data depends on:

1. **IndexedDB cache hit vs miss**: Cache hit = fast `applyNewData`, works. Cache miss = slow WebSocket round-trip, prolonged stale state.
2. **Cache staleness check**: If cached data is < 2 minutes old (for 1m), it's used. If stale, backend fetch is required.

---

## Exact Execution Trace: handleResolutionChange('1m')

```
Step  Line(s)   What Happens
----  ------   ------------
1     Toolbar:139  User clicks 1M button
2     Toolbar:43   dispatch('resolution', '1m')
3     Display:685  Event handler fires → handleResolutionChange('1m')
4     Display:377  Guard: '1m' !== '4h' → passes
5     Display:379  barStoreUnsubscribe() → kills old 4h bar store subscriber
6     Display:380  barStoreUnsubscribe = null
7     Display:381  tickUnsubscribe() → kills old tick subscriber
8     Display:382  tickUnsubscribe = null
9     Display:383  unsubscribeFromCandles(symbol, '4h') → removes aggregation target
10    Display:385  currentResolution = '1m'
11    Display:386  currentWindow = DEFAULT_RESOLUTION_WINDOW['1m'] = '1d'
12    Display:388  setAxisResolution('1m') → NO-OP (empty function body)
13    Display:389  setAxisWindow('1d') → _window = '1d' (module-level var)
14    Display:390  updateWatermark() → chart.overrideIndicator(...)
                  ↳ schedules microtask → adjustPaneViewport → buildTicks → updatePane(All)
                  ↳ THIS is why x-axis updates immediately
15    Display:392  workspaceActions.updateDisplay(...) → persists to workspace store
16    Display:395  chart.removeOverlay() → removes drawing overlays (NOT candles)
17    Display:397  commandStack.clear()
18    Display:398  loadChartData('EUR/USD', '1m', '1d', callback)
19    Display:441  getChartBarStore('EUR/USD', '1m') → existing or new store
20    Display:446  store.set({ bars: [], state: 'loading' }) → no subscribers yet
21    Display:448  barStoreUnsubscribe?.() → NO-OP (already null)
22    Display:449  initialFullReceived = false
23    Display:450  store.subscribe(callback) → fires immediately with {loading}
                  callback skips: state !== 'ready'
24    Display:486  tickUnsubscribe?.() → NO-OP (already null)
25    Display:487  getMarketDataStore(symbol) → existing per-symbol store
26    Display:488  marketStore.subscribe(tickCallback) → fires synchronously
27    Display:489  tick callback: chart.getDataList() → OLD 4h data
28    Display:493  chart.updateData(last4hBar, close: livePrice) → modifies old data
29    Display:509  loadHistoricalBars('EUR/USD', '1m', <2d_ago>, <now>)
30    Store:187    getChartBarStore('EUR/USD', '1m') → same store as step 19
31    Store:190    store.set({ bars: [], state: 'loading' }) → subscription fires, skips
32    Store:194    30-second loading timeout started
33    Store:207    await getCachedBars(...) → YIELDS to event loop
```

### Path A: Cache Hit (fast)
```
34a   Store:221  store.set({ bars: cachedBars, state: 'ready', updateType: 'full' })
35a   Display:451  subscription fires: ready ✓, updateType='full' ✓
36a   Display:454  initialFullReceived = true
37a   Display:463  tryApplyData(klineData) → applyDataToChart(klineData)
38a   Display:422  chart.applyNewData(klineData) → 4h data REPLACED with 1m data
39a   Display:423  requestAnimationFrame → resize + barSpace + scrollToRealTime
40a   Display:464  onDataReady() → restoreDrawings('EUR/USD', '1m')
```

### Path B: Cache Miss (slow)
```
34b   Store:236  subscribeToCandles('EUR/USD', '1m') → live 1m candles start
35b   Store:245  sendGetHistoricalCandles(...) → WebSocket message sent
36b   (waits)     Chart shows old 4h candles with new 1d x-axis labels
37b   (eventual)  handleCandleHistory → store.update(..., updateType: 'full')
38b   Display:451  subscription fires: same as 35a-40a above
```

---

## Dead Code Discovery

**Lines 448 and 486 in `loadChartData` are dead code when called from `handleResolutionChange`:**

```
Line 380: barStoreUnsubscribe = null   ← handleResolutionChange nulls this
Line 448: barStoreUnsubscribe?.()     ← no-op, always null at this point

Line 382: tickUnsubscribe = null      ← handleResolutionChange nulls this  
Line 486: tickUnsubscribe?.()         ← no-op, always null at this point
```

These lines exist for the `onMount` path (where variables start as `null`), but when called from `handleResolutionChange`, they're guaranteed no-ops.

---

## handleSymbolChange vs handleResolutionChange — The Complete Diff

| Step | handleSymbolChange | handleResolutionChange |
|------|-------------------|----------------------|
| chart.removeOverlay() | YES (line 362) | YES (line 395) |
| chart.removeIndicator('candle_pane', 'symbolWatermark') | YES (line 363) | **NO** |
| chart.clearData() | YES (line 364) | **NO** |
| applyPricePrecision() | YES (line 365) | **NO** |
| setAxisResolution() | **NO** | YES (no-op, irrelevant) |
| setAxisWindow() | **NO** | YES (line 389) |
| updateWatermark() | **NO** | YES (line 390) |
| workspaceActions.updateDisplay() | NO (done elsewhere) | YES (line 392) |
| loadChartData callback | restoreDrawings + createIndicator | restoreDrawings only |

---

## KLineChart Internals: `applyNewData` Rendering Pipeline

```
chart.applyNewData(klineData)
  → ChartStore.addData(data, LoadDataType.Init)
    → this.clear()                          ← empties _dataList, _visibleDataList
    → this._dataList = data                 ← replaces with new data
    → this._timeScaleStore.resetOffsetRightDistance()
    → this._overlayStore.updatePointPosition()
    → this._timeScaleStore.adjustVisibleRange()
    → yield this._indicatorStore.calcInstance()  ← ASYNC: indicator recalc
    → this._chart.adjustPaneViewport(false, true, true, true)
      → buildTicks(true) on x-axis          ← rebuilds x-axis ticks
      → updatePane(UpdateLevel.All)        ← FULL CANVAS REDRAW
    → this._actionStore.execute(ActionType.OnDataReady)
```

The only async point is `calcInstance()`. If an indicator calculation fails, the error path does NOT call `adjustPaneViewport`, preventing the redraw.

---

## Fixes Attempted & Results

### Fix 1: try/catch around setAxisResolution/setAxisWindow/updateWatermark
- **Status:** REVERTED — confirmed as **hacks**
- **Why:** `setAxisResolution` is a documented no-op. `setAxisWindow` is a simple variable assignment. `chart.overrideIndicator` silently no-ops when indicator missing. **None can throw.**

### Fix 2: `chart.clearData()` in handleResolutionChange
- **Status:** APPLIED then REVERTED — **DID NOT FIX**
- **Why:** KLineChart's `applyNewData` with `LoadDataType.Init` already calls `this.clear()` internally before replacing `_dataList`. The clear is redundant. The issue is elsewhere.
- **Additional context:** `chart.clearData()` sets `_loading = true` which blocks KLineChart's internal `executeLoadMoreCallback` and `executeLoadDataCallback`, but does NOT block `addData`/`applyNewData`.

### Fix 3: `initialFullReceived` flag in store subscription
- **Status:** APPLIED — **DID NOT FIX** ("absolutely no improvement")
- **Why this should have worked:** Prevents `chart.updateData()` on stale data before `applyNewData` runs.
- **Why it didn't:** If the full load always eventually arrives with `updateType: 'full'`, the chart should self-correct regardless of intermediate incremental updates. The fix having no effect means the problem is NOT the incremental path — something else prevents `applyNewData` from working or rendering.

---

## What We Ruled Out

| Hypothesis | Evidence Against |
|------------|-----------------|
| Watermark `updateWatermark()` throws | KLineChart `overrideIndicator` silently no-ops when indicator not found |
| Theme font changes break rendering | Pure CSS font-family changes, no behavioural impact |
| customOverlays.js intercepts events | Canvas-only rendering at zLevel -1, no DOM elements, no event handlers |
| Toolbar buttons disabled/blocked | Never disabled, no CSS pointer-events, no event modifiers |
| chartConfig.js bar space changes | Cosmetic only — affects candle width, not data loading |
| `applyNewData` fails to replace data | KLineChart source confirms hard replacement: `this.clear(); this._dataList = data` |
| Store returns stale cached data | `store.set({ bars: [], state: 'loading' })` resets before subscription |
| Reactive statements interfere | No `$:` statements depend on `currentResolution` or `currentWindow` |
| `handleCandleUpdate` race condition blocks full load | `initialFullReceived` fix had no effect — full load still arrives with `updateType: 'full'` |

---

## Remaining Hypotheses

### H1: Indicator `calcInstance()` fails silently during resolution switch

`applyNewData` has one async yield: `calcInstance()`. If BOLL (or any indicator) calculation fails for the new resolution's data (e.g., insufficient data points), the error path does NOT call `adjustPaneViewport`. The chart would internally have correct data but never redraw.

**Why this matters for resolution but not symbol:** Symbol change removes the watermark indicator and re-creates it after data loads. If the watermark's `calcInstance` fails, it could affect the redraw chain. Resolution change keeps the watermark and doesn't re-create it.

### H2: Stale IndexedDB cache returns wrong-resolution data

If `getChartBarStore` returns a store with cached data from a different session or a previous resolution change that was interrupted, the `getCachedBars` cache hit might return wrong data that passes the staleness check.

### H3: `chart.updateData()` during the async gap corrupts KLineChart internal state

The tick subscription (step 26-28) calls `chart.updateData()` on old 4h data immediately after the new subscription is created. This modifies `_dataList` before `applyNewData` arrives. While `applyNewData` calls `this.clear()` first, the intermediate `updateData` call could leave KLineChart in an inconsistent state that `applyNewData` doesn't fully reset.

---

## Files to Investigate at Runtime

1. **Add `console.log` at ChartDisplay.svelte:451** — log every subscription firing with `data.state`, `data.bars.length`, `data.updateType`
2. **Add `console.log` at ChartDisplay.svelte:463** — log when `tryApplyData` is called, including `klineData.length`
3. **Add `console.log` at ChartDisplay.svelte:422** — log when `applyNewData` is called
4. **Add `console.log` at chartDataStore.js:221** — log cache hit/miss path
5. **Add `console.log` at chartDataStore.js:442** — log when `handleCandleHistory` fires with bar count
6. **Add `console.log` at chartDataStore.js:367** — log when `handleCandleUpdate` fires and what state the store is in

---

## Summary (pre-fix)

- **X-axis updates immediately** because `updateWatermark()` → `overrideIndicator()` → microtask → `adjustPaneViewport` → `buildTicks(true)` → `updatePane(All)`
- **Candle data doesn't update** because data loading is async (IndexedDB/WebSocket) while the chart redraws synchronously from the watermark update
- **Symbol change works** because `chart.clearData()` empties `_dataList` immediately, so the watermark-triggered redraw shows empty chart until `applyNewData` fills in new data
- **`clearData()` fix didn't work** because `applyNewData` already clears internally — the issue isn't stale data in the buffer
- **`initialFullReceived` fix didn't work** — the full load still arrives with `updateType: 'full'` and should trigger `applyNewData`
- **The issue remained unidentified through static analysis** — required runtime debugging with targeted logging
- **Dead code at lines 448 and 486** — `barStoreUnsubscribe?.()` and `tickUnsubscribe?.()` in `loadChartData` are always no-ops when called from `handleResolutionChange`

---

## Root Cause (confirmed 2026-04-06)

**`workspaceActions.updateDisplay is not a function`**

Commit `767900c` ("feat: symbol watermark with resolution and window display") added three calls to `workspaceActions.updateDisplay()` in ChartDisplay.svelte:

1. `handleResolutionChange` — `workspaceActions.updateDisplay(display.id, { resolution, window })`
2. `handleWindowChange` — `workspaceActions.updateDisplay(display.id, { window })`
3. Display minimize handler — `workspaceActions.updateDisplay(display.id, { isMinimized })`

But `updateDisplay` was **never exposed** on the `actions` object in workspace.js. An internal helper `updateDisplay()` existed at line 42, but only `updatePosition`, `updateSize`, and `updateChartDisplay` were exported as public methods.

### Why static analysis missed it

1. JavaScript's `TypeError: X is not a function` on a property access throws synchronously, but the error was **silent** — nothing caught or logged it, so it appeared to the user as "nothing happens"
2. The x-axis still updated because `setAxisWindow()` and `updateWatermark()` execute *before* the failing call
3. Symbol change worked because `handleSymbolChange` never calls `workspaceActions.updateDisplay()`
4. The entire data pipeline (store, IndexedDB cache, WebSocket, `applyNewData`) was correct — the error occurred before `loadChartData` was ever reached

### Runtime evidence

```
[TF-DEBUG] handleResolutionChange: 4h → 1h
[TF-DEBUG]   step 5: watermark updated
[TF-DEBUG] EXCEPTION in handleResolutionChange: TypeError: workspaceActions.updateDisplay is not a function
    at handleResolutionChange (ChartDisplay.svelte:400:24)
```

Step-by-step logging confirmed the throw at step 6 (`workspaceActions.updateDisplay`). Steps 1-5 all succeeded.

---

## Fix

1. **Exposed `updateDisplay` on the actions object** (`workspace.js` line 127):
   ```javascript
   updateDisplay: (id, updates, extra) => updateDisplay(id, updates, extra),
   ```

2. **Deduplicated `updateChartDisplay`** — now delegates to `actions.updateDisplay` instead of the internal helper directly:
   ```javascript
   updateChartDisplay: (id, updates) => actions.updateDisplay(id, updates),
   ```

3. **Retained `initialFullReceived` guard** in `loadChartData` — while it didn't fix this bug, it prevents stale incremental data from flashing on the chart during resolution switches.

4. **Restored defensive null guard** in `restoreDrawings` — `if (!chart) return;`.

5. **Removed all `[TF-DEBUG]` diagnostic logging** from ChartDisplay.svelte and chartDataStore.js.

### Files changed

| File | Change |
|------|--------|
| `src/stores/workspace.js` | Added `updateDisplay` to actions object; `updateChartDisplay` now delegates to `actions.updateDisplay` |
| `src/components/ChartDisplay.svelte` | Cleaned up debug logging; restored `restoreDrawings` null guard; retained `initialFullReceived` |
| `src/stores/chartDataStore.js` | Cleaned up debug logging |
