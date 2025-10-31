#!/usr/bin/env node

/**
 * Complete Resize Fix Verification Test
 * Tests the final implementation with all fixes applied
 */

const { chromium } = require('playwright');

async function testCompleteResizeFix() {
  console.log('🧪 TESTING COMPLETE RESIZE FIX');
  console.log('=====================================');

  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 50 // Slower for better observation
  });
  
  const context = await browser.newContext({
    viewport: { width: 1200, height: 800 }
  });
  
  const page = await context.newPage();
  
  // Listen for console events to detect errors
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    });
    
    if (msg.type() === 'error') {
      console.log(`❌ Console Error: ${msg.text()}`);
    }
  });
  
  try {
    console.log('📱 Step 1: Opening NeuroSense FX...');
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(2000);
    
    // Check for JavaScript errors on load
    const errorsOnLoad = consoleMessages.filter(msg => msg.type === 'error');
    if (errorsOnLoad.length > 0) {
      console.log('❌ JavaScript errors found on page load:');
      errorsOnLoad.forEach(err => console.log(`  - ${err.text}`));
      return;
    }
    console.log('✅ No JavaScript errors on page load');
    
    console.log('🎯 Step 2: Creating test display...');
    
    // Press Ctrl+N to create new display
    await page.keyboard.press('Control+N');
    await page.waitForTimeout(1000);
    
    // Wait for display to appear
    await page.waitForSelector('.enhanced-floating', { timeout: 5000 });
    const testDisplay = await page.locator('.enhanced-floating').first();
    
    console.log('✅ Display found! Getting initial state...');
    
    // Get initial position and size
    const initialBounds = await testDisplay.boundingBox();
    console.log(`📏 Initial position: (${initialBounds.x}, ${initialBounds.y})`);
    console.log(`📏 Initial size: ${initialBounds.width}x${initialBounds.height}`);
    
    console.log('🎯 Step 3: Testing resize handle visibility...');
    
    // Hover over display to show resize handles
    await testDisplay.hover();
    await page.waitForTimeout(500);
    
    // Check if resize handles are visible
    const resizeHandles = await page.locator('.resize-handle').count();
    console.log(`🔧 Resize handles visible: ${resizeHandles}/8`);
    
    if (resizeHandles < 8) {
      console.log('⚠️  Not all resize handles visible, but continuing test...');
    }
    
    console.log('🎯 Step 4: Testing SE corner resize (most critical)...');
    
    // Find SE resize handle (bottom-right corner)
    const seHandle = await page.locator('.resize-handle.se').first();
    if (await seHandle.isVisible()) {
      console.log('🔧 Found SE handle, testing resize...');
      
      const startPos = await seHandle.boundingBox();
      const centerX = startPos.x + startPos.width / 2;
      const centerY = startPos.y + startPos.height / 2;
      
      // Move to handle and drag
      await page.mouse.move(centerX, centerY);
      await page.mouse.down();
      await page.waitForTimeout(100);
      
      // Drag down and right (SE resize should make display bigger)
      await page.mouse.move(centerX + 50, centerY + 50, { steps: 10 });
      await page.waitForTimeout(500);
      
      // Check size during drag (should be larger)
      const duringDragBounds = await testDisplay.boundingBox();
      console.log(`📏 During SE drag: ${duringDragBounds.width}x${duringDragBounds.height}`);
      
      await page.mouse.up();
      await page.waitForTimeout(500);
      
      // Check final size (should persist)
      const finalSEBounds = await testDisplay.boundingBox();
      console.log(`📏 Final SE resize: ${finalSEBounds.width}x${finalSEBounds.height}`);
      console.log(`📏 Final position: (${finalSEBounds.x}, ${finalSEBounds.y})`);
      
      if (finalSEBounds.width > initialBounds.width && finalSEBounds.height > initialBounds.height) {
        console.log('✅ SE resize working correctly! Size persists after release.');
      } else {
        console.log('❌ SE resize failed - size should increase and persist');
        console.log(`Expected: > ${initialBounds.width}x${initialBounds.height}`);
        console.log(`Actual: ${finalSEBounds.width}x${finalSEBounds.height}`);
      }
    } else {
      console.log('❌ SE handle not visible');
    }
    
    console.log('🎯 Step 5: Testing NW corner resize...');
    
    // Find NW resize handle
    const nwHandle = await page.locator('.resize-handle.nw').first();
    if (await nwHandle.isVisible()) {
      console.log('🔧 Found NW handle, testing resize...');
      
      const startPos = await nwHandle.boundingBox();
      const centerX = startPos.x + startPos.width / 2;
      const centerY = startPos.y + startPos.height / 2;
      
      // Move to handle and drag
      await page.mouse.move(centerX, centerY);
      await page.mouse.down();
      await page.waitForTimeout(100);
      
      // Drag up and left (NW resize should make display bigger and move position)
      await page.mouse.move(centerX - 30, centerY - 30, { steps: 10 });
      await page.waitForTimeout(500);
      
      await page.mouse.up();
      await page.waitForTimeout(500);
      
      // Check new size and position
      const afterNWBounds = await testDisplay.boundingBox();
      console.log(`📏 After NW resize: ${afterNWBounds.width}x${afterNWBounds.height}`);
      console.log(`📏 Position: (${afterNWBounds.x}, ${afterNWBounds.y})`);
      
      if (afterNWBounds.width > finalSEBounds.width && afterNWBounds.height > finalSEBounds.height) {
        console.log('✅ NW resize working correctly!');
      } else {
        console.log('❌ NW resize failed - size should increase');
      }
    } else {
      console.log('❌ NW handle not visible');
    }
    
    console.log('🎯 Step 6: Testing drag functionality independence...');
    
    // Test drag to make sure it still works
    const header = await page.locator('.header').first();
    const headerBounds = await header.boundingBox();
    
    await header.hover();
    await page.mouse.move(headerBounds.x + 50, headerBounds.y + 10);
    await page.mouse.down();
    await page.waitForTimeout(100);
    
    await page.mouse.move(headerBounds.x + 100, headerBounds.y + 50, { steps: 10 });
    await page.waitForTimeout(500);
    
    await page.mouse.up();
    await page.waitForTimeout(500);
    
    const afterDragBounds = await testDisplay.boundingBox();
    console.log(`📏 After drag: position (${afterDragBounds.x}, ${afterDragBounds.y})`);
    console.log(`📏 Size unchanged: ${afterDragBounds.width}x${afterDragBounds.height}`);
    
    if (afterDragBounds.x > initialBounds.x && afterDragBounds.y > initialBounds.y) {
      console.log('✅ Drag functionality working independently!');
    } else {
      console.log('❌ Drag functionality may have issues');
    }
    
    console.log('🎯 Step 7: Testing edge handles...');
    
    // Test East handle (right edge)
    const eHandle = await page.locator('.resize-handle.e').first();
    if (await eHandle.isVisible()) {
      console.log('🔧 Testing East handle...');
      
      const startPos = await eHandle.boundingBox();
      const centerX = startPos.x + startPos.width / 2;
      const centerY = startPos.y + startPos.height / 2;
      
      await page.mouse.move(centerX, centerY);
      await page.mouse.down();
      await page.waitForTimeout(100);
      
      await page.mouse.move(centerX + 40, centerY, { steps: 10 });
      await page.waitForTimeout(500);
      
      await page.mouse.up();
      await page.waitForTimeout(500);
      
      const afterEResizeBounds = await testDisplay.boundingBox();
      console.log(`📏 After E resize: ${afterEResizeBounds.width}x${afterEResizeBounds.height}`);
      
      if (afterEResizeBounds.width > afterDragBounds.width) {
        console.log('✅ East handle resize working!');
      } else {
        console.log('❌ East handle resize failed');
      }
    }
    
    console.log('🎯 Step 8: Final validation...');
    
    // Check for any new JavaScript errors
    const errorsAfterTest = consoleMessages.filter(msg => msg.type === 'error');
    if (errorsAfterTest.length > 0) {
      console.log('❌ JavaScript errors found during test:');
      errorsAfterTest.forEach(err => console.log(`  - ${err.text}`));
    } else {
      console.log('✅ No JavaScript errors during test');
    }
    
    // Check InteractionManager logs
    const interactionLogs = consoleMessages.filter(msg => 
      msg.text.includes('[INTERACTION_MANAGER]')
    );
    
    const resizeStartLogs = interactionLogs.filter(msg => 
      msg.text.includes('Starting resize')
    );
    const resizeEndLogs = interactionLogs.filter(msg => 
      msg.text.includes('Ending resize')
    );
    
    console.log(`🔍 InteractionManager resize starts: ${resizeStartLogs.length}`);
    console.log(`🔍 InteractionManager resize ends: ${resizeEndLogs.length}`);
    
    console.log('✅ COMPLETE RESIZE FIX TEST FINISHED');
    console.log('=====================================');
    console.log('📊 Test Summary:');
    console.log('  - SE corner resize: ' + (finalSEBounds.width > initialBounds.width ? '✅ PASS' : '❌ FAIL'));
    console.log('  - NW corner resize: ' + (afterNWBounds.width > finalSEBounds.width ? '✅ PASS' : '❌ FAIL'));
    console.log('  - Drag functionality: ' + (afterDragBounds.x > initialBounds.x ? '✅ PASS' : '❌ FAIL'));
    console.log('  - Edge resize: ' + (afterEResizeBounds.width > afterDragBounds.width ? '✅ PASS' : '❌ FAIL'));
    console.log('  - No JS errors: ' + (errorsAfterTest.length === 0 ? '✅ PASS' : '❌ FAIL'));
    
    // Wait for manual inspection
    console.log('🔍 Check the browser window for final state...');
    await page.waitForTimeout(5000);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await browser.close();
  }
}

testCompleteResizeFix().catch(console.error);
