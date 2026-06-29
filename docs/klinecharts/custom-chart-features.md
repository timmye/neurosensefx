# Custom Chart Feature Inventory

Extensions to KLineChart v9.8.12 built on the `registerOverlay`, `registerIndicator`,
`registerXAxis`, `setCustomApi`, and action-subscription APIs. Excludes native configuration
that is simply toggled (magnet mode, typography) and general app utilities outside the chart
(keyManager, workspace layout).

Scope: `src/lib/chart/*` plus the chart components (`ChartDisplay.svelte`, `ChartToolbar.svelte`,
`QuickRuler.svelte`, `OverlayContextMenu.svelte`) and the chart-facing stores
(`chartDataStore`, `marketDataStore`, `displayStore`, `timezoneStore`, `themeStore`).

For version/upstream-contribution strategy see [`upstream-strategy.md`](./upstream-strategy.md).

---

## 1. Time Windows & Range Computation

### Fixed (Developing) vs Rolling Window Mode

Each chart has a `windowMode` (`'developing'` default, or `'rolling'`), persisted per-display in
`displayStore` and toggled from the toolbar ("Dev" ↔ "Roll"). The mode selects how the visible
history range is computed:

- **Developing (calendar-aligned)** — range snaps to calendar boundaries (week→Monday, month→1st,
  year→quarter-start / Jan 1). Ends at `now`; the left edge slides forward over time.
- **Rolling (fixed lookback)** — pure millisecond lookback from `now` with no calendar snapping
  (e.g. exactly N months of bars).

`computeFetchRange(window, mode)` returns `{ exact, buffered }` for both modes; `buffered` adds one
extra period for pre-fetch margin.

**Files:** `chartTimeWindows.js` (`getCalendarAlignedRange`, `getRollingRange`),
`chartTickSubscriptions.js` (`computeFetchRange`), `chartDataLoader.js` (`windowMode` param),
`ChartDisplay.svelte` (`handleWindowModeChange` → reload), `ChartToolbar.svelte` (toggle),
`stores/displayStore.js` (persistence)

### Time Window Presets

Buttons (1d, 2d, 1W, 2W, 1M, 3M, 6M, 1Y, 2Y, 5Y, 10Y) that zoom to a time range. Grouped in the
toolbar by tier.

**Files:** `chartConstants.js` (`TIME_WINDOW_GROUPS`, `WINDOW_MS`), `ChartToolbar.svelte`

### Default Resolution → Window Pairing

Each resolution auto-selects a sensible default window on first load (e.g. `1h→1M`, `D→1Y`,
`M→10Y`).

**Files:** `chartConstants.js` (`DEFAULT_RESOLUTION_WINDOW`)

### Period Range Limits

Per-timeframe maximum history range (e.g. M1/M5 capped at ~5 weeks, D1 at ~1 year, W1/MN1 at ~5
years). Guards backend fetch volume.

**Files:** `chartConstants.js` (`PERIOD_RANGE_LIMITS`)

### Window-to-Milliseconds & Bar-Space Fit

`windowToMs` converts a window key to ms. `calcBarSpace` computes candle width so the window's bars
fit the container, clamped to KLineChart's 3–50 range; the data-aware variant
(`createBarSpace`) binary-searches actual candle count in range for a precise fit.

**Files:** `chartTimeWindows.js` (`windowToMs`, `calcBarSpace`), `chartBarSpace.js`,
`chartConstants.js` (`RESOLUTION_MS`, `TIMEFRAME_BAR_SPACE`)

---

## 2. X-Axis

### Calendar-Boundary Custom Axis

Replaces KLineChart's default interval-based ticks with calendar-boundary-aligned ticks
(weeks→Sunday, months→1st, quarters→Jan/Apr/Jul/Oct, years→Jan 1), registered via `registerXAxis`
as a `calendar` axis type. Forex week starts Sunday (`WEEK_START_DAY = 0`).

**Files:** `xAxisCustom.js` (registration + per-chart registry), `calendarBoundaries.js`
(alignment + stepping)

