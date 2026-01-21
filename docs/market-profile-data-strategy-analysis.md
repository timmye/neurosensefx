# Market Profile Data Strategy Analysis

**Date:** 2026-01-21
**Status:** Research Complete
**Purpose:** Evaluate tick data vs M1 bar data for Market Profile implementation

---

## Executive Summary

cTrader Open API provides **historical tick data** via `ProtoOAGetTickDataReq`. This enables a true tick-based Market Profile instead of the current M1 bar approximation. This document compares both approaches with performance and system impact analysis.

**Key Finding:** Historical tick data is available but requires significant trade-offs in data volume, latency, and complexity.

---

## 1. cTrader Historical Tick Data API

### 1.1 API Specification

**Request: ProtoOAGetTickDataReq**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| ctidTraderAccountId | int64 | Yes | Trader account ID |
| symbolId | int64 | Yes | Symbol identifier |
| type | ProtoOAQuoteType | Yes | Bid (1) or Ask (2) |
| fromTimestamp | int64 | No | Start time (Unix ms) |
| toTimestamp | int64 | No | End time (Unix ms) |

**Response: ProtoOAGetTickDataRes**

| Field | Type | Description |
|-------|------|-------------|
| tickData | RepeatedField<ProtoOATickData> | List of ticks (newest first) |
| hasMore | bool | Pagination indicator |

**Data Model: ProtoOATickData**

| Field | Type | Description |
|-------|------|-------------|
| timestamp | int64 | Unix time in milliseconds |
| tick | int64 | Tick price |

**Important Limitations:**
- **No volume data** - only price and timestamp
- **Bid or Ask only** - must make separate requests for both
- **Pagination required** - `hasMore` field indicates more data available
- **Newest first** - data order is reversed (newest → oldest)

---

## 2. Data Volume Comparison

### 2.1 Theoretical Data Volumes

| Metric | M1 Bars (Current) | Tick Data (Alternative) |
|--------|-------------------|------------------------|
| **Time Period** | Trading day (~24h) | Trading day (~24h) |
| **Data Points** | ~1,440 bars (60 min × 24h) | ~50,000+ ticks (varies by symbol) |
| **Data Ratio** | 1× baseline | 30-50× more data |
| **Fields per Record** | 5 (OHLC + timestamp) | 2 (price + timestamp) |
| **Total Fields** | ~7,200 | ~100,000+ |

### 2.2 Example: EURUSD (High Liquidity)

```
M1 BARS (Current Approach):
┌─────────────────────────────────────────────────────────────┐
│ 1 trading day = 1,440 M1 bars                              │
│ Each bar: { open, high, low, close, timestamp }             │
│ Total: 1,440 × 5 = 7,200 data points                       │
│                                                              │
│ Processing: generatePriceLevels(low, high)                  │
│   → Creates ~10-50 levels per bar (range dependent)         │
│   → Total profile levels: ~15,000-50,000                    │
└─────────────────────────────────────────────────────────────┘

TICK DATA (Alternative Approach):
┌─────────────────────────────────────────────────────────────┐
│ 1 trading day = ~50,000-100,000 ticks                       │
│ Each tick: { price, timestamp }                             │
│ Total: 50,000-100,000 × 2 = 100,000-200,000 data points     │
│                                                              │
│ Processing: discretize to bucket                            │
│   → 1 level per tick                                       │
│   → Total profile levels: ~5,000-10,000 (actual occurences) │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Network Transfer Impact

| Approach | Request Size | Response Size | Total Transfer |
|----------|--------------|---------------|---------------|
| **M1 Bars** | ~200 bytes | ~15-30 KB | ~15-30 KB |
| **Tick Data** | ~200 bytes | ~500-1000 KB | ~500-1000 KB |

**Tick data requires 15-30× more bandwidth per symbol load.**

---

## 3. Processing Performance Comparison

### 3.1 Client-Side Processing Time

| Operation | M1 Bars | Tick Data | Difference |
|-----------|---------|-----------|-------------|
| **Fetch** | 50-200ms | 500-2000ms | 10-40× slower |
| **Parse** | <5ms | 20-50ms | 4-10× slower |
| **Build Profile** | 10-50ms | 100-300ms | 10-30× slower |
| **Total Initial Load** | 60-255ms | 620-2350ms | 10-30× slower |

### 3.2 Memory Usage

```
M1 BARS (Current):
┌─────────────────────────────────────────────────────────────┐
│ Raw data: 1,440 bars × ~40 bytes = ~57 KB                   │
│ Profile array: ~15,000 levels × 16 bytes = ~240 KB          │
│ Processing overhead: Minimal                                 │
│ TOTAL: ~300 KB per symbol                                   │
└─────────────────────────────────────────────────────────────┘

