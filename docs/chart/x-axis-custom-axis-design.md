# Architecture: Custom Calendar X-Axis

## Overview

The custom x-axis replaces KLineChart's built-in index-based tick pipeline (`_calcTicks` -> `optimalTicks`) with calendar-boundary tick placement via `registerXAxis`. Ticks land exactly at year, quarter, month, week, day, and hour boundaries. The visible time window selects which levels to show through a hardcoded transition matrix.

## Architecture

### Module State

`xAxisCustom.js` holds two module-level variables:

- `_chart` -- KLineChart instance, set via `setAxisChart(chart)`
- `_window` -- time window string (e.g. `'3M'`), set via `setAxisWindow(window_)`, defaults to `'3M'`

`setAxisResolution` is exported as a no-op for backward compatibility; resolution no longer drives tick behavior.

### Registration

`registerXAxis({ name: 'calendar', createTicks(...) })` registers a custom axis implementation with KLineChart. `ChartDisplay.svelte` activates it via:

```javascript
chart.setPaneOptions({ id: 'x_axis_pane', axisOptions: { name: 'calendar' } });
```

KLineChart calls `createTicks` whenever the visible range changes. The returned `{ text, coord, value }[]` becomes `this._ticks` with no post-processing. `coord` is pixel-X, `text` is the display label, `value` is the bar timestamp.

### Safety Net

If `createTicks` returns empty, `defaultTicks` is returned with a `console.warn`. This preserves KLineChart's native ticks rather than rendering a blank axis.

### Downstream Consumers

| Consumer | What it reads | Behavior |
|----------|--------------|----------|
| `AxisView.drawMain` | `tick.coord` + `tick.text` | Renders axis line, tick marks, labels |
| `GridView` | `tick.coord` only | Draws vertical grid lines at each tick |
| Crosshair | Bar data directly | Does NOT use ticks |

## Transition Matrix

Defined in `chartConfig.js`, consumed by `generateTicks`. Each window maps to an ordered list of calendar levels (coarse to fine). The last entry is the finest level and produces the most ticks.

| Window | Levels (coarse to fine) | Finest |
|--------|------------------------|--------|
| `1d`   | YEAR, QUARTER, MONTH, DAY, HOUR | HOUR |
| `2d`   | YEAR, QUARTER, MONTH, DAY, HOUR | HOUR |
| `1W`   | YEAR, QUARTER, MONTH, WEEK, DAY | DAY |
| `2W`   | YEAR, QUARTER, MONTH, WEEK, DAY | DAY |
| `1M`   | YEAR, QUARTER, MONTH, WEEK, DAY | DAY |
| `3M`   | YEAR, QUARTER, MONTH, WEEK | WEEK |
| `6M`   | YEAR, QUARTER, MONTH, WEEK | WEEK |
| `1Y`   | YEAR, QUARTER, MONTH | MONTH |
| `2Y`   | YEAR, QUARTER, MONTH | MONTH |
| `5Y`   | YEAR, QUARTER | QUARTER |
| `10Y`  | YEAR, QUARTER | QUARTER |

**Higher-order transitions are inclusive.** A `1d` window spanning Dec 31 to Jan 1 shows the YEAR boundary. A `1W` window spanning Mar 28 to Apr 4 shows both MONTH and WEEK boundaries.

## Algorithm: generateTicks

```
generateTicks(fromTs, toTs, dataList, chart):
  1. Look up TRANSITION_MATRIX[_window] for ordered levels
  2. For each level (coarse to fine):
     a. alignToBoundary(fromTs, level) to find first boundary at or after fromTs
     b. Walk forward with the level's step function (nextYear, nextQuarter, etc.)
     c. snapToBar each boundary -- binary search for nearest bar
     d. Convert snapped bar index to pixel coord via barCoord(chart, idx)
     e. Collect { ts, snappedTs, coord, rank } candidate
  3. Sort candidates by coord
  4. Deduplicate: when multiple boundaries snap to the same bar, keep highest rank
     (lowest rank number -- YEAR=1 beats QUARTER=2)
  5. Format labels with context tracking (see Label Formatting below)
  6. Rank-priority MIN_FLOOR suppression (30px gap):
     - If gap >= MIN_FLOOR: emit tick with text
     - If gap < MIN_FLOOR and current rank < last visible rank: demote last visible
       label (set text=''), emit current label
     - If gap < MIN_FLOOR and current rank >= last visible rank: suppress current
       (set text=''), keep tick coord/value so the tick mark still renders
```

### snapToBar

