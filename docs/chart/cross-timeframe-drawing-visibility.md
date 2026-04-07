# Design Decision Record: Cross-Timeframe Drawing Visibility

**Date:** 2026-04-06
**Status:** Tier 1 (Pin Mode) Selected for Implementation
**Author:** Product/UX Analysis
**Scope:** Chart drawing system (drawingStore, drawingCommands, ChartDisplay, OverlayContextMenu)

---

## 1. Problem Statement

Currently, drawings (trendlines, horizontal levels, rectangles, Fibonacci retracements, etc.) are isolated per chart timeframe. A horizontal support level drawn on the Weekly chart is invisible when the trader switches to 4H. Traders need to see higher-timeframe levels (yearly support/resistance, weekly trendlines) on lower-timeframe charts because those levels drive entry/exit decisions.

### Current System Architecture

- **Storage:** Drawings are keyed by `[symbol+resolution]` in both IndexedDB (Dexie) and PostgreSQL (`drawings` table with `UNIQUE(user_id, symbol, resolution)`)
- **Restoration:** `ChartDisplay.svelte` calls `restoreDrawings(symbol, resolution)` which loads only the drawings for the current resolution
- **Resolution switching:** `handleResolutionChange()` calls `chart.removeOverlay()` (destroys all visible overlays), then `restoreDrawings()` for the new resolution only
- **Drawing types:** 11 custom overlay types registered via KLineChart's `registerOverlay()` (see section 3)
- **Context menu:** Currently supports only Delete and Lock/Unlock per overlay
- **Selection:** Single-overlay only via `selectedOverlayId` scalar (see section 7)

### Timeframe Hierarchy (Existing)

```
1m < 5m < 10m < 15m < 30m < 1h < 4h < 12h < D < W < M
```

Defined in `chartConfig.js` `RESOLUTION_GROUPS` and `RESOLUTION_MS`.

---

## 2. Approach Survey (Condensed)

Seven approaches were evaluated in full detail during initial exploration. Summary:

| Approach | UX | Effort | Key Trade-off |
|---|---|---|---|
| A: Per-drawing visibility checkboxes | Medium | Med-High | Most control, tedious in bulk |
| B: Filter up/down toggle buttons | Low | Medium | Simplest, but all-or-nothing |
| C: Auto-propagate down | Low | Medium | Zero-config, but chart clutter |
| D: Drawing layers/groups | High | High | Most powerful, overkill |
| E: Master/linked charts | Med-High | High | Multi-chart only |
| **F: Pin/Favorites** | **Low** | **Low** | **Solves core case, minimal code** |
| G: Hierarchy rules + depth | Medium | Medium | Smart defaults, abstract UX |

**Decision:** Tier 1 = Pin/Favorites (Approach F). Defer auto-propagate (C+G) and per-drawing visibility (A) until user feedback validates demand.

**Important:** Pin is timeframe-agnostic. A drawing pinned on 4H is visible on Weekly, Daily, 1H, 15m, etc. -- all TFs for that symbol, in both directions. The common use case is higher-TF levels on lower-TF charts, but a key 4H support level can be just as important to see on Weekly. The fade + lock styling applies to any non-origin TF, regardless of hierarchy position.

---

## 3. Pin Mode -- Deep Design

### 3.1 All Drawing Types and Pin Compatibility

Every registered overlay must support pinning. Analysis of each type's pin rendering behavior:

| Overlay Type | Points | Pin Rendering Notes |
|---|---|---|
| **horizontalRayLine** | 1 | Price-only, no timestamp dependency. Renders as horizontal line at price level spanning full chart width regardless of visible candle range. **Simplest case.** |
| **rectOverlay** | 2 (corners) | Rectangle with fill. Timestamps may fall outside visible range -- clip to visible area, or extend range minimally. |
| **circleOverlay** | 2 (center + edge) | Circle. Center may be outside visible range. Render partial arc if center is offscreen. |
| **polygonOverlay** | 3 | Triangle. Same clipping concern as rect. Partial rendering at boundaries. |
| **arcOverlay** | 3 (center, start, end) | Arc. Partial rendering likely when timeframe delta is large. |
| **arrowOverlay** | 2 (tail -> head) | Line with filled arrowhead. Timestamp range issue -- may only render partial arrow. |
| **simpleAnnotation** | 1 | Vertical dashed line + text bubble. Timestamp may be outside range -- text won't render. |
| **simpleTag** | 1 | Horizontal dashed line full width. Price-only like horizontalRayLine. **Simple case.** |
| **rulerPriceLine** | 1 | Dashed horizontal line with price label. Same as simpleTag for cross-TF purposes. |
| **parallelStraightLine** | 3 | Two parallel lines. Both timestamp range issues apply. |
| **fibonacciLine** | 2 | Multiple horizontal levels. Price-only lines, similar to horizontalRayLine. Each level renders independently. **Simple case.** |

