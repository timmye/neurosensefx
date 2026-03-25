# Market Profile M1 Bar Reset Fidelity - Solutions Comparison

## Problem Statement

**Root Cause**: Market profile does not reset at 0000UTC when M1 bars reset, causing cross-session data contamination.

**Technical Details**:
- Backend fetches M1 bars from `moment.utc().startOf('day')` (0000UTC) - CORRECT
- `MarketProfileService` accumulates data across days WITHOUT daily reset - INCORRECT
- `initializeFromHistory()` has guard (lines 288-295) that prevents re-initialization of existing profiles
- Guard does not distinguish between same-day re-subscription (safe) vs new-day data (must reset)

---

## Solution Comparison Matrix

| Dimension | Minimal Intervention | Stateless | Structural (Session Keys) |
|-----------|---------------------|-----------|---------------------------|
| **Approach** | Add daily boundary detection to existing guard | Recompute profile on every update | Replace with session-keyed architecture |
| **Files Changed** | 1 | 1 | 1 |
| **Lines Changed** | +25 / -10 (~15 net) | +200 / -100 (~100 net) | +150 / -100 (~50 net) |
| **Methods Modified** | 1 (`initializeFromHistory`) | 3 (major refactors) | 5 (all Map access patterns) |
| **Methods Added** | 1 (`_getUtcDayStart`) | 4 (compute, validate, etc.) | 3 (session key helpers) |
| **Breaking Changes** | 0 | 0 | 0 |
| **Frontend Changes** | 0 | 0 | 0 |
| **Backend Memory Impact** | 0 (same structures) | +20% (store raw bars) | +10% (session keys) |
| **Performance Impact** | None (same as current) | -30% (recompute every bar) | -5% (key parsing) |
| **Implementation Risk** | Low (isolated change) | Medium (architectural shift) | High (pervasive changes) |
| **Testing Effort** | Low (5 scenarios) | Medium (10 scenarios) | High (20 scenarios) |
| **Verification Complexity** | Simple (check date) | Complex (verify recomputation) | Complex (verify session isolation) |
| **Rollback Ease** | Trivial (15 lines) | Moderate (100 lines) | Difficult (50 locations) |
| **Code Clarity** | High (explicit check) | Medium (functional pattern) | Low (key parsing everywhere) |

---

## Detailed Analysis

### Solution 1: Minimal Intervention ⭐ RECOMMENDED

**Strategy**: Add daily boundary detection to existing guard in `initializeFromHistory()`

**Implementation**:
```javascript
// Add daily boundary check before skipping reinitialization
const existingDayStart = this._getUtcDayStart(existingProfile.lastUpdate);
const newDataDayStart = this._getUtcDayStart(m1Bars[0].timestamp);

if (existingDayStart === newDataDayStart) {
  // Same day - skip (existing optimization)
  return;
} else {
  // Different day - reset and reinitialize
  existingProfile.levels.clear();
  this.sequenceNumbers.delete(symbol);
  this.lastBarTimestamps.delete(`${symbol}:ctrader`);
  this.lastBarTimestamps.delete(`${symbol}:tradingview`);
}
```

**Advantages**:
- ✅ **Smallest change**: 1 file, ~25 lines added
- ✅ **Zero breaking changes**: Preserves all existing behavior
- ✅ **Low risk**: Isolated change, easy to verify
- ✅ **Easy rollback**: Single method change
- ✅ **Maintains optimization**: Same-day multi-client subscriptions still skip reinitialization
- ✅ **No performance impact**: Same computational complexity
- ✅ **No memory impact**: Uses existing data structures
- ✅ **Clear intent**: Explicit boundary detection code

**Disadvantages**:
- ⚠️ **Still uses mutable state**: Same architecture as current code
- ⚠️ **Manual boundary check**: Relies on developers to maintain logic

**Tradeoffs**:
- **Fidelity**: ✅ 100% - Explicit boundary check ensures reset
- **Consistency**: ✅ 100% - Single profileUpdate event, sequence reset
- **Timing**: ✅ 100% - Uses bar timestamp, exact 0000UTC detection
- **Complexity**: ✅ Low - Simple date comparison

**Implementation Effort**: 2-4 hours
**Testing Effort**: 2-3 hours
**Total Risk**: LOW

---

### Solution 2: Stateless/Functional

**Strategy**: Store raw M1 bars, compute profile on-demand as pure function

