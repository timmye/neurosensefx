# FX Progressive Positioning Drift Analysis

## Issue Summary
FX (forex) displays are progressively drawn down and to the right on the canvas until they no longer appear, while crypto displays work correctly.

## Root Cause Analysis

### Primary Issue: Accumulating ADR Percentage
**Location**: `/src/workers/dataProcessor.js`, line 217

**Problematic Code**:
```javascript
state.maxAdrPercentage = Math.max(state.maxAdrPercentage, targetAdrPercentage);
```

**Issue**: This line only ever increases `maxAdrPercentage` - it never decreases it, causing cumulative drift.

### How the Drift Occurs

1. **Initial State**: `maxAdrPercentage` starts at 0.3 (30%)

2. **Progressive Accumulation**:
   - When price movement exceeds 30% of ADR → `maxAdrPercentage` becomes 0.5
   - When price movement exceeds 50% of ADR → `maxAdrPercentage` becomes 0.75
   - When price movement exceeds 75% of ADR → `maxAdrPercentage` becomes 1.0
   - **Never resets back down**

3. **Visual Range Expansion**:
   ```javascript
   const visualRangeHalf = (adrRange / 2) * state.maxAdrPercentage;  // Line 219
   const visualHigh = state.midPrice + visualRangeHalf;               // Line 220
   const visualLow = state.midPrice - visualRangeHalf;                // Line 221
   ```

4. **Y-Scale Domain Changes**:
   - The y-scale domain `[visualLow, visualHigh]` expands over time
   - Same price gets mapped to different Y coordinates as scale changes
   - Results in apparent "drift" of visual elements

5. **FX-Specific Impact**:
   - FX prices have smaller absolute movements (e.g., 1.05500 → 1.05600)
   - More likely to hit ADR percentage thresholds repeatedly
   - Crypto prices have larger movements but relative to their value, may not trigger the same cumulative effect

### Evidence Files Created
- `/test_debug_positioning_drift_5678.js` - Comprehensive positioning drift simulation
- `/test_debug_scale_drift_5678.js` - Scale calculation and domain drift analysis

### Debug Statements Added (Temporary)
All debug statements have been added with `[DEBUGGER:]` prefix for easy identification and removal:

1. **Container.svelte**: Canvas transform tracking
2. **FloatingDisplay.svelte**: Symbol-specific render tracking
3. **priceFloat.js**: Context transformation and coordinate logging
4. **dataProcessor.js**: Visual range calculation tracking

## Fix Strategy

### Immediate Fix: Reset maxAdrPercentage Logic
Modify the `recalculateVisualRange()` function to:

1. **Add Decay Mechanism**: Gradually reduce `maxAdrPercentage` over time
2. **Add Maximum Threshold**: Cap `maxAdrPercentage` to prevent unlimited expansion
3. **Add Reset Logic**: Reset `maxAdrPercentage` based on recent price movement patterns

### Recommended Solution:
```javascript
function recalculateVisualRange() {
    const adrRange = state.projectedAdrHigh - state.projectedAdrLow;
    const priceDistanceFromOpen = Math.abs(state.currentPrice - state.midPrice);
    const currentAdrPercentage = priceDistanceFromOpen / adrRange;

    // Calculate target based on current movement
    let targetAdrPercentage = 0.3;
    if (currentAdrPercentage > 0.75) {
        targetAdrPercentage = 1.0;
    } else if (currentAdrPercentage > 0.5) {
        targetAdrPercentage = 0.75;
    } else if (currentAdrPercentage > 0.3) {
        targetAdrPercentage = 0.5;
    }

    // 🔧 FIX: Use weighted average instead of only increasing
    const smoothingFactor = 0.1; // 10% smoothing
    state.maxAdrPercentage = (state.maxAdrPercentage * (1 - smoothingFactor)) +
                           (targetAdrPercentage * smoothingFactor);

    // Cap at reasonable maximum
    state.maxAdrPercentage = Math.min(state.maxAdrPercentage, 1.5);

    // Continue with rest of function...
}
```

### Alternative Solutions:

1. **Time-Based Reset**: Reset `maxAdrPercentage` every N seconds/minutes
2. **Movement-Based Reset**: Reset when price returns to near open price
3. **Dual ADR System**: Separate ADR calculations for different instrument classes

## Files Modified for Debugging

### Debug Statements Added (ALL TO BE REMOVED):

1. **`/src/components/viz/Container.svelte`**
   - Lines 189, 194, 196: Canvas transform logging
   - Lines 292, 294: Context restore logging

2. **`/src/components/FloatingDisplay.svelte`**
   - Line 422: Symbol-specific render tracking

3. **`/src/lib/viz/priceFloat.js`**
   - Lines 86, 91: Context transformation logging
   - Lines 116, 117, 133, 135: Line drawing and restore logging

## Testing Verification

### Steps to Reproduce:
1. Load FX symbol (EURUSD, GBPUSD, etc.)
2. Observe initial positioning
3. Wait for price movements that trigger ADR percentage changes
4. Observe progressive drift of visual elements
5. Compare with crypto symbol (BTCUSD) which should show less drift

### Expected Results After Fix:
- FX displays maintain consistent positioning
- No progressive accumulation of visual range
- Consistent y-scale mapping over time
- Both FX and crypto displays maintain stable positioning

## Impact Assessment

### Before Fix:
- **Critical**: FX displays become unusable as elements drift off-screen
- **User Experience**: Confusing and unprofessional behavior
- **Data Integrity**: Apparent loss of data visualization accuracy

### After Fix:
- **Resolved**: Stable positioning for all symbol types
- **Consistent**: Same behavior across FX and crypto instruments
- **Professional**: Reliable trading data visualization

## Debug Statement Cleanup

**All debug statements MUST be removed before final deployment:**

1. Search for `[DEBUGGER:]` prefix throughout the codebase
2. Remove all console.log statements with this prefix
3. Remove test files:
   - `/test_debug_positioning_drift_5678.js`
   - `/test_debug_scale_drift_5678.js`

## Conclusion

The progressive positioning drift in FX displays is caused by a cumulative ADR percentage calculation that only ever increases, expanding the visual range and changing y-scale mappings over time. The fix involves implementing a decay or smoothing mechanism for the `maxAdrPercentage` calculation to prevent unlimited expansion.

This is a **data processing issue**, not a rendering or canvas transformation issue. The canvas coordinate system and transformations are working correctly; the problem is in the scale domain values being calculated in the data processor.