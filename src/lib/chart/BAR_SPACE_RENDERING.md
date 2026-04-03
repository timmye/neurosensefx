# Bar Space & Candle Rendering

How the chart decides how many candles to show, how wide they are, and where the viewport lands.

---

## 0. Time Window Logic Chain

```
User selects window (e.g. "2d")
       |
       v
loadChartData(symbol, resolution, window)                    ChartDisplay.svelte:403
       |
       +--> getCalendarAlignedRange(window, extraPeriods=0)  chartConfig.js:144
       |    Returns { from, to } for the exact window.
       |    Day windows: rolling (to - windowMs * 2)
       |    Week/Month/Year: calendar-aligned boundaries.
       |    Sets currentRangeFrom = exact.from                ChartDisplay.svelte:465
       |
       +--> getCalendarAlignedRange(window, extraPeriods=1)  chartConfig.js:144
       |    Returns { from, to } with 1 extra period back for scroll buffer.
       |    Sets currentFetchFrom = buffered.from             ChartDisplay.svelte:466
       |
       +--> loadHistoricalBars(symbol, resolution,            chartDataStore.js
              buffered.from, buffered.to)
            Fetches all bars from buffered.from to now.
            Returns more data than the window needs.
       |
       v
barStore fires 'full' update with bars array               ChartDisplay.svelte:414
       |
       v
bars.map() → klineData (OHLCV objects)                     ChartDisplay.svelte:416
       |
       v
tryApplyData(klineData)                                     ChartDisplay.svelte:406
       |
       v
applyDataToChart(klineData)                                 ChartDisplay.svelte:393
       |
       1. chart.applyNewData(klineData)                     ChartDisplay.svelte:395
          Loads all fetched bars into KLineChart.
          Internally calls resetOffsetRightDistance().
       |
       2. chart.setBarSpace(getBarSpace())                  ChartDisplay.svelte:398
          |                                                  ChartDisplay.svelte:192
          +--> width = chart.getSize('candle_pane', 'main')
          |    Full drawing area (canvas - y-axis).
          |
          +--> Data-aware path (preferred):
          |    fromTs = currentRangeFrom (exact window start)
          |    Binary search dataList for first candle >= fromTs
          |    candleCount = total bars - first window bar index
          |    barSpace = (width - 10) / candleCount
          |
          +--> Fallback path (before data loads):
               barSpace = calcBarSpace(res, window, width - 10)
                        = (width - 10) / (windowMs / resolutionMs)
       |
       3. chart.resize()                                    ChartDisplay.svelte:399
          Updates canvas DPR buffers.
       |
       4. chart.scrollToRealTime()                          ChartDisplay.svelte:400
          Positions last candle 10px from right edge.
          adjustVisibleRange() computes visible indices:
            visibleBarCount = totalBarSpace / barSpace
            to = lastBarRightSideDiffBarCount + totalBars
            from = to - visibleBarCount
          With (width - 10) barSpace, candleCount bars fit exactly.
```

---

## 1. Data Loading

```
loadChartData(symbol, resolution, window)
  |
  +-- getCalendarAlignedRange(window, extraPeriods=0)  -->  exact range
  |     currentRangeFrom = exact.from        <-- used by getBarSpace()
  |
  +-- getCalendarAlignedRange(window, extraPeriods=1)  -->  buffered range
        currentFetchFrom = buffered.from     <-- used to fetch data
```

**Two ranges:**
- `exact` — the time window the user selected (e.g. 2 days of 5m candles)
- `buffered` — extends one period further back for scroll buffer

`loadHistoricalBars()` fetches from `buffered.from` to `now`, so the chart
holds more data than it needs to display. The extra buffer lets the user
scroll left past the window start.

---

## 2. Bar Space Calculation

`getBarSpace()` in `ChartDisplay.svelte:181-212`

