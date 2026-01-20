# ADR to Standard Deviation Conversion

## Empirical Study Reference

**Source:** Robert Carver, ["The relationship between ATR and standard deviation"](https://qoppac.blogspot.com/2018/12/the-relationship-between-atr-and.html), 2018

**Author:** Professional systematic trader, author of "Smart Portfolios" and "Systematic Trading"

---

## The Empirical Finding

> "I ran this over a whole bunch of futures contracts, and the magic number I got was **0.875**. Basically if you have an ATR and you want to convert it to a daily standard deviation, then you multiply the ATR by **0.875**."

### Conversion Formulas

```
σ_daily = ATR × 0.875
ATR = σ_daily × 1.14

For annualised σ:
σ_annual = ATR × 14
```

---

## Theoretical Derivation

The 0.875 factor comes from two adjustments:

### Adjustment 1: Squaring vs. Averaging

Standard deviation squares, averages, then square-roots. ATR just averages absolute values.

For Gaussian returns, this gives a ratio of **1.255**:

```
SD_close_only = ATR × 1.255
```

### Adjustment 2: Range vs. Close-to-Close

ATR uses high-low (captures intraday extremes). SD uses close-to-close (misses intraday movement).

This requires multiplying SD by Y ≥ 1:

```
ATR = SD_close_only × Y
```

### Combined Formula

```
SD = ATR × 1.255 / Y

Where Y ≈ 1.43 (empirically determined)

SD = ATR × 1.255 / 1.43
SD = ATR × 0.875 ✓
```

**Note:** Y ≈ 1.43 is "damn close to √2" — may have theoretical significance.

---

## Practical Examples

### Typical FX Pairs (14-day ADR)

| Pair | 14-day ADR | 20-day σ | Relationship |
|------|-----------|----------|--------------|
| EURUSD | 70 pips | ~61 pips | 1 ADR ≈ 1.14σ |
| GBPUSD | 110 pips | ~96 pips | 1 ADR ≈ 1.14σ |
| USDJPY | 85 pips | ~74 pips | 1 ADR ≈ 1.14σ |

### Day Range Meter Conversion

| ADR % | In σ | Statistical Meaning |
|-------|------|-------------------|
| 50% | 0.44σ | Within normal range |
| 75% | 0.66σ | Approaching 1σ |
| 100% | 0.88σ | Near 1σ movement |
| 114% | 1.0σ | Statistically significant |
| 150% | 1.31σ | Unusual (outside 1σ) |
| 200% | 1.75σ | Very unusual (~95th percentile) |

---

## Rule of Thumb for Traders

```
Quick Conversion:
- ADR % × 0.875 = σ value
- σ value × 1.14 = ADR %

Examples:
- 50% ADR = 0.44σ (typical quiet day)
- 100% ADR = 0.88σ (full average day)
- 114% ADR = 1.0σ (statistically significant)
- 200% ADR = 1.75σ (very unusual)
```

---

## NeuroSense FX Implementation

### Current Implementation (ADR-only)

**File:** `/src/lib/dayRangeCalculations.js`

- 14-day lookback ADR
- Progressive disclosure: 50% → 75% → 100%+
- Symmetric scaling around daily open

### Potential Enhancement: Add σ Display

```javascript
// Simple conversion function
const sigmaFromADR = (adrPercentage) => (adrPercentage * 0.875).toFixed(2);

// Display format options:
// 1. Both: "EURUSD: +45 pips (64% ADR, 0.56σ)"
// 2. Toggleable: "EURUSD: +45 pips [0.56σ]" or "[64% ADR]"
```

### Why This Helps Traders

1. **Statistical context:** "1.2σ" immediately signals "unusual"
2. **Cross-asset comparison:** σ is universal across markets
3. **Options traders:** Think in σ terms for implied volatility
4. **Risk management:** Position sizing often uses σ

---

## Key Differences: ADR vs Standard Deviation

| Dimension | ADR | Standard Deviation |
|-----------|-----|-------------------|
| **What it measures** | High-low range per day | Dispersion of closing prices |
| **Data used** | Daily OHLC (high-low) | Closing prices or log returns |
| **Captures** | Actual trading range | Volatility around mean |
| **Best for** | "Will price hit my target?" | "Is this move statistically unusual?" |
| **Professional adoption** | Retail favorite | Professional favorite |
| **Complexity** | Simple, intuitive | Statistical, abstract |

---

## Sources

1. **[The relationship between ATR and standard deviation](https://qoppac.blogspot.com/2018/12/the-relationship-between-atr-and.html)** - Robert Carver (empirical study on futures contracts)
2. **[How does ATR relate to standard deviation?](https://www.quora.com/How-does-ATR-relate-to-standard-deviation-Its-my-understanding-that-1-SD-equals-roughly-0-875-ATR-Does-that-mean-that-1-75-ATR-accounts-for-approximately-95-of-an-equity-s-price-fluctuation)** - Quora discussion confirming the 0.875 factor
3. **[Standard Deviation in Trading](https://blog.quantinsti.com/standard-deviation/)** - QuantInsti guide to stdev in trading

---

## Notes

- The 0.875 factor is empirically derived from futures contracts
- ADR (Average Daily Range) is conceptually similar to ATR (Average True Range)
- For spot forex (24-hour market), the conversion should still apply
- The factor may vary slightly by instrument class (equities, FX, commodities)
