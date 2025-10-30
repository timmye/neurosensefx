#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Comprehensive Canvas Rendering Test Suite\n');

// Test files we've created
const testFiles = [
    'test_canvas_minimal.html',
    'test_svelte_canvas.html', 
    'test_headless_canvas.html',
    'test_canvas_standalone.html',
    'src/components/MinimalCanvasTest.svelte',
    'src/routes/test/+page.svelte'
];

console.log('📋 Checking test files...');
testFiles.forEach(file => {
    if (fs.existsSync(file)) {
        const stats = fs.statSync(file);
        console.log(`✅ ${file} (${stats.size} bytes)`);
    } else {
        console.log(`❌ ${file} missing`);
    }
});

// Check development server
console.log('\n🌐 Checking development server...');
try {
    const response = execSync('curl -s -o /dev/null -w "%{http_code}" http://localhost:5173', { timeout: 5000 });
    if (response.toString() === '200') {
        console.log('✅ Development server is running on http://localhost:5173');
    } else {
        console.log('❌ Development server returned status:', response.toString());
    }
} catch (error) {
    console.log('❌ Development server is not running or not accessible');
    console.log('💡 Start the development server with: ./run.sh start');
}

// Test file accessibility via HTTP
console.log('\n🌐 Testing file accessibility...');
const accessibleFiles = [];
const inaccessibleFiles = [];

testFiles.forEach(file => {
    if (file.endsWith('.html')) {
        try {
            // Try to access the file via the dev server
            const response = execSync(`curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/${file}`, { timeout: 3000 });
            if (response.toString() === '200') {
                console.log(`✅ ${file} accessible via HTTP`);
                accessibleFiles.push(file);
            } else {
                console.log(`❌ ${file} not accessible via HTTP (status: ${response.toString()})`);
                inaccessibleFiles.push(file);
            }
        } catch (error) {
            console.log(`❌ ${file} not accessible via HTTP (error: ${error.message})`);
            inaccessibleFiles.push(file);
        }
    }
});

// Provide test instructions
console.log('\n🧪 Test Instructions:');
console.log('1. Open test_canvas_standalone.html in your browser - this is the most comprehensive test');
console.log('2. Open test_canvas_minimal.html for basic canvas functionality');
console.log('3. Open test_headless_canvas.html for diagnostic information');
console.log('4. If the dev server is running, access:');
console.log('   - http://localhost:5173/test_canvas_standalone.html');
console.log('   - http://localhost:5173/test_canvas_minimal.html');
console.log('   - http://localhost:5173/test_headless_canvas.html');

console.log('\n🔍 What to look for:');
console.log('- All canvas elements should show colored rectangles and shapes');
console.log('- Each test section should have visible content');
console.log('- Console should show "Canvas X rendered/completed" messages');
console.log('- No error messages in browser console');
console.log('- Test results should show "PASSED" for all basic functionality');

console.log('\n📊 Expected Test Results:');
console.log('✅ Basic Canvas Test: Should show red, green, and blue shapes');
console.log('✅ Multiple Canvas Test: Should show 3 different colored canvases');
console.log('✅ Context Options Test: Should show different context rendering');
console.log('✅ Visibility Test: Should show canvas is visible and properly styled');
console.log('✅ Environment Info: Should show browser capabilities');

console.log('\n🎯 Diagnosis Guide:');
console.log('If basic HTML canvas works but Svelte canvas fails:');
console.log('  → Issue is likely in Svelte component lifecycle or binding');
console.log('If both fail:');
console.log('  → Issue is fundamental to canvas rendering in this environment');
console.log('If both work:');
console.log('  → Issue is specific to the FloatingDisplay component implementation');

console.log('\n🔧 Common Issues and Solutions:');
console.log('1. Canvas shows blank content:');
console.log('   → Check browser console for JavaScript errors');
console.log('   → Verify canvas context is created successfully');
console.log('   → Check if canvas is being cleared immediately after drawing');

console.log('2. Canvas not visible:');
console.log('   → Check CSS display and visibility properties');
console.log('   → Verify canvas has dimensions (width/height)');
console.log('   → Check z-index and positioning');

console.log('3. Canvas context creation fails:');
console.log('   → Browser may not support canvas');
console.log('   → Hardware acceleration may be disabled');
console.log('   → Browser security restrictions may be blocking');

console.log('\n📝 Test Results Analysis:');
console.log('Please run the tests and report the following:');
console.log('1. Which tests pass/fail');
console.log('2. Any error messages in browser console');
console.log('3. Whether canvas content is visible');
console.log('4. Browser and version being used');

console.log('\n🚀 Quick Test Commands:');
console.log('# Open the most comprehensive test:');
console.log('open test_canvas_standalone.html');
console.log('');
console.log('# Or if dev server is running:');
console.log('open http://localhost:5173/test_canvas_standalone.html');

console.log('\n📈 Next Steps Based on Results:');
console.log('1. If all tests pass → Investigate FloatingDisplay-simplified.svelte specifically');
console.log('2. If some tests fail → Focus on the specific failure patterns');
console.log('3. If all tests fail → Check browser compatibility and environment issues');

console.log('\n✨ Comprehensive Canvas Test Suite Complete!');
console.log('📞 Please run the tests and share the results for further analysis.');