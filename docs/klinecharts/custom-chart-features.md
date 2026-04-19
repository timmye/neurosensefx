# Custom Chart Feature Inventory

Extensions to KLineChart v9.8.12 built on the `registerOverlay`, `registerIndicator`, and `registerXAxis` APIs. Excludes native feature configuration (themes, magnet mode, typography) and general app utilities (keyManager, workspace layout).

---

## X-Axis

### Calendar-Boundary X-Axis

Replaces KLineChart's default interval-based tick generation with calendar-boundary-aligned ticks: weeks to Sunday, months to the 1st, quarters to Jan/Apr/Jul/Oct, years to Jan 1. Registered via `registerXAxis` as a `calendar` axis type.

**Files:** `src/lib/chart/xAxisCustom.js`, `src/lib/chart/xAxisTickGenerator.js`, `src/lib/chart/calendarBoundaries.js`

### Zoom-Aware Label Tiers

Labels change format automatically as the user zooms, governed by a transition matrix (`TRANSITION_MATRIX` in `chartConstants.js`):

| Zoom window | Format | Example |
|-------------|--------|---------|
| 1D-2D (intraday) | HH:mm | 14:30 |
| 1W-1M (daily/weekly) | DD-MM | 18-04 |
| 3M-6M (monthly) | Month name | Apr |
| 1Y (quarterly) | Month Year | Apr 2026 |
| 2Y+ (yearly) | Year | 2026 |

**Files:** `src/lib/chart/calendarBoundaries.js`, `src/lib/chart/chartConstants.js`

### Timezone-Aware Labels

X-axis labels render in the user's chosen timezone via `Intl.DateTimeFormat` with cached formatter instances. Supports per-chart timezone in multi-chart workspaces. Timezone store resolves user preference → browser local → UTC fallback.

**Files:** `src/lib/chart/xAxisCustom.js`, `src/lib/chart/calendarBoundaries.js`, `src/lib/chart/chartAxisFormatter.js`, `src/stores/timezoneStore.js`

### Time Window Presets

Buttons (1D, 1W, 1M, 3M, 6M, 1Y, 2Y, 5Y) that zoom to a calendar-aligned time range. Computes target bar count via binary search against the data store.

**Files:** `src/lib/chart/chartTimeWindows.js`, `src/lib/chart/chartConstants.js`

---

## Theming

### Dual Light/Dark Themes

Two complete theme objects (`LIGHT_THEME`, `DARK_THEME`) with slate/green-accent dark palette. Theme switches propagate via Svelte store to all chart instances, applying styles, axis formatters, and watermark colors.

**Files:** `src/lib/chart/chartThemeLight.js`, `src/lib/chart/chartThemeDark.js`

### Dynamic Faded Styles

Computes semi-transparent overlay colors dynamically from the current theme, ensuring custom overlays default to non-obscuring fills in both light and dark mode.

**Files:** `src/lib/chart/fadedStyleDefaults.js`, `src/lib/chart/styleUtils.js`

---

## Rendering Pipeline

### Resize Coalescing

rAF-coalesced resize scheduling prevents double-rendering when data apply coincides with ResizeObserver fire. Pending data (deferred because container had zero dimensions) is applied in the same frame as resize, eliminating a two-frame stutter that caused blurry rendering.

**Files:** `src/lib/chart/chartResize.js`

### Deferred Post-Init Layout

Chart initialization uses `setTimeout(0)` to yield to the browser layout engine, then `requestAnimationFrame` to defer post-init work (indicators, data load) past KLineChart's internal DPR reset. This prevents the library's rAF coalescing guard from dropping the initial render.

**Files:** `src/lib/chart/chartLifecycle.js`, `src/components/ChartDisplay.svelte`

### Clear-State Redraw

`chart.clearData()` is followed by `chart.resize()` in all teardown paths (symbol switch, resolution change, window change) to force a canvas redraw with empty data, preventing stale pixels from persisting between transitions.

**Files:** `src/lib/chart/reloadChart.js`, `src/components/ChartDisplay.svelte`

---

## Custom Overlays

### Shape Overlays

Five overlays not in KLineChart's built-in set: rectangle, circle, polygon, arc, arrow. Registered via `registerOverlay` with click-to-place anchor patterns and configurable fill/stroke. Arrow overlay inherits theme color (no hardcoded dark color).

