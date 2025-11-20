/**
 * Simple test to verify configuration inheritance fix
 * This can be run in the browser console to test the fix
 */

import { displayStore, displayActions } from '../stores/displayStore.js';
import { getEssentialDefaultConfig } from '../config/visualizationSchema.js';

/**
 * Test configuration inheritance for new displays
 */
export function testConfigurationInheritance() {
  console.log('🧪 Testing Configuration Inheritance Fix...');

  return new Promise((resolve) => {
    let testResults = {
      initialDefaultsTest: false,
      configUpdateTest: false,
      newDisplayInheritanceTest: false,
      workspaceRestorationTest: false
    };

    // Step 1: Verify initial defaults
    displayStore.subscribe(store => {
      const factoryDefaults = getEssentialDefaultConfig();
      const currentDefaults = store.defaultConfig;

      // Test 1: Initial defaults should match factory defaults
      testResults.initialDefaultsTest = JSON.stringify(currentDefaults) === JSON.stringify(factoryDefaults);
      console.log('✅ Test 1 - Initial defaults match factory:', testResults.initialDefaultsTest);

      // Step 2: Update a configuration parameter
      if (testResults.initialDefaultsTest) {
        // Test with a parameter that definitely exists
        const testParam = 'marketProfile.mode';
        const testValue = 'delta';

        // Update global config
        displayActions.updateGlobalConfig(testParam, testValue);

        // Step 3: Verify the update took effect
        setTimeout(() => {
          displayStore.subscribe(updatedStore => {
            const updatedConfig = updatedStore.defaultConfig;
            testResults.configUpdateTest = updatedConfig[testParam] === testValue;
            console.log('✅ Test 2 - Config update applied correctly:', testResults.configUpdateTest);

            // Step 4: Create a new display and test inheritance
            if (testResults.configUpdateTest) {
              const testSymbol = 'EURUSD_TEST';
              const displayId = displayActions.addDisplay(testSymbol, { x: 50, y: 50 });

              // Check if new display inherited the updated config
              setTimeout(() => {
                displayStore.subscribe(finalStore => {
                  const newDisplay = finalStore.displays.get(displayId);
                  if (newDisplay) {
                    testResults.newDisplayInheritanceTest = newDisplay.config[testParam] === testValue;
                    console.log('✅ Test 3 - New display inherits updated config:', testResults.newDisplayInheritanceTest);

                    // Cleanup
                    displayActions.removeDisplay(displayId);
                  }

                  // Final results
                  const allTestsPassed = Object.values(testResults).every(result => result === true);
                  console.log('🏁 Configuration Inheritance Test Results:', testResults);
                  console.log(`${allTestsPassed ? '✅' : '❌'} All tests passed:`, allTestsPassed);

                  resolve(testResults);
                });
              }, 100);
            } else {
              console.log('❌ Test 2 failed - skipping display inheritance test');
              resolve(testResults);
            }
          });
        }, 100);
      } else {
        console.log('❌ Test 1 failed - skipping config update test');
        resolve(testResults);
      }
    })();
  });
}

/**
 * Quick test that can be called from browser console
 */
export function quickConfigTest() {
  console.log('🚀 Running quick configuration inheritance test...');

  // Add to window for console access
  if (typeof window !== 'undefined') {
    window.testConfigurationInheritance = testConfigurationInheritance;
    window.quickConfigTest = quickConfigTest;
    console.log('💡 Run window.testConfigurationInheritance() in console to test');
  }

  return testConfigurationInheritance();
}

/**
 * Verify the specific issue mentioned in the fix
 */
export function verifyStaleDefaultsFix() {
  console.log('🔧 Verifying stale defaults fix...');

  displayStore.subscribe(store => {
    const factoryDefaults = getEssentialDefaultConfig();
    const currentDefaults = store.defaultConfig;

    // These should be different objects after any config change
    const areDifferentObjects = factoryDefaults !== currentDefaults;
    console.log('✅ Factory and runtime defaults are different objects:', areDifferentObjects);

    // Update a parameter to test runtime modification
    displayActions.updateGlobalConfig('marketProfile.mode', 'volume');

    setTimeout(() => {
      displayStore.subscribe(updatedStore => {
        const runtimeDefaultsUpdated = updatedStore.defaultConfig['marketProfile.mode'] === 'volume';
        const factoryDefaultsUnchanged = factoryDefaults['marketProfile.mode'] !== 'volume';

        console.log('✅ Runtime defaults updated:', runtimeDefaultsUpdated);
        console.log('✅ Factory defaults unchanged:', factoryDefaultsUnchanged);
        console.log('🎯 Stale defaults fix verified:', runtimeDefaultsUpdated && factoryDefaultsUnchanged);
      });
    }, 100);
  });
}

export default {
  testConfigurationInheritance,
  quickConfigTest,
  verifyStaleDefaultsFix
};