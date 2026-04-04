# Custom X-Axis Design — Full Replacement via `registerXAxis`

**Date:** 2026-04-04
**Status:** Design document — pre-implementation, post-review
**Replaces:** KLineChart's built-in `_calcTicks()` → `optimalTicks()` → `_optimalTickLabel()` pipeline entirely
**Decision:** KLineChart's native x-axis is sub-par for professional trading. Full calendar-aware replacement — no hybrid, no `defaultTicks`.

---

## 1. Why Full Replacement

KLineChart's built-in x-axis generates ticks at evenly-spaced **data indices** (`nice(range/8)`), not at calendar boundaries. This produces label offsets of 3–11+ bars from actual month/quarter/year transitions. The `formatDate` API controls label text only — not positions.

Professional trading platforms (TradingView, Bloomberg, MetaTrader) all use calendar-aware tick placement at every zoom level. Mixing KLineChart's index-based base ticks with calendar-aligned boundary ticks would produce an inconsistent experience — some labels would land exactly on time boundaries while others float randomly between them. A full replacement is the only approach that meets professional standards.

### Why not the overlay approach

The investigation report (`x-axis-time-markers-report.md`) recommended overlay-based boundary labels as the primary approach (low effort, low risk). This was rejected because:

1. **Dual rendering systems**: Overlay labels and native ticks occupy the same x-axis space with no collision coordination. A boundary overlay label at "Apr" could overlap with a native "14:00" tick at an adjacent pixel.
2. **Grid lines stay misaligned**: `GridView` draws vertical grid lines at native tick positions. Overlay-based labels would not fix grid line misalignment — the grid would still be at evenly-spaced indices.
3. **Two systems to maintain**: Overlay labels for boundaries + native ticks for base = two independent rendering pipelines with different coordinate systems and collision logic.

`registerXAxis` gives unified control over all ticks (boundary + base) and grid lines in one place.

### API correction

The investigation report listed `setCustomApi({ createTicks })` as "API 4." This API **does not exist** in KLineChart 9.8.12. `setCustomApi` only supports `formatDate`. The only path to custom tick generation is `registerXAxis`.

### What we replace

- `createTicks({ range, bounding, defaultTicks })` — the single method that determines where ticks appear and what text they show

### What we keep (inherited from XAxisImp)

- `calcRange()` — visible bar range as data indices
- `convertToPixel(dataIndex)` — data index → pixel x coordinate
- `convertFromPixel(pixel)` — pixel → data index
- `convertTimestampToPixel(timestamp)` — timestamp → pixel
- `buildTicks()` — the orchestrator that calls our `createTicks`
- All axis rendering (axis line, tick lines, tick text, grid lines)
- All scroll/zoom handling (TimeScaleStore)

### `createTicks` contract (source-verified)

**Pipeline** (`buildTicks`, line 10216):
```
calcRange() → _calcTicks() → optimalTicks() → createTicks({ range, bounding, defaultTicks })
                                                              ↑ our override
```

Our returned `{ text, coord, value }[]` is stored directly as `this._ticks` — **no post-processing**. Every downstream consumer uses our output as-is.

**Required fields:**
- `coord` — **pixel X coordinate** (mandatory). Must be computed via `this.convertToPixel(dataIndex)`. KLineChart does NOT overwrite it.
- `text` — **display label** (mandatory). The string shown on the axis.
- `value` — **timestamp** (semantic). No downstream consumer reads it today (verified: AxisView uses `coord`+`text`, GridView uses `coord`, crosshair reads bar data directly). Set to bar timestamp for semantic correctness.

**Safety net:** Always add `if (result.length === 0) return defaultTicks;` as a guard clause.

### Downstream consumers

| Consumer | What it reads | Source line |
|----------|-------------|-------------|
| `AxisView.drawMain` | `tick.coord` + `tick.text` — renders axis line, tick lines, tick text | 9700-9734 |
| `GridView` | `tick.coord` only — draws vertical grid lines at each tick | 7541-7546 |
| Crosshair | **Does NOT use ticks** — reads `crosshair.kLineData.timestamp` directly | 11097 |

### `formatDate` coexistence

`formatDate` is **NOT dead code** after `registerXAxis`. Two consumers remain:
1. `optimalTicks` calls it before `createTicks` (wasted, but unavoidable without patching KLineChart)
2. `CrosshairVerticalLabelView` calls it independently for the crosshair time label (line 11097) — **this is critical**
Keep `formatDate` registered.