**Key insight:** Three categories of drawing types exist for cross-TF rendering:

1. **Price-only** (horizontalRayLine, simpleTag, rulerPriceLine, fibonacciLine) -- No timestamp dependency. Render at price level across full width. These work perfectly cross-TF.
2. **Two-point shapes** (rectOverlay, circleOverlay, arrowOverlay, parallelStraightLine) -- Need both price and time coordinates. May partially render when points fall outside visible candle range.
3. **Multi-point shapes** (polygonOverlay, arcOverlay) -- Same concern as two-point, but more points increase the chance of range mismatch.

### 3.2 Consistent Styling Modifier: 50% Faded

All pinned drawings rendered on a non-origin timeframe get a **consistent style modification** to visually distinguish them:

**Rule: Apply 50% opacity reduction to all style color properties.**

Implementation approach -- create a `fadeStyles(styles, factor)` utility that processes every color in an overlay's style object:

```javascript
// src/lib/chart/styleUtils.js (new file)

/**
 * Recursively fade all color properties in an overlay styles object.
 * Converts hex/rgb/rgba colors by multiplying alpha or prepending opacity.
 */
export function fadeStyles(styles, factor = 0.5) {
  if (!styles) return styles;

  const faded = { ...styles };

  // KLineChart style structure has nested objects: line, rect, polygon, circle, text, point
  const COLOR_KEYS = ['color', 'borderColor', 'backgroundColor', 'fill'];

  for (const [key, value] of Object.entries(faded)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      faded[key] = fadeStyles(value, factor);  // recurse into nested style objects
    } else if (COLOR_KEYS.includes(key) && typeof value === 'string') {
      faded[key] = fadeColor(value, factor);
    }
  }

  return faded;
}

function fadeColor(color, factor) {
  // Handle hex colors: #RRGGBB -> rgba(R, G, B, factor)
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${factor})`;
  }
  // Handle rgba: extract and replace alpha
  if (color.startsWith('rgba')) {
    return color.replace(/[\d.]+\)$/, `${factor})`);
  }
  // Handle rgb: convert to rgba
  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${factor})`);
  }
  return color;  // unknown format, return as-is
}

/**
 * Add a TF badge to a pinned drawing's extendData.
 * Used for annotations/tags that support text.
 */
export function withOriginBadge(extendData, originResolution) {
  const badge = `[${originResolution}]`;
  if (typeof extendData === 'string') {
    return `${badge} ${extendData}`;
  }
  if (extendData == null) {
    return badge;
  }
  return extendData;  // non-string extendData, leave as-is
}
```

**Visual result for each drawing type:**

| Drawing Type | Faded Appearance | Additional Indicator |
|---|---|---|
| horizontalRayLine | Line at 50% opacity + price label shows `[W]` suffix (e.g., "1.0850 [W]") | TF badge on y-axis label |
| rectOverlay | Fill and border at 50% opacity | N/A (shape is self-evident) |
| circleOverlay | Border and fill at 50% opacity | N/A |
| polygonOverlay | Border and fill at 50% opacity | N/A |
| arrowOverlay | Line and arrowhead at 50% opacity | N/A |
| simpleAnnotation | Dashed line at 50% opacity, text bubble faded | Text prefixed with `[4H]` or origin TF |
| simpleTag | Dashed line at 50% opacity | Price label with TF badge |
| rulerPriceLine | Dashed line at 50% opacity | Price label with TF badge |
| parallelStraightLine | Both lines at 50% opacity | N/A |
| fibonacciLine | All Fibonacci levels at 50% opacity | Level labels with TF badge |
| arcOverlay | Arc line at 50% opacity | N/A |

