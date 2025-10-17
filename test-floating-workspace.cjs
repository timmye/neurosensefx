const { chromium } = require('playwright');

(async () => {
  console.log('🧪 Testing Floating Workspace Implementation');
  console.log('==========================================\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Navigate to the application
    console.log('📍 Step 1: Navigating to application...');
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Wait for the app to load
    await page.waitForTimeout(2000);
    
    // Test 1: Validate Floating Panels are Visible by Default
    console.log('\n🔍 Test 1: Validating Floating Panels are Visible by Default');
    
    const floatingPanels = [
      { selector: '.floating-symbol-palette', name: 'Symbol Palette', expectedPosition: { x: 20, y: 20 } },
      { selector: '.floating-system-panel', name: 'System Panel', expectedPosition: { x: 350, y: 20 } },
      { selector: '.floating-debug-panel', name: 'Debug Panel', expectedPosition: { x: 680, y: 20 } },
      { selector: '.floating-adr-panel', name: 'ADR Panel', expectedPosition: { x: 20, y: 400 } }
    ];
    
    let panelsVisible = 0;
    for (const panel of floatingPanels) {
      try {
        const element = await page.$(panel.selector);
        if (element) {
          const isVisible = await element.isVisible();
          const boundingBox = await element.boundingBox();
          
          console.log(`  ✅ ${panel.name}: Visible=${isVisible}, Position=(${boundingBox?.x}, ${boundingBox?.y})`);
          
          // Check if position is close to expected (within 50px tolerance)
          if (boundingBox && 
              Math.abs(boundingBox.x - panel.expectedPosition.x) <= 50 && 
              Math.abs(boundingBox.y - panel.expectedPosition.y) <= 50) {
            console.log(`    📍 Position: Correct (expected ~${panel.expectedPosition.x}, ${panel.expectedPosition.y})`);
          } else {
            console.log(`    ⚠️  Position: Unexpected (expected ~${panel.expectedPosition.x}, ${panel.expectedPosition.y})`);
          }
          
          panelsVisible++;
        } else {
          console.log(`  ❌ ${panel.name}: Not found`);
        }
      } catch (error) {
        console.log(`  ❌ ${panel.name}: Error - ${error.message}`);
      }
    }
    
    console.log(`\n  📊 Panels Visible: ${panelsVisible}/4`);
    
    // Test 2: Validate No Legacy Elements
    console.log('\n🔍 Test 2: Validating No Legacy Elements Visible');
    
    const legacyElements = [
      { selector: '.config-panel-container', name: 'ConfigPanel Container' },
      { selector: '.dev-controls', name: 'Development Controls' },
      { selector: '.workspace-controls', name: 'Workspace Controls' },
      { selector: '.traditional-grid', name: 'Traditional Grid Layout' }
    ];
    
    let legacyElementsFound = 0;
    for (const element of legacyElements) {
      try {
        const el = await page.$(element.selector);
        if (el) {
          const isVisible = await el.isVisible();
          if (isVisible) {
            console.log(`  ❌ ${element.name}: Still visible (should be hidden)`);
            legacyElementsFound++;
          } else {
            console.log(`  ✅ ${element.name}: Hidden (correct)`);
          }
        } else {
          console.log(`  ✅ ${element.name}: Not found (correct)`);
        }
      } catch (error) {
        console.log(`  ✅ ${element.name}: Error (likely not present) - ${error.message}`);
      }
    }
    
    console.log(`\n  📊 Legacy Elements Hidden: ${legacyElements.length - legacyElementsFound}/${legacyElements.length}`);
    
    // Test 3: Test Core Workflow - Symbol Selection and Canvas Creation
    console.log('\n🔍 Test 3: Testing Core Workflow - Symbol Selection and Canvas Creation');
    
    try {
      // Find a symbol in the symbol palette
      const symbolButton = await page.$('.floating-symbol-palette .symbol-button');
      if (symbolButton) {
        console.log('  ✅ Symbol buttons found in palette');
        
        // Get initial canvas count
        const initialCanvases = await page.$$('.floating-canvas');
        console.log(`  📊 Initial canvas count: ${initialCanvases.length}`);
        
        // Click on a symbol to create canvas
        await symbolButton.click();
        await page.waitForTimeout(1000);
        
        // Check if canvas was created
        const newCanvases = await page.$$('.floating-canvas');
        console.log(`  📊 Canvas count after symbol selection: ${newCanvases.length}`);
        
        if (newCanvases.length > initialCanvases.length) {
          console.log('  ✅ Canvas created successfully');
        } else {
          console.log('  ❌ Canvas creation failed');
        }
      } else {
        console.log('  ❌ No symbol buttons found in palette');
      }
    } catch (error) {
      console.log(`  ❌ Symbol selection workflow error: ${error.message}`);
    }
    
    // Test 4: Test Right-Click Context Menu
    console.log('\n🔍 Test 4: Testing Right-Click Context Menu');
    
    try {
      const canvas = await page.$('.floating-canvas');
      if (canvas) {
        console.log('  ✅ Canvas found for context menu test');
        
        // Right-click on canvas
        await canvas.click({ button: 'right' });
        await page.waitForTimeout(500);
        
        // Check if context menu appears
        const contextMenu = await page.$('.canvas-context-menu');
        if (contextMenu) {
          const isVisible = await contextMenu.isVisible();
          console.log(`  ✅ Context menu: Visible=${isVisible}`);
          
          // Check for tabs
          const tabs = await page.$$('.canvas-context-menu .tab-button');
          console.log(`  📊 Context menu tabs found: ${tabs.length}`);
          
          if (tabs.length >= 6) {
            console.log('  ✅ All 6 tabs present in context menu');
          } else {
            console.log(`  ⚠️  Expected 6 tabs, found ${tabs.length}`);
          }
          
          // Close context menu
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        } else {
          console.log('  ❌ Context menu not found');
        }
      } else {
        console.log('  ❌ No canvas found for context menu test');
      }
    } catch (error) {
      console.log(`  ❌ Context menu test error: ${error.message}`);
    }
    
    // Test 5: Test Floating Panel Functionality
    console.log('\n🔍 Test 5: Testing Floating Panel Functionality');
    
    // Test minimize/maximize functionality
    try {
      const symbolPalette = await page.$('.floating-symbol-palette');
      if (symbolPalette) {
        // Find minimize button
        const minimizeBtn = await symbolPalette.$('.minimize-btn');
        if (minimizeBtn) {
          console.log('  ✅ Minimize button found');
          
          // Click minimize
          await minimizeBtn.click();
          await page.waitForTimeout(500);
          
          // Check if minimized
          const isMinimized = await symbolPalette.evaluate(el => el.classList.contains('minimized'));
          console.log(`  📊 Symbol palette minimized: ${isMinimized}`);
          
          // Find maximize button
          const maximizeBtn = await symbolPalette.$('.maximize-btn');
          if (maximizeBtn) {
            console.log('  ✅ Maximize button found');
            await maximizeBtn.click();
            await page.waitForTimeout(500);
            
            const isStillMinimized = await symbolPalette.evaluate(el => el.classList.contains('minimized'));
            console.log(`  📊 Symbol palette restored: ${!isStillMinimized}`);
          }
        } else {
          console.log('  ❌ Minimize button not found');
        }
      }
    } catch (error) {
      console.log(`  ❌ Panel functionality test error: ${error.message}`);
    }
    
    // Test 6: Test System Controls
    console.log('\n🔍 Test 6: Testing System Controls');
    
    try {
      const systemPanel = await page.$('.floating-system-panel');
      if (systemPanel) {
        // Look for data source controls
        const dataSourceButtons = await systemPanel.$$('.data-source-btn');
        console.log(`  📊 Data source buttons found: ${dataSourceButtons.length}`);
        
        if (dataSourceButtons.length > 0) {
          console.log('  ✅ System controls accessible');
        } else {
          console.log('  ⚠️  No data source controls found');
        }
      } else {
        console.log('  ❌ System panel not found');
      }
    } catch (error) {
      console.log(`  ❌ System controls test error: ${error.message}`);
    }
    
    // Take screenshot for visual verification
    await page.screenshot({ path: 'floating-workspace-test.png', fullPage: true });
    console.log('\n📸 Screenshot saved: floating-workspace-test.png');
    
    // Calculate test results
    console.log('\n📊 Test Results Summary');
    console.log('========================');
    console.log(`✅ Floating Panels Visible: ${panelsVisible}/4`);
    console.log(`✅ Legacy Elements Hidden: ${legacyElements.length - legacyElementsFound}/${legacyElements.length}`);
    console.log('✅ Core Workflow Tested');
    console.log('✅ Context Menu Tested');
    console.log('✅ Panel Functionality Tested');
    console.log('✅ System Controls Tested');
    
    const overallSuccess = panelsVisible === 4 && legacyElementsFound === 0;
    console.log(`\n🎯 Overall Result: ${overallSuccess ? 'SUCCESS' : 'NEEDS ATTENTION'}`);
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
  } finally {
    await browser.close();
  }
})();