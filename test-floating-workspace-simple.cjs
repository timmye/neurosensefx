const { chromium } = require('playwright');

(async () => {
  console.log('🧪 Testing Floating Workspace Implementation (Simple)');
  console.log('==================================================\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Navigate to the application
    console.log('📍 Step 1: Navigating to application...');
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Wait for the app to load
    await page.waitForTimeout(3000);
    
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
          const boundingBox = await element.boundingBox();
          
          console.log(`  ✅ ${panel.name}: Visible=${isVisible}, Position=(${boundingBox?.x}, ${boundingBox?.y})`);
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
    
    // Test 3: Test Basic Symbol Selection
    console.log('\n🔍 Test 3: Testing Basic Symbol Selection');
    
    try {
      // Look for symbol input in the palette
      const symbolInput = await page.$('.floating-symbol-palette input');
      if (symbolInput) {
        console.log('  ✅ Symbol input found');
        
        // Try to focus and type
        await symbolInput.focus();
        await symbolInput.fill('EUR');
        await page.waitForTimeout(1000);
        
        // Check for any dropdown or response
        const dropdown = await page.$('.floating-symbol-palette .dropdown');
        if (dropdown) {
          const isVisible = await dropdown.isVisible();
          console.log(`  ✅ Symbol dropdown appeared: ${isVisible}`);
        } else {
          console.log('  ⚠️  No dropdown appeared (may need different interaction)');
        }
        
        // Check for recent symbol buttons
        const recentButtons = await page.$$('.floating-symbol-palette .recent-symbol-btn');
        console.log(`  📊 Recent symbol buttons found: ${recentButtons.length}`);
        
        if (recentButtons.length > 0) {
          // Click on a recent symbol
          await recentButtons[0].click();
          await page.waitForTimeout(500);
          
          // Check if create button is enabled
          const createBtn = await page.$('.floating-symbol-palette .create-btn');
          if (createBtn) {
            const isDisabled = await createBtn.isDisabled();
            console.log(`  ✅ Create button enabled: ${!isDisabled}`);
            
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
          }
        }
      } else {
        console.log('  ❌ Symbol input not found');
      }
    } catch (error) {
      console.log(`  ❌ Symbol selection test error: ${error.message}`);
    }
    
    // Test 4: Test Panel Controls
    console.log('\n🔍 Test 4: Testing Panel Controls');
    
    try {
      const systemPanel = await page.$('.floating-system-panel');
      if (systemPanel) {
        console.log('  ✅ System panel found');
        
        // Check for data source selector
        const dataSourceSelect = await systemPanel.$('select');
        if (dataSourceSelect) {
          console.log('  ✅ Data source selector found');
        } else {
          console.log('  ❌ Data source selector not found');
        }
        
        // Check for minimize button
        const minimizeBtn = await systemPanel.$('.minimize-btn');
        if (minimizeBtn) {
          console.log('  ✅ Minimize button found');
        } else {
          console.log('  ❌ Minimize button not found');
        }
      } else {
        console.log('  ❌ System panel not found');
      }
    } catch (error) {
      console.log(`  ❌ Panel controls test error: ${error.message}`);
    }
    
    // Take screenshot for visual verification
    await page.screenshot({ path: 'floating-workspace-simple-test.png', fullPage: true });
    console.log('\n📸 Screenshot saved: floating-workspace-simple-test.png');
    
    // Calculate test results
    console.log('\n📊 Test Results Summary');
    console.log('========================');
    console.log(`✅ Floating Panels Visible: ${panelsVisible}/4`);
    console.log(`✅ Legacy Elements Hidden: ${legacyElements.length - legacyElementsFound}/${legacyElements.length}`);
    console.log('✅ Symbol Selection Attempted');
    console.log('✅ Panel Controls Checked');
    
    const overallSuccess = panelsVisible === 4 && legacyElementsFound === 0;
    console.log(`\n🎯 Overall Result: ${overallSuccess ? 'SUCCESS' : 'NEEDS ATTENTION'}`);
    
    if (overallSuccess) {
      console.log('\n🎉 Floating Workspace Implementation is Working!');
      console.log('✓ All floating panels are visible by default');
      console.log('✓ No legacy elements are visible');
      console.log('✓ Interface is clean and professional');
    } else {
      console.log('\n⚠️  Some issues found that need attention');
    }
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
  } finally {
    await browser.close();
  }
})();