---

## 2. Design Constraints

### Constraint 1: Time Boundary Hierarchy

**Two separate concepts that must not be conflated:**

- **Boundary ranks** — calendar transitions that always get detected and labeled (year, quarter, month, week, day starts). These get suppression radii and label formatting rules.
- **Base tick intervals** — the regular spacing between boundaries (4H, 2H, 1H, 30MIN, etc.). These are selected by the interval matrix and suppressed by boundaries.

#### Boundary Ranks (5 levels)

| Rank | Boundary | Calendar Definition | Label (short) | Label (with context) |
|:----:|----------|--------------------|---------------|--------------------|
| 1 | YEAR | Jan 1, 00:00 UTC | `2026` | — |
| 2 | QUARTER | Jan/Apr/Jul/Oct 1, 00:00 UTC | `Q2` | `Q2 2026` |
| 3 | MONTH | 1st of month, 00:00 UTC | `Apr` | `Apr 2026` |
| 4 | WEEK | Sunday 00:00 UTC (forex) | `06 Apr` | `06 Apr 2026` |
| 5 | DAY | Every midnight UTC | `14` | `14 Apr` |

#### Base Tick Intervals (9 levels)

| Interval | Duration | Calendar Rule | Label Format |
|----------|----------|---------------|-------------|
| 12HOUR | 43,200,000 ms | 00:00, 12:00 UTC | `HH:mm` |
| 8HOUR | 28,800,000 ms | 00:00, 08:00, 16:00 UTC | `HH:mm` |
| 4HOUR | 14,400,000 ms | 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 | `HH:mm` |
| 2HOUR | 7,200,000 ms | Every even hour | `HH:mm` |
| 1HOUR | 3,600,000 ms | Every hour | `HH:mm` |
| 30MIN | 1,800,000 ms | Every 30 minutes | `HH:mm` |
| 15MIN | 900,000 ms | Every 15 minutes | `HH:mm` |
| 5MIN | 300,000 ms | Every 5 minutes | `HH:mm` |
| 1MIN | 60,000 ms | Every minute | `HH:mm` |

**Why BIDAY and BIWEEK are removed:** These are synthetic intervals with no standard calendar definition. "Every other Monday" is ambiguous (which anchor week?). TradingView does not use them. The gap between DAY→WEEK and WEEK→MONTH is filled by accepting fewer ticks in those ranges (8-9 instead of 11-13). This is acceptable — fewer meaningful labels are better than many ambiguous ones.

**Context promotion** — the longer label format is used when:
- The label is the **first visible tick** on the axis (trader needs temporal anchor)
- The **year changed** vs the previous visible label (show year suffix)
- The **month changed** vs the previous label for DAY-level ticks (show month)
- The **day changed** vs the previous label for intra-day ticks (show day prefix)

### Constraint 2: Resolution + Window → Tick Interval

The resolution (bar size) determines the finest meaningful tick interval. The visible time window determines how many ticks would appear. The system selects the coarsest interval that produces **8–18 ticks**.

---

## 3. Tick Interval Selection Matrix

### 3.1 Resolution Minimum Interval

Each resolution has a floor — you cannot show tick intervals finer than the bar size:

| Resolution | Bar Duration | Min Interval | Rationale |
|------------|-------------|-------------|-----------|
| M1 | 1 min | 1MIN | Can show every minute |
| M5 | 5 min | 5MIN | Sub-minute ticks would be within one bar |
| M10 | 10 min | 5MIN | 5-min ticks still distinguish bars |
| M15 | 15 min | 15MIN | Aligns with quarter-hour |
| M30 | 30 min | 30MIN | Aligns with half-hour |
| H1 | 1 hour | 1HOUR | Sub-hour ticks are within one bar |
| H4 | 4 hours | 1HOUR | Hourly is finest that makes sense |
| H12 | 12 hours | 4HOUR | 4H ticks still meaningful (3 per bar) |
| D1 | 1 day | DAY | Sub-day ticks are meaningless |
| W1 | 1 week | WEEK | Sub-week ticks are meaningless |
| MN1 | 1 month | MONTH | Sub-month ticks are meaningless |

### 3.2 Forex Bar Count Mathematics

Forex is 24/5 (24h trading days, 5 days/week). Actual bar counts per window:

| Resolution | Bars/Day | Bars/Week | Bars/Month (21 td) |
|------------|---------|-----------|-------------------|
| M1 | 1,440 | 7,200 | 30,240 |
| M5 | 288 | 1,440 | 6,048 |
| M15 | 96 | 480 | 2,016 |
| M30 | 48 | 240 | 1,008 |
| H1 | 24 | 120 | 504 |
| H4 | 6 | 30 | 126 |
| H12 | 2 | 10 | 42 |
| D1 | 1 | 5 | 21 |
| W1 | — | 1 | ~4.3 |

### 3.3 Complete Matrix: Resolution × Window → Tick Interval

Target: **8–18 ticks** for the visible range. BIDAY/BIWEEK removed — gaps filled by WEEK and MONTH.

#### Minute resolutions

| Resolution | Window | ~Bars | Tick Interval | ~Ticks | Example Labels |
|------------|--------|-------|--------------|--------|----------------|
| M1 | 1d | 1,440 | 2HOUR | 12 | `08:00 10:00 12:00 14:00 ...` |
| M1 | 2d | 2,880 | 4HOUR | 12 | `08:00 12:00 16:00 20:00 ...` |
| M5 | 1d | 288 | 30MIN | 16 | `08:00 08:30 09:00 09:30 ...` |
| M5 | 2d | 576 | 1HOUR | 16 | `08:00 09:00 10:00 11:00 ...` |
| M5 | 1W | 1,440 | 4HOUR | 15 | `Mon 08:00 12:00 16:00 ...` |
| M15 | 1d | 96 | 15MIN | 16 | `08:00 08:15 08:30 08:45 ...` |
| M15 | 2d | 192 | 30MIN | 16 | `08:00 08:30 09:00 09:30 ...` |
| M15 | 1W | 480 | 2HOUR | 15 | `08:00 10:00 12:00 14:00 ...` |
| M15 | 2W | 960 | 4HOUR | 15 | `Mon 08:00 12:00 16:00 ...` |
| M30 | 1d | 48 | 30MIN | 16 | `08:00 08:30 09:00 09:30 ...` |
| M30 | 2d | 96 | 1HOUR | 16 | `08:00 09:00 10:00 11:00 ...` |
| M30 | 1W | 240 | 4HOUR | 15 | `08:00 12:00 16:00 20:00 ...` |
| M30 | 2W | 480 | 8HOUR | 15 | `Mon 08:00 16:00 Tue 00:00 ...` |

#### Hour resolutions

| Resolution | Window | ~Bars | Tick Interval | ~Ticks | Example Labels |
|------------|--------|-------|--------------|--------|----------------|
| H1 | 1d | 24 | 2HOUR | 12 | `08:00 10:00 12:00 14:00 ...` |
| H1 | 2d | 48 | 4HOUR | 12 | `08:00 12:00 16:00 20:00 ...` |
| H1 | 1W | 120 | 8HOUR | 15 | `Mon 00:00 08:00 16:00 ...` |
| H1 | 2W | 240 | 12HOUR | 15 | `Mon 00:00 12:00 Tue 00:00 ...` |
| H1 | 1M | 504 | WEEK | ~4 | `03 Mar 10 Mar 17 Mar 24 Mar` |
| H1 | 3M | 1,512 | WEEK | ~13 | `03 Mar 10 Mar 17 Mar 24 Mar ...` |
| H1 | 6M | 3,024 | MONTH | ~6 | `Oct Nov Dec Jan Feb Mar` |
| H4 | 1W | 30 | 12HOUR | 10 | `Mon 00:00 Mon 12:00 Tue 00:00 ...` |
| H4 | 2W | 60 | DAY | 10 | `Mon Tue Wed Thu Fri Mon Tue ...` |
| H4 | 1M | 126 | WEEK | ~4 | `03 Mar 10 Mar 17 Mar 24 Mar` |
| H4 | 3M | 378 | WEEK | ~13 | `03 Mar 10 Mar 17 Mar 24 Mar ...` |
| H4 | 6M | 756 | MONTH | ~6 | `Oct Nov Dec Jan Feb Mar` |
| H4 | 1Y | 1,512 | MONTH | 12 | `Jan Feb Mar Apr May Jun Jul Aug ...` |
| H12 | 1M | 42 | WEEK | ~4 | `03 Mar 10 Mar 17 Mar 24 Mar` |
| H12 | 3M | 126 | WEEK | ~13 | `03 Mar 10 Mar 17 Mar 24 Mar ...` |
| H12 | 6M | 252 | MONTH | ~6 | `Oct Nov Dec Jan Feb Mar` |
| H12 | 1Y | 504 | MONTH | 12 | `Jan Feb Mar Apr May Jun Jul Aug ...` |
| H12 | 2Y | 1,008 | QUARTER | 8 | `Q1 Q2 Q3 Q4 Q1 Q2 Q3 Q4` |