**Files:** `src/lib/chart/overlaysShapes.js`

### Fibonacci Retracement Override

Overrides built-in `fibonacciLine` to draw levels from the leftmost anchor point instead of x=0, producing correct horizontal levels regardless of draw origin.

**Files:** `src/lib/chart/overlaysChannels.js`

### Parallel Channel Override

Overrides built-in `parallelStraightLine` to render bounded segments between channel lines instead of infinite rays.

**Files:** `src/lib/chart/overlaysChannels.js`

### Interactive Annotations Override

Overrides built-in `simpleAnnotation` and `simpleTag` by removing `ignoreEvent: true`, making them selectable, draggable, and right-clickable. Annotation text labels auto-hide by default and only appear on hover to reduce chart clutter — a vertical dashed line extends from the anchor point to the top of the pane with an invisible wide hit area for easy hover detection. `extendData` uses a `{ text, hovered }` object (backward-compatible with legacy plain-string format). Hover state toggles via `onMouseEnter`/`onMouseLeave` callbacks set per-instance in `ChartDisplay.svelte` (`getOverlayCallbacks`), since `registerOverlay` callbacks don't receive a chart reference.

**Files:** `src/lib/chart/overlaysAnnotations.js`, `src/components/ChartDisplay.svelte` (hover callbacks)

### Horizontal Ray Line Override

Extends built-in `horizontalRayLine` with a permanent price label on the Y-axis, keeping the value visible when scrolled away from the anchor.

**Files:** `src/lib/chart/overlaysPriceLines.js`

### Ruler Price Line

Custom overlay (`rulerPriceLine`) providing dashed price lines for Quick Ruler endpoints.

**Files:** `src/lib/chart/overlaysPriceLines.js`

### Symbol Watermark Indicator

Custom pane indicator rendering a faded symbol name and resolution in the chart area. Registered via `registerIndicator`.

**Files:** `src/lib/chart/overlaysIndicators.js`

### AD (Accumulation/Distribution) Indicator

Custom Accumulation/Distribution pane indicator. Registered via `registerIndicator`.

**Files:** `src/lib/chart/overlaysIndicators.js`

---

## Drawing Persistence and Undo

### Async Command-Pattern Undo/Redo

`DrawingCommandStack` supporting Ctrl+Z/Ctrl+Y with `CreateDrawingCommand` and `DeleteDrawingCommand`. `undo()` and `redo()` are async — IndexedDB writes in `DeleteDrawingCommand` are awaited, and failed commands stay on their origin stack instead of corrupting state. KLineChart has no built-in undo/redo.

**Files:** `src/lib/chart/drawingCommands.js`, `src/lib/chart/DeleteDrawingCommand.js`

### Overlay Meta Tracking

`overlayMeta` is the sole mechanism for tracking overlay-to-dbId and pinned status. The `_dbId` side-channel via `extendData` was removed because it destroyed string extendData (annotations).

**Files:** `src/lib/chart/overlayMeta.js`

### IndexedDB Drawing Storage

Drawings persist in IndexedDB (Dexie.js) scoped by symbol and resolution, surviving page reloads and browser restarts.

**Files:** `src/lib/chart/drawingStore.js`

### Server Sync for Drawings

Authenticated drawings are debounced and synced to the backend via REST API for cross-device restore. Unauthenticated drawings stay local-only.

**Files:** `src/lib/chart/drawingStore.js`

### Pinned Drawings

Drawings marked "pinned" persist across symbol and timeframe switches. Unpinned drawings are scoped to their symbol+resolution pair.

**Files:** `src/lib/chart/overlayMeta.js`, `src/lib/chart/chartOverlayRestore.js`

### Drawing Restore on Reload

Fetches saved drawings from IndexedDB on symbol+resolution return, merges pinned and symbol-scoped drawings, and remaps overlay IDs for server-synced entries.

**Files:** `src/lib/chart/chartOverlayRestore.js`

### Drawing Context Menu

Right-click any overlay for lock, pin, and delete actions. Deleted drawings integrate with the undo/redo command stack.

**Files:** `src/lib/chart/chartDrawingHandlers.js`, `src/components/OverlayContextMenu.svelte`

