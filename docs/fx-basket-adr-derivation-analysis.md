# FX Basket ADR Derivation Analysis

## Executive Summary

**Original Thesis:** Basket ADR can be mathematically derived from individual pair ADRs using ln-weighted propagation: `Basket_ADR_% ≈ Σ (w_i × ADR_i_%)`

**Empirical Validation:** 65 days of historical basket data proves this formula **overestimates by 6.6x** due to structural correlation effects.

**Verdict:** **REJECTED** — Use empirical historical tracking instead.

---

## 1. Original Derivation

### 1.1 Mathematical Formula

The ln-weighted basket value formula:
```
basket_value = exp( Σ[i=1 to 7] (w_i × ln(P_i)) )
```

**Proposed ADR propagation:**
```
Basket_ADR_% ≈ Σ (w_i × ADR_i_%)
```

### 1.2 Example Calculation (USD Basket)

| Pair | Weight | ADR | Price | ADR% | Contribution |
|------|--------|-----|-------|------|-------------|
| EURUSD | 0.20 | 0.0080 | 1.0850 | 0.74% | 0.148% |
| USDJPY | 0.15 | 1.20 | 149.50 | 0.80% | 0.120% |
| GBPUSD | 0.13 | 0.0120 | 1.2650 | 0.95% | 0.124% |
| AUDUSD | 0.10 | 0.0070 | 0.6650 | 1.05% | 0.105% |
| USDCAD | 0.30 | 0.0140 | 1.3550 | 1.03% | 0.309% |
| USDCHF | 0.07 | 0.0090 | 0.8750 | 1.03% | 0.072% |
| NZDUSD | 0.05 | 0.0060 | 0.6250 | 0.96% | 0.048% |
| **SUM** | 1.00 | - | - | - | **0.93%** |

**Predicted USD Basket ADR: 0.93%**

---

## 2. Empirical Validation

### 2.1 Methodology

**Tool:** `/scripts/basket-historical-reconstructor.cjs`

**Data Source:** cTrader API D1 bars (daily OHLC)

**Collection Period:** 2025-10-15 to 2026-01-15 (65 trading days)

**Method:**
1. Fetch D1 bars for all 28 pairs
2. Calculate basket value per day: `basket_value = exp(Σ w_i × ln(adjusted_price_i))`
3. Calculate daily range: `|close - open|` as percentage
4. Compute statistics: median, P95, max, stddev

### 2.2 Results: Predicted vs. Actual

| Basket | Predicted (Formula) | Actual Median | Actual Max | Error Factor |
|--------|---------------------|---------------|------------|--------------|
| USD | 0.93% | **0.14%** | 0.61% | **6.6x** |
| EUR | ~0.93% | **0.11%** | 0.33% | **8.5x** |
| JPY | ~0.93% | **0.24%** | 1.36% | **3.9x** |
| GBP | ~0.93% | **0.14%** | 0.83% | **6.6x** |
| AUD | ~0.93% | **0.22%** | 0.63% | **4.2x** |
| CAD | ~0.93% | **0.11%** | 0.97% | **8.5x** |
| CHF | ~0.93% | **0.15%** | 0.56% | **6.2x** |
| NZD | ~0.93% | **0.16%** | 1.22% | **5.8x** |

**Average Overestimation: 6.2x**

### 2.3 Detailed USD Basket Statistics

```
Collection Period: 65 trading days
Median:            0.14%  (typical day)
Mean:              0.18%
P95:               0.46%  (extreme threshold)
Max:               0.61%  (historical extreme)
Min:               0.00%
StdDev:            0.14%
```

**Comparison:**
- Predicted: 0.93%
- Actual Median: 0.14% (6.6x lower)
- Actual P95: 0.46% (2.0x lower)
- Actual Max: 0.61% (1.5x lower)

---

## 3. Root Cause Analysis

### 3.1 Why the Formula Failed

