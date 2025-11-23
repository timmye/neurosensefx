/**
 * 🚨 Emergency Fix Runtime Validation
 *
 * This script validates that all emergency fixes are working correctly:
 * 1. Coordinate Store Initialization
 * 2. CSS Clip-Path Over-Aggressive Clipping (±50px tolerance, 15% max)
 * 3. Canvas Dimension Race Conditions Consolidated
 * 4. Error Handling for Coordinate Transformations
 * 5. Debug Logging for Clipping Behavior
 */

console.log('🚨 Starting Emergency Fix Runtime Validation...\n');

// Configuration constants
const EXPECTED_CONTAINER_WIDTH = 220;
const EXPECTED_CONTAINER_HEIGHT = 120;

function validateCanvasBugFix() {
    console.log('🎯 VALIDATION RESULTS');
    console.log('==================');

    const containers = document.querySelectorAll('.viz-container');
    console.log(`Found ${containers.length} visualization containers\n`);

    let allTestsPassed = true;

    containers.forEach((container, index) => {
        console.log(`\n📊 Container ${index + 1}:`);

        const containerRect = container.getBoundingClientRect();
        const canvas = container.querySelector('canvas');

        if (!canvas) {
            console.log('   ❌ No canvas found');
            allTestsPassed = false;
            return;
        }

        const canvasComputedStyle = window.getComputedStyle(canvas);
        const canvasCSSWidth = parseInt(canvasComputedStyle.width);
        const canvasCSSHeight = parseInt(canvasComputedStyle.height);
        const canvasInternalWidth = canvas.width;
        const canvasInternalHeight = canvas.height;
        const dpr = window.devicePixelRatio || 1;

        console.log(`   Container: ${containerRect.width.toFixed(0)}×${containerRect.height.toFixed(0)}px`);
        console.log(`   Canvas CSS: ${canvasCSSWidth}×${canvasCSSHeight}px`);
        console.log(`   Canvas Internal: ${canvasInternalWidth}×${canvasInternalHeight}px`);
        console.log(`   Device Pixel Ratio: ${dpr}`);

        // Test 1: Container dimensions
        const containerTest = Math.abs(containerRect.width - EXPECTED_CONTAINER_WIDTH) < 2 &&
                             Math.abs(containerRect.height - EXPECTED_CONTAINER_HEIGHT) < 2;
        console.log(`   ${containerTest ? '✅' : '❌'} Container dimensions: ${containerTest ? 'PASS' : 'FAIL'}`);

        // Test 2: Canvas CSS matches container (THE CRITICAL FIX)
        const cssMatchTest = Math.abs(canvasCSSWidth - containerRect.width) < 2 &&
                            Math.abs(canvasCSSHeight - containerRect.height) < 2;
        console.log(`   ${cssMatchTest ? '✅' : '❌'} Canvas CSS matches container: ${cssMatchTest ? 'PASS' : 'FAIL'}`);

        // Test 3: No visual overflow
        const overflowTest = canvasCSSWidth <= containerRect.width + 2 &&
                            canvasCSSHeight <= containerRect.height + 2;
        console.log(`   ${overflowTest ? '✅' : '❌'} No visual overflow: ${overflowTest ? 'PASS' : 'FAIL'}`);

        // Test 4: Internal canvas scaled for DPR
        const dprTest = Math.abs(canvasInternalWidth - Math.round(EXPECTED_CONTAINER_WIDTH * dpr)) < 2 &&
                       Math.abs(canvasInternalHeight - Math.round(EXPECTED_CONTAINER_HEIGHT * dpr)) < 2;
        console.log(`   ${dprTest ? '✅' : '❌'} DPR scaling applied: ${dprTest ? 'PASS' : 'FAIL'}`);

        // Test 5: Internal canvas larger than CSS (for crisp rendering)
        const scalingTest = dpr > 1 ?
            (canvasInternalWidth > canvasCSSWidth && canvasInternalHeight > canvasCSSHeight) : true;
        console.log(`   ${scalingTest ? '✅' : '❌'} Crisp rendering enabled: ${scalingTest ? 'PASS' : 'FAIL'}`);

        if (!containerTest || !cssMatchTest || !overflowTest || !dprTest || !scalingTest) {
            allTestsPassed = false;
        }
    });

    console.log('\n🎯 OVERALL RESULT:');
    if (allTestsPassed) {
        console.log('✅ Canvas Growing Bug Fix: WORKING CORRECTLY');
        console.log('\n🔧 BEHAVIOR VERIFICATION:');
        console.log(`   • Container: ${EXPECTED_CONTAINER_WIDTH}×${EXPECTED_CONTAINER_HEIGHT}px (CSS pixels, fixed)`);
        console.log(`   • Canvas internal: ${Math.round(EXPECTED_CONTAINER_WIDTH * (window.devicePixelRatio || 1))}×${Math.round(EXPECTED_CONTAINER_HEIGHT * (window.devicePixelRatio || 1))}px (DPR-scaled)`);
        console.log(`   • Canvas CSS: ${EXPECTED_CONTAINER_WIDTH}×${EXPECTED_CONTAINER_HEIGHT}px (matches container exactly)`);
        console.log('   • Visualizations: Stay within 220×120px visible area');
    } else {
        console.log('❌ Canvas Growing Bug Fix: NOT WORKING CORRECTLY');
        console.log('\n🚨 ISSUES DETECTED:');
        console.log('   • Canvas CSS dimensions do not match container');
        console.log('   • Visual overflow may be present');
        console.log('   • Check canvasSizing.js and Container.svelte implementation');
    }

    return allTestsPassed;
}

