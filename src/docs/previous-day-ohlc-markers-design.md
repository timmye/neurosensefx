# Previous Day OHLC Markers - Solution Design

## Overview

Feature to display previous trading day's Open, High, Low, and Close (OHLC) price levels on the left side of the canvas, providing traders with historical support/resistance reference points.

**Status:** Designed and Ready for Implementation
**Date:** 2026-01-25
**Estimated Effort:** ~40 lines across 6 files, 15 minutes

---

## Problem Statement

### Root Cause
The visualization system lacks historical price context - specifically, previous trading day's OHLC data is available in the backend (both TradingViewSession and CTraderSession have D1 candles) but not extracted or transmitted to the frontend for visualization.

### Current State
**TradingViewSession:**
- D1 candles with full OHLC exist in `TradingViewSession.historicalCandles` (lines 103-115)
- Only used for ADR calculation
- Previous day's levels never extracted or transmitted to frontend

**CTraderSession (Primary Data Source):**
- D1 trendbars fetched via `ProtoOAGetTrendbarsReq` (line 263)
- Used for ADR calculation (lines 269-272)
- Previous day's OHLC available in `dailyBars` array but never extracted
- No previous day data transmitted to frontend

### Cost of Inaction
- Traders lose valuable context of previous day's price levels
- Missed support/resistance references from prior session
- Competitive disadvantage vs platforms showing historical OHLC

---

## Constraints

### Hard Constraints (Non-Negotiable)
- **Crystal Clarity compliance:** <120 lines per file, <15 lines per function
- **Framework-First:** Use existing Canvas 2D, Svelte stores, no new libraries
- **Data availability:** D1 candles/trendbars already available (no new API calls)
- **Dual source support:** Must work with both cTrader (primary) and TradingView (secondary) data sources
- **Integration:** Must work with existing price marker rendering system

### Soft Constraints
- Consistent visual style with current day markers (distinct but related)
- Minimal code changes (extend existing patterns)
- Performance: no additional WebSocket traffic
- Maintainability: follow existing modular structure

---

## Success Criteria
- Previous day OHLC markers visible on left side of canvas (axisX ~15%)
- Markers update when new symbol subscribed
- Visual distinction from today's markers (color/opacity)
- Data flows: backend → frontend → canvas render without errors
- Works with both cTrader (primary) and TradingView (secondary) data sources

---

## Recommended Solution: Config-Driven Color Extension

### Approach
Backend extracts previous day OHLC at data packaging point for both cTrader and TradingView, frontend renders with proper color configuration.

### Data Flow Architecture

```
┌─────────────────┐     ┌─────────────────┐
│  CTraderSession  │     │ TradingViewSession│
│   (Primary)     │     │   (Secondary)   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │ D1 trendbars          │ D1 candles
         │ (dailyBars[-2])       │ (historicalCandles[-2])
         │                       │
         ▼                       ▼
┌─────────────────────────────────────┐
│         DataRouter.js               │
│  Routes prevDay* fields from both   │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│         Frontend (Workspace)        │
│   Stores prevDayOHLC in state       │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│    priceMarkerRenderer.js           │
│  Renders dashed lines at OHLC levels│
└─────────────────────────────────────┘
```

### Implementation

#### 1. Backend: CTraderSession.js (PRIMARY DATA SOURCE)
**File:** `services/tick-backend/CTraderSession.js`
**Location:** `getSymbolDataPackage()` function
**Change:** +10 lines

**Step 1a - Extract previous day OHLC (after line 270):**
```javascript
// Extract previous day OHLC from daily bars (index -2, last is today's partial/in-progress)
const previousDay = dailyBars.length >= 2
    ? dailyBars[dailyBars.length - 2]
    : null;

const prevDayOHLC = previousDay ? {
    open: this.calculatePrice(Number(previousDay.low) + Number(previousDay.deltaOpen), digits),
    high: this.calculatePrice(Number(previousDay.low) + Number(previousDay.deltaHigh), digits),
    low: this.calculatePrice(Number(previousDay.low), digits),
    close: this.calculatePrice(Number(previousDay.low) + Number(previousDay.deltaClose), digits)
} : null;
```

