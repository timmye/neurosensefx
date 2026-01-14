# src/lib/fxBasket/

## Overview

FX basket calculations, state management, and rendering for currency strength display.

## Index

| File | Contents (WHAT) | Read When (WHEN) |
| ---- | --------------- | ---------------- |
| `fxBasketCalculations.js` | Basket definitions, ln-weighted calculations, inverse pair handling, daily opens threshold | Implementing basket calculations, understanding formula, adding currency baskets |
| `fxBasketData.js` | State management, price updates (dual Map), baseline initialization | Managing basket state, routing daily opens vs current prices |
| `fxBasketConfig.js` | Visual configuration (colors, fonts, positioning) | Customizing basket display appearance |
| `fxBasketOrchestrator.js` | Canvas rendering coordination, fixed baseline at 100wt | Rendering basket display, debugging visual issues |
| `test-fxBasket.js` | Unit tests for basket functionality | Verifying calculations, testing baseline initialization |

## Key Exports

**From `fxBasketData.js`:**
- `initializeState(anchorTime)` - Create new basket state with dual Maps (dailyOpenPrices, prices)
- `updatePrice(pair, price, state, isDailyOpen)` - Route to dailyOpenPrices (true) or prices (false), recalculate affected baskets
- `initializeBaselinesFromDailyOpens(state)` - Calculate baselineLog from daily opens, call after symbolDataPackage
- `updateAllBaskets(state)` - Recalculate all baskets from current prices (fallback)
- `hasMinimumDailyOpens(state)` - Check if sufficient daily opens available (50% threshold)

**From `fxBasketCalculations.js`:**
- `calculateBasketValue(currency, priceMap)` - Calculate ln-weighted basket value with coverage
- `normalizeToBaseline(currentLog, baselineLog)` - Convert to 100wt baseline
- `getAllPairs()` - Get all 30 unique FX pairs
- `BASKET_DEFINITIONS` - Currency basket pairs and weights
