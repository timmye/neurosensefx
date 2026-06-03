# Price-Scale Unification Report

**Date:** 2026-06-03
**Status:** Investigation complete, awaiting implementation decision
**Related:** Frontend Architecture Assessment §6 P1 #8

---

## 1. Executive Summary

The architecture assessment identified "unify price-scale calculation across Day Range, Market Profile, and Price Markers" as a P1 structural item. Investigation reveals the core formula **is already unified** — a single `createPriceScale()` function in `dayRangeRenderingUtils.js` is the canonical implementation, used by 4 callers across all three features.

The actual duplication is minor: 2 inline copies in `percentageMarkerRenderer.js`, 1 inverse function with its own derivation in `priceMarkerCoordinates.js`, and 1 dead function in `dayRangeCalculations.js`. Total effort to consolidate: **1-2 hours**, not the "deliberate project" the assessment implied.

---

## 2. Current Architecture

### 2.1 Canonical formula

`src/lib/dayRangeRenderingUtils.js:28-37`:

```javascript
export function createPriceScale(config, adaptiveScale, height) {
  return (price) => {
    const { min, max } = adaptiveScale;
    const range = Math.max(max - min, 1e-10);
    const normalized = (max - price) / range;
    const labelPadding = 5;
    return labelPadding + (normalized * (height - 2 * labelPadding));
  };
}
```

All features use the same mathematical model:
- Normalized price: `(max - price) / range` (0 at max price, 1 at min price)
- Y coordinate: `padding + normalized * (height - 2 * padding)` (top=padding, bottom=height-padding)
- Inverted Y-axis: higher prices map to smaller Y values (toward top of canvas)

### 2.2 Adaptive scale input

All features use `calculateAdaptiveScale()` from `dayRangeCalculations.js:57-113` to compute the `min`/`max`/`range` fed into `createPriceScale()`. This function:
- Computes a symmetric range centered on the opening price
- Uses progressive disclosure (50% → 75% → 100%+ ADR) based on price movement
- Falls back to a synthetic range when ADR data is unavailable

### 2.3 Callers already using the canonical function

| Feature | File | Line | Context |
|---|---|---|---|
| Day Range | `dayRangeOrchestrator.js` | 26 | Main day range meter rendering |
| Market Profile | `marketProfile/orchestrator.js` | 36 | Main market profile rendering |
| Price Markers | `displayCanvasRenderer.js` | 97 | User-placed marker rendering |
| Price Markers | `displayCanvasRenderer.js` | 151 | Delta line rendering |
| Marker interaction | `priceMarkerInteraction.js` | 151 | Marker drag coordinate calculation |

---

## 3. Gaps — What Is NOT Unified

### Gap 1: Inline duplicates in percentageMarkerRenderer.js

**Location:** `src/lib/percentageMarkerRenderer.js` lines 52-58 and 79-85

Both `renderStaticMarker()` and `renderDynamicMarker()` inline the same formula:

```javascript
const { min, max } = adaptiveScale;
const range = Math.max(max - min, 1e-10);
const labelPadding = 5;
const priceScale = (price) => {
  const normalized = (max - price) / range;
  return labelPadding + (normalized * (height - 2 * labelPadding));
};
```

This is identical to `createPriceScale()` output. The file also imports `getYCoordinate` (same formula, different signature) on line 5 but never calls it — dead import.

**Impact of fixing:** Zero behavioral change. Replace with `const priceScale = createPriceScale(config, adaptiveScale, height)`.

### Gap 2: Inverse function has independent implementation

**Location:** `src/lib/priceMarkerCoordinates.js:7-42`

`toPrice()` converts pixel Y-coordinate back to price (reverse direction). It:
1. Re-derives `adaptiveScale` by calling `calculateAdaptiveScale()` itself
2. Implements the inverse formula: `price = min + ((h - padding - y) / (h - 2*padding)) * range`
3. Has 3 fallback paths for missing data (adaptive scale → provided scale → synthetic range)

**Why this is fragile:** If the forward formula in `createPriceScale()` changes (e.g., padding, normalization direction), `toPrice()` will silently desynchronize. It also redundantly re-derives the adaptive scale that callers already have.

**Impact of fixing:** The fallback logic for missing data needs to be preserved — either in the utility or at the call site. The inverse formula itself can be derived from `createPriceScale()` parameters.

### Gap 3: Dead code — getYCoordinate()

**Location:** `src/lib/dayRangeCalculations.js:127-131`

```javascript
export function getYCoordinate(price, range, height, padding) {
  const { min, max } = range;
  const normalized = (max - price) / (max - min);
  return padding + (normalized * (height - 2 * padding));
}
```

Same formula, different parameter signature (takes `{min, max}` object, parameterized padding). Imported only by `percentageMarkerRenderer.js` which never calls it. No other consumers found.

**Impact of removing:** None. Pure dead code.

### Gap 4: Mini profile variant

**Location:** `src/lib/marketProfile/scaling.js:34-40`