### Tick Generation Pipeline

`generateTicks` runs a three-stage pipeline: collect boundary candidates across all active
granularities → dedup by snapped bar (rank-priority wins) → emit labeled ticks with collision
suppression (drops labels under a 30px floor, demoting lower-rank ticks to unlabeled). Ticks snap
to real bars via binary search.

**Files:** `xAxisTickGenerator.js` (`collectCandidates`, `dedupCandidates`, `emitLabeledTicks`),
`dataSearch.js` (`snapToBar`, `dataIndexOf`)

### Tier-Adaptive Axis Formatter (crosshair/tooltip)

A `setCustomApi({ formatDate })` override that formats axis/transition labels by zoom tier
(intraday `HH:mm` → yearly `YYYY`). Crosshair/tooltip (`type !== 2`) always uses full ISO;
axis labels use transition detection (`YYYY`/`YYYY-MM`/`MM-DD`) plus tier-based primary format.

**Files:** `chartAxisFormatter.js` (`createAxisFormatter`), `dateFormatter.js`
(`getLocalizedParts`), `chartConstants.js` (`WINDOW_TIER`, `getWindowTier`)

### Zoom-Aware Label Tiers

The `TRANSITION_MATRIX` controls which time-unit ranks appear per window (e.g. 1Y shows
YEAR/QUARTER/MONTH; 10Y shows only YEAR/QUARTER). Drives both the custom axis candidates and the
formatter.

**Files:** `chartConstants.js` (`TRANSITION_MATRIX`), `xAxisTickGenerator.js`,
`calendarBoundaries.js` (`formatBoundaryLabel`)

### Timezone-Aware Labels

X-axis labels render in the user's chosen timezone via `Intl.DateTimeFormat` with cached formatter
instances. Supports per-chart timezone in multi-chart workspaces. Resolution: user preference →
browser local → UTC.

**Files:** `xAxisCustom.js`, `calendarBoundaries.js`, `chartAxisFormatter.js`, `dateFormatter.js`,
`stores/timezoneStore.js`

### Multi-Chart Axis Registry

`registerXAxis` is a global one-time registration whose `createTicks` receives no chart instance.
A per-chart registry (`chartRegistry` Map) plus a `_lastChart` pointer routes `createTicks` to the
correct chart's timezone/window. Works because rendering is synchronous within a frame. *(Known
upstream API limitation — see `upstream-strategy.md` §4.3.)*

**Files:** `xAxisCustom.js` (`setAxisChart`, `setAxisWindow`, `setAxisTimezone`, `removeAxisChart`)

---

## 3. Custom Overlays

All overlays are side-effect modules imported once in `ChartDisplay.svelte`. Overlays that
re-register built-in names carry a guard that warns if the built-in is renamed/removed upstream.

### Shape Overlays (new types)

Five overlays not in KLineChart's built-in set: rectangle, circle, polygon (triangle), arc, arrow.
Click-to-place anchor patterns; arrow renders a filled arrowhead.

**Files:** `overlaysShapes.js` (`rectOverlay`, `circleOverlay`, `polygonOverlay`, `arcOverlay`,
`arrowOverlay`)

### Parallel Channel Override

Replaces built-in `parallelStraightLine` (v9.8.x renders full-width rays) with bounded segments
between the control points. Same slope math as KLineChart's `getParallelLines`.

**Files:** `overlaysChannels.js` (`parallelStraightLine`)

### Fibonacci Retracement Override

Replaces built-in `fibonacciLine` (v9.8.x draws level rays from x=0) with segments starting at the
leftmost anchor and extending to the right edge, preserving Y-axis price labels at each level
(0/23.6/38.2/50/61.8/78.6/100%).

**Files:** `overlaysChannels.js` (`fibonacciLine`)

### Interactive Annotations / Tags Override

Replaces built-in `simpleAnnotation` and `simpleTag` (v9.8.x set `ignoreEvent: true`, blocking
selection) with selectable, right-clickable versions. Annotation labels auto-hide and appear on
hover (vertical dashed line + invisible wide hit area); `extendData` is `{ text, hovered }`, with
legacy plain-string migration. Hover callbacks are wired per-instance (registerOverlay callbacks
receive no chart reference).