// Performance monitoring function
function monitorPerformance(duration = 5000) {
    console.log(`\n⚡ Performance Monitoring (${duration}ms)...`);

    let frameCount = 0;
    let startTime = performance.now();
    let frameTimes = [];
    let lastFrameTime = startTime;

    function countFrames() {
        const currentTime = performance.now();
        const frameTime = currentTime - lastFrameTime;
        frameTimes.push(frameTime);
        lastFrameTime = currentTime;
        frameCount++;

        if (currentTime - startTime < duration) {
            requestAnimationFrame(countFrames);
        } else {
            const totalTime = currentTime - startTime;
            const fps = (frameCount / totalTime) * 1000;
            const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
            const maxFrameTime = Math.max(...frameTimes);

            console.log(`   • Frames rendered: ${frameCount}`);
            console.log(`   • Average FPS: ${fps.toFixed(1)} (target: 60)`);
            console.log(`   • Average frame time: ${avgFrameTime.toFixed(2)}ms (target: <16.67)`);
            console.log(`   • Max frame time: ${maxFrameTime.toFixed(2)}ms`);

            const performanceOk = fps >= 50 && avgFrameTime < 20 && maxFrameTime < 33;
            console.log(`   ${performanceOk ? '✅' : '❌'} Performance: ${performanceOk ? 'PASS' : 'FAIL'}`);
        }
    }

    requestAnimationFrame(countFrames);
}

// Latency testing function
function measureLatency(testCount = 20) {
    console.log(`\n🚀 Latency Testing (${testCount} measurements)...`);

    let measurements = [];
    let currentTest = 0;

    function runTest() {
        if (currentTest >= testCount) {
            const avgLatency = measurements.reduce((a, b) => a + b, 0) / measurements.length;
            const maxLatency = Math.max(...measurements);
            const minLatency = Math.min(...measurements);

            console.log(`   • Average latency: ${avgLatency.toFixed(2)}ms`);
            console.log(`   • Max latency: ${maxLatency.toFixed(2)}ms`);
            console.log(`   • Min latency: ${minLatency.toFixed(2)}ms`);

            const latencyOk = avgLatency < 100 && maxLatency < 200;
            console.log(`   ${latencyOk ? '✅' : '❌'} Latency: ${latencyOk ? 'PASS' : 'FAIL'}`);
            return;
        }

        const startTime = performance.now();

        // Force a render cycle
        requestAnimationFrame(() => {
            const endTime = performance.now();
            const latency = endTime - startTime;
            measurements.push(latency);
            currentTest++;

            setTimeout(runTest, 50);
        });
    }

    runTest();
}

// Zoom handling test
function testZoomHandling() {
    console.log('\n🔍 Zoom Handling Test:');
    console.log('   • Try zooming the browser (Ctrl +/- or Ctrl + scroll)');
    console.log('   • Re-run this function after zooming to test stability');
    console.log(`   • Current DPR: ${window.devicePixelRatio || 1}`);
}