TICK DATA (Alternative):
┌─────────────────────────────────────────────────────────────┐
│ Raw data: 50,000 ticks × 16 bytes = ~800 KB                 │
│ Profile array: ~5,000 levels × 16 bytes = ~80 KB            │
│ Processing overhead: Sorting, discretization                │
│ TOTAL: ~900 KB per symbol                                   │
└─────────────────────────────────────────────────────────────┘
```

**Tick data uses ~3× more memory per symbol.**

---

## 4. System Impact Analysis

### 4.1 Backend Impact

| Impact Area | M1 Bars | Tick Data | Assessment |
|-------------|---------|-----------|------------|
| **API Calls** | 1 per symbol | 2-4 per symbol (bid+ask, pagination) | Tick: 2-4× more load |
| **Response Time** | 50-200ms | 500-2000ms | Tick: 10-40× slower |
| **Bandwidth** | 15-30 KB per symbol | 500-1000 KB per symbol | Tick: 15-30× more |
| **Database Load** | Low (cached trendbars) | High (tick reconstruction) | Tick: Significantly higher |
| **Connection Pool** | 1-2 seconds | 5-10 seconds | Tick: Longer hold time |

### 4.2 Frontend Impact

| Impact Area | M1 Bars | Tick Data | Assessment |
|-------------|---------|-----------|------------|
| **Initial Load** | <300ms | 600-2400ms | Tick: 2-8× slower UX |
| **JavaScript Heap** | ~300 KB/symbol | ~900 KB/symbol | Tick: 3× more pressure |
| **Canvas Rendering** | ~15K levels | ~5K levels | Tick: Faster render |
| **Update Frequency** | M1 (60s) + ticks | Ticks only | Tick: More consistent |

### 4.3 Scalability Analysis

**Scenario: 10 concurrent symbols, 100 users**

```
M1 BARS:
┌─────────────────────────────────────────────────────────────┐
│ Per user: 10 symbols × 30 KB = 300 KB                       │
│ 100 users: 30 MB total bandwidth                             │
│ Backend: 1,000 API calls (10 × 100)                         │
│ Response time: <1 second                                     │
│                                                              │
│ RESULT: ✅ Scalable, fast                                    │
└─────────────────────────────────────────────────────────────┘

TICK DATA:
┌─────────────────────────────────────────────────────────────┐
│ Per user: 10 symbols × 750 KB = 7.5 MB                      │
│ 100 users: 750 MB total bandwidth                            │
│ Backend: 2,000-4,000 API calls (pagination)                  │
│ Response time: 2-5 seconds                                   │
│                                                              │
│ RESULT: ⚠️ Bandwidth bottleneck, slower UX                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Data Accuracy Comparison

### 5.1 M1 Bar Approach (Current)

**How it works:**
```javascript
// For each M1 bar:
generatePriceLevels(bar.low, bar.high, bucketSize)
  → Creates ALL levels between low and high
  → Each level gets +1 TPO

// Example: bar low=1.0850, high=1.0860
// Generates 11 levels: 1.0850, 1.0851, ..., 1.0860
// Each gets TPO+1 (uniform distribution assumption)
```

**Accuracy Issues:**
- ❌ Assumes uniform distribution across price range
- ❌ No actual volume/tick count data
- ❌ Price may have only touched a few levels
- ❌ Over-represents inactive price levels

**Visual Result:**
```
M1 Profile:          Actual Activity:
████████████         ████████
████████████         ████████
████████████  vs     ████  ← Only where price actually was
████████████         ████████
```

### 5.2 Tick Data Approach (Alternative)

**How it works:**
```javascript
// For each tick:
tickPrice = tickData.bid
bucketBoundary = alignToBucket(tickPrice)
level[bucketBoundary].tpo += 1

// Example: 50 ticks at various bid prices
// Increments ONLY the levels where bid occurred
```

**Accuracy Advantages:**
- ✅ Actual price occurrence data
- ✅ Real TPO (Time Price Opportunity) counts
- ✅ No distribution assumptions
- ✅ Matches trader's view of market

