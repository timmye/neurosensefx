# Orchestrator Compute/Render Split

**Source:** docs/orchestrator-unification-reassessment.md
**Status:** Planning
**Approach:** Incremental per-domain, no big-bang refactor

---

## Overview

Split the three orchestrators' mixed compute+draw functions into separate `compute()` and `draw()` steps. The compute functions become unit-testable with synthetic data (no canvas, no mocks). Each domain is independent.

**Recommended order:** Day Range → Market Profile → FX Basket → Component wiring standardization

---

## Phase 1: Day Range (Simplest, Most Familiar)

### 1.1 Extract `computeDayRange()`

**File:** `src/lib/dayRangeOrchestrator.js`

Create a new exported function that returns a result object:

```js
export function computeDayRange(d, s, width, height, getConfig) {
  const config = createDayRangeConfig(s, width, height, getConfig);
  const adaptiveScale = calculateAdaptiveScale(d, config);
  const priceScale = createPriceScale(config, adaptiveScale, height);
  const mappedData = createMappedData(d);
  const dayRangePercentage = calculateDayRangePercentage(d);
  return { config, adaptiveScale, priceScale, mappedData, dayRangePercentage, width, height };
}
```

### 1.2 Refactor `renderDayRange()` to use it

```js
export function renderDayRange(ctx, d, s, getConfig, options = {}) {
  // ... validation stays as-is
  const result = computeDayRange(d, s, width, height, getConfig);
  // ... existing drawing calls, using result.config, result.priceScale, etc.
}
```

No behavior change. The drawing code reads from `result` instead of local vars.

### 1.3 Write tests

**File:** `src/lib/__tests__/dayRangeCompute.test.js`

| Test case | Synthetic input | Assert on |
|---|---|---|
| Normal ADR data | `{current: 1.0853, high: 1.0870, low: 1.0815, adrHigh: 1.0880, adrLow: 1.0801}` | `result.priceScale` maps correctly, `adaptiveScale` bounds |
| ADR expansion | Prices exceeding ADR bounds | Upper/lower expansion values |
| Day range percentage | Valid OHLC + ADR | Correct percentage string |
| Missing data | `{current: null}` | Graceful null/undefined handling |
| Edge: zero ADR range | `adrHigh === adrLow` | No division by zero |

### 1.4 Verification

- Run existing E2E tests to confirm Day Range renders identically
- Run new unit tests: `npm run test:unit -- src/lib/__tests__/dayRangeCompute.test.js`

---

## Phase 2: Market Profile

### 2.1 Extract `computeMarketProfile()`

**File:** `src/lib/marketProfile/orchestrator.js` (lines 32-42)

Already well-separated in sub-modules (`calculations.js`, `scaling.js`). Extract:

```js
export function computeMarketProfile(data, width, height) {
  const dimensions = calculateDimensions(width);
  const adaptiveScale = calculateAdaptiveScale(data.profile, data.marketData, width, height);
  const priceScale = createPriceScale(adaptiveScale, height);
  const maxTpo = calculateMaxTpo(data.profile);
  const tpoScale = calculateTpoScale(maxTpo, dimensions.marketProfileWidth);
  const poc = computePOC(data.profile);
  const valueArea = calculateValueArea(data.profile);
  return { dimensions, adaptiveScale, priceScale, maxTpo, tpoScale, poc, valueArea };
}
```

### 2.2 Refactor `renderMiniMarketProfile()`

This is the 119-line god function in the same file. Apply the same split — extract position calculations into a compute function, leave only canvas operations in the draw function.

### 2.3 Write tests

**File:** `src/lib/marketProfile/__tests__/computeMarketProfile.test.js`

| Test case | Synthetic input | Assert on |
|---|---|---|
| TPO profile building | `[{price: 1.0850, time: 1000}, {price: 1.0850, time: 2000}]` | Correct TPO count per level |
| POC calculation | Profile with known max | POC at correct price level |
| Value area (70%) | Profile with known distribution | Correct high/low bounds |
| TPO scale | `maxTpo=25, width=200` | Correct pixel scaling factor |
| Empty profile | `[]` | Graceful handling, no crash |

### 2.4 Verification

- Run E2E tests for market profile rendering
- Run unit tests

---

## Phase 3: FX Basket

### 3.1 Extract `computeFxBasketLayout()`

**File:** `src/fxBasket/fxBasketOrchestrator.js`

Extract the positioning logic from `renderReadyState()` (lines 40-62):

```js
export function computeFxBasketLayout(baskets, dimensions) {
  const { renderHeight, verticalPadding } = dimensions;
  const values = baskets.map(b => b.normalized);
  const { rangeMin, rangeMax } = calculateRange(Math.min(...values), Math.max(...values));
  const basketPositions = baskets.map(b => ({
    currency: b.currency,
    normalized: b.normalized,
    changePercent: b.changePercent,
    y: mapValueToY(b.normalized, renderHeight, rangeMin, rangeMax, verticalPadding),
  }));
  return { rangeMin, rangeMax, basketPositions, dimensions };
}
```

### 3.2 Write tests

**File:** `src/fxBasket/__tests__/computeFxBasket.test.js`

| Test case | Synthetic input | Assert on |
|---|---|---|
| Basket value calc | `{EURUSD: 1.0853, GBPUSD: 1.2710}` + weights | Correct basket index |
| Y-position mapping | `normalized=102.35, height=300` | Correct pixel position |
| Range calculation | `[98.5, 101.2, 102.35]` | Correct min/max |
| State machine | Sequence of pair updates | Correct state transitions |
| Missing pair data | Partial price map | Correct coverage calculation |

### 3.3 Verification

- Run E2E tests for FX basket rendering
- Run unit tests

---

## Phase 4: Component Wiring Standardization (Lowest Priority)

After all three domains have compute/render split, standardize the thin wiring layer in Svelte components:

| Component | Current pattern | Target pattern |
|---|---|---|
| Day Range component | `visualizers.js` → `displayCanvasRenderer.js` | Direct `compute → draw` |
| PriceTicker.svelte | Reactive `$:` block calling render | `compute` on data change, `draw` in rAF |
| FxBasketDisplay.svelte | Subscription callback → render | `compute` on data change, `draw` in rAF |

This is cosmetic — all the heavy lifting is done by the store decomposition. Only do this if it makes the code clearer.

---

## Effort Estimate

| Phase | Scope | Estimated tests |
|---|---|---|
| Phase 1: Day Range | 1 new function, 1 refactor, 1 test file | ~15-20 tests |
| Phase 2: Market Profile | 2 new functions, 2 refactors, 1 test file | ~15-20 tests |
| Phase 3: FX Basket | 1 new function, 1 refactor, 1 test file | ~12-15 tests |
| Phase 4: Wiring | 3 component touch-ups | 0 (behavior unchanged) |
| **Total** | ~7 files modified, 3 new test files | ~42-55 new tests |

## Risk Assessment

- **No behavior change in any phase** — compute functions are extracted, not rewritten
- **Each phase is independently shippable** — no cross-domain dependencies
- **Rollback is trivial** — revert the specific commit for a domain
- **No new dependencies** — uses existing vitest setup
