# Sigma Magnitudes in Plain Language

## The Normal Distribution Rule

For normally distributed data (bell curve), sigma (σ) tells us how likely a value is:

| Sigma Range | % of Data Inside This Range | Plain Language |
|-------------|---------------------------|----------------|
| ±1σ | **68.2%** | 7 out of 10 days fall here |
| ±2σ | **95.4%** | 19 out of 20 days fall here |
| ±3σ | **99.7%** | 369 out of 370 days fall here |

**What this means:** If price movement follows a normal distribution, most days will be within 1σ of the average.

---

## Sigma Levels for Your ADR Meter

Remember: Your σ value represents **magnitude of movement**, not location from a mean. But the same probability logic applies.

| σ Level | ADR % | How Often | Plain Language |
|---------|-------|-----------|----------------|
| **0.5σ** | ~57% | ~38% of days | Typical quiet day - nothing unusual |
| **1.0σ** | ~114% | ~16% of days | Full movement - price covered expected range |
| **1.5σ** | ~171% | ~7% of days | Active day - wider than normal |
| **2.0σ** | ~229% | ~2% of days | Unusual - happens 1 in 50 days |
| **2.5σ** | ~286% | ~1% of days | Rare - happens 1 in 100 days |
| **3.0σ** | ~343% | ~0.1% of days | Very rare - happens 1 in 370 days |

---

## Interpreting Daily Movement

### What You'll Typically See

```
Most common (68% of days):
0σ to 1σ movement (0% to 114% ADR)

Fairly common (95% of days):
0σ to 2σ movement (0% to 229% ADR)

Almost always (99.7% of days):
0σ to 3σ movement (0% to 343% ADR)
```

### In Practice

| Observation | Frequency | Trader Action |
|-------------|-----------|---------------|
| "Price is at 0.5σ (57% ADR)" | Happens often | Normal trading conditions |
| "Price is at 1.0σ (114% ADR)" | ~1 in 6 days | Full range day, expected |
| "Price is at 1.5σ (171% ADR)" | ~1 in 14 days | Elevated vol, widen stops |
| "Price is at 2.0σ (229% ADR)" | ~1 in 50 days | Unusual, be cautious |
| "Price is at 3.0σ (343% ADR)" | ~1 in 370 days | **Black swan territory** |

---

## Common Misconceptions

### ❌ Wrong: "Price usually sits within 1σ"

**Correction:** Price **movement** usually falls within 1σ of the **typical daily movement**.

Your ADR meter starts at 0 (daily open) and measures outward. So:

- **0σ** = No movement (open = current, doesn't happen in practice)
- **0.5σ** = Half the typical dispersion
- **1.0σ** = Full typical dispersion
- **2.0σ** = Double the typical dispersion

### ✅ Right: "Daily movement is usually within 1σ of typical"

```
Typical day: 0.5σ to 1.0σ movement (57% to 114% ADR)
Quiet day: < 0.5σ movement (< 57% ADR)
Active day: > 1.0σ movement (> 114% ADR)
Unusual day: > 2.0σ movement (> 229% ADR)
```

---

## Real-World Interpretation

### EURUSD Example (ADR = 70 pips, σ = 61 pips)

| Movement | ADR % | σ Value | Interpretation |
|----------|-------|---------|----------------|
| 30 pips | 43% | 0.38σ | Quiet day, early session |
| 50 pips | 71% | 0.62σ | Normal trading |
| 70 pips | 100% | 0.88σ | Full average day |
| 80 pips | 114% | 1.0σ | Statistically significant |
| 120 pips | 171% | 1.5σ | High volatility day |
| 160 pips | 229% | 2.0σ | Rare event (1 in 50) |

---

## The "Fat Tail" Reality

**Important caveat:** Markets are NOT perfectly normal distributions.

Real markets have **"fat tails"** - extreme events happen more often than the bell curve predicts.

| Sigma | Normal Distribution | Real Markets |
|-------|-------------------|--------------|
| ±2σ | 4.6% of days | ~5-10% of days |
| ±3σ | 0.3% of days | ~1-3% of days |
| ±4σ | 0.006% of days | ~0.1-1% of days |

**Translation:** Don't be surprised if you see 2σ+ movements more often than 1 in 50 days. Markets are wilder than the normal distribution assumes.

---

## Quick Reference Card

### Sigma Cheat Sheet for Traders

```
0.3σ or less: Very quiet, low vol
0.3σ - 0.7σ: Normal trading conditions
0.7σ - 1.2σ: Full range, active trading
1.2σ - 2.0σ: Elevated vol, wider stops recommended
2.0σ - 3.0σ: Unusual, reduce position size
3.0σ+: Rare event, extreme caution
```

### ADR % Cheat Sheet

```
< 40% ADR: Quiet day, tight ranges
40% - 80% ADR: Normal trading
80% - 120% ADR: Full range day
120% - 200% ADR: High volatility
200%+ ADR: Extreme event
```

---

## Summary

| Question | Answer |
|----------|--------|
| **Will price usually be within 1σ?** | **Yes**, movement typically 0-1σ (0-114% ADR) |
| **Is 1σ a "normal" day?** | Yes, 1σ = full expected movement |
| **Is 2σ unusual?** | Yes, happens ~1 in 50 days theoretically, more often in reality |
| **What's a "big" day?** | 2σ+ (229% ADR or more) |
| **What's a "quiet" day?** | < 0.5σ (57% ADR or less) |

---

## Key Takeaway

**"1σ" doesn't mean a boundary.** It means "typical daily dispersion." Your meter shows how today's movement compares to that typical dispersion.

- **Below 1σ:** Smaller movement than usual
- **Around 1σ:** About what you'd expect
- **Above 1σ:** Larger movement than usual
- **Way above 1σ:** Unusual, rare, or news-driven