**Files:** `overlaysAnnotations.js` (`simpleAnnotation`, `simpleTag`), `ChartDisplay.svelte`
(`getOverlayCallbacks`), `drawingCoordinator.js` (`onMouseEnter`/`onMouseLeave`)

### Horizontal Ray Line Override

Extends built-in `horizontalRayLine` with a permanent price label on the Y-axis (kept visible when
scrolled away from the anchor). Theme-aware label background.

**Files:** `overlaysPriceLines.js` (`horizontalRayLine`)

### Ruler Price Line

Custom `rulerPriceLine` — dashed full-width horizontal line with a permanent Y-axis price label,
used by Quick Ruler endpoints.

**Files:** `overlaysPriceLines.js` (`rulerPriceLine`)

### Symbol Watermark Indicator

Custom pane indicator rendering a faded symbol name + resolution/window centered at the top of the
candle pane. Updated via `setExtendData`.

**Files:** `overlaysIndicators.js` (`symbolWatermark`)

### Accumulation/Distribution Indicator

Custom A/D line indicator: cumulative `CLV × volume` where
`CLV = ((close−low)−(high−close))/(high−low)`.

**Files:** `overlaysIndicators.js` (`AD`)

---

## 4. Drawing System & Persistence

### Drawing Coordinator

Single factory encapsulating all drawing state and operations — selection, context-menu state,
overlay-meta tracking, restore/merge/render, interaction-callback registration, and undo/redo.
Absorbs logic from the former overlayMeta / chartOverlayRestore / chartDrawingHandlers modules.

**Files:** `drawingCoordinator.js`

### Async Command-Pattern Undo/Redo

`DrawingCommandStack` (maxDepth 50) with `CreateDrawingCommand` / `DeleteDrawingCommand`. `undo()`
and `redo()` are async — IndexedDB writes are awaited, and failed commands stay on their origin
stack instead of corrupting state. KLineChart has no built-in undo/redo.

**Files:** `drawingCommands.js`, `DeleteDrawingCommand.js`

### IndexedDB Drawing Storage

Drawings persist in IndexedDB (Dexie.js) scoped by symbol + resolution, surviving reloads and
browser restarts.

**Files:** `drawingStore.js`

### Server Sync for Drawings

Authenticated drawings are debounced and synced to the backend via REST for cross-device restore;
unauthenticated drawings stay local-only.

**Files:** `drawingStore.js`

### Pinned Drawings (same- and cross-resolution)

Drawings marked "pinned" persist across symbol and timeframe switches. **Cross-resolution** pinned
drawings render on other timeframes as faded (0.5 alpha), locked, and badged with their origin
resolution (`[W]`); price-only overlays (`horizontalRayLine`, `rulerPriceLine`) anchor to the
visible-range start since their timestamp is meaningless cross-resolution.

**Files:** `drawingCoordinator.js` (`renderForeignDrawings`, `mergeDrawings`),
`styleUtils.js` (`withOriginBadge`, `isPriceOnlyOverlay`, `getFadedStyles`),
`fadedStyleDefaults.js`

### Drawing Restore (retry / abortable)

On symbol+resolution return, fetches saved + pinned drawings, merges them, and re-renders. Retries
until the chart has ≥10 bars (max 10 attempts, 300ms backoff) and is abortable via `AbortController`
so a fast symbol switch cancels in-flight restores.

**Files:** `drawingCoordinator.js` (`restoreDrawings`, `restorePinnedDrawings`)

### Drawing Point Validation / Clamping

`CreateDrawingCommand` drops points with no valid coordinate and clamps `dataIndex` to bounds,
preventing chart crashes when a draw ends outside visible data.

**Files:** `drawingCommands.js`

### Overlay Meta Tracking

`overlayMeta` Map is the sole mechanism for overlay→pinned status. (The earlier `_dbId` side-channel
via `extendData` was removed because it destroyed string extendData for annotations.)

