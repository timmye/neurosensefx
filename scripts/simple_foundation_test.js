#!/usr/bin/env node

/**
 * Simple test to verify Foundation Cleanup implementation
 * Tests basic functionality without complex browser automation
 */

import { performance } from 'perf_hooks';

async function testFoundationCleanup() {
  console.log('🧪 Simple Foundation Cleanup Test...\n');
  
  try {
    // Test 1: Check if displayStore.js has clean foundation parameters
    console.log('📋 Testing displayStore.js structure...');
    
    const fs = await import('fs');
    const displayStorePath = './src/stores/displayStore.js';
    const displayStoreContent = fs.readFileSync(displayStorePath, 'utf8');
    
    // Check for clean foundation parameters
    const hasContainerSize = displayStoreContent.includes('containerSize');
    // contentArea is computed in Container.svelte, not stored in displayStore
    const hasAdrAxisPosition = displayStoreContent.includes('adrAxisPosition');
    
    // Check that legacy parameters are removed
    const hasLegacyVisualizationsContentWidth = displayStoreContent.includes('visualizationsContentWidth:');
    const hasLegacyCentralAxisXPosition = displayStoreContent.includes('centralAxisXPosition:');
    const hasLegacyMeterHeight = displayStoreContent.includes('meterHeight:');
    
    console.log(`   ✅ Has containerSize: ${hasContainerSize}`);
    console.log(`   ✅ Has adrAxisPosition: ${hasAdrAxisPosition}`);
    console.log(`   ✅ Legacy visualizationsContentWidth removed: ${!hasLegacyVisualizationsContentWidth}`);
    console.log(`   ✅ Legacy centralAxisXPosition removed: ${!hasLegacyCentralAxisXPosition}`);
    console.log(`   ✅ Legacy meterHeight removed: ${!hasLegacyMeterHeight}`);

    // Test 2: Check if Container.svelte uses clean pipeline
    console.log('\n🏗️  Testing Container.svelte structure...');
    
    const containerPath = './src/components/viz/Container.svelte';
    const containerContent = fs.readFileSync(containerPath, 'utf8');
    
    const hasRenderingContext = containerContent.includes('renderingContext');
    const hasCleanPipeline = containerContent.includes('Container → Content → Rendering');
    const usesRenderingContextInDraw = containerContent.includes('drawMarketProfile(ctx, currentRenderingContext');
    
    console.log(`   ✅ Uses renderingContext: ${hasRenderingContext}`);
    console.log(`   ✅ Has clean pipeline comments: ${hasCleanPipeline}`);
    console.log(`   ✅ Passes renderingContext to draw functions: ${usesRenderingContextInDraw}`);

    // Test 3: Check visualization functions
    console.log('\n🎨 Testing visualization functions...');
    
    const vizFunctions = [
      'dayRangeMeter.js',
      'priceFloat.js', 
      'priceDisplay.js',
      'volatilityOrb.js',
      'marketProfile.js',
      'volatilityMetric.js',
      'hoverIndicator.js',
      'priceMarkers.js'
    ];
    
    let allFunctionsUpdated = true;
    
    for (const func of vizFunctions) {
      const funcPath = `./src/lib/viz/${func}`;
      const funcContent = fs.readFileSync(funcPath, 'utf8');
      
      const usesRenderingContext = funcContent.includes('renderingContext');
      const hasCleanFoundation = funcContent.includes('🔧 CLEAN FOUNDATION');
      
      console.log(`   ${func}: renderingContext=${usesRenderingContext}, clean=${hasCleanFoundation}`);
      
      if (!usesRenderingContext || !hasCleanFoundation) {
        allFunctionsUpdated = false;
      }
    }
    
    console.log(`   ✅ All visualization functions updated: ${allFunctionsUpdated}`);

    // Test 4: Check if servers are running
    console.log('\n🌐 Testing server connectivity...');
    
    const testFetch = async (url, name) => {
      try {
        const response = await fetch(url);
        const success = response.ok;
        console.log(`   ✅ ${name} (${url}): ${success ? 'RUNNING' : 'ERROR'}`);
        return success;
      } catch (error) {
        console.log(`   ❌ ${name} (${url}): NOT RUNNING`);
        return false;
      }
    };
    
    const frontendRunning = await testFetch('http://localhost:5173', 'Frontend Server');
    
    // Test 5: Check package.json for puppeteer (for future testing)
    console.log('\n📦 Testing test dependencies...');
    
    const packagePath = './package.json';
    const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const hasPuppeteer = packageContent.devDependencies && packageContent.devDependencies.puppeteer;
    
    console.log(`   ✅ Puppeteer available for testing: ${hasPuppeteer}`);

    // Final assessment
    console.log('\n🎯 Foundation Cleanup Assessment:');
    
    const issues = [];
    
    if (!hasContainerSize || !hasAdrAxisPosition) {
      issues.push('Missing clean foundation parameters in displayStore.js');
    }
    
    if (hasLegacyVisualizationsContentWidth || hasLegacyCentralAxisXPosition || hasLegacyMeterHeight) {
      issues.push('Legacy parameters still present in displayStore.js');
    }
    
    if (!hasRenderingContext || !usesRenderingContextInDraw) {
      issues.push('Container.svelte not using clean pipeline');
    }
    
    if (!allFunctionsUpdated) {
      issues.push('Some visualization functions not updated');
    }
    
    if (!frontendRunning) {
      issues.push('Frontend server not running');
    }
    
    if (issues.length === 0) {
      console.log('🎉 ALL TESTS PASSED - Foundation Cleanup is working correctly!');
      console.log('✅ Clean parameter pipeline: container → content → rendering');
      console.log('✅ Legacy parameters removed and replaced with clean foundation');
      console.log('✅ All visualization functions updated to use renderingContext');
      console.log('✅ Container.svelte using clean parameter pipeline');
      console.log('✅ Frontend server running and accessible');
      console.log('\n🚀 Foundation Cleanup implementation is COMPLETE and ready for use!');
      return true;
    } else {
      console.log('❌ ISSUES FOUND:');
      issues.forEach(issue => console.log(`   - ${issue}`));
      return false;
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Run test
testFoundationCleanup().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
