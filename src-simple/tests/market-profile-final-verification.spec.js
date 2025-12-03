import { test, expect } from '@playwright/test';

test.describe('Market Profile Final Verification', () => {
  test('Verify market profile display creation and data flow', async ({ page }) => {
    console.log('🚀 Starting Market Profile Final Verification');
    console.log('===============================================');

    // Collect all console messages
    const consoleMessages = [];
    page.on('console', msg => {
      console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`);
      consoleMessages.push(msg.text());
    });

    // Navigate to the application
    console.log('🌐 Navigating to simple application on port 5176...');
    await page.goto('http://localhost:5176');
    await page.waitForLoadState('networkidle');

    // Wait for initialization and display creation
    console.log('⏳ Waiting for application initialization...');
    await page.waitForTimeout(3000);

    // Check for market profile creation messages
    const displayCreationMessages = consoleMessages.filter(msg =>
      msg.includes('Created Market Profile display') ||
      msg.includes('No displays found, creating default EURUSD displays')
    );

    console.log(`📊 Found ${displayCreationMessages.length} display creation messages:`);
    displayCreationMessages.forEach((msg, index) => {
      console.log(`   ${index + 1}. ${msg}`);
    });

    // Check for market profile data processing messages
    const marketProfileMessages = consoleMessages.filter(msg =>
      msg.includes('MARKET_PROFILE') ||
      msg.includes('Market Profile')
    );

    console.log(`📈 Found ${marketProfileMessages.length} market profile messages:`);
    marketProfileMessages.forEach((msg, index) => {
      console.log(`   ${index + 1}. ${msg}`);
    });

    // Check for visualization registration
    const registrationMessages = consoleMessages.filter(msg =>
      msg.includes('Enhanced visualizations registered') ||
      msg.includes('marketProfile')
    );

    console.log(`🎯 Found ${registrationMessages.length} registration messages:`);
    registrationMessages.forEach((msg, index) => {
      console.log(`   ${index + 1}. ${msg}`);
    });

    // Check for WebSocket/data activity
    const websocketMessages = consoleMessages.filter(msg =>
      msg.includes('Rendering') ||
      msg.includes('symbol') ||
      msg.includes('WebSocket')
    );

    console.log(`🔌 Found ${websocketMessages.length} WebSocket/data messages:`);
    websocketMessages.forEach((msg, index) => {
      console.log(`   ${index + 1}. ${msg}`);
    });

    // Check for any errors
    const errorMessages = consoleMessages.filter(msg =>
      msg.toLowerCase().includes('error') && !msg.includes('A11y')
    );

    console.log(`❌ Found ${errorMessages.length} error messages:`);
    errorMessages.forEach((msg, index) => {
      console.log(`   ${index + 1}. ${msg}`);
    });

    // Verify application loaded
    const pageTitle = await page.title();
    expect(pageTitle).toContain('NeuroSense FX');
    console.log('✅ Application loaded successfully');

    // Take a screenshot for visual verification
    await page.screenshot({ path: 'market-profile-final-verification.png' });
    console.log('📸 Screenshot saved as market-profile-final-verification.png');

    // Summary verification
    const hasMarketProfileDisplay = displayCreationMessages.some(msg =>
      msg.includes('Market Profile display')
    );
    const hasRegistration = registrationMessages.some(msg =>
      msg.includes('marketProfile')
    );
    const hasNoCriticalErrors = errorMessages.filter(msg =>
      !msg.includes('A11y') && !msg.includes('Warning')
    ).length === 0;

    console.log('\n📋 FINAL VERIFICATION SUMMARY:');
    console.log(`   ✅ Market Profile Display Created: ${hasMarketProfileDisplay ? 'YES' : 'NO'}`);
    console.log(`   ✅ Visualization Registered: ${hasRegistration ? 'YES' : 'NO'}`);
    console.log(`   ✅ No Critical Errors: ${hasNoCriticalErrors ? 'YES' : 'NO'}`);
    console.log(`   📊 Total Console Messages: ${consoleMessages.length}`);

    expect(hasRegistration).toBe(true);
    expect(hasNoCriticalErrors).toBe(true);

    console.log('\n🎉 Market Profile Final Verification COMPLETED');
  });
});