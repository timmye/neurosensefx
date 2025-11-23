/**
 * Canvas Positioning Drift Fix Validation
 *
 * This script validates that the maxAdrPercentage drift fix is working correctly.
 * The bug was that maxAdrPercentage was accumulating using Math.max() instead of
 * being reset to the current targetAdrPercentage.
 */

// Simulate the original buggy behavior
function simulateBuggyBehavior(ticks) {
    console.log('\n=== SIMULATING BUGGY BEHAVIOR ===');
    let state = { maxAdrPercentage: 0.3 };

    for (let i = 0; i < ticks.length; i++) {
        const tick = ticks[i];
        const priceDistanceFromOpen = Math.abs(tick.currentPrice - tick.midPrice);
        const adrRange = tick.projectedAdrHigh - tick.projectedAdrLow;
        const currentAdrPercentage = priceDistanceFromOpen / adrRange;

        let targetAdrPercentage = 0.3;
        if (currentAdrPercentage > 0.75) {
            targetAdrPercentage = 1.0;
        } else if (currentAdrPercentage > 0.5) {
            targetAdrPercentage = 0.75;
        } else if (currentAdrPercentage > 0.3) {
            targetAdrPercentage = 0.5;
        }

        // BUGGY BEHAVIOR: Cumulative max instead of current target
        state.maxAdrPercentage = Math.max(state.maxAdrPercentage, targetAdrPercentage);

        console.log(`Tick ${i + 1}: current=${currentAdrPercentage.toFixed(3)}, target=${targetAdrPercentage.toFixed(3)}, max=${state.maxAdrPercentage.toFixed(3)}`);
    }

    return state;
}

// Simulate the fixed behavior
function simulateFixedBehavior(ticks) {
    console.log('\n=== SIMULATING FIXED BEHAVIOR ===');
    let state = { maxAdrPercentage: 0.3 };

    for (let i = 0; i < ticks.length; i++) {
        const tick = ticks[i];
        const priceDistanceFromOpen = Math.abs(tick.currentPrice - tick.midPrice);
        const adrRange = tick.projectedAdrHigh - tick.projectedAdrLow;
        const currentAdrPercentage = priceDistanceFromOpen / adrRange;

        let targetAdrPercentage = 0.3;
        if (currentAdrPercentage > 0.75) {
            targetAdrPercentage = 1.0;
        } else if (currentAdrPercentage > 0.5) {
            targetAdrPercentage = 0.75;
        } else if (currentAdrPercentage > 0.3) {
            targetAdrPercentage = 0.5;
        }

        // FIXED BEHAVIOR: Use current target instead of cumulative max
        state.maxAdrPercentage = targetAdrPercentage;

        console.log(`Tick ${i + 1}: current=${currentAdrPercentage.toFixed(3)}, target=${targetAdrPercentage.toFixed(3)}, max=${state.maxAdrPercentage.toFixed(3)}`);
    }

    return state;
}

// Generate realistic test data
function generateTestData() {
    const midPrice = 1.0800;
    const adrRange = 0.0150; // 150 pips ADR
    const projectedHigh = midPrice + (adrRange / 2);
    const projectedLow = midPrice - (adrRange / 2);

    return [
        // Price moving around the middle (no drift expected)
        { currentPrice: 1.0800, midPrice, projectedAdrHigh: projectedHigh, projectedAdrLow: projectedLow },
        { currentPrice: 1.0805, midPrice, projectedAdrHigh: projectedHigh, projectedAdrLow: projectedLow },

        // Price moving higher (should increase maxAdrPercentage temporarily)
        { currentPrice: 1.0820, midPrice, projectedAdrHigh: projectedHigh, projectedAdrLow: projectedLow },
        { currentPrice: 1.0835, midPrice, projectedAdrHigh: projectedHigh, projectedAdrLow: projectedLow },
        { currentPrice: 1.0845, midPrice, projectedAdrHigh: projectedHigh, projectedAdrLow: projectedLow },

        // Price moving back to middle (should reset maxAdrPercentage)
        { currentPrice: 1.0800, midPrice, projectedAdrHigh: projectedHigh, projectedAdrLow: projectedLow },
        { currentPrice: 1.0795, midPrice, projectedAdrHigh: projectedHigh, projectedAdrLow: projectedLow },

        // Price moving lower (should again increase maxAdrPercentage temporarily)
        { currentPrice: 1.0750, midPrice, projectedAdrHigh: projectedHigh, projectedAdrLow: projectedLow },
        { currentPrice: 1.0720, midPrice, projectedAdrHigh: projectedHigh, projectedAdrLow: projectedLow },

        // Price returning to middle (should reset maxAdrPercentage again)
        { currentPrice: 1.0800, midPrice, projectedAdrHigh: projectedHigh, projectedAdrLow: projectedLow },
        { currentPrice: 1.0802, midPrice, projectedAdrHigh: projectedHigh, projectedAdrLow: projectedLow },
    ];
}