```
getBarSpace()
  |
  +-- width = chart.getSize('candle_pane', 'main').width
  |          (full candle drawing area, excludes y-axis)
  |
  +-- [data-aware path]  (when chart has data)
  |     dataList = chart.getDataList()
  |     fromTs = currentRangeFrom           <-- exact window start
  |     binary search for first candle >= fromTs
  |     candleCount = dataList.length - lo  <-- candles in exact window
  |     barSpace = (width - RIGHT_OFFSET_PX) / candleCount
  |
  +-- [fallback path]  (before data loads)
        barSpace = calcBarSpace(resolution, window, width - RIGHT_OFFSET_PX)
                 = (width - RIGHT_OFFSET_PX) / (windowToMs / resolutionMs)
```

`RIGHT_OFFSET_PX = 10` matches KLineChart's `DEFAULT_OFFSET_RIGHT_DISTANCE`.
Subtracted from width so `candleCount` bars fit in the usable area, with the
10px right offset as pure empty space.

**Goal:** produce a barSpace where exactly `candleCount` candles fill the
chart's usable width. The data-aware path is preferred because it counts
real candles (accounting for weekend gaps) rather than assuming continuous data.

### applyBarSpace() helper

All `setBarSpace` calls go through `applyBarSpace()` (line 214):

```
applyBarSpace()
  chart.setBarSpace(getBarSpace())
  chart.setOffsetRightDistance(RIGHT_OFFSET_PX, true)
```

The `setOffsetRightDistance` call is mandatory after every `setBarSpace`.
Without it, KLineChart's `_lastBarRightSideDiffBarCount` (the offset in
bar-count units) is stale — computed with the old barSpace — causing
`adjustVisibleRange()` to clip candles from the left edge.

---

## 3. KLineChart TimeScaleStore Internals

Source: `node_modules/klinecharts/dist/umd/klinecharts.js`

### Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `DEFAULT_BAR_SPACE` | 8px | Fallback bar width (overridden by our `setBarSpace()`) |
| `DEFAULT_OFFSET_RIGHT_DISTANCE` | 10px | Empty space right of last candle after `scrollToRealTime()` |
| `GAP_BAR_SPACE_RATIO` | 0.88 | Candle body fills 88% of barSpace; 12% is gap |
| `SCALE_MULTIPLIER` | 10 | Zoom sensitivity (irrelevant — zoom is locked) |

### Key state fields

| Field | Init | What it stores |
|-------|------|---------------|
| `_totalBarSpace` | 0 | Full drawing area width (`canvasWidth - yAxisWidth`). Set by `setTotalBarSpace()`. Does NOT subtract right offset. |
| `_barSpace` | 8 | Pixels per candle slot. Set by our `setBarSpace()`. |
| `_offsetRightDistance` | 10 | Right-side empty space in pixels. |
| `_lastBarRightSideDiffBarCount` | `10 / _barSpace` | The offset expressed in bar-count. **This is the variable that positions the viewport.** |
| `_visibleRange` | `{from:0, to:0}` | Currently visible data indices `{from, to, realFrom, realTo}`. |

### Candle anatomy

```
|<-------- barSpace -------->|
|<-- body -->|<-- gap ------>|
   88%           12%
```

`_calcGapBarSpace()` (line 1993): body = `floor(barSpace * 0.88)`, forced odd, min 1.
KLineChart uses full `barSpace` for visible-bar counting — gap ratio only affects drawing.

### adjustVisibleRange() (line 2013)

This is the core function that decides which data indices are visible.

```
visibleBarCount = _totalBarSpace / _barSpace

// Clamp _lastBarRightSideDiffBarCount to scroll limits
maxRightOffsetBarCount = visibleBarCount - min(leftMinVisibleBarCount, totalBarCount)
minRightOffsetBarCount = -totalBarCount + min(rightMinVisibleBarCount, totalBarCount)
_lastBarRightSideDiffBarCount = clamp(_lastBarRightSideDiffBarCount, min, max)

// Compute visible indices
to   = round(_lastBarRightSideDiffBarCount + totalBarCount + 0.5)
from = round(to - visibleBarCount) - 1
```

`_lastBarRightSideDiffBarCount` pushes `to` past the data end, which pushes
`from` further right — cutting candles from the left edge.

### scrollToRealTime() (line 13687)

```
difBarCount = _lastBarRightSideDiffBarCount - _offsetRightDistance / barSpace
distance = difBarCount * barSpace
scrollByDistance(distance)
```