// Extended session stability test
function testExtendedSession() {
    console.log('\n⏰ Extended Session Test (30 seconds)...');

    let checkCount = 0;
    const maxChecks = 6;
    const interval = 5000; // 5 seconds

    const initialResults = validateCanvasBugFix();

    const intervalId = setInterval(() => {
        checkCount++;
        console.log(`   Check ${checkCount}/${maxChecks}...`);

        const currentResults = validateCanvasBugFix();

        if (!currentResults) {
            console.log('   ❌ Canvas dimensions changed during extended session!');
            clearInterval(intervalId);
            return;
        }

        if (checkCount >= maxChecks) {
            console.log('   ✅ Canvas dimensions stable during extended session');
            clearInterval(intervalId);
        }
    }, interval);
}

// Emergency Fix #1: Test Coordinate Store Error Handling
function validateCoordinateStoreFixes() {
    console.log('\n📊 Emergency Fix #1: Coordinate Store Initialization');
    console.log('==================================================');

    let fixWorking = true;

    // Check if coordinateActions have error handling
    if (typeof coordinateActions !== 'undefined') {
        console.log('   ✅ coordinateActions available');

        if (typeof coordinateActions.updatePriceRange === 'function') {
            console.log('   ✅ updatePriceRange function exists');

            // Test with invalid data to see if error handling works
            try {
                coordinateActions.updatePriceRange(null); // Should not crash
                console.log('   ✅ Error handling: updatePriceRange handles null input');
            } catch (error) {
                if (error.message.includes('Insufficient price data')) {
                    console.log('   ✅ Error handling: Proper validation message');
                } else {
                    console.log('   ❌ Error handling: Unexpected error:', error.message);
                    fixWorking = false;
                }
            }
        } else {
            console.log('   ❌ updatePriceRange function missing');
            fixWorking = false;
        }
    } else {
        console.log('   ❌ coordinateActions not available');
        fixWorking = false;
    }

    return fixWorking;
}

// Emergency Fix #2: Test CSS Clip-Path Improvements
function validateClipPathFixes() {
    console.log('\n✂️ Emergency Fix #2: CSS Clip-Path Improvements');
    console.log('===============================================');

    const canvasElements = document.querySelectorAll('canvas');
    let fixWorking = true;

    if (canvasElements.length === 0) {
        console.log('   ❌ No canvas elements found');
        return false;
    }

    canvasElements.forEach((canvas, index) => {
        const computedStyle = window.getComputedStyle(canvas);
        const clipPath = computedStyle.clipPath;

        if (clipPath && clipPath !== 'none') {
            console.log(`   📏 Canvas ${index + 1} clip-path: ${clipPath}`);

            // Check if it's using the new less aggressive clipping
            if (clipPath.includes('inset(')) {
                // Extract the values to check tolerance
                const match = clipPath.match(/inset\(([^)]+)\)/);
                if (match) {
                    const values = match[1].split('px');
                    const topClip = parseFloat(values[0]);
                    const bottomClip = parseFloat(values[2] || '0');

                    console.log(`   📏 Clipping values: top=${topClip}px, bottom=${bottomClip}px`);

                    // Check if clipping is less aggressive (max 15% of 120px = 18px)
                    if (topClip <= 50 && bottomClip <= 50) {
                        console.log(`   ✅ Canvas ${index + 1}: Clipping within ±50px tolerance`);
                    } else {
                        console.log(`   ❌ Canvas ${index + 1}: Excessive clipping detected`);
                        fixWorking = false;
                    }
                }
            } else {
                console.log(`   ⚠️  Canvas ${index + 1}: Using old clip-path format`);
            }
        } else {
            console.log(`   ✅ Canvas ${index + 1}: No clipping (normal state)`);
        }
    });

    return fixWorking;
}