```javascript
export function createMiniPriceScale(minPrice, maxPrice, height) {
  const priceRange = maxPrice - minPrice || 1;
  return (price) => {
    const normalized = (maxPrice - price) / priceRange;
    return Math.round(normalized * (height - 1));
  };
}
```

Used by `marketProfile/orchestrator.js:77` for the tiny (~37x80px) mini profile in PriceTicker. Differences from canonical:
- No padding (uses full height)
- `Math.round()` for pixel alignment on small canvas
- `height - 1` instead of `height - 2*padding`
- Simpler inputs (no config/adaptiveScale, just min/max/height)

**Assessment:** Legitimate variant. Different enough to warrant its own function. The question is whether it should live in `marketProfile/scaling.js` (current) or alongside the shared utility.

---

## 4. Dependency Map

```
dayRangeCalculations.js
  └─ calculateAdaptiveScale()     ← used by all 5 scale consumers
  └─ getYCoordinate()             ← DEAD (imported but never called)

dayRangeRenderingUtils.js
  └─ createPriceScale()           ← canonical forward conversion (4 callers)

priceMarkerCoordinates.js
  └─ toPrice()                    ← inverse conversion (1 caller)
     └─ imports calculateAdaptiveScale() (redundant re-derivation)

marketProfile/scaling.js
  └─ createMiniPriceScale()       ← variant for mini profile (1 caller)
  └─ calculateAdaptiveScale()     ← wrapper, delegates to dayRange version

percentageMarkerRenderer.js
  └─ inline priceScale (x2)       ← duplication of createPriceScale()
  └─ imports getYCoordinate()     ← DEAD import
```

---

## 5. Why This Has Been Fragile

The formula `(max - price) / range * (height - 2*padding)` appears in **5 places** with minor variations:

| Location | Padding | Direction | Rounding | Inputs |
|---|---|---|---|---|
| `createPriceScale()` | 5 | forward | none | config, adaptiveScale, height |
| `percentageMarkerRenderer` (x2) | 5 | forward | none | inline from adaptiveScale |
| `toPrice()` | 5 | **inverse** | none | re-derives adaptiveScale |
| `getYCoordinate()` | parameter | forward | none | range object, height, padding |
| `createMiniPriceScale()` | 0 | forward | Math.round | minPrice, maxPrice, height |

Any change — adding log-scale support, changing padding, fixing a rounding error — requires finding and updating all relevant copies. The normalization direction (inverted Y) is easy to get wrong when reimplementing. The padding constant `5` is hardcoded in 4 locations.

---

## 6. Implementation Options

### Option A — Minimal cleanup (1-2 hours)

Eliminate duplication without changing file locations:

1. Replace 2 inline lambdas in `percentageMarkerRenderer.js` with `createPriceScale()` calls
2. Remove dead `getYCoordinate` import from `percentageMarkerRenderer.js`
3. Add `toPrice()` inverse to `createPriceScale()` return value (return object with both methods instead of bare function)
4. Rewrite `priceMarkerCoordinates.js` to use the shared `toPrice()` (move fallback logic to call site)
5. Delete `getYCoordinate()` from `dayRangeCalculations.js`
6. Leave `createMiniPriceScale()` where it is

**Risk:** Low. All changes are mechanical substitutions. The `createPriceScale()` return type changes from function to object, which requires updating all 4 existing callers from `priceScale(price)` to `priceScale.toPixel(price)`.

**Backward compat concern:** The return-type change (function → object) touches all 4 callers. Alternative: keep returning a callable function and attach `.inverse` as a property.

### Option B — Extract shared utility file (2-3 hours)

Same as Option A, plus:

7. Create `src/lib/priceScale.js` with `createPriceScale()`, `toPrice()`, and `createMiniPriceScale()`
8. Delete from `dayRangeRenderingUtils.js`, `priceMarkerCoordinates.js`, `marketProfile/scaling.js`
9. Update all import paths (6 files)

**Tradeoff:** Cleaner module boundaries and a file name that reflects cross-feature usage. Adds a file move to what is otherwise a simple cleanup. `dayRangeRenderingUtils.js` is only 52 lines and would lose its primary export.

---

## 7. Recommendation

**Option A.** The duplication is minor and the existing file location in `dayRangeRenderingUtils.js` is already shared across features. Adding a new file for 3 small functions is marginal organizational benefit for real import-churn cost.

The key deliverable is eliminating the 2 inline copies and the `toPrice()` re-derivation — that removes the fragility, not the file location.

---

## 8. What This Does NOT Cover

- **klinecharts price-scale** — The main chart uses klinecharts' internal coordinate system. None of the features investigated here depend on it. They all render on independent canvases with their own coordinate system.
- **Log-scale support** — All current implementations are linear. If log-scale is ever needed, the shared utility is the right place to add it, but that is a new feature, not a unification task.
- **`calculateAdaptiveScale()` unification** — Market Profile's `scaling.js` wraps the dayRange version with profile-data fallback. This is a reasonable adapter pattern, not duplication.
