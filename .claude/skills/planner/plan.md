# Previous Day OHLC Markers Implementation Plan

## Overview

Implement previous trading day's Open, High, Low, Close (OHLC) price level markers on the left side of the trading canvas. The feature extracts previous day OHLC from D1 candles/trendbars in both cTrader (primary) and TradingView (secondary) backend sessions, forwards the data through DataRouter, and renders dashed gray lines with labels (PD O, PD H, PD L, PD C) on the canvas.

**Approach selected:** Direct Implementation (Approach 1) - Inline extraction in both backend sessions, no shared helpers. This follows Crystal Clivity principles of simplicity over extensibility, keeps each function under 15 lines, and adds minimal overhead (~45 lines total).

**Key decisions:**
- Dual data source support: Both cTrader and TradingView extract prevDay OHLC using identical patterns
- Missing file discovered: `displayDataProcessor.js` must be updated to extract prevDayOHLC from symbolDataPackage
- E2E tests already exist: `previous-day-ohlc.spec.js` and `prevDay-ohlc-simple.spec.js`

## Planning Context

This section is consumed VERBATIM by downstream agents (Technical Writer, Quality Reviewer). Quality matters: vague entries here produce poor annotations and missed risks.

### Decision Log

| Decision | Reasoning Chain |
| --- | --- |
| **Direct Implementation (no shared helpers)** | Extraction is 4 lines of simple array access -> Creating shared helper would add ~30 lines of boilerplate (file, exports, imports) -> Code duplication (8 lines total) is less complexity than abstraction overhead (30 lines) -> Can refactor to shared helper if/when third data source added |
| **Include displayDataProcessor.js** | Design document omitted this file -> Frontend data flow inspection shows DataRouter emits prevDay* fields -> displayDataProcessor.processSymbolData() extracts symbolDataPackage fields but currently lacks prevDayOHLC extraction -> Without this change, prevDay data never reaches workspace store -> Markers would not render |
| **Axis position at 15% from left** | Current price renders at 75% from right (dayRangeOrchestrator line 86) -> Previous day markers should be on opposite side to avoid overlap -> 15% from left provides clear separation -> Matches design document specification |
| **Dashed lines for previous day markers** | Current day markers use solid lines -> Visual distinction needed to differentiate temporal context -> Dashed lines standard convention for historical/reference data -> Consistent with TradingView/TradingLite industry patterns |
| **Gray color (#D1D5DB) for previous day** | Current day uses blue/colored markers -> Muted gray indicates "less prominent" than current data -> #D1D5DB is visible but doesn't compete with today's levels -> Matches design document and existing UI hierarchy |
| **Conditional spread pattern for forwarding** | DataRouter uses `...(field !== undefined && { field })` pattern -> Provides null-safe forwarding without explicit if/else -> Maintains consistency with existing ADR/pipPosition forwarding -> Prevents undefined fields from appearing in emitted messages |
| **Index -2 for previous day** | D1 array's last element (index -1) contains current session data, index -2 contains previous completed day -> Works for both cTrader (dailyBars) and TradingView (historicalCandles) -> Same pattern as existing ADR calculation (CTraderSession line 270) |
| **No backend unit tests** | Extraction logic is simple array access with delta calculation -> Property-based tests would be more code than implementation -> Integration tests would mock real APIs (violates default-conventions) -> E2E tests already validate full data flow -> Value of unit tests < maintenance cost |

### Rejected Alternatives

| Alternative | Why Rejected |
| --- | --- |
| **Shared extractPrevDayOHLC() helper** | Would require new file in backend with ~30 lines boilerplate (imports, exports, error handling) -> 4-line extraction doesn't warrant abstraction -> Design document specifies direct implementation -> User confirmed Approach 1 in assumption surfacing |
| **Unified OHLCRegistry class** | ~80 lines overhead for managing today/prevDay/week/month -> Violates YAGNI principle (week/month not planned) -> Current requirements are simple display, not complex temporal queries -> Design document explicitly rejects this as "Solution [5]" |
| **Generic Historical Marker System** | Would require refactoring existing today's marker rendering -> High risk for low gain (today's markers work fine) -> Design document explicitly rejects as "Solution [8]" -> Crystal Clivity: minimal changes to achieve goal |

### Constraints & Assumptions

**Technical:**
- Must comply with Crystal Clivity: <120 lines per file, <15 lines per function
- Framework-First: Canvas 2D for rendering, Svelte stores for state, no new libraries
- cTrader uses delta-based price encoding: `actualPrice = low + deltaOpen/deltaHigh/deltaClose/deltaLow`
- TradingView provides direct OHLC values in candles
- D1 candles/trendbars already fetched for ADR calculation (no new API calls)

