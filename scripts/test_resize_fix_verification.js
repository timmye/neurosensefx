#!/usr/bin/env node

/**
 * Resize Fix Verification Script
 * 
 * Tests the new InteractionManager-based resize system
 * to ensure resize handles work without drag conflicts.
 */

const puppeteer = require('puppeteer');

async function testResizeFix() {
  console.log('🧪 Starting Resize Fix Verification Test...\n');
  
  const browser = await puppeteer.launch({
    headless: false, // Show browser for manual verification
    defaultViewport: null,
    args: ['--start-maximized']
  });
  
  const page = await browser.newPage();
  
  try {
    // Step 1: Navigate to application
    console.log('📍 Step 1: Navigating to application...');
    await page.goto('http://localhost:5173');
    await page.waitForSelector('.enhanced-floating', { timeout: 10000 });
    console.log('✅ Application loaded successfully\n');
    
    // Step 2: Create a display
    console.log('📍 Step 2: Creating EUR/USD display...');
    await page.keyboard.down('Control');
    await page.keyboard.press('n');
    await page.keyboard.up('Control');
    
    // Wait for display to appear
    await page.waitForFunction(() => {
      const displays = document.querySelectorAll('.enhanced-floating');
      return displays.length > 0;
    }, { timeout: 5000 });
    
    console.log('✅ Display created successfully\n');
    
    // Step 3: Test hover functionality
    console.log('📍 Step 3: Testing resize handle visibility...');
    
    const display = await page.$('.enhanced-floating');
    await display.hover();
    
    // Check if resize handles are visible
    const handlesVisible = await page.evaluate(() => {
      const handles = document.querySelectorAll('.resize-handle');
      const styles = Array.from(handles).map(h => window.getComputedStyle(h));
      return styles.some(s => s.opacity !== '0');
    });
    
    if (handlesVisible) {
      console.log('✅ Resize handles appear on hover\n');
    } else {
      console.log('❌ Resize handles not visible on hover\n');
    }
    
    // Step 4: Test resize interaction
    console.log('📍 Step 4: Testing resize interaction...');
    
    // Get initial size
    const initialSize = await page.evaluate(() => {
      const display = document.querySelector('.enhanced-floating');
      return {
        width: display.offsetWidth,
        height: display.offsetHeight
      };
    });
    
    console.log(`📏 Initial size: ${initialSize.width}x${initialSize.height}`);
    
    // Test SE handle resize
    const seHandle = await page.waitForSelector('.resize-handle.se');
    
    // Start resize
    await seHandle.hover();
    await page.mouse.down();
    
    // Move to resize
    await page.mouse.move(50, 50);
    await page.waitForTimeout(100);
    
    // End resize
    await page.mouse.up();
    
    // Check final size
    const finalSize = await page.evaluate(() => {
      const display = document.querySelector('.enhanced-floating');
      return {
        width: display.offsetWidth,
        height: display.offsetHeight
      };
    });
    
    console.log(`📏 Final size: ${finalSize.width}x${finalSize.height}`);
    
    const sizeChanged = finalSize.width !== initialSize.width || finalSize.height !== initialSize.height;
    
    if (sizeChanged) {
      console.log('✅ Resize interaction working\n');
    } else {
      console.log('❌ Resize interaction not working\n');
    }
    
    // Step 5: Test drag vs resize separation
    console.log('📍 Step 5: Testing drag vs resize separation...');
    
    // Test drag on header
    const header = await page.$('.header');
    const initialPosition = await page.evaluate(() => {
      const display = document.querySelector('.enhanced-floating');
      const rect = display.getBoundingClientRect();
      return { x: rect.left, y: rect.top };
    });
    
    await header.hover();
    await page.mouse.down();
    await page.mouse.move(100, 100);
    await page.mouse.up();
    
    const finalPosition = await page.evaluate(() => {
      const display = document.querySelector('.enhanced-floating');
      const rect = display.getBoundingClientRect();
      return { x: rect.left, y: rect.top };
    });
    
    const positionChanged = finalPosition.x !== initialPosition.x || finalPosition.y !== initialPosition.y;
    
    if (positionChanged) {
      console.log('✅ Drag interaction working\n');
    } else {
      console.log('❌ Drag interaction not working\n');
    }
    
    // Step 6: Check for JavaScript errors
    console.log('📍 Step 6: Checking for JavaScript errors...');
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`❌ JS Error: ${msg.text()}`);
      }
    });
    
    // Step 7: Verify InteractionManager usage
    console.log('📍 Step 7: Verifying InteractionManager usage...');
    
    const interactionManagerActive = await page.evaluate(() => {
      return window.interactionManager && typeof window.interactionManager.handleMouseDown === 'function';
    });
    
    if (interactionManagerActive) {
      console.log('✅ InteractionManager properly integrated\n');
    } else {
      console.log('❌ InteractionManager not properly integrated\n');
    }
    
    // Summary
    console.log('🎯 TEST SUMMARY:');
    console.log(`   Resize handles visible: ${handlesVisible ? '✅' : '❌'}`);
    console.log(`   Resize interaction: ${sizeChanged ? '✅' : '❌'}`);
    console.log(`   Drag interaction: ${positionChanged ? '✅' : '❌'}`);
    console.log(`   InteractionManager: ${interactionManagerActive ? '✅' : '❌'}`);
    
    const allTestsPassed = handlesVisible && sizeChanged && positionChanged && interactionManagerActive;
    
    if (allTestsPassed) {
      console.log('\n🎉 ALL TESTS PASSED! Resize fix is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Please check the implementation.');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    // Keep browser open for manual verification
    console.log('\n📝 Browser left open for manual verification...');
    console.log('   - Test resize handles (8 corners/edges)');
    console.log('   - Test drag functionality');
    console.log('   - Check browser console for InteractionManager logs');
    console.log('   - Press Ctrl+C to close');
    
    // Don't close browser automatically
    // await browser.close();
  }
}

// Run the test
testResizeFix().catch(console.error);