#### Day-and-above resolutions

| Resolution | Window | ~Bars | Tick Interval | ~Ticks | Example Labels |
|------------|--------|-------|--------------|--------|----------------|
| D1 | 1M | 21 | WEEK | ~4 | `03 Mar 10 Mar 17 Mar 24 Mar` |
| D1 | 3M | 63 | WEEK | ~13 | `06 Jan 13 Jan 20 Jan 27 Jan ...` |
| D1 | 6M | 126 | MONTH | ~6 | `Oct Nov Dec Jan Feb Mar` |
| D1 | 1Y | 252 | MONTH | 12 | `Jan Feb Mar Apr May Jun Jul Aug ...` |
| D1 | 2Y | 504 | QUARTER | 8 | `Q1 Q2 Q3 Q4 Q1 Q2 Q3 Q4` |
| D1 | 5Y | 1,260 | YEAR | 5 | `2022 2023 2024 2025 2026` |
| D1 | 10Y | 2,520 | YEAR | 10 | `2017 2018 2019 2020 2021 ...` |
| W1 | 3M | 13 | MONTH | ~3 | `Jan Feb Mar` |
| W1 | 6M | 26 | MONTH | 6 | `Oct Nov Dec Jan Feb Mar` |
| W1 | 1Y | 52 | MONTH | 12 | `Jan Feb Mar Apr May Jun Jul Aug ...` |
| W1 | 2Y | 104 | QUARTER | 8 | `Q1 Q2 Q3 Q4 Q1 Q2 Q3 Q4` |
| W1 | 5Y | 260 | YEAR | 5 | `2022 2023 2024 2025 2026` |
| W1 | 10Y | 520 | YEAR | 10 | `2017 2018 2019 2020 2021 ...` |
| MN1 | 1Y | 12 | MONTH | 12 | `Jan Feb Mar Apr May Jun Jul Aug ...` |
| MN1 | 2Y | 24 | QUARTER | 8 | `Q1 Q2 Q3 Q4 Q1 Q2 Q3 Q4` |
| MN1 | 5Y | 60 | YEAR | 5 | `2022 2023 2024 2025 2026` |
| MN1 | 10Y | 120 | YEAR | 10 | `2017 2018 2019 2020 2021 ...` |

### 3.4 Programmatic Selection Algorithm

```
CONSTANTS:
  TARGET_MIN_TICKS = 8
  TARGET_MAX_TICKS = 18

  TICK_INTERVALS = [
    { name: "1MIN",   durationMs: 60_000,     rule: "roundMinute" }
    { name: "5MIN",   durationMs: 300_000,    rule: "roundMinute5" }
    { name: "15MIN",  durationMs: 900_000,    rule: "roundMinute15" }
    { name: "30MIN",  durationMs: 1_800_000,  rule: "roundMinute30" }
    { name: "1HOUR",  durationMs: 3_600_000,  rule: "roundHour" }
    { name: "2HOUR",  durationMs: 7_200_000,  rule: "roundHour2" }
    { name: "4HOUR",  durationMs: 14_400_000, rule: "roundHour4" }
    { name: "8HOUR",  durationMs: 28_800_000, rule: "roundHour8" }
    { name: "12HOUR", durationMs: 43_200_000, rule: "roundHour12" }
    { name: "DAY",    durationMs: 86_400_000, rule: "midnight" }
    { name: "WEEK",   calendar: true,          rule: "weekStart" }
    { name: "MONTH",  calendar: true,          rule: "monthStart" }
    { name: "QUARTER",calendar: true,          rule: "quarterStart" }
    { name: "YEAR",   calendar: true,          rule: "yearStart" }
  ]

  RESOLUTION_FLOOR = {
    "1m": "1MIN", "5m": "5MIN", "10m": "5MIN", "15m": "15MIN",
    "30m": "30MIN", "1h": "1HOUR", "4h": "1HOUR",
    "12h": "4HOUR", "D": "DAY", "W": "WEEK", "M": "MONTH"
  }

FUNCTION selectTickInterval(resolution, visibleSpanMs):
  floorIdx = TICK_INTERVALS.indexOf(RESOLUTION_FLOOR[resolution])

  // Walk coarsest → finest. Pick first interval yielding ≥ TARGET_MIN_TICKS.
  FOR i FROM TICK_INTERVALS.length-1 DOWNTO floorIdx:
    candidate = TICK_INTERVALS[i]
    tickCount = estimateTickCount(candidate, visibleSpanMs)

    IF tickCount >= TARGET_MIN_TICKS:
      IF tickCount > TARGET_MAX_TICKS AND i < TICK_INTERVALS.length-1:
        RETURN TICK_INTERVALS[i + 1]
      RETURN candidate
  END FOR

  // Fallback: if no interval meets minimum, use resolution floor
  // (accepts fewer than TARGET_MIN ticks rather than overflowing)
  RETURN TICK_INTERVALS[floorIdx]
```