**Organizational:**
- Design document pre-approved and specified in user's request
- User confirmed Approach 1 (Direct Implementation) via AskUserQuestion
- User confirmed inclusion of displayDataProcessor.js via AskUserQuestion

**Dependencies:**
- `CTraderSession.js` - Must have dailyBars.length >= 2 for extraction
- `TradingViewSession.js` - Must have historicalCandles.length >= 2 for extraction
- `renderMarkerLine()` helper in priceMarkerRenderer.js - Existing function for drawing price lines
- `formatPriceForDisplay()` - Existing function for price formatting with pip emphasis
- E2E test framework: Playwright with backend running on localhost:8081

**Default conventions applied:**
- `<default-conventions domain="testing">` - E2E tests over unit/integration (user-specified via existing test files)
- `<default-conventions domain="file-creation">` - Extending existing files (no new files except documentation)
- `<default-conventions domain="temporal.md">` - Timeless present comments (no "Added", "New", "Changed")

### Known Risks

| Risk | Mitigation | Anchor |
| --- | --- | --- |
| **Insufficient D1 data** (array length < 2) | Backend uses conditional: `dailyBars.length >= 2 ? ... : null` -> prevDayOHLC is null if insufficient data -> Frontend renderer checks `if (!prevOHLC) return` -> Markers simply don't appear, no error | CTraderSession.js:270 (ADR calculation uses same pattern) |
| **Weekend/holiday gaps in D1 data** | Previous day is defined as "last completed daily bar" regardless of calendar days -> If Friday was last trading day, Friday's OHLC shows on Monday -> Matches trader expectation of "previous session" not "previous calendar day" | CTraderSession.js:269-272 (ADR uses `dailyBars.slice(-lookback-1, -1)` pattern) |
| **cTrader delta calculation errors** | Uses existing `calculatePrice()` method (lines 38-42) -> Same method used for today's OHLC extraction (lines 287-292) -> If bug exists, it already affects today's markers -> No new risk introduced | CTraderSession.js:38-42 (calculatePrice implementation) |
| **Canvas label overlap** | Four lines (O, H, L, C) at similar prices could overlap -> Mitigation: Each label rendered independently, canvas handles text overlap naturally -> Testing with extreme volatility (e.g., GBP flash crash) will reveal issues | E2E tests: previous-day-ohlc.spec.js (visual validation tests) |
| **Data race: symbol change during render** | Workspace store updates atomically via Svelte reactivity -> Canvas render triggered after store update completes -> Same pattern as today's markers (no reported race issues) | workspace.js:279 (store update pattern) |

## Invisible Knowledge

This section captures knowledge NOT deducible from reading the code alone.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Backend Data Flow                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────┐     ┌──────────────────┐                         │
│  │  CTraderSession  │     │ TradingViewSession│                          │
│  │   (Primary)      │     │   (Secondary)     │                         │
│  └────────┬─────────┘     └────────┬─────────┘                         │
│           │                         │                                    │
│           │ getSymbolDataPackage()  │ emitDataPackage()                 │
│           │ +10 lines               │ +4 lines                          │
│           │                         │                                    │
│           │ Extract prevDayOHLC     │ Extract prevDayOHLC               │
│           │ from dailyBars[-2]      │ from historicalCandles[-2]        │
│           │                         │                                    │
│           ▼                         ▼                                    │
│  ┌──────────────────────────────────────────────┐                       │
│  │              DataRouter.js (+8 lines)        │                       │
│  │  routeFromCTrader()    routeFromTradingView()│                       │
│  └──────────────────┬───────────────────────────┘                       │
│                     │                                                      │
│                     │ WebSocket message: { type, source, symbol,         │
│                     │   prevDayOpen, prevDayHigh, prevDayLow,            │
│                     │   prevDayClose, ... }                              │
│                     │                                                      │
├─────────────────────┼────────────────────────────────────────────────────┤
│  Frontend Data Flow │                                                     │
├─────────────────────┼────────────────────────────────────────────────────┤
│                     │                                                      │
│                     ▼                                                      │
│  ┌──────────────────────────────────────────────┐                       │
│  │      displayDataProcessor.js (+5 lines)      │                       │
│  │  processSymbolData() extracts prevDayOHLC    │                       │
│  └──────────────────┬───────────────────────────┘                       │
│                     │                                                      │
│                     │ { prevDayOHLC: { open, high, low, close } }        │
│                     │                                                      │
│                     ▼                                                      │
│  ┌──────────────────────────────────────────────┐                       │
│  │           workspace.js (store)                │                       │
│  │  Reactive state update triggers render        │                       │
│  └──────────────────┬───────────────────────────┘                       │
│                     │                                                      │
│                     ▼                                                      │
│  ┌──────────────────────────────────────────────┐                       │
│  │     dayRangeOrchestrator.js (+2 lines)        │                       │
│  │  renderPriceElementsExceptCurrent() calls     │                       │
│  └──────────────────┬───────────────────────────┘                       │
│                     │                                                      │
│                     ▼                                                      │
│  ┌──────────────────────────────────────────────┐                       │
│  │   priceMarkerRenderer.js (+14 lines)          │                       │
│  │   renderPreviousDayOHLC() draws 4 lines       │                       │
│  └──────────────────────────────────────────────┘                       │
│                     │                                                      │
│                     ▼                                                      │
│              Canvas 2D rendering                                           │
│              Dashed gray lines at OHLC levels                              │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

