# Chart Date/Time Marker System — Analysis & Findings

## Core Problem

**Time axis transition labels appear at wrong positions — offset by many bars from actual calendar boundaries.** The boundary overlays (dashed vertical lines) are placed correctly, but the text labels on the time axis are displaced because KLineChart generates ticks at evenly-spaced data indices, not at calendar boundaries. The `formatDate` API only controls label TEXT, not tick POSITIONS.

---

## Data Path (Verified Correct)

Timestamps travel from cTrader to KLineChart without corruption:

| Stage | Transformation | Location |
|-------|---------------|----------|
| cTrader API | `utcTimestampInMinutes` (minutes since epoch, uint32) | Protobuf spec: `OpenApiModelMessages.proto:521` |
| Backend | `minutes * 60 * 1000` → milliseconds | `CTraderDataProcessor.js:123`, `CTraderEventHandler.js:22` |
| WebSocket | Passed through unchanged | `DataRouter.js`, `MessageBuilder.js` |
| Frontend store | Sort + dedup only | `chartDataStore.js` |
| KLineChart | Stored as-is, `new Date(timestamp)` for display | No conversion in library |

Historical bars load with period-aligned timestamps (e.g., 4H bars at 08:00, 12:00, 16:00 UTC). Live M1 aggregation correctly updates OHLC values and preserves the original bar timestamp via `...last` spread.

---

## True Root Cause: KLineChart Tick Placement vs Calendar Boundaries

### How KLineChart Generates Ticks

KLineChart's time axis tick generation is a 3-step pipeline, all operating on **data indices** (bar positions), not timestamps:

**Step 1: `calcRange()`** — gets visible range as data indices (`klinecharts/index.esm.js:11177-11187`)

```javascript
var from = chartStore.getTimeScaleStore().getVisibleRange().from;
var to = chartStore.getTimeScaleStore().getVisibleRange().to;
return { from, to: to - 1, range: to - from };
```

**Step 2: `_calcTicks()`** — generates ~8 evenly-spaced data indices (`klinecharts/index.esm.js:10248-10266`)

```javascript
var interval = nice(realRange / 8.0);  // "nice" number ≈ range/8
var first = Math.ceil(realFrom / interval) * interval;
// ticks at: first, first+interval, first+2*interval, ...
```

**Step 3: `optimalTicks()`** — looks up bar data and calls `formatDate` (`klinecharts/index.esm.js:11189-11250`)

```javascript
var pos = parseInt(ticks[i].value, 10);   // data index
var kLineData = dataList[pos];             // bar at that index
var timestamp = kLineData.timestamp;       // bar's timestamp
var text = formatDate(dateTimeFormat, timestamp, 'HH:mm', XAxis);
```

**Critical insight**: ticks are placed at indices 0, 67, 134, 201... — evenly-spaced across the data array. These indices have no relationship to calendar boundaries.

### How Transition Detection Works (And Fails)

KLineChart's `_optimalTickLabel` (`klinecharts/index.esm.js:11252-11265`) detects transitions by comparing timestamps of **adjacent ticks** (not adjacent bars):

```javascript
// For each tick (after thinning for label collision):
var prevPos = parseInt(ticks[i - tickCountDif].value, 10);  // previous tick's index
var prevTimestamp = dataList[prevPos].timestamp;
text = this._optimalTickLabel(formatDate, dateTimeFormat, timestamp, prevTimestamp);
```

`_optimalTickLabel` compares YYYY, YYYY-MM, MM-DD strings between current and previous tick:

```javascript
if (year !== comparedYear) return year;      // year changed between ticks?
if (month !== comparedMonth) return month;   // month changed between ticks?
if (day !== comparedDay) return day;         // day changed between ticks?
return null;                                 // no transition
```

### Quantified Offset

For 4H resolution at 3M window:
- ~540 bars in the data array
- ~8 ticks generated, interval ≈ 67 bars
- Each tick interval = 67 × 4H = 268 hours ≈ 11 days
- Month boundary at bar 186, nearest tick at bar 201 → **3 days offset**
- Weekend gap at month start → **up to 5+ days offset**

For daily resolution at 1Y window:
- ~260 trading days
- ~8 ticks, interval ≈ 32 bars
- Each tick interval = 32 days
- Month boundary at bar 120, nearest tick at bar 128 → **8 trading days offset**

**This is the "large margin" the user sees.** The transition labels appear many bars away from where the boundary overlays are drawn.

### Why Boundary Overlays Are Correct

The `calendarBoundary` overlays (`ChartDisplay.svelte:109-139`) bypass KLineChart's tick system entirely. They:
1. Generate timestamps at exact calendar boundaries (midnight UTC, 1st of month, etc.)
2. Snap each boundary to the first bar at or after that boundary via `findFirstBarAtOrAfter`
3. Create an overlay with `points: [{ timestamp: barTs }]`
4. KLineChart maps the overlay timestamp to a pixel coordinate via `binarySearchNearest` on the data list

The overlays ARE at the correct positions. The labels are NOT — because they follow KLineChart's index-based tick spacing, not the calendar boundary positions.

---

## Previously Fixed Root Causes (2026-04-04)

These four issues were identified and fixed in `formatAxisLabel` (`ChartDisplay.svelte:64-92`). The fixes are correct and in place, but they only address the LABEL TEXT — they do not fix tick positioning.

