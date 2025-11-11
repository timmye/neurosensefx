// CanvasContextMenu Parameter Access and Controls Test Suite
import { test, expect } from '@playwright/test';

test.describe('Enhanced CanvasContextMenu - Parameter Controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('should access and toggle Quick Actions parameters', async ({ page }) => {
    // Open context menu
    await page.locator('.workspace-container').first().click({ button: 'right' });
    const contextMenu = page.locator('.context-menu.enhanced');
    await expect(contextMenu).toBeVisible();
    
    // Switch to Quick Actions tab
    const tabButtons = contextMenu.locator('.tab-button');
    await tabButtons.nth(0).click();
    await page.waitForTimeout(200);
    
    // Test toggle controls
    const toggleControls = [
      'showMarketProfile',
      'showFlash',
      'showVolatilityMetric',
      'showAdrRangeIndicatorLines',
      'showAdrRangeIndicatorLabel',
      'showPriceFloatPulse',
      'showOrbFlash',
      'showPipetteDigit',
      'showPriceBackground',
      'showPriceBoundingBox',
      'showMaxMarker'
    ];
    
    for (const param of toggleControls) {
      const toggleInput = contextMenu.locator(`#toggle-${param}`);
      const toggleExists = await toggleInput.count() > 0;
      
      if (toggleExists) {
        // Get initial state
        const initialState = await toggleInput.isChecked();
        
        // Click to toggle
        await toggleInput.click();
        await page.waitForTimeout(100);
        
        // Verify state changed
        const newState = await toggleInput.isChecked();
        expect(newState).toBe(!initialState);
        
        // Toggle back
        await toggleInput.click();
        await page.waitForTimeout(100);
      }
    }
    
    // Close menu
    await page.keyboard.press('Escape');
  });

  test('should access and modify Price Display parameters', async ({ page }) => {
    // Open context menu
    await page.locator('.workspace-container').first().click({ button: 'right' });
    const contextMenu = page.locator('.context-menu.enhanced');
    await expect(contextMenu).toBeVisible();
    
    // Switch to Price Display tab
    const tabButtons = contextMenu.locator('.tab-button');
    await tabButtons.nth(1).click();
    await page.waitForTimeout(200);
    
    // Test range controls
    const rangeControls = [
      { param: 'priceFloatWidth', testValue: 150 },
      { param: 'priceFloatHeight', testValue: 5 },
      { param: 'priceFloatXOffset', testValue: 10 },
      { param: 'priceFontSize', testValue: 60 },
      { param: 'priceDisplayPadding', testValue: 10 }
    ];
    
    for (const { param, testValue } of rangeControls) {
      const rangeInput = contextMenu.locator(`#range-${param}`);
      const rangeExists = await rangeInput.count() > 0;
      
      if (rangeExists) {
        // Get initial value
        const initialValue = await rangeInput.inputValue();
        
        // Set test value
        await rangeInput.fill(testValue.toString());
        await page.waitForTimeout(100);
        
        // Verify value changed
        const newValue = await rangeInput.inputValue();
        expect(newValue).toBe(testValue.toString());
        
        // Reset to initial value
        await rangeInput.fill(initialValue);
        await page.waitForTimeout(100);
      }
    }
    
    // Test color controls
    const colorControls = [
      'priceFloatColor',
      'priceFloatUpColor',
      'priceFloatDownColor',
      'priceFloatPulseColor',
      'priceBackgroundColor'
    ];
    
    for (const param of colorControls) {
      const colorInput = contextMenu.locator(`#color-${param}`);
      const colorExists = await colorInput.count() > 0;
      
      if (colorExists) {
        // Check if color input exists and is visible
        await expect(colorInput).toBeVisible();
      }
    }
    
    // Test select controls
    const selectControls = [
      { param: 'priceFontWeight', testValue: '600' }
    ];
    
    for (const { param, testValue } of selectControls) {
      const selectInput = contextMenu.locator(`#select-${param}`);
      const selectExists = await selectInput.count() > 0;
      
      if (selectExists) {
        // Get initial value
        const initialValue = await selectInput.inputValue();
        
        // Select test value
        await selectInput.selectOption(testValue);
        await page.waitForTimeout(100);
        
        // Verify value changed
        const newValue = await selectInput.inputValue();
        expect(newValue).toBe(testValue);
        
        // Reset to initial value
        await selectInput.selectOption(initialValue);
        await page.waitForTimeout(100);
      }
    }
    
    // Close menu
    await page.keyboard.press('Escape');
  });

  test('should access and modify Market Profile parameters', async ({ page }) => {
    // Open context menu
    await page.locator('.workspace-container').first().click({ button: 'right' });
    const contextMenu = page.locator('.context-menu.enhanced');
    await expect(contextMenu).toBeVisible();
    
    // Switch to Market Profile tab
    const tabButtons = contextMenu.locator('.tab-button');
    await tabButtons.nth(2).click();
    await page.waitForTimeout(200);
    
    // Test select controls
    const selectControls = [
      { param: 'marketProfileView', testValue: 'combinedLeft' },
      { param: 'distributionDepthMode', testValue: 'percentage' },
      { param: 'pHighLowLabelSide', testValue: 'right' },
      { param: 'ohlLabelSide', testValue: 'right' }
    ];
    
    for (const { param, testValue } of selectControls) {
      const selectInput = contextMenu.locator(`#select-${param}`);
      const selectExists = await selectInput.count() > 0;
      
      if (selectExists) {
        // Get initial value
        const initialValue = await selectInput.inputValue();
        
        // Select test value
        await selectInput.selectOption(testValue);
        await page.waitForTimeout(100);
        
        // Verify value changed
        const newValue = await selectInput.inputValue();
        expect(newValue).toBe(testValue);
        
        // Reset to initial value
        await selectInput.selectOption(initialValue);
        await page.waitForTimeout(100);
      }
    }
    
    // Test range controls
    const rangeControls = [
      { param: 'marketProfileOpacity', testValue: 0.8 },
      { param: 'distributionPercentage', testValue: 70 },
      { param: 'marketProfileWidthRatio', testValue: 1.5 }
    ];
    
    for (const { param, testValue } of rangeControls) {
      const rangeInput = contextMenu.locator(`#range-${param}`);
      const rangeExists = await rangeInput.count() > 0;
      
      if (rangeExists) {
        // Get initial value
        const initialValue = await rangeInput.inputValue();
        
        // Set test value
        await rangeInput.fill(testValue.toString());
        await page.waitForTimeout(100);
        
        // Verify value changed
        const newValue = await rangeInput.inputValue();
        expect(newValue).toBe(testValue.toString());
        
        // Reset to initial value
        await rangeInput.fill(initialValue);
        await page.waitForTimeout(100);
      }
    }
    
    // Close menu
    await page.keyboard.press('Escape');
  });

  test('should access and modify Volatility parameters', async ({ page }) => {
    // Open context menu
    await page.locator('.workspace-container').first().click({ button: 'right' });
    const contextMenu = page.locator('.context-menu.enhanced');
    await expect(contextMenu).toBeVisible();
    
    // Switch to Volatility tab
    const tabButtons = contextMenu.locator('.tab-button');
    await tabButtons.nth(3).click();
    await page.waitForTimeout(200);
    
    // Test select controls
    const selectControls = [
      { param: 'volatilityColorMode', testValue: 'intensity' }
    ];
    
    for (const { param, testValue } of selectControls) {
      const selectInput = contextMenu.locator(`#select-${param}`);
      const selectExists = await selectInput.count() > 0;
      
      if (selectExists) {
        // Get initial value
        const initialValue = await selectInput.inputValue();
        
        // Select test value
        await selectInput.selectOption(testValue);
        await page.waitForTimeout(100);
        
        // Verify value changed
        const newValue = await selectInput.inputValue();
        expect(newValue).toBe(testValue);
        
        // Reset to initial value
        await selectInput.selectOption(initialValue);
        await page.waitForTimeout(100);
      }
    }
    
    // Test range controls
    const rangeControls = [
      { param: 'flashThreshold', testValue: 2.0 },
      { param: 'flashIntensity', testValue: 0.5 },
      { param: 'adrRange', testValue: 100 }
    ];
    
    for (const { param, testValue } of rangeControls) {
      const rangeInput = contextMenu.locator(`#range-${param}`);
      const rangeExists = await rangeInput.count() > 0;
      
      if (rangeExists) {
        // Get initial value
        const initialValue = await rangeInput.inputValue();
        
        // Set test value
        await rangeInput.fill(testValue.toString());
        await page.waitForTimeout(100);
        
        // Verify value changed
        const newValue = await rangeInput.inputValue();
        expect(newValue).toBe(testValue.toString());
        
        // Reset to initial value
        await rangeInput.fill(initialValue);
        await page.waitForTimeout(100);
      }
    }
    
    // Close menu
    await page.keyboard.press('Escape');
  });

  test('should access and modify Layout & Sizing parameters', async ({ page }) => {
    // Open context menu
    await page.locator('.workspace-container').first().click({ button: 'right' });
    const contextMenu = page.locator('.context-menu.enhanced');
    await expect(contextMenu).toBeVisible();
    
    // Switch to Layout & Sizing tab
    const tabButtons = contextMenu.locator('.tab-button');
    await tabButtons.nth(4).click();
    await page.waitForTimeout(200);
    
    // Test range controls
    const rangeControls = [
      { param: 'visualizationsContentWidth', testValue: 300 },
      { param: 'meterHeight', testValue: 150 },
      { param: 'centralAxisXPosition', testValue: 200 }
    ];
    
    for (const { param, testValue } of rangeControls) {
      const rangeInput = contextMenu.locator(`#range-${param}`);
      const rangeExists = await rangeInput.count() > 0;
      
      if (rangeExists) {
        // Get initial value
        const initialValue = await rangeInput.inputValue();
        
        // Set test value
        await rangeInput.fill(testValue.toString());
        await page.waitForTimeout(100);
        
        // Verify value changed
        const newValue = await rangeInput.inputValue();
        expect(newValue).toBe(testValue.toString());
        
        // Reset to initial value
        await rangeInput.fill(initialValue);
        await page.waitForTimeout(100);
      }
    }
    
    // Test select controls
    const selectControls = [
      { param: 'adrLabelType', testValue: 'fixedPips' }
    ];
    
    for (const { param, testValue } of selectControls) {
      const selectInput = contextMenu.locator(`#select-${param}`);
      const selectExists = await selectInput.count() > 0;
      
      if (selectExists) {
        // Get initial value
        const initialValue = await selectInput.inputValue();
        
        // Select test value
        await selectInput.selectOption(testValue);
        await page.waitForTimeout(100);
        
        // Verify value changed
        const newValue = await selectInput.inputValue();
        expect(newValue).toBe(testValue);
        
        // Reset to initial value
        await selectInput.selectOption(initialValue);
        await page.waitForTimeout(100);
      }
    }
    
    // Close menu
    await page.keyboard.press('Escape');
  });

  test('should access and modify Advanced parameters', async ({ page }) => {
    // Open context menu
    await page.locator('.workspace-container').first().click({ button: 'right' });
    const contextMenu = page.locator('.context-menu.enhanced');
    await expect(contextMenu).toBeVisible();
    
    // Switch to Advanced tab
    const tabButtons = contextMenu.locator('.tab-button');
    await tabButtons.nth(5).click();
    await page.waitForTimeout(200);
    
    // Test select controls
    const selectControls = [
      { param: 'frequencyMode', testValue: 'fast' }
    ];
    
    for (const { param, testValue } of selectControls) {
      const selectInput = contextMenu.locator(`#select-${param}`);
      const selectExists = await selectInput.count() > 0;
      
      if (selectExists) {
        // Get initial value
        const initialValue = await selectInput.inputValue();
        
        // Select test value
        await selectInput.selectOption(testValue);
        await page.waitForTimeout(100);
        
        // Verify value changed
        const newValue = await selectInput.inputValue();
        expect(newValue).toBe(testValue);
        
        // Reset to initial value
        await selectInput.selectOption(initialValue);
        await page.waitForTimeout(100);
      }
    }
    
    // Test range controls
    const rangeControls = [
      { param: 'markerLineThickness', testValue: 2.5 }
    ];
    
    for (const { param, testValue } of rangeControls) {
      const rangeInput = contextMenu.locator(`#range-${param}`);
      const rangeExists = await rangeInput.count() > 0;
      
      if (rangeExists) {
        // Get initial value
        const initialValue = await rangeInput.inputValue();
        
        // Set test value
        await rangeInput.fill(testValue.toString());
        await page.waitForTimeout(100);
        
        // Verify value changed
        const newValue = await rangeInput.inputValue();
        expect(newValue).toBe(testValue.toString());
        
        // Reset to initial value
        await rangeInput.fill(initialValue);
        await page.waitForTimeout(100);
      }
    }
    
    // Close menu
    await page.keyboard.press('Escape');
  });

  test('should handle parameter changes across tabs', async ({ page }) => {
    // Open context menu
    await page.locator('.workspace-container').first().click({ button: 'right' });
    const contextMenu = page.locator('.context-menu.enhanced');
    await expect(contextMenu).toBeVisible();
    
    const tabButtons = contextMenu.locator('.tab-button');
    
    // Change parameter in Quick Actions tab
    await tabButtons.nth(0).click();
    await page.waitForTimeout(200);
    
    const marketProfileToggle = contextMenu.locator('#toggle-showMarketProfile');
    const toggleExists = await marketProfileToggle.count() > 0;
    
    if (toggleExists) {
      const initialState = await marketProfileToggle.isChecked();
      await marketProfileToggle.click();
      await page.waitForTimeout(100);
      
      // Switch to another tab and back
      await tabButtons.nth(1).click();
      await page.waitForTimeout(200);
      
      await tabButtons.nth(0).click();
      await page.waitForTimeout(200);
      
      // Verify parameter state is preserved
      const newState = await marketProfileToggle.isChecked();
      expect(newState).toBe(!initialState);
      
      // Reset
      await marketProfileToggle.click();
      await page.waitForTimeout(100);
    }
    
    // Close menu
    await page.keyboard.press('Escape');
  });

  test('should reset all parameters to defaults', async ({ page }) => {
    // Open context menu
    await page.locator('.workspace-container').first().click({ button: 'right' });
    const contextMenu = page.locator('.context-menu.enhanced');
    await expect(contextMenu).toBeVisible();
    
    const tabButtons = contextMenu.locator('.tab-button');
    
    // Change some parameters
    await tabButtons.nth(0).click();
    await page.waitForTimeout(200);
    
    const marketProfileToggle = contextMenu.locator('#toggle-showMarketProfile');
    const toggleExists = await marketProfileToggle.count() > 0;
    
    if (toggleExists) {
      const initialState = await marketProfileToggle.isChecked();
      await marketProfileToggle.click();
      await page.waitForTimeout(100);
      
      // Reset to defaults
      const resetButton = contextMenu.locator('.reset-btn');
      await resetButton.click();
      await page.waitForTimeout(300);
      
      // Verify parameter was reset
      const resetState = await marketProfileToggle.isChecked();
      expect(resetState).toBe(initialState);
    }
    
    // Close menu
    await page.keyboard.press('Escape');
  });
});