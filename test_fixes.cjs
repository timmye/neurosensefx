// DEBUGGER: Test script to validate drift fixes and canvas creation
// TO BE DELETED BEFORE FINAL REPORT

const http = require('http');
const fs = require('fs');

function testFixes() {
  console.log('[DEBUGGER:FIXES] Testing drift fixes implementation...');

  // Test 1: Check if Container.svelte has the transform matrix fix
  try {
    const containerFile = fs.readFileSync('/workspaces/neurosensefx/src/components/viz/Container.svelte', 'utf8');

    if (containerFile.includes('ctx.setTransform(1, 0, 0, 1, 0, 0)')) {
      console.log('[DEBUGGER:FIXES] ✅ Transform matrix fix found in Container.svelte');
    } else {
      console.log('[DEBUGGER:FIXES] ❌ Transform matrix fix NOT found in Container.svelte');
    }

    if (containerFile.includes('CRITICAL FIX: Explicit reset to identity matrix')) {
      console.log('[DEBUGGER:FIXES] ✅ Transform matrix comment found');
    } else {
      console.log('[DEBUGGER:FIXES] ❌ Transform matrix comment NOT found');
    }

  } catch (error) {
    console.log('[DEBUGGER:FIXES] ❌ Error reading Container.svelte:', error.message);
  }

  // Test 2: Check if FloatingDisplay.svelte has the render deduplication fix
  try {
    const floatingFile = fs.readFileSync('/workspaces/neurosensefx/src/components/FloatingDisplay.svelte', 'utf8');

    if (floatingFile.includes('let pendingRender = false')) {
      console.log('[DEBUGGER:FIXES] ✅ Render deduplication variable found in FloatingDisplay.svelte');
    } else {
      console.log('[DEBUGGER:FIXES] ❌ Render deduplication variable NOT found in FloatingDisplay.svelte');
    }

    if (floatingFile.includes('function scheduleRender()')) {
      console.log('[DEBUGGER:FIXES] ✅ scheduleRender function found in FloatingDisplay.svelte');
    } else {
      console.log('[DEBUGGER:FIXES] ❌ scheduleRender function NOT found in FloatingDisplay.svelte');
    }

    if (floatingFile.includes('CRITICAL FIX: Render deduplication')) {
      console.log('[DEBUGGER:FIXES] ✅ Render deduplication comment found');
    } else {
      console.log('[DEBUGGER:FIXES] ❌ Render deduplication comment NOT found');
    }

  } catch (error) {
    console.log('[DEBUGGER:FIXES] ❌ Error reading FloatingDisplay.svelte:', error.message);
  }

  // Test 3: Check if App.svelte has the createTestCanvas function
  try {
    const appFile = fs.readFileSync('/workspaces/neurosensefx/src/App.svelte', 'utf8');

    if (appFile.includes('window.createTestCanvas')) {
      console.log('[DEBUGGER:FIXES] ✅ createTestCanvas function found in App.svelte');
    } else {
      console.log('[DEBUGGER:FIXES] ❌ createTestCanvas function NOT found in App.svelte');
    }

    if (appFile.includes('TESTING: Global test canvas creation function')) {
      console.log('[DEBUGGER:FIXES] ✅ Test canvas comment found');
    } else {
      console.log('[DEBUGGER:FIXES] ❌ Test canvas comment NOT found');
    }

  } catch (error) {
    console.log('[DEBUGGER:FIXES] ❌ Error reading App.svelte:', error.message);
  }

  // Test 4: Check if the application is running
  console.log('\n[DEBUGGER:FIXES] Testing application connectivity...');

  const req = http.get('http://localhost:5174', (res) => {
    if (res.statusCode === 200) {
      console.log('[DEBUGGER:FIXES] ✅ Application is running on localhost:5174');

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Check if the app loads the JavaScript bundles
        if (data.includes('/src/main.js')) {
          console.log('[DEBUGGER:FIXES] ✅ Main JavaScript bundle is referenced');
        } else {
          console.log('[DEBUGGER:FIXES] ❌ Main JavaScript bundle NOT referenced');
        }

        if (data.includes('NeuroSense FX')) {
          console.log('[DEBUGGER:FIXES] ✅ Application title found');
        } else {
          console.log('[DEBUGGER:FIXES] ❌ Application title NOT found');
        }

        console.log('\n[DEBUGGER:FIXES] Manual Testing Required:');
        console.log('1. Open http://localhost:5174 in browser');
        console.log('2. Open browser console (F12)');
        console.log('3. Run: window.createTestCanvas("EURUSD", 200, 200)');
        console.log('4. Check for: Canvas elements appearing in DOM');
        console.log('5. Check for: Debug messages in console');
        console.log('6. Check for: Any error messages');

        console.log('\n[DEBUGGER:FIXES] Expected behavior:');
        console.log('- Display should be created with unique ID');
        console.log('- Canvas element should appear in DOM');
        console.log('- Console should show creation messages');
        console.log('- No canvas positioning drift should occur');
      });
    } else {
      console.log(`[DEBUGGER:FIXES] ❌ Application returned status ${res.statusCode}`);
    }
  });

  req.on('error', (error) => {
    console.log('[DEBUGGER:FIXES] ❌ Cannot connect to application:', error.message);
  });

  req.setTimeout(5000, () => {
    console.log('[DEBUGGER:FIXES] ❌ Connection timeout - application may not be ready');
    req.destroy();
  });
}

testFixes();