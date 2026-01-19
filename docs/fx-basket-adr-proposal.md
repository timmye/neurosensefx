# FX Basket ADR: Historical Reconstruction Proposal

## Executive Summary

**Problem:** Calculated basket ADR (~0.93%) shows 3x discrepancy with observed typical moves (~0.3%). This is because:
- ADR is a single-instrument concept misapplied to a diversified portfolio
- Current formula ignores correlation and structural cancellation in baskets
- 0.93% is a theoretical maximum, not expected value

**Solution:** Reconstruct historical basket data from available OHLC bars to determine actual typical ranges immediately.

---

## Background

### The 3x Discrepancy Explained

| Metric | Value | Meaning |
|--------|-------|---------|
| Calculated ADR | ~0.93% | Σ(weight_i × ADR_i) assumes all pairs move together |
| Observed typical | ~0.3% | Actual daily moves after diversification |
| Reduction factor | 3x | Diversification + structural cancellation |

### Why This Happens

USD basket pairs move in OPPOSITE directions when USD strengthens:

```
EURUSD down  → adjustedPrice = 1/1.0850 = 0.922  (USD up)
USDJPY up    → adjustedPrice = 149.50/149.00 = 1.003  (USD up)
GBPUSD down  → adjustedPrice = 1/1.2650 = 0.791  (USD up)
```

In the weighted sum: these partially cancel, reducing overall basket movement.

---

## Historical Data Availability

### Question: Can we get historical basket data?

**Answer: YES.** Historical OHLC bars are fully available via the cTrader API.

### API Capability (Verified)

The backend already implements historical OHLC fetching:

```javascript
// From: services/tick-backend/CTraderSession.js:228-242
async getSymbolDataPackage(symbolName, adrLookbackDays = 14) {
    const dailyBarsData = await this.connection.sendCommand('ProtoOAGetTrendbarsReq', {
        ctidTraderAccountId: this.ctidTraderAccountId,
        symbolId,
        period: 'D1',  // Daily timeframe
        fromTimestamp: fromDaily,
        toTimestamp: to
    });
}
```

### Available Data

| Parameter | Value | Notes |
|-----------|-------|-------|
| **Endpoint** | `ProtoOAGgetTrendbarsReq` | Already in production |
| **Timeframes** | M1, M5, M15, M30, H1, H4, D1, W1, MN1 | D1 sufficient for ADR |
| **Daily limit** | Up to 1 year (365 days) | Per API constraints |
| **Data points** | open, high, low, close, volume, timestamp | Complete OHLC |
| **Pairs covered** | All 28 FX pairs in baskets | USD, EUR, JPY, GBP, AUD, CAD, CHF, NZD |

### Reconstruction Approach

Since daily OHLC bars are available for all 28 pairs, we can reconstruct historical basket values:

```
For each historical day:
  1. Fetch D1 bars for all 28 pairs
  2. Calculate basket open  = Σ(weight_i × pair_open_i)
  3. Calculate basket high  = Σ(weight_i × pair_high_i)
  4. Calculate basket low   = Σ(weight_i × pair_low_i)
  5. Calculate basket close = Σ(weight_i × pair_close_i)
  6. Daily range = high - low
  7. Accumulate statistics across all days
```

This yields **immediate empirical results** without waiting for forward data collection.

---

## Proposed Solution: Historical Basket Reconstructor

### Architecture

```
┌─────────────────────┐      ProtoOAGetTrendbarsReq      ┌──────────────┐
│  Reconstructor      │ ◄─────────────────────────────────► │  cTrader API  │
│  (standalone CLI)   │   request D1 bars × 28 pairs        │              │
└──────────┬──────────┘                                      └──────────────┘
           │
           ├──► Calculate basket values per day (historical)
           │
           ├──► Compute daily ranges (high - low)
           │
           └──► Output statistics to JSON file
```

### Data Structure

Per basket (USD, EUR, JPY, GBP, AUD, CAD, CHF, NZD):