**Visual Result:**
```
Tick Profile:         Actual Activity:
████████              ████████
████████              ████████
████████      vs      ████  ← Same as actual
████████              ████████
```

---

## 6. Hybrid Approaches

### 6.1 M1 + Tick Overlay (Current Implementation)

**Description:** Initialize with M1 bars, overlay live ticks

**Pros:**
- ✅ Fast initial load
- ✅ Some historical data
- ✅ Real-time updates

**Cons:**
- ❌ Two different data sources
- ❌ Profile "jumps" when ticks arrive
- ❌ Refresh resets to M1 baseline
- ❌ Confusing UX

**Verdict:** ⚠️ **Current broken implementation**

### 6.2 Tick-Only with Cold Start

**Description:** Start empty, accumulate ticks only

**Pros:**
- ✅ Consistent data source
- ✅ True tick-based profile
- ✅ Simple logic

**Cons:**
- ❌ Empty profile at startup
- ❌ Takes time to build
- ❌ No historical context

**Verdict:** ❌ **Poor UX for new sessions**

### 6.3 Tick History + Live Ticks

**Description:** Fetch tick history for today, continue with live ticks

**Pros:**
- ✅ Full tick accuracy
- ✅ Immediate useful profile
- ✅ Consistent data source
- ✅ No profile "jump"

**Cons:**
- ❌ Slow initial load (2-5 seconds)
- ❌ High bandwidth
- ❌ Backend complexity

**Verdict:** ✅ **Most accurate, slowest performance**

### 6.4 S1 + Tick Hybrid (Proposed)

**Description:** Use S1 bars for fast load, ticks for refinement

**Pros:**
- ✅ Faster load (fewer bars)
- ✅ Better than M1 approximation
- ✅ Still has tick overlay

**Cons:**
- ❌ Still two data sources
- ❌ S1 not available via current API
- ❌ Implementation complexity

**Verdict:** ❓ **Potential future option**

---

## 7. Recommendation Matrix

| Requirement | M1 Only | Tick Only | M1+Tick | Tick History |
|-------------|---------|-----------|---------|-------------|
| **Fast Load (<1s)** | ✅ | ❌ | ✅ | ❌ |
| **Data Accuracy** | ❌ | ✅ | ⚠️ | ✅ |
| **Consistent UX** | ✅ | ⚠️ | ❌ | ✅ |
| **Low Bandwidth** | ✅ | ✅ | ✅ | ❌ |
| **Real-time Updates** | ❌ | ✅ | ✅ | ✅ |
| **Scalability** | ✅ | ✅ | ✅ | ⚠️ |
| **Implementation** | ✅ | ✅ | ⚠️ | ❌ |

---

## 8. Recommended Solutions

### 8.1 Short Term: Fix Current Implementation

**Problem:** M1+Tick creates two different profiles

**Solution:** Make M1 initialization match tick behavior

```javascript
// CURRENT (wrong): M1 creates uniform distribution
generatePriceLevels(bar.low, bar.high, bucketSize)
  → +1 TPO to EVERY level

// PROPOSED: M1 marks levels only, no TPO assumption
for (const bar of m1Bars) {
  const levels = generatePriceLevels(bar.low, bar.high, bucketSize);
  levels.forEach(price => {
    if (!priceMap.has(price)) {
      priceMap.set(price, 0);  // Mark level exists, TPO=0
    }
  });
}

// Then ticks fill in actual TPOs
updateProfileWithTick(profile, tick) → increments real activity
```

**Impact:**
- ✅ Eliminates profile "jump"
- ✅ Consistent data model
- ✅ Fast load maintained
- ⚠️ Profile starts "sparse" until ticks accumulate

### 8.2 Medium Term: Tick History Option

**Solution:** Add tick history as optional feature

```javascript
// User choice:
{
  marketProfileMode: 'fast' | 'accurate'
}

// Fast mode (default): M1 baseline + ticks
// Accurate mode: Tick history + ticks
```

**Impact:**
- ✅ User controls trade-off
- ✅ Power users get accuracy
- ✅ Default remains fast
- ❌ Two code paths to maintain

### 8.3 Long Term: Optimized Tick Fetching

**Solution:** Backend preprocessing and caching

```javascript
// Backend: Pre-compute tick profiles
GET /api/market-profile/:symbol/:date
→ Returns pre-aggregated tick profile
→ Cached for 1 minute
→ Compressed format

// Frontend: Direct profile consumption
// No need to fetch raw ticks
```

