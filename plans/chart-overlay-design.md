# Chart Overlay Design Document

## 1. Overview

Add the ability to overlay a second symbol's price data on the kline chart as a line, with its own independent Y-axis scale, OHLCV stats, and full scroll/zoom parity with the primary symbol.

**Scope:** Single overlay per chart (v1). The architecture should allow multiple overlays in future.

---

## 2. Problem Analysis

### 2.1 Why Custom Indicator (`draw` callback) Is the Only Viable Path

KLineChart v9.8.12 has **no built-in multi-symbol support**. The library is fundamentally single-symbol:

- `chart.applyNewData()` accepts one `KLineData[]`
- No secondary Y-axis API on the candle pane
- `registerOverlay` is for interactive drawings (trendlines, shapes), not data series
- A GitHub discussion "Is there a way to show 2 price lines on the same pane?" (Jan 2024) remains unanswered

The only rendering mechanism that gives us canvas access with coordinate mapping is the **custom indicator `draw()` callback**, which provides:

| Parameter | Purpose |
|-----------|---------|
| `ctx` | Canvas 2D context |
| `bounding` | Drawable area `{ width, height, left, right, top, bottom }` |
| `xAxis.convertToPixel(timestamp)` | Timestamp → x pixel |
| `yAxis.convertToPixel(price)` | Price → y pixel (uses **shared** candle Y-axis) |
| `visibleRange` | `{ from, to, realFrom, realTo }` data indices |
| `barSpace` | Bar spacing for width calculations |
| `indicator.extendData` | Arbitrary data injection point |

The project already uses this pattern for `symbolWatermark` (`src/lib/chart/customOverlays.js:13-41`).

### 2.2 The Scaling Problem

**This is the hardest problem.** `series: 'price'` shares the candle pane's Y-axis — both symbols must trade at similar price levels. EUR/USD (~1.08) overlaid on GBP/JPY (~193.5) would be invisible.

**Options evaluated:**

| Approach | Pros | Cons |
|----------|------|------|
| **A. Independent Y-axis via `series: 'normal'` + separate pane** | True independent scale, proper axis labels | Creates a separate pane (not overlaid on candles), defeats the purpose |
| **B. `series: 'price'` with manual Y-axis override** | Overlaid on candles | No API to override Y-axis bounds per indicator; `registerYAxis` only controls tick generation, not scale |
| **C. Manual scaling in `draw()` — map overlay prices to candle Y-axis range** | True overlay on candles, independent scale | Must re-scale on every draw call, no axis labels, crosshair won't show overlay price |
| **D. Normalized percentage change** | Solves all scaling issues | Changes the chart semantics; users expect absolute prices |

**Recommended: Hybrid C + custom crosshair price.**

- Use `series: 'price'` for pane integration
- In `draw()`, compute overlay price → pixel mapping using the overlay's own min/max range mapped to the bounding box height
- Render a custom Y-axis label strip on the right side for the overlay
- Override the crosshair tooltip to show the overlay's actual price at the cursor position

This gives us: overlay on candles, independent scaling, and readable prices.

### 2.3 Data Alignment

Different symbols have different trading sessions:
- Forex: Mon 00:00 → Fri 22:00 UTC (weekend gaps)
- Crypto: 24/7 (no gaps)
- Indices: Session-based with daily gaps

The overlay indicator's `draw()` callback iterates over `visibleRange` indices. We must align the overlay's bar data to the primary symbol's timestamps. Strategy:

1. Build a timestamp-keyed map of overlay bars (`Map<timestamp, Bar>`)
2. In `draw()`, for each visible primary bar, look up the overlay bar by timestamp
3. If no exact match (session gap), interpolate or leave a gap in the line
4. **Gap rendering:** Draw disconnected line segments when timestamps don't align, rather than connecting across gaps

---

## 3. Architecture

### 3.1 Component Architecture

```
ChartDisplay.svelte
├── ChartHeader.svelte          ← add overlay toggle + symbol input
├── ChartToolbar.svelte         ← no changes needed
├── chart-canvas-container
│   └── KLineChart canvas
│       ├── candle_pane
│       │   ├── BOLL indicator
│       │   ├── symbolWatermark indicator
│       │   └── priceOverlay indicator (NEW) ← draws the overlay line
│       ├── OBV pane
│       └── AD pane
└── QuickRuler.svelte
```

### 3.2 Data Flow

