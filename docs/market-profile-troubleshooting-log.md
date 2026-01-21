# Market Profile Tick Integration Bug - Fix Attempts

**Date:** 2026-01-21
**Status:** ❌ UNRESOLVED - 4 fixes attempted, issue persists

---

## Problem Statement

Market profile displays stale data. Fresh ticks don't integrate into the profile until the user manually refreshes the symbol.

**Observed Behavior:**
- Profile shows less detail during normal operation
- Manual refresh shows more detail/different profile
- Ticks arrive but don't update the displayed TPO counts

**Expected Behavior:**
- Profile should integrate live ticks as they arrive
- No manual refresh should be required

---

## Fix Attempt #1: Tick Bucket Alignment

**Issue:** Tick prices weren't aligned to bucket boundaries, causing fragmented price levels.

**Files Modified:**
- `src/lib/marketProfileProcessor.js` (lines 99-122)
- `src/components/FloatingDisplay.svelte` (lines 60, 66)
- `services/tick-backend/TradingViewSession.js` (pip data emission)

**Change:** Added price discretization to `updateProfileWithTick()` to align raw tick prices to bucket boundaries using `Math.floor(tickPrice / bucketSize) * bucketSize`.

**Result:** ❌ "Observed behavior is similar" - No improvement

---

## Fix Attempt #2: Bucket Size Mismatch

**Issue:** `FloatingDisplay` stored the *requested* bucket size, but `buildInitialProfile()` used an *adaptive* bucket size based on price range. When these differed, tick updates aligned to wrong boundaries.

**Files Modified:**
- `src/lib/marketProfileProcessor.js` (return object)
- `src/components/FloatingDisplay.svelte` (destructuring)

**Change:** Made `buildInitialProfile()` return `{ profile, actualBucketSize }` so frontend stores the actual bucket size used.

**Result:** ❌ "Still an issue with refresh showing different profile"

---

## Fix Attempt #3: DisplayCanvas Reactivity

**Issue:** `DisplayCanvas.svelte:122` reactive statement didn't track `marketProfileData`, so tick profile updates didn't trigger canvas re-renders.

**Files Modified:**
- `src/components/displays/DisplayCanvas.svelte` (line 122)

**Change:** Added `marketProfileData` to reactive statement dependencies.

**Result:** ❌ "Did not fix it"

---

## Fix Attempt #4: Return Type Consistency

**Issue:** `buildInitialProfile()` returned `[]` (array) when M1 bars empty, but `{ profile, actualBucketSize }` (object) when non-empty. Destructuring failed silently, leaving `lastMarketProfileData` and `marketProfileBucketSize` as `undefined`, breaking tick integration.

**Files Modified:**
- `src/lib/marketProfileProcessor.js` (line 17-18)

**Change:**
```javascript
// Before:
if (!m1Bars || m1Bars.length === 0) {
  return [];
}

// After:
if (!m1Bars || m1Bars.length === 0) {
  return { profile: [], actualBucketSize: bucketSize };
}
```

**Result:** ❌ "Did not fix the issue"

**Why it didn't work:** This was a real bug but only affected the edge case of empty initial M1 data. The actual issue occurs even when M1 bars exist.

---

## Current Code State

### Active Implementations
- ✅ Tick bucket alignment in `updateProfileWithTick()`
- ✅ Adaptive bucket size returned from `buildInitialProfile()`
- ✅ `FloatingDisplay` stores actual bucket size
- ✅ DisplayCanvas tracks `marketProfileData` for reactivity
- ✅ TradingView emits pip data
- ✅ Consistent return type from `buildInitialProfile()`

### Build Status
✅ `built in 865ms` - No errors

---

## Data Flow (cTrader)

```
┌─────────────────────────────────────────────────────────────┐
│  INITIALIZATION                                              │
├─────────────────────────────────────────────────────────────┤
│  Frontend requests symbol                                   │
│     ↓                                                        │
│  Backend: CTraderSession.getSymbolDataPackage()            │
│     ↓                                                        │
│  Fetches D1 bars (ADR) + M1 bars (profile)                 │
│     ↓                                                        │
│  Returns { initialMarketProfile: M1[], pipPosition, ... }  │
│     ↓                                                        │
│  WebSocketServer sends symbolDataPackage                   │
│     ↓                                                        │
│  Frontend: buildInitialProfile(M1 bars)                   │
│     ↓                                                        │
│  Returns { profile: [], actualBucketSize }                 │
│     ↓                                                        │
│  lastMarketProfileData = profile                           │
│  marketProfileBucketSize = actualBucketSize                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  LIVE TICKS                                                  │
├─────────────────────────────────────────────────────────────┤
│  cTrader emits tick with { bid, ask, pipPosition, ... }    │
│     ↓                                                        │
│  DataRouter.broadcastToClients()                           │
│     ↓                                                        │
│  WebSocket → ConnectionManager.onmessage                  │
│     ↓                                                        │
│  FloatingDisplay.dataCallback                              │
│     ↓                                                        │
│  Condition: if (data.type === 'tick' && lastMarketProfileData && marketProfileBucketSize)
│     ↓                                                        │
│  updateProfileWithTick(profile, tick, bucketSize, symbolData)│
│     ↓                                                        │
│  lastMarketProfileData = updatedProfile                    │
│     ↓                                                        │
│  DisplayCanvas reactive statement fires                     │
│     ↓                                                        │
│  Canvas re-renders with updated profile                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Remaining Hypotheses

1. **Tick Condition Never Met:** `lastMarketProfileData` or `marketProfileBucketSize` may be undefined at runtime
2. **Profile Reference Not Changing:** Array may be mutated in-place instead of creating new reference
3. **Canvas Not Re-rendering:** Reactive statement may not fire despite data change
4. **Backend Data Incomplete:** cTrader M1 bars may have more data than local tick stream

---

## Key Code Locations

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/marketProfileProcessor.js` | 16-41 | `buildInitialProfile()` - creates profile from M1 bars |
| `src/lib/marketProfileProcessor.js` | 99-122 | `updateProfileWithTick()` - integrates ticks into profile |
| `src/components/FloatingDisplay.svelte` | 50-72 | `dataCallback` - handles tick and package data |
| `src/components/FloatingDisplay.svelte` | 64-67 | Tick update condition and call |
| `src/components/displays/DisplayCanvas.svelte` | 122 | Reactive statement for re-renders |
| `services/tick-backend/CTraderSession.js` | 236-303 | `getSymbolDataPackage()` - fetches M1 bars |
| `services/tick-backend/CTraderSession.js` | 105-114 | Tick emission with bid/ask/pip data |
| `services/tick-backend/DataRouter.js` | 14-21 | Routes cTrader ticks to clients |

---

## Testing Checklist

- [ ] Verify ticks arrive at `dataCallback`
- [ ] Verify `lastMarketProfileData` and `marketProfileBucketSize` are set
- [ ] Verify tick condition passes: `data.type === 'tick' && lastMarketProfileData && marketProfileBucketSize`
- [ ] Verify `updateProfileWithTick()` executes
- [ ] Verify profile array reference changes
- [ ] Verify DisplayCanvas reactive statement fires
- [ ] Log TPO counts before/after tick

---

## References

- Initial Analysis: `docs/market-profile-detail-loss-analysis.md`
- Solution Design Alternatives: `docs/market-profile-solution-summary.md`
- Stateless Approach: `src/lib/marketProfileStateless.js`