**No caching needed.** `createTicks` only fires when `range.from/to` changes (KLineChart's own guard at line 10220). The interval selection is O(1) — walk a 14-entry array. Sub-millisecond.

---

## 4. Priority and Collision Resolution

### 4.1 Coincident Boundaries (Same Bar)

When multiple boundaries snap to the same bar, only the highest-rank label survives:

| Coincident | Winner | Label |
|------------|--------|-------|
| YEAR + QUARTER + MONTH + WEEK + DAY (Jan 1) | YEAR | `2026` |
| QUARTER + MONTH + DAY (Apr/Jul/Oct 1) | QUARTER | `Q2` or `Q2 2026` |
| MONTH + WEEK + DAY (e.g., May 1 on Monday) | MONTH | `May` |
| WEEK + DAY (any Monday) | WEEK | `05 May` |
| DAY + 12HOUR (midnight) | DAY | `14` or `14 Apr` |

### 4.2 Dynamic Suppression Radius

Suppression radii are computed from **actual label width**, not fixed pixel values. This avoids both over-suppression (wasted space) and under-suppression (overlapping labels).

```
FUNCTION computeSuppressionRadius(labelText, tickTextStyles):
  labelWidth = calcTextWidth(labelText, tickTextStyles.size, tickTextStyles.weight, tickTextStyles.family)
  RETURN Math.max(labelWidth / 2 + PADDING, MIN_FLOOR)

  WHERE:
    PADDING = 8px    // minimum gap between adjacent label edges
    MIN_FLOOR = 30px // absolute minimum clearance
```

For boundary-vs-base suppression, the radius is the boundary's label width / 2 + base tick's label width / 2 + gap:
```
FUNCTION computeCrossSuppression(boundaryLabel, baseLabel, styles):
  bw = calcTextWidth(boundaryLabel, styles)
  bw = calcTextWidth(baseLabel, styles)
  RETURN (bw + bw) / 2 + PADDING
```

`calcTextWidth` already exists in KLineChart (line 11200) and uses the same font metrics.

### 4.3 Two-Pass Algorithm

**Pass 1 — Boundary ticks:**
1. Scan visible range for calendar boundaries (year, quarter, month, week, day starts)
2. Snap each to the nearest bar at or after the boundary
3. Resolve coincident boundaries (highest rank wins)
4. Assign label text using format rules and context promotion
5. Apply suppression sweep (high-rank boundaries suppress nearby lower-rank boundaries)

**Pass 2 — Base (heartbeat) ticks:**
1. Generate **calendar-aligned** ticks at the selected interval (e.g., 00:00, 04:00, 08:00 for 4HOUR)
2. Skip any base tick that falls within a boundary's suppression zone
3. Base ticks use the simple format (HH:mm, DD, etc.)

**All ticks are calendar-aligned** — both boundary and base. This is the core of the full replacement. No bar-index spacing anywhere.

---

## 5. Grid Line Strategy

**Decision: Remove `calendarBoundary` overlays entirely.**

With full replacement, our ticks already land at calendar boundaries. `GridView` draws vertical grid lines at every `tick.coord` (line 7541). The grid lines ARE the boundary lines now. Keeping the overlay dashed lines would produce double-rendering (solid grid line + dashed overlay) at the same pixel position.

Professional platforms (TradingView) use a single set of uniform grid lines — they do not differentiate boundary vs. base grid line styles. The axis label text provides the visual distinction (YEAR labels are larger/bolder than time labels).

**Required change:** Remove `updateBoundaryOverlays` calls from `ChartDisplay.svelte` and remove `calendarBoundary` overlay registration from `customOverlays.js`.

---

## 6. Label Formatting

### 6.1 Format Selection Decision Tree

```
Is timestamp a year start?    → "YYYY"                      e.g. "2026"
Is timestamp a quarter start? → "Qn" or "Qn YYYY"          e.g. "Q2" / "Q2 2026"
Is timestamp a month start?   → "Mon" or "Mon YYYY"        e.g. "Apr" / "Apr 2026"
Is timestamp a week start?    → "DD Mon" or "DD Mon YYYY"  e.g. "06 Apr" / "06 Apr 2026"
Is timestamp a day start?     → "DD" or "DD Mon"           e.g. "14" / "14 Apr"
Otherwise (intra-day)?        → "HH:mm" or "DD HH:mm"     e.g. "14:00" / "07 14:00"
```

Context promotion (longer form) is used when:
- **Year changed** vs previous visible label → show YYYY
- **Month changed** vs previous label (for DAY level) → show Mon
- **Day changed** vs previous label (for intra-day) → show DD
- **First visible label** on the axis → always show maximum context

### 6.2 Format Examples by View

**4H chart, 3M window (Dec 2025 → Mar 2026):**
```
  Dec     ···  2026    ···  Feb     ···  Mar
  (month)      (year)        (month)      (month)
  + base ticks: 08:00  16:00  00:00  08:00  16:00  ...
```

**1H chart, 2W window (Mar 30 → Apr 13):**
```
  Mon 00:00  08:00  16:00  Q2  10:00  16:00  06 Apr  10:00  16:00  ...
  (day ctx)                ↑quarter               ↑week
```

**M15 chart, 1d window (Apr 3):**
```
  03 Apr  08:15  08:30  08:45  09:00  09:15  ...  22:30  22:45  23:00
  (day ctx)
```

**D1 chart, 1Y window:**
```
  Jan     Feb     Mar     Apr     May     Jun     Jul     Aug     Sep     Oct     Nov     Dec
  (month)                                                                  ↑ or "Oct 2026" if year boundary
```

---

## 7. Professional Platform Conventions (Reference)

### TradingView / Lightweight Charts
- **Calendar-aware tick generation** at all zoom levels
- **Business day skipping**: Weekend gaps represented naturally
- **Automatic format switching**: Time → date → month → year based on zoom level
- **Two-tier labels**: Major (boundary) + minor (between) with collision avoidance
- **Target 8–10 major labels** per view
- **Uniform grid lines** — no differentiation between boundary and base

### Bloomberg / MetaTrader
- **Compact format**: Drops year when all data is current year
- **Adaptive formatting**: MM YYYY for monthly, DD MMM for daily

### Forex-specific
- **UTC baseline**: All internal timestamps in UTC
- **Week starts Sunday** for forex (Sydney open), Monday for equities
- **Weekend gaps**: No candles plotted, axis shows date transitions at next Monday bar
- **Label density**: 40–60px minimum horizontal spacing between labels

---

## 8. Implementation Sketch

### 8.1 `registerXAxis` call

```javascript
import { registerXAxis } from 'klinecharts';

registerXAxis({
  name: 'calendar',
  createTicks({ range, bounding, defaultTicks }) {
    const chartStore = this.getParent().getChart().getChartStore();
    const dataList = chartStore.getDataList();
    const { from, to } = range;

    // Guard: empty or invalid range
    if (!dataList.length || from < 0 || to >= dataList.length || from > to) {
      return defaultTicks;
    }

    const fromTs = dataList[from].timestamp;
    const toTs = dataList[to].timestamp;
    const visibleSpanMs = toTs - fromTs;

    // 1. Select tick interval based on resolution + span
    const interval = selectTickInterval(currentResolution, visibleSpanMs);

    // 2. Generate boundary ticks (year/quarter/month/week/day starts)
    const boundaryTicks = generateBoundaryTicks(fromTs, toTs, dataList, this);

    // 3. Generate calendar-aligned base ticks at selected interval
    const baseTicks = generateBaseTicks(interval, fromTs, toTs, dataList, this);

    // 4. Compute dynamic suppression zones from actual label widths
    const { boundary, base } = applySuppression(boundaryTicks, baseTicks, chartStyles);

    // 5. Combine, sorted by coord
    const result = [...boundary, ...base].sort((a, b) => a.coord - b.coord);

    // Safety net: never return empty
    return result.length > 0 ? result : defaultTicks;
  }
});
```

### 8.2 Applying the custom axis

```javascript
// After chart creation
chart.setStyles({ xAxis: { name: 'calendar' } });
```

### 8.3 Key helpers to implement

| Function | Purpose | Pure function? |
|----------|---------|---------------|
| `selectTickInterval(resolution, spanMs)` | Returns the appropriate interval from the matrix | Yes |
| `generateBoundaryTicks(fromTs, toTs, dataList, axis)` | Detects calendar boundaries, snaps to bars, resolves coincident | Yes (uses axis only for `convertToPixel`) |
| `generateBaseTicks(interval, fromTs, toTs, dataList, axis)` | Generates calendar-aligned ticks at interval boundaries | Yes (uses axis only for `convertToPixel`) |
| `applySuppression(boundaryTicks, baseTicks, styles)` | Computes dynamic suppression zones, filters tick sets | Yes |
| `formatBoundaryLabel(ts, rank, prevTs)` | Formats boundary label with context promotion | Yes |
| `formatBaseLabel(ts, interval, prevTs)` | Formats base tick label | Yes |
| `snapToBar(ts, dataList)` | Binary search for first bar ≥ timestamp | Yes |

All helpers are **pure functions** (except `axis.convertToPixel` which is a coordinate lookup). They can be unit-tested independently.

### 8.4 Module-level state

`currentResolution` must be accessible to `createTicks`. Store as a module-level variable updated by `ChartDisplay.svelte` on resolution change:

```javascript
// In the same module as registerXAxis
let currentResolution = '4h';
export function setAxisResolution(resolution) { currentResolution = resolution; }
```

---

## 9. Edge Cases

| Case | Handling |
|------|---------|
| **Weekend gap at month boundary** | `snapToBar` finds next Monday bar. Label still shows calendar month ("Apr"), not the bar's day. |
| **Jan 1 coincides with everything** | YEAR wins. Label: `2026`. All other boundaries at that bar suppressed. |
| **Single bar visible** | Return one tick with full datetime: `"2026-04-03 14:00"` |
| **Quarter start = month start** | QUARTER wins (lower rank number). Apr 1 → `Q2`, not `Apr`. |
| **Very narrow view (<8 ticks)** | Accept fewer than TARGET_MIN. Never force more ticks than the calendar provides. |
| **Very wide view (>18 ticks)** | Step up to coarser interval. If still >18 at coarsest, evenly thin. |
| **Scroll into buffer** | `createTicks` is called on range change. `range.from/to` updates, algorithm re-evaluates. |
| **Forex week start (Sunday)** | Configurable `weekStartDay: 0` for forex. Week boundary is Sunday 00:00 UTC. |
| **Resolution/window pair below TARGET_MIN** | Accept the count. Do NOT fall through to resolution floor (which would produce hundreds of ticks). |

---

## 10. Files to Modify

| File | Change |
|------|--------|
| `src/lib/chart/chartConfig.js` | Add tick interval constants, `selectTickInterval`, boundary interval generators |
| `src/lib/chart/xAxisCustom.js` | **New file.** `registerXAxis` call, `createTicks`, all helper functions |
| `src/components/ChartDisplay.svelte` | Import and call `registerXAxis` before chart init, wire `currentResolution`, apply axis name, remove `updateBoundaryOverlays`, remove `calendarBoundary` overlay logic |
| `src/lib/chart/customOverlays.js` | Remove `calendarBoundary` overlay registration (replaced by grid lines) |
| `src/lib/chart/chartThemeLight.js` | X-axis label styling adjustments if needed |

---

## 11. Relationship to Existing Work

| Document / Code | Status After This Change |
|----------------|------------------------|
| `x-axis-time-markers-report.md` | Superseded by this design. Retained for KLineChart internals reference. |
| `date-marker-analysis.md` | "Fixed #1–4" sections obsoleted (formatDate no longer controls x-axis labels). Retained for data path documentation. |
| `chartConfig.js` `getCalendarBoundaryTimestamps` | Reused. Extended to return boundary type metadata. |
| `chartConfig.js` `generateMonthStarts/QuarterStarts/YearStarts` | Reused directly. |
| `ChartDisplay.svelte` `findFirstBarAtOrAfter` | Reused. Extracted to shared module. |
| `ChartDisplay.svelte` `formatAxisLabel` | **Kept** for crosshair formatting only (FormatDateType.Crosshair). X-axis formatting removed from it. |
| `customOverlays.js` `calendarBoundary` | **Removed.** Grid lines replace the dashed vertical lines. |

---

## Appendix A: Risk Analysis (Post-Review, Source-Verified)

### A.1 Module-level mutable state — SAFE

**Risk:** Module-level `currentResolution` could cause bugs with HMR, multiple chart instances, or test isolation.

**Verdict: Not a real risk.** The codebase enforces a single-chart constraint at three layers:

1. `Workspace.svelte:161` — `createChartDisplay()` updates existing chart instead of creating a second
2. `workspace.js:338` — `getChartDisplay()` returns a single object (not array)
3. No UI affordance for spawning multiple charts

HMR is safe: `createTicks` only fires when `range.from/to` changes (KLineChart guard at line 10220), which happens after data loads — well after HMR reconciliation and `setAxisResolution` call.

The existing `customOverlays.js` already uses module-level `registerOverlay` calls at import time — this is the established pattern.

**Decision:** Keep module-level variable with a guard comment:

```javascript
// Single-instance chart: safe to store as module state.
// If multi-chart is ever supported, replace with WeakMap keyed on chart instance.
let currentResolution = '4h';
```

### A.2 snapToBar performance — NOT A CONCERN

**Risk:** Binary search on large datasets could be slow.

**Verdict: Premature optimization.** The existing `findFirstBarAtOrAfter` is already O(log n) binary search. The "O(n log n)" concern is a misunderstanding — K calls × O(log n) is O(K log n), not O(n log n).

**Concrete worst case:**

| Scenario | Data Size | snapToBar Calls | Total Comparisons | Time |
|----------|-----------|----------------|-------------------|------|
| 4h / 3M (typical) | 378 | ~5 | 45 | <1μs |
| 1m / 1d (scrolled, cache full) | 260,000 | ~4 | 72 | <1μs |
| Custom axis worst case | 260,000 | 29 | 522 | <1μs |

The "2.5M bars" scenario is not achievable — `CACHE_MAX_BARS` caps M1 at 260K, H1 at 50K.

**Decision:** No caching. Binary search is already optimal.

### A.3 Timezone — UTC is correct for forex

**Risk:** Forex traders might expect exchange timezone labels.

**Verdict: UTC is the architecturally correct choice.**

1. Forex is 24/5 with no single exchange timezone — UTC is industry standard (MetaTrader, TradingView FX, Bloomberg all default to UTC for FX)
2. All data timestamps are epoch milliseconds from cTrader (inherently UTC)
3. All boundary generation uses `Date.UTC()` exclusively
4. `chart.setTimezone('UTC')` already set at `ChartDisplay.svelte:454`
5. `formatAxisLabel` already uses `getUTC*` methods

If timezone support is ever needed, it's a display-only change (label formatting), not a boundary math change. Boundary timestamps stay UTC.

**Decision:** Keep UTC. No changes needed.

### A.4 defaultTicks fallback — KEEP WITH LOGGING

**Risk:** If `createTicks` fails silently, reverting to `defaultTicks` shows misaligned index-based ticks.

**Verdict: Valid concern, but `defaultTicks` is better than the alternatives.**

`defaultTicks` arriving in `createTicks` is already formatted by our custom `formatAxisLabel` and positioned at pixel coordinates (via `optimalTicks` at line 11189). They are the same labels the user currently sees — not raw index strings. A fallback to `defaultTicks` is **identical to current behavior**, not a regression.

Returning empty array is worse — no axis labels, no grid lines, visually broken chart.

**Decision:** Keep `defaultTicks` fallback with diagnostic logging:

```javascript
if (result.length === 0) {
  console.warn('[calendarAxis] createTicks produced 0 ticks', {
    from, to, dataLen: dataList.length,
    fromTs, toTs, visibleSpanMs,
    resolution: currentResolution
  });
  return defaultTicks;
}
```
