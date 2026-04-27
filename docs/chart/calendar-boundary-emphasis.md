# Scope: Calendar Boundary Visual Emphasis

## Problem

The x-axis grid and labels use uniform styling for all calendar boundaries. A trader viewing a weekly chart sees month, quarter, and year transitions rendered identically to week transitions. Professional traders need visual hierarchy — major calendar transitions (month, quarter, year) should be visually distinct from minor ones (week, day).

## Current Architecture

### What KLineChart Controls

| Element | API | Per-tick control? |
|---------|-----|-------------------|
| Vertical grid line | `grid.vertical: StateLineStyle` | No — single global style |
| Axis text label | `xAxis.tickText: AxisTickTextStyle` | No — single global style |
| Tick mark | `xAxis.tickLine: AxisTickLineStyle` | No — single global style |

`AxisTick` is `{ coord, value, text }` — no style fields. KLineChart draws one vertical grid line per returned tick, all with the same `grid.vertical` style.

### What Our Code Controls

`generateTicks()` in `xAxisTickGenerator.js` already identifies boundary levels via `RANK`:
- YEAR=1, QUARTER=2, MONTH=3, WEEK=4, DAY=5, HOUR=6

The rank flows through `collectCandidates` → `dedupCandidates` → `emitLabeledTicks` but is **dropped** in the final output. KLineChart never sees it.

### Suppression Capabilities

| Element | Can suppress individually? | Mechanism |
|---------|--------------------------|-----------|
| **Text label** | Yes | Return `text: ''` in tick — KLineChart skips label, grid line still renders |
| **Grid line** | No | No per-tick on/off. Only `grid.vertical.show: true/false` (all or nothing) |
| **Tick mark** | No | Tied to tick presence, not text content |

## Proposed Approach: Additive Overlays

Keep the existing uniform grid and label system intact. Overlay custom-drawn elements **only at major boundaries** on top of the built-in rendering.

### Grid Lines

- **Keep** `grid.vertical` enabled (thin dashed lines at all ticks)
- **Overlay** thicker opaque vertical lines at MONTH, QUARTER, YEAR boundaries
- The thicker overlay line covers the thin built-in line beneath it
- Minor boundaries (WEEK, DAY, HOUR) keep the thin uniform style

### Text Labels

- Return `text: ''` for major boundary ticks in `emitLabeledTicks()` to suppress built-in labels
- **Overlay** custom styled text at those positions
- Minor boundary labels render normally via the existing system

### Result

| Boundary | Grid line | Label |
|----------|-----------|-------|
| WEEK, DAY, HOUR | Thin dashed (built-in) | Normal (built-in) |
| MONTH | 2px solid overlay (covers built-in) | Bold overlay (replaces suppressed built-in) |
| QUARTER | 3px solid overlay | Bold overlay |
| YEAR | 4px solid overlay | Bold overlay |

## Implementation

### 1. Emit Boundary Ranks from Tick Generator

**File**: `src/lib/chart/xAxisTickGenerator.js`

Currently `emitLabeledTicks()` drops the `rank` field. Modify to return `rank` alongside `text`, `coord`, `value`:

```js
// Current output (consumed by KLineChart)
{ text, coord, value }

// New output — KLineChart ignores extra fields
{ text, coord, value, rank }
```

KLineChart's `AxisTick` type only uses `{ coord, value, text }` — extra properties are silently ignored. No breaking change.

Additionally, for major boundary ticks (rank <= RANK_MONTH), return `text: ''` to suppress the built-in label so the overlay can replace it.

### 2. Boundary Emphasis Overlay

**File**: `src/lib/chart/boundaryEmphasisOverlay.js` (new)

Register a custom overlay via `registerOverlay()` that:
- Uses `createXAxisFigures` callback to draw custom elements at major boundary positions
- Reads boundary positions from the tick generator's rank output
- Draws vertical lines with per-rank styling (width, color, opacity)
- Draws text labels with per-rank styling (weight, size, color)

The overlay needs access to the current window's TRANSITION_MATRIX levels and the chart's data list to compute boundary positions independently (same approach as `collectCandidates`).

```js
registerOverlay({
  name: 'boundaryEmphasis',
  needDefaultPointFigure: false,
  createXAxisFigures({ overlay, coordinates, bounding }) {
    // Compute major boundary positions for visible range
    // Return array of OverlayFigure objects:
    return [
      { type: 'line', attrs: { x1, y1, x2, y2 }, styles: { lineWidth, color } },
      { type: 'text', attrs: { x, y, text }, styles: { weight, size, color } },
    ];
  }
});
```

### 3. Create Overlay Instance Per Chart

**File**: `src/components/ChartDisplay.svelte`

Create a `boundaryEmphasis` overlay instance on chart init, similar to how `symbolWatermark` and indicators are created. Remove on dispose.

### 4. Theme Integration

**Files**: `src/lib/chart/chartThemeDark.js`, `src/lib/chart/chartThemeLight.js`

Define per-rank boundary styles in theme config:

```js
export const BOUNDARY_EMPHASIS_STYLES = {
  MONTH:  { lineWidth: 2, color: 'rgba(...)' },
  QUARTER: { lineWidth: 3, color: 'rgba(...)' },
  YEAR:   { lineWidth: 4, color: 'rgba(...)' },
};
```

## Key Design Decisions

### Why additive overlays, not full replacement?

- Keeps existing grid/label system intact — lower risk
- Only major boundaries need custom rendering — fewer elements to manage
- Thin grid line underneath overlay is invisible (covered by opaque wider line)
- No need to redraw all grid lines or manage full grid lifecycle

### Why overlay, not canvas draw hooks?

- KLineChart doesn't expose pre/post render hooks for custom canvas drawing
- Overlay system is the supported extension point for custom chart graphics
- Overlays participate in KLineChart's coordinate system (auto-adjust on zoom/pan)

### Rank threshold configuration

The minimum rank for emphasis should be configurable. Default: emphasize MONTH (rank 3) and above. This aligns with the TRANSITION_MATRIX — any boundary that appears as a "coarse" level in any window should be emphasis-eligible.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/chart/xAxisTickGenerator.js` | Include `rank` in tick output, suppress text at major boundaries |
| `src/lib/chart/boundaryEmphasisOverlay.js` | New — custom overlay for per-rank line + label rendering |
| `src/lib/chart/chartThemeDark.js` | Add `BOUNDARY_EMPHASIS_STYLES` dark theme config |
| `src/lib/chart/chartThemeLight.js` | Add `BOUNDARY_EMPHASIS_STYLES` light theme config |
| `src/components/ChartDisplay.svelte` | Create/remove boundary emphasis overlay instance |

## Out of Scope

- Modifying KLineChart's internal grid rendering
- Per-tick tick mark styling (tick marks are too small to benefit)
- User-configurable boundary emphasis thresholds
- Horizontal grid line changes
- Interaction with the rolling time window toggle (orthogonal — overlay reads boundaries, not mode)
