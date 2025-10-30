#!/usr/bin/env node

/**
 * Simple test to validate canvas display fix
 * Tests the complete data flow from WebSocket to canvas rendering
 */

const { chromium } = require('playwright');

console.log('🧪 Simple Canvas Display Fix Test');
console.log('=================================');

async function testCanvasDisplay() {
  let browser;
  let page;
  
  try {
    // Launch browser
    console.log('🚀 Launching browser...');
    browser = await chromium.launch({ 
      headless: false,
      slowMo: 100
    });
    
    page = await browser.newPage();
    
    // Navigate to application
    console.log('🌐 Navigating to application...');
    await page.goto('http://localhost:5173');
    
    // Wait for application to load
    await page.waitForSelector('.symbol-palette-simplified', { timeout: 10000 });
    console.log('✅ Application loaded successfully');
    
    // Wait for WebSocket connection (check for connection message)
    console.log('🔌 Waiting for WebSocket connection...');
    await page.waitForFunction(() => {
      return window.consoleMessages && window.consoleMessages.some(msg => 
        msg.text.includes('WebSocket connected successfully')
      );
    }, { timeout: 15000 });
    console.log('✅ WebSocket connected successfully');
    
    // Open symbol palette (Ctrl+K)
    console.log('⌨️  Opening symbol palette...');
    await page.keyboard.press('Control+KeyK');
    await page.waitForSelector('.symbol-palette-simplified', { state: 'visible', timeout: 5000 });
    console.log('✅ Symbol palette opened');
    
    // Type search query
    console.log('🔍 Searching for EURUSD...');
    await page.fill('.search-input', 'EURUSD');
    await page.waitForTimeout(500);
    
    // Select EURUSD from search results
    console.log('👆 Selecting EURUSD...');
    const searchResult = await page.locator('.search-result').first();
    await searchResult.click();
    
    // Wait for display creation
    console.log('🎨 Waiting for display creation...');
    await page.waitForSelector('.floating-display', { timeout: 10000 });
    console.log('✅ Display created successfully');
    
    // Wait for canvas element
    console.log('🖼️  Waiting for canvas element...');
    await page.waitForSelector('canvas', { timeout: 10000 });
    console.log('✅ Canvas element found');
    
    // Wait a bit more for data to load and render
    console.log('⏳ Waiting for data loading and rendering...');
    await page.waitForTimeout(5000);
    
    // Check if canvas has content
    console.log('🔍 Checking canvas content...');
    const hasContent = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return false;
      
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Check if canvas has non-transparent content
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 0) return true;
      }
      return false;
    });
    
    if (hasContent) {
      console.log('✅ Canvas contains drawn content');
    } else {
      console.log('❌ Canvas appears to be empty');
    }
    
    // Check console for key messages
    console.log('📊 Checking console messages...');
    const consoleCheck = await page.evaluate(() => {
      const messages = window.consoleMessages || [];
      return {
        hasCanvasSetup: messages.some(msg => 
          msg.text.includes('SETUP CANVAS: Canvas context created successfully')
        ),
        hasDataFlow: messages.some(msg => 
          msg.text.includes('CONNECTION_DEBUG') && 
          msg.text.includes('ready: true')
        ),
        hasRendering: messages.some(msg => 
          msg.text.includes('STARTING RENDER (reactive)')
        ),
        hasDrawing: messages.some(msg => 
          msg.text.includes('drawn')
        ),
        hasErrors: messages.some(msg => 
          msg.text.includes('🚨') || 
          msg.text.includes('BLOCKED')
        )
      };
    });
    
    console.log('\n🎯 TEST RESULTS:');
    console.log('==================');
    console.log(`Canvas Setup: ${consoleCheck.hasCanvasSetup ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Data Flow: ${consoleCheck.hasDataFlow ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Rendering: ${consoleCheck.hasRendering ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Drawing: ${consoleCheck.hasDrawing ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Errors: ${consoleCheck.hasErrors ? '❌ FAIL' : '✅ PASS'}`);
    
    const allTestsPassed = consoleCheck.hasCanvasSetup && 
                          consoleCheck.hasDataFlow && 
                          consoleCheck.hasRendering && 
                          consoleCheck.hasDrawing && 
                          !consoleCheck.hasErrors;
    
    if (allTestsPassed) {
      console.log('\n🎉 ALL TESTS PASSED - Canvas display fix is working!');
    } else {
      console.log('\n❌ Some tests failed');
    }
    
    // Keep browser open for visual inspection
    console.log('\n👁️  Keeping browser open for 3 seconds...');
    await page.waitForTimeout(3000);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  } finally {
    if (page) {
      await page.close();
    }
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testCanvasDisplay().then(() => {
  console.log('\n✅ Test completed');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});