Binary search for the bar closest to a target timestamp. If an exact match exists, returns that timestamp. Otherwise returns whichever neighbor is closer in time.

### Calendar Boundary Generators

| Level | Alignment | Step function |
|-------|-----------|---------------|
| YEAR | Jan 1, 00:00 UTC | +1 year |
| QUARTER | Jan/Apr/Jul/Oct 1, 00:00 UTC | +3 months |
| MONTH | 1st of month, 00:00 UTC | +1 month |
| WEEK | Sunday 00:00 UTC (forex convention) | +7 days |
| DAY | Midnight UTC | +1 day |
| HOUR | Top of hour | +1 hour |

## Label Formatting

`formatBoundaryLabel(ts, rank, prevTs)` formats each tick label. Context is tracked relative to the previous **emitted** tick (the last tick that had non-empty text after suppression).

| Rank | Always | Context promotion (when year/month/day changed vs prev) |
|------|--------|--------------------------------------------------------|
| YEAR (1) | `"YYYY"` | -- |
| QUARTER (2) | `"Qn"` | `"Qn YYYY"` when year changed |
| MONTH (3) | `"Mon"` | `"Mon YYYY"` when year changed |
| WEEK (4) | `"DD"` | `"DD Mon"` when month changed; `"DD Mon YYYY"` when year changed |
| DAY (5) | `"DD"` | `"DD Mon"` when month or year changed |
| HOUR (6) | `"HH:MM"` | `"DD HH:MM"` when day, month, or year changed |

## Integration: ChartDisplay.svelte

Three setters are called to wire the custom axis:

| Setter | Called from |
|--------|------------|
| `setAxisChart(chart)` | `onMount` -- passes the KLineChart instance |
| `setAxisWindow(window)` | `onMount`, `handleResolutionChange`, `handleWindowChange` |
| `setAxisResolution(res)` | `onMount`, `handleResolutionChange` -- no-op in current impl |

Window changes do NOT trigger on scroll. The user chose the window and expects window-level labels to persist during panning.

## formatDate vs registerXAxis

Two separate rendering paths exist:

- **`registerXAxis` (calendar)**: Controls x-axis tick positions and labels. `createTicks` returns `{ text, coord, value }[]` that KLineChart renders as axis ticks and grid lines.

- **`formatAxisLabel` in ChartDisplay.svelte**: Registered via `chart.setCustomApi({ formatDate })`. Handles KLineChart's crosshair/tooltip time display. Uses `getWindowTier(currentWindow)` for tier-based formatting (INTRADAY, DAILY, WEEKLY, MONTHLY, QUARTERLY, YEARLY). Also provides transition-detection strings (`'YYYY'`, `'YYYY-MM'`, `'MM-DD'`) for KLineChart's internal `_optimalTickLabel` comparison.

These are independent. The custom axis does not call `formatAxisLabel`. The crosshair does not use custom axis ticks.

## WINDOW_TIER / getWindowTier

`WINDOW_TIER` in `chartConfig.js` maps windows to tier strings. `getWindowTier()` is consumed by `formatAxisLabel` for crosshair/tooltip formatting. This mapping is semantically redundant with `TRANSITION_MATRIX` -- both encode window-to-granularity relationships. Unification is deferred.

| Window | WINDOW_TIER | TRANSITION_MATRIX finest |
|--------|-------------|------------------------|
| `1d`, `2d` | INTRADAY | HOUR |
| `1W`, `2W` | DAILY | DAY |
| `1M` | WEEKLY | DAY |
| `3M`, `6M` | MONTHLY | WEEK |
| `1Y` | QUARTERLY | MONTH |
| `2Y`, `5Y`, `10Y` | YEARLY | QUARTER |

## Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `MIN_FLOOR` | 30 px | Minimum gap between adjacent label centers |
| `WEEK_START_DAY` | 0 (Sunday) | Forex week convention |
| `RANK` | YEAR=1, QUARTER=2, MONTH=3, WEEK=4, DAY=5, HOUR=6 | Boundary priority ordering |

## Boundaries

- **Single-chart assumption**: Module-level state (`_chart`, `_window`) works because the codebase enforces one chart instance. Multi-chart support requires a WeakMap keyed on chart instance.
- **UTC everywhere**: All boundary math uses `Date.UTC()` and `getUTC*()` methods. Forex has no single exchange timezone; UTC is industry standard.
- **No resolution awareness in generateTicks**: If daily bars are viewed at a `1d` window, hour boundaries produce no ticks because there are no intraday bars to snap to. No special-casing needed.
