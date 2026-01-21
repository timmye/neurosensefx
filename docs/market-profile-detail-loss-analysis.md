# Market Profile Detail Loss Analysis

## Problem Description

The market profile shows **less detail/data during normal operation** but **shows MORE detail levels/data after manual refresh**.

**Observed Behavior:**
- Multiple symbols displayed in UI
- Market profile updates and looks OK initially
- On manual refresh, additional price levels and TPO counts appear

**Date**: 2026-01-21
**Status**: Root cause identified, fixes pending

---

## Root Causes

### 🔴 CRITICAL BUG #1: Tick Prices Not Aligned to Bucket Boundaries

**File**: `src/lib/marketProfileProcessor.js:71-88`

**Issue**: The `updateProfileWithTick()` function uses raw tick prices that don't match the bucketed price levels generated for the initial profile.

**Current Code:**
```javascript
export function updateProfileWithTick(lastProfile, tickData) {
  const tickPrice = tickData.bid;  // Raw price: e.g., 1.0851037

  const existingLevel = updatedProfile.find(level => level.price === tickPrice);
  // 1.0851037 === 1.08512 → FALSE! Creates fragmented level
}
```

**Initial Profile Generation:**
```javascript
// generatePriceLevels() creates bucketed prices: 1.08510, 1.08511, 1.08512, ...
let currentPrice = Math.floor(low / bucketSize) * bucketSize;
levels.push(parseFloat(formatPrice(currentPrice, pipPosition)));
```

**Impact:**
- Initial profile: ~500-1500 properly bucketed levels (e.g., 1.08510, 1.08511, 1.08512)
- After 100 ticks: 500 original + 100 new unbucketed levels (e.g., 1.0851037, 1.0851045)
- Price levels fragment into non-contiguous mess
- TPO counts spread thin across fragmented levels

**Fix Required:**
```javascript
export function updateProfileWithTick(lastProfile, tickData, bucketSize, symbolData) {
  const tickPrice = tickData.bid;

  // ALIGN to bucket boundary (same logic as generatePriceLevels)
  const bucketedPrice = Math.floor(tickPrice / bucketSize) * bucketSize;
  const alignedPrice = parseFloat(formatPrice(bucketedPrice, symbolData?.pipPosition ?? 4));

  const existingLevel = updatedProfile.find(level => level.price === alignedPrice);
  if (existingLevel) {
    existingLevel.tpo += 1;  // Increments existing level
  } else {
    updatedProfile.push({ price: alignedPrice, tpo: 1 });
  }
  return updatedProfile.sort((a, b) => a.price - b.price);
}
```

---

### 🔴 CRITICAL BUG #2: TradingView Missing Pipette Data

**File**: `services/tick-backend/TradingViewSession.js:227-238`

**Issue**: TradingView backend doesn't send `pipPosition`, `pipSize`, or `pipetteSize` in `symbolDataPackage`.

**Current Code:**
```javascript
this.emit('candle', {
  type: 'symbolDataPackage',
  source: 'tradingview',
  symbol,
  initialMarketProfile: todaysM1Candles
  // ❌ MISSING: pipPosition, pipSize, pipetteSize
});
```

**Bucket Size Calculation:**
```javascript
// src/lib/displayDataProcessor.js:76-90
export function getBucketSizeForSymbol(symbol, symbolData, bucketMode = 'pip') {
  if (bucketMode === 'pipette' && symbolData?.pipetteSize) {
    return symbolData.pipetteSize;  // ❌ undefined for TradingView
  }
  if (symbolData?.pipSize) {
    return symbolData.pipSize;  // ❌ undefined for TradingView
  }
  return estimatePipSize(priceRef);  // Falls back to estimation
}
```

**Config Request:**
```javascript
// src/lib/marketProfileConfig.js:8
bucketMode: 'pipette',  // Requests pipetteSize (0.00001 for EURUSD)
```

**Impact:**

| Source | pipetteSize | pipSize | Actual Bucket | Levels Generated |
|--------|-------------|---------|---------------|------------------|
| cTrader | ✓ 0.00001 | ✓ 0.0001 | 0.00001 | ~1500 |
| TradingView | ✗ undefined | ✗ undefined | 0.0001 | ~150 (10x fewer) |

**Fix Required:**
```javascript
// services/tick-backend/TradingViewSession.js
this.emit('candle', {
  type: 'symbolDataPackage',
  source: 'tradingview',
  symbol,
  initialMarketProfile: todaysM1Candles,
  // ✅ ADD: Estimate pip data from price range
  pipPosition: estimatePipPosition(todaysM1Candles),
  pipSize: estimatePipSize(todaysM1Candles),
  pipetteSize: estimatePipetteSize(todaysM1Candles)
});
```

---

### 🟡 BUG #3: updateProfileWithTick() Called Without Bucket Size

**File**: `src/components/FloatingDisplay.svelte:60`

**Issue**: The function is called without the `bucketSize` and `symbolData` parameters needed for price alignment.

**Current Code:**
```javascript
// Line 60
else if (data.type === 'tick' && lastMarketProfileData) {
  lastMarketProfileData = updateProfileWithTick(lastMarketProfileData, data);
  // ❌ Missing: bucketSize, symbolData parameters
}
```

**Fix Required:**
1. Store `bucketSize` and `symbolData` from initial profile build
2. Pass to `updateProfileWithTick()`

---

