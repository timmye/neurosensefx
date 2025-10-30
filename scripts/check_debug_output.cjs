#!/usr/bin/env node

const http = require('http');
const fs = require('fs');

console.log('🔍 Checking debug output from running application...');

// Make a request to the frontend to check if it's working
const options = {
  hostname: 'localhost',
  port: 5173,
  path: '/',
  method: 'GET',
  timeout: 5000
};

const req = http.request(options, (res) => {
  console.log(`✅ Frontend responding with status: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('✅ Frontend content received');
    
    // Check if our debug components are referenced
    if (data.includes('ContainerDebug')) {
      console.log('✅ ContainerDebug component is referenced in HTML');
    } else {
      console.log('❌ ContainerDebug component not found in HTML');
    }
    
    if (data.includes('debug-panel')) {
      console.log('✅ Debug panel CSS class found');
    } else {
      console.log('❌ Debug panel CSS class not found');
    }
    
    // Check for canvas elements
    if (data.includes('<canvas')) {
      console.log('✅ Canvas element found in HTML');
    } else {
      console.log('❌ Canvas element not found in HTML');
    }
    
    console.log('\n🔍 Investigation Summary:');
    console.log('1. Services are running (frontend: http://localhost:5173)');
    console.log('2. ContainerDebug component has been created');
    console.log('3. FloatingDisplay-simplified has been modified to use ContainerDebug');
    console.log('4. Debug panel should be visible on canvas with red border');
    console.log('5. Check browser console for 🔍 CONTAINER_DEBUG messages');
    console.log('6. Green test rectangle should be visible on canvas');
    console.log('\n🔍 Next Steps:');
    console.log('1. Open http://localhost:5173 in browser');
    console.log('2. Look for floating display with red-bordered canvas');
    console.log('3. Check debug panel shows canvas element and context as ✅');
    console.log('4. Check browser console for debug messages');
    console.log('5. If canvas is still blank, the issue is in visualization functions');
    console.log('6. If debug panel shows ❌, the issue is in canvas setup');
    
    console.log('\n🔍 Expected Debug Panel Output:');
    console.log('- Canvas: ✅');
    console.log('- Context: ✅');
    console.log('- Dimensions: [width]x[height]');
    console.log('- Style: [width] x [height]');
    console.log('- Display: block');
    console.log('- Visible: ✅');
    console.log('- Renders: [count]');
    console.log('- State Ready: ✅');
  });
});

req.on('error', (err) => {
  console.error('❌ Error connecting to frontend:', err.message);
  console.log('🔍 Make sure the frontend is running with: ./run.sh start');
});

req.on('timeout', () => {
  console.error('❌ Request timed out');
  req.destroy();
});

req.end();