```
chartDataStore.js (existing)
├── Primary store:   getChartBarStore('EUR/USD', '4h')
└── Overlay store:   getChartBarStore('GBP/USD', '4h')   ← NEW subscription

                        │
                        ▼
              overlayDataManager.js (NEW)
              ├── Subscribes to overlay bar store
              ├── Maintains timestamp-keyed bar map
              ├── Tracks min/max for scaling
              └── Exposes reactive state: { bars, minPrice, maxPrice, ohlcv, visible }
                        │
                        ▼
              priceOverlay indicator (customOverlays.js)
              ├── Reads overlay data from extendData
              ├── draw() renders scaled line on candle pane
              └── Returns overlay price at cursor for tooltip
```

### 3.3 File Inventory

| File | Change | Purpose |
|------|--------|---------|
| `src/lib/chart/overlayDataManager.js` | **NEW** | Overlay state management, bar map, scaling, OHLCV |
| `src/lib/chart/customOverlays.js` | **MODIFY** | Register `priceOverlay` indicator |
| `src/lib/chart/chartThemeLight.js` | **MODIFY** | Add overlay tooltip legend style |
| `src/components/displays/ChartHeader.svelte` | **MODIFY** | Overlay toggle + symbol input field |
| `src/components/ChartDisplay.svelte` | **MODIFY** | Wire overlay lifecycle, pass data to indicator |
| `src/stores/chartDataStore.js` | **NO CHANGE** | Already supports multi-symbol subscriptions |

---

## 4. Detailed Design

### 4.1 OverlayDataManager (NEW)

```js
// src/lib/chart/overlayDataManager.js

/**
 * Manages a single overlay symbol's data lifecycle.
 * One instance per chart display, holds state for one overlay symbol.
 */
export class OverlayDataManager {
  constructor() {
    this.symbol = null;
    this.bars = new Map(); // timestamp → { open, high, low, close, volume, timestamp }
    this.minPrice = Infinity;
    this.maxPrice = -Infinity;
    this.ohlcv = { open: null, high: null, low: null, close: null, volume: null };
    this.active = false;
    this._storeUnsubscribe = null;
    this._tickUnsubscribe = null;
  }

  /** Set overlay symbol — subscribes to bar data + market ticks */
  setSymbol(symbol, resolution, source) { ... }

  /** Remove overlay — unsubscribes, clears state */
  clear() { ... }

  /** Get the overlay bar closest to a given timestamp (for tooltip) */
  getBarAtTimestamp(timestamp) { ... }

  /** Get bars within a visible range (for draw optimization) */
  getBarsInRange(fromTimestamp, toTimestamp) { ... }

  /** Get the price-to-pixel mapping function for current scale */
  createScaleMapper(bounding) { ... }
}
```

**Key design decisions:**
- Map-keyed by timestamp for O(1) lookups during draw
- Tracks min/max independently for Y-axis scaling
- Exposes OHLCV for the current bar (for header display)
- Resolution and source are inherited from the primary symbol (no independent resolution)

### 4.2 Price Overlay Indicator Registration

```js
// In src/lib/chart/customOverlays.js

registerIndicator({
  name: 'priceOverlay',
  shortName: 'Overlay',
  series: 'price',
  visible: true,
  zLevel: 1, // render above candles (candles = 0)
  calcParams: [],
  shouldOhlc: false,
  precision: 2,
  calc: (dataList) => dataList.map(() => ({})), // no calculation from primary data

  draw: ({ ctx, bounding, xAxis, yAxis, visibleRange, barSpace, kLineDataList, indicator }) => {
    const overlay = indicator.extendData;
    if (!overlay?.active || !overlay.bars?.size) return true;

    const { from, to } = visibleRange;
    const { bar, halfBar, gapBar } = barSpace;

    // Build price scale from overlay's own min/max
    const { minPrice, maxPrice } = overlay;
    if (minPrice >= maxPrice) return true;
    const priceRange = maxPrice - minPrice;
    const pricePadding = priceRange * 0.05; // 5% padding
    const scaleMin = minPrice - pricePadding;
    const scaleMax = maxPrice + pricePadding;
    const scaleRange = scaleMax - scaleMin;

    // Map overlay price to pixel Y within bounding
    const priceToY = (price) => {
      return bounding.top + bounding.height - ((price - scaleMin) / scaleRange) * bounding.height;
    };

    // Draw line segments
    ctx.save();
    ctx.strokeStyle = overlay.color || '#2563EB';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.85;

    let drawing = false;
    ctx.beginPath();

    for (let i = from; i <= to; i++) {
      const primaryBar = kLineDataList[i];
      if (!primaryBar) continue;

      // Look up overlay bar by timestamp
      const overlayBar = overlay.bars.get(primaryBar.timestamp);
      if (!overlayBar) {
        drawing = false; // gap — session mismatch
        continue;
      }

      const x = xAxis.convertToPixel(i) ?? (bounding.left + i * (bar + gapBar));
      const y = priceToY(overlayBar.close);

      if (!drawing) {
        ctx.moveTo(x, y);
        drawing = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.restore();

    // Draw right-side price label
    drawOverlayPriceLabel(ctx, bounding, overlay);

    return true;
  }
});
```

