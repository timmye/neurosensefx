#!/usr/bin/env node

/**
 * Test script to validate canvas display fix
 * Tests the complete data flow from WebSocket to canvas rendering
 */

const { chromium } = require('playwright');

console.log('🧪 NeuroSense FX Canvas Display Fix Test');
console.log('======================================');

async function testCanvasDisplay() {
  let browser;
  let page;
  
  try {
    // Launch browser
    console.log('🚀 Launching browser...');
    browser = await chromium.launch({ 
      headless: false, // Show browser for visual verification
      slowMo: 100 // Slow down for better observation
    });
    
    page = await browser.newPage();
    
    // Enable console logging
    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      });
      
      // Log important messages
      if (msg.text().includes('🎨') || msg.text().includes('CONNECTION_DEBUG')) {
        console.log(`📝 Browser: ${msg.text()}`);
      }
    });
    
    // Navigate to application
    console.log('🌐 Navigating to application...');
    await page.goto('http://localhost:5173');
    
    // Wait for application to load
    await page.waitForSelector('.floating-display, .symbol-palette-simplified', { timeout: 10000 });
    console.log('✅ Application loaded successfully');
    
    // Wait for WebSocket connection
    console.log('🔌 Waiting for WebSocket connection...');
    await page.waitForFunction(() => {
      return consoleMessages.some(msg => 
        msg.text.includes('WebSocket connected successfully')
      );
    }, { timeout: 15000 });
    console.log('✅ WebSocket connected successfully');
    
    // Wait for available symbols
    console.log('📊 Waiting for available symbols...');
    await page.waitForFunction(() => {
      return consoleMessages.some(msg => 
        msg.text.includes('availableSymbols') && 
        msg.text.includes('2025')
      );
    }, { timeout: 15000 });
    console.log('✅ Symbols loaded successfully');
    
    // Open symbol palette (Ctrl+K)
    console.log('⌨️  Opening symbol palette...');
    await page.keyboard.press('Control+KeyK');
    await page.waitForSelector('.symbol-palette-simplified', { state: 'visible', timeout: 5000 });
    console.log('✅ Symbol palette opened');
    
    // Type search query
    console.log('🔍 Searching for EURUSD...');
    await page.fill('.search-input', 'EURUSD');
    await page.waitForTimeout(500); // Wait for search results
    
    // Select EURUSD from search results
    console.log('👆 Selecting EURUSD from search results...');
    const searchResult = await page.locator('.search-result').first();
    await searchResult.click();
    
    // Wait for display creation
    console.log('🎨 Waiting for display creation...');
    await page.waitForSelector('.floating-display', { timeout: 10000 });
    console.log('✅ Display created successfully');
    
    // Wait for canvas setup
    console.log('🖼️  Waiting for canvas setup...');
    await page.waitForFunction(() => {
      return consoleMessages.some(msg => 
        msg.text.includes('SETUP CANVAS: Canvas context created successfully')
      );
    }, { timeout: 15000 });
    console.log('✅ Canvas context created successfully');
    
    // Wait for data subscription
    console.log('📡 Waiting for data subscription...');
    await page.waitForFunction(() => {
      return consoleMessages.some(msg => 
        msg.text.includes('CONNECTION_DEBUG') && 
        msg.text.includes('Updating display') && 
        msg.text.includes('ready: true')
      );
    }, { timeout: 15000 });
    console.log('✅ Display subscribed to data successfully');
    
    // Wait for rendering
    console.log('🎨 Waiting for canvas rendering...');
    await page.waitForFunction(() => {
      return consoleMessages.some(msg => 
        msg.text.includes('STARTING RENDER (reactive)') && 
        msg.text.includes('All conditions met')
      );
    }, { timeout: 15000 });
    console.log('✅ Canvas rendering started successfully');
    
    // Wait for actual drawing
    console.log('🖌️  Waiting for drawing operations...');
    await page.waitForFunction(() => {
      return consoleMessages.some(msg => 
        msg.text.includes('Market profile drawn') ||
        msg.text.includes('Day range meter drawn') ||
        msg.text.includes('Price float drawn')
      );
    }, { timeout: 15000 });
    console.log('✅ Canvas drawing operations completed');
    
    // Verify canvas element exists and has content
    console.log('🔍 Verifying canvas element...');
    const canvasElement = await page.locator('canvas').first();
    const canvasExists = await canvasElement.isVisible();
    
    if (canvasExists) {
      console.log('✅ Canvas element is visible');
      
      // Check if canvas has been drawn on (non-empty content)
      const canvasData = await canvasElement.evaluate(canvas => {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Check if canvas has non-transparent content
        for (let i = 3; i < data.length; i += 4) { // Alpha channel
          if (data[i] > 0) return true; // Non-transparent pixel found
        }
        return false;
      });
      
      if (canvasData) {
        console.log('✅ Canvas contains drawn content');
      } else {
        console.log('❌ Canvas appears to be empty');
      }
    } else {
      console.log('❌ Canvas element not found');
    }
    
    // Analyze console messages for errors
    console.log('\n📊 Console Message Analysis:');
    const errorMessages = consoleMessages.filter(msg => 
      msg.type === 'error' || 
      msg.text.includes('🚨') || 
      msg.text.includes('BLOCKED')
    );
    
    if (errorMessages.length === 0) {
      console.log('✅ No critical errors detected');
    } else {
      console.log(`❌ Found ${errorMessages.length} error messages:`);
      errorMessages.slice(0, 5).forEach(msg => {
        console.log(`   - ${msg.text}`);
      });
    }
    
    // Final verification
    const hasCanvasSetup = consoleMessages.some(msg => 
      msg.text.includes('SETUP CANVAS: Canvas context created successfully')
    );
    
    const hasDataFlow = consoleMessages.some(msg => 
      msg.text.includes('CONNECTION_DEBUG') && 
      msg.text.includes('ready: true')
    );
    
    const hasRendering = consoleMessages.some(msg => 
      msg.text.includes('STARTING RENDER (reactive)')
    );
    
    const hasDrawing = consoleMessages.some(msg => 
      msg.text.includes('drawn')
    );
    
    console.log('\n🎯 FINAL VERIFICATION RESULTS:');
    console.log('================================');
    console.log(`Canvas Setup: ${hasCanvasSetup ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Data Flow: ${hasDataFlow ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Rendering: ${hasRendering ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Drawing: ${hasDrawing ? '✅ PASS' : '❌ FAIL'}`);
    
    const allTestsPassed = hasCanvasSetup && hasDataFlow && hasRendering && hasDrawing;
    
    if (allTestsPassed) {
      console.log('\n🎉 ALL TESTS PASSED - Canvas display fix is working correctly!');
      console.log('📝 The canvas initialization timing issue has been resolved.');
      console.log('🔄 Complete data flow: WebSocket → ConnectionManager → floatingStore → Canvas Rendering');
    } else {
      console.log('\n❌ Some tests failed - Canvas display fix needs further investigation');
    }
    
    // Keep browser open for 5 seconds for visual inspection
    console.log('\n👁️  Keeping browser open for 5 seconds for visual inspection...');
    await page.waitForTimeout(5000);
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
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
  console.log('\n✅ Canvas display fix test completed');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Canvas display fix test failed:', error);
  process.exit(1);
});