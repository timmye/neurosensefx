# X-Axis Time Markers — Investigation Report

**Date:** 2026-04-04
**KLineCharts version:** 9.8.12
**Status:** KLineChart native time axis is architecturally incapable of calendar-aligned ticks

---

## 1. Problem Summary

Calendar boundary labels (month starts, quarter starts, year starts) appear **3–11+ bars away** from the actual boundary. The dashed vertical boundary overlays render at the correct position (they bypass the tick system), but the x-axis text labels follow KLineChart's index-based tick spacing and cannot be forced onto calendar boundaries.

---

## 2. KLineChart X-Axis Architecture (Source-Code Verified)

### Tick Generation Pipeline

```
buildTicks()
  → calcRange()         // visible range as DATA INDICES (not timestamps)
  → _calcTicks()        // ~8 evenly-spaced data indices via nice(range/8)
  → optimalTicks()      // looks up bar data at each index, calls formatDate
  → _optimalTickLabel() // compares YYYY/YYYY-MM/MM-DD between ADJACENT TICKS
```

**Key source references** (`klinecharts/dist/index.esm.js`):

| Function | Line | What |
|----------|------|------|
| `AxisImp._calcTicks` | 10248 | `nice(range / 8.0)` → evenly spaced indices |
| `AxisImp._calcTickInterval` | 10268 | Always `nice(range/8)` — no calendar awareness |
| `XAxisImp.calcRange` | 11177 | Returns `{ from, to }` as data indices |
| `XAxisImp.optimalTicks` | 11189 | Maps indices → bars → timestamps → formatDate |
| `XAxisImp._optimalTickLabel` | 11252 | String comparison between tick timestamps |

### Why It Cannot Produce Calendar-Aligned Labels

1. **Ticks are index-based**: `_calcTicks()` generates ticks at data indices 0, 67, 134... These have zero relationship to calendar boundaries.
2. **Transition detection compares non-adjacent ticks**: `_optimalTickLabel` compares the current tick's date with the previous *displayed* tick's date (which may be 67 bars away). If both ticks are in the same month, the month transition is never shown — even if it falls between them.
3. **No API to inject tick positions**: `formatDate` controls text only. Tick positions are computed internally before `formatDate` is ever called.
4. **`_calcTickInterval` is not overridable**: The `nice(range/8)` logic is hardcoded in `AxisImp._calcTickInterval`.

### Quantified Offsets (from existing analysis)

| Resolution | Window | Tick interval | Month boundary offset |
|------------|--------|---------------|----------------------|
| 4H | 3M | ~67 bars (11 days) | 3–5+ days |
| Daily | 1Y | ~32 bars (32 days) | 8+ trading days |

---

## 3. KLineChart Customization APIs — Capability Assessment

### API 1: `setCustomApi({ formatDate })` — TEXT ONLY

Controls label text after positions are determined. Cannot move ticks.

| Aspect | Assessment |
|--------|-----------|
| Controls tick positions | NO |
| Controls transition detection | NO (string comparison of non-adjacent ticks) |
| Controls label text | YES |
| Effort | Low (already implemented) |
| **Verdict** | Already maxed out. Cannot solve the positioning problem. |

### API 2: `registerXAxis({ name, createTicks })` — CUSTOM TICK POSITIONS

Registers a custom x-axis via `XAxisImp.extend()`. The `createTicks` callback receives `{ range, bounding, defaultTicks }` and returns an array of `{ text, coord, value }`.

**Source verified** (line 11317-11329):
```javascript
XAxisImp.extend = function (template) {
    var Custom = function (_super) {
        Custom.prototype.createTicks = function (params) {
            return template.createTicks(params);  // your custom impl
        };
        return Custom;
    }(XAxisImp);
    return Custom;
};
```

**What you'd need to reimplement:**
- Calendar-aware tick placement (find bars at/near boundaries)
- Label collision avoidance (boundaries can cluster near weekends)
- Fallback evenly-spaced ticks when no boundaries visible
- Re-derive `convertToPixel` mapping (you get `range` as data indices)
- Handle all edge cases: single-bar view, zoomed far in/out

