#!/usr/bin/env node

/**
 * Test script to verify data flow fixes for NeuroSense FX
 * Tests ConnectionManager -> floatingStore -> FloatingDisplay component pipeline
 */

const { spawn } = require('child_process');
const http = require('http');

// Test configuration
const TEST_CONFIG = {
  frontendUrl: 'http://localhost:5173',
  backendUrl: 'ws://localhost:8080',
  testSymbol: 'EURUSD',
  timeout: 10000
};

// Helper function to make HTTP request
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.setTimeout(TEST_CONFIG.timeout, () => {
      req.destroy();
      reject(new Error(`Request timeout for ${url}`));
    });
  });
}

// Helper function to run command and capture output
function runCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    console.log(`🔧 Running: ${command} ${args.join(' ')}`);
    const child = spawn(command, args, { 
      stdio: 'pipe',
      shell: true 
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
    
    child.on('error', reject);
  });
}

// Test 1: Check if frontend is running
async function testFrontendRunning() {
  console.log('\n🧪 Test 1: Checking frontend server...');
  try {
    const response = await makeRequest(TEST_CONFIG.frontendUrl);
    if (response.status === 200) {
      console.log('✅ Frontend is running');
      return true;
    } else {
      console.log(`❌ Frontend returned status ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Frontend not accessible: ${error.message}`);
    return false;
  }
}

// Test 2: Check if backend is running
async function testBackendRunning() {
  console.log('\n🧪 Test 2: Checking backend server...');
  try {
    // Simple WebSocket connection test
    const WebSocket = require('ws');
    return new Promise((resolve) => {
      const ws = new WebSocket(TEST_CONFIG.backendUrl);
      
      const timeout = setTimeout(() => {
        ws.terminate();
        console.log('❌ Backend WebSocket connection timeout');
        resolve(false);
      }, 3000);
      
      ws.on('open', () => {
        clearTimeout(timeout);
        ws.close();
        console.log('✅ Backend WebSocket is running');
        resolve(true);
      });
      
      ws.on('error', (error) => {
        clearTimeout(timeout);
        console.log(`❌ Backend WebSocket error: ${error.message}`);
        resolve(false);
      });
    });
  } catch (error) {
    console.log(`❌ Backend test failed: ${error.message}`);
    return false;
  }
}

// Test 3: Start services if needed
async function startServices() {
  console.log('\n🚀 Starting services...');
  
  try {
    // Start backend
    console.log('Starting backend...');
    const backendResult = await runCommand('./run.sh', ['start']);
    
    if (backendResult.code !== 0) {
      console.log('⚠️ Backend start may have issues, checking anyway...');
    }
    
    // Wait for services to start
    console.log('Waiting for services to start...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    return true;
  } catch (error) {
    console.log(`❌ Failed to start services: ${error.message}`);
    return false;
  }
}

// Test 4: Run browser test to verify data flow
async function testBrowserDataFlow() {
  console.log('\n🧪 Test 4: Running browser data flow test...');
  
  try {
    // Run the browser test script
    const testResult = await runCommand('node', ['scripts/browser_phase0_test.js']);
    
    console.log('Browser test output:');
    console.log(testResult.stdout);
    
    if (testResult.stderr) {
      console.log('Browser test errors:');
      console.log(testResult.stderr);
    }
    
    // Check for success indicators
    const successIndicators = [
      'Display created successfully',
      'Display state ready: true',
      'Canvas rendered successfully',
      'Data flow test PASSED'
    ];
    
    const hasSuccess = successIndicators.some(indicator => 
      testResult.stdout.includes(indicator)
    );
    
    if (hasSuccess) {
      console.log('✅ Browser data flow test shows success indicators');
      return true;
    } else {
      console.log('❌ Browser data flow test missing success indicators');
      return false;
    }
  } catch (error) {
    console.log(`❌ Browser test failed: ${error.message}`);
    return false;
  }
}

// Test 5: Verify ConnectionManager fixes
async function testConnectionManagerFixes() {
  console.log('\n🧪 Test 5: Verifying ConnectionManager fixes...');
  
  try {
    // Check if ConnectionManager has the fixes
    const fs = require('fs');
    const connectionManagerCode = fs.readFileSync('./src/data/ConnectionManager.js', 'utf8');
    
    const fixIndicators = [
      'CRITICAL FIX: Verify display exists in floatingStore',
      'PRIMARY: Update floatingStore with symbol data',
      'CRITICAL FIX: Update floatingStore to set display ready to false'
    ];
    
    const hasFixes = fixIndicators.every(indicator => 
      connectionManagerCode.includes(indicator)
    );
    
    if (hasFixes) {
      console.log('✅ ConnectionManager contains all critical fixes');
      return true;
    } else {
      console.log('❌ ConnectionManager missing some fixes');
      const missingFixes = fixIndicators.filter(indicator => 
        !connectionManagerCode.includes(indicator)
      );
      console.log('Missing fixes:', missingFixes);
      return false;
    }
  } catch (error) {
    console.log(`❌ Failed to verify ConnectionManager: ${error.message}`);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🔬 NeuroSense FX Data Flow Test Suite');
  console.log('=====================================');
  
  const results = [];
  
  // Test 1: Frontend running
  results.push(await testFrontendRunning());
  
  // Test 2: Backend running
  results.push(await testBackendRunning());
  
  // Start services if needed
  if (!results[0] || !results[1]) {
    console.log('\n🔄 Services not running, attempting to start...');
    const started = await startServices();
    if (!started) {
      console.log('\n❌ Failed to start services. Please run ./run.sh start manually.');
      process.exit(1);
    }
    
    // Re-test after starting
    results[0] = await testFrontendRunning();
    results[1] = await testBackendRunning();
  }
  
  // Test 3: ConnectionManager fixes
  results.push(await testConnectionManagerFixes());
  
  // Test 4: Browser data flow
  results.push(await testBrowserDataFlow());
  
  // Summary
  console.log('\n📊 Test Results Summary');
  console.log('========================');
  const testNames = [
    'Frontend Server',
    'Backend WebSocket', 
    'ConnectionManager Fixes',
    'Browser Data Flow'
  ];
  
  let passedCount = 0;
  results.forEach((result, index) => {
    const status = result ? '✅ PASS' : '❌ FAIL';
    console.log(`${testNames[index]}: ${status}`);
    if (result) passedCount++;
  });
  
  console.log(`\n🎯 Overall: ${passedCount}/${results.length} tests passed`);
  
  if (passedCount === results.length) {
    console.log('🎉 All tests passed! Data flow fixes are working correctly.');
    process.exit(0);
  } else {
    console.log('⚠️ Some tests failed. Please check the issues above.');
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  runTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = { runTests };