**The Formula's Assumption:**
```
All pairs move in the SAME direction
→ Volatility adds linearly
→ Basket ADR = Σ(w_i × ADR_i)
```

**Reality:**
```
Basket pairs move in OPPOSITE directions
→ Volatility cancels in ln-space
→ Basket ADR << Σ(w_i × ADR_i)
```

### 3.2 Structural Cancellation Example

When USD strengthens by 1%:

| Pair | Movement | Adjusted Price | ln(Price) | Weighted Contribution |
|------|----------|----------------|-----------|----------------------|
| EURUSD | -1.0% | 0.99 | -0.0101 | 0.20 × (-0.0101) = **-0.0020** |
| USDJPY | +1.0% | 1/151.48 = 0.0066 | -5.0238 | 0.15 × (-5.0238) = **-0.7536** |
| GBPUSD | -1.0% | 0.99 | -0.0101 | 0.13 × (-0.0101) = **-0.0013** |

**Key Insight:** When a pair is inverted (1/price), the ln becomes negative:
```
ln(1/x) = -ln(x)
```

Pairs that start with the basket currency (USDJPY, USDCAD, USDCHF) are inverted, creating **negative correlations** that cancel out positive movements from pairs like EURUSD, GBPUSD.

### 3.3 Correlation Structure

**USD Basket Pair Correlations (simplified):**

| Pair | Correlation to USD Strength | Effect on Basket |
|------|----------------------------|------------------|
| EURUSD | **Negative** | Inverted, ln < 0 |
| GBPUSD | **Negative** | Inverted, ln < 0 |
| AUDUSD | **Negative** | Inverted, ln < 0 |
| NZDUSD | **Negative** | Inverted, ln < 0 |
| USDJPY | **Positive** | Direct, ln > 0 |
| USDCAD | **Positive** | Direct, ln > 0 |
| USDCHF | **Positive** | Direct, ln > 0 |

**Net Effect:** When USD strengthens, 4 pairs go down (inverted) and 3 pairs go up (direct). The ln-weighted sum creates partial cancellation, reducing overall basket volatility.

---

## 4. Quantitative Analysis

### 4.1 Error Breakdown

| Metric | Value |
|--------|-------|
| **Predicted USD ADR** | 0.93% |
| **Actual USD Median** | 0.14% |
| **Absolute Error** | 0.79% |
| **Relative Error** | 564% |
| **Error Factor** | 6.6x |
| **Formula Accuracy** | 15% |

### 4.2 Volatility Spectrum

The formula fails differently across baskets based on correlation structure:

| Basket | Error Factor | Explanation |
|--------|--------------|-------------|
| EUR/CAD | 8.5x | Highest cancellation (most pairs inverted) |
| USD/GBP | 6.6x | Moderate cancellation |
| JPY | 3.9x | Lower cancellation (safe-haven behavior) |
| NZD | 5.8x | Commodity currency effects |

---

## 5. Recommendations

### 5.1 DO NOT USE Derived ADR Formula

**Reasons:**
1. **Systemic overestimation:** 6.2x average error
2. **No calibration path:** Error is structural (correlation), not statistical
3. **User impact:** Would display "EXTREME" on normal days
4. **No fix possible:** Correlation effects are inherent to basket construction

### 5.2 USE Empirical Historical Tracking

**Implementation:**

```javascript
// Calculate daily basket range
const basketOpen = calculateBasketValue(currency, openPrices);
const basketClose = calculateBasketValue(currency, closePrices);
const dailyRange = Math.abs(normalizeToBaseline(basketClose, basketOpen) - 100);

// Track last 20-90 days
const historicalRanges = [/* ... */];
const median = calculateMedian(historicalRanges);
const p95 = calculatePercentile(historicalRanges, 0.95);

// Display
const currentRange = /* today's range */;
const percentile = calculatePercentileRank(currentRange, historicalRanges);
console.log(`USD: ${currentRange.toFixed(2)}% (P${Math.round(percentile * 100)})`);
```

