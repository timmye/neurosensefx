#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Starting Minimal Canvas Rendering Tests...\n');

// Check if test files exist
const testFiles = [
    'test_canvas_minimal.html',
    'test_svelte_canvas.html',
    'src/components/MinimalCanvasTest.svelte'
];

console.log('📋 Checking test files...');
testFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`✅ ${file} exists`);
    } else {
        console.log(`❌ ${file} missing`);
    }
});

// Check if development server is running
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

// Provide test instructions
console.log('\n🧪 Test Instructions:');
console.log('1. Open test_canvas_minimal.html in your browser to test basic canvas rendering');
console.log('2. Open test_svelte_canvas.html in your browser to test Svelte-like canvas rendering');
console.log('3. If the dev server is running, access the Svelte component test at:');
console.log('   http://localhost:5173/src/components/MinimalCanvasTest.svelte');

console.log('\n🔍 What to look for:');
console.log('- All canvas elements should show colored rectangles and shapes');
console.log('- Each test section should have visible content');
console.log('- Console should show "Canvas X rendered/completed" messages');
console.log('- No error messages in browser console');

console.log('\n📊 Diagnostic Information:');
console.log('- Check browser console for any errors');
console.log('- Verify canvas elements are not hidden by CSS');
console.log('- Confirm canvas contexts are successfully created');
console.log('- Check if hardware acceleration is affecting rendering');

// Create a simple test runner if we can open the browser
console.log('\n🚀 Attempting to open test files in browser...');

const openCommand = process.platform === 'darwin' ? 'open' : 
                   process.platform === 'win32' ? 'start' : 'xdg-open';

try {
    execSync(`${openCommand} test_canvas_minimal.html`, { stdio: 'ignore' });
    console.log('✅ Opened test_canvas_minimal.html in browser');
} catch (error) {
    console.log('❌ Could not open test_canvas_minimal.html automatically');
    console.log('💡 Please open it manually in your browser');
}

try {
    setTimeout(() => {
        execSync(`${openCommand} test_svelte_canvas.html`, { stdio: 'ignore' });
        console.log('✅ Opened test_svelte_canvas.html in browser');
    }, 2000);
} catch (error) {
    console.log('❌ Could not open test_svelte_canvas.html automatically');
    console.log('💡 Please open it manually in your browser');
}

console.log('\n📝 Test Results Analysis:');
console.log('If basic HTML canvas works but Svelte canvas fails:');
console.log('  → Issue is likely in Svelte component lifecycle or binding');
console.log('If both fail:');
console.log('  → Issue is fundamental to canvas rendering in this environment');
console.log('If both work:');
console.log('  → Issue is specific to the FloatingDisplay component implementation');

console.log('\n🎯 Next Steps Based on Results:');
console.log('1. If tests pass → Investigate FloatingDisplay-simplified.svelte specifically');
console.log('2. If tests fail → Check browser compatibility, CSS interference, or environment issues');
console.log('3. If mixed results → Focus on the specific failure patterns');

console.log('\n✨ Minimal Canvas Test Setup Complete!');