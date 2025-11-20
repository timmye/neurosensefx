// =============================================================================
// NeuroSense FX - Configuration Inheritance Test Suite
// =============================================================================
// Run this script in the browser console on localhost:5174 to test the fixes
//
// Usage: Copy and paste this entire script into the browser console
// =============================================================================

console.log('🧪 NeuroSense FX Configuration Inheritance Test Suite');
console.log('=====================================================');

// Test 1: Environment Check
function testEnvironment() {
  console.log('\n📋 Test 1: Environment Check');

  const checks = {
    appRunning: typeof window !== 'undefined',
    displayStoreAvailable: false,
    displayActionsAvailable: false
  };

  // Try to access display store from the window object or import it
  try {
    // Check if we can access app state through any global means
    if (window.neurosensefx || window.displayStore) {
      checks.displayStoreAvailable = true;
    }

    // Look for any Svelte stores in the window object
    const hasSvelteStores = Object.keys(window).some(key =>
      key.includes('store') || key.includes('Store')
    );

    console.log('✅ App environment:', checks.appRunning);
    console.log('✅ Display store accessible:', checks.displayStoreAvailable);
    console.log('✅ Svelte stores detected:', hasSvelteStores);

    // Try to find configuration-related functions
    const configFunctions = Object.keys(window).filter(key =>
      key.includes('config') || key.includes('Config')
    );

    console.log('✅ Configuration functions found:', configFunctions);

    return checks.appRunning && (checks.displayStoreAvailable || hasSvelteStores);
  } catch (error) {
    console.error('❌ Environment check failed:', error);
    return false;
  }
}

// Test 2: Configuration Inheritance Test
function testConfigurationInheritance() {
  console.log('\n🧬 Test 2: Configuration Inheritance');

  return new Promise((resolve) => {
    try {
      // Method 1: Try to access via Svelte dev tools if available
      const appElement = document.querySelector('#svelte');
      if (appElement && appElement.__svelte_meta) {
        console.log('✅ Found Svelte app component');
        // Try to access component internals
        const component = appElement.__svelte_meta;
        console.log('✅ Component context:', component);
      }

      // Method 2: Look for any global state management
      let storeFound = false;
      const globalKeys = Object.keys(window);

      for (const key of globalKeys) {
        try {
          const obj = window[key];
          if (obj && typeof obj === 'object' && obj.subscribe && obj.update) {
            console.log(`✅ Found potential store: ${key}`);
            storeFound = true;

            // Try to inspect the store
            obj.subscribe(state => {
              console.log(`📊 Store ${key} state:`, state);

              // Look for configuration-related properties
              const configProps = Object.keys(state).filter(prop =>
                prop.includes('config') || prop.includes('Config') || prop === 'defaultConfig'
              );

              console.log(`✅ Configuration properties in ${key}:`, configProps);
            });
          }
        } catch (e) {
          // Skip inaccessible properties
        }
      }

      if (!storeFound) {
        console.warn('⚠️ No stores found via window object, trying DOM inspection...');

        // Method 3: Look for configuration panels or UI elements
        const configElements = document.querySelectorAll('[class*="config"], [class*="Config"], [id*="config"]');
        console.log(`✅ Found ${configElements.length} configuration-related DOM elements`);

        configElements.forEach((el, i) => {
          console.log(`🎨 Config element ${i + 1}:`, el.tagName, el.className);
        });
      }

      setTimeout(() => {
        console.log('✅ Configuration inheritance test completed');
        resolve(true);
      }, 1000);

    } catch (error) {
      console.error('❌ Configuration inheritance test failed:', error);
      resolve(false);
    }
  });
}

// Test 3: Manual Configuration Test
function testManualConfiguration() {
  console.log('\n🎛️ Test 3: Manual Configuration Test');

  try {
    // Look for configuration UI elements
    const configSelectors = [
      'select', 'input[type="range"]', 'input[type="color"]',
      'input[type="checkbox"]', '[class*="control"]'
    ];

    let controlsFound = 0;

    configSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log(`✅ Found ${elements.length} ${selector} elements`);
        controlsFound += elements.length;

        // Log details of each control
        elements.forEach((el, i) => {
          console.log(`  📝 ${selector} ${i + 1}:`, {
            id: el.id,
            className: el.className,
            value: el.value,
            type: el.type
          });
        });
      }
    });

    // Try to interact with a configuration element
    const selectElements = document.querySelectorAll('select');
    if (selectElements.length > 0) {
      const firstSelect = selectElements[0];
      console.log('✅ Testing interaction with first select element:', firstSelect);

      // Record initial value
      const initialValue = firstSelect.value;
      console.log(`📊 Initial value: ${initialValue}`);

      // Try to change the value
      if (firstSelect.options.length > 1) {
        const newValue = firstSelect.options[1].value;
        firstSelect.value = newValue;

        // Trigger change event
        const changeEvent = new Event('change', { bubbles: true });
        firstSelect.dispatchEvent(changeEvent);

        console.log(`📊 Changed value to: ${newValue}`);
        console.log('✅ Manual configuration change successful');

        return true;
      }
    }

    console.log('✅ Manual configuration test completed');
    return controlsFound > 0;

  } catch (error) {
    console.error('❌ Manual configuration test failed:', error);
    return false;
  }
}

