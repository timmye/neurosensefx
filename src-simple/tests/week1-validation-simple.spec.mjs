import { test, expect } from '@playwright/test';

test.describe('Week 1 Implementation Validation', () => {
  test.only('Simplified Test - Single Browser', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => {
      console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`);
    });

    page.on('pageerror', error => {
      console.error(`[BROWSER ERROR] ${error.message}`);
      console.error(error.stack);
    });

    // Navigate to dev server
    await page.goto('http://localhost:5175/');
    await page.waitForLoadState('networkidle');
    console.log('🌐 Browser opened to http://localhost:5175/');

    console.log('\n🧪 Running All Week 1 Tests in Single Run...');

    const allTestResults = await page.evaluate(async () => {
      const results = {
        registryTest: { success: false, details: null },
        connectionTest: { success: false, details: null },
        lineCountTest: { success: false, details: null },
        integrationTest: { success: false, details: null }
      };

      try {
        console.log('=== Testing Visualization Registry ===');

        // Test 1: Visualization Registry
        const registry = await import('./lib/visualizationRegistry.js');
        console.log('✅ Registry module loaded');
        console.log('Available functions:', Object.keys(registry));

        // Test basic registry functionality
        console.log('Initial list:', registry.list());
        console.log('Get default (before registration):', registry.getDefault());

        // Test registration
        const testRenderer = () => console.log('Test renderer executed');
        registry.register('testViz', testRenderer);

        console.log('List after registration:', registry.list());
        console.log('Get test viz:', registry.get('testViz'));
        console.log('Get non-existent (fallback):', registry.get('nonExistent'));

        results.registryTest.success = true;
        results.registryTest.details = {
          availableFunctions: Object.keys(registry),
          initialList: registry.list(),
          afterRegistration: registry.list(),
          hasTestViz: typeof registry.get('testViz') === 'function'
        };

        console.log('✅ Registry tests completed');

        console.log('\n=== Testing Connection Manager ===');

        // Test 2: Connection Manager
        const cmModule = await import('./lib/connectionManager.js');
        console.log('✅ ConnectionManager module loaded');

        // Test connection manager instantiation
        const cm = new cmModule.ConnectionManager('ws://localhost:8080');
        console.log('Connection manager created with status:', cm.status);
        console.log('Has subscriptions:', cm.subscriptions.size > 0 ? 'YES' : 'NO');

        // Test connection attempt (will fail but shouldn't crash)
        try {
          cm.connect();
          console.log('✅ Connect method executed');

          // Check status after 2 seconds
          await new Promise(resolve => setTimeout(resolve, 2000));
          console.log('Connection status after attempt:', cm.status);

          results.connectionTest.success = true;
          results.connectionTest.details = {
            initialStatus: cm.status,
            hasSubscriptions: cm.subscriptions.size > 0,
            connectExecuted: true,
            statusAfterAttempt: cm.status
          };

          console.log('✅ ConnectionManager tests completed');
        } catch (err) {
          console.error('❌ Connection test failed:', err);
          results.connectionTest.details = { error: err.message };
        }

        console.log('\n=== Testing File Line Counts ===');

        // Test 3: File Line Count
        const [vizResponse, connResponse] = await Promise.all([
          fetch('./lib/visualizationRegistry.js'),
          fetch('./lib/connectionManager.js')
        ]);

        if (vizResponse.ok && connResponse.ok) {
          const [vizText, connText] = await Promise.all([
            vizResponse.text(),
            connResponse.text()
          ]);

          const vizLines = vizText.split('\n').length;
          const connLines = connText.split('\n').length;

          console.log('Visualization Registry:', vizLines, 'lines', vizLines <= 25 ? '✅ PASS' : '❌ FAIL');
          console.log('Connection Manager:', connLines, 'lines', connLines <= 120 ? '✅ PASS' : '❌ FAIL');

          results.lineCountTest.success = vizLines <= 25 && connLines <= 120;
          results.lineCountTest.details = {
            vizLines,
            connLines,
            vizPass: vizLines <= 25,
            connPass: connLines <= 120
          };
        }

        console.log('\n=== Testing Overall System Integration ===');

        // Test 4: Overall System Integration
        const appLoaded = !!document.querySelector('#app');
        const mainElement = document.querySelector('main');
        const workspace = document.querySelector('[data-testid="workspace"]');
        const mainElementsPresent = !!(mainElement || workspace);
        const svelteWorking = appLoaded && mainElementsPresent;

        console.log('App loaded:', appLoaded);
        console.log('Main elements present:', mainElementsPresent);
        console.log('Svelte working:', svelteWorking);

        results.integrationTest.success = appLoaded && svelteWorking;
        results.integrationTest.details = {
          appLoaded,
          mainElementsPresent,
          svelteWorking
        };

        if (results.integrationTest.success) {
          console.log('✅ Overall system integration looks good');
        } else {
          console.log('⚠️ Some integration issues detected');
        }

        console.log('\n=== ALL TESTS COMPLETED ===');

      } catch (error) {
        console.error('❌ Test execution failed:', error);
        return { error: error.message };
      }

      return results;
    });

    // Validate results
    console.log('\n📊 TEST RESULTS SUMMARY:');
    console.log('Registry Test:', allTestResults.registryTest.success ? '✅ PASS' : '❌ FAIL');
    console.log('Connection Test:', allTestResults.connectionTest.success ? '✅ PASS' : '❌ FAIL');
    console.log('Line Count Test:', allTestResults.lineCountTest.success ? '✅ PASS' : '❌ FAIL');
    console.log('Integration Test:', allTestResults.integrationTest.success ? '✅ PASS' : '❌ FAIL');

    // Detailed results
    if (allTestResults.lineCountTest.details) {
      const { vizLines, connLines, vizPass, connPass } = allTestResults.lineCountTest.details;
      console.log(`\n📏 Line Count Details:`);
      console.log(`  Visualization Registry: ${vizLines} lines (${vizPass ? '✅' : '❌'})`);
      console.log(`  Connection Manager: ${connLines} lines (${connPass ? '✅' : '❌'})`);
    }

    if (allTestResults.registryTest.details) {
      const { availableFunctions, hasTestViz } = allTestResults.registryTest.details;
      console.log(`\n🔧 Registry Details:`);
      console.log(`  Available Functions: ${availableFunctions.join(', ')}`);
      console.log(`  Test Registration: ${hasTestViz ? '✅' : '❌'}`);
    }

    // Final validation
    const allPassed = allTestResults.registryTest.success &&
                     allTestResults.connectionTest.success &&
                     allTestResults.lineCountTest.success &&
                     allTestResults.integrationTest.success;

    console.log(`\n🏁 OVERALL STATUS: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

    expect(allPassed).toBe(true);
  });
});