# Data Pipeline Fixes

> Source: `docs/data-pipeline-audit.md`
> Issues: 2 CRITICAL, 3 HIGH, 4 MEDIUM (LOW deferred)

---

## Wave 1 — CRITICAL (store normalization)

**Files:** `src/stores/marketDataStore.js`

### C1: Assemble `prevDayOHLC` from flat fields

Backend sends `prevDayOpen`, `prevDayHigh`, `prevDayLow`, `prevDayClose` as separate flat fields. The renderer expects `d.prevDayOHLC = { open, high, low, close }`. The store never assembles them.

In `normalizeData()`, after existing field mappings, add:

```js
prevDayOHLC: (data.prevDayOpen != null && data.prevDayHigh != null &&
              data.prevDayLow != null && data.prevDayClose != null)
  ? { open: data.prevDayOpen, high: data.prevDayHigh, low: data.prevDayLow, close: data.prevDayClose }
  : null,
```

Also add `prevDayOHLC: null` to `createInitialData()`.

### C2: Map `initialPrice` to `current` for cTrader

cTrader's `symbolDataPackage` sends `initialPrice` but the store looks for `current ?? price ?? bid ?? ask`. Add `data.initialPrice` to the fallback chain:

```js
current: data.current ?? data.price ?? data.initialPrice ?? data.bid ?? data.ask ?? null
```

---

## Wave 2 — HIGH (null guards)

### H1: Document fallback chain as intentional design (no code change)

The canonical field names in `dataContracts.js` are aspirational. The fallback chain in `normalizeData()` IS the data contract. Add a block comment at the top of `normalizeData()`:

```
Backend field name fallback chain is the data contract.
projectedAdrHigh/projectedAdrLow and todaysHigh/todaysLow are the expected field names from both pipelines.
```

Remove DEV warnings for `projectedAdrHigh`/`projectedAdrLow` — these are not legacy deviations.

### H2: Daily reset TradingView skip — accepted as known behavior (no code change)

After daily reset, `open`/`adrHigh`/`adrLow` remain stale until resubscription. Frontend running high/low from ticks self-corrects. ADR is a daily projection (not recalculated intraday). Document in audit as resolved (known behavior).

### H3: Null guard in `calculateAdaptiveScale()`

**File:** `src/lib/dayRangeCalculations.js:57`

Guard `adrHigh`/`adrLow` at the top of the function. If either is null, return a default scale using `pipSize`:

```js
if (!d.adrHigh || !d.adrLow) {
  const defaultRange = d.pipSize ? d.pipSize * 10000 : 0.01;
  const center = d.current ?? d.open ?? 0;
  return { min: center - defaultRange / 2, max: center + defaultRange / 2, range: defaultRange };
}
```

This protects all 4 callers (renderPriceMarkers, renderPriceDelta, handleContextMenu, and the main render pipeline).

---

## Wave 3 — MEDIUM (safety guards)

### M1: Null guard in `percentageMarkerRenderer.js:48`

Same `d.adrHigh - d.adrLow` pattern. Inside the `validateMarketData` gate so partially protected, but add a guard:

```js
const adrRange = d.adrHigh && d.adrLow ? d.adrHigh - d.adrLow : 0;
```

### M2: Zero-division guard in `createPriceScale()`

**File:** `src/lib/dayRangeRenderingUtils.js:28`

Replace `max - min` with epsilon guard:

```js
const range = Math.max(max - min, 1e-10);
```

### M3: Enhanced DEV field validation in `dataContracts.js`

In `validateWebSocketMessage()`, add field-presence warnings for `symbolDataPackage` messages. Return warnings alongside errors:

```js
// In the symbolDataPackage case:
if (!data.high && !data.todaysHigh) warnings.push('symbolDataPackage missing high/todaysHigh');
if (!data.low && !data.todaysLow) warnings.push('symbolDataPackage missing low/todaysLow');
// ... etc

return { valid: errors.length === 0, errors, warnings };
```

### M4: Symbol-aware fallback range in `priceMarkerCoordinates.js`

Replace hardcoded `0.5-1.5` with pipSize-derived range:

```js
const defaultRange = data?.pipSize ? data.pipSize * 10000 : 1.0;
const fallbackLow = (data?.current ?? 0) - defaultRange / 2;
const fallbackHigh = (data?.current ?? 0) + defaultRange / 2;
```

---

## Wave 4 — Audit doc updates

Update `docs/data-pipeline-audit.md`:
- Mark C1, C2, H1, H3, M1, M2, M3, M4 as resolved with fix references
- Mark H2 as "known behavior — accepted"
- Add resolution notes for each

---

## Test Plan

| Wave | Test | File |
|------|------|------|
| 1 | `normalizeData` assembles prevDayOHLC from cTrader flat fields | unit |
| 1 | `normalizeData` returns null prevDayOHLC when any field missing | unit |
| 1 | `normalizeData` maps initialPrice to current | unit |
| 1 | `normalizeData` with TradingView data still works unchanged | unit |
| 2 | `calculateAdaptiveScale` returns default scale when adrHigh null | unit |
| 2 | `calculateAdaptiveScale` returns default scale when adrLow null | unit |
| 2 | `calculateAdaptiveScale` default scale uses pipSize (not hardcoded) | unit |
| 3 | `createPriceScale` returns finite values when min === max | unit |
| 3 | `toPrice` returns sensible values for BTCUSD-like pipSize | unit |
| 3 | `validateWebSocketMessage` warns on missing fields | unit |
