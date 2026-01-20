# Sigma Magnitudes Explained: ADR Context

## The Conceptual Mismatch

### Traditional Standard Deviation (σ)

Standard deviation measures **dispersion around a mean/average**:

```
σ calculation over N days:
1. Calculate mean of closing prices: μ = mean(close_1, close_2, ..., close_N)
2. Measure average deviation from μ: σ = sqrt(Σ(close - μ)² / N)
```

**Key point:** σ answers "how far do prices typically deviate from the **average price**?"

- If price is at +1σ, it's 1 standard deviation **above the mean price**
- The mean is a statistical center, not necessarily today's open
- σ is about **location relative to average**, not distance traveled

---

### Your ADR Implementation

Your ADR meter measures **distance from daily open**:

```
ADR calculation:
1. Daily open = baseline (0%)
2. High-low range = actual distance traveled
3. ADR = average of high-low ranges over 14 days
4. Current ADR% = (distance from open) / ADR
```

**Key point:** ADR answers "how far has price moved from **today's open**?"

- 100% ADR means price has moved the full average daily range
- Symmetrical: +50% ADR (up) and -50% ADR (down) are equal distances
- ADR is about **magnitude of movement**, not location relative to mean

---

## Why the Conversion Works (and What It Means)

### The 0.875 Factor Relates Magnitudes, Not Locations

When Robert Carver found `σ = ATR × 0.875`, he was comparing:

| Measure | What It Captures | Reference Point |
|---------|------------------|-----------------|
| **ATR** | Average distance traveled (high-low) | Daily open (implicitly) |
| **σ** | Average dispersion from mean | Mean of closing prices |

The 0.875 factor says: **"The typical dispersion (σ) is about 87.5% of the typical range (ATR)"**

This is a **magnitude relationship**, not a location conversion.

---

## What "1σ" Means in Different Contexts

### Traditional Context (Bollinger Bands, etc.)

```
Price = 1.1050
Mean (μ) = 1.1000
σ = 0.0050

If price = 1.1050 → price is at +1σ (above mean)
If price = 1.0950 → price is at -1σ (below mean)
```

**Interpretation:** Price is statistically far from its average.

---

### Your ADR Context (After Conversion)

```
Daily Open = 1.1000
ADR = 70 pips (0.0070)
Current Price = 1.1070 (moved +70 pips)

ADR% = 100%
σ-equivalent = 0.88σ
```

**Interpretation:** Price has moved a distance equal to 0.88 standard deviations of typical dispersion.

**NOT:** "Price is 0.88σ above some mean"
**RATHER:** "The distance traveled equals 0.88× the typical daily dispersion"

---

## The Symmetry Consideration

### Your ADR is Symmetrical

```
Daily Open = 1.1000

+50% ADR = 1.1035 (up 35 pips)
-50% ADR = 1.0965 (down 35 pips)

Both are equal distances from open.
```

This works because:
- Distance is always positive (magnitude)
- Direction is handled by + or - sign
- The scale is the same in both directions

### Traditional σ is Also Symmetrical (Around Mean)

```
μ = 1.1000
σ = 50 pips

+1σ = 1.1050 (50 pips above mean)
-1σ = 1.0950 (50 pips below mean)

Both are equal distances from mean.
```

### The Key Difference

| Aspect | ADR | σ |
|--------|-----|---|
| **Reference point** | Daily open (changes each day) | Mean (stable over lookback) |
| **What's measured** | Distance traveled | Deviation from average |
| **Baseline** | 0% at open (resets daily) | 0σ at mean (statistical center) |
| **Interpretation** | "How far did we move?" | "How unusual is this location?" |

---

## Practical Implications for Your Display

### When You Show "100% ADR (0.88σ)"

You're saying:

```
"The distance from open equals:
- 100% of the average daily range
- 0.88× the typical daily standard deviation"
```

This is a **magnitude comparison**, not a location statement.

### Traders Should Interpret As:

| Display | Meaning |
|---------|---------|
| `50% ADR (0.44σ)` | Typical quiet day - price moved half the usual range |
| `100% ADR (0.88σ)` | Full average day - price moved the expected amount |
| `114% ADR (1.0σ)` | Unusual - price moved 1σ worth of distance |
| `200% ADR (1.75σ)` | Very unusual - price moved almost 2σ worth of distance |

---

## Why This Still Matters

Even though the reference points differ (open vs. mean), the **σ-equivalent gives traders context**:

1. **"Is this movement unusual?"** - Yes, 1.75σ is unusual
2. **"How does today compare to typical volatility?"** - Direct comparison
3. **"Should I widen my stops?"** - If at 1.5σ+, probably yes

The fact that σ is calculated around a mean doesn't matter for this purpose - we're using σ as a **volatility yardstick**, not a location reference.

---

## The Mathematical Relationship

```
Let:
- ATR = average daily range = 70 pips
- σ = daily standard deviation = 61 pips (0.875 × 70)

Your meter:
- Price moves 35 pips from open
- ADR% = 35/70 = 50%
- σ-equivalent = 50% × 0.875 = 0.44σ

Interpretation:
- Price moved a distance equal to 0.44× the typical daily dispersion
- NOT: "Price is 0.44σ from some mean"
```

---

## Summary

| Question | Answer |
|----------|--------|
| **What does σ mean traditionally?** | Dispersion from mean price over N days |
| **What does ADR mean in your implementation?** | Distance from daily open relative to average range |
| **Why does the 0.875 conversion work?** | It relates magnitudes: typical dispersion ≈ 87.5% of typical range |
| **What does "100% ADR = 0.88σ" mean?** | The distance traveled equals 0.88× typical daily dispersion |
| **Is price at 0.88σ from the mean?** | **No** - that's not what it means |
| **What's the practical value?** | Gives traders a statistical yardstick for movement magnitude |

---

## Key Takeaway

**Your ADR meter and σ are measuring different things (distance vs. dispersion), but the 0.875 factor lets you express ADR distances in σ-units for familiarization.**

Traders who think in σ will understand "0.88σ of movement" as a volatility context, even though the calculation basis differs from traditional σ.