---

## Measurement Tools

### Quick Ruler

Right-click drag measurement tool showing bars elapsed, time elapsed, price distance, price range, and percent change between two points. Built as a custom overlay pair (`rulerPriceLine` at each endpoint) with a floating data panel. Not a KLineChart built-in.

**Files:** `src/lib/chart/rulerData.js`, `src/lib/chart/rulerPosition.js`, `src/lib/chart/rulerOverlays.js`, `src/lib/chart/quickRulerUtils.js`

### Price Markers

Draggable horizontal price labels rendered on a separate canvas layer outside KLineChart. Supports current price, OHLC, TWAP, and user-placed markers with pip emphasis (large pips and fractional pips styled at different sizes). Independent rendering system, not a KLineChart overlay.

**Files:** `src/lib/priceMarkerBase.js`, `src/lib/priceMarkerRenderer.js`, `src/lib/priceMarkerInteraction.js`, `src/lib/priceMarkerCoordinates.js`, `src/lib/priceMarkerDropdown.js`, `src/lib/priceMarkers.js`

---

## Data Pipeline

### Optimized Bar Merging

Map-based OHLC dedup with a fast-path for last-bar updates (avoids full sort). Conditional sort only when out-of-order ticks arrive.

**Files:** `src/lib/chart/barMerge.js`, `src/lib/chart/chartTickSubscriptions.js`

### IndexedDB Bar Cache

Historical candle data cached locally in IndexedDB (Dexie.js) with eviction policy. Fresh cache skips the network fetch.

**Files:** `src/lib/chart/barCache.js`

### Cache Freshness Threshold

Cached bars are considered stale after 2 bar-periods (e.g., 2 hours for 1H candles). Stale cache triggers background refresh while still displaying cached data.

**Files:** `src/lib/chart/cacheFreshness.js`

### Custom Data Loader

Bypasses KLineChart's `setDataLoader` entirely. Orchestrates cache lookup, network fetch, and tick subscription independently.

**Files:** `src/lib/chart/chartDataLoader.js`

### rAF-Batched Tick Pipeline

Tick data is batched via `requestAnimationFrame` before applying to the chart, preventing redundant renders during rapid updates.

**Files:** `src/lib/chart/chartTickSubscriptions.js`

### Chart Reload Orchestration

Manages teardown/reload/restore sequence for symbol changes, data source switches, and manual refresh. Coordinates subscription teardown, chart clearing with forced redraw, data re-subscription, drawing restore, and watermark reset.

**Files:** `src/lib/chart/reloadChart.js`

---

## Test Infrastructure

### Unit Tests (Vitest)

Pure function tests for chart modules — no DOM or canvas required. Runs via `npm run test:unit`.

| Test file | Coverage |
|-----------|----------|
| `xAxisCustom.test.js` | 54 tests — tick generation, boundary labels, zoom tiers, collision, setAxisWindow |
| `drawingCommands.test.js` | 6 tests — undo/redo stack ops, async error recovery, maxDepth eviction, clear |
| `overlayMeta.test.js` | 6 tests — dbId/pinned CRUD, delete, clear |
| `styleUtils.test.js` | 6 tests — fadeColor for rgb, rgba, hex formats |

### Test Harness

`src/lib/chart/__tests__/helpers/chartHarness.js` provides mock chart, barSpace, pendingDataRef, and resizeState for testing factory modules without a real KLineChart instance.

### E2E Tests (Playwright)

Full app integration tests via `npm test`. Chart creation, toolbar, resolution switching, drawing persistence, live data flow.

---

## Upstream PR Candidates

| Priority | Feature | Justification |
|----------|---------|---------------|
| 1 | Calendar X-axis + timezone | Every financial chart app needs this; KLineChart has zero timezone support |
| 2 | Drawing undo/redo + persistence | Commonly requested; no built-in solution |
| 3 | Quick Ruler | Standard in TradingView; missing from KLineChart |
| 4 | IndexedDB bar cache | Every production app needs offline data caching |
| 5 | Clean timeframe switching | Known pain point; fix is battle-tested |
| 6 | Shape overlays | Rectangle, circle, polygon not in built-in set |
| 7 | Zoom-aware label tiers | v10 added static format strings but no adaptive transitions |