**Scaling logic:** The overlay's prices are mapped to the full bounding box height using the overlay's own min/max range. This means the overlay line occupies the full chart height regardless of the primary symbol's price level. The primary candles still use their own Y-axis scale.

**Right-side price label:** A small label strip drawn at `bounding.right` showing the overlay's current price, color-coded to match the overlay line. This provides the "second Y-axis" visually without requiring KLineChart to support it.

### 4.3 Gap Handling

When the overlay symbol has no bar at a primary symbol's timestamp (session mismatch), we break the line segment. This prevents false connections across weekend gaps or different trading sessions.

**Future enhancement:** Configurable gap behavior — connect vs. break vs. interpolate.

### 4.4 Crosshair Tooltip Integration

KLineChart's built-in tooltip shows the primary symbol's OHLCV. We need to also show the overlay's price.

**Approach:** Use `createTooltipDataSource` (v9 API) to extend the tooltip with overlay data:

```js
// In ChartDisplay.svelte, after chart init:
chart.createTooltipDataSource({
  name: 'overlayTooltip',
  calc: (kLineData, indicator) => {
    // kLineData is the bar under the cursor
    const overlayBar = overlayManager.getBarAtTimestamp(kLineData.timestamp);
    if (!overlayBar) return null;
    return {
      name: overlayManager.symbol,
      value: overlayBar.close.toFixed(pipDigits),
      color: overlayColor
    };
  }
});
```

This adds a line to the built-in tooltip legend showing the overlay's close price at the cursor position.

### 4.5 Chart Header — Overlay Controls

**Location:** `ChartHeader.svelte`, to the right of the symbol name.

**Design:** Toggle button that expands an inline input field.

```
┌─────────────────────────────────────────────────────────┐
│ EUR/USD  [⊕ Compare: GBP/USD ×]  ● ↻ ⌄                 │
└─────────────────────────────────────────────────────────┘
```

- **`⊕ Compare` button:** Opens inline text input
- **Text field:** Type symbol name, Enter to apply, Escape to cancel
- **`×` button:** Remove overlay
- **Color dot:** Clickable to change overlay line color

**States:**

| State | UI |
|-------|----|
| No overlay | `[+ Compare]` button only |
| Overlay active | `⊕ Compare: SYMBOL ×` with color dot |
| Typing | Inline text input with autocomplete (future) |

**Why header, not toolbar or right-click:**
- Toolbar is for chart-wide controls (resolution, window, drawing tools)
- Right-click is for drawing overlay context actions (delete, lock, pin)
- Header is the natural home for symbol-identity controls — it already shows the primary symbol
- Keeps the overlay symbol visually associated with the primary symbol

**Keyboard shortcut:** `Alt+O` to toggle overlay input focus (follows existing `Alt+<key>` pattern from `keyboardHandler.js`).

### 4.6 OHLCV Stats Display

The overlay's current bar OHLCV should appear in the chart tooltip alongside the primary symbol's data. This is handled by the `createTooltipDataSource` integration in 4.4.

Additionally, when hovering over a bar, the tooltip should show:

```
EUR/USD · 4H    O 1.0812  H 1.0834  L 1.0801  C 1.0828  V 1.2K
GBP/USD          O 1.2634  H 1.2651  L 1.2622  C 1.2645
```

The overlay line uses a slightly smaller font and its accent color for differentiation.

### 4.7 Overlay Lifecycle in ChartDisplay.svelte

