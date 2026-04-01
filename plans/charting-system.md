# Charting System: KLineChart Integration

> Status: Implementation proposal
> Date: 2026-04-01

## Objective

Integrate KLineChart as the charting library using the existing cTrader data pipeline, providing candlestick/OHLC visualization with built-in drawing tools, fixed time resolution, and drawing persistence. Nothing is replaced — the chart is a new workspace display type alongside existing price tickers and market profile.

---

## Part 1: Library Selection Rationale

### 1.1 Requirements

| Requirement | Priority |
|-------------|----------|
| Candlestick/OHLC chart rendering | MUST |
| Fixed time resolution (locked time axis) | MUST |
| Configurable time window per resolution | MUST |
| Drawing tools (trendlines, fibonacci, rectangles, shapes, magnet) | MUST |
| Drawing object persistence across sessions | MUST |
| Undo/redo for drawing operations | MUST |
| Coexist with existing market profile visualization | MUST |
| Framework-agnostic (works with Svelte 4) | MUST |
| Open source, no commercial license | SHOULD |

### 1.2 Evaluated Alternatives

| Library | Rejected Because |
|----------|-----------------|
| **TradingView Lightweight Charts** | No built-in drawing tools. Time axis auto-scales — fights against fixed resolution. |
| **TradingView Advanced Chart Widget** | Full drawing suite, but time handling is a black box and auto-scales. User explicitly rejected TradingView time management. |
| **uPlot** | Best time-axis control (pixel-perfect). Zero drawing tool plugins exist. Would need Fabric.js/Konva.js overlay built from scratch. |
| **ECharts** | Not financial-specific. Annotations are static/declarative, not interactive drawing tools. 800KB bundle. |
| **Highcharts Stock** | Commercial license required (~$590+). |
| **SciChart** | Commercial ($499+/yr). |
| **ChartIQ** | Enterprise-only ($10K+/yr). |
| **Plotly.js** | Basic interactive shapes, not financial-chart-specific. 3.5MB bundle. |

### 1.3 Selected: KLineChart

