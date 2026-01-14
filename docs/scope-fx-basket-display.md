# FX Basket Display - Scope & Crystal Clarity Approach

**Status:** Phases 1-2 Complete ✅ | Phase 3 BLOCKED ⏸️ (cTrader API Rate Limiting)
**Blocker Details:** See [ctrader-api-rate-limits.md](./ctrader-api-rate-limits.md)

## 1. Requirement Summary

Traders want a simple **FX Basket Display** akin to the existing Day Range Meter, showing relative performance of currency baskets on a vertical axis for the trading day.

### Reference: TradingView Currency Basket Indicator
The `docs/currency_basket_indicator.txt` provides a comprehensive Pine Script reference implementing:
- **8 Currency Baskets**: USD, EUR, JPY, GBP, AUD, CAD, CHF, NZD (CNY optional)
- **Trade-weighted calculations** using 7 major FX pairs per currency
- **Logarithmic scaling** for accurate percentage-based performance
- **Baseline normalization** to 100wt at anchor point
- **Real-time updates** via WebSocket tick data

### MVP Scope: "Simple Version"
> "Start with a simple version akin to the day range meter"

**Visual Metaphor:**
```
┌─────────────────────────┐
│     FX BASKET           │  ← Header (can reuse existing DisplayHeader)
├─────────────────────────┤
│                         │
│   ▲ USD (+0.45%)        │  ← Strongest basket (top)
│   │                     │
│   │ EUR (+0.12%)        │
│   │                     │
│   ─────────────────     │  ← Baseline (100wt / day open)
│   │                     │
│   │ JPY (-0.08%)        │
│   │                     │
│   ▼ GBP (-0.23%)        │  ← Weakest basket (bottom)
│                         │
└─────────────────────────┘
```

## 2. Core Functionality

### 2.1 Data Model
```javascript
// Per-currency basket state
interface CurrencyBasket {
  currency: string;        // 'USD', 'EUR', etc.
  pairs: string[];        // ['EURUSD', 'USDJPY', ...]
  weights: number[];      // Trade-weighted coefficients
  baseline: number;       // ln-weighted sum at day open
  currentValue: number;   // Current ln-weighted sum
  normalized: number;     // (exp(current) / exp(baseline)) * 100
  changePercent: number;  // % change from baseline
}

// FX Basket display state
interface FxBasketState {
  baskets: Map<string, CurrencyBasket>;
  anchorTime: Date;       // Trading day start
  lastUpdate: Date;
}
```

### 2.2 Calculation Logic (Per Basket)
```javascript
// For each currency basket:
function calculateBasketValue(pairs, weights, prices) {
  let logSum = 0;
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    const price = prices.get(pair);
    const weight = weights[i];
    const invert = !pair.startsWith(currency);
    const adjustedPrice = invert ? (1 / price) : price;
    logSum += weight * Math.log(adjustedPrice);
  }
  return logSum;  // ln-weighted basket value
}

// Normalize to 100wt baseline
function normalizeToBaseline(currentLog, baselineLog) {
  return (Math.exp(currentLog) / Math.exp(baselineLog)) * 100;
}
```

### 2.3 Display Logic (Vertical Axis)
```javascript
// Map basket values to vertical positions
function mapBasketToY(normalizedValue, height, minVal, maxVal) {
  const range = maxVal - minVal;
  const position = (normalizedValue - minVal) / range;
  return height - (position * height);  // Invert Y for canvas
}
```

## 3. Crystal Clarity Implementation Strategy

### 3.1 File Structure (Following Day Range Pattern)

```
src/lib/
├── fxBasket/
│   ├── fxBasketCore.js          (<100 lines) - Canvas setup, DPR rendering
│   ├── fxBasketCalculations.js  (<100 lines) - Basket value calculations
│   ├── fxBasketConfig.js        (<60 lines) - Configuration constants
│   ├── fxBasketOrchestrator.js  (<80 lines) - Main render coordination
│   └── fxBasketData.js          (<80 lines) - Data aggregation from pairs
```

**Total: ~420 lines** across 5 focused files (well under complexity limits)

### 3.2 Framework-First Compliance