**Consistency principle:** Every drawing type uses the exact same fade factor (0.5). No special cases. The only variation is the TF badge on price labels where available.

### 3.3 Locked on Non-Origin Timeframe

**Rule:** Pinned drawings are ALWAYS locked when rendered outside their origin timeframe.

This uses KLineChart's native `lock: true` property, which causes the overlay to not respond to any mouse events (no drag, no select, no context menu).

```javascript
// In restoreDrawings(), when creating a pinned drawing from a different timeframe:
const isForeign = drawing.resolution !== currentResolution;
const opts = {
  id: isForeign ? `${drawing.overlayId}_pinned_${drawing.resolution}` : drawing.overlayId,
  name: drawing.overlayType,
  points: drawing.points,
  styles: isForeign ? fadeStyles(drawing.styles, 0.5) : drawing.styles,
  lock: isForeign,  // native KLineChart lock -- prevents all interaction
  extendData: isForeign ? withOriginBadge(drawing.extendData, drawing.resolution) : drawing.extendData,
  // ... overlay callbacks only for non-foreign (origin TF) drawings
};
```

**Key behaviors:**
- **No context menu** on foreign pinned drawings (locked = no right-click event)
- **No drag/resize** on foreign pinned drawings
- **No selection** of foreign pinned drawings (locked overlays don't enter selected state)
- **To edit/delete** a pinned drawing: switch to its origin timeframe, where it renders at full opacity and is interactive

### 3.4 Overlay ID Collision Avoidance

KLineChart overlay IDs are unique per chart instance. When loading pinned drawings from other timeframes, the same `overlayId` may already exist (e.g., a pinned drawing from 4H loaded on the 4H chart itself uses its normal ID).

**Solution:** Compound ID format for foreign pinned drawings:
```
{originalOverlayId}_pinned_{originResolution}
```

Example: A horizontal line with `overlayId` "overlay_abc" pinned from Weekly renders on 4H as `"overlay_abc_pinned_W"`.

**ID mapping:** Maintain a `Map` in ChartDisplay to track foreign IDs back to their database records:

```javascript
// Maps compound overlay ID -> drawing database record
const pinnedOverlayMap = new Map();  // "overlay_abc_pinned_W" -> { dbId, overlayId, resolution, ... }
```

This map is rebuilt on every `restoreDrawings()` call (after `chart.removeOverlay()` clears everything).

### 3.5 Data Model Changes

#### IndexedDB Schema Migration (v1 -> v2)

```javascript
// drawingStore.js
db.version(2).stores({
  drawings: '++id, [symbol+resolution], [symbol+pinned], overlayType, createdAt'
});
```

New `pinned` field defaults to `false` for all existing drawings. No data migration needed -- Dexie handles missing fields as `undefined` (falsy).

#### Drawing Record (Enhanced)

```javascript
{
  // ... existing fields ...
  pinned: Boolean,   // false = TF-isolated, true = visible on all TFs
}
```

PostgreSQL JSONB automatically accepts the new field without schema migration.

### 3.6 DrawingStore Changes

```javascript
// New method in drawingStore.js

/**
 * Load all pinned drawings for a symbol, regardless of resolution.
 * Returns drawings where pinned === true for the given symbol.
 */
async loadPinned(symbol) {
  return db.drawings
    .where('[symbol+pinned]')
    .equals([symbol, 1])  // Dexie boolean index: 1 = true
    .toArray();
}
```

**Note:** Dexie indexes booleans as 0/1. The `[symbol+pinned]` compound index enables efficient querying of "all pinned drawings for symbol X" without scanning all resolutions.

### 3.7 ChartDisplay Changes

The `restoreDrawings()` flow is modified to load both TF-local and pinned foreign drawings:

```javascript
async function restoreDrawings(symbol, resolution) {
  if (!chart) return;

  // 1. Load drawings for current timeframe (existing behavior)
  const localDrawings = await drawingStore.load(symbol, resolution);

  // 2. Load pinned drawings from ALL timeframes
  const allPinned = await drawingStore.loadPinned(symbol);

  // 3. Separate pinned drawings into origin vs foreign
  const pinnedLocal = allPinned.filter(d => d.resolution === resolution);
  const pinnedForeign = allPinned.filter(d => d.resolution !== resolution);

  // 4. Merge: local drawings (including pinned-local, avoid duplicates by dbId)
  const localDbIds = new Set(localDrawings.map(d => d.id));
  const mergedLocal = [
    ...localDrawings,
    ...pinnedLocal.filter(d => !localDbIds.has(d.id)),
  ];

  // 5. Render local drawings at full opacity (existing logic)
  for (const drawing of mergedLocal) {
    const opts = {
      id: drawing.overlayId,
      name: drawing.overlayType,
      points: drawing.points,
      styles: drawing.styles,
      extendData: drawing.extendData,
      lock: drawing.locked || false,
      ...getOverlayCallbacks(),
    };
    if (drawing.extendData != null) opts.extendData = drawing.extendData;
    chart.createOverlay(opts);

    // Track overlay -> database mapping
    overlayDbIdMap.set(drawing.overlayId, drawing.id);
  }

  // 6. Render foreign pinned drawings with fade + lock
  pinnedOverlayMap.clear();
  for (const drawing of pinnedForeign) {
    const compoundId = `${drawing.overlayId}_pinned_${drawing.resolution}`;
    const opts = {
      id: compoundId,
      name: drawing.overlayType,
      points: drawing.points,
      styles: fadeStyles(drawing.styles, 0.5),
      extendData: withOriginBadge(drawing.extendData, drawing.resolution),
      lock: true,  // always locked -- no callbacks for foreign pinned
    };
    chart.createOverlay(opts);

    pinnedOverlayMap.set(compoundId, drawing);
  }
}
```

### 3.8 Context Menu Addition

Add "Pin as Key Level" / "Unpin" to `OverlayContextMenu.svelte`:

```svelte
<!-- After existing Lock/Unlock button -->
{#if !isLocked}
  <button on:click={handleTogglePin}>
    {isPinned ? 'Unpin' : 'Pin as Key Level'}
  </button>
{/if}
```

The pin toggle handler:

```javascript
function handleTogglePin() {
  const newPinState = !isPinned;
  const dbId = overlayDbIdMap.get(contextMenu.overlayId);
  if (dbId) {
    drawingStore.update(dbId, { pinned: newPinState });
  }
  // Visual feedback: if pinning, immediately apply fade (will persist on next TF switch)
  if (newPinState) {
    chart.overrideOverlay({
      id: contextMenu.overlayId,
      styles: { /* subtle visual indicator that it's pinned, e.g., slightly different opacity */ },
    });
  }
  isPinned = newPinState;
  closeMenu();
}
```

### 3.9 Timestamp Range Compatibility

**Critical issue:** Drawings from higher timeframes have point timestamps that may fall outside the visible candle range on lower timeframes.

**Per-type strategy:**

| Type | Strategy | Rationale |
|---|---|---|
| horizontalRayLine, simpleTag, rulerPriceLine | **Price-only rendering** -- ignore timestamp, render at `y = price` across full width | These are price-level drawings. The timestamp is irrelevant to their visual purpose. |
| fibonacciLine | **Price-only rendering** for all level lines | Fibonacci levels are price-based. Timestamp of origin points doesn't matter for the horizontal lines. |
| rectOverlay, circleOverlay, polygonOverlay, arcOverlay, arrowOverlay, parallelStraightLine | **Best-effort clipping** -- render if any point is within visible range, clip to boundaries | KLineChart handles partial rendering naturally. If points are outside range, the drawing simply won't appear (graceful degradation). |

**Horizontal line special handling:** When restoring a pinned horizontalRayLine/simpleTag/rulerPriceLine from a foreign timeframe, override the point's timestamp to be within the current visible range while preserving the price:

```javascript
if (isPriceOnlyOverlay(drawing.overlayType) && isForeign) {
  const visibleRange = chart.getVisibleRange();
  // Use a timestamp within visible range, keeping the price
  opts.points = [{ timestamp: visibleRange.from, price: drawing.points[0].price }];
}
```

This ensures price-only drawings always render regardless of their origin timeframe's data range.

### 3.10 Performance Considerations

- **Pinned drawing count:** Expect 5-20 pinned drawings per symbol across all timeframes. Negligible performance impact.
- **IndexedDB query:** `[symbol+pinned]` compound index provides O(log n) lookup. Fast.
- **Rendering:** KLineChart handles hundreds of overlays. 20 pinned overlays is trivial.
- **Caching:** Consider an in-memory `Map<symbol, pinnedDrawings[]>` cache, invalidated on pin/unpin. Avoids IndexedDB query on every TF switch.
- **Server sync:** Pinned state is just another field in the JSONB payload. No new endpoints required for Tier 1. The existing `PUT /api/drawings/:symbol/:resolution` endpoint carries the `pinned` field.

---

## 4. Implementation Plan -- Pin Mode

### Phase 1: Core Pin (3-5 days)

| Step | File | Change |
|---|---|---|
| 1 | `src/lib/chart/chartConfig.js` | Add `RESOLUTION_ORDER`, `getResolutionRank()`, `isHigherResolution()` helpers |
| 2 | `src/lib/chart/styleUtils.js` | New file: `fadeStyles()`, `fadeColor()`, `withOriginBadge()`, `isPriceOnlyOverlay()` |
| 3 | `src/lib/chart/drawingStore.js` | Add `pinned` field, v2 schema with `[symbol+pinned]` index, `loadPinned(symbol)` method |
| 4 | `src/lib/chart/drawingCommands.js` | `CreateDrawingCommand.persist()` saves `pinned` field |
| 5 | `src/components/ChartDisplay.svelte` | Modify `restoreDrawings()` to load + render pinned foreign drawings with fade + lock + compound IDs |
| 6 | `src/components/OverlayContextMenu.svelte` | Add "Pin as Key Level" / "Unpin" menu item |

### Files NOT changed (no impact)

- `customOverlays.js` -- overlay registrations unchanged
- `persistenceRoutes.js` -- JSONB handles new field automatically
- `02-auth-tables.sql` -- no schema change needed
- Server-side -- no new endpoints for Tier 1

---

## 5. Future Tiers (Deferred)

### Tier 2: Auto-Propagate with Depth Control

- Add `propagationDepth` field to drawings (0 = origin only, -1 = all lower)
- Global default propagation depth setting in workspace config
- `restoreDrawings()` loads drawings from N higher TFs automatically
- 3-4 days estimated effort

### Tier 3: Per-Drawing Visibility Overrides

- Add `visibleOnResolutions` array to drawing records
- Context menu "Visibility..." popover with checkboxes per resolution
- Overrides propagation depth for that specific drawing
- 4-6 days estimated effort, only if user feedback demands it

---

## 6. Related: Multi-Select Drawings

Multi-select (shift-click) is designed as an **independent feature** that complements pin mode. When both are implemented, batch pin/unpin becomes a multi-select context menu action.

Full design: [multi-select-drawings.md](./multi-select-drawings.md)

---

## 7. Competitive Landscape

| Platform | Cross-TF Approach |
|---|---|
| **TradingView** | Per-drawing visibility checkboxes + "Show on all TFs" |
| **ThinkorSwim** | "Show across all timeframes" binary toggle |
| **MetaTrader 5** | "Show on timeframes" checkboxes per drawing |
| **NinjaTrader** | Drawing collections shared across charts |
| **Sierra Chart** | Study-based auto-propagation |
| **cTrader** | No cross-TF drawing visibility (as of 2025) |

---

## 8. Open Questions

1. **Should propagated drawings be deletable from the target TF?** (Recommended: No. Must delete from origin TF.)
2. **Should editing a pinned drawing on its origin TF auto-update all other TFs where it's displayed?** (Recommended: Yes, if the chart is currently displaying that TF. Otherwise, changes take effect on next TF switch.)
3. **Maximum number of pinned drawings to render per chart?** (Recommended: No hard cap for Tier 1 -- expect 5-20. Add cap of 50 if performance issues arise.)
4. **Should horizontal lines use special rendering that ignores timestamp range?** (Recommended: Yes. Price-only drawings always render at price level.)
5. **Default propagation depth for new drawings (Tier 2)?** (Recommended: 0 by default. Traders opt-in to propagation.)
6. **Fade factor -- 50% confirmed?** (Recommended: Yes. 0.5 opacity for all foreign pinned drawings. Consistent across all types.)
7. **Should multi-select work across pinned foreign drawings?** (Recommended: No. Foreign pinned drawings are locked and not selectable. Multi-select only works on current-TF drawings.)