| Attribute | Value |
|-----------|-------|
| GitHub | [klinecharts/KLineChart](https://github.com/klinecharts/KLineChart) (3.7k stars) |
| License | Apache 2.0 |
| Size | ~40KB gzipped |
| Dependencies | Zero |
| Rendering | Pure HTML5 Canvas |
| Drawing tools | Built-in: trendlines, horizontal/vertical lines, rays, channels, parallel lines, fibonacci, rectangles, circles, ellipses, triangles, arcs, price range, annotations, magnet mode |
| Framework | Agnostic — works with Svelte directly |

**Why KLineChart**: Only free open-source library with a full interactive drawing toolkit purpose-built for financial charts. Canvas-based (handles real-time updates without layout thrashing). Small footprint.

---

## Part 2: Time Resolution & Time Window

### 2.1 The Core Concept

- **Time resolution** = candle period (e.g., 4H = each candle covers 4 hours). Locked — no zoom allowed.
- **Time window** = default visible range on initial load (e.g., 3M = 3 months). The user can **scroll beyond** the window to view older data via pan. The window sets the starting view.
- KLineChart handles rendering whatever candles are in its data array. It manages the visible viewport internally. We feed it data and let it render.

### 2.2 Time Resolutions

12 total: 1m, 5m, 10m, 15m, 30m | 1h, 4h, 12h | D, W, M, Q (Q aggregated from MN on frontend)

### 2.3 Time Windows

10 total: 1d, 2d, 1W, 2W, 1M, 3M, 6M, 1Y, 2Y, 5Y, 10Y

### 2.4 Default Window per Resolution

Each resolution has a default window (storable). Approximate visible candles at default barSpace:

| Resolution | Default Window | Visible Candles |
|------------|---------------|-----------------|
| 1m | 1d | ~500 |
| 5m | 2d | ~288 |
| 10m | 2d | ~288 |
| 15m | 2d | ~192 |
| 30m | 1W | ~336 |
| 1h | 2W | ~336 |
| 4h | 3M | ~500 |
| 12h | 1Y | ~500 |
| D | 1Y | ~260 |
| W | 5Y | ~260 |
| M | 5Y | ~60 |
| Q | 10Y | ~40 |

Note: ~500 visible candles at 2px barSpace is the practical max for readability. Higher resolutions show fewer candles with larger barSpace.

### 2.5 KLineChart BarSpace (Resolution Lock)

```javascript
const TIMEFRAME_BAR_SPACE = {
  '1m': 2, '5m': 4, '10m': 6, '15m': 8, '30m': 10,
  '1h': 12, '4h': 20, '12h': 32,
  'D': 40, 'W': 48, 'M': 50, 'Q': 50,
};

// Fixed time resolution — no zoom allowed
chart.setZoomEnabled(false);
chart.setScrollEnabled(true);
chart.setBarSpace(TIMEFRAME_BAR_SPACE[resolution]);

// Re-lock if anything tries to change it
chart.subscribeAction('onZoom', () => {
  chart.setBarSpace(TIMEFRAME_BAR_SPACE[resolution]);
});
```

- `setZoomEnabled(false)` — lock resolution
- `setScrollEnabled(true)` — allow scrolling through history
- `setBarSpace(n)` per resolution
- `subscribeAction('onZoom')` to re-lock

### 2.6 UI: Resolution & Window Selectors

- Resolution buttons: always shown, grouped by period type
- Window buttons: set the initial visible range
- All combinations valid — chart fetches whatever data is available
- Show as icon/button rows in toolbar

```
Time resolution:  [1m] [5m] [10m] [15m] [30m] | [1h] [4h] [12h] | [D] [W] [M] [Q]
Time window:      [1d] [2d] | [1W] [2W] | [1M] [3M] [6M] | [1Y] [2Y] [5Y] [10Y]
```

### 2.7 Known Limitations

- Bar space hardcoded 1-50px (issue #732)
- No setVisibleRange API (issue #430)
- cTrader API range limits per request (M1 max 5 weeks, etc.)

---

## Part 3: Data Pipeline — Existing cTrader Infrastructure

### 3.1 What Already Exists

The cTrader backend already provides candle and tick data:

| Component | What it provides | Location |
|-----------|-----------------|----------|
| `CTraderSession` | M1 trendbar subscription, live spot events | `services/tick-backend/CTraderSession.js:114-147` |
| `CTraderEventHandler` | `m1Bar` events with OHLC, tick events with bid/ask | `services/tick-backend/CTraderEventHandler.js:15-80` |
| `CTraderDataProcessor` | Historical D1 and M1 bar fetching | `services/tick-backend/CTraderDataProcessor.js:26-88` |
| `DataRouter` | Routes cTrader ticks to WebSocket clients | `services/tick-backend/DataRouter.js:18-22` |
| `MessageBuilder` | Formats tick messages with OHLC fields | `services/tick-backend/utils/MessageBuilder.js:27-45` |
| cTrader protobuf API | `ProtoOAGetTrendbarsReq` supports multiple timeframes | `libs/cTrader-Layer/protobuf/OpenApiMessages.proto:496` |

### 3.2 Data Fetching Strategy

This is the KEY change. The data fetching strategy works as follows:

**Concept**: The window sets the initial view. The chart can scroll beyond the window. Data loads progressively as the user scrolls left into older history.

**Initial load**: Fetch `window * 2` worth of candles (double the window as scroll buffer). Example: 4h/3M window → fetch 6M of 4h bars.

**Progressive loading**: When the user scrolls to within 20% of the oldest cached bar, fetch one more chunk of older data from the backend and prepend it.

**cTrader API per-request limits** (from protobuf):

| Period Group | Max Range per Request |
|---|---|
| M1-M5 | 5 weeks |
| M10-H1 | 35 weeks |
| H4-D1 | 1 year |
| W1-MN1 | 5 years |

**Backend chains requests**: Frontend sends one `{ type: 'getHistoricalCandles', symbol, resolution, from, to }`. Backend splits into however many cTrader API requests are needed, respecting per-period limits, and returns merged results.

**IndexedDB cache caps per resolution group**:

| Resolution Group | Max Bars | Approx Duration | Est. Size |
|---|---|---|---|
| M1-M5 | 260,000 | ~6 months | ~26 MB |
| M10-M30 | 260,000 | ~6 months | ~26 MB |
| H1 | 50,000 | ~5.7 years | ~5 MB |
| H4 | 50,000 | ~5.7+ years | ~5 MB |
| H12 | 10,000 | 27+ years | ~1 MB |
| D-W-M | 10,000 | 27+ years | ~1 MB |
| Q (aggregated) | 4,000 | ~1,000 years | ~0.4 MB |

**No eviction during session**: Cache is replaced on next load if stale. Background cleanup on app start deletes bars older than cap.

**Scroll edge behavior**: Show "Loading..." indicator when fetching more data. Show "No more data" when cTrader returns 0 bars.

**barSpace does NOT determine data fetch**: barSpace controls visible candles. We cache far more candles than visible and let KLineChart manage the viewport. Fetch logic uses time duration (window * 2, then chunks), not pixel counts.

### 3.3 Data Flow

```
cTrader API (trendbar subscription for requested timeframe)
    │
    ▼
CTraderSession.js (subscribeToBars with period)
    │
    ▼
CTraderEventHandler.js (processTrendbarEvent → emit bar event)
    │
    ▼
DataRouter.js (new: routeCandleUpdate → broadcast to clients)
    │
    ▼
WebSocket
    │
    ▼
Frontend marketDataStore.js (handle 'candleUpdate' message)
    │
    ▼
chartDataStore.js (manage bar arrays, subscribe API)
    │
    ▼
ChartDisplay.svelte (push to KLineChart)
```

**Historical data flow (initial load):**
```
ChartDisplay requests timeframe + window
    │
    ▼
chartDataStore → WebSocket message: getHistoricalCandles (window * 2)
    │
    ▼
Backend → chain ProtoOAGetTrendbarsReq → cTrader API → merge results
    │
    ▼
Response: candleHistory → WebSocket → chartDataStore → IndexedDB cache → ChartDisplay
```

**Progressive loading (scroll):**
```
User scrolls left → within 20% of oldest cached bar
    │
    ▼
chartDataStore → WebSocket: getHistoricalCandles (next chunk older)
    │
    ▼
Backend → chain requests → merge → return
    │
    ▼
Prepend to IndexedDB cache → prepend to chartDataStore → ChartDisplay.applyMoreData()
```

### 3.4 Backend Changes

1. **Extend CTraderSession.subscribeToM1Bars() → subscribeToBars(symbol, period)** for any period
2. **Add candleUpdate message type to DataRouter** — Currently sends `tick`, `m1Bar`, and `profileUpdate`. Add `candleUpdate` for any timeframe:
   ```javascript
   {
     type: 'candleUpdate',
     source: 'ctrader',
     symbol: 'EURUSD',
     timeframe: 'H4',
     bar: { open, high, low, close, volume, timestamp },
     isBarClose: false  // true when bar period ends
   }
   ```
3. **Add historical candle request handler** in WebSocketServer — Frontend sends `{ type: 'getHistoricalCandles', symbol, resolution, from, to }`. Backend chains `ProtoOAGetTrendbarsReq` requests respecting per-period limits and returns merged results.
4. **Add multi-request chaining in CTraderDataProcessor** — Split range, chain requests respecting per-period limits, merge results.

### 3.5 Frontend Changes

1. **New `chartDataStore.js`** — manages bar arrays, IndexedDB caching, progressive loading, real-time subscriptions
2. **Extend `marketDataStore.js`** — handle `candleUpdate`/`candleHistory` messages
3. **State machine**: IDLE → LOADING → READY → FETCHING_MORE (only one outstanding fetch at a time)

### 3.6 Timeframe Mapping: KLineChart → cTrader API

| KLineChart Resolution | cTrader Period | cTrader Proto Value |
|-----------------------|---------------|-------------------|
| 1m | M1 | 1 |
| 5m | M5 | 5 |
| 10m | M10 | 6 |
| 15m | M15 | 7 |
| 30m | M30 | 8 |
| 1h | H1 | 9 |
| 4h | H4 | 10 |
| 12h | H12 | 11 |
| D | D1 | 12 |
| W | W1 | 13 |
| M | MN1 | 14 |
| Q | *(aggregate from MN1 on frontend)* | N/A |

Note: All resolutions use cTrader native periods directly. Only Q (quarterly) is aggregated from MN1 on the frontend. cTrader proto values are enum indices from `ProtoOATrendbarPeriod` in `OpenApiModelMessages.proto:496-511`.

### 3.7 IndexedDB Schema

```
Database: NeuroSenseChart
Table: bars
  Indexes: [symbol+resolution+timestamp] (compound, unique), symbol, resolution
  Record: { symbol, resolution, timestamp, open, high, low, close, volume, updatedAt }
```

---

## Part 4: Workspace Integration UX

### 4.1 Chart Display Lifecycle

The chart is a **single-instance** workspace display — there's one chart window. It shows whichever symbol the user selects.

**Workflow:**

```
1. User clicks a ticker (or it's already highlighted/selected)
2. User presses "c"
   → Chart window opens/expands at its remembered position and size
   → Chart loads the selected symbol with the user's default resolution + window
   → Chart restores any saved drawings for that symbol + resolution
3. User interacts with chart:
   → Changes time resolution → chart reloads at new candle period
   → Changes time window → chart loads more/fewer candles
   → Draws trendlines, fibonacci, etc.
   → Undo/redo drawing operations
4. User selects a different ticker
   → Chart symbol changes to the new ticker's symbol
   → Drawings for previous symbol are saved
   → Drawings for new symbol are restored (if any)
   → Resolution + window stay the same
5. User presses "c" again
   → Chart window minimizes/closes
   → Position and size are saved for next open
```

### 4.2 Symbol Binding

The chart's symbol comes from the **currently selected/highlighted ticker** in the workspace. This is the existing selection mechanism — no new symbol picker needed for the chart.

```
Workspace selected ticker → chart symbol
```

If no ticker is selected, the chart shows the last-used symbol or remains on its current symbol.

### 4.3 Window Behavior

| Behavior | Detail |
|----------|--------|
| **Resizable** | Drag edges/corners with interact.js (same as FloatingDisplay) |
| **Draggable** | Drag title bar to reposition (same as FloatingDisplay) |
| **Minimizable** | "c" key toggles between expanded and minimized. Minimized = collapsed to a small bar or fully hidden. |
| **Position memory** | Workspace persists chart position (`x`, `y`) and size (`width`, `height`). Restored on next "c" open. |
| **Default position** | First open places chart at a sensible default (e.g., right side of workspace, filling available space). |

### 4.4 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `c` | Toggle chart open/close for selected symbol |
| `Escape` | Close chart (same as "c") |
| `Ctrl+Z` | Undo drawing action |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo drawing action |

### 4.5 Chart Window Workspace State

Stored in workspace config alongside existing display positions:

```json
{
  "chart": {
    "symbol": "EURUSD",
    "resolution": "4h",
    "window": "3M",
    "position": { "x": 260, "y": 10 },
    "size": { "width": 800, "height": 500 },
    "isMinimized": false,
    "defaultResolutionWindow": {
      "1m": "1d", "5m": "2d", "4h": "3M", "D": "6M"
    }
  }
}
```

### 4.6 Interaction with Existing Displays

- Chart window is a separate layer from price tickers and market profile
- Tickers remain visible when chart is open (chart doesn't cover the whole workspace)
- Market profile display continues operating independently
- Chart and market profile can show the same symbol simultaneously — they're different visualizations

---

## Part 5: Drawing Tools & Persistence

### 5.1 Built-in Drawing Objects

KLineChart provides these out of the box:

| Tool | KLineChart Overlay Name |
|------|------------------------|
| Trendline | `segment` |
| Ray line | `rayLine` |
| Horizontal line | `horizontalStraightLine` |
| Vertical line | `verticalStraightLine` |
| Parallel channel | `parallelStraightLine` |
| Fibonacci retracement | `fibonacciLine` |
| Rectangle | `rect` |
| Circle | `circle` |
| Ellipse | `ellipse` |
| Triangle | `triangle` |
| Arc | `arc` |
| Price range | `priceLine` |
| Price channel line | `priceChannelLine` |
| Annotation text | `simpleAnnotation` |
| Tag | `simpleTag` |

Plus: **magnet mode** (snap to candle OHLC).

### 5.2 Drawing Storage — Framework vs Custom

**Question: Does KLineChart provide built-in drawing persistence?**

KLineChart manages drawings as overlay objects in memory. It does **not** provide built-in persistence to IndexedDB or any storage. The overlays can be serialized/deserialized programmatically, but you must implement the storage layer.

**Approach: Dexie.js (IndexedDB) wrapper alongside KLineChart.**

When a drawing is created/modified/deleted:
1. KLineChart manages the overlay on canvas
2. Our code serializes the overlay state to JSON
3. JSON stored in IndexedDB via Dexie.js, scoped by `symbol + resolution`
4. On chart mount for a symbol: load drawings from IndexedDB, recreate overlays on KLineChart

### 5.3 ChartToolbar.svelte

Toolbar rendered within the chart window:

```
┌─────────────────────────────────────────────────────────────────┐
│ [1m][5m][10m][15m][30m]│[1h][4h][12h]│[D][W][M][Q]            │  ← Resolution
│ [1d][2d]│[1W][2W][3W]│[1M][2M][3M][6M][9M][12M]       │  ← Window
│─────────────────────────────────────────────────────────────────│
│ / ─ ⎯ │ ▯ ◯ △ ⌒ Fib │ [Magnet] [Undo] [Redo] [Clear] │  ← Drawing tools
│─────────────────────────────────────────────────────────────────│
│                                                                 │
│                     Chart Canvas                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.4 Drawing Persistence via IndexedDB (Dexie.js)

```javascript
// src/lib/chart/drawingStore.js

import Dexie from 'dexie';

const db = new Dexie('NeuroSenseDrawings');
db.version(1).stores({
  drawings: '++id, [symbol+resolution], overlayType, createdAt',
});

export const drawingStore = {
  async save(symbol, resolution, drawing) {
    return db.drawings.add({
      ...drawing,
      symbol,
      resolution,
      schemaVersion: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },

  async load(symbol, resolution) {
    return db.drawings
      .where({ symbol, resolution })
      .toArray();
  },

  async update(id, changes) {
    return db.drawings.update(id, { ...changes, updatedAt: Date.now() });
  },

  async remove(id) {
    return db.drawings.delete(id);
  },

  async clearAll(symbol, resolution) {
    return db.drawings.where({ symbol, resolution }).delete();
  },
};
```

**Schema evolution:** Drawing objects include `schemaVersion`. Future format changes use Dexie `version(N)` upgraders.

### 5.5 Undo/Redo via Command Pattern

```javascript
// src/lib/chart/drawingCommands.js

class DrawingCommandStack {
  constructor(maxDepth = 50) {
    this.undoStack = [];
    this.redoStack = [];
    this.maxDepth = maxDepth;
  }

  execute(command) {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = [];
    if (this.undoStack.length > this.maxDepth) this.undoStack.shift();
  }

  undo() {
    const cmd = this.undoStack.pop();
    if (cmd) { cmd.undo(); this.redoStack.push(cmd); }
  }

  redo() {
    const cmd = this.redoStack.pop();
    if (cmd) { cmd.execute(); this.undoStack.push(cmd); }
  }
}
```

Command types: `CreateDrawingCommand`, `MoveDrawingCommand`, `DeleteDrawingCommand`, `StyleChangeCommand`. Each wraps the KLineChart overlay API + Dexie.js persistence.

### 5.6 Drawing Serialization Format

```json
{
  "id": "auto",
  "symbol": "EURUSD",
  "resolution": "4h",
  "overlayType": "fibonacciLine",
  "points": [
    { "timestamp": 1712000000, "price": 1.0850 },
    { "timestamp": 1712010000, "price": 1.0920 }
  ],
  "styles": {
    "color": "#FF0000",
    "lineWidth": 2,
    "lineStyle": "solid"
  },
  "extendLeft": false,
  "extendRight": true,
  "schemaVersion": 1,
  "createdAt": 1712000000000,
  "updatedAt": 1712000000000
}
```

---

## Part 6: Historical Bar Caching

### 6.1 Strategy

Use IndexedDB via Dexie.js for client-side bar caching. Avoids re-fetching on every page load.

```javascript
db.version(1).stores({
  drawings: '++id, [symbol+resolution], overlayType, createdAt',
  bars: '[symbol+resolution+timestamp], symbol, resolution, timestamp',
});
```

### 6.2 Bar Data Flow

```
Chart mounts for EURUSD at 4h / 3M
    │
    ▼
Check IndexedDB cache for EURUSD:4h bars covering last 3 months
    │
    ├─ Cache hit (current) → Use cached bars, subscribe to real-time updates
    │
    └─ Cache miss or stale → Request historical candles from backend
                              │
                              ▼
                         Backend → ProtoOAGetTrendbarsReq → cTrader API
                              │
                              ▼
                         Store in IndexedDB, render on chart
```

### 6.3 Eviction

- M1/M5/M10/M15/M30: evict bars older than 7 days
- H1/H4: evict bars older than 30 days
- H12/D/W/M/Q: evict bars older than 90 days
- LRU eviction if storage exceeds configurable threshold

---

## Part 7: Frontend Files

### 7.1 New Files

```
src/
  components/
    ChartDisplay.svelte       // KLineChart display — single instance, bound to selected ticker
    ChartToolbar.svelte       // Resolution, window, drawing tools toolbar
  lib/
    chart/
      chartConfig.js          // KLineChart config, resolution-barSpace mappings, resolution/window constants
      drawingStore.js         // Drawing persistence via IndexedDB (Dexie.js)
      drawingCommands.js      // Undo/redo command pattern
  stores/
    chartDataStore.js         // OHLC bar arrays per symbol:resolution, subscribes to backend
```

### 7.2 Modified Files

```
src/stores/marketDataStore.js       // Handle 'candleUpdate' message type, route to chartDataStore
src/components/Workspace.svelte     // Register chart display, handle "c" shortcut, symbol binding
src/lib/dataContracts.js            // Add 'candleUpdate' and 'candleHistory' message types
services/tick-backend/CTraderSession.js        // Add subscribeToBars(symbol, period) for any period
services/tick-backend/CTraderEventHandler.js   // Emit bar events for any timeframe, not just M1
services/tick-backend/DataRouter.js            // Add routeCandleUpdate() method
services/tick-backend/utils/MessageBuilder.js  // Add candleUpdate message builder
```

### 7.3 KLineChart-Svelte Integration

KLineChart is imperative Canvas. Integration strategy:

| Lifecycle | Action |
|-----------|--------|
| `onMount` (chart opens via "c") | `init(container)`, lock zoom, load data, restore drawings |
| Symbol change | Save current drawings, clear chart, load new symbol data + drawings |
| Resolution change | `setBarSpace()`, fetch bars for new resolution, `applyNewData()` |
| Window change | Fetch bars for new range, `applyNewData()` |
| Real-time update | `chart.updateData(bar)` — push each bar update |
| `onDestroy` / "c" close | Persist drawings, save window position/size, `chart.dispose()` |

**Do NOT** use Svelte reactive bindings for KLineChart. Imperative Canvas updates via store subscriptions.

---

## Part 8: Implementation Milestones

### M-001: Backend Candle Data Extension

**Dependencies:** None

| File | Change |
|------|--------|
| `services/tick-backend/CTraderSession.js` | Add `subscribeToBars(symbol, period)` supporting all cTrader periods |
| `services/tick-backend/CTraderEventHandler.js` | Emit bar events for any subscribed timeframe |
| `services/tick-backend/DataRouter.js` | Add `routeCandleUpdate()` method |
| `services/tick-backend/utils/MessageBuilder.js` | Add `buildCandleUpdateMessage()` |
| `services/tick-backend/CTraderDataProcessor.js` | Add `fetchHistoricalCandles(symbol, period, from, to)` |

**Acceptance criteria:**
- Backend subscribes to trendbars for any cTrader-supported period
- `candleUpdate` messages broadcast to WebSocket clients with correct OHLC
- Historical candle requests return data via WebSocket
- M1 bars still work (no regression to existing market profile)

### M-002: Frontend Chart Store

**Dependencies:** M-001

| File | Change |
|------|--------|
| `src/stores/chartDataStore.js` | New: OHLC bar management, subscription, resolution switching, IndexedDB caching |
| `src/stores/marketDataStore.js` | Handle `candleUpdate` and `candleHistory` messages |
| `src/lib/dataContracts.js` | Add new message types |
| `src/lib/chart/chartConfig.js` | Resolution/window constants, barSpace mappings |

**Acceptance criteria:**
- chartDataStore loads historical candles from backend
- Real-time candle updates pushed to subscribers
- Resolution change fetches new data
- Symbol change triggers data reload
- Bars cached in IndexedDB

### M-003: Chart Display Component

**Dependencies:** M-002

| File | Change |
|------|--------|
| `src/components/ChartDisplay.svelte` | New: KLineChart init, data binding, lifecycle, symbol binding to selected ticker |
| `src/components/ChartToolbar.svelte` | New: Resolution buttons, window buttons |
| `src/components/Workspace.svelte` | Register chart display, "c" shortcut, symbol binding, position/size persistence |

**Acceptance criteria:**
- "c" opens chart for selected ticker's symbol
- Chart renders candlestick data from chartDataStore
- Time resolution locked (no zoom)
- Resolution and window buttons change data
- "c" minimizes/closes chart
- Chart position and size persist in workspace config
- Symbol changes when different ticker selected
- Chart disposes cleanly (no memory leaks)

### M-004: Drawing Tools & Persistence

**Dependencies:** M-003

| File | Change |
|------|--------|
| `src/components/ChartToolbar.svelte` | Add drawing tool buttons, magnet toggle, undo/redo |
| `src/lib/chart/drawingStore.js` | New: IndexedDB persistence via Dexie.js |
| `src/lib/chart/drawingCommands.js` | New: Undo/redo command pattern |

**Acceptance criteria:**
- All drawing tools render on chart (trendline, fibonacci, rectangle, etc.)
- Drawings persist to IndexedDB and restore on chart mount
- Undo/redo works for create, move, delete operations
- Magnet mode snaps to candle OHLC
- Drawings scoped per symbol:resolution
- Ctrl+Z / Ctrl+Shift+Z keyboard shortcuts work

---

## Part 9: Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| KLineChart 50px bar space limit insufficient for D/W/M/Q | Medium | Medium | Fork `BarSpaceLimitConstants` — 2-line change. Evaluate during M-003. |
| Missing `setVisibleRange` API | Medium | Low | Work around with `setBarSpace()` + `scrollToTimestamp()`. |
| KLineChart drawing API changes in future versions | Low | Medium | Pin KLineChart version; test before upgrading. |
| Q (quarterly) aggregation from MN1 may have edge cases at quarter boundaries | Low | Low | Validate quarter boundary logic (Mar→Jun, etc.) in M-002. Use UTC month-based boundaries. |
| IndexedDB storage quota on Safari | Low | Medium | Implement bar eviction. Safari allows ~1GB. |
| Multiple timeframe subscriptions overload cTrader connection | Medium | Medium | Only subscribe to the currently active chart timeframe. Unsubscribe on resolution change. |

---

## Part 10: Out of Scope

| Item | Why |
|------|-----|
| OANDA or other broker integration | Use existing cTrader pipeline. Broker expansion is a separate effort. |
| Removing cTrader integration | Chart uses cTrader data. No replacement. |
| Modifying existing market profile visualization | Chart coexists, not replaces. |
| Order placement | Display-only. |
| Multi-chart layout (grid of charts) | Single chart instance first. |
| Chart sharing / sync across devices | Local persistence only. |
| Custom drawing tool types beyond KLineChart built-ins | Use what's built-in first. |
| Technical indicators (RSI, MACD, etc.) | Separate milestone after chart is stable. |
| Docker/deployment changes | Development feature only. |

---

## Appendix A: Key Reference Files

| File | Role |
|------|------|
| `services/tick-backend/CTraderSession.js` | cTrader session — extend bar subscriptions |
| `services/tick-backend/CTraderEventHandler.js` | Bar/tick event processing — extend for multi-timeframe |
| `services/tick-backend/CTraderDataProcessor.js` | Historical data fetching — extend for any period |
| `services/tick-backend/DataRouter.js` | Data routing — add candle routing |
| `services/tick-backend/utils/MessageBuilder.js` | Message formatting — add candle messages |
| `libs/cTrader-Layer/protobuf/OpenApiMessages.proto` | cTrader API — `ProtoOAGetTrendbarsReq`, `ProtoOATrendbar` |
| `src/stores/marketDataStore.js` | Frontend data store — handle candle messages |
| `src/components/FloatingDisplay.svelte` | Pattern reference for ChartDisplay |
| `src/components/Workspace.svelte` | Workspace — register chart, "c" shortcut |
| `src/lib/dataContracts.js` | Message type definitions |

## Appendix B: NPM Dependencies to Add

| Package | Purpose | Size |
|---------|---------|------|
| `klinecharts` | Chart rendering + drawing tools | ~40KB gzipped |
| `dexie` | IndexedDB wrapper for drawing/bar persistence | ~12KB gzipped |

## Appendix C: KLineChart Source Code References

For the forking decision:

| File | Lines | What |
|------|-------|------|
| `src/Store.ts` | 56-59 | `BarSpaceLimitConstants = { MIN: 1, MAX: 50 }` |
| `src/Store.ts` | ~1048-1051 | `zoom()` method |
| `src/Store.ts` | 225-238 | `setZoomEnabled()` / `setScrollEnabled()` |
| `src/Chart.ts` | — | Public API: `setBarSpace()`, `getVisibleRange()` |

## Appendix D: cTrader Proto Trendbar Periods

From `OpenApiModelMessages.proto:496-511`, the `ProtoOATrendbarPeriod` enum values:

| Enum Value | Period | Used by Chart |
|------------|--------|---------------|
| 1 | M1 | Yes |
| 2 | M2 | No (not in resolution list) |
| 3 | M3 | No (not in resolution list) |
| 4 | M4 | No (not in resolution list) |
| 5 | M5 | Yes |
| 6 | M10 | Yes |
| 7 | M15 | Yes |
| 8 | M30 | Yes |
| 9 | H1 | Yes |
| 10 | H4 | Yes |
| 11 | H12 | Yes |
| 12 | D1 | Yes |
| 13 | W1 | Yes |
| 14 | MN1 | Yes |

All 12 chart resolutions use cTrader native periods directly. Only **Q (quarterly)** is aggregated from MN1 on the frontend.

**Per-request range limits** (from `OpenApiMessages.proto:500`):
- M1-M5: `toTimestamp - fromTimestamp <= 302,400,000` (5 weeks)
- M10, M15, M30, H1: `<= 21,168,000,000` (35 weeks)
- H4, H12, D1: `<= 31,622,400,000` (1 year)
- W1, MN1: `<= 158,112,000,000` (5 years)