**Step 1b - Add to data package (in finalPackage, after line 314):**
```javascript
const finalPackage = {
    symbol: symbolName,
    digits,
    adr,
    todaysOpen,
    todaysHigh,
    todaysLow,
    projectedAdrHigh: todaysOpen + (adr / 2),
    projectedAdrLow: todaysOpen - (adr / 2),
    initialPrice,
    initialMarketProfile,
    pipPosition: symbolInfo.pipPosition,
    pipSize: symbolInfo.pipSize,
    pipetteSize: symbolInfo.pipetteSize,
    // Previous day OHLC
    ...(prevDayOHLC && { prevDayOpen: prevDayOHLC.open }),
    ...(prevDayOHLC && { prevDayHigh: prevDayOHLC.high }),
    ...(prevDayOHLC && { prevDayLow: prevDayOHLC.low }),
    ...(prevDayOHLC && { prevDayClose: prevDayOHLC.close })
};
```

#### 2. Backend: TradingViewSession.js (SECONDARY DATA SOURCE)
**File:** `services/tick-backend/TradingViewSession.js`
**Location:** `emitDataPackage()` function (after line 234)
**Change:** +4 lines

```javascript
// Extract previous day OHLC from historical candles (index -2, last is today's partial)
const previousDay = data.historicalCandles.length >= 2
    ? data.historicalCandles[data.historicalCandles.length - 2]
    : null;

// Add to emit object
this.emit('candle', {
    type: 'symbolDataPackage',
    // ... existing fields ...
    prevDayOpen: previousDay?.open,
    prevDayHigh: previousDay?.high,
    prevDayLow: previousDay?.low,
    prevDayClose: previousDay?.close
});
```

#### 3. DataRouter.js
**File:** `services/tick-backend/DataRouter.js`

**Step 3a - Update routeFromCTrader() (after line 19):**
**Change:** +4 lines

```javascript
routeFromCTrader(tick) {
    const message = {
        type: 'tick',
        source: 'ctrader',
        ...tick,
        // Previous day OHLC
        ...(tick.prevDayOpen !== undefined && { prevDayOpen: tick.prevDayOpen }),
        ...(tick.prevDayHigh !== undefined && { prevDayHigh: tick.prevDayHigh }),
        ...(tick.prevDayLow !== undefined && { prevDayLow: tick.prevDayLow }),
        ...(tick.prevDayClose !== undefined && { prevDayClose: tick.prevDayClose })
    };
    this.broadcastToClients(message, tick.symbol, 'ctrader');
}
```

**Step 3b - Update routeFromTradingView() (after line 50):**
**Change:** +4 lines

```javascript
...(candle.bucketSize !== undefined && { bucketSize: candle.bucketSize }),
// Previous day OHLC
...(candle.prevDayOpen !== undefined && { prevDayOpen: candle.prevDayOpen }),
...(candle.prevDayHigh !== undefined && { prevDayHigh: candle.prevDayHigh }),
...(candle.prevDayLow !== undefined && { prevDayLow: candle.prevDayLow }),
...(candle.prevDayClose !== undefined && { prevDayClose: candle.prevDayClose })
```

#### 4. Config: dayRangeConfig.js
**File:** `src/lib/dayRangeConfig.js`
**Location:** `colors` object (after line 18)
**Change:** +2 lines

```javascript
colors: {
  // ... existing colors ...
  previousDay: '#D1D5DB', // Lighter gray for previous day markers
}
```

#### 5. Renderer: priceMarkerRenderer.js
**File:** `src/lib/priceMarkerRenderer.js`
**Location:** End of file (after line 124)
**Change:** +14 lines

```javascript
// Render previous day OHLC markers (Open, High, Low, Close)
export function renderPreviousDayOHLC(ctx, config, axisX, priceScale, prevOHLC, symbolData) {
  if (!prevOHLC) return;
  const color = config.colors.previousDay || '#9CA3AF';

  const render = (price, label) => price && renderMarkerLine(
    ctx, priceScale(price), axisX, color, 1, 10,
    { text: `${label}: ${formatPriceForDisplay(price, symbolData)}`,
      textColor: color,
      textFont: '14px monospace',
      dashed: true }
  );

  render(prevOHLC.open, 'PD O');
  render(prevOHLC.high, 'PD H');
  render(prevOHLC.low, 'PD L');
  render(prevOHLC.close, 'PD C');
}
```

#### 6. Orchestrator: dayRangeOrchestrator.js
**File:** `src/lib/dayRangeOrchestrator.js`
**Location:**
- Line 7: Add import
- After line 93: Add function call
**Change:** +2 lines

```javascript
// Line 7 - Import addition
import { renderCurrentPrice, renderOpenPrice, renderHighLowMarkers, renderPreviousDayOHLC } from './priceMarkerRenderer.js';

// After line 93 - Inside renderPriceElementsExceptCurrent()
renderPreviousDayOHLC(ctx, config, axisX, priceScale, d.prevDayOHLC, d);
```