```js
// New state
let overlayManager = new OverlayDataManager();
let overlayIndicatorId = null;

// On overlay symbol set:
function setOverlaySymbol(symbol) {
  if (!chart) return;
  overlayManager.setSymbol(symbol, currentResolution, currentSource);

  if (!overlayIndicatorId) {
    overlayIndicatorId = chart.createIndicator(
      { name: 'priceOverlay', extendData: overlayManager.getState() },
      true, // stack on candle pane
      { id: 'candle_pane' }
    );
  }

  // Subscribe to overlay bar store for live updates
  const store = getChartBarStore(symbol, currentResolution);
  overlayManager._storeUnsubscribe = store.subscribe(({ bars }) => {
    overlayManager.updateBars(bars);
    // Push updated data to indicator via overrideIndicator
    if (chart && overlayIndicatorId) {
      chart.overrideIndicator(
        { extendData: overlayManager.getState() },
        'candle_pane'
      );
    }
  });
}

// On overlay clear:
function clearOverlay() {
  overlayManager.clear();
  if (chart && overlayIndicatorId) {
    chart.removeIndicator('candle_pane', 'priceOverlay');
    overlayIndicatorId = null;
  }
}

// On primary symbol change: also clear overlay
function handleSymbolChange(newSymbol) {
  clearOverlay(); // overlay data is primary-symbol-aligned
  // ... existing logic
}

// On resolution change: reload overlay data at new resolution
function handleResolutionChange(newResolution) {
  if (overlayManager.active) {
    clearOverlay();
    setOverlaySymbol(overlayManager.symbol); // re-subscribe at new resolution
  }
  // ... existing logic
}
```

### 4.8 Color Customization

Default overlay color: `#2563EB` (blue, distinct from green/red candle theme).

Users can cycle through a preset palette by clicking the color dot:
```
#2563EB (blue) → #DC2626 (red) → #7C3AED (purple) → #059669 (green) → #D97706 (amber) → #2563EB
```

Stored in display state for persistence.

---

## 5. Identified Challenges & Mitigations

### 5.1 Scaling — Dual Y-Axis on Single Pane

**Challenge:** KLineChart has no API for a secondary Y-axis on the candle pane. The overlay's price range may be vastly different from the primary.

**Mitigation:** Manual price-to-pixel mapping in `draw()` using the overlay's own min/max. Draw a right-side price label strip. The crosshair tooltip shows the actual overlay price (not the pixel-mapped value).

**Risk:** The overlay line and primary candles share visual space. If price ranges overlap, lines may cross confusingly. Mitigate with distinct styling (solid line for overlay vs. candle bodies for primary).

### 5.2 Performance — draw() Called on Every Frame

**Challenge:** `draw()` is called on every scroll, zoom, and resize event. Iterating overlay bars and drawing line segments must be fast.

**Mitigation:**
- Pre-compute the timestamp-keyed Map (O(1) lookups)
- Only iterate `visibleRange` indices (not all bars)
- Use canvas path batching (single `beginPath()` → multiple `lineTo()` → single `stroke()`)
- Debounce `overrideIndicator` calls to avoid excessive redraws

### 5.3 Data Alignment — Session Mismatches

**Challenge:** Forex (Mon-Fri) overlaid on crypto (24/7) creates gaps. Different symbols may have bars at different timestamps even within the same session.

**Mitigation:**
- Break line segments at gaps (no connecting line across missing bars)
- Future: configurable gap tolerance (e.g., allow 1-bar gap fill)

### 5.4 Tooltip Price Accuracy

**Challenge:** The overlay price shown in the tooltip must reflect the actual overlay price, not the Y-axis position (which is scaled independently).

**Mitigation:** Look up the overlay bar by timestamp in the tooltip's `calc` callback, not by Y-axis conversion.

### 5.5 Bar Space / Zoom Lock

**Challenge:** The project locks zoom and algorithmically controls bar spacing (`setZoomEnabled(false)`). The overlay must respect the same bar spacing.

**Mitigation:** The overlay indicator's `draw()` receives `barSpace` and `xAxis.convertToPixel()`, which already account for the locked bar spacing. No special handling needed.

### 5.6 Progressive History Loading

**Challenge:** When the user scrolls left, more primary history loads. The overlay must also load more history at the same timestamps.

**Mitigation:** The `onVisibleRangeChange` handler (ChartDisplay.svelte:743) triggers `loadMoreHistory()`. Extend this to also call `loadMoreHistory()` for the overlay symbol if active. The overlay store's IndexedDB cache will handle the rest.

### 5.7 Source Synchronization

**Challenge:** The overlay inherits the primary symbol's data source (cTrader or TradingView). Some symbols may not be available on both sources.

**Mitigation:** Validate overlay symbol availability before subscribing. Show an error state if the symbol is unavailable on the current source. Future: allow independent source selection per overlay.

### 5.8 KLineChart v10 Migration

**Challenge:** v10 changes `applyNewData` → `setDataLoader`, `calc` return format, and removes some drawing utilities.

**Mitigation:** The overlay uses `draw()` callback (stable across v9/v10), `extendData` (stable), and `xAxis`/`yAxis` (stable). The migration impact is minimal. Document in v10 migration plan.

---

## 6. Future Opportunities

### 6.1 Multiple Overlays (v2)
The architecture supports multiple overlays — each is an independent `OverlayDataManager` instance and a separate `priceOverlay` indicator on the candle pane. Limit to 3-4 overlays before visual clutter becomes an issue.