**Prev Day OHLC Data Path:**

```
D1 Trendbars/Candles (already fetched for ADR)
  |
  v
[Backend] Extraction: Array element at index -2
  |
  v
[Backend] Delta Calculation (cTrader only): actualPrice = low + delta*
  |
  v
[DataRouter] Conditional Spread: ...(prevDayOpen !== undefined && { prevDayOpen })
  |
  v
[WebSocket] JSON Message: { type: 'symbolDataPackage', prevDayOpen: 1.0850, ... }
  |
  v
[Frontend] displayDataProcessor: prevDayOHLC = { open, high, low, close }
  |
  v
[Frontend] workspace store: $symbolData.prevDayOHLC
  |
  v
[Frontend] dayRangeOrchestrator: renderPreviousDayOHLC(ctx, config, ...)
  |
  v
[Frontend] priceMarkerRenderer: renderMarkerLine() with dashed: true
  |
  v
Canvas 2D: Visual lines with labels "PD O", "PD H", "PD L", "PD C"
```

**Key Data Transformations:**

1. **cTrader Delta Encoding**: Raw trendbar uses delta values from `low` baseline
   - `open = low + deltaOpen`
   - `high = low + deltaHigh`
   - `close = low + deltaClose`
   - All prices calculated via `calculatePrice(rawValue, digits)` method

2. **Array Indexing**: Previous day is always `-2` (second-to-last element)
   - Last element (`-1`) contains current session data
   - Index `-2` contains previous completed day
   - Same pattern used in ADR calculation (CTraderSession line 270)

3. **Null Safety**: Each layer handles missing prevDay data
   - Backend: `dailyBars.length >= 2 ? ... : null`
   - Router: Conditional spread omits undefined fields
   - Renderer: `if (!prevOHLC) return` (early exit)

### Why This Structure

**Dual extraction in CTraderSession and TradingViewSession:**

Each session has different data formats:
- cTrader: Delta-encoded trendbars requiring `calculatePrice()` transformation
- TradingView: Direct OHLC values from candles

A shared helper would need to handle both formats, adding complexity. The 4-line extraction pattern is simple enough that duplication is acceptable.

**Why displayDataProcessor.js was missing from design:**

The design document focused on backend→frontend transmission but missed the intermediate processing layer. DataRouter emits prevDay* fields, but displayDataProcessor extracts them into the `prevDayOHLC` object that the workspace store consumes.

**Why axisX = 15% from left:**

Current day markers render at 75% from right side (approximately 25% from left). Placing previous day markers at 15% from left creates clear visual separation on the opposite side of the chart, preventing label overlap.

### Invariants

- **Previous day is index -2**: The last element of D1 array contains current session data. Previous completed day is always at index -2.
- **Null safety at every layer**: Backend returns null if insufficient data; Router omits undefined fields; Renderer returns early if no prevOHLC.
- **Delta encoding only for cTrader**: TradingView provides direct OHLC values. Only cTrader requires `calculatePrice()` transformation.
- **Symbol data package is one-time**: prevDayOHLC is only sent in initial `symbolDataPackage`, not in subsequent tick updates.

### Tradeoffs

**Code duplication vs. Abstraction:**

- *Chose*: 8 lines of duplicated extraction logic (4 in CTraderSession, 4 in TradingViewSession)
- *Cost*: If third data source added, must copy extraction pattern again
- *Benefit*: No 30-line abstraction layer for 4-line operation
- *Rationale*: Crystal Clivity prioritizes simplicity; can refactor later if needed

**Dashed lines vs. Solid lines with different color:**

- *Chose*: Dashed lines with gray color
- *Cost*: Requires canvas `setLineDash()` call
- *Benefit*: Industry-standard convention for historical data; more accessible than color-only distinction
- *Rationale*: Color alone insufficient for colorblind users; dashed lines provide texture cue

**Four separate markers vs. Single combined marker:**

