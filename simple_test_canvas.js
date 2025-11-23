// DEBUGGER: Simple test to check if fixes are loaded in the running app
// TO BE DELETED BEFORE FINAL REPORT

import http from 'http';
import https from 'https';

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
  });
}

async function testApplicationState() {
  console.log('[DEBUGGER:TEST] Testing application state...');

  try {
    // Get the main page HTML to see if it loads
    console.log('[DEBUGGER:TEST] Fetching main page...');
    const html = await makeRequest('http://localhost:5174');

    if (html.includes('createTestCanvas')) {
      console.log('[DEBUGGER:TEST] ✅ createTestCanvas function found in HTML');
    } else {
      console.log('[DEBUGGER:TEST] ❌ createTestCanvas function NOT found in HTML');
    }

    if (html.includes('scheduleRender')) {
      console.log('[DEBUGGER:TEST] ✅ scheduleRender function found in HTML');
    } else {
      console.log('[DEBUGGER:TEST] ❌ scheduleRender function NOT found in HTML');
    }

    if (html.includes('ctx.setTransform(1, 0, 0, 1, 0, 0)')) {
      console.log('[DEBUGGER:TEST] ✅ Transform matrix fix found in HTML');
    } else {
      console.log('[DEBUGGER:TEST] ❌ Transform matrix fix NOT found in HTML');
    }

    // Check for drift monitoring
    if (html.includes('DEBUGGER') || html.includes('DRIFT')) {
      console.log('[DEBUGGER:TEST] ✅ Debug monitoring found in HTML');
    } else {
      console.log('[DEBUGGER:TEST] ❌ Debug monitoring NOT found in HTML');
    }

    console.log('[DEBUGGER:TEST] Application appears to be running successfully');
    console.log('[DEBUGGER:TEST] Manual testing required: Open http://localhost:5174 in browser');
    console.log('[DEBUGGER:TEST] Then run: window.createTestCanvas("EURUSD", 200, 200)');

  } catch (error) {
    console.error('[DEBUGGER:TEST] Error testing application:', error.message);
  }
}

testApplicationState();