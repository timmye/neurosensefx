# Orchestrator Pattern Unification — Reassessment

**Date:** 2026-06-03
**Status:** Done — compute/render split implemented, 51 tests added
**Related:** [Frontend Architecture Assessment](frontend-architecture-assessment-2026-06.md) P2 #13, §5.2, §5.3
**Trigger:** "What would testing look like if this was done?" + "Is this more achievable after the store decomposition?"

---

## 1. What the Original Assessment Said

The June 2026 architecture assessment identified three feature domains, each with a subtly different take on the same orchestration job:

| Domain | Orchestrator | Pattern variant |
|---|---|---|
| Day Range | `dayRangeOrchestrator.js` | Renders directly from market data on each tick |
| Market Profile | `marketProfile/orchestrator.js` | Builds TPO profile over time, then renders |
| FX Basket | `fxBasket/fxBasketOrchestrator.js` | Subscribes to multiple symbols, aggregates into basket |

The assessment noted three inconsistencies:
- Subscription management (SubscriptionManager vs. direct)
- Data flow into component (store subscription vs. callback vs. direct import)
- Rendering trigger (reactive `$:` vs. rAF vs. store subscribe)

**Original verdict (P2 deferred):** High cost, low benefit. Inconsistency is annoying but not dangerous. Only worth doing if building a 4th feature domain.

---

## 2. What Changed Since the Assessment

Two P1 items were completed that directly affect this:

### 2.1 `workspace.js` Decomposition (P1 #6)

Commits `7cd003e`..`2f1ac24`. The 654-line god store was split into focused stores:

| Store | Lines | Responsibility |
|---|---|---|
| `workspace.js` | 389 | Workspace layout, floating displays, import/export |
| `chartDataStore.js` | 115 | OHLC bar management per symbol:resolution |
| `displayStore.js` | 254 | Display lifecycle, z-index, CRUD |
| `markerStore.js` | 173 | Price marker persistence |

**Relevance:** Subscription lifecycle — which was the messiest inconsistency across the three domains — is now managed by the decomposed stores, not by the orchestrators.

### 2.2 Price-Scale Unification (P1 #8)

Commit `76d2415`. Duplicated price-scale calculation across Day Range, Market Profile, and Price Markers was unified into shared functions in `dayRangeRenderingUtils.js`.

**Relevance:** One of the three key differences between domains (how they calculate price-to-pixel mapping) is now the same code.

### 2.3 Unit Test Suite (§5.3 narrow targets)

Commit `d732eff`. 314 tests added covering pure-logic modules: `barMerge`, `priceFormat`, `reconcile`, `dataContracts`, `xAxisCustom`, `drawingCommands`, `drawingCoordinator`, `styleUtils`, `pricePrecision`, `cacheFreshness`.

**Relevance:** Established the testing pattern (synthetic data → pure function → assertion) that orchestrator tests would follow.

---

## 3. Key Finding — Orchestrators Are Already Pure Functions

The original assessment described the orchestrators as entangled with "subscriptions, callbacks, reactive stores, WebSocket flow." That was true of the wiring *around* them, but **the orchestrator functions themselves are already pure rendering functions:**

```js
// dayRangeOrchestrator.js — receives data as parameters
export function renderDayRange(ctx, d, s, getConfig, options = {}) { ... }
```

```js
// marketProfile/orchestrator.js — receives data as parameters
export function renderMarketProfile(ctx, data, config) { ... }
```

```js
// fxBasket/fxBasketOrchestrator.js — receives data as parameters
export function renderFxBasket(ctx, baskets, config = {}, dimensions) { ... }
```

None of them:
- Import stores
- Manage WebSocket subscriptions
- Own lifecycle (onMount / onDestroy)
- Hold mutable module-level state

They receive `(ctx, data, config)` and render to canvas. The data flow is:

```
Store (owns subscription) → Component (wires lifecycle) → Orchestrator (pure render) → Canvas
```

The "three variants" problem was always in the component wiring layer, not in the orchestrators themselves. And the store decomposition already standardized that wiring.

---

## 4. What Remains — Compute/Render Split

The orchestrators are pure in the sense of no side-channel dependencies, but they mix **computation** with **canvas drawing** in the same function body. For example, `renderDayRange` calls:

```js
const config = createDayRangeConfig(s, width, height, getConfig);
const adaptiveScale = calculateAdaptiveScale(d, config);
const priceScale = createPriceScale(config, adaptiveScale, height);
const mappedData = createMappedData(d, priceScale);
// ... then immediately draws with these values
```

The first four calls are pure computations. The drawing calls after them require a canvas context. The split would be:

```
Now:   data → orchestrator (compute + draw mixed) → canvas

After: data → compute(data) → result          ← testable with synthetic data, no canvas
                            → draw(ctx, result) → canvas
```

This is the same pattern already used in `barMerge.js`, `priceFormat.js`, `reconcile.js` — all tested with synthetic inputs, no DOM.

---

## 5. Mock Data Is Not Required

The original concern was that extracting pure logic would need mock live tick data, which is finicky and non-deterministic.

**This is not the case.** Pure functions don't consume live data. They consume data shapes. The 314 existing tests demonstrate this:

```js
// barMerge.test.js — synthetic bar, no WebSocket
function makeBar(ts, o, h, l, c, vol = 0) {
  return { timestamp: ts, open: o, high: h, low: l, close: c, volume: vol };
}
const result = mergeTickBar([], makeBar(1000, 1.0, 1.1, 0.9, 1.05), false);
```