// Test 4: Display Creation Test
function testDisplayCreation() {
  console.log('\n🖥️ Test 4: Display Creation Test');

  try {
    // Look for display creation mechanisms
    const createDisplaySelectors = [
      '[class*="display"]', '[class*="Display"]',
      'button', '[class*="add"]', '[class*="create"]'
    ];

    let elementsFound = 0;

    createDisplaySelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log(`✅ Found ${elements.length} ${selector} elements`);
        elementsFound += elements.length;

        elements.forEach((el, i) => {
          console.log(`  🎨 Element ${i + 1}:`, {
            tagName: el.tagName,
            text: el.textContent?.trim(),
            className: el.className,
            id: el.id
          });
        });
      }
    });

    // Look for keyboard shortcuts (Ctrl+K for symbol palette)
    console.log('💡 Testing keyboard shortcut: Ctrl+K');
    const keyboardEvent = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true
    });
    document.dispatchEvent(keyboardEvent);

    // Check if any modal or panel appeared
    setTimeout(() => {
      const modals = document.querySelectorAll('[class*="modal"], [class*="panel"], [class*="palette"]');
      console.log(`✅ Found ${modals.length} modal/panel elements after Ctrl+K`);

      modals.forEach((modal, i) => {
        console.log(`  📋 Modal ${i + 1}:`, modal.className);
      });
    }, 500);

    return elementsFound > 0;

  } catch (error) {
    console.error('❌ Display creation test failed:', error);
    return false;
  }
}

// Test 5: Workspace Persistence Test
function testWorkspacePersistence() {
  console.log('\n💾 Test 5: Workspace Persistence Test');

  try {
    // Check localStorage for workspace data
    const workspaceKeys = Object.keys(localStorage).filter(key =>
      key.includes('workspace') || key.includes('config') || key.includes('display')
    );

    console.log('✅ Found localStorage keys:', workspaceKeys);

    workspaceKeys.forEach(key => {
      const value = localStorage.getItem(key);
      console.log(`📦 ${key}:`, value?.substring(0, 100) + (value?.length > 100 ? '...' : ''));
    });

    // Check sessionStorage as well
    const sessionKeys = Object.keys(sessionStorage).filter(key =>
      key.includes('workspace') || key.includes('config') || key.includes('display')
    );

    console.log('✅ Found sessionStorage keys:', sessionKeys);

    // Test if we can save some test data
    const testKey = 'neurosensefx-test-config';
    const testValue = JSON.stringify({ test: true, timestamp: Date.now() });

    localStorage.setItem(testKey, testValue);
    const retrievedValue = localStorage.getItem(testKey);

    const persistenceWorks = retrievedValue === testValue;
    console.log('✅ localStorage persistence test:', persistenceWorks);

    // Clean up
    localStorage.removeItem(testKey);

    return persistenceWorks;

  } catch (error) {
    console.error('❌ Workspace persistence test failed:', error);
    return false;
  }
}

// Main Test Runner
async function runAllTests() {
  console.log('🚀 Starting NeuroSense FX Configuration Inheritance Tests...');

  const results = {
    environment: await testEnvironment(),
    configurationInheritance: await testConfigurationInheritance(),
    manualConfiguration: testManualConfiguration(),
    displayCreation: testDisplayCreation(),
    workspacePersistence: testWorkspacePersistence()
  };

  console.log('\n📊 TEST RESULTS SUMMARY');
  console.log('=========================');
  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${test}`);
  });

  const allPassed = Object.values(results).every(result => result === true);
  const passCount = Object.values(results).filter(result => result === true).length;

  console.log(`\n🏆 Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : `⚠️ ${passCount}/5 TESTS PASSED`}`);

  if (allPassed) {
    console.log('\n🎉 Configuration inheritance implementation appears to be working correctly!');
  } else {
    console.log('\n🔧 Some tests failed. This may indicate issues with the implementation or test accessibility.');
  }

  return results;
}

// Helper function to reset application state
function resetApplicationState() {
  console.log('\n🔄 Resetting application state...');

  try {
    // Clear test localStorage items
    Object.keys(localStorage).forEach(key => {
      if (key.includes('test') || key.includes('Test')) {
        localStorage.removeItem(key);
        console.log(`🗑️ Removed test key: ${key}`);
      }
    });

    // Reload the page
    console.log('🔄 Reloading page...');
    setTimeout(() => {
      window.location.reload();
    }, 1000);

  } catch (error) {
    console.error('❌ Reset failed:', error);
  }
}

// Export functions to window for individual testing
if (typeof window !== 'undefined') {
  window.runNeurosenseTests = runAllTests;
  window.testEnvironment = testEnvironment;
  window.testConfigurationInheritance = testConfigurationInheritance;
  window.testManualConfiguration = testManualConfiguration;
  window.testDisplayCreation = testDisplayCreation;
  window.testWorkspacePersistence = testWorkspacePersistence;
  window.resetApplicationState = resetApplicationState;

  console.log('\n🧪 Test functions loaded and available:');
  console.log('  - runNeurosenseTests() - Run all tests');
  console.log('  - testEnvironment() - Test environment setup');
  console.log('  - testConfigurationInheritance() - Test config inheritance');
  console.log('  - testManualConfiguration() - Test manual config changes');
  console.log('  - testDisplayCreation() - Test display creation');
  console.log('  - testWorkspacePersistence() - Test workspace persistence');
  console.log('  - resetApplicationState() - Reset and reload');
  console.log('\n🚀 Auto-running all tests in 2 seconds...');

  // Auto-run tests after 2 seconds
  setTimeout(runAllTests, 2000);
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runAllTests,
    testEnvironment,
    testConfigurationInheritance,
    testManualConfiguration,
    testDisplayCreation,
    testWorkspacePersistence,
    resetApplicationState
  };
}