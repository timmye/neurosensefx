#!/usr/bin/env node

/**
 * Quick test to validate canvas display fix
 */

const { chromium } = require('playwright');

console.log('🧪 Quick Canvas Display Test');
console.log('============================');

async function quickTest() {
  let browser;
  let page;
  
  try {
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
    console.log('✅ Application loaded');
    
    // Open symbol palette (Ctrl+K)
    console.log('⌨️ Opening symbol palette...');
    await page.keyboard.press('Control+KeyK');
    await page.waitForSelector('.symbol-palette-simplified', { state: 'visible', timeout: 5000 });
    
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
    console.log('✅ Display created');
    
    // Wait for canvas element
    console.log('🖼️ Waiting for canvas element...');
    await page.waitForSelector('canvas', { timeout: 10000 });
    console.log('✅ Canvas element found');
    
    // Wait for data to load and render
    console.log('⏳ Waiting for data loading and rendering...');
    await page.waitForTimeout(8000); // Wait 8 seconds for data flow
    
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
      console.log('✅ Canvas contains drawn content - FIX SUCCESSFUL!');
    } else {
      console.log('❌ Canvas appears to be empty - fix needs more work');
    }
    
    // Keep browser open for visual inspection
    console.log('\n👁️  Keeping browser open for 5 seconds for visual inspection...');
    await page.waitForTimeout(5000);
    
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
quickTest().then(() => {
  console.log('\n✅ Quick test completed');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Quick test failed:', error);
  process.exit(1);
});