| Concern | Framework Solution |
|---------|-------------------|
| **UI Component** | Extend existing `FloatingDisplay.svelte` |
| **Canvas Rendering** | Reuse `dayRangeCore.js` DPR utilities |
| **WebSocket Data** | Existing `ConnectionManager` multi-subscribe |
| **State Management** | Existing `workspaceStore` for displays |
| **Drag/Resize** | Existing `interact.js` integration |

### 3.3 Component Architecture

```javascript
// NEW: src/lib/fxBasket/fxBasketOrchestrator.js
export function renderFxBasket(ctx, data, config, dimensions) {
  // 1. Calculate basket values
  const baskets = calculateAllBaskets(data, config);

  // 2. Find min/max for vertical scaling
  const { minVal, maxVal } = findBasketRange(baskets);

  // 3. Render baseline (100wt reference)
  renderBaseline(ctx, dimensions, minVal, maxVal);

  // 4. Render each basket as horizontal bar/marker
  baskets.forEach(basket => {
    const y = mapBasketToY(basket.normalized, dimensions.height, minVal, maxVal);
    renderBasketMarker(ctx, basket, y, dimensions.width);
  });
}
```

### 3.4 WebSocket Data Flow

**Challenge:** Need to subscribe to 8 × 7 = 56 currency pairs simultaneously.

**Solution:** Leverage existing `ConnectionManager.subscribeAndRequest()` pattern:
```javascript
// In FloatingDisplay.svelte (or new FxBasketDisplay.svelte)
onMount(() => {
  const pairs = getAllPairsForBaskets();  // 56 pairs
  const unsubscribes = pairs.map(pair =>
    connectionManager.subscribeAndRequest(pair, dataCallback, 14, 'ctrader')
  );

  return () => unsubscribes.forEach(unsub => unsub());
});
```

**Optimization:** Consider backend aggregation for production (single "FX_BASKET" symbol).

## 4. Configuration

### 4.1 Default Basket Weights (from TradingView reference)

```javascript
// src/lib/fxBasket/fxBasketConfig.js
export const BASKET_DEFINITIONS = {
  USD: {
    pairs: ['EURUSD', 'USDJPY', 'GBPUSD', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD'],
    weights: [20, 15, 13, 10, 30, 7, 5],
    color: '#4a9eff'  // Blue
  },
  EUR: {
    pairs: ['EURUSD', 'EURJPY', 'EURGBP', 'EURAUD', 'EURCHF', 'EURCAD', 'EURNZD'],
    weights: [25, 15, 20, 10, 15, 10, 5],
    color: '#ef4444'  // Red
  },
  // ... JPY, GBP, AUD, CAD, CHF, NZD
};
```

### 4.2 Visual Configuration

```javascript
export const fxBasketConfig = {
  colors: {
    baseline: '#6B7280',
    positive: '#10b981',  // Green for strengthening
    negative: '#ef4444',  // Red for weakening
    background: 'transparent'
  },
  fonts: {
    basketLabel: 'bold 14px monospace',
    basketValue: '12px monospace'
  },
  positioning: {
    padding: 16,
    markerWidth: 4,
    labelOffset: 8
  }
};
```

## 5. Implementation Phases

### ✅ Phase 1: Core Calculation (COMPLETE)
- [x] `fxBasketData.js` (82 lines) - Aggregate prices for 8 baskets
- [x] `fxBasketCalculations.js` (70 lines) - Ln-weighted sum + normalization + inverse pairs
- [x] Test: 15/15 tests passed, verified against TradingView reference

### ✅ Phase 2: Basic Rendering (COMPLETE)
- [x] `fxBasketConfig.js` (44 lines) - Configuration constants
- [x] `fxBasketOrchestrator.js` (81 lines) - Main render loop + rendering functions
- [x] Render: Baseline line + basket markers on vertical axis with color coding

### ✅ Phase 3: Integration (PARTIAL)
- [x] Register 'fxBasket' in `visualizationRegistry.js`
- [ ] Extend `FloatingDisplay.svelte` to handle basket data (PENDING)
- [ ] WebSocket multi-subscribe for 30 pairs (PENDING)