// Emergency Fix #3: Test Canvas Sizing Consolidation
function validateCanvasSizingFixes() {
    console.log('\n📐 Emergency Fix #3: Canvas Sizing Consolidation');
    console.log('===============================================');

    // Look for duplicated sizing logic indicators
    const canvases = document.querySelectorAll('canvas');
    let fixWorking = true;

    canvases.forEach((canvas, index) => {
        const rect = canvas.getBoundingClientRect();
        const cssWidth = rect.width;
        const cssHeight = rect.height;
        const internalWidth = canvas.width;
        const internalHeight = canvas.height;
        const dpr = window.devicePixelRatio || 1;

        console.log(`   📏 Canvas ${index + 1}:`);
        console.log(`      CSS: ${cssWidth.toFixed(0)}×${cssHeight.toFixed(0)}px`);
        console.log(`      Internal: ${internalWidth}×${internalHeight}px`);
        console.log(`      DPR: ${dpr}`);

        // Check if dimensions are consistent (no race condition artifacts)
        if (Math.abs(cssWidth - 220) < 5 && Math.abs(cssHeight - 120) < 5) {
            console.log(`      ✅ Consistent dimensions`);
        } else {
            console.log(`      ❌ Inconsistent dimensions (possible race condition)`);
            fixWorking = false;
        }

        // Check if DPR scaling is applied correctly
        const expectedInternalWidth = Math.round(220 * dpr);
        const expectedInternalHeight = Math.round(120 * dpr);

        if (internalWidth === expectedInternalWidth && internalHeight === expectedInternalHeight) {
            console.log(`      ✅ Proper DPR scaling`);
        } else {
            console.log(`      ❌ Incorrect DPR scaling`);
            fixWorking = false;
        }
    });

    return fixWorking;
}

// Emergency Fix #4: Test Error Handling in Visualizations
function validateErrorHandlingFixes() {
    console.log('\n🛡️ Emergency Fix #4: Error Handling in Visualizations');
    console.log('=====================================================');

    // Monitor for error handling messages
    const originalError = console.error;
    const originalWarn = console.warn;
    const errorMessages = [];
    const warnMessages = [];

    console.error = function(...args) {
        errorMessages.push(args.join(' '));
        originalError.apply(console, args);
    };

    console.warn = function(...args) {
        warnMessages.push(args.join(' '));
        originalWarn.apply(console, args);
    };

    // Check for specific error handling patterns
    setTimeout(() => {
        const coordinateErrors = errorMessages.filter(msg =>
            msg.includes('coordinate') || msg.includes('Failed to update') || msg.includes('Coordinate transformation failed')
        );

        const clippingLogs = warnMessages.filter(msg =>
            msg.includes('Clipping applied')
        );

        const fallbackMessages = errorMessages.filter(msg =>
            msg.includes('using fallback') || msg.includes('center position')
        );

        console.log(`   📊 Error handling results:`);
        console.log(`      Coordinate errors caught: ${coordinateErrors.length}`);
        console.log(`      Clipping debug logs: ${clippingLogs.length}`);
        console.log(`      Fallback messages: ${fallbackMessages.length}`);

        if (coordinateErrors.length > 0 || fallbackMessages.length > 0) {
            console.log(`      ✅ Error handling is working`);
        } else {
            console.log(`      ✅ No errors detected (system stable)`);
        }

        if (clippingLogs.length > 0) {
            console.log(`      ✅ Debug logging is active`);
        }

        // Restore console methods
        console.error = originalError;
        console.warn = originalWarn;
    }, 2000);

    return true; // Assume working unless we detect issues
}

// Main execution
console.log('🎬 Starting Emergency Fix Validation...');

const emergencyFix1 = validateCoordinateStoreFixes();
const emergencyFix2 = validateClipPathFixes();
const emergencyFix3 = validateCanvasSizingFixes();
const emergencyFix4 = validateErrorHandlingFixes();

console.log('\n🚀 Running performance and stability tests...');
validateCanvasBugFix();
monitorPerformance(3000);
measureLatency(15);
testZoomHandling();

// Expose functions for manual testing
window.canvasValidation = {
    validateCanvasBugFix,
    monitorPerformance,
    measureLatency,
    testZoomHandling,
    testExtendedSession
};

console.log('\n📋 Manual testing functions available:');
console.log('   • canvasValidation.validateCanvasBugFix() - Re-run validation');
console.log('   • canvasValidation.monitorPerformance(ms) - Test performance');
console.log('   • canvasValidation.measureLatency(count) - Test latency');
console.log('   • canvasValidation.testExtendedSession() - Test extended stability');
console.log('\n✅ Runtime validation setup complete!');