- *Chose*: Four separate render calls (PD O, PD H, PD L, PD C)
- *Cost*: 4x renderMarkerLine() calls
- *Benefit*: Each line can have independent label; handles cases where some prices are missing
- *Rationale*: Simpler than combined marker; more flexible for edge cases

## Milestones

### Milestone 1: Backend - cTrader (Primary Data Source)

**Files**:
- `services/tick-backend/CTraderSession.js`

**Flags**:
- `conformance`: Follow existing ADR extraction pattern

**Requirements**:
- Extract previous day OHLC from `dailyBars` array in `getSymbolDataPackage()` function
- Calculate prices using `calculatePrice()` method with delta encoding
- Add prevDayOpen, prevDayHigh, prevDayLow, prevDayClose to `finalPackage` using conditional spread
- Handle insufficient data case (dailyBars.length < 2)

**Acceptance Criteria**:
- `finalPackage` contains prevDayOpen, prevDayHigh, prevDayLow, prevDayClose when dailyBars.length >= 2
- Fields are absent when dailyBars.length < 2 (null prevDayOHLC results in no spread)
- Prices are calculated correctly using delta encoding: `price = low + delta*`

**Tests**:
- **Test files**: `src/tests/e2e/prevDay-ohlc-simple.spec.js` (existing)
- **Test type**: E2E
- **Backing**: user-specified (tests already exist)
- **Scenarios**:
  - Normal: Sufficient D1 data (dailyBars.length >= 2) - prevDay fields present
  - Edge: Insufficient D1 data (dailyBars.length < 2) - prevDay fields absent, no error
  - Edge: Delta encoding produces correct prices (compare with today's OHLC calculation)

**Code Intent**:

In `getSymbolDataPackage()` function, after line 270 where `dailyBars` is accessed for ADR calculation:

1. Extract previous day bar: `const previousDay = dailyBars.length >= 2 ? dailyBars[dailyBars.length - 2] : null`
2. Calculate prevDayOHLC object using `calculatePrice()` method:
   - `open = this.calculatePrice(Number(previousDay.low) + Number(previousDay.deltaOpen), digits)`
   - `high = this.calculatePrice(Number(previousDay.low) + Number(previousDay.deltaHigh), digits)`
   - `low = this.calculatePrice(Number(previousDay.low), digits)`
   - `close = this.calculatePrice(Number(previousDay.low) + Number(previousDay.deltaClose), digits)`
3. Guard with null check: `const prevDayOHLC = previousDay ? { ... } : null`
4. Add to `finalPackage` using conditional spread after line 314:
   - `...(prevDayOHLC && { prevDayOpen: prevDayOHLC.open })`
   - `...(prevDayOHLC && { prevDayHigh: prevDayOHLC.high })`
   - `...(prevDayOHLC && { prevDayLow: prevDayOHLC.low })`
   - `...(prevDayOHLC && { prevDayClose: prevDayOHLC.close })`

**Code Changes** (filled by Developer agent):

```diff
--- a/services/tick-backend/CTraderSession.js
+++ b/services/tick-backend/CTraderSession.js
@@ -270,8 +270,17 @@ async getSymbolDataPackage(symbolName, adrLookbackDays = 14) {
     const adrBars = dailyBars.slice(Math.max(0, dailyBars.length - 1 - adrLookbackDays), dailyBars.length - 1);
     const adrRanges = adrBars.map(bar => this.calculatePrice(Number(bar.deltaHigh) || 0, digits));
     const adr = adrRanges.length > 0 ? adrRanges.reduce((sum, range) => sum + range, 0) / adrRanges.length : 0;
+
+    // Extract previous day OHLC from daily bars (index -2: last element is current session, -2 is previous completed day)
+    const previousDay = dailyBars.length >= 2 ? dailyBars[dailyBars.length - 2] : null;
+
+    const prevDayOHLC = previousDay ? {
+        open: this.calculatePrice(Number(previousDay.low) + Number(previousDay.deltaOpen), digits),
+        high: this.calculatePrice(Number(previousDay.low) + Number(previousDay.deltaHigh), digits),
+        low: this.calculatePrice(Number(previousDay.low), digits),
+        close: this.calculatePrice(Number(previousDay.low) + Number(previousDay.deltaClose), digits)
+    } : null;
+
     let todaysOpen, todaysHigh, todaysLow, initialPrice, initialMarketProfile;

     const m1Bars = intradayBarsData.trendbar;
@@ -312,6 +321,10 @@ async getSymbolDataPackage(symbolName, adrLookbackDays = 14) {
         pipPosition: symbolInfo.pipPosition,        // ← ADD THIS
         pipSize: symbolInfo.pipSize,               // ← ADD THIS
         pipetteSize: symbolInfo.pipetteSize        // ← ADD THIS
+        // Previous day OHLC
+        ...(prevDayOHLC && { prevDayOpen: prevDayOHLC.open }),
+        ...(prevDayOHLC && { prevDayHigh: prevDayOHLC.high }),
+        ...(prevDayOHLC && { prevDayLow: prevDayOHLC.low }),
+        ...(prevDayOHLC && { prevDayClose: prevDayOHLC.close })
     };

     return finalPackage;

### Milestone 2: Backend - TradingView (Secondary Data Source)

**Files**:
- `services/tick-backend/TradingViewSession.js`

**Flags**:
- `conformance`: Follow existing historicalCandles pattern

**Requirements**:
- Extract previous day OHLC from `historicalCandles` array in `emitDataPackage()` function
- Add prevDayOpen, prevDayHigh, prevDayLow, prevDayClose to emit object
- Handle insufficient data case (historicalCandles.length < 2)

**Acceptance Criteria**:
- Emitted object contains prevDayOpen, prevDayHigh, prevDayLow, prevDayClose when historicalCandles.length >= 2
- Fields are absent when historicalCandles.length < 2
- Values are direct OHLC from candles (no delta calculation needed)

**Tests**:
- **Test type**: E2E (via existing tests, but note: existing tests use cTrader source)
- **Backing**: doc-derived (design document specifies dual source support)
- **Scenarios**:
  - Normal: Sufficient D1 data - prevDay fields present in emitted package
  - Edge: Insufficient D1 data - prevDay fields absent, no error

**Code Intent**:

In `emitDataPackage()` function, after line 234 where data package is constructed:

1. Access `data.historicalCandles` array (already populated at lines 103-115)
2. Extract previous day: `const previousDay = data.historicalCandles.length >= 2 ? data.historicalCandles[data.historicalCandles.length - 2] : null`
3. Add to emit object using conditional spread:
   - `...(previousDay?.open !== undefined && { prevDayOpen: previousDay.open })`
   - `...(previousDay?.high !== undefined && { prevDayHigh: previousDay.high })`
   - `...(previousDay?.low !== undefined && { prevDayLow: previousDay.low })`
   - `...(previousDay?.close !== undefined && { prevDayClose: previousDay.close })`

**Code Changes** (filled by Developer agent):

```diff
--- a/services/tick-backend/TradingViewSession.js
+++ b/services/tick-backend/TradingViewSession.js
@@ -244,6 +244,12 @@ class TradingViewSession extends EventEmitter {
         // Use today's actual open from M1 bars (matching cTrader behavior)
         // Falls back to last D1 close if no M1 bars today yet
         const todaysOpen = todaysM1Candles.length > 0 ? todaysM1Candles[0].open : data.lastCandle.close;
+
+        // Extract previous day OHLC from historical candles (index -2: last element is current session, -2 is previous completed day)
+        const previousDay = data.historicalCandles.length >= 2
+            ? data.historicalCandles[data.historicalCandles.length - 2]
+            : null;
+
         // FIRST PRINCIPLES: Estimate pip data from price for proper bucket alignment
         const pipData = estimatePipData(data.lastCandle.close);
         const bucketSize = calculateBucketSizeForSymbol(symbol);
@@ -262,6 +268,10 @@ class TradingViewSession extends EventEmitter {
             initialMarketProfile: todaysM1Candles,  // Only today's M1 bars for TPO calculation
             bucketSize  // Bucket size for Market Profile alignment
+            // Previous day OHLC
+            ...(previousDay?.open !== undefined && { prevDayOpen: previousDay.open }),
+            ...(previousDay?.high !== undefined && { prevDayHigh: previousDay.high }),
+            ...(previousDay?.low !== undefined && { prevDayLow: previousDay.low }),
+            ...(previousDay?.close !== undefined && { prevDayClose: previousDay.close })
         });

         data.initialSent = true;

### Milestone 3: Backend - DataRouter (Both Sources)

**Files**:
- `services/tick-backend/DataRouter.js`

**Flags**:
- `conformance`: Use existing conditional spread pattern

**Requirements**:
- Update `routeFromCTrader()` to forward prevDayOpen, prevDayHigh, prevDayLow, prevDayClose
- Update `routeFromTradingView()` to forward same fields
- Use conditional spread pattern: `...(field !== undefined && { field })`

**Acceptance Criteria**:
- WebSocket messages from cTrader source contain prevDay* fields when present
- WebSocket messages from TradingView source contain prevDay* fields when present
- Fields are absent when not present in source data
- No undefined fields in emitted messages

**Tests**:
- **Test type**: E2E (covered by existing tests via end-to-end validation)

**Code Intent**:

In `routeFromCTrader()` function, after line 19, add prevDay field forwarding using conditional spread pattern (same as existing pipPosition pattern at lines 43-44).

In `routeFromTradingView()` function, after line 50 (after bucketSize spread), add prevDay field forwarding using same conditional spread pattern.

**Code Changes** (filled by Developer agent):

```diff
--- a/services/tick-backend/DataRouter.js
+++ b/services/tick-backend/DataRouter.js
@@ -14,6 +14,10 @@ class DataRouter {
     routeFromCTrader(tick) {
         const message = {
             type: 'tick',
             source: 'ctrader',
             ...tick,
+            // Previous day OHLC
+            ...(tick.prevDayOpen !== undefined && { prevDayOpen: tick.prevDayOpen }),
+            ...(tick.prevDayHigh !== undefined && { prevDayHigh: tick.prevDayHigh }),
+            ...(tick.prevDayLow !== undefined && { prevDayLow: tick.prevDayLow }),
+            ...(tick.prevDayClose !== undefined && { prevDayClose: tick.prevDayClose })
         };
         this.broadcastToClients(message, tick.symbol, 'ctrader');
     }
@@ -44,6 +48,10 @@ class DataRouter {
             // Also include current for symbolDataPackage
             ...(candle.current !== undefined && { current: candle.current }),
             // Include initialMarketProfile for Market Profile data
             ...(candle.initialMarketProfile !== undefined && { initialMarketProfile: candle.initialMarketProfile }),
+            // Previous day OHLC
+            ...(candle.prevDayOpen !== undefined && { prevDayOpen: candle.prevDayOpen }),
+            ...(candle.prevDayHigh !== undefined && { prevDayHigh: candle.prevDayHigh }),
+            ...(candle.prevDayLow !== undefined && { prevDayLow: candle.prevDayLow }),
+            ...(candle.prevDayClose !== undefined && { prevDayClose: candle.prevDayClose }),
             // Include bucketSize for Market Profile
             ...(candle.bucketSize !== undefined && { bucketSize: candle.bucketSize })
         };

### Milestone 4: Frontend - displayDataProcessor (Missing from Design)

**Files**:
- `src/lib/displayDataProcessor.js`

**Flags**:
- `conformance`: Follow existing symbolDataPackage extraction pattern
- `needs-rationale`: This file was missing from design document

**Requirements**:
- Extract prevDayOHLC object in `processSymbolData()` function's symbolDataPackage branch
- Create `{ open, high, low, close }` object from prevDayOpen, prevDayHigh, prevDayLow, prevDayClose fields
- Handle null/undefined case (don't add prevDayOHLC if fields absent)

**Acceptance Criteria**:
- `symbolData.prevDayOHLC` exists when prevDayOpen/High/Low/Close are present
- `symbolData.prevDayOHLC` is undefined when prevDay fields are absent
- Object structure: `{ open: number, high: number, low: number, close: number }`

**Tests**:
- **Test type**: E2E (covered by existing tests via end-to-end validation)

**Code Intent**:

In `processSymbolData()` function, in the `symbolDataPackage` branch (lines 34-47), after line 47 where `initialMarketProfile` is extracted:

1. Check if any prevDay field exists: `if (data.prevDayOpen !== undefined || data.prevDayHigh !== undefined ...)`
2. Extract prevDayOHLC object with same pattern as existing `ohlc` extraction:
   ```javascript
   ...(data.prevDayOpen !== undefined && {
       prevDayOHLC: {
           open: data.prevDayOpen,
           high: data.prevDayHigh,
           low: data.prevDayLow,
           close: data.prevDayClose
       }
   })
   ```

**Code Changes** (filled by Developer agent):

```diff
--- a/src/lib/displayDataProcessor.js
+++ b/src/lib/displayDataProcessor.js
@@ -34,13 +34,19 @@ export function processSymbolData(data, formattedSymbol, lastData) {
     pipPosition: data.pipPosition ?? estimatePipPosition(data.current || priceRef),
     pipSize: data.pipSize ?? estimatePipSize(data.current || priceRef),
     pipetteSize: data.pipetteSize,
     source: data.source || 'ctrader',
     previousPrice: data.current || data.price || data.bid || data.ask || data.initialPrice || data.todaysOpen || 1.0,
     direction: 'neutral',
-    initialMarketProfile: data.initialMarketProfile || null
+    initialMarketProfile: data.initialMarketProfile || null,
+    // Previous day OHLC - extract all four fields as object
+    ...((data.prevDayOpen !== undefined || data.prevDayHigh !== undefined ||
+         data.prevDayLow !== undefined || data.prevDayClose !== undefined) && {
+        prevDayOHLC: {
+            open: data.prevDayOpen,
+            high: data.prevDayHigh,
+            low: data.prevDayLow,
+            close: data.prevDayClose
+        }
+    })
   } : data.type === 'tick' && data.symbol === formattedSymbol ? {

### Milestone 5: Frontend - Config and Renderer

**Files**:
- `src/lib/dayRangeConfig.js`
- `src/lib/priceMarkerRenderer.js`

**Flags**:
- `conformance`: Follow existing color and rendering patterns

**Requirements**:
- Add `previousDay: '#D1D5DB'` color to dayRangeConfig colors object
- Implement `renderPreviousDayOHLC()` function in priceMarkerRenderer
- Use `renderMarkerLine()` helper with dashed: true option
- Labels: "PD O", "PD H", "PD L", "PD C"

**Acceptance Criteria**:
- dayRangeConfig.colors.previousDay exists and equals '#D1D5DB'
- renderPreviousDayOHLC() exported from priceMarkerRenderer
- Function renders 4 dashed lines at prevOHLC open, high, low, close prices
- Lines render at axisX = width * 0.15 (15% from left)
- Early return if prevOHLC is null/undefined

**Tests**:
- **Test type**: E2E (existing visual validation tests)
- **Backing**: user-specified (tests already exist)
- **Scenarios**:
  - Normal: All 4 prevOHLC prices present - 4 lines rendered
  - Edge: Some prices null/undefined - only available prices rendered
  - Edge: prevOHLC is null - no lines rendered, no error

**Code Intent**:

**dayRangeConfig.js**: In colors object (after line 18), add:
```javascript
previousDay: '#D1D5DB'
```

**priceMarkerRenderer.js**: At end of file (after line 124), add new function:

1. Function signature: `export function renderPreviousDayOHLC(ctx, config, axisX, priceScale, prevOHLC, symbolData)`
2. Early return: `if (!prevOHLC) return;`
3. Get color: `const color = config.colors.previousDay || '#9CA3AF'`
4. Calculate axis position: `const axisXLeft = axisX * 0.2` (approximately 15% from left, using existing axisX parameter which is width * 0.75)
5. Define render helper that calls renderMarkerLine():
   ```javascript
   const render = (price, label) => price && renderMarkerLine(
       ctx, priceScale(price), axisXLeft, color, 1, 10,
       {
           text: `${label}: ${formatPriceForDisplay(price, symbolData)}`,
           textColor: color,
           textFont: '14px monospace',
           dashed: true
       }
   );
   ```
6. Call render for each OHLC: `render(prevOHLC.open, 'PD O')`, `render(prevOHLC.high, 'PD H')`, `render(prevOHLC.low, 'PD L')`, `render(prevOHLC.close, 'PD C')`

**Code Changes** (filled by Developer agent):

```diff
--- a/src/lib/dayRangeConfig.js
+++ b/src/lib/dayRangeConfig.js
@@ -6,11 +6,12 @@ export const defaultConfig = {
   colors: {
     axisPrimary: '#4B5563',
     axisReference: '#f66a51ff',
     currentPrice: '#6B7280',
     priceUp: '#cde0f6ff', //4a9eff
     priceDown: '#4a9eff', //8f6ce0ff
     sessionPrices: '#f69051ff',
     openPrice: '#6B7280',
     adrRange: 'rgba(224, 224, 224, 0.3)',
     sessionRange: 'rgba(59, 130, 246, 0.3)',
     boundaryLine: '#854be8',
     percentageLabels: '#9CA3AF',
-    markers: '#374151'
+    markers: '#374151',
+    previousDay: '#D1D5DB' // Muted gray for previous day markers
   },

```diff
--- a/src/lib/priceMarkerRenderer.js
+++ b/src/lib/priceMarkerRenderer.js
@@ -116,3 +116,17 @@ export function renderUserPriceMarkers(ctx, config, axisX, priceScale, markers,
   });
 }

 // Render Alt+hover preview line at hover price
 export function renderHoverPreview(ctx, config, axisX, priceScale, hoverPrice) {
   if (!hoverPrice) return;

   const hoverY = priceScale(hoverPrice);
   renderMarkerLine(ctx, hoverY, axisX, 'rgba(255, 255, 255, 0.5)', 2, 80, {
     dashed: true
   });
 }
