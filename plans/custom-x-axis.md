# Custom Calendar X-Axis Implementation Plan

**Source spec:** `docs/chart/x-axis-custom-axis-design.md`
**Machine-readable plan:** `plans/calendar-xaxis-plan.json`

## Overview

Replace KLineChart's index-based x-axis with a fully custom calendar-aware implementation via `registerXAxis`. Two-pass algorithm generates boundary ticks (year/quarter/month/week/day) and base interval ticks with dynamic label-width suppression.

### Critical API Correction (DL-002)

The design doc assumes `this.convertToPixel` is available inside `createTicks`. **Source verification proves otherwise** — `template.createTicks(params)` at KLineChart line 11324 is called without `.call(this)`, so `this` is the plain template object, NOT the XAxisImp instance. The fix is a module-level chart instance using `chart.convertToPixel()` public API.

---

## Wave 1 — Foundation (M-001)

### Files: `src/lib/chart/xAxisCustom.js` (new), `src/lib/chart/chartConfig.js`

#### 1. Add constants to `chartConfig.js`

- `TICK_INTERVALS` — 14-entry array from 1MIN to YEAR with `durationMs` and calendar rule
- `RESOLUTION_FLOOR` — map of 11 resolutions to minimum interval names

#### 2. Create `xAxisCustom.js` with these exports

| Function | Purpose |
|----------|---------|
| `registerXAxis({ name: 'calendar', createTicks })` | KLineChart registration (called at import time) |
| `createTicks({ range, bounding, defaultTicks })` | Main callback: selects interval → generates boundaries → generates base → suppresses → returns sorted `{text, coord, value}[]` |
| `selectTickInterval(resolution, spanMs)` | Returns coarsest interval yielding ≥8 ticks, subject to resolution floor |
| `generateBoundaryTicks(fromTs, toTs, dataList, chart)` | Detects 5 boundary ranks, snaps to bars, resolves coincident (YEAR > QUARTER > MONTH > WEEK > DAY) |
| `generateBaseTicks(interval, fromTs, toTs, dataList, chart)` | Calendar-aligned ticks at selected interval |
| `applySuppression(boundaryTicks, baseTicks, styles)` | Dynamic text-width-based suppression radius, MIN_FLOOR 30px, PADDING 8px |
| `formatBoundaryLabel(ts, rank, prevTs)` | YEAR→YYYY, QUARTER→Qn/Qn YYYY, MONTH→Mon/Mon YYYY, WEEK→DD Mon, DAY→DD/DD Mon |
| `formatBaseLabel(ts, interval, prevTs)` | Sub-day→HH:mm/DD HH:mm, DAY→DD/DD Mon, context promotion |
| `snapToBar(targetTs, dataList)` | Binary search, returns bar timestamp or null (extracted from ChartDisplay) |
| `setAxisChart(chart)` | Module-level chart instance setter |
| `setAxisResolution(resolution)` | Module-level resolution setter |

#### Key design points

- All helpers are pure functions (except `chart.convertToPixel` dependency)
- `createTicks` accesses `dataList` via `chart.getDataList()` and coords via `chart.convertToPixel([{dataIndex}], {paneId:'candle_pane'})`
- Context promotion: first tick gets max context, year suffix on year change, day prefix on day change
- Safety net: `if (result.length === 0) { console.warn(...); return defaultTicks; }`
- Module-level state is safe (single-chart constraint at 3 layers)
- Week starts Sunday (weekStartDay: 0) for forex

---

## Wave 2 — Integration (M-002)

### Files: `ChartDisplay.svelte`, `customOverlays.js`, `chartThemeLight.js`

#### ChartDisplay.svelte changes

**Add:**
- Import `{ setAxisChart, setAxisResolution }` from `xAxisCustom.js`
- In `onMount` after `chart = init(...)`: call `setAxisChart(chart)`, `setAxisResolution(currentResolution)`, then `chart.setStyles({ xAxis: { name: 'calendar' } })`
- In `handleResolutionChange`: call `setAxisResolution(newResolution)`

**Remove:**
- `updateBoundaryOverlays()` function (line 109) and all calls
- `removeBoundaryOverlays()` function (line 141) and all calls
- `boundaryOverlayIds` variable (line 44)
- `getCalendarBoundaryTimestamps` import (no longer needed in ChartDisplay)
- `getWindowTier` import
- X-axis formatting from `formatAxisLabel` (the `type === 2` / primary display path)

**Keep:**
- `formatDate` / `setCustomApi({ formatDate })` — still needed for crosshair vertical label
- The transition detection strings in `formatAxisLabel` (type === 2, format !== 'HH:mm' paths) — `optimalTicks` calls these before `createTicks`
- `findFirstBarAtOrAfter` — can stay as local function in ChartDisplay for now (xAxisCustom has its own `snapToBar`)

#### customOverlays.js changes

**Remove** the `calendarBoundary` registerOverlay block (lines 100-126). Grid lines now come from registerXAxis ticks.

#### chartThemeLight.js

**No changes.** Existing `xAxis.tickText` (Helvetica Neue, 11px, #666666) provides font metrics for suppression radius via `chart.getStyles().xAxis.tickText`.

---

## Wave 3 — Tests (M-003)

### File: `src/lib/chart/__tests__/xAxisCustom.test.js`

All pure function tests, no KLineChart runtime needed:

1. **selectTickInterval** — all 11 resolutions satisfy RESOLUTION_FLOOR; standard resolution+window combos yield 8-18 ticks; fallback to floor for narrow views
2. **snapToBar** — exact match, weekend gap (returns Monday), past-range (null), empty list, single element
3. **formatBoundaryLabel / formatBaseLabel** — each rank produces correct format; context promotion on year/month/day change; first tick gets max context
4. **Coincident boundaries** — Jan 1 → YEAR wins; Apr 1 → QUARTER wins; May 1 Monday → MONTH wins; Monday → WEEK wins
5. **Suppression** — base ticks within radius removed; outside radius survive; MIN_FLOOR 30px enforced; empty boundaries = all base ticks survive

---

## Implementation Order

```
M-001 (Foundation) → M-002 (Integration) → M-003 (Tests)
     │                      │
     │                      └─ verify: calendar labels, grid alignment, crosshair still works
     │
     └─ verify: all helpers pure, no KLineChart dependency in helpers
```