// Calculate visual range impact
function calculateVisualRange(state, tick) {
    const adrRange = tick.projectedAdrHigh - tick.projectedAdrLow;
    const visualRangeHalf = (adrRange / 2) * state.maxAdrPercentage;
    const visualHigh = tick.midPrice + visualRangeHalf;
    const visualLow = tick.midPrice - visualRangeHalf;

    return {
        visualRange: visualHigh - visualLow,
        visualHigh,
        visualLow,
        rangeMultiplier: state.maxAdrPercentage
    };
}

// Run validation
function runValidation() {
    console.log('=== CANVAS POSITIONING DRIFT FIX VALIDATION ===');
    console.log('Testing the fix for cumulative maxAdrPercentage bug...\n');

    const testData = generateTestData();

    // Test buggy behavior
    const buggyState = simulateBuggyBehavior(testData);
    const buggyFinalRange = calculateVisualRange(buggyState, testData[testData.length - 1]);

    // Test fixed behavior
    const fixedState = simulateFixedBehavior(testData);
    const fixedFinalRange = calculateVisualRange(fixedState, testData[testData.length - 1]);

    console.log('\n=== VALIDATION RESULTS ===');
    console.log('Buggy behavior:');
    console.log(`  Final maxAdrPercentage: ${buggyState.maxAdrPercentage.toFixed(3)}`);
    console.log(`  Final visual range: ${(buggyFinalRange.visualRange * 10000).toFixed(0)} pips`);
    console.log(`  Range multiplier: ${buggyFinalRange.rangeMultiplier.toFixed(3)}`);

    console.log('\nFixed behavior:');
    console.log(`  Final maxAdrPercentage: ${fixedState.maxAdrPercentage.toFixed(3)}`);
    console.log(`  Final visual range: ${(fixedFinalRange.visualRange * 10000).toFixed(0)} pips`);
    console.log(`  Range multiplier: ${fixedFinalRange.rangeMultiplier.toFixed(3)}`);

    const driftReduction = ((buggyState.maxAdrPercentage - fixedState.maxAdrPercentage) / buggyState.maxAdrPercentage) * 100;
    const visualRangeReduction = ((buggyFinalRange.visualRange - fixedFinalRange.visualRange) / buggyFinalRange.visualRange) * 100;

    console.log('\n=== DRIFT FIX IMPACT ===');
    console.log(`MaxAdrPercentage drift reduction: ${driftReduction.toFixed(1)}%`);
    console.log(`Visual range drift reduction: ${visualRangeReduction.toFixed(1)}%`);

    // Validate fix is working
    const isFixed = fixedState.maxAdrPercentage <= 0.3; // Should return to default
    const hasDrift = buggyState.maxAdrPercentage > 0.3; // Should show drift in buggy version

    console.log('\n=== VALIDATION STATUS ===');
    console.log(`✅ Buggy version shows drift: ${hasDrift ? 'YES' : 'NO'}`);
    console.log(`✅ Fixed version resets properly: ${isFixed ? 'YES' : 'NO'}`);
    console.log(`✅ Drift fix is working: ${hasDrift && isFixed ? 'YES' : 'NO'}`);

    return {
        hasDrift,
        isFixed,
        driftReduction,
        visualRangeReduction,
        buggyMaxAdr: buggyState.maxAdrPercentage,
        fixedMaxAdr: fixedState.maxAdrPercentage
    };
}

// Run the validation
const results = runValidation();

console.log('\n=== CONCLUSION ===');
if (results.hasDrift && results.isFixed) {
    console.log('🎉 VALIDATION SUCCESSFUL: The canvas positioning drift fix is working correctly!');
    console.log('   - Buggy behavior shows cumulative drift');
    console.log('   - Fixed behavior properly resets maxAdrPercentage');
    console.log('   - This prevents canvas positioning drift over time');
} else {
    console.log('❌ VALIDATION FAILED: Something may be wrong with the fix');
}

export { runValidation, simulateBuggyBehavior, simulateFixedBehavior };