End result: last candle positioned `_offsetRightDistance` (10px) from the right edge.

### scrollToDataIndex(index) (line 13699)

```
distance = (_lastBarRightSideDiffBarCount + (dataList.length - 1 - index)) * barSpace
scrollByDistance(distance)
```

Positions `index` at the **right edge** of the chart (with offset). All
positioning methods use right-edge convention — no left-edge or center option.

### setOffsetRightDistance(distance) (line 2128)

```
_offsetRightDistance = distance  // (clamped if _scrollLimitRole == Distance)
_lastBarRightSideDiffBarCount = _offsetRightDistance / _barSpace
adjustVisibleRange()
```

Recalculates viewport. Exposed as `chart.setOffsetRightDistance()`.

### setBarSpace(barSpace) (line 2109)

```
_barSpace = barSpace
_gapBarSpace = _calcGapBarSpace()
adjustVisibleRange()
```

Note: does NOT recalculate `_lastBarRightSideDiffBarCount`. The offset stays
at its current bar-count value. This is why `applyBarSpace()` must call
`setOffsetRightDistance()` after `setBarSpace()` — to force the recalculation.

---

## 4. Viewport Positioning (our code)

`applyDataToChart()` in `ChartDisplay.svelte:389-397`

```
applyDataToChart(klineData)
  1. chart.applyNewData(klineData)    // load all fetched data
       → internally calls resetOffsetRightDistance()
         sets _lastBarRightSideDiffBarCount = 10 / OLD_barSpace
  2. applyBarSpace()                  // set barSpace + recalculate offset
       → chart.setBarSpace(getBarSpace())
         barSpace = (width - 10) / candleCount
         NOTE: does NOT update _lastBarRightSideDiffBarCount
       → chart.setOffsetRightDistance(10, true)
         _lastBarRightSideDiffBarCount = 10 / NEW_barSpace  ← fix
         triggers adjustVisibleRange()
  3. chart.resize()                   // update canvas buffers
  4. chart.scrollToRealTime()         // snap last candle to right edge
```

All 6 call sites use `applyBarSpace()`: resolution change, window change,
applyDataToChart, resize handler, initial setup, and zoom lock.

---

## 5. The Left-Edge Cutoff Problem (RESOLVED)

**Root cause:** KLineChart's `setBarSpace()` does not recalculate
`_lastBarRightSideDiffBarCount` when barSpace changes. After
`applyNewData()` sets the offset with the old barSpace, `setBarSpace()`
updates barSpace but leaves the offset stale. `adjustVisibleRange()`
then computes an incorrect `from` index, cutting candles from the left.

**Fix:** `applyBarSpace()` calls `setOffsetRightDistance(10, true)` after
`setBarSpace()`, forcing `_lastBarRightSideDiffBarCount` to recalculate
with the new barSpace. Combined with `(width - 10) / candleCount` in
`getBarSpace()`, all candles in the exact window fit in the usable area.

**Coupling note:** `RIGHT_OFFSET_PX = 10` must match KLineChart's
`DEFAULT_OFFSET_RIGHT_DISTANCE`. If that constant changes (e.g. via
patch-package update), `RIGHT_OFFSET_PX` must be updated too.

**What happens:**

```
barSpace = width / candleCount          (from getBarSpace — current code)
visibleCandles = floor((width - 10) / barSpace)
lostCandles = candleCount - visibleCandles
            ≈ ceil(10 / barSpace)
```

`adjustVisibleRange` computes `from = to - visibleBarCount`, where
`visibleBarCount = _totalBarSpace / _barSpace` uses the FULL width. But `to`
is pushed past the data end by `_lastBarRightSideDiffBarCount` (10/barSpace),
so `from` shifts right by that same amount. The last ~`ceil(10/barSpace)` bars
of the intended window are pushed off the left edge.

**Impact by resolution** (on a 800px chart):