### ⏳ Phase 4: Polish (MOSTLY COMPLETE)
- [x] Color coding (green for strengthening, red for weakening)
- [x] Percentage labels (+0.45%, -0.23%)
- [x] Currency labels (USD, EUR, etc.)
- [ ] Hover tooltips (OPTIONAL - deferred)
- [ ] Anchor time display (PENDING)

## 6. Open Questions

1. **✅ RESOLVED: Backend Optimization**
   - **Resolution:** 30 unique pairs (not 56) using cTrader GBP-as-base format
   - **Current:** 30 subscriptions per basket display via ConnectionManager
   - **Status:** All pairs verified available on cTrader

2. **Anchor Time:** How to determine "trading day start"?
   - **Option A:** Fixed 5pm EST (forex market open) ✅ RECOMMENDED
   - **Option B:** User-configurable (like TradingView) - DEFER
   - **Option C:** First tick of session - DEFER

3. **Basket Selection:** Allow user to show/hide specific currencies?
   - TradingView reference has checkboxes for each basket
   - **Recommendation:** DEFER - MVP shows all 8 currencies

4. **Display Mode:** ✅ RESOLVED
   - **Chosen:** Hybrid - vertical meter with horizontal bars (implemented)

## 7. Complexity Compliance

| File | Max Lines | Actual Lines | Status |
|------|-----------|-------------|--------|
| fxBasketCalculations.js | 100 | 70 | ✅ Complete |
| fxBasketConfig.js | 100 | 44 | ✅ Complete |
| fxBasketOrchestrator.js | 100 | 81 | ✅ Complete (consolidated core/renderer) |
| fxBasketData.js | 100 | 82 | ✅ Complete |
| test-fxBasket.js | 100 | 68 | ✅ Complete (15/15 tests) |

**Total:** 5 files, 345 lines (well within Crystal Clarity limits)

**Note:** `fxBasketCore.js` was consolidated into `fxBasketOrchestrator.js` to reuse existing `dayRangeCore.js` utilities.

## 8. BLOCKER: cTrader API Rate Limiting

### Current Issue
Phase 3 WebSocket integration is **BLOCKED** due to cTrader API rate limiting:

| Metric | Value |
|--------|-------|
| **API Limit** | 5 requests/second for historical data |
| **Our Request** | 28 simultaneous `get_symbol_data_package` |
| **Result** | Only 2/28 pairs succeed (EURUSD, USDJPY) |
| **Error** | `REQUEST_FREQUENCY_EXCEEDED` (ErrorCode 108) |

### Root Cause
```javascript
// FxBasketDisplay.svelte:86-88 - Sends all requests simultaneously
const unsubscribes = fxPairs.map(pair =>
  connectionManager.subscribeAndRequest(pair, dataCallback, 14, 'ctrader')
);
```

### Resolution Options

| Option | Approach | Time | Effort |
|--------|----------|------|--------|
| **A** ⭐ | Frontend batching (5 req × 1.1s delays) | ~7s | Low (~1h) |
| B | Backend retry with exponential backoff | Variable | Medium (~2h) |
| C | Switch to TradingView API fallback | Immediate | Medium (~2h) |

**See:** [ctrader-api-rate-limits.md](./ctrader-api-rate-limits.md) for full technical analysis.

---

## 9. Success Criteria

1. **Functional:**
   - [x] Accurately calculates ln-weighted basket values
   - [x] Normalizes to 100wt baseline at day open
   - [ ] Updates in real-time via WebSocket ticks (⏸️ BLOCKED - rate limit)
   - [ ] Displays 8 currencies on vertical axis (rendering complete, needs integration)

2. **Visual:**
   - [x] Crisp DPR-aware rendering (uses dayRangeCore)
   - [x] Clear baseline reference (100wt)
   - [x] Color-coded strengthening/weakening
   - [x] Percentage change labels

3. **Architectural:**
   - [x] Framework-first (no custom abstractions)
   - [x] Single responsibility per file
   - [x] <100 lines per file
   - [x] Reuses existing dayRange patterns

### Progress Summary
- ✅ **60% Complete:** Phases 1-2 (calculations, rendering)
- ⏸️ **BLOCKED:** Phase 3 (WebSocket integration - rate limit)
- ⏳ **Pending:** Phase 4 (Polish & UX)