For orchestrator compute functions, the same approach:

| Pure function | Synthetic input | Assert on |
|---|---|---|
| ADR state calculator | `[{high: 1.0853, low: 1.0801}, {high: 1.0870, low: 1.0815}]` | Correct ADR boundaries |
| Basket value calculator | `{EURUSD: 1.0853, GBPUSD: 1.2710}` + weights | Correct basket index |
| TPO profile builder | Array of `{price, time}` tuples | Correct TPO counts per level |
| Adaptive scale bounds | Price range + current bounds | Correct min/max with padding |

No live data. No WebSocket mock. No canvas mock. Just JS objects into functions.

---

## 6. Revised Scope and Effort

### What's already done (was part of the problem, now resolved)

- Subscription wiring inconsistency → standardized by store decomposition
- Price-scale calculation duplication → unified by P1 #8
- No testing pattern established → 314 unit tests now prove the pattern

### What remains

1. **Split compute from render** in each orchestrator. Medium effort per domain. The compute functions (`createDayRangeConfig`, `calculateAdaptiveScale`, `createPriceScale`, `createMappedData`) already exist and are pure — they just need to be called in a separate step that returns a result object instead of being consumed inline by drawing code.

2. **Standardize the thin wiring layer** in components. Low effort — the stores already handle subscriptions, so components just need a consistent `subscribe → compute → draw` pattern.

3. **Write tests** against the extracted compute functions. Straightforward — same pattern as existing tests, synthetic inputs, no mocks.

### Revised cost/benefit

| Factor | Original assessment | Now |
|---|---|---|
| Subscription unification | High cost (each domain different) | **Already done** by store decomposition |
| Price-scale unification | High cost (3 copies) | **Already done** by P1 #8 |
| Orchestrator extraction | Medium-high (entangled logic) | **Low-medium** (already pure functions, just mixed compute/draw) |
| Testing | Not possible without architectural change | **Possible** with compute/render split, using same pattern as 314 existing tests |
| Trigger for doing it | "Building a 4th feature domain" | Still valid, but the cost is now low enough to justify on testing grounds alone |

---

## 7. Recommendation

The original assessment said: *"The only thing that justifies the cost is if you're about to build a new feature domain."* That was correct at the time.

The store decomposition and price-scale unification have reduced the remaining work from "high cost, low benefit" to "low-medium cost, medium benefit." The trigger is no longer just "4th feature domain" — it's also "we want the orchestrators' compute logic to be unit-testable."

If proceeding, the natural order is:

1. Start with Day Range (simplest orchestrator, most familiar domain)
2. Extract compute step, write tests, verify against live rendering
3. Apply same pattern to Market Profile
4. Apply same pattern to FX Basket
5. Standardize component wiring last (lowest risk, lowest value)

Each domain can be done independently. No need for a big-bang refactor.

---

## 8. Implementation — Completed (2026-06-03)

The compute/render split was implemented across all three orchestrators. No behavior changes — each `render*()` function now calls its `compute*()` counterpart internally.

### 8.1 New exported functions

| Function | File | Returns |
|---|---|---|
| `computeDayRange(d, s, getConfig)` | `src/lib/dayRangeOrchestrator.js` | `{config, adaptiveScale, priceScale, mappedData, dayRangePercentage, midPrice, adrValue, width, height}` |
| `computeMarketProfile(data, config)` | `src/lib/marketProfile/orchestrator.js` | `{dimensions, adaptiveScale, priceScale, maxTpo, tpoScale, poc, valueArea, width, height}` |
| `computeMiniMarketProfile(profile, size)` | `src/lib/marketProfile/orchestrator.js` | `{priceScale, maxTpo, minPrice, maxPrice, width, height}` |
| `computeFxBasketLayout(baskets, dimensions, config)` | `src/lib/fxBasket/fxBasketOrchestrator.js` | `{basketValues, basketPositions, rangeMin, rangeMax, baselineY, dimensions, renderHeight, width, height}` |
| `calculateRange()`, `mapValueToY()` | `src/lib/fxBasket/fxBasketOrchestrator.js` | Now exported (were internal) |

### 8.2 Refactored render functions

| Function | Change |
|---|---|
| `renderDayRange()` | Delegates to `computeDayRange()`, internal helpers accept result object |
| `renderMarketProfile()` | Delegates to `computeMarketProfile()` |
| `renderMiniMarketProfile()` | Delegates to `computeMiniMarketProfile()` |
| `renderReadyState()` | Delegates to `computeFxBasketLayout()` for positioning |

### 8.3 Tests added

| Test file | Tests | Coverage |
|---|---|---|
| `src/lib/__tests__/dayRangeCompute.test.js` | 22 | Normal ADR, expansion, percentage, missing data, zero range, mappedData |
| `src/lib/marketProfile/__tests__/computeMarketProfile.test.js` | 14 | POC, value area, TPO scale, mini profile, priceScale mapping, empty profile |
| `src/lib/fxBasket/__tests__/computeFxBasket.test.js` | 15 | Range symmetry, Y mapping, basket layout positions, empty baskets, baseline |
| **Total** | **51** | |

All 365 unit tests pass (51 new + 314 existing). Zero regressions.

### 8.4 Component impact

None. The three component files that import from these orchestrators (`visualizers.js`, `PriceTicker.svelte`, `FxBasketDisplay.svelte`) were not modified. Import signatures unchanged.

### 8.5 Phase 4 (component wiring standardization)

Not done. The store decomposition already standardized the wiring layer. No user-visible improvement from further normalization. Left as-is.
