# Sigma Markers - Data Sources & Calculation Methods

## The Core Question

**Do we calculate σ from historical data, or convert from ADR?**

**Answer:** Convert from ADR using the empirically validated factor.

---

## Method: ADR Conversion (Recommended)

### Data Required

| Data | Source | Current Availability |
|------|--------|---------------------|
| **ADR value** | 14-day average daily range | ✅ Already calculated |
| **Daily open** | Current day's open price | ✅ Already have (adrData.midPrice) |
| **Conversion factor** | 0.875 (empirically validated) | ✅ Constant |

### Calculation Steps

```javascript
// 1. Get ADR (already calculated)
const adrValue = adrData.adrHigh - adrData.adrLow;  // e.g., 70 pips

// 2. Convert to sigma using empirical factor
const sigmaValue = adrValue * 0.875;  // e.g., 61 pips

// 3. Calculate marker positions
const oneSigmaUpper = midPrice + sigmaValue;      // open + 61 pips
const oneSigmaLower = midPrice - sigmaValue;      // open - 61 pips
const twoSigmaUpper = midPrice + (sigmaValue * 2); // open + 122 pips
const twoSigmaLower = midPrice - (sigmaValue * 2); // open - 122 pips
```

### Why This Approach?

| Pro | Explanation |
|-----|-------------|
| **Zero new data** | Uses ADR already being calculated |
| **Empirically validated** | 0.875 factor from futures study |
| **Consistent with ADR** | Same lookback period (14 days) |
| **Simple implementation** | One multiplication, no loops |
| **Stable** | Not affected by single-day outliers |

---

## Alternative Method: Direct σ Calculation (Not Recommended)

### Data Required

| Data | Source | Current Availability |
|------|--------|---------------------|
| **Historical closes** | 14-20 days of closing prices | ❌ Not stored |
| **Mean calculation** | Average of those closes | ❌ Need to compute |
| **σ calculation** | sqrt(Σ(close - mean)² / n) | ❌ Need to compute |

### Calculation Steps

```javascript
// 1. Collect last 14-20 closing prices
const closes = getClosesForPeriod(symbol, 14);  // NEW: API call needed

// 2. Calculate mean
const mean = closes.reduce((a, b) => a + b, 0) / closes.length;

// 3. Calculate variance
const variance = closes.reduce((sum, close) => {
  return sum + Math.pow(close - mean, 2);
}, 0) / closes.length;

// 4. Calculate sigma
const sigmaValue = Math.sqrt(variance);  // Daily σ in price units

// 5. Same marker calculation as above
```

### Why NOT This Approach?

| Con | Explanation |
|-----|-------------|
| **New data dependency** | Need historical closes (not currently stored) |
| **Backend changes** | Requires new API endpoint or data structure |
| **Complexity** | More computation, more failure points |
| **Different reference** | σ is around mean, not open (conceptual mismatch) |
| **Unnecessary** | 0.875 factor already proven accurate |

---

## Comparison: ADR Conversion vs Direct Calculation

| Aspect | ADR Conversion | Direct σ Calculation |
|--------|---------------|---------------------|
| **Data needed** | ADR (already have) | 14-20 closes (new) |
| **Backend changes** | None | Required |
| **Computation** | O(1) - one multiplication | O(n) - loop + sqrt |
| **Validation** | Empirically validated | Theoretically correct |
| **Implementation** | ~10 lines of code | ~30 lines + backend |
| **Maintenance** | Low | Medium |
| **Result** | σ-equivalent magnitude | "True" σ around mean |

**Verdict:** ADR conversion is **sufficient and simpler** for the use case of providing statistical context.

---

## The ADR Data Flow (Current Implementation)

### Where ADR Comes From

```
Backend (cTrader API)
  ↓
D1 bars (daily OHLC) - 14 days
  ↓
ADR = Average(high - low) over 14 days
  ↓
adrHigh = open + ADR/2
adrLow = open - ADR/2
  ↓
Frontend receives: { open, high, low, adrHigh, adrLow }
```

### What We Already Have

```javascript
// In adrData (already available)
adrData = {
  midPrice: 1.0850,    // Daily open
  adrHigh: 1.0920,     // Open + ADR/2
  adrLow: 1.0780,      // Open - ADR/2
  adrValue: 0.0070     // 70 pips (adrHigh - adrLow)
}
```

---

## Final Implementation: ADR Conversion Method

### Function Signature

```javascript
export function calculateSigmaMarkers(adrData) {
  // Input: adrData (already have)
  // Output: { oneSigmaUpper, oneSigmaLower, twoSigmaUpper, twoSigmaLower, sigmaValue }

  const sigmaValue = (adrData.adrHigh - adrData.adrLow) * 0.875;
  const midPrice = adrData.midPrice;

  return {
    oneSigmaUpper: midPrice + sigmaValue,
    oneSigmaLower: midPrice - sigmaValue,
    twoSigmaUpper: midPrice + (sigmaValue * 2),
    twoSigmaLower: midPrice - (sigmaValue * 2),
    sigmaValue
  };
}
```

### Data Flow Diagram

```
Existing ADR Data
  ↓
Extract: adrValue = adrHigh - adrLow
  ↓
Apply: sigmaValue = adrValue × 0.875
  ↓
Calculate: ±1σ and ±2σ from midPrice
  ↓
Render: Dashed/dotted lines at those prices
```

---

## Summary

**Question:** What data and methods would sigma use for its calc?

**Answer:**

| Item | Value |
|------|-------|
| **Data source** | Existing ADR (adrHigh, adrLow, midPrice) |
| **Method** | ADR × 0.875 conversion |
| **New data needed** | None |
| **New backend work** | None |
| **Computation** | Single multiplication |
| **Validation** | Empirically validated (Robert Carver study) |

**We're not calculating σ from scratch. We're converting ADR to σ-equivalent using a proven factor.**

This gives traders the familiar σ scale without requiring new data infrastructure.