**Files:** `drawingCoordinator.js`

### Context Menu (lock / pin / delete)

Right-click any overlay for lock, pin, delete. Drag persists new point positions; delete integrates
with the undo/redo stack. Selection/deselection drives the menu state.

**Files:** `drawingCoordinator.js` (`getOverlayCallbacks` — `onSelected`, `onRightClick`,
`onPressedMoveEnd`), `OverlayContextMenu.svelte`, `ChartDisplay.svelte`

### Hold-to-Confirm Clear All

The "Clear" button requires an 800ms press-and-hold to wipe all drawings (with visual feedback),
preventing accidental clears.

**Files:** `ChartToolbar.svelte` (`handleClearDown` / `handleClearUp`)

---

## 5. Measurement Tools

### Quick Ruler

Right-click drag measurement showing bars elapsed, time elapsed, price distance, price range, and
percent change between two points. Built as a `rulerPriceLine` overlay pair with a floating data
panel. Not a KLineChart built-in.

**Files:** `rulerData.js` (`recalcRulerData`), `quickRulerUtils.js` (pixel→data, deltas,
`formatRulerData`), `rulerPosition.js`, `rulerOverlays.js`, `QuickRuler.svelte`

### Price Markers

Draggable horizontal price labels rendered on a **separate canvas layer outside KLineChart**.
Supports current price, OHLC, TWAP, and user-placed markers with pip emphasis. Independent of the
overlay system.

**Files:** `src/lib/priceMarkerBase.js`, `priceMarkerRenderer.js`, `priceMarkerInteraction.js`,
`priceMarkerCoordinates.js`, `priceMarkerDropdown.js`, `priceMarkers.js`

---

## 6. Data Pipeline & Reconciliation

### Single-Writer Reconciliation

Both the bar store (candle data) and the market store (tick data) feed into one `createReconcile()`
that is the **only** caller of `chart.updateData()` / `chart.applyNewData()`. This prevents the
dual-writer race that flickered the developing bar. A rAF guard ensures at most one chart write per
frame, with a priority queue: full replace > new bar > developing-bar tick update.

**Files:** `chartTickSubscriptions.js` (`createReconcile`, `mapBarToKline`, `applyDataToChart`)

### Optimized Bar Merging

`mergeTickBar` uses a fast-path last-element check and conditional sort (only when out-of-order).
`mergeHistoryBars` uses Map-based O(1) dedup with last-write-wins (live fresher than history).

**Files:** `barMerge.js`

### IndexedDB Bar Cache

Historical bars cached locally (Dexie.js) keyed by `[symbol+resolution+source+timestamp]`. Fresh
cache skips the network fetch; oldest bars beyond a per-resolution cap are evicted.

**Files:** `barCache.js`, `chartConstants.js` (`CACHE_MAX_BARS`)

### Cache Freshness Threshold

Cached bars are considered stale after 2 bar-periods (e.g. 2 hours for 1H candles). Stale cache
triggers a background refresh while still showing cached data.

**Files:** `cacheFreshness.js`

### Custom Data Loader

Bypasses KLineChart's `setDataLoader` entirely. Orchestrates bar-store reset, single-writer
reconcile subscription, and historical fetch using the window-mode range.

**Files:** `chartDataLoader.js`

### Progressive History Loading (scroll)

Subscribes to `onVisibleRangeChange`; when the viewport nears the left edge (15% threshold), triggers
`loadMoreHistory` to fetch older bars on demand. Re-entrancy guarded with an `isLoadingMore` flag.

**Files:** `chartLifecycle.js` (`setupChartActions`), `stores/chartDataStore.js` (`loadMoreHistory`)

### Reconnect Subscription Restore & Gap Backfill

On WS `'ready'` (reconnect), restores candle subscriptions with a dedup guard
(`hasFlushedPendingMessages`) to avoid duplicate subscribes after a pending-message flush, and
backfills any gap by requesting history from the last received bar's timestamp forward.

**Files:** `candleMessages.js` (`registerCandleHandlers` 'ready' handler)

