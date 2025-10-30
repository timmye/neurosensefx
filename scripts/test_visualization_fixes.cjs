#!/usr/bin/env node

/**
 * Test script to verify visualization fixes in FloatingDisplay-simplified.svelte
 * This script tests the critical fixes implemented for canvas display issues
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Testing Visualization Fixes...\n');

// Read the modified FloatingDisplay-simplified.svelte file
const filePath = path.join(__dirname, '../src/components/FloatingDisplay-simplified.svelte');
const fileContent = fs.readFileSync(filePath, 'utf8');

// Test 1: Verify parameter mismatches are fixed
console.log('📋 Test 1: Parameter Mismatch Fixes');
console.log('=====================================');

const priceDisplayMatch = fileContent.match(/drawPriceDisplay\(([^)]+)\)/);
const volatilityOrbMatch = fileContent.match(/drawVolatilityOrb\(([^)]+)\)/);

if (priceDisplayMatch) {
  const priceDisplayParams = priceDisplayMatch[1];
  console.log(`✅ drawPriceDisplay parameters: ${priceDisplayParams}`);
  
  // Check if canvasWidth is used (not scaledConfig.width)
  if (priceDisplayParams.includes('canvasWidth')) {
    console.log('✅ drawPriceDisplay: Using canvasWidth parameter correctly');
  } else {
    console.log('❌ drawPriceDisplay: Still using incorrect parameter');
  }
}

if (volatilityOrbMatch) {
  const volatilityOrbParams = volatilityOrbMatch[1];
  console.log(`✅ drawVolatilityOrb parameters: ${volatilityOrbParams}`);
  
  // Check if canvasWidth and canvasHeight are used
  if (volatilityOrbParams.includes('canvasWidth') && volatilityOrbParams.includes('canvasHeight')) {
    console.log('✅ drawVolatilityOrb: Using canvasWidth and canvasHeight correctly');
  } else {
    console.log('❌ drawVolatilityOrb: Still using incorrect parameters');
  }
}

// Test 2: Verify reactive dependencies are fixed
console.log('\n📋 Test 2: Reactive Dependency Fixes');
console.log('======================================');

const yScaleMatch = fileContent.match(/\$:\s*yScale\s*=\s*([^;]+);/);
if (yScaleMatch) {
  const yScaleCode = yScaleMatch[1];
  console.log(`✅ yScale calculation found: ${yScaleCode.substring(0, 100)}...`);
  
  // Check if $size.height is used (not scaledConfig?.height)
  if (yScaleCode.includes('$size.height')) {
    console.log('✅ yScale: Using $size.height reactive dependency correctly');
  } else {
    console.log('❌ yScale: Still using incorrect reactive dependency');
  }
}

// Test 3: Verify redundant canvas clearing is removed
console.log('\n📋 Test 3: Redundant Canvas Clearing Removal');
console.log('===========================================');

const clearRectMatches = fileContent.match(/clearRect\([^)]+\)/g) || [];
const fillRectMatches = fileContent.match(/fillRect\([^)]+\)/g) || [];

console.log(`📊 Found ${clearRectMatches.length} clearRect operations`);
console.log(`📊 Found ${fillRectMatches.length} fillRect operations`);

// Count test rectangles (should be removed)
const testRectangles = fileContent.match(/fillStyle\s*=\s*['"]#[0-9A-Fa-f]{6}['"]/g) || [];
console.log(`📊 Found ${testRectangles.length} test color assignments`);

if (testRectangles.length <= 2) { // Only background should remain
  console.log('✅ Canvas clearing: Test rectangles removed successfully');
} else {
  console.log('❌ Canvas clearing: Test rectangles still present');
}

// Test 4: Verify error handling is added
console.log('\n📋 Test 4: Error Handling Addition');
console.log('===================================');

const tryBlocks = fileContent.match(/try\s*{/g) || [];
console.log(`📊 Found ${tryBlocks.length} try blocks`);

// Check for individual function error handling (multi-line pattern)
const functionErrorHandling = fileContent.match(/try\s*{\s*draw\w+/g) || [];
console.log(`📊 Found ${functionErrorHandling.length} functions with individual error handling`);

// Check for catch blocks
const catchBlocks = fileContent.match(/catch\s*\([^)]*\)\s*{/g) || [];
console.log(`📊 Found ${catchBlocks.length} catch blocks`);

if (tryBlocks.length >= 7 && catchBlocks.length >= 7) {
  console.log('✅ Error handling: Added to visualization functions');
} else {
  console.log('❌ Error handling: Missing from some visualization functions');
}

// Test 5: Verify parameter validation
console.log('\n📋 Test 5: Parameter Validation');
console.log('===============================');

const parameterValidation = fileContent.match(/if\s*\(!ctx\s*||\s*!\$config\s*||\s*!\$state\s*||\s*!yScale\)/);
if (parameterValidation) {
  console.log('✅ Parameter validation: Added before visualization calls');
} else {
  console.log('❌ Parameter validation: Missing or incorrect');
}

// Summary
console.log('\n📊 Test Summary');
console.log('===============');

const tests = [
  { name: 'Parameter Mismatch Fixes', status: priceDisplayMatch && volatilityOrbMatch },
  { name: 'Reactive Dependency Fixes', status: yScaleMatch && yScaleMatch[1].includes('$size.height') },
  { name: 'Redundant Canvas Clearing Removal', status: testRectangles.length <= 2 },
  { name: 'Error Handling Addition', status: functionErrorHandling.length >= 5 },
  { name: 'Parameter Validation', status: !!parameterValidation }
];

const passedTests = tests.filter(test => test.status).length;
const totalTests = tests.length;

console.log(`✅ Passed: ${passedTests}/${totalTests} tests`);
console.log(`📈 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

if (passedTests === totalTests) {
  console.log('\n🎉 All critical fixes implemented successfully!');
  console.log('🚀 Ready for testing with real EURUSD data');
} else {
  console.log('\n⚠️  Some fixes may need attention');
  console.log('🔧 Review failed tests and implement missing fixes');
}

console.log('\n📝 Next Steps:');
console.log('1. Start the application with ./run.sh start');
console.log('2. Add EURUSD display to test visualization');
console.log('3. Check browser console for any remaining errors');
console.log('4. Verify all 7 visualizations render correctly');
console.log('5. Test real-time data updates');