**Reference Values (from 65-day analysis):**

| Basket | Median | P95 | Quiet | Normal | Active | Extreme |
|--------|--------|-----|-------|--------|--------|---------|
| USD | 0.14% | 0.46% | <0.05% | 0.05-0.45% | 0.45-0.46% | >0.46% |
| EUR | 0.11% | 0.24% | <0.05% | 0.05-0.24% | 0.24-0.24% | >0.24% |
| JPY | 0.24% | 0.72% | <0.10% | 0.10-0.70% | 0.70-0.72% | >0.72% |
| GBP | 0.14% | 0.61% | <0.05% | 0.05-0.60% | 0.60-0.61% | >0.61% |
| AUD | 0.22% | 0.58% | <0.10% | 0.10-0.55% | 0.55-0.58% | >0.58% |
| CAD | 0.11% | 0.41% | <0.05% | 0.05-0.40% | 0.40-0.41% | >0.41% |
| CHF | 0.15% | 0.48% | <0.05% | 0.05-0.45% | 0.45-0.48% | >0.48% |
| NZD | 0.16% | 0.55% | <0.07% | 0.07-0.50% | 0.50-0.55% | >0.55% |

### 5.3 Implementation Steps

1. **Use existing script:** `/scripts/basket-historical-reconstructor.cjs`
2. **Run periodically:** Daily or weekly to update statistics
3. **Store results:** JSON file with historical ranges
4. **Display percentiles:** "P72" or zone indicators (QUIET/NORMAL/ACTIVE/EXTREME)
5. **20-day warm-up:** Acceptable for accurate statistics

---

## 6. Key Learnings

### 6.1 Mathematical vs. Empirical

| Aspect | Mathematical Derivation | Empirical Reality |
|--------|------------------------|-------------------|
| Assumptions | Perfect positive correlation | Strong negative correlation |
| Formula | Σ(w_i × ADR_i) | Actual behavior |
| Result | 0.93% | 0.14% |
| Validity | Mathematically sound | Empirically false |

**Lesson:** Mathematical correctness ≠ Empirical validity when assumptions don't match reality.

### 6.2 Correlation Effects

**Individual pair ADR:** Measures single-instrument volatility

**Basket ADR:** Measures portfolio volatility after diversification

**Relationship:** NOT linear. Diversification creates cancellation effects that cannot be derived from individual volatilities alone.

### 6.3 The 3x Discrepancy Explained

Original observation: ~0.3% typical movement vs. 0.93% calculated

**Empirical finding:** 0.14% median (6.6x lower than calculated)

**Root cause:**
1. **Structural cancellation:** Inverted pairs create negative correlations
2. **Ln-weighting:** Exaggerates cancellation (ln(1/x) = -ln(x))
3. **Diversification:** 7 pairs spread risk, reducing net volatility

---

## 7. Conclusion

**The derivation formula is fundamentally flawed for basket ADR calculation.**

While mathematically sound under the assumption of perfect positive correlation, this assumption is violently violated by the actual correlation structure of FX baskets. The formula overestimates by 6.2x on average.

**Correct approach:** Use empirical historical tracking with the validated results from `/docs/fx-basket-historical-results.md`.

**Final recommendation:**
- ❌ DO NOT implement derived ADR formula
- ✅ USE empirical basket ADR tracking
- ✅ DISPLAY percentile-based indicators
- ✅ REFERENCE historical medians (USD: 0.14%, EUR: 0.11%, JPY: 0.24%, etc.)

---

## Appendix: Reference Data

### A.1 Full Statistical Summary

See `/workspaces/neurosensefx/docs/fx-basket-historical-results.md` for complete statistical tables, volatility rankings, and implementation guidance.

### A.2 Raw Data

Historical basket data: `/workspaces/neurosensefx/data/fx-basket-historical-analysis.json`

Reconstruction script: `/workspaces/neurosensefx/scripts/basket-historical-reconstructor.cjs`
