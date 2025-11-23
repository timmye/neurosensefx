/**
 * Runtime Canvas Bug Fix Validation
 *
 * This script can be pasted into the browser console on the NeuroSense FX app
 * to validate that the canvas growing bug fix is working correctly at runtime.
 */

console.log('🔍 Starting Runtime Canvas Bug Fix Validation...\n');

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

// Main execution
console.log('🎬 Starting comprehensive validation...');
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