### Fixed #1: formatAxisLabel comparison strings
**Was**: Tier-based formatting applied to YYYY/YYYY-MM/MM-DD comparison strings. MONTHLY/QUARTERLY/YEARLY tiers returned identical strings for all ticks in the same period, preventing transition detection.
**Fix**: Return pure date components for comparison formats. Tier logic only on `'HH:mm'` primary display.

### Fixed #2: ▸ prefix breaking regex matching
**Was**: `▸ ` prefix on all returned strings prevented KLineChart's first-tick regex matching (`/^[0-9]{2}-[0-9]{2}$/` etc.).
**Fix**: No prefix anywhere. Visual distinction via boundary overlays.

### Fixed #3: Timezone mismatch
**Was**: `getUTC*()` methods disagreed with KLineChart's browser-local `DateTimeFormat`.
**Fix**: `chart.setTimezone('UTC')` after initialization.

### Fixed #4: Missing `'YYYY-MM-DD HH:mm'` handler
**Was**: Single-tick view fell through to `dateTimeFormat.format()` with inconsistent output.
**Fix**: Explicit handler returning ISO-formatted datetime.

---

## KLineChart API Assessment

### Why `formatDate` Alone Cannot Solve This

`setCustomApi({ formatDate })` controls **label text only**. KLineChart decides tick POSITIONS internally via `_calcTicks()` → `optimalTicks()`. The `formatDate` callback is called AFTER positions are determined. There is no way to influence tick positions through this API.

### Available APIs

| API | Controls | Tick Positions | Transition Detection | Collision Avoidance | Complexity |
|-----|----------|---------------|---------------------|--------------------|----|
| `formatDate` | Label text only | KLineChart (index-based) | Automatic (string comparison) | Automatic | Low |
| `createTicks` | Tick positions + text | Custom | Must reimplement | Must handle | Medium-high |
| `registerXAxis` | Full custom axis | Custom | Must reimplement | Must handle | High |
| Overlay `createXAxisFigures` | Text at arbitrary positions | On existing bars (via timestamp) | N/A (manual) | Must handle | Low |

### Recommended Approach: Overlay-Based Boundary Labels

The most practical solution is to extend the existing `calendarBoundary` overlay with `createXAxisFigures` to draw boundary labels directly on the X-axis at the exact boundary bar position.

**How it works**:
1. KLineChart's built-in ticks show simple, consistent labels (time or date via `formatDate`)
2. The `calendarBoundary` overlay draws a dashed vertical line AND a label on the X-axis
3. The overlay is positioned at the exact snapped boundary bar (already correct)
4. Boundary overlay labels show the transition text: "Apr", "2026", "Q2 2026" etc.
5. KLineChart's `_optimalTickLabel` transition detection becomes irrelevant — we bypass it entirely

**Why this works**:
- Overlay positions are based on bar timestamps, not evenly-spaced indices
- The overlay is already placed at the correct boundary bar
- `createXAxisFigures` gives access to the X-axis rendering area
- No need to reimplement tick generation or collision avoidance
- The `formatDate` function only needs to return simple, consistent labels

**Required changes**:
1. Update `calendarBoundary` overlay registration in `customOverlays.js` to add `createXAxisFigures`
2. The X-axis figure draws text at `coordinates[0].x` position
3. Simplify `formatDate` to return only the primary display format (no tier-based complexity needed)
4. Boundary overlay label text determined by boundary type (month start → "Apr", year start → "2026", etc.)

### Alternative Approaches

**`createTicks` via `setCustomApi`**: Generate ticks at calendar boundary positions instead of evenly-spaced indices. Must handle:
- Label collision avoidance (boundaries can cluster near weekends)
- Fallback spacing when no boundaries are visible
- Reimplementing the "nice interval" logic with calendar awareness
Medium-high effort. Risk of introducing collision bugs.

**`registerXAxis`**: Complete custom axis implementation. Maximum control but highest complexity. Would need to handle all axis rendering, including the non-boundary ticks. High effort.

**Different charting library**: Libraries like Lightweight Charts (TradingView) natively support calendar-aligned time axes. This is a nuclear option — would require rewriting the entire chart layer.

---

## KLineChart Source Code Evidence

Key functions in `klinecharts/index.esm.js`:

| Function | Line | What it does |
|----------|------|-------------|
| `XAxisImp.calcRange` | 11177 | Gets visible range as data indices |
| `AxisImp._calcTicks` | 10248 | Generates evenly-spaced data index ticks (~8 ticks) |
| `AxisImp._calcTickInterval` | 10268 | `nice(range / 8.0)` for tick spacing |
| `XAxisImp.optimalTicks` | 11189 | Looks up bar data, calls formatDate, detects transitions |
| `XAxisImp._optimalTickLabel` | 11252 | Compares YYYY/YYYY-MM/MM-DD between adjacent ticks |

Key functions in our code:

| Function | File | Line | What it does |
|----------|------|------|-------------|
| `formatAxisLabel` | `ChartDisplay.svelte` | 64 | KLineChart formatDate override |
| `updateBoundaryOverlays` | `ChartDisplay.svelte` | 109 | Creates calendar boundary overlays |
| `findFirstBarAtOrAfter` | `ChartDisplay.svelte` | 98 | Snaps boundary timestamp to nearest bar |
| `getCalendarBoundaryTimestamps` | `chartConfig.js` | 278 | Generates boundary timestamps for a window |
| `generateMonthStarts` | `chartConfig.js` | 236 | Month-start timestamps via `Date.UTC` |
| `generateQuarterStarts` | `chartConfig.js` | 246 | Quarter-start timestamps |
| `generateYearStarts` | `chartConfig.js` | 257 | Year-start timestamps |