### Stale Pending-Message Purge on Reload

During symbol/source reload, stale pending candle requests (`getHistoricalCandles`,
`subscribeCandles`, `unsubscribeCandles`) are filtered out of `ConnectionManager.pendingMessages`
to prevent the old symbol's data from landing after the switch.

**Files:** `reloadChart.js`

---

## 7. Rendering Robustness

### Resize Coalescing (per-instance)

rAF-coalesced resize scheduling merges resize / `applyBarSpace` / `scrollToRealTime` into one frame
and applies any pending data in that same frame (instead of a second rAF). Each chart has its own
`resizeState` so multi-chart rAF guards don't clobber each other.

**Files:** `chartResize.js` (`scheduleResize`, `createResizeState`, `cancelScheduledResize`)

### Deferred Post-Init Layout

Chart init yields to the browser (`setTimeout(0)` then `requestAnimationFrame`) to defer post-init
work past KLineChart's internal DPR reset, preventing its rAF-coalescing guard from dropping the
initial render.

**Files:** `chartLifecycle.js`, `ChartDisplay.svelte`

### Deferred Data Apply (zero-size guard)

`tryApplyData` applies data immediately only if the container has non-zero dimensions; otherwise it
defers to the resize frame, eliminating a two-frame stutter that caused blurry rendering.

**Files:** `chartTickSubscriptions.js` (`tryApplyData`)

### Clear-State Redraw

`chart.clearData()` is followed by `chart.resize()` in all teardown paths to force a redraw with
empty data, preventing stale pixels between transitions.

**Files:** `reloadChart.js` (`clearChartState`), `ChartDisplay.svelte`

### Canvas DPR Buffer-Refresh Bypass

After reload, `forceCanvasDPRRefresh` bypasses KLineChart's `Canvas.update()` rAF-coalescing guard
(which takes the repaint-only branch when `_width === w`, even if the buffer is stale) by directly
setting each canvas's `width`/`height` and resetting the transform. Safe at DPR=1.

**Files:** `chartResize.js` (`forceCanvasDPRRefresh`), `reloadChart.js`

---

## 8. Chart Lifecycle & Interaction

### Indicator Setup

On mount: Bollinger Bands on the candle pane, A/D in a bottom pane, and the symbol watermark.

**Files:** `chartLifecycle.js` (`setupIndicators`)

### Zoom Re-Lock

`subscribeAction('onZoom')` re-applies bar-space and scrolls to real time, keeping the window fit
after the user zooms.

**Files:** `chartLifecycle.js` (`setupChartActions`)

### Vertical Wheel → Horizontal Scroll

Vertical wheel deltas are mapped to `chart.scrollByDistance`, so trackpad/wheel scrolls the
timeline instead of zooming.

**Files:** `chartLifecycle.js` (`setupWheelHandler`)

### interact.js Drag / Resize / Bring-to-Front

The display element is draggable and resizable via interact.js (ignoring chart canvas and toolbar
controls); tap brings the display to the front.

**Files:** `chartLifecycle.js` (`setupInteract`)

### Action-Subscription Lifecycle

Per-instance subscribe/unsubscribe wrappers for `onZoom`, `onVisibleRangeChange`, `onDataReady`
with an `unsubscribeAll` teardown, preventing handler leaks across multi-chart instances.

**Files:** `chartSubscriptions.js` (`createChartSubscriptions`)

---

## 9. Toolbar / UI Controls

### Resolution & Window Selectors

Grouped resolution buttons (intraday / swing / macro) and grouped window buttons.

### Window-Mode Toggle

"Dev" ↔ "Roll" button switching between calendar-aligned (developing) and fixed-lookback (rolling)
range modes (see §1).

### Data Source Toggle (cTrader ↔ TradingView)

Per-chart data-source switch, persisted per-display. Switching a symbol restores its remembered
source automatically.

**Files:** `ChartToolbar.svelte` (`handleSourceClick`), `ChartDisplay.svelte`
(`handleSourceChange`, `handleSymbolChange` remembered-source)

