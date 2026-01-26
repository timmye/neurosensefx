# src/lib

## Overview

Core library for NeuroSense FX frontend visualization and data processing. Contains Canvas 2D rendering, WebSocket data processing, price marker systems, Market Profile visualization, and Day Range calculations. All files follow Crystal Clarity principles: <120 lines per file, <15 lines per function, Framework-First (Canvas 2D, Svelte stores, no custom abstractions).

## Architecture

### Data Flow: Backend to Canvas

```
Backend WebSocket → displayDataProcessor → workspace store → Orchestrators → Renderers → Canvas 2D
```

**Key transformation layers:**

1. **displayDataProcessor.js**: Transforms raw WebSocket messages into reactive state objects. Extracts prevDayOHLC from prevDay* fields (missing from original design document but required for data to reach workspace store).

2. **Workspace store**: Svelte reactive store that triggers canvas re-renders on data updates. Atomic updates prevent race conditions during symbol changes.

3. **Orchestrators** (dayRangeOrchestrator.js): Coordinate render sequence. Call specialized renderers in specific order (background → ADR → current price → historical markers).

4. **Renderers** (priceMarkerRenderer.js, etc.): Draw to Canvas 2D context. Use DPR-aware rendering for crisp text at any zoom level.

### Previous Day OHLC Markers Architecture

```
Backend (dual source):
  CTraderSession (primary): dailyBars[-2] → delta calc → prevDayOHLC
  TradingViewSession (secondary): historicalCandles[-2] → prevDayOHLC
        ↓
DataRouter: Conditional spread pattern (prevDayOpen !== undefined && { prevDayOpen })
        ↓
displayDataProcessor: prevDay* fields → prevDayOHLC object
        ↓
dayRangeOrchestrator: renderPriceElementsExceptCurrent() calls renderPreviousDayOHLC()
        ↓
priceMarkerRenderer: 4 dashed gray lines at 15% from left (PD O, PD H, PD L, PD C)
        ↓
Canvas 2D: Visual markers
```

**Why this structure:**

- **Dual extraction**: CTrader uses delta-encoded trendbars requiring `calculatePrice(low + delta*)`; TradingView provides direct OHLC values. A shared helper would need to handle both formats, adding ~30 lines of boilerplate. The 4-line extraction pattern is simple enough that duplication (8 lines total) is acceptable per Crystal Clarity principles.

- **Axis position at 15% from left**: Current day markers render at 75% from right (≈25% from left). Placing previous day markers at 15% creates clear visual separation on the opposite side, preventing label overlap.