| Window | Res | barSpace | Lost candles | Lost time |
|--------|-----|----------|-------------|-----------|
| 1d     | 1m  | ~0.56px  | ~18         | ~18 min   |
| 2d     | 5m  | ~1.39px  | ~7          | ~35 min   |
| 1W     | 30m | ~3.47px  | ~3          | ~1.5 hr   |
| 2W     | 1h  | ~4.76px  | ~2          | ~2 hr     |
| 3M     | 4h  | ~12.7px  | ~1          | ~4 hr     |
| 1Y     | D   | ~32px    | ~0          | 0         |

Small barSpaces (low-timeframe intraday) lose the most. The left edge shows
a timestamp later than the window start by the amount in "Lost time".

---

## 6. Fix Options

### Option A: Subtract offset from width in getBarSpace (RECOMMENDED)

Change `ChartDisplay.svelte:203` from `width / candleCount` to
`(width - 10) / candleCount`. Same for fallback at line 209 in `calcBarSpace`.

**How it works:** barSpace is computed so `candleCount` bars fit in the usable
`width - 10` pixels. When `scrollToRealTime()` applies the 10px offset, all
`candleCount` candles remain visible. The offset becomes pure empty space.

**Pros:**
- Minimal code change (two subtractions)
- Exact — shows precisely the intended window
- Works for all resolutions and chart sizes
- Candles are negligibly narrower (0.5–1.25% at 800px)

**Cons:**
- Couples our code to KLineChart's internal constant
- If `DEFAULT_OFFSET_RIGHT_DISTANCE` is ever changed back, must update here too
- Both data-aware and fallback paths must be patched

### Option B: Extend data range by lost-candle count

Extend `currentRangeFrom` back by `ceil(10 / barSpace) * RESOLUTION_MS`
before binary-searching for the window start. Load extra data to compensate.

**How it works:** getBarSpace still uses `width / candleCount`, but
`candleCount` now includes the extra buffer candles. The leftmost visible
candle lands at the intended window start because the lost-candle offset
is absorbed by the buffer.

**Pros:**
- No coupling to KLineChart internals
- Bar spacing stays "clean" (full width / candles)
- Works even if offset changes

**Cons:**
- The visible window is slightly wider than intended (extra buffer visible)
- More data loaded than needed
- Chicken-and-egg: need barSpace to compute how many extra candles, but
  need candleCount to compute barSpace. Requires two-pass or estimation.
- `currentRangeFrom` no longer represents the exact left edge of the display

### Option C: Use setOffsetRightDistance(0) to eliminate the offset

After `applyNewData()` and `setBarSpace()`, call
`chart.setOffsetRightDistance(0, true)` to zero out the right-side gap.

**How it works:** `_lastBarRightSideDiffBarCount` becomes 0. The last candle
renders flush against the right edge. `adjustVisibleRange` no longer pushes
`from` to the right. All `candleCount` candles are visible.

**Pros:**
- Most precise — no approximation, no coupling to constant values
- barSpace calculation stays clean (full width)
- The viewport math is exact: `visibleBarCount = width / barSpace = candleCount`

**Cons:**
- No empty space for incoming live bars — current candle touches the right edge
- Must call after `applyNewData()` (which resets the offset internally)
- Live updates need the offset for new bars to animate in smoothly
- Visually cramped — traders expect some breathing room on the right

### Option D: scrollToDataIndex with manual left-edge control

After setting barSpace, find the dataIndex of the first window candle and
scroll so it lands at the left edge.

```
chart.setBarSpace((width - 10) / candleCount)
chart.scrollToDataIndex(lastIndex)   // positions lastIndex at right edge
// scrollToDataIndex puts the target at the right edge (with offset),
// so the first window candle naturally lands at the left edge
```

**How it works:** `scrollToDataIndex(lastIndex)` is equivalent to
`scrollToRealTime()` when the last data index is the target. Combined with
the offset-aware barSpace from Option A, it produces the same result.

**Pros:**
- Explicit — we control exactly which index is the rightmost visible bar
- Can be used to position arbitrary windows (not just "latest")
- Works with `scrollToTimestamp()` for time-based positioning

**Cons:**
- Same coupling to offset as Option A (need `(width - 10)` in barSpace)
- More verbose than `scrollToRealTime()` for the common case
- Only useful if we need non-realtime window positioning in the future