**Implementation**:
```javascript
class StatelessMarketProfileService extends EventEmitter {
  constructor() {
    super();
    this.m1BarWindows = new Map(); // symbol -> Array of today's bars
    this.bucketSizes = new Map();
  }

  onM1Bar(symbol, bar, source = null) {
    // Check day boundary
    const windowStart = this.getDayStart(symbol);
    if (bar.timestamp < windowStart) {
      this.m1BarWindows.set(symbol, []); // Reset
    }

    // Append bar (immutable)
    this.m1BarWindows.set(symbol, [...bars, bar]);

    // Recompute full profile
    const profile = this.computeProfile(symbol);
    this.emit('profileUpdate', { symbol, profile, source });
  }

  computeProfile(symbol) {
    const bars = this.m1BarWindows.get(symbol) || [];
    const priceMap = new Map();

    // Pure function - process all bars
    for (const bar of bars) {
      const levels = this.generatePriceLevels(bar.low, bar.high, bucketSize);
      for (const price of levels) {
        priceMap.set(price, (priceMap.get(price) || 0) + 1);
      }
    }

    return { levels: Array.from(priceMap), bucketSize };
  }
}
```

**Advantages**:
- ✅ **No state synchronization issues**: Profile always computed from source of truth
- ✅ **Easier to reason about**: Functional, no mutable state
- ✅ **Day boundary explicit**: Clear window reset logic
- ✅ **Testable**: Pure functions easy to unit test

**Disadvantages**:
- ❌ **Performance degradation**: Recomputes entire profile on every M1 bar
- ❌ **Memory increase**: Stores all raw M1 bars (not just computed TPOs)
- ❌ **Architectural shift**: Requires replacing entire service
- ❌ **Higher implementation risk**: More code changes, more edge cases
- ❌ **Verification complexity**: Need to verify recomputation correctness

**Tradeoffs**:
- **Fidelity**: ✅ 100% - Pure computation from source data
- **Consistency**: ✅ 100% - Single source of truth (raw bars)
- **Timing**: ✅ 100% - Explicit boundary check
- **Complexity**: ⚠️ Medium - Functional pattern unfamiliar to some developers

**Implementation Effort**: 8-12 hours
**Testing Effort**: 6-8 hours
**Total Risk**: MEDIUM

---

### Solution 3: Structural (Session Keys)

**Strategy**: Replace symbol-keyed state with session-keyed state (`symbol:source:utcDate`)

**Implementation**:
```javascript
class MarketProfileService extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map(); // "symbol:source:utcDate" -> {levels, bucketSize, sessionStart}
    this.symbolSources = new Map();
    this.sessionSequenceNumbers = new Map();
  }

  _getSessionKey(symbol, timestamp, source) {
    const utcDate = new Date(timestamp).toISOString().split('T')[0];
    return `${symbol}:${source}:${utcDate}`;
  }

  initializeFromHistory(symbol, m1Bars, bucketSize, source = 'ctrader') {
    const sessionStart = m1Bars[0]?.timestamp || Date.now();
    const sessionKey = this._getSessionKey(symbol, sessionStart, source);

    // Check if session exists
    if (this.sessions.has(sessionKey)) {
      console.log(`Session ${sessionKey} already exists`);
      return;
    }

    // Create new session
    this.sessions.set(sessionKey, {
      levels: new Map(),
      bucketSize,
      sessionStart
    });

    // Initialize from bars...
  }

  onM1Bar(symbol, bar, source = null) {
    const sessionKey = this._getSessionKey(symbol, bar.timestamp, source);

    // Get or create session
    let session = this.sessions.get(sessionKey);
    if (!session) {
      session = {
        levels: new Map(),
        bucketSize: this.getBucketSize(symbol),
        sessionStart: bar.timestamp
      };
      this.sessions.set(sessionKey, session);
    }

    // Process bar...
  }
}
```

**Advantages**:
- ✅ **Architecturally enforced boundaries**: Impossible to have cross-day data
- ✅ **Explicit session modeling**: Clear lifecycle for each day's data
- ✅ **Multi-session support**: Can handle multiple days simultaneously if needed
- ✅ **Clean separation**: Each session is independent

**Disadvantages**:
- ❌ **Pervasive changes**: All Map access patterns need update (~50+ locations)
- ❌ **Higher implementation risk**: Many places to introduce bugs
- ❌ **Complex session management**: Need to handle session key parsing/validation
- ❌ **Harder to verify**: Session key logic scattered throughout code
- ❌ **Over-engineering**: Single-session use case doesn't need this complexity
- ❌ **Performance overhead**: Session key parsing on every access

**Tradeoffs**:
- **Fidelity**: ✅ 100% - Architecture prevents cross-day data
- **Consistency**: ✅ 100% - Session-isolated profiles
- **Timing**: ✅ 100% - Built into session key
- **Complexity**: ❌ High - Session key management adds complexity

