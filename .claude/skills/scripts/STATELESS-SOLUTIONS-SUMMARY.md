# Market Profile M1 Bar Reset: Stateless Solutions Summary

## Quick Analysis Results

Running the validator script confirms:

```
✓ Stateless implementation EXISTS in frontend (src/lib/marketProfileStateless.js)
✗ Backend MarketProfileService.js has FATAL issues:
  - No day boundary detection
  - State accumulates across days without reset
  - Cross-session data contamination risk
```

## Recommended Solution: Solution 2

**Stateless with Automatic Day Boundary Detection**

### Why This Solution?

1. **Zero Frontend Changes** - Drop-in backend replacement
2. **Leverages Existing Code** - Frontend already has stateless implementation
3. **Explicit Boundary Handling** - Day key detection is unambiguous
4. **Low Risk** - Pure functions, no state mutation
5. **Low Effort** - Can reuse existing patterns from frontend

### Implementation Outline

```javascript
// Replace MarketProfileService.js with stateless version

class StatelessMarketProfileService extends EventEmitter {
  constructor() {
    super();
    this.m1BarWindows = new Map();      // Store raw bars, not computed profile
    this.bucketSizes = new Map();       // symbol -> bucketSize
    this.lastProcessedDay = new Map();  // symbol -> "YYYY-MM-DD" UTC
  }

  onM1Bar(symbol, bar, source = null) {
    const barDayKey = this.extractDayKey(bar.timestamp);
    const lastDayKey = this.lastProcessedDay.get(symbol);

    // DETECT DAY BOUNDARY
    if (barDayKey !== lastDayKey) {
      console.log(`Day boundary for ${symbol}: ${lastDayKey} → ${barDayKey}`);
      this.m1BarWindows.set(symbol, []);  // CLEAR STATE
      this.lastProcessedDay.set(symbol, barDayKey);
    }

    // Append bar and RECOMPUTE from scratch
    const currentBars = this.m1BarWindows.get(symbol);
    this.m1BarWindows.set(symbol, [...currentBars, bar]);

    const profile = this.computeProfile(symbol);  // PURE FUNCTION
    this.emit('profileUpdate', { symbol, profile, source });
  }

  extractDayKey(timestamp) {
    const date = new Date(timestamp);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }

  computeProfile(symbol) {
    const bars = this.m1BarWindows.get(symbol) || [];
    const bucketSize = this.bucketSizes.get(symbol);

    // PURE FUNCTION: Always same output for same input
    const priceMap = new Map();
    for (const bar of bars) {
      const levels = this.generatePriceLevels(bar.low, bar.high, bucketSize);
      for (const price of levels) {
        priceMap.set(price, (priceMap.get(price) || 0) + 1);
      }
    }

    return {
      levels: Array.from(priceMap.entries())
        .map(([price, tpo]) => ({ price, tpo }))
        .sort((a, b) => a.price - b.price),
      bucketSize
    };
  }
}
```

### Key Changes from Current Implementation

| Aspect | Current (Stateful) | New (Stateless) |
|--------|-------------------|-----------------|
| **State** | Computed profile (Map of price→TPO) | Raw M1 bars array |
| **Update** | Mutate profile: `levels.set(price, tpo+1)` | Append bar, recompute entire profile |
| **Boundary** | No detection | `extractDayKey()` comparison |
| **Reset** | Manual/never | Automatic on day change |
| **Correctness** | Cross-day contamination | Guaranteed isolation |

### Migration Path

1. **Backup** current `MarketProfileService.js`
2. **Replace** with stateless implementation
3. **Test** with existing E2E suite
4. **Monitor** logs for day boundary transitions
5. **Rollback** if issues (no frontend changes needed)

### Performance Impact

- **Computation**: O(n) per M1 bar where n = today's bars (< 1500)
- **Expected time**: < 1ms per bar (trivial)
- **Memory**: ~60KB per symbol (1500 bars × 40 bytes)
- **Bandwidth**: No change (still emits full profile)

## Alternative Solutions (Not Recommended)

### Solution 1: Pure Stateless (Compute on Demand)
- **Pros**: Simpler, no day tracking
- **Cons**: Timestamp comparison less explicit than day key
- **Verdict**: Viable but Solution 2 is clearer

### Solution 3: Extreme Stateless (Frontend Compute)
- **Pros**: Zero backend state
- **Cons**: Requires frontend changes (FATAL condition)
- **Verdict**: Only if frontend already being refactored

### Solution 4: Hybrid Stateless
- **Pros**: Self-healing with frontend validation
- **Cons**: Minor frontend changes required
- **Verdict**: Good future enhancement but not necessary

## Files Referenced

**Analysis:**
- `/workspaces/neurosensefx/.claude/skills/scripts/market-profile-stateless-solutions.md` - Full analysis with all solutions
- `/workspaces/neurosensefx/.claude/skills/scripts/validate-stateless-solutions.js` - Validation script

**Implementation:**
- `/workspaces/neurosensefx/services/tick-backend/MarketProfileService.js` - Current stateful implementation (TO BE REPLACED)
- `/workspaces/neurosensefx/src/lib/marketProfileStateless.js` - Existing stateless frontend implementation (REFERENCE)

**Root Cause:**
- `/workspaces/neurosensefx/services/tick-backend/CTraderDataProcessor.js:104` - M1 bars fetched from `startOf('day')` ✓ CORRECT
- `/workspaces/neurosensefx/services/tick-backend/TradingViewDataPackageBuilder.js:18` - M1 bars filtered to today ✓ CORRECT
- `/workspaces/neurosensefx/services/tick-backend/MarketProfileService.js` - No daily reset ✗ PROBLEM

## Next Steps

1. **Review** the full analysis document
2. **Run** the validation script to confirm current state
3. **Decide** on Solution 2 implementation
4. **Implement** stateless backend service
5. **Test** with E2E suite (especially day boundary scenarios)
6. **Deploy** and monitor for day boundary transitions

## Evaluation Criteria Compliance

✅ **VIABILITY** - All checks pass:
- Resets at 0000UTC: Yes (day key detection)
- Maintains fidelity: Yes (same computation logic)
- Handles boundaries: Yes (explicit detection)
- Prevents contamination: Yes (window cleared on boundary)

✅ **NO FATAL CONDITIONS** - All avoided:
- Addresses daily reset: Yes
- No cross-day contamination: Yes
- No mini/canvas divergence: Yes
- No M1 bar loss: Yes

⚠️ **MINOR CONDITIONS** - Acceptable:
- Temporary visual inconsistency: Possible during reset (< 1 second)
- Increased logging: Day boundary transitions logged

## Conclusion

The **stateless approach with day boundary detection** is the recommended solution because it:

1. **Eliminates the root cause** - State accumulation across days
2. **Leverages existing patterns** - Frontend already has stateless implementation
3. **Requires no frontend changes** - Drop-in backend replacement
4. **Provides automatic reset** - Day boundary detection triggers clear
5. **Is low risk** - Pure functions, bounded memory, clear rollback path

This aligns with the stateless/functional perspective by eliminating mutable state and computing results on-demand from immutable data (today's M1 bars).
