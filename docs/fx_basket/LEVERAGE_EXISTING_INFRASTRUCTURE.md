# FX Basket: Leverage Existing Infrastructure

**Date**: 2026-01-15
**Purpose**: Fix FX Basket consistency by leveraging Day Range Meter's proven data fetching infrastructure
**Status**: Design Proposal

---

## Executive Summary

**Discovery**: The Day Range Meter already has a working, reliable data fetching infrastructure that solves FX Basket's root cause. Instead of building new APIs, we can leverage the existing `getSymbolDataPackage()` flow that:

1. ✅ Fetches COMPLETE data from cTrader API (daily open + ADR)
2. ✅ Returns CONSISTENT results (same input = same output)
3. ✅ Is already integrated and working
4. ✅ Follows Crystal Clarity principles

**The Fix**: Modify FX Basket to wait for ALL `symbolDataPackage` messages before initializing baselines. No new server infrastructure needed.

---

## Table of Contents

1. [Existing Infrastructure Analysis](#existing-infrastructure-analysis)
2. [Current FX Basket Flow vs. Day Range Flow](#current-fx-basket-flow-vs-day-range-flow)
3. [The Fix: Complete-Set Initialization](#the-fix-complete-set-initialization)
4. [Implementation](#implementation)
5. [Why This Works](#why-this-works)

---

## Existing Infrastructure Analysis

### Data Fetching Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EXISTING DATA FETCHING INFRASTRUCTURE                     │
│                    (Already Working for Day Range Meter)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CLIENT                                                                     │
│  ──────                                                                    │
│                                                                             │
│   subscribe(symbol)  ─────────────────────────────────┐                    │
│         │                                              │                    │
│         ▼                                              │                    │
│   WebSocket.send({                                     │                    │
│     type: 'subscribe',                                 │                    │
│     symbol: 'EURUSD'                                   │                    │
│   })                                                   │                    │
│         │                                              │                    │
│         └──────────────────────────────────────────────┘                    │
│                                                             │               │
│                                                             ▼               │
│  SERVER (WebSocketServer.js + CTraderSession.js)             │               │
│  ───────────────────────────────────────────────────────    │               │
│                                                             │               │
│   handleSubscribe(symbol, 14)  ◄─── adrLookbackDays=14      │               │
│         │                                                    │               │
│         ▼                                                    │               │
│   cTraderSession.getSymbolDataPackage(symbolName, 14)        │               │
│         │                                                    │               │
│         ▼                                                    │               │
│   ┌─────────────────────────────────────────────────────┐   │               │
│   │  PARALLEL FETCH FROM cTrader API                    │   │               │
│   │                                                     │   │               │
│   │  1. Daily Bars (D1):     Last 14-19 days            │   │               │
│   │     ├─> Calculate ADR (Average Daily Range)        │   │               │
│   │     └─> Get yesterday's close                      │   │               │
│   │                                                     │   │               │
│   │  2. Intraday Bars (M1):  Today's M1 candles         │   │               │
│   │     ├─> Extract: todaysOpen (first M1 open)        │   │               │
│   │     ├─> Extract: todaysHigh (max of all M1)        │   │               │
│   │     ├─> Extract: todaysLow  (min of all M1)        │   │               │
│   │     └─> Extract: initialMarketProfile (all M1)     │   │               │
│   │                                                     │   │               │
│   │  Promise.all([dailyBars, intradayBars])  ◄─── ATOMIC│   │               │
│   └─────────────────────────────────────────────────────┘   │               │
│         │                                                    │               │
│         ▼                                                    │               │
│   Return COMPLETE package:                                  │               │
│   {                                                         │               │
│     symbol: 'EURUSD',                                       │               │
│     todaysOpen: 1.0850,      ◄─── FROM M1 data             │               │
│     todaysHigh: 1.0875,      ◄─── FROM M1 data             │               │
│     todaysLow: 1.0832,       ◄─── FROM M1 data             │               │
│     projectedAdrHigh: 1.0950, ◄─── CALCULATED              │               │
│     projectedAdrLow: 1.0750,  ◄─── CALCULATED              │               │
│     adr: 0.0100,             ◄─── FROM D1 data             │               │
│     pipPosition: 4,                                       │               │
│     pipSize: 0.0001                                       │               │
│   }                                                         │               │
│         │                                                    │               │
│         ▼                                                    │               │
│   WebSocket.send({ type: 'symbolDataPackage', ... })  ◄───│─────┐           │
│                                                             │     │           │
│                                                             │     │           │
└─────────────────────────────────────────────────────────────┘     │           │
                                                                │           │
                                                                │           │
┌───────────────────────────────────────────────────────────────┘           │
        │                                                                   │
        │ symbolDataPackage arrives                                         │
        ▼                                                                   │
┌─────────────────────────────────────────────────────────────────────────────┐
│  CLIENT: Data Processing                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   WebSocket.onmessage({ type: 'symbolDataPackage', ... })                  │
│         │                                                                   │
│         ▼                                                                   │
│   processSymbolData(data)                                                  │
│         │                                                                   │
│         ▼                                                                   │
│   {                                                                         │
│     high: data.todaysHigh,                                                 │
│     low: data.todaysLow,                                                   │
│     open: data.todaysOpen,      ◄─── MAPPED FROM todaysOpen                │
│     current: data.initialPrice,                                            │
│     adrHigh: data.projectedAdrHigh,                                        │
│     adrLow: data.projectedAdrLow                                           │
│   }                                                                         │
│         │                                                                   │
│         ▼                                                                   │
│   Day Range Meter displays with CONSISTENT data                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Characteristics

| Characteristic | Day Range Meter | FX Basket (Current) |
|----------------|-----------------|---------------------|
| **Data Source** | cTrader API (complete) | cTrader API (complete) |
| **Daily Open** | ✅ From M1 data | ✅ From M1 data |
| **Consistency** | ✅ Deterministic | ❌ Race condition |
| **Why Different** | Uses complete package | Initializes on partial data |

---

## Current FX Basket Flow vs. Day Range Flow

### Day Range Meter Flow (WORKS - Single Symbol)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  DAY RANGE METER: Single Symbol Flow                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. User opens display for EURUSD                                           │
│                                                                             │
│  2. Client sends: { type: 'subscribe', symbol: 'EURUSD' }                   │
│                                                                             │
│  3. Server calls: getSymbolDataPackage('EURUSD', 14)                        │
│     ├─> Fetch D1 bars (14 days)                                            │
│     ├─> Fetch M1 bars (today)                                              │
│     └─> Return COMPLETE package                                            │
│                                                                             │
│  4. Client receives: symbolDataPackage {                                    │
│       todaysOpen: 1.0850,                                                   │
│       todaysHigh: 1.0875,                                                   │
│       todaysLow: 1.0832,                                                    │
│       projectedAdrHigh: 1.0950,                                             │
│       projectedAdrLow: 1.0750                                               │
│     }                                                                       │
│                                                                             │
│  5. Client displays day range meter with CONSISTENT data                   │
│     ├─> Open = 1.0850 (from package)                                       │
│     ├─> High = 1.0875 (from package)                                       │
│     ├─> Low = 1.0832 (from package)                                        │
│     └─> ADR boundaries calculated from package                             │
│                                                                             │
│  ✅ Result: Deterministic, consistent display                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### FX Basket Flow (BROKEN - Multiple Symbols)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FX BASKET: Multiple Symbol Flow (CURRENT - BROKEN)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. FX Basket display needs 30 pairs for 5 baskets                          │
│                                                                             │
│  2. Client sends: { type: 'subscribe', symbols: [all 30 pairs] }            │
│                                                                             │
│  3. Server calls getSymbolDataPackage() for EACH pair                       │
│     └─> Each returns COMPLETE package (same as day range)                   │
│                                                                             │
│  4. Client receives 30 symbolDataPackage messages (NON-DETERMINISTIC ORDER) │
│     Message 1: EURUSD { todaysOpen: 1.0850, ... }                           │
│     Message 2: USDJPY { todaysOpen: 149.25, ... }                           │
│     Message 3: GBPUSD { todaysOpen: 1.2734, ... }  ←─── ORDER VARIES!       │
│     ...                                                                     │
│     Message 30: NZDCHF { todaysOpen: 0.5876, ... }                          │
│                                                                             │
│  5. ❌ BROKEN PART: initializeBaselinesFromDailyOpens() called AFTER EACH   │
│                                                                             │
│     After Message 1:                                                        │
│     ├─> dailyOpenPrices = { EURUSD: 1.0850 }                               │
│     ├─> coverage = 3.3% (1/30 pairs)                                       │
│     └─> NOT ready for initialization                                       │
│                                                                             │
│     After Message 15 (50% coverage):                                        │
│     ├─> dailyOpenPrices = { 15 random pairs }  ◄─── WHICH 15?              │
│     ├─> coverage = 50%                                                     │
│     └─> ❌ LOCKS BASELINE HERE!                                            │
│                                                                             │
│     After Message 16-30:                                                    │
│     └─> baselineLog = LOCKED  ◄─── New data ignored!                       │
│                                                                             │
│  ❌ Result: Different refreshes → different subsets → 852% variance         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### The Core Issue

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  THE PROBLEM                                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Day Range Meter (1 symbol):                                               │
│    ✓ Wait for 1 symbolDataPackage → Display                                │
│    ✓ Complete data from API                                                │
│    ✓ No race condition                                                     │
│                                                                             │
│  FX Basket (30 symbols):                                                    │
│    ❌ Initialize after 50% of symbolDataPackages arrive                    │
│    ❌ Message order is non-deterministic                                    │
│    ❌ Different subsets → different baselines                              │
│                                                                             │
│  THE DATA IS THE SAME - THE INITIALIZATION LOGIC IS DIFFERENT               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## The Fix: Complete-Set Initialization

### Approach: Wait for All or Timeout

Instead of initializing at 50% coverage, wait for ALL symbolDataPackage messages before initializing baselines.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FX BASKET: Multiple Symbol Flow (FIXED)                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. FX Basket display needs 30 pairs for 5 baskets                          │
│                                                                             │
│  2. Client sends: { type: 'subscribe', symbols: [all 30 pairs] }            │
│                                                                             │
│  3. Server calls getSymbolDataPackage() for EACH pair                       │
│     └─> Each returns COMPLETE package                                      │
│                                                                             │
│  4. Client tracks which pairs have received symbolDataPackage               │
│                                                                             │
│     receivedPairs = new Set()  ◄─── Track arrivals                         │
│                                                                             │
│     Message 1: EURUSD arrives                                              │
│     ├─> updatePrice('EURUSD', dailyOpen, ..., true)                        │
│     ├─> receivedPairs.add('EURUSD')                                        │
│     ├─> coverage = 1/30 = 3.3%                                             │
│     └─> DO NOT initialize yet                                              │
│                                                                             │
│     Message 2: USDJPY arrives                                              │
│     ├─> updatePrice('USDJPY', dailyOpen, ..., true)                        │
│     ├─> receivedPairs.add('USDJPY')                                        │
│     ├─> coverage = 2/30 = 6.7%                                             │
│     └─> DO NOT initialize yet                                              │
│                                                                             │
│     ...                                                                     │
│                                                                             │
│     Message 15: (50% coverage)                                              │
│     ├─> coverage = 15/30 = 50%                                             │
│     └─> ❌ OLD: Would lock here | ✅ NEW: Keep waiting                     │
│                                                                             │
│     ...                                                                     │
│                                                                             │
│     Message 30: (100% coverage)                                            │
│     ├─> receivedPairs.size = 30                                            │
│     ├─> coverage = 30/30 = 100%                                            │
│     └─> ✅ INITIALIZE BASELINE NOW                                         │
│                                                                             │
│  5. OR: 15-second timeout triggers                                         │
│     ├─> If not all pairs arrived in 15s                                    │
│     ├─> Initialize with current coverage (e.g., 28/30 = 93%)               │
│     └─> Graceful degradation                                               │
│                                                                             │
│  ✅ Result: Same baseline for same data (deterministic)                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Changes

| Aspect | Current | Fixed |
|--------|---------|-------|
| **Threshold** | 50% (first moment) | 100% (all pairs) OR 15s timeout |
| **Lock** | Permanent at 50% | Permanent at 100% OR timeout |
| **Tracking** | None | Track received pairs in Set |
| **Determinism** | ❌ No (order-dependent) | ✅ Yes (complete set) |
| **Timeout** | ❌ None | ✅ 15 seconds to fallback |

---

## Implementation

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FX BASKET: COMPLETE-SET INITIALIZATION ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STATE TRACKING                                                             │
│  ───────────────                                                            │
│                                                                             │
│   basketState = {                                                           │
│     prices: Map(),              // Current prices                           │
│     dailyOpenPrices: Map(),     // Daily opens                             │
│     baskets: { CHF, EUR, GBP, JPY, USD },                                   │
│     expectedPairs: [all 30 pairs],  ◄─── NEW                               │
│     receivedPairs: Set(),         ◄─── NEW: Track arrivals                 │
│     initializationTimeout: 15000, ◄─── NEW: 15 seconds                     │
│     initializationStart: null,    ◄─── NEW: Track start time               │
│     timeoutId: null               ◄─── NEW: Timeout reference              │
│   }                                                                        │
│                                                                             │
│  FLOW: symbolDataPackage ARRIVAL                                            │
│  ─────────────────────────────────                                         │
│                                                                             │
│   Message: { type: 'symbolDataPackage', symbol: 'EURUSD', ... }            │
│         │                                                                   │
│         ▼                                                                   │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  UPDATE DAILY OPEN                                                   │  │
│   │                                                                     │  │
│   │  updatePrice('EURUSD', todaysOpen, state, true)                     │  │
│   │    └─> state.dailyOpenPrices.set('EURUSD', 1.0850)                 │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│         │                                                                   │
│         ▼                                                                   │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  TRACK RECEIVED PAIRS                                                │  │
│   │                                                                     │  │
│   │  state.receivedPairs.add('EURUSD')  ◄─── NEW                        │  │
│   │  coverage = state.receivedPairs.size / state.expectedPairs.length   │  │
│   │                                                                     │  │
│   │  Start timeout on first message:                                    │  │
│   │  if (!state.initializationStart) {                                  │  │
│   │    state.initializationStart = Date.now();                          │  │
│   │    state.timeoutId = setTimeout(                                    │  │
│   │      () => initializeBaselinesFromTimeout(state),                   │  │
│   │      state.initializationTimeout                                     │  │
│   │    );                                                               │  │
│   │  }                                                                  │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│         │                                                                   │
│         ▼                                                                   │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  CHECK IF READY TO INITIALIZE                                        │  │
│   │                                                                     │  │
│   │  if (state.receivedPairs.size === state.expectedPairs.length) {     │  │
│   │    // All pairs received - 100% coverage                            │  │
│   │    clearTimeout(state.timeoutId);                                   │  │
│   │    initializeBaselinesFromCompleteSet(state);  ◄─── NEW FUNCTION    │  │
│   │  }                                                                  │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│         │                                                                   │
│         ▼                                                                   │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  INITIALIZE BASELINES (ONCE)                                         │  │
│   │                                                                     │  │
│   │  initializeBaselinesFromCompleteSet(state)                          │  │
│   │    for (const currency of BASKET_CURRENCIES) {                      │  │
│   │      const basket = state.baskets[currency];                         │  │
│   │      const result = calculateBasketValue(                            │  │
│   │        currency,                                                     │  │
│   │        state.dailyOpenPrices  ◄─── COMPLETE SET (all 30 pairs)      │  │
│   │      );                                                              │
│   │      basket.baselineLog = result.value;                              │  │
│   │      basket.initialized = true;  ◄─── ONE-TIME LOCK                 │  │
│   │      basket.coverage = result.coverage;  ◄─── Always 1.0            │  │
│   │    }                                                                 │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  TIMEOUT FALLBACK (15 seconds)                                             │
│  ─────────────────────────────                                              │
│                                                                             │
│   initializeBaselinesFromTimeout(state)                                    │
│     if (state.baskets.CHF.initialized) return;  // Already done            │
│                                                                             │
│     const coverage = state.receivedPairs.size / state.expectedPairs.length │
│     console.warn(`[FX BASKET] Timeout at ${coverage*100}% coverage`);      │
│                                                                             │
│     // Initialize with available data (graceful degradation)               │
│     initializeBaselinesFromCompleteSet(state);                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Code Changes

#### File: `src/lib/fxBasket/fxBasketData.js`

```javascript
// NEW: Initialize state with tracking
export function initializeState(anchorTime, expectedPairs) {
  const prices = new Map();
  const dailyOpenPrices = new Map();
  const baskets = {};

  for (const currency of Object.keys(BASKET_DEFINITIONS)) {
    baskets[currency] = {
      currency,
      baselineLog: null,
      currentLog: null,
      normalized: 100,
      changePercent: 0,
      initialized: false,
      coverage: 0
    };
  }

  return {
    prices,
    dailyOpenPrices,
    baskets,
    anchorTime,
    lastUpdate: null,
    // NEW: Track initialization
    expectedPairs: expectedPairs || getAllPairs(),
    receivedPairs: new Set(),
    initializationTimeout: 15000,  // 15 seconds
    initializationStart: null,
    timeoutId: null
  };
}

// NEW: Initialize from complete set (called once)
export function initializeBaselinesFromCompleteSet(state) {
  if (state.timeoutId) {
    clearTimeout(state.timeoutId);
    state.timeoutId = null;
  }

  for (const currency of Object.keys(BASKET_DEFINITIONS)) {
    const basket = state.baskets[currency];
    if (basket.initialized) continue;

    const result = calculateBasketValue(currency, state.dailyOpenPrices);
    if (result && result.coverage > 0) {
      basket.baselineLog = result.value;
      basket.currentLog = result.value;
      basket.normalized = 100;
      basket.initialized = true;
      basket.coverage = result.coverage;
    }
  }

  state.lastUpdate = new Date();
}

// NEW: Timeout fallback handler
export function initializeBaselinesFromTimeout(state) {
  const coverage = state.receivedPairs.size / state.expectedPairs.length;
  console.warn(`[FX BASKET] Initialization timeout: ${(coverage * 100).toFixed(0)}% coverage`);

  initializeBaselinesFromCompleteSet(state);
}

// NEW: Track received pairs and trigger initialization
export function trackReceivedPair(pair, state) {
  state.receivedPairs.add(pair);

  // Start timeout on first pair
  if (!state.initializationStart) {
    state.initializationStart = Date.now();
    state.timeoutId = setTimeout(
      () => initializeBaselinesFromTimeout(state),
      state.initializationTimeout
    );
  }

  // Check if all pairs received
  if (state.receivedPairs.size === state.expectedPairs.length) {
    console.log(`[FX BASKET] All ${state.expectedPairs.length} pairs received`);
    initializeBaselinesFromCompleteSet(state);
  }

  return state.receivedPairs.size / state.expectedPairs.length;
}

// REMOVE: Old function (replaced by above)
// export function initializeBaselinesFromDailyOpens(state) { ... }
```

#### File: `src/lib/fxBasket/fxBasketDataProcessor.js`

```javascript
import {
  updatePrice,
  updateAllBaskets,
  trackReceivedPair  // NEW import
} from './fxBasketData.js';

export function createDataCallback(basketState, fxPairs, subscriptionsReady, canvasRef) {
  return (data) => {
    if (!subscriptionsReady() && data.type !== 'symbolDataPackage') return;

    try {
      if (data.type === 'tick' && fxPairs.includes(data.symbol)) {
        updatePrice(data.symbol, data.bid || data.price, basketState, false);
      } else if (data.type === 'symbolDataPackage') {
        const pair = data.symbol;
        const dailyOpen = data.todaysOpen || data.open || data.initialPrice;
        const currentPrice = data.current || data.bid || data.ask;

        if (pair && fxPairs.includes(pair)) {
          if (dailyOpen) {
            updatePrice(pair, dailyOpen, basketState, true);
            trackReceivedPair(pair, basketState);  // NEW: Track and check
          }
          if (currentPrice) {
            updatePrice(pair, currentPrice, basketState, false);
          }
          // REMOVE: initializeBaselinesFromDailyOpens(basketState);
        }
      }

      updateAllBaskets(basketState);
      if (canvasRef?.renderFxBasket) {
        canvasRef.renderFxBasket(basketState.baskets);
      }
    } catch (error) {
      console.error('[FX BASKET] Error in dataCallback:', error);
      canvasRef?.renderError(`FX_BASKET_ERROR: ${error.message}`);
    }
  };
}
```

---

## Why This Works

### Deterministic Baselines

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MATHEMATICAL PROOF                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Current (50% threshold):                                                  │
│    Refresh 1: baselineLog = f({EURUSD, USDJPY, GBPUSD, ... 12 more})       │
│    Refresh 2: baselineLog = f({GBPUSD, EURJPY, AUDUSD, ... 12 different})  │
│    Result: baselineLog_1 ≠ baselineLog_2  ◄─── NON-DETERMINISTIC           │
│                                                                             │
│  Fixed (100% threshold):                                                   │
│    Refresh 1: baselineLog = f({ALL 30 PAIRS})                              │
│    Refresh 2: baselineLog = f({ALL 30 PAIRS})                              │
│    Result: baselineLog_1 = baselineLog_2  ◄─── DETERMINISTIC               │
│                                                                             │
│  Proof: Since the function f() (calculateBasketValue) is deterministic      │
│  and the input set is identical (all 30 pairs), the output must be         │
│  identical.                                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Handles Edge Cases

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  EDGE CASE: Slow Pair (network delay)                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Scenario: 29 pairs arrive in 2 seconds, 1 pair takes 20 seconds            │
│                                                                             │
│  Without timeout:                                                          │
│    - Wait 20 seconds for last pair                                         │
│    - Poor user experience                                                  │
│                                                                             │
│  With 15s timeout:                                                        │
│    - 29 pairs arrive in 2 seconds                                          │
│    - Timeout fires at 15 seconds                                           │
│    - Initialize with 29/30 = 96.7% coverage                                │
│    - Console: "Timeout at 97% coverage"                                    │
│    - User sees basket in 15 seconds (acceptable)                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  EDGE CASE: Connection Drop                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Scenario: WebSocket disconnects during initialization                      │
│                                                                             │
│  Behavior:                                                                 │
│    - ConnectionManager detects disconnect                                  │
│    - On reconnect: create NEW basketState                                  │
│    - Fresh initialization cycle starts                                     │
│    - No stale data from partial initialization                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  EDGE CASE: Invalid Pair                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Scenario: cTrader returns error for NZDCHF                                │
│                                                                             │
│  Behavior:                                                                 │
│    - 29 pairs arrive successfully                                          │
│    - Timeout fires at 15 seconds                                           │
│    - Initialize with 29/30 = 96.7% coverage                                │
│    - Baskets calculate without NZDCHF (reduced weight for CHF)             │
│                                                                             │
│  Note: This is acceptable - graceful degradation                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Advantages Over Previous Proposals

| Aspect | 3-Phase (DIAGNOSIS) | Snapshot-Based (ALTERNATIVES) | Complete-Set (THIS) |
|--------|---------------------|------------------------------|---------------------|
| **New Server Code** | None | None | **None** |
| **New Client Files** | 0 | 1 (85 lines) | **0** |
| **Modified Files** | 2 | 2 | **2** |
| **Lines Changed** | ~100 | ~135 | **~80** |
| **Uses Existing Infrastructure** | ❌ No | ❌ No | **✅ Yes** |
| **Deterministic** | ❌ No | ✅ Yes | **✅ Yes** |
| **Time to Display** | 2-5s | 5-15s | **2-15s** (adaptive) |
| **Framework-First** | ✅ Yes | ✅ Yes | **✅ Yes** |
| **Crystal Clarity Compliant** | ❌ Flawed | ✅ Yes | **✅ Yes** |

---

## Implementation Roadmap

### Phase 1: State Management (30 minutes)

**File**: `src/lib/fxBasket/fxBasketData.js`

```javascript
// Add to initializeState():
expectedPairs: expectedPairs || getAllPairs(),
receivedPairs: new Set(),
initializationTimeout: 15000,
initializationStart: null,
timeoutId: null
```

### Phase 2: Tracking Logic (30 minutes)

**File**: `src/lib/fxBasket/fxBasketData.js`

```javascript
// Add new function:
export function trackReceivedPair(pair, state) {
  state.receivedPairs.add(pair);

  if (!state.initializationStart) {
    state.initializationStart = Date.now();
    state.timeoutId = setTimeout(
      () => initializeBaselinesFromTimeout(state),
      state.initializationTimeout
    );
  }

  if (state.receivedPairs.size === state.expectedPairs.length) {
    initializeBaselinesFromCompleteSet(state);
  }

  return state.receivedPairs.size / state.expectedPairs.length;
}
```

### Phase 3: Initialization Functions (30 minutes)

**File**: `src/lib/fxBasket/fxBasketData.js`

```javascript
// Add new function:
export function initializeBaselinesFromCompleteSet(state) {
  if (state.timeoutId) {
    clearTimeout(state.timeoutId);
    state.timeoutId = null;
  }

  for (const currency of Object.keys(BASKET_DEFINITIONS)) {
    const basket = state.baskets[currency];
    if (basket.initialized) continue;

    const result = calculateBasketValue(currency, state.dailyOpenPrices);
    if (result && result.coverage > 0) {
      basket.baselineLog = result.value;
      basket.currentLog = result.value;
      basket.normalized = 100;
      basket.initialized = true;
      basket.coverage = result.coverage;
    }
  }

  state.lastUpdate = new Date();
}

// Add new function:
export function initializeBaselinesFromTimeout(state) {
  const coverage = state.receivedPairs.size / state.expectedPairs.length;
  console.warn(`[FX BASKET] Initialization timeout: ${(coverage * 100).toFixed(0)}% coverage`);
  initializeBaselinesFromCompleteSet(state);
}
```

### Phase 4: Update Data Processor (15 minutes)

**File**: `src/lib/fxBasket/fxBasketDataProcessor.js`

```javascript
// Add import:
import { trackReceivedPair } from './fxBasketData.js';

// In symbolDataPackage handler, add:
if (dailyOpen) {
  updatePrice(pair, dailyOpen, basketState, true);
  trackReceivedPair(pair, basketState);  // NEW
}

// Remove:
initializeBaselinesFromDailyOpens(basketState);
```

### Phase 5: Testing (1 hour)

```javascript
// Unit tests
describe('FX Basket Complete-Set Initialization', () => {
  test('trackReceivedPair adds pair to set');
  test('trackReceivedPair starts timeout on first pair');
  test('initializeBaselinesFromCompleteSet calculates all baselines');
  test('initializeBaselinesFromTimeout handles timeout gracefully');
  test('initialization triggers at 100% coverage');
});

// Integration test
describe('FX Basket Integration', () => {
  test('Consistent baselines across multiple refreshes');
  test('Timeout fallback when pairs delayed');
  test('Handles missing pair gracefully');
});
```

### Phase 6: Manual Testing (30 minutes)

1. Refresh 10 times → Verify CHF basket normalized identical
2. Block specific pair → Verify timeout + fallback
3. Simulate slow WebSocket → Verify initialization status

---

## Summary

### The Key Insight

**Day Range Meter and FX Basket use the SAME data source** - `getSymbolDataPackage()` from cTrader API. The difference is:

- **Day Range**: Single symbol → Wait for 1 package → Display (deterministic)
- **FX Basket**: 30 symbols → Initialize at 50% → Race condition (non-deterministic)

### The Solution

Leverage the existing infrastructure by:

1. **Wait for ALL symbolDataPackage messages** (100% coverage)
2. **OR timeout to 15 seconds** (graceful degradation)
3. **Initialize once from complete set** (deterministic)

### Why This is Better

| Criterion | Status |
|-----------|--------|
| ✅ Leverages existing infrastructure | Uses getSymbolDataPackage() |
| ✅ Minimal code changes | ~80 lines |
| ✅ No new server code | Client-side only |
| ✅ Framework-First | Svelte, WebSocket, Map, setTimeout |
| ✅ Crystal Clarity compliant | Functions <15 lines, files <120 lines |
| ✅ Deterministic | Same data = same baseline |
| ✅ Graceful degradation | Timeout fallback |
| ✅ Simple to understand | Clear phase separation |

---

**Document Version**: 1.0
**Last Updated**: 2026-01-15
**Author**: Claude (Analysis of existing infrastructure)
