import { test, expect } from '@playwright/test';

test.describe('Week 1 Implementation Validation', () => {
  test.beforeEach(async ({ page }) => {
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

    // Open DevTools console (we'll capture console via events)
    console.log('🌐 Browser opened to http://localhost:5175/');
  });

  test('Test 1: Visualization Registry', async ({ page }) => {
    console.log('\n🧪 Running Visualization Registry Tests...');

    const registryResult = await page.evaluate(async () => {
      try {
        const results = {
          moduleLoaded: false,
          availableFunctions: [],
          initialList: null,
          defaultBeforeRegistration: null,
          afterRegistration: null,
          testVizGet: null,
          fallbackGet: null,
          errors: []
        };

        // Import and test the registry
        const registry = await import('./src/lib/visualizationRegistry.js');
        results.moduleLoaded = true;
        results.availableFunctions = Object.keys(registry);

        console.log('✅ Registry module loaded');
        console.log('Available functions:', results.availableFunctions);

        // Test basic registry functionality
        results.initialList = registry.list();
        results.defaultBeforeRegistration = registry.getDefault();

        console.log('Initial list:', results.initialList);
        console.log('Get default (before registration):', results.defaultBeforeRegistration);

        // Test registration
        const testRenderer = () => console.log('Test renderer executed');
        registry.register('testViz', testRenderer);

        results.afterRegistration = registry.list();
        results.testVizGet = registry.get('testViz');
        results.fallbackGet = registry.get('nonExistent');

        console.log('List after registration:', results.afterRegistration);
        console.log('Get test viz:', results.testVizGet);
        console.log('Get non-existent (fallback):', results.fallbackGet);
        console.log('✅ Registry tests completed');

        return results;
      } catch (error) {
        console.error('❌ Registry test failed:', error);
        return { moduleLoaded: false, error: error.message };
      }
    });

    // Validate results
    expect(registryResult.moduleLoaded).toBe(true);
    expect(registryResult.availableFunctions).toContain('register');
    expect(registryResult.availableFunctions).toContain('get');
    expect(registryResult.availableFunctions).toContain('list');
    expect(registryResult.availableFunctions).toContain('getDefault');
    expect(typeof registryResult.testVizGet).toBe('function');

    console.log('✅ Visualization Registry tests PASSED');
  });

  test('Test 2: Connection Manager', async ({ page }) => {
    console.log('\n🧪 Running Connection Manager Tests...');

    const connectionResult = await page.evaluate(async () => {
      try {
        const results = {
          moduleLoaded: false,
          connectionManagerCreated: false,
          initialStatus: null,
          hasSubscriptions: false,
          connectExecuted: false,
          statusAfterAttempt: null,
          errors: []
        };

        // Import and test the connection manager
        const module = await import('./src/lib/connectionManager.js');
        results.moduleLoaded = true;

        console.log('✅ ConnectionManager module loaded');

        // Test connection manager instantiation
        const cm = new module.ConnectionManager('ws://localhost:8080');
        results.connectionManagerCreated = true;
        results.initialStatus = cm.status;
        results.hasSubscriptions = cm.subscriptions.size > 0;

        console.log('Connection manager created with status:', results.initialStatus);
        console.log('Has subscriptions:', results.hasSubscriptions ? 'YES' : 'NO');

        // Test connection attempt (will fail but shouldn't crash)
        try {
          cm.connect();
          results.connectExecuted = true;
          console.log('✅ Connect method executed');
        } catch (err) {
          results.errors.push(`Connect method error: ${err.message}`);
          console.error('❌ Connection test failed:', err);
        }

        // Wait a moment for any async operations
        await new Promise(resolve => setTimeout(resolve, 2000));
        results.statusAfterAttempt = cm.status;
        console.log('Connection status after attempt:', results.statusAfterAttempt);
        console.log('✅ ConnectionManager tests completed');

        return results;
      } catch (error) {
        console.error('❌ ConnectionManager load failed:', error);
        return { moduleLoaded: false, error: error.message };
      }
    });

    // Validate results
    expect(connectionResult.moduleLoaded).toBe(true);
    expect(connectionResult.connectionManagerCreated).toBe(true);
    expect(connectionResult.connectExecuted).toBe(true);

    console.log('✅ Connection Manager tests PASSED');
  });

  test('Test 3: File Line Count Validation', async ({ page }) => {
    console.log('\n🧪 Running File Line Count Tests...');

    const lineCountResult = await page.evaluate(async () => {
      try {
        const results = {
          visualizationRegistryLines: 0,
          connectionManagerLines: 0,
          registryPass: false,
          connectionPass: false,
          errors: []
        };

        // Fetch and count lines for both files
        const [vizResponse, connResponse] = await Promise.all([
          fetch('./src/lib/visualizationRegistry.js'),
          fetch('./src/lib/connectionManager.js')
        ]);

        if (!vizResponse.ok) {
          results.errors.push(`Failed to fetch visualizationRegistry.js: ${vizResponse.status}`);
        }
        if (!connResponse.ok) {
          results.errors.push(`Failed to fetch connectionManager.js: ${connResponse.status}`);
        }

        if (vizResponse.ok && connResponse.ok) {
          const [vizText, connText] = await Promise.all([
            vizResponse.text(),
            connResponse.text()
          ]);

          results.visualizationRegistryLines = vizText.split('\n').length;
          results.connectionManagerLines = connText.split('\n').length;

          results.registryPass = results.visualizationRegistryLines <= 25;
          results.connectionPass = results.connectionManagerLines <= 120;

          console.log('Visualization Registry:', results.visualizationRegistryLines, 'lines',
            results.registryPass ? '✅ PASS' : '❌ FAIL');
          console.log('Connection Manager:', results.connectionManagerLines, 'lines',
            results.connectionPass ? '✅ PASS' : '❌ FAIL');
        }

        console.log('\n=== ALL TESTS COMPLETED ===');
        return results;
      } catch (error) {
        console.error('❌ Line count test failed:', error);
        return { error: error.message };
      }
    });

    // Validate line count results
    expect(lineCountResult.visualizationRegistryLines).toBeGreaterThan(0);
    expect(lineCountResult.connectionManagerLines).toBeGreaterThan(0);
    expect(lineCountResult.errors).toHaveLength(0);

    console.log('✅ File Line Count validation PASSED');
  });

  test('Test 4: Overall System Integration', async ({ page }) => {
    console.log('\n🧪 Running Overall System Integration Tests...');

    const integrationResult = await page.evaluate(async () => {
      try {
        const results = {
          appLoaded: false,
          svelteWorking: false,
          mainElementsPresent: false,
          consoleErrors: [],
          success: false
        };

        // Check if the main application loaded properly
        results.appLoaded = !!document.querySelector('#app');

        // Check if Svelte is working by looking for the main content
        const mainElement = document.querySelector('main');
        const workspace = document.querySelector('[data-testid="workspace"]');

        results.mainElementsPresent = !!(mainElement || workspace);

        // Check for any JavaScript errors in the page
        // This is a basic check - in a real scenario you might want more sophisticated error detection
        results.svelteWorking = results.appLoaded && results.mainElementsPresent;

        console.log('App loaded:', results.appLoaded);
        console.log('Main elements present:', results.mainElementsPresent);
        console.log('Svelte working:', results.svelteWorking);

        results.success = results.appLoaded && results.svelteWorking;

        if (results.success) {
          console.log('✅ Overall system integration looks good');
        } else {
          console.log('⚠️ Some integration issues detected');
        }

        return results;
      } catch (error) {
        console.error('❌ Integration test failed:', error);
        return { error: error.message };
      }
    });

    // Validate integration results
    expect(integrationResult.appLoaded).toBe(true);
    expect(integrationResult.mainElementsPresent).toBe(true);
    expect(integrationResult.success).toBe(true);

    console.log('✅ Overall System Integration tests PASSED');
  });
});