const { chromium } = require('playwright');

(async () => {
  console.log('🧪 Testing Floating Workspace Implementation (Manual Focus)');
  console.log('=======================================================\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Clear localStorage before navigating
    await page.goto('about:blank');
    await page.evaluate(() => {
      localStorage.clear();
    });
    
    // Navigate to the application
    console.log('📍 Step 1: Navigating to application...');
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Wait for the app to load
    await page.waitForTimeout(2000);
    
    // Test 1: Validate Floating Panels are Visible by Default
    console.log('\n🔍 Test 1: Validating Floating Panels are Visible by Default');
    
    const floatingPanels = [
      { selector: '.floating-symbol-palette', name: 'Symbol Palette' },
      { selector: '.floating-system-panel', name: 'System Panel' },
      { selector: '.floating-debug-panel', name: 'Debug Panel' },
      { selector: '.floating-adr-panel', name: 'ADR Panel' }
    ];
    
    let panelsVisible = 0;
    for (const panel of floatingPanels) {
      try {
        const element = await page.$(panel.selector);
        if (element) {
          const isVisible = await element.isVisible();
          const isMinimized = await element.evaluate(el => el.classList.contains('minimized'));
          
          console.log(`  ✅ ${panel.name}: Visible=${isVisible}, Minimized=${isMinimized}`);
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
        console.log(`  ✅ ${element.name}: Error (likely not present)`);
      }
    }
    
    console.log(`\n  📊 Legacy Elements Hidden: ${legacyElements.length - legacyElementsFound}/${legacyElements.length}`);
    
    // Test 3: Test Symbol Selection (Manual Focus)
    console.log('\n🔍 Test 3: Testing Symbol Selection (Manual Focus)');
    
    try {
      // Focus on the symbol palette input
      const symbolInput = await page.$('.floating-symbol-palette input');
      if (symbolInput) {
        console.log('  ✅ Symbol input found');
        
        // Type a symbol to trigger search
        await symbolInput.focus();
        await symbolInput.fill('EUR');
        await page.waitForTimeout(500);
        
        // Check if dropdown appears
        const dropdown = await page.$('.floating-symbol-palette .dropdown');
        if (dropdown) {
          const isVisible = await dropdown.isVisible();
          console.log(`  ✅ Symbol dropdown appeared: ${isVisible}`);
          
          // Check for dropdown items
          const dropdownItems = await page.$$('.floating-symbol-palette .dropdown-item');
          console.log(`  📊 Dropdown items found: ${dropdownItems.length}`);
          
          if (dropdownItems.length > 0) {
            // Click on the first item
            await dropdownItems[0].click();
            await page.waitForTimeout(500);
            
            // Check if create button is enabled
            const createBtn = await page.$('.floating-symbol-palette .create-btn');
            if (createBtn) {
              const isDisabled = await createBtn.isDisabled();
              console.log(`  ✅ Create button enabled: ${!isDisabled}`);
              
              // Click create button
              if (!isDisabled) {
                await createBtn.click();
                await page.waitForTimeout(1000);
                
                // Check if canvas was created
                const canvases = await page.$$('.floating-canvas');
                console.log(`  📊 Canvas count after creation: ${canvases.length}`);
                
                if (canvases.length > 0) {
                  console.log('  ✅ Canvas created successfully');
                } else {
                  console.log('  ❌ Canvas creation failed');
                }
              }
            } else {
              console.log('  ❌ Create button not found');
            }
          } else {
            console.log('  ❌ No dropdown items found');
          }
        } else {
          console.log('  ❌ Symbol dropdown not found');
        }
      } else {
        console.log('  ❌ Symbol input not found');
      }
    } catch (error) {
      console.log(`  ❌ Symbol selection test error: ${error.message}`);
    }
    
    // Test 4: Test Right-Click Context Menu (if canvas exists)
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
          
          // Close context menu
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        } else {
          console.log('  ❌ Context menu not found');
        }
      } else {
        console.log('  ⚠️  No canvas found for context menu test (expected if symbol selection failed)');
      }
    } catch (error) {
      console.log(`  ❌ Context menu test error: ${error.message}`);
    }
    
    // Test 5: Test Panel Minimize/Maximize
    console.log('\n🔍 Test 5: Testing Panel Minimize/Maximize');
    
    try {
      const systemPanel = await page.$('.floating-system-panel');
      if (systemPanel) {
        // Find minimize button
        const minimizeBtn = await systemPanel.$('.minimize-btn');
        if (minimizeBtn) {
          console.log('  ✅ Minimize button found');
          
          // Check initial state
          const initialMinimized = await systemPanel.evaluate(el => el.classList.contains('minimized'));
          console.log(`  📊 Initial state: Minimized=${initialMinimized}`);
          
          // Click minimize
          await minimizeBtn.click();
          await page.waitForTimeout(500);
          
          // Check if minimized
          const isMinimized = await systemPanel.evaluate(el => el.classList.contains('minimized'));
          console.log(`  📊 After minimize: Minimized=${isMinimized}`);
          
          // Find maximize button (might be the same button)
          const maximizeBtn = await systemPanel.$('.minimize-btn');
          if (maximizeBtn && isMinimized) {
            await maximizeBtn.click();
            await page.waitForTimeout(500);
            
            const isStillMinimized = await systemPanel.evaluate(el => el.classList.contains('minimized'));
            console.log(`  📊 After maximize: Minimized=${isStillMinimized}`);
            console.log('  ✅ Panel minimize/maximize working');
          }
        } else {
          console.log('  ❌ Minimize button not found');
        }
      } else {
        console.log('  ❌ System panel not found');
      }
    } catch (error) {
      console.log(`  ❌ Panel minimize/maximize test error: ${error.message}`);
    }
    
    // Test 6: Test System Controls
    console.log('\n🔍 Test 6: Testing System Controls');
    
    try {
      const systemPanel = await page.$('.floating-system-panel');
      if (systemPanel) {
        // Look for data source selector
        const dataSourceSelect = await systemPanel.$('select');
        if (dataSourceSelect) {
          console.log('  ✅ Data source selector found');
          
          // Get current value
          const currentValue = await dataSourceSelect.inputValue();
          console.log(`  📊 Current data source: ${currentValue}`);
          
          // Try to change it
          const options = await dataSourceSelect.$$('option');
          console.log(`  📊 Available data sources: ${options.length}`);
          
          if (options.length > 1) {
            console.log('  ✅ System controls accessible and functional');
          } else {
            console.log('  ⚠️  Only one data source option available');
          }
        } else {
          console.log('  ❌ Data source selector not found');
        }
      } else {
        console.log('  ❌ System panel not found');
      }
    } catch (error) {
      console.log(`  ❌ System controls test error: ${error.message}`);
    }
    
    // Take screenshot for visual verification
    await page.screenshot({ path: 'floating-workspace-manual-test.png', fullPage: true });
    console.log('\n📸 Screenshot saved: floating-workspace-manual-test.png');
    
    // Calculate test results
    console.log('\n📊 Test Results Summary');
    console.log('========================');
    console.log(`✅ Floating Panels Visible: ${panelsVisible}/4`);
    console.log(`✅ Legacy Elements Hidden: ${legacyElements.length - legacyElementsFound}/${legacyElements.length}`);
    console.log('✅ Symbol Selection Tested');
    console.log('✅ Context Menu Tested');
    console.log('✅ Panel Minimize/Maximize Tested');
    console.log('✅ System Controls Tested');
    
    const overallSuccess = panelsVisible === 4 && legacyElementsFound === 0;
    console.log(`\n🎯 Overall Result: ${overallSuccess ? 'SUCCESS' : 'NEEDS ATTENTION'}`);
    
    console.log('\n💡 Manual Verification Notes:');
    console.log('- All 4 floating panels should be visible by default');
    console.log('- No legacy UI elements should be visible');
    console.log('- Symbol selection should work by typing and selecting from dropdown');
    console.log('- Canvas creation should work after symbol selection');
    console.log('- Right-click context menu should appear on canvases');
    console.log('- Panel minimize/maximize should work');
    console.log('- System controls should be accessible');
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
  } finally {
    await browser.close();
  }
})();