### 6.2 Candle Overlay Mode
Instead of a line, render the overlay as semi-transparent candlesticks. Requires more canvas work in `draw()` (draw OHLC rectangles) and may conflict visually with the primary candles. Only viable when price ranges are similar.

### 6.3 Normalized Percentage Mode
Add a toggle to switch between absolute price and percentage-change-from-first-bar. This solves the scaling problem entirely but changes chart semantics. Useful for correlation analysis.

### 6.4 Correlation Display
Show rolling correlation coefficient between primary and overlay symbols. Could be a small badge in the header or a separate bottom pane indicator.

### 6.5 Spread / Differential Overlay
Instead of a second symbol's price, show the price differential (primary - overlay) or ratio (primary / overlay) as a line. Useful for pairs trading.

### 6.6 Overlay Symbol Search / Autocomplete
Currently planned as a plain text input. Future: dropdown with recently used symbols, fuzzy search, and symbol validation against the active data source.

### 6.7 Independent Resolution (v2+)
Allow the overlay to use a different resolution than the primary (e.g., daily overlay on a 4H chart). Requires timestamp alignment logic to aggregate/disaggregate bars.

### 6.8 Overlay Persistence
Save overlay configuration (symbol, color) to the workspace display state. Restore on workspace load. Integrates with existing `persistenceRoutes.js` and IndexedDB drawing storage.

---

## 7. Implementation Phases

### Phase 1: Core Overlay (Line Only)
1. `overlayDataManager.js` — state management, bar map, scaling
2. `priceOverlay` indicator registration in `customOverlays.js`
3. Wire into `ChartDisplay.svelte` lifecycle
4. Header UI: toggle + text input + clear
5. Tooltip integration via `createTooltipDataSource`

### Phase 2: Polish
6. Color customization
7. Right-side price label strip
8. Gap handling refinement
9. Progressive history loading for overlay
10. Source validation and error states

### Phase 3: Persistence & UX
11. Overlay config saved to workspace display state
12. Keyboard shortcut (`Alt+O`)
13. Symbol autocomplete / recent symbols
14. Overlay symbol validation

### Phase 4: Advanced (Future)
15. Multiple overlays
16. Candle overlay mode
17. Normalized percentage mode
18. Correlation / spread overlays
19. Independent resolution per overlay

---

## 8. Technical Notes

### KLineChart API Surface Used

| API | Purpose |
|-----|---------|
| `registerIndicator({ series: 'price' })` | Render on candle pane |
| `draw({ ctx, bounding, xAxis, visibleRange, barSpace, kLineDataList, indicator })` | Canvas rendering |
| `indicator.extendData` | Inject overlay bar data |
| `chart.createIndicator({ name: 'priceOverlay' }, true, { id: 'candle_pane' })` | Add to candle pane |
| `chart.overrideIndicator({ extendData: ... }, 'candle_pane')` | Push live data updates |
| `chart.removeIndicator('candle_pane', 'priceOverlay')` | Clean up |
| `xAxis.convertToPixel(dataIndex)` | Timestamp → pixel |
| `createTooltipDataSource({ calc })` | Extend tooltip with overlay price |

### Data Layer (No Changes Needed)

`chartDataStore.js` already supports:
- Multiple simultaneous subscriptions via `Map<symbol:resolution, Store>`
- Per-symbol IndexedDB caching
- Live bar updates routed to correct store
- `loadMoreHistory()` for progressive loading

### KLineChart v10 Compatibility

The overlay implementation uses stable APIs that persist in v10:
- `registerIndicator` — unchanged
- `draw()` callback signature — unchanged
- `extendData` — unchanged
- `xAxis`/`yAxis` in draw params — unchanged
- `createIndicator` — return value changes from object to ID (minor)

Migration impact: minimal. The `calc` return format changes from array to timestamp-keyed object in v10, but our `calc` returns empty objects (no indicator values), so this is a non-issue.

---

## 9. Open Questions

1. **Should the overlay line connect across small gaps (1-2 bars) or always break?** Recommendation: break on gaps > 1 bar to handle session boundaries cleanly.

2. **Should the overlay persist across symbol changes?** Recommendation: no — clear overlay on primary symbol change (different symbols may not have the overlay symbol available on the same source).

3. **Should we show the overlay's full OHLCV or just close price in the tooltip?** Recommendation: full OHLCV for parity with the primary, but in a more compact format.

4. **Max overlays?** Recommendation: 1 for v1, 3-4 for v2. Beyond that, recommend a separate chart display.