+
+// Render previous day OHLC markers (Open, High, Low, Close)
+export function renderPreviousDayOHLC(ctx, config, axisX, priceScale, prevOHLC, symbolData) {
+  if (!prevOHLC) return;
+  const color = config.colors.previousDay || '#9CA3AF';
+  const axisXLeft = axisX * 0.2; // Position at ~15% from left (axisX param is width * 0.75)
+
+  const render = (price, label) => price && renderMarkerLine(
+    ctx, priceScale(price), axisXLeft, color, 1, 10,
+    {
+      text: `${label}: ${formatPriceForDisplay(price, symbolData)}`,
+      textColor: color,
+      textFont: '14px monospace',
+      dashed: true
+    }
+  );
+
+  render(prevOHLC.open, 'PD O');
+  render(prevOHLC.high, 'PD H');
+  render(prevOHLC.low, 'PD L');
+  render(prevOHLC.close, 'PD C');
+}

### Milestone 6: Frontend - Orchestrator Integration

**Files**:
- `src/lib/dayRangeOrchestrator.js`

**Flags**:
- `conformance`: Follow existing renderer import and call pattern

**Requirements**:
- Import `renderPreviousDayOHLC` from priceMarkerRenderer
- Call function in `renderPriceElementsExceptCurrent()` after other price markers