- **Dashed lines with gray color**: Current day uses solid colored lines. Dashed lines provide texture cue (accessible to colorblind users) and follow industry convention for historical/reference data. Gray (#D1D5DB) indicates "less prominent" than current levels.

- **Null safety at every layer**: Backend returns `null` if `dailyBars.length < 2`; DataRouter omits undefined fields via conditional spread; Renderer returns early if `!prevOHLC`. Markers simply don't appear if insufficient data, no errors thrown.

### Day Range Visualization

**ADR Calculation Pattern:**

```
dailyBars.slice(-lookback-1, -1)  // Exclude current session (index -1)
  → Calculate daily ranges (deltaHigh - deltaLow)
  → Average of last N days
  → renderAdrAxis() draws ADR level at ±50% from midline
```

**Index -2 for previous day:**

- D1 array's last element (index -1) contains current session data
- Index -2 contains previous completed day
- Same pattern used in ADR calculation (CTraderSession line 270)
- Works for both cTrader (dailyBars) and TradingView (historicalCandles)

**Weekend/holiday handling:** "Previous day" is last completed daily bar regardless of calendar days. If Friday was last trading day, Friday's OHLC shows on Monday. Matches trader expectation of "previous session" not "previous calendar day."

### Market Profile

**Data flow:**

```
Backend: M1 bars → initialMarketProfile array
  ↓
marketProfileProcessor: Bucket aggregation (bucketSize from backend)
  ↓
marketProfileRenderer: TPO letters, POC, value area
  ↓
Canvas 2D: Horizontal histogram
```

**Bucket alignment:** Uses `pipPosition` from symbol data to ensure price levels align with instrument's pip structure (critical for FX pairs where pips != price points).

## Design Decisions

| Decision | Rationale |
| --- | --- |
| **Direct implementation (no shared helpers)** | Extraction is 4 lines of simple array access. Creating shared helper would add ~30 lines of boilerplate (file, exports, imports). Code duplication (8 lines total) is less complexity than abstraction overhead. Can refactor to shared helper if/when third data source added. |
| **Include displayDataProcessor.js in plan** | Design document omitted this file. Frontend data flow inspection shows DataRouter emits prevDay* fields. Without displayDataProcessor extraction, prevDay data never reaches workspace store. Markers would not render. |
| **Dashed lines vs. solid with different color** | Dashed lines provide texture cue (accessible to colorblind users). Industry-standard convention for historical data. More robust than color-only distinction. |
| **Four separate markers vs. single combined** | Four separate renderMarkerLine() calls (PD O, PD H, PD L, PD C). Each line can have independent label. Handles cases where some prices are missing. Simpler than combined marker; more flexible for edge cases. |
| **Canvas 2D over WebGL/three.js** | Canvas 2D is built-in, no new libraries. DPR-aware rendering produces crisp text. Sufficient for 2D price markers. Aligns with Framework-First principle. |
| **Svelte stores over Redux/Zustand** | Built-in reactive state. No additional dependencies. Simple JSON serialization for localStorage persistence. <100 lines for entire store (workspace.js). |

## Invariants

- **Previous day is index -2**: Last element of D1 array contains current session data. Previous completed day is always at index -2.
- **Null safety at every layer**: Backend returns null if insufficient data; Router omits undefined fields; Renderer returns early if no prevOHLC.
- **Delta encoding only for cTrader**: TradingView provides direct OHLC values. Only cTrader requires `calculatePrice()` transformation.
- **Symbol data package is one-time**: prevDayOHLC only sent in initial `symbolDataPackage`, not in subsequent tick updates.
- **DPR awareness**: All Canvas rendering must use `window.devicePixelRatio` for crisp text at any zoom level (displayCanvasRenderer.js).
- **Price markers render before current price**: Orchestrator calls `renderPriceElementsExceptCurrent()` before `renderCurrentPrice()` to ensure z-order (historical behind current).
- **Market Profile bucket size from backend**: Backend calculates bucket size based on symbol's pip structure. Frontend uses this value directly without recalculation.

## Tradeoffs

**Code duplication vs. Abstraction:**

- *Chose*: 8 lines duplicated (4 in CTraderSession, 4 in TradingViewSession)
- *Cost*: If third data source added, must copy extraction pattern again
- *Benefit*: No 30-line abstraction layer for 4-line operation
- *Rationale*: Crystal Clarity prioritizes simplicity; refactor later if needed

**Dashed lines vs. Solid lines with different color:**

- *Chose*: Dashed lines with gray color (#D1D5DB)
- *Cost*: Requires canvas `setLineDash()` call
- *Benefit*: Industry-standard convention for historical data; accessible to colorblind users
- *Rationale*: Color alone insufficient for accessibility; dashed lines provide texture cue

**Four separate markers vs. Single combined marker:**

- *Chose*: Four separate renderMarkerLine() calls
- *Cost*: 4x function calls
- *Benefit*: Each line independent; handles missing prices; simpler implementation
- *Rationale*: Flexibility for edge cases outweighs minimal performance cost

## File Organization

**By functionality:**

- `dayRange*.js`: Day Range visualization system
- `marketProfile*.js`: Market Profile calculation and rendering
- `priceMarker*.js`: Price marker state, rendering, interaction
- `display*.js`: WebSocket data processing and Canvas rendering
- `canvas*.js`: Canvas 2D utilities and status display
- `colors.js`, `keyboardHandler.js`: Shared utilities

**No subdirectories:** All files in `src/lib/` for fast imports and simple navigation. Crystal Clarity: flat structure preferred over deep nesting.

## Performance Characteristics

- **Canvas rendering**: 60 FPS target via `requestAnimationFrame`. Only re-render on workspace store changes (reactive).
- **Market Profile**: O(n) bucket aggregation where n = number of M1 bars. Capped at last trading session (not all historical data).
- **Price markers**: O(m) where m = number of user markers. Typically <10 markers.
- **displayDataProcessor**: O(1) field extraction. No iteration or transformation.
- **Day Range calculations**: O(k) where k = ADR lookback days (default 14). Negligible overhead.

## Dependencies

**None beyond framework primitives:**

- Canvas 2D API (built-in)
- Svelte stores (built-in)
- interact.js (drag/drop/resize) - loaded via CDN, no npm wrapper
- WebSocket API (built-in)

**No lodash, no d3, no chart libraries.** All rendering is custom Canvas 2D code for maximum control and minimal bundle size.