| Aspect | Assessment |
|--------|-----------|
| Controls tick positions | YES |
| Controls label text | YES |
| Must handle collision avoidance | YES |
| Must handle edge cases | YES |
| Effort | **Medium-high** |
| Risk | Collision bugs, missed edge cases |

### API 3: Overlay `createXAxisFigures` — RENDER ON X-AXIS

Draw arbitrary figures (text, rects, lines) on the x-axis area via overlays. Each overlay is positioned at a specific bar timestamp — the exact same mechanism already used for the boundary vertical lines.

**Source verified** (line 11066-11068):
```javascript
// OverlayXAxisView.getFigures:
overlay.createXAxisFigures?.({
    overlay, coordinates, bounding, barSpace,
    precision, dateTimeFormat, defaultStyles, xAxis, yAxis
})
```

Returns array of `{ type: 'text', attrs: { x, y, text, align } }` etc.

| Aspect | Assessment |
|--------|-----------|
| Controls positions | YES (timestamp-based, bar-accurate) |
| Controls label text | YES |
| Collision avoidance | Must handle manually |
| Already partially implemented | YES (calendarBoundary overlays exist) |
| Effort | **Low** |
| Risk | Low — builds on existing, proven overlay system |

### API 4: `setCustomApi({ createTicks })` — HYBRID APPROACH

Available since ~v9.5. Similar to `registerXAxis` but lighter — you override only `createTicks` while keeping default rendering. Receives `{ defaultTicks }` so you can modify rather than replace.

| Aspect | Assessment |
|--------|-----------|
| Controls tick positions | YES (can inject boundary ticks) |
| Keeps default ticks as fallback | YES |
| Must handle collision avoidance | YES |
| Effort | **Medium** |
| Risk | Moderate — mixing boundary + regular ticks |

---

## 4. External Library Options for Time Axis Display

### Option A: Replace Entire Chart — TradingView Lightweight Charts