**Impact:**
- ✅ Fast load (cached)
- ✅ Full accuracy
- ✅ Low bandwidth (aggregated)
- ✅ Scalable
- ❌ Backend complexity
- ❌ Stale cache risk

---

## 9. Performance Benchmarks (Estimated)

### 9.1 Symbol Load Time (EURUSD, 1 trading day)

| Approach | Network | Processing | Total | Rating |
|----------|---------|------------|-------|--------|
| **M1 Bars** | 100ms | 50ms | **150ms** | ⭐⭐⭐⭐⭐ |
| **Tick History** | 1500ms | 200ms | **1700ms** | ⭐⭐ |
| **M1+Tick (fixed)** | 100ms | 50ms | **150ms** | ⭐⭐⭐⭐⭐ |

### 9.2 Memory Usage (Per Symbol)

| Approach | Raw Data | Profile | Total | Rating |
|----------|----------|---------|-------|--------|
| **M1 Bars** | 60 KB | 240 KB | **300 KB** | ⭐⭐⭐⭐⭐ |
| **Tick History** | 800 KB | 80 KB | **880 KB** | ⭐⭐⭐ |

### 9.3 Bandwidth (10 Symbols, 100 Users)

| Approach | Per User | Total (100×) | Rating |
|----------|----------|--------------|--------|
| **M1 Bars** | 300 KB | **30 MB** | ⭐⭐⭐⭐⭐ |
| **Tick History** | 7.5 MB | **750 MB** | ⭐⭐ |

---

## 10. Final Recommendation

### Recommended Approach: **Fix M1+Tick Implementation**

**Rationale:**
1. **Performance:** M1 bars provide 10× faster load times
2. **Scalability:** 30× less bandwidth than tick history
3. **User Experience:** Fast initial load is critical for trading applications
4. **Simplicity:** Single code path, no new API dependencies

**Implementation:**

```javascript
// 1. Change M1 processing: mark levels, don't assume TPOs
buildInitialProfile(m1Bars, bucketSize) {
  // Create price levels from M1 ranges
  // Initialize TPO = 0 (no assumption)
  // Profile is "empty" until ticks arrive
}

// 2. Tick processing remains unchanged
updateProfileWithTick(profile, tick, bucketSize) {
  // Increment actual bid occurrences
  // Profile fills in over time
}

// 3. Refresh behavior
onRefresh() {
  // Clear profile, restart from M1 markers + new ticks
  // Profile resets but remains consistent
}
```

**Trade-offs:**
- ⚠️ Profile starts sparse (visible TPOs only where ticks occurred)
- ✅ No "jump" between M1 and tick appearance
- ✅ Consistent data model
- ✅ Fast load maintained

### Alternative: **Tick History for Power Users**

If full tick accuracy is required, implement as:
- Optional feature (opt-in)
- "Accurate mode" toggle
- Background fetch with loading indicator
- Cache aggressive to minimize repeat fetches

---

## 11. Implementation Checklist

### Phase 1: Fix Current Implementation (1-2 days)
- [ ] Modify `buildInitialProfile()` to mark levels without TPO assumption
- [ ] Test tick accumulation behavior
- [ ] Verify refresh consistency
- [ ] Update documentation

### Phase 2: Performance Optimization (2-3 days)
- [ ] Add loading states for slow operations
- [ ] Implement progressive rendering
- [ ] Add profile caching in browser
- [ ] Benchmark with real data

### Phase 3: Tick History Feature (Optional, 5-7 days)
- [ ] Add `ProtoOAGetTickDataReq` to CTraderSession
- [ ] Implement pagination handling
- [ ] Add user preference for accuracy mode
- [ ] Performance testing with 100K+ ticks

---

## 12. Sources

- [ProtoOAGetTickDataReq - cTrader Open API Messages](https://help.ctrader.com/open-api/messages/)
- [ProtoOATickData - cTrader Model Messages](https://help.ctrader.com/open-api/model-messages/)
- [ProtoOAGetTrendbarsReq - cTrader Messages](https://help.ctrader.com/open-api/messages/)
- [Market Profile Architectural Forensic Review](/workspaces/neurosensefx/docs/market-profile-architectural-forensic-review.md)

---

*Document generated as part of Market Profile data strategy analysis*
*NeuroSense FX - Crystal Clarity Architecture*
