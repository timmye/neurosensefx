# Brief: Developing / Rolling Time Window Toggle

## Problem

The chart always uses **calendar-aligned** time windows. For example, "3M" snaps to the 1st of the month 3 months back **plus** the current developing month. A trader viewing "3M" in late April sees January 1 through April 30 — not a fixed 3-month lookback.

Professional traders also need a **rolling** mode: a fixed-duration window from today backwards. "3M rolling" always shows the last ~90 days of data regardless of calendar boundaries.

## Current Behavior

**Calendar-aligned** (always):
- `getCalendarAlignedRange('3M', 0)` → from: start of month 3 months ago (Jan 1), to: now
- The left edge snaps to calendar boundaries (Monday for weeks, 1st for months, quarter-start for 1Y, Jan 1 for multi-year)
- All windows use the same code path — no exceptions

### Pre-flight Consistency Fix

Audit found `getCalendarAlignedRange()` has a dead 1d/2d special case (lines 81-83) that:
- Ignores the `extraPeriods` parameter (hardcodes `* 2`)
- Produces the same result as the else fallback on line 98-99
- Adds unnecessary branching complexity

**Fix**: Remove the 1d/2d special case. The else fallback already handles unknown units correctly. This makes the function uniform for all window strings.

## Desired Behavior

A toolbar toggle button with two states:

| State | Label | Behavior |
|-------|-------|----------|
| **Developing** (default) | `Dev` | Current calendar-aligned behavior — left edge snaps to period boundary, includes developing period |
| **Rolling** | `Roll` | Fixed lookback from `Date.now()` — left edge = `now - windowMs`, right edge = `now`. No calendar alignment. |

Both modes use the same `WINDOW_MS` durations. The toggle is per-chart and persisted in workspace state.

## Codebase Impact

### 1. Time Window Computation — `src/lib/chart/chartTimeWindows.js`

**Pre-flight fix**: Remove the 1d/2d special case (lines 81-83). The else fallback (lines 97-99) already produces the same rolling result. This eliminates a dead branch and the `extraPeriods` bug.

**Add** `getRollingRange(windowStr, extraPeriods = 1)`:
```js
export function getRollingRange(windowStr, extraPeriods = 1) {
  const to = Date.now();
  const windowMs = WINDOW_MS[windowStr] ?? WINDOW_MS['3M'];
  return { from: to - windowMs * (1 + extraPeriods), to };
}
```

This is a pure rolling calculation — no calendar alignment. The `extraPeriods` parameter maintains the existing scroll-buffer pattern. All windows go through the same path in both modes.

### 2. Fetch Range Computation — `src/lib/chart/chartTickSubscriptions.js`

**Modify** `computeFetchRange(window)` (line 44) to accept a mode parameter:
```js
export function computeFetchRange(window, mode = 'developing') {
  const rangeFn = mode === 'rolling' ? getRollingRange : getCalendarAlignedRange;
  return {
    exact: rangeFn(window, 0),
    buffered: rangeFn(window, 1),
  };
}
```

### 3. Chart Display — `src/components/ChartDisplay.svelte`

**Modify** `handleWindowChange()` (line 275) — pass the mode through to `loadChartData()` and `setAxisWindow()`.

**Store** `windowMode` as local state (default: `'developing'`). Pass to bar space calculation and data loading.

### 4. Chart Toolbar UI — `src/components/ChartToolbar.svelte`

**Add** a toggle button in the window row (line 178-191), after the window groups and before the source button separator (line 191):

```
[1d|2d] | [1W|2W] | [1M|3M|6M] | [1Y|2Y|5Y|10Y] | [Dev/Roll] | [TradingView] | [tz] | [theme]
```

- Uses existing `.action-btn.active` pattern (same as `Mag` toggle)
- Props: `export let windowMode = 'developing'`
- Dispatches `'windowModeChange'` event on click
- Label: `Dev` (default) / `Roll` (when rolling)

### 5. Workspace Persistence — `src/stores/workspace.js`

**Add** `windowMode` to the display state saved/restored in workspace. Currently saves `resolution` and `window` (line ~119). Add `windowMode: display.windowMode || 'developing'`.

### 6. Bar Space — `src/lib/chart/chartBarSpace.js`

The bar space calculation uses `windowToMs(window)` which returns fixed millisecond durations — this is **mode-independent** and needs **no changes**. Rolling and developing windows of the same label (e.g., "3M") produce the same candle count.

### 7. X-Axis Labels — `src/lib/chart/calendarBoundaries.js` / `xAxisTickGenerator.js`

The x-axis label system uses `TRANSITION_MATRIX` and `WINDOW_TIER` to determine label density. These are **mode-independent** — both modes show the same candle density. Labels will naturally reflect the rolling boundary (no special handling needed).

## Files Changed

| File | Change |
|------|--------|
| `src/lib/chart/chartTimeWindows.js` | Remove dead 1d/2d special case, add `getRollingRange()` export, update JSDoc |
| `src/lib/chart/chartTickSubscriptions.js` | `computeFetchRange()` accepts mode parameter |
| `src/lib/chart/chartDataLoader.js` | `loadChartData()` accepts and passes `windowMode` |
| `src/lib/chart/chartConfig.js` | Re-export `getRollingRange` |
| `src/components/ChartToolbar.svelte` | Add Dev/Roll toggle button with `windowMode` prop |
| `src/components/ChartDisplay.svelte` | Add `currentWindowMode` state, `reloadChartSetting()` helper, `handleWindowModeChange()` |
| `src/stores/workspace.js` | Persist `windowMode` in `chartGhost` save and `addChartDisplay` restore |

## Quality Review Fixes Applied

- **MUST**: `windowMode` restored from `chartGhost` in `addChartDisplay` (was saved but not restored)
- **MUST**: Stale JSDoc referencing removed 1d/2d special case updated
- **SHOULD**: Comment added explaining day window else-branch behavior and extraPeriods intent
- **SHOULD**: Extracted `reloadChartSetting()` to deduplicate `handleWindowChange` / `handleWindowModeChange`

## Out of Scope

- Backend changes — time range is calculated client-side, server receives `from`/`to` timestamps
- `ALL` window — not affected (shows all available data)
- Keyboard shortcut for toggle — can be added later if desired