```javascript
{
  date: "2025-01-19",
  currency: "USD",
  open: 100.00,           // Normalized to daily open
  high: 100.28,           // Daily maximum
  low: 99.85,             // Daily minimum
  close: 100.12,          // End of day
  range: 0.43,            // high - low (as %)
  pairsAvailable: 28,     // All pairs present
  timestamp: "2025-01-19T17:00:00Z"
}
```

### Output Statistics

After reconstruction (e.g., 90 days):

```json
{
  "collectionPeriod": {
    "start": "2024-10-21",
    "end": "2025-01-19",
    "days": 90
  },
  "baskets": {
    "USD": {
      "dailyRanges": [0.28, 0.35, 0.12, 0.41, 0.19, ...],
      "statistics": {
        "median": 0.27,      // 50th percentile — "typical" day
        "p95": 0.42,         // 95th percentile — "extreme" threshold
        "max": 0.51,         // Historical extreme
        "mean": 0.28,
        "min": 0.08,
        "stddev": 0.11
      }
    },
    "EUR": {
      "dailyRanges": [0.31, 0.28, 0.15, 0.38, 0.22, ...],
      "statistics": {
        "median": 0.26,
        "p95": 0.39,
        "max": 0.45,
        "mean": 0.27
      }
    }
    // ... JPY, GBP, AUD, CAD, CHF, NZD
  }
}
```

---

## Implementation

### Script: Historical Basket Reconstructor

**Location:** `/scripts/basket-historical-reconstructor.cjs`

**Implementation:** ~120 lines

```javascript
const { CTraderConnection } = require('../libs/cTrader-Layer');
const { BASKET_DEFINITIONS } = require('../src/lib/fxBasket/fxBasketConfig.js');
const { calculateBasketValue } = require('../src/lib/fxBasket/fxBasketCalculations.js');

async function reconstructHistoricalBaskets(days = 90) {
    // 1. Connect to cTrader API
    const connection = new CTraderConnection({ /* credentials */ });
    await connection.connect();

    // 2. Fetch symbol IDs for all 28 pairs
    const allPairs = getAllPairsFromBaskets(BASKET_DEFINITIONS);
    const symbolIds = await getSymbolIds(connection, allPairs);

    // 3. Fetch D1 bars for each pair
    const historicalData = {};
    for (const pair of allPairs) {
        const bars = await fetchDailyBars(connection, symbolIds[pair], days);
        historicalData[pair] = bars;
    }

    // 4. Reconstruct basket values for each day
    const baskets = {};
    for (const currency of Object.keys(BASKET_DEFINITIONS)) {
        baskets[currency] = reconstructCurrencyBasket(
            currency,
            BASKET_DEFINITIONS[currency],
            historicalData
        );
    }

    // 5. Calculate statistics
    const statistics = calculateBasketStatistics(baskets);

    return statistics;
}

function reconstructCurrencyBasket(currency, basketDef, historicalData) {
    const days = Object.keys(historicalData[Object.keys(historicalData)[0]]);

    return days.map(day => {
        const pairsData = {};

        basketDef.pairs.forEach(({ symbol, weight }) => {
            const bar = historicalData[symbol][day];
            pairsData[symbol] = {
                open: bar.open,
                high: bar.high,
                low: bar.low,
                close: bar.close,
                weight: weight
            };
        });

        const basketOpen = calculateBasketValue(pairsData, 'open');
        const basketHigh = calculateBasketValue(pairsData, 'high');
        const basketLow = calculateBasketValue(pairsData, 'low');
        const basketClose = calculateBasketValue(pairsData, 'close');

        return {
            date: day,
            currency,
            open: basketOpen,
            high: basketHigh,
            low: basketLow,
            close: basketClose,
            range: basketHigh - basketLow
        };
    });
}
```

### Usage

```bash
# Run reconstructor
node scripts/basket-historical-reconstructor.cjs --days 90

# Output
# → data/fx-basket-historical-analysis.json
```

### Isolation from Main App

This script is **completely standalone**:
- No browser required
- No UI components
- No WebSocket server needed
- Direct cTrader API connection
- Outputs to JSON file for analysis