**Acceptance Criteria**:
- renderPreviousDayOHLC imported at top of file
- Function called in renderPriceElementsExceptCurrent() with proper arguments
- prevDayOHLC passed from `d.prevDayOHLC`

**Tests**:
- **Test type**: E2E (existing visual validation tests verify markers appear)

**Code Intent**:

**Line 7**: Add `renderPreviousDayOHLC` to existing import statement from './priceMarkerRenderer.js'

**In `renderPriceElementsExceptCurrent()` function** (after line 93, where other markers are rendered):
- Add call: `renderPreviousDayOHLC(ctx, config, axisX, priceScale, d.prevDayOHLC, d)`

**Code Changes** (filled by Developer agent):

```diff
--- a/src/lib/dayRangeOrchestrator.js
+++ b/src/lib/dayRangeOrchestrator.js
@@ -4,7 +4,7 @@ import { renderAdrAxis, renderCenterLine, renderAdrBoundaryLines } from './dayRan
 import { validateMarketData, createDayRangeConfig, createPriceScale, renderBackground, createMappedData } from './dayRangeRenderingUtils.js';
 import { calculateAdaptiveScale, calculateDayRangePercentage } from './dayRangeCalculations.js';
-import { renderCurrentPrice, renderOpenPrice, renderHighLowMarkers } from './priceMarkerRenderer.js';
+import { renderCurrentPrice, renderOpenPrice, renderHighLowMarkers, renderPreviousDayOHLC } from './priceMarkerRenderer.js';
 import { renderPercentageMarkers } from './percentageMarkerRenderer.js';

 export function renderDayRange(ctx, d, s, getConfig, options = {}) {
@@ -89,6 +89,7 @@ function renderPriceElementsExceptCurrent(ctx, config, priceScale, d, s) {
   // Render all price markers EXCEPT current price
   renderOpenPrice(ctx, config, axisX, priceScale, d.open, d);
   renderHighLowMarkers(ctx, config, axisX, priceScale, mappedData, d);
+  renderPreviousDayOHLC(ctx, config, axisX, priceScale, d.prevDayOHLC, d);
 }

### Milestone 7: Documentation

**Delegated to**: @agent-technical-writer (mode: post-implementation)

**Source**: `## Invisible Knowledge` section of this plan

