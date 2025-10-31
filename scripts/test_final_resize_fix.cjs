#!/usr/bin/env node

/**
 * Final Resize Fix Verification Test
 * Tests the comprehensive resize fix with reactive chain correction
 */

const { chromium } = require('playwright');

async function testResizeFix() {
  console.log('🧪 TESTING FINAL RESIZE FIX');
  console.log('=====================================');

  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 100 // Slower for better observation
  });
  
  const context = await browser.newContext({
    viewport: { width: 1200, height: 800 }
  });
  
  const page = await context.newPage();
  
  try {
    console.log('📱 Step 1: Opening NeuroSense FX...');
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(2000);
    
    console.log('🎯 Step 2: Creating test display...');
    
    // Press Ctrl+N to create new display
    await page.keyboard.press('Control+N');
    await page.waitForTimeout(1000);
    
    // Look for any floating display
    const display = await page.locator('.enhanced-floating').first();
    if (await display.count() === 0) {
      console.log('❌ No display found. Creating manually...');
      
      // Try alternative method - click workspace and add display
      await page.click('body', { position: { x: 100, y: 100 } });
      await page.waitForTimeout(500);
      
      // Right-click to get context menu
      await page.click('body', { position: { x: 100, y: 100 }, button: 'right' });
      await page.waitForTimeout(500);
      
      // Look for add display option
      const addDisplayOption = await page.locator('text=/add.*display/i').first();
      if (await addDisplayOption.isVisible()) {
        await addDisplayOption.click();
        await page.waitForTimeout(1000);
      }
    }
    
    // Wait for display to appear
    await page.waitForSelector('.enhanced-floating', { timeout: 10000 });
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
    
    console.log('🎯 Step 4: Testing NW corner resize...');
    
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
      
      // Drag up and left (NW resize should make display bigger)
      await page.mouse.move(centerX - 50, centerY - 50, { steps: 10 });
      await page.waitForTimeout(500);
      
      await page.mouse.up();
      await page.waitForTimeout(500);
      
      // Check new size
      const afterNWBounds = await testDisplay.boundingBox();
      console.log(`📏 After NW resize: ${afterNWBounds.width}x${afterNWBounds.height}`);
      console.log(`📏 Position: (${afterNWBounds.x}, ${afterNWBounds.y})`);
      
      if (afterNWBounds.width > initialBounds.width && afterNWBounds.height > initialBounds.height) {
        console.log('✅ NW resize working correctly!');
      } else {
        console.log('❌ NW resize failed - size should increase');
      }
    } else {
      console.log('❌ NW handle not visible');
    }
    
    console.log('🎯 Step 5: Testing SE corner resize...');
    
    // Find SE resize handle
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
      
      await page.mouse.up();
      await page.waitForTimeout(500);
      
      // Check new size
      const afterSEBounds = await testDisplay.boundingBox();
      console.log(`📏 After SE resize: ${afterSEBounds.width}x${afterSEBounds.height}`);
      
      if (afterSEBounds.width > afterNWBounds.width && afterSEBounds.height > afterNWBounds.height) {
        console.log('✅ SE resize working correctly!');
      } else {
        console.log('❌ SE resize failed - size should increase');
      }
    } else {
      console.log('❌ SE handle not visible');
    }
    
    console.log('🎯 Step 6: Testing drag functionality...');
    
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
    
    if (afterDragBounds.x > initialBounds.x && afterDragBounds.y > initialBounds.y) {
      console.log('✅ Drag functionality working correctly!');
    } else {
      console.log('❌ Drag functionality may have issues');
    }
    
    console.log('🎯 Step 7: Checking for JavaScript errors...');
    
    // Check for console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`❌ JavaScript error: ${msg.text()}`);
      }
    });
    
    console.log('🎯 Step 8: Testing resize handle positioning...');
    
    // Hover again to ensure handles are still positioned correctly
    await testDisplay.hover();
    await page.waitForTimeout(500);
    
    const finalHandles = await page.locator('.resize-handle').count();
    console.log(`🔧 Final resize handles visible: ${finalHandles}/8`);
    
    console.log('✅ FINAL RESIZE FIX TEST COMPLETED');
    console.log('=====================================');
    console.log('🔍 Check the browser window for visual results');
    console.log('📊 Expected behavior:');
    console.log('  - Resize handles should resize displays, not drag them');
    console.log('  - All 8 handles should work (NW, NE, E, SE, S, SW, W, N)');
    console.log('  - Drag functionality should work independently');
    console.log('  - No JavaScript errors in console');
    
    // Wait for manual inspection
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testResizeFix().catch(console.error);