---

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Development | 0.5 day | Reconstructor script |
| Data Fetching | ~5 minutes | 90 days of historical data |
| Analysis | 0.5 day | Statistics, percentiles |
| Optional Integration | 1 day | Display empirical ADR on basket UI |

**Total: 1-2 days** (vs. 30+ days for forward collection)

---

## Expected Outcomes

### What We Learn

1. **Empirical basket ADR:** Actual typical daily range per basket (from 90 days)
2. **Basket personality:** Which baskets are more/less volatile?
3. **Extreme thresholds:** What constitutes an "unusual" move?
4. **Validation:** Does ~0.3% hold as typical? Or is it different?
5. **Seasonality:** Any patterns across different market conditions?

### Potential Findings

| Hypothesis | If True | Implication |
|------------|---------|-------------|
| USD median ~0.3% | Confirmed | User observation is accurate |
| EUR > USD volatility | True | Different currencies have different profiles |
| JPY most volatile | True | Safe-haven currency shows larger swings |
| Ranges vary by session | True | May need session-specific thresholds |
| 0.93% never approached | True | Remove ADR concept, use empirical ranges only |

### Decision Points After Analysis

1. **If ranges are consistent (~0.2-0.4%):** Display fixed thresholds (e.g., "0.3% = typical day")
2. **If ranges vary widely:** Display dynamic percentile (e.g., "Today: P75")
3. **If calculated 0.93% is never approached:** Remove ADR concept entirely from UI
4. **If extreme days >1% occur:** ADR may be relevant for outliers only

---

## Integration to Main Display (Optional)

Once historical statistics exist:

```javascript
// fxBasketOrchestrator.js (hypothetical integration)
if (basketStatistics) {
    const stats = basketStatistics[currency];
    const currentRange = todayHigh - todayLow;
    const percentile = calculatePercentile(currentRange, stats.dailyRanges);

    // Display: "USD: +0.15% (P62 today, median: 0.27%)"
    // Color-code: Green if < P50, Yellow if P50-75, Red if > P95
}
```

---

## Open Questions

1. **How many days?** 90 days suggested, but could extend to 180-365 for more significance
2. **Market conditions?** Historical data captures whatever conditions existed — may need to annotate events
3. **Session breakdown?** Should we analyze London vs NY vs Asian separately? (requires intraday data)
4. **Refresh frequency?** Re-run weekly/monthly to update statistics with recent data?

---

## Next Steps

1. **Confirm approach:** Historical reconstruction acceptable?
2. **Develop script:** ~120 lines, reuses existing `fxBasketCalculations.js`
3. **Test locally:** Verify basket values match main display calculations
4. **Run analysis:** Fetch 90 days, compute statistics
5. **Review findings:** Analyze results, determine display strategy
6. **Optional:** Integrate empirical ADR into basket UI

---

## Appendix: Key Code Reference

**Reused from existing code:**
- `/src/lib/fxBasket/fxBasketCalculations.js` — `calculateBasketValue()`, `normalizeToBaseline()`
- `/src/lib/fxBasket/fxBasketConfig.js` — `BASKET_DEFINITIONS`
- `/services/tick-backend/CTraderSession.js` — Reference for `ProtoOAGetTrendbarsReq` usage

**New files to create:**
- `/scripts/basket-historical-reconstructor.cjs` — Main reconstruction script
- `/scripts/basket-statistics-analyzer.js` — Statistics calculation utilities

**No modifications to existing code required.**

---

## Advantages Over Forward Collection

| Aspect | Forward Collection | Historical Reconstruction |
|--------|-------------------|--------------------------|
| **Time to results** | 30+ days | Immediate (~5 minutes) |
| **Infrastructure** | Browser must stay open | One-time CLI execution |
| **Data points** | Limited by collection time | Up to 365 days available |
| **Market coverage** | Only future conditions | Historical variety |
| **Reliability** | Subject to interruptions | Fetched once, complete |
| **Iteration speed** | Slow (must wait 30 days) | Fast (can re-run anytime) |