**Files**:
- `src/lib/CLAUDE.md` (index updates - in same directory as affected code)
- `src/lib/README.md` (if Invisible Knowledge section has content)

**Requirements**:

Delegate to Technical Writer. For documentation format specification:

<file working-dir=".claude" uri="conventions/documentation.md" />

Key deliverables:
- CLAUDE.md: Pure navigation index (tabular format)
- README.md: Invisible knowledge (if IK section non-empty)

**Acceptance Criteria**:
- CLAUDE.md is tabular index only (no prose sections)
- README.md exists in each directory with invisible knowledge
- README.md is self-contained (no external references)
- Architecture diagrams in README.md match plan's Invisible Knowledge section

**Source Material**: `## Invisible Knowledge` section of this plan

## Milestone Dependencies

```
M1 (cTrader) ──────┐
                   │
M2 (TradingView) ──┼──> M3 (DataRouter) ──> M4 (displayDataProcessor) ──┐
                   │                                                  │
                   └──────────────────────────────────────────────────┴──> M6 (Orchestrator) ──> M7 (Docs)
                                                                      │
M5 (Config/Renderer) ──────────────────────────────────────────────────┘
```

**Parallelization Strategy**:
- M1, M2, M5 can execute in parallel (backend sources independent, frontend config independent)
- M3 depends on M1 and M2 (must route data from both sources)
- M4 depends on M3 (must receive routed data)
- M6 depends on M4, M5 (needs displayDataProcessor output and renderer)
- M7 depends on all code milestones (documentation written after implementation)