### Timezone Selector

Dropdown of timezone presets (UTC / Local / custom IANA), bound to `timezoneStore`; affects all
chart instances.

**Files:** `ChartToolbar.svelte`, `stores/timezoneStore.js` (`TIMEZONE_PRESETS`)

### Theme Toggle

Light/dark toggle bound to `themeStore`.

### Drawing Tools Palette + Magnet Mode

20 drawing tools (trendline, horizontal/vertical variants, rays, segments, parallel channel, price
channel, fibonacci, rectangle, circle, triangle, arc, arrow, price line, annotation, tag) plus a
magnet-mode toggle (`weak_magnet` vs `normal`). Fibonacci uses dark-red theming; annotations prompt
for text.

**Files:** `ChartToolbar.svelte` (`DRAWING_TOOLS`, `handleDrawingToolClick`, `toggleMagnet`)

### Undo / Redo / Clear

Toolbar buttons wired to the command stack (see §4).

---

## 10. Theming

### Dual Light / Dark Themes

Two complete theme objects (`LIGHT_THEME`, `DARK_THEME`) with a slate/green-accent dark palette.
Theme switches propagate via `themeStore` to all chart instances (styles, axis formatters,
watermark colors).

**Files:** `chartThemeLight.js`, `chartThemeDark.js`, `themeColors.js`, `stores/themeStore.js`

### Dynamic Faded Styles

Computes semi-transparent overlay colors dynamically from the current theme, ensuring custom
overlays default to non-obscuring fills in both modes. `fadeStyles`/`fadeColor` handle hex, rgb, and
rgba inputs and deep-clone (never mutate).

**Files:** `fadedStyleDefaults.js`, `styleUtils.js`

---

## 11. Test Infrastructure

### Unit Tests (Vitest)

Pure function tests — no DOM or canvas. Runs via `npm run test:unit`.

| Test file | Coverage |
|-----------|----------|
| `xAxisCustom.test.js` | tick generation, boundary labels, zoom tiers, collision, `setAxisWindow` |
| `drawingCommands.test.js` | undo/redo stack ops, async error recovery, maxDepth eviction, clear |
| `overlayMeta.test.js` | dbId/pinned CRUD, delete, clear |
| `styleUtils.test.js` | `fadeColor` for rgb, rgba, hex formats |

### Test Harness

`src/lib/chart/__tests__/helpers/chartHarness.js` provides mock chart, barSpace, pendingDataRef,
and resizeState for testing factory modules without a real KLineChart instance.

### E2E Tests (Playwright)

Full app integration tests via `npm test`: chart creation, toolbar, resolution switching, drawing
persistence, live data flow.

---

## Upstream PR Candidates

> **Reassessed 2026-06-29** — see [`upstream-strategy.md`](./upstream-strategy.md) §4.2 for the
> current tiering. This table reflects a *useful-feature* lens; the reassessment applies a
> stricter *contribution-readiness* lens and demotes drawing persistence, Quick Ruler, bar cache,
> and timeframe switching to "keep in-app" (app-coupled, not library contributions). The viable
> candidates are calendar X-axis, shape overlays, and zoom-aware tiers. Also: v9 is EOL — any code
> PR must target the v10 beta (re-implemented in TS), but version-agnostic **issues** can be filed
> now (notably the built-in overlay `ignoreEvent:true` bug and the `createTicks` chart-instance gap).

| Priority | Feature | Justification |
|----------|---------|---------------|
| 1 | Calendar X-axis + timezone | Every financial chart app needs this; KLineChart has zero timezone support |
| 2 | Drawing undo/redo + persistence | Commonly requested; no built-in solution |
| 3 | Quick Ruler | Standard in TradingView; missing from KLineChart |
| 4 | IndexedDB bar cache | Every production app needs offline data caching |
| 5 | Clean timeframe switching | Known pain point; fix is battle-tested |
| 6 | Shape overlays | Rectangle, circle, polygon not in built-in set |
| 7 | Zoom-aware label tiers | v10 added static format strings but no adaptive transitions |