### 🟢 BUG #4: M1 Hard Cap (TradingView Only)

**File**: `services/tick-backend/TradingViewSession.js:140-145`

**Issue**: M1 candle count is capped at 1500, potentially limiting historical data.

**Current Code:**
```javascript
const M1_HARD_CAP = 1500;
if (parsedM1.length > M1_HARD_CAP) {
  console.warn(`[TradingView] M1 candle count ${parsedM1.length} exceeds hard cap ${M1_HARD_CAP}`);
  parsedM1.length = M1_HARD_CAP;  // Truncates array
}
```

**Impact**: Fewer M1 bars = fewer TPOs in initial profile for TradingView source.

**Note**: 1500 M1 bars = ~25 hours of data. A full trading day is 1440 minutes. The cap should be sufficient for single-day display but may limit multi-day views.

---

## Why Refresh Shows More Data

### Timeline Comparison

#### Normal Operation (Fragmented)
```
1. symbolDataPackage arrives
   → buildInitialProfile() with bucket size
   → Creates 500 properly bucketed levels (1.08510, 1.08511, 1.08512, ...)

2. Tick #1 arrives: bid = 1.0851037
   → updateProfileWithTick(): Creates NEW level at 1.0851037 (not aligned)

3. Tick #2 arrives: bid = 1.0851045
   → updateProfileWithTick(): Creates ANOTHER new level at 1.0851045

... 100 ticks later ...

4. Profile state:
   → 500 original bucketed levels
   → +100 fragmented unbucketed levels
   → Total: 600 levels with scattered, low TPO counts
```

#### After Manual Refresh (Clean)
```
1. handleRefresh() clears lastMarketProfileData
2. Request NEW symbolDataPackage
3. buildInitialProfile() with LATEST M1 bars
   → Creates 500 properly bucketed levels
   → All TPOs from M1 bars included in proper buckets
   → No accumulated tick fragmentation
4. Display shows: 500 levels with complete TPO counts
```

### Key Difference

| Aspect | Normal Operation | After Refresh |
|--------|------------------|---------------|
| Initial Profile | Clean bucketed levels | Clean bucketed levels (latest data) |
| Tick Updates | Fragmented (unbucketed) | None yet (starts fresh) |
| Total Levels | Mixed clean/fragmented | 100% clean |
| TPO Distribution | Scattered | Concentrated in correct buckets |

---

## Data Loss Paths

### Path #1: Tick Fragmentation
```
FloatingDisplay.svelte:60
  → Calls updateProfileWithTick()
  → marketProfileProcessor.js:77
  → Extracts raw tickData.bid
  → marketProfileProcessor.js:79
  → Exact match comparison fails
  → marketProfileProcessor.js:83
  → Creates fragmented level
```

### Path #2: TradingView Bucket Size
```
TradingViewSession.js:227-238
  → Emits package WITHOUT pipetteSize
  → FloatingDisplay.svelte:57
  → Calls getBucketSizeForSymbol(..., 'pipette')
  → displayDataProcessor.js:81-82
  → pipetteSize check fails (undefined)
  → displayDataProcessor.js:84-85
  → Falls back to pipSize (undefined)
  → displayDataProcessor.js:89
  → Falls back to estimatePipSize() (10x larger)
  → marketProfileProcessor.js:23
  → Uses 10x larger bucket
  → marketProfileProcessor.js:28
  → Generates 10x FEWER levels
```

---

## Recommended Fixes (Priority Order)

### Priority 1: Fix Tick Bucket Alignment
**File**: `src/lib/marketProfileProcessor.js:71-88`

- Add `bucketSize` and `symbolData` parameters to `updateProfileWithTick()`
- Align tick price to bucket before comparison
- Use same bucketing logic as `generatePriceLevels()`

### Priority 2: Add Pipette Data to TradingView
**File**: `services/tick-backend/TradingViewSession.js:227-238`

- Add `pipPosition`, `pipSize`, `pipetteSize` to symbolDataPackage
- Estimate from price range if not available from TradingView API

### Priority 3: Pass Bucket Size to Tick Updates
**File**: `src/components/FloatingDisplay.svelte:60`

- Store `bucketSize` from initial profile
- Store `symbolData` for pipPosition
- Pass to `updateProfileWithTick(lastMarketProfileData, data, bucketSize, symbolData)`

### Priority 4: Review M1 Hard Cap
**File**: `services/tick-backend/TradingViewSession.js:140-145`

- Assess if 1500 cap is sufficient for use cases
- Consider increasing to 2000 for buffer
- Or implement proper paging for historical M1 data

---

## Testing Checklist

After implementing fixes:

- [ ] Market profile maintains bucket alignment during tick updates
- [ ] TradingView symbols show same detail level as cTrader
- [ ] Manual refresh no longer changes profile appearance (should be identical)
- [ ] Price levels remain contiguous (no gaps from unbucketed ticks)
- [ ] TPO counts increment on existing levels, not create new ones
- [ ] Profile detail consistent across both sources

---

## Related Files

| File | Purpose |
|------|---------|
| `src/lib/marketProfileProcessor.js` | Profile building and tick update logic |
| `src/lib/displayDataProcessor.js` | Bucket size calculation |
| `src/components/FloatingDisplay.svelte` | Data callback and update coordination |
| `services/tick-backend/CTraderSession.js` | cTrader data package generation |
| `services/tick-backend/TradingViewSession.js` | TradingView data package generation |
