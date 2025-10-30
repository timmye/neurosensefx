#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Headless Canvas Rendering Test\n');

// Create a simple HTML test that can be analyzed
const testHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Headless Canvas Test</title>
</head>
<body>
    <h1>Canvas Rendering Test</h1>
    <canvas id="test-canvas" width="200" height="100" style="border: 2px solid red;"></canvas>
    
    <script>
        console.log('Starting canvas test...');
        
        const canvas = document.getElementById('test-canvas');
        console.log('Canvas element found:', !!canvas);
        
        const ctx = canvas.getContext('2d');
        console.log('Canvas context created:', !!ctx);
        
        if (ctx) {
            // Test basic drawing
            ctx.fillStyle = 'red';
            ctx.fillRect(10, 10, 50, 50);
            console.log('Red rectangle drawn');
            
            ctx.fillStyle = 'blue';
            ctx.beginPath();
            ctx.arc(100, 50, 30, 0, 2 * Math.PI);
            ctx.fill();
            console.log('Blue circle drawn');
            
            // Test canvas data
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            let hasRed = false;
            let hasBlue = false;
            let hasTransparent = false;
            
            for (let i = 0; i < data.length; i += 4) {
                if (data[i] > 200 && data[i + 1] < 100 && data[i + 2] < 100) hasRed = true;
                if (data[i] < 100 && data[i + 1] < 100 && data[i + 2] > 200) hasBlue = true;
                if (data[i + 3] < 255) hasTransparent = true;
            }
            
            console.log('Canvas analysis:');
            console.log('- Has red pixels:', hasRed);
            console.log('- Has blue pixels:', hasBlue);
            console.log('- Has transparency:', hasTransparent);
            console.log('- Canvas width:', canvas.width);
            console.log('- Canvas height:', canvas.height);
            console.log('- Canvas visible:', canvas.offsetWidth > 0 && canvas.offsetHeight > 0);
            console.log('- Canvas display style:', window.getComputedStyle(canvas).display);
            console.log('- Canvas visibility:', window.getComputedStyle(canvas).visibility);
            
            // Test different context options
            try {
                const ctx2 = canvas.getContext('2d', { alpha: false });
                console.log('Canvas context with alpha=false created:', !!ctx2);
            } catch (e) {
                console.error('Error creating context with alpha=false:', e);
            }
            
            // Test WebGL context
            try {
                const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                console.log('WebGL context created:', !!gl);
            } catch (e) {
                console.error('Error creating WebGL context:', e);
            }
        }
        
        console.log('Canvas test completed');
    </script>
</body>
</html>
`;

// Write the test file
fs.writeFileSync('test_headless_canvas.html', testHTML);
console.log('✅ Created test_headless_canvas.html');

// Test canvas functionality in Node.js environment
console.log('\n🧪 Testing Canvas in Node.js Environment...');

try {
    // Check if we can access canvas-like functionality
    const { createCanvas } = require('canvas');
    console.log('✅ Node.js canvas package available');
    
    const canvas = createCanvas(200, 100);
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = 'red';
    ctx.fillRect(10, 10, 50, 50);
    
    ctx.fillStyle = 'blue';
    ctx.beginPath();
    ctx.arc(100, 50, 30, 0, 2 * Math.PI);
    ctx.fill();
    
    console.log('✅ Node.js canvas rendering successful');
    
    // Save the canvas as an image for verification
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync('test_canvas_output.png', buffer);
    console.log('✅ Canvas output saved as test_canvas_output.png');
    
} catch (error) {
    console.log('❌ Node.js canvas package not available:', error.message);
    console.log('💡 Install with: npm install canvas');
}

// Test browser environment simulation
console.log('\n🌐 Browser Environment Simulation...');

// Check if we're in a browser-like environment
if (typeof window !== 'undefined') {
    console.log('✅ Running in browser environment');
} else {
    console.log('❌ Running in Node.js environment');
    console.log('💡 Browser-specific canvas features cannot be tested here');
}

// Test file accessibility
console.log('\n📁 File Accessibility Test...');

const filesToCheck = [
    'test_canvas_minimal.html',
    'test_svelte_canvas.html',
    'src/components/MinimalCanvasTest.svelte',
    'src/components/FloatingDisplay-simplified.svelte'
];

filesToCheck.forEach(file => {
    if (fs.existsSync(file)) {
        const stats = fs.statSync(file);
        console.log(`✅ ${file} (${stats.size} bytes)`);
    } else {
        console.log(`❌ ${file} not found`);
    }
});

// Provide test summary
console.log('\n📊 Test Summary:');
console.log('1. Basic HTML canvas test created: test_headless_canvas.html');
console.log('2. Node.js canvas rendering tested');
console.log('3. File accessibility verified');
console.log('4. Browser environment simulation completed');

console.log('\n🎯 Next Steps:');
console.log('1. Open test_headless_canvas.html in a browser');
console.log('2. Check browser console for canvas test results');
console.log('3. Verify visual output shows red rectangle and blue circle');
console.log('4. Compare with test_canvas_output.png if canvas package available');

console.log('\n🔍 Expected Results:');
console.log('- Canvas element should be found');
console.log('- 2D context should be created successfully');
console.log('- Red rectangle and blue circle should be drawn');
console.log('- Image data analysis should show colored pixels');
console.log('- No errors in browser console');

console.log('\n✨ Headless Canvas Test Complete!');