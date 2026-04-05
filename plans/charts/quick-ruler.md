# Quick Ruler Feature

## Objective

Give traders a quick ability to measure price and time on charts by **right-click hold**. The ruler is transient (not persisted) and disappears on mouse release.

## Visual Design

- **Activation**: Right-click + hold anywhere on the chart canvas
- **Origin**: Fixed at the mousedown location
- **Current**: Follows the mouse cursor
- **Lines**: `#958f00` (dark gold), 1px stroke
- **Shape**: Diagonal line from origin to cursor, with a bounding box (horizontal + vertical lines forming a rectangle from origin to cursor)

```
  Origin ────────────────┐
    │                     │
    │     diagonal line    │
    │                   ╱  │
    │                 ╱    │
    │               ╱      │
    └─────────────╱────────┘
                Cursor
```

- **Data window**: Small info box, edge-aware positioned near the cursor (see Edge Cases)
- **Data window color**: Background `#958f00` (dark gold), text white, 12px font
- **Crosshair**: Hidden while ruler is active (restored on mouseup)
- All rendering disappears on mouseup (right-click release)

## Data Window Contents

The floating data box shows:

| Field | Label | Format | Example |
|-------|-------|--------|---------|
| Bar count | `bars` | Integer | `47` |
| Delta time | `time` | Human-readable duration | `3d 14h` |
| Delta price | `price` | Price with pip precision | `0.00342` |
| Delta price % | `%` | Percentage to 2 decimals | `0.28%` |
| Delta price ticks | `ticks` | Pip-based to 1 decimal | `34.2` |
| Price range | `range` | `high - low` with pip precision | `1.08432 - 1.08090` |

## Architecture

### Approach: DOM overlay + KLineChart coordinate conversion

The ruler is **not** a KLineChart overlay — it's a transient DOM element positioned over the chart canvas. This avoids the complexity of registering a custom overlay for a temporary, non-persisted interaction.

**Why not a KLineChart overlay?**
- Overlays require `totalStep` clicks and persist until explicitly removed
- The ruler is transient (hold-only) and doesn't need undo/redo or persistence
- DOM overlay gives us direct mouse tracking and easy tooltip positioning
- KLineChart overlays don't support real-time mouse-follow rendering

### Component: `QuickRuler.svelte`

A new Svelte component rendered inside `ChartDisplay.svelte`, absolutely positioned over the chart canvas.

```
src/components/QuickRuler.svelte    — ruler rendering + event handling
src/lib/chart/quickRulerUtils.js    — coordinate conversion + data formatting
```

### Coordinate Conversion Pipeline

```
mousedown/mousemove (px) ─→ chart.convertFromPixel() ─→ { dataIndex, timestamp, value }
                                                               │           │
                                                    timestamp    value (price)
                                                         │           │
                                                    chart.getDataList() ──→ bar array
                                                         │           │
                                              ┌──────────┼───────────┼──────────┐
                                              │          │           │          │
                                         bar count  time delta  price delta  range
                                              │          │           │          │
                                              └──────────┼───────────┼──────────┘
                                                                │
                                                         data window DOM
```

**Key APIs:**
- `chart.convertFromPixel([{ x, y }], { paneId: 'candle_pane' })` → `{ dataIndex, timestamp, value }` — `timestamp` can be `undefined` if dataIndex has no loaded bar
- `chart.getDataList()` → `Array<{ timestamp, open, high, low, close, volume }>` — authoritative bar data already loaded into chart
- `chart.setStyles()` / `chart.getStyles()` — for crosshair hide/show
- `getMarketDataStore(symbol)` — subscribe for `pipSize`, `pipPosition`, `open`

### Mouse Event Flow

Events bind to `chartContainer` (the parent div), NOT to the SVG overlay. The SVG overlay has `pointer-events: none` so it never intercepts mouse events. This is the same pattern used by the existing wheel handler at `ChartDisplay.svelte:493`.

```
chartContainer (native addEventListener in QuickRuler onMount)
  ├── contextmenu → preventDefault()
  ├── mousedown (button===2) → record origin, hide crosshair, show ruler
  ├── mousemove (while active) → update cursor, recalculate data
  └── mouseup (button===2) → hide ruler, restore crosshair, cleanup
```