**Repo:** [github.com/tradingview/lightweight-charts](https://github.com/tradingview/lightweight-charts)
**License:** Apache 2.0 | **Size:** ~40KB | **Version:** 4.x+

**Time axis capabilities:**
- **`TimeScaleFitContentProvider`**: Automatic time scale with calendar-aware ticks
- **`ITimeScaleApi`**: Full programmatic control over visible range, spacing
- **Business day awareness**: Skips weekends/holidays natively
- **Custom tick marks via `tickMarks` API**: Can place marks at arbitrary calendar positions
- Date transitions shown natively: "Jan 2026", "Feb", etc.
- **Markers API**: `series.setMarkers([{ time, position, text }])` — for annotations on the time axis

**Trade-offs:**
| Pro | Con |
|-----|-----|
| Purpose-built for financial charts | **Complete rewrite** of chart layer |
| Calendar-aware time axis out of the box | Different overlay/drawing system |
| ~40KB vs KLineCharts ~300KB | No built-in drawing tools (must implement) |
| Active TradingView maintenance | Migration of all indicators, overlays, drawings |
| Markers API for time-axis annotations | Different API paradigm |

**Migration scope estimate:** ~2000+ lines of chart-related code would need rewriting (ChartDisplay.svelte, customOverlays.js, drawingStore.js, chartConfig.js, indicators).

### Option B: Standalone Time Axis Component — d3-scale + d3-axis

**Repo:** [github.com/d3/d3-scale](https://github.com/d3/d3-scale) + [d3/d3-axis](https://github.com/d3/d3-axis)
**License:** ISC | **Size:** ~15KB combined

**Capabilities:**
- `d3.scaleTime()` — maps timestamps → pixels with calendar awareness
- `d3.axisBottom()` — generates SVG axis with automatic multi-level ticks
- **Multi-scale ticks**: Automatically shows years, months, days at different zoom levels
- `d3.timeMonth.every(1)`, `d3.timeYear.every(1)` — explicit calendar boundary ticks
- Fully customizable tick formatting via `.tickFormat()`
- Collision avoidance via `.ticks(count)` — controls max number of ticks

**How it could work with KLineChart:**
1. Hide KLineChart's built-in x-axis (`xAxis.show: false`)
2. Render a separate d3-axis below the chart
3. Synchronize zoom/scroll between KLineChart and d3 scale
4. KLineChart exposes `getVisibleRange()` → feed to d3 scale domain

**Trade-offs:**
| Pro | Con |
|-----|-----|
| Minimal dependencies (~15KB) | Must synchronize scroll/zoom manually |
| Perfect calendar-aware ticks | Must hide KLineChart's native axis |
| Battle-tested (d3 is production-grade) | Two coordinate systems to keep in sync |
| Can render date transitions at exact positions | Overlay labels still need the overlay approach |
| Low risk — additive, not destructive | Crosshair time label needs custom handling |

### Option C: ECharts

**Repo:** [github.com/apache/echarts](https://github.com/apache/echarts)
**License:** Apache 2.0 | **Size:** ~800KB

Overkill for just a time axis. Would require full chart replacement. Mentioned for completeness — not recommended for this use case.

### Option D: Plotly.js

**Repo:** [github.com/plotly/plotly.js](https://github.com/plotly/plotly.js)
**License:** MIT | **Size:** ~3MB

Ditto — full chart replacement, very heavy. Not recommended.

### Option E: Dedicated Time Axis Libraries

There are no standalone "time axis only" libraries that work as drop-in components. The closest options are:
- **d3-scale/d3-axis** (described above)
- **vis-timeline** (github.com/visjs/vis-timeline) — timeline visualization, not suitable for chart x-axis
- **react-calendar-timeline** / **chronos-ui** — React-specific, not relevant

---

## 5. Recommendation Matrix

| Approach | Effort | Risk | Calendar Accuracy | Maintains KLineChart |
|----------|--------|------|-------------------|---------------------|
| **A. Overlay `createXAxisFigures`** | Low | Low | Exact | Yes |
| B. `registerXAxis` custom axis | Med-high | Med | Exact | Yes |
| C. `createTicks` hybrid | Medium | Med | Exact | Yes |
| D. d3-scale addon axis | Medium | Low-Med | Exact | Yes (hidden native) |
| E. Replace with Lightweight Charts | Very high | High | Native | No |

---

## 6. Recommended Approach

### Primary: Overlay-Based Boundary Labels (Option A)

This is the approach already identified in your `date-marker-analysis.md`. It remains the best option:

1. **Extend existing `calendarBoundary` overlays** with `createXAxisFigures`
2. Each boundary overlay draws text on the x-axis at the exact snapped boundary bar
3. KLineChart's built-in ticks show simple time labels (HH:mm, DD-MM, etc.)
4. Boundary overlay labels show the transition: "Apr", "2026", "Q2 2026"

**Why this is best:**
- Overlay positions are already correct (timestamp-based, not index-based)
- Minimal code change — add one function to existing overlays
- No need to reimplement tick generation or collision avoidance
- The `formatDate` function simplifies to just returning primary display format

### Fallback: d3-scale addon axis (Option D)

If overlay-based labels prove insufficient (e.g., too many boundaries, collision issues), a d3 time axis rendered below KLineChart's hidden native axis gives full control with moderate effort.

### Not Recommended: Full Chart Replacement

Replacing KLineCharts with Lightweight Charts is the "nuclear option" — it would produce the best time axis but at the cost of rewriting ~2000+ lines of chart infrastructure (indicators, drawings, overlays, data stores). Only justified if other KLineChart limitations become blockers.

---

## 7. Key Source References

### KLineCharts (node_modules/klinecharts/dist/index.esm.js)
- `AxisImp._calcTicks`: line 10248 — evenly-spaced index ticks
- `AxisImp._calcTickInterval`: line 10268 — `nice(range/8)` hardcoded
- `XAxisImp.optimalTicks`: line 11189 — index→timestamp→formatDate
- `XAxisImp._optimalTickLabel`: line 11252 — string comparison between non-adjacent ticks
- `OverlayXAxisView.getFigures`: line 11066 — `createXAxisFigures` callback
- `registerXAxis`: line 11370 — custom axis registration
- `OverlayImp` constructor: line 1241 — overlay shape with `createXAxisFigures` field

### Project Code
- `ChartDisplay.svelte:64` — `formatAxisLabel` (KLineChart formatDate override)
- `ChartDisplay.svelte:109` — `updateBoundaryOverlays` (calendar boundary overlays)
- `chartConfig.js:278` — `getCalendarBoundaryTimestamps`
- `customOverlays.js` — overlay registration