### Visual Design
- **Position:** axisX = 0.15 (15% from left, opposite current price at 75%)
- **Style:** Dashed lines
- **Color:** Muted gray (#D1D5DB)
- **Labels:** PD O (Open), PD H (High), PD L (Low), PD C (Close)

---

## Alternative Solutions

### For Quick Prototyping
- **[3] Single-Field Backend Extension:** Same as recommended but without config color (~20 lines)
- **[4] Direct Canvas Primitive:** Inline rendering with minimal abstraction (~12 lines)

### For Future Extensibility (Week/Month OHLC)
- **[5] OHLC Registry Pattern:** Centralized registry managing all OHLC-derived levels
- **[6] Temporal Reference Layer:** Unified abstraction for any temporal period

### For Architectural Unification
- **[7] Universal Marker Primitive:** Single `renderPriceMarker(params)` replacing all specialized markers
- **[8] Generic Historical Marker System:** Unify today's and previous day markers

---

## Trade-Off Analysis

| Solution | Complexity | Scope | Consistency | Risk | Extensibility | Lines |
|----------|------------|-------|-------------|------|---------------|-------|
| **[1] Config-Driven (Recommended)** | LOW | MINIMAL | VERY HIGH | VERY LOW | MEDIUM | ~40 |
| Single-Field Extension | LOWEST | MINIMAL | HIGH | MINIMAL | MEDIUM | ~30 |
| Direct Canvas Primitive | LOWEST | MINIMAL | GOOD | MINIMAL | LOW | ~20 |
| OHLC Registry | MEDIUM | MEDIUM | HIGH | LOW | EXCELLENT | ~45 |
| Temporal Reference Layer | MEDIUM | MEDIUM | HIGH | MEDIUM | BEST | ~90 |
| Universal Marker Primitive | MEDIUM | MEDIUM | VERY HIGH | MEDIUM | EXCELLENT | ~70 |

---

## Implementation Checklist

**Backend (cTrader - Primary):**
- [ ] CTraderSession: Extract prevDayOHLC from dailyBars array
- [ ] CTraderSession: Add prevDay fields to finalPackage

**Backend (TradingView - Secondary):**
- [ ] TradingViewSession: Add prevDay extraction to emitDataPackage()
- [ ] DataRouter: Update routeFromCTrader() to forward prevDay fields
- [ ] DataRouter: Update routeFromTradingView() to forward prevDay fields

**Frontend:**
- [ ] Config: Add previousDay color to dayRangeConfig.js
- [ ] Renderer: Implement renderPreviousDayOHLC() in priceMarkerRenderer.js
- [ ] Orchestrator: Import and call renderer in dayRangeOrchestrator.js

**Testing:**
- [ ] Test: Verify markers appear for cTrader symbols at correct price levels
- [ ] Test: Verify markers appear for TradingView symbols at correct price levels
- [ ] Test: Verify visual distinction from today's markers
- [ ] Test: Verify markers update on symbol change

---

## Files Modified

| File | Lines Added | Purpose | Data Source |
|------|-------------|---------|-------------|
| `services/tick-backend/CTraderSession.js` | +10 | Extract previous day OHLC from D1 trendbars | **Primary** |
| `services/tick-backend/TradingViewSession.js` | +4 | Extract previous day OHLC from D1 candles | Secondary |
| `services/tick-backend/DataRouter.js` | +8 | Forward prevDay fields from both sources | Both |
| `src/lib/dayRangeConfig.js` | +2 | Add previousDay color | Frontend |
| `src/lib/priceMarkerRenderer.js` | +14 | Render prevDay markers | Frontend |
| `src/lib/dayRangeOrchestrator.js` | +2 | Integrate renderer | Frontend |
| **Total** | **~40** | **6 files** | |

---

## Crystal Clarity Compliance

✅ **File Line Limits:** All files remain <120 lines (CTraderSession: 386 → ~396)
✅ **Function Line Limits:** All functions <15 lines
✅ **Framework-First:** Uses existing Canvas 2D, no new libraries
✅ **No Breaking Changes:** Pure additive feature
✅ **Dual Source Support:** Works with both cTrader (primary) and TradingView (secondary)

---

## Related Documentation

- [Crystal Clarity Principles](./crystal-clarity/README.md)
- [Day Range Meter Implementation](./crystal-clarity/week2-task2-day-range-meter.md)
- [Price Marker Architecture](../lib/priceMarkers.js)