**Event conflict analysis:**
- **KLineChart drawing tools**: Use left-click only. Right-click does not trigger overlay placement. No conflict.
- **interact.js**: Already ignores `.chart-canvas-container` (ChartDisplay.svelte:476). No conflict.
- **Wheel scroll**: Uses `wheel` event only. No conflict.
- **Price marker right-click**: Operates on a separate canvas (Day Range), not the KLineChart container. No conflict.
- **Drawing tool during ruler**: Right-click does NOT cancel in-progress overlay drawing. User presses Escape to cancel (existing pattern).

### Crosshair Management

When ruler activates: `chart.setStyles({ crosshair: { show: false } })`
When ruler deactivates: `chart.setStyles({ crosshair: { show: true } })`

This prevents visual noise from the gray crosshair overlapping the gold ruler lines.

## Implementation Steps

### Step 1: Create `quickRulerUtils.js`

File: `src/lib/chart/quickRulerUtils.js`

Functions:
- `pixelToDataPoint(chart, px, py)` — converts pixel coords to `{ dataIndex, timestamp, value }` using `chart.convertFromPixel([{ x: px, y: py }], { paneId: 'candle_pane' })`. Returns `null` if `dataIndex` is `undefined` (cursor beyond loaded data). Note: first arg must be an array of coordinate objects, not raw numbers.
- `calcBarCount(dataList, startIndex, endIndex)` — counts bars between two data indices using `Math.abs(endIndex - startIndex)`
- `calcDeltaTime(startTimestamp, endTimestamp)` — returns formatted duration string (`3d 14h`, `2h 30m`, `45m`). Handles `undefined` timestamps gracefully.
- `calcDeltaPrice(startPrice, endPrice, openPrice, pipSize)` — returns `{ delta, percent, ticks, range }`. `percent` is relative to `openPrice` if available.
- `formatRulerData(chart, marketData, origin, cursor)` — orchestrates all calculations, returns formatted data object for the data window.

Dependencies:
- `chart.getDataList()` for bar array access (not chartDataStore — chart already has authoritative data)
- `getMarketDataStore(symbol)` subscribe for `pipSize`, `pipPosition`, `open`
- `priceFormat.formatPrice()` for price formatting
- `calcDeltaPrice` computes raw pip value as `priceChange / pipSize`, formatted manually as `value.toFixed(1)` (bare number, no suffix — `formatPipMovement` returns a string with sign and "pips" suffix which is incompatible with the compact data window design)

### Step 2: Create `QuickRuler.svelte`

File: `src/components/QuickRuler.svelte`

Props:
- `chart` — KLineChart instance
- `chartContainer` — the DOM element (for event binding)
- `currentSymbol` — for market data store lookup

Internal state:
- `active` — boolean, controls display and event processing
- `bound` — boolean, prevents duplicate listener registration
- `origin` — `{ x, y }` pixel coords of mousedown
- `cursor` — `{ x, y }` pixel coords of current mouse position
- `rulerData` — calculated measurement data (or null)

Event binding (reactive `$:` on `chartContainer`):
- Uses native `addEventListener` on `chartContainer` for mousedown/mousemove/mouseup
- **CRITICAL**: Cannot use `onMount` — Svelte's `bind:this` defers assignment via `binding_callbacks`, but the prop update to the child requires a full re-render cycle. `chartContainer` is `null` when child's `onMount` fires. Instead, a reactive `$: if (chartContainer) bindListeners()` with a `bound` flag ensures listeners register exactly once when the prop arrives.
- `mouseup` also bound on `window` to handle release outside chartContainer
- Uses `getBoundingClientRect()` to compute pixel offsets within the container
- Guards all handlers with `if (!chart) return;` to handle chart destruction during symbol switch
- Cleans up all listeners in `onDestroy`

Rendering (SVG for crisp lines, all with `pointer-events: none`):
- SVG wrapper: `position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5;`
- Diagonal line: origin → cursor
- Bounding box: 4 lines forming a rectangle (top, right, bottom, left)
- Origin dot: 2px radius circle
- Data window: absolute positioned `<div>` at cursor with edge-aware positioning (see below)

**Edge-aware data window positioning:**
```
Default: top-left of cursor + 12px offset
If near right edge (window width > container width - cursor.x - 12px):
  → flip to left of cursor
If near bottom edge (window height > container height - cursor.y - 12px):
  → position above cursor
```