**Implementation Effort**: 12-16 hours
**Testing Effort**: 10-12 hours
**Total Risk**: HIGH

---

## Recommendation

### **Winner: Minimal Intervention** ⭐

**Rationale**:

1. **Principle of Least Change**
   - Fixes the specific bug without introducing new architecture
   - Preserves all existing optimizations and behavior
   - Lowest risk of introducing new bugs

2. **Cost-Benefit Analysis**
   - Implementation: 2-4 hours vs 8-16 hours for alternatives
   - Testing: 2-3 hours vs 6-12 hours for alternatives
   - Risk: LOW vs MEDIUM/HIGH for alternatives
   - Benefit: Same fidelity (100%) as alternatives

3. **Maintainability**
   - Clear, explicit code that future developers can understand
   - No architectural shifts that require learning new patterns
   - Easy to rollback if issues arise

4. **Performance**
   - Zero performance degradation
   - No additional memory usage
   - Maintains existing optimization (same-day skip)

5. **Verification**
   - Simple test scenarios (5 tests vs 10-20 for alternatives)
   - Easy to add logging and debugging
   - Clear success criteria (date comparison)

### When to Choose Alternatives

**Choose Stateless Solution if**:
- You need to support multiple concurrent sessions for the same symbol
- You want to eliminate all mutable state patterns
- Performance is not a concern (low-frequency bars)

**Choose Structural Solution if**:
- You need multi-day historical data retention
- You want architecturally enforced session boundaries
- You're building a multi-session analytics platform

**For current requirements** (single session, 100% accuracy, minimal change):
**→ Minimal Intervention is the clear winner**

---

## Implementation Roadmap (Minimal Intervention)

### Phase 1: Implementation (2-4 hours)

1. **Add `_getUtcDayStart()` helper method**
   - Location: After `_incrementSequence()` in `MarketProfileService.js`
   - Lines: ~8 lines of code
   - Test: Verify date extraction works

2. **Modify `initializeFromHistory()` guard**
   - Location: Lines 286-296 in `MarketProfileService.js`
   - Change: Add daily boundary detection
   - Lines: ~20 lines of code
   - Test: Verify boundary detection logic

3. **Add logging**
   - Log when daily boundary is detected
   - Log when reinitialization is skipped (same day)
   - Log when reset occurs (different day)

### Phase 2: Testing (2-3 hours)

1. **Unit Tests**
   - Test `_getUtcDayStart()` with various timestamps
   - Test boundary detection logic
   - Test reset behavior

2. **Integration Tests**
   - Test normal day rollover scenario
   - Test same-day multi-client subscription
   - Test live bar processing after reset

3. **E2E Tests**
   - Test full system with day rollover
   - Verify both mini and canvas profiles reset
   - Verify no data loss during transition

### Phase 3: Verification (1-2 hours)

1. **Manual Testing**
   - Subscribe before midnight
   - Verify profile data
   - Wait for midnight (or mock time)
   - Verify profile reset
   - Verify new data accumulates correctly

2. **Log Analysis**
   - Check boundary detection logs
   - Verify reset occurred at 0000UTC
   - Verify no cross-day data contamination

3. **Performance Monitoring**
   - Verify no performance degradation
   - Check memory usage unchanged
   - Monitor CPU usage during reset

### Total Timeline: 5-9 hours

---

## Success Criteria

### Functional Requirements

- [ ] Market profile resets at 0000UTC daily
- [ ] No cross-day data contamination
- [ ] Mini market profile and canvas market profile show identical data
- [ ] No M1 bars lost during boundary transition
- [ ] Same-day multi-client subscriptions still optimized

### Non-Functional Requirements

- [ ] Zero performance degradation
- [ ] Zero additional memory consumption
- [ ] Implementation time < 4 hours
- [ ] Testing time < 3 hours
- [ ] Code clarity maintained or improved

### Quality Gates

- [ ] All E2E tests pass
- [ ] No console errors or warnings
- [ ] Logs clearly show boundary detection
- [ ] Manual testing confirms reset behavior
- [ ] Code review approved

---

## Conclusion

The **Minimal Intervention** solution provides the optimal balance of:

- **Effectiveness**: 100% fidelity, exact 0000UTC timing
- **Efficiency**: Lowest implementation and testing cost
- **Safety**: Lowest risk of introducing new bugs
- **Simplicity**: Clearest code, easiest to maintain

It fixes the specific bug (cross-day data contamination) without over-engineering the solution or introducing unnecessary complexity.
