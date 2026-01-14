# FX Basket Module

## Overview

Currency basket strength visualization using ln-weighted geometric mean. Displays performance relative to daily open (100wt baseline) instead of runtime baseline.

## Architecture

**State Structure (dual-Map design):**

```
state = {
  dailyOpenPrices: Map<pair, open>,  // Fixed baseline from symbolDataPackage
  prices: Map<pair, current>,        // Live tick data
  baskets: Map<currency, basket>
}
```

**Why separate Maps:** Baseline must be fixed (calculated once from daily opens) while current prices update continuously (every tick). Single Map loses distinction between "what baseline was calculated from" vs "what's happening now."

## Data Flow

```
symbolDataPackage arrives
  ├─> Extract todaysOpen → updatePrice(pair, open, state, true)
  │     └─> Stores in state.dailyOpenPrices[pair]
  │
  ├─> Extract current → updatePrice(pair, current, state, false)
  │     └─> Stores in state.prices[pair]
  │
  └─> initializeBaselinesFromDailyOpens(state)
        └─> For each basket: calculateBasketValue(currency, dailyOpenPrices)
              └─> Set basket.baselineLog, basket.normalized = 100

tick arrives (real-time)
  └─> Extract bid → updatePrice(pair, bid, state, false)
        └─> Store in state.prices[pair]
              └─> Recalculate basket.currentLog from prices
                    └─> basket.normalized = normalizeToBaseline(currentLog, baselineLog)
```

## Invariants

- `state.dailyOpenPrices` contains ONLY daily open prices (never tick data)
- `state.prices` contains current prices (from symbolDataPackage.current OR tick.bid)
- `basket.baselineLog` calculated from `dailyOpenPrices` only (never changes after initialization)
- `basket.currentLog` calculated from `prices` (updates on every tick)
- `basket.normalized = 100` when `currentLog === baselineLog` (at baseline)
- Once `basket.initialized = true`, baselineLog never changes

## Design Decisions

**Separate Maps vs flags:** Clean separation of concerns; easier to debug by inspecting both Maps; follows Day Range Meter pattern (displayDataProcessor.js:38).

**Batch initialization:** Single `initializeBaselinesFromDailyOpens()` call handles all baskets from same daily open snapshot. Simpler than per-basket logic, consistent across all currencies.

**50% coverage threshold:** Allows baseline initialization with partial data. Handles slow/stale API responses where not all 30 pairs arrive immediately.

**30-second fallback timeout:** If daily opens never arrive (API failure), fallback to runtime baseline prevents broken display. Matches user attention span for graceful degradation.
