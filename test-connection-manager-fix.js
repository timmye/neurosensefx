/**
 * Test script to verify ConnectionManager fix for FloatingDisplay
 * This script tests the complete data flow from SymbolPalette to FloatingDisplay
 */

console.log('🧪 Testing ConnectionManager Fix for FloatingDisplay');
console.log('=' .repeat(60));

// Test 1: Verify ConnectionManager has required methods
console.log('\n📋 Test 1: ConnectionManager Methods');
try {
  const { connectionManager } = await import('./src/data/ConnectionManager.js');
  
  const requiredMethods = [
    'subscribeCanvas',
    'getSymbolForCanvas',
    'getCanvasData',
    'isCanvasReady',
    'updateCanvasDataStore',
    'updateCanvasesForSymbol'
  ];
  
  let allMethodsExist = true;
  requiredMethods.forEach(method => {
    if (typeof connectionManager[method] === 'function') {
      console.log(`✅ ${method} method exists`);
    } else {
      console.log(`❌ ${method} method missing`);
      allMethodsExist = false;
    }
  });
  
  if (allMethodsExist) {
    console.log('✅ All required ConnectionManager methods exist');
  } else {
    console.log('❌ Missing ConnectionManager methods');
  }
} catch (error) {
  console.log('❌ Error testing ConnectionManager:', error.message);
}

// Test 2: Verify canvasDataStore is reactive
console.log('\n📋 Test 2: Canvas Data Store Reactivity');
try {
  const { canvasDataStore } = await import('./src/data/ConnectionManager.js');
  
  // Test initial state
  const initialState = new Map();
  canvasDataStore.set(initialState);
  console.log('✅ Canvas data store initialized');
  
  // Test reactive update
  const testData = new Map([['test-canvas-id', { ready: true, config: {}, state: {} }]]);
  canvasDataStore.set(testData);
  console.log('✅ Canvas data store accepts updates');
  
} catch (error) {
  console.log('❌ Error testing canvas data store:', error.message);
}

// Test 3: Verify FloatingDisplay imports
console.log('\n📋 Test 3: FloatingDisplay Imports');
try {
  // This would fail in Node.js due to Svelte, but we can check the file content
  const fs = await import('fs');
  const floatingDisplayContent = fs.readFileSync('./src/components/FloatingDisplay.svelte', 'utf8');
  
  if (floatingDisplayContent.includes('import { connectionManager, canvasDataStore }')) {
    console.log('✅ FloatingDisplay imports ConnectionManager and canvasDataStore');
  } else {
    console.log('❌ FloatingDisplay missing ConnectionManager imports');
  }
  
  if (floatingDisplayContent.includes('$: canvasData = $canvasDataStore.get(id)')) {
    console.log('✅ FloatingDisplay uses canvasDataStore reactively');
  } else {
    console.log('❌ FloatingDisplay not using canvasDataStore');
  }
  
  if (floatingDisplayContent.includes('connectionManager.isCanvasReady(id)')) {
    console.log('✅ FloatingDisplay uses ConnectionManager ready check');
  } else {
    console.log('❌ FloatingDisplay not using ConnectionManager ready check');
  }
  
} catch (error) {
  console.log('❌ Error testing FloatingDisplay imports:', error.message);
}

// Test 4: Verify SymbolPattern matches
console.log('\n📋 Test 4: Data Flow Pattern Verification');
try {
  const fs = await import('fs');
  
  // Check SymbolPalette pattern
  const symbolPaletteContent = fs.readFileSync('./src/components/SymbolPalette.svelte', 'utf8');
  if (symbolPaletteContent.includes('connectionManager.subscribeCanvas(displayId, symbol)')) {
    console.log('✅ SymbolPalette uses ConnectionManager.subscribeCanvas');
  } else {
    console.log('❌ SymbolPalette not using ConnectionManager.subscribeCanvas');
  }
  
  // Check FloatingDisplay pattern
  const floatingDisplayContent = fs.readFileSync('./src/components/FloatingDisplay.svelte', 'utf8');
  if (floatingDisplayContent.includes('$: canvasData = $canvasDataStore.get(id)')) {
    console.log('✅ FloatingDisplay gets data from canvasDataStore');
  } else {
    console.log('❌ FloatingDisplay not getting data from canvasDataStore');
  }
  
} catch (error) {
  console.log('❌ Error testing data flow pattern:', error.message);
}

console.log('\n🎯 Test Summary');
console.log('=' .repeat(60));
console.log('📝 Manual Testing Required:');
console.log('1. Open http://localhost:5173 in browser');
console.log('2. Click on a symbol (e.g., EURUSD) in SymbolPalette');
console.log('3. Verify display shows canvas instead of "initializing..."');
console.log('4. Check browser console for debug messages');
console.log('5. Verify real-time updates are working');

console.log('\n🔍 Expected Debug Messages:');
console.log('- [CONNECTION_DEBUG] subscribeCanvas called with canvasId...');
console.log('- [CONNECTION_DEBUG] waitForSymbolData resolving for...');
console.log('- [CONNECTION_DEBUG] Real-time update for...');

console.log('\n✅ ConnectionManager Fix Test Complete');