### Step 3: Integrate into `ChartDisplay.svelte`

Changes to `src/components/ChartDisplay.svelte`:
- Import `QuickRuler` component
- Wrap `chart-canvas-container` and `QuickRuler` in a `position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column` wrapper div. **CRITICAL**: QuickRuler must be a sibling inside a relative-positioned wrapper, NOT a direct child of `.chart-window`. `.chart-window` includes ChartHeader and ChartToolbar, so `position: absolute; top: 0` on QuickRuler's SVG would be relative to the entire window (including header), causing the ruler to render offset upward and be invisible behind the toolbar.
- Render `<QuickRuler {chart} {chartContainer} {currentSymbol} />` as a sibling of `chart-canvas-container` inside the wrapper

Note: `chartContainer` is already available as `bind:this={chartContainer}`.

### Step 4: Style and Polish

- Data window: `background: #958f00; color: #fff; font-size: 12px; padding: 4px 8px; border-radius: 3px; pointer-events: none; white-space: nowrap;`
- Lines: `stroke: #958f00; stroke-width: 1;`
- Font: inherit from chart theme (system font stack)
- Opacity: `opacity: 0.92` on the data window
- Z-index: SVG at 5 (above chart canvas, below toolbar at 15)

## Edge Cases

| Case | Handling |
|------|----------|
| Zero distance (mousedown without move) | Hide data window, show only origin dot |
| Cursor leaves chart area | Keep last known position, don't break |
| Mouseup outside chart container | `mouseup` also bound on `window` so ruler deactivates even if released outside |
| Right-click on toolbar/header | Event doesn't reach chart container (toolbar is sibling, not child) |
| Chart scroll/zoom while ruler active | Ruler coordinates are pixel-based; they become stale. Accept — ruler is a quick measurement, not a pinned annotation |
| No bars loaded yet | `chart.getDataList()` returns empty array; show `N/A` for time-based fields |
| `timestamp` undefined from convertFromPixel | Cursor is beyond loaded data range; show `N/A` for time-based fields |
| Very large delta time | Cap display at days (e.g., `142d` not `4m 22d`) |
| Negative price delta | Show `-` prefix naturally |
| Right-click during active drawing tool | Ruler activates; drawing tool unaffected. Escape cancels drawings (existing pattern) |
| Data window near right/bottom edge | Edge-aware positioning flips window to opposite side of cursor |

## Out of Scope

- Persisting ruler measurements
- Ruler as a drawing tool (toolbar button)
- Multiple simultaneous rulers
- Keyboard shortcut activation
- Configurable colors/styles
- Screen reader / aria-live announcements (V1)

## Design Decisions Log

| Decision | Rationale |
|----------|-----------|
| DOM overlay, not KLineChart registerOverlay | Overlays require multi-step clicks and persist; ruler is transient hold-and-release |
| Events on `chartContainer`, not SVG overlay | SVG with `pointer-events: none` cannot receive events; container already proven pattern (wheel handler) |
| `chart.getDataList()` instead of chartDataStore | Chart already holds authoritative data; avoids second store subscription; simpler sync |
| Hide crosshair during ruler | Prevents visual noise from gray crosshair overlapping gold ruler lines at cursor |
| 12px font, not 11px | WCAG AA contrast pass on `#958f00` background with white text at 12px |
| Right-click doesn't cancel drawing tools | Drawing tools use left-click only; no conflict. Escape is existing cancel pattern |
| Reactive listener binding, not onMount | Svelte `bind:this` defers via `binding_callbacks`; child's `onMount` fires before prop propagates. Reactive `$:` with `bound` flag registers listeners exactly once when `chartContainer` arrives |
| Wrapper div for positioning | QuickRuler as sibling of `chart-canvas-container` must share a `position: relative` parent, otherwise absolute positioning is relative to `.chart-window` (includes header/toolbar) |
| Window-level mouseup | `mouseup` bound on both `chartContainer` and `window` to handle release outside the chart area |
| Loose null guard in pixelToDataPoint | Uses `== null` (not `=== undefined`) to catch both `null` and `undefined` from convertFromPixel |
| Early pipPosition guard in formatRulerData | Returns all-N/A before calling `formatPrice`, which throws on null/